/* ============================================================
   KoreHani — Daily Mission Engine
   Extracted from korehan-shared.js (was lines 7950-8208).

   Tracks daily study activity (articles read / words saved /
   quizzes / fill-in-the-blank), computes streaks from local
   logs, syncs user preferences and stats to Supabase, and
   renders / injects the floating daily-mission widget.

   External deps (resolved at runtime via global scope):
   - getSupa(), supaUser            — from korehan-shared.js
   - lsGet, lsSet                   — from js/core/storage.js
   - pageName()                     — from korehan-shared.js
   - K_XP, K_NEON_THEME             — from korehan-shared.js
   - isKhNeonEnabled, applyKhNeon   — from korehan-shared.js
   - _activeDiff, khSetDiff         — from korehan-shared.js
   - khTrack                        — from js/core/analytics.js
   - maybeShowStreakMilestone       — from js/features/streak.js
   ============================================================ */

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
  var page = pageName();
  // Skip on fullscreen game pages
  if (page.indexOf('korehan-fun-') === 0) return;
  // Skip on study room — the daily mission widget competes for screen
  // space with the in-room missions and was reported as distracting.
  if (page === 'korehan-study-room') return;
  if (document.getElementById('kh-daily-mission')) return;
  var el = document.createElement('div');
  el.id = 'kh-daily-mission';
  el.style.display = 'none';
  document.body.appendChild(el);
  renderDailyMission();
}
