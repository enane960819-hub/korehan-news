(function(){
  var vocabList = [];
  var vocabWords = [];
  var initialized = false;
  var observer = null;

  // shared.js의 getSupa() 재사용 — 이중 클라이언트 방지
  function getSb() {
    if (typeof window.getSupa === 'function') return window.getSupa();
    // fallback: shared.js 아직 로드 안 됐을 때 (거의 발생 안함)
    return null;
  }

  function injectStyles() {
    if (document.getElementById('kh-hover-style')) return;
    var style = document.createElement('style');
    style.id = 'kh-hover-style';
    style.textContent = `
      .kh-hover-word{
        position:relative;
        border-bottom:1.5px dashed #7ab8f5;
        cursor:help;
        transition:background .15s,border-color .15s;
      }
      .kh-hover-word:hover{
        background:rgba(122,184,245,.12);
        border-bottom-color:#2255a4;
      }
      .kh-hover-tip{
        position:fixed;
        z-index:99999;
        min-width:180px;
        max-width:280px;
        pointer-events:none;
        background:#0f172a;
        color:#fff;
        border-radius:14px;
        padding:11px 12px 10px;
        box-shadow:0 18px 40px rgba(2,8,23,.32);
        opacity:0;
        transform:translateY(6px);
        transition:opacity .12s,transform .12s;
      }
      .kh-hover-tip.show{
        opacity:1;
        transform:translateY(0);
      }
      .kh-hover-tip .ko{
        font-size:15px;
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
      .kh-hover-tip .note{
        font-size:11px;
        line-height:1.55;
        color:#cbd5e1;
        margin-top:5px;
      }
    `;
    document.head.appendChild(style);
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

      vocabList = (res.data || []).filter(function(x){ return x.word_ko && x.meaning_en; });
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
    if (parent.closest('[data-hover-skip="1"]')) return true;
    return false;
  }

  function findFirstMatch(text) {
    for (var i = 0; i < vocabWords.length; i++) {
      var word = vocabWords[i];
      var regex = new RegExp('(^|[^가-힣])(' + escapeRegExp(word) + ')(?![가-힣])');
      var m = text.match(regex);
      if (m) {
        var full = m[0];
        var matchedWord = m[2];
        var index = text.indexOf(full) + full.indexOf(matchedWord);
        return { word: matchedWord, index: index };
      }
    }
    return null;
  }

  function wrapTextNode(node) {
    var text = node.nodeValue;
    if (!text || !text.trim()) return;
    var match = findFirstMatch(text);
    if (!match) return;

    var vocab = getVocab(match.word);
    if (!vocab) return;

    var before = text.slice(0, match.index);
    var target = text.slice(match.index, match.index + match.word.length);
    var after = text.slice(match.index + match.word.length);

    var frag = document.createDocumentFragment();
    if (before) frag.appendChild(document.createTextNode(before));

    var span = document.createElement('span');
    span.className = 'kh-hover-word';
    span.textContent = target;
    span.dataset.word = vocab.word_ko;
    span.dataset.meaning = vocab.meaning_en || '';
    span.dataset.reading = vocab.reading || '';
    span.dataset.note = vocab.note || '';
    span.addEventListener('mouseenter', showTooltip);
    span.addEventListener('mouseleave', hideTooltip);
    span.addEventListener('mousemove', moveTooltip);
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
    return [
      document.getElementById('dyn-article'),
      document.getElementById('sentences-list'),
      document.getElementById('dyn-article-list'),
      document.querySelector('.conv-page-container'),
      document.querySelector('.st-container'),
      document.querySelector('.sr-body'),
      document.querySelector('.learn-body'),
      document.querySelector('.container')
    ].filter(Boolean);
  }

  var tip = null;
  function ensureTooltip() {
    if (tip) return tip;
    tip = document.createElement('div');
    tip.className = 'kh-hover-tip';
    document.body.appendChild(tip);
    return tip;
  }

  function showTooltip(e) {
    var el = e.currentTarget;
    var t = ensureTooltip();
    t.innerHTML =
      '<div class="ko">' + (el.dataset.word || '') + '</div>'
      + (el.dataset.reading ? '<div class="rom">' + el.dataset.reading + '</div>' : '')
      + '<div class="en">' + (el.dataset.meaning || '') + '</div>'
      + (el.dataset.note ? '<div class="note">' + el.dataset.note + '</div>' : '');
    t.classList.add('show');
    moveTooltip(e);
  }

  function moveTooltip(e) {
    var t = ensureTooltip();
    var x = e.clientX + 14;
    var y = e.clientY + 16;
    var maxX = window.innerWidth - 300;
    var maxY = window.innerHeight - 140;
    t.style.left = Math.max(10, Math.min(x, maxX)) + 'px';
    t.style.top = Math.max(10, Math.min(y, maxY)) + 'px';
  }

  function hideTooltip() {
    var t = ensureTooltip();
    t.classList.remove('show');
  }

  function installObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(function(){
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
    setTimeout(applyHoverTooltips, 800);
    setTimeout(applyHoverTooltips, 1800);
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
})();
