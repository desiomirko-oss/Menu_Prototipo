const urlParams = new URLSearchParams(window.location.search);
const SHEET_ID = urlParams.get('id'); 
let appConfig = {};
let fullData = [];
let navigationStack = ['page-macro'];

let activeFilters = []; 
let currentMacroName = '';
let currentCategoryName = '';

// --- 1. FUNZIONI DI PULIZIA DATI DA EXCEL/CSV ---
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

// --- 2. INIZIALIZZAZIONE E FETCH ---
async function init() {
    if (!SHEET_ID) {
        document.getElementById('loading-screen').innerHTML = "<div class='text-center pt-20 text-red-500 font-bold'>ID Cliente Mancante</div>";
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
                // PULIZIA DELLE CHIAVI E DEI VALORI DA EXCEL
                let key = cols[0].replace(/^"|"$/g, '').replace(/,+$/, '').trim(); // Toglie la virgola orfana
                let val = cols[1] ? cols[1].replace(/^"|"$/g, '').replace(/;/g, ',').trim() : ''; // Fix punti e virgola in rgba
                appConfig[key] = val;
            }
        });
    } catch(e) { console.error("Errore Configurazione:", e); }
}

function applyConfig() {
    const root = document.documentElement;
    
    // SFONDO
    const bgType = getVal('Bg_Type', 'color').toLowerCase();
    root.style.setProperty('--app-bg', getVal('Bg_Color', '#f9fafb'));
    if(bgType === 'image' && getVal('Bg_Image_URL', '') !== '') {
        root.style.setProperty('--app-bg-img', `url('${getVal('Bg_Image_URL', '')}')`);
    } else {
        root.style.setProperty('--app-bg-img', 'none');
    }
    root.style.setProperty('--app-bg-size', getVal('Bg_Image_Size', 'cover'));
    root.style.setProperty('--app-bg-pos', getVal('Bg_Image_Pos', 'center'));

    // HEADER & CARD
    root.style.setProperty('--header-bg', getVal('Header_BgColor', 'rgba(255, 255, 255, 0.95)'));
    root.style.setProperty('--header-h', getVal('Header_Height', '120px'));
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

    // TIPOGRAFIA (Font e Colori ora mappano perfettamente le chiavi pulite)
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
    
    // FILTRI
    root.style.setProperty('--flt-f', getVal('Filter_Font', 'sans-serif'));
    root.style.setProperty('--flt-s', getVal('Filter_Size', '11px'));
    root.style.setProperty('--flt-w', isTruthy('Filter_Bold', true, true) ? 'bold' : 'normal');
    root.style.setProperty('--flt-bg-i', getVal('Filter_BgColor_Inactive', '#f3f4f6'));
    root.style.setProperty('--flt-c-i', getVal('Filter_TextColor_Inactive', '#9ca3af'));
    root.style.setProperty('--flt-bg-a', getVal('Filter_BgColor_Active', '#4f46e5'));
    root.style.setProperty('--flt-c-a', getVal('Filter_TextColor_Active', '#ffffff'));

    // LOGO
    const logoCont = document.getElementById('logo-container');
    const logoType = getVal('Logo_Type', 'text').toLowerCase();
    const align = getVal('Logo_Align', 'center').toLowerCase();
    logoCont.innerHTML = ''; 
    logoCont.className = `w-full flex justify-${align === 'left' ? 'start' : align === 'right' ? 'end' : 'center'}`;
    
    if (logoType === 'image' && getVal('Logo_Image_URL', '') !== '') {
        logoCont.innerHTML = `<img src="${getVal('Logo_Image_URL', '')}" style="max-height:${getVal('Logo_Image_Size', '60px')}; object-fit:contain;" onerror="this.style.display='none'">`;
    } else {
        logoCont.innerHTML = `<h1 style="color:${getVal('Logo_Text_Color', '#000')}; font-size:${getVal('Logo_Text_Size', '28px')}; font-weight:${isTruthy('Logo_Text_Bold', true, true) ? 'bold' : 'normal'}; margin:0; line-height:1; font-family:${getVal('Logo_Text_Font', 'sans-serif')};">${getVal('Logo_Text', 'Menu Digitale')}</h1>`;
    }

    // SOTTOTITOLO
    const sub = document.getElementById('subtitle-container');
    if(!isTruthy('Subtitle_Show', true, true)) {
        sub.style.display = 'none';
    } else {
        sub.style.display = 'block'; 
        sub.innerText = getVal('Subtitle_Text', '');
        sub.style.cssText = `color:${getVal('Subtitle_Color', '#6b7280')}; font-size:${getVal('Subtitle_Size', '14px')}; font-weight:${isTruthy('Subtitle_Bold', true, false) ? 'bold' : 'normal'}; margin-top:${getVal('Subtitle_Margin_Top', '10px')}; text-align:${getVal('Subtitle_Align', 'center')}; font-family:${getVal('Subtitle_Font', 'sans-serif')};`;
    }

    const lvlSh = getShadow('Level_Title_Shadow', true);
    const levelStyle = `color:${getVal('Level_Title_Color', '#4f46e5')}; font-size:${getVal('Level_Title_Size', '14px')}; font-weight:${isTruthy('Level_Title_Bold', true, true) ? 'bold' : 'normal'}; text-align:${getVal('Level_Title_Align', 'center')}; font-family:${getVal('Level_Title_Font', 'sans-serif')}; text-shadow: ${lvlSh}; margin-top: 8px; display: none;`;
    document.getElementById('level-title-inside').style.cssText = levelStyle;
    
    const levelMarginB = getVal('Level_Title_Margin_Bottom', '25px');
    document.getElementById('level-title-outside').style.cssText = levelStyle + ` margin-top: 0px; margin-bottom: ${levelMarginB};`; 
    
    const backBtn = document.getElementById('back-button');
    const hHeight = parseInt(getVal('Header_Height', '120'));
    const pos = getVal('Back_Btn_Position', 'center').toLowerCase();
    if (pos === 'center') backBtn.style.top = `calc(${hHeight}px / 2 - 22px)`;
    else if (pos === 'bottom') backBtn.style.top = `calc(${hHeight}px - 55px)`;
    else if (pos === 'outside') backBtn.style.top = `calc(${hHeight}px + 15px)`;
}

