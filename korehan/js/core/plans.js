/* ============================================================
   KoreHani — Plan system + access control + upgrade modal
   Extracted from korehan-shared.js (was lines 216-417).

   Free / Standard / Pro tier definitions, feature gating helpers,
   and the upgrade-prompt modal shown when a free user attempts a
   paid feature. Edit KH_PLANS to change features, prices, or plan
   names.

   External deps (resolved at runtime via global scope):
   - getSupa()           — from korehan-shared.js
   - supaUser            — from korehan-shared.js
   - window._isAdmin     — set by admin gate
   - KH_ICON_LOCK        — from js/core/icons.js
   ============================================================ */

// Free / Premium / Premium Live (2026-10). Free keeps all reading open;
// Premium is the study system, including Weekly Topic writing + its AI
// feedback (owner decision 2026-10-28 — free users can do the learning steps,
// not write). Premium Live ($27.99/mo, owner decision 2026-10-29) is
// everything in Premium + one live class every week with a seat included;
// Premium itself no longer includes live classes (the $5 seat is gone).
// Legacy 'standard' and 'pro' rows (manual grants) are treated as Premium.
var _KH_PREMIUM_FEATURES = {
  content_read: true, korean_alphabet: true, daily_slang_3: true,
  daily_review: true, express_writing: true, word_book_basic: true,
  xp_streak_badges: true, hover_vocab: true, writing_ai_feedback: true,
  article_study: true, conversation_study: true,
  slang_full: true, weekly_monthly_review: true, listening_quiz: true,
  growth_lab: true, word_book_srs: true, monthly_report: true,
  fast_track: true, phone_call: true, tutor_review: true,
  personal_recommendation: true, topik_full: true,
  writing_feedback: true, speaking_feedback: true, priority_feedback: true,
  speaking_practice: true
};
var KH_PLANS = {
  free: {
    name: 'Free', price: 0, label: 'Free',
    features: {
      content_read: true,       // Read all articles/conversations/stories (+ sentence analysis)
      korean_alphabet: true,    // Alphabet quiz
      daily_slang_3: true,      // Today's 3 slangs
      daily_review: true,       // Daily review (10 questions)
      word_book_basic: true,    // Word book — unlimited
      xp_streak_badges: true,   // Gamification
      hover_vocab: true,        // Hover tooltips
      growth_lab: true,         // Progress dashboard — never gated in the UI
      word_book_srs: true       // SRS review of saved words — never gated in the UI
      // everything else → Premium
    }
  },
  premium: {
    name: 'Premium', price: 8.99, priceYear: 69, label: '$8.99/mo',
    features: _KH_PREMIUM_FEATURES
  },
  premium_live: {
    name: 'Premium Live', price: 27.99, label: '$27.99/mo',   // monthly only
    features: Object.assign({}, _KH_PREMIUM_FEATURES, { live_class: true })
  }
};
KH_PLANS.standard = KH_PLANS.premium; // legacy manual grants
KH_PLANS.pro = KH_PLANS.premium;

function khNormalizePlan(plan) {
  if (plan === 'premium_live') return 'premium_live';
  return (plan === 'premium' || plan === 'standard' || plan === 'pro') ? 'premium' : 'free';
}

// Premium or Premium Live — every Premium feature. Use this instead of
// comparing getUserPlan() with 'premium'.
function khIsPremiumPlan(plan) {
  if (plan === undefined) plan = _userPlan;
  return plan === 'premium' || plan === 'premium_live';
}
// Live class seat included (Premium Live).
function khHasLive() { return _userPlan === 'premium_live'; }

// Which plan unlocks a given feature? Returns minimum plan name.
function featureMinPlan(feature) {
  if (KH_PLANS.free.features[feature]) return 'free';
  return KH_PLANS.premium.features[feature] ? 'premium' : 'premium_live';
}

// ── User plan state ──
var _userPlan = 'free';
var _userPlanLoaded = false;

function getUserPlan() { return _userPlan; }

function canAccess(feature) {
  if (window._isAdmin) return true;
  var plan = KH_PLANS[_userPlan];
  return plan && plan.features && plan.features[feature] === true;
}

