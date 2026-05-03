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

async function toggleTranslate() {
  var btn = document.getElementById('translate-btn');
  // Exclude the article title from the translated zones — it already has
  // a curated English headline in a.title_en (written by the admin or
  // back-filled by _khEnsureTitlesEn). Claude translating the title along
  // with the body was producing misaligned output (title slot got the
  // first body paragraph because Claude split by \n\n).
  var zones = document.querySelectorAll('.vocab-zone:not([data-kh-translate-title])');
  var titleEl = document.querySelector('[data-kh-translate-title="1"]');
  if (!btn || (!zones.length && !titleEl)) return;

  if (translateActive) {
    // 원문으로 복원
    zones.forEach(function(z) {
      if (z.dataset.original) z.innerHTML = z.dataset.original;
    });
    if (titleEl && titleEl.dataset.original) titleEl.innerHTML = titleEl.dataset.original;
    translateActive = false;
    btn.classList.remove('active');
    btn.title = 'Translate';
    return;
  }

  btn.classList.add('loading');
  btn.disabled = true;
  btn.title = 'Translating…';

  // Save originals up-front for EVERY visible zone (and the title) so
  // the user can always toggle back to Korean — previously this only
  // happened on the Claude path, so a shared-cache or in-memory cache
  // hit would translate but leave nothing to restore. That's why some
  // users saw "translation toggle works once, second click does
  // nothing".
  if (titleEl && !titleEl.dataset.original) titleEl.dataset.original = titleEl.innerHTML;
  zones.forEach(function(z) { if (!z.dataset.original) z.dataset.original = z.innerHTML; });

  // Swap the title to English up-front — doesn't require the Claude call
  // since title_en is stored per-article. Treat title_en as "missing"
  // when it still contains Hangul: legacy articles created while Korean
  // wire-service sources were in the source list copied the Korean
  // headline straight into title_en, so a naive swap would replace
  // Korean with Korean. Forcing the empty-fallback path makes those
  // articles flow through Claude which produces a real English headline.
  var titleEnAttr = titleEl ? titleEl.getAttribute('data-kh-title-en') : '';
  var titleEn = (titleEnAttr && !/[ㄱ-힝]/.test(titleEnAttr)) ? titleEnAttr : '';
  if (titleEl && titleEn) {
    var ttsSafe = (titleEn || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    titleEl.innerHTML = titleEn + ' <button class="tts-btn" title="Listen to pronunciation" onclick="event.stopPropagation();ttsSpeak(\'' + ttsSafe + '\',this)" style="display:inline-flex;align-items:center;justify-content:center"><span style="display:inline-flex;width:14px;height:14px">'+KH_ICON_VOLUME+'</span></button>';
  }

  var params = new URLSearchParams(window.location.search);
  var id = params.get('id');
  var cacheKey = 'trans_' + id;

  try {
    var sharedCached = await getFromCache('article', id, 'translation_en');
    // Only trust the cache when:
    //   1) it covers every body zone we need to render (older articles
    //      were generated under max_tokens=800, which truncated AI output
    //      to ~1 paragraph — so the cache has a partial translation that
    //      we don't want to keep serving forever), AND
    //   2) the title is already in English OR there's no title element to
    //      swap (so we don't render English body + Korean title).
    // If either check fails we fall through to the live Claude path below
    // which regenerates the full translation (and includes the title when
    // title_en is missing).
    var titleNeedsTranslate = !!(titleEl && !titleEn);
    if (
      sharedCached && sharedCached.translations &&
      sharedCached.translations.length >= zones.length &&
      !titleNeedsTranslate
    ) {
      translateCache[cacheKey] = sharedCached.translations;
      applyTranslation(zones, sharedCached.translations);
      _translateMarkActive(btn);
      translateActive = true;
      return;
    }
  } catch(e) {}

  if (translateCache[cacheKey]) {
    applyTranslation(zones, translateCache[cacheKey]);
    _translateMarkActive(btn);
    translateActive = true;
    return;
  }

  if (!supaUser) {
    _translateMarkIdle(btn);
    if (typeof toast === 'function') toast('Please sign in to create a new translation when no shared cache exists.', true);
    return;
  }

  // Collect body segments (title is already handled separately via
  // title_en swap — see above). If title_en was missing we fall back to
  // translating the title too by pushing it at the front and remembering
  // its index.
  var texts = [];
  var titleIdx = -1;
  if (titleEl && !titleEn) {
    var titleClone = titleEl.cloneNode(true);
    titleClone.querySelectorAll('.tts-btn,.kh-hover-word,.kh-word').forEach(function(s){ s.replaceWith(s.textContent || ''); });
    var tkt = titleClone.textContent.trim();
    if (tkt) { texts.push(tkt); titleIdx = 0; }
  }
  zones.forEach(function(z) {
    var clone = z.cloneNode(true);
    clone.querySelectorAll('.kh-hover-word,.kh-word').forEach(function(s){ s.replaceWith(s.textContent); });
    texts.push(clone.textContent.trim());
  });

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

    // Split title off from the body translations if we put it up-front.
    var bodyTranslations;
    if (titleIdx === 0) {
      var titleTrans = allSegs[0] || '';
      bodyTranslations = allSegs.slice(1);
      if (titleEl && titleTrans) {
        var ttsSafe2 = titleTrans.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        titleEl.innerHTML = titleTrans + ' <button class="tts-btn" title="Listen to pronunciation" onclick="event.stopPropagation();ttsSpeak(\'' + ttsSafe2 + '\',this)" style="display:inline-flex;align-items:center;justify-content:center"><span style="display:inline-flex;width:14px;height:14px">'+KH_ICON_VOLUME+'</span></button>';
      }
    } else {
      bodyTranslations = allSegs;
    }

    translateCache[cacheKey] = bodyTranslations;
    applyTranslation(zones, bodyTranslations);
    translateActive = true;
    _translateMarkActive(btn);

    // Shared cache write-back so the next reader doesn't burn another
    // Claude call. Original code referenced an undefined `translations`
    // variable, so the upsert silently threw and every user re-paid for
    // the same article. Use the parsed bodyTranslations array.
    try {
      if (bodyTranslations && bodyTranslations.length) {
        upsertArticleCacheRow(id, { translation: JSON.stringify({ texts: bodyTranslations }) });
      }
    } catch(e) {}
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

function applyTranslation(zones, translations) {
  zones.forEach(function(z, i) {
    if (translations[i]) z.innerHTML = '<p>' + translations[i] + '</p>';
  });
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

