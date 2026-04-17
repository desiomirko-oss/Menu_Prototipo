const VERSION = "12.0-MASTER-STABLE";
console.log("App Version: " + VERSION);

const urlParams = new URLSearchParams(window.location.search);
const SHEET_ID = urlParams.get('id'); 
let appConfig = {};
let fullData = [];
let navigationStack = ['page-macro'];
let currentMacro = '';
let currentCat = '';
let activeFilters = [];

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
        const sh = document.createElement('div');
        sh.id = 'sub-header';
        sh.innerHTML = `<h2 id="sub-header-title"></h2><div id="sub-header-filters" class="filters-container"></div>`;
        document.body.appendChild(sh);
    }
    if (!SHEET_ID) return;
    await fetchConfig(); 
    applyConfig();       
    setupAutoTranslate(); 
    await fetchMenu();
}

async function fetchConfig() {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=config&t=${Date.now()}`;
    try {
        const response = await fetch(url);
        let csv = await response.text();
        csv.replace(/^\ufeff/, '').split(/\r?\n/).forEach(row => {
            if(!row.trim()) return;
            const cols = safeParseCSVRow(row);
            if(cols.length >= 2 && cols[0].toLowerCase() !== 'property') appConfig[cols[0]] = cols[1];
        });
    } catch(e) { console.error(e); }
}

function setupAutoTranslate() {
    const sourceLang = getVal('Lang_Source', 'es').toLowerCase(); 
    const targetLangsStr = getVal('Lang_Targets', 'ALL').toUpperCase(); 
    let userLang = (navigator.language || navigator.userLanguage).slice(0, 2).toLowerCase();

    if (userLang === sourceLang) return; 
    if (targetLangsStr !== 'ALL') {
        const allowed = targetLangsStr.toLowerCase().split(',').map(l => l.trim());
        if (!allowed.includes(userLang)) return;
    }

    document.cookie = `googtrans=/${sourceLang}/${userLang}; path=/`;
    const script = document.createElement('script');
    script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    document.body.appendChild(script);
    window.googleTranslateElementInit = () => { new google.translate.TranslateElement({ pageLanguage: sourceLang, autoDisplay: false }, 'google_translate_element'); };

    const killer = setInterval(() => {
        const frames = document.querySelectorAll('.goog-te-banner-frame, iframe.goog-te-banner-frame');
        frames.forEach(f => { f.style.display = 'none'; f.style.height = '0px'; });
        if (document.body.style.top !== '0px') document.body.style.top = '0px';
    }, 50);
    setTimeout(() => clearInterval(killer), 6000);
}

function applyConfig() {
    const root = document.documentElement;
    root.style.setProperty('--back-bg', parseColor(getVal('Back_Btn_Bg', '#111827')));
    root.style.setProperty('--back-color', parseColor(getVal('Back_Btn_Color', '#ffffff')));
    root.style.setProperty('--back-shadow', getVal('Back_Btn_Shadow_Intensity', 'none') !== 'none' ? '0 4px 6px rgba(0,0,0,0.1)' : 'none');
    
    root.style.setProperty('--macro-cols', getVal('Macro_Layout', 'grid').toLowerCase() === 'list' ? '1' : '2');
    root.style.setProperty('--macro-height', getVal('Macro_Height', '180px'));
    root.style.setProperty('--macro-bg-color', parseColor(getVal('Macro_Bg_Color', '#d1d5db')));
    const mInt = getVal('Macro_Shadow_Intensity', 'medium').toLowerCase();
    root.style.setProperty('--macro-shadow', mInt === 'none' ? 'none' : (mInt === 'light' ? '0 2px 4px rgba(0,0,0,0.05)' : (mInt === 'strong' ? '0 10px 15px rgba(0,0,0,0.2)' : '0 4px 6px rgba(0,0,0,0.1)')));
    
    root.style.setProperty('--macro-text-color', parseColor(getVal('Macro_Text_Color', '#ffffff')));
    root.style.setProperty('--macro-text-font', getVal('Macro_Text_Font', 'sans-serif'));
    root.style.setProperty('--macro-text-weight', isTruthy(getVal('Macro_Text_Bold', 'TRUE')) ? 'bold' : 'normal');
    root.style.setProperty('--macro-text-shadow', isTruthy(getVal('Macro_Text_Shadow', 'TRUE')) ? '0px 2px 6px rgba(0,0,0,0.8)' : 'none');
    
    root.style.setProperty('--cat-bg', parseColor(getVal('Cat_Bg_Color', '#ffffff')));
    root.style.setProperty('--cat-text-color', parseColor(getVal('Cat_Text_Color', '#1f2937')));
    root.style.setProperty('--chevron-color', parseColor(getVal('Chevron_Color', '#9ca3af'))); // 🆕 PARAMETRO FRECCINA

    const logoUrl = getVal('Logo_Image_URL', '');
    if (logoUrl) {
        document.getElementById('logo-container').innerHTML = `<img src="${escapeHTML(logoUrl)}" id="app-logo" style="max-height:${escapeHTML(getVal('Logo_Height', '80px'))}; object-fit:contain;" translate="no" class="notranslate">`;
    }
    
    root.style.setProperty('--item-name-color', parseColor(getVal('Item_Name_Color', '#111827')));
    root.style.setProperty('--item-price-color', parseColor(getVal('Item_Price_Color', '#4f46e5')));
    root.style.setProperty('--ar-btn-bg', parseColor(getVal('Item_AR_Btn_Bg', '#111827')));
}

function updateLayout() {
    setTimeout(() => {
        const header = document.getElementById('main-header');
        const subHeader = document.getElementById('sub-header');
        const main = document.getElementById('main-content');
        if (header) {
            let total = header.offsetHeight;
            if (subHeader && subHeader.style.display === 'flex') total += subHeader.offsetHeight;
            if (main) main.style.paddingTop = `calc(${total}px + 20px)`;
        }
    }, 50);
}

async function fetchMenu() {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=menu&t=${Date.now()}`;
    try {
        const res = await fetch(url);
        const csv = await res.text();
        fullData = [];
        const rows = csv.split(/\r?\n/);
        for(let i=1; i<rows.length; i++){
            const c = safeParseCSVRow(rows[i]);
            if(c.length >= 3 && c[0]) {
                fullData.push({ 
                    _id: i, macro: c[0], cat: c[1], name: c[2], desc: c[3], price: c[5], 
                    gf: c[6], vegan: c[7], veg: c[8], noalc: c[9], active: c[10]||'TRUE', photo: c[11], ar: c[12], details: c[13] || '' 
                });
            }
        }
        fullData = fullData.filter(i => isTruthy(i.active));
        document.getElementById('loading-screen').classList.add('hidden');
        renderLevel1();
    } catch(e) { console.error(e); }
}

