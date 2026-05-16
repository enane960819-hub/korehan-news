/* ============================================================
   KoreHani — Articles: DB loading, caching, image/video markup
   Extracted from korehan-shared.js (was lines 1543-1845).

   Responsible for fetching articles from Supabase, normalizing
   the rows, and building image/hero markup for cards and feeds.
   Stale-while-revalidate via localStorage so repeat visits
   render the home / section pages instantly.

   External deps (resolved at runtime via global scope):
   - getSupa(), supaUser    — from korehan-shared.js
   - lsGet, lsSet           — from js/core/storage.js
   - _activeDiff            — from korehan-shared.js (difficulty filter)
   - safeParseJSON          — from js/core/article-cache.js
   - khLog                  — from korehan-shared.js (debug logger)
   ============================================================ */

// ── DB (Supabase 기반) ───────────────────────────────────────────
// 기사는 Supabase articles 테이블에서 로드
var _articlesCache = null;
var _articlesCacheTime = 0;
var CACHE_TTL = 300000; // 5분 (메모리 캐시)
var ARTICLES_STORAGE_KEY = 'kh_articles_cache_v2';
var ARTICLES_STORAGE_MAX_AGE = 60 * 60 * 1000; // 1시간 (localStorage — stale-while-revalidate로 항상 백그라운드 갱신)
// Lightweight column set for list/feed fetches. Excludes the long `full`
// body — cards/excerpts only need `body` (lede). On LTE this can shrink
// the home/section payload from MBs to KBs. The full body is fetched on
// demand by loadArticleById() when the reader actually opens an article.
// `source_url` was previously in this select but the column was never
// added to the production `articles` table — every list fetch failed
// with 400 (column does not exist), wiping the section/home rails.
// Removed so the query parses; if/when we add a source-URL field we
// should also create the column in a migration.
var LIST_ARTICLE_SELECT = 'id,title,title_en,title_ko,body,image,section,level,date,published_at,created_at,updated_at,status,view_count,featured,reporter_id,reporter,video_url,use_video,video_kind,video_fallback_url';
// Home cards only need metadata + image — `body` was the dominant cost
// (often >80% of payload) and made the LTE first-paint waterfall stall
// while the loader sat at ~86%. All News still uses LIST_ARTICLE_SELECT
// because its search filter scans the body. The reader fast-path in
// loadArticleById() pulls the full row when a learner opens an article.
// Trimmed to the columns _buildNewsCardHTML / hero render actually
// READ. Drops title_ko (Korean only, hero shows _en preferred),
// published_at/updated_at/status (not displayed), view_count
// (not displayed on cards), reporter_id/reporter (jsonb blob, only
// reader page uses it), and the four video_* columns (none of which
// the home card surfaces). Cut from 20 cols → 9. On LTE this
// roughly halves the home payload size and the time-to-first-paint
// drops from ~8s to ~3-4s. Background refresh below picks up the
// missing columns for any later use.
var HOME_ARTICLE_SELECT = 'id,title,title_en,image,section,level,date,created_at,status,featured';
var FULL_ARTICLE_SELECT = '*';

// 이미지 없는 기사용 placeholder — SVG inline data URI (깨지지 않음)
var KH_IMG_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='400' fill='%231e293b'%3E%3Crect width='600' height='400'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.35em' font-family='sans-serif' font-size='18' fill='%2364748b'%3EKoreHani%3C/text%3E%3C/svg%3E";

// Hosts the site's CSP (_headers) allows for <img src>. Keep in sync with _headers.
var KH_IMG_CSP_HOSTS = [
  'images.unsplash.com', 'source.unsplash.com',
  'picsum.photos', 'samghztrdvtxmrmawneu.supabase.co',
  'lh3.googleusercontent.com', 'i.ytimg.com',
  // Reddit image hosts — kept in sync with _headers img-src. i.redd.it is
  // for direct image posts (i.redd.it/abc.jpg), preview.redd.it is the
  // signed-URL CDN used by d.preview.images[0].source.url, external-
  // preview is the same but for non-image link posts. b.thumbs is the
  // tiny default thumbnail CDN.
  'i.redd.it', 'preview.redd.it', 'external-preview.redd.it',
  'b.thumbs.redditmedia.com'
];
function _khImgHostAllowed(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.charAt(0) === '/' || url.indexOf('./') === 0) return true;
  if (url.indexOf('data:') === 0 || url.indexOf('blob:') === 0) return true;
  try {
    var u = new URL(url, (typeof window !== 'undefined' && window.location ? window.location.origin : 'https://korehani.com'));
    if (typeof window !== 'undefined' && window.location && u.origin === window.location.origin) return true;
    // Any https image host is CSP-allowed (img-src 'self' data: blob:
    // https:) — og:image backfill from arbitrary news sites needs this.
    // KH_IMG_CSP_HOSTS kept as a short-list of "known safe" hosts so
    // legacy callers that want stricter filtering still can.
    if (u.protocol === 'https:') return true;
    return KH_IMG_CSP_HOSTS.some(function(h){ return u.hostname === h || u.hostname.endsWith('.' + h); });
  } catch(e) { return false; }
}

