/* ============================================================
   KoreHani — Reading-time tracker (WPM)
   Extracted from korehan-shared.js (was lines 4493-4546).

   Starts when an article opens, stops on navigate / close /
   visibility change. Persists elapsed seconds via the
   `finish_read_event` Supabase RPC so the Learning Hub Reading
   axis can ground its score in actual WPM.

   External deps (resolved at runtime via global scope):
   - getSupa(), supaUser   — from korehan-shared.js
   ============================================================ */

// ── Reading-time tracker (WPM) ─────────────────────────────────
// Starts when an article opens, stops on navigate / close / hide.
// Persists elapsed time via the finish_read_event RPC so the
// Learning Hub Reading axis can ground its score in actual WPM.
var _artReadTimer = null;   // { id, wordCount, startedAt }

// Count space-separated Korean eojeol + Latin words — good enough for
// WPM (Korean readers typically measure ~250-320 eojeol/min proficient).
function _countArticleWords(text) {
  if (!text) return 0;
  var plain = String(text).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!plain) return 0;
  return plain.split(' ').length;
}

function _startArticleReadTimer(articleId, bodyOrCount) {
  if (!articleId) return;
  // Finalize any previous open article first.
  if (_artReadTimer && String(_artReadTimer.id) !== String(articleId)) {
    _finishArticleReadTimer();
  }
  var wc = typeof bodyOrCount === 'number' ? bodyOrCount : _countArticleWords(bodyOrCount);
  _artReadTimer = {
    id:        String(articleId),
    wordCount: wc,
    startedAt: Date.now()
  };
}

async function _finishArticleReadTimer(reason) {
  var t = _artReadTimer;
  if (!t) return;
  _artReadTimer = null; // prevent double-fire
  var elapsed = Math.round((Date.now() - t.startedAt) / 1000);
  if (elapsed < 5) return; // bounce — don't pollute stats
  if (!supaUser) return;
  var sb = getSupa();
  if (!sb) return;
  try {
    await sb.rpc('finish_read_event', {
      p_content_type: 'article',
      p_content_id:   t.id,
      p_read_seconds: elapsed,
      p_word_count:   t.wordCount || null
    });
  } catch(e) { /* RPC not installed yet → ignore */ }
}

// Fire the finish call on any way the article view can end.
window.addEventListener('beforeunload', function(){ _finishArticleReadTimer('unload'); });
window.addEventListener('pagehide',     function(){ _finishArticleReadTimer('pagehide'); });
document.addEventListener('visibilitychange', function(){
  if (document.visibilityState === 'hidden') _finishArticleReadTimer('hidden');
});
