const VERSION = "2.1-HEADER-TRASPARENZA";
console.log("App Version: " + VERSION);

const urlParams = new URLSearchParams(window.location.search);
const SHEET_ID = urlParams.get('id'); 
let appConfig = {};
let fullData = [];
let navigationStack = ['page-macro'];

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

// --- UTILITIES BLINDATE ---
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
        csv.replace(/^\ufeff/, '').split(/\r?\n/).forEach(row => {
            if(!row.trim()) return;
            const cols = safeParseCSVRow(row);
            if(cols.length >= 2 && cols[0].toLowerCase() !== 'property') appConfig[cols[0]] = cols[1];
        });
        
        // Allarme Salva-Vita Google Sheets
        const keys = Object.keys(appConfig);
        if (keys.length > 0 && keys[0].includes("Logo_Image_URL") && keys[0].length > 30) {
            document.body.innerHTML = `<div style="padding:40px; text-align:center;"><h2 style="color:red;">🚨 Errore Google Sheets! 🚨</h2><p>Dati schiacciati in una sola cella. Usa 'Dividi testo in colonne'.</p></div>`;
            throw new Error("Dati CSV compressi");
        }
        console.log("Config Caricato:", appConfig);
    } catch(e) { console.error(e); }
}

function applyConfig() {
    const root = document.documentElement;

    // --- MODULO 2: HEADER E COLORI (Fix Trasparenza) ---
    // Se Header_Transparent è VERO, opacità 0.5. Altrimenti 1.
    const isTransparent = isTruthy(getVal('Header_Transparent', 'FALSE'));
    const headerOpacity = isTransparent ? '0.5' : '1';
    
    root.style.setProperty('--header-bg', parseColor(getVal('Header_Color', '#ffffff'), headerOpacity));
    
    let shadow = 'none'; 
    const intensity = getVal('Header_Shadow_Intensity', 'medium').toLowerCase();
    if(intensity === 'light') shadow = '0 2px 8px rgba(0,0,0,0.05)';
    else if(intensity === 'medium') shadow = '0 4px 15px rgba(0,0,0,0.08)';
    else if(intensity === 'strong') shadow = '0 8px 25px rgba(0,0,0,0.15)';
    root.style.setProperty('--header-shadow', shadow);

    // Tasto Indietro (Nascosto ma cablato in sicurezza)
    root.style.setProperty('--back-bg', parseColor(getVal('Back_Btn_Bg', '#111827')));
    root.style.setProperty('--back-color', parseColor(getVal('Back_Btn_Color', '#ffffff')));

    // --- MODULO 1: LOGO ---
    const logoCont = document.getElementById('logo-container');
    const logoUrl = getVal('Logo_Image_URL', '');
    const align = getVal('Logo_Align', 'center').toLowerCase();
    
    logoCont.style.justifyContent = align === 'left' ? 'flex-start' : (align === 'right' ? 'flex-end' : 'center');
    logoCont.style.marginTop = getVal('Logo_Margin_Top', '10px');
    logoCont.style.marginBottom = getVal('Logo_Margin_Bottom', '10px');
    
    if (logoUrl) {
        logoCont.innerHTML = `<img src="${escapeHTML(logoUrl)}" id="app-logo" style="max-height:${escapeHTML(getVal('Logo_Height', '80px'))}; object-fit:contain;" translate="no">`;
        document.getElementById('app-logo').onload = updateLayout;
    } else {
        logoCont.innerHTML = '';
        updateLayout();
    }
}

function updateLayout() {
    setTimeout(() => {
        const header = document.getElementById('main-header');
        const main = document.getElementById('main-content');
        if (header && main) {
            main.style.paddingTop = `calc(${header.offsetHeight}px + 20px)`;
        }
    }, 50);
}

// --- MENU RENDERING ---
async function fetchMenu() {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=menu&t=${Date.now()}`;
    try {
        const res = await fetch(url);
        const csv = await res.text();
        fullData = [];
        const rows = csv.split(/\r?\n/);
        for(let i=1; i<rows.length; i++){
            const c = safeParseCSVRow(rows[i]);
            if(c.length >= 3 && c[0]) fullData.push({ macro: c[0], cat: c[1], name: c[2], desc: c[3], price: c[5], active: c[10]||'TRUE', photo: c[11] });
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
        container.innerHTML += `<div onclick="renderLevel2('${escapeJS(m)}')" class="macro-card"><div class="macro-overlay"></div><span class="macro-text-inside">${escapeHTML(m)}</span></div>`;
    });
    showPage('page-macro');
}

function renderLevel2(m) {
    const container = document.getElementById('page-categories');
    const cats = [...new Set(fullData.filter(i => i.macro === m).map(i => i.cat))];
    container.innerHTML = '';
    cats.forEach(c => {
        container.innerHTML += `<div onclick="renderLevel3('${escapeJS(m)}','${escapeJS(c)}')" class="menu-card" style="cursor:pointer;"><span style="font-weight:bold; font-size:1.1rem;">${escapeHTML(c)}</span></div>`;
    });
    navigationStack.push('page-categories');
    showPage('page-categories');
}

function renderLevel3(m, c) {
    const container = document.getElementById('page-items');
    container.innerHTML = '';
    const items = fullData.filter(i => i.macro === m && i.cat === c);
    items.forEach(i => {
        container.innerHTML += `<div class="menu-card item-card"><div><strong style="font-size:18px;">${escapeHTML(i.name)}</strong><br><span style="color:#6b7280; font-size:14px;">${escapeHTML(i.desc)}</span><br><span style="color:#4f46e5; font-weight:bold; font-size:16px;">${escapeHTML(i.price)}</span></div>${i.photo ? `<img src="${escapeHTML(i.photo)}" class="item-photo">` : ''}</div>`;
    });
    navigationStack.push('page-items');
    showPage('page-items');
}

function showPage(p) {
    ['page-macro','page-categories','page-items'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });
    document.getElementById(p).classList.remove('hidden');
    updateLayout();
    window.scrollTo({top: 0, behavior: 'instant'});
}

function goBack() { if(navigationStack.length > 1) { navigationStack.pop(); showPage(navigationStack[navigationStack.length-1]); } }

init();
