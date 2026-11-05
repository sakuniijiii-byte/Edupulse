const VERSION = 'edupulse-v6';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const SHELL_FILES = ['./', './index.html', './manifest.json', './practice-metrics.js', './practice-enhancements.js', './study-tools-ui.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

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

async function injectPracticeScripts(response) {
  if (!response || !response.headers.get('content-type')?.includes('text/html')) return response;
  let html = await response.text();
  const scripts = [
    ['practice-metrics.js', '<script src="./practice-metrics.js" defer></script>'],
    ['practice-enhancements.js', '<script src="./practice-enhancements.js" defer></script>'],
    ['study-tools-ui.js', '<script src="./study-tools-ui.js" defer></script>']
  ];
  scripts.forEach(([file, tag]) => {
    const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const loaded = new RegExp(`\\bsrc=["'][^"']*${escaped}(?:[?#][^"']*)?["']`, 'i').test(html);
    if (!loaded) html = /<\/body>/i.test(html)
      ? html.replace(/<\/body>/i, `${tag}\n</body>`)
      : `${html}\n${tag}`;
  });
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    event.respondWith(
      networkFirst(req, SHELL)
        .catch(() => caches.match('./index.html'))
        .then(injectPracticeScripts)
    );
    return;
  }
  if (['practice-metrics.js', 'practice-enhancements.js', 'study-tools-ui.js'].some(file => url.pathname.endsWith(`/${file}`))) {
    event.respondWith(networkFirst(req, SHELL));
    return;
  }
  if (url.hostname === 'raw.githubusercontent.com') {
    event.respondWith(networkFirst(req, RUNTIME));
    return;
  }
  event.respondWith(staleWhileRevalidate(req, RUNTIME));
});
