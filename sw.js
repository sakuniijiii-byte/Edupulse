const VERSION = 'edupulse-v4';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const SHELL_FILES = ['./', './index.html', './manifest.json', './practice-metrics.js'];

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

async function injectPracticeMetrics(response) {
  if (!response || !response.headers.get('content-type')?.includes('text/html')) return response;

  const html = await response.text();
  if (/\bsrc=["'][^"']*practice-metrics\.js(?:[?#][^"']*)?["']/i.test(html)) {
    return new Response(html, { status: response.status, statusText: response.statusText, headers: response.headers });
  }

  const script = '<script src="./practice-metrics.js" defer></script>';
  const updatedHtml = /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `${script}\n</body>`)
    : `${html}\n${script}`;
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(updatedHtml, { status: response.status, statusText: response.statusText, headers });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    event.respondWith(
      networkFirst(req, SHELL)
        .catch(() => caches.match('./index.html'))
        .then(injectPracticeMetrics)
    );
    return;
  }
  if (url.pathname.endsWith('/practice-metrics.js')) {
    event.respondWith(networkFirst(req, SHELL));
    return;
  }
  if (url.hostname === 'raw.githubusercontent.com') {
    event.respondWith(networkFirst(req, RUNTIME));
    return;
  }
  event.respondWith(staleWhileRevalidate(req, RUNTIME));
});
