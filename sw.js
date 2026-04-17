const CACHE_NAME = 'menu-v11.7';

// File core (rimossi i file opzionali che potrebbero bloccare l'installazione se mancanti)
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Usiamo un ciclo per evitare che un singolo file mancante blocchi tutto
      return Promise.allSettled(ASSETS.map(asset => cache.add(asset)));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Strategia semplice: prova rete, se fallisce usa cache
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
