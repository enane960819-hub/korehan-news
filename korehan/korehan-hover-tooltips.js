(function(){
  var vocabList = [];
  var vocabWords = [];
  var initialized = false;
  var observer = null;

  // shared.js의 getSupa() 재사용 — 이중 클라이언트 방지
  function getSb() {
    if (typeof window.getSupa === 'function') return window.getSupa();
    return null;
  }

  function injectStyles() {
    if (document.getElementById('kh-hover-style')) return;
    var style = document.createElement('style');
    style.id = 'kh-hover-style';
    style.textContent = `
      .kh-hover-word{
        position:relative;
        cursor:help;
        text-decoration:underline;
        text-decoration-style:dotted;
        text-decoration-color:rgba(122,184,245,.75);
        text-decoration-thickness:1.5px;
        text-underline-offset:4px;
        transition:background .15s,text-decoration-color .15s;
      }
      .kh-hover-word:hover{
        background:rgba(122,184,245,.14);
        text-decoration-color:#2255a4;
      }
      .kh-hover-tip{
        position:fixed;
        z-index:99999;
        min-width:200px;
        max-width:300px;
        pointer-events:auto;
        background:#0f172a;
        color:#fff;
        border-radius:16px;
        padding:13px 14px 10px;
        box-shadow:0 18px 40px rgba(2,8,23,.38);
        opacity:0;
        transform:translateY(6px);
        transition:opacity .12s,transform .12s;
      }
      .kh-hover-tip.show{
        opacity:1;
        transform:translateY(0);
      }
      .kh-hover-tip .kh-tip-close{
        position:absolute;top:4px;right:4px;
        width:32px;height:32px;
        display:flex;align-items:center;justify-content:center;
        background:rgba(255,255,255,.12);color:#cbd5e1;
        border:none;border-radius:50%;cursor:pointer;
        font-size:16px;font-weight:700;font-family:inherit;
        padding:0;line-height:1;
      }
      .kh-hover-tip .kh-tip-close:hover{ background:rgba(255,255,255,.22);color:#fff; }
      .kh-hover-tip .ko{
        font-size:16px;
        font-weight:800;
        color:#fff;
        margin-bottom:2px;
      }
      .kh-hover-tip .rom{
        font-size:11px;
        color:#9ec4ff;
        font-style:italic;
        margin-bottom:6px;
      }
      .kh-hover-tip .en{
        font-size:12px;
        line-height:1.55;
        color:#e5edf9;
      }
      .kh-hover-tip .infl{
        margin-top:8px;
        padding:8px 10px;
        background:rgba(147,197,253,.10);
        border:1px solid rgba(147,197,253,.22);
        border-radius:10px;
        font-size:11px;
        line-height:1.5;
        color:#cfe2ff;
      }
      .kh-hover-tip .infl-line{
        font-weight:600;
        color:#e5edf9;
        word-break:keep-all;
      }
      .kh-hover-tip .infl-surface{ color:#fff;font-weight:800; }
      .kh-hover-tip .infl-stem{ color:#9ec4ff;font-weight:700; }
      .kh-hover-tip .infl-end{ color:#fcd34d;font-weight:700; }
      .kh-hover-tip .infl-label{
        margin-top:3px;
        font-size:10.5px;
        font-weight:600;
        color:#a5b4fc;
        letter-spacing:.01em;
      }
      .kh-hover-tip .note{
        font-size:11px;
        line-height:1.55;
        color:#cbd5e1;
        margin-top:5px;
      }
      .kh-hover-tip .tip-footer{
        display:flex;
        align-items:center;
        justify-content:flex-end;
        gap:6px;
        margin-top:10px;
        padding-top:8px;
        border-top:1px solid rgba(255,255,255,.1);
      }
      .kh-tip-speak{
        display:inline-flex;align-items:center;justify-content:center;
        width:30px;height:30px;border-radius:999px;
        border:1.5px solid rgba(255,255,255,.2);
        background:rgba(255,255,255,.08);
        font-size:14px;line-height:1;cursor:pointer;transition:all .15s;
        font-family:inherit;margin-right:auto;
      }
      .kh-tip-speak:hover{ border-color:#93c5fd;background:rgba(147,197,253,.15); }
      .kh-tip-speak.kh-speaking{ border-color:#93c5fd;background:rgba(147,197,253,.22);animation:khTipPulse .9s ease-in-out infinite; }
      @keyframes khTipPulse{ 0%,100%{transform:scale(1);} 50%{transform:scale(1.12);} }
      .kh-tip-save{
        display:inline-flex;align-items:center;gap:4px;
        padding:5px 12px;border-radius:999px;
        border:1.5px solid rgba(255,255,255,.2);
        background:rgba(255,255,255,.08);
        color:rgba(255,255,255,.8);
        font-size:11px;font-weight:700;
        cursor:pointer;transition:all .15s;
        font-family:inherit;
      }
      .kh-tip-save:hover{
        border-color:#93c5fd;background:rgba(147,197,253,.15);color:#fff;
      }
      .kh-tip-save.saved{
        border-color:#4ade80;background:rgba(74,222,128,.12);color:#4ade80;
        pointer-events:none;
      }
    `;
    document.head.appendChild(style);
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ── Inflection analyzer ──────────────────────────────────────
  // When the surface form in the article (e.g. 만들어진) differs from
  // the dictionary entry (만들다), explain WHICH endings were combined
  // so a learner can connect the form they see to the form they'd look
  // up. Matches longest first, falls back to a generic label when no
  // pattern fits. Patterns cover the most common verb/adjective endings
  // for news + conversational Korean — passive (~어지다), past polite
  // (~었어요), formal (~ㅂ니다), attributives (~ㄴ/~는/~ㄹ), and the
  // major connectives.
  var INFLECTION_PATTERNS = [
    // Passive (~어지다) compounds — listed before plain past so 어진/어졌어요
    // get the richer label.
    {re: /^[어아여]진$/,        ending: '~어지다 + ~ㄴ',     label: 'Passive · past modifier (was ___ed)'},
    {re: /^[어아여]지는$/,      ending: '~어지다 + ~는',     label: 'Passive · present modifier (becoming ___ed)'},
    {re: /^[어아여]질$/,        ending: '~어지다 + ~ㄹ',     label: 'Passive · future modifier (to be ___ed)'},
    {re: /^[어아여]졌어요$/,    ending: '~어지다 + ~었어요', label: 'Passive · past polite (was ___ed)'},
    {re: /^[어아여]졌습니다$/,  ending: '~어지다 + ~었습니다', label: 'Passive · past formal (was ___ed)'},
    {re: /^[어아여]지고$/,      ending: '~어지다 + ~고',     label: 'Passive + connector (becoming ___ed and)'},
    {re: /^[어아여]지다$/,      ending: '~어지다',           label: 'Passive / change of state (become ___ed)'},
    {re: /^[어아여]져$/,        ending: '~어지다 (stem)', label: 'Passive stem (becoming ___ed)'},
    // Past tense
    {re: /^았어요$|^었어요$|^였어요$/,         ending: '~었어요',   label: 'Past · polite (___ed)'},
    {re: /^았습니다$|^었습니다$|^였습니다$/,    ending: '~었습니다', label: 'Past · formal (___ed)'},
    {re: /^았다$|^었다$|^였다$/,               ending: '~었다',     label: 'Past · plain (___ed)'},
    {re: /^았던$|^었던$|^였던$/,               ending: '~었던',     label: 'Past recollection modifier (that had ___ed)'},
    // Polite / formal present
    {re: /^[어아여]요$/,                       ending: '~어요',     label: 'Present · polite (___s/___ing)'},
    {re: /^[ㅂ습]니다$/,                       ending: '~ㅂ니다',   label: 'Present · formal (___s/___ing)'},
    {re: /^[ㅂ습]니까$/,                       ending: '~ㅂ니까',   label: 'Question · formal (___?)'},
    // Plain present
    {re: /^ㄴ다$|^는다$/,                      ending: '~ㄴ다/~는다', label: 'Present · plain (___s)'},
    // Attributive
    {re: /^[ㄴ은]$/,                           ending: '~ㄴ',       label: 'Past modifier ([noun] that was ___ed)'},
    {re: /^는$/,                               ending: '~는',       label: 'Present modifier ([noun] that ___s)'},
    {re: /^[ㄹ을]$/,                           ending: '~ㄹ',       label: 'Future modifier ([noun] that will ___)'},
    // Connectives
    {re: /^고$/,                               ending: '~고',       label: 'Connector (and / then)'},
    {re: /^[어아여]서$/,                       ending: '~어서',     label: 'Connector (because / and then)'},
    {re: /^지만$/,                             ending: '~지만',     label: 'Connector (but)'},
    {re: /^[으]?면$/,                          ending: '~(으)면',   label: 'Condition (if)'},
    {re: /^[으]?니까$/,                        ending: '~(으)니까', label: 'Connector (because)'},
    {re: /^[으]?려고$/,                        ending: '~(으)려고', label: 'Intention (in order to)'},
    {re: /^도록$/,                             ending: '~도록',     label: 'Connector (so that ___)'},
    // Nominal / adverbial
    {re: /^기$/,                               ending: '~기',       label: 'Noun form (___ing as noun)'},
    {re: /^게$/,                               ending: '~게',       label: 'Adverb form (___ly / so that)'},
    // Honorific
    {re: /^시$|^으시$/,                        ending: '~(으)시',   label: 'Honorific stem'},
    {re: /^세요$|^으세요$/,                    ending: '~(으)세요', label: 'Honorific polite (please ___)'},
    {re: /^셨어요$|^으셨어요$/,                ending: '~(으)셨어요', label: 'Honorific past polite (___ed)'},
  ];
  function analyzeInflection(dict, surface) {
    if (!dict || !surface || dict === surface) return null;
    var stem = /다$/.test(dict) ? dict.slice(0, -1) : dict;
    if (!stem || !surface.startsWith(stem)) return null;
    var trailer = surface.slice(stem.length);
    if (!trailer) return null;
    for (var i = 0; i < INFLECTION_PATTERNS.length; i++) {
      var p = INFLECTION_PATTERNS[i];
      if (p.re.test(trailer)) {
        return { trailer: trailer, ending: p.ending, label: p.label };
      }
    }
    return { trailer: trailer, ending: '~' + trailer, label: 'Conjugated form' };
  }

  async function loadHoverVocab() {
    try {
      var client = getSb();
      if (!client) return;
      // Lookup pool unions hover_vocab_master + vocabulary_bank.
      // hover_vocab_master is the big general dictionary; vocabulary_bank
      // is the curated learning pool (admin Vocab Bank, daily-vocab
      // assignments). Previously only hover_vocab_master powered the
      // article-body hover, so anything an admin added through Vocab
      // Bank silently failed to underline. Pull both, dedupe by
      // word_ko (hover_vocab_master wins on conflict — its meaning_en
      // is usually shorter / more dictionary-clean).
      var hoverRows = [];
      var bankRows = [];
      // PostgREST returns at most 1000 rows per request — page through both
      // tables (vocabulary_bank alone has ~2000 words).
      async function _allRows(build) {
        var out = [], from = 0, PAGE = 1000;
        for (var guard = 0; guard < 20; guard++) {
          var r = await build().range(from, from + PAGE - 1);
          var rows = (r && r.data) || [];
          out = out.concat(rows);
          if (r.error || rows.length < PAGE) break;
          from += PAGE;
        }
        return out;
      }
      try {
        hoverRows = await _allRows(function() {
          return client.from('hover_vocab_master')
            .select('word_ko, meaning_en, reading, note, is_active, sort_order')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .order('word_ko', { ascending: true });
        });
      } catch(_) {}
      try {
        // Shared cached copy from korehan-shared.js (one fetch per 6h
        // instead of 5 more requests on every page).
        var bankRaw = (typeof window.khVocabBankRows === 'function')
          ? await window.khVocabBankRows()
          : await _allRows(function() {
              return client.from('vocabulary_bank')
                .select('word_ko, word_en, word_rom, is_active')
                .eq('is_active', true)
                .order('word_ko', { ascending: true });
            });
        bankRows = bankRaw.map(function(b) {
          return {
            word_ko: b.word_ko,
            meaning_en: b.word_en,
            reading: b.word_rom || '',
            note: '',
            is_active: true,
            sort_order: 99999,
          };
        });
      } catch(_) {}
      var seen = {};
      var merged = [];
      hoverRows.concat(bankRows).forEach(function(x) {
        if (!x || !x.word_ko || !x.meaning_en || x.word_ko.length < 2) return;
        if (seen[x.word_ko]) return;
        seen[x.word_ko] = true;
        merged.push(x);
      });

      vocabList = merged;
      vocabWords = vocabList.map(function(x){ return x.word_ko; }).sort(function(a,b){ return b.length - a.length; });
      _rebuildIndex();
    } catch (e) {
      console.warn('hover vocab load failed', e);
      vocabList = [];
      vocabWords = [];
      _rebuildIndex();
    }
  }

  // ── Lookup index (2026-10-30 perf) ───────────────────────────
  // findFirstMatch used to build two RegExps per dictionary word (~6k words)
  // for every text node, and every sweep re-scanned text it had already
  // scanned. Opening a sentence-analysis panel triggered a sweep of the
  // whole article: 1.5 s+ main-thread freezes on phones (scroll "lag").
  // Now: one Set/Map lookup per Hangul run, multi-word entries in one
  // precompiled regex, and text nodes that found nothing are remembered.
  var _byWord = new Map();      // word_ko → entry
  var _exact = new Set();       // single-run words (no spaces)
  var _stems = new Map();       // stem of a 다/요 word → longest such word
  var _multiRe = null;          // words containing a space, longest first
  var _scanned = new WeakSet(); // text nodes already scanned with this index
  function _rebuildIndex() {
    _byWord = new Map(); _exact = new Set(); _stems = new Map(); _scanned = new WeakSet();
    var multi = [];
    vocabList.forEach(function(v){ if (v && v.word_ko && !_byWord.has(v.word_ko)) _byWord.set(v.word_ko, v); });
    vocabWords.forEach(function(w){
      if (!w) return;
      if (/\s/.test(w)) { multi.push(w); return; }
      _exact.add(w);
      if (w.length >= 3 && /[다요]$/.test(w)) {
        var stem = w.slice(0, -1);
        if (stem.length >= 2 && !_stems.has(stem)) _stems.set(stem, w);
      }
    });
    _multiRe = multi.length ? new RegExp('(^|[^가-힣])(' + multi.map(escapeRegExp).join('|') + ')(?![가-힣])') : null;
  }
  function getVocab(word) {
    return _byWord.get(word) || null;
  }

  // Expose the merged dictionary to other surfaces (e.g. story
  // paragraph analysis pulls these words when they appear in body
  // text, so the recurring high-value vocab the admin curated /
  // vocabulary_bank holds doesn't just live behind a hover —
  // it surfaces in the per-paragraph list too).
  window.khGetHoverVocab = getVocab;
  window.khGetHoverVocabList = function() { return vocabList.slice(); };
  window.khGetHoverVocabWords = function() { return vocabWords.slice(); };

  function shouldSkipNode(node) {
    if (!node || !node.parentNode) return true;
    var parent = node.parentNode;
    if (!parent.tagName) return true;
    var tag = parent.tagName.toLowerCase();
    if (['script','style','textarea','input','button','select','option'].indexOf(tag) !== -1) return true;
    if (parent.closest('.kh-hover-word')) return true;
    // .kh-word is the legacy hover system (wrapVocab → global VOCAB
    // dict). When both systems wrapped the same word the user saw the
    // tooltip stacked / rendered twice. Skipping anything already
    // covered by .kh-word means each word gets exactly one hover
    // surface — .kh-word owns the article body, .kh-hover-word
    // covers everywhere else.
    if (parent.closest('.kh-word')) return true;
    if (parent.closest('[data-hover-skip="1"]')) return true;
    // Don't wrap text inside any button or button-role element. The
    // wrapper span captures clicks for the tooltip, which steals
    // them from the surrounding button — on desktop study room this
    // showed up as "click area doesn't match the button". Mobile
    // tap-to-reveal happened to dodge it because mobile doesn't
    // hover, but the button's onclick still misfired.
    // Modal overlays carry role="button" (tap the backdrop to close) and
    // wrap the whole modal — they must not count, or nothing inside a
    // modal (e.g. the Article Study reader) ever gets a tooltip.
    var btnLike = parent.closest('button, [role="button"], a[onclick], a[href], label');
    if (btnLike && !/(^|\s)(su-overlay|feat-overlay)(\s|$)|overlay/.test(btnLike.className || '')) return true;
    return false;
  }

  var _PARTICLE_TRAILER = /^(에|의|을|를|이|가|도|만|과|와|로|부터|까지|보다|마저|조차|처럼|만큼|랑|하고|이라|라는|라고)/;
  // Leftmost match in the text: a whole Hangul run that is a dictionary word,
  // or a 다/요 word's stem + 1-4 ending syllables (e.g. 첨벙거리다 →
  // 첨벙거리는), or a multi-word entry. Same word-boundary rules as before.
  function findFirstMatch(text) {
    var best = null;
    if (_multiRe) {
      var mm = text.match(_multiRe);
      if (mm) best = { word: mm[2], matched: mm[2], index: mm.index + mm[1].length };
    }
    var re = /[가-힣]+/g, m;
    while ((m = re.exec(text))) {
      if (best && m.index >= best.index) break;
      var tok = m[0];
      if (_exact.has(tok)) return { word: tok, matched: tok, index: m.index };
      for (var L = Math.min(tok.length - 1, 30); L >= 2; L--) {
        var w = _stems.get(tok.slice(0, L));
        if (!w) continue;
        var trailer = tok.slice(L, L + 4);
        if (_PARTICLE_TRAILER.test(trailer)) continue;
        return { word: w, matched: tok.slice(0, L) + trailer, index: m.index };
      }
    }
    return best;
  }

  function wrapTextNode(node) {
    if (_scanned.has(node)) return;
    var text = node.nodeValue;
    if (!text || !text.trim()) { _scanned.add(node); return; }
    var match = findFirstMatch(text);
    if (!match) { _scanned.add(node); return; }

    // Vocab lookup uses the dictionary form; visible text uses the actual
    // matched string (may be a conjugated form longer than the dictionary entry).
    var vocab = getVocab(match.word);
    if (!vocab) return;

    var matchedLen = (match.matched || match.word).length;
    var before = text.slice(0, match.index);
    var target = text.slice(match.index, match.index + matchedLen);
    var after  = text.slice(match.index + matchedLen);

    var frag = document.createDocumentFragment();
    if (before) frag.appendChild(document.createTextNode(before));

    var afterNode = null;
    var span = document.createElement('span');
    span.className = 'kh-hover-word';
    span.textContent = target;
    span.dataset.word = vocab.word_ko;
    span.dataset.meaning = vocab.meaning_en || '';
    span.dataset.reading = vocab.reading || '';
    span.dataset.note = vocab.note || '';
    // When the surface form differs from the dictionary entry (e.g.
    // 만들어진 vs 만들다), capture the conjugation breakdown so the
    // tooltip can show which endings were combined to produce it.
    var infl = analyzeInflection(vocab.word_ko, target);
    if (infl) {
      span.dataset.surface = target;
      span.dataset.inflEnd = infl.ending;
      span.dataset.inflLabel = infl.label;
    }
    span.addEventListener('mouseenter', onWordEnter);
    span.addEventListener('mouseleave', onWordLeave);
    span.addEventListener('mousemove', moveTooltip);
    span.addEventListener('click', onWordTap);
    frag.appendChild(span);

    if (after) { afterNode = document.createTextNode(after); frag.appendChild(afterNode); }

    node.parentNode.replaceChild(frag, node);

    // Continue scanning ONLY the remaining text we just split off — not the
    // whole document. The previous code called wrapAllIn(document.body) here,
    // which re-walked every text node on the page after wrapping each word.
    // On a text-heavy page (article + Review quiz cards) that cascades into
    // an O(n²) storm — a single tab switch froze the main thread for ~6.6s
    // (the "페이지 멈춤" bug). Recursing on just afterNode keeps it linear.
    if (afterNode) wrapTextNode(afterNode);
  }

  function walk(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }
    nodes.forEach(function(n){
      if (!shouldSkipNode(n)) wrapTextNode(n);
    });
  }

  function wrapAllIn(root) {
    if (!root || !vocabWords.length) return;
    walk(root);
  }

  function getTargets() {
    // Include story detail modal panel explicitly (it sits outside the
    // outer .st-container and would otherwise never be scanned).
    // Also include the Phrase Munch and Key Expressions modal bodies —
    // their example/practice sentences contain words the learner hasn't
    // necessarily met yet (the user pointed out 영화 in PM Practice
    // isn't taught anywhere; without hover the activity becomes a
    // guess-the-meaning instead of a pattern-recognition exercise).
    // Article-Study modal containers are also included — without them
    // the body text inside the study room reader was missing tooltips
    // intermittently after a step transition.
    var list = [
      document.getElementById('dyn-article'),
      document.getElementById('sentences-list'),
      document.getElementById('dyn-article-list'),
      document.getElementById('st-panel'),
      document.getElementById('pm-body'),
      document.getElementById('ke-expressions-list'),
      document.getElementById('as-article-content'),
      document.getElementById('as-activity-area'),
      document.getElementById('as-su-body')
    ];
    // querySelectorAll because stories.html has two .st-container instances
    // (outer page wrapper + inner modal body) — we must scan both.
    // .detail-panel = the conversations detail modal (chat bubbles
    // live here; without it hover tooltips never reached the per-
    // bubble Korean text and conversations had silent words).
    ['.conv-page-container', '.detail-panel', '.st-container', '.sr-body', '.learn-body', '.su-body', '.su-panel', '.as-panel'].forEach(function(sel) {
      document.querySelectorAll(sel).forEach(function(el){ list.push(el); });
    });
    return list.filter(Boolean);
  }

  var tip = null;
  var _hideTimer = null;
  var _overTip = false;

  function ensureTooltip() {
    if (tip) return tip;
    tip = document.createElement('div');
    tip.className = 'kh-hover-tip';
    tip.addEventListener('mouseenter', function(){ _overTip = true; clearTimeout(_hideTimer); });
    tip.addEventListener('mouseleave', function(){ _overTip = false; scheduleHide(); });
    document.body.appendChild(tip);
    return tip;
  }

  function scheduleHide() {
    clearTimeout(_hideTimer);
    _hideTimer = setTimeout(function(){
      if (!_overTip) {
        var t = ensureTooltip();
        t.classList.remove('show');
      }
    }, 200);
  }

  function isWordSavedLocally(ko) {
    try {
      var saved = JSON.parse(localStorage.getItem('korehan_saved_words') || '[]');
      return saved.some(function(w){ return (w.ko || w.word_ko || '') === ko; });
    } catch(e) { return false; }
  }

  function showTooltip(e) {
    var el = e.currentTarget;
    var t = ensureTooltip();
    var word     = el.dataset.word     || '';
    // Rule-based romanization (korehan-shared.js) beats stored AI readings.
    var reading  = (typeof window.khRomanize === 'function' && window.khRomanize(word)) || el.dataset.reading || '';
    var meaning  = el.dataset.meaning  || '';
    var note     = el.dataset.note     || '';
    var surface  = el.dataset.surface  || '';
    var inflEnd  = el.dataset.inflEnd  || '';
    var inflLab  = el.dataset.inflLabel|| '';
    var saved = isWordSavedLocally(word);

    var inflBlock = '';
    if (surface && surface !== word) {
      inflBlock =
        '<div class="infl">'
        + '<div class="infl-line">'
        + '<span class="infl-surface">' + surface + '</span>'
        + ' = <span class="infl-stem">' + word + '</span>'
        + (inflEnd ? ' + <span class="infl-end">' + inflEnd + '</span>' : '')
        + '</div>'
        + (inflLab ? '<div class="infl-label">' + inflLab + '</div>' : '')
        + '</div>';
    }

    t.innerHTML =
      '<button class="kh-tip-close" aria-label="Close" onclick="window._khTipClose && window._khTipClose()">✕</button>'
      + '<div class="ko">' + word + '</div>'
      + (reading ? '<div class="rom">' + reading + '</div>' : '')
      + '<div class="en">' + meaning + '</div>'
      + inflBlock
      + (note ? '<div class="note">' + note + '</div>' : '')
      + '<div class="tip-footer">'
      + '<button class="kh-tip-speak" aria-label="Play pronunciation" title="Play pronunciation" '
      + 'data-word="' + word + '" onclick="window._khTipSpeak && window._khTipSpeak(this, event)">🔊</button>'
      + '<button class="kh-tip-save' + (saved ? ' saved' : '') + '" '
      + 'data-word="' + word + '" data-reading="' + reading + '" data-meaning="' + meaning + '" '
      + 'onclick="window._khTipSave && window._khTipSave(this)">'
      + (saved ? '✓ Saved' : '+ Save')
      + '</button>'
      + '</div>';

    t.classList.add('show');
    moveTooltip(e);
  }

  // 🔊 pronounce the word. Prefer the natural neural voice (khSpeak →
  // tts-proxy) for signed-in users; khSpeak itself falls back to the
  // browser ttsSpeak for anon users or on any failure. Don't let the tap
  // bubble to the sentence-analysis handler or close the tooltip.
  window._khTipSpeak = function(btn, ev) {
    if (ev) { try { ev.stopPropagation(); } catch(_) {} }
    var w = (btn && btn.dataset && btn.dataset.word) || '';
    if (!w) return;
    if (typeof window.khSpeak === 'function') { window.khSpeak(w, 'female', btn); return; }
    if (typeof window.ttsSpeak === 'function') { window.ttsSpeak(w, btn); return; }
    try {
      if (window.speechSynthesis) {
        var u = new SpeechSynthesisUtterance(w); u.lang = 'ko-KR'; u.rate = 0.9;
        window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
      }
    } catch(_) {}
  };

  // Exposed globally so the inline onclick can reach it
  window._khTipSave = async function(btn) {
    if (btn.classList.contains('saved')) return;
    var ko      = btn.dataset.word    || '';
    var rom     = btn.dataset.reading || '';
    var en      = btn.dataset.meaning || '';
    btn.disabled = true;
    if (typeof window.dbSaveWord === 'function') {
      await window.dbSaveWord(ko, rom, en);
    }
    btn.classList.add('saved');
    btn.textContent = '✓ Saved';
    btn.disabled = false;
    if (typeof window.toast === 'function') window.toast('Saved to your word list!', false);
  };

  function onWordEnter(e) {
    clearTimeout(_hideTimer);
    showTooltip(e);
  }
  function onWordLeave() {
    scheduleHide();
  }
  function onWordTap(e) {
    // Mobile: tap a word to show its tooltip (mouse events don't fire on touch).
    // Crucially, do NOT stopPropagation — the .art-sent ancestor has an
    // onclick that opens the sentence-analysis panel, and swallowing the
    // event here was the "기사 본문 탭이 무반응" bug. With the click
    // bubbling through, the hover tip flashes and the sentence panel
    // takes over; the tip's outside-tap closer dismisses it as soon as
    // the panel renders, so the learner sees the sentence panel.
    clearTimeout(_hideTimer);
    showTooltip(e);
    // Position near the tapped word (mousemove won't fire on touch)
    var rect = e.currentTarget.getBoundingClientRect();
    var t = ensureTooltip();
    var x = Math.min(rect.left, window.innerWidth - 320);
    var y = rect.bottom + 8;
    if (y + 160 > window.innerHeight) y = Math.max(10, rect.top - 160);
    t.style.left = Math.max(10, x) + 'px';
    t.style.top  = Math.max(10, y) + 'px';
    _installOutsideTapCloser();
  }

  // Exposed for the ✕ close button on the tooltip — gives mobile users
  // a guaranteed dismiss path even when iOS Safari swallows the outside-
  // tap closer.
  window._khTipClose = function() {
    hideTooltip();
    if (_outsideTapHandler) {
      document.removeEventListener('click', _outsideTapHandler, true);
      document.removeEventListener('touchstart', _outsideTapHandler, true);
      _outsideTapHandler = null;
      _outsideTapInstalled = false;
    }
  };

  var _outsideTapInstalled = false;
  var _outsideTapHandler = null;
  function _installOutsideTapCloser() {
    if (_outsideTapInstalled) return;
    _outsideTapInstalled = true;
    _outsideTapHandler = function(ev) {
      if (!tip) return;
      if (tip.contains(ev.target)) return;
      if (ev.target && ev.target.closest && ev.target.closest('.kh-hover-word')) return;
      hideTooltip();
      document.removeEventListener('click', _outsideTapHandler, true);
      document.removeEventListener('touchstart', _outsideTapHandler, true);
      _outsideTapHandler = null;
      _outsideTapInstalled = false;
    };
    // Listen for BOTH click and touchstart. iOS Safari often doesn't
    // fire click on non-interactive elements (body, plain text, images
    // without click handlers), which left the tooltip stuck open after
    // tapping outside. touchstart fires reliably on every tap and gives
    // the dismiss a guaranteed second path on mobile.
    setTimeout(function(){
      document.addEventListener('click', _outsideTapHandler, true);
      document.addEventListener('touchstart', _outsideTapHandler, true);
    }, 0);
  }

  function moveTooltip(e) {
    var t = ensureTooltip();
    var x = e.clientX + 14;
    var y = e.clientY + 16;
    var maxX = window.innerWidth - 320;
    var maxY = window.innerHeight - 160;
    t.style.left = Math.max(10, Math.min(x, maxX)) + 'px';
    t.style.top  = Math.max(10, Math.min(y, maxY)) + 'px';
  }

  function hideTooltip() {
    var t = ensureTooltip();
    t.classList.remove('show');
  }

  function installObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(function(mutations) {
      // Only react to additions inside target containers — used to
      // observe document.body which fired on every header/footer
      // re-render and study-room state change. On the study-room
      // (the heaviest page, ~141KB inline) that rebuilt the whole
      // wrap tree on mode swap, sending the observer through a 250ms
      // debounce loop that visibly janked mid-game.
      var targets = getTargets();
      var matched = false;
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
          if (node.nodeType !== 1) return;
          for (var i = 0; i < targets.length; i++) {
            if (targets[i].contains(node)) {
              wrapAllIn(node);
              matched = true;
              return;
            }
          }
        });
      });
      // Debounced safety net — only run if at least one mutation
      // actually landed in a target.
      if (matched) debounceApply();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  var applyTimer = null;
  function debounceApply() {
    clearTimeout(applyTimer);
    applyTimer = setTimeout(applyHoverTooltips, 250);
  }

  function applyHoverTooltips() {
    getTargets().forEach(function(root){
      wrapAllIn(root);
    });
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    injectStyles();
    await loadHoverVocab();
    applyHoverTooltips();
    installObserver();
    // One delayed sweep — modals that open after init's first sweep
    // (article-study, story detail, PM) sometimes mount their text
    // after the MutationObserver's debounce fires once. Down from
    // three timed sweeps (800/1800/3500ms) since the observer now
    // catches new modal mounts itself; a single 1.2s safety sweep
    // covers race conditions without polling. Fewer scheduled scans
    // = less idle CPU on slow devices.
    setTimeout(applyHoverTooltips, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.korehanHoverRefresh = async function(){
    await loadHoverVocab();
    applyHoverTooltips();
  };

  // Register story/article-specific vocab in-memory so hover works for words
  // that aren't in hover_vocab_master. Accepts array of {ko, en, rom, note} or
  // {word_ko, meaning_en, reading, note}. Merged and re-applied immediately.
  window.korehanHoverRegisterExtras = function(extras) {
    if (!Array.isArray(extras) || !extras.length) return;
    var existing = {};
    vocabList.forEach(function(v){ existing[v.word_ko] = true; });
    extras.forEach(function(x) {
      var ko = x.word_ko || x.ko;
      if (!ko || existing[ko]) return;
      // Skip single-character entries — they would auto-match inside compound
      // words and fragment the underline character-by-character.
      if (ko.length < 2) return;
      var entry = {
        word_ko:    ko,
        meaning_en: x.meaning_en || x.en || '',
        reading:    x.reading    || x.rom || '',
        note:       x.note       || ''
      };
      if (!entry.meaning_en) return;
      vocabList.push(entry);
      existing[ko] = true;
    });
    // Rebuild sorted vocab word list (longest first)
    vocabWords = vocabList.map(function(x){ return x.word_ko; })
      .sort(function(a,b){ return b.length - a.length; });
    _rebuildIndex();
    applyHoverTooltips();
  };
})();
