// Deterministic helpers ported (not forked) from korehan-x9f4k2m7.html
// and js/core/kh-grammar-patterns.js. Used by both prompt-building and
// SQL-building steps so the offline pipeline matches what the admin
// page would have written.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// KH_GRAMMAR: load the production regex catalog as-is. The file is an
// IIFE that writes to window.KH_GRAMMAR. Stub window, eval, read back.
const grammarSrc = fs.readFileSync(
  path.join(REPO_ROOT, 'korehan', 'js', 'core', 'kh-grammar-patterns.js'),
  'utf8'
);
globalThis.window = {};
// eslint-disable-next-line no-eval
eval(grammarSrc);
export const KH_GRAMMAR = globalThis.window.KH_GRAMMAR;

// Sentence splitter — verbatim port of _khSplitSentencesForCache.
// SOH () is used as a transient marker since it cannot appear in
// Korean text.
const SENT_MARKER = String.fromCharCode(1);
export function splitSentences(body) {
  if (!body) return [];
  const paragraphs = String(body).split(/\n\n+/);
  const out = [];
  paragraphs.forEach((para) => {
    const pieces = para.split(/\n+/);
    pieces.forEach((piece) => {
      const trimmed = piece.trim();
      if (!trimmed) return;
      const marked = trimmed.replace(/([.!?。])\s+/g, '$1' + SENT_MARKER);
      marked.split(SENT_MARKER).forEach((s) => {
        const st = s.trim();
        if (st) out.push(st);
      });
    });
  });
  return out;
}

// Vocab/Grammar tab derive — verbatim port of
// _khDeriveVocabGrammarFromSentences.
function canonGrammarKey(label) {
  if (!label) return '';
  let s = String(label).trim();
  s = s.replace(/\s*\([^)]*[a-zA-Z][^)]*\)\s*$/, '').trim();
  s = s.replace(/\(서\)$/, '').replace(/서$/, '').trim();
  s = s.replace(/\s+/g, ' ').toLowerCase();
  return s;
}

export function deriveVocabGrammar(sentFinal, level) {
  const vocabSeen = {};
  const aggVocab = [];
  const grammarByKey = {};
  const aggGrammar = [];
  (sentFinal || []).forEach((s) => {
    if (s && Array.isArray(s.vocab)) {
      s.vocab.forEach((v) => {
        if (!v) return;
        const ko = (v.ko || '').trim();
        if (!ko || vocabSeen[ko]) return;
        vocabSeen[ko] = true;
        aggVocab.push({ ko, en: (v.en || '').trim(), note: (v.note || '').trim() });
      });
    }
    const grammarItems = [];
    if (s && Array.isArray(s.analysis) && s.analysis.length) {
      s.analysis.forEach((a) => {
        if (!a) return;
        const typ = a.type || 'grammar';
        if (typ !== 'grammar') return;
        const nm = (a.label || a.pattern || '').trim();
        if (!nm) return;
        grammarItems.push({ name: nm, exp: (a.exp || '').trim() });
      });
    }
    grammarItems.forEach((g) => {
      const key = canonGrammarKey(g.name);
      if (!key) return;
      if (grammarByKey[key]) {
        const prev = grammarByKey[key];
        if (g.name.length > prev.name.length) prev.name = g.name;
        if (g.exp && g.exp.length > (prev.exp || '').length) prev.exp = g.exp;
        return;
      }
      const entry = {
        name: g.name,
        level: level || 'Intermediate',
        exp: g.exp,
        ex_ko: (s.text || '').trim(),
        ex_en: (s.translation || '').trim(),
      };
      grammarByKey[key] = entry;
      aggGrammar.push(entry);
    });
  });
  return {
    vocab: aggVocab.slice(0, 100),
    grammar: { patterns: aggGrammar.slice(0, 15) },
  };
}

