/* TOPIK Practice (mockup K, 2026-10-28). ORIGINAL questions in the real TOPIK
   layout: TOPIK I/II reading + listening. Hand-written tests come from
   scripts/topik/items.mjs; most tests are written by the topik-gen Edge
   Function from _shared/topik-spec.ts (blind-checked before publishing).
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
    l_topic: { en: 'What it is about' }, l_picture: { en: 'Choose the picture' }, l_graph: { en: 'Choose the graph' },
    l_match: { en: 'Matches what you heard' }, l_main: { en: 'Main idea' }, l_action: { en: 'What she does next' }, l_set: { en: 'Long listening' },
    answer: { en: 'Answer the question' }, next: { en: 'What comes next' }, place: { en: 'Where are they?' }, picture: { en: 'Choose the picture' },
    reason: { en: 'Reason' }, action: { en: 'Next action' }, grammar: { en: 'Grammar blank' }, similar: { en: 'Similar meaning' },
    about: { en: 'What it is about (ads, signs)' }, graph: { en: 'Graph' }, feeling: { en: 'Feelings' }, headline: { en: 'Newspaper headline' },
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
    infer: 'Pick only what the text supports — not what might also be true.'
  };
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
      var q = c.from('topik_tests').select('id,level,section,kind,title,minutes,free,sort,number,status,flagged').order('sort');
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
      + (mini ? '<div class="tp-k">This week\'s mini test</div>' + row(mini, '10 questions · about 10 min · new set every Monday', '<span class="tp-badge tp-free">FREE</span>') : '')
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

  // ── Admin: queue generated tests, watch jobs, publish drafts ──
  function adminHtml() {
    return '<div class="tp-k">Admin · generate tests</div>'
      + '<div class="tp-t" style="cursor:default;flex-wrap:wrap;gap:8px">'
      + '<select id="tp-a-lv" class="tp-sel"><option value="I"' + (S.level === 'I' ? ' selected' : '') + '>TOPIK I</option><option value="II"' + (S.level === 'II' ? ' selected' : '') + '>TOPIK II</option></select>'
      + '<select id="tp-a-sec" class="tp-sel"><option value="reading"' + (S.section === 'reading' ? ' selected' : '') + '>Reading</option><option value="listening"' + (S.section === 'listening' ? ' selected' : '') + '>Listening</option></select>'
      + '<input id="tp-a-n" class="tp-sel" type="number" min="1" max="20" value="5" style="width:64px">'
      + '<button type="button" class="tp-btn p" id="tp-a-go" style="width:auto;margin:0;padding:9px 14px">Queue tests</button>'
      + '<small style="flex-basis:100%">Each test: about 15–25 min on the server, roughly $0.5–1 in AI. Tests publish automatically when every question passes the blind check; otherwise they stay as drafts here.</small></div>'
      + '<div id="tp-a-jobs" class="tp-empty" style="padding:8px 0;text-align:left">Loading jobs…</div>';
  }
  async function wireAdmin() {
    var go = $('tp-a-go');
    if (go) go.addEventListener('click', async function () {
      go.disabled = true; go.textContent = 'Queuing…';
      var c = sb(), sess = c ? await c.auth.getSession() : null;
      var token = sess && sess.data && sess.data.session && sess.data.session.access_token;
      try {
        var r = await fetch(SUPA_URL + '/functions/v1/topik-gen', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, apikey: SUPA_KEY },
          body: JSON.stringify({ action: 'enqueue', level: $('tp-a-lv').value, section: $('tp-a-sec').value, count: Number($('tp-a-n').value) || 1 }) });
        var res = await r.json().catch(function () { return {}; });
        if (typeof toast === 'function') toast(res.ok ? 'Queued ' + res.queued + ' test(s) — they run on the server, you can close this page.' : 'Could not queue: ' + (res.error || r.status), res.ok ? 'success' : 'error');
      } catch (e) { if (typeof toast === 'function') toast('Could not queue: ' + e.message, 'error'); }
      go.disabled = false; go.textContent = 'Queue tests';
      loadJobs();
    });
    loadJobs();
  }
  async function loadJobs() {
    var box = $('tp-a-jobs'); var c = sb(); if (!box || !c) return;
    var r = await c.from('topik_gen_jobs').select('id,level,section,status,progress,test_id,error,ticks,created_at').order('created_at', { ascending: false }).limit(20);
    var jobs = (r && r.data) || [];
    var drafts = S.tests.filter(function (t) { return t.status === 'draft' && t.kind === 'full'; });
    box.innerHTML = (jobs.length ? jobs.map(function (j) {
        var p = j.progress || {};
        var stepTxt = j.status === 'done' ? (j.test_id || 'done') : (j.test_id ? 'saving audio' : 'chunk ' + ((p.chunk || 0) + 1) + (p.pending ? ' · checking' : ' · writing') + (p.tries ? ' · rewrite ' + p.tries : ''));
        return '<div style="font-size:12.5px;padding:4px 0">TOPIK ' + j.level + ' ' + j.section + ' — <b>' + j.status + '</b> · ' + esc(stepTxt) + (j.error ? ' · <span style="color:#fca5a5">' + esc(j.error) + '</span>' : '') + '</div>';
      }).join('') : '<div style="font-size:12.5px">No jobs yet.</div>')
      + (drafts.length ? '<div style="margin-top:8px;font-size:12.5px">Drafts (open to review, then publish):</div>' + drafts.map(function (t) {
          return '<div style="display:flex;gap:8px;align-items:center;font-size:12.5px;padding:4px 0"><span>' + esc(t.title) + ' · ' + (t.flagged || 0) + ' flagged</span><button type="button" class="tp-sel" data-pub="' + t.id + '">Publish</button></div>';
        }).join('') : '');
    box.querySelectorAll('[data-pub]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var rr = await c.from('topik_tests').update({ status: 'published' }).eq('id', b.dataset.pub);
        if (rr.error) { if (typeof toast === 'function') toast(rr.error.message, 'error'); return; }
        await loadTests(); renderHub();
      });
    });
    if (jobs.some(function (j) { return j.status === 'pending' || j.status === 'running'; })) {
      clearTimeout(S.jobTimer);
      S.jobTimer = setTimeout(function () { if ($('tp-a-jobs')) loadJobs(); }, 30000);
    }
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
      html += '<div class="tp-k">Review mistakes (' + wrong.length + ')</div>' + wrong.map(function (it) {
        var mine = R.ans[it.id];
        return '<div class="tp-wrong"><div class="h">' + (R.mode === 'test' ? 'Q' + it.n + ' · ' : '') + esc(typeLabel(it.type)) + '</div>'
          + (it.script && it.script.length ? '<div class="tp-pass tp-script" style="margin:6px 0 8px;font-size:14px">' + it.script.map(function (l) { return '<b>' + esc(l.s || '') + '</b> ' + esc(l.t || ''); }).join('\n') + '</div>' : '')
          + (it.passage && !it.group_key ? '<div class="tp-pass" style="margin:6px 0 8px;font-size:14.5px">' + rich(it.passage) + '</div>' : '')
          + (it.question ? '<div style="font-size:13px;color:#fff;margin-bottom:4px">' + esc(it.question) + '</div>' : '')
          + '<div style="font-size:14px;line-height:1.6;font-family:\'Noto Sans KR\',sans-serif">'
          + (mine ? '<span style="color:#fca5a5">Your answer: ' + NUMS[mine - 1] + ' ' + (typeof it.choices[mine - 1] === 'string' ? esc(it.choices[mine - 1]) : '') + '</span><br>' : '<span style="color:#fca5a5">No answer</span><br>')
          + '<span style="color:#6ee7b7">Answer: ' + NUMS[it.answer - 1] + ' ' + (typeof it.choices[it.answer - 1] === 'string' ? esc(it.choices[it.answer - 1]) : '') + '</span></div>'
          + (it.explanation ? '<div class="tp-exp">' + esc(it.explanation) + '</div>' : '') + '</div>';
      }).join('');
    }
    if (!user() && R.mode === 'test') html += '<button type="button" class="tp-btn" id="tp-signup">' + ico('user-plus') + 'Sign up free to keep your results</button>';
    $('tp-q').innerHTML = html;
    $('tp-scroll').scrollTop = 0;
    $('tp-nav').innerHTML = '<button type="button" id="tp-again">' + (R.mode === 'drill' ? 'Another drill' : 'Try again') + '</button><button type="button" class="p" id="tp-done">Done</button>';
    $('tp-q').querySelectorAll('[data-drill]').forEach(function (b) { b.addEventListener('click', function () { startDrill(b.dataset.drill); }); });
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
    if (t) whenReady(function () { startTest(t[1]); });
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
