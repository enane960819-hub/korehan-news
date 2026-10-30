#!/usr/bin/env node
// Study Room click-through QA (2026-10-30).
//
// Presses the buttons a learner presses and checks the RESULT of every action
// (counts, ticks, scores, what a reload shows) — "page loads, no console
// errors" is not a test. Runs against production auth + data with every write
// blocked:
//   * POST/PATCH/DELETE to /rest/v1/ are answered locally (RPCs get a fake
//     JSON body); read-only RPCs (get_*, kh_my_*, kh_user_streak …) pass.
//   * /functions/v1/* are aborted (no AI, TTS, speech or billing calls)
//     except preview-login.
//   * user_daily_progress reads return [] so the week starts fresh.
// Writing is never submitted.
//
// Usage: node scripts/qa/study-room.mjs [BASE] [mobile|desktop|both] [free|premium]
//   BASE defaults to http://localhost:8782 (python3 -m http.server 8782 --directory korehan)
// Exit code 1 when any check fails.

import pw from '/opt/node-tools/node_modules/playwright/index.js';

const BASE = (process.argv[2] || 'http://localhost:8782').replace(/\/$/, '');
const WHICH = process.argv[3] || 'both';
const SUPA_URL = 'https://samghztrdvtxmrmawneu.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWdoenRyZHZ0eG1ybWF3bmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzQ3NTIsImV4cCI6MjA4ODAxMDc1Mn0.UCt6Z76XTmJGbhHdX744tM8BKDdVhqRiCLuQi6w-rNs';
const FREE = { email: 'enane960819+khqa@gmail.com', password: 'KhQaScroll!2026x' };
const PREVIEW_TOKEN = 'hani1029';

// Phrase Munch lessons for weeks that have none in the DB (two different
// sets, so a level switch gets new lessons). Shape = study_daily_content
// .phrase_munch_lessons / grammar_examples_cache 'phmunch2::<topic>'.
const PM_SETS = [
  { lessons: [
    { example: { ko: '어릴 때 저는 의사가 되고 싶었어요.', en: 'When I was little, I wanted to become a doctor.', parts: [{ ko: '어릴 때', en: 'when (I was) little' }, { ko: '의사가', en: 'a doctor' }, { ko: '되고 싶었어요', en: 'wanted to become' }] },
      practice: { ko: '어릴 때 저는 운동선수가 되고 싶었어요.', en: 'When I was young, I wanted to become an athlete.', choices: ['어릴 때 저는 운동선수가 되고 싶었어요.', '어릴 때 저는 운동선수가 되고 싶어요.', '어릴 때 저는 운동선수를 되고 싶었어요.', '어릴 때 저는 운동선수가 되기 싶었어요.'] } },
    { example: { ko: '꿈을 이루려면 공부를 열심히 해야 돼요.', en: 'To achieve your dream, you have to study hard.', parts: [{ ko: '꿈을', en: 'dream' }, { ko: '이루려면', en: 'in order to achieve' }, { ko: '해야 돼요', en: 'have to do' }] },
      practice: { ko: '음악가가 되려면 악기를 연습해야 돼요.', en: 'To become a musician, you have to practice an instrument.', choices: ['음악가가 되려면 악기를 연습해야 돼요.', '음악가가 되려면 악기를 연습하고 싶어요.', '음악가를 되려면 악기를 연습해야 돼요.', '음악가가 되으려면 악기를 연습해야 돼요.'] } },
    { example: { ko: '언니는 노래도 하고 춤도 추고 싶어 했어요.', en: 'My older sister wanted to sing and dance too.', parts: [{ ko: '노래도 하고', en: 'sing too, and' }, { ko: '춤도 추고 싶어 했어요', en: 'wanted to dance too' }] },
      practice: { ko: '형은 그림도 그리고 책도 쓰고 싶어 했어요.', en: 'My older brother wanted to draw pictures and write books too.', choices: ['형은 그림도 그리고 책도 쓰고 싶어 했어요.', '형은 그림도 그리고 책도 쓰기 싶어 했어요.', '형은 그림도 그리고 책을도 쓰고 싶어 했어요.', '형은 그림도 그리고 책도 쓰고 싶어요.'] } }
  ] },
  { lessons: [
    { example: { ko: '저는 책도 좋아해요.', en: 'I like books too.', parts: [{ ko: '책도', en: 'books too' }, { ko: '좋아해요', en: 'like' }] },
      practice: { ko: '영화도 재미있어요.', en: 'Movies are fun too.', choices: ['영화도 재미있어요.', '영화를 재미있어요.', '영화가도 재미있어요.', '영화도를 재미있어요.'] } },
    { example: { ko: '책 읽는 것을 좋아해요.', en: 'I like reading books.', parts: [{ ko: '책 읽는 것을', en: 'reading books' }, { ko: '좋아해요', en: 'like' }] },
      practice: { ko: '음악 듣는 것을 좋아해요.', en: 'I like listening to music.', choices: ['음악 듣는 것을 좋아해요.', '음악 듣는 것이 좋아해요.', '음악 듣은 것을 좋아해요.', '음악 들는 것을 좋아해요.'] } },
    { example: { ko: '책을 많이 읽으면 똑똑해져요.', en: 'If you read many books, you become smart.', parts: [{ ko: '읽으면', en: 'if (you) read' }, { ko: '똑똑해져요', en: 'become smart' }] },
      practice: { ko: '매일 공부하면 성공할 거예요.', en: 'If you study every day, you will succeed.', choices: ['매일 공부하면 성공할 거예요.', '매일 공부하으면 성공할 거예요.', '매일 공부면 성공할 거예요.', '매일 공부하면 성공하을 거예요.'] } }
  ] }
];

