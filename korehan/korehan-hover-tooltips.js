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
        margin-top:10px;
        padding-top:8px;
        border-top:1px solid rgba(255,255,255,.1);
      }
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
    {re: /^[어아여]진$/,        ending: '~어지다 + ~ㄴ',     label: '피동 · 관형형 과거 (was ___ed)'},
    {re: /^[어아여]지는$/,      ending: '~어지다 + ~는',     label: '피동 · 관형형 현재 (becoming ___ed)'},
    {re: /^[어아여]질$/,        ending: '~어지다 + ~ㄹ',     label: '피동 · 관형형 미래 (to be ___ed)'},
    {re: /^[어아여]졌어요$/,    ending: '~어지다 + ~었어요', label: '피동 과거 정중체 (was ___ed)'},
    {re: /^[어아여]졌습니다$/,  ending: '~어지다 + ~었습니다', label: '피동 과거 격식체 (was ___ed)'},
    {re: /^[어아여]지고$/,      ending: '~어지다 + ~고',     label: '피동 + 연결 (becoming ___ed and)'},
    {re: /^[어아여]지다$/,      ending: '~어지다',           label: '피동/상태변화 (become ___ed)'},
    {re: /^[어아여]져$/,        ending: '~어지다 (반말/어간)', label: '피동 어간 (becoming ___ed)'},
    // Past tense
    {re: /^았어요$|^었어요$|^였어요$/,         ending: '~었어요',   label: '과거 정중체 (___ed)'},
    {re: /^았습니다$|^었습니다$|^였습니다$/,    ending: '~었습니다', label: '과거 격식체 (___ed)'},
    {re: /^았다$|^었다$|^였다$/,               ending: '~었다',     label: '과거 평서 (___ed)'},
    {re: /^았던$|^었던$|^였던$/,               ending: '~었던',     label: '과거 회상 관형형 (that had ___ed)'},
    // Polite / formal present
    {re: /^[어아여]요$/,                       ending: '~어요',     label: '정중체 현재 (___s/___ing)'},
    {re: /^[ㅂ습]니다$/,                       ending: '~ㅂ니다',   label: '격식체 현재 (___s/___ing)'},
    {re: /^[ㅂ습]니까$/,                       ending: '~ㅂ니까',   label: '격식체 의문 (___?)'},
    // Plain present
    {re: /^ㄴ다$|^는다$/,                      ending: '~ㄴ다/~는다', label: '평서체 현재 (___s)'},
    // Attributive
    {re: /^[ㄴ은]$/,                           ending: '~ㄴ',       label: '관형형 과거 ([noun] that was ___ed)'},
    {re: /^는$/,                               ending: '~는',       label: '관형형 현재 ([noun] that ___s)'},
    {re: /^[ㄹ을]$/,                           ending: '~ㄹ',       label: '관형형 미래 ([noun] that will ___)'},
    // Connectives
    {re: /^고$/,                               ending: '~고',       label: '연결 (and / then)'},
    {re: /^[어아여]서$/,                       ending: '~어서',     label: '연결 (because / and then)'},
    {re: /^지만$/,                             ending: '~지만',     label: '연결 (but)'},
    {re: /^[으]?면$/,                          ending: '~(으)면',   label: '조건 (if)'},
    {re: /^[으]?니까$/,                        ending: '~(으)니까', label: '연결 (because)'},
    {re: /^[으]?려고$/,                        ending: '~(으)려고', label: '의도 (in order to)'},
    {re: /^도록$/,                             ending: '~도록',     label: '연결 (so that ___)'},
    // Nominal / adverbial
    {re: /^기$/,                               ending: '~기',       label: '명사형 (___ing as noun)'},
    {re: /^게$/,                               ending: '~게',       label: '부사형 (___ly / so that)'},
    // Honorific
    {re: /^시$|^으시$/,                        ending: '~(으)시',   label: '존댓말 어간 (honorific)'},
    {re: /^세요$|^으세요$/,                    ending: '~(으)세요', label: '존댓 정중체 (please ___)'},
    {re: /^셨어요$|^으셨어요$/,                ending: '~(으)셨어요', label: '존댓 과거 정중체 (___ed, honorific)'},
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
    return { trailer: trailer, ending: '~' + trailer, label: '활용형 (conjugated form)' };
  }

  async function loadHoverVocab() {
    try {
      var client = getSb();
      if (!client) return;
      var res = await client
        .from('hover_vocab_master')
        .select('word_ko, meaning_en, reading, note, is_active, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('word_ko', { ascending: true });

      vocabList = (res.data || []).filter(function(x){
        // Require a meaning AND at least 2 characters — 1-char entries are
        // usually particles/morphemes that would match inside compound words
        // and produce the "한글자씩" highlighting problem.
        return x.word_ko && x.meaning_en && x.word_ko.length >= 2;
      });
      vocabWords = vocabList.map(function(x){ return x.word_ko; }).sort(function(a,b){ return b.length - a.length; });
    } catch (e) {
      console.warn('hover vocab load failed', e);
      vocabList = [];
      vocabWords = [];
    }
  }

  function getVocab(word) {
    return vocabList.find(function(v){ return v.word_ko === word; }) || null;
  }

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
    if (parent.closest('button, [role="button"], a[onclick], a[href], label')) return true;
    return false;
  }

  function findFirstMatch(text) {
    for (var i = 0; i < vocabWords.length; i++) {
      var word = vocabWords[i];
      // 1) Exact match with word boundary
      var regex = new RegExp('(^|[^가-힣])(' + escapeRegExp(word) + ')(?![가-힣])');
      var m = text.match(regex);
      if (m) {
        var full = m[0];
        var matchedWord = m[2];
        var index = text.indexOf(full) + full.indexOf(matchedWord);
        return { word: word, matched: matchedWord, index: index };
      }
      // 2) Stem match for dictionary-form verbs / adjectives: allow the stem
      //    to match followed by up to 4 Korean chars (conjugation endings).
      //    e.g. vocab '첨벙거리다' → matches '첨벙거리는' / '첨벙거렸어요' in body.
      if (word.length >= 3 && /[다요]$/.test(word)) {
        var stem = word.slice(0, -1);
        if (stem.length >= 2) {
          var stemRe = new RegExp('(^|[^가-힣])(' + escapeRegExp(stem) + ')([가-힣]{1,4})');
          var m2 = text.match(stemRe);
          if (m2) {
            var trailer = m2[3];
            // Reject false positives where the "conjugation" is actually a
            // noun particle attached to a homograph noun — e.g. vocab
            // '사이다' (cider, a noun that happens to end in 다) should NOT
            // match '사이에서' (between + locative). Particle-initial
            // trailers like 에, 의, 을, 부터, 처럼 never appear at the
            // start of a verb / adjective ending, so we can safely skip.
            var isParticleTrailer = /^(에|의|을|를|이|가|도|만|과|와|로|부터|까지|보다|마저|조차|처럼|만큼|랑|하고|이라|라는|라고)/.test(trailer);
            if (!isParticleTrailer) {
              var full2 = m2[0];
              var mword2 = m2[2] + trailer;
              var idx2 = text.indexOf(full2) + full2.indexOf(mword2);
              return { word: word, matched: mword2, index: idx2 };
            }
          }
        }
      }
    }
    return null;
  }

  function wrapTextNode(node) {
    var text = node.nodeValue;
    if (!text || !text.trim()) return;
    var match = findFirstMatch(text);
    if (!match) return;

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

    if (after) frag.appendChild(document.createTextNode(after));

    node.parentNode.replaceChild(frag, node);

    if (after) {
      wrapAllIn(document.body);
    }
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
    var reading  = el.dataset.reading  || '';
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
      '<div class="ko">' + word + '</div>'
      + (reading ? '<div class="rom">' + reading + '</div>' : '')
      + '<div class="en">' + meaning + '</div>'
      + inflBlock
      + (note ? '<div class="note">' + note + '</div>' : '')
      + '<div class="tip-footer">'
      + '<button class="kh-tip-save' + (saved ? ' saved' : '') + '" '
      + 'data-word="' + word + '" data-reading="' + reading + '" data-meaning="' + meaning + '" '
      + 'onclick="window._khTipSave && window._khTipSave(this)">'
      + (saved ? '✓ Saved' : '+ Save')
      + '</button>'
      + '</div>';

    t.classList.add('show');
    moveTooltip(e);
  }

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
    // Mobile: tap a word to show its tooltip (mouse events don't fire on touch)
    e.stopPropagation();
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

  var _outsideTapInstalled = false;
  function _installOutsideTapCloser() {
    if (_outsideTapInstalled) return;
    _outsideTapInstalled = true;
    var handler = function(ev) {
      if (!tip) return;
      if (tip.contains(ev.target)) return;
      if (ev.target && ev.target.closest && ev.target.closest('.kh-hover-word')) return;
      hideTooltip();
      document.removeEventListener('click', handler, true);
      _outsideTapInstalled = false;
    };
    setTimeout(function(){ document.addEventListener('click', handler, true); }, 0);
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
      // Immediately wrap any newly-added element nodes so there's no
      // visible delay when articles / cards load asynchronously.
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) wrapAllIn(node);
        });
      });
      // Debounce a full re-scan as a safety net for text-only mutations.
      debounceApply();
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
    // Multiple delayed sweeps — modals that open after init's first
    // sweep (article-study, story detail, PM) sometimes mount their
    // text after the MutationObserver's debounce fires once and never
    // again, so we re-scan known target containers a few more times.
    setTimeout(applyHoverTooltips, 800);
    setTimeout(applyHoverTooltips, 1800);
    setTimeout(applyHoverTooltips, 3500);
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
    applyHoverTooltips();
  };
})();
