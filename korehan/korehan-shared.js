/* ============================================================
   KoreHan News — Shared JS
   ============================================================ */

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
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      }
    });
    return _supa;
  }
  return null;
}

// 현재 로그인 유저
var supaUser = null;

// ── Claude API 프록시 (키를 서버에서만 관리) ─────────────────
// Anthropic API를 직접 호출하지 않고 Supabase Edge Function을 통해 호출
// → API 키가 브라우저에 절대 노출되지 않음
const CLAUDE_PROXY_URL = SUPA_URL + '/functions/v1/claude-proxy';

async function callClaude({ feature, model, max_tokens, messages }) {
  var sb = getSupa();
  if (!sb) throw new Error('Supabase not initialized');

  var { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('Not signed in');

  var resp = await fetch(CLAUDE_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + session.access_token,
    },
    body: JSON.stringify({ feature, model, max_tokens, messages }),
  });

  if (resp.status === 429) throw new Error('rate_limit');
  if (resp.status === 401) throw new Error('unauthorized');
  if (!resp.ok) {
    var err = await resp.json().catch(function(){ return {}; });
    throw new Error(err.error || 'API error ' + resp.status);
  }
  return resp.json();
}

// ── article_cache — AI 분석 결과 캐시 ────────────────────────
// conv/story 발행 시 admin에서 AI 생성 → 여기서 조회
async function getFromCache(contentType, contentId, cacheKey) {
  try {
    var sb = getSupa();
    if (!sb) return null;
    var res = await sb.from('article_cache')
      .select('cache_value')
      .eq('content_type', contentType)
      .eq('content_id', String(contentId))
      .eq('cache_key', cacheKey)
      .maybeSingle();
    if (res.data && res.data.cache_value) return res.data.cache_value;
  } catch(e) {}
  return null;
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
    // Batch load all article cache entries in one query instead of N+1
    var artIds = arts.map(function(a){ return String(a.id); });
    var batchCacheMap = {};
    if (artIds.length > 0) {
      var sb0 = getSupa();
      if (sb0) {
        var batchRes = await sb0.from('article_cache')
          .select('content_id,cache_value')
          .eq('content_type', 'article')
          .eq('cache_key', 'ai_analysis')
          .in('content_id', artIds);
        if (batchRes.data) {
          batchRes.data.forEach(function(row){ batchCacheMap[row.content_id] = row.cache_value; });
        }
      }
    }
    for (var i = 0; i < arts.length; i++) {
      var art = arts[i];
      var cached = batchCacheMap[String(art.id)] || null;
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
      if (typeof toast === 'function') toast('Your session has expired. Please sign in again.', true);
      setTimeout(function() { sb.auth.signOut(); }, 2000);
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
      redirectTo: window.location.href,
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
    _authShowError('이미 가입된 이메일이에요. Sign In으로 로그인해주세요.');
    return;
  }

  _authShowOk('✅ 가입 완료! 확인 이메일을 발송했어요. 받은 편지함(스팸함 포함)을 확인해주세요.');
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
      <div style="font-size:11px;color:#94a3b8;text-align:center;margin-top:12px;line-height:1.6">By creating an account, you agree to our<br>Terms of Service and Privacy Policy.</div>
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
async function signOut() {
  var sb = getSupa();
  if (sb) {
    await sb.auth.signOut({ scope: 'local' }); // 현재 기기만 로그아웃
  }
  // Supabase 세션 localStorage에서 완전 삭제
  Object.keys(localStorage).forEach(function(key) {
    if (key.startsWith('sb-') || key.includes('supabase')) {
      localStorage.removeItem(key);
    }
  });
  supaUser = null;
  updateAuthUI();
  toast('Signed out successfully');
}

// 세션 확인
async function checkSession() {
  var sb = getSupa();
  if (!sb) { window._sessionChecked = true; return; }

  // OAuth 콜백 처리 — ?code= 파라미터 (PKCE) 또는 #access_token (implicit)
  var hasCode = window.location.search.includes('code=');
  var hasHash = window.location.hash && window.location.hash.includes('access_token');

  if (hasCode || hasHash) {
    // Supabase가 code를 exchange해서 세션 설정할 시간 대기
    await new Promise(function(r){ setTimeout(r, 800); });
    // URL 정리
    if (hasCode) {
      window.history.replaceState(null, '', window.location.pathname);
    } else {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  var { data } = await sb.auth.getSession();
  if (data && data.session && data.session.user) {
    supaUser = data.session.user;
    updateAuthUI();
    renderDailyMission();
    window.dispatchEvent(new Event('kh-auth-signed-in'));
    if (!window.location.pathname.includes('onboarding')) {
      checkOnboardingStatus();
    }
  }
  window._sessionChecked = true;

  // 세션 변화 감지
  sb.auth.onAuthStateChange(function(event, session) {
    if (event === 'SIGNED_OUT') {
      supaUser = null;
      updateAuthUI();
      updateCommentForm();
    } else if (event === 'SIGNED_IN') {
      supaUser = session ? session.user : null;
      _sessionWarningShown = false;
      updateAuthUI();
      updateCommentForm();
      renderDailyMission();
      window.dispatchEvent(new Event('kh-auth-signed-in'));
      if (!window.location.pathname.includes('onboarding')) {
        checkOnboardingStatus();
      }
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
    }
  });
}

// UI 업데이트
function updateAuthUI() {
  var signinBtn  = document.getElementById('topbar-signin-btn');
  var adminBtn   = document.getElementById('topbar-admin-btn');
  var userAvatar = document.getElementById('topbar-user-avatar');

  // 관리자 이메일 목록 (본인 Gmail 추가)
  var ADMIN_EMAILS = ['enane960819@gmail.com'];
  var isAdmin = supaUser && ADMIN_EMAILS.includes(supaUser.email);
  window._isAdmin = isAdmin; // 다른 파일에서 참조용

  if (supaUser) {
    // 로그인 상태
    if (signinBtn) {
      signinBtn.textContent = 'Sign Out';
      signinBtn.onclick = function(e){ e.preventDefault(); signOut(); };
    }
    if (userAvatar) {
      var avatar = supaUser.user_metadata && supaUser.user_metadata.avatar_url;
      userAvatar.style.display = 'inline-flex';
      userAvatar.innerHTML = avatar
        ? '<img src="' + avatar + '" style="width:28px;height:28px;border-radius:50%;vertical-align:middle">'
        : '<span style="font-size:13px">' + (supaUser.email || '').charAt(0).toUpperCase() + '</span>';
    }
    // 마이페이지 버튼
    var mypageBtn = document.getElementById('topbar-mypage-btn');
    if (mypageBtn) mypageBtn.style.display = 'inline-block';

    if (adminBtn) adminBtn.style.display = isAdmin ? 'inline-block' : 'none';
  } else {
    // 비로그인 상태
    if (signinBtn) {
      signinBtn.textContent = 'Sign In';
      signinBtn.onclick = function(e){ e.preventDefault(); openAuthModal("signin"); };
    }
    if (userAvatar) userAvatar.style.display = 'none';
    if (adminBtn) adminBtn.style.display = 'none';
    var mypageBtn = document.getElementById('topbar-mypage-btn');
    if (mypageBtn) mypageBtn.style.display = 'none';
  }
  // Join Free 버튼: 비로그인 상태에서만 표시
  var joinBtn = document.getElementById('topbar-join-btn');
  if (joinBtn) joinBtn.style.display = supaUser ? 'none' : '';
  // My Page 버튼: 로그인 상태에서만 표시
  var mp2 = document.getElementById('topbar-mypage-btn');
  if (mp2) mp2.style.display = supaUser ? '' : 'none';
  updateSidebarAuth();
}

const DB_KEY          = 'korehan_db';
const K_PHRASES       = 'korehan_phrases';
const K_WORDBANK      = 'korehan_wordbank';
const K_SENTENCES     = 'korehan_sentences';
const K_OPINIONS      = 'korehan_opinions';
const K_ADMIN_SESSION = 'korehan_admin_session';

const DEF_PHRASES = [
  {
    ko:'경제 회복', rom:'gyeong-je hoe-bok', en:'economic recovery',
    intro:'A phrase used when the economy starts improving again after a slowdown.',
    nuance:'Often used in news, politics, and business reports when talking about growth, jobs, prices, or consumer confidence.',
    examples:[
      {ko:'정부는 경제 회복을 위해 추가 지원책을 발표했어요.', en:'The government announced extra support measures for economic recovery.'},
      {ko:'전문가들은 올해 하반기에 경제 회복이 본격화될 것으로 보고 있어요.', en:'Experts believe the economic recovery will pick up in the second half of this year.'},
      {ko:'소비가 늘어나면서 경제 회복 기대감도 커지고 있어요.', en:'As spending rises, expectations for economic recovery are also growing.'}
    ],
    related:['물가 안정','소비 증가','고용 회복']
  },
  {
    ko:'민간투자',  rom:'min-gan tu-ja',     en:'private investment',
    intro:'Money invested by private companies or individuals rather than the government.',
    nuance:'Common in economy and policy articles when discussing business expansion, infrastructure, or innovation.',
    examples:[
      {ko:'정부는 민간투자를 늘리기 위한 규제 완화를 검토하고 있어요.', en:'The government is reviewing deregulation to increase private investment.'},
      {ko:'이번 프로젝트는 대규모 민간투자를 바탕으로 추진돼요.', en:'This project is being pushed forward based on large-scale private investment.'},
      {ko:'전문가들은 민간투자가 살아나야 경기 회복 속도도 빨라질 수 있다고 말해요.', en:'Experts say the recovery can speed up only if private investment picks up.'}
    ],
    related:['규제 완화','기업 투자','경기 회복']
  },
  {
    ko:'반도체',    rom:'ban-do-che',        en:'semiconductor',
    intro:'A core technology product used in phones, computers, cars, and many modern devices.',
    nuance:'One of the most common words in Korean tech and export news.',
    examples:[
      {ko:'한국의 반도체 수출이 지난달보다 증가했어요.', en:'Korea’s semiconductor exports increased compared to last month.'},
      {ko:'반도체 산업은 한국 경제에서 중요한 역할을 해요.', en:'The semiconductor industry plays an important role in the Korean economy.'},
      {ko:'새 반도체 공장 건설로 일자리도 늘어날 전망이에요.', en:'Jobs are also expected to increase with the construction of a new semiconductor factory.'}
    ],
    related:['수출','공장 건설','첨단 산업']
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
function getPhrases()   { return lsGet(K_PHRASES,   DEF_PHRASES).map(normalizePhrase); }
function getTodaysPhraseIndex() {
  var phrases = getPhrases();
  if (!phrases.length) return 0;
  return Math.floor((Date.now() + 9*3600000) / 86400000) % phrases.length;
}
function getTodaysPhrase() {
  var phrases = getPhrases();
  return phrases[getTodaysPhraseIndex()] || normalizePhrase({});
}

// ── 공유 데이터 ───────────────────────────────────────────────
function getWordBank()  { return lsGet(K_WORDBANK,  DEF_WORDBANK);  }
function getSentences() { return lsGet(K_SENTENCES, DEF_SENTENCES); }
function getOpinions()  { return lsGet(K_OPINIONS,  []);            }



function toast(msg, isErr) {
  var d = document.createElement('div');
  d.style.cssText = 'position:fixed;bottom:22px;right:22px;z-index:9999;background:'+(isErr?'#cc2200':'#1a3a6b')+';color:#fff;padding:11px 18px;border-radius:4px;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,0.25);';
  d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(function(){ d.remove(); }, 3000);
}

// ── 저장 단어 ─────────────────────────────────────────────────
var K_SAVED = 'korehan_saved_words';
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
    var res = await sb.from('saved_words').select('*').eq('user_id', supaUser.id).order('created_at', { ascending: false });
    if (res.data && res.data.length) {
      var normalized = res.data.map(normalizeSavedWord).filter(function(w){ return w && w.ko; });
      lsSet(K_SAVED, normalized);
      return normalized;
    }
  } catch(e) {}
  return localSaved;
}
async function dbSaveWord(ko, rom, en) {
  var saved = lsGet(K_SAVED, []);
  if (!saved.find(function(w){ return w.ko === ko; })) {
    saved.push({ko:ko,rom:rom,en:en});
    lsSet(K_SAVED, saved);
    if (typeof trackActivityOnWordSave === 'function') trackActivityOnWordSave();
  }
  if (!supaUser) return { ok: true, source: 'local' };
  var sb = getSupa();
  if (!sb) return { ok: true, source: 'local' };
  try {
    await sb.from('saved_words').upsert({
      user_id: supaUser.id,
      word_ko: ko,
      word_rom: rom || '',
      word_en: en || ''
    }, { onConflict: 'user_id,word_ko' });
    return { ok: true, source: 'supabase' };
  } catch(e) {
    return { ok: false, source: 'local', error: e };
  }
}
async function dbRemoveWord(ko) {
  var saved = lsGet(K_SAVED, []).filter(function(w){ return w.ko !== ko; });
  lsSet(K_SAVED, saved);
  if (!supaUser) return { ok: true, source: 'local' };
  var sb = getSupa();
  if (!sb) return { ok: true, source: 'local' };
  try {
    await sb.from('saved_words').delete().eq('user_id', supaUser.id).or('word_ko.eq."' + ko.replace(/"/g, '\\"') + '",ko.eq."' + ko.replace(/"/g, '\\"') + '"');
    return { ok: true, source: 'supabase' };
  } catch(e) {
    return { ok: false, source: 'local', error: e };
  }
}

// 저장 버튼 상태 복원 — 컨테이너 내 모든 Save 버튼에 적용
async function restoreSaveButtons(containerId) {
  var container = containerId ? document.getElementById(containerId) : document;
  if (!container) return;

  // localStorage에서 즉시 적용 (빠른 렌더)
  var saved = lsGet(K_SAVED, []);
  var savedSet = new Set(saved.map(function(w){ return w.ko || w.word_ko || ''; }).filter(Boolean));

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
// 기사는 localStorage가 아닌 Supabase articles 테이블에서 로드
var _articlesCache = null;
var _articlesCacheTime = 0;
var CACHE_TTL = 60000; // 1분

async function loadArticlesFromDB() {
  var sb = getSupa();
  if (!sb) return [];
  try {
    var res = await sb.from('articles')
      .select('*')
      .order('date', { ascending: false });
    if (res.error) throw res.error;
    _articlesCache = res.data || [];
    _articlesCacheTime = Date.now();
    document.dispatchEvent(new Event('khArticlesLoaded'));
    return _articlesCache;
  } catch(e) {
    console.warn('articles load error', e);
    return _articlesCache || [];
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
  return dbGet(function(a){ return a.status === 'published' && (!section || a.section === section); })
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
  var img = a.image || ('https://picsum.photos/seed/' + a.id + '/600/400');
  var tc  = extraTagClass || '';
  var levelColors = { 'Starter':'#f3e8ff;color:#6b21a8', 'Beginner':'#e8f5e9;color:#2e7d32', 'Intermediate':'#fff8e1;color:#f57f17', 'Advanced':'#fce4ec;color:#c62828' };
  var levelBadge = a.level ? '<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;background:' + (levelColors[a.level] || '#f0f0f0;color:#666') + '">' + a.level + '</span>' : '';
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
  var img = a.image || ('https://picsum.photos/seed/' + a.id + '/300/200');
  return '<a href="' + articleUrl(a.id) + '" style="color:inherit;text-decoration:none;">'
    + '<div class="story-item">'
    + '<img src="' + img + '" alt="" loading="lazy" onerror="this.src=\'https://picsum.photos/seed/fallback/300/200\'">'
    + '<div>'
    + '<h4 class="vocab-zone">' + a.title + '</h4>'
    + '<div class="meta">' + a.section + ' · ' + relTime(a.date) + '</div>'
    + '</div></div></a>';
}

function heroSideItemHTML(a) {
  var img = a.image || ('https://picsum.photos/seed/' + a.id + '/400/200');
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
    if (_heroTimer) clearInterval(_heroTimer);
    if (_heroSlides.length > 1) {
      _heroTimer = setInterval(function(){
        _heroIdx = (_heroIdx + 1) % _heroSlides.length;
        renderHeroSlide(heroEl);
      }, 4200);
    }
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
  var featured = _heroSlides[_heroIdx];
  var sideItems = (window._heroStaticSide && window._heroStaticSide.length ? window._heroStaticSide : _heroSlides.filter(function(a, i){ return i !== _heroIdx; })).slice(0, 4);

  var featImg = featured.image || ('https://picsum.photos/seed/' + featured.id + '/900/500');
  var featBody = (featured.body || '').replace(/<[^>]*>/g, '').slice(0, 150);
  var dots = _heroSlides.length > 1
    ? '<div style="display:flex;gap:7px;margin-top:14px">'
      + _heroSlides.map(function(_, i){
          return '<button aria-label="Go to hero slide ' + (i + 1) + '" onclick="heroGoTo(' + i + ')" style="width:' + (i===_heroIdx?'26':'8') + 'px;height:8px;border-radius:999px;border:none;background:' + (i===_heroIdx?'#fff':'rgba(255,255,255,.35)') + ';cursor:pointer;transition:all .28s"></button>';
        }).join('')
      + '</div>'
    : '';

  heroEl.innerHTML =
    '<div style="position:relative;min-height:460px;overflow:hidden;background:#0b1626;animation:khHeroSlideIn .55s cubic-bezier(.22,1,.36,1);">'
    + '<style>@keyframes khHeroSlideIn{from{opacity:.55;transform:translateX(34px)}to{opacity:1;transform:translateX(0)}}</style>'
    + '<a href="' + articleUrl(featured.id) + '" style="display:block;position:absolute;inset:0;color:inherit;text-decoration:none">'
    + '<img src="' + featImg + '" alt="" onerror="this.src=\'https://picsum.photos/seed/fallback/900/500\'" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;">'
    + '<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(5,15,35,.88) 0%,rgba(5,15,35,.55) 38%,rgba(5,15,35,.16) 100%),linear-gradient(to top,rgba(5,15,35,.92) 0%,rgba(5,15,35,.1) 58%,transparent 100%)"></div>'
    + '<div style="position:absolute;left:0;right:0;bottom:0;padding:34px 30px 30px;max-width:760px">'
    + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><span class="category-tag" style="display:inline-block">' + featured.section + '</span><span style="font-size:12px;color:rgba(255,255,255,.65)">' + relTime(featured.date) + '</span></div>'
    + '<h1 class="vocab-zone" style="font-family:\'Playfair Display\',serif;font-size:clamp(26px,3vw,42px);font-weight:900;color:#fff;line-height:1.18;margin:0 0 12px">' + featured.title + '</h1>'
    + '<p style="font-size:14px;color:rgba(255,255,255,.8);line-height:1.7;margin:0;max-width:62ch">' + featBody + '</p>'
    + dots
    + '</div></a></div>'
    + '<aside style="background:linear-gradient(180deg,#fff 0%,#f8fbff 100%);display:flex;flex-direction:column;border-left:1px solid #e7eef8;">'
    + '<div style="padding:18px 18px 12px;border-bottom:1px solid #edf2f7">'
    + '<div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8">More to explore</div>'
    + '<div style="font-size:18px;font-weight:900;color:#0f172a;margin-top:4px">Latest picks</div>'
    + '</div>'
    + sideItems.map(function(a) {
        var img = a.image || ('https://picsum.photos/seed/' + a.id + '/400/200');
        return '<a href="' + articleUrl(a.id) + '" style="display:flex;gap:12px;padding:14px 16px;text-decoration:none;color:inherit;border-bottom:1px solid #edf2f7;transition:background .15s" onmouseover="this.style.background=\'#f2f7ff\'" onmouseout="this.style.background=\'\'">'
          + '<img src="' + img + '" alt="" onerror="this.src=\'https://picsum.photos/seed/fallback/200/120\'" style="width:98px;height:78px;object-fit:cover;border-radius:14px;flex-shrink:0;box-shadow:0 6px 18px rgba(15,23,42,.08)">'
          + '<div style="min-width:0;flex:1">'
          + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px"><span style="font-size:10px;font-weight:800;color:#2255a4;letter-spacing:.06em;text-transform:uppercase">' + a.section + '</span><span style="font-size:10px;color:#94a3b8">' + relTime(a.date) + '</span></div>'
          + '<div class="vocab-zone" style="font-size:13px;font-weight:800;color:#0f172a;line-height:1.45;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">' + a.title + '</div>'
          + '</div></a>';
      }).join('')
    + '<div style="padding:16px"><a href="korehan-all.html" style="display:block;text-align:center;padding:11px 14px;border-radius:999px;background:#0f172a;color:#fff;font-size:13px;font-weight:800;text-decoration:none">Browse all news →</a></div>'
    + '</aside>';
}

function heroGoTo(idx) {
  _heroIdx = idx;
  var heroEl = document.getElementById('dyn-hero');
  if (heroEl) renderHeroSlide(heroEl);
  // 타이머 리셋
  if (_heroTimer) { clearInterval(_heroTimer); }
  if (_heroSlides.length > 1) {
    _heroTimer = setInterval(function(){
      _heroIdx = (_heroIdx + 1) % _heroSlides.length;
      var el = document.getElementById('dyn-hero');
      if (el) renderHeroSlide(el);
    }, 4200);
  }
}

function buildArticleRowHTML(a) {
  var levelColors = {Starter:'background:#f3e8ff;color:#6b21a8',Beginner:'background:#e8f5e9;color:#2e7d32',Intermediate:'background:#fff8e1;color:#f57f17',Advanced:'background:#fce4ec;color:#c62828'};
  var lvlStyle = levelColors[a.level] || 'background:#f0f4ff;color:#1a3a6b';
  var aImg = a.image || ('https://picsum.photos/seed/' + a.id + '/400/220');
  var fallback = 'https://picsum.photos/seed/' + a.id + 'x/400/220';
  var aBody = (a.body || '').replace(/<[^>]*>/g, '').slice(0, 90);
  return '<a href="' + articleUrl(a.id) + '" style="color:inherit;text-decoration:none;display:block;margin-bottom:20px;">'
    + '<div class="article-row">'
    + '<img src="' + aImg + '" alt="" onerror="this.src=\'' + fallback + '\'" style="width:220px;height:140px;object-fit:cover;border-radius:10px;flex-shrink:0;">'
    + '<div class="article-info">'
    + '<span class="category-tag" style="font-size:11px;padding:2px 8px;' + lvlStyle + '">' + (a.level || a.section || '') + '</span>'
    + '<h2 class="article-title vocab-zone" style="margin:8px 0 6px;font-size:18px;">' + a.title + '</h2>'
    + '<p class="article-excerpt vocab-zone" style="font-size:14px;color:#64748b;line-height:1.6">' + aBody + '</p>'
    + '<div style="font-size:12px;color:#94a3b8;margin-top:6px">' + relTime(a.date) + '</div>'
    + '</div></div></a>';
}

function buildHeroHTML(featured, rest) {
  var fallback = 'https://picsum.photos/seed/fallback/900/500';
  var img = featured.image || ('https://picsum.photos/seed/' + featured.id + '/900/500');
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
  if (heroEl) heroEl.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;grid-column:1/-1">⏳ 로딩 중…</div>';

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
  };
  var aliases = SECTION_ALIASES[section] || [section];

  var articles = [];

  // 2차: 직접 Supabase 쿼리 (가장 신뢰할 수 있는 방법)
  try {
    var sb = getSupa();
    if (sb) {
      // 모든 alias에 대해 OR 쿼리
      var orFilter = aliases.map(function(a){ return 'section.eq.' + a; }).join(',');
      var res = await sb.from('articles')
        .select('*')
        .eq('status', 'published')
        .or(orFilter)
        .order('date', { ascending: false })
        .limit(50);
      if (res.data && res.data.length) {
        articles = res.data;
        // 캐시에도 병합
        if (_articlesCache) {
          var ids = new Set(_articlesCache.map(function(a){ return a.id; }));
          res.data.forEach(function(a){ if (!ids.has(a.id)) _articlesCache.push(a); });
        }
      }
    }
  } catch(e) {
    console.warn('[KH] section direct query failed:', e);
  }

  // 3차: 캐시 fallback
  if (!articles.length) {
    articles = getCachedArticles().filter(function(a){
      return a.status === 'published' && aliases.some(function(alias){
        return (a.section || '') === alias;
      });
    }).sort(function(a,b){
      var da = a.date||a.created_at||'', db = b.date||b.created_at||'';
      return da > db ? -1 : da < db ? 1 : 0;
    });
  }

  console.log('[KH] section:', section, '| aliases:', aliases, '| found:', articles.length);

  var featured = articles[0];
  var rest     = articles.slice(1);

  // HERO
  if (heroEl) {
    if (featured) {
      heroEl.style.cssText = 'display:grid;grid-template-columns:1fr 300px;gap:20px;align-items:start;';
      heroEl.innerHTML = buildHeroHTML(featured, rest);
    } else {
      heroEl.innerHTML = '<div style="padding:40px;color:#94a3b8;text-align:center;grid-column:1/-1">이 섹션에 아직 기사가 없습니다.</div>';
    }
  }

  // ARTICLE LIST
  if (listEl) {
    if (!rest.length) {
      listEl.innerHTML = '<p style="color:#94a3b8;padding:20px 0">기사를 찾을 수 없습니다.</p>';
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

  // 검색 UI + 레벨 필터 버튼
  var searchWrap = document.getElementById('dyn-search-bar');
  if (searchWrap) {
    searchWrap.innerHTML = '<div class="search-bar-wrap">'
      + '<input type="text" id="search-bar-input" class="search-bar-input" placeholder="🔍 Search articles..." value="' + escapeHtml(searchQ) + '" onkeydown="if(event.key===\'Enter\')doSearch(this.value)">'
      + '<button class="search-bar-btn" onclick="doSearch(document.getElementById(\'search-bar-input\').value)">Search</button>'
      + (searchQ ? '<button class="search-bar-clear" onclick="window.location.href=\'korehan-all.html\'">✕ Clear</button>' : '')
      + '</div>'
      + (searchQ ? '<div style="font-size:13px;color:var(--gray);margin:8px 0 16px"><strong>"' + escapeHtml(searchQ) + '"</strong>  search results</div>' : '')
      + '<div style="display:flex;gap:6px;margin:12px 0 16px;flex-wrap:wrap" id="all-level-filter">'
      + '<button class="level-filter-btn on" onclick="filterAllLevel(\'All\',this)">All</button>'
      + '<button class="level-filter-btn" onclick="filterAllLevel(\'Starter\',this)">⚪ Starter</button>'
      + '<button class="level-filter-btn" onclick="filterAllLevel(\'Beginner\',this)">🟢 Beginner</button>'
      + '<button class="level-filter-btn" onclick="filterAllLevel(\'Intermediate\',this)">🟡 Intermediate</button>'
      + '<button class="level-filter-btn" onclick="filterAllLevel(\'Advanced\',this)">🔴 Advanced</button>'
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
    listEl.innerHTML = '<div style="padding:40px;color:#999;text-align:center">No articles found.</div>';
    return;
  }
  var levelColors = {'Starter':'#f3e8ff;color:#6b21a8','Beginner':'#e8f5e9;color:#2e7d32','Intermediate':'#fff8e1;color:#f57f17','Advanced':'#fce4ec;color:#c62828'};
  listEl.innerHTML = articles.map(function(a){
    var levelBadge = a.level ? '<span style="font-size:10px;font-weight:800;padding:1px 8px;border-radius:999px;background:' + (levelColors[a.level]||'#f0f0f0;color:#666') + '">' + a.level + '</span>' : '';
    return '<a href="' + articleUrl(a.id) + '" style="color:inherit;text-decoration:none;">'
      + '<div class="article-row">'
      + '<img src="' + (a.image || 'https://picsum.photos/seed/' + a.id + '/300/200') + '" alt="" loading="lazy" onerror="this.src=\'https://picsum.photos/seed/fallback/300/200\'">'
      + '<div>'
      + '<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px"><div class="tag">' + a.section + '</div>' + levelBadge + '</div>'
      + '<h3 class="vocab-zone">' + a.title + '</h3>'
      + '<p class="vocab-zone">' + (a.body || '') + '</p>'
      + '<div class="meta">' + relTime(a.date) + '</div>'
      + '</div></div></a>';
  }).join('');
}

function filterAllLevel(level, btn) {
  document.querySelectorAll('#all-level-filter .level-filter-btn').forEach(function(b){ b.classList.remove('on'); });
  if (btn) btn.classList.add('on');
  var base = window._allArticlesCache || published();
  var filtered = level === 'All' ? base : base.filter(function(a){ return a.level === level; });
  renderAllList(document.getElementById('dyn-article-list'), filtered);
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

  var img = a.image || ('https://picsum.photos/seed/' + a.id + '/1200/700');
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
    + (a.level ? (function(lv){ var c={'Beginner':'#e8f5e9;color:#2e7d32','Intermediate':'#fff8e1;color:#f57f17','Advanced':'#fce4ec;color:#c62828'}; return '<span style="font-size:11px;font-weight:800;padding:3px 10px;border-radius:999px;background:'+(c[lv]||'#f0f0f0;color:#666')+'">'+lv+'</span>'; })(a.level) : '')
    + '</div>'
    + '<h1 class="art-title vocab-zone">' + a.title + ' ' + ttsBtn(a.title) + '</h1>'
    + '<div class="art-meta-row">'
    + '<span class="art-date">📅 ' + dateStr + '</span>'
    + '<span class="art-dot">·</span>'
    + '<span class="art-readtime">⏱ ' + Math.max(1, Math.ceil((a.full||a.body||'').length / 500)) + ' min read</span>'
    + '<div class="art-actions">'
    + '<button class="kh-bm-btn" id="art-bm-btn" onclick="toggleBookmark(\'' + a.id + '\',this)">🔖 Bookmark</button>'
    + '<button class="kh-share-btn" onclick="shareArticle()">🔗 Share</button>'
    + '<button class="kh-trans-btn" id="translate-btn" onclick="toggleTranslate()">🌐 Translate</button>'
    + '</div>'
    + '</div>'
    + '</div>'

    // 히어로 이미지
    + '<div class="art-hero-img">'
    + '<img src="' + img + '" alt="" onerror="this.src=\'https://picsum.photos/seed/fallback/1200/700\'">'
    + '</div>'

    // 본문 탭
    + '<div class="art-tabs">'
    + '<button class="art-tab on" onclick="switchArtTab(\'article\',this)">📰 Article</button>'
    + '<button class="art-tab" onclick="switchArtTab(\'grammar\',this)">📖 Grammar Guide</button>'
    + '</div>'

    // 기사 탭
    + '<div id="art-tab-article">'
    + '<div class="art-lead vocab-zone">' + formatArticleBody(a.body || '') + '</div>'
    + (a.full ? '<div class="art-full vocab-zone">' + formatArticleBody(a.full) + '</div>' : '')
    + '</div>'

    // 문법 탭
    + '<div id="art-tab-grammar" style="display:none">'
    + '<div id="grammar-content"><div style="color:#aaa;padding:20px 0;text-align:center">Loading grammar guide...</div></div>'
    + '</div>'

    // 단어 학습 박스
    + '<div class="art-vocab-box">'
    + '<div class="art-vocab-title">📚 Key Vocabulary</div>'
    + '<div class="art-vocab-list" id="art-vocab-list"></div>'
    + '</div>'

    // Fill-in-the-Blank 복습 섹션
    + '<div id="fill-wrap" style="margin:32px 0">'
    + '<div id="fill-content"><div id="fill-teaser"></div></div>'
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
                + '<img src="' + (r.image || 'https://picsum.photos/seed/'+r.id+'/300/200') + '" alt="" onerror="this.src=\'https://picsum.photos/seed/fallback/300/200\'">'
                + '<div class="art-related-info">'
                + '<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">'
                + '<span style="font-size:10px;font-weight:800;text-transform:uppercase;color:#2255a4">' + r.section + '</span>'
                + (r.level ? '<span style="font-size:10px;font-weight:800;padding:1px 7px;border-radius:999px;background:' + (levelColors[r.level]||'#f0f0f0;color:#666') + '">' + r.level + '</span>' : '')
                + '</div>'
                + '<div class="art-related-title-text">' + r.title + '</div>'
                + '</div>'
                + '</a>';
            }).join('')
          + '</div></div>';
      })()

    + '</article>';

  // 핵심 단어 추출
  renderArticleVocab(a);

  // 댓글 로드
  loadComments(a.id);

  // Fill-in-the-Blank teaser 초기화
  initFillTeaser(a);
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
    } else if (attempts < 20) {
      setTimeout(waitAndUpdate, 300);
    }
  }
  setTimeout(waitAndUpdate, 300);
}

function formatArticleBody(text) {
  if (!text) return '';
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
  btn.classList.add('on');
  var artEl  = document.getElementById('art-tab-article');
  var gramEl = document.getElementById('art-tab-grammar');
  [artEl, gramEl].forEach(function(el){ if(el) el.style.display = 'none'; });
  if (tab === 'article') {
    if (artEl) artEl.style.display = 'block';
  } else {
    if (gramEl) gramEl.style.display = 'block';
    loadGrammarGuide();
  }
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
    + '<span style="font-size:11px;font-weight:800;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:2px">복습 연습</span>'
    + '</div>'
    + '<div style="font-size:20px;font-weight:900;color:#fff;margin-bottom:6px;line-height:1.3">Fill-in-the-Blank</div>'
    + '<div style="font-size:13px;color:rgba(255,255,255,.6);line-height:1.5;margin-bottom:16px">'
    + '이 기사의 핵심 단어와 문법을 빈칸으로 풀어보세요.<br>AI가 자동으로 6문제를 만들어드려요.'
    + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'
    + '<span style="font-size:11px;font-weight:800;padding:4px 12px;border-radius:999px;background:' + levelBg + ';color:' + levelColor + '">' + level + '</span>'
    + '<span style="font-size:11px;color:rgba(255,255,255,.4)">· 6문제 · 단어+문법</span>'
    + '</div>'
    + '</div>'
    + '<div style="flex-shrink:0;display:flex;flex-direction:column;gap:8px;align-items:flex-end">'
    + '<button id="fill-start-btn" onclick="startFillExercise()" '
    + 'style="padding:13px 28px;background:#fff;color:#0b1626;border:none;border-radius:999px;'
    + 'font-size:14px;font-weight:900;cursor:pointer;white-space:nowrap;'
    + 'box-shadow:0 4px 20px rgba(0,0,0,.2);transition:transform .15s"'
    + 'onmouseover="this.style.transform=\'scale(1.04)\'" onmouseout="this.style.transform=\'scale(1)\'">'
    + '시작하기 →</button>'
    + '<span style="font-size:10px;color:rgba(255,255,255,.3);text-align:right">API Key 필요</span>'
    + '</div>'
    + '</div>'
    + '</div>';
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

  if (!supaUser) {
    el.innerHTML = renderFillNoKey();
    return;
  }

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
      var sb = getSupa();
      if (sb && parsed.questions) {
        sb.from('article_cache').upsert({
          content_type: 'article',
          content_id:   String(a.id),
          cache_key:    cacheKey,
          cache_value:  { questions: parsed.questions }
        }, { onConflict: 'content_type,content_id,cache_key' }).catch(function(e){ console.warn('fill cache save failed', e); });
      }
    } catch(e) {}
  } catch(e) {
    el.innerHTML = '<div style="padding:24px;text-align:center;color:#e53e3e">⚠️ AI 생성 실패. 다시 시도해주세요.<br><button onclick="loadFillExercise()" style="margin-top:12px;padding:8px 20px;background:#2255a4;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700">🔄 Retry</button></div>';
  }
}