// ── reporting ────────────────────────────────────────────────────
let fails = 0, passes = 0, CUR = '';
function check(name, ok, detail) {
  const line = (ok ? 'PASS ' : 'FAIL ') + CUR + name + (detail !== undefined && detail !== '' ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '');
  console.log(line);
  if (ok) passes++; else fails++;
  return ok;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function step(name, fn) {
  try { await fn(); } catch (e) {
    const msg = String(e && e.message || e).split('\n');
    const what = msg.find((l) => /waiting for|intercepts pointer/.test(l)) || '';
    check(name + ' (threw)', false, (msg[0] + ' ' + what.trim()).slice(0, 300));
  }
}

// ── browser / blocking ───────────────────────────────────────────
const READ_RPC = /\/rpc\/(kh_user_streak|get_|kh_my_|kh_is_premium|kh_has_live|kh_room_allowed)/;
const FAKE_RPC = { award_xp: { ok: true, xp: 10 } };

async function newContext(browser, mobile, state) {
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1366, height: 900 } });
  try { await ctx.grantPermissions(['microphone'], { origin: BASE }); } catch (_) {}
  await ctx.addInitScript(() => {
    try { localStorage.setItem('kh_sr_onboarded', '1'); localStorage.setItem('kh_cookie_consent', 'essential'); } catch (_) {}
    // korehan-shared.js mutes console.error in production — keep it.
    try { const e = console.error; Object.defineProperty(console, 'error', { value: e, writable: false, configurable: false }); } catch (_) {}
    // A fresh week for this test tab (once — reloads keep what the test did).
    try {
      if (!sessionStorage.getItem('qa_cleared')) {
        sessionStorage.setItem('qa_cleared', '1');
        Object.keys(localStorage).forEach((k) => { if (/^kh_sr_done_w_|^sr_daily_|^kh_bm_w_|^kh_wf_text_|^kh_daily_review_done_/.test(k)) localStorage.removeItem(k); });
      }
    } catch (_) {}
  });
  state.writes = []; state.ai = []; state.pmCalls = 0;
  await ctx.route('**/*', async (route) => {
    const req = route.request(); const u = req.url(); const m = req.method();
    if (u.includes('/functions/v1/')) {
      if (/\/functions\/v1\/preview-login/.test(u)) return route.continue();
      const fn = u.split('/functions/v1/')[1].split('?')[0];
      if (/claude-proxy|cache-write/.test(fn)) {
        let f = ''; try { f = JSON.parse(req.postData() || '{}').feature || ''; } catch (_) {}
        state.ai.push(fn + (f ? ':' + f : ''));
      }
      return route.abort();
    }
    if (u.includes('/rest/v1/') && m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') {
      if (READ_RPC.test(u)) return route.continue();
      const name = (u.match(/\/rpc\/([a-z_0-9]+)/) || [])[1];
      state.writes.push(m + ' ' + u.split('/rest/v1/')[1].split('?')[0] + (name ? '' : ' ' + (req.postData() || '').slice(0, 200)));
      if (name) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(name in FAKE_RPC ? FAKE_RPC[name] : null) });
      return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    }
    if (m === 'GET' && /\/rest\/v1\/user_daily_progress\?/.test(u)) {
      if (state.progressHook) return state.progressHook(route, u);
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (m === 'GET' && state.fakePM && /\/rest\/v1\/grammar_examples_cache\?.*pattern_name=eq\.phmunch2/.test(u)) {
      const set = PM_SETS[Math.min(state.pmCalls++, PM_SETS.length - 1)];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ patterns_json: JSON.stringify(set) }) });
    }
    if (/google-analytics|googletagmanager|clarity\.ms/.test(u)) return route.abort();
    return route.continue();
  });
  return ctx;
}

function watch(page, state) {
  state.errors = [];
  page.on('pageerror', (e) => state.errors.push('pageerror: ' + String(e && e.message || e).slice(0, 200)));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const t = msg.text();
    if (/Failed to load resource|net::ERR_FAILED|ERR_BLOCKED|Network error|Failed to fetch|tts|speech|AbortError/i.test(t)) return;
    state.errors.push('console: ' + t.slice(0, 200));
  });
  page.on('response', (r) => { if (r.status() === 400 && r.url().includes('/rest/v1/')) state.errors.push('HTTP 400 ' + r.url().split('/rest/v1/')[1].slice(0, 120)); });
  page.on('dialog', (d) => { state.errors.push('native dialog: ' + d.message().slice(0, 80)); d.dismiss().catch(() => {}); });
}

async function openStudyRoom(page, qs) {
  await page.goto(BASE + '/korehan-study-room.html' + (qs || ''), { waitUntil: 'load' });
  await page.waitForFunction(() => typeof _aiContent !== 'undefined' && _aiContent && _aiContent.vocab && _aiContent.vocab.length, null, { timeout: 40000 });
  await page.waitForFunction(() => typeof supaUser !== 'undefined' && supaUser && typeof _userPlanLoaded !== 'undefined' ? _userPlanLoaded : true, null, { timeout: 20000 }).catch(() => {});
  await sleep(1500);
}