// Check access and show upgrade modal if locked. Returns true if accessible.
function requirePlan(feature) {
  if (canAccess(feature)) return true;
  // Signed in but the plan hasn't loaded yet — don't show a Premium learner
  // the upgrade modal; ask them to tap again in a moment.
  if (typeof supaUser !== 'undefined' && supaUser && !_userPlanLoaded) {
    if (!_userPlanPromise) loadUserPlan();
    if (typeof toast === 'function') toast('Checking your plan… tap again in a second.');
    return false;
  }
  var minPlan = featureMinPlan(feature);
  showUpgradeModal(feature, minPlan);
  return false;
}

// Load user plan from DB (called after auth). Fires 'kh-plan-loaded' so
// pages can re-render plan-dependent UI (live class card, pricing CTA).
var _userPlanPromise = null;
function loadUserPlan() {
  if (_userPlanPromise) return _userPlanPromise;
  _userPlanPromise = _loadUserPlanInner().then(function() {
    _userPlanPromise = null;
    try { window.dispatchEvent(new CustomEvent('kh-plan-loaded', { detail: { plan: _userPlan } })); } catch(_) {}
  });
  return _userPlanPromise;
}
async function _loadUserPlanInner() {
  if (!supaUser) { _userPlan = 'free'; _userPlanLoaded = true; return; }
  try {
    var sb = getSupa(); if (!sb) return;
    var { data } = await sb.from('user_subscriptions')
      .select('plan, status, expires_at')
      .eq('user_id', supaUser.id)
      .maybeSingle();
    if (data && data.status === 'active') {
      // Check expiry
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        _userPlan = 'free'; // Expired
      } else {
        _userPlan = khNormalizePlan(data.plan);
      }
    } else {
      _userPlan = 'free';
    }
  } catch(e) {
    console.warn('[Plan] load failed:', e);
    _userPlan = 'free';
  }
  _userPlanLoaded = true;
  // Update UI badges if any
  _updatePlanBadges();
}

function _updatePlanBadges() {
  document.querySelectorAll('[data-plan-badge]').forEach(function(el) {
    var plan = _userPlan;
    el.textContent = plan === 'free' ? '' : 'PREMIUM';
    el.style.display = plan === 'free' ? 'none' : '';
  });
  // Update lock icons on gated elements
  document.querySelectorAll('[data-gate]').forEach(function(el) {
    var feature = el.dataset.gate;
    var locked = !canAccess(feature);
    // Remove existing lock badge
    var existing = el.querySelector('.kh-lock-badge');
    if (existing) existing.remove();
    if (locked) {
      el.style.position = 'relative';
      var badge = document.createElement('div');
      badge.className = 'kh-lock-badge';
      badge.innerHTML = '<span style="display:inline-flex;width:14px;height:14px">' + KH_ICON_LOCK + '</span>';
      badge.style.cssText = 'position:absolute;top:8px;right:8px;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-size:12px;z-index:2;backdrop-filter:blur(4px)';
      el.appendChild(badge);
    }
  });
}

