/* Whisky Music — minimal offline service worker */
const APP_SHELL_CACHE = 'whisky-shell-v1';
const COVER_CACHE = 'whisky-covers-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(['/', '/index.html'])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== APP_SHELL_CACHE && key !== COVER_CACHE && key !== 'whisky-covers')
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

function isCoverRequest(url) {
  try {
    const u = new URL(url);
    return (
      u.hostname === 'is1-ssl.mzstatic.com' ||
      u.hostname.endsWith('.mzstatic.com') ||
      u.hostname === 'img.youtube.com' ||
      u.hostname.endsWith('.unsplash.com')
    );
  } catch {
    return false;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (isCoverRequest(request.url)) {
    event.respondWith(
      caches.open(COVER_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
          }).catch(() => {});
          return cached;
        }
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch (err) {
          return cached || Response.error();
        }
      }),
    );
    return;
  }

  if (url.origin === self.location.origin && request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(APP_SHELL_CACHE);
        const cached = await cache.match('/index.html');
        return cached || Response.error();
      }),
    );
    return;
  }

  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/assets/') || url.pathname.endsWith('.css') || url.pathname.endsWith('.js'))
  ) {
    event.respondWith(
      caches.open(APP_SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch {
          return cached || Response.error();
        }
      }),
    );
  }
});
