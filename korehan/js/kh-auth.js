/* kh-auth.js — Authentication (login/signup/session/OAuth) */
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
      _syncSavedWordsFromDB();
      _rehydrateUserState();
      window.dispatchEvent(new Event('kh-auth-signed-in'));
      // Re-apply UI update after a short delay to catch any late-rendered DOM elements
      setTimeout(function(){ updateAuthUI(); }, 300);
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
    _syncSavedWordsFromDB();
    _rehydrateUserState();
    window.dispatchEvent(new Event('kh-auth-signed-in'));
    if (!window.location.pathname.includes('onboarding')) {
      checkOnboardingStatus();
    }
  }
  window._sessionChecked = true;
  updateAuthUI();
}

// UI 업데이트
function updateAuthUI() {
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
