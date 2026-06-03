/* ================================================================
   BecomeChampion — sw.js
   Service Worker for offline App Shell caching
   ================================================================ */
'use strict';

const CACHE_NAME   = 'bc-shell-v2.5.0';
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

// Fetch: cache-first for shell files, network-first for everything else
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Only handle same-origin requests (no external CDN resources)
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache newly fetched shell resources
        if (response.ok && SHELL_FILES.some(f => event.request.url.endsWith(f.replace('./', '')))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback for navigation requests
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
