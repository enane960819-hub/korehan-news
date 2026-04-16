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

  // Node layout
  var _nodes = []; // [{x, y, pattern, level, order, state, desc}]
  var NODE_R = 22;
  var _selectedNode = null;

  // Colors per level
  var LEVEL_COLORS = {
    Beginner:     { fill: '#22c55e', border: '#16a34a', bg: 'rgba(34,197,94,.15)', text: '#4ade80' },
    Intermediate: { fill: '#f59e0b', border: '#d97706', bg: 'rgba(245,158,11,.15)', text: '#fbbf24' },
    Advanced:     { fill: '#ef4444', border: '#dc2626', bg: 'rgba(239,68,68,.15)', text: '#f87171' }
  };

  // State colors
  var STATE = {
    locked:   { fill: 'rgba(255,255,255,.06)', border: 'rgba(255,255,255,.12)', text: 'rgba(255,255,255,.25)' },
    available:{ fill: 'rgba(37,99,235,.15)',    border: '#2563eb',               text: '#60a5fa' },
    progress: { fill: 'rgba(37,99,235,.3)',     border: '#3b82f6',               text: '#93c5fd' },
    mastered: { fill: 'rgba(34,197,94,.2)',     border: '#22c55e',               text: '#4ade80' }
  };

  // ── Build node positions ──
  function _buildNodes() {
    if (typeof GRAMMAR_CURRICULUM === 'undefined') return;
    var progress = typeof _loadGrammarProgress === 'function' ? _loadGrammarProgress() : {};
    _nodes = [];

    var levels = ['Beginner', 'Intermediate', 'Advanced'];
    var colWidth = 280;
    var rowHeight = 60;
    var startY = 60;

    levels.forEach(function(level, li) {
      var items = GRAMMAR_CURRICULUM.filter(function(g) { return g.level === level; }).sort(function(a, b) { return a.order - b.order; });
      var startX = 80 + li * colWidth;

      items.forEach(function(item, i) {
        var p = progress[item.pattern] || { attempts: 0, correct: 0, mastered: false };
        var state = 'locked';
        if (p.mastered) state = 'mastered';
        else if (p.attempts > 0) state = 'progress';
        else if (i === 0 || (progress[items[Math.max(0, i - 1)].pattern] || {}).attempts > 0) state = 'available';

        _nodes.push({
          x: startX,
          y: startY + i * rowHeight,
          pattern: item.pattern,
          level: level,
          order: item.order,
          desc: item.desc,
          state: state,
          attempts: p.attempts,
          correct: p.correct,
          levelIdx: li,
          orderIdx: i
        });
      });
    });

    // Center view on first available or last mastered
    var first = _nodes.find(function(n) { return n.state === 'available' || n.state === 'progress'; });
    if (first) {
      _offsetX = _w / 2 - first.x;
      _offsetY = _h / 3 - first.y;
    }
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
    levels.forEach(function(level, li) {
      var x = 80 + li * 280;
      var col = LEVEL_COLORS[level];
      _ctx.font = '800 14px sans-serif';
      _ctx.fillStyle = col.text;
      _ctx.textAlign = 'center';
      _ctx.fillText(emojis[li] + ' ' + level, x, 35);
    });

    // Draw connections
    for (var i = 0; i < _nodes.length - 1; i++) {
      var a = _nodes[i], b = _nodes[i + 1];
      if (a.level !== b.level) continue; // no cross-level lines
      var both = a.state === 'mastered' && (b.state === 'mastered' || b.state === 'progress' || b.state === 'available');
      _ctx.strokeStyle = both ? 'rgba(34,197,94,.3)' : 'rgba(255,255,255,.06)';
      _ctx.lineWidth = 2;
      _ctx.beginPath();
      _ctx.moveTo(a.x, a.y + NODE_R);
      _ctx.lineTo(b.x, b.y - NODE_R);
      _ctx.stroke();
    }

    // Draw nodes
    _nodes.forEach(function(n) {
      var s = STATE[n.state] || STATE.locked;
      var isSelected = _selectedNode === n;

      // Glow for mastered
      if (n.state === 'mastered') {
        _ctx.beginPath();
        _ctx.arc(n.x, n.y, NODE_R + 6, 0, Math.PI * 2);
        _ctx.fillStyle = 'rgba(34,197,94,.08)';
        _ctx.fill();
      }

      // Selected highlight
      if (isSelected) {
        _ctx.beginPath();
        _ctx.arc(n.x, n.y, NODE_R + 4, 0, Math.PI * 2);
        _ctx.strokeStyle = '#60a5fa';
        _ctx.lineWidth = 2;
        _ctx.stroke();
      }

      // Node circle
      _ctx.beginPath();
      _ctx.arc(n.x, n.y, NODE_R, 0, Math.PI * 2);
      _ctx.fillStyle = s.fill;
      _ctx.fill();
      _ctx.strokeStyle = s.border;
      _ctx.lineWidth = 2;
      _ctx.stroke();

      // Order number
      _ctx.font = '900 12px sans-serif';
      _ctx.fillStyle = s.text;
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(n.order, n.x, n.y);

      // Mastered check
      if (n.state === 'mastered') {
        _ctx.font = '10px sans-serif';
        _ctx.fillText('✓', n.x, n.y + NODE_R + 10);
      }
    });

    _ctx.restore();

    // Draw selected node info panel (fixed position, not scaled)
    if (_selectedNode) _drawInfoPanel();
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

  // ── Hit test ──
  function _hitTest(clientX, clientY) {
    var rect = _canvas.getBoundingClientRect();
    var mx = (clientX - rect.left - _offsetX) / _scale;
    var my = (clientY - rect.top - _offsetY) / _scale;

    for (var i = 0; i < _nodes.length; i++) {
      var n = _nodes[i];
      var dx = mx - n.x, dy = my - n.y;
      if (dx * dx + dy * dy <= NODE_R * NODE_R * 1.5) return n;
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

  // Touch
  function _onTouchStart(e) {
    if (e.touches.length === 2) {
      _pinchDist = _getPinchDist(e);
      return;
    }
    if (e.touches.length === 1) {
      var t = e.touches[0];
      var node = _hitTest(t.clientX, t.clientY);
      if (node) {
        _selectedNode = node;
        _draw();
        return;
      }
      _dragging = true;
      _dragStartX = t.clientX;
      _dragStartY = t.clientY;
      _dragOffsetX = _offsetX;
      _dragOffsetY = _offsetY;
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
    if (_dragging && e.touches.length === 1) {
      var t = e.touches[0];
      _offsetX = _dragOffsetX + (t.clientX - _dragStartX);
      _offsetY = _dragOffsetY + (t.clientY - _dragStartY);
      _draw();
    }
  }

  function _onTouchEnd(e) {
    _dragging = false;
    if (e.changedTouches && e.changedTouches.length === 1 && _selectedNode) {
      if (_selectedNode.state === 'available' || _selectedNode.state === 'progress') {
        _openNodePractice(_selectedNode);
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
    }

    _selectedNode = null;
    _scale = 1;
    _offsetX = 0;
    _offsetY = 0;

    // Setup canvas
    _canvas = document.getElementById('gt-canvas');
    if (_canvas) {
      var rect = _canvas.parentElement.getBoundingClientRect();
      _w = rect.width || 800;
      _h = rect.height || 500;
      _ctx = KHCanvas.DPR.setup(_canvas, _w, _h);

      _canvas.addEventListener('mousedown', _onMouseDown);
      _canvas.addEventListener('mousemove', _onMouseMove);
      _canvas.addEventListener('mouseup', _onMouseUp);
      _canvas.addEventListener('wheel', _onWheel, { passive: false });
      _canvas.addEventListener('touchstart', _onTouchStart, { passive: false });
      _canvas.addEventListener('touchmove', _onTouchMove, { passive: false });
      _canvas.addEventListener('touchend', _onTouchEnd);
    }

    _buildNodes();

    // Stats
    var stats = document.getElementById('gt-stats');
    if (stats) {
      var mastered = _nodes.filter(function(n) { return n.state === 'mastered'; }).length;
      stats.textContent = mastered + '/' + _nodes.length + ' mastered';
    }

    _draw();
  };

  GT.close = function() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(function() { overlay.classList.add('hidden'); }, 250);
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
