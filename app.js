const VERSION = "8.1-LIVELLO3-FILTRI";
console.log("App Version: " + VERSION);

const urlParams = new URLSearchParams(window.location.search);
const SHEET_ID = urlParams.get('id'); 
let appConfig = {};
let fullData = [];
let navigationStack = ['page-macro'];

// Variabili di stato per i filtri
let currentMacro = '';
let currentCat = '';
let activeFilters = [];

// --- TRADUZIONE ---
function setupAutoTranslate() {
    const baseLang = 'it'; 
    const userLang = (navigator.language || navigator.userLanguage).slice(0, 2).toLowerCase();
    if (userLang !== baseLang) {
        const style = document.createElement('style');
        style.innerHTML = `.goog-te-banner-frame.skiptranslate { display: none !important; } body { top: 0px !important; } #goog-gt-tt { display: none !important; }`;
        document.head.appendChild(style);
        document.cookie = `googtrans=/${baseLang}/${userLang}; path=/`;
        const widgetDiv = document.createElement('div');
        widgetDiv.id = 'google_translate_element';
        widgetDiv.style.display = 'none';
        document.body.appendChild(widgetDiv);
        window.googleTranslateElementInit = function() { new google.translate.TranslateElement({pageLanguage: baseLang, autoDisplay: false}, 'google_translate_element'); };
        const script = document.createElement('script');
        script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
        document.body.appendChild(script);
    }
}

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
    setupAutoTranslate();
    
    // Iniezione automatica del Sub-Header nel DOM se non esiste
    if (!document.getElementById('sub-header')) {
        const sh = document.createElement('div');
        sh.id = 'sub-header';
        sh.innerHTML = `<h2 id="sub-header-title"></h2><div id="sub-header-filters" class="filters-container"></div>`;
        document.body.appendChild(sh);
    }

    if (!SHEET_ID) return;
    await fetchConfig(); 
    applyConfig();       
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

function applyConfig() {
    const root = document.documentElement;

    root.style.setProperty('--back-bg', parseColor(getVal('Back_Btn_Bg', '#111827')));
    root.style.setProperty('--back-color', parseColor(getVal('Back_Btn_Color', '#ffffff')));
    root.style.setProperty('--back-shadow', getVal('Back_Btn_Shadow_Intensity', 'none') !== 'none' ? '0 4px 6px rgba(0,0,0,0.1)' : 'none');

    const layout = getVal('Macro_Layout', 'grid').toLowerCase();
    root.style.setProperty('--macro-cols', layout === 'list' ? '1' : '2');
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

    const bgType = getVal('App_Bg_Type', 'color').toLowerCase();
    if (bgType === 'image' && getVal('App_Bg_Image_URL', '')) {
        root.style.setProperty('--app-bg-image', `url('${escapeHTML(getVal('App_Bg_Image_URL', ''))}')`);
        root.style.setProperty('--app-bg-size', getVal('App_Bg_Image_Size', 'cover'));
        root.style.setProperty('--app-bg-position', getVal('App_Bg_Image_Position', 'center'));
    } else {
        root.style.setProperty('--app-bg-image', 'none');
    }
    root.style.setProperty('--app-bg-color', parseColor(getVal('App_Bg_Color', '#f9fafb')));

    const headerOpacity = isTruthy(getVal('Header_Transparent', 'FALSE')) ? '0.5' : '1';
    root.style.setProperty('--header-bg', parseColor(getVal('Header_Color', '#ffffff'), headerOpacity));
    root.style.setProperty('--header-shadow', getVal('Header_Shadow_Intensity', 'medium') !== 'none' ? '0 4px 15px rgba(0,0,0,0.08)' : 'none');

    const logoCont = document.getElementById('logo-container');
    const logoUrl = getVal('Logo_Image_URL', '');
    const align = getVal('Logo_Align', 'center').toLowerCase();
    logoCont.style.justifyContent = align === 'left' ? 'flex-start' : (align === 'right' ? 'flex-end' : 'center');
    logoCont.style.marginTop = getVal('Logo_Margin_Top', '0px');
    logoCont.style.marginBottom = '0px'; 
    if (logoUrl) {
        logoCont.innerHTML = `<img src="${escapeHTML(logoUrl)}" id="app-logo" style="max-height:${escapeHTML(getVal('Logo_Height', '80px'))}; object-fit:contain;" translate="no">`;
        document.getElementById('app-logo').onload = updateLayout;
    }

    const sub = document.getElementById('subtitle-container');
    const subText = getVal('Subtitle_Text', '');
    root.style.setProperty('--subtitle-color', parseColor(getVal('Subtitle_Color', '#6b7280')));
    root.style.setProperty('--subtitle-font', getVal('Subtitle_Font', 'sans-serif'));

    if (subText !== '') {
        sub.style.display = 'block';
        sub.innerText = subText;
        sub.style.color = 'var(--subtitle-color)';
        sub.style.fontSize = getVal('Subtitle_Size', '14px');
        sub.style.fontFamily = 'var(--subtitle-font)';
        sub.style.fontWeight = isTruthy(getVal('Subtitle_Bold', 'FALSE')) ? 'bold' : 'normal';
        sub.style.textAlign = getVal('Subtitle_Align', 'center').toLowerCase();
        sub.style.marginTop = getVal('Subtitle_Margin_Top', '5px');
    } else {
        sub.style.display = 'none';
    }

    // Parametri Sub-Header
    const subHeaderTitle = document.getElementById('sub-header-title');
    if (subHeaderTitle) {
        subHeaderTitle.style.fontSize = getVal('SubHeader_Size', '16px');
        subHeaderTitle.style.fontWeight = isTruthy(getVal('SubHeader_Bold', 'TRUE')) ? 'bold' : 'normal';
    }
}

