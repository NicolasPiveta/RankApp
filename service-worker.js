
const CACHE_NAME = 'solo-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Ativa navigation preload quando suportado (ganha performance)
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    if ('navigationPreload' in self.registration) {
      try { await self.registration.navigationPreload.enable(); } catch {}
    }
    // Limpa caches antigos
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
  })());
  self.clients.claim();
});

// Pré-cache básico
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Helper: pega do cache primeiro
async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  return cached || fetch(request);
}

// Helper: rede primeiro com fallback cache (bom para HTML)
async function networkFirst(request) {
  try {
    // Se navigation preload trouxe algo, use
    const preload = await eventPreloadResponse();
    if (preload) return preload;

    const fresh = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    // Opcional: só cacheia navegação e index
    if (request.mode === 'navigate' || request.url.endsWith('/index.html')) {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    // Fallback offline
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    // Último recurso: devolve index.html para manter o app abrindo
    return caches.match('./index.html');
  }
}

// Tenta usar a resposta do navigation preload, se houver
async function eventPreloadResponse() {
  // Essa função precisa do event atual, vamos pegá-lo via escopo de fetch
  return null; // será resolvido dentro do handler de fetch
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Sempre pegar manifest e o próprio SW da REDE (evita manifesto antigo)
  const url = new URL(request.url);
  const isManifest = url.pathname.endsWith('/manifest.json');
  const isServiceWorker = url.pathname.endsWith('/service-worker.js');
  if (isManifest || isServiceWorker) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // Navegações (HTML): network-first com fallback cache
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        // Usa navigation preload se estiver disponível
        const preload = await event.preloadResponse;
        if (preload) return preload;

        const fresh = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(request, { ignoreSearch: true });
        return cached || caches.match('./index.html');
      }
    })());
    return;
  }

  // Demais recursos estáticos: cache-first
  event.respondWith(cacheFirst(request));
});
