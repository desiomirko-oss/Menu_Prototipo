const urlParams = new URLSearchParams(window.location.search);
const SHEET_ID = urlParams.get('id'); 
let appConfig = {};
let fullData = [];
let navigationStack = ['page-macro'];

let activeFilters = []; 
let currentMacroName = '';
let currentCategoryName = '';

// --- SICUREZZA E PULIZIA ---
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
    const cleaned = String(val).replace(/^['"]|['"]$/g, '').trim();
    if (cleaned.toLowerCase() === 'undefined' || cleaned === '-') return '';
    return cleaned;
}

function getVal(key, def) {
    let v = appConfig[key];
    if (v === undefined || v === null || v === '' || String(v).toLowerCase() === 'undefined' || v === '-') return def;
    return String(v).trim();
}

function getDynamicVal(prefix, suffix, def) {
    const searchKey = `${prefix}${suffix}`.toLowerCase();
    for (let k in appConfig) {
        if (k.toLowerCase() === searchKey) return getVal(k, def);
    }
    return def;
}

function isTruthy(keyOrValue, isConfigKey = true, defaultVal = true) {
    let v = isConfigKey ? getVal(keyOrValue, defaultVal ? 'TRUE' : 'FALSE') : (keyOrValue || '');
    v = String(v).toUpperCase().trim();
    return ['TRUE', 'SI', 'SÌ', 'YES', '1', 'V', 'VERO'].includes(v);
}

function getShadow(type, isText = false) {
    const val = getVal(type, 'none').toLowerCase();
    if (isText) {
        if(val === 'light') return '0 1px 2px rgba(0,0,0,0.15)';
        if(val === 'medium') return '0 2px 4px rgba(0,0,0,0.4)';
        if(val === 'strong') return '0 3px 6px rgba(0,0,0,0.7)';
        return 'none';
    } else {
        if(val === 'light') return '0 2px 4px rgba(0,0,0,0.1)';
        if(val === 'medium') return '0 4px 6px rgba(0,0,0,0.15)';
        if(val === 'strong') return '0 15px 25px -5px rgba(0,0,0,0.2)';
        return 'none';
    }
}

function safeParseCSVRow(str) {
    let arr = []; let quote = false; let cell = '';
    for (let i = 0; i < str.length; i++) {
        let c = str[i];
        if (c === '"' && str[i+1] === '"') { cell += '"'; i++; } 
        else if (c === '"') { quote = !quote; }
        else if (c === ',' && !quote) { arr.push(cell.trim()); cell = ''; }
        else { cell += c; }
    }
    arr.push(cell.trim());
    return arr.map(x => x.replace(/^"|"$/g, '').trim());
}

// --- INIT APP ---
async function init() {
    if (!SHEET_ID) {
        document.getElementById('loading-screen').innerHTML = "<div class='text-error pt-20'>ID Cliente Mancante</div>";
        return;
    }
    await fetchConfig(); 
    applyConfig(); 
    await fetchMenu();
}

async function fetchConfig() {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=config&t=${Date.now()}`;
    try {
        const response = await fetch(url);
        if(!response.ok) throw new Error("Network Error");
        const csv = await response.text();
        csv.split(/\r?\n/).slice(1).forEach(row => {
            if(row.trim() === '') return;
            const cols = safeParseCSVRow(row);
            if(cols.length >= 2 && cols[0] !== '') {
                let key = cols[0].replace(/^"|"$/g, '').replace(/,+$/, '').trim(); 
                let val = cols[1] ? cols[1].replace(/^"|"$/g, '').replace(/;/g, ',').trim() : ''; 
                if(key) appConfig[key] = val;
            }
        });
    } catch(e) { console.error("Errore Config:", e); }
}

function applyConfig() {
    const root = document.documentElement;
    
    // SFONDO APP
    const bgType = getVal('Bg_Type', 'color').toLowerCase();
    root.style.setProperty('--app-bg', getVal('Bg_Color', '#f9fafb'));
    if(bgType === 'image' && getVal('Bg_Image_URL', '') !== '') {
        root.style.setProperty('--app-bg-img', `url('${getVal('Bg_Image_URL', '')}')`);
    } else {
        root.style.setProperty('--app-bg-img', 'none');
    }
    root.style.setProperty('--app-bg-size', getVal('Bg_Image_Size', 'cover'));
    root.style.setProperty('--app-bg-pos', getVal('Bg_Image_Pos', 'center'));

    // HEADER (Trasparenza e Ombre)
    root.style.setProperty('--header-bg', getVal('Header_BgColor', 'rgba(255, 255, 255, 0.95)'));
    let headerShadow = '0 4px 15px rgba(0,0,0,0.06)'; 
    const hShadowInt = getVal('Header_Shadow_Intensity', 'medium').toLowerCase();
    if(hShadowInt === 'light') headerShadow = '0 2px 4px rgba(0,0,0,0.03)';
    else if(hShadowInt === 'strong') headerShadow = '0 10px 25px rgba(0,0,0,0.15)';
    else if(hShadowInt === 'none') headerShadow = 'none';
    root.style.setProperty('--header-shadow', headerShadow);

    // MENU CARDS E OMBRE
    root.style.setProperty('--macro-h', getVal('Macro_Height', '180px'));
    root.style.setProperty('--back-bg', getVal('Back_Btn_Bg', 'rgba(255, 255, 255, 0.9)'));
    root.style.setProperty('--back-color', getVal('Back_Btn_Color', '#000'));

    let shadowVal = '0 10px 15px -3px rgba(0,0,0,0.1)'; 
    const shadowInt = getVal('Card_Shadow_Intensity', 'medium').toLowerCase();
    if(shadowInt === 'light') shadowVal = '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)';
    else if(shadowInt === 'strong') shadowVal = '0 20px 25px -5px rgba(0,0,0,0.2), 0 10px 10px -5px rgba(0,0,0,0.1)';
    else if(shadowInt === 'none') shadowVal = 'none';
    root.style.setProperty('--card-shadow', shadowVal);

    if(!isTruthy('Card_Show_Bg', true, true)) {
        root.style.setProperty('--menu-card-bg', 'transparent'); root.style.setProperty('--menu-card-shadow', 'none');
        root.style.setProperty('--menu-card-border', 'none'); root.style.setProperty('--menu-card-p', '10px 0px'); 
    } else {
        root.style.setProperty('--menu-card-bg', getVal('Card_BgColor', '#ffffff')); root.style.setProperty('--menu-card-shadow', shadowVal); 
        root.style.setProperty('--menu-card-border', '1px solid rgba(0,0,0,0.03)'); root.style.setProperty('--menu-card-p', getVal('Card_Padding', '20px'));
    }
    root.style.setProperty('--menu-card-r', getVal('Card_Radius', '24px'));
    root.style.setProperty('--cat-card-min-h', getVal('Category_Card_MinHeight', '80px'));
    root.style.setProperty('--item-card-min-h', getVal('Item_Card_MinHeight', '120px'));
    root.style.setProperty('--i-photo-w', getVal('Item_Photo_Width', '110px'));
    root.style.setProperty('--i-photo-h', getVal('Item_Photo_Height', '110px'));
    root.style.setProperty('--i-photo-sh', getShadow('Item_Photo_Shadow', false));

    // TESTI
    root.style.setProperty('--macro-t-f', getVal('Macro_Text_Font', 'sans-serif'));
    root.style.setProperty('--macro-t-c', getVal('Macro_Text_Color', '#ffffff'));
    root.style.setProperty('--macro-txt-sh', getShadow('Macro_Text_Shadow', true));
    root.style.setProperty('--i-name-f', getVal('Item_Name_Font', 'sans-serif'));
    root.style.setProperty('--i-name-c', getVal('Item_Name_Color', '#111827'));
    root.style.setProperty('--i-name-s', getVal('Item_Name_Size', '18px'));
    root.style.setProperty('--i-name-w', isTruthy('Item_Name_Bold', true, true) ? 'bold' : 'normal');
    root.style.setProperty('--i-name-mb', getVal('Item_Name_MarginBottom', '4px'));
    root.style.setProperty('--i-name-sh', getShadow('Item_Name_Shadow', true));
    root.style.setProperty('--i-desc-f', getVal('Item_Desc_Font', 'sans-serif'));
    root.style.setProperty('--i-desc-c', getVal('Item_Desc_Color', '#6b7280'));
    root.style.setProperty('--i-desc-s', getVal('Item_Desc_Size', '14px'));
    root.style.setProperty('--i-desc-w', isTruthy('Item_Desc_Bold', true, false) ? 'bold' : 'normal');
    root.style.setProperty('--i-desc-mb', getVal('Item_Desc_MarginBottom', '8px'));
    root.style.setProperty('--i-desc-sh', getShadow('Item_Desc_Shadow', true));
    root.style.setProperty('--i-allg-f', getVal('Item_Allerg_Font', 'sans-serif'));
    root.style.setProperty('--i-allg-c', getVal('Item_Allerg_Color', '#f87171'));
    root.style.setProperty('--i-allg-s', getVal('Item_Allerg_Size', '11px'));
    root.style.setProperty('--i-allg-w', isTruthy('Item_Allerg_Bold', true, false) ? 'bold' : 'normal');
    root.style.setProperty('--i-allg-mb', getVal('Item_Allerg_MarginBottom', '8px'));
    root.style.setProperty('--i-allg-sh', getShadow('Item_Allerg_Shadow', true));
    root.style.setProperty('--i-pric-f', getVal('Item_Price_Font', 'sans-serif'));
    root.style.setProperty('--i-pric-c', getVal('Item_Price_Color', '#4f46e5'));
    root.style.setProperty('--i-pric-s', getVal('Item_Price_Size', '16px'));
    root.style.setProperty('--i-pric-w', isTruthy('Item_Price_Bold', true, true) ? 'bold' : 'normal');
    root.style.setProperty('--i-pric-sh', getShadow('Item_Price_Shadow', true));
    
    // FILTRI MARGINI
    root.style.setProperty('--flt-f', getVal('Filter_Font', 'sans-serif'));
    root.style.setProperty('--flt-s', getVal('Filter_Size', '11px'));
    root.style.setProperty('--flt-w', isTruthy('Filter_Bold', true, true) ? 'bold' : 'normal');
    root.style.setProperty('--flt-mt', getVal('Filter_Margin_Top', '10px'));
    root.style.setProperty('--flt-mb', getVal('Filter_Margin_Bottom', '15px'));
    root.style.setProperty('--flt-bg-i', getVal('Filter_BgColor_Inactive', '#f3f4f6'));
    root.style.setProperty('--flt-c-i', getVal('Filter_TextColor_Inactive', '#9ca3af'));
    root.style.setProperty('--flt-bg-a', getVal('Filter_BgColor_Active', '#4f46e5'));
    root.style.setProperty('--flt-c-a', getVal('Filter_TextColor_Active', '#ffffff'));

    // LOGO
    const logoCont = document.getElementById('logo-container');
    const logoType = getVal('Logo_Type', 'text').toLowerCase();
    const align = getVal('Logo_Align', 'center').toLowerCase();
    
    logoCont.style.justifyContent = align === 'left' ? 'flex-start' : (align === 'right' ? 'flex-end' : 'center');
    logoCont.innerHTML = ''; 
    
    if (logoType === 'image' && getVal('Logo_Image_URL', '') !== '') {
        const url = escapeHTML(getVal('Logo_Image_URL', ''));
        // onload avvia il ricalcolo dell'header dinamico
        logoCont.innerHTML = `<img src="${url}" style="max-height:${escapeHTML(getVal('Logo_Image_Size', '60px'))}; object-fit:contain;" alt="Logo Menu" onload="updateLayout()">`;
    } else {
        const text = escapeHTML(getVal('Logo_Text', 'Menu'));
        logoCont.innerHTML = `<h1 style="color:${getVal('Logo_Text_Color', '#000')}; font-size:${getVal('Logo_Text_Size', '28px')}; font-weight:${isTruthy('Logo_Text_Bold', true, true) ? 'bold' : 'normal'}; margin:0; line-height:1; font-family:${getVal('Logo_Text_Font', 'sans-serif')}; text-align:${align}; width:100%;">${text}</h1>`;
    }

    // SOTTOTITOLO E TITOLI DI LIVELLO
    const sub = document.getElementById('subtitle-container');
    if(!isTruthy('Subtitle_Show', true, true)) {
        sub.style.display = 'none';
    } else {
        sub.style.display = 'block'; 
        sub.textContent = getVal('Subtitle_Text', '');
        sub.style.cssText = `color:${getVal('Subtitle_Color', '#6b7280')}; font-size:${getVal('Subtitle_Size', '14px')}; font-weight:${isTruthy('Subtitle_Bold', true, false) ? 'bold' : 'normal'}; margin-top:${getVal('Subtitle_Margin_Top', '10px')}; text-align:${getVal('Subtitle_Align', 'center')}; font-family:${getVal('Subtitle_Font', 'sans-serif')};`;
    }

    const lvlSh = getShadow('Level_Title_Shadow', true);
    const levelStyle = `color:${getVal('Level_Title_Color', '#4f46e5')}; font-size:${getVal('Level_Title_Size', '14px')}; font-weight:${isTruthy('Level_Title_Bold', true, true) ? 'bold' : 'normal'}; text-align:${getVal('Level_Title_Align', 'center')}; font-family:${getVal('Level_Title_Font', 'sans-serif')}; text-shadow: ${lvlSh}; margin-top: 8px; display: none;`;
    document.getElementById('level-title-inside').style.cssText = levelStyle;
    
    const levelMarginB = getVal('Level_Title_Margin_Bottom', '25px');
    document.getElementById('level-title-outside').style.cssText = levelStyle + ` margin-top: 0px; margin-bottom: ${levelMarginB};`; 
}

// MOTORE LAYOUT ADATTIVO
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

        const pos = getVal('Back_Btn_Position', 'center').toLowerCase();
        if (pos === 'center') backBtn.style.top = `calc(${hHeight}px / 2 - 22px)`;
        else if (pos === 'bottom') backBtn.style.top = `calc(${hHeight}px - 55px)`;
        else if (pos === 'outside') backBtn.style.top = `calc(${hHeight}px + 15px)`;
        
    }, 50); 
}

// --- FETCH E RENDER MENU ---
async function fetchMenu() {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=menu&t=${Date.now()}`;
    try {
        const response = await fetch(url);
        if(!response.ok) throw new Error("Network Error");
        const csv = await response.text();
        
        fullData = [];
        const rows = csv.split(/\r?\n/);
        
        for(let i=1; i<rows.length; i++) {
            if(rows[i].trim() === '') continue;
            const c = safeParseCSVRow(rows[i]);
            if(c.length < 3 || !c[0]) continue;
            
            fullData.push({
                macro: cleanString(c[0]), cat: cleanString(c[1]), name: cleanString(c[2]), 
                desc: cleanString(c[3]), allerg: cleanString(c[4]), price: cleanString(c[5]), 
                gf: cleanString(c[6]), vegan: cleanString(c[7]), veg: cleanString(c[8]), 
                noalc: cleanString(c[9]), active: c[10] !== undefined ? c[10] : 'TRUE', 
                photoUrl: cleanString(c[11]), ar: cleanString(c[12]) 
            });
        }
        
        fullData = fullData.filter(i => isTruthy(i.active, false)); 
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
    
    const isGrid = getVal('Macro_Layout', 'grid').toLowerCase() === 'grid';
    layoutContainer.className = `page-content ${isGrid ? 'macro-grid' : 'macro-list'}`;
    layoutContainer.innerHTML = '';

    const bgType = getVal('Macro_Bg_Type', 'image').toLowerCase();

    macros.forEach(m => {
        let bgStyle = '';
        if (bgType === 'color') {
            bgStyle = `background: ${getVal('Macro_Bg_Color', '#cbd5e1')};`;
        } else {
            const imgUrl = getDynamicVal('Macro_Img_', m, '');
            if (imgUrl) bgStyle = `background-image: url('${escapeHTML(imgUrl)}');`;
            else bgStyle = `background: ${getVal('Macro_Bg_Color', '#cbd5e1')};`;
        }

        const tPos = getVal('Macro_Text_Pos', 'center').toLowerCase(); 
        const safeName = escapeHTML(m);
        const argName = escapeJS(m); 
        
        let html = '';
        if(tPos === 'outside') {
            html = `<div onclick="renderLevel2('${argName}')" class="flex-col"><div class="macro-card w-full" style="${bgStyle}"></div><span class="macro-text-outside">${safeName}</span></div>`;
        } else {
            html = `<div onclick="renderLevel2('${argName}')" class="macro-card w-full flex items-center justify-center" style="${bgStyle}"><div class="macro-overlay"></div><span class="macro-text-inside">${safeName}</span></div>`;
        }
        layoutContainer.innerHTML += html;
    });
    showPage('page-macro');
}

function renderLevel2(mName) {
    const container = document.getElementById('page-categories');
    const cats = [...new Set(fullData.filter(i => i.macro === mName).map(i => i.cat))];
    
    container.innerHTML = ''; 
    const showCatPhoto = isTruthy('Category_Photo_Show', true, true);

    cats.forEach(c => {
        let bgStyle = '';
        let overlayHTML = '';
        let textStyle = 'font-weight: 800; color: #1f2937; font-size: 1.125rem; position: relative; z-index: 10;';
        let iconClass = 'text-gray-400';

        if(showCatPhoto) {
            const imgUrl = getDynamicVal('Category_Img_', c, '');
            if(imgUrl) {
                bgStyle = `background-image: url('${escapeHTML(imgUrl)}'); border: none;`;
                overlayHTML = `<div class="cat-overlay"></div>`;
                textStyle = 'font-weight: 900; color: #ffffff; font-size: 1.125rem; position: relative; z-index: 10; text-shadow: 0 2px 4px rgba(0,0,0,0.5);';
                iconClass = 'text-white';
            }
        }

        const safeCat = escapeHTML(c);
        const argMacro = escapeJS(mName);
        const argCat = escapeJS(c);

        container.innerHTML += `
            <div onclick="renderLevel3('${argMacro}', '${argCat}')" class="menu-card cat-card" style="${bgStyle}">
                ${overlayHTML}
                <span style="${textStyle}">${safeCat}</span>
                <svg class="icon-sm shrink-0 ml-2 relative z-10" style="color: ${iconClass === 'text-white' ? '#fff' : '#9ca3af'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
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
        filterContainer.innerHTML = '';

        if (isTruthy('Filter_Show', true, true)) {
            const isDrinks = mName.toLowerCase().match(/bevand|bebid|drink/);
            let filterHtml = '';
            if (!isDrinks) {
                if(isTruthy('Filter_Show_GF', true, true)) filterHtml += `<button onclick="toggleFilter('gf')" class="filter-btn">Senza Glutine</button>`;
                if(isTruthy('Filter_Show_Vegan', true, true)) filterHtml += `<button onclick="toggleFilter('vegan')" class="filter-btn">Vegano</button>`;
                if(isTruthy('Filter_Show_Veg', true, true)) filterHtml += `<button onclick="toggleFilter('veg')" class="filter-btn">Vegetariano</button>`;
            } else {
                if(isTruthy('Filter_Show_NoAlc', true, true)) filterHtml += `<button onclick="toggleFilter('noalc')" class="filter-btn">Analcolico</button>`;
            }
            filterContainer.innerHTML = filterHtml;
        }
    }

    const container = document.getElementById('page-items');
    container.innerHTML = ''; 
    
    let items = fullData.filter(i => i.cat === cName && i.macro === mName);
    
    if (activeFilters.length > 0) {
        items = items.filter(i => {
            return activeFilters.every(f => {
                if(f === 'gf') return isTruthy(i.gf, false);
                if(f === 'vegan') return isTruthy(i.vegan, false);
                if(f === 'veg') return isTruthy(i.veg, false);
                if(f === 'noalc') return isTruthy(i.noalc, false);
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
        if(isTruthy(i.gf, false)) badges += `<span class="badge badge-gf">Senza Glutine</span>`;
        if(isTruthy(i.vegan, false)) badges += `<span class="badge badge-vegan">Vegano</span>`;
        if(isTruthy(i.veg, false)) badges += `<span class="badge badge-veg">Vegetariano</span>`;
        
        let allergensHTML = safeAllerg && safeAllerg !== '-' ? `<span class="item-allerg">Allergeni: ${safeAllerg}</span>` : '';
        let descHTML = safeDesc && safeDesc !== '-' ? `<p class="item-desc">${safeDesc}</p>` : '';
        let priceHTML = `<span class="item-price">${safePrice}</span>`;

        let arHTML = '';
        if (safeAr) {
            arHTML = `<a href="${safeAr}" target="_blank" rel="noopener noreferrer" class="ar-badge"><svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg> VEDI AR</a>`;
        }

        const hasPhoto = safePhoto !== '';

        if (hasPhoto) {
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
        showPage('page-items', mName);
    }
}

function showPage(p, levelTitle = '') {
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
    const titleInside = document.getElementById('level-title-inside');
    const titleOutside = document.getElementById('level-title-outside');
    const wrapper = document.getElementById('header-content-wrapper');
    const align = getVal('Logo_Align', 'center').toLowerCase();
    
    titleInside.classList.add('hidden'); titleOutside.classList.add('hidden');

    if(p === 'page-macro') {
        backBtn.classList.remove('active');
        if(subHeader) subHeader.style.display = 'none';
        if(wrapper) wrapper.style.paddingLeft = '0px'; 
    } else {
        backBtn.classList.add('active');
        const pos = getVal('Back_Btn_Position', 'center').toLowerCase();
        if(wrapper) wrapper.style.paddingLeft = (align === 'left' && pos !== 'outside') ? '45px' : '0px';
        
        if(p === 'page-items') {
            if(subHeader) subHeader.style.display = 'flex'; 
        } else {
            if(subHeader) subHeader.style.display = 'none';
            if(isTruthy('Level_Title_Show', true, true)) {
                if(getVal('Level_Title_Position', 'inside').toLowerCase() === 'outside') {
                    titleOutside.classList.remove('hidden'); 
                    titleOutside.textContent = levelTitle; 
                } else {
                    titleInside.classList.remove('hidden'); 
                    titleInside.textContent = levelTitle; 
                }
            }
        }
    }
    
    updateLayout();
    window.scrollTo({top: 0, behavior: 'instant'});
}

function goBack() { 
    if(navigationStack.length > 1) {
        navigationStack.pop(); 
        const prev = navigationStack[navigationStack.length-1];
        let titleToRestore = '';
        if(prev === 'page-categories') {
            const firstMatch = fullData.find(i => i.cat === document.getElementById('sub-header-title').textContent);
            if(firstMatch) titleToRestore = firstMatch.macro;
        }
        showPage(prev, titleToRestore);
    }
}

init();