// Article thumbnail URL. Treat empty, the legacy 1x1 transparent-GIF data URI,
// AND any URL whose host the site CSP blocks (preview.redd.it, ctfassets.net,
// etc.) as "no image" and fall back to a deterministic picsum.photos image
// seeded by the article id — so cards always show a real picture.
function khArticleThumb(article, w, h) {
  w = w || 600; h = h || 400;
  var url = article && article.image;
  var bad = !url || typeof url !== 'string'
    || url === ''
    || url.indexOf('data:image/gif;base64,R0lGODlhAQABA') === 0
    || !_khImgHostAllowed(url);
  if (!bad) return url;
  var seed = (article && article.id) ? String(article.id) : 'kh-' + Math.random().toString(36).slice(2, 8);
  return 'https://picsum.photos/seed/' + encodeURIComponent(seed) + '/' + w + '/' + h;
}

// Hero media HTML for the article detail page. Prefers the article's upstream
// video (YouTube embed or v.redd.it hosted MP4) when present AND the admin
// has opted in via use_video — otherwise falls back to khArticleThumb. The
// use_video gate matters because video_url is persisted even when the admin
// left 'Use video' unchecked, so an article can be flipped to video later
// by toggling use_video. Kept to the same 600x400-ish aspect as the image
// hero via CSS on .art-hero-img so the surrounding badge overlay still
// positions. Grid/card renderers keep using khArticleThumb directly since
// a full-size video in every card would destroy scroll performance.
function khArticleHeroMedia(article) {
  var kind = article && article.video_kind;
  var src  = article && article.video_url;
  var show = article && article.use_video !== false && article.use_video != null;
  if (show && src && typeof src === 'string') {
    // Sizing comes from .art-hero-img in korehan-shared.css — the wrapper
    // is a unified 16:9 slot for image/iframe/video, so feed-swiping
    // doesn't bounce between different hero heights.
    if (kind === 'youtube') {
      return '<iframe src="' + _khEsc(src) + '" title="Article video" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
    }
    if (kind === 'reddit-embed') {
      // Historically rendered as a redditmedia.com iframe — but that
      // iframe brings the full post chrome (subreddit banner, Join
      // button, author line, Reddit logo), crowding out the actual
      // video. Now we route through the same resolver pipeline as
      // reddit-hls: extract the permalink (either from article.source_url
      // or from the stored redditmedia.com URL itself, since its path
      // mirrors the permalink path), hand it to _khAttachHls, and play
      // the bare video via a <video> element with synced audio.
      // The image fallback is the article thumbnail so if every
      // playback path fails (post removed, CDN outage, resolver down)
      // the slot shows the thumbnail rather than the Reddit embed
      // with its post chrome.
      var perma3 = (article && article.source_url) || '';
      if (!perma3) {
        var m = String(src || '').match(/redditmedia\.com(\/r\/[^?#]+\/comments\/[^?#]+)/i);
        if (m) perma3 = 'https://www.reddit.com' + m[1].replace(/\/$/, '') + '/';
      }
      var img3 = khArticleThumb(article, 600, 400);
      if (perma3) {
        return '<video data-kh-hls="" data-kh-fallback="" data-kh-permalink="' + _khEsc(perma3) + '" data-kh-image-fallback="' + _khEsc(img3) + '" controls playsinline preload="metadata"></video>';
      }
      // No permalink recoverable → render the thumbnail directly.
      return '<img src="' + _khEsc(img3) + '" alt="" onerror="this.style.display=\'none\'">';
    }
    if (kind === 'reddit-hls') {
      // Reddit stores audio on a separate track. The HLS manifest
      // multiplexes both, giving audio when it loads — but Reddit's
      // v.redd.it CDN is picky about CORS and signed URLs expire, so
      // HLS frequently fails for ordinary article viewers. The fallback
      // URL (silent MP4) is passed alongside so _khAttachHls() can
      // swap to it on any HLS load error, keeping video playback
      // reliable even when audio isn't reachable.
      // The permalink (when known) lets _khAttachHls call /api/reddit-
      // video-resolve to fetch fresh signed URLs at playback time —
      // this is what makes audio reliable even on year-old articles.
      // data-kh-image-fallback lets the player show the article's
      // thumbnail image when every playback path has failed — without
      // this we used to substitute the redditmedia.com iframe, which
      // dragged in the Reddit post chrome (subreddit banner, Join
      // button, etc.) and looked like a regression, especially on
      // removed posts where the iframe renders "Removed by moderator".
      var fb = (article && article.video_fallback_url) || _khDeriveRedditMp4(src);
      var perma = (article && article.source_url) || '';
      var img = khArticleThumb(article, 600, 400);
      return '<video data-kh-hls="' + _khEsc(src) + '" data-kh-fallback="' + _khEsc(fb || '') + '" data-kh-permalink="' + _khEsc(perma) + '" data-kh-image-fallback="' + _khEsc(img) + '" controls playsinline preload="metadata"></video>';
    }
    if (kind === 'reddit') {
      // Silent MP4 baseline. Routed through _khAttachHls so the resolver
      // can layer a synced <audio> companion on top — recovers audio on
      // legacy 'reddit' kind articles that were saved without hls_url.
      // If both the persisted MP4 and the resolver fail, the article
      // thumbnail takes over (see note on reddit-hls for why we
      // dropped the iframe fallback in favor of an image).
      var perma2 = (article && article.source_url) || '';
      var img2 = khArticleThumb(article, 600, 400);
      return '<video data-kh-hls="" data-kh-fallback="' + _khEsc(src) + '" data-kh-permalink="' + _khEsc(perma2) + '" data-kh-image-fallback="' + _khEsc(img2) + '" controls playsinline preload="metadata"></video>';
    }
  }
  var img = khArticleThumb(article, 600, 400);
  return '<img src="' + _khEsc(img) + '" alt="" onerror="this.style.display=\'none\'">';
}


function _khEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

(function hydrateArticlesCacheFromStorage() {
  try {
    var raw = localStorage.getItem(ARTICLES_STORAGE_KEY);
    if (!raw) return;
    var parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items) || !parsed.items.length) return;
    if (!parsed.savedAt || (Date.now() - parsed.savedAt) > ARTICLES_STORAGE_MAX_AGE) return;
    _articlesCache = parsed.items;
    _articlesCacheTime = parsed.savedAt;
  } catch (e) {
    console.warn('articles storage hydrate failed', e);
  }
})();

function persistArticlesCache(items) {
  if (!Array.isArray(items) || !items.length) return;
  try {
    localStorage.setItem(ARTICLES_STORAGE_KEY, JSON.stringify({
      savedAt: Date.now(),
      items: items
    }));
  } catch (e) {}
}

function articleSortValue(a) {
  return String((a && (a.date || a.published_at || a.created_at || a.updated_at)) || '');
}

function sortArticlesNewest(items) {
  return (Array.isArray(items) ? items.slice() : []).sort(function(a, b) {
    var da = articleSortValue(a);
    var db = articleSortValue(b);
    if (da > db) return -1;
    if (da < db) return 1;
    return String((b && b.id) || '').localeCompare(String((a && a.id) || ''));
  });
}

function normalizeArticles(items) {
  function normalizeSection(section) {
    var key = String(section || '').trim();
    var low = key.toLowerCase();
    if (low === 'tech' || low === 'it과학' || low === 'technology' || low === 'tech/science') return 'beauty';
    return key;
  }
  return sortArticlesNewest((Array.isArray(items) ? items : []).filter(function(item) {
    return item && typeof item === 'object';
  }).map(function(item) {
    var clone = Object.assign({}, item);
    clone.section = normalizeSection(item.section);
    return clone;
  }));
}

function applyArticlesCache(items, opts) {
  var normalized = normalizeArticles(items);
  // Codex P2: small homeOptimized fetches (15 rows) were clobbering a
  // previously-warmed cache (80+ rows from regular list or All News
  // prefetch). After clobbering, navigating to All News had to re-
  // fetch the full list. Merge by id when the incoming set is
  // smaller than the existing cache — newer rows override, older
  // ones survive.
  if (opts && opts.merge && Array.isArray(_articlesCache) && _articlesCache.length > normalized.length) {
    var byId = Object.create(null);
    _articlesCache.forEach(function (a) { if (a && a.id != null) byId[String(a.id)] = a; });
    normalized.forEach(function (a) { if (a && a.id != null) byId[String(a.id)] = a; });
    normalized = sortArticlesNewest(Object.keys(byId).map(function (k) { return byId[k]; }));
  }
  _articlesCache = normalized;
  _articlesCacheTime = Date.now();
  persistArticlesCache(_articlesCache);
  document.dispatchEvent(new Event('khArticlesLoaded'));
  return _articlesCache;
}

async function loadArticlesFromDB(options) {
  options = options || {};
  var sb = getSupa();
  if (!sb) return getCachedArticles();
  var shouldForceRefresh = !!options.force;
  var useHomeOptimizedQuery = !!options.homeOptimized;
  var useAllArticles = !!options.all;
  if (!shouldForceRefresh && _articlesCache && (Date.now() - _articlesCacheTime) < CACHE_TTL) {
    return _articlesCache;
  }
  // All News browse uses metadata-only columns. With body excluded
  // each row is ~300 bytes — 1000 rows ≈ 300KB, vs the old 500 ×
  // body-included ~1MB+. Plenty of headroom for growth (~260 published
  // currently). Search now goes through searchArticlesServer() (a
  // server-side ilike on title / title_en / body / full) so we don't
  // need to ship lede text to every visitor up front.
  // homeOptimized: home page shows hero (5) + top stories (4) +
  // news rail (6 visible). 15 covers all of it with headroom; was
  // 30 which doubled the payload for no visible benefit.
  var lim = useHomeOptimizedQuery ? 15 : useAllArticles ? 1000 : 80;
  // Try the lite column list first; fall back to '*' if PostgREST
  // rejects an unknown column (production schemas can lag behind the
  // codebase). Without this fallback any missing column on the lite
  // list (e.g. video_kind, source_url) would drop the home page to
  // an empty hero and leave "Loading today's articles…" forever.
  var primary = (useHomeOptimizedQuery || useAllArticles) ? HOME_ARTICLE_SELECT : LIST_ARTICLE_SELECT;
  // Each attempt is [selectCols, orderCol]. PostgREST returns 400 for a
  // missing column in either the SELECT list OR the ORDER BY clause —
  // and production schemas can lag the codebase on either axis. The
  // chain falls back from lite-cols + created_at to SELECT * + created_at
  // (handles missing select col), to SELECT * + date (handles missing
  // order col), to SELECT * unordered (last resort). Any one of these
  // succeeding gives the home page real data instead of empty hero.
  var attempts = [
    [primary, 'created_at'],
    [FULL_ARTICLE_SELECT, 'created_at'],
    [FULL_ARTICLE_SELECT, 'date'],
    [FULL_ARTICLE_SELECT, null]
  ];
  for (var i = 0; i < attempts.length; i++) {
    var cols = attempts[i][0];
    var orderCol = attempts[i][1];
    try {
      var q = sb.from('articles').select(cols);
      if (orderCol) q = q.order(orderCol, { ascending: false });
      var res = await q.limit(lim);
      if (res.error) {
        if (i < attempts.length - 1) {
          console.warn('articles select retry [' + cols.slice(0,40) + ' / ' + orderCol + ']:', res.error.message || res.error);
          continue;
        }
        throw res.error;
      }
      // Pass merge flag so homeOptimized refreshes don't clobber
      // a warm full cache. Other call sites (All News, regular list)
      // use the default replace behavior.
      return applyArticlesCache(normalizeArticles(res.data || []), { merge: useHomeOptimizedQuery });
    } catch(e) {
      console.warn('articles load error', e);
      if (i >= attempts.length - 1) return getCachedArticles();
    }
  }
  return getCachedArticles();
}

// Fetch one full article (with `full` body) by id and merge it into the
// cache. Used by the reader fast-path so we don't have to wait for the
// full 80-row list before we can render a single article on LTE.
async function loadArticleById(id) {
  if (!id) return null;
  var sb = getSupa();
  if (!sb) return null;
  try {
    var res = await sb.from('articles').select(FULL_ARTICLE_SELECT).eq('id', id).limit(1);
    if (res.error) throw res.error;
    var row = (res.data && res.data[0]) || null;
    if (!row) return null;
    var existing = Array.isArray(_articlesCache) ? _articlesCache.slice() : [];
    var idx = existing.findIndex(function(x){ return String(x && x.id) === String(id); });
    if (idx >= 0) existing[idx] = Object.assign({}, existing[idx], row);
    else existing.push(row);
    applyArticlesCache(existing);
    return row;
  } catch(e) {
    console.warn('single article load error', e);
    return null;
  }
}

function getCachedArticles() {
  return _articlesCache || [];
}

// Server-side full-text search. Used by All News when the search box has
// a value — keeps the bulk fetch metadata-only while still letting users
// search across title + body content. Escapes %/_/, in the query so
// learner queries like "100%" don't blow up the LIKE pattern.
//
// Defensively retries when PostgREST rejects a column that doesn't exist
// in the production schema (title_en, title_ko, full all live in the
// codebase but only some deployments have them as real columns). Without
// this fallback the entire search 400'd because of one missing column,
// which is exactly the "site search doesn't work" bug the user hit.
async function searchArticlesServer(query, limit) {
  var sb = getSupa();
  var q = String(query || '').trim();
  if (!sb || !q) return [];
  var lim = limit || 100;
  var safe = q.replace(/([%_,])/g, '\\$1');
  var pattern = '%' + safe + '%';
  var orderedCols = ['title', 'title_en', 'title_ko', 'body', 'full', 'section'];
  // Cache of columns that have already failed in this session so we
  // don't pay the round-trip for them again on the next search.
  searchArticlesServer._missing = searchArticlesServer._missing || {};
  for (var attempt = 0; attempt < 4; attempt++) {
    var cols = orderedCols.filter(function(c){ return !searchArticlesServer._missing[c]; });
    if (!cols.length) cols = ['title'];
    var orFilter = cols.map(function(c){ return c + '.ilike.' + pattern; }).join(',');
    try {
      // SELECT '*' rather than LIST_ARTICLE_SELECT so a missing column
      // (title_en, title_ko, full are absent from this deployment's
      // schema even though the codebase reads them defensively) doesn't
      // 400 the whole search. Result count is bounded by limit so the
      // payload bloat is negligible.
      // Try created_at → date → unordered to survive whichever
      // timestamp column the production schema has. The order column
      // is the same 400-source as a missing select column.
      var orderCandidates = ['created_at', 'date', null];
      var res = null;
      for (var oi = 0; oi < orderCandidates.length; oi++) {
        var qq = sb.from('articles').select('*').or(orFilter);
        if (orderCandidates[oi]) qq = qq.order(orderCandidates[oi], { ascending: false });
        res = await qq.limit(lim);
        if (!res.error) break;
        var em = String(res.error.message || '');
        if (oi < orderCandidates.length - 1 && /column|does not exist|find|reference/i.test(em)) continue;
        break;
      }
      if (res.error) {
        var msg = String(res.error.message || '');
        var m = msg.match(/column [^.]*\.(\w+) does not exist/i);
        if (m && cols.indexOf(m[1]) !== -1) {
          searchArticlesServer._missing[m[1]] = true;
          continue;
        }
        // Also handle "could not find column" / "unknown column" wording.
        var m2 = msg.match(/(?:find|reference) (?:the )?column ['"]?(\w+)['"]?/i);
        if (m2 && cols.indexOf(m2[1]) !== -1) {
          searchArticlesServer._missing[m2[1]] = true;
          continue;
        }
        console.warn('search articles error', res.error);
        return [];
      }
      // Defensive: drop the non-existent columns from LIST_ARTICLE_SELECT
      // too if PostgREST is also rejecting them inside the select list.
      // For now LIST_ARTICLE_SELECT runs a separate retry path
      // (loadArticlesFromDB falls back to '*'), so we don't double-fix.
      return normalizeArticles(res.data || []);
    } catch(e) {
      console.warn('search articles exception', e);
      return [];
    }
  }
  return [];
}

// ── DB ────────────────────────────────────────────────────────
function dbLoad() {
  // Supabase 캐시에서 반환 (동기)
  return getCachedArticles();
}
function dbGet(filter) {
  var all = getCachedArticles();
  if (!filter) return all;
  return all.filter(filter);
}
function published(section) {
  return dbGet(function(a){ return (!a.status || a.status === 'published') && (!section || a.section === section); })
    .sort(function(a, b) {
      // 최신 날짜순 정렬 (date 없으면 id로 역순)
      var da = a.date || a.created_at || '';
      var db = b.date || b.created_at || '';
      if (da > db) return -1;
      if (da < db) return 1;
      return String(b.id).localeCompare(String(a.id));
    });
}