// Per-sentence prompt builder — mirrors backfillOneSentenceAnalysis in
// korehan-x9f4k2m7.html (line 6337). Same level-conditional vocab rule,
// same MUST-INCLUDE pattern list, same JSON schema.
export function buildSentencePrompt({ title, body, level }) {
  const sents = splitSentences(body);
  const sentBlocks = sents.map((s, i) => {
    const hits = KH_GRAMMAR.detectForLevel(s, level);
    const listText = hits.length
      ? '\n  MUST-INCLUDE detected patterns (one analysis entry per item, do NOT skip, do NOT merge):\n' +
        KH_GRAMMAR.formatPromptList(hits)
      : '';
    return `문장 ${i + 1}: ${s}${listText}`;
  }).join('\n\n');

  const isBasic = level === 'Starter' || level === 'Beginner';
  const vocabRule = isBasic
    ? '입문/초급 동사·형용사 포함 OK. 조사와 단독 이다/있다만 제외.'
    : '입문 단어(는/이/가/이다/있다/하다/되다)는 스킵.';

  return (
    '당신은 외국인 한국어 학습자를 위한 Korean 튜터입니다.\n' +
    '아래 기사의 모든 문장에 번역/단어/분석을 달아주세요.\n\n' +
    `[기사 정보] 제목: ${title} / 난이도: ${level}\n\n` +
    `[본문 (참고용)]\n${body}\n\n` +
    '[문장별 입력 — 각 문장의 detected pattern을 모두 explain]\n' +
    sentBlocks + '\n\n' +
    '[출력 규칙]\n' +
    '- sentences[]: 위 문장 순서대로, 각 문장당 1개 객체.\n' +
    '- text: 위 입력의 한국어 문장 그대로 (마침표 포함).\n' +
    '- translation: 자연스러운 영어 번역. 한국어가 주어 생략하면 문맥의 주어를 채워서 he/she/it/the dog 등으로. "I/we" 함부로 안 넣음.\n' +
    `- vocab: max 4 dictionary forms (보다, 흔하다, 키우다 등 — 단음절 어간 X). ${vocabRule} 빈 배열 OK. note는 1줄 또는 빈 문자열.\n` +
    '- analysis:\n' +
    '    1. detected patterns 위에 listed된 항목 EVERY ONE 출력 (type=grammar). label은 list의 텍스트를 **한 글자도 바꾸지 말고 그대로 복사** (예: "~는 (present verb modifier)" 그대로. 절대 "~는 개" 같이 명사를 붙이지 말 것). exp = 1줄 영어, **반드시 사전형 → 활용형 변형을 보여주기** (예: "negation. 보이다 → 보이지 않다 → 보이지 않았어요").\n' +
    '    2. 추가로 idiom (사자성어/관용구) / expression (~에도 불구하고, ~을 통해 같은 굳어진 표현) 발견하면 entry 더 추가 (type=idiom 또는 expression).\n' +
    '    3. example_in_sentence: 해당 패턴이 사용된 문장 내 chunk.\n' +
    '    4. 본문에 없는 패턴 절대 추가 X — detected list에 없는 grammar 항목 만들지 말 것 (idiom/expression은 OK).\n\n' +
    '[출력 — JSON ONLY]\n' +
    '{\n' +
    '  "sentences": [\n' +
    '    { "text": "...", "translation": "...", "vocab": [{"ko","en","note"}], "analysis": [{"type","label","exp","example_in_sentence"}] }\n' +
    '  ]\n' +
    '}'
  );
}

// Post-processing — shape sentences, enforce, derive, build cache row.
export function buildCacheRow({ articleId, body, level, aiSentences }) {
  const sentList = splitSentences(body);
  const sentFinal = sentList.map((text, i) => {
    let match = null;
    for (let k = 0; k < aiSentences.length; k++) {
      const t = (aiSentences[k] && aiSentences[k].text || '').trim();
      if (t && (t === text || text.indexOf(t) >= 0 || t.indexOf(text) >= 0)) {
        match = aiSentences[k]; break;
      }
    }
    if (!match) match = aiSentences[i] || {};
    let analysis = [];
    if (Array.isArray(match.analysis)) {
      analysis = match.analysis.slice(0, 8)
        .filter((x) => x && (x.label || x.pattern))
        .map((x) => ({
          type: x.type || 'grammar',
          label: x.label || x.pattern || '',
          exp: x.exp || '',
          example_in_sentence: x.example_in_sentence || '',
        }));
    } else if (Array.isArray(match.grammar)) {
      analysis = match.grammar.slice(0, 8)
        .filter((g) => g && (g.pattern || g.label))
        .map((g) => ({
          type: 'grammar',
          label: g.pattern || g.label || '',
          exp: g.exp || '',
          example_in_sentence: g.example_in_sentence || '',
        }));
    }
    return {
      text,
      translation: typeof match.translation === 'string' ? match.translation : '',
      vocab: Array.isArray(match.vocab) ? match.vocab.slice(0, 4).filter((v) => v && v.ko) : [],
      analysis,
    };
  });

  KH_GRAMMAR.enforceDetectedPatterns(sentFinal, level);

  const paraTexts = String(body || '').split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const bySent = {};
  sentFinal.forEach((s) => { if (s.text) bySent[s.text.trim()] = s.translation || ''; });
  const paraTrans = paraTexts.map((p) => {
    const pieces = [];
    Object.keys(bySent).forEach((t) => { if (p.indexOf(t) !== -1) pieces.push(bySent[t]); });
    return pieces.filter(Boolean).join(' ');
  });

  const SENT_CACHE_CURRENT = 's5';
  const translation = JSON.stringify({ texts: paraTrans, sentences: sentFinal, version: SENT_CACHE_CURRENT });

  const derived = deriveVocabGrammar(sentFinal, level);
  const vocab = derived.vocab.length ? JSON.stringify(derived.vocab) : null;
  const grammar = derived.grammar.patterns.length ? JSON.stringify(derived.grammar) : null;

  return {
    article_id: String(articleId),
    translation,
    vocab,
    grammar,
  };
}

// PostgreSQL E'...' literal — handles UTF-8 Korean fine.
export function sqlEscape(s) {
  if (s == null) return 'NULL';
  return "E'" + String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t') + "'";
}
