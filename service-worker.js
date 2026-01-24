
const CACHE_NAME='rankapp-v2';
const ASSETS=['./','./index.html','./styles.css','./manifest.json','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('activate',e=>{ e.waitUntil((async()=>{ if('navigationPreload' in self.registration){ try{ await self.registration.navigationPreload.enable(); }catch(e){} } const keys=await caches.keys(); await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))); })()); self.clients.claim(); });
self.addEventListener('install',e=>{ e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS))); self.skipWaiting(); });
async function cacheFirst(req){ const cached=await caches.match(req,{ignoreSearch:true}); return cached||fetch(req); }
self.addEventListener('fetch',e=>{ const req=e.request; const url=new URL(req.url); if(url.pathname.endsWith('/manifest.json')||url.pathname.endsWith('/service-worker.js')){ e.respondWith(fetch(req).catch(()=>caches.match(req))); return; } if(req.mode==='navigate'){ e.respondWith((async()=>{ try{ const preload=await e.preloadResponse; if(preload) return preload; const fresh=await fetch(req); const cache=await caches.open(CACHE_NAME); cache.put(req,fresh.clone()); return fresh; }catch{ const cached=await caches.match(req,{ignoreSearch:true}); return cached||caches.match('./index.html'); } })()); return; } e.respondWith(cacheFirst(req)); });