function renderLevel1() {
    const container = document.getElementById('macro-layout-container');
    const macros = [...new Set(fullData.map(i => i.macro))];
    container.innerHTML = '';
    macros.forEach(m => {
        const imgUrl = getVal('Macro_Img_' + m.replace(/\s+/g, '_'), '');
        const bgStyle = imgUrl ? `background-image: url('${escapeHTML(imgUrl)}');` : '';
        container.innerHTML += `<div onclick="renderLevel2('${escapeJS(m)}')" class="macro-card ${imgUrl?'':'no-image'}" style="${bgStyle}"><div class="macro-overlay"></div><span class="macro-text-inside">${escapeHTML(m)}</span></div>`;
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
        let inner = `<div class="cat-text-wrapper"><span class="cat-text">${escapeHTML(c)}</span></div>`;
        if (imgUrl) {
            inner = layout === 'grid' ? `<div class="cat-img-wrapper"><img src="${escapeHTML(imgUrl)}" class="cat-img-grid" loading="lazy"></div>` + inner : inner + `<div class="cat-img-wrapper"><img src="${escapeHTML(imgUrl)}" class="cat-img-list" loading="lazy"></div>`;
        }
        container.innerHTML += `<div onclick="renderLevel3('${escapeJS(m)}','${escapeJS(c)}')" class="cat-card layout-${layout}">${inner}</div>`;
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
    const container = document.getElementById('page-items'); container.innerHTML = '';
    let all = fullData.filter(i => i.macro === m && i.cat === c);
    
    if (!isFiltering) {
        document.getElementById('sub-header-title').innerText = c;
        let fHtml = '';
        const list = m.toLowerCase().match(/bevand|bebid|drink/) ? ['noalc'] : ['gf', 'vegan', 'veg'];
        list.forEach(f => { if(all.some(i => isTruthy(i[f]))) fHtml += `<button onclick="toggleFilter('${f}')" id="btn-${f}" class="filter-btn">${f==='gf'?'Senza Glutine':f==='noalc'?'Analcolico':f.charAt(0).toUpperCase()+f.slice(1)}</button>`; });
        document.getElementById('sub-header-filters').innerHTML = fHtml;
    }

    ['gf', 'vegan', 'veg', 'noalc'].forEach(f => { const b = document.getElementById(`btn-${f}`); if(b) activeFilters.includes(f) ? b.classList.add('active') : b.classList.remove('active'); });

    let items = activeFilters.length ? all.filter(i => activeFilters.every(f => isTruthy(i[f]))) : all;
    if (!items.length) container.innerHTML = `<div style="text-align:center; padding: 20px; color:#9ca3af; font-weight:bold;">Nessun piatto trovato.</div>`;

    items.forEach(i => {
        let b = '';
        if(isTruthy(i.gf)) b += `<span class="badge badge-gf">Senza Glutine</span>`;
        if(isTruthy(i.vegan)) b += `<span class="badge badge-vegan">Vegano</span>`;
        if(isTruthy(i.veg)) b += `<span class="badge badge-veg">Vegetariano</span>`;
        if(isTruthy(i.noalc)) b += `<span class="badge badge-noalc">Analcolico</span>`;
        
        const hasDet = i.details.trim() !== '';
        // 🆕 CLIP A: Chevron sulla stessa riga dei badge
        const badgeRow = `<div class="badge-container"><div class="badge-group">${b}</div>${hasDet?'<span class="inline-chevron">›</span>':''}</div>`;
        const ar = i.ar ? `<div style="width:100%; display:flex; justify-content:center;"><a href="${escapeHTML(i.ar)}" target="_blank" class="ar-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg> Vedi Piatto</a></div>` : '';

        container.innerHTML += `
        <div class="menu-card ${hasDet?'clickable-card':''}" ${hasDet?`onclick="openItemDetails(${i._id})"`:''}>
            <div class="item-card">
                <div style="flex-grow:1;">
                    <div class="item-name notranslate">${escapeHTML(i.name)}</div>
                    <div class="item-desc">${escapeHTML(i.desc)}</div>
                    <div class="item-price notranslate">${escapeHTML(i.price)}</div>
                </div>
                ${i.photo ? `<img src="${escapeHTML(i.photo)}" class="item-photo" style="margin-left:10px;" loading="lazy">` : ''}
            </div>
            ${badgeRow}
            ${ar}
        </div>`;
    });
    if(!isFiltering && navigationStack[navigationStack.length-1] !== 'page-items') navigationStack.push('page-items');
    showPage('page-items');
}

// 🆕 LIVELLO 4: CLIP B (Inversione e Spazi)
function openItemDetails(id) {
    const item = fullData.find(x => x._id === id);
    if (!item) return;
    const container = document.getElementById('page-item-details');
    let b = '';
    if(isTruthy(item.gf)) b += `<span class="badge badge-gf">Senza Glutine</span>`;
    if(isTruthy(item.vegan)) b += `<span class="badge badge-vegan">Vegano</span>`;
    if(isTruthy(item.veg)) b += `<span class="badge badge-veg">Vegetariano</span>`;
    if(isTruthy(item.noalc)) b += `<span class="badge badge-noalc">Analcolico</span>`;
    
    // CLIP B: Nome -> Badges -> Prezzo -> Descrizione
    container.innerHTML = `
        <div class="details-page-card">
            ${item.photo ? `<img src="${escapeHTML(item.photo)}" class="detail-photo">` : ''}
            <div style="padding: 0 20px;">
                <div class="detail-title notranslate">${escapeHTML(item.name)}</div>
                <div class="badge-container" style="justify-content:center; margin-bottom:10px;"><div class="badge-group">${b}</div></div>
                <div class="detail-price notranslate">${escapeHTML(item.price)}</div>
                <div class="detail-desc">${escapeHTML(item.desc)}</div>
                <div class="detail-long-text">${escapeHTML(item.details).replace(/\n/g, '<br>')}</div>
                ${item.ar ? `<div style="width:100%; display:flex; justify-content:center; margin-top:20px;"><a href="${escapeHTML(item.ar)}" target="_blank" class="ar-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg> Vedi Piatto in AR</a></div>` : ''}
            </div>
        </div>`;
    navigationStack.push('page-item-details');
    showPage('page-item-details');
}

function showPage(p) {
    ['page-macro', 'page-categories', 'page-items', 'page-item-details'].forEach(id => { const el = document.getElementById(id); if(el) el.classList.add('hidden'); });
    document.getElementById(p).classList.remove('hidden');
    const backBtn = document.getElementById('back-button');
    const subHeader = document.getElementById('sub-header');
    if (backBtn) p === 'page-macro' ? backBtn.classList.remove('active') : backBtn.classList.add('active');
    if (subHeader) subHeader.style.display = (p === 'page-items') ? 'flex' : 'none';
    updateLayout(); window.scrollTo({top: 0, behavior: 'instant'});
}

function goBack() { if(navigationStack.length > 1) { navigationStack.pop(); showPage(navigationStack[navigationStack.length-1]); } }

init();
