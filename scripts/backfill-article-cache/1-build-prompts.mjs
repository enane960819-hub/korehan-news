// Step 1: read data/articles.json, write data/prompts/{id}.txt.
// articles.json shape: [{ id, title, body, level }, ...]
//
// usage: node 1-build-prompts.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSentencePrompt } from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, 'data');
const ARTICLES = path.join(DATA, 'articles.json');
const PROMPTS = path.join(DATA, 'prompts');

if (!fs.existsSync(ARTICLES)) {
  console.error(`missing ${ARTICLES} — export articles first`);
  process.exit(1);
}
fs.mkdirSync(PROMPTS, { recursive: true });

const articles = JSON.parse(fs.readFileSync(ARTICLES, 'utf8'));
if (!Array.isArray(articles)) {
  console.error('articles.json must be an array');
  process.exit(1);
}

let n = 0;
for (const a of articles) {
  if (!a || !a.id || !a.body) {
    console.warn('skip — missing id/body:', a && a.id);
    continue;
  }
  const title = a.title || '';
  const body = a.body;
  const level = a.level || 'Intermediate';
  const prompt = buildSentencePrompt({ title, body, level });
  const meta = { id: String(a.id), title, level, body };
  const safeId = String(a.id).replace(/[^a-zA-Z0-9_-]/g, '_');
  fs.writeFileSync(path.join(PROMPTS, safeId + '.prompt.txt'), prompt);
  fs.writeFileSync(path.join(PROMPTS, safeId + '.meta.json'), JSON.stringify(meta));
  n++;
}
console.log(`wrote ${n} prompts to ${PROMPTS}`);