// ── Upgrade Modal ──
// Upgrade sheet (mockup E, 2026-10-28): a feature-specific preview, not a
// wall — what it is, a small sample, what Premium adds, and a button that
// goes straight to checkout. No free trial (owner: new accounts would get
// it again).
var KH_FEATURE_COPY = {
  article_study:   { t: 'Turn today’s news into a lesson', d: 'Four short steps on a real article at your level — about 10 minutes.', steps: ['Words', 'Phrases', 'Read', 'Quiz'], ko: '태양광이 원자력을 <u>제치고</u> 가장 빠르게 성장하고 있어요.', en: '제치다 = to overtake' },
  conversation_study: { t: 'Role-play real conversations', d: 'You play one speaker: pick the reply that fits, then see why the others don\'t.', steps: ['Listen', 'Expressions', 'Role-play'], ko: '혹시 이 근처에 <u>약국</u> 있어요?', en: 'Is there a pharmacy near here?' },
  express_writing: { t: 'Write it, get it corrected', d: 'One short piece a week on the topic you studied, with instant AI feedback and a tutor review.', steps: ['Frames', 'Write', 'AI feedback', 'Tutor'], ko: '저는 아침에 커피를 <u>마시면서</u> 뉴스를 읽어요.', en: 'Line-by-line corrections on your own sentences' },
  fast_track:      { t: 'Practice real situations', d: 'Cafe, taxi, hospital and more — choose what to say and hear how it sounds.', steps: ['Listen', 'Choose', 'Say it'], ko: '<u>아이스 아메리카노</u> 한 잔 주세요.', en: 'One iced americano, please.' },
  phone_call:      { t: 'Get through a real phone call', d: 'Role-play calls with natural replies.', steps: ['Listen', 'Reply', 'Review'], ko: '<u>예약</u>을 바꾸고 싶은데요.', en: 'I’d like to change my reservation.' },
  listening_quiz:  { t: 'Train your ear', d: 'Hear a sentence, pick the meaning.', steps: ['Listen', 'Choose'], ko: '오늘 <u>날씨</u>가 정말 좋네요.', en: 'The weather is really nice today.' },
  weekly_monthly_review: { t: 'Review the whole week', d: 'A timed review of everything you studied, every week and month.', steps: ['Words', 'Grammar', 'Score'] },
  slang_full:      { t: 'The full slang library', d: 'Every slang term with chats and a quiz — not just today’s three.' },
  tutor_review:    { t: 'A tutor reads your writing', d: 'Personal notes from a KoreHani tutor on your weekly writing.' },
  live_class:      { t: 'A live class every week', d: 'Premium Live includes a seat in one live class every week: Sunday 21:00 KST on Zoom, 60 min, 8 learners. Book or cancel until 1 hour before.', steps: ['Read the week', 'Book a seat', 'Join on Zoom'] },
  monthly_report:  { t: 'Your monthly report', d: 'Your month in reading, words and grammar.' },
  topik_full:      { t: 'Every TOPIK practice test', d: 'Full timed tests in the TOPIK format with an estimated level and your weak question types. Test 1 and the weekly mini test stay free.', steps: ['Timed test', 'Level', 'Weak types'] }
};
var KH_PREMIUM_PERKS = ['Article & Conversation Study every day', 'Weekly writing with AI feedback + tutor review', 'Fast Track, listening quiz, weekly review'];
var KH_LIVE_SWITCH_NOTE = 'Your Premium subscription switches to Premium Live ($27.99/month) right away. Stripe credits the unused part of your current plan and adjusts your next invoice.';
var KH_LIVE_PERKS = ['Everything in Premium', 'A live class every week, seat included', 'Small group: 8 learners, Sunday 21:00 KST on Zoom'];

// Straight to Stripe Checkout (signed-in), with a clear message otherwise.
// plan 'live' = Premium Live (monthly only). A Premium subscriber asking for
// Live is switched in place by billing (prorated) — no second checkout.
async function khStartCheckout(interval, plan) {
  if (typeof supaUser === 'undefined' || !supaUser) { if (typeof openAuthModal === 'function') openAuthModal('signup'); return; }
  var live = plan === 'live';
  var planName = live ? 'Premium Live' : 'Premium';
  if (live && khIsPremiumPlan() && typeof khConfirm === 'function') {
    var sheet = document.getElementById('kh-upgrade-modal'); if (sheet) sheet.remove();   // the confirm sits below the sheet
    var go = await khConfirm('Switch to Premium Live?', KH_LIVE_SWITCH_NOTE, { okLabel: 'Switch · ' + KH_PLANS.premium_live.label, cancelLabel: 'Not now' });
    if (!go) return;
  }
  var btn = document.getElementById('kh-up-cta');
  var btnLabel = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Opening secure checkout…'; }
  var msg = 'Checkout could not be started. Please try again in a moment.';
  try {
    var sb = getSupa();
    var sess = sb ? await sb.auth.getSession() : null;
    var token = sess && sess.data && sess.data.session && sess.data.session.access_token;
    var r = await fetch(SUPA_URL + '/functions/v1/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'apikey': SUPA_KEY },
      body: JSON.stringify({ action: 'checkout', plan: live ? 'live' : 'premium', interval: (!live && interval === 'year') ? 'year' : 'month' })
    });
    var res = await r.json().catch(function(){ return {}; });
    if (res && res.ok && res.url) { location.href = res.url; return; }
    if (res && res.ok && res.upgraded) {
      var m = document.getElementById('kh-upgrade-modal'); if (m) m.remove();
      if (typeof toast === 'function') toast('You are on Premium Live now. Your weekly seat is ready to book.', 'success');
      khRefreshPlanSoon();
      return;
    }
    if (res && res.error === 'already_subscribed') msg = 'You already have ' + planName + ' — it can take a few seconds to show up. Try reloading the page.';
    if (res && res.error === 'billing_not_configured') msg = 'Payments are being set up — please check back soon, or email han@korehani.com.';
  } catch (_) {}
  if (btn) { btn.disabled = false; btn.textContent = btnLabel; }
  if (typeof khAlert === 'function') khAlert(planName, msg, { okLabel: 'OK' }); else alert(msg);
}

