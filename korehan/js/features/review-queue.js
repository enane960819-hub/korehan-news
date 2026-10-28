/* ============================================================
   KoreHani — Today's Review (one queue, mockup B 2026-10-28)

   One list of what to review today, used everywhere the app shows a
   review count (home Today card, Study Room plan + Review tile) and by
   the review session itself, so the number on the button is the number
   of questions you get.

   Queue (max 20):
     missed — saved words you got wrong last time (interval reset to 1)
     due    — saved words whose spaced-repetition day has come
     new    — words / one grammar pattern from articles read today that
              you haven't saved

   Saved words are graded by log_word_review (server-side SM-2: right
   pushes the next review out, wrong brings it back tomorrow). Missed
   items come back once at the end of the session. Unsaved words are
   never saved automatically; the done screen offers it in one tap.

   Deps (global, all optional-checked): getSupa, supaUser, getFromCache,
   khIcon, khSpeak, dbSaveWord, logQuizResult, logActivity,
   playCorrectSound, playWrongSound, getCurrentStreak.
   ============================================================ */
(function () {
  var MAX_ITEMS = 20, MAX_SAVED = 16, MAX_NEW_WORDS = 4;

  function kstToday(offsetDays) {
    var d = new Date(Date.now() + 9 * 3600000 + (offsetDays || 0) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  function cleanEn(en) {
    var s = String(en || '');
    if (typeof splitWordEnMeaning === 'function') { try { s = splitWordEnMeaning(s).meaning || s; } catch (_) {} }
    return s.replace(/^\s*\[(표현|슬랭)\]\s*/, '').trim();
  }
  function meaningKey(en) { return String(en || '').toLowerCase().split(/[,;/(]/)[0].replace(/^(to|a|an|the)\s+/, '').trim(); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(name) { return (typeof khIcon === 'function') ? khIcon(name) : ''; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function daysAgo(iso) {
    if (!iso) return null;
    var d = Math.floor((new Date(kstToday() + 'T00:00:00+09:00') - new Date(String(iso).slice(0, 10) + 'T00:00:00+09:00')) / 86400000);
    return d < 0 ? 0 : d;
  }

  // ── Build the queue ─────────────────────────────────────────────
  // Deterministic (no random picks) so the home card and the session
  // agree on the count.
  async function build() {
    var sb = (typeof getSupa === 'function') ? getSupa() : null;
    var user = (typeof supaUser !== 'undefined') ? supaUser : null;
    var out = { items: [], counts: { missed: 0, due: 0, fresh: 0 }, saved: {} };
    if (!sb || !user) return out;
    var today = kstToday();

    var res = await Promise.all([
      sb.from('user_saved_words')
        .select('word_key, word_ko, word_rom, word_en, created_at, wrong_count, srs_interval, srs_ease_factor, srs_next_review, srs_review_count, mastered')
        .eq('user_id', user.id).lte('srs_next_review', today).order('srs_next_review', { ascending: true }).limit(200),
      sb.from('read_articles').select('article_id, read_at').eq('user_id', user.id)
        .gte('read_at', new Date(today + 'T00:00:00+09:00').toISOString()).order('read_at', { ascending: false }).limit(4),
      sb.from('user_saved_words').select('word_ko').eq('user_id', user.id).limit(2000)
    ].map(function (q) { return Promise.resolve(q).then(function (r) { return r; }, function () { return null; }); }));

    (res[2] && res[2].data || []).forEach(function (w) { if (w.word_ko) out.saved[w.word_ko] = 1; });

    var seen = {}, missed = [], due = [];
    (res[0] && res[0].data || []).forEach(function (w) {
      var en = cleanEn(w.word_en);
      if (!w.word_ko || !en || w.mastered || seen[w.word_ko]) return;
      seen[w.word_ko] = 1;
      var item = { kind: 'saved', ko: w.word_ko, en: en, rom: w.word_rom || '', key: w.word_key || w.word_ko,
        ago: daysAgo(w.created_at), n: (w.srs_review_count || 0) + 1,
        interval: w.srs_interval || 1, ease: Number(w.srs_ease_factor) || 2.5 };
      var wasWrong = (w.wrong_count || 0) > 0 && (w.srs_interval || 1) <= 1 && (w.srs_review_count || 0) > 0;
      item.src = wasWrong ? 'missed' : 'due';
      (wasWrong ? missed : due).push(item);
    });
    var savedItems = missed.concat(due).slice(0, MAX_SAVED);

    // Words (and one grammar pattern) from articles read today.
    var fresh = [], grammar = [], gSeen = {};
    var arts = [], aSeen = {};
    (res[1] && res[1].data || []).forEach(function (r) { var id = String(r.article_id); if (!aSeen[id]) { aSeen[id] = 1; arts.push(id); } });
    for (var i = 0; i < arts.length && i < 2; i++) {
      var cached = null;
      try { cached = (typeof getFromCache === 'function') ? await getFromCache('article', arts[i], 'ai_analysis') : null; } catch (_) {}
      if (!cached) continue;
      (Array.isArray(cached.vocab) ? cached.vocab : []).forEach(function (v) {
        var en = cleanEn(v && v.en);
        if (!v || !v.ko || !en || seen[v.ko] || out.saved[v.ko]) return;
        seen[v.ko] = 1;
        fresh.push({ kind: 'new', src: 'new', ko: v.ko, en: en, rom: v.rom || '' });
      });
      var g0 = cached.grammar;
      (Array.isArray(g0) ? g0 : ((g0 && (g0.patterns || g0.points)) || [])).forEach(function (g) {
        var pat = g.pattern || g.name || '', expl = g.explanation || g.exp || '';
        if (pat && expl && !gSeen[pat]) { gSeen[pat] = 1; grammar.push({ pattern: pat, explanation: expl, example: g.example_ko || g.ex_ko || '' }); }
      });
    }
    var room = MAX_ITEMS - savedItems.length;
    var newItems = fresh.slice(0, Math.min(MAX_NEW_WORDS, room));
    room -= newItems.length;
    if (room > 0 && grammar.length >= 4) {
      var g = grammar[0];
      var meaning = String(g.explanation).split(/(?<=[.!?。])\s/)[0].trim();
      if (meaning.length > 80) meaning = meaning.slice(0, 78).trim() + '…';
      newItems.push({ kind: 'grammar', src: 'new', prompt: meaning, example: g.example, answer: g.pattern,
        others: grammar.slice(1).map(function (x) { return x.pattern; }) });
    }

    out.items = savedItems.concat(newItems);
    out.counts.missed = savedItems.filter(function (x) { return x.src === 'missed'; }).length;
    out.counts.due = savedItems.length - out.counts.missed;
    out.counts.fresh = newItems.length;
    out.pool = fresh;    // extra meanings for distractors
    return out;
  }

  // Cached for a short while so one page load doesn't build it 3 times.
  var _summary = null, _summaryAt = 0, _summaryP = null;
  function summary(force) {
    if (!force && _summary && Date.now() - _summaryAt < 60000) return Promise.resolve(_summary);
    if (_summaryP) return _summaryP;
    _summaryP = build().then(function (q) {
      _summary = q; _summaryAt = Date.now(); _summaryP = null; return q;
    }, function () { _summaryP = null; return { items: [], counts: { missed: 0, due: 0, fresh: 0 } }; });
    return _summaryP;
  }

  // ── Session UI ──────────────────────────────────────────────────
  var S = null;

  function css() {
    if (document.getElementById('rq-style')) return;
    var st = document.createElement('style');
    st.id = 'rq-style';
    st.textContent = ''
      + '#rq{position:fixed;inset:0;z-index:10050;background:linear-gradient(180deg,#0d1b3d,#0a1631);color:#e2e8f0;overflow-y:auto;font-family:"DM Sans","Noto Sans KR",sans-serif}'
      + '#rq .rq-in{max-width:520px;margin:0 auto;padding:16px 18px 40px}'
      + '#rq .rq-top{display:flex;align-items:center;gap:10px}'
      + '#rq .rq-x{width:34px;height:34px;border-radius:50%;border:0;background:rgba(255,255,255,.08);color:#cbd5e1;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}'
      + '#rq .rq-x svg{width:16px;height:16px}'
      + '#rq .rq-bar{flex:1;height:7px;border-radius:9px;background:rgba(255,255,255,.1);overflow:hidden}'
      + '#rq .rq-bar div{height:100%;background:linear-gradient(90deg,#60a5fa,#a78bfa);border-radius:9px;transition:width .2s}'
      + '#rq .rq-cnt{font-size:12px;color:rgba(255,255,255,.6);font-weight:700;min-width:44px;text-align:right}'
      + '#rq .rq-tag{display:inline-flex;margin-top:16px;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;background:rgba(96,165,250,.15);color:#93c5fd}'
      + '#rq .rq-tag.missed{background:rgba(248,113,113,.15);color:#fca5a5}#rq .rq-tag.new{background:rgba(52,211,153,.14);color:#6ee7b7}'
      + '#rq .rq-card{margin-top:12px;padding:26px 18px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);text-align:center}'
      + '#rq .rq-ko{font-family:"Noto Sans KR",sans-serif;font-size:34px;font-weight:900;color:#fff;line-height:1.25;word-break:keep-all}'
      + '#rq .rq-ko.sm{font-family:"DM Sans",sans-serif;font-size:18px;font-weight:700;line-height:1.45}'
      + '#rq .rq-sub{font-family:"Noto Sans KR",sans-serif;font-size:13px;color:rgba(255,255,255,.55);margin-top:10px;line-height:1.6}'
      + '#rq .rq-say{margin-top:12px;border:0;background:none;color:#93c5fd;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px}'
      + '#rq .rq-say svg{width:15px;height:15px}'
      + '#rq .rq-opts{margin-top:16px;display:grid;gap:8px}'
      + '#rq .rq-opt{padding:13px 14px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);font:inherit;font-size:14.5px;font-weight:600;color:#e2e8f0;text-align:left;cursor:pointer;transition:background .15s}'
      + '#rq .rq-opt:hover{background:rgba(255,255,255,.1)}'
      + '#rq .rq-opt.ok{background:rgba(16,185,129,.18);border-color:rgba(52,211,153,.6);color:#a7f3d0}'
      + '#rq .rq-opt.bad{background:rgba(239,68,68,.16);border-color:rgba(248,113,113,.55);color:#fecaca}'
      + '#rq .rq-opt:disabled{cursor:default}'
      + '#rq .rq-fb{margin-top:14px;font-size:13px;font-weight:700;color:#a7f3d0;min-height:38px}#rq .rq-fb.bad{color:#fca5a5}'
      + '#rq .rq-fb small{display:block;color:rgba(255,255,255,.45);font-weight:500;margin-top:2px}'
      + '#rq .rq-next{display:block;width:100%;margin-top:6px;padding:13px;border-radius:14px;border:0;background:#2563eb;color:#fff;font:inherit;font-weight:800;font-size:14px;cursor:pointer}'
      + '#rq .rq-dn{text-align:center;padding-top:22px}'
      + '#rq .rq-ring{width:118px;height:118px;border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center}'
      + '#rq .rq-ring div{width:96px;height:96px;border-radius:50%;background:#0c1838;display:flex;flex-direction:column;align-items:center;justify-content:center}'
      + '#rq .rq-ring b{font-size:27px;color:#fff}#rq .rq-ring small{font-size:10.5px;color:rgba(255,255,255,.5)}'
      + '#rq .rq-dn h2{font-size:20px;color:#fff;margin:0}#rq .rq-dn p{font-size:12.5px;color:rgba(255,255,255,.6);margin:4px 0 0}'
      + '#rq .rq-box{margin-top:16px;padding:14px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}'
      + '#rq .rq-box h4{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#7dd3fc;margin:0 0 6px}'
      + '#rq .rq-w{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.07);font-size:13px}'
      + '#rq .rq-w:last-of-type{border-bottom:0}'
      + '#rq .rq-w b{font-family:"Noto Sans KR",sans-serif;color:#fff;flex-shrink:0}#rq .rq-w span{flex:1;min-width:0;color:rgba(255,255,255,.55);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '#rq .rq-w em{font-style:normal;font-size:10.5px;padding:2px 7px;border-radius:7px;background:rgba(251,191,36,.15);color:#fcd34d;flex-shrink:0}'
      + '#rq .rq-save{display:block;width:100%;margin-top:10px;padding:10px;border-radius:12px;background:rgba(124,58,237,.35);border:1px solid rgba(167,139,250,.6);color:#fff;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer}'
      + '#rq .rq-save:disabled{opacity:.6;cursor:default}'
      + '#rq .rq-nx{display:flex;gap:8px;margin-top:12px}'
      + '#rq .rq-nx div{flex:1;padding:12px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);text-align:center}'
      + '#rq .rq-nx b{display:block;font-size:18px;color:#fff}#rq .rq-nx small{font-size:10.5px;color:rgba(255,255,255,.5)}'
      + '#rq .rq-empty{text-align:center;padding:70px 10px}#rq .rq-empty h2{color:#fff;font-size:19px;margin:12px 0 6px}#rq .rq-empty p{color:rgba(255,255,255,.6);font-size:13.5px;line-height:1.6;margin:0 0 18px}'
      + '#rq .rq-empty .rq-ic{display:inline-flex;width:44px;height:44px;color:#a78bfa}#rq .rq-empty .rq-ic svg{width:44px;height:44px}'
      + '#rq .rq-nud{margin-top:14px;padding:14px;border-radius:16px;background:linear-gradient(160deg,rgba(124,58,237,.22),rgba(37,99,235,.12));border:1px solid rgba(167,139,250,.45)}'
      + '#rq .rq-nud b{display:block;font-size:13.5px;color:#fff;margin-bottom:4px}#rq .rq-nud p{font-size:12px;color:rgba(255,255,255,.7);line-height:1.5;margin:0}'
      + '#rq .rq-nud-row{display:flex;gap:8px;margin-top:10px}#rq .rq-nud-row button{flex:1;padding:9px;border-radius:11px;border:0;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer}'
      + '#rq .rq-nud-row .a1{background:#7c3aed;color:#fff}#rq .rq-nud-row .a2{background:rgba(255,255,255,.08);color:#cbd5e1}';
    document.head.appendChild(st);
  }

  function root() {
    css();
    var el = document.getElementById('rq');
    if (!el) {
      el = document.createElement('div');
      el.id = 'rq';
      el.setAttribute('data-hover-skip', '1');
      document.body.appendChild(el);
    }
    document.body.style.overflow = 'hidden';
    return el;
  }
  function close() {
    var el = document.getElementById('rq');
    if (el) el.remove();
    document.body.style.overflow = '';
    S = null;
    _summary = null;
    try { window.dispatchEvent(new CustomEvent('kh-review-changed')); } catch (_) {}
  }

  function tagText(it) {
    if (it.src === 'new') return it.kind === 'grammar' ? 'From today’s article · grammar' : 'New today · from your article';
    if (it.src === 'missed') return 'Missed last time';
    var a = it.ago;
    var when = a == null ? 'Saved' : (a === 0 ? 'Saved today' : (a === 1 ? 'Saved yesterday' : 'Saved ' + a + ' days ago'));
    var nth = it.n === 1 ? '1st' : it.n === 2 ? '2nd' : it.n === 3 ? '3rd' : it.n + 'th';
    return when + ' · ' + nth + ' review';
  }

  function choicesFor(it, all, extra) {
    if (it.kind === 'grammar') return shuffle([it.answer].concat(shuffle(it.others).slice(0, 3)));
    var mine = meaningKey(it.en), used = {}, wrong = [];
    used[mine] = 1;
    shuffle(all.concat(extra)).forEach(function (x) {
      if (wrong.length >= 3 || !x || !x.en || x.ko === it.ko) return;
      var k = meaningKey(x.en);
      if (!k || used[k]) return;
      used[k] = 1; wrong.push(x.en);
    });
    return wrong.length < 3 ? null : shuffle([it.en].concat(wrong));
  }

  function render() {
    var el = document.getElementById('rq');
    if (!el || !S) return;
    if (S.i >= S.list.length) { done(); return; }
    var it = S.list[S.i], q = it._q;
    var total = S.list.length;
    var head = '<div class="rq-top"><button class="rq-x" aria-label="Close" onclick="khReviewQueue.close()">' + icon('x') + '</button>'
      + '<div class="rq-bar"><div style="width:' + Math.round(S.i / total * 100) + '%"></div></div>'
      + '<div class="rq-cnt">' + (S.i + 1) + ' / ' + total + '</div></div>';
    var card = it.kind === 'grammar'
      ? '<div class="rq-card"><div class="rq-ko sm">' + esc(it.prompt) + '</div>' + (it.example ? '<div class="rq-sub">' + esc(it.example) + '</div>' : '') + '</div>'
      : '<div class="rq-card"><div class="rq-ko">' + esc(it.ko) + '</div>' + (it.rom ? '<div class="rq-sub">' + esc(it.rom) + '</div>' : '')
        + '<button class="rq-say" onclick="khReviewQueue._say()">' + icon('volume-2') + 'Listen</button></div>';
    el.innerHTML = '<div class="rq-in">' + head
      + '<span class="rq-tag ' + (it.again ? 'missed' : it.src) + '">' + esc(it.again ? 'Once more · you missed this' : tagText(it)) + '</span>'
      + card
      + '<div class="rq-opts">' + q.map(function (c, k) { return '<button class="rq-opt" data-k="' + k + '" onclick="khReviewQueue._pick(' + k + ')">' + esc(c) + '</button>'; }).join('') + '</div>'
      + '<div class="rq-fb" id="rq-fb"></div>'
      + '</div>';
    if (window.renderKhLucideIcons) { try { renderKhLucideIcons(); } catch (_) {} }
  }

  function pick(k) {
    if (!S || S.answered) return;
    var it = S.list[S.i];
    var answer = it.kind === 'grammar' ? it.answer : it.en;
    var chosen = it._q[k];
    var ok = chosen === answer;
    S.answered = true;
    document.querySelectorAll('#rq .rq-opt').forEach(function (b) {
      b.disabled = true;
      var t = it._q[+b.getAttribute('data-k')];
      if (t === answer) b.classList.add('ok');
      else if (+b.getAttribute('data-k') === k) b.classList.add('bad');
    });
    try { (ok ? playCorrectSound : playWrongSound)(); } catch (_) {}

    var fbMain, fbSub = '';
    if (!it.again) {
      S.first.push({ it: it, ok: ok });
      if (it.kind === 'saved') {
        var sb = getSupa();
        if (sb) S.writes.push(Promise.resolve(sb.rpc('log_word_review', { p_word_key: it.key, p_correct: ok })).then(null, function () {}));
      }
      if (!ok) S.list.push(Object.assign({}, it, { again: true, _q: shuffle(it._q) }));
    }
    if (ok) {
      if (it.kind === 'saved' && !it.again) {
        var days = Math.max(1, Math.round(it.interval * it.ease));
        fbMain = 'Correct · next review in ' + days + ' day' + (days === 1 ? '' : 's');
      } else fbMain = 'Correct';
    } else {
      fbMain = 'Not quite · it’s ' + answer;
      fbSub = it.again ? '' : (it.kind === 'saved' ? 'Back tomorrow, and once more at the end' : 'Once more at the end');
    }
    var fb = document.getElementById('rq-fb');
    if (fb) {
      fb.className = 'rq-fb' + (ok ? '' : ' bad');
      fb.innerHTML = esc(fbMain) + (fbSub ? '<small>' + esc(fbSub) + '</small>' : '')
        + '<button class="rq-next" onclick="khReviewQueue._next()">' + (S.i + 1 >= S.list.length ? 'See results' : 'Next') + '</button>';
    }
  }
  function next() { if (!S) return; S.i += 1; S.answered = false; render(); }
  function say() { var it = S && S.list[S.i]; if (it && it.ko && typeof khSpeak === 'function') khSpeak(it.ko); }

  async function done() {
    var el = document.getElementById('rq');
    if (!el || !S) return;
    var total = S.first.length, right = S.first.filter(function (x) { return x.ok; }).length;
    var missed = S.first.filter(function (x) { return !x.ok && x.it.kind !== 'grammar'; }).map(function (x) { return x.it; });
    var toSave = missed.filter(function (it) { return it.kind === 'new' && !S.saved[it.ko]; });
    S.toSave = toSave;
    var pct = total ? Math.round(right / total * 100) : 0;

    // Same bookkeeping the old Daily Review did.
    try {
      var wrong = {};
      S.first.forEach(function (x) { if (!x.ok) { var k = x.it.kind === 'grammar' ? 'GRAMMAR' : 'VOCAB'; wrong[k] = (wrong[k] || 0) + 1; } });
      if (typeof logQuizResult === 'function') logQuizResult('daily_review', { score: right, max_score: total, accuracy_pct: pct, wrong_patterns: wrong });
      if (typeof logActivity === 'function') logActivity('quiz', { content_type: 'daily_review', score: right, max_score: total });
    } catch (_) {}
    try { localStorage.setItem('kh_daily_review_done_' + kstToday(), '1'); } catch (_) {}

    var streak = 0;
    try { streak = (typeof getCurrentStreak === 'function') ? (getCurrentStreak() || 0) : 0; } catch (_) {}
    el.innerHTML = '<div class="rq-in"><div class="rq-top"><button class="rq-x" aria-label="Close" onclick="khReviewQueue.close()">' + icon('x') + '</button><div style="flex:1"></div></div>'
      + '<div class="rq-dn"><div class="rq-ring" style="background:conic-gradient(#34d399 0 ' + pct + '%,rgba(255,255,255,.1) ' + pct + '% 100%)"><div><b>' + right + '/' + total + '</b><small>correct</small></div></div>'
      + '<h2>Review done</h2><p>' + (streak > 0 ? 'Streak ' + streak + ' day' + (streak === 1 ? '' : 's') : 'Nice work') + '</p></div>'
      + (missed.length ? '<div class="rq-box"><h4>Missed today</h4>' + missed.map(function (it) {
          return '<div class="rq-w"><b>' + esc(it.ko) + '</b><span>' + esc(it.en) + '</span><em>' + (it.kind === 'saved' ? 'back tomorrow' : 'not saved') + '</em></div>';
        }).join('') + (toSave.length ? '<button class="rq-save" id="rq-save" onclick="khReviewQueue._saveMissed()">Save ' + toSave.length + ' missed word' + (toSave.length === 1 ? '' : 's') + ' to My Words</button>' : '') + '</div>' : '')
      + (pct >= 60 ? nudge() : '')
      + '<div class="rq-nx"><div><b id="rq-tmr">–</b><small>due tomorrow</small></div><div><b id="rq-all">–</b><small>words in your queue</small></div></div>'
      + '<button class="rq-next" style="margin-top:14px" onclick="khReviewQueue.close()">Done</button></div>';
    if (window.renderKhLucideIcons) { try { renderKhLucideIcons(); } catch (_) {} }

    // Counts after this session's grades have landed.
    try {
      await Promise.all(S ? S.writes : []);
      var sb = getSupa(), u = supaUser;
      if (!sb || !u) return;
      var r = await Promise.all([
        sb.from('user_saved_words').select('word_ko', { count: 'exact', head: true }).eq('user_id', u.id).eq('mastered', false).lte('srs_next_review', kstToday(1)),
        sb.from('user_saved_words').select('word_ko', { count: 'exact', head: true }).eq('user_id', u.id).eq('mastered', false)
      ]);
      var a = document.getElementById('rq-tmr'), b = document.getElementById('rq-all');
      if (a && r[0] && !r[0].error) a.textContent = r[0].count || 0;
      if (b && r[1] && !r[1].error) b.textContent = r[1].count || 0;
    } catch (_) {}
  }

  // One soft Premium card after a review went well (60%+) — free learners only, at
  // most once every 3 days (mockup E).
  function nudge() {
    try {
      if (typeof canAccess !== 'function' || canAccess('article_study')) return '';
      if (typeof _userPlanLoaded !== 'undefined' && !_userPlanLoaded) return '';
      var last = Number(localStorage.getItem('kh_premium_nudge_at') || 0);
      if (Date.now() - last < 3 * 86400000) return '';
      localStorage.setItem('kh_premium_nudge_at', String(Date.now()));
    } catch (_) { return ''; }
    var streak = 0;
    try { streak = (typeof getCurrentStreak === 'function') ? (getCurrentStreak() || 0) : 0; } catch (_) {}
    return '<div class="rq-nud"><b>' + (streak >= 2 ? 'You’re on a ' + streak + '-day streak' : 'Nice review') + '</b>'
      + '<p>Keep the momentum: Premium turns today’s news into a 10-minute lesson and gives your weekly writing a tutor review.</p>'
      + '<div class="rq-nud-row"><button type="button" class="a1" onclick="khReviewQueue.close();showUpgradeModal(\'article_study\',\'premium\')">See Premium</button>'
      + '<button type="button" class="a2" onclick="this.closest(\'.rq-nud\').remove()">Not now</button></div></div>';
  }

  async function saveMissed() {
    if (!S || !S.toSave || !S.toSave.length) return;
    var btn = document.getElementById('rq-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    for (var i = 0; i < S.toSave.length; i++) {
      var it = S.toSave[i];
      try { if (typeof dbSaveWord === 'function') await dbSaveWord(it.ko, it.rom || '', it.en); } catch (_) {}
    }
    if (btn) btn.textContent = 'Saved · they’ll come back for review';
    document.querySelectorAll('#rq .rq-w em').forEach(function (e) { if (e.textContent === 'not saved') e.textContent = 'saved'; });
  }

  async function open() {
    if (typeof supaUser === 'undefined' || !supaUser) { if (typeof openAuthModal === 'function') openAuthModal('signin'); return; }
    var el = root();
    el.innerHTML = '<div class="rq-in"><div class="rq-empty"><p>Loading your review…</p></div></div>';
    var q = await summary(true);
    // Distractor meanings: today's article words + a slice of the word bank.
    var extra = (q.pool || []).slice();
    try {
      var sb = getSupa();
      var vb = await sb.from('vocabulary_bank').select('word_ko, word_en').eq('is_active', true).limit(60);
      (vb.data || []).forEach(function (w) { var en = cleanEn(w.word_en); if (w.word_ko && en) extra.push({ ko: w.word_ko, en: en }); });
    } catch (_) {}
    var list = [];
    q.items.forEach(function (it) {
      var c = choicesFor(it, q.items.filter(function (x) { return x.kind !== 'grammar'; }), extra);
      if (c) list.push(Object.assign({}, it, { _q: c }));
    });
    if (!document.getElementById('rq')) return;   // closed while loading
    if (!list.length) {
      el.innerHTML = '<div class="rq-in"><div class="rq-top"><button class="rq-x" aria-label="Close" onclick="khReviewQueue.close()">' + icon('x') + '</button></div>'
        + '<div class="rq-empty"><span class="rq-ic">' + icon('check-circle') + '</span><h2>Nothing to review right now</h2>'
        + '<p>Words you save come back here on the right day.<br>Read an article and save a few words to start.</p>'
        + '<button class="rq-next" onclick="khReviewQueue.close();location.href=\'korehan-all.html\'">Read an article</button></div></div>';
      if (window.renderKhLucideIcons) { try { renderKhLucideIcons(); } catch (_) {} }
      return;
    }
    S = { list: list, i: 0, answered: false, first: [], writes: [], saved: q.saved || {} };
    render();
  }

  window.khReviewQueue = { summary: summary, open: open, close: close, _pick: pick, _next: next, _say: say, _saveMissed: saveMissed };
})();
