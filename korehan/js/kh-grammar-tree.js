/* ============================================================
   KH Grammar Skill Tree  v2
   DOM-based scrollable node list (replaces Canvas v1)
   Native scroll = smooth on mobile. Tap = just works.
   ============================================================ */

(function() {
  'use strict';

  var GT = window.KHGrammarTree = {};
  var OVERLAY_ID = 'gt-overlay';

  var LEVEL_STYLES = {
    Beginner:     { grad: 'linear-gradient(135deg,#064e3b,#065f46)', border: 'rgba(34,197,94,.3)', badge: '#22c55e', text: '#4ade80', emoji: '🌱' },
    Intermediate: { grad: 'linear-gradient(135deg,#451a03,#78350f)', border: 'rgba(245,158,11,.3)', badge: '#f59e0b', text: '#fbbf24', emoji: '🌳' },
    Advanced:     { grad: 'linear-gradient(135deg,#450a0a,#7f1d1d)', border: 'rgba(239,68,68,.3)', badge: '#ef4444', text: '#f87171', emoji: '🌲' }
  };

  var STATE_ICONS = { locked: '🔒', available: '🔓', progress: '📝', mastered: '✅' };

  function _getState(progress, pattern, idx, items) {
    var p = progress[pattern] || {};
    if (p.mastered) return 'mastered';
    if (p.attempts > 0) return 'progress';
    // First node of each level is always available
    if (idx === 0) return 'available';
    // Available if previous node has been attempted
    var prev = items[idx - 1];
    if (prev && (progress[prev.pattern] || {}).attempts > 0) return 'available';
    return 'locked';
  }

  function _ensureOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;
    var el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.className = 'kh-fs-overlay hidden';
    el.onclick = function(e) { if (e.target === el) GT.close(); };
    el.innerHTML =
      '<div class="kh-fs-panel" style="max-width:520px">'
      + '<div class="kh-fs-header">'
      +   '<div style="flex:1"><div style="font-size:15px;font-weight:900;color:#fff">📐 Grammar Skill Tree</div>'
      +   '<div id="gt-stats" style="font-size:11px;color:rgba(255,255,255,.45);margin-top:2px"></div></div>'
      +   '<button class="kh-fs-close" onclick="KHGrammarTree.close()">&#10005;</button>'
      + '</div>'
      + '<div id="gt-body" class="kh-fs-body" style="padding:16px;-webkit-overflow-scrolling:touch"></div>'
      + '</div>';
    document.body.appendChild(el);
  }

  function _render() {
    var body = document.getElementById('gt-body');
    if (!body || typeof GRAMMAR_CURRICULUM === 'undefined') return;

    var progress = typeof _loadGrammarProgress === 'function' ? _loadGrammarProgress() : {};
    var levels = ['Beginner', 'Intermediate', 'Advanced'];
    var mastered = 0;
    var total = GRAMMAR_CURRICULUM.length;
    var html = '';

    levels.forEach(function(level) {
      var ls = LEVEL_STYLES[level];
      var items = GRAMMAR_CURRICULUM.filter(function(g) { return g.level === level; }).sort(function(a, b) { return a.order - b.order; });

      // Level header
      html += '<div style="text-align:center;margin:20px 0 12px">'
        + '<span style="font-size:12px;font-weight:800;color:' + ls.text + ';letter-spacing:.08em;text-transform:uppercase">' + ls.emoji + ' ' + level + '</span>'
        + '</div>';

      items.forEach(function(item, i) {
        var state = _getState(progress, item.pattern, i, items);
        if (state === 'mastered') mastered++;
        var p = progress[item.pattern] || {};
        var isLocked = state === 'locked';
        var canPractice = state === 'available' || state === 'progress';

        // Connector line
        if (i > 0) {
          var prevState = _getState(progress, items[i-1].pattern, i-1, items);
          var lineColor = prevState === 'mastered' ? ls.badge : 'rgba(255,255,255,.08)';
          html += '<div style="display:flex;justify-content:center"><div style="width:2px;height:16px;background:' + lineColor + '"></div></div>';
        }

        // Node card
        html += '<div onclick="' + (canPractice ? 'KHGrammarTree._openNode(' + GRAMMAR_CURRICULUM.indexOf(item) + ')' : '') + '" '
          + 'style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;'
          + 'background:' + (isLocked ? 'rgba(255,255,255,.02)' : ls.grad) + ';'
          + 'border:1px solid ' + (isLocked ? 'rgba(255,255,255,.05)' : ls.border) + ';'
          + 'cursor:' + (canPractice ? 'pointer' : 'default') + ';'
          + 'opacity:' + (isLocked ? '.45' : '1') + ';'
          + 'transition:transform .15s,box-shadow .15s;'
          + (state === 'mastered' ? 'box-shadow:0 0 16px ' + ls.badge + '22;' : '')
          + '"'
          + (canPractice ? ' onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'\'"' : '')
          + '>'
          // Badge
          + '<div style="width:36px;height:36px;border-radius:50%;background:' + (isLocked ? 'rgba(255,255,255,.04)' : ls.badge + '33') + ';'
          + 'border:2px solid ' + (isLocked ? 'rgba(255,255,255,.08)' : ls.badge + '66') + ';'
          + 'display:flex;align-items:center;justify-content:center;flex-shrink:0;'
          + 'font-size:14px;font-weight:900;color:' + (isLocked ? 'rgba(255,255,255,.2)' : ls.text) + '">'
          + item.order + '</div>'
          // Text
          + '<div style="flex:1;min-width:0">'
          + '<div style="font-size:13px;font-weight:800;color:' + (isLocked ? 'rgba(255,255,255,.2)' : '#fff') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + _esc(item.pattern) + '</div>'
          + '<div style="font-size:10px;color:' + (isLocked ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.45)') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px">' + _esc(item.desc || '') + '</div>'
          + (p.attempts > 0 ? '<div style="font-size:9px;color:rgba(255,255,255,.3);margin-top:2px">' + p.correct + '/' + p.attempts + ' correct</div>' : '')
          + '</div>'
          // State icon
          + '<div style="font-size:16px;flex-shrink:0">' + (STATE_ICONS[state] || '') + '</div>'
          + '</div>';
      });
    });

    body.innerHTML = html;

    // Stats
    var stats = document.getElementById('gt-stats');
    if (stats) stats.textContent = mastered + '/' + total + ' mastered';
  }

  GT._openNode = function(curriculumIdx) {
    GT.close();
    if (typeof openGrammarFocusForCurriculum === 'function') {
      openGrammarFocusForCurriculum(curriculumIdx);
    }
  };

  GT.open = function() {
    _ensureOverlay();
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.classList.remove('hidden');
      requestAnimationFrame(function() { overlay.classList.add('active'); });
      if (window.KHCanvas) KHCanvas.hideBottomNav();
    }
    setTimeout(_render, 50);
  };

  GT.close = function() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(function() { overlay.classList.add('hidden'); }, 250);
      if (window.KHCanvas) KHCanvas.showBottomNav();
    }
  };

  function _esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

})();
