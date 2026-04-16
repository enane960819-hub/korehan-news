/* ============================================================
   KHCanvas — Shared Canvas Engine  v1
   KoreHani Study Room interactive learning utilities
   ============================================================
   Modules:
     KHCanvas.DPR            — HiDPI canvas setup
     KHCanvas.AnimLoop       — Central requestAnimationFrame manager
     KHCanvas.Particle       — Single particle data
     KHCanvas.ParticleSystem — Spawn, update, draw particle pools
     KHCanvas.Ring           — Animated progress ring (vocab/grammar tracker)
     KHCanvas.Gauge          — Timer countdown ring (green→yellow→red)
     KHCanvas.lerpColor      — Hex color interpolation
     KHCanvas.hexToRgba      — Hex to rgba conversion
   ============================================================ */

(function() {
  'use strict';

  var KHC = window.KHCanvas = {};

  /* ──────────────────────────────────────────────────────────
     DPR — Device Pixel Ratio canvas setup
     Usage:
       var ctx = KHCanvas.DPR.setup(canvas, 300, 200);
       // canvas is now 300×200 CSS px, crisp on Retina
     ────────────────────────────────────────────────────────── */
  KHC.DPR = {
    ratio: function() { return window.devicePixelRatio || 1; },

    /**
     * Set up a canvas for HiDPI rendering.
     * @param {HTMLCanvasElement} canvas
     * @param {number} w  — logical CSS width
     * @param {number} h  — logical CSS height
     * @returns {CanvasRenderingContext2D}
     */
    setup: function(canvas, w, h) {
      if (!canvas || !canvas.getContext) return null;
      var dpr = this.ratio();
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      var ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      // Store logical size for convenience
      canvas._khW = w;
      canvas._khH = h;
      return ctx;
    },

    /** Re-setup from current CSS size (for responsive resize) */
    resize: function(canvas) {
      if (!canvas) return null;
      var rect = canvas.getBoundingClientRect();
      return this.setup(canvas, rect.width, rect.height);
    }
  };


  /* ──────────────────────────────────────────────────────────
     AnimLoop — Central animation frame manager
     Prevents multiple rAF loops from stacking.
     Usage:
       KHCanvas.AnimLoop.register('my-anim', function(dt) { ... });
       KHCanvas.AnimLoop.unregister('my-anim');
     ────────────────────────────────────────────────────────── */
  var _callbacks = {};
  var _loopRunning = false;
  var _loopId = null;
  var _lastTime = 0;

  function _tick(now) {
    var dt = _lastTime ? Math.min((now - _lastTime) / 1000, 0.1) : 0.016;
    _lastTime = now;

    var keys = Object.keys(_callbacks);
    if (keys.length === 0) {
      _loopRunning = false;
      _loopId = null;
      _lastTime = 0;
      return;
    }

    for (var i = 0; i < keys.length; i++) {
      try { _callbacks[keys[i]](dt, now); } catch(e) { console.warn('[KHCanvas.AnimLoop]', keys[i], e); }
    }

    _loopId = requestAnimationFrame(_tick);
  }

  KHC.AnimLoop = {
    /** Register a named callback. Starts loop if not running. */
    register: function(name, fn) {
      if (typeof fn !== 'function') return;
      _callbacks[name] = fn;
      if (!_loopRunning) {
        _loopRunning = true;
        _lastTime = 0;
        _loopId = requestAnimationFrame(_tick);
      }
    },

    /** Unregister a named callback. Loop stops when all removed. */
    unregister: function(name) {
      delete _callbacks[name];
    },

    /** Check if a callback is registered */
    has: function(name) {
      return !!_callbacks[name];
    },

    /** Get current callback count */
    count: function() {
      return Object.keys(_callbacks).length;
    }
  };


  /* ──────────────────────────────────────────────────────────
     Particle — Single particle data object
     ────────────────────────────────────────────────────────── */

  /**
   * @param {object} opts
   * @param {number} opts.x
   * @param {number} opts.y
   * @param {number} opts.vx       — velocity x (px/s)
   * @param {number} opts.vy       — velocity y (px/s)
   * @param {number} opts.size     — radius in px
   * @param {string} opts.color    — CSS color string
   * @param {number} opts.life     — remaining life (seconds)
   * @param {number} opts.gravity  — gravity acceleration (px/s²), default 0
   * @param {number} opts.friction — velocity decay per second (0-1), default 0
   * @param {string} opts.shape    — 'circle' | 'square' | 'star', default 'circle'
   */
  function Particle(opts) {
    this.x = opts.x || 0;
    this.y = opts.y || 0;
    this.vx = opts.vx || 0;
    this.vy = opts.vy || 0;
    this.size = opts.size || 3;
    this.color = opts.color || '#fff';
    this.alpha = opts.alpha !== undefined ? opts.alpha : 1;
    this.life = opts.life || 1;
    this.maxLife = this.life;
    this.gravity = opts.gravity || 0;
    this.friction = opts.friction || 0;
    this.shape = opts.shape || 'circle';
    this.rotation = opts.rotation || 0;
    this.rotationSpeed = opts.rotationSpeed || 0;
  }

  /** Update particle state. Returns false if dead. */
  Particle.prototype.update = function(dt) {
    this.life -= dt;
    if (this.life <= 0) return false;

    this.vy += this.gravity * dt;
    if (this.friction > 0) {
      var f = 1 - this.friction * dt;
      this.vx *= f;
      this.vy *= f;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.rotationSpeed * dt;

    // Alpha fades with life
    this.alpha = Math.max(0, this.life / this.maxLife);
    return true;
  };

  /** Draw particle on context */
  Particle.prototype.draw = function(ctx) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;

    if (this.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.shape === 'square') {
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.fillRect(-this.size, -this.size, this.size * 2, this.size * 2);
    } else if (this.shape === 'star') {
      _drawStar(ctx, this.x, this.y, this.size, this.rotation);
    }

    ctx.restore();
  };

  /** Draw a 5-point star */
  function _drawStar(ctx, x, y, r, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    for (var i = 0; i < 5; i++) {
      var angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      var method = i === 0 ? 'moveTo' : 'lineTo';
      ctx[method](Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  KHC.Particle = Particle;


  /* ──────────────────────────────────────────────────────────
     ParticleSystem — Pool manager
     Usage:
       var ps = new KHCanvas.ParticleSystem(canvas);
       ps.spawn({x:100, y:100, count:30, preset:'GOLD_BURST'});
       // Automatically registers with AnimLoop
       // Call ps.destroy() to clean up
     ────────────────────────────────────────────────────────── */

  var _psCounter = 0;

  /**
   * @param {HTMLCanvasElement} canvas — the canvas to draw on
   * @param {object} [opts]
   * @param {boolean} [opts.overlay] — if true, canvas is positioned as overlay (doesn't clear background)
   */
  function ParticleSystem(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.particles = [];
    this.overlay = !!opts.overlay;
    this._id = 'ps-' + (++_psCounter);
    this._active = false;
  }

  /** Spawn particles at a position */
  ParticleSystem.prototype.spawn = function(opts) {
    opts = opts || {};
    var x = opts.x || 0;
    var y = opts.y || 0;
    var count = opts.count || 20;
    var preset = opts.preset || null;
    var config = preset && ParticleSystem.presets[preset] ? ParticleSystem.presets[preset] : {};

    for (var i = 0; i < count; i++) {
      var angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      var speed = (config.speedMin || 60) + Math.random() * ((config.speedMax || 200) - (config.speedMin || 60));
      var colors = config.colors || ['#FFD700', '#FFA500', '#FF6B35'];
      var shapes = config.shapes || ['circle'];

      var p = new Particle({
        x: x + (Math.random() - 0.5) * (config.spread || 8),
        y: y + (Math.random() - 0.5) * (config.spread || 8),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: (config.sizeMin || 2) + Math.random() * ((config.sizeMax || 5) - (config.sizeMin || 2)),
        color: colors[Math.floor(Math.random() * colors.length)],
        life: (config.lifeMin || 0.5) + Math.random() * ((config.lifeMax || 1.2) - (config.lifeMin || 0.5)),
        gravity: config.gravity !== undefined ? config.gravity : 120,
        friction: config.friction !== undefined ? config.friction : 0.3,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 6
      });
      this.particles.push(p);
    }

    if (!this._active) this._startLoop();
  };

  /** Spawn a trail (particles emitted over time at a position) */
  ParticleSystem.prototype.trail = function(opts) {
    var self = this;
    opts = opts || {};
    var x = opts.x || 0;
    var y = opts.y || 0;
    var duration = opts.duration || 0.5;
    var rate = opts.rate || 5; // particles per frame
    var preset = opts.preset || 'COMBO_FIRE';
    var elapsed = 0;
    var trailId = this._id + '-trail-' + Date.now();

    KHC.AnimLoop.register(trailId, function(dt) {
      elapsed += dt;
      if (elapsed >= duration) {
        KHC.AnimLoop.unregister(trailId);
        return;
      }
      self.spawn({ x: x, y: y, count: rate, preset: preset });
    });
  };

  /** Internal: register with AnimLoop */
  ParticleSystem.prototype._startLoop = function() {
    if (this._active) return;
    this._active = true;
    var self = this;

    KHC.AnimLoop.register(this._id, function(dt) {
      if (!self.canvas || !self.ctx) return;

      // Ensure canvas is sized
      var w = self.canvas._khW || self.canvas.width;
      var h = self.canvas._khH || self.canvas.height;

      // Clear
      self.ctx.save();
      self.ctx.setTransform(1, 0, 0, 1, 0, 0);
      var dpr = KHC.DPR.ratio();
      self.ctx.clearRect(0, 0, w * dpr, h * dpr);
      self.ctx.restore();

      // Update & draw
      var alive = [];
      for (var i = 0; i < self.particles.length; i++) {
        if (self.particles[i].update(dt)) {
          self.particles[i].draw(self.ctx);
          alive.push(self.particles[i]);
        }
      }
      self.particles = alive;

      // Stop loop when empty
      if (alive.length === 0) {
        self._active = false;
        KHC.AnimLoop.unregister(self._id);
      }
    });
  };

  /** Clean up: remove from loop, clear particles */
  ParticleSystem.prototype.destroy = function() {
    this.particles = [];
    this._active = false;
    KHC.AnimLoop.unregister(this._id);
  };

  /** Check if system has active particles */
  ParticleSystem.prototype.isActive = function() {
    return this.particles.length > 0;
  };

  /* ── Particle Presets ─────────────────────────────────────
     Each preset defines spawn parameters for a specific effect.
     Use: ps.spawn({ x, y, count, preset: 'GOLD_BURST' })
     ──────────────────────────────────────────────────────── */
  ParticleSystem.presets = {

    /* ── GOLD_BURST ──────────────────────────────────────────
       Correct answer celebration. Gold/amber particles burst
       outward with gravity pulling them down like confetti.   */
    GOLD_BURST: {
      colors: ['#FFD700', '#FFC233', '#FFA500', '#FFE066', '#F59E0B'],
      shapes: ['circle', 'circle', 'star'],
      speedMin: 80, speedMax: 260,
      sizeMin: 2, sizeMax: 6,
      lifeMin: 0.6, lifeMax: 1.4,
      gravity: 180,
      friction: 0.4,
      spread: 6
    },

    /* ── COMBO_FIRE ──────────────────────────────────────────
       Streak/combo effect. Orange-red particles shoot upward
       like flames. Negative gravity = floats up.              */
    COMBO_FIRE: {
      colors: ['#FF6B35', '#EF4444', '#F97316', '#FBBF24', '#FF4500'],
      shapes: ['circle', 'square'],
      speedMin: 40, speedMax: 160,
      sizeMin: 2, sizeMax: 5,
      lifeMin: 0.3, lifeMax: 0.8,
      gravity: -200,
      friction: 0.6,
      spread: 12
    },

    /* ── CELEBRATION ─────────────────────────────────────────
       Quiz/task completion. Multicolor confetti shower.
       Large spread, mixed shapes, slow gravity.               */
    CELEBRATION: {
      colors: ['#FFD700', '#4ADE80', '#60A5FA', '#F472B6', '#A78BFA', '#FB923C', '#34D399'],
      shapes: ['circle', 'square', 'star'],
      speedMin: 100, speedMax: 320,
      sizeMin: 3, sizeMax: 7,
      lifeMin: 1.0, lifeMax: 2.2,
      gravity: 100,
      friction: 0.25,
      spread: 16
    },

    /* ── MASTERY ─────────────────────────────────────────────
       Grammar/vocab mastery. Purple-blue stars float upward
       gently, with slow rotation. Ethereal feel.              */
    MASTERY: {
      colors: ['#A78BFA', '#818CF8', '#7C3AED', '#C4B5FD', '#6366F1'],
      shapes: ['star', 'star', 'circle'],
      speedMin: 30, speedMax: 100,
      sizeMin: 3, sizeMax: 7,
      lifeMin: 1.0, lifeMax: 2.0,
      gravity: -60,
      friction: 0.5,
      spread: 20
    },

    /* ── SPARKLE ─────────────────────────────────────────────
       Subtle sparkle for UI feedback (button press, save).
       Tiny white/blue particles, short-lived, minimal spread. */
    SPARKLE: {
      colors: ['#fff', '#E0F2FE', '#BAE6FD', '#7DD3FC', '#38BDF8'],
      shapes: ['circle'],
      speedMin: 30, speedMax: 80,
      sizeMin: 1, sizeMax: 3,
      lifeMin: 0.2, lifeMax: 0.6,
      gravity: 40,
      friction: 0.8,
      spread: 4
    },

    /* ── WRONG ───────────────────────────────────────────────
       Wrong answer. Red particles drip/fall downward quickly.
       Short-lived, heavy gravity.                             */
    WRONG: {
      colors: ['#EF4444', '#DC2626', '#F87171', '#991B1B'],
      shapes: ['circle'],
      speedMin: 20, speedMax: 80,
      sizeMin: 2, sizeMax: 4,
      lifeMin: 0.3, lifeMax: 0.7,
      gravity: 300,
      friction: 0.2,
      spread: 10
    }
  };

  /* ── Convenience spawn methods on ParticleSystem ────────── */

  /** Burst preset at element center (relative to canvas) */
  ParticleSystem.prototype.burstAt = function(x, y, presetName, count) {
    this.spawn({
      x: x, y: y,
      count: count || 30,
      preset: presetName || 'GOLD_BURST'
    });
  };

  /** Burst at a DOM element's center (calculates position relative to canvas parent) */
  ParticleSystem.prototype.burstAtElement = function(el, presetName, count) {
    if (!el || !this.canvas) return;
    var cRect = this.canvas.getBoundingClientRect();
    var eRect = el.getBoundingClientRect();
    var x = eRect.left + eRect.width / 2 - cRect.left;
    var y = eRect.top + eRect.height / 2 - cRect.top;
    this.burstAt(x, y, presetName, count);
  };

  KHC.ParticleSystem = ParticleSystem;


  /* ──────────────────────────────────────────────────────────
     Utility: Create an overlay canvas on top of a DOM element
     Returns { canvas, ctx, ps } with particle system ready
     ────────────────────────────────────────────────────────── */
  KHC.createOverlay = function(parentEl) {
    if (!parentEl) return null;
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:10;';
    if (!parentEl.style.position || parentEl.style.position === 'static') {
      parentEl.style.position = 'relative';
    }
    parentEl.appendChild(canvas);

    var rect = parentEl.getBoundingClientRect();
    var ctx = KHC.DPR.setup(canvas, rect.width, rect.height);
    var ps = new ParticleSystem(canvas, { overlay: true });

    return { canvas: canvas, ctx: ctx, ps: ps };
  };


  /* ──────────────────────────────────────────────────────────
     Ring — Animated progress ring (donut)
     Used for: vocab/grammar tracker, quest progress, mastery

     Usage:
       var ring = new KHCanvas.Ring(canvas, {
         radius: 30, lineWidth: 6,
         bgColor: 'rgba(255,255,255,.08)',
         colors: ['#a78bfa','#7c3aed'],  // gradient stops
         textColor: '#fff', showText: true
       });
       ring.setProgress(0.75);           // animate to 75%
       ring.setProgress(1, 'complete');   // uses complete colors
     ────────────────────────────────────────────────────────── */

  function Ring(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.ctx = null;
    this.w = 0;
    this.h = 0;
    this.radius = opts.radius || 30;
    this.lineWidth = opts.lineWidth || 6;
    this.bgColor = opts.bgColor || 'rgba(255,255,255,.08)';
    this.colors = opts.colors || ['#a78bfa', '#7c3aed'];
    this.completeColors = opts.completeColors || ['#34d399', '#22c55e'];
    this.glowColor = opts.glowColor || 'rgba(124,58,237,.3)';
    this.completeGlowColor = opts.completeGlowColor || 'rgba(52,211,153,.3)';
    this.textColor = opts.textColor || '#fff';
    this.textFont = opts.textFont || '900 sans-serif';
    this.showText = opts.showText !== undefined ? opts.showText : true;
    this.textValue = opts.textValue || '';     // custom text; if empty, shows percentage
    this.current = 0;     // current animated value 0-1
    this.target = 0;      // target value 0-1
    this._mode = 'normal';
    this._animId = 'ring-' + (++_psCounter);
    this._setup();
  }

  Ring.prototype._setup = function() {
    if (!this.canvas) return;
    var size = this.radius * 2 + this.lineWidth * 2 + 4;
    this.w = size;
    this.h = size;
    this.ctx = KHC.DPR.setup(this.canvas, size, size);
    this._draw();
  };

  Ring.prototype.resize = function(radius) {
    if (radius) this.radius = radius;
    this._setup();
  };

  Ring.prototype.setProgress = function(value, mode) {
    this.target = Math.max(0, Math.min(1, value));
    this._mode = mode || (this.target >= 1 ? 'complete' : 'normal');
    var self = this;

    if (!KHC.AnimLoop.has(this._animId)) {
      KHC.AnimLoop.register(this._animId, function(dt) {
        self.current += (self.target - self.current) * Math.min(1, dt * 8);
        if (Math.abs(self.current - self.target) < 0.003) {
          self.current = self.target;
          KHC.AnimLoop.unregister(self._animId);
        }
        self._draw();
      });
    }
  };

  /** Set custom center text (overrides percentage) */
  Ring.prototype.setText = function(txt) {
    this.textValue = txt;
    this._draw();
  };

  Ring.prototype._draw = function() {
    var ctx = this.ctx;
    if (!ctx) return;
    var cx = this.w / 2;
    var cy = this.h / 2;
    var r = this.radius;
    var lw = this.lineWidth;

    // Clear
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();

    // Background ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = this.bgColor;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Progress arc
    if (this.current > 0.001) {
      var startAngle = -Math.PI / 2;
      var endAngle = startAngle + Math.PI * 2 * this.current;
      var isComplete = this._mode === 'complete';
      var cols = isComplete ? this.completeColors : this.colors;

      // Gradient
      var g = ctx.createLinearGradient(0, 0, this.w, this.h);
      g.addColorStop(0, cols[0]);
      g.addColorStop(1, cols[cols.length - 1]);

      // Glow layer
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.strokeStyle = isComplete ? this.completeGlowColor : this.glowColor;
      ctx.lineWidth = lw + 4;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Main arc
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.strokeStyle = g;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Center text
    if (this.showText) {
      var txt = this.textValue || Math.round(this.current * 100) + '%';
      var fontSize = Math.round(r * 0.55);
      ctx.fillStyle = this.textColor;
      ctx.font = '900 ' + fontSize + 'px ' + this.textFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, cx, cy);
    }
  };

  /** Destroy and stop animation */
  Ring.prototype.destroy = function() {
    KHC.AnimLoop.unregister(this._animId);
  };

  KHC.Ring = Ring;


  /* ──────────────────────────────────────────────────────────
     Gauge — Timer countdown ring with color transitions
     Used for: quiz timer (green→yellow→red)

     Usage:
       var gauge = new KHCanvas.Gauge(canvas, {
         radius: 40, lineWidth: 8, duration: 15
       });
       gauge.start(function onExpire() { console.log('time up!'); });
       gauge.pause(); gauge.resume(); gauge.reset();
     ────────────────────────────────────────────────────────── */

  function Gauge(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.ctx = null;
    this.w = 0;
    this.h = 0;
    this.radius = opts.radius || 40;
    this.lineWidth = opts.lineWidth || 8;
    this.bgColor = opts.bgColor || 'rgba(255,255,255,.08)';
    this.duration = opts.duration || 15;  // seconds
    this.textColor = opts.textColor || '#fff';
    this.textFont = opts.textFont || '700 sans-serif';
    this.showText = opts.showText !== undefined ? opts.showText : true;
    this.colorStops = opts.colorStops || [
      { at: 1.0, color: '#4ade80' },   // green (full)
      { at: 0.6, color: '#facc15' },   // yellow (60%)
      { at: 0.3, color: '#f97316' },   // orange (30%)
      { at: 0.0, color: '#ef4444' }    // red (empty)
    ];
    this._remaining = this.duration;
    this._running = false;
    this._paused = false;
    this._onExpire = null;
    this._animId = 'gauge-' + (++_psCounter);
    this._pulsePhase = 0;
    this._setup();
  }

  Gauge.prototype._setup = function() {
    if (!this.canvas) return;
    var size = this.radius * 2 + this.lineWidth * 2 + 4;
    this.w = size;
    this.h = size;
    this.ctx = KHC.DPR.setup(this.canvas, size, size);
    this._draw();
  };

  /** Start the countdown */
  Gauge.prototype.start = function(onExpire) {
    this._remaining = this.duration;
    this._onExpire = onExpire || null;
    this._running = true;
    this._paused = false;
    var self = this;

    KHC.AnimLoop.register(this._animId, function(dt) {
      if (!self._running || self._paused) return;
      self._remaining -= dt;
      self._pulsePhase += dt * 6;
      if (self._remaining <= 0) {
        self._remaining = 0;
        self._running = false;
        KHC.AnimLoop.unregister(self._animId);
        self._draw();
        if (self._onExpire) self._onExpire();
        return;
      }
      self._draw();
    });
  };

  Gauge.prototype.pause = function() { this._paused = true; };
  Gauge.prototype.resume = function() { this._paused = false; };

  Gauge.prototype.reset = function(newDuration) {
    this._running = false;
    this._paused = false;
    KHC.AnimLoop.unregister(this._animId);
    if (newDuration) this.duration = newDuration;
    this._remaining = this.duration;
    this._draw();
  };

  /** Get current color based on percentage remaining */
  Gauge.prototype._getColor = function(pct) {
    var stops = this.colorStops;
    for (var i = 0; i < stops.length - 1; i++) {
      if (pct <= stops[i].at && pct >= stops[i + 1].at) {
        var range = stops[i].at - stops[i + 1].at;
        var t = range > 0 ? (pct - stops[i + 1].at) / range : 0;
        return _lerpColor(stops[i + 1].color, stops[i].color, t);
      }
    }
    return stops[stops.length - 1].color;
  };

  Gauge.prototype._draw = function() {
    var ctx = this.ctx;
    if (!ctx) return;
    var cx = this.w / 2;
    var cy = this.h / 2;
    var r = this.radius;
    var lw = this.lineWidth;
    var pct = this._remaining / Math.max(0.001, this.duration);

    // Clear
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();

    // Background ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = this.bgColor;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Progress arc
    if (pct > 0.001) {
      var startAngle = -Math.PI / 2;
      var endAngle = startAngle + Math.PI * 2 * pct;
      var color = this._getColor(pct);

      // Pulse glow when low (< 30%)
      var glowAlpha = pct < 0.3 ? 0.15 + 0.1 * Math.sin(this._pulsePhase) : 0.12;
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.strokeStyle = _hexToRgba(color, glowAlpha);
      ctx.lineWidth = lw + 6;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Main arc
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Center text (seconds remaining)
    if (this.showText) {
      var secs = Math.ceil(this._remaining);
      var fontSize = Math.round(r * 0.55);
      ctx.fillStyle = this.textColor;
      ctx.font = '700 ' + fontSize + 'px ' + this.textFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(secs + 's', cx, cy);
    }
  };

  Gauge.prototype.destroy = function() {
    this._running = false;
    KHC.AnimLoop.unregister(this._animId);
  };

  /** Get remaining seconds */
  Gauge.prototype.getRemaining = function() { return this._remaining; };

  KHC.Gauge = Gauge;


  /* ── Color utility helpers ──────────────────────────────── */

  /** Linearly interpolate between two hex colors */
  function _lerpColor(c1, c2, t) {
    var r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
    var r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
    var r = Math.round(r1 + (r2 - r1) * t);
    var g = Math.round(g1 + (g2 - g1) * t);
    var b = Math.round(b1 + (b2 - b1) * t);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  /** Convert hex color to rgba string */
  function _hexToRgba(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  // Expose color utils for external use
  KHC.lerpColor = _lerpColor;
  KHC.hexToRgba = _hexToRgba;


  /* ──────────────────────────────────────────────────────────
     Radar — 5-axis radar chart (pentagon)
     Used for: Speaking practice scores

     Usage:
       var radar = new KHCanvas.Radar(canvas, {
         axes: ['Accuracy','Fluency','Intonation','Speed','Pronunciation'],
         size: 120,
         fillColor: 'rgba(124,58,237,.25)',
         strokeColor: '#7c3aed',
         gridColor: 'rgba(255,255,255,.1)',
         labelColor: 'rgba(255,255,255,.7)'
       });
       radar.setValues([85, 72, 60, 90, 78]);  // 0-100 per axis
     ────────────────────────────────────────────────────────── */

  function Radar(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.ctx = null;
    this.axes = opts.axes || ['Accuracy', 'Fluency', 'Intonation', 'Speed', 'Pronunciation'];
    this.size = opts.size || 100;           // radius of outer ring
    this.fillColor = opts.fillColor || 'rgba(124,58,237,.2)';
    this.strokeColor = opts.strokeColor || '#7c3aed';
    this.strokeWidth = opts.strokeWidth || 2;
    this.gridColor = opts.gridColor || 'rgba(255,255,255,.1)';
    this.gridLevels = opts.gridLevels || 4; // number of concentric rings
    this.labelColor = opts.labelColor || 'rgba(255,255,255,.7)';
    this.labelFont = opts.labelFont || '700 11px sans-serif';
    this.valueColor = opts.valueColor || '#fff';
    this.valueFont = opts.valueFont || '900 12px sans-serif';
    this.dotColor = opts.dotColor || '#a78bfa';
    this.dotRadius = opts.dotRadius || 4;
    this.showValues = opts.showValues !== undefined ? opts.showValues : true;
    this.values = [];      // current animated values 0-100
    this.targets = [];     // target values 0-100
    this._animId = 'radar-' + (++_psCounter);
    this._padding = opts.padding || 40;
    this._setup();
  }

  Radar.prototype._setup = function() {
    if (!this.canvas) return;
    var totalSize = (this.size + this._padding) * 2;
    this.ctx = KHC.DPR.setup(this.canvas, totalSize, totalSize);
    this.values = new Array(this.axes.length).fill(0);
    this.targets = new Array(this.axes.length).fill(0);
    this._draw();
  };

  Radar.prototype.setValues = function(vals) {
    var self = this;
    for (var i = 0; i < this.axes.length; i++) {
      this.targets[i] = Math.max(0, Math.min(100, vals[i] || 0));
    }

    if (!KHC.AnimLoop.has(this._animId)) {
      KHC.AnimLoop.register(this._animId, function(dt) {
        var done = true;
        for (var i = 0; i < self.axes.length; i++) {
          self.values[i] += (self.targets[i] - self.values[i]) * Math.min(1, dt * 6);
          if (Math.abs(self.values[i] - self.targets[i]) > 0.5) done = false;
          else self.values[i] = self.targets[i];
        }
        self._draw();
        if (done) KHC.AnimLoop.unregister(self._animId);
      });
    }
  };

  /** Get current values (for reading/saving) */
  Radar.prototype.getValues = function() {
    return this.targets.slice();
  };

  Radar.prototype._draw = function() {
    var ctx = this.ctx;
    if (!ctx) return;
    var n = this.axes.length;
    var cx = this.size + this._padding;
    var cy = cx;
    var r = this.size;

    // Clear
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();

    // Helper: get point on polygon
    function pt(axis, dist) {
      var angle = (Math.PI * 2 * axis) / n - Math.PI / 2;
      return { x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist };
    }

    // Draw grid rings
    for (var lvl = 1; lvl <= this.gridLevels; lvl++) {
      var gr = r * (lvl / this.gridLevels);
      ctx.beginPath();
      for (var i = 0; i < n; i++) {
        var gp = pt(i, gr);
        i === 0 ? ctx.moveTo(gp.x, gp.y) : ctx.lineTo(gp.x, gp.y);
      }
      ctx.closePath();
      ctx.strokeStyle = this.gridColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw axis lines
    for (var i = 0; i < n; i++) {
      var ep = pt(i, r);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ep.x, ep.y);
      ctx.strokeStyle = this.gridColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw filled value area
    ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var vr = r * (this.values[i] / 100);
      var vp = pt(i, vr);
      i === 0 ? ctx.moveTo(vp.x, vp.y) : ctx.lineTo(vp.x, vp.y);
    }
    ctx.closePath();
    ctx.fillStyle = this.fillColor;
    ctx.fill();
    ctx.strokeStyle = this.strokeColor;
    ctx.lineWidth = this.strokeWidth;
    ctx.stroke();

    // Draw dots at each value point
    for (var i = 0; i < n; i++) {
      var vr = r * (this.values[i] / 100);
      var vp = pt(i, vr);
      ctx.beginPath();
      ctx.arc(vp.x, vp.y, this.dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = this.dotColor;
      ctx.fill();
    }

    // Draw labels + values
    for (var i = 0; i < n; i++) {
      var lp = pt(i, r + 18);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Adjust alignment for left/right labels
      var angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      if (Math.cos(angle) < -0.3) ctx.textAlign = 'right';
      else if (Math.cos(angle) > 0.3) ctx.textAlign = 'left';
      if (Math.sin(angle) < -0.3) ctx.textBaseline = 'bottom';
      else if (Math.sin(angle) > 0.3) ctx.textBaseline = 'top';

      // Axis label
      ctx.font = this.labelFont;
      ctx.fillStyle = this.labelColor;
      ctx.fillText(this.axes[i], lp.x, lp.y);

      // Value number
      if (this.showValues) {
        var vp2 = pt(i, r + 30);
        ctx.font = this.valueFont;
        ctx.fillStyle = this.valueColor;
        ctx.fillText(Math.round(this.values[i]), vp2.x, vp2.y);
      }
    }
  };

  Radar.prototype.destroy = function() {
    KHC.AnimLoop.unregister(this._animId);
  };

  KHC.Radar = Radar;


  /* ──────────────────────────────────────────────────────────
     hideBottomNav / showBottomNav
     Hide the mobile bottom nav when a fullscreen overlay is open
     ────────────────────────────────────────────────────────── */
  KHC.hideBottomNav = function() {
    var nav = document.querySelector('.mobile-bottom-nav');
    if (nav) nav.style.display = 'none';
  };
  KHC.showBottomNav = function() {
    var nav = document.querySelector('.mobile-bottom-nav');
    if (nav) nav.style.display = '';
  };

})();
