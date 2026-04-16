/* ============================================================
   KH Flashcards  v1
   3D card flip + swipe physics for vocabulary review
   Depends on: kh-canvas-engine.js (KHCanvas.ParticleSystem, DPR)
   ============================================================ */

(function() {
  'use strict';

  var FC = window.KHFlashcards = {};

  // ── State ──
  var _cards = [];       // [{ko, en, rom, src, srs_interval}]
  var _index = 0;
  var _known = [];       // indices swiped right
  var _unknown = [];     // indices swiped left
  var _isOpen = false;
  var _touchStartX = 0;
  var _touchStartY = 0;
  var _touchDx = 0;
  var _dragging = false;
  var _particleOverlay = null;

  var OVERLAY_ID = 'fc-overlay';
  var SWIPE_THRESHOLD = 0.3; // 30% of card width = swipe

  // ── Create overlay (once) ──
  function _ensureOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;
    var el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.className = 'kh-fs-overlay hidden';
    el.onclick = function(e) { if (e.target === el) FC.close(); };
    el.innerHTML =
      '<div class="kh-fs-panel" style="max-width:420px">'
      // Header
      + '<div class="kh-fs-header">'
      +   '<div id="fc-title" style="font-size:15px;font-weight:900;color:#fff;flex:1">Flashcards</div>'
      +   '<div id="fc-counter" style="font-size:12px;color:rgba(255,255,255,.45);font-weight:700"></div>'
      +   '<button class="kh-fs-close" onclick="KHFlashcards.close()">&#10005;</button>'
      + '</div>'
      // Card area
      + '<div class="kh-fs-body" style="display:flex;flex-direction:column;align-items:center;min-height:320px;position:relative">'
      +   '<div class="kh-swipe-glow-left" id="fc-glow-left"></div>'
      +   '<div class="kh-swipe-glow-right" id="fc-glow-right"></div>'
      +   '<div id="fc-card-area" style="width:100%;max-width:340px;height:260px;position:relative;perspective:800px;margin:20px 0">'
      +     '<div id="fc-card" class="kh-flip-card" style="width:100%;height:100%;cursor:pointer" onclick="KHFlashcards.flip()">'
      +       '<div class="kh-flip-inner" style="width:100%;height:100%">'
      +         '<div class="kh-flip-front" id="fc-front" style="background:linear-gradient(135deg,#1a2a44,#15243a);border-radius:20px;padding:24px;border:1.5px solid rgba(255,255,255,.1);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center"></div>'
      +         '<div class="kh-flip-back" id="fc-back" style="background:linear-gradient(135deg,#15243a,#1e3a5f);border-radius:20px;padding:24px;border:1.5px solid rgba(96,165,250,.2);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center"></div>'
      +       '</div>'
      +     '</div>'
      +   '</div>'
      +   '<div style="font-size:11px;color:rgba(255,255,255,.3);margin-bottom:8px">← Don\'t know &nbsp;|&nbsp; Know →</div>'
      // Buttons
      +   '<div style="display:flex;gap:12px;margin-bottom:8px">'
      +     '<button onclick="KHFlashcards.swipeLeft()" style="width:56px;height:56px;border-radius:50%;border:2px solid rgba(239,68,68,.3);background:rgba(239,68,68,.08);color:#f87171;font-size:22px;cursor:pointer;transition:all .15s" onmouseover="this.style.background=\'rgba(239,68,68,.2)\'" onmouseout="this.style.background=\'rgba(239,68,68,.08)\'">✕</button>'
      +     '<button onclick="KHFlashcards.flip()" style="width:56px;height:56px;border-radius:50%;border:2px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:rgba(255,255,255,.6);font-size:18px;cursor:pointer;transition:all .15s">↻</button>'
      +     '<button onclick="KHFlashcards.swipeRight()" style="width:56px;height:56px;border-radius:50%;border:2px solid rgba(34,197,94,.3);background:rgba(34,197,94,.08);color:#4ade80;font-size:22px;cursor:pointer;transition:all .15s" onmouseover="this.style.background=\'rgba(34,197,94,.2)\'" onmouseout="this.style.background=\'rgba(34,197,94,.08)\'">✓</button>'
      +   '</div>'
      + '</div>'
      // Footer: progress
      + '<div class="kh-fs-footer" style="text-align:center">'
      +   '<div id="fc-score" style="font-size:12px;color:rgba(255,255,255,.4)"></div>'
      + '</div>'
      + '</div>';
    document.body.appendChild(el);

    // Touch events for swipe
    var cardArea = el.querySelector('#fc-card-area');
    if (cardArea) {
      cardArea.addEventListener('touchstart', _onTouchStart, { passive: true });
      cardArea.addEventListener('touchmove', _onTouchMove, { passive: false });
      cardArea.addEventListener('touchend', _onTouchEnd);
    }
  }

  // ── Touch handlers ──
  function _onTouchStart(e) {
    if (!e.touches || !e.touches[0]) return;
    _touchStartX = e.touches[0].clientX;
    _touchStartY = e.touches[0].clientY;
    _touchDx = 0;
    _dragging = true;
    var card = document.getElementById('fc-card');
    if (card) card.style.transition = 'none';
  }

  function _onTouchMove(e) {
    if (!_dragging || !e.touches || !e.touches[0]) return;
    var dx = e.touches[0].clientX - _touchStartX;
    var dy = e.touches[0].clientY - _touchStartY;
    // Only horizontal swipe
    if (Math.abs(dx) > Math.abs(dy) * 1.5) {
      e.preventDefault();
      _touchDx = dx;
      var card = document.getElementById('fc-card');
      if (card) {
        card.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx * 0.06) + 'deg)';
      }
      // Glow indicators
      var glowL = document.getElementById('fc-glow-left');
      var glowR = document.getElementById('fc-glow-right');
      if (glowL) glowL.style.opacity = dx < -30 ? Math.min(1, Math.abs(dx) / 150) : 0;
      if (glowR) glowR.style.opacity = dx > 30 ? Math.min(1, dx / 150) : 0;
    }
  }

  function _onTouchEnd() {
    if (!_dragging) return;
    _dragging = false;
    var cardArea = document.getElementById('fc-card-area');
    var cardW = cardArea ? cardArea.offsetWidth : 300;

    if (_touchDx > cardW * SWIPE_THRESHOLD) {
      FC.swipeRight();
    } else if (_touchDx < -(cardW * SWIPE_THRESHOLD)) {
      FC.swipeLeft();
    } else {
      // Snap back
      var card = document.getElementById('fc-card');
      if (card) {
        card.style.transition = 'transform 0.3s cubic-bezier(.22,1,.36,1)';
        card.style.transform = '';
      }
    }

    var glowL = document.getElementById('fc-glow-left');
    var glowR = document.getElementById('fc-glow-right');
    if (glowL) glowL.style.opacity = 0;
    if (glowR) glowR.style.opacity = 0;
  }

  // ── Render card ──
  function _renderCard() {
    if (_index >= _cards.length) { _showResults(); return; }
    var c = _cards[_index];
    var front = document.getElementById('fc-front');
    var back = document.getElementById('fc-back');
    var counter = document.getElementById('fc-counter');
    var card = document.getElementById('fc-card');

    if (counter) counter.textContent = (_index + 1) + '/' + _cards.length;

    // Unflip
    if (card) {
      card.classList.remove('flipped');
      card.style.transition = '';
      card.style.transform = '';
    }

    // Front: Korean + mastery ring
    if (front) {
      var srcBadge = c.src === 'conv' ? '💬' : c.src === 'story' ? '📖' : '📰';
      var masteryLevel = _getMasteryLevel(c);
      front.innerHTML =
        '<div style="position:absolute;top:12px;right:12px"><canvas id="fc-mastery-ring"></canvas></div>'
        + '<div style="font-size:10px;color:rgba(255,255,255,.3);margin-bottom:12px">' + srcBadge + ' TAP TO FLIP</div>'
        + '<div style="font-family:\'Noto Serif KR\',serif;font-size:32px;font-weight:900;color:#fff;line-height:1.3">' + _esc(c.ko) + '</div>'
        + (c.rom ? '<div style="font-size:14px;color:rgba(255,255,255,.4);margin-top:8px">' + _esc(c.rom) + '</div>' : '');
      // Draw mastery ring
      _drawMasteryRing(masteryLevel);
    }

    // Back: English
    if (back) {
      back.innerHTML =
        '<div style="font-size:10px;color:rgba(96,165,250,.5);margin-bottom:8px">ENGLISH</div>'
        + '<div style="font-family:\'Noto Serif KR\',serif;font-size:24px;font-weight:900;color:#fff;margin-bottom:6px;line-height:1.3">' + _esc(c.ko) + '</div>'
        + (c.rom ? '<div style="font-size:13px;color:rgba(255,255,255,.4);margin-bottom:10px;font-style:italic">' + _esc(c.rom) + '</div>' : '')
        + '<div style="font-size:18px;font-weight:700;color:#60a5fa;line-height:1.5">' + _esc(c.en) + '</div>';
    }

    _updateScore();
  }

  function _updateScore() {
    var el = document.getElementById('fc-score');
    if (el) {
      el.textContent = '✓ ' + _known.length + '  ·  ✕ ' + _unknown.length + '  ·  ' + (_cards.length - _index) + ' remaining';
    }
  }

  function _animateSwipe(direction, cb) {
    var card = document.getElementById('fc-card');
    if (!card) { if (cb) cb(); return; }
    var dist = direction === 'right' ? 400 : -400;
    card.style.transition = 'transform 0.35s cubic-bezier(.22,1,.36,1), opacity 0.35s ease';
    card.style.transform = 'translateX(' + dist + 'px) rotate(' + (dist * 0.06) + 'deg)';
    card.style.opacity = '0';
    setTimeout(function() {
      card.style.transition = 'none';
      card.style.transform = '';
      card.style.opacity = '1';
      if (cb) cb();
    }, 350);
  }

  // ── Results screen ──
  function _showResults() {
    var body = document.querySelector('#' + OVERLAY_ID + ' .kh-fs-body');
    if (!body) return;
    var total = _cards.length;
    var knownPct = total > 0 ? Math.round(_known.length / total * 100) : 0;

    body.innerHTML =
      '<div style="text-align:center;padding:30px 20px">'
      + '<div style="font-size:48px;margin-bottom:12px">' + (knownPct >= 70 ? '🎉' : '💪') + '</div>'
      + '<div style="font-size:24px;font-weight:900;color:#fff;margin-bottom:4px">' + _known.length + ' / ' + total + ' known</div>'
      + '<div style="font-size:14px;color:rgba(255,255,255,.5);margin-bottom:16px">' + knownPct + '% mastered</div>'
      + (_unknown.length > 0
        ? '<button onclick="KHFlashcards.reviewUnknown()" style="padding:12px 28px;border-radius:12px;border:none;background:#2563eb;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;margin-bottom:8px">Review ' + _unknown.length + ' unknown cards →</button><br>'
        : '')
      + '<button onclick="KHFlashcards.close()" style="padding:10px 24px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:none;color:rgba(255,255,255,.6);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Close</button>'
      + '<div id="fc-constellation-wrap" style="width:100%"></div>'
      + '</div>';

    // Constellation word map
    var cWrap = document.getElementById('fc-constellation-wrap');
    if (cWrap && _cards.length >= 2) {
      setTimeout(function() { _drawConstellation(cWrap); }, 100);
    }

    // Celebration particles
    if (knownPct >= 50 && window.KHCanvas) {
      var po = KHCanvas.createOverlay(body);
      if (po) {
        var w = po.canvas._khW || 300;
        var h = po.canvas._khH || 300;
        setTimeout(function() { po.ps.burstAt(w / 2, h * 0.3, 'CELEBRATION', 45); }, 200);
        setTimeout(function() { po.canvas.remove(); po.ps.destroy(); }, 3000);
      }
    }
  }

  // ── Public API ──

  /**
   * @param {object} opts
   * @param {array}  opts.cards — [{ko, en, rom, src, srs_interval}]
   * @param {string} opts.title
   */
  FC.open = function(opts) {
    opts = opts || {};
    _ensureOverlay();

    _cards = (opts.cards || []).slice();
    if (!_cards.length) {
      // Fallback: use current flashcard pool
      if (typeof _fcWords !== 'undefined' && _fcWords.length) {
        _cards = _fcWords.slice().sort(function() { return Math.random() - 0.5; }).slice(0, 20);
      }
    }

    _index = 0;
    _known = [];
    _unknown = [];

    var title = document.getElementById('fc-title');
    if (title) title.textContent = opts.title || 'Flashcards (' + _cards.length + ')';

    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.classList.remove('hidden');
      requestAnimationFrame(function() { overlay.classList.add('active'); });
      KHCanvas.hideBottomNav();
    }
    _isOpen = true;

    if (_cards.length > 0) _renderCard();
  };

  FC.flip = function() {
    var card = document.getElementById('fc-card');
    if (card) card.classList.toggle('flipped');
  };

  FC.swipeRight = function() {
    if (_index >= _cards.length) return;
    _known.push(_index);
    // Sparkle particle
    if (window.KHCanvas) {
      var body = document.querySelector('#' + OVERLAY_ID + ' .kh-fs-body');
      if (body) {
        var po = KHCanvas.createOverlay(body);
        if (po) {
          po.ps.burstAt(po.canvas._khW * 0.7, po.canvas._khH * 0.4, 'SPARKLE', 15);
          setTimeout(function() { po.canvas.remove(); po.ps.destroy(); }, 1500);
        }
      }
    }
    _animateSwipe('right', function() { _index++; _renderCard(); });
  };

  FC.swipeLeft = function() {
    if (_index >= _cards.length) return;
    _unknown.push(_index);
    _animateSwipe('left', function() { _index++; _renderCard(); });
  };

  FC.reviewUnknown = function() {
    var unknownCards = _unknown.map(function(i) { return _cards[i]; });
    _cards = unknownCards;
    _index = 0;
    _known = [];
    _unknown = [];

    // Re-render body
    var body = document.querySelector('#' + OVERLAY_ID + ' .kh-fs-body');
    if (body) {
      body.innerHTML =
        '<div class="kh-swipe-glow-left" id="fc-glow-left"></div>'
        + '<div class="kh-swipe-glow-right" id="fc-glow-right"></div>'
        + '<div id="fc-card-area" style="width:100%;max-width:340px;height:260px;position:relative;perspective:800px;margin:20px 0">'
        +   '<div id="fc-card" class="kh-flip-card" style="width:100%;height:100%;cursor:pointer" onclick="KHFlashcards.flip()">'
        +     '<div class="kh-flip-inner" style="width:100%;height:100%">'
        +       '<div class="kh-flip-front" id="fc-front" style="background:linear-gradient(135deg,#1a2a44,#15243a);border-radius:20px;padding:24px;border:1.5px solid rgba(255,255,255,.1);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center"></div>'
        +       '<div class="kh-flip-back" id="fc-back" style="background:linear-gradient(135deg,#15243a,#1e3a5f);border-radius:20px;padding:24px;border:1.5px solid rgba(96,165,250,.2);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center"></div>'
        +     '</div>'
        +   '</div>'
        + '</div>'
        + '<div style="font-size:11px;color:rgba(255,255,255,.3);margin-bottom:8px">← Don\'t know &nbsp;|&nbsp; Know →</div>'
        + '<div style="display:flex;gap:12px;margin-bottom:8px">'
        +   '<button onclick="KHFlashcards.swipeLeft()" style="width:56px;height:56px;border-radius:50%;border:2px solid rgba(239,68,68,.3);background:rgba(239,68,68,.08);color:#f87171;font-size:22px;cursor:pointer">✕</button>'
        +   '<button onclick="KHFlashcards.flip()" style="width:56px;height:56px;border-radius:50%;border:2px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:rgba(255,255,255,.6);font-size:18px;cursor:pointer">↻</button>'
        +   '<button onclick="KHFlashcards.swipeRight()" style="width:56px;height:56px;border-radius:50%;border:2px solid rgba(34,197,94,.3);background:rgba(34,197,94,.08);color:#4ade80;font-size:22px;cursor:pointer">✓</button>'
        + '</div>';

      // Re-bind touch
      var cardArea = body.querySelector('#fc-card-area');
      if (cardArea) {
        cardArea.addEventListener('touchstart', _onTouchStart, { passive: true });
        cardArea.addEventListener('touchmove', _onTouchMove, { passive: false });
        cardArea.addEventListener('touchend', _onTouchEnd);
      }
    }

    var titleEl = document.getElementById('fc-title');
    if (titleEl) titleEl.textContent = 'Review Unknown (' + _cards.length + ')';

    _renderCard();
  };

  FC.close = function() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(function() { overlay.classList.add('hidden'); }, 250);
    KHCanvas.showBottomNav();
    }
    _isOpen = false;
  };

  // ── Mastery Ring ──────────────────────────────────────────
  // SRS interval → mastery level (0-1)
  // interval 1 = new (0), 3 = learning (0.25), 7 = familiar (0.5),
  // 14 = good (0.75), 30+ = mastered (1.0)
  function _getMasteryLevel(card) {
    var interval = card.srs_interval || card.interval || 0;
    if (interval >= 30) return 1.0;
    if (interval >= 14) return 0.75;
    if (interval >= 7) return 0.5;
    if (interval >= 3) return 0.25;
    return 0.05; // show tiny ring for new words
  }

  function _drawMasteryRing(level) {
    var canvas = document.getElementById('fc-mastery-ring');
    if (!canvas || !window.KHCanvas) return;
    var ring = new KHCanvas.Ring(canvas, {
      radius: 14, lineWidth: 3,
      colors: level < 0.5 ? ['#f87171', '#ef4444'] : level < 0.75 ? ['#fbbf24', '#f59e0b'] : ['#34d399', '#22c55e'],
      completeColors: ['#34d399', '#22c55e'],
      showText: false,
      bgColor: 'rgba(255,255,255,.06)'
    });
    ring.setProgress(level, level >= 1 ? 'complete' : 'normal');
  }


  // ── Constellation Word Map ─────────────────────────────────
  // Shows all session words as stars on a canvas.
  // Known = bright, unknown = dim. Lines connect nearby words.
  function _drawConstellation(parentEl) {
    if (!parentEl || !window.KHCanvas || _cards.length < 2) return;

    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:200px;border-radius:12px;margin-top:16px';
    parentEl.appendChild(canvas);

    var rect = canvas.getBoundingClientRect();
    var w = rect.width || 320;
    var h = 200;
    var ctx = KHCanvas.DPR.setup(canvas, w, h);
    if (!ctx) return;

    // Place words in a grid-like pattern with slight randomness
    var positions = [];
    var cols = Math.ceil(Math.sqrt(_cards.length * (w / h)));
    var rows = Math.ceil(_cards.length / cols);
    var cellW = w / (cols + 1);
    var cellH = h / (rows + 1);

    for (var i = 0; i < _cards.length; i++) {
      var col = i % cols;
      var row = Math.floor(i / cols);
      positions.push({
        x: cellW * (col + 1) + (Math.random() - 0.5) * cellW * 0.5,
        y: cellH * (row + 1) + (Math.random() - 0.5) * cellH * 0.4,
        known: _known.indexOf(i) >= 0,
        word: _cards[i].ko
      });
    }

    // Draw connections between nearby words
    ctx.strokeStyle = 'rgba(122,184,245,.12)';
    ctx.lineWidth = 1;
    for (var i = 0; i < positions.length; i++) {
      for (var j = i + 1; j < positions.length; j++) {
        var dx = positions[j].x - positions[i].x;
        var dy = positions[j].y - positions[i].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < cellW * 1.8) {
          var alpha = (positions[i].known && positions[j].known) ? 0.2 : 0.06;
          ctx.strokeStyle = 'rgba(122,184,245,' + alpha + ')';
          ctx.beginPath();
          ctx.moveTo(positions[i].x, positions[i].y);
          ctx.lineTo(positions[j].x, positions[j].y);
          ctx.stroke();
        }
      }
    }

    // Draw stars (words)
    for (var i = 0; i < positions.length; i++) {
      var p = positions[i];
      var bright = p.known;

      // Glow
      if (bright) {
        var grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 16);
        grd.addColorStop(0, 'rgba(122,184,245,.2)');
        grd.addColorStop(1, 'rgba(122,184,245,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(p.x - 16, p.y - 16, 32, 32);
      }

      // Dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, bright ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = bright ? '#7ab8f5' : 'rgba(255,255,255,.2)';
      ctx.fill();

      // Label
      ctx.font = (bright ? '700' : '400') + ' 9px sans-serif';
      ctx.fillStyle = bright ? 'rgba(122,184,245,.8)' : 'rgba(255,255,255,.2)';
      ctx.textAlign = 'center';
      ctx.fillText(p.word, p.x, p.y + 14);
    }
  }

  // ── Utility ──
  function _esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

})();
