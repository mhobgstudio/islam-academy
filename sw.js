/* ISLAM ACADEMY — service worker
 *
 * Design notes
 * ------------
 * - BASE is the registration scope, so the same file works at a domain root
 *   and inside a GitHub Pages repository sub-path.
 * - install uses Promise.allSettled, not cache.addAll. addAll is atomic: one
 *   404 anywhere in the list rejects the whole install and the site silently
 *   loses offline support forever.
 * - Data is precached, not just fetched. A cache-first strategy for data that
 *   was never stored means the first offline visit fails on every page.
 * - Recitation/WBW audio is deliberately NOT cached. Those are megabytes of
 *   third-party media; the player already degrades to silence offline.
 */
const VERSION = 'v9';
const CACHE = `islam-academy-${VERSION}`;
const BASE = new URL('./', self.location.href).href;

// The app shell. Anything that fails to fetch is skipped, not fatal.
const SHELL = [
  './',
  'index.html',
  'offline.html',
  'manifest.json',
  'assets/css/academy.css',
  'assets/css/components.css',
  'assets/css/responsive.css',
  'assets/js/app.js',
  'assets/js/nav.js',
  'assets/icons/icon.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable.png',
  'assets/fonts/AmiriQuran-Regular.ttf',
  'assets/fonts/NotoNaskhArabic.ttf',
  'assets/images/hero-mosque.jpg',
  'pages/alphabet.html',
  'pages/reading.html',
  'pages/grammar.html',
  'pages/vocabulary.html',
  'pages/quran-reader.html',
  'pages/tajweed.html',
  'pages/hifz.html',
  'pages/progress.html',
  'pages/search.html',
  'pages/books.html',
];

// Curriculum and Quran text. Without these the app renders nothing offline.
const DATA = [
  'data/curriculum/alphabet.json',
  'data/curriculum/levels.json',
  'data/curriculum/decks.json',
  'data/curriculum/tajweed.json',
  'data/curriculum/root-lexicon.json',
  'data/quran/surah_meta.json',
  'data/quran/juz_map.json',
  'data/quran/uthmani.json',
  'data/quran/translation_en.json',
  'data/quran/words.json',
  'data/quran/word-roots.json',
  // Headword occurrence counts for the Progress page's coverage estimate.
  'data/quran/word-freq.json',
  // All 604 Madinah mushaf page layouts, vendored so the Mushaf view is offline.
  'data/quran/mushaf-pages.json',
];

const ALL = SHELL.concat(DATA).map((p) => new URL(p, BASE).href);

// Large third-party payloads. Cached opportunistically, never precached.
const RUNTIME = /^https:\/\/(cdn\.islamic\.network|verses\.quran\.com|raw\.githubusercontent\.com)\//;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.allSettled(ALL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE && k.startsWith('islam-academy-'))
            .map((k) => caches.delete(k))
      ))
      // Take over open tabs immediately so a deploy does not need two reloads.
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

function offlineResponse(request) {
  // A JSON consumer must not be handed an HTML page: r.json() would throw
  // with a confusing "unexpected token <" instead of a clean 503.
  const isJson = (request.headers.get('accept') || '').includes('json') ||
                 /\.json(\?|$)/.test(new URL(request.url).pathname);
  if (isJson) {
    return new Response('{"error":"offline","detail":"This data set is not cached yet."}', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (request.mode === 'navigate') {
    return caches.match(new URL('offline.html', BASE).href)
      .then((r) => r || Response.error());
  }
  return Response.error();
}

// Navigation missed the cache while offline. Redirect to the offline page so
// its relative asset paths (assets/css, assets/js, nav links) resolve against
// its own directory instead of the deep requested URL. Guards against a loop
// when the offline page itself is not cached.
function offlineFallback(request) {
  const offlineUrl = new URL('offline.html', BASE).href;
  let reqUrl = request.url;
  try { reqUrl = new URL(request.url).href; } catch (e) {}
  if (reqUrl !== offlineUrl) return Response.redirect(offlineUrl, 302);
  return offlineResponse(request);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Opaque cross-origin responses cannot be inspected or replayed reliably.
  if (req.mode === 'no-cors') return;

  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !RUNTIME.test(req.url)) return;

  // 1) Navigations: cache-first on the shell so a cold offline start works,
  //    with a network refresh in the background.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => null);
        return cached || network.then((res) => res || offlineFallback(req));
      })
    );
    return;
  }

  // 2) Runtime third-party media: cache-first, and never block on it.
  if (!sameOrigin) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => Response.error()))
    );
    return;
  }

  // 3) Same-origin assets and data: cache-first, then fill the cache. The
  //    service worker owns updates, which is what skipWaiting/clients.claim
  //    plus the CACHE bump are for.
  event.respondWith(
    caches.match(req, { ignoreSearch: false }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => offlineResponse(req));
    })
  );
});
