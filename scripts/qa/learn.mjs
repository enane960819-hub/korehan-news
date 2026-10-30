// Click-through QA: Word Bank (korehan-learn.html) and TOPIK practice.
//   node scripts/qa/learn.mjs [BASE_URL]
import * as Q from './lib.mjs';
const { check, info } = Q;

const browser = await Q.launch();
const free = await Q.freeState(browser);

for (const mobile of [true, false]) {
  const tag = mobile ? '[390]' : '[1366]';
  const ctx = await Q.newCtx(browser, { mobile, storageState: free });
  const page = await ctx.newPage();
  Q.watch(page, tag);

  // ── Word Bank ───────────────────────────────────────────────
  await Q.go(page, 'korehan-learn.html?tab=words&level=Beginner', { wait: 3000 });
  const rows = () => page.locator('#wb-list .wb-w').count();
  check(await rows() > 0, tag + ' word bank: list loads');
  const firstOf = () => page.evaluate(() => (document.querySelector('#wb-list .wb-w .ko') || {}).textContent);
  const lvls = await page.$$eval('[data-lv]', (bs) => bs.map((b) => b.dataset.lv));
  const seen = new Set();
  for (const l of lvls) { await page.click('[data-lv="' + l + '"]'); await page.waitForTimeout(1500); seen.add(await firstOf()); check(await page.locator('[data-lv="' + l + '"].on').count() === 1 && await rows() > 0, tag + ' word bank: level ' + l + ' selected and listed'); }
  check(seen.size === lvls.length, tag + ' word bank: each level shows different words', [...seen]);
  await page.click('[data-lv="Beginner"]'); await page.waitForTimeout(1500);
  const tag1 = (await page.$$eval('[data-tag]', (bs) => bs.map((b) => b.dataset.tag)))[2];
  await page.click('[data-tag="' + tag1 + '"]'); await page.waitForTimeout(1500);
  const tags = await page.$$eval('#wb-list .wb-w small', (ss) => ss.map((s) => s.textContent.toLowerCase()));
  check(tags.length && tags.every((t) => t.includes(tag1)), tag + ' word bank: topic chip filters the list (' + tag1 + ')');
  await page.click('[data-tag="all"]'); await page.waitForTimeout(1500);
  const n0 = await rows(); await page.click('#wb-more'); await page.waitForTimeout(2000);
  check(await rows() > n0, tag + ' word bank: Show more adds words', [n0, await rows()]);
  const si = await page.evaluate(() => Array.from(document.querySelectorAll('[data-save]')).findIndex((b) => !b.classList.contains('sv')));
  await page.click('[data-save="' + si + '"]'); await page.waitForTimeout(500);
  check(await page.evaluate((i) => { const b = document.querySelector('[data-save="' + i + '"]'); return b.classList.contains('sv') && b.getAttribute('aria-label') === 'Saved'; }, si), tag + ' word bank: + saves the word (button shows Saved)');
  // Drills — every type to the end, with a double tap on Next.
  const qk = () => page.evaluate(() => (document.querySelector('.wb-qk span:last-child') || {}).textContent);
  for (const kind of ['cards', 'meaning', 'listen']) {
    await page.evaluate((k) => window.khWordBank.drill(k), kind); await page.waitForTimeout(3000);
    let steps = 0, skipped = false, changed = false;
    while (steps++ < 14 && await page.$('.wb-qk')) {
      const before = await qk();
      if (kind === 'cards') { await page.click('#wb-card'); await page.waitForTimeout(150); }
      else {
        await page.waitForTimeout(450);
        await page.click('.wb-opt >> nth=' + (steps % 4)); await page.waitForTimeout(200);
        const s1 = await page.$$eval('.wb-opt', (bs) => bs.map((b) => b.className).join());
        await page.click('.wb-opt >> nth=' + ((steps + 1) % 4)); await page.waitForTimeout(150);
        if (s1 !== await page.$$eval('.wb-opt', (bs) => bs.map((b) => b.className).join())) changed = true;
        const opts = await page.$$eval('.wb-opt', (bs) => bs.map((b) => b.textContent));
        if (new Set(opts).size !== opts.length) Q.fail(tag + ' ' + kind + ': duplicate options ' + JSON.stringify(opts));
      }
      await page.waitForTimeout(450);
      await page.dblclick('#wb-next'); await page.waitForTimeout(500);
      const after = await qk();
      if (after && before && (+after.split('/')[0] - +before.split('/')[0]) > 1) skipped = true;
      if (kind !== 'cards' && after && await page.locator('.wb-opt.ok').count()) skipped = true;   // second tap answered the next question
    }
    check(!skipped, tag + ' word bank ' + kind + ': double tap on Next moves one step and never answers blind');
    if (kind !== 'cards') check(!changed, tag + ' word bank ' + kind + ': a second answer tap is ignored');
    const done = await page.evaluate(() => (document.querySelector('.wb-done') || {}).innerText || '');
    check(kind === 'cards' ? /Set done/.test(done) : /\d+ \/ 10/.test(done), tag + ' word bank ' + kind + ': drill reaches the result screen', done.slice(0, 40));
    await page.click('#wb-again'); await page.waitForTimeout(2500);
    check(/1 \/ 10/.test(await qk() || ''), tag + ' word bank ' + kind + ': Another set restarts at 1/10');
    await page.click('.wb-x'); await page.waitForTimeout(400);
    check(!(await page.$('#wb-ov')) && !(await page.evaluate(() => document.body.classList.contains('wb-locked'))), tag + ' word bank ' + kind + ': close removes the overlay and unlocks scroll');
  }
  await page.click('.wb-tabs [data-tab="hangul"]'); await page.waitForTimeout(500);
  await page.evaluate(() => window.khWordBank.hangulQuiz()); await page.waitForTimeout(500);
  let overlap = [];
  for (let i = 0; i < 10 && await page.$('.wb-opt'); i++) {
    await page.waitForTimeout(450);
    const opts = await page.$$eval('.wb-opt', (bs) => bs.map((b) => b.textContent));
    await page.click('.wb-opt >> nth=0'); await page.waitForTimeout(300);
    const ans = await page.$$eval('.wb-opt', (bs) => bs.findIndex((b) => b.classList.contains('ok')));
    const at = opts[ans].split('/');
    if (opts.some((o, k) => k !== ans && o.split('/').some((t) => at.includes(t)))) overlap.push(opts.join(' ') + ' (answer ' + opts[ans] + ')');
    await page.click('#wb-next'); await page.waitForTimeout(100);
  }
  check(!overlap.length, tag + ' hangul quiz: no two options share a sound (ㄷ "d/t" vs ㅌ "t")', overlap.slice(0, 2));
  check(/\d+ \/ 10/.test(await page.evaluate(() => (document.querySelector('.wb-done') || {}).innerText || '')), tag + ' hangul quiz: reaches the result');
  await page.click('.wb-next').catch(() => {});
  Q.reportErrs(page, tag + ' word bank');

  // ── TOPIK ───────────────────────────────────────────────────
  await Q.go(page, 'korehan-topik.html', { wait: 3000 });
  const freeId = await page.evaluate(() => { const b = Array.from(document.querySelectorAll('[data-test]')).find((x) => /FREE/i.test(x.innerText) && /40 questions/.test(x.innerText)); return b && b.dataset.test; });
  check(!!freeId, tag + ' topik: a free full test is listed');
  await page.evaluate((id) => localStorage.removeItem('kh_topik_prog_' + id), freeId);
  await page.click('[data-test="' + freeId + '"]'); await page.waitForTimeout(3000);
  const qi = () => page.evaluate(() => ({ lbl: document.getElementById('tp-lbl').textContent, timer: document.getElementById('tp-timer').textContent, map: Array.from(document.querySelectorAll('.tp-map button')).map((b) => b.className.trim()) }));
  const t0 = (await qi()).timer; await page.waitForTimeout(2200);
  check((await qi()).timer !== t0, tag + ' topik: timer counts down', [t0, (await qi()).timer]);
  const n = (await qi()).map.length;
  for (let i = 0; i < n; i++) {
    if (i !== 2) await page.click('.tp-ch >> nth=0');
    if (i === 1) await page.click('#tp-flag');
    if (i < n - 1) await page.click('#tp-next');
  }
  let map = (await qi()).map;
  check(map[1].includes('f') && !map[2].includes('a') && map.filter((c) => c.includes('a')).length === n - 1, tag + ' topik: answered / flagged / skipped show on the question map');
  await page.click('#tp-prev'); check(/ 39 \//.test((await qi()).lbl) || /\b39 \/ 40/.test((await qi()).lbl), tag + ' topik: Back goes to the previous question', (await qi()).lbl);
  await page.click('.tp-map button >> nth=2'); check(/· 3 \//.test((await qi()).lbl), tag + ' topik: map jumps to a question');
  await page.click('#tp-x'); await page.waitForTimeout(600);
  await page.locator('button:text-is("Leave")').last().click(); await page.waitForTimeout(600);
  check(!(await page.$('#tp-ov')), tag + ' topik: Leave closes the test');
  await page.click('[data-test="' + freeId + '"]'); await page.waitForTimeout(3000);
  map = (await qi()).map;
  check(/· 3 \//.test((await qi()).lbl) && map.filter((c) => c.includes('a')).length === n - 1, tag + ' topik: reopening resumes at the same question with answers kept');
  await page.click('.tp-map button >> nth=' + (n - 1)); await page.click('#tp-next'); await page.waitForTimeout(600);
  check(/1 question is unanswered/.test(await page.evaluate(() => document.body.innerText)), tag + ' topik: Submit warns about the unanswered question');
  await page.locator('button:text-is("Submit")').last().click(); await page.waitForTimeout(2500);
  const expect = await page.evaluate(async (id) => { const r = await getSupa().from('topik_items').select('n,answer').eq('test_id', id).order('n'); return (r.data || []).filter((x, i) => i !== 2 && x.answer === 1).length; }, freeId);
  const res = await page.evaluate(() => document.getElementById('tp-q').innerText);
  check(new RegExp('\\b' + expect + ' of ' + n + ' correct').test(res), tag + ' topik: score matches the answer key (' + expect + '/' + n + ')', res.slice(0, 80));
  const rm = (res.match(/Review mistakes \((\d+)\)/i) || [])[1];
  check(+rm === n - expect, tag + ' topik: review lists every mistake', { listed: rm, expected: n - expect });
  const dr = await page.$('[data-drill]');
  if (dr) { await dr.click(); await page.waitForTimeout(3000); await page.click('.tp-ch >> nth=1'); await page.waitForTimeout(300); check(/Correct\.|Answer:/.test(await page.evaluate(() => (document.querySelector('.tp-exp') || {}).innerText || '')), tag + ' topik: drill shows the answer and explanation right away'); }
  await page.click('#tp-x'); await page.waitForTimeout(500);
  check(!(await page.$('#tp-ov')), tag + ' topik: closing returns to the hub');
  Q.reportErrs(page, tag + ' topik');
  await ctx.close();
}
await browser.close();
Q.summary();
