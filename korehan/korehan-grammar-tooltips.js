// KoreHani — Grammar / Conjugation tooltip
//
// SEPARATE FROM korehan-hover-tooltips.js — that one shows VOCAB
// meanings (word → English). This one shows ENDING / CONJUGATION
// explanations: hovering "편이에요" or "좋아해요" surfaces what the
// suffix does (polite copula, polite present, etc.) and points at
// the dictionary form when relevant. The user explicitly called
// out that the existing vocab tooltip "is for word meanings, this
// is different."
//
// Visual contract:
//   • Vocab tooltip uses a DOTTED blue underline on whole words.
//   • Grammar tooltip uses a DASHED mint underline on the SUFFIX
//     portion of a token. Different colour + different style so
//     learners can tell which kind of help they're triggering.
//
// Scoping:
//   • Skip nodes inside `.kh-hover-word` so we never double-wrap
//     a vocab match.
//   • Skip <script>, <style>, <textarea>, <input>, <button>,
//     <select>, <option>, plus anything marked
//     [data-gram-skip="1"] for explicit opt-out.
//
// Detection:
//   • Walk text nodes in the relevant containers (study room,
//     news article, conversations, stories, modal bodies, …).
//   • For each Korean token, find the LONGEST suffix that matches
//     against the static ENDINGS table. Require the token to be
//     longer than the suffix so we don't wrap a bare ending that
//     accidentally appears as standalone text.
//   • Wrap just the suffix portion so the underline visually
//     points at the morpheme being explained.
//
// Re-applying:
//   • MutationObserver picks up dynamically-rendered modal content
//     (KE flow, Express Practice, dictation, etc.). Debounced so
//     we don't thrash on every micro-update.

