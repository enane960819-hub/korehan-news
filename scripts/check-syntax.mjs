#!/usr/bin/env node
// Pre-deploy syntax guard.
//
// Validates:
//   1) every *.js under korehan/ (parsed with node --check via vm)
//   2) every inline <script> block in korehan/*.html that isn't tagged
//      type="application/json" or type="module-no-check" etc.
//
// Exits non-zero on the first syntax error. The owner pushed an
// English-ified shared.js that put a contraction apostrophe inside a
// single-quoted string and that broke the entire main page. CI now
// catches that class of bug before merge.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const SCAN_DIRS = ['korehan'];
const errors = [];

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      walk(p, out);
    } else {
      out.push(p);
    }
  }
}

function checkJsSource(src, label) {
  try {
    // new vm.Script just parses, no execution. Catches every syntax
    // error node --check would. We don't run the code.
    new vm.Script(src, { filename: label });
    return null;
  } catch (e) {
    return e;
  }
}

const files = [];
for (const d of SCAN_DIRS) {
  try { walk(join(ROOT, d), files); } catch (_) {}
}

let checked = 0;

for (const f of files) {
  const ext = extname(f);
  if (ext === '.js') {
    const src = readFileSync(f, 'utf8');
    const err = checkJsSource(src, relative(ROOT, f));
    checked++;
    if (err) errors.push({ file: relative(ROOT, f), msg: err.message });
    continue;
  }
  if (ext !== '.html') continue;
  const html = readFileSync(f, 'utf8');
  // Extract inline <script>...</script> blocks. Skip ones with src=
  // (external — node can't see them) and JSON-typed blocks. Track
  // line offsets so error messages point at the right line in the
  // source HTML, not at a synthetic line number.
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  let blockIdx = 0;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || '';
    const body  = m[2] || '';
    if (/\bsrc\s*=/.test(attrs)) continue;
    // Only check executable JS blocks
    const typeMatch = attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i);
    if (typeMatch) {
      const t = typeMatch[1].toLowerCase();
      if (t !== 'text/javascript' && t !== 'application/javascript' && t !== 'module') continue;
    }
    // Line offset for error reporting
    const lineOffset = html.slice(0, m.index).split('\n').length;
    blockIdx++;
    const label = `${relative(ROOT, f)} [inline block #${blockIdx} @ line ${lineOffset}]`;
    const err = checkJsSource(body, label);
    checked++;
    if (err) errors.push({ file: label, msg: err.message });
  }
}

if (errors.length) {
  console.error(`\n✗ Syntax check failed (${errors.length} error${errors.length>1?'s':''}, ${checked} blocks checked):\n`);
  for (const e of errors) {
    console.error(`  ${e.file}`);
    console.error(`    ${e.msg}`);
    console.error('');
  }
  process.exit(1);
}

console.log(`✓ Syntax check passed (${checked} blocks)`);
