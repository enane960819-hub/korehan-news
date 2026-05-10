/* ============================================================
   KoreHani — Shared JS
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

// ═══════════════════════════════════════════════════════════════
// TOPIK-BASED DIFFICULTY FRAMEWORK — Used by ALL AI content generation
// ═══════════════════════════════════════════════════════════════
var KH_LEVEL_GUIDE = {
  Seed: {
    topik: 'Pre-TOPIK / TOPIK 0',
    label: 'Seed',
    rules: [
      'KEY PRINCIPLE: Keep ALL proper nouns, names, and key terms from the original headline (대통령, 서울, etc). These are vocabulary learning opportunities. Only simplify the GRAMMAR and SENTENCE STRUCTURE around them.',
      'Vocabulary: Use basic Korean words. Key terms from the news topic stay as-is (they become vocab items). Explain difficult key terms in parentheses if needed.',
      'Grammar: ONLY 이에요/예요, 있어요/없어요, 하다 verbs. Very basic particles 은/는, 이/가.',
      'Sentence length: MAX 4-5 words per sentence.',
      'Tense: Present tense primarily. Simple past 았/었어요 OK for news.',
      'Total article length: 10-15 sentences. Enough content to study vocabulary and do exercises.',
      'Article style: Real news, simplified to the most basic Korean. Every sentence is short and clear.',
      'Example: 미국 대통령이 한국에 왔어요. 대통령은 서울에 있어요. 한국 대통령을 만났어요. 두 사람은 이야기했어요.'
    ].join('\n')
  },
  Sprout: {
    topik: 'TOPIK I Level 1-2',
    label: 'Sprout',
    rules: [
      'KEY PRINCIPLE: Write the news naturally at this level. Do NOT artificially simplify proper nouns or key terms. Do NOT artificially make it harder either.',
      'Vocabulary: Common everyday words + topic-specific key terms from the headline.',
      'Grammar: Present tense 아요/어요, past tense 았/었어요, 고 싶어요, basic negation 안/못',
      'Particles: 은/는, 이/가, 을/를, 에, 에서, 도, 와/과',
      'Connectors: 그리고, 그래서, 하지만 — as separate sentences OK, within sentences also OK',
      'Sentence length: 5-10 words per sentence.',
      'Honorifics: 해요체 primarily.',
      'Total article length: 15-25 sentences. Enough for Article Study 5-step exercises.',
      'Article style: Real news, written clearly. A Korean learner at TOPIK 1-2 should be able to read with some dictionary help.',
      'Example: 어제 서울에서 큰 행사가 있었어요. 많은 사람들이 왔어요. 음악도 있었고 음식도 있었어요.'
    ].join('\n')
  },
  Tree: {
    topik: 'TOPIK I Level 3-4',
    label: 'Tree',
    rules: [
      'KEY PRINCIPLE: Write naturally. The article should read like real Korean news at a moderate level. Do NOT dumb down or inflate.',
      'Vocabulary: Topic-specific terms, some Sino-Korean. Natural word choices for the topic.',
      'Grammar: Connectors within sentences (고, 지만, 서, 때문에, 니까), modals (ㄹ 수 있다, 아/어 보다), quoted speech (다고, 라고)',
      'Tense: Present, past, future freely. Progressive (고 있다).',
      'Sentence length: 8-15 words per sentence. Compound sentences OK.',
      'Honorifics: 해요체 + 합니다체 mix.',
      'Relative clauses: 는/은/을 + noun OK.',
      'Total article length: 15-30 sentences. Full article with enough depth for comprehension questions.',
      'Article style: Standard Korean news. Feature articles, reports, interviews.',
      'Example: 최근 한국에서 외국인 관광객이 늘어나고 있는데, 특히 일본과 동남아시아에서 오는 관광객이 많아졌어요.'
    ].join('\n')
  },
  Forest: {
    topik: 'TOPIK II Level 5-6',
    label: 'Forest',
    rules: [
      'KEY PRINCIPLE: Write at NATURAL news article level. Do NOT artificially make it harder than real Korean journalism. The goal is authentic Korean, not academic papers.',
      'Vocabulary: Full range including abstract nouns, Sino-Korean, idiomatic expressions.',
      'Grammar: All patterns allowed. Complex connectors, nominalizations, formal/written style.',
      'Sentence structure: Multi-clause sentences natural for Korean journalism.',
      'Sentence length: Natural Korean news sentence length (varies).',
      'Honorifics: 합니다체 for news, written style (다/ㄴ다) for articles.',
      'Total article length: 20-35 sentences. Full-length article with analysis and context.',
      'Article style: Real Korean journalism. Editorials, in-depth analysis, opinion pieces. Should read like 조선일보/한겨레 level.',
      'Example: 정부가 발표한 새로운 경제 정책에 대해 전문가들 사이에서 엇갈린 반응이 나오고 있다. 일부에서는 단기적 효과를 기대하는 반면, 장기적인 부작용을 우려하는 목소리도 적지 않다.'
    ].join('\n')
  }
};

// Map shortcodes to full level names
var KH_LEVEL_MAP = { s:'Seed', b:'Sprout', i:'Tree', a:'Forest', Starter:'Seed', Beginner:'Sprout', Intermediate:'Tree', Advanced:'Forest', Seed:'Seed', Sprout:'Sprout', Tree:'Tree', Forest:'Forest' };

// Get formatted prompt string for any level
function getLevelPrompt(level) {
  var key = KH_LEVEL_MAP[level] || level;
  var g = KH_LEVEL_GUIDE[key];
  if (!g) return '';
  return '=== DIFFICULTY LEVEL: ' + g.label + ' (' + g.topik + ') ===\n' + g.rules + '\n\nCRITICAL: ALL generated content MUST strictly follow the above level rules. Do NOT mix in content from other levels.';
}

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
    var errMsg;
    if (typeof err.error === 'string') errMsg = err.error;
    else if (err.error && typeof err.error === 'object') {
      // Anthropic forwards the upstream error verbatim — pull the
      // human-readable message out instead of letting Error.message
      // become an object that stringifies to "[object Object]".
      errMsg = err.error.message || err.error.type || JSON.stringify(err.error);
    } else if (err.message) errMsg = String(err.message);
    else errMsg = 'AI server error (' + resp.status + ')';
    throw new Error(errMsg);
  }
  return resp.json();
}

// Noun-form filter for learner-facing vocab lists. Used by the article
// Vocab tab (renderArticleVocab) and the sidebar Word Bank so the same
// entry renders the same way everywhere — a site-wide 노력하다 entry
// should show up as 노력 in both places, not as a verb in one and a
// noun in the other.
//
// - `~하다` action verbs -> noun stem (노력하다 -> 노력), strip "hada"
//   from rom and "to " from en
// - Other `~다` dictionary forms (돌아오다, 예쁘다) have no clean noun
//   surface -> return null so the caller can drop them
// - Everything else passes through unchanged
//
// NOT applied in: hover tooltips (needs dict form for conjugation
// lookup), Universe related-words (intentionally dictionary-form for
// recognition learning), Study-Room external practice chips (writing
// drills need the conjugable form).
function khNormalizeVocabNoun(ko, rom, en) {
  ko = ko || '';
  rom = rom || '';
  en = en || '';
  if (!ko || ko.length < 2) return null;
  if (/하다$/.test(ko) && ko.length >= 3) {
    return {
      ko: ko.replace(/하다$/, ''),
      rom: rom.replace(/[-\s]*hada$/i, ''),
      en: en.replace(/^to\s+/i, '')
    };
  }
  if (/다$/.test(ko)) return null;
  return { ko: ko, rom: rom, en: en };
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

// ── Guest content gate ────────────────────────────────────────
// Wraps a content scope so non-signed-in readers see only the first
// chunk with a fade and a sign-up CTA. Idempotent — safe to call
// multiple times. Re-runs on auth changes via the listener below so
// gates lift the moment a user signs in without a page reload.
function khApplyGuestGate(opts) {
  opts = opts || {};
  var bodyClass = opts.bodyClass || 'kh-guest-gated';
  var bodySel   = opts.bodySel;            // e.g. '.art-lead, .art-full' or '#st-body-ko'
  var anchorSel = opts.anchorSel || bodySel; // where to insert the CTA after
  var ctaTitle  = opts.ctaTitle || 'Read the rest — free with a quick sign-up';
  var ctaSub    = opts.ctaSub   || 'Create a free account to keep reading, save vocabulary, and unlock daily review.';
  var rootEl    = opts.root || document;

  // Already signed in / admin / session not yet known? Don't gate.
  if (window.supaUser) {
    _khRemoveGuestGate(rootEl, bodyClass);
    return;
  }
  // Don't gate while we're still checking the session — a flicker is worse
  // than a delayed render.
  if (!window._sessionChecked) return;

  var bodies = bodySel ? rootEl.querySelectorAll(bodySel) : [];
  if (!bodies.length) return;

  // Already gated?
  if (rootEl.querySelector('.kh-gate-cta[data-kh-gate="1"]')) return;

  // Apply clip + fade overlay to each body element.
  Array.prototype.forEach.call(bodies, function(el) {
    el.classList.add('kh-gate-clip');
    if (!el.querySelector(':scope > .kh-gate-blur')) {
      var blur = document.createElement('div');
      blur.className = 'kh-gate-blur';
      el.appendChild(blur);
    }
  });

  // Mark a parent scope so CSS can hide deeper UI (tabs, comments, etc).
  var scope = opts.scopeEl || (bodies[0] && bodies[0].closest('.art-card-body, .st-panel, body')) || document.body;
  if (scope) scope.classList.add(bodyClass);

  // Build CTA banner.
  var cta = document.createElement('div');
  cta.className = 'kh-gate-cta';
  cta.setAttribute('data-kh-gate', '1');
  cta.innerHTML =
      '<div class="kh-gate-cta-eyebrow">Continue Reading</div>'
    + '<div class="kh-gate-cta-title">' + ctaTitle + '</div>'
    + '<div class="kh-gate-cta-sub">' + ctaSub + '</div>'
    + '<div class="kh-gate-cta-actions">'
    +   '<button type="button" class="kh-gate-cta-btn primary" onclick="openAuthModal(\'signup\')">Join Free →</button>'
    +   '<button type="button" class="kh-gate-cta-btn ghost" onclick="openAuthModal(\'signin\')">Sign In</button>'
    + '</div>';
  var anchor = anchorSel ? rootEl.querySelector(anchorSel) : bodies[bodies.length - 1];
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(cta, anchor.nextSibling);
}

function _khRemoveGuestGate(rootEl, bodyClass) {
  rootEl = rootEl || document;
  var clipped = rootEl.querySelectorAll('.kh-gate-clip');
  Array.prototype.forEach.call(clipped, function(el) {
    el.classList.remove('kh-gate-clip');
    var b = el.querySelector(':scope > .kh-gate-blur');
    if (b) b.remove();
  });
  var ctas = rootEl.querySelectorAll('.kh-gate-cta[data-kh-gate="1"]');
  Array.prototype.forEach.call(ctas, function(el) { el.remove(); });
  var scope = rootEl.querySelector('.' + (bodyClass || 'kh-guest-gated'));
  if (scope) scope.classList.remove(bodyClass || 'kh-guest-gated');
}

window.addEventListener('kh-auth-signed-in', function() {
  _khRemoveGuestGate(document, 'kh-guest-gated');
});

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
  if (tab === 'signup')  { if(signupTab) signupTab.classList.add('on'); if(signupForm) signupForm.style.display='block'; _khMountTurnstile(); }
  if (tab === 'reset')   { if(resetForm) resetForm.style.display='block'; }
  _authClearErrors();
}

// Cloudflare Turnstile bootstrap. The script + widget only load
// when the founder has set window.KH_TURNSTILE_SITEKEY (paste it
// into a <script> tag before korehan-shared.js, or hard-code here
// after creating the site at https://dash.cloudflare.com → Turnstile).
// Without the key set, signup still works — Supabase native captcha
// is just disabled and the disposable-email block + email
// verification gate carry the load alone.
function _khMountTurnstile() {
  var sitekey = window.KH_TURNSTILE_SITEKEY;
  if (!sitekey) return;
  var slot = document.getElementById('kh-turnstile-signup');
  if (!slot || slot.dataset.widgetId) return; // already mounted

  function render() {
    if (!window.turnstile || !window.turnstile.render) return false;
    try {
      var id = window.turnstile.render(slot, {
        sitekey: sitekey,
        theme: 'auto',
        size: 'flexible'
      });
      slot.dataset.widgetId = id;
      return true;
    } catch (_) { return false; }
  }
  if (render()) return;

  if (!document.getElementById('kh-turnstile-script')) {
    var s = document.createElement('script');
    s.id = 'kh-turnstile-script';
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.onload = render;
    document.head.appendChild(s);
  } else {
    // Script already loading — poll briefly.
    var tries = 0;
    var iv = setInterval(function(){
      if (render() || ++tries > 40) clearInterval(iv);
    }, 100);
  }
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
  toast('Welcome back!');
}

// Disposable / throwaway email domains. The list is curated rather
// than the full 4000-domain GitHub blocklist — keeping the bundle
// small. Misses are caught by the email-verification gate in
// claude-proxy: a disposable inbox the user can't actually receive
// at means no AI access either way. Add domains as new abuse
// patterns emerge (or swap in the full list later).
var _KH_DISPOSABLE_DOMAINS = {
  'mailinator.com':1, 'guerrillamail.com':1, 'guerrillamail.net':1,
  '10minutemail.com':1, '10minutemail.net':1, '20minutemail.com':1,
  'tempmail.com':1, 'temp-mail.org':1, 'tempr.email':1, 'tmail.io':1,
  'throwawaymail.com':1, 'getnada.com':1, 'maildrop.cc':1,
  'yopmail.com':1, 'yopmail.fr':1, 'yopmail.net':1,
  'sharklasers.com':1, 'grr.la':1, 'guerrillamailblock.com':1,
  'fakeinbox.com':1, 'spambox.us':1, 'mailcatch.com':1,
  'trashmail.com':1, 'trashmail.net':1, 'dispostable.com':1,
  'mintemail.com':1, 'mailnesia.com':1, 'jetable.org':1,
  'mytemp.email':1, 'emailondeck.com':1, 'mohmal.com':1,
  'discard.email':1, 'getairmail.com':1, 'fakemailgenerator.com':1,
  'inboxbear.com':1, 'mailpoof.com':1, 'mvrht.com':1,
  'vomoto.com':1, 'meltmail.com':1, 'tempmailaddress.com':1,
  'tempinbox.com':1, 'spamgourmet.com':1, 'ezztt.com':1,
  'emailfake.com':1, 'fakemail.net':1, 'temporary-mail.net':1,
  'generator.email':1, 'mailbox.org':1
};
function _khIsDisposableEmail(email) {
  var at = email.lastIndexOf('@');
  if (at < 0) return false;
  var domain = email.slice(at + 1).toLowerCase().trim();
  if (!domain) return false;
  return !!_KH_DISPOSABLE_DOMAINS[domain];
}

// ── 이메일 회원가입 ───────────────────────────────────────────
async function authSignUp() {
  var name  = (document.getElementById('kh-auth-name')  || {}).value.trim();
  var email = (document.getElementById('kh-auth-email2') || {}).value.trim().toLowerCase();
  var pw    = (document.getElementById('kh-auth-pw2')   || {}).value;
  var pw2   = (document.getElementById('kh-auth-pw3')   || {}).value;
  var btn   = document.getElementById('kh-signup-btn');
  _authClearErrors();

  if (!name)  { _authShowError('Please enter your name.'); return; }
  if (!email || !email.includes('@')) { _authShowError('Please enter a valid email address.'); return; }
  if (_khIsDisposableEmail(email)) {
    _authShowError('Please use a permanent email address. Disposable / throwaway emails aren\'t supported.');
    return;
  }
  if (!pw || pw.length < 8) { _authShowError('Password must be at least 8 characters.'); return; }
  if (pw !== pw2) { _authShowError('Passwords do not match.'); return; }
  // 비밀번호 강도 체크
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
    _authShowError('Password must contain letters and numbers.'); return;
  }

  // Cloudflare Turnstile token (if widget mounted). When the site key
  // hasn't been configured yet (window.KH_TURNSTILE_SITEKEY not set)
  // the widget never mounts and we just skip — Supabase signup still
  // runs, with the disposable-email block + email verification gate
  // doing the work alone.
  var captchaToken;
  try {
    if (window.turnstile && window.KH_TURNSTILE_SITEKEY) {
      var widgetEl = document.getElementById('kh-turnstile-signup');
      if (widgetEl && widgetEl.dataset.widgetId) {
        captchaToken = window.turnstile.getResponse(widgetEl.dataset.widgetId);
      }
      if (!captchaToken) {
        _authShowError('Please complete the bot check before signing up.');
        return;
      }
    }
  } catch (_) {}

  _authSetLoading(btn, true);
  var sb = getSupa();
  var signUpOptions = {
    data: { full_name: name },
    emailRedirectTo: window.location.origin + '/index.html'
  };
  if (captchaToken) signUpOptions.captchaToken = captchaToken;
  var { data, error } = await sb.auth.signUp({
    email: email,
    password: pw,
    options: signUpOptions
  });
  _authSetLoading(btn, false);

  // Turnstile tokens are single-use. Reset the widget on any signup
  // outcome so a user who got a "password too short" error or whose
  // captchaToken expired before submission can retry without
  // refreshing the page.
  function _resetTurnstile() {
    try {
      var slot = document.getElementById('kh-turnstile-signup');
      if (slot && slot.dataset.widgetId && window.turnstile) {
        window.turnstile.reset(slot.dataset.widgetId);
      }
    } catch (_) {}
  }

  if (error) {
    var msg = error.message;
    if (msg.includes('already registered')) msg = 'This email is already registered. Try signing in.';
    if (msg.toLowerCase().indexOf('captcha') !== -1) msg = 'Bot check failed. Please complete the verification and try again.';
    _authShowError(msg);
    _resetTurnstile();
    return;
  }

  // Supabase는 중복 이메일도 success 반환 — identities 배열이 비어있으면 기존 계정
  if (data && data.user && (!data.user.identities || data.user.identities.length === 0)) {
    _authShowError('This email is already registered. Please sign in instead.');
    _resetTurnstile();
    return;
  }

  _authShowOk('Account created! We sent a confirmation email. Please check your inbox (including spam).');
  document.getElementById('kh-signup-form').querySelectorAll('input').forEach(function(i){ i.value=''; });
  _resetTurnstile();
  // Push admin notification. Edge function dedupes by user_id so a
  // follow-up SIGNED_IN event (after email confirmation, or via the
  // separate Google OAuth path) won't send a second message.
  if (data && data.user && data.user.id) _khNotifySignup(data.user.id);
}

// Pings the notify-signup edge function with the new user's id. The
// function looks up created_at server-side and silently no-ops for
// returning users, so we can call it on every SIGNED_IN event without
// worrying about false positives. Per-tab guard avoids hammering the
// endpoint when SIGNED_IN re-fires (token refreshes, multi-tab focus).
window._khNotifyFiredFor = window._khNotifyFiredFor || {};
function _khNotifySignup(userId) {
  if (!userId || _khNotifyFiredFor[userId]) return;
  _khNotifyFiredFor[userId] = true;
  try {
    fetch(SUPA_URL + '/functions/v1/notify-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY },
      body: JSON.stringify({ user_id: userId }),
      keepalive: true, // survives the page unload that often follows OAuth redirects
    }).catch(function(){ /* best-effort */ });
  } catch(_) {}
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
  _authShowOk('Password reset link sent! Check your email.');
}

// ── 모달 HTML 주입 ────────────────────────────────────────────
function _injectAuthModal() {
  var div = document.createElement('div');
  div.innerHTML = `
<div id="kh-auth-modal" style="display:none;position:fixed;inset:0;background:rgba(8,16,30,.75);backdrop-filter:blur(7px);z-index:9999;align-items:center;justify-content:center;padding:20px" onclick="if(event.target===this)closeAuthModal()">
  <div style="background:#fff;border-radius:22px;width:100%;max-width:400px;box-shadow:0 32px 80px rgba(0,0,0,.3);overflow:hidden;animation:khAuthIn .28s cubic-bezier(.22,1,.36,1)">

    <!-- 헤더 -->
    <div style="background:linear-gradient(135deg,#07122a,#0e2554);padding:26px 28px 22px;position:relative">
      <button onclick="closeAuthModal()" style="position:absolute;top:14px;right:14px;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.1);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center"><span style="display:inline-flex;width:14px;height:14px">${KH_ICON_X}</span></button>
      <div style="font-size:24px;color:#fff;margin-bottom:3px"><span class="kh-logo-text">KoreHan<span class="kh-logo-i">ı</span></span></div>
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
          <button onclick="var i=document.getElementById('kh-auth-pw');i.type=i.type==='password'?'text':'password'" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);border:none;background:transparent;cursor:pointer;color:#94a3b8;display:inline-flex;align-items:center"><span style="display:inline-flex;width:16px;height:16px">${KH_ICON_EYE}</span></button>
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
      <button onclick="signInWithGoogle();closeAuthModal()" style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:11px;background:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s" onmouseover="this.style.background='#f8faff';this.style.borderColor='#c7d7f0'" onmouseout="this.style.background='#fff';this.style.borderColor='#e2e8f0'">
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
          <button onclick="var i=document.getElementById('kh-auth-pw2');i.type=i.type==='password'?'text':'password'" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);border:none;background:transparent;cursor:pointer;color:#94a3b8;display:inline-flex;align-items:center"><span style="display:inline-flex;width:16px;height:16px">${KH_ICON_EYE}</span></button>
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
      <div id="kh-turnstile-signup" style="margin-bottom:14px;min-height:0"></div>
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
      window._isAdmin = false;
      window._isTutor = false;
      updateAuthUI();
      updateCommentForm();
      window.dispatchEvent(new Event('kh-auth-signed-out'));
    } else if (event === 'SIGNED_IN') {
      supaUser = session ? session.user : null;
      _sessionWarningShown = false;
      closeAuthModal();
      updateAuthUI();
      updateCommentForm();
      renderDailyMission();
      window.dispatchEvent(new Event('kh-auth-signed-in'));
      setTimeout(function(){ updateAuthUI(); }, 300);
      // Catches OAuth signups (Google) and email signups whose first
      // SIGNED_IN event fires after email confirmation. The edge function
      // checks created_at and skips returning users, so this is safe to
      // run on every SIGNED_IN.
      if (supaUser && supaUser.id) _khNotifySignup(supaUser.id);
      // DB 동기화는 idle 시점으로 지연
      var _deferSI = typeof requestIdleCallback === 'function' ? requestIdleCallback : function(cb){ setTimeout(cb, 200); };
      _deferSI(function() {
        _syncSavedWordsFromDB();
        _rehydrateUserState();
        loadUserPlan();
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

  try {
    var _getSessionResult = await Promise.race([
      sb.auth.getSession(),
      new Promise(function(_, rej){ setTimeout(function(){ rej(new Error('getSession timeout')); }, 8000); })
    ]);
    var data = _getSessionResult.data;
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
        loadUserPlan();
        if (!window.location.pathname.includes('onboarding')) {
          checkOnboardingStatus();
        }
      });
    } else if (hasCode || hasHash) {
      // We came back from an OAuth round-trip but no session materialised.
      // Most common cause on Samsung Internet phone: the PKCE codeVerifier
      // entry in localStorage (sb-{ref}-auth-token-code-verifier) got
      // cleared during the redirect to accounts.google.com and back, so
      // exchangeCodeForSession can't complete. Surface a visible hint so
      // the user knows what's happening instead of seeing the page go
      // back to "Sign In" silently after Google said success.
      try { _khShowAuthFailureBanner(); } catch(_) {}
    }
  } catch(e) {
    console.warn('getSession failed or timed out:', e.message || e);
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

  // Tutor dashboard allowlist — admin + Alicia (Preply tutor).
  // Mirror this list in supabase/migrations/20260428_tutor_dashboard.sql is_tutor_user().
  var TUTOR_EMAILS = ['enane960819@gmail.com', 'aliciarburgess@gmail.com'];
  var isTutor = supaUser && TUTOR_EMAILS.includes((supaUser.email || '').toLowerCase());
  window._isTutor = isTutor;

  // Notification bell: only shown when signed in. khStartNotifications
  // handles polling + initial fetch so we don't block the header render.
  var notifWrap = document.getElementById('topbar-notif-wrap');
  if (notifWrap) notifWrap.style.display = supaUser ? 'inline-flex' : 'none';
  if (supaUser && typeof khStartNotifications === 'function') {
    try { khStartNotifications(); } catch (_) {}
  }

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
        + '<div id="kh-user-dropdown-stats" style="margin-top:8px;font-size:12px;color:#64748b;display:inline-flex;align-items:center;gap:5px"><span style="display:inline-flex;width:13px;height:13px;color:#a78bfa">'+KH_ICON_SPARKLE+'</span><span>XP 0 · </span><span style="display:inline-flex;width:13px;height:13px;color:#fbbf24">'+KH_ICON_PAW+'</span><span>냥 0</span></div>'
        + '</div>'
        + '<a href="korehan-mypage.html" class="kh-user-dropdown-link">' + khIcon('circle-user-round', 'My Page', 'kh-ui-icon-sm') + '</a>'
        + '<a href="korehan-friends.html" class="kh-user-dropdown-link">' + khIcon('users', 'Friends', 'kh-ui-icon-sm') + '</a>'
        + '<a href="korehan-notes.html" class="kh-user-dropdown-link">' + khIcon('bookmark', 'My Notes', 'kh-ui-icon-sm') + '</a>'
        + (isAdmin ? '<a href="korehan-x9f4k2m7.html" class="kh-user-dropdown-link">' + khIcon('settings', 'Admin CMS', 'kh-ui-icon-sm') + '</a>' : '')
        + (isTutor ? '<a href="korehan-tutor-7v3ca.html" class="kh-user-dropdown-link">' + khIcon('graduation-cap', 'Tutor Dashboard', 'kh-ui-icon-sm') + '</a>' : '')
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
            statsEl.innerHTML = '<span style="display:inline-flex;align-items:center;gap:5px"><span style="display:inline-flex;width:13px;height:13px;color:#a78bfa">'+KH_ICON_SPARKLE+'</span><span>XP ' + xp.toLocaleString() + ' · </span><span style="display:inline-flex;width:13px;height:13px;color:#fbbf24">'+KH_ICON_PAW+'</span><span>냥 ' + coin.toLocaleString() + '</span></span>';
          })
          .catch(function(){});
      })();
    }
    if (adminBtn) adminBtn.style.display = isAdmin ? 'inline-block' : 'none';
  } else {
    // Logged out state. The display gate used to read
    // `window._sessionChecked` so the buttons stayed hidden until
    // the session check finished — but the IIFE at the top of
    // this file already injects #kh-auth-flash-guard whenever a
    // stored token exists, which handles the flash case via CSS.
    // Layering both gates created a race: if updateAuthUI ran
    // during init with _sessionChecked=false the buttons got
    // display:none and stayed that way whenever the second pass
    // (which would have flipped them back) hit a hung getSession
    // / exchangeCodeForSession / setSession await. The user's
    // "갑자기 로그인이 안됨, 우측 상단 공백" report.
    if (signinBtn) {
      signinBtn.textContent = 'Sign In';
      signinBtn.style.display = '';
      signinBtn.onclick = function(e){ e.preventDefault(); openAuthModal("signin"); };
    }
    if (authMenu) authMenu.style.display = 'none';
    if (userAvatar) userAvatar.style.display = 'none';
    if (userDrop) userDrop.classList.remove('on');
    if (adminBtn) adminBtn.style.display = 'none';
  }
  // Join Free button: only visible when logged out (no
  // _sessionChecked gate — same reason as signinBtn above).
  var joinBtn = document.getElementById('topbar-join-btn');
  if (joinBtn) joinBtn.style.display = supaUser ? 'none' : '';
  updateSidebarAuth();
  injectMobileBottomNav();
  setupImmersiveReading();
  renderKhLucideIcons();
  scheduleSignupNudge();
}

// ══════════════════════════════════════════════════════════════════
// Notifications (in-app inbox)
//
// Lives in the header. Polls notifications every 30s while the tab
// is visible and the user is signed in. Unread count drives the red
// chip on the bell; clicking the bell opens a dropdown with the most
// recent 20 entries. Friend-request notifications expose inline
// Accept / Decline buttons that call the same RPCs the profile page
// uses, so the user can resolve a request without navigating.
// ══════════════════════════════════════════════════════════════════

var _khNotifPollTimer = null;
var _khNotifRows = [];
var _khNotifCount = 0;
var _khNotifAuthorMap = {};

function khStartNotifications() {
  if (_khNotifPollTimer || typeof supaUser === 'undefined' || !supaUser) return;
  khLoadNotifications();
  _khNotifPollTimer = setInterval(function () {
    if (typeof supaUser === 'undefined' || !supaUser) {
      clearInterval(_khNotifPollTimer); _khNotifPollTimer = null; return;
    }
    if (document.visibilityState === 'visible') khLoadNotifications();
  }, 30000);
  document.addEventListener('click', _khNotifMaybeCloseDropdown, true);
}

async function khLoadNotifications() {
  var sb = (typeof getSupa === 'function') ? getSupa() : null;
  if (!sb || typeof supaUser === 'undefined' || !supaUser) return;
  try {
    var r = await sb.from('notifications')
      .select('id, kind, payload, read_at, created_at')
      .eq('user_id', supaUser.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (r.error) return;
    _khNotifRows = r.data || [];
    _khNotifCount = _khNotifRows.filter(function (n) { return !n.read_at; }).length;

    // Resolve display names for the senders referenced in the payloads
    // so the UI can show "Alice sent you a friend request" instead of
    // "<uuid> sent...". One IN(...) query per refresh.
    var ids = new Set();
    _khNotifRows.forEach(function (n) {
      var p = n.payload || {};
      if (p.from)      ids.add(p.from);
      if (p.friend_id) ids.add(p.friend_id);
    });
    if (ids.size) {
      var us = await sb.from('user_stats')
        .select('user_id, display_name')
        .in('user_id', Array.from(ids));
      _khNotifAuthorMap = {};
      ((us && us.data) || []).forEach(function (u) { _khNotifAuthorMap[u.user_id] = u.display_name; });
    }

    _khRenderNotifBell();
    _khRenderNotifDropdown();
  } catch (_) { /* ignore poll failures */ }
}

function _khRenderNotifBell() {
  var chip = document.getElementById('topbar-notif-count');
  if (!chip) return;
  if (_khNotifCount > 0) {
    chip.textContent = _khNotifCount > 99 ? '99+' : String(_khNotifCount);
    chip.hidden = false;
  } else {
    chip.hidden = true;
  }
}

function _khRenderNotifDropdown() {
  var drop = document.getElementById('topbar-notif-dropdown');
  if (!drop) return;
  var head = '<div class="kh-notif-head">'
    +   '<div class="kh-notif-head-title">Notifications</div>'
    +   (_khNotifCount > 0 ? '<button class="kh-notif-mark-all" type="button" onclick="khMarkAllNotifsRead()">Mark all read</button>' : '')
    + '</div>';
  if (!_khNotifRows.length) {
    drop.innerHTML = head + '<div class="kh-notif-empty">No notifications yet.</div>';
    return;
  }
  var listHtml = _khNotifRows.map(_khRenderNotifItem).join('');
  drop.innerHTML = head + '<div class="kh-notif-list">' + listHtml + '</div>';
  if (typeof renderKhLucideIcons === 'function') renderKhLucideIcons();
}

function _khRenderNotifItem(n) {
  var p = n.payload || {};
  var unread = !n.read_at;
  var iconName = 'bell';
  var text = '';
  var actionsHtml = '';
  // Per-kind landing target for click-through. The whole row becomes
  // a link to this URL so the user lands on the spot the event
  // happened. Action buttons (Accept / Decline) e.stopPropagation()
  // so they don't trigger the row navigation.
  var targetHref = '#';
  var meId = (typeof supaUser !== 'undefined' && supaUser) ? supaUser.id : '';
  if (n.kind === 'friend_request') {
    iconName = 'user-plus';
    var nameFr = _khNotifAuthorMap[p.from] || 'A learner';
    text = _khEsc(nameFr) + ' sent you a friend request.';
    targetHref = 'korehan-friends.html#pending';
    if (p.request_id) {
      actionsHtml = '<div class="kh-notif-item-actions">'
        + '<button class="kh-notif-item-btn kh-notif-item-btn-primary" onclick="event.preventDefault();event.stopPropagation();khAcceptFriendFromBell(\'' + p.request_id + '\', this)">Accept</button>'
        + '<button class="kh-notif-item-btn kh-notif-item-btn-ghost" onclick="event.preventDefault();event.stopPropagation();khRejectFriendFromBell(\'' + p.request_id + '\', this)">Decline</button>'
        + '</div>';
    }
  } else if (n.kind === 'friend_accepted') {
    iconName = 'user-check';
    var nameFa = _khNotifAuthorMap[p.friend_id] || 'A learner';
    text = 'You\'re now friends with ' + _khEsc(nameFa) + '.';
    targetHref = p.friend_id ? ('korehan-profile.html?user=' + encodeURIComponent(p.friend_id)) : 'korehan-friends.html';
  } else if (n.kind === 'guestbook_post') {
    iconName = 'message-square';
    var nameGb = _khNotifAuthorMap[p.from] || 'A friend';
    var preview = p.preview ? ' · "' + _khEsc(p.preview) + '"' : '';
    text = _khEsc(nameGb) + ' left a note on your wall' + preview;
    // Land on your own profile so you see the new guestbook entry.
    targetHref = meId ? ('korehan-profile.html?user=' + encodeURIComponent(meId) + '#guestbook') : '#';
  } else if (n.kind === 'comment_reply') {
    iconName = 'message-circle';
    var nameCr = _khNotifAuthorMap[p.from] || 'A learner';
    var prevCr = p.preview ? ' · "' + _khEsc(p.preview) + '"' : '';
    text = _khEsc(nameCr) + ' replied to your comment' + prevCr;
    targetHref = p.article_id
      ? ('korehan-article.html?id=' + encodeURIComponent(p.article_id) + '#cm-' + (p.reply_id || p.parent_id || ''))
      : '#';
  } else if (n.kind === 'badge_earned') {
    iconName = 'award';
    text = 'You earned a new badge: <strong>' + _khEsc(p.name || '') + '</strong>';
    targetHref = 'korehan-mypage.html#badges';
  } else if (n.kind === 'streak_freeze_used') {
    iconName = 'snowflake';
    var rem = (typeof p.remaining === 'number') ? (' · ' + p.remaining + ' left') : '';
    text = 'We used a streak freeze to save your streak yesterday' + _khEsc(rem) + '.';
    targetHref = 'korehan-learning-overview.html';
  } else if (n.kind === 'streak_freeze_awarded') {
    iconName = 'snowflake';
    var grant = p.granted || 1;
    var st = p.streak ? (' (' + p.streak + '-day streak)') : '';
    text = 'You earned <strong>' + grant + ' streak freeze' + (grant > 1 ? 's' : '') + '</strong>' + _khEsc(st) + '. We\'ll auto-spend them on missed days.';
    targetHref = 'korehan-learning-overview.html';
  } else if (n.kind === 'room_visit') {
    iconName = 'door-open';
    var nameRv = _khNotifAuthorMap[p.from] || 'A learner';
    text = _khEsc(nameRv) + ' visited your room.';
    targetHref = p.from ? ('korehan-profile.html?user=' + encodeURIComponent(p.from)) : '#';
  } else if (n.kind === 'feedback_received') {
    iconName = 'message-square';
    var topicFr = p.topic ? (' on "' + _khEsc(String(p.topic).slice(0, 32)) + (String(p.topic).length > 32 ? '…' : '') + '"') : '';
    text = 'Your tutor sent feedback' + topicFr + '.';
    // Land on Growth Lab feedback list. The submission_id is
    // payload.submission_id when the row is fresh; we just deep-
    // link to the feedback section and let the page open the
    // matching item.
    targetHref = 'korehan-learning-overview.html#feedback'
      + (p.submission_id ? ('-' + encodeURIComponent(p.submission_id)) : '');
  } else {
    iconName = 'info';
    text = _khEsc(p.message || 'New notification');
  }
  // Wrap the row in an <a> so clicking anywhere on the card (except
  // Accept/Decline which stopPropagation) navigates to the target.
  // mark_notifications_read fires on click so the bell badge clears
  // for the navigated item even before the next poll.
  var clickAttr = ' onclick="khNotifItemClick(event,\'' + escapeAttr(n.id) + '\')"';
  return '<a class="kh-notif-item ' + (unread ? 'kh-notif-item-unread' : '') + '"'
    +    ' href="' + targetHref + '"' + clickAttr + ' style="text-decoration:none;color:inherit">'
    +    '<div class="kh-notif-item-icon"><i data-lucide="' + iconName + '" class="kh-ui-icon" aria-hidden="true"></i></div>'
    +    '<div class="kh-notif-item-body">'
    +      '<div class="kh-notif-item-text">' + text + '</div>'
    +      '<div class="kh-notif-item-time">' + _khTimeAgo(n.created_at) + '</div>'
    +      actionsHtml
    +    '</div>'
    +  '</a>';
}

// Mark the clicked notification as read before the browser navigates
// — fire and forget; the navigation continues regardless. Closing
// the dropdown so it isn't still draped over the destination.
window.khNotifItemClick = function (ev, id) {
  try {
    var drop = document.getElementById('topbar-notif-dropdown');
    if (drop) drop.classList.remove('on');
    var sb = (typeof getSupa === 'function') ? getSupa() : null;
    if (sb && id) {
      sb.rpc('mark_notifications_read', { p_ids: [id] }).then(function(){}).catch(function(){});
    }
  } catch (_) {}
};

function _khEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function _khTimeAgo(iso) {
  if (!iso) return '';
  var ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return 'just now';
  var m = Math.floor(ms / 60000); if (m < 60) return m + 'm';
  var h = Math.floor(m / 60); if (h < 24) return h + 'h';
  var d = Math.floor(h / 24); if (d < 7) return d + 'd';
  return new Date(iso).toLocaleDateString();
}

window.khToggleNotifDropdown = function (ev) {
  if (ev) { ev.preventDefault(); ev.stopPropagation(); }
  var drop = document.getElementById('topbar-notif-dropdown');
  if (!drop) return;
  var nowOn = !drop.classList.contains('on');
  drop.classList.toggle('on', nowOn);
  if (nowOn) {
    // Refresh on open so the dropdown is never stale.
    khLoadNotifications();
  }
};

function _khNotifMaybeCloseDropdown(ev) {
  var drop = document.getElementById('topbar-notif-dropdown');
  var btn  = document.getElementById('topbar-notif-btn');
  if (!drop || !drop.classList.contains('on')) return;
  if (drop.contains(ev.target) || (btn && btn.contains(ev.target))) return;
  drop.classList.remove('on');
}

window.khMarkAllNotifsRead = async function () {
  var sb = (typeof getSupa === 'function') ? getSupa() : null;
  if (!sb || typeof supaUser === 'undefined' || !supaUser) return;
  try {
    await sb.rpc('mark_notifications_read', { p_ids: null });
    _khNotifRows = _khNotifRows.map(function (n) { return Object.assign({}, n, { read_at: n.read_at || new Date().toISOString() }); });
    _khNotifCount = 0;
    _khRenderNotifBell();
    _khRenderNotifDropdown();
  } catch (_) {}
};

window.khAcceptFriendFromBell = async function (requestId, btn) {
  var sb = (typeof getSupa === 'function') ? getSupa() : null;
  if (!sb || !requestId) return;
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  try {
    await sb.rpc('accept_friend_request', { p_request_id: requestId });
    await khLoadNotifications();
  } catch (_) {
    if (btn) { btn.disabled = false; btn.textContent = 'Accept'; }
  }
};

window.khRejectFriendFromBell = async function (requestId, btn) {
  var sb = (typeof getSupa === 'function') ? getSupa() : null;
  if (!sb || !requestId) return;
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  try {
    await sb.rpc('reject_friend_request', { p_request_id: requestId });
    await khLoadNotifications();
  } catch (_) {
    if (btn) { btn.disabled = false; btn.textContent = 'Decline'; }
  }
};

// Re-render the bell dropdown on auth changes so the polling timer
// kicks in right after sign-in without waiting for the next page load.
window.addEventListener('kh-auth-signed-in', function () { khStartNotifications(); });
window.addEventListener('kh-auth-signed-out', function () {
  if (_khNotifPollTimer) { clearInterval(_khNotifPollTimer); _khNotifPollTimer = null; }
  _khNotifRows = []; _khNotifCount = 0;
  _khRenderNotifBell(); _khRenderNotifDropdown();
});

// Sticky sign-up nudge for unauthenticated visitors. Shows 30s after
// a session-confirmed-anonymous load, on public content pages where a
// sign-up CTA would actually pay off (news / learn / stories /
// conversations / article / section list pages). Skipped on auth-only
// flows (study room login wall, onboarding) and on legal/admin pages.
// Dismiss state is stored in sessionStorage so the same browsing
// session doesn't re-show, but a return visitor sees it again.
var _khSignupNudgeArmed = false;
function scheduleSignupNudge() {
  if (_khSignupNudgeArmed) return;
  if (supaUser) return;
  if (!window._sessionChecked) {
    // Wait for session check, then re-evaluate.
    setTimeout(scheduleSignupNudge, 800);
    return;
  }
  if (supaUser) return; // logged in by the time the timeout fired
  var p = pageName();
  var publicPages = [
    'index', 'korehan-news', 'korehan-learn', 'korehan-stories',
    'korehan-conversations', 'korehan-article', 'korehan-section',
    'korehan-world', 'korehan-society', 'korehan-culture', 'korehan-korea',
    'korehan-courses', 'korehan-fun', 'beginner-guide'
  ];
  if (publicPages.indexOf(p) === -1) return;
  try { if (sessionStorage.getItem('kh_signup_nudge_dismissed') === '1') return; } catch(_) {}
  _khSignupNudgeArmed = true;
  setTimeout(showSignupNudge, 30_000);
}
function showSignupNudge() {
  if (supaUser) return;
  if (document.getElementById('kh-signup-nudge')) return;
  // The article/story content gate already shows a sign-up CTA inline,
  // so the floating nudge would be redundant. Skip it on those pages.
  if (document.querySelector('.kh-gate-cta[data-kh-gate="1"]')) return;
  try { if (sessionStorage.getItem('kh_signup_nudge_dismissed') === '1') return; } catch(_) {}

  var el = document.createElement('div');
  el.id = 'kh-signup-nudge';
  el.style.cssText = 'position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:1500;'
    + 'max-width:min(560px,calc(100vw - 24px));width:auto;'
    + 'background:linear-gradient(135deg,#0f2342,#1e3a5f);color:#fff;'
    + 'border:1px solid rgba(125,211,252,.35);border-radius:16px;'
    + 'box-shadow:0 12px 36px rgba(0,0,0,.35);padding:14px 16px;'
    + 'display:flex;align-items:center;gap:12px;'
    + 'font-family:inherit;animation:khNudgeIn .3s ease-out';
  // Mobile bottom-nav is ~64px tall, so we sit above it.
  if (window.innerWidth <= 860) el.style.bottom = '88px';

  el.innerHTML = ''
    + '<div style="display:inline-flex;width:24px;height:24px;flex-shrink:0;color:#a78bfa">'+KH_ICON_LIBRARY+'</div>'
    + '<div style="flex:1;min-width:0">'
    + '<div style="font-size:13px;font-weight:800;line-height:1.3;color:#fff;margin-bottom:2px">Save your progress for free</div>'
    + '<div style="font-size:11px;color:rgba(255,255,255,.6);line-height:1.4">Sign up to track streaks, save words, and get personalized lessons.</div>'
    + '</div>'
    + '<button id="kh-signup-nudge-cta" style="flex-shrink:0;padding:9px 14px;border-radius:10px;background:linear-gradient(135deg,#38bdf8,#2563eb);border:none;color:#fff;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap">Sign up</button>'
    + '<button id="kh-signup-nudge-close" aria-label="Dismiss" style="flex-shrink:0;width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,.08);border:none;color:rgba(255,255,255,.55);font-size:16px;cursor:pointer;font-family:inherit;line-height:1">×</button>';

  if (!document.getElementById('kh-nudge-style')) {
    var style = document.createElement('style');
    style.id = 'kh-nudge-style';
    style.textContent = '@keyframes khNudgeIn{from{opacity:0;transform:translate(-50%,16px)}to{opacity:1;transform:translate(-50%,0)}}';
    document.head.appendChild(style);
  }
  document.body.appendChild(el);

  document.getElementById('kh-signup-nudge-cta').onclick = function() {
    try { sessionStorage.setItem('kh_signup_nudge_dismissed', '1'); } catch(_) {}
    if (typeof openAuthModal === 'function') openAuthModal('signup');
    el.remove();
    if (typeof khTrack === 'function') khTrack('signup_nudge_clicked');
  };
  document.getElementById('kh-signup-nudge-close').onclick = function() {
    try { sessionStorage.setItem('kh_signup_nudge_dismissed', '1'); } catch(_) {}
    el.remove();
    if (typeof khTrack === 'function') khTrack('signup_nudge_dismissed');
  };
  if (typeof khTrack === 'function') khTrack('signup_nudge_shown', { page: pageName() });
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
  // Toggle mobile light mode when neon changes
  if (document.body.classList.contains('mobile-redesign')) {
    var isStudyRoom = pageName() === 'korehan-study-room';
    document.body.classList.toggle('mobile-light', !on && !isStudyRoom);
  }
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

// ── Shared loading / empty / error state HTML builders ─────────
// Call-sites used to scatter ad-hoc "Loading..." markup everywhere
// which meant bare gray text when an API stalled and no retry path
// when it failed. These helpers produce the same visual everywhere
// so a skeleton here looks like a skeleton there, and the error
// state always offers the user an explicit retry instead of asking
// them to refresh the whole page.

// Render an empty-or-error state. Usage:
//   el.innerHTML = khEmptyState({
//     title: 'Nothing to show yet',
//     sub:   'Read an article to see your vocabulary here.',
//     action: { label: 'Browse articles', onClick: 'location.href=\'/\'' },
//   });
// onClick is an inline attribute string so this works cleanly when
// injected via innerHTML without needing to re-wire event listeners
// on re-render. Pass { error: true } to style it red for failure.
// Opt-in debug logging. Production console gets noisy fast (audit
// counted 26+ console.log in Study Room alone, plus every cache /
// resolver path emits debug lines). A learner opening DevTools to
// inspect the page shouldn't see a wall of [hero-video], [cache],
// [fj] traces — that reads as "unfinished" for a paid product.
//
// Toggle on from the console:  localStorage.kh_debug = '1'
// Toggle off: localStorage.removeItem('kh_debug')
var _khDebug = (function() {
  try { return localStorage.getItem('kh_debug') === '1'; } catch (_) { return false; }
})();
function khLog() {
  if (!_khDebug) return;
  try { console.log.apply(console, arguments); } catch (_) {}
}
function khWarn() {
  if (!_khDebug) return;
  try { console.warn.apply(console, arguments); } catch (_) {}
}
function khErr() {
  if (!_khDebug) return;
  try { console.error.apply(console, arguments); } catch (_) {}
}
function khDebugEnabled() { return _khDebug; }

// Production console hygiene. Hundreds of console.warn / console.error
// calls across the codebase leak internal state (user ids, topic ids,
// AI response excerpts, Supabase error objects) into the visible
// DevTools console of every visitor. Silence them unless `kh_debug=1`
// is set in localStorage. Real errors still reach window.onerror /
// any installed error monitor (Sentry etc.) — only the console
// surface is muted. console.log was already gated via khLog so it's
// not touched here.
(function muteConsoleInProduction(){
  if (_khDebug) return;
  if (typeof console === 'undefined') return;
  try {
    var origWarn = console.warn.bind(console);
    var origErr  = console.error.bind(console);
    console.warn  = function(){};
    console.error = function(){};
    // Re-expose originals on the kh object for in-app use if ever needed.
    window.__kh_origConsole = { warn: origWarn, error: origErr };
  } catch(_) {}
})();

// Small share helper. Falls back through three layers:
//   1. Web Share API (mobile Safari/Chrome, Android) — native sheet.
//   2. Clipboard write — desktop.
//   3. toast() confirmation so the user knows something happened
//      whichever path fired.
// Usage:
//   khShare({
//     title: 'Today\'s Korean quiz',
//     text:  'I scored 8/10 on a Korean reading quiz on KoreHani.',
//     url:   'https://korehani.com/...',
//   });
function khShare(opts) {
  opts = opts || {};
  var payload = {
    title: opts.title || document.title || 'KoreHani',
    text:  opts.text  || '',
    url:   opts.url   || window.location.href,
  };
  if (navigator.share) {
    return navigator.share(payload).then(function(){
      toast('Shared', 'success');
    }).catch(function(e) {
      // User cancelled — not an error, stay quiet.
      if (e && e.name === 'AbortError') return;
      return _khShareClipboard(payload);
    });
  }
  return _khShareClipboard(payload);
}
// Service Worker registration. Gives us "you've read this before →
// you can still read it offline" + "static shell (CSS/JS) loads
// instantly on repeat visits" without any backend changes. The SW
// itself lives at /korehan/sw.js and only caches same-origin assets
// — Supabase / Anthropic / CDN fetches pass straight through.
//
// Skip in dev (localhost) and during the initial signed-out flash
// guard so the onboarding redirect fires from the real server.
(function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  // Wait until page load so the SW install doesn't compete with the
  // first paint budget.
  window.addEventListener('load', function() {
    // First, evict the old `/korehan/` scoped registration that never
    // actually intercepted anything in production (Vite builds the
    // korehan/ folder as the dist root, so the live paths are /…, not
    // /korehan/…). Without this cleanup users would carry a dead
    // registration around forever.
    if (navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        regs.forEach(function(r) {
          var s = r && r.scope || '';
          if (/\/korehan\/$/.test(s)) { try { r.unregister(); } catch(_) {} }
        });
      }).catch(function(){});
    }
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch(function(err) { khLog('[sw] register failed:', err); });
  });
})();

// "You're offline" banner. Fires only when the browser *was* online
// and just lost connection — we don't want to pop a banner on
// initial load for a user who is already on a plane, since the
// Service Worker shell will handle that experience.
(function offlineBanner() {
  if (typeof window === 'undefined') return;
  function show() {
    if (document.getElementById('kh-offline-banner')) return;
    var b = document.createElement('div');
    b.id = 'kh-offline-banner';
    b.textContent = 'You\'re offline — showing cached content where available.';
    b.style.cssText =
      'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9998;' +
      'background:#0b1626;color:#fff;padding:9px 16px;border-radius:999px;' +
      'font-size:12px;font-weight:700;font-family:inherit;letter-spacing:.01em;' +
      'box-shadow:0 6px 20px rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.15);' +
      'max-width:92vw;text-align:center';
    document.body.appendChild(b);
  }
  function hide() {
    var b = document.getElementById('kh-offline-banner');
    if (b) b.remove();
  }
  window.addEventListener('offline', show);
  window.addEventListener('online', hide);
})();

// Lightweight active-session tracker. Records minutes the learner
// has actually been engaged — tab visible AND they interacted
// (scroll / keystroke / touch) within the last 60 seconds — rather
// than wall-clock time, which would count "left the tab open all
// day" as 8 hours of study. Stored per-day in localStorage and
// surfaced on Growth Lab so the learner sees their daily time
// investment climbing. Purely client-side for now; can be synced
// to Supabase once a study_time column is added.
(function initSessionTracker() {
  var IDLE_MS = 60 * 1000;
  var TICK_MS = 5 * 1000;
  var lastActivity = Date.now();
  function bumpActivity() { lastActivity = Date.now(); }
  ['pointerdown','keydown','scroll','touchstart','wheel','mousemove'].forEach(function(ev) {
    document.addEventListener(ev, bumpActivity, { passive: true, capture: true });
  });

  function todayKey() {
    var d = new Date();
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return 'kh_session_sec_' + yyyy + '-' + mm + '-' + dd;
  }
  function getToday() {
    try { return parseInt(localStorage.getItem(todayKey()) || '0', 10) || 0; }
    catch(_) { return 0; }
  }
  function addToday(seconds) {
    try { localStorage.setItem(todayKey(), String(getToday() + seconds)); }
    catch(_) {}
  }
  setInterval(function() {
    if (document.hidden) return;
    if (Date.now() - lastActivity > IDLE_MS) return;
    addToday(Math.round(TICK_MS / 1000));
  }, TICK_MS);

  // Public read helper for Growth Lab and similar surfaces.
  window.khGetSessionSecondsToday = getToday;
  window.khGetSessionMinutesToday = function() { return Math.round(getToday() / 60); };
})();

function _khShareClipboard(payload) {
  var copy = (payload.text ? payload.text + '\n' : '') + payload.url;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(copy).then(function(){
      toast('Link copied', 'success');
    }).catch(function() {
      toast('Copy not available — long-press the link to copy', 'warn');
    });
  }
  // Legacy browsers: fall back to a hidden textarea.
  try {
    var ta = document.createElement('textarea');
    ta.value = copy;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(ta);
    ta.select();
    var ok = document.execCommand('copy');
    document.body.removeChild(ta);
    toast(ok ? 'Link copied' : 'Copy not available', ok ? 'success' : 'warn');
  } catch(_) {
    toast('Copy not available', 'warn');
  }
  return Promise.resolve();
}

function articleUrl(id) {
  return 'korehan-article.html?id=' + encodeURIComponent(id);
}

// ── SEED DATA ─────────────────────────────────────────────────
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
  // 400x260 is 2x the ~168px card CSS width — sharp on retina, 1/4 the
  // bytes of the old 600x400 fallback. decoding='async' lets the
  // browser decode off the main thread; fetchpriority='low' tells it
  // these belong at the back of the queue so the hero image loads first.
  var img = khArticleThumb(a, 400, 260);
  var tc  = extraTagClass || '';
  var levelColors = { 'Starter':'#f3e8ff;color:#6b21a8', 'Beginner':'#e8f5e9;color:#2e7d32', 'Intermediate':'#fff8e1;color:#f57f17', 'Advanced':'#fce4ec;color:#c62828' };
  var levelBadge = a.level ? '<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;background:' + (levelColors[a.level] || '#f0f0f0;color:#666') + '">' + ({Starter:'Seed',Beginner:'Sprout',Intermediate:'Tree',Advanced:'Forest'}[a.level]||a.level) + '</span>' : '';
  return '<a href="' + articleUrl(a.id) + '" style="color:inherit;text-decoration:none;">'
    + '<div class="card">'
    + '<img src="' + img + '" alt="" loading="lazy" decoding="async" fetchpriority="low">'
    + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'
    + '<div class="tag' + (tc ? ' ' + tc : '') + '">' + a.section + '</div>'
    + levelBadge
    + '</div>'
    + '<h3 class="vocab-zone" data-kh-title-id="' + escapeHtml(a.id || '') + '">' + (a.title_en || a.title) + '</h3>'
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
  var img = khArticleThumb(a, 400, 260);
  return '<a href="' + articleUrl(a.id) + '" style="color:inherit;text-decoration:none;">'
    + '<div class="story-item">'
    + '<img src="' + img + '" alt="" loading="lazy">'
    + '<div>'
    + '<h4 class="vocab-zone">' + a.title + '</h4>'
    + '<div class="meta">' + a.section + ' · ' + relTime(a.date) + '</div>'
    + '</div></div></a>';
}

function heroSideItemHTML(a) {
  // Hero sidebar lists small vertical thumbnails; 480x320 covers retina
  // at a slightly larger render width than the grid cards.
  var img = khArticleThumb(a, 480, 320);
  return '<a href="' + articleUrl(a.id) + '" style="color:inherit;text-decoration:none;display:block;">'
    + '<div class="hero-side-item">'
    + '<img src="' + img + '" alt="" loading="lazy" decoding="async" fetchpriority="low">'
    + '<h3 class="vocab-zone" data-kh-title-id="' + escapeHtml(a.id || '') + '">' + (a.title_en || a.title) + '</h3>'
    + '<p class="meta">' + a.section + ' · ' + relTime(a.date) + '</p>'
    + '</div></a>';
}

// ── EN TITLE HYDRATION ────────────────────────────────────────
// Articles sometimes ship without a title_en (admin didn't fill it in).
// We never want to show a Korean headline on an EN-first thumbnail, so:
//   1) Hydrate from localStorage synchronously before the first paint.
//   2) After the initial render, batch any still-missing titles through
//      Claude (haiku) once, cache to localStorage, and swap the text.
function _khHydrateTitlesEnFromCache(articles) {
  if (!Array.isArray(articles)) return;
  articles.forEach(function(a) {
    if (!a || !a.id) return;
    if (a.title_en && String(a.title_en).trim()) return;
    try {
      var cached = localStorage.getItem('kh_title_en_' + a.id);
      if (cached) a.title_en = cached;
    } catch(e) {}
  });
}
function _khApplyTitlesEnToDOM() {
  var nodes = document.querySelectorAll('[data-kh-title-id]');
  nodes.forEach(function(el) {
    var id = el.getAttribute('data-kh-title-id');
    if (!id) return;
    var t;
    try { t = localStorage.getItem('kh_title_en_' + id); } catch(e) {}
    if (!t) {
      // fall back to an article object in memory
      var a = (typeof published === 'function') ? published().find(function(x){ return String(x.id) === String(id); }) : null;
      if (a && a.title_en) t = a.title_en;
    }
    if (t && el.textContent !== t) el.textContent = t;
  });
}
async function _khEnsureTitlesEn(articles) {
  if (!Array.isArray(articles) || !articles.length) return;
  _khHydrateTitlesEnFromCache(articles);
  var needed = articles.filter(function(a) {
    if (!a || !a.id) return false;
    if (a.title_en && String(a.title_en).trim()) return false;
    return a.title && /[\u3131-\uD79D]/.test(a.title);
  });
  if (!needed.length) return;
  // Batch in chunks of 15 headlines per Claude call
  for (var i = 0; i < needed.length; i += 15) {
    var chunk = needed.slice(i, i + 15);
    var prompt = 'Translate each Korean news headline into natural, concise English (journalistic tone, ≤70 chars, no surrounding quotes). Return ONLY a JSON array of strings in the same order as the input. No commentary, no numbering in the output.\n\nHeadlines:\n'
      + chunk.map(function(a, idx){ return (idx + 1) + '. ' + a.title; }).join('\n');
    try {
      var res = await callClaude({
        feature: 'title-en',
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 900,
        messages: [{ role: 'user', content: prompt }]
      });
      var text = (res && res.content && res.content[0] && res.content[0].text) || '[]';
      var ai = text.indexOf('['), bi = text.lastIndexOf(']');
      if (ai >= 0 && bi > ai) text = text.slice(ai, bi + 1);
      var arr = JSON.parse(text);
      if (Array.isArray(arr)) {
        chunk.forEach(function(a, idx) {
          var t = arr[idx];
          if (typeof t === 'string' && t.trim()) {
            a.title_en = t.trim();
            try { localStorage.setItem('kh_title_en_' + a.id, a.title_en); } catch(e) {}
          }
        });
      }
    } catch(e) { /* silent; Korean fallback stays */ }
  }
  _khApplyTitlesEnToDOM();
}

// ── 페이지 렌더러 ─────────────────────────────────────────────

var _heroSlides = [];
var _heroIdx = 0;
var _heroTimer = null;
var _heroTouchStartX = 0;
var _heroTouchDeltaX = 0;

// Replace the hero skeleton with an explicit "couldn't load" panel so
// the page doesn't look permanently broken when the article fetch
// wedges (Samsung Internet on phone is the reproducer — Supabase fetch
// hangs silently due to tab throttling / cookie partitioning). Called
// from the home boot path after the 12s race times out.
// Hard reset for browsers stuck in a corrupted-storage loop.
// Symptom (Samsung Internet phone, regular mode): a stale Supabase
// refresh_token in localStorage triggers an infinite refresh attempt,
// which wedges every subsequent sb.from(...) call. Hero never loads,
// post-OAuth profile never appears. Incognito works because there's
// nothing in storage. This nukes everything app-related and reloads.
//   - localStorage keys with sb-* (Supabase auth) or kh* (our caches)
//   - IndexedDB databases used by Supabase
//   - All Cache Storage entries
//   - Service worker registrations
// Wrapped in best-effort try/catch — even if any one step throws we
// still proceed to the next so the reload happens.
window._khResetClientStorage = async function _khResetClientStorage() {
  try {
    var toDrop = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k) continue;
      if (/^sb-/.test(k) || /^kh/.test(k) || /supabase/i.test(k)) toDrop.push(k);
    }
    toDrop.forEach(function(k){ try { localStorage.removeItem(k); } catch(_){} });
  } catch(_){}
  try { sessionStorage.clear(); } catch(_){}
  // Clear all readable cookies on this origin (Cloudflare bot-mgmt
  // cookies, consent flags, and any Supabase server-side helper
  // cookies). Iterating document.cookie misses HttpOnly entries —
  // those need an admin-issued logout, which we don't have here, but
  // the readable ones cover the wedge case the user is hitting.
  // Try expiring against every parent of the current hostname so a
  // domain=.korehani.com cookie also gets killed.
  try {
    var hostParts = (location.hostname || '').split('.');
    var domains = ['', location.hostname];
    for (var j = 0; j < hostParts.length - 1; j++) {
      domains.push('.' + hostParts.slice(j).join('.'));
    }
    document.cookie.split(';').forEach(function(pair){
      var eq = pair.indexOf('=');
      var name = (eq > -1 ? pair.slice(0, eq) : pair).trim();
      if (!name) return;
      domains.forEach(function(d){
        var suffix = (d ? '; domain=' + d : '');
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + suffix;
      });
    });
  } catch(_){}
  try {
    if (window.indexedDB && indexedDB.databases) {
      var dbs = await indexedDB.databases();
      await Promise.all((dbs || []).map(function(d){
        return new Promise(function(resolve){
          try { var req = indexedDB.deleteDatabase(d.name); req.onsuccess = req.onerror = req.onblocked = function(){ resolve(); }; }
          catch(_) { resolve(); }
        });
      }));
    }
  } catch(_){}
  try {
    if (window.caches && caches.keys) {
      var keys = await caches.keys();
      await Promise.all(keys.map(function(k){ return caches.delete(k); }));
    }
  } catch(_){}
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      var regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(function(r){ return r.unregister(); }));
    }
  } catch(_){}
  // Reload with a unique cache-buster so Samsung Internet can't serve
  // the HTML from its disk cache (it does this even when the response
  // is Cache-Control: no-cache). Adding a fresh ?_reset=<timestamp>
  // makes the URL unique → forced network fetch → new JS too.
  try {
    var base = window.location.pathname + (window.location.search || '');
    var sep = base.indexOf('?') > -1 ? '&' : '?';
    window.location = base + sep + '_reset=' + Date.now();
  } catch(_) { try { location.reload(); } catch(__){} }
};

// Top banner shown when OAuth round-trip completed but no session was
// established. Helps the user understand why they're back on the home
// page still signed-out (browser cleared the PKCE verifier between
// redirect to Google and back, or a stale token is wedging the SDK).
// Offers an explicit Reset Data button as the recovery path — that's
// the only thing that fixes the corrupt-storage case in practice.
function _khShowAuthFailureBanner() {
  if (document.getElementById('kh-auth-fail-banner')) return;
  var bar = document.createElement('div');
  bar.id = 'kh-auth-fail-banner';
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;padding:12px 16px;background:#fef3c7;color:#92400e;border-bottom:1px solid #fcd34d;font-size:13px;line-height:1.5;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;font-family:inherit;text-align:center';
  bar.innerHTML =
      '<span style="flex-basis:100%;max-width:540px">로그인이 완료되지 않았어요. 브라우저에 저장된 옛 인증 데이터가 막고 있을 수 있어요. <b>데이터 리셋</b>을 누르거나 Chrome에서 열어주세요.</span>'
    + '<button onclick="window._khResetClientStorage&&window._khResetClientStorage()" style="border:0;background:#dc2626;color:#fff;padding:7px 14px;border-radius:6px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit">🔄 데이터 리셋</button>'
    + '<button onclick="this.parentNode.remove()" style="border:0;background:#92400e;color:#fff;padding:7px 14px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">닫기</button>';
  document.body.appendChild(bar);
}

function _khRenderHeroEmptyState() {
  var heroEl = document.getElementById('dyn-hero');
  if (!heroEl) return;
  // If real articles arrived between the timeout and this call, leave
  // them alone — _heroSlides being non-empty means renderHeroSlide
  // already painted them.
  if (_heroSlides && _heroSlides.length) return;
  heroEl.className = '';
  heroEl.style.cssText = 'display:flex;align-items:center;justify-content:center;min-height:300px;border-radius:18px;background:#f8fbff;border:1px solid #e7eef8;padding:24px;text-align:center;';
  heroEl.innerHTML =
      '<div style="max-width:360px">'
    + '<div style="font-size:15px;font-weight:800;color:#0f172a;margin:0 0 6px">최신 기사를 불러오지 못했어요</div>'
    + '<div style="font-size:13px;color:#64748b;margin:0 0 14px;line-height:1.5">브라우저에 저장된 옛 데이터가 요청을 막고 있을 수 있어요. <b>데이터 리셋</b>으로 한 번에 정리하면 대부분 해결됩니다 (다시 로그인 필요).</div>'
    + '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">'
    +   '<button onclick="location.reload()" style="padding:9px 18px;border:1px solid #cbd5e1;border-radius:999px;background:#fff;color:#0f172a;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">다시 시도</button>'
    +   '<button onclick="window._khResetClientStorage&&window._khResetClientStorage()" style="padding:9px 18px;border:0;border-radius:999px;background:#dc2626;color:#fff;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit">🔄 데이터 리셋</button>'
    + '</div>'
    + '</div>';
}

// Belt-and-suspenders safety net: if the hero is still on the
// skeleton 15s after the page became interactive, force the empty
// state. This is for the truly-wedged case where the fetch never
// resolves and splash + main code paths all silently fail; under
// normal conditions the splash holds for up to 8s waiting for the
// hero, then the in-flight fetch's then/catch fires the empty
// state itself. 15s gives the splash + late-arriving fetch every
// chance to win first so the alarming red Reset button only
// appears when the user is genuinely stuck.
(function _khArmHeroSafetyNet() {
  if (typeof document === 'undefined') return;
  function arm() {
    var heroEl = document.getElementById('dyn-hero');
    if (!heroEl) return;
    setTimeout(function() {
      if (_heroSlides && _heroSlides.length) return;
      // Detect the still-skeleton case by class — initial markup has
      // home-hero-loading; a successful render replaces className.
      if (/home-hero-loading/.test(heroEl.className || '')) {
        try { _khRenderHeroEmptyState(); } catch(_){}
      }
    }, 15000);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arm, { once: true });
  } else {
    arm();
  }
})();

function renderHomePage() {
  var all      = published();
  // Hydrate any title_en from local cache *before* we build cards so
  // the first paint already shows English where we've seen it before.
  _khHydrateTitlesEnFromCache(all);
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

  // Async: translate any still-missing titles → updates DOM in place
  try { _khEnsureTitlesEn(all); } catch(e) {}
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
          var url = articleUrl(item.id);
          // Level chip (Korean reading-level meta)
          var LVL_LBL = {Starter:'Seed',Beginner:'Sprout',Intermediate:'Tree',Advanced:'Forest'};
          var LVL_ICON = {Starter:'sprout',Beginner:'leaf',Intermediate:'tree-deciduous',Advanced:'trees'};
          var lvlChip = item.level
            ? '<span class="kh-hero-chip kh-hero-chip-lvl-' + item.level + '" style="display:inline-flex;align-items:center;gap:5px"><i data-lucide="' + (LVL_ICON[item.level]||'leaf') + '" class="kh-ui-icon kh-ui-icon-sm" aria-hidden="true"></i><span>' + (LVL_LBL[item.level]||item.level) + '</span></span>'
            : '';
          var bodyPlain = (item.body || '').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
          var catChip = '<span class="kh-hero-chip kh-hero-chip-cat">' + item.section + '</span>';
          // Short excerpt — first ~90 Korean chars to fill the dead space below title
          var excerpt = bodyPlain.slice(0, 110);
          if (bodyPlain.length > 110) excerpt += '…';
          return '<article class="kh-home-hero-slide" style="min-width:100%;position:relative;min-height:460px;overflow:hidden;cursor:pointer" onclick="location.href=\'' + url + '\'">'
            + '<img src="' + featImg + '" alt="" fetchpriority="high" decoding="async" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;pointer-events:none;">'
            + '<div style="position:absolute;left:0;right:0;top:0;height:40%;background:linear-gradient(to bottom,rgba(5,15,35,.55) 0%,rgba(5,15,35,0) 100%);pointer-events:none;"></div>'
            + '<div style="position:absolute;left:0;right:0;bottom:0;height:72%;background:linear-gradient(to top,rgba(5,15,35,.94) 0%,rgba(5,15,35,.7) 30%,rgba(5,15,35,.28) 70%,rgba(5,15,35,0) 100%);pointer-events:none;"></div>'
            + '<div class="kh-hero-top-meta" style="position:absolute;top:16px;left:18px;right:18px;z-index:2;display:flex;align-items:center;flex-wrap:wrap;gap:6px;pointer-events:none">' + catChip + lvlChip + '</div>'
            + '<div style="position:absolute;left:0;right:0;bottom:0;padding:20px 22px 22px;max-width:760px;z-index:2;pointer-events:none;">'
            + '<h1 data-kh-title-id="' + escapeHtml(item.id || '') + '" style="font-family:\'Playfair Display\',\'Noto Serif KR\',serif;font-size:clamp(22px,3vw,42px);font-weight:900;line-height:1.2;margin:0 0 8px;color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.5)">' + (item.title_en || item.title) + '</h1>'
            + (excerpt ? '<p style="margin:0 0 10px;font-size:13px;line-height:1.55;color:rgba(255,255,255,.85);font-family:\'Noto Sans KR\',sans-serif;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-shadow:0 1px 6px rgba(0,0,0,.4)">' + excerpt + '</p>' : '')
            + '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">'
            +   '<span class="kh-hero-chip-when">' + relTime(item.date) + '</span>'
            +   '<span style="font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#fff;display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.32);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)">Read <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>'
            + '</div>'
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
      // Side list render width is ~98px → 320x200 covers retina DPR 2
      // at a quarter of the old 600x400 bytes.
      var img = khArticleThumb(a, 320, 200);
      return '<a href="' + articleUrl(a.id) + '" style="display:flex;gap:12px;padding:14px 16px;text-decoration:none;color:inherit;border-bottom:1px solid #edf2f7;transition:background .15s" onmouseover="this.style.background=\'#f2f7ff\'" onmouseout="this.style.background=\'\'">'
        + '<img src="' + img + '" alt="" loading="lazy" decoding="async" fetchpriority="low" style="width:98px;height:78px;object-fit:cover;border-radius:14px;flex-shrink:0;box-shadow:0 6px 18px rgba(15,23,42,.08)">'
        + '<div style="min-width:0;flex:1">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px"><span style="font-size:10px;font-weight:800;color:#2255a4;letter-spacing:.06em;text-transform:uppercase">' + a.section + '</span><span style="font-size:10px;color:#94a3b8">' + relTime(a.date) + '</span></div>'
        + '<div data-kh-title-id="' + escapeHtml(a.id || '') + '" style="font-size:13px;font-weight:800;color:#0f172a;line-height:1.45;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">' + (a.title_en || a.title) + '</div>'
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
  // Row renders at 220x140 → 440x280 is the matching retina-safe size.
  var aImg = khArticleThumb(a, 440, 280);
  var fallback = KH_IMG_PLACEHOLDER;
  var aBody = (a.body || '').replace(/<[^>]*>/g, '').slice(0, 90);
  return '<a href="' + articleUrl(a.id) + '" style="color:inherit;text-decoration:none;display:block;margin-bottom:20px;">'
    + '<div class="article-row">'
    + '<img src="' + aImg + '" alt="" loading="lazy" decoding="async" fetchpriority="low" onerror="this.src=\'' + fallback + '\'" style="width:220px;height:140px;object-fit:cover;border-radius:10px;flex-shrink:0;">'
    + '<div class="article-info">'
    + '<span class="category-tag" style="font-size:11px;padding:2px 8px;' + lvlStyle + '">' + (a.level ? ({Starter:'Seed',Beginner:'Sprout',Intermediate:'Tree',Advanced:'Forest'}[a.level]||a.level) : (a.section || '')) + '</span>'
    + '<h2 class="article-title vocab-zone" style="margin:8px 0 6px;font-size:18px;" data-kh-title-id="' + escapeHtml(a.id || '') + '">' + (a.title_en || a.title) + '</h2>'
    + '<p class="article-excerpt vocab-zone" style="font-size:14px;color:#64748b;line-height:1.6">' + aBody + '</p>'
    + '<div style="font-size:12px;color:#94a3b8;margin-top:6px">' + relTime(a.date) + '</div>'
    + '</div></div></a>';
}

function buildHeroHTML(featured, rest) {
  var fallback = 'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==';
  var img = khArticleThumb(featured, 900, 500);
  var body = (featured.body || '').replace(/<[^>]*>/g, '').slice(0, 120);
  return '<a href="' + articleUrl(featured.id) + '" style="color:inherit;text-decoration:none;">'
    + '<div class="hero-main">'
    + '<img src="' + img + '" alt="" fetchpriority="high" decoding="async" onerror="this.src=\'' + fallback + '\'">'
    + '<div class="overlay">'
    + '<span class="category-tag">' + (featured.section || '') + '</span>'
    + '<h1 class="vocab-zone" data-kh-title-id="' + escapeHtml(featured.id || '') + '">' + (featured.title_en || featured.title) + '</h1>'
    + '<p class="sub vocab-zone">' + body + '</p>'
    + '</div></div></a>'
    + '<div class="hero-side">' + rest.slice(0, 4).map(heroSideItemHTML).join('') + '</div>';
}

var SECTION_ALIASES = {
  '사회':    ['사회','Society','society','Social','social'],
  '국제':    ['국제','World','world','International','international','Global','global'],
  '문화':    ['문화','Culture','culture'],
  '연예':    ['연예','Entertainment','entertainment','Celeb','celeb','Celebrity','celebrity','show-biz','연예계'],
  'Korea':   ['Korea','korea','한국','Korean','korean'],
  '오피니언':['오피니언','Opinion','opinion'],
  'K-pop':   ['K-pop','Kpop','케이팝','kpop','k-pop'],
  'beauty':  ['beauty','Beauty','뷰티','미용','라이프스타일'],
  'travel':  ['travel','Travel','여행','관광','trip'],
  'IT과학':  ['IT과학','it과학','tech','Tech','Technology','technology','과학','Science','science','IT'],
  'nature':  ['nature','Nature','자연','동물','wildlife','Wildlife'],
  '역사':    ['역사','History','history'],
};

function getSectionKey(rawSection) {
  var val = String(rawSection || '').trim();
  if (!val) return '';
  if (SECTION_ALIASES[val]) return val;
  var low = val.toLowerCase();
  var keys = Object.keys(SECTION_ALIASES);
  for (var i = 0; i < keys.length; i++) {
    var aliases = SECTION_ALIASES[keys[i]];
    for (var j = 0; j < aliases.length; j++) {
      if (aliases[j].toLowerCase() === low) return keys[i];
    }
  }
  return low;
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

  // Hydrate cached EN titles before paint so the section page never
  // flashes Korean headlines for articles we've already translated.
  try { _khHydrateTitlesEnFromCache(articles); } catch(e) {}

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
  // Async: translate any still-missing titles → updates DOM in place
  try { _khEnsureTitlesEn(articles); } catch(e) {}
}


async function renderAllPage() {
  var articles = published();
  var listEl   = document.getElementById('dyn-article-list');
  if (!listEl) return;

  // Hydrate cached EN titles synchronously so the first paint already
  // shows English where we have it. Fresh translations get fetched at
  // the bottom of renderAllList().
  try { _khHydrateTitlesEnFromCache(articles); } catch(e) {}

  var params = new URLSearchParams(window.location.search);
  var searchQ = params.get('search') || '';

  var searchWrap = document.getElementById('dyn-search-bar');
  if (searchWrap) {
    // New unified hero chrome (May 2026): search lives inside the
    // page hero on a dark gradient. Pills use .kh-filter-pill so the
    // visual matches Stories / Conversations.
    searchWrap.innerHTML = '<div class="kh-page-search">'
      + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>'
      + '<input type="text" id="search-bar-input" placeholder="Search articles, topics, keywords\u2026" value="' + escapeHtml(searchQ) + '" onkeydown="if(event.key===\'Enter\')doSearch(this.value)">'
      + (searchQ ? '<button onclick="window.location.href=\'korehan-all.html\'" title="Clear search" style="background:none;border:0;color:rgba(255,255,255,.65);cursor:pointer;padding:4px;display:inline-flex;align-items:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' : '')
      + '<button onclick="doSearch(document.getElementById(\'search-bar-input\').value)" style="background:#fff;color:var(--kh-hue-1);border:0;border-radius:999px;padding:6px 14px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit">Search</button>'
      + '</div>'
      + (searchQ ? '<div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:8px">Results for <strong style="color:#fff">\u201c' + escapeHtml(searchQ) + '\u201d</strong></div>' : '')
      + '<div class="kh-filter-bar" id="all-level-filter" style="margin-top:12px">'
      + '<button class="kh-filter-pill on" data-level="All" onclick="filterAllLevel(\'All\',this)">All</button>'
      + '<button class="kh-filter-pill" data-level="Starter" onclick="filterAllLevel(\'Starter\',this)"><span class="kh-filter-dot" style="background:#7b5cff"></span>Seed</button>'
      + '<button class="kh-filter-pill" data-level="Beginner" onclick="filterAllLevel(\'Beginner\',this)"><span class="kh-filter-dot" style="background:#22c55e"></span>Sprout</button>'
      + '<button class="kh-filter-pill" data-level="Intermediate" onclick="filterAllLevel(\'Intermediate\',this)"><span class="kh-filter-dot" style="background:#f59e0b"></span>Tree</button>'
      + '<button class="kh-filter-pill" data-level="Advanced" onclick="filterAllLevel(\'Advanced\',this)"><span class="kh-filter-dot" style="background:#ef4444"></span>Forest</button>'
      + '</div>';
  }

  window._allArticlesCache = articles;

  if (searchQ) {
    // Server-side ilike across title/body/section. The bulk All News
    // fetch no longer ships body text, so we can't filter locally for
    // body — but on-demand server search is more accurate anyway since
    // it hits ALL articles, not just the 1000 we cached.
    listEl.innerHTML = '<div style="padding:60px;text-align:center;color:#94a3b8">Searching…</div>';
    var serverHits = [];
    try { serverHits = await searchArticlesServer(searchQ, 200); } catch(e) {}
    var lq = searchQ.toLowerCase();
    // English-title search.
    // Translated titles live in localStorage (kh_title_en_<id>)
    // because the articles table doesn't have a title_en column. The
    // server-side ilike therefore can't match English queries against
    // articles whose body is Korean — "india" returned 0 hits even
    // though "1895 photo of Patna, India" was sitting cached on
    // device. Hydrate title_en from localStorage and intersect
    // client-side so English search works against translated cards.
    try { _khHydrateTitlesEnFromCache(articles); } catch(_) {}
    var localTitleEnHits = articles.filter(function(a) {
      if (!a || !a.title_en) return false;
      return String(a.title_en).toLowerCase().indexOf(lq) !== -1;
    });
    // Section-key match (e.g. "tech" → beauty key) doesn't fit ilike
    // so we still augment with locally cached articles whose section
    // key matches the query.
    var localKeyHits = articles.filter(function(a) {
      var sk = (typeof getSectionKey === 'function') ? String(getSectionKey(a.section) || '') : '';
      return sk && sk.toLowerCase().indexOf(lq) !== -1;
    });
    var seen = {};
    articles = serverHits.concat(localTitleEnHits).concat(localKeyHits).filter(function(a) {
      if (!a || !a.id || seen[a.id]) return false;
      seen[a.id] = true;
      return true;
    });
    try { _khHydrateTitlesEnFromCache(articles); } catch(e) {}
  }

  // Rails layout when browsing freely; flat grid when searching so results
  // stay in relevance-ranked order instead of being re-grouped by section.
  renderAllList(listEl, articles, { flat: !!searchQ });
}

function _buildNewsCardHTML(a) {
  var lvl = a.level || '';
  var lvlCls = lvl === 'Advanced' ? 'lvl-a' : lvl === 'Intermediate' ? 'lvl-i' : lvl === 'Starter' ? 'lvl-s' : 'lvl-b';
  var cat = getSectionKey(a.section);
  var thumbSrc = (typeof khArticleThumb === 'function') ? khArticleThumb(a, 400, 260) : (a.image || '');
  var img = thumbSrc
    ? '<img class="nc-img" src="' + thumbSrc + '" alt="" loading="lazy" decoding="async" fetchpriority="low" onerror="this.onerror=null;this.src=\'https://picsum.photos/seed/\'+encodeURIComponent(this.dataset.fb||\'kh\')+\'/400/260\'" data-fb="' + escapeHtml(a.id || 'kh') + '">'
    : '<div class="nc-img nc-img-fallback"></div>';
  var dateStr = a.date ? new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  return '<div class="nc nc-overlay" data-section="' + escapeHtml(cat) + '" data-level="' + escapeHtml(lvl) + '" onclick="location.href=\'' + articleUrl(a.id) + '\'">'
    + img
    + '<div class="nc-overlay-grad"></div>'
    + '<div class="nc-overlay-body">'
    + '<div class="nc-meta"><span class="nc-cat">' + escapeHtml(a.section || '') + '</span>' + (lvl ? '<span class="nc-lvl ' + lvlCls + '">' + escapeHtml({Starter:'Seed',Beginner:'Sprout',Intermediate:'Tree',Advanced:'Forest'}[lvl]||lvl) + '</span>' : '') + '</div>'
    + '<div class="nc-title" data-kh-title-id="' + escapeHtml(a.id || '') + '">' + escapeHtml(a.title_en || a.title || '') + '</div>'
    + '<div class="nc-foot"><span class="nc-date">' + dateStr + '</span></div>'
    + '</div>'
    + '</div>';
}

function renderAllList(listEl, articles, opts) {
  if (!articles.length) {
    listEl.className = '';
    listEl.innerHTML = '<div class="all-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:32px;height:32px;margin-bottom:10px;opacity:.4"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><div>No articles found.</div></div>';
    return;
  }

  // Rails mode: Netflix-style — group by section when there is no active
  // filter (no search query, no non-All level filter). Falls back to the
  // flat grid for filtered/searched views so results stay scannable.
  var useRails = !(opts && opts.flat);
  if (useRails) {
    var bySection = {};
    articles.forEach(function(a) {
      var key = (typeof getSectionKey === 'function') ? getSectionKey(a.section) : (a.section || 'Other');
      if (!key) key = 'Other';
      if (!bySection[key]) bySection[key] = [];
      bySection[key].push(a);
    });

    // Rail order follows the configured section catalog, then anything left.
    var ordered = [];
    var seen = {};
    try {
      (typeof getSections === 'function' ? getSections() : []).forEach(function(s) {
        if (bySection[s.key]) { ordered.push({ key: s.key, label: s.label, icon: s.icon || '', items: bySection[s.key] }); seen[s.key] = true; }
      });
    } catch(e) {}
    Object.keys(bySection).forEach(function(k) {
      if (!seen[k]) ordered.push({ key: k, label: k, icon: '', items: bySection[k] });
    });

    if (!ordered.length) {
      listEl.className = 'all-card-grid';
      listEl.innerHTML = articles.map(_buildNewsCardHTML).join('');
      return;
    }

    listEl.className = 'all-rails';
    listEl.innerHTML = ordered.map(function(rail) {
      var items = rail.items.slice(0, 12);
      return '<div class="nr-rail" data-section="' + escapeHtml(rail.key) + '">'
        + '<div class="nr-rail-head">'
          + '<div class="nr-rail-title">'
            + (rail.icon ? '<span class="nr-icon">' + rail.icon + '</span>' : '')
            + escapeHtml(rail.label || rail.key)
          + '</div>'
          + '<button class="nr-rail-more" onclick="location.href=\'korehan-section.html?s=' + encodeURIComponent(rail.key) + '\'">See all &rsaquo;</button>'
        + '</div>'
        + '<div class="nr-rail-scroll">' + items.map(_buildNewsCardHTML).join('') + '</div>'
      + '</div>';
    }).join('');
    // Fetch + cache any still-missing EN titles, then swap them into the DOM.
    try { _khEnsureTitlesEn(articles); } catch(e) {}
    if (typeof renderKhLucideIcons === 'function') renderKhLucideIcons();
    return;
  }

  listEl.className = 'all-card-grid';
  listEl.innerHTML = articles.map(_buildNewsCardHTML).join('');
  try { _khEnsureTitlesEn(articles); } catch(e) {}
  if (typeof renderKhLucideIcons === 'function') renderKhLucideIcons();
}

function filterAllLevel(level, btn) {
  document.querySelectorAll('#all-level-filter .kh-filter-pill').forEach(function(b){ b.classList.remove('on'); });
  if (btn) btn.classList.add('on');
  var base = window._allArticlesCache || published();
  var filtered = level === 'All' ? base : base.filter(function(a){ return a.level === level; });
  // Level filter = flat grid so users can compare same-level articles easily.
  renderAllList(document.getElementById('dyn-article-list'), filtered, { flat: level !== 'All' });
}

function renderArticlePage() {
  var wrap = document.getElementById('dyn-article');
  if (!wrap) return;

  var params = new URLSearchParams(window.location.search);
  var id     = params.get('id');
  var all    = getCachedArticles();
  var a      = id ? all.find(function(x){ return String(x.id) === String(id); }) : null;

  if (!a) {
    // Cache miss — could be an older article not in the latest 80
    // rows, or a fresh single-tab visit before loadArticleById has
    // resolved. Try a one-shot fetch by id, then re-render. Show a
    // lightweight "Loading…" while we wait so the learner doesn't
    // see a flash of "not found" on slow networks.
    if (id && typeof loadArticleById === 'function' && !wrap.dataset.fetchingId) {
      wrap.dataset.fetchingId = id;
      wrap.innerHTML = '<div style="padding:30px;text-align:center;color:#94a3b8">Loading article…</div>';
      loadArticleById(id).then(function(row) {
        wrap.dataset.fetchingId = '';
        if (row) {
          renderArticlePage();
        } else {
          wrap.innerHTML = '<div style="padding:30px">'
            + '<a href="index.html" style="color:#2255a4;text-decoration:none">← Back to Home</a>'
            + '<h1 style="margin-top:16px">Article not found</h1>'
            + '<p style="color:#666;margin-top:8px">This article does not exist or the link is invalid.</p>'
            + '</div>';
        }
      }).catch(function() {
        wrap.dataset.fetchingId = '';
      });
      return;
    }
    wrap.innerHTML = '<div style="padding:30px">'
      + '<a href="index.html" style="color:#2255a4;text-decoration:none">← Back to Home</a>'
      + '<h1 style="margin-top:16px">Article not found</h1>'
      + '<p style="color:#666;margin-top:8px">This article does not exist or the link is invalid.</p>'
      + '</div>';
    return;
  }

  var heroMedia = khArticleHeroMedia(a);
  // Compact date — "2026. 4. 22." (short Korean locale) fits better next to
  // the reporter chip + action icons in the single-line meta row than the
  // full "2026년 4월 22일".
  var dateStr = '';
  if (a.date) {
    var d = new Date(a.date);
    if (!isNaN(d)) {
      dateStr = d.getFullYear() + '.' + (d.getMonth()+1) + '.' + d.getDate() + '.';
    }
  }

  wrap.innerHTML =
    '<article class="kh-article-wrap">'

    // 브레드크럼
    + '<nav class="art-breadcrumb">'
    + '<a href="index.html">Home</a>'
    + '<span>›</span>'
    + '<a href="korehan-section.html?s=' + encodeURIComponent(a.section) + '">' + sectionLabel(a.section) + '</a>'
    + '</nav>'

    // 통합 기사 카드: 이미지(+뱃지 오버레이) → 제목 → 메타 → 탭 → 본문
    + '<div class="art-card">'
    + '<div class="art-hero-img" style="position:relative">' + heroMedia
    + '<div class="art-badges-overlay">'
    + '<span class="art-section-badge">' + a.section + '</span>'
    + (a.level ? (function(lv){ var c={'Beginner':'#e8f5e9;color:#2e7d32','Intermediate':'#fff8e1;color:#f57f17','Advanced':'#fce4ec;color:#c62828','Starter':'#f3e8ff;color:#6b21a8'}; var dn={'Starter':'Seed','Beginner':'Sprout','Intermediate':'Tree','Advanced':'Forest'}; return '<span style="font-size:11px;font-weight:800;padding:3px 10px;border-radius:999px;background:'+(c[lv]||'#f0f0f0;color:#666')+'">'+(dn[lv]||lv)+'</span>'; })(a.level) : '')
    + '</div></div>'
    + '<div class="art-card-body">'
    + '<h1 class="art-title vocab-zone" data-kh-translate-title="1" data-kh-title-ko="' + escapeHtml(a.title || '') + '" data-kh-title-en="' + escapeHtml(a.title_en || '') + '">' + a.title + ' ' + ttsBtn(a.title) + '</h1>'
    + '<div class="art-meta-row">'
    + getReporterProfileHTML(a)
    + '<span class="art-date">' + dateStr + '</span>'
    + '<div class="art-actions-inline">'
    + '<button class="art-action-icon" id="art-bm-btn" onclick="toggleBookmark(\'' + a.id + '\',this)" title="Bookmark"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button>'
    + '<button class="art-action-icon" onclick="shareArticle()" title="Share"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button>'
    + '<button class="art-action-icon" id="translate-btn" onclick="toggleTranslate()" title="Translate"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></button>'
    + '<button class="art-action-icon" id="analyze-btn" onclick="toggleAnalyze()" title="Analyze"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></button>'
    + '</div>'
    + '</div>'

    // 4탭: Read / Grammar / Vocab / Quiz
    + '<div class="art-tabs">'
    + '<button class="art-tab on" onclick="switchArtTab(\'article\',this)">Read</button>'
    + '<button class="art-tab" onclick="switchArtTab(\'grammar\',this)">Grammar</button>'
    + '<button class="art-tab" onclick="switchArtTab(\'vocab\',this)">Vocab</button>'
    + '<button class="art-tab" onclick="switchArtTab(\'quiz\',this)">Review</button>'
    + '</div>'

    // Read 탭
    + '<div id="art-tab-article">'
    + _khSentHintHTML()
    + '<div class="art-lead vocab-zone">' + formatArticleBody(a.body || '') + '</div>'
    + (a.full ? '<div class="art-full vocab-zone">' + formatArticleBody(a.full) + '</div>' : '')
    + '<div id="art-phrases-admin" style="display:none"></div>'
    + '</div>'

    // Grammar 탭
    + '<div id="art-tab-grammar" style="display:none">'
    + '<div id="grammar-content">' + khLoadingHTML('Loading grammar guide', 'Pulling the key patterns out of this article.') + '</div>'
    + '</div>'

    // Vocab 탭
    + '<div id="art-tab-vocab" style="display:none">'
    + '<div class="art-vocab-box">'
    + '<div class="art-vocab-title">Key Vocabulary</div>'
    + '<div class="art-vocab-list" id="art-vocab-list"></div>'
    + '</div>'
    + '</div>'

    // Quiz 탭
    // Review 탭 — 가벼운 4종 리뷰 세트. Summarize는 article-study 모달의
    // Step 5 (Writing)로 이관. 더 깊이 공부하고 싶으면 하단 CTA로 스터디룸.
    + '<div id="art-tab-quiz" style="display:none">'
    + '<div class="rv-wrap">'
    +   '<div class="rv-intro">'
    +     '<div class="rv-intro-title">Review</div>'
    +     '<div class="rv-intro-sub">Light practice before moving on — four quick checks.</div>'
    +   '</div>'

    +   '<div class="rv-check" data-step="0">'
    +     '<div class="rv-check-head"><span>Vocabulary</span><span class="rv-check-hint">Multiple choice</span></div>'
    +     '<div id="rv-vocab-check" class="rv-check-body"></div>'
    +   '</div>'

    +   '<div class="rv-check" data-step="1">'
    +     '<div class="rv-check-head"><span>Comprehension</span><span class="rv-check-hint">True or False</span></div>'
    +     '<div id="rv-tf-check" class="rv-check-body"></div>'
    +   '</div>'

    +   '<div class="rv-check" data-step="2">'
    +     '<div class="rv-check-head"><span>Fill in the Blank</span><span class="rv-check-hint">AI-generated</span></div>'
    +     '<div class="rv-check-body"><div id="fill-wrap"><div id="fill-content"><div id="fill-teaser"></div></div></div></div>'
    +   '</div>'

    +   '<div class="rv-check" data-step="3">'
    +     '<div class="rv-check-head"><span>Listening</span><span class="rv-check-hint">Audio quiz</span></div>'
    +     '<div class="rv-check-body"><div id="art-listening-quiz"><button onclick="startArticleListeningQuiz()" class="rv-start-btn">Start Listening Quiz</button></div></div>'
    +   '</div>'

    +   '<div class="rv-deeper" data-step="4" style="display:none">'
    +     '<div class="rv-deeper-title">Ready for deeper study?</div>'
    +     '<div class="rv-deeper-sub">The Study Room takes this article into a full session — Vocab, Phrases, Read-aloud, Quiz, and Writing — on its own page.</div>'
    +     '<button class="rv-deeper-btn" onclick="openArticleStudyFromReader()">Open Study Room →</button>'
    +   '</div>'
    + '</div>'
    + '</div>'

    + '</div></div>' // close art-card-body + art-card

    // 구분선
    + '<hr class="art-divider">'

    // 댓글 섹션
    + '<section class="art-comments" id="art-comments">'
    + '<h3 class="art-comments-title"><span style="display:inline-flex;width:18px;height:18px">'+KH_ICON_CHAT+'</span><span>댓글</span> <span id="comment-count" style="font-size:14px;color:var(--gray);font-weight:700"></span></h3>'
    + '<div id="comment-form-wrap">'
    + '<div class="comment-login-notice" id="comment-login-notice" style="display:none">'
    + '<p>댓글을 남기려면 로그인하세요 — <a href="#" onclick="event.preventDefault();openAuthModal(&apos;signin&apos;)">로그인</a></p>'
    + '</div>'
    + '<div class="comment-form" id="comment-form" style="display:none">'
    + '<textarea id="comment-input" placeholder="댓글을 입력하세요…" rows="2" maxlength="500"></textarea>'
    + '<button class="comment-submit-btn" onclick="submitComment(\'' + a.id + '\')">등록</button>'
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
          + '<div class="art-related-title" style="display:inline-flex;align-items:center;gap:6px"><span style="display:inline-flex;width:16px;height:16px">'+KH_ICON_NEWSPAPER+'</span><span>Related Articles</span></div>'
          + '<div class="art-related-grid">'
          + related.map(function(r){
              var levelColors = {'Starter':'#f3e8ff;color:#6b21a8','Beginner':'#e8f5e9;color:#2e7d32','Intermediate':'#fff8e1;color:#f57f17','Advanced':'#fce4ec;color:#c62828'};
              return '<a href="' + articleUrl(r.id) + '" class="art-related-card">'
                + '<img src="' + khArticleThumb(r, 300, 200) + '" alt="" loading="lazy" decoding="async" fetchpriority="low">'
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

  // Operational analytics — fires only for logged-in users with consent.
  // Anonymous visitors are covered by Plausible (see js/core/analytics.js).
  if (typeof khTrackUser === 'function') {
    try {
      khTrackUser('article_open', {
        article_id: a.id,
        section:    a.section || null,
        level:      a.level   || null,
        has_video:  !!(a.video_url && a.use_video),
      });
    } catch(_) {}
  }

  // Wire up the HLS player for Reddit hosted videos (fires only when the
  // hero is a <video data-kh-hls="...">; no-op otherwise).
  if (typeof _khAttachHls === 'function') _khAttachHls(wrap);

  // 핵심 단어 추출
  renderArticleVocab(a);

  // Highlighted expressions feature was removed 2026-05-09 — admin
  // never used it productively and the inline highlights distracted
  // from the core hover + Vocab tab UX. The script tag is no longer
  // loaded on any page; this guarded call stays so a stale
  // deployment doesn't throw if shared.js lands before the HTML
  // tag updates ship.
  if (typeof applyHighlightedExpressions === 'function') {
    try { applyHighlightedExpressions(a.id); } catch(_) {}
  }

  // Guest gate: non-signed-in readers get half the article + a sign-up CTA.
  // Prefer clipping .art-full (the long body) so the lede stays readable;
  // fall back to clipping .art-lead when the article ships only a short body.
  function _gateArticle() {
    if (window._isAdmin) return;
    var hasFull = !!document.querySelector('.art-card-body .art-full');
    var sel = hasFull ? '.art-card-body .art-full' : '.art-card-body .art-lead';
    khApplyGuestGate({
      bodySel:   sel,
      anchorSel: sel,
      ctaTitle:  'Keep reading — free with sign-up',
      ctaSub:    'Create a free account to finish this article, save vocabulary you tap, and unlock daily review.'
    });
  }
  _gateArticle();
  if (!window._sessionChecked) {
    var _gateTries = 0;
    (function _waitGate(){
      if (window._sessionChecked || _gateTries >= 60) { _gateArticle(); return; }
      _gateTries++; setTimeout(_waitGate, 100);
    })();
  }

  // 어드민이면 중요표현 관리 패널 표시
  if (window._isAdmin) _renderPhrasesAdmin(a.id);

  // Lazy-hydrate the full body if this article was loaded via the lite
  // list select (related-article swipe path). The lede already shows
  // from `body`; once `full` arrives we re-render so the long body
  // appears without blocking first paint.
  if (a && a.id && !a.full && !a.__fullHydrating) {
    a.__fullHydrating = true;
    loadArticleById(a.id).then(function(row) {
      if (!row || !row.full) return;
      var current = (new URLSearchParams(window.location.search)).get('id');
      if (String(current) !== String(a.id)) return;
      try { renderArticlePage(); } catch(e) {}
    }).catch(function(){});
  }

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
      // Start the reading-time timer — stops on close/navigate/visibility.
      _startArticleReadTimer(articleId, a.body || '');
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
        messages: [{ role: 'user', content: 'Korean article (level: ' + _level + ')\nTitle: ' + _title + '\n\nBODY START\n' + _body.slice(0, 3000) + '\nBODY END\n\n---\n' + instr }]
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
    var v = await _call(window.KH_VOCAB.promptText(_level, _body), 1600);
    var va = _json(v);
    var cleaned = window.KH_VOCAB.validateBest(va, _body || '');
    if (cleaned && cleaned.length) _patch.vocab = JSON.stringify(cleaned);
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

// Counter that resets per body-render so each article reader has its
// own 0-based sentence index space. Lets the analyze panel resolve a
// click back to the right sentence even if multiple bodies (lead +
// full) are stacked in the DOM.
var _khSentCounter = 0;
function _khWrapSentences(paragraph) {
  // Split a paragraph into sentence chunks. Korean news ends sentences
  // with ./?/!/。 — we split AFTER the punctuation so it stays attached
  // to the sentence it terminates. Newlines inside a paragraph become
  // <br> so paragraph shape is preserved when sentence spans flow inline.
  // Avoids lookbehind so the regex still parses on older Samsung Internet.
  var pieces = paragraph.split(/\n+/);
  var out = [];
  pieces.forEach(function(piece, pi) {
    if (pi > 0) out.push('<br>');
    var trimmed = piece.trim();
    if (!trimmed) return;
    // Replace sentence-terminator + whitespace with terminator + a
    // marker that can't appear in Korean text, then split on the marker.
    // Avoids regex lookbehind so older Samsung Internet still parses it.
    var marked = trimmed.replace(/([.!?。])\s+/g, '$1\u0001');
    var sents = marked.split('\u0001');
    var rendered = sents.map(function(s) {
      var st = s.trim();
      if (!st) return '';
      var idx = _khSentCounter++;
      return '<span class="art-sent" data-sent-idx="' + idx + '" role="button" tabindex="0">' + st + '</span>';
    }).filter(Boolean).join(' ');
    out.push(rendered);
  });
  return out.join('');
}

// Document-level delegate for sentence taps. Bound once per session
// (window._khSentTapDelegateBound). Replaces the per-span inline
// onclick that occasionally failed to fire on Samsung Internet when a
// touchend landed on a child .kh-hover-word — the user reported the
// symptom as "기사 본문 클릭해도 무반응" (no panel + no word hover).
// Listening at document level means a click bubbling from ANY
// descendant of .art-sent (including hover words and edit-mode wraps)
// reaches analyzeSentence reliably.
(function _khInstallSentTapDelegate() {
  if (typeof document === 'undefined') return;
  if (window._khSentTapDelegateBound) return;
  window._khSentTapDelegateBound = true;
  document.addEventListener('click', function(e) {
    if (!e.target || !e.target.closest) return;
    if (e.target.closest('.art-sent-panel')) return; // close/x lives there
    var sent = e.target.closest('.art-sent');
    if (!sent) return;
    if (typeof analyzeSentence !== 'function') return;
    var idx = parseInt(sent.dataset.sentIdx, 10);
    if (isNaN(idx)) return;
    analyzeSentence(idx, sent);
  });
})();

function formatArticleBody(text) {
  if (!text) return '';
  // Strip dangerous tags but keep basic formatting
  text = sanitizeHTML(text);
  _khSentCounter = 0;
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
    return '<p style="margin-bottom:18px">' + _khWrapSentences(text.trim()) + '</p>';
  }
  return paras.map(function(p){
    return '<p style="margin-bottom:18px">' + _khWrapSentences(p.trim()) + '</p>';
  }).join('');
}

// ── Per-sentence click-to-analyze ───────────────────────────────
// Tap a sentence in the article body to pop a panel showing the
// English translation, key vocab from that sentence, and any grammar
// patterns Claude can spot. One Haiku call per first-time tap; result
// is cached in sessionStorage keyed by article_id + sentence text so
// re-taps are instant. Panel inserts after the parent paragraph so
// reading flow stays natural.
window._khSentAnalyzeCache = window._khSentAnalyzeCache || {};
// Per-article shared cache pre-generated by admin at article creation
// time. Keyed by article id → { sentences: [{text, translation, vocab,
// grammar}] }. Loaded once per article via getFromCache; absent for
// articles created before sentence pre-gen rolled out, in which case
// analyzeSentence falls back to a live Claude call.
window._khArtSentSharedCache = window._khArtSentSharedCache || {};
// Load the per-sentence analysis array out of article_cache.translation.
// Reads Supabase directly instead of going through getFromCache because
// the latter's wide-schema branch only handles a fixed set of cache_keys
// and silently returns null for 'translation' — which would mean every
// sentence tap on a wide-schema deployment falls through to a live
// Claude call (defeating the whole pre-gen). Tries the wide-table
// shape first, falls back to the kv shape.
// Background "warm the cache" trigger. When a learner taps any sentence
// in an article whose article_cache.translation is empty, we fire ONE
// Claude pass over EVERY sentence in the body and persist the result so
// the next reader gets instant per-sentence translations without burning
// a Claude call. Per-article in-memory + sessionStorage lock prevents
// multiple simultaneous taps from re-triggering. Failure is silent —
// the live single-sentence call already painted the panel.
window._khArtFullAnalyzeRunning = window._khArtFullAnalyzeRunning || {};
async function _khTriggerFullArticleAnalyze(articleId, articleLevel) {
  if (!articleId) return;
  if (window._khArtFullAnalyzeRunning[articleId]) return;
  // Per-tab lock survives reload of the article reader within the same
  // session; the canonical "is it cached?" check still hits Supabase
  // every page load via _khLoadArticleSentenceCache, so we don't need
  // a long-lived flag.
  var lockKey = 'kh_artfull_running_' + articleId;
  // Stamp the lock with a timestamp so a previous tab that crashed
  // mid-call doesn't pin all future bulk runs forever. Reuse if
  // less than 60 s old (real bulk should finish within that), else
  // overwrite. The user-reported "분석 중…" stuck on every
  // sentence after a single hung call traces back to this lock
  // staying set indefinitely.
  try {
    var stamped = sessionStorage.getItem(lockKey);
    if (stamped) {
      var n = parseInt(stamped, 10);
      if (Number.isFinite(n) && (Date.now() - n) < 60000) return; // recent → respect
      sessionStorage.removeItem(lockKey); // stale → clear and continue
    }
  } catch(_) {}
  window._khArtFullAnalyzeRunning[articleId] = true;
  try { sessionStorage.setItem(lockKey, String(Date.now())); } catch(_) {}

  try {
    // Sentences are already split + numbered by _khWrapSentences when
    // the body rendered — pull them straight out of the DOM rather
    // than re-splitting (avoids drift between display and analysis
    // indexing). Use the article reader's body element to avoid the
    // related-articles strip / drawer comments.
    // Article body lives inside #dyn-article (renderArticlePage). All
    // .art-sent spans flow there. Falling back to document covers the
    // story / convo readers if they ever start emitting .art-sent
    // spans through the same wrapper.
    var bodyEl = document.getElementById('dyn-article') || document;
    var nodes = bodyEl.querySelectorAll('.art-sent');
    var sentences = [];
    nodes.forEach(function(n) {
      var idx = parseInt(n.dataset.sentIdx, 10);
      var text = (n.textContent || '').trim();
      if (text && !isNaN(idx)) sentences.push({ idx: idx, text: text });
    });
    // Dedupe by idx so duplicate spans (e.g. lead + full body) don't
    // make us pay twice for the same sentence.
    var seen = {};
    sentences = sentences.filter(function(s){ if (seen[s.idx]) return false; seen[s.idx] = true; return true; });
    if (!sentences.length) return;

    if (typeof callClaude !== 'function') return;
    // Single Claude call with ALL sentences batched. Haiku handles ~30
    // sentences with a 2200-token budget comfortably; the bulk-gen flow
    // already runs similar batched prompts. Batching halves the wall-
    // clock vs serial calls and keeps cost predictable.
    var payload = sentences.map(function(s, i) {
      return (i + 1) + '. ' + s.text;
    }).join('\n');
    // Level-aware prompt — same calibration as the single-sentence path.
    // Pre-2026-05-09 this was hardcoded to TOPIK 3-4 regardless of article
    // level, which is why Seed/Sprout articles were caching with empty
    // grammar arrays (the prompt skipped beginner patterns the learner
    // actually needed to see).
    var _lvl = articleLevel || (window._currentArticle && window._currentArticle.level) || 'Beginner';
    var _lvlLabel = ({
      Starter:      'Seed (TOPIK 1, complete beginner)',
      Beginner:     'Sprout (TOPIK 2, beginner)',
      Intermediate: 'Tree (TOPIK 3-4, intermediate)',
      Advanced:     'Forest (TOPIK 5-6, advanced)',
    })[_lvl] || 'Sprout (TOPIK 2, beginner)';
    var _isLow = (_lvl === 'Starter' || _lvl === 'Beginner');
    var _vocabRule = _isLow
      ? '- VOCAB: max 4 per sentence. Include any content word the learner might not know. Only skip particles and 이다/있다 alone. 흔하다 / 보다 / 키우다 / 살다 / 먹다 are FAIR GAME — explain them.\n'
      : '- VOCAB: max 4 per sentence. Skip beginner words (는/이/가/이다/있다/하다/되다…).\n';
    // Analysis = grammar + key expressions + idioms. Maximum coverage:
    // every interesting morpheme, fixed expression, idiom, or
    // collocation that appears in the sentence. The user explicitly
    // asked us to drop the 0-or-1 cap and surface as much as is
    // genuinely there. Article-level skipping rule (Tree+/Forest skip
    // beginner patterns) was also dropped — judge each sentence on
    // its own contents, not on metadata.
    var _analysisRule =
        '- ANALYSIS: be EXHAUSTIVE. Surface every grammar pattern, fixed expression, idiom, 사자성어, 관용구, and notable collocation in the sentence — even ones you think are "obvious". Korean grammar has 200+ learner-relevant patterns; don\'t hold back. 8 worthy items → return 8. Only return [] when the sentence is a pure proper-noun list or single greeting.\n'
      + '    MUST include when present (this is a partial floor — surface anything else from a comprehensive TOPIK 2-6 grammar inventory too):\n'
      + '    · CONNECTIVES & SUBORDINATORS: ~에도 불구하고 (despite), ~기 때문에 (because), ~기 위해(서) / ~을·를 위해 (in order to / for), ~려고 / ~려면 (intend / if want), ~다가 (mid-action shift), ~자마자 (as soon as), ~ㄴ/는데 (background), ~지만 / ~으나 (but), ~거나 (or), ~면 (if), ~아/어도 / ~더라도 / ~ㄹ지라도 (even if), ~았/었더라면 (counterfactual), ~았/었더니 (after I did), ~다 보면 (if you keep), ~다 보니(까) (as a result of doing), ~ㄴ/는 반면(에) (whereas), ~ㄴ/는 만큼 (as much as), ~ㄴ/는 데다(가) (on top of), ~ㄴ/는 김에 (while you\'re at it), ~ㄴ/는 결과 / ~ㄴ 끝에 (as a result / after all the), ~ㄴ/는커녕 (let alone), ~을 뿐(만) 아니라 (not only), ~ㄹ/을수록 (the more), ~ㄴ/는 한 (as long as), ~ㄴ/는다면 (if), ~을 텐데 / ~을 테니까 (probably / since I\'ll), ~ㄴ/는다고 해도 (even if), ~기에 (formal because), ~며 / ~으며 (and / while — formal).\n'
      + '    · AUXILIARY ENDINGS / MODALS: ~ㄹ/을 수 있다·없다, ~지 못하다, ~지 않다 / ~지 말다, ~게 되다, ~기 시작하다, ~기로 하다, ~ㄴ/은 적이 있다·없다, ~아/어 보다, ~아/어 주다, ~아/어 있다, ~고 있다, ~았/었어요 (incl. contracted 봤·했·됐·갔), ~아/어 놓다·두다, ~아/어 버리다, ~아/어 가다·오다 (continue / have been), ~아/어 내다 (manage), ~아/어 대다 (do repeatedly), ~게 하다·만들다 (make / let), ~ㄹ/을 줄 알다·모르다 (know how / not), ~을 수밖에 없다, ~ㄹ 리가 없다, ~ㄹ 모양이다 / ~ㄹ 것 같다, ~ㄹ까 하다, ~ㄹ까 봐, ~ㄹ 만하다, ~기 마련이다 / ~기 십상이다, ~을 뻔하다, ~ㄴ/는 척하다, ~기는 하다 (do indeed but), ~ㄹ 정도이다 / ~ㄹ 정도로.\n'
      + '    · MODIFIERS / CLAUSAL: ~ㄴ/은/는 + 명사, ~ㄹ/을 + 명사, ~던 / ~았/었던 (recalled past), ~ㄴ/은 채(로) (in the state of), ~ㄴ/은 후에 / ~ㄴ 뒤에 / ~기 전에, ~을 때(에), ~ㄴ/는 셈이다 (counts as), ~ㄴ/는 편이다 (tends to be), ~ㄴ/는 듯하다, ~ㄴ/는 모양이다, ~다는 + 명사, ~ㄴ/는 점에서 (in the sense that).\n'
      + '    · REPORTED / QUOTATION: ~다고 하다, ~냐고 하다, ~자고 하다, ~라고 하다, ~다고 알려져 있어요, ~ㄴ다는 / ~는다는 / ~라는 + 명사, ~다네 / ~다더라 / ~다잖아 (informal), ~다고요? / ~라고요? (you say?), ~ㄹ 거라고 하다.\n'
      + '    · PARTICLES WORTH FLAGGING: ~만, ~까지, ~부터, ~조차, ~밖에, ~마다, ~씩, ~이나 (or / approx.), ~마저, ~처럼 / ~같이, ~보다, ~에 비해, ~로서 (role), ~로써 (means), ~에 대해(서), ~에 의해(서) / ~으로 인해(서), ~에 관한·관해(서), ~을 통해(서), ~을 따라, ~에 따라, ~을 비롯해(서).\n'
      + '    · SPEECH-LEVEL / ENDER: ~지(요) (right? / softening), ~네(요) (discovery), ~군요 / ~구나 (realisation), ~잖아(요) (you know), ~다니까(요) (I\'m telling you), ~ㄹ게(요) (will / promise), ~ㄹ까(요) (shall we / I wonder), ~을걸(요) (probably), ~ㄴ걸 (mild surprise), ~던가(요) (recall Q).\n'
      + '    · FIXED EXPRESSIONS / COLLOCATIONS: 마음에 들다, 마음이 무겁다 / 가볍다, 마음에 걸리다, 마음이 놓이다, 시간이 없다, 시간 가는 줄 모르다, 정신을 차리다 / 정신없다, 도움이 되다 / 도움을 주다·받다, 관심을 가지다 / 받다, 눈에 띄다, 눈을 감다·뜨다, 눈치가 빠르다, 손이 크다 / 손이 가다, 발이 넓다, 발등에 불이 떨어지다, 입이 가볍다·무겁다, 귀가 얇다, 머리를 맞대다 / 식히다, 한 술 더 뜨다, 발 벗고 나서다, 등을 돌리다, 어깨가 무겁다, 콧대가 높다, 기가 차다, 가슴이 뭉클하다, 가슴에 새기다·와닿다, ~에 참여 / 참가하다, ~의 도움으로, ~을 둘러싸다, ~을 차지하다, ~을 비롯하다, ~에 영향을 미치다, ~에 한해(서), ~을 거치다, ~을 무릅쓰다, …\n'
      + '    · IDIOMS / 사자성어 / 관용구: surface whenever actually used (예: 일거양득, 우물 안 개구리, 가는 말이 고와야 오는 말이 곱다, 백문이 불여일견, 호랑이 굴, 발 없는 말이 천 리 간다, 호박씨를 까다, 작심삼일, 일석이조, 십시일반, …).\n'
      + '    Each item: {"type":"grammar|expression|idiom","label":"<canonical form>","exp":"<short English>","example_in_sentence":"<chunk from sentence>"}.\n'
      + '    Skipping a pattern because it "feels too basic" or "too obvious" is the WRONG call — include it. The list above is illustrative; surface anything else from TOPIK 2-6 grammar that genuinely appears.\n';
    var _analysisVerify =
        '- ANALYSIS VERIFY (HARD RULE):\n'
      + '    1. example_in_sentence MUST be a literal substring of that source sentence. Whitespace can differ; characters cannot.\n'
      + '    2. For type="grammar", the pattern marker should be present somewhere in the sentence. Korean past-tense contractions (봤어요 = 보+았어요, 했어요, 됐어요, 갔어요) count as containing ~았/었어요 even though the literal "었어요" doesn\'t appear; the client validator already understands this.\n'
      + '    3. For type="expression" / "idiom", the label should be the canonical form; example_in_sentence is the actual chunk as it appears.\n'
      + '    4. If a candidate doesn\'t survive these checks, OMIT it. Empty is better than wrong. The previous "fill at least 1 slot" rule was dropped — empty arrays are honest output.\n'
      + '    Common hallucinations to avoid:\n'
      + '    · Citing a noun phrase like "새로운 웰니스 트렌드" as the example for ~(으)로서 — the chunk has no 로서.\n'
      + '    · Calling "X예요 / X이에요" plain ~ㄴ다 — that\'s polite copula.\n'
      + '    · Naming an idiom that isn\'t actually used in the sentence.\n';
    var prompt =
        'You are a Korean tutor analysing each sentence of an article for a ' + _lvlLabel + ' learner.\n\n'
      + 'Sentences (numbered, in order):\n' + payload + '\n\n'
      + 'Return ONLY a JSON object — no preamble, no code fences:\n'
      + '{ "sentences": [\n'
      + '  { "translation": "natural English of sentence 1",\n'
      + '    "vocab":    [{"ko":"<dictionary form>","en":"<short meaning>","note":"<optional 1-line>"}],\n'
      + '    "analysis": [{"type":"grammar|expression|idiom","label":"<pattern / phrase / idiom>","exp":"<1-sentence English>","example_in_sentence":"<chunk from sentence>"}]\n'
      + '  }, ... one entry per input sentence, same order ...\n'
      + ']}\n\n'
      + 'Rules:\n'
      + '- TRANSLATION: preserve the original subject. Do NOT inject "I/we" if Korean omitted it.\n'
      + _vocabRule
      + _analysisRule
      + _analysisVerify
      + '- Return EXACTLY ' + sentences.length + ' entries in sentences[].';
    var res = await callClaude({
      feature: 'sentence-analyze-bulk',
      model: 'claude-haiku-4-5-20251001',
      max_tokens: Math.min(16000, 500 * sentences.length + 800),
      messages: [{ role: 'user', content: prompt }]
    });
    var raw = (res && res.content && res.content[0] && res.content[0].text) || '';
    var clean = raw.replace(/^```json?/, '').replace(/^```/, '').replace(/```$/, '').trim();
    var oi = clean.indexOf('{'), ei = clean.lastIndexOf('}');
    if (oi < 0 || ei <= oi) throw new Error('JSON not found');
    // Tolerate truncation: when JSON.parse blows on a cut-off
    // response, walk back from the last `}` looking for the deepest
    // bracket that still produces valid JSON. Better to render
    // partial sentence analysis than to throw the whole article's
    // worth of tokens away with a "분석 실패" error toast.
    var parsed;
    try {
      parsed = JSON.parse(clean.slice(oi, ei + 1));
    } catch (e1) {
      var slice = clean.slice(oi, ei + 1);
      var fixed = null;
      var lastObjEnd = slice.lastIndexOf('},');
      while (lastObjEnd > 0) {
        try {
          fixed = JSON.parse(slice.slice(0, lastObjEnd + 1) + ']}');
          break;
        } catch (_) {
          lastObjEnd = slice.lastIndexOf('},', lastObjEnd - 1);
        }
      }
      if (fixed) parsed = fixed;
      else throw e1;
    }
    var arr = parsed && Array.isArray(parsed.sentences) ? parsed.sentences : null;
    if (!arr || !arr.length) throw new Error('empty sentences[]');

    // Stitch back: each entry = {text, translation, vocab, grammar},
    // indexed by source sentence idx so analyzeSentence can look up by
    // either numeric index or text equality.
    var stitched = sentences.map(function(s, i) {
      var a = arr[i] || {};
      // Accept both the new "analysis" field (grammar + expression +
      // idiom) and legacy "grammar" payloads from older Claude calls.
      // Legacy items are promoted to type:'grammar' so the renderer
      // sees a single shape.
      var analysis = [];
      if (Array.isArray(a.analysis)) analysis = a.analysis.slice();
      else if (Array.isArray(a.grammar)) {
        analysis = a.grammar.map(function(g) {
          return {
            type: 'grammar',
            label: g.pattern || g.label || '',
            exp: g.exp || '',
            example_in_sentence: g.example_in_sentence || '',
          };
        });
      }
      return {
        text: s.text,
        idx: s.idx,
        translation: a.translation || '',
        vocab: Array.isArray(a.vocab) ? a.vocab : [],
        analysis: analysis,
      };
    });

    // Persist to article_cache.translation as { sentences: [...] }.
    // upsertArticleCacheRow handles the kv vs wide schema split.
    if (typeof upsertArticleCacheRow === 'function') {
      try {
        await upsertArticleCacheRow(articleId, { translation: { sentences: stitched, version: KH_SENT_CACHE_VERSION } });
      } catch(e) { console.warn('[sent-bg] persist failed:', e); }
    }
    // Update the in-memory shared cache so other taps in this session
    // hit it instead of going live.
    window._khArtSentSharedCache[articleId] = { sentences: stitched, version: KH_SENT_CACHE_VERSION };
    // Also drop a one-off log so the admin can confirm the trigger
    // fired (the user pointed out it wasn't actually wired before).
    console.log('[sent-bg] cached ' + stitched.length + ' sentences for article ' + articleId);
  } catch(err) {
    console.warn('[sent-bg] failed:', err && err.message || err);
  } finally {
    window._khArtFullAnalyzeRunning[articleId] = false;
    try { sessionStorage.removeItem(lockKey); } catch(_) {}
  }
}

// Bumped to 'p3' on 2026-05-09 night when PR #383 added the
// hallucination filter — pattern markers must literally appear in
// the sentence. Any p2 cache may still hold the wrong-pattern
// items (e.g. ~(으)로서 on a sentence with no 로서/으로서) so we
// treat p2 as stale here. Reading a p2 cache marks the article
// stale, _khTriggerFullArticleAnalyze re-runs bulk over every
// sentence in the body, and the new payload lands with version
// 'p3'. Old cache stays in DB (won't break anything) until
// upserted on next bulk run.
//
// Bump again whenever the prompt or filter changes shape. Older
// stamps cascade: p1 → p2 was the level-aware prompt + GRAMMAR
// VERIFY rule, p2 → p3 is the marker-presence filter.
// Bumped to 'p4' on 2026-05-09 night when the GRAMMAR VERIFY rule
// became a hard "marker must appear inside the example chunk" check
// (both prompt + client-side validator). p3 caches still pass the
// marker-in-sentence check but fail the new marker-in-example check
// for any item where AI cited an unrelated chunk; mark them stale
// so the next reader regenerates with the tighter prompt.
// Bumped to 'p5' on 2026-05-09 night — the response shape changed
// from { grammar:[{pattern,...}] } to { analysis:[{type,label,...}] }
// covering grammar + expression + idiom in one array, with no
// upper cap and the article-level skip rule dropped (every level
// now surfaces whatever the sentence honestly contains). p4 caches
// have only `grammar` and get auto-promoted on render via the
// legacy fallback in _khRenderSentPanel, but admin re-analyse
// rewrites them into the new shape.
// Bumped to 'p7' on 2026-05-09 night after the user pointed out
// the p6 list was still too thin ("저거 너무 적지않아?"). Expanded
// the MUST-INCLUDE inventory to ~80-100 patterns covering TOPIK
// 2-6 — connectives, auxiliaries, modifiers, reported speech,
// particles, sentence enders, fixed expressions / collocations,
// idioms / 사자성어 / 관용구. Same "this is illustrative, surface
// anything else from comprehensive grammar" framing.
//   s1: combined Sonnet path (admin runAutoGenerate) — analysis
// is generated by the same call that wrote the body, so the
// hallucinated-grammar class of bugs that haunted p2-p7 should
// be largely structural-fixed. Mirror in admin SENT_CACHE_CURRENT.
var KH_SENT_CACHE_VERSION = 's1';

async function _khLoadArticleSentenceCache(articleId) {
  if (!articleId) return null;
  if (window._khArtSentSharedCache[articleId] !== undefined) {
    return window._khArtSentSharedCache[articleId];
  }
  var sb = (typeof getSupa === 'function') ? getSupa() : null;
  if (!sb) {
    window._khArtSentSharedCache[articleId] = null;
    return null;
  }
  function _parseShape(raw) {
    if (raw == null) return null;
    var obj;
    if (typeof raw === 'object') obj = raw;
    else if (typeof raw === 'string') {
      try { obj = JSON.parse(raw); } catch(_) { return null; }
    } else return null;
    if (!obj || !Array.isArray(obj.sentences) || !obj.sentences.length) return null;
    return { sentences: obj.sentences, version: obj.version || null };
  }
  // Wide-table: one row per article with a `translation` jsonb/text column.
  try {
    var w = await sb.from('article_cache')
      .select('translation')
      .eq('article_id', String(articleId))
      .maybeSingle();
    if (!w.error && w.data) {
      var shapeW = _parseShape(w.data.translation);
      if (shapeW) {
        window._khArtSentSharedCache[articleId] = shapeW;
        return shapeW;
      }
    }
  } catch(_) {}
  // Key-value: row keyed by (content_type, content_id, cache_key='translation').
  try {
    var kv = await sb.from('article_cache')
      .select('cache_value')
      .eq('content_type', 'article')
      .eq('content_id', String(articleId))
      .eq('cache_key', 'translation')
      .maybeSingle();
    if (!kv.error && kv.data) {
      var shapeKV = _parseShape(kv.data.cache_value);
      if (shapeKV) {
        window._khArtSentSharedCache[articleId] = shapeKV;
        return shapeKV;
      }
    }
  } catch(_) {}
  window._khArtSentSharedCache[articleId] = null;
  return null;
}

// Heuristic — was this cached sentence's grammar likely hallucinated
// by the pre-VERIFY prompt? Catches the two failure modes the user
// hit on a single article session:
//   1. example_in_sentence text doesn't actually appear in sentence.text
//   2. pattern is ~ㄴ다 / ~는다 (plain declarative) but the example
//      chunk ends in 예요 / 이에요 / 요 / 었어요 / etc. — those are
//      the polite copula and verb endings, not plain declarative.
function _khSentGrammarLooksBad(sentObj) {
  if (!sentObj) return false;
  // Accept either the new analysis array (preferred) or the legacy
  // grammar array. Either shape is run through the same validity
  // heuristic — broken example text or marker-not-in-sentence.
  var items = [];
  if (Array.isArray(sentObj.analysis) && sentObj.analysis.length) {
    items = sentObj.analysis.map(function(a) {
      return { pattern: a.label || a.pattern || '', example_in_sentence: a.example_in_sentence || '', _type: a.type || 'grammar' };
    });
  } else if (Array.isArray(sentObj.grammar) && sentObj.grammar.length) {
    items = sentObj.grammar.slice();
  }
  if (!items.length) return false;
  var bodyText = (sentObj.text || '').replace(/\s+/g, '');
  return items.some(function(g) {
    if (!g) return false;
    var ex = (g.example_in_sentence || '').replace(/<[^>]*>/g, '').replace(/\s+/g, '').trim();
    if (!ex) return false;
    if (bodyText && bodyText.indexOf(ex) === -1) return true;
    // Marker check applies only to grammar items — expression / idiom
    // labels don't have particle-style markers and would always trip
    // the heuristic. Items without an explicit type (legacy cache)
    // default to grammar.
    var typ = g._type || g.type || 'grammar';
    if (typ !== 'grammar') return false;
    var pat = String(g.pattern || '');
    if (/~?[ㄴ는]다\b|~?[ㄴ는]다(?!고)/.test(pat) && /(예요|이에요|이었|였)\.?$/.test(ex)) return true;
    // Marker-in-sentence (broad) check — marker must appear somewhere
    // in the sentence. Relaxed from "marker must be in the example
    // chunk" because Korean past-tense contractions (봤어요 = 보+았어요,
    // 했어요, 됐어요) drop the literal marker string while still
    // belonging to the pattern. Single-char markers skipped — too many
    // false positives from particles.
    var stripped = pat.replace(/[~()\s\-.?!]/g, '');
    var markers = [];
    var rePieces = stripped.split(/[\/,]/);
    rePieces.forEach(function(piece) {
      var re = /[가-힣]{2,}/g, m;
      while ((m = re.exec(piece))) markers.push(m[0]);
    });
    if (markers.length) {
      var hit = false;
      for (var i = 0; i < markers.length; i++) {
        if (bodyText.indexOf(markers[i]) >= 0) { hit = true; break; }
      }
      if (!hit) return true;
    }
    return false;
  });
}
// One-time hint shown above the article body so readers discover
// the tap-to-analyze interaction. State lives in localStorage so
// returning users aren't nagged. Dismissed when user taps × OR the
// first time they actually tap a sentence (whichever first).
function _khShouldShowSentHint() {
  try { return localStorage.getItem('kh_sent_hint_dismissed') !== '1'; }
  catch(_) { return true; }
}
function _khMarkSentHintSeen() {
  try { localStorage.setItem('kh_sent_hint_dismissed', '1'); } catch(_) {}
}
function _khSentHintHTML() {
  if (!_khShouldShowSentHint()) return '';
  return '<div class="art-sent-hint" id="art-sent-hint">'
    + '<span class="ash-icon">✨</span>'
    + '<span class="ash-text">Tap a sentence for translation, vocab, and grammar analysis.</span>'
    + '<button class="ash-dismiss" onclick="dismissSentHint()" aria-label="Dismiss">×</button>'
    + '</div>';
}
function dismissSentHint() {
  _khMarkSentHintSeen();
  var hint = document.getElementById('art-sent-hint');
  if (hint) hint.remove();
}
function _khSentCacheKey(articleId, idx, text) {
  // Hashing the text alongside idx makes the cache survive small body
  // edits (admin tweaks a typo) — the idx-only key would mis-serve a
  // stale analysis when the sentence at idx N changed.
  var hash = 0;
  for (var i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  return 'sa_' + (articleId || 'noid') + '_' + idx + '_' + Math.abs(hash);
}
function closeSentPanel() {
  document.querySelectorAll('.art-sent-panel').forEach(function(p){ p.remove(); });
  document.querySelectorAll('.art-sent.active').forEach(function(s){ s.classList.remove('active'); });
}
function _khRenderSentPanel(panel, data, closer, sentenceText) {
  var closeFn = closer || 'closeSentPanel()';
  var html = '<button class="asp-close" onclick="' + closeFn + '" aria-label="Close">×</button>';
  if (data && data.translation) {
    html += '<div class="asp-section-title">English</div>'
         + '<div class="asp-trans">' + escapeHTML(data.translation) + '</div>';
  }
  // Use the sentenceText passed by the caller, or fall back to whatever
  // the panel dataset preserved from a prior render. Defensive — if we
  // can't recover it we just skip the hallucination filter below
  // instead of breaking rendering.
  var _sent = (sentenceText || (panel && panel.dataset && panel.dataset.sentence) || '').trim();
  if (panel && _sent && panel.dataset) panel.dataset.sentence = _sent;
  if (data && Array.isArray(data.vocab) && data.vocab.length) {
    html += '<div class="asp-section-title">Vocab</div>';
    data.vocab.forEach(function(v) {
      if (!v || !v.ko) return;
      html += '<div class="asp-vocab-row">'
           + '<span class="asp-vocab-ko">' + escapeHTML(v.ko) + '</span>'
           + '<span class="asp-vocab-en">' + escapeHTML(v.en || '')
           + (v.note ? '<span class="asp-vocab-note">' + escapeHTML(v.note) + '</span>' : '')
           + '</span>'
           + '</div>';
    });
  }
  // Analysis section — grammar patterns + idioms + key expressions,
  // grouped by type. The cache may carry either the new `analysis`
  // array (each item: {type:'grammar'|'expression'|'idiom', label,
  // exp, example_in_sentence}) OR the legacy `grammar` array (which
  // we promote to type:'grammar' for backward compat). Skip render
  // when both are missing.
  var _analysisItems = [];
  if (data && Array.isArray(data.analysis) && data.analysis.length) {
    _analysisItems = data.analysis.slice();
  } else if (data && Array.isArray(data.grammar) && data.grammar.length) {
    _analysisItems = data.grammar.map(function(g) {
      return {
        type: 'grammar',
        label: g.pattern || g.label || '',
        exp: g.exp || '',
        example_in_sentence: g.example_in_sentence || '',
      };
    });
  }
  if (_analysisItems.length) {
    var seenExamples = [];
    var analysisFiltered = [];
    function _looksLikePadding(label) {
      if (!label) return true;
      var stripped = String(label)
        .replace(/[~\/()\s\-,.?!]/g, '')
        .replace(/[은는이가을를으]/g, '');
      return /[가-힣]{3,}/.test(stripped);
    }
    function _patternMarkers(label) {
      if (!label) return [];
      // Extract Korean morpheme markers from the label so we can
      // verify they appear in the sentence. Two relaxations:
      //   1. Drop trailing "다" (citation form): 않다 → 않, 시작하다
      //      → 시작하, 있다 → 있. Conjugated surface forms (않았어요,
      //      시작했어요, 있었어요) match the bare stem.
      //   2. Allow 1+ char markers (was 2+): single-syllable bare
      //      stems (지, 고, 게, 기) anchor patterns whose conjugating
      //      half just got 다-stripped above.
      var out = [];
      String(label).split(/[\/,]/).forEach(function(piece) {
        var stripped = piece.replace(/[~()\s\-.?!+]/g, '');
        var re = /[가-힣]+/g, m;
        while ((m = re.exec(stripped))) {
          var token = m[0];
          if (token.length > 1 && /다$/.test(token)) token = token.slice(0, -1);
          if (token) out.push(token);
        }
      });
      return out;
    }
    function _itemMatchesSentence(item) {
      if (!_sent) return true;
      var sentNoWs = _sent.replace(/\s+/g, '');
      var ex = (item.example_in_sentence || '').replace(/\s+/g, '').trim();
      // example must literally appear in the sentence
      if (!ex || sentNoWs.indexOf(ex) < 0) return false;
      // Marker check only for grammar (idioms / expressions are
      // already validated by example-in-sentence above; the label
      // for an idiom is often the idiom itself, which is the chunk).
      // For grammar specifically, the marker must appear in the
      // sentence somewhere — relaxed from PR #390's strict
      // "marker in example chunk" because Korean past-tense
      // contractions (봤어요 = 보+았어요) lose the literal marker
      // string while still using the pattern.
      // Marker check — only for grammar items. Idioms / expressions
      // are validated by the example-in-sentence rule above; their
      // labels are the canonical phrase form, not a particle. The
      // marker check itself is the broad "appears in sentence
      // somewhere" version (relaxed from PR #390's "must be in the
      // example chunk") so Korean past-tense contractions like 봤어요
      // (= 보+았어요) still surface ~았/었어요.
      if ((item.type || 'grammar') === 'grammar') {
        var markers = _patternMarkers(item.label);
        if (markers.length) {
          var hit = false;
          for (var k = 0; k < markers.length; k++) {
            if (sentNoWs.indexOf(markers[k]) >= 0) { hit = true; break; }
          }
          if (!hit) return false;
        }
      }
      return true;
    }
    _analysisItems.forEach(function(item) {
      if (!item || !item.label) return;
      var typ = item.type || 'grammar';
      // Padding-noun check only for grammar; idioms/expressions can
      // legitimately have multi-syllable Korean content.
      if (typ === 'grammar' && _looksLikePadding(item.label)) return;
      if (!_itemMatchesSentence(item)) return;
      var ex = (item.example_in_sentence || '').trim();
      var dupe = false;
      for (var i = 0; i < seenExamples.length && ex; i++) {
        var prev = seenExamples[i];
        if (!prev) continue;
        if (prev.indexOf(ex) >= 0 || ex.indexOf(prev) >= 0) { dupe = true; break; }
      }
      if (dupe) return;
      if (ex) seenExamples.push(ex);
      analysisFiltered.push(item);
    });
    if (analysisFiltered.length) {
      var TYPE_META = {
        grammar:    { label: 'Grammar',    color: '#a78bfa', bg: 'rgba(167,139,250,.12)' },
        expression: { label: 'Expression', color: '#34d399', bg: 'rgba(52,211,153,.12)' },
        idiom:      { label: 'Idiom',      color: '#fbbf24', bg: 'rgba(251,191,36,.12)' },
      };
      html += '<div class="asp-section-title">Analysis</div>';
      analysisFiltered.forEach(function(item) {
        var typ = item.type || 'grammar';
        var meta = TYPE_META[typ] || TYPE_META.grammar;
        html += '<div class="asp-grammar-block">'
             + '<div class="asp-grammar-name" style="display:flex;align-items:center;gap:6px">'
             +   '<span style="font-size:9px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;padding:2px 6px;border-radius:6px;background:' + meta.bg + ';color:' + meta.color + '">' + meta.label + '</span>'
             +   '<span>' + escapeHTML(item.label) + '</span>'
             + '</div>'
             + (item.exp ? '<div class="asp-grammar-exp">' + escapeHTML(item.exp) + '</div>' : '')
             + (item.example_in_sentence ? '<div class="asp-grammar-ex">→ "' + escapeHTML(item.example_in_sentence) + '"</div>' : '')
             + '</div>';
      });
    }
  }
  panel.innerHTML = html;
}
async function analyzeSentence(idx, el) {
  if (!el) return;
  // First successful interaction is enough — don't keep nagging.
  _khMarkSentHintSeen();
  var hintEl = document.getElementById('art-sent-hint');
  if (hintEl) hintEl.remove();
  // Toggle off when re-tapping the active sentence.
  var existing = document.querySelector('.art-sent-panel');
  if (existing && existing.dataset.sentIdx === String(idx)) {
    closeSentPanel();
    return;
  }
  closeSentPanel();
  el.classList.add('active');
  var sentenceText = (el.textContent || '').trim();
  if (!sentenceText) return;

  if (typeof khTrackUser === 'function') {
    try {
      khTrackUser('sentence_analyze', {
        article_id: (window._currentArticle && window._currentArticle.id) || null,
        idx: idx,
        sentence_len: sentenceText.length,
      });
    } catch(_) {}
  }

  var paragraph = el.closest('p') || el;
  var panel = document.createElement('div');
  panel.className = 'art-sent-panel';
  panel.dataset.sentIdx = String(idx);
  panel.innerHTML = '<button class="asp-close" onclick="closeSentPanel()" aria-label="Close">×</button>'
    + '<div class="asp-loading">분석 중</div>';
  paragraph.parentNode.insertBefore(panel, paragraph.nextSibling);

  var articleId = '';
  try {
    var p = new URLSearchParams(window.location.search);
    articleId = p.get('id') || (window._currentArticle && window._currentArticle.id) || '';
  } catch(_) {}
  var cacheKey = _khSentCacheKey(articleId, idx, sentenceText);

  // In-memory cache (current page) → sessionStorage (current tab) → live call.
  if (window._khSentAnalyzeCache[cacheKey]) {
    _khRenderSentPanel(panel, window._khSentAnalyzeCache[cacheKey], null, sentenceText);
    return;
  }
  try {
    var stored = sessionStorage.getItem(cacheKey);
    if (stored) {
      var parsed = JSON.parse(stored);
      window._khSentAnalyzeCache[cacheKey] = parsed;
      _khRenderSentPanel(panel, parsed, null, sentenceText);
      return;
    }
  } catch(_) {}

  // Read article level early — used both for live prompt calibration
  // and for spotting stale low-level cache hits (see below).
  var _articleLevel = (window._currentArticle && window._currentArticle.level) || 'Beginner';
  var _isLowLevel = (_articleLevel === 'Starter' || _articleLevel === 'Beginner');

  // Pre-generated shared cache (admin built this when the article was
  // created). Match by index first, fall back to text equality so an
  // index-shift from minor body edits still finds the right entry.
  // Pre-2026-05-09 the bulk pre-cache ran a TOPIK 3-4 prompt for every
  // article regardless of level, which dropped beginner grammar and left
  // Seed/Sprout articles with grammar:[]. Treat such hits as stale at
  // low levels and fall through to the live call so the new level-aware
  // prompt repopulates the cache with patterns the learner actually needs.
  var sharedCache = null;
  var _sharedCacheStale = false;
  try {
    sharedCache = await _khLoadArticleSentenceCache(articleId);
    if (sharedCache && sharedCache.sentences) {
      // Compute article-level staleness FIRST so a single bad
      // sentence in the cache promotes the entire article to
      // "needs bulk re-analysis," and every tap during this session
      // takes the same path (await bulk → cache hit). The previous
      // ordering checked per-sentence first, which let some taps
      // return cached panels while others showed "분석 중" mid-
      // session — the user reported it as "동일 기사인데 어떤
      // 문장은 즉시 뜨고 어떤 건 다시 분석 중."
      // NOTE: dropped the version-mismatch auto-stale flag in favor
      // of admin-driven re-analysis (the 🔁 재분석 button on AI
      // Cache Management). Auto-bulk on every version bump caused
      // (a) every tap to wait on a Haiku reanalysis that often
      // truncated and JSON-parse-failed, and (b) wasted Haiku
      // tokens on data the admin will refresh comprehensively
      // with Sonnet anyway. Content-quality checks below still
      // surface genuinely-broken cache.
      if (_isLowLevel) {
        var _emptyCount = sharedCache.sentences.filter(function(s){
          // Treat a sentence as "missing analysis" only when BOTH
          // the new analysis[] and the legacy grammar[] are empty.
          var hasAnalysis = Array.isArray(s.analysis) && s.analysis.length;
          var hasGrammar  = Array.isArray(s.grammar)  && s.grammar.length;
          return !hasAnalysis && !hasGrammar;
        }).length;
        if (_emptyCount / sharedCache.sentences.length >= 0.3) _sharedCacheStale = true;
      }
      var _badCount = sharedCache.sentences.filter(function(s){ return _khSentGrammarLooksBad(s); }).length;
      if (_badCount / sharedCache.sentences.length >= 0.2) _sharedCacheStale = true;

      // Only serve the per-sentence cache hit when the article
      // cache is still considered fresh. If it's stale, skip the
      // hit — the bulk-await block below will rebuild the row and
      // every tap in this session lands on the new analysis.
      // Render IMMEDIATELY from the stale hit too. The previous
      // behaviour skipped the hit entirely when the article was
      // marked stale, then made every tap wait for the bulk call
      // to finish — if the bulk hung or took 10+ seconds, the user
      // saw "분석 중..." stuck on every sentence (the screenshot).
      // Render the (filtered, hallucination-stripped) old data
      // immediately so the user has something to read; trigger the
      // background bulk anyway via the block below so the next
      // refresh has clean data.
      var hit = sharedCache.sentences[idx];
      if (!hit || (hit.text || '').trim() !== sentenceText) {
        hit = sharedCache.sentences.find(function(s){ return s && (s.text || '').trim() === sentenceText; });
      }
      var _hitGrammarMissing = !hit || !hit.grammar || !Array.isArray(hit.grammar) || !hit.grammar.length;
      var _hitGrammarBad = hit && _khSentGrammarLooksBad(hit);
      var _hitStale = (_isLowLevel && _hitGrammarMissing) || _hitGrammarBad;
      if (_hitStale) _sharedCacheStale = true;
      if (hit && (hit.translation || (hit.vocab && hit.vocab.length) || (hit.analysis && hit.analysis.length) || (hit.grammar && hit.grammar.length))) {
        window._khSentAnalyzeCache[cacheKey] = hit;
        try { sessionStorage.setItem(cacheKey, JSON.stringify(hit)); } catch(_) {}
        _khRenderSentPanel(panel, hit, null, sentenceText);
        // If the article is stale, kick off the background rebuild
        // and return. The cache update will land for the next tap /
        // refresh; no need to keep "분석 중…" on screen waiting for
        // it.
        if (_sharedCacheStale && articleId) {
          window._khArtFullAnalyzePromise = window._khArtFullAnalyzePromise || {};
          if (!window._khArtFullAnalyzePromise[articleId]) {
            try {
              var _bulkBg = _khTriggerFullArticleAnalyze(articleId, _articleLevel);
              if (_bulkBg && typeof _bulkBg.then === 'function') {
                window._khArtFullAnalyzePromise[articleId] = _bulkBg.finally(function() {
                  delete window._khArtFullAnalyzePromise[articleId];
                });
              }
            } catch(_) {}
          }
        }
        return;
      }
    }
  } catch(_) {}

  // Anonymous users get cached analyses only — no live Claude calls.
  // The three cache layers above already returned if they had a hit;
  // by the time we're here we know we'd be paying for an AI call, so
  // show a sign-in wall instead of letting strangers spend our quota.
  if (typeof supaUser === 'undefined' || !supaUser) {
    panel.innerHTML = '<button class="asp-close" onclick="closeSentPanel()" aria-label="Close">×</button>'
      + '<div class="asp-signin" style="padding:18px 16px;text-align:center">'
      +   '<div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:6px">Sign in to analyze new sentences</div>'
      +   '<div style="font-size:12px;color:#475569;line-height:1.55;margin-bottom:14px">Pre-analyzed sentences are open to everyone. Live AI breakdowns of fresh sentences need an account.</div>'
      +   '<button onclick="closeSentPanel();if(typeof openAuthModal===\'function\')openAuthModal(\'signin\')" style="padding:9px 18px;border-radius:999px;border:0;background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 6px 16px rgba(30,58,138,.32)">Sign in — Free</button>'
      + '</div>';
    return;
  }

  // No shared cache for this article yet — first reader to tap a
  // sentence triggers a background pass over EVERY sentence and
  // writes the result to article_cache.translation. We capture the
  // bulk promise globally so any *subsequent* tap on this article
  // (still mid-bulk) can await it instead of paying for a second
  // single-sentence call. That fixes the user-reported "every
  // sentence shows '분석 중' for 5+ seconds even though I tapped
  // the first one a minute ago" — bulk WAS running, but each new
  // tap was kicking off its own paid live call alongside it.
  // Re-trigger when existing cache is stale at low level
  // (≥30% empty grammar). Per-tab lock prevents multiple bulks.
  window._khArtFullAnalyzePromise = window._khArtFullAnalyzePromise || {};
  var _needsBulk = !sharedCache || !sharedCache.sentences || !sharedCache.sentences.length || _sharedCacheStale;
  if (articleId && _needsBulk && !window._khArtFullAnalyzePromise[articleId]) {
    try {
      var _bulkP = _khTriggerFullArticleAnalyze(articleId, _articleLevel);
      if (_bulkP && typeof _bulkP.then === 'function') {
        window._khArtFullAnalyzePromise[articleId] = _bulkP.finally(function() {
          // Clear so a future stale-cache detection can re-trigger.
          delete window._khArtFullAnalyzePromise[articleId];
        });
      }
    } catch(_) {}
  }

  // We deliberately DO NOT await the bulk promise here anymore.
  // Earlier the await blocked every per-sentence tap until the
  // article-wide bulk Claude call returned (with a 25 s ceiling).
  // For sentences whose existing cache row was empty (the bulk
  // pre-gen only filled some slots, the rest were still null) the
  // user kept seeing "분석 중…" stuck for 25 s every time they
  // tapped a fresh sentence — exactly the report
  //   "분석중 뜨고 새로운 문장분석 떠도 그 다음문장 클릭하면
  //    다시 또 분석중 걸린다고."
  // Bulk still runs in the background (block above triggered it),
  // and future taps on this article will pick up its result via
  // the cache-load path. For THIS tap we just go straight to the
  // live single-sentence call — paid (one Haiku call, ~1-2 s) but
  // bounded and predictable. No more 25 s stalls.

  if (typeof callClaude !== 'function') {
    panel.innerHTML = '<button class="asp-close" onclick="closeSentPanel()" aria-label="Close">×</button>'
      + '<div class="asp-error">분석 기능을 불러올 수 없습니다.</div>';
    return;
  }

  try {
    // Read article level so the prompt can calibrate which patterns
    // to teach. Default to Sprout (Beginner) if unknown so we err on
    // the side of explaining more, not less.
    var _articleLevel = (window._currentArticle && window._currentArticle.level) || 'Beginner';
    var _levelLabel = ({
      Starter:      'Seed (TOPIK 1, complete beginner)',
      Beginner:     'Sprout (TOPIK 2, beginner)',
      Intermediate: 'Tree (TOPIK 3-4, intermediate)',
      Advanced:     'Forest (TOPIK 5-6, advanced)',
    })[_articleLevel] || 'Sprout (TOPIK 2, beginner)';
    var _isLowLevel = (_articleLevel === 'Starter' || _articleLevel === 'Beginner');
    // For Seed/Sprout learners we WANT the basics explained: object
    // markers, simple negation, present continuous, etc. For Tree+
    // we skip those because they're already known and noise.
    var _vocabSkipRule = _isLowLevel
      ? '- VOCAB: max 4 items. Include any content word the learner might not know (verbs, adjectives, nouns). Only skip particles (이/가/을/를/의/에/도/는) and the highest-frequency copula/auxiliaries (이다/있다 alone). 흔하다 / 보다 / 키우다 / 살다 / 먹다 are FAIR GAME at this level — explain them.\n'
      : '- VOCAB: max 4 items. Skip beginner words (는/이/가/이다/있다/하다/되다…). The note must be FACTUAL — what the word means and how it\'s used. Do NOT invent metaphorical readings specific to this sentence; do NOT add example collocations that don\'t apply.\n';
    // Same Analysis design as the bulk path. Single-sentence calls
    // hit this when the bulk cache misses for one row, so the rules
    // need to match exactly to avoid mixed-shape cache rows.
    var _analysisRule =
        '- ANALYSIS: be EXHAUSTIVE. Surface every grammar pattern, fixed expression, idiom, 사자성어, 관용구, and notable collocation in this sentence — even ones you think are "obvious". 8 worthy items → return 8.\n'
      + '    MUST include when present (partial floor — surface anything else from TOPIK 2-6 grammar too):\n'
      + '    · CONNECTIVES: ~에도 불구하고, ~기 때문에, ~기 위해(서) / ~을·를 위해, ~려고 / ~려면, ~다가, ~자마자, ~ㄴ/는데, ~지만/~으나, ~거나, ~면, ~아/어도 / ~더라도 / ~ㄹ지라도, ~았/었더라면, ~았/었더니, ~다 보면, ~다 보니(까), ~ㄴ/는 반면(에), ~ㄴ/는 만큼, ~ㄴ/는 데다(가), ~ㄴ/는 김에, ~ㄴ/는 결과, ~ㄴ 끝에, ~ㄴ/는커녕, ~을 뿐(만) 아니라, ~ㄹ/을수록, ~ㄴ/는 한, ~을 텐데, ~을 테니까, ~기에, ~며 / ~으며.\n'
      + '    · AUXILIARIES: ~ㄹ/을 수 있다·없다, ~지 못하다, ~지 않다 / ~지 말다, ~게 되다, ~기 시작하다, ~기로 하다, ~ㄴ/은 적이 있다·없다, ~아/어 보다, ~아/어 주다, ~아/어 있다, ~고 있다, ~았/었어요 (incl. 봤·했·됐·갔), ~아/어 놓다·두다, ~아/어 버리다, ~아/어 가다·오다, ~아/어 내다, ~아/어 대다, ~게 하다·만들다, ~ㄹ/을 줄 알다·모르다, ~을 수밖에 없다, ~ㄹ 리가 없다, ~ㄹ 모양이다, ~ㄹ 것 같다, ~ㄹ까 하다, ~ㄹ까 봐, ~ㄹ 만하다, ~기 마련이다, ~기 십상이다, ~을 뻔하다, ~ㄴ/는 척하다, ~기는 하다, ~ㄹ 정도이다.\n'
      + '    · MODIFIERS: ~ㄴ/은/는 + 명사, ~ㄹ/을 + 명사, ~던 / ~았/었던, ~ㄴ/은 채(로), ~ㄴ/은 후에·뒤에, ~기 전에, ~을 때(에), ~ㄴ/는 셈이다, ~ㄴ/는 편이다, ~ㄴ/는 듯하다, ~ㄴ/는 모양이다, ~다는 + 명사, ~ㄴ/는 점에서.\n'
      + '    · REPORTED: ~다고/냐고/자고/라고 하다, ~다고 알려져 있어요, ~ㄴ다는 / ~는다는 / ~라는 + 명사, ~다네 / ~다더라 / ~다잖아, ~다고요? / ~라고요?, ~ㄹ 거라고 하다.\n'
      + '    · PARTICLES: ~만, ~까지, ~부터, ~조차, ~밖에, ~마다, ~씩, ~이나, ~마저, ~처럼/같이, ~보다, ~에 비해, ~로서 (role), ~로써 (means), ~에 대해(서), ~에 의해(서), ~으로 인해(서), ~에 관한·관해(서), ~을 통해(서), ~을 따라, ~에 따라, ~을 비롯해(서).\n'
      + '    · ENDERS: ~지(요), ~네(요), ~군요/구나, ~잖아(요), ~다니까(요), ~ㄹ게(요), ~ㄹ까(요), ~을걸(요), ~ㄴ걸, ~던가(요).\n'
      + '    · FIXED EXPRESSIONS: 마음에 들다, 마음이 무겁다·가볍다, 마음에 걸리다, 마음이 놓이다, 시간이 없다, 시간 가는 줄 모르다, 정신을 차리다, 정신없다, 도움이 되다, 도움을 주다·받다, 관심을 가지다, 눈에 띄다, 눈을 감다·뜨다, 눈치가 빠르다, 손이 크다·가다, 발이 넓다, 발등에 불이 떨어지다, 입이 가볍다·무겁다, 귀가 얇다, 머리를 맞대다·식히다, 한 술 더 뜨다, 발 벗고 나서다, 등을 돌리다, 어깨가 무겁다, 콧대가 높다, 기가 차다, 가슴이 뭉클하다, 가슴에 새기다·와닿다, ~에 참여 / 참가하다, ~의 도움으로, ~을 둘러싸다, ~을 차지하다, ~에 영향을 미치다, ~을 거치다, ~을 무릅쓰다, …\n'
      + '    · IDIOMS / 사자성어 / 관용구: 일거양득, 우물 안 개구리, 가는 말이 고와야 오는 말이 곱다, 백문이 불여일견, 작심삼일, 일석이조, 십시일반, 호박씨를 까다, 발 없는 말이 천 리 간다, etc.\n'
      + '    Each item: {"type":"grammar|expression|idiom","label":"<canonical form>","exp":"<short English>","example_in_sentence":"<chunk from sentence>"}.\n'
      + '    Skipping because "too basic / too obvious" is the WRONG call — include it.\n';
    var _analysisVerifyRule =
        '- ANALYSIS VERIFY (HARD RULE):\n'
      + '    1. example_in_sentence MUST be a literal substring of the sentence above. Whitespace can differ; characters cannot.\n'
      + '    2. For type="grammar", the marker should appear in the sentence somewhere. Past-tense contractions (봤어요 = 보+았어요, 했어요, 됐어요) are valid examples for ~았/었어요.\n'
      + '    3. For type="expression"/"idiom", the label is the canonical form; example_in_sentence is the chunk as it appears.\n'
      + '    4. If a candidate fails any rule, OMIT it. Empty arrays are honest output.\n'
      + '    Hallucinations to avoid:\n'
      + '    · Citing a noun phrase like "새로운 웰니스 트렌드" as the example for ~(으)로서.\n'
      + '    · Calling "X예요 / X이에요" plain ~ㄴ다 — that\'s polite copula.\n'
      + '    · Naming an idiom that isn\'t actually in the sentence.\n';
    var prompt =
        'You are a Korean tutor analysing a single sentence for a ' + _levelLabel + ' learner.\n\n'
      + 'Sentence: ' + sentenceText + '\n\n'
      + 'Return ONLY a JSON object with this shape (no preamble, no code fences):\n'
      + '{\n'
      + '  "translation": "natural English translation of the whole sentence",\n'
      + '  "vocab":    [{"ko":"<word in dictionary form>","en":"<short meaning>","note":"<optional 1-line usage hint>"}],\n'
      + '  "analysis": [{"type":"grammar|expression|idiom","label":"<pattern / phrase / idiom>","exp":"<1-sentence English>","example_in_sentence":"<chunk from sentence>"}]\n'
      + '}\n\n'
      + 'Rules:\n'
      + '- TRANSLATION: PRESERVE the original subject — do NOT inject "I/we" if Korean omitted the subject. Use he/she/it/they/the [noun] based on what the sentence implies.\n'
      + '- VOCAB DICTIONARY FORM: write Korean verbs/adjectives in their FULL dictionary form (보다 not 보, 흔하다 not 흔, 살다 not 살). Single-syllable stems are not Korean words.\n'
      + '- VOCAB SINGLE-WORD ONLY: every "ko" entry must be ONE Korean token — no whitespace, no slash, no parens. NEVER emit multi-word phrases like "공기 정화 시스템," "한국 음식," or "재미있는 이야기" as a vocab entry; pick the single hardest word inside (시스템, 정화, etc) instead. Cap each "ko" at ~5 characters / 4 hangul syllables; longer technical compounds belong in the article body, not in vocab.\n'
      + _vocabSkipRule
      + _analysisRule
      + _analysisVerifyRule
      + '- Output JSON only.';
    var res = await callClaude({
      feature: 'sentence-analyze',
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }]
    });
    var raw = (res && res.content && res.content[0] && res.content[0].text) || '';
    var clean = raw.replace(/^```json?/, '').replace(/^```/, '').replace(/```$/, '').trim();
    var oi = clean.indexOf('{'), ei = clean.lastIndexOf('}');
    if (oi < 0 || ei <= oi) throw new Error('JSON 응답을 찾을 수 없습니다');
    var data = JSON.parse(clean.slice(oi, ei + 1));
    window._khSentAnalyzeCache[cacheKey] = data;
    try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch(_) {}
    _khRenderSentPanel(panel, data, null, sentenceText);
  } catch(err) {
    var msg = (err && err.message) || 'unknown';
    if (/unauthor|sign/i.test(msg)) msg = '로그인이 필요합니다';
    panel.innerHTML = '<button class="asp-close" onclick="closeSentPanel()" aria-label="Close">×</button>'
      + '<div class="asp-error">Analysis failed: ' + escapeHTML(msg) + '</div>';
  }
}

// ── Per-bubble click-to-analyze for conversations ──────────────
// Mirrors the article reader's tap-to-analyze: tapping a chat bubble
// opens a panel showing English translation, key vocab, and grammar
// for that single line. Cache layout matches articles (article_cache
// kv schema with content_type='conversation') so the same admin tools
// can pre-warm both. Reuses _khRenderSentPanel + .art-sent-panel CSS.
window._khConvSentSharedCache = window._khConvSentSharedCache || {};
window._khConvFullAnalyzeRunning = window._khConvFullAnalyzeRunning || {};

async function _khLoadConvSentenceCache(convId) {
  if (!convId) return null;
  if (window._khConvSentSharedCache[convId] !== undefined) {
    return window._khConvSentSharedCache[convId];
  }
  var sb = (typeof getSupa === 'function') ? getSupa() : null;
  if (!sb) { window._khConvSentSharedCache[convId] = null; return null; }
  function _parseMsgs(raw) {
    if (raw == null) return null;
    var obj;
    if (typeof raw === 'object') obj = raw;
    else if (typeof raw === 'string') {
      try { obj = JSON.parse(raw); } catch(_) { return null; }
    } else return null;
    return (obj && Array.isArray(obj.messages) && obj.messages.length) ? obj.messages : null;
  }
  try {
    var kv = await sb.from('article_cache')
      .select('cache_value')
      .eq('content_type', 'conversation')
      .eq('content_id', String(convId))
      .eq('cache_key', 'sentence_analysis')
      .maybeSingle();
    if (!kv.error && kv.data) {
      var msgs = _parseMsgs(kv.data.cache_value);
      if (msgs) {
        window._khConvSentSharedCache[convId] = { messages: msgs };
        return window._khConvSentSharedCache[convId];
      }
    }
  } catch(_) {}
  window._khConvSentSharedCache[convId] = null;
  return null;
}

function _khConvLevelLabel(lvl) {
  return ({
    s: 'Seed (TOPIK 1, complete beginner)',
    b: 'Sprout (TOPIK 2, beginner)',
    i: 'Tree (TOPIK 3-4, intermediate)',
    a: 'Forest (TOPIK 5-6, advanced)'
  })[lvl] || 'Sprout (TOPIK 2, beginner)';
}

async function _khTriggerFullConvAnalyze(convId) {
  if (!convId) return;
  if (window._khConvFullAnalyzeRunning[convId]) return;
  var lockKey = 'kh_convfull_running_' + convId;
  try { if (sessionStorage.getItem(lockKey)) return; } catch(_) {}
  window._khConvFullAnalyzeRunning[convId] = true;
  try { sessionStorage.setItem(lockKey, '1'); } catch(_) {}

  try {
    var c = window._currentConv;
    if (!c || !c.msgs || String(c._id || '') !== String(convId)) return;
    var sentences = [];
    c.msgs.forEach(function(m, i) {
      if (!m || m.s === 'n') return; // skip narration
      var t = (m.txt || '').trim();
      if (t) sentences.push({ idx: i, text: t });
    });
    if (!sentences.length) return;
    if (typeof callClaude !== 'function') return;

    var _levelLabel = _khConvLevelLabel(c.lvl);
    var payload = sentences.map(function(s, i){ return (i + 1) + '. ' + s.text; }).join('\n');
    var prompt =
        'You are a Korean tutor analysing each line of a casual conversation for a ' + _levelLabel + ' learner.\n\n'
      + 'Lines (numbered, in order):\n' + payload + '\n\n'
      + 'Return ONLY a JSON object — no preamble, no code fences:\n'
      + '{ "lines": [\n'
      + '  { "translation": "natural English of line 1",\n'
      + '    "vocab":   [{"ko":"<dictionary form>","en":"<short meaning>","note":"<optional 1-line>"}],\n'
      + '    "grammar": [{"pattern":"~ㄴ다 / ~어지다 / etc","exp":"<1-sentence English>","example_in_sentence":"<chunk from line>"}]\n'
      + '  }, ... one entry per input line, same order ...\n'
      + ']}\n\n'
      + 'Rules:\n'
      + '- TRANSLATION: natural conversational English. Preserve original speakers/subjects — do NOT inject "I/we" if Korean omitted them.\n'
      + '- VOCAB: max 3 per line. Skip particles (이/가/을/를/의/에/도/는) and the highest-frequency copula/auxiliaries (이다/있다 alone).\n'
      + '- GRAMMAR: max 2 per line. Skip if just a noun phrase. Don\'t pick patterns that are just a vocab word\'s conjugation.\n'
      + '- Return EXACTLY ' + sentences.length + ' entries in lines[].';
    var res = await callClaude({
      feature: 'conv-sentence-analyze-bulk',
      model: 'claude-haiku-4-5-20251001',
      max_tokens: Math.min(8000, 250 * sentences.length + 600),
      messages: [{ role: 'user', content: prompt }]
    });
    var raw = (res && res.content && res.content[0] && res.content[0].text) || '';
    var clean = raw.replace(/^```json?/, '').replace(/^```/, '').replace(/```$/, '').trim();
    var oi = clean.indexOf('{'), ei = clean.lastIndexOf('}');
    if (oi < 0 || ei <= oi) throw new Error('JSON not found');
    var parsed = JSON.parse(clean.slice(oi, ei + 1));
    var arr = parsed && Array.isArray(parsed.lines) ? parsed.lines : null;
    if (!arr || !arr.length) throw new Error('empty lines[]');

    var stitched = sentences.map(function(s, i) {
      var a = arr[i] || {};
      return {
        idx: s.idx,
        text: s.text,
        translation: a.translation || '',
        vocab: Array.isArray(a.vocab) ? a.vocab : [],
        grammar: Array.isArray(a.grammar) ? a.grammar : []
      };
    });

    var sb = (typeof getSupa === 'function') ? getSupa() : null;
    if (sb) {
      try {
        await sb.from('article_cache').upsert(
          { content_type: 'conversation', content_id: String(convId), cache_key: 'sentence_analysis', cache_value: JSON.stringify({ messages: stitched }) },
          { onConflict: 'content_type,content_id,cache_key' }
        );
      } catch(e) { console.warn('[conv-sent-bg] persist failed:', e); }
    }
    window._khConvSentSharedCache[convId] = { messages: stitched };
    console.log('[conv-sent-bg] cached ' + stitched.length + ' lines for conv ' + convId);
  } catch(err) {
    console.warn('[conv-sent-bg] failed:', err && err.message || err);
  } finally {
    window._khConvFullAnalyzeRunning[convId] = false;
    try { sessionStorage.removeItem(lockKey); } catch(_) {}
  }
}

function closeConvSentPanel() {
  document.querySelectorAll('.conv-sent-panel').forEach(function(p){ p.remove(); });
  document.querySelectorAll('.dp-bubble.conv-sent-active').forEach(function(b){ b.classList.remove('conv-sent-active'); });
}

async function analyzeConvBubble(convId, msgIdx, el) {
  if (!el) return;
  var bubbleRow = el.parentElement;            // .dp-bubble-row
  var group = bubbleRow && bubbleRow.parentElement; // .dp-bubble-group
  if (!group) return;

  // Tapping the same active bubble closes the panel.
  var existingPanel = group.querySelector(':scope > .conv-sent-panel');
  if (existingPanel) {
    existingPanel.remove();
    el.classList.remove('conv-sent-active');
    return;
  }
  closeConvSentPanel();
  el.classList.add('conv-sent-active');

  // Hide the legacy quick-translation div (it's a strict subset of the
  // analysis panel's translation, so keeping both visible is noise).
  var legacyEn = group.querySelector(':scope > .dp-bubble-en');
  if (legacyEn) legacyEn.classList.remove('show');

  var sentenceText = (el.textContent || '').trim();
  if (!sentenceText) { el.classList.remove('conv-sent-active'); return; }

  if (typeof khTrackUser === 'function') {
    try {
      khTrackUser('conv_sentence_analyze', {
        conv_id: convId || null,
        idx: msgIdx,
        sentence_len: sentenceText.length,
      });
    } catch(_) {}
  }

  var panel = document.createElement('div');
  panel.className = 'art-sent-panel conv-sent-panel';
  panel.dataset.msgIdx = String(msgIdx);
  panel.innerHTML = '<button class="asp-close" onclick="closeConvSentPanel()" aria-label="Close">×</button>'
    + '<div class="asp-loading">분석 중</div>';
  // Insert as sibling after .dp-bubble-row, before .dp-bubble-en / .dp-time.
  if (bubbleRow.nextSibling) group.insertBefore(panel, bubbleRow.nextSibling);
  else group.appendChild(panel);

  var cacheKey = 'csa_' + (convId || 'noid') + '_' + msgIdx;

  if (window._khSentAnalyzeCache[cacheKey]) {
    _khRenderSentPanel(panel, window._khSentAnalyzeCache[cacheKey], 'closeConvSentPanel()', sentenceText);
    return;
  }
  try {
    var stored = sessionStorage.getItem(cacheKey);
    if (stored) {
      var parsedStored = JSON.parse(stored);
      window._khSentAnalyzeCache[cacheKey] = parsedStored;
      _khRenderSentPanel(panel, parsedStored, 'closeConvSentPanel()', sentenceText);
      return;
    }
  } catch(_) {}

  // Pre-generated shared cache (article_cache row).
  var sharedCache = null;
  try {
    sharedCache = await _khLoadConvSentenceCache(convId);
    if (sharedCache && sharedCache.messages) {
      var hit = sharedCache.messages.find(function(m){ return m && m.idx === msgIdx; });
      if (!hit || (hit.text || '').trim() !== sentenceText) {
        hit = sharedCache.messages.find(function(m){ return m && (m.text || '').trim() === sentenceText; });
      }
      if (hit && (hit.translation || (hit.vocab && hit.vocab.length) || (hit.analysis && hit.analysis.length) || (hit.grammar && hit.grammar.length))) {
        window._khSentAnalyzeCache[cacheKey] = hit;
        try { sessionStorage.setItem(cacheKey, JSON.stringify(hit)); } catch(_) {}
        _khRenderSentPanel(panel, hit, 'closeConvSentPanel()', sentenceText);
        return;
      }
    }
  } catch(_) {}

  // Anonymous gate — same as articles. Pre-cached lines are free, live
  // calls require sign-in to keep the Claude budget under control.
  if (typeof supaUser === 'undefined' || !supaUser) {
    panel.innerHTML = '<button class="asp-close" onclick="closeConvSentPanel()" aria-label="Close">×</button>'
      + '<div class="asp-signin" style="padding:18px 16px;text-align:center">'
      +   '<div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:6px">Sign in to analyze new lines</div>'
      +   '<div style="font-size:12px;color:#475569;line-height:1.55;margin-bottom:14px">Pre-analyzed lines are open to everyone. Live AI breakdowns of fresh lines need an account.</div>'
      +   '<button onclick="closeConvSentPanel();if(typeof openAuthModal===\'function\')openAuthModal(\'signin\')" style="padding:9px 18px;border-radius:999px;border:0;background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 6px 16px rgba(30,58,138,.32)">Sign in — Free</button>'
      + '</div>';
    return;
  }

  // First reader on a never-analyzed conversation triggers a background
  // bulk pass so subsequent taps (and other readers) hit the cache.
  if (convId && (!sharedCache || !sharedCache.messages || !sharedCache.messages.length)) {
    try { _khTriggerFullConvAnalyze(convId); } catch(_) {}
  }

  if (typeof callClaude !== 'function') {
    panel.innerHTML = '<button class="asp-close" onclick="closeConvSentPanel()" aria-label="Close">×</button>'
      + '<div class="asp-error">분석 기능을 불러올 수 없습니다.</div>';
    return;
  }

  try {
    var c = window._currentConv;
    var _levelLabel = _khConvLevelLabel(c && c.lvl);
    var prompt =
        'You are a Korean tutor analysing a single line of a casual conversation for a ' + _levelLabel + ' learner.\n\n'
      + 'Line: ' + sentenceText + '\n\n'
      + 'Return ONLY a JSON object with this shape (no preamble, no code fences):\n'
      + '{\n'
      + '  "translation": "natural English translation of the whole line",\n'
      + '  "vocab": [{"ko":"<word in dictionary form>","en":"<short meaning>","note":"<optional 1-line usage hint>"}],\n'
      + '  "grammar": [{"pattern":"~ㄴ다 / ~어지다 / etc","exp":"<1-sentence English explanation>","example_in_sentence":"<the chunk from the line that uses this pattern>"}]\n'
      + '}\n\n'
      + 'Rules:\n'
      + '- TRANSLATION: natural conversational English. PRESERVE the original subject — do NOT inject "I/we" if Korean omitted it.\n'
      + '- VOCAB DICTIONARY FORM: write Korean verbs/adjectives in their FULL dictionary form (보다 not 보, 흔하다 not 흔).\n'
      + '- VOCAB SINGLE-WORD ONLY: every "ko" entry must be ONE Korean token — no whitespace, no slash. Cap at ~5 chars / 4 hangul syllables. Phrases like "공기 정화 시스템" or "재미있는 이야기" should be split or skipped.\n'
      + '- VOCAB: max 3 items. Skip particles (이/가/을/를/의/에/도/는) and the highest-frequency copula/auxiliaries (이다/있다 alone).\n'
      + '- GRAMMAR: max 2 patterns. Skip if just a noun phrase. Don\'t pick a pattern that\'s just the conjugation of a vocab word.\n'
      + '- If two patterns stack on the same verb, pick ONLY the more learner-relevant one.\n'
      + '- Output JSON only.';
    var res = await callClaude({
      feature: 'conv-sentence-analyze',
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    });
    var raw = (res && res.content && res.content[0] && res.content[0].text) || '';
    var clean = raw.replace(/^```json?/, '').replace(/^```/, '').replace(/```$/, '').trim();
    var oi = clean.indexOf('{'), ei = clean.lastIndexOf('}');
    if (oi < 0 || ei <= oi) throw new Error('JSON 응답을 찾을 수 없습니다');
    var data = JSON.parse(clean.slice(oi, ei + 1));
    window._khSentAnalyzeCache[cacheKey] = data;
    try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch(_) {}
    _khRenderSentPanel(panel, data, 'closeConvSentPanel()', sentenceText);
  } catch(err) {
    var emsg = (err && err.message) || 'unknown';
    if (/unauthor|sign/i.test(emsg)) emsg = '로그인이 필요합니다';
    panel.innerHTML = '<button class="asp-close" onclick="closeConvSentPanel()" aria-label="Close">×</button>'
      + '<div class="asp-error">Analysis failed: ' + escapeHTML(emsg) + '</div>';
  }
}

function switchArtTab(tab, btn) {
  document.querySelectorAll('.art-tab').forEach(function(b){ b.classList.remove('on'); });
  if (btn) btn.classList.add('on');
  var tabs = ['article','grammar','vocab','quiz'];
  tabs.forEach(function(t){ var el = document.getElementById('art-tab-' + t); if(el) el.style.display = 'none'; });
  var active = document.getElementById('art-tab-' + tab);
  if (active) active.style.display = 'block';
  if (tab === 'grammar') loadGrammarGuide();
  if (tab === 'quiz') {
    var teaser = document.getElementById('fill-teaser');
    if (teaser && !teaser.innerHTML) initFillTeaser(window._currentArticle);
    renderReviewVocabCheck(window._currentArticle);
    renderReviewTF(window._currentArticle);
    _reviewFlowInit();
  }
}

var _reviewFlow = null;

function _reviewFlowInit() {
  _reviewFlow = { step: 0, done: { 0:false, 1:false, 2:false, 3:false } };
  _reviewFlowApply();
}

// Step 0–3 are the four practice cards; step 4 is the Ready-for-deeper-
// study CTA. Only the current step is visible — step 4 only reveals
// once all four practice cards have been completed.
function _reviewFlowApply() {
  var nodes = document.querySelectorAll('#art-tab-quiz [data-step]');
  if (!nodes || !nodes.length || !_reviewFlow) return;
  var current = _reviewFlow.step;
  var prev = null;
  nodes.forEach(function(card) {
    var step = parseInt(card.getAttribute('data-step') || '0', 10);
    var visible = step === current;
    if (visible && card.style.display === 'none' && card.dataset.rvFaded !== '1') {
      // Smooth fade-in on first reveal so the new card doesn't pop.
      card.dataset.rvFaded = '1';
      card.style.display = '';
      card.style.opacity = '0';
      card.style.transform = 'translateY(14px)';
      card.style.transition = 'opacity .45s ease, transform .45s cubic-bezier(.22,1,.36,1)';
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        });
      });
    } else {
      card.style.display = visible ? '' : 'none';
    }
  });
}

function _reviewFlowAdvance(stepDone) {
  if (!_reviewFlow) _reviewFlowInit();
  _reviewFlow.done[stepDone] = true;
  // Cap at 4 so finishing Listening (step 3) reveals the Deeper Study
  // CTA (step 4). Earlier code capped at 3, leaving the CTA gated
  // forever via no-data-step and shown from page load — we now own
  // the CTA's visibility through the flow state.
  _reviewFlow.step = Math.min(stepDone + 1, 4);
  _reviewFlowApply();
  var active = document.querySelector('#art-tab-quiz [data-step="' + _reviewFlow.step + '"]');
  if (active) setTimeout(function(){ try { active.scrollIntoView({ behavior:'smooth', block:'center' }); } catch(e) {} }, 250);
}

// ── Review tab mini-activities ──────────────────────────────────
// Both are client-side so the Review tab is instant even before the
// article_cache roundtrip. Vocab cards flash-card style (tap to
// reveal) are a "did you remember" pass; T/F is 3 sentences where
// one swaps a noun out for a random site-wide VOCAB noun so the
// learner has to notice the mismatch.

// Multiple-choice vocab quiz: pick a word from the article, show 4
// English meanings, user clicks the right one. Distractors are drawn
// from other words in the same article's vocab set (preferred) or from
// the site-wide VOCAB pool as a fallback. Matches the Word Quiz pattern
// on korehan-learn.html so Review feels consistent across the site.
function renderReviewVocabCheck(a) {
  var el = document.getElementById('rv-vocab-check');
  if (!el || !a) return;
  if (el.dataset.builtFor === String(a.id)) return;
  el.dataset.builtFor = String(a.id);

  function paint(items) {
    items = (items || []).filter(function(v){
      return (v.ko || v.word) && (v.en || v.meaning);
    });
    if (items.length < 2) {
      el.innerHTML = '<div class="rv-empty" style="padding:18px 8px;text-align:center"><div style="font-size:13px;font-weight:700;color:#334155;margin-bottom:4px">Not enough vocabulary yet</div><div style="font-size:12px;color:#64748b">Open the Vocab tab above to see words, or try a longer article.</div></div>';
      return;
    }
    _rvVocabQuizState = {
      items: items.slice(0, 8),           // cap pool size
      idx: 0,
      answered: 0,
      correct: 0,
    };
    el.innerHTML =
        '<div class="rv-vq-card">'
      +   '<div class="rv-vq-progress" id="rv-vq-progress"></div>'
      +   '<div class="rv-vq-ko" id="rv-vq-ko"></div>'
      +   '<div class="rv-vq-rom" id="rv-vq-rom"></div>'
      +   '<div class="rv-vq-prompt">Choose the correct meaning</div>'
      +   '<div class="rv-vq-options" id="rv-vq-options"></div>'
      +   '<div class="rv-vq-feedback" id="rv-vq-feedback"></div>'
      + '</div>';
    _rvVocabQuizPaint();
  }
  if (typeof getFromCache === 'function') {
    getFromCache('article', a.id, 'ai_analysis').then(function(c) {
      var src = (c && c.vocab) ? c.vocab : [];
      if (src.length < 2) src = _reviewVocabFromGlobal(a);
      paint(src);
    }).catch(function(){ paint(_reviewVocabFromGlobal(a)); });
  } else {
    paint(_reviewVocabFromGlobal(a));
  }
}

var _rvVocabQuizState = null;

function _rvVocabQuizPaint() {
  var s = _rvVocabQuizState;
  if (!s) return;
  var total = Math.min(s.items.length, 5);
  if (s.idx >= total) {
    var el = document.getElementById('rv-vocab-check');
    if (el) {
      el.innerHTML =
          '<div class="rv-vq-done">'
        +   '<div class="rv-vq-done-title">Nice work</div>'
        +   '<div class="rv-vq-done-score">' + s.correct + ' / ' + total + ' correct</div>'
        +   '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">'
        +     '<button class="rv-vq-retry" onclick="_rvVocabQuizRetry()">Try again</button>'
        +     '<button class="rv-vq-retry" onclick="_rvVocabQuizShare(' + s.correct + ',' + total + ')">Share</button>'
        +   '</div>'
        + '</div>';
      _reviewFlowAdvance(0);
    }
    return;
  }
  var prog = document.getElementById('rv-vq-progress');
  if (prog) prog.textContent = 'Question ' + (s.idx + 1) + ' of ' + total;
  var q = s.items[s.idx];
  var ko = q.ko || q.word || '';
  var rom = q.rom || q.reading || '';
  var correct = q.en || q.meaning || '';

  // Build 3 distractors from the remaining pool (same article preferred).
  var pool = s.items.filter(function(x, i){ return i !== s.idx; })
    .map(function(x){ return x.en || x.meaning || ''; })
    .filter(function(m){ return m && m !== correct; });
  // Pad with site-wide VOCAB if the article pool is too small.
  if (pool.length < 3 && typeof VOCAB === 'object' && VOCAB) {
    Object.keys(VOCAB).forEach(function(k){
      var en = (VOCAB[k] && VOCAB[k].en) || '';
      if (!en || en === correct || pool.indexOf(en) !== -1) return;
      pool.push(en);
    });
  }
  pool = pool.sort(function(){ return Math.random() - 0.5; }).slice(0, 3);
  var choices = [correct].concat(pool).sort(function(){ return Math.random() - 0.5; });

  var koEl  = document.getElementById('rv-vq-ko');
  var romEl = document.getElementById('rv-vq-rom');
  var optsEl = document.getElementById('rv-vq-options');
  var fbEl   = document.getElementById('rv-vq-feedback');
  if (koEl)  koEl.textContent = ko;
  if (romEl) romEl.textContent = rom;
  if (fbEl)  { fbEl.textContent = ''; fbEl.className = 'rv-vq-feedback'; }
  if (optsEl) {
    optsEl.innerHTML = choices.map(function(c){
      var isCorrect = c === correct ? '1' : '0';
      return '<button class="rv-vq-opt" data-correct="' + isCorrect + '" onclick="_rvVocabQuizPick(this)">' + _khEsc(c) + '</button>';
    }).join('');
  }
}

function _rvVocabQuizPick(btn) {
  var s = _rvVocabQuizState;
  if (!s) return;
  var opts = document.querySelectorAll('#rv-vq-options .rv-vq-opt');
  if (!opts.length || opts[0].disabled) return;
  var correct = btn.dataset.correct === '1';
  opts.forEach(function(o){
    o.disabled = true;
    if (o.dataset.correct === '1') o.classList.add('correct');
    else if (o === btn) o.classList.add('wrong');
  });
  s.answered++;
  if (correct) s.correct++;
  var fb = document.getElementById('rv-vq-feedback');
  if (fb) {
    fb.innerHTML = correct ? '<span style="display:inline-flex;align-items:center;gap:5px"><span style="display:inline-flex;width:14px;height:14px;color:#22c55e">'+KH_ICON_CHECK+'</span><span>Correct</span></span>' : '<span style="display:inline-flex;align-items:center;gap:5px"><span style="display:inline-flex;width:14px;height:14px;color:#dc2626">'+KH_ICON_X+'</span><span>Not quite</span></span>';
    fb.className = 'rv-vq-feedback ' + (correct ? 'ok' : 'no');
  }
  setTimeout(_rvVocabQuizNext, 650);
}

function _rvVocabQuizNext() {
  var s = _rvVocabQuizState;
  if (!s) return;
  s.idx++;
  _rvVocabQuizPaint();
}

function _rvVocabQuizRetry() {
  var a = window._currentArticle;
  var el = document.getElementById('rv-vocab-check');
  if (el) el.dataset.builtFor = '';
  _rvVocabQuizState = null;
  renderReviewVocabCheck(a);
}
function _rvVocabQuizShare(correct, total) {
  var a = window._currentArticle || {};
  var title = a.title ? ('"' + a.title + '" — Korean vocab quiz') : 'Korean vocab quiz';
  var text  = 'I scored ' + correct + '/' + total + ' on a Korean vocabulary quiz on KoreHani.';
  khShare({
    title: title,
    text: text,
    url: window.location.href,
  });
}

function _reviewVocabFromGlobal(a) {
  if (typeof VOCAB !== 'object' || !VOCAB) return [];
  var body = ((a && a.body) || '') + ' ' + ((a && a.title) || '');
  var out = [];
  Object.keys(VOCAB).forEach(function(k) {
    if (!k || k.length < 2) return;
    if (body.indexOf(k) === -1) return;
    var v = VOCAB[k] || {};
    out.push({ ko: k, rom: v.rom || '', en: v.en || '' });
  });
  return out.slice(0, 5);
}

// True/False comprehension check.
//
// Previous implementation did a random 2-char Korean noun swap on
// article sentences to manufacture "false" statements. That produced
// unparseable sentences like "지구에서 식사 가까운 별까지..." — the
// algorithm swapped the adverb 가장 with the noun 식사 because it
// had no POS awareness. For a paid product, questions have to at
// least be grammatical Korean.
//
// Replacement: Claude generates 2 paraphrase-of-article TRUE items
// and 1 grammatical-but-incorrect FALSE item, cached per article in
// article_cache under key tf_v1 so repeat visitors don't pay the
// API cost. Same level-aware style as the Fill-in-the-Blank engine.
async function renderReviewTF(a) {
  var el = document.getElementById('rv-tf-check');
  if (!el || !a) return;
  if (el.dataset.builtFor === String(a.id)) return;
  el.dataset.builtFor = String(a.id);

  var body = String((a.body || '') + '\n' + (a.full || '')).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (body.length < 80) {
    el.innerHTML = '<div class="rv-empty" style="padding:18px 8px;text-align:center;font-size:12px;color:#64748b">This article is too short for a comprehension check.</div>';
    return;
  }

  // Pull from cache if we've already generated this article's set.
  var items = null;
  if (typeof getFromCache === 'function') {
    try {
      var cached = await getFromCache('article', a.id, 'tf_v1');
      if (cached && Array.isArray(cached.items) && cached.items.length >= 2) items = cached.items;
    } catch(_) {}
  }

  if (!items) {
    if (!supaUser) {
      el.innerHTML = khEmptyState({
        title: 'Sign in for comprehension check',
        sub: 'AI-generated True/False questions need a signed-in session.',
        action: { label: 'Sign in', onClick: "openAuthModal('signin')" },
      });
      return;
    }
    el.innerHTML = khLoadingHTML(
      'Generating comprehension check',
      'Writing three quick questions based on this article.'
    );
    try {
      var level = a.level || 'Intermediate';
      var prompt = [
        'You are a Korean reading-comprehension teacher. From this article,',
        'produce EXACTLY 3 Korean True/False questions at ' + level + ' level:',
        '  - 2 TRUE items that faithfully paraphrase something the article states.',
        '  - 1 FALSE item that is grammatically natural Korean, topically related,',
        '    but contradicts or invents information not actually in the article.',
        'Every sentence must read as natural Korean — no word-swap artifacts.',
        'Keep each sentence between 15 and 100 characters. Avoid copying full',
        'sentences verbatim from the article.',
        '',
        'Article:',
        '"""',
        body.slice(0, 1500),
        '"""',
        '',
        'Respond with ONLY this JSON, no prose, no code fences:',
        '{"items":[{"sentence":"...","truth":true,"why":"brief English reason"}]}',
      ].join('\n');
      var data = await callClaude({
        feature: 'review-tf',
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 900,
        messages: [{ role: 'user', content: prompt }],
      });
      var raw = (data.content || []).map(function(c){ return c.text || ''; }).join('');
      var clean = raw.replace(/```json|```/g, '').trim();
      var parsed = JSON.parse(clean);
      items = (parsed.items || []).filter(function(x) {
        return x && typeof x.sentence === 'string' && x.sentence.length >= 8 && typeof x.truth === 'boolean';
      }).slice(0, 3);
      if (items.length < 2) throw new Error('not enough valid items');
      try { if (typeof upsertArticleCacheRow === 'function') upsertArticleCacheRow(a.id, { tf_v1: JSON.stringify({ items: items }) }); } catch(_) {}
    } catch(e) {
      el.dataset.builtFor = ''; // allow retry
      el.innerHTML = khEmptyState({
        error: true,
        title: "Couldn't generate the check",
        sub: 'Something went wrong while writing the questions.',
        action: { label: 'Try again', onClick: 'renderReviewTF(window._currentArticle)' },
      });
      return;
    }
  }

  // Shuffle so the 2 TRUE items don't always appear first.
  items = items.slice().sort(function(){ return Math.random() - 0.5; });

  el.innerHTML = items.map(function(it, i) {
    var why = it.why || '';
    return '<div class="rv-tf-q" data-i="' + i + '" data-truth="' + (it.truth ? '1' : '0') + '" data-why="' + _khEsc(why) + '">'
      +   '<div class="rv-tf-text">' + _khEsc(it.sentence) + '</div>'
      +   '<div class="rv-tf-btns">'
      +     '<button class="rv-tf-btn" data-ans="1" onclick="_reviewTFAnswer(this)">True</button>'
      +     '<button class="rv-tf-btn" data-ans="0" onclick="_reviewTFAnswer(this)">False</button>'
      +   '</div>'
      +   '<div class="rv-tf-feedback"></div>'
      + '</div>';
  }).join('');
}

function _reviewTFAnswer(btn) {
  var q = btn.closest('.rv-tf-q');
  if (!q || q.classList.contains('answered')) return;
  var truth = q.dataset.truth === '1';
  var ans = btn.dataset.ans === '1';
  q.classList.add('answered');
  q.classList.add(ans === truth ? 'correct' : 'wrong');
  var fb = q.querySelector('.rv-tf-feedback');
  if (!fb) return;
  var base = (ans === truth)
    ? (truth ? 'Correct — this matches the article.' : "Correct — this one contradicts the article.")
    : (truth ? 'Actually, this statement is from the article.' : "Actually, this one isn't in the article.");
  var why = q.dataset.why || '';
  fb.textContent = why ? (base + ' ' + why) : base;

  var box = document.getElementById('rv-tf-check');
  if (box) {
    var total = box.querySelectorAll('.rv-tf-q').length;
    var answered = box.querySelectorAll('.rv-tf-q.answered').length;
    if (total > 0 && answered === total) {
      setTimeout(function(){ _reviewFlowAdvance(1); }, 500);
    }
  }
}

function openArticleStudyFromReader() {
  var id = (new URLSearchParams(window.location.search)).get('id');
  if (!id) return;
  if (!supaUser) { if (typeof openAuthModal === 'function') openAuthModal('signin'); return; }
  location.href = 'korehan-study-room.html?mode=article&id=' + encodeURIComponent(id);
}



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

  el.innerHTML = '<div style="color:#aaa;padding:20px 0;text-align:center;display:flex;align-items:center;justify-content:center;gap:8px"><span style="display:inline-flex;width:16px;height:16px;color:#a78bfa;animation:spin 1.4s linear infinite">'+KH_ICON_SPARKLE+'</span><span>Analyzing grammar...</span></div>';

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

  el.innerHTML = '<div style="color:#aaa;padding:20px 0;text-align:center;display:flex;align-items:center;justify-content:center;gap:8px"><span style="display:inline-flex;width:16px;height:16px;color:#a78bfa;animation:spin 1.4s linear infinite">'+KH_ICON_SPARKLE+'</span><span>Analyzing grammar with AI...</span></div>';

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
        el.innerHTML = khEmptyState({
          error: true,
          title: 'Grammar Guide unavailable',
          sub: 'A session error occurred. Please reload and try again.',
          action: { label: 'Retry', onClick: 'loadGrammarGuide()' },
        });
        toast('Session error — please reload and try again.', 'error');
      } else {
        el.innerHTML = khEmptyState({
          title: 'Sign in for Grammar Guide',
          sub: 'AI-powered grammar analysis is available for signed-in users.',
          action: { label: 'Sign in', onClick: "openAuthModal('signin')" },
        });
      }
    } else {
      renderStaticGrammar(el, a);
    }
  }
}

function renderGrammarGuideHTML(el, guides) {
  // The cards already carry a numbered header + level badge; the
  // "Grammar patterns found in this article" prose was redundant
  // chrome the user asked us to drop.
  el.innerHTML = guides.map(function(g, i){ return renderGrammarGuideCard(g, i); }).join('');
  // Auto-register encountered grammar points into the user's stats so
  // the article-derived grammar shows up alongside quiz-derived weak
  // grammar in Growth Lab / Study Room. No-op when signed out.
  _autoTrackArticleGrammar(guides);
}

// Register article grammar names into user_grammar_stats (counts stay
// at 0/0 — actual quiz outcomes update them via log_quiz_result). Uses
// upsert with ignoreDuplicates so an existing row's correct/wrong stays
// untouched.
function _autoTrackArticleGrammar(guides) {
  if (!supaUser || !Array.isArray(guides) || !guides.length) return;
  var sb = getSupa();
  if (!sb) return;
  var rows = guides.map(function(g) {
    var name = (g && g.name) ? String(g.name).trim() : '';
    if (!name) return null;
    return { user_id: supaUser.id, grammar_point: name, wrong_count: 0, correct_count: 0 };
  }).filter(Boolean);
  if (!rows.length) return;
  try {
    sb.from('user_grammar_stats')
      .upsert(rows, { onConflict: 'user_id,grammar_point', ignoreDuplicates: true })
      .then(function(){}, function(err){ console.warn('grammar autotrack', err); });
  } catch(e) { console.warn('grammar autotrack', e); }
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
    + '<a href="korehan-study-room.html?focus=' + focus + '&source=home-weak-grammar" class="gp-study-btn">Drill this grammar →</a>'
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

  el.innerHTML = guides.map(renderGrammarGuideCard).join('');
}

function isWordSaved(ko) {
  // Prefer DB-backed set (synced on auth) for cross-device consistency
  if (_savedWordsSet) return _savedWordsSet.has(ko);
  // Fallback to localStorage for logged-out users or before DB sync completes
  var saved = lsGet(K_SAVED, []);
  return saved.some(function(w){ return (w.ko || w.word_ko || '') === ko; });
}

// Vocab tab pagination state — kept module-level because there's only ever
// one article reader open at a time. Reset to page 0 each time
// renderArticleVocab repopulates the list (new article opened or admin
// re-rendered after an edit).
var _avPageSize = 12;
var _avPage = 0;
var _avAll = [];
function _avRenderItem(it) {
  var k = it.ko;
  var rom = it.rom || '';
  var en = it.en || '';
  var saved = isWordSaved(k);
  var safeK  = k.replace(/'/g, "\\'");
  var safeR  = rom.replace(/'/g, "\\'");
  var safeE  = en.replace(/'/g, "\\'");
  var adminDel = window._isAdmin
    ? '<button class="avi-del-btn" title="Delete this word from the article cache (visible to all users)" onclick="khArticleVocabRemove(\'' + safeK + '\')" aria-label="Delete">'
      + '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>'
      + '</button>'
    : '';
  return '<div class="art-vocab-item" data-avi-ko="' + escapeHtml(k) + '">'
    + '<div class="avi-main">'
    + '<span class="art-vocab-ko">' + escapeHtml(k) + '</span>'
    + '<span class="art-vocab-rom">' + escapeHtml(rom) + '</span>'
    + '<span class="art-vocab-en">' + escapeHtml(en) + '</span>'
    + '</div>'
    + '<div class="avi-actions">'
    + ttsBtn(k)
    + '<button class="avi-save-btn' + (saved?' saved':'') + '" title="' + (saved?'Saved':'Save word') + '" '
    + 'onclick="handleVocabSave(this,\'' + safeK + '\',\'' + safeR + '\',\'' + safeE + '\')">'
    + (saved ? '<svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2z"/></svg><span>Saved</span>' : '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg><span>Save</span>')
    + '</button>'
    + adminDel
    + '</div>'
    + '</div>';
}

// Admin-only: remove a vocab entry from the article's Vocab tab and
// persist the change to article_cache. Visible to every reader after
// the next render. The current `_avAll` array gets filtered + paged
// re-render so the UI updates instantly without waiting on the DB.
window.khArticleVocabRemove = async function (ko) {
  if (!window._isAdmin) return;
  if (!ko) return;
  if (!confirm('이 단어를 삭제할까요? 모든 독자한테 사라집니다.\n\n— ' + ko)) return;

  var before = _avAll.slice();
  _avAll = _avAll.filter(function (item) { return item && item.ko !== ko; });
  // Re-render the current page (grab the same list element the tab
  // initially renders into).
  var el = document.getElementById('art-vocab-list');
  if (el) {
    // Clamp page if the deletion shrank past the current page.
    var totalPages = Math.max(1, Math.ceil(_avAll.length / _avPageSize));
    if (_avPage >= totalPages) _avPage = totalPages - 1;
    _avRenderPage(el);
  }

  // Persist. Try wide schema first, fall back to KV.
  try {
    var sb = (typeof getSupa === 'function') ? getSupa() : null;
    if (!sb) throw new Error('no supabase client');
    var params = new URLSearchParams(window.location.search);
    var articleId = params.get('id');
    if (!articleId) throw new Error('no article id');
    var nextVocabJson = JSON.stringify(_avAll);

    var saveErr = null;
    try {
      var w = await sb.from('article_cache').upsert(
        { article_id: String(articleId), vocab: nextVocabJson },
        { onConflict: 'article_id' }
      );
      if (w.error) saveErr = w.error;
    } catch (e) { saveErr = e; }
    if (saveErr && /article_id|column.*does not exist|relation/i.test(String(saveErr.message || saveErr))) {
      saveErr = null;
      var kv = await sb.from('article_cache').upsert(
        { content_type: 'article', content_id: String(articleId), cache_key: 'vocab', cache_value: nextVocabJson },
        { onConflict: 'content_type,content_id,cache_key' }
      );
      if (kv.error) saveErr = kv.error;
    }
    if (saveErr) throw saveErr;
    if (typeof showToast === 'function') showToast('삭제됐어요');
  } catch (e) {
    // Roll back the optimistic UI on failure so the admin sees the
    // entry come back with an error message.
    _avAll = before;
    var el2 = document.getElementById('art-vocab-list');
    if (el2) _avRenderPage(el2);
    if (typeof showToast === 'function') showToast('삭제 실패: ' + (e.message || e), true);
    else alert('삭제 실패: ' + (e.message || e));
  }
};
function _avPagerHTML(total, page, pages) {
  if (pages <= 1) return '';
  var firstIdx = page * _avPageSize + 1;
  var lastIdx = Math.min((page + 1) * _avPageSize, total);
  var prevDis = page === 0;
  var nextDis = page >= pages - 1;
  return '<div class="art-vocab-pager">'
    + '<button class="avp-btn" onclick="khVocabPagePrev()" ' + (prevDis ? 'disabled' : '') + ' aria-label="Previous page">‹</button>'
    + '<span class="avp-info">'
    +   '<span class="avp-range">' + firstIdx + '–' + lastIdx + '</span>'
    +   '<span class="avp-sep">/</span>'
    +   '<span class="avp-total">' + total + '</span>'
    + '</span>'
    + '<button class="avp-btn" onclick="khVocabPageNext()" ' + (nextDis ? 'disabled' : '') + ' aria-label="Next page">›</button>'
    + '</div>';
}
function _avRenderPage(el) {
  var total = _avAll.length;
  var pages = Math.max(1, Math.ceil(total / _avPageSize));
  if (_avPage > pages - 1) _avPage = pages - 1;
  if (_avPage < 0) _avPage = 0;
  var start = _avPage * _avPageSize;
  var slice = _avAll.slice(start, start + _avPageSize);
  el.innerHTML = slice.map(_avRenderItem).join('') + _avPagerHTML(total, _avPage, pages);
}
function _renderArticleVocabItems(el, items) {
  _avAll = Array.isArray(items) ? items : [];
  _avPage = 0;
  _avRenderPage(el);
}
window.khVocabPagePrev = function() {
  if (_avPage > 0) {
    _avPage--;
    var el = document.getElementById('art-vocab-list');
    if (el) {
      _avRenderPage(el);
      // Keep the user's eye anchored on the box top when paging.
      var box = el.closest('.art-vocab-box');
      if (box && typeof box.scrollIntoView === 'function') {
        box.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }
};
window.khVocabPageNext = function() {
  var pages = Math.max(1, Math.ceil(_avAll.length / _avPageSize));
  if (_avPage < pages - 1) {
    _avPage++;
    var el = document.getElementById('art-vocab-list');
    if (el) {
      _avRenderPage(el);
      var box = el.closest('.art-vocab-box');
      if (box && typeof box.scrollIntoView === 'function') {
        box.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }
};

function renderArticleVocab(a) {
  var el = document.getElementById('art-vocab-list');
  if (!el) return;

  // Article Vocab MUST come from the article itself. Source order:
  //   1) a.vocab (AI-curated vocab attached to the article object)
  //   2) article_cache.ai_analysis.vocab (Claude-picked from the article body)
  //   3) Global VOCAB entries that appear in the body AS STANDALONE words
  //      (length>=2, Korean word-boundary — so we never surface 집 just
  //      because "집중" is in the body). Every surfaced entry is guaranteed
  //      to appear in the article text.
  var body = (a && (a.body || a.full || a.title)) || '';

  function inArticleBody(ko) {
    if (!ko || ko.length < 2) return false;
    var esc = ko.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    // Left boundary only: the word must not be preceded by a Korean
    // syllable (so 집 doesn't match inside 집중). We deliberately do NOT
    // require a non-Korean char on the right — in Korean, nouns are
    // almost always followed by a particle (을/를/이/가/에/에서/은/는/의
    // /으로…) which is itself Korean. The old strict-right check dropped
    // every noun with a particle, leaving only stem-matched verbs like
    // 노력하다 / 돌아오다 / 기억하다 in the Vocab tab.
    var re = new RegExp('(^|[^\\uAC00-\\uD7A3])' + esc);
    if (re.test(body)) return true;
    // Dictionary-form verbs/adjectives that only appear conjugated —
    // match the stem (drop trailing 다/요).
    if (ko.length >= 3 && /[다요]$/.test(ko)) {
      var stem = ko.slice(0, -1);
      if (stem.length >= 2) {
        var sre = new RegExp('(^|[^\\uAC00-\\uD7A3])' + stem.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
        if (sre.test(body)) return true;
      }
    }
    return false;
  }

  function normalize(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    var seen = {};
    list.forEach(function(v) {
      if (!v) return;
      var rawKo = v.ko || v.word || v.word_ko || '';
      var rawRom = v.rom || v.reading || v.word_rom || '';
      var rawEn  = v.en  || v.meaning || v.word_en  || '';
      // Match against the ORIGINAL form — the stem regex inside
      // inArticleBody catches conjugated verbs. Normalize for display
      // only after the body check passes.
      if (!inArticleBody(rawKo)) return;
      var norm = khNormalizeVocabNoun(rawKo, rawRom, rawEn);
      if (!norm || seen[norm.ko]) return;
      seen[norm.ko] = true;
      out.push(norm);
    });
    // No cap — the Vocab tab paginates downstream so all sentence-derived
    // vocab is reachable. Old articles still come in around 10 entries
    // because their legacy vocab call was capped at generation time.
    return out;
  }

  function fromGlobalVocab() {
    if (!body || typeof VOCAB !== 'object' || !VOCAB) return [];
    // Try longest first so compound nouns beat single roots.
    var keys = Object.keys(VOCAB).filter(function(k){ return k && k.length >= 2; })
                                 .sort(function(a,b){ return b.length - a.length; });
    var out = [];
    var seen = {};
    // Cap at 10 sitewide matches — feeding the entire VOCAB dict into
    // the Vocab tab's downstream syncIntoHover() / korehanHoverRegisterExtras
    // path put thousands of words into the hover system and broke
    // hover entirely (regex compile + DOM walk choked on the volume).
    // Admin-added words still surface via the dedicated
    // _admin_extra_vocab path below — no need to dump everything here.
    for (var i = 0; i < keys.length && out.length < 10; i++) {
      var k = keys[i];
      if (!inArticleBody(k)) continue;
      var v = VOCAB[k] || {};
      var norm = khNormalizeVocabNoun(k, v.rom || '', v.en || '');
      if (!norm || seen[norm.ko]) continue;
      seen[norm.ko] = true;
      out.push(norm);
    }
    return out;
  }

  // Admin Vocab Edit Mode (+ New Word, drag-select, edit existing) writes
  // into the sitewide vocabulary_bank. Those entries land in VOCAB on the
  // next page load, but the article AI cache doesn't know about them, so
  // a freshly-added admin word never made it into the Vocab tab merge —
  // even when the body matched. We track admin-added words in a sidecar
  // localStorage list and ALWAYS include those whose body matches, on top
  // of the capped fromGlobalVocab pass above. Targeted instead of dumping
  // every sitewide entry through the hover system.
  function fromAdminAdds() {
    if (!body) return [];
    var out = [];
    var seen = {};
    try {
      var raw = localStorage.getItem('kh_admin_added_vocab');
      if (!raw) return [];
      var list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      list.forEach(function(item) {
        if (!item || !item.ko) return;
        if (seen[item.ko]) return;
        if (!inArticleBody(item.ko)) return;
        var norm = khNormalizeVocabNoun(item.ko, item.rom || '', item.en || '');
        if (!norm) return;
        seen[norm.ko] = true;
        out.push(norm);
      });
    } catch (_) {}
    return out;
  }

  function syncIntoHover(items) {
    // Two hover systems to keep in sync — the article body has hover
    // behaviour from BOTH:
    //   1. .kh-word (wrapVocab) — highlights words present in the global
    //      VOCAB dict.
    //   2. .kh-hover-word (korehan-hover-tooltips.js) — dotted
    //      underline tooltip for words present in hover_vocab_master
    //      OR registered via korehanHoverRegisterExtras.
    // Earlier this only updated #1, so an article-only vocab word that
    // wasn't in the hover_vocab_master table never got a tooltip — the
    // user reported this as "hover sometimes works, sometimes doesn't".
    // Register into both systems so every Vocab-tab entry is hoverable
    // in the body.
    if (!Array.isArray(items) || !items.length) return;
    var added = 0;
    if (typeof VOCAB === 'object' && VOCAB) {
      items.forEach(function(it) {
        if (!it || !it.ko) return;
        if (!VOCAB[it.ko] || !VOCAB[it.ko].en) {
          VOCAB[it.ko] = { rom: it.rom || '', en: it.en || '' };
          added++;
        }
      });
    }
    // System 2: dotted-underline hover tooltips. Idempotent — the helper
    // dedupes against its own list.
    try {
      if (typeof window.korehanHoverRegisterExtras === 'function') {
        window.korehanHoverRegisterExtras(items.map(function(it) {
          return { ko: it.ko, en: it.en || '', rom: it.rom || '', note: it.note || '' };
        }));
      }
    } catch (_) {}
    if (added > 0) {
      try {
        var artEl = document.getElementById('art-tab-article');
        if (artEl) {
          artEl.querySelectorAll('.vocab-zone').forEach(function(z){ wrapVocab(z); });
        }
      } catch(e) {}
    }
  }

  function finalize(items) {
    // The box itself stays visible — keep the Vocab tab useful even when
    // we're falling back to body-scanned common vocabulary.
    var box = el.closest('.art-vocab-box');
    if (box) box.style.display = '';
    // Merge: AI cache list + any sitewide VOCAB entries that actually
    // appear in this body. Without the merge, words an admin adds via
    // Vocab Edit Mode (+ New Word / drag-select / edit existing — all
    // three write to vocabulary_bank → sitewide VOCAB, not to
    // article_cache) would never surface here once the AI cache has
    // been populated. Cache items take priority so the AI picks lead;
    // sitewide matches fill the remainder, capped at 12.
    var merged = (items && items.length) ? items.slice() : [];
    var seen = {};
    merged.forEach(function(v){ if (v && v.ko) seen[v.ko] = true; });
    // ALWAYS merge admin-added words first — these come from the
    // localStorage sidecar populated whenever an admin saves through
    // Vocab Edit Mode. Body-filtered, dedupe-against-cache, no cap.
    // This is the targeted fix for "admin added 혁신 but Vocab tab
    // doesn't show it" without dumping all of VOCAB into the hover
    // system.
    fromAdminAdds().forEach(function(v){
      if (v && v.ko && !seen[v.ko]) { merged.push(v); seen[v.ko] = true; }
    });
    // Then top up with general sitewide VOCAB matches when cache is sparse.
    if (merged.length < _avPageSize) {
      fromGlobalVocab().forEach(function(v){
        if (v && v.ko && !seen[v.ko]) { merged.push(v); seen[v.ko] = true; }
      });
    }
    if (!merged.length) {
      el.innerHTML = '<div style="padding:20px;color:#94a3b8;font-size:13px;text-align:center">No vocabulary available for this article yet.</div>';
      _appendAdminAddVocabButton(el, a);
      return;
    }
    _renderArticleVocabItems(el, merged);
    syncIntoHover(merged);
    _appendAdminAddVocabButton(el, a);
  }

  // article_cache is the canonical, freshest source — admin bulk regenerate
  // writes here. Inline a.vocab is a fallback: useful for brand-new rows
  // before cache is populated, and for addVocab's optimistic in-memory
  // append (which writes cache first, then pushes inline). Reading cache
  // first means a regenerate is visible on the next article open even when
  // the inline column / browser articles cache is stale.
  var inline = normalize(a && a.vocab);
  var artId = a && a.id;
  if (!artId || typeof getFromCache !== 'function') { finalize(inline); return; }

  el.innerHTML = khLoadingHTML('Loading vocabulary', 'Analyzing the key words from this article.');
  getFromCache('article', artId, 'ai_analysis').then(function(cached) {
    var fromCache = normalize(cached && cached.vocab);
    finalize(fromCache.length ? fromCache : inline);
  }).catch(function() { finalize(inline); });
}

// ── Admin-only "+ Add Word" button on the article Vocab tab ──────────────
// Lets an admin append a word to THIS article's article_cache.vocab (not
// the sitewide VOCAB / vocabulary_bank — that's what openVocabEditModal
// handles). Shown only when window._isAdmin is truthy.
function _appendAdminAddVocabButton(listEl, article) {
  if (!listEl || !article || !article.id) return;
  if (!window._isAdmin) return;
  // Don't duplicate if already present
  if (listEl.querySelector('[data-admin-add-vocab]')) return;
  var btn = document.createElement('button');
  btn.setAttribute('data-admin-add-vocab', '1');
  btn.type = 'button';
  btn.textContent = '+ Add word to this article';
  btn.style.cssText = 'margin-top:10px;width:100%;padding:10px 14px;border:1.5px dashed #a78bfa;border-radius:10px;background:rgba(167,139,250,.08);color:#6d28d9;font-size:12px;font-weight:800;letter-spacing:.02em;cursor:pointer;font-family:inherit;transition:background .15s,border-color .15s';
  btn.onmouseover = function(){ btn.style.background = 'rgba(167,139,250,.18)'; btn.style.borderColor = '#7c3aed'; };
  btn.onmouseout  = function(){ btn.style.background = 'rgba(167,139,250,.08)'; btn.style.borderColor = '#a78bfa'; };
  btn.onclick = function(){ openArticleVocabAddModal(article); };
  listEl.appendChild(btn);
}

function openArticleVocabAddModal(article) {
  if (!article || !article.id) return;
  var old = document.getElementById('kh-article-vocab-add');
  if (old) old.remove();
  var modal = document.createElement('div');
  modal.id = 'kh-article-vocab-add';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(5,12,24,.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML =
      '<div style="background:#fff;border-radius:16px;padding:22px;max-width:440px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,.3);">'
    + '<div style="font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#a78bfa;margin-bottom:4px">Article Vocabulary</div>'
    + '<div style="font-size:16px;font-weight:900;color:#0f172a;margin-bottom:14px;">Add word to <span style="color:#6d28d9">' + (article.title || 'this article').slice(0, 48) + '</span></div>'
    + '<label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Korean word <span style="color:#e53e3e">*</span></label>'
    + '<input id="avm-ko" placeholder="예: 갖추다" style="width:100%;padding:10px 12px;border:2px solid #a78bfa;border-radius:8px;font-size:16px;font-family:\'Noto Serif KR\',serif;margin-bottom:10px;box-sizing:border-box;" autofocus>'
    + '<label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Romanization</label>'
    + '<input id="avm-rom" placeholder="gatchuda" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;margin-bottom:10px;box-sizing:border-box;">'
    + '<label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">English meaning <span style="color:#e53e3e">*</span></label>'
    + '<input id="avm-en" placeholder="to equip / have ready" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;margin-bottom:6px;box-sizing:border-box;">'
    + '<div id="avm-err" style="font-size:12px;color:#e53e3e;margin-bottom:10px;display:none;"></div>'
    + '<div style="display:flex;gap:8px;margin-top:12px;">'
    +   '<button id="avm-save" style="flex:1;padding:11px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:800;cursor:pointer;">Add to article</button>'
    +   '<button id="avm-cancel" style="padding:11px 16px;background:#f1f5f9;color:#475569;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">Cancel</button>'
    + '</div></div>';
  document.body.appendChild(modal);
  var koInput = modal.querySelector('#avm-ko');
  var romInput = modal.querySelector('#avm-rom');
  var enInput = modal.querySelector('#avm-en');
  var errEl = modal.querySelector('#avm-err');
  modal.onclick = function(e){ if (e.target === modal) modal.remove(); };
  modal.querySelector('#avm-cancel').onclick = function(){ modal.remove(); };
  modal.querySelector('#avm-save').onclick = async function() {
    var ko = (koInput.value || '').trim();
    var rom = (romInput.value || '').trim();
    var en = (enInput.value || '').trim();
    if (!ko || !/[가-힣]/.test(ko)) {
      errEl.textContent = 'Please enter a Korean word.'; errEl.style.display = 'block'; return;
    }
    if (!en) { errEl.textContent = 'Please enter the English meaning.'; errEl.style.display = 'block'; return; }
    var saveBtn = modal.querySelector('#avm-save');
    saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;
    try {
      var ok = await _saveArticleVocabAppend(article, { ko: ko, rom: rom, en: en });
      if (!ok) {
        errEl.textContent = 'Save failed. Check console.'; errEl.style.display = 'block';
        saveBtn.textContent = 'Add to article'; saveBtn.disabled = false;
        return;
      }
      modal.remove();
      if (typeof showToast === 'function') showToast('"' + ko + '" added');
      // Re-render the Vocab tab so the new word appears immediately
      try { renderArticleVocab(article); } catch(_) {}
    } catch (e) {
      errEl.textContent = (e && e.message) || 'Save failed.'; errEl.style.display = 'block';
      saveBtn.textContent = 'Add to article'; saveBtn.disabled = false;
    }
  };
}

async function _saveArticleVocabAppend(article, entry) {
  if (!article || !article.id || !entry || !entry.ko) return false;
  if (typeof getSupa !== 'function') return false;
  var sb = getSupa();
  if (!sb) return false;
  try {
    // 1) Fetch current article_cache.vocab via getFromCache so we handle
    // both "wide" and "kv" schemas the same way downstream code does.
    var cached = (typeof getFromCache === 'function')
      ? await getFromCache('article', article.id, 'ai_analysis')
      : null;
    var current = (cached && Array.isArray(cached.vocab)) ? cached.vocab.slice() : [];
    // 2) Dedup on dictionary form
    var has = current.some(function(v){
      var key = (v.word || v.ko || v.word_ko || '');
      return key === entry.ko;
    });
    if (has) {
      if (typeof showToast === 'function') showToast('"' + entry.ko + '" already in the list');
      return true;
    }
    // 3) Append in the shape the renderer + validator expect
    current.push({ word: entry.ko, reading: entry.rom || '', meaning: entry.en || '', context: '' });
    // 4) Persist via shared upsertArticleCacheRow (handles both schemas)
    if (typeof upsertArticleCacheRow === 'function') {
      await upsertArticleCacheRow(article.id, { vocab: JSON.stringify(current) });
    } else {
      await sb.from('article_cache').upsert({
        article_id: String(article.id),
        vocab: JSON.stringify(current),
        updated_at: new Date().toISOString()
      }, { onConflict: 'article_id' });
    }
    // 5) Update in-memory article object so the renderer's first-pass
    // inline path (a.vocab) shows the new word on next render.
    if (Array.isArray(article.vocab)) {
      article.vocab.push({ ko: entry.ko, rom: entry.rom || '', en: entry.en || '' });
    }
    // 6) Also drop into sitewide VOCAB so hover tooltips catch it.
    if (typeof VOCAB === 'object' && VOCAB && !VOCAB[entry.ko]) {
      VOCAB[entry.ko] = { rom: entry.rom || '', en: entry.en || '' };
    }
    return true;
  } catch (e) {
    console.warn('[_saveArticleVocabAppend]', e);
    return false;
  }
}

function _addWordToKeyVocabList(ko, rom, en) {
  var el = document.getElementById('art-vocab-list');
  if (!el) return;
  // 이미 있으면 스킵
  if (el.querySelector('.art-vocab-item[data-avi-ko="' + (ko || '').replace(/"/g, '&quot;') + '"]')) return;
  // 박스 보이게
  var box = el.closest('.art-vocab-box');
  if (box) box.style.display = '';
  var safeK = ko.replace(/'/g, "\\'");
  var safeR = (rom||'').replace(/'/g, "\\'");
  var safeE = (en||'').replace(/'/g, "\\'");
  var item = document.createElement('div');
  item.className = 'art-vocab-item';
  item.setAttribute('data-avi-ko', ko);
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


function shareArticle() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: window.location.href });
  } else {
    navigator.clipboard.writeText(window.location.href).then(function() {
      toast('Link copied');
    });
  }
}


// ── VOCAB EDIT FAB VISIBILITY ─────────────────────────────────
// FAB should only appear for admin when viewing actual Korean content:
//   • Article page (korehan-article.html) — always
//   • Conversations page — only while the detail modal (#detail-overlay) is open
//   • Stories page — only while the story modal (#st-overlay) is open
function _shouldShowVocabFab() {
  if (!window._isAdmin) return false;
  var path = (location.pathname || '').toLowerCase();
  if (path.indexOf('korehan-article') !== -1) return true;
  if (path.indexOf('korehan-conversations') !== -1) {
    var o = document.getElementById('detail-overlay');
    return !!(o && !o.classList.contains('hidden'));
  }
  if (path.indexOf('korehan-stories') !== -1) {
    var o = document.getElementById('st-overlay');
    return !!(o && !o.classList.contains('hidden'));
  }
  return false;
}
function _updateVocabFabVisibility() {
  var bar = document.getElementById('vocab-admin-bar');
  if (!bar) return;
  var show = _shouldShowVocabFab();
  bar.style.display = show ? '' : 'none';
  if (!show && window._vocabEditMode) toggleVocabEditMode();
}
function _setupVocabFabVisibility() {
  _updateVocabFabVisibility();
  ['detail-overlay', 'st-overlay'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    try {
      new MutationObserver(_updateVocabFabVisibility)
        .observe(el, { attributes: true, attributeFilter: ['class'] });
    } catch (e) {}
  });
}

// ── TOOLTIP ───────────────────────────────────────────────────
function initTooltips() {
  var tip = document.createElement('div');
  tip.id = 'kh-tip';
  // Sharp toast with blue left-stripe accent — the original kh-tip
  // look. Tried unifying with the kh-hover-tip rounded-card style;
  // user preferred the original here. Kept tighter / single-line.
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

  // 어드민 전용 편집 버튼 — 기사 페이지 / conversations 모달 / stories 모달 안에서만 노출.
  // Double-check here rather than trusting window._isAdmin alone: the flag
  // is set inside updateAuthUI() (async, after getSession resolves), but
  // initTooltips can fire from loadVocabFromDB() on a different timing
  // on some pages. If auth lands late, we also listen for the auth event
  // to mount the bar after sign-in. A stale `true` flag from a prior
  // page's state also can't slip through because we re-verify against
  // supaUser on every mount attempt.
  function _mountVocabAdminBarIfEligible() {
    // Guard: bar already in DOM, skip.
    if (document.getElementById('vocab-admin-bar')) return;
    // Hard gate: must have an active session AND an admin email.
    // Relying purely on window._isAdmin left a gap — if another script
    // set it optimistically, or if it hadn't been cleared after a
    // previous admin session, the bar could appear for non-admins.
    var ADMIN_EMAILS = ['enane960819@gmail.com'];
    var u = typeof supaUser !== 'undefined' ? supaUser : null;
    var ok = !!(u && u.email && ADMIN_EMAILS.indexOf(u.email) !== -1);
    if (!ok) return;
    // Keep window._isAdmin in sync so other call sites see the same
    // truth — covers the timing race where initTooltips wins against
    // updateAuthUI.
    window._isAdmin = true;
    var adminBar = document.createElement('div');
    adminBar.id = 'vocab-admin-bar';
    // Anchored on the LEFT so it doesn't overlap the right-side action
    // sidebar (Save / Talk / Study) on the article reader. Bottom offset
    // matches the right-side stack so they balance visually.
    adminBar.style.cssText = 'position:fixed;bottom:calc(env(safe-area-inset-bottom,0px) + 92px);left:16px;z-index:8000;background:#0b1626;color:#fff;border-radius:10px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.1);display:none;';
    adminBar.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px"><span style="display:inline-flex;width:14px;height:14px">'+KH_ICON_PENCIL+'</span><span>Vocab Edit Mode</span></span>';
    adminBar.onclick = function() { toggleVocabEditMode(); };
    document.body.appendChild(adminBar);
    _setupVocabFabVisibility();
  }
  _mountVocabAdminBarIfEligible();
  // If the user signs in as admin AFTER initTooltips ran, mount the
  // bar at that point. kh-auth-signed-in is fired from updateAuthUI
  // every time a session is established.
  window.addEventListener('kh-auth-signed-in', _mountVocabAdminBarIfEligible);
  window.addEventListener('kh-auth-signed-in', function() { _khSyncStudiedFromDB(); });
  // Tear the bar down on sign-out so a non-admin landing in the same
  // tab right after doesn't see a leftover admin button.
  window.addEventListener('kh-auth-signed-out', function() {
    var existing = document.getElementById('vocab-admin-bar');
    if (existing) existing.remove();
    if (window._vocabEditMode) toggleVocabEditMode();
  });

  document.addEventListener('mouseover', function(e) {
    var w = e.target.closest ? e.target.closest('.kh-word') : null;
    if (!w) return;
    var word = w.dataset.word;
    var d = VOCAB[word];
    if (window._vocabEditMode && window._isAdmin) {
      tip.innerHTML = '<span style="font-size:13px;color:#fbbf24;font-weight:700;display:inline-flex;align-items:center;gap:5px"><span style="display:inline-flex;width:13px;height:13px">'+KH_ICON_PENCIL+'</span><span>Click to edit</span></span><br>'
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
      bar.innerHTML = '<span style="display:inline-flex;align-items:center;gap:5px"><span style="display:inline-flex;width:14px;height:14px;color:#22c55e">'+KH_ICON_CHECK+'</span><span>Edit ON</span></span>'
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
    + '<div style="font-size:16px;font-weight:900;color:#0f172a;margin-bottom:16px;display:flex;align-items:center;gap:6px"><span style="display:inline-flex;width:16px;height:16px">'+KH_ICON_PENCIL+'</span><span>' + (isNew ? 'Add New Word' : 'Edit Word: <span style="color:#2255a4">' + word + '</span>') + '</span></div>'
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

  // ── Auto-fill rom + en when admin types Korean (Add-mode only).
  // Lookup order: hover_vocab_master → vocabulary_bank → Claude Haiku.
  // Never overwrites a field the admin already typed into.
  if (isNew) {
    var _veFillTimer = null;
    var _veLastQ = '';
    var wordEl = modal.querySelector('#ve-word');
    var romEl  = modal.querySelector('#ve-rom');
    var enEl   = modal.querySelector('#ve-en');
    if (wordEl) {
      wordEl.addEventListener('input', function() {
        if (_veFillTimer) clearTimeout(_veFillTimer);
        var w = wordEl.value.trim();
        _veFillTimer = setTimeout(function(){ _veAutoFill(w); }, 600);
      });
    }
    async function _veAutoFill(word) {
      if (!word || word === _veLastQ) return;
      if (!/[가-힣]/.test(word)) return;
      _veLastQ = word;
      var needRom = !romEl.value.trim();
      var needEn  = !enEl.value.trim();
      if (!needRom && !needEn) return;

      var sb = (typeof getSupa === 'function') ? getSupa() : null;
      // 1) hover_vocab_master
      if (sb) {
        try {
          var r1 = await sb.from('hover_vocab_master')
            .select('reading,meaning_en')
            .eq('word_ko', word).maybeSingle();
          if (r1.data && (r1.data.reading || r1.data.meaning_en)) {
            if (needRom && r1.data.reading)    romEl.value = r1.data.reading;
            if (needEn  && r1.data.meaning_en) enEl.value  = r1.data.meaning_en;
            return;
          }
        } catch(_) {}
        // 2) vocabulary_bank
        try {
          var r2 = await sb.from('vocabulary_bank')
            .select('word_rom,word_en')
            .eq('word_ko', word).maybeSingle();
          if (r2.data && (r2.data.word_rom || r2.data.word_en)) {
            if (needRom && r2.data.word_rom) romEl.value = r2.data.word_rom;
            if (needEn  && r2.data.word_en)  enEl.value  = r2.data.word_en;
            return;
          }
        } catch(_) {}
      }
      // 3) Claude AI fallback
      try {
        var resp = await callClaude({
          feature: 'inline-vocab-autofill',
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: 'Korean word: "' + word + '"\n\n'
              + 'Return ONLY JSON, no markdown:\n'
              + '{"reading":"Revised romanization with hyphens between syllables (e.g. gam-gi, an-nyeong-ha-se-yo)","meaning":"Concise English gloss, 1-5 words, no parentheses"}'
          }]
        });
        var raw = (resp.content || []).map(function(c){ return c.text || ''; }).join('');
        var s = raw.indexOf('{'), e = raw.lastIndexOf('}');
        if (s < 0 || e <= s) return;
        var parsed = JSON.parse(raw.slice(s, e + 1));
        if (needRom && parsed.reading && !romEl.value.trim()) romEl.value = parsed.reading;
        if (needEn  && parsed.meaning && !enEl.value.trim())  enEl.value  = parsed.meaning;
      } catch(_) { /* silent — admin can still type manually */ }
    }
  }

  var delBtn = modal.querySelector('#ve-del');
  if (delBtn) {
    delBtn.onclick = async function() {
      var ok = await khConfirm('Delete word?', 'Remove "' + word + '" from the vocabulary database?', { okLabel: 'Delete', destructive: true });
      if (!ok) return;
      await saveVocabToDB(word, null, null, true);
      delete VOCAB[word];
      // 해당 단어 span 제거
      document.querySelectorAll('.kh-word[data-word="' + word + '"]').forEach(function(s) {
        s.replaceWith(document.createTextNode(s.textContent));
      });
      // Also drop the word from the article's Key Vocabulary panel.
      // The hover spans get unwrapped above, but the Vocab tab list is
      // rendered from a separate source (article.vocab + article_cache.
      // ai_analysis.vocab + global VOCAB filtered by body presence) and
      // would otherwise keep showing the deleted word until reload —
      // exactly the user-reported "hover gone but Vocab tab still has
      // it" mismatch.
      var _art = window._currentArticle;
      if (_art) {
        if (Array.isArray(_art.vocab)) {
          _art.vocab = _art.vocab.filter(function(v) {
            return v && (v.ko || v.word_ko || v.word) !== word;
          });
        }
        if (_art._cache && _art._cache.ai_analysis && Array.isArray(_art._cache.ai_analysis.vocab)) {
          _art._cache.ai_analysis.vocab = _art._cache.ai_analysis.vocab.filter(function(v) {
            return v && (v.ko || v.word_ko || v.word) !== word;
          });
        }
      }
      // Direct DOM strip handles the case where Vocab tab is already
      // open and rendered; the in-memory cleanup above handles the
      // case where the user closes and reopens the tab.
      document.querySelectorAll('.art-vocab-item[data-avi-ko="' + word + '"]').forEach(function(item) {
        item.remove();
      });
      // If a re-render helper is exposed, run it so any other surfaces
      // (e.g. quick-vocab pills) catch up too.
      if (typeof renderArticleVocab === 'function' && _art) {
        try { renderArticleVocab(_art); } catch(_) {}
      }
      modal.remove();
      showToast(word + ' deleted');
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
      // INTENTIONAL: do NOT call dbSaveWord here. Vocab Edit Mode is
      // the admin tool for adding a word to the *sitewide* dictionary
      // (vocabulary_bank → hover for everyone, Vocab tab for everyone).
      // The earlier code also wrote into user_saved_words via
      // dbSaveWord, which polluted the admin's personal My Words /
      // Word Book every time they curated a word for the site. The
      // user-reported "운영자 my word db에 추가되는게 문제" — exactly
      // this. Vocab tab visibility is now driven by VOCAB +
      // fromAdminAdds() (PR #374 sidecar) and the per-article cache,
      // none of which need a per-user row.
      VOCAB[finalWord] = { rom: rom, en: en };
      // Persist into the warm VOCAB snapshot so hover survives a
      // refresh even if the next loadVocabFromDB() comes back
      // empty (RLS asymmetry between admin-api writes and the
      // anon/authenticated read path was the root cause of "saved
      // to My Words but hover doesn't pick it up").
      try {
        var _vKey = (typeof KH_VOCAB_LS_KEY !== 'undefined') ? KH_VOCAB_LS_KEY : 'kh_vocab_dict_v1';
        var _raw = localStorage.getItem(_vKey);
        var _snap = (_raw && JSON.parse(_raw)) || {};
        if (!_snap.dict || typeof _snap.dict !== 'object') _snap.dict = {};
        _snap.dict[finalWord] = { rom: rom || '', en: en || '' };
        _snap.savedAt = Date.now();
        localStorage.setItem(_vKey, JSON.stringify(_snap));
      } catch (_) {}
      // Sidecar so renderArticleVocab's fromAdminAdds() can surface
      // this word in the Vocab tab on every article whose body matches
      // — even when the article's AI cache already has 12+ entries
      // and would otherwise saturate the merge.
      try {
        var _kAdd = 'kh_admin_added_vocab';
        var _existing = [];
        try { _existing = JSON.parse(localStorage.getItem(_kAdd) || '[]') || []; } catch (_) {}
        if (!Array.isArray(_existing)) _existing = [];
        var _has = false;
        for (var _i = 0; _i < _existing.length; _i++) {
          if (_existing[_i] && _existing[_i].ko === finalWord) {
            _existing[_i].rom = rom; _existing[_i].en = en; _has = true; break;
          }
        }
        if (!_has) _existing.push({ ko: finalWord, rom: rom, en: en, t: Date.now() });
        // Cap at 500 most-recent so the localStorage entry doesn't
        // grow unbounded over time.
        if (_existing.length > 500) _existing = _existing.slice(_existing.length - 500);
        localStorage.setItem(_kAdd, JSON.stringify(_existing));
      } catch (_) {}
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
      showToast(word + ' saved');
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
  word_saved: 5,
  conv_quiz_complete: 20,
  fill_complete: 5,
  daily_mission_complete: 50,
  story_read: 10,
  conversation_read: 10,
  first_journey_step: 5,
  writing_submit: 15,
  study_picture_description: 10,
  study_sentence_writing: 10,
  quiz_complete: 15,
  daily_review_complete: 20,
  weekly_review_complete: 30,
  monthly_review_complete: 50
};
var _COIN_ACTION_AMOUNTS = {
  article_read: 3,
  word_save: 2,
  word_saved: 2,
  conv_quiz_complete: 5,
  fill_complete: 2,
  daily_mission_complete: 20,
  story_read: 3,
  conversation_read: 3,
  first_journey_step: 2,
  writing_submit: 5,
  study_picture_description: 3,
  study_sentence_writing: 3,
  quiz_complete: 5,
  daily_review_complete: 8,
  weekly_review_complete: 12,
  monthly_review_complete: 20
};
var _XP_ACTION_LABELS = {
  article_read: 'Read Article',
  word_save: 'Save Word',
  word_saved: 'Save Word',
  conv_quiz_complete: 'Quiz Complete',
  fill_complete: 'Fill in the Blank',
  daily_mission_complete: 'Daily Mission Complete',
  story_read: 'Read Story',
  conversation_read: 'Read Conversation',
  first_journey_step: 'First Journey Step',
  writing_submit: 'Writing Practice',
  study_picture_description: 'Picture Description',
  study_sentence_writing: 'Sentence Writing',
  quiz_complete: 'Quiz Complete',
  daily_review_complete: 'Daily Review',
  weekly_review_complete: 'Weekly Review',
  monthly_review_complete: 'Monthly Review'
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
        showToast('Level Up! Lv.' + res.data.level + ' ' + res.data.level_name);
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
  el.innerHTML = '<span style="display:inline-flex;align-items:center;gap:5px"><span>+' + _coinToastTotal + '냥</span><span style="display:inline-flex;width:14px;height:14px;color:#fbbf24">'+KH_ICON_PAW+'</span></span>';
  el.style.opacity = '1';
  _coinToastTimer = setTimeout(function(){
    el.style.opacity = '0';
    setTimeout(function(){ _coinToastTotal = 0; }, 300);
  }, 1800);
}

// Pulls the current admin user's access_token from the Supabase
// auth session so we can hit the admin-api Edge Function with
// the same JWT that the admin CMS panel uses. Returns null if
// the user isn't signed in or the token can't be refreshed.
async function _khGetAdminToken() {
  try {
    var raw = localStorage.getItem('sb-samghztrdvtxmrmawneu-auth-token');
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.access_token) {
        var exp = parsed.expires_at || 0;
        if (exp > Math.floor(Date.now() / 1000) + 60) return parsed.access_token;
      }
    }
  } catch(_) {}
  try {
    var sb = getSupa();
    if (sb && sb.auth) {
      var s = await sb.auth.getSession();
      var sess = s && s.data && s.data.session;
      if (sess && sess.access_token) return sess.access_token;
      var refreshed = await sb.auth.refreshSession();
      sess = refreshed && refreshed.data && refreshed.data.session;
      return sess ? sess.access_token : null;
    }
  } catch(_) {}
  return null;
}

// Forwards a request to the admin-api Edge Function. The function
// validates that the caller is in ADMIN_EMAILS server-side, then
// uses the service-role key to talk to PostgREST — which bypasses
// row-level security cleanly. This is how the admin CMS panel
// writes; Vocab Edit Mode uses the same path so adds actually
// land in vocabulary_bank instead of getting silently dropped by
// RLS.
async function khAdminApi(body) {
  var token = await _khGetAdminToken();
  if (!token) throw new Error('Sign in to save vocabulary');
  var resp = await fetch(SUPA_URL + '/functions/v1/admin-api', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
      'apikey': SUPA_KEY
    },
    body: JSON.stringify(body)
  });
  var data = null;
  try { data = await resp.json(); } catch(_) {}
  if (!resp.ok) {
    var msg = (data && (data.error && (data.error.message || data.error)) || data && data.message) || ('HTTP ' + resp.status);
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data;
}

async function saveVocabToDB(word, rom, en, isDelete) {
  // Vocab Edit Mode is admin-gated upstream (see _isAdmin checks
  // around the FAB and modal mount), so saveVocabToDB only ever
  // fires for an admin user. We route through the admin-api Edge
  // Function rather than calling PostgREST directly because
  // vocabulary_bank still has the 2026-04-09 RLS lockdown that
  // silently dropped on-conflict upserts (zero rows written, but
  // res.error stayed empty — the exact ghost-save the user kept
  // hitting). The Edge Function uses the service-role key so RLS
  // doesn't apply, and the token the function checks server-side
  // is the same admin JWT supaUser already holds.
  if (!window._isAdmin) throw new Error('Admin only');
  if (isDelete) {
    var del = await khAdminApi({
      action: 'db',
      table: 'vocabulary_bank',
      method: 'delete',
      params: { eq: [{ col: 'word_key', val: word }] }
    });
    if (del && del.error) throw new Error(del.error.message || del.error);
    return;
  }
  var res = await khAdminApi({
    action: 'db',
    table: 'vocabulary_bank',
    method: 'upsert',
    params: {
      data: {
        word_key: word, word_ko: word,
        word_rom: rom || '', word_en: en || '',
        is_active: true
      },
      onConflict: 'word_key'
    }
  });
  if (res && res.error) throw new Error(res.error.message || res.error);
  // Verify-after-write — the recurring complaint has been "added,
  // refreshed, gone". Even routing through admin-api with
  // service_role doesn't preclude a column / constraint surprise
  // (e.g. NOT NULL user_id added later, schema cache not reloaded
  // by PostgREST so the upsert silently lands without is_active,
  // or the row landing under a different word_key than what
  // loadVocabFromDB queries for). Read the row back through the
  // public read path so we see exactly what the next page load
  // will see. If the row isn't there, throw — the modal surfaces
  // the message instead of pretending the save worked.
  try {
    var verify = await khAdminApi({
      action: 'db',
      table: 'vocabulary_bank',
      method: 'select',
      params: {
        columns: 'word_key,word_ko,word_en,is_active',
        eq: [{ col: 'word_key', val: word }],
        limit: 1,
      }
    });
    var rows = (verify && verify.data) || (Array.isArray(verify) ? verify : null);
    var row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || !row.word_key) {
      throw new Error('Saved but verify read returned no row — check vocabulary_bank constraints (likely missing NOT NULL column).');
    }
    if (row.is_active === false) {
      throw new Error('Saved but is_active landed false — check default/trigger on vocabulary_bank.');
    }
  } catch (verifyErr) {
    // Re-throw so the modal surfaces the real cause. We deliberately
    // don't swallow — silent success is what got us here.
    throw verifyErr;
  }
}

function wrapVocab(el) {
  // Require at least 2 Korean chars — 1-char entries (particles, single-syllable
  // verbs/nouns) match inside every compound word and fragment the underline
  // character-by-character.
  var keys  = Object.keys(VOCAB).filter(function(k){ return k && k.length >= 2; })
                                .sort(function(a, b){ return b.length - a.length; });
  if (!keys.length) return;
  // Build two parallel lists:
  //   directKeys  — exact-match vocab (regular words, plus stems)
  //   stemMap     — { stem -> dictionary form }, so when we match the stem +
  //                 conjugation in the body we can resolve back to the
  //                 dictionary entry the vocab list uses (재미있는 → 재미있다).
  var directKeys = keys.slice();
  var stemMap = {};
  keys.forEach(function(k) {
    if (k.length >= 3 && /[다요]$/.test(k)) {
      var stem = k.slice(0, -1);
      if (stem.length >= 2 && !stemMap[stem]) stemMap[stem] = k;
    }
  });
  var stems = Object.keys(stemMap).sort(function(a,b){ return b.length - a.length; });

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

  // Direct match: exact word with Korean word-boundary on the LEFT
  // side only. Dropping the right-side boundary matches the same
  // lenient rule as inArticleBody (V4.9) — without it "중요" in
  // VOCAB never highlighted inside body "중요한" because 한 is
  // Korean. Length>=2 filter above prevents single-char false
  // positives; stems (from ~다/요 entries) keep their own longer
  // regex below and still outrank direct matches via the overlap
  // resolver.
  var directRe = new RegExp('(?:^|[^\\uAC00-\\uD7A3])(' + directKeys.map(esc).join('|') + ')', 'g');
  // Stem match: stem followed by 1-4 Korean chars (conjugation).
  var stemRe = stems.length
    ? new RegExp('(?:^|[^\\uAC00-\\uD7A3])((?:' + stems.map(esc).join('|') + ')[\\uAC00-\\uD7A3]{1,4})(?![\\uAC00-\\uD7A3])', 'g')
    : null;

  var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: function(n) {
      if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      var p = n.parentNode;
      // Skip text nodes already inside a hover-tooltip wrap (.kh-hover-word)
      // OR a previous .kh-word wrap. When a word appears in BOTH the
      // sentence-analysis VOCAB and the global hover_vocab_master, the
      // hover system gets there first; nesting a .kh-word inside a
      // .kh-hover-word produced overlapping dotted underlines and the
      // user's eye couldn't tell anything was tappable. Keeping the
      // hover wrap intact means overlapping words still show the
      // dotted line (from .kh-hover-word) and the click goes to the
      // hover dictionary — which is what the user asked for.
      while (p) {
        if (p.classList) {
          if (p.classList.contains('kh-word')) return NodeFilter.FILTER_REJECT;
          if (p.classList.contains('kh-hover-word')) return NodeFilter.FILTER_REJECT;
        }
        p = p.parentNode;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  var nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  // Track dictionary forms that have already been wrapped inside this
  // zone so repeat occurrences of the same word render as plain text.
  // The old behavior painted every instance with the dotted underline,
  // which turned a body paragraph that used the same noun 4–5 times
  // into a picket fence and drowned the rest of the sentence. First-
  // mention-only keeps the "tap for definition" affordance without the
  // visual clutter. Scoped per vocab-zone (title / body are separate
  // zones) so a word that appears in both still gets one underline in
  // each, not zero in the body because the title used it.
  var seenDict = new Set();

  // Collect all match spans across both regexes, then resolve overlaps —
  // longer / direct matches win.
  nodes.forEach(function(node) {
    var text = node.nodeValue;
    var spans = [];
    function pushMatches(re, isStem) {
      if (!re) return;
      re.lastIndex = 0;
      var m;
      while ((m = re.exec(text)) !== null) {
        var matched = m[1];
        var wordStart = m.index + (m[0].length - matched.length);
        var wordEnd = wordStart + matched.length;
        var dictForm = matched;
        if (isStem) {
          // Find which stem prefix matched and resolve back to dictionary form.
          for (var i = 0; i < stems.length; i++) {
            if (matched.indexOf(stems[i]) === 0) { dictForm = stemMap[stems[i]]; break; }
          }
        }
        spans.push({ start: wordStart, end: wordEnd, text: matched, dict: dictForm });
        if (re.lastIndex <= wordEnd) re.lastIndex = wordEnd; // skip past trailing boundary
      }
    }
    pushMatches(directRe, false);
    pushMatches(stemRe, true);
    if (!spans.length) return;
    // Sort by start asc, then by length desc — longer claims overlapping range.
    spans.sort(function(a,b){ return a.start - b.start || (b.end - b.start) - (a.end - a.start); });
    var picked = [];
    var cursor = 0;
    spans.forEach(function(s) {
      if (s.start < cursor) return; // overlaps previously-picked span
      picked.push(s); cursor = s.end;
    });
    if (!picked.length) return;
    var frag = document.createDocumentFragment();
    var last = 0;
    picked.forEach(function(s) {
      if (s.start > last) frag.appendChild(document.createTextNode(text.slice(last, s.start)));
      if (seenDict.has(s.dict)) {
        // Subsequent occurrence — render as plain text so only the
        // first mention in this zone carries the underline.
        frag.appendChild(document.createTextNode(text.slice(s.start, s.end)));
      } else {
        seenDict.add(s.dict);
        var span = document.createElement('span');
        span.className = 'kh-word';
        span.dataset.word = s.dict; // dictionary form so tooltip lookup works
        span.textContent = s.text;
        frag.appendChild(span);
      }
      last = s.end;
    });
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
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
    + '<span class="kh-logo-text">KoreHan<span class="kh-logo-i">ı</span></span>'
    + '</a>'
    + '<div class="kh-hright">'
    + '<span class="kh-hdate" id="date-str"></span>'
    + '<div class="kh-hsearch">' + khIcon('search', '', 'kh-ui-icon-muted kh-ui-icon-sm') + '<input type="text" placeholder="Search articles\u2026" onkeydown="if(event.key===\'Enter\')doSearch(this.value)" style="border:none;background:none;outline:none;font-size:13px;color:inherit;font-family:inherit;width:100%;"></div>'
    + '<button id="topbar-neon-toggle" class="kh-neon-toggle" type="button" aria-pressed="false" onclick="toggleKhNeon(event)">' + khIcon('zap', 'Neon OFF', 'kh-ui-icon-sm') + '</button>'
    + (isHome ? '<div class="kh-diff-ctrl" id="kh-diff-ctrl"><span class="kh-diff-dot" id="kh-diff-dot"></span><select class="kh-diff-sel" id="kh-diff-select" onchange="khSetDiff(this.value)"><option value="all">All Levels</option><option value="Starter">Seed</option><option value="Beginner">Sprout</option><option value="Intermediate">Tree</option><option value="Advanced">Forest</option></select><span class="kh-diff-arr">&#9662;</span></div>' : '')
    + '<div id="topbar-notif-wrap" class="kh-notif-wrap" style="display:none">'
    + '<button id="topbar-notif-btn" class="kh-notif-btn" type="button" aria-label="Notifications" onclick="khToggleNotifDropdown(event)">'
    +   '<i data-lucide="bell" class="kh-ui-icon kh-ui-icon-sm" aria-hidden="true"></i>'
    +   '<span id="topbar-notif-count" class="kh-notif-count" hidden>0</span>'
    + '</button>'
    + '<div id="topbar-notif-dropdown" class="kh-notif-dropdown"></div>'
    + '</div>'
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
      return '<span class="brk-item"><span class="brk-sep">&middot;</span><a href="korehan-article.html?id=' + a.id + '" style="color:#fff;text-decoration:none;">' + (a.title_en || a.title || '') + '</a></span>';
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
    + '<div style="font-family:\'DM Sans\',\'Noto Sans KR\',sans-serif;font-size:24px;font-weight:800;color:#fff;margin-bottom:10px;letter-spacing:-0.5px">'
    + '<span class="kh-logo-text" style="color:#fff;font-size:24px">KoreHan<span class="kh-logo-i">ı</span></span>'
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
    + '<a href="landing.html" style="font-size:13px;color:rgba(255,255,255,.68);text-decoration:none;font-weight:600">About KoreHani</a>'
    + '<a href="mailto:hello@korehani.com" style="font-size:13px;color:rgba(255,255,255,.68);text-decoration:none;font-weight:600">Contact</a>'
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

    + '<div>'
    + '<div style="font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.38);margin-bottom:14px">Newsletter</div>'
    + '<p style="font-size:13px;line-height:1.6;color:rgba(255,255,255,.5);margin:0 0 12px;max-width:26ch">Get weekly Korean learning tips and new content updates.</p>'
    + '<form id="kh-nl-form" onsubmit="return khSubscribeNewsletter(event)" style="display:flex;gap:6px;flex-wrap:wrap">'
    + '<input id="kh-nl-email" type="email" required placeholder="your@email.com" style="flex:1;min-width:160px;padding:9px 12px;border:1px solid rgba(255,255,255,.15);border-radius:8px;background:rgba(255,255,255,.07);color:#fff;font-size:13px;font-family:inherit;outline:none">'
    + '<button type="submit" style="padding:9px 16px;border:none;border-radius:8px;background:#7dd3fc;color:#0c1a3a;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap">Subscribe</button>'
    + '</form>'
    + '<div id="kh-nl-msg" style="font-size:12px;margin-top:8px;color:rgba(255,255,255,.5);display:none"></div>'
    + '</div>'

    + '</div>'
    + '<div style="border-top:1px solid rgba(255,255,255,.07);padding:16px 22px;text-align:center;font-size:12px;color:rgba(255,255,255,.28);">'
    + '© 2026 KoreHani · All rights reserved'
    + '</div>'
    + '</footer>';
}

async function khSubscribeNewsletter(e) {
  e.preventDefault();
  var emailEl = document.getElementById('kh-nl-email');
  var msgEl = document.getElementById('kh-nl-msg');
  var email = (emailEl.value || '').trim().toLowerCase();
  if (!email) return false;

  msgEl.style.display = 'block';
  msgEl.style.color = 'rgba(255,255,255,.5)';
  msgEl.textContent = 'Sending confirmation…';

  // Newsletter v2 flow: edge function calls newsletter_request_subscribe
  // (which mints a confirm token + leaves the row pending) and then
  // emails the confirmation link via Resend. Successful delivery is
  // independent of whether Resend is configured — the RPC always
  // succeeds, and the user gets a graceful message either way.
  try {
    var sb = getSupa();
    var session = (await sb.auth.getSession()).data.session;
    var anonKey = (window.SUPA_KEY || (typeof SUPA_KEY !== 'undefined' ? SUPA_KEY : ''));
    var supaUrl = (window.SUPA_URL || (typeof SUPA_URL !== 'undefined' ? SUPA_URL : ''));
    var headers = {
      'Content-Type': 'application/json',
      'apikey': anonKey,
      'Authorization': 'Bearer ' + (session ? session.access_token : anonKey),
    };
    var resp = await fetch(supaUrl + '/functions/v1/newsletter-send', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ action: 'subscribe', email: email, source: 'footer' }),
    });
    var data = {};
    try { data = await resp.json(); } catch (_) {}
    if (!resp.ok || !data.ok) {
      if (data && data.error === 'invalid_email') {
        msgEl.style.color = '#fbbf24';
        msgEl.textContent = 'Please enter a valid email address.';
      } else {
        msgEl.style.color = '#f87171';
        msgEl.textContent = 'Something went wrong. Please try again.';
      }
      return false;
    }
    if (data.status === 'already_confirmed') {
      msgEl.style.color = '#fbbf24';
      msgEl.textContent = 'You\'re already subscribed!';
    } else if (data.mailed === false) {
      // Subscription request stored, but the email layer isn't live
      // yet (no Resend key configured). Don't promise mail delivery.
      msgEl.style.color = '#34d399';
      msgEl.textContent = 'Got it — we\'ll send a confirmation link as soon as our mailer is live.';
      emailEl.value = '';
    } else {
      msgEl.style.color = '#34d399';
      msgEl.textContent = 'Almost done! Check your inbox to confirm.';
      emailEl.value = '';
    }
  } catch (err) {
    msgEl.style.color = '#f87171';
    msgEl.textContent = 'Something went wrong. Please try again.';
  }
  return false;
}

function renderSharedSidebar() {
  var trendingHTML = getFallbackMostReadItems().map(function(item, i){
    return '<a href="' + item.href + '" style="color:inherit;text-decoration:none;">'
      + '<div class="trending-item">'
      + '<div class="trending-num">' + (i+1) + '</div>'
      + '<p class="vocab-zone">' + item.title + '</p>'
      + '</div></a>';
  }).join('');

  // Word Bank — 랜덤 6개. Apply the same ~하다 → noun filter as the
  // article Vocab tab so the same sitewide entry shows up identically
  // in both places (and gets saved under the same word_key if the user
  // clicks to save).
  var seed = Math.floor(Date.now() / 60000);
  var shuffled = Object.keys(VOCAB).slice().sort(function(a,b){
    return Math.sin(seed * a.charCodeAt(0)) - Math.sin(seed * b.charCodeAt(0));
  });
  var wbWords = [];
  var wbSeen = {};
  for (var _wi = 0; _wi < shuffled.length && wbWords.length < 6; _wi++) {
    var _wk = shuffled[_wi];
    var _wv = VOCAB[_wk] || {};
    var _wn = khNormalizeVocabNoun(_wk, _wv.rom || '', _wv.en || '');
    if (!_wn || wbSeen[_wn.ko]) continue;
    wbSeen[_wn.ko] = true;
    wbWords.push(_wn);
  }

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
  { key:'사회',   label:'Society',        icon:'<i data-lucide="users" class="kh-ui-icon kh-ui-icon-mobile" aria-hidden="true"></i>',     sort_order:3  },
  { key:'국제',   label:'World',          icon:'<i data-lucide="globe" class="kh-ui-icon kh-ui-icon-mobile" aria-hidden="true"></i>',     sort_order:4  },
  { key:'문화',   label:'Culture',        icon:'<i data-lucide="palette" class="kh-ui-icon kh-ui-icon-mobile" aria-hidden="true"></i>',   sort_order:5  },
  { key:'연예',   label:'Entertainment',  icon:'<i data-lucide="film" class="kh-ui-icon kh-ui-icon-mobile" aria-hidden="true"></i>',      sort_order:6  },
  { key:'K-pop',  label:'K-pop',          icon:'<i data-lucide="music" class="kh-ui-icon kh-ui-icon-mobile" aria-hidden="true"></i>',     sort_order:7  },
  { key:'IT과학', label:'Tech & Science', icon:'<i data-lucide="cpu" class="kh-ui-icon kh-ui-icon-mobile" aria-hidden="true"></i>',       sort_order:8  },
  { key:'nature', label:'Nature',         icon:'<i data-lucide="leaf" class="kh-ui-icon kh-ui-icon-mobile" aria-hidden="true"></i>',      sort_order:9  },
  { key:'역사',   label:'History',        icon:'<i data-lucide="scroll" class="kh-ui-icon kh-ui-icon-mobile" aria-hidden="true"></i>',    sort_order:10 },
  { key:'Korea',  label:'Korea',          icon:'<i data-lucide="flag" class="kh-ui-icon kh-ui-icon-mobile" aria-hidden="true"></i>',      sort_order:11 },
  { key:'beauty', label:'Beauty',         icon:'<i data-lucide="sparkles" class="kh-ui-icon kh-ui-icon-mobile" aria-hidden="true"></i>',  sort_order:12 },
  { key:'travel', label:'Travel',         icon:'<i data-lucide="plane" class="kh-ui-icon kh-ui-icon-mobile" aria-hidden="true"></i>',     sort_order:13 },
  { key:'오피니언',label:'Opinion',       icon:'<i data-lucide="pen-tool" class="kh-ui-icon kh-ui-icon-mobile" aria-hidden="true"></i>',  sort_order:14 },
];

// Canonical Lucide icon per section key. Overrides whatever the DB
// has stored (older rows kept emoji here, which leaked into the rails
// header even after DEFAULT_SECTIONS got migrated to Lucide). Update
// the map to add new sections; unknown keys fall through to the row's
// stored icon (emoji or otherwise) so we don't blank out unfamiliar
// keys.
var SECTION_ICON_LUCIDE = {
  '사회':   'users',
  '국제':   'globe',
  '문화':   'palette',
  '연예':   'film',
  'k-pop':  'music',
  'it과학': 'cpu',
  'beauty': 'sparkles',
  'travel': 'plane',
  'korea':  'flag',
  '오피니언': 'pen-tool',
  '역사':   'scroll',
  'nature': 'leaf',
};
function _khSectionLucideHtml(name) {
  return '<i data-lucide="' + name + '" class="kh-ui-icon kh-ui-icon-mobile" aria-hidden="true"></i>';
}

function normalizeSectionCatalog(list) {
  var items = Array.isArray(list) ? list.slice() : [];
  // Politics / Economy were dropped from the site — ensure they don't
  // sneak back in via the Supabase `sections` table cache. IT과학 was
  // previously blocked here (and aliased into Beauty), but the user
  // pointed out that hides a whole category of articles — restore it.
  var blocked = new Set([
    'politics', '정치', 'economy', '경제'
  ]);
  items = items.filter(function(row) {
    var k = String((row && row.key) || '').trim().toLowerCase();
    return k && !blocked.has(k);
  });

  // Force Lucide icons on every row that has a known key, regardless
  // of what the DB has stored. Older sections rows kept an emoji
  // string here (🏙️, 🌍, 🎤, …) which leaked into the rails header
  // even after the DEFAULT_SECTIONS array migrated to Lucide HTML.
  // Cleaner than running a one-shot DB migration.
  items = items.map(function(row) {
    if (!row) return row;
    var k = String(row.key || '').trim().toLowerCase();
    var lookup = SECTION_ICON_LUCIDE[k] || (k === 'k-pop' ? 'music' : null);
    if (lookup) row = Object.assign({}, row, { icon: _khSectionLucideHtml(lookup) });
    // Strip the leading flag emoji from "🇰🇷 Korea" labels too.
    if (k === 'korea' && row.label) {
      row.label = String(row.label).replace(/^[\u{1F1E6}-\u{1F1FF}]{2}\s*/u, '');
    }
    return row;
  });

  function hasKey(key) {
    return items.some(function(row) { return String((row && row.key) || '') === key; });
  }
  // Backfill rows that may not exist in the Supabase `sections` table
  // yet — All News rails / sidebar filters silently dropped these
  // categories whenever the DB had a partial row set.
  if (!hasKey('beauty')) items.push({ key:'beauty', label:'Beauty',          icon: _khSectionLucideHtml('sparkles'), sort_order:12, active:true });
  if (!hasKey('travel')) items.push({ key:'travel', label:'Travel',          icon: _khSectionLucideHtml('plane'),    sort_order:13, active:true });
  if (!hasKey('연예'))    items.push({ key:'연예',   label:'Entertainment',   icon: _khSectionLucideHtml('film'),     sort_order:6,  active:true });
  if (!hasKey('IT과학'))  items.push({ key:'IT과학', label:'Tech & Science',  icon: _khSectionLucideHtml('cpu'),      sort_order:8,  active:true });
  if (!hasKey('nature'))  items.push({ key:'nature', label:'Nature',          icon: _khSectionLucideHtml('leaf'),     sort_order:9,  active:true });
  if (!hasKey('역사'))    items.push({ key:'역사',   label:'History',         icon: _khSectionLucideHtml('scroll'),   sort_order:10, active:true });

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
  siteName: 'KoreHani',
  siteTagline: 'Learn Korean, Naturally',
  footerDesc: 'KoreHani delivers real Korean news — paired with vocabulary tooltips so you learn Korean naturally through stories that matter.',
  learnBannerTitle: 'Simplified Korean news for learners',
  learnBannerDesc: 'KoreHani is written in easy Korean for foreign learners. Hover any underlined word to instantly see its meaning and pronunciation.'
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

async function loadAppSettings(opts) {
  // opts.force=true bypasses the memoized promise and re-queries DB.
  // Without this, a session that was opened while RLS denied reads (or
  // before the user was authenticated) caches an empty result and
  // loadAppSettings() returns it forever — which is what made the
  // home page's Today's Phrase keep painting whatever was in stale
  // localStorage even after admin updates landed in the DB.
  if (opts && opts.force) _appSettingsPromise = null;
  if (_appSettingsPromise) return _appSettingsPromise;
  _appSettingsPromise = (async function() {
    var sb = getSupa();
    if (!sb) { _appSettingsPromise = null; return; }
    try {
      // API 키는 로그인한 유저만 읽을 수 있음 (RLS로 보호)
      var res = await sb.from('app_settings').select('key,value');
      if (res && res.data) {
        res.data.forEach(function(row) {
          _appSettings[row.key] = row.value;
        });
        // API 키는 localStorage에 저장하지 않음 (보안)
      } else if (res && res.error) {
        // RLS denial / network blip — drop the memo so the next
        // caller can retry instead of being stuck on an empty result.
        _appSettingsPromise = null;
      }
    } catch(e) {
      _appSettingsPromise = null;
    }
  })();
  return _appSettingsPromise;
}

function getApiKey() {
  // 메모리에서만 — localStorage 캐시 없음
  return _appSettings.anthropic_key || null;
}

// ── CURRICULUM TAGGING ────────────────────────────────────────
// Given a piece of content (article/conversation/story/etc.), ask
// Claude which curriculum stations it belongs to, then upsert the
// mappings into content_station_map. Used both at admin-save time
// (new content) and via batch backfill scripts (existing content).
//
// Returns the array of tags written, or [] on failure. Idempotent:
// re-running on the same content updates existing rows (via upsert
// onConflict).
async function khTagContent(opts) {
  opts = opts || {};
  var type  = opts.content_type || opts.type;
  var id    = opts.content_id   || opts.id;
  var text  = opts.text || '';
  var hint  = opts.hint || '';
  var level = opts.level || '';
  if (!type || !id) return [];
  var sb = getSupa();
  if (!sb) return [];

  try {
    // Pull the line + station catalogue once. Cached in-memory across
    // calls so a batch tag run doesn't re-query for every item.
    if (!khTagContent._catalog) {
      var [linesRes, stationsRes] = await Promise.all([
        sb.from('curriculum_lines').select('id,code,name_ko,name_en,description').eq('active', true).order('sort_order'),
        sb.from('curriculum_stations').select('id,line_id,station_no,name_ko,name_en,level').order('line_id').order('station_no')
      ]);
      khTagContent._catalog = {
        lines: linesRes.data || [],
        stations: stationsRes.data || []
      };
    }
    var cat = khTagContent._catalog;
    if (!cat.lines.length || !cat.stations.length) return [];

    // Compact catalogue for the prompt — lines with their station ids.
    var catalogStr = cat.lines.map(function(L) {
      var sts = cat.stations.filter(function(s){ return s.line_id === L.id; });
      var sample = sts.map(function(s){ return s.id + ':' + s.name_en + '(' + s.level + ')'; }).join(', ');
      return L.id + '호선 ' + L.name_ko + ' [' + L.name_en + ']: ' + sample;
    }).join('\n');

    var prompt = 'You are tagging a Korean-learning content item to a 6-line curriculum network. '
      + 'Each line covers one skill (어휘/문법/읽기/듣기/쓰기/문화). Each line has 50 stations from Starter to Fluency. '
      + 'Pick 1–4 stations across 1–3 different lines that this content best teaches. Weight 0..1 = how core this content is to that station.\n\n'
      + 'Content type: ' + type + (level ? '\nLevel: ' + level : '') + (hint ? '\nHint: ' + hint : '') + '\n'
      + 'Content text (truncated):\n' + (text || '').slice(0, 1400) + '\n\n'
      + 'Stations catalogue (id:name(level)):\n' + catalogStr + '\n\n'
      + 'Respond ONLY in this exact JSON format:\n'
      + '{"tags":[{"station_id":N,"weight":0.0..1.0,"reason":"short why"}]}';

    var res = await callClaude({
      feature: 'curriculum-tag',
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    });
    var raw = (res.content && res.content[0] && res.content[0].text) || res.text || '';
    var i = raw.indexOf('{'), j = raw.lastIndexOf('}');
    if (i < 0 || j <= i) throw new Error('AI returned no JSON');
    var parsed = JSON.parse(raw.slice(i, j + 1));
    var tags = (parsed.tags || []).filter(function(t) {
      return t && Number.isFinite(t.station_id) && Number(t.weight) > 0;
    });
    if (!tags.length) return [];

    var rows = tags.map(function(t) {
      return {
        content_type: type,
        content_id: String(id),
        station_id: t.station_id,
        weight: Math.max(0, Math.min(1, Number(t.weight) || 0)),
        source: 'ai',
        confidence: Number(t.weight) || null
      };
    });
    var up = await sb.from('content_station_map')
      .upsert(rows, { onConflict: 'content_type,content_id,station_id' });
    if (up.error) { console.warn('khTagContent upsert', up.error); return []; }
    return tags;
  } catch(e) {
    console.warn('[khTagContent]', e && (e.message || e));
    return [];
  }
}

// Convenience: tag an article object using its current fields.
async function khTagArticleObject(article) {
  if (!article || !article.id) return [];
  return khTagContent({
    content_type: 'article',
    content_id: article.id,
    text: (article.title || '') + '\n\n' + (article.body || '') + '\n\n' + (article.full || ''),
    level: article.level || '',
    hint: 'section=' + (article.section || '')
  });
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
  // Run updateAuthUI() immediately after the header is in DOM so
  // the IIFE-injected #kh-auth-flash-guard <style> gets removed on
  // every page load — even if checkSession() later hangs on a
  // wedged exchangeCodeForSession / setSession / getSession await.
  // Previously updateAuthUI only ran from inside checkSession (and
  // from the auth state listener, which is itself driven by the
  // SDK boot). If any of those chains stalled, the flash guard's
  // `display:none !important` rule kept #topbar-signin-btn /
  // #topbar-join-btn hidden forever — the user's "우측 상단 공백"
  // report. supaUser starts as null, so this first call paints the
  // signed-out state; subsequent calls (from checkSession success
  // or the auth listener) flip to signed-in if a session exists.
  try { updateAuthUI(); } catch(_) {}
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
  var _fastPages = ['korehan-conversations','korehan-stories','korehan-mypage','korehan-shop','korehan-reporter','korehan-reporters'];
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
    // Repeat-visit fast path: if we have cached articles render + dismiss
    // loader immediately, then refresh in the background. This was the
    // root cause of the "loader stalls at ~86%" complaint — the await
    // on a fresh fetch held the loader for the full Korea↔Supabase
    // round-trip on every visit even when the page was already drawable.
    var hadCache = getCachedArticles().length > 0;

    // Hold the loader until Today's Phrase actually paints. The user
    // pointed out it was awkward to see "loading" still happening
    // inside the page after the splash hid; the phrase banner is the
    // tallest above-the-fold block that depends on a network fetch.
    // We poll the #pb-ko text node and bail after a 4s ceiling so a
    // slow phrase API doesn't strand the loader on screen.
    function _khAwaitTodaysPhrase(maxMs) {
      maxMs = maxMs || 4000;
      return new Promise(function(resolve) {
        var start = Date.now();
        function tick() {
          var el = document.getElementById('pb-ko');
          var ready = el && (el.textContent || '').trim().length > 0;
          if (ready || Date.now() - start > maxMs) return resolve();
          setTimeout(tick, 100);
        }
        tick();
      });
    }
    // Hold the splash until the hero has actually painted, with a
    // 5s ceiling. User reported splash dismissing onto a still-blank
    // hero ("로딩창이 실제 로딩완료 전에 사라짐"). _heroSlides is set
    // synchronously when renderHomePage runs against cached articles,
    // so the cache-hit path resolves in 0ms — no slowdown there. The
    // no-cache path waits for the fetch + re-render. 5s is short
    // enough that genuinely wedged loads still surface the skeleton +
    // safety-net empty state on the visible page rather than holding
    // splash.
    function _khAwaitHero(maxMs) {
      maxMs = maxMs || 5000;
      return new Promise(function(resolve) {
        var start = Date.now();
        function tick() {
          if (_heroSlides && _heroSlides.length) return resolve();
          // Empty-state painted = hero is "done" (failed but final).
          var heroEl = document.getElementById('dyn-hero');
          if (heroEl && heroEl.innerHTML.indexOf('데이터 리셋') !== -1) return resolve();
          if (Date.now() - start > maxMs) return resolve();
          setTimeout(tick, 100);
        }
        tick();
      });
    }

    if (hadCache) {
      renderHomePage();
      _ldr(92);
      Promise.all([_khAwaitTodaysPhrase(4000), _khAwaitHero(5000)]).then(function () {
        if (window._khLoaderClearAuto) window._khLoaderClearAuto();
        _ldr(100);
      });
      // Always fire a small homeOptimized refresh so newly published
      // articles surface within seconds instead of waiting up to an
      // hour for the localStorage cache TTL. Earlier we relied on the
      // idle "prefetch all" pass below, but when that 400'd (e.g.
      // PostgREST max-rows on limit=1000) home stayed stale until
      // cache expiry — admin would publish an article and not see it
      // on the front page for minutes.
      loadArticlesFromDB({ homeOptimized: true, force: true })
        .then(function (rows) { if (rows && rows.length) { try { renderHomePage(); } catch(_){} } })
        .catch(function(){});
    } else {
      _ldr(50); // Loading articles...
      // No-cache first-visit path: render the skeleton immediately
      // and fire the articles fetch in the background instead of
      // blocking on it. The user reported a ~15s blank-hero stretch
      // on Samsung Internet because the previous version awaited
      // the round-trip (8s ceiling + 4s phrase wait + prefetch_all
      // before any articles surfaced). Now the page paints right
      // away and the rail upgrades from skeleton → real cards the
      // moment the DB call returns.
      renderHomePage();
      _ldr(80);
      // Drive the empty state off REAL signals only, not a hard timer.
      // Earlier we used a 5s race that fired prematurely whenever the
      // fetch was just slow (slow LTE, long-cached connection re-handshake)
      // and showed the alarming red Reset button to users whose page
      // would have loaded fine in 6-7s. Now: render on success, render
      // empty state on error, and let the 7s safety net below catch
      // the silent-wedge case where the fetch never resolves at all.
      var _heroFinished = false;
      loadArticlesFromDB({ homeOptimized: true, force: true })
        .then(function (rows) {
          if (rows && rows.length) {
            _heroFinished = true;
            try { renderHomePage(); } catch(_){}
          }
          // Empty rows = fetch returned but DB empty / RLS blocked /
          // unrecoverable error. Show the empty state so the user
          // gets the recovery affordance.
          else {
            try { _khRenderHeroEmptyState(); } catch(_) {}
          }
        })
        .catch(function (e) {
          console.warn('home articles fetch failed:', e && e.message || e);
          try { _khRenderHeroEmptyState(); } catch(_) {}
        });
      _ldr(92);
      Promise.all([_khAwaitTodaysPhrase(4000), _khAwaitHero(5000)]).then(function () {
        if (window._khLoaderClearAuto) window._khLoaderClearAuto();
        _ldr(100);
      });
    }

    // Prefetch the full 1000-row dataset in idle time so when the user
    // taps "All News" the page renders instantly. Home only needs the
    // 30-row homeOptimized payload, but All News needs the full list
    // (without body — body is fetched per-article in the reader).
    // Skip if the user is on a slow connection (Save-Data) or if a
    // recent fetch already populated 80+ rows.
    var _khPrefetchAll = function () {
      try {
        var conn = navigator.connection || navigator.webkitConnection || {};
        if (conn.saveData) return;
        var cached = getCachedArticles();
        if (cached && cached.length >= 80) return;
        loadArticlesFromDB({ all: true, force: true })
          .then(function(){
            // Re-render home with newer rows. This replaces the old
            // homeOptimized background refresh for cache-hit visits.
            try { if (typeof renderHomePage === 'function') renderHomePage(); } catch(_){}
          })
          .catch(function(err){ console.warn('[prefetch] all news failed', err); });
      } catch (_) {}
    };
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(_khPrefetchAll, { timeout: 4000 });
    } else {
      setTimeout(_khPrefetchAll, 1500);
    }

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
    // Article reader fast-path: fetch ONLY the requested article first
    // (a single row with full body) so the reader can paint immediately
    // on LTE. The 80-row context list — used for related-article cards
    // and prev/next swipe — loads in the background and re-renders the
    // page once it arrives.
    var _isArticleReader = (pageBase === 'korehan-article');
    var _articleId = _isArticleReader ? (new URLSearchParams(window.location.search)).get('id') : null;
    var _haveCachedRequested = _articleId
      && getCachedArticles().some(function(x){ return String(x.id) === String(_articleId) && x.full; });

    if (_isArticleReader && _articleId && !_haveCachedRequested) {
      // Race: single-article fetch (fast) + list fetch (background).
      // force:true so the swipe pool always has the full 80-row list,
      // not whatever 30-row homeOptimized cache the home page seeded
      // (was the root cause of the "same articles repeat after a few
      // swipes" complaint).
      // Crucially, only the single-article fetch blocks the splash.
      // Sections + settings hydrate the header/footer chrome and don't
      // gate the article body — they used to be inside the Promise.all
      // here, which on Korean LTE pushed the splash from ~800ms to
      // 2-4s. Now they resolve in the background and the chrome reflows
      // when they land, while the learner is already reading.
      var singlePromise = loadArticleById(_articleId);
      var listPromise = loadArticlesFromDB({ force: true });
      await singlePromise;
      if (window._khLoaderClearAuto) window._khLoaderClearAuto();
      _ldr(100);
      // Background: list refresh re-renders related-articles + swipe.
      listPromise.then(function() {
        if (typeof renderArticlePage === 'function') {
          try { renderArticlePage(); } catch(e) {}
        }
      });
      // Background: sections + settings refresh page chrome.
      Promise.allSettled([sectionsPromise, settingsPromise]);
    } else {
      // korehan-all needs the full 500-row dataset with body for its
      // search filter. If the home page's idle prefetch (or a prior
      // visit) already populated the cache, render synchronously and
      // refresh in the background — eliminates the ~3s LTE wait the
      // user hit when tapping All News from a cold cache.
      var _isAllPage = (pageBase === 'korehan-all');
      var _isArticleReaderFallback = _isArticleReader; // alias for clarity
      var _cachedRows = getCachedArticles();
      var _haveAllCache = _isAllPage && _cachedRows && _cachedRows.length >= 80;
      if (_haveAllCache) {
        if (window._khLoaderClearAuto) window._khLoaderClearAuto();
        _ldr(100);
        // Background refresh — All News will re-render itself once
        // the fresh 500-row fetch lands. Sections/settings still
        // resolve in parallel for headers etc.
        loadArticlesFromDB({ force: true, all: true })
          .then(function(){ if (typeof renderAllPage === 'function') { try { renderAllPage(); } catch(_){} } })
          .catch(function(err){ console.warn('[all] background refresh failed', err); });
        await Promise.all([sectionsPromise, settingsPromise]);
      } else {
        // Cold All News visit — render an immediate skeleton so the
        // user sees activity instead of a blank page during the fetch.
        // Replaced as soon as renderAllPage runs.
        if (_isAllPage) {
          var _skel = document.getElementById('dyn-article-list');
          if (_skel && !_skel.children.length) {
            _skel.innerHTML = '<style>@keyframes khSkel{0%,100%{opacity:.55}50%{opacity:.92}}</style>'
              + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px">'
              +   Array(6).fill(0).map(function(){
                    return '<div style="background:#e5edf6;border-radius:14px;aspect-ratio:4/3;animation:khSkel 1.4s ease-in-out infinite"></div>';
                  }).join('')
              + '</div>';
          }
        }
        var _forceRefresh = _isArticleReaderFallback || _isAllPage;
        // Only the articles fetch blocks the loader. sections + settings
        // resolve in the background; the header/sidebar already paint
        // from defaults and reflow once they land. This shaved ~600ms
        // off cold All News when sections happened to be slow.
        await loadArticlesFromDB({ force: _forceRefresh, all: _isAllPage });
        if (window._khLoaderClearAuto) window._khLoaderClearAuto();
        _ldr(100);
        Promise.allSettled([sectionsPromise, settingsPromise]);
      }
    }

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
  // Streak freeze rewards + auto-apply. Both run in idle time:
  //   1. Award: 3-day attendance milestone → +1 freeze (capped at 3
  //      inventory). Server tracks last paid-out streak so this is
  //      safe to call on every load.
  //   2. Auto-apply: if yesterday was missed and the user has a
  //      freeze, silently spend it to save the streak.
  _deferPost(function(){
    try {
      var s = (typeof getCurrentStreak === 'function') ? getCurrentStreak() : 0;
      if (s >= 3 && typeof khClaimStreakAward === 'function') khClaimStreakAward(s);
    } catch(_) {}
  });
  _deferPost(function(){ if (typeof khMaybeAutoFreezeYesterday === 'function') khMaybeAutoFreezeYesterday(); });
  _deferPost(function(){ startClock(); });
  // conversations/stories 등 tooltip 불필요 페이지에서는 2000행 vocabulary_bank 쿼리 스킵
  var _skipVocabPages = ['index','','korehan-news','korehan-conversations','korehan-stories','korehan-mypage','korehan-learn','korehan-courses','korehan-onboarding','korehan-learning-overview'];
  if (_skipVocabPages.indexOf(pageBase) < 0) {
    _deferPost(function(){ loadVocabFromDB().then(function(){ initTooltips(); if (typeof renderArticleVocab === 'function' && window._currentArticle) renderArticleVocab(window._currentArticle); }); });
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

// Hydrate VOCAB from a localStorage snapshot of the last successful
// vocabulary_bank load. This unblocks the "기사들 간헐적으로 hover
// 안뜨는" complaint — when a network blip / RLS retry / service
// hiccup makes loadVocabFromDB() come up empty, the article body's
// .vocab-zone wrapVocab() ran against a fresh-empty VOCAB and no
// words got the .kh-word class, which is why hover sometimes just
// silently didn't work. Now we paint the warm copy first; the
// network refresh fills in any new words on top.
var KH_VOCAB_LS_KEY = 'kh_vocab_dict_v1';
var KH_VOCAB_LS_MAX_AGE_MS = 24 * 3600 * 1000;
(function _hydrateVocabFromLocal() {
  try {
    var raw = localStorage.getItem(KH_VOCAB_LS_KEY);
    if (!raw) return;
    var parsed = JSON.parse(raw);
    if (!parsed || !parsed.dict) return;
    if (parsed.savedAt && Date.now() - parsed.savedAt > KH_VOCAB_LS_MAX_AGE_MS) return;
    var dict = parsed.dict;
    Object.keys(dict).forEach(function(k) {
      var v = dict[k];
      if (k && v && v.en && !VOCAB[k]) VOCAB[k] = { rom: v.rom || '', en: v.en };
    });
  } catch (_) {}
})();

async function loadVocabFromDB() {
  try {
    var sb = getSupa(); if (!sb) { initTooltips(); return; }
    // Paginate. PostgREST defaults to a 1000-row hard cap that
    // silently truncates `.limit(5000)` server-side, which is why
    // a freshly-added late-alphabet word (혁신, 흥미 …) kept
    // disappearing from the hover dict on refresh even when the
    // row was confirmed in the table — order=word_ko ascending
    // pushed the newest words past row 1000 and the client never
    // saw them. Use range() in 1000-row pages instead, advance
    // until the server returns fewer rows than the page size.
    // is_active is intentionally NOT filtered server-side: an
    // admin upsert that lands with is_active=null (default-not-
    // populated, schema-cache lag) would have been excluded by
    // .eq('is_active', true) and looked like a vanish too. We
    // skip explicitly inactive rows on the client instead.
    //
    // Admin path: route through admin-api / service_role. The
    // anon read path was sometimes returning fewer rows than
    // admin-api verify could see (vb_public_read RLS policy
    // didn't make it to prod cleanly for every install — the
    // read-write asymmetry that caused "saved but doesn't hover
    // back on refresh" for admin-added words). When we know the
    // caller is admin, going through admin-api guarantees the
    // freshly-saved row comes back.
    var PAGE = 1000;
    var page = 0;
    var anyRowsLoaded = false;
    var useAdminPath = !!window._isAdmin && typeof khAdminApi === 'function';
    while (true) {
      var from = page * PAGE;
      var to   = from + PAGE - 1;
      var res;
      if (useAdminPath) {
        try {
          var raw = await khAdminApi({
            action: 'db', table: 'vocabulary_bank', method: 'select',
            params: {
              columns: 'word_ko,word_rom,word_en,is_active',
              order: [{ col: 'word_ko', asc: true }],
              range: { from: from, to: to },
            }
          });
          res = { data: (raw && raw.data) || (Array.isArray(raw) ? raw : []), error: raw && raw.error || null };
        } catch (e) {
          res = { data: null, error: e };
        }
      } else {
        res = await sb.from('vocabulary_bank')
          .select('word_ko,word_rom,word_en,is_active')
          .order('word_ko', { ascending: true })
          .range(from, to);
      }
      if (res.error) { console.warn('[loadVocabFromDB] page', page, res.error); break; }
      var rows = res.data || [];
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (row.is_active === false) continue;
        if (row.word_ko && row.word_en) {
          VOCAB[row.word_ko] = { rom: row.word_rom || '', en: row.word_en };
          anyRowsLoaded = true;
        }
      }
      if (rows.length < PAGE) break;       // last page
      page++;
      if (page > 30) break;                // hard ceiling — 30k rows
    }
    // Snapshot the freshly-loaded VOCAB to localStorage so the next
    // page load can hydrate hover before the network round-trip
    // finishes — the safety net for the intermittent-hover bug. Skip
    // if every page errored (we don't want to overwrite a good cache
    // with an empty one). The snapshot includes anything in VOCAB,
    // not just rows we just fetched, so words registered by other
    // sources (article AI cache, hover_vocab_master) also persist.
    if (anyRowsLoaded) {
      try {
        var snapshot = {};
        Object.keys(VOCAB).forEach(function(k) {
          var v = VOCAB[k];
          if (k && v && v.en) snapshot[k] = { rom: v.rom || '', en: v.en };
        });
        localStorage.setItem(KH_VOCAB_LS_KEY, JSON.stringify({
          savedAt: Date.now(), dict: snapshot,
        }));
      } catch (_) {}
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
  // Phase 2 streak insurance: a day the user spent their weekly
  // freeze on counts as active even without real activity. The day
  // string lives in localStorage (mirrored from profiles.streak_
  // freeze_used_week at sign-in) so the walk stays sync.
  var freezeDay = lsGet('kh_streak_freeze_day', '');
  if (freezeDay) allDays[freezeDay] = true;
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

// ── Streak freeze: shop inventory + auto-apply ──────────────────
// Freezes are bought from the shop (purchase_streak_freeze RPC) and
// stored as profiles.freeze_count. On home-page load we check whether
// yesterday was missed; if it was AND the user has at least one
// freeze, we silently consume one (consume_streak_freeze) and mark
// the day in localStorage so getCurrentStreak() honours it
// immediately. The notifications row inserted by the RPC pops up in
// the bell — that's the only UI surface for the event.
async function khFreezeStatus() {
  var sb = (typeof getSupa === 'function') ? getSupa() : null;
  if (!sb || typeof supaUser === 'undefined' || !supaUser) {
    return { count: 0, signed_in: false };
  }
  try {
    var r = await sb.rpc('get_freeze_inventory');
    var n = (r && typeof r.data === 'number') ? r.data : 0;
    return { count: n, signed_in: true };
  } catch (_) {
    return { count: 0, signed_in: true };
  }
}

async function khFreezeUse(forDate) {
  // Manual call kept for back-compat; routes through the RPC now.
  var sb = (typeof getSupa === 'function') ? getSupa() : null;
  if (!sb || typeof supaUser === 'undefined' || !supaUser) return false;
  var d = forDate || new Date();
  try {
    var r = await sb.rpc('consume_streak_freeze', { p_for_date: d.toISOString().slice(0,10) });
    if (r && r.data && r.data.ok) {
      try { lsSet('kh_streak_freeze_day', d.toISOString().slice(0, 10)); } catch (_) {}
      return true;
    }
  } catch (_) {}
  return false;
}

// Award freeze(s) for a 3-day attendance milestone. Server caps the
// inventory at 3 and tracks the highest streak we've already paid
// out for, so calling this on every page load is safe — repeats
// resolve to {awarded:0}. Returns the number granted so the caller
// can decide whether to refresh the bell badge.
async function khClaimStreakAward(currentStreak) {
  if (typeof supaUser === 'undefined' || !supaUser) return 0;
  if (!Number.isFinite(currentStreak) || currentStreak < 3) return 0;
  var sb = (typeof getSupa === 'function') ? getSupa() : null;
  if (!sb) return 0;
  try {
    var r = await sb.rpc('claim_streak_award', { p_streak: currentStreak });
    var awarded = (r && r.data && r.data.awarded) || 0;
    if (awarded > 0 && typeof khLoadNotifications === 'function') khLoadNotifications();
    return awarded;
  } catch (_) { return 0; }
}

// Detect a missed yesterday and auto-apply a freeze if the learner
// has one. Designed to be called once per page load on home / mypage
// / any signed-in entry. Idempotent: if yesterday is already covered
// (real activity OR earlier freeze), it no-ops.
async function khMaybeAutoFreezeYesterday() {
  if (typeof supaUser === 'undefined' || !supaUser) return;
  var sb = (typeof getSupa === 'function') ? getSupa() : null;
  if (!sb) return;
  // KST yesterday (the streak walk uses UTC-ISH dates with KST tilt
  // already, so we mirror that here).
  var now = new Date();
  var y = new Date(now.getTime() - 86400000);
  var ykey = y.toISOString().slice(0, 10);
  // Already covered? skip.
  var log = lsGet('kh_study_log', {});
  var days = lsGet('kh_study_days', {});
  var fzd = lsGet('kh_streak_freeze_day', '');
  var hadActivity = !!days[ykey] || ((log[ykey] || {}).articles || (log[ykey] || {}).words || (log[ykey] || {}).quiz);
  if (hadActivity || fzd === ykey) return;
  // Only spend a freeze if the user actually had a streak going —
  // otherwise we'd burn freezes on brand-new accounts that haven't
  // built one up yet.
  var prevStreak = lsGet('kh_synced_activity_streak', 0) || 0;
  if (prevStreak < 1) return;
  // Inventory check.
  var inv = await khFreezeStatus();
  if (!inv.signed_in || inv.count <= 0) return;
  // Spend.
  try {
    var r = await sb.rpc('consume_streak_freeze', { p_for_date: ykey });
    if (r && r.data && r.data.ok) {
      try { lsSet('kh_streak_freeze_day', ykey); } catch (_) {}
      // Also bump in-memory days so this session's streak walk picks
      // it up without a reload.
      days[ykey] = true; lsSet('kh_study_days', days);
      // Refresh the bell so the new notification surfaces immediately.
      if (typeof khLoadNotifications === 'function') khLoadNotifications();
    }
  } catch (_) {}
}

// Sync the localStorage mirror from profiles on sign-in / page load.
// Called from page-init code that already has the user available.
async function khFreezeSync() {
  var st = await khFreezeStatus();
  if (st.used_at) {
    try { lsSet('kh_streak_freeze_day', st.used_at.toISOString().slice(0, 10)); } catch (_) {}
  }
  return st;
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
  // 🌍 globe — world/travel
  globe: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="5" y="2" width="6" height="1" fill="#34d399"/><rect x="3" y="3" width="3" height="1" fill="#6ee7b7"/><rect x="6" y="3" width="4" height="1" fill="#34d399"/><rect x="10" y="3" width="3" height="1" fill="#60a5fa"/><rect x="2" y="4" width="2" height="1" fill="#60a5fa"/><rect x="4" y="4" width="4" height="1" fill="#34d399"/><rect x="8" y="4" width="2" height="1" fill="#6ee7b7"/><rect x="10" y="4" width="2" height="1" fill="#60a5fa"/><rect x="12" y="4" width="1" height="1" fill="#3b82f6"/><rect x="2" y="5" width="1" height="4" fill="#3b82f6"/><rect x="3" y="5" width="3" height="1" fill="#60a5fa"/><rect x="6" y="5" width="2" height="1" fill="#34d399"/><rect x="8" y="5" width="3" height="1" fill="#60a5fa"/><rect x="11" y="5" width="2" height="1" fill="#34d399"/><rect x="13" y="5" width="1" height="4" fill="#3b82f6"/><rect x="3" y="6" width="4" height="3" fill="#60a5fa"/><rect x="7" y="6" width="3" height="3" fill="#34d399"/><rect x="10" y="6" width="3" height="3" fill="#60a5fa"/><rect x="3" y="9" width="10" height="1" fill="#3b82f6"/><rect x="5" y="10" width="6" height="1" fill="#60a5fa"/><rect x="5" y="11" width="6" height="1" fill="#3b82f6"/></svg>',
  // 🌸 flower — beauty/culture
  flower: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="7" y="2" width="2" height="1" fill="#f9a8d4"/><rect x="5" y="3" width="2" height="1" fill="#f472b6"/><rect x="9" y="3" width="2" height="1" fill="#f472b6"/><rect x="4" y="4" width="2" height="2" fill="#f9a8d4"/><rect x="10" y="4" width="2" height="2" fill="#f9a8d4"/><rect x="6" y="5" width="1" height="1" fill="#f472b6"/><rect x="9" y="5" width="1" height="1" fill="#f472b6"/><rect x="7" y="5" width="2" height="2" fill="#fbbf24"/><rect x="5" y="7" width="2" height="2" fill="#f472b6"/><rect x="9" y="7" width="2" height="2" fill="#f472b6"/><rect x="7" y="8" width="2" height="1" fill="#f9a8d4"/><rect x="7" y="9" width="2" height="1" fill="#22c55e"/><rect x="7" y="10" width="2" height="2" fill="#16a34a"/><rect x="6" y="11" width="1" height="1" fill="#22c55e"/><rect x="9" y="11" width="1" height="1" fill="#22c55e"/><rect x="7" y="12" width="2" height="1" fill="#15803d"/></svg>',
  // ✈️ plane — travel
  plane: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="11" y="2" width="2" height="1" fill="#60a5fa"/><rect x="10" y="3" width="2" height="1" fill="#3b82f6"/><rect x="9" y="4" width="2" height="1" fill="#3b82f6"/><rect x="8" y="5" width="2" height="1" fill="#93c5fd"/><rect x="3" y="6" width="8" height="1" fill="#60a5fa"/><rect x="7" y="7" width="2" height="1" fill="#3b82f6"/><rect x="6" y="8" width="2" height="1" fill="#3b82f6"/><rect x="5" y="9" width="2" height="1" fill="#93c5fd"/><rect x="4" y="10" width="2" height="1" fill="#60a5fa"/><rect x="7" y="10" width="5" height="1" fill="#60a5fa"/><rect x="3" y="11" width="2" height="1" fill="#3b82f6"/></svg>',
  // ✏️ pen — writing/vocab
  pen: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="11" y="2" width="2" height="1" fill="#f59e0b"/><rect x="10" y="3" width="2" height="1" fill="#fbbf24"/><rect x="12" y="3" width="1" height="1" fill="#92400e"/><rect x="9" y="4" width="2" height="1" fill="#fbbf24"/><rect x="8" y="5" width="2" height="1" fill="#fde68a"/><rect x="7" y="6" width="2" height="1" fill="#fde68a"/><rect x="6" y="7" width="2" height="1" fill="#fbbf24"/><rect x="5" y="8" width="2" height="1" fill="#fbbf24"/><rect x="4" y="9" width="2" height="1" fill="#f59e0b"/><rect x="3" y="10" width="2" height="1" fill="#d97706"/><rect x="2" y="11" width="2" height="1" fill="#92400e"/><rect x="2" y="12" width="1" height="1" fill="#475569"/></svg>',
  // 🌙 moon — night/dawn
  moon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="7" y="2" width="4" height="1" fill="#fbbf24"/><rect x="6" y="3" width="2" height="1" fill="#fde68a"/><rect x="10" y="3" width="2" height="1" fill="#fbbf24"/><rect x="5" y="4" width="2" height="1" fill="#fde68a"/><rect x="11" y="4" width="1" height="1" fill="#f59e0b"/><rect x="4" y="5" width="2" height="4" fill="#fde68a"/><rect x="4" y="9" width="2" height="1" fill="#fbbf24"/><rect x="5" y="10" width="2" height="1" fill="#fbbf24"/><rect x="6" y="11" width="2" height="1" fill="#f59e0b"/><rect x="7" y="12" width="4" height="1" fill="#f59e0b"/><rect x="3" y="3" width="1" height="1" fill="#e2e8f0"/><rect x="12" y="8" width="1" height="1" fill="#e2e8f0"/><rect x="10" y="11" width="1" height="1" fill="#cbd5e1"/></svg>',
  // 🏅 medal — milestones
  medal: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="5" y="1" width="3" height="1" fill="#3b82f6"/><rect x="8" y="1" width="3" height="1" fill="#ef4444"/><rect x="5" y="2" width="3" height="3" fill="#60a5fa"/><rect x="8" y="2" width="3" height="3" fill="#f87171"/><rect x="6" y="5" width="4" height="1" fill="#fbbf24"/><rect x="5" y="6" width="6" height="1" fill="#fde68a"/><rect x="4" y="7" width="2" height="1" fill="#f59e0b"/><rect x="6" y="7" width="4" height="1" fill="#ffd700"/><rect x="10" y="7" width="2" height="1" fill="#f59e0b"/><rect x="4" y="8" width="8" height="2" fill="#fbbf24"/><rect x="7" y="8" width="2" height="2" fill="#fde68a"/><rect x="4" y="10" width="2" height="1" fill="#d97706"/><rect x="6" y="10" width="4" height="1" fill="#f59e0b"/><rect x="10" y="10" width="2" height="1" fill="#d97706"/><rect x="5" y="11" width="6" height="1" fill="#d97706"/><rect x="6" y="12" width="4" height="1" fill="#b45309"/></svg>',
  // 🏃 runner — streak/speed
  runner: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="9" y="2" width="2" height="2" fill="#f59e0b"/><rect x="8" y="4" width="3" height="1" fill="#fbbf24"/><rect x="7" y="5" width="4" height="1" fill="#f59e0b"/><rect x="6" y="6" width="3" height="2" fill="#3b82f6"/><rect x="9" y="6" width="2" height="1" fill="#fbbf24"/><rect x="5" y="7" width="2" height="1" fill="#60a5fa"/><rect x="10" y="7" width="2" height="1" fill="#fbbf24"/><rect x="4" y="8" width="2" height="1" fill="#3b82f6"/><rect x="7" y="8" width="2" height="2" fill="#1e40af"/><rect x="6" y="10" width="2" height="1" fill="#1e40af"/><rect x="8" y="10" width="2" height="1" fill="#1e40af"/><rect x="5" y="11" width="2" height="1" fill="#92400e"/><rect x="9" y="11" width="2" height="1" fill="#92400e"/><rect x="4" y="12" width="2" height="1" fill="#78350f"/><rect x="10" y="12" width="2" height="1" fill="#78350f"/></svg>',
  // 🌊 wave — ocean/reading flow
  wave: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="1" y="6" width="2" height="1" fill="#3b82f6"/><rect x="3" y="5" width="2" height="1" fill="#60a5fa"/><rect x="5" y="4" width="2" height="1" fill="#93c5fd"/><rect x="7" y="5" width="2" height="1" fill="#60a5fa"/><rect x="9" y="6" width="2" height="1" fill="#3b82f6"/><rect x="11" y="5" width="2" height="1" fill="#60a5fa"/><rect x="13" y="4" width="2" height="1" fill="#93c5fd"/><rect x="1" y="7" width="14" height="1" fill="#2563eb"/><rect x="1" y="8" width="3" height="1" fill="#1d4ed8"/><rect x="5" y="8" width="3" height="1" fill="#3b82f6"/><rect x="9" y="8" width="3" height="1" fill="#1d4ed8"/><rect x="13" y="8" width="2" height="1" fill="#3b82f6"/><rect x="1" y="9" width="14" height="1" fill="#1e3a8a"/><rect x="1" y="10" width="14" height="2" fill="#1e40af"/></svg>',
  // 🎵 music — culture/kpop
  music: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="5" y="2" width="1" height="8" fill="#6366f1"/><rect x="11" y="2" width="1" height="8" fill="#6366f1"/><rect x="5" y="2" width="7" height="2" fill="#818cf8"/><rect x="6" y="3" width="5" height="1" fill="#a5b4fc"/><rect x="3" y="10" width="4" height="2" fill="#6366f1"/><rect x="4" y="9" width="2" height="1" fill="#818cf8"/><rect x="9" y="10" width="4" height="2" fill="#6366f1"/><rect x="10" y="9" width="2" height="1" fill="#818cf8"/><rect x="3" y="12" width="4" height="1" fill="#4f46e5"/><rect x="9" y="12" width="4" height="1" fill="#4f46e5"/></svg>',
  // 🧠 brain — knowledge/quiz
  brain: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="5" y="3" width="6" height="1" fill="#f472b6"/><rect x="4" y="4" width="2" height="1" fill="#ec4899"/><rect x="6" y="4" width="4" height="1" fill="#fda4af"/><rect x="10" y="4" width="2" height="1" fill="#ec4899"/><rect x="3" y="5" width="2" height="3" fill="#ec4899"/><rect x="5" y="5" width="6" height="1" fill="#fda4af"/><rect x="11" y="5" width="2" height="3" fill="#ec4899"/><rect x="7" y="5" width="2" height="1" fill="#fce7f3"/><rect x="5" y="6" width="6" height="2" fill="#f472b6"/><rect x="7" y="6" width="1" height="3" fill="#db2777"/><rect x="4" y="8" width="8" height="1" fill="#ec4899"/><rect x="5" y="9" width="6" height="1" fill="#db2777"/><rect x="6" y="10" width="4" height="1" fill="#be185d"/><rect x="7" y="11" width="2" height="1" fill="#9d174d"/></svg>',
  // 🌈 rainbow — all-rounder/diversity
  rainbow: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="3" y="4" width="10" height="1" fill="#ef4444"/><rect x="2" y="5" width="12" height="1" fill="#f97316"/><rect x="2" y="6" width="12" height="1" fill="#eab308"/><rect x="3" y="7" width="10" height="1" fill="#22c55e"/><rect x="4" y="8" width="8" height="1" fill="#3b82f6"/><rect x="5" y="9" width="6" height="1" fill="#8b5cf6"/><rect x="6" y="10" width="4" height="1" fill="#a855f7"/><rect x="1" y="11" width="3" height="2" fill="#94a3b8"/><rect x="12" y="11" width="3" height="2" fill="#94a3b8"/></svg>',
  // ☀️ sunrise — morning/dawn
  sunrise: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="7" y="2" width="2" height="1" fill="#fbbf24"/><rect x="3" y="4" width="1" height="1" fill="#fbbf24"/><rect x="12" y="4" width="1" height="1" fill="#fbbf24"/><rect x="5" y="6" width="6" height="1" fill="#f59e0b"/><rect x="4" y="7" width="8" height="1" fill="#fbbf24"/><rect x="3" y="8" width="10" height="1" fill="#fde68a"/><rect x="1" y="9" width="14" height="1" fill="#fed7aa"/><rect x="1" y="10" width="14" height="1" fill="#fb923c"/><rect x="1" y="11" width="14" height="2" fill="#ea580c"/><rect x="1" y="13" width="14" height="1" fill="#9a3412"/></svg>',
  // 🗞️ newspaper — reading/news
  newspaper: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="2" y="3" width="12" height="1" fill="#475569"/><rect x="2" y="4" width="12" height="8" fill="#f1f5f9"/><rect x="2" y="4" width="12" height="1" fill="#e2e8f0"/><rect x="3" y="5" width="5" height="3" fill="#93c5fd"/><rect x="9" y="5" width="4" height="1" fill="#475569"/><rect x="9" y="7" width="4" height="1" fill="#94a3b8"/><rect x="3" y="9" width="10" height="1" fill="#cbd5e1"/><rect x="3" y="11" width="10" height="1" fill="#cbd5e1"/><rect x="2" y="12" width="12" height="1" fill="#475569"/></svg>',
  // 🏰 castle — achievement/milestone
  castle: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="2" y="3" width="2" height="1" fill="#6366f1"/><rect x="7" y="2" width="2" height="1" fill="#6366f1"/><rect x="12" y="3" width="2" height="1" fill="#6366f1"/><rect x="2" y="4" width="2" height="2" fill="#818cf8"/><rect x="6" y="3" width="4" height="2" fill="#818cf8"/><rect x="12" y="4" width="2" height="2" fill="#818cf8"/><rect x="1" y="6" width="14" height="1" fill="#6366f1"/><rect x="2" y="7" width="12" height="4" fill="#818cf8"/><rect x="4" y="7" width="2" height="4" fill="#a5b4fc"/><rect x="10" y="7" width="2" height="4" fill="#a5b4fc"/><rect x="6" y="8" width="4" height="3" fill="#312e81"/><rect x="7" y="8" width="2" height="1" fill="#4f46e5"/><rect x="2" y="11" width="12" height="1" fill="#4f46e5"/><rect x="1" y="12" width="14" height="1" fill="#312e81"/></svg>',
  // 🍀 clover — luck/culture
  clover: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="6" y="2" width="4" height="2" fill="#22c55e"/><rect x="5" y="3" width="1" height="2" fill="#16a34a"/><rect x="10" y="3" width="1" height="2" fill="#16a34a"/><rect x="2" y="5" width="3" height="3" fill="#22c55e"/><rect x="5" y="5" width="6" height="3" fill="#4ade80"/><rect x="11" y="5" width="3" height="3" fill="#22c55e"/><rect x="7" y="4" width="2" height="1" fill="#4ade80"/><rect x="7" y="8" width="2" height="4" fill="#15803d"/><rect x="6" y="9" width="1" height="1" fill="#166534"/><rect x="9" y="10" width="1" height="1" fill="#166534"/></svg>',
  // 🎪 circus — fun/special
  circus: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="image-rendering:pixelated"><rect x="7" y="1" width="2" height="2" fill="#fbbf24"/><rect x="5" y="3" width="6" height="1" fill="#ef4444"/><rect x="4" y="4" width="2" height="1" fill="#ef4444"/><rect x="6" y="4" width="4" height="1" fill="#fff"/><rect x="10" y="4" width="2" height="1" fill="#ef4444"/><rect x="3" y="5" width="2" height="1" fill="#fff"/><rect x="5" y="5" width="2" height="1" fill="#ef4444"/><rect x="7" y="5" width="2" height="1" fill="#fff"/><rect x="9" y="5" width="2" height="1" fill="#ef4444"/><rect x="11" y="5" width="2" height="1" fill="#fff"/><rect x="2" y="6" width="12" height="1" fill="#3b82f6"/><rect x="2" y="7" width="12" height="4" fill="#1e40af"/><rect x="6" y="8" width="4" height="2" fill="#fbbf24"/><rect x="7" y="8" width="2" height="1" fill="#fde68a"/><rect x="2" y="11" width="12" height="1" fill="#1e3a8a"/></svg>',
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
      var secs = ['사회','국제','문화','Korea','beauty','travel','오피니언','IT과학','역사','nature'];
      return secs.every(function(s){ return (sc[s]||0) >= 1; });
    } },

  // 🔖 VOCAB
  { id:'word_10',    cat:'vocab',     tier:'bronze',   icon:pxBadge('pen'), name:'Seed Vocab',      desc:'Save 10 words',
    check: function(){ return lsGet(K_SAVED,[]).length >= 10; } },
  { id:'word_50',    cat:'vocab',     tier:'silver',   icon:pxBadge('book'), name:'Word Sprout',     desc:'Save 50 words',
    check: function(){ return lsGet(K_SAVED,[]).length >= 50; } },
  { id:'word_100',   cat:'vocab',     tier:'silver',   icon:pxBadge('pen'), name:'Word Collector',  desc:'Save 100 words',
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
  { id:'quiz_perfect3',cat:'quiz',    tier:'gold',     icon:pxBadge('target'), name:'3x Perfect',      desc:'Score 100% on 3 daily tests in a row',
    check: function(){ return lsGet('kh_quiz_perfect_streak',0) >= 3; } },
  { id:'quiz_14days',cat:'quiz',      tier:'diamond',  icon:pxBadge('clock'), name:'Daily Devotee',   desc:'Complete daily tests 14 days in a row',
    check: function(){ return getQuizStreakDays() >= 14; } },

  // 🌍 SECTIONS
  { id:'sec_society', cat:'sections', tier:'gold', icon:pxBadge('heart'), name:'Society Master', desc:'Read 20 Society articles',
    check: function(){ return (getSectionReadCounts()['사회']||0) >= 20; } },
  { id:'sec_world',   cat:'sections', tier:'gold', icon:pxBadge('globe'), name:'World Master', desc:'Read 20 World articles',
    check: function(){ return (getSectionReadCounts()['국제']||0) >= 20; } },
  { id:'sec_culture', cat:'sections', tier:'gold', icon:pxBadge('flower'), name:'Culture Master', desc:'Read 20 Culture articles',
    check: function(){ return (getSectionReadCounts()['문화']||0) >= 20; } },
  { id:'sec_korea',   cat:'sections', tier:'gold', icon:pxBadge('gift'), name:'Korea Master',desc:'Read 20 Korea articles',
    check: function(){ return (getSectionReadCounts()['Korea']||0) >= 20; } },
  { id:'sec_beauty',  cat:'sections', tier:'gold', icon:pxBadge('flower'), name:'Beauty Master',desc:'Read 20 Beauty articles',
    check: function(){ return (getSectionReadCounts()['beauty']||0) >= 20; } },
  { id:'sec_travel',  cat:'sections', tier:'gold', icon:pxBadge('plane'), name:'Travel Master',desc:'Read 20 Travel articles',
    check: function(){ return (getSectionReadCounts()['travel']||0) >= 20; } },
  { id:'sec_opinion', cat:'sections', tier:'gold', icon:pxBadge('note'), name:'Opinion Master',desc:'Read 10 Opinion articles',
    check: function(){ return (getSectionReadCounts()['오피니언']||0) >= 10; } },

  // 🔢 MILESTONE / XP
  { id:'xp_7500',    cat:'milestone', tier:'bronze',   icon:pxBadge('star'), name:'XP 7,500',    desc:'Earn 7,500 XP total',
    check: function(){ return getXP() >= 7500; } },
  { id:'xp_30000',   cat:'milestone', tier:'silver',   icon:pxBadge('medal'), name:'XP 30,000',   desc:'Earn 30,000 XP total',
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
  { id:'time_dawn',    cat:'time',    tier:'gold',     icon:pxBadge('moon'), name:'Dawn Scholar',   desc:'Study before 6 AM',
    check: function(){ return lsGet('kh_badge_dawn', false); } },
  { id:'time_morning7',cat:'time',    tier:'bronze',   icon:pxBadge('zap'), name:'Morning Routine', desc:'Study before 7 AM, 7 times',
    check: function(){ return lsGet('kh_morning_count',0) >= 7; } },
  { id:'time_monday',  cat:'time',    tier:'bronze',   icon:pxBadge('clock'), name:'Monday Fighter',  desc:'Study on Mondays, 4 weeks in a row',
    check: function(){ return lsGet('kh_monday_streak',0) >= 4; } },
  { id:'time_friday',  cat:'time',    tier:'silver',   icon:pxBadge('moon'), name:'Friday Learner',  desc:'Study on Friday night, 4 times',
    check: function(){ return lsGet('kh_friday_night_count',0) >= 4; } },
  { id:'time_weekend', cat:'time',    tier:'gold',     icon:pxBadge('trophy'), name:'Weekend Champ',   desc:'Study on weekends, 8 weeks in a row',
    check: function(){ return lsGet('kh_weekend_streak',0) >= 8; } },

  // 🎌 CULTURAL
  { id:'cult_march1',  cat:'cultural',tier:'gold',     icon:pxBadge('heart'), name:'March 1st',       desc:'Study on March 1 (Independence Day)',
    check: function(){ return lsGet('kh_cult_march1', false); } },
  { id:'cult_hangul',  cat:'cultural',tier:'legendary',icon:pxBadge('gift'),name:'Hangul Guardian', desc:'Study on Oct 9 (Hangul Day)',
    check: function(){ return lsGet('kh_cult_hangul', false); } },
  { id:'cult_newyear', cat:'cultural',tier:'gold',     icon:pxBadge('gift'), name:'New Year\'s',     desc:'Study on January 1',
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
  var now = new Date(); // Use user's local timezone
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
    var section_badge_max = { sec_society:20,sec_world:20,sec_culture:20,sec_sports:20,sec_korea:20,sec_it:20,sec_opinion:10 };
    var section_badge_sec = { sec_society:'사회',sec_world:'국제',sec_culture:'문화',sec_sports:'스포츠',sec_korea:'Korea',sec_it:'IT-과학',sec_opinion:'오피니언' };
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
    var all = window.speechSynthesis.getVoices() || [];
    // Generous matcher — some Android/iOS engines tag Korean voices
    // as 'ko-KR', some as 'ko_KR', some leave lang blank but name the
    // voice 'Yuna' / '한국어' / 'Korean'. Strict 'ko-' filter was the
    // root cause of "TTS never works" on those phones.
    _ttsVoices = all.filter(function(v) {
      var lang = (v.lang || '').toLowerCase();
      var name = (v.name || '').toLowerCase();
      return lang.indexOf('ko') === 0
          || lang.indexOf('ko_') === 0
          || lang === 'ko'
          || /korean|한국|yuna|sora|jihun|jiyoon|injeong/.test(name);
    });
    // If still empty, fall back to anything — system default voice
    // can still pronounce Korean OK on most modern devices.
    if (!_ttsVoices.length && all.length) _ttsVoices = all.slice(0, 1);
  }
  load();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = load;
  }
  // Android/iOS quirk: getVoices() returns [] until the engine warms
  // up. Three retries at growing delays fixes the cold-start race
  // without spamming the API.
  setTimeout(load, 200);
  setTimeout(load, 800);
  setTimeout(load, 2000);
}

function ttsSpeak(text, btnEl) {
  if (!window.speechSynthesis) {
    if (typeof toast === 'function') toast('이 브라우저는 음성 재생을 지원하지 않습니다.', true);
    return;
  }
  // Some mobile browsers leave the engine in a paused state after
  // tab switches; resume() is safe even when not paused.
  try { window.speechSynthesis.resume(); } catch(e) {}
  var synth = window.speechSynthesis;

  // 같은 버튼 다시 누르면 중지
  if (_ttsCurrent && _ttsCurrent === btnEl) {
    synth.cancel();
    _ttsReset();
    return;
  }

  synth.cancel();
  _ttsReset();

  // Voices may not be loaded yet on first invocation — try a quick
  // fetch right before speaking. Prevents the "first click does
  // nothing, second click works" pattern on mobile.
  if (!_ttsVoices.length) {
    var fresh = synth.getVoices() || [];
    if (fresh.length) {
      _ttsVoices = fresh.filter(function(v){
        var l = (v.lang||'').toLowerCase();
        var n = (v.name||'').toLowerCase();
        return l.indexOf('ko') === 0 || /korean|한국/.test(n);
      });
      if (!_ttsVoices.length) _ttsVoices = fresh.slice(0, 1);
    }
  }

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

  utter.onend = _ttsReset;
  utter.onerror = function(ev) {
    console.warn('[TTS] error', ev && ev.error);
    _ttsReset();
    if (typeof toast === 'function') toast('음성 재생 실패 — 휴대폰 설정에서 한국어 TTS를 활성화했는지 확인해주세요.', true);
  };
  // Fallback — Chrome/Edge bug where speak() silently fails after
  // ~15s of utterance time. We don't fight that here, but we DO
  // detect the case where speak() never fires onstart at all
  // (engine in unrecoverable state) and reset the button.
  var startGuard = setTimeout(function() {
    if (_ttsCurrent === btnEl && synth.speaking === false && synth.pending === false) {
      _ttsReset();
      if (typeof toast === 'function') toast('음성 엔진이 응답하지 않습니다. 잠시 후 다시 시도해주세요.', true);
    }
  }, 1500);
  utter.onstart = function() { clearTimeout(startGuard); };

  synth.speak(utter);
}

function _ttsReset() {
  if (_ttsCurrent) {
    _ttsCurrent.classList.remove('tts-playing');
    // Button content is now an inline SVG icon instead of an emoji,
    // so we just clear the playing state and let the icon stay put.
    _ttsCurrent = null;
  }
}

// TTS 버튼 HTML 생성 헬퍼
function ttsBtn(text) {
  var safe = String(text || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  // Inline Lucide volume-2 icon (no runtime lib dependency).
  return '<button class="tts-btn" type="button" title="Listen to pronunciation" aria-label="Listen to pronunciation" onclick="event.stopPropagation();ttsSpeak(\'' + safe + '\',this)">'
    + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    +   '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>'
    +   '<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>'
    +   '<path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>'
    + '</svg>'
    + '</button>';
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
    // Milestone cosmic celebration
    try { maybeShowStreakMilestone(newStreak, prevStreak); } catch(e) {}

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


// ══ END TTS ENGINE ═════════════════════════════════════════════════════════════


// ══ ARTICLE VOCAB — hardened Claude prompt + post-parse validator ═════════
// Centralised so bulk article seed, background pregen, on-demand article
// page, and admin regenerate all use identical instructions + filters.
// Returns window.KH_VOCAB.promptText(level) and .validate(items, body).
(function(){
  var BLACKLIST = {
    // Trivial fillers every learner already knows.
    '정말':1,'많이':1,'너무':1,'진짜':1,'아주':1,'매우':1,'조금':1,'좀':1,
    '잘':1,'또':1,'다':1,'더':1,'이미':1,'그냥':1,'그리고':1,'그래서':1,
    '하지만':1,'근데':1,'만약':1,'물론':1,'아마':1,'특히':1,'바로':1,'약':1,
    // Generic nouns/pronouns.
    '한국':1,'사람':1,'것':1,'수':1,'거':1,'때':1,'일':1,'곳':1,'말':1,
    '집':1,'나':1,'너':1,'우리':1,'저':1,'제':1,'이':1,'그':1,'저거':1,
    '분':1,'년':1,'월':1,'일':1,'오늘':1,'어제':1,'내일':1,
    // Bare auxiliaries — OK inside collocations, not alone.
    '있다':1,'없다':1,'하다':1,'되다':1,'가다':1,'오다':1
  };

  function stemMatch(body, word) {
    if (!word || word.length < 2) return false;
    // Direct occurrence
    if (body.indexOf(word) !== -1) return true;
    // Korean word-boundary regex (no surrounding Hangul) for noun/verb root
    var escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re = new RegExp('(^|[^\\uAC00-\\uD7A3])' + escaped + '(?![\\uAC00-\\uD7A3])');
    if (re.test(body)) return true;
    // For -다 dictionary forms, accept common conjugations in body
    if (/[다요]$/.test(word) && word.length >= 3) {
      var stem = word.slice(0, -1);
      var sre = new RegExp('(^|[^\\uAC00-\\uD7A3])' + stem.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '[\\uAC00-\\uD7A3]{0,4}(?![\\uAC00-\\uD7A3])');
      if (sre.test(body)) return true;
    }
    return false;
  }

  function promptText(level, body) {
    var bodyChars = body ? body.length : 0;
    var levelHint = level ? level : 'Intermediate';
    return [
      'You are a Korean language teacher curating study vocabulary from THIS news article.',
      '',
      'Return **10 to 12** key vocabulary items a ' + levelHint + ' learner should study from this article.',
      '',
      'MANDATORY RULES:',
      '1. Each item\'s Korean form OR its natural conjugation MUST literally appear in the article body. Do NOT invent words or pick words not present.',
      '2. Output the DICTIONARY FORM. Verbs/adjectives end in -다 (e.g., 갖추다, 실리다, 커지다).',
      '3. ACCURATE meaning only. If you are unsure of a word\'s dictionary meaning, DROP IT. Do not guess.',
      '   · Examples of the mistakes you must avoid:',
      '     - 갖추다 means "to equip / have ready", NOT "victim"',
      '     - 실리다 means "to be loaded / be carried / appear (in print)", NOT "save, use"',
      '     - 커지다 means "to grow bigger", NOT "come untied"',
      '     - 모두 means "all / everyone" ✓',
      '4. Include a "context" field: a short excerpt (10–50 characters) from the article body containing the word or its conjugation. The excerpt MUST be a literal substring of the body.',
      '',
      'HARD EXCLUSIONS (never return, even if frequent):',
      '- Trivial adverbs/conjunctions: 정말, 많이, 너무, 진짜, 아주, 매우, 조금, 좀, 잘, 또, 다, 더, 이미, 그냥, 그리고, 그래서, 하지만, 근데, 만약, 물론, 아마, 특히, 바로',
      '- Basic nouns/pronouns: 한국, 사람, 것, 수, 거, 때, 일, 곳, 말, 집, 나, 너, 우리, 저, 제, 이, 그',
      '- Bare auxiliaries alone: 있다, 없다, 하다, 되다, 가다, 오다. They are fine inside multi-word collocations like "관심을 갖다".',
      '- Particles, postpositions, pure numerals, simple dates.',
      '- Proper nouns unless they are cultural landmarks that deserve explanation.',
      '',
      'PRIORITY ORDER:',
      '1. Topic-specific content words (domain nouns, verbs, adjectives) that carry the article\'s meaning.',
      '2. Useful multi-word collocations or grammar patterns taken verbatim ("관심을 갖다", "덕분에", "~는 편이다").',
      '3. Intermediate-to-advanced vocab the learner is likely to encounter again.',
      '4. Words with cultural significance to THIS article.',
      '',
      'Return ONLY a JSON array of 10–12 items. Each item EXACTLY:',
      '{"word":"Korean dictionary form","reading":"romanization","meaning":"accurate dictionary meaning","context":"short excerpt from article"}',
      '',
      'No surrounding prose, no code fences, no trailing comments.'
    ].join('\n');
  }

  // Filter AI output against blacklist + in-body evidence + context match.
  // Returns { items, strict } — items is always ≥ raw length of AI (minus
  // blacklist/dedup). strict is the fully validated subset.
  // Callers should prefer strict, but fall back to items so the cache never
  // ends up empty while translation/grammar/quiz succeeded.
  function validate(items, body) {
    if (!Array.isArray(items)) return { items: [], strict: [] };
    var lenient = [];   // blacklist + dedup only
    var strict  = [];   // + in-body + context match
    var seen = {};
    var bodyNoSpace = (body || '').replace(/\s+/g, '');
    items.forEach(function(x) {
      if (!x) return;
      var ko  = (x.word || x.ko || x.word_ko || '').trim();
      var en  = (x.meaning || x.en || x.word_en || '').trim();
      var rom = (x.reading || x.rom || x.word_rom || '').trim();
      var ctx = (x.context || '').trim();
      if (!ko || !en) return;
      if (ko.length < 2) return;
      if (BLACKLIST[ko]) return;
      if (seen[ko]) return;
      seen[ko] = true;
      var entry = { word: ko, reading: rom, meaning: en, context: ctx };
      lenient.push(entry);
      if (!body) { strict.push(entry); return; }
      if (!stemMatch(body, ko)) return;
      if (ctx) {
        var ctxNoSpace = ctx.replace(/\s+/g, '');
        var ctxClip = ctxNoSpace.length > 40 ? ctxNoSpace.slice(0, 40) : ctxNoSpace;
        // Any of: exact substring, space-normalised substring, or first-40 clip
        var bodyHasCtx = body.indexOf(ctx) !== -1
                     || bodyNoSpace.indexOf(ctxNoSpace) !== -1
                     || bodyNoSpace.indexOf(ctxClip) !== -1;
        if (!bodyHasCtx) return;
      }
      strict.push(entry);
    });
    // Respect the 10–12 cap on the final list
    return {
      items: lenient.slice(0, 12),
      strict: strict.slice(0, 12)
    };
  }

  // Convenience: return the best-available list (strict if ≥4, else lenient)
  // Callers that used the old `validate` can switch to `validateBest`.
  function validateBest(items, body) {
    var r = validate(items, body);
    if (r.strict.length >= 4) return r.strict;
    // Prefer a merged list: strict first (verified) then any lenient items
    // that aren't already in strict. This keeps the fallback as clean as
    // possible while ensuring the cache always has something to show.
    var seen = {};
    r.strict.forEach(function(x){ seen[x.word] = true; });
    var extra = r.items.filter(function(x){ return !seen[x.word]; });
    return r.strict.concat(extra).slice(0, 12);
  }

  window.KH_VOCAB = { promptText: promptText, validate: validate, validateBest: validateBest, BLACKLIST: BLACKLIST };
})();

// ══ BRUSH INK SAVE ANIMATION ══════════════════════════════════════════════
// Plays a Korean calligraphy brush stroke over a given element or point.
// Usage:
//   khInkBrush(targetEl);                 // pick default tint
//   khInkBrush({ x, y, width, height }); // at a point/rect
//   khInkBrush(el, { tint: '#1a1340', label: '저장' });
(function(){
  var SVG_NS = 'http://www.w3.org/2000/svg';
  // Roughly organic horizontal brush stroke as a cubic bezier. We draw
  // three overlapping paths at slightly different widths + offsets so
  // the edge has ink-bleed feel. Path is defined in a 200x60 viewBox.
  var STROKE_PATH = 'M 6 34 C 26 20, 52 48, 82 30 S 134 20, 160 36 S 188 32, 196 28';

  function ensureStyles() {
    if (document.getElementById('kh-ink-styles')) return;
    var s = document.createElement('style');
    s.id = 'kh-ink-styles';
    s.textContent = [
      '.kh-ink-overlay{position:absolute;pointer-events:none;z-index:99998;}',
      '.kh-ink-overlay svg{overflow:visible;display:block;}',
      '.kh-ink-label{position:absolute;left:50%;top:58%;transform:translate(-50%,0);font-family:"Noto Serif KR",serif;font-weight:900;font-size:11px;letter-spacing:.14em;color:var(--kh-ink,#1a1340);opacity:0;animation:khInkLabel 1.1s ease-out forwards .15s;pointer-events:none;white-space:nowrap;text-transform:uppercase}',
      '@keyframes khInkLabel{0%{opacity:0;transform:translate(-50%,6px) scale(.95);}30%{opacity:1;transform:translate(-50%,0) scale(1);}70%{opacity:1;}100%{opacity:0;transform:translate(-50%,-4px) scale(1);}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  window.khInkBrush = function(target, opts) {
    try { ensureStyles(); } catch(_) {}
    opts = opts || {};
    var tint = opts.tint || '#1a1340';
    var label = opts.label || '';
    var rect;
    if (target && target.nodeType === 1 && target.getBoundingClientRect) {
      var r = target.getBoundingClientRect();
      rect = { left: r.left + window.scrollX, top: r.top + window.scrollY, width: r.width, height: r.height };
    } else if (target && typeof target.x === 'number') {
      var w = target.width || 80, h = target.height || 28;
      rect = { left: (target.x + window.scrollX) - w / 2, top: (target.y + window.scrollY) - h / 2, width: w, height: h };
    } else {
      return;
    }
    // Pad sideways so the stroke extends past the text and arcs over the top
    var pad = Math.max(14, rect.width * 0.22);
    var W = rect.width + pad * 2;
    var H = Math.max(34, rect.height * 1.6);
    var overlay = document.createElement('div');
    overlay.className = 'kh-ink-overlay';
    overlay.style.left  = (rect.left - pad) + 'px';
    overlay.style.top   = (rect.top - (H - rect.height) / 2) + 'px';
    overlay.style.width = W + 'px';
    overlay.style.height = H + 'px';
    overlay.style.setProperty('--kh-ink', tint);

    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width',  W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', '0 0 200 60');
    svg.setAttribute('preserveAspectRatio', 'none');

    // Three overlapping stroke layers for ink-bleed feel
    var strokes = [
      { w: 11, alpha: 0.95, dy: 0,     dur: 520, delay: 0 },
      { w: 7,  alpha: 0.78, dy: -0.6,  dur: 560, delay: 40 },
      { w: 3.2, alpha: 0.55, dy: 0.7,  dur: 620, delay: 80 }
    ];
    strokes.forEach(function(s, i) {
      var p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', STROKE_PATH);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', tint);
      p.setAttribute('stroke-width', String(s.w));
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      p.setAttribute('stroke-opacity', String(s.alpha));
      if (s.dy) p.setAttribute('transform', 'translate(0 ' + s.dy + ')');
      // Use SMIL animation so it works without extra JS ticking
      // Path length is about 230 in 200x60 viewbox — overestimate to cover.
      var len = 260;
      p.setAttribute('stroke-dasharray', len);
      p.setAttribute('stroke-dashoffset', len);
      var anim = document.createElementNS(SVG_NS, 'animate');
      anim.setAttribute('attributeName', 'stroke-dashoffset');
      anim.setAttribute('from', len);
      anim.setAttribute('to', 0);
      anim.setAttribute('dur', (s.dur / 1000) + 's');
      anim.setAttribute('begin', (s.delay / 1000) + 's');
      anim.setAttribute('fill', 'freeze');
      anim.setAttribute('calcMode', 'spline');
      anim.setAttribute('keySplines', '.15 .8 .25 1');
      p.appendChild(anim);
      // Fade out toward the end
      var fade = document.createElementNS(SVG_NS, 'animate');
      fade.setAttribute('attributeName', 'stroke-opacity');
      fade.setAttribute('from', s.alpha);
      fade.setAttribute('to', 0);
      fade.setAttribute('dur', '0.5s');
      fade.setAttribute('begin', (0.75 + s.delay / 1000) + 's');
      fade.setAttribute('fill', 'freeze');
      p.appendChild(fade);
      svg.appendChild(p);
    });

    // A couple of ink splatter dots (random)
    for (var k = 0; k < 4; k++) {
      var cx = 8 + Math.random() * 184;
      var cy = 22 + Math.random() * 22;
      var r2 = 0.7 + Math.random() * 1.4;
      var dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('cx', cx);
      dot.setAttribute('cy', cy);
      dot.setAttribute('r',  r2);
      dot.setAttribute('fill', tint);
      dot.setAttribute('fill-opacity', '0');
      var dAnim = document.createElementNS(SVG_NS, 'animate');
      dAnim.setAttribute('attributeName', 'fill-opacity');
      dAnim.setAttribute('values', '0; ' + (0.3 + Math.random() * 0.4) + '; 0');
      dAnim.setAttribute('dur', '0.9s');
      dAnim.setAttribute('begin', (0.1 + Math.random() * 0.4) + 's');
      dAnim.setAttribute('fill', 'freeze');
      dot.appendChild(dAnim);
      svg.appendChild(dot);
    }

    overlay.appendChild(svg);

    if (label) {
      var lbl = document.createElement('div');
      lbl.className = 'kh-ink-label';
      lbl.textContent = label;
      overlay.appendChild(lbl);
    }
    document.body.appendChild(overlay);
    setTimeout(function(){ try { overlay.remove(); } catch(_) {} }, 1400);
  };
})();


// ══ CARD TILT — desktop 3D hover polish ═══════════════════════════════════
// Gives `.story-card`, `.sc`, and `.hconv-card` a subtle mouse-tracked
// perspective tilt on desktop pointers only. No-ops on touch so scrolling
// and taps stay fast. Delegation at body level → new cards (rail rebuilds,
// infinite scroll, etc.) pick it up automatically.
(function() {
  if (typeof window === 'undefined' || !window.matchMedia) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  var TILT_SELECTOR = '.story-card, .sc, .hconv-card, .cc2';
  var MAX_DEG = 6;          // edge-of-card tilt in either axis
  var LIFT = 4;              // px translateZ lift on hover
  var TRANS_DUR = '.18s';

  function ensureStyles() {
    if (document.getElementById('kh-tilt-styles')) return;
    var s = document.createElement('style');
    s.id = 'kh-tilt-styles';
    s.textContent = [
      /* Parent rails need perspective so children tilt in 3D */
      '.home-story-grid,.home-conv-grid-wrap,.st-grid,.st-rail-scroll{perspective:1100px;}',
      '.story-card,.sc,.hconv-card{transform-style:preserve-3d;will-change:transform;}',
      '.story-card.kh-tilt,.sc.kh-tilt,.hconv-card.kh-tilt,.cc2.kh-tilt{transition:transform ' + TRANS_DUR + ' cubic-bezier(.22,1,.36,1),box-shadow ' + TRANS_DUR + ';}',
      /* Subtle specular highlight follows cursor via --kh-tx / --kh-ty */
      '.story-card.kh-tilt::before,.sc.kh-tilt::before,.hconv-card.kh-tilt::before,.cc2.kh-tilt::before{content:"";position:absolute;inset:0;border-radius:inherit;background:radial-gradient(circle at var(--kh-tx,50%) var(--kh-ty,50%),rgba(255,255,255,.18),rgba(255,255,255,0) 42%);opacity:0;transition:opacity ' + TRANS_DUR + ';pointer-events:none;z-index:3;mix-blend-mode:soft-light;}',
      '.story-card.kh-tilting::before,.sc.kh-tilting::before,.hconv-card.kh-tilting::before,.cc2.kh-tilting::before{opacity:1;}'
    ].join('');
    document.head.appendChild(s);
  }

  var activeCard = null;

  function onMove(e) {
    var card = e.target && e.target.closest ? e.target.closest(TILT_SELECTOR) : null;
    if (!card) { if (activeCard) reset(activeCard); return; }
    if (card !== activeCard) {
      if (activeCard) reset(activeCard);
      activeCard = card;
      card.classList.add('kh-tilt');
    }
    var rect = card.getBoundingClientRect();
    var relX = (e.clientX - rect.left) / rect.width;   // 0..1
    var relY = (e.clientY - rect.top)  / rect.height;
    var rotY = (relX - 0.5) * 2 * MAX_DEG;             // left-right → Y axis
    var rotX = -(relY - 0.5) * 2 * MAX_DEG;            // up-down → X axis
    card.style.transform =
      'translate3d(0,-' + LIFT + 'px,0) rotateX(' + rotX.toFixed(2) + 'deg) rotateY(' + rotY.toFixed(2) + 'deg)';
    card.style.setProperty('--kh-tx', (relX * 100).toFixed(1) + '%');
    card.style.setProperty('--kh-ty', (relY * 100).toFixed(1) + '%');
    card.classList.add('kh-tilting');
  }

  function reset(card) {
    if (!card) return;
    card.style.transform = '';
    card.classList.remove('kh-tilting');
    if (card === activeCard) activeCard = null;
  }

  function onLeave(e) {
    var card = e.target && e.target.closest ? e.target.closest(TILT_SELECTOR) : null;
    if (card) reset(card);
  }

  function init() {
    ensureStyles();
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerleave', onLeave, true);
    document.addEventListener('pointercancel', onLeave, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

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

  function _progCard(val, goal, label, done, accent) {
    // accent: 'mint' | 'blue' | 'gold' (defaults to mint)
    var ACC = {
      mint:  { tint:'rgba(78,205,196,.14)',  border:'rgba(78,205,196,.32)',  text:'#7ee9e0', label:'rgba(206,250,247,.7)' },
      blue:  { tint:'rgba(91,134,229,.16)',  border:'rgba(91,134,229,.34)',  text:'#a8c4ff', label:'rgba(200,220,255,.7)' },
      gold:  { tint:'rgba(244,169,60,.16)',  border:'rgba(244,169,60,.36)',  text:'#ffd089', label:'rgba(255,232,200,.7)' },
      coral: { tint:'rgba(255,107,107,.14)', border:'rgba(255,107,107,.32)', text:'#ffb3b3', label:'rgba(255,220,220,.7)' }
    };
    var a = ACC[accent] || ACC.mint;
    var doneTint = 'rgba(74,222,128,.16)';
    var doneBord = 'rgba(74,222,128,.45)';
    var bg   = done ? doneTint : a.tint;
    var bord = done ? doneBord : a.border;
    var valC = done ? '#86efac' : a.text;
    var lblC = done ? 'rgba(134,239,172,.8)' : a.label;
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
    + '<div style="font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.5)">Today\'s Progress</div>'
    + '<div class="kh-streak-pill" style="font-size:11px;font-weight:900;padding:5px 11px;border-radius:999px;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#5b3500;display:inline-flex;align-items:center;gap:4px;box-shadow:0 4px 12px rgba(245,158,11,.35),inset 0 1px 0 rgba(255,255,255,.4);">🔥 ' + streak + ' day streak</div>'
    + '</div>'
    + '<div style="display:flex;gap:6px;margin-bottom:12px;">'
    + _progCard(dm.words||0, 20, 'Words', wordsDone, 'mint')
    + _progCard(dm.articles||0, 3, 'Articles', artsDone, 'blue')
    + _progCard(xp, null, 'XP', false, 'gold')
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
  // Use smallest screen dimension to distinguish phones from tablets.
  // Tablets in portrait (≥768px min) should NOT trigger mobile redesign.
  var minDim = Math.min(window.screen.width || 9999, window.screen.height || 9999);
  return minDim < 768 && window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
}

function pageName() {
  return (window.location.pathname.split('/').pop() || 'index.html').replace(/\.html$/,'');
}

function markMobileBody() {
  if (!isMobileRedesign()) return;
  document.body.classList.add('mobile-redesign');
  // Light mode on mobile: apply unless neon is active or on study room
  var isStudyRoom = pageName() === 'korehan-study-room';
  var isNeon = document.body.classList.contains('kh-neon-on');
  document.body.classList.toggle('mobile-light', !isNeon && !isStudyRoom);
}

function injectMobileBottomNav() {
  if (!isMobileRedesign()) return;
  var page = pageName();
  // Hide bottom nav on fullscreen game pages to avoid blocking input
  if (page.indexOf('korehan-fun-') === 0) return;
  var nav = document.querySelector('.mobile-bottom-nav');
  if (!nav) {
    nav = document.createElement('nav');
    nav.className = 'mobile-bottom-nav';
    document.body.appendChild(nav);
  }
  var items = [
    ['index.html','home','Home','index'],
    ['korehan-all.html','newspaper','News','korehan-all'],
    ['korehan-study-room.html','notebook-pen','Study','korehan-study-room'],
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

// ── Immersive reading mode ──────────────────────────────────────
// On learning-content pages (article body, conv/story detail) the
// chrome fights with the content — the mobile bottom nav, the site
// header, the footer, and the inline Comments + Related Articles
// tail all break the TikTok-style continuous flow. This function:
//   - marks body.kh-reading-page so CSS can scope overrides that
//     hide the header, footer, bottom nav, and Daily Mission chip
//   - injects a fixed top-left back button (always visible)
//   - sets up the right-side action sidebar (Save / Talk / Study)
//   - sets up the feed navigation (Next-article pill + swipe)
// Currently gated to korehan-article. Conv/story use a modal pattern
// on list pages; the same `.kh-reading-page` class can be toggled
// from those modal open/close handlers later to reuse the chrome.
function setupImmersiveReading() {
  if (pageName() !== 'korehan-article') return;
  document.body.classList.add('kh-reading-page');

  if (!document.getElementById('kh-reading-back')) {
    var btn = document.createElement('a');
    btn.id = 'kh-reading-back';
    btn.href = '#';
    btn.setAttribute('aria-label', 'Back');
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';
    btn.onclick = function(e) {
      e.preventDefault();
      // Back = exit to home. SPA-navigated articles don't pile up in
      // history (we use replaceState), and "previous article" is
      // handled separately by swipe-down / goToPrevArticle. So the
      // top-left arrow always means "leave the reader".
      location.href = 'index.html';
    };
    document.body.appendChild(btn);
  }

  setupReadingSidebar();
  setupFeedNavigation();
}

// Right-side Instagram-style action sidebar: Bookmark / Comment /
// Study. Rendered as a separate fixed element rather than inside the
// article flow so it stays pinned as the user scrolls.
// Read the current article id freshly from the URL. The sidebar and
// feed handlers can outlive a single article because SPA-style
// navigation (goToNextArticle -> _khSpaLoadArticle) updates the URL
// via history.pushState without rebinding event listeners. Closure-
// captured ids would stick to the first-loaded article.
function _khCurrentArtId() {
  return (new URLSearchParams(window.location.search)).get('id');
}

function setupReadingSidebar() {
  if (document.getElementById('kh-reading-sidebar')) return;
  if (!_khCurrentArtId()) return;
  var bar = document.createElement('div');
  bar.id = 'kh-reading-sidebar';
  // Two bookmark SVGs stacked; .active on the button toggles which
  // one is visible (CSS), so we don't rely on innerHTML-swap syncing
  // between the meta-row button and the sidebar button.
  bar.innerHTML =
      '<button class="kh-rs-btn" id="kh-rs-bookmark" aria-label="Bookmark">'
    +   '<svg class="kh-rs-ico off" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>'
    +   '<svg class="kh-rs-ico on"  viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>'
    +   '<span class="kh-rs-label">Save</span>'
    + '</button>'
    + '<button class="kh-rs-btn" id="kh-rs-comment" aria-label="Comments">'
    +   '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
    +   '<span class="kh-rs-label">Talk</span>'
    + '</button>'
    + '<button class="kh-rs-btn" id="kh-rs-study" aria-label="Study">'
    +   '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>'
    +   '<span class="kh-rs-label">Study</span>'
    + '</button>';
  document.body.appendChild(bar);

  document.getElementById('kh-rs-bookmark').onclick = function() {
    var side = this;
    var meta = document.getElementById('art-bm-btn');
    if (!meta) {
      toggleBookmark(_khCurrentArtId(), side);
      return;
    }
    meta.click();
    // toggleBookmark is async (DB roundtrip). Poll briefly so the
    // sidebar's active state lands once the meta button settles.
    var tries = 0;
    (function syncLoop() {
      if (tries++ > 20) return;
      side.classList.toggle('active', meta.classList.contains('active'));
      setTimeout(syncLoop, 150);
    })();
  };
  document.getElementById('kh-rs-comment').onclick = openCommentDrawer;
  document.getElementById('kh-rs-study').onclick = function() {
    if (!supaUser) { openAuthModal('signin'); return; }
    location.href = 'korehan-study-room.html?mode=article&id=' + encodeURIComponent(_khCurrentArtId());
  };

  // Initial sync: once checkBookmarkState has marked the meta btn,
  // mirror it to the sidebar. Try a few times since the article
  // renderer waits for supaUser before calling checkBookmarkState.
  var initTries = 0;
  (function initSync() {
    if (initTries++ > 40) return;
    var meta = document.getElementById('art-bm-btn');
    if (meta && meta.classList.contains('active')) {
      document.getElementById('kh-rs-bookmark').classList.add('active');
      return;
    }
    setTimeout(initSync, 300);
  })();
}

function openCommentDrawer() {
  var drawer = document.getElementById('kh-comment-drawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'kh-comment-drawer';
    drawer.innerHTML =
        '<div class="kh-cdr-scrim" onclick="closeCommentDrawer()"></div>'
      + '<div class="kh-cdr-panel" role="dialog" aria-label="Comments">'
      +   '<div class="kh-cdr-handle" onclick="closeCommentDrawer()"></div>'
      +   '<div class="kh-cdr-header">'
      +     '<span class="kh-cdr-title"><span>댓글</span><span class="kh-cdr-count" id="kh-cdr-count">0</span></span>'
      +     '<button class="kh-cdr-close" onclick="closeCommentDrawer()" aria-label="Close">&times;</button>'
      +   '</div>'
      +   '<div class="kh-cdr-body" id="kh-comment-drawer-body"></div>'
      + '</div>';
    document.body.appendChild(drawer);
  }
  // Re-parent the existing #art-comments into the drawer body. Keeps
  // all the submitComment / loadComments event handlers intact — we
  // only move the DOM, we don't re-render.
  var body = document.getElementById('kh-comment-drawer-body');
  var cmt = document.getElementById('art-comments');
  if (cmt && cmt.parentNode !== body) body.appendChild(cmt);
  // Mirror the inline #comment-count into the drawer header pill so the
  // user sees a count next to the title. Re-read on every open since
  // loadComments may have updated it since the last drawer view.
  var inlineCount = document.getElementById('comment-count');
  var drawerCount = document.getElementById('kh-cdr-count');
  if (drawerCount) {
    var raw = (inlineCount && inlineCount.textContent || '').replace(/[^0-9]/g, '');
    drawerCount.textContent = raw || '0';
  }
  // Auto-grow the textarea — single-line until the user types more, then
  // expands up to the CSS max-height. Avoids the 'big empty box' look.
  var ta = document.getElementById('comment-input');
  if (ta && !ta.dataset.autogrowHooked) {
    ta.dataset.autogrowHooked = '1';
    var grow = function() {
      ta.style.height = 'auto';
      ta.style.height = Math.min(140, ta.scrollHeight) + 'px';
    };
    ta.addEventListener('input', grow);
    requestAnimationFrame(grow);
  }
  // rAF so the CSS transition fires from the off-screen state.
  requestAnimationFrame(function() { drawer.classList.add('open'); });
  document.body.classList.add('kh-cdr-open');
}

function closeCommentDrawer() {
  var drawer = document.getElementById('kh-comment-drawer');
  if (!drawer) return;
  drawer.classList.remove('open');
  document.body.classList.remove('kh-cdr-open');
}

// Vertical feed navigation — "swipe up for next article" pattern.
// Keeps the current page as a single-article render; we don't stack
// multiple articles in DOM (would fight the existing reader layout
// and double the bookmark / comment / vocab wiring). Instead we:
//   - show a floating pill near the bottom after 60% scroll depth
//   - listen for a strong upward swipe (>100px) near the viewport
//     bottom and trigger the same navigation
// Picks a random published article the user hasn't just seen, then
// animates the current page out before changing window.location.
var _khFeedRecentKey = 'kh_feed_recent_seen';
// Bumped from 20 → 60 so a normal browse session (often 30+ swipes)
// doesn't start cycling old articles. Matches the swipe stack max
// (80) more closely while still letting articles eventually re-surface.
var _khFeedRecentMax = 60;

// ── Studied-article exclusion ─────────────────────────────────────
// IDs of articles fully completed in Article Study. Cached in
// localStorage (instant sync) and refreshed from DB on login.
// pickNextFeedArticle skips these so the user never swipes back to
// an article they've already studied in depth.
var _KH_STUDIED_KEY = 'kh_studied_arts_v1';
var _khStudiedArtIds = null;

function _khGetStudiedIds() {
  if (_khStudiedArtIds) return _khStudiedArtIds;
  var uid = (typeof supaUser !== 'undefined' && supaUser) ? supaUser.id : 'guest';
  try {
    var raw = JSON.parse(localStorage.getItem(_KH_STUDIED_KEY + '_' + uid) || '[]');
    _khStudiedArtIds = new Set(raw.map(String));
  } catch(e) { _khStudiedArtIds = new Set(); }
  return _khStudiedArtIds;
}

function _khMarkArticleStudied(articleId) {
  var uid = (typeof supaUser !== 'undefined' && supaUser) ? supaUser.id : '';
  if (!uid || !articleId) return;
  var set = _khGetStudiedIds();
  set.add(String(articleId));
  try { localStorage.setItem(_KH_STUDIED_KEY + '_' + uid, JSON.stringify(Array.from(set))); } catch(e) {}
}

async function _khSyncStudiedFromDB() {
  var uid = (typeof supaUser !== 'undefined' && supaUser) ? supaUser.id : '';
  var sb = (typeof getSupa === 'function') ? getSupa() : null;
  if (!uid || !sb) return;
  try {
    var res = await sb.from('user_read_history')
      .select('content_id').eq('user_id', uid).eq('content_type', 'article_study').limit(500);
    if (res.data && res.data.length) {
      _khStudiedArtIds = null;
      var set = _khGetStudiedIds();
      res.data.forEach(function(r){ if (r.content_id) set.add(String(r.content_id)); });
      localStorage.setItem(_KH_STUDIED_KEY + '_' + uid, JSON.stringify(Array.from(set)));
    }
  } catch(e) {}
}

// ── Per-session navigation stack ─────────────────────────────────
// Holds the ordered list of articles the user has visited via
// next/prev (or by direct URL), plus the current index inside it.
// Goal: if the user goes prev → then forward, they should land on the
// same next-article they saw before, not a fresh random pick. Persists
// in sessionStorage so the order survives reloads but resets when the
// browser tab closes.
var _KH_FEED_STACK_KEY = 'kh_feed_stack_v1';
var _KH_FEED_STACK_MAX = 80;
function _khFeedStack() {
  try {
    var raw = sessionStorage.getItem(_KH_FEED_STACK_KEY);
    var s = raw ? JSON.parse(raw) : null;
    if (!s || !Array.isArray(s.ids)) return { ids: [], i: -1 };
    if (typeof s.i !== 'number') s.i = s.ids.length - 1;
    return s;
  } catch(e) { return { ids: [], i: -1 }; }
}
function _khFeedStackSave(s) {
  try { sessionStorage.setItem(_KH_FEED_STACK_KEY, JSON.stringify(s)); } catch(e) {}
}
// Make sure the stack reflects whatever article is on screen right now.
// Called on page load and at the start of every nav.
function _khFeedSyncCurrent(id) {
  if (!id) return;
  var s = _khFeedStack();
  // No-op: stack already points at this article.
  if (s.i >= 0 && s.i < s.ids.length && String(s.ids[s.i]) === String(id)) return;
  // Article already exists somewhere in the stack — jump i to it.
  for (var k = 0; k < s.ids.length; k++) {
    if (String(s.ids[k]) === String(id)) {
      s.i = k;
      _khFeedStackSave(s);
      return;
    }
  }
  // New article — drop anything past current i (forward history is
  // wiped, like a browser address bar entry), then append.
  s.ids = s.ids.slice(0, s.i + 1);
  s.ids.push(id);
  while (s.ids.length > _KH_FEED_STACK_MAX) { s.ids.shift(); s.i = Math.max(-1, s.i - 1); }
  s.i = s.ids.length - 1;
  _khFeedStackSave(s);
}

function _khFeedRememberSeen(id) {
  try {
    var arr = JSON.parse(localStorage.getItem(_khFeedRecentKey) || '[]');
    arr = arr.filter(function(x){ return x !== id; });
    arr.unshift(id);
    if (arr.length > _khFeedRecentMax) arr = arr.slice(0, _khFeedRecentMax);
    localStorage.setItem(_khFeedRecentKey, JSON.stringify(arr));
  } catch(e) {}
}
function _khFeedRecentSet() {
  try { return new Set(JSON.parse(localStorage.getItem(_khFeedRecentKey) || '[]')); }
  catch(e) { return new Set(); }
}

function pickNextFeedArticle(currentId) {
  var pool = (typeof getCachedArticles === 'function' ? getCachedArticles() : []).filter(function(a){
    return a && a.id && String(a.id) !== String(currentId) && (a.status === 'published' || !a.status);
  });
  if (!pool.length) return null;
  var recent = _khFeedRecentSet();
  recent.add(String(currentId));
  var s = _khFeedStack();
  s.ids.forEach(function(id){ recent.add(String(id)); });
  // Exclude articles the user has already fully studied — they've seen
  // enough of those. Fall back to the full pool if everything is studied.
  var studied = _khGetStudiedIds();
  var unstudied = pool.filter(function(a){ return !studied.has(String(a.id)); });
  var candidates = unstudied.length ? unstudied : pool;
  var fresh = candidates.filter(function(a){ return !recent.has(String(a.id)); });
  var from = fresh.length ? fresh : candidates;
  return from[Math.floor(Math.random() * from.length)];
}

function goToNextArticle(direction) {
  if (_khFeedAnimating()) return;
  var currentId = _khCurrentArtId();
  if (!currentId) return;
  _khFeedSyncCurrent(currentId);
  var s = _khFeedStack();
  // We have a forward entry from a previous visit — return there.
  if (s.i + 1 < s.ids.length) {
    var nextId = s.ids[s.i + 1];
    s.i = s.i + 1;
    _khFeedStackSave(s);
    _khFeedRememberSeen(currentId);
    _khSpaLoadArticle(nextId, direction || 'forward');
    return;
  }
  // End of stack — pick a fresh article and push it on.
  var next = pickNextFeedArticle(currentId);
  if (!next) { if (typeof toast === 'function') toast('No more articles to show', false); return; }
  s.ids.push(next.id);
  while (s.ids.length > _KH_FEED_STACK_MAX) { s.ids.shift(); s.i = Math.max(-1, s.i - 1); }
  s.i = s.ids.length - 1;
  _khFeedStackSave(s);
  _khFeedRememberSeen(currentId);
  _khSpaLoadArticle(next.id, direction || 'forward');
}

// Previous-article: walk one step back in the session navigation stack.
// Doesn't mutate forward history — going back then next returns to the
// same article the user was just on, which is the whole point of #1.
function goToPrevArticle() {
  if (_khFeedAnimating()) return;
  var currentId = _khCurrentArtId();
  _khFeedSyncCurrent(currentId);
  var s = _khFeedStack();
  if (s.i <= 0) {
    if (typeof toast === 'function') toast('No previous article', false);
    return;
  }
  var prevId = s.ids[s.i - 1];
  s.i = s.i - 1;
  _khFeedStackSave(s);
  _khSpaLoadArticle(prevId, 'back');
}

// Any of the four transition classes mid-flight — block follow-up
// navigations to avoid stacking animations / racing renderArticlePage.
function _khFeedAnimating() {
  var b = document.body;
  return b.classList.contains('kh-feed-leaving')
      || b.classList.contains('kh-feed-leaving-back')
      || b.classList.contains('kh-feed-entering')
      || b.classList.contains('kh-feed-entering-back');
}

// SPA-style swap to another article. Instead of location.href (which
// reloads the whole page — visible flash, header/scripts re-init,
// articles cache re-hydrate, breaks the TikTok flow), we update the
// URL via history.replaceState and call renderArticlePage() which
// reads from the in-memory articles cache we already have.
//
// replaceState (not pushState): feed swipes shouldn't pile up in
// history — tapping the OS/browser back button while reading should
// exit the reader, not step back through every article the user
// swiped past. The in-page "Back" arrow goes straight to home,
// swipe-down goes to previous article — explicit and predictable.
//
// `direction` ('forward' | 'back') decides which way the transition
// animates: forward = new content slides up, back = slides down.
function _khSpaLoadArticle(nextId, direction) {
  direction = direction === 'back' ? 'back' : 'forward';
  var leaveClass  = direction === 'back' ? 'kh-feed-leaving-back'  : 'kh-feed-leaving';
  var enterClass  = direction === 'back' ? 'kh-feed-entering-back' : 'kh-feed-entering';
  document.body.classList.add(leaveClass);
  // Reset the translate toggle. Without this, translateActive carries
  // over to the new article — but its zones have no dataset.original
  // yet, so the next click on the globe button silently fails to revert
  // and the user is stuck on stale English. Clearing here forces a
  // fresh "click to translate" state on the new article.
  try {
    if (typeof translateActive !== 'undefined') translateActive = false;
    if (typeof translateCache !== 'undefined') {
      // Don't drop other cached translations — only the active flag matters.
    }
    var tBtn = document.getElementById('translate-btn');
    if (tBtn) {
      tBtn.classList.remove('active');
      tBtn.classList.remove('loading');
      tBtn.disabled = false;
      tBtn.title = 'Translate';
    }
  } catch(e) {}
  setTimeout(function() {
    var newUrl = 'korehan-article.html?id=' + encodeURIComponent(nextId);
    try { history.replaceState({ articleId: nextId }, '', newUrl); } catch(e) {}

    // Drop stale #art-comments (from previous article) out of the
    // drawer so we don't end up with two duplicate IDs in the DOM.
    var dbody = document.getElementById('kh-comment-drawer-body');
    if (dbody) dbody.innerHTML = '';
    closeCommentDrawer();

    // Reset sidebar chrome that was tied to the previous article.
    var rb = document.getElementById('kh-rs-bookmark');
    if (rb) rb.classList.remove('active');
    document.body.classList.remove('kh-feed-pill-on');

    // Rebuild article content from the cached article object.
    window.scrollTo(0, 0);
    if (typeof renderArticlePage === 'function') renderArticlePage();

    // Re-prime the hover-tooltip system for the new article. The
    // MutationObserver in korehan-hover-tooltips.js eventually catches
    // up via its 250ms debounce, but on slower devices it sometimes
    // misses the renderArticlePage swap entirely — words on the new
    // article never get wrapped, so hover silently breaks.
    //
    // Pull the article's vocab from article_cache (the canonical
    // store) and register it as hover extras BEFORE the Vocab tab is
    // even opened, so every body word that has an entry gets a
    // dotted-underline tooltip on first hover. Earlier this checked
    // window._currentArticle.data.vocab — a field that's never
    // populated, so the registration was effectively a no-op and
    // hover only worked for words that happened to be in the master
    // hover_vocab_master table.
    try {
      var _articleObj = window._currentArticle;
      var _articleId = _articleObj && _articleObj.id;
      if (_articleId && typeof window.korehanHoverRegisterExtras === 'function') {
        // Pull cached vocab without blocking the article render — fire
        // and forget; the MutationObserver re-scan handles re-wrap.
        (async function () {
          try {
            if (typeof getFromCache === 'function') {
              var cacheVocab = await getFromCache('article', _articleId, 'vocab');
              if (Array.isArray(cacheVocab) && cacheVocab.length) {
                window.korehanHoverRegisterExtras(cacheVocab.map(function (v) {
                  return {
                    ko:   v.ko || v.word_ko || v.word || '',
                    en:   v.en || v.meaning_en || v.meaning || '',
                    rom:  v.rom || v.reading || '',
                    note: v.note || ''
                  };
                }));
                if (typeof window.korehanHoverRefresh === 'function') window.korehanHoverRefresh();
              }
            }
          } catch (_) {}
        })();
      }
      if (typeof window.korehanHoverRefresh === 'function') window.korehanHoverRefresh();
    } catch(_) {}

    // Re-sync sidebar bookmark state to the new article.
    var initTries = 0;
    (function initSync() {
      if (initTries++ > 30) return;
      var meta = document.getElementById('art-bm-btn');
      var side = document.getElementById('kh-rs-bookmark');
      if (meta && side) side.classList.toggle('active', meta.classList.contains('active'));
      setTimeout(initSync, 300);
    })();

    // Animate in.
    document.body.classList.remove(leaveClass);
    document.body.classList.add(enterClass);
    setTimeout(function(){ document.body.classList.remove(enterClass); }, 340);
  }, 220);
}

function setupFeedNavigation() {
  if (pageName() !== 'korehan-article') return;
  var currentId = (new URLSearchParams(window.location.search)).get('id');
  if (!currentId) return;
  // Make sure the per-session stack reflects the article that just loaded
  // (handles page reloads, direct URL paste, and links from elsewhere on
  // the site). Without this, the stack drifts away from what's on screen
  // and the next/prev pills feel random.
  _khFeedSyncCurrent(currentId);

  if (!document.getElementById('kh-feed-next-pill')) {
    var pill = document.createElement('button');
    pill.id = 'kh-feed-next-pill';
    pill.type = 'button';
    pill.setAttribute('aria-label', 'Next article');
    pill.innerHTML =
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>'
      + '<span>Next article</span>';
    pill.onclick = function(e) { e.preventDefault(); goToNextArticle(); };
    document.body.appendChild(pill);
  }
  // New: matching prev pill on the left so the learner can jump backwards
  // without having to scroll all the way to the top first.
  if (!document.getElementById('kh-feed-prev-pill')) {
    var prev = document.createElement('button');
    prev.id = 'kh-feed-prev-pill';
    prev.type = 'button';
    prev.setAttribute('aria-label', 'Previous article');
    prev.innerHTML =
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
      + '<span>Prev</span>';
    prev.onclick = function(e) { e.preventDefault(); goToPrevArticle(); };
    document.body.appendChild(prev);
  }

  // Pills appear by default so the learner discovers them, and an
  // auto-hide handler below pulls them out of the way while the
  // article is actively being scrolled. Reveal triggers on scroll-up,
  // edge proximity (top/bottom of page), or idle (no scroll for ~1.5s)
  // — a standard "mobile app chrome" pattern. Replaces the previous
  // "80% scrolled" rule, which never fired on short articles.
  document.body.classList.add('kh-feed-pill-on');

  if (!window._khFeedPillAutoHide) {
    window._khFeedPillAutoHide = true;
    var _pillLastY = window.scrollY || 0;
    var _pillTicking = false;
    var _pillSetVisible = function(on) {
      var b = document.body;
      if (!b.classList.contains('kh-reading-page')) return;
      if (on) b.classList.add('kh-feed-pill-on');
      else b.classList.remove('kh-feed-pill-on');
    };
    var _pillOnScroll = function() {
      if (_pillTicking) return;
      _pillTicking = true;
      requestAnimationFrame(function() {
        var y = window.scrollY || document.documentElement.scrollTop || 0;
        var doc = document.documentElement;
        var maxY = (doc.scrollHeight || 0) - (doc.clientHeight || 0);
        var atTop = y < 60;
        var atBottom = y > maxY - 120;
        var dy = y - _pillLastY;
        _pillLastY = y;
        // Reveal only on intentional moves: scrolling UP (= done /
        // heading back) or sitting near a page edge. Stopping
        // mid-article does NOT bring the chrome back — the learner
        // pointed out that the previous idle-reveal was distracting
        // every time they paused to read a sentence.
        if (atTop || atBottom) _pillSetVisible(true);
        else if (dy > 4)       _pillSetVisible(false);
        else if (dy < -4)      _pillSetVisible(true);
        _pillTicking = false;
      });
    };
    window.addEventListener('scroll', _pillOnScroll, { passive: true });
  }

  // Vertical swipe gestures for feed navigation, Reels / Shorts style:
  //   - swipe UP   AT the very bottom     = next article
  //   - swipe DOWN AT the very top        = previous article
  // Reading mode is the dominant flow, so the gesture is intentionally
  // strict: we ONLY navigate when the page can't scroll any further in
  // that direction. That eliminates the 'I scrolled to read the next
  // paragraph and the article jumped' class of bug.
  if (!window._khFeedSwipeHooked) {
    window._khFeedSwipeHooked = true;
    var startY = 0;
    var startX = 0;
    var startT = 0;
    var startScrollY = 0;
    var validSwipe = false;
    window.addEventListener('touchstart', function(e) {
      // Only track single-finger gestures. On iPhone, pinch-to-zoom uses
      // two fingers and each can drift well past 100px vertically while
      // the user is just resizing text — we'd otherwise treat the pinch
      // as a swipe when the first finger lifts.
      if (!e.touches || e.touches.length !== 1) { validSwipe = false; return; }
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      startT = Date.now();
      startScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      validSwipe = true;
    }, { passive: true });
    window.addEventListener('touchend', function(e) {
      if (!validSwipe) return;
      validSwipe = false;
      if (document.body.classList.contains('kh-cdr-open')) return;
      // Suppress if any feed transition is mid-flight, otherwise a fast
      // double-flick can fire two navigations against the same article.
      if (document.body.classList.contains('kh-feed-leaving')
          || document.body.classList.contains('kh-feed-leaving-back')
          || document.body.classList.contains('kh-feed-entering')
          || document.body.classList.contains('kh-feed-entering-back')) return;
      if (!e.changedTouches || !e.changedTouches.length) return;
      // Other fingers still on the screen? Mid-pinch, skip.
      if (e.touches && e.touches.length > 0) return;

      var dy = startY - e.changedTouches[0].clientY;
      var dx = e.changedTouches[0].clientX - startX;
      var dt = Date.now() - startT;

      // The scroll delta during the touch tells us whether the page was
      // actually scrolling in response to the finger. If it was, this is
      // a normal scroll — never treat it as a swipe. (Fixes the 'reading
      // mid-article and it jumped to the next one' bug — the user was
      // scrolling, browser scrolled the page, the swipe handler then
      // saw a 60px+ finger movement and fired goToNextArticle.)
      // The scrollDelta gate also makes the y / visibleBottom checks
      // below mostly redundant — if the user wasn't at the edge, the
      // page would have scrolled and we'd already have aborted — but
      // they're kept so a hardware that doesn't actually scroll (e.g.
      // an article shorter than the viewport) still requires the
      // user to be in the right spot.
      var endScrollY  = window.scrollY || document.documentElement.scrollTop || 0;
      var scrollDelta = Math.abs(endScrollY - startScrollY);

      if (dt > 800) return;
      if (Math.abs(dx) > Math.abs(dy) * 0.5) return;
      if (Math.abs(dy) < 60) return;

      // ── TikTok-style flick override ────────────────────────────
      // A fast, decisive swipe with little/no concurrent page scroll =
      // the learner is intentionally trying to navigate. Bypasses the
      // strict "must be at top/bottom of the page" rule below so swipes
      // mid-article go to the next/prev article like Reels & Shorts.
      // Threshold tuned so normal reading-scroll (≤1.0 px/ms) never
      // qualifies, but a quick finger-flick (~1.5–3 px/ms) does.
      var velocity = Math.abs(dy) / dt;
      var isFlick  = velocity > 1.2 && scrollDelta < 30;

      // Outside flick mode, keep the strict rule: any active scroll
      // means this was a scroll gesture, not a navigation gesture.
      if (!isFlick && scrollDelta > 8) return;

      // Math.max guards against iOS rubber-band overscroll, which can
      // briefly report a negative scrollY at the top of the page.
      var y = Math.max(0, endScrollY);
      var pageH = document.documentElement.scrollHeight || 1;
      var visibleBottom = y + window.innerHeight;
      if (dy > 0) {
        // Upward swipe → next article. Flick wins anywhere; otherwise
        // the strict rule (must be within 4px of page bottom) applies.
        if (isFlick || visibleBottom >= pageH - 4) goToNextArticle('forward');
      } else {
        // Downward swipe → previous article. Flick wins anywhere;
        // otherwise reader must be near the top (≤80px) — see below.
        if (isFlick || y <= 80) goToPrevArticle();
      }
    }, { passive: true });
  }
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
  // Mobile banner removed — the Stories page now has genre rails (Netflix-style)
  // so the intro banner is redundant.
  return;
}

function enhanceCollectionPagesMobile() {
  // News-category intro banner removed — was duplicate noise above each
  // category list. Articles speak for themselves; no banner needed.
  return;
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
  setupImmersiveReading();
  enhanceHomeMobile();
  enhanceCollectionPagesMobile();
  enhanceArticleMobile();
  enhanceConversationsMobile();
  enhanceStoriesMobile();
  renderKhLucideIcons();
}

document.addEventListener('DOMContentLoaded', function(){
  // Mark the body as mobile *immediately* on DCL — the heavier
  // enhancement pass (DOM rewrites, mobile bottom nav, immersive
  // reading) is deferred 700ms so it doesn't compete with first
  // paint, but the body class itself drives `display:none` rules for
  // desktop-only chrome (breaking ticker, top nav, sidebar). Without
  // running markMobileBody first the user briefly sees that chrome
  // for ~700ms on every navigation — exactly the "old version flash"
  // learners reported.
  markMobileBody();
  setTimeout(runMobileRedesign, 700);
});
window.addEventListener('resize', function(){
  if (isMobileRedesign()) {
    markMobileBody();
    injectMobileBottomNav();
    setupImmersiveReading();
  } else {
    document.body.classList.remove('mobile-redesign');
    document.body.classList.remove('mobile-light');
    var nav = document.querySelector('.mobile-bottom-nav');
    if (nav) nav.remove();
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
  // signup: any signed-in user counts as having signed up. The original
  // gate also required the onboarding-completed localStorage flag, but
  // accounts created before onboarding existed (admins, early users)
  // never got that flag set — so the signup step stayed unticked
  // forever and the First Journey banner never cleared. Falling back to
  // "supaUser exists" is good enough — the rest of the steps still
  // require the actual interaction.
  if (supaUser && !_fjIsComplete('signup')) {
    _fjMarkDone('signup');
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
// Initialize from DB stats so cross-session saves count
var _fjWordCount = 0;
(function(){
  try {
    var sb = getSupa();
    if (sb && supaUser) {
      sb.from('user_stats').select('words_saved').eq('user_id',supaUser.id).maybeSingle().then(function(r){
        if (r.data && r.data.words_saved) _fjWordCount = r.data.words_saved;
        if (_fjWordCount >= 5 && !_fjIsComplete('save_words')) _fjMarkDone('save_words');
      });
    }
  } catch(e){}
})();
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
