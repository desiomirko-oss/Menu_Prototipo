const VERSION = "12.3-TRANSLATING-FILTERS";
console.log("App Version: " + VERSION);

const urlParams = new URLSearchParams(window.location.search);
const SHEET_ID = urlParams.get('id'); 
let appConfig = {};
let fullData = [];
let navigationStack = [];
let currentMacro = '';
let currentCat = '';
let activeFilters = [];

// ==========================================
// 🆕 MOTORE AR INVISIBILE A LANCIO DIRETTO
// ==========================================
const scriptAR = document.createElement('script');
scriptAR.type = 'module';
scriptAR.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
document.head.appendChild(scriptAR);

const hiddenViewer = document.createElement('model-viewer');
hiddenViewer.id = 'ar-launcher';
hiddenViewer.setAttribute('ar', '');
hiddenViewer.setAttribute('ar-modes', 'webxr scene-viewer quick-look');
hiddenViewer.style.display = 'none'; 
document.body.appendChild(hiddenViewer);

window.launchDirectAR = function(glbPath) {
    const viewer = document.getElementById('ar-launcher');
    viewer.src = glbPath;
    viewer.setAttribute('ios-src', glbPath.replace('.glb', '.usdz')); 
    setTimeout(() => { viewer.activateAR(); }, 50); 
};
// ==========================================

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

