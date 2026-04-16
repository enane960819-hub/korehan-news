/* ============================================================
   KH Grammar Skill Tree  v1
   Canvas 2D interactive node graph with zoom/pan
   Depends on: kh-canvas-engine.js (KHCanvas.DPR, AnimLoop, ParticleSystem)
   Uses: GRAMMAR_CURRICULUM, _loadGrammarProgress() from study-room
   ============================================================ */

(function() {
  'use strict';

  var GT = window.KHGrammarTree = {};

  var OVERLAY_ID = 'gt-overlay';
  var _canvas = null;
  var _ctx = null;
  var _w = 0, _h = 0;

  // View transform
  var _scale = 1;
  var _offsetX = 0, _offsetY = 0;
  var _minScale = 0.5, _maxScale = 2.0;

  // Interaction
  var _dragging = false;
  var _dragStartX = 0, _dragStartY = 0;
  var _dragOffsetX = 0, _dragOffsetY = 0;
  var _pinchDist = 0;
  var _dragMoved = false;    // true if finger moved more than threshold
  var _DRAG_THRESHOLD = 8;   // px before drag starts (prevents accidental drag on tap)

  // Node layout
  var _nodes = [];
  var NODE_W = 200, NODE_H = 56;
  var _selectedNode = null;
  var _isMobile = false;

  // Colors per level
  var LEVEL_COLORS = {
    Beginner:     { fill: '#22c55e', border: '#16a34a', bg: 'rgba(34,197,94,.1)',  text: '#4ade80', grad1: '#134e4a', grad2: '#064e3b' },
    Intermediate: { fill: '#f59e0b', border: '#d97706', bg: 'rgba(245,158,11,.1)', text: '#fbbf24', grad1: '#451a03', grad2: '#78350f' },
    Advanced:     { fill: '#ef4444', border: '#dc2626', bg: 'rgba(239,68,68,.1)',  text: '#f87171', grad1: '#450a0a', grad2: '#7f1d1d' }
  };

  var STATE_ICONS = {
    locked: '🔒', available: '🔓', progress: '📝', mastered: '✅'
  };

  // ── Build node positions ──
  function _buildNodes() {
    if (typeof GRAMMAR_CURRICULUM === 'undefined') return;
    var progress = typeof _loadGrammarProgress === 'function' ? _loadGrammarProgress() : {};
    _nodes = [];
    _isMobile = _w < 600;

    var levels = ['Beginner', 'Intermediate', 'Advanced'];

    if (_isMobile) {
      // Mobile: zigzag path (alternating left/right)
      var py = 20;
      var nw = _w * 0.7;
      var leftX = 16;
      var rightX = _w - nw - 16;
      var globalIdx = 0;

      levels.forEach(function(level, li) {
        var items = GRAMMAR_CURRICULUM.filter(function(g) { return g.level === level; }).sort(function(a, b) { return a.order - b.order; });
        // Level separator
        if (li > 0) py += 10;
        items.forEach(function(item, i) {
          var p = progress[item.pattern] || { attempts: 0, correct: 0, mastered: false };
          var state = _getState(p, i, items, progress);
          var isLeft = globalIdx % 2 === 0;
          _nodes.push({
            x: isLeft ? leftX : rightX, y: py, w: nw, h: NODE_H,
            pattern: item.pattern, level: level, order: item.order,
            desc: item.desc, state: state, attempts: p.attempts, correct: p.correct,
            levelIdx: li, orderIdx: i, isHeader: false, globalIdx: globalIdx
          });
          py += NODE_H + 18;
          globalIdx++;
        });
        py += 8;
      });
    } else {
      // Desktop: 3 columns
      var colW = 220, colGap = 30;
      var totalW = colW * 3 + colGap * 2;
      var startX = Math.max(20, (_w - totalW) / 2);

      levels.forEach(function(level, li) {
        var items = GRAMMAR_CURRICULUM.filter(function(g) { return g.level === level; }).sort(function(a, b) { return a.order - b.order; });
        var cx = startX + li * (colW + colGap);
        items.forEach(function(item, i) {
          var p = progress[item.pattern] || { attempts: 0, correct: 0, mastered: false };
          var state = _getState(p, i, items, progress);
          _nodes.push({
            x: cx, y: 70 + i * (NODE_H + 14), w: colW, h: NODE_H,
            pattern: item.pattern, level: level, order: item.order,
            desc: item.desc, state: state, attempts: p.attempts, correct: p.correct,
            levelIdx: li, orderIdx: i, isHeader: false
          });
        });
      });
    }

    // Center view: scroll to first available node
    _offsetX = 0;
    _offsetY = 0;
    var first = _nodes.find(function(n) { return n.state === 'available' || n.state === 'progress'; });
    if (first && !_isMobile) {
      _offsetX = _w / 2 - first.x - first.w / 2;
      _offsetY = Math.max(0, _h / 3 - first.y);
    } else if (first && _isMobile) {
      // On mobile, just scroll to the first available (small offset from top)
      _offsetY = Math.min(0, -first.y + 80);
    }
  }

  function _getState(p, i, items, progress) {
    if (p.mastered) return 'mastered';
    if (p.attempts > 0) return 'progress';
    if (i === 0 || (progress[items[Math.max(0, i - 1)].pattern] || {}).attempts > 0) return 'available';
    return 'locked';
  }

  // ── Draw ──
  function _draw() {
    if (!_ctx) return;
    _ctx.save();
    _ctx.setTransform(1, 0, 0, 1, 0, 0);
    var dpr = KHCanvas.DPR.ratio();
    _ctx.clearRect(0, 0, _w * dpr, _h * dpr);
    _ctx.restore();

    _ctx.save();
    _ctx.translate(_offsetX, _offsetY);
    _ctx.scale(_scale, _scale);

    // Draw level headers
    var levels = ['Beginner', 'Intermediate', 'Advanced'];
    var emojis = ['🌱', '🌳', '🌲'];

    if (!_isMobile) {
      var colW = 220, colGap = 30;
      var totalW = colW * 3 + colGap * 2;
      var startX = Math.max(20, (_w - totalW) / 2);
      levels.forEach(function(level, li) {
        var cx = startX + li * (colW + colGap) + colW / 2;
        var col = LEVEL_COLORS[level];
        _ctx.font = '900 15px sans-serif';
        _ctx.fillStyle = col.text;
        _ctx.textAlign = 'center';
        _ctx.fillText(emojis[li] + ' ' + level, cx, 45);
      });
    }

    // Draw connection lines (curved)
    for (var i = 0; i < _nodes.length - 1; i++) {
      var a = _nodes[i], b = _nodes[i + 1];
      if (a.level !== b.level) continue;
      var active = a.state === 'mastered';
      _ctx.strokeStyle = active ? 'rgba(34,197,94,.35)' : 'rgba(255,255,255,.06)';
      _ctx.lineWidth = active ? 2.5 : 1.5;
      _ctx.beginPath();
      var ax = a.x + a.w / 2, ay = a.y + a.h;
      var bx = b.x + b.w / 2, by = b.y;
      var cpOffset = (by - ay) * 0.35;
      _ctx.moveTo(ax, ay);
      _ctx.bezierCurveTo(ax, ay + cpOffset, bx, by - cpOffset, bx, by);
      _ctx.stroke();
      // Glow on active connections
      if (active) {
        _ctx.strokeStyle = 'rgba(34,197,94,.1)';
        _ctx.lineWidth = 6;
        _ctx.stroke();
      }
    }

    // Draw nodes (rounded rect cards)
    _nodes.forEach(function(n) { _drawNode(n); });

    _ctx.restore();

    // Info panel for selected
    if (_selectedNode) _drawInfoPanel();
  }

  function _drawNode(n) {
    var lc = LEVEL_COLORS[n.level] || LEVEL_COLORS.Beginner;
    var isSelected = _selectedNode === n;
    var isLocked = n.state === 'locked';

    // Card background
    var grad = _ctx.createLinearGradient(n.x, n.y, n.x + n.w, n.y + n.h);
    if (isLocked) {
      grad.addColorStop(0, 'rgba(255,255,255,.02)');
      grad.addColorStop(1, 'rgba(255,255,255,.04)');
    } else {
      grad.addColorStop(0, lc.grad1);
      grad.addColorStop(1, lc.grad2);
    }
    _ctx.fillStyle = grad;
    _ctx.beginPath();
    _ctx.roundRect(n.x, n.y, n.w, n.h, 14);
    _ctx.fill();

    // Border
    _ctx.strokeStyle = isSelected ? '#60a5fa' : (isLocked ? 'rgba(255,255,255,.06)' : lc.border + '44');
    _ctx.lineWidth = isSelected ? 2 : 1;
    _ctx.stroke();

    // Mastered glow
    if (n.state === 'mastered') {
      _ctx.shadowColor = lc.fill;
      _ctx.shadowBlur = 12;
      _ctx.beginPath();
      _ctx.roundRect(n.x, n.y, n.w, n.h, 14);
      _ctx.strokeStyle = lc.fill + '55';
      _ctx.lineWidth = 1;
      _ctx.stroke();
      _ctx.shadowBlur = 0;
    }

    // Left: order badge circle
    var badgeR = 16;
    var bx = n.x + 18 + badgeR;
    var by = n.y + n.h / 2;
    _ctx.beginPath();
    _ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
    _ctx.fillStyle = isLocked ? 'rgba(255,255,255,.05)' : lc.fill + '33';
    _ctx.fill();
    _ctx.strokeStyle = isLocked ? 'rgba(255,255,255,.1)' : lc.fill + '66';
    _ctx.lineWidth = 1.5;
    _ctx.stroke();

    // Order number
    _ctx.font = '900 13px sans-serif';
    _ctx.fillStyle = isLocked ? 'rgba(255,255,255,.2)' : lc.text;
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(n.order, bx, by);

    // Pattern text
    var textX = bx + badgeR + 12;
    _ctx.textAlign = 'left';
    _ctx.font = '800 13px sans-serif';
    _ctx.fillStyle = isLocked ? 'rgba(255,255,255,.2)' : '#fff';
    var maxTextW = n.w - (textX - n.x) - 40;
    _ctx.fillText(_truncate(n.pattern, _ctx, maxTextW), textX, n.y + n.h / 2 - 7);

    // Description (truncated)
    _ctx.font = '400 10px sans-serif';
    _ctx.fillStyle = isLocked ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.45)';
    _ctx.fillText(_truncate(n.desc || '', _ctx, maxTextW), textX, n.y + n.h / 2 + 9);

    // Right: state icon
    _ctx.textAlign = 'center';
    _ctx.font = '14px sans-serif';
    _ctx.fillText(STATE_ICONS[n.state] || '', n.x + n.w - 22, n.y + n.h / 2);
  }

  function _truncate(text, ctx, maxW) {
    if (!text) return '';
    if (ctx.measureText(text).width <= maxW) return text;
    while (text.length > 3 && ctx.measureText(text + '…').width > maxW) text = text.slice(0, -1);
    return text + '…';
  }

  function _drawInfoPanel() {
    var n = _selectedNode;
    var panelW = Math.min(_w - 20, 300);
    var panelH = 90;
    var px = (_w - panelW) / 2;
    var py = _h - panelH - 16;

    // Background
    _ctx.fillStyle = 'rgba(13,27,46,.95)';
    _ctx.beginPath();
    _ctx.roundRect(px, py, panelW, panelH, 14);
    _ctx.fill();
    _ctx.strokeStyle = 'rgba(255,255,255,.1)';
    _ctx.lineWidth = 1;
    _ctx.stroke();

    // Text
    var lc = LEVEL_COLORS[n.level] || LEVEL_COLORS.Beginner;
    _ctx.font = '800 13px sans-serif';
    _ctx.fillStyle = lc.text;
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText(n.pattern, px + 14, py + 12);

    _ctx.font = '400 11px sans-serif';
    _ctx.fillStyle = 'rgba(255,255,255,.55)';
    var desc = n.desc || '';
    if (desc.length > 60) desc = desc.slice(0, 57) + '...';
    _ctx.fillText(desc, px + 14, py + 32);

    // Stats
    var statsText = n.state === 'mastered' ? '✅ Mastered'
      : n.attempts > 0 ? '📊 ' + n.correct + '/' + n.attempts + ' correct'
      : n.state === 'available' ? '🔓 Tap to practice' : '🔒 Locked';
    _ctx.font = '700 11px sans-serif';
    _ctx.fillStyle = n.state === 'mastered' ? '#4ade80' : n.state === 'available' ? '#60a5fa' : 'rgba(255,255,255,.3)';
    _ctx.fillText(statsText, px + 14, py + 52);

    // Practice button hint
    if (n.state === 'available' || n.state === 'progress') {
      _ctx.font = '800 11px sans-serif';
      _ctx.fillStyle = '#2563eb';
      _ctx.textAlign = 'right';
      _ctx.fillText('Practice →', px + panelW - 14, py + 52);
    }
  }

  // ── Hit test (rectangular nodes) ──
  function _hitTest(clientX, clientY) {
    var rect = _canvas.getBoundingClientRect();
    var mx = (clientX - rect.left - _offsetX) / _scale;
    var my = (clientY - rect.top - _offsetY) / _scale;

    for (var i = 0; i < _nodes.length; i++) {
      var n = _nodes[i];
      if (mx >= n.x && mx <= n.x + n.w && my >= n.y && my <= n.y + n.h) return n;
    }
    return null;
  }

  // ── Event handlers ──
  function _onMouseDown(e) {
    var node = _hitTest(e.clientX, e.clientY);
    if (node) {
      _selectedNode = node;
      _draw();
      return;
    }
    _dragging = true;
    _dragStartX = e.clientX;
    _dragStartY = e.clientY;
    _dragOffsetX = _offsetX;
    _dragOffsetY = _offsetY;
  }

  function _onMouseMove(e) {
    if (!_dragging) return;
    _offsetX = _dragOffsetX + (e.clientX - _dragStartX);
    _offsetY = _dragOffsetY + (e.clientY - _dragStartY);
    _draw();
  }

  function _onMouseUp(e) {
    if (_dragging) { _dragging = false; return; }
    // Double-click or click on practice button area
    if (_selectedNode && (_selectedNode.state === 'available' || _selectedNode.state === 'progress')) {
      _openNodePractice(_selectedNode);
    }
  }

  function _onWheel(e) {
    e.preventDefault();
    var delta = e.deltaY > 0 ? 0.9 : 1.1;
    var newScale = Math.max(_minScale, Math.min(_maxScale, _scale * delta));
    var rect = _canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    _offsetX = mx - (mx - _offsetX) * (newScale / _scale);
    _offsetY = my - (my - _offsetY) * (newScale / _scale);
    _scale = newScale;
    _draw();
  }

  // Touch — with drag threshold to separate tap from scroll
  function _onTouchStart(e) {
    if (e.touches.length === 2) {
      _pinchDist = _getPinchDist(e);
      _dragging = false;
      return;
    }
    if (e.touches.length === 1) {
      var t = e.touches[0];
      _dragStartX = t.clientX;
      _dragStartY = t.clientY;
      _dragOffsetX = _offsetX;
      _dragOffsetY = _offsetY;
      _dragging = true;
      _dragMoved = false;
    }
  }

  function _onTouchMove(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      var newDist = _getPinchDist(e);
      var ratio = newDist / (_pinchDist || 1);
      _scale = Math.max(_minScale, Math.min(_maxScale, _scale * ratio));
      _pinchDist = newDist;
      _draw();
      return;
    }
    if (!_dragging || e.touches.length !== 1) return;
    var t = e.touches[0];
    var dx = t.clientX - _dragStartX;
    var dy = t.clientY - _dragStartY;

    // Only start real drag after threshold
    if (!_dragMoved && Math.abs(dx) + Math.abs(dy) < _DRAG_THRESHOLD) return;
    _dragMoved = true;
    e.preventDefault();

    // Mobile: only vertical scroll (lock X)
    if (_isMobile) {
      _offsetY = _dragOffsetY + dy;
    } else {
      _offsetX = _dragOffsetX + dx;
      _offsetY = _dragOffsetY + dy;
    }
    _draw();
  }

  function _onTouchEnd(e) {
    _dragging = false;
    // If finger didn't move = TAP → select node or open practice
    if (!_dragMoved && e.changedTouches && e.changedTouches.length === 1) {
      var t = e.changedTouches[0];
      var node = _hitTest(t.clientX, t.clientY);
      if (node) {
        if (node.state === 'available' || node.state === 'progress') {
          _selectedNode = node;
          _draw();
          // Open practice after brief visual feedback
          setTimeout(function() { _openNodePractice(node); }, 200);
        } else {
          _selectedNode = node;
          _draw();
        }
      }
    }
  }

  function _getPinchDist(e) {
    var dx = e.touches[0].clientX - e.touches[1].clientX;
    var dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ── Open grammar practice for a node ──
  function _openNodePractice(node) {
    GT.close();
    if (typeof openGrammarFocusForCurriculum === 'function') {
      // Find the curriculum index
      var idx = GRAMMAR_CURRICULUM.findIndex(function(g) { return g.pattern === node.pattern; });
      if (idx >= 0) openGrammarFocusForCurriculum(idx);
    }
  }

  // ── Overlay ──
  function _ensureOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;
    var el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.className = 'kh-fs-overlay hidden';
    el.onclick = function(e) { if (e.target === el) GT.close(); };
    el.innerHTML =
      '<div class="kh-fs-panel" style="max-width:900px;max-height:95vh">'
      + '<div class="kh-fs-header">'
      +   '<div style="flex:1"><div style="font-size:15px;font-weight:900;color:#fff">📐 Grammar Skill Tree</div>'
      +   '<div id="gt-stats" style="font-size:11px;color:rgba(255,255,255,.45);margin-top:2px"></div></div>'
      +   '<button class="kh-fs-close" onclick="KHGrammarTree.close()">&#10005;</button>'
      + '</div>'
      + '<div style="flex:1;overflow:hidden;position:relative">'
      +   '<canvas id="gt-canvas" style="width:100%;height:100%;display:block;cursor:grab"></canvas>'
      + '</div>'
      + '</div>';
    document.body.appendChild(el);
  }

  // ── Public API ──
  GT.open = function() {
    _ensureOverlay();
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.classList.remove('hidden');
      requestAnimationFrame(function() { overlay.classList.add('active'); });
      KHCanvas.hideBottomNav();
    }

    _selectedNode = null;
    _scale = 1;
    _offsetX = 0;
    _offsetY = 0;

    // Setup canvas — delay to ensure overlay has rendered with dimensions
    setTimeout(function() {
      _canvas = document.getElementById('gt-canvas');
      if (!_canvas) return;
      var parent = _canvas.parentElement;
      var rect = parent.getBoundingClientRect();
      _w = rect.width || window.innerWidth;
      _h = rect.height || (window.innerHeight - 100);
      if (_h < 200) _h = window.innerHeight - 100; // fallback
      _ctx = KHCanvas.DPR.setup(_canvas, _w, _h);

      _canvas.addEventListener('mousedown', _onMouseDown);
      _canvas.addEventListener('mousemove', _onMouseMove);
      _canvas.addEventListener('mouseup', _onMouseUp);
      _canvas.addEventListener('wheel', _onWheel, { passive: false });
      _canvas.addEventListener('touchstart', _onTouchStart, { passive: false });
      _canvas.addEventListener('touchmove', _onTouchMove, { passive: false });
      _canvas.addEventListener('touchend', _onTouchEnd);

      _buildNodes();
      _draw();

      // Stats
      var stats = document.getElementById('gt-stats');
      if (stats) {
        var mastered = _nodes.filter(function(n) { return n.state === 'mastered'; }).length;
        stats.textContent = mastered + '/' + _nodes.length + ' mastered';
      }
    }, 150);
  };

  GT.close = function() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(function() { overlay.classList.add('hidden'); }, 250);
    KHCanvas.showBottomNav();
    }
    if (_canvas) {
      _canvas.removeEventListener('mousedown', _onMouseDown);
      _canvas.removeEventListener('mousemove', _onMouseMove);
      _canvas.removeEventListener('mouseup', _onMouseUp);
      _canvas.removeEventListener('wheel', _onWheel);
      _canvas.removeEventListener('touchstart', _onTouchStart);
      _canvas.removeEventListener('touchmove', _onTouchMove);
      _canvas.removeEventListener('touchend', _onTouchEnd);
    }
  };

})();