// MOTORE MATEMATICO (Adattato per Sub-Header)
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
                const pos = getVal('Back_Btn_Position', 'center').toLowerCase();
                if (pos === 'bottom') backBtn.style.top = (hHeight - 34 - 10) + "px"; 
                else backBtn.style.top = (hHeight / 2 - 17) + "px"; 
            }

            // Se il sub-header è visibile, si aggancia sotto al main header
            if (subHeader && subHeader.style.display === 'flex') {
                subHeader.style.top = hHeight + "px";
                totalHeight += subHeader.offsetHeight;
            }

            if (main) main.style.paddingTop = `calc(${totalHeight}px + 20px)`;
        }
    }, 50);
}

// --- MENU RENDERING (Ripristino Colonne Filtri) ---
async function fetchMenu() {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=menu&t=${Date.now()}`;
    try {
        const res = await fetch(url);
        const csv = await res.text();
        fullData = [];
        const rows = csv.split(/\r?\n/);
        for(let i=1; i<rows.length; i++){
            const c = safeParseCSVRow(rows[i]);
            // Ripristinata la lettura delle colonne 6(gf), 7(vegan), 8(veg)
            if(c.length >= 3 && c[0]) {
                fullData.push({ 
                    macro: c[0], cat: c[1], name: c[2], desc: c[3], allerg: c[4], price: c[5], 
                    gf: c[6], vegan: c[7], veg: c[8], active: c[10]||'TRUE', photo: c[11] 
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
    container.className = 'macro-container';
    container.innerHTML = '';
    
    macros.forEach(m => {
        const searchKey = 'Macro_Img_' + m.replace(/\s+/g, '_');
        const imgUrl = getVal(searchKey, '');
        const bgStyle = imgUrl ? `background-image: url('${escapeHTML(imgUrl)}');` : '';

        container.innerHTML += `<div onclick="renderLevel2('${escapeJS(m)}')" class="macro-card" style="${bgStyle}">
            <div class="macro-overlay"></div>
            <span class="macro-text-inside">${escapeHTML(m)}</span>
        </div>`;
    });
    showPage('page-macro');
}

function renderLevel2(m) {
    const container = document.getElementById('page-categories');
    const cats = [...new Set(fullData.filter(i => i.macro === m).map(i => i.cat))];
    container.innerHTML = '';
    cats.forEach(c => {
        container.innerHTML += `<div onclick="renderLevel3('${escapeJS(m)}','${escapeJS(c)}') " class="menu-card" style="cursor:pointer;"><span style="font-weight:bold; font-size:1.1rem;">${escapeHTML(c)}</span></div>`;
    });
    navigationStack.push('page-categories');
    showPage('page-categories');
}

// LOGICA FILTRI
function toggleFilter(filterType) {
    if (activeFilters.includes(filterType)) {
        activeFilters = activeFilters.filter(f => f !== filterType);
    } else {
        activeFilters.push(filterType);
    }
    renderLevel3(currentMacro, currentCat, true);
}

function renderLevel3(m, c, isFiltering = false) {
    currentMacro = m; currentCat = c;
    if (!isFiltering) activeFilters = []; // Resetta filtri se entro nuova categoria
    
    const container = document.getElementById('page-items');
    container.innerHTML = '';
    
    // Recupera tutti i piatti della categoria
    let allCategoryItems = fullData.filter(i => i.macro === m && i.cat === c);
    
    // Crea i bottoni dei filtri in base a cosa esiste nella categoria
    if (!isFiltering) {
        document.getElementById('sub-header-title').innerText = c;
        let filtersHtml = '';
        const hasGf = allCategoryItems.some(i => isTruthy(i.gf));
        const hasVegan = allCategoryItems.some(i => isTruthy(i.vegan));
        const hasVeg = allCategoryItems.some(i => isTruthy(i.veg));
        
        if(hasGf) filtersHtml += `<button onclick="toggleFilter('gf')" id="btn-gf" class="filter-btn">Senza Glutine</button>`;
        if(hasVegan) filtersHtml += `<button onclick="toggleFilter('vegan')" id="btn-vegan" class="filter-btn">Vegano</button>`;
        if(hasVeg) filtersHtml += `<button onclick="toggleFilter('veg')" id="btn-veg" class="filter-btn">Vegetariano</button>`;
        
        document.getElementById('sub-header-filters').innerHTML = filtersHtml;
    }

    // Applica stato visuale ai bottoni
    ['gf', 'vegan', 'veg'].forEach(f => {
        const btn = document.getElementById(`btn-${f}`);
        if(btn) { activeFilters.includes(f) ? btn.classList.add('active') : btn.classList.remove('active'); }
    });

    // Filtra gli items da mostrare
    let itemsToShow = allCategoryItems;
    if (activeFilters.length > 0) {
        itemsToShow = itemsToShow.filter(i => activeFilters.every(f => isTruthy(i[f])));
    }

    if (itemsToShow.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 20px; color:#9ca3af; font-weight:bold;">Nessun piatto corrisponde ai filtri selezionati.</div>`;
    }

    itemsToShow.forEach(i => {
        let badges = '';
        if(isTruthy(i.gf)) badges += `<span class="badge badge-gf">Senza Glutine</span>`;
        if(isTruthy(i.vegan)) badges += `<span class="badge badge-vegan">Vegano</span>`;
        if(isTruthy(i.veg)) badges += `<span class="badge badge-veg">Vegetariano</span>`;
        const badgeHtml = badges ? `<div class="badge-container">${badges}</div>` : '';

        container.innerHTML += `<div class="menu-card item-card"><div style="flex-grow:1;"><strong style="font-size:18px;">${escapeHTML(i.name)}</strong><br><span style="color:#6b7280; font-size:14px; display:block; margin-top:4px;">${escapeHTML(i.desc)}</span><span style="color:#4f46e5; font-weight:bold; font-size:16px; display:block; margin-top:6px;">${escapeHTML(i.price)}</span>${badgeHtml}</div>${i.photo ? `<img src="${escapeHTML(i.photo)}" class="item-photo" style="margin-left: 10px;">` : ''}</div>`;
    });

    if(!isFiltering) {
        navigationStack.push('page-items');
        showPage('page-items');
    }
}

// --- NAVIGAZIONE PROTETTA ---
function showPage(p) {
    ['page-macro','page-categories','page-items'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });
    document.getElementById(p).classList.remove('hidden');
    
    const backBtn = document.getElementById('back-button');
    const wrapper = document.getElementById('header-content-wrapper');
    const align = getVal('Logo_Align', 'center').toLowerCase();
    const subHeader = document.getElementById('sub-header');

    if (backBtn) {
        if (p === 'page-macro') {
            backBtn.classList.remove('active');
            if(wrapper) wrapper.style.paddingLeft = '0px'; 
        } else {
            backBtn.classList.add('active');
            if(wrapper && align === 'left') wrapper.style.paddingLeft = '50px';
        }
    }

    // Il sub-header appare SOLO nel Terzo Livello (page-items)
    if (subHeader) {
        if (p === 'page-items') {
            subHeader.style.display = 'flex';
        } else {
            subHeader.style.display = 'none';
        }
    }

    updateLayout();
    window.scrollTo({top: 0, behavior: 'instant'});
}

function goBack() { 
    if(navigationStack.length > 1) { 
        navigationStack.pop(); 
        showPage(navigationStack[navigationStack.length-1]); 
    } 
}

init();
