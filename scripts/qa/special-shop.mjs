#!/usr/bin/env node
// Special shop click-through QA (2026-10-31). Products, orders and the billing
// call are mocked at the network layer, so nothing is charged or written.
//   node scripts/qa/special-shop.mjs http://192.0.2.2:8790 [shotDir]
import pw from '/opt/node-tools/node_modules/playwright/index.js';
import { mkdirSync } from 'node:fs';
const BASE = (process.argv[2] || 'http://localhost:8790').replace(/\/$/, '');
const SHOTS = (process.argv[3] || '/tmp/qa_special').replace(/\/$/, '') + '/';
try { mkdirSync(SHOTS, { recursive: true }); } catch (_) {}
let fails = 0, passes = 0;
const check = (c, n, d) => { if (c) { passes++; console.log('PASS ' + n); } else { fails++; console.log('FAIL ' + n + (d ? ' -- ' + JSON.stringify(d).slice(0, 400) : '')); } return !!c; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const launch = {}; if (process.env.HTTPS_PROXY) launch.proxy = { server: process.env.HTTPS_PROXY, bypass: new URL(BASE).hostname + ',localhost' };
const br = await pw.chromium.launch(launch);
const DAY = 86400000;
const PRODUCTS = [
  { id: 'xmas_pack_2026', kind: 'pack', name: 'Christmas Pack', description: 'Room theme + Santa outfit + 3 decorations', price_cents: 699, premium_discount_pct: 20, items: ['av_room_winter', 'xmas_wreath'], preview: [{ label: 'Winter room theme', img: 'assets/room/themes/winter.webp' }, { label: 'Christmas Wreath', img: 'assets/room/xmas-wreath.png' }, { label: 'Snowman', img: 'assets/room/snowman.png' }], image_url: 'assets/room/themes/winter.webp', badge: 'LIMITED', one_per_account: false, ends_at: new Date(Date.now() + 40 * DAY).toISOString(), active: true, sort: 1 },
  { id: 'starter_pack', kind: 'starter', name: 'Starter Pack', description: 'Theme + 1 outfit + 3 items', price_cents: 499, premium_discount_pct: 20, items: ['snowman'], preview: [{ label: 'Hanbok', img: 'assets/avatar/long-hanbok.png' }], one_per_account: true, active: true, sort: 2 },
  { id: 'outfit_kpop_stage', kind: 'outfit', name: 'K-pop Stage', price_cents: 399, premium_discount_pct: 20, items: ['av_outfit_kpop'], preview: [{ label: 'K-pop Stage', img: 'assets/avatar/long-kpop.png' }], active: true, sort: 3 },
  { id: 'outfit_padding_ltd', kind: 'outfit', name: 'Winter Padding', badge: 'LIMITED', price_cents: 599, premium_discount_pct: 20, items: ['av_outfit_padding'], preview: [{ label: 'Winter Padding', img: 'assets/avatar/bob-padding.png' }], active: true, sort: 4 },
  { id: 'pc_cr5_winter', kind: 'photocard_set', reporter_id: 'cr5', name: '서도윤 · Winter Edition set', description: '5 cards · goes to your card book', price_cents: 299, premium_discount_pct: 20, items: ['pc_cr5_w1', 'pc_cr5_w2'], preview: [1, 2, 3, 4, 5].map((i) => ({ label: 'Card ' + i, img: 'assets/room/snowman.png' })), active: true, sort: 5 },
  { id: 'ended_pack', kind: 'pack', name: 'Old Pack', price_cents: 699, items: ['x'], preview: [], ends_at: new Date(Date.now() - DAY).toISOString(), active: true, sort: 6 },
];
async function page(opts = {}) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const state = { checkoutBody: null, interest: [], orderPolls: 0 };
  // Playwright runs the LAST matching route first: register the catch-all before billing.
  await ctx.route(/\/functions\/v1\//, (r) => r.abort());
  await ctx.route(/\/functions\/v1\/billing/, async (r) => {
    state.checkoutBody = JSON.parse(r.request().postData() || '{}');
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.billing || { ok: true, url: BASE + '/korehan-shop.html?tab=special&order=00000000-0000-0000-0000-0000000000aa', order_id: 'x' }) });
  });
  await ctx.route(/\/rest\/v1\//, async (r) => {
    const u = r.request().url(), m = r.request().method();
    if (/\/cash_products/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.products === undefined ? PRODUCTS : opts.products) });
    if (/\/cash_orders/.test(u)) {
      if (/[?&]id=eq\./.test(u)) { state.orderPolls++; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.orderPolls < 2 ? { status: 'pending', product_id: 'xmas_pack_2026' } : { status: 'paid', product_id: 'xmas_pack_2026' }) }); }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.paid || []) });
    }
    if (/\/user_photocards/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (/\/goods_interest/.test(u)) {
      if (m === 'POST') { state.interest.push('add'); return r.fulfill({ status: 201, body: '' }); }
      if (m === 'DELETE') { state.interest.push('del'); return r.fulfill({ status: 204, body: '' }); }
      return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (/\/room_items/.test(u) && m === 'GET') {
      const res = await r.fetch(); let body = await res.json().catch(() => []);
      if (Array.isArray(body) && body.length) body.push({ ...body[0], id: 'qa_cash_star', name: 'QA Cash Star', price_nyang: 100, cash_only: true });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    }
    if (m !== 'GET' && !/rpc\/(get_|kh_)/.test(u)) return r.fulfill({ status: 204, body: '' });
    return r.continue();
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  if (opts.login) {
    await p.goto(BASE + '/korehan-shop.html', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof getSupa === 'function' && getSupa(), null, { timeout: 30000 });
    await p.evaluate(async () => { await getSupa().auth.signInWithPassword({ email: 'enane960819+khqa@gmail.com', password: 'KhQaScroll!2026x' }); });
  }
  return { ctx, p, errs, state };
}
async function open(p, q = '') {
  await p.goto(BASE + '/korehan-shop.html' + q, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => document.querySelector('#shop-grid') && document.querySelector('#shop-grid').children.length > 0 && !/Loading/.test(document.querySelector('#shop-grid').textContent), null, { timeout: 30000 }).catch(() => {});
  await sleep(1200);
  await p.evaluate(() => { const b = document.getElementById('kh-cookie-banner'); if (b) b.remove(); });
}

// 1. Signed in, products on sale → Special leads
{
  const { ctx, p, errs, state } = await page({ login: true });
  await open(p);
  if (errs.length) console.log('# page errors:', errs);
  check(await p.evaluate(() => document.querySelector('.shop-tab.active').dataset.tab === 'special'), 'Special tab opens first when items are on sale');
  const t = await p.evaluate(() => document.getElementById('shop-grid').innerText);
  check(/Christmas Pack/.test(t) && /Starter Pack/.test(t) && /K-pop Stage/.test(t) && /Winter Edition set/.test(t), 'all sections render', t.slice(0, 300));
  check(!/Old Pack/.test(t), 'ended pack is hidden');
  check(/Ends /.test(t) && /LIMITED/.test(t), 'limited badge + end date');
  check(/COMING SOON/.test(t) && /Notify me/.test(t), 'real goods: Coming soon + Notify me');
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await sleep(1200); await p.evaluate(() => window.scrollTo(0, 0));
  check(await p.evaluate(() => [...document.querySelectorAll('#shop-grid img')].every((i) => !i.complete || i.naturalWidth > 0)), 'no broken images', await p.evaluate(() => [...document.querySelectorAll('#shop-grid img')].filter((i) => i.complete && !i.naturalWidth).map((i) => i.src)));
  await p.screenshot({ path: SHOTS + '01-special.png', fullPage: true });
  // buy sheet
  await p.click('.sp-hero .sp-btn'); await sleep(400);
  const sheet = await p.evaluate(() => document.querySelector('.sh-sheet') && document.querySelector('.sh-sheet').innerText);
  check(/Christmas Pack/.test(sheet || '') && /Pay \$/.test(sheet || '') && /Winter room theme/.test(sheet || ''), 'buy sheet lists contents + Pay', sheet);
  await p.screenshot({ path: SHOTS + '02-sheet.png' });
  // pay → billing called with product, navigates to the return URL → polls until paid
  await Promise.all([p.waitForURL(/order=/, { timeout: 15000 }).catch(() => {}), p.click('#sp-pay')]);
  check(state.checkoutBody && state.checkoutBody.action === 'item_checkout' && state.checkoutBody.product_id === 'xmas_pack_2026', 'Pay calls billing item_checkout', state.checkoutBody);
  await p.waitForFunction(() => /added/.test((document.querySelector('.sh-sheet') || {}).innerText || ''), null, { timeout: 25000 }).catch(() => {});
  check(await p.evaluate(() => /added/.test((document.querySelector('.sh-sheet') || {}).innerText || '')), 'return: waits for the webhook, then "added" sheet');
  check(await p.evaluate(() => !/order=/.test(location.search)), 'return: order id removed from the URL');
  await p.screenshot({ path: SHOTS + '03-paid.png' });
  await p.evaluate(() => shopClose());
  // notify me
  await p.click('.sp-ghost'); await sleep(500);
  check(state.interest[0] === 'add' && await p.evaluate(() => /hear first/.test(document.querySelector('.sp-ghost').innerText)), 'Notify me saves interest');
  await p.click('.sp-ghost'); await sleep(500);
  check(state.interest[1] === 'del', 'Notify me toggles off');
  // room tab hides cash-only
  await p.click('.shop-tab[data-tab="room"]'); await sleep(800);
  check(await p.evaluate(() => !/QA Cash Star/.test(document.getElementById('shop-grid').innerText) && document.querySelectorAll('.sh-tile').length > 10), 'Room tab hides cash-only items');
  check(!errs.length, 'no page errors (signed in)', errs);
  await ctx.close();
}
// 2. Already bought starter (one per account) → starter hidden; outfit owned display
{
  const { ctx, p, errs } = await page({ login: true, paid: [{ product_id: 'starter_pack' }, { product_id: 'outfit_kpop_stage' }] });
  await open(p, '?tab=special');
  const t = await p.evaluate(() => document.getElementById('shop-grid').innerText);
  check(!/Starter Pack/.test(t), 'bought starter pack disappears');
  check(/K-pop Stage\s*Owned/.test(t) || /Owned/.test(t), 'bought outfit shows Owned');
  check(!errs.length, 'no page errors (owned)', errs);
  await ctx.close();
}
// 3. Checkout error → message, button restored
{
  const { ctx, p } = await page({ login: true, billing: { ok: false, error: 'billing_not_configured' } });
  await open(p, '?tab=special');
  await p.click('.sp-hero .sp-btn'); await sleep(300); await p.click('#sp-pay'); await sleep(800);
  check(await p.evaluate(() => /being set up/.test(document.body.innerText)), 'billing not configured → clear message');
  await ctx.close();
}
// 4. Nothing on sale + guest → Room stays first; Special shows empty state + Coming soon
{
  const { ctx, p, errs } = await page({ products: [] });
  await open(p);
  check(await p.evaluate(() => document.querySelector('.shop-tab.active').dataset.tab === 'room'), 'no products: Room stays the first tab');
  await p.click('.shop-tab[data-tab="special"]'); await sleep(500);
  check(await p.evaluate(() => /on the way/.test(document.getElementById('shop-grid').innerText) && /COMING SOON/.test(document.getElementById('shop-grid').innerText)), 'empty Special: "on the way" + Coming soon');
  await p.screenshot({ path: SHOTS + '04-empty.png', fullPage: true });
  check(!errs.length, 'no page errors (guest)', errs);
  await ctx.close();
}
// 5. canceled return
{
  const { ctx, p } = await page({ login: true });
  await open(p, '?tab=special&canceled=1');
  check(await p.evaluate(() => /canceled/i.test(document.body.innerText)), 'canceled return shows a toast');
  await ctx.close();
}
console.log('\n' + passes + ' passed, ' + fails + ' failed');
await br.close();
process.exit(fails ? 1 : 0);
