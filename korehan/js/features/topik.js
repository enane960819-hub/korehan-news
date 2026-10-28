/* TOPIK Practice (mockup K, 2026-10-28). ORIGINAL questions in the TOPIK I
   Reading format (scripts/topik/items.mjs → topik_tests / topik_items).
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
    infer:  { ko: '이 글을 읽고 알 수 있는 것을 고르십시오.', en: 'What you can tell' }
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
  var S = { level: 'I', tests: [], attempts: [], run: null };

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

  async function loadTests() {
    var c = sb(); if (!c) return;
    var r = await c.from('topik_tests').select('id,level,section,kind,title,minutes,free,sort').eq('status', 'published').order('sort');
    S.tests = (r && r.data) || [];
    if (user()) {
      var a = await c.from('topik_attempts').select('test_id,score,correct,total,est_level,finished_at').order('finished_at', { ascending: false }).limit(40);
      S.attempts = (a && a.data) || [];
    }
  }
  function lastAttempt(id) { return S.attempts.filter(function (a) { return a.test_id === id; })[0]; }

  // ── Hub ──
  function renderHub() {
    var root = $('tp-root'); if (!root) return;
    var tests = S.tests.filter(function (t) { return t.level === S.level; });
    var full = tests.filter(function (t) { return t.kind === 'full'; });
    var minis = tests.filter(function (t) { return t.kind === 'mini'; });
    var mini = minis.length ? minis[weekIndex() % minis.length] : null;
    var exam = lsGet('kh_topik_exam_date');
    var days = exam ? Math.ceil((new Date(exam + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000) : null;

    function row(t, sub, badge) {
      var la = lastAttempt(t.id);
      return '<button type="button" class="tp-t" data-test="' + t.id + '"><span class="ic">' + ico(t.kind === 'mini' ? 'zap' : 'file-text') + '</span>'
        + '<span><b>' + esc(t.title) + '</b><small>' + sub + (la ? ' · last: ' + la.score + '/100' : '') + '</small></span>' + badge + '</button>';
    }
    root.innerHTML = '<div class="tp-eb">TOPIK Practice</div>'
      + '<h1 class="tp-h1">Practice tests in the TOPIK format.</h1>'
      + '<p class="tp-sub">Original questions, timed like the real exam, with an estimated level and the question types to work on.</p>'
      + '<div class="tp-seg"><button type="button" class="on">TOPIK I<small>Levels 1–2</small></button><button type="button" disabled>TOPIK II<small>Coming soon</small></button></div>'
      + '<div class="tp-dday"><b>' + (days != null && days >= 0 ? 'D-' + days : ico('calendar', 'kh-ui-icon')) + '</b><div><small>'
        + (days != null && days >= 0 ? 'Your exam: ' + new Date(exam + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + '<br>Plan: one mini test a week + Word Bank words every day' : 'Taking the TOPIK? Add your exam date for a countdown.')
        + '</small><input type="date" id="tp-exam" value="' + esc(exam || '') + '" aria-label="Exam date"></div></div>'
      + '<div class="tp-k">Full practice tests</div>'
      + full.map(function (t) {
          var lockedBadge = t.free ? '<span class="tp-badge tp-free">FREE</span>' : '<span class="tp-badge tp-pre">PREMIUM</span>';
          return row(t, (t.kind === 'full' ? '40 questions · ' : '') + t.minutes + ' min', lockedBadge);
        }).join('')
      + '<div class="tp-t" style="cursor:default"><span class="ic">' + ico('headphones') + '</span><span><b>Practice Test 1 · Listening</b><small>30 questions · 40 min</small></span><span class="tp-badge tp-soon">SOON</span></div>'
      + (mini ? '<div class="tp-k">This week\'s mini test</div>' + row(mini, '10 questions · about 10 min · new set every Monday', '<span class="tp-badge tp-free">FREE</span>') : '')
      + (S.attempts.length ? '<div class="tp-k">Your results</div>' + S.attempts.slice(0, 5).map(function (a) {
          var t = S.tests.filter(function (x) { return x.id === a.test_id; })[0];
          return '<div class="tp-t" style="cursor:default"><span class="ic">' + ico('chart-column') + '</span><span><b>' + esc(t ? t.title : a.test_id) + '</b><small>'
            + new Date(a.finished_at).toLocaleDateString() + ' · ' + a.correct + '/' + a.total + ' correct</small></span><span class="tp-badge tp-soon">' + a.score + '/100' + (a.est_level ? ' · ' + esc(a.est_level) : '') + '</span></div>';
        }).join('') : '')
      + '<p class="tp-disc">TOPIK-style practice written by KoreHani — not affiliated with NIIED, the TOPIK organizer. Levels are estimates. Official past papers: <a href="https://www.topik.go.kr" target="_blank" rel="noopener">topik.go.kr</a>.</p>';
    root.querySelectorAll('[data-test]').forEach(function (b) { b.addEventListener('click', function () { startTest(b.dataset.test); }); });
    var ex = $('tp-exam');
    if (ex) ex.addEventListener('change', function () { lsSet('kh_topik_exam_date', ex.value || null); renderHub(); });
    icons();
  }

  // ── Test runner ──
  async function startTest(id) {
    var t = S.tests.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    if (!t.free && !premium()) { if (typeof requirePlan === 'function') requirePlan('topik_full'); return; }
    var c = sb(); if (!c) return;
    var r = await c.from('topik_items').select('id,n,type,group_key,passage,question,choices,answer,explanation').eq('test_id', id).order('n');
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
      S.run = { mode: 'drill', test: { title: 'Drill · ' + TYPES[type].en, minutes: 0 }, items: list, idx: 0, ans: {}, flags: {}, endAt: 0, started: Date.now() };
      openOverlay();
    };
    if (!c) return finish(pool);
    c.from('topik_items').select('id,n,type,group_key,passage,question,choices,answer,explanation').eq('type', type).limit(60)
      .then(function (r) { finish(((r && r.data) || []).length ? r.data : pool); }, function () { finish(pool); });
  }

  function save() { var R = S.run; if (R && R.mode === 'test') lsSet('kh_topik_prog_' + R.test.id, { idx: R.idx, ans: R.ans, flags: R.flags, endAt: R.endAt, started: R.started }); }

  function openOverlay() {
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
    if (S.run.mode === 'test') { tick(); S.run.timer = setInterval(tick, 1000); }
    else $('tp-timer').innerHTML = '';
    renderQ();
  }
  function closeOverlay() {
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
    var html = '<div class="tp-ins">' + (R.mode === 'test' ? it.n + '. ' : '') + groupRange(it) + esc(ty.ko) + '<small>' + esc(ty.en) + '</small></div>'
      + (it.passage ? '<div class="tp-pass">' + esc(it.passage) + '</div>' : '')
      + (it.question ? '<div class="tp-ins" style="color:#fff">' + esc(it.question) + '</div>' : '')
      + (it.choices || []).map(function (ch, k) {
          var cls = '';
          if (drillShown) cls = (k + 1 === it.answer) ? ' ok' : (k + 1 === picked ? ' bad' : '');
          else if (picked === k + 1) cls = ' sel';
          return '<button type="button" class="tp-ch' + cls + '" data-k="' + (k + 1) + '"><span class="no">' + (k + 1) + '</span><span>' + esc(ch) + '</span></button>';
        }).join('')
      + (drillShown ? '<div class="tp-exp">' + (picked === it.answer ? '<b style="color:#6ee7b7">Correct.</b> ' : '<b style="color:#fca5a5">Answer: ' + NUMS[it.answer - 1] + '</b> ') + esc(it.explanation || '') + '</div>' : '');
    if (R.mode === 'test') {
      html += '<div class="tp-map">' + R.items.map(function (x, i) {
        return '<button type="button" data-i="' + i + '" class="' + (R.ans[x.id] ? 'a ' : '') + (R.flags[x.id] ? 'f ' : '') + (i === R.idx ? 'cur' : '') + '">' + x.n + '</button>';
      }).join('') + '</div>';
    }
    $('tp-q').innerHTML = html;
    $('tp-scroll').scrollTop = 0;
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

  function estLevel(score, t) {
    if (t.kind !== 'full' || t.level !== 'I') return null;
    var total = score * 2;                       // if listening matches reading
    return total >= 140 ? 'Level 2' : (total >= 80 ? 'Level 1' : 'Below level 1');
  }

  async function submit(timeUp) {
    var R = S.run; if (!R || R.done) return;
    R.done = true;
    if (R.timer) clearInterval(R.timer);
    var byType = {}, correct = 0;
    R.items.forEach(function (it) {
      var ok = R.ans[it.id] === it.answer;
      if (ok) correct++;
      var b = byType[it.type] || (byType[it.type] = [0, 0]);
      b[1]++; if (ok) b[0]++;
    });
    var total = R.items.length, score = Math.round(correct / total * 100);
    R.result = { correct: correct, total: total, score: score, byType: byType, level: R.mode === 'test' ? estLevel(score, R.test) : null, timeUp: timeUp };
    if (R.mode === 'test') {
      lsSet('kh_topik_prog_' + R.test.id, null);
      var c = sb();
      if (c && user()) {
        var row = { test_id: R.test.id, answers: R.ans, correct: correct, total: total, score: score, by_type: byType, est_level: R.result.level, seconds: Math.round((Date.now() - R.started) / 1000) };
        try { await c.from('topik_attempts').insert(row); S.attempts.unshift(Object.assign({ finished_at: new Date().toISOString() }, row)); } catch (_) {}
      }
      try { if (typeof khTrackUser === 'function') khTrackUser('topik_test', { test: R.test.id, score: score }); } catch (_) {}
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
      + (res.level ? '<br>TOPIK I: level 1 = 80+, level 2 = 140+ of 200 (reading + listening). This assumes listening matches reading.' : '') + '</small></div>';
    if (R.mode === 'test') {
      html += '<div class="tp-k">By question type</div><div class="tp-bars">' + types.slice().reverse().map(function (k) {
        var b = res.byType[k], pct = Math.round(b[0] / b[1] * 100);
        return '<div class="tp-brow"><div><span>' + esc(TYPES[k] ? TYPES[k].en : k) + '</span><span>' + b[0] + '/' + b[1] + '</span></div><span class="tp-track"><i class="' + (pct < 70 ? 'w' : '') + '" style="width:' + pct + '%"></i></span></div>';
      }).join('') + '</div>';
      if (weak.length) html += '<div class="tp-k">Study next</div>' + weak.map(function (k) {
        return '<button type="button" class="tp-weak" data-drill="' + k + '"><span><b>' + esc(TYPES[k].en) + '</b><small>' + esc(TIPS[k] || '') + '</small></span><span class="go">Drill ›</span></button>';
      }).join('');
    }
    if (wrong.length) {
      html += '<div class="tp-k">Review mistakes (' + wrong.length + ')</div>' + wrong.map(function (it) {
        var mine = R.ans[it.id];
        return '<div class="tp-wrong"><div class="h">' + (R.mode === 'test' ? 'Q' + it.n + ' · ' : '') + esc(TYPES[it.type] ? TYPES[it.type].en : it.type) + '</div>'
          + (it.passage && !it.group_key ? '<div class="tp-pass" style="margin:6px 0 8px;font-size:14.5px">' + esc(it.passage) + '</div>' : '')
          + '<div style="font-size:14px;line-height:1.6;font-family:\'Noto Sans KR\',sans-serif">'
          + (mine ? '<span style="color:#fca5a5">Your answer: ' + NUMS[mine - 1] + ' ' + esc(it.choices[mine - 1]) + '</span><br>' : '<span style="color:#fca5a5">No answer</span><br>')
          + '<span style="color:#6ee7b7">Answer: ' + NUMS[it.answer - 1] + ' ' + esc(it.choices[it.answer - 1]) + '</span></div>'
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
    if (t) startTest(t[1]);
  }
  function whenReady(fn, n) {
    n = n || 0;
    if (sb() || n > 40) return fn();
    setTimeout(function () { whenReady(fn, n + 1); }, 100);
  }
  document.addEventListener('DOMContentLoaded', function () { whenReady(start); });
  window.addEventListener('kh-auth-signed-in', function () { loadTests().then(function () { if (!S.run || !document.getElementById('tp-ov')) renderHub(); }); });
})();
