/* kh-init.js — Page initialization (DOMContentLoaded) */
// ── INIT ──────────────────────────────────────────────────────
function markShellReady() {
  if (document.body) document.body.classList.add('kh-ready');
}

function markShellLeaving() {
  if (document.body) document.body.classList.add('kh-leaving');
}

window.addEventListener('load', markShellReady);
window.addEventListener('beforeunload', markShellLeaving);
window.addEventListener('pagehide', markShellLeaving);

document.addEventListener('DOMContentLoaded', async function() {
  initKhNeonTheme();
  markShellReady();
  var headerEl  = document.getElementById('kh-header');
  var footerEl  = document.getElementById('kh-footer');
  var sidebarEl = document.getElementById('kh-sidebar');

  if (headerEl)  headerEl.innerHTML  = renderHeader();
  if (footerEl)  footerEl.innerHTML  = renderFooter();
  if (sidebarEl) sidebarEl.innerHTML = renderSharedSidebar();
  renderKhLucideIcons();
  syncNeonToggleButtons();
  applySiteConfigToPage();
  // Defer non-critical sidebar hydrations to avoid blocking first paint on mobile
  var _deferIdle = typeof requestIdleCallback === 'function' ? requestIdleCallback : function(cb){ setTimeout(cb, 0); };
  _deferIdle(function(){ hydrateMostReadSidebar(); });
  _deferIdle(function(){ khHydrateWeather(); });
  // 모바일 사이드바 CSS/overlay/nav 주입 (헤더 렌더 직후 실행)
  khInjectSidebar();
  // Attach hamburger click explicitly (fixes mobile inline-onclick issues)
  var hamBtn = headerEl && headerEl.querySelector('.kh-ham');
  if (hamBtn) {
    hamBtn.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); khSbOpen(); });
    hamBtn.addEventListener('touchend', function(e) { e.preventDefault(); khSbOpen(); });
  }

  var page     = window.location.pathname.split('/').pop() || 'index.html';
  var pageBase = page.replace(/\.html$/, '');
  var isHomePage = (!pageBase || pageBase === 'index' || pageBase === 'korehan-news');

  // Session / settings can hydrate in parallel — do not block the homepage hero.
  var sessionPromise = checkSession().catch(function(err){ console.warn('session check failed', err); });
  var sectionsPromise = loadSections().catch(function(err){ console.warn('sections load failed', err); });
  var settingsPromise = loadAppSettings().catch(function(err){ console.warn('app settings load failed', err); });

  if (isHomePage) {
    // Render cached articles immediately so hero + swipe is interactive while fresh data loads
    if (getCachedArticles().length) {
      renderHomePage();
    }
    await Promise.all([
      loadArticlesFromDB({ homeOptimized: true, force: true }),
      sectionsPromise,
      settingsPromise
    ]);
    renderHomePage();
  } else {
    await Promise.all([loadArticlesFromDB({ force: true }), sectionsPromise, settingsPromise]);
  }

  await Promise.allSettled([sessionPromise]);

  // After session is confirmed, reload settings so RLS-protected data (phrases etc.) is fetched with auth
  if (supaUser) {
    _appSettingsPromise = null;
    // Reset article cache detection — earlier probe may have failed due to missing auth
    _artCacheSchemaDone = false;
    _artCacheSchema = null;
    _remoteCacheDisabled = false;
    await loadAppSettings().catch(function(err){ console.warn('post-auth settings reload failed', err); });
    window.dispatchEvent(new Event('kh-settings-reloaded'));
  }

  if (footerEl) footerEl.innerHTML = renderFooter();
  renderKhLucideIcons();
  applySiteConfigToPage();

  if (pageBase === 'korehan-all')     { renderAllPage(); }
  else if (pageBase === 'korehan-section')   {
    var sKey = (new URLSearchParams(window.location.search)).get('s') || '';
    await renderSectionPage(sKey);
  }
  else if (pageBase === 'korehan-korea')     { await renderSectionPage('Korea'); }
  else if (pageBase === 'korehan-society')   { await renderSectionPage('사회'); }
  else if (pageBase === 'korehan-world')     { await renderSectionPage('국제'); }
  else if (pageBase === 'korehan-culture')   { await renderSectionPage('문화'); }
  else if (pageBase === 'korehan-opinion')   { await renderSectionPage('오피니언'); }
  else if (pageBase === 'korehan-article')   { await _loadReportersIntoKHMap(); renderArticlePage(); }

  // Defer non-critical initializations to avoid blocking first paint on mobile
  var _deferPost = typeof requestIdleCallback === 'function' ? requestIdleCallback : function(cb){ setTimeout(cb, 0); };
  _deferPost(function(){ ttsInit(); });
  _deferPost(function(){ injectDailyMission(); });
  _deferPost(function(){ startClock(); });
  _deferPost(function(){ loadVocabFromDB().then(function(){ initTooltips(); }); });
});

// ── vocabulary_bank DB → VOCAB 병합 ───────────────────────
// 하드코딩 VOCAB에 DB 단어를 덮어쓰기 (DB 우선)
// ── Study continuity helpers ───────────────────────────────────────────────
var K_STUDY_PLAN     = 'kh_study_plan_v1';
var K_PERSONAL_QUEUE = 'kh_personal_queue_v1';
var K_SPEAKING_LOG   = 'kh_speaking_log_v1';
var K_QUICK_OUTPUT   = 'kh_quick_output_v1';