function autoAdjustPadding() {
    setTimeout(() => {
        const header = document.getElementById('main-header');
        const subHeader = document.getElementById('sub-header');
        const mainContent = document.getElementById('main-content');
        let totalH = header.offsetHeight;
        if(subHeader && subHeader.style.display !== 'none') {
            totalH += subHeader.offsetHeight;
        }
        if(mainContent) mainContent.style.paddingTop = `calc(${totalH}px + 20px)`;
    }, 50); 
}

// --- 3. FETCH E RENDER DEL MENU (INCLUDE AR) ---
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
                macro: c[0] || '', cat: c[1] || '', name: c[2] || '', desc: c[3] || '', 
                allerg: c[4] || '', price: c[5] || '', gf: c[6] || '', vegan: c[7] || '', 
                veg: c[8] || '', noalc: c[9] || '', 
                active: c[10] !== undefined ? c[10] : 'TRUE', 
                photoUrl: c[11] || '', 
                ar: c[12] || '' // COLONNA M DEL FOGLIO (13esima posizione)
            });
        }
        
        // Riconosce i SI del tuo foglio come Elementi Attivi
        fullData = fullData.filter(i => isTruthy(i.active, false, true)); 
        
        document.getElementById('loading-screen').style.display = 'none';
        renderLevel1();
    } catch (e) { 
        console.error(e);
        document.getElementById('loading-screen').innerHTML = "<div class='text-center pt-20 text-red-500 font-bold'>Menu non trovato o in manutenzione.</div>"; 
    }
}

