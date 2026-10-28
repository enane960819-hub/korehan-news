/* Word Bank (mockup G, 2026-10-28) — replaces the old Vocab Drill page.
   Words come from the live bank (view public.word_bank = vocabulary_bank +
   word_tags; meanings/examples for most words are from 한국어기초사전).
   No AI calls: drills are built from the bank, audio is khSpeak, saving goes
   through dbSaveWord into My Words (same SRS as Today's Review). */
(function () {
  'use strict';

  var LEVELS = [
    { k: 'Starter', l: 'Seed' }, { k: 'Beginner', l: 'Sprout' },
    { k: 'Intermediate', l: 'Tree' }, { k: 'Advanced', l: 'Forest' }
  ];
  var TOPICS = ['daily', 'food', 'places', 'people', 'work', 'society', 'culture', 'nature', 'study'];
  var PAGE = 40;

  var S = {
    tab: 'words', level: 'Beginner', tag: 'all',
    rows: [], offset: 0, done: false, loading: false, counts: {}, total: null, req: 0
  };
  try {
    var lv = localStorage.getItem('kh_wb_level');
    if (lv && LEVELS.some(function (x) { return x.k === lv; })) S.level = lv;
  } catch (_) {}
  // Seed learners start on Hangul; ?tab= overrides.
  if (/[?&]tab=hangul/.test(location.search)) S.tab = 'hangul';
  else if (!/[?&]tab=words/.test(location.search) && S.level === 'Starter') S.tab = 'hangul';

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ico(n) { return '<i data-lucide="' + n + '" class="kh-ui-icon kh-ui-icon-sm" aria-hidden="true"></i>'; }
  function icons() { try { if (typeof renderKhLucideIcons === 'function') renderKhLucideIcons(); } catch (_) {} }
  function rom(r) { return String((r && r.word_rom) || '').replace(/-/g, '').toLowerCase(); }
  function firstMeaning(en) { return String(en || '').split(';')[0].trim(); }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function levelLabel(k) { var x = LEVELS.filter(function (l) { return l.k === k; })[0]; return x ? x.l : k; }
  function say(ko, btn) { try { if (typeof khSpeak === 'function') khSpeak(ko, 'female', btn); } catch (_) {} }
  function isSaved(ko) {
    try { if (typeof _savedWordsSet !== 'undefined' && _savedWordsSet && _savedWordsSet.has(ko)) return true; } catch (_) {}
    try { return (JSON.parse(localStorage.getItem('korehan_saved_words') || '[]') || []).some(function (w) { return w && w.ko === ko; }); } catch (_) { return false; }
  }
  function sb() { return (typeof getSupa === 'function') ? getSupa() : null; }

  // ── Data ─────────────────────────────────────────────────────
  function query(sel) {
    var q = sb().from('word_bank').select(sel || 'word_ko,word_rom,word_en,level,pos,example_ko,tag', sel === 'id' ? { count: 'exact', head: true } : undefined)
      .eq('level', S.level);
    if (S.tag !== 'all') q = q.eq('tag', S.tag);
    return q;
  }
  function loadCounts() {
    if (!sb()) return;
    LEVELS.forEach(function (l) {
      if (S.counts[l.k] != null) return;
      sb().from('word_bank').select('id', { count: 'exact', head: true }).eq('level', l.k).then(function (r) {
        S.counts[l.k] = r.count || 0; renderHead();
      }, function () {});
    });
  }
  function loadTotal() {
    S.total = null;
    if (!sb()) return Promise.resolve();
    return query('id').then(function (r) { S.total = r.count || 0; renderHead(); }, function () {});
  }
  function loadMore() {
    if (S.loading || S.done || !sb()) return;
    S.loading = true; renderList();
    var req = S.req;
    query().order('id').range(S.offset, S.offset + PAGE - 1).then(function (r) {
      if (req !== S.req) return;   // filter changed while this page was loading
      S.loading = false;
      var rows = (r && r.data) || [];
      S.rows = S.rows.concat(rows); S.offset += rows.length;
      if (rows.length < PAGE) S.done = true;
      renderList();
    }, function () { S.loading = false; renderList(); });
  }
  function reset() { S.req++; S.rows = []; S.offset = 0; S.done = false; S.loading = false; loadTotal(); loadMore(); }
  // Random slice of the current filter for a drill (no AI: bank words only).
  function pool(n) {
    var total = S.total || 0;
    var from = total > n ? Math.floor(Math.random() * (total - n)) : 0;
    return query().order('id').range(from, from + n - 1).then(function (r) { return (r && r.data) || []; });
  }

  // ── Layout ───────────────────────────────────────────────────
  function shell() {
    var root = $('wb-root'); if (!root) return;
    root.innerHTML =
      '<div class="wb-wrap">'
      + '<div class="wb-head"><div><h1 class="wb-h1">Word Bank</h1><p class="wb-hs" id="wb-hs">Korean words by level and topic</p></div>'
      + '<div class="wb-tabs" role="tablist"><button type="button" data-tab="words">Words</button><button type="button" data-tab="hangul">Hangul</button></div></div>'
      + '<div id="wb-due"></div>'
      + '<div id="wb-body"></div>'
      + '<p class="wb-src">Word list, meanings and example sentences: <a href="https://krdict.korean.go.kr" target="_blank" rel="noopener">한국어기초사전</a> (National Institute of Korean Language), <a href="https://creativecommons.org/licenses/by-sa/2.0/kr/" target="_blank" rel="noopener">CC BY-SA 2.0 KR</a>.</p>'
      + '</div>'
      + '<div class="wb-dock" id="wb-dock"></div>';
    root.querySelectorAll('[data-tab]').forEach(function (b) {
      b.onclick = function () { S.tab = b.getAttribute('data-tab'); render(); if (S.tab === 'words' && !S.rows.length) reset(); };
    });
    renderDue();
  }
  function renderHead() {
    var hs = $('wb-hs'); if (!hs) return;
    var known = LEVELS.every(function (l) { return S.counts[l.k] != null; });
    var all = LEVELS.reduce(function (s, l) { return s + (S.counts[l.k] || 0); }, 0);
    hs.textContent = known ? all.toLocaleString() + ' words by level and topic' : 'Korean words by level and topic';
    LEVELS.forEach(function (l) {
      var el = document.querySelector('.wb-seg [data-lv="' + l.k + '"] small');
      if (el && S.counts[l.k] != null) el.textContent = S.counts[l.k].toLocaleString();
    });
  }
  function renderDue() {
    var box = $('wb-due'); if (!box) return;
    if (typeof supaUser === 'undefined' || !supaUser || !window.khReviewQueue) { box.innerHTML = ''; return; }
    khReviewQueue.summary().then(function (q) {
      var n = (q && q.items && q.items.length) || 0;
      box.innerHTML = n ? '<button type="button" class="wb-due" onclick="khReviewQueue.open()"><span><b>' + n + ' word' + (n === 1 ? '' : 's') + ' due today</b><small>From your saved words</small></span><span class="wb-go">Review</span></button>' : '';
    }, function () {});
  }
  function render() {
    document.querySelectorAll('.wb-tabs [data-tab]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === S.tab); });
    if (S.tab === 'hangul') return renderHangul();
    var body = $('wb-body');
    body.innerHTML =
      '<div class="wb-seg">' + LEVELS.map(function (l) {
        return '<button type="button" data-lv="' + l.k + '" class="' + (S.level === l.k ? 'on' : '') + '">' + l.l + '<small>' + (S.counts[l.k] != null ? S.counts[l.k].toLocaleString() : '') + '</small></button>';
      }).join('') + '</div>'
      + '<div class="wb-chips">' + ['all'].concat(TOPICS).map(function (t) {
        return '<button type="button" data-tag="' + t + '" class="' + (S.tag === t ? 'on' : '') + '">' + (t === 'all' ? 'All' : cap(t)) + '</button>';
      }).join('') + '</div>'
      + '<div id="wb-list"></div>';
    body.querySelectorAll('[data-lv]').forEach(function (b) {
      b.onclick = function () { S.level = b.getAttribute('data-lv'); try { localStorage.setItem('kh_wb_level', S.level); } catch (_) {} render(); reset(); };
    });
    body.querySelectorAll('[data-tag]').forEach(function (b) {
      b.onclick = function () { S.tag = b.getAttribute('data-tag'); render(); reset(); };
    });
    $('wb-dock').innerHTML = '<button type="button" onclick="khWordBank.drill(\'cards\')">' + ico('layers') + 'Flashcards</button>'
      + '<button type="button" onclick="khWordBank.drill(\'meaning\')">' + ico('circle-check') + 'Meaning quiz</button>'
      + '<button type="button" class="p" onclick="khWordBank.drill(\'listen\')">' + ico('headphones') + 'Listen &amp; pick</button>';
    $('wb-dock').style.display = '';
    renderList(); icons();
  }
  function renderList() {
    var el = $('wb-list'); if (!el) return;
    if (!S.rows.length && S.loading) { el.innerHTML = '<p class="wb-empty">Loading words…</p>'; return; }
    if (!S.rows.length) { el.innerHTML = '<p class="wb-empty">No words here yet.</p>'; return; }
    el.innerHTML = S.rows.map(function (r, i) {
      var saved = isSaved(r.word_ko);
      return '<div class="wb-w"><span class="ko">' + esc(r.word_ko) + '</span>'
        + '<div class="m"><b>' + esc(r.word_en) + '</b><small>' + esc(rom(r)) + (r.tag ? ' · ' + cap(r.tag) : '') + '</small></div>'
        + '<button type="button" class="ib" aria-label="Listen" data-say="' + i + '">' + ico('volume-2') + '</button>'
        + '<button type="button" class="ib' + (saved ? ' sv' : '') + '" aria-label="' + (saved ? 'Saved' : 'Save to My Words') + '" data-save="' + i + '">' + ico(saved ? 'check' : 'plus') + '</button></div>';
    }).join('')
      + (S.done ? '' : '<button type="button" class="wb-more" id="wb-more">' + (S.loading ? 'Loading…' : 'Show more') + '</button>');
    el.querySelectorAll('[data-say]').forEach(function (b) { b.onclick = function () { say(S.rows[+b.getAttribute('data-say')].word_ko, b); }; });
    el.querySelectorAll('[data-save]').forEach(function (b) {
      b.onclick = function () {
        var r = S.rows[+b.getAttribute('data-save')];
        if (isSaved(r.word_ko)) return;
        save(r); b.classList.add('sv'); b.innerHTML = ico('check'); icons();
      };
    });
    var more = $('wb-more'); if (more) more.onclick = loadMore;
    icons();
  }
  function save(r) {
    try { if (typeof dbSaveWord === 'function') dbSaveWord(r.word_ko, rom(r), firstMeaning(r.word_en)); } catch (_) {}
    try { if (typeof showToast === 'function') showToast('Saved to My Words'); } catch (_) {}
  }

  // ── Drills ───────────────────────────────────────────────────
  function cls(r) {   // word class for fair distractors
    if (r.pos) return r.pos === '형용사' || r.pos === '동사' ? 'pred' : r.pos;
    return /다$/.test(r.word_ko) ? 'pred' : '명사';
  }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  // Jamo sequence for "sounds alike" distractors (시장 · 사장 · 시청).
  function jamo(s) {
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i) - 0xAC00;
      if (c < 0 || c > 11171) { out.push(s[i]); continue; }
      out.push('L' + Math.floor(c / 588), 'V' + Math.floor((c % 588) / 28), 'T' + (c % 28));
    }
    return out;
  }
  function dist(a, b) {
    a = jamo(a); b = jamo(b);
    var d = []; for (var i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (var j = 1; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  var D = null;
  function drill(kind) {
    openOverlay('<p class="wb-empty">Getting words…</p>');
    pool(kind === 'listen' ? 120 : 60).then(function (rows) {
      rows = rows.filter(function (r) { return r.word_ko && r.word_en; });
      if (rows.length < 6) { openOverlay('<p class="wb-empty">Not enough words in this filter yet — try “All”.</p>' + closeBtn()); return; }
      var qs = shuffle(rows).slice(0, 10);
      D = { kind: kind, pool: rows, qs: qs, i: 0, right: 0, missed: [], answered: false, flipped: false };
      step();
    }, function () { openOverlay('<p class="wb-empty">Couldn’t load words. Please try again.</p>' + closeBtn()); });
  }
  function options(q) {
    if (D.kind === 'listen') {
      var near = D.pool.filter(function (r) { return r.word_ko !== q.word_ko; })
        .map(function (r) { return { r: r, d: dist(q.word_ko, r.word_ko) + Math.random() * 0.5 }; })
        .sort(function (a, b) { return a.d - b.d; }).slice(0, 3).map(function (x) { return x.r; });
      return shuffle([q].concat(near));
    }
    var same = shuffle(D.pool.filter(function (r) {
      return r.word_ko !== q.word_ko && cls(r) === cls(q) && firstMeaning(r.word_en).toLowerCase() !== firstMeaning(q.word_en).toLowerCase();
    }));
    var picks = [], seen = {}; seen[firstMeaning(q.word_en).toLowerCase()] = 1;
    same.forEach(function (r) { var m = firstMeaning(r.word_en).toLowerCase(); if (picks.length < 3 && !seen[m]) { seen[m] = 1; picks.push(r); } });
    return shuffle([q].concat(picks));
  }
  function step() {
    var q = D.qs[D.i];
    if (!q) return finish();
    D.answered = false; D.flipped = false;
    var top = '<div class="wb-qk"><span>' + levelLabel(S.level) + ' · ' + (S.tag === 'all' ? 'All' : cap(S.tag)) + '</span><span>' + (D.i + 1) + ' / ' + D.qs.length + '</span></div>'
      + '<div class="wb-prog"><i style="width:' + Math.round(D.i / D.qs.length * 100) + '%"></i></div>';
    if (D.kind === 'cards') {
      openOverlay(top + '<button type="button" class="wb-card" id="wb-card"><span class="big">' + esc(q.word_ko) + '</span><span class="rom">' + esc(rom(q)) + '</span><span class="tap">Tap to see the meaning</span></button>'
        + '<div class="wb-actions"><button type="button" class="wb-ghost" id="wb-say">' + ico('volume-2') + 'Listen</button><button type="button" class="wb-ghost" id="wb-sv">' + ico(isSaved(q.word_ko) ? 'check' : 'plus') + (isSaved(q.word_ko) ? 'Saved' : 'Save') + '</button></div>'
        + '<button type="button" class="wb-next" id="wb-next">Next</button>' + closeBtn());
      $('wb-card').onclick = function () {
        if (D.flipped) return; D.flipped = true;
        $('wb-card').innerHTML = '<span class="big sm">' + esc(q.word_ko) + '</span><span class="en">' + esc(q.word_en) + '</span>'
          + (q.example_ko ? '<span class="ex">' + esc(q.example_ko) + '</span>' : '');
      };
      $('wb-say').onclick = function () { say(q.word_ko, this); };
      $('wb-sv').onclick = function () { if (!isSaved(q.word_ko)) { save(q); this.innerHTML = ico('check') + 'Saved'; icons(); } };
      $('wb-next').onclick = function () { D.i++; step(); };
      say(q.word_ko); icons(); return;
    }
    var opts = options(q);
    var head = D.kind === 'listen'
      ? '<button type="button" class="wb-spk" id="wb-spk" aria-label="Play">' + ico('volume-2') + '</button><button type="button" class="wb-slow" id="wb-slow">Play again</button>'
      : '<div class="wb-card static"><span class="big">' + esc(q.word_ko) + '</span><span class="rom">' + esc(rom(q)) + '</span><button type="button" class="wb-say" id="wb-spk">' + ico('volume-2') + 'Listen</button></div>';
    openOverlay(top + head
      + '<div class="' + (D.kind === 'listen' ? 'wb-g2' : 'wb-opts') + '">' + opts.map(function (o, k) {
        return '<button type="button" class="wb-opt" data-o="' + k + '">' + esc(D.kind === 'listen' ? o.word_ko : firstMeaning(o.word_en)) + '</button>';
      }).join('') + '</div><div id="wb-fb"></div>' + closeBtn());
    $('wb-spk').onclick = function () { say(q.word_ko, this); };
    var slow = $('wb-slow'); if (slow) slow.onclick = function () { say(q.word_ko, this); };
    if (D.kind === 'listen') setTimeout(function () { say(q.word_ko); }, 250);
    document.querySelectorAll('.wb-opt').forEach(function (b) {
      b.onclick = function () {
        if (D.answered) return; D.answered = true;
        var o = opts[+b.getAttribute('data-o')], ok = o.word_ko === q.word_ko;
        if (ok) D.right++; else D.missed.push(q);
        document.querySelectorAll('.wb-opt').forEach(function (x) {
          var oo = opts[+x.getAttribute('data-o')];
          if (oo.word_ko === q.word_ko) x.classList.add('ok'); else if (x === b) x.classList.add('no');
        });
        $('wb-fb').innerHTML = '<div class="wb-note">' + (ok ? 'Correct! ' : '') + '<b>' + esc(q.word_ko) + '</b> = ' + esc(q.word_en)
          + (q.example_ko ? '<span class="ex">' + esc(q.example_ko) + '</span>' : '') + '</div>'
          + '<button type="button" class="wb-next" id="wb-next">' + (D.i + 1 < D.qs.length ? 'Next' : 'See results') + '</button>';
        $('wb-next').onclick = function () { D.i++; step(); };
      };
    });
    icons();
  }
  function finish() {
    var cards = D.kind === 'cards';
    openOverlay('<div class="wb-done"><b>' + (cards ? 'Set done' : D.right + ' / ' + D.qs.length) + '</b><small>' + (cards ? D.qs.length + ' words' : 'correct') + '</small></div>'
      + (D.missed.length ? '<div class="wb-k">Words to keep</div>' + D.missed.map(function (r, i) {
        var s = isSaved(r.word_ko);
        return '<div class="wb-w"><span class="ko">' + esc(r.word_ko) + '</span><div class="m"><b>' + esc(r.word_en) + '</b><small>' + esc(rom(r)) + '</small></div>'
          + '<button type="button" class="ib' + (s ? ' sv' : '') + '" data-ms="' + i + '">' + ico(s ? 'check' : 'plus') + '</button></div>';
      }).join('') : '')
      + '<div class="wb-actions"><button type="button" class="wb-ghost" id="wb-again">Another set</button><button type="button" class="wb-next" id="wb-close2">Done</button></div>');
    document.querySelectorAll('[data-ms]').forEach(function (b) {
      b.onclick = function () { var r = D.missed[+b.getAttribute('data-ms')]; if (!isSaved(r.word_ko)) { save(r); b.classList.add('sv'); b.innerHTML = ico('check'); icons(); } };
    });
    var kind = D.kind;
    $('wb-again').onclick = function () { drill(kind); };
    $('wb-close2').onclick = closeOverlay;
    icons();
  }
  function closeBtn() { return '<button type="button" class="wb-x" onclick="khWordBank.close()" aria-label="Close">' + ico('x') + '</button>'; }
  function openOverlay(html) {
    var ov = $('wb-ov');
    if (!ov) { ov = document.createElement('div'); ov.id = 'wb-ov'; ov.className = 'wb-ov'; document.body.appendChild(ov); document.body.classList.add('wb-locked'); }
    ov.innerHTML = '<div class="wb-ov-in">' + html + '</div>';
    icons();
  }
  function closeOverlay() { var ov = $('wb-ov'); if (ov) ov.remove(); document.body.classList.remove('wb-locked'); D = null; renderList(); renderDue(); }

  // ── Hangul ───────────────────────────────────────────────────
  var CONS = [['ㄱ', 'g/k', '가방', 'gabang', 'bag'], ['ㄴ', 'n', '나무', 'namu', 'tree'], ['ㄷ', 'd/t', '다리', 'dari', 'leg; bridge'],
    ['ㄹ', 'r/l', '라면', 'ramyeon', 'ramen'], ['ㅁ', 'm', '물', 'mul', 'water'], ['ㅂ', 'b/p', '바다', 'bada', 'sea'],
    ['ㅅ', 's', '사과', 'sagwa', 'apple'], ['ㅇ', 'ng', '아이', 'ai', 'child'], ['ㅈ', 'j', '자동차', 'jadongcha', 'car'],
    ['ㅊ', 'ch', '친구', 'chingu', 'friend'], ['ㅋ', 'k', '커피', 'keopi', 'coffee'], ['ㅌ', 't', '토마토', 'tomato', 'tomato'],
    ['ㅍ', 'p', '포도', 'podo', 'grapes'], ['ㅎ', 'h', '하늘', 'haneul', 'sky'], ['ㄲ', 'kk', '꽃', 'kkot', 'flower'],
    ['ㄸ', 'tt', '딸기', 'ttalgi', 'strawberry'], ['ㅃ', 'pp', '빵', 'ppang', 'bread'], ['ㅆ', 'ss', '쌀', 'ssal', 'rice'], ['ㅉ', 'jj', '짜다', 'jjada', 'to be salty']];
  var VOWS = [['ㅏ', 'a', '아빠', 'appa', 'dad'], ['ㅑ', 'ya', '야구', 'yagu', 'baseball'], ['ㅓ', 'eo', '어머니', 'eomeoni', 'mother'],
    ['ㅕ', 'yeo', '여름', 'yeoreum', 'summer'], ['ㅗ', 'o', '오이', 'oi', 'cucumber'], ['ㅛ', 'yo', '요리', 'yori', 'cooking'],
    ['ㅜ', 'u', '우유', 'uyu', 'milk'], ['ㅠ', 'yu', '유리', 'yuri', 'glass'], ['ㅡ', 'eu', '음악', 'eumak', 'music'],
    ['ㅣ', 'i', '이름', 'ireum', 'name'], ['ㅐ', 'ae', '개', 'gae', 'dog'], ['ㅔ', 'e', '세상', 'sesang', 'world'],
    ['ㅚ', 'oe', '회사', 'hoesa', 'company'], ['ㅘ', 'wa', '과일', 'gwail', 'fruit'], ['ㅝ', 'wo', '원', 'won', 'won (currency)'],
    ['ㅟ', 'wi', '귀', 'gwi', 'ear'], ['ㅢ', 'ui', '의사', 'uisa', 'doctor']];
  var H = { set: 'cons', sel: 0 };
  function renderHangul() {
    var list = H.set === 'cons' ? CONS : VOWS;
    var cur = list[H.sel] || list[0];
    $('wb-body').innerHTML =
      '<div class="wb-chips"><button type="button" data-hs="cons" class="' + (H.set === 'cons' ? 'on' : '') + '">Consonants</button><button type="button" data-hs="vows" class="' + (H.set === 'vows' ? 'on' : '') + '">Vowels</button></div>'
      + '<div class="wb-hg">' + list.map(function (c, i) { return '<button type="button" data-h="' + i + '" class="' + (i === H.sel ? 'on' : '') + '">' + c[0] + '<small>' + c[1] + '</small></button>'; }).join('') + '</div>'
      + '<div class="wb-k">' + cur[0] + ' · ' + cur[1] + '</div>'
      + '<button type="button" class="wb-ex" id="wb-hex"><b>' + cur[2] + '</b> ' + esc(cur[3]) + ' — ' + esc(cur[4]) + ' ' + ico('volume-2') + '</button>'
      + '<p class="wb-hint">Know them all? Switch to <a href="#" id="wb-toseed">Seed words</a>.</p>';
    document.querySelectorAll('[data-hs]').forEach(function (b) { b.onclick = function () { H.set = b.getAttribute('data-hs'); H.sel = 0; renderHangul(); }; });
    document.querySelectorAll('[data-h]').forEach(function (b) { b.onclick = function () { H.sel = +b.getAttribute('data-h'); renderHangul(); say((H.set === 'cons' ? CONS : VOWS)[H.sel][2]); }; });
    $('wb-hex').onclick = function () { say(cur[2], this); };
    $('wb-toseed').onclick = function (e) { e.preventDefault(); S.tab = 'words'; S.level = 'Starter'; render(); reset(); };
    $('wb-dock').innerHTML = '<button type="button" class="p" onclick="khWordBank.hangulQuiz()">' + ico('circle-check') + 'Hangul quiz</button>';
    icons();
  }
  function hangulQuiz() {
    var all = CONS.concat(VOWS), qs = shuffle(all).slice(0, 10), i = 0, right = 0;
    function q() {
      var c = qs[i];
      if (!c) { openOverlay('<div class="wb-done"><b>' + right + ' / ' + qs.length + '</b><small>letters</small></div><div class="wb-actions"><button type="button" class="wb-ghost" onclick="khWordBank.hangulQuiz()">Again</button><button type="button" class="wb-next" onclick="khWordBank.close()">Done</button></div>'); return; }
      var opts = shuffle([c].concat(shuffle(all.filter(function (x) { return x !== c; })).slice(0, 3)));
      openOverlay('<div class="wb-qk"><span>Hangul</span><span>' + (i + 1) + ' / ' + qs.length + '</span></div><div class="wb-prog"><i style="width:' + i * 10 + '%"></i></div>'
        + '<div class="wb-card static"><span class="big xl">' + c[0] + '</span><span class="rom">What sound is this?</span></div>'
        + '<div class="wb-g2">' + opts.map(function (o, k) { return '<button type="button" class="wb-opt" data-o="' + k + '">' + o[1] + '</button>'; }).join('') + '</div><div id="wb-fb"></div>' + closeBtn());
      var done = false;
      document.querySelectorAll('.wb-opt').forEach(function (b) {
        b.onclick = function () {
          if (done) return; done = true;
          var o = opts[+b.getAttribute('data-o')];
          if (o === c) right++;
          document.querySelectorAll('.wb-opt').forEach(function (x) { var oo = opts[+x.getAttribute('data-o')]; if (oo === c) x.classList.add('ok'); else if (x === b) x.classList.add('no'); });
          $('wb-fb').innerHTML = '<div class="wb-note"><b>' + c[0] + '</b> = ' + c[1] + ' · ' + c[2] + ' (' + esc(c[4]) + ')</div><button type="button" class="wb-next" id="wb-next">Next</button>';
          say(c[2]);
          $('wb-next').onclick = function () { i++; q(); };
        };
      });
    }
    q();
  }

  window.khWordBank = { drill: drill, close: closeOverlay, hangulQuiz: hangulQuiz };

  function start() {
    shell(); render();
    if (S.tab === 'words') reset(); else loadTotal();
    loadCounts();
  }
  function whenReady(fn, n) {
    n = n || 0;
    if (sb() || n > 40) return fn();
    setTimeout(function () { whenReady(fn, n + 1); }, 100);
  }
  document.addEventListener('DOMContentLoaded', function () { whenReady(start); });
  window.addEventListener('kh-auth-signed-in', function () { renderDue(); if (S.tab === 'words') renderList(); });
})();
