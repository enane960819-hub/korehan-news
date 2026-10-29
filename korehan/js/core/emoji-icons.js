/* ============================================================
   KoreHani — emoji → Lucide icon converter
   Self-contained so pages without korehan-shared.js (admin CMS,
   onboarding) get it too. Draws icons with renderKhLucideIcons() when
   korehan-shared.js is present, otherwise loads Lucide itself.
   ============================================================ */
// Owner: no emojis anywhere in the UI. Rather than hand-edit ~2,000
// literals (many come from the DB: badges, shop items, room items,
// netizen comments), every rendered text node is scanned and each emoji
// is swapped for the matching Lucide icon, sized to the surrounding
// text (1em). Unknown emojis are dropped. Plain-text-only spots (title /
// placeholder / aria-label attributes, <option>, toasts) get the emoji
// stripped instead. Typographic marks (✓ ✕ ★ ☆ ♪) are not emojis and stay.
var KH_EMOJI_ICON = {"✅":"circle-check","⏳":"hourglass","🤖":"bot","💬":"message-circle","⚠":"triangle-alert","📝":"notebook-pen","❌":"circle-x","📚":"library","✨":"sparkles","📰":"newspaper","💾":"save","🔥":"flame","🔄":"refresh-cw","💡":"lightbulb","📖":"book-open","✏":"pencil","🎯":"target","🔊":"volume-2","⭐":"star","🗑":"trash-2","🎉":"party-popper","🌱":"sprout","🌳":"tree-deciduous","✍":"pen-line","🔍":"search","📋":"clipboard-list","🧠":"brain","🌲":"tree-pine","📅":"calendar","🎭":"drama","🌿":"leaf","🔖":"bookmark","📊":"chart-column","🏆":"trophy","🔒":"lock","🎤":"mic","⚡":"zap","💪":"dumbbell","⏰":"alarm-clock","🧩":"puzzle","🎧":"headphones","🖼":"image","👥":"users","🌍":"globe","🚀":"rocket","😱":"frown","🇰🇷":"flag","💼":"briefcase","🎬":"clapperboard","📄":"file-text","🌧":"cloud-rain","☕":"coffee","🎙":"mic","📨":"inbox","🚩":"flag","🔁":"repeat","❤":"heart","✈":"plane","🌐":"globe","⚙":"settings","🎨":"palette","📷":"camera","🐾":"paw-print","🏅":"medal","🍜":"soup","🛍":"shopping-bag","🎮":"gamepad-2","📥":"inbox","🏠":"house","🌸":"flower-2","🔢":"hash","👁":"eye","😅":"smile","🏥":"hospital","🧭":"compass","📓":"notebook","🔧":"wrench","🔑":"key-round","📌":"pin","📜":"scroll-text","📁":"folder","🌨":"cloud-snow","🎌":"flag","🗂":"folder-open","😊":"smile","💸":"banknote","🏛":"landmark","🔴":"circle-dot","🔗":"link","📐":"ruler","🗣":"speech","💄":"sparkles","📬":"mailbox","👤":"user","💳":"credit-card","🔎":"search","📺":"tv","🎵":"music","🎓":"graduation-cap","🌰":"nut","⏹":"square","☀":"sun","🎁":"gift","❄":"snowflake","⛈":"cloud-lightning","🙈":"eye-off","👀":"eye","👍":"thumbs-up","👆":"pointer","⭕":"circle","🤤":"smile","🐶":"dog","😤":"angry","🥵":"thermometer-sun","🗺":"map","🏗":"construction","📦":"package","🪶":"feather","📞":"phone","🌟":"star","🔬":"microscope","🚨":"siren","💕":"heart","🪙":"coins","🌊":"waves","💎":"gem","👑":"crown","🌦":"cloud-sun-rain","😌":"smile","🚕":"car-taxi-front","🏪":"store","📱":"smartphone","📘":"book","🔀":"shuffle","✉":"mail","📇":"contact","🚇":"train-front","⚽":"volleyball","🏫":"school","💵":"banknote","📂":"folder-open","🏙":"building-2","🎥":"video","➕":"plus","🛡":"shield","📈":"trending-up","🏃":"footprints","🦊":"cat","🎞":"film","❓":"circle-help","🚫":"ban","🎲":"dices","🪄":"wand-sparkles","😂":"laugh","🐯":"cat","🔮":"sparkles","💚":"heart","🗞":"newspaper","🌙":"moon","🌅":"sunrise","🌃":"moon-star","🗓":"calendar-days","📍":"map-pin","⛔":"ban","⏸":"pause","📔":"notebook","💖":"heart","👩":"user","👨":"user","👋":"hand","📸":"camera","🌤":"cloud-sun","🌫":"cloud-fog","🔤":"type","🏁":"flag","😵":"frown","😓":"frown","⏭":"skip-forward","😭":"frown","😳":"meh","🚔":"siren","👩‍🏫":"school","🆕":"badge-plus","🗨":"message-square","⏱":"timer","📭":"mailbox","🏷":"tag","📤":"send","💻":"laptop","📻":"radio","📡":"radio-tower","🔌":"plug","🟧":"square","👗":"shirt","🪞":"sparkles","🧳":"luggage","🍲":"soup","🥺":"frown","🤝":"handshake","🤯":"brain","🧐":"search","🎣":"fish","🐼":"paw-print","👯":"users","🛎":"bell","🌏":"globe","🧚":"sparkles","⚔":"swords","🧙":"wand-sparkles","🥹":"smile","😮":"meh","🗄":"archive","🖊":"pen","🗃":"archive","🔭":"telescope","🍃":"leaf","💠":"diamond","🧬":"dna","💯":"badge-check","💹":"trending-up","🏘":"house","💫":"sparkles","🌠":"sparkles","🌌":"sparkles","🎂":"cake","🎒":"backpack","🎆":"sparkles","🎑":"moon","🌕":"moon","💘":"heart","🎄":"tree-pine","🧋":"cup-soda","🍁":"leaf","🤍":"heart","👫":"users","👧":"user","🛒":"shopping-cart","💌":"mail","👨‍👩‍👧":"users","👨‍💼":"briefcase","🧪":"flask-conical","🔨":"hammer","⛅":"cloud-sun","☁":"cloud","🌡":"thermometer","🕐":"clock","🌈":"rainbow","🏰":"castle","🍀":"clover","🎪":"tent","🪐":"orbit","🛋":"sofa","🪴":"sprout","💊":"pill","🪪":"id-card","🕶":"glasses","🗡":"sword","👂":"ear","🔓":"lock-open","🔠":"type","🔟":"hash","🙇":"hand-heart","💭":"message-circle-more","🈶":"badge","🤔":"circle-help","💰":"coins","🙏":"hand-heart","⚖":"scale","😄":"smile","📧":"mail","🎩":"sparkles","🗻":"mountain-snow","🗳":"vote","⛰":"mountain","🐦":"bird","🐄":"beef","🐴":"rabbit","💧":"droplet","🌬":"wind","🌝":"moon","🛣":"route","🤲":"hand-heart","🫂":"heart-handshake","🃏":"layers","⌚":"watch","⌛":"hourglass","⏩":"fast-forward","⏺":"circle-dot"};
var KH_EMOJI_RE = /(?:[\u{1F1E6}-\u{1F1FF}]{2}|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}⭐⭕⌚⌛⏩-⏺‼⁉]️?(?:‍[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]️?)*)/gu;
var KH_EMOJI_KEEP = { '✓':1, '✔':1, '✕':1, '✗':1, '✘':1, '★':1, '☆':1, '♪':1, '♫':1, '✦':1, '☰':1 };
function _khEmojiName(e) {
  var k = e.replace(/️/g, '');
  if (KH_EMOJI_ICON[k]) return KH_EMOJI_ICON[k];
  var first = Array.from(k)[0];
  return KH_EMOJI_ICON[first] || '';
}
function khStripEmoji(s) {
  if (s == null) return s;
  return String(s).replace(KH_EMOJI_RE, function(e) { return KH_EMOJI_KEEP[e.replace(/️/g, '')] ? e : ''; })
    .replace(/[ \t]{2,}/g, ' ').replace(/^\s+/, function(m) { return m.indexOf('\n') >= 0 ? m : ''; });
}
var _khEmoSkip = { SCRIPT:1, STYLE:1, TEXTAREA:1, INPUT:1, NOSCRIPT:1, TITLE:1, svg:1, SVG:1 };
var _khEmoIconsPending = false;
var KH_EMO_LUCIDE_SRC = 'https://cdn.jsdelivr.net/npm/lucide@0.468.0/dist/umd/lucide.min.js';
function _khEmoDraw() {
  if (typeof renderKhLucideIcons === 'function') { renderKhLucideIcons(); return; }
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ attrs: { 'stroke-width': 1.9 } });
    return;
  }
  if (document.querySelector('script[data-kh-lucide]')) {
    document.querySelector('script[data-kh-lucide]').addEventListener('load', _khEmoDraw, { once: true });
    return;
  }
  var sc = document.createElement('script');
  sc.src = KH_EMO_LUCIDE_SRC; sc.defer = true; sc.setAttribute('data-kh-lucide', '1');
  sc.onload = _khEmoDraw;
  document.head.appendChild(sc);
}
function _khEmoQueueIcons() {
  if (_khEmoIconsPending) return;
  _khEmoIconsPending = true;
  setTimeout(function() { _khEmoIconsPending = false; _khEmoDraw(); }, 30);
}
function _khEmoTextNode(tn) {
  var txt = tn.nodeValue;
  if (!txt || !KH_EMOJI_RE.test(txt)) { KH_EMOJI_RE.lastIndex = 0; return; }
  KH_EMOJI_RE.lastIndex = 0;
  var p = tn.parentNode;
  if (!p || _khEmoSkip[p.nodeName] || (p.closest && p.closest('[contenteditable="true"],.kh-keep-emoji,svg'))) return;
  if (p.nodeName === 'OPTION') { tn.nodeValue = khStripEmoji(txt); return; }
  var frag = document.createDocumentFragment(), last = 0, m, changed = false;
  KH_EMOJI_RE.lastIndex = 0;
  while ((m = KH_EMOJI_RE.exec(txt))) {
    var e = m[0];
    if (KH_EMOJI_KEEP[e.replace(/️/g, '')]) continue;
    changed = true;
    if (m.index > last) frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
    var name = _khEmojiName(e);
    var after = txt.slice(m.index + e.length);
    if (name) {
      var i = document.createElement('i');
      i.setAttribute('data-lucide', name);
      i.className = 'kh-ui-icon kh-emo-ico';
      i.setAttribute('aria-hidden', 'true');
      frag.appendChild(i);
      last = m.index + e.length;
    } else {
      // Dropped emoji: also eat one following space so text doesn't start with a gap.
      last = m.index + e.length + (after.charAt(0) === ' ' ? 1 : 0);
    }
  }
  KH_EMOJI_RE.lastIndex = 0;
  if (!changed) return;
  if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
  p.replaceChild(frag, tn);
  _khEmoQueueIcons();
}
function _khEmoAttrs(el) {
  ['title', 'placeholder', 'aria-label', 'alt'].forEach(function(a) {
    var v = el.getAttribute && el.getAttribute(a);
    if (v && KH_EMOJI_RE.test(v)) {
      // Kept symbols (✓ ★ …) still match the regex; writing an unchanged
      // value re-fired the attribute observer forever and froze the tab.
      var nv = khStripEmoji(v);
      if (nv !== v) el.setAttribute(a, nv);
    }
    KH_EMOJI_RE.lastIndex = 0;
  });
}
function khEmojiToIcons(root) {
  if (!root) return;
  if (root.nodeType === 3) { _khEmoTextNode(root); return; }
  if (root.nodeType !== 1 || _khEmoSkip[root.nodeName]) return;
  _khEmoAttrs(root);
  var withAttrs = root.querySelectorAll ? root.querySelectorAll('[title],[placeholder],[aria-label],[alt]') : [];
  for (var a = 0; a < withAttrs.length; a++) _khEmoAttrs(withAttrs[a]);
  var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, list = [];
  while ((n = w.nextNode())) { if (KH_EMOJI_RE.test(n.nodeValue)) list.push(n); KH_EMOJI_RE.lastIndex = 0; }
  for (var k = 0; k < list.length; k++) _khEmoTextNode(list[k]);
}
(function() {
  // Sizing lives here (not in a stylesheet) so pages without
  // korehan-shared.css get it too.
  try {
    var st = document.createElement('style');
    st.textContent = '.kh-emo-ico{display:inline-block;width:1.05em;height:1.05em;vertical-align:-0.16em;flex-shrink:0}svg.kh-emo-ico{stroke-width:2}';
    (document.head || document.documentElement).appendChild(st);
  } catch (_) {}
  function start() {
    if (!document.body || window._khEmoObserver) return;
    khEmojiToIcons(document.body);
    if (document.title) document.title = khStripEmoji(document.title);
    window._khEmoObserver = new MutationObserver(function(muts) {
      for (var i = 0; i < muts.length; i++) {
        var mu = muts[i];
        if (mu.type === 'characterData') { _khEmoTextNode(mu.target); continue; }
        if (mu.type === 'attributes') { _khEmoAttrs(mu.target); continue; }
        for (var j = 0; j < mu.addedNodes.length; j++) {
          var an = mu.addedNodes[j];
          khEmojiToIcons(an);
          // Any freshly injected <i data-lucide> gets drawn too, so dynamic
          // markup no longer needs its own renderKhLucideIcons() call.
          if (an.nodeType === 1 && (an.matches('i[data-lucide]') || an.querySelector('i[data-lucide]'))) _khEmoQueueIcons();
        }
      }
    });
    window._khEmoObserver.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'aria-label'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

