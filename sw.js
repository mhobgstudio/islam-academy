const CACHE_VERSION = 'v2';
const CACHE_NAME = `islam-academy-${CACHE_VERSION}`;
const ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/pages/progress.html',
  '/pages/quran-reader.html',
  '/pages/alphabet.html',
  '/pages/reading.html',
  '/pages/grammar.html',
  '/pages/vocabulary.html',
  '/pages/tajweed.html',
  '/pages/hifz.html',
  '/assets/css/academy.css',
  '/assets/css/components.css',
  '/assets/js/app.js',
  '/assets/js/nav.js',
  '/manifest.json'
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
      }).catch(() => caches.match(e.request) || caches.match('/offline.html'))
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
        }).catch(() => caches.match('/offline.html'));
      })
    );
  }
});
