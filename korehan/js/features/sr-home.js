// ═══════════════════════════════════════════════════════════════
// Study Room home (2026-10 restructure) + My Words
//
// Study tab:  this week's lesson (hero) + Today's plan stay as they are;
//             everything else is 4 tiles — Review / Grammar / Read & Talk /
//             Real-life — each opening a bottom sheet of the existing
//             activities, plus a Seed-only "New to Korean?" card.
// My Words:   one place for saved words (user_saved_words + SRS columns):
//             today's due count → review, flashcards / quiz / listening
//             over the learner's own words, filters, search, list.
// Every entry point calls the activity's existing opener, so plan gating
// (requirePlan inside each opener) and progress tracking are unchanged.
// ═══════════════════════════════════════════════════════════════

function _srhE(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function _srhIcon(name) { return '<i data-lucide="' + name + '" class="kh-ui-icon" aria-hidden="true"></i>'; }

// ── Practice tiles ──────────────────────────────────────────────
function _srhDue() { return (typeof _srPlanDue === 'number' && _srPlanDue > 0) ? _srPlanDue : (_mw.dueCount || 0); }
// Two different numbers, labelled honestly: saved words whose review day has
// come (My Words) vs. today's session from the shared queue (max 20 items).
function _srhCounts() {
  return { due: _mw.dueCount || 0, session: (typeof _srPlanDue === 'number' && _srPlanDue > 0) ? _srPlanDue : 0 };
}
function _srhDueLabel(c) {
  if (c.due && c.session && c.session < c.due) return c.due + ' words due · today’s session: ' + c.session;
  if (c.due) return c.due + ' word' + (c.due === 1 ? '' : 's') + ' due today';
  if (c.session) return c.session + ' to review today';
  return '';
}

function srRenderPractice() {
  var box = document.getElementById('sr-practice');
  if (!box) return;
  var due = _srhDue(), cnt = _srhCounts(), dueLabel = _srhDueLabel(cnt);
  var next = null;
  try { next = (typeof getNextCurriculumPattern === 'function') ? getNextCurriculumPattern() : null; } catch (_) {}
  var tiles = [
    { k: 'review', icon: 'rotate-ccw', tone: 'red', title: 'Review', sub: 'Daily · Flashcards · Listening', badge: cnt.due ? Math.min(cnt.due, 99) + ' due' : (cnt.session ? cnt.session + ' today' : '') },
    { k: 'grammar', icon: 'route', tone: 'amber', title: 'Grammar', sub: next ? 'Next: ' + next.pattern : 'Path · Skill Tree · Builder' },
    { k: 'read', icon: 'book-open-text', tone: 'blue', title: 'Read & Talk', sub: 'Article Study · Conversations · Buzz' },
    { k: 'real', icon: 'phone', tone: 'green', title: 'Real-life', sub: 'Fast Track · Phone Call · Slang' }
  ];
  var html = '<div class="srh-h">More practice</div><div class="srh-grid">'
    + tiles.map(function (t) {
        return '<button type="button" class="srh-tile" onclick="srOpenSheet(\'' + t.k + '\')">'
          + (t.badge ? '<span class="srh-badge">' + _srhE(t.badge) + '</span>' : '')
          + '<span class="srh-ic srh-' + t.tone + '">' + _srhIcon(t.icon) + '</span>'
          + '<b>' + _srhE(t.title) + '</b><small>' + _srhE(t.sub) + '</small></button>';
      }).join('')
    + '</div>';
  if ((typeof _currentLevel !== 'undefined') && _currentLevel === 'Starter') {
    html += '<button type="button" class="srh-newbie" onclick="srOpenSheet(\'basics\')">'
      + '<span class="srh-ic srh-yellow">' + _srhIcon('type') + '</span>'
      + '<span><b>New to Korean?</b><small>Hangul, basics &amp; word builder</small></span></button>';
  }
  // Desktop only (CSS): My Words summary under the tiles.
  html += '<div class="srh-words">'
    + '<div class="srh-h">My Words <span id="srh-saved">' + (_mw.loaded ? _mw.rows.length + ' saved' : '') + '</span></div>'
    + '<button type="button" class="srh-words-row" onclick="srGoWords()">'
    + '<span class="srh-num">' + (due ? Math.min(cnt.due || due, 99) : '✓') + '</span>'
    + '<span><b>' + _srhE(dueLabel || 'Nothing due right now') + '</b><small>Flashcards, quiz or listening</small></span>'
    + '<span class="srh-cta">' + (due ? 'Review' : 'Open') + '</span></button></div>';
  box.innerHTML = html;
  _srhSyncBadge();
  if (_mw.loaded) mwRenderSummary();   // the session count can arrive after My Words loaded
}

function _srhSyncBadge() {
  var b = document.getElementById('sr-words-due-badge');
  if (!b) return;
  var due = _srhCounts().due || _srhDue();
  b.hidden = !due;
  b.textContent = due ? String(Math.min(due, 99)) : '';
}

function srGoWords() {
  switchSrTab('wordbook', document.getElementById('sr-tab-btn-wordbook'));
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) { window.scrollTo(0, 0); }
}

