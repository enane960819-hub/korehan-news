/* ============================================================
   KHCanvas — Shared Canvas Engine  v1
   KoreHani Study Room interactive learning utilities
   ============================================================
   Modules:
     KHCanvas.DPR          — HiDPI canvas setup
     KHCanvas.AnimLoop     — Central requestAnimationFrame manager
     KHCanvas.Particle     — Single particle data
     KHCanvas.ParticleSystem — Spawn, update, draw particle pools
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

})();
