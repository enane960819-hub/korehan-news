/* ============================================================
   KoreHani — Highlighted Expressions + admin CRUD
   Extracted from korehan-shared.js (was lines 4144-4308).

   Per-article phrase highlighting in the reader. Stored in
   article_cache (cache_key='expressions') so the highlights
   survive across refreshes; the inline admin panel lets editors
   add / remove / save phrases without leaving the article page.

   External deps (resolved at runtime via global scope):
   - getSupa(), supaUser    — from korehan-shared.js
   - escapeHTML, escapeAttr — from js/core/security.js
   - khConfirm, khAlert     — from js/core/modals.js
   - getFromCache, upsertArticleCacheRow, safeParseJSON
                            — from js/core/article-cache.js
   - toast, _khEsc          — from korehan-shared.js / articles.js
   ============================================================ */

// ── Highlighted Expressions ───────────────────────────────────
// Expressions are stored in article_cache.expressions as:
// [{"phrase":"표현","color":"blue","note":"optional note"}]
// Colors: "blue" (default), "green", "amber", "rose"
var _EXPR_COLORS = {
  blue:  { bg:'rgba(37,99,235,.25)',  border:'#93c5fd', text:'inherit' },
  green: { bg:'rgba(22,163,74,.25)',  border:'#86efac', text:'inherit' },
  amber: { bg:'rgba(217,119,6,.25)',  border:'#fcd34d', text:'inherit' },
  rose:  { bg:'rgba(225,29,72,.25)',  border:'#fda4af', text:'inherit' },
};