async function signIn(page, kind) {
  await page.goto(BASE + '/korehan-study-room.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof getSupa === 'function' && getSupa());
  if (kind === 'free') {
    return page.evaluate(async (c) => {
      const r = await getSupa().auth.signInWithPassword(c);
      return r.error ? 'ERR ' + r.error.message : r.data.user.email;
    }, FREE);
  }
  const res = await fetch(SUPA_URL + '/functions/v1/preview-login', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY }, body: JSON.stringify({ token: PREVIEW_TOKEN }) });
  const j = await res.json();
  if (!j.access_token) return 'ERR preview-login ' + res.status;
  return page.evaluate(async (j) => {
    const r = await getSupa().auth.setSession({ access_token: j.access_token, refresh_token: j.refresh_token });
    try { localStorage.setItem('kh_preview', '1'); } catch (_) {}
    return r.error ? 'ERR ' + r.error.message : r.data.user.email;
  }, j);
}

// ── shared page helpers ─────────────────────────────────────────
const planLesson = (page) => page.evaluate(() => (document.querySelector('#sr-today-plan .sr-plan-step:nth-child(2) .sr-plan-s') || {}).textContent || '');
const studyDone = (page) => page.evaluate(() => Object.assign({}, _studyDone));
const upgradeShown = (page) => page.evaluate(() => {
  const m = document.getElementById('kh-upgrade-modal');
  return m && getComputedStyle(m).display !== 'none' && m.offsetHeight > 0 ? (m.innerText.split('\n')[0] || 'shown') : null;
});
const closeUpgrade = (page) => page.evaluate(() => {
  const b = [...document.querySelectorAll('#kh-upgrade-modal button')].find((x) => /Maybe later/i.test(x.textContent));
  if (b) b.click();
});
const closeAlert = (page) => page.evaluate(() => { const b = document.querySelector('.kh-modal-backdrop button'); if (b) b.click(); });
const EMOJI = /\p{Extended_Pictographic}/u;
const visibleEmoji = (page, sel) => page.evaluate(({ sel, src }) => {
  const re = new RegExp(src, 'u');
  const el = document.querySelector(sel); if (!el) return '';
  const m = (el.innerText || '').match(re); return m ? m[0] : '';
}, { sel, src: EMOJI.source });
async function noHorizontalScroll(page, label) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  check(label + ': no horizontal page scroll', r.sw <= r.w + 1, r);
}
async function openSelector(page) {
  await page.evaluate(() => openLearningSelector());
  await sleep(500);
}
async function startStep(page, key) {
  await openSelector(page);
  // Nodes orbit slowly on phones (solar mode) — a real tap still lands.
  await page.click('#ls-card-' + key, { force: true });
  await sleep(700);
}

// ── flows ────────────────────────────────────────────────────────
async function flowDictation(page, label) {
  await startStep(page, 'sentence');
  const n = await page.evaluate(() => _dctWord.cards.length);
  check('Dictation has words', n >= 3, n);
  for (let i = 0; i < n; i++) {
    const st = await page.evaluate(() => ({ ko: _dctWord.cards[_dctWord.idx].ko, keys: document.querySelectorAll('#dct-body .kh-jamo-key[data-j]').length }));
    if (i === 0) {
      await page.locator('#dct-body .kh-jamo-key[data-j]').first().click();
    } else if (st.keys) {
      const jamos = await page.evaluate((ko) => _bmWordJamos(ko), st.ko);
      for (const j of jamos) await page.locator(`#dct-body .kh-jamo-key[data-j="${j}"]`).first().click();
    } else {
      await page.fill('#dct-word-input', st.ko);
    }
    const typed = await page.inputValue('#dct-word-input');
    await page.click('#dct-foot .btn-g');
    await sleep(200);
    const fb = await page.textContent('#dct-word-fb');
    if (i === 0) check('Dictation: wrong spelling marked wrong + answer shown', /Answer/.test(fb) && fb.includes(st.ko), fb);
    else if (!check('Dictation: "' + st.ko + '" typed on the jamo keys is marked correct', /Correct/.test(fb) && typed === st.ko, { typed, fb })) break;
    await page.click('#dct-foot .btn-g').catch(() => {});   // impatient double tap on Check
    await sleep(1800);
  }
  const fin = await page.evaluate(() => document.getElementById('dct-body').innerText);
  check('Dictation: final score counts the one miss', fin.includes((n - 1) + ' / ' + n), fin.replace(/\s+/g, ' '));
  await page.click('#dct-foot .btn-g');
  await sleep(900);
  check('Dictation: Done ticks the step', (await studyDone(page)).sentence === true);
  check('Dictation: Done returns to the lesson selector', await page.evaluate(() => !document.getElementById('ls-modal').classList.contains('hidden')));
  check('Dictation: selector node ticked', await page.evaluate(() => document.getElementById('ls-card-sentence').classList.contains('ls-node-done')));
  await page.evaluate(() => closeLearningSelector());
}

