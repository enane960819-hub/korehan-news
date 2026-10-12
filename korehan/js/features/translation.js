/* ============================================================
   KoreHani — English translation toggle
   Extracted from korehan-shared.js (was lines 4494-4777).

   Side-by-side English translations of the article body, keyed
   per-paragraph. Calls Claude via callClaude() for missing
   chunks and persists the resulting `translations` array under
   article_cache cache_key='translation_en' so subsequent
   readers (and the same reader on refresh) skip the round-trip.

   External deps (resolved at runtime via global scope):
   - callClaude             — from korehan-shared.js
   - getFromCache, upsertArticleCacheRow
                            — from js/core/article-cache.js
   - escapeHTML             — from js/core/security.js
   - toast                  — from korehan-shared.js
   ============================================================ */

// ── 영어 번역 토글 ─────────────────────────────────────────────
var translateActive = false;
var translateCache = {};

// Paragraphs of the article body only (lead + long body). Sidebar items,
// Netizen Talk etc. also carry .vocab-zone and must never be translated
// into — the old zone list mapped paragraph translations onto them.
function _trParas() {
  return Array.prototype.slice.call(document.querySelectorAll('#art-tab-article .art-lead > p, #art-tab-article .art-full > p'))
    .filter(function(p){ return (p.textContent || '').trim(); });
}
function _trText(el) {
  var clone = el.cloneNode(true);
  clone.querySelectorAll('.tts-btn').forEach(function(s){ s.remove(); });
  return (clone.textContent || '').replace(/\s+/g, ' ').trim();
}

