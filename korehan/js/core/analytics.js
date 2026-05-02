/* ============================================================
   KoreHani — Analytics, error monitoring, and cookie consent
   Extracted from korehan-shared.js (was lines 5-153).

   Loads Plausible Analytics (cookieless by design — Plausible itself
   doesn't need a consent banner) and Sentry error monitoring. Both
   are gated behind config flags — set them on window before this file
   loads, or paste them here and redeploy. Without DSN/domain set the
   loaders no-op, so this is safe to ship empty until accounts are
   created.

     <script>
       window.KH_PLAUSIBLE_DOMAIN = 'korehannews.com';
       window.KH_SENTRY_DSN = 'https://xxxx@oXXX.ingest.sentry.io/YYY';
     </script>

   We still gate analytics behind the user's cookie-consent choice
   (see kh_cookie_consent below) because Korean PIPA / GDPR treat any
   non-essential measurement as requiring opt-in even when the tool
   itself is cookie-free. Plausible loads only after consent === 'all'.

   After Plausible loads, `window.plausible('event-name', { props: {...} })`
   works. We expose `khTrack(name, props)` as a thin wrapper that
   silently no-ops when Plausible hasn't loaded — so call sites don't
   need to defensive-check.
   ============================================================ */

function _khConsent() {
  try { return localStorage.getItem('kh_cookie_consent') || ''; } catch(_) { return ''; }
}
function _khLoadAnalytics() {
  if (window._khAnalyticsLoaded) return;
  window._khAnalyticsLoaded = true;
  var PLAUSIBLE_DOMAIN = (typeof window !== 'undefined' && window.KH_PLAUSIBLE_DOMAIN) || '';
  var SENTRY_DSN       = (typeof window !== 'undefined' && window.KH_SENTRY_DSN) || '';

  if (PLAUSIBLE_DOMAIN) {
    try {
      var s = document.createElement('script');
      s.defer = true;
      s.setAttribute('data-domain', PLAUSIBLE_DOMAIN);
      s.src = 'https://plausible.io/js/script.outbound-links.js';
      document.head.appendChild(s);
      window.plausible = window.plausible || function(){
        (window.plausible.q = window.plausible.q || []).push(arguments);
      };
    } catch(_) {}
  }

  if (SENTRY_DSN) {
    try {
      var s2 = document.createElement('script');
      s2.src = 'https://browser.sentry-cdn.com/7.119.0/bundle.min.js';
      s2.crossOrigin = 'anonymous';
      s2.onload = function() {
        try {
          if (window.Sentry) window.Sentry.init({
            dsn: SENTRY_DSN,
            tracesSampleRate: 0.1,
            beforeSend: function(event) {
              if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return null;
              return event;
            }
          });
        } catch(_) {}
      };
      document.head.appendChild(s2);
    } catch(_) {}
  }
}
(function bootstrapAnalytics() {
  if (_khConsent() === 'all') _khLoadAnalytics();
})();

// Cookie / tracking consent banner. Shown once until the user picks
// "Accept all" or "Essential only". Stored in localStorage so the
// choice persists. Korean PIPA + GDPR require affirmative opt-in for
// non-essential measurement; this banner satisfies both regimes
// without geo-detection by being shown to everyone.
function _khShowCookieBanner() {
  if (_khConsent()) return;                          // already chose
  if (document.getElementById('kh-cookie-banner')) return;

  var el = document.createElement('div');
  el.id = 'kh-cookie-banner';
  el.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2000;'
    + 'max-width:min(720px,calc(100vw - 24px));width:auto;'
    + 'background:#0b1626;color:#fff;border:1px solid rgba(125,211,252,.25);'
    + 'border-radius:14px;box-shadow:0 14px 40px rgba(0,0,0,.45);'
    + 'padding:16px 18px;display:flex;align-items:center;gap:14px;'
    + 'font-family:inherit;flex-wrap:wrap;animation:khNudgeIn .3s ease-out';
  // Avoid colliding with mobile bottom nav.
  if (window.innerWidth <= 860) el.style.bottom = '76px';

  el.innerHTML = ''
    + '<div style="flex:1;min-width:240px">'
    + '<div style="font-size:13px;font-weight:800;color:#fff;margin-bottom:4px">Cookies &amp; Privacy</div>'
    + '<div style="font-size:12px;color:rgba(255,255,255,.7);line-height:1.5">'
    +   'We use essential cookies to keep you signed in and remember your progress. '
    +   'With your consent we also load privacy-friendly analytics to understand which lessons help. '
    +   '<a href="privacy-policy.html" style="color:#7dd3fc;text-decoration:underline">Privacy policy</a>'
    + '</div></div>'
    + '<div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap">'
    + '<button id="kh-cookie-essential" style="padding:9px 14px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.18);color:rgba(255,255,255,.85);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">Essential only</button>'
    + '<button id="kh-cookie-all" style="padding:9px 16px;border-radius:10px;background:linear-gradient(135deg,#38bdf8,#2563eb);border:none;color:#fff;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap">Accept all</button>'
    + '</div>';

  if (!document.getElementById('kh-nudge-style')) {
    var style = document.createElement('style');
    style.id = 'kh-nudge-style';
    style.textContent = '@keyframes khNudgeIn{from{opacity:0;transform:translate(-50%,16px)}to{opacity:1;transform:translate(-50%,0)}}';
    document.head.appendChild(style);
  }

  document.body.appendChild(el);

  function pick(choice) {
    try { localStorage.setItem('kh_cookie_consent', choice); } catch(_) {}
    el.remove();
    if (choice === 'all') _khLoadAnalytics();
  }
  document.getElementById('kh-cookie-all').onclick       = function(){ pick('all'); };
  document.getElementById('kh-cookie-essential').onclick = function(){ pick('essential'); };
}
// Don't show on legal pages (the user is already reading our policy
// — interrupting with a banner is rude) or admin pages.
(function() {
  function init() {
    var path = (location.pathname || '').toLowerCase();
    if (path.indexOf('privacy-policy') !== -1) return;
    if (path.indexOf('terms-of-service') !== -1) return;
    if (path.indexOf('refund-policy')   !== -1) return;
    if (path.indexOf('korehan-x9f4k2m7') !== -1) return;
    if (path.indexOf('korehan-onboarding') !== -1) return;
    // Defer slightly so it doesn't fight with onboarding redirects /
    // welcome banner mounting.
    setTimeout(_khShowCookieBanner, 1200);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// Convenience tracker. Call sites use khTrack('signup_started') etc.
// without worrying about whether Plausible has loaded yet.
function khTrack(eventName, props) {
  try {
    if (typeof window !== 'undefined' && typeof window.plausible === 'function') {
      window.plausible(eventName, props ? { props: props } : undefined);
    }
  } catch(_) {}
}