async function flowKeyExpressions(page) {
  await startStep(page, 'expressions');
  await page.waitForFunction(() => window._keExpressions && window._keExpressions.length, null, { timeout: 20000 });
  const n = await page.evaluate(() => window._keExpressions.length);
  for (let i = 0; i < n; i++) {
    if (i === 1) {
      await page.locator('#ke-expressions-list button', { hasText: 'Back' }).click();
      check('Key Expr: Back goes to the previous card', await page.evaluate(() => window._keStudyIdx === 0));
      await page.locator('#ke-expressions-list button', { hasText: 'Next expression' }).click();
    }
    await page.locator('#ke-expressions-list button', { hasText: i < n - 1 ? 'Next expression' : 'Start practice' }).click();
    await sleep(200);
  }
  let asked = 0;
  for (let g = 0; g < 20 && (await page.evaluate(() => window._kePhase)) === 'fill'; g++) {
    const q = await page.evaluate(() => ({ choices: [...document.querySelectorAll('.ke-fill-choice')].map((b) => b.textContent), correct: _keStripPatternForFill(window._keExpressions[window._keFillIdx].ko) }));
    if (!q.choices.length) break;
    asked++;
    check('Key Expr fill: the answer is one of the choices', q.choices.includes(q.correct), q);
    check('Key Expr fill: choices are distinct', new Set(q.choices).size === q.choices.length, q.choices);
    await page.locator('.ke-fill-choice', { hasText: q.correct }).first().click();
    await sleep(150);
    await page.locator('#ke-fill-fb button').click();
    await sleep(150);
  }
  let sitAsked = 0, wrongFb = '';
  for (let g = 0; g < 20; g++) {
    const k = await page.evaluate(() => document.querySelectorAll('.ke-sit-btn').length);
    if (!k) break;
    const ci = await page.evaluate(() => _keSituations[window._keSitIdx].correct_index);
    const sel = sitAsked === 0 ? `.ke-sit-btn:not([data-keidx="${ci}"])` : `.ke-sit-btn[data-keidx="${ci}"]`;
    await page.locator(sel).first().click();
    await sleep(150);
    const fb = await page.evaluate(() => document.getElementById('ke-sit-fb').innerText);
    if (sitAsked === 0) wrongFb = fb;
    sitAsked++;
    await page.locator('#ke-sit-fb button').click();
    await sleep(150);
  }
  check('Key Expr: wrong-answer feedback is English (no 정답/오답)', !/[가-힣]{2}!|정답|오답/.test(wrongFb.split('answer:')[0]), wrongFb.replace(/\s+/g, ' '));
  const fin = await page.evaluate(() => document.getElementById('ke-expressions-list').innerText.replace(/\s+/g, ' '));
  const m = fin.match(/Fill in the blank (\d+)\/(\d+)/);
  check('Key Expr: fill score is out of the questions actually asked', asked === 0 ? !m : (m && Number(m[1]) === asked && Number(m[2]) === asked), { asked, fin });
  const expPct = Math.round((asked + sitAsked - 1) / (asked + sitAsked) * 100);
  check('Key Expr: overall % matches answers (one miss)', fin.includes(expPct + '%'), { expPct, fin });
  await page.locator('#ke-expressions-list button', { hasText: 'Done' }).click();
  await sleep(800);
  check('Key Expr: Done ticks the step', (await studyDone(page)).expressions === true);
  await page.evaluate(() => closeLearningSelector());
}

