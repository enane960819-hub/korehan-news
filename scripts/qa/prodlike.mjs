// Build a production-like copy of korehan/ for the click-through QA scripts.
//
// Cloudflare Pages runs `vite build`, which wraps every .js file in its own
// IIFE and re-exports top-level names onto window (vite.config.js,
// isolateMinifiedBundle). A plain `python3 -m http.server --directory korehan`
// serves the raw files, where a later file's `function foo` replaces an
// earlier file's everywhere — in production it does NOT replace calls made
// inside the earlier file. That difference hid a broken My Words list
// (2026-10-30). Run the QA scripts against this copy instead:
//
//   node scripts/qa/prodlike.mjs [outDir]       (default /tmp/kh-prodlike)
//   python3 -m http.server 8790 --directory /tmp/kh-prodlike
//
// It reuses the wrapper code from vite.config.js (no minify — esbuild's
// native binary isn't needed), so the scoping matches production.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const src = path.join(repo, 'korehan');
const out = path.resolve(process.argv[2] || '/tmp/kh-prodlike');

const cfg = fs.readFileSync(path.join(repo, 'vite.config.js'), 'utf8');
function grab(name) {
  const i = cfg.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('vite.config.js: ' + name + ' not found');
  let depth = 0, j = cfg.indexOf('{', i);
  for (; j < cfg.length; j++) {
    if (cfg[j] === '{') depth++;
    else if (cfg[j] === '}' && --depth === 0) break;
  }
  return cfg.slice(i, j + 1);
}
const isolate = new Function(grab('collectTopLevelDeclarations') + '\n' + grab('isolateMinifiedBundle') + '\nreturn isolateMinifiedBundle;')();

fs.rmSync(out, { recursive: true, force: true });
let n = 0;
(function walk(d) {
  for (const name of fs.readdirSync(d)) {
    const sp = path.join(d, name), dp = path.join(out, path.relative(src, sp));
    if (fs.statSync(sp).isDirectory()) { walk(sp); continue; }
    fs.mkdirSync(path.dirname(dp), { recursive: true });
    if (name.endsWith('.js')) {
      const code = fs.readFileSync(sp, 'utf8');
      fs.writeFileSync(dp, isolate(code + '\n', code)); n++;
    } else fs.copyFileSync(sp, dp);
  }
})(src);
console.log('prod-like copy:', out, '(' + n + ' scripts wrapped)');
