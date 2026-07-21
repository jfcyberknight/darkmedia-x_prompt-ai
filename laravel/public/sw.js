// Réécrit à chaque déploiement (bump de version) : changer les octets de sw.js
// force le navigateur à installer le nouveau service worker, dont l'activation
// purge l'ancien cache. Sans ça, la PWA installée reste figée sur une vieille
// version (nom de cache constant = SW jamais considéré comme mis à jour).
const CACHE_NAME = 'prompt-ai-v2.0.0';
const ASSETS = [
  '/',
  '/style.css',
  '/app.js',
  '/favicon.svg',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // L'API et l'authentification ne doivent jamais être servies depuis le cache
  // (données dynamiques + cookies de session).
  if (url.origin === self.location.origin &&
      (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/'))) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in the background to update the cache (stale-while-revalidate)
        fetch(e.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
          }
        }).catch(() => { /* offline or fetch blocked */ });
        return cachedResponse;
      }

      return fetch(e.request).then((networkResponse) => {
        if (networkResponse.status === 200) {
          // Only cache same-origin assets or Google Fonts
          if (url.origin === self.location.origin || url.hostname.includes('fonts.gstatic.com') || url.hostname.includes('fonts.googleapis.com')) {
            // Clone synchronously — the response body is consumed once we return it below,
            // so cloning inside the async caches.open() callback would throw
            // "Response body is already used".
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseToCache));
          }
        }
        return networkResponse;
      });
    })
  );
});
