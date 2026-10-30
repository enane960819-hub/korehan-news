// Click-through QA: Playground hub + every korehan-fun-*.html game played to the end.
//   node scripts/qa/games.mjs [BASE_URL]
import * as Q from './lib.mjs';
const { check } = Q;

const browser = await Q.launch();
const free = await Q.freeState(browser);
const ctx = await Q.newCtx(browser, { mobile: true, storageState: free });
const page = await ctx.newPage();
Q.watch(page, '[games]');
const ended = (sel) => page.evaluate((s) => { const e = document.getElementById(s); return !!e && getComputedStyle(e).display !== 'none'; }, sel);
const src = async () => (await (await page.request.get(page.url())).text());

// Hub
await Q.go(page, 'korehan-fun.html', { wait: 2500 });
const games = await page.$$eval('a[href^="korehan-fun-"]', (as) => Array.from(new Set(as.map((a) => a.getAttribute('href')))));
check(games.length === 8, 'hub: links to 8 games', games);
for (const g of games) { const r = await page.request.get(Q.BASE + '/' + g); check(r.status() === 200, 'hub: ' + g + ' exists'); }
Q.reportErrs(page, 'hub');

// Chosung — right, wrong, empty submit, timeout, double Enter, to the end
await Q.go(page, 'korehan-fun-chosung.html');
let dict = {}; for (const m of (await src()).matchAll(/\{ko:'([^']+)',en:'([^']+)'\}/g)) dict[m[2]] = m[1];
await page.click('.start-btn'); await page.waitForTimeout(400);
let expScore = 0, streak = 0;
for (let i = 0; i < 25 && !(await ended('end-screen') && await page.evaluate(() => document.getElementById('end-screen').style.display === 'flex')); i++) {
  const hint = await page.evaluate(() => (document.querySelector('#hint-text em') || {}).textContent);
  const q = await page.evaluate(() => document.getElementById('g-qnum').textContent);
  if (i === 3) { await page.click('button:text-is("Submit")'); await page.waitForTimeout(150); check(await page.evaluate(() => document.getElementById('g-qnum').textContent) === q, 'chosung: empty Submit is ignored'); }
  const wrong = i % 5 === 1;
  await page.fill('#g-input', wrong ? '틀림' : dict[hint]);
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await page.waitForTimeout(wrong ? 2300 : 1000);
}
const ce = await page.evaluate(() => document.getElementById('end-stats').textContent);
check(/16\/20 correct/.test(ce), 'chosung: 20 questions, 4 wrong -> 16/20 (double Enter scores once)', ce);
await page.click('.restart-btn'); await page.waitForTimeout(300);
check(await page.evaluate(() => document.getElementById('g-qnum').textContent === '1' && document.getElementById('g-score').textContent === '0'), 'chosung: Play again resets');
Q.reportErrs(page, 'chosung');

// Dictation — right, close, wrong, empty Check, skip
await Q.go(page, 'korehan-fun-dictation.html');
await page.click('button:has-text("Easy")'); await page.click('button:text-is("START")'); await page.waitForTimeout(600);
for (let i = 0; i < 8; i++) {
  const ph = await page.evaluate(() => window._state && window._state.items[window._state.idx]);
  if (!ph) break;
  if (i === 3) {
    const sc = await page.evaluate(() => document.getElementById('gs-score').textContent);
    await page.fill('#gs-input', ''); await page.click('#gs-check'); await page.waitForTimeout(300);
    check(await page.evaluate(() => !document.getElementById('gs-input').disabled && document.getElementById('gs-fb-host').innerText === '') && sc === await page.evaluate(() => document.getElementById('gs-score').textContent), 'dictation: empty Check costs nothing and keeps the question');
    await page.click('button:has-text("Skip")'); await page.click('button:has-text("Skip")').catch(() => {}); await page.waitForTimeout(1800);
    continue;
  }
  await page.fill('#gs-input', i === 1 ? ph.slice(0, -1) : i === 2 ? '아니요' : ph);
  await page.click('#gs-check'); await page.waitForTimeout(250);
  const fb = await page.evaluate(() => document.getElementById('gs-fb-host').innerText);
  if (i === 0) { const m = fb.match(/\+(\d+)/); check(m && +m[1] <= 160, 'dictation: right answer = 100 + speed bonus (max 60)', fb); }
  if (i === 1) check(/Close/.test(fb), 'dictation: one syllable missing counts as Close');
  if (i === 2) check(/Not quite/.test(fb) && /Answer:/.test(fb), 'dictation: wrong shows the answer');
  await page.waitForTimeout(2300);
}
await page.waitForTimeout(1500);
check(await page.evaluate(() => document.getElementById('end').style.display !== 'none'), 'dictation: round reaches the end screen');
check(/5 \/ 8 correct/.test(await page.evaluate(() => document.getElementById('end').innerText)), 'dictation: end screen counts 5/8 (skip counted once)');
Q.reportErrs(page, 'dictation');

