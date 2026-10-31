#!/usr/bin/env node
// Instagram-style reporter page QA (2026-10-31). Posts, stats, likes, follows and
// comments are mocked at the network layer, so nothing is written.
//   node scripts/qa/reporter-page.mjs http://192.0.2.2:8790 [shotDir]
import pw from '/opt/node-tools/node_modules/playwright/index.js';
import { mkdirSync } from 'node:fs';
const BASE = (process.argv[2] || 'http://localhost:8790').replace(/\/$/, '');
const SHOTS = (process.argv[3] || '/tmp/qa_reporter').replace(/\/$/, '') + '/';
try { mkdirSync(SHOTS, { recursive: true }); } catch (_) {}
let fails = 0, passes = 0;
const check = (c, n, d) => { if (c) { passes++; console.log('PASS ' + n); } else { fails++; console.log('FAIL ' + n + (d ? ' -- ' + JSON.stringify(d).slice(0, 300) : '')); } return !!c; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const launch = {}; if (process.env.HTTPS_PROXY) launch.proxy = { server: process.env.HTTPS_PROXY, bypass: new URL(BASE).hostname + ',localhost' };
const br = await pw.chromium.launch(launch);
const PID = '11111111-2222-3333-4444-555555555555';
const POSTS = [
  { id: PID, reporter_id: 'cr5', author_user_id: 'x', content: '오늘도 마감 때문에 야근했어요. 그래도 사실 확인은 끝까지 해야죠.', caption_en: 'Overtime again because of the deadline.', vocab: [{ ko: '마감', en: 'deadline' }, { ko: '야근', en: 'overtime' }, { ko: '사실 확인', en: 'fact-check' }],
    quiz: { q: '"야근"의 뜻은?', a: 'overtime work', w: ['night market', 'lunch break'] }, post_type: 'daily', status: 'published', pinned: false, created_at: new Date(Date.now() - 3600e3).toISOString() },
  { id: '22222222-2222-3333-4444-555555555555', reporter_id: 'cr5', author_user_id: 'x', content: '비 오는 날 취재', vocab: [], post_type: 'field', status: 'published', pinned: false, created_at: new Date(Date.now() - 5 * 86400e3).toISOString() },
];
const SET = { id: 'pc_cr5_midnight', name: 'Midnight', description: '', price_cents: 299, active: false, sort: 50, kind: 'photocard_set', reporter_id: 'cr5',
  items: [1, 2, 3, 4, 5, 6].map((i) => 'pc_cr5_s1_0' + i),
  preview: [1, 2, 3, 4, 5, 6].map((i) => ({ id: 'pc_cr5_s1_0' + i, label: 'Card ' + i, img: 'assets/photocards/cr5/s1-0' + i + '.webp' })) };
async function page(opts = {}) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const st = { follow: [], like: [], comment: null, postWrite: null };
  await ctx.route(/\/functions\/v1\//, (r) => r.abort());
  await ctx.route(/\/rest\/v1\//, async (r) => {
    const u = r.request().url(), m = r.request().method();
    const J = (b, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
    if (/\/reporter_posts/.test(u)) { if (m !== 'GET') { st.postWrite = { m, body: r.request().postData() }; return J({ id: PID }); } return J(POSTS); }
    if (/\/reporter_post_images/.test(u)) return m === 'GET' ? J([{ post_id: PID, image_url: BASE + '/assets/room/themes/winter.webp', sort_order: 0 }, { post_id: PID, image_url: BASE + '/assets/room/themes/cafe.webp', sort_order: 1 }]) : J({});
    if (/\/cash_products/.test(u)) return J([SET]);
    if (/\/user_photocards/.test(u)) return J([{ card_id: 'pc_cr5_s1_01' }, { card_id: 'pc_cr5_s1_03' }]);
    if (/rpc\/kh_reporter_feed_stats/.test(u)) return J({ followers: 12, following: false, likes: { [PID]: 3 }, liked: [], comments: { [PID]: 1 } });
    if (/\/reporter_follows/.test(u)) { st.follow.push(m); return r.fulfill({ status: 201, body: '' }); }
    if (/\/reporter_post_likes/.test(u)) { st.like.push(m); return r.fulfill({ status: 201, body: '' }); }
    if (/\/comments/.test(u)) return J([{ id: 'c1', user_id: 'zz', user_name: 'mina', content: '기자님 화이팅!', created_at: new Date().toISOString() }]);
    if (/rpc\/submit_comment/.test(u)) { st.comment = JSON.parse(r.request().postData() || '{}'); return J({ ok: true, id: 'c2' }); }
    if (m !== 'GET' && !/rpc\/(get_|kh_)/.test(u)) return r.fulfill({ status: 204, body: '' });
    return r.continue();
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  if (opts.admin) await p.addInitScript(() => { Object.defineProperty(window, 'khNyangUnlimited', { configurable: true, get() { return () => true; }, set() {} }); });
  if (opts.login) {
    await p.goto(BASE + '/korehan-shop.html', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof getSupa === 'function' && getSupa(), null, { timeout: 30000 });
    await p.evaluate(async () => { await getSupa().auth.signInWithPassword({ email: 'enane960819+khqa@gmail.com', password: 'KhQaScroll!2026x' }); });
  }
  await p.goto(BASE + '/korehan-reporter.html?id=cr5', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => document.querySelector('.rp-stats') && document.querySelectorAll('.rp-g').length, null, { timeout: 30000 }).catch(() => {});
  await sleep(1200);
  return { ctx, p, errs, st };
}
{
  const { ctx, p, errs, st } = await page({ login: true });
  const t = await p.evaluate(() => document.getElementById('rp-root').innerText);
  check(/서도윤/.test(t) && /followers/.test(t) && /12/.test(t), 'profile: name + follower count', t.slice(0, 200));
  check(/Birthday Jan 14/.test(t) && /INTJ/.test(t), 'fan profile facts');
  check(await p.evaluate(() => document.querySelector('.rp-ring').classList.contains('on')), 'story ring lit (post in last 48 h)');
  check(await p.evaluate(() => document.querySelectorAll('.rp-hl-i').length === 2), 'highlights from post types');
  check(await p.evaluate(() => document.querySelectorAll('.rp-g').length === 2), 'posts grid');
  await p.screenshot({ path: SHOTS + '01-profile.png', fullPage: true });
  await p.click('#rp-follow'); await sleep(400);
  check(st.follow[0] === 'POST' && /Following/.test(await p.textContent('#rp-follow')) && (await p.textContent('#rp-followers')) === '13', 'follow');
  await p.click('.rp-g'); await sleep(800);
  check(await p.evaluate(() => document.querySelectorAll('.rp-pv-imgs img').length === 2 && document.querySelectorAll('.rp-w').length === 3), 'post viewer: 2 photos, 3 tappable words');
  await p.click('.rp-w'); await sleep(200);
  check(/deadline/.test(await p.textContent('#rp-wpop')), 'tap word shows meaning');
  await p.click('.rp-qo button >> text=overtime work'); await sleep(200);
  check(await p.evaluate(() => !!document.querySelector('.rp-qo button.ok')), 'quiz answer marked');
  await p.click('#rp-like'); await sleep(300);
  check(st.like[0] === 'POST' && (await p.textContent('#rp-like span')) === '4', 'like');
  check(/화이팅/.test(await p.textContent('#rp-clist')), 'comments listed');
  await p.fill('#rp-cin', 'hello'); await p.click('.rp-cform button'); await sleep(300);
  check(!st.comment, 'English-only comment is refused (write in Korean)');
  await p.fill('#rp-cin', '저도 응원해요'); await p.click('.rp-cform button'); await sleep(500);
  check(st.comment && st.comment.p_article_id === 'rpost:' + PID, 'Korean comment posted through submit_comment', st.comment);
  await p.screenshot({ path: SHOTS + '02-post.png', fullPage: true });
  await p.keyboard.press('Escape'); await sleep(200);
  for (const tab of ['articles', 'cards', 'goods']) {
    await p.click('.rp-tabs button:has-text("' + tab.charAt(0).toUpperCase() + tab.slice(1) + '")'); await sleep(1200);
    check(await p.evaluate(() => document.getElementById('rp-panel').innerText.length > 10), 'tab ' + tab + ' renders');
  }
  check(/COMING SOON/.test(await p.textContent('#rp-panel')), 'goods: real goods coming soon');
  await p.click('.rp-tabs button:has-text("Cards")'); await sleep(1500);
  const cb = await p.evaluate(() => ({ head: (document.querySelector('.rp-pcset-h') || {}).innerText || '', n: document.querySelectorAll('.rp-pcset .rp-card').length,
    locked: document.querySelectorAll('.rp-pcset .rp-card-lock').length, buy: (document.querySelector('.rp-pcset-buy') || {}).innerText || '',
    imgs: [...document.querySelectorAll('.rp-pcset .rp-card img')].map((i) => i.complete && i.naturalWidth > 0).filter(Boolean).length,
    official: /Official/.test(document.getElementById('rp-panel').innerText) }));
  check(/Midnight/.test(cb.head) && /2 \/ 6 collected/.test(cb.head) && cb.n === 6 && cb.locked === 4, 'card book: set with 2 of 6 owned, 4 locked', cb);
  check(cb.imgs === 6, 'card book: all 6 card pictures load', cb);
  check(/Get all 6 cards/.test(cb.buy) && cb.official, 'card book: buy link + free official cards below', cb);
  await p.screenshot({ path: SHOTS + '03-cards.png', fullPage: true });
  await p.click('.rp-pcset .rp-card:not(.rp-card-lock)'); await sleep(500);
  check(await p.evaluate(() => { const i = document.querySelector('.rp-pcv img'); return !!i && /s1-01/.test(i.src) && /01 \/ 06/.test(document.querySelector('.rp-pcv-b').innerText); }), 'tap owned card opens the big view');
  await p.screenshot({ path: SHOTS + '04-card-view.png' });
  await p.keyboard.press('Escape'); await sleep(200);
  check(/korehan-shop\.html\?tab=special/.test(await p.getAttribute('.rp-card-lock', 'onclick')), 'locked card goes to the Special shop');
  check(!(await p.$('.rp-new')), 'no admin button for learners');
  check(!errs.length, 'no page errors', errs);
  await ctx.close();
}
{
  const { ctx, p, errs, st } = await page({ login: true, admin: true });
  check(!!(await p.$('.rp-new')), 'admin sees New post');
  await p.click('.rp-new'); await sleep(300);
  await p.fill('#rpf-ko', '새 게시물이에요'); await p.fill('#rpf-vocab', '게시물 = post');
  await p.fill('#rpf-q', '"게시물"의 뜻은?'); await p.fill('#rpf-a', 'post'); await p.fill('#rpf-w', 'news, photo');
  await p.click('#rpf-save'); await sleep(1200);
  const body = st.postWrite && JSON.parse(st.postWrite.body || '{}');
  check(body && body.content === '새 게시물이에요' && body.vocab[0].en === 'post' && body.quiz.w.length === 2, 'admin post saved with vocab + quiz', body);
  check(!errs.length, 'no page errors (admin)', errs);
  await ctx.close();
}
{
  const { ctx, p, errs } = await page({});
  await p.click('#rp-follow'); await sleep(500);
  check(await p.evaluate(() => !!document.querySelector('.kh-auth-modal, #kh-auth-modal, .auth-modal, [id*="auth"][class*="open"], .modal-overlay')), 'guest follow asks to sign in');
  check(!errs.length, 'no page errors (guest)', errs);
  await ctx.close();
}
console.log('\n' + passes + ' passed, ' + fails + ' failed');
await br.close();
process.exit(fails ? 1 : 0);