function khSafeReadJSON(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch(e) {
    return fallback;
  }
}

function khSafeWriteJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) {}
}

function getStudyPlan() {
  var base = {
    goalLevel: 'Intermediate',
    minutesPerDay: 20,
    daysPerWeek: 5,
    reminderTime: '20:00',
    focus: 'Balanced',
    targetExam: 'TOPIK I',
    startDate: new Date().toISOString().slice(0, 10)
  };
  var saved = khSafeReadJSON(K_STUDY_PLAN, {});
  return Object.assign({}, base, saved || {});
}

function saveStudyPlan(plan) {
  var next = Object.assign({}, getStudyPlan(), plan || {});
  khSafeWriteJSON(K_STUDY_PLAN, next);
  return next;
}

function getPersonalQueue() {
  var items = khSafeReadJSON(K_PERSONAL_QUEUE, []);
  return Array.isArray(items) ? items : [];
}

function savePersonalQueue(items) {
  khSafeWriteJSON(K_PERSONAL_QUEUE, Array.isArray(items) ? items : []);
}

function addPersonalQueueItem(item) {
  var list = getPersonalQueue();
  list.unshift({
    id: 'pq_' + Date.now(),
    title: item && item.title ? item.title : 'Untitled',
    source: item && item.source ? item.source : '',
    category: item && item.category ? item.category : 'Custom',
    note: item && item.note ? item.note : '',
    createdAt: new Date().toISOString(),
    done: false
  });
  savePersonalQueue(list.slice(0, 20));
  return getPersonalQueue();
}

function togglePersonalQueueItem(id) {
  var list = getPersonalQueue().map(function(item) {
    if (item.id === id) item.done = !item.done;
    return item;
  });
  savePersonalQueue(list);
  return list;
}

function removePersonalQueueItem(id) {
  var list = getPersonalQueue().filter(function(item){ return item.id !== id; });
  savePersonalQueue(list);
  return list;
}

function recordSpeakingSession(entry) {
  var log = khSafeReadJSON(K_SPEAKING_LOG, []);
  log.unshift({
    id: 'sp_' + Date.now(),
    prompt: entry && entry.prompt ? entry.prompt : '',
    transcript: entry && entry.transcript ? entry.transcript : '',
    score: Number(entry && entry.score ? entry.score : 0),
    durationSec: Number(entry && entry.durationSec ? entry.durationSec : 0),
    createdAt: new Date().toISOString()
  });
  khSafeWriteJSON(K_SPEAKING_LOG, log.slice(0, 60));
}

function getSpeakingStats(days) {
  var limitDays = Number(days || 7);
  var since = Date.now() - (limitDays * 86400000);
  var list = khSafeReadJSON(K_SPEAKING_LOG, []).filter(function(item){
    return item && item.createdAt && new Date(item.createdAt).getTime() >= since;
  });
  var totalSec = list.reduce(function(sum, item){ return sum + Number(item.durationSec || 0); }, 0);
  var totalScore = list.reduce(function(sum, item){ return sum + Number(item.score || 0); }, 0);
  return {
    sessions: list.length,
    minutes: Math.round(totalSec / 60),
    avgScore: list.length ? Math.round(totalScore / list.length) : 0,
    lastPrompt: list[0] ? list[0].prompt : '',
    lastAt: list[0] ? list[0].createdAt : null
  };
}

function recordQuickOutput(entry) {
  var log = khSafeReadJSON(K_QUICK_OUTPUT, []);
  log.unshift({
    id: 'qo_' + Date.now(),
    text: entry && entry.text ? entry.text : '',
    topic: entry && entry.topic ? entry.topic : '',
    createdAt: new Date().toISOString()
  });
  khSafeWriteJSON(K_QUICK_OUTPUT, log.slice(0, 60));
}

function getQuickOutputStats(days) {
  var limitDays = Number(days || 7);
  var since = Date.now() - (limitDays * 86400000);
  var list = khSafeReadJSON(K_QUICK_OUTPUT, []).filter(function(item){
    return item && item.createdAt && new Date(item.createdAt).getTime() >= since;
  });
  return {
    count: list.length,
    lastText: list[0] ? list[0].text : '',
    lastTopic: list[0] ? list[0].topic : '',
    lastAt: list[0] ? list[0].createdAt : null
  };
}

window.getStudyPlan = getStudyPlan;
window.saveStudyPlan = saveStudyPlan;
window.getPersonalQueue = getPersonalQueue;
window.addPersonalQueueItem = addPersonalQueueItem;
window.togglePersonalQueueItem = togglePersonalQueueItem;
window.removePersonalQueueItem = removePersonalQueueItem;
window.recordSpeakingSession = recordSpeakingSession;
window.getSpeakingStats = getSpeakingStats;
window.recordQuickOutput = recordQuickOutput;
window.getQuickOutputStats = getQuickOutputStats;

function runMobileRedesign() {
  markMobileBody();
  if (!isMobileRedesign()) return;
  injectMobileBottomNav();
  enhanceHomeMobile();
  enhanceCollectionPagesMobile();
  enhanceArticleMobile();
  enhanceConversationsMobile();
  enhanceStoriesMobile();
  renderKhLucideIcons();
}

document.addEventListener('DOMContentLoaded', function(){
  setTimeout(runMobileRedesign, 700);
});
window.addEventListener('resize', function(){
  if (isMobileRedesign()) {
    markMobileBody();
    injectMobileBottomNav();
  }
});
