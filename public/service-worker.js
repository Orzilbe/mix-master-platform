const CACHE_VERSION = 'v6';
const CACHE_NAME = `mix-master-static-${CACHE_VERSION}`;
const STATIC_ASSETS = [
  '/offline.html',
  '/logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function shouldNeverCache(url) {
  return url.pathname.startsWith('/api/')
    || url.pathname === '/join'
    || url.pathname === '/profile'
    || url.pathname === '/edit-avatar'
    || url.pathname === '/display'
    || url.pathname === '/leaderboard';
}

function isCacheableStatic(url) {
  return url.origin === self.location.origin && (
    url.pathname.startsWith('/_next/static/')
    || url.pathname.startsWith('/icons/')
    || url.pathname === '/logo.png'
    || url.pathname === '/offline.html'
  );
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (shouldNeverCache(url)) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/offline.html'))
    );
    return;
  }

  if (isCacheableStatic(url)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(fetch(event.request));
});
