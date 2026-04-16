const VERSION = "8.0-FINAL-VAULT";
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
        const keys = Object.keys(appConfig);
        if (keys.length > 0 && keys[0].includes("Logo_Image_URL") && keys[0].length > 30) {
            document.body.innerHTML = `<div style="padding:40px; text-align:center;"><h2 style="color:red;">🚨 Errore Google Sheets! 🚨</h2><p>Dati schiacciati in una sola cella.</p></div>`;
            throw new Error("Dati CSV compressi");
        }
    } catch(e) { console.error(e); }
}

function applyConfig() {
    const root = document.documentElement;

    // --- MODULO 7: TASTO INDIETRO E OMBRA ---
    root.style.setProperty('--back-bg', parseColor(getVal('Back_Btn_Bg', '#111827')));
    root.style.setProperty('--back-color', parseColor(getVal('Back_Btn_Color', '#ffffff')));
    
    let bShadow = '0 4px 6px rgba(0,0,0,0.1)';
    const bInt = getVal('Back_Btn_Shadow_Intensity', 'medium').toLowerCase();
    if(bInt === 'none') bShadow = 'none';
    else if(bInt === 'light') bShadow = '0 2px 4px rgba(0,0,0,0.05)';
    else if(bInt === 'strong') bShadow = '0 10px 15px rgba(0,0,0,0.3)';
    root.style.setProperty('--back-shadow', bShadow);

    const backBtn = document.getElementById('back-button');
    if (backBtn) {
        const svg = backBtn.querySelector('svg');
        if (svg) { svg.style.stroke = 'currentColor'; svg.style.fill = 'none'; }
    }

    // --- MACRO ---
    const layout = getVal('Macro_Layout', 'grid').toLowerCase();
    root.style.setProperty('--macro-cols', layout === 'list' ? '1' : '2');
    root.style.setProperty('--macro-height', getVal('Macro_Height', '180px'));
    let mShadow = '0 4px 6px rgba(0,0,0,0.1)';
    const mInt = getVal('Macro_Shadow_Intensity', 'medium').toLowerCase();
    if(mInt === 'none') mShadow = 'none';
    else if(mInt === 'light') mShadow = '0 2px 4px rgba(0,0,0,0.05)';
    else if(mInt === 'strong') mShadow = '0 10px 15px rgba(0,0,0,0.2)';
    root.style.setProperty('--macro-shadow', mShadow);
    root.style.setProperty('--macro-text-color', parseColor(getVal('Macro_Text_Color', '#ffffff')));
    root.style.setProperty('--macro-text-font', getVal('Macro_Text_Font', 'sans-serif'));
    root.style.setProperty('--macro-text-weight', isTruthy(getVal('Macro_Text_Bold', 'TRUE')) ? 'bold' : 'normal');
    root.style.setProperty('--macro-text-shadow', isTruthy(getVal('Macro_Text_Shadow', 'TRUE')) ? '0px 2px 6px rgba(0,0,0,0.8)' : 'none');
    const vPos = getVal('Macro_Text_VAlign', 'center').toLowerCase();
    root.style.setProperty('--macro-align-v', vPos === 'top' ? 'flex-start' : (vPos === 'bottom' ? 'flex-end' : 'center'));
    const hPos = getVal('Macro_Text_HAlign', 'center').toLowerCase();
    root.style.setProperty('--macro-align-h', hPos === 'left' ? 'flex-start' : (hPos === 'right' ? 'flex-end' : 'center'));

    // --- SFONDO ---
    const bgType = getVal('App_Bg_Type', 'color').toLowerCase();
    if (bgType === 'image') {
        const bgUrl = getVal('App_Bg_Image_URL', '');
        if (bgUrl) {
            root.style.setProperty('--app-bg-image', `url('${escapeHTML(bgUrl)}')`);
            root.style.setProperty('--app-bg-size', getVal('App_Bg_Image_Size', 'cover'));
            root.style.setProperty('--app-bg-position', getVal('App_Bg_Image_Position', 'center'));
            root.style.setProperty('--app-bg-color', parseColor(getVal('App_Bg_Color', '#f9fafb'))); 
        } else {
            root.style.setProperty('--app-bg-image', 'none');
            root.style.setProperty('--app-bg-color', parseColor(getVal('App_Bg_Color', '#f9fafb')));
        }
    } else {
        root.style.setProperty('--app-bg-image', 'none');
        root.style.setProperty('--app-bg-color', parseColor(getVal('App_Bg_Color', '#f9fafb')));
    }

    // --- HEADER E COLORI ---
    const isTransparent = isTruthy(getVal('Header_Transparent', 'FALSE'));
    const headerOpacity = isTransparent ? '0.5' : '1';
    root.style.setProperty('--header-bg', parseColor(getVal('Header_Color', '#ffffff'), headerOpacity));
    let shadow = 'none'; 
    const intensity = getVal('Header_Shadow_Intensity', 'medium').toLowerCase();
    if(intensity === 'light') shadow = '0 2px 8px rgba(0,0,0,0.05)';
    else if(intensity === 'medium') shadow = '0 4px 15px rgba(0,0,0,0.08)';
    else if(intensity === 'strong') shadow = '0 8px 25px rgba(0,0,0,0.15)';
    root.style.setProperty('--header-shadow', shadow);

    // --- LOGO ---
    const logoCont = document.getElementById('logo-container');
    const logoUrl = getVal('Logo_Image_URL', '');
    const align = getVal('Logo_Align', 'center').toLowerCase();
    logoCont.style.justifyContent = align === 'left' ? 'flex-start' : (align === 'right' ? 'flex-end' : 'center');
    logoCont.style.marginTop = getVal('Logo_Margin_Top', '0px');
    logoCont.style.marginBottom = '0px'; 
    
    if (logoUrl) {
        logoCont.innerHTML = `<img src="${escapeHTML(logoUrl)}" id="app-logo" style="max-height:${escapeHTML(getVal('Logo_Height', '80px'))}; object-fit:contain;" translate="no">`;
        document.getElementById('app-logo').onload = updateLayout;
    } else {
        logoCont.innerHTML = '';
        updateLayout();
    }

    // --- SOTTOTITOLO ---
    const sub = document.getElementById('subtitle-container');
    const subText = getVal('Subtitle_Text', '');
    if (subText !== '') {
        sub.style.display = 'block';
        sub.innerText = subText;
        sub.style.color = parseColor(getVal('Subtitle_Color', '#6b7280'));
        sub.style.fontSize = getVal('Subtitle_Size', '14px');
        sub.style.fontFamily = getVal('Subtitle_Font', 'sans-serif');
        sub.style.fontWeight = isTruthy(getVal('Subtitle_Bold', 'FALSE')) ? 'bold' : 'normal';
        sub.style.textAlign = getVal('Subtitle_Align', 'center').toLowerCase();
        sub.style.marginTop = getVal('Subtitle_Margin_Top', '5px');
        sub.style.marginBottom = '0px';
    } else {
        sub.style.display = 'none';
    }
}

// MOTORE MATEMATICO
function updateLayout() {
    setTimeout(() => {
        const header = document.getElementById('main-header');
        const main = document.getElementById('main-content');
        const backBtn = document.getElementById('back-button');
        
        if (header) {
            const hHeight = header.offsetHeight;
            if (main) main.style.paddingTop = `calc(${hHeight}px + 20px)`;
            
            if (backBtn) {
                const pos = getVal('Back_Btn_Position', 'center').toLowerCase();
                if (pos === 'bottom') {
                    backBtn.style.top = (hHeight - 34 - 10) + "px"; 
                } else {
                    backBtn.style.top = (hHeight / 2 - 17) + "px"; 
                }
            }
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

    if (backBtn) {
        if (p === 'page-macro') {
            backBtn.classList.remove('active');
            if(wrapper) wrapper.style.paddingLeft = '0px'; 
        } else {
            backBtn.classList.add('active');
            if(wrapper && align === 'left') {
                wrapper.style.paddingLeft = '50px';
            }
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