async function toggleTranslate() {
  var btn = document.getElementById('translate-btn');
  var paras = _trParas();
  var titleEl = document.querySelector('[data-kh-translate-title="1"]');
  if (!btn || (!paras.length && !titleEl)) return;

  if (translateActive) {
    paras.forEach(function(p) { if (p.dataset.original != null) p.innerHTML = p.dataset.original; });
    if (titleEl && titleEl.dataset.original) titleEl.innerHTML = titleEl.dataset.original;
    translateActive = false;
    _translateMarkIdle(btn);
    return;
  }

  btn.classList.add('loading');
  btn.disabled = true;
  btn.title = 'Translating…';
  if (titleEl && !titleEl.dataset.original) titleEl.dataset.original = titleEl.innerHTML;
  paras.forEach(function(p) { if (p.dataset.original == null) p.dataset.original = p.innerHTML; });

  // Title: curated title_en when it is real English.
  var titleEnAttr = titleEl ? titleEl.getAttribute('data-kh-title-en') : '';
  var titleEn = (titleEnAttr && !/[ㄱ-힝]/.test(titleEnAttr)) ? titleEnAttr : '';
  function setTitle(t) {
    if (!titleEl || !t) return;
    var ttsSafe = String(t).replace(/'/g, "\\'").replace(/"/g, '&quot;');
    titleEl.innerHTML = _trEsc(t) + ' <button class="tts-btn" title="Listen to pronunciation" onclick="event.stopPropagation();ttsSpeak(\'' + ttsSafe + '\',this)" style="display:inline-flex;align-items:center;justify-content:center"><span style="display:inline-flex;width:14px;height:14px">'+KH_ICON_VOLUME+'</span></button>';
  }
  if (titleEn) setTitle(titleEn);

  var id = new URLSearchParams(window.location.search).get('id');
  var cacheKey = 'trans_' + id;

  // 1) Shared cache (paragraph array written by the server bake / earlier readers).
  var have = translateCache[cacheKey] ? translateCache[cacheKey].slice() : [];
  if (!have.length) {
    try {
      var sharedCached = await getFromCache('article', id, 'translation_en');
      if (sharedCached && Array.isArray(sharedCached.translations)) have = sharedCached.translations.slice();
    } catch(e) {}
  }
  var missing = [];
  paras.forEach(function(p, i) { if (!have[i]) missing.push(i); });
  var needTitle = !!(titleEl && !titleEn);

  if (!missing.length && !needTitle) {
    translateCache[cacheKey] = have;
    applyTranslation(paras, have);
    translateActive = true;
    _translateMarkActive(btn);
    return;
  }
  if (!supaUser) {
    if (have.length) {
      applyTranslation(paras, have);
      translateActive = true;
      _translateMarkActive(btn);
      if (missing.length && typeof toast === 'function') toast('Sign in to translate the rest of this article.', true);
    } else {
      _translateMarkIdle(btn);
      if (typeof toast === 'function') toast('Sign in to translate this article.', true);
    }
    return;
  }

  // 2) Claude for the missing paragraphs (+ title when there is no English one).
  var texts = [];
  var titleIdx = -1;
  if (needTitle) { var tkt = _trText(titleEl); if (tkt) { texts.push(tkt); titleIdx = 0; } }
  missing.forEach(function(i) { texts.push(_trText(paras[i])); });

  // Use explicit delimiters instead of a JSON array. The prior JSON array
  // prompt caused Claude to return only the first paragraph — likely
  // because it interpreted "JSON array of strings" as one short string
  // per input and summarized the rest. Delimiters give Claude a clear
  // start/end for each segment so it can't "helpfully" truncate.
  var DELIM_OPEN  = '⟦SEG ';
  var DELIM_CLOSE = '⟧';
  var END_MARKER  = '⟦/SEG⟧';

  // Send a chunk of segments to Claude and parse the marker-delimited
  // response. Long articles with many paragraphs were silently truncating
  // at the previous 4096-token cap — bumping to 8192 covers almost
  // everything; for the rare giant article the chunked path below
  // retries in halves so each request stays well under the cap.
  async function _khAttemptTranslate(chunkTexts, baseIdx) {
    var localBase = baseIdx || 0;
    var localJoined = chunkTexts.map(function(t, i) {
      return DELIM_OPEN + (localBase + i + 1) + DELIM_CLOSE + '\n' + t + '\n' + END_MARKER;
    }).join('\n\n');
    var localPrompt =
        'You are a Korean-to-English translator for a language learning site.\n'
      + 'Below are ' + chunkTexts.length + ' text segment(s), each wrapped with ⟦SEG n⟧ ... ⟦/SEG⟧ markers.\n'
      + 'Translate EVERY segment COMPLETELY into natural, fluent English. Do NOT summarize, do NOT skip any sentence.\n'
      + 'Preserve paragraph breaks (blank lines) inside each segment.\n'
      + 'Return the translations using the SAME marker format: ⟦SEG n⟧\\n<translation>\\n⟦/SEG⟧, one block per segment, in the same order.\n'
      + 'No preamble, no commentary, no code fences — just the marked blocks.\n\n'
      + localJoined;

    var res = await callClaude({
      feature: 'translate',
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      messages: [{ role: 'user', content: localPrompt }]
    });
    var data = res;

    var raw = '';
    if (data.content && data.content[0] && data.content[0].text) raw = data.content[0].text;
    else if (data.text) raw = data.text;
    else if (typeof data === 'string') raw = data;
    if (!raw) throw new Error('empty response');

    // Parse the marker-delimited response. Regex uses /s (dotAll) so the
    // translation body can contain its own newlines.
    var segRe = /⟦SEG\s*(\d+)\s*⟧\s*([\s\S]*?)\s*⟦\/SEG⟧/g;
    var localSegs = [];
    var mSeg;
    while ((mSeg = segRe.exec(raw)) !== null) {
      var idx = parseInt(mSeg[1], 10) - 1 - localBase;
      var body = (mSeg[2] || '').trim();
      if (idx >= 0 && body) localSegs[idx] = body;
    }
    if (!localSegs.length) throw new Error('no segments in response');
    if (localSegs.filter(Boolean).length < Math.ceil(chunkTexts.length * 0.5)) {
      throw new Error('partial response');
    }
    return localSegs;
  }

  // Split-and-conquer fallback. If a single request comes back partial
  // even after retries, recurse on halves so each call stays small. We
  // bottom out at one segment — if that still fails we surface the
  // error to the user instead of looping forever.
  async function _khTranslateChunked(chunkTexts, baseIdx) {
    try {
      return await _khAttemptTranslate(chunkTexts, baseIdx);
    } catch (err) {
      var partial = err && /partial|empty|no segments/i.test(err.message || '');
      if (chunkTexts.length <= 1 || !partial) throw err;
      var mid = Math.floor(chunkTexts.length / 2);
      var leftP  = _khTranslateChunked(chunkTexts.slice(0, mid), baseIdx);
      var rightP = _khTranslateChunked(chunkTexts.slice(mid),    baseIdx + mid);
      var leftSegs  = await leftP;
      var rightSegs = await rightP;
      return leftSegs.concat(rightSegs);
    }
  }

  try {
    var allSegs;
    var attempts = 0;
    var lastErr = null;
    var backoffs = [0, 2000, 4000]; // immediate, then 2s, then 4s
    while (attempts < 3) {
      try {
        if (backoffs[attempts]) await new Promise(function(r){ setTimeout(r, backoffs[attempts]); });
        allSegs = await _khTranslateChunked(texts, 0);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        // Auth errors can't recover — surface immediately.
        if (err && (err.message === 'unauthorized' || err.message === 'Not signed in')) throw err;
        attempts++;
      }
    }
    if (lastErr) throw lastErr;

    var off = 0;
    if (titleIdx === 0) { setTitle(allSegs[0] || ''); off = 1; }
    missing.forEach(function(pi, k) { if (allSegs[k + off]) have[pi] = allSegs[k + off]; });

    translateCache[cacheKey] = have;
    applyTranslation(paras, have);
    translateActive = true;
    _translateMarkActive(btn);

    // Write back into the shared cache, MERGING into the existing
    // translation JSON (it also holds the server-baked per-sentence
    // analysis — overwriting it with {texts} forced a re-bake).
    try { _trWriteBack(id, have, paras.length); } catch(e) {}
  } catch(e) {
    _translateMarkIdle(btn);
    // Restore the Korean title if we had optimistically swapped it in.
    if (titleEl && titleEl.dataset.original) titleEl.innerHTML = titleEl.dataset.original;
    translateActive = false;
    if (e && (e.message === 'unauthorized' || e.message === 'Not signed in')) {
      if (!supaUser) {
        if (typeof openAuthModal === 'function') openAuthModal('signin');
        if (typeof toast === 'function') toast('Please sign in to use Translation.', true);
      } else {
        if (typeof toast === 'function') toast('Session error — please reload and try again.', true);
      }
    } else {
      if (typeof toast === 'function') toast('Translation failed — check your connection and try again.', true);
    }
  }
  btn.disabled = false;
}

