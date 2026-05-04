/* ============================================================
   KoreHani — Per-user session + event tracking
   Logged-in users only. Anonymous traffic is covered by
   js/core/analytics.js (Plausible, cookieless aggregate).

   On boot: if the user is authenticated AND has accepted "Accept
   all" cookies, we open a row in user_sessions, heartbeat every
   30s while the tab is visible, and finalize ended_at on
   pagehide. khTrackUser('event_name', {props}) inserts into
   user_events for fine-grained interactions.

   No-op (silently skip) when:
   - cookie consent !== 'all'
   - user is not signed in
   - on legal / admin / onboarding pages
   - getSupa() is not available

   Schema lives in supabase/migrations/20260504_user_analytics.sql.
   ============================================================ */

(function() {
  'use strict';

  var SESSION_KEY = 'kh_session_id';            // sessionStorage — survives reloads in the same tab
  var SESSION_BORN_KEY = 'kh_session_born';     // marker so we don't double-insert on quick reloads
  var HEARTBEAT_MS = 30 * 1000;
  var SESSION_LIFETIME_MS = 6 * 60 * 60 * 1000; // 6h hard cap — anything longer is a new session

  var _sessionId = null;
  var _userId = null;
  var _heartbeatTimer = null;
  var _bootDone = false;
  var _ended = false;
  var _eventQueue = []; // events fired before session lands

  function _shouldSkip() {
    var p = (location.pathname || '').toLowerCase();
    if (p.indexOf('privacy-policy')   !== -1) return true;
    if (p.indexOf('terms-of-service') !== -1) return true;
    if (p.indexOf('refund-policy')    !== -1) return true;
    if (p.indexOf('korehan-x9f4k2m7') !== -1) return true; // admin
    if (p.indexOf('korehan-onboarding') !== -1) return true;
    return false;
  }
  function _consentOK() {
    try { return localStorage.getItem('kh_cookie_consent') === 'all'; }
    catch(_) { return false; }
  }

  function _detectDevice() {
    var ua = navigator.userAgent || '';
    var device = 'desktop';
    if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) device = 'tablet';
    else if (/Mobile|iPhone|iPod|Android.*Mobile|BlackBerry|IEMobile/i.test(ua)) device = 'mobile';

    var os = 'Other';
    if (/iPhone|iPad|iPod/.test(ua))      os = 'iOS';
    else if (/Android/.test(ua))           os = 'Android';
    else if (/Windows NT/.test(ua))        os = 'Windows';
    else if (/Mac OS X/.test(ua))          os = 'macOS';
    else if (/Linux/.test(ua))             os = 'Linux';

    var browser = 'Other';
    if (/Edg\//.test(ua))                  browser = 'Edge';
    else if (/OPR\/|Opera/.test(ua))       browser = 'Opera';
    else if (/SamsungBrowser/.test(ua))    browser = 'Samsung';
    else if (/Chrome\//.test(ua))          browser = 'Chrome';
    else if (/Safari\//.test(ua))          browser = 'Safari';
    else if (/Firefox\//.test(ua))         browser = 'Firefox';

    return { device_type: device, os: os, browser: browser, user_agent: ua.slice(0, 500) };
  }

  function _parseUtm() {
    try {
      var p = new URLSearchParams(location.search);
      return {
        utm_source:   p.get('utm_source')   || null,
        utm_medium:   p.get('utm_medium')   || null,
        utm_campaign: p.get('utm_campaign') || null,
      };
    } catch(_) { return {}; }
  }

  // Country comes from a Cloudflare Pages Function or page-level inject
  // (sets window._khCountry to the 2-letter ISO from request.cf.country
  // or the CF-IPCountry header). Without that hook this stays null and
  // we just fill it in later when the function ships.
  function _getCountry() { return window._khCountry || null; }

  function _sessionExpired() {
    try {
      var born = parseInt(sessionStorage.getItem(SESSION_BORN_KEY), 10);
      if (!born) return true;
      return (Date.now() - born) > SESSION_LIFETIME_MS;
    } catch(_) { return true; }
  }

  async function _openSession(userId) {
    var sb = (typeof getSupa === 'function') ? getSupa() : null;
    if (!sb || !userId) return null;

    // Reuse existing session for this tab unless it's aged out.
    try {
      var existing = sessionStorage.getItem(SESSION_KEY);
      if (existing && !_sessionExpired()) {
        _sessionId = existing;
        return _sessionId;
      }
    } catch(_) {}

    var dev = _detectDevice();
    var utm = _parseUtm();
    var insert = {
      user_id: userId,
      device_type: dev.device_type,
      os: dev.os,
      browser: dev.browser,
      user_agent: dev.user_agent,
      screen_w:   (screen && screen.width)  || null,
      screen_h:   (screen && screen.height) || null,
      viewport_w: window.innerWidth  || null,
      viewport_h: window.innerHeight || null,
      language:   navigator.language || null,
      timezone:   (function(){ try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch(_) { return null; } })(),
      country:    _getCountry(),
      referrer:   document.referrer ? document.referrer.slice(0, 500) : null,
      landing_path: (location.pathname + location.search).slice(0, 500),
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
    };

    try {
      var res = await sb.from('user_sessions').insert(insert).select('id').single();
      if (res.error) {
        // First-run case: table doesn't exist yet (migration not applied).
        // Silently disable — owner runs the migration and it self-heals on
        // the next page load. Don't spam console for known harmless errors.
        if (!/relation .* does not exist|schema.*user_sessions/i.test(res.error.message || '')) {
          console.warn('[user-analytics] session insert failed', res.error);
        }
        return null;
      }
      _sessionId = res.data.id;
      try {
        sessionStorage.setItem(SESSION_KEY, _sessionId);
        sessionStorage.setItem(SESSION_BORN_KEY, String(Date.now()));
      } catch(_) {}
      return _sessionId;
    } catch(e) {
      console.warn('[user-analytics] session start error', e);
      return null;
    }
  }

  async function _heartbeat() {
    if (_ended || !_sessionId || !_userId) return;
    if (typeof document !== 'undefined' && document.hidden) return; // tab hidden — pause
    var sb = (typeof getSupa === 'function') ? getSupa() : null;
    if (!sb) return;
    try {
      await sb.from('user_sessions')
        .update({ last_heartbeat_at: new Date().toISOString() })
        .eq('id', _sessionId)
        .eq('user_id', _userId);
    } catch(_) {}
  }

  function _endSession() {
    if (_ended || !_sessionId || !_userId) return;
    _ended = true;
    var sb = (typeof getSupa === 'function') ? getSupa() : null;
    if (!sb) return;
    // Best-effort — Supabase JS client doesn't go through navigator.sendBeacon,
    // so this may fail to reach the server during a hard tab close. The
    // server-side duration query falls back to last_heartbeat_at when
    // ended_at is null, so we still get a reasonable number either way.
    try {
      sb.from('user_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', _sessionId)
        .eq('user_id', _userId);
    } catch(_) {}
  }

  // Public tracker — fire-and-forget. Queues events that fire before the
  // session row settles, then flushes them in order.
  window.khTrackUser = function(eventName, props) {
    if (!eventName) return;
    if (!_bootDone || _ended) {
      _eventQueue.push({ event: String(eventName), props: props || {} });
      return;
    }
    if (!_sessionId || !_userId) return;
    var sb = (typeof getSupa === 'function') ? getSupa() : null;
    if (!sb) return;
    try {
      sb.from('user_events').insert({
        user_id: _userId,
        session_id: _sessionId,
        event: String(eventName),
        props: props || {},
        page_path: (location.pathname + location.search).slice(0, 500),
      });
    } catch(_) {}
  };

  function _flushQueue() {
    if (!_sessionId || !_userId) { _eventQueue.length = 0; return; }
    var sb = (typeof getSupa === 'function') ? getSupa() : null;
    if (!sb) return;
    var rows = _eventQueue.map(function(e) {
      return {
        user_id: _userId,
        session_id: _sessionId,
        event: e.event,
        props: e.props || {},
        page_path: (location.pathname + location.search).slice(0, 500),
      };
    });
    _eventQueue.length = 0;
    if (!rows.length) return;
    try { sb.from('user_events').insert(rows); } catch(_) {}
  }

  async function _boot() {
    if (_bootDone) return;
    if (_shouldSkip()) { _bootDone = true; return; }
    if (!_consentOK())  { _bootDone = true; return; }
    if (typeof getSupa !== 'function') { _bootDone = true; return; }
    var sb = getSupa();
    if (!sb) { _bootDone = true; return; }

    try {
      var res = await sb.auth.getUser();
      var u = res && res.data && res.data.user;
      if (!u) { _bootDone = true; return; }
      _userId = u.id;
    } catch(_) { _bootDone = true; return; }

    await _openSession(_userId);
    _bootDone = true;
    if (!_sessionId) return;

    // Initial page view + flush anything queued during the auth round-trip.
    window.khTrackUser('page_view', { ref: document.referrer || null });
    _flushQueue();

    _heartbeatTimer = setInterval(_heartbeat, HEARTBEAT_MS);

    // pagehide is more reliable than beforeunload on mobile (iOS won't
    // fire beforeunload when you swipe to home). Both feed the same
    // best-effort end signal.
    window.addEventListener('pagehide', _endSession);
    window.addEventListener('beforeunload', _endSession);

    // Resume heartbeat the moment the tab returns from background so
    // duration metrics stay accurate for users who tab-switch a lot.
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden && !_ended) _heartbeat();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot();
  }

  // Re-run boot if the user signs in mid-session (the consent banner →
  // sign-in flow is a common path). We listen on the bridge that
  // korehan-shared.js fires after auth state changes.
  try {
    document.addEventListener('kh-auth-changed', function() {
      if (!_bootDone) return;
      if (_sessionId) return;
      _bootDone = false;
      _boot();
    });
  } catch(_) {}
})();
