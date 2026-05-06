/* ============================================================
   KoreHani — Article comments
   Forum-style (도그드립 inspired) with threaded replies +
   like/dislike reactions. Same #art-comments host as before, so
   the existing mobile bottom-sheet drawer wraps this unchanged.

   Schema (created in Supabase SQL editor):
     ALTER TABLE comments ADD COLUMN parent_id uuid
       REFERENCES comments(id) ON DELETE CASCADE;

     CREATE TABLE comment_reactions (
       user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
       comment_id uuid REFERENCES comments(id) ON DELETE CASCADE,
       reaction smallint CHECK (reaction IN (1, -1)),
       created_at timestamptz DEFAULT now(),
       PRIMARY KEY (user_id, comment_id)
     );

   Code degrades gracefully if either is missing — replies fall
   back to top-level posts and reaction buttons silently no-op.

   External deps (resolved at runtime via global scope):
   - getSupa(), supaUser           — from korehan-shared.js
   - openAuthModal, toast          — from korehan-shared.js
   - escapeHTML, escapeAttr,
     isValidImageURL               — from js/core/security.js
   - khConfirm                     — from js/core/modals.js
   - window._isAdmin               — set by admin gate
   ============================================================ */

// Track schema feature availability — set after first failed write so
// we don't keep trying obviously-missing columns / tables on retry.
var _khCmFeatures = { parentChecked: false, parentOk: true, reactChecked: false, reactOk: true };

function updateCommentForm() {
  var formEl   = document.getElementById('comment-form');
  var noticeEl = document.getElementById('comment-login-notice');
  if (!formEl || !noticeEl) return;
  if (supaUser) {
    // Clear the inline style entirely so the CSS display: flex from
    // .comment-form takes over. Setting display:'block' here was the
    // bug that put the 등록 button on its own line under the textarea.
    formEl.style.removeProperty('display');
    noticeEl.style.display = 'none';
  } else {
    formEl.style.display = 'none';
    noticeEl.style.removeProperty('display');
  }
}

function _khRelTime(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  var diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)        return '방금 전';
  if (diff < 3600)      return Math.floor(diff/60) + '분 전';
  if (diff < 86400)     return Math.floor(diff/3600) + '시간 전';
  if (diff < 7*86400)   return Math.floor(diff/86400) + '일 전';
  return d.toLocaleDateString('ko-KR', { year:'2-digit', month:'numeric', day:'numeric' });
}

// Cache: articleId → { reactionAgg: { commentId: {like, dislike} },
//                       myReactions: { commentId: 1|-1 } }
var _khCmReactCache = {};

async function _khFetchReactions(sb, commentIds) {
  if (!_khCmFeatures.reactOk || !commentIds.length) {
    return { agg: {}, mine: {} };
  }
  var agg = {};
  var mine = {};
  try {
    // All reactions for these comments — small N (one article's worth).
    var res = await sb.from('comment_reactions')
      .select('comment_id, reaction, user_id')
      .in('comment_id', commentIds);
    if (res.error) throw res.error;
    (res.data || []).forEach(function(r) {
      if (!agg[r.comment_id]) agg[r.comment_id] = { like: 0, dislike: 0 };
      if (r.reaction === 1)       agg[r.comment_id].like++;
      else if (r.reaction === -1) agg[r.comment_id].dislike++;
      if (supaUser && r.user_id === supaUser.id) mine[r.comment_id] = r.reaction;
    });
  } catch(e) {
    // Table likely doesn't exist yet — flag and treat all as 0.
    _khCmFeatures.reactChecked = true;
    _khCmFeatures.reactOk = false;
  }
  return { agg: agg, mine: mine };
}

