const VERSION = "11.8-MASTER-VAULT";
console.log("App Version: " + VERSION);

const urlParams = new URLSearchParams(window.location.search);
const SHEET_ID = urlParams.get('id'); 
let appConfig = {};
let fullData = [];
let navigationStack = ['page-macro'];
let currentMacro = '';
let currentCat = '';
let activeFilters = [];

// FAILSAFE: Sblocca la schermata se il caricamento fallisce
const failsafeTimeout = setTimeout(() => {
    const loader = document.getElementById('loading-screen');
    if (loader && !loader.classList.contains('hidden')) {
        loader.classList.add('hidden');
        if (fullData.length > 0) renderLevel1();
    }
}, 6000);

// --- UTILITIES ---
function cleanString(val) { return String(val || '').trim().replace(/^["']|["']$/g, '').replace(/,+$/, '').trim(); }
function escapeHTML(str) { return String(str || '').replace(/[&<>'"]/g, t => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":"&#39;",'"':'&quot;'}[t] || t)); }
function escapeJS(str) { return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"'); }
function safeParseCSVRow(str) {
    let arr = []; let quote = false; let cell = '';
    for (let i = 0; i < str.length; i++) {
        let c = str[i];
        if (c === '"' && str[i+1] === '"') { cell += '"'; i++; } 
        else if (c === '"') { quote = !quote; }
        else if (c === ',' && !quote) { arr.push(cell); cell = ''; }
        else { cell += c; }
    }
    arr.push(cell); return arr.map(x => cleanString(x));
}
function getVal(key, def) {
    const searchKey = key.toLowerCase().trim();
    for (let k in appConfig) if (k.toLowerCase().trim() === searchKey) return appConfig[k] || def;
    return def;
}
function isTruthy(val) { return ['TRUE','SI','SÌ','YES','1','V','VERO'].includes(String(val || '').toUpperCase().trim()); }
function parseColor(colorVal, opacityVal = 1) {
    let op = parseFloat(opacityVal); if(isNaN(op)) op = 1; 
    let c = String(colorVal).trim(); if (!c) return `rgba(255,255,255,${op})`;
    if(/^[0-9A-Fa-f]{3,6}$/.test(c)) c = '#' + c;
    if (c.startsWith('#')) {
        let hex = c.replace('#', '');
        if(hex.length === 3) hex = hex.split('').map(x => x+x).join(''); 
        if(hex.length === 6) {
            let r = parseInt(hex.substring(0, 2), 16), g = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16);
            return `rgba(${r}, ${g}, ${b}, ${op})`;
        }
    }
    return c; 
}

// --- INIT ---
async function init() {
    if (!document.getElementById('sub-header')) {
        const sh = document.createElement('div'); sh.id = 'sub-header';
        sh.innerHTML = `<h2 id="sub-header-title"></h2><div id="sub-header-filters" class="filters-container"></div>`;
        document.body.appendChild(sh);
    }
    if (!document.getElementById('pwa-prompt')) {
        const pwa = document.createElement('div'); pwa.id = 'pwa-prompt';
        pwa.innerHTML = `<div class="pwa-box"><button class="pwa-close" onclick="closePWA()">×</button><div class="pwa-title">Installa l'App</div><div class="pwa-instruction">Tocca l'icona di condivisione e seleziona <b>Aggiungi a Home</b></div></div>`;
        document.body.appendChild(pwa);
    }
    if (!SHEET_ID) return;
    await fetchConfig(); 
    applyConfig();       
    setupAutoTranslate(); // Attiva traduzione intelligente
    await fetchMenu();
    checkPWA();
}

async function fetchConfig() {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=config&t=${Date.now()}`;
    const res = await fetch(url);
    const csv = await res.text();
    csv.replace(/^\ufeff/, '').split(/\r?\n/).forEach(row => {
        if(!row.trim()) return;
        const cols = safeParseCSVRow(row);
        if(cols.length >= 2 && cols[0].toLowerCase() !== 'property') appConfig[cols[0]] = cols[1];
    });
}

// --- TRADUTTORE INTELLIGENTE (RE-INTEGRATO) ---
function setupAutoTranslate() {
    const sourceLang = getVal('Lang_Source', 'it').toLowerCase(); 
    const targetLangsStr = getVal('Lang_Targets', 'ALL').toUpperCase(); 
    let userLang = (navigator.language || navigator.userLanguage).slice(0, 2).toLowerCase();

    if (userLang === sourceLang) return; 
    if (targetLangsStr !== 'ALL') {
        const allowed = targetLangsStr.toLowerCase().split(',').map(l => l.trim());
        if (!allowed.includes(userLang)) return;
    }

    document.cookie = `googtrans=/${sourceLang}/${userLang}; path=/`;
    const widgetDiv = document.createElement('div');
    widgetDiv.id = 'google_translate_element';
    widgetDiv.style.display = 'none';
    document.body.appendChild(widgetDiv);

    window.googleTranslateElementInit = function() { 
        new google.translate.TranslateElement({ pageLanguage: sourceLang, autoDisplay: false }, 'google_translate_element'); 
    };

    const script = document.createElement('script');
    script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    document.body.appendChild(script);

    // Cecchino Javascript anti-banner
    const killer = setInterval(() => {
        const frames = document.querySelectorAll('.goog-te-banner-frame, iframe.goog-te-banner-frame');
        frames.forEach(f => f.style.display = 'none');
        if (document.body.style.top !== '0px') document.body.style.top = '0px';
    }, 100);
    setTimeout(() => clearInterval(killer), 6000);
}

function applyConfig() {
    const root = document.documentElement;
    root.style.setProperty('--back-bg', parseColor(getVal('Back_Btn_Bg', '#111827')));
    root.style.setProperty('--back-color', parseColor(getVal('Back_Btn_Color', '#ffffff')));
    root.style.setProperty('--back-shadow', getVal('Back_Btn_Shadow_Intensity', 'none') !== 'none' ? '0 4px 6px rgba(0,0,0,0.1)' : 'none');
    root.style.setProperty('--macro-cols', getVal('Macro_Layout', 'grid').toLowerCase() === 'list' ? '1' : '2');
    root.style.setProperty('--macro-height', getVal('Macro_Height', '180px'));
    root.style.setProperty('--macro-shadow', getVal('Macro_Shadow_Intensity', 'medium') !== 'none' ? '0 4px 6px rgba(0,0,0,0.1)' : 'none');
    root.style.setProperty('--macro-text-color', parseColor(getVal('Macro_Text_Color', '#ffffff')));
    root.style.setProperty('--macro-text-font', getVal('Macro_Text_Font', 'sans-serif'));
    root.style.setProperty('--macro-text-weight', isTruthy(getVal('Macro_Text_Bold', 'TRUE')) ? 'bold' : 'normal');
    root.style.setProperty('--macro-text-shadow', isTruthy(getVal('Macro_Text_Shadow', 'TRUE')) ? '0px 2px 6px rgba(0,0,0,0.8)' : 'none');
    const vPos = getVal('Macro_Text_VAlign', 'center').toLowerCase();
    root.style.setProperty('--macro-align-v', vPos === 'top' ? 'flex-start' : (vPos === 'bottom' ? 'flex-end' : 'center'));
    const hPos = getVal('Macro_Text_HAlign', 'center').toLowerCase();
    root.style.setProperty('--macro-align-h', hPos === 'left' ? 'flex-start' : (hPos === 'right' ? 'flex-end' : 'center'));
    root.style.setProperty('--cat-cols', getVal('Cat_Layout', 'list').toLowerCase() === 'grid' ? '2' : '1');
    root.style.setProperty('--cat-bg', parseColor(getVal('Cat_Bg_Color', '#ffffff')));
    root.style.setProperty('--cat-height', getVal('Cat_Height', '120px'));
    const cInt = getVal('Cat_Shadow_Intensity', 'light').toLowerCase();
    root.style.setProperty('--cat-shadow', cInt === 'none' ? 'none' : (cInt === 'medium' ? '0 4px 6px rgba(0,0,0,0.1)' : (cInt === 'strong' ? '0 10px 15px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.05)')));
    root.style.setProperty('--cat-text-color', parseColor(getVal('Cat_Text_Color', '#1f2937')));
    root.style.setProperty('--cat-text-font', getVal('Cat_Text_Font', 'sans-serif'));
    root.style.setProperty('--cat-text-weight', isTruthy(getVal('Cat_Text_Bold', 'TRUE')) ? 'bold' : 'normal');
    const cvPos = getVal('Cat_Text_VAlign', 'center').toLowerCase();
    root.style.setProperty('--cat-align-v', cvPos === 'top' ? 'flex-start' : (cvPos === 'bottom' ? 'flex-end' : 'center'));
    const chPos = getVal('Cat_Text_HAlign', 'left').toLowerCase();
    root.style.setProperty('--cat-align-h', chPos === 'center' ? 'center' : (chPos === 'right' ? 'flex-end' : 'flex-start'));
    if (getVal('App_Bg_Type', 'color').toLowerCase() === 'image' && getVal('App_Bg_Image_URL', '')) {
        root.style.setProperty('--app-bg-image', `url('${escapeHTML(getVal('App_Bg_Image_URL', ''))}')`);
        root.style.setProperty('--app-bg-size', getVal('App_Bg_Image_Size', 'cover'));
        root.style.setProperty('--app-bg-position', getVal('App_Bg_Image_Position', 'center'));
    } else root.style.setProperty('--app-bg-image', 'none');
    root.style.setProperty('--app-bg-color', parseColor(getVal('App_Bg_Color', '#f9fafb')));
    root.style.setProperty('--header-bg', parseColor(getVal('Header_Color', '#ffffff'), isTruthy(getVal('Header_Transparent', 'FALSE')) ? '0.5' : '1'));
    root.style.setProperty('--header-shadow', getVal('Header_Shadow_Intensity', 'medium') !== 'none' ? '0 4px 15px rgba(0,0,0,0.08)' : 'none');
    const logoCont = document.getElementById('logo-container');
    const logoUrl = getVal('Logo_Image_URL', '');
    logoCont.style.justifyContent = getVal('Logo_Align', 'center').toLowerCase() === 'left' ? 'flex-start' : (getVal('Logo_Align', 'center').toLowerCase() === 'right' ? 'flex-end' : 'center');
    if (logoUrl) {
        logoCont.innerHTML = `<img src="${escapeHTML(logoUrl)}" id="app-logo" style="max-height:${escapeHTML(getVal('Logo_Height', '80px'))}; object-fit:contain;" translate="no" class="notranslate">`;
        document.getElementById('app-logo').onload = updateLayout;
    }
    const sub = document.getElementById('subtitle-container');
    root.style.setProperty('--subtitle-color', parseColor(getVal('Subtitle_Color', '#6b7280')));
    root.style.setProperty('--subtitle-font', getVal('Subtitle_Font', 'sans-serif'));
    if (getVal('Subtitle_Text', '') !== '') {
        sub.style.display = 'block'; sub.innerText = getVal('Subtitle_Text', '');
        sub.style.color = 'var(--subtitle-color)'; sub.style.fontSize = getVal('Subtitle_Size', '14px');
        sub.style.fontFamily = 'var(--subtitle-font)'; sub.style.fontWeight = isTruthy(getVal('Subtitle_Bold', 'FALSE')) ? 'bold' : 'normal';
        sub.style.textAlign = getVal('Subtitle_Align', 'center').toLowerCase(); sub.style.marginTop = getVal('Subtitle_Margin_Top', '5px');
    } else sub.style.display = 'none';
    root.style.setProperty('--filter-margin', getVal('SubHeader_Filter_Margin', '12px'));
    const shTitle = document.getElementById('sub-header-title');
    if (shTitle) { shTitle.style.fontSize = getVal('SubHeader_Size', '16px'); shTitle.style.fontWeight = isTruthy(getVal('SubHeader_Bold', 'TRUE')) ? 'bold' : 'normal'; }
    root.style.setProperty('--item-name-color', parseColor(getVal('Item_Name_Color', '#111827')));
    root.style.setProperty('--item-name-font', getVal('Item_Name_Font', 'sans-serif'));
    root.style.setProperty('--item-name-size', getVal('Item_Name_Size', '18px'));
    root.style.setProperty('--item-name-weight', isTruthy(getVal('Item_Name_Bold', 'TRUE')) ? 'bold' : 'normal');
    root.style.setProperty('--item-desc-color', parseColor(getVal('Item_Desc_Color', '#6b7280')));
    root.style.setProperty('--item-desc-font', getVal('Item_Desc_Font', 'sans-serif'));
    root.style.setProperty('--item-desc-size', getVal('Item_Desc_Size', '14px'));
    root.style.setProperty('--item-desc-weight', isTruthy(getVal('Item_Desc_Bold', 'FALSE')) ? 'bold' : 'normal');
    root.style.setProperty('--item-price-color', parseColor(getVal('Item_Price_Color', '#4f46e5')));
    root.style.setProperty('--item-price-font', getVal('Item_Price_Font', 'sans-serif'));
    root.style.setProperty('--item-price-size', getVal('Item_Price_Size', '16px'));
    root.style.setProperty('--item-price-weight', isTruthy(getVal('Item_Price_Bold', 'TRUE')) ? 'bold' : 'normal');
    root.style.setProperty('--ar-btn-bg', parseColor(getVal('Item_AR_Btn_Bg', '#111827')));
    root.style.setProperty('--ar-btn-color', parseColor(getVal('Item_AR_Btn_Color', '#ffffff')));
}

function updateLayout() {
    setTimeout(() => {
        const header = document.getElementById('main-header');
        const subHeader = document.getElementById('sub-header');
        const main = document.getElementById('main-content');
        const backBtn = document.getElementById('back-button');
        if (header) {
            const hHeight = header.offsetHeight;
            let totalHeight = hHeight;
            if (backBtn) {
                if (getVal('Back_Btn_Position', 'center').toLowerCase() === 'bottom') backBtn.style.top = (hHeight - 34 - 10) + "px"; 
                else backBtn.style.top = (hHeight / 2 - 17) + "px"; 
            }
            if (subHeader && subHeader.style.display === 'flex') {
                subHeader.style.top = hHeight + "px";
                totalHeight += subHeader.offsetHeight;
            }
            if (main) main.style.paddingTop = `calc(${totalHeight}px + 20px)`;
        }
    }, 50);
}

async function fetchMenu() {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=menu&t=${Date.now()}`;
    const res = await fetch(url);
    const csv = await res.text();
    fullData = [];
    const rows = csv.split(/\r?\n/);
    for(let i=1; i<rows.length; i++){
        const c = safeParseCSVRow(rows[i]);
        if(c.length >= 3 && c[0]) {
            fullData.push({ macro: c[0], cat: c[1], name: c[2], desc: c[3], price: c[5], gf: c[6], vegan: c[7], veg: c[8], noalc: c[9], active: c[10]||'TRUE', photo: c[11], ar: c[12] });
        }
    }
    fullData = fullData.filter(i => isTruthy(i.active));
    clearTimeout(failsafeTimeout);
    document.getElementById('loading-screen').classList.add('hidden');
    renderLevel1();
}

function renderLevel1() {
    const container = document.getElementById('macro-layout-container');
    const macros = [...new Set(fullData.map(i => i.macro))];
    container.innerHTML = '';
    macros.forEach(m => {
        const searchKey = 'Macro_Img_' + m.replace(/\s+/g, '_');
        const imgUrl = getVal(searchKey, '');
        const bgStyle = imgUrl ? `background-image: url('${escapeHTML(imgUrl)}');` : '';
        container.innerHTML += `<div onclick="renderLevel2('${escapeJS(m)}')" class="macro-card" style="${bgStyle}"><div class="macro-overlay"></div><span class="macro-text-inside">${escapeHTML(m)}</span></div>`;
    });
    showPage('page-macro');
}

function renderLevel2(m) {
    const container = document.getElementById('page-categories');
    const cats = [...new Set(fullData.filter(i => i.macro === m).map(i => i.cat))];
    container.className = 'cat-container'; container.innerHTML = '';
    const layout = getVal('Cat_Layout', 'list').toLowerCase();
    cats.forEach(c => {
        const imgUrl = getVal('Cat_Img_' + c.replace(/\s+/g, '_'), '');
        let innerHtml = '';
        if (imgUrl) {
            if (layout === 'grid') innerHtml = `<div class="cat-img-wrapper"><img src="${escapeHTML(imgUrl)}" class="cat-img-grid" loading="lazy"></div><div class="cat-text-wrapper"><span class="cat-text">${escapeHTML(c)}</span></div>`;
            else innerHtml = `<div class="cat-text-wrapper"><span class="cat-text">${escapeHTML(c)}</span></div><div class="cat-img-wrapper"><img src="${escapeHTML(imgUrl)}" class="cat-img-list" loading="lazy"></div>`;
        } else {
            innerHtml = `<div class="cat-text-wrapper" style="width:100%;"><span class="cat-text">${escapeHTML(c)}</span></div>`;
        }
        container.innerHTML += `<div onclick="renderLevel3('${escapeJS(m)}','${escapeJS(c)}')" class="cat-card layout-${layout}">${innerHtml}</div>`;
    });
    if (navigationStack[navigationStack.length-1] !== 'page-categories') navigationStack.push('page-categories'); 
    showPage('page-categories');
}

function toggleFilter(filterType) {
    if (activeFilters.includes(filterType)) activeFilters = []; else activeFilters = [filterType];
    renderLevel3(currentMacro, currentCat, true);
}

function renderLevel3(m, c, isFiltering = false) {
    currentMacro = m; currentCat = c;
    if (!isFiltering) activeFilters = []; 
    const container = document.getElementById('page-items');
    container.innerHTML = '';
    let allItems = fullData.filter(i => i.macro === m && i.cat === c);
    if (!isFiltering) {
        document.getElementById('sub-header-title').innerText = c;
        let fHtml = '';
        if (m.toLowerCase().match(/bevand|bebid|drink/)) {
            if(allItems.some(i => isTruthy(i.noalc))) fHtml += `<button onclick="toggleFilter('noalc')" id="btn-noalc" class="filter-btn">Analcolico</button>`;
        } else {
            if(allItems.some(i => isTruthy(i.gf))) fHtml += `<button onclick="toggleFilter('gf')" id="btn-gf" class="filter-btn">Senza Glutine</button>`;
            if(allItems.some(i => isTruthy(i.vegan))) fHtml += `<button onclick="toggleFilter('vegan')" id="btn-vegan" class="filter-btn">Vegano</button>`;
            if(allItems.some(i => isTruthy(i.veg))) fHtml += `<button onclick="toggleFilter('veg')" id="btn-veg" class="filter-btn">Vegetariano</button>`;
        }
        document.getElementById('sub-header-filters').innerHTML = fHtml;
    }
    ['gf', 'vegan', 'veg', 'noalc'].forEach(f => {
        const b = document.getElementById(`btn-${f}`);
        if(b) activeFilters.includes(f) ? b.classList.add('active') : b.classList.remove('active');
    });
    let items = allItems;
    if (activeFilters.length > 0) items = items.filter(i => activeFilters.every(f => isTruthy(i[f])));
    items.forEach(i => {
        let b = '';
        if(isTruthy(i.gf)) b += `<span class="badge badge-gf">Senza Glutine</span>`;
        if(isTruthy(i.vegan)) b += `<span class="badge badge-vegan">Vegano</span>`;
        if(isTruthy(i.veg)) b += `<span class="badge badge-veg">Vegetariano</span>`;
        if(isTruthy(i.noalc)) b += `<span class="badge badge-noalc">Analcolico</span>`;
        const ar = i.ar ? `<div style="width: 100%; display: flex; justify-content: center; margin-top: 15px;"><a href="${escapeHTML(i.ar)}" target="_blank" class="ar-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg> Vedi Piatto</a></div>` : '';
        // NOTRANSLATE solo su NOME e PREZZO
        container.innerHTML += `<div class="menu-card"><div class="item-card"><div style="flex-grow:1;"><div class="item-name notranslate">${escapeHTML(i.name)}</div><div class="item-desc">${escapeHTML(i.desc)}</div><div class="item-price notranslate">${escapeHTML(i.price)}</div></div>${i.photo ? `<img src="${escapeHTML(i.photo)}" class="item-photo" style="margin-left: 10px;" loading="lazy">` : ''}</div><div class="badge-container">${b}</div>${ar}</div>`;
    });
    if(!isFiltering && navigationStack[navigationStack.length-1] !== 'page-items') navigationStack.push('page-items'); 
    showPage('page-items'); 
}

function showPage(p) {
    ['page-macro', 'page-categories', 'page-items'].forEach(id => { const el = document.getElementById(id); if(el) el.classList.add('hidden'); });
    const target = document.getElementById(p); if(target) target.classList.remove('hidden');
    const backBtn = document.getElementById('back-button');
    const subHeader = document.getElementById('sub-header');
    if (backBtn) {
        if (p === 'page-macro') backBtn.classList.remove('active'); 
        else backBtn.classList.add('active'); 
    }
    if (subHeader) subHeader.style.display = (p === 'page-items') ? 'flex' : 'none';
    updateLayout(); window.scrollTo({top: 0, behavior: 'instant'});
}

function goBack() { if(navigationStack.length > 1) { navigationStack.pop(); showPage(navigationStack[navigationStack.length-1]); } }
function closePWA() { localStorage.setItem('pwa_dismissed', 'true'); document.getElementById('pwa-prompt').classList.remove('visible'); }
function checkPWA() {
    if (!isTruthy(getVal('PWA_Install_Prompt', 'FALSE'))) return;
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || localStorage.getItem('pwa_dismissed')) return;
    setTimeout(() => { document.getElementById('pwa-prompt').classList.add('visible'); }, 3000);
}

init();