// After a plan change the webhook may land a few seconds later: re-read the
// plan every 2 s for up to 30 s (each load fires 'kh-plan-loaded').
function khRefreshPlanSoon(want) {
  var started = Date.now();
  want = want || 'premium_live';
  (function tick() {
    _userPlanPromise = null;
    loadUserPlan().then(function() {
      if (_userPlan !== want && Date.now() - started < 30000) setTimeout(tick, 2000);
    });
  })();
}

function showUpgradeModal(feature, minPlan) {
  var existing = document.getElementById('kh-upgrade-modal');
  if (existing) existing.remove();
  var esc = function(t){ return String(t == null ? '' : t).replace(/[&<>"]/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; }); };
  var names = {
    article_study: 'Article Study', conversation_study: 'Conversation Role-play', express_writing: 'Weekly Writing',
    slang_full: 'Slang Library', weekly_monthly_review: 'Weekly & Monthly Review', listening_quiz: 'Listening Quiz',
    tutor_review: 'Tutor Review', live_class: 'Live Class', fast_track: 'Fast Track', phone_call: 'Phone Call',
    monthly_report: 'Monthly Report', speaking_feedback: 'Speaking Feedback', speaking_practice: 'Speaking Practice', priority_feedback: 'Priority Feedback',
    personal_recommendation: 'Study Plan', writing_feedback: 'Writing Feedback', topik_full: 'TOPIK Practice'
  };
  var isLive = minPlan === 'premium_live';
  var planName = isLive ? 'Premium Live' : 'Premium';
  var c = KH_FEATURE_COPY[feature] || { t: (names[feature] || 'This feature') + ' is part of ' + planName, d: 'Premium is the full study system around the free reading.' };
  var price = (KH_PLANS[minPlan] || KH_PLANS.premium).label;
  var perks = isLive ? KH_LIVE_PERKS : KH_PREMIUM_PERKS;
  var ctaLabel = isLive ? (khIsPremiumPlan() ? 'Upgrade · ' : 'Get Premium Live · ') + price : 'Get Premium · ' + price;
  if (!document.getElementById('kh-up-style')) {
    var st = document.createElement('style');
    st.id = 'kh-up-style';
    st.textContent = '#kh-upgrade-modal{position:fixed;inset:0;z-index:10060;background:rgba(5,10,25,.6);display:flex;align-items:flex-end;justify-content:center;animation:suFadeIn .15s}'
      + '#kh-upgrade-modal .up{width:100%;max-width:480px;background:#101d3f;color:#e2e8f0;border-radius:24px 24px 0 0;border-top:1px solid rgba(255,255,255,.12);padding:16px 18px calc(22px + env(safe-area-inset-bottom));font-family:"DM Sans","Noto Sans KR",sans-serif;max-height:92vh;overflow-y:auto}'
      + '@media(min-width:640px){#kh-upgrade-modal{align-items:center}#kh-upgrade-modal .up{border-radius:24px;border:1px solid rgba(255,255,255,.12)}}'
      + '#kh-upgrade-modal .grab{width:38px;height:4px;border-radius:9px;background:rgba(255,255,255,.2);margin:0 auto 14px}'
      + '#kh-upgrade-modal .eb{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#c4b5fd;font-weight:800}'
      + '#kh-upgrade-modal h3{font-size:20px;font-weight:800;color:#fff;margin:4px 0}'
      + '#kh-upgrade-modal .d{font-size:13px;color:rgba(255,255,255,.62);line-height:1.5;margin:0}'
      + '#kh-upgrade-modal .pv{margin:14px 0 6px;padding:12px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1)}'
      + '#kh-upgrade-modal .steps{display:flex;gap:6px}#kh-upgrade-modal .steps span{flex:1;text-align:center;font-size:10.5px;font-weight:700;padding:7px 2px;border-radius:9px;background:rgba(124,58,237,.18);color:#ddd6fe}#kh-upgrade-modal .steps span:first-child{background:#7c3aed;color:#fff}'
      + '#kh-upgrade-modal .ex{margin-top:10px;font-family:"Noto Sans KR",sans-serif;font-size:14px;color:#fff;line-height:1.6}'
      + '#kh-upgrade-modal .ex u{text-decoration:none;background:rgba(250,204,21,.18);color:#fde68a;padding:0 3px;border-radius:4px}'
      + '#kh-upgrade-modal .ex small{display:block;font-family:"DM Sans",sans-serif;font-size:11.5px;color:rgba(255,255,255,.45);margin-top:2px}'
      + '#kh-upgrade-modal .li{display:flex;gap:8px;font-size:13px;color:#e2e8f0;margin:8px 0 0}#kh-upgrade-modal .li svg{width:15px;height:15px;color:#6ee7b7;flex-shrink:0;margin-top:2px}'
      + '#kh-upgrade-modal .cta{display:block;width:100%;margin-top:16px;padding:14px;border:0;border-radius:14px;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;font:inherit;font-weight:800;font-size:15px;cursor:pointer}'
      + '#kh-upgrade-modal .cta:disabled{opacity:.7;cursor:default}'
      + '#kh-upgrade-modal .fine{text-align:center;font-size:11.5px;color:rgba(255,255,255,.45);margin-top:8px}#kh-upgrade-modal .fine a{color:#93c5fd}'
      + '#kh-upgrade-modal .later{display:block;margin:10px auto 0;border:0;background:none;color:rgba(255,255,255,.62);font:inherit;font-size:13px;font-weight:700;cursor:pointer;padding:6px 12px}';
    document.head.appendChild(st);
  }
  var check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  var ov = document.createElement('div');
  ov.id = 'kh-upgrade-modal';
  ov.onclick = function(e) { if (e.target === ov) ov.remove(); };
  ov.innerHTML = '<div class="up" role="dialog" aria-modal="true" aria-label="' + planName + '">'
    + '<div class="grab"></div>'
    + '<div class="eb">' + planName + ' · ' + esc(names[feature] || 'Feature') + '</div>'
    + '<h3>' + esc(c.t) + '</h3><p class="d">' + esc(c.d) + '</p>'
    + ((c.steps || c.ko) ? '<div class="pv">'
        + (c.steps ? '<div class="steps">' + c.steps.map(function(x){ return '<span>' + esc(x) + '</span>'; }).join('') + '</div>' : '')
        + (c.ko ? '<div class="ex">' + c.ko + (c.en ? '<small>' + esc(c.en) + '</small>' : '') + '</div>' : '')   // c.ko is our own markup (<u>)
        + '</div>' : '')
    + perks.map(function(p){ return '<div class="li">' + check + '<span>' + esc(p) + '</span></div>'; }).join('')
    + '<button type="button" class="cta" id="kh-up-cta" onclick="khStartCheckout(\'month\'' + (isLive ? ',\'live\'' : '') + ')">' + esc(ctaLabel) + '</button>'
    + '<div class="fine">' + (isLive ? 'Monthly' : 'Monthly or yearly') + ' · cancel anytime · <a href="korehan-courses.html">See all features</a></div>'
    + '<button type="button" class="later" onclick="this.closest(\'#kh-upgrade-modal\').remove()">Maybe later</button>'
    + '</div>';
  document.body.appendChild(ov);
}
