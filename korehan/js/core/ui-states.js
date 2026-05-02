/* ============================================================
   KoreHani — Loading / skeleton / empty-state HTML builders
   Extracted from korehan-shared.js (was lines 2273-2293, 2493-2511).
   Depends on _khEsc() (defined in korehan-shared.js, resolved at
   runtime via global scope).

   Call-sites used to scatter ad-hoc "Loading..." markup everywhere
   which meant bare gray text when an API stalled and no retry path
   when it failed. These helpers produce the same visual everywhere
   so a skeleton here looks like a skeleton there, and the error
   state always offers the user an explicit retry instead of asking
   them to refresh the whole page.
   ============================================================ */

function khLoadingHTML(label, sub) {
  return '<div class="kh-loading">'
    +   '<div class="kh-loading-spinner" aria-hidden="true"></div>'
    +   '<div class="kh-loading-text">' + _khEsc(label || 'Loading…') + '</div>'
    +   (sub ? '<div class="kh-loading-sub">' + _khEsc(sub) + '</div>' : '')
    + '</div>';
}

function khSkeletonHTML(opts) {
  opts = opts || {};
  var rows = opts.rows || 3;
  var gap = opts.gap || 10;
  var h = opts.lineHeight || 14;
  var parts = ['<div style="padding:' + (opts.padding || '12px 4px') + '">'];
  for (var i = 0; i < rows; i++) {
    var w = i === rows - 1 ? '60%' : '100%';
    parts.push('<div class="kh-skeleton" style="height:' + h + 'px;width:' + w + ';margin-bottom:' + gap + 'px"></div>');
  }
  parts.push('</div>');
  return parts.join('');
}

// Render an empty-or-error state. Usage:
//   el.innerHTML = khEmptyState({
//     title: 'Nothing to show yet',
//     sub:   'Read an article to see your vocabulary here.',
//     action: { label: 'Browse articles', onClick: 'location.href=\'/\'' },
//   });
// onClick is an inline attribute string so this works cleanly when
// injected via innerHTML without needing to re-wire event listeners
// on re-render. Pass { error: true } to style it red for failure.
function khEmptyState(opts) {
  opts = opts || {};
  var html = '<div class="kh-empty' + (opts.error ? ' error' : '') + '">';
  if (opts.title) html += '<div class="kh-empty-title">' + _khEsc(opts.title) + '</div>';
  if (opts.sub)   html += '<div class="kh-empty-sub">'   + _khEsc(opts.sub)   + '</div>';
  if (opts.action) {
    var cls = opts.action.variant === 'secondary' ? 'kh-empty-action secondary' : 'kh-empty-action';
    html += '<button class="' + cls + '" onclick="' + _khEsc(opts.action.onClick || '') + '">'
         + _khEsc(opts.action.label || 'Try again')
         + '</button>';
  }
  if (opts.secondaryAction) {
    html += '<button class="kh-empty-action secondary" style="margin-top:4px" onclick="' + _khEsc(opts.secondaryAction.onClick || '') + '">'
         + _khEsc(opts.secondaryAction.label || '')
         + '</button>';
  }
  html += '</div>';
  return html;
}
