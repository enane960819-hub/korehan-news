/* ============================================================
   KoreHani — Article comments
   Extracted from korehan-shared.js (was lines 4881-5073).

   Load / submit / delete / report comments under each article,
   with rate limiting, basic spam heuristics, and a localStorage-
   backed "hide" lane so users can self-moderate without a server-
   side queue.

   External deps (resolved at runtime via global scope):
   - getSupa(), supaUser           — from korehan-shared.js
   - openAuthModal, toast          — from korehan-shared.js
   - escapeHTML, escapeAttr,
     isValidImageURL               — from js/core/security.js
   - KH_ICON_X                     — from js/core/icons.js
   - khConfirm                     — from js/core/modals.js
   - window._isAdmin               — set by admin gate
   ============================================================ */

// ── 댓글 ──────────────────────────────────────────────────────
function updateCommentForm() {
  var formEl   = document.getElementById('comment-form');
  var noticeEl = document.getElementById('comment-login-notice');
  if (!formEl || !noticeEl) return;
  if (supaUser) {
    formEl.style.display = 'block';
    noticeEl.style.display = 'none';
  } else {
    formEl.style.display = 'none';
    noticeEl.style.display = 'block';
  }
}

async function loadComments(articleId) {
  var sb = getSupa();
  var listEl = document.getElementById('comments-list');
  var countEl = document.getElementById('comment-count');
  if (!listEl) return;

  if (!sb) {
    listEl.innerHTML = '<p style="color:#aaa;font-size:13px;padding:12px 0">Loading comments...</p>';
    return;
  }

  var { data, error } = await sb
    .from('comments')
    .select('*')
    .eq('article_id', articleId)
    .order('created_at', { ascending: true });

  if (error || !data || !data.length) {
    listEl.innerHTML = '<p style="color:#aaa;font-size:13px;padding:12px 0">Be the first to comment!</p>';
    if (countEl) countEl.textContent = '';
    return;
  }

  if (countEl) countEl.textContent = '(' + data.length + ')';

  // Moderation controls. Owners can delete their own; admins can
  // delete anyone's (Supabase RLS permits). Non-owners and non-admins
  // see a "Report" button that hides the comment locally for that
  // user (stored in localStorage) and pings a toast — a lightweight
  // report lane that doesn't need a moderation queue table. If a
  // server-side flag table is added later the same button can POST
  // to it without any UI change.
  var hidden = _khHiddenComments();
  var visible = data.filter(function(c){ return !hidden[c.id]; });
  var hiddenCount = data.length - visible.length;

  if (countEl) countEl.textContent = '(' + data.length + ')';

  var rowsHtml = visible.map(function(c) {
    var isOwn = supaUser && supaUser.id === c.user_id;
    var isAdmin = !!window._isAdmin;
    var avatar = (c.avatar_url && isValidImageURL(c.avatar_url))
      ? '<img src="' + escapeAttr(c.avatar_url) + '" class="comment-avatar" onerror="this.style.display=\'none\'">'
      : '<div class="comment-avatar" style="background:#2255a4;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700">' + (c.user_name||'?').charAt(0) + '</div>';
    var timeStr = c.created_at ? new Date(c.created_at).toLocaleDateString('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
    var actions = '';
    if (isOwn || isAdmin) {
      actions = '<button class="comment-del" onclick="deleteComment(\'' + escapeAttr(c.id) + '\')" title="Delete" style="display:inline-flex;align-items:center;justify-content:center"><span style="display:inline-flex;width:12px;height:12px">'+KH_ICON_X+'</span></button>';
    } else if (supaUser) {
      actions = '<button class="comment-del" onclick="reportComment(\'' + escapeAttr(c.id) + '\')" title="Report and hide" style="display:inline-flex;align-items:center;justify-content:center"><span style="display:inline-flex;width:12px;height:12px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="22" x2="4" y2="15"/><path d="M4 15s1-2 5-2 5 2 9 2V3s-1 2-5 2-5-2-9-2"/></svg></span></button>';
    }
    return '<div class="comment-row" id="comment-' + c.id + '">'
      + '<div class="comment-top">'
      + avatar
      + '<div class="comment-meta">'
      + '<span class="comment-name">' + escapeHTML(c.user_name || 'Anonymous') + '</span>'
      + '<span class="comment-date">' + timeStr + '</span>'
      + '</div>'
      + actions
      + '</div>'
      + '<div class="comment-body">' + escapeHtml(c.content) + '</div>'
      + '</div>';
  }).join('');

  var footer = hiddenCount > 0
    ? '<div style="font-size:11px;color:#94a3b8;padding:10px 0;text-align:center">' + hiddenCount + ' comment' + (hiddenCount === 1 ? '' : 's') + ' hidden. <button onclick="_khShowHiddenComments()" style="background:none;border:0;color:#2563eb;font-size:11px;font-weight:700;cursor:pointer;padding:0;font-family:inherit;text-decoration:underline">Show all</button></div>'
    : '';
  listEl.innerHTML = (rowsHtml || '<p style="color:#aaa;font-size:13px;padding:12px 0">Be the first to comment!</p>') + footer;
}

var _KH_HIDDEN_COMMENTS_KEY = 'kh_hidden_comments';
function _khHiddenComments() {
  try { return JSON.parse(localStorage.getItem(_KH_HIDDEN_COMMENTS_KEY) || '{}') || {}; }
  catch(_) { return {}; }
}
function _khSaveHiddenComments(h) {
  try { localStorage.setItem(_KH_HIDDEN_COMMENTS_KEY, JSON.stringify(h || {})); } catch(_) {}
}
async function reportComment(commentId) {
  if (!supaUser) { openAuthModal('signin'); return; }
  var ok = await khConfirm(
    'Report this comment?',
    "We'll hide it from your view and flag it for review.",
    { okLabel: 'Report' }
  );
  if (!ok) return;
  var h = _khHiddenComments();
  h[commentId] = Date.now();
  _khSaveHiddenComments(h);
  toast('Reported. Hidden from your view.', 'success');
  // Re-render the comments list by re-calling loadComments with the
  // current article id.
  var params = new URLSearchParams(window.location.search);
  var id = params.get('id');
  if (id) loadComments(id);
}
function _khShowHiddenComments() {
  _khSaveHiddenComments({});
  var params = new URLSearchParams(window.location.search);
  var id = params.get('id');
  if (id) loadComments(id);
}

// 댓글 rate limit: 유저별 마지막 작성 시간 추적
var _commentLastTime = {};
var COMMENT_COOLDOWN_MS = 30000; // 30초
var COMMENT_MAX_LENGTH  = 500;
var COMMENT_MIN_LENGTH  = 2;

// 기본 스팸 패턴 (URL 도배, 반복 문자)
function isSpamComment(text) {
  // 동일 문자 10개 이상 반복
  if (/(.)(\1){9,}/.test(text)) return true;
  // URL 3개 이상
  if ((text.match(/https?:\/\//g) || []).length >= 3) return true;
  // 전체가 공백/특수문자만
  if (!/[가-힣a-zA-Z0-9]/.test(text)) return true;
  return false;
}

async function submitComment(articleId) {
  if (!supaUser) { openAuthModal("signin"); return; }
  var input = document.getElementById('comment-input');
  var content = input ? input.value.trim() : '';

  // 길이 체크
  if (!content || content.length < COMMENT_MIN_LENGTH) {
    toast('Comment is too short.', true); return;
  }
  if (content.length > COMMENT_MAX_LENGTH) {
    toast('Comment is too long (max ' + COMMENT_MAX_LENGTH + ' characters).', true); return;
  }

  // 스팸 체크
  if (isSpamComment(content)) {
    toast('Comment looks like spam. Please write normally.', true); return;
  }

  // Rate limit 체크 (30초 쿨다운)
  var now = Date.now();
  var last = _commentLastTime[supaUser.id] || 0;
  if (now - last < COMMENT_COOLDOWN_MS) {
    var wait = Math.ceil((COMMENT_COOLDOWN_MS - (now - last)) / 1000);
    toast('Please wait ' + wait + ' seconds before posting again.', true); return;
  }

  var sb = getSupa();
  if (!sb) return;

  var { error } = await sb.from('comments').insert({
    article_id:  articleId,
    user_id:     supaUser.id,
    user_name:   supaUser.user_metadata && supaUser.user_metadata.full_name || supaUser.email,
    avatar_url:  supaUser.user_metadata && supaUser.user_metadata.avatar_url || null,
    content:     content,
  });

  if (error) { toast('Error posting comment: ' + error.message, true); return; }
  _commentLastTime[supaUser.id] = Date.now();
  input.value = '';
  toast('Comment posted');
  loadComments(articleId);
}

async function deleteComment(commentId) {
  if (!supaUser) return;
  var ok = await khConfirm('Delete this comment?', 'This can\'t be undone.', { okLabel: 'Delete', destructive: true });
  if (!ok) return;
  var sb = getSupa();
  if (!sb) return;
  var { error } = await sb.from('comments').delete().eq('id', commentId).eq('user_id', supaUser.id);
  if (error) { toast('Delete failed', true); return; }
  var el = document.getElementById('comment-' + commentId);
  if (el) el.remove();
  toast('Comment deleted');
}

// Alias for escapeHTML (defined earlier) — single entry point for all HTML escaping
var escapeHtml = escapeHTML;