function renderFillLoading() {
  return '<div style="padding:40px;text-align:center">'
    + '<div style="font-size:32px;margin-bottom:16px;animation:spin 1s linear infinite;display:inline-block">✨</div>'
    + '<div style="font-size:15px;font-weight:700;color:#2255a4;margin-bottom:6px">AI가 빈칸 문제를 만들고 있어요...</div>'
    + '<div style="font-size:12px;color:#94a3b8">이 기사에서 핵심 단어와 문법을 분석 중</div>'
    + '</div>'
    + '<style>@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>';
}

function renderFillNoKey() {
  return '<div style="padding:32px;text-align:center;background:#f8faff;border-radius:16px;margin:16px 0">'
    + '<div style="font-size:36px;margin-bottom:12px">🔒</div>'
    + '<div style="font-size:15px;font-weight:800;color:#0b1626;margin-bottom:8px">로그인 필요</div>'
    + '<div style="font-size:13px;color:#64748b;margin-bottom:20px">Fill-in-the-Blank은 로그인 후 사용할 수 있어요.</div>'
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
    + '<div style="font-size:12px;color:#94a3b8">이 기사에서 추출한 핵심 표현 ' + questions.length + '문제</div>'
    + '</div>'
    + '<div style="display:flex;gap:8px;align-items:center">'
    + '<span style="font-size:11px;font-weight:800;padding:4px 12px;border-radius:999px;background:#f0f4ff;color:' + levelColor + '">' + level + '</span>'
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
      + '<button onclick="setFillMode(' + i + ',\'choice\')" id="fill-mode-choice-' + i + '" style="font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;border:2px solid #2255a4;background:#2255a4;color:#fff;cursor:pointer">🎯 4지선다</button>'
      + '<button onclick="setFillMode(' + i + ',\'type\')" id="fill-mode-type-' + i + '" style="font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;border:2px solid #e2e8f0;background:#fff;color:#64748b;cursor:pointer">⌨️ 직접 입력</button>'
      + '</div>'

      // 4지선다 영역
      + '<div id="fill-choices-' + i + '" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      + shuffled.map(function(ch) {
          return '<button onclick="checkFillAnswer(' + i + ',\'' + ch.replace(/'/g, "\\'") + '\')" '
            + 'style="padding:10px 12px;border:2px solid #e2e8f0;border-radius:10px;background:#f8faff;'
            + 'font-size:14px;font-weight:700;cursor:pointer;color:#0b1626;transition:all .15s;font-family:inherit">'
            + ch + '</button>';
        }).join('')
      + '</div>'

      // 직접 입력 영역
      + '<div id="fill-type-' + i + '" style="display:none">'
      + '<div style="display:flex;gap:8px">'
      + '<input id="fill-input-' + i + '" type="text" placeholder="한국어로 입력..." '
      + 'style="flex:1;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:15px;font-family:sans-serif;outline:none" '
      + 'onkeydown="if(event.key===\'Enter\')submitFillType(' + i + ')">'
      + '<button onclick="submitFillType(' + i + ')" style="padding:10px 18px;background:#2255a4;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer">확인</button>'
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

  // 4지선다 버튼 색 변경
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
        + '<div><div style="font-size:13px;font-weight:800;color:#16a34a;margin-bottom:2px">정답!</div>'
        + '<div style="font-size:12px;color:#166534"><strong>' + correct + '</strong> = ' + q.blank_en + '</div></div>'
        + ttsBtn(correct)
        + '</div>'
      : '<div style="background:#fff5f5;border:1px solid #fca5a5;border-radius:10px;padding:10px 14px;display:flex;gap:10px;align-items:flex-start">'
        + '<span style="font-size:18px">❌</span>'
        + '<div><div style="font-size:13px;font-weight:800;color:#dc2626;margin-bottom:2px">'
        + (isTyped ? '틀렸어요 (입력: ' + selected + ')' : '틀렸어요')
        + '</div>'
        + '<div style="font-size:12px;color:#991b1b">정답: <strong>' + correct + '</strong> = ' + q.blank_en + '</div></div>'
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
      var sb = getSupa();
      if (sb && guides.length) {
        sb.from('article_cache').upsert({
          content_type: 'article',
          content_id:   String(a.id),
          cache_key:    'grammar_guide',
          cache_value:  { patterns: guides }
        }, { onConflict: 'content_type,content_id,cache_key' }).catch(function(e){ console.warn('grammar cache save failed', e); });
      }
    } catch(e) {}
  } catch(e) {
    if (e.message === 'Not signed in') {
      el.dataset.source = ''; // 로그인 후 재시도 허용
      el.innerHTML = '<div style="text-align:center;padding:28px 16px">'
        + '<div style="font-size:32px;margin-bottom:12px">🔒</div>'
        + '<div style="font-size:14px;font-weight:700;color:#0b1626;margin-bottom:8px">Sign in to use Grammar Guide</div>'
        + '<div style="font-size:13px;color:#64748b;margin-bottom:20px">AI-powered grammar analysis is available for signed-in users.</div>'
        + '<button onclick="openAuthModal(&apos;signin&apos;)" style="padding:10px 28px;background:linear-gradient(135deg,#2d6be4,#1e4fa3);color:#fff;border:none;border-radius:999px;font-size:13px;font-weight:800;cursor:pointer">Sign In →</button>'
        + '</div>';
    } else {
      renderStaticGrammar(el, a);
    }
  }
}

