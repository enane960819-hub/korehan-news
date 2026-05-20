/* ============================================================
   KoreHani — Inline SVG icon constants
   Extracted from korehan-shared.js (was lines 506-530).
   Used inside dynamically-injected innerHTML where calling
   lucide.createIcons() afterwards isn't practical. Sized via the
   wrapping element's width/height; color comes from currentColor.
   ============================================================ */

var KH_ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="5 12 10 17 19 7"/></svg>';
var KH_ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>';
var KH_ICON_LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>';
var KH_ICON_EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
var KH_ICON_SPARKLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></svg>';
var KH_ICON_PAW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="14" r="2"/><circle cx="4" cy="14" r="2"/><circle cx="6" cy="8" r="2"/><path d="M8 16c0-3 2-4 4-4s4 1 4 4-2 6-4 6-4-3-4-6z"/></svg>';
var KH_ICON_LIBRARY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4v16M9 4v16"/><path d="M13 4l5 1.3L15.5 19l-5-1.3z"/></svg>';
var KH_ICON_NEWSPAPER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5a2 2 0 0 1 2-2h12v18H5a2 2 0 0 1-2-2z"/><path d="M17 7h4v12a2 2 0 0 1-2 2"/><path d="M7 7h6M7 11h6M7 15h6"/></svg>';
var KH_ICON_BOOK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 0-2 2z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H19"/></svg>';
var KH_ICON_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></svg>';
var KH_ICON_VOLUME = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5L6 9H2v6h4l5 4z"/><path d="M16 8a4 4 0 0 1 0 8"/><path d="M19 5a8 8 0 0 1 0 14"/></svg>';
var KH_ICON_REFRESH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 4v4h-4"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 20v-4h4"/></svg>';
var KH_ICON_PARTY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21l4-12 8 8z"/><path d="M14 4c0 2 2 2 2 4"/><path d="M18 7c0 2 2 2 2 4"/><path d="M11 3l1 1"/><path d="M20 14l1 1"/><path d="M16 13l1 1"/></svg>';
var KH_ICON_TROPHY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a2 2 0 0 0 3 3.5"/><path d="M17 6h3a2 2 0 0 1-3 3.5"/><path d="M9 14h6l-1 4h-4z"/><path d="M8 21h8"/></svg>';
var KH_ICON_FLAME = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c1 4 4 5 4 9a4 4 0 0 1-8 0c0-1.5.7-2.5 1.5-3.5C10.5 7 11 5 12 3z"/><path d="M10.5 14c.4 1 1 1.6 1.5 1.6s1.1-.6 1.5-1.6"/></svg>';
var KH_ICON_THUMBS_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 11v9H4v-9z"/><path d="M7 11l4-7c1.5 0 2.5 1 2.5 2.5V11h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.3 21H7"/></svg>';
var KH_ICON_TARGET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="3"/></svg>';
var KH_ICON_PENCIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4.5l5 5L8 21H3v-5z"/><path d="M13 6l5 5"/></svg>';
var KH_ICON_RULER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 3H3v18h7"/><path d="M3 8h18"/><path d="M16 14l-4 8 8-4z"/></svg>';
var KH_ICON_BULB = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6.5 6.5 0 0 0-4 11.6c.7.6 1 1.2 1 2V16h6v-.4c0-.8.3-1.4 1-2A6.5 6.5 0 0 0 12 3z"/></svg>';
var KH_ICON_WARNING = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4l9 16H3z"/><path d="M12 10v5"/><circle cx="12" cy="18" r=".8" fill="currentColor"/></svg>';
var KH_ICON_HAND_WAVE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 5l-1 4M9 4l1 5M6 11s.5-3.5 3-5M5 17s-2-3 0-7"/><path d="M9 20s3-1 4.5-3.5S15 13 16 13c.6 0 1.5.5 1 1.5"/><path d="M11 14s1.5-2 3-2 1.5 1.5 1.5 1.5"/></svg>';

