/* ============================================================
   KoreHani — Article bookmarks
   Extracted from korehan-shared.js (was lines 4842-4880).

   Toggle bookmarks on the article reader and check current
   bookmark state on page load. RLS in Supabase scopes rows to
   the signed-in user.

   External deps (resolved at runtime via global scope):
   - getSupa(), supaUser   — from korehan-shared.js
   - openAuthModal         — from korehan-shared.js
   - toast                 — from korehan-shared.js
   ============================================================ */

// ── 북마크 ────────────────────────────────────────────────────
async function toggleBookmark(articleId, btn) {
  if (!supaUser) { openAuthModal("signin"); return; }
  var sb = getSupa();
  if (!sb) return;

  // Previously the insert/delete results were awaited but never checked,
  // so a failed save (e.g. RLS denial, network blip) would still flip the
  // button to "Bookmarked ✓" — silent data loss from the user's POV.
  // Now we check .error and only update UI / toast when the DB actually
  // accepted the change.
  var isBookmarked = btn.classList.contains('active');
  if (isBookmarked) {
    var del = await sb.from('bookmarks').delete().eq('user_id', supaUser.id).eq('article_id', articleId);
    if (del.error) { toast('Could not remove bookmark'); return; }
    btn.classList.remove('active');
    btn.innerHTML = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
    toast('Bookmark removed');
  } else {
    var ins = await sb.from('bookmarks').insert({ user_id: supaUser.id, article_id: articleId });
    if (ins.error) { toast('Could not save bookmark'); return; }
    btn.classList.add('active');
    btn.innerHTML = '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 0-2-2h10a2 2 0 0 0 2 2z"/></svg>';
    toast('Bookmarked');
  }
}

async function checkBookmarkState(articleId) {
  var btn = document.getElementById('art-bm-btn');
  if (!btn || !supaUser) return;
  var sb = getSupa();
  if (!sb) return;
  var { data } = await sb.from('bookmarks').select('id').eq('user_id', supaUser.id).eq('article_id', articleId).maybeSingle();
  if (data) {
    btn.classList.add('active');
    btn.innerHTML = '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 0-2-2h10a2 2 0 0 0 2 2z"/></svg>';
  }
}

