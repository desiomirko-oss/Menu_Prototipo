const VERSION = "3.0-MODULO-LOGO";
console.log("Menu App Version: " + VERSION);

const urlParams = new URLSearchParams(window.location.search);
const SHEET_ID = urlParams.get('id'); 
let appConfig = {};
let fullData = [];
let navigationStack = ['page-macro'];

let activeFilters = []; 
let currentMacroName = '';
let currentCategoryName = '';

// --- MODULO TRADUZIONE AUTOMATICA INVISIBILE ---
function setupAutoTranslate() {
    const baseLang = 'it'; 
    const userLang = (navigator.language || navigator.userLanguage).slice(0, 2).toLowerCase();
    
    if (userLang !== baseLang) {
        console.log(`Lingua rilevata: ${userLang}. Avvio traduzione automatica...`);
        const style = document.createElement('style');
        style.innerHTML = `
            .goog-te-banner-frame.skiptranslate { display: none !important; } 
            body { top: 0px !important; }
            #goog-gt-tt { display: none !important; }
            .goog-text-highlight { background-color: transparent !important; box-shadow: none !important; }
        `;
        document.head.appendChild(style);

        const cookieString = `googtrans=/${baseLang}/${userLang}`;
        document.cookie = `${cookieString}; path=/`;
        
        const widgetDiv = document.createElement('div');
        widgetDiv.id = 'google_translate_element';
        widgetDiv.style.display = 'none';
        document.body.appendChild(widgetDiv);

        window.googleTranslateElementInit = function() {
            new google.translate.TranslateElement({
                pageLanguage: baseLang,
                autoDisplay: false
            }, 'google_translate_element');
        };
        
        const script = document.createElement('script');
        script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
        document.body.appendChild(script);
    }
}

// --- UTILITIES, SICUREZZA E TAGLIOLA VIRGOLE ---
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
}