// ── Bottom sheets ───────────────────────────────────────────────
function _srhSheetItems(kind) {
  var due = _srhDue();
  var weeklySub = ((document.getElementById('weekly-review-sub') || {}).textContent || 'Opens on Sunday').trim();
  var monthlySub = ((document.getElementById('monthly-review-sub') || {}).textContent || 'Opens on the 1st–3rd of each month').trim();
  var next = null;
  try { next = (typeof getNextCurriculumPattern === 'function') ? getNextCurriculumPattern() : null; } catch (_) {}
  var S = {
    review: { title: 'Review', sub: 'Words you saved come back right before you forget them.', items: [
      { icon: 'clipboard-list', t: 'Today’s Review', s: due ? due + ' to review · due, missed and new words' : 'Due, missed and new words', fn: function () { openDailyReview(); }, cta: 'Start' },
      { icon: 'calendar-days', t: 'Weekly Review', s: weeklySub, fn: function () { openWeeklyReview(); } },
      { icon: 'calendar-check', t: 'Monthly Review', s: monthlySub, fn: function () { openMonthlyReview(); } },
      { icon: 'layers', t: 'Flashcards', s: 'Read the Korean, then flip', fn: function () { mwFlashcards(); } },
      { icon: 'headphones', t: 'Listening Quiz', s: 'Hear it, pick the meaning', fn: function () { startLQ(); }, gate: 'listening_quiz' }
    ] },
    grammar: { title: 'Grammar', sub: 'One pattern at a time, in order.', items: [
      { icon: 'route', t: 'Grammar Path', s: next ? 'Next: ' + next.pattern : 'Continue your next lesson', fn: function () { openGrammarFocusForCurriculum(); }, cta: 'Go' },
      { icon: 'git-branch', t: 'Grammar Skill Tree', s: 'See every pattern by level', fn: function () { KHGrammarTree&&KHGrammarTree.open(); } },
      { icon: 'puzzle', t: 'Sentence Builder', s: 'Build Korean sentences from blocks', fn: function () { KHSentenceBuilder&&KHSentenceBuilder.open(); } }
    ] },
    read: { title: 'Read & Talk', sub: 'Real Korean, step by step.', items: [
      { icon: 'newspaper', t: 'Article Study', s: 'Real news in 4 learning steps', fn: function () { openArticleStudy(); }, gate: 'article_study' },
      { icon: 'messages-square', t: 'Conversations', s: 'Listen, read, then role-play', fn: function () { openConvStudy(); } },
      { icon: 'flame', t: 'Korea Buzz', s: 'What Korea is talking about today', fn: function () { location.href = 'korehan-section.html?s=buzz'; } }
    ] },
    real: { title: 'Real-life', sub: 'Practice for real situations.', items: [
      { icon: 'zap', t: 'Fast Track', s: 'Cafe, taxi, hospital & more', fn: function () { openFastTrack(); }, gate: 'fast_track' },
      { icon: 'phone', t: 'Phone Call', s: 'Talk through a real call', fn: function () { openPhoneModal(); }, gate: 'phone_call' },
      { icon: 'message-circle', t: 'Korean Slang', s: 'What people actually say', fn: function () { openSlangModal(); } },
      { icon: 'image', t: 'Describe the image', s: 'Say what you see in Korean', fn: function () { openPictureDescription(); } }
    ] },
    basics: { title: 'New to Korean?', sub: 'Start with the letters and the most basic words.', items: [
      { icon: 'type', t: 'Korean Basics', s: 'Hangul and first words', fn: function () { openBasicsTrack(); }, cta: 'Start' },
      { icon: 'blocks', t: 'Word Builder', s: 'Put syllables together', fn: function () { openAlphaModal(); } }
    ] }
  };
  return S[kind];
}

