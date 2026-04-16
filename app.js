const VERSION = "1.0-REBOOT-LOGO";
console.log("App Version: " + VERSION);

const urlParams = new URLSearchParams(window.location.search);
const SHEET_ID = urlParams.get('id'); 
let appConfig = {};
let fullData = [];
let navigationStack = ['page-macro'];

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

// --- INIT ---
async function init() {
    if (!SHEET_ID) return;
    await fetchConfig(); 
    applyConfig();       
    await fetchMenu();
}

// --- FETCH CONFIG (Modulo 1) ---
async function fetchConfig() {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=config&t=${Date.now()}`;
    try {
        const response = await fetch(url);
        let csv = await response.text();
        
        csv.replace(/^\ufeff/, '').split(/\r?\n/).forEach(row => {
            if(!row.trim()) return;
            const cols = safeParseCSVRow(row);
            if(cols.length >= 2) appConfig[cols[0]] = cols[1];
        });
        console.log("Config Caricato:", appConfig);
    } catch(e) { console.error("Errore Config:", e); }
}

function applyConfig() {
    const logoCont = document.getElementById('logo-container');
    const logoUrl = getVal('Logo_Image_URL', '');
    const align = getVal('Logo_Align', 'center').toLowerCase();
    
    logoCont.style.justifyContent = align === 'left' ? 'flex-start' : (align === 'right' ? 'flex-end' : 'center');
    logoCont.style.marginTop = getVal('Logo_Margin_Top', '10px');
    logoCont.style.marginBottom = getVal('Logo_Margin_Bottom', '10px');
    
    if (logoUrl) {
        logoCont.innerHTML = `<img src="${escapeHTML(logoUrl)}" id="app-logo" style="max-height:${escapeHTML(getVal('Logo_Height', '80px'))}; object-fit:contain;" translate="no">`;
        // Aspettiamo che il logo sia visibile prima di spostare i piatti giù
        document.getElementById('app-logo').onload = updateLayout;
    } else {
        logoCont.innerHTML = '';
        updateLayout();
    }
}

// Calcola lo spazio esatto sotto l'header
function updateLayout() {
    setTimeout(() => {
        const header = document.getElementById('main-header');
        const main = document.getElementById('main-content');
        if (header && main) {
            main.style.paddingTop = `calc(${header.offsetHeight}px + 20px)`;
        }
    }, 50);
}

// --- FETCH MENU E RENDERING (Per far funzionare l'app) ---
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
        fullData = fullData.filter(i => ['TRUE','SI','SÌ','YES','1','V','VERO'].includes(String(i.active).toUpperCase().trim()));
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

// Il tasto indietro per ora è disattivato visivamente, ma la funzione c'è
function goBack() { if(navigationStack.length > 1) { navigationStack.pop(); showPage(navigationStack[navigationStack.length-1]); } }

init();
