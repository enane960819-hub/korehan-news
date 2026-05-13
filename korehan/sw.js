// KoreHani Service Worker
//
// Strategy per request class:
//
//   HTML navigations + same-origin CSS/JS → network-first, cache fallback
//     Eliminates the "old version flash" where a fresh HTML painted
//     against stale cached CSS/JS for one frame before the new bundles
//     arrived. Now HTML, CSS, and JS are always fetched fresh when
//     online and only fall back to cache when offline.
//
//   Fonts / images → stale-while-revalidate
//     Cheap to serve from cache, rarely change catastrophically.
//
//   Supabase / API / Anthropic / CDN calls → network-only
//     Auth tokens and live data must never be served from cache.
//
// Version bump: change CACHE_VERSION whenever the SW logic itself
// changes. Install event will build a fresh cache under the new name
// and the activate event will delete stale caches.

// v10: bump after the grammar-enforcement deploy. Some users were
// stuck with stale v9 shared.js cached against fresh HTML, and the
// resulting mismatch broke logged-in state (regular browser showed
// "Sign in / Join Free" while incognito worked fine — classic stale-
// SW symptom). v10 + skipWaiting + clients.claim drops the old SW
// and caches in one tab-close cycle.
//
const CACHE_VERSION = 'kh-v11';
const STATIC_CACHE = CACHE_VERSION + '-static';
const PAGE_CACHE   = CACHE_VERSION + '-pages';

// Pre-cache just the core shell — everything else fills in lazily on
// first use so the install step is fast even on 3G.
const CORE_ASSETS = [
  '/korehan-shared.css',
  '/korehan-shared.js',
];

self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function(cache) {
      return cache.addAll(CORE_ASSETS).catch(function(){ /* best effort */ });
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(function(keys) {
        return Promise.all(keys.map(function(k) {
          if (k.indexOf(CACHE_VERSION) !== 0) return caches.delete(k);
        }));
      }),
    ])
  );
});

function isCodeAsset(url) {
  // CSS/JS get network-first treatment so a fresh HTML never paints
  // against a stale stylesheet/script (which caused the "old version
  // flashes for ~1s" bug). Cache only as offline fallback.
  if (url.origin !== self.location.origin) return false;
  return /\.(css|js)(\?|$)/i.test(url.pathname);
}
function isMediaAsset(url) {
  // Fonts and images are safe to stale-serve.
  if (url.origin !== self.location.origin) return false;
  return /\.(woff2?|ttf|otf|png|jpg|jpeg|webp|svg|ico)(\?|$)/i.test(url.pathname);
}
function isHTMLNavigation(request, url) {
  if (request.mode === 'navigate') return true;
  if (url.origin !== self.location.origin) return false;
  return /\.html(\?|$)/i.test(url.pathname) || url.pathname.endsWith('/');
}

self.addEventListener('fetch', function(event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // Never touch auth, DB, AI, or external CDN traffic — always hit
  // the network. Caching a Supabase response could serve a stale
  // auth token or a frozen daily feed to the next learner on the
  // device.
  const NET_ONLY_HOSTS = /supabase\.co|anthropic\.com|openai\.com|reddit\.com|v\.redd\.it|redditmedia\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|speech\.platform\.bing\.com/i;
  if (NET_ONLY_HOSTS.test(url.host)) return;

  // Same-origin API proxies (/api/*) and the like — also pass through.
  if (url.origin === self.location.origin && /^\/api\//.test(url.pathname)) return;

  if (isCodeAsset(url)) {
    event.respondWith(networkFirstPage(req, STATIC_CACHE));
    return;
  }
  if (isMediaAsset(url)) {
    event.respondWith(staleWhileRevalidate(req, STATIC_CACHE));
    return;
  }
  if (isHTMLNavigation(req, url)) {
    event.respondWith(networkFirstPage(req, PAGE_CACHE));
    return;
  }
});

function staleWhileRevalidate(req, cacheName) {
  return caches.open(cacheName).then(function(cache) {
    return cache.match(req).then(function(cached) {
      const networkFetch = fetch(req).then(function(res) {
        if (res && res.status === 200) cache.put(req, res.clone()).catch(function(){});
        return res;
      }).catch(function() { return cached; });
      return cached || networkFetch;
    });
  });
}

function networkFirstPage(req, cacheName) {
  return fetch(req).then(function(res) {
    if (res && res.status === 200) {
      const clone = res.clone();
      caches.open(cacheName).then(function(cache) { cache.put(req, clone).catch(function(){}); });
    }
    return res;
  }).catch(function() {
    return caches.open(cacheName).then(function(cache) {
      return cache.match(req).then(function(cached) {
        if (cached) return cached;
        // Last-resort offline shell: return a minimal HTML payload so
        // the learner sees an "offline" message rather than the
        // browser's default failed-load page.
        return new Response(
          '<!doctype html><meta charset="utf-8"><title>Offline — KoreHani</title>' +
          '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#0b1626;color:#fff}' +
          '.wrap{max-width:340px;text-align:center;padding:24px}h1{font-size:20px;margin:0 0 8px}p{color:rgba(255,255,255,.6);font-size:14px;line-height:1.5;margin:0 0 18px}button{padding:10px 22px;border:0;border-radius:999px;background:#fff;color:#0b1626;font-weight:800;cursor:pointer}</style>' +
          '<div class="wrap"><h1>You’re offline</h1><p>We couldn’t load this page and don’t have it cached. Try reconnecting, or open an article you’ve already visited.</p><button onclick="location.reload()">Retry</button></div>',
          { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      });
    });
  });
}