function renderLevel1() {
    const layoutContainer = document.getElementById('macro-layout-container');
    const macros = [...new Set(fullData.map(i => i.macro))];
    
    const isGrid = getVal('Macro_Layout', 'grid').toLowerCase() === 'grid';
    layoutContainer.className = `page-content ${isGrid ? 'grid grid-cols-2 gap-4' : 'flex flex-col space-y-6'}`;
    layoutContainer.innerHTML = '';

    const bgType = getVal('Macro_Bg_Type', 'image').toLowerCase();

    macros.forEach(m => {
        let bgStyle = '';
        if (bgType === 'color') {
            bgStyle = `background: ${getVal('Macro_Bg_Color', '#cbd5e1')};`;
        } else {
            // Nota che il tuo config usa nomi esatti "Macro_Img_CIBO" e "Macro_Img_BEVANDA"
            const imgUrl = getVal(`Macro_Img_${m}`, '');
            if (imgUrl) bgStyle = `background-image: url('${imgUrl}');`;
            else bgStyle = `background: ${getVal('Macro_Bg_Color', '#cbd5e1')};`;
        }

        const tPos = getVal('Macro_Text_Pos', 'center').toLowerCase(); 
        let html = '';
        if(tPos === 'outside') {
            html = `<div onclick="renderLevel2('${m.replace(/'/g, "\\'")}')" class="flex flex-col cursor-pointer"><div class="macro-card w-full" style="${bgStyle}"></div><span class="macro-text-outside text-center mt-2 font-bold uppercase tracking-wide text-sm">${m}</span></div>`;
        } else {
            html = `<div onclick="renderLevel2('${m.replace(/'/g, "\\'")}')" class="macro-card w-full flex items-center justify-center cursor-pointer" style="${bgStyle}"><div class="macro-overlay"></div><span class="macro-text-inside relative z-10 font-extrabold text-xl uppercase tracking-widest">${m}</span></div>`;
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
        let textClass = 'font-bold text-gray-800 text-lg relative z-10';
        let iconClass = 'text-gray-400 shrink-0 ml-2 relative z-10';

        if(showCatPhoto) {
            const imgUrl = getVal(`Category_Img_${c}`, '');
            if(imgUrl) {
                bgStyle = `background-image: url('${imgUrl}'); border: none;`;
                overlayHTML = `<div class="cat-overlay"></div>`;
                textClass = 'font-extrabold text-white text-lg relative z-10 text-shadow';
                iconClass = 'text-white shrink-0 ml-2 relative z-10';
            }
        }

        container.innerHTML += `
            <div onclick="renderLevel3('${mName.replace(/'/g, "\\'")}', '${c.replace(/'/g, "\\'")}')" class="menu-card cat-card flex justify-between items-center cursor-pointer mb-3" style="${bgStyle}">
                ${overlayHTML}
                <span class="${textClass}">${c}</span>
                <svg class="w-5 h-5 ${iconClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </div>`;
    });
    navigationStack.push('page-categories');
    showPage('page-categories', mName);
}

// --- 4. LOGICA FILTRI E AR (RADIO BUTTON) ---
function toggleFilter(filterType) {
    // Spegne se già cliccato, accende se nuovo (Radio Esclusivo)
    if (activeFilters.includes(filterType)) {
        activeFilters = [];
    } else {
        activeFilters = [filterType];
    }
    
    const btns = document.getElementById('sub-header-filters').querySelectorAll('.filter-btn');
    btns.forEach(btn => {
        btn.classList.remove('active');
        if(activeFilters.length > 0) {
            const f = activeFilters[0];
            const txt = btn.innerText.toLowerCase();
            const isMatch = (f === 'gf' && txt.includes('glutine')) || 
                            (f === 'vegan' && txt.includes('vegano')) || 
                            (f === 'veg' && txt.includes('vegetariano')) || 
                            (f === 'noalc' && txt.includes('analcolico'));
            if(isMatch) btn.classList.add('active'); // Il CSS cambia colore all'istante
        }
    });
    renderLevel3(currentMacroName, currentCategoryName, true);
}

function renderLevel3(mName, cName, isFiltering = false) {
    currentMacroName = mName; currentCategoryName = cName;
    
    if (!isFiltering) {
        document.getElementById('sub-header-title').innerText = cName;
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
    
    // FILTRA I DATI INTERCETTANDO IL TUO "SI"
    if (activeFilters.length > 0) {
        items = items.filter(i => {
            return activeFilters.every(f => {
                if(f === 'gf') return isTruthy(i.gf, false, false);
                if(f === 'vegan') return isTruthy(i.vegan, false, false);
                if(f === 'veg') return isTruthy(i.veg, false, false);
                if(f === 'noalc') return isTruthy(i.noalc, false, false);
                return true;
            });
        });
    }

    if(items.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-400 py-10 font-bold">Nessun piatto trovato.</div>`;
    }

    items.forEach(i => {
        let badges = '';
        if(isTruthy(i.gf, false, false)) badges += `<span class="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full mr-1 mt-1">Senza Glutine</span>`;
        if(isTruthy(i.vegan, false, false)) badges += `<span class="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full mr-1 mt-1">Vegano</span>`;
        if(isTruthy(i.veg, false, false)) badges += `<span class="bg-lime-100 text-lime-700 text-[10px] font-bold px-2 py-0.5 rounded-full mr-1 mt-1">Vegetariano</span>`;
        
        let allergensHTML = i.allerg && i.allerg !== '-' ? `<span class="item-allerg">Allergeni: ${i.allerg}</span>` : '';
        let descHTML = i.desc && i.desc !== '-' ? `<p class="item-desc">${i.desc}</p>` : '';
        let priceHTML = `<span class="item-price">${i.price}</span>`;

        // INIEZIONE PULSANTE AR
        let arHTML = '';
        const cleanArUrl = cleanString(i.ar);
        if (cleanArUrl) {
            arHTML = `<a href="${cleanArUrl}" target="_blank" class="ar-badge"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg> VEDI AR</a>`;
        }

        const cleanPhotoUrl = cleanString(i.photoUrl);
        const hasPhoto = cleanPhotoUrl !== '';

        if (hasPhoto) {
            container.innerHTML += `
                <div class="menu-card item-card flex justify-between items-stretch gap-4 mb-4">
                    <div class="flex flex-col flex-grow">
                        <div>
                            <h3 class="item-name">${i.name}</h3>
                            ${descHTML}
                            ${allergensHTML}
                            <div class="flex flex-wrap">${badges}</div>
                            ${arHTML}
                        </div>
                        <div class="mt-auto pt-3">${priceHTML}</div>
                    </div>
                    <img src="${cleanPhotoUrl}" alt="" onerror="this.style.display='none'" class="item-photo shrink-0">
                </div>`;
        } else {
            container.innerHTML += `
                <div class="menu-card item-card flex flex-col justify-center mb-4">
                    <div class="flex justify-between items-start gap-4">
                        <h3 class="item-name flex-grow">${i.name}</h3>
                        <div class="shrink-0 text-right pl-2">${priceHTML}</div>
                    </div>
                    ${descHTML}
                    ${allergensHTML}
                    <div class="flex flex-wrap">${badges}</div>
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

    document.getElementById('page-macro').style.display = 'none';
    document.getElementById('page-categories').style.display = 'none';
    document.getElementById('page-items').style.display = 'none';
    document.getElementById(p).style.display = 'block';
    
    const contentDiv = document.querySelector(`#${p} .page-content`) || document.getElementById(p);
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
    
    titleInside.style.display = 'none'; titleOutside.style.display = 'none';

    if(p === 'page-macro') {
        backBtn.classList.remove('active');
        subHeader.style.display = 'none';
        wrapper.style.paddingLeft = '0px'; 
    } else {
        backBtn.classList.add('active');
        const pos = getVal('Back_Btn_Position', 'center').toLowerCase();
        wrapper.style.paddingLeft = (align === 'left' && pos !== 'outside') ? '45px' : '0px';
        
        if(p === 'page-items') {
            subHeader.style.display = 'flex'; 
        } else {
            subHeader.style.display = 'none';
            if(isTruthy('Level_Title_Show', true, true)) {
                if(getVal('Level_Title_Position', 'inside').toLowerCase() === 'outside') {
                    titleOutside.style.display = 'block'; titleOutside.innerText = levelTitle;
                } else {
                    titleInside.style.display = 'block'; titleInside.innerText = levelTitle;
                }
            }
        }
    }
    
    autoAdjustPadding();
    window.scrollTo({top: 0, behavior: 'instant'});
}

function goBack() { 
    if(navigationStack.length > 1) {
        navigationStack.pop(); 
        const prev = navigationStack[navigationStack.length-1];
        let titleToRestore = '';
        if(prev === 'page-categories') {
            const firstMatch = fullData.find(i => i.cat === document.getElementById('sub-header-title').innerText);
            if(firstMatch) titleToRestore = firstMatch.macro;
        }
        showPage(prev, titleToRestore);
    }
}

init();