function srOpenSheet(kind) {
  var d = _srhSheetItems(kind);
  if (!d) return;
  srCloseSheet();
  var ov = document.createElement('div');
  ov.id = 'srh-sheet';
  ov.className = 'srh-sheet-ov';
  ov.innerHTML = '<div class="srh-sheet" role="dialog" aria-modal="true" aria-label="' + _srhE(d.title) + '">'
    + '<div class="srh-grab"></div>'
    + '<div class="srh-sheet-t">' + _srhE(d.title) + '</div>'
    + '<div class="srh-sheet-s">' + _srhE(d.sub) + '</div>'
    + d.items.map(function (it, i) {
        var locked = it.gate && typeof canAccess === 'function' && !canAccess(it.gate);
        return '<button type="button" class="srh-item" data-i="' + i + '">'
          + '<span class="srh-item-ic">' + _srhIcon(it.icon) + '</span>'
          + '<span class="srh-item-tx"><b>' + _srhE(it.t) + '</b><small>' + _srhE(it.s) + '</small></span>'
          + (locked ? '<span class="srh-item-r srh-pm">Premium</span>'
                    : (it.cta ? '<span class="srh-item-r">' + _srhE(it.cta) + '</span>' : '<span class="srh-item-arr">' + _srhIcon('chevron-right') + '</span>'))
          + '</button>';
      }).join('')
    + '</div>';
  ov.addEventListener('click', function (e) {
    if (e.target === ov) { srCloseSheet(); return; }
    var btn = e.target.closest && e.target.closest('.srh-item');
    if (!btn) return;
    var it = d.items[Number(btn.dataset.i)];
    srCloseSheet();
    try { it.fn(); } catch (err) { console.warn('[sr-home] open failed', it.t, err); }
  });
  document.body.appendChild(ov);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(function () { ov.classList.add('open'); });
}

function srCloseSheet() {
  var ov = document.getElementById('srh-sheet');
  if (!ov) return;
  ov.remove();
  document.body.style.overflow = '';
}
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') srCloseSheet(); });

// ── My Words ────────────────────────────────────────────────────
var _mw = { rows: [], loaded: false, filter: 'all', dueCount: 0 };

function _mwToday() {
  try { return kstNow().toISOString().slice(0, 10); } catch (_) { return new Date().toISOString().slice(0, 10); }
}
function _mwCat(en) {
  if (en.indexOf('[슬랭]') === 0) return 'slang';
  if (en.indexOf('[표현]') === 0) return 'expression';
  if (en.indexOf('[교정]') === 0) return 'correction';
  return 'word';
}
function _mwStage(r) {
  if (r.mastered || (r.srs_interval || 0) >= 21) return 3;
  if ((r.srs_review_count || r.review_count || 0) > 0 && (r.srs_interval || 0) >= 3) return 2;
  return 1;
}
function _mwSource(r) {
  var t = r.source_content_type || '';
  if (t === 'article' || r.source_kind === 'article') return 'News';
  if (t === 'conversation' || r.source_kind === 'conversation') return 'Conversation';
  if (r.source_kind === 'phrase') return 'Phrase';
  return '';
}