function escapeJS(str) {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function cleanString(val) {
    if (val === undefined || val === null || val === '') return '';
    // Tagliola: distrugge le virgole fantasma di Google Sheets
    let cleaned = String(val).trim().replace(/^["']|["']$/g, '').replace(/,+$/, '').trim();
    if (cleaned.toLowerCase() === 'undefined' || cleaned === '-') return '';
    return cleaned;
}

function safeParseCSVRow(str) {
    let arr = []; let quote = false; let cell = '';
    for (let i = 0; i < str.length; i++) {
        let c = str[i];
        if (c === '"' && str[i+1] === '"') { cell += '"'; i++; } 
        else if (c === '"') { quote = !quote; }
        else if (c === ',' && !quote) { arr.push(cell); cell = ''; }
        else { cell += c; }
    }
    arr.push(cell);
    return arr.map(x => cleanString(x));
}

function getVal(key, def) {
    const searchKey = key.toLowerCase().trim();
    for (let k in appConfig) {
        if (k.toLowerCase().trim() === searchKey) {
            let val = appConfig[k];
            if (val === '' || val === undefined || val === null || val === '-') return def;
            return val;
        }
    }
    return def;
}

function isDataTruthy(val) {
    let v = String(val || '').toUpperCase().trim();
    return ['TRUE', 'SI', 'SÌ', 'YES', '1', 'V', 'VERO'].includes(v);
}

// --- INIT APP ---
async function init() {
    setupAutoTranslate();

    if (!SHEET_ID) {
        document.getElementById('loading-screen').innerHTML = "<div class='text-error pt-20'>ID Cliente Mancante</div>";
        return;
    }
    
    await fetchConfig(); // Ora legge il Config per il Logo
    applyConfig();       // Applica il Logo
    await fetchMenu();
}

// --- FETCH CONFIG E CABLAGGIO ---
async function fetchConfig() {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=config&t=${Date.now()}`;
    try {
        const response = await fetch(url);
        if(!response.ok) throw new Error("Network Error");
        let csv = await response.text();
        csv = csv.replace(/^\ufeff/, ''); // Pulizia BOM
        
        const rows = csv.split(/\r?\n/);
        rows.slice(1).forEach(row => {
            if(row.trim() === '') return;
            const cols = safeParseCSVRow(row);
            if(cols.length >= 2) {
                let key = cols[0];
                let val = cols[1];
                if(key) appConfig[key] = val;
            }
        });
        console.log("Config Caricato:", appConfig);
    } catch(e) { console.error("Errore Config:", e); }
}

function applyConfig() {
    // MODULO 1: CABLAGGIO LOGO IMMAGINE
    const logoCont = document.getElementById('logo-container');
    const logoUrl = getVal('Logo_Image_URL', '');
    const align = getVal('Logo_Align', 'center').toLowerCase();
    const height = getVal('Logo_Height', '60px');
    const mt = getVal('Logo_Margin_Top', '0px');
    const mb = getVal('Logo_Margin_Bottom', '0px');

    // Applicazione allineamenti e margini
    logoCont.style.justifyContent = align === 'left' ? 'flex-start' : (align === 'right' ? 'flex-end' : 'center');
    logoCont.style.marginTop = mt;
    logoCont.style.marginBottom = mb;
    
    // Iniezione Immagine
    if (logoUrl !== '') {
        // L'evento onload attiva updateLayout() per espandere l'header se il logo è grande
        logoCont.innerHTML = `<img src="${escapeHTML(logoUrl)}" style="max-height:${escapeHTML(height)}; object-fit:contain;" alt="Logo Menu" onload="updateLayout()" translate="no">`;
    } else {
        logoCont.innerHTML = ''; // Se la cella è vuota, l'header rimane vuoto (nessun testo di emergenza)
    }

    // Altri elementi dell'header tenuti spenti e blindati per ora
    const subContainer = document.getElementById('subtitle-container');
    const lvlInside = document.getElementById('level-title-inside');
    const lvlOutside = document.getElementById('level-title-outside');
    if(subContainer) subContainer.style.display = 'none';
    if(lvlInside) lvlInside.style.display = 'none';
    if(lvlOutside) lvlOutside.style.display = 'none';
}

// --- MOTORE LAYOUT ---
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
        if (subHeader && !subHeader.classList.contains('hidden') && subHeader.style.display !== 'none') {
            totalH += subHeader.offsetHeight;
        }
        if (mainContent) mainContent.style.paddingTop = `calc(${totalH}px + 20px)`;

        backBtn.style.top = `calc(${hHeight}px / 2 - 22px)`;
    }, 50); 
}

// --- FETCH MENU E RENDER ---
async function fetchMenu() {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=menu&t=${Date.now()}`;
    try {
        const response = await fetch(url);
        if(!response.ok) throw new Error("Network Error");
        let csv = await response.text();
        csv = csv.replace(/^\ufeff/, '');
        
        fullData = [];
        const rows = csv.split(/\r?\n/);
        
        for(let i=1; i<rows.length; i++) {
            if(rows[i].trim() === '') continue;
            const c = safeParseCSVRow(rows[i]);
            if(c.length < 3 || !c[0]) continue;
            
            fullData.push({
                macro: c[0], cat: c[1], name: c[2], 
                desc: c[3], allerg: c[4], price: c[5], 
                gf: c[6], vegan: c[7], veg: c[8], 
                noalc: c[9], active: c[10] !== undefined ? c[10] : 'TRUE', 
                photoUrl: c[11], ar: c[12] 
            });
        }
        
        fullData = fullData.filter(i => isDataTruthy(i.active)); 
        document.getElementById('loading-screen').classList.add('hidden');
        renderLevel1();
    } catch (e) { 
        console.error(e);
        const lScreen = document.getElementById('loading-screen');
        lScreen.innerHTML = "<div class='text-error pt-20'>Menu non trovato o in manutenzione.</div>"; 
        lScreen.classList.remove('hidden');
    }
}

function renderLevel1() {
    const layoutContainer = document.getElementById('macro-layout-container');
    const macros = [...new Set(fullData.map(i => i.macro))];
    
    layoutContainer.className = `page-content macro-grid`;
    layoutContainer.innerHTML = '';

    macros.forEach(m => {
        const safeName = escapeHTML(m);
        const argName = escapeJS(m); 
        
        const html = `<div onclick="renderLevel2('${argName}')" class="macro-card w-full flex items-center justify-center">
            <div class="macro-overlay"></div>
            <span class="macro-text-inside">${safeName}</span>
        </div>`;
        layoutContainer.innerHTML += html;
    });
    showPage('page-macro');
}

function renderLevel2(mName) {
    const container = document.getElementById('page-categories');
    const cats = [...new Set(fullData.filter(i => i.macro === mName).map(i => i.cat))];
    
    container.innerHTML = ''; 

    cats.forEach(c => {
        const safeCat = escapeHTML(c);
        const argMacro = escapeJS(mName);
        const argCat = escapeJS(c);
        
        const textStyle = 'font-weight: 800; color: #1f2937; font-size: 1.125rem; position: relative; z-index: 10;';

        container.innerHTML += `
            <div onclick="renderLevel3('${argMacro}', '${argCat}')" class="menu-card cat-card">
                <span style="${textStyle}">${safeCat}</span>
                <svg class="icon-sm shrink-0 ml-2 relative z-10" style="color: #9ca3af" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </div>`;
    });
    navigationStack.push('page-categories');
    showPage('page-categories', mName);
}

function toggleFilter(filterType) {
    if (activeFilters.includes(filterType)) activeFilters = [];
    else activeFilters = [filterType];
    
    const btns = document.getElementById('sub-header-filters').querySelectorAll('.filter-btn');
    btns.forEach(btn => {
        btn.classList.remove('active');
        if(activeFilters.length > 0) {
            const f = activeFilters[0];
            const txt = btn.textContent.toLowerCase();
            const isMatch = (f === 'gf' && txt.includes('glutine')) || 
                            (f === 'vegan' && txt.includes('vegano')) || 
                            (f === 'veg' && txt.includes('vegetariano')) || 
                            (f === 'noalc' && txt.includes('analcolico'));
            if(isMatch) btn.classList.add('active');
        }
    });
    renderLevel3(currentMacroName, currentCategoryName, true);
}

function renderLevel3(mName, cName, isFiltering = false) {
    currentMacroName = mName; currentCategoryName = cName;
    
    if (!isFiltering) {
        document.getElementById('sub-header-title').textContent = cName;
        const filterContainer = document.getElementById('sub-header-filters');
        
        const isDrinks = mName.toLowerCase().match(/bevand|bebid|drink/);
        let filterHtml = '';
        if (!isDrinks) {
            filterHtml += `<button onclick="toggleFilter('gf')" class="filter-btn">Senza Glutine</button>`;
            filterHtml += `<button onclick="toggleFilter('vegan')" class="filter-btn">Vegano</button>`;
            filterHtml += `<button onclick="toggleFilter('veg')" class="filter-btn">Vegetariano</button>`;
        } else {
            filterHtml += `<button onclick="toggleFilter('noalc')" class="filter-btn">Analcolico</button>`;
        }
        filterContainer.innerHTML = filterHtml;
    }

    const container = document.getElementById('page-items');
    container.innerHTML = ''; 
    
    let items = fullData.filter(i => i.cat === cName && i.macro === mName);
    
    if (activeFilters.length > 0) {
        items = items.filter(i => {
            return activeFilters.every(f => {
                if(f === 'gf') return isDataTruthy(i.gf);
                if(f === 'vegan') return isDataTruthy(i.vegan);
                if(f === 'veg') return isDataTruthy(i.veg);
                if(f === 'noalc') return isDataTruthy(i.noalc);
                return true;
            });
        });
    }

    if(items.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-400 py-10 font-bold">Nessun piatto trovato.</div>`;
    }

    items.forEach(i => {
        const safeName = escapeHTML(i.name);
        const safeDesc = escapeHTML(i.desc);
        const safeAllerg = escapeHTML(i.allerg);
        const safePrice = escapeHTML(i.price);
        const safeAr = escapeHTML(i.ar);
        const safePhoto = escapeHTML(i.photoUrl);

        let badges = '';
        if(isDataTruthy(i.gf)) badges += `<span class="badge badge-gf">Senza Glutine</span>`;
        if(isDataTruthy(i.vegan)) badges += `<span class="badge badge-vegan">Vegano</span>`;
        if(isDataTruthy(i.veg)) badges += `<span class="badge badge-veg">Vegetariano</span>`;
        
        let allergensHTML = safeAllerg && safeAllerg !== '-' ? `<span class="item-allerg">Allergeni: ${safeAllerg}</span>` : '';
        let descHTML = safeDesc && safeDesc !== '-' ? `<p class="item-desc">${safeDesc}</p>` : '';
        let priceHTML = `<span class="item-price" translate="no">${safePrice}</span>`;

        let arHTML = '';
        if (safeAr) {
            arHTML = `<a href="${safeAr}" target="_blank" rel="noopener noreferrer" class="ar-badge"><svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg> VEDI AR</a>`;
        }

        if (safePhoto !== '') {
            container.innerHTML += `
                <div class="menu-card item-card">
                    <div class="flex-col flex-grow">
                        <div>
                            <h3 class="item-name">${safeName}</h3>
                            ${descHTML}
                            ${allergensHTML}
                            <div class="badge-container">${badges}</div>
                            ${arHTML}
                        </div>
                        <div style="margin-top: auto; padding-top: 12px;">${priceHTML}</div>
                    </div>
                    <img src="${safePhoto}" alt="${safeName}" onerror="this.style.display='none'" class="item-photo">
                </div>`;
        } else {
            container.innerHTML += `
                <div class="menu-card item-card flex-col" style="display: flex; flex-direction: column; justify-content: center;">
                    <div class="flex justify-between" style="align-items: flex-start;">
                        <h3 class="item-name flex-grow">${safeName}</h3>
                        <div class="shrink-0" style="text-align: right; padding-left: 8px;">${priceHTML}</div>
                    </div>
                    ${descHTML}
                    ${allergensHTML}
                    <div class="badge-container">${badges}</div>
                    ${arHTML}
                </div>`;
        }
    });

    if (!isFiltering) {
        navigationStack.push('page-items');
        showPage('page-items');
    }
}

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
    
    if(p === 'page-macro') {
        backBtn.classList.remove('active');
        if(subHeader) subHeader.style.display = 'none';
    } else {
        backBtn.classList.add('active');
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

init();
