// Click-through QA: site chrome and the remaining pages — sidebar menu, bottom
// tab bar (hide on scroll, ON/OFF switch, pages where it is hidden), bell,
// Daily Mission chip, auth modal validation, onboarding (all steps, no account),
// and a sweep of every page in this area (errors, emoji, 390px overflow,
// broken images), signed out and signed in.
//   node scripts/qa/chrome.mjs [BASE_URL]
import * as Q from './lib.mjs';
const { check } = Q;

const PAGES = ['index.html', 'korehan-conversations.html', 'korehan-learn.html', 'korehan-topik.html', 'korehan-fun.html',
  'korehan-saved.html', 'korehan-phrase.html', 'korehan-life.html', 'korehan-courses.html', 'korehan-friends.html',
  'beginner-guide.html', 'landing.html', 'korehan-onboarding.html', 'korehan-all.html', 'korehan-section.html?s=buzz'];

const browser = await Q.launch();
const free = await Q.freeState(browser);

for (const [label, state, mobile] of [['out-390', null, true], ['free-390', free, true], ['free-1366', free, false]]) {
  const ctx = await Q.newCtx(browser, { mobile, storageState: state || undefined });
  const page = await ctx.newPage();
  Q.watch(page, label);
  for (const p of PAGES) {
    await Q.go(page, p, { wait: 3000 });
    const tag = '[' + label + '] ' + p;
    const em = await Q.findEmojis(page), ov = mobile ? await Q.overflowX(page) : null, im = await Q.brokenImages(page);
    check(!em.length, tag + ': no emoji', em);
    check(!ov, tag + ': no horizontal scroll', ov);
    check(!im.length, tag + ': no broken images', im);
    Q.reportErrs(page, tag);
  }
  await ctx.close();
}

// ── Mobile chrome, signed in ──
{
  const ctx = await Q.newCtx(browser, { mobile: true, storageState: free });
  const page = await ctx.newPage();
  Q.watch(page, 'chrome');
  await Q.go(page, 'index.html', { wait: 3500 });
  await page.click('.kh-ham'); await page.waitForTimeout(500);
  const links = await page.$$eval('#kh-mobile-sidebar a[href], .kh-mobile-sidebar a[href]', (as) => Array.from(new Set(as.map((a) => a.getAttribute('href')).filter((h) => h && !/^(#|javascript)/.test(h)))));
  check(links.length >= 10, 'sidebar: menu lists the site sections', links.length);
  for (const h of links) { const r = await page.request.get(Q.BASE + '/' + h.split(/[?#]/)[0]); check(r.status() === 200, 'sidebar link ' + h + ' resolves'); }
  const nav = () => page.evaluate(() => { const n = document.querySelector('.mobile-bottom-nav'); return n ? getComputedStyle(n).display : 'missing'; });
  await page.locator('.kh-sb-a:has-text("Bottom bar")').first().click(); await page.waitForTimeout(500);
  await page.click('.kh-sb-x').catch(() => {}); await page.waitForTimeout(400);
  check(['none', 'missing'].includes(await nav()), 'bottom bar: switch OFF hides it');
  await page.reload(); await page.waitForTimeout(3000);
  check(['none', 'missing'].includes(await nav()), 'bottom bar: OFF survives a reload');
  await page.click('.kh-ham'); await page.waitForTimeout(500);
  await page.locator('.kh-sb-a:has-text("Bottom bar")').first().click(); await page.waitForTimeout(500);
  await page.click('.kh-sb-x').catch(() => {}); await page.waitForTimeout(500);
  check(await nav() !== 'none' && await nav() !== 'missing', 'bottom bar: switch ON shows it again');
  for (const p of ['korehan-article.html?id=mwsuneung30d', 'korehan-conversations.html?id=75', 'korehan-fun-chosung.html', 'korehan-onboarding.html']) {
    await Q.go(page, p, { wait: 2500 });
    check(['none', 'missing'].includes(await nav()), 'bottom bar hidden on ' + p);
  }
  await Q.go(page, 'korehan-fun.html', { wait: 3000 });
  await page.click('.kh-notif-btn'); await page.waitForTimeout(800);
  check(await page.evaluate(() => { const d = document.querySelector('.kh-notif-dropdown'); return !!d && getComputedStyle(d).display !== 'none'; }), 'bell: opens the notifications list');
  const items = await page.$$eval('.kh-notif-dropdown .kh-notif-item, .kh-notif-dropdown [data-notif-id]', (es) => es.map((e) => e.innerText.replace(/\s*\d+[mhd]\s*$/, '').trim()));
  check(new Set(items).size === items.length, 'bell: no duplicate notifications', items.filter((x, i) => items.indexOf(x) !== i).slice(0, 2));
  await page.click('.kh-notif-btn'); await page.waitForTimeout(300);
  const dm = page.locator('#kh-daily-mission .dm-pill');
  if (await dm.count()) { await dm.click(); await page.waitForTimeout(600); check(/Save Words/.test(await page.evaluate(() => document.getElementById('kh-daily-mission').innerText)), 'Daily Mission chip opens the goals'); }
  Q.reportErrs(page, 'chrome');
  await ctx.close();
}

// ── Signed out: auth modal + onboarding ──
{
  const ctx = await Q.newCtx(browser, { mobile: true });
  const page = await ctx.newPage();
  Q.watch(page, 'auth');
  await Q.go(page, 'korehan-learn.html', { wait: 2500 });
  await page.evaluate(() => window.openAuthModal('signin')); await page.waitForTimeout(500);
  const err = () => page.evaluate(() => { const e = document.getElementById('kh-auth-error'); return e && getComputedStyle(e).display !== 'none' ? e.innerText : ''; });
  await page.click('#kh-signin-btn'); await page.waitForTimeout(500);
  check(/email and password/i.test(await err()), 'sign in: empty form explains what is missing');
  await page.fill('#kh-auth-email', Q.FREE.email); await page.fill('#kh-auth-pw', 'wrong-password-1'); await page.click('#kh-signin-btn'); await page.waitForTimeout(3000);
  check(/incorrect/i.test(await err()) && !(await page.locator('#kh-signin-btn').isDisabled()), 'sign in: wrong password shows an error and the button works again');
  page._qaErrs.splice(0);   // the expected 400 from the wrong password
  await page.evaluate(() => window._authSwitchTab('signup')); await page.waitForTimeout(300);
  const su = async (n, e, p1, p2) => { await page.fill('#kh-auth-name', n); await page.fill('#kh-auth-email2', e); await page.fill('#kh-auth-pw2', p1); await page.fill('#kh-auth-pw3', p2); await page.click('#kh-signup-btn'); await page.waitForTimeout(600); return err(); };
  check(/name/i.test(await su('', '', '', '')), 'sign up: name required');
  check(/valid email/i.test(await su('Q', 'bad', 'abc12345', 'abc12345')), 'sign up: invalid email rejected');
  check(/permanent email/i.test(await su('Q', 'x@mailinator.com', 'abc12345', 'abc12345')), 'sign up: disposable email rejected');
  check(/8 characters/i.test(await su('Q', 'qa.nobody@example.com', 'abc1', 'abc1')), 'sign up: short password rejected');
  check(/do not match/i.test(await su('Q', 'qa.nobody@example.com', 'abc12345', 'abc12346')), 'sign up: mismatched passwords rejected');
  check(/letters and numbers/i.test(await su('Q', 'qa.nobody@example.com', 'abcdefgh', 'abcdefgh')), 'sign up: letters-only password rejected');
  Q.reportErrs(page, 'auth');

  await Q.go(page, 'korehan-onboarding.html', { wait: 2500 });
  Q.watch(page, 'onboarding');
  const stage = () => page.evaluate(() => document.getElementById('ob-stage-copy').textContent);
  const act = (a) => page.locator('#ob-content [data-action="' + a + '"]').first();
  check(await act('go-hangul').isDisabled(), 'onboarding 1: Continue disabled until a goal is picked');
  await page.click('.ob-opt[data-id] >> nth=0'); await act('go-hangul').click(); await page.waitForTimeout(600);
  check(/2 of 6/.test(await stage()), 'onboarding: goal -> step 2');
  check(await act('after-hangul').isDisabled(), 'onboarding 2: Continue disabled until an answer is picked');
  await page.click('.ob-opt[data-hangul="yes"]'); await act('after-hangul').click(); await page.waitForTimeout(600);
  check(/3 of 6/.test(await stage()), 'onboarding: Hangul "yes" -> level step');
  await page.click('.ob-choice-card[data-choice="test"]'); await act('start-test').click(); await page.waitForTimeout(600);
  const seen = [];
  for (let i = 0; i < 12 && await page.$('.test-opt'); i++) {
    const q = await page.evaluate(() => document.querySelector('.test-q').innerText);
    seen.push(q);
    if (i === 1) await page.click('#test-unsure'); else await page.click('.test-opt >> nth=0');
    await page.waitForTimeout(200);
    check(await page.evaluate(() => document.querySelectorAll('.test-opt.correct, .test-opt.reveal').length) >= 1, 'onboarding level check Q' + (i + 1) + ': right answer revealed');
    await act('next-test').click(); await page.waitForTimeout(400);
  }
  check(seen.length === 8, 'onboarding level check: 8 questions', seen.length);
  check(/You're an? (Seed|Sprout|Tree|Forest)/.test(await page.evaluate(() => document.getElementById('ob-content').innerText)), 'onboarding: result names a level');
  await page.click('[data-recommended-level="Beginner"]'); await act('go-tap').click(); await page.waitForTimeout(600);
  check(/4 of 6/.test(await stage()), 'onboarding: -> tap demo');
  await page.click('#ob-tap'); await page.waitForTimeout(400);
  await page.locator('[data-save-ko]').first().click(); await page.waitForTimeout(600);
  check(/review/.test(await page.evaluate(() => document.getElementById('ob-tap-toast').innerText)), 'onboarding: saving a word confirms it comes back in review');
  await act('go-daily').click(); await page.waitForTimeout(500);
  await page.click('.ob-time-btn[data-min] >> nth=2'); await page.waitForTimeout(200);
  await act('go-save').click(); await page.waitForTimeout(1500);
  check(/6 of 6/.test(await stage()) && /20 min/.test(await page.evaluate(() => document.getElementById('ob-content').innerText)), 'onboarding: summary shows the chosen daily time');
  await act('signup-email').click(); await page.waitForTimeout(500);
  check(!(await page.evaluate(() => document.getElementById('ob-age-confirm').checked)) && !(await page.$('#kh-auth-modal:visible')), 'onboarding: sign up is blocked until the age box is ticked');
  await page.locator('.ob-back-chip').first().click(); await page.waitForTimeout(500);
  check(/5 of 6/.test(await stage()), 'onboarding: Back goes one step back');
  Q.reportErrs(page, 'onboarding');
  await ctx.close();
}

await browser.close();
Q.summary();
