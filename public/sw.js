const CACHE_NAME = 'salon-staff-pwa-v3';
const PRECACHE_ASSETS = [
  '/',
  '/login.html',
  '/employee-dashboard',
  '/manifest.webmanifest',
  '/salon-logo.png',
  '/admin-nav.css',
  '/admin-nav.js',
  '/auth-guard.js',
  '/app-boot.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Network first for all HTML pages and API requests
  if (req.mode === 'navigate' || req.url.includes('/api/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && req.method === 'GET') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/login.html')))
    );
    return;
  }

  // Cache first for static assets with background network update
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && req.method === 'GET' && req.url.startsWith(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      });
    })
  );
});
