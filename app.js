// --- ESTRAZIONE ID CLIENTE DAL LINK ---
// Legge l'URL, es: sito.com/?id=1A2B3C...
const urlParams = new URLSearchParams(window.location.search);
const sheetId = urlParams.get('id');

// --- LOGICA INSTALLAZIONE PWA (Stile iOS) ---
let deferredPrompt;
const iosModal = document.getElementById('ios-popup');
const installBtn = document.getElementById('ios-install-btn');
const cancelBtn = document.getElementById('ios-cancel-btn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  iosModal.classList.remove('hidden'); // Mostra il popup figo
});

installBtn.addEventListener('click', () => {
  iosModal.classList.add('hidden');
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      deferredPrompt = null;
    });
  }
});

cancelBtn.addEventListener('click', () => {
  iosModal.classList.add('hidden');
});

// --- MOTORE DATI: FETCH DINAMICO DEL CLIENTE ---
async function caricaMenuDalCSV() {
  const appContent = document.getElementById("app-content");
  const errorScreen = document.getElementById("error-screen");

  // Se l'utente apre il sito senza l'ID del cliente, mostriamo l'errore
  if (!sheetId) {
    appContent.classList.add("hidden");
    errorScreen.classList.remove("hidden");
    return;
  }

  // Costruiamo dinamicamente il link di esportazione CSV usando l'ID
  // NOTA: Il foglio deve essere impostato su "Chiunque abbia il link può leggere"
  const dynamicCsvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;

  try {
    const response = await fetch(dynamicCsvUrl); 
    if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);
    
    const csvTesto = await response.text();
    const menuDati = convertiCSVInJSON(csvTesto);
    generaHTMLPiatti(menuDati);
  } catch (error) {
    console.error("Errore fatale:", error);
    appContent.innerHTML = "<p style='text-align:center; padding:20px;'>Impossibile caricare il menu. Controlla che l'ID sia corretto e il foglio condiviso.</p>";
  }
}

// ... (QUI SOTTO LASCIA LE FUNZIONI convertiCSVInJSON, parseCSVLine, generaHTMLPiatti E LE ALTRE CHE AVEVAMO SCRITTO PRIMA) ...

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
  const container = document.getElementById("dishes-section");
  container.innerHTML = '';

  datiMenu.forEach(piatto => {
    if (piatto.Attivo && piatto.Attivo.toUpperCase() === "NO") return;

    const isGF = (piatto['Senza Glutine'] && piatto['Senza Glutine'].toUpperCase() === "SI") ? "true" : "false";
    const isVegan = (piatto.Vegano && piatto.Vegano.toUpperCase() === "SI") ? "true" : "false";
    const isVeg = (piatto.Vegetariano && piatto.Vegetariano.toUpperCase() === "SI") ? "true" : "false";
    const isNA = (piatto.Analcolico && piatto.Analcolico.toUpperCase() === "SI") ? "true" : "false";

    const allergeniTesto = piatto.Allerg_IT ? `Allergeni: ${piatto.Allerg_IT}` : "";
    const prezzoFormattato = piatto.Prezzo ? `€ ${piatto.Prezzo}` : "";

    const cardHTML = `
      <div class="dish-card hidden-by-macro" 
           data-macro="${piatto.Macro}" 
           data-gf="${isGF}" data-vegan="${isVegan}" data-veg="${isVeg}" data-na="${isNA}">
        <h3 class="dish-name">${piatto.Nome_IT}</h3>
        ${piatto.Desc_IT ? `<p class="dish-desc">${piatto.Desc_IT}</p>` : ''}
        ${allergeniTesto ? `<p class="dish-allerg">${allergeniTesto}</p>` : ''}
        <div class="dish-price">${prezzoFormattato}</div>
      </div>`;
    container.insertAdjacentHTML('beforeend', cardHTML);
  });
}

// --- LOGICA FILTRI E VISTE ---
function filtraPerMacro(macroSelezionata) {
  document.getElementById("btn-back").style.display = "block"; // Mostra tasto indietro
  
  const allDishes = document.querySelectorAll(".dish-card");
  allDishes.forEach(dish => {
    if (dish.getAttribute("data-macro") === macroSelezionata) {
      dish.classList.remove("hidden-by-macro");
    } else {
      dish.classList.add("hidden-by-macro");
    }
  });
  applicaFiltri(); // Riapplica i filtri (es. Veg) sulla nuova vista
}

document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", function() {
    this.classList.toggle("active");
    applicaFiltri();
  });
});

function applicaFiltri() {
  const activeFilters = Array.from(document.querySelectorAll(".filter-btn.active")).map(btn => btn.getAttribute("data-filter"));
  const allDishes = document.querySelectorAll(".dish-card:not(.hidden-by-macro)"); // Filtra solo quelli visibili nella Macro attuale

  allDishes.forEach(dish => {
    let showDish = true;
    if (activeFilters.length > 0) {
      activeFilters.forEach(filter => {
        if (dish.getAttribute(`data-${filter}`) !== "true") showDish = false;
      });
    }
    if (showDish) dish.classList.remove("hidden-by-filter");
    else dish.classList.add("hidden-by-filter");
  });
}

// --- LOGICA PULSANTI NAVIGAZIONE ---
window.onscroll = function() {
  const btnTop = document.getElementById("btn-top");
  if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) btnTop.style.display = "block";
  else btnTop.style.display = "none";
};

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goBack() {
  // Nasconde tutto e torna alla vista Macro principale
  document.querySelectorAll(".dish-card").forEach(dish => dish.classList.add("hidden-by-macro"));
  document.getElementById("btn-back").style.display = "none";
}

// --- INIZIALIZZAZIONE ---
document.addEventListener("DOMContentLoaded", () => {
  caricaMenuDalCSV();
});