// Sentence order — right, wrong, skip, remove a chip
await Q.go(page, 'korehan-fun-sentence-order.html');
await page.click('button:has-text("Easy")'); await page.click('button:text-is("START")'); await page.waitForTimeout(400);
for (let q = 0; q < 5; q++) {
  const t = await page.evaluate(() => window._state.items[window._state.idx][0]); const w = t.split(' ');
  if (q === 2) { await page.click('button:has-text("Skip")'); await page.waitForTimeout(200); await page.dblclick('.gs-next'); await page.waitForTimeout(300); continue; }
  const order = q === 1 ? w.slice().reverse() : w;
  for (const x of order) await page.click('#gs-pool .gs-chip >> text="' + x + '"');
  if (q === 3) { await page.click('#gs-tray .gs-chip >> nth=0'); await page.click('#gs-pool .gs-chip >> text="' + w[0] + '"'); }
  await page.click('#gs-check'); await page.waitForTimeout(250);
  const fb = await page.evaluate(() => document.getElementById('gs-fb-host').innerText);
  if (q === 0) { const m = fb.match(/\+(\d+)/); check(/Correct/.test(fb) && m && +m[1] <= 160, 'sentence order: correct order scores 100 + bonus (max 60)', fb); }
  if (q === 1 && w.length > 1) check(/Not quite/.test(fb), 'sentence order: reversed order is wrong');
  if (q === 3) check(/Not quite/.test(fb), 'sentence order: chip removed and re-added at the end is judged on the new order');
  if (await page.$('.gs-next')) await page.click('.gs-next'); else await page.waitForTimeout(1000);
  await page.waitForTimeout(300);
}
await page.waitForTimeout(800);
check(/\/ 5 correct/.test(await page.evaluate(() => document.getElementById('end').innerText)), 'sentence order: 5 questions then the end screen (double Next did not skip)');
Q.reportErrs(page, 'sentence order');

// Memory — memorize lock, mismatch, all pairs, save words, no two identical cards
await Q.go(page, 'korehan-fun-memory.html', { wait: 2500 });
for (const diff of ['Easy', 'Hard']) {
  await page.click('text=' + diff + ' — '); await page.waitForTimeout(400);
  await page.click('text=Play Now'); await page.waitForTimeout(400);
  const backs = await page.$$eval('.mm-card', (cs) => cs.map((c) => c.dataset.type + ':' + c.querySelector('.mm-card-back').textContent.toLowerCase()));
  check(new Set(backs).size === backs.length, 'memory ' + diff + ': no two cards show the same text', backs.filter((b, i) => backs.indexOf(b) !== i));
  await page.click('.mm-card >> nth=0'); check(await page.evaluate(() => document.getElementById('mm-flips').textContent) === '0', 'memory ' + diff + ': taps during the memorize countdown are ignored');
  await page.waitForTimeout(5600);
  const ids = await page.$$eval('.mm-card', (cs) => cs.map((c) => c.dataset.pairId));
  const b0 = ids.findIndex((x) => x !== ids[0]);
  await page.click('.mm-card >> nth=0'); await page.click('.mm-card >> nth=' + b0); await page.waitForTimeout(1000);
  check(await page.locator('.mm-card.flipped').count() === 0, 'memory ' + diff + ': a mismatch flips both cards back');
  const done = new Set();
  for (let i = 0; i < ids.length; i++) { if (done.has(i)) continue; const j = ids.findIndex((x, k) => k !== i && x === ids[i]); await page.click('.mm-card >> nth=' + i); await page.click('.mm-card >> nth=' + j); done.add(i); done.add(j); await page.waitForTimeout(150); }
  await page.waitForTimeout(1200);
  check(await page.evaluate(() => document.getElementById('mm-end-pairs').textContent) === String(ids.length / 2), 'memory ' + diff + ': all pairs matched -> end screen');
  await page.click('#mm-sel-all-btn'); await page.click('#mm-save-btn'); await page.waitForTimeout(1500);
  check(/Saved \d+ words/.test(await page.evaluate(() => document.getElementById('mm-save-note').textContent)), 'memory ' + diff + ': Save selected words confirms');
  await page.click('text=PLAY AGAIN'); await page.waitForTimeout(800);
}
Q.reportErrs(page, 'memory');

