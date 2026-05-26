import { defineConfig } from 'vite';
import { readdirSync, copyFileSync, mkdirSync, existsSync, cpSync, readFileSync, writeFileSync, statSync } from 'fs';
import { resolve, extname } from 'path';
import { transform as esbuildTransform } from 'esbuild';

// Collect all HTML files in korehan/ as entry points (multi-page app)
function getHtmlEntries() {
  const dir = resolve(__dirname, 'korehan');
  const entries = {};
  readdirSync(dir).forEach(file => {
    if (file.endsWith('.html')) {
      entries[file.replace('.html', '')] = resolve(dir, file);
    }
  });
  return entries;
}

// Walk a directory + apply a callback to every file (relative paths).
function walk(srcDir, distDir, onFile) {
  if (!existsSync(srcDir)) return;
  if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
  for (const name of readdirSync(srcDir)) {
    const sp = resolve(srcDir, name);
    const dp = resolve(distDir, name);
    if (statSync(sp).isDirectory()) walk(sp, dp, onFile);
    else onFile(sp, dp);
  }
}

// Minify JS / CSS via esbuild. Falls back to a raw copy if the
// transform throws (so a brand-new syntax never blocks the build).
async function minifyOrCopy(srcPath, distPath) {
  const ext = extname(srcPath).toLowerCase();
  if (ext === '.js') {
    try {
      const src = readFileSync(srcPath, 'utf8');
      const res = await esbuildTransform(src, {
        loader: 'js',
        minify: true,
        // Keep all top-level names. Some inline HTML uses onclick="foo()"
        // — if esbuild renamed the global `foo`, those handlers would
        // fail. The size hit is minor; the safety is worth it.
        keepNames: true,
        target: 'es2017',
      });
      // CRITICAL: wrap the minified bundle in an IIFE so esbuild's
      // keepNames helper (and any other minifier-emitted single-letter
      // top-level `var`s) stay file-local and can't clobber sibling
      // files loaded onto the same `window`.
      //
      // Cross-file globals the source code expects (top-level
      // function declarations, top-level `var`/`let`/`const` from
      // the SOURCE — not the minifier's helpers) get explicitly
      // re-exported onto `window` via a generated footer.
      //
      // For source-level `var` declarations we use a getter/setter
      // pair so that REASSIGNMENTS inside the IIFE propagate to
      // window readers. This was the source of incident #2 on
      // 2026-05-26: shared.js mutates `supaUser` after the session
      // check, but the previous flat re-export captured the value
      // ONCE (always null), so cross-file readers in study-room.js
      // saw `window.supaUser = null` forever. The getter pattern
      // re-reads the live IIFE-local on every external access.
      writeFileSync(distPath, isolateMinifiedBundle(res.code, src));
      return;
    } catch (e) {
      console.warn('[copy-static] minify failed for', srcPath, '→ raw copy.', e.message || e);
    }
  } else if (ext === '.css') {
    try {
      const src = readFileSync(srcPath, 'utf8');
      const res = await esbuildTransform(src, { loader: 'css', minify: true });
      writeFileSync(distPath, res.code);
      return;
    } catch (e) {
      console.warn('[copy-static] css minify failed for', srcPath, '→ raw copy.', e.message || e);
    }
  }
  copyFileSync(srcPath, distPath);
}

// Wrap the minified output in an IIFE so all minifier-emitted top-
// level vars (especially the keepNames helper which esbuild picks
// short single-letter names for) stay file-local. Then re-export
// cross-file globals onto `window` via a generated footer.
//
// - Top-level FUNCTION declarations from source → `window.X = X`
//   (simple assign; functions don't get reassigned externally).
// - Top-level `const`/`let` declarations from source → `window.X = X`
//   (one-shot capture is correct; these are immutable bindings).
// - Top-level `var` declarations from source → getter/setter pair
//   so internal reassignments inside the IIFE propagate to external
//   readers. Without this, `var supaUser = null` followed by a later
//   `supaUser = user` inside shared.js leaves window.supaUser stuck
//   at the initial null forever (incident #2 on 2026-05-26).
function isolateMinifiedBundle(minified, originalSrc) {
  const decls = collectTopLevelDeclarations(originalSrc);
  const fnRe = decls.functions;
  const constLetRe = decls.constLet;
  const varRe = decls.vars;
  const totalExports = fnRe.length + constLetRe.length + varRe.length;
  if (!totalExports) return `(function(){${minified}})();`;
  const parts = [];
  parts.push(';(function(W){if(!W)return;');
  for (const f of fnRe) {
    parts.push(`try{if(typeof ${f}==="function")W.${f}=${f}}catch(e){}`);
  }
  for (const v of constLetRe) {
    parts.push(`try{if(typeof ${v}!=="undefined")W.${v}=${v}}catch(e){}`);
  }
  // Getter/setter for `var` so reassignments propagate. Fall back to
  // a plain assign if defineProperty throws (e.g. a sibling file
  // already installed a non-configurable property under the same name).
  for (const v of varRe) {
    parts.push(`try{Object.defineProperty(W,"${v}",{configurable:true,get:function(){return ${v}},set:function(_v){${v}=_v}})}catch(e){try{W.${v}=${v}}catch(_){}}`);
  }
  parts.push('})(typeof window!=="undefined"?window:null);');
  const footer = parts.join('');
  return `(function(){${minified}${footer}})();`;
}

