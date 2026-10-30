// Click-through QA: Home, Article reader, Conversations.
//   python3 -m http.server 8783 --directory korehan
//   node scripts/qa/reading.mjs [BASE_URL]
// Production writes are blocked (see lib.mjs). Checks the RESULT of each action,
// not just "page loads".
import * as Q from './lib.mjs';
// Live serves / and extensionless paths (korehani.com 308s .html away); local serves .html.
const isHome = (u) => /\/(index(\.html)?)?([?#].*)?$/.test(new URL(u).pathname + new URL(u).search);
const artId = (u) => new URL(u).searchParams.get('id');
const { check, info } = Q;

// Article with a full AI cache (translation, vocab, fill-in-the-blank), since
// AI calls are blocked. Override with QA_ARTICLE=<id> when it rolls off; empty =
// first article on Home (AI-dependent checks then only report).
const ART = process.env.QA_ARTICLE != null ? process.env.QA_ARTICLE : 'mwsuneung30d';

const browser = await Q.launch();
const free = await Q.freeState(browser);
let prem = null;
try { prem = await Q.premiumState(browser); } catch (e) { Q.fail('premium preview login: ' + e.message); }

for (const mobile of [true, false]) {
  const tag = mobile ? '[390]' : '[1366]';
  const ctx = await Q.newCtx(browser, { mobile, storageState: free });
  const page = await ctx.newPage();
  Q.watch(page, tag);

  // ── Home ────────────────────────────────────────────────────
  await Q.go(page, 'index.html', { wait: 4000 });
  check(isHome(page.url()), tag + ' home: signed-in user stays on index');
  const plan = () => page.evaluate(() => Array.from(document.querySelectorAll('.kt-st')).map((a) => a.classList.contains('done')));
  check((await plan()).length === 3, tag + ' home: Today card shows 3 plan steps');
  await page.evaluate(() => { Object.keys(localStorage).filter((k) => /kh_phrase_seen_/.test(k)).forEach((k) => localStorage.removeItem(k)); if (window._khTodayRepaint) window._khTodayRepaint(); });
  await page.waitForTimeout(400);
  const play = page.locator('[data-kt-play]:visible').first();
  if (await play.count()) {
    await play.click(); await page.waitForTimeout(800);
    check((await plan())[2] === true, tag + ' home: Listen to today\'s phrase ticks the phrase step');
    check(isHome(page.url()), tag + ' home: Listen does not navigate away');
    await page.reload(); await page.waitForTimeout(3000);
    check((await plan())[2] === true, tag + ' home: phrase step still ticked after reload');
  } else Q.fail(tag + ' home: no phrase Listen button');
  const hero0 = await page.evaluate(() => window._heroIdx);
  if (mobile) {
    await page.evaluate(() => { const s = document.querySelector('.kh-home-hero-main-shell'); const r = s.getBoundingClientRect(); const t = (x) => new Touch({ identifier: 1, target: s, clientX: x, clientY: r.top + 100 }); s.dispatchEvent(new TouchEvent('touchstart', { touches: [t(r.right - 20)], bubbles: true })); s.dispatchEvent(new TouchEvent('touchmove', { touches: [t(r.right - 200)], bubbles: true })); s.dispatchEvent(new TouchEvent('touchend', { touches: [], bubbles: true })); });
    await page.waitForTimeout(300);
    check(await page.evaluate((h) => window._heroIdx !== h, hero0), tag + ' home: hero swipe moves to the next slide');
    // bottom bar hides on scroll down, returns on scroll up
    await page.evaluate(() => window.scrollBy(0, 1200)); await page.waitForTimeout(700);
    check(await page.evaluate(() => document.querySelector('.mobile-bottom-nav').classList.contains('kh-bnav-away')), tag + ' bottom bar hides on scroll down');
    await page.evaluate(() => window.scrollBy(0, -300)); await page.waitForTimeout(700);
    check(await page.evaluate(() => !document.querySelector('.mobile-bottom-nav').classList.contains('kh-bnav-away')), tag + ' bottom bar returns on scroll up');
  }
  check((await Q.findEmojis(page)).length === 0, tag + ' home: no emoji in UI', await Q.findEmojis(page));
  check(!(await Q.overflowX(page)), tag + ' home: no horizontal scroll', await Q.overflowX(page));
  Q.reportErrs(page, tag + ' home');

  // ── Article ─────────────────────────────────────────────────
  const href = ART ? 'korehan-article.html?id=' + ART : await page.evaluate(() => { const a = document.querySelector('a[href*="korehan-article.html?id="]'); return a && a.getAttribute('href'); });
  await Q.go(page, href, { wait: 5000 });
  check(await page.locator('.art-sent').count() > 0, tag + ' article: sentences rendered');
  await page.locator('.art-sent').first().click();
  const panelOk = await page.waitForFunction(() => { const c = document.querySelector('.asp-close'); return !!c && /ENGLISH/i.test(c.parentElement.innerText); }, null, { timeout: 10000 }).then(() => true, () => false);
  check(panelOk, tag + ' article: tapping a sentence opens the English/vocab panel');
  await page.locator('.asp-close').first().click().catch(() => {}); await page.waitForTimeout(400);
  // bookmark: meta button and side bar stay in sync both ways
  const bm = () => page.evaluate(() => [document.querySelector('#art-bm-btn').classList.contains('active'), (document.querySelector('#kh-rs-bookmark') || { classList: { contains: () => null } }).classList.contains('active')]);
  const b0 = await bm();
  await page.click('#art-bm-btn'); await page.waitForTimeout(900);
  const b1 = await bm();
  check(b1[0] !== b0[0] && (b1[1] === null || b1[1] === b1[0]), tag + ' article: bookmark toggles and the side Save follows', { b0, b1 });
  if (b1[1] !== null && mobile) { await page.click('#kh-rs-bookmark'); await page.waitForTimeout(900); const b2 = await bm(); check(b2[0] === b0[0] && b2[1] === b0[0], tag + ' article: side Save toggles back and the meta bookmark follows', { b2 }); }
  else { await page.click('#art-bm-btn'); await page.waitForTimeout(900); }
  // translation + analyze toggles
  await page.click('#translate-btn');
  await page.waitForFunction(() => document.querySelector('#translate-btn').classList.contains('active'), null, { timeout: 10000 }).catch(() => {});
  check(await page.evaluate(() => document.querySelector('#translate-btn').classList.contains('active')), tag + ' article: Translate turns on', await page.evaluate(() => Array.from(document.querySelectorAll('.kh-toast,[class*=toast]')).map((e) => e.innerText).join('|')));
  await page.click('#translate-btn'); await page.waitForTimeout(800);
  check(await page.evaluate(() => !document.querySelector('#translate-btn').classList.contains('active')), tag + ' article: Translate turns off');
  await page.click('#analyze-btn'); await page.waitForTimeout(1500);
  check(await page.evaluate(() => document.querySelector('#analyze-btn').classList.contains('on')), tag + ' article: Analyze turns on');
  await page.click('#analyze-btn'); await page.waitForTimeout(800);
  check(await page.evaluate(() => !document.querySelector('#analyze-btn').classList.contains('on')), tag + ' article: Analyze turns off');
  // vocab tab save
  await page.click('.art-tab:has-text("Vocab")'); await page.waitForTimeout(1200);
  const saves = await page.$$eval('.avi-save-btn', (bs) => bs.filter((b) => b.getBoundingClientRect().width).map((b) => b.classList.contains('saved')));
  const si = saves.indexOf(false);
  if (si >= 0) { await page.locator('.avi-save-btn').nth(si).click(); await page.waitForTimeout(1000); check(await page.locator('.avi-save-btn').nth(si).evaluate((b) => b.classList.contains('saved')), tag + ' article: Vocab Save marks the word Saved'); }
  // review flow
  await page.click('.art-tab:has-text("Review")'); await page.waitForTimeout(1500);
  let vq = 0;
  await page.waitForSelector('#rv-vq-ko', { timeout: 15000 }).catch(() => {});
  let wrongDone = false;
  while (vq++ < 12 && await page.$('#rv-vq-ko')) {
    const o = page.locator('#rv-vq-options .rv-vq-opt:not([disabled])[data-correct="' + (wrongDone ? 1 : 0) + '"]').first();
    if (await o.count()) { await o.click({ timeout: 2000 }).catch(() => {}); wrongDone = true; }
    await page.waitForTimeout(900);
  }
  const vqt = await page.evaluate(() => document.getElementById('rv-vocab-check').innerText);
  const vqm = vqt.match(/(\d+) \/ (\d+) correct/);
  check(vqm && +vqm[1] === +vqm[2] - 1, tag + ' article: vocab check scores N-1/N after one wrong answer', vqt.slice(0, 120));
  const step = () => page.evaluate(() => (Array.from(document.querySelectorAll('#art-tab-quiz [data-step]')).find((e) => e.style.display !== 'none') || {}).dataset.step);
  if (await step() === '1') { const sk = page.locator('.rv-tf-skip'); if (await sk.count()) await sk.click(); else await page.waitForTimeout(4000); await page.waitForTimeout(1500); }
  check(await step() === '2', tag + ' article: T/F check can be skipped when AI is unavailable');
  await page.click('#fill-start-btn').catch(() => {});
  await page.waitForFunction(() => (window._fillQuestions || []).length > 0 && document.getElementById('fill-choices-0'), null, { timeout: 15000 }).catch(() => {});
  const fq = await page.evaluate(() => (window._fillQuestions || []).map((q) => q.blank));
  if (fq.length) {
    for (let i = 0; i < fq.length; i++) { const bs = page.locator('#fill-choices-' + i + ' button'); const tx = await bs.allTextContents(); await bs.nth(tx.findIndex((t) => t.trim() === fq[i])).click(); await page.waitForTimeout(200); }
    await page.waitForTimeout(2500);
    check(await step() === '3', tag + ' article: finishing fill-in-the-blank reveals Listening');
  } else info(tag + ' article: fill-in-the-blank not cached for this article (needs AI) — skipping to listening');
  if (await step() === '3') {
    await page.click('#art-listening-quiz .rv-start-btn'); await page.waitForTimeout(1500);   // let the smooth scroll to this step finish
    const lq0 = await page.evaluate(() => document.getElementById('art-listening-quiz').innerText.match(/\((\d+)\/(\d+)\)/));
    // two clicks on the same option in one go (a coordinate dblclick could land on Play
    // while the step was still smooth-scrolling)
    await page.locator('#art-listening-quiz button').nth(1).evaluate((el) => { el.click(); el.click(); }); await page.waitForTimeout(2000);
    const lqt = await page.evaluate(() => document.getElementById('art-listening-quiz').innerText);
    check(lq0 && new RegExp('\\(2/' + lq0[2] + '\\)').test(lqt), tag + ' article: double tap in listening quiz advances one question only', lqt.slice(0, 60));
    for (let i = 0; i < 6; i++) { const b = page.locator('#art-listening-quiz button').nth(1); if (!(await b.count())) break; await b.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(1000); }
    check(await step() === '4', tag + ' article: listening quiz finishes and reveals Build');
    await page.click('#art-build-quiz .rv-start-btn'); await page.waitForTimeout(600);
    const vocab = await page.evaluate(() => Array.from(document.querySelectorAll('#art-vocab-list .art-vocab-item')).map((i) => [i.querySelector('.art-vocab-ko').textContent.trim(), i.querySelector('.art-vocab-en').textContent.trim()]));
    let n = 0;
    while (n++ < 10 && await page.$('#art-build-input')) {
      const hint = await page.evaluate(() => (document.querySelector('#art-build-quiz div div:nth-child(2)') || {}).textContent || '');
      const v = vocab.find((x) => hint.startsWith(x[1]));
      await page.evaluate((a) => { const i = document.getElementById('art-build-input'); if (!i) return; i.value = a; window._artBuildCheck(); window._artBuildCheck(); }, v ? v[0] : '');
      await page.waitForTimeout(1300);
    }
    const bq = await page.evaluate(() => document.getElementById('art-build-quiz').innerText);
    const m = bq.match(/Score: (\d+) \/ (\d+)/);
    check(m && m[1] === m[2], tag + ' article: build quiz double Check scores each word once', bq.slice(0, 80));
    check(await step() === '5', tag + ' article: Review flow ends on "Ready for deeper study?"');
  }
  // next article (desktop pill / mobile side bar), back button
  const id0 = page.url();
  // The pills auto-hide while scrolling and come back at the page edge / when idle.
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(2000);
  if (!mobile) {
    const shown = await page.waitForFunction(() => document.body.classList.contains('kh-feed-pill-on'), null, { timeout: 8000 }).then(() => true, () => false);
    check(shown, tag + ' article: Next/Prev pills come back after scrolling stops', await page.evaluate(() => 'scrollY=' + scrollY));
  }
  if (process.env.QA_DEBUG) console.log(await page.evaluate(() => { const p = document.getElementById(innerWidth > 768 ? 'kh-feed-next-pill' : 'kh-rs-next'); const r = p.getBoundingClientRect(); const cs = getComputedStyle(p); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); let z = e, chain = []; while (z && z !== document.body) { const c = getComputedStyle(z); if (c.zIndex !== 'auto' || c.position === 'fixed') chain.push(z.tagName + '#' + z.id + '.' + String(z.className).slice(0, 25) + ' z=' + c.zIndex + ' pos=' + c.position); z = z.parentElement; } return 'hit=' + (e && e.tagName + '.' + String(e.className).slice(0, 30)) + ' chain=' + chain.join(' > ') + ' pill ' + [r.x, r.y, r.width, r.height].map(Math.round) + ' tf=' + cs.transform + ' op=' + cs.opacity + ' body=' + document.body.className + ' sy=' + scrollY; }));
  if (process.env.QA_DEBUG) await Q.shot(page, 'pill_' + (mobile ? 'm' : 'd'));
  // (the pill can slide away again while the page settles, so press it directly)
  if (mobile) await page.click('#kh-rs-next'); else await page.evaluate(() => document.getElementById('kh-feed-next-pill').click());
  await page.waitForTimeout(4000);
  check(page.url() !== id0, tag + ' article: Next article loads another article');
  check(await page.evaluate(() => (document.querySelector('.art-tab.on') || {}).textContent === 'Read'), tag + ' article: next article opens on the Read tab');
  if (!mobile) { await page.waitForTimeout(1500); await page.evaluate(() => document.getElementById('kh-feed-prev-pill').click()); await page.waitForTimeout(4000); check(artId(page.url()) === artId(id0), tag + ' article: Prev returns to the first article'); }
  // empty comment never posts
  const nb = Q.blocked.length;
  await page.click('.comment-submit-btn').catch(() => {}); await page.waitForTimeout(800);
  check(!Q.blocked.slice(nb).some((x) => /comment/.test(x)), tag + ' article: empty comment is not posted');
  await page.click('#kh-reading-back'); await page.waitForTimeout(2500);
  check(isHome(page.url()), tag + ' article: back arrow returns home');
  Q.reportErrs(page, tag + ' article');

  // ── Conversations (Free) ────────────────────────────────────
  await Q.go(page, 'korehan-conversations.html', { wait: 3000 });
  await page.click('.cv-chip:text-is("All levels")'); await page.waitForTimeout(300);
  const all = await page.locator('.cv-card').count();
  check(all > 5, tag + ' conv: list shows conversations', all);
  let sum = 0;
  for (const l of ['Seed', 'Sprout', 'Tree', 'Forest']) { await page.click('.cv-chip:text-is("' + l + '")'); await page.waitForTimeout(150); sum += await page.locator('.cv-card').count(); }
  check(sum === all, tag + ' conv: level filters partition the list', { sum, all });
  await page.click('.cv-chip:text-is("All levels")');
  await page.locator('.cv-card').first().click(); await page.waitForTimeout(1200);
  check(/\?id=/.test(page.url()), tag + ' conv: opening a conversation sets ?id=');
  const eng = () => page.evaluate(() => [document.querySelector('.cv-chat').dataset.english, Array.from(document.querySelectorAll('.cv-bb small')).filter((s) => s.getBoundingClientRect().height > 0).length, document.querySelectorAll('.cv-bb small').length]);
  for (let i = 0; i < 3 && (await eng())[0] !== 'tap'; i++) { await page.click('.cv-ctrl button:has-text("English")'); await page.waitForTimeout(200); }
  await page.locator('.cv-bb').first().click(); await page.waitForTimeout(400);
  check((await eng())[1] === 1, tag + ' conv: English Tap shows one line\'s English on tap');
  await page.click('.cv-ctrl button:has-text("English")'); await page.waitForTimeout(200);
  const on = await eng(); check(on[0] === 'on' && on[1] === on[2], tag + ' conv: English On shows every line', on);
  await page.click('.cv-ctrl button:has-text("English")'); await page.waitForTimeout(200);
  check((await eng())[1] === 0, tag + ' conv: English Off hides every line');
  await page.click('.cv-ctrl button:has-text("Play all")'); await page.waitForTimeout(600);
  check(await page.locator('.cv-ctrl button:has-text("Stop")').count() === 1, tag + ' conv: Play all turns into Stop');
  await page.click('.cv-ctrl button:has-text("Stop")'); await page.waitForTimeout(600);
  check(await page.locator('.cv-ctrl button:has-text("Play all")').count() === 1 && await page.locator('.cv-bb.play').count() === 0, tag + ' conv: Stop ends playback');
  await page.click('.cv-next'); await page.waitForTimeout(500);
  check(await page.locator('.cv-kx').count() > 0, tag + ' conv: Key expressions step lists expressions');
  await page.click('.cv-next'); await page.waitForTimeout(1200);
  check(await page.locator('.cv-opt').count() === 0 && await page.evaluate(() => !!document.getElementById('kh-upgrade-modal') && getComputedStyle(document.getElementById('kh-upgrade-modal')).display !== 'none'), tag + ' conv: Role-play is gated for Free (upgrade modal)');
  Q.reportErrs(page, tag + ' conv free');
  await ctx.close();
}

// ── Conversations: Premium role-play, every question to the end ──
if (prem) {
  const ctx = await Q.newCtx(browser, { mobile: true, storageState: prem });
  const page = await ctx.newPage();
  Q.watch(page, '[prem]');
  await Q.go(page, 'korehan-conversations.html', { wait: 3000 });
  // Rule checks across every conversation (options are built by rule).
  const rules = await page.evaluate(async () => {
    const r = await getSupa().from('conversations_data').select('*').limit(500);
    const R = window.khConvRules;
    const rows = (r.data || []).map(R.norm).filter((c) => c.status !== 'draft' && c.msgs.length >= 2 && c.speakers.length >= 2);
    R.setPool(rows);
    const bad = { noRight: [], dupOpt: [], wrongName: [], familyBanmal: [] };
    rows.forEach((c) => R.buildRoleplay(c).forEach((q) => {
      if (q.opts.filter((o) => o.ok).length !== 1) bad.noRight.push(c.id);
      if (new Set(q.opts.map((o) => o.ko)).size !== q.opts.length) bad.dupOpt.push(c.id);
      q.opts.forEach((o) => { if (o.why && /what (\S+) just said/.test(o.why) && RegExp.$1 !== q.prev.who) bad.wrongName.push(c.id + ':' + o.why.slice(0, 40)); });
      if (/^(엄마|어머니|아빠|아버지|할머니|할아버지|언니|누나|형|오빠|동생)$/.test(q.prev.who) && q.opts.some((o) => /^반말/.test(o.why || ''))) bad.familyBanmal.push(c.id);
    }));
    return { n: rows.length, bad };
  });
  check(rules.bad.noRight.length === 0, '[prem] role-play: exactly one right option per question', rules.bad.noRight);
  check(rules.bad.dupOpt.length === 0, '[prem] role-play: no duplicate options', rules.bad.dupOpt);
  check(rules.bad.wrongName.length === 0, '[prem] role-play: "why" names the speaker who actually spoke', rules.bad.wrongName.slice(0, 3));
  check(rules.bad.familyBanmal.length === 0, '[prem] role-play: no "반말 is wrong" option when answering a parent/sibling', rules.bad.familyBanmal);
  await page.click('.cv-chip:text-is("All levels")');
  await page.locator('.cv-card').first().click(); await page.waitForTimeout(1000);
  await page.click('.cv-next'); await page.waitForTimeout(400); await page.click('.cv-next'); await page.waitForTimeout(1000);
  const total = await page.evaluate(() => +(document.querySelector('.cv-rp-top span') || {}).textContent.split('/')[1] || 0);
  check(total > 0, '[prem] role-play opens with questions', total);
  let right = 0, i = 0;
  while (await page.$('.cv-opt') && i < 10) {
    await page.locator('.cv-opt').nth(i % 2 ? 0 : 3).click(); await page.waitForTimeout(300);
    const st = await page.evaluate(() => ({ ok: !!document.querySelector('.cv-opt.ok'), picked: Array.from(document.querySelectorAll('.cv-opt')).findIndex((b) => b.classList.contains('bad')), why: (document.querySelector('.cv-why') || {}).innerText || '' }));
    if (st.picked < 0) right++;
    check(st.ok && st.why.length > 5, '[prem] role-play Q' + (i + 1) + ': answer marked and "why" shown');
    const sentences = st.why.replace(/^(Right|Not quite)\.\s*(The other options:\s*)?/, '').split(/(?<=\.)\s+/).filter(Boolean);
    check(new Set(sentences).size === sentences.length, '[prem] role-play Q' + (i + 1) + ': "why" does not repeat the same sentence', st.why.slice(0, 120));
    await page.locator('.cv-next.wide').dblclick(); await page.waitForTimeout(400);
    i++;
  }
  check(i === total, '[prem] role-play: double tap on Next never skips a question', { answered: i, total });
  const ring = await page.evaluate(() => (document.querySelector('.cv-ring div') || {}).textContent);
  check(ring === right + '/' + total, '[prem] role-play: finish screen score matches answers', { ring, right, total });
  await page.click('#cv-save'); await page.waitForTimeout(2000);
  check(/Saved/.test(await page.evaluate(() => document.getElementById('cv-save').textContent)), '[prem] finish: Save expressions confirms');
  const nx = await page.$('.cv-nextc');
  if (nx) { await nx.click(); await page.waitForTimeout(1000); check(await page.locator('.cv-bb').count() > 0 && !(await page.evaluate(() => document.body.classList.contains('cv-dark'))), '[prem] finish: next suggestion opens the next conversation'); }
  await page.goBack(); await page.waitForTimeout(800); await page.goBack(); await page.waitForTimeout(800);
  check(await page.locator('.cv-card').count() > 0, '[prem] browser Back returns to the list');
  Q.reportErrs(page, '[prem] conv');
  await ctx.close();
}

await browser.close();
Q.summary();
