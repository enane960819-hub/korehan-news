/* Life in Korea (mockup I C/D, 2026-10-28) — practical guides for
   foreigners. Rows come from public.life_guides (seeded from
   scripts/life-guides/guides.mjs). Hub: korehan-life.html (?c=category);
   guide: korehan-life.html?g=slug. Korean terms in steps are written
   {{ko|en}} and become tappable chips; saving goes through dbSaveWord into
   My Words. No AI calls. */
(function () {
  'use strict';

  var CATS = [
    { k: 'visa', l: 'Visa & stay', d: 'ARC, extensions', i: 'stamp' },
    { k: 'housing', l: 'Housing', d: 'Wolse, jeonse, leases', i: 'house' },
    { k: 'work', l: 'Jobs & work', d: 'Part-time, pay, contracts', i: 'briefcase' },
    { k: 'school', l: 'School & study', d: 'Language schools, degrees', i: 'graduation-cap' },
    { k: 'health', l: 'Health', d: 'Insurance, clinics', i: 'heart-pulse' },
    { k: 'money', l: 'Money & phone', d: 'Bank, SIM, plans', i: 'landmark' },
    { k: 'emergency', l: 'Emergencies', d: '112, 119, 1345', i: 'siren' },
    { k: 'daily', l: 'Daily life', d: 'Transport, trash', i: 'bus' }
  ];
  var CAT_OF = {};
  CATS.forEach(function (c) { CAT_OF[c.k] = c; });
  CAT_OF.start = { k: 'start', l: 'Start here', d: '', i: 'flag' };
  // The "start" checklist is listed under Daily life too.
  function inCat(g, k) { return g.category === k || (k === 'daily' && g.category === 'start'); }

  var S = { rows: null, q: '', cat: '' };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ico(n, cls) { return '<i data-lucide="' + n + '" class="kh-ui-icon ' + (cls || 'kh-ui-icon-sm') + '" aria-hidden="true"></i>'; }
  function icons() { try { if (typeof renderKhLucideIcons === 'function') renderKhLucideIcons(); } catch (_) {} }
  function sb() { return (typeof getSupa === 'function') ? getSupa() : null; }
  function say(ko, btn) { try { if (typeof khSpeak === 'function') khSpeak(ko, 'female', btn); } catch (_) {} }
  function param(k) { var m = new RegExp('[?&]' + k + '=([^&]+)').exec(location.search); return m ? decodeURIComponent(m[1]) : ''; }
  function plain(t) { return String(t || '').replace(/\{\{([^|}]+)\|([^}]+)\}\}/g, '$1 ($2)'); }
  function isSaved(ko) { try { return (JSON.parse(localStorage.getItem('korehan_saved_words') || '[]') || []).some(function (w) { return w && w.ko === ko; }); } catch (_) { return false; } }
  function fmtDate(d) {
    if (!d) return '';
    var x = new Date(d + 'T00:00:00');
    return isNaN(x) ? d : x.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // Rows: the head prefetch (started before the page scripts), else a cached
  // copy for an instant repeat visit, else a normal query.
  var CACHE = 'kh_life_guides_v1';
  function cached() { try { var c = JSON.parse(localStorage.getItem(CACHE) || 'null'); return c && Array.isArray(c.rows) ? c.rows : null; } catch (_) { return null; } }
  async function load() {
    if (S.rows) return S.rows;
    var rows = null;
    try { rows = window._lkPrefetch ? await window._lkPrefetch : null; } catch (_) {}
    if (!Array.isArray(rows)) {
      var c = sb();
      if (c) {
        var r = await c.from('life_guides').select('slug,category,featured,sort,title,summary,steps,terms,phrases,sources,checked_at')
          .eq('status', 'published').order('sort');
        if (r.error) console.warn('[life-guides]', r.error.message); else rows = r.data || [];
      }
    }
    if (Array.isArray(rows)) { S.rows = rows; try { localStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), rows: rows })); } catch (_) {} }
    else S.rows = cached() || [];
    return S.rows;
  }

  function guideRow(g) {
    var c = CAT_OF[g.category] || CAT_OF.daily;
    return '<a class="lk-g c-' + c.k + '" href="korehan-life.html?g=' + encodeURIComponent(g.slug) + '">'
      + '<span class="lk-ic">' + ico(c.i) + '</span>'
      + '<span><b>' + esc(g.title) + '</b><small>' + esc(g.summary) + '</small></span>'
      + '<span class="lk-chev">' + ico('chevron-right') + '</span></a>';
  }

  function matches(g, q) {
    if (!q) return true;
    var hay = (g.title + ' ' + g.summary + ' ' + plain((g.steps || []).join(' ')) + ' '
      + (g.terms || []).map(function (t) { return t.ko + ' ' + t.rom + ' ' + t.en; }).join(' ')).toLowerCase();
    return q.toLowerCase().split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
  }

  function renderHub() {
    var rows = S.rows || [];
    var root = $('lk-root');
    root.innerHTML = '<div class="lk-eb">Life in Korea</div>'
      + '<h1 class="lk-h1">Living in Korea, explained — with the Korean you\'ll see.</h1>'
      + '<p class="lk-sub">Plain-English steps for visas, housing, work and health. Tap any Korean word for its meaning and save it to your review list.</p>'
      + '<label class="lk-search">' + ico('search', 'kh-ui-icon') + '<input id="lk-q" type="search" placeholder="Search: ARC, jeonse, health insurance, part-time…" value="' + esc(S.q) + '" autocomplete="off"></label>'
      + '<div class="lk-cats">' + CATS.map(function (c) {
          var n = rows.filter(function (g) { return inCat(g, c.k); }).length;
          return '<button type="button" class="lk-cat c-' + c.k + (S.cat === c.k ? ' on' : '') + '" data-cat="' + c.k + '">'
            + '<span class="lk-ic">' + ico(c.i) + '</span><b>' + c.l + '</b><small>' + (n ? n + (n === 1 ? ' guide' : ' guides') : c.d) + '</small></button>';
        }).join('') + '</div>'
      + '<div id="lk-results"></div>'
      + '<p class="lk-note">General information, not legal advice. Rules change — each guide shows when it was last checked and links to the official source.</p>';
    $('lk-q').addEventListener('input', function (e) { S.q = e.target.value.trim(); renderResults(); });
    root.querySelectorAll('[data-cat]').forEach(function (b) {
      b.addEventListener('click', function () {
        S.cat = S.cat === b.dataset.cat ? '' : b.dataset.cat;
        root.querySelectorAll('[data-cat]').forEach(function (x) { x.classList.toggle('on', x.dataset.cat === S.cat); });
        try { history.replaceState(null, '', S.cat ? '?c=' + S.cat : location.pathname); } catch (_) {}
        renderResults();
        // The list is below the 8 category cards — bring it into view.
        var res = $('lk-results');
        if (S.cat && res) { var y = res.getBoundingClientRect().top + window.scrollY - 80; window.scrollTo({ top: y, behavior: 'smooth' }); }
      });
    });
    renderResults();
  }

  function renderResults() {
    var box = $('lk-results');
    if (!box) return;
    var rows = S.rows || [];
    if (!rows.length) { box.innerHTML = '<div class="lk-empty">Guides are on their way. Check back soon.</div>'; return; }
    var h = '';
    if (S.q) {
      var hit = rows.filter(function (g) { return matches(g, S.q); });
      h = '<div class="lk-k">' + hit.length + ' result' + (hit.length === 1 ? '' : 's') + '</div>'
        + (hit.length ? '<div class="lk-list">' + hit.map(guideRow).join('') + '</div>' : '<div class="lk-empty">No guide matches that yet.</div>');
    } else if (S.cat) {
      var c = CAT_OF[S.cat];
      var list = rows.filter(function (g) { return inCat(g, S.cat); });
      h = '<div class="lk-k">' + esc(c.l) + '<button type="button" id="lk-all">All guides</button></div>'
        + (list.length ? '<div class="lk-list">' + list.map(guideRow).join('') + '</div>' : '<div class="lk-empty">No guides here yet.</div>');
    } else {
      var feat = rows.filter(function (g) { return g.featured; });
      h = '<div class="lk-k">Start here</div><div class="lk-list">' + feat.map(guideRow).join('') + '</div>'
        + '<div class="lk-k">All guides</div><div class="lk-list">' + rows.filter(function (g) { return !g.featured; }).map(guideRow).join('') + '</div>';
    }
    box.innerHTML = h;
    var all = $('lk-all');
    if (all) all.addEventListener('click', function () {
      S.cat = '';
      document.querySelectorAll('[data-cat]').forEach(function (x) { x.classList.remove('on'); });
      try { history.replaceState(null, '', location.pathname); } catch (_) {}
      renderResults();
    });
    icons();
  }

  function stepHtml(t, terms) {
    return esc(t).replace(/\{\{([^|}]+)\|([^}]+)\}\}/g, function (_, ko, en) {
      // A reviewed meaning in terms[] wins over the inline one.
      var tm = terms.filter(function (x) { return x.ko === ko; })[0];
      var gl = tm ? tm.en : en;
      return '<button type="button" class="lk-term" data-ko="' + ko + '">' + ko + '</button> <span class="lk-gl">(' + gl + ')</span>';
    });
  }

  function renderGuide(slug) {
    var g = (S.rows || []).filter(function (x) { return x.slug === slug; })[0];
    var root = $('lk-root');
    if (!g) {
      root.innerHTML = '<a class="lk-back" href="korehan-life.html">' + ico('arrow-left') + 'Life in Korea</a><div class="lk-empty">This guide is not available.</div>';
      icons();
      return;
    }
    document.title = g.title + ' — Life in Korea — KoreHani';
    var c = CAT_OF[g.category] || CAT_OF.daily;
    var terms = g.terms || [], phrases = g.phrases || [], sources = g.sources || [];
    var related = (S.rows || []).filter(function (x) { return x.slug !== g.slug && (x.category === g.category || (g.category === 'start' && x.featured)); }).slice(0, 3);
    root.innerHTML = '<a class="lk-back" href="korehan-life.html' + (g.category !== 'start' ? '?c=' + g.category : '') + '">' + ico('arrow-left') + 'Life in Korea</a>'
      + '<div class="lk-two">'
      + '<article class="lk-art">'
        + '<div class="lk-crumb">Life in Korea › ' + esc(c.l) + '</div>'
        + '<h1>' + esc(g.title) + '</h1>'
        + '<div class="lk-meta">' + (g.checked_at ? 'Last checked ' + fmtDate(g.checked_at) : '') + (sources.length ? ' · Source: ' + sources.map(function (s) { return esc(s.name); }).join(', ') : '') + '</div>'
        + '<div class="lk-tldr"><b>In short:</b> ' + esc(g.summary) + '</div>'
        + '<ol class="lk-steps">' + (g.steps || []).map(function (t) { return '<li>' + stepHtml(t, terms) + '</li>'; }).join('') + '</ol>'
        + '<div class="lk-disc">General information, not legal advice. Rules and fees change — confirm with the official source before you act.</div>'
      + '</article>'
      + '<aside class="lk-side">'
        + (phrases.length ? '<div class="lk-sc"><h2>Say it</h2>' + phrases.map(function (p) {
            return '<div class="lk-ph"><div class="t"><b>' + esc(p.ko) + '</b><span>' + esc(p.en) + '</span></div>'
              + '<button type="button" class="lk-ib" data-say="' + esc(p.ko) + '" aria-label="Listen">' + ico('volume-2') + '</button></div>';
          }).join('') + '</div>' : '')
        + (terms.length ? '<div class="lk-sc"><h2>Words in this guide</h2>' + terms.map(function (t) {
            return '<div class="lk-ph"><div class="t"><b>' + esc(t.ko) + '</b><span>' + esc(t.rom) + ' · ' + esc(t.en) + '</span></div>'
              + '<button type="button" class="lk-ib' + (isSaved(t.ko) ? ' sv' : '') + '" data-save="' + esc(t.ko) + '" aria-label="Save">' + ico(isSaved(t.ko) ? 'bookmark-check' : 'bookmark-plus') + '</button></div>';
          }).join('')
          + '<button type="button" class="lk-btn" id="lk-save-all">' + ico('bookmark-plus') + 'Save all ' + terms.length + ' words</button></div>' : '')
        + (sources.length ? '<div class="lk-sc lk-src"><h2>Official sources</h2>' + sources.map(function (s) {
            return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.name) + '</a>';
          }).join('') + '</div>' : '')
        + (related.length ? '<div class="lk-sc"><h2>Related guides</h2><div class="lk-list" style="margin:0">' + related.map(guideRow).join('') + '</div></div>' : '')
      + '</aside></div>';

    root.querySelectorAll('.lk-term').forEach(function (b) {
      b.addEventListener('click', function () { showTerm(terms.filter(function (t) { return t.ko === b.dataset.ko; })[0] || { ko: b.dataset.ko, rom: '', en: '' }); });
    });
    root.querySelectorAll('[data-say]').forEach(function (b) { b.addEventListener('click', function () { say(b.dataset.say, b); }); });
    root.querySelectorAll('[data-save]').forEach(function (b) {
      b.addEventListener('click', function () { saveTerm(terms.filter(function (t) { return t.ko === b.dataset.save; })[0]); });
    });
    var all = $('lk-save-all');
    if (all) all.addEventListener('click', function () {
      terms.forEach(function (t) { if (!isSaved(t.ko)) saveTerm(t, true); });
      all.innerHTML = ico('bookmark-check') + 'Saved — they come back in your reviews';
      icons();
      if (typeof showToast === 'function') showToast('Saved ' + terms.length + ' words to My Words');
    });
    icons();
    window.scrollTo(0, 0);
  }

  function saveTerm(t, quiet) {
    if (!t) return;
    try { if (typeof dbSaveWord === 'function') dbSaveWord(t.ko, t.rom, t.en); } catch (_) {}
    document.querySelectorAll('[data-save="' + t.ko + '"]').forEach(function (b) { b.classList.add('sv'); b.innerHTML = ico('bookmark-check'); });
    var sh = $('lk-sheet-save');
    if (sh && sh.dataset.ko === t.ko) { sh.classList.add('sv'); sh.innerHTML = ico('bookmark-check'); }
    if (!quiet && typeof showToast === 'function') showToast(t.ko + ' saved — it comes back in your reviews');
    icons();
  }

  var _sheetTimer = null;
  function showTerm(t) {
    var old = $('lk-sheet');
    if (old) old.remove();
    var el = document.createElement('div');
    el.className = 'lk-sheet';
    el.id = 'lk-sheet';
    el.innerHTML = '<div class="t"><b>' + esc(t.ko) + '</b><small>' + esc(t.rom) + '</small><span>' + esc(t.en) + '</span></div>'
      + '<button type="button" class="lk-ib" id="lk-sheet-say" aria-label="Listen">' + ico('volume-2') + '</button>'
      + '<button type="button" class="lk-ib' + (isSaved(t.ko) ? ' sv' : '') + '" id="lk-sheet-save" data-ko="' + esc(t.ko) + '" aria-label="Save">' + ico(isSaved(t.ko) ? 'bookmark-check' : 'bookmark-plus') + '</button>'
      + '<button type="button" class="lk-ib" id="lk-sheet-x" aria-label="Close">' + ico('x') + '</button>';
    document.body.appendChild(el);
    $('lk-sheet-say').addEventListener('click', function () { say(t.ko, this); });
    $('lk-sheet-save').addEventListener('click', function () { saveTerm(t); });
    $('lk-sheet-x').addEventListener('click', function () { el.remove(); });
    say(t.ko);
    clearTimeout(_sheetTimer);
    _sheetTimer = setTimeout(function () { if (el.parentNode) el.remove(); }, 9000);
    icons();
  }

  function route() {
    var slug = param('g');
    S.cat = CAT_OF[param('c')] ? param('c') : '';
    if (slug) renderGuide(slug);
    else renderHub();
  }
  async function start() {
    // Paint from the cache right away; repaint when fresh rows arrive.
    var c = cached();
    if (c && c.length && !S.rows) { S.rows = c; route(); S.rows = null; }
    var before = JSON.stringify(c || []);
    await load();
    if (JSON.stringify(S.rows) !== before || !(c && c.length)) route();
    // Background refresh from the DB (reviewed meanings, new guides).
    whenReady(async function () {
      var cl = sb(); if (!cl) return;
      var r = await cl.from('life_guides').select('slug,category,featured,sort,title,summary,steps,terms,phrases,sources,checked_at').eq('status', 'published').order('sort');
      if (!r || r.error || !Array.isArray(r.data) || !r.data.length) return;
      if (JSON.stringify(r.data) === JSON.stringify(S.rows)) return;
      S.rows = r.data;
      try { localStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), rows: r.data })); } catch (_) {}
      // Don't repaint an open guide (it would jump to the top) or a search in progress.
      if (!param('g') && !(document.getElementById('lk-q') && document.getElementById('lk-q').value)) route();
    });
  }
  function whenReady(fn, n) {
    n = n || 0;
    if (sb() || n > 40) return fn();
    setTimeout(function () { whenReady(fn, n + 1); }, 100);
  }
    // Loaded before the shared scripts: with the head prefetch, paint now.
  if (window._lkPrefetch && document.getElementById('lk-root')) start();
  else document.addEventListener('DOMContentLoaded', function () { whenReady(start); });
  // Icons are drawn once the shared scripts are in.
  document.addEventListener('DOMContentLoaded', icons);
})();