async function flowDailyReview(page, label) {
  await page.waitForFunction(() => typeof _srPlanDue === 'number' && _srPlanDue >= 0, null, { timeout: 30000 });
  const planDue = await page.evaluate(() => _srPlanDue);
  await page.click('#sr-today-plan .sr-plan-step:nth-child(1)');
  await page.waitForSelector('#rq .rq-opt, #rq .rq-empty h2', { timeout: 25000 });
  if (!(await page.$('#rq .rq-opt'))) {
    check('Daily review: empty state when nothing is due', planDue === 0, { planDue });
    await page.evaluate(() => khReviewQueue.close());
    return;
  }
  const first = await page.textContent('#rq .rq-cnt');
  check('Daily review: question count = plan count', first === '1 / ' + planDue, { first, planDue });
  let n = 0, firstWrong = false, sawAgain = false, doubleFit = [];
  for (let g = 0; g < 80; g++) {
    const st = await page.evaluate(() => {
      const c = document.querySelector('#rq .rq-cnt'); if (!c) return null;
      return { cnt: c.textContent, tag: document.querySelector('#rq .rq-tag').textContent, opts: [...document.querySelectorAll('#rq .rq-opt')].map((b) => b.textContent) };
    });
    if (!st) break;
    if (/Once more/.test(st.tag)) sawAgain = true;
    // two options with the same first meaning = two right answers
    const keys = st.opts.map((o) => o.toLowerCase().split(/[,;/(]/)[0].replace(/^(to|a|an|the)\s+/, '').trim());
    if (new Set(keys).size !== keys.length) doubleFit.push(st.opts.join(' / '));
    await page.locator('#rq .rq-opt').first().click();
    await sleep(120);
    const ok = await page.evaluate(() => !document.querySelector('#rq .rq-opt.bad'));
    if (g === 0 && !ok) {
      firstWrong = true;
      const total = Number(st.cnt.split('/')[1]);
      await page.locator('#rq .rq-next').click(); await sleep(120);
      const cnt2 = await page.textContent('#rq .rq-cnt').catch(() => '');
      check('Daily review: a miss comes back once (total +1)', Number(String(cnt2).split('/')[1]) === total + 1, { before: st.cnt, after: cnt2 });
      n++;
      continue;
    }
    await page.locator('#rq .rq-next').click();
    await sleep(100);
    n++;
  }
  check('Daily review: no question with two options of the same meaning', !doubleFit.length, doubleFit.slice(0, 3));
  if (firstWrong) check('Daily review: missed item shows "Once more"', sawAgain);
  const done = await page.evaluate(() => (document.getElementById('rq') || {}).innerText || '');
  check('Daily review: done screen', /Review done/.test(done), done.slice(0, 80));
  await page.locator('#rq .rq-next').last().click();
  await sleep(1500);
  const plan1 = await page.evaluate(() => document.querySelector('#sr-today-plan .sr-plan-step:nth-child(1)').innerText.replace(/\s+/g, ' '));
  check('Daily review: plan step 1 shows Done today', /Done today/.test(plan1), plan1);
}

async function flowMyWords(page) {
  await page.click('#sr-tab-btn-wordbook');
  await page.waitForFunction(() => _mw.loaded, null, { timeout: 30000 });
  await sleep(400);
  const s = await page.evaluate(() => ({
    rows: document.querySelectorAll('#wb-list .mw-row').length, total: _mw.rows.length,
    all: +document.getElementById('mw-cnt-all').textContent, due: _mw.dueCount,
    dueBtn: document.querySelector('#mw-filters [data-f="due"]').textContent
  }));
  check('My Words: Saved count = rows listed', s.all === s.total && s.rows === Math.min(s.total, 400), s);
  if (!s.total) { check('My Words: empty state', /No saved words/.test(await page.textContent('#wb-list'))); return; }
  await page.click('#mw-filters [data-f="due"]'); await sleep(150);
  const dueRows = await page.evaluate(() => document.querySelectorAll('#wb-list .mw-row').length);
  check('My Words: Due filter shows the due words', dueRows === Math.min(s.due, 400) && s.dueBtn === 'Due' + (s.due ? ' (' + s.due + ')' : ''), { dueRows, s });
  await page.click('#mw-filters [data-f="all"]');
  const w = await page.evaluate(() => _mw.rows[Math.min(2, _mw.rows.length - 1)]);
  await page.fill('#mw-search', w.ko); await sleep(150);
  const hits = await page.evaluate((ko) => [...document.querySelectorAll('#wb-list .mw-ko')].map((e) => e.textContent), w.ko);
  check('My Words: search by Korean finds the word', hits.includes(w.ko) && hits.every((h) => h.includes(w.ko)), hits.slice(0, 5));
  await page.fill('#mw-search', 'zzqqxx-no-such-word'); await sleep(150);
  check('My Words: search with no match shows an empty message', /No words here/.test(await page.textContent('#wb-list')));
  await page.fill('#mw-search', '');
  await page.click('#sr-tab-btn-study'); await sleep(300);
}

async function flowFreeGates(page) {
  await page.click('#sr-today-plan .sr-plan-step:nth-child(3)'); await sleep(700);
  check('Free: Write & get feedback opens the upgrade modal', /WRITING/i.test(await upgradeShown(page) || ''), await upgradeShown(page));
  await closeUpgrade(page); await sleep(300);
  for (const [k, re] of [['picture', /SPEAKING/i], ['topic', /WRITING/i]]) {
    await startStep(page, k);
    const u = await upgradeShown(page);
    check('Free: ' + k + ' step opens the upgrade modal', re.test(u || ''), u);
    await closeUpgrade(page); await sleep(300);
  }
  await openSelector(page);
  const sel = await page.evaluate(() => ({
    locked: [...document.querySelectorAll('.ls-node.ls-node-locked')].map((n) => n.id.replace('ls-card-', '')).sort().join(','),
    total: document.querySelector('.ls-orb-total').textContent,
    wpDisabled: document.getElementById('ls-wp-btn').disabled, wpSub: document.getElementById('ls-wp-sub').textContent
  }));
  check('Free: Premium steps are tagged in the selector', sel.locked === 'picture,topic', sel);
  check('Free: selector counts the 3 open steps', sel.total === '/ 3 done', sel);
  check('Free: Express Practice button explains Premium and is tappable', !sel.wpDisabled && /Premium/.test(sel.wpSub), sel);
  await page.click('#ls-wp-btn'); await sleep(600);
  check('Free: Express Practice opens the upgrade modal', /WRITING/i.test(await upgradeShown(page) || ''));
  await closeUpgrade(page); await sleep(300);
  await page.evaluate(() => closeLearningSelector());
}

async function flowLevelRace(browser, mobile) {
  const state = {};
  const ctx = await newContext(browser, mobile, state);
  // Sprout's DB rows say Dictation is done; they arrive late.
  state.progressHook = async (route, u) => {
    if (/level=eq\.Beginner/.test(u)) { await sleep(2500); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ study_date: '2026-10-27', level: 'Beginner', sentence_done: true }]) }); }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  };
  const page = await ctx.newPage(); watch(page, state);
  await signIn(page, 'free');
  await openStudyRoom(page);
  await sleep(2500);
  check('Level: Sprout picks up its DB progress', (await studyDone(page)).sentence === true);
  await page.click('.lv-pill.lv-s'); await sleep(150);
  await page.click('.lv-pill.lv-b'); await sleep(100);
  await page.click('.lv-pill.lv-i');
  await sleep(4500);
  const d = await studyDone(page);
  check('Level: fast Sprout→Tree switch does not copy Sprout progress into Tree', d.sentence === false, d);
  check('Level: Tree plan starts at 0', /^0\//.test(await planLesson(page)), await planLesson(page));
  await page.click('.lv-pill.lv-b'); await sleep(4000);
  check('Level: back on Sprout its progress is still there', (await studyDone(page)).sentence === true);
  await ctx.close();
}

async function flowPastTopics(page) {
  await page.click('#sr-past-row .srp-row');
  await page.waitForSelector('#srp-list .srp-wk, #srp-list .srp-empty:not(:has-text("Loading"))', { timeout: 15000 });
  const weeks = await page.locator('#srp-list .srp-wk').count();
  check('Past topics: earlier weeks listed', weeks > 0, weeks);
  if (!weeks) return;
  await page.locator('#srp-list .srp-wk').last().click();
  await page.waitForLoadState('load');
  await page.waitForFunction(() => typeof _aiContent !== 'undefined' && _aiContent && _aiContent.vocab && _aiContent.vocab.length, null, { timeout: 40000 });
  await sleep(2000);
  const pr = await page.evaluate(() => ({ wk: khPracticeWeek(), banner: !!document.getElementById('srp-banner') }));
  check('Past topics: practice mode banner', pr.wk && pr.banner, pr);
  return pr.wk;
}

