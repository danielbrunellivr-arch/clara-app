const CACHE_NAME = 'clara-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app2.js',
  '/manifest.json'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Non cachare le chiamate API
  if (e.request.url.includes('supabase') || e.request.url.includes('anthropic') || e.request.url.includes('workers.dev')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