function collectTopLevelDeclarations(src) {
  const functions = new Set();
  const constLet = new Set();
  const vars = new Set();
  // Top-level only: declaration must start at column 0 (no leading
  // whitespace). Indented declarations are function-locals — they
  // don't exist at IIFE-top-level scope, and exporting them via
  // getter/setter would recurse infinitely (the getter resolves the
  // name through `window`, calling itself). 2026-05-26 incident #4.
  //
  // function NAME( — sync or async.
  const fnRe = /^(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/gm;
  let m;
  while ((m = fnRe.exec(src))) functions.add(m[1]);
  // var|let|const NAME = ... — only catches single-name declarations.
  // Skips single-character names (build-tool internal) and the
  // `__kh_` prefix reserved for our own renames.
  const declRe = /^(var|let|const)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=/gm;
  while ((m = declRe.exec(src))) {
    const kind = m[1];
    const name = m[2];
    if (name.length === 1) continue;
    if (name.startsWith('__kh_')) continue;
    if (kind === 'var') vars.add(name);
    else constLet.add(name);
  }
  return {
    functions: [...functions],
    constLet: [...constLet],
    vars: [...vars],
  };
}

// Plugin: copy + minify static files Vite doesn't process.
function copyStaticPlugin() {
  return {
    name: 'copy-static',
    async closeBundle() {
      const dist = resolve(__dirname, 'dist');
      const src = resolve(__dirname, 'korehan');
      // Top-level standalone .js / .css the HTML loads via <script src> /
      // <link rel="stylesheet"> — these aren't part of Vite's module graph
      // because they're not imported. Minify them anyway so prod doesn't
      // ship a 1MB unminified study-room.js to every Samsung Internet
      // user on LTE.
      const topFiles = readdirSync(src).filter(f => /\.(js|css)$/.test(f));
      for (const f of topFiles) {
        await minifyOrCopy(resolve(src, f), resolve(dist, f));
      }
      // Copy _headers for Cloudflare
      if (existsSync(resolve(src, '_headers')))
        copyFileSync(resolve(src, '_headers'), resolve(dist, '_headers'));
      // Copy robots.txt (bot blocking policy)
      if (existsSync(resolve(src, 'robots.txt')))
        copyFileSync(resolve(src, 'robots.txt'), resolve(dist, 'robots.txt'));
      // Copy sitemap.xml (search-engine discovery)
      if (existsSync(resolve(src, 'sitemap.xml')))
        copyFileSync(resolve(src, 'sitemap.xml'), resolve(dist, 'sitemap.xml'));
      // Assets directory (recursive — fonts / images / room / shop).
      const assetsDir = resolve(src, 'assets');
      const distAssets = resolve(dist, 'assets');
      if (existsSync(assetsDir)) {
        if (!existsSync(distAssets)) mkdirSync(distAssets, { recursive: true });
        readdirSync(assetsDir).forEach(f =>
          cpSync(resolve(assetsDir, f), resolve(distAssets, f), { recursive: true })
        );
      }
      // js/ directory — same minify pass for the split modules.
      const jsDir = resolve(src, 'js');
      const distJs = resolve(dist, 'js');
      if (existsSync(jsDir)) {
        await new Promise((res) => {
          const promises = [];
          walk(jsDir, distJs, (sp, dp) => { promises.push(minifyOrCopy(sp, dp)); });
          Promise.all(promises).then(res, res);
        });
      }
      // img/ directory (illustrations + guide assets referenced
      // directly by HTML at runtime — Vite doesn't crawl these because
      // they're loaded via JS-built `src` strings, not <img src=>).
      const imgDir = resolve(src, 'img');
      const distImg = resolve(dist, 'img');
      if (existsSync(imgDir)) {
        if (!existsSync(distImg)) mkdirSync(distImg, { recursive: true });
        readdirSync(imgDir).forEach(f =>
          cpSync(resolve(imgDir, f), resolve(distImg, f), { recursive: true })
        );
      }
      // lottie/ directory (animated illustration JSON files
      // probed at runtime by _phraseHydrateLottie).
      const lottieDir = resolve(src, 'lottie');
      const distLottie = resolve(dist, 'lottie');
      if (existsSync(lottieDir)) {
        if (!existsSync(distLottie)) mkdirSync(distLottie, { recursive: true });
        readdirSync(lottieDir).forEach(f =>
          cpSync(resolve(lottieDir, f), resolve(distLottie, f), { recursive: true })
        );
      }
    }
  };
}

export default defineConfig({
  root: 'korehan',
  publicDir: false,  // We handle static files via plugin
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: getHtmlEntries(),
    },
    // Don't hash JS/CSS filenames — keep original names for cache busting via ?v= params
    assetsDir: 'assets',
    // Vite's built-in HTML minifier still runs on each entry HTML;
    // standalone JS / CSS files go through esbuild in copyStaticPlugin.
    minify: 'esbuild',
    sourcemap: false,
    // Target older Samsung Internet builds (Chrome ~80) — esbuild will
    // skip optional-chaining / nullish-coalescing transforms above
    // this floor. Most learners are on Samsung Internet stock, which
    // lags Chrome by a few versions.
    target: 'es2017',
  },
  server: {
    port: 3000,
  },
  plugins: [copyStaticPlugin()],
});
