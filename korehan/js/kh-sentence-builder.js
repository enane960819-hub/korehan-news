/* ============================================================
   KH Sentence Builder  v1
   Canvas drag-and-drop colored blocks with magnet snap
   Depends on: kh-canvas-engine.js (KHCanvas.DPR, AnimLoop, ParticleSystem)
   ============================================================ */

(function() {
  'use strict';

  var SB = window.KHSentenceBuilder = {};

  var OVERLAY_ID = 'sb2-overlay';
  var _canvas = null, _ctx = null;
  var _w = 0, _h = 0;

  // Korean particle/part-of-speech color coding
  var COLORS = {
    particle: { fill: '#f59e0b', border: '#d97706', text: '#fff' },  // 조사 = orange
    verb:     { fill: '#8b5cf6', border: '#7c3aed', text: '#fff' },  // 동사 = purple
    noun:     { fill: '#3b82f6', border: '#2563eb', text: '#fff' },  // 명사 = blue
    adverb:   { fill: '#22c55e', border: '#16a34a', text: '#fff' },  // 부사 = green
    default:  { fill: '#475569', border: '#334155', text: '#fff' }
  };

  // Korean particles (조사) for part-of-speech detection
  var PARTICLES = ['은','는','이','가','을','를','에','에서','도','와','과','부터','까지','로','으로','의','한테','에게','처럼','같이','마다','밖에','만','보다','라서','이라서','하고'];

  // State
  var _blocks = [];     // [{text, x, y, w, h, type, placed, slotIdx, dragOffsetX, dragOffsetY}]
  var _slots = [];      // [{x, y, w, h, idx, filled}] — target positions
  var _answer = [];     // correct word order
  var _sentences = [];  // all available sentences
  var _sentIdx = 0;
  var _draggingBlock = null;
  var _score = 0;
  var _total = 0;

  var BLOCK_H = 44;
  var BLOCK_PAD = 10;
  var BLOCK_GAP = 8;
  var SLOT_Y = 60;
  var POOL_Y_START = 160;

  // ── Detect part of speech (simple heuristic) ──
  function _getType(word) {
    // Check if word is a known particle
    for (var i = 0; i < PARTICLES.length; i++) {
      if (word === PARTICLES[i]) return 'particle';
    }
    // Ends with common verb endings
    if (/[다요요세]$/.test(word)) return 'verb';
    if (/[게서면고지]$/.test(word) && word.length >= 2) return 'adverb';
    return 'noun';
  }

  // ── Measure block width ──
  function _measureBlock(text) {
    if (!_ctx) return 60;
    _ctx.font = '700 15px "Noto Sans KR", sans-serif';
    return Math.max(50, _ctx.measureText(text).width + BLOCK_PAD * 2 + 4);
  }

  // ── Build blocks from sentence ──
  function _buildBlocks(words) {
    _answer = words.slice();
    _blocks = [];
    _slots = [];

    // Create slots (answer zone)
    var slotX = 20;
    for (var i = 0; i < words.length; i++) {
      var sw = _measureBlock(words[i]);
      _slots.push({ x: slotX, y: SLOT_Y, w: sw, h: BLOCK_H, idx: i, filled: false });
      slotX += sw + BLOCK_GAP;
    }

    // Center slots
    var totalSlotW = slotX - BLOCK_GAP;
    var slotOffset = Math.max(0, (_w - totalSlotW) / 2 - 20);
    _slots.forEach(function(s) { s.x += slotOffset; });

    // Create shuffled pool blocks
    var shuffled = words.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = t;
    }
    if (shuffled.join(' ') === words.join(' ') && shuffled.length > 1) {
      var tmp = shuffled[0]; shuffled[0] = shuffled[shuffled.length - 1]; shuffled[shuffled.length - 1] = tmp;
    }

    // Layout pool blocks in rows
    var px = 20, py = POOL_Y_START;
    var maxRowW = _w - 40;
    shuffled.forEach(function(word) {
      var bw = _measureBlock(word);
      if (px + bw > maxRowW + 20) { px = 20; py += BLOCK_H + BLOCK_GAP; }
      _blocks.push({
        text: word, x: px, y: py, w: bw, h: BLOCK_H,
        type: _getType(word), placed: false, slotIdx: -1,
        homeX: px, homeY: py
      });
      px += bw + BLOCK_GAP;
    });
  }

  // ── Draw ──
  function _draw() {
    if (!_ctx) return;
    _ctx.save();
    _ctx.setTransform(1, 0, 0, 1, 0, 0);
    var dpr = KHCanvas.DPR.ratio();
    _ctx.clearRect(0, 0, _w * dpr, _h * dpr);
    _ctx.restore();

    // Header
    _ctx.font = '800 12px sans-serif';
    _ctx.fillStyle = 'rgba(255,255,255,.4)';
    _ctx.textAlign = 'center';
    _ctx.fillText('Arrange the words in correct order', _w / 2, 30);

    // Draw slots (dashed outlines)
    _slots.forEach(function(s) {
      _ctx.strokeStyle = s.filled ? 'rgba(34,197,94,.3)' : 'rgba(255,255,255,.15)';
      _ctx.lineWidth = 2;
      _ctx.setLineDash(s.filled ? [] : [4, 3]);
      _ctx.beginPath();
      _ctx.roundRect(s.x, s.y, s.w, s.h, 10);
      _ctx.stroke();
      _ctx.setLineDash([]);

      // Slot number
      if (!s.filled) {
        _ctx.font = '700 10px sans-serif';
        _ctx.fillStyle = 'rgba(255,255,255,.15)';
        _ctx.textAlign = 'center';
        _ctx.textBaseline = 'middle';
        _ctx.fillText(s.idx + 1, s.x + s.w / 2, s.y + s.h / 2);
      }
    });

    // Draw blocks (dragging block last for z-order)
    _blocks.forEach(function(b) {
      if (b === _draggingBlock) return;
      _drawBlock(b);
    });
    if (_draggingBlock) _drawBlock(_draggingBlock);
  }

  function _drawBlock(b) {
    var col = COLORS[b.type] || COLORS.default;
    var isDragging = b === _draggingBlock;

    _ctx.save();
    if (isDragging) {
      _ctx.shadowColor = 'rgba(0,0,0,.3)';
      _ctx.shadowBlur = 16;
      _ctx.shadowOffsetY = 4;
    }

    // Block body
    _ctx.fillStyle = b.placed ? 'rgba(255,255,255,.06)' : col.fill;
    _ctx.beginPath();
    _ctx.roundRect(b.x, b.y, b.w, b.h, 10);
    _ctx.fill();

    // Border
    _ctx.strokeStyle = b.placed ? 'rgba(255,255,255,.12)' : col.border;
    _ctx.lineWidth = isDragging ? 2.5 : 1.5;
    _ctx.stroke();

    // Color indicator dot (top-left)
    if (!b.placed) {
      _ctx.beginPath();
      _ctx.arc(b.x + 10, b.y + 10, 3, 0, Math.PI * 2);
      _ctx.fillStyle = col.border;
      _ctx.fill();
    }

    _ctx.restore();

    // Text
    _ctx.font = '700 15px "Noto Sans KR", sans-serif';
    _ctx.fillStyle = b.placed ? 'rgba(255,255,255,.5)' : col.text;
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(b.text, b.x + b.w / 2, b.y + b.h / 2);
  }

  // ── Hit test ──
  function _hitBlock(mx, my) {
    for (var i = _blocks.length - 1; i >= 0; i--) {
      var b = _blocks[i];
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) return b;
    }
    return null;
  }

  function _findNearestSlot(b) {
    var bcx = b.x + b.w / 2;
    var bcy = b.y + b.h / 2;
    var best = null, bestDist = 80; // max snap distance

    _slots.forEach(function(s) {
      if (s.filled) return;
      var scx = s.x + s.w / 2;
      var scy = s.y + s.h / 2;
      var dist = Math.sqrt((bcx - scx) * (bcx - scx) + (bcy - scy) * (bcy - scy));
      if (dist < bestDist) { bestDist = dist; best = s; }
    });
    return best;
  }

  // ── Touch/mouse handlers ──
  function _getPos(e) {
    var rect = _canvas.getBoundingClientRect();
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function _onDown(e) {
    e.preventDefault();
    var pos = _getPos(e);
    var block = _hitBlock(pos.x, pos.y);
    if (!block) return;

    // If block is placed in a slot, remove it
    if (block.placed && block.slotIdx >= 0) {
      _slots[block.slotIdx].filled = false;
      block.placed = false;
      block.slotIdx = -1;
    }

    _draggingBlock = block;
    block.dragOffsetX = pos.x - block.x;
    block.dragOffsetY = pos.y - block.y;
    _draw();
  }

  function _onMove(e) {
    if (!_draggingBlock) return;
    e.preventDefault();
    var pos = _getPos(e);
    _draggingBlock.x = pos.x - _draggingBlock.dragOffsetX;
    _draggingBlock.y = pos.y - _draggingBlock.dragOffsetY;
    _draw();
  }

  function _onUp(e) {
    if (!_draggingBlock) return;
    var block = _draggingBlock;
    _draggingBlock = null;

    // Try to snap to nearest slot
    var slot = _findNearestSlot(block);
    if (slot) {
      // Snap animation
      block.x = slot.x + (slot.w - block.w) / 2;
      block.y = slot.y;
      block.placed = true;
      block.slotIdx = slot.idx;
      slot.filled = true;
    } else {
      // Return to home position
      block.x = block.homeX;
      block.y = block.homeY;
    }

    _draw();
    _checkComplete();
  }

  // ── Check if all placed correctly ──
  function _checkComplete() {
    var allPlaced = _slots.every(function(s) { return s.filled; });
    if (!allPlaced) return;

    // Build answer from slots
    var placed = new Array(_slots.length);
    _blocks.forEach(function(b) {
      if (b.placed && b.slotIdx >= 0) placed[b.slotIdx] = b.text;
    });
    var userAnswer = placed.join(' ');
    var correct = _answer.join(' ');

    if (userAnswer === correct) {
      _score++;
      if (typeof playCorrectSound === 'function') playCorrectSound();
      // Gold burst particles
      if (window.KHCanvas) {
        var po = KHCanvas.createOverlay(_canvas.parentElement);
        if (po) {
          po.ps.burstAt(po.canvas._khW / 2, SLOT_Y, 'GOLD_BURST', 30);
          setTimeout(function() { po.canvas.remove(); po.ps.destroy(); }, 2000);
        }
      }
      // Next sentence after delay
      setTimeout(function() { _nextSentence(); }, 1200);
    } else {
      if (typeof playWrongSound === 'function') playWrongSound();
      // Shake effect — reset all blocks to pool
      setTimeout(function() {
        _blocks.forEach(function(b) {
          b.placed = false;
          b.slotIdx = -1;
          b.x = b.homeX;
          b.y = b.homeY;
        });
        _slots.forEach(function(s) { s.filled = false; });
        _draw();
      }, 600);
    }
  }

  function _nextSentence() {
    _sentIdx++;
    if (_sentIdx >= _sentences.length) {
      _showResults();
      return;
    }
    _loadCurrentSentence();
  }

  function _loadCurrentSentence() {
    var s = _sentences[_sentIdx];
    var words = s.ko.replace(/[.!?~]/g, '').trim().split(/\s+/);
    _buildBlocks(words);
    _total = _sentences.length;
    // Update counter
    var counter = document.getElementById('sb2-counter');
    if (counter) counter.textContent = (_sentIdx + 1) + '/' + _sentences.length;
    // Show English hint
    var hint = document.getElementById('sb2-hint');
    if (hint) hint.textContent = s.en || '';
    _draw();
  }

  function _showResults() {
    var body = _canvas ? _canvas.parentElement : null;
    if (!body) return;
    var pct = _total > 0 ? Math.round(_score / _total * 100) : 0;

    body.innerHTML =
      '<div style="text-align:center;padding:40px 20px">'
      + '<div style="font-size:48px;margin-bottom:12px">' + (pct >= 70 ? '🎉' : '💪') + '</div>'
      + '<div style="font-size:24px;font-weight:900;color:#fff;margin-bottom:4px">' + _score + ' / ' + _total + '</div>'
      + '<div style="font-size:14px;color:rgba(255,255,255,.5);margin-bottom:20px">' + pct + '% correct</div>'
      + '<button onclick="KHSentenceBuilder.close()" style="padding:12px 28px;border-radius:12px;border:none;background:#2563eb;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit">Close</button>'
      + '</div>';

    if (pct >= 50 && window.KHCanvas) {
      var po = KHCanvas.createOverlay(body);
      if (po) {
        setTimeout(function() { po.ps.burstAt(po.canvas._khW / 2, 80, 'CELEBRATION', 40); }, 200);
        setTimeout(function() { po.canvas.remove(); po.ps.destroy(); }, 3000);
      }
    }
  }

  // ── Overlay ──
  function _ensureOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;
    var el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.className = 'kh-fs-overlay hidden';
    el.onclick = function(e) { if (e.target === el) SB.close(); };
    el.innerHTML =
      '<div class="kh-fs-panel" style="max-width:520px">'
      + '<div class="kh-fs-header">'
      +   '<div style="flex:1"><div style="font-size:15px;font-weight:900;color:#fff">🧩 Sentence Builder</div></div>'
      +   '<div id="sb2-counter" style="font-size:12px;color:rgba(255,255,255,.45);font-weight:700"></div>'
      +   '<button class="kh-fs-close" onclick="KHSentenceBuilder.close()">&#10005;</button>'
      + '</div>'
      + '<div id="sb2-hint" style="padding:8px 20px;font-size:13px;color:rgba(255,255,255,.5);background:rgba(255,255,255,.03);border-bottom:1px solid rgba(255,255,255,.06)"></div>'
      + '<div style="flex:1;overflow:hidden;position:relative;min-height:320px" id="sb2-canvas-wrap">'
      +   '<canvas id="sb2-canvas" style="width:100%;height:100%;display:block;touch-action:none"></canvas>'
      + '</div>'
      + '</div>';
    document.body.appendChild(el);
  }

  // ── Public API ──
  SB.open = function(opts) {
    opts = opts || {};
    _ensureOverlay();

    _sentences = opts.sentences || [];
    // Fallback: use _aiContent helpers
    if (!_sentences.length && typeof _aiContent !== 'undefined' && _aiContent && _aiContent.helpers) {
      _sentences = _aiContent.helpers.filter(function(h) {
        return h.ko && h.ko.trim().split(/\s+/).length >= 3 && h.ko.trim().split(/\s+/).length <= 8;
      });
    }
    if (!_sentences.length) {
      _sentences = [
        { ko: '저는 한국어를 공부해요', en: 'I study Korean.' },
        { ko: '오늘 날씨가 좋아요', en: 'The weather is nice today.' },
        { ko: '친구가 학교에 가요', en: 'My friend goes to school.' }
      ];
    }

    _sentIdx = 0;
    _score = 0;

    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.classList.remove('hidden');
      requestAnimationFrame(function() { overlay.classList.add('active'); });
      KHCanvas.hideBottomNav();
    }

    // Setup canvas
    setTimeout(function() {
      _canvas = document.getElementById('sb2-canvas');
      if (!_canvas) return;
      var wrap = document.getElementById('sb2-canvas-wrap');
      var rect = wrap ? wrap.getBoundingClientRect() : _canvas.getBoundingClientRect();
      _w = rect.width || 480;
      _h = rect.height || 320;
      _ctx = KHCanvas.DPR.setup(_canvas, _w, _h);

      // Events
      _canvas.addEventListener('mousedown', _onDown);
      _canvas.addEventListener('mousemove', _onMove);
      _canvas.addEventListener('mouseup', _onUp);
      _canvas.addEventListener('mouseleave', _onUp);
      _canvas.addEventListener('touchstart', _onDown, { passive: false });
      _canvas.addEventListener('touchmove', _onMove, { passive: false });
      _canvas.addEventListener('touchend', _onUp);

      _loadCurrentSentence();
    }, 100);
  };

  SB.close = function() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(function() { overlay.classList.add('hidden'); }, 250);
    KHCanvas.showBottomNav();
    }
    if (_canvas) {
      _canvas.removeEventListener('mousedown', _onDown);
      _canvas.removeEventListener('mousemove', _onMove);
      _canvas.removeEventListener('mouseup', _onUp);
      _canvas.removeEventListener('mouseleave', _onUp);
      _canvas.removeEventListener('touchstart', _onDown);
      _canvas.removeEventListener('touchmove', _onMove);
      _canvas.removeEventListener('touchend', _onUp);
    }
  };

  // ── Utility ──
  function _esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

})();