function renderGrammarGuideHTML(el, guides) {
  el.innerHTML = '<p class="grammar-intro">✨ Grammar patterns found in this article:</p>'
    + guides.map(function(g){
      return '<div class="grammar-point">'
        + '<div class="grammar-name">' + g.name
        + ' <span style="font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(34,85,164,0.1);color:var(--bright);font-weight:700;vertical-align:middle">' + g.level + '</span>'
        + '</div>'
        + '<div class="grammar-explanation">' + g.exp + '</div>'
        + '<div class="grammar-example"><strong>Example: </strong>' + g.ex_ko + '<br><span style="color:var(--gray);font-size:13px">' + g.ex_en + '</span></div>'
        + '</div>';
    }).join('');
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
    + guides.map(function(g){
      return '<div class="grammar-point">'
        + '<div class="grammar-name">' + g.name
        + ' <span style="font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(34,85,164,0.1);color:var(--bright);font-weight:700;vertical-align:middle">' + g.level + '</span>'
        + '</div>'
        + '<div class="grammar-explanation">' + g.exp + '</div>'
        + '<div class="grammar-example"><strong>Example: </strong>' + g.ex_ko + '<br><span style="color:var(--gray);font-size:13px">' + g.ex_en + '</span></div>'
        + '</div>';
    }).join('');
}

