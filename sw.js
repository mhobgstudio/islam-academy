const CACHE_VERSION = 'v3';
const CACHE_NAME = `islam-academy-${CACHE_VERSION}`;

// Base path for the site, derived from this service worker's registration scope.
// Works for both a GitHub Pages subpath (e.g. /some-repo/) and a root domain (/).
const BASE = self.registration.scope;

const ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'offline.html',
  BASE + 'manifest.json',
  BASE + 'pages/progress.html',
  BASE + 'pages/quran-reader.html',
  BASE + 'pages/alphabet.html',
  BASE + 'pages/reading.html',
  BASE + 'pages/grammar.html',
  BASE + 'pages/vocabulary.html',
  BASE + 'pages/tajweed.html',
  BASE + 'pages/hifz.html',
  BASE + 'assets/css/academy.css',
  BASE + 'assets/css/components.css',
  BASE + 'assets/js/app.js',
  BASE + 'assets/js/nav.js'
];

// Install: cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME && k.startsWith('islam-academy-'))
        .map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Fetch: network-first for data, cache-first for static
self.addEventListener('fetch', e => {
  if (e.request.url.includes('/data/') || e.request.url.includes('cdn.')) {
    e.respondWith(
      fetch(e.request).then(r => {
        const clone = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return r;
      }).catch(() => caches.match(e.request) || caches.match(BASE + 'offline.html'))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then(r => {
        if (r) return r;
        return fetch(e.request).then(resp => {
          if (!resp || resp.status !== 200 || resp.type === 'opaque') return resp;
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return resp;
        }).catch(() => caches.match(BASE + 'offline.html'));
      })
    );
  }
});
