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
    satellites: null,      // THREE.Group of related-word satellite sprites (per selection)
    categories: null,      // THREE.Group of category label pills + weakness hints
    constellation: null,   // THREE.Group of category-highlight lines (per active category)
    activeCategory: null,  // currently highlighted category tag, or null
    nebula: null,          // background points
    corpus: null,          // THREE.Points of vocabulary_bank entries not saved by user
    corpusMeta: null,      // parallel array of { ko, rom, en, cat, x, y, z } per corpus point
    corpusLabels: null,    // THREE.Group of on-demand label sprites for the nearest corpus words
    corpusLabelsActive: {},// idx → sprite, so we can skip already-labeled points
    corpusLabelsTickAt: 0, // throttle timestamp
    glowTex: null,
    words: [],
    corpusWords: [],       // raw vocab_bank entries used to build corpus points
    raycaster: null,       // THREE.Raycaster for picking
    pointerNDC: { x: 0, y: 0 },
    selected: null,        // { sprite, word, baseScale }
    hovered: null,         // { sprite, baseScale }
    clusterCenters: null,  // { [cat]: { x,y,z, words:[], avgMastery, color } }
    // Orbit camera state
    cam: { theta: 0, phi: Math.PI * 0.42, radius: 62, target: { x: 0, y: 0, z: 0 } },
    drag: null,            // { startX, startY, theta, phi } while dragging
    autoRotate: true,
  };

  // Category palette: each interest_tag in vocabulary_bank maps to a tint.
  // Unknowns land in 'misc' (a desaturated lavender/gray).
  var CAT_COLORS = {
    everyday:    { r: 0.31, g: 0.80, b: 0.77 }, // mint
    food:        { r: 1.00, g: 0.45, b: 0.45 }, // coral
    travel:      { r: 0.96, g: 0.66, b: 0.24 }, // gold
    business:    { r: 0.55, g: 0.72, b: 0.96 }, // soft blue
    work:        { r: 0.55, g: 0.72, b: 0.96 },
    kpop:        { r: 1.00, g: 0.40, b: 0.70 }, // pink
    music:       { r: 1.00, g: 0.40, b: 0.70 },
    news:        { r: 0.36, g: 0.56, b: 0.95 }, // blue
    politics:    { r: 0.36, g: 0.56, b: 0.95 },
    economy:     { r: 0.36, g: 0.56, b: 0.95 },
    culture:     { r: 0.66, g: 0.55, b: 0.98 }, // lavender
    society:     { r: 0.66, g: 0.55, b: 0.98 },
    tech:        { r: 0.20, g: 0.80, b: 0.93 }, // cyan
    sports:      { r: 0.22, g: 0.85, b: 0.45 }, // green
    health:      { r: 0.22, g: 0.85, b: 0.45 },
    nature:      { r: 0.45, g: 0.88, b: 0.55 },
    drama:       { r: 0.90, g: 0.50, b: 0.90 }, // magenta
    movie:       { r: 0.90, g: 0.50, b: 0.90 },
    entertainment:{r: 0.90, g: 0.50, b: 0.90 },
    family:      { r: 0.98, g: 0.72, b: 0.55 }, // peach
    friends:     { r: 0.98, g: 0.72, b: 0.55 },
    dating:      { r: 1.00, g: 0.55, b: 0.75 }, // rose
    study:       { r: 0.60, g: 0.75, b: 0.95 },
    education:   { r: 0.60, g: 0.75, b: 0.95 },
    misc:        { r: 0.60, g: 0.60, b: 0.75 }  // neutral lavender-grey
  };

  function catColor(cat) {
    return CAT_COLORS[cat] || CAT_COLORS.misc;
  }

  function normCategory(tag) {
    if (!tag) return 'misc';
    tag = String(tag).toLowerCase().trim();
    // Map common aliases so we don't end up with look-alike clusters
    var aliases = {
      '일상': 'everyday', 'daily': 'everyday',
      '음식': 'food', 'cooking': 'food',
      '여행': 'travel', 'trip': 'travel',
      '비즈니스': 'business', '업무': 'business', '회사': 'work',
      '뉴스': 'news',
      '문화': 'culture',
      '사회': 'society',
      '기술': 'tech', 'technology': 'tech', 'it': 'tech',
      '스포츠': 'sports',
      '음악': 'music', 'song': 'music',
      '드라마': 'drama', '영화': 'movie',
      '건강': 'health', '의료': 'health',
      '공부': 'study', '학습': 'study', '교육': 'education'
    };
    if (aliases[tag]) return aliases[tag];
    if (CAT_COLORS[tag]) return tag;
    return 'misc';
  }

  // ── Three.js lazy load — jsdelivr (whitelisted by site CSP) ─
  // Tries the /+esm bundle first, then falls back to the raw module
  // file; both live on cdn.jsdelivr.net so CSP's script-src is happy.
  function _tryImport(url) {
    return new Promise(function(resolve, reject) {
      import(/* @vite-ignore */ url).then(resolve, reject);
    });
  }
  function loadThree() {
    if (THREE) return Promise.resolve(THREE);
    if (_threeLoading) return _threeLoading;
    var urls = [
      'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm',
      'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js'
    ];
    _threeLoading = (function tryNext(i) {
      if (i >= urls.length) return Promise.reject(new Error('all three CDNs failed'));
      return _tryImport(urls[i]).then(function(m) {
        THREE = m;
        return THREE;
      }, function(err) {
        console.warn('[KHUniverse] three import failed for', urls[i], err);
        return tryNext(i + 1);
      });
    })(0);
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
      // Nebula backdrop layer — sits behind everything else and
      // gives the overlay an actual deep-space atmosphere instead
      // of just the flat radial gradient. Three real astrophoto
      // backdrops; KHUniverse.open() picks one per session and
      // toggles its .active class. mix-blend-mode:screen on the
      // CSS layer side lets the nebula starlight fuse with the
      // existing gradient without washing out the canvas stars.
      '<div class="khu-nebula" id="khu-nebula-witch"  aria-hidden="true"></div>',
      '<div class="khu-nebula" id="khu-nebula-carina" aria-hidden="true"></div>',
      '<div class="khu-nebula" id="khu-nebula-cliffs" aria-hidden="true"></div>',
      '<div class="khu-vignette" aria-hidden="true"></div>',
      '<div class="khu-header">',
      '  <div class="khu-header-info">',
      '    <div class="khu-eyebrow">Vocabulary</div>',
      '    <div class="khu-title" id="khu-title">Your Universe</div>',
      '  </div>',
      '  <div class="khu-stats" id="khu-stats"></div>',
      '  <button class="khu-bgm" id="khu-bgm-btn" type="button" aria-label="Toggle background music" onclick="KHUniverse._toggleBgm()">',
      '    <svg class="khu-bgm-on"  viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
      '    <svg class="khu-bgm-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><line x1="3" y1="3" x2="21" y2="21"/></svg>',
      '  </button>',
      '  <button class="khu-close" onclick="KHUniverse.close()" aria-label="Close">✕</button>',
      '</div>',
      // Background music — looped, low-volume ambient. Source paths
      // resolve against the deployed root; drop the actual track at
      // /img/universe/bgm.mp3 (or .ogg). preload=metadata so the
      // overlay opens instantly and the file streams in on demand.
      '<audio id="khu-bgm" preload="none" loop>',
      '  <source src="img/universe/bgm.mp3" type="audio/mpeg">',
      '  <source src="img/universe/bgm.ogg" type="audio/ogg">',
      '</audio>',
      '<canvas class="khu-canvas" id="khu-canvas"></canvas>',
      '<div class="khu-zoom">',
      '  <button class="khu-zoom-btn" aria-label="Zoom in" onclick="KHUniverse._zoom(0.8)">+</button>',
      '  <button class="khu-zoom-btn" aria-label="Zoom out" onclick="KHUniverse._zoom(1.25)">−</button>',
      '  <button class="khu-zoom-btn khu-zoom-reset" aria-label="Reset view" onclick="KHUniverse._resetView()">⤾</button>',
      '</div>',
      '<div class="khu-hint" id="khu-hint">Drag to orbit · Tap a category to light up its constellation · Pinch / scroll to zoom</div>',
      '<div class="khu-card" id="khu-card" aria-hidden="true">',
      '  <button class="khu-card-close" aria-label="Close" onclick="KHUniverse._clearSelection()">✕</button>',
      '  <div class="khu-card-badge" id="khu-card-badge">—</div>',
      '  <div class="khu-card-ko" id="khu-card-ko"></div>',
      '  <div class="khu-card-rom" id="khu-card-rom"></div>',
      '  <div class="khu-card-en"  id="khu-card-en"></div>',
      '  <div class="khu-card-related" id="khu-card-related"></div>',
      '</div>',
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
      '.kh-universe-overlay{position:fixed;inset:0;z-index:9500;background:radial-gradient(ellipse at center,#0a0e22 0%,#04060f 70%,#02030a 100%);display:none;opacity:0;transition:opacity .35s ease;overflow:hidden;}',
      '.kh-universe-overlay.open{display:block;opacity:1;}',
      // ── Nebula backdrops ────────────────────────────────────
      // Each layer is a full-bleed astrophoto, hidden by default;
      // KHUniverse.open() activates one per session. Screen blend
      // mode + slight saturation so the nebula colour reads but
      // the existing dark gradient still anchors the contrast for
      // the white star points painted on the canvas above. The
      // 90s khuDrift animation is a very slow scale + translate
      // — adds depth without distracting from the constellation.
      // Explicit inset:0 + transform:scale(1.08) instead of the
      // earlier inset:-8% — on Samsung Internet / some Chromium
      // mobile builds the negative-inset percentages computed
      // against an offset containing block and left a vertical
      // dark stripe on one edge (the user's circled bug).
      '.khu-nebula{position:absolute;inset:0;background-position:center;background-size:cover;background-repeat:no-repeat;opacity:0;transition:opacity .35s ease;mix-blend-mode:screen;filter:saturate(.9) hue-rotate(-8deg) contrast(1);will-change:transform,opacity;pointer-events:none;transform:scale(1.08);}',
      '.khu-nebula.active{opacity:.48;animation:khuDrift 90s ease-in-out infinite alternate;}',
      '#khu-nebula-witch{background-image:url(\'img/universe/witch-head.jpg\');}',
      '#khu-nebula-carina{background-image:url(\'img/universe/carina.webp\');}',
      '#khu-nebula-cliffs{background-image:url(\'img/universe/cosmic-cliffs.jpg\');}',
      '@keyframes khuDrift{0%{transform:scale(1.08) translate3d(-1.2%,-.8%,0);}50%{transform:scale(1.12) translate3d(1.4%,.6%,0);}100%{transform:scale(1.09) translate3d(-.6%,1%,0);}}',
      // Soft vignette on top of the nebula so the corners stay
      // dark and the header / word card text keeps contrast.
      '.khu-vignette{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 35%,rgba(2,3,10,.35) 75%,rgba(2,3,10,.7) 100%);}',
      '.khu-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;}',
      '.khu-header{position:absolute;top:0;left:0;right:0;z-index:2;display:flex;align-items:center;gap:14px;padding:calc(env(safe-area-inset-top,0px) + 18px) calc(env(safe-area-inset-right,0px) + 20px) 14px calc(env(safe-area-inset-left,0px) + 20px);pointer-events:none;}',
      '.khu-header > *{pointer-events:auto;}',
      '.khu-header-info{flex:1;min-width:0;}',
      '.khu-eyebrow{font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:rgba(180,200,255,.55);}',
      '.khu-title{font-family:\'Playfair Display\',\'Noto Serif KR\',serif;font-size:22px;font-weight:900;color:#fff;line-height:1.1;margin-top:2px;text-shadow:0 2px 14px rgba(120,100,255,.35);}',
      '.khu-stats{font-size:11px;font-weight:800;letter-spacing:.06em;color:rgba(200,210,255,.7);padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);white-space:nowrap;}',
      '.khu-close{width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.14);background:rgba(15,20,40,.55);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:#fff;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .15s,transform .12s;}',
      '.khu-close:hover{background:rgba(255,255,255,.15);transform:scale(1.06);}',
      // BGM toggle — same shape as close, sits to its left. The two
      // SVGs swap visibility based on .muted on the parent button.
      '.khu-bgm{width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.14);background:rgba(15,20,40,.55);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:#fff;cursor:pointer;font-family:inherit;transition:background .15s,transform .12s,color .15s;display:inline-flex;align-items:center;justify-content:center;padding:0;}',
      '.khu-bgm:hover{background:rgba(125,211,252,.18);transform:scale(1.06);color:#7dd3fc;}',
      '.khu-bgm svg{width:18px;height:18px;flex-shrink:0;}',
      '.khu-bgm .khu-bgm-on{display:block;}',
      '.khu-bgm .khu-bgm-off{display:none;}',
      '.khu-bgm.muted .khu-bgm-on{display:none;}',
      '.khu-bgm.muted .khu-bgm-off{display:block;color:rgba(255,255,255,.5);}',
      /* Zoom controls */
      '.khu-zoom{position:absolute;right:18px;bottom:92px;z-index:3;display:flex;flex-direction:column;gap:8px;}',
      '.khu-zoom-btn{width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:rgba(15,20,40,.6);color:#fff;font-size:18px;font-weight:700;line-height:1;cursor:pointer;font-family:inherit;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);transition:background .15s,transform .12s,border-color .15s;display:flex;align-items:center;justify-content:center;}',
      '.khu-zoom-btn:hover{background:rgba(167,139,250,.22);border-color:rgba(196,181,253,.55);transform:scale(1.06);}',
      '.khu-zoom-btn:active{transform:scale(.94);}',
      '.khu-zoom-btn.khu-zoom-reset{font-size:16px;opacity:.85;}',
      '@media(max-width:560px){.khu-zoom{right:12px;bottom:26vh;}.khu-zoom-btn{width:44px;height:44px;font-size:20px;}}',
      '.khu-hint{position:absolute;bottom:24px;left:50%;transform:translateX(-50%);z-index:2;font-size:11px;letter-spacing:.08em;color:rgba(180,200,255,.45);pointer-events:none;animation:khuHintFade 6s ease-in-out 1s forwards;}',
      '@keyframes khuHintFade{0%,60%{opacity:1;}100%{opacity:0;}}',
      '.khu-loading{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:rgba(200,210,255,.75);font-size:13px;letter-spacing:.04em;z-index:3;pointer-events:none;transition:opacity .3s;}',
      '.khu-loading.hidden{opacity:0;pointer-events:none;}',
      '.khu-spin{width:28px;height:28px;border-radius:50%;border:2px solid rgba(180,200,255,.18);border-top-color:#a78bfa;animation:khuSpin .9s linear infinite;}',
      '@keyframes khuSpin{to{transform:rotate(360deg);}}',
      /* Word card */
      '.khu-card{position:absolute;left:50%;bottom:24px;transform:translate(-50%,12px);z-index:4;width:min(420px,calc(100vw - 28px));background:linear-gradient(180deg,rgba(20,24,44,.92),rgba(10,12,28,.96));border:1px solid rgba(167,139,250,.3);border-radius:18px;padding:20px 22px 16px;color:#fff;-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);box-shadow:0 24px 60px rgba(80,60,200,.25),0 0 0 1px rgba(255,255,255,.04) inset;opacity:0;pointer-events:none;transition:opacity .22s ease,transform .22s cubic-bezier(.22,1,.36,1);}',
      '.khu-card.show{opacity:1;transform:translate(-50%,0);pointer-events:auto;}',
      '.khu-card-close{position:absolute;top:10px;right:10px;width:28px;height:28px;border-radius:50%;border:none;background:rgba(255,255,255,.08);color:rgba(255,255,255,.6);font-size:12px;cursor:pointer;font-family:inherit;transition:background .15s,color .15s;}',
      '.khu-card-close:hover{background:rgba(255,255,255,.16);color:#fff;}',
      '.khu-card-badge{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;padding:3px 10px;border-radius:999px;margin-bottom:10px;}',
      '.khu-card-badge.lvl-new{background:rgba(167,139,250,.2);color:#c4b5fd;border:1px solid rgba(167,139,250,.35);}',
      '.khu-card-badge.lvl-learning{background:rgba(78,205,196,.2);color:#7ee9e0;border:1px solid rgba(78,205,196,.4);}',
      '.khu-card-badge.lvl-mastered{background:rgba(244,169,60,.2);color:#ffd089;border:1px solid rgba(244,169,60,.45);}',
      '.khu-card-ko{font-family:\'Noto Serif KR\',serif;font-size:26px;font-weight:900;line-height:1.15;letter-spacing:-.01em;margin-bottom:2px;text-shadow:0 2px 10px rgba(120,100,255,.3);}',
      '.khu-card-rom{font-size:12px;font-style:italic;color:rgba(200,210,255,.5);margin-bottom:6px;}',
      '.khu-card-en{font-size:14px;font-weight:700;color:#a8c4ff;line-height:1.4;margin-bottom:12px;}',
      '.khu-card-related{display:flex;flex-wrap:wrap;gap:6px;min-height:0;}',
      '.khu-card-related:empty{display:none;}',
      '.khu-related-label{flex:0 0 100%;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:rgba(200,210,255,.5);margin:4px 0 4px;}',
      '.khu-related-chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#e0e4ff;background:rgba(167,139,250,.12);border:1px solid rgba(167,139,250,.3);border-radius:999px;padding:5px 10px 5px 11px;cursor:pointer;font-family:inherit;transition:background .12s,transform .12s,border-color .12s,color .15s;}',
      '.khu-related-chip-ko{font-family:\'Noto Sans KR\',sans-serif;}',
      '.khu-related-chip-plus{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:rgba(255,255,255,.14);font-size:11px;font-weight:900;line-height:1;color:rgba(255,255,255,.72);}',
      '.khu-related-chip:hover{background:rgba(167,139,250,.25);border-color:rgba(196,181,253,.6);transform:translateY(-1px);}',
      '.khu-related-chip.saving{opacity:.6;pointer-events:none;}',
      '.khu-related-chip.saved{background:linear-gradient(135deg,rgba(78,205,196,.28),rgba(167,139,250,.2));border-color:rgba(78,205,196,.55);color:#c7fff7;cursor:default;}',
      '.khu-related-chip.saved .khu-related-chip-plus{background:rgba(78,205,196,.8);color:#053b39;}',
      '.khu-related-chip.error{background:rgba(244,63,94,.25);border-color:rgba(244,63,94,.55);}',
      '.khu-related-chip-loading{font-size:11px;color:rgba(200,210,255,.4);font-style:italic;padding:4px 0;flex:0 0 100%;}',
      '@media(max-width:560px){.khu-card{left:12px;right:12px;bottom:12px;transform:translate(0,12px);width:auto;}.khu-card.show{transform:translate(0,0);}}',
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── Cluster geometry ────────────────────────────────────────
  // Compute cluster centers for a set of categories using the
  // Fibonacci-sphere distribution (evenly spaced directions). Each
  // cluster gets a position on a 30-unit sphere around origin, plus
  // a mini-galaxy radius for its words.
  function computeClusterCenters(categories) {
    var centers = {};
    var n = categories.length;
    if (n === 0) return centers;
    // Single category → center it at origin
    if (n === 1) {
      centers[categories[0]] = { x: 0, y: 0, z: 0 };
      return centers;
    }
    // Pull centers in closer than the old 30-unit shell so clusters
    // overlap instead of looking like discrete floating islands.
    var sphereR = 18;
    // Fibonacci sphere direction
    var golden = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < n; i++) {
      var y = 1 - (i / (n - 1)) * 2;   // -1..1
      y *= 0.55;                        // flatten more (galaxy disc, not globe)
      var r = Math.sqrt(1 - y * y);
      var t = golden * i;
      // Slight per-cluster radial jitter so adjacent clusters aren't
      // perfectly equidistant — more natural "scattered" feel.
      var rJit = sphereR * (0.85 + Math.random() * 0.3);
      centers[categories[i]] = {
        x: Math.cos(t) * r * rJit,
        y: y * sphereR,
        z: Math.sin(t) * r * rJit
      };
    }
    return centers;
  }

  // Within a cluster, lay words in a mini 2-arm spiral around the center.
  function clusterWordPosition(center, idx, total, mastery) {
    var arms = total > 4 ? 2 : 1;
    var t = total ? idx / total : 0;
    var dist = 2 + Math.pow(t, 0.6) * Math.min(8, 3 + total * 0.25);
    dist *= (1 - mastery * 0.22);
    var armAngle = ((idx % arms) / arms) * Math.PI * 2;
    var twist = dist * 0.22;
    var jitter = (Math.random() - 0.5) * 0.9;
    var angle = armAngle + twist + jitter + (idx * 0.37);
    var yOff = (Math.random() - 0.5) * (0.8 + dist * 0.05);
    return {
      x: center.x + Math.cos(angle) * dist,
      y: center.y + yOff,
      z: center.z + Math.sin(angle) * dist
    };
  }

  // Kept for fallback: old 4-arm spiral when clustering info is absent.
  function galaxyPosition(i, total, mastery) {
    var arms = 4;
    var t = i / Math.max(1, total);
    var arm = i % arms;
    var distance = Math.pow(t, 0.65) * 38 + 3;
    distance *= (1 - mastery * 0.28);
    var armAngle = (arm / arms) * Math.PI * 2;
    var twist = distance * 0.18;
    var jitter = (Math.random() - 0.5) * 2.2;
    var angle = armAngle + twist + jitter;
    var y = (Math.random() - 0.5) * (1.5 + distance * 0.05);
    return { x: Math.cos(angle) * distance, y: y, z: Math.sin(angle) * distance };
  }

  // ── Category enrichment (async Supabase lookup) ─────────────
  // ── Corpus loader: load the whole vocabulary_bank so we can paint
  //    every site vocab as a dim background star. User's saved words
  //    (state.words) overshadow any duplicates in this set.
  // Returns an array of { ko, rom, en, _cat } objects.
  async function loadCorpusWords(savedWords) {
    if (typeof getSupa !== 'function') return [];
    var sb; try { sb = getSupa(); } catch(_) { return []; }
    if (!sb) return [];
    try {
      var r = await sb.from('vocabulary_bank')
        .select('word_ko, word_rom, word_en, interest_tag')
        .eq('is_active', true)
        .limit(3000);
      if (r.error || !r.data) return [];
      // Dedup against user's saved set so we never double-render
      var savedSet = {};
      (savedWords || []).forEach(function(w) {
        var k = w && (w.word_ko || w.ko);
        if (k) savedSet[k] = true;
      });
      var out = [];
      for (var i = 0; i < r.data.length; i++) {
        var row = r.data[i];
        if (!row || !row.word_ko) continue;
        if (savedSet[row.word_ko]) continue;
        out.push({
          ko:   row.word_ko,
          rom:  row.word_rom || '',
          en:   row.word_en  || '',
          _cat: normCategory(row.interest_tag || 'misc')
        });
      }
      return out;
    } catch (e) { return []; }
  }

  // localStorage cache so we don't re-ask Claude for the same word's
  // category on every Universe rebuild.
  var _CAT_CACHE_KEY = 'kh_universe_cat_cache_v1';
  function _readCatCache() {
    try { return JSON.parse(localStorage.getItem(_CAT_CACHE_KEY) || '{}'); }
    catch(_) { return {}; }
  }
  function _writeCatCache(map) {
    try { localStorage.setItem(_CAT_CACHE_KEY, JSON.stringify(map)); } catch(_) {}
  }

  // Ask Claude haiku to bucket each word into one of our category tags.
  // Used as a fallback when vocabulary_bank.interest_tag is empty (which
  // is why so many user-saved words were ending up in MISC).
  async function _aiCategorize(words) {
    if (!Array.isArray(words) || !words.length) return {};
    if (typeof callClaude !== 'function') return {};
    var cache = _readCatCache();
    var stillUnknown = words.filter(function(k){ return !cache[k]; });
    if (!stillUnknown.length) return cache;
    // Cap chunks at 30 — keep prompts short so haiku stays fast/cheap.
    for (var off = 0; off < stillUnknown.length; off += 30) {
      var chunk = stillUnknown.slice(off, off + 30);
      var prompt = 'Categorize each Korean word into ONE of these tags:\n'
        + 'everyday, food, travel, work, kpop, music, news, politics, economy, '
        + 'culture, society, tech, sports, health, nature, drama, movie, '
        + 'entertainment, family, friends, dating, study, education, misc.\n\n'
        + 'Words (one per line):\n' + chunk.join('\n')
        + '\n\nReturn ONLY a JSON array of tags in the same order as the input. '
        + 'Example: ["food","everyday","misc"]. No explanations.';
      try {
        var res = await callClaude({
          feature: 'universe-categorize',
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          messages: [{ role: 'user', content: prompt }]
        });
        var txt = (res && res.content && res.content[0] && res.content[0].text) || '[]';
        var ai = txt.indexOf('['), bi = txt.lastIndexOf(']');
        if (ai >= 0 && bi > ai) txt = txt.slice(ai, bi + 1);
        var tags = JSON.parse(txt);
        if (Array.isArray(tags)) {
          chunk.forEach(function(ko, i) {
            var t = String(tags[i] || 'misc').toLowerCase().trim();
            cache[ko] = t;
          });
        }
      } catch(_) { /* keep going; remaining words fall back to misc */ }
    }
    _writeCatCache(cache);
    return cache;
  }

  // For each input word, look up its interest_tag in vocabulary_bank.
  // Missing words fall through to a Claude-powered categorizer (cached
  // in localStorage). Final fallback: 'misc'. Results are merged back
  // onto the word objects so subsequent rebuilds stay category-aware.
  async function enrichWithCategories(words) {
    if (!Array.isArray(words) || !words.length) return;
    // Skip if already enriched
    var needsLookup = words.filter(function(w) {
      return w && (w.word_ko || w.ko) && !w._cat;
    });
    if (!needsLookup.length) return;
    if (typeof getSupa !== 'function') {
      needsLookup.forEach(function(w){ w._cat = 'misc'; });
      return;
    }
    var sb; try { sb = getSupa(); } catch(_) {}
    if (!sb) {
      needsLookup.forEach(function(w){ w._cat = 'misc'; });
      return;
    }
    var kos = needsLookup.map(function(w){ return w.word_ko || w.ko; });
    try {
      // Chunk to avoid huge `in` queries
      var chunkSize = 200;
      var found = {};
      for (var i = 0; i < kos.length; i += chunkSize) {
        var chunk = kos.slice(i, i + chunkSize);
        var r = await sb.from('vocabulary_bank')
          .select('word_ko, interest_tag')
          .in('word_ko', chunk);
        if (r && r.data) {
          r.data.forEach(function(row) {
            if (row && row.word_ko && row.interest_tag) found[row.word_ko] = row.interest_tag;
          });
        }
      }
      // Anything still missing → ask Claude (cached). This is what
      // rescues user-saved words that bypassed vocabulary_bank or that
      // exist there with an empty interest_tag — previously they all
      // collapsed into a giant MISC blob.
      var missing = needsLookup.map(function(w){ return w.word_ko || w.ko; })
        .filter(function(ko){ return ko && !found[ko]; });
      var aiCache = missing.length ? await _aiCategorize(missing) : {};
      needsLookup.forEach(function(w) {
        var ko = w.word_ko || w.ko;
        var tag = found[ko] || aiCache[ko] || 'misc';
        w._cat = normCategory(tag);
      });
    } catch(_) {
      needsLookup.forEach(function(w){ w._cat = 'misc'; });
    }
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

  // Build a pill-shaped text label canvas for a word. Returns
  // { tex, aspect } where aspect = canvas.width/canvas.height so
  // the resulting sprite keeps correct proportions.
  function makeLabelTexture(text, three, tintHex) {
    var fontSize = 44; // internal canvas px; sprite scale controls visual size
    var c = document.createElement('canvas');
    var ctx = c.getContext('2d');
    ctx.font = 'bold ' + fontSize + 'px "Noto Sans KR", "DM Sans", sans-serif';
    var tw = Math.ceil(ctx.measureText(text || '').width);
    var padX = 28, padY = 14;
    c.width  = Math.max(140, tw + padX * 2);
    c.height = fontSize + padY * 2;
    ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.font = 'bold ' + fontSize + 'px "Noto Sans KR", "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Dark pill backdrop
    var r = c.height / 2;
    ctx.fillStyle = 'rgba(12,16,36,0.78)';
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(c.width - r, 0);
    ctx.quadraticCurveTo(c.width, 0, c.width, r);
    ctx.lineTo(c.width, c.height - r);
    ctx.quadraticCurveTo(c.width, c.height, c.width - r, c.height);
    ctx.lineTo(r, c.height);
    ctx.quadraticCurveTo(0, c.height, 0, c.height - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();
    // Accent border
    ctx.strokeStyle = tintHex || 'rgba(196,181,253,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Text
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(text || '', c.width / 2, c.height / 2);
    var tex = new three.CanvasTexture(c);
    tex.colorSpace = three.SRGBColorSpace || three.sRGBEncoding;
    return { tex: tex, aspect: c.width / c.height };
  }

  // ── Build scene ─────────────────────────────────────────────
  function buildScene(three, canvas) {
    var scene = new three.Scene();
    scene.background = null;
    scene.fog = new three.FogExp2(0x040612, 0.012);

    var w = canvas.clientWidth, h = canvas.clientHeight;
    // Vertical FOV is fixed; on portrait mobile (aspect ~0.45)
    // the horizontal FOV ends up around 27° at the default 55°
    // setting, which projects the outer category labels outside
    // the visible canvas — the user-reported "화면 짤리는 이슈".
    // Widen the field for narrow viewports so the same scene
    // fits horizontally without having to pull the camera back
    // and shrink every star.
    var aspect = w / Math.max(1, h);
    var fov = aspect < 0.6 ? 78 : aspect < 0.85 ? 68 : 55;
    var camera = new three.PerspectiveCamera(fov, aspect, 0.1, 500);
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
      size: 0.9, map: state.glowTex, vertexColors: true, transparent: true, opacity: 0.9,
      blending: three.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
      alphaTest: 0.01
    });
    state.nebula = new three.Points(nebGeo, nebMat);
    scene.add(state.nebula);

    // Word stars — individual Sprites so each is clickable later
    var starsGroup = new three.Group();
    scene.add(starsGroup);
    state.stars = starsGroup;

    // Satellites — related words orbiting the selected star (rebuilt per selection)
    // Parented to starsGroup so the whole satellite cluster rides the same
    // rotation as the parent star (no coordinate-frame drift).
    var satGroup = new three.Group();
    starsGroup.add(satGroup);
    state.satellites = satGroup;

    // Category label group — big floating pills at each cluster center.
    // Lives under starsGroup too so labels hover with their clusters.
    var catGroup = new three.Group();
    starsGroup.add(catGroup);
    state.categories = catGroup;

    // Constellation group — lines connecting same-category stars when a
    // category label is tapped. Parented to starsGroup so the lines rotate
    // with the rest of the galaxy.
    var conGroup = new three.Group();
    starsGroup.add(conGroup);
    state.constellation = conGroup;

    // Corpus on-demand labels — filled lazily as the camera zooms in
    // so we never build 2000+ text sprites at once.
    var corpusLabelsGroup = new three.Group();
    starsGroup.add(corpusLabelsGroup);
    state.corpusLabels = corpusLabelsGroup;
    state.corpusLabelsActive = {};

    rebuildWordStars(three, starsGroup);
    // Corpus backdrop (vocab_bank entries the user hasn't saved) is built
    // once corpusWords is loaded; buildScene runs first with whatever is
    // already cached, and a re-build fires once the load completes.
    rebuildCorpusPoints(three);

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

  // ── Build the corpus backdrop as a single THREE.Points cloud ─────
  // One geometry, one draw call → handles 2k+ vocab_bank entries
  // without per-sprite overhead. Non-interactive; purely ambient.
  function rebuildCorpusPoints(three) {
    if (!state.scene || !state.stars) return;
    // Dispose existing
    if (state.corpus) {
      state.stars.remove(state.corpus);
      try { state.corpus.geometry.dispose(); } catch(_) {}
      try { state.corpus.material.dispose(); } catch(_) {}
      state.corpus = null;
    }
    var corpus = state.corpusWords || [];
    if (!corpus.length) return;

    // Build cluster centers for the UNION of user categories + corpus.
    // If user stars already have clusterCenters, we reuse them so corpus
    // entries land in the same neighborhood as their category.
    var centers = state.clusterCenters || {};
    var catOrder = Object.keys(centers);
    // Add any cats present in corpus but missing from user data
    var extraCats = {};
    corpus.forEach(function(w) {
      if (!centers[w._cat] && !extraCats[w._cat]) {
        extraCats[w._cat] = true;
        catOrder.push(w._cat);
      }
    });
    if (catOrder.length && Object.keys(extraCats).length) {
      var extraCenters = computeClusterCenters(catOrder.filter(function(c){ return extraCats[c]; }));
      Object.keys(extraCenters).forEach(function(c) {
        centers[c] = extraCenters[c];
        if (state.clusterCenters) {
          state.clusterCenters[c] = {
            x: extraCenters[c].x, y: extraCenters[c].y, z: extraCenters[c].z,
            count: 0, avgMastery: 0, color: catColor(c)
          };
        }
      });
    }

    var N = Math.min(corpus.length, 2500);
    var positions = new Float32Array(N * 3);
    var colors    = new Float32Array(N * 3);
    var meta = new Array(N);
    // Group by category and spread around the cluster
    var byCat = {};
    for (var i = 0; i < N; i++) {
      var w = corpus[i];
      var cat = w._cat || 'misc';
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(i);
    }
    var idx = 0;
    Object.keys(byCat).forEach(function(cat) {
      var center = centers[cat] || { x: 0, y: 0, z: 0 };
      var tint = catColor(cat);
      var members = byCat[cat];
      var m = members.length;
      for (var j = 0; j < m; j++) {
        // Spread wider so clusters bleed into each other instead of
        // sitting as discrete islands. ~10–22 unit halo per cluster vs
        // ~18 unit inter-cluster distance → natural overlap. Power 0.5
        // gives a softer falloff (more outliers, less hard edge).
        var dist = 4 + Math.pow(Math.random(), 0.5) * (10 + Math.min(22, m * 0.3));
        var theta = Math.random() * Math.PI * 2;
        var phi = (Math.random() - 0.5) * Math.PI;
        var jx = dist * Math.cos(phi) * Math.cos(theta);
        var jy = dist * Math.sin(phi) * 0.55;
        var jz = dist * Math.cos(phi) * Math.sin(theta);
        var px = center.x + jx;
        var py = center.y + jy;
        var pz = center.z + jz;
        var p = idx * 3;
        positions[p + 0] = px;
        positions[p + 1] = py;
        positions[p + 2] = pz;
        // Dim corpus colour — 18-30% of category tint, additive blend.
        // We intentionally keep this low so the user's saved stars read as
        // the "main characters" of their galaxy.
        var dim = 0.18 + Math.random() * 0.12;
        colors[p + 0] = tint.r * dim;
        colors[p + 1] = tint.g * dim;
        colors[p + 2] = tint.b * dim;
        var corpusWord = corpus[members[j]];
        meta[idx] = {
          ko: corpusWord.ko, rom: corpusWord.rom || '', en: corpusWord.en || '',
          cat: cat, x: px, y: py, z: pz
        };
        idx++;
      }
    });
    state.corpusMeta = meta;
    // Reset any active labels since the geometry just changed
    _clearCorpusLabels();

    var geom = new three.BufferGeometry();
    geom.setAttribute('position', new three.BufferAttribute(positions, 3));
    geom.setAttribute('color',    new three.BufferAttribute(colors, 3));
    var mat = new three.PointsMaterial({
      size: 0.95,
      map: state.glowTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      blending: three.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      alphaTest: 0.01
    });
    state.corpus = new three.Points(geom, mat);
    state.corpus.renderOrder = -1; // behind sprites
    state.stars.add(state.corpus);
  }

  // ── Corpus LOD labels ─────────────────────────────────────
  // When zoomed in (cam.radius below ZOOM_IN_THRESHOLD), show the nearest
  // ~30 corpus word labels to the orbit target. Zoom back out and they
  // disappear — keeps the scene readable without rendering 2k labels.
  var CORPUS_ZOOM_THRESHOLD = 30;
  var CORPUS_LABEL_LIMIT    = 30;
  var CORPUS_TICK_INTERVAL  = 0.2; // seconds

  function _clearCorpusLabels() {
    if (!state.corpusLabels) return;
    while (state.corpusLabels.children.length) {
      var c = state.corpusLabels.children.pop();
      if (c.material) {
        if (c.material.map) { try { c.material.map.dispose(); } catch(_) {} }
        c.material.dispose();
      }
    }
    state.corpusLabelsActive = {};
  }

  function updateCorpusLabels() {
    if (!state.corpusLabels || !state.corpusMeta || !THREE) return;
    // Zoomed out → tear everything down
    if (state.cam.radius > CORPUS_ZOOM_THRESHOLD) {
      if (state.corpusLabels.children.length) _clearCorpusLabels();
      return;
    }
    // Find the N closest corpus points to the current target
    var tx = state.cam.target.x, ty = state.cam.target.y, tz = state.cam.target.z;
    var candidates = [];
    var meta = state.corpusMeta;
    for (var i = 0; i < meta.length; i++) {
      var m = meta[i];
      var dx = m.x - tx, dy = m.y - ty, dz = m.z - tz;
      var d2 = dx * dx + dy * dy + dz * dz;
      // Only consider a generous sphere around the target so sorting stays cheap
      if (d2 > 400) continue;
      candidates.push({ idx: i, d2: d2 });
    }
    candidates.sort(function(a, b){ return a.d2 - b.d2; });
    candidates = candidates.slice(0, CORPUS_LABEL_LIMIT);

    var wantedKeys = {};
    candidates.forEach(function(c){ wantedKeys[c.idx] = true; });

    // Drop labels that are no longer in the nearest set
    Object.keys(state.corpusLabelsActive).forEach(function(k) {
      if (!wantedKeys[k]) {
        var spr = state.corpusLabelsActive[k];
        state.corpusLabels.remove(spr);
        if (spr.material) {
          if (spr.material.map) { try { spr.material.map.dispose(); } catch(_) {} }
          spr.material.dispose();
        }
        delete state.corpusLabelsActive[k];
      }
    });

    // Add labels for newcomers
    candidates.forEach(function(c) {
      if (state.corpusLabelsActive[c.idx]) return;
      var m = state.corpusMeta[c.idx];
      if (!m || !m.ko) return;
      var tint = catColor(m.cat);
      var hexBorder = 'rgba(' + Math.round(tint.r * 255) + ',' + Math.round(tint.g * 255) + ',' + Math.round(tint.b * 255) + ',0.4)';
      var lbl = makeLabelTexture(m.ko, THREE, hexBorder);
      var lblMat = new THREE.SpriteMaterial({
        map: lbl.tex, transparent: true, depthWrite: false, opacity: 0.68
      });
      var sprite = new THREE.Sprite(lblMat);
      var lblH = 0.85;
      var lblW = lblH * lbl.aspect;
      sprite.scale.set(lblW, lblH, 1);
      sprite.position.set(m.x, m.y - 0.7, m.z);
      sprite.userData = {
        isStar: true,          // pickable by raycaster
        isCorpusLabel: true,
        corpusIdx: c.idx,
        word: { ko: m.ko, word_ko: m.ko, rom: m.rom, word_rom: m.rom, en: m.en, word_en: m.en }
      };
      sprite.renderOrder = 2;
      state.corpusLabels.add(sprite);
      state.corpusLabelsActive[c.idx] = sprite;
    });
  }

  // Tap on a corpus label → treat it like a one-tap save (corpus words
  // aren't in the user's set yet; the intent is "I want this one").
  function _onCorpusLabelTap(sprite) {
    if (!sprite || !sprite.userData || !sprite.userData.word) return;
    var w = sprite.userData.word;
    // Reuse the related-word save helper — same shape, same RPC.
    if (typeof saveRelatedWord !== 'function') return;
    sprite.material.opacity = 0.35;
    saveRelatedWord({ ko: w.ko, rom: w.rom || '', en: w.en || '' }).then(function(ok) {
      if (ok) {
        // Flip this label to the mastered tone and bigger
        if (sprite.material) {
          sprite.material.color = new THREE.Color(0.31, 0.80, 0.77); // mint
          sprite.material.opacity = 1;
        }
        sprite.scale.multiplyScalar(1.2);
        if (typeof showToast === 'function') showToast('📚 "' + w.ko + '" saved');
      } else {
        sprite.material.opacity = 0.68;
        if (typeof showToast === 'function') showToast('Save failed', true);
      }
    });
  }

  // ── Category highlight: shine same-cat words and connect them ─────
  // Tapping a category pill (EVERYDAY · 8 etc.) toggles a constellation
  // mode for that tag: in-cat stars get brighter + bigger, out-of-cat
  // stars dim, and we draw thin lines between same-cat stars so the
  // group reads as a constellation. Tap the same pill again or tap
  // empty space to clear.
  function _onCategoryTap(sprite) {
    if (!sprite || !sprite.userData) return;
    var cat = sprite.userData.category;
    if (!cat) return;
    if (state.activeCategory === cat) {
      _clearCategoryHighlight();
      return;
    }
    _highlightCategory(cat);
  }

  function _clearConstellationLines() {
    if (!state.constellation) return;
    while (state.constellation.children.length) {
      var c = state.constellation.children.pop();
      if (c.material) c.material.dispose();
      if (c.geometry) c.geometry.dispose();
    }
  }

  // Restore opacity / scale that _highlightCategory captured.
  function _clearCategoryHighlight() {
    state.activeCategory = null;
    if (state.stars) {
      state.stars.children.forEach(function(c) {
        if (!c.userData) return;
        if (c.userData._origOpacity !== undefined && c.material) {
          c.material.opacity = c.userData._origOpacity;
          delete c.userData._origOpacity;
        }
        if (c.userData._origScale !== undefined) {
          var s = c.userData._origScale;
          c.scale.set(s, s, 1);
          delete c.userData._origScale;
        }
      });
    }
    if (state.categories) {
      state.categories.children.forEach(function(c) {
        if (!c.userData) return;
        if (c.userData._origOpacity !== undefined && c.material) {
          c.material.opacity = c.userData._origOpacity;
          delete c.userData._origOpacity;
        }
        if (c.userData._origScale !== undefined) {
          var s = c.userData._origScale;
          c.scale.set(s * (c.userData._aspect || 1), s, 1);
          delete c.userData._origScale;
        }
      });
    }
    if (state.corpus && state.corpus.material && state.corpus.userData && state.corpus.userData._origOpacity !== undefined) {
      state.corpus.material.opacity = state.corpus.userData._origOpacity;
      delete state.corpus.userData._origOpacity;
    }
    _clearConstellationLines();
  }

  function _highlightCategory(cat) {
    if (!state.stars || !THREE) return;
    if (state.activeCategory) _clearCategoryHighlight();
    state.activeCategory = cat;

    // First pass: collect category star sprites
    var catStars = [];
    var catStarIdx = {};
    state.stars.children.forEach(function(c) {
      if (!c.userData) return;
      if (c.userData.isStar && c.userData.category === cat) {
        catStars.push(c);
        if (typeof c.userData.idx === 'number') catStarIdx[c.userData.idx] = true;
      }
    });

    // Second pass: apply effects to stars, auras, labels
    var DIM_OPACITY = 0.18;
    state.stars.children.forEach(function(c) {
      if (!c.userData || !c.material) return;
      if (c.userData.isStar && c.userData.category === cat) {
        c.userData._origOpacity = c.material.opacity;
        c.userData._origScale = c.scale.x;
        c.material.opacity = 1;
        var s = c.scale.x * 1.45;
        c.scale.set(s, s, 1);
      } else if (c.userData.isStar) {
        c.userData._origOpacity = c.material.opacity;
        c.material.opacity = DIM_OPACITY;
      } else if (c.userData.isAura) {
        c.userData._origOpacity = c.material.opacity;
        var inCat = catStarIdx[c.userData.forStarIdx];
        c.material.opacity = inCat ? Math.min(1, c.userData._origOpacity * 1.6) : 0.06;
      } else if (c.userData.isLabel) {
        c.userData._origOpacity = c.material.opacity;
        var labelInCat = catStarIdx[c.userData.forStarIdx];
        c.material.opacity = labelInCat ? 1 : 0.18;
      }
    });

    // Dim the unsaved-corpus point cloud so the chosen cluster pops
    if (state.corpus && state.corpus.material) {
      state.corpus.userData = state.corpus.userData || {};
      state.corpus.userData._origOpacity = state.corpus.material.opacity;
      state.corpus.material.opacity = 0.12;
    }

    // Highlight active category pill, dim the rest
    if (state.categories) {
      state.categories.children.forEach(function(c) {
        if (!c.material) return;
        c.userData._origOpacity = c.material.opacity;
        if (c.userData.category === cat) {
          c.material.opacity = 1;
          c.userData._origScale = c.scale.y;
          c.userData._aspect = c.scale.x / c.scale.y;
          var ns = c.scale.y * 1.12;
          c.scale.set(ns * c.userData._aspect, ns, 1);
        } else {
          c.material.opacity = 0.28;
        }
      });
    }

    // Draw the constellation lines
    _buildConstellation(catStars, catColor(cat));

    // Move orbit target onto the cluster center so subsequent pinches zoom
    // into the highlighted group, not the galaxy origin.
    var center = state.clusterCenters && state.clusterCenters[cat];
    if (center) animateTarget(center.x, center.y, center.z);
  }

  // For each in-cat star, link it to its 2 nearest in-cat neighbors with a
  // thin tinted line. De-dup with i<j so each pair is drawn once.
  function _buildConstellation(stars, tint) {
    if (!THREE || !state.constellation) return;
    _clearConstellationLines();
    if (!stars || stars.length < 2) return;
    var hex = (Math.round(tint.r * 255) << 16) | (Math.round(tint.g * 255) << 8) | Math.round(tint.b * 255);
    var maxLinks = stars.length <= 4 ? stars.length - 1 : 2;
    for (var i = 0; i < stars.length; i++) {
      var dists = [];
      for (var j = 0; j < stars.length; j++) {
        if (i === j) continue;
        var dx = stars[i].position.x - stars[j].position.x;
        var dy = stars[i].position.y - stars[j].position.y;
        var dz = stars[i].position.z - stars[j].position.z;
        dists.push({ j: j, d: dx * dx + dy * dy + dz * dz });
      }
      dists.sort(function(a, b) { return a.d - b.d; });
      var nLinks = Math.min(maxLinks, dists.length);
      for (var k = 0; k < nLinks; k++) {
        var jIdx = dists[k].j;
        if (jIdx <= i) continue; // de-dup pairs
        var lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
          stars[i].position.x, stars[i].position.y, stars[i].position.z,
          stars[jIdx].position.x, stars[jIdx].position.y, stars[jIdx].position.z
        ]), 3));
        var lineMat = new THREE.LineBasicMaterial({
          color: hex, transparent: true, opacity: 0.5, depthWrite: false
        });
        var line = new THREE.Line(lineGeo, lineMat);
        line.userData = { isConstellation: true };
        state.constellation.add(line);
      }
    }
  }

  function rebuildWordStars(three, group) {
    // A rebuild blows away the stars whose userData drives the highlight,
    // so drop any active category highlight first (lines, opacity overrides).
    if (state.activeCategory) _clearCategoryHighlight();
    // Clear word-star group — dispose label textures too. Preserve sub-groups
    // (satellites, categories, constellation) by reparenting them back after the wipe.
    var preserved = [];
    var kids = group.children.slice();
    kids.forEach(function(c) {
      if (c === state.satellites || c === state.categories || c === state.constellation) {
        preserved.push(c);
        group.remove(c);
        return;
      }
      group.remove(c);
      if (c.material) {
        if (c.material.map && c.userData && c.userData.isLabel) {
          try { c.material.map.dispose(); } catch(_) {}
        }
        c.material.dispose();
      }
    });
    preserved.forEach(function(g){ group.add(g); });

    // Clear the categories group (rebuilt alongside stars)
    if (state.categories) {
      while (state.categories.children.length) {
        var cc = state.categories.children.pop();
        if (cc.material) {
          if (cc.material.map) { try { cc.material.map.dispose(); } catch(_) {} }
          cc.material.dispose();
        }
      }
    }

    var words = state.words || [];
    var MAX_LABELS = 200;
    var labelLimit = Math.min(words.length, MAX_LABELS);

    // Group words by category and compute cluster centers
    var byCat = {};
    var catOrder = [];
    for (var wi = 0; wi < words.length; wi++) {
      var ww = words[wi];
      var cat = ww._cat || 'misc';
      if (!byCat[cat]) { byCat[cat] = []; catOrder.push(cat); }
      byCat[cat].push({ w: ww, originalIdx: wi });
    }
    var centers = computeClusterCenters(catOrder);
    state.clusterCenters = {};
    catOrder.forEach(function(cat) {
      var center = centers[cat] || { x: 0, y: 0, z: 0 };
      var bucket = byCat[cat];
      var mastSum = 0;
      bucket.forEach(function(b){ mastSum += wordMastery(b.w); });
      var avgMast = bucket.length ? mastSum / bucket.length : 0;
      state.clusterCenters[cat] = {
        x: center.x, y: center.y, z: center.z,
        count: bucket.length, avgMastery: avgMast,
        color: catColor(cat)
      };
    });

    // Render stars cluster by cluster
    catOrder.forEach(function(cat) {
      var bucket = byCat[cat];
      var center = state.clusterCenters[cat];
      var catTint = catColor(cat);
      bucket.forEach(function(b, idxInCluster) {
        var w = b.w;
        var i = b.originalIdx;
        var m = wordMastery(w);
        var pos = (catOrder.length > 1)
          ? clusterWordPosition(center, idxInCluster, bucket.length, m)
          : galaxyPosition(i, words.length, m);
        // Category tint carries the identity; mastery bumps brightness so
        // the colour stays punchy instead of washing out into neutral grey.
        // Quiz-accuracy-driven brightness: new/unstudied = lavender tint of
        // category, mastered = near full saturation + larger.
        var brightness = 0.95 + m * 0.45;
        var blend = {
          r: Math.min(1, catTint.r * brightness),
          g: Math.min(1, catTint.g * brightness),
          b: Math.min(1, catTint.b * brightness)
        };
        var mat = new three.SpriteMaterial({
          map: state.glowTex,
          color: new three.Color(blend.r, blend.g, blend.b),
          transparent: true,
          opacity: 1.0,
          blending: three.AdditiveBlending,
          depthWrite: false,
        });
        var sprite = new three.Sprite(mat);
        sprite.position.set(pos.x, pos.y, pos.z);
        var size = 1.8 + m * 2.6;
        sprite.scale.set(size, size, 1);
        sprite.userData = { word: w, mastery: m, idx: i, isStar: true, category: cat };
        group.add(sprite);

        // Mastery aura: for words the user actually knows (m >= 0.4),
        // paint a soft larger halo behind the star. Gold for mastered
        // (>=0.75), mint for learning (0.4-0.75). This is what makes
        // "my saved stars shine" vs the dim backdrop.
        if (m >= 0.4) {
          var aura = {
            r: m >= 0.75 ? 0.96 : 0.31,
            g: m >= 0.75 ? 0.66 : 0.80,
            b: m >= 0.75 ? 0.24 : 0.77
          };
          var auraMat = new three.SpriteMaterial({
            map: state.glowTex,
            color: new three.Color(aura.r, aura.g, aura.b),
            transparent: true,
            opacity: 0.32 + m * 0.28,
            blending: three.AdditiveBlending,
            depthWrite: false,
          });
          var auraSprite = new three.Sprite(auraMat);
          auraSprite.position.set(pos.x, pos.y, pos.z);
          var auraSize = size * (1.9 + m * 0.8);
          auraSprite.scale.set(auraSize, auraSize, 1);
          auraSprite.userData = { isAura: true, forStarIdx: i, baseScale: auraSize, phase: Math.random() * Math.PI * 2 };
          auraSprite.renderOrder = -0.5; // behind the star sprite but above corpus
          group.add(auraSprite);
        }

        // Word label pill
        if (i < labelLimit) {
          var ko = w.word_ko || w.ko || '';
          if (ko) {
            var hexBorder = 'rgba(' + Math.round(blend.r * 255) + ',' + Math.round(blend.g * 255) + ',' + Math.round(blend.b * 255) + ',0.52)';
            var lbl = makeLabelTexture(ko, three, hexBorder);
            var lblMat = new three.SpriteMaterial({
              map: lbl.tex, transparent: true, depthWrite: false, opacity: 0.92
            });
            var lblSprite = new three.Sprite(lblMat);
            var lblH = 1.2;
            var lblW = lblH * lbl.aspect;
            lblSprite.scale.set(lblW, lblH, 1);
            lblSprite.position.set(pos.x, pos.y - size * 0.8 - lblH * 0.55, pos.z);
            lblSprite.renderOrder = 1;
            // Marking the label as isStar with the SAME word/mastery/idx/
            // category as its parent star lets raycaster + screen-space
            // fallback both treat a label tap as a star tap. The user
            // reported tapping on the word label did nothing — only
            // hitting the tiny glow registered. Flagging the label
            // sprite as pickable fixes that without forcing a separate
            // pick-resolution branch downstream.
            lblSprite.userData = {
              isLabel: true, isStar: true,
              forStarIdx: i, word: w, mastery: m, idx: i, category: cat,
            };
            group.add(lblSprite);
          }
        }
      });
    });

    // Render one big label at each cluster center (skip when only 1 cluster)
    if (catOrder.length > 1 && state.categories) {
      catOrder.forEach(function(cat) {
        var c = state.clusterCenters[cat];
        if (!c) return;
        var catLabelText = cat.toUpperCase();
        // Weakness hint suffix — count + tiny indicator
        var hintSuffix = '  ·  ' + c.count;
        var labelColor = catColor(cat);
        var hexBorder = 'rgba(' + Math.round(labelColor.r * 255) + ',' + Math.round(labelColor.g * 255) + ',' + Math.round(labelColor.b * 255) + ',0.9)';
        var lbl = makeCategoryLabelTexture(catLabelText + hintSuffix, three, hexBorder, c.avgMastery, c.count);
        var mat = new three.SpriteMaterial({
          map: lbl.tex, transparent: true, depthWrite: false, opacity: 0.94
        });
        var sp = new three.Sprite(mat);
        var lblH = 2.0;
        var lblW = lblH * lbl.aspect;
        sp.scale.set(lblW, lblH, 1);
        // Float the label a bit above the cluster
        sp.position.set(c.x, c.y + 7.5, c.z);
        sp.renderOrder = 3;
        sp.userData = { isCategoryLabel: true, category: cat };
        state.categories.add(sp);
      });
    }
  }

  // Build a thicker, brighter label for category headers. Shows category
  // name + count; if < 3 words OR low mastery, appends a 💡 "expand here"
  // hint in the pill so weak areas stand out.
  function makeCategoryLabelTexture(text, three, borderHex, avgMastery, count) {
    var fontSize = 48;
    var weak = (count < 3) || (avgMastery < 0.35);
    var hintEmoji = weak ? '  💡' : '';
    var fullText = text + hintEmoji;
    var c = document.createElement('canvas');
    var ctx = c.getContext('2d');
    ctx.font = '900 ' + fontSize + 'px "DM Sans", "Noto Sans KR", sans-serif';
    var tw = Math.ceil(ctx.measureText(fullText).width);
    var padX = 36, padY = 20;
    c.width = Math.max(180, tw + padX * 2);
    c.height = fontSize + padY * 2;
    ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.font = '900 ' + fontSize + 'px "DM Sans", "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var r = c.height / 2;
    // Background: more saturated for strong clusters
    var bgAlpha = weak ? 0.45 : 0.82;
    ctx.fillStyle = 'rgba(12,16,36,' + bgAlpha + ')';
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(c.width - r, 0);
    ctx.quadraticCurveTo(c.width, 0, c.width, r);
    ctx.lineTo(c.width, c.height - r);
    ctx.quadraticCurveTo(c.width, c.height, c.width - r, c.height);
    ctx.lineTo(r, c.height);
    ctx.quadraticCurveTo(0, c.height, 0, c.height - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = borderHex;
    ctx.lineWidth = weak ? 2 : 3;
    ctx.stroke();
    ctx.fillStyle = weak ? 'rgba(255,255,255,0.82)' : '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 6;
    ctx.fillText(fullText, c.width / 2, c.height / 2);
    var tex = new three.CanvasTexture(c);
    tex.colorSpace = three.SRGBColorSpace || three.sRGBEncoding;
    return { tex: tex, aspect: c.width / c.height };
  }

  function updateCameraFromOrbit(camera) {
    var c = state.cam;
    camera.position.x = c.target.x + c.radius * Math.sin(c.phi) * Math.cos(c.theta);
    camera.position.y = c.target.y + c.radius * Math.cos(c.phi);
    camera.position.z = c.target.z + c.radius * Math.sin(c.phi) * Math.sin(c.theta);
    camera.lookAt(c.target.x, c.target.y, c.target.z);
  }

  // ── Orbit controls (custom, lightweight) ────────────────────
  // Multi-pointer aware: 1 pointer = orbit drag, 2 pointers = pinch zoom.
  var _pointers = new Map();   // pointerId → { x, y }
  var _pinch = null;           // { startDist, startRadius }
  function bindControls(canvas) {
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup',   onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    // Some browsers (iOS Safari) fire gesturestart for pinch — swallow
    // so the page doesn't zoom behind our modal.
    canvas.addEventListener('gesturestart', _preventDefault, { passive: false });
    canvas.addEventListener('gesturechange', _preventDefault, { passive: false });
  }
  function unbindControls(canvas) {
    if (!canvas) return;
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup',   onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('gesturestart', _preventDefault);
    canvas.removeEventListener('gesturechange', _preventDefault);
    _pointers.clear();
    _pinch = null;
  }
  function _preventDefault(e) { try { e.preventDefault(); } catch(_) {} }

  function _pinchDistance() {
    var arr = Array.from(_pointers.values());
    if (arr.length < 2) return 0;
    var dx = arr[0].x - arr[1].x, dy = arr[0].y - arr[1].y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function _pinchMidpoint() {
    var arr = Array.from(_pointers.values());
    if (arr.length < 2) return { x: 0, y: 0 };
    return { x: (arr[0].x + arr[1].x) / 2, y: (arr[0].y + arr[1].y) / 2 };
  }

  // Pan the orbit target in the camera's view plane.
  // dx/dy are screen-pixel deltas (positive dx = finger moved right).
  function _panCameraTarget(dx, dy) {
    if (!state.camera || !state.renderer || !THREE) return;
    var rect = state.renderer.domElement.getBoundingClientRect();
    if (!rect.height) return;
    // World units per screen pixel at current distance
    var fov = state.camera.fov * Math.PI / 180;
    var scale = state.cam.radius * 2 * Math.tan(fov / 2) / rect.height;
    var fwd = new THREE.Vector3(
      state.cam.target.x - state.camera.position.x,
      state.cam.target.y - state.camera.position.y,
      state.cam.target.z - state.camera.position.z
    ).normalize();
    var right = new THREE.Vector3().crossVectors(fwd, state.camera.up).normalize();
    var up    = new THREE.Vector3().crossVectors(right, fwd).normalize();
    // Drag right → move content right → move target left (invert dx)
    state.cam.target.x += (-right.x * dx + up.x * dy) * scale;
    state.cam.target.y += (-right.y * dx + up.y * dy) * scale;
    state.cam.target.z += (-right.z * dx + up.z * dy) * scale;
  }

  function onPointerDown(e) {
    _pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    state.autoRotate = false;
    if (_pointers.size === 2) {
      // Start pinch + pan; stop any in-progress drag so orbit doesn't also move.
      state.drag = null;
      _pinch = {
        prevDist: _pinchDistance(),
        prevMid: _pinchMidpoint()
      };
    } else if (_pointers.size === 1) {
      state.drag = {
        startX: e.clientX, startY: e.clientY,
        theta: state.cam.theta, phi: state.cam.phi,
        id: e.pointerId, moved: 0,
        downTime: Date.now(),
        // Desktop: Shift held at pointerdown → pan instead of orbit for this drag
        mode: (e.shiftKey || e.ctrlKey || e.button === 1) ? 'pan' : 'orbit',
        lastX: e.clientX, lastY: e.clientY
      };
    }
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch(_) {}
  }
  function onPointerMove(e) {
    if (_pointers.has(e.pointerId)) {
      _pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (_pinch && _pointers.size === 2) {
      // Incremental zoom + pan anchored on the pinch midpoint so zooming
      // follows the fingers the same way pinching a map does.
      var d = _pinchDistance();
      var mid = _pinchMidpoint();
      if (_pinch.prevDist && d > 0) {
        var factor = _pinch.prevDist / d; // finger spread → radius shrinks
        if (factor !== 1) _zoomTowardPoint(mid.x, mid.y, factor);
      }
      if (_pinch.prevMid) {
        var mdx = mid.x - _pinch.prevMid.x;
        var mdy = mid.y - _pinch.prevMid.y;
        if (Math.abs(mdx) + Math.abs(mdy) > 0.1) _panCameraTarget(mdx, mdy);
      }
      _pinch.prevDist = d;
      _pinch.prevMid = mid;
      updateCameraFromOrbit(state.camera);
      return;
    }
    if (!state.drag) return;
    var dx = e.clientX - state.drag.startX;
    var dy = e.clientY - state.drag.startY;
    state.drag.moved = Math.max(state.drag.moved, Math.abs(dx) + Math.abs(dy));
    if (state.drag.mode === 'pan') {
      // Incremental pan using last-frame position
      var sdx = e.clientX - (state.drag.lastX || state.drag.startX);
      var sdy = e.clientY - (state.drag.lastY || state.drag.startY);
      _panCameraTarget(sdx, sdy);
      state.drag.lastX = e.clientX;
      state.drag.lastY = e.clientY;
      updateCameraFromOrbit(state.camera);
      return;
    }
    state.cam.theta = state.drag.theta - dx * 0.006;
    state.cam.phi   = Math.max(0.15, Math.min(Math.PI - 0.15, state.drag.phi - dy * 0.005));
    updateCameraFromOrbit(state.camera);
  }
  function onPointerUp(e) {
    var wasDrag = state.drag;
    _pointers.delete(e.pointerId);
    if (_pointers.size < 2) _pinch = null;
    if (_pointers.size === 0) state.drag = null;
    // Tap detection — only if we were single-pointer and barely moved
    if (wasDrag && wasDrag.id === e.pointerId && !_pinch && wasDrag.moved < 6 && (Date.now() - wasDrag.downTime) < 400) {
      handleTap(e.clientX, e.clientY, e.currentTarget || state.renderer.domElement);
    }
  }
  // ── Zoom anchored to a screen point ────────────────────────
  // Keeps the world point under (clientX,clientY) fixed while zooming:
  //   1) find the world point on the target-plane under the cursor
  //   2) scale (cam.radius, cam.target) around that anchor
  // Used by both wheel zoom and pinch zoom so both feel like map zoom.
  function _zoomTowardPoint(clientX, clientY, factor) {
    if (!THREE || !state.camera || !state.renderer) return;
    var canvas = state.renderer.domElement;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    var ndcX = ((clientX - rect.left) / rect.width)  * 2 - 1;
    var ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

    var camPos = state.camera.position.clone();
    var targetPos = new THREE.Vector3(state.cam.target.x, state.cam.target.y, state.cam.target.z);
    var viewNormal = targetPos.clone().sub(camPos).normalize();

    var far = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(state.camera);
    var rayDir = far.sub(camPos).normalize();
    var denom = rayDir.dot(viewNormal);
    var anchor;
    if (Math.abs(denom) < 1e-6) {
      anchor = targetPos;
    } else {
      var t = targetPos.clone().sub(camPos).dot(viewNormal) / denom;
      anchor = camPos.clone().add(rayDir.multiplyScalar(t));
    }

    var desiredRadius = state.cam.radius * factor;
    var newRadius = Math.max(8, Math.min(140, desiredRadius));
    var actualFactor = state.cam.radius === 0 ? 1 : (newRadius / state.cam.radius);
    state.cam.radius = newRadius;

    state.cam.target.x = anchor.x + (state.cam.target.x - anchor.x) * actualFactor;
    state.cam.target.y = anchor.y + (state.cam.target.y - anchor.y) * actualFactor;
    state.cam.target.z = anchor.z + (state.cam.target.z - anchor.z) * actualFactor;
    updateCameraFromOrbit(state.camera);
  }

  function onWheel(e) {
    e.preventDefault();
    var factor = e.deltaY > 0 ? 1.12 : 0.89;
    _zoomTowardPoint(e.clientX, e.clientY, factor);
  }

  // ── Raycast picking ────────────────────────────────────────
  function handleTap(clientX, clientY, canvas) {
    if (!THREE || !state.stars || !state.camera) return;
    if (!state.raycaster) state.raycaster = new THREE.Raycaster();
    // Make the pick radius forgiving for sprite/finger targets
    if ('params' in state.raycaster && state.raycaster.params && state.raycaster.params.Sprite === undefined) {
      state.raycaster.params.Sprite = {};
    }
    var rect = canvas.getBoundingClientRect();
    state.pointerNDC.x = ((clientX - rect.left) / rect.width)  * 2 - 1;
    state.pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    state.raycaster.setFromCamera(state.pointerNDC, state.camera);
    // Check satellites first so they take priority over the main stars
    // behind them when a selection is active.
    var pool = [];
    if (state.satellites && state.satellites.children.length) {
      pool = pool.concat(state.satellites.children);
    }
    if (state.categories && state.categories.children.length) {
      pool = pool.concat(state.categories.children);
    }
    if (state.corpusLabels && state.corpusLabels.children.length) {
      pool = pool.concat(state.corpusLabels.children);
    }
    pool = pool.concat(state.stars.children);
    var hits = state.raycaster.intersectObjects(pool, false);
    if (hits && hits.length) {
      for (var h = 0; h < hits.length; h++) {
        var obj = hits[h].object;
        if (!obj || !obj.userData) continue;
        if (obj.userData.isSatellite && obj.userData.isStar) {
          _onSatelliteTap(obj);
          return;
        }
        if (obj.userData.isCategoryLabel) {
          _onCategoryTap(obj);
          return;
        }
        if (obj.userData.isCorpusLabel) {
          _onCorpusLabelTap(obj);
          return;
        }
        if (obj.userData.isStar) {
          selectStar(obj);
          return;
        }
      }
    }
    // Screen-space fallback: raycasting sprites at distance gets flaky
    // because their billboard rect in NDC is tiny. Walk every star, project
    // to screen, pick the one closest to the tap within a generous radius.
    var nearest = null, nearestDist = Infinity;
    // 64 px — fingertip-friendly on mobile. The earlier 48 felt
    // pixel-perfect; users were tapping right next to a label and
    // landing in dead space.
    var threshold = 64;
    var v = new THREE.Vector3();
    function checkChild(child) {
      if (!child.userData) return;
      if (!child.userData.isStar && !child.userData.isCategoryLabel) return;
      child.getWorldPosition(v);
      v.project(state.camera);
      if (v.z > 1) return; // behind camera
      var sx = (v.x + 1) / 2 * rect.width;
      var sy = (-v.y + 1) / 2 * rect.height;
      var dx = (clientX - rect.left) - sx;
      var dy = (clientY - rect.top) - sy;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < threshold && d < nearestDist) {
        nearest = child;
        nearestDist = d;
      }
    }
    if (state.satellites) state.satellites.children.forEach(checkChild);
    if (state.categories) state.categories.children.forEach(checkChild);
    if (state.corpusLabels) state.corpusLabels.children.forEach(checkChild);
    state.stars.children.forEach(checkChild);
    if (nearest) {
      if (nearest.userData.isSatellite) _onSatelliteTap(nearest);
      else if (nearest.userData.isCategoryLabel) _onCategoryTap(nearest);
      else if (nearest.userData.isCorpusLabel) _onCorpusLabelTap(nearest);
      else selectStar(nearest);
      return;
    }
    if (state.activeCategory) _clearCategoryHighlight();
    clearSelection();
  }

  function selectStar(sprite) {
    if (!sprite || !sprite.userData || !sprite.userData.word) return;
    // Restore previous. The earlier code restored with one scalar
    // for both x and y, which crushed wide label sprites back into
    // a square — fine for stars (uniform scale) but the labels we
    // now make pickable in PR #379 carry an aspect ratio.
    if (state.selected && state.selected.sprite && state.selected.sprite !== sprite) {
      var prev = state.selected.sprite;
      var prevBaseX = state.selected.baseScaleX != null ? state.selected.baseScaleX : state.selected.baseScale;
      var prevBaseY = state.selected.baseScaleY != null ? state.selected.baseScaleY : state.selected.baseScale;
      prev.scale.set(prevBaseX, prevBaseY, 1);
      if (prev.material) prev.material.opacity = state.selected.baseOpacity;
    }
    _clearSatellites(); // remove satellites from any previous selection
    var baseX = sprite.scale.x;
    var baseY = sprite.scale.y;
    state.selected = {
      sprite: sprite,
      word: sprite.userData.word,
      baseScale: baseX, // legacy field — kept for any external reader
      baseScaleX: baseX,
      baseScaleY: baseY,
      baseOpacity: sprite.material ? sprite.material.opacity : 1,
    };
    // Emphasize selected — scale BOTH dimensions by 1.6 instead of
    // setting them both to baseX*1.6. The previous form turned a
    // wide label sprite (e.g. "혼자예요" with aspect ~4) into a
    // square 4× too tall — exactly the user's "왜 카드가 커져"
    // screenshot. Uniform multiplication keeps the label's pill
    // shape intact while still drawing the eye.
    var boostFactor = 1.6;
    sprite.scale.set(baseX * boostFactor, baseY * boostFactor, 1);
    if (sprite.material) sprite.material.opacity = 1;
    renderWordCard(sprite.userData.word, sprite.userData.mastery || 0);
    // Recenter the orbit target on the tapped star so subsequent zoom
    // zooms into that star, not the galaxy origin. We deliberately
    // shift the target DOWN in world-Y by ~22 % of the orbit radius
    // — the .khu-card overlay covers the bottom ~280 px of the canvas
    // (~30 % of a phone viewport), so centering the camera ON the
    // sprite hides it behind the card. Pulling the target down moves
    // the visual focus down too, which pushes the sprite into the
    // upper half of the canvas where the user can actually see it.
    // The user-reported "내가 선택한 단어가 안보임".
    var p = sprite.position;
    var cardOffset = state.cam.radius * 0.22;
    animateTarget(p.x, p.y - cardOffset, p.z);
  }

  function clearSelection() {
    _clearSatellites();
    if (!state.selected) return;
    var s = state.selected.sprite;
    if (s) {
      // Restore using stored baseScaleX/Y so wide label sprites go
      // back to their original pill aspect, not a square.
      var bx = state.selected.baseScaleX != null ? state.selected.baseScaleX : state.selected.baseScale;
      var by = state.selected.baseScaleY != null ? state.selected.baseScaleY : state.selected.baseScale;
      s.scale.set(bx, by, 1);
      if (s.material) s.material.opacity = state.selected.baseOpacity;
    }
    state.selected = null;
    hideWordCard();
    animateTarget(0, 0, 0);
  }

  // ── Satellite orbit: related words around the selected star ────
  function _clearSatellites() {
    if (!state.satellites) return;
    while (state.satellites.children.length) {
      var c = state.satellites.children.pop();
      if (c.material) {
        if (c.material.map) { try { c.material.map.dispose(); } catch(_) {} }
        c.material.dispose();
      }
      if (c.geometry) { try { c.geometry.dispose(); } catch(_) {} }
    }
  }

  function _spawnSatellites(parentSprite, list) {
    if (!THREE || !parentSprite || !list || !list.length) return;
    if (!state.satellites || !state.glowTex) return;
    _clearSatellites();
    var parentPos = parentSprite.position;
    var n = Math.min(list.length, 6);
    var orbitR = 3.2 + Math.min(1.4, n * 0.18);
    var tiltY  = (Math.random() - 0.5) * 0.4;
    // Lavender is the "new/suggested" tint used across the app
    var tint = new THREE.Color(0.66, 0.55, 0.98);

    // Build a mesh-line parent marker (tiny invisible sprite) just to
    // anchor orbit — optional. Main work: each satellite.
    for (var i = 0; i < n; i++) {
      var rel = list[i];
      if (!rel || !rel.ko) continue;
      var angle = (i / n) * Math.PI * 2 + Math.random() * 0.15;
      var px = parentPos.x + Math.cos(angle) * orbitR;
      var pz = parentPos.z + Math.sin(angle) * orbitR;
      var py = parentPos.y + tiltY + (Math.random() - 0.5) * 0.8;

      // Star sprite
      var sMat = new THREE.SpriteMaterial({
        map: state.glowTex,
        color: tint.clone(),
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      var sSprite = new THREE.Sprite(sMat);
      sSprite.position.set(px, py, pz);
      sSprite.scale.set(1.0, 1.0, 1);
      sSprite.userData = {
        isStar: true,
        isSatellite: true,
        word: { ko: rel.ko, rom: rel.rom || '', en: rel.en || '', word_ko: rel.ko, word_rom: rel.rom || '', word_en: rel.en || '' },
        mastery: 0.1,
        related: rel,
        saved: false,
        idx: -1
      };
      state.satellites.add(sSprite);

      // Label pill
      var lblBorder = 'rgba(196,181,253,0.6)';
      var lbl = makeLabelTexture(rel.ko, THREE, lblBorder);
      var lblMat = new THREE.SpriteMaterial({
        map: lbl.tex, transparent: true, depthWrite: false, opacity: 0.92
      });
      var lblSprite = new THREE.Sprite(lblMat);
      var lblH = 1.05;
      var lblW = lblH * lbl.aspect;
      lblSprite.scale.set(lblW, lblH, 1);
      lblSprite.position.set(px, py - 0.85, pz);
      lblSprite.renderOrder = 2;
      lblSprite.userData = { isLabel: true, isSatellite: true };
      state.satellites.add(lblSprite);

      // Connector line parent→satellite (thin, lavender)
      var lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        parentPos.x, parentPos.y, parentPos.z,
        px, py, pz
      ]), 3));
      var lineMat = new THREE.LineBasicMaterial({
        color: 0xa78bfa, transparent: true, opacity: 0.35, depthWrite: false
      });
      var line = new THREE.Line(lineGeo, lineMat);
      line.userData = { isSatelliteLine: true };
      state.satellites.add(line);
    }
  }

  // Called when a satellite sprite is tapped: save + flip it green.
  function _onSatelliteTap(sprite) {
    if (!sprite || !sprite.userData) return;
    if (sprite.userData.saved) return; // already saved
    var rel = sprite.userData.related;
    if (!rel) return;
    // Optimistic UI: flip to mint green
    if (sprite.material) {
      sprite.material.color = new THREE.Color(0.31, 0.80, 0.77); // mint
    }
    sprite.scale.set(1.3, 1.3, 1);
    sprite.userData.saved = true;
    // Update the matching chip in the word card if present
    try {
      var chips = document.querySelectorAll('.khu-related-chip');
      chips.forEach(function(btn, idx){
        if ((btn.querySelector('.khu-related-chip-ko') || {}).textContent === rel.ko) {
          btn.classList.add('saved');
          var plus = btn.querySelector('.khu-related-chip-plus');
          if (plus) plus.textContent = '✓';
        }
      });
    } catch(_) {}
    if (typeof saveRelatedWord === 'function') {
      saveRelatedWord(rel).then(function(ok) {
        if (!ok && sprite.material) {
          sprite.material.color = new THREE.Color(0.96, 0.42, 0.42); // error red flash
          setTimeout(function(){
            if (sprite.material) sprite.material.color = new THREE.Color(0.66, 0.55, 0.98);
          }, 700);
          sprite.userData.saved = false;
        }
      });
    }
  }

  function animateTarget(tx, ty, tz) {
    // Simple interpolated shift of camera target over ~24 frames
    var start = { x: state.cam.target.x, y: state.cam.target.y, z: state.cam.target.z };
    var steps = 24, i = 0;
    function step() {
      if (!state.open || !state.camera) return;
      i++;
      var t = Math.min(1, i / steps);
      // ease-out cubic
      var e = 1 - Math.pow(1 - t, 3);
      state.cam.target.x = start.x + (tx - start.x) * e;
      state.cam.target.y = start.y + (ty - start.y) * e;
      state.cam.target.z = start.z + (tz - start.z) * e;
      updateCameraFromOrbit(state.camera);
      if (t < 1) requestAnimationFrame(step);
    }
    step();
  }

  // ── Word card render ───────────────────────────────────────
  function renderWordCard(word, mastery) {
    var card = document.getElementById('khu-card');
    if (!card) return;
    var badgeCls, badgeLbl;
    if (mastery < 0.4)      { badgeCls = 'lvl-new';       badgeLbl = 'New'; }
    else if (mastery < 0.75){ badgeCls = 'lvl-learning';  badgeLbl = 'Learning'; }
    else                    { badgeCls = 'lvl-mastered';  badgeLbl = 'Mastered'; }
    var badge = document.getElementById('khu-card-badge');
    var ko    = document.getElementById('khu-card-ko');
    var rom   = document.getElementById('khu-card-rom');
    var en    = document.getElementById('khu-card-en');
    var related = document.getElementById('khu-card-related');
    if (badge) { badge.className = 'khu-card-badge ' + badgeCls; badge.textContent = badgeLbl; }
    if (ko)  ko.textContent  = word.word_ko || word.ko || '';
    if (rom) rom.textContent = word.word_rom || word.rom || '';
    if (en)  en.textContent  = word.word_en || word.en || '';
    if (related) related.innerHTML = '<span class="khu-related-chip-loading">Finding related words…</span>';
    card.classList.add('show');
    card.setAttribute('aria-hidden', 'false');
    // Async: related words (cached after first fetch per word)
    var wordKey = word.word_ko || word.ko;
    fetchRelatedWords(word).then(function(list) {
      // Only render if this word is still the active selection
      if (!state.selected || !state.selected.word) return;
      var activeKey = state.selected.word.word_ko || state.selected.word.ko;
      if (activeKey !== wordKey) return;
      renderRelatedChips(list);
      _spawnSatellites(state.selected.sprite, list);
    });
  }

  function hideWordCard() {
    var card = document.getElementById('khu-card');
    if (!card) return;
    card.classList.remove('show');
    card.setAttribute('aria-hidden', 'true');
  }

  // ── Related words (cached forever in localStorage) ─────────
  var RELATED_KEY = function(ko) { return 'kh_related_' + ko; };

  function readRelatedFromCache(ko) {
    try {
      var raw = localStorage.getItem(RELATED_KEY(ko));
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch(_) { return null; }
  }
  function writeRelatedToCache(ko, list) {
    try { localStorage.setItem(RELATED_KEY(ko), JSON.stringify(list)); } catch(_) {}
  }

  // Enrich any related word with rom/en from the in-memory VOCAB map if
  // we have it (populated by loadVocabFromDB on pages that include it).
  function enrichFromVocabBank(list) {
    if (!window.VOCAB) return list;
    return list.map(function(w) {
      if (w.en && w.rom) return w;
      var v = window.VOCAB[w.ko];
      if (v) {
        return { ko: w.ko, rom: w.rom || v.rom || '', en: w.en || v.en || '' };
      }
      return w;
    });
  }

  async function fetchRelatedWords(word) {
    var ko = word.word_ko || word.ko || '';
    if (!ko) return [];
    // 1) localStorage cache
    var cached = readRelatedFromCache(ko);
    if (cached && cached.length) return enrichFromVocabBank(cached);
    // 2) Ask Claude Haiku — returns 5 semantically related items
    if (typeof callClaude !== 'function') return [];
    var en = word.word_en || word.en || '';
    var prompt = 'Generate exactly 5 Korean vocabulary words that are semantically related to "' + ko + '"'
      + (en ? ' (meaning: ' + en + ')' : '')
      + '. Rules:\n'
      + '- Related by topic, category, or meaning family (synonyms, antonyms, same domain, common collocations).\n'
      + '- Use the DICTIONARY FORM for verbs and adjectives (ending in -다).\n'
      + '- Avoid trivial high-frequency words (정말, 많이, 너무, 진짜, 아주, 매우, 조금, 좀, 잘, 또, 다, 더, 그냥, 그리고, 그래서, 한국, 사람, 것, 수, 거, 때, 말).\n'
      + '- Include at least 2 intermediate-difficulty words.\n'
      + 'Return ONLY a JSON array of 5 items, each: {"ko":"Korean","rom":"romanization","en":"concise English gloss"}. No other text.';
    try {
      var res = await callClaude({
        feature: 'related-words',
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      });
      var text = (res && res.content && res.content[0] && res.content[0].text) || '[]';
      var ai = text.indexOf('['), bi = text.lastIndexOf(']');
      if (ai >= 0 && bi > ai) text = text.slice(ai, bi + 1);
      var arr = JSON.parse(text);
      if (!Array.isArray(arr)) return [];
      arr = arr.filter(function(x) { return x && x.ko; }).slice(0, 5);
      writeRelatedToCache(ko, arr);
      return enrichFromVocabBank(arr);
    } catch(_) {
      return [];
    }
  }

  // ── Save a related word into the user's word bank ──────────
  async function saveRelatedWord(rel) {
    if (!rel || !rel.ko) return false;
    if (typeof supaUser === 'undefined' || !supaUser || typeof getSupa !== 'function') return false;
    var sb = getSupa();
    if (!sb) return false;
    try {
      // Match the signature used by quickSaveWord elsewhere in the app.
      if (sb.rpc) {
        var r = await sb.rpc('save_or_update_word', {
          p_word_key:       rel.ko,
          p_word_ko:        rel.ko,
          p_word_en:        rel.en  || null,
          p_word_rom:       rel.rom || null,
          p_source_kind:    'universe',
          p_review_delta:   0,
          p_correct_delta:  0,
          p_wrong_delta:    0
        });
        if (r && !r.error) return true;
        if (r && r.error) console.warn('[KHUniverse] save_or_update_word error', r.error);
      }
      // Fallback direct upsert
      var up = await sb.from('user_saved_words').upsert({
        user_id: supaUser.id,
        word_ko: rel.ko, word_rom: rel.rom || '', word_en: rel.en || ''
      }, { onConflict: 'user_id,word_ko' });
      return !up.error;
    } catch(e) { console.warn('[KHUniverse] saveRelatedWord', e); return false; }
  }

  // ── Render related chips into the open card ────────────────
  function renderRelatedChips(relatedList) {
    var wrap = document.getElementById('khu-card-related');
    if (!wrap) return;
    if (!relatedList || !relatedList.length) {
      wrap.innerHTML = '<span class="khu-related-chip-loading">No related words found.</span>';
      return;
    }
    var html = '<div class="khu-related-label">Related Words</div>';
    html += relatedList.map(function(r, idx) {
      var ko  = (r.ko || '').replace(/</g,'&lt;');
      var en  = (r.en || '').replace(/</g,'&lt;').replace(/"/g,'&quot;');
      return '<button class="khu-related-chip" data-idx="' + idx + '" title="' + en + '">'
        + '<span class="khu-related-chip-ko">' + ko + '</span>'
        + '<span class="khu-related-chip-plus" aria-hidden="true">＋</span>'
        + '</button>';
    }).join('');
    wrap.innerHTML = html;
    // Bind save-on-click
    var chips = wrap.querySelectorAll('.khu-related-chip');
    chips.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var i = parseInt(btn.getAttribute('data-idx'), 10);
        var rel = relatedList[i];
        if (!rel) return;
        btn.classList.add('saving');
        saveRelatedWord(rel).then(function(ok) {
          btn.classList.remove('saving');
          if (ok) {
            btn.classList.add('saved');
            btn.querySelector('.khu-related-chip-plus').textContent = '✓';
            btn.setAttribute('aria-disabled', 'true');
          } else {
            btn.classList.add('error');
            setTimeout(function(){ btn.classList.remove('error'); }, 900);
          }
        });
      });
    });
  }

  function onResize() {
    var r = state.renderer, cam = state.camera;
    if (!r || !cam) return;
    var canvas = r.domElement;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    var aspect = w / Math.max(1, h);
    cam.aspect = aspect;
    // Match the aspect-aware FOV from buildScene so an
    // orientation change (portrait → landscape) re-fits the
    // scene horizontally instead of cutting labels off again.
    cam.fov = aspect < 0.6 ? 78 : aspect < 0.85 ? 68 : 55;
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
    // Throttled corpus label LOD update
    state.corpusLabelsTickAt = (state.corpusLabelsTickAt || 0) + dt;
    if (state.corpusLabelsTickAt > CORPUS_TICK_INTERVAL) {
      state.corpusLabelsTickAt = 0;
      updateCorpusLabels();
    }
    // Gentle pulse on mastery aura sprites so mastered words feel alive.
    if (state.stars) {
      var now = state.clock ? state.clock.elapsedTime : performance.now() / 1000;
      for (var auraI = 0; auraI < state.stars.children.length; auraI++) {
        var child = state.stars.children[auraI];
        if (!child.userData || !child.userData.isAura) continue;
        var base = child.userData.baseScale || 1;
        var phase = child.userData.phase || 0;
        var scale = base * (1 + 0.06 * Math.sin(now * 1.4 + phase));
        child.scale.set(scale, scale, 1);
      }
      // Twinkle the constellation lines so the connection feels alive
      if (state.constellation && state.constellation.children.length) {
        var twinkle = 0.42 + 0.18 * Math.sin(now * 1.3);
        state.constellation.children.forEach(function(line) {
          if (line.material) line.material.opacity = twinkle;
        });
      }
    }
    // Satellites orbit around the selected star — spin the group gently,
    // pivoted on the parent position.
    if (state.satellites && state.selected && state.selected.sprite) {
      var px = state.selected.sprite.position.x;
      var py = state.selected.sprite.position.y;
      var pz = state.selected.sprite.position.z;
      var a  = dt * 0.35;
      var cosA = Math.cos(a), sinA = Math.sin(a);
      state.satellites.children.forEach(function(child) {
        // Only rotate the sprites (stars + labels); refresh lines after.
        if (!child.userData || (!child.userData.isStar && !child.userData.isLabel)) return;
        var dx = child.position.x - px;
        var dz = child.position.z - pz;
        child.position.x = px + dx * cosA - dz * sinA;
        child.position.z = pz + dx * sinA + dz * cosA;
      });
      // Rebuild connector line endpoints so they track the orbiting stars.
      state.satellites.children.forEach(function(child, i) {
        if (!child.userData || !child.userData.isSatelliteLine) return;
        // Find the star immediately before this line (we pushed in order
        // star, label, line per satellite).
        var starChild = null;
        for (var j = i - 1; j >= 0; j--) {
          var cc = state.satellites.children[j];
          if (cc.userData && cc.userData.isStar && cc.userData.isSatellite) { starChild = cc; break; }
        }
        if (!starChild || !child.geometry) return;
        var pa = child.geometry.getAttribute('position');
        if (!pa) return;
        pa.array[0] = px; pa.array[1] = py; pa.array[2] = pz;
        pa.array[3] = starChild.position.x; pa.array[4] = starChild.position.y; pa.array[5] = starChild.position.z;
        pa.needsUpdate = true;
      });
    }
    state.renderer.render(state.scene, state.camera);
  }

  // ── Background music ────────────────────────────────────────
  // Looped ambient track that plays whenever the Universe overlay
  // is open. Mute preference persists across sessions in
  // localStorage so a user who muted it stays muted on the next
  // visit. Audio file is loaded lazily from /img/universe/bgm.mp3
  // (or .ogg) — if the file isn't there yet, .play() rejects and
  // we just leave the button in its mute state without yelling.
  var KHU_BGM_MUTED_KEY = 'kh_universe_bgm_muted';
  var KHU_BGM_VOLUME = 0.4;
  function _bgmEl() { return document.getElementById('khu-bgm'); }
  function _bgmBtn() { return document.getElementById('khu-bgm-btn'); }
  function _bgmIsMuted() {
    try { return localStorage.getItem(KHU_BGM_MUTED_KEY) === '1'; } catch (_) { return false; }
  }
  function _bgmSetMuted(v) {
    try { localStorage.setItem(KHU_BGM_MUTED_KEY, v ? '1' : '0'); } catch (_) {}
    var btn = _bgmBtn();
    if (btn) btn.classList.toggle('muted', !!v);
  }
  function _bgmStart() {
    var a = _bgmEl();
    if (!a) return;
    a.volume = KHU_BGM_VOLUME;
    var muted = _bgmIsMuted();
    _bgmSetMuted(muted);
    if (muted) { try { a.pause(); } catch (_) {} return; }
    // .play() returns a Promise; reject silently if the file is
    // missing or the browser blocks it.
    var p = a.play && a.play();
    if (p && typeof p.catch === 'function') p.catch(function () {});
  }
  function _bgmPause() {
    var a = _bgmEl();
    if (a) { try { a.pause(); } catch (_) {} }
  }

  // ── Public API ──────────────────────────────────────────────
  var KHUniverse = {};

  KHUniverse._toggleBgm = function () {
    var a = _bgmEl();
    if (!a) return;
    var nowMuted = !_bgmIsMuted();
    _bgmSetMuted(nowMuted);
    if (nowMuted) {
      try { a.pause(); } catch (_) {}
    } else {
      a.volume = KHU_BGM_VOLUME;
      var p = a.play && a.play();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    }
  };

  function onKeydown(e) {
    if (!state.open) return;
    if (e.key === 'Escape' || e.key === 'Esc') {
      if (state.selected) clearSelection();
      else if (state.activeCategory) _clearCategoryHighlight();
      else KHUniverse.close();
    }
  }

  KHUniverse.open = function(opts) {
    opts = opts || {};
    var overlay = ensureOverlay();
    var loading = document.getElementById('khu-loading');
    overlay.classList.add('open');
    state.open = true;
    state.words = (opts.words || []).slice(0, 600);
    document.addEventListener('keydown', onKeydown);

    // Activate one nebula backdrop at random. Cosmic Cliffs is
    // available via opts.nebula='cliffs' for themed views but
    // dropped from the random rotation — its warm orange clashed
    // with the deep-purple Universe palette and washed out the
    // category labels. Witch Head + Carina both sit in the cool
    // purple/red range that blends with the existing gradient.
    var pool = ['witch', 'carina'];
    var allKnown = ['witch', 'carina', 'cliffs'];
    var pick = (opts.nebula && allKnown.indexOf(opts.nebula) >= 0)
      ? opts.nebula
      : pool[Math.floor(Math.random() * pool.length)];
    allKnown.forEach(function(n) {
      var el = document.getElementById('khu-nebula-' + n);
      if (el) el.classList.toggle('active', n === pick);
    });

    // Background music — start (or stay paused) based on the
    // persisted mute preference. The audio file lives at
    // /img/universe/bgm.mp3 (.ogg fallback); if it 404s the play()
    // promise rejects silently and we just leave the toggle button
    // in its mute state. .play() works here because open() is
    // called from a user click, so browser autoplay policy is
    // satisfied.
    _bgmStart();

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
        state.words && rebuildWordStars(three, state.stars);
        // Renderer is reused across close/reopen, but its internal
        // viewport (renderer.setSize) and camera.aspect were last set
        // by buildScene on the first open. If the user rotates the
        // device or just reopens after the layout stabilised, the
        // canvas's internal pixel buffer is freshly sized above but
        // the renderer's viewport is stale → WebGL draws into the
        // old rectangle, leaving a dark strip on one edge and slicing
        // labels at the other (the user-reported "껐다 키면 빈공간
        // 생기고 짤림"). onResize() reads the current canvas size and
        // re-applies it to both the renderer and the camera.
        try { onResize(); } catch (_) {}
      } else {
        buildScene(three, canvas);
      }
      // Bind pointer / wheel / pinch handlers on every open. Close
      // unbinds them via unbindControls(); on reopen the renderer is
      // reused (we don't dispose it) but the handlers are gone, so
      // without re-binding the canvas was visually present but
      // completely unresponsive to touch / drag / zoom — the user-
      // reported "껐다 다시 키면 터치 안먹힘". bindControls is
      // idempotent enough: addEventListener with the same {target,
      // type, listener} tuple is a no-op on the first open, and a
      // genuine re-attach on the reopen.
      bindControls(canvas);
      if (loading) loading.classList.add('hidden');
      if (!state.animId) tick();
      // Kick off category enrichment + corpus load in parallel.
      enrichWithCategories(state.words).then(function() {
        if (!state.open || !state.stars) return;
        rebuildWordStars(three, state.stars);
        rebuildCorpusPoints(three);
      });
      loadCorpusWords(state.words).then(function(corpus) {
        state.corpusWords = corpus || [];
        if (!state.open || !state.stars) return;
        rebuildCorpusPoints(three);
      });
    }).catch(function(err) {
      if (loading) loading.innerHTML = '<div style="color:#fca5a5">Could not load the galaxy engine.</div>';
      console.warn('[KHUniverse] three load failed', err);
    });
  };

  KHUniverse.close = function() {
    state.open = false;
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.classList.remove('open');
    // Reset every nebula layer to inactive on close so the next
    // open() can fade in a single one cleanly. Without this, a
    // close-then-reopen pair left the previous .active class in
    // place; if the new pick differed, both images cross-faded
    // for 1.2s and visibly overlapped (the user-reported "껐다
    // 다시 키면 오류" screenshot).
    var nebs = overlay ? overlay.querySelectorAll('.khu-nebula') : [];
    for (var i = 0; i < nebs.length; i++) nebs[i].classList.remove('active');
    // Pause background music on close. We don't reset currentTime
    // here so reopening picks up roughly where it left off — feels
    // more natural than restarting the same intro every time.
    _bgmPause();
    if (state.animId) { cancelAnimationFrame(state.animId); state.animId = null; }
    if (state.renderer) unbindControls(state.renderer.domElement);
    if (state.activeCategory) _clearCategoryHighlight();
    clearSelection();
    document.removeEventListener('keydown', onKeydown);
    document.body.style.overflow = '';
  };

  // Exposed for the in-card close button
  KHUniverse._clearSelection = clearSelection;

  // Zoom controls (called from the overlay buttons)
  KHUniverse._zoom = function(factor) {
    if (!state.camera) return;
    state.cam.radius = Math.max(8, Math.min(140,state.cam.radius * factor));
    updateCameraFromOrbit(state.camera);
  };
  KHUniverse._resetView = function() {
    if (!state.camera) return;
    state.cam.radius = 52;
    state.cam.theta = 0;
    state.cam.phi = Math.PI * 0.42;
    state.cam.target.x = state.cam.target.y = state.cam.target.z = 0;
    state.autoRotate = true;
    if (state.activeCategory) _clearCategoryHighlight();
    clearSelection();
    updateCameraFromOrbit(state.camera);
  };

  window.KHUniverse = KHUniverse;
})();
