/* TOPIK Practice (mockup K, 2026-10-28). ORIGINAL questions in the real TOPIK
   layout: TOPIK I/II reading + listening. Hand-written tests come from
   scripts/topik/ (items.mjs, tests/*.mjs) and go through the review in
   scripts/topik/REVIEW.md: automatic checks, an independent second review,
   then the admin approves each draft here before learners see it.
   Listening plays the stored MP3, or reads the script with the device voice.
   Test 1 and the weekly mini test are free; other tests are Premium (RLS
   hides their items too). Timed test → score, estimated level from the TOPIK
   cut scores, accuracy by question type, drills for weak types, wrong-answer
   review. Attempts are saved to topik_attempts for signed-in learners.
   No AI calls. */
(function () {
  'use strict';

  var TYPES = {
    topic:  { ko: '무엇에 대한 이야기입니까? 알맞은 것을 고르십시오.', en: 'What is it about?' },
    blank:  { ko: '(    )에 들어갈 가장 알맞은 것을 고르십시오.', en: 'Fill the blank' },
    notice: { ko: '다음을 읽고 맞지 않는 것을 고르십시오.', en: 'Notices & messages (NOT true)' },
    match:  { ko: '다음의 내용과 같은 것을 고르십시오.', en: 'Matches the text' },
    main:   { ko: '다음을 읽고 중심 생각을 고르십시오.', en: 'Main idea' },
    pblank: { ko: '㉠에 들어갈 알맞은 말을 고르십시오.', en: 'Passage blank' },
    pmatch: { ko: '이 글의 내용과 같은 것을 고르십시오.', en: 'Passage details' },
    ptopic: { ko: '무엇에 대한 내용인지 맞는 것을 고르십시오.', en: 'Passage topic' },
    order:  { ko: '다음을 순서대로 맞게 배열한 것을 고르십시오.', en: 'Sentence order' },
    insert: { ko: '다음 문장이 들어갈 곳으로 가장 알맞은 것을 고르십시오.', en: 'Where the sentence goes' },
    purpose:{ ko: '왜 윗글을 썼는지 맞는 것을 고르십시오.', en: 'Why it was written' },
    infer:  { ko: '이 글을 읽고 알 수 있는 것을 고르십시오.', en: 'What you can tell' },
    // Generated tests carry their own printed instruction; these are labels.
    l_answer: { en: 'Answer the question' }, l_next: { en: 'What comes next' }, l_place: { en: 'Where are they?' },
    l_topic: { en: 'What is it about?' }, l_picture: { en: 'Choose the picture' }, l_graph: { en: 'Choose the graph' },
    l_match: { en: 'Matches what you heard' }, l_main: { en: 'Main idea' }, l_action: { en: 'What she does next' }, l_set: { en: 'Long listening' },
    answer: { en: 'Answer the question' }, next: { en: 'What comes next' }, place: { en: 'Where are they?' }, picture: { en: 'Choose the picture' },
    reason: { en: 'Reason' }, action: { en: 'Next action' }, grammar: { en: 'Grammar blank' }, similar: { en: 'Similar meaning' },
    about: { en: 'What is it about? (ads, signs)' }, graph: { en: 'Graph' }, feeling: { en: 'Feelings' }, headline: { en: 'Newspaper headline' },
    theme: { en: 'Main theme' }, attitude: { en: 'Attitude' }, manner: { en: 'Way of speaking' }, intent: { en: 'Intention' },
    who: { en: 'Who is the speaker?' }, before: { en: 'What came before' }, doing: { en: 'What he is doing' }, set: { en: 'Passage' }
  };
  var TIPS = {
    order: 'Start with the sentence that needs no connector; 그래서 / 그런데 / 하지만 never come first.',
    insert: 'Read the sentences just before and after each gap — the new sentence must link to both.',
    pblank: 'Check what comes right after the blank: ~때문에, ~수 있다, ~기 쉽다 each need a set form.',
    blank: 'Look at the particle or ending around the blank before reading the choices.',
    notice: 'Check each choice against one line of the notice — times, prices and places.',
    match: 'Wrong choices usually flip one detail: who, when, or how many.',
    pmatch: 'Find the sentence in the passage that says the same thing in other words.',
    main: 'The main idea is what the whole text supports, not one detail.',
    topic: 'Find the category word that covers both sentences.',
    ptopic: 'Ask what the whole passage explains.',
    purpose: 'The subject line and the first sentence usually say why it was written.',
    infer: 'Pick only what the text supports — not what might also be true.',
    answer: 'Match the question word: 네/아니요 questions need 네 or 아니요 first; 뭐/어디/언제 need a thing, place or time.',
    place: 'Listen for the things people ask for or handle (표, 약, 책) — they tell you the place.',
    next: 'Reply to the last line only: an offer, a question or a request each needs a matching response.',
    picture: 'Note who is speaking and what they are holding or doing in the last line.',
    attitude: 'Find the writer\'s opinion (-아야 한다, 문제이다, 바람직하다), then check the verb that ends each choice — 지지하다, 반대하다, 우려하다, 비판하다 must match it.',
    grammar: 'Read the whole sentence first: how the two halves connect (reason, contrast, condition, interruption) decides the ending.',
    similar: 'Name what the underlined pattern does (reason, ability, intention…), then pick the choice that does the same job in this sentence.',
    reason: 'Listen for 때문에, -아서/어서 and 왜냐하면 — the reason usually follows them.',
    action: 'The next action is usually what the speaker agrees to at the end (-ㄹ게요, -을까요?).',
    about: 'Ads and signs name a product or place with a few key words — pick the category that covers them all.',
    graph: 'Compare the numbers in each choice with the graph one by one — order, highest and lowest.',
    feeling: 'Look at the situation and the words around the underline — they show the feeling.',
    headline: 'Headlines drop endings and particles; restore them before matching the meaning.',
    theme: 'The theme is the writer\'s main claim — often in the last sentence.',
    manner: 'Listen to how the speaker sounds: asking, explaining, refusing or complaining.',
    intent: 'Ask what the speaker wants to happen — the request or suggestion behind the words.',
    who: 'Listen for job words and what the speaker does or knows — they tell you who it is.',
    before: 'The first line often reacts to something just said — guess what that was.',
    doing: 'Listen for the verbs in the present: what the man is doing right now.',
    set: 'Read the questions first, then find the part of the passage each one is about.'
  };
  // Listening types share the reading tip of the same kind.
  ['answer', 'next', 'place', 'topic', 'picture', 'graph', 'match', 'main', 'action', 'set'].forEach(function (k) { if (!TIPS['l_' + k]) TIPS['l_' + k] = TIPS[k]; });
  TIPS.l_topic = 'Listen for the words both speakers repeat — the topic covers them.';
  TIPS.l_set = 'Read the questions before the audio starts so you know what to listen for.';
  TIPS.l_action = TIPS.action;
  var NUMS = ['①', '②', '③', '④'];
  var S = { level: 'I', section: 'reading', tests: [], attempts: [], run: null };
  try { var _sv = JSON.parse(localStorage.getItem('kh_topik_view') || 'null'); if (_sv) { S.level = _sv.level === 'II' ? 'II' : 'I'; S.section = _sv.section === 'listening' ? 'listening' : 'reading'; } } catch (_) {}
  function isAdmin() { return !!window._isAdmin; }
  function typeLabel(t) { return (TYPES[t] && TYPES[t].en) || t; }
  // Passage text: escape, then [u]…[/u] → underline.
  function rich(t) { return esc(t).replace(/\[u\]([\s\S]*?)\[\/u\]/g, '<u>$1</u>'); }
  function graphSvg(g, small) {
    if (!g || !Array.isArray(g.items) || !g.items.length) return '';
    var max = Math.max.apply(null, g.items.map(function (x) { return Number(x.value) || 0; })) || 1;
    var W = small ? 220 : 320, rowH = small ? 18 : 24, pad = small ? 64 : 90;
    var h = g.items.length * rowH + (g.title ? 22 : 6);
    var out = '<svg viewBox="0 0 ' + W + ' ' + h + '" width="100%" style="max-width:' + W + 'px;display:block" role="img" aria-label="' + esc(g.title || 'graph') + '">';
    if (g.title) out += '<text x="0" y="13" fill="#e2e8f0" font-size="' + (small ? 10 : 12) + '" font-weight="700">' + esc(g.title) + (g.unit ? ' (' + esc(g.unit) + ')' : '') + '</text>';
    g.items.forEach(function (x, i) {
      var y = (g.title ? 22 : 6) + i * rowH, bw = Math.max(2, (W - pad - 30) * (Number(x.value) || 0) / max);
      out += '<text x="0" y="' + (y + rowH * 0.62) + '" fill="#cbd5e1" font-size="' + (small ? 9.5 : 11.5) + '">' + esc(x.label) + '</text>'
        + '<rect x="' + pad + '" y="' + (y + 3) + '" width="' + bw + '" height="' + (rowH - 8) + '" rx="3" fill="#60a5fa"></rect>'
        + '<text x="' + (pad + bw + 4) + '" y="' + (y + rowH * 0.62) + '" fill="#e2e8f0" font-size="' + (small ? 9.5 : 11) + '">' + esc(x.value) + '</text>';
    });
    return out + '</svg>';
  }
  function choiceHtml(ch) {
    if (ch && typeof ch === 'object' && ch.graph) return graphSvg(ch.graph, true);
    return '<span>' + esc(ch) + '</span>';
  }
  // Listening: stored MP3 if there is one, else the device voice reads the
  // script line by line (a male/female voice when the device has both).
  var _audio = null;
  function stopAudio() { try { if (_audio) { _audio.pause(); _audio = null; } } catch (_) {} try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (_) {} }
  function playItem(it, btn) {
    stopAudio();
    var done = function () { if (btn) btn.classList.remove('on'); };
    if (btn) btn.classList.add('on');
    if (it.audio_url) { _audio = new Audio(it.audio_url); _audio.onended = done; _audio.onerror = function () { _audio = null; speakScript(it.script || [], done); }; _audio.play().catch(function () { speakScript(it.script || [], done); }); return; }
    speakScript(it.script || [], done);
  }
  function speakScript(lines, done) {
    var ss = window.speechSynthesis;
    if (!ss || !lines.length) { done(); return; }
    var vs = (ss.getVoices() || []).filter(function (v) { return /^ko/i.test(v.lang); });
    var male = vs.filter(function (v) { return /male|man|injoon|minsu|hyunsu|남/i.test(v.name) && !/female/i.test(v.name); })[0];
    var female = vs.filter(function (v) { return /female|woman|sunhi|yuna|heami|여/i.test(v.name); })[0] || vs[0];
    var i = 0;
    (function next() {
      if (i >= lines.length) { done(); return; }
      var l = lines[i++], isMale = /남/.test(String(l.s || ''));
      var u = new SpeechSynthesisUtterance(String(l.t || ''));
      u.lang = 'ko-KR'; u.rate = 0.95;
      var v = isMale ? (male || null) : female;
      if (v) u.voice = v;
      if (isMale && !male) u.pitch = 0.6; else if (!isMale) u.pitch = 1.1;
      u.onend = function () { setTimeout(next, 450); };
      u.onerror = function () { setTimeout(next, 100); };
      ss.speak(u);
    })();
  }

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ico(n, cls) { return '<i data-lucide="' + n + '" class="kh-ui-icon ' + (cls || 'kh-ui-icon-sm') + '" aria-hidden="true"></i>'; }
  function icons() { try { if (typeof renderKhLucideIcons === 'function') renderKhLucideIcons(); } catch (_) {} }
  function sb() { return (typeof getSupa === 'function') ? getSupa() : null; }
  function user() { return (typeof supaUser !== 'undefined' && supaUser) ? supaUser : null; }
  function premium() { return typeof getUserPlan === 'function' && getUserPlan() === 'premium'; }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
  function weekIndex() { return Math.floor((Date.now() / 86400000 + 3) / 7); }   // changes every Monday (UTC)

  // Tests: the head prefetch (public list, started before the page scripts),
  // a cached copy for instant repeat visits, or a normal query. Attempts and
  // the admin's drafts need the session and load after it is restored.
  var CACHE = 'kh_topik_tests_v1';
  async function loadTests() {
    var rows = null;
    if (window._tpPrefetch && !S._prefetchUsed) { S._prefetchUsed = true; try { rows = await window._tpPrefetch; } catch (_) {} }
    var c = sb();
    if ((!Array.isArray(rows) || isAdmin()) && c) {
      var q = c.from('topik_tests').select('id,level,section,kind,title,minutes,free,sort,number,status,flagged' + (isAdmin() ? ',approved_at' : '')).order('sort');
      if (!isAdmin()) q = q.eq('status', 'published');
      var r = await q;
      if (r && !r.error) rows = r.data || [];
    }
    if (Array.isArray(rows)) { S.tests = rows; if (!isAdmin()) { try { localStorage.setItem(CACHE, JSON.stringify(rows)); } catch (_) {} } }
    else if (!S.tests.length) { try { S.tests = JSON.parse(localStorage.getItem(CACHE) || '[]') || []; } catch (_) {} }
  }
  async function loadAttempts() {
    var c = sb();
    if (!c || !user()) return;
    var a = await c.from('topik_attempts').select('id,test_id,score,correct,total,est_level,finished_at,answers,seconds').order('finished_at', { ascending: false }).limit(40);
    S.attempts = (a && a.data) || [];
  }
  function lastAttempt(id) { return S.attempts.filter(function (a) { return a.test_id === id; })[0]; }

  // ── Hub ──
  var SECTIONS = { reading: { l: 'Reading', i: 'book-open' }, listening: { l: 'Listening', i: 'headphones' } };
  var COUNTS = { 'I-reading': '40 questions', 'I-listening': '30 questions', 'II-reading': '50 questions', 'II-listening': '50 questions' };
  function renderHub() {
    var root = $('tp-root'); if (!root) return;
    stopAudio();
    try { localStorage.setItem('kh_topik_view', JSON.stringify({ level: S.level, section: S.section })); } catch (_) {}
    var mine = S.tests.filter(function (t) { return t.level === S.level; });
    var full = mine.filter(function (t) { return t.kind === 'full' && t.section === S.section; })
      .sort(function (a, b) { return (a.number || 0) - (b.number || 0) || a.sort - b.sort; });
    var minis = mine.filter(function (t) { return t.kind === 'mini' && t.section === S.section; });
    var mini = minis.length ? minis[weekIndex() % minis.length] : null;
    var exam = lsGet('kh_topik_exam_date');
    var days = exam ? Math.ceil((new Date(exam + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000) : null;
    var done = {}; S.attempts.forEach(function (a) { if (!done[a.test_id]) done[a.test_id] = a; });

    function row(t, sub, badge) {
      var la = done[t.id];
      return '<button type="button" class="tp-t" data-test="' + t.id + '"><span class="ic">' + ico(t.kind === 'mini' ? 'zap' : (la ? 'circle-check' : SECTIONS[t.section].i)) + '</span>'
        + '<span><b>' + esc(t.title) + '</b><small>' + sub + (la ? ' · last: ' + la.score + '/100' : '') + '</small></span>' + badge + '</button>';
    }
    var nextUp = full.filter(function (t) { return !done[t.id] && (t.free || premium()) && t.status !== 'draft'; })[0];
    root.innerHTML = '<div class="tp-eb">TOPIK Practice</div>'
      + '<h1 class="tp-h1">Practice tests in the TOPIK format.</h1>'
      + '<p class="tp-sub">Original questions laid out like the real exam, timed, with an estimated level and the question types to work on.</p>'
      + '<div class="tp-seg" id="tp-lv"><button type="button" data-lv="I" class="' + (S.level === 'I' ? 'on' : '') + '">TOPIK I<small>Levels 1–2</small></button><button type="button" data-lv="II" class="' + (S.level === 'II' ? 'on' : '') + '">TOPIK II<small>Levels 3–6</small></button></div>'
      + '<div class="tp-seg" id="tp-sec">' + Object.keys(SECTIONS).map(function (k) {
          var n = mine.filter(function (t) { return t.kind === 'full' && t.section === k && t.status !== 'draft'; }).length;
          return '<button type="button" data-sec="' + k + '" class="' + (S.section === k ? 'on' : '') + '">' + SECTIONS[k].l + '<small>' + n + ' test' + (n === 1 ? '' : 's') + '</small></button>';
        }).join('') + '</div>'
      + '<div class="tp-dday"><b>' + (days != null && days >= 0 ? 'D-' + days : ico('calendar', 'kh-ui-icon')) + '</b><div><small>'
        + (days != null && days >= 0 ? 'Your exam: ' + new Date(exam + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + '<br>Plan: one full test a week + a mini test + Word Bank words every day' : 'Taking the TOPIK? Add your exam date for a countdown.')
        + '</small><input type="date" id="tp-exam" value="' + esc(exam || '') + '" aria-label="Exam date"></div></div>'
      + (nextUp ? '<div class="tp-k">Up next</div>' + row(nextUp, (COUNTS[S.level + '-' + S.section] || '') + ' · ' + nextUp.minutes + ' min', nextUp.free ? '<span class="tp-badge tp-free">FREE</span>' : '') : '')
      + (mini ? '<div class="tp-k">This week\'s mini test</div>' + row(mini, '10 questions · ' + (mini.minutes || 12) + ' min · new set every Monday', '<span class="tp-badge tp-free">FREE</span>') : '')
      + '<div class="tp-k">All ' + SECTIONS[S.section].l.toLowerCase() + ' tests (' + full.filter(function (t) { return t.status !== 'draft'; }).length + ')</div>'
      + (full.length ? full.map(function (t) {
          var badge = t.status === 'draft' ? '<span class="tp-badge tp-soon">DRAFT · ' + (t.flagged || 0) + ' flagged</span>'
            : (t.free ? '<span class="tp-badge tp-free">FREE</span>' : '<span class="tp-badge tp-pre">PREMIUM</span>');
          return row(t, (COUNTS[S.level + '-' + S.section] || '') + ' · ' + t.minutes + ' min', badge);
        }).join('') : '<div class="tp-empty">New ' + SECTIONS[S.section].l.toLowerCase() + ' tests are being written — check back soon.</div>')
      + (S.attempts.length ? '<div class="tp-k">Your results</div>' + S.attempts.slice(0, 5).map(function (a) {
          var t = S.tests.filter(function (x) { return x.id === a.test_id; })[0];
          return '<button type="button" class="tp-t" data-attempt="' + esc(a.id || '') + '"><span class="ic">' + ico('chart-column') + '</span><span><b>' + esc(t ? t.title : a.test_id) + '</b><small>'
            + new Date(a.finished_at).toLocaleDateString() + ' · ' + a.correct + '/' + a.total + ' correct · tap for details</small></span><span class="tp-badge tp-soon">' + a.score + '/100' + (a.est_level ? ' · ' + esc(a.est_level) : '') + '</span></button>';
        }).join('') : '')
      + (isAdmin() ? adminHtml() : '')
      + '<p class="tp-disc">TOPIK-style practice written by KoreHani — not affiliated with NIIED, the TOPIK organizer. Levels are estimates. Official past papers: <a href="https://www.topik.go.kr" target="_blank" rel="noopener">topik.go.kr</a>.</p>';
    root.querySelectorAll('[data-test]').forEach(function (b) { b.addEventListener('click', function () { startTest(b.dataset.test); }); });
    root.querySelectorAll('[data-attempt]').forEach(function (b) { b.addEventListener('click', function () { openAttempt(b.dataset.attempt); }); });
    root.querySelectorAll('[data-lv]').forEach(function (b) { b.addEventListener('click', function () { S.level = b.dataset.lv; renderHub(); }); });
    root.querySelectorAll('[data-sec]').forEach(function (b) { b.addEventListener('click', function () { S.section = b.dataset.sec; renderHub(); }); });
    var ex = $('tp-exam');
    if (ex) ex.addEventListener('change', function () { lsSet('kh_topik_exam_date', ex.value || null); renderHub(); });
    if (isAdmin()) wireAdmin();
    icons();
  }

  // ── Admin: review queue (stage 3 of scripts/topik/REVIEW.md) ──
  // New tests arrive as drafts. The admin reads every question with its
  // answer and explanation, flags anything wrong, and publishes only when
  // nothing is flagged. Learner reports land here too.
  function adminHtml() {
    return '<div class="tp-k">Admin · review</div><div id="tp-a-rev" class="tp-empty" style="padding:8px 0;text-align:left">Loading…</div>';
  }
  function wireAdmin() { loadReviewPanel(); }
  async function loadReviewPanel() {
    var box = $('tp-a-rev'); var c = sb(); if (!box || !c) return;
    var list = S.tests.filter(function (t) { return t.level === S.level && t.section === S.section; })
      .sort(function (a, b) { return (a.status === 'draft' ? 0 : 1) - (b.status === 'draft' ? 0 : 1) || a.sort - b.sort; });
    var rr = await c.from('topik_reports').select('id,item_id,test_id,note,created_at').is('resolved_at', null).order('created_at', { ascending: false }).limit(50);
    var reps = (rr && rr.data) || [];
    var btn = function (attr, label) { return '<button type="button" class="tp-sel" ' + attr + '>' + label + '</button>'; };
    box.innerHTML = '<div style="font-size:12.5px;margin-bottom:6px">Read every question with its answer before publishing. A test cannot be published while any question is flagged.</div>'
      + list.map(function (t) {
          var live = t.status !== 'draft';
          return '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:12.5px;padding:5px 0;border-top:1px solid rgba(255,255,255,.06)">'
            + '<span style="flex:1;min-width:160px"><b>' + esc(t.title) + '</b> · ' + (live ? 'live' : 'draft') + ' · ' + (t.flagged || 0) + ' flagged'
            + (t.approved_at ? ' · approved ' + new Date(t.approved_at).toLocaleDateString() : '') + '</span>'
            + btn('data-rev="' + t.id + '"', 'Review')
            + (live ? btn('data-unpub="' + t.id + '"', 'Move to draft') : btn('data-pub="' + t.id + '"' + ((t.flagged || 0) ? ' disabled' : ''), 'Publish'))
            + '</div>';
        }).join('')
      + '<div class="tp-k" style="margin-top:14px">Learner reports (' + reps.length + ' open)</div>'
      + (reps.length ? reps.map(function (r) {
          return '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:12.5px;padding:5px 0;border-top:1px solid rgba(255,255,255,.06)">'
            + '<span style="flex:1;min-width:160px"><b>' + esc(r.item_id) + '</b> · ' + esc(r.note) + '</span>'
            + btn('data-rev="' + esc(r.test_id) + '" data-focus="' + esc(r.item_id) + '"', 'Open')
            + btn('data-res="' + r.id + '"', 'Resolved') + '</div>';
        }).join('') : '<div style="font-size:12.5px">None.</div>');
    box.querySelectorAll('[data-rev]').forEach(function (b) { b.addEventListener('click', function () { openReview(b.dataset.rev, b.dataset.focus); }); });
    box.querySelectorAll('[data-pub],[data-unpub]').forEach(function (b) {
      b.addEventListener('click', function () { setTestStatus(b.dataset.pub || b.dataset.unpub, b.dataset.pub ? 'published' : 'draft'); });
    });
    box.querySelectorAll('[data-res]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var x = await c.from('topik_reports').update({ resolved_at: new Date().toISOString() }).eq('id', b.dataset.res);
        if (x.error) { if (typeof toast === 'function') toast(x.error.message, 'error'); return; }
        loadReviewPanel();
      });
    });
  }
  async function setTestStatus(id, status) {
    var c = sb(); if (!c) return;
    var patch = { status: status };
    if (status === 'published') {
      var f = await c.from('topik_items').select('id', { count: 'exact', head: true }).eq('test_id', id).not('qa_flag', 'is', null);
      if (f.count) { if (typeof toast === 'function') toast(f.count + ' question(s) still flagged — fix them first.', 'error'); return; }
      patch.approved_at = new Date().toISOString(); patch.flagged = 0;
    }
    var r = await c.from('topik_tests').update(patch).eq('id', id);
    if (r.error) { if (typeof toast === 'function') toast(r.error.message, 'error'); return; }
    if (typeof toast === 'function') toast(status === 'published' ? 'Published.' : 'Moved back to draft — learners no longer see it.', 'success');
    await loadTests();
    if (S.run && S.run.mode === 'review') { S.run.test = S.tests.filter(function (t) { return t.id === id; })[0] || S.run.test; renderReview(); }
    else renderHub();
  }
  async function openReview(id, focus) {
    var t = S.tests.filter(function (x) { return x.id === id; })[0];
    var c = sb(); if (!t || !c) return;
    var r = await c.from('topik_items').select(ITEM_COLS).eq('test_id', id).order('n');
    S.run = { mode: 'review', test: t, items: (r && r.data) || [], ans: {}, flags: {}, done: true };
    openOverlay(true);
    renderReview(focus);
  }
  function renderReview(focus) {
    var R = S.run, t = R.test;
    var flagged = R.items.filter(function (it) { return it.qa_flag; }).length;
    var live = t.status !== 'draft';
    $('tp-lbl').textContent = t.title + ' · review';
    $('tp-timer').innerHTML = '';
    $('tp-prog').style.width = '100%';
    var seenGroup = {};
    var html = '<div class="tp-exp" style="margin:0 0 6px">' + R.items.length + ' questions · <b>' + flagged + ' flagged</b> · ' + (live ? 'live' : 'draft')
      + '<br>For each question check: one right answer only, every other choice clearly wrong, natural Korean, the explanation is right.</div>'
      + R.items.map(function (it) {
          var showPassage = it.passage && (!it.group_key || !seenGroup[it.group_key]);
          if (it.group_key) seenGroup[it.group_key] = 1;
          var q = it.question || (TYPES[it.type] && TYPES[it.type].ko) || '';
          return '<div class="tp-wrong" id="rv-' + esc(it.id) + '"' + (it.qa_flag ? ' style="background:rgba(239,68,68,.08)"' : '') + '><div class="h">Q' + it.n + ' · ' + esc(typeLabel(it.type)) + (it.qa_flag ? ' · <span style="color:#fca5a5">FLAGGED: ' + esc(it.qa_flag) + '</span>' : '') + '</div>'
            + (it.instruction ? '<div style="font-size:12.5px;color:rgba(255,255,255,.6);margin-bottom:4px">' + esc(it.instruction) + '</div>' : '')
            + (it.script && it.script.length ? '<div class="tp-pass tp-script" style="margin:6px 0 8px;font-size:14px">' + it.script.map(function (l) { return '<b>' + esc(l.s || '') + '</b> ' + esc(l.t || ''); }).join('\n') + '</div>' : '')
            + (showPassage ? '<div class="tp-pass" style="margin:6px 0 8px;font-size:14.5px">' + rich(it.passage) + '</div>' : '')
            + (it.media && it.media.graph ? '<div class="tp-pass">' + graphSvg(it.media.graph, false) + '</div>' : '')
            + (q ? '<div style="font-size:13px;color:#fff;margin-bottom:4px">' + esc(q) + '</div>' : '')
            + '<div style="font-size:14px;line-height:1.7;font-family:\'Noto Sans KR\',sans-serif">' + it.choices.map(function (ch, i) {
                var ok = i + 1 === it.answer;
                return '<div style="' + (ok ? 'color:#6ee7b7;font-weight:700' : 'color:rgba(255,255,255,.85)') + '">' + NUMS[i] + ' ' + (typeof ch === 'string' ? esc(ch) : '[graph]') + (ok ? ' — answer' : '') + '</div>';
              }).join('') + '</div>'
            + (it.explanation ? '<div class="tp-exp">' + esc(it.explanation) + '</div>' : '')
            + '<div style="display:flex;gap:6px;margin-top:8px"><button type="button" class="tp-sel" data-flag="' + esc(it.id) + '">' + (it.qa_flag ? 'Edit flag' : 'Flag a problem') + '</button>'
            + (it.qa_flag ? '<button type="button" class="tp-sel" data-unflag="' + esc(it.id) + '">Clear flag</button>' : '') + '</div></div>';
        }).join('');
    var keep = $('tp-scroll').scrollTop;
    $('tp-q').innerHTML = html;
    $('tp-nav').innerHTML = '<button type="button" id="tp-rv-close">Close</button>'
      + (live ? '<button type="button" id="tp-rv-state">Move to draft</button>'
              : '<button type="button" class="p" id="tp-rv-state"' + (flagged ? ' disabled title="Clear every flag first"' : '') + '>Approve &amp; publish</button>');
    if (focus && $('rv-' + focus)) $('rv-' + focus).scrollIntoView({ block: 'start' }); else $('tp-scroll').scrollTop = keep;
    $('tp-rv-close').addEventListener('click', function () { closeOverlay(); renderHub(); });
    $('tp-rv-state').addEventListener('click', function () { setTestStatus(t.id, live ? 'draft' : 'published'); });
    $('tp-q').querySelectorAll('[data-flag],[data-unflag]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var id = b.dataset.flag || b.dataset.unflag;
        var it = R.items.filter(function (x) { return x.id === id; })[0];
        var note = null;
        if (b.dataset.flag) {
          note = typeof khPrompt === 'function' ? await khPrompt('Flag Q' + it.n, 'What is wrong? (e.g. "② also fits", "unnatural: …")', { defaultValue: it.qa_flag || '', okLabel: 'Flag' }) : prompt('What is wrong?', it.qa_flag || '');
          if (!note || !String(note).trim()) return;
          note = String(note).trim().slice(0, 300);
        }
        var c = sb();
        var x = await c.from('topik_items').update({ qa_flag: note }).eq('id', id);
        if (x.error) { if (typeof toast === 'function') toast(x.error.message, 'error'); return; }
        it.qa_flag = note;
        var n = R.items.filter(function (y) { return y.qa_flag; }).length;
        await c.from('topik_tests').update({ flagged: n }).eq('id', t.id).then(function () {}, function () {});
        t.flagged = n;
        renderReview();
      });
    });
    icons();
  }
  // Learners: report a question from the mistakes list.
  async function reportItem(it) {
    var c = sb(); if (!c || !user()) { if (typeof openAuthModal === 'function') openAuthModal('signup'); return; }
    var note = typeof khPrompt === 'function' ? await khPrompt('Report a problem', 'What is wrong with Q' + it.n + '? (e.g. two answers fit, a typo, the explanation is wrong)', { okLabel: 'Send' }) : prompt('What is wrong with this question?');
    if (!note || String(note).trim().length < 3) return;
    var r = await c.from('topik_reports').insert({ item_id: it.id, test_id: it.test_id, note: String(note).trim().slice(0, 500) });
    if (typeof toast === 'function') toast(r.error ? (/duplicate|unique/i.test(r.error.message) ? 'You already reported this question — thanks.' : 'Could not send: ' + r.error.message) : 'Thanks — we will check this question.', r.error ? 'error' : 'success');
  }

  // ── Test runner ──
  var ITEM_COLS = 'id,test_id,n,type,group_key,passage,question,choices,answer,explanation,instruction,script,media,audio_url,qa_flag';
  async function startTest(id) {
    var t = S.tests.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    if (!t.free && !premium()) { if (typeof requirePlan === 'function') requirePlan('topik_full'); return; }
    var c = sb(); if (!c) return;
    var r = await c.from('topik_items').select(ITEM_COLS).eq('test_id', id).order('n');
    var items = (r && r.data) || [];
    if (!items.length) {
      if (!t.free && typeof requirePlan === 'function') requirePlan('topik_full');
      else if (typeof khAlert === 'function') khAlert('TOPIK Practice', 'This test could not be loaded. Please try again.', { okLabel: 'OK' });
      return;
    }
    var saved = lsGet('kh_topik_prog_' + id);
    var resume = saved && saved.endAt > Date.now();
    S.run = { mode: 'test', test: t, items: items, idx: resume ? saved.idx || 0 : 0, ans: resume ? saved.ans || {} : {}, flags: resume ? saved.flags || {} : {},
      endAt: resume ? saved.endAt : Date.now() + t.minutes * 60000, started: resume ? saved.started : Date.now() };
    openOverlay();
  }

  function startDrill(type) {
    var pool = (S.run && S.run.items || []).filter(function (it) { return it.type === type; });
    var c = sb();
    var finish = function (rows) {
      var list = rows.filter(function (it) { return it.type === type; });
      for (var i = list.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = list[i]; list[i] = list[j]; list[j] = tmp; }
      list = list.slice(0, 10);
      if (!list.length) return;
      var src0 = (S.run && S.run.test) || {};
      S.run = { mode: 'drill', test: { title: 'Drill · ' + typeLabel(type), minutes: 0, level: src0.level, section: src0.section }, items: list, idx: 0, ans: {}, flags: {}, endAt: 0, started: Date.now() };
      openOverlay();
    };
    if (!c) return finish(pool);
    // Same exam level + section as the test just taken.
    var src = S.run && S.run.test || {};
    var ids = S.tests.filter(function (t) { return t.level === src.level && t.section === src.section && t.status !== 'draft'; }).map(function (t) { return t.id; });
    if (!ids.length) return finish(pool);
    c.from('topik_items').select(ITEM_COLS).eq('type', type).in('test_id', ids).limit(80)
      .then(function (r) { finish(((r && r.data) || []).length ? r.data : pool); }, function () { finish(pool); });
  }

  function save() { var R = S.run; if (R && R.mode === 'test') lsSet('kh_topik_prog_' + R.test.id, { idx: R.idx, ans: R.ans, flags: R.flags, endAt: R.endAt, started: R.started }); }

  // Reopen a saved attempt: same result screen, built from the stored answers.
  async function openAttempt(id) {
    var a = S.attempts.filter(function (x) { return x.id === id; })[0];
    var t = a && S.tests.filter(function (x) { return x.id === a.test_id; })[0];
    var c = sb();
    if (!a || !t || !c) return;
    var r = await c.from('topik_items').select(ITEM_COLS).eq('test_id', t.id).order('n');
    var items = (r && r.data) || [];
    if (!items.length) { if (!t.free && typeof requirePlan === 'function') requirePlan('topik_full'); return; }
    S.run = { mode: 'test', test: t, items: items, idx: 0, ans: a.answers || {}, flags: {}, endAt: 0, started: 0, done: true, saved: true };
    S.run.result = score(S.run, false);
    openOverlay(true);
    renderResult();
  }
  function openOverlay(resultOnly) {
    closeOverlay();
    var ov = document.createElement('div');
    ov.className = 'tp-ov'; ov.id = 'tp-ov';
    ov.innerHTML = '<div class="tp-bar"><button type="button" class="x" id="tp-x" aria-label="Close">' + ico('x') + '</button><span id="tp-lbl"></span><span class="tp-timer" id="tp-timer"></span></div>'
      + '<div class="tp-prog"><i id="tp-prog"></i></div><div class="tp-scroll" id="tp-scroll"><div class="tp-q" id="tp-q"></div></div>'
      + '<div class="tp-nav" id="tp-nav"></div>';
    document.body.appendChild(ov);
    document.body.classList.add('tp-locked');
    $('tp-x').addEventListener('click', function () {
      var R = S.run;
      if (R && R.mode === 'test' && !R.done) {
        var go = function () { save(); closeOverlay(); renderHub(); };
        if (typeof khConfirm === 'function') khConfirm('Leave the test?', 'Your answers are kept, and the timer keeps running. Come back before it ends to finish.', { okLabel: 'Leave', cancelLabel: 'Stay' }).then(function (ok) { if (ok) go(); });
        else if (confirm('Leave the test? The timer keeps running.')) go();
        return;
      }
      closeOverlay(); renderHub();
    });
    if (resultOnly) return;
    if (S.run.mode === 'test') { tick(); S.run.timer = setInterval(tick, 1000); }
    else $('tp-timer').innerHTML = '';
    renderQ();
  }
  function closeOverlay() {
    stopAudio();
    if (S.run && S.run.timer) clearInterval(S.run.timer);
    var o = $('tp-ov'); if (o) o.remove();
    document.body.classList.remove('tp-locked');
  }
  function tick() {
    var R = S.run; if (!R || R.done) return;
    var left = Math.max(0, R.endAt - Date.now());
    var el = $('tp-timer');
    if (el) { var m = Math.floor(left / 60000), s = Math.floor(left / 1000) % 60; el.innerHTML = ico('timer') + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; el.classList.toggle('low', left < 5 * 60000); icons(); }
    if (left <= 0) submit(true);
  }

  function groupRange(it) {
    if (!it.group_key) return '';
    var ns = S.run.items.filter(function (x) { return x.group_key === it.group_key; }).map(function (x) { return x.n; });
    return ns.length > 1 && S.run.mode === 'test' ? '[' + Math.min.apply(null, ns) + '–' + Math.max.apply(null, ns) + '] ' : '';
  }

  function renderQ() {
    var R = S.run, it = R.items[R.idx], n = R.items.length;
    var picked = R.ans[it.id];
    var drillShown = R.mode === 'drill' && picked != null;
    $('tp-lbl').textContent = R.test.title + ' · ' + (R.idx + 1) + ' / ' + n;
    $('tp-prog').style.width = Math.round((R.idx + 1) / n * 100) + '%';
    var ty = TYPES[it.type] || { ko: '', en: '' };
    var ins = it.instruction || ty.ko || '';
    var listening = !!(it.script && it.script.length);
    var showScript = R.mode !== 'test' && picked != null;
    var html = '<div class="tp-ins">' + (R.mode === 'test' ? it.n + '. ' : '') + (it.instruction ? '' : groupRange(it)) + esc(ins) + '<small>' + esc(typeLabel(it.type)) + '</small></div>'
      + (listening ? '<div class="tp-listen"><button type="button" class="tp-play" id="tp-play">' + ico('volume-2', 'kh-ui-icon') + '<span>Play</span></button>'
          + '<small>' + (it.audio_url ? 'Tap to listen. You can replay it.' : 'Played with your device voice.') + '</small></div>'
          + (showScript ? '<div class="tp-pass tp-script">' + it.script.map(function (l) { return '<b>' + esc(l.s || '') + '</b> ' + esc(l.t || ''); }).join('\n') + '</div>' : '') : '')
      + (it.passage ? '<div class="tp-pass">' + rich(it.passage) + '</div>' : '')
      + (it.media && it.media.graph ? '<div class="tp-pass">' + graphSvg(it.media.graph, false) + '</div>' : '')
      + (it.question ? '<div class="tp-ins" style="color:#fff">' + esc(it.question) + '</div>' : '')
      + (it.choices || []).map(function (ch, k) {
          var cls = '';
          if (drillShown) cls = (k + 1 === it.answer) ? ' ok' : (k + 1 === picked ? ' bad' : '');
          else if (picked === k + 1) cls = ' sel';
          return '<button type="button" class="tp-ch' + cls + '" data-k="' + (k + 1) + '"><span class="no">' + (k + 1) + '</span>' + choiceHtml(ch) + '</button>';
        }).join('')
      + (drillShown ? '<div class="tp-exp">' + (picked === it.answer ? '<b style="color:#6ee7b7">Correct.</b> ' : '<b style="color:#fca5a5">Answer: ' + NUMS[it.answer - 1] + '</b> ') + esc(it.explanation || '') + '</div>' : '');
    if (R.mode === 'test') {
      html += '<div class="tp-map">' + R.items.map(function (x, i) {
        return '<button type="button" data-i="' + i + '" class="' + (R.ans[x.id] ? 'a ' : '') + (R.flags[x.id] ? 'f ' : '') + (i === R.idx ? 'cur' : '') + '">' + x.n + '</button>';
      }).join('') + '</div>';
    }
    $('tp-q').innerHTML = html;
    $('tp-scroll').scrollTop = 0;
    var pl = $('tp-play');
    if (pl) {
      pl.addEventListener('click', function () { playItem(it, pl); });
      // Play once automatically when a new listening item (or set) opens.
      if (R.mode === 'test' && R._lastPlayed !== (it.group_key || it.id) && picked == null) { R._lastPlayed = it.group_key || it.id; setTimeout(function () { if ($('tp-play') === pl) playItem(it, pl); }, 400); }
    }
    var last = R.idx === n - 1;
    $('tp-nav').innerHTML = '<button type="button" id="tp-prev"' + (R.idx === 0 ? ' disabled' : '') + '>Back</button>'
      + (R.mode === 'test' ? '<button type="button" id="tp-flag" class="' + (R.flags[it.id] ? 'on' : '') + '">' + ico('flag') + 'Flag</button>' : '')
      + '<button type="button" class="p" id="tp-next">' + (last ? (R.mode === 'test' ? 'Submit' : 'Finish') : 'Next') + '</button>';
    $('tp-q').querySelectorAll('.tp-ch').forEach(function (b) {
      b.addEventListener('click', function () {
        if (R.mode === 'drill' && R.ans[it.id] != null) return;
        R.ans[it.id] = Number(b.dataset.k); save(); renderQ();
      });
    });
    $('tp-q').querySelectorAll('.tp-map button').forEach(function (b) { b.addEventListener('click', function () { R.idx = Number(b.dataset.i); save(); renderQ(); }); });
    $('tp-prev').addEventListener('click', function () { if (R.idx > 0) { R.idx--; save(); renderQ(); } });
    var fl = $('tp-flag'); if (fl) fl.addEventListener('click', function () { R.flags[it.id] = !R.flags[it.id]; save(); renderQ(); });
    $('tp-next').addEventListener('click', function () {
      if (!last) { R.idx++; save(); renderQ(); return; }
      if (R.mode === 'drill') { submit(false); return; }
      var blank = R.items.filter(function (x) { return !R.ans[x.id]; }).length;
      var go = function () { submit(false); };
      if (!blank) return go();
      if (typeof khConfirm === 'function') khConfirm('Submit the test?', blank + ' question' + (blank === 1 ? ' is' : 's are') + ' unanswered. Unanswered questions count as wrong.', { okLabel: 'Submit', cancelLabel: 'Keep going' }).then(function (ok) { if (ok) go(); });
      else if (confirm('Submit with ' + blank + ' unanswered?')) go();
    });
    icons();
  }

  // TOPIK cut scores: I = 80 / 140 of 200; II = 120 / 150 / 190 / 230 of 300.
  // One section is scaled as if the other section(s) scored the same.
  function estLevel(score, t) {
    if (t.kind !== 'full') return null;
    if (t.level === 'I') { var a = score * 2; return a >= 140 ? 'Level 2' : (a >= 80 ? 'Level 1' : 'Below level 1'); }
    var b = score * 3;
    return b >= 230 ? 'Level 6' : b >= 190 ? 'Level 5' : b >= 150 ? 'Level 4' : b >= 120 ? 'Level 3' : 'Below level 3';
  }

  function score(R, timeUp) {
    var byType = {}, correct = 0;
    R.items.forEach(function (it) {
      var ok = Number(R.ans[it.id]) === it.answer;
      if (ok) correct++;
      var b = byType[it.type] || (byType[it.type] = [0, 0]);
      b[1]++; if (ok) b[0]++;
    });
    var total = R.items.length, sc = Math.round(correct / total * 100);
    return { correct: correct, total: total, score: sc, byType: byType, level: R.mode === 'test' ? estLevel(sc, R.test) : null, timeUp: timeUp };
  }
  async function submit(timeUp) {
    var R = S.run; if (!R || R.done) return;
    R.done = true;
    if (R.timer) clearInterval(R.timer);
    R.result = score(R, timeUp);
    var correct = R.result.correct, total = R.result.total, byType = R.result.byType, score_ = R.result.score;
    if (R.mode === 'test') {
      lsSet('kh_topik_prog_' + R.test.id, null);
      var c = sb();
      if (c && user()) {
        var row = { test_id: R.test.id, answers: R.ans, correct: correct, total: total, score: score_, by_type: byType, est_level: R.result.level, seconds: Math.round((Date.now() - R.started) / 1000) };
        try { var ins = await c.from('topik_attempts').insert(row).select('id').maybeSingle(); S.attempts.unshift(Object.assign({ id: ins && ins.data ? ins.data.id : null, finished_at: new Date().toISOString() }, row)); } catch (_) {}
      }
      try { if (typeof khTrackUser === 'function') khTrackUser('topik_test', { test: R.test.id, score: score_ }); } catch (_) {}
    }
    renderResult();
  }

  function renderResult() {
    var R = S.run, res = R.result;
    $('tp-lbl').textContent = R.test.title + ' · result';
    $('tp-timer').innerHTML = '';
    $('tp-prog').style.width = '100%';
    var types = Object.keys(res.byType).sort(function (a, b) { return (res.byType[a][0] / res.byType[a][1]) - (res.byType[b][0] / res.byType[b][1]); });
    var weak = types.filter(function (k) { var b = res.byType[k]; return b[1] >= 2 && b[0] / b[1] < 0.7; }).slice(0, 3);
    var wrong = R.items.filter(function (it) { return R.ans[it.id] !== it.answer; });
    var html = '<div class="tp-res"><div class="lv">' + (res.level ? 'Estimated' : 'Score') + '</div><b>' + (res.level || res.score + ' / 100') + '</b><small>'
      + res.correct + ' of ' + res.total + ' correct · ' + res.score + ' / 100' + (res.timeUp ? ' · time ran out' : '')
      + (res.level ? (R.test.level === 'II' ? '<br>TOPIK II: level 3/4/5/6 = 120/150/190/230 of 300. This assumes your other sections score the same.' : '<br>TOPIK I: level 1 = 80+, level 2 = 140+ of 200. This assumes your other section scores the same.') : '') + '</small></div>';
    if (R.mode === 'test') {
      html += '<div class="tp-k">By question type</div><div class="tp-bars">' + types.slice().reverse().map(function (k) {
        var b = res.byType[k], pct = Math.round(b[0] / b[1] * 100);
        return '<div class="tp-brow"><div><span>' + esc(typeLabel(k)) + '</span><span>' + b[0] + '/' + b[1] + '</span></div><span class="tp-track"><i class="' + (pct < 70 ? 'w' : '') + '" style="width:' + pct + '%"></i></span></div>';
      }).join('') + '</div>';
      if (weak.length) html += '<div class="tp-k">Study next</div>' + weak.map(function (k) {
        return '<button type="button" class="tp-weak" data-drill="' + k + '"><span><b>' + esc(typeLabel(k)) + '</b><small>' + esc(TIPS[k] || '') + '</small></span><span class="go">Drill ›</span></button>';
      }).join('');
    }
    if (wrong.length) {
      // Grouped questions share one passage: show it with the first wrong
      // question of the group and point back to it for the rest.
      var shownGroup = {};
      var passageOf = function (it) {
        if (it.passage || !it.group_key) return it.passage || '';
        var src = R.items.filter(function (x) { return x.group_key === it.group_key && x.passage; })[0];
        return src ? src.passage : '';
      };
      html += '<div class="tp-k">Review mistakes (' + wrong.length + ')</div>' + wrong.map(function (it) {
        var mine = R.ans[it.id];
        var pass = passageOf(it), passHtml = '';
        if (pass) {
          if (it.group_key && shownGroup[it.group_key]) passHtml = '<div style="font-size:12.5px;color:rgba(255,255,255,.6);margin:6px 0">Same passage as Q' + shownGroup[it.group_key] + ' above.</div>';
          else passHtml = '<div class="tp-pass" style="margin:6px 0 8px;font-size:14.5px">' + rich(pass) + '</div>';
          if (it.group_key && !shownGroup[it.group_key]) shownGroup[it.group_key] = it.n;
        }
        return '<div class="tp-wrong"><div class="h">' + (R.mode === 'test' ? 'Q' + it.n + ' · ' : '') + esc(typeLabel(it.type)) + '</div>'
          + (it.script && it.script.length ? '<div class="tp-pass tp-script" style="margin:6px 0 8px;font-size:14px">' + it.script.map(function (l) { return '<b>' + esc(l.s || '') + '</b> ' + esc(l.t || ''); }).join('\n') + '</div>' : '')
          + passHtml
          + (it.media && it.media.graph ? '<div class="tp-pass">' + graphSvg(it.media.graph, false) + '</div>' : '')
          + (it.question ? '<div style="font-size:13px;color:#fff;margin-bottom:4px">' + esc(it.question) + '</div>' : '')
          + '<div style="font-size:14px;line-height:1.6;font-family:\'Noto Sans KR\',sans-serif">'
          + (mine ? '<span style="color:#fca5a5">Your answer: ' + NUMS[mine - 1] + ' ' + (typeof it.choices[mine - 1] === 'string' ? esc(it.choices[mine - 1]) : '') + '</span><br>' : '<span style="color:#fca5a5">No answer</span><br>')
          + '<span style="color:#6ee7b7">Answer: ' + NUMS[it.answer - 1] + ' ' + (typeof it.choices[it.answer - 1] === 'string' ? esc(it.choices[it.answer - 1]) : '') + '</span></div>'
          + (it.explanation ? '<div class="tp-exp">' + esc(it.explanation) + '</div>' : '')
          + '<button type="button" class="tp-rep" data-rep="' + esc(it.id) + '">Report a problem with this question</button></div>';
      }).join('');
    }
    if (!user() && R.mode === 'test') html += '<button type="button" class="tp-btn" id="tp-signup">' + ico('user-plus') + 'Sign up free to keep your results</button>';
    $('tp-q').innerHTML = html;
    $('tp-scroll').scrollTop = 0;
    $('tp-nav').innerHTML = '<button type="button" id="tp-again">' + (R.mode === 'drill' ? 'Another drill' : 'Try again') + '</button><button type="button" class="p" id="tp-done">Done</button>';
    $('tp-q').querySelectorAll('[data-drill]').forEach(function (b) { b.addEventListener('click', function () { startDrill(b.dataset.drill); }); });
    $('tp-q').querySelectorAll('[data-rep]').forEach(function (b) { b.addEventListener('click', function () { reportItem(R.items.filter(function (x) { return x.id === b.dataset.rep; })[0]); }); });
    var su = $('tp-signup'); if (su) su.addEventListener('click', function () { if (typeof openAuthModal === 'function') openAuthModal('signup'); });
    $('tp-again').addEventListener('click', function () {
      if (R.mode === 'drill') { var t = R.items[0] && R.items[0].type; if (t) startDrill(t); }
      else { lsSet('kh_topik_prog_' + R.test.id, null); startTest(R.test.id); }
    });
    $('tp-done').addEventListener('click', function () { closeOverlay(); renderHub(); });
    icons();
  }

  async function start() {
    await loadTests();
    renderHub();
    var t = /[?&]test=([\w-]+)/.exec(location.search);
    if (t) whenReady(function () { whenPlanKnown(function () { startTest(t[1]); }); });
  }
  // Deep link (?test=…): a Premium test can only open once we know who is
  // signed in and their plan — otherwise requirePlan() just says "tap again".
  function whenPlanKnown(fn) {
    var started = Date.now(), fired = false;
    var go = function () { if (fired) return; fired = true; window.removeEventListener('kh-plan-loaded', onPlan); fn(); };
    var onPlan = function () { go(); };
    window.addEventListener('kh-plan-loaded', onPlan);
    (function check() {
      if (fired) return;
      var sessionKnown = !!window._sessionChecked || !!user();
      var planKnown = typeof _userPlanLoaded === 'undefined' || _userPlanLoaded;
      if (sessionKnown && (!user() || planKnown)) return go();
      if (Date.now() - started > 10000) return go();   // never hang: fall back to the normal path
      setTimeout(check, 100);
    })();
  }
  // Session-dependent data (attempts, admin drafts) once the shared scripts
  // and the session are in; repaint the hub if it is showing.
  function afterAuth() {
    whenReady(async function () {
      try { if (isAdmin()) await loadTests(); await loadAttempts(); } catch (_) {}
      if (!document.getElementById('tp-ov')) renderHub();
    });
  }
  function whenReady(fn, n) {
    n = n || 0;
    if (sb() || n > 40) return fn();
    setTimeout(function () { whenReady(fn, n + 1); }, 100);
  }
  // Loaded before the shared scripts: with the head prefetch, paint now.
  if (window._tpPrefetch && document.getElementById('tp-root')) start();
  else document.addEventListener('DOMContentLoaded', function () { whenReady(start); });
  document.addEventListener('DOMContentLoaded', function () { icons(); setTimeout(afterAuth, 0); });
  window.addEventListener('kh-auth-signed-in', afterAuth);
  window.addEventListener('kh-plan-loaded', function () { if (!document.getElementById('tp-ov')) renderHub(); });
})();
