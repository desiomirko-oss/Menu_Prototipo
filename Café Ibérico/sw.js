const CACHE_NAME = 'pwa-menu-v1.2';
// Lista dei file statici da blindare in cache (grafica)
const STATIC_ASSETS = [
  'index.html',
  '../style.css',
  '../app.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png'
];

// Installazione: salva la carrozzeria dell'app
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Attivazione: pulisce vecchie versioni
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
});

// Gestione richieste: Grafica veloce, Menu sempre fresco
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // REGOLA D'ORO: Se chiediamo dati a Google Sheets, NON usare la cache.
  // Vogliamo i prezzi sempre aggiornati in tempo reale.
  if (url.hostname.includes('google.com') || url.pathname.includes('gviz')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Per gli altri file (HTML/CSS/JS), usa la strategia Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
        });
        return networkResponse;
      });
      return cachedResponse || fetchPromise;
    })
  );
});
