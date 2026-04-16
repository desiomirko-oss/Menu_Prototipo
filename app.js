const VERSION = "6.0-MODULO-BACK-BTN";
console.log("Versione App: " + VERSION);

const urlParams = new URLSearchParams(window.location.search);
const SHEET_ID = urlParams.get('id'); 
let appConfig = {};
let fullData = [];
let navigationStack = ['page-macro'];

let activeFilters = []; 
let currentMacroName = '';
let currentCategoryName = '';

// --- MODULO TRADUZIONE ---
function setupAutoTranslate() {
    const baseLang = 'it'; 
    const userLang = (navigator.language || navigator.userLanguage).slice(0, 2).toLowerCase();
    if (userLang !== baseLang) {
        const style = document.createElement('style');
        style.innerHTML = `.goog-te-banner-frame.skiptranslate { display: none !important; } body { top: 0px !important; } #goog-gt-tt { display: none !important; } .goog-text-highlight { background-color: transparent !important; box-shadow: none !important; }`;
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
function escapeHTML(str) { return String(str || '').replace(/[&<>'"]/g, tag => ({'&': '&amp;','<': '&lt;','>': '&gt;',"'": '&#39;','"': '&quot;'}[tag] || tag)); }
function escapeJS(str) { return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"'); }
function cleanString(val) { return String(val || '').trim().replace(/^["']|["']$/g, '').replace(/,+$/, '').trim(); }
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
function isDataTruthy(val) { return ['TRUE', 'SI', 'SÌ', 'YES', '1', 'V', 'VERO'].includes(String(val || '').toUpperCase().trim()); }
function parseColor(colorVal, opacityVal = 1) {
    let op = parseFloat(opacityVal); if(isNaN(op)) op = 1; 
    let c = String(colorVal).trim(); if (!c) return `rgba(0,0,0,${op})`;
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

// --- CORE ---
async function init() {
    setupAutoTranslate();
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
        csv.replace(/^\ufeff/, '').split(/\r?\n/).slice(1).forEach(row => {
            const cols = safeParseCSVRow(row);
            if(cols.length >= 2) appConfig[cols[0]] = cols[1];
        });
    } catch(e) { console.error(e); }
}

function applyConfig() {
    const root = document.documentElement;

    // Modulo Header
    root.style.setProperty('--header-bg', parseColor(getVal('Header_Color', '#ffffff'), getVal('Header_Opacity', '0.95')));
    let shadow = 'none'; const intensity = getVal('Header_Shadow_Intensity', 'medium').toLowerCase();
    if(intensity === 'light') shadow = '0 2px 8px rgba(0,0,0,0.05)';
    else if(intensity === 'medium') shadow = '0 4px 15px rgba(0,0,0,0.08)';
    else if(intensity === 'strong') shadow = '0 8px 25px rgba(0,0,0,0.15)';
    root.style.setProperty('--header-shadow', shadow);

    // Modulo 4: Tasto Indietro (Back Button)
    root.style.setProperty('--back-bg', parseColor(getVal('Back_Btn_Bg', 'rgba(255, 255, 255, 0.9)')));
    root.style.setProperty('--back-color', parseColor(getVal('Back_Btn_Color', '#4f46e5')));

    // Modulo Logo
    const logoCont = document.getElementById('logo-container');
    const logoAlign = getVal('Logo_Align', 'center').toLowerCase();
    logoCont.style.justifyContent = logoAlign === 'left' ? 'flex-start' : (logoAlign === 'right' ? 'flex-end' : 'center');
    logoCont.style.marginTop = getVal('Logo_Margin_Top', '0px');
    logoCont.style.marginBottom = getVal('Logo_Margin_Bottom', '0px');
    const logoUrl = getVal('Logo_Image_URL', '');
    if (logoUrl) logoCont.innerHTML = `<img src="${escapeHTML(logoUrl)}" style="max-height:${getVal('Logo_Height', '60px')}; object-fit:contain;" onload="updateLayout()" translate="no">`;

    // Modulo Sottotitolo
    const subContainer = document.getElementById('subtitle-container');
    const subText = getVal('Subtitle_Text', '');
    if (subText !== '') {
        subContainer.style.display = 'block';
        subContainer.innerText = subText;
        subContainer.style.color = parseColor(getVal('Subtitle_Color', '#6b7280'));
        subContainer.style.fontSize = getVal('Subtitle_Size', '14px');
        subContainer.style.fontFamily = getVal('Subtitle_Font', 'sans-serif'); 
        subContainer.style.fontWeight = isDataTruthy(getVal('Subtitle_Bold', 'FALSE')) ? 'bold' : 'normal';
        subContainer.style.textAlign = getVal('Subtitle_Align', 'center').toLowerCase();
        subContainer.style.marginBottom = getVal('Subtitle_Margin_Bottom', '10px');
        updateLayout(); 
    } else {
        subContainer.style.display = 'none';
    }
}

// --- MOTORE LAYOUT (Fix Sovrapposizione) ---
function updateLayout() {
    setTimeout(() => {
        const header = document.getElementById('main-header');
        const subHeader = document.getElementById('sub-header');
        const mainContent = document.getElementById('main-content');
        const backBtn = document.getElementById('back-button');

        if (!header) return;
        const hHeight = header.offsetHeight || 100; 

        if (subHeader) subHeader.style.top = `${hHeight}px`;

        let totalH = hHeight;
        if (subHeader && subHeader.style.display !== 'none') totalH += subHeader.offsetHeight;
        if (mainContent) mainContent.style.paddingTop = `calc(${totalH}px + 20px)`;

        // RIPOSIZIONAMENTO INTELLIGENTE TASTO INDIETRO
        const pos = getVal('Back_Btn_Position', 'top').toLowerCase();
        if (pos === 'top') {
            backBtn.style.top = '25px'; 
        } else if (pos === 'center') {
            backBtn.style.top = `calc(${hHeight}px / 2 - 22px)`;
        } else if (pos === 'bottom') {
            backBtn.style.top = `calc(${hHeight}px - 55px)`;
        } else if (pos === 'outside') {
            backBtn.style.top = `calc(${hHeight}px + 15px)`;
        }
    }, 50); 
}

// --- LOGICA NAVIGAZIONE ---
function showPage(p) {
    if(p !== 'page-items') activeFilters = [];

    document.getElementById('page-macro').classList.add('hidden');
    document.getElementById('page-categories').classList.add('hidden');
    document.getElementById('page-items').classList.add('hidden');
    document.getElementById(p).classList.remove('hidden');
    
    const contentDiv = document.querySelector(`#${p}`);
    if(contentDiv) {
        contentDiv.style.animation = 'none'; contentDiv.offsetHeight; 
        contentDiv.style.animation = 'pageIn 0.3s ease-out forwards';
    }

    const backBtn = document.getElementById('back-button');
    const subHeader = document.getElementById('sub-header');
    const wrapper = document.getElementById('header-content-wrapper');
    const align = getVal('Logo_Align', 'center').toLowerCase();
    
    if(p === 'page-macro') {
        backBtn.classList.remove('active');
        if(subHeader) subHeader.style.display = 'none';
        if(wrapper) wrapper.style.paddingLeft = '0px'; 
    } else {
        backBtn.classList.add('active');
        
        // SCUDO ANTI-SOVRAPPOSIZIONE
        if(wrapper) {
            const pos = getVal('Back_Btn_Position', 'top').toLowerCase();
            // Se il logo è a sinistra e il tasto indietro è nell'header, facciamo spazio orizzontale
            wrapper.style.paddingLeft = (align === 'left' && pos !== 'outside') ? '45px' : '0px';
        }

        if(p === 'page-items') {
            if(subHeader) subHeader.style.display = 'flex'; 
        } else {
            if(subHeader) subHeader.style.display = 'none';
        }
    }
    
    updateLayout();
    window.scrollTo({top: 0, behavior: 'instant'});
}

function goBack() { 
    if(navigationStack.length > 1) {
        navigationStack.pop(); 
        const prev = navigationStack[navigationStack.length-1];
        showPage(prev);
    }
}

// --- FETCH MENU E RENDER ---
async function fetchMenu() {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=menu&t=${Date.now()}`;
    try {
        const response = await fetch(url);
        let csv = await response.text();
        csv = csv.replace(/^\ufeff/, '');
        
        fullData = [];
        const rows = csv.split(/\r?\n/);
        
        for(let i=1; i<rows.length; i++) {
            if(rows[i].trim() === '') continue;
            const c = safeParseCSVRow(rows[i]);
            if(c.length < 3 || !c[0]) continue;
            fullData.push({ macro: c[0], cat: c[1], name: c[2], desc: c[3], allerg: c[4], price: c[5], gf: c[6], vegan: c[7], veg: c[8], noalc: c[9], active: c[10] !== undefined ? c[10] : 'TRUE', photoUrl: c[11], ar: c[12] });
        }
        
        fullData = fullData.filter(i => isDataTruthy(i.active)); 
        document.getElementById('loading-screen').classList.add('hidden');
        renderLevel1();
    } catch (e) { 
        document.getElementById('loading-screen').innerHTML = "<div class='text-error pt-20'>Menu non trovato o in manutenzione.</div>"; 
    }
}

function renderLevel1() {
    const layoutContainer = document.getElementById('macro-layout-container');
    const macros = [...new Set(fullData.map(i => i.macro))];
    layoutContainer.className = `page-content macro-grid`;
    layoutContainer.innerHTML = '';
    macros.forEach(m => {
        layoutContainer.innerHTML += `<div onclick="renderLevel2('${escapeJS(m)}')" class="macro-card w-full flex items-center justify-center"><div class="macro-overlay"></div><span class="macro-text-inside">${escapeHTML(m)}</span></div>`;
    });
    showPage('page-macro');
}

function renderLevel2(mName) {
    const container = document.getElementById('page-categories');
    const cats = [...new Set(fullData.filter(i => i.macro === mName).map(i => i.cat))];
    container.innerHTML = ''; 
    cats.forEach(c => {
        container.innerHTML += `<div onclick="renderLevel3('${escapeJS(mName)}', '${escapeJS(c)}')" class="menu-card cat-card"><span style="font-weight: 800; color: #1f2937; font-size: 1.125rem; position: relative; z-index: 10;">${escapeHTML(c)}</span><svg class="icon-sm shrink-0 ml-2 relative z-10" style="color: #9ca3af" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></div>`;
    });
    navigationStack.push('page-categories');
    showPage('page-categories');
}

function toggleFilter(filterType) {
    if (activeFilters.includes(filterType)) activeFilters = [];
    else activeFilters = [filterType];
    
    document.getElementById('sub-header-filters').querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if(activeFilters.length > 0) {
            const txt = btn.textContent.toLowerCase(), f = activeFilters[0];
            if((f === 'gf' && txt.includes('glutine')) || (f === 'vegan' && txt.includes('vegano')) || (f === 'veg' && txt.includes('vegetariano')) || (f === 'noalc' && txt.includes('analcolico'))) btn.classList.add('active');
        }
    });
    renderLevel3(currentMacroName, currentCategoryName, true);
}

function renderLevel3(mName, cName, isFiltering = false) {
    currentMacroName = mName; currentCategoryName = cName;
    if (!isFiltering) {
        document.getElementById('sub-header-title').textContent = cName;
        let filterHtml = '';
        if (!mName.toLowerCase().match(/bevand|bebid|drink/)) {
            filterHtml += `<button onclick="toggleFilter('gf')" class="filter-btn">Senza Glutine</button><button onclick="toggleFilter('vegan')" class="filter-btn">Vegano</button><button onclick="toggleFilter('veg')" class="filter-btn">Vegetariano</button>`;
        } else {
            filterHtml += `<button onclick="toggleFilter('noalc')" class="filter-btn">Analcolico</button>`;
        }
        document.getElementById('sub-header-filters').innerHTML = filterHtml;
    }

    const container = document.getElementById('page-items');
    container.innerHTML = ''; 
    let items = fullData.filter(i => i.cat === cName && i.macro === mName);
    if (activeFilters.length > 0) items = items.filter(i => activeFilters.every(f => isDataTruthy(i[f])));

    if(items.length === 0) container.innerHTML = `<div class="text-center text-gray-400 py-10 font-bold">Nessun piatto trovato.</div>`;

    items.forEach(i => {
        let badges = '';
        if(isDataTruthy(i.gf)) badges += `<span class="badge badge-gf">Senza Glutine</span>`;
        if(isDataTruthy(i.vegan)) badges += `<span class="badge badge-vegan">Vegano</span>`;
        if(isDataTruthy(i.veg)) badges += `<span class="badge badge-veg">Vegetariano</span>`;
        
        let allerg = i.allerg && i.allerg !== '-' ? `<span class="item-allerg">Allergeni: ${escapeHTML(i.allerg)}</span>` : '';
        let desc = i.desc && i.desc !== '-' ? `<p class="item-desc">${escapeHTML(i.desc)}</p>` : '';
        let ar = i.ar ? `<a href="${escapeHTML(i.ar)}" target="_blank" rel="noopener noreferrer" class="ar-badge"><svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg> VEDI AR</a>` : '';

        if (i.photoUrl) {
            container.innerHTML += `<div class="menu-card item-card"><div class="flex-col flex-grow"><div><h3 class="item-name">${escapeHTML(i.name)}</h3>${desc}${allerg}<div class="badge-container">${badges}</div>${ar}</div><div style="margin-top: auto; padding-top: 12px;"><span class="item-price" translate="no">${escapeHTML(i.price)}</span></div></div><img src="${escapeHTML(i.photoUrl)}" alt="${escapeHTML(i.name)}" onerror="this.style.display='none'" class="item-photo"></div>`;
        } else {
            container.innerHTML += `<div class="menu-card item-card flex-col" style="justify-content: center;"><div class="flex justify-between" style="align-items: flex-start;"><h3 class="item-name flex-grow">${escapeHTML(i.name)}</h3><div class="shrink-0" style="text-align: right; padding-left: 8px;"><span class="item-price" translate="no">${escapeHTML(i.price)}</span></div></div>${desc}${allerg}<div class="badge-container">${badges}</div>${ar}</div>`;
        }
    });

    if (!isFiltering) {
        navigationStack.push('page-items');
        showPage('page-items');
    }
}

init();