async function loadComments(articleId) {
  var sb = getSupa();
  var listEl = document.getElementById('comments-list');
  var countEl = document.getElementById('comment-count');
  if (!listEl) return;

  if (!sb) {
    listEl.innerHTML = '<p class="cm-empty">Loading comments...</p>';
    return;
  }

  var sel = await sb
    .from('comments')
    .select('*')
    .eq('article_id', articleId)
    .order('created_at', { ascending: true });
  var data  = sel.data;
  var error = sel.error;

  if (error || !data || !data.length) {
    listEl.innerHTML = '<p class="cm-empty">아직 댓글이 없어요. 첫 댓글을 남겨보세요!</p>';
    if (countEl) countEl.textContent = '';
    return;
  }

  // Hide locally-reported comments (same kh_hidden_comments lane as before).
  var hidden = _khHiddenComments();
  var visible = data.filter(function(c){ return !hidden[c.id]; });
  var hiddenCount = data.length - visible.length;

  // Build a lookup by id so reply rows can show "@parentName" mentions.
  var byId = {};
  visible.forEach(function(c){ byId[c.id] = c; });

  // Group: top-level rows + replies-by-parent.
  var topLevel = [];
  var repliesByParent = {};
  visible.forEach(function(c) {
    if (c.parent_id && byId[c.parent_id]) {
      (repliesByParent[c.parent_id] = repliesByParent[c.parent_id] || []).push(c);
    } else {
      topLevel.push(c);
    }
  });

  if (countEl) countEl.textContent = '(' + data.length + ')';
  // Mirror count to the drawer header pill if the drawer is mounted.
  var drawerCount = document.getElementById('kh-cdr-count');
  if (drawerCount) drawerCount.textContent = String(data.length);

  // Reactions for all visible comments in one round-trip.
  var reactions = await _khFetchReactions(sb, visible.map(function(c){ return c.id; }));
  _khCmReactCache[articleId] = reactions;

  function renderRow(c, opts) {
    opts = opts || {};
    var isReply   = !!opts.isReply;
    var parentName = opts.parentName || '';
    var isOwn   = supaUser && supaUser.id === c.user_id;
    var isAdmin = !!window._isAdmin;

    // Avatar — small initial chip with a stable per-user color, OR a real
    // image when the OAuth account provides one.
    var initial = escapeHTML((c.user_name || '?').charAt(0).toUpperCase());
    var color   = _khAvColor(c.user_name || c.user_id || '');
    var avatarInner = (c.avatar_url && isValidImageURL(c.avatar_url))
      ? '<img src="' + escapeAttr(c.avatar_url) + '" class="cm-av" alt="" onerror="this.outerHTML=\'<div class=\\\'cm-av cm-av-ph\\\' style=\\\'background:' + color + '\\\'>' + initial + '</div>\'">'
      : '<div class="cm-av cm-av-ph" style="background:' + color + '">' + initial + '</div>';
    // Wrap avatar + name in profile links when we have a user_id, so
    // tapping either one opens the public profile page (Phase 2 of the
    // friends/social system). Anonymous rows render as plain text.
    var profileHref = c.user_id ? ('korehan-profile.html?user=' + encodeURIComponent(c.user_id)) : null;
    var avatar = profileHref
      ? '<a class="cm-av-link" href="' + profileHref + '" aria-label="View profile" style="text-decoration:none;line-height:0">' + avatarInner + '</a>'
      : avatarInner;

    var agg  = reactions.agg[c.id]  || { like: 0, dislike: 0 };
    var mine = reactions.mine[c.id] || 0;
    var likeOn    = mine === 1  ? ' on' : '';
    var dislikeOn = mine === -1 ? ' on' : '';

    // Replies open with a colored mention chip — keeps the reply target
    // obvious without needing visual indentation alone to carry it.
    var mention = (isReply && parentName)
      ? '<span class="cm-mention">@' + escapeHTML(parentName) + '</span> '
      : '';

    var menu = (isOwn || isAdmin)
      ? '<button class="cm-mini cm-danger" onclick="deleteComment(\'' + escapeAttr(c.id) + '\')" title="삭제">삭제</button>'
      : (supaUser
          ? '<button class="cm-mini" onclick="reportComment(\'' + escapeAttr(c.id) + '\')" title="신고하고 가리기">신고</button>'
          : '');

    var replyBtn = supaUser
      ? '<button class="cm-mini cm-reply-toggle" onclick="khCmToggleReply(\'' + escapeAttr(c.id) + '\')">답글</button>'
      : '';

    var actions =
      '<div class="cm-actions">'
      + '<button class="cm-react' + likeOn    + '" data-type="like"    onclick="khCmReact(\'' + escapeAttr(c.id) + '\', 1)" aria-label="좋아요">'
      +   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v11H4V10z"/><path d="M7 10l4-7c1.5 0 2.5 1 2.5 2.5V10h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.3 21H7"/></svg>'
      +   '<span id="cm-like-' + c.id + '">' + agg.like + '</span>'
      + '</button>'
      + '<button class="cm-react' + dislikeOn + '" data-type="dislike" onclick="khCmReact(\'' + escapeAttr(c.id) + '\', -1)" aria-label="싫어요">'
      +   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 14V3h3v11z"/><path d="M17 14l-4 7c-1.5 0-2.5-1-2.5-2.5V14h-5a2 2 0 0 1-2-2.3l1.2-6A2 2 0 0 1 6.7 3H17"/></svg>'
      +   '<span id="cm-dislike-' + c.id + '">' + agg.dislike + '</span>'
      + '</button>'
      + '<span class="cm-actions-sep"></span>'
      + replyBtn
      + menu
      + '</div>';

    var replyForm =
      '<div class="cm-reply-form" id="cm-reply-form-' + c.id + '" hidden>'
      + '<textarea placeholder="@' + escapeAttr(c.user_name || '') + '에게 답글…" maxlength="500" rows="1"></textarea>'
      + '<div class="cm-reply-form-row">'
      +   '<button class="cm-mini" onclick="khCmToggleReply(\'' + escapeAttr(c.id) + '\')">취소</button>'
      +   '<button class="cm-reply-submit" onclick="khCmSubmitReply(\'' + escapeAttr(c.id) + '\')">등록</button>'
      + '</div>'
      + '</div>';

    var nameLabel = escapeHTML(c.user_name || '익명');
    var nameHtml = profileHref
      ? '<a class="cm-name cm-name-link" href="' + profileHref + '" style="color:inherit;text-decoration:none">' + nameLabel + '</a>'
      : '<span class="cm-name">' + nameLabel + '</span>';
    return '<article class="cm-row' + (isReply ? ' cm-reply' : '') + '" id="cm-' + c.id + '">'
      + '<div class="cm-head">'
      +   avatar
      +   nameHtml
      +   '<span class="cm-dot">·</span>'
      +   '<span class="cm-time">' + _khRelTime(c.created_at) + '</span>'
      + '</div>'
      + '<div class="cm-body">' + mention + escapeHTML(c.content) + '</div>'
      + actions
      + replyForm
      + '</article>';
  }

  // Stable hash → 8-color palette for initial-chip avatars.
  function _khAvColor(seed) {
    var palette = ['#2255a4','#7c3aed','#059669','#db2777','#dc2626','#0891b2','#ea580c','#4338ca'];
    var h = 0;
    for (var i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    return palette[Math.abs(h) % palette.length];
  }

  var html = topLevel.map(function(top) {
    var parentBlock = renderRow(top, { isReply: false });
    var replies = (repliesByParent[top.id] || []).map(function(r) {
      return renderRow(r, { isReply: true, parentName: top.user_name });
    }).join('');
    return parentBlock + (replies ? '<div class="cm-thread">' + replies + '</div>' : '');
  }).join('');

  var footer = hiddenCount > 0
    ? '<div class="cm-hidden-note">' + hiddenCount + '개의 댓글이 가려졌습니다. <button onclick="_khShowHiddenComments()">모두 보기</button></div>'
    : '';

  listEl.innerHTML = (html || '<p class="cm-empty">아직 댓글이 없어요. 첫 댓글을 남겨보세요!</p>') + footer;
}

// ── Reply form toggle / submit ────────────────────────────────
function khCmToggleReply(commentId) {
  if (!supaUser) { openAuthModal('signin'); return; }
  var el = document.getElementById('cm-reply-form-' + commentId);
  if (!el) return;
  var open = !el.hasAttribute('hidden');
  // Close every other reply form first so only one is open at a time.
  document.querySelectorAll('.cm-reply-form').forEach(function(f){ f.setAttribute('hidden',''); });
  if (!open) {
    el.removeAttribute('hidden');
    var ta = el.querySelector('textarea');
    if (ta) setTimeout(function(){ ta.focus(); }, 30);
  }
}

async function khCmSubmitReply(parentId) {
  if (!supaUser) { openAuthModal('signin'); return; }
  var formEl = document.getElementById('cm-reply-form-' + parentId);
  if (!formEl) return;
  var ta = formEl.querySelector('textarea');
  var content = (ta.value || '').trim();
  if (!content || content.length < COMMENT_MIN_LENGTH) { toast('댓글이 너무 짧아요.', true); return; }
  if (content.length > COMMENT_MAX_LENGTH)            { toast('댓글이 너무 길어요.', true); return; }
  if (isSpamComment(content))                          { toast('스팸으로 보여요. 내용을 다시 확인해 주세요.', true); return; }
  var now = Date.now();
  var last = _commentLastTime[supaUser.id] || 0;
  if (now - last < COMMENT_COOLDOWN_MS) {
    var wait = Math.ceil((COMMENT_COOLDOWN_MS - (now - last)) / 1000);
    toast(wait + '초 후 다시 시도해 주세요.', true); return;
  }
  var sb = getSupa();
  if (!sb) return;

  // articleId is on the parent row (and we need it for the insert).
  var parentEl = document.getElementById('cm-' + parentId);
  var articleId = (new URLSearchParams(window.location.search)).get('id');

  var payload = {
    article_id:  articleId,
    user_id:     supaUser.id,
    user_name:   supaUser.user_metadata && supaUser.user_metadata.full_name || supaUser.email,
    avatar_url:  supaUser.user_metadata && supaUser.user_metadata.avatar_url || null,
    content:     content,
    parent_id:   parentId
  };
  var res = await sb.from('comments').insert(payload);
  if (res.error) {
    var msg = String(res.error.message || '');
    // parent_id column missing → retry without; user gets a flat comment
    // instead of a hard error so the post isn't lost.
    if (/parent_id/i.test(msg) || /column .* does not exist/i.test(msg)) {
      _khCmFeatures.parentChecked = true;
      _khCmFeatures.parentOk = false;
      delete payload.parent_id;
      res = await sb.from('comments').insert(payload);
    }
  }
  if (res.error) { toast('답글 등록 실패: ' + res.error.message, true); return; }
  _commentLastTime[supaUser.id] = Date.now();
  ta.value = '';
  formEl.setAttribute('hidden', '');
  toast(_khCmFeatures.parentOk ? '답글 등록' : '답글 (단일)');
  loadComments(articleId);
}

// ── Like / dislike toggle ────────────────────────────────────
async function khCmReact(commentId, type) {
  if (!supaUser) { openAuthModal('signin'); return; }
  if (!_khCmFeatures.reactOk) { toast('잠시 후 다시 시도해 주세요.', true); return; }
  var sb = getSupa();
  if (!sb) return;

  // Optimistic: snapshot current state, flip locally, rollback on error.
  var articleId = (new URLSearchParams(window.location.search)).get('id');
  var cache = _khCmReactCache[articleId] = _khCmReactCache[articleId] || { agg: {}, mine: {} };
  var was = cache.mine[commentId] || 0;
  var agg = cache.agg[commentId] = cache.agg[commentId] || { like: 0, dislike: 0 };
  var likeEl    = document.getElementById('cm-like-'    + commentId);
  var dislikeEl = document.getElementById('cm-dislike-' + commentId);
  var rowEl     = document.getElementById('cm-' + commentId);
  var likeBtn    = rowEl && rowEl.querySelector('.cm-react[data-type="like"]');
  var dislikeBtn = rowEl && rowEl.querySelector('.cm-react[data-type="dislike"]');

  function paint() {
    if (likeEl)    likeEl.textContent    = String(agg.like);
    if (dislikeEl) dislikeEl.textContent = String(agg.dislike);
    if (likeBtn)    likeBtn.classList.toggle('on',    cache.mine[commentId] ===  1);
    if (dislikeBtn) dislikeBtn.classList.toggle('on', cache.mine[commentId] === -1);
  }

  // Apply locally first.
  if (was === type) {
    // Toggling off the same reaction.
    if (type === 1) agg.like    = Math.max(0, agg.like    - 1);
    else            agg.dislike = Math.max(0, agg.dislike - 1);
    delete cache.mine[commentId];
  } else {
    if (was === 1)  agg.like    = Math.max(0, agg.like    - 1);
    if (was === -1) agg.dislike = Math.max(0, agg.dislike - 1);
    if (type === 1) agg.like++;
    else            agg.dislike++;
    cache.mine[commentId] = type;
  }
  paint();

  // Persist.
  try {
    if (was === type) {
      var res = await sb.from('comment_reactions')
        .delete()
        .eq('user_id', supaUser.id)
        .eq('comment_id', commentId);
      if (res.error) throw res.error;
    } else {
      var up = await sb.from('comment_reactions')
        .upsert({ user_id: supaUser.id, comment_id: commentId, reaction: type },
                { onConflict: 'user_id,comment_id' });
      if (up.error) throw up.error;
    }
  } catch(e) {
    var msg = String((e && e.message) || e || '');
    // Table missing → flag and silently leave the optimistic UI as-is
    // for the session. Next page load will reset to 0 since fetch will
    // skip the table. Better than throwing a confusing error.
    if (/comment_reactions/i.test(msg) || /relation .* does not exist/i.test(msg)) {
      _khCmFeatures.reactOk = false;
      toast('반응 기능이 아직 준비 중이에요.', true);
    } else {
      toast('반응 저장 실패', true);
      // Best-effort rollback.
      if (was === type) {
        if (type === 1) agg.like++; else agg.dislike++;
        cache.mine[commentId] = type;
      } else {
        if (type === 1) agg.like    = Math.max(0, agg.like    - 1);
        else            agg.dislike = Math.max(0, agg.dislike - 1);
        if (was === 1)  agg.like++;
        if (was === -1) agg.dislike++;
        if (was) cache.mine[commentId] = was; else delete cache.mine[commentId];
      }
      paint();
    }
  }
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
    '이 댓글을 신고할까요?',
    '본인 화면에서 가리고 검토 대기열로 표시됩니다.',
    { okLabel: '신고' }
  );
  if (!ok) return;
  var h = _khHiddenComments();
  h[commentId] = Date.now();
  _khSaveHiddenComments(h);
  toast('신고 완료. 본인 화면에서 가렸습니다.', 'success');
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
  if (/(.)(\1){9,}/.test(text)) return true;
  if ((text.match(/https?:\/\//g) || []).length >= 3) return true;
  if (!/[가-힣a-zA-Z0-9]/.test(text)) return true;
  return false;
}

async function submitComment(articleId) {
  if (!supaUser) { openAuthModal("signin"); return; }
  var input = document.getElementById('comment-input');
  var content = input ? input.value.trim() : '';

  if (!content || content.length < COMMENT_MIN_LENGTH) {
    toast('댓글이 너무 짧아요.', true); return;
  }
  if (content.length > COMMENT_MAX_LENGTH) {
    toast('댓글이 너무 길어요 (최대 ' + COMMENT_MAX_LENGTH + '자).', true); return;
  }
  if (isSpamComment(content)) {
    toast('스팸으로 보여요. 내용을 다시 확인해 주세요.', true); return;
  }
  var now = Date.now();
  var last = _commentLastTime[supaUser.id] || 0;
  if (now - last < COMMENT_COOLDOWN_MS) {
    var wait = Math.ceil((COMMENT_COOLDOWN_MS - (now - last)) / 1000);
    toast(wait + '초 후 다시 시도해 주세요.', true); return;
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

  if (error) { toast('댓글 등록 실패: ' + error.message, true); return; }
  _commentLastTime[supaUser.id] = Date.now();
  input.value = '';
  toast('댓글이 등록되었습니다.');
  loadComments(articleId);
}

async function deleteComment(commentId) {
  if (!supaUser) return;
  var ok = await khConfirm('이 댓글을 삭제할까요?', '되돌릴 수 없어요.', { okLabel: '삭제', destructive: true });
  if (!ok) return;
  var sb = getSupa();
  if (!sb) return;
  var { error } = await sb.from('comments').delete().eq('id', commentId).eq('user_id', supaUser.id);
  if (error) { toast('삭제 실패', true); return; }
  // Reload so any reply tree under it disappears together (CASCADE deletes).
  var articleId = (new URLSearchParams(window.location.search)).get('id');
  if (articleId) loadComments(articleId);
  toast('삭제 완료');
}

// Alias for escapeHTML — single entry point for all HTML escaping
var escapeHtml = escapeHTML;
