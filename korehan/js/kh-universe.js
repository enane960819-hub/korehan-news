/* ────────────────────────────────────────────────────────────
 * KHUniverse — 3D vocabulary galaxy (Three.js)
 *
 * Lazy-loads three.js via ESM dynamic import on first open so the
 * ~150KB payload never touches users who don't open the view.
 *
 * Public API (set on window.KHUniverse):
 *   open(opts)   — opens the fullscreen modal
 *     opts.words       : Array<{ko, en, rom, review_count?, correct_count?}>
 *     opts.title?      : string   (header title)
 *   close()      — closes the modal, disposes GL resources
 *
 * This step (S1) renders a placeholder galaxy from the provided words
 * with orbit camera + nebula background. Click interactions, related
 * words, and the Universe button come in later steps.
 * ──────────────────────────────────────────────────────────── */
(function() {
  var OVERLAY_ID = 'kh-universe-overlay';
  var THREE = null;          // cached Three module
  var _threeLoading = null;  // promise during first load

  var state = {
    open: false,
    renderer: null,
    scene: null,
    camera: null,
    clock: null,
    animId: null,
    stars: null,           // THREE.Group of word sprites
    nebula: null,          // background points
    glowTex: null,
    words: [],
    // Orbit camera state
    cam: { theta: 0, phi: Math.PI * 0.42, radius: 52, target: { x: 0, y: 0, z: 0 } },
    drag: null,            // { startX, startY, theta, phi } while dragging
    autoRotate: true,
  };

  // ── Three.js lazy load (ESM from esm.sh) ────────────────────
  function loadThree() {
    if (THREE) return Promise.resolve(THREE);
    if (_threeLoading) return _threeLoading;
    _threeLoading = import('https://esm.sh/three@0.160.0').then(function(m) {
      THREE = m;
      return THREE;
    });
    return _threeLoading;
  }

  // ── DOM helpers ─────────────────────────────────────────────
  function ensureOverlay() {
    var ov = document.getElementById(OVERLAY_ID);
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = OVERLAY_ID;
    ov.className = 'kh-universe-overlay';
    ov.innerHTML = [
      '<div class="khu-header">',
      '  <div class="khu-header-info">',
      '    <div class="khu-eyebrow">Vocabulary</div>',
      '    <div class="khu-title" id="khu-title">Your Universe</div>',
      '  </div>',
      '  <div class="khu-stats" id="khu-stats"></div>',
      '  <button class="khu-close" onclick="KHUniverse.close()" aria-label="Close">✕</button>',
      '</div>',
      '<canvas class="khu-canvas" id="khu-canvas"></canvas>',
      '<div class="khu-hint" id="khu-hint">Drag to orbit · Scroll to zoom</div>',
      '<div class="khu-loading" id="khu-loading"><div class="khu-spin"></div><div>Loading your galaxy…</div></div>'
    ].join('');
    document.body.appendChild(ov);
    injectStyles();
    return ov;
  }

  function injectStyles() {
    if (document.getElementById('kh-universe-styles')) return;
    var s = document.createElement('style');
    s.id = 'kh-universe-styles';
    s.textContent = [
      '.kh-universe-overlay{position:fixed;inset:0;z-index:9500;background:radial-gradient(ellipse at center,#0a0e22 0%,#04060f 70%,#02030a 100%);display:none;opacity:0;transition:opacity .35s ease;}',
      '.kh-universe-overlay.open{display:block;opacity:1;}',
      '.khu-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;}',
      '.khu-header{position:absolute;top:0;left:0;right:0;z-index:2;display:flex;align-items:center;gap:14px;padding:18px 20px;pointer-events:none;}',
      '.khu-header > *{pointer-events:auto;}',
      '.khu-header-info{flex:1;min-width:0;}',
      '.khu-eyebrow{font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:rgba(180,200,255,.55);}',
      '.khu-title{font-family:\'Playfair Display\',\'Noto Serif KR\',serif;font-size:22px;font-weight:900;color:#fff;line-height:1.1;margin-top:2px;text-shadow:0 2px 14px rgba(120,100,255,.35);}',
      '.khu-stats{font-size:11px;font-weight:800;letter-spacing:.06em;color:rgba(200,210,255,.7);padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);white-space:nowrap;}',
      '.khu-close{width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.14);background:rgba(15,20,40,.55);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:#fff;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .15s,transform .12s;}',
      '.khu-close:hover{background:rgba(255,255,255,.15);transform:scale(1.06);}',
      '.khu-hint{position:absolute;bottom:24px;left:50%;transform:translateX(-50%);z-index:2;font-size:11px;letter-spacing:.08em;color:rgba(180,200,255,.45);pointer-events:none;animation:khuHintFade 6s ease-in-out 1s forwards;}',
      '@keyframes khuHintFade{0%,60%{opacity:1;}100%{opacity:0;}}',
      '.khu-loading{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:rgba(200,210,255,.75);font-size:13px;letter-spacing:.04em;z-index:3;pointer-events:none;transition:opacity .3s;}',
      '.khu-loading.hidden{opacity:0;pointer-events:none;}',
      '.khu-spin{width:28px;height:28px;border-radius:50%;border:2px solid rgba(180,200,255,.18);border-top-color:#a78bfa;animation:khuSpin .9s linear infinite;}',
      '@keyframes khuSpin{to{transform:rotate(360deg);}}',
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── Galaxy geometry ────────────────────────────────────────
  // Arrange N words in a 4-arm spiral galaxy. Mastery (0..1) → shift
  // closer to the galactic core + brighter.
  function galaxyPosition(i, total, mastery) {
    var arms = 4;
    var t = i / Math.max(1, total);
    var arm = i % arms;
    var distance = Math.pow(t, 0.65) * 38 + 3;   // outer radius ~41
    distance *= (1 - mastery * 0.28);            // mastered words drift in
    var armAngle = (arm / arms) * Math.PI * 2;
    var twist = distance * 0.18;
    var jitter = (Math.random() - 0.5) * 2.2;
    var angle = armAngle + twist + jitter;
    var y = (Math.random() - 0.5) * (1.5 + distance * 0.05);
    return {
      x: Math.cos(angle) * distance,
      y: y,
      z: Math.sin(angle) * distance
    };
  }

  function wordMastery(w) {
    // Use SRS review counts if present; otherwise fall back to a mid value.
    var c = (w && w.correct_count) || 0;
    var r = (w && w.review_count)  || 0;
    if (r <= 0) return 0.1;
    return Math.max(0, Math.min(1, c / Math.max(r, 3)));
  }

  function masteryColor(m) {
    // m in [0..1] → lavender → mint → gold
    if (m < 0.4) return { r: 0.66, g: 0.55, b: 0.98 };   // lavender
    if (m < 0.75) return { r: 0.31, g: 0.80, b: 0.77 };  // mint
    return { r: 0.96, g: 0.66, b: 0.24 };                // gold
  }

  // ── Textures ────────────────────────────────────────────────
  function makeGlowTexture(three) {
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0.00, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.45, 'rgba(200,180,255,0.28)');
    g.addColorStop(1.00, 'rgba(100,80,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    var tex = new three.CanvasTexture(c);
    tex.colorSpace = three.SRGBColorSpace || three.sRGBEncoding;
    return tex;
  }

  // ── Build scene ─────────────────────────────────────────────
  function buildScene(three, canvas) {
    var scene = new three.Scene();
    scene.background = null;
    scene.fog = new three.FogExp2(0x040612, 0.012);

    var w = canvas.clientWidth, h = canvas.clientHeight;
    var camera = new three.PerspectiveCamera(55, w / h, 0.1, 500);
    updateCameraFromOrbit(camera);

    var renderer = new three.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);

    state.glowTex = makeGlowTexture(three);

    // Background nebula — 1200 tiny dim stars in a sphere
    var nebGeo = new three.BufferGeometry();
    var nebCount = 1200;
    var nebPos = new Float32Array(nebCount * 3);
    var nebCol = new Float32Array(nebCount * 3);
    for (var i = 0; i < nebCount; i++) {
      var r = 80 + Math.random() * 140;
      var a = Math.random() * Math.PI * 2;
      var b = Math.acos(2 * Math.random() - 1);
      nebPos[i * 3 + 0] = r * Math.sin(b) * Math.cos(a);
      nebPos[i * 3 + 1] = r * Math.cos(b) * 0.5;
      nebPos[i * 3 + 2] = r * Math.sin(b) * Math.sin(a);
      var bri = 0.35 + Math.random() * 0.45;
      var tint = Math.random();
      nebCol[i * 3 + 0] = bri * (tint < 0.5 ? 0.75 : 1.0);
      nebCol[i * 3 + 1] = bri * 0.85;
      nebCol[i * 3 + 2] = bri * (tint > 0.5 ? 1.0 : 0.85);
    }
    nebGeo.setAttribute('position', new three.BufferAttribute(nebPos, 3));
    nebGeo.setAttribute('color',    new three.BufferAttribute(nebCol, 3));
    var nebMat = new three.PointsMaterial({
      size: 0.55, vertexColors: true, transparent: true, opacity: 0.9,
      blending: three.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    });
    state.nebula = new three.Points(nebGeo, nebMat);
    scene.add(state.nebula);

    // Word stars — individual Sprites so each is clickable later
    var starsGroup = new three.Group();
    scene.add(starsGroup);
    state.stars = starsGroup;

    rebuildWordStars(three, starsGroup);

    // Soft ambient glow at the core
    var core = new three.PointLight(0x9080ff, 1.4, 60, 1.6);
    core.position.set(0, 0, 0);
    scene.add(core);

    state.scene = scene;
    state.camera = camera;
    state.renderer = renderer;
    state.clock = new three.Clock();

    window.addEventListener('resize', onResize);
  }

  function rebuildWordStars(three, group) {
    // Clear existing
    while (group.children.length) {
      var c = group.children.pop();
      if (c.material) c.material.dispose();
    }
    var words = state.words || [];
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      var m = wordMastery(w);
      var pos = galaxyPosition(i, words.length, m);
      var col = masteryColor(m);
      var mat = new three.SpriteMaterial({
        map: state.glowTex,
        color: new three.Color(col.r, col.g, col.b),
        transparent: true,
        opacity: 0.55 + m * 0.4,
        blending: three.AdditiveBlending,
        depthWrite: false,
      });
      var sprite = new three.Sprite(mat);
      sprite.position.set(pos.x, pos.y, pos.z);
      var size = 1.1 + m * 1.6;
      sprite.scale.set(size, size, 1);
      sprite.userData = { word: w, mastery: m, idx: i };
      group.add(sprite);
    }
  }

  function updateCameraFromOrbit(camera) {
    var c = state.cam;
    camera.position.x = c.target.x + c.radius * Math.sin(c.phi) * Math.cos(c.theta);
    camera.position.y = c.target.y + c.radius * Math.cos(c.phi);
    camera.position.z = c.target.z + c.radius * Math.sin(c.phi) * Math.sin(c.theta);
    camera.lookAt(c.target.x, c.target.y, c.target.z);
  }

  // ── Orbit controls (custom, lightweight) ────────────────────
  function bindControls(canvas) {
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup',   onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
  }
  function unbindControls(canvas) {
    if (!canvas) return;
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup',   onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    canvas.removeEventListener('wheel', onWheel);
  }

  function onPointerDown(e) {
    state.drag = {
      startX: e.clientX, startY: e.clientY,
      theta: state.cam.theta, phi: state.cam.phi,
      id: e.pointerId
    };
    state.autoRotate = false;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch(_) {}
  }
  function onPointerMove(e) {
    if (!state.drag) return;
    var dx = e.clientX - state.drag.startX;
    var dy = e.clientY - state.drag.startY;
    state.cam.theta = state.drag.theta - dx * 0.006;
    state.cam.phi   = Math.max(0.15, Math.min(Math.PI - 0.15, state.drag.phi - dy * 0.005));
    updateCameraFromOrbit(state.camera);
  }
  function onPointerUp(e) {
    state.drag = null;
  }
  function onWheel(e) {
    e.preventDefault();
    var next = state.cam.radius * (e.deltaY > 0 ? 1.12 : 0.89);
    state.cam.radius = Math.max(14, Math.min(120, next));
    updateCameraFromOrbit(state.camera);
  }

  function onResize() {
    var r = state.renderer, cam = state.camera;
    if (!r || !cam) return;
    var canvas = r.domElement;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    r.setSize(w, h, false);
  }

  // ── Render loop ─────────────────────────────────────────────
  function tick() {
    state.animId = requestAnimationFrame(tick);
    var dt = state.clock ? state.clock.getDelta() : 0.016;
    if (state.autoRotate) {
      state.cam.theta += dt * 0.06;
      updateCameraFromOrbit(state.camera);
    }
    if (state.nebula) state.nebula.rotation.y += dt * 0.008;
    if (state.stars)  state.stars.rotation.y  += dt * 0.015;
    state.renderer.render(state.scene, state.camera);
  }

  // ── Public API ──────────────────────────────────────────────
  var KHUniverse = {};

  KHUniverse.open = function(opts) {
    opts = opts || {};
    var overlay = ensureOverlay();
    var loading = document.getElementById('khu-loading');
    overlay.classList.add('open');
    state.open = true;
    state.words = (opts.words || []).slice(0, 600);

    // Header
    var titleEl = document.getElementById('khu-title');
    if (titleEl) titleEl.textContent = opts.title || 'Your Vocabulary Universe';
    var statsEl = document.getElementById('khu-stats');
    if (statsEl) statsEl.textContent = '⭐ ' + state.words.length + ' stars';

    // Lock body scroll
    document.body.style.overflow = 'hidden';

    loadThree().then(function(three) {
      if (!state.open) return; // closed before load finished
      var canvas = document.getElementById('khu-canvas');
      // Size canvas to overlay
      canvas.width  = canvas.clientWidth  * (window.devicePixelRatio || 1);
      canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1);
      if (state.renderer) {
        // Re-entry: rebuild stars only
        state.words && rebuildWordStars(three, state.stars);
      } else {
        buildScene(three, canvas);
        bindControls(canvas);
      }
      if (loading) loading.classList.add('hidden');
      if (!state.animId) tick();
    }).catch(function(err) {
      if (loading) loading.innerHTML = '<div style="color:#fca5a5">Could not load the galaxy engine.</div>';
      console.warn('[KHUniverse] three load failed', err);
    });
  };

  KHUniverse.close = function() {
    state.open = false;
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.classList.remove('open');
    if (state.animId) { cancelAnimationFrame(state.animId); state.animId = null; }
    if (state.renderer) unbindControls(state.renderer.domElement);
    document.body.style.overflow = '';
  };

  window.KHUniverse = KHUniverse;
})();