(function(){
  if (window.__khGrammarTooltipsInit) return;
  window.__khGrammarTooltipsInit = true;

  // ── Endings dictionary ──────────────────────────────────────
  // Curated to cover the conjugations + sentence-final endings
  // learners ask about most: copula forms, polite/formal verb
  // endings, past tense, common auxiliaries, and connective
  // endings. Particles are intentionally excluded — they'd wrap
  // every noun and overwhelm the page.
  //
  // Each entry:
  //   suffix      – literal trailing string to match in a token
  //                 (sorted longest-first at init).
  //   minStem     – minimum number of syllables that must precede
  //                 the suffix in the same token (default 1). Stops
  //                 false-matches like "해요" appearing alone.
  //   label       – pretty form to show ("-이에요/예요").
  //   role        – one-line grammatical role in English.
  //   explanation – 1-2 sentence learner-friendly note.
  //   dict        – optional dictionary form for cross-reference
  //                 ("Dictionary form: -이다").
  var ENDINGS = [
    // ── Copula endings ────────────────────────────────────────
    { suffix:'이에요', minStem:1,
      label:'-이에요', role:'Polite copula (after consonant)',
      explanation:'Informal-polite "is/am/are." Attaches to a noun ending in a consonant. 편 + 이에요 → 편이에요.',
      dict:'Dictionary form: -이다' },
    { suffix:'예요', minStem:1,
      label:'-예요', role:'Polite copula (after vowel)',
      explanation:'Informal-polite "is/am/are." Attaches to a noun ending in a vowel. 친구 + 예요 → 친구예요.',
      dict:'Dictionary form: -이다' },
    { suffix:'이다', minStem:1,
      label:'-이다', role:'Dictionary copula',
      explanation:'Dictionary form of "is/am/are." Used in writing or as a base form. The polite spoken form is -이에요/예요.' },
    { suffix:'아니에요', minStem:0,
      label:'아니에요', role:'Polite negation copula',
      explanation:'"Is/am/are not" — polite negative copula. The dictionary form is 아니다.' },

    // ── Polite informal verb/adjective endings ────────────────
    { suffix:'했어요', minStem:1,
      label:'-했어요', role:'Polite past · 하다 verbs',
      explanation:'Polite past tense for 하다 verbs. 공부하 + 였어요 → 공부했어요.',
      dict:'Dictionary form: -하다' },
    { suffix:'했습니다', minStem:1,
      label:'-했습니다', role:'Formal polite past · 하다 verbs',
      explanation:'Formal polite past for 하다 verbs. News / business register.' },
    { suffix:'았어요', minStem:1,
      label:'-았어요', role:'Polite past · stem ㅏ/ㅗ',
      explanation:'Polite past tense — verb / adjective stem ends in ㅏ or ㅗ. 가 + 았어요 → 갔어요.' },
    { suffix:'었어요', minStem:1,
      label:'-었어요', role:'Polite past · other vowels',
      explanation:'Polite past tense — stem ends in any other vowel. 먹 + 었어요 → 먹었어요.' },
    { suffix:'였어요', minStem:1,
      label:'-였어요', role:'Polite past · 하다 verbs (full form)',
      explanation:'Full polite past for 하다 verbs before contraction. 공부 + 하 + 였어요 = 공부했어요.' },
    { suffix:'해요', minStem:1,
      label:'-해요', role:'Polite present · 하다 verbs',
      explanation:'Polite-informal present for 하다 verbs. Stem 하 + 어요 contracts to 해요. 좋아하 + 어요 → 좋아해요.',
      dict:'Dictionary form: -하다' },
    { suffix:'합니다', minStem:1,
      label:'-합니다', role:'Formal polite present · 하다 verbs',
      explanation:'Formal polite present for 하다 verbs. Used in news, presentations, formal conversation.' },
    { suffix:'아요', minStem:1,
      label:'-아요', role:'Polite present · stem ㅏ/ㅗ',
      explanation:'Polite-informal present — verb stem ends in ㅏ or ㅗ. 가 + 아요 → 가요.' },
    { suffix:'어요', minStem:1,
      label:'-어요', role:'Polite present · other vowels',
      explanation:'Polite-informal present — verb stem ends in any other vowel. 먹 + 어요 → 먹어요. Also surfaces as the polite ending of fused past tense (갔어요 = 가 + 았어요).' },
    { suffix:'여요', minStem:1,
      label:'-여요', role:'Polite present · 하다 (uncontracted)',
      explanation:'Polite-informal present for 하다 verbs in their non-contracted form. Most spoken Korean uses the contracted -해요.' },

    // ── Formal polite ────────────────────────────────────────
    { suffix:'ㅂ니다', minStem:1,
      label:'-ㅂ니다', role:'Formal polite · vowel stem',
      explanation:'Formal polite present — verb stem ends in a vowel. 가 + ㅂ니다 → 갑니다. News / business register.' },
    { suffix:'습니다', minStem:1,
      label:'-습니다', role:'Formal polite · consonant stem',
      explanation:'Formal polite present — verb stem ends in a consonant. 먹 + 습니다 → 먹습니다.' },

    // ── Honorific ────────────────────────────────────────────
    { suffix:'으세요', minStem:1,
      label:'-(으)세요', role:'Honorific polite (consonant)',
      explanation:'Polite request / statement honoring the subject. Stem ends in a consonant. 앉 + 으세요 → 앉으세요.' },
    { suffix:'세요', minStem:1,
      label:'-(으)세요', role:'Honorific polite (vowel)',
      explanation:'Polite request / statement honoring the subject. 가 + 세요 → 가세요.' },
    { suffix:'셨어요', minStem:1,
      label:'-(으)셨어요', role:'Honorific polite past',
      explanation:'Polite past honoring the subject. 가 + 셨어요 → 가셨어요.' },

    // ── Want / try / progressive auxiliaries ─────────────────
    { suffix:'고 싶어요', minStem:1,
      label:'-고 싶어요', role:'Want to (polite)',
      explanation:'"Want to do." Attaches to a verb stem. 가 + 고 싶어요 → 가고 싶어요.',
      dict:'Dictionary form: -고 싶다' },
    { suffix:'고 싶다', minStem:1,
      label:'-고 싶다', role:'Want to (dictionary)',
      explanation:'Dictionary form of "want to." Polite spoken: -고 싶어요.' },
    { suffix:'고 있어요', minStem:1,
      label:'-고 있어요', role:'Polite progressive ("am/is doing")',
      explanation:'Continuous / progressive aspect. 먹 + 고 있어요 → 먹고 있어요 ("am eating").' },
    { suffix:'고 있다', minStem:1,
      label:'-고 있다', role:'Dictionary progressive',
      explanation:'Dictionary form of the progressive. Polite spoken: -고 있어요.' },
    { suffix:'아 보다', minStem:1,
      label:'-아/어 보다', role:'Try doing',
      explanation:'"Try doing" something to see how it is. 먹 + 어 보다 → 먹어 보다.' },
    { suffix:'어 보다', minStem:1,
      label:'-아/어 보다', role:'Try doing',
      explanation:'"Try doing" something to see how it is. 가 + 아 보다 → 가 보다.' },

    // ── "Tend to / rather" — covers the user\'s 편이다 example ─
    { suffix:'는 편이에요', minStem:1,
      label:'-는 편이에요', role:'Polite "tend to / rather" (verb)',
      explanation:'Polite-spoken "tend to / rather." Attaches to a verb stem in present-modifying form. 좋아하 + 는 편이에요 → 좋아하는 편이에요.',
      dict:'Dictionary form: -는 편이다' },
    { suffix:'는 편이다', minStem:1,
      label:'-는 편이다', role:'"Tend to / rather" (verb, dictionary)',
      explanation:'Dictionary form of "tend to / rather." Polite spoken form: -는 편이에요.' },
    { suffix:'ㄴ 편이에요', minStem:1,
      label:'-(으)ㄴ 편이에요', role:'Polite "rather / kind of" (adjective)',
      explanation:'Polite-spoken "rather / kind of" with adjectives. 작 + 은 편이에요 → 작은 편이에요.',
      dict:'Dictionary form: -(으)ㄴ 편이다' },
    { suffix:'ㄴ 편이다', minStem:1,
      label:'-(으)ㄴ 편이다', role:'"Rather / kind of" (adjective, dict)',
      explanation:'Dictionary form. Polite spoken: -(으)ㄴ 편이에요.' },

    // ── Future / intention / promise ─────────────────────────
    { suffix:'ㄹ 거예요', minStem:1,
      label:'-(으)ㄹ 거예요', role:'Polite future / probability',
      explanation:'"Will (probably)" or future intention. 가 + ㄹ 거예요 → 갈 거예요.' },
    { suffix:'을 거예요', minStem:1,
      label:'-(으)ㄹ 거예요', role:'Polite future / probability (after consonant)',
      explanation:'"Will (probably)" — stem ends in a consonant. 먹 + 을 거예요 → 먹을 거예요.' },
    { suffix:'ㄹ게요', minStem:1,
      label:'-(으)ㄹ게요', role:'Speaker promise / intent',
      explanation:'A speaker-side promise: "I\'ll do …" 가 + ㄹ게요 → 갈게요.' },
    { suffix:'을게요', minStem:1,
      label:'-(으)ㄹ게요', role:'Speaker promise / intent (consonant)',
      explanation:'A speaker-side promise. 먹 + 을게요 → 먹을게요.' },
    { suffix:'ㄹ까요', minStem:1,
      label:'-(으)ㄹ까요', role:'Suggestion / wondering',
      explanation:'"Shall we …?" or "I wonder …" 가 + ㄹ까요 → 갈까요?' },
    { suffix:'을까요', minStem:1,
      label:'-(으)ㄹ까요', role:'Suggestion / wondering (consonant)',
      explanation:'"Shall we …?" — stem ends in a consonant. 먹 + 을까요 → 먹을까요?' },

    // ── Connective endings ───────────────────────────────────
    { suffix:'아서', minStem:1,
      label:'-아서', role:'Reason / sequence (ㅏ/ㅗ stem)',
      explanation:'"Because" or "and then" — stem ends in ㅏ or ㅗ. 가 + 아서 → 가서.' },
    { suffix:'어서', minStem:1,
      label:'-어서', role:'Reason / sequence (other stem)',
      explanation:'"Because" or "and then" — stem ends in any other vowel. 먹 + 어서 → 먹어서.' },
    { suffix:'으니까', minStem:1,
      label:'-(으)니까', role:'Causal "because"',
      explanation:'"Because" — speaker-justification. 먹 + 으니까 → 먹으니까.' },
    { suffix:'니까', minStem:1,
      label:'-(으)니까', role:'Causal "because" (vowel)',
      explanation:'"Because" — speaker-justification. 가 + 니까 → 가니까.' },
    { suffix:'으면', minStem:1,
      label:'-(으)면', role:'If / when',
      explanation:'Conditional "if / when." Stem ends in a consonant. 먹 + 으면 → 먹으면.' },
    { suffix:'지만', minStem:1,
      label:'-지만', role:'But / although',
      explanation:'"But" or "although." Connects two clauses. 좋아하 + 지만 → 좋아하지만.' },
    { suffix:'으면서', minStem:1,
      label:'-(으)면서', role:'While (simultaneous)',
      explanation:'"While" — two actions happening together. 먹 + 으면서 → 먹으면서.' },

    // ── Tag-like sentence enders ─────────────────────────────
    { suffix:'네요', minStem:1,
      label:'-네요', role:'Polite mild surprise / acknowledgment',
      explanation:'Marks something the speaker has just noticed. 좋 + 네요 → 좋네요.' },
    { suffix:'군요', minStem:1,
      label:'-군요', role:'Polite realization',
      explanation:'"Oh, I see" — speaker is realizing something now. Slightly more bookish than -네요.' },
    { suffix:'잖아요', minStem:1,
      label:'-잖아요', role:'"As you know …"',
      explanation:'Used to remind the listener of something they already know. 그렇 + 잖아요 → 그렇잖아요.' },
    { suffix:'거든요', minStem:1,
      label:'-거든요', role:'Soft justification',
      explanation:'Soft "you see, …" — providing background or justification.' },
    { suffix:'는데요', minStem:1,
      label:'-는데요', role:'Soft "but / and"',
      explanation:'Sets up contrast or follow-up. Often softens the prior clause.' },
  ];

  ENDINGS.sort(function(a, b){ return b.suffix.length - a.suffix.length; });

  function injectStyles() {
    if (document.getElementById('kh-gram-style')) return;
    var s = document.createElement('style');
    s.id = 'kh-gram-style';
    s.textContent =
      '.kh-gram-token{cursor:help;text-decoration:underline;text-decoration-style:dashed;text-decoration-color:rgba(20,203,176,.7);text-decoration-thickness:1.5px;text-underline-offset:5px;transition:background .15s,text-decoration-color .15s}'
      + '.kh-gram-token:hover{background:rgba(20,203,176,.14);text-decoration-color:#14cbb0}'
      + '.kh-gram-tip{position:fixed;z-index:99998;min-width:240px;max-width:340px;background:#062019;color:#e2fff8;border-radius:14px;padding:13px 14px 12px;box-shadow:0 18px 40px rgba(0,20,15,.55);opacity:0;transform:translateY(6px);transition:opacity .12s,transform .12s;pointer-events:auto;border:1px solid rgba(20,203,176,.32)}'
      + '.kh-gram-tip.show{opacity:1;transform:translateY(0)}'
      + '.kh-gram-tip .gt-eyebrow{font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#14cbb0;margin-bottom:4px}'
      + '.kh-gram-tip .gt-suffix{font-size:18px;font-weight:900;color:#fff;font-family:"Noto Serif KR",serif;line-height:1.2;margin-bottom:2px}'
      + '.kh-gram-tip .gt-role{font-size:11px;color:#7dd3fc;margin-bottom:8px;font-weight:600}'
      + '.kh-gram-tip .gt-explain{font-size:12px;line-height:1.55;color:#cbd5e1}'
      + '.kh-gram-tip .gt-dict{margin-top:8px;padding-top:8px;border-top:1px solid rgba(20,203,176,.18);font-size:11px;color:#9ca3af}'
      + '.kh-gram-tip .gt-dict strong{color:#fff;font-family:"Noto Serif KR",serif;font-weight:800}';
    document.head.appendChild(s);
  }

  function isKoreanChar(ch) {
    if (!ch) return false;
    var c = ch.charCodeAt(0);
    return (c >= 0xAC00 && c <= 0xD7A3) || (c >= 0x3131 && c <= 0x318E);
  }

  // Find where a "token" (a Korean word, possibly with a trailing
  // particle) starts and ends in the text. We treat a token as a
  // run of Korean chars optionally containing a single space (so
  // multi-eojeol endings like "고 싶어요" can match across one
  // space). Boundaries are non-Korean / start / end.
  function findTokens(text) {
    var tokens = [];
    var i = 0, n = text.length;
    while (i < n) {
      // Skip non-Korean chars.
      while (i < n && !isKoreanChar(text[i])) i++;
      if (i >= n) break;
      var start = i;
      // Eat Korean chars; allow a single internal space if the
      // following char is also Korean (covers "고 싶어요").
      while (i < n) {
        if (isKoreanChar(text[i])) { i++; continue; }
        if (text[i] === ' ' && i + 1 < n && isKoreanChar(text[i+1])) { i++; continue; }
        break;
      }
      var end = i;
      if (end > start) tokens.push({ start: start, end: end, text: text.slice(start, end) });
    }
    return tokens;
  }

  function matchEnding(token) {
    for (var i = 0; i < ENDINGS.length; i++) {
      var e = ENDINGS[i];
      if (token.length <= e.suffix.length) continue;        // need at least 1 stem char
      var tail = token.slice(token.length - e.suffix.length);
      if (tail !== e.suffix) continue;
      // Count Korean syllables before the suffix (ignore spaces).
      var before = token.slice(0, token.length - e.suffix.length);
      var stemLen = 0;
      for (var k = 0; k < before.length; k++) {
        if (isKoreanChar(before[k])) stemLen++;
      }
      if (stemLen >= (e.minStem || 1)) return e;
    }
    return null;
  }

  function shouldSkipNode(node) {
    if (!node || !node.parentNode) return true;
    var p = node.parentNode;
    if (!p.tagName) return true;
    var tag = p.tagName.toLowerCase();
    if (['script','style','textarea','input','button','select','option','code','pre'].indexOf(tag) !== -1) return true;
    // Don't double-wrap inside an already-marked vocab token or
    // grammar token, and respect explicit opt-outs.
    if (p.closest('.kh-hover-word')) return true;
    if (p.closest('.kh-gram-token')) return true;
    if (p.closest('[data-gram-skip="1"]')) return true;
    return false;
  }

  function wrapTextNode(node) {
    var text = node.nodeValue;
    if (!text || !text.trim()) return false;
    var tokens = findTokens(text);
    if (!tokens.length) return false;
    // Walk tokens left-to-right, find FIRST one with a matching
    // ending, wrap just the suffix portion. Returning after the
    // first wrap and re-walking the parent picks up subsequent
    // matches without breaking the DOM walker mid-iteration.
    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i];
      var ending = matchEnding(tok.text);
      if (!ending) continue;
      var suffixStart = tok.end - ending.suffix.length;
      var before = text.slice(0, suffixStart);
      var middle = text.slice(suffixStart, tok.end);
      var after  = text.slice(tok.end);
      var frag = document.createDocumentFragment();
      if (before) frag.appendChild(document.createTextNode(before));
      var span = document.createElement('span');
      span.className = 'kh-gram-token';
      span.textContent = middle;
      span.dataset.suffix      = ending.label;
      span.dataset.role        = ending.role || '';
      span.dataset.explanation = ending.explanation || '';
      span.dataset.dict        = ending.dict || '';
      span.addEventListener('mouseenter', onTokenEnter);
      span.addEventListener('mouseleave', onTokenLeave);
      span.addEventListener('mousemove',  moveTooltip);
      span.addEventListener('click',      onTokenTap);
      frag.appendChild(span);
      if (after) frag.appendChild(document.createTextNode(after));
      var parent = node.parentNode;
      parent.replaceChild(frag, node);
      // Recurse so additional endings later in the same text node
      // also get wrapped.
      walk(parent);
      return true;
    }
    return false;
  }

  function walk(root) {
    if (!root) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function(n){ if (!shouldSkipNode(n)) wrapTextNode(n); });
  }

  // Same scope footprint as the vocab tooltip, plus the
  // study-room modal bodies and the picker grids so dynamic
  // KE / Phrase Munch / Express Practice content gets covered.
  function getTargets() {
    var byId = ['dyn-article', 'sentences-list', 'dyn-article-list', 'st-panel',
                'pm-body', 'dct-body', 'gf-tab-learn', 'gf-tab-spotit', 'gf-tab-fill', 'gf-tab-translate', 'gf-tab-build',
                'ke-expressions-list', 'ke-quiz-body', 'wm-helpers', 'wm-grammar', 'wm-context'];
    var bySelector = ['.conv-page-container', '.st-container', '.sr-body', '.learn-body',
                      '.bm-body', '.pm-body', '.dct-body', '.wm-center', '.gf-modal-body',
                      '[data-gram-scan="1"]'];
    var list = byId.map(function(id){ return document.getElementById(id); });
    bySelector.forEach(function(sel){
      document.querySelectorAll(sel).forEach(function(el){ list.push(el); });
    });
    return list.filter(Boolean);
  }

  // ── Tooltip ────────────────────────────────────────────────
  var tip = null;
  var hideTimer = null;
  var overTip = false;

  function ensureTip() {
    if (tip) return tip;
    tip = document.createElement('div');
    tip.className = 'kh-gram-tip';
    tip.addEventListener('mouseenter', function(){ overTip = true; clearTimeout(hideTimer); });
    tip.addEventListener('mouseleave', function(){ overTip = false; scheduleHide(); });
    document.body.appendChild(tip);
    return tip;
  }
  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function(){
      if (!overTip) {
        var t = ensureTip();
        t.classList.remove('show');
      }
    }, 200);
  }
  function showTooltip(e) {
    var span = e.currentTarget;
    var t = ensureTip();
    var html = '<div class="gt-eyebrow">Grammar</div>'
      + '<div class="gt-suffix">' + (span.dataset.suffix || '') + '</div>'
      + (span.dataset.role ? '<div class="gt-role">' + span.dataset.role + '</div>' : '')
      + (span.dataset.explanation ? '<div class="gt-explain">' + escapeHTML(span.dataset.explanation) + '</div>' : '')
      + (span.dataset.dict ? '<div class="gt-dict">' + escapeHTML(span.dataset.dict) + '</div>' : '');
    t.innerHTML = html;
    t.classList.add('show');
    moveTooltip(e);
  }
  function moveTooltip(e) {
    var t = ensureTip();
    var x = (e.clientX || 0) + 14;
    var y = (e.clientY || 0) + 16;
    var maxX = window.innerWidth  - 350;
    var maxY = window.innerHeight - 180;
    t.style.left = Math.max(10, Math.min(x, maxX)) + 'px';
    t.style.top  = Math.max(10, Math.min(y, maxY)) + 'px';
  }
  function hideTooltip() {
    var t = ensureTip();
    t.classList.remove('show');
  }
  function onTokenEnter(e) { clearTimeout(hideTimer); showTooltip(e); }
  function onTokenLeave()   { scheduleHide(); }
  var outsideTapInstalled = false;
  function installOutsideTapCloser() {
    if (outsideTapInstalled) return;
    outsideTapInstalled = true;
    var handler = function(ev) {
      if (!tip) return;
      if (tip.contains(ev.target)) return;
      if (ev.target && ev.target.closest && ev.target.closest('.kh-gram-token')) return;
      hideTooltip();
      document.removeEventListener('click', handler, true);
      outsideTapInstalled = false;
    };
    setTimeout(function(){ document.addEventListener('click', handler, true); }, 0);
  }
  function onTokenTap(e) {
    e.stopPropagation();
    showTooltip(e);
    installOutsideTapCloser();
  }

  function escapeHTML(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Boot + observe ─────────────────────────────────────────
  var applyTimer = null;
  function debounceApply() {
    clearTimeout(applyTimer);
    applyTimer = setTimeout(applyAll, 250);
  }
  function applyAll() {
    getTargets().forEach(function(root){ walk(root); });
  }
  function installObserver() {
    var observer = new MutationObserver(function(){ debounceApply(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  function init() {
    injectStyles();
    applyAll();
    installObserver();
    // Catch-up scans for content that arrives a bit late.
    setTimeout(applyAll, 800);
    setTimeout(applyAll, 1800);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public refresh hook so pages that finish a heavy render can
  // explicitly trigger another scan if they want.
  window.korehanGrammarRefresh = applyAll;
})();
