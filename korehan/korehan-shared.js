/* ============================================================
   KoreHan News — Shared JS
   ============================================================ */

// ── Neon/dark mode + auth flash prevention: apply IMMEDIATELY ──
(function() {
  try {
    // Neon theme
    var neon = localStorage.getItem('korehan_neon_theme');
    if (neon === '1') {
      if (document.body) {
        document.body.classList.add('kh-neon-on');
      } else {
        document.documentElement.classList.add('kh-neon-on');
        document.addEventListener('DOMContentLoaded', function() {
          document.documentElement.classList.remove('kh-neon-on');
          if (document.body) document.body.classList.add('kh-neon-on');
        }, { once: true });
      }
    }
    // Hide Sign In / Join buttons if user has a stored session
    // Supabase stores session as sb-{ref}-auth-token in localStorage
    var hasSession = false;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('sb-') === 0 && k.indexOf('-auth-token') > 0) {
        var v = localStorage.getItem(k);
        if (v && v.indexOf('"access_token"') > 0) { hasSession = true; break; }
      }
    }
    if (hasSession) {
      // Inject a style that hides auth buttons until JS confirms state
      var s = document.createElement('style');
      s.id = 'kh-auth-flash-guard';
      s.textContent = '#topbar-signin-btn,#topbar-join-btn,.kh-hbtn-out[onclick*="openAuth"]{display:none!important}';
      (document.head || document.documentElement).appendChild(s);
    }
  } catch(e) {}
})();

// ── Supabase ──────────────────────────────────────────────────
const SUPA_URL = 'https://samghztrdvtxmrmawneu.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWdoenRyZHZ0eG1ybWF3bmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzQ3NTIsImV4cCI6MjA4ODAxMDc1Mn0.UCt6Z76XTmJGbhHdX744tM8BKDdVhqRiCLuQi6w-rNs';

// Supabase 클라이언트 (CDN 로드 후 초기화)
var _supa = null;
function getSupa() {
  if (_supa) return _supa;
  if (window.supabase) {
    _supa = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
      auth: {
        detectSessionInUrl: false,  // 수동 exchangeCodeForSession 사용 — auto와 충돌 방지
        persistSession: true,
        autoRefreshToken: true,
        flowType: 'pkce',
      }
    });
    return _supa;
  }
  return null;
}

// 현재 로그인 유저
var supaUser = null;

// ── Global difficulty filter ───────────────────────────────────
var _activeDiff = (function(){ try { return localStorage.getItem('kh_diff') || 'all'; } catch(e){ return 'all'; } })();
function khSetDiff(val) {
  _activeDiff = val || 'all';
  try { localStorage.setItem('kh_diff', _activeDiff); } catch(e) {}
  _syncPrefsToDB();
  // Update dot color
  var dot = document.getElementById('kh-diff-dot');
  if (dot) {
    dot.className = 'kh-diff-dot'
      + (_activeDiff === 'Starter' ? ' dot-starter'
      : _activeDiff === 'Beginner' ? ' dot-beginner'
      : _activeDiff === 'Intermediate' ? ' dot-intermediate'
      : _activeDiff === 'Advanced' ? ' dot-advanced' : '');
  }
  // Sync select value (in case called programmatically)
  var sel = document.getElementById('kh-diff-select');
  if (sel && sel.value !== _activeDiff) sel.value = _activeDiff;
  applyGlobalDiffFilter();
}
function applyGlobalDiffFilter() {
  // News cards
  document.querySelectorAll('#dyn-news-grid .nc').forEach(function(card) {
    var sectionBtn = document.querySelector('#news-pills .sp.on');
    var sectionFilter = sectionBtn ? sectionBtn.dataset.filter : 'all';
    var sectionMatch = sectionFilter === 'all' || card.dataset.section === sectionFilter;
    var diffMatch = _activeDiff === 'all' || card.dataset.level === _activeDiff;
    card.style.display = (sectionMatch && diffMatch) ? '' : 'none';
  });
  // Conversation cards
  document.querySelectorAll('.hconv-card').forEach(function(card) {
    var diffMatch = _activeDiff === 'all' || card.dataset.lvlLabel === _activeDiff;
    card.style.display = diffMatch ? '' : 'none';
  });
  // Story cards
  document.querySelectorAll('.story-card').forEach(function(card) {
    var diffMatch = _activeDiff === 'all' || card.dataset.level === _activeDiff;
    card.style.display = diffMatch ? '' : 'none';
  });
}
var KH_LUCIDE_SRC = 'https://cdn.jsdelivr.net/npm/lucide@0.468.0/dist/umd/lucide.min.js';
var _khLucideReady = null;

function ensureKhLucide() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    return Promise.resolve(window.lucide);
  }
  if (_khLucideReady) return _khLucideReady;
  _khLucideReady = new Promise(function(resolve, reject) {
    var existing = document.querySelector('script[data-kh-lucide="1"]');
    if (existing) {
      existing.addEventListener('load', function() { resolve(window.lucide); }, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    var script = document.createElement('script');
    script.src = KH_LUCIDE_SRC;
    script.defer = true;
    script.setAttribute('data-kh-lucide', '1');
    script.onload = function() { resolve(window.lucide); };
    script.onerror = reject;
    document.head.appendChild(script);
  }).catch(function(err) {
    console.warn('Lucide failed to load.', err);
    return null;
  });
  return _khLucideReady;
}

function renderKhLucideIcons() {
  ensureKhLucide().then(function(lucideLib) {
    if (!lucideLib || typeof lucideLib.createIcons !== 'function') return;
    lucideLib.createIcons({
      attrs: {
        'stroke-width': 1.9
      }
    });
  });
}

function khIcon(name, label, extraClass) {
  var cls = 'kh-ui-icon' + (extraClass ? ' ' + extraClass : '');
  var html = '<i data-lucide="' + name + '" class="' + cls + '" aria-hidden="true"></i>';
  if (!label) return html;
  return html + '<span>' + label + '</span>';
}

// ── Claude API 프록시 (키를 서버에서만 관리) ─────────────────
// Anthropic API를 직접 호출하지 않고 Supabase Edge Function을 통해 호출
// → API 키가 브라우저에 절대 노출되지 않음
const CLAUDE_PROXY_URL = SUPA_URL + '/functions/v1/claude-proxy';

async function callClaudeRequest(accessToken, payload) {
  return fetch(CLAUDE_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + accessToken,
      'apikey': SUPA_KEY,
    },
    body: JSON.stringify(payload),
  });
}

async function getFreshClaudeSession(sb, forceRefresh) {
  var sessionRes = await sb.auth.getSession();
  var session = sessionRes && sessionRes.data && sessionRes.data.session;
  var now = Math.floor(Date.now() / 1000);
  var expiresSoon = session && session.expires_at && session.expires_at <= now + 90;
  if (forceRefresh || !session || expiresSoon) {
    var refreshed = await sb.auth.refreshSession();
    session = refreshed && refreshed.data && refreshed.data.session;
  }
  return session || null;
}

async function callClaude({ feature, model, max_tokens, messages }) {
  var sb = getSupa();
  if (!sb) throw new Error('Supabase not initialized');

  var session = await getFreshClaudeSession(sb);
  if (!session) throw new Error('Please sign in to continue.');

  var payload = { feature, model, max_tokens, messages };
  var resp;
  try {
    resp = await callClaudeRequest(session.access_token, payload);
  } catch(netErr) {
    throw new Error('Network error — please check your internet connection.');
  }

  if (resp.status === 401) {
    var freshSession = await getFreshClaudeSession(sb, true);
    if (freshSession && freshSession.access_token) {
      try {
        resp = await callClaudeRequest(freshSession.access_token, payload);
      } catch(netErr2) {
        throw new Error('Network error — please check your internet connection.');
      }
    }
  }

  if (resp.status === 429) throw new Error('Too many requests. Please try again shortly.');
  if (resp.status === 401) {
    throw new Error('Authentication error — please sign in again.');
  }
  if (!resp.ok) {
    var err = await resp.json().catch(function(){ return {}; });
    throw new Error(err.error || 'AI server error (' + resp.status + ')');
  }
  return resp.json();
}

// ── article_cache — AI 분석 결과 캐시 ────────────────────────
// conv/story 발행 시 admin에서 AI 생성 → 여기서 조회
var _remoteCacheDisabled = false;
var _artCacheSchema = null;     // 'kv' | 'wide' | 'none'
var _artCacheSchemaDone = false;

async function _detectArtCacheSchema() {
  if (_artCacheSchemaDone) return _artCacheSchema;
  var sb = getSupa();
  if (!sb) { _artCacheSchema = 'none'; return 'none'; }
  // 먼저 실제 행으로 컬럼 감지
  try {
    var r0 = await sb.from('article_cache').select('*').limit(1);
    if (!r0.error && r0.data && r0.data.length > 0) {
      var cols = Object.keys(r0.data[0]);
      if (cols.indexOf('cache_key') >= 0) { _artCacheSchemaDone = true; _artCacheSchema = 'kv'; return 'kv'; }
      if (cols.indexOf('article_id') >= 0 && cols.indexOf('vocab') >= 0) { _artCacheSchemaDone = true; _artCacheSchema = 'wide'; return 'wide'; }
      console.warn('[cache] 알 수 없는 컬럼:', cols);
      _artCacheSchemaDone = true; _artCacheSchema = 'none'; return 'none';
    }
  } catch(e) {}
  // 빈 테이블이면 컬럼 유효성으로 감지
  try {
    var r1 = await sb.from('article_cache').select('content_type,content_id,cache_key,cache_value').limit(0);
    if (!r1.error) { _artCacheSchemaDone = true; _artCacheSchema = 'kv'; return 'kv'; }
  } catch(e) {}
  try {
    var r2 = await sb.from('article_cache').select('article_id,vocab,grammar').limit(0);
    if (!r2.error) { _artCacheSchemaDone = true; _artCacheSchema = 'wide'; return 'wide'; }
  } catch(e) {}
  // Don't set _artCacheSchemaDone — allow retry after auth is restored
  console.warn('[cache] schema detection failed — will retry after auth');
  _artCacheSchema = 'none';
  return 'none';
}

async function getFromCache(contentType, contentId, cacheKey) {
  if (_remoteCacheDisabled) return null;
  try {
    var sb = getSupa();
    if (!sb) return null;
    var schema = await _detectArtCacheSchema();
    if (schema === 'none') return null;

    if (schema === 'kv') {
      // key-value 스키마
      if (cacheKey === 'ai_analysis') {
        var res = await sb.from('article_cache')
          .select('cache_key, cache_value')
          .eq('content_type', contentType)
          .eq('content_id', String(contentId))
          .in('cache_key', ['translation', 'vocab', 'grammar', 'quiz']);
        if (res.error) throw res.error;
        if (!res.data || !res.data.length) return null;
        var map = {};
        res.data.forEach(function(r) { map[r.cache_key] = safeParseJSON(r.cache_value, null); });
        return { translation: map.translation || null, vocab: map.vocab || [], grammar: map.grammar || null, quiz: map.quiz || null };
      }
      var actualKey = cacheKey;
      if (cacheKey === 'translation_en') actualKey = 'translation';
      else if (cacheKey === 'grammar_guide') actualKey = 'grammar';
      else if (cacheKey.indexOf('fill_') === 0) actualKey = 'quiz';
      var res = await sb.from('article_cache')
        .select('cache_value')
        .eq('content_type', contentType)
        .eq('content_id', String(contentId))
        .eq('cache_key', actualKey)
        .maybeSingle();
      if (res.error) throw res.error;
      if (!res.data || !res.data.cache_value) return null;
      var val = safeParseJSON(res.data.cache_value, null);
      if (cacheKey === 'translation_en' && val && val.texts) return { translations: val.texts };
      return val;
    }

    if (schema === 'wide') {
      // wide-table 스키마 (article_id 기반)
      var res = await sb.from('article_cache')
        .select('*')
        .eq('article_id', String(contentId))
        .maybeSingle();
      if (res.error) throw res.error;
      if (!res.data) return null;
      var row = res.data;
      if (cacheKey === 'ai_analysis') {
        return {
          translation: safeParseJSON(row.translation, null),
          vocab: safeParseJSON(row.vocab, []),
          grammar: safeParseJSON(row.grammar, null),
          quiz: safeParseJSON(row.quiz, null)
        };
      }
      if (cacheKey === 'translation_en') {
        var t = safeParseJSON(row.translation, null);
        return (t && t.texts) ? { translations: t.texts } : null;
      }
      if (cacheKey === 'grammar_guide') return safeParseJSON(row.grammar, null);
      if (cacheKey.indexOf('fill_') === 0) return safeParseJSON(row.quiz, null);
      if (cacheKey === 'expressions') return safeParseJSON(row.expressions, []);
      return null;
    }
  } catch(e) {
    var msg = String((e && e.message) || e || '');
    if (/40[013]/.test(msg) || /unauthorized|forbidden|permission/i.test(msg)) _remoteCacheDisabled = true;
  }
  return null;
}

async function upsertArticleCacheRow(articleId, patch) {
  if (_remoteCacheDisabled || !patch) return;
  var sb = getSupa();
  if (!sb) return;
  var schema = await _detectArtCacheSchema();
  if (schema === 'none') return;

  if (schema === 'kv') {
    var keys = Object.keys(patch);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = patch[k];
      if (v === undefined || v === null) continue;
      try {
        var upsRes = await sb.from('article_cache').upsert({
          content_type: 'article',
          content_id: String(articleId),
          cache_key: k,
          cache_value: typeof v === 'string' ? v : JSON.stringify(v)
        }, { onConflict: 'content_type,content_id,cache_key' });
        if (upsRes.error) {
          console.warn('[cache] upsert error key=' + k + ':', upsRes.error);
          var msg = String((upsRes.error.message) || upsRes.error.code || '');
          if (/40[013]/.test(msg) || /unauthorized|forbidden|permission/i.test(msg)) { _remoteCacheDisabled = true; break; }
        } else {
          console.log('[cache] saved key=' + k + ' articleId=' + articleId);
        }
      } catch(e) {
        var msg = String((e && e.message) || e || '');
        console.warn('[cache] upsert exception key=' + k + ':', msg);
        if (/40[013]/.test(msg) || /unauthorized|forbidden|permission/i.test(msg)) { _remoteCacheDisabled = true; break; }
      }
    }
  } else if (schema === 'wide') {
    // wide-table: 존재 여부 확인 후 update / insert
    try {
      var existing = await sb.from('article_cache').select('article_id').eq('article_id', String(articleId)).maybeSingle();
      if (existing.error) { console.warn('[cache] wide select error:', existing.error); }
      else if (existing && existing.data) {
        var upRes = await sb.from('article_cache').update(patch).eq('article_id', String(articleId));
        if (upRes.error) console.warn('[cache] wide update error:', upRes.error);
        else console.log('[cache] wide updated articleId=' + articleId, Object.keys(patch));
      } else {
        var wRow = Object.assign({ article_id: String(articleId) }, patch);
        var insRes = await sb.from('article_cache').insert(wRow);
        if (insRes.error) console.warn('[cache] wide insert error:', insRes.error);
        else console.log('[cache] wide inserted articleId=' + articleId, Object.keys(patch));
      }
    } catch(e) {
      var msg = String((e && e.message) || e || '');
      console.warn('[cache] wide upsert exception:', msg);
      if (/40[013]/.test(msg) || /unauthorized|forbidden|permission/i.test(msg)) _remoteCacheDisabled = true;
    }
  }
}

// Conv/Story 데이터에 캐시 병합 (vocab/grammar 없을 때만)
async function enrichFromCache(contentType, item) {
  if (!item || !item.id) return item;
  var hasVocab = item.data && item.data.vocab && item.data.vocab.length;
  if (hasVocab) return item; // 이미 있으면 캐시 불필요
  var cached = await getFromCache(contentType, item.id, 'ai_analysis');
  if (cached) {
    if (!item.data) item.data = {};
    if (cached.vocab && !item.data.vocab) item.data.vocab = cached.vocab;
    if (cached.grammar && !item.data.grammar) item.data.grammar = cached.grammar;
    if (cached.mission && !item.data.mission) item.data.mission = cached.mission;
    if (cached.summary_en && !item.data.summary_en) item.data.summary_en = cached.summary_en;
  }
  return item;
}


async function getArticleCacheVocab() {
  var out = [];
  var seen = new Set();
  function pushWord(word) {
    if (!word) return;
    var ko = word.word || word.ko || '';
    if (!ko || seen.has(ko)) return;
    seen.add(ko);
    out.push({
      word: ko,
      reading: word.reading || word.rom || '',
      meaning: word.meaning || word.en || '',
      source: word.source || word.src || 'article'
    });
  }
  try {
    var arts = getCachedArticles ? getCachedArticles() : [];
    for (var i = 0; i < arts.length; i++) {
      var art = arts[i];
      var cached = await getFromCache('article', art.id, 'ai_analysis');
      (cached && cached.vocab || []).forEach(function(v){ pushWord(v); });
      ((art.data && art.data.vocab) || []).forEach(function(v){ pushWord(v); });
    }
    var sb = getSupa();
    if (sb) {
      var pair = await Promise.all([
        sb.from('conversations_data').select('data').limit(100),
        sb.from('stories_data').select('data').limit(100)
      ]);
      (pair[0].data || []).forEach(function(row) {
        ((row.data || {}).vocab || []).forEach(function(v){ pushWord(Object.assign({ source: 'conv' }, v)); });
      });
      (pair[1].data || []).forEach(function(row) {
        ((row.data || {}).vocab || []).forEach(function(v){ pushWord(Object.assign({ source: 'story' }, v)); });
      });
    }
  } catch(e) {}
  return out;
}

async function getArticleCacheSentences() {
  var out = [];
  try {
    var arts = (getCachedArticles ? getCachedArticles() : []).filter(function(a){ return a && a.status === 'published'; }).slice(0, 30);
    for (var i = 0; i < arts.length; i++) {
      var art = arts[i];
      var body = String(art.body || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!body) continue;
      var parts = body.split(/[\n]+|(?<=[.!?])\s+/).filter(function(s){ return s && s.trim().length > 12; }).slice(0, 2);
      parts.forEach(function(sentence, idx) {
        out.push({
          id: 'art-' + art.id + '-' + idx,
          level: art.level || 'Intermediate',
          ko: sentence.trim(),
          en: art.title || art.section || 'From KoreHan News'
        });
      });
    }
  } catch(e) {}
  return out;
}

var _sessionWarningShown = false;
async function refreshSessionSafely() {
  var sb = getSupa();
  if (!sb) return;
  var { error } = await sb.auth.refreshSession();
  if (error) {
    if (!_sessionWarningShown) {
      _sessionWarningShown = true;
      // Do NOT auto sign-out — a refresh failure may be a transient network error.
      // Supabase's autoRefreshToken will keep retrying. Just warn the user.
      if (typeof toast === 'function') toast('Session refresh failed — reload the page if you experience any issues.', true);
    }
  }
}
// 15분마다 세션 자동 갱신
setInterval(refreshSessionSafely, 15 * 60 * 1000);

// Google 로그인
async function signInWithGoogle() {
  var sb = getSupa();
  if (!sb) { toast('Loading... please try again in a moment.', true); return; }
  var { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + window.location.pathname,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account'
      }
    }
  });
  if (error) toast('Sign-in error: ' + error.message, true);
}

// ── Auth Modal (이메일/비밀번호 + Google) ─────────────────────

function openAuthModal(defaultTab) {
  // 모달이 없으면 생성
  if (!document.getElementById('kh-auth-modal')) {
    _injectAuthModal();
  }
  var modal = document.getElementById('kh-auth-modal');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  _authSwitchTab(defaultTab || 'signin');
  setTimeout(function(){
    var inp = document.getElementById('kh-auth-email');
    if (inp) inp.focus();
  }, 120);
}

function closeAuthModal() {
  var modal = document.getElementById('kh-auth-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
  _authClearErrors();
}

function _authSwitchTab(tab) {
  var signinTab  = document.getElementById('kh-tab-signin');
  var signupTab  = document.getElementById('kh-tab-signup');
  var resetTab   = document.getElementById('kh-tab-reset');
  var signinForm = document.getElementById('kh-signin-form');
  var signupForm = document.getElementById('kh-signup-form');
  var resetForm  = document.getElementById('kh-reset-form');
  [signinTab, signupTab].forEach(function(t){ if(t) t.classList.remove('on'); });
  [signinForm, signupForm, resetForm].forEach(function(f){ if(f) f.style.display='none'; });
  if (tab === 'signin')  { if(signinTab) signinTab.classList.add('on'); if(signinForm) signinForm.style.display='block'; }
  if (tab === 'signup')  { if(signupTab) signupTab.classList.add('on'); if(signupForm) signupForm.style.display='block'; }
  if (tab === 'reset')   { if(resetForm) resetForm.style.display='block'; }
  _authClearErrors();
}

function _authClearErrors() {
  var err = document.getElementById('kh-auth-error');
  if (err) { err.textContent = ''; err.style.display = 'none'; }
  var ok = document.getElementById('kh-auth-ok');
  if (ok) { ok.textContent = ''; ok.style.display = 'none'; }
}
function _authShowError(msg) {
  var err = document.getElementById('kh-auth-error');
  if (err) { err.textContent = msg; err.style.display = 'block'; }
}
function _authShowOk(msg) {
  var ok = document.getElementById('kh-auth-ok');
  if (ok) { ok.textContent = msg; ok.style.display = 'block'; }
  var err = document.getElementById('kh-auth-error');
  if (err) err.style.display = 'none';
}

function _authSetLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.style.opacity = loading ? '.6' : '1';
}

// ── 이메일 로그인 ─────────────────────────────────────────────
async function authSignIn() {
  var email = (document.getElementById('kh-auth-email') || {}).value.trim();
  var pw    = (document.getElementById('kh-auth-pw')    || {}).value;
  var btn   = document.getElementById('kh-signin-btn');
  _authClearErrors();

  if (!email || !pw) { _authShowError('Please enter your email and password.'); return; }
  if (!email.includes('@')) { _authShowError('Please enter a valid email address.'); return; }

  _authSetLoading(btn, true);
  var sb = getSupa();
  var { data, error } = await sb.auth.signInWithPassword({ email: email, password: pw });
  _authSetLoading(btn, false);

  if (error) {
    var msg = error.message;
    if (msg.includes('Invalid login')) msg = 'Incorrect email or password.';
    if (msg.includes('Email not confirmed')) msg = 'Please confirm your email first. Check your inbox.';
    _authShowError(msg);
    return;
  }
  if (data && data.user) {
    supaUser = data.user;
    _sessionWarningShown = false;
    updateAuthUI();
    updateCommentForm();
    renderDailyMission();
    _syncSavedWordsFromDB();
    window.dispatchEvent(new Event('kh-auth-signed-in'));
  }
  closeAuthModal();
  toast('Welcome back! 👋');
}

// ── 이메일 회원가입 ───────────────────────────────────────────
async function authSignUp() {
  var name  = (document.getElementById('kh-auth-name')  || {}).value.trim();
  var email = (document.getElementById('kh-auth-email2') || {}).value.trim();
  var pw    = (document.getElementById('kh-auth-pw2')   || {}).value;
  var pw2   = (document.getElementById('kh-auth-pw3')   || {}).value;
  var btn   = document.getElementById('kh-signup-btn');
  _authClearErrors();

  if (!name)  { _authShowError('Please enter your name.'); return; }
  if (!email || !email.includes('@')) { _authShowError('Please enter a valid email address.'); return; }
  if (!pw || pw.length < 8) { _authShowError('Password must be at least 8 characters.'); return; }
  if (pw !== pw2) { _authShowError('Passwords do not match.'); return; }
  // 비밀번호 강도 체크
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
    _authShowError('Password must contain letters and numbers.'); return;
  }

  _authSetLoading(btn, true);
  var sb = getSupa();
  var { data, error } = await sb.auth.signUp({
    email: email,
    password: pw,
    options: {
      data: { full_name: name },
      emailRedirectTo: window.location.origin + '/index.html'
    }
  });
  _authSetLoading(btn, false);

  if (error) {
    var msg = error.message;
    if (msg.includes('already registered')) msg = 'This email is already registered. Try signing in.';
    _authShowError(msg);
    return;
  }

  // Supabase는 중복 이메일도 success 반환 — identities 배열이 비어있으면 기존 계정
  if (data && data.user && (!data.user.identities || data.user.identities.length === 0)) {
    _authShowError('This email is already registered. Please sign in instead.');
    return;
  }

  _authShowOk('Account created! We sent a confirmation email. Please check your inbox (including spam).');
  document.getElementById('kh-signup-form').querySelectorAll('input').forEach(function(i){ i.value=''; });
}

// ── 비밀번호 재설정 ───────────────────────────────────────────
async function authResetPassword() {
  var email = (document.getElementById('kh-auth-reset-email') || {}).value.trim();
  var btn   = document.getElementById('kh-reset-btn');
  _authClearErrors();

  if (!email || !email.includes('@')) { _authShowError('Please enter a valid email address.'); return; }

  _authSetLoading(btn, true);
  var sb = getSupa();
  var { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/index.html?reset=1'
  });
  _authSetLoading(btn, false);

  if (error) { _authShowError(error.message); return; }
  _authShowOk('✅ Password reset link sent! Check your email.');
}

// ── 모달 HTML 주입 ────────────────────────────────────────────
function _injectAuthModal() {
  var div = document.createElement('div');
  div.innerHTML = `
<div id="kh-auth-modal" style="display:none;position:fixed;inset:0;background:rgba(8,16,30,.75);backdrop-filter:blur(7px);z-index:9999;align-items:center;justify-content:center;padding:20px" onclick="if(event.target===this)closeAuthModal()">
  <div style="background:#fff;border-radius:22px;width:100%;max-width:400px;box-shadow:0 32px 80px rgba(0,0,0,.3);overflow:hidden;animation:khAuthIn .28s cubic-bezier(.22,1,.36,1)">

    <!-- 헤더 -->
    <div style="background:linear-gradient(135deg,#07122a,#0e2554);padding:26px 28px 22px;position:relative">
      <button onclick="closeAuthModal()" style="position:absolute;top:14px;right:14px;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.1);border:none;color:#fff;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>
      <div style="font-family:'DM Serif Display',Georgia,serif;font-size:20px;color:#fff;margin-bottom:3px">Kore<span style="color:#7ab8f5;font-style:italic">Han</span></div>
      <div style="font-size:11px;color:rgba(255,255,255,.4);letter-spacing:.8px;text-transform:uppercase">Your Korean learning journey</div>
    </div>

    <!-- 탭 -->
    <div style="display:flex;border-bottom:1.5px solid #e2e8f0">
      <button id="kh-tab-signin" onclick="_authSwitchTab('signin')" style="flex:1;padding:14px;border:none;background:transparent;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;color:#1e4fa3;border-bottom:2.5px solid #1e4fa3" class="on">Sign In</button>
      <button id="kh-tab-signup" onclick="_authSwitchTab('signup')" style="flex:1;padding:14px;border:none;background:transparent;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;color:#94a3b8;border-bottom:2.5px solid transparent">Create Account</button>
    </div>

    <!-- 에러/성공 메시지 -->
    <div id="kh-auth-error" style="display:none;margin:14px 28px 0;padding:10px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:9px;font-size:13px;color:#cc2200;font-weight:600"></div>
    <div id="kh-auth-ok"    style="display:none;margin:14px 28px 0;padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:9px;font-size:13px;color:#15803d;font-weight:600"></div>

    <!-- ── 로그인 폼 ── -->
    <div id="kh-signin-form" style="padding:22px 28px 28px">
      <div style="margin-bottom:14px">
        <label style="font-size:12px;font-weight:700;color:#445566;display:block;margin-bottom:5px">Email</label>
        <input id="kh-auth-email" type="email" placeholder="you@example.com" onkeydown="if(event.key==='Enter')document.getElementById('kh-auth-pw').focus()"
          style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;transition:border-color .15s"
          onfocus="this.style.borderColor='#1e4fa3'" onblur="this.style.borderColor='#e2e8f0'">
      </div>
      <div style="margin-bottom:8px">
        <label style="font-size:12px;font-weight:700;color:#445566;display:block;margin-bottom:5px">Password</label>
        <div style="position:relative">
          <input id="kh-auth-pw" type="password" placeholder="••••••••" onkeydown="if(event.key==='Enter')authSignIn()"
            style="width:100%;padding:11px 40px 11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;transition:border-color .15s"
            onfocus="this.style.borderColor='#1e4fa3'" onblur="this.style.borderColor='#e2e8f0'">
          <button onclick="var i=document.getElementById('kh-auth-pw');i.type=i.type==='password'?'text':'password'" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);border:none;background:transparent;cursor:pointer;color:#94a3b8;font-size:16px">👁</button>
        </div>
      </div>
      <div style="text-align:right;margin-bottom:18px">
        <a href="#" onclick="event.preventDefault();_authSwitchTab('reset')" style="font-size:12px;color:#1e4fa3;font-weight:600">Forgot password?</a>
      </div>
      <button id="kh-signin-btn" onclick="authSignIn()" style="display:block;width:100%;padding:13px;background:linear-gradient(135deg,#2d6be4,#1e4fa3);color:#fff;border:none;border-radius:11px;font-size:14px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 6px 20px rgba(45,107,228,.35);transition:all .2s;margin-bottom:16px">Sign In →</button>

      <!-- 구분선 -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
        <div style="flex:1;height:1px;background:#e2e8f0"></div>
        <div style="font-size:11px;color:#94a3b8;font-weight:700">or continue with</div>
        <div style="flex:1;height:1px;background:#e2e8f0"></div>
      </div>

      <!-- 구글 로그인 -->
      <button onclick="closeAuthModal();signInWithGoogle()" style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:11px;background:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s" onmouseover="this.style.background='#f8faff';this.style.borderColor='#c7d7f0'" onmouseout="this.style.background='#fff';this.style.borderColor='#e2e8f0'">
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Continue with Google
      </button>
    </div>

    <!-- ── 회원가입 폼 ── -->
    <div id="kh-signup-form" style="display:none;padding:22px 28px 28px">
      <div style="margin-bottom:12px">
        <label style="font-size:12px;font-weight:700;color:#445566;display:block;margin-bottom:5px">Full Name</label>
        <input id="kh-auth-name" type="text" placeholder="Your name" onkeydown="if(event.key==='Enter')document.getElementById('kh-auth-email2').focus()"
          style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;transition:border-color .15s"
          onfocus="this.style.borderColor='#1e4fa3'" onblur="this.style.borderColor='#e2e8f0'">
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;font-weight:700;color:#445566;display:block;margin-bottom:5px">Email</label>
        <input id="kh-auth-email2" type="email" placeholder="you@example.com" onkeydown="if(event.key==='Enter')document.getElementById('kh-auth-pw2').focus()"
          style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;transition:border-color .15s"
          onfocus="this.style.borderColor='#1e4fa3'" onblur="this.style.borderColor='#e2e8f0'">
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;font-weight:700;color:#445566;display:block;margin-bottom:5px">Password <span style="font-size:11px;color:#94a3b8;font-weight:400">(min 8 chars, letters + numbers)</span></label>
        <div style="position:relative">
          <input id="kh-auth-pw2" type="password" placeholder="••••••••" oninput="_authCheckPwStrength(this.value)" onkeydown="if(event.key==='Enter')document.getElementById('kh-auth-pw3').focus()"
            style="width:100%;padding:11px 40px 11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;transition:border-color .15s"
            onfocus="this.style.borderColor='#1e4fa3'" onblur="this.style.borderColor='#e2e8f0'">
          <button onclick="var i=document.getElementById('kh-auth-pw2');i.type=i.type==='password'?'text':'password'" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);border:none;background:transparent;cursor:pointer;color:#94a3b8;font-size:16px">👁</button>
        </div>
        <!-- 비밀번호 강도 표시 -->
        <div id="kh-pw-strength" style="margin-top:6px;display:none">
          <div style="display:flex;gap:3px;margin-bottom:3px">
            <div id="kh-pw-s1" style="flex:1;height:3px;border-radius:99px;background:#e2e8f0;transition:background .2s"></div>
            <div id="kh-pw-s2" style="flex:1;height:3px;border-radius:99px;background:#e2e8f0;transition:background .2s"></div>
            <div id="kh-pw-s3" style="flex:1;height:3px;border-radius:99px;background:#e2e8f0;transition:background .2s"></div>
            <div id="kh-pw-s4" style="flex:1;height:3px;border-radius:99px;background:#e2e8f0;transition:background .2s"></div>
          </div>
          <div id="kh-pw-s-label" style="font-size:11px;color:#94a3b8;font-weight:600"></div>
        </div>
      </div>
      <div style="margin-bottom:18px">
        <label style="font-size:12px;font-weight:700;color:#445566;display:block;margin-bottom:5px">Confirm Password</label>
        <input id="kh-auth-pw3" type="password" placeholder="••••••••" onkeydown="if(event.key==='Enter')authSignUp()"
          style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;transition:border-color .15s"
          onfocus="this.style.borderColor='#1e4fa3'" onblur="this.style.borderColor='#e2e8f0'">
      </div>
      <button id="kh-signup-btn" onclick="authSignUp()" style="display:block;width:100%;padding:13px;background:linear-gradient(135deg,#2d6be4,#1e4fa3);color:#fff;border:none;border-radius:11px;font-size:14px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 6px 20px rgba(45,107,228,.35);transition:all .2s;margin-bottom:16px">Create Account →</button>

      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
        <div style="flex:1;height:1px;background:#e2e8f0"></div>
        <div style="font-size:11px;color:#94a3b8;font-weight:700">or</div>
        <div style="flex:1;height:1px;background:#e2e8f0"></div>
      </div>
      <button onclick="closeAuthModal();signInWithGoogle()" style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:11px;background:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s" onmouseover="this.style.background='#f8faff'" onmouseout="this.style.background='#fff'">
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Sign up with Google
      </button>
      <div style="font-size:11px;color:#94a3b8;text-align:center;margin-top:12px;line-height:1.6">
        By creating an account, you agree to our<br>
        <a href="terms-of-service" style="color:#1e4fa3;font-weight:700">Terms of Service</a>
        and
        <a href="privacy-policy" style="color:#1e4fa3;font-weight:700">Privacy Policy</a>.
      </div>
    </div>

    <!-- ── 비밀번호 재설정 폼 ── -->
    <div id="kh-reset-form" style="display:none;padding:22px 28px 28px">
      <div style="font-size:14px;font-weight:700;color:#0b1626;margin-bottom:6px">Reset Password</div>
      <div style="font-size:13px;color:#64748b;margin-bottom:18px;line-height:1.6">Enter your email and we'll send you a link to reset your password.</div>
      <div style="margin-bottom:16px">
        <label style="font-size:12px;font-weight:700;color:#445566;display:block;margin-bottom:5px">Email</label>
        <input id="kh-auth-reset-email" type="email" placeholder="you@example.com" onkeydown="if(event.key==='Enter')authResetPassword()"
          style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;transition:border-color .15s"
          onfocus="this.style.borderColor='#1e4fa3'" onblur="this.style.borderColor='#e2e8f0'">
      </div>
      <button id="kh-reset-btn" onclick="authResetPassword()" style="display:block;width:100%;padding:13px;background:linear-gradient(135deg,#2d6be4,#1e4fa3);color:#fff;border:none;border-radius:11px;font-size:14px;font-weight:900;cursor:pointer;font-family:inherit;margin-bottom:12px">Send Reset Link →</button>
      <button onclick="_authSwitchTab('signin')" style="display:block;width:100%;padding:11px;border:1.5px solid #e2e8f0;border-radius:11px;background:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;color:#445566">← Back to Sign In</button>
    </div>

  </div>
</div>
<style>
@keyframes khAuthIn{from{transform:scale(.88) translateY(20px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}
#kh-tab-signin.on{color:#1e4fa3!important;border-bottom-color:#1e4fa3!important}
#kh-tab-signup.on{color:#1e4fa3!important;border-bottom-color:#1e4fa3!important}
</style>
`;
  document.body.appendChild(div);
}

// ── 비밀번호 강도 체크 ────────────────────────────────────────
function _authCheckPwStrength(pw) {
  var wrap = document.getElementById('kh-pw-strength');
  if (!wrap) return;
  if (!pw) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';

  var score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  score = Math.min(score, 4);

  var colors  = ['#e2e8f0','#cc2200','#f59e0b','#16a34a','#1e4fa3'];
  var labels  = ['','Weak','Fair','Good','Strong'];
  var lblColors = ['','#cc2200','#f59e0b','#16a34a','#1e4fa3'];

  for (var i = 1; i <= 4; i++) {
    var bar = document.getElementById('kh-pw-s' + i);
    if (bar) bar.style.background = i <= score ? colors[score] : '#e2e8f0';
  }
  var lbl = document.getElementById('kh-pw-s-label');
  if (lbl) { lbl.textContent = labels[score]; lbl.style.color = lblColors[score]; }
}

// 로그아웃
async function signOut(options) {
  options = options || {};
  var scope = options.scope || 'global';
  var message = options.message || (scope === 'global' ? 'Signed out on all devices' : 'Signed out successfully');
  var sb = getSupa();
  if (sb) {
    await sb.auth.signOut({ scope: scope });
  }
  // 현재 브라우저에 남은 세션 흔적은 scope와 관계없이 정리
  [localStorage, sessionStorage].forEach(function(storage) {
    try {
      Object.keys(storage).forEach(function(key) {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          storage.removeItem(key);
        }
      });
    } catch (e) {}
  });
  supaUser = null;
  updateAuthUI();
  toast(message);
}

// 세션 확인
async function checkSession() {
  var sb = getSupa();
  if (!sb) { window._sessionChecked = true; return; }

  // 세션 변화 감지 — OAuth 코드 교환 이전에 등록해야 SIGNED_IN 이벤트를 놓치지 않음
  sb.auth.onAuthStateChange(function(event, session) {
    if (event === 'SIGNED_OUT') {
      supaUser = null;
      _savedWordsSet = null;
      updateAuthUI();
      updateCommentForm();
    } else if (event === 'SIGNED_IN') {
      supaUser = session ? session.user : null;
      _sessionWarningShown = false;
      closeAuthModal();
      updateAuthUI();
      updateCommentForm();
      renderDailyMission();
      window.dispatchEvent(new Event('kh-auth-signed-in'));
      setTimeout(function(){ updateAuthUI(); }, 300);
      // DB 동기화는 idle 시점으로 지연
      var _deferSI = typeof requestIdleCallback === 'function' ? requestIdleCallback : function(cb){ setTimeout(cb, 200); };
      _deferSI(function() {
        _syncSavedWordsFromDB();
        _rehydrateUserState();
        if (!window.location.pathname.includes('onboarding')) {
          checkOnboardingStatus();
        }
      });
    } else if (event === 'TOKEN_REFRESHED') {
      supaUser = session ? session.user : null;
      updateAuthUI();
    } else if (event === 'USER_UPDATED') {
      supaUser = session ? session.user : null;
      updateAuthUI();
    } else {
      supaUser = session ? session.user : null;
      updateAuthUI();
      updateCommentForm();
      renderDailyMission();
      if (supaUser) {
        _syncSavedWordsFromDB();
        window.dispatchEvent(new Event('kh-auth-signed-in'));
      }
    }
  });

  // OAuth 콜백 처리 — ?code= 파라미터 (PKCE) 또는 #access_token (implicit)
  // OAuth 콜백 처리 — detectSessionInUrl:false 이므로 수동으로만 처리
  var hasCode = window.location.search.includes('code=');
  var hasHash = window.location.hash && window.location.hash.includes('access_token');

  if (hasCode) {
    // PKCE flow: code → token 교환
    var urlParams = new URLSearchParams(window.location.search);
    var code = urlParams.get('code');
    if (code) {
      var exchangeErr = null;
      try {
        var exchRes = await sb.auth.exchangeCodeForSession(code);
        if (exchRes.error) exchangeErr = exchRes.error;
      } catch(e) {
        exchangeErr = e;
      }
      if (exchangeErr) {
        console.warn('exchangeCodeForSession failed:', exchangeErr.message || exchangeErr);
      }
    }
    // URL에서 code 파라미터 제거 (재사용 방지)
    window.history.replaceState(null, '', window.location.pathname);
  } else if (hasHash) {
    // Implicit flow: hash에서 access_token 추출
    try {
      var hashParams = new URLSearchParams(window.location.hash.slice(1));
      var accessToken = hashParams.get('access_token');
      var refreshToken = hashParams.get('refresh_token');
      if (accessToken) {
        await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken || '' });
      }
    } catch(e) {
      console.warn('implicit flow session failed:', e);
    }
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  var { data } = await sb.auth.getSession();
  if (data && data.session && data.session.user) {
    supaUser = data.session.user;
    updateAuthUI();
    updateCommentForm();
    renderDailyMission();
    window.dispatchEvent(new Event('kh-auth-signed-in'));
    // DB 동기화는 화면 렌더와 무관 — idle 시점으로 지연 (연결 경쟁 방지)
    var _deferAuth = typeof requestIdleCallback === 'function' ? requestIdleCallback : function(cb){ setTimeout(cb, 200); };
    _deferAuth(function() {
      _syncSavedWordsFromDB();
      _rehydrateUserState();
      if (!window.location.pathname.includes('onboarding')) {
        checkOnboardingStatus();
      }
    });
  }
  window._sessionChecked = true;
  updateAuthUI();
}

// UI 업데이트
function updateAuthUI() {
  // Remove flash guard now that we know the real auth state
  var guard = document.getElementById('kh-auth-flash-guard');
  if (guard) guard.remove();
  var signinBtn  = document.getElementById('topbar-signin-btn');
  var adminBtn   = document.getElementById('topbar-admin-btn');
  var authMenu   = document.getElementById('topbar-auth-menu');
  var userAvatar = document.getElementById('topbar-user-avatar');
  var userDrop   = document.getElementById('topbar-user-dropdown');

  // 관리자 이메일 목록 (본인 Gmail 추가)
  var ADMIN_EMAILS = ['enane960819@gmail.com'];
  var isAdmin = supaUser && ADMIN_EMAILS.includes(supaUser.email);
  window._isAdmin = isAdmin; // 다른 파일에서 참조용

  if (supaUser) {
    // 로그인 상태
    if (signinBtn) {
      signinBtn.style.display = 'none';
    }
    if (authMenu) authMenu.style.display = 'inline-flex';
    if (userAvatar) {
      var avatar = supaUser.user_metadata && supaUser.user_metadata.avatar_url;
      userAvatar.style.display = 'inline-flex';
      userAvatar.innerHTML = (avatar && isValidImageURL(avatar))
        ? '<img src="' + escapeAttr(avatar) + '" style="width:28px;height:28px;border-radius:50%;vertical-align:middle">'
        : '<span style="font-size:13px">' + escapeHTML((supaUser.email || '').charAt(0).toUpperCase()) + '</span>';
    }
    if (userDrop) {
      var name = (supaUser.user_metadata && (supaUser.user_metadata.full_name || supaUser.user_metadata.name)) || (supaUser.email || '').split('@')[0];
      userDrop.innerHTML =
        '<div class="kh-user-dropdown-head">'
        + '<div class="kh-user-dropdown-name">' + escapeHtml(name || 'User') + '</div>'
        + '<div class="kh-user-dropdown-email">' + escapeHtml(supaUser.email || '') + '</div>'
        + '<div id="kh-user-dropdown-stats" style="margin-top:8px;font-size:12px;color:#64748b">✨ XP 0 · 🐾 냥 0</div>'
        + '</div>'
        + '<a href="korehan-mypage.html" class="kh-user-dropdown-link">' + khIcon('circle-user-round', 'My Page', 'kh-ui-icon-sm') + '</a>'
        + (isAdmin ? '<a href="korehan-x9f4k2m7.html" class="kh-user-dropdown-link">' + khIcon('settings', 'Admin CMS', 'kh-ui-icon-sm') + '</a>' : '')
        + '<button type="button" class="kh-user-dropdown-link kh-user-dropdown-btn" onclick="signOut();closeTopbarUserMenu()">' + khIcon('log-out', 'Sign Out', 'kh-ui-icon-sm') + '</button>';
      (function loadDropdownStats(){
        var sb = getSupa && getSupa();
        if (!sb || !supaUser || !supaUser.id) return;
        sb.from('user_stats').select('xp, coin_balance').eq('user_id', supaUser.id).maybeSingle()
          .then(function(r){
            var statsEl = document.getElementById('kh-user-dropdown-stats');
            if (!statsEl) return;
            var xp = Number(r && r.data && r.data.xp || 0);
            var coin = Number(r && r.data && r.data.coin_balance || 0);
            statsEl.textContent = '✨ XP ' + xp.toLocaleString() + ' · 🐾 냥 ' + coin.toLocaleString();
          })
          .catch(function(){});
      })();
    }
    if (adminBtn) adminBtn.style.display = isAdmin ? 'inline-block' : 'none';
  } else {
    // Logged out state
    if (signinBtn) {
      signinBtn.textContent = 'Sign In';
      signinBtn.style.display = window._sessionChecked ? '' : 'none';
      signinBtn.onclick = function(e){ e.preventDefault(); openAuthModal("signin"); };
    }
    if (authMenu) authMenu.style.display = 'none';
    if (userAvatar) userAvatar.style.display = 'none';
    if (userDrop) userDrop.classList.remove('on');
    if (adminBtn) adminBtn.style.display = 'none';
  }
  // Join Free button: only visible when logged out
  var joinBtn = document.getElementById('topbar-join-btn');
  if (joinBtn) joinBtn.style.display = supaUser ? 'none' : (window._sessionChecked ? '' : 'none');
  updateSidebarAuth();
  injectMobileBottomNav();
  renderKhLucideIcons();
}

function toggleTopbarUserMenu(evt) {
  if (evt) evt.preventDefault();
  var drop = document.getElementById('topbar-user-dropdown');
  if (!drop) return;
  drop.classList.toggle('on');
}

function closeTopbarUserMenu() {
  var drop = document.getElementById('topbar-user-dropdown');
  if (drop) drop.classList.remove('on');
}

document.addEventListener('click', function(evt){
  var wrap = document.getElementById('topbar-auth-menu');
  if (!wrap || wrap.contains(evt.target)) return;
  closeTopbarUserMenu();
});

const DB_KEY          = 'korehan_db';
const K_PHRASES       = 'korehan_phrases';
const K_WORDBANK      = 'korehan_wordbank';
const K_SENTENCES     = 'korehan_sentences';
const K_OPINIONS      = 'korehan_opinions';
const K_ADMIN_SESSION = 'korehan_admin_session';

const K_NEON_THEME    = 'korehan_neon_theme';

function isKhNeonEnabled() {
  try {
    var saved = localStorage.getItem(K_NEON_THEME);
    if (saved === '1') return true;
    if (saved === '0') return false;
    return localStorage.getItem('korehan_home_neon') === '1';
  } catch(e) {
    return false;
  }
}

function syncNeonToggleButtons() {
  var on = !!(document.body && document.body.classList.contains('kh-neon-on'));
  [
    ['topbar-neon-toggle', 'zap', 'Neon '],
    ['home-neon-toggle', 'zap', 'Neon '],
    ['kh-sb-neon-toggle', 'zap', 'Neon theme: ']
  ].forEach(function(pair) {
    var btn = document.getElementById(pair[0]);
    if (!btn) return;
    btn.innerHTML = khIcon(pair[1], pair[2] + (on ? 'ON' : 'OFF'), 'kh-ui-icon-sm');
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.classList.toggle('on', on);
  });
  renderKhLucideIcons();
}

function applyKhNeon(on) {
  if (!document.body) return;
  document.body.classList.toggle('kh-neon-on', !!on);
  syncNeonToggleButtons();
}

function toggleKhNeon(evt) {
  if (evt && evt.preventDefault) evt.preventDefault();
  var next = !(document.body && document.body.classList.contains('kh-neon-on'));
  try {
    localStorage.setItem(K_NEON_THEME, next ? '1' : '0');
    localStorage.setItem('korehan_home_neon', next ? '1' : '0');
  } catch(e) {}
  applyKhNeon(next);
  _syncPrefsToDB();
}

function initKhNeonTheme() {
  applyKhNeon(isKhNeonEnabled());
}

window.isKhNeonEnabled = isKhNeonEnabled;
window.applyKhNeon = applyKhNeon;
window.toggleKhNeon = toggleKhNeon;
window.syncNeonToggleButtons = syncNeonToggleButtons;

const DEF_PHRASES = [
  {
    ko:'고생 끝에 낙이 온다',
    rom:'go-saeng kkeut-e nak-i on-da',
    en:'After hardship comes happiness.',
    intro:'A classic Korean proverb used to encourage someone who is going through a difficult stretch.',
    nuance:'Used when reminding learners that steady effort pays off, especially after a tiring or frustrating period.',
    examples:[
      {ko:'시험 준비가 힘들어도 고생 끝에 낙이 온다고 생각해 봐요.', en:'Even if test prep is hard, try thinking that happiness comes after hardship.'},
      {ko:'매일 한국어를 조금씩 공부하면 고생 끝에 낙이 올 거예요.', en:'If you study Korean little by little every day, the reward will come after the struggle.'}
    ],
    related:['인내','꾸준함','노력']
  },
  {
    ko:'시작이 반이다',
    rom:'si-jak-i ban-i-da',
    en:'Starting is half the battle.',
    intro:'A proverb that says beginning a task is already a huge part of finishing it.',
    nuance:'Great for daily study motivation when someone is procrastinating or hesitating to begin.',
    examples:[
      {ko:'오늘 한 문제라도 풀면 시작이 반이에요.', en:'If you solve even one question today, that is already half the battle.'},
      {ko:'한국어 일기 첫 줄만 써도 시작이 반이다라는 말이 딱 맞아요.', en:'If you write just the first line of your Korean diary, “starting is half the battle” fits perfectly.'}
    ],
    related:['첫걸음','동기부여','습관']
  },
  {
    ko:'백문이 불여일견',
    rom:'baeng-mun-i bul-yeo-il-gyeon',
    en:'Seeing once is better than hearing a hundred times.',
    intro:'A proverb used when direct experience teaches better than repeated explanations.',
    nuance:'Useful for language learning, travel, culture, and real-life practice contexts.',
    examples:[
      {ko:'문법 설명을 백 번 듣는 것보다 예문을 직접 보는 게 백문이 불여일견이에요.', en:'Rather than hearing grammar explained a hundred times, seeing examples yourself is better.'},
      {ko:'한국에 가서 직접 말해 보니 백문이 불여일견이라는 걸 느꼈어요.', en:'After going to Korea and speaking directly, I felt that seeing once is better than hearing a hundred times.'}
    ],
    related:['직접 경험','실전','예문']
  },
  {
    ko:'티끌 모아 태산',
    rom:'ti-kkeul mo-a tae-san',
    en:'Dust gathered together becomes a mountain.',
    intro:'A proverb meaning small efforts add up to something big over time.',
    nuance:'Very natural for study streaks, vocabulary building, savings, and habit-building.',
    examples:[
      {ko:'단어 다섯 개씩 외워도 티끌 모아 태산이에요.', en:'Even memorizing five words at a time adds up like dust becoming a mountain.'},
      {ko:'짧게 공부해도 매일 하면 티끌 모아 태산이죠.', en:'Even short study sessions add up if you do them every day.'}
    ],
    related:['누적','습관','복습']
  },
];
const DEF_WORDBANK = [
  {ko:'뉴스', rom:'nyu-seu',  en:'news'},
  {ko:'사회', rom:'sa-hoe',   en:'society'},
  {ko:'국제', rom:'guk-je',   en:'international'},
  {ko:'문화', rom:'mun-hwa',  en:'culture'},
  {ko:'한국', rom:'han-guk',  en:'Korea'},
  {ko:'학교', rom:'hak-gyo',  en:'school'},
];
const DEF_SENTENCES = [
  {id:'e1',  level:'Beginner',      ko:'오늘 날씨가 좋아요.',                                    en:'The weather is nice today.'},
  {id:'e2',  level:'Beginner',      ko:'저는 학교에 가요.',                                       en:'I go to school.'},
  {id:'e3',  level:'Beginner',      ko:'가족과 함께 집에 있어요.',                                en:'I am at home with my family.'},
  {id:'e4',  level:'Beginner',      ko:'오늘은 봄처럼 따뜻해요.',                                en:'Today is warm like spring.'},
  {id:'e5',  level:'Beginner',      ko:'이 뉴스는 중요해요.',                                     en:'This news is important.'},
  {id:'e6',  level:'Intermediate',  ko:'대통령이 경제 회복 방안을 발표했어요.',                    en:'The president announced a plan for economic recovery.'},
  {id:'e7',  level:'Intermediate',  ko:'정부는 물가 안정을 위한 정책을 검토하고 있어요.',           en:'The government is reviewing policies to stabilize prices.'},
  {id:'e8',  level:'Intermediate',  ko:'반도체 수출이 지난달보다 증가했어요.',                     en:'Semiconductor exports increased compared to last month.'},
  {id:'e9',  level:'Intermediate',  ko:'서울시는 한강 개발 계획을 승인했어요.',                    en:'Seoul approved the Han River development plan.'},
  {id:'e10', level:'Intermediate',  ko:'한국 드라마가 전 세계에서 인기를 얻고 있어요.',            en:'Korean dramas are gaining popularity around the world.'},
  {id:'e11', level:'Advanced',      ko:'국회에서 민생 안정 법안이 통과됐다.',                      en:'A livelihood stability bill passed the National Assembly.'},
  {id:'e12', level:'Advanced',      ko:'유엔 안보리는 긴급 회의를 소집해 결의안을 채택했다.',       en:'The UN Security Council convened an emergency meeting and adopted a resolution.'},
  {id:'e13', level:'Advanced',      ko:'한국은행은 기준금리를 동결하고 하반기 인하를 검토하기로 했다.', en:'The Bank of Korea froze the base rate and decided to review a cut in the second half.'},
  {id:'e14', level:'Advanced',      ko:'저출생 위기 대응을 위한 범정부 대책이 필요하다는 목소리가 높다.', en:'There are growing calls for a whole-of-government response to the low birth rate crisis.'},
  {id:'e15', level:'Advanced',      ko:'탄소중립 목표 달성을 위해 재생에너지 투자를 확대해야 한다.',   en:'Investment in renewable energy must be expanded to achieve carbon neutrality goals.'},
];

// ── Security helpers ─────────────────────────────────────────
function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function escapeAttr(str) {
  return escapeHTML(str).replace(/\\/g,'\\\\');
}
// Strip dangerous HTML (scripts, event handlers, iframes) but keep safe tags
function sanitizeHTML(html) {
  if (!html) return '';
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>/gi, '')
    .replace(/<link[\s\S]*?>/gi, '')
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\bon\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript\s*:/gi, 'blocked:')
    .replace(/data\s*:\s*text\/html/gi, 'blocked:');
}
function isValidImageURL(url) {
  if (!url || typeof url !== 'string') return false;
  try { var u = new URL(url); return u.protocol === 'https:' || u.protocol === 'http:'; }
  catch(e) { return false; }
}

// ── localStorage ──────────────────────────────────────────────
function lsGet(key, def) {
  try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch(e) { return def; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
}

function normalizePhrase(row) {
  row = row || {};
  var examples = Array.isArray(row.examples) ? row.examples : [];
  if (!examples.length && row.example_ko) examples = [{ ko: row.example_ko || '', en: row.example_en || '' }];
  return {
    ko: row.ko || '',
    rom: row.rom || '',
    en: row.en || '',
    intro: row.intro || row.desc || row.description || '',
    nuance: row.nuance || row.note || '',
    examples: examples.slice(0, 6).map(function(ex){ return { ko: ex.ko || '', en: ex.en || '' }; }).filter(function(ex){ return ex.ko; }),
    related: Array.isArray(row.related) ? row.related.filter(Boolean).slice(0, 8) : []
  };
}
function getPhraseSourceRows() {
  // DB(app_settings) 우선 — 기기별 차이 방지
  var raw = _appSettings && _appSettings.phrases;
  if (raw && typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch(e) { raw = null; }
  }
  if (Array.isArray(raw) && raw.length) return raw;

  var local = lsGet(K_PHRASES, null);
  if (Array.isArray(local) && local.length) return local;

  return DEF_PHRASES;
}
function getPhrases()   { return getPhraseSourceRows().map(normalizePhrase); }
function getTodaysPhraseIndex() {
  var phrases = getPhrases();
  if (!phrases.length) return 0;
  return Math.floor((Date.now() + 9*3600000) / 86400000) % phrases.length;
}
function getTodaysPhrase() {
  var phrases = getPhrases();
  return phrases[getTodaysPhraseIndex()] || normalizePhrase({});
}

async function getPhrasesAsync() {
  await loadAppSettings();
  return getPhrases();
}

async function saveSharedPhrases(rows) {
  var normalized = (rows || []).map(normalizePhrase).filter(function(row){ return row.ko; });
  if (!normalized.length) normalized = DEF_PHRASES.map(normalizePhrase);
  lsSet(K_PHRASES, normalized);
  _appSettings.phrases = normalized;

  var sb = getSupa();
  if (!sb || !supaUser) return normalized;
  try {
    await sb.from('app_settings').upsert({
      key: 'phrases',
      value: normalized,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });
  } catch(e) {}
  return normalized;
}

// ── 공유 데이터 ───────────────────────────────────────────────
function getWordBank()  { return lsGet(K_WORDBANK,  DEF_WORDBANK);  }
function getSentences() { return lsGet(K_SENTENCES, DEF_SENTENCES); }
function getOpinions()  { return lsGet(K_OPINIONS,  []);            }



function toast(msg, typeOrBool) {
  var bg = '#1a3a6b';
  if (typeOrBool === true || typeOrBool === 'error') bg = '#cc2200';
  else if (typeOrBool === 'warn')    bg = '#b45309';
  else if (typeOrBool === 'success') bg = '#15803d';
  var d = document.createElement('div');
  d.style.cssText = 'position:fixed;bottom:22px;right:22px;z-index:9999;background:'+bg+';color:#fff;padding:11px 18px;border-radius:8px;font-size:13px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,0.28);max-width:340px;line-height:1.4;transition:opacity .2s;';
  d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(function(){ d.style.opacity='0'; setTimeout(function(){ d.remove(); },200); }, 3500);
}

// ── 저장 단어 ─────────────────────────────────────────────────
var K_SAVED = 'korehan_saved_words';
var _savedWordsSet = null; // Set of ko strings, populated from DB on auth

// Fetch saved words from DB and populate _savedWordsSet (call after auth ready)
async function _syncSavedWordsFromDB() {
  if (!supaUser) { _savedWordsSet = null; return; }
  var sb = getSupa();
  if (!sb) return;
  try {
    var res = await sb.from('user_saved_words').select('*').eq('user_id', supaUser.id);
    if (res.data && res.data.length) {
      _savedWordsSet = new Set();
      res.data.forEach(function(row) {
        var k = row.word_ko || row.ko || '';
        if (k) _savedWordsSet.add(k);
      });
      // Also sync to localStorage for offline/fallback
      var normalized = res.data.map(normalizeSavedWord).filter(function(w){ return w && w.ko; });
      lsSet(K_SAVED, normalized);
    } else {
      _savedWordsSet = new Set();
    }
  } catch(e) {
    // If DB fetch fails, build set from localStorage
    if (!_savedWordsSet) {
      var local = lsGet(K_SAVED, []);
      _savedWordsSet = new Set(local.map(function(w){ return w.ko || w.word_ko || ''; }).filter(Boolean));
    }
  }
}
function normalizeSavedWord(row) {
  if (!row) return null;
  return {
    ko: row.ko || row.word_ko || row.word || '',
    rom: row.rom || row.word_rom || row.reading || '',
    en: row.en || row.word_en || row.meaning || ''
  };
}
async function dbGetSavedWords() {
  var localSaved = lsGet(K_SAVED, []);
  if (!supaUser) return localSaved;
  var sb = getSupa();
  if (!sb) return localSaved;
  try {
    var res = await sb.from('user_saved_words').select('*').eq('user_id', supaUser.id).order('created_at', { ascending: false });
    if (res.data && res.data.length) {
      var normalized = res.data.map(normalizeSavedWord).filter(function(w){ return w && w.ko; });
      lsSet(K_SAVED, normalized);
      return normalized;
    }
  } catch(e) {}
  return localSaved;
}
async function dbSaveWord(ko, rom, en) {
  // Update in-memory set immediately for cross-device consistency
  if (_savedWordsSet) _savedWordsSet.add(ko);
  // localStorage에도 추가 (중복 제거)
  var saved = lsGet(K_SAVED, []);
  var alreadyLocal = !!saved.find(function(w){ return w.ko === ko; });
  if (!alreadyLocal) {
    saved.push({ko:ko,rom:rom,en:en});
    lsSet(K_SAVED, saved);
  }

  if (!supaUser) {
    // 비로그인: localStorage만, 새 단어일 때만 XP
    if (!alreadyLocal) {
      if (typeof trackActivityOnWordSave === 'function') trackActivityOnWordSave();
    }
    return { ok: true, source: 'local' };
  }

  var sb = getSupa();
  if (!sb) {
    // Supabase 없음: localStorage에 추가됐으면 카운터 증가
    if (!alreadyLocal && typeof trackActivityOnWordSave === 'function') trackActivityOnWordSave();
    return { ok: true, source: 'local' };
  }

  try {
    // INSERT (upsert 대신): conflict 여부로 새 단어인지 판단
    var res = await sb.from('user_saved_words').upsert({
      user_id: supaUser.id,
      word_key: ko,
      word_ko: ko,
      word_rom: rom || '',
      word_en: en || ''
    }, { onConflict: 'user_id,word_key' });

    if (!res.error) {
      if (!alreadyLocal && typeof trackActivityOnWordSave === 'function') trackActivityOnWordSave();
      return { ok: true, source: 'supabase' };
    } else {
      console.warn('[dbSaveWord]', res.error.message);
      return { ok: false, source: 'local', error: res.error };
    }
  } catch(e) {
    // DB 예외 — localStorage엔 이미 추가됐으므로 카운터만 증가
    if (!alreadyLocal && typeof trackActivityOnWordSave === 'function') trackActivityOnWordSave();
    return { ok: false, source: 'local', error: e };
  }
}
async function dbRemoveWord(ko) {
  // Update in-memory set immediately for cross-device consistency
  if (_savedWordsSet) _savedWordsSet.delete(ko);
  var saved = lsGet(K_SAVED, []).filter(function(w){ return w.ko !== ko; });
  lsSet(K_SAVED, saved);
  if (!supaUser) return { ok: true, source: 'local' };
  var sb = getSupa();
  if (!sb) return { ok: true, source: 'local' };
  try {
    await sb.from('user_saved_words').delete().eq('user_id', supaUser.id).or('word_ko.eq."' + ko.replace(/"/g, '\\"') + '",ko.eq."' + ko.replace(/"/g, '\\"') + '"');
    return { ok: true, source: 'supabase' };
  } catch(e) {
    return { ok: false, source: 'local', error: e };
  }
}

// 저장 버튼 상태 복원 — 컨테이너 내 모든 Save 버튼에 적용
async function restoreSaveButtons(containerId) {
  var container = containerId ? document.getElementById(containerId) : document;
  if (!container) return;

  // Use DB-backed set if available, otherwise fall back to localStorage
  var saved = lsGet(K_SAVED, []);
  var savedSet = _savedWordsSet || new Set(saved.map(function(w){ return w.ko || w.word_ko || ''; }).filter(Boolean));

  function applyState(set) {
    // dp-vocab-item (conversations)
    container.querySelectorAll('.dp-vocab-item, .dp-vocab-item2').forEach(function(item) {
      var ko = item.dataset.ko || '';
      if (!ko) return;
      var btn = item.querySelector('.dp-vi-save, button');
      if (!btn) return;
      if (set.has(ko)) {
        btn.classList.add('saved');
        btn.textContent = '✓ Saved';
      } else {
        btn.classList.remove('saved');
        btn.textContent = '+ Save';
      }
    });
    // st-vocab-item (stories)
    container.querySelectorAll('.st-vocab-item, [data-ko]').forEach(function(item) {
      var ko = item.dataset.ko || '';
      if (!ko) return;
      var btn = item.querySelector('button');
      if (!btn) return;
      if (set.has(ko)) {
        btn.classList.add('saved');
        btn.textContent = '✓ Saved';
      }
    });
  }

  applyState(savedSet);

  // DB에서 최신 목록으로 한 번 더 업데이트
  if (supaUser) {
    try {
      var fresh = await dbGetSavedWords();
      var freshSet = new Set(fresh.map(function(w){ return w.ko || w.word_ko || ''; }).filter(Boolean));
      applyState(freshSet);
    } catch(e) {}
  }
}

function articleUrl(id) {
  return 'korehan-article.html?id=' + encodeURIComponent(id);
}

// ── SEED DATA ─────────────────────────────────────────────────
// ── DB (Supabase 기반) ───────────────────────────────────────────
// 기사는 Supabase articles 테이블에서 로드
var _articlesCache = null;
var _articlesCacheTime = 0;
var CACHE_TTL = 300000; // 5분 (메모리 캐시)
var ARTICLES_STORAGE_KEY = 'kh_articles_cache_v2';
var ARTICLES_STORAGE_MAX_AGE = 60 * 60 * 1000; // 1시간 (localStorage — stale-while-revalidate로 항상 백그라운드 갱신)
var HOME_ARTICLE_SELECT = '*';

// 이미지 없는 기사용 placeholder — SVG inline data URI (깨지지 않음)
var KH_IMG_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='400' fill='%231e293b'%3E%3Crect width='600' height='400'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.35em' font-family='sans-serif' font-size='18' fill='%2364748b'%3EKoreHan News%3C/text%3E%3C/svg%3E";

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
      query = query.limit(30);  // 홈에 필요한 최대: hero 7 + top 4 + grid 12 = 23
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

// ── VOCAB ─────────────────────────────────────────────────────
var VOCAB = {
  /* ── 정치 / 행정 ── */
  "대통령":{"en":"president","rom":"dae-tong-ryeong"},
  "국회":{"en":"National Assembly","rom":"guk-hoe"},
  "정부":{"en":"government","rom":"jeong-bu"},
  "법안":{"en":"bill / legislation","rom":"beob-an"},
  "표결":{"en":"vote","rom":"pyo-gyeol"},
  "발표":{"en":"announcement","rom":"bal-pyo"},
  "승인":{"en":"approval","rom":"seung-in"},
  "확정":{"en":"confirmed","rom":"hwak-jeong"},
  "검토":{"en":"review / consideration","rom":"geom-to"},
  "결정":{"en":"decision","rom":"gyeol-jeong"},
  "지지율":{"en":"approval rating","rom":"ji-ji-yul"},
  "정책":{"en":"policy","rom":"jeong-chaek"},
  "선거":{"en":"election","rom":"seon-geo"},
  "후보":{"en":"candidate","rom":"hu-bo"},
  "여당":{"en":"ruling party","rom":"yeo-dang"},
  "야당":{"en":"opposition party","rom":"ya-dang"},
  "국무총리":{"en":"prime minister","rom":"guk-mu-chong-ri"},
  "장관":{"en":"minister","rom":"jang-gwan"},
  "국민":{"en":"citizen / people","rom":"gung-min"},
  "행정":{"en":"administration","rom":"haeng-jeong"},
  "개혁":{"en":"reform","rom":"gae-hyeok"},
  "청와대":{"en":"Blue House (presidential office)","rom":"cheong-wa-dae"},
  "민주주의":{"en":"democracy","rom":"min-ju-ju-eui"},
  "헌법":{"en":"constitution","rom":"heon-beob"},
  "탄핵":{"en":"impeachment","rom":"tan-haek"},
  /* ── 경제 / 금융 ── */
  "경제":{"en":"economy / economic","rom":"gyeong-je"},
  "회복":{"en":"recovery","rom":"hoe-bok"},
  "투자":{"en":"investment","rom":"tu-ja"},
  "민간":{"en":"private sector","rom":"min-gan"},
  "기준금리":{"en":"base interest rate","rom":"gi-jun-geum-ri"},
  "금리":{"en":"interest rate","rom":"geum-ri"},
  "동결":{"en":"freeze / hold","rom":"dong-gyeol"},
  "인하":{"en":"cut / reduction","rom":"in-ha"},
  "인상":{"en":"raise / increase","rom":"in-sang"},
  "수출":{"en":"export","rom":"su-chul"},
  "수입":{"en":"import","rom":"su-ip"},
  "무역":{"en":"trade","rom":"mu-yeok"},
  "흑자":{"en":"surplus","rom":"heuk-ja"},
  "적자":{"en":"deficit","rom":"jeok-ja"},
  "코스피":{"en":"KOSPI (Korea stock index)","rom":"ko-seu-pi"},
  "부동산":{"en":"real estate","rom":"bu-dong-san"},
  "아파트":{"en":"apartment","rom":"a-pa-teu"},
  "반도체":{"en":"semiconductor","rom":"ban-do-che"},
  "공급":{"en":"supply","rom":"gong-geup"},
  "수요":{"en":"demand","rom":"su-yo"},
  "계약":{"en":"contract","rom":"gye-yak"},
  "양산":{"en":"mass production","rom":"yang-san"},
  "하반기":{"en":"second half of year","rom":"ha-ban-gi"},
  "상반기":{"en":"first half of year","rom":"sang-ban-gi"},
  "성장":{"en":"growth","rom":"seong-jang"},
  "물가":{"en":"prices / cost of living","rom":"mul-ga"},
  "인플레이션":{"en":"inflation","rom":"in-peul-le-i-syeon"},
  "예산":{"en":"budget","rom":"ye-san"},
  "세금":{"en":"tax","rom":"se-geum"},
  "주가":{"en":"stock price","rom":"ju-ga"},
  "기업":{"en":"company / enterprise","rom":"gi-eob"},
  "매출":{"en":"revenue / sales","rom":"mae-chul"},
  "이익":{"en":"profit","rom":"i-ik"},
  "손실":{"en":"loss","rom":"son-sil"},
  /* ── 사회 ── */
  "사회":{"en":"society","rom":"sa-hoe"},
  "교원":{"en":"teacher / educator","rom":"gyo-won"},
  "파업":{"en":"strike","rom":"pa-eob"},
  "예고":{"en":"notice / warning","rom":"ye-go"},
  "저출생":{"en":"low birth rate","rom":"jeo-chul-saeng"},
  "위기":{"en":"crisis","rom":"wi-gi"},
  "인구":{"en":"population","rom":"in-gu"},
  "고령화":{"en":"aging (society)","rom":"go-ryeong-hwa"},
  "복지":{"en":"welfare","rom":"bok-ji"},
  "의료":{"en":"medical / healthcare","rom":"eui-ryo"},
  "병원":{"en":"hospital","rom":"byeong-won"},
  "교육":{"en":"education","rom":"gyo-yuk"},
  "대학":{"en":"university","rom":"dae-hak"},
  "취업":{"en":"employment / getting a job","rom":"chwi-eob"},
  "실업":{"en":"unemployment","rom":"sil-eob"},
  "노동":{"en":"labor / work","rom":"no-dong"},
  "근로자":{"en":"worker / employee","rom":"geun-ro-ja"},
  "최저임금":{"en":"minimum wage","rom":"choe-jeo-im-geum"},
  "주거":{"en":"housing / residence","rom":"ju-geo"},
  "범죄":{"en":"crime","rom":"beom-joe"},
  "사건":{"en":"incident / case","rom":"sa-geon"},
  "사고":{"en":"accident","rom":"sa-go"},
  "피해":{"en":"damage / harm","rom":"pi-hae"},
  "지원":{"en":"support / aid","rom":"ji-won"},
  "봉사":{"en":"volunteer service","rom":"bong-sa"},
  /* ── 국제 / 외교 ── */
  "국제":{"en":"international","rom":"guk-je"},
  "유엔":{"en":"United Nations","rom":"yu-en"},
  "안보리":{"en":"Security Council","rom":"an-bo-ri"},
  "긴급":{"en":"emergency / urgent","rom":"gin-geup"},
  "회의":{"en":"meeting / conference","rom":"hoe-eui"},
  "결의":{"en":"resolution","rom":"gyeol-eui"},
  "나토":{"en":"NATO","rom":"na-to"},
  "방위비":{"en":"defense spending","rom":"bang-wi-bi"},
  "정상":{"en":"summit / leader","rom":"jeong-sang"},
  "중동":{"en":"Middle East","rom":"jung-dong"},
  "협약":{"en":"treaty / agreement","rom":"hyeob-yak"},
  "탄소중립":{"en":"carbon neutrality","rom":"tan-so-jung-nip"},
  "협상":{"en":"negotiation","rom":"hyeob-sang"},
  "합의":{"en":"agreement","rom":"hab-eui"},
  "외교":{"en":"diplomacy","rom":"oe-gyo"},
  "대사관":{"en":"embassy","rom":"dae-sa-gwan"},
  "제재":{"en":"sanctions","rom":"je-jae"},
  "동맹":{"en":"alliance","rom":"dong-maeng"},
  "군사":{"en":"military","rom":"gun-sa"},
  "전쟁":{"en":"war","rom":"jeon-jaeng"},
  "휴전":{"en":"ceasefire","rom":"hyu-jeon"},
  "핵":{"en":"nuclear","rom":"haek"},
  "미사일":{"en":"missile","rom":"mi-sa-il"},
  "북한":{"en":"North Korea","rom":"buk-han"},
  "남한":{"en":"South Korea","rom":"nam-han"},
  "한반도":{"en":"Korean Peninsula","rom":"han-ban-do"},
  "평화":{"en":"peace","rom":"pyeong-hwa"},
  /* ── 문화 / 연예 ── */
  "문화":{"en":"culture","rom":"mun-hwa"},
  "공연":{"en":"performance / show","rom":"gong-yeon"},
  "매진":{"en":"sold out","rom":"mae-jin"},
  "드라마":{"en":"drama / TV series","rom":"deu-ra-ma"},
  "김장":{"en":"kimchi-making tradition","rom":"gim-jang"},
  "등재":{"en":"registration / listing","rom":"deung-jae"},
  "무형문화유산":{"en":"intangible cultural heritage","rom":"mu-hyeong-mun-hwa-yu-san"},
  "수상":{"en":"award / prize","rom":"su-sang"},
  "개막":{"en":"opening / premiere","rom":"gae-mak"},
  "영화":{"en":"movie / film","rom":"yeong-hwa"},
  "음악":{"en":"music","rom":"eum-ak"},
  "전시":{"en":"exhibition","rom":"jeon-si"},
  "축제":{"en":"festival","rom":"chuk-je"},
  "한류":{"en":"Korean Wave (Hallyu)","rom":"han-ryu"},
  "케이팝":{"en":"K-pop","rom":"ke-i-pap"},
  "웹툰":{"en":"webtoon","rom":"web-tun"},
  "배우":{"en":"actor / actress","rom":"bae-u"},
  "가수":{"en":"singer","rom":"ga-su"},
  /* ── 스포츠 ── */
  "스포츠":{"en":"sports","rom":"seu-po-cheu"},
  "손흥민":{"en":"Son Heung-min (footballer)","rom":"son-heung-min"},
  "챔피언스리그":{"en":"Champions League","rom":"chaem-pi-eon-seu-ri-geu"},
  "결승":{"en":"final / decisive match","rom":"gyeol-seung"},
  "진출":{"en":"advancement","rom":"jin-chul"},
  "기록":{"en":"record","rom":"gi-rok"},
  "우승":{"en":"championship / winning","rom":"u-seung"},
  "패배":{"en":"defeat / loss","rom":"pae-bae"},
  "경기":{"en":"game / match","rom":"gyeong-gi"},
  "선수":{"en":"athlete / player","rom":"seon-su"},
  "올림픽":{"en":"Olympics","rom":"ol-lim-pik"},
  "월드컵":{"en":"World Cup","rom":"wol-deu-keob"},
  "야구":{"en":"baseball","rom":"ya-gu"},
  "축구":{"en":"football / soccer","rom":"chuk-gu"},
  "농구":{"en":"basketball","rom":"nong-gu"},
  /* ── 과학 / 기술 ── */
  "기술":{"en":"technology","rom":"gi-sul"},
  "인공지능":{"en":"artificial intelligence","rom":"in-gong-ji-neung"},
  "로봇":{"en":"robot","rom":"ro-bot"},
  "우주":{"en":"space / universe","rom":"u-ju"},
  "발사":{"en":"launch","rom":"bal-sa"},
  "위성":{"en":"satellite","rom":"wi-seong"},
  "연구":{"en":"research","rom":"yeon-gu"},
  "개발":{"en":"development","rom":"gae-bal"},
  "특허":{"en":"patent","rom":"teuk-heo"},
  "전기차":{"en":"electric vehicle","rom":"jeon-gi-cha"},
  "배터리":{"en":"battery","rom":"bae-teo-ri"},
  "태양광":{"en":"solar power","rom":"tae-yang-gwang"},
  "재생에너지":{"en":"renewable energy","rom":"jae-saeng-e-neo-ji"},
  /* ── 환경 ── */
  "환경":{"en":"environment","rom":"hwan-gyeong"},
  "기후":{"en":"climate","rom":"gi-hu"},
  "온난화":{"en":"global warming","rom":"on-nan-hwa"},
  "미세먼지":{"en":"fine dust / PM2.5","rom":"mi-se-meon-ji"},
  "홍수":{"en":"flood","rom":"hong-su"},
  "태풍":{"en":"typhoon","rom":"tae-pung"},
  "지진":{"en":"earthquake","rom":"ji-jin"},
  /* ── 도시 / 지역 ── */
  "서울":{"en":"Seoul","rom":"seo-ul"},
  "한강":{"en":"Han River","rom":"han-gang"},
  "부산":{"en":"Busan","rom":"bu-san"},
  "인천":{"en":"Incheon","rom":"in-cheon"},
  "제주":{"en":"Jeju Island","rom":"je-ju"},
  "경기도":{"en":"Gyeonggi Province","rom":"gyeong-gi-do"},
  "전국":{"en":"nationwide","rom":"jeon-guk"},
  "지역":{"en":"region / area","rom":"ji-yeok"},
  "계획":{"en":"plan","rom":"gye-hoek"},
  "개통":{"en":"opening / launch","rom":"gae-tong"},
  "건설":{"en":"construction","rom":"geon-seol"},
  /* ── 뉴스 일반 ── */
  "속보":{"en":"breaking news","rom":"sok-bo"},
  "뉴스":{"en":"news","rom":"nyu-seu"},
  "한국":{"en":"Korea / Korean","rom":"han-guk"},
  "역대":{"en":"all-time / in history","rom":"yeok-dae"},
  "안정":{"en":"stability","rom":"an-jeong"},
  "열풍":{"en":"craze / boom","rom":"yeol-pung"},
  "논란":{"en":"controversy","rom":"non-ran"},
  "비판":{"en":"criticism","rom":"bi-pan"},
  "지적":{"en":"pointing out / indication","rom":"ji-jeok"},
  "강조":{"en":"emphasis","rom":"gang-jo"},
  "주장":{"en":"claim / argument","rom":"ju-jang"},
  "분석":{"en":"analysis","rom":"bun-seok"},
  "전망":{"en":"outlook / forecast","rom":"jeon-mang"},
  "우려":{"en":"concern / worry","rom":"u-ryeo"},
  "기대":{"en":"expectation / anticipation","rom":"gi-dae"},
  "목표":{"en":"goal / target","rom":"mok-pyo"},
  "성과":{"en":"achievement / result","rom":"seong-gwa"},
  "영향":{"en":"influence / impact","rom":"yeong-hyang"},
  "변화":{"en":"change","rom":"byeon-hwa"},
  "증가":{"en":"increase","rom":"jeung-ga"},
  "감소":{"en":"decrease","rom":"gam-so"},
  "확대":{"en":"expansion","rom":"hwak-dae"},
  "축소":{"en":"reduction / downsizing","rom":"chuk-so"},
  "강화":{"en":"strengthening","rom":"gang-hwa"},
  /* ── 기초 어휘 ── */
  "학교":{"en":"school","rom":"hak-gyo"},
  "가족":{"en":"family","rom":"ga-jok"},
  "봄":{"en":"spring","rom":"bom"},
  "여름":{"en":"summer","rom":"yeo-reum"},
  "가을":{"en":"autumn","rom":"ga-eul"},
  "겨울":{"en":"winter","rom":"gye-ul"},
  "오늘":{"en":"today","rom":"o-neul"},
  "내일":{"en":"tomorrow","rom":"nae-il"},
  "어제":{"en":"yesterday","rom":"eo-je"},
  "시간":{"en":"time / hour","rom":"si-gan"},
  "사람":{"en":"person / people","rom":"sa-ram"},
  "나라":{"en":"country","rom":"na-ra"},
  "도시":{"en":"city","rom":"do-si"},
  "집":{"en":"house / home","rom":"jip"},
  "돈":{"en":"money","rom":"don"},
  "일":{"en":"work / day","rom":"il"},
  "문제":{"en":"problem / issue","rom":"mun-je"},
  "방법":{"en":"method / way","rom":"bang-beob"},
  "필요":{"en":"necessary / need","rom":"pil-ryo"},
  "중요":{"en":"important","rom":"jung-yo"},
  "가능":{"en":"possible","rom":"ga-neung"},
};

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
  var img = a.image || KH_IMG_PLACEHOLDER;
  var tc  = extraTagClass || '';
  var levelColors = { 'Starter':'#f3e8ff;color:#6b21a8', 'Beginner':'#e8f5e9;color:#2e7d32', 'Intermediate':'#fff8e1;color:#f57f17', 'Advanced':'#fce4ec;color:#c62828' };
  var levelBadge = a.level ? '<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;background:' + (levelColors[a.level] || '#f0f0f0;color:#666') + '">' + ({Starter:'Seed',Beginner:'Sprout',Intermediate:'Tree',Advanced:'Forest'}[a.level]||a.level) + '</span>' : '';
  return '<a href="' + articleUrl(a.id) + '" style="color:inherit;text-decoration:none;">'
    + '<div class="card">'
    + '<img src="' + img + '" alt="" loading="lazy">'
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
  var img = a.image || KH_IMG_PLACEHOLDER;
  return '<a href="' + articleUrl(a.id) + '" style="color:inherit;text-decoration:none;">'
    + '<div class="story-item">'
    + '<img src="' + img + '" alt="" loading="lazy">'
    + '<div>'
    + '<h4 class="vocab-zone">' + a.title + '</h4>'
    + '<div class="meta">' + a.section + ' · ' + relTime(a.date) + '</div>'
    + '</div></div></a>';
}

function heroSideItemHTML(a) {
  var img = a.image || KH_IMG_PLACEHOLDER;
  return '<a href="' + articleUrl(a.id) + '" style="color:inherit;text-decoration:none;display:block;">'
    + '<div class="hero-side-item">'
    + '<img src="' + img + '" alt="" loading="lazy">'
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
          + '<div class="author-img"><img src="' + (op.img || 'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==') + '" alt="' + (op.name||'') + '"></div>'
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
          var featImg = item.image || KH_IMG_PLACEHOLDER;
          var featBody = (item.body || '').replace(/<[^>]*>/g, '').slice(0, 150);
          var url = articleUrl(item.id);
          return '<article class="kh-home-hero-slide" style="min-width:100%;position:relative;min-height:460px;overflow:hidden;cursor:pointer" onclick="location.href=\'' + url + '\'">'
            + '<img src="' + featImg + '" alt="" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;pointer-events:none;">'
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
      var img = a.image || KH_IMG_PLACEHOLDER;
      return '<a href="' + articleUrl(a.id) + '" style="display:flex;gap:12px;padding:14px 16px;text-decoration:none;color:inherit;border-bottom:1px solid #edf2f7;transition:background .15s" onmouseover="this.style.background=\'#f2f7ff\'" onmouseout="this.style.background=\'\'">'
        + '<img src="' + img + '" alt="" style="width:98px;height:78px;object-fit:cover;border-radius:14px;flex-shrink:0;box-shadow:0 6px 18px rgba(15,23,42,.08)">'
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
  var aImg = a.image || KH_IMG_PLACEHOLDER;
  var fallback = KH_IMG_PLACEHOLDER;
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
  var fallback = 'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==';
  var img = featured.image || KH_IMG_PLACEHOLDER;
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
    document.title = secInfo.label + ' — KoreHan News';
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
    var img = a.image
      ? '<img class="nc-img" src="' + a.image + '" alt="" loading="lazy">'
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

// ── Character Reporter Profiles ───────────────────────────────
// reporter_id on article maps to an entry here.
var KH_REPORTERS = {};           // id → { name, img, href, role, color }
var _KH_REPORTERS_PROMISE = null;
var _KH_REPORTERS_LS_KEY  = 'kh_reporters_cache';

// Default reporter data (matches DEF_CHAR_REPORTERS in admin).
// Always available — no Supabase needed for basic display.
var _KH_DEFAULT_REPORTERS_LIST = [
  { id:'cr1',  name:'박서진', role:'사회부 기자',         image:'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',  profilePage:'', color:'#2563eb' },
  { id:'cr2',  name:'김지원', role:'국제부 특파원',       image:'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',  profilePage:'', color:'#7c3aed' },
  { id:'cr3',  name:'이민준', role:'경제부 에디터',       image:'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',  profilePage:'', color:'#059669' },
  { id:'cr4',  name:'최유나', role:'문화부 기자',         image:'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',  profilePage:'', color:'#db2777' },
  { id:'cr5',  name:'정우성', role:'정치부 선임기자',     image:'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',  profilePage:'', color:'#dc2626' },
  { id:'cr6',  name:'한소희', role:'뷰티·트래블 에디터', image:'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',  profilePage:'', color:'#0891b2' },
  { id:'cr7',  name:'오지훈', role:'스포츠부 기자',       image:'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',  profilePage:'', color:'#ea580c' },
  { id:'cr8',  name:'신지은', role:'사회·환경 전문기자', image:'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',  profilePage:'', color:'#16a34a' },
  { id:'cr9',  name:'강태양', role:'국제·외교 기자',      image:'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',  profilePage:'', color:'#4338ca' },
  { id:'cr10', name:'류하늘', role:'문화·라이프 기자',    image:'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==', profilePage:'', color:'#c026d3' },
];

// Seed KH_REPORTERS from defaults immediately (synchronous, always works)
_KH_DEFAULT_REPORTERS_LIST.forEach(function(d) {
  KH_REPORTERS[d.id] = { name:d.name, img:d.image, href:d.profilePage||'korehan-reporters.html', role:d.role, color:d.color };
});

// Then override with localStorage cache if present
(function() {
  try {
    var c = JSON.parse(localStorage.getItem(_KH_REPORTERS_LS_KEY) || 'null');
    if (c && typeof c === 'object') {
      Object.keys(c).forEach(function(rid){ KH_REPORTERS[rid] = c[rid]; });
    }
  } catch(e) {}
})();

// Returns a Promise — resolves after KH_REPORTERS is fresh from Supabase.
// Safe to call multiple times; only one fetch ever happens per page load.
function _loadReportersIntoKHMap() {
  if (_KH_REPORTERS_PROMISE) return _KH_REPORTERS_PROMISE;
  _KH_REPORTERS_PROMISE = new Promise(function(resolve) {
    var sb = getSupa();
    if (!sb) { resolve(); return; }
    sb.from('character_reporters').select('id, data').then(function(res) {
      if (!res.error && res.data && res.data.length > 0) {
        var snap = {};
        res.data.forEach(function(row) {
          var d = row.data || {};
          var rid = d.id || row.id;
          if (!rid) return;
          snap[rid] = KH_REPORTERS[rid] = {
            name : d.name  || '',
            img  : d.image || '',
            href : d.profilePage || 'korehan-reporters.html',
            role : d.role  || '',
            color: d.color || '#2563eb'
          };
        });
        try { localStorage.setItem(_KH_REPORTERS_LS_KEY, JSON.stringify(snap)); } catch(e) {}
        _reRenderReporterSlots();
      } else {
        // Supabase empty/missing — fall back to admin's localStorage key
        try {
          var adminList = JSON.parse(localStorage.getItem('korehan_char_reporters') || 'null');
          if (adminList && adminList.length) {
            var snap2 = {};
            adminList.forEach(function(d) {
              if (!d.id) return;
              snap2[d.id] = KH_REPORTERS[d.id] = { name:d.name||'', img:d.image||'', href:d.profilePage||'korehan-reporters.html', role:d.role||'', color:d.color||'#2563eb' };
            });
            try { localStorage.setItem(_KH_REPORTERS_LS_KEY, JSON.stringify(snap2)); } catch(e) {}
            _reRenderReporterSlots();
          }
        } catch(e2) {}
      }
      resolve();
    }).catch(function(){ resolve(); });
  });
  return _KH_REPORTERS_PROMISE;
}

// After KH_REPORTERS loads, patch any .art-reporter-link[data-rid] already in the DOM
function _reRenderReporterSlots() {
  document.querySelectorAll('.art-reporter-link[data-rid]').forEach(function(el) {
    var rid = el.getAttribute('data-rid');
    if (!rid) return;
    var rep = KH_REPORTERS[rid];
    if (!rep || !rep.name) return;
    var color = rep.color || '#2563eb';
    var avatarEl = el.querySelector('.art-reporter-avatar');
    var nameEl   = el.querySelector('.art-reporter-name');
    var roleEl   = el.querySelector('.art-reporter-role');
    el.href = rep.href || 'korehan-reporters.html';
    if (nameEl) nameEl.textContent = rep.name;
    if (avatarEl) {
      avatarEl.innerHTML = rep.img
        ? '<img src="' + rep.img + '" alt="' + rep.name + '" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\'">'
          + '<div class="art-reporter-avatar-placeholder" style="display:none;background:' + color + '">' + rep.name.charAt(0) + '</div>'
        : '<div class="art-reporter-avatar-placeholder" style="background:' + color + '">' + rep.name.charAt(0) + '</div>';
    }
    if (rep.role && !roleEl) {
      var rs = document.createElement('span');
      rs.className = 'art-reporter-role';
      rs.textContent = rep.role;
      el.appendChild(rs);
    } else if (rep.role && roleEl) {
      roleEl.textContent = rep.role;
    }
  });
}

// Kick off fetch early (non-blocking background prefetch)
document.addEventListener('DOMContentLoaded', function() { _loadReportersIntoKHMap(); });

function getReporterProfileHTML(article) {
  var rid = article.reporter_id || article.reporter || null;
  var rep = rid ? KH_REPORTERS[rid] : null;
  var name  = (rep && rep.name)  ? rep.name  : 'KoreHan Reporter';
  var img   = (rep && rep.img)   ? rep.img   : null;
  var href  = (rep && rep.href && rep.href !== 'korehan-reporters.html') ? rep.href : (rid ? 'korehan-reporter.html?id=' + rid : 'korehan-reporters.html');
  var color = (rep && rep.color) ? rep.color : '#2563eb';
  var avatar = img
    ? '<img src="' + img + '" alt="' + name + '" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\'">'
      + '<div class="art-reporter-avatar-placeholder" style="display:none;background:' + color + '">' + name.charAt(0) + '</div>'
    : '<div class="art-reporter-avatar-placeholder" style="background:' + color + '">' + name.charAt(0) + '</div>';
  // data-rid lets _reRenderReporterSlots() update this element once KH_REPORTERS loads
  return '<a href="' + href + '" class="art-reporter-link"' + (rid ? ' data-rid="' + rid + '"' : '') + '>'
    + '<div class="art-reporter-avatar">' + avatar + '</div>'
    + '<span class="art-reporter-name">' + name + '</span>'
    + (rep && rep.role ? '<span class="art-reporter-role">' + rep.role + '</span>' : '')
    + '</a>';
}

function renderArticlePage() {
  var wrap = document.getElementById('dyn-article');
  if (!wrap) return;

  var params = new URLSearchParams(window.location.search);
  var id     = params.get('id');
  var all    = getCachedArticles();
  var a      = id ? all.find(function(x){ return String(x.id) === String(id); }) : null;

  if (!a) {
    wrap.innerHTML = '<div style="padding:30px">'
      + '<a href="index.html" style="color:#2255a4;text-decoration:none">← Back to Home</a>'
      + '<h1 style="margin-top:16px">Article not found</h1>'
      + '<p style="color:#666;margin-top:8px">This article does not exist or the link is invalid.</p>'
      + '</div>';
    return;
  }

  var img = a.image || KH_IMG_PLACEHOLDER;
  var dateStr = a.date ? new Date(a.date).toLocaleDateString('ko-KR', {year:'numeric',month:'long',day:'numeric'}) : '';

  wrap.innerHTML =
    '<article class="kh-article-wrap">'

    // 브레드크럼
    + '<nav class="art-breadcrumb">'
    + '<a href="index.html">Home</a>'
    + '<span>›</span>'
    + '<a href="korehan-section.html?s=' + encodeURIComponent(a.section) + '">' + sectionLabel(a.section) + '</a>'
    + '</nav>'

    // 카테고리 + 제목
    + '<div class="art-header">'
    + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
    + '<span class="art-section-badge">' + a.section + '</span>'
    + (a.level ? (function(lv){ var c={'Beginner':'#e8f5e9;color:#2e7d32','Intermediate':'#fff8e1;color:#f57f17','Advanced':'#fce4ec;color:#c62828','Starter':'#f3e8ff;color:#6b21a8'}; var dn={'Starter':'Seed','Beginner':'Sprout','Intermediate':'Tree','Advanced':'Forest'}; return '<span style="font-size:11px;font-weight:800;padding:3px 10px;border-radius:999px;background:'+(c[lv]||'#f0f0f0;color:#666')+'">'+(dn[lv]||lv)+'</span>'; })(a.level) : '')
    + '</div>'
    + '<h1 class="art-title vocab-zone">' + a.title + ' ' + ttsBtn(a.title) + '</h1>'
    + '<div class="art-meta-row">'
    + getReporterProfileHTML(a)
    + '<div class="art-meta-right">'
    + '<span class="art-date">' + dateStr + '</span>'
    + '<span class="art-dot">·</span>'
    + '<span class="art-readtime">' + Math.max(1, Math.ceil((a.full||a.body||'').length / 500)) + ' min read</span>'
    + '</div>'
    + '<div class="art-actions-inline">'
    + '<button class="art-action-icon" id="art-bm-btn" onclick="toggleBookmark(\'' + a.id + '\',this)" title="Bookmark"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button>'
    + '<button class="art-action-icon" onclick="shareArticle()" title="Share"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button>'
    + '<button class="art-action-icon" id="translate-btn" onclick="toggleTranslate()" title="Translate"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></button>'
    + '<button class="art-action-icon" id="analyze-btn" onclick="toggleAnalyze()" title="Analyze"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></button>'
    + '</div>'
    + '</div>'
    + '</div>'

    // 히어로 이미지
    + '<div class="art-hero-img">'
    + '<img src="' + img + '" alt="">'
    + '</div>'

    // 4탭: Read / Grammar / Vocab / Quiz
    + '<div class="art-tabs">'
    + '<button class="art-tab on" onclick="switchArtTab(\'article\',this)">Read</button>'
    + '<button class="art-tab" onclick="switchArtTab(\'grammar\',this)">Grammar</button>'
    + '<button class="art-tab" onclick="switchArtTab(\'vocab\',this)">Vocab</button>'
    + '<button class="art-tab" onclick="switchArtTab(\'quiz\',this)">Quiz</button>'
    + '</div>'

    // Read 탭
    + '<div id="art-tab-article">'
    + '<div class="art-lead vocab-zone">' + formatArticleBody(a.body || '') + '</div>'
    + (a.full ? '<div class="art-full vocab-zone">' + formatArticleBody(a.full) + '</div>' : '')
    + '<div id="art-phrases-admin" style="display:none"></div>'
    + '</div>'

    // Grammar 탭
    + '<div id="art-tab-grammar" style="display:none">'
    + '<div id="grammar-content"><div style="color:#aaa;padding:20px 0;text-align:center">Loading grammar guide...</div></div>'
    + '</div>'

    // Vocab 탭
    + '<div id="art-tab-vocab" style="display:none">'
    + '<div class="art-vocab-box">'
    + '<div class="art-vocab-title">📚 Key Vocabulary</div>'
    + '<div class="art-vocab-list" id="art-vocab-list"></div>'
    + '</div>'
    + '</div>'

    // Quiz 탭
    + '<div id="art-tab-quiz" style="display:none">'
    + '<div id="fill-wrap">'
    + '<div id="fill-content"><div id="fill-teaser"></div></div>'
    + '</div>'
    + '<div style="margin-top:24px;padding-top:20px;border-top:2px solid var(--border)">'
    + '<div style="font-size:14px;font-weight:800;margin-bottom:8px">📝 Article Summary</div>'
    + '<p style="font-size:12px;color:var(--gray);margin-bottom:10px">Summarize this article in 3-5 Korean sentences. AI will check your summary.</p>'
    + '<textarea id="art-summary-ta" style="width:100%;min-height:100px;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-family:\'Noto Sans KR\',sans-serif;font-size:13px;resize:vertical;box-sizing:border-box" placeholder="Write your summary in Korean..."></textarea>'
    + '<div style="display:flex;gap:8px;margin-top:8px">'
    + '<button onclick="checkArticleSummary()" style="padding:8px 18px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Check Summary</button>'
    + '</div>'
    + '<div id="art-summary-feedback" style="margin-top:10px;font-size:13px;line-height:1.6"></div>'
    + '</div>'
    + '<div style="margin-top:24px;padding-top:20px;border-top:2px solid var(--border)">'
    + '<div style="font-size:14px;font-weight:800;margin-bottom:8px">🎧 Listening Quiz</div>'
    + '<p style="font-size:12px;color:var(--gray);margin-bottom:10px">Listen to key vocabulary from this article and identify the meaning.</p>'
    + '<div id="art-listening-quiz"><button onclick="startArticleListeningQuiz()" style="width:100%;padding:12px;background:#2563eb;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Start Listening Quiz</button></div>'
    + '</div>'
    + '</div>'

    // 구분선
    + '<hr class="art-divider">'

    // 댓글 섹션
    + '<section class="art-comments" id="art-comments">'
    + '<h3 class="art-comments-title">💬 Comments <span id="comment-count" style="font-size:16px;color:var(--gray)"></span></h3>'
    + '<div id="comment-form-wrap">'
    + '<div class="comment-login-notice" id="comment-login-notice" style="display:none">'
    + '<p>Sign in to leave a comment — <a href="#" onclick="event.preventDefault();openAuthModal(&apos;signin&apos;)">Sign in</a></p>'
    + '</div>'
    + '<div class="comment-form" id="comment-form" style="display:none">'
    + '<textarea id="comment-input" placeholder="Write a comment..." rows="3"></textarea>'
    + '<button class="comment-submit-btn" onclick="submitComment(\'' + a.id + '\')">Post</button>'
    + '</div>'
    + '</div>'
    + '<div id="comments-list"></div>'
    + '</section>'

    // 관련 기사 추천
    + (function() {
        var all = published().filter(function(r){ return r.id !== a.id; });
        // 같은 섹션 우선 → 없으면 같은 레벨 → 없으면 최신순
        var related = all.filter(function(r){ return r.section === a.section; }).slice(0,3);
        if (related.length < 3) {
          var more = all.filter(function(r){ return r.level === a.level && r.section !== a.section; });
          related = related.concat(more).slice(0,3);
        }
        if (!related.length) related = all.slice(0,3);
        if (!related.length) return '';
        return '<div class="art-related">'
          + '<div class="art-related-title">📰 Related Articles</div>'
          + '<div class="art-related-grid">'
          + related.map(function(r){
              var levelColors = {'Starter':'#f3e8ff;color:#6b21a8','Beginner':'#e8f5e9;color:#2e7d32','Intermediate':'#fff8e1;color:#f57f17','Advanced':'#fce4ec;color:#c62828'};
              return '<a href="' + articleUrl(r.id) + '" class="art-related-card">'
                + '<img src="' + (r.image || KH_IMG_PLACEHOLDER) + '" alt="">'
                + '<div class="art-related-info">'
                + '<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">'
                + '<span style="font-size:10px;font-weight:800;text-transform:uppercase;color:#2255a4">' + r.section + '</span>'
                + (r.level ? '<span style="font-size:10px;font-weight:800;padding:1px 7px;border-radius:999px;background:' + (levelColors[r.level]||'#f0f0f0;color:#666') + '">' + ({'Starter':'Seed','Beginner':'Sprout','Intermediate':'Tree','Advanced':'Forest'}[r.level]||r.level) + '</span>' : '')
                + '</div>'
                + '<div class="art-related-title-text">' + r.title + '</div>'
                + '</div>'
                + '</a>';
            }).join('')
          + '</div></div>';
      })()

    + '</article>';

  // 현재 기사 참조 저장 (Quiz 탭에서 사용)
  window._currentArticle = a;
  _analyzeOn = false;
  _analyzeData = null;

  // 핵심 단어 추출
  renderArticleVocab(a);

  // Highlighted expressions
  applyHighlightedExpressions(a.id);

  // 어드민이면 중요표현 관리 패널 표시
  if (window._isAdmin) _renderPhrasesAdmin(a.id);

  // 댓글 로드
  loadComments(a.id);

  // 기사 조회수 기록
  if (supaUser) syncArticleView(a.id, a.title, a.section);


  // 세션 로드 후 북마크/댓글폼/읽음처리 업데이트
  var articleId      = a.id;
  var articleTitle   = a.title;
  var articleSection = a.section;
  var articleLevel   = a.level || '';
  var attempts = 0;
  function waitAndUpdate() {
    attempts++;
    updateCommentForm();
    checkBookmarkState(articleId);
    if (supaUser) {
      markArticleRead(articleId, articleTitle, articleSection, articleLevel);
      // 캐시 없는 기사: 첫 방문 유저가 자동으로 전체 캐시 생성 (공유 캐시)
      _bgPregenArticleCache(a);
    } else if (attempts < 20) {
      setTimeout(waitAndUpdate, 300);
    }
  }
  setTimeout(waitAndUpdate, 300);
}

// 로그인 유저가 기사 열 때, 캐시 없으면 백그라운드 자동 생성 → 모든 유저가 공유
async function _bgPregenArticleCache(a) {
  if (!supaUser || _remoteCacheDisabled) return;
  try {
    var cached = await getFromCache('article', a.id, 'ai_analysis');
    // translation/vocab/grammar/quiz 중 하나라도 있으면 이미 캐시 있음
    if (cached && (cached.translation || (cached.vocab && cached.vocab.length) || (cached.grammar && cached.grammar.length) || cached.quiz)) return;
    // quiz만 따로 확인
    var quizCached = await getFromCache('article', a.id, 'fill_intermediate');
    if (quizCached && quizCached.questions && quizCached.questions.length) return;
  } catch(e) { return; }

  // 캐시 완전 비어있음 → 백그라운드 생성 시작
  var _body  = a.body  || '';
  var _title = a.title || '';
  var _level = a.level || 'Intermediate';
  var _patch = {};

  async function _call(instr, maxTok) {
    try {
      var r = await callClaude({
        feature: 'bg-cache', model: 'claude-haiku-4-5-20251001', max_tokens: maxTok,
        messages: [{ role: 'user', content: 'Korean article (level: ' + _level + ')\nTitle: ' + _title + '\n\n' + _body.slice(0, 1200) + '\n\n---\n' + instr }]
      });
      return (r && r.content && r.content[0] && r.content[0].text) || '';
    } catch(e) { return ''; }
  }

  function _json(text) {
    try {
      var ai = text.indexOf('['), bi = text.lastIndexOf(']');
      var oi = text.indexOf('{'), ei = text.lastIndexOf('}');
      if (ai >= 0 && bi > ai && (oi < 0 || ai < oi)) return JSON.parse(text.slice(ai, bi+1));
      if (oi >= 0 && ei > oi) return JSON.parse(text.slice(oi, ei+1));
    } catch(e) {}
    return null;
  }

  try {
    var t = await _call('Translate each paragraph into English. Return ONLY a JSON array of strings, one per paragraph. No other text.', 800);
    var ta = _json(t);
    if (ta) _patch.translation = JSON.stringify({ texts: Array.isArray(ta) ? ta : [ta] });
  } catch(e) {}

  try {
    var v = await _call('List 8 key vocabulary words. Return ONLY a JSON array. Each: {"word":"Korean","reading":"romanization","meaning":"English"}. No other text.', 800);
    var va = _json(v);
    if (va) _patch.vocab = JSON.stringify(va);
  } catch(e) {}

  try {
    var g = await _call('Find 3 grammar patterns. Return ONLY: {"patterns":[{"name":"KO+romanization","level":"Starter|Beginner|Intermediate|Advanced","exp":"explanation","ex_ko":"sentence","ex_en":"translation"}]}. No other text.', 900);
    var ga = _json(g);
    if (ga && ga.patterns) _patch.grammar = JSON.stringify(ga);
  } catch(e) {}

  try {
    var q = await _call('Create 10 fill-in-the-blank questions. Return ONLY: {"questions":[{"sentence":"Korean with _____","sentence_en":"English with _____","blank":"answer","blank_en":"meaning","choices":["correct","wrong1","wrong2","wrong3"]}]}. No other text.', 2000);
    var qa = _json(q);
    if (qa && qa.questions) _patch.quiz = JSON.stringify(qa);
  } catch(e) {}

  if (Object.keys(_patch).length > 0) {
    await upsertArticleCacheRow(a.id, _patch);
  }
}

function formatArticleBody(text) {
  if (!text) return '';
  // Strip dangerous tags but keep basic formatting
  text = sanitizeHTML(text);
  // \n\n 기준으로 먼저 분리
  var paras = text.split(/\n\n+/);
  if (paras.length <= 1) {
    // 한국어/영어 마침표 기준으로 문단 나누기
    // 마침표 뒤에 공백이나 줄바꿈이 있으면 단락 구분
    paras = text
      .replace(/([.!?。다요죠]\s)/g, '$1\n')
      .split('\n')
      .filter(function(p){ return p.trim().length > 10; }); // 너무 짧은 조각 제거
  }
  if (paras.length <= 1) {
    // 그래도 1개면 그냥 전체를 하나의 단락으로
    return '<p style="margin-bottom:18px">' + text.trim() + '</p>';
  }
  return paras.map(function(p){
    return '<p style="margin-bottom:18px">' + p.trim().replace(/\n/g,'<br>') + '</p>';
  }).join('');
}

function switchArtTab(tab, btn) {
  document.querySelectorAll('.art-tab').forEach(function(b){ b.classList.remove('on'); });
  if (btn) btn.classList.add('on');
  var tabs = ['article','grammar','vocab','quiz'];
  tabs.forEach(function(t){ var el = document.getElementById('art-tab-' + t); if(el) el.style.display = 'none'; });
  var active = document.getElementById('art-tab-' + tab);
  if (active) active.style.display = 'block';
  if (tab === 'grammar') loadGrammarGuide();
  if (tab === 'quiz') { var teaser = document.getElementById('fill-teaser'); if (teaser && !teaser.innerHTML) initFillTeaser(window._currentArticle); }
}


// ── Fill-in-the-Blank Teaser (기사 하단) ─────────────────────────────────────
function initFillTeaser(article) {
  var teaser = document.getElementById('fill-teaser');
  if (!teaser) return;

  var level = article.level || 'Beginner';
  var levelColor = level === 'Beginner' ? '#2e7d32' : level === 'Advanced' ? '#c62828' : '#d97706';
  var levelBg    = level === 'Beginner' ? '#e8f5e9' : level === 'Advanced' ? '#fce4ec' : '#fff8e1';

  teaser.innerHTML =
    '<div style="background:linear-gradient(135deg,#0b1626 0%,#1a3a6b 100%);border-radius:20px;padding:28px 28px 24px;position:relative;overflow:hidden">'
    // 배경 데코
    + '<div style="position:absolute;right:-20px;top:-20px;font-size:100px;opacity:.06;line-height:1">✏️</div>'
    + '<div style="position:absolute;left:-10px;bottom:-15px;font-size:80px;opacity:.04;line-height:1">📝</div>'
    // 내용
    + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap">'
    + '<div style="flex:1;min-width:200px">'
    + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
    + '<span style="font-size:22px">✏️</span>'
    + '<span style="font-size:11px;font-weight:800;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:2px">Review Practice</span>'
    + '</div>'
    + '<div style="font-size:20px;font-weight:900;color:#fff;margin-bottom:6px;line-height:1.3">Fill-in-the-Blank</div>'
    + '<div style="font-size:13px;color:rgba(255,255,255,.6);line-height:1.5;margin-bottom:16px">'
    + 'Test your vocabulary and grammar from this article.<br>6 AI-generated questions, automatically.'
    + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'
    + '<span style="font-size:11px;font-weight:800;padding:4px 12px;border-radius:999px;background:' + levelBg + ';color:' + levelColor + '">' + ({Starter:'Seed',Beginner:'Sprout',Intermediate:'Tree',Advanced:'Forest'}[level]||level) + '</span>'
    + '<span style="font-size:11px;color:rgba(255,255,255,.4)">· 6 questions · vocab + grammar</span>'
    + '</div>'
    + '</div>'
    + '<div style="flex-shrink:0;display:flex;flex-direction:column;gap:8px;align-items:flex-end">'
    + '<button id="fill-start-btn" onclick="startFillExercise()" '
    + 'style="padding:13px 28px;background:#fff;color:#0b1626;border:none;border-radius:999px;'
    + 'font-size:14px;font-weight:900;cursor:pointer;white-space:nowrap;'
    + 'box-shadow:0 4px 20px rgba(0,0,0,.2);transition:transform .15s"'
    + 'onmouseover="this.style.transform=\'scale(1.04)\'" onmouseout="this.style.transform=\'scale(1)\'">'
    + "Let's Go →</button>"
    + '</div>'
    + '</div>'
    + '</div>';
}

async function checkArticleSummary() {
  var ta = document.getElementById('art-summary-ta');
  var fb = document.getElementById('art-summary-feedback');
  if (!ta || !fb) return;
  var text = ta.value.trim();
  if (!text) { fb.innerHTML = '<span style="color:#dc2626">Please write a summary first.</span>'; return; }
  fb.innerHTML = '<span style="color:var(--gray)">Checking...</span>';
  var art = window._currentArticle;
  var articleText = art ? (art.title + ' ' + (art.body || '') + ' ' + (art.full || '')).slice(0, 1000) : '';
  try {
    var r = await callClaude({feature:'summary-check', model:'claude-haiku-4-5-20251001', max_tokens:400,
      messages:[{role:'user', content:'You are a Korean teacher. A student summarized this Korean article:\n\nARTICLE: '+articleText+'\n\nSTUDENT SUMMARY: '+text+'\n\nGive feedback in English:\n1. Key points covered? (list what they got and missed)\n2. Grammar mistakes (if any, show correction)\n3. Overall score: Excellent/Good/Needs improvement\n\nKeep feedback concise (under 150 words).'}]});
    var feedback = (r.content||[]).map(function(c){return c.text||'';}).join('');
    fb.innerHTML = '<div style="background:var(--light);border-radius:10px;padding:12px 14px;line-height:1.7;white-space:pre-wrap">'+feedback.replace(/</g,'&lt;')+'</div>';
  } catch(e) { fb.innerHTML = '<span style="color:#dc2626">Error: '+e.message+'</span>'; }
}

function startArticleListeningQuiz() {
  var el = document.getElementById('art-listening-quiz');
  if (!el) return;
  var vocabItems = [];
  document.querySelectorAll('#art-vocab-list .art-vocab-item').forEach(function(item){
    var ko = item.querySelector('.art-vocab-ko');
    var en = item.querySelector('.art-vocab-en');
    if (ko && en) vocabItems.push({ko:ko.textContent.trim(), en:en.textContent.trim()});
  });
  if (!vocabItems.length) { el.innerHTML='<div style="color:#94a3b8;font-size:13px">No vocabulary available. Switch to Vocab tab first.</div>'; return; }
  var items = vocabItems.slice(0,5);
  var qi = 0;
  function renderQ() {
    if (qi >= items.length) {
      el.innerHTML='<div style="text-align:center;padding:16px"><div style="font-size:18px;font-weight:800;color:#16a34a;margin-bottom:4px">Quiz Complete!</div><div style="font-size:13px;color:#64748b">Great listening practice!</div></div>';
      return;
    }
    var v = items[qi];
    var opts = items.map(function(x){return x.en;}).sort(function(){return Math.random()-.5;}).slice(0,3);
    if (opts.indexOf(v.en)<0) opts[Math.floor(Math.random()*3)] = v.en;
    el.innerHTML='<div style="text-align:center;margin-bottom:12px"><div style="font-size:12px;color:var(--gray);margin-bottom:8px">Listen and pick the meaning ('+(qi+1)+'/'+items.length+')</div>'
      +'<button onclick="ttsSpeak(\''+v.ko.replace(/'/g,"\\'")+'\')" style="padding:12px 24px;background:var(--light);border:1.5px solid var(--border);border-radius:12px;font-size:16px;cursor:pointer;font-family:inherit">🔊 Play</button></div>'
      +'<div style="display:flex;flex-direction:column;gap:6px">'+opts.map(function(o){
        return '<button onclick="artListenPick(this,\''+o.replace(/'/g,"\\'")+'\',\''+v.en.replace(/'/g,"\\'")+'\')" style="padding:10px 14px;background:#fff;border:1px solid var(--border);border-radius:10px;font-size:13px;cursor:pointer;font-family:inherit;text-align:left">'+o+'</button>';
      }).join('')+'</div>';
  }
  window.artListenPick = function(btn,picked,correct){
    if(picked===correct){btn.style.background='#dcfce7';btn.style.borderColor='#22c55e';btn.style.fontWeight='700';}
    else{btn.style.background='#fee2e2';btn.style.borderColor='#ef4444';}
    qi++; setTimeout(renderQ,800);
  };
  renderQ();
}

function startFillExercise() {
  // teaser 숨기고 로딩 시작
  var teaser = document.getElementById('fill-teaser');
  if (teaser) teaser.style.display = 'none';

  var content = document.getElementById('fill-content');
  if (!content) return;

  // 로딩 표시 붙이기
  var loadDiv = document.createElement('div');
  loadDiv.id = 'fill-exercise-area';
  content.appendChild(loadDiv);

  loadFillExercise(loadDiv);
}


// ══ FILL-IN-THE-BLANK ENGINE ══════════════════════════════════════════════════

async function loadFillExercise(container) {
  var el = container || document.getElementById('fill-exercise-area') || document.getElementById('fill-content');
  if (!el) return;

  var params = new URLSearchParams(window.location.search);
  var id = params.get('id');

  if (_fillLoaded && _fillArticleId === id) return;
  _fillLoaded = false;
  _fillArticleId = id;

  var all = getCachedArticles();
  var a = id ? all.find(function(x){ return String(x.id) === String(id); }) : null;
  if (!a) { el.innerHTML = '<p style="color:#aaa;padding:20px">Article not found.</p>'; return; }

  el.innerHTML = renderFillLoading();

  // ── DB 캐시 확인 ──────────────────────────────────────────
  var cacheKey = 'fill_' + (a.level || 'intermediate').toLowerCase();
  try {
    var cached = await getFromCache('article', a.id, cacheKey);
    if (cached && cached.questions && cached.questions.length) {
      _fillLoaded = true;
      renderFillQuestions(el, cached.questions, a);
      return;
    }
  } catch(e) {}

  if (!supaUser) {
    el.innerHTML = renderFillNoKey();
    return;
  }

  var level = a.level || 'Intermediate';
  var text = (a.body || '') + (a.full ? ' ' + a.full : '');

  var prompt = `You are a Korean language teacher creating fill-in-the-blank exercises from a Korean news article.

Article level: ${level}
Article text: "${text.slice(0, 1200)}"

Generate exactly 6 fill-in-the-blank questions from this article. Mix vocabulary gaps (important nouns/verbs) and grammar gaps (particles, verb endings, connectives).

Rules:
- For Starter: only basic nouns and verbs the student just learned (가족, 숫자, 색깔), ~이에요/예요 endings only, no particles
- For Beginner: focus on common vocabulary and basic particles (은/는/이/가/을/를/에서/에)
- For Intermediate: mix vocabulary with grammar patterns (으로/에게/한테/도/만/부터/까지)  
- For Advanced: focus on advanced grammar endings (-으면서/-는데/-아/어서/-기 때문에/-ㄹ 수록)
- Each blank should be a single word or short phrase (1-4 syllables)
- The blank should appear naturally in a sentence from the article
- 4 answer choices: 1 correct + 3 plausible wrong answers

Respond ONLY with this JSON (no markdown, no extra text):
{"questions":[
  {
    "sentence": "Korean sentence with _____ where blank goes",
    "sentence_en": "English translation with _____ where blank goes",
    "blank": "correct answer",
    "blank_en": "English meaning of correct answer",
    "type": "vocab OR grammar",
    "grammar_point": "Korean grammar point name if type=grammar, e.g. '-아/어서' or '은/는 topic marker', else null",
    "choices": ["correct","wrong1","wrong2","wrong3"],
    "hint": "brief hint in English (e.g. 'object marker' or 'means economy')"
  }
]}`;

  try {
    var data = await callClaude({
      feature: 'quiz',
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });
    var raw = (data.content || []).map(function(c){ return c.text || ''; }).join('');
    var clean = raw.replace(/```json|```/g, '').trim();
    var parsed = JSON.parse(clean);
    _fillLoaded = true;
    renderFillQuestions(el, parsed.questions, a);

    // ── DB에 캐시 저장 ────────────────────────────────────
    try {
      if (parsed.questions) {
        upsertArticleCacheRow(a.id, { quiz: JSON.stringify({ questions: parsed.questions }) });
      }
    } catch(e) {}
  } catch(e) {
    if (e && (e.message === 'unauthorized' || e.message === 'Not signed in')) {
      if (supaUser) {
        // User is logged in but got a token error — don't sign them out, just ask to retry
        el.innerHTML = '<div style="padding:24px;text-align:center;color:#e53e3e">⚠️ Session error. Please reload the page and try again.<br><button onclick="window.location.reload()" style="margin-top:12px;padding:8px 20px;background:#2255a4;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700">Reload</button></div>';
        if (typeof toast === 'function') toast('Session error — please reload and try again.', true);
      } else {
        el.innerHTML = renderFillNoKey();
        if (typeof openAuthModal === 'function') openAuthModal('signin');
      }
      return;
    }
    el.innerHTML = '<div style="padding:24px;text-align:center;color:#e53e3e">⚠️ Failed to generate exercise. Please try again.<br><button onclick="loadFillExercise()" style="margin-top:12px;padding:8px 20px;background:#2255a4;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700">🔄 Retry</button></div>';
  }
}

function renderFillLoading() {
  return '<div style="padding:40px;text-align:center">'
    + '<div style="font-size:32px;margin-bottom:16px;animation:spin 1s linear infinite;display:inline-block">✨</div>'
    + '<div style="font-size:15px;font-weight:700;color:#2255a4;margin-bottom:6px">Generating fill-in-the-blank exercise...</div>'
    + '<div style="font-size:12px;color:#94a3b8">Analyzing key vocabulary and grammar from this article</div>'
    + '</div>'
    + '<style>@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>';
}

function renderFillNoKey() {
  return '<div style="padding:32px;text-align:center;background:#f8faff;border-radius:16px;margin:16px 0">'
    + '<div style="font-size:36px;margin-bottom:12px">🔒</div>'
    + '<div style="font-size:15px;font-weight:800;color:#0b1626;margin-bottom:8px">Sign in required</div>'
    + '<div style="font-size:13px;color:#64748b;margin-bottom:20px">Fill-in-the-Blank is available for signed-in users.</div>'
    + '<button onclick="openAuthModal(\'signin\')" style="padding:10px 24px;background:linear-gradient(135deg,#2d6be4,#1e4fa3);color:#fff;border:none;border-radius:999px;font-size:13px;font-weight:800;cursor:pointer">Sign In →</button>'
    + '</div>';
}

// ── 빈칸 문제 렌더링 ──────────────────────────────────────────────────────
var _fillState = {}; // { qIdx: { selected, correct, mode } }
var _fillQuestions = [];

function renderFillQuestions(container, questions, article) {
  _fillQuestions = questions;
  _fillState = {};
  questions.forEach(function(_, i){ _fillState[i] = { selected: null, correct: null, mode: 'choice' }; });

  var level = article.level || 'Beginner';
  var levelColor = level === 'Beginner' ? '#2e7d32' : level === 'Advanced' ? '#c62828' : '#f57f17';

  var html = '<div style="padding:4px 0">'
    // 헤더
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px">'
    + '<div>'
    + '<div style="font-size:17px;font-weight:900;color:#0b1626;margin-bottom:3px">✏️ Fill in the Blank</div>'
    + '<div style="font-size:12px;color:#94a3b8">' + questions.length + ' key expressions from this article</div>'
    + '</div>'
    + '<div style="display:flex;gap:8px;align-items:center">'
    + '<span style="font-size:11px;font-weight:800;padding:4px 12px;border-radius:999px;background:#f0f4ff;color:' + levelColor + '">' + ({Starter:'Seed',Beginner:'Sprout',Intermediate:'Tree',Advanced:'Forest'}[level]||level) + '</span>'
    + '<button onclick="resetFill()" style="font-size:11px;font-weight:700;padding:5px 14px;border:2px solid #e2e8f0;border-radius:999px;background:#fff;cursor:pointer;color:#64748b">🔄 Reset</button>'
    + '</div>'
    + '</div>'

    // 진행 바
    + '<div id="fill-progress-bar" style="height:4px;background:#e2e8f0;border-radius:999px;margin-bottom:24px;overflow:hidden">'
    + '<div id="fill-progress-fill" style="height:100%;width:0%;background:linear-gradient(90deg,#2255a4,#3d7fd4);border-radius:999px;transition:width .4s"></div>'
    + '</div>';

  // 문제들
  questions.forEach(function(q, i) {
    // choices 섞기
    var shuffled = q.choices.slice().sort(function(){ return Math.random() - .5; });

    html += '<div class="fill-q" id="fill-q-' + i + '" style="background:#fff;border:2px solid #e2e8f0;border-radius:16px;padding:20px;margin-bottom:16px;transition:border-color .2s">'
      // 타입 배지
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">'
      + '<span style="font-size:10px;font-weight:800;padding:2px 9px;border-radius:999px;background:' + (q.type==='grammar'?'#f3e8ff;color:#9333ea':'#e8f0fb;color:#2255a4') + '">'
      + (q.type === 'grammar' ? '📐 Grammar' : '📖 Vocabulary') + '</span>'
      + '<span style="font-size:11px;color:#94a3b8;font-weight:600">' + (i+1) + ' / ' + questions.length + '</span>'
      + '</div>'

      // 문장 (빈칸 포함)
      + '<div style="font-size:20px;font-weight:700;color:#0b1626;line-height:1.6;margin-bottom:6px;word-break:keep-all">'
      + formatFillSentence(q.sentence, i)
      + '</div>'
      + '<div style="font-size:13px;color:#94a3b8;margin-bottom:4px;font-style:italic">'
      + formatFillSentenceEn(q.sentence_en, i)
      + '</div>'

      // 힌트
      + '<div style="font-size:11px;color:#60a5fa;margin-bottom:16px;font-weight:600">💡 ' + q.hint + '</div>'

      // 모드 토글 버튼
      + '<div style="display:flex;gap:6px;margin-bottom:12px">'
      + '<button onclick="setFillMode(' + i + ',\'choice\')" id="fill-mode-choice-' + i + '" style="font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;border:2px solid #2255a4;background:#2255a4;color:#fff;cursor:pointer">🎯 Multiple Choice</button>'
      + '<button onclick="setFillMode(' + i + ',\'type\')" id="fill-mode-type-' + i + '" style="font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;border:2px solid #e2e8f0;background:#fff;color:#64748b;cursor:pointer">⌨️ Type Answer</button>'
      + '</div>'

      // Multiple Choice 영역
      + '<div id="fill-choices-' + i + '" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      + shuffled.map(function(ch) {
          return '<button onclick="checkFillAnswer(' + i + ',\'' + ch.replace(/'/g, "\\'") + '\')" '
            + 'style="padding:10px 12px;border:2px solid #e2e8f0;border-radius:10px;background:#f8faff;'
            + 'font-size:14px;font-weight:700;cursor:pointer;color:#0b1626;transition:all .15s;font-family:inherit">'
            + ch + '</button>';
        }).join('')
      + '</div>'

      // Type Answer 영역
      + '<div id="fill-type-' + i + '" style="display:none">'
      + '<div style="display:flex;gap:8px">'
      + '<input id="fill-input-' + i + '" type="text" placeholder="Type in Korean..." '
      + 'style="flex:1;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:15px;font-family:sans-serif;outline:none" '
      + 'onkeydown="if(event.key===\'Enter\')submitFillType(' + i + ')">'
      + '<button onclick="submitFillType(' + i + ')" style="padding:10px 18px;background:#2255a4;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer">Check</button>'
      + '</div>'
      + '</div>'

      // 결과 영역
      + '<div id="fill-result-' + i + '" style="display:none;margin-top:12px"></div>'

      + '</div>';
  });

  html += '<div id="fill-final" style="display:none"></div></div>';
  container.innerHTML = html;
}

function formatFillSentence(sentence, qIdx) {
  return sentence.replace('_____', '<span id="fill-blank-' + qIdx + '" style="display:inline-block;min-width:60px;border-bottom:3px solid #2255a4;text-align:center;padding:0 4px;margin:0 4px;color:#2255a4;font-weight:900">　　</span>');
}
function formatFillSentenceEn(sentence_en, qIdx) {
  return (sentence_en||'').replace('_____', '<span style="border-bottom:2px solid #cbd5e1;padding:0 4px;color:#94a3b8">_____</span>');
}

function setFillMode(qIdx, mode) {
  _fillState[qIdx].mode = mode;
  var choiceEl = document.getElementById('fill-choices-' + qIdx);
  var typeEl   = document.getElementById('fill-type-' + qIdx);
  var btnChoice = document.getElementById('fill-mode-choice-' + qIdx);
  var btnType   = document.getElementById('fill-mode-type-' + qIdx);
  if (mode === 'choice') {
    choiceEl.style.display = 'grid';
    typeEl.style.display   = 'none';
    btnChoice.style.background = '#2255a4'; btnChoice.style.color = '#fff'; btnChoice.style.borderColor = '#2255a4';
    btnType.style.background   = '#fff';    btnType.style.color = '#64748b'; btnType.style.borderColor = '#e2e8f0';
  } else {
    choiceEl.style.display = 'none';
    typeEl.style.display   = 'block';
    btnType.style.background   = '#2255a4'; btnType.style.color = '#fff'; btnType.style.borderColor = '#2255a4';
    btnChoice.style.background = '#fff';    btnChoice.style.color = '#64748b'; btnChoice.style.borderColor = '#e2e8f0';
    setTimeout(function(){ var inp = document.getElementById('fill-input-' + qIdx); if(inp) inp.focus(); }, 50);
  }
}

function submitFillType(qIdx) {
  var inp = document.getElementById('fill-input-' + qIdx);
  if (!inp) return;
  var val = inp.value.trim();
  if (!val) return;
  checkFillAnswer(qIdx, val, true);
}

function checkFillAnswer(qIdx, selected, isTyped) {
  var q = _fillQuestions[qIdx];
  if (!q || _fillState[qIdx].selected !== null) return; // 이미 답한 문제

  var correct = q.blank;
  // 타이핑 모드는 부분 매칭 허용 (공백/조사 차이 무시)
  var isCorrect = isTyped
    ? (selected === correct || selected.replace(/\s/g,'') === correct.replace(/\s/g,''))
    : (selected === correct);

  _fillState[qIdx].selected = selected;
  _fillState[qIdx].correct  = isCorrect;

  // grammar point 기록 (localStorage + Supabase)
  if (q.type === 'grammar') {
    var gKey = q.grammar_point || q.hint || '';
    if (gKey) {
      try {
        var gStats = JSON.parse(localStorage.getItem('kh_quiz_grammar_stats') || '{}');
        if (!gStats[gKey]) gStats[gKey] = { correct:0, wrong:0 };
        isCorrect ? gStats[gKey].correct++ : gStats[gKey].wrong++;
        localStorage.setItem('kh_quiz_grammar_stats', JSON.stringify(gStats));
      } catch(e) {}
      if (supaUser) {
        try {
          var _sb = getSupa();
          if (_sb) _sb.rpc('log_quiz_result', {
            p_user_id: supaUser.id, p_quiz_type: 'fill_blank',
            p_grammar_point: gKey, p_is_correct: isCorrect
          });
        } catch(e) {}
      }
    }
  }

  // 빈칸에 정답 표시
  var blankEl = document.getElementById('fill-blank-' + qIdx);
  if (blankEl) {
    blankEl.textContent = correct;
    blankEl.style.color = isCorrect ? '#16a34a' : '#dc2626';
    blankEl.style.borderBottomColor = isCorrect ? '#16a34a' : '#dc2626';
    blankEl.style.background = isCorrect ? '#f0fdf4' : '#fff5f5';
    blankEl.style.borderRadius = '4px';
    blankEl.style.padding = '0 6px';
  }

  // 카드 테두리 색 변경
  var card = document.getElementById('fill-q-' + qIdx);
  if (card) card.style.borderColor = isCorrect ? '#86efac' : '#fca5a5';

  // Multiple Choice 버튼 색 변경
  if (!isTyped) {
    var choicesEl = document.getElementById('fill-choices-' + qIdx);
    if (choicesEl) {
      Array.from(choicesEl.querySelectorAll('button')).forEach(function(btn) {
        btn.disabled = true;
        if (btn.textContent === correct) {
          btn.style.background = '#f0fdf4'; btn.style.borderColor = '#86efac'; btn.style.color = '#16a34a';
        } else if (btn.textContent === selected && !isCorrect) {
          btn.style.background = '#fff5f5'; btn.style.borderColor = '#fca5a5'; btn.style.color = '#dc2626';
        } else {
          btn.style.opacity = '.45';
        }
      });
    }
  }

  // 결과 + 설명
  var resultEl = document.getElementById('fill-result-' + qIdx);
  if (resultEl) {
    resultEl.style.display = 'block';
    resultEl.innerHTML = (isCorrect
      ? '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:10px 14px;display:flex;gap:10px;align-items:flex-start">'
        + '<span style="font-size:18px">✅</span>'
        + '<div><div style="font-size:13px;font-weight:800;color:#16a34a;margin-bottom:2px">Correct!</div>'
        + '<div style="font-size:12px;color:#166534"><strong>' + correct + '</strong> = ' + q.blank_en + '</div></div>'
        + ttsBtn(correct)
        + '</div>'
      : '<div style="background:#fff5f5;border:1px solid #fca5a5;border-radius:10px;padding:10px 14px;display:flex;gap:10px;align-items:flex-start">'
        + '<span style="font-size:18px">❌</span>'
        + '<div><div style="font-size:13px;font-weight:800;color:#dc2626;margin-bottom:2px">'
        + (isTyped ? 'Incorrect (your answer: ' + selected + ')' : 'Incorrect')
        + '</div>'
        + '<div style="font-size:12px;color:#991b1b">Answer: <strong>' + correct + '</strong> = ' + q.blank_en + '</div></div>'
        + ttsBtn(correct)
        + '</div>'
    );
  }

  // 진행 바 업데이트
  updateFillProgress();

  // 전체 완료 체크
  var answeredCount = Object.values(_fillState).filter(function(s){ return s.selected !== null; }).length;
  if (answeredCount === _fillQuestions.length) {
    setTimeout(function(){ showFillResult(); }, 600);
  }
}

function updateFillProgress() {
  var answered = Object.values(_fillState).filter(function(s){ return s.selected !== null; }).length;
  var pct = answered / _fillQuestions.length * 100;
  var fillBar = document.getElementById('fill-progress-fill');
  if (fillBar) fillBar.style.width = pct + '%';
}

async function showFillResult() {
  var correct = Object.values(_fillState).filter(function(s){ return s.correct; }).length;
  var total = _fillQuestions.length;
  var pct = Math.round(correct / total * 100);
  var emoji = pct >= 80 ? '🎉' : pct >= 60 ? '👍' : '💪';
  var color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626';

  var finalEl = document.getElementById('fill-final');
  if (!finalEl) return;
  finalEl.style.display = 'block';
  finalEl.innerHTML =
    '<div style="background:linear-gradient(135deg,#0b1626,#1a3a6b);border-radius:16px;padding:28px;text-align:center;margin-top:8px">'
    + '<div style="font-size:48px;margin-bottom:10px">' + emoji + '</div>'
    + '<div style="font-size:20px;font-weight:900;color:#fff;margin-bottom:4px">Exercise Complete!</div>'
    + '<div style="font-size:36px;font-weight:900;color:' + color + ';margin:12px 0">' + correct + ' / ' + total + '</div>'
    + '<div style="font-size:13px;color:rgba(255,255,255,.5);margin-bottom:20px">' + pct + '% correct</div>'
    + '<div style="height:6px;background:rgba(255,255,255,.15);border-radius:999px;margin:0 auto 20px;max-width:200px;overflow:hidden">'
    + '<div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:999px;transition:width .8s"></div>'
    + '</div>'
    + '<button onclick="resetFill()" style="padding:11px 28px;background:#fff;color:#0b1626;border:none;border-radius:999px;font-size:13px;font-weight:900;cursor:pointer;margin-right:8px">🔄 Try Again</button>'
    + '<button onclick="switchArtTab(\'article\',document.querySelectorAll(\'.art-tab\')[0])" style="padding:11px 28px;background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:999px;font-size:13px;font-weight:800;cursor:pointer">📰 Back to Article</button>'
    + '</div>';

  // 퀴즈 완료 뱃지/XP
  if (typeof trackActivityOnQuizComplete === 'function') trackActivityOnQuizComplete(pct);
  await dmTrackFill();
}

function resetFill() {
  _fillLoaded = false;
  _fillArticleId = null;
  // 기존 exercise 영역 비우기
  var area = document.getElementById('fill-exercise-area');
  if (area) area.innerHTML = '';
  loadFillExercise();
}
// ══ END FILL-IN-THE-BLANK ENGINE ═══════════════════════════════════════════════

async function loadGrammarGuide() {
  var el = document.getElementById('grammar-content');
  if (!el) return;

  var params = new URLSearchParams(window.location.search);
  var id = params.get('id');

  if (el.dataset.loadedId === String(id) && el.dataset.source === 'ai') return;
  el.dataset.loadedId = String(id);
  el.dataset.source = '';

  var all = getCachedArticles();
  var a = id ? all.find(function(x){ return String(x.id) === String(id); }) : null;
  if (!a) { el.innerHTML = '<p style="color:#aaa;padding:20px 0;text-align:center">Article not found.</p>'; return; }

  el.innerHTML = '<div style="color:#aaa;padding:20px 0;text-align:center">✨ Analyzing grammar...</div>';

  // ── DB 캐시 확인 ──────────────────────────────────────────
  try {
    var cached = await getFromCache('article', a.id, 'grammar_guide');
    if (cached && cached.patterns && cached.patterns.length) {
      el.dataset.source = 'ai';
      renderGrammarGuideHTML(el, cached.patterns);
      return;
    }
  } catch(e) {}
  if (!a) { el.innerHTML = '<p style="color:#aaa;padding:20px 0;text-align:center">Article not found.</p>'; return; }

  el.innerHTML = '<div style="color:#aaa;padding:20px 0;text-align:center">✨ Analyzing grammar with AI...</div>';

  var text = (a.title || '') + '\n\n' + (a.body || '') + '\n\n' + (a.full || '');
  var level = a.level || 'Intermediate';
  var prompt = 'You are a Korean language teacher. Carefully read this specific Korean news article and identify 3-4 grammar patterns that actually appear in THIS article. Do NOT use generic examples — find patterns from the actual sentences in the article.\n\n'
    + 'Article level: ' + level + '\n'
    + 'Article:\n' + text.slice(0, 1200) + '\n\n'
    + 'For each pattern: quote the exact sentence from the article, highlight the grammar point with <strong> tags, and explain it clearly for a ' + level + ' learner.\n\n'
    + 'Respond ONLY in this exact JSON format (no markdown, no extra text):\n'
    + '{"patterns":[{"name":"grammar name in Korean + romanization","level":"Beginner or Intermediate or Advanced","exp":"Clear English explanation in 1-2 sentences.","ex_ko":"Exact sentence from the article with grammar point in <strong> tags","ex_en":"English translation of that sentence"}]}';
  try {
    var res = await callClaude({
      feature: 'grammar',
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }]
    });
    if (!res.ok && res.status) throw new Error('HTTP ' + res.status);
    var data = res;
    var rawText = '';
    if (data.content && data.content[0] && data.content[0].text) rawText = data.content[0].text;
    else if (data.text) rawText = data.text;
    if (!rawText) throw new Error('empty response');
    var clean = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    var jsonStart = clean.indexOf('{');
    var jsonEnd = clean.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd > jsonStart) clean = clean.slice(jsonStart, jsonEnd + 1);
    var parsed = JSON.parse(clean);
    var guides = parsed.patterns || [];
    el.dataset.source = 'ai';

    renderGrammarGuideHTML(el, guides);

    // ── DB에 캐시 저장 ────────────────────────────────────
    try {
      if (guides.length) {
        upsertArticleCacheRow(a.id, { grammar: JSON.stringify({ patterns: guides }) });
      }
    } catch(e) {}
  } catch(e) {
    if (e && (e.message === 'Not signed in' || e.message === 'unauthorized')) {
      el.dataset.source = ''; // allow retry
      if (supaUser) {
        // User is logged in but got a token error — don't show sign-in prompt
        el.innerHTML = '<div style="text-align:center;padding:28px 16px">'
          + '<div style="font-size:14px;font-weight:700;color:#0b1626;margin-bottom:8px">Grammar Guide unavailable</div>'
          + '<div style="font-size:13px;color:#64748b;margin-bottom:20px">A session error occurred. Please reload the page and try again.</div>'
          + '<button onclick="loadGrammarGuide()" style="padding:10px 28px;background:linear-gradient(135deg,#2d6be4,#1e4fa3);color:#fff;border:none;border-radius:999px;font-size:13px;font-weight:800;cursor:pointer">Retry</button>'
          + '</div>';
        if (typeof toast === 'function') toast('Session error — please reload and try again.', true);
      } else {
        el.innerHTML = '<div style="text-align:center;padding:28px 16px">'
          + '<div style="font-size:32px;margin-bottom:12px">🔒</div>'
          + '<div style="font-size:14px;font-weight:700;color:#0b1626;margin-bottom:8px">Sign in to use Grammar Guide</div>'
          + '<div style="font-size:13px;color:#64748b;margin-bottom:20px">AI-powered grammar analysis is available for signed-in users.</div>'
          + '<button onclick="openAuthModal(&apos;signin&apos;)" style="padding:10px 28px;background:linear-gradient(135deg,#2d6be4,#1e4fa3);color:#fff;border:none;border-radius:999px;font-size:13px;font-weight:800;cursor:pointer">Sign In →</button>'
          + '</div>';
      }
    } else {
      renderStaticGrammar(el, a);
    }
  }
}

function renderGrammarGuideHTML(el, guides) {
  el.innerHTML = '<p class="grammar-intro">Grammar patterns found in this article</p>'
    + guides.map(function(g, i){ return renderGrammarGuideCard(g, i); }).join('');
}

function renderGrammarGuideCard(g, idx) {
  var focus = encodeURIComponent(g.name || '');
  var levelColors = { Beginner:'#16a34a', Intermediate:'#d97706', Advanced:'#dc2626' };
  var levelBgs    = { Beginner:'#f0fdf4', Intermediate:'#fffbeb', Advanced:'#fff1f2' };
  var lv = g.level || 'Intermediate';
  var num = (idx !== undefined) ? idx + 1 : '';
  return '<div class="grammar-point">'
    + '<div class="gp-header">'
    + (num ? '<span class="gp-num">' + num + '</span>' : '')
    + '<div class="gp-title-group">'
    + '<span class="grammar-name">' + (g.name || '') + '</span>'
    + '<span class="gp-level-badge" style="background:' + (levelBgs[lv]||'#f0f4ff') + ';color:' + (levelColors[lv]||'#2255a4') + '">' + ({Starter:'Seed',Beginner:'Sprout',Intermediate:'Tree',Advanced:'Forest'}[lv]||lv) + '</span>'
    + '</div>'
    + '</div>'
    + '<p class="grammar-explanation">' + (g.exp || '') + '</p>'
    + '<div class="grammar-example">'
    + '<div class="ge-label">Example</div>'
    + '<p class="ge-ko">' + (g.ex_ko || '') + '</p>'
    + '<p class="ge-en">' + (g.ex_en || '') + '</p>'
    + '</div>'
    + '<div class="gp-footer">'
    + '<a href="korehan-study-room.html?focus=' + focus + '&source=grammar-guide" class="gp-study-btn">Study this grammar →</a>'
    + '</div>'
    + '</div>';
}

function renderStaticGrammar(el, a) {
  var text = (a.title || '') + ' ' + (a.body || '') + ' ' + (a.full || '');
  var patterns = [
    { pattern:/었|았/, name:'~었/았 Past Tense', level:'Beginner', exp:'Added to verb stems to express past tense, like "-ed" in English. Use 았 after ㅏ/ㅗ vowels, 었 everywhere else.', ex_ko:'경제가 회복됐<strong>어요</strong>.', ex_en:'The economy recovered.' },
    { pattern:/이다|입니다|이에요|예요/, name:'~이에요/예요 "To Be"', level:'Beginner', exp:'Korean equivalent of "is/are". Use 이에요 after a final consonant, 예요 after a vowel.', ex_ko:'서울<strong>이에요</strong>.', ex_en:"It's Seoul." },
    { pattern:/을|를/, name:'을/를 Object Marker', level:'Beginner', exp:'Attaches to the object of a verb. Use 을 after a consonant, 를 after a vowel.', ex_ko:'뉴스<strong>를</strong> 읽어요.', ex_en:'I read the news.' },
    { pattern:/에서/, name:'에서 Location Marker', level:'Beginner', exp:'Marks where an action takes place — like "at" or "in" in English.', ex_ko:'서울<strong>에서</strong> 발표했어요.', ex_en:'It was announced in Seoul.' },
    { pattern:/위한|위해/, name:'~을 위해/위한 "For"', level:'Intermediate', exp:'Means "for the purpose of" or "in order to". 위해 precedes verbs, 위한 precedes nouns.', ex_ko:'경제 회복<strong>을 위한</strong> 방안이에요.', ex_en:"It's a plan for economic recovery." },
    { pattern:/로 인해|로 인한/, name:'~로 인해 "Due to"', level:'Intermediate', exp:'Means "due to" or "because of" — used to state a cause or reason.', ex_ko:'수출 증가<strong>로 인해</strong> 흑자가 됐어요.', ex_en:'Due to export growth, it turned a surplus.' },
    { pattern:/면서|하면서/, name:'~면서 "While"', level:'Intermediate', exp:'Connects two simultaneous actions, like "while" in English.', ex_ko:'일하<strong>면서</strong> 공부해요.', ex_en:'I study while working.' },
    { pattern:/것으로|것이다|것을/, name:'~는 것 Nominalization', level:'Intermediate', exp:'Turns a verb into a noun clause — similar to adding "-ing" in English. 것 means "thing" or "fact".', ex_ko:'결정한 <strong>것으로</strong> 알려졌어요.', ex_en:'It is known that a decision was made.' },
  ];
  var guides = patterns.filter(function(p){ return p.pattern.test(text); }).slice(0, 4);
  if (guides.length < 3) guides = patterns.slice(0, 4);

  el.innerHTML = '<p class="grammar-intro">Grammar patterns in this article:</p>'
    + guides.map(renderGrammarGuideCard).join('');
}

function isWordSaved(ko) {
  // Prefer DB-backed set (synced on auth) for cross-device consistency
  if (_savedWordsSet) return _savedWordsSet.has(ko);
  // Fallback to localStorage for logged-out users or before DB sync completes
  var saved = lsGet(K_SAVED, []);
  return saved.some(function(w){ return (w.ko || w.word_ko || '') === ko; });
}

function renderArticleVocab(a) {
  var el = document.getElementById('art-vocab-list');
  if (!el) return;
  var text = (a.title || '') + ' ' + (a.body || '') + ' ' + (a.full || '');
  var found = [];
  Object.keys(VOCAB).forEach(function(k) {
    if (text.indexOf(k) !== -1 && found.length < 10) found.push(k);
  });
  if (!found.length) { var box = el.closest('.art-vocab-box'); if(box) box.style.display = 'none'; return; }

  el.innerHTML = found.map(function(k) {
    var v = VOCAB[k];
    var saved = isWordSaved(k);
    var safeK  = k.replace(/'/g, "\\'");
    var safeR  = (v.rom||'').replace(/'/g, "\\'");
    var safeE  = (v.en||'').replace(/'/g, "\\'");
    return '<div class="art-vocab-item" id="avi-' + k + '">'
      + '<div class="avi-main">'
      + '<span class="art-vocab-ko">' + k + '</span>'
      + '<span class="art-vocab-rom">' + (v.rom||'') + '</span>'
      + '<span class="art-vocab-en">' + (v.en||'') + '</span>'
      + '</div>'
      + '<div class="avi-actions">'
      + ttsBtn(k)
      + '<button class="avi-save-btn' + (saved?' saved':'') + '" title="' + (saved?'Saved':'Save word') + '" '
      + 'onclick="handleVocabSave(this,\'' + safeK + '\',\'' + safeR + '\',\'' + safeE + '\')">'
      + (saved ? '<svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2z"/></svg><span>Saved</span>' : '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg><span>Save</span>')
      + '</button>'
      + '</div>'
      + '</div>';
  }).join('');
}

function _addWordToKeyVocabList(ko, rom, en) {
  var el = document.getElementById('art-vocab-list');
  if (!el) return;
  // 이미 있으면 스킵
  if (document.getElementById('avi-' + ko)) return;
  // 박스 보이게
  var box = el.closest('.art-vocab-box');
  if (box) box.style.display = '';
  var safeK = ko.replace(/'/g, "\\'");
  var safeR = (rom||'').replace(/'/g, "\\'");
  var safeE = (en||'').replace(/'/g, "\\'");
  var item = document.createElement('div');
  item.className = 'art-vocab-item';
  item.id = 'avi-' + ko;
  item.innerHTML =
    '<div class="avi-main">'
    + '<span class="art-vocab-ko">' + ko + '</span>'
    + '<span class="art-vocab-rom">' + (rom||'') + '</span>'
    + '<span class="art-vocab-en">' + (en||'') + '</span>'
    + '</div>'
    + '<div class="avi-actions">'
    + ttsBtn(ko)
    + '<button class="avi-save-btn" title="Save word" '
    + 'onclick="handleVocabSave(this,\'' + safeK + '\',\'' + safeR + '\',\'' + safeE + '\')">'
    + '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg><span>Save</span>'
    + '</button>'
    + '</div>';
  el.insertBefore(item, el.firstChild);
}

async function handleVocabSave(btn, ko, rom, en) {
  var already = btn.classList.contains('saved');
  if (already) {
    if (typeof toast === 'function') toast('Already in your word list.', false);
    return;
  }
  btn.disabled = true;
  await dbSaveWord(ko, rom, en);
  btn.classList.add('saved');
  btn.title = 'Saved';
  btn.innerHTML = '<svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2z"/></svg><span>Saved</span>';
  btn.disabled = false;
  if (typeof toast === 'function') toast('Saved to your word list!', false);
}

// ── Highlighted Expressions ───────────────────────────────────
// Expressions are stored in article_cache.expressions as:
// [{"phrase":"표현","color":"blue","note":"optional note"}]
// Colors: "blue" (default), "green", "amber", "rose"
var _EXPR_COLORS = {
  blue:  { bg:'rgba(37,99,235,.25)',  border:'#93c5fd', text:'inherit' },
  green: { bg:'rgba(22,163,74,.25)',  border:'#86efac', text:'inherit' },
  amber: { bg:'rgba(217,119,6,.25)',  border:'#fcd34d', text:'inherit' },
  rose:  { bg:'rgba(225,29,72,.25)',  border:'#fda4af', text:'inherit' },
};

async function applyHighlightedExpressions(articleId) {
  if (!articleId) return;
  try {
    var exprs = await getFromCache('article', articleId, 'expressions');
    if (!exprs || !exprs.length) return;
    var articleEl = document.getElementById('art-tab-article');
    if (!articleEl) return;
    exprs.forEach(function(ex) {
      if (!ex.phrase) return;
      var c = _EXPR_COLORS[ex.color] || _EXPR_COLORS.blue;
      var safePhrase = ex.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var note = ex.note ? ' title="' + ex.note.replace(/"/g,'&quot;') + '"' : '';
      var html = '<mark class="kh-expr"'
        + ' style="background:' + c.bg + ';border-bottom:2px solid ' + c.border + ';color:' + c.text + '"'
        + note + '>' + ex.phrase + '</mark>';
      // Walk text nodes and replace
      var walker = document.createTreeWalker(articleEl, NodeFilter.SHOW_TEXT, null);
      var nodes = [];
      while(walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(function(n) {
        if (n.nodeValue && n.nodeValue.indexOf(ex.phrase) !== -1) {
          var parent = n.parentNode;
          if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') return;
          if (parent.closest('.kh-expr')) return;
          var parts = n.nodeValue.split(ex.phrase);
          if (parts.length < 2) return;
          var frag = document.createDocumentFragment();
          parts.forEach(function(part, i) {
            if (part) frag.appendChild(document.createTextNode(part));
            if (i < parts.length - 1) {
              var span = document.createElement('mark');
              span.className = 'kh-expr';
              span.style.cssText = 'background:' + c.bg + ';border-bottom:2px solid ' + c.border + ';color:' + c.text + ';border-radius:3px;padding:0 1px';
              if (ex.note) span.title = ex.note;
              span.textContent = ex.phrase;
              frag.appendChild(span);
            }
          });
          parent.replaceChild(frag, n);
        }
      });
    });
  } catch(e) {}
}

// ── 어드민 중요표현 CRUD ──────────────────────────────────────
var _phrasesAdminData = [];
var _phrasesAdminArtId = null;

async function _renderPhrasesAdmin(articleId) {
  var el = document.getElementById('art-phrases-admin');
  if (!el) return;
  _phrasesAdminArtId = articleId;
  el.style.display = 'block';
  el.innerHTML = '<div style="color:#94a3b8;font-size:12px;padding:8px">Loading...</div>';

  try {
    var exprs = await getFromCache('article', articleId, 'expressions');
    _phrasesAdminData = exprs && Array.isArray(exprs) ? exprs : [];
  } catch(e) { _phrasesAdminData = []; }
  _phrasesAdminRender(el);
}

function _phrasesAdminRender(el) {
  if (!el) el = document.getElementById('art-phrases-admin');
  if (!el) return;
  var rows = _phrasesAdminData.map(function(p, i) {
    var colorOpts = ['blue','green','amber','rose'].map(function(c){
      return '<option value="'+c+'"'+(p.color===c?' selected':'')+'>'+c+'</option>';
    }).join('');
    return '<div style="display:grid;grid-template-columns:1fr 1fr 80px 32px;gap:6px;align-items:center;margin-bottom:4px" data-pi="'+i+'">'
      + '<input class="pa-phrase" value="'+(p.phrase||'').replace(/"/g,'&quot;')+'" placeholder="표현" style="padding:5px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;font-family:\'Noto Sans KR\',sans-serif">'
      + '<input class="pa-note" value="'+(p.note||'').replace(/"/g,'&quot;')+'" placeholder="설명 (영어)" style="padding:5px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px">'
      + '<select class="pa-color" style="padding:5px;border:1px solid #e2e8f0;border-radius:6px;font-size:11px">'+colorOpts+'</select>'
      + '<button onclick="_phraseAdminDel('+i+')" style="background:#fee2e2;color:#991b1b;border:none;border-radius:6px;padding:4px;cursor:pointer;font-size:12px">✕</button>'
      + '</div>';
  }).join('');

  el.innerHTML = '<div style="margin-top:20px;padding:16px;background:#fefce8;border:1px solid #fde68a;border-radius:12px">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
    + '<div style="font-size:13px;font-weight:800;color:#92400e">✏️ 중요표현 관리 (Admin)</div>'
    + '<div style="display:flex;gap:6px">'
    + '<button onclick="_phraseAdminAdd()" style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer">+ 추가</button>'
    + '<button onclick="_phraseAdminSave()" style="background:#16a34a;color:#fff;border:none;border-radius:6px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer">저장</button>'
    + '</div></div>'
    + (rows || '<div style="font-size:12px;color:#a16207;padding:4px">표현이 없습니다. + 추가를 눌러주세요.</div>')
    + '</div>';
}

function _phraseAdminAdd() {
  _phrasesAdminData.push({ phrase:'', note:'', color:'amber' });
  _phrasesAdminRender();
}

function _phraseAdminDel(i) {
  _phrasesAdminData.splice(i, 1);
  _phrasesAdminRender();
}

function _phraseAdminReadFromDOM() {
  var el = document.getElementById('art-phrases-admin');
  if (!el) return;
  var rows = el.querySelectorAll('[data-pi]');
  rows.forEach(function(row, i) {
    if (!_phrasesAdminData[i]) return;
    var phr = row.querySelector('.pa-phrase');
    var note = row.querySelector('.pa-note');
    var color = row.querySelector('.pa-color');
    if (phr) _phrasesAdminData[i].phrase = phr.value.trim();
    if (note) _phrasesAdminData[i].note = note.value.trim();
    if (color) _phrasesAdminData[i].color = color.value;
  });
}

async function _phraseAdminSave() {
  _phraseAdminReadFromDOM();
  var valid = _phrasesAdminData.filter(function(p){ return p.phrase; });
  _phrasesAdminData = valid;
  try {
    await upsertArticleCacheRow(_phrasesAdminArtId, { expressions: valid });
    toast('✅ 중요표현 저장 완료');
    // 하이라이트 재적용
    var articleEl = document.getElementById('art-tab-article');
    if (articleEl) {
      articleEl.querySelectorAll('.kh-expr').forEach(function(m){ m.outerHTML = m.textContent; });
      applyHighlightedExpressions(_phrasesAdminArtId);
    }
    _phrasesAdminRender();
  } catch(e) {
    toast('❌ 저장 실패: ' + e.message);
  }
}

// ── Analyze Mode ──────────────────────────────────────────────
var _analyzeOn = false;
var _analyzeData = null; // { vocab, grammar, phrases }
var _analyzeOrigHTML = '';

async function toggleAnalyze() {
  var btn = document.getElementById('analyze-btn');
  var articleEl = document.getElementById('art-tab-article');
  if (!articleEl) return;

  if (_analyzeOn) {
    // OFF — 원래 텍스트로 복원, 단어 hover는 유지
    _analyzeOn = false;
    if (btn) btn.classList.remove('on');
    articleEl.querySelectorAll('.kh-analyze-mark').forEach(function(m) {
      m.outerHTML = m.textContent;
    });
    // 단어 hover 재적용
    articleEl.querySelectorAll('.vocab-zone').forEach(function(el){ wrapVocab(el); });
    return;
  }

  // ON
  _analyzeOn = true;
  if (btn) btn.classList.add('on');

  var a = window._currentArticle;
  if (!a) return;

  // 캐시에서 데이터 로드
  if (!_analyzeData) {
    try {
      var cached = await getFromCache('article', a.id);
      _analyzeData = {
        vocab: (cached && cached.vocab) || [],
        grammar: [],
        phrases: []
      };
      // grammar_guide 캐시에서 문법 패턴 추출
      var gramCache = await getFromCache('article', a.id, 'grammar_guide');
      if (gramCache && typeof gramCache === 'string') {
        var gMatch = gramCache.match(/\*\*([^*]+)\*\*/g);
        if (gMatch) _analyzeData.grammar = gMatch.map(function(m){ return m.replace(/\*\*/g,'').trim(); }).filter(function(g){ return g.length > 1 && g.length < 20; });
      }
      // expressions 캐시
      var exprCache = await getFromCache('article', a.id, 'expressions');
      if (exprCache && exprCache.length) {
        _analyzeData.phrases = exprCache.map(function(e){ return { text: e.phrase, note: e.note||'' }; });
      }
    } catch(e) { _analyzeData = { vocab:[], grammar:[], phrases:[] }; }
  }

  // 데이터 부족하면 Claude로 생성
  if (!_analyzeData.vocab.length && !_analyzeData.grammar.length && !_analyzeData.phrases.length) {
    if (btn) btn.textContent = '...';
    try {
      var bodyText = (a.body||'').replace(/<[^>]*>/g,'').slice(0,1600);
      var res = await callClaude({
        feature:'article-analyze', model:'claude-haiku-4-5-20251001', max_tokens:800,
        messages:[{role:'user',content:'Analyze this Korean article for language learners. Return ONLY JSON:\n{"vocab":["word1","word2"],"grammar":["어미1","어미2"],"phrases":["phrase1","phrase2"]}\n\nRules:\n- vocab: 8 key Korean WORDS (single words only, e.g. 경제, 발표, 증가)\n- grammar: 5 grammar ENDINGS as they appear in the article text (e.g. 했다, 된다, 하고 있다, 할 수 있다, 때문에). Must be short (2-6 chars), must appear verbatim in the text.\n- phrases: 5 important multi-word expressions (2-5 words, e.g. 문제가 되다, 영향을 미치다)\n\nArticle:\n'+bodyText}]
      });
      var raw = ((res.content)||[]).map(function(c){return c.text||'';}).join('');
      var cl = raw.replace(/```json|```/g,'').trim();
      var s=cl.indexOf('{'),e2=cl.lastIndexOf('}'); if(s>=0&&e2>s) cl=cl.slice(s,e2+1);
      var parsed = JSON.parse(cl);
      _analyzeData.vocab = (parsed.vocab||[]).map(function(w){ return typeof w==='string'?w:w.ko||''; }).filter(Boolean);
      _analyzeData.grammar = (parsed.grammar||[]).filter(Boolean);
      _analyzeData.phrases = (parsed.phrases||[]).map(function(p){ return typeof p==='string'?{text:p,note:''}:{text:p.ko||p,note:p.en||''}; });
    } catch(e) { console.warn('Analyze generation failed:', e); }
    if (btn) btn.innerHTML = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
  }

  // 하이라이트 적용
  _applyAnalyzeHighlights(articleEl);
}

function _applyAnalyzeHighlights(articleEl) {
  if (!_analyzeData) return;
  var bodyText = articleEl.innerHTML;

  // 우선순위: phrases(노란) > grammar(초록) > vocab(주황)
  // phrases 먼저 (긴 텍스트)
  (_analyzeData.phrases||[]).forEach(function(p) {
    if (!p.text || p.text.length < 2) return;
    var safe = p.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re = new RegExp('(?<!<[^>]*)(' + safe + ')(?![^<]*>)', 'g');
    var tooltip = p.note ? ' title="'+p.note.replace(/"/g,'&quot;')+'"' : '';
    bodyText = bodyText.replace(re, '<mark class="kh-analyze-mark kh-a-phrase" style="background:rgba(251,191,36,.4);border-bottom:2.5px solid #f59e0b;border-radius:3px;padding:0 2px;cursor:help;color:inherit"'+tooltip+'>$1</mark>');
  });
  // grammar (초록) — 짧은 어미만 (6자 이하)
  (_analyzeData.grammar||[]).forEach(function(g) {
    if (!g || g.length < 2 || g.length > 8) return;
    var safe = g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re = new RegExp('(?<!<[^>]*)(' + safe + ')(?![^<]*>)', 'g');
    bodyText = bodyText.replace(re, '<mark class="kh-analyze-mark kh-a-grammar" style="background:rgba(34,197,94,.35);border-bottom:2.5px solid #22c55e;border-radius:3px;padding:0 2px;cursor:help;color:inherit" title="Grammar: '+g+'">$1</mark>');
  });
  // vocab (주황)
  (_analyzeData.vocab||[]).forEach(function(w) {
    if (!w || w.length < 1) return;
    var safe = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re = new RegExp('(?<!<[^>]*)(' + safe + ')(?![^<]*>)', 'g');
    var vInfo = window.VOCAB && window.VOCAB[w];
    var tip = vInfo ? (w + ': ' + (vInfo.en||'')).replace(/"/g,'&quot;') : w;
    bodyText = bodyText.replace(re, '<mark class="kh-analyze-mark kh-a-vocab" style="background:rgba(249,115,22,.35);border-bottom:2.5px solid #f97316;border-radius:3px;padding:0 2px;cursor:help;color:inherit" title="'+tip+'">$1</mark>');
  });

  articleEl.innerHTML = bodyText;
  // 단어 hover 재적용
  articleEl.querySelectorAll('.vocab-zone').forEach(function(el){ wrapVocab(el); });
}

// Analyze 버튼 active 스타일
(function(){
  var s = document.createElement('style');
  s.textContent = '.art-action-icon.on{background:#2563eb!important;color:#fff!important;}';
  document.head.appendChild(s);
})();

// ── 기사 검색 ─────────────────────────────────────────────────
function doSearch(q) {
  if (!q || !q.trim()) return;
  window.location.href = 'korehan-all.html?search=' + encodeURIComponent(q.trim());
}

function renderSearchResults(q, articles) {
  var filtered = articles.filter(function(a) {
    var text = (a.title || '') + ' ' + (a.body || '') + ' ' + (a.section || '');
    return text.toLowerCase().indexOf(q.toLowerCase()) !== -1;
  });
  return { query: q, results: filtered };
}

// ── 읽은 기사 저장 ─────────────────────────────────────────────
async function markArticleRead(articleId, title, section, level) {
  // localStorage에 오늘 읽은 기사 ID 기록 (데일리 테스트용)
  try {
    var todayKey = new Date(Date.now() + 9*60*60*1000).toISOString().slice(0,10);
    var readLog = JSON.parse(localStorage.getItem('kh_read_log') || '{}');
    if (!readLog[todayKey]) readLog[todayKey] = [];
    var id = String(articleId);

    if (readLog[todayKey].indexOf(id) === -1) {
      // 오늘 처음 보는 기사 — 조회수 카운터 증가 후 XP 여부 결정
      var artViews = JSON.parse(localStorage.getItem('kh_art_views') || '{}');
      var prevViews = artViews[id] || 0;
      artViews[id] = prevViews + 1;
      localStorage.setItem('kh_art_views', JSON.stringify(artViews));
      var canEarnXP = prevViews < 2; // 총 2일치 읽기만 XP (3일째부터 없음)

      readLog[todayKey].push(id);
      localStorage.setItem('kh_read_log', JSON.stringify(readLog));
      trackActivityOnArticleRead(section, { grantXP: canEarnXP && readLog[todayKey].length <= ARTICLE_XP_DAILY_CAP, content_id: id });
    } else {
      // 오늘 이미 읽은 기사 — 재방문은 artViews 카운트에 포함시키지 않음
      localStorage.setItem('kh_read_log', JSON.stringify(readLog));
    }
  } catch(e) {}

  var sb = getSupa();
  if (!sb || !supaUser) return;
  try {
    // 기존 read_articles 테이블
    await sb.from('read_articles').upsert({
      user_id: supaUser.id,
      article_id: String(articleId),
      title: title || '',
      section: section || '',
      read_at: new Date().toISOString()
    }, { onConflict: 'user_id,article_id' });
  } catch(e) {}
  // learning hub read_history 테이블 (RPC)
  try {
    await sb.rpc('log_read_event', {
      p_user_id: supaUser.id,
      p_content_type: 'article',
      p_content_id: String(articleId),
      p_title: title || '',
      p_level: level || '',
      p_category: section || '',
      p_completed: false
    });
  } catch(e) {} // RPC 미설치 시 조용히 무시
}

// ── 영어 번역 토글 ─────────────────────────────────────────────
var translateActive = false;
var translateCache = {};

async function toggleTranslate() {
  var btn = document.getElementById('translate-btn');
  var zones = document.querySelectorAll('.vocab-zone');
  if (!btn || !zones.length) return;

  if (translateActive) {
    // 원문으로 복원
    zones.forEach(function(z) {
      if (z.dataset.original) z.innerHTML = z.dataset.original;
    });
    translateActive = false;
    btn.textContent = '🌐 Translate';
    btn.classList.remove('active');
    return;
  }

  btn.textContent = '⏳ Translating...';
  btn.disabled = true;

  var params = new URLSearchParams(window.location.search);
  var id = params.get('id');
  var cacheKey = 'trans_' + id;

  try {
    var sharedCached = await getFromCache('article', id, 'translation_en');
    if (sharedCached && sharedCached.translations && sharedCached.translations.length) {
      translateCache[cacheKey] = sharedCached.translations;
      applyTranslation(zones, sharedCached.translations);
      btn.textContent = '🇰🇷 Back to Korean';
      btn.disabled = false;
      btn.classList.add('active');
      translateActive = true;
      return;
    }
  } catch(e) {}

  if (translateCache[cacheKey]) {
    applyTranslation(zones, translateCache[cacheKey]);
    btn.textContent = '🇰🇷 Back to Korean';
    btn.disabled = false;
    btn.classList.add('active');
    translateActive = true;
    return;
  }

  if (!supaUser) {
    btn.textContent = '🌐 Translate';
    btn.disabled = false;
    if (typeof toast === 'function') toast('Please sign in to create a new translation when no shared cache exists.', true);
    return;
  }

  // 번역할 텍스트 수집 - 원본 텍스트만 추출
  var texts = [];
  zones.forEach(function(z) {
    if (!z.dataset.original) z.dataset.original = z.innerHTML;
    // kh-word span 제거하고 순수 텍스트만
    var clone = z.cloneNode(true);
    clone.querySelectorAll('.kh-hover-word,.kh-word').forEach(function(s){ s.replaceWith(s.textContent); });
    texts.push(clone.textContent.trim());
  });

  // 빈 존 제거 (인덱스 매핑 보존용으로 빈 문자열 유지)
  var prompt = 'You are a Korean-to-English translator. Translate each numbered Korean text segment below into natural English. Translate the COMPLETE text without any truncation. Return ONLY a JSON array of translated strings in the exact same order. No markdown, no explanations, just the JSON array.\n\nSegments:\n'
    + JSON.stringify(texts);

  try {
    var res = await callClaude({
      feature: 'translate',
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    });
    var data = res;

    // 응답 파싱 (Workers vs 직접 API 둘 다 대응)
    var raw = '';
    if (data.content && data.content[0] && data.content[0].text) raw = data.content[0].text;
    else if (data.text) raw = data.text;
    else if (typeof data === 'string') raw = data;

    if (!raw) throw new Error('empty response');

    var clean = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
    // JSON 배열만 추출
    var arrStart = clean.indexOf('[');
    var arrEnd   = clean.lastIndexOf(']');
    if (arrStart >= 0 && arrEnd > arrStart) clean = clean.slice(arrStart, arrEnd + 1);

    var translations = JSON.parse(clean);
    if (!Array.isArray(translations)) throw new Error('not array');

    translateCache[cacheKey] = translations;
    applyTranslation(zones, translations);
    translateActive = true;
    btn.textContent = '🇰🇷 Back to Korean';
    btn.classList.add('active');

    try {
      if (translations.length) {
        upsertArticleCacheRow(id, { translation: JSON.stringify({ texts: translations }) });
      }
    } catch(e) {}
  } catch(e) {
    btn.textContent = '🌐 Translate';
    btn.classList.remove('active');
    translateActive = false;
    if (e && (e.message === 'unauthorized' || e.message === 'Not signed in')) {
      if (!supaUser) {
        if (typeof openAuthModal === 'function') openAuthModal('signin');
        if (typeof toast === 'function') toast('Please sign in to use Translation.', true);
      } else {
        if (typeof toast === 'function') toast('Session error — please reload and try again.', true);
      }
    } else {
      if (typeof toast === 'function') toast('Translation failed — check your connection and try again.', true);
    }
  }
  btn.disabled = false;
}

function applyTranslation(zones, translations) {
  zones.forEach(function(z, i) {
    if (translations[i]) z.innerHTML = '<p>' + translations[i] + '</p>';
  });
}

function shareArticle() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: window.location.href });
  } else {
    navigator.clipboard.writeText(window.location.href).then(function() {
      toast('Link copied ✓');
    });
  }
}

// ── 북마크 ────────────────────────────────────────────────────
async function toggleBookmark(articleId, btn) {
  if (!supaUser) { openAuthModal("signin"); return; }
  var sb = getSupa();
  if (!sb) return;

  var isBookmarked = btn.classList.contains('active');
  if (isBookmarked) {
    await sb.from('bookmarks').delete().eq('user_id', supaUser.id).eq('article_id', articleId);
    btn.classList.remove('active');
    btn.innerHTML = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
    toast('Bookmark removed');
  } else {
    await sb.from('bookmarks').insert({ user_id: supaUser.id, article_id: articleId });
    btn.classList.add('active');
    btn.innerHTML = '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 0-2-2h10a2 2 0 0 0 2 2z"/></svg>';
    toast('Bookmarked ✓');
  }
}

async function checkBookmarkState(articleId) {
  var btn = document.getElementById('art-bm-btn');
  if (!btn || !supaUser) return;
  var sb = getSupa();
  if (!sb) return;
  var { data } = await sb.from('bookmarks').select('id').eq('user_id', supaUser.id).eq('article_id', articleId).maybeSingle();
  if (data) {
    btn.classList.add('active');
    btn.innerHTML = '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 0-2-2h10a2 2 0 0 0 2 2z"/></svg>';
  }
}

// ── 댓글 ──────────────────────────────────────────────────────
function updateCommentForm() {
  var formEl   = document.getElementById('comment-form');
  var noticeEl = document.getElementById('comment-login-notice');
  if (!formEl || !noticeEl) return;
  if (supaUser) {
    formEl.style.display = 'block';
    noticeEl.style.display = 'none';
  } else {
    formEl.style.display = 'none';
    noticeEl.style.display = 'block';
  }
}

async function loadComments(articleId) {
  var sb = getSupa();
  var listEl = document.getElementById('comments-list');
  var countEl = document.getElementById('comment-count');
  if (!listEl) return;

  if (!sb) {
    listEl.innerHTML = '<p style="color:#aaa;font-size:13px;padding:12px 0">Loading comments...</p>';
    return;
  }

  var { data, error } = await sb
    .from('comments')
    .select('*')
    .eq('article_id', articleId)
    .order('created_at', { ascending: true });

  if (error || !data || !data.length) {
    listEl.innerHTML = '<p style="color:#aaa;font-size:13px;padding:12px 0">Be the first to comment!</p>';
    if (countEl) countEl.textContent = '';
    return;
  }

  if (countEl) countEl.textContent = '(' + data.length + ')';

  listEl.innerHTML = data.map(function(c) {
    var isOwn = supaUser && supaUser.id === c.user_id;
    var avatar = (c.avatar_url && isValidImageURL(c.avatar_url))
      ? '<img src="' + escapeAttr(c.avatar_url) + '" class="comment-avatar" onerror="this.style.display=\'none\'">'
      : '<div class="comment-avatar" style="background:#2255a4;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700">' + (c.user_name||'?').charAt(0) + '</div>';
    var timeStr = c.created_at ? new Date(c.created_at).toLocaleDateString('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
    return '<div class="comment-row" id="comment-' + c.id + '">'
      + '<div class="comment-top">'
      + avatar
      + '<div class="comment-meta">'
      + '<span class="comment-name">' + escapeHTML(c.user_name || 'Anonymous') + '</span>'
      + '<span class="comment-date">' + timeStr + '</span>'
      + '</div>'
      + (isOwn ? '<button class="comment-del" onclick="deleteComment(\'' + escapeAttr(c.id) + '\')" title="Delete">✕</button>' : '')
      + '</div>'
      + '<div class="comment-body">' + escapeHtml(c.content) + '</div>'
      + '</div>';
  }).join('');
}

// 댓글 rate limit: 유저별 마지막 작성 시간 추적
var _commentLastTime = {};
var COMMENT_COOLDOWN_MS = 30000; // 30초
var COMMENT_MAX_LENGTH  = 500;
var COMMENT_MIN_LENGTH  = 2;

// 기본 스팸 패턴 (URL 도배, 반복 문자)
function isSpamComment(text) {
  // 동일 문자 10개 이상 반복
  if (/(.)(\1){9,}/.test(text)) return true;
  // URL 3개 이상
  if ((text.match(/https?:\/\//g) || []).length >= 3) return true;
  // 전체가 공백/특수문자만
  if (!/[가-힣a-zA-Z0-9]/.test(text)) return true;
  return false;
}

async function submitComment(articleId) {
  if (!supaUser) { openAuthModal("signin"); return; }
  var input = document.getElementById('comment-input');
  var content = input ? input.value.trim() : '';

  // 길이 체크
  if (!content || content.length < COMMENT_MIN_LENGTH) {
    toast('Comment is too short.', true); return;
  }
  if (content.length > COMMENT_MAX_LENGTH) {
    toast('Comment is too long (max ' + COMMENT_MAX_LENGTH + ' characters).', true); return;
  }

  // 스팸 체크
  if (isSpamComment(content)) {
    toast('Comment looks like spam. Please write normally.', true); return;
  }

  // Rate limit 체크 (30초 쿨다운)
  var now = Date.now();
  var last = _commentLastTime[supaUser.id] || 0;
  if (now - last < COMMENT_COOLDOWN_MS) {
    var wait = Math.ceil((COMMENT_COOLDOWN_MS - (now - last)) / 1000);
    toast('Please wait ' + wait + ' seconds before posting again.', true); return;
  }

  var sb = getSupa();
  if (!sb) return;

  var { error } = await sb.from('comments').insert({
    article_id:  articleId,
    user_id:     supaUser.id,
    user_name:   supaUser.user_metadata && supaUser.user_metadata.full_name || supaUser.email,
    avatar_url:  supaUser.user_metadata && supaUser.user_metadata.avatar_url || null,
    content:     content,
  });

  if (error) { toast('Error posting comment: ' + error.message, true); return; }
  _commentLastTime[supaUser.id] = Date.now();
  input.value = '';
  toast('Comment posted ✓');
  loadComments(articleId);
}

async function deleteComment(commentId) {
  if (!supaUser) return;
  if (!confirm('Delete this comment?')) return;
  var sb = getSupa();
  if (!sb) return;
  var { error } = await sb.from('comments').delete().eq('id', commentId).eq('user_id', supaUser.id);
  if (error) { toast('Delete failed', true); return; }
  var el = document.getElementById('comment-' + commentId);
  if (el) el.remove();
  toast('Comment deleted');
}

// Alias for escapeHTML (defined earlier) — single entry point for all HTML escaping
var escapeHtml = escapeHTML;

// ── TOOLTIP ───────────────────────────────────────────────────
function initTooltips() {
  var tip = document.createElement('div');
  tip.id = 'kh-tip';
  Object.assign(tip.style, {
    position:'fixed', zIndex:'9999', pointerEvents:'none',
    background:'#0d1b2e', color:'#fff',
    padding:'8px 12px', borderRadius:'4px',
    fontFamily:"'Source Sans 3', sans-serif", fontSize:'13px',
    borderLeft:'3px solid #2255a4',
    boxShadow:'0 4px 16px rgba(0,0,0,0.35)',
    maxWidth:'220px', lineHeight:'1.4',
    opacity:'0', transition:'opacity 0.15s',
    whiteSpace:'nowrap',
  });
  document.body.appendChild(tip);

  document.querySelectorAll('.vocab-zone').forEach(function(el){ wrapVocab(el); });

  // 어드민 전용 편집 버튼 표시 (로그인 체크 후)
  if (window._isAdmin) {
    var adminBar = document.createElement('div');
    adminBar.id = 'vocab-admin-bar';
    adminBar.style.cssText = 'position:fixed;bottom:70px;right:16px;z-index:8000;background:#0b1626;color:#fff;border-radius:10px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.1);';
    adminBar.textContent = '✏️ Vocab Edit Mode';
    adminBar.onclick = function() { toggleVocabEditMode(); };
    document.body.appendChild(adminBar);
  }

  document.addEventListener('mouseover', function(e) {
    var w = e.target.closest ? e.target.closest('.kh-word') : null;
    if (!w) return;
    var word = w.dataset.word;
    var d = VOCAB[word];
    if (window._vocabEditMode && window._isAdmin) {
      tip.innerHTML = '<span style="font-size:13px;color:#fbbf24;font-weight:700">✏️ Click to edit</span><br>'
        + '<span style="color:#7ab8f5;font-weight:700">' + word + '</span>'
        + (d ? '<br><span style="color:#94a3b8;font-size:11px">' + d.en + '</span>' : '<br><span style="color:#f87171;font-size:11px">No definition</span>');
      tip.style.opacity = '1';
      return;
    }
    if (!d) return;
    tip.innerHTML = '<span style="font-size:16px;font-weight:700;color:#7ab8f5">' + word + '</span><br>'
      + '<span style="color:#aabbd0;font-size:11px;font-style:italic">' + d.rom + '</span><br>'
      + '<strong>' + d.en + '</strong>';
    tip.style.opacity = '1';
  });
  document.addEventListener('mousemove', function(e) {
    tip.style.left = (e.clientX + 14) + 'px';
    tip.style.top  = (e.clientY - 10) + 'px';
  });
  document.addEventListener('mouseout', function(e) {
    if (e.target.closest && e.target.closest('.kh-word')) tip.style.opacity = '0';
  });

  // 어드민 편집 모드 클릭/터치 처리
  function _editModeWordHandler(e) {
    if (!window._vocabEditMode || !window._isAdmin) return;
    var w = e.target.closest ? e.target.closest('.kh-word') : null;
    if (!w) return;
    // touchend: selection이 있으면 _handleVocabSelectionTouch가 처리
    if (e.type === 'touchend') {
      var sel = window.getSelection();
      if (sel && sel.toString().trim().length > 0) return;
    }
    e.preventDefault(); e.stopPropagation();
    tip.style.opacity = '0';
    openVocabEditModal(w.dataset.word);
  }
  document.addEventListener('click',    _editModeWordHandler);
  document.addEventListener('touchend', _editModeWordHandler, { passive: false });
}

var _vocabEditModeActive = false;
function toggleVocabEditMode() {
  window._vocabEditMode = !window._vocabEditMode;
  _vocabEditModeActive = window._vocabEditMode;
  var bar = document.getElementById('vocab-admin-bar');
  if (bar) {
    if (window._vocabEditMode) {
      bar.innerHTML = '<span>✅ Edit ON</span>'
        + '<button id="vocab-add-new-btn" onclick="event.stopPropagation();openVocabEditModal(\'\')" '
        + 'style="margin-left:8px;background:#2255a4;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">+ New Word</button>';
      bar.style.background = '#16a34a';
      bar.style.padding = '8px 12px';
    } else {
      bar.textContent = '✏️ Vocab Edit Mode';
      bar.style.background = '#0b1626';
      bar.style.padding = '8px 14px';
    }
  }
  document.querySelectorAll('.kh-word').forEach(function(w) {
    w.style.outline = window._vocabEditMode ? '2px dashed #fbbf24' : '';
    w.style.cursor  = window._vocabEditMode ? 'pointer' : '';
    w.style.borderRadius = window._vocabEditMode ? '2px' : '';
  });

  // 드래그/터치 선택 팝업 — 편집 모드 ON 시 등록
  if (window._vocabEditMode) {
    document.addEventListener('mouseup',  _handleVocabSelection);
    document.addEventListener('touchend', _handleVocabSelectionTouch);
  } else {
    document.removeEventListener('mouseup',  _handleVocabSelection);
    document.removeEventListener('touchend', _handleVocabSelectionTouch);
    var pop = document.getElementById('vocab-select-popup');
    if (pop) pop.remove();
  }
}

function _handleVocabSelectionTouch(e) {
  // On touch, selection needs a tick to settle after touchend
  setTimeout(function() { _handleVocabSelection(e); }, 80);
}

function _handleVocabSelection(e) {
  if (!window._vocabEditMode || !window._isAdmin) return;
  if (e.target && e.target.closest && (e.target.closest('#vocab-edit-modal') || e.target.closest('#vocab-select-popup') || e.target.closest('#vocab-admin-bar'))) return;

  var sel = window.getSelection();
  var text = sel ? sel.toString().trim() : '';

  var old = document.getElementById('vocab-select-popup');
  if (old) old.remove();

  if (!text || text.length < 1 || text.length > 15) return;
  if (!/[가-힣]/.test(text)) return;

  // 팝업 위치 — fixed 기준이므로 scrollY 더하면 안 됨
  var rect = null;
  try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch(err) { return; }
  if (!rect || rect.width === 0) return;

  var pop = document.createElement('div');
  pop.id = 'vocab-select-popup';
  pop.style.cssText = [
    'position:fixed',
    'z-index:99998',
    'background:#0b1626',
    'color:#fff',
    'border-radius:8px',
    'padding:9px 14px',
    'font-size:13px',
    'font-weight:700',
    'cursor:pointer',
    'box-shadow:0 4px 20px rgba(0,0,0,.5)',
    'border:1px solid rgba(255,255,255,.15)',
    'white-space:nowrap',
    'user-select:none'
  ].join(';');

  var leftPos = Math.max(8, Math.min(rect.left + rect.width / 2 - 70, window.innerWidth - 200));
  var topPos  = Math.max(8, rect.top - 48);
  pop.style.left = leftPos + 'px';
  pop.style.top  = topPos  + 'px';
  pop.innerHTML = '+ Add <span style="color:#7ab8f5;font-weight:900">' + text + '</span>';

  var selCopy = text; // 클로저용 복사
  pop.onclick = function(ev) {
    ev.stopPropagation();
    pop.remove();
    if (sel) sel.removeAllRanges();
    openVocabEditModal(selCopy);
  };
  document.body.appendChild(pop);

  // 다른 곳 클릭 시 팝업 닫기
  setTimeout(function() {
    function closePop(e2) {
      if (!e2.target.closest || !e2.target.closest('#vocab-select-popup')) {
        var p = document.getElementById('vocab-select-popup');
        if (p) p.remove();
        document.removeEventListener('mousedown', closePop);
      }
    }
    document.addEventListener('mousedown', closePop);
  }, 50);
}

function openVocabEditModal(word) {
  var existing = VOCAB[word] || { rom: '', en: '' };
  var isNew = !word; // 새 단어 Type Answer 모드
  var modal = document.createElement('div');
  modal.id = 'vocab-edit-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML =
    '<div style="background:#fff;border-radius:16px;padding:24px;max-width:400px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,.3);">'
    + '<div style="font-size:16px;font-weight:900;color:#0f172a;margin-bottom:16px;">✏️ ' + (isNew ? 'Add New Word' : 'Edit Word: <span style="color:#2255a4">' + word + '</span>') + '</div>'
    + (isNew
      ? '<label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Korean Word <span style="color:#e53e3e">*</span></label>'
        + '<input id="ve-word" placeholder="e.g. 환경" style="width:100%;padding:8px 12px;border:2px solid #2255a4;border-radius:8px;font-size:16px;font-family:\'Noto Serif KR\',serif;margin-bottom:12px;box-sizing:border-box;" autofocus>'
      : '')
    + '<label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Pronunciation (romanization)</label>'
    + '<input id="ve-rom" value="' + existing.rom + '" placeholder="e.g. hwan-gyeong" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;margin-bottom:12px;box-sizing:border-box;">'
    + '<label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">English Meaning <span style="color:#e53e3e">*</span></label>'
    + '<input id="ve-en" value="' + existing.en + '" placeholder="e.g. environment" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;margin-bottom:6px;box-sizing:border-box;">'
    + '<div id="ve-err" style="font-size:12px;color:#e53e3e;margin-bottom:12px;display:none;"></div>'
    + '<div style="display:flex;gap:8px;margin-top:16px;">'
    + '<button id="ve-save" style="flex:1;padding:10px;background:#2255a4;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:800;cursor:pointer;">Save</button>'
    + (!isNew && existing.en ? '<button id="ve-del" style="padding:10px 16px;background:#fee2e2;color:#b91c1c;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">Delete</button>' : '')
    + '<button id="ve-cancel" style="padding:10px 16px;background:#f1f5f9;color:#475569;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">Cancel</button>'
    + '</div></div>';

  document.body.appendChild(modal);

  modal.querySelector('#ve-cancel').onclick = function() { modal.remove(); };
  modal.onclick = function(e) { if (e.target === modal) modal.remove(); };

  var delBtn = modal.querySelector('#ve-del');
  if (delBtn) {
    delBtn.onclick = async function() {
      if (!confirm(word + '  — delete this word?')) return;
      await saveVocabToDB(word, null, null, true);
      delete VOCAB[word];
      // 해당 단어 span 제거
      document.querySelectorAll('.kh-word[data-word="' + word + '"]').forEach(function(s) {
        s.replaceWith(document.createTextNode(s.textContent));
      });
      modal.remove();
      showToast('🗑 ' + word + ' deleted');
    };
  }

  modal.querySelector('#ve-save').onclick = async function() {
    var wordEl = modal.querySelector('#ve-word');
    var finalWord = isNew ? (wordEl ? wordEl.value.trim() : '') : word;
    var rom = modal.querySelector('#ve-rom').value.trim();
    var en  = modal.querySelector('#ve-en').value.trim();
    var err = modal.querySelector('#ve-err');
    if (isNew && (!finalWord || !/[가-힣]/.test(finalWord))) {
      err.textContent = 'Please enter a Korean word.'; err.style.display='block'; return;
    }
    if (!en) { err.textContent = 'Please enter an English meaning.'; err.style.display='block'; return; }
    var btn = modal.querySelector('#ve-save');
    btn.textContent = 'Saving...'; btn.disabled = true;
    try {
      await saveVocabToDB(finalWord, rom, en, false);
      VOCAB[finalWord] = { rom: rom, en: en };
      // 로컬 변수 word를 finalWord로 덮어씌워 이하 코드가 올바른 단어를 참조
      word = finalWord;

      // 기존 .kh-word tooltip 즉시 업데이트
      document.querySelectorAll('.kh-word[data-word="' + word + '"]').forEach(function(s) {
        s.title = en;
      });

      // 새 단어면 본문에 즉시 하이라이트 추가
      var alreadyWrapped = document.querySelectorAll('.kh-word[data-word="' + word + '"]').length > 0;
      if (!alreadyWrapped) {
        document.querySelectorAll('.vocab-zone').forEach(function(zone) {
          wrapSingleWord(zone, word);
        });
      }

      // KEY VOCABULARY 섹션에 즉시 추가
      _addWordToKeyVocabList(word, rom, en);

      modal.remove();
      showToast('✅ ' + word + ' saved');
    } catch(e) {
      err.textContent = 'Save failed:' + e.message;
      err.style.display = 'block';
      btn.textContent = 'Save'; btn.disabled = false;
    }
  };
}

function wrapSingleWord(el, word) {
  var esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var regex = new RegExp('(' + esc + ')', 'g');
  var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: function(n) {
      if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      var p = n.parentNode;
      while (p) {
        if (p.classList && p.classList.contains('kh-word')) return NodeFilter.FILTER_REJECT;
        p = p.parentNode;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  var nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(function(node) {
    if (!regex.test(node.nodeValue)) return;
    regex.lastIndex = 0;
    var frag = document.createDocumentFragment();
    var last = 0, m;
    while ((m = regex.exec(node.nodeValue)) !== null) {
      if (m.index > last) frag.appendChild(document.createTextNode(node.nodeValue.slice(last, m.index)));
      var span = document.createElement('span');
      span.className = 'kh-word';
      span.dataset.word = word;
      if (window._vocabEditMode) {
        span.style.outline = '1px dashed #fbbf24';
        span.style.cursor  = 'pointer';
      }
      span.textContent = m[1];
      frag.appendChild(span);
      last = m.index + m[1].length;
    }
    if (last < node.nodeValue.length) frag.appendChild(document.createTextNode(node.nodeValue.slice(last)));
    node.parentNode.replaceChild(frag, node);
  });
}

// ── XP 적립 ────────────────────────────────────────────────
var _xpConfig = null;

async function loadXPConfig() {
  if (_xpConfig) return _xpConfig;
  try {
    var sb = getSupa(); if (!sb) return null;
    var res = await sb.from('xp_config').select('action_key,xp_amount,is_active').eq('is_active', true);
    if (res.data) {
      _xpConfig = {};
      res.data.forEach(function(c){ _xpConfig[c.action_key] = c.xp_amount; });
    }
  } catch(e) {}
  return _xpConfig;
}

var _XP_ACTION_AMOUNTS = {
  article_read: 10,
  word_save: 5,
  conv_quiz_complete: 20,
  fill_complete: 5,
  daily_mission_complete: 50,
  story_read: 10,
  conversation_read: 10,
  first_journey_step: 5
};
var _COIN_ACTION_AMOUNTS = {
  article_read: 3,
  word_save: 2,
  conv_quiz_complete: 5,
  fill_complete: 2,
  daily_mission_complete: 20,   // 12 → 20 (밸런스 상향)
  story_read: 3,
  conversation_read: 3
};
var _XP_ACTION_LABELS = {
  article_read: 'Read Article',
  word_save: 'Save Word',
  conv_quiz_complete: 'Quiz Complete',
  fill_complete: 'Fill in the Blank',
  daily_mission_complete: 'Daily Mission Complete',
  story_read: 'Read Story',
  conversation_read: 'Read Conversation'
};

// ── xp_log 컬럼명 감지 (세션당 1회) ─────────────────────────────
var _xpLogAmtCol  = null;  // 'amount' | 'xp' | 'xp_gained' | 'points' | null
var _xpLogSrcCol  = null;  // 'source' | 'action' | null
var _xpLogDisabled = false;
var _xpLogTriedFallbackInsert = false;

function _isXPLogMissingColumnError(err) {
  var msg = String((err && (err.message || err.details || err.hint || err.code)) || '').toLowerCase();
  return msg.indexOf('column') >= 0 && msg.indexOf('does not exist') >= 0;
}

async function _detectXPLogCols() {
  if (_xpLogAmtCol !== null || _xpLogDisabled) return;
  var sb = getSupa();
  if (!sb) { _xpLogAmtCol = 'amount'; _xpLogSrcCol = 'source'; return; }
  try {
    var probe = await sb.from('xp_log').select('*').limit(1);
    if (probe.error) {
      _xpLogDisabled = true;
      console.warn('[xp] xp_log probe failed, disable remote xp_log writes:', probe.error);
      return;
    }
    var row = (probe.data && probe.data[0]) || null;
    if (row && typeof row === 'object') {
      var keys = Object.keys(row);
      _xpLogAmtCol = keys.indexOf('amount') >= 0 ? 'amount'
        : keys.indexOf('xp') >= 0 ? 'xp'
        : keys.indexOf('xp_gained') >= 0 ? 'xp_gained'
        : keys.indexOf('points') >= 0 ? 'points'
        : 'amount';
      _xpLogSrcCol = keys.indexOf('source') >= 0 ? 'source'
        : keys.indexOf('action') >= 0 ? 'action'
        : 'source';
    } else {
      _xpLogAmtCol = 'amount';
      _xpLogSrcCol = 'source';
    }
  } catch(e) {
    _xpLogDisabled = true;
    console.warn('[xp] xp_log probe exception, disable remote xp_log writes:', e);
    return;
  }
  console.log('[xp] xp_log cols:', _xpLogAmtCol, _xpLogSrcCol);
}

async function _insertXPLog(sb, userId, actionKey, amount, reason, contentId) {
  await _detectXPLogCols();
  if (_xpLogDisabled) return;
  var row = { user_id: userId };
  row[_xpLogAmtCol] = amount;
  row[_xpLogSrcCol] = actionKey;
  // 공통 컬럼은 있으면 삽입, 없어도 오류 안남
  try {
    var r = await sb.from('xp_log').insert(Object.assign({}, row, {
      reason: reason,
      content_id: contentId
    }));
    if (r.error) {
      // reason/content_id 컬럼 없을 수도 — 최소 행으로 재시도
      if (_isXPLogMissingColumnError(r.error)) {
        var rr = await sb.from('xp_log').insert(row);
        if (rr && rr.error) {
          if (_isXPLogMissingColumnError(rr.error)) {
            if (!_xpLogTriedFallbackInsert) {
              _xpLogTriedFallbackInsert = true;
              var fallbackRows = [
                { user_id:userId, action:actionKey, xp:amount },
                { user_id:userId, source:actionKey, xp:amount },
                { user_id:userId, action:actionKey, amount:amount },
                { user_id:userId, source:actionKey, amount:amount }
              ];
              for (var i = 0; i < fallbackRows.length; i++) {
                var fr = await sb.from('xp_log').insert(fallbackRows[i]);
                if (!fr.error) { return; }
              }
            }
            _xpLogDisabled = true;
            console.warn('[xp] xp_log schema mismatch, disable remote xp_log writes:', rr.error);
          } else {
            console.warn('[xp] log insert error:', rr.error);
          }
        }
      } else {
        console.warn('[xp] log insert error:', r.error);
      }
    } else {
      console.log('[xp] logged', actionKey, amount, 'XP (col=' + _xpLogAmtCol + ')');
    }
  } catch(e) { console.warn('[xp] log insert exception:', e); }
}

// ── XP 중복 지급 방지 ──
// 같은 날 같은 콘텐츠 → XP 0, 다른 날이어도 같은 콘텐츠 최대 2회까지만
var _XP_GRANT_LOG_KEY = 'kh_xp_grant_log';
function _checkXPDuplicate(actionKey, contentId) {
  if (!contentId) return false; // content_id 없으면 항상 지급 (퀴즈 등)
  try {
    var log = JSON.parse(localStorage.getItem(_XP_GRANT_LOG_KEY) || '{}');
    var key = actionKey + ':' + contentId;
    var entry = log[key] || { count: 0, lastDate: '' };
    var today = new Date().toISOString().slice(0, 10);
    // 같은 날 같은 콘텐츠 → 중복
    if (entry.lastDate === today) return true;
    // 다른 날이어도 2회 초과 → 중복
    if (entry.count >= 2) return true;
    return false;
  } catch(e) { return false; }
}
function _recordXPGrant(actionKey, contentId) {
  if (!contentId) return;
  try {
    var log = JSON.parse(localStorage.getItem(_XP_GRANT_LOG_KEY) || '{}');
    var key = actionKey + ':' + contentId;
    var entry = log[key] || { count: 0, lastDate: '' };
    var today = new Date().toISOString().slice(0, 10);
    entry.count = (entry.count || 0) + 1;
    entry.lastDate = today;
    log[key] = entry;
    localStorage.setItem(_XP_GRANT_LOG_KEY, JSON.stringify(log));
  } catch(e) {}
}

async function awardXP(actionKey, meta) {
  if (!supaUser) return null;
  var sb = getSupa(); if (!sb) return null;

  var amount    = _XP_ACTION_AMOUNTS[actionKey] || 10;
  var coinAmt   = _COIN_ACTION_AMOUNTS[actionKey] || 0;
  var reason    = _XP_ACTION_LABELS[actionKey] || actionKey;
  var contentId = (meta && (meta.content_id || meta.article_id)) || null;

  // 중복 체크: 같은 날 같은 콘텐츠 or 통산 2회 초과 → XP 미지급
  if (_checkXPDuplicate(actionKey, contentId)) {
    return { ok: true, xp_gained: 0, duplicate: true };
  }

  // Try RPC first
  try {
    var res = await sb.rpc('award_xp', {
      p_user_id: supaUser.id,
      p_action:  actionKey,
      p_meta:    meta || {}
    });
    if (res.data && res.data.ok) {
      if (res.data.leveled_up) {
        showToast('🎉 Level Up! Lv.' + res.data.level + ' ' + res.data.level_name);
      }
      var gained = res.data.xp_gained || amount;
      showXPToast(gained);
      var coinGained = (typeof res.data.coin_gained === 'number') ? res.data.coin_gained : coinAmt;
      if (coinGained > 0) {
        var coinBalanceAfter = res.data.coin_balance || null;
        if (coinBalanceAfter === null) {
          try {
            var cr = await sb.from('user_stats').select('coin_balance').eq('user_id', supaUser.id).maybeSingle();
            var curCoin = (cr.data && cr.data.coin_balance) || 0;
            coinBalanceAfter = curCoin + coinGained;
            await sb.from('user_stats').upsert({ user_id: supaUser.id, coin_balance: coinBalanceAfter }, { onConflict:'user_id' });
          } catch(e) {}
        }
        showCoinToast(coinGained);
        try {
          await sb.from('coin_transactions').insert({
            user_id: supaUser.id,
            tx_type: 'earn',
            amount: coinGained,
            balance_after: coinBalanceAfter,
            source: actionKey,
            memo: reason
          });
        } catch(e) {}
      }
      await _insertXPLog(sb, supaUser.id, actionKey, gained, reason, contentId);
      _recordXPGrant(actionKey, contentId);
      return res.data;
    }
  } catch(e) {}

  // Fallback: direct DB write
  try {
    await _insertXPLog(sb, supaUser.id, actionKey, amount, reason, contentId);

    // Increment xp in user_stats
    var { data: statsRow } = await sb.from('user_stats').select('xp, coin_balance').eq('user_id', supaUser.id).maybeSingle();
    var currentXP = (statsRow && statsRow.xp) || 0;
    var currentCoin = (statsRow && statsRow.coin_balance) || 0;
    await sb.from('user_stats').upsert({
      user_id: supaUser.id,
      xp: currentXP + amount,
      coin_balance: currentCoin + coinAmt
    }, { onConflict: 'user_id' });

    showXPToast(amount);
    if (coinAmt > 0) {
      showCoinToast(coinAmt);
      try {
        await sb.from('coin_transactions').insert({
          user_id: supaUser.id,
          tx_type: 'earn',
          amount: coinAmt,
          balance_after: currentCoin + coinAmt,
          source: actionKey,
          memo: reason
        });
      } catch(e) {}
    }
    _recordXPGrant(actionKey, contentId);
    return { ok: true, xp_gained: amount };
  } catch(e) {}

  return null;
}

var _xpToastTimer = null;
var _xpToastTotal = 0;
function showXPToast(xp) {
  _xpToastTotal += xp;
  clearTimeout(_xpToastTimer);
  var el = document.getElementById('xp-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'xp-toast';
    el.style.cssText = 'position:fixed;bottom:80px;right:16px;background:#0b1626;color:#7ab8f5;'
      + 'padding:8px 14px;border-radius:999px;font-size:13px;font-weight:800;'
      + 'border:1px solid rgba(122,184,245,.25);z-index:9999;'
      + 'transition:opacity .3s;pointer-events:none;font-family:inherit';
    document.body.appendChild(el);
  }
  el.textContent = '+' + _xpToastTotal + ' XP ⭐';
  el.style.opacity = '1';
  _xpToastTimer = setTimeout(function(){
    el.style.opacity = '0';
    setTimeout(function(){ _xpToastTotal = 0; }, 300);
  }, 1800);
}

var _coinToastTimer = null;
var _coinToastTotal = 0;
function showCoinToast(coin) {
  _coinToastTotal += coin;
  clearTimeout(_coinToastTimer);
  var el = document.getElementById('coin-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'coin-toast';
    el.style.cssText = 'position:fixed;bottom:124px;right:16px;background:#052e2b;color:#5eead4;'
      + 'padding:8px 14px;border-radius:999px;font-size:13px;font-weight:800;'
      + 'border:1px solid rgba(94,234,212,.3);z-index:9999;transition:opacity .3s;pointer-events:none;font-family:inherit';
    document.body.appendChild(el);
  }
  el.textContent = '+' + _coinToastTotal + '냥 🐾';
  el.style.opacity = '1';
  _coinToastTimer = setTimeout(function(){
    el.style.opacity = '0';
    setTimeout(function(){ _coinToastTotal = 0; }, 300);
  }, 1800);
}

async function saveVocabToDB(word, rom, en, isDelete) {
  var sb = getSupa();
  if (!sb) throw new Error('Supabase not connected');
  if (isDelete) {
    var res = await sb.from('vocabulary_bank').delete().eq('word_key', word);
    if (res.error) throw res.error;
  } else {
    var res = await sb.from('vocabulary_bank').upsert({
      word_key: word, word_ko: word,
      word_rom: rom || '', word_en: en || '',
      is_active: true
    }, { onConflict: 'word_key' });
    if (res.error) throw res.error;
  }
}

function wrapVocab(el) {
  var keys  = Object.keys(VOCAB).sort(function(a, b){ return b.length - a.length; });
  var regex = new RegExp('(' + keys.map(function(k){ return k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }).join('|') + ')', 'g');
  var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: function(n) {
      if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      var p = n.parentNode;
      while (p) { if (p.classList && p.classList.contains('kh-word')) return NodeFilter.FILTER_REJECT; p = p.parentNode; }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  var nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(function(node) {
    if (!regex.test(node.nodeValue)) return;
    regex.lastIndex = 0;
    var frag = document.createDocumentFragment();
    var last = 0, m;
    while ((m = regex.exec(node.nodeValue)) !== null) {
      if (m.index > last) frag.appendChild(document.createTextNode(node.nodeValue.slice(last, m.index)));
      var span = document.createElement('span');
      span.className = 'kh-word';
      span.dataset.word = m[0];
      span.textContent = m[0];
      frag.appendChild(span);
      last = regex.lastIndex;
    }
    if (last < node.nodeValue.length) frag.appendChild(document.createTextNode(node.nodeValue.slice(last)));
    node.parentNode.replaceChild(frag, node);
  });
}

// ── 헤더 / 푸터 / 사이드바 ────────────────────────────────────
function renderHeader() {
  // 폰트는 각 HTML <head>에서 async로 로드 — 여기서 동적 주입하지 않음
  // (중복 주입 시 렌더 블로킹 + 불필요한 네트워크 요청 발생)
  var page = window.location.pathname.split('/').pop() || 'index.html';
  var isHome = (page === 'index.html' || page === '');
  var currentSection = (new URLSearchParams(window.location.search)).get('s') || '';

  function isOn(base, sec) {
    if (sec && currentSection === sec) return true;
    return page === base || page.replace(/\.html$/,'') === base.replace(/\.html$/,'');
  }

  // ── Logo bar (white) ─────────────────────────────────────────
  var logoBar = '<div class="kh-header-bar">'
    + '<div class="kh-header-inner">'
    + '<button class="kh-ham" onclick="khSbOpen()" aria-label="Menu">&#9776;</button>'
    + '<a class="kh-logo" href="index.html">'
    + '<span class="kh-logo-kore">Kore</span>'
    + '<span class="kh-logo-han">Han</span>'
    + '<span class="kh-logo-news"> News</span>'
    + '</a>'
    + '<div class="kh-hright">'
    + '<span class="kh-hdate" id="date-str"></span>'
    + '<div class="kh-hsearch">' + khIcon('search', '', 'kh-ui-icon-muted kh-ui-icon-sm') + '<input type="text" placeholder="Search articles\u2026" onkeydown="if(event.key===\'Enter\')doSearch(this.value)" style="border:none;background:none;outline:none;font-size:13px;color:inherit;font-family:inherit;width:100%;"></div>'
    + '<button id="topbar-neon-toggle" class="kh-neon-toggle" type="button" aria-pressed="false" onclick="toggleKhNeon(event)">' + khIcon('zap', 'Neon OFF', 'kh-ui-icon-sm') + '</button>'
    + (isHome ? '<div class="kh-diff-ctrl" id="kh-diff-ctrl"><span class="kh-diff-dot" id="kh-diff-dot"></span><select class="kh-diff-sel" id="kh-diff-select" onchange="khSetDiff(this.value)"><option value="all">All Levels</option><option value="Starter">Seed</option><option value="Beginner">Sprout</option><option value="Intermediate">Tree</option><option value="Advanced">Forest</option></select><span class="kh-diff-arr">&#9662;</span></div>' : '')
    + '<div id="topbar-auth-menu" class="kh-auth-menu" style="display:none">'
    + '<button id="topbar-user-avatar" class="kh-avatar-btn" type="button" aria-label="Open profile menu" onclick="toggleTopbarUserMenu(event)" style="display:none"></button>'
    + '<div id="topbar-user-dropdown" class="kh-user-dropdown"></div>'
    + '</div>'
    + '<a href="#" id="topbar-signin-btn" class="kh-hbtn kh-hbtn-out" onclick="event.preventDefault();openAuthModal(\'signin\')">Sign In</a>'
    + '<a href="#" id="topbar-join-btn" class="kh-hbtn kh-hbtn-fill" onclick="event.preventDefault();openAuthModal(\'signup\')">Join Free</a>'
    + '<a href="korehan-x9f4k2m7.html" id="topbar-admin-btn" class="kh-hbtn kh-hbtn-out" style="display:none;background:rgba(231,76,60,0.15);border-color:rgba(231,76,60,0.4);">' + khIcon('settings', 'Admin', 'kh-ui-icon-sm') + '</a>'
    + '</div>'
    + '</div>'
    + '</div>';

  // ── Top nav (navy, dropdowns) ─────────────────────────────────
  var sections = getSections();
  var newsDrop = sections.map(function(s) {
    return '<a href="korehan-section.html?s=' + encodeURIComponent(s.key) + '" class="tn-drop-item">' + s.label + '</a>';
  }).join('');

  var topnav = '<div class="kh-topnav">'
    + '<div class="kh-topnav-inner">'
    + '<a href="index.html" class="tn-item' + (isOn('index.html') ? ' on' : '') + '">' + khIcon('home', 'Home', 'kh-ui-icon-sm') + '</a>'
    + '<div class="tn-item has-drop' + (page.indexOf('korehan-section') >= 0 ? ' on' : '') + '">'
    + khIcon('newspaper', 'News', 'kh-ui-icon-sm') + ' <span class="tn-arr">&#9660;</span>'
    + '<div class="tn-drop">'
    + '<div class="tn-drop-label">Category</div>'
    + '<a href="korehan-all.html" class="tn-drop-item">All News</a>'
    + newsDrop
    + '</div>'
    + '</div>'
    + '<div class="tn-item has-drop' + (isOn('korehan-conversations') ? ' on' : '') + '">'
    + khIcon('messages-square', 'Conversations', 'kh-ui-icon-sm') + ' <span class="tn-arr" style="margin-left:3px">&#9660;</span>'
    + '<div class="tn-drop">'
    + '<div class="tn-drop-label">Category</div>'
    + '<a href="korehan-conversations.html" class="tn-drop-item">All</a>'
    + '<a href="korehan-conversations.html?cat=everyday" class="tn-drop-item">Everyday</a>'
    + '<a href="korehan-conversations.html?cat=work" class="tn-drop-item">Workplace</a>'
    + '<a href="korehan-conversations.html?cat=friends" class="tn-drop-item">Friends</a>'
    + '<a href="korehan-conversations.html?cat=family" class="tn-drop-item">Family</a>'
    + '<a href="korehan-conversations.html?cat=dating" class="tn-drop-item">Dating</a>'
    + '</div>'
    + '</div>'
    + '<div class="tn-item has-drop' + (isOn('korehan-stories') ? ' on' : '') + '">'
    + khIcon('book-open', 'Stories', 'kh-ui-icon-sm') + ' <span class="tn-arr" style="margin-left:3px">&#9660;</span>'
    + '<div class="tn-drop">'
    + '<div class="tn-drop-label">Mood</div>'
    + '<a href="korehan-stories.html" class="tn-drop-item">All Stories</a>'
    + '<a href="korehan-stories.html?mood=fun" class="tn-drop-item">' + khIcon('sparkles', 'Fun', 'kh-ui-icon-sm') + '</a>'
    + '<a href="korehan-stories.html?mood=touching" class="tn-drop-item">' + khIcon('heart', 'Touching', 'kh-ui-icon-sm') + '</a>'
    + '<a href="korehan-stories.html?mood=scary" class="tn-drop-item">' + khIcon('zap', 'Scary', 'kh-ui-icon-sm') + '</a>'
    + '<a href="korehan-stories.html?mood=shocking" class="tn-drop-item">' + khIcon('flame', 'Shocking', 'kh-ui-icon-sm') + '</a>'
    + '</div>'
    + '</div>'
    + '<a href="korehan-study-room.html" class="tn-item' + (isOn('korehan-study-room') ? ' on' : '') + '">' + khIcon('notebook-pen', 'Study Room', 'kh-ui-icon-sm') + '</a>'
    + '<a href="korehan-shop.html" class="tn-item' + (isOn('korehan-shop') ? ' on' : '') + '">' + khIcon('shopping-bag', 'Shop', 'kh-ui-icon-sm') + '</a>'
    + '<a href="korehan-fun.html" class="tn-item' + (isOn('korehan-fun') ? ' on' : '') + '">' + khIcon('gamepad-2', 'Playground', 'kh-ui-icon-sm') + '</a>'
    + '<a href="korehan-learning-overview.html" class="tn-item' + (isOn('korehan-learning-overview') ? ' on' : '') + '">' + khIcon('chart-column', 'Growth Lab', 'kh-ui-icon-sm') + '</a>'
    + '<a href="korehan-courses.html" class="tn-item' + (isOn('korehan-courses') ? ' on' : '') + '">' + khIcon('graduation-cap', 'Courses', 'kh-ui-icon-sm') + '</a>'
    + '</div>'
    + '</div>';

  // ── Breaking ticker ───────────────────────────────────────────
  var ticker = (function() {
    var arts = getCachedArticles().filter(function(a){ return a.status === 'published'; });
    if (!arts.length) return '';
    var html = arts.slice(0,6).map(function(a){
      return '<span class="brk-item"><span class="brk-sep">&middot;</span><a href="korehan-article.html?id=' + a.id + '" style="color:#fff;text-decoration:none;">' + (a.title_ko || a.title || '') + '</a></span>';
    }).join('');
    return '<div class="kh-breaking brk-bar">'
      + '<div class="brk-label"><span class="brk-badge">&#9889;</span>&nbsp;BREAKING</div>'
      + '<div class="brk-track-wrap"><div class="brk-track">' + html + html + '</div></div>'
      + '</div>';
  })();

  return logoBar + topnav + ticker;
}


function renderFooter() {
  var cfg = getSiteConfig();
  var siteName = cfg.siteName || DEFAULT_SITE_CONFIG.siteName;
  return '<footer class="kh-foot">'
    + '<div class="kh-foot-inner">'

    + '<div>'
    + '<div style="font-family:\'Playfair Display\',serif;font-size:22px;font-weight:900;color:#fff;margin-bottom:10px">'
    + '<span style="color:rgba(255,255,255,.85)">Kore</span><span style="color:#7dd3fc">Han</span><span style="color:rgba(255,255,255,.7)"> News</span>'
    + '</div>'
    + '<p style="font-size:13px;line-height:1.7;color:rgba(255,255,255,.55);margin:0 0 16px;max-width:28ch">Learn Korean naturally through real news, stories, and conversations.</p>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    + '<a href="korehan-all.html" style="font-size:11px;font-weight:800;padding:5px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.6);text-decoration:none">News</a>'
    + '<a href="korehan-conversations.html" style="font-size:11px;font-weight:800;padding:5px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.6);text-decoration:none">Conversations</a>'
    + '<a href="korehan-stories.html" style="font-size:11px;font-weight:800;padding:5px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.6);text-decoration:none">Stories</a>'
    + '<a href="korehan-shop.html" style="font-size:11px;font-weight:800;padding:5px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.6);text-decoration:none">Shop</a>'
    + '<a href="korehan-fun.html" style="font-size:11px;font-weight:800;padding:5px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.6);text-decoration:none">Playground</a>'
    + '</div>'
    + '</div>'

    + '<div>'
    + '<div style="font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.38);margin-bottom:14px">Learn</div>'
    + '<div style="display:flex;flex-direction:column;gap:9px">'
    + '<a href="korehan-study-room.html" style="font-size:13px;color:rgba(255,255,255,.68);text-decoration:none;font-weight:600">Study Room</a>'
    + '<a href="korehan-learning-overview.html" style="font-size:13px;color:rgba(255,255,255,.68);text-decoration:none;font-weight:600">Growth Lab</a>'
    + '<a href="korehan-learn.html" style="font-size:13px;color:rgba(255,255,255,.68);text-decoration:none;font-weight:600">Vocab Drill</a>'
    + '<a href="korehan-courses.html" style="font-size:13px;color:rgba(255,255,255,.68);text-decoration:none;font-weight:600">Courses</a>'
    + '<a href="beginner-guide.html" style="font-size:13px;color:rgba(255,255,255,.68);text-decoration:none;font-weight:600">Beginner Guide</a>'
    + '</div>'
    + '</div>'

    + '<div>'
    + '<div style="font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.38);margin-bottom:14px">Company</div>'
    + '<div style="display:flex;flex-direction:column;gap:9px">'
    + '<a href="landing.html" style="font-size:13px;color:rgba(255,255,255,.68);text-decoration:none;font-weight:600">About KoreHan News</a>'
    + '<a href="mailto:hello@korehannews.com" style="font-size:13px;color:rgba(255,255,255,.68);text-decoration:none;font-weight:600">Contact</a>'
    + '</div>'
    + '</div>'

    + '<div>'
    + '<div style="font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.38);margin-bottom:14px">Legal</div>'
    + '<div style="display:flex;flex-direction:column;gap:9px">'
    + '<a href="privacy-policy" style="font-size:13px;color:rgba(255,255,255,.68);text-decoration:none;font-weight:600">Privacy Policy</a>'
    + '<a href="terms-of-service" style="font-size:13px;color:rgba(255,255,255,.68);text-decoration:none;font-weight:600">Terms of Service</a>'
    + '</div>'
    + '</div>'

    + '</div>'
    + '<div style="border-top:1px solid rgba(255,255,255,.07);padding:16px 22px;text-align:center;font-size:12px;color:rgba(255,255,255,.28);">'
    + '© 2026 KoreHan News · All rights reserved'
    + '</div>'
    + '</footer>';
}

function renderSharedSidebar() {
  var trendingHTML = getFallbackMostReadItems().map(function(item, i){
    return '<a href="' + item.href + '" style="color:inherit;text-decoration:none;">'
      + '<div class="trending-item">'
      + '<div class="trending-num">' + (i+1) + '</div>'
      + '<p class="vocab-zone">' + item.title + '</p>'
      + '</div></a>';
  }).join('');

  // Word Bank - VOCAB에서 랜덤 6개
  var vocabKeys = Object.keys(VOCAB);
  var seed = Math.floor(Date.now() / 60000);
  var shuffled = vocabKeys.slice().sort(function(a,b){
    return Math.sin(seed * a.charCodeAt(0)) - Math.sin(seed * b.charCodeAt(0));
  });
  var wbWords = shuffled.slice(0, 6).map(function(k){
    return { ko: k, rom: VOCAB[k].rom, en: VOCAB[k].en };
  });

  return '<div class="sidebar">'
    + '<div class="sidebar-box">'
    + '<div class="box-title">' + khIcon('flame', 'Most Read', 'kh-ui-icon-sm') + '</div>'
    + '<div id="kh-most-read-list">' + trendingHTML + '</div>'
    + '</div>'

    // ── Live Korea Weather ────────────────────────────────────
    + '<div class="sidebar-box kh-weather-box" id="kh-weather-box">'
    + '<div class="box-title">' + khIcon('cloud-sun', 'Korea Weather', 'kh-ui-icon-sm') + '<span id="kh-kst-time" class="kh-kst-time"></span></div>'
    + '<div id="kh-weather-content" class="kh-weather-loading">'
    + '<div class="kh-weather-spinner"></div>'
    + '</div>'
    + '</div>'

    // ── Word Bank ────────────────────────────────────────────
    + '<div class="sidebar-box">'
    + '<div class="box-title">' + khIcon('book-marked', 'Word Bank', 'kh-ui-icon-sm') + '<span style="margin-left:auto;font-size:10px;font-weight:500;color:var(--gray);text-transform:none;letter-spacing:0">Click to save</span></div>'
    + wbWords.map(function(w){
        return '<div class="kh-wb-row" id="kh-wb-' + encodeURIComponent(w.ko) + '" onclick="khSaveWbWord(this,\'' + w.ko.replace(/'/g,"\\'") + '\',\'' + (w.rom||'').replace(/'/g,"\\'") + '\',\'' + (w.en||'').replace(/'/g,"\\'") + '\')">'
          + '<div class="kh-wb-left">'
          + '<span class="kh-wb-ko">' + w.ko + '</span>'
          + '<span class="kh-wb-rom">' + (w.rom || '') + '</span>'
          + '</div>'
          + '<div class="kh-wb-right">'
          + '<span class="kh-wb-en">' + (w.en || '') + '</span>'
          + '<span class="kh-wb-save-icon">'
          + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>'
          + '</span>'
          + '</div>'
          + '</div>';
      }).join('')
    + '</div>'

    + '<div class="sidebar-box">'
    + '<a href="korehan-learn.html" style="text-decoration:none;display:block;background:linear-gradient(135deg,#0b1626,#1a3a6b);border-radius:8px;padding:16px;color:#fff;text-align:center">'
    + '<div style="display:flex;justify-content:center;margin-bottom:8px">' + khIcon('languages', '', 'kh-ui-icon-lg') + '</div>'
    + '<div style="font-weight:700;font-size:14px;margin-bottom:4px">Learn Korean</div>'
    + '<div style="font-size:12px;color:rgba(255,255,255,0.6)">Flashcards · Quiz · Sentences</div>'
    + '</a></div>'
    + '</div>';
}

// ── Word Bank: click to save ─────────────────────────────────
async function khSaveWbWord(rowEl, ko, rom, en) {
  if (!rowEl || rowEl.classList.contains('saved')) return;
  // Optimistic UI
  rowEl.classList.add('saving');
  var icon = rowEl.querySelector('.kh-wb-save-icon');
  if (icon) icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  try {
    var sb = getSupa();
    var user = supaUser;
    if (!sb || !user) {
      // Not logged in — show brief prompt
      rowEl.classList.remove('saving');
      rowEl.classList.add('save-fail');
      if (icon) icon.title = 'Sign in to save words';
      setTimeout(function(){ rowEl.classList.remove('save-fail'); }, 1800);
      return;
    }
    if (typeof saveWord === 'function') {
      await saveWord(sb, { wordKey: ko, wordKo: ko, wordRom: rom, wordEn: en, sourceKind: 'manual' });
    } else {
      await sb.rpc('save_or_update_word', {
        p_word_key: ko, p_word_ko: ko, p_word_rom: rom || null, p_word_en: en || null,
        p_source_kind: 'manual', p_source_content_type: null, p_source_content_id: null,
        p_interest_tag: null, p_review_delta: 0, p_correct_delta: 0, p_wrong_delta: 0
      });
    }
    // Update in-memory set + localStorage + 카운터/XP 증가
    if (_savedWordsSet) _savedWordsSet.add(ko);
    var wbSaved = lsGet(K_SAVED, []);
    var wbAlready = !!wbSaved.find(function(w){ return w.ko === ko; });
    if (!wbAlready) {
      wbSaved.push({ ko: ko, rom: rom, en: en });
      lsSet(K_SAVED, wbSaved);
      if (typeof trackActivityOnWordSave === 'function') trackActivityOnWordSave();
    }
    rowEl.classList.remove('saving');
    rowEl.classList.add('saved');
  } catch(e) {
    rowEl.classList.remove('saving');
    rowEl.classList.add('save-fail');
    if (icon) {
      icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';
    }
    setTimeout(function(){ rowEl.classList.remove('save-fail'); }, 1800);
  }
}

// ── Korea Live Weather ───────────────────────────────────────
var _khWeatherCache = null;
var _khWeatherFetchTime = 0;

var KH_WEATHER_CITIES = [
  { id: 'Seoul',   label: 'Seoul',   ko: '서울' },
  { id: 'Busan',   label: 'Busan',   ko: '부산' },
  { id: 'Incheon', label: 'Incheon', ko: '인천' },
  { id: 'Jeju',    label: 'Jeju',    ko: '제주' }
];

var KH_WMO_ICONS = {
  0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',
  51:'🌦️',53:'🌦️',55:'🌧️',56:'🌧️',57:'🌧️',
  61:'🌧️',63:'🌧️',65:'🌧️',66:'🌨️',67:'🌨️',
  71:'🌨️',73:'❄️',75:'❄️',77:'🌨️',
  80:'🌦️',81:'🌧️',82:'⛈️',85:'🌨️',86:'❄️',
  95:'⛈️',96:'⛈️',99:'⛈️'
};

function khKstTime() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}

function khStartKstClock() {
  var el = document.getElementById('kh-kst-time');
  if (!el) return;
  function tick() {
    var t = khKstTime();
    var h = t.getHours(), m = t.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    el.textContent = h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm + ' KST';
  }
  tick();
  setInterval(tick, 30000);
}

async function khFetchWeather() {
  var now = Date.now();
  if (_khWeatherCache && now - _khWeatherFetchTime < 600000) return _khWeatherCache;

  // Open-Meteo: free, no API key, CORS-friendly
  var coords = {
    Seoul:   { lat: 37.5665, lon: 126.9780 },
    Busan:   { lat: 35.1796, lon: 129.0756 },
    Incheon: { lat: 37.4563, lon: 126.7052 },
    Jeju:    { lat: 33.4996, lon: 126.5312 }
  };
  var results = {};
  try {
    var entries = Object.keys(coords);
    var fetches = entries.map(function(city) {
      var c = coords[city];
      return fetch('https://api.open-meteo.com/v1/forecast?latitude=' + c.lat + '&longitude=' + c.lon
        + '&current=temperature_2m,weathercode,windspeed_10m&temperature_unit=celsius&windspeed_unit=kmh&forecast_days=1')
        .then(function(r){ return r.json(); })
        .then(function(d){
          results[city] = {
            temp: Math.round(d.current.temperature_2m),
            code: d.current.weathercode,
            wind: Math.round(d.current.windspeed_10m)
          };
        })
        .catch(function(){ results[city] = null; });
    });
    await Promise.all(fetches);
    _khWeatherCache = results;
    _khWeatherFetchTime = now;
    return results;
  } catch(e) {
    return null;
  }
}

function khWeatherConditionLabel(code) {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 48) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  return 'Thunderstorm';
}

async function khHydrateWeather() {
  khStartKstClock();
  var box = document.getElementById('kh-weather-content');
  if (!box) return;
  try {
    var data = await khFetchWeather();
    if (!data) throw new Error('no data');
    box.className = '';
    box.innerHTML = KH_WEATHER_CITIES.map(function(city, i) {
      var w = data[city.id];
      var icon = w ? (KH_WMO_ICONS[w.code] || '🌡️') : '–';
      var temp = w ? w.temp + '°C' : '–';
      var cond = w ? khWeatherConditionLabel(w.code) : '';
      var isLast = i === KH_WEATHER_CITIES.length - 1;
      return '<div class="kh-weather-row' + (isLast ? ' last' : '') + '">'
        + '<span class="kh-weather-city"><span class="kh-weather-city-en">' + city.label + '</span><span class="kh-weather-city-ko">' + city.ko + '</span></span>'
        + '<span class="kh-weather-right"><span class="kh-weather-icon">' + icon + '</span><span class="kh-weather-temp">' + temp + '</span><span class="kh-weather-cond">' + cond + '</span></span>'
        + '</div>';
    }).join('');
  } catch(e) {
    box.className = '';
    box.innerHTML = '<div style="font-size:12px;color:var(--gray);padding:8px 0">Weather data unavailable</div>';
  }
}

var _mostReadSidebarCache = null;

function getFallbackMostReadItems() {
  return published().slice(0, 5).map(function(a) {
    return {
      type: 'article',
      id: a.id,
      title: a.title || a.title_ko || 'Untitled article',
      href: articleUrl(a.id),
      score: 0
    };
  });
}

function mostReadHref(type, id) {
  if (type === 'conversation') return 'korehan-conversations.html?id=' + encodeURIComponent(id);
  if (type === 'story') return 'korehan-stories.html?id=' + encodeURIComponent(id);
  return articleUrl(id);
}

function renderMostReadList(items) {
  return (items || []).slice(0, 5).map(function(item, i){
    return '<a href="' + item.href + '" style="color:inherit;text-decoration:none;">'
      + '<div class="trending-item">'
      + '<div class="trending-num">' + (i + 1) + '</div>'
      + '<p class="vocab-zone">' + escapeHtml(item.title || 'Untitled') + '</p>'
      + '</div></a>';
  }).join('');
}

async function fetchMostReadItems() {
  if (_mostReadSidebarCache && _mostReadSidebarCache.length) return _mostReadSidebarCache;
  var fallback = getFallbackMostReadItems();
  var sb = getSupa();
  if (!sb) return fallback;

  try {
    var viewsRes = await sb.from('article_views')
      .select('article_id,title,view_count')
      .order('view_count', { ascending: false })
      .limit(30);
    var ranked = (viewsRes.data || []).slice(0, 5).map(function(row) {
      return {
        title: row.title || 'Untitled',
        href: articleUrl(row.article_id)
      };
    });
    _mostReadSidebarCache = ranked.length ? ranked : fallback;
    return _mostReadSidebarCache;
  } catch(e) {
    return fallback;
  }
}

async function hydrateMostReadSidebar() {
  var el = document.getElementById('kh-most-read-list');
  if (!el) return;
  var items = await fetchMostReadItems();
  el.innerHTML = renderMostReadList(items);
}

// ── 시계 ──────────────────────────────────────────────────────
function startClock() {
  var days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  function tick() {
    var now    = new Date();
    var dateEl = document.getElementById('date-str');
    var clockEl= document.getElementById('clock');
    if (dateEl) dateEl.textContent = days[now.getDay()] + ', ' + months[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear() + ' ';
    if (clockEl) clockEl.textContent = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0') + ':' + String(now.getSeconds()).padStart(2,'0');
  }
  tick(); setInterval(tick, 1000);
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

// ── 앱 설정 (API 키 등 어드민 전역 설정) ──────────────────────────────────
var _appSettings = {};
var _appSettingsPromise = null;
var DEFAULT_SITE_CONFIG = {
  siteName: 'KoreHan News',
  siteTagline: 'Learn Korean, Naturally',
  footerDesc: 'KoreHan News delivers real Korean news — paired with vocabulary tooltips so you learn Korean naturally through stories that matter.',
  learnBannerTitle: 'Simplified Korean news for learners',
  learnBannerDesc: 'KoreHan News is written in easy Korean for foreign learners. Hover any underlined word to instantly see its meaning and pronunciation.'
};

function getSiteConfig() {
  var raw = _appSettings.site_config || null;
  if (raw && typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch(e) { raw = null; }
  }
  if (!raw || typeof raw !== 'object') raw = {};
  return Object.assign({}, DEFAULT_SITE_CONFIG, raw);
}

function applySiteConfigToPage() {
  var cfg = getSiteConfig();
  var titleEl = document.querySelector('.learn-banner .lb-left h2');
  var descEl = document.querySelector('.learn-banner .lb-left p');
  if (titleEl) titleEl.textContent = cfg.learnBannerTitle || DEFAULT_SITE_CONFIG.learnBannerTitle;
  if (descEl) descEl.textContent = cfg.learnBannerDesc || DEFAULT_SITE_CONFIG.learnBannerDesc;
}

async function loadAppSettings() {
  if (_appSettingsPromise) return _appSettingsPromise;
  _appSettingsPromise = (async function() {
    var sb = getSupa();
    if (!sb) return;
    try {
      // API 키는 로그인한 유저만 읽을 수 있음 (RLS로 보호)
      var res = await sb.from('app_settings').select('key,value');
      if (res.data) {
        res.data.forEach(function(row) {
          _appSettings[row.key] = row.value;
        });
        // API 키는 localStorage에 저장하지 않음 (보안)
      }
    } catch(e) {}
  })();
  return _appSettingsPromise;
}

function getApiKey() {
  // 메모리에서만 — localStorage 캐시 없음
  return _appSettings.anthropic_key || null;
}

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
  var _ldr = window._khLoaderSet || function(){};
  _ldr(20); // Scripts loaded
  initKhNeonTheme();
  markShellReady();
  var headerEl  = document.getElementById('kh-header');
  var footerEl  = document.getElementById('kh-footer');
  var sidebarEl = document.getElementById('kh-sidebar');

  if (headerEl)  headerEl.innerHTML  = renderHeader();
  _ldr(35); // Header rendered
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

  // Pages that need article data
  var needsArticles = isHomePage
    || pageBase === 'korehan-all'
    || pageBase === 'korehan-section'
    || pageBase === 'korehan-korea'
    || pageBase === 'korehan-society'
    || pageBase === 'korehan-world'
    || pageBase === 'korehan-culture'
    || pageBase === 'korehan-opinion'
    || pageBase === 'korehan-article';

  // 카드 리스트 페이지 — 자체 localStorage 캐시로 이미 렌더 완료
  // sections/settings/session을 await하지 않고 백그라운드 처리
  var _fastPages = ['korehan-conversations','korehan-stories','korehan-mypage','korehan-shop'];
  var _isFastPage = _fastPages.indexOf(pageBase) >= 0;

  if (_isFastPage) {
    // 네트워크 차단 없이 즉시 footer 렌더 → 백그라운드에서 세션/설정 완료 후 UI 갱신
    if (window._khLoaderClearAuto) window._khLoaderClearAuto();
    _ldr(100);
    if (footerEl) footerEl.innerHTML = renderFooter();
    renderKhLucideIcons();
    applySiteConfigToPage();
    // 백그라운드: 세션/설정 완료 후 헤더/푸터 갱신
    Promise.allSettled([sessionPromise, sectionsPromise, settingsPromise]).then(function() {
      if (headerEl) { headerEl.innerHTML = renderHeader(); khInjectSidebar(); }
      if (footerEl) footerEl.innerHTML = renderFooter();
      renderKhLucideIcons();
      updateAuthUI();
      if (supaUser) {
        _appSettingsPromise = null;
        loadAppSettings().catch(function(){});
        window.dispatchEvent(new Event('kh-settings-reloaded'));
      }
    });
  } else if (isHomePage) {
    // 캐시 있으면 즉시 렌더 (재방문 시 즉시 화면 표시)
    if (getCachedArticles().length) {
      renderHomePage();
      _ldr(80); // Cached articles rendered
    }
    _ldr(50); // Loading articles...
    // 기사 데이터만 await — sections/settings는 헤더에 필요하지만 기본값으로 이미 렌더됨
    await loadArticlesFromDB({ homeOptimized: true, force: true });
    _ldr(85); // Articles loaded
    renderHomePage();
    if (window._khLoaderClearAuto) window._khLoaderClearAuto();
    _ldr(100); // Done

    // 나머지는 백그라운드에서 완료 후 UI 갱신 (세션, 섹션, 설정)
    if (footerEl) footerEl.innerHTML = renderFooter();
    renderKhLucideIcons();
    applySiteConfigToPage();

    Promise.allSettled([sessionPromise, sectionsPromise, settingsPromise]).then(function() {
      if (headerEl) { headerEl.innerHTML = renderHeader(); khInjectSidebar(); }
      if (footerEl) footerEl.innerHTML = renderFooter();
      renderKhLucideIcons();
      updateAuthUI();
      var _hamBtn = headerEl && headerEl.querySelector('.kh-ham');
      if (_hamBtn) {
        _hamBtn.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); khSbOpen(); });
        _hamBtn.addEventListener('touchend', function(e) { e.preventDefault(); khSbOpen(); });
      }
      if (supaUser) {
        _appSettingsPromise = null;
        _artCacheSchemaDone = false;
        _artCacheSchema = null;
        _remoteCacheDisabled = false;
        loadAppSettings().catch(function(err){ console.warn('post-auth settings reload failed', err); });
        window.dispatchEvent(new Event('kh-settings-reloaded'));
      }
    });
  } else if (needsArticles) {
    _ldr(50);
    await Promise.all([loadArticlesFromDB({ force: true }), sectionsPromise, settingsPromise]);
    if (window._khLoaderClearAuto) window._khLoaderClearAuto();
    _ldr(100);

    if (footerEl) footerEl.innerHTML = renderFooter();
    renderKhLucideIcons();
    applySiteConfigToPage();

    // 세션/재인증은 백그라운드 — 기사 렌더 차단하지 않음
    Promise.allSettled([sessionPromise]).then(function() {
      updateAuthUI();
      if (supaUser) {
        _appSettingsPromise = null;
        _artCacheSchemaDone = false;
        _artCacheSchema = null;
        _remoteCacheDisabled = false;
        loadAppSettings().catch(function(err){ console.warn('post-auth settings reload failed', err); });
        window.dispatchEvent(new Event('kh-settings-reloaded'));
      }
    });
  } else {
    // Non-article pages (mypage, learn, etc.)
    await Promise.all([sectionsPromise, settingsPromise]);
    if (window._khLoaderClearAuto) window._khLoaderClearAuto();
    _ldr(100);

    if (footerEl) footerEl.innerHTML = renderFooter();
    renderKhLucideIcons();
    applySiteConfigToPage();

    // 세션 완료 후 인증 UI 갱신 — 백그라운드
    Promise.allSettled([sessionPromise]).then(function() {
      updateAuthUI();
      if (supaUser) {
        _appSettingsPromise = null;
        _artCacheSchemaDone = false;
        _artCacheSchema = null;
        _remoteCacheDisabled = false;
        loadAppSettings().catch(function(err){ console.warn('post-auth settings reload failed', err); });
        window.dispatchEvent(new Event('kh-settings-reloaded'));
      }
    });
  }

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
  // conversations/stories 등 tooltip 불필요 페이지에서는 2000행 vocabulary_bank 쿼리 스킵
  var _skipVocabPages = ['index','','korehan-news','korehan-conversations','korehan-stories','korehan-mypage','korehan-learn','korehan-courses','korehan-onboarding','korehan-learning-overview'];
  if (_skipVocabPages.indexOf(pageBase) < 0) {
    _deferPost(function(){ loadVocabFromDB().then(function(){ initTooltips(); }); });
  } else {
    _deferPost(function(){ initTooltips(); });
  }
});

// ── vocabulary_bank DB → VOCAB 병합 ───────────────────────
// 하드코딩 VOCAB에 DB 단어를 덮어쓰기 (DB 우선)
// ── 온보딩 체크 ────────────────────────────────────────────
var _onboardingChecked = false;
function getOnboardingStorageKey(name, userId) {
  return 'kh_onboarding_' + name + (userId ? '_' + userId : '');
}
function getWelcomeTipStorageKey(userId) {
  return 'kh_new_user_tip' + (userId ? '_' + userId : '');
}
function hasCompletedOnboardingLocal(userId) {
  try {
    return localStorage.getItem(getOnboardingStorageKey('completed', userId)) === '1';
  } catch(e) {
    return false;
  }
}
function markCompletedOnboardingLocal(userId, onboardedAt) {
  try {
    localStorage.setItem(getOnboardingStorageKey('completed', userId), '1');
    if (onboardedAt) localStorage.setItem(getOnboardingStorageKey('completed_at', userId), onboardedAt);
  } catch(e) {}
}
async function checkOnboardingStatus() {
  if (_onboardingChecked || !supaUser) return;
  if (window.location.pathname.includes('onboarding')) return;
  _onboardingChecked = true;
  try {
    // Check both keyed and un-keyed localStorage (handles edge cases)
    if (hasCompletedOnboardingLocal(supaUser.id)) return;
    if (hasCompletedOnboardingLocal('')) return;
    var sb = getSupa(); if (!sb) return;
    var res = await sb.from('user_stats')
      .select('onboarded, onboarded_at, created_at')
      .eq('user_id', supaUser.id)
      .maybeSingle();

    if (res.data && res.data.onboarded === true) {
      markCompletedOnboardingLocal(supaUser.id, res.data.onboarded_at || '');
      return;
    }

    // Only redirect new accounts (created within 30 min) that haven't onboarded
    var createdAt = supaUser.created_at ? new Date(supaUser.created_at) : null;
    var isNew = createdAt && (Date.now() - createdAt.getTime() < 30 * 60 * 1000);
    if (isNew && res.data && res.data.onboarded === false) {
      setTimeout(function() {
        window.location.href = 'korehan-onboarding.html';
      }, 600);
    } else if (isNew && !res.data) {
      // No user_stats row yet — new signup
      setTimeout(function() {
        window.location.href = 'korehan-onboarding.html';
      }, 600);
    }
  } catch(e) {}
}

async function loadVocabFromDB() {
  try {
    var sb = getSupa(); if (!sb) { initTooltips(); return; }
    var res = await sb.from('vocabulary_bank')
      .select('word_ko,word_rom,word_en')
      .eq('is_active', true)
      .limit(2000);
    if (res.data && res.data.length) {
      res.data.forEach(function(row) {
        if (row.word_ko && row.word_en) {
          VOCAB[row.word_ko] = { rom: row.word_rom || '', en: row.word_en };
        }
      });
    }
  } catch(e) {}
}

// ══ BADGE ENGINE ══════════════════════════════════════════════════════════════
// 뱃지 정의 + 체크 + 알림 시스템
// 모든 뱃지는 id, cat, tier, icon, name, desc, check(stats) 구조

var K_BADGES = 'kh_earned_badges'; // { badgeId: { earnedAt: ISO } }
var K_XP     = 'kh_xp';           // number
var K_READ_SECTIONS = 'kh_read_sections'; // { sectionName: count }
var ARTICLE_XP_DAILY_CAP = 6;

// XP 획득량 정의
var XP_TABLE = {
  article_read:  10,
  word_saved:     5,
  quiz_complete: 20,
  quiz_perfect:  30,
  streak_day:     3
};

function getXP()      { return lsGet(K_XP, 0); }
function addXP(amt)   {
  var cur = getXP();
  lsSet(K_XP, cur + amt);
  checkBadges('xp', { xp: cur + amt });
}

// ── 헬퍼 ───────────────────────────────────────────────────────────────────
function getEarnedBadges() { return lsGet(K_BADGES, {}); }

function getTotalArticlesRead() {
  var log = lsGet('kh_read_log', {});
  var ids = new Set();
  Object.values(log).forEach(function(arr){ arr.forEach(function(id){ ids.add(id); }); });
  return ids.size;
}

function getCurrentStreak() {
  var log = lsGet('kh_study_log', {});
  var days = lsGet('kh_study_days', {});
  var allDays = Object.assign({}, days);
  Object.keys(log).forEach(function(k){
    var d = log[k];
    if ((d.articles||0) + (d.words||0) + (d.quiz||0) > 0) allDays[k] = true;
  });
  var streak = 0;
  var d = new Date();
  for (var i = 0; i < 400; i++) {
    var key = d.toISOString().slice(0,10);
    if (allDays[key]) { streak++; d.setDate(d.getDate()-1); }
    else if (i === 0) { d.setDate(d.getDate()-1); } // 오늘 아직 안 했어도 어제부터
    else break;
  }
  return Math.max(streak, lsGet('kh_synced_activity_streak', 0));
}

function getSectionReadCounts() {
  // Supabase 없으면 localStorage 기반으로 섹션별 카운트
  return lsGet(K_READ_SECTIONS, {});
}

function getLastQuizPct() { return lsGet('kh_last_quiz_pct', 0); }
function getQuizPerfectCount() { return lsGet('kh_quiz_perfect_count', 0); }
function getQuizStreakDays() { return lsGet('kh_quiz_streak_days', 0); }

// ── 뱃지 정의 목록 ──────────────────────────────────────────────────────────
// Custom colored pixel-art badge icons (inline SVG, 16x16 grid)
var _PX = {
  // 🔥 fire — orange/red flame
  fire: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="7" y="1" width="2" height="1" fill="#ff6b2b"/><rect x="6" y="2" width="4" height="1" fill="#ff6b2b"/><rect x="5" y="3" width="2" height="1" fill="#ff6b2b"/><rect x="7" y="3" width="2" height="1" fill="#ffb020"/><rect x="9" y="3" width="2" height="1" fill="#ff6b2b"/><rect x="4" y="4" width="2" height="1" fill="#ff4500"/><rect x="6" y="4" width="4" height="1" fill="#ffb020"/><rect x="10" y="4" width="2" height="1" fill="#ff4500"/><rect x="4" y="5" width="2" height="1" fill="#ff4500"/><rect x="6" y="5" width="1" height="1" fill="#ffb020"/><rect x="7" y="5" width="2" height="1" fill="#ffd700"/><rect x="9" y="5" width="1" height="1" fill="#ffb020"/><rect x="10" y="5" width="2" height="1" fill="#ff4500"/><rect x="3" y="6" width="2" height="1" fill="#e03000"/><rect x="5" y="6" width="1" height="1" fill="#ff4500"/><rect x="6" y="6" width="4" height="1" fill="#ffd700"/><rect x="10" y="6" width="1" height="1" fill="#ff4500"/><rect x="11" y="6" width="2" height="1" fill="#e03000"/><rect x="3" y="7" width="2" height="2" fill="#e03000"/><rect x="5" y="7" width="1" height="2" fill="#ff4500"/><rect x="6" y="7" width="4" height="2" fill="#ffd700"/><rect x="10" y="7" width="1" height="2" fill="#ff4500"/><rect x="11" y="7" width="2" height="2" fill="#e03000"/><rect x="4" y="9" width="8" height="1" fill="#ff4500"/><rect x="4" y="10" width="2" height="1" fill="#e03000"/><rect x="6" y="10" width="4" height="1" fill="#ff6b2b"/><rect x="10" y="10" width="2" height="1" fill="#e03000"/><rect x="5" y="11" width="6" height="1" fill="#e03000"/><rect x="6" y="12" width="4" height="1" fill="#c02000"/></svg>',
  // 🏆 trophy — golden trophy
  trophy: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="4" y="2" width="8" height="1" fill="#ffd700"/><rect x="3" y="3" width="10" height="1" fill="#ffd700"/><rect x="2" y="4" width="1" height="3" fill="#daa520"/><rect x="3" y="4" width="1" height="3" fill="#ffd700"/><rect x="4" y="4" width="8" height="1" fill="#ffed4a"/><rect x="12" y="4" width="1" height="3" fill="#ffd700"/><rect x="13" y="4" width="1" height="3" fill="#daa520"/><rect x="4" y="5" width="8" height="2" fill="#ffd700"/><rect x="6" y="5" width="4" height="2" fill="#ffed4a"/><rect x="3" y="7" width="10" height="1" fill="#daa520"/><rect x="4" y="8" width="8" height="1" fill="#daa520"/><rect x="5" y="9" width="6" height="1" fill="#c8960c"/><rect x="7" y="10" width="2" height="2" fill="#c8960c"/><rect x="5" y="12" width="6" height="1" fill="#daa520"/><rect x="4" y="13" width="8" height="1" fill="#ffd700"/></svg>',
  // 👑 crown — golden crown with gems
  crown: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="2" y="4" width="2" height="1" fill="#ffd700"/><rect x="7" y="3" width="2" height="1" fill="#ffd700"/><rect x="12" y="4" width="2" height="1" fill="#ffd700"/><rect x="2" y="5" width="2" height="1" fill="#ffed4a"/><rect x="5" y="5" width="1" height="1" fill="#ffd700"/><rect x="7" y="4" width="2" height="1" fill="#ffed4a"/><rect x="10" y="5" width="1" height="1" fill="#ffd700"/><rect x="12" y="5" width="2" height="1" fill="#ffed4a"/><rect x="2" y="6" width="12" height="1" fill="#ffd700"/><rect x="2" y="7" width="12" height="1" fill="#daa520"/><rect x="2" y="8" width="12" height="1" fill="#ffd700"/><rect x="4" y="8" width="2" height="1" fill="#e53e3e"/><rect x="7" y="8" width="2" height="1" fill="#38bdf8"/><rect x="10" y="8" width="2" height="1" fill="#4ade80"/><rect x="2" y="9" width="12" height="1" fill="#daa520"/><rect x="2" y="10" width="12" height="1" fill="#c8960c"/></svg>',
  // 💎 diamond — blue diamond gem
  diamond: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="5" y="3" width="6" height="1" fill="#93c5fd"/><rect x="4" y="4" width="2" height="1" fill="#60a5fa"/><rect x="6" y="4" width="4" height="1" fill="#bfdbfe"/><rect x="10" y="4" width="2" height="1" fill="#60a5fa"/><rect x="3" y="5" width="2" height="1" fill="#3b82f6"/><rect x="5" y="5" width="6" height="1" fill="#93c5fd"/><rect x="11" y="5" width="2" height="1" fill="#3b82f6"/><rect x="2" y="6" width="12" height="1" fill="#60a5fa"/><rect x="3" y="7" width="4" height="1" fill="#3b82f6"/><rect x="7" y="7" width="2" height="1" fill="#93c5fd"/><rect x="9" y="7" width="4" height="1" fill="#3b82f6"/><rect x="4" y="8" width="3" height="1" fill="#2563eb"/><rect x="7" y="8" width="2" height="1" fill="#60a5fa"/><rect x="9" y="8" width="3" height="1" fill="#2563eb"/><rect x="5" y="9" width="6" height="1" fill="#2563eb"/><rect x="6" y="10" width="4" height="1" fill="#1d4ed8"/><rect x="7" y="11" width="2" height="1" fill="#1e3a8a"/></svg>',
  // 📖 book — blue/brown open book
  book: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="1" y="3" width="6" height="1" fill="#92400e"/><rect x="9" y="3" width="6" height="1" fill="#92400e"/><rect x="1" y="4" width="1" height="8" fill="#92400e"/><rect x="2" y="4" width="5" height="8" fill="#fef3c7"/><rect x="8" y="4" width="1" height="8" fill="#7c3aed"/><rect x="9" y="4" width="5" height="8" fill="#fef3c7"/><rect x="14" y="4" width="1" height="8" fill="#92400e"/><rect x="3" y="5" width="3" height="1" fill="#60a5fa"/><rect x="10" y="5" width="3" height="1" fill="#60a5fa"/><rect x="3" y="7" width="3" height="1" fill="#94a3b8"/><rect x="10" y="7" width="3" height="1" fill="#94a3b8"/><rect x="3" y="9" width="3" height="1" fill="#94a3b8"/><rect x="10" y="9" width="3" height="1" fill="#94a3b8"/><rect x="1" y="12" width="6" height="1" fill="#92400e"/><rect x="9" y="12" width="6" height="1" fill="#92400e"/><rect x="7" y="4" width="2" height="9" fill="#7c3aed"/></svg>',
  // ⭐ star — golden star
  star: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="7" y="1" width="2" height="2" fill="#ffd700"/><rect x="6" y="3" width="4" height="1" fill="#ffd700"/><rect x="5" y="4" width="6" height="1" fill="#ffed4a"/><rect x="1" y="5" width="14" height="1" fill="#ffd700"/><rect x="2" y="6" width="12" height="1" fill="#ffd700"/><rect x="3" y="7" width="10" height="1" fill="#daa520"/><rect x="4" y="8" width="8" height="1" fill="#daa520"/><rect x="3" y="9" width="4" height="1" fill="#c8960c"/><rect x="9" y="9" width="4" height="1" fill="#c8960c"/><rect x="2" y="10" width="4" height="1" fill="#b8860b"/><rect x="10" y="10" width="4" height="1" fill="#b8860b"/><rect x="1" y="11" width="3" height="1" fill="#8b6914"/><rect x="12" y="11" width="3" height="1" fill="#8b6914"/></svg>',
  // ❤️ heart — red heart
  heart: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="2" y="4" width="4" height="1" fill="#f87171"/><rect x="10" y="4" width="4" height="1" fill="#f87171"/><rect x="1" y="5" width="6" height="1" fill="#ef4444"/><rect x="3" y="5" width="2" height="1" fill="#fca5a5"/><rect x="9" y="5" width="6" height="1" fill="#ef4444"/><rect x="1" y="6" width="14" height="1" fill="#ef4444"/><rect x="1" y="7" width="14" height="1" fill="#dc2626"/><rect x="2" y="8" width="12" height="1" fill="#dc2626"/><rect x="3" y="9" width="10" height="1" fill="#b91c1c"/><rect x="4" y="10" width="8" height="1" fill="#b91c1c"/><rect x="5" y="11" width="6" height="1" fill="#991b1b"/><rect x="6" y="12" width="4" height="1" fill="#7f1d1d"/><rect x="7" y="13" width="2" height="1" fill="#7f1d1d"/></svg>',
  // ⚡ zap — yellow lightning bolt
  zap: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="8" y="1" width="3" height="1" fill="#fbbf24"/><rect x="7" y="2" width="3" height="1" fill="#fbbf24"/><rect x="6" y="3" width="3" height="1" fill="#f59e0b"/><rect x="5" y="4" width="3" height="1" fill="#f59e0b"/><rect x="4" y="5" width="3" height="1" fill="#f59e0b"/><rect x="3" y="6" width="7" height="1" fill="#fbbf24"/><rect x="3" y="7" width="8" height="1" fill="#fcd34d"/><rect x="7" y="8" width="3" height="1" fill="#f59e0b"/><rect x="8" y="9" width="3" height="1" fill="#f59e0b"/><rect x="9" y="10" width="2" height="1" fill="#d97706"/><rect x="8" y="11" width="2" height="1" fill="#d97706"/><rect x="7" y="12" width="2" height="1" fill="#b45309"/><rect x="6" y="13" width="2" height="1" fill="#b45309"/></svg>',
  // 🎯 target — red/white target
  target: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="5" y="2" width="6" height="1" fill="#ef4444"/><rect x="3" y="3" width="2" height="1" fill="#ef4444"/><rect x="5" y="3" width="6" height="1" fill="#fca5a5"/><rect x="11" y="3" width="2" height="1" fill="#ef4444"/><rect x="2" y="4" width="1" height="1" fill="#ef4444"/><rect x="3" y="4" width="2" height="1" fill="#fca5a5"/><rect x="5" y="4" width="6" height="1" fill="#fff"/><rect x="11" y="4" width="2" height="1" fill="#fca5a5"/><rect x="13" y="4" width="1" height="1" fill="#ef4444"/><rect x="2" y="5" width="1" height="6" fill="#ef4444"/><rect x="3" y="5" width="2" height="6" fill="#fca5a5"/><rect x="5" y="5" width="1" height="6" fill="#fff"/><rect x="6" y="5" width="1" height="6" fill="#ef4444"/><rect x="7" y="6" width="2" height="4" fill="#ef4444"/><rect x="7" y="7" width="2" height="2" fill="#ffd700"/><rect x="9" y="5" width="1" height="6" fill="#ef4444"/><rect x="10" y="5" width="1" height="6" fill="#fff"/><rect x="11" y="5" width="2" height="6" fill="#fca5a5"/><rect x="13" y="5" width="1" height="6" fill="#ef4444"/><rect x="3" y="11" width="2" height="1" fill="#fca5a5"/><rect x="5" y="11" width="6" height="1" fill="#fff"/><rect x="11" y="11" width="2" height="1" fill="#fca5a5"/><rect x="5" y="12" width="6" height="1" fill="#fca5a5"/><rect x="5" y="13" width="6" height="1" fill="#ef4444"/></svg>',
  // 🛡️ shield — blue/silver shield
  shield: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="4" y="2" width="8" height="1" fill="#60a5fa"/><rect x="3" y="3" width="10" height="1" fill="#3b82f6"/><rect x="3" y="4" width="1" height="1" fill="#3b82f6"/><rect x="4" y="4" width="8" height="1" fill="#93c5fd"/><rect x="12" y="4" width="1" height="1" fill="#3b82f6"/><rect x="3" y="5" width="1" height="4" fill="#2563eb"/><rect x="4" y="5" width="8" height="1" fill="#60a5fa"/><rect x="7" y="5" width="2" height="1" fill="#ffd700"/><rect x="12" y="5" width="1" height="4" fill="#2563eb"/><rect x="4" y="6" width="8" height="1" fill="#60a5fa"/><rect x="6" y="6" width="4" height="1" fill="#ffd700"/><rect x="4" y="7" width="8" height="1" fill="#3b82f6"/><rect x="7" y="7" width="2" height="1" fill="#ffd700"/><rect x="4" y="8" width="8" height="1" fill="#3b82f6"/><rect x="4" y="9" width="8" height="1" fill="#2563eb"/><rect x="5" y="10" width="6" height="1" fill="#2563eb"/><rect x="6" y="11" width="4" height="1" fill="#1d4ed8"/><rect x="7" y="12" width="2" height="1" fill="#1e3a8a"/></svg>',
  // 🪙 coin — golden coin
  coin: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="5" y="3" width="6" height="1" fill="#fbbf24"/><rect x="4" y="4" width="2" height="1" fill="#f59e0b"/><rect x="6" y="4" width="4" height="1" fill="#fde68a"/><rect x="10" y="4" width="2" height="1" fill="#f59e0b"/><rect x="3" y="5" width="1" height="6" fill="#d97706"/><rect x="4" y="5" width="1" height="6" fill="#f59e0b"/><rect x="5" y="5" width="6" height="6" fill="#fbbf24"/><rect x="7" y="5" width="2" height="1" fill="#fde68a"/><rect x="7" y="6" width="2" height="4" fill="#f59e0b"/><rect x="6" y="7" width="1" height="2" fill="#f59e0b"/><rect x="9" y="7" width="1" height="2" fill="#d97706"/><rect x="11" y="5" width="1" height="6" fill="#f59e0b"/><rect x="12" y="5" width="1" height="6" fill="#d97706"/><rect x="4" y="11" width="2" height="1" fill="#d97706"/><rect x="6" y="11" width="4" height="1" fill="#f59e0b"/><rect x="10" y="11" width="2" height="1" fill="#d97706"/><rect x="5" y="12" width="6" height="1" fill="#b45309"/></svg>',
  // ✨ sparkle — multi-color sparkle
  sparkle: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="7" y="1" width="2" height="1" fill="#fbbf24"/><rect x="7" y="2" width="2" height="1" fill="#fde68a"/><rect x="7" y="3" width="2" height="2" fill="#fbbf24"/><rect x="3" y="6" width="2" height="1" fill="#fbbf24"/><rect x="5" y="6" width="1" height="1" fill="#fde68a"/><rect x="6" y="5" width="1" height="3" fill="#fbbf24"/><rect x="7" y="4" width="2" height="5" fill="#fff7ed"/><rect x="9" y="5" width="1" height="3" fill="#fbbf24"/><rect x="10" y="6" width="1" height="1" fill="#fde68a"/><rect x="11" y="6" width="2" height="1" fill="#fbbf24"/><rect x="7" y="9" width="2" height="2" fill="#fbbf24"/><rect x="7" y="11" width="2" height="1" fill="#fde68a"/><rect x="7" y="12" width="2" height="1" fill="#fbbf24"/><rect x="2" y="2" width="1" height="1" fill="#c4b5fd"/><rect x="13" y="3" width="1" height="1" fill="#93c5fd"/><rect x="3" y="12" width="1" height="1" fill="#93c5fd"/><rect x="12" y="11" width="1" height="1" fill="#c4b5fd"/></svg>',
  // 🎁 gift — wrapped gift box
  gift: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="5" y="2" width="2" height="2" fill="#f87171"/><rect x="9" y="2" width="2" height="2" fill="#f87171"/><rect x="7" y="3" width="2" height="1" fill="#fca5a5"/><rect x="2" y="4" width="12" height="2" fill="#ef4444"/><rect x="7" y="4" width="2" height="2" fill="#fbbf24"/><rect x="2" y="6" width="12" height="1" fill="#dc2626"/><rect x="2" y="7" width="5" height="5" fill="#ef4444"/><rect x="7" y="7" width="2" height="5" fill="#fbbf24"/><rect x="9" y="7" width="5" height="5" fill="#ef4444"/><rect x="2" y="12" width="12" height="1" fill="#dc2626"/></svg>',
  // 🕐 clock — blue clock
  clock: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="5" y="2" width="6" height="1" fill="#60a5fa"/><rect x="3" y="3" width="2" height="1" fill="#60a5fa"/><rect x="11" y="3" width="2" height="1" fill="#60a5fa"/><rect x="2" y="4" width="1" height="1" fill="#3b82f6"/><rect x="3" y="4" width="10" height="1" fill="#dbeafe"/><rect x="13" y="4" width="1" height="1" fill="#3b82f6"/><rect x="2" y="5" width="1" height="6" fill="#3b82f6"/><rect x="3" y="5" width="10" height="6" fill="#eff6ff"/><rect x="13" y="5" width="1" height="6" fill="#3b82f6"/><rect x="7" y="5" width="2" height="1" fill="#1e40af"/><rect x="7" y="6" width="2" height="2" fill="#1e40af"/><rect x="9" y="7" width="2" height="1" fill="#1e40af"/><rect x="3" y="11" width="2" height="1" fill="#60a5fa"/><rect x="5" y="11" width="6" height="1" fill="#dbeafe"/><rect x="11" y="11" width="2" height="1" fill="#60a5fa"/><rect x="5" y="12" width="6" height="1" fill="#3b82f6"/></svg>',
  // 📝 note — notepad with pencil
  note: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="3" y="2" width="9" height="1" fill="#fbbf24"/><rect x="3" y="3" width="9" height="9" fill="#fef3c7"/><rect x="3" y="3" width="1" height="9" fill="#f59e0b"/><rect x="11" y="3" width="1" height="9" fill="#f59e0b"/><rect x="5" y="4" width="5" height="1" fill="#94a3b8"/><rect x="5" y="6" width="4" height="1" fill="#94a3b8"/><rect x="5" y="8" width="5" height="1" fill="#94a3b8"/><rect x="5" y="10" width="3" height="1" fill="#94a3b8"/><rect x="3" y="12" width="9" height="1" fill="#d97706"/><rect x="12" y="3" width="1" height="1" fill="#ef4444"/><rect x="13" y="2" width="1" height="1" fill="#ef4444"/><rect x="12" y="4" width="1" height="8" fill="#fbbf24"/></svg>',
  // 📚 scroll — purple scroll
  scroll: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="3" y="2" width="8" height="1" fill="#a78bfa"/><rect x="2" y="3" width="1" height="1" fill="#8b5cf6"/><rect x="3" y="3" width="8" height="1" fill="#ede9fe"/><rect x="11" y="3" width="1" height="1" fill="#8b5cf6"/><rect x="2" y="4" width="1" height="7" fill="#7c3aed"/><rect x="3" y="4" width="8" height="7" fill="#f5f3ff"/><rect x="11" y="4" width="1" height="7" fill="#7c3aed"/><rect x="4" y="5" width="5" height="1" fill="#a78bfa"/><rect x="4" y="7" width="4" height="1" fill="#c4b5fd"/><rect x="4" y="9" width="5" height="1" fill="#c4b5fd"/><rect x="3" y="11" width="8" height="1" fill="#ede9fe"/><rect x="3" y="12" width="10" height="1" fill="#8b5cf6"/><rect x="12" y="11" width="1" height="1" fill="#8b5cf6"/><rect x="13" y="12" width="1" height="1" fill="#7c3aed"/></svg>',
};
function pxBadge(name) { return _PX[name] || _PX.star; }
var BADGE_DEFS = [

  // 🔥 STREAK
  { id:'streak_3',   cat:'streak',    tier:'bronze',   icon:pxBadge('fire'), name:'First Spark',      desc:'3-day study streak',
    check: function(s){ return getCurrentStreak() >= 3; } },
  { id:'streak_7',   cat:'streak',    tier:'silver',   icon:pxBadge('fire'), name:'Week Warrior',    desc:'7-day study streak',
    check: function(s){ return getCurrentStreak() >= 7; } },
  { id:'streak_30',  cat:'streak',    tier:'gold',     icon:pxBadge('trophy'), name:'30-Day Power',    desc:'30-day study streak',
    check: function(s){ return getCurrentStreak() >= 30; } },
  { id:'streak_50',  cat:'streak',    tier:'gold',     icon:pxBadge('zap'), name:'50-Day Milestone', desc:'50-day study streak',
    check: function(s){ return getCurrentStreak() >= 50; } },
  { id:'streak_100', cat:'streak',    tier:'diamond',  icon:pxBadge('diamond'), name:'100-Day Champion', desc:'100-day study streak',
    check: function(s){ return getCurrentStreak() >= 100; } },
  { id:'streak_365', cat:'streak',    tier:'legendary',icon:pxBadge('crown'), name:'365 Legend',       desc:'1-year study streak',
    check: function(s){ return getCurrentStreak() >= 365; } },

  // 📰 READING
  { id:'read_1',     cat:'reading',   tier:'bronze',   icon:pxBadge('book'), name:'First Article',    desc:'Read your first article',
    check: function(){ return getTotalArticlesRead() >= 1; } },
  { id:'read_10',    cat:'reading',   tier:'bronze',   icon:pxBadge('note'), name:'News Beginner',    desc:'Read 10 articles',
    check: function(){ return getTotalArticlesRead() >= 10; } },
  { id:'read_50',    cat:'reading',   tier:'silver',   icon:pxBadge('scroll'), name:'News Explorer',    desc:'Read 50 articles',
    check: function(){ return getTotalArticlesRead() >= 50; } },
  { id:'read_100',   cat:'reading',   tier:'gold',     icon:pxBadge('note'), name:'Aspiring Reporter', desc:'Read 100 articles',
    check: function(){ return getTotalArticlesRead() >= 100; } },
  { id:'read_500',   cat:'reading',   tier:'legendary',icon:pxBadge('scroll'), name:'Korean Scholar',   desc:'Read 500 articles',
    check: function(){ return getTotalArticlesRead() >= 500; } },
  { id:'read_daily10',cat:'reading',  tier:'gold',     icon:pxBadge('zap'), name:'10 in a Day',      desc:'Read 10 articles in one day',
    check: function(){
      var log = lsGet('kh_read_log', {});
      return Object.values(log).some(function(arr){ return arr.length >= 10; });
    } },
  { id:'read_allsec',cat:'reading',   tier:'diamond',  icon:pxBadge('target'), name:'All-Rounder',     desc:'Read from every section',
    check: function(){
      var sc = getSectionReadCounts();
      var secs = ['사회','국제','문화','스포츠','Korea','beauty','travel','오피니언','정치','경제'];
      return secs.every(function(s){ return (sc[s]||0) >= 1; });
    } },

  // 🔖 VOCAB
  { id:'word_10',    cat:'vocab',     tier:'bronze',   icon:pxBadge('sparkle'), name:'Seed Vocab',      desc:'Save 10 words',
    check: function(){ return lsGet(K_SAVED,[]).length >= 10; } },
  { id:'word_50',    cat:'vocab',     tier:'silver',   icon:pxBadge('book'), name:'Word Sprout',     desc:'Save 50 words',
    check: function(){ return lsGet(K_SAVED,[]).length >= 50; } },
  { id:'word_100',   cat:'vocab',     tier:'silver',   icon:pxBadge('scroll'), name:'Word Collector',  desc:'Save 100 words',
    check: function(){ return lsGet(K_SAVED,[]).length >= 100; } },
  { id:'word_300',   cat:'vocab',     tier:'gold',     icon:pxBadge('shield'), name:'Vocab Tree',      desc:'Save 300 words',
    check: function(){ return lsGet(K_SAVED,[]).length >= 300; } },
  { id:'word_1000',  cat:'vocab',     tier:'diamond',  icon:pxBadge('diamond'), name:'TOPIK Vocab',     desc:'Save 1000 words',
    check: function(){ return lsGet(K_SAVED,[]).length >= 1000; } },
  { id:'word_2000',  cat:'vocab',     tier:'legendary',icon:pxBadge('crown'), name:'Vocab Master',    desc:'Save 2000 words',
    check: function(){ return lsGet(K_SAVED,[]).length >= 2000; } },

  // 📝 QUIZ
  { id:'quiz_first', cat:'quiz',      tier:'bronze',   icon:pxBadge('star'), name:'First Quiz',      desc:'Complete your first quiz',
    check: function(){ return lsGet('kh_quiz_done_count',0) >= 1; } },
  { id:'quiz_perfect1',cat:'quiz',    tier:'silver',   icon:pxBadge('target'), name:'Daily Perfect',   desc:'Score 100% on a daily test',
    check: function(){ return getQuizPerfectCount() >= 1; } },
  { id:'quiz_perfect3',cat:'quiz',    tier:'gold',     icon:pxBadge('sparkle'), name:'3x Perfect',      desc:'Score 100% on 3 daily tests in a row',
    check: function(){ return lsGet('kh_quiz_perfect_streak',0) >= 3; } },
  { id:'quiz_14days',cat:'quiz',      tier:'diamond',  icon:pxBadge('clock'), name:'Daily Devotee',   desc:'Complete daily tests 14 days in a row',
    check: function(){ return getQuizStreakDays() >= 14; } },

  // 🌍 SECTIONS
  { id:'sec_politics',cat:'sections', tier:'gold', icon:pxBadge('shield'), name:'Politics Master', desc:'Read 20 Politics articles',
    check: function(){ return (getSectionReadCounts()['정치']||0) >= 20; } },
  { id:'sec_economy', cat:'sections', tier:'gold', icon:pxBadge('coin'), name:'Economy Master', desc:'Read 20 Economy articles',
    check: function(){ return (getSectionReadCounts()['경제']||0) >= 20; } },
  { id:'sec_society', cat:'sections', tier:'gold', icon:pxBadge('heart'), name:'Society Master', desc:'Read 20 Society articles',
    check: function(){ return (getSectionReadCounts()['사회']||0) >= 20; } },
  { id:'sec_world',   cat:'sections', tier:'gold', icon:pxBadge('scroll'), name:'World Master', desc:'Read 20 World articles',
    check: function(){ return (getSectionReadCounts()['국제']||0) >= 20; } },
  { id:'sec_culture', cat:'sections', tier:'gold', icon:pxBadge('sparkle'), name:'Culture Master', desc:'Read 20 Culture articles',
    check: function(){ return (getSectionReadCounts()['문화']||0) >= 20; } },
  { id:'sec_sports',  cat:'sections', tier:'gold', icon:pxBadge('trophy'), name:'Sports Master',desc:'Read 20 Sports articles',
    check: function(){ return (getSectionReadCounts()['스포츠']||0) >= 20; } },
  { id:'sec_korea',   cat:'sections', tier:'gold', icon:pxBadge('gift'), name:'Korea Master',desc:'Read 20 Korea articles',
    check: function(){ return (getSectionReadCounts()['Korea']||0) >= 20; } },
  { id:'sec_beauty',  cat:'sections', tier:'gold', icon:pxBadge('sparkle'), name:'Beauty Master',desc:'Read 20 Beauty articles',
    check: function(){ return (getSectionReadCounts()['beauty']||0) >= 20; } },
  { id:'sec_travel',  cat:'sections', tier:'gold', icon:pxBadge('scroll'), name:'Travel Master',desc:'Read 20 Travel articles',
    check: function(){ return (getSectionReadCounts()['travel']||0) >= 20; } },
  { id:'sec_opinion', cat:'sections', tier:'gold', icon:pxBadge('note'), name:'Opinion Master',desc:'Read 10 Opinion articles',
    check: function(){ return (getSectionReadCounts()['오피니언']||0) >= 10; } },

  // 🔢 MILESTONE / XP
  { id:'xp_7500',    cat:'milestone', tier:'bronze',   icon:pxBadge('star'), name:'XP 7,500',    desc:'Earn 7,500 XP total',
    check: function(){ return getXP() >= 7500; } },
  { id:'xp_30000',   cat:'milestone', tier:'silver',   icon:pxBadge('sparkle'), name:'XP 30,000',   desc:'Earn 30,000 XP total',
    check: function(){ return getXP() >= 30000; } },
  { id:'xp_75000',   cat:'milestone', tier:'gold',     icon:pxBadge('trophy'), name:'XP 75,000',   desc:'Earn 75,000 XP total',
    check: function(){ return getXP() >= 75000; } },
  { id:'xp_300000',  cat:'milestone', tier:'diamond',  icon:pxBadge('diamond'), name:'XP 300,000',  desc:'Earn 300,000 XP total',
    check: function(){ return getXP() >= 300000; } },
  { id:'days_90',    cat:'milestone', tier:'gold',     icon:pxBadge('gift'), name:'3-Month Runner', desc:'Study for 90 days after signup',
    check: function(){
      var log = lsGet('kh_study_log',{});
      var active = Object.keys(log).filter(function(k){ var d=log[k]; return (d.articles||0)+(d.words||0)+(d.quiz||0)>0; });
      return active.length >= 90;
    } },

  // ⏰ TIME
  { id:'time_midnight',cat:'time',    tier:'silver',   icon:pxBadge('clock'), name:'Night Owl',       desc:'Study after midnight',
    check: function(){ return lsGet('kh_badge_midnight', false); } },
  { id:'time_dawn',    cat:'time',    tier:'gold',     icon:pxBadge('sparkle'), name:'Dawn Scholar',   desc:'Study before 6 AM',
    check: function(){ return lsGet('kh_badge_dawn', false); } },
  { id:'time_morning7',cat:'time',    tier:'bronze',   icon:pxBadge('zap'), name:'Morning Routine', desc:'Study before 7 AM, 7 times',
    check: function(){ return lsGet('kh_morning_count',0) >= 7; } },
  { id:'time_monday',  cat:'time',    tier:'bronze',   icon:pxBadge('clock'), name:'Monday Fighter',  desc:'Study on Mondays, 4 weeks in a row',
    check: function(){ return lsGet('kh_monday_streak',0) >= 4; } },
  { id:'time_friday',  cat:'time',    tier:'silver',   icon:pxBadge('sparkle'), name:'Friday Learner',  desc:'Study on Friday night, 4 times',
    check: function(){ return lsGet('kh_friday_night_count',0) >= 4; } },
  { id:'time_weekend', cat:'time',    tier:'gold',     icon:pxBadge('trophy'), name:'Weekend Champ',   desc:'Study on weekends, 8 weeks in a row',
    check: function(){ return lsGet('kh_weekend_streak',0) >= 8; } },

  // 🎌 CULTURAL
  { id:'cult_march1',  cat:'cultural',tier:'gold',     icon:pxBadge('heart'), name:'March 1st',       desc:'Study on March 1 (Independence Day)',
    check: function(){ return lsGet('kh_cult_march1', false); } },
  { id:'cult_hangul',  cat:'cultural',tier:'legendary',icon:pxBadge('gift'),name:'Hangul Guardian', desc:'Study on Oct 9 (Hangul Day)',
    check: function(){ return lsGet('kh_cult_hangul', false); } },
  { id:'cult_newyear', cat:'cultural',tier:'gold',     icon:pxBadge('sparkle'), name:'New Year\'s',     desc:'Study on January 1',
    check: function(){ return lsGet('kh_cult_newyear', false); } },
  { id:'cult_chuseok', cat:'cultural',tier:'diamond',  icon:pxBadge('diamond'), name:'Chuseok Study',   desc:'Study on Chuseok day',
    check: function(){ return lsGet('kh_cult_chuseok', false); } },
  { id:'cult_seollal', cat:'cultural',tier:'diamond',  icon:pxBadge('crown'), name:'Seollal Study',   desc:'Study on Seollal day',
    check: function(){ return lsGet('kh_cult_seollal', false); } },
  { id:'cult_gwangbok',cat:'cultural',tier:'silver',   icon:pxBadge('shield'), name:'Liberation Day',  desc:'Study on August 15',
    check: function(){ return lsGet('kh_cult_gwangbok', false); } },
  { id:'cult_pepero',  cat:'cultural',tier:'gold',     icon:pxBadge('heart'), name:'Pepero Day',      desc:'Study on November 11',
    check: function(){ return lsGet('kh_cult_pepero', false); } },
  { id:'cult_valentine',cat:'cultural',tier:'silver',  icon:pxBadge('heart'), name:'Valentine\'s Day', desc:'Study on February 14',
    check: function(){ return lsGet('kh_cult_valentine', false); } },
  { id:'cult_christmas',cat:'cultural',tier:'gold',    icon:pxBadge('gift'), name:'Christmas',       desc:'Study on December 25',
    check: function(){ return lsGet('kh_cult_christmas', false); } },
  { id:'cult_collector',cat:'cultural',tier:'legendary',icon:pxBadge('crown'),name:'Holiday Collector',desc:'Earn 7 cultural date badges',
    check: function(){
      var earned = getEarnedBadges();
      var cultIds = ['cult_march1','cult_hangul','cult_newyear','cult_chuseok','cult_seollal','cult_gwangbok','cult_pepero','cult_valentine','cult_christmas'];
      return cultIds.filter(function(id){ return !!earned[id]; }).length >= 7;
    } },
];

// ── 날짜/시간 기반 문화 뱃지 체크 ──────────────────────────────────────────
function checkCulturalDateBadges() {
  var now = new Date(Date.now() + 9*60*60*1000); // KST
  var m = now.getMonth()+1, d = now.getDate(), h = now.getHours();
  if (m===3 && d===1)   lsSet('kh_cult_march1',   true);
  if (m===10 && d===9)  lsSet('kh_cult_hangul',    true);
  if (m===1 && d===1)   lsSet('kh_cult_newyear',   true);
  if (m===8 && d===15)  lsSet('kh_cult_gwangbok',  true);
  if (m===11 && d===11) lsSet('kh_cult_pepero',    true);
  if (m===2 && d===14)  lsSet('kh_cult_valentine', true);
  if (m===12 && d===25) lsSet('kh_cult_christmas', true);
  // 자정/새벽
  if (h >= 0 && h < 1) lsSet('kh_badge_midnight', true);
  if (h < 6)            lsSet('kh_badge_dawn',     true);
  if (h < 7)            { var cnt = lsGet('kh_morning_count',0); lsSet('kh_morning_count', cnt+1); }
  // 요일
  var day = now.getDay(); // 0=일, 1=월, 5=금, 6=토
  if (day === 1) {
    var mStreak = lsGet('kh_monday_streak',0);
    var lastMon = lsGet('kh_last_monday','');
    var thisMonKey = now.toISOString().slice(0,10);
    if (lastMon !== thisMonKey) { lsSet('kh_monday_streak', mStreak+1); lsSet('kh_last_monday', thisMonKey); }
  }
  if (day === 5 && h >= 18) {
    var fn = lsGet('kh_friday_night_count',0);
    var lastFri = lsGet('kh_last_friday_night','');
    var thisFriKey = now.toISOString().slice(0,10);
    if (lastFri !== thisFriKey) { lsSet('kh_friday_night_count', fn+1); lsSet('kh_last_friday_night', thisFriKey); }
  }
  if (day === 0 || day === 6) {
    var ws = lsGet('kh_weekend_streak',0);
    var lastWe = lsGet('kh_last_weekend_week','');
    var weekNum = Math.floor(now.getTime() / (7*24*60*60*1000));
    if (String(lastWe) !== String(weekNum)) { lsSet('kh_weekend_streak', ws+1); lsSet('kh_last_weekend_week', weekNum); }
  }
}

// ── 섹션별 읽기 카운트 업데이트 ─────────────────────────────────────────────
function trackSectionRead(section) {
  if (!section) return;
  var sc = getSectionReadCounts();
  sc[section] = (sc[section]||0) + 1;
  lsSet(K_READ_SECTIONS, sc);
}

// ── 뱃지 체크 메인 함수 ─────────────────────────────────────────────────────
function checkBadges(event, payload) {
  var earned = getEarnedBadges();
  var newBadges = [];

  BADGE_DEFS.forEach(function(b) {
    if (earned[b.id]) return; // 이미 획득
    try {
      if (b.check(payload || {})) {
        earned[b.id] = { earnedAt: new Date().toISOString() };
        newBadges.push(b);
      }
    } catch(e) {}
  });

  if (newBadges.length) {
    lsSet(K_BADGES, earned);
    newBadges.forEach(function(b){ showBadgeToast(b); });
  }
  return newBadges;
}

// ── 뱃지 획득 토스트 알림 ───────────────────────────────────────────────────
var _badgeToastQueue = [];
var _badgeToastShowing = false;

function showBadgeToast(badge) {
  _badgeToastQueue.push(badge);
  if (!_badgeToastShowing) processNextBadgeToast();
}

function processNextBadgeToast() {
  if (!_badgeToastQueue.length) { _badgeToastShowing = false; return; }
  _badgeToastShowing = true;
  var b = _badgeToastQueue.shift();

  var tierColors = { bronze:'#cd7c3a', silver:'#9aa5b4', gold:'#f5a623', diamond:'#60a5fa', legendary:'#a855f7' };
  var color = tierColors[b.tier] || '#2255a4';

  var el = document.createElement('div');
  el.id = 'badge-toast';
  el.style.cssText = [
    'position:fixed', 'bottom:28px', 'left:50%', 'transform:translateX(-50%) translateY(80px)',
    'background:#0b1626', 'border:2px solid '+color,
    'border-radius:16px', 'padding:14px 22px',
    'display:flex', 'align-items:center', 'gap:14px',
    'z-index:9999', 'box-shadow:0 12px 40px rgba(0,0,0,.4)',
    'transition:transform .4s cubic-bezier(.34,1.56,.64,1)',
    'min-width:260px', 'max-width:340px'
  ].join(';');

  el.innerHTML =
    '<div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#1a3a6b,#2255a4);'
    + 'display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;'
    + 'box-shadow:0 0 0 2px '+color+'">' + b.icon + '</div>'
    + '<div>'
    + '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:'+color+';margin-bottom:3px">🏅 Badge Unlocked!</div>'
    + '<div style="font-size:15px;font-weight:900;color:#fff;margin-bottom:2px">' + b.name + '</div>'
    + '<div style="font-size:11px;color:rgba(255,255,255,.5)">' + b.desc + '</div>'
    + '</div>';

  // 기존 토스트 제거
  var old = document.getElementById('badge-toast');
  if (old) old.remove();

  document.body.appendChild(el);
  setTimeout(function(){ el.style.transform = 'translateX(-50%) translateY(0)'; }, 50);
  setTimeout(function(){
    el.style.transform = 'translateX(-50%) translateY(80px)';
    el.style.opacity = '0';
    setTimeout(function(){
      el.remove();
      setTimeout(processNextBadgeToast, 300);
    }, 400);
  }, 3200);
}

// ── 뱃지 통계 반환 (마이페이지용) ──────────────────────────────────────────
function getBadgeStats() {
  var earned = getEarnedBadges();
  var total = BADGE_DEFS.length;
  var earnedCount = Object.keys(earned).length;
  return {
    earned: earned,
    earnedCount: earnedCount,
    total: total,
    pct: Math.round(earnedCount / total * 100),
    xp: getXP(),
    streak: getCurrentStreak()
  };
}

// ── 뱃지 페이지 렌더링 (마이페이지 탭) ──────────────────────────────────────
function renderBadgePage(container) {
  var stats = getBadgeStats();
  var earned = stats.earned;

  var tierColor = { bronze:'#cd7c3a', silver:'#9aa5b4', gold:'#f5a623', diamond:'#60a5fa', legendary:'#a855f7' };
  var tierBg    = { bronze:'#fff3e0', silver:'#f1f5f9', gold:'#fffbeb', diamond:'#eff6ff', legendary:'#fdf4ff' };
  var tierLabel = { bronze:'Bronze', silver:'Silver', gold:'Gold', diamond:'Diamond', legendary:'Legend' };

  var cats = [
    { key:'streak',    label:'🔥 Streak' },
    { key:'reading',   label:'📰 Reading' },
    { key:'vocab',     label:'🔖 Vocabulary' },
    { key:'quiz',      label:'📝 Quiz & Test' },
    { key:'sections',  label:'🌍 Sections' },
    { key:'milestone', label:'🔢 Milestone' },
    { key:'time',      label:'⏰ Time' },
    { key:'cultural',  label:'🎌 Cultural' },
  ];

  var html =
    // 통계 헤더
    '<div style="background:#0b1626;border-radius:16px;padding:20px 24px;margin-bottom:24px;display:flex;gap:0">'
    + statBox(stats.earnedCount + ' / ' + stats.total, 'Badges', '#f5a623')
    + statBox(stats.xp.toLocaleString(), 'Total XP', '#60a5fa')
    + statBox(stats.streak, 'Day Streak', '#4ade80')
    + statBox(stats.pct + '%', 'Complete', '#f472b6')
    + '</div>';

  // 카테고리별 렌더
  cats.forEach(function(cat) {
    var catBadges = BADGE_DEFS.filter(function(b){ return b.cat === cat.key; });
    var catEarned = catBadges.filter(function(b){ return !!earned[b.id]; }).length;

    html += '<div style="margin-bottom:6px">'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
      + '<span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#94a3b8">' + cat.label + '</span>'
      + '<div style="flex:1;height:1px;background:#e2e8f0"></div>'
      + '<span style="font-size:11px;font-weight:700;color:#2255a4;background:#e8f0fb;padding:2px 9px;border-radius:999px">' + catEarned + ' / ' + catBadges.length + '</span>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-bottom:28px">';

    catBadges.forEach(function(b) {
      var isEarned = !!earned[b.id];
      var earnedDate = isEarned ? earned[b.id].earnedAt.slice(0,10).replace(/-/g,'.') : null;
      var tc = tierColor[b.tier], tbg = tierBg[b.tier], tl = tierLabel[b.tier];

      // 진행 상황
      var progress = getBadgeProgress(b);

      html += '<div style="background:#fff;border-radius:14px;padding:18px 10px 14px;text-align:center;'
        + 'border:2px solid ' + (isEarned ? tc : '#e2e8f0') + ';position:relative;'
        + (isEarned ? 'box-shadow:0 4px 16px rgba(0,0,0,.06)' : 'opacity:.45;filter:grayscale(.4)') + '">'
        // tier label
        + '<span style="position:absolute;top:7px;right:7px;font-size:7px;font-weight:900;text-transform:uppercase;'
        + 'letter-spacing:.8px;padding:2px 5px;border-radius:999px;background:' + tbg + ';color:' + tc + '">' + tl + '</span>'
        // icon
        + '<div style="width:54px;height:54px;border-radius:50%;margin:0 auto 9px;display:flex;align-items:center;justify-content:center;font-size:26px;'
        + 'background:' + tbg + ';box-shadow:0 0 0 ' + (isEarned ? '3' : '2') + 'px ' + tc + (isEarned ? ',0 4px 14px rgba(0,0,0,.1)' : '') + '">'
        + b.icon + '</div>'
        + '<div style="font-size:11px;font-weight:800;color:#0b1626;margin-bottom:3px;line-height:1.3">' + b.name + '</div>'
        + '<div style="font-size:9px;color:#94a3b8;line-height:1.4">' + b.desc + '</div>';

      if (isEarned) {
        html += '<div style="font-size:9px;color:#16a34a;font-weight:700;margin-top:5px">✓ ' + earnedDate + '</div>';
      } else if (progress !== null) {
        html += '<div style="margin-top:6px">'
          + '<div style="height:3px;background:#e2e8f0;border-radius:999px;overflow:hidden">'
          + '<div style="height:100%;width:' + Math.min(progress.pct,100) + '%;background:linear-gradient(90deg,#2255a4,#3d7fd4);border-radius:999px"></div>'
          + '</div>'
          + '<div style="font-size:8px;color:#94a3b8;margin-top:2px">' + progress.label + '</div>'
          + '</div>';
      }

      html += '</div>';
    });

    html += '</div></div>';
  });

  container.innerHTML = html;
}

function statBox(val, label, color) {
  return '<div style="flex:1;text-align:center;border-right:1px solid rgba(255,255,255,.08);padding:0 12px">'
    + '<div style="font-size:26px;font-weight:900;color:' + color + ';line-height:1;margin-bottom:3px">' + val + '</div>'
    + '<div style="font-size:9px;color:rgba(255,255,255,.4);font-weight:700;text-transform:uppercase;letter-spacing:1px">' + label + '</div>'
    + '</div>';
}

function getBadgeProgress(b) {
  try {
    var map = {
      'streak_3':    { cur: getCurrentStreak,          max: 3 },
      'streak_7':    { cur: getCurrentStreak,          max: 7 },
      'streak_30':   { cur: getCurrentStreak,          max: 30 },
      'streak_50':   { cur: getCurrentStreak,          max: 50 },
      'streak_100':  { cur: getCurrentStreak,          max: 100 },
      'streak_365':  { cur: getCurrentStreak,          max: 365 },
      'read_10':     { cur: getTotalArticlesRead,       max: 10 },
      'read_50':     { cur: getTotalArticlesRead,       max: 50 },
      'read_100':    { cur: getTotalArticlesRead,       max: 100 },
      'read_500':    { cur: getTotalArticlesRead,       max: 500 },
      'word_10':     { cur: function(){ return lsGet(K_SAVED,[]).length; }, max: 10 },
      'word_50':     { cur: function(){ return lsGet(K_SAVED,[]).length; }, max: 50 },
      'word_100':    { cur: function(){ return lsGet(K_SAVED,[]).length; }, max: 100 },
      'word_300':    { cur: function(){ return lsGet(K_SAVED,[]).length; }, max: 300 },
      'word_1000':   { cur: function(){ return lsGet(K_SAVED,[]).length; }, max: 1000 },
      'word_2000':   { cur: function(){ return lsGet(K_SAVED,[]).length; }, max: 2000 },
      'quiz_perfect3':{ cur: function(){ return lsGet('kh_quiz_perfect_streak',0); }, max: 3 },
      'quiz_14days': { cur: getQuizStreakDays, max: 14 },
      'xp_500':      { cur: getXP, max: 500 },
      'xp_2000':     { cur: getXP, max: 2000 },
      'xp_5000':     { cur: getXP, max: 5000 },
      'xp_20000':    { cur: getXP, max: 20000 },
      'time_morning7':{ cur: function(){ return lsGet('kh_morning_count',0); }, max: 7 },
      'time_monday':  { cur: function(){ return lsGet('kh_monday_streak',0); }, max: 4 },
      'time_friday':  { cur: function(){ return lsGet('kh_friday_night_count',0); }, max: 4 },
      'time_weekend': { cur: function(){ return lsGet('kh_weekend_streak',0); }, max: 8 },
    };
    var section_badge_max = { sec_politics:20,sec_economy:20,sec_society:20,sec_world:20,sec_culture:20,sec_sports:20,sec_korea:20,sec_it:20,sec_opinion:10 };
    var section_badge_sec = { sec_politics:'정치',sec_economy:'경제',sec_society:'사회',sec_world:'국제',sec_culture:'문화',sec_sports:'스포츠',sec_korea:'Korea',sec_it:'IT-과학',sec_opinion:'오피니언' };
    if (section_badge_max[b.id] !== undefined) {
      var sc = getSectionReadCounts();
      var cur = sc[section_badge_sec[b.id]] || 0;
      var max = section_badge_max[b.id];
      return { pct: cur/max*100, label: cur + ' / ' + max };
    }
    if (!map[b.id]) return null;
    var cur = map[b.id].cur();
    var max = map[b.id].max;
    return { pct: cur/max*100, label: cur + ' / ' + max };
  } catch(e) { return null; }
}

// ── 기사 읽을 때 자동으로 섹션 추적 + 시간 추적 + XP + 뱃지 체크 ─────────
async function trackActivityOnArticleRead(section, opts) {
  opts = opts || {};
  checkCulturalDateBadges();
  if (section) trackSectionRead(section);
  // XP는 awardXP()에서만 지급 (addXP 이중지급 제거)
  checkBadges('article_read');
  await dmTrackArticle(opts);
}

// ── 단어 저장 시 XP + 뱃지 ──────────────────────────────────────────────────
async function trackActivityOnWordSave() {
  // XP는 awardXP()에서만 지급 (addXP 이중지급 제거)
  checkBadges('word_saved');
  await dmTrackWord();
}

// ── 퀴즈 완료 시 XP + 뱃지 ──────────────────────────────────────────────────
async function trackActivityOnQuizComplete(pct) {
  var isPerfect = pct === 100;
  // XP는 awardXP()에서만 지급 (addXP 이중지급 제거)

  // 퀴즈 완료 횟수
  var done = lsGet('kh_quiz_done_count', 0);
  lsSet('kh_quiz_done_count', done + 1);
  lsSet('kh_last_quiz_pct', pct);

  // 100점 카운트
  if (isPerfect) {
    var pc = lsGet('kh_quiz_perfect_count', 0);
    lsSet('kh_quiz_perfect_count', pc + 1);
    var ps = lsGet('kh_quiz_perfect_streak', 0);
    lsSet('kh_quiz_perfect_streak', ps + 1);
  } else {
    lsSet('kh_quiz_perfect_streak', 0); // 스트릭 리셋
  }

  // 퀴즈 연속 날짜 (데일리 개근)
  var today = new Date(Date.now() + 9*60*60*1000).toISOString().slice(0,10); // KST
  var lastQuizDay = lsGet('kh_last_quiz_day', '');
  var yesterday = new Date(Date.now() + 9*60*60*1000 - 86400000).toISOString().slice(0,10); // KST
  if (lastQuizDay === yesterday) {
    lsSet('kh_quiz_streak_days', lsGet('kh_quiz_streak_days',0) + 1);
  } else if (lastQuizDay !== today) {
    lsSet('kh_quiz_streak_days', 1);
  }
  lsSet('kh_last_quiz_day', today);

  checkBadges('quiz_complete');
  await dmTrackQuiz();
}
// ══ END BADGE ENGINE ══════════════════════════════════════════════════════════

// ══ TTS ENGINE (Web Speech API) ═══════════════════════════════════════════════
var _ttsVoices = [];
var _ttsCurrent = null;

function ttsInit() {
  if (!window.speechSynthesis) return;
  function load() {
    _ttsVoices = window.speechSynthesis.getVoices().filter(function(v){ return v.lang.startsWith('ko'); });
  }
  load();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = load;
  }
  setTimeout(load, 400);
}

function ttsSpeak(text, btnEl) {
  if (!window.speechSynthesis) return;
  var synth = window.speechSynthesis;

  // 같은 버튼 다시 누르면 중지
  if (_ttsCurrent && _ttsCurrent === btnEl) {
    synth.cancel();
    _ttsReset();
    return;
  }

  synth.cancel();
  _ttsReset();

  var utter = new SpeechSynthesisUtterance(text);
  utter.lang  = 'ko-KR';
  utter.rate  = 0.9;
  utter.pitch = 1.0;
  if (_ttsVoices.length) utter.voice = _ttsVoices[0];

  if (btnEl) {
    _ttsCurrent = btnEl;
    btnEl.classList.add('tts-playing');
    btnEl.textContent = '■';
  }

  utter.onend   = _ttsReset;
  utter.onerror = _ttsReset;
  synth.speak(utter);
}

function _ttsReset() {
  if (_ttsCurrent) {
    _ttsCurrent.classList.remove('tts-playing');
    _ttsCurrent.textContent = '🔊';
    _ttsCurrent = null;
  }
}

// TTS 버튼 HTML 생성 헬퍼
function ttsBtn(text) {
  var safe = text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
  return '<button class="tts-btn" title="Listen to pronunciation" onclick="event.stopPropagation();ttsSpeak(\'' + safe + '\',this)">🔊</button>';
}

// ══ USER STATS + DAILY MISSION SYNC (Supabase) ════════════════════════════════

async function syncUserStats(patch) {
  if (!supaUser) return;
  var sb = getSupa(); if (!sb) return;
  try {
    var res = await sb.from('user_stats').select('*').eq('user_id', supaUser.id).maybeSingle();
    var cur = res.data || {
      user_id: supaUser.id, email: supaUser.email,
      display_name: localStorage.getItem('kh_display_name') || supaUser.email.split('@')[0],
      xp:0, streak:0, articles_read:0, words_saved:0,
      quizzes_done:0, fill_done:0, mission_streak:0,
      last_mission_date:'', writing_tickets:0
    };
    var updated = Object.assign({}, cur, {
      user_id: supaUser.id, email: supaUser.email,
      display_name: localStorage.getItem('kh_display_name') || cur.display_name,
      updated_at: new Date().toISOString()
    });
    if (patch.articles_read) updated.articles_read = (cur.articles_read||0) + 1;
    if (patch.words_saved)   updated.words_saved   = (cur.words_saved||0) + 1;
    if (patch.quizzes_done)  updated.quizzes_done  = (cur.quizzes_done||0) + 1;
    if (patch.fill_done)     updated.fill_done     = (cur.fill_done||0) + 1;
    if (patch.xp)            updated.xp            = (cur.xp||0) + patch.xp;
    await sb.from('user_stats').upsert(updated, { onConflict: 'user_id' });
  } catch(e) { console.warn('syncUserStats', e); }
}

async function syncDailyMission(field) {
  if (!supaUser) return;
  var sb = getSupa(); if (!sb) return;
  var today = dmToday();
  try {
    var res = await sb.from('daily_missions')
      .select('*').eq('user_id', supaUser.id).eq('date', today).maybeSingle();
    var cur = res.data || {
      user_id: supaUser.id, date: today,
      articles:0, words:0, quizzes:0, fill:0, completed:false
    };
    cur[field] = (cur[field]||0) + 1;

    var wasCompleted = cur.completed;
    cur.completed = cur.articles >= 3 && cur.words >= 20 && cur.quizzes >= 3 && cur.fill >= 1;

    await sb.from('daily_missions').upsert(cur, { onConflict: 'user_id,date' });

    // 처음으로 완료된 순간 → 미션 스트릭 + 첨삭권 체크
    if (!wasCompleted && cur.completed) {
      await onDailyMissionComplete();
    }
  } catch(e) { console.warn('syncDailyMission', e); }
}

async function onDailyMissionComplete() {
  if (!supaUser) return;
  var sb = getSupa(); if (!sb) return;
  try {
    var res = await sb.from('user_stats').select('*').eq('user_id', supaUser.id).maybeSingle();
    var cur = res.data || { mission_streak:0, last_mission_date:'', writing_tickets:0 };
    var today = dmToday();
    var yesterday = new Date(Date.now() + 9*60*60*1000 - 86400000).toISOString().slice(0,10); // KST

    // 연속 완료 계산
    var newStreak = (cur.last_mission_date === yesterday) ? (cur.mission_streak||0) + 1 : 1;
    var newTickets = cur.writing_tickets || 0;

    // 5회 연속마다 첨삭권 1개
    var prevStreak = cur.mission_streak || 0;
    if (Math.floor(newStreak / 5) > Math.floor(prevStreak / 5)) {
      newTickets += 1;
      setTimeout(function() {
        toast('🎉 Daily mission ' + newStreak + '-day streak! Writing review ticket earned!');
      }, 800);
    } else {
      setTimeout(function() {
        toast('🎯 Daily mission complete! ' + newStreak + '-day streak 🔥');
      }, 800);
    }

    await sb.from('user_stats').upsert({
      user_id: supaUser.id,
      mission_streak: newStreak,
      last_mission_date: today,
      writing_tickets: newTickets,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  } catch(e) { console.warn('onDailyMissionComplete', e); }
}

async function syncArticleView(articleId, title, section) {
  if (!supaUser) return;
  var sb = getSupa(); if (!sb) return;
  try {
    var res = await sb.from('article_views').select('view_count').eq('article_id', String(articleId)).maybeSingle();
    var count = res.data ? (res.data.view_count || 0) + 1 : 1;
    await sb.from('article_views').upsert({
      article_id: String(articleId), title: title, section: section,
      view_count: count, updated_at: new Date().toISOString()
    }, { onConflict: 'article_id' });
  } catch(e) {}
}

// ══ END USER STATS SYNC ════════════════════════════════════════════════════════

// ══ DAILY MISSION ENGINE ══════════════════════════════════════════════════════
function dmToday() { var d = new Date(Date.now() + 9*60*60*1000); return d.toISOString().slice(0,10); }
function dmXPFromData(d) {
  d = d || {};
  return ((d.articles||0) * 10) + ((d.words||0) * 2) + ((d.quizzes||0) * 5) + ((d.fill||0) * 5);
}
function markStudyActivityToday(kind) {
  var key = dmToday();
  var log = lsGet('kh_study_log', {});
  var cur = log[key] || { articles:0, words:0, quiz:0, fill:0 };
  if (kind === 'articles') cur.articles = (cur.articles||0) + 1;
  if (kind === 'words')    cur.words    = (cur.words||0) + 1;
  if (kind === 'quiz')     cur.quiz     = (cur.quiz||0) + 1;
  if (kind === 'fill')     cur.fill     = Math.min((cur.fill||0) + 1, 1);
  log[key] = cur;
  lsSet('kh_study_log', log);
  var days = lsGet('kh_study_days', {});
  days[key] = true;
  lsSet('kh_study_days', days);
}
function computeStreakFromDateKeys(keys) {
  var seen = Object.create(null);
  (keys || []).forEach(function(key){ if (key) seen[key] = true; });
  var streak = 0;
  var d = new Date(Date.now() + 9*60*60*1000);
  for (var i = 0; i < 400; i++) {
    var key = d.toISOString().slice(0,10);
    if (seen[key]) { streak++; d.setDate(d.getDate()-1); }
    else if (i === 0) { d.setDate(d.getDate()-1); }
    else break;
  }
  return streak;
}
async function fetchActivityStreakFromDB(sb, userId) {
  if (!sb || !userId) return 0;
  try {
    var since = new Date(Date.now() - 120*86400000).toISOString().slice(0,10);
    var res = await sb.from('daily_missions')
      .select('date, articles, words, quizzes, fill')
      .eq('user_id', userId)
      .gte('date', since)
      .order('date', { ascending: false })
      .limit(120);
    var keys = (res.data || []).filter(function(row){
      return ((row.articles||0) + (row.words||0) + (row.quizzes||0) + (row.fill||0)) > 0;
    }).map(function(row){ return row.date; });
    var streak = computeStreakFromDateKeys(keys);
    if (streak > 0) lsSet('kh_synced_activity_streak', streak);
    return streak;
  } catch(e) {
    return 0;
  }
}

// ── Sync user preferences to DB (best-effort, non-blocking) ──
function _syncPrefsToDB() {
  if (!supaUser) return;
  var sb = getSupa(); if (!sb) return;
  var prefs = {
    diff: _activeDiff || 'all',
    neon: isKhNeonEnabled()
  };
  sb.from('user_stats').update({ preferences: prefs }).eq('user_id', supaUser.id)
    .then(function(r) { if (r.error) console.warn('prefs sync:', r.error.message); })
    .catch(function() {});
}

// ── Cross-device rehydration: restore XP + daily mission from DB on login ──
async function _rehydrateUserState() {
  if (!supaUser) return;
  var sb = getSupa(); if (!sb) return;
  try {
    // 1) XP + stats from user_stats
    var statsRes = await sb.from('user_stats').select('xp, coin_balance, streak, mission_streak, articles_read, words_saved, quizzes_done, fill_done, display_name')
      .eq('user_id', supaUser.id).maybeSingle();
    if (statsRes.data) {
      var s = statsRes.data;
      var localXP = lsGet(K_XP, 0);
      if (s.xp > localXP) lsSet(K_XP, s.xp);
      if (s.display_name) localStorage.setItem('kh_display_name', s.display_name);
    }
  } catch(e) { console.warn('rehydrate stats:', e); }
  try {
    // 2) Today's daily mission from daily_missions
    var today = dmToday();
    var dmRes = await sb.from('daily_missions').select('articles, words, quizzes, fill, completed')
      .eq('user_id', supaUser.id).eq('date', today).maybeSingle();
    if (dmRes.data) {
      var dbDm = dmRes.data;
      var localDm = lsGet('kh_daily_' + today, { articles:0, words:0, quizzes:0, fill:0 });
      // Take the max of local vs DB for each field (handles partial sync)
      var merged = {
        articles: Math.max(localDm.articles||0, dbDm.articles||0),
        words:    Math.max(localDm.words||0,    dbDm.words||0),
        quizzes:  Math.max(localDm.quizzes||0,  dbDm.quizzes||0),
        fill:     Math.max(localDm.fill||0,     dbDm.fill||0)
      };
      lsSet('kh_daily_' + today, merged);
      renderDailyMission();
    }
  } catch(e) { console.warn('rehydrate daily mission:', e); }
  try {
    // 3) User preferences (difficulty, neon theme) from user_stats
    var prefRes = await sb.from('user_stats').select('*').eq('user_id', supaUser.id).maybeSingle();
    if (prefRes.data && prefRes.data.preferences) {
      var prefs = prefRes.data.preferences;
      if (typeof prefs === 'string') try { prefs = JSON.parse(prefs); } catch(e) { prefs = {}; }
      if (prefs.diff && !localStorage.getItem('kh_diff')) khSetDiff(prefs.diff);
      if (prefs.neon !== undefined && !localStorage.getItem(K_NEON_THEME)) {
        localStorage.setItem(K_NEON_THEME, prefs.neon ? '1' : '0');
        applyKhNeon(!!prefs.neon);
      }
    }
  } catch(e) { /* preferences column may not exist yet — ignore */ }
}

function dmGet() {
  var key = 'kh_daily_' + dmToday();
  return lsGet(key, { articles:0, words:0, quizzes:0, fill:0 });
}

function dmSet(data) {
  var key = 'kh_daily_' + dmToday();
  lsSet(key, data);
  renderDailyMission(); // 위젯 즉시 업데이트
}

async function dmTrackArticle(opts) {
  opts = opts || {};
  var d = dmGet(); d.articles = (d.articles||0) + 1; dmSet(d);
  markStudyActivityToday('articles');
  if (supaUser) {
    await syncDailyMission('articles');
    await syncUserStats({ articles_read: true });
  }
  if (opts.grantXP !== false) awardXP('article_read', { source: 'article', content_id: opts.content_id || opts.articleId || null });
  checkDailyMissionComplete();
}

async function dmTrackWord() {
  var d = dmGet(); d.words = (d.words||0) + 1; dmSet(d);
  markStudyActivityToday('words');
  if (supaUser) {
    await syncDailyMission('words');
    await syncUserStats({ words_saved: true });
  }
  awardXP('word_save', {});
  checkDailyMissionComplete();
}

async function dmTrackQuiz() {
  var d = dmGet(); d.quizzes = (d.quizzes||0) + 1; dmSet(d);
  markStudyActivityToday('quiz');
  if (supaUser) {
    await syncDailyMission('quizzes');
    await syncUserStats({ quizzes_done: true });
  }
  awardXP('conv_quiz_complete', {});
  checkDailyMissionComplete();
}

async function dmTrackFill() {
  var d = dmGet(); d.fill = Math.min((d.fill||0) + 1, 1); dmSet(d);
  markStudyActivityToday('fill');
  if (supaUser) {
    await syncDailyMission('fill');
    await syncUserStats({ fill_done: true });
  }
  awardXP('fill_complete', {});
  checkDailyMissionComplete();
}

var _dailyMissionBonusGiven = false;
async function checkDailyMissionComplete() {
  if (_dailyMissionBonusGiven) return;
  var d = dmGet();
  if ((d.articles||0) >= 3 && (d.words||0) >= 20 && (d.quizzes||0) >= 3 && (d.fill||0) >= 1) {
    _dailyMissionBonusGiven = true;
    var res = await awardXP('daily_mission_complete', {});
    if (res && res.ok) showToast('🎯 Daily mission complete! +50 XP bonus');
  }
}

var _dmCollapsed = localStorage.getItem('kh_dm_collapsed') === '1';

function renderDailyMission() {
  var widget = document.getElementById('kh-daily-mission');
  if (!widget) return;
  if (!supaUser) { widget.style.display = 'none'; return; }
  widget.style.display = 'block';

  var d = dmGet();
  var missions = [
    { id:'articles', icon:'📰', label:'Read Articles', cur:d.articles||0, goal:3,  color:'#3d7fd4' },
    { id:'words',    icon:'🔖', label:'Save Words',    cur:d.words||0,    goal:20, color:'#8b5cf6' },
    { id:'quizzes',  icon:'📝', label:'Take Quiz',     cur:d.quizzes||0,  goal:3,  color:'#f59e0b' },
    { id:'fill',     icon:'✏️', label:'Fill-in-Blank', cur:d.fill||0,     goal:1,  color:'#10b981' },
  ];

  var totalXP = 0;
  var allDone = true;
  missions.forEach(function(m) {
    var earned = Math.min(m.cur, m.goal);
    var xpMap = { articles:10, words:5, quizzes:20, fill:15 };
    totalXP += earned * (xpMap[m.id] || 10);
    if (m.cur < m.goal) allDone = false;
  });

  var today = new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', weekday:'short' });

  var itemsHTML = missions.map(function(m) {
    var cur = Math.min(m.cur, m.goal);
    var pct = Math.round(cur / m.goal * 100);
    var done = cur >= m.goal;
    return '<div class="dm-item">'
      + '<div class="dm-item-hd">'
      + '<div class="dm-item-left"><span class="dm-item-icon">' + m.icon + '</span>'
      + '<span class="dm-item-label">' + m.label + '</span></div>'
      + '<span class="dm-item-count' + (done?' dm-done':'') + '">' + (done?'✓':cur+'/'+m.goal) + '</span>'
      + '</div>'
      + '<div class="dm-bar-bg"><div class="dm-bar-fill" style="width:'+pct+'%;background:'+(done?'#4ade80':m.color)+'"></div></div>'
      + '</div>';
  }).join('');

  widget.innerHTML = _dmCollapsed
    ? '<button class="dm-pill" onclick="dmToggle()">🎯 Daily Mission</button>'
    : '<div class="dm-inner">'
      + '<div class="dm-hd">'
      + '<span style="font-size:16px">🎯</span>'
      + '<span class="dm-title">Daily Mission</span>'
      + '<button class="dm-close" onclick="dmToggle()">✕</button>'
      + '</div>'
      + '<div class="dm-date">' + today + '</div>'
      + itemsHTML
      + '<div class="dm-divider"></div>'
      + '<div class="dm-xp-row">'
      + '<span class="dm-xp-label">Today\'s XP</span>'
      + '<span class="dm-xp-val">+' + totalXP + ' XP</span>'
      + '</div>'
      + (allDone ? '<div class="dm-complete">🎉 All done!</div>' : '')
      + '</div>';
}

function dmToggle() {
  _dmCollapsed = !_dmCollapsed;
  localStorage.setItem('kh_dm_collapsed', _dmCollapsed ? '1' : '0');
  renderDailyMission();
}

function injectDailyMission() {
  if (document.getElementById('kh-daily-mission')) return;
  var el = document.createElement('div');
  el.id = 'kh-daily-mission';
  el.style.display = 'none';
  document.body.appendChild(el);
  renderDailyMission();
}
// ══ END DAILY MISSION ENGINE ════════════════════════════════════════════════

// ══ END TTS ENGINE ═════════════════════════════════════════════════════════════


// ══ MOBILE SIDEBAR ══════════════════════════════════════════════════════════

function khInjectSidebar() {
  if (document.getElementById('kh-mobile-sidebar')) return;

  // CSS
  var style = document.createElement('style');
  style.textContent = [
    '.kh-ham{display:none;background:none;border:none;font-size:22px;cursor:pointer;color:var(--text,#0d1b2e);padding:4px 8px;flex-shrink:0;line-height:1;position:relative;z-index:50;-webkit-tap-highlight-color:transparent;}',
    '.kh-sb-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1500;}',
    '.kh-sb-overlay.on{display:block;}',
    '.kh-sidebar{position:fixed;top:0;left:0;bottom:0;width:268px;background:#0b1626;z-index:1600;transform:translateX(-100%);transition:transform .25s cubic-bezier(.4,0,.2,1);overflow-y:auto;display:flex;flex-direction:column;}',
    '.kh-sidebar.on{transform:translateX(0);}',
    '.kh-sb-top{padding:16px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}',
    '.kh-sb-brand{display:flex;align-items:baseline;gap:4px;}',
    ".kh-sb-brand .sb-kore{font-family:\'Playfair Display\',serif;font-size:20px;font-weight:900;color:#7ab8f5;}",
    ".kh-sb-brand .sb-han{font-family:\'Playfair Display\',serif;font-size:20px;font-weight:900;color:#fff;}",
    ".kh-sb-brand .sb-news{font-size:13px;font-weight:600;color:rgba(255,255,255,.5);margin-left:3px;}",
    '.kh-sb-x{background:none;border:none;color:rgba(255,255,255,.5);font-size:22px;cursor:pointer;line-height:1;padding:0;}',
    '.kh-sb-sec{padding:14px 12px 6px;}',
    '.kh-sb-lbl{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.4px;color:rgba(255,255,255,.25);padding:0 6px;margin-bottom:4px;}',
    '.kh-sb-a{display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:6px;font-size:13px;font-weight:500;color:rgba(255,255,255,.65);cursor:pointer;border:none;background:none;width:100%;text-align:left;font-family:inherit;transition:all .13s;text-decoration:none;}',
    '.kh-sb-a:hover,.kh-sb-a.on{background:rgba(255,255,255,.08);color:#fff;}',
    '.kh-sb-ico{font-size:15px;width:20px;text-align:center;flex-shrink:0;}',
    '.kh-sb-new{margin-left:auto;background:#e53e3e;color:#fff;font-size:9px;font-weight:800;padding:1px 6px;border-radius:2px;flex-shrink:0;}',
    '.kh-sb-arrow{margin-left:auto;font-size:11px;color:rgba(255,255,255,.25);transition:transform .18s;flex-shrink:0;}',
    '.kh-sb-arrow.on{transform:rotate(90deg);}',
    '.kh-sb-sub{display:none;padding-left:10px;}',
    '.kh-sb-sub.on{display:block;}',
    '.kh-sb-sub-a{display:block;width:100%;padding:7px 10px;font-size:12px;color:rgba(255,255,255,.5);border:none;background:none;text-align:left;font-family:inherit;cursor:pointer;border-radius:5px;transition:all .12s;text-decoration:none;}',
    '.kh-sb-sub-a:hover{color:#fff;background:rgba(255,255,255,.05);}',
    '@media(max-width:900px){.kh-ham{display:flex !important;align-items:center;position:relative;z-index:50;}.kh-topnav{display:none !important;}.kh-nav{display:none !important;}}'
  ].join('');
  document.head.appendChild(style);

  // Overlay
  var ov = document.createElement('div');
  ov.id = 'kh-sb-overlay';
  ov.className = 'kh-sb-overlay';
  ov.onclick = khSbClose;
  document.body.appendChild(ov);

  // Sidebar
  var page = window.location.pathname.split('/').pop() || 'index.html';
  var sb = document.createElement('nav');
  sb.id = 'kh-mobile-sidebar';
  sb.className = 'kh-sidebar';
  sb.innerHTML =
    '<div class="kh-sb-top">'
      + '<div class="kh-sb-brand"><span class="sb-kore">Kore</span><span class="sb-han">Han</span><span class="sb-news">News</span></div>'
      + '<button class="kh-sb-x" onclick="khSbClose()">&#x2715;</button>'
    + '</div>'
    + '<div class="kh-sb-sec">'
      + '<div class="kh-sb-lbl">Navigation</div>'
      + '<a href="index.html" class="kh-sb-a' + (page==='index.html'?' on':'') + '"><span class="kh-sb-ico">&#x1F3E0;</span>Home</a>'
    + '</div>'
    + '<div class="kh-sb-sec">'
      + '<div class="kh-sb-lbl">Read</div>'
      + '<button class="kh-sb-a" onclick=\"khSbToggle(\'sb-news\',\'sb-arr-news\')\"><span class="kh-sb-ico">&#x1F4F0;</span>News<span class="kh-sb-arrow" id="sb-arr-news">&#x203A;</span></button>'
      + '<div class="kh-sb-sub" id="sb-news">'
        + '<a href="korehan-all.html" class="kh-sb-sub-a">All News</a>'
        + '<a href="korehan-society.html" class="kh-sb-sub-a">&#x1F3DB;&#xFE0F; Society</a>'
        + '<a href="korehan-world.html" class="kh-sb-sub-a">&#x1F310; World</a>'
        + '<a href="korehan-culture.html" class="kh-sb-sub-a">&#x1F3AD; Culture</a>'
        + '<a href="korehan-section.html?s=kpop" class="kh-sb-sub-a">&#x1F3B5; K-pop</a>'
        + '<a href="korehan-section.html?s=beauty" class="kh-sb-sub-a">&#x1F484; Beauty</a>'
        + '<a href="korehan-section.html?s=travel" class="kh-sb-sub-a">&#x2708;&#xFE0F; Travel</a>'
        + '<a href="korehan-korea.html" class="kh-sb-sub-a">&#x1F1F0;&#x1F1F7; Korea</a>'
      + '</div>'
      + '<button class="kh-sb-a" onclick=\"khSbToggle(\'sb-conv\',\'sb-arr-conv\')\"><span class="kh-sb-ico">&#x1F4AC;</span>Conversations<span class="kh-sb-new">New</span><span class="kh-sb-arrow" id="sb-arr-conv" style="margin-left:4px">&#x203A;</span></button>'
      + '<div class="kh-sb-sub" id="sb-conv">'
        + '<a href="korehan-conversations.html" class="kh-sb-sub-a">All</a>'
        + '<a href="korehan-conversations.html?cat=everyday" class="kh-sb-sub-a">Everyday</a>'
        + '<a href="korehan-conversations.html?cat=work" class="kh-sb-sub-a">Workplace</a>'
        + '<a href="korehan-conversations.html?cat=friends" class="kh-sb-sub-a">Friends</a>'
        + '<a href="korehan-conversations.html?cat=dating" class="kh-sb-sub-a">Dating</a>'
      + '</div>'
      + '<button class="kh-sb-a" onclick=\"khSbToggle(\'sb-stor\',\'sb-arr-stor\')\"><span class="kh-sb-ico">&#x1F4D6;</span>Stories<span class="kh-sb-new">New</span><span class="kh-sb-arrow" id="sb-arr-stor" style="margin-left:4px">&#x203A;</span></button>'
      + '<div class="kh-sb-sub" id="sb-stor">'
        + '<a href="korehan-stories.html" class="kh-sb-sub-a">All</a>'
        + '<a href="korehan-stories.html?mood=fun" class="kh-sb-sub-a">&#x1F602; Fun</a>'
        + '<a href="korehan-stories.html?mood=touching" class="kh-sb-sub-a">&#x1F979; Touching</a>'
        + '<a href="korehan-stories.html?mood=scary" class="kh-sb-sub-a">&#x1F631; Scary</a>'
        + '<a href="korehan-stories.html?mood=shocking" class="kh-sb-sub-a">&#x1F62E; Shocking</a>'
      + '</div>'
    + '</div>'
    + '<div class="kh-sb-sec">'
      + '<div class="kh-sb-lbl">Learn</div>'
      + '<a href="korehan-study-room.html" class="kh-sb-a' + (page==='korehan-study-room.html'?' on':'') + '"><span class="kh-sb-ico">&#x1F4D6;</span>Study Room</a>'
      + '<a href="korehan-shop.html" class="kh-sb-a' + (page==='korehan-shop.html'?' on':'') + '"><span class="kh-sb-ico">&#x1F6D2;</span>Shop</a>'
      + '<a href="korehan-fun.html" class="kh-sb-a' + (page==='korehan-fun.html'?' on':'') + '"><span class="kh-sb-ico">🎮</span>Playground</a>'
      + '<a href="korehan-learning-overview.html" class="kh-sb-a' + (page==='korehan-learning-overview.html'?' on':'') + '"><span class="kh-sb-ico">&#x1F4CA;</span>Growth Lab</a>'
      + '<a href="korehan-courses.html" class="kh-sb-a' + (page==='korehan-courses.html'?' on':'') + '"><span class="kh-sb-ico">&#x1F393;</span>Courses</a>'
    + '</div>'
    + '<div class="kh-sb-sec" id="kh-sb-auth-sec" style="margin-top:auto;padding-top:12px;border-top:1px solid rgba(255,255,255,.08);position:sticky;bottom:0;background:#0b1626;box-shadow:0 -10px 24px rgba(0,0,0,.18)">'
      + '<div id="kh-sb-auth-row"></div>'
    + '</div>';
  document.body.appendChild(sb);
  updateSidebarAuth();
}

function updateSidebarAuth() {
  var row = document.getElementById('kh-sb-auth-row');
  if (!row) return;
  if (supaUser) {
    var name = (supaUser.user_metadata && supaUser.user_metadata.full_name) || supaUser.email.split('@')[0];
    row.innerHTML =
      '<button id="kh-sb-neon-toggle" class="kh-sb-a" onclick="toggleKhNeon(event)" style="width:100%;text-align:left;background:none;border:none;cursor:pointer;font-family:inherit">'
      + '<span class="kh-sb-ico">&#9889;</span>Neon theme: OFF</button>'
      + '<div style="padding:10px 16px;font-size:13px;color:var(--gray,#445566)">'
      + '<div style="font-weight:800;color:var(--dark,#0d1b2e);margin-bottom:2px">' + name + '</div>'
      + '<div style="font-size:11px;opacity:.6">' + supaUser.email + '</div>'
      + '</div>'
      + '<a href="korehan-mypage.html" class="kh-sb-a" onclick="khSbClose()">'
      + '<span class="kh-sb-ico">&#x1F464;</span>My Page</a>'
      + '<button class="kh-sb-a" onclick="signOut();khSbClose()" style="width:100%;text-align:left;background:none;border:none;cursor:pointer;font-family:inherit">'
      + '<span class="kh-sb-ico">&#x1F6AA;</span>Sign Out</button>';
  } else {
    row.innerHTML =
      '<button id="kh-sb-neon-toggle" class="kh-sb-a" onclick="toggleKhNeon(event)" style="width:100%;text-align:left;background:none;border:none;cursor:pointer;font-family:inherit">'
      + '<span class="kh-sb-ico">&#9889;</span>Neon theme: OFF</button>'
      + '<button class="kh-sb-a" onclick="openAuthModal(\'signin\');khSbClose()" style="width:100%;text-align:left;background:none;border:none;cursor:pointer;font-family:inherit">'
      + '<span class="kh-sb-ico">&#x1F511;</span>Sign In</button>'
      + '<button class="kh-sb-a" onclick="openAuthModal(\'signup\');khSbClose()" style="width:100%;text-align:left;background:none;border:none;cursor:pointer;font-family:inherit;color:var(--bright,#2255a4);font-weight:800">'
      + '<span class="kh-sb-ico">&#x2728;</span>Join Free</button>';
  }
  syncNeonToggleButtons();
}

function khSbOpen() {
  khInjectSidebar();
  document.getElementById('kh-mobile-sidebar').classList.add('on');
  document.getElementById('kh-sb-overlay').classList.add('on');
  document.body.style.overflow = 'hidden';
}
function khSbClose() {
  var sb = document.getElementById('kh-mobile-sidebar');
  var ov = document.getElementById('kh-sb-overlay');
  if (sb) sb.classList.remove('on');
  if (ov) ov.classList.remove('on');
  document.body.style.overflow = '';
}
function khSbToggle(subId, arrId) {
  var s = document.getElementById(subId);
  var a = document.getElementById(arrId);
  if (!s) return;
  var open = s.classList.contains('on');
  document.querySelectorAll('.kh-sb-sub').forEach(function(x){ x.classList.remove('on'); });
  document.querySelectorAll('.kh-sb-arrow').forEach(function(x){ x.classList.remove('on'); });
  if (!open) { s.classList.add('on'); if(a) a.classList.add('on'); }
}

// 사이드바 초기화 — renderHeader 이후 자동 실행
(function() {
  })();

// ══ END MOBILE SIDEBAR ══════════════════════════════════════════════════════

/* ===== Mobile redesign patch v3 ===== */


function getHomeLearningSnapshot() {
  var stats = {
    streak: 0,
    words: 0,
    articles: 0,
    quizzes: 0,
    xp: 0,
    weakGrammar: '-아/어서 vs -고',
    weakCount: 8
  };
  try {
    stats.streak = getCurrentStreak ? getCurrentStreak() : 0;
  } catch(e) {}
  try {
    var dm = dmGet ? dmGet() : { words:0, articles:0, quizzes:0 };
    stats.words = dm.words || 0;
    stats.articles = dm.articles || 0;
    stats.quizzes = dm.quizzes || 0;
  } catch(e) {}
  try { stats.xp = getXP ? getXP() : 0; } catch(e) {}
  try {
    var weak = lsGet('kh_weak_grammar', null);
    if (weak && weak.name) {
      stats.weakGrammar = weak.name;
      stats.weakCount = weak.missed || stats.weakCount;
    }
  } catch(e) {}
  return stats;
}

async function fetchUserStatsRow() {
  if (!supaUser) return null;
  try {
    var sb = getSupa();
    if (!sb) return null;
    var res = await sb.from('user_stats').select('*').eq('user_id', supaUser.id).maybeSingle();
    return res.data || null;
  } catch(e) {
    return null;
  }
}

function getLocalWeakGrammarItems(limit) {
  var items = [];
  try {
    var raw = localStorage.getItem('kh_quiz_grammar_stats');
    if (raw) {
      var obj = JSON.parse(raw);
      Object.keys(obj).forEach(function(k) {
        var v = obj[k] || {};
        if ((v.wrong || 0) > 0) {
          items.push({
            grammar_point: k,
            wrong_count: v.wrong || 0,
            correct_count: v.correct || 0
          });
        }
      });
      items.sort(function(a, b) { return (b.wrong_count || 0) - (a.wrong_count || 0); });
    }
  } catch(e) {}
  return typeof limit === 'number' ? items.slice(0, limit) : items;
}

async function getUnifiedWeakGrammarItems(limit) {
  var localItems = getLocalWeakGrammarItems(limit);
  var sb = getSupa();
  if (!(sb && supaUser)) return localItems;

  try {
    var res = await sb.from('user_grammar_stats')
      .select('grammar_point,wrong_count,correct_count')
      .eq('user_id', supaUser.id)
      .gt('wrong_count', 0)
      .order('wrong_count', { ascending: false })
      .limit(limit || 5);
    if (res.data && res.data.length) return res.data;
  } catch(e) {}
  return localItems;
}

async function renderHomeLearningPreview() {
  var box = document.getElementById('home-learning-preview');
  if (!box) return;
  var showWelcomeTip = false;
  try {
    var welcomeTipKey = getWelcomeTipStorageKey(supaUser && supaUser.id);
    showWelcomeTip = window.location.search.indexOf('welcome=1') > -1 || localStorage.getItem(welcomeTipKey) === '1';
  } catch(e) {}

  // Not signed in
  if (!supaUser) {
    box.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">'
      + '<div style="font-size:15px;font-weight:900;color:#fff;line-height:1.25">New to Korean? <span style="color:#7dd3fc">Start here.</span></div>'
      + '<div style="font-size:10px;font-weight:800;padding:4px 10px;border-radius:999px;background:rgba(125,211,252,.14);border:1px solid rgba(125,211,252,.22);color:#bfdbfe;white-space:nowrap">Free to start</div>'
      + '</div>'
      + '<div style="font-size:14px;color:rgba(255,255,255,.72);line-height:1.65;margin-bottom:14px;">Pick an article, hover words to save them, then open Study Room for a focused review. Your progress tracks automatically once you sign up.</div>'
      + '<a href="beginner-guide.html" style="display:inline-flex;align-items:center;gap:6px;padding:10px 16px;background:linear-gradient(135deg,#38bdf8,#2563eb);color:#fff;border-radius:10px;font-size:13px;font-weight:900;text-decoration:none;box-shadow:0 10px 22px rgba(37,99,235,.28);">Open Beginner Guide →</a>';
    return;
  }

  if (showWelcomeTip) {
    box.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap">'
      + '<div style="font-size:13px;font-weight:900;color:#fff">New here? Start with the Beginner Guide.</div>'
      + '<div style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:rgba(125,211,252,.18);color:#dbeafe">Tip for first session</div>'
      + '</div>'
      + '<div style="font-size:12px;color:rgba(255,255,255,.74);line-height:1.6;margin-bottom:12px">Read one article, open Study Room, then check Growth Lab. The Beginner Guide maps the full flow for your first session.</div>'
      + '<a href="beginner-guide.html" style="display:inline-flex;align-items:center;justify-content:center;padding:11px 16px;border-radius:12px;background:linear-gradient(135deg,#38bdf8,#2563eb);color:#fff;font-size:12px;font-weight:900;text-decoration:none;box-shadow:0 12px 22px rgba(37,99,235,.26);animation:khGuidePulse 1.8s ease-in-out infinite">Open Beginner Guide →</a>'
      + '<style>@keyframes khGuidePulse{0%,100%{transform:translateY(0);box-shadow:0 12px 22px rgba(37,99,235,.26)}50%{transform:translateY(-1px);box-shadow:0 16px 28px rgba(56,189,248,.34)}}</style>';
    try { localStorage.removeItem(getWelcomeTipStorageKey(supaUser && supaUser.id)); } catch(e) {}
    return;
  }

  // localStorage 기반 즉시 표시 (빠른 렌더)
  var dm = dmGet ? dmGet() : {};
  var xp = dmXPFromData(dm);
  var streak = getCurrentStreak ? getCurrentStreak() : 0;

  // weak grammar — DB 우선, localStorage fallback
  var weakGrammar = '-아/어서 vs -고';
  var weakCount = 0;
  var weakItems = await getUnifiedWeakGrammarItems(1);
  if (weakItems.length) {
    weakGrammar = weakItems[0].grammar_point;
    weakCount   = weakItems[0].wrong_count || 0;
  }

  // DB에서 최신 데이터 비동기로 보강
  var sb = getSupa();
  if (sb && supaUser) {
    try {
      var dmRes = await sb.from('daily_missions')
        .select('articles,words,quizzes,fill')
        .eq('user_id', supaUser.id)
        .eq('date', dmToday())
        .maybeSingle();
      if (dmRes.data) {
        dm.articles = Math.max(dm.articles || 0, dmRes.data.articles || 0);
        dm.words    = Math.max(dm.words    || 0, dmRes.data.words    || 0);
        dm.quizzes  = Math.max(dm.quizzes  || 0, dmRes.data.quizzes  || 0);
        dm.fill     = Math.max(dm.fill     || 0, dmRes.data.fill     || 0);
        xp = dmXPFromData(dm);
        dmSet(dm);
      }
      // user_stats
      var statsRes = await sb.from('user_stats').select('xp,mission_streak,streak,articles_read,words_saved,quizzes_done').eq('user_id', supaUser.id).maybeSingle();
      if (statsRes.data) {
        lsSet('kh_synced_mission_streak', Math.max(statsRes.data.mission_streak || 0, statsRes.data.streak || 0));
      }
      streak = Math.max(streak, await fetchActivityStreakFromDB(sb, supaUser.id));
    } catch(e) {}
  }

  var wordsDone   = (dm.words    || 0) >= 20;
  var artsDone    = (dm.articles || 0) >= 3;
  var hasWeak = weakCount > 0;
  var weakQ = encodeURIComponent(weakGrammar);

  // Update review button state based on today's articles read
  if (window._updateReviewBtn) window._updateReviewBtn((dm.articles || 0) > 0);

  function _progCard(val, goal, label, done) {
    var bg   = done ? 'rgba(74,222,128,.14)'    : 'rgba(255,255,255,.06)';
    var bord = done ? 'rgba(74,222,128,.35)'    : 'rgba(255,255,255,.08)';
    var valC = done ? '#4ade80'                 : '#fff';
    var lblC = done ? 'rgba(74,222,128,.75)'    : 'rgba(255,255,255,.58)';
    var tick = done ? ' ✓' : '';
    return '<div style="flex:1;background:' + bg + ';border:1px solid ' + bord + ';border-radius:12px;padding:9px 10px;text-align:center;transition:background .2s,border-color .2s;">'
      + '<div style="font-size:16px;font-weight:900;color:' + valC + ';">' + val
      + (done ? tick : (goal ? '<span style="font-size:10px;color:rgba(255,255,255,.5)">/' + goal + '</span>' : ''))
      + '</div>'
      + '<div style="font-size:10px;color:' + lblC + ';font-weight:700;">' + label + '</div>'
      + '</div>';
  }

  box.innerHTML =
    // streak badge + stats row
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">'
    + '<div style="font-size:12px;font-weight:800;color:#fff">Today\'s Progress</div>'
    + '<div style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:rgba(255,179,71,.14);border:1px solid rgba(255,179,71,.24);color:#ffd089;">🔥 ' + streak + ' day streak</div>'
    + '</div>'
    + '<div style="display:flex;gap:6px;margin-bottom:12px;">'
    + _progCard(dm.words||0, 20, 'Words', wordsDone)
    + _progCard(dm.articles||0, 3, 'Articles', artsDone)
    + _progCard(xp, null, 'XP', false)
    + '</div>'
    // weak grammar
    + '<div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;">'
    + '<div style="min-width:0;">'
    +   '<div style="font-size:10px;font-weight:800;color:' + (hasWeak?'#ffd089':'#8ff0b3') + ';margin-bottom:2px;">' + (hasWeak?'⚠️ Weak Grammar':'✅ Grammar') + '</div>'
    +   '<div style="font-size:13px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + weakGrammar + '</div>'
    + '</div>'
    + '<a href="korehan-study-room.html?focus=' + weakQ + '&source=home-weak-grammar" style="flex-shrink:0;font-size:11px;font-weight:800;padding:7px 11px;background:#2563eb;color:#fff;border-radius:999px;text-decoration:none;white-space:nowrap;">Practice →</a>'
    + '</div>';
}

window.renderHomeLearningPreview = renderHomeLearningPreview;

function isMobileRedesign() {
  return window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
}

function pageName() {
  return (window.location.pathname.split('/').pop() || 'index.html').replace(/\.html$/,'');
}

function markMobileBody() {
  if (!isMobileRedesign()) return;
  document.body.classList.add('mobile-redesign');
}

function injectMobileBottomNav() {
  if (!isMobileRedesign()) return;
  var page = pageName();
  var nav = document.querySelector('.mobile-bottom-nav');
  if (!nav) {
    nav = document.createElement('nav');
    nav.className = 'mobile-bottom-nav';
    document.body.appendChild(nav);
  }
  var items = [
    ['index.html','home','Home','index'],
    ['korehan-all.html','newspaper','News','korehan-all'],
    ['korehan-study-room.html','notebook-pen','Learn','korehan-study-room'],
    ['korehan-conversations.html','messages-square','CONVO','korehan-conversations'],
  ];
  if (supaUser) items.push(['#','circle-user-round','Account','account']);
  else items.push(['#','log-in','Sign In','signin']);
  nav.innerHTML = items.map(function(it){
    var isOn = page===it[3];
    var extra = '';
    if (it[3] === 'signin') extra = ' onclick="event.preventDefault();openAuthModal(\'signin\')"';
    else if (it[3] === 'account') extra = ' onclick="event.preventDefault();openMobileAccountMenu()"';
    return '<a href="'+it[0]+'" class="'+(isOn?'on':'')+'"' + extra + '><span class="ico">' + khIcon(it[1], '', 'kh-ui-icon-mobile') + '</span><span>'+it[2]+'</span></a>';
  }).join('');
  renderKhLucideIcons();
}

function openMobileAccountMenu() {
  if (!supaUser) { openAuthModal('signin'); return; }
  // Open the sidebar — it has My Page + Sign Out for logged-in users
  khSbOpen();
}

function mobileCreateCardHTML(label, value, href) {
  return '<a class="mobile-mini-card" href="'+href+'"><div class="label">'+label+'</div><div class="value">'+value+'</div></a>';
}

function enhanceHomeMobile() {
  if (!isMobileRedesign() || pageName() !== 'index') return;
  var container = document.querySelector('.container');
  if (!container || document.querySelector('.mobile-quick-start')) return;

  // 바로가기 섹션 제거됨 — daily-strip 내 버튼으로 충분
}

function enhanceArticleMobile() {
  if (!isMobileRedesign() || pageName() !== 'korehan-article') return;
  var article = document.querySelector('.kh-article-wrap');
  if (!article) return;
  // Remove duplicate mobile-study-tabs if they exist (art-tabs already has 4 tabs)
  var dupTabs = article.querySelector('.mobile-study-tabs');
  if (dupTabs) dupTabs.remove();
}

function enhanceConversationsMobile() {
  if (!isMobileRedesign() || pageName() !== 'korehan-conversations') return;
  // Conversation Study banner removed — unnecessary

  var observer = new MutationObserver(function(){
    var panel = document.querySelector('.detail-panel');
    if (!panel) return;
    var cta = panel.querySelector('.dp-cta-row');
    if (cta && !cta.dataset.mobileEnhanced) {
      cta.dataset.mobileEnhanced = '1';
      cta.style.gridTemplateColumns = '1fr 1fr';
    }
  });
  observer.observe(document.body, { childList:true, subtree:true });
}

function enhanceStoriesMobile() {
  if (!isMobileRedesign() || pageName() !== 'korehan-stories') return;
  var root = document.querySelector('.st-container') || document.body;
  if (root && !document.querySelector('.mobile-section-shell[data-mobile="story"]')) {
    var shell = document.createElement('section');
    shell.className = 'mobile-section-shell';
    shell.setAttribute('data-mobile','story');
    shell.innerHTML = ''
      + '<div class="mobile-eyebrow">Story reading</div>'
      + '<h2 class="mobile-quick-title" style="font-size:28px">Short stories should feel easy to finish on mobile.</h2>'
      + '<p class="mobile-quick-sub">Pick a mood, read one story, then review the key words and discuss what happened.</p>'
      + '<div class="mobile-action-row">'
      + '<a class="mobile-primary-btn" href="korehan-stories.html?mood=fun">' + khIcon('sparkles', 'Fun stories', 'kh-ui-icon-sm') + '</a>'
      + '<a class="mobile-secondary-btn" href="korehan-stories.html?mood=touching">' + khIcon('heart', 'Touching', 'kh-ui-icon-sm') + '</a>'
      + '</div>';
    root.insertAdjacentElement('afterbegin', shell);
  }

  var observer = new MutationObserver(function(){
    var panel = document.querySelector('.st-panel');
    if (!panel || panel.querySelector('.mobile-tier-card')) return;
    var head = panel.querySelector('.st-head-info');
    if (head) {
      var box = document.createElement('div');
      box.className = 'mobile-tier-card';
      box.style.margin = '0 24px 14px';
      box.innerHTML = ''
        + '<div class="mobile-eyebrow">Story study</div>'
        + '<h3 style="font-size:22px;line-height:1.08;font-weight:900;color:#fff;margin:0 0 8px">Read → Vocabulary → Quiz → Discussion</h3>'
        + '<p class="mobile-quick-sub">Stories work best when the reading screen is calm and the study actions are obvious.</p>'
        + '<div class="mobile-action-row">'
        + '<a class="mobile-primary-btn" href="javascript:void(0)">' + khIcon('book-marked', 'Vocabulary', 'kh-ui-icon-sm') + '</a>'
        + '<a class="mobile-secondary-btn" href="korehan-study-room.html">' + khIcon('message-circle', 'Discussion', 'kh-ui-icon-sm') + '</a>'
        + '</div>';
      head.insertAdjacentElement('afterend', box);
    }
    var cta = panel.querySelector('.st-cta-row');
    if (cta && !cta.dataset.mobileEnhanced) {
      cta.dataset.mobileEnhanced = '1';
      cta.innerHTML = ''
        + '<button class="st-cta-btn st-cta-pri">Vocabulary</button>'
        + '<button class="st-cta-btn st-cta-sec">Quiz</button>'
        + '<button class="st-cta-btn st-cta-sec">Discussion</button>'
        + '<button class="st-cta-btn st-cta-sec">Practice</button>';
      cta.style.gridTemplateColumns = '1fr 1fr';
    }
  });
  observer.observe(document.body, { childList:true, subtree:true });
}

function enhanceCollectionPagesMobile() {
  if (!isMobileRedesign()) return;
  var p = pageName();
  if (['korehan-all','korehan-world','korehan-society','korehan-culture','korehan-korea','korehan-section'].indexOf(p) >= 0) {
    var list = document.getElementById('dyn-article-list');
    if (list && !document.querySelector('.mobile-section-shell[data-mobile="news"]')) {
      var shell = document.createElement('section');
      shell.className = 'mobile-section-shell';
      shell.setAttribute('data-mobile','news');
      shell.innerHTML = ''
        + '<div class="mobile-eyebrow">News study</div>'
        + '<h2 class="mobile-quick-title" style="font-size:28px">Read one article at your level, not ten at once.</h2>'
        + '<p class="mobile-quick-sub">The goal on mobile is quick entry: pick a category, open one article, then move into vocab or quiz.</p>'
        + '<div class="mobile-action-row">'
        + '<a class="mobile-primary-btn" href="korehan-study-room.html">' + khIcon('notebook-pen', 'Start Learning', 'kh-ui-icon-sm') + '</a>'
        + '<a class="mobile-secondary-btn" href="korehan-learn.html">' + khIcon('book-marked', 'Review vocab', 'kh-ui-icon-sm') + '</a>'
        + '</div>';
      list.insertAdjacentElement('beforebegin', shell);
    }
  }
}

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

// ═══════════════════════════════════════════════════════════════
// LEARNING HUB — Data Pipeline Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Log any learning activity to user_activity_log.
 * Called from any page — articles, study room, conversations, stories.
 *
 * @param {string} activityType - 'read','quiz','word_save','writing_submit','dictation','grammar_practice','picture_desc'
 * @param {object} opts - { content_type, content_id, content_title, score, max_score, metadata }
 */
async function logActivity(activityType, opts) {
  if (typeof supaUser === 'undefined' || !supaUser) return;
  var sb = (typeof getSupa === 'function') ? getSupa() : null;
  if (!sb) return;
  opts = opts || {};
  try {
    await sb.from('user_activity_log').insert({
      user_id:       supaUser.id,
      activity_type: activityType,
      content_type:  opts.content_type || null,
      content_id:    opts.content_id ? String(opts.content_id) : null,
      content_title: opts.content_title || '',
      score:         typeof opts.score === 'number' ? opts.score : null,
      max_score:     typeof opts.max_score === 'number' ? opts.max_score : null,
      metadata:      JSON.stringify(opts.metadata || {}),
      study_date:    _kstDateKey()
    });
  } catch(e) { console.warn('[logActivity]', e.message || e); }
}

/**
 * Log quiz result with score and wrong-pattern analysis.
 *
 * @param {string} quizType - 'daily_review','grammar','vocab','dictation','article_comprehension','writing_feedback'
 * @param {object} opts - { content_type, content_id, score, max_score, accuracy_pct, wrong_patterns, details }
 */
async function logQuizResult(quizType, opts) {
  if (typeof supaUser === 'undefined' || !supaUser) return;
  var sb = (typeof getSupa === 'function') ? getSupa() : null;
  if (!sb) return;
  opts = opts || {};
  try {
    await sb.from('user_quiz_results').insert({
      user_id:        supaUser.id,
      quiz_type:      quizType,
      content_type:   opts.content_type || null,
      content_id:     opts.content_id ? String(opts.content_id) : null,
      score:          opts.score || 0,
      max_score:      opts.max_score || 100,
      accuracy_pct:   typeof opts.accuracy_pct === 'number' ? opts.accuracy_pct : null,
      wrong_patterns: JSON.stringify(opts.wrong_patterns || {}),
      details:        JSON.stringify(opts.details || {}),
      study_date:     _kstDateKey()
    });
  } catch(e) { console.warn('[logQuizResult]', e.message || e); }
}

/** KST date key helper (shared) */
function _kstDateKey() {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
}

// ══════════════════════════════════════════════════════════════════
// FIRST JOURNEY — 신규 유저 퀘스트 시스템
// ══════════════════════════════════════════════════════════════════
var _FJ_KEY = 'kh_first_journey';
var _FJ_STEPS = [
  { id:'signup',    label:'Sign up & complete onboarding', icon:'👤', nyang: 0,  auto: true, page:'korehan-onboarding.html' },
  { id:'read',      label:'Read your first article',   icon:'📰', nyang: 10, page:'korehan-all.html' },
  { id:'save_words',label:'Save 5 words',              icon:'💾', nyang: 5,  page:'korehan-all.html', hint:'Hover a word → click + Save' },
  { id:'study',     label:'Try Study Room',             icon:'📝', nyang: 5,  page:'korehan-study-room.html' },
  { id:'convo',     label:'Read a conversation',        icon:'💬', nyang: 5,  page:'korehan-conversations.html' },
  { id:'growth',    label:'Visit Growth Lab',            icon:'📊', nyang: 5,  page:'korehan-learning-overview.html' },
  { id:'shop',      label:'Buy an item in Shop',        icon:'🛍️', nyang: 10, page:'korehan-shop.html' },
  { id:'room',      label:'Place an item in My Room',   icon:'🏠', nyang: 10, page:'korehan-mypage.html' }
];
var _FJ_BONUS = 50; // 전체 완료 보너스

function _fjGet() {
  try { return JSON.parse(localStorage.getItem(_FJ_KEY)) || {}; } catch(e) { return {}; }
}
function _fjSet(data) {
  try { localStorage.setItem(_FJ_KEY, JSON.stringify(data)); } catch(e) {}
}
function _fjIsComplete(stepId) {
  return !!(_fjGet()[stepId]);
}
function _fjDoneCount() {
  var d = _fjGet();
  return _FJ_STEPS.filter(function(s){ return !!d[s.id]; }).length;
}
function _fjAllDone() {
  return _fjDoneCount() >= _FJ_STEPS.length;
}
function _fjMarkDone(stepId) {
  if (_fjIsComplete(stepId) || _fjAllDone()) return;
  var d = _fjGet();
  d[stepId] = Date.now();
  _fjSet(d);
  // 단계별 냥 보상
  var step = _FJ_STEPS.find(function(s){ return s.id === stepId; });
  if (step && step.nyang > 0 && supaUser) {
    awardXP('first_journey_step', { content_id: stepId }).catch(function(){});
    // 냥 직접 지급 (XP 시스템과 별도)
    var sb = getSupa();
    if (sb) {
      sb.from('user_stats').select('coin_balance').eq('user_id', supaUser.id).maybeSingle()
        .then(function(r) {
          var cur = (r.data && r.data.coin_balance) || 0;
          sb.from('user_stats').upsert({ user_id: supaUser.id, coin_balance: cur + step.nyang }, { onConflict:'user_id' });
          if (typeof showCoinToast === 'function') showCoinToast(step.nyang);
        }).catch(function(){});
    }
  }
  _fjRenderWidget();
  // 전체 완료 체크
  if (_fjAllDone()) {
    if (supaUser) {
      var sb2 = getSupa();
      if (sb2) {
        sb2.from('user_stats').select('coin_balance').eq('user_id', supaUser.id).maybeSingle()
          .then(function(r) {
            var cur2 = (r.data && r.data.coin_balance) || 0;
            sb2.from('user_stats').upsert({ user_id: supaUser.id, coin_balance: cur2 + _FJ_BONUS }, { onConflict:'user_id' });
            if (typeof showCoinToast === 'function') showCoinToast(_FJ_BONUS);
            if (typeof toast === 'function') toast('🎉 First Journey Complete! +' + _FJ_BONUS + ' nyang!', 'success');
          }).catch(function(){});
      }
    }
  }
}

// 자동 감지 hooks
function _fjAutoCheck() {
  if (_fjAllDone()) return;
  var page = window.location.pathname.split('/').pop().replace(/\.html$/,'') || 'index';
  // signup: 로그인 + 온보딩 완료 시에만 체크
  if (supaUser && !_fjIsComplete('signup')) {
    var onboarded = false;
    try { onboarded = hasCompletedOnboardingLocal(supaUser.id) || hasCompletedOnboardingLocal(''); } catch(e) {}
    if (onboarded) _fjMarkDone('signup');
  }
  // growth: Growth Lab 페이지 방문
  if (page === 'korehan-learning-overview' && !_fjIsComplete('growth')) _fjMarkDone('growth');
  // study: Study Room 페이지 방문
  if (page === 'korehan-study-room' && !_fjIsComplete('study')) _fjMarkDone('study');
  // convo: Conversations 페이지에서 대화 열기 (openDetail에서 감지)
  if (page === 'korehan-conversations' && !_fjIsComplete('convo')) {
    // openDetail 호출 시 감지 — conversations.html에서 처리
  }
}

// 글로벌 이벤트 hooks
window.addEventListener('kh-auth-signed-in', function() {
  // signup은 onboarding 완료 후에만 체크 — 여기선 위젯만 갱신
  _fjAutoCheck();
  _fjRenderWidget();
});

// 기사 읽기 감지 — markArticleRead 호출 시
var _origMarkArticleRead = window.markArticleRead;
if (typeof _origMarkArticleRead === 'function') {
  window.markArticleRead = function() {
    if (!_fjIsComplete('read')) _fjMarkDone('read');
    return _origMarkArticleRead.apply(this, arguments);
  };
}
// 단어 저장 감지 — dbSaveWord 호출 시
var _fjWordCount = 0;
var _origDbSaveWord = window.dbSaveWord;
if (typeof _origDbSaveWord === 'function') {
  window.dbSaveWord = function() {
    _fjWordCount++;
    if (_fjWordCount >= 5 && !_fjIsComplete('save_words')) _fjMarkDone('save_words');
    return _origDbSaveWord.apply(this, arguments);
  };
}

// ── 플로팅 위젯 ──
function _fjRenderWidget() {
  if (_fjAllDone()) {
    var el = document.getElementById('fj-widget');
    if (el) el.remove();
    // 완료 후 표시 안 함
    var dismissed = localStorage.getItem('kh_fj_dismissed');
    if (dismissed) return;
    localStorage.setItem('kh_fj_dismissed', '1');
    return;
  }
  if (localStorage.getItem('kh_fj_dismissed')) return;
  var done = _fjDoneCount();
  var total = _FJ_STEPS.length;
  var pct = Math.round(done / total * 100);
  var widget = document.getElementById('fj-widget');
  if (!widget) {
    widget = document.createElement('div');
    widget.id = 'fj-widget';
    widget.style.cssText = 'position:fixed;bottom:80px;right:16px;z-index:8000;width:300px;max-height:80vh;overflow-y:auto;background:#0f1a2e;border:1px solid rgba(56,189,248,.2);border-radius:18px;box-shadow:0 16px 48px rgba(0,0,0,.4);color:#fff;font-family:inherit;font-size:13px;transition:opacity .3s';
    document.body.appendChild(widget);
  }
  // 다음 할 일 찾기 (첫 번째 미완료 항목)
  var _fjNextId = null;
  for (var _fi = 0; _fi < _FJ_STEPS.length; _fi++) {
    if (!_fjIsComplete(_FJ_STEPS[_fi].id)) { _fjNextId = _FJ_STEPS[_fi].id; break; }
  }
  var stepsHtml = _FJ_STEPS.map(function(s) {
    var isDone = _fjIsComplete(s.id);
    var isNext = (s.id === _fjNextId);
    var link = (!isDone && s.page) ? ' onclick="location.href=\'' + s.page + (s.id === 'save_words' ? '#vocab-zone' : '') + '\'"' : '';
    var cursor = (!isDone && s.page) ? 'cursor:pointer;' : '';
    var highlight = isNext ? 'background:rgba(56,189,248,.08);border-radius:8px;margin:0 -8px;padding:8px;' : 'padding:8px 0;';
    var nextArrow = isNext ? '<span style="font-size:11px;color:#38bdf8;font-weight:800;white-space:nowrap">Go →</span>' : '';
    return '<div style="display:flex;align-items:center;gap:10px;' + highlight + cursor + (isDone ? 'opacity:.45' : '') + ';transition:background .15s"' + link
      + (!isDone && s.page ? ' onmouseover="this.style.background=\'rgba(56,189,248,.12)\'" onmouseout="this.style.background=\'' + (isNext ? 'rgba(56,189,248,.08)' : '') + '\'"' : '')
      + '>'
      + '<span style="font-size:16px">' + (isDone ? '✅' : s.icon) + '</span>'
      + '<div style="flex:1;min-width:0"><span style="' + (isDone ? 'text-decoration:line-through;' : '') + (isNext ? 'font-weight:700;color:#fff' : '') + '">' + s.label + '</span>'
      + (isNext && s.hint ? '<div style="font-size:10px;color:rgba(255,255,255,.4);margin-top:2px">' + s.hint + '</div>' : '')
      + '</div>'
      + (s.nyang > 0 && !isDone ? '<span style="font-size:10px;color:#5eead4;font-weight:700;white-space:nowrap">+' + s.nyang + '</span>' : '')
      + nextArrow
      + '</div>';
  }).join('');
  widget.innerHTML =
    '<div style="padding:16px 16px 12px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between">'
    + '<div><div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#38bdf8">Your First Journey</div>'
    + '<div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:2px">' + done + '/' + total + ' completed</div></div>'
    + '<button onclick="_fjDismissWidget()" style="background:none;border:none;color:rgba(255,255,255,.3);font-size:18px;cursor:pointer;padding:4px">✕</button>'
    + '</div>'
    + '<div style="padding:4px 16px"><div style="height:4px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden;margin:8px 0"><div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#38bdf8,#2563eb);border-radius:4px;transition:width .3s"></div></div></div>'
    + '<div style="padding:4px 16px 16px">' + stepsHtml + '</div>'
    + (done < total ? '<div style="padding:0 16px 14px;font-size:11px;color:rgba(255,255,255,.35);text-align:center">🎁 Complete all → +' + _FJ_BONUS + ' nyang bonus!</div>' : '');
}

// dismiss → 위젯 닫고 작은 resume 버튼 표시
function _fjDismissWidget() {
  var w = document.getElementById('fj-widget');
  if (w) w.remove();
  localStorage.setItem('kh_fj_dismissed', '1');
  _fjShowResumeBtn();
}
function _fjShowResumeBtn() {
  if (_fjAllDone()) return;
  if (document.getElementById('fj-resume')) return;
  var btn = document.createElement('button');
  btn.id = 'fj-resume';
  btn.style.cssText = 'position:fixed;bottom:80px;right:16px;z-index:7999;width:44px;height:44px;border-radius:50%;background:#0f1a2e;border:1px solid rgba(56,189,248,.25);color:#38bdf8;font-size:18px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;transition:transform .15s';
  btn.innerHTML = '🎯';
  btn.title = 'Resume First Journey';
  btn.onclick = function() {
    localStorage.removeItem('kh_fj_dismissed');
    btn.remove();
    _fjRenderWidget();
  };
  btn.onmouseover = function(){ btn.style.transform='scale(1.1)'; };
  btn.onmouseout = function(){ btn.style.transform=''; };
  document.body.appendChild(btn);
}

// 초기화 — DOMContentLoaded 후 실행
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    _fjAutoCheck();
    if (_fjAllDone()) return;
    if (localStorage.getItem('kh_fj_dismissed')) {
      _fjShowResumeBtn(); // dismissed → 작은 🎯 버튼만
    } else {
      _fjRenderWidget();  // 처음 → 전체 위젯
    }
  }, 1500);
});
