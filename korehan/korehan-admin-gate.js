// Admin auth gate for the auxiliary admin pages — phrases / errors /
// schema / hover-vocab. The MAIN admin file (korehan-x9f4k2m7.html)
// embeds the same gate inline. These auxiliary pages historically had
// NO gate, so any signed-in user who guessed the obscured URL could
// click Delete / Save / regenerate buttons — UX-level access.
// Server-side RLS on the underlying tables is the real defence; this
// gate hides the buttons so they can never be clicked client-side.
//
// Load this script BEFORE any page-specific logic. It replaces
// document.body with an "Admin Access Only" screen synchronously on
// the localStorage check, so DOMContentLoaded handlers that try to
// query DB tables still fire but their target elements are gone.
(function () {
  var ADMIN_EMAIL = 'enane960819@gmail.com';
  var SUPA_URL = 'https://samghztrdvtxmrmawneu.supabase.co';
  var SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWdoenRyZHZ0eG1ybWF3bmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzQ3NTIsImV4cCI6MjA4ODAxMDc1Mn0.UCt6Z76XTmJGbhHdX744tM8BKDdVhqRiCLuQi6w-rNs';

  function blockAccess(reason) {
    if (!document.body) {
      // <head> is still parsing — defer until body exists.
      document.addEventListener('DOMContentLoaded', function () { blockAccess(reason); });
      return;
    }
    document.body.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0b1220;font-family:sans-serif">'
      + '<div style="text-align:center;color:#fff;padding:40px;max-width:360px">'
      + '<div style="font-size:56px;margin-bottom:16px">🔒</div>'
      + '<div style="font-size:20px;font-weight:900;margin-bottom:8px">Admin Access Only</div>'
      + '<div style="font-size:13px;color:#7a9ac0;margin-bottom:24px">' + (reason || 'This page is restricted.') + '</div>'
      + '<a href="index.html" style="padding:10px 24px;background:#2255a4;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">← Back to Home</a>'
      + '</div></div>';
    window._adminGateBlocked = true;
  }

  // 1차: localStorage 토큰으로 빠른 체크 (페이지 깜빡임 방지)
  function getStoredEmail() {
    try {
      var keys = Object.keys(localStorage);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].indexOf('sb-') === 0 && keys[i].indexOf('-auth-token') !== -1) {
          var val = JSON.parse(localStorage.getItem(keys[i]));
          if (val && val.user && val.user.email) return val.user.email;
        }
      }
    } catch (_) {}
    return null;
  }

  var storedEmail = getStoredEmail();
  if (!storedEmail || storedEmail !== ADMIN_EMAIL) {
    blockAccess('You are not signed in as admin.');
    return;
  }

  // 2차: Supabase SDK로 세션 실시간 검증 — localStorage 가 조작된 경우 잡아냄.
  // Supabase JS가 로드된 후에 실행되어야 하므로 DOMContentLoaded 에 위임.
  document.addEventListener('DOMContentLoaded', function () {
    if (!window.supabase) return;
    var sb;
    try { sb = window.supabase.createClient(SUPA_URL, SUPA_KEY); } catch (_) { return; }
    if (!sb) return;
    sb.auth.getSession().then(function (r) {
      var email = r && r.data && r.data.session && r.data.session.user && r.data.session.user.email;
      if (!email || email !== ADMIN_EMAIL) blockAccess('Session invalid or not admin.');
    });
    sb.auth.onAuthStateChange(function (event, session) {
      var email = session && session.user && session.user.email;
      if (event === 'SIGNED_OUT' || !email || email !== ADMIN_EMAIL) {
        blockAccess('Signed out.');
      }
    });
  });
})();
