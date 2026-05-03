/* ============================================================
   KoreHani — Analyze Mode (article reader)
   Extracted from korehan-shared.js (was lines 4309-4426).

   Toggle in the article reader that re-renders the body with
   inline highlights for the AI-extracted vocab / grammar /
   phrases. Caches the original HTML so the toggle is reversible.

   External deps (resolved at runtime via global scope):
   - getFromCache, upsertArticleCacheRow
                            — from js/core/article-cache.js
   - callClaude             — from korehan-shared.js
   - escapeHTML             — from js/core/security.js
   ============================================================ */

// ── Analyze Mode ──────────────────────────────────────────────
var _analyzeOn = false;
var _analyzeData = null; // { vocab, grammar, phrases }
var _analyzeOrigHTML = '';

async function toggleAnalyze() {
  var btn = document.getElementById('analyze-btn');
  var articleEl = document.getElementById('art-tab-article');
  if (!articleEl) return;

  if (_analyzeOn) {
    // OFF — 원래 텍스트로 복원, 단어 hover는 유지
    _analyzeOn = false;
    if (btn) btn.classList.remove('on');
    articleEl.querySelectorAll('.kh-analyze-mark').forEach(function(m) {
      m.outerHTML = m.textContent;
    });
    // 단어 hover 재적용
    articleEl.querySelectorAll('.vocab-zone').forEach(function(el){ wrapVocab(el); });
    return;
  }

  // ON
  _analyzeOn = true;
  if (btn) btn.classList.add('on');

  var a = window._currentArticle;
  if (!a) return;

  // 캐시에서 데이터 로드
  if (!_analyzeData) {
    try {
      var cached = await getFromCache('article', a.id);
      _analyzeData = {
        vocab: (cached && cached.vocab) || [],
        grammar: [],
        phrases: []
      };
      // grammar_guide 캐시에서 문법 패턴 추출
      var gramCache = await getFromCache('article', a.id, 'grammar_guide');
      if (gramCache && typeof gramCache === 'string') {
        var gMatch = gramCache.match(/\*\*([^*]+)\*\*/g);
        if (gMatch) _analyzeData.grammar = gMatch.map(function(m){ return m.replace(/\*\*/g,'').trim(); }).filter(function(g){ return g.length > 1 && g.length < 20; });
      }
      // expressions 캐시
      var exprCache = await getFromCache('article', a.id, 'expressions');
      if (exprCache && exprCache.length) {
        _analyzeData.phrases = exprCache.map(function(e){ return { text: e.phrase, note: e.note||'' }; });
      }
    } catch(e) { _analyzeData = { vocab:[], grammar:[], phrases:[] }; }
  }

  // 데이터 부족하면 Claude로 생성
  if (!_analyzeData.vocab.length && !_analyzeData.grammar.length && !_analyzeData.phrases.length) {
    if (btn) btn.textContent = '...';
    try {
      var bodyText = (a.body||'').replace(/<[^>]*>/g,'').slice(0,1600);
      var res = await callClaude({
        feature:'article-analyze', model:'claude-haiku-4-5-20251001', max_tokens:800,
        messages:[{role:'user',content:'Analyze this Korean article for language learners. Return ONLY JSON:\n{"vocab":["word1","word2"],"grammar":["어미1","어미2"],"phrases":["phrase1","phrase2"]}\n\nRules:\n- vocab: 8 key Korean WORDS (single words only, e.g. 경제, 발표, 증가)\n- grammar: 5 grammar ENDINGS as they appear in the article text (e.g. 했다, 된다, 하고 있다, 할 수 있다, 때문에). Must be short (2-6 chars), must appear verbatim in the text.\n- phrases: 5 important multi-word expressions (2-5 words, e.g. 문제가 되다, 영향을 미치다)\n\nArticle:\n'+bodyText}]
      });
      var raw = ((res.content)||[]).map(function(c){return c.text||'';}).join('');
      var cl = raw.replace(/```json|```/g,'').trim();
      var s=cl.indexOf('{'),e2=cl.lastIndexOf('}'); if(s>=0&&e2>s) cl=cl.slice(s,e2+1);
      var parsed = JSON.parse(cl);
      _analyzeData.vocab = (parsed.vocab||[]).map(function(w){ return typeof w==='string'?w:w.ko||''; }).filter(Boolean);
      _analyzeData.grammar = (parsed.grammar||[]).filter(Boolean);
      _analyzeData.phrases = (parsed.phrases||[]).map(function(p){ return typeof p==='string'?{text:p,note:''}:{text:p.ko||p,note:p.en||''}; });
    } catch(e) { console.warn('Analyze generation failed:', e); }
    if (btn) btn.innerHTML = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
  }

  // 하이라이트 적용
  _applyAnalyzeHighlights(articleEl);
}

function _applyAnalyzeHighlights(articleEl) {
  if (!_analyzeData) return;
  var bodyText = articleEl.innerHTML;

  // 우선순위: phrases(노란) > grammar(초록) > vocab(주황)
  // phrases 먼저 (긴 텍스트)
  (_analyzeData.phrases||[]).forEach(function(p) {
    if (!p.text || p.text.length < 2) return;
    var safe = p.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re = new RegExp('(?<!<[^>]*)(' + safe + ')(?![^<]*>)', 'g');
    var tooltip = p.note ? ' title="'+p.note.replace(/"/g,'&quot;')+'"' : '';
    bodyText = bodyText.replace(re, '<mark class="kh-analyze-mark kh-a-phrase" style="background:rgba(251,191,36,.4);border-bottom:2.5px solid #f59e0b;border-radius:3px;padding:0 2px;cursor:help;color:inherit"'+tooltip+'>$1</mark>');
  });
  // grammar (초록) — 짧은 어미만 (6자 이하)
  (_analyzeData.grammar||[]).forEach(function(g) {
    if (!g || g.length < 2 || g.length > 8) return;
    var safe = g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re = new RegExp('(?<!<[^>]*)(' + safe + ')(?![^<]*>)', 'g');
    bodyText = bodyText.replace(re, '<mark class="kh-analyze-mark kh-a-grammar" style="background:rgba(34,197,94,.35);border-bottom:2.5px solid #22c55e;border-radius:3px;padding:0 2px;cursor:help;color:inherit" title="Grammar: '+g+'">$1</mark>');
  });
  // vocab (주황)
  (_analyzeData.vocab||[]).forEach(function(w) {
    if (!w || w.length < 1) return;
    var safe = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re = new RegExp('(?<!<[^>]*)(' + safe + ')(?![^<]*>)', 'g');
    var vInfo = window.VOCAB && window.VOCAB[w];
    var tip = vInfo ? (w + ': ' + (vInfo.en||'')).replace(/"/g,'&quot;') : w;
    bodyText = bodyText.replace(re, '<mark class="kh-analyze-mark kh-a-vocab" style="background:rgba(249,115,22,.35);border-bottom:2.5px solid #f97316;border-radius:3px;padding:0 2px;cursor:help;color:inherit" title="'+tip+'">$1</mark>');
  });

  articleEl.innerHTML = bodyText;
  // 단어 hover 재적용
  articleEl.querySelectorAll('.vocab-zone').forEach(function(el){ wrapVocab(el); });
}

// Analyze 버튼 active 스타일
(function(){
  var s = document.createElement('style');
  s.textContent = '.art-action-icon.on{background:#2563eb!important;color:#fff!important;}';
  document.head.appendChild(s);
})();

