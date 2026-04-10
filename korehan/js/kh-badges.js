/* kh-badges.js — XP system + badge engine */
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
  word_save: 2,
  conv_quiz_complete: 20,
  fill_complete: 5,
  daily_mission_complete: 50,
  story_read: 10,
  conversation_read: 10,
  weekly_review_complete: 200,
  monthly_review_complete: 700
};
var _COIN_ACTION_AMOUNTS = {
  article_read: 3,
  word_save: 1,
  conv_quiz_complete: 5,
  fill_complete: 2,
  daily_mission_complete: 12,
  weekly_review_complete: 200,
  monthly_review_complete: 700,
  story_read: 3,
  conversation_read: 3
};
var _XP_ACTION_LABELS = {
  article_read: 'Read Article',
  word_save: 'Save Word',
  conv_quiz_complete: 'Quiz Complete',
  fill_complete: 'Fill in the Blank',
  daily_mission_complete: 'Daily Mission Complete',
  story_read: 'Read Story',
  conversation_read: 'Read Conversation'
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

async function awardXP(actionKey, meta) {
  if (!supaUser) return null;
  var sb = getSupa(); if (!sb) return null;

  var amount    = _XP_ACTION_AMOUNTS[actionKey] || 10;
  var coinAmt   = _COIN_ACTION_AMOUNTS[actionKey] || 0;
  var reason    = _XP_ACTION_LABELS[actionKey] || actionKey;
  var contentId = (meta && (meta.content_id || meta.article_id)) || null;

  // Try RPC first
  try {
    var res = await sb.rpc('award_xp', {
      p_user_id: supaUser.id,
      p_action:  actionKey,
      p_meta:    meta || {}
    });
    if (res.data && res.data.ok) {
      if (res.data.leveled_up) {
        showToast('🎉 Level Up! Lv.' + res.data.level + ' ' + res.data.level_name);
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
  el.textContent = '+' + _coinToastTotal + '냥 🐾';
  el.style.opacity = '1';
  _coinToastTimer = setTimeout(function(){
    el.style.opacity = '0';
    setTimeout(function(){ _coinToastTotal = 0; }, 300);
  }, 1800);
}

async function saveVocabToDB(word, rom, en, isDelete) {
  var sb = getSupa();
  if (!sb) throw new Error('Supabase not connected');
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

function getStreakFreezes() { return lsGet('kh_streak_freezes', 1); }
function useStreakFreeze() {
  var f = getStreakFreezes();
  if (f > 0) { lsSet('kh_streak_freezes', f - 1); return true; }
  return false;
}
function addStreakFreeze(n) { lsSet('kh_streak_freezes', getStreakFreezes() + (n||1)); }
function getUsedFreezes() { return lsGet('kh_used_freezes', {}); }

function getCurrentStreak() {
  var log = lsGet('kh_study_log', {});
  var days = lsGet('kh_study_days', {});
  var usedFreezes = getUsedFreezes();
  var allDays = Object.assign({}, days);
  Object.keys(log).forEach(function(k){
    var d = log[k];
    if ((d.articles||0) + (d.words||0) + (d.quiz||0) > 0) allDays[k] = true;
  });
  var streak = 0;
  var freezesUsed = 0;
  var d = new Date();
  for (var i = 0; i < 400; i++) {
    var key = d.toISOString().slice(0,10);
    if (allDays[key]) { streak++; d.setDate(d.getDate()-1); }
    else if (i === 0) { d.setDate(d.getDate()-1); } // 오늘 아직 안 했어도 어제부터
    else if (usedFreezes[key]) { streak++; d.setDate(d.getDate()-1); } // 프리즈 사용된 날
    else {
      // Try auto-use freeze for yesterday gap
      var avail = getStreakFreezes();
      if (avail > 0 && i <= 2 && streak > 0) {
        useStreakFreeze();
        var uf = getUsedFreezes(); uf[key] = true; lsSet('kh_used_freezes', uf);
        streak++; d.setDate(d.getDate()-1);
      } else { break; }
    }
  }
  return Math.max(streak, lsGet('kh_synced_activity_streak', 0));
}

function getSectionReadCounts() {
  // Supabase 없으면 localStorage 기반으로 섹션별 카운트
  return lsGet(K_READ_SECTIONS, {});
}

function getLastQuizPct() { return lsGet('kh_last_quiz_pct', 0); }
function getQuizPerfectCount() { return lsGet('kh_quiz_perfect_count', 0); }
function getQuizStreakDays() { return lsGet('kh_quiz_streak_days', 0); }

// ── 뱃지 정의 목록 ──────────────────────────────────────────────────────────
// Uses _PX pixel art icons defined in korehan-shared.js
// Fallback: if _PX not loaded yet, define pxBadge as no-op
if (typeof _PX === 'undefined') var _PX = {};
if (typeof pxBadge !== 'function') { var pxBadge = function(n){ return (_PX && _PX[n]) || ''; }; }
var BADGE_DEFS = [

  // 🔥 STREAK
  { id:'streak_3',   cat:'streak',    tier:'bronze',   icon:pxBadge('fire'), name:'First Spark',      desc:'3-day study streak',
    check: function(s){ return getCurrentStreak() >= 3; } },
  { id:'streak_7',   cat:'streak',    tier:'silver',   icon:pxBadge('fire'), name:'Week Warrior',    desc:'7-day study streak',
    check: function(s){ return getCurrentStreak() >= 7; } },
  { id:'streak_30',  cat:'streak',    tier:'gold',     icon:pxBadge('trophy'), name:'30-Day Power',    desc:'30-day study streak',
    check: function(s){ return getCurrentStreak() >= 30; } },
  { id:'streak_50',  cat:'streak',    tier:'gold',     icon:pxBadge('shield'), name:'50-Day Milestone', desc:'50-day study streak',
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
      var secs = ['사회','국제','문화','스포츠','Korea','beauty','travel','오피니언','정치','경제'];
      return secs.every(function(s){ return (sc[s]||0) >= 1; });
    } },

  // 🔖 VOCAB
  { id:'word_10',    cat:'vocab',     tier:'bronze',   icon:pxBadge('sparkle'), name:'Seed Vocab',      desc:'Save 10 words',
    check: function(){ return lsGet(K_SAVED,[]).length >= 10; } },
  { id:'word_50',    cat:'vocab',     tier:'silver',   icon:pxBadge('book'), name:'Word Sprout',     desc:'Save 50 words',
    check: function(){ return lsGet(K_SAVED,[]).length >= 50; } },
  { id:'word_100',   cat:'vocab',     tier:'silver',   icon:pxBadge('scroll'), name:'Word Collector',  desc:'Save 100 words',
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
  { id:'quiz_perfect3',cat:'quiz',    tier:'gold',     icon:pxBadge('sparkle'), name:'3x Perfect',      desc:'Score 100% on 3 daily tests in a row',
    check: function(){ return lsGet('kh_quiz_perfect_streak',0) >= 3; } },
  { id:'quiz_14days',cat:'quiz',      tier:'diamond',  icon:pxBadge('clock'), name:'Daily Devotee',   desc:'Complete daily tests 14 days in a row',
    check: function(){ return getQuizStreakDays() >= 14; } },

  // 🌍 SECTIONS
  { id:'sec_politics',cat:'sections', tier:'gold', icon:pxBadge('shield'), name:'Politics Master', desc:'Read 20 Politics articles',
    check: function(){ return (getSectionReadCounts()['정치']||0) >= 20; } },
  { id:'sec_economy', cat:'sections', tier:'gold', icon:pxBadge('coin'), name:'Economy Master', desc:'Read 20 Economy articles',
    check: function(){ return (getSectionReadCounts()['경제']||0) >= 20; } },
  { id:'sec_society', cat:'sections', tier:'gold', icon:pxBadge('heart'), name:'Society Master', desc:'Read 20 Society articles',
    check: function(){ return (getSectionReadCounts()['사회']||0) >= 20; } },
  { id:'sec_world',   cat:'sections', tier:'gold', icon:pxBadge('scroll'), name:'World Master', desc:'Read 20 World articles',
    check: function(){ return (getSectionReadCounts()['국제']||0) >= 20; } },
  { id:'sec_culture', cat:'sections', tier:'gold', icon:pxBadge('sparkle'), name:'Culture Master', desc:'Read 20 Culture articles',
    check: function(){ return (getSectionReadCounts()['문화']||0) >= 20; } },
  { id:'sec_sports',  cat:'sections', tier:'gold', icon:pxBadge('trophy'), name:'Sports Master',desc:'Read 20 Sports articles',
    check: function(){ return (getSectionReadCounts()['스포츠']||0) >= 20; } },
  { id:'sec_korea',   cat:'sections', tier:'gold', icon:pxBadge('gift'), name:'Korea Master',desc:'Read 20 Korea articles',
    check: function(){ return (getSectionReadCounts()['Korea']||0) >= 20; } },
  { id:'sec_beauty',  cat:'sections', tier:'gold', icon:pxBadge('sparkle'), name:'Beauty Master',desc:'Read 20 Beauty articles',
    check: function(){ return (getSectionReadCounts()['beauty']||0) >= 20; } },
  { id:'sec_travel',  cat:'sections', tier:'gold', icon:pxBadge('scroll'), name:'Travel Master',desc:'Read 20 Travel articles',
    check: function(){ return (getSectionReadCounts()['travel']||0) >= 20; } },
  { id:'sec_opinion', cat:'sections', tier:'gold', icon:pxBadge('note'), name:'Opinion Master',desc:'Read 10 Opinion articles',
    check: function(){ return (getSectionReadCounts()['오피니언']||0) >= 10; } },

  // 🔢 MILESTONE / XP
  { id:'xp_7500',    cat:'milestone', tier:'bronze',   icon:pxBadge('star'), name:'XP 7,500',    desc:'Earn 7,500 XP total',
    check: function(){ return getXP() >= 7500; } },
  { id:'xp_30000',   cat:'milestone', tier:'silver',   icon:pxBadge('sparkle'), name:'XP 30,000',   desc:'Earn 30,000 XP total',
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
  { id:'time_dawn',    cat:'time',    tier:'gold',     icon:pxBadge('sparkle'), name:'Dawn Scholar',   desc:'Study before 6 AM',
    check: function(){ return lsGet('kh_badge_dawn', false); } },
  { id:'time_morning7',cat:'time',    tier:'bronze',   icon:pxBadge('zap'), name:'Morning Routine', desc:'Study before 7 AM, 7 times',
    check: function(){ return lsGet('kh_morning_count',0) >= 7; } },
  { id:'time_monday',  cat:'time',    tier:'bronze',   icon:pxBadge('clock'), name:'Monday Fighter',  desc:'Study on Mondays, 4 weeks in a row',
    check: function(){ return lsGet('kh_monday_streak',0) >= 4; } },
  { id:'time_friday',  cat:'time',    tier:'silver',   icon:pxBadge('sparkle'), name:'Friday Learner',  desc:'Study on Friday night, 4 times',
    check: function(){ return lsGet('kh_friday_night_count',0) >= 4; } },
  { id:'time_weekend', cat:'time',    tier:'gold',     icon:pxBadge('trophy'), name:'Weekend Champ',   desc:'Study on weekends, 8 weeks in a row',
    check: function(){ return lsGet('kh_weekend_streak',0) >= 8; } },

  // 🎌 CULTURAL
  { id:'cult_march1',  cat:'cultural',tier:'gold',     icon:pxBadge('heart'), name:'March 1st',       desc:'Study on March 1 (Independence Day)',
    check: function(){ return lsGet('kh_cult_march1', false); } },
  { id:'cult_hangul',  cat:'cultural',tier:'legendary',icon:pxBadge('gift'),name:'Hangul Guardian', desc:'Study on Oct 9 (Hangul Day)',
    check: function(){ return lsGet('kh_cult_hangul', false); } },
  { id:'cult_newyear', cat:'cultural',tier:'gold',     icon:pxBadge('sparkle'), name:'New Year\'s',     desc:'Study on January 1',
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
    // Server sync: save to user_badges table
    _syncBadgesToServer(newBadges);
    // Auto-unlock room items for badges with roomItemId
    _unlockBadgeRoomItems(newBadges);
  }
  return newBadges;
}

async function _syncBadgesToServer(badges) {
  if (typeof supaUser === 'undefined' || !supaUser) return;
  var sb = (typeof getSupa === 'function') ? getSupa() : null;
  if (!sb) return;
  for (var i = 0; i < badges.length; i++) {
    try {
      await sb.from('user_badges').upsert({
        user_id: supaUser.id,
        badge_id: badges[i].id,
        earned_at: new Date().toISOString()
      }, { onConflict: 'user_id,badge_id' });
    } catch(e) {}
  }
}

// Auto-unlock room decoration items for badges that have a roomItemId
function _unlockBadgeRoomItems(badges) {
  var K_ROOM_OWNED = 'kh_room_owned';
  var owned;
  try { owned = JSON.parse(localStorage.getItem(K_ROOM_OWNED) || '[]'); } catch(e) { owned = []; }
  var added = false;
  badges.forEach(function(b) {
    if (b.roomItemId && owned.indexOf(b.roomItemId) === -1) {
      owned.push(b.roomItemId);
      added = true;
    }
  });
  if (added) {
    localStorage.setItem(K_ROOM_OWNED, JSON.stringify(owned));
    if (typeof _syncRoomToServer === 'function') _syncRoomToServer();
  }
}

// Sync all existing localStorage badges to server (run once on load)
async function syncAllBadgesToServer() {
  if (typeof supaUser === 'undefined' || !supaUser) return;
  var sb = (typeof getSupa === 'function') ? getSupa() : null;
  if (!sb) return;
  var earned = getEarnedBadges();
  var ids = Object.keys(earned);
  if (!ids.length) return;
  try {
    var existing = await sb.from('user_badges').select('badge_id').eq('user_id', supaUser.id);
    var existingIds = new Set((existing.data||[]).map(function(r){ return r.badge_id; }));
    var toSync = ids.filter(function(id){ return !existingIds.has(id); });
    for (var i = 0; i < toSync.length; i++) {
      await sb.from('user_badges').upsert({
        user_id: supaUser.id,
        badge_id: toSync[i],
        earned_at: earned[toSync[i]].earnedAt || new Date().toISOString()
      }, { onConflict: 'user_id,badge_id' });
    }
  } catch(e) {}
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
  if (opts.grantXP !== false) addXP(XP_TABLE.article_read);
  checkBadges('article_read');
  await dmTrackArticle(opts);
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
