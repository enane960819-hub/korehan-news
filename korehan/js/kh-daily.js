/* kh-daily.js — TTS, daily mission, user stats sync */
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
    // 3) User preferences (difficulty, neon theme) from user_stats.preferences JSONB
    var prefRes = await sb.from('user_stats').select('preferences').eq('user_id', supaUser.id).maybeSingle();
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
  if (opts.grantXP !== false) awardXP('article_read', { source: 'article' });
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


