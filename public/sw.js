// Service Worker for Salon Portal PWA - Force Cache Busting v2
const CACHE_NAME = 'salon-pwa-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Always fetch fresh network copies for pages, scripts and styles
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