async function mwLoad() {
  var list = document.getElementById('wb-list');
  // ?tab=words can open before the session is read — wait for it instead
  // of showing "Sign in" to a signed-in learner.
  if (!supaUser && !window._sessionChecked) { setTimeout(mwLoad, 400); return; }
  if (!supaUser) { if (list) list.innerHTML = '<div class="wb-empty">Sign in to see your saved words</div>'; return; }
  var sb = getSupa(); if (!sb) return;
  if (list && !_mw.loaded) list.innerHTML = '<div class="wb-empty">Loading your saved words…</div>';
  try {
    var r = await sb.from('user_saved_words')
      .select('word_ko, word_rom, word_en, source_kind, source_content_type, review_count, correct_count, wrong_count, mastered, created_at, srs_interval, srs_next_review, srs_review_count')
      .eq('user_id', supaUser.id).order('created_at', { ascending: false }).limit(1000);
    if (r.error) throw r.error;
    var today = _mwToday(), seen = {};
    _mw.rows = (r.data || []).filter(function (w) {
      if (!w.word_ko || seen[w.word_ko]) return false;
      seen[w.word_ko] = 1; return true;
    }).map(function (w) {
      var en = String(w.word_en || '');
      var cat = _mwCat(en);
      var clean = (typeof khCleanMeaning === 'function') ? khCleanMeaning(en) : en.replace(/^\[[^\]]+\]\s*/, '');
      return {
        ko: w.word_ko, rom: w.word_rom || '', en: clean, rawEn: en, cat: cat,
        stage: _mwStage(w), due: !!(w.srs_next_review && w.srs_next_review <= today && !w.mastered),
        reviews: w.srs_review_count || w.review_count || 0, src: _mwSource(w), date: w.created_at,
        // legacy Word Book quiz fields
        reviewCount: w.review_count || 0, correctCount: w.correct_count || 0, wrongCount: w.wrong_count || 0,
        accuracy: ((w.correct_count || 0) + (w.wrong_count || 0)) ? Math.round((w.correct_count || 0) / ((w.correct_count || 0) + (w.wrong_count || 0)) * 100) : -1
      };
    });
    _mw.loaded = true;
    _mw.dueCount = _mw.rows.filter(function (w) { return w.due; }).length;
    window._wbData = _mw.rows;   // the legacy quiz (startWbQuiz) reads this
    mwRenderSummary();
    mwRender();
    srRenderPractice();
  } catch (e) {
    console.warn('[My Words]', e);
    if (list) list.innerHTML = '<div class="wb-empty">Couldn\'t load your words. <button type="button" class="mw-retry" onclick="mwLoad()">Retry</button></div>';
  }
}

function mwRenderSummary() {
  var c = _srhCounts();
  var due = c.due || c.session;
  var n = document.getElementById('mw-due-n'); if (n) n.textContent = String(due);
  var sub = document.getElementById('mw-due-sub');
  var sess = c.session || Math.min(c.due, 20);
  if (sub) sub.textContent = !due ? 'nothing due — nice'
    : (c.due ? (c.due === 1 ? 'word due' : 'words due') + (c.session && c.session < c.due ? ' · today’s session: ' + c.session : '') : 'to review today')
      + ' · ~' + Math.max(1, Math.ceil(sess / 4)) + ' min';
  var go = document.getElementById('mw-due-go'); if (go) go.textContent = due ? 'Start review' : 'Practice anyway';
  var all = _mw.rows.length, mastered = _mw.rows.filter(function (w) { return w.stage === 3; }).length;
  var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = String(v); };
  set('mw-cnt-all', all); set('mw-cnt-learning', all - mastered); set('mw-cnt-mastered', mastered);
  var dueBtn = document.querySelector('#mw-filters [data-f="due"]'); if (dueBtn) dueBtn.textContent = 'Due' + (_mw.dueCount ? ' (' + _mw.dueCount + ')' : '');
  var corr = document.querySelector('#mw-filters [data-f="correction"]');
  if (corr) corr.hidden = !_mw.rows.some(function (w) { return w.cat === 'correction'; });
}

function mwSetFilter(f) {
  _mw.filter = f;
  document.querySelectorAll('#mw-filters button').forEach(function (b) { b.classList.toggle('on', b.dataset.f === f); });
  mwRender();
}

