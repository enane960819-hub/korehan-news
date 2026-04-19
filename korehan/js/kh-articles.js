/* kh-articles.js — Article loading, rendering, hero carousel */
function articleUrl(id) {
  return 'korehan-article.html?id=' + encodeURIComponent(id);
}

// ── SEED DATA ─────────────────────────────────────────────────
// ── DB (Supabase 기반) ───────────────────────────────────────────
// 기사는 Supabase articles 테이블에서 로드
var _articlesCache = null;
var _articlesCacheTime = 0;
var CACHE_TTL = 300000; // 5분
var ARTICLES_STORAGE_KEY = 'kh_articles_cache_v2';
var ARTICLES_STORAGE_MAX_AGE = 5 * 60 * 1000; // 5분
var HOME_ARTICLE_SELECT = '*';

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

function applyArticlesCache(items) {
  _articlesCache = normalizeArticles(items);
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
  if (!shouldForceRefresh && _articlesCache && (Date.now() - _articlesCacheTime) < CACHE_TTL) {
    return _articlesCache;
  }
  try {
    // Always order by created_at descending so newest articles are fetched first.
    // Without ORDER BY the DB returns rows in an arbitrary order, meaning a
    // limit(18) could miss recently published articles entirely.
    var query = sb.from('articles').select(HOME_ARTICLE_SELECT).order('created_at', { ascending: false });
    if (useHomeOptimizedQuery) {
      query = query.limit(60);  // was 18 — increased so fresh articles are not cut off
    } else {
      query = query.limit(200);
    }
    var res = await query;
    if (res.error) throw res.error;
    return applyArticlesCache(normalizeArticles(res.data || []));
  } catch(e) {
    console.warn('articles load error', e);
    return getCachedArticles();
  }
}