async function applyHighlightedExpressions(articleId) {
  if (!articleId) return;
  try {
    var exprs = await getFromCache('article', articleId, 'expressions');
    if (!exprs || !exprs.length) return;
    var articleEl = document.getElementById('art-tab-article');
    if (!articleEl) return;
    exprs.forEach(function(ex) {
      if (!ex.phrase) return;
      var c = _EXPR_COLORS[ex.color] || _EXPR_COLORS.blue;
      var safePhrase = ex.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var note = ex.note ? ' title="' + ex.note.replace(/"/g,'&quot;') + '"' : '';
      var html = '<mark class="kh-expr"'
        + ' style="background:' + c.bg + ';border-bottom:2px solid ' + c.border + ';color:' + c.text + '"'
        + note + '>' + ex.phrase + '</mark>';
      // Walk text nodes and replace
      var walker = document.createTreeWalker(articleEl, NodeFilter.SHOW_TEXT, null);
      var nodes = [];
      while(walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(function(n) {
        if (n.nodeValue && n.nodeValue.indexOf(ex.phrase) !== -1) {
          var parent = n.parentNode;
          if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') return;
          if (parent.closest('.kh-expr')) return;
          var parts = n.nodeValue.split(ex.phrase);
          if (parts.length < 2) return;
          var frag = document.createDocumentFragment();
          parts.forEach(function(part, i) {
            if (part) frag.appendChild(document.createTextNode(part));
            if (i < parts.length - 1) {
              var span = document.createElement('mark');
              span.className = 'kh-expr';
              span.style.cssText = 'background:' + c.bg + ';border-bottom:2px solid ' + c.border + ';color:' + c.text + ';border-radius:3px;padding:0 1px';
              if (ex.note) span.title = ex.note;
              span.textContent = ex.phrase;
              frag.appendChild(span);
            }
          });
          parent.replaceChild(frag, n);
        }
      });
    });
  } catch(e) {}
}

// ── 어드민 중요표현 CRUD ──────────────────────────────────────
var _phrasesAdminData = [];
var _phrasesAdminArtId = null;

async function _renderPhrasesAdmin(articleId) {
  var el = document.getElementById('art-phrases-admin');
  if (!el) return;
  _phrasesAdminArtId = articleId;
  el.style.display = 'block';
  el.innerHTML = '<div style="color:#94a3b8;font-size:12px;padding:8px">Loading...</div>';

  try {
    var exprs = await getFromCache('article', articleId, 'expressions');
    _phrasesAdminData = exprs && Array.isArray(exprs) ? exprs : [];
  } catch(e) { _phrasesAdminData = []; }
  _phrasesAdminRender(el);
}

// Collapsed by default so the admin panel doesn't blow out the bottom of
// every article during reading (it eats half a screen otherwise). Reset
// per session.
var _phrasesAdminExpanded = false;
function _phraseAdminToggle() {
  _phrasesAdminExpanded = !_phrasesAdminExpanded;
  _phrasesAdminRender();
}
function _phrasesAdminRender(el) {
  if (!el) el = document.getElementById('art-phrases-admin');
  if (!el) return;
  var rows = _phrasesAdminData.map(function(p, i) {
    var colorOpts = ['blue','green','amber','rose'].map(function(c){
      return '<option value="'+c+'"'+(p.color===c?' selected':'')+'>'+c+'</option>';
    }).join('');
    return '<div style="display:grid;grid-template-columns:1fr 1fr 80px 32px;gap:6px;align-items:center;margin-bottom:4px" data-pi="'+i+'">'
      + '<input class="pa-phrase" value="'+(p.phrase||'').replace(/"/g,'&quot;')+'" placeholder="표현" style="padding:5px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;font-family:\'Noto Sans KR\',sans-serif">'
      + '<input class="pa-note" value="'+(p.note||'').replace(/"/g,'&quot;')+'" placeholder="설명 (영어)" style="padding:5px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px">'
      + '<select class="pa-color" style="padding:5px;border:1px solid #e2e8f0;border-radius:6px;font-size:11px">'+colorOpts+'</select>'
      + '<button onclick="_phraseAdminDel('+i+')" style="background:#fee2e2;color:#991b1b;border:none;border-radius:6px;padding:4px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center"><span style="display:inline-flex;width:12px;height:12px">'+KH_ICON_X+'</span></button>'
      + '</div>';
  }).join('');

  var headerRow = '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px">'
    + '<button onclick="_phraseAdminToggle()" style="display:flex;align-items:center;gap:6px;background:none;border:none;color:#92400e;font-size:13px;font-weight:800;cursor:pointer;padding:0;font-family:inherit">'
    +   '<span style="display:inline-block;transform:rotate(' + (_phrasesAdminExpanded ? '90deg' : '0deg') + ');transition:transform .15s">▶</span>'
    +   '<span style="display:inline-flex;align-items:center;gap:6px"><span style="display:inline-flex;width:14px;height:14px">'+KH_ICON_PENCIL+'</span><span>중요표현 관리 (Admin)</span></span>'
    +   '<span style="font-size:11px;font-weight:600;color:#a16207;margin-left:4px">' + _phrasesAdminData.length + '개</span>'
    + '</button>'
    + (_phrasesAdminExpanded
        ? '<div style="display:flex;gap:6px">'
          + '<button onclick="_phraseAdminAdd()" style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer">+ 추가</button>'
          + '<button onclick="_phraseAdminSave()" style="background:#16a34a;color:#fff;border:none;border-radius:6px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer">저장</button>'
          + '</div>'
        : '')
    + '</div>';

  el.innerHTML = '<div style="margin-top:20px;padding:' + (_phrasesAdminExpanded ? '14px 16px 16px' : '10px 14px') + ';background:#fefce8;border:1px solid #fde68a;border-radius:12px">'
    + headerRow
    + (_phrasesAdminExpanded
        ? '<div style="margin-top:10px">'
          + (rows || '<div style="font-size:12px;color:#a16207;padding:4px">표현이 없습니다. + 추가를 눌러주세요.</div>')
          + '</div>'
        : '')
    + '</div>';
}

function _phraseAdminAdd() {
  _phrasesAdminData.push({ phrase:'', note:'', color:'amber' });
  _phrasesAdminRender();
}

function _phraseAdminDel(i) {
  _phrasesAdminData.splice(i, 1);
  _phrasesAdminRender();
}

function _phraseAdminReadFromDOM() {
  var el = document.getElementById('art-phrases-admin');
  if (!el) return;
  var rows = el.querySelectorAll('[data-pi]');
  rows.forEach(function(row, i) {
    if (!_phrasesAdminData[i]) return;
    var phr = row.querySelector('.pa-phrase');
    var note = row.querySelector('.pa-note');
    var color = row.querySelector('.pa-color');
    if (phr) _phrasesAdminData[i].phrase = phr.value.trim();
    if (note) _phrasesAdminData[i].note = note.value.trim();
    if (color) _phrasesAdminData[i].color = color.value;
  });
}

async function _phraseAdminSave() {
  _phraseAdminReadFromDOM();
  var valid = _phrasesAdminData.filter(function(p){ return p.phrase; });
  _phrasesAdminData = valid;
  try {
    await upsertArticleCacheRow(_phrasesAdminArtId, { expressions: valid });
    toast('중요표현 저장 완료');
    // 하이라이트 재적용
    var articleEl = document.getElementById('art-tab-article');
    if (articleEl) {
      articleEl.querySelectorAll('.kh-expr').forEach(function(m){ m.outerHTML = m.textContent; });
      applyHighlightedExpressions(_phrasesAdminArtId);
    }
    _phrasesAdminRender();
  } catch(e) {
    toast('저장 실패: ' + e.message);
  }
}