// 🆕 FUNZIONE LABELS FILTRI (Prende i nomi da Config per tradurli bene)
function getFilterLabels() {
    return {
        gf: getVal('Filter_Name_GF', 'Senza Glutine'),
        vegan: getVal('Filter_Name_Vegan', 'Vegano'),
        veg: getVal('Filter_Name_Veg', 'Vegetariano'),
        noalc: getVal('Filter_Name_NoAlc', 'Analcolico'),
        bio: getVal('Filter_Name_Bio', 'Bio')
    };
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

// --- TRADUTTORE INTELLIGENTE ---
function setupAutoTranslate() {
    const sourceLang = getVal('Lang_Source', 'es').toLowerCase().trim(); 
    const targetLangsStr = getVal('Lang_Targets', 'ALL').toUpperCase().trim(); 
    
    let userLang = navigator.language || navigator.userLanguage;
    userLang = userLang.slice(0, 2).toLowerCase();

    if (userLang === sourceLang) return; 

    if (targetLangsStr !== 'ALL') {
        const allowedLangs = targetLangsStr.toLowerCase().split(',').map(l => l.trim());
        if (!allowedLangs.includes(userLang)) return;
    }

    const antiBannerStyle = document.createElement('style');
    antiBannerStyle.innerHTML = `
        iframe.goog-te-banner-frame, .goog-te-banner-frame { display: none !important; visibility: hidden !important; height: 0 !important; width: 0 !important; border: none !important; }
        body { top: 0px !important; position: static !important; }
        .skiptranslate { display: none !important; }
        #google_translate_element { display: none !important; height: 0 !important; }
        .goog-tooltip { display: none !important; }
        .goog-text-highlight { background-color: transparent !important; border: none !important; box-shadow: none !important; }
    `;
    document.head.appendChild(antiBannerStyle);

    document.cookie = `googtrans=/${sourceLang}/${userLang}; path=/`;
    document.cookie = `googtrans=/${sourceLang}/${userLang}; domain=${window.location.hostname}; path=/`;

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

    const killerInterval = setInterval(() => {
        const frames = document.querySelectorAll('.goog-te-banner-frame, iframe.goog-te-banner-frame');
        frames.forEach(f => { f.style.display = 'none'; f.style.height = '0px'; });
        if (document.body.style.top !== '0px' && document.body.style.top !== '') document.body.style.top = '0px';
    }, 50);
    setTimeout(() => clearInterval(killerInterval), 6000);
}

function applyConfig() {
    const root = document.documentElement;
    
    // Controllo dinamico testo caricamento
    const loadingText = document.getElementById('loading-text');
    if (loadingText) {
        loadingText.innerText = getVal('Testo_Caricamento', 'Caricamento...');
    }

    const bgType = getVal('App_Bg_Type', 'color').toLowerCase().trim();
    const bgImgUrl = getVal('App_Bg_Image_URL', '');
    if (bgType === 'image' && bgImgUrl !== '') {
        root.style.setProperty('--app-bg-image', `url('${bgImgUrl}')`);
        root.style.setProperty('--app-bg-size', getVal('App_Bg_Image_Size', 'cover'));
        root.style.setProperty('--app-bg-position', getVal('App_Bg_Image_Position', 'center'));
    } else {
        root.style.setProperty('--app-bg-image', 'none');
    }
    root.style.setProperty('--app-bg-color', parseColor(getVal('App_Bg_Color', '#f9fafb')));

    root.style.setProperty('--back-bg', parseColor(getVal('Back_Btn_Bg', '#111827')));
    root.style.setProperty('--back-color', parseColor(getVal('Back_Btn_Color', '#ffffff')));
    root.style.setProperty('--back-shadow', getVal('Back_Btn_Shadow_Intensity', 'none') !== 'none' ? '0 4px 6px rgba(0,0,0,0.1)' : 'none');
    
    const defaultFilterColor = getVal('Subtitle_Color', '#6b7280');
    root.style.setProperty('--filter-bg', parseColor(getVal('Filter_Bg_Color', 'transparent')));
    root.style.setProperty('--filter-text', parseColor(getVal('Filter_Text_Color', defaultFilterColor)));
    root.style.setProperty('--filter-active-bg', parseColor(getVal('Filter_Active_Bg_Color', defaultFilterColor)));
    root.style.setProperty('--filter-active-text', parseColor(getVal('Filter_Active_Text_Color', '#ffffff')));

    const mBorderEn = isTruthy(getVal('Macro_Border_Enable', 'FALSE'));
    const mBorderW = getVal('Macro_Border_Width', '1px');
    root.style.setProperty('--macro-border', mBorderEn ? `${mBorderW} solid ${parseColor(getVal('Macro_Border_Color', '#e5e7eb'))}` : 'none');
    
    const cBorderEn = isTruthy(getVal('Cat_Border_Enable', 'FALSE'));
    const cBorderW = getVal('Cat_Border_Width', '1px');
    root.style.setProperty('--cat-border', cBorderEn ? `${cBorderW} solid ${parseColor(getVal('Cat_Border_Color', '#e5e7eb'))}` : 'none');
    
    const iBorderEn = isTruthy(getVal('Item_Border_Enable', 'FALSE'));
    const iBorderW = getVal('Item_Border_Width', '1px');
    root.style.setProperty('--item-border', iBorderEn ? `${iBorderW} solid ${parseColor(getVal('Item_Border_Color', '#e5e7eb'))}` : 'none');

    root.style.setProperty('--macro-cols', getVal('Macro_Layout', 'grid').toLowerCase() === 'list' ? '1' : '2');
    root.style.setProperty('--macro-height', getVal('Macro_Height', '180px'));
    const mInt = getVal('Macro_Shadow_Intensity', 'medium').toLowerCase();
    root.style.setProperty('--macro-shadow', mInt === 'none' ? 'none' : (mInt === 'light' ? '0 2px 4px rgba(0,0,0,0.05)' : (mInt === 'strong' ? '0 10px 15px rgba(0,0,0,0.2)' : '0 4px 6px rgba(0,0,0,0.1)')));
    root.style.setProperty('--macro-text-color', parseColor(getVal('Macro_Text_Color', '#ffffff')));
    root.style.setProperty('--macro-text-font', getVal('Macro_Text_Font', 'sans-serif'));
    root.style.setProperty('--macro-text-weight', isTruthy(getVal('Macro_Text_Bold', 'TRUE')) ? 'bold' : 'normal');
    root.style.setProperty('--macro-text-shadow', isTruthy(getVal('Macro_Text_Shadow', 'TRUE')) ? '0px 2px 6px rgba(0,0,0,0.8)' : 'none');
    root.style.setProperty('--macro-align-v', getVal('Macro_Text_VAlign', 'center').toLowerCase() === 'top' ? 'flex-start' : (getVal('Macro_Text_VAlign', 'center').toLowerCase() === 'bottom' ? 'flex-end' : 'center'));
    root.style.setProperty('--macro-align-h', getVal('Macro_Text_HAlign', 'center').toLowerCase() === 'left' ? 'flex-start' : (getVal('Macro_Text_HAlign', 'center').toLowerCase() === 'right' ? 'flex-end' : 'center'));
    root.style.setProperty('--macro-text-size', getVal('Macro_Text_Size', '1.5rem'));
   
    root.style.setProperty('--cat-cols', getVal('Cat_Layout', 'list').toLowerCase() === 'grid' ? '2' : '1');
    root.style.setProperty('--cat-bg', parseColor(getVal('Cat_Bg_Color', '#ffffff')));
    root.style.setProperty('--cat-height', getVal('Cat_Height', '120px'));
    const cInt = getVal('Cat_Shadow_Intensity', 'light').toLowerCase();
    root.style.setProperty('--cat-shadow', cInt === 'none' ? 'none' : (cInt === 'medium' ? '0 4px 6px rgba(0,0,0,0.1)' : (cInt === 'strong' ? '0 10px 15px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.05)')));
    root.style.setProperty('--cat-text-color', parseColor(getVal('Cat_Text_Color', '#1f2937')));
    root.style.setProperty('--cat-text-font', getVal('Cat_Text_Font', 'sans-serif'));
    root.style.setProperty('--cat-text-weight', isTruthy(getVal('Cat_Text_Bold', 'TRUE')) ? 'bold' : 'normal');
    root.style.setProperty('--cat-align-v', getVal('Cat_Text_VAlign', 'center').toLowerCase() === 'top' ? 'flex-start' : (getVal('Cat_Text_VAlign', 'center').toLowerCase() === 'bottom' ? 'flex-end' : 'center'));
    root.style.setProperty('--cat-align-h', getVal('Cat_Text_HAlign', 'left').toLowerCase() === 'center' ? 'center' : (getVal('Cat_Text_HAlign', 'left').toLowerCase() === 'right' ? 'flex-end' : 'flex-start'));
    root.style.setProperty('--cat-text-size', getVal('Cat_Text_Size', '1.25rem'));
    
    root.style.setProperty('--header-bg', parseColor(getVal('Header_Color', '#ffffff'), isTruthy(getVal('Header_Transparent', 'FALSE')) ? '0.5' : '1'));
    root.style.setProperty('--header-shadow', getVal('Header_Shadow_Intensity', 'medium') !== 'none' ? '0 4px 15px rgba(0,0,0,0.08)' : 'none');

    const logoCont = document.getElementById('logo-container');
    const logoUrl = getVal('Logo_Image_URL', '');
    const align = getVal('Logo_Align', 'center').toLowerCase();
    logoCont.style.justifyContent = align === 'left' ? 'flex-start' : (align === 'right' ? 'flex-end' : 'center');
    logoCont.style.marginTop = getVal('Logo_Margin_Top', '0px');
    logoCont.style.marginBottom = '0px'; 
    if (logoUrl) {
        logoCont.innerHTML = `<img src="${escapeHTML(logoUrl)}" id="app-logo" style="max-height:${escapeHTML(getVal('Logo_Height', '80px'))}; object-fit:contain;" translate="no" class="notranslate">`;
        document.getElementById('app-logo').onload = updateLayout;
    }

    const sub = document.getElementById('subtitle-container');
    const subText = getVal('Subtitle_Text', '');
    root.style.setProperty('--subtitle-color', parseColor(getVal('Subtitle_Color', '#6b7280')));
    root.style.setProperty('--subtitle-font', getVal('Subtitle_Font', 'sans-serif'));
    if (subText !== '') {
        sub.style.display = 'block'; sub.innerText = subText;
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
    
    root.style.setProperty('--chevron-color', parseColor(getVal('Chevron_Color', '#9ca3af')));
    setTimeout(initInstallPopup, 1000);
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
    try {
        const res = await fetch(url);
        const csv = await res.text();
        fullData = [];
        const rows = csv.split(/\r?\n/);
        for(let i=1; i<rows.length; i++){
            const c = safeParseCSVRow(rows[i]);
            if(c.length >= 3 && c[0]) {
                fullData.push({ 
                    _id: i, macro: c[0], cat: c[1], name: c[2], desc: c[3], allerg: c[4], price: c[5], 
                    gf: c[6], vegan: c[7], veg: c[8], noalc: c[9], bio: c[10], active: c[11]||'TRUE', photo: c[12], ar: c[13], details: c[14] || '' 
                });
            }
        }
        fullData = fullData.filter(i => isTruthy(i.active));
        document.getElementById('loading-screen').classList.add('hidden');
        
        const levels = parseInt(getVal('Menu_Levels', '3')) || 3;
        
        if (levels === 1) {
            navigationStack = ['page-items'];
            renderLevel3('', ''); 
        } else if (levels === 2) {
            navigationStack = ['page-categories'];
            renderLevel2(''); 
        } else {
            navigationStack = ['page-macro'];
            renderLevel1(); 
        }

    } catch(e) { console.error(e); }
}

function renderLevel1() {
    const container = document.getElementById('macro-layout-container');
    const macros = [...new Set(fullData.map(i => i.macro))];
    container.className = 'macro-container'; container.innerHTML = '';
    macros.forEach(m => {
        const searchKey = 'Macro_Img_' + m.replace(/\s+/g, '_');
        const imgUrl = getVal(searchKey, '');
        const bgStyle = imgUrl ? `background-image: url('${escapeHTML(imgUrl)}');` : '';
        const noImageClass = imgUrl ? '' : 'no-image';
        container.innerHTML += `<div onclick="renderLevel2('${escapeJS(m)}')" class="macro-card ${noImageClass}" style="${bgStyle}"><div class="macro-overlay"></div><span class="macro-text-inside">${escapeHTML(m)}</span></div>`;
    });
    showPage('page-macro');
}

function renderLevel2(m) {
    const container = document.getElementById('page-categories');
    let cats = m === '' ? [...new Set(fullData.map(i => i.cat))] : [...new Set(fullData.filter(i => i.macro === m).map(i => i.cat))];
    
    container.className = 'cat-container'; 
    container.innerHTML = '';

    // Legge le nuove impostazioni dal Config
    const layout = getVal('Cat_Layout', 'list').toLowerCase();
    const showImg = isTruthy(getVal('Cat_Show_Image', 'SI'));
    const imgWidth = getVal('Cat_Image_Width', '40%');
    
    // Applica altezza dinamica al CSS
    document.documentElement.style.setProperty('--cat-height', getVal('Cat_Height', '120px'));
    document.documentElement.style.setProperty('--cat-img-w', imgWidth);

    cats.forEach(c => {
        const imgUrl = getVal('Cat_Img_' + c.replace(/\s+/g, '_'), '');
        let innerHtml = '';
        
        // Logica: Mostra immagine solo se abilitata e se esiste l'URL
        if (showImg && imgUrl) {
            if (layout === 'grid') {
                innerHtml = `
                    <div class="cat-img-wrapper" style="width:100%; height:60%;">
                        <img src="${escapeHTML(imgUrl)}" class="cat-img-grid" loading="lazy">
                    </div>
                    <div class="cat-text-wrapper">
                        <span class="cat-text">${escapeHTML(c)}</span>
                    </div>`;
            } else {
                innerHtml = `
                    <div class="cat-text-wrapper">
                        <span class="cat-text">${escapeHTML(c)}</span>
                    </div>
                    <div class="cat-img-wrapper" style="width:var(--cat-img-w);">
                        <img src="${escapeHTML(imgUrl)}" class="cat-img-list" loading="lazy">
                    </div>`;
            }
        } else {
            // Se l'immagine è disabilitata o manca, mostra solo il testo a tutta larghezza
            innerHtml = `<div class="cat-text-wrapper" style="width:100%;"><span class="cat-text">${escapeHTML(c)}</span></div>`;
        }
        
        container.innerHTML += `<div onclick="renderLevel3('${escapeJS(m)}','${escapeJS(c)}')" class="cat-card layout-${layout}">${innerHtml}</div>`;
    });
    
    if (navigationStack[navigationStack.length-1] !== 'page-categories') {
        navigationStack.push('page-categories'); 
    }
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
    
    let allCategoryItems = fullData;
    if (m !== '' && c !== '') allCategoryItems = fullData.filter(i => i.macro === m && i.cat === c);
    else if (m === '' && c !== '') allCategoryItems = fullData.filter(i => i.cat === c);
    
    const labels = getFilterLabels(); // 🆕 Carica i nomi personalizzati
    
    if (!isFiltering) {
        let titleText = c !== '' ? c : (m !== '' ? m : getVal('Subtitle_Text', 'Menu'));
        document.getElementById('sub-header-title').innerText = titleText;
        
        let filtersHtml = '';
        const tags = ['noalc', 'gf', 'vegan', 'veg', 'bio'];
        
        tags.forEach(t => {
            if(allCategoryItems.some(i => isTruthy(i[t]))) {
                filtersHtml += `<button onclick="toggleFilter('${t}')" id="btn-${t}" class="filter-btn">${escapeHTML(labels[t])}</button>`;
            }
        });
        
        document.getElementById('sub-header-filters').innerHTML = filtersHtml;
    }

    ['gf', 'vegan', 'veg', 'noalc', 'bio'].forEach(f => {
        const btn = document.getElementById(`btn-${f}`);
        if(btn) { activeFilters.includes(f) ? btn.classList.add('active') : btn.classList.remove('active'); }
    });

    let itemsToShow = allCategoryItems;
    if (activeFilters.length > 0) itemsToShow = itemsToShow.filter(i => activeFilters.every(f => isTruthy(i[f])));
    if (itemsToShow.length === 0) container.innerHTML = `<div style="text-align:center; padding: 20px; color:#9ca3af; font-weight:bold;">Nessun piatto trovato.</div>`;

    itemsToShow.forEach(i => {
        let badges = '';
        // 🆕 Inietta i nomi presi dal Config nei Badge
        if(isTruthy(i.gf)) badges += `<span class="badge badge-gf">${escapeHTML(labels.gf)}</span>`;
        if(isTruthy(i.vegan)) badges += `<span class="badge badge-vegan">${escapeHTML(labels.vegan)}</span>`;
        if(isTruthy(i.veg)) badges += `<span class="badge badge-veg">${escapeHTML(labels.veg)}</span>`;
        if(isTruthy(i.noalc)) badges += `<span class="badge badge-noalc">${escapeHTML(labels.noalc)}</span>`;
        if(isTruthy(i.bio)) badges += `<span class="badge badge-bio">${escapeHTML(labels.bio)}</span>`; 
        
        const hasDetails = i.details.trim() !== '';
        const cardClass = hasDetails ? 'menu-card clickable-card' : 'menu-card';
        const clickAction = hasDetails ? `onclick="openItemDetails(${i._id})"` : '';
        
        const chevronHtml = hasDetails ? `<svg class="inline-chevron" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>` : '';
        
        let badgeHtml = '';
        if (badges !== '' || hasDetails) {
            badgeHtml = `
            <div class="badge-container">
                <div class="badge-group">${badges}</div>
                ${chevronHtml}
            </div>`;
        }

       const arHtml = i.ar ? `
            <div style="width: 100%; display: flex; justify-content: center; margin-top: 8px;">
                <a href="javascript:void(0);" 
                   onclick="event.stopPropagation(); launchDirectAR('${escapeHTML(i.ar)}')" 
                   class="ar-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                        <line x1="12" y1="22.08" x2="12" y2="12"></line>
                    </svg> ${escapeHTML(getVal('Testo_Bottone_AR', 'Vedi in AR'))}
                </a>
            </div>` : '';

        container.innerHTML += `
        <div class="${cardClass}" ${clickAction}>
            <div class="item-card">
                <div style="flex-grow:1;">
                    <div class="item-name notranslate">${escapeHTML(i.name)}</div>
                    <div class="item-desc">${escapeHTML(i.desc)}</div>
                    <div class="item-price notranslate">${escapeHTML(i.price)}</div>
                </div>
                ${i.photo ? `<img src="${escapeHTML(i.photo)}" class="item-photo" style="margin-left: 10px;" loading="lazy">` : ''}
            </div>
            ${badgeHtml}
            ${arHtml}
        </div>`;
    });

    if(!isFiltering) { 
        if (navigationStack[navigationStack.length-1] !== 'page-items') {
            navigationStack.push('page-items'); 
        }
        showPage('page-items'); 
    }
}

function openItemDetails(id) {
    const item = fullData.find(x => x._id === id);
    if (!item) return;

    const container = document.getElementById('page-item-details');
    const labels = getFilterLabels(); // 🆕 Carica i nomi personalizzati
    
    let badges = '';
    if(isTruthy(item.gf)) badges += `<span class="badge badge-gf">${escapeHTML(labels.gf)}</span>`;
    if(isTruthy(item.vegan)) badges += `<span class="badge badge-vegan">${escapeHTML(labels.vegan)}</span>`;
    if(isTruthy(item.veg)) badges += `<span class="badge badge-veg">${escapeHTML(labels.veg)}</span>`;
    if(isTruthy(item.noalc)) badges += `<span class="badge badge-noalc">${escapeHTML(labels.noalc)}</span>`;
    if(isTruthy(item.bio)) badges += `<span class="badge badge-bio">${escapeHTML(labels.bio)}</span>`; 
    const badgeHtml = badges ? `<div class="badge-container" style="justify-content:center; margin-bottom:15px;"><div class="badge-group">${badges}</div></div>` : '';

  const arHtml = item.ar ? `
        <div style="width: 100%; display: flex; justify-content: center; margin-top: 20px;">
            <a href="javascript:void(0);" 
               onclick="event.stopPropagation(); launchDirectAR('${escapeHTML(item.ar)}')" 
               class="ar-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
               </svg> ${escapeHTML(getVal('Testo_Bottone_AR', 'Vedi in AR'))}
            </a>
        </div>` : '';
    
    const formattedDetails = escapeHTML(item.details).replace(/\n/g, '<br>');

    container.innerHTML = `
        <div class="details-page-card">
            ${item.photo ? `<img src="${escapeHTML(item.photo)}" class="detail-photo">` : ''}
            <div style="padding: 0 20px;">
                ${badgeHtml}
                <div class="detail-title notranslate">${escapeHTML(item.name)}</div>
                <div class="detail-price notranslate">${escapeHTML(item.price)}</div>
                <div class="detail-desc">${escapeHTML(item.desc)}</div>
                
                <div class="detail-long-text">${formattedDetails}</div>
                
                ${arHtml}
            </div>
        </div>
    `;

    if (navigationStack[navigationStack.length-1] !== 'page-item-details') {
        navigationStack.push('page-item-details');
    }
    showPage('page-item-details');
}

function showPage(p) {
    const pageIds = ['page-macro', 'page-categories', 'page-items', 'page-item-details']; 
    
    pageIds.forEach(id => { 
        const el = document.getElementById(id); 
        if(el) el.classList.add('hidden'); 
    });
    
    const target = document.getElementById(p);
    if(target) target.classList.remove('hidden');
    
    const backBtn = document.getElementById('back-button');
    const wrapper = document.getElementById('header-content-wrapper');
    const align = getVal('Logo_Align', 'center').toLowerCase();
    const subHeader = document.getElementById('sub-header');

    if (backBtn) {
        if (p === navigationStack[0]) { 
            backBtn.classList.remove('active'); 
            if(wrapper) wrapper.style.paddingLeft = '0px'; 
        } else { 
            backBtn.classList.add('active'); 
            if(wrapper && align === 'left') wrapper.style.paddingLeft = '50px'; 
        }
    }
    
    if (subHeader) {
        if (p === 'page-items') subHeader.style.display = 'flex';
        else subHeader.style.display = 'none';
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
let deferredPrompt;

// 1. Cattura l'evento installazione (solo Android)
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

function initInstallPopup() {
    // Controlla se è attivo nel Config
    if (getVal('Show_Install_Popup', 'NO') !== 'SI') return;

    // Controlla se l'app è già installata (modalità standalone)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) return;

    // Controlla se l'utente lo ha già chiuso di recente
    if (localStorage.getItem('pwa_popup_dismissed')) return;

    // Crea l'HTML del popup al volo
    const popup = document.createElement('div');
    popup.id = 'pwa-install-popup';
    
    const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const title = getVal('Popup_Text', 'Salva sulla Home');
    const iconPath = 'Image/icon-192.png'; // Pesca l'icona del cliente

    const iosShareSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 22px; vertical-align: bottom; margin: 0 4px;"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>`;

    // Testo unico per la descrizione preso da Excel
    // Prende il testo e trasforma in grassetto automatico tutto ciò che è tra virgolette
    let rawText = getVal('Popup_Descrizione', 'Aggiungi il menu alla schermata home.');
    let instructions = rawText.replace(/"(.*?)"/g, '<b>"$1"</b>');

    popup.innerHTML = `
        <img src="${iconPath}" class="pwa-icon-box">
        <div class="pwa-title">${title}</div>
        <div class="pwa-desc">${instructions}</div>
        <div class="pwa-btns">
            <button class="pwa-btn-close" onclick="dismissPwaPopup()">Non ora</button>
            ${isiOS ? '' : `<button class="pwa-btn-main" onclick="triggerAndroidInstall()">Installa</button>`}
        </div>
    `;

    document.body.appendChild(popup);

    // Mostra il popup dopo il delay
    setTimeout(() => {
        popup.classList.add('show');
    }, parseInt(getVal('Popup_Delay', '5000')));
}

function dismissPwaPopup() {
    document.getElementById('pwa-install-popup').classList.remove('show');
    // Salva la scelta per 7 giorni per non disturbare
    localStorage.setItem('pwa_popup_dismissed', 'true');
}

async function triggerAndroidInstall() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') dismissPwaPopup();
        deferredPrompt = null;
    }
}

init();