function renderArticleVocab(a) {
  var el = document.getElementById('art-vocab-list');
  if (!el) return;
  var text = (a.title || '') + ' ' + (a.body || '') + ' ' + (a.full || '');
  var found = [];
  Object.keys(VOCAB).forEach(function(k) {
    if (text.indexOf(k) !== -1 && found.length < 8) found.push(k);
  });
  if (!found.length) { el.closest('.art-vocab-box').style.display = 'none'; return; }
  el.innerHTML = found.map(function(k) {
    return '<div class="art-vocab-item">'
      + '<span class="art-vocab-ko">' + k + '</span>'
      + '<span class="art-vocab-rom">' + VOCAB[k].rom + '</span>'
      + '<span class="art-vocab-en">' + VOCAB[k].en + '</span>'
      + ttsBtn(k)
      + '</div>';
  }).join('');
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
      readLog[todayKey].push(id);
      localStorage.setItem('kh_read_log', JSON.stringify(readLog));
      trackActivityOnArticleRead(section);
    } else {
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
    btn.textContent = '🌐 Translate to English';
    btn.classList.remove('active');
    return;
  }

  if (!supaUser) {
    if (typeof toast === 'function') toast('Please sign in to use translation.', true);
    return;
  }

  btn.textContent = '⏳ Translating...';
  btn.disabled = true;

  var params = new URLSearchParams(window.location.search);
  var id = params.get('id');
  var cacheKey = 'trans_' + id;

  if (translateCache[cacheKey]) {
    applyTranslation(zones, translateCache[cacheKey]);
    btn.textContent = '🇰🇷 Back to Korean';
    btn.disabled = false;
    btn.classList.add('active');
    translateActive = true;
    return;
  }

  // 번역할 텍스트 수집 - 원본 텍스트만 추출
  var texts = [];
  zones.forEach(function(z) {
    if (!z.dataset.original) z.dataset.original = z.innerHTML;
    // kh-word span 제거하고 순수 텍스트만
    var clone = z.cloneNode(true);
    clone.querySelectorAll('.kh-word').forEach(function(s){ s.replaceWith(s.textContent); });
    texts.push(clone.textContent.trim().slice(0, 400));
  });

  var prompt = 'Translate each of the following Korean text segments into natural English. Return ONLY a JSON array of translated strings, same order, no extra text:\n'
    + JSON.stringify(texts.map(function(t){ return t.slice(0, 300); }));

  try {
    var res = await callClaude({
      feature: 'translate',
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
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
  } catch(e) {
    console.error('translate error', e);
    btn.textContent = '🌐 Translate';
    if (typeof toast === 'function') toast('Translation failed — check your connection and try again.', true);
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
    btn.textContent = '🔖 Bookmark';
    toast('Bookmark removed');
  } else {
    await sb.from('bookmarks').insert({ user_id: supaUser.id, article_id: articleId });
    btn.classList.add('active');
    btn.textContent = '🔖 Saved';
    toast('Bookmarked ✓');
  }
}

async function checkBookmarkState(articleId) {
  var btn = document.getElementById('art-bm-btn');
  if (!btn || !supaUser) return;
  var sb = getSupa();
  if (!sb) return;
  var { data } = await sb.from('bookmarks').select('id').eq('user_id', supaUser.id).eq('article_id', articleId).maybeSingle();
  if (data) { btn.classList.add('active'); btn.textContent = '🔖 Saved'; }
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
    var avatar = c.avatar_url
      ? '<img src="' + c.avatar_url + '" class="comment-avatar" onerror="this.style.display=\'none\'">'
      : '<div class="comment-avatar" style="background:#2255a4;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700">' + escapeHtml((c.user_name||'?').charAt(0)) + '</div>';
    var timeStr = c.created_at ? new Date(c.created_at).toLocaleDateString('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
    return '<div class="comment-row" id="comment-' + c.id + '">'
      + '<div class="comment-top">'
      + avatar
      + '<div class="comment-meta">'
      + '<span class="comment-name">' + escapeHtml(c.user_name || 'Anonymous') + '</span>'
      + '<span class="comment-date">' + timeStr + '</span>'
      + '</div>'
      + (isOwn ? '<button class="comment-del" onclick="deleteComment(\'' + c.id + '\')" title="Delete">✕</button>' : '')
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

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

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
    adminBar.textContent = '✏️ 단어 편집 모드';
    adminBar.onclick = function() { toggleVocabEditMode(); };
    document.body.appendChild(adminBar);
  }

  document.addEventListener('mouseover', function(e) {
    var w = e.target.closest ? e.target.closest('.kh-word') : null;
    if (!w) return;
    var word = w.dataset.word;
    var d = VOCAB[word];
    if (window._vocabEditMode && window._isAdmin) {
      tip.innerHTML = '<span style="font-size:13px;color:#fbbf24;font-weight:700">✏️ 클릭하여 편집</span><br>'
        + '<span style="color:#7ab8f5;font-weight:700">' + word + '</span>'
        + (d ? '<br><span style="color:#94a3b8;font-size:11px">' + d.en + '</span>' : '<br><span style="color:#f87171;font-size:11px">뜻 없음</span>');
      tip.style.opacity = '1';
      return;
    }
    if (!d) return;
    tip.innerHTML = '<span style="font-size:16px;font-weight:700;color:#7ab8f5">' + word + '</span><br>'
      + '<span style="color:#aabbd0;font-size:11px;font-style:italic">' + d.rom + '</span><br>'
      + '<strong>' + d.en + '</strong>';
    tip.style.opacity = '1';
  });
  var _tipMoveRaf = null;
  document.addEventListener('mousemove', function(e) {
    if (_tipMoveRaf) return;
    _tipMoveRaf = requestAnimationFrame(function() {
      tip.style.left = (e.clientX + 14) + 'px';
      tip.style.top  = (e.clientY - 10) + 'px';
      _tipMoveRaf = null;
    });
  });
  document.addEventListener('mouseout', function(e) {
    if (e.target.closest && e.target.closest('.kh-word')) tip.style.opacity = '0';
  });

  // 어드민 편집 모드 클릭 처리
  document.addEventListener('click', function(e) {
    if (!window._vocabEditMode || !window._isAdmin) return;
    var w = e.target.closest ? e.target.closest('.kh-word') : null;
    if (!w) return;
    e.preventDefault(); e.stopPropagation();
    tip.style.opacity = '0';
    openVocabEditModal(w.dataset.word);
  });
}

function toggleVocabEditMode() {
  window._vocabEditMode = !window._vocabEditMode;
  var bar = document.getElementById('vocab-admin-bar');
  if (bar) {
    bar.textContent = window._vocabEditMode ? '✅ 편집 모드 ON — 단어 클릭 or 드래그 선택' : '✏️ 단어 편집 모드';
    bar.style.background = window._vocabEditMode ? '#16a34a' : '#0b1626';
  }
  document.querySelectorAll('.kh-word').forEach(function(w) {
    w.style.outline = window._vocabEditMode ? '1px dashed #fbbf24' : '';
    w.style.cursor  = window._vocabEditMode ? 'pointer' : '';
  });

  // 드래그 선택 팝업 — 편집 모드 ON 시 등록
  if (window._vocabEditMode) {
    document.addEventListener('mouseup', _handleVocabSelection);
  } else {
    document.removeEventListener('mouseup', _handleVocabSelection);
    var pop = document.getElementById('vocab-select-popup');
    if (pop) pop.remove();
  }
}

function _handleVocabSelection(e) {
  if (!window._vocabEditMode || !window._isAdmin) return;
  if (e.target && e.target.closest && (e.target.closest('#vocab-edit-modal') || e.target.closest('#vocab-select-popup'))) return;

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
  pop.innerHTML = '+ <span style="color:#7ab8f5;font-weight:900">' + text + '</span> 추가';

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
  var modal = document.createElement('div');
  modal.id = 'vocab-edit-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML =
    '<div style="background:#fff;border-radius:16px;padding:24px;max-width:400px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,.3);">'
    + '<div style="font-size:16px;font-weight:900;color:#0f172a;margin-bottom:16px;">✏️ 단어 수정: <span style="color:#2255a4">' + word + '</span></div>'
    + '<label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">발음 (romanization)</label>'
    + '<input id="ve-rom" value="' + existing.rom + '" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;margin-bottom:12px;box-sizing:border-box;">'
    + '<label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">영어 뜻</label>'
    + '<input id="ve-en" value="' + existing.en + '" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;margin-bottom:6px;box-sizing:border-box;">'
    + '<div id="ve-err" style="font-size:12px;color:#e53e3e;margin-bottom:12px;display:none;"></div>'
    + '<div style="display:flex;gap:8px;margin-top:16px;">'
    + '<button id="ve-save" style="flex:1;padding:10px;background:#2255a4;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:800;cursor:pointer;">저장</button>'
    + (existing.en ? '<button id="ve-del" style="padding:10px 16px;background:#fee2e2;color:#b91c1c;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">삭제</button>' : '')
    + '<button id="ve-cancel" style="padding:10px 16px;background:#f1f5f9;color:#475569;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">취소</button>'
    + '</div></div>';

  document.body.appendChild(modal);

  modal.querySelector('#ve-cancel').onclick = function() { modal.remove(); };
  modal.onclick = function(e) { if (e.target === modal) modal.remove(); };

  var delBtn = modal.querySelector('#ve-del');
  if (delBtn) {
    delBtn.onclick = async function() {
      if (!confirm(word + ' 단어를 삭제할까요?')) return;
      await saveVocabToDB(word, null, null, true);
      delete VOCAB[word];
      // 해당 단어 span 제거
      document.querySelectorAll('.kh-word[data-word="' + word + '"]').forEach(function(s) {
        s.replaceWith(document.createTextNode(s.textContent));
      });
      modal.remove();
      showToast('🗑 ' + word + ' 삭제됨');
    };
  }

  modal.querySelector('#ve-save').onclick = async function() {
    var rom = modal.querySelector('#ve-rom').value.trim();
    var en  = modal.querySelector('#ve-en').value.trim();
    var err = modal.querySelector('#ve-err');
    if (!en) { err.textContent = '영어 뜻을 입력해주세요.'; err.style.display='block'; return; }
    var btn = modal.querySelector('#ve-save');
    btn.textContent = '저장 중...'; btn.disabled = true;
    try {
      await saveVocabToDB(word, rom, en, false);
      VOCAB[word] = { rom: rom, en: en };

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

      modal.remove();
      showToast('✅ ' + word + ' 저장됨');
    } catch(e) {
      err.textContent = '저장 실패: ' + e.message;
      err.style.display = 'block';
      btn.textContent = '저장'; btn.disabled = false;
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

async function awardXP(actionKey, meta) {
  if (!supaUser) return null;
  try {
    var sb = getSupa(); if (!sb) return null;
    var res = await sb.rpc('award_xp', {
      p_user_id: supaUser.id,
      p_action:  actionKey,
      p_meta:    meta || {}
    });
    if (res.data && res.data.ok) {
      // 레벨업이면 토스트 표시
      if (res.data.leveled_up) {
        showToast('🎉 레벨 업! Lv.' + res.data.level + ' ' + res.data.level_name);
      }
      // XP 획득 토스트 (미니)
      showXPToast(res.data.xp_gained);
      return res.data;
    }
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

async function saveVocabToDB(word, rom, en, isDelete) {
  var sb = getSupa();
  if (!sb) throw new Error('Supabase 연결 없음');
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
  // 폰트가 없으면 동적 주입
  if (!document.getElementById('kh-font-link')) {
    var fl = document.createElement('link');
    fl.id   = 'kh-font-link';
    fl.rel  = 'stylesheet';
    fl.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Noto+Serif+KR:wght@700;900&family=Noto+Sans+KR:wght@400;600;700;900&display=swap';
    // Pretendard (한국어 + 영문 최적화, OFL 라이선스)
    if (!document.getElementById('kh-pretendard')) {
      var pf = document.createElement('link');
      pf.id   = 'kh-pretendard';
      pf.rel  = 'stylesheet';
      pf.href = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';
      document.head.appendChild(pf);
    }
    document.head.appendChild(fl);
  }
  var page = window.location.pathname.split('/').pop() || 'index.html';
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
    + '<div class="kh-hsearch"><input type="text" placeholder="&#x1F50D; Search articles\u2026" onkeydown="if(event.key===\'Enter\')doSearch(this.value)" style="border:none;background:none;outline:none;font-size:13px;color:inherit;font-family:inherit;width:100%;"></div>'
    + '<span id="topbar-user-avatar" style="display:none;width:28px;height:28px;border-radius:50%;background:#2255a4;color:#fff;align-items:center;justify-content:center;font-weight:700;font-size:13px;overflow:hidden;vertical-align:middle;"></span>'
    + '<a href="korehan-mypage.html" id="topbar-mypage-btn" class="kh-hbtn kh-hbtn-out" style="display:none">&#128100; My Page</a>'
    + '<a href="#" id="topbar-signin-btn" class="kh-hbtn kh-hbtn-out" onclick="event.preventDefault();openAuthModal(\'signin\')">Sign In</a>'
    + '<a href="#" id="topbar-join-btn" class="kh-hbtn kh-hbtn-fill" onclick="event.preventDefault();openAuthModal(\'signup\')">Join Free</a>'
    + '<a href="korehan-admin.html" id="topbar-admin-btn" class="kh-hbtn kh-hbtn-out" style="display:none;background:rgba(231,76,60,0.15);border-color:rgba(231,76,60,0.4);">&#9881; Admin</a>'
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
    + '<a href="index.html" class="tn-item' + (isOn('index.html') ? ' on' : '') + '">Home</a>'
    + '<div class="tn-item has-drop' + (page.indexOf('korehan-section') >= 0 ? ' on' : '') + '">'
    + 'News <span class="tn-arr">&#9660;</span>'
    + '<div class="tn-drop">'
    + '<div class="tn-drop-label">Category</div>'
    + '<a href="korehan-all.html" class="tn-drop-item">All News</a>'
    + newsDrop
    + '</div>'
    + '</div>'
    + '<div class="tn-item has-drop' + (isOn('korehan-conversations') ? ' on' : '') + '">'
    + '&#x1F4AC; Conversations <span class="tn-new">New</span><span class="tn-arr" style="margin-left:3px">&#9660;</span>'
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
    + '&#x1F4D6; Stories <span class="tn-new">New</span><span class="tn-arr" style="margin-left:3px">&#9660;</span>'
    + '<div class="tn-drop">'
    + '<div class="tn-drop-label">Mood</div>'
    + '<a href="korehan-stories.html" class="tn-drop-item">All Stories</a>'
    + '<a href="korehan-stories.html?mood=fun" class="tn-drop-item">&#x1F602; Fun</a>'
    + '<a href="korehan-stories.html?mood=touching" class="tn-drop-item">&#x1F979; Touching</a>'
    + '<a href="korehan-stories.html?mood=scary" class="tn-drop-item">&#x1F631; Scary</a>'
    + '<a href="korehan-stories.html?mood=shocking" class="tn-drop-item">&#x1F62E; Shocking</a>'
    + '</div>'
    + '</div>'
    + '<a href="korehan-study-room.html" class="tn-item' + (isOn('korehan-study-room') ? ' on' : '') + '">&#x1F4D6; Study Room</a>'
    + '<a href="korehan-courses.html" class="tn-item' + (isOn('korehan-courses') ? ' on' : '') + '">&#x1F393; Courses</a>'
    + '<a href="korehan-all.html" class="tn-item' + (isOn('korehan-all') ? ' on' : '') + '">All News</a>'
    + '</div>'
    + '</div>';

  // ── Breaking ticker ───────────────────────────────────────────
  var ticker = (function() {
    var arts = getCachedArticles().filter(function(a){ return a.status === 'published'; });
    if (!arts.length) return '';
    var html = arts.slice(0,6).map(function(a){
      return '<span class="brk-item"><span class="brk-sep">&middot;</span><a href="korehan-article.html?id=' + a.id + '" style="color:#fff;text-decoration:none;">' + (a.title_ko || a.title || '') + '</a></span>';
    }).join('');
    return '<div class="brk-bar">'
      + '<div class="brk-label"><span class="brk-badge">&#9889;</span>&nbsp;Breaking</div>'
      + '<div class="brk-track-wrap"><div class="brk-track">' + html + html + '</div></div>'
      + '</div>';
  })();

  return logoBar + topnav + ticker;
}


function renderFooter() {
  var cfg = getSiteConfig();
  var siteName = cfg.siteName || DEFAULT_SITE_CONFIG.siteName;
  var footerDesc = cfg.footerDesc || DEFAULT_SITE_CONFIG.footerDesc;
  var siteTagline = cfg.siteTagline || DEFAULT_SITE_CONFIG.siteTagline;
  return '<footer class="kh-foot"><div class="kh-foot-inner">'
    + '<h3>' + escapeHtml(siteName) + '</h3>'
    + '<p>' + escapeHtml(footerDesc).replace(/\n/g, '<br>') + '</p>'
    + '<div class="footer-links">'
    + '<a href="index.html">Home</a>'
    + getSections().map(function(s){
        return '<a href="korehan-section.html?s=' + encodeURIComponent(s.key) + '">' + s.label + '</a>';
      }).join('')
    + '<a href="korehan-learn.html">✏️ Learn Korean</a>'
    + '<a href="korehan-all.html">All News</a>'
    + '</div>'
    + '</div>'
    + '<div class="footer-copy">© 2026 ' + escapeHtml(siteName) + ' · ' + escapeHtml(siteTagline) + '</div>'
    + '</footer>';
}

function renderSharedSidebar() {
  var all = published();
  var trendingHTML = all.slice(0, 6).map(function(a, i){
    return '<a href="' + articleUrl(a.id) + '" style="color:inherit;text-decoration:none;">'
      + '<div class="trending-item">'
      + '<div class="trending-num">' + (i+1) + '</div>'
      + '<p class="vocab-zone">' + a.title + '</p>'
      + '</div></a>';
  }).join('');

  // Word Bank - VOCAB에서 랜덤 6개
  var vocabKeys = Object.keys(VOCAB);
  var seed = Math.floor(Date.now() / 60000); // 1분마다 바뀜 (새로고침마다 랜덤)
  var shuffled = vocabKeys.slice().sort(function(a,b){
    return Math.sin(seed * a.charCodeAt(0)) - Math.sin(seed * b.charCodeAt(0));
  });
  var wbWords = shuffled.slice(0, 6).map(function(k){
    return { ko: k, rom: VOCAB[k].rom, en: VOCAB[k].en };
  });

  return '<div class="sidebar">'
    + '<div class="sidebar-box">'
    + '<div class="box-title">🔥 Most Read</div>'
    + trendingHTML
    + '</div>'

    + '<div class="sidebar-box">'
    + '<div class="box-title">🌤 Korea Weather</div>'
    + '<div style="font-size:13px;color:var(--gray);line-height:1.9">'
    + '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border)"><span>Seoul 서울</span><span>⛅ -3° / 6°C</span></div>'
    + '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border)"><span>Busan 부산</span><span>🌤 4° / 12°C</span></div>'
    + '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border)"><span>Incheon 인천</span><span>🌬 -4° / 5°C</span></div>'
    + '<div style="display:flex;justify-content:space-between;padding:4px 0"><span>Jeju 제주</span><span>🌧 8° / 13°C</span></div>'
    + '</div></div>'

    + '<div class="sidebar-box">'
    + '<div class="box-title">📚 Word Bank</div>'
    + wbWords.map(function(w){
        return '<div style="padding:7px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:baseline">'
          + '<span><span class="kh-word" data-word="' + w.ko + '" style="font-size:17px;font-weight:700;color:var(--accent)">' + w.ko + '</span>'
          + ' <span style="color:#889;font-style:italic;font-size:12px">' + w.rom + '</span></span>'
          + '<span style="font-size:13px;color:var(--gray)">' + w.en + '</span>'
          + '</div>';
      }).join('')
    + '</div>'

    + '<div class="sidebar-box">'
    + '<a href="korehan-learn.html" style="text-decoration:none;display:block;background:linear-gradient(135deg,#0b1626,#1a3a6b);border-radius:8px;padding:16px;color:#fff;text-align:center">'
    + '<div style="font-size:20px;margin-bottom:6px">✏️</div>'
    + '<div style="font-weight:700;font-size:14px;margin-bottom:4px">Learn Korean</div>'
    + '<div style="font-size:12px;color:rgba(255,255,255,0.6)">Flashcards · Quiz · Sentences</div>'
    + '</a></div>'
    + '</div>';
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
  { key:'IT과학', label:'Tech',      icon:'💻', sort_order:8 },
  { key:'Korea',  label:'🇰🇷 Korea', icon:'🇰🇷', sort_order:9 },
  { key:'오피니언',label:'Opinion',  icon:'✍️', sort_order:10 },
];

async function loadSections() {
  var sb = getSupa();
  if (!sb) { _sectionsCache = DEFAULT_SECTIONS; return; }
  try {
    var res = await sb.from('sections').select('*').eq('active', true).order('sort_order');
    _sectionsCache = (res.data && res.data.length) ? res.data : DEFAULT_SECTIONS;
  } catch(e) {
    _sectionsCache = DEFAULT_SECTIONS;
  }
  // 네비만 업데이트 - 헤더 전체 재렌더 하지 않음 (Sign In 이슈 방지)
  var topnav = document.querySelector('.kh-topnav');
  if (topnav) {
    // 섹션 링크만 교체
    var secLinks = _sectionsCache.slice(0,6).map(function(s){
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
}

function getApiKey() {
  // 메모리에서만 — localStorage 캐시 없음
  return _appSettings.anthropic_key || null;
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function() {
  var headerEl  = document.getElementById('kh-header');
  var footerEl  = document.getElementById('kh-footer');
  var sidebarEl = document.getElementById('kh-sidebar');

  if (headerEl)  headerEl.innerHTML  = renderHeader();
  if (footerEl)  footerEl.innerHTML  = renderFooter();
  if (sidebarEl) sidebarEl.innerHTML = renderSharedSidebar();
  applySiteConfigToPage();
  // 모바일 사이드바 CSS/overlay/nav 주입 (헤더 렌더 직후 실행)
  khInjectSidebar();
  // Attach hamburger click explicitly (fixes mobile inline-onclick issues)
  var hamBtn = headerEl && headerEl.querySelector('.kh-ham');
  if (hamBtn) {
    hamBtn.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); khSbOpen(); });
    hamBtn.addEventListener('touchend', function(e) { e.preventDefault(); khSbOpen(); });
  }

  // 세션 먼저 확인 후 나머지 로드 (로그인 상태가 헤더 렌더 전에 준비되도록)
  await checkSession();

  var page     = window.location.pathname.split('/').pop() || 'index.html';
  var pageBase = page.replace(/\.html$/, '');

  // Supabase에서 기사 + 섹션 먼저 로드 후 렌더링
  await Promise.all([loadArticlesFromDB(), loadSections(), loadAppSettings()]);

  if (footerEl) footerEl.innerHTML = renderFooter();
  applySiteConfigToPage();

  if (!pageBase || pageBase === 'index') {
    renderHomePage();
  } else if (pageBase === 'korehan-news')     { renderHomePage(); }
  else if (pageBase === 'korehan-all')     { renderAllPage(); }
  else if (pageBase === 'korehan-section')   {
    var sKey = (new URLSearchParams(window.location.search)).get('s') || '';
    await renderSectionPage(sKey);
  }
  else if (pageBase === 'korehan-korea')     { await renderSectionPage('Korea'); }
  else if (pageBase === 'korehan-society')   { await renderSectionPage('사회'); }
  else if (pageBase === 'korehan-world')     { await renderSectionPage('국제'); }
  else if (pageBase === 'korehan-culture')   { await renderSectionPage('문화'); }
  else if (pageBase === 'korehan-opinion')   { await renderSectionPage('오피니언'); }
  else if (pageBase === 'korehan-article')   { renderArticlePage(); }

  ttsInit();
  injectDailyMission();
  startClock();
  loadVocabFromDB().then(function(){ initTooltips(); });
});

// ── vocabulary_bank DB → VOCAB 병합 ───────────────────────
// 하드코딩 VOCAB에 DB 단어를 덮어쓰기 (DB 우선)
// ── 온보딩 체크 ────────────────────────────────────────────
var _onboardingChecked = false;
async function checkOnboardingStatus() {
  if (_onboardingChecked || !supaUser) return;
  _onboardingChecked = true;
  try {
    var sb = getSupa(); if (!sb) return;
    var res = await sb.from('user_stats')
      .select('onboarded, created_at')
      .eq('user_id', supaUser.id)
      .maybeSingle();

    // 기존 유저 (user_stats 레코드 있음) → onboarded 값 무관하게 통과
    if (res.data) return;

    // 레코드 자체가 없는 경우 → 가입 시각으로 신규 여부 판단
    // 가입 후 10분 이내면 신규 유저로 간주
    var createdAt = supaUser.created_at ? new Date(supaUser.created_at) : null;
    var isNew = createdAt && (Date.now() - createdAt.getTime() < 10 * 60 * 1000);

    if (isNew) {
      setTimeout(function() {
        window.location.href = 'korehan-onboarding.html';
      }, 600);
    }
    // 기존 유저인데 user_stats 없으면 그냥 통과 (기존 데이터 유지)
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
  } catch(e) { console.warn('loadVocabFromDB failed', e); }
}

// ══ BADGE ENGINE ══════════════════════════════════════════════════════════════
// 뱃지 정의 + 체크 + 알림 시스템
// 모든 뱃지는 id, cat, tier, icon, name, desc, check(stats) 구조

var K_BADGES = 'kh_earned_badges'; // { badgeId: { earnedAt: ISO } }
var K_XP     = 'kh_xp';           // number
var K_READ_SECTIONS = 'kh_read_sections'; // { sectionName: count }

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
  return streak;
}

function getSectionReadCounts() {
  // Supabase 없으면 localStorage 기반으로 섹션별 카운트
  return lsGet(K_READ_SECTIONS, {});
}

function getLastQuizPct() { return lsGet('kh_last_quiz_pct', 0); }
function getQuizPerfectCount() { return lsGet('kh_quiz_perfect_count', 0); }
function getQuizStreakDays() { return lsGet('kh_quiz_streak_days', 0); }

// ── 뱃지 정의 목록 ──────────────────────────────────────────────────────────
var BADGE_DEFS = [

  // 🔥 STREAK
  { id:'streak_3',   cat:'streak',    tier:'bronze',   icon:'🔥', name:'첫 불꽃',       desc:'3일 연속 학습',
    check: function(s){ return getCurrentStreak() >= 3; } },
  { id:'streak_7',   cat:'streak',    tier:'silver',   icon:'🔥', name:'일주일 전사',   desc:'7일 연속 학습',
    check: function(s){ return getCurrentStreak() >= 7; } },
  { id:'streak_30',  cat:'streak',    tier:'gold',     icon:'🏅', name:'30일의 힘',     desc:'30일 연속 학습',
    check: function(s){ return getCurrentStreak() >= 30; } },
  { id:'streak_50',  cat:'streak',    tier:'gold',     icon:'🌊', name:'50일 달성',     desc:'50일 연속 학습',
    check: function(s){ return getCurrentStreak() >= 50; } },
  { id:'streak_100', cat:'streak',    tier:'diamond',  icon:'💎', name:'100일 챔피언',  desc:'100일 연속 학습',
    check: function(s){ return getCurrentStreak() >= 100; } },
  { id:'streak_365', cat:'streak',    tier:'legendary',icon:'👑', name:'365 레전드',    desc:'1년 연속 학습',
    check: function(s){ return getCurrentStreak() >= 365; } },

  // 📰 READING
  { id:'read_1',     cat:'reading',   tier:'bronze',   icon:'📖', name:'첫 기사',       desc:'기사 첫 번째 읽기',
    check: function(){ return getTotalArticlesRead() >= 1; } },
  { id:'read_10',    cat:'reading',   tier:'bronze',   icon:'📰', name:'뉴스 입문',     desc:'기사 10개 읽기',
    check: function(){ return getTotalArticlesRead() >= 10; } },
  { id:'read_50',    cat:'reading',   tier:'silver',   icon:'📚', name:'뉴스 탐험가',   desc:'기사 50개 읽기',
    check: function(){ return getTotalArticlesRead() >= 50; } },
  { id:'read_100',   cat:'reading',   tier:'gold',     icon:'🗞️', name:'기자 지망생',   desc:'기사 100개 읽기',
    check: function(){ return getTotalArticlesRead() >= 100; } },
  { id:'read_500',   cat:'reading',   tier:'legendary',icon:'📜', name:'한국어 박사',   desc:'기사 500개 읽기',
    check: function(){ return getTotalArticlesRead() >= 500; } },
  { id:'read_daily10',cat:'reading',  tier:'gold',     icon:'⚡', name:'하루 10개',     desc:'하루에 기사 10개',
    check: function(){
      var log = lsGet('kh_read_log', {});
      return Object.values(log).some(function(arr){ return arr.length >= 10; });
    } },
  { id:'read_allsec',cat:'reading',   tier:'diamond',  icon:'🔭', name:'올라운더',      desc:'모든 섹션 읽기',
    check: function(){
      var sc = getSectionReadCounts();
      var secs = ['사회','국제','문화','스포츠','Korea','IT-과학','오피니언','정치','경제'];
      return secs.every(function(s){ return (sc[s]||0) >= 1; });
    } },

  // 🔖 VOCAB
  { id:'word_10',    cat:'vocab',     tier:'bronze',   icon:'🌱', name:'씨앗 단어장',   desc:'단어 10개 저장',
    check: function(){ return lsGet(K_SAVED,[]).length >= 10; } },
  { id:'word_50',    cat:'vocab',     tier:'silver',   icon:'🌿', name:'단어 새싹',     desc:'단어 50개 저장',
    check: function(){ return lsGet(K_SAVED,[]).length >= 50; } },
  { id:'word_100',   cat:'vocab',     tier:'silver',   icon:'🍃', name:'단어 수집가',   desc:'단어 100개 저장',
    check: function(){ return lsGet(K_SAVED,[]).length >= 100; } },
  { id:'word_300',   cat:'vocab',     tier:'gold',     icon:'🌳', name:'어휘 나무',     desc:'단어 300개 저장',
    check: function(){ return lsGet(K_SAVED,[]).length >= 300; } },
  { id:'word_1000',  cat:'vocab',     tier:'diamond',  icon:'💠', name:'TOPIK 단어장',  desc:'단어 1000개 저장',
    check: function(){ return lsGet(K_SAVED,[]).length >= 1000; } },
  { id:'word_2000',  cat:'vocab',     tier:'legendary',icon:'🧬', name:'어휘 유전자',   desc:'단어 2000개 저장',
    check: function(){ return lsGet(K_SAVED,[]).length >= 2000; } },

  // 📝 QUIZ
  { id:'quiz_first', cat:'quiz',      tier:'bronze',   icon:'🎮', name:'첫 퀴즈',       desc:'퀴즈 첫 도전',
    check: function(){ return lsGet('kh_quiz_done_count',0) >= 1; } },
  { id:'quiz_perfect1',cat:'quiz',    tier:'silver',   icon:'🎯', name:'데일리 퍼펙트', desc:'데일리 테스트 100점',
    check: function(){ return getQuizPerfectCount() >= 1; } },
  { id:'quiz_perfect3',cat:'quiz',    tier:'gold',     icon:'💯', name:'3연속 만점',    desc:'데일리 테스트 100점 3연속',
    check: function(){ return lsGet('kh_quiz_perfect_streak',0) >= 3; } },
  { id:'quiz_14days',cat:'quiz',      tier:'diamond',  icon:'📅', name:'데일리 개근',   desc:'14일 연속 데일리 테스트',
    check: function(){ return getQuizStreakDays() >= 14; } },

  // 🌍 SECTIONS (각 섹션 20개)
  { id:'sec_politics',cat:'sections', tier:'gold', icon:'🏛️', name:'정치 마스터', desc:'정치 기사 20개',
    check: function(){ return (getSectionReadCounts()['정치']||0) >= 20; } },
  { id:'sec_economy', cat:'sections', tier:'gold', icon:'💹', name:'경제 마스터', desc:'경제 기사 20개',
    check: function(){ return (getSectionReadCounts()['경제']||0) >= 20; } },
  { id:'sec_society', cat:'sections', tier:'gold', icon:'🏘️', name:'사회 마스터', desc:'사회 기사 20개',
    check: function(){ return (getSectionReadCounts()['사회']||0) >= 20; } },
  { id:'sec_world',   cat:'sections', tier:'gold', icon:'🌐', name:'국제 마스터', desc:'국제 기사 20개',
    check: function(){ return (getSectionReadCounts()['국제']||0) >= 20; } },
  { id:'sec_culture', cat:'sections', tier:'gold', icon:'🎨', name:'문화 마스터', desc:'문화 기사 20개',
    check: function(){ return (getSectionReadCounts()['문화']||0) >= 20; } },
  { id:'sec_sports',  cat:'sections', tier:'gold', icon:'⚽', name:'스포츠 마스터',desc:'스포츠 기사 20개',
    check: function(){ return (getSectionReadCounts()['스포츠']||0) >= 20; } },
  { id:'sec_korea',   cat:'sections', tier:'gold', icon:'🇰🇷', name:'Korea 마스터',desc:'Korea 기사 20개',
    check: function(){ return (getSectionReadCounts()['Korea']||0) >= 20; } },
  { id:'sec_it',      cat:'sections', tier:'gold', icon:'💻', name:'IT 마스터',   desc:'IT·과학 기사 20개',
    check: function(){ return (getSectionReadCounts()['IT-과학']||0) >= 20; } },
  { id:'sec_opinion', cat:'sections', tier:'gold', icon:'✍️', name:'오피니언 마스터',desc:'오피니언 기사 10개',
    check: function(){ return (getSectionReadCounts()['오피니언']||0) >= 10; } },

  // 🔢 MILESTONE / XP
  { id:'xp_500',     cat:'milestone', tier:'bronze',   icon:'⭐', name:'XP 500',     desc:'누적 XP 500',
    check: function(){ return getXP() >= 500; } },
  { id:'xp_2000',    cat:'milestone', tier:'silver',   icon:'💫', name:'XP 2,000',   desc:'누적 XP 2,000',
    check: function(){ return getXP() >= 2000; } },
  { id:'xp_5000',    cat:'milestone', tier:'gold',     icon:'🌠', name:'XP 5,000',   desc:'누적 XP 5,000',
    check: function(){ return getXP() >= 5000; } },
  { id:'xp_20000',   cat:'milestone', tier:'diamond',  icon:'🌌', name:'XP 20,000',  desc:'누적 XP 20,000',
    check: function(){ return getXP() >= 20000; } },
  { id:'days_90',    cat:'milestone', tier:'gold',     icon:'🎂', name:'3개월 완주',  desc:'가입 후 90일 학습',
    check: function(){
      var log = lsGet('kh_study_log',{});
      var active = Object.keys(log).filter(function(k){ var d=log[k]; return (d.articles||0)+(d.words||0)+(d.quiz||0)>0; });
      return active.length >= 90;
    } },

  // ⏰ TIME
  { id:'time_midnight',cat:'time',    tier:'silver',   icon:'🌙', name:'야행성',       desc:'자정 이후 학습',
    check: function(){ return lsGet('kh_badge_midnight', false); } },
  { id:'time_dawn',    cat:'time',    tier:'gold',     icon:'🌅', name:'새벽 공부왕',  desc:'오전 6시 전 학습',
    check: function(){ return lsGet('kh_badge_dawn', false); } },
  { id:'time_morning7',cat:'time',    tier:'bronze',   icon:'☀️', name:'모닝 루틴',    desc:'오전 7시 전 학습 7회',
    check: function(){ return lsGet('kh_morning_count',0) >= 7; } },
  { id:'time_monday',  cat:'time',    tier:'bronze',   icon:'📅', name:'월요병 극복',  desc:'월요일 학습 4주 연속',
    check: function(){ return lsGet('kh_monday_streak',0) >= 4; } },
  { id:'time_friday',  cat:'time',    tier:'silver',   icon:'🌃', name:'불금 학습자',  desc:'금요일 밤 학습 4회',
    check: function(){ return lsGet('kh_friday_night_count',0) >= 4; } },
  { id:'time_weekend', cat:'time',    tier:'gold',     icon:'🎒', name:'주말 학습왕',  desc:'주말 학습 8주 연속',
    check: function(){ return lsGet('kh_weekend_streak',0) >= 8; } },

  // 🎌 CULTURAL
  { id:'cult_march1',  cat:'cultural',tier:'gold',     icon:'🌸', name:'삼일절',       desc:'3월 1일 학습',
    check: function(){ return lsGet('kh_cult_march1', false); } },
  { id:'cult_hangul',  cat:'cultural',tier:'legendary',icon:'🇰🇷',name:'한글날 수호자',desc:'10월 9일 학습',
    check: function(){ return lsGet('kh_cult_hangul', false); } },
  { id:'cult_newyear', cat:'cultural',tier:'gold',     icon:'🎆', name:'새해 다짐',    desc:'1월 1일 학습',
    check: function(){ return lsGet('kh_cult_newyear', false); } },
  { id:'cult_chuseok', cat:'cultural',tier:'diamond',  icon:'🎑', name:'추석 학습',    desc:'추석 당일 학습',
    check: function(){ return lsGet('kh_cult_chuseok', false); } },
  { id:'cult_seollal', cat:'cultural',tier:'diamond',  icon:'🌕', name:'설날 공부',    desc:'설날 당일 학습',
    check: function(){ return lsGet('kh_cult_seollal', false); } },
  { id:'cult_gwangbok',cat:'cultural',tier:'silver',   icon:'🌊', name:'광복절',       desc:'8월 15일 학습',
    check: function(){ return lsGet('kh_cult_gwangbok', false); } },
  { id:'cult_pepero',  cat:'cultural',tier:'gold',     icon:'💘', name:'빼빼로 데이',  desc:'11월 11일 학습',
    check: function(){ return lsGet('kh_cult_pepero', false); } },
  { id:'cult_valentine',cat:'cultural',tier:'silver',  icon:'❤️', name:'발렌타인',     desc:'2월 14일 학습',
    check: function(){ return lsGet('kh_cult_valentine', false); } },
  { id:'cult_christmas',cat:'cultural',tier:'gold',    icon:'🎄', name:'크리스마스',   desc:'12월 25일 학습',
    check: function(){ return lsGet('kh_cult_christmas', false); } },
  { id:'cult_collector',cat:'cultural',tier:'legendary',icon:'🗓️',name:'공휴일 컬렉터',desc:'기념일 뱃지 7개',
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
      return { pct: cur/max*100, label: cur + ' / ' + max + '개' };
    }
    if (!map[b.id]) return null;
    var cur = map[b.id].cur();
    var max = map[b.id].max;
    return { pct: cur/max*100, label: cur + ' / ' + max };
  } catch(e) { return null; }
}

// ── 기사 읽을 때 자동으로 섹션 추적 + 시간 추적 + XP + 뱃지 체크 ─────────
async function trackActivityOnArticleRead(section) {
  checkCulturalDateBadges();
  if (section) trackSectionRead(section);
  addXP(XP_TABLE.article_read);
  checkBadges('article_read');
  await dmTrackArticle();
}

// ── 단어 저장 시 XP + 뱃지 ──────────────────────────────────────────────────
async function trackActivityOnWordSave() {
  addXP(XP_TABLE.word_saved);
  checkBadges('word_saved');
  await dmTrackWord();
}

// ── 퀴즈 완료 시 XP + 뱃지 ──────────────────────────────────────────────────
async function trackActivityOnQuizComplete(pct) {
  var isPerfect = pct === 100;
  addXP(isPerfect ? XP_TABLE.quiz_perfect : XP_TABLE.quiz_complete);

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
  return '<button class="tts-btn" title="발음 듣기" onclick="event.stopPropagation();ttsSpeak(\'' + safe + '\',this)">🔊</button>';
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
        toast('🎉 데일리 미션 ' + newStreak + '일 연속 완료! ✏️ 작문 첨삭권 1회 획득!');
      }, 800);
    } else {
      setTimeout(function() {
        toast('🎯 오늘 데일리 미션 완료! ' + newStreak + '일 연속 🔥');
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

function dmGet() {
  var key = 'kh_daily_' + dmToday();
  return lsGet(key, { articles:0, words:0, quizzes:0, fill:0 });
}

function dmSet(data) {
  var key = 'kh_daily_' + dmToday();
  lsSet(key, data);
  renderDailyMission(); // 위젯 즉시 업데이트
}

async function dmTrackArticle() {
  if (!supaUser) return;
  var d = dmGet(); d.articles = (d.articles||0) + 1; dmSet(d);
  await syncDailyMission('articles');
  await syncUserStats({ articles_read: true });
  awardXP('article_read', { source: 'article' });
  checkDailyMissionComplete();
}

async function dmTrackWord() {
  if (!supaUser) return;
  var d = dmGet(); d.words = (d.words||0) + 1; dmSet(d);
  await syncDailyMission('words');
  await syncUserStats({ words_saved: true });
  awardXP('word_save', {});
  checkDailyMissionComplete();
}

async function dmTrackQuiz() {
  if (!supaUser) return;
  var d = dmGet(); d.quizzes = (d.quizzes||0) + 1; dmSet(d);
  await syncDailyMission('quizzes');
  await syncUserStats({ quizzes_done: true });
  awardXP('conv_quiz_complete', {});
  checkDailyMissionComplete();
}

async function dmTrackFill() {
  if (!supaUser) return;
  var d = dmGet(); d.fill = Math.min((d.fill||0) + 1, 1); dmSet(d);
  await syncDailyMission('fill');
  await syncUserStats({ fill_done: true });
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
    if (res && res.ok) showToast('🎯 일일 미션 완료! +50 XP 보너스');
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
        + '<a href="korehan-section.html?s=tech" class="kh-sb-sub-a">&#x1F4BB; Tech</a>'
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
      + '<a href="korehan-courses.html" class="kh-sb-a' + (page==='korehan-courses.html'?' on':'') + '"><span class="kh-sb-ico">&#x1F393;</span>Courses</a>'
      + '<a href="korehan-mypage.html" class="kh-sb-a' + (page==='korehan-mypage.html'?' on':'') + '"><span class="kh-sb-ico">&#x1F464;</span>My Page</a>'
    + '</div>'
    + '<div class="kh-sb-sec" id="kh-sb-auth-sec" style="margin-top:auto;padding-top:12px;border-top:1px solid var(--border,#e2e8f0)">'
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
      '<div style="padding:10px 16px;font-size:13px;color:var(--gray,#445566)">'
      + '<div style="font-weight:800;color:var(--dark,#0d1b2e);margin-bottom:2px">' + name + '</div>'
      + '<div style="font-size:11px;opacity:.6">' + supaUser.email + '</div>'
      + '</div>'
      + '<a href="korehan-mypage.html" class="kh-sb-a" onclick="khSbClose()">'
      + '<span class="kh-sb-ico">&#x1F464;</span>My Page</a>'
      + '<button class="kh-sb-a" onclick="signOut();khSbClose()" style="width:100%;text-align:left;background:none;border:none;cursor:pointer;font-family:inherit">'
      + '<span class="kh-sb-ico">&#x1F6AA;</span>Sign Out</button>';
  } else {
    row.innerHTML =
      '<button class="kh-sb-a" onclick="openAuthModal(\'signin\');khSbClose()" style="width:100%;text-align:left;background:none;border:none;cursor:pointer;font-family:inherit">'
      + '<span class="kh-sb-ico">&#x1F511;</span>Sign In</button>'
      + '<button class="kh-sb-a" onclick="openAuthModal(\'signup\');khSbClose()" style="width:100%;text-align:left;background:none;border:none;cursor:pointer;font-family:inherit;color:var(--bright,#2255a4);font-weight:800">'
      + '<span class="kh-sb-ico">&#x2728;</span>Join Free</button>';
  }
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

async function renderHomeLearningPreview() {
  var box = document.getElementById('home-learning-preview');
  if (!box) return;

  // 비로그인 — 컴팩트
  if (!supaUser) {
    box.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">'
      + '<div style="font-size:13px;font-weight:800;color:var(--dark)">처음 오셨나요?</div>'
      + '<div style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;background:#eef4ff;color:var(--bright)">Start easy</div>'
      + '</div>'
      + '<div style="font-size:13px;color:var(--gray);line-height:1.55;margin-bottom:12px;">기사 읽기 → 문법 확인 → 퀴즈. 하루 5분으로 시작하세요.</div>'
      + '<a href="beginner-guide.html" style="display:inline-block;padding:8px 16px;background:var(--bright);color:#fff;border-radius:6px;font-size:12px;font-weight:800;text-decoration:none;">시작하기 →</a>';
    return;
  }

  // localStorage 기반 즉시 표시 (빠른 렌더)
  var dm = dmGet ? dmGet() : {};
  var xp = getXP ? getXP() : 0;
  var streak = getCurrentStreak ? getCurrentStreak() : 0;

  // weak grammar — localStorage 우선, DB에서 보강
  var weakGrammar = '-아/어서 vs -고';
  var weakCount = 0;
  try {
    var gStats = JSON.parse(localStorage.getItem('kh_quiz_grammar_stats') || '{}');
    var gEntries = Object.keys(gStats).map(function(k){
      return { name: k, wrong: gStats[k].wrong || 0, correct: gStats[k].correct || 0 };
    }).filter(function(g){ return g.wrong > 0; })
      .sort(function(a,b){ return b.wrong - a.wrong; });
    if (gEntries.length) {
      weakGrammar = gEntries[0].name;
      weakCount   = gEntries[0].wrong;
    }
  } catch(e) {}

  // DB에서 최신 데이터 비동기로 보강
  var sb = getSupa();
  if (sb && supaUser) {
    try {
      // user_stats
      var statsRes = await sb.from('user_stats').select('xp,mission_streak,streak,articles_read,words_saved,quizzes_done').eq('user_id', supaUser.id).maybeSingle();
      if (statsRes.data) {
        xp     = Math.max(xp,     statsRes.data.xp             || 0);
        streak = Math.max(streak, statsRes.data.mission_streak || statsRes.data.streak || 0);
        dm.articles = Math.max(dm.articles || 0, statsRes.data.articles_read || 0);
        dm.words    = Math.max(dm.words    || 0, Math.min(20, statsRes.data.words_saved || 0));
        dm.quizzes  = Math.max(dm.quizzes  || 0, statsRes.data.quizzes_done  || 0);
      }
      // weak grammar from DB
      var wgRes = await sb.from('user_grammar_stats')
        .select('grammar_point,wrong_count')
        .eq('user_id', supaUser.id)
        .gt('wrong_count', 0)
        .order('wrong_count', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (wgRes.data) {
        weakGrammar = wgRes.data.grammar_point;
        weakCount   = wgRes.data.wrong_count;
      }
    } catch(e) {}
  }

  var wordsLeft   = Math.max(0, 20 - (dm.words    || 0));
  var artGoalLeft = Math.max(0, 3  - (dm.articles || 0));
  var hasWeak = weakCount > 0;
  var weakQ = encodeURIComponent(weakGrammar);

  box.innerHTML =
    // streak 배지 + stats 한 줄
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">'
    + '<div style="font-size:12px;font-weight:800;color:var(--dark)">Today\'s Progress</div>'
    + '<div style="font-size:11px;font-weight:800;padding:3px 10px;border-radius:999px;background:#fff3e0;color:#c85000;">🔥 ' + streak + ' day streak</div>'
    + '</div>'
    + '<div style="display:flex;gap:6px;margin-bottom:12px;">'
    + '<div style="flex:1;background:#f7faff;border-radius:8px;padding:8px 10px;text-align:center;">'
    +   '<div style="font-size:16px;font-weight:900;color:var(--accent);">' + (dm.words||0) + '<span style="font-size:10px;color:var(--gray)">/20</span></div>'
    +   '<div style="font-size:10px;color:var(--gray);font-weight:700;">Words</div>'
    + '</div>'
    + '<div style="flex:1;background:#f7faff;border-radius:8px;padding:8px 10px;text-align:center;">'
    +   '<div style="font-size:16px;font-weight:900;color:var(--accent);">' + (dm.articles||0) + '<span style="font-size:10px;color:var(--gray)">/3</span></div>'
    +   '<div style="font-size:10px;color:var(--gray);font-weight:700;">Articles</div>'
    + '</div>'
    + '<div style="flex:1;background:#f7faff;border-radius:8px;padding:8px 10px;text-align:center;">'
    +   '<div style="font-size:16px;font-weight:900;color:var(--accent);">' + xp + '</div>'
    +   '<div style="font-size:10px;color:var(--gray);font-weight:700;">XP</div>'
    + '</div>'
    + '</div>'
    // weak grammar
    + '<div style="background:#fff8e1;border-radius:8px;padding:9px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;">'
    + '<div style="min-width:0;">'
    +   '<div style="font-size:10px;font-weight:800;color:' + (hasWeak?'#c85000':'#15803d') + ';margin-bottom:2px;">' + (hasWeak?'⚠️ Weak Grammar':'✅ Grammar') + '</div>'
    +   '<div style="font-size:13px;font-weight:800;color:#0b1626;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + weakGrammar + '</div>'
    + '</div>'
    + '<a href="korehan-study-room.html?focus=' + weakQ + '" style="flex-shrink:0;font-size:11px;font-weight:800;padding:5px 11px;background:var(--bright);color:#fff;border-radius:5px;text-decoration:none;white-space:nowrap;">연습 →</a>'
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
  if (!isMobileRedesign() || document.querySelector('.mobile-bottom-nav')) return;
  var page = pageName();
  var nav = document.createElement('nav');
  nav.className = 'mobile-bottom-nav';
  var items = [
    ['index.html','🏠','Home','index'],
    ['korehan-all.html','📰','News','korehan-all'],
    ['korehan-study-room.html','📘','Learn','korehan-study-room'],
    ['korehan-conversations.html','💬','CONVO','korehan-conversations'],
    ['korehan-mypage.html','👤','My','korehan-mypage']
  ];
  nav.innerHTML = items.map(function(it){
    return '<a href="'+it[0]+'" class="'+(page===it[3]?'on':'')+'"><span class="ico">'+it[1]+'</span><span>'+it[2]+'</span></a>';
  }).join('');
  document.body.appendChild(nav);
}

function mobileCreateCardHTML(label, value, href) {
  return '<a class="mobile-mini-card" href="'+href+'"><div class="label">'+label+'</div><div class="value">'+value+'</div></a>';
}

function enhanceHomeMobile() {
  if (!isMobileRedesign() || pageName() !== 'index') return;
  var container = document.querySelector('.container');
  if (!container || document.querySelector('.mobile-quick-start')) return;

  // Quick-start 섹션 제거 — phrase-dashboard에 이미 Writing/Hub 바로가기 있음
  // learn-strip만 최소화해서 유지
  var newsGrid = document.getElementById('dyn-news-grid');
  if (newsGrid && !document.querySelector('.mobile-learn-strip')) {
    var strip = document.createElement('section');
    strip.className = 'mobile-learn-strip';
    strip.innerHTML = ''
      + '<div class="mobile-eyebrow">바로가기</div>'
      + '<div class="mobile-cta-grid" style="grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px;">'
      + mobileCreateCardHTML('Conversations','Chat-style Korean','korehan-conversations.html')
      + mobileCreateCardHTML('Stories','Short stories','korehan-stories.html')
      + mobileCreateCardHTML('My Page','Progress & words','korehan-mypage.html')
      + '</div>';
    newsGrid.insertAdjacentElement('beforebegin', strip);
  }
}

function enhanceArticleMobile() {
  if (!isMobileRedesign() || pageName() !== 'korehan-article') return;
  var article = document.querySelector('.kh-article-wrap');
  if (!article || document.querySelector('.mobile-sticky-study')) return;

  var title = (document.querySelector('.art-title') || {}).textContent || 'This article';
  var header = article.querySelector('.art-header');
  if (header && !header.querySelector('.mobile-study-tabs')) {
    var tabs = document.createElement('div');
    tabs.className = 'mobile-study-tabs';
    tabs.innerHTML = ''
      + '<button class="on" data-target="read">Read</button>'
      + '<button data-target="grammar">Grammar</button>'
      + '<button data-target="vocab">Vocab</button>'
      + '<button data-target="quiz">Quiz</button>';
    header.insertAdjacentElement('afterend', tabs);

    var readTargets = [document.getElementById('art-tab-article'), document.querySelector('.art-hero-img')].filter(Boolean);
    var grammarTarget = document.getElementById('art-tab-grammar');
    var vocabTarget = document.querySelector('.art-vocab-box');
    var quizTarget = document.getElementById('fill-wrap');

    function showTab(name) {
      tabs.querySelectorAll('button').forEach(function(btn){ btn.classList.toggle('on', btn.getAttribute('data-target')===name); });
      readTargets.forEach(function(el){ el.classList.toggle('mobile-hidden', name !== 'read'); });
      if (grammarTarget) grammarTarget.classList.toggle('mobile-hidden', name !== 'grammar');
      if (vocabTarget) vocabTarget.classList.toggle('mobile-hidden', name !== 'vocab');
      if (quizTarget) quizTarget.classList.toggle('mobile-hidden', name !== 'quiz');
      if (name === 'grammar') loadGrammarGuide();
    }
    tabs.addEventListener('click', function(e){
      var btn = e.target.closest('button[data-target]');
      if (!btn) return;
      showTab(btn.getAttribute('data-target'));
    });
    showTab('read');
  }

  var sticky = document.createElement('div');
  sticky.className = 'mobile-sticky-study';
  sticky.innerHTML = '<a href="korehan-study-room.html">Study this article →</a>';
  document.body.appendChild(sticky);

  var lead = article.querySelector('.art-lead');
  if (lead && !article.querySelector('.mobile-tier-card')) {
    var card = document.createElement('section');
    card.className = 'mobile-tier-card';
    card.innerHTML = ''
      + '<div class="mobile-eyebrow">Article study</div>'
      + '<h3 style="font-size:24px;line-height:1.08;font-weight:900;color:#fff;margin:0 0 8px">Read first. Then review grammar and quiz.</h3>'
      + '<p class="mobile-quick-sub">Keep the reading flow simple on mobile. Open translation only when you need it, save a few words, then jump to review.</p>'
      + '<div class="mobile-action-row">'
      + '<a class="mobile-primary-btn" href="javascript:void(0)" onclick="toggleTranslate()">🌐 Toggle translation</a>'
      + '<a class="mobile-secondary-btn" href="korehan-study-room.html">✏️ Writing practice</a>'
      + '</div>';
    article.insertAdjacentElement('afterbegin', card);
  }
}

function enhanceConversationsMobile() {
  if (!isMobileRedesign() || pageName() !== 'korehan-conversations') return;
  var root = document.querySelector('.conv-page-container') || document.body;
  if (root && !document.querySelector('.mobile-section-shell[data-mobile="conv"]')) {
    var shell = document.createElement('section');
    shell.className = 'mobile-section-shell';
    shell.setAttribute('data-mobile','conv');
    shell.innerHTML = ''
      + '<div class="mobile-eyebrow">Conversation study</div>'
      + '<h2 class="mobile-quick-title" style="font-size:28px">Study chats the same way you actually text.</h2>'
      + '<p class="mobile-quick-sub">Open one conversation, read it like KakaoTalk, then check vocabulary, grammar, and roleplay practice.</p>'
      + '<div class="mobile-action-row">'
      + '<a class="mobile-primary-btn" href="korehan-conversations.html?cat=everyday">Everyday chats</a>'
      + '<a class="mobile-secondary-btn" href="korehan-conversations.html?cat=work">Workplace</a>'
      + '</div>';
    root.insertAdjacentElement('afterbegin', shell);
  }

  var observer = new MutationObserver(function(){
    var panel = document.querySelector('.detail-panel');
    if (!panel || panel.querySelector('.mobile-tier-card')) return;
    var leftHead = panel.querySelector('.dp-left-head');
    if (leftHead) {
      var box = document.createElement('div');
      box.className = 'mobile-tier-card';
      box.style.margin = '14px 24px 0';
      box.innerHTML = ''
        + '<div class="mobile-eyebrow">Study flow</div>'
        + '<h3 style="font-size:22px;line-height:1.08;font-weight:900;color:#fff;margin:0 0 8px">Read → Translate → Practice → Roleplay</h3>'
        + '<p class="mobile-quick-sub">Keep the conversation UI intact, then use the tools below to turn the chat into active speaking practice.</p>'
        + '<div class="mobile-action-row">'
        + '<a class="mobile-primary-btn" href="javascript:void(0)">💬 Roleplay</a>'
        + '<a class="mobile-secondary-btn" href="korehan-study-room.html">✏️ Practice</a>'
        + '</div>';
      leftHead.insertAdjacentElement('afterend', box);
    }
    var cta = panel.querySelector('.dp-cta-row');
    if (cta && !cta.dataset.mobileEnhanced) {
      cta.dataset.mobileEnhanced = '1';
      // 기존 버튼 유지 — 빈칸채우기/순서맞추기는 원래 버튼 그대로
      // grid를 2열로만 조정
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
      + '<a class="mobile-primary-btn" href="korehan-stories.html?mood=fun">😂 Fun stories</a>'
      + '<a class="mobile-secondary-btn" href="korehan-stories.html?mood=touching">🥹 Touching</a>'
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
        + '<a class="mobile-primary-btn" href="javascript:void(0)">📚 Vocabulary</a>'
        + '<a class="mobile-secondary-btn" href="korehan-study-room.html">💭 Discussion</a>'
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
        + '<a class="mobile-primary-btn" href="korehan-study-room.html">Start Learning</a>'
        + '<a class="mobile-secondary-btn" href="korehan-learn.html">Review vocab</a>'
        + '</div>';
      list.insertAdjacentElement('beforebegin', shell);
    }
  }
}

function runMobileRedesign() {
  markMobileBody();
  if (!isMobileRedesign()) return;
  injectMobileBottomNav();
  enhanceHomeMobile();
  enhanceCollectionPagesMobile();
  enhanceArticleMobile();
  enhanceConversationsMobile();
  enhanceStoriesMobile();
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
