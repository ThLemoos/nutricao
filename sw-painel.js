const CACHE_NAME = 'painel-alice-v1';
const ASSETS = [
    '/pages/painel.html',
    '/css/style.css',
    '/css/painel.css',
    '/css/plano.css',
    '/js/script.js',
    '/js/painel.js',
    '/js/firebase.js',
    '/img/icon-192.png',
    '/img/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // não mexe em requests pro Firebase — sempre precisa ser rede, nunca cache
    if (event.request.url.includes('firestore.googleapis.com') ||
        event.request.url.includes('identitytoolkit.googleapis.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
});