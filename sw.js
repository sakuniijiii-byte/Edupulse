/* EduPulse PRO service worker — preserves the single-file app and offline content. */
'use strict';

const VERSION = 'edupulse-v12-android';
const SHELL = VERSION + '-shell';
const RUNTIME = VERSION + '-runtime';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.all(SHELL_FILES.map(async file => {
      try { await cache.add(file); } catch (error) { console.warn('[EduPulse SW] shell asset skipped:', file, error); }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // Delete only older EduPulse caches. Never clear caches belonging to other apps.
    await Promise.all(keys.filter(key => key.startsWith('edupulse-') && !key.startsWith(VERSION)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request, cacheName, cacheKey = request) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request).then(async response => {
    if (response && (response.ok || response.type === 'opaque')) await cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Never cache authentication, Supabase data, AI prompts/responses, or API calls.
  if (/supabase\.co$/.test(url.hostname) ||
      /generativelanguage\.googleapis\.com$/.test(url.hostname) ||
      /api\.tavily\.com$/.test(url.hostname) ||
      (sameOrigin && (/^\/(api|auth|rest|storage|functions)(\/|$)/.test(url.pathname)))) return;

  if (request.mode === 'navigate' && sameOrigin) {
    event.respondWith(networkFirst(request, SHELL, './index.html').catch(async () => {
      const cache = await caches.open(SHELL);
      return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
    }));
    return;
  }

  // The app's question/content loader uses raw GitHub files; retain these for offline study.
  if (url.hostname === 'raw.githubusercontent.com') {
    event.respondWith(networkFirst(request, RUNTIME));
    return;
  }

  // Cache only known static CDNs, not arbitrary third-party API traffic.
  const staticHosts = new Set([
    'cdn.tailwindcss.com',
    'cdnjs.cloudflare.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'esm.sh'
  ]);
  if (!sameOrigin && !staticHosts.has(url.hostname)) return;

  if (sameOrigin || staticHosts.has(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME));
  }
});
