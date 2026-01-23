
const CACHE_NAME = 'solo-v4';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Enable navigation preload + cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    if ('navigationPreload' in self.registration) {
      try { await self.registration.navigationPreload.enable(); } catch {}
    }
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
  })());
  self.clients.claim();
});

// Pre-cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

// Helpers
async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  return cached || fetch(request);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Always fetch fresh for manifest and SW itself
  if (url.pathname.endsWith('/manifest.json') || url.pathname.endsWith('/service-worker.js')) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Navigations: network-first with offline fallback
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preload = await event.preloadResponse;
        if (preload) return preload;
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(req, { ignoreSearch: true });
        return cached || caches.match('./index.html');
      }
    })());
    return;
  }

  // Other static assets: cache-first
  event.respondWith(cacheFirst(req));
});