async function flowPracticeDictation(page, state) {
  const before = state.writes.length;
  await startStep(page, 'sentence');
  const n = await page.evaluate(() => _dctWord.cards.length);
  for (let i = 0; i < n; i++) { await page.evaluate(() => _dctWordSkip()); await sleep(40); }
  await page.click('#dct-foot .btn-g'); await sleep(800);
  check('Practice week: Done ticks the step there', (await studyDone(page)).sentence === true);
  const synced = state.writes.slice(before).filter((w) => /user_daily_progress/.test(w));
  check('Practice week: no progress row written for today (it marked THIS week done)', !synced.length, synced);
  await page.evaluate(() => closeLearningSelector());
}

async function flowTopicYumYum(page, state) {
  await startStep(page, 'topic');
  await page.waitForFunction(() => document.querySelectorAll('.bm-listen-tts').length > 0, null, { timeout: 25000 });
  const ns = await page.evaluate(() => _bm.sentences.length);
  check('Topic Yum Yum: Build It locked until every sentence is heard', await page.evaluate(() => document.querySelector('#bm-footer .bm-btn-next').disabled));
  for (let i = 0; i < ns; i++) { await page.click('#bm-tts-' + i); await sleep(100); }
  await page.click('#bm-tts-0');   // second tap must not over-count
  check('Topic Yum Yum: listened counter', (await page.textContent('#bm-listen-prog-text')).startsWith(ns + ' / ' + ns));
  await page.click('#bm-footer .bm-btn-next'); await sleep(300);
  let right = 0;
  for (let i = 0; i < ns; i++) {
    const st = await page.evaluate(() => { const wo = _bm.wordOrders[_bm.wordOrderIdx]; return { orig: wo.original, sh: wo.shuffled, picked: wo.picked.slice() }; });
    const used = new Set(st.picked);
    const want = i === 0 ? st.orig.slice(1).reverse() : st.orig.slice(1);
    for (const w of want) {
      const k = st.sh.findIndex((x, j) => x === w && !used.has(j)); used.add(k);
      await page.evaluate((k) => { const b = [...document.querySelectorAll('#bm-body .bm-word-chip:not(.bm-word-selected)')].find((x) => (x.getAttribute('onclick') || '').endsWith(',' + k + ')')); b.click(); }, k);
    }
    await page.click('#bm-footer .bm-btn-next'); await sleep(200);
    const fbt = await page.evaluate(() => (document.querySelector('.bm-feedback') || {}).className || '');
    const shouldBeRight = !(i === 0 && st.orig.length > 2);
    if (shouldBeRight) right++;
    check('Build the Sentence ' + (i + 1) + ': ' + (shouldBeRight ? 'right order accepted' : 'wrong order rejected'), shouldBeRight ? /correct/.test(fbt) : /wrong/.test(fbt), { orig: st.orig.join(' '), fbt });
    await page.click('#bm-footer .bm-btn-next'); await sleep(200);
  }
  const order = await page.evaluate(() => _bm.score.order);
  check('Topic Yum Yum: Word Order % counts only right answers', order === Math.round(right / ns * 100), { order, right, ns });
  const blanks = await page.evaluate(() => _bm.blanks.map((b, i) => ({ i, answer: b.answer, choices: b.choices })).filter((b) => b.answer));
  let bRight = 0;
  for (const b of blanks) {
    check('Fill blank ' + (b.i + 1) + ': answer among distinct choices', b.choices.includes(b.answer) && new Set(b.choices).size === b.choices.length, b);
    const pick = b.i === blanks[0].i ? b.choices.find((c) => c !== b.answer) : b.answer;
    if (pick === b.answer) bRight++;
    await page.evaluate(({ i, pick }) => { [...document.querySelectorAll('#bm-choices' + i + ' .bm-choice-btn')].find((x) => x.textContent === pick).click(); }, { i: b.i, pick });
    await sleep(80);
  }
  const blankPct = await page.evaluate(() => _bm.score.blank);
  check('Topic Yum Yum: Fill In %', blankPct === Math.round(bRight / blanks.length * 100), { blankPct, bRight, n: blanks.length });
  await page.click('#bm-blank-next-btn'); await sleep(1200);
  for (let g = 0; g < 15; g++) {
    const st = await page.evaluate(() => ({ phase: _bm.snapPhase, ko: (_bm.snapCards[_bm.dictIdx] || {}).ko, keys: document.querySelectorAll('#bm-body .kh-jamo-key[data-j]').length, inp: !!document.getElementById('bm-dict-input') }));
    if (st.phase !== 'dictation' || !st.inp) break;
    if (st.keys) { for (const j of await page.evaluate((ko) => _bmWordJamos(ko), st.ko)) await page.locator(`#bm-body .kh-jamo-key[data-j="${j}"]`).first().click(); }
    else await page.fill('#bm-dict-input', st.ko);
    await page.evaluate(() => bmDictCheck());
    await sleep(1400);
  }
  const ko = await page.evaluate(() => (_bm.assocKo || []).map((x) => x.idx));
  for (const idx of ko) { await page.evaluate((i) => { bmAssocPickKo(i); bmAssocPickEn(i); }, idx); await sleep(350); }
  const nb = page.locator('#bm-footer .bm-btn-next');
  if (await nb.count() && /Complete|Finish|Done/i.test(await nb.first().textContent())) { await nb.first().click(); await sleep(700); }
  const res = await page.evaluate(() => document.getElementById('bm-body').innerText.replace(/\s+/g, ' '));
  check('Topic Yum Yum: result shows the Word Order %', res.includes(order + '% Word Order'), res.slice(0, 160));
  check('Topic Yum Yum: finishing ticks the step', (await studyDone(page)).topic === true);
  check('Topic Yum Yum: no live AI call (word-snap-translate)', !state.ai.some((a) => /word-snap/.test(a)), state.ai);
  await page.locator('#bm-footer .bm-btn-next').click(); await sleep(700);
  await page.evaluate(() => closeLearningSelector());
  await startStep(page, 'topic'); await sleep(800);
  check('Topic Yum Yum: reopening after finishing starts at Step 1, not mid Step 4', await page.evaluate(() => _bm.step) === 1);
  await page.evaluate(() => closeBModal());
}