function _trEsc(t) {
  return String(t == null ? '' : t).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; });
}
// Cached translations come from a table signed-in users can write — always escape.
function applyTranslation(paras, translations) {
  paras.forEach(function(p, i) {
    if (translations[i]) p.innerHTML = _trEsc(translations[i]).replace(/\n\n+/g, '<br><br>');
  });
}

async function _trWriteBack(articleId, texts, n) {
  var sb = getSupa();
  if (!sb || !articleId || !texts || !texts.length) return;
  var cur = null;
  try {
    var r = await sb.from('article_cache').select('translation').eq('article_id', String(articleId)).maybeSingle();
    if (r && !r.error && r.data && r.data.translation) {
      cur = typeof r.data.translation === 'string' ? JSON.parse(r.data.translation) : r.data.translation;
    }
  } catch(_) { cur = null; }
  var merged = Object.assign({}, cur || {}, { texts: texts.slice(0, Math.max(n, (cur && cur.texts || []).length)) });
  upsertArticleCacheRow(articleId, { translation: JSON.stringify(merged) });
}

// Toggle visual state on the translate button without mutating its
// innerHTML — the icon stays in place so the click-target (28px square
// on mobile) doesn't expand into text and shove itself out of reach.
// CSS styles .art-action-icon.active + .loading to communicate state.
function _translateMarkActive(btn) {
  if (!btn) return;
  btn.disabled = false;
  btn.classList.remove('loading');
  btn.classList.add('active');
  btn.title = 'Back to Korean';
}
function _translateMarkIdle(btn) {
  if (!btn) return;
  btn.disabled = false;
  btn.classList.remove('loading');
  btn.classList.remove('active');
  btn.title = 'Translate';
}