// OX — always O until lives run out
await Q.go(page, 'korehan-fun-ox.html');
await page.click('text=START'); await page.waitForTimeout(400);
let answered = 0;
for (let i = 0; i < 70 && await page.evaluate(() => document.getElementById('end-screen').style.display !== 'flex'); i++) {
  await page.click('#btn-o'); await page.click('#btn-x').catch(() => {}); answered++; await page.waitForTimeout(2350);
}
const ox = await page.evaluate(() => document.getElementById('end-stats').textContent);
check(new RegExp('/' + answered + ' correct').test(ox), 'ox: every question counted once even with O then X tapped', { ox, answered });
Q.reportErrs(page, 'ox');

// Hangul Tetris — keyboard play until lives run out (or 90 s)
await Q.go(page, 'korehan-fun-hangul-tetris.html');
await page.click('text=START'); await page.waitForTimeout(500);
const t0 = Date.now();
while (Date.now() - t0 < 90000 && await page.evaluate(() => document.getElementById('end-screen').style.display !== 'flex')) { await page.keyboard.press(Math.random() < 0.5 ? 'ArrowLeft' : 'ArrowRight'); await page.waitForTimeout(250); }
check(await page.evaluate(() => document.getElementById('end-screen').style.display === 'flex'), 'tetris: wrong catches cost lives and the game ends');
Q.reportErrs(page, 'tetris');

// Word Drop — slow, built-in words answered, misses cost lives
await Q.go(page, 'korehan-fun-worddrop.html');
dict = {}; for (const m of (await src()).matchAll(/\{ko:'([^']+)',en:'([^']+)'\}/g)) dict[m[1]] = m[2];
await page.click('text=Slow'); await page.click('text=START GAME'); await page.waitForTimeout(400);
let hit = 0; const t1 = Date.now();
while (Date.now() - t1 < 150000 && await page.evaluate(() => document.getElementById('end-screen').style.display !== 'flex')) {
  const pills = await page.$$eval('.word-pill:not(.correct):not(.missed)', (es) => es.map((e) => e.textContent));
  const k = pills.find((p) => dict[p]);
  if (k && hit < 3) { const s0 = await page.evaluate(() => document.getElementById('g-score').textContent); await page.fill('#g-input', dict[k].split(/[;,/]/)[0].trim()); await page.keyboard.press('Enter'); await page.waitForTimeout(150); if (s0 !== await page.evaluate(() => document.getElementById('g-score').textContent)) hit++; }
  await page.waitForTimeout(400);
}
check(await page.evaluate(() => document.getElementById('end-screen').style.display === 'flex'), 'word drop: missed words cost lives and the game ends');
Q.reportErrs(page, 'word drop');

// Name generator
await Q.go(page, 'korehan-fun-name.html');
check(await page.locator('#ng-next-1').isDisabled(), 'name: Next is disabled until the profile is filled');
await page.fill('#ng-first', 'Emma'); await page.fill('#ng-last', 'Watson'); await page.fill('#ng-birth', '1998-05-04'); await page.click('[data-gender="female"]');
await page.click('#ng-next-1'); await page.waitForTimeout(300);
const nq = await page.evaluate(() => new Set(Array.from(document.querySelectorAll('.ng-quiz-option')).map((b) => b.dataset.q)).size);
for (let i = 0; i < nq; i++) await page.click('.ng-quiz-option[data-q="' + i + '"] >> nth=0');
await page.click('#ng-next-2'); await page.waitForTimeout(2800);
check(/[가-힣]/.test(await page.evaluate(() => document.querySelector('.ng-final-hangul').textContent)), 'name: reveals a Korean name');
Q.reportErrs(page, 'name');

await browser.close();
Q.summary();