async function runPhraseMunch(page, label) {
  await startStep(page, 'grammar');
  await page.waitForFunction(() => _pm.lessons && document.querySelector('#pm-body .pm-step-label'), null, { timeout: 15000 });
  const n = await page.evaluate(() => _pm.lessons.length);
  let missing = 0;
  for (let i = 0; i < n; i++) {
    if (await page.evaluate(() => _pm.phase) === 'vocab') await page.evaluate(() => _pmAdvanceFromVocab());
    await page.locator('#pm-body .pm-btn-primary', { hasText: 'Got it' }).click(); await sleep(120);
    if (await page.evaluate(() => _pm.phase) === 'assemble') {
      const st = await page.evaluate(() => ({ target: _pm.asmState.target, pool: _pm.asmState.pool, picked: _pm.asmState.picked.slice() }));
      const used = new Set(st.picked);
      for (const w of st.target.slice(1)) { const k = st.pool.findIndex((x, j) => x === w && !used.has(j)); used.add(k); await page.evaluate((k) => _pmAsmPick(k), k); }
      await page.locator('#pm-body .pm-btn-primary', { hasText: 'Check' }).click(); await sleep(120);
      check(label + ' assemble ' + (i + 1) + ': right order accepted', await page.evaluate(() => _pm.asmState.result) === 'right');
      await page.locator('#pm-body .pm-btn-primary', { hasText: 'Translate' }).click(); await sleep(120);
    }
    const q = await page.evaluate(() => ({ shown: [...document.querySelectorAll('#pm-body .pm-choice')].map((b) => b.textContent), correct: _pm.lessons[_pm.idx].practice.choices[0] }));
    if (!q.shown.includes(q.correct)) missing++;
    await page.locator('#pm-body .pm-choice', { hasText: q.shown.includes(q.correct) ? q.correct : q.shown[0] }).first().click(); await sleep(120);
    await page.locator('#pm-body .pm-btn-primary').click(); await sleep(120);
  }
  check(label + ': the right answer is on screen for every question', missing === 0, { missing });
  const res = await page.evaluate(() => document.getElementById('pm-body').innerText.replace(/\s+/g, ' '));
  check(label + ': all right → ' + n + ' / ' + n, res.includes(n + ' / ' + n), res);
  await page.locator('#pm-body .pm-btn-primary', { hasText: 'Done' }).click(); await sleep(700);
  check(label + ': Done ticks the step and returns to the selector', (await studyDone(page)).grammar === true && await page.evaluate(() => !document.getElementById('ls-modal').classList.contains('hidden')));
  await page.evaluate(() => closeLearningSelector());
}

async function flowSpeaking(page) {
  await startStep(page, 'picture');
  check('Speaking: opens for Premium', await page.evaluate(() => !document.getElementById('sp-modal').classList.contains('hidden')));
  await page.click('#sp-record-btn'); await sleep(1200);
  check('Speaking: recording state shown', /Recording/.test(await page.textContent('#sp-rec-label')));
  await page.click('#sp-record-btn');
  await page.waitForFunction(() => getComputedStyle(document.getElementById('sp-done-row')).display !== 'none', null, { timeout: 15000 }).catch(() => {});
  check('Speaking: unscored recording still lets the learner finish', await page.evaluate(() => getComputedStyle(document.getElementById('sp-done-row')).display !== 'none'));
  await page.locator('#sp-done-row button').last().click(); await sleep(700);
  check('Speaking: Done ticks the step', (await studyDone(page)).picture === true);
  await page.evaluate(() => closeLearningSelector());
}

async function flowWriting(page, state) {
  await page.evaluate(() => { _studyDone = { topic: true, grammar: true, picture: false, sentence: true, expressions: true }; saveStudyDoneState(); });
  await openSelector(page);
  check('Writing: Express Practice unlocked at 4/5', await page.evaluate(() => !document.getElementById('ls-wp-btn').disabled));
  await page.click('#ls-wp-btn'); await sleep(2500);
  const hdr = () => page.evaluate(() => (document.querySelector('#wf-inner .wf-lbl') || {}).textContent || '');
  check('Writing: step 1', /Step 1 of 4/.test(await hdr()), await hdr());
  await page.locator('#wf-inner .wf-foot .wf-btn').last().click(); await sleep(300);
  const hasFrames = await page.evaluate(() => !!(_wf.c.frames && _wf.c.frames.length));
  if (hasFrames) {
    check('Writing: step 2 frames', /Step 2 of 4/.test(await hdr()));
    const nChips = await page.locator('#wf-inner .wf-chips').count();
    for (let i = 0; i < nChips; i++) { await page.locator('#wf-inner .wf-chips').nth(i).locator('.wf-chip').first().click(); await sleep(60); }
    const filled = await page.evaluate(() => _wf.c.frames.every((_, i) => !/ |___/.test(document.getElementById('wf-fr-' + i).textContent)));
    check('Writing: every frame filled after tapping a word per slot', filled);
    await page.locator('#wf-inner .wf-foot .wf-btn').last().click(); await sleep(400);
  }
  check('Writing: step 3', /Step 3 of 4/.test(await hdr()), await hdr());
  await page.fill('#wf-ta', ''); await page.type('#wf-ta', '가'); await sleep(300);
  check('Writing: submit disabled for a 1-char answer', await page.evaluate(() => document.getElementById('wf-submit').disabled));
  await page.fill('#wf-ta', '저는 비빔밥을 좋아해요. 맛있어서 자주 먹어요. 나중에 한국에 가서 먹고 싶어요.'); await page.type('#wf-ta', ' '); await sleep(500);
  check('Writing: submit enabled for a real answer (NOT pressed)', await page.evaluate(() => !document.getElementById('wf-submit').disabled));
  await page.click('#wf-inner .wf-x'); await sleep(300);
  await page.evaluate(() => lsStartWriting()); await sleep(2000);
  await page.evaluate(() => _wfGo(3)); await sleep(300);
  check('Writing: draft kept after close + reopen', /비빔밥/.test(await page.inputValue('#wf-ta')));
  await page.click('#wf-inner .wf-x'); await sleep(300);
  check('Writing: nothing was submitted', !state.writes.some((w) => /user_submissions/.test(w)));
}

