// KoreHani Service Worker
//
// Keeps the app usable on flaky connections (subway, plane) and gives
// articles the learner has already opened a second chance if the
// Supabase fetch stalls. Strategy per request class:
//
//   static shell (CSS/JS/fonts/images) → stale-while-revalidate
//     The user sees the cached version immediately and the new one
//     lands in the background for the next visit. Safe because these
//     assets carry Cache-Control: no-cache but rarely change
//     catastrophically.
//
//   HTML navigations (korehan-*.html) → network-falling-back-to-cache
//     Serves fresh when online, falls back to the last successful
//     cache copy when offline so bookmarks still open.
//
//   Supabase / API / Anthropic / CDN calls → network-only
//     Auth tokens, live data, and streaming responses must never be
//     served from cache. We explicitly skip these to avoid stale
//     session tokens or frozen feeds.
//
// Version bump: change CACHE_VERSION whenever the SW logic itself
// changes. Install event will build a fresh cache under the new name
// and the activate event will delete stale caches.

// Bump when shipping JS/CSS that older clients have cached. v2 was
// chosen when the grammar-tooltip module shipped — staleWhileRevalidate
// was serving the old korehan-shared.js without the auto-loader, so
// users who'd visited before never picked up the new module.
const CACHE_VERSION = 'kh-v2';
const STATIC_CACHE = CACHE_VERSION + '-static';
const PAGE_CACHE   = CACHE_VERSION + '-pages';

// Pre-cache just the core shell — everything else fills in lazily on
// first use so the install step is fast even on 3G.
const CORE_ASSETS = [
  '/korehan/korehan-shared.css',
  '/korehan/korehan-shared.js',
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

function isSameOriginStatic(url) {
  if (url.origin !== self.location.origin) return false;
  return /\.(css|js|woff2?|ttf|otf|png|jpg|jpeg|webp|svg|ico)(\?|$)/i.test(url.pathname);
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

  if (isSameOriginStatic(url)) {
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