function getCachedArticles() {
  return _articlesCache || [];
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

// ── HTML 생성 헬퍼 ────────────────────────────────────────────
function relTime(dateStr) {
  if (!dateStr) return '';
  try {
    var diff = Date.now() - new Date(dateStr + 'T00:00:00').getTime();
    var h = Math.floor(diff / 3600000);
    if (h < 1)  return 'Just now';
    if (h < 24) return h + 'h ago';
    var d = Math.floor(h / 24);
    return d + 'd ago';
  } catch(e) { return ''; }
}

function cardHTML(a, extraTagClass) {
  var img = khArticleThumb(a, 600, 400);
  var tc  = extraTagClass || '';
  var levelColors = { 'Starter':'#f3e8ff;color:#6b21a8', 'Beginner':'#e8f5e9;color:#2e7d32', 'Intermediate':'#fff8e1;color:#f57f17', 'Advanced':'#fce4ec;color:#c62828' };
  var levelBadge = a.level ? '<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;background:' + (levelColors[a.level] || '#f0f0f0;color:#666') + '">' + ({Starter:'Seed',Beginner:'Sprout',Intermediate:'Tree',Advanced:'Forest'}[a.level]||a.level) + '</span>' : '';
  return '<a href="' + articleUrl(a.id) + '" style="color:inherit;text-decoration:none;">'
    + '<div class="card">'
    + '<img src="' + img + '" alt="" loading="lazy" onerror="this.src=\'https://picsum.photos/seed/fallback/600/400\'">'
    + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'
    + '<div class="tag' + (tc ? ' ' + tc : '') + '">' + a.section + '</div>'
    + levelBadge
    + '</div>'
    + '<h3 class="vocab-zone">' + a.title + '</h3>'
    + '<p class="vocab-zone">' + (a.body || '') + '</p>'
    + '<div class="meta">' + relTime(a.date) + '</div>'
    + '</div></a>';
}

// 난이도 필터 (메인 페이지)
function filterByLevel(level, btn) {
  document.querySelectorAll('.level-filter-btn').forEach(function(b){ b.classList.remove('on'); });
  if (btn) btn.classList.add('on');
  var all = published();
  var featured = all.find(function(a){ return a.featured; }) || all[0];
  var rest = all.filter(function(a){ return !featured || a.id !== featured.id; });
  if (level !== 'All') rest = rest.filter(function(a){ return a.level === level; });
  var topEl = document.getElementById('dyn-top-stories');
  if (topEl) topEl.innerHTML = rest.slice(0, 4).map(function(a){ return cardHTML(a); }).join('') || '<p style="color:#aaa;padding:20px 0">No ' + level + ' articles yet.</p>';
}

function storyItemHTML(a) {
  var img = khArticleThumb(a, 300, 200);
  return '<a href="' + articleUrl(a.id) + '" style="color:inherit;text-decoration:none;">'
    + '<div class="story-item">'
    + '<img src="' + img + '" alt="" loading="lazy" onerror="this.src=\'https://picsum.photos/seed/fallback/300/200\'">'
    + '<div>'
    + '<h4 class="vocab-zone">' + a.title + '</h4>'
    + '<div class="meta">' + a.section + ' · ' + relTime(a.date) + '</div>'
    + '</div></div></a>';
}

function heroSideItemHTML(a) {
  var img = khArticleThumb(a, 400, 200);
  return '<a href="' + articleUrl(a.id) + '" style="color:inherit;text-decoration:none;display:block;">'
    + '<div class="hero-side-item">'
    + '<img src="' + img + '" alt="" loading="lazy" onerror="this.src=\'https://picsum.photos/seed/fallback/400/200\'">'
    + '<h3 class="vocab-zone">' + a.title + '</h3>'
    + '<p class="meta">' + a.section + ' · ' + relTime(a.date) + '</p>'
    + '</div></a>';
}

// ── 페이지 렌더러 ─────────────────────────────────────────────

var _heroSlides = [];
var _heroIdx = 0;
var _heroTimer = null;
var _heroTouchStartX = 0;
var _heroTouchDeltaX = 0;

function renderHomePage() {
  var all      = published();
  // featured 기사 (최대 7개 - featured 먼저, 나머지 최신순)
  var featured = all.filter(function(a){ return a.featured; });
  if (!featured.length) featured = all.slice(0, 7);
  else {
    var featIds = new Set(featured.map(function(a){ return a.id; }));
    var extra = all.filter(function(a){ return !featIds.has(a.id); });
    featured = featured.concat(extra).slice(0, 7);
  }
  _heroSlides = featured;
  _heroIdx = 0;

  var rest = all.filter(function(a){
    var heroIds = new Set(featured.map(function(f){ return f.id; }));
    return !heroIds.has(a.id);
  });
  window._heroStaticSide = rest.slice(0, 4);

  // HERO
  var heroEl = document.getElementById('dyn-hero');
  if (heroEl && featured.length) {
    heroEl.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:0;align-items:stretch;border-radius:18px;overflow:hidden;box-shadow:0 14px 50px rgba(13,27,46,.18);background:#fff;';
    renderHeroSlide(heroEl);
    resetHeroTimer();
  }

  // TOP STORIES
  var topEl = document.getElementById('dyn-top-stories');
  if (topEl) topEl.innerHTML = rest.slice(0, 4).map(function(a){ return cardHTML(a); }).join('');

  // SECTION BLOCKS
  var sectionsEl = document.getElementById('dyn-sections');
  if (sectionsEl) {
    var sections = [
      { key:'사회', label:'Society', href:'korehan-society.html' },
      { key:'국제', label:'World',   href:'korehan-world.html'   },
      { key:'문화', label:'Culture', href:'korehan-culture.html' },
    ];
    sectionsEl.innerHTML = sections.map(function(s) {
      var arts = published(s.key).slice(0, 3);
      if (!arts.length) return '';
      return '<div style="margin:24px 0 8px">'
        + '<div class="section-title" style="display:flex;justify-content:space-between;align-items:center">'
        + s.label
        + '<a href="' + s.href + '" style="font-size:13px;font-weight:600;color:#2255a4;text-decoration:none">See all →</a>'
        + '</div>'
        + '<div class="card-grid">' + arts.map(function(a){ return cardHTML(a); }).join('') + '</div>'
        + '</div>';
    }).join('');
  }

  // LATEST
  var latestEl = document.getElementById('dyn-latest');
  if (latestEl) latestEl.innerHTML = all.slice(0, 8).map(storyItemHTML).join('');

  // OPINIONS
  var opinionsEl = document.getElementById('dyn-opinions');
  if (opinionsEl) {
    var ops = getOpinions();
    if (ops.length) {
      opinionsEl.innerHTML = ops.map(function(op){
        return '<div class="opinion-card">'
          + '<div class="author-img"><img src="' + (op.img || 'https://picsum.photos/seed/auth/100/100') + '" alt="' + (op.name||'') + '" onerror="this.src=\'https://picsum.photos/seed/auth/100/100\'"></div>'
          + '<div class="author">' + (op.name||'') + '</div>'
          + '<div class="author-title">' + (op.title||'') + '</div>'
          + '<h4 class="vocab-zone">' + (op.headline||'') + '</h4>'
          + '</div>';
      }).join('');
    }
  }
}

function renderHeroSlide(heroEl) {
  if (!heroEl || !_heroSlides.length) return;
  var heroSignature = _heroSlides.map(function(item){ return item.id; }).join(',');
  if (heroEl.dataset.heroBuilt !== '1' || heroEl.dataset.heroCount !== String(_heroSlides.length) || heroEl.dataset.heroSignature !== heroSignature) {
    heroEl.dataset.heroBuilt = '1';
    heroEl.dataset.heroCount = String(_heroSlides.length);
    heroEl.dataset.heroSignature = heroSignature;
    heroEl.innerHTML =
      '<div class="kh-home-hero-main-shell" style="position:relative;min-height:460px;overflow:hidden;background:#0b1626;touch-action:pan-y">'
      + '<div class="kh-home-hero-track" style="display:flex;height:100%;will-change:transform;transition:transform .72s cubic-bezier(.22,1,.36,1)">' + _heroSlides.map(function(item){
          var featImg = khArticleThumb(item, 900, 500);
          var featBody = (item.body || '').replace(/<[^>]*>/g, '').slice(0, 150);
          var url = articleUrl(item.id);
          return '<article class="kh-home-hero-slide" style="min-width:100%;position:relative;min-height:460px;overflow:hidden;cursor:pointer" onclick="location.href=\'' + url + '\'">'
            + '<img src="' + featImg + '" alt="" onerror="this.src=\'https://picsum.photos/seed/fallback/900/500\'" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;pointer-events:none;">'
            + '<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(5,15,35,.88) 0%,rgba(5,15,35,.55) 38%,rgba(5,15,35,.16) 100%),linear-gradient(to top,rgba(5,15,35,.92) 0%,rgba(5,15,35,.1) 58%,transparent 100%);pointer-events:none;"></div>'
            + '<div style="position:absolute;left:0;right:0;bottom:0;padding:34px 30px 30px;max-width:760px;z-index:2;pointer-events:none;">'
            + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><span class="category-tag" style="display:inline-block">' + item.section + '</span><span style="font-size:12px;color:rgba(255,255,255,.65)">' + relTime(item.date) + '</span></div>'
            + '<h1 class="vocab-zone" style="font-family:\'Playfair Display\',serif;font-size:clamp(26px,3vw,42px);font-weight:900;line-height:1.18;margin:0 0 12px;color:#fff">' + item.title + '</h1>'
            + '<p style="font-size:14px;color:rgba(255,255,255,.8);line-height:1.7;margin:0;max-width:62ch">' + featBody + '</p>'
            + '</div></article>';
        }).join('') + '</div>'
      + (_heroSlides.length > 1 ? '<button type="button" class="kh-hero-nav prev" onclick="event.stopPropagation();heroPrev()" aria-label="Previous hero article" style="position:absolute;left:16px;top:50%;transform:translateY(-50%);z-index:4;width:46px;height:46px;border:none;border-radius:999px;background:rgba(7,14,28,.44);backdrop-filter:blur(12px);color:#fff;font-size:22px;font-weight:800;cursor:pointer;box-shadow:0 14px 28px rgba(0,0,0,.24);transition:transform .18s,background .18s">‹</button><button type="button" class="kh-hero-nav next" onclick="event.stopPropagation();heroNext()" aria-label="Next hero article" style="position:absolute;right:16px;top:50%;transform:translateY(-50%);z-index:4;width:46px;height:46px;border:none;border-radius:999px;background:rgba(7,14,28,.44);backdrop-filter:blur(12px);color:#fff;font-size:22px;font-weight:800;cursor:pointer;box-shadow:0 14px 28px rgba(0,0,0,.24);transition:transform .18s,background .18s">›</button>' : '')
      + '<div class="kh-home-hero-dots" style="position:absolute;left:30px;bottom:24px;z-index:4;display:flex;gap:7px"></div>'
      + '</div>'
      + '<aside style="background:linear-gradient(180deg,#fff 0%,#f8fbff 100%);display:flex;flex-direction:column;border-left:1px solid #e7eef8;">'
      + '<div style="padding:18px 18px 12px;border-bottom:1px solid #edf2f7">'
      + '<div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8">More to explore</div>'
      + '<div style="font-size:18px;font-weight:900;color:#0f172a;margin-top:4px">News</div>'
      + '</div>'
      + '<div id="kh-home-hero-side"></div>'
      + '<div style="padding:16px"><a href="korehan-all.html" style="display:block;text-align:center;padding:11px 14px;border-radius:999px;background:#0f172a;color:#fff;font-size:13px;font-weight:800;text-decoration:none">Browse all news →</a></div>'
      + '</aside>';
    attachHeroInteractions(heroEl);
  }
  updateHeroSlideUI(heroEl);
}

function heroGoTo(idx) {
  if (!_heroSlides.length) return;
  _heroIdx = (idx + _heroSlides.length) % _heroSlides.length;
  var heroEl = document.getElementById('dyn-hero');
  if (heroEl) updateHeroSlideUI(heroEl);
  resetHeroTimer();
}

function heroPrev() { heroGoTo(_heroIdx - 1); }
function heroNext() { heroGoTo(_heroIdx + 1); }

function resetHeroTimer() {
  if (_heroTimer) clearInterval(_heroTimer);
  if (_heroSlides.length > 1) {
    _heroTimer = setInterval(function(){ heroNext(); }, 5200);
  }
}

function updateHeroSlideUI(heroEl) {
  if (!heroEl) return;
  var track = heroEl.querySelector('.kh-home-hero-track');
  if (track) track.style.transform = 'translate3d(-' + (_heroIdx * 100) + '%,0,0)';
  var dotsWrap = heroEl.querySelector('.kh-home-hero-dots');
  if (dotsWrap) {
    dotsWrap.innerHTML = _heroSlides.map(function(_, i){
      return '<button type="button" aria-label="Go to hero slide ' + (i + 1) + '" onclick="event.stopPropagation();heroGoTo(' + i + ')" style="width:' + (i===_heroIdx?'26':'8') + 'px;height:8px;border-radius:999px;border:none;background:' + (i===_heroIdx?'#fff':'rgba(255,255,255,.35)') + ';cursor:pointer;transition:all .28s"></button>';
    }).join('');
  }
  var sideWrap = document.getElementById('kh-home-hero-side');
  if (sideWrap) {
    var sideItems = (window._heroStaticSide && window._heroStaticSide.length ? window._heroStaticSide : _heroSlides.filter(function(a, i){ return i !== _heroIdx; })).slice(0, 4);
    sideWrap.innerHTML = sideItems.map(function(a) {
      var img = khArticleThumb(a, 400, 200);
      return '<a href="' + articleUrl(a.id) + '" style="display:flex;gap:12px;padding:14px 16px;text-decoration:none;color:inherit;border-bottom:1px solid #edf2f7;transition:background .15s" onmouseover="this.style.background=\'#f2f7ff\'" onmouseout="this.style.background=\'\'">'
        + '<img src="' + img + '" alt="" onerror="this.src=\'https://picsum.photos/seed/fallback/200/120\'" style="width:98px;height:78px;object-fit:cover;border-radius:14px;flex-shrink:0;box-shadow:0 6px 18px rgba(15,23,42,.08)">'
        + '<div style="min-width:0;flex:1">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px"><span style="font-size:10px;font-weight:800;color:#2255a4;letter-spacing:.06em;text-transform:uppercase">' + a.section + '</span><span style="font-size:10px;color:#94a3b8">' + relTime(a.date) + '</span></div>'
        + '<div class="vocab-zone" style="font-size:13px;font-weight:800;color:#0f172a;line-height:1.45;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">' + a.title + '</div>'
        + '</div></a>';
    }).join('');
  }
}

function attachHeroInteractions(heroEl) {
  var shell = heroEl && heroEl.querySelector('.kh-home-hero-main-shell');
  if (!shell || shell.dataset.bound === '1') return;
  shell.dataset.bound = '1';
  shell.addEventListener('touchstart', function(evt){
    _heroTouchStartX = evt.touches && evt.touches[0] ? evt.touches[0].clientX : 0;
    _heroTouchDeltaX = 0;
  }, { passive: true });
  shell.addEventListener('touchmove', function(evt){
    if (!evt.touches || !evt.touches[0]) return;
    _heroTouchDeltaX = evt.touches[0].clientX - _heroTouchStartX;
  }, { passive: true });
  shell.addEventListener('touchend', function(){
    if (Math.abs(_heroTouchDeltaX) < 42) return;
    if (_heroTouchDeltaX < 0) heroNext();
    else heroPrev();
    _heroTouchStartX = 0;
    _heroTouchDeltaX = 0;
  });
}

function buildArticleRowHTML(a) {
  var levelColors = {Starter:'background:#f3e8ff;color:#6b21a8',Beginner:'background:#e8f5e9;color:#2e7d32',Intermediate:'background:#fff8e1;color:#f57f17',Advanced:'background:#fce4ec;color:#c62828'};
  var lvlStyle = levelColors[a.level] || 'background:#f0f4ff;color:#1a3a6b';
  var aImg = khArticleThumb(a, 400, 220);
  var fallback = 'https://picsum.photos/seed/' + a.id + 'x/400/220';
  var aBody = (a.body || '').replace(/<[^>]*>/g, '').slice(0, 90);
  return '<a href="' + articleUrl(a.id) + '" style="color:inherit;text-decoration:none;display:block;margin-bottom:20px;">'
    + '<div class="article-row">'
    + '<img src="' + aImg + '" alt="" onerror="this.src=\'' + fallback + '\'" style="width:220px;height:140px;object-fit:cover;border-radius:10px;flex-shrink:0;">'
    + '<div class="article-info">'
    + '<span class="category-tag" style="font-size:11px;padding:2px 8px;' + lvlStyle + '">' + (a.level ? ({Starter:'Seed',Beginner:'Sprout',Intermediate:'Tree',Advanced:'Forest'}[a.level]||a.level) : (a.section || '')) + '</span>'
    + '<h2 class="article-title vocab-zone" style="margin:8px 0 6px;font-size:18px;">' + a.title + '</h2>'
    + '<p class="article-excerpt vocab-zone" style="font-size:14px;color:#64748b;line-height:1.6">' + aBody + '</p>'
    + '<div style="font-size:12px;color:#94a3b8;margin-top:6px">' + relTime(a.date) + '</div>'
    + '</div></div></a>';
}

function buildHeroHTML(featured, rest) {
  var fallback = 'https://picsum.photos/seed/fallback/900/500';
  var img = khArticleThumb(featured, 900, 500);
  var body = (featured.body || '').replace(/<[^>]*>/g, '').slice(0, 120);
  return '<a href="' + articleUrl(featured.id) + '" style="color:inherit;text-decoration:none;">'
    + '<div class="hero-main">'
    + '<img src="' + img + '" alt="" onerror="this.src=\'' + fallback + '\'">'
    + '<div class="overlay">'
    + '<span class="category-tag">' + (featured.section || '') + '</span>'
    + '<h1 class="vocab-zone">' + featured.title + '</h1>'
    + '<p class="sub vocab-zone">' + body + '</p>'
    + '</div></div></a>'
    + '<div class="hero-side">' + rest.slice(0, 4).map(heroSideItemHTML).join('') + '</div>';
}

async function renderSectionPage(section) {
  // 페이지 타이틀/배너
  var secInfo = getSections().find(function(s){ return s.key === section; });
  if (secInfo) {
    document.title = secInfo.label + ' — KoreHani';
    var bannerH = document.querySelector('.page-banner h1');
    var bannerP = document.querySelector('.page-banner p');
    if (bannerH) bannerH.textContent = secInfo.label;
    if (bannerP) bannerP.textContent = secInfo.topics || '';
    var stEl = document.querySelector('.section-title');
    if (stEl) stEl.textContent = secInfo.label + ' News';
  }

  // 로딩 표시
  var heroEl = document.getElementById('dyn-hero');
  var listEl = document.getElementById('dyn-article-list');
  if (heroEl) heroEl.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;grid-column:1/-1">⏳ Loading...</div>';

  // 1차: 캐시에서 먼저 시도
  var SECTION_ALIASES = {
    '사회': ['사회','Society','society','Social'],
    '국제': ['국제','World','world','International','international','Global'],
    '문화': ['문화','Culture','culture','Entertainment'],
    '정치': ['정치','Politics','politics'],
    '경제': ['경제','Economy','economy','Business','business'],
    'Korea': ['Korea','한국','korea','Korean'],
    '오피니언': ['오피니언','Opinion','opinion'],
    'K-pop': ['K-pop','Kpop','케이팝','kpop','k-pop'],
    '스포츠': ['스포츠','Sports','sports'],
    'beauty': ['beauty','Beauty','뷰티','미용','라이프스타일','IT과학','tech','Tech'],
    'travel': ['travel','Travel','여행','관광','trip'],
  };
  var aliases = SECTION_ALIASES[section] || [section];

  var articles = getCachedArticles().filter(function(a){
    var statusOk = !a.status || a.status === 'published';
    return statusOk && aliases.some(function(alias){
      return (a.section || '') === alias;
    });
  });

  if (!articles.length) {
    try {
      await loadArticlesFromDB({ force: true });
      articles = getCachedArticles().filter(function(a){
        var statusOk = !a.status || a.status === 'published';
        return statusOk && aliases.some(function(alias){
          return (a.section || '') === alias;
        });
      });
    } catch(e) {
      console.warn('[KH] section refresh failed:', e);
    }
  }

  articles = sortArticlesNewest(articles).slice(0, 50);

  var featured = articles[0];
  var rest     = articles.slice(1);

  // HERO
  if (heroEl) {
    if (featured) {
      heroEl.style.cssText = 'display:grid;grid-template-columns:1fr 300px;gap:20px;align-items:start;';
      heroEl.innerHTML = buildHeroHTML(featured, rest);
    } else {
      heroEl.innerHTML = '<div style="padding:40px;color:#94a3b8;text-align:center;grid-column:1/-1">No articles in this section yet.</div>';
    }
  }

  // ARTICLE LIST
  if (listEl) {
    if (!rest.length) {
      listEl.innerHTML = '<p style="color:#94a3b8;padding:20px 0">No articles found.</p>';
    } else {
      var levelColors = {Starter:'#f3e8ff;color:#6b21a8',Beginner:'#e8f5e9;color:#2e7d32',Intermediate:'#fff8e1;color:#f57f17',Advanced:'#fce4ec;color:#c62828'};
      listEl.innerHTML = rest.map(buildArticleRowHTML).join('');
    }
  }
}


function renderAllPage() {
  var articles = published();
  var listEl   = document.getElementById('dyn-article-list');
  if (!listEl) return;

  var params = new URLSearchParams(window.location.search);
  var searchQ = params.get('search') || '';

  var searchWrap = document.getElementById('dyn-search-bar');
  if (searchWrap) {
    searchWrap.innerHTML = '<div class="all-search-wrap">'
      + '<div class="all-search-row">'
      + '<div class="all-search-field">'
      + '<svg class="all-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>'
      + '<input type="text" id="search-bar-input" class="all-search-input" placeholder="Search articles, topics, keywords\u2026" value="' + escapeHtml(searchQ) + '" onkeydown="if(event.key===\'Enter\')doSearch(this.value)">'
      + (searchQ ? '<button class="all-search-clear" onclick="window.location.href=\'korehan-all.html\'" title="Clear search">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
        + '</button>' : '')
      + '</div>'
      + '<button class="all-search-btn" onclick="doSearch(document.getElementById(\'search-bar-input\').value)">Search</button>'
      + '</div>'
      + (searchQ ? '<div class="all-search-result-label">Results for <strong>\u201c' + escapeHtml(searchQ) + '\u201d</strong></div>' : '')
      + '</div>'
      + '<div class="all-level-filter" id="all-level-filter">'
      + '<button class="alf-btn on" data-level="All" onclick="filterAllLevel(\'All\',this)">All Levels</button>'
      + '<button class="alf-btn starter" data-level="Starter" onclick="filterAllLevel(\'Starter\',this)"><span class="alf-dot"></span>Seed</button>'
      + '<button class="alf-btn beginner" data-level="Beginner" onclick="filterAllLevel(\'Beginner\',this)"><span class="alf-dot"></span>Sprout</button>'
      + '<button class="alf-btn intermediate" data-level="Intermediate" onclick="filterAllLevel(\'Intermediate\',this)"><span class="alf-dot"></span>Tree</button>'
      + '<button class="alf-btn advanced" data-level="Advanced" onclick="filterAllLevel(\'Advanced\',this)"><span class="alf-dot"></span>Forest</button>'
      + '</div>';
  }

  window._allArticlesCache = articles;

  if (searchQ) {
    articles = articles.filter(function(a) {
      var text = (a.title || '') + ' ' + (a.body || '') + ' ' + (a.full || '') + ' ' + (a.section || '');
      return text.toLowerCase().indexOf(searchQ.toLowerCase()) !== -1;
    });
  }

  renderAllList(listEl, articles);
}

function renderAllList(listEl, articles) {
  if (!articles.length) {
    listEl.className = '';
    listEl.innerHTML = '<div class="all-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:32px;height:32px;margin-bottom:10px;opacity:.4"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><div>No articles found.</div></div>';
    return;
  }
  listEl.className = 'all-card-grid';
  listEl.innerHTML = articles.map(function(a){
    var lvl = a.level || '';
    var lvlCls = lvl === 'Advanced' ? 'lvl-a' : lvl === 'Intermediate' ? 'lvl-i' : lvl === 'Starter' ? 'lvl-s' : 'lvl-b';
    var cat = (a.section || '').toLowerCase();
    var thumbSrc = (typeof khArticleThumb === 'function') ? khArticleThumb(a, 600, 400) : (a.image || '');
    var img = thumbSrc
      ? '<img class="nc-img" src="' + thumbSrc + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'https://picsum.photos/seed/\'+encodeURIComponent(this.dataset.fb||\'kh\')+\'/600/400\'" data-fb="' + escapeHtml(a.id || 'kh') + '">'
      : '<div class="nc-img nc-img-fallback"></div>';
    var dateStr = a.date ? new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    return '<div class="nc nc-overlay" data-section="' + escapeHtml(cat) + '" data-level="' + escapeHtml(lvl) + '" onclick="location.href=\'' + articleUrl(a.id) + '\'">'
      + img
      + '<div class="nc-overlay-grad"></div>'
      + '<div class="nc-overlay-body">'
      + '<div class="nc-meta"><span class="nc-cat">' + escapeHtml(a.section || '') + '</span>' + (lvl ? '<span class="nc-lvl ' + lvlCls + '">' + escapeHtml({Starter:'Seed',Beginner:'Sprout',Intermediate:'Tree',Advanced:'Forest'}[lvl]||lvl) + '</span>' : '') + '</div>'
      + '<div class="nc-title vocab-zone">' + escapeHtml(a.title || a.title_ko || '') + '</div>'
      + '<div class="nc-foot"><span class="nc-date">' + dateStr + '</span></div>'
      + '</div>'
      + '</div>';
  }).join('');
}

function filterAllLevel(level, btn) {
  document.querySelectorAll('#all-level-filter .alf-btn').forEach(function(b){ b.classList.remove('on'); });
  if (btn) btn.classList.add('on');
  var base = window._allArticlesCache || published();
  var filtered = level === 'All' ? base : base.filter(function(a){ return a.level === level; });
  renderAllList(document.getElementById('dyn-article-list'), filtered);
}

// ══ DYNAMIC SECTIONS ══════════════════════════════════════════════════════════
var _sectionsCache = null;

var DEFAULT_SECTIONS = [
  { key:'정치',   label:'Politics',  icon:'🏛️', sort_order:1 },
  { key:'경제',   label:'Economy',   icon:'📈', sort_order:2 },
  { key:'사회',   label:'Society',   icon:'🏙️', sort_order:3 },
  { key:'국제',   label:'World',     icon:'🌍', sort_order:4 },
  { key:'문화',   label:'Culture',   icon:'🎭', sort_order:5 },
  { key:'K-pop',  label:'K-pop',     icon:'🎤', sort_order:6 },
  { key:'스포츠', label:'Sports',    icon:'⚽', sort_order:7 },
  { key:'beauty', label:'Beauty',    icon:'💄', sort_order:8 },
  { key:'travel', label:'Travel',    icon:'✈️', sort_order:9 },
  { key:'Korea',  label:'🇰🇷 Korea', icon:'🇰🇷', sort_order:10 },
  { key:'오피니언',label:'Opinion',  icon:'✍️', sort_order:11 },
];

function normalizeSectionCatalog(list) {
  var items = Array.isArray(list) ? list.slice() : [];
  var blocked = new Set(['tech', 'it과학', 'technology', 'tech/science']);
  items = items.filter(function(row) {
    var k = String((row && row.key) || '').trim().toLowerCase();
    return k && !blocked.has(k);
  });

  function hasKey(key) {
    return items.some(function(row) { return String((row && row.key) || '') === key; });
  }
  if (!hasKey('beauty')) items.push({ key:'beauty', label:'Beauty', icon:'💄', sort_order:8, active:true });
  if (!hasKey('travel')) items.push({ key:'travel', label:'Travel', icon:'✈️', sort_order:9, active:true });

  return items.sort(function(a, b) {
    return Number(a.sort_order || 999) - Number(b.sort_order || 999);
  });
}

async function loadSections() {
  var sb = getSupa();
  if (!sb) { _sectionsCache = normalizeSectionCatalog(DEFAULT_SECTIONS); return; }
  try {
    var res = await sb.from('sections').select('*').eq('active', true).order('sort_order');
    _sectionsCache = normalizeSectionCatalog((res.data && res.data.length) ? res.data : DEFAULT_SECTIONS);
  } catch(e) {
    _sectionsCache = normalizeSectionCatalog(DEFAULT_SECTIONS);
  }
  // 네비만 업데이트 - 헤더 전체 재렌더 하지 않음 (Sign In 이슈 방지)
  var topnav = document.querySelector('.kh-topnav');
  if (topnav) {
    // 섹션 링크만 교체
    var secLinks = _sectionsCache.map(function(s){
      return '<a class="kh-nav-a" href="korehan-section.html?s='+encodeURIComponent(s.key)+'">'+s.label+'</a>';
    }).join('');
    var newsDropdown = topnav.querySelector('.kh-dropdown');
    if (newsDropdown) newsDropdown.innerHTML = secLinks;
  }
  // 헤더 재렌더가 필요한 경우에만 (최초 1회)
  var hdr = document.getElementById('kh-header');
  if (hdr && !hdr.dataset.sectionsLoaded) {
    hdr.innerHTML = renderHeader();
    hdr.dataset.sectionsLoaded = '1';
    updateAuthUI();
    // hamburger 재연결
    var hamBtn = hdr.querySelector('.kh-ham');
    if (hamBtn) {
      hamBtn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); khSbOpen(); });
      hamBtn.addEventListener('touchend', function(e){ e.preventDefault(); khSbOpen(); });
    }
  }
}

function getSections() {
  return _sectionsCache || DEFAULT_SECTIONS;
}

function sectionLabel(key) {
  var s = getSections().find(function(x){ return x.key === key; });
  return s ? s.label : key;
}
// ══ END DYNAMIC SECTIONS ══════════════════════════════════════════════════════