// ── runners ──────────────────────────────────────────────────────
async function runFree(browser, mobile) {
  const state = {};
  const ctx = await newContext(browser, mobile, state);
  const page = await ctx.newPage(); watch(page, state);
  check('sign in (Free QA account)', !/^ERR/.test(await signIn(page, 'free')));
  await openStudyRoom(page);
  await step('home', async () => {
    check('Home: weekly topic shown', (await page.textContent('#hero-topic-ko')).trim().length > 2);
    check('Home: Free lesson counts the 3 open steps', /^0\/3 · Phrase Munch/.test(await planLesson(page)), await planLesson(page));
    check('Home: no emoji in the Study tab', !(await visibleEmoji(page, '#sr-panel-study')), await visibleEmoji(page, '#sr-panel-study'));
    if (mobile) await noHorizontalScroll(page, 'Home');
  });
  await step('free gates', () => flowFreeGates(page));
  await step('dictation', () => flowDictation(page));
  await step('plan after dictation', async () => check('Plan: lesson 1/3 after Dictation', /^1\/3/.test(await planLesson(page)), await planLesson(page)));
  await step('key expressions', () => flowKeyExpressions(page));
  await step('reload keeps progress', async () => {
    await openStudyRoom(page);
    const d = await studyDone(page);
    check('Reload: Dictation + Key Expressions still ticked', d.sentence && d.expressions, d);
    check('Reload: plan 2/3', /^2\/3/.test(await planLesson(page)), await planLesson(page));
  });
  await step('daily review', () => flowDailyReview(page));
  await step('my words', () => flowMyWords(page));
  await step('past topics', async () => { if (await flowPastTopics(page)) await flowPracticeDictation(page, state); });
  check('Free: no AI calls', !state.ai.length, state.ai);
  check('Free: no console errors / 400s', !state.errors.length, state.errors.slice(0, 5));
  await ctx.close();
  await step('level race', () => flowLevelRace(browser, mobile));
}

async function runPremium(browser, mobile) {
  const state = { fakePM: true };
  const ctx = await newContext(browser, mobile, state);
  state.fakePM = true;
  const page = await ctx.newPage(); watch(page, state);
  check('sign in (Premium preview account)', !/^ERR/.test(await signIn(page, 'premium')));
  await openStudyRoom(page);
  await step('home', async () => {
    check('Premium: lesson counts 5 steps', /^0\/5/.test(await planLesson(page)), await planLesson(page));
    await openSelector(page);
    check('Premium: no step tagged Premium', await page.evaluate(() => !document.querySelector('.ls-node.ls-node-locked')));
    await page.evaluate(() => closeLearningSelector());
  });
  await step('topic yum yum', () => flowTopicYumYum(page, state));
  await step('phrase munch', () => runPhraseMunch(page, 'Phrase Munch'));
  await step('speaking', () => flowSpeaking(page));
  await step('level switch content', async () => {
    const sprout = await page.evaluate(() => _bm.sentences.map((s) => s.ko));
    await page.click('.lv-pill.lv-i'); await sleep(5000);
    await startStep(page, 'picture');
    const sp = await page.evaluate(() => _spSentences.map((s) => s.ko));
    const spText = sp.join(' ');
    check('Level switch: Speaking uses the new level\'s sentences', sp.length && !sprout.some((s) => spText.includes(s)), sp.slice(0, 2));
    await page.evaluate(() => closeSpeakingPractice());
    await runPhraseMunch(page, 'Phrase Munch after level switch');
    await page.click('.lv-pill.lv-b'); await sleep(4000);
  });
  await step('writing', () => flowWriting(page, state));
  check('Premium: no AI calls', !state.ai.length, state.ai);
  check('Premium: no console errors / 400s', !state.errors.length, state.errors.slice(0, 5));
  await ctx.close();
}

const browser = await pw.chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const views = WHICH === 'both' ? [true, false] : [WHICH === 'mobile'];
const ONLY = process.argv[4] || '';   // optional: free | premium
for (const mobile of views) {
  CUR = '[' + (mobile ? '390 ' : '1366 ') + 'free] ';
  if (ONLY !== 'premium') await step('free run', () => runFree(browser, mobile));
  CUR = '[' + (mobile ? '390 ' : '1366 ') + 'premium] ';
  if (ONLY !== 'free') await step('premium run', () => runPremium(browser, mobile));
}
await browser.close();
CUR = '';
console.log('\n' + passes + ' passed, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
