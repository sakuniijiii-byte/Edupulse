/* The page registers this worker as ./sw.js?v=<EP_BUILD>, so every new build gets its own cache
   and the old one is deleted on activate. Falls back to a fixed name if no build id is given. */
const BUILD = (() => { try { return new URL(self.location.href).searchParams.get('v') || ''; } catch (e) { return ''; } })();
const VERSION = 'edupulse-' + (BUILD ? BUILD.replace(/[^a-zA-Z0-9._-]/g, '') : 'v12');
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const SHELL_FILES = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => Promise.all(
      /* cache: 'reload' skips the browser/CDN HTTP cache so the shell is never an old copy */
      SHELL_FILES.map((f) => c.add(new Request(f, { cache: 'reload' })).catch(() => null))
    ))
  );
});

/* A new worker waits until the page asks for it (Update button) instead of force-reloading every open tab. */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Page loads: always ask the server first (revalidating past the HTTP cache); use the cached copy only when offline. */
async function pageNetworkFirst(request) {
  const cache = await caches.open(SHELL);
  try {
    const fresh = await fetch(request, { cache: 'no-cache' });
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    return (await cache.match(request)) || (await cache.match('./index.html')) || (await cache.match('./'));
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    if (fresh && (fresh.ok || fresh.type === 'opaque')) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin && (url.pathname.startsWith('/api/') || url.pathname === '/auth/callback')) return;

  if (req.mode === 'navigate') {
    event.respondWith(pageNetworkFirst(req));
    return;
  }
  if (url.hostname === 'raw.githubusercontent.com') {
    event.respondWith(networkFirst(req, RUNTIME));
    return;
  }
  event.respondWith(staleWhileRevalidate(req, RUNTIME));
});
