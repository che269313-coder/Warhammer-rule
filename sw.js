/* ================================================================
   BecomeChampion — sw.js
   Service Worker for offline App Shell caching
   ================================================================ */
'use strict';

const CACHE_NAME   = 'bc-shell-v2.5.1';
const SHELL_FILES  = [
  './',
  './index.html',
  './style.css',
  './sample-pack.js',
  './builtin-packs.js',
  './app.js',
  './icon.svg',
  './manifest.json',
];

// Install: pre-cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

// Activate: delete old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first — always try network, fall back to cache when offline
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request).then(response => {
      // Update cache with fresh response
      if (response.ok && SHELL_FILES.some(f => event.request.url.endsWith(f.replace('./', '')))) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => {
      // Offline: try cache, then fallback for navigation
      return caches.match(event.request).then(cached => {
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
