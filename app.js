// ==========================================
// CONFIGURAZIONE MASTER
// Metti qui l'ID del tuo foglio Google di Test. 
// Verrà usato se apri il sito senza un link specifico.
const DEFAULT_SHEET_ID = '1Z1kHnCjL...INSERISCI_QUI_IL_TUO_ID_VERO...'; 
// ==========================================

// Estrazione ID Cliente dal Link (es: sito.com/?id=1A2B3C...)
const urlParams = new URLSearchParams(window.location.search);
const sheetId = urlParams.get('id') || DEFAULT_SHEET_ID;

// Elementi DOM principali
const macroSection = document.getElementById("macro-section");
const dishesSection = document.getElementById("dishes-section");
const btnBack = document.getElementById("btn-back");

// --- MOTORE DATI: FETCH DINAMICO DEL CSV ---
async function caricaMenuDalCSV() {
  if (!sheetId || sheetId === '1Z1kHnCjL...INSERISCI_QUI_IL_TUO_ID_VERO...') {
    dishesSection.innerHTML = "<p style='text-align:center; padding:20px;'>Devi inserire un ID valido nel file app.js o nell'URL.</p>";
    return;
  }

  const dynamicCsvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;

  try {
    const response = await fetch(dynamicCsvUrl); 
    if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);
    
    const csvTesto = await response.text();
    const menuDati = convertiCSVInJSON(csvTesto);
    generaHTMLPiatti(menuDati);
    
    // Assicuriamoci che all'avvio i piatti siano nascosti e si veda solo la home
    goBack(); 
  } catch (error) {
    console.error("Errore fatale:", error);
    dishesSection.innerHTML = "<p style='text-align:center; padding:20px;'>Impossibile caricare il menu. Controlla che il foglio sia condiviso pubblicamente.</p>";
  }
}

function convertiCSVInJSON(csvText) {
  const righe = csvText.split(/\r\n|\n/);
  if (righe.length < 2) return [];
  const headers = parseCSVLine(righe[0]);
  const risultato = [];

  for (let i = 1; i < righe.length; i++) {
    if (!righe[i].trim()) continue;
    const valori = parseCSVLine(righe[i]);
    const oggettoPiatto = {};
    headers.forEach((header, index) => {
      oggettoPiatto[header.trim()] = valori[index] ? valori[index].trim() : "";
    });
    risultato.push(oggettoPiatto);
  }
  return risultato;
}

function parseCSVLine(testo) {
  let risultati = [''], i = 0, p = '', s = true;
  for (let l = testo.length; i < l; i++) {
    let c = testo[i];
    if (c === '"') { s = !s; if (p === '"') { risultati[risultati.length - 1] += '"'; p = '-'; } else p = c; } 
    else if (c === ',' && s) { c = ''; risultati.push(''); p = c; } 
    else { risultati[risultati.length - 1] += c; p = c; }
  }
  return risultati;
}

function generaHTMLPiatti(datiMenu) {
  dishesSection.innerHTML = '';

  datiMenu.forEach(piatto => {
    if (piatto.Attivo && piatto.Attivo.toUpperCase() === "NO") return;

    const isGF = (piatto['Senza Glutine'] && piatto['Senza Glutine'].toUpperCase() === "SI") ? "true" : "false";
    const isVeg = (piatto.Vegetariano && piatto.Vegetariano.toUpperCase() === "SI") ? "true" : "false";
    const isNA = (piatto.Analcolico && piatto.Analcolico.toUpperCase() === "SI") ? "true" : "false";

    const allergeniTesto = piatto.Allerg_IT ? `Allergeni: ${piatto.Allerg_IT}` : "";
    const prezzoFormattato = piatto.Prezzo ? `€ ${piatto.Prezzo}` : "";

    const cardHTML = `
      <div class="dish-card hidden" 
           data-macro="${piatto.Macro}" 
           data-gf="${isGF}" data-veg="${isVeg}" data-na="${isNA}">
        <h3 class="dish-name">${piatto.Nome_IT}</h3>
        ${piatto.Desc_IT ? `<p class="dish-desc">${piatto.Desc_IT}</p>` : ''}
        ${allergeniTesto ? `<p class="dish-allerg">${allergeniTesto}</p>` : ''}
        <div class="dish-price">${prezzoFormattato}</div>
      </div>`;
    dishesSection.insertAdjacentHTML('beforeend', cardHTML);
  });
}

// --- LOGICA VISTE E FILTRI ---

// Funzione che scatta quando clicchi su "CIBO" o "BEVANDE"
function filtraPerMacro(macroSelezionata) {
  // 1. Nascondo i pulsantoni e mostro il tasto indietro
  macroSection.classList.add("hidden");
  btnBack.classList.remove("hidden");
  
  // 2. Mostro solo i piatti della macro scelta
  const allDishes = document.querySelectorAll(".dish-card");
  allDishes.forEach(dish => {
    if (dish.getAttribute("data-macro") === macroSelezionata) {
      dish.classList.remove("hidden-by-macro");
      dish.classList.remove("hidden"); // Rimuovo l'hidden di base
    } else {
      dish.classList.add("hidden-by-macro");
      dish.classList.add("hidden");
    }
  });
  
  // 3. Applico eventuali filtri già attivi
  applicaFiltri(); 
  
  // 4. Torno in cima alla pagina per vedere i primi piatti
  window.scrollTo({ top: 0 });
}

// Funzione del Tasto Indietro
function goBack() {
  // Mostra i pulsantoni Macro
  macroSection.classList.remove("hidden");
  // Nasconde il tasto indietro
  btnBack.classList.add("hidden");
  // Nasconde tutti i piatti
  document.querySelectorAll(".dish-card").forEach(dish => {
    dish.classList.add("hidden");
  });
}

// Filtri (Senza Glutine, Veg, Analcolico)
document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", function() {
    this.classList.toggle("active");
    applicaFiltri();
  });
});

function applicaFiltri() {
  const activeFilters = Array.from(document.querySelectorAll(".filter-btn.active")).map(btn => btn.getAttribute("data-filter"));
  
  // Seleziona solo i piatti che appartengono alla macro attualmente aperta
  const allDishes = document.querySelectorAll(".dish-card:not(.hidden-by-macro)"); 

  allDishes.forEach(dish => {
    let showDish = true;
    if (activeFilters.length > 0) {
      activeFilters.forEach(filter => {
        if (dish.getAttribute(`data-${filter}`) !== "true") showDish = false;
      });
    }
    
    // Aggiungo/Tolgo una classe specifica per i filtri, senza toccare quella delle macro
    if (showDish) {
      dish.style.display = "flex"; 
    } else {
      dish.style.display = "none";
    }
  });
}

// --- TASTO TORNA SU ---
window.onscroll = function() {
  const btnTop = document.getElementById("btn-top");
  if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
    btnTop.classList.remove("hidden");
  } else {
    btnTop.classList.add("hidden");
  }
};

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- AVVIO APP ---
document.addEventListener("DOMContentLoaded", () => {
  caricaMenuDalCSV();
});
