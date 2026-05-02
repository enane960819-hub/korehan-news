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

var KH_PLANS = {
  free: {
    name: 'Free', price: 0, label: 'Free Plan',
    features: {
      content_read: true,       // Read all articles/conversations/stories
      korean_alphabet: true,    // Alphabet quiz
      daily_slang_3: true,      // Today's 3 slangs
      daily_review: true,       // Daily review (10 questions)
      express_writing: true,    // Write (no feedback)
      word_book_basic: true,    // Save up to 30 words
      xp_streak_badges: true,   // Gamification
      hover_vocab: true,        // Hover tooltips
      // Locked:
      article_study: false,
      conversation_study: false,
      story_study: false,
      slang_full: false,
      weekly_monthly_review: false,
      listening_quiz: false,
      writing_feedback: false,
      growth_lab: false,
      word_book_srs: false,
      fast_track: false,
      phone_call: false,
      speaking_feedback: false,
      priority_feedback: false,
      personal_recommendation: false,
      monthly_report: false
    }
  },
  standard: {
    name: 'Standard', price: 8.99, label: '$8.99/mo',
    features: {
      content_read: true, korean_alphabet: true, daily_slang_3: true,
      daily_review: true, express_writing: true, word_book_basic: true,
      xp_streak_badges: true, hover_vocab: true,
      // Standard unlocks:
      article_study: true,
      conversation_study: true,
      story_study: true,
      slang_full: true,
      weekly_monthly_review: true,
      listening_quiz: true,
      writing_feedback: true,
      growth_lab: true,
      word_book_srs: true,
      monthly_report: true,
      // Locked (Pro only):
      fast_track: false,
      phone_call: false,
      speaking_feedback: false,
      priority_feedback: false,
      personal_recommendation: false
    }
  },
  pro: {
    name: 'Pro', price: 24.99, label: '$24.99/mo',
    features: {
      content_read: true, korean_alphabet: true, daily_slang_3: true,
      daily_review: true, express_writing: true, word_book_basic: true,
      xp_streak_badges: true, hover_vocab: true,
      article_study: true, conversation_study: true, story_study: true,
      slang_full: true, weekly_monthly_review: true, listening_quiz: true,
      writing_feedback: true, growth_lab: true, word_book_srs: true,
      monthly_report: true,
      // Pro unlocks:
      fast_track: true,
      phone_call: true,
      speaking_feedback: true,
      priority_feedback: true,
      personal_recommendation: true
    }
  }
};

// Which plan unlocks a given feature? Returns minimum plan name.
function featureMinPlan(feature) {
  if (KH_PLANS.free.features[feature]) return 'free';
  if (KH_PLANS.standard.features[feature]) return 'standard';
  return 'pro';
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
  var minPlan = featureMinPlan(feature);
  showUpgradeModal(feature, minPlan);
  return false;
}

// Load user plan from DB (called after auth)
async function loadUserPlan() {
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
        _userPlan = data.plan || 'free';
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
    el.textContent = plan === 'free' ? '' : (plan === 'pro' ? 'PRO' : 'STD');
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
function showUpgradeModal(feature, minPlan) {
  var existing = document.getElementById('kh-upgrade-modal');
  if (existing) existing.remove();

  var featureNames = {
    article_study: 'Article Study (5 Steps)',
    conversation_study: 'Conversation Study',
    story_study: 'Story Study',
    slang_full: 'Full Slang Library + Quiz',
    weekly_monthly_review: 'Weekly & Monthly Review',
    listening_quiz: 'Listening Quiz',
    writing_feedback: 'Writing Feedback',
    growth_lab: 'Growth Lab',
    word_book_srs: 'SRS Review',
    fast_track: 'Fast Track',
    phone_call: 'Phone Call Practice',
    speaking_feedback: 'Speaking Feedback',
    monthly_report: 'Monthly Progress Report',
    priority_feedback: 'Priority Feedback',
    personal_recommendation: 'Personalized Study Plan'
  };

  var fName = featureNames[feature] || feature;
  var planInfo = KH_PLANS[minPlan] || KH_PLANS.standard;

  var ov = document.createElement('div');
  ov.id = 'kh-upgrade-modal';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:suFadeIn .2s';
  ov.onclick = function(e) { if (e.target === ov) ov.remove(); };

  ov.innerHTML = '<div style="background:#fff;border-radius:20px;max-width:400px;width:100%;padding:32px 28px;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,.2)">'
    + '<div style="width:56px;height:56px;border-radius:16px;background:#faf5ff;display:flex;align-items:center;justify-content:center;color:#7c3aed;margin:0 auto 16px"><span style="display:inline-flex;width:30px;height:30px">' + KH_ICON_LOCK + '</span></div>'
    + '<div style="font-size:20px;font-weight:900;color:#0f172a;margin-bottom:6px">' + planInfo.name + ' Plan Required</div>'
    + '<div style="font-size:14px;color:#64748b;margin-bottom:20px;line-height:1.5"><b>' + fName + '</b> is available on the ' + planInfo.name + ' plan and above.</div>'
    + '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px">'
    + '<a href="korehan-courses.html" style="padding:14px 28px;border-radius:14px;border:none;background:#7c3aed;color:#fff;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;text-decoration:none;display:block;box-shadow:0 4px 14px rgba(124,58,237,.25)">View Plans — from ' + planInfo.label + '</a>'
    + '<button onclick="this.closest(\'#kh-upgrade-modal\').remove()" style="padding:12px;border-radius:12px;border:1.5px solid #e2e8f0;background:#fff;color:#64748b;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Maybe Later</button>'
    + '</div>'
    + '<div style="font-size:11px;color:#94a3b8">Cancel anytime · No commitment</div>'
    + '</div>';

  document.body.appendChild(ov);
}