function _mwFiltered() {
  var q = ((document.getElementById('mw-search') || {}).value || '').trim().toLowerCase();
  return _mw.rows.filter(function (w) {
    var f = _mw.filter;
    if (f === 'due' && !w.due) return false;
    if (f === 'learning' && w.stage === 3) return false;
    if (f === 'mastered' && w.stage !== 3) return false;
    if (f === 'phrase' && w.cat !== 'expression' && w.cat !== 'slang') return false;
    if (f === 'correction' && w.cat !== 'correction') return false;
    if (q && w.ko.toLowerCase().indexOf(q) < 0 && w.en.toLowerCase().indexOf(q) < 0 && w.rom.toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
}

function mwRender() {
  var list = document.getElementById('wb-list');
  if (!list || !_mw.loaded) return;
  var rows = _mwFiltered();
  if (!rows.length) {
    list.innerHTML = '<div class="wb-empty">' + (_mw.rows.length
      ? 'No words here yet.'
      : 'No saved words yet<br><small>Tap a word while reading and choose Save — it shows up here for review.</small>') + '</div>';
    return;
  }
  var tag = { slang: '<span class="mw-tag mw-tag-p">SLANG</span>', expression: '<span class="mw-tag mw-tag-p">PHRASE</span>', correction: '<span class="mw-tag mw-tag-c">FIX</span>' };
  list.innerHTML = rows.slice(0, 400).map(function (w) {
    var meta = [w.src, w.reviews ? w.reviews + (w.reviews === 1 ? ' review' : ' reviews') : 'New'].filter(Boolean).join(' · ');
    var bars = [1, 2, 3].map(function (i) { return '<i class="' + (i <= w.stage ? (w.stage === 1 ? 'm' : 'f') : '') + '"></i>'; }).join('');
    return '<div class="mw-row">'
      + '<div class="mw-ko" lang="ko">' + _srhE(w.ko) + '</div>'
      + '<div class="mw-en">' + _srhE(w.en) + '<small>' + _srhE(meta) + (w.due ? ' <span class="mw-tag mw-tag-d">DUE</span>' : '') + (tag[w.cat] || '') + '</small></div>'
      + '<div class="mw-bar" title="' + ['', 'New', 'Learning', 'Mastered'][w.stage] + '">' + bars + '</div>'
      + '<button type="button" class="mw-play" aria-label="Listen" data-t="' + _srhE(w.ko) + '" onclick="srSpeak(this.dataset.t,this)">' + _srhIcon('volume-2') + '</button>'
      + '</div>';
  }).join('');
}
// Legacy Word Book renderer → My Words (the quiz's "Back to Words" calls it).
function renderWordBook() { mwRender(); }
function renderWbCounts() { mwRenderSummary(); }
// switchSrTab('wordbook') calls loadWordBook() — route it here.
function loadWordBook() { return mwLoad(); }

// Review entry points over the learner's own words
function _mwPool(n) {
  var due = _mw.rows.filter(function (w) { return w.due; });
  var pool = due.length ? due : _mw.rows.filter(function (w) { return w.stage < 3; });
  if (!pool.length) pool = _mw.rows.slice();
  return pool.slice().sort(function () { return Math.random() - 0.5; }).slice(0, n);
}
function mwStartReview() {
  if (typeof openDailyReview === 'function') openDailyReview();
}
function mwFlashcards() {
  if (!_mw.loaded) { mwLoad().then(mwFlashcards); return; }
  var cards = _mwPool(20).map(function (w) { return { ko: w.ko, en: w.en, rom: w.rom, src: w.src === 'Conversation' ? 'conv' : 'news' }; });
  if (!cards.length) { showToast('Save a few words first — tap a word while reading.'); return; }
  KHFlashcards.open({ title: 'My Words · ' + cards.length + ' cards', cards: cards });
}
function mwQuiz() {
  if (!_mw.loaded) { mwLoad().then(mwQuiz); return; }
  if (_mw.rows.length < 4) { showToast('Save at least 4 words to start the quiz'); return; }
  if (typeof startWbQuiz === 'function') startWbQuiz();
  var list = document.getElementById('wb-list');
  if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function mwListening() {
  if (typeof requirePlan === 'function' && !requirePlan('listening_quiz')) return;
  if (!_mw.loaded) { mwLoad().then(mwListening); return; }
  var all = _mw.rows.filter(function (w) { return w.en; });
  if (all.length < 4) { showToast('Save at least 4 words for the listening quiz'); return; }
  var qs = _mwPool(10).filter(function (w) { return w.en; }).map(function (w) {
    var wrong = all.filter(function (x) { return x.en !== w.en; }).sort(function () { return Math.random() - 0.5; }).slice(0, 2).map(function (x) { return x.en; });
    return { sentence: w.ko, correct: w.en, choices: [w.en].concat(wrong).sort(function () { return Math.random() - 0.5; }) };
  });
  KHListening.open({ questions: qs });
}

// Tap a word row (anywhere but its buttons) to hear it.
document.addEventListener('click', function (e) {
  var row = e.target.closest && e.target.closest('.mw-row, .wb-entry');
  if (!row || e.target.closest('button, a, input')) return;
  var el = row.querySelector('.mw-ko, .wb-entry-ko');
  var ko = el && el.firstChild ? String(el.firstChild.textContent || '').trim() : '';
  if (ko && typeof srSpeak === 'function') srSpeak(ko, row.querySelector('.mw-play'));
});

// ── Past topics (2026-10) ───────────────────────────────────────
// Earlier weeks stay practicable: a row under this week's card opens a
// list of past weeks (with this device's progress + whether writing was
// submitted); picking one reloads the Study Room with ?week=<Monday> so
// every activity runs on that week's content (khPracticeWeek in
// korehan-study-room.js). Writing can't be submitted in practice mode.
var _SRP_STAGES = ['topic', 'grammar', 'picture', 'sentence', 'expressions'];
var _SRP_LEVELS = [['Starter', 'Seed'], ['Beginner', 'Sprout'], ['Intermediate', 'Tree']];

function _srpWeekLabel(w) {
  try { return new Date(w + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); } catch (_) { return w; }
}
function _srpDone(week, level) {
  try {
    var d = JSON.parse(localStorage.getItem('kh_sr_done_w_' + (supaUser ? supaUser.id : 'guest') + '_' + week + '_' + level) || '{}');
    return _SRP_STAGES.filter(function (k) { return d[k]; }).length;
  } catch (_) { return 0; }
}

function srRenderPastRow() {
  var box = document.getElementById('sr-past-row');
  if (!box) return;
  if (khPracticeWeek()) { box.innerHTML = ''; return; }
  box.innerHTML = '<button type="button" class="srp-row" onclick="srOpenPast()">'
    + '<span class="srp-ic">' + _srhIcon('history') + '</span>'
    + '<span class="srp-tx"><b>Past topics</b><small>Practice earlier weeks again anytime</small></span>'
    + '<span class="srh-item-arr">' + _srhIcon('chevron-right') + '</span></button>';
}

async function srOpenPast(level) {
  level = level || _currentLevel || 'Beginner';
  srCloseSheet();
  var ov = document.createElement('div');
  ov.id = 'srh-sheet';
  ov.className = 'srh-sheet-ov';
  ov.innerHTML = '<div class="srh-sheet" role="dialog" aria-modal="true" aria-label="Past topics">'
    + '<div class="srh-grab"></div>'
    + '<div class="srh-sheet-t">Past topics</div>'
    + '<div class="srh-sheet-s">Practice an earlier week again. Progress is saved; writing can\'t be submitted.</div>'
    + '<div class="srp-lv">' + _SRP_LEVELS.map(function (l) {
        return '<button type="button" class="srp-chip' + (l[0] === level ? ' on' : '') + '" onclick="srOpenPast(\'' + l[0] + '\')">' + l[1] + '</button>';
      }).join('') + '</div>'
    + '<div id="srp-list"><div class="srp-empty">Loading…</div></div>'
    + '</div>';
  ov.addEventListener('click', function (e) { if (e.target === ov) srCloseSheet(); });
  document.body.appendChild(ov);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(function () { ov.classList.add('open'); });

  var list = ov.querySelector('#srp-list');
  var sb = (typeof getSupa === 'function') ? getSupa() : null;
  if (!sb) { list.innerHTML = '<div class="srp-empty">Offline — try again later.</div>'; return; }
  var now = _kstWeekKeyCalc();
  var weeks = [];
  try {
    var r = await sb.from('study_daily_content').select('scheduled_date,topic_ko,topic_en')
      .eq('level', level).gte('scheduled_date', '2026-10-12').lt('scheduled_date', now).order('scheduled_date', { ascending: false }).limit(30);
    var seen = {};
    (r.data || []).forEach(function (x) {
      // Weekly rows only (weekly lessons start 2026-10-12; older daily rows aren't a week's lesson).
      if (!x.topic_ko || _kstWeekKeyCalc(x.scheduled_date) !== x.scheduled_date || seen[x.scheduled_date]) return;
      seen[x.scheduled_date] = 1;
      weeks.push(x);
    });
  } catch (_) {}
  if (!document.body.contains(list)) return;
  if (!weeks.length) { list.innerHTML = '<div class="srp-empty">No earlier weeks at this level yet.</div>'; return; }

  var submitted = {};
  if (supaUser) {
    try {
      var s = await sb.from('user_submissions').select('study_date').eq('user_id', supaUser.id)
        .in('study_date', weeks.map(function (w) { return w.scheduled_date; }))
        .in('content_type', ['daily_package', 'writing']);
      (s.data || []).forEach(function (x) { submitted[x.study_date] = true; });
    } catch (_) {}
  }
  list.innerHTML = weeks.map(function (w) {
    var n = _srpDone(w.scheduled_date, level);
    var wrote = submitted[w.scheduled_date];
    var cta = n >= _SRP_STAGES.length ? 'Review' : (n > 0 ? 'Continue' : 'Practice');
    var parts = w.scheduled_date.split('-');
    var mon = _srpWeekLabel(w.scheduled_date).split(' ')[0];
    return '<a class="srp-wk' + (n >= _SRP_STAGES.length ? ' done' : '') + '" href="korehan-study-room.html?week=' + w.scheduled_date + '&lvl=' + level + '">'
      + '<span class="srp-d">' + _srhE(mon.toUpperCase()) + '<b>' + Number(parts[2]) + '</b></span>'
      + '<span class="srp-m"><b lang="ko">' + _srhE(w.topic_ko) + '</b>'
      + '<small>' + (n ? 'Lesson ' + n + '/' + _SRP_STAGES.length : 'Not started') + (wrote ? ' · Writing submitted' : '') + '</small>'
      + '<span class="srp-bar"><i style="width:' + Math.round(n / _SRP_STAGES.length * 100) + '%"></i></span></span>'
      + '<span class="srp-go">' + cta + '</span></a>';
  }).join('') + '<div class="srp-note">Practice never counts against your streak.</div>';
}

// Practice mode chrome: banner + relabelled topic card, and ?lvl= applied.
function _srpPracticeChrome() {
  var w = khPracticeWeek();
  if (!w) return;
  var card = document.querySelector('.sr-topic-card2');
  if (card && !document.getElementById('srp-banner')) {
    var b = document.createElement('div');
    b.id = 'srp-banner';
    b.className = 'srp-banner';
    b.innerHTML = '<span>' + _srhIcon('history') + '</span><span><b>Practice mode · Week of ' + _srhE(_srpWeekLabel(w)) + '</b>'
      + '<small>Progress is saved, but writing can\'t be submitted for new feedback.</small></span>'
      + '<a href="korehan-study-room.html">This week</a>';
    card.parentNode.insertBefore(b, card);
  }
  var lbl = document.querySelector('.sr-topic-lbl');
  if (lbl) lbl.textContent = 'WEEK OF ' + _srpWeekLabel(w).toUpperCase();
  var sub = document.querySelector('.sr-start-btn-sub');
  if (sub) sub.textContent = 'Practice this lesson again →';
  var lvl = new URLSearchParams(location.search).get('lvl');
  var cls = { Starter: 'lv-s', Beginner: 'lv-b', Intermediate: 'lv-i' }[lvl];
  if (cls && lvl !== _currentLevel) {
    (function apply() {
      if (typeof supaUser === 'undefined' || (!supaUser && !window._sessionChecked)) { setTimeout(apply, 400); return; }
      var pill = document.querySelector('.lv-pill.' + cls);
      if (pill && lvl !== _currentLevel) pill.click();
    })();
  }
}

// ── Boot ────────────────────────────────────────────────────────
(function () {
  function boot() {
    srRenderPractice();
    srRenderPastRow();
    _srpPracticeChrome();
    var tab = new URLSearchParams(location.search).get('tab');
    if (tab === 'words' || tab === 'wordbook') setTimeout(srGoWords, 300);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  // Due count + level arrive after auth; refresh the tiles (and the tab badge).
  window.addEventListener('kh-auth-signed-in', function () { setTimeout(function () { mwLoad(); }, 1200); });
  setTimeout(function () { if (typeof supaUser !== 'undefined' && supaUser && !_mw.loaded) mwLoad(); }, 4000);
})();