// ── Playground game-UI icons (added 2026-05-20, PR #7S) ──
// Used by korehan-fun-*.html to replace the previous emoji-heavy
// title bars / stats / category labels with neutral, game-styled
// vector icons. All inherit currentColor so they match each game's
// theme tint when wrapped in a colored container.
var KH_ICON_CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>';
var KH_ICON_HEART = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.5s-7-4.6-9.2-9A5 5 0 0 1 12 6a5 5 0 0 1 9.2 5.5C19 15.9 12 20.5 12 20.5z"/></svg>';
var KH_ICON_CARDS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="6" width="10" height="14" rx="1.8" transform="rotate(-8 9 13)"/><rect x="10" y="4" width="10" height="14" rx="1.8" transform="rotate(8 15 11)"/></svg>';
var KH_ICON_HEADPHONES = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.2"/><rect x="17" y="14" width="4" height="6" rx="1.2"/></svg>';
var KH_ICON_BLOCKS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>';
var KH_ICON_SWORDS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/><path d="M9.5 17.5L21 6V3h-3L6.5 14.5"/><path d="M5 14l-2 2 3 3 2-2"/></svg>';
var KH_ICON_GAMEPAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 19a4 4 0 0 1-4-4l1-5a4 4 0 0 1 4-3h10a4 4 0 0 1 4 3l1 5a4 4 0 0 1-4 4c-1.5 0-2.5-1.5-3-2.5h-6C8 18 7 19 6 19z"/><line x1="7" y1="11" x2="7" y2="14"/><line x1="5.5" y1="12.5" x2="8.5" y2="12.5"/><circle cx="15.5" cy="12" r=".8" fill="currentColor"/><circle cx="17.5" cy="14" r=".8" fill="currentColor"/></svg>';
var KH_ICON_MUSIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="2.5"/><circle cx="17" cy="16" r="2.5"/></svg>';
var KH_ICON_MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="21"/><line x1="9" y1="21" x2="15" y2="21"/></svg>';
var KH_ICON_UTENSILS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3v8a2 2 0 0 0 2 2v8"/><path d="M10 3v8M6 3v3"/><path d="M16 3c-2 0-3 2-3 5s1 5 3 5v8"/></svg>';
var KH_ICON_COFFEE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M17 12h2a2 2 0 0 1 0 4h-2"/><path d="M7 5c0-1 1-1 1-2M11 5c0-1 1-1 1-2M15 5c0-1 1-1 1-2"/></svg>';
var KH_ICON_CAMERA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="4"/></svg>';
var KH_ICON_SHOPPING_BAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1.5 11a2 2 0 0 1-2 1.7H8.5a2 2 0 0 1-2-1.7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>';
var KH_ICON_FILM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="8" y1="4" x2="8" y2="20"/><line x1="16" y1="4" x2="16" y2="20"/></svg>';
var KH_ICON_CROWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l3 9h12l3-9-5 3-4-6-4 6z"/></svg>';
var KH_ICON_STAR = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 3 14.5 9 21 9.6 16 14 17.5 21 12 17.5 6.5 21 8 14 3 9.6 9.5 9"/></svg>';
var KH_ICON_DICE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="16" cy="8" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="8" cy="16" r="1.2" fill="currentColor"/><circle cx="16" cy="16" r="1.2" fill="currentColor"/></svg>';
var KH_ICON_QUESTION = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 1.7-2.5 3.5"/><circle cx="12" cy="16.5" r=".8" fill="currentColor"/></svg>';
var KH_ICON_SCROLL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5a2 2 0 0 1 2-2h11v14H7a2 2 0 0 0-2 2z"/><path d="M18 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2"/></svg>';
var KH_ICON_FERRIS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="11" r="8"/><line x1="12" y1="3" x2="12" y2="19"/><line x1="4" y1="11" x2="20" y2="11"/><line x1="6" y1="6" x2="18" y2="16"/><line x1="6" y1="16" x2="18" y2="6"/><path d="M5 21h14"/></svg>';
var KH_ICON_BRIDGE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 14c4 0 4-4 10-4s6 4 10 4"/><line x1="2" y1="18" x2="22" y2="18"/><line x1="5" y1="14" x2="5" y2="18"/><line x1="19" y1="14" x2="19" y2="18"/></svg>';
var KH_ICON_DUMPLING = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 14c0-5 4-8 9-8s9 3 9 8H3z"/><path d="M6 14c1 1 2 1 3 0M11 14c1 1 2 1 3 0M16 14c1 1 2 1 2 0"/></svg>';
var KH_ICON_BOWL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M7 7c0-1 1-1 1-2M12 7c0-1 1-1 1-2"/></svg>';
var KH_ICON_CHICKEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 5a4 4 0 1 1-6.5 4.5L4 13l3 3 3-3a4 4 0 0 0 3.5-8z"/><line x1="11" y1="12" x2="20" y2="21"/></svg>';
var KH_ICON_STAGE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18h18"/><path d="M5 18l2-6h10l2 6"/><path d="M9 12V8a3 3 0 0 1 6 0v4"/></svg>';

// Convenience wrapper: returns a sized inline-flex span containing the
// SVG from KH_ICON_<NAME>. Use inside dynamic innerHTML strings to swap
// out emojis (e.g. khSvg('cards', {size:22}) instead of '🃏'). Static
// HTML can paste the raw KH_ICON_* SVG inline with its own wrapper.
//   khSvg('trophy')                    → 20px, currentColor
//   khSvg('flame', {size:14})          → 14px
//   khSvg('heart', {size:18, color:'#f87171', marginRight:6})
function khSvg(name, opts) {
  opts = opts || {};
  var sz = opts.size || 20;
  var color = opts.color || 'currentColor';
  var mr = opts.marginRight != null ? opts.marginRight : 0;
  var va = opts.verticalAlign || 'middle';
  var icon = window['KH_ICON_' + String(name).toUpperCase()];
  if (!icon) return '';
  return '<span style="display:inline-flex;align-items:center;justify-content:center;'
    + 'width:' + sz + 'px;height:' + sz + 'px;vertical-align:' + va + ';'
    + 'color:' + color + ';margin-right:' + mr + 'px;flex-shrink:0">'
    + icon + '</span>';
}
