#!/usr/bin/env node
// My Room click-through QA (2026-10-30, after the Front/Back drift bug, PR #973).
//
// Presses every My Room button like a user and checks the RESULT (positions,
// layout data, persistence after reload), not just "no console errors".
//
//   node scripts/qa/room.mjs http://localhost:8781 [shotDir]
//   (serve first: python3 -m http.server 8781 --directory korehan)
//
// Logs in as the QA account (free plan, production auth). Writes are blocked
// (POST/PATCH/DELETE → 204, edge functions aborted) EXCEPT this account's own
// user_room_state, which is snapshotted first and written back at the end.
// buy_room_item / kh_claim_room_unlocks / toggle_room_like are always faked.
// Prints PASS / FAIL lines; exit code 1 when anything failed.
//
// QA_ONLY=room,tabs,custom,shop,profile limits the sections run.
import pw from '/opt/node-tools/node_modules/playwright/index.js';
import { mkdirSync } from 'node:fs';

const BASE = (process.argv[2] || 'http://localhost:8781').replace(/\/$/, '');
const SHOTS = (process.argv[3] || '/tmp/qa_room').replace(/\/$/, '') + '/';
const EMAIL = 'enane960819+khqa@gmail.com';
const PASSWORD = 'KhQaScroll!2026x';
const ONLY = (process.env.QA_ONLY || '').split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);
const KINDS = (process.env.QA_KINDS || 'desktop,mobile').split(',');
try { mkdirSync(SHOTS, { recursive: true }); } catch (_) {}

let fails = 0, passes = 0;
function pass(name) { passes++; console.log('PASS ' + name); }
function fail(name, detail) { fails++; console.log('FAIL ' + name + (detail ? ' -- ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 600) : '')); }
function check(cond, name, detail) { cond ? pass(name) : fail(name, detail); return !!cond; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Proxy: a sandbox with HTTPS_PROXY needs it for the CDN + Supabase; the local
// server must bypass it (Playwright never bypasses loopback names by itself).
const baseHost = new URL(BASE).hostname;
const launchOpts = {};
if (process.env.HTTPS_PROXY) launchOpts.proxy = { server: process.env.HTTPS_PROXY, bypass: baseHost + ',localhost,127.0.0.1' };
const browser = await pw.chromium.launch(launchOpts);

// ── Network policy ───────────────────────────────────────────────────
// fake: per-context knobs the tests flip (buy result, slots, public room, …)
function makeFake() { return { buy: { ok: false, error: 'INSUFFICIENT_NYANG', current: 0 }, slots: null, publicRoom: null, claim: null, likes: null, roomWrites: 0, blocked: [] }; }
async function policy(ctx, fake) {
  await ctx.route(/\/functions\/v1\//, (r) => {
    if (/\/functions\/v1\/(claude-proxy|cache-write|tts|azure-tts|speech|billing)/.test(r.request().url())) return r.abort();
    return r.fulfill({ status: 204, body: '' });
  });
  await ctx.route(/\/rest\/v1\//, (r) => {
    const req = r.request(), u = req.url(), m = req.method();
    const json = (o) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (/\/rpc\/buy_room_item/.test(u)) { fake.blocked.push('buy_room_item ' + (req.postData() || '')); return json(fake.buy); }
    if (/\/rpc\/kh_claim_room_unlocks/.test(u)) return json(fake.claim || { ok: false });
    if (/\/rpc\/toggle_room_like/.test(u)) { fake.likes = fake.likes || { count: 0, liked: false }; fake.likes = { count: fake.likes.count + (fake.likes.liked ? -1 : 1), liked: !fake.likes.liked }; return json(Object.assign({ ok: true }, fake.likes)); }
    if (/\/rpc\/kh_my_room_slots/.test(u) && fake.slots) return json(fake.slots);
    if (/\/rpc\/get_public_room/.test(u) && fake.publicRoom) return json(fake.publicRoom);
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return r.continue();
    if (/\/rest\/v1\/user_room_state/.test(u)) { fake.roomWrites++; return r.continue(); }
    if (/\/rest\/v1\/rpc\/(kh_|get_)/.test(u)) return r.continue();
    fake.blocked.push(m + ' ' + u.replace(/\?.*/, ''));
    return r.fulfill({ status: 204, body: '' });
  });
}

const MOBILE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const DESKTOP = { viewport: { width: 1366, height: 900 } };

let storage = null;   // auth-only storageState, made once
async function newCtx(kind, fake) {
  const ctx = await browser.newContext(Object.assign({ ignoreHTTPSErrors: !!launchOpts.proxy }, kind === 'mobile' ? MOBILE : DESKTOP, storage ? { storageState: storage } : {}));
  await ctx.addInitScript(() => { try { localStorage.setItem('kh_cookie_consent', 'essential'); } catch (_) {} });
  await policy(ctx, fake);
  return ctx;
}
function watch(page, tag) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(tag + ' pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errs.push(tag + ' console: ' + m.text().slice(0, 200)); });
  page.on('dialog', (d) => { const h = page._onDialog; if (h) h(d); else d.dismiss().catch(() => {}); });
  return errs;
}
async function hookToasts(page) {
  await page.evaluate(() => {
    window.__toasts = [];
    window.__dm = [];   // pointer moves seen while an item is being dragged (debug detail)
    ['touchmove', 'mousemove', 'mousedown', 'touchstart'].forEach(function (t) { document.addEventListener(t, function (e) { if (typeof _dragItem !== 'undefined' && (_dragItem || /down|start/.test(t))) window.__dm.push(t + '@' + Math.round(e.touches ? e.touches[0].clientX : e.clientX) + ',' + Math.round(e.touches ? e.touches[0].clientY : e.clientY)); }, true); });
    if (typeof toast === 'function' && !toast.__qa) {
      var o = toast; window.toast = function (m) { window.__toasts.push(String(m)); return o.apply(this, arguments); }; window.toast.__qa = 1;
    }
  });
}
const lastToast = (page) => page.evaluate(() => (window.__toasts || []).slice(-1)[0] || '');

async function login() {
  const fake = makeFake();
  const ctx = await newCtx('desktop', fake);
  const page = await ctx.newPage();
  await page.goto(BASE + '/korehan-shop.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof getSupa === 'function' && getSupa(), null, { timeout: 30000 });
  const r = await page.evaluate(async ([e, p]) => { const x = await getSupa().auth.signInWithPassword({ email: e, password: p }); return x.error ? 'ERR ' + x.error.message : x.data.user.id; }, [EMAIL, PASSWORD]);
  if (String(r).startsWith('ERR')) throw new Error('login failed: ' + r);
  storage = await ctx.storageState();
  // Keep only the auth token so every context starts with a clean room cache.
  storage.origins.forEach((o) => { o.localStorage = o.localStorage.filter((kv) => /^sb-.*auth-token/.test(kv.name)); });
  await ctx.close();
  return r;
}

// ── My Page helpers ──────────────────────────────────────────────────
async function openMyPage(page) {
  await page.goto(BASE + '/korehan-mypage.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof _getRoomLayoutAll === 'function' && document.querySelector('#miniroom-items') && !document.getElementById('miniroom-loading') && window.supaUser && typeof _roomItemsLoaded !== 'undefined' && _roomItemsLoaded, null, { timeout: 45000 });
  await page.waitForFunction(() => document.getElementById('rt-tabs'), null, { timeout: 15000 }).catch(() => {});
  await sleep(1200);
  await hookToasts(page);
  await page.evaluate(() => { var b = document.getElementById('kh-cookie-banner'); if (b) b.remove(); });
}
// Positions of every placed item: data + what's on screen (relative to the room box).
async function roomState(page) {
  return page.evaluate(() => {
    var box = document.getElementById('miniroom-container').getBoundingClientRect();
    var dom = {};
    document.querySelectorAll('.room-placed-item').forEach(function (el) {
      var r = el.getBoundingClientRect();
      dom[el.dataset.itemId] = { x: Math.round(r.left - box.left), y: Math.round(r.top - box.top), w: Math.round(r.width), h: Math.round(r.height),
        cx: (r.left + r.width / 2 - box.left) / box.width, cy: (r.top + r.height / 2 - box.top) / box.height,
        flipped: (el.querySelector('.room-placed-sprite') || {}).dataset ? el.querySelector('.room-placed-sprite').dataset.flipped === '1' : false };
    });
    return { view: getRoomLayout(), all: _getRoomLayoutAll(), dom: dom, order: Array.prototype.map.call(document.querySelectorAll('.room-placed-item'), function (e) { return e.dataset.itemId; }), box: { w: box.width, h: box.height } };
  });
}
function posDiff(a, b, keys) {
  const out = [];
  const byId = (l) => { const m = {}; (l || []).forEach((e) => { m[e.id] = e; }); return m; };
  const A = byId(a), B = byId(b);
  (keys || Object.keys(A)).forEach((id) => {
    if (!B[id]) { out.push(id + ' missing'); return; }
    if (A[id].x !== B[id].x || A[id].y !== B[id].y) out.push(id + ' ' + A[id].x + ',' + A[id].y + ' -> ' + B[id].x + ',' + B[id].y);
  });
  return out;
}
function domDiff(a, b, tol = 1) {
  const out = [];
  Object.keys(a).forEach((id) => {
    if (!b[id]) { out.push(id + ' gone'); return; }
    if (Math.abs(a[id].x - b[id].x) > tol || Math.abs(a[id].y - b[id].y) > tol) out.push(id + ' ' + a[id].x + ',' + a[id].y + ' -> ' + b[id].x + ',' + b[id].y);
  });
  return out;
}
function allInside(dom) {
  return Object.keys(dom).filter((id) => { const d = dom[id]; return !(d.cx > 0.02 && d.cx < 0.98 && d.cy > 0.02 && d.cy < 0.98); });
}
async function tapEl(page, sel, mobile) {
  const el = typeof sel === 'string' ? await page.$(sel) : sel;
  if (!el) throw new Error('no element ' + sel);
  await el.scrollIntoViewIfNeeded().catch(() => {});
  if (mobile) await el.tap(); else await el.click();
}
async function itemCenter(page, id) {
  const el = await page.$('.room-placed-item[data-item-id="' + id + '"]');
  await el.scrollIntoViewIfNeeded();
  const b = await el.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, el };
}
// Real touch / mouse drag of one item by (dx, dy) px.
async function dragItem(page, id, dx, dy, mobile, cdp) {
  const c = await itemCenter(page, id);
  const steps = 8;
  if (mobile) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y }] });
    for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c.x + dx * i / steps, y: c.y + dy * i / steps }] }); await sleep(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(c.x, c.y); await page.mouse.down();
    for (let i = 1; i <= steps; i++) { await page.mouse.move(c.x + dx * i / steps, c.y + dy * i / steps); await sleep(16); }
    await page.mouse.up();
  }
  await sleep(150);
}
async function selectItem(page, id, mobile, cdp) {
  const c = await itemCenter(page, id);
  if (mobile) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y }] });
    await sleep(60);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else await page.mouse.click(c.x, c.y);
  await sleep(250);
  return page.evaluate(() => _selectedRoomItemId);
}
// Items whose centre is not covered by another item (a tap there hits them).
async function freeIds(page) {
  await page.evaluate(() => document.getElementById('miniroom-container').scrollIntoView({ block: 'center' }));
  return page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('.room-placed-item'), function (e) { return e.dataset.itemId; }).filter(function (id) {
    var el = document.querySelector('.room-placed-item[data-item-id="' + id + '"]'); var r = el.getBoundingClientRect();
    var hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return hit && el.contains(hit);
  }));
}
async function editOn(page, mobile) { if (!(await page.evaluate(() => _roomEditing))) await tapEl(page, '#room-edit-btn', mobile); await sleep(200); }
async function editOff(page, mobile) { if (await page.evaluate(() => _roomEditing)) await tapEl(page, '#room-edit-btn', mobile); await sleep(300); }
async function shot(page, name) { try { await page.screenshot({ path: SHOTS + name + '.png' }); } catch (_) {} }
async function roomShot(page, name) { try { const s = await page.$('#mp-miniroom-section'); if (s) await s.screenshot({ path: SHOTS + name + '.png' }); } catch (_) {} }
// emoji, not ©®™ / arrows, and not the plain glyphs emoji-icons.js keeps on purpose (KH_EMOJI_KEEP)
const EMOJI = /(?![\u00a9\u00ae\u2122\u2194-\u2199\u21a9\u21aa\u2713\u2714\u2715\u2717\u2718\u2605\u2606\u266a\u266b\u2726\u2630])\p{Extended_Pictographic}/u;
async function noEmoji(page, sel, name) {
  const t = await page.evaluate((s) => Array.prototype.map.call(document.querySelectorAll(s), (e) => e.innerText).join('\n'), sel);
  const m = t.match(EMOJI);
  check(!m, name + ': no emoji in UI text', m ? 'found ' + m[0] : '');
}
async function waitSynced(page) {
  // The room sync debounces 400 ms; wait until nothing is pending.
  await page.waitForFunction(() => !_roomSyncTimer && !_roomSyncInFlight, null, { timeout: 15000 }).catch(() => {});
  await sleep(300);
}
async function serverRow(page) {
  return page.evaluate(async () => {
    var r = await getSupa().from('user_room_state').select('layout, prefs, owned').eq('user_id', supaUser.id).maybeSingle();
    return r.data;
  });
}

// ════════════════════════════════════════════════════════════════════
const uid = await login();
console.log('# logged in as QA account ' + uid.slice(0, 8));
let SNAP = null;          // server row at start
let restoreCtx = null;

async function restore() {
  if (!SNAP) return;
  const fake = makeFake();
  const ctx = await newCtx('desktop', fake);
  const page = await ctx.newPage();
  await page.goto(BASE + '/korehan-shop.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof getSupa === 'function' && getSupa() && window.supaUser, null, { timeout: 30000 });
  const res = await page.evaluate(async (snap) => {
    var r = await getSupa().from('user_room_state').upsert({ user_id: supaUser.id, layout: snap.layout, prefs: snap.prefs, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (r.error) return 'ERR ' + r.error.message;
    var b = await getSupa().from('user_room_state').select('layout, prefs').eq('user_id', supaUser.id).maybeSingle();
    return JSON.stringify(b.data.layout) === JSON.stringify(snap.layout) && JSON.stringify(b.data.prefs) === JSON.stringify(snap.prefs) ? 'ok' : 'mismatch';
  }, SNAP);
  check(res === 'ok', 'restore: QA room state written back exactly', res);
  await ctx.close();
}

try {
  // ── Snapshot ──────────────────────────────────────────────────────
  {
    const fake = makeFake();
    const ctx = await newCtx('desktop', fake);
    const page = await ctx.newPage();
    await page.goto(BASE + '/korehan-shop.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof getSupa === 'function' && getSupa() && window.supaUser, null, { timeout: 30000 });
    SNAP = await serverRow(page);
    await ctx.close();
    if (!SNAP) throw new Error('QA account has no user_room_state row');
    console.log('# snapshot: ' + SNAP.layout.length + ' placed, rooms ' + JSON.stringify((SNAP.prefs || {}).rooms || []));
  }

  for (const kind of KINDS) {
    const mobile = kind === 'mobile';
    const fake = makeFake();
    const ctx = await newCtx(kind, fake);
    const page = await ctx.newPage();
    const errs = watch(page, kind);
    const cdp = mobile ? await ctx.newCDPSession(page) : null;
    const T = (n) => kind + ' ' + n;

    await openMyPage(page);
    await roomShot(page, kind + '-01-load');

    if (want('room')) {
      // ── Load ──
      let s0 = await roomState(page);
      const ownedArt = await page.evaluate(() => getRoomLayout().filter(function (p) { var d = getRoomItemDef(p.id); return d && getRoomOwned().indexOf(p.id) !== -1 && !roomImgMissing(d); }).length);
      check(Object.keys(s0.dom).length === ownedArt && ownedArt > 0, T('load: every placed item is drawn'), { dom: Object.keys(s0.dom), layout: s0.view.map((e) => e.id) });
      check(!allInside(s0.dom).length, T('load: every item is inside the room'), allInside(s0.dom));
      await noEmoji(page, '#mp-miniroom-section', T('room section'));

      // ── My Items drawer: filters, place every owned item ──
      await page.evaluate(() => openRoomShop(true));   // the drawer still exists (shop deep links); the dock opens the inline panel
      await page.waitForSelector('.room-shop-overlay', { timeout: 8000 });
      check(/My Items/.test(await page.textContent('.room-shop-header h3')), T('My Items: drawer opens as My Items'));
      await shot(page, kind + '-02-myitems');
      for (const cat of ['pet', 'furniture', 'deco', 'character', 'all']) {
        await tapEl(page, '[data-shop-cat="' + cat + '"]', mobile);
        const bad = await page.evaluate((c) => Array.prototype.filter.call(document.querySelectorAll('.room-shop-card'), function (el) { return el.style.display !== 'none' && c !== 'all' && el.dataset.cat !== c; }).length, cat);
        check(bad === 0, T('My Items: filter ' + cat + ' shows only ' + cat));
      }
      let placedNow = 0;
      for (let guard = 0; guard < 8; guard++) {
        const btn = await page.$('.room-shop-overlay .room-shop-btn.place');
        if (!btn) break;
        const id = await btn.evaluate((b) => b.closest('.room-shop-card').dataset.itemId);
        await tapEl(page, btn, mobile);
        await sleep(300);
        const ok = await page.evaluate((i) => isItemPlaced(i) && !!document.querySelector('.room-placed-item[data-item-id="' + i + '"]'), id);
        check(ok, T('My Items: Place in Room puts ' + id + ' in the room'));
        check(/My Items/.test(await page.textContent('.room-shop-header h3').catch(() => '')), T('My Items: stays My Items after placing ' + id));
        placedNow++;
      }
      // Esc closes the drawer
      await page.keyboard.press('Escape'); await sleep(200);
      check(!(await page.$('.room-shop-overlay')), T('My Items: Esc closes'));
      await page.evaluate(() => openRoomShop(true));   // the drawer still exists (shop deep links); the dock opens the inline panel
      await page.waitForSelector('.room-shop-overlay');
      await page.mouse.click(5, 5); await sleep(200);
      check(!(await page.$('.room-shop-overlay')), T('My Items: backdrop tap closes'));
      await editOff(page, mobile);
      await waitSynced(page);
      s0 = await roomState(page);
      check(!allInside(s0.dom).length, T('after placing: all items inside the room'), allInside(s0.dom));
      const ids = s0.order;
      console.log('# ' + kind + ' room has ' + ids.length + ' items: ' + ids.join(','));

      // ── Edit mode on / off without changes must not move anything ──
      for (let i = 0; i < 5; i++) { await editOn(page, mobile); await editOff(page, mobile); }
      let s1 = await roomState(page);
      check(!posDiff(s0.view, s1.view).length, T('Edit Room → Done x5 without changes: nothing moves (data)'), posDiff(s0.view, s1.view));
      check(!domDiff(s0.dom, s1.dom).length, T('Edit Room → Done x5: nothing moves (screen)'), domDiff(s0.dom, s1.dom));

      await editOn(page, mobile);
      check(await page.evaluate(() => document.getElementById('room-edit-btn').textContent.trim() === 'Done' && getComputedStyle(document.getElementById('room-size-controls')).display !== 'none'), T('Edit Room: button says Done, controls shown'));
      check(await page.evaluate(() => getComputedStyle(document.getElementById('room-sel-controls')).display === 'none'), T('Edit Room: item controls hidden until an item is picked'));

      // ── Select ── (pick an item nothing else covers, so a tap really hits it)
      const free = await freeIds(page);
      const target = free.find((i) => i !== 'kh_avatar') || ids[ids.length - 1];
      const sel = await selectItem(page, target, mobile, cdp);
      check(sel === target, T('tap item selects it'), sel);
      check(await page.evaluate(() => getComputedStyle(document.getElementById('room-sel-controls')).display !== 'none' && getComputedStyle(document.getElementById('room-remove-btn')).display !== 'none'), T('selected: size/flip/front/back/remove shown'));
      let s2 = await roomState(page);
      check(!posDiff(s0.view, s2.view).length && !domDiff(s0.dom, s2.dom).length, T('tap-select does not move anything'), posDiff(s0.view, s2.view).concat(domDiff(s0.dom, s2.dom)).concat([target], await page.evaluate(() => window.__dm.slice(-12))));
      await roomShot(page, kind + '-03-selected');

      // ── Front / Back x10 ──
      const pressN = async (sel, n) => { for (let i = 0; i < n; i++) { await tapEl(page, sel, mobile); await sleep(60); } };
      await pressN('button[onclick="moveSelectedLayer(1)"]', 10);
      let s3 = await roomState(page);
      check(!posDiff(s0.view, s3.view).length, T('Front x10: no item moves (data)'), posDiff(s0.view, s3.view));
      check(!domDiff(s0.dom, s3.dom).length, T('Front x10: no item moves (screen)'), domDiff(s0.dom, s3.dom));
      check(s3.order[s3.order.length - 1] === target, T('Front x10: selected item is the top layer'), s3.order);
      check(await page.evaluate((t) => _selectedRoomItemId === t && !!document.querySelector('.room-placed-item.room-selected[data-item-id="' + t + '"]'), target), T('Front: item stays selected'));
      await pressN('button[onclick="moveSelectedLayer(-1)"]', 10);
      s3 = await roomState(page);
      check(!posDiff(s0.view, s3.view).length && !domDiff(s0.dom, s3.dom).length, T('Back x10: no item moves'), posDiff(s0.view, s3.view).concat(domDiff(s0.dom, s3.dom)));
      check(s3.order[0] === target, T('Back x10: selected item is the bottom layer'), s3.order);
      await pressN('button[onclick="moveSelectedLayer(1)"]', 10);   // back on top so later taps / drags reach it

      // ── Flip x10 (even → original), x1 → flipped ──
      const flip0 = !!(s3.view.find((e) => e.id === target) || {}).flipped;
      await pressN('button[onclick="flipSelectedItem()"]', 10);
      s3 = await roomState(page);
      check(!!(s3.view.find((e) => e.id === target) || {}).flipped === flip0 && s3.dom[target].flipped === flip0, T('Flip x10: back to the original side'));
      check(!posDiff(s0.view, s3.view).length && !domDiff(s0.dom, s3.dom).length, T('Flip x10: no item moves'), posDiff(s0.view, s3.view).concat(domDiff(s0.dom, s3.dom)));
      await pressN('button[onclick="flipSelectedItem()"]', 1);
      s3 = await roomState(page);
      check(!!s3.view.find((e) => e.id === target).flipped === !flip0 && s3.dom[target].flipped === !flip0, T('Flip x1: item mirrored in data and on screen'));
      await waitSynced(page);
      { const rw = await serverRow(page); const se = rw.layout.find((e) => e.id === target); check(se && !!se.flipped === !flip0, T('Flip is saved to the server without pressing Done'), se); }

      // ── Size −/+ and slider ──
      const scaleOf = async () => page.evaluate((t) => ({ data: (getRoomLayout().find(function (e) { return e.id === t; }) || {}).scale, slider: document.getElementById('room-size-slider').value, label: document.getElementById('room-size-value').textContent }), target);
      await pressN('button[onclick="nudgeSelectedItemScale(10)"]', 12);
      let sc = await scaleOf();
      check(sc.data === 170 && sc.slider === '170' && sc.label === '170%', T('+ x12: size stops at 170%'), sc);
      await pressN('button[onclick="nudgeSelectedItemScale(-10)"]', 12);
      sc = await scaleOf();
      check(sc.data === 70 && sc.slider === '70' && sc.label === '70%', T('− x12: size stops at 70%'), sc);
      await page.evaluate(() => { var s = document.getElementById('room-size-slider'); s.value = '135'; s.dispatchEvent(new Event('input', { bubbles: true })); });
      await sleep(400);
      sc = await scaleOf();
      check(sc.data === 135 && sc.label === '135%', T('slider: size follows the slider'), sc);
      s3 = await roomState(page);
      check(!posDiff(s0.view, s3.view).length && !domDiff(s0.dom, s3.dom).length, T('resizing moves nothing'), posDiff(s0.view, s3.view).concat(domDiff(s0.dom, s3.dom)));
      await pressN('button[onclick="nudgeSelectedItemScale(-10)"]', 3); // 105
      await pressN('button[onclick="nudgeSelectedItemScale(-10)"]', 0);

      // ── Drag ──
      const other = ids.filter((i) => i !== target);
      const before = await roomState(page);
      // drag towards the side with room to move (an item at the edge is held there on purpose)
      const lim = await page.evaluate((id) => { var d = getRoomItemDef(id), hr = innerWidth > 700 ? 0.4 : 0.7, b = d.size || 100; return { x: 400 - b * (1 + hr) / 2, y: 360 - b * (1 + hr) / 2 }; }, target);
      const tb = before.view.find((e) => e.id === target);
      const sx = tb.x > lim.x / 2 ? -1 : 1, sy = tb.y > lim.y / 2 ? -1 : 1;
      await dragItem(page, target, 40 * sx, 30 * sy, mobile, cdp);
      let s4 = await roomState(page);
      const ta = s4.view.find((e) => e.id === target);
      const expDx = Math.round(40 * sx / before.box.w * 400), expDy = Math.round(30 * sy / before.box.h * 360);
      check(Math.abs((ta.x - tb.x) - expDx) <= 3 && Math.abs((ta.y - tb.y) - expDy) <= 3, T('drag: item moves by the dragged distance'), { from: [tb.x, tb.y], to: [ta.x, ta.y], exp: [expDx, expDy] });
      check(!posDiff(before.view, s4.view, other).length, T('drag: other items stay put'), posDiff(before.view, s4.view, other));
      // back and forth 10x → returns to the same spot
      for (let i = 0; i < 5; i++) { await dragItem(page, target, 25 * sx, 0, mobile, cdp); await dragItem(page, target, -25 * sx, 0, mobile, cdp); }
      let s5 = await roomState(page);
      const t5 = s5.view.find((e) => e.id === target);
      check(Math.abs(t5.x - ta.x) <= 3 && Math.abs(t5.y - ta.y) <= 3, T('drag back and forth x10: no creep'), { was: [ta.x, ta.y], now: [t5.x, t5.y] });
      check(!posDiff(before.view, s5.view, other).length, T('drag x10: other items never move'), posDiff(before.view, s5.view, other));
      // fling far bottom-right and top-left → still inside, still reachable
      await dragItem(page, target, 2000, 2000, mobile, cdp);
      let s6 = await roomState(page);
      check(!allInside(s6.dom).length, T('drag far past the bottom-right: item stays inside the room'), s6.dom[target]);
      await shot(page, kind + '-04-drag-corner');
      await dragItem(page, target, -3000, -3000, mobile, cdp);
      s6 = await roomState(page);
      const t6 = s6.view.find((e) => e.id === target);
      check(!allInside(s6.dom).length && t6.x >= 0 && t6.y >= 0, T('drag far past the top-left: item stays inside the room'), s6.dom[target]);
      // can still grab it and bring it back
      await dragItem(page, target, 120, 120, mobile, cdp);
      s6 = await roomState(page);
      const t7 = s6.view.find((e) => e.id === target);
      check(t7.x > t6.x + 20 && t7.y > t6.y + 20, T('item in the corner can still be grabbed and moved back'), { corner: [t6.x, t6.y], now: [t7.x, t7.y] });

      // Front / Back after a drag must keep the dragged position
      const s7 = await roomState(page);
      await tapEl(page, 'button[onclick="moveSelectedLayer(1)"]', mobile);
      await tapEl(page, 'button[onclick="moveSelectedLayer(-1)"]', mobile);
      const s8 = await roomState(page);
      check(!posDiff(s7.view, s8.view).length && !domDiff(s7.dom, s8.dom).length, T('Front/Back right after a drag: nothing moves'), posDiff(s7.view, s8.view).concat(domDiff(s7.dom, s8.dom)));

      // ── Reset positions: Cancel keeps everything; OK brings all into view ──
      // (khConfirm sheet, not a native dialog)
      const modalBtn = async (label) => { await page.locator('.kh-modal-backdrop button', { hasText: label }).last().click(); await sleep(400); };
      await tapEl(page, 'button[onclick="resetRoomPositions()"]', mobile); await sleep(300);
      check(await page.locator('.kh-modal-backdrop').count() > 0, T('Reset positions asks in the site sheet'));
      await modalBtn('Cancel');
      let s9 = await roomState(page);
      check(!posDiff(s8.view, s9.view).length, T('Reset positions → Cancel: nothing changes'), posDiff(s8.view, s9.view));
      await tapEl(page, 'button[onclick="resetRoomPositions()"]', mobile); await sleep(300);
      await modalBtn('Reset'); await sleep(200);
      s9 = await roomState(page);
      check(!allInside(s9.dom).length, T('Reset positions → OK: every item inside the room'), allInside(s9.dom));
      const overlapping = await page.evaluate(() => { var n = 0, els = Array.prototype.slice.call(document.querySelectorAll('.room-placed-item')); for (var i = 0; i < els.length; i++) for (var j = i + 1; j < els.length; j++) { var a = els[i].getBoundingClientRect(), b = els[j].getBoundingClientRect(); if (Math.abs(a.left - b.left) < 2 && Math.abs(a.top - b.top) < 2) n++; } return n; });
      check(overlapping === 0, T('Reset positions: no two items stacked on the same spot'), overlapping);
      await roomShot(page, kind + '-05-reset');

      // ── An entry that isn't drawn (art not uploaded yet / not owned / character still
      //    loading) must survive drags and Done ──
      const hiddenId = await page.evaluate(() => { var own = getRoomOwned(); var it = ROOM_ITEMS.filter(function (d) { return own.indexOf(d.id) === -1 && !isItemPlaced(d.id) && d.id !== 'kh_avatar'; })[0]; return it && it.id; });
      if (hiddenId) {
        await page.evaluate((h) => { var l = getRoomLayout(); l.push({ id: h, x: 100, y: 100, scale: 100 }); setRoomLayout(l); renderRoomItems(); }, hiddenId);
        const dragOne = (await freeIds(page)).find((i) => i !== 'kh_avatar');
        await dragItem(page, dragOne, 30, 30, mobile, cdp);
        check(await page.evaluate((h) => getRoomLayout().some(function (e) { return e.id === h; }), hiddenId), T('drag keeps a placed item that is not drawn (' + hiddenId + ')'));
        await editOff(page, mobile); await editOn(page, mobile);
        check(await page.evaluate((h) => getRoomLayout().some(function (e) { return e.id === h; }), hiddenId), T('Done keeps a placed item that is not drawn'));
        await page.evaluate((h) => { setRoomLayout(getRoomLayout().filter(function (e) { return e.id !== h; })); }, hiddenId);
      }

      // ── Done saves; nothing moves on Done; survives reload ──
      const sBeforeDone = await roomState(page);
      await editOff(page, mobile);
      const sAfterDone = await roomState(page);
      check(!posDiff(sBeforeDone.view, sAfterDone.view).length && !domDiff(sBeforeDone.dom, sAfterDone.dom).length, T('Done: nothing moves when saving'), posDiff(sBeforeDone.view, sAfterDone.view).concat(domDiff(sBeforeDone.dom, sAfterDone.dom)));
      check(/Room saved/.test(await lastToast(page)), T('Done: "Room saved!" toast'), await lastToast(page));
      check(await page.evaluate(() => !_roomEditing && document.getElementById('room-edit-btn').textContent.trim() === 'Edit' && getComputedStyle(document.getElementById('room-size-controls')).display === 'none'), T('Done: leaves edit mode'));
      await waitSynced(page);
      const row = await serverRow(page);
      check(!posDiff(sAfterDone.all, row.layout).length && row.layout.length === sAfterDone.all.length, T('Done: server layout matches the room'), posDiff(sAfterDone.all, row.layout));
      await openMyPage(page);
      const sReload = await roomState(page);
      check(!posDiff(sAfterDone.view, sReload.view).length && sReload.view.length === sAfterDone.view.length, T('reload: positions persist'), posDiff(sAfterDone.view, sReload.view));
      check(!domDiff(sAfterDone.dom, sReload.dom).length, T('reload: items drawn at the same spots'), domDiff(sAfterDone.dom, sReload.dom));
      const fr = sReload.view.find((e) => e.id === target);
      check(!!fr && fr.scale === 105 && !!fr.flipped === !flip0, T('reload: size + flip persist'), fr);
      check(JSON.stringify(sReload.order) === JSON.stringify(sAfterDone.order), T('reload: layer order persists'), { was: sAfterDone.order, now: sReload.order });

      // ── Done saves (the separate Save button is gone, 2026-10-31) ──
      await editOn(page, mobile);
      const sv0 = await roomState(page);
      await tapEl(page, '#room-edit-btn', mobile); await sleep(300);
      const sv1 = await roomState(page);
      check(!posDiff(sv0.view, sv1.view).length && !(await page.evaluate(() => _roomEditing)), T('Save button: saves, leaves edit mode, nothing moves'), posDiff(sv0.view, sv1.view));

      // ── Remove + Undo (button) ──
      await editOn(page, mobile);
      const rmId = (await freeIds(page)).filter((i) => i !== target && i !== 'kh_avatar').pop() || target;
      await selectItem(page, rmId, mobile, cdp);
      const rm0 = (await roomState(page)).view.find((e) => e.id === rmId);
      await tapEl(page, '#room-remove-btn', mobile); await sleep(300);
      check(await page.evaluate((i) => !isItemPlaced(i) && !document.querySelector('.room-placed-item[data-item-id="' + i + '"]'), rmId), T('Remove: item leaves the room'));
      check(await page.evaluate(() => getComputedStyle(document.getElementById('room-sel-controls')).display === 'none'), T('Remove: item controls hide (nothing selected)'));
      const undo = await page.$('#room-undo-toast button');
      const undoVisible = undo ? await page.evaluate((b) => { var r = b.getBoundingClientRect(); var top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return r.bottom <= innerHeight && r.top >= 0 && (top === b || b.contains(top)); }, undo) : false;
      check(undoVisible, T('Remove: Undo button is visible and tappable'));
      if (!undoVisible) await shot(page, kind + '-06-undo-hidden');
      if (undo) { await undo.click({ force: true }); await sleep(300); }
      const rm1 = (await roomState(page)).view.find((e) => e.id === rmId);
      check(!!rm1 && rm1.x === rm0.x && rm1.y === rm0.y && rm1.scale === rm0.scale && !!rm1.flipped === !!rm0.flipped, T('Undo: item back with the same spot/size/flip'), { before: rm0, after: rm1 });

      // ── Long-press remove (touch only) ──
      if (mobile) {
        const c = await itemCenter(page, rmId);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y }] });
        await sleep(700);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await sleep(300);
        const modal = await page.$('.kh-modal-backdrop');
        check(!!modal, T('long-press: asks "Remove from room?"'));
        if (modal) {
          const btns = await page.$$('.kh-modal-backdrop button');
          const labels = await Promise.all(btns.map((b) => b.textContent()));
          const ci = labels.findIndex((l) => /Cancel/.test(l));
          if (ci >= 0) await btns[ci].tap();
          await sleep(500);
          check(await page.evaluate((i) => isItemPlaced(i), rmId) && !(await page.$('.kh-modal-backdrop')), T('long-press → Cancel: item stays'), labels);
          // again, then Remove
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y }] });
          await sleep(700);
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await sleep(300);
          const b2 = await page.$$('.kh-modal-backdrop button');
          const l2 = await Promise.all(b2.map((b) => b.textContent()));
          const ri = l2.findIndex((l) => /Remove/.test(l));
          if (ri >= 0) { await b2[ri].tap(); await sleep(500); }
          check(await page.evaluate((i) => !isItemPlaced(i), rmId), T('long-press → Remove: item removed'));
          const u2 = await page.$('#room-undo-toast button');
          if (u2) { await u2.tap(); await sleep(300); }
          check(await page.evaluate((i) => isItemPlaced(i), rmId), T('long-press remove → Undo: item back'));
        }
        const lp = (await roomState(page)).view.find((e) => e.id === rmId);
        check(lp && lp.x === rm0.x && lp.y === rm0.y, T('long-press: item did not move'), { before: rm0, after: lp });
        // a slow, short drag moves the item and must not pop "Remove?"
        const c2 = await itemCenter(page, rmId);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c2.x, y: c2.y }] });
        // ~9 px by the 450 ms long-press mark (past the 5 px drag threshold, inside the 12 px slop), then on to ~19 px
        for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c2.x + i * 1.6, y: c2.y + i * 1.6 }] }); await sleep(80); }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await sleep(400);
        const popped = !!(await page.$('.kh-modal-backdrop'));
        check(!popped, T('slow short drag: no "Remove from room?" dialog'));
        if (popped) { const bb = await page.$$('.kh-modal-backdrop button'); for (const b of bb) if (/Cancel/.test(await b.textContent())) await b.tap(); await sleep(400); }
        const lp2 = (await roomState(page)).view.find((e) => e.id === rmId);
        check(lp2 && (lp2.x !== rm0.x || lp2.y !== rm0.y), T('slow short drag: item moved'), { before: rm0, after: lp2 });
      }

      // ── Switching edit mode off with an item selected ──
      await selectItem(page, target, mobile, cdp);
      await editOff(page, mobile);
      check(await page.evaluate(() => !_selectedRoomItemId && !document.querySelector('.room-placed-item.room-selected') && getComputedStyle(document.getElementById('room-remove-btn')).display === 'none'), T('Done with an item selected: selection cleared'));
      // Tapping items outside edit mode does not move them
      const ne0 = await roomState(page);
      await dragItem(page, target, 50, 50, mobile, cdp);
      const ne1 = await roomState(page);
      check(!posDiff(ne0.view, ne1.view).length, T('outside edit mode: dragging does nothing'), posDiff(ne0.view, ne1.view));

      // ── Theme drawer + light switch ──
      await editOn(page, mobile);   // Background lives in the edit dock (2026-10-31)
      const themeBtn = await page.$('#room-bg-btn');
      if (themeBtn && await themeBtn.isVisible()) {
        await tapEl(page, '#room-bg-btn', mobile); await sleep(200);
        check(await page.evaluate(() => document.getElementById('room-theme-drawer').classList.contains('open')), T('wallpaper button opens the drawer'));
        await tapEl(page, '#room-theme-drawer .room-theme-swatch[data-id="brick"]', mobile); await sleep(200);
        check(await page.evaluate(() => _getRoomTheme().wallpaper === 'brick' && /repeating-linear-gradient/.test(document.getElementById('miniroom-container').style.background)), T('pick wallpaper Brick: room shows it'));
        await tapEl(page, '#room-theme-drawer .room-theme-tab[data-tab="floor"]', mobile); await sleep(150);
        await tapEl(page, '#room-theme-drawer .room-theme-swatch[data-id="wood"]', mobile); await sleep(200);
        check(await page.evaluate(() => _getRoomTheme().floor === 'wood' && document.getElementById('room-floor-layer').style.opacity === '1'), T('pick floor Wood: floor shows'));
        // close by tapping the room, open/close 6x via the button (incl. its edge)
        await page.mouse.click(5, 5); await sleep(150);
        check(await page.evaluate(() => !document.getElementById('room-theme-drawer').classList.contains('open')), T('wallpaper drawer closes on outside tap'));
        let okToggle = true;
        for (let i = 0; i < 6; i++) {
          const b = await themeBtn.boundingBox();
          const px = i % 2 ? b.x + 3 : b.x + b.width / 2, py = i % 2 ? b.y + 3 : b.y + b.height / 2;   // edge, then icon
          if (mobile) await page.touchscreen.tap(px, py); else await page.mouse.click(px, py);
          await sleep(150);
          const open = await page.evaluate(() => document.getElementById('room-theme-drawer').classList.contains('open'));
          if (open !== (i % 2 === 0)) { okToggle = false; break; }
        }
        check(okToggle, T('wallpaper button: open/close x6 (icon and edge taps) always toggles'));
        await page.evaluate(() => document.getElementById('room-theme-drawer').classList.remove('open'));
        await tapEl(page, '#room-bg-btn', mobile); await sleep(200);
        await page.keyboard.press('Escape'); await sleep(150);
        check(await page.evaluate(() => !document.getElementById('room-theme-drawer').classList.contains('open')), T('wallpaper drawer: Esc closes'));
        await editOff(page, mobile);   // the light switch shows when not editing
        // lights off / on → wallpaper comes back (Brick), not the default
        await tapEl(page, '#room-light-switch', mobile); await sleep(150);
        check(await page.evaluate(() => document.getElementById('miniroom-container').classList.contains('room-lights-off')), T('light switch: lights off'));
        await tapEl(page, '#room-light-switch', mobile); await sleep(150);
        check(await page.evaluate(() => !document.getElementById('miniroom-container').classList.contains('room-lights-off') && /repeating-linear-gradient/.test(document.getElementById('miniroom-container').style.background)), T('light switch on: your wallpaper comes back'));
        // persists
        await waitSynced(page);
        await openMyPage(page);
        check(await page.evaluate(() => _getRoomTheme().wallpaper === 'brick' && _getRoomTheme().floor === 'wood'), T('reload: wallpaper + floor persist'));
        // back to default
        await page.evaluate(() => { _saveRoomTheme({ wallpaper: 'default', floor: 'none' }); _applyRoomTheme(); });
      } else fail(T('wallpaper button visible on a Classic room'));

      // ── Music ──
      await tapEl(page, '#room-bgm-btn', mobile); await sleep(250);
      const tracks = await page.$$eval('#room-bgm-drawer .room-bgm-track', (els) => els.map((e) => e.dataset.track));
      check(await page.evaluate(() => document.getElementById('room-bgm-drawer').classList.contains('open')) && tracks.length > 1, T('music button opens the track list'), tracks);
      const tr = tracks.find((t) => t !== 'off');
      if (tr) {
        await tapEl(page, '#room-bgm-drawer .room-bgm-track[data-track="' + tr + '"]', mobile); await sleep(300);
        check(await page.evaluate((t) => _bgmGetSavedState().track === t && document.getElementById('room-bgm-btn').classList.contains('on'), tr), T('music: picking a track plays it (state + button on)'));
        if (!(await page.evaluate(() => document.getElementById('room-bgm-drawer').classList.contains('open')))) { fail(T('music: drawer stays open after picking a track')); await tapEl(page, '#room-bgm-btn', mobile); await sleep(200); }
        else pass(T('music: drawer stays open after picking a track'));
        await tapEl(page, '#room-bgm-drawer .room-bgm-track[data-track="off"]', mobile); await sleep(200);
        check(await page.evaluate(() => _bgmGetSavedState().track === 'off' && !document.getElementById('room-bgm-btn').classList.contains('on')), T('music: Off stops it'));
      }
      await page.mouse.click(5, 5); await sleep(150);
      check(await page.evaluate(() => !document.getElementById('room-bgm-drawer').classList.contains('open')), T('music drawer closes on outside tap'));

      // ── Rotate / resize between phone and desktop widths ──
      const rz0 = await roomState(page);
      await page.setViewportSize(mobile ? { width: 1100, height: 844 } : { width: 390, height: 844 }); await sleep(700);
      const rz1 = await roomState(page);
      check(!posDiff(rz0.view, rz1.view).length && !allInside(rz1.dom).length, T('resize across 700px: layout unchanged, items inside'), posDiff(rz0.view, rz1.view).concat(allInside(rz1.dom)));
      await editOn(page, mobile);
      await selectItem(page, target, false, null).catch(() => {});
      await tapEl(page, 'button[onclick="flipSelectedItem()"]', false); await tapEl(page, 'button[onclick="flipSelectedItem()"]', false);
      await editOff(page, false);
      const rz2 = await roomState(page);
      check(!posDiff(rz0.view, rz2.view).length, T('after resize: Flip x2 + Done moves nothing'), posDiff(rz0.view, rz2.view));
      await page.setViewportSize(mobile ? MOBILE.viewport : DESKTOP.viewport); await sleep(700);
      const rz3 = await roomState(page);
      check(!posDiff(rz0.view, rz3.view).length && !domDiff(rz0.dom, rz3.dom, 2).length, T('resize back: same spots as before'), posDiff(rz0.view, rz3.view).concat(domDiff(rz0.dom, rz3.dom, 2)));
    }

    // ── Study unlocks list (faked kh_claim_room_unlocks) ──
    if (want('room') && !mobile) {
      fake.claim = { ok: true, owned: SNAP.owned || [], new_items: [], progress: {}, unlocks: [
        { item_id: 'plant', label: 'Save 10 words', goal_key: 'saved_words', goal_target: 10, current: 10, owned: true, sort: 1 },
        { item_id: 'lamp', label: 'Read 5 articles', goal_key: 'articles_read', goal_target: 5, current: 2, owned: false, sort: 2 },
        { item_id: 'cat', label: 'Study 3 days in a row', goal_key: 'streak_days', goal_target: 3, current: 1, owned: false, sort: 3 },
        { item_id: 'fennec', label: 'Play 5 games', goal_key: 'games_played', goal_target: 5, current: 0, owned: false, sort: 4 },
        { item_id: 'bookshelf', label: 'Finish a TOPIK test', goal_key: 'topik_tests', goal_target: 1, current: 0, owned: false, sort: 5 }] };
      await page.evaluate(() => khRoomLearn.claim());
      await sleep(400);
      const ru = await page.evaluate(() => { var b = document.getElementById('room-unlocks'); return { hidden: b.hidden, rows: b.querySelectorAll('.ru-row').length, all: (b.querySelector('.ru-all') || {}).textContent }; });
      check(!ru.hidden && ru.rows === 3 && /All 5/.test(ru.all), T('study unlocks: 3 closest goals + "All 5"'), ru);
      await tapEl(page, '#room-unlocks .ru-all', mobile); await sleep(200);
      const ru2 = await page.evaluate(() => ({ rows: document.querySelectorAll('#room-unlocks .ru-row').length, btn: document.querySelector('#room-unlocks .ru-all').textContent }));
      check(ru2.rows === 5 && /Show less/.test(ru2.btn), T('study unlocks: "All" expands to every unlock'), ru2);
      await tapEl(page, '#room-unlocks .ru-all', mobile); await sleep(200);
      check(await page.evaluate(() => document.querySelectorAll('#room-unlocks .ru-row').length === 3), T('study unlocks: "Show less" collapses'));
      await noEmoji(page, '#room-unlocks', T('study unlocks'));
      await editOn(page, mobile);
      check(await page.evaluate(() => { var b = document.getElementById('room-unlocks'); return b.hidden || getComputedStyle(b).display === 'none'; }), T('study unlocks hidden while editing'), await page.evaluate(() => document.getElementById('room-unlocks').hidden));
      await editOff(page, mobile);
    }

    // ── Room tabs ──
    if (want('tabs')) {
      await page.evaluate(() => document.getElementById('mp-miniroom-section').scrollIntoView());
      await editOn(page, mobile);   // + New and the tab row show while editing (2026-10-31)
      const rooms0 = await page.evaluate(() => khAvatar.allRooms());
      const lay0 = await page.evaluate(() => _getRoomLayoutAll());
      // + New on a free account with 1 room → paid sheet
      await editOn(page, mobile); await tapEl(page, '#rt-tabs .rt-new', mobile);
      await page.waitForSelector('.rt-ov .rt-sheet', { timeout: 8000 });
      const sheetTxt = await page.textContent('.rt-sheet');
      check(/Add a room/.test(sheetTxt) && /600 nyang/.test(sheetTxt) && /Room 2 of 3/.test(sheetTxt), T('+ New: "Add a room", Room 2 of 3, 600 nyang'), sheetTxt.slice(0, 200));
      await roomShot(page, kind + '-07-addroom');
      await shot(page, kind + '-07-addroom-full');
      const sheetBox = await page.evaluate(() => { var r = document.querySelector('.rt-sheet').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, vw: innerWidth, vh: innerHeight }; });
      check(sheetBox.l >= 0 && sheetBox.r <= sheetBox.vw + 0.5 && sheetBox.t >= 0 && sheetBox.b <= sheetBox.vh + 0.5, T('+ New sheet fits the screen'), sheetBox);
      await page.fill('.rt-sheet .rt-in', 'Typed then cancelled');
      await tapEl(page, '.rt-sheet [data-sact="cancel"]', mobile); await sleep(200);
      check(!(await page.$('.rt-ov')) && JSON.stringify(await page.evaluate(() => khAvatar.allRooms())) === JSON.stringify(rooms0), T('+ New → Cancel: no room added'));
      await editOn(page, mobile); await tapEl(page, '#rt-tabs .rt-new', mobile); await page.waitForSelector('.rt-ov');
      await page.keyboard.press('Escape'); await sleep(200);
      check(!(await page.$('.rt-ov')), T('+ New → Esc closes'));
      await editOn(page, mobile); await tapEl(page, '#rt-tabs .rt-new', mobile); await page.waitForSelector('.rt-ov');
      await page.mouse.click(5, 5); await sleep(200);
      check(!(await page.$('.rt-ov')), T('+ New → backdrop closes'));
      // buy fails → nothing added, message shown
      fake.buy = { ok: false, error: 'INSUFFICIENT_NYANG', current: 880 };
      await editOn(page, mobile); await tapEl(page, '#rt-tabs .rt-new', mobile); await page.waitForSelector('.rt-ov');
      const addBtn = await page.$('.rt-sheet [data-sact="add"]');
      if (addBtn && !(await addBtn.isDisabled())) {
        await tapEl(page, addBtn, mobile); await sleep(800);
        check(JSON.stringify(await page.evaluate(() => khAvatar.allRooms())) === JSON.stringify(rooms0) && /Not enough nyang/.test(await lastToast(page)), T('Add room, buy refused: no room, "Not enough nyang"'), await lastToast(page));
        const stillOpen = await page.$('.rt-ov');
        check(!!stillOpen && !(await page.$eval('.rt-sheet [data-sact="add"]', (b) => b.disabled)), T('Add room, buy refused: sheet stays, button usable again'));
        if (stillOpen) { await tapEl(page, '.rt-sheet [data-sact="cancel"]', mobile); await sleep(150); }
      } else fail(T('Add room button enabled with 880 nyang'));
      check(fake.blocked.some((b) => /room_slot_2/.test(b)), T('Add room asks buy_room_item for room_slot_2'), fake.blocked.slice(-3));

      // buy ok (faked) + the server now allows 2 rooms (faked) → room 2 added
      fake.buy = { ok: true, nyang_balance: 280 };
      fake.slots = { ok: true, premium: false, allowed: 2, max: 3, next: { slot: 3, price: 1000, premium_only: false, locked: false } };
      await editOn(page, mobile); await tapEl(page, '#rt-tabs .rt-new', mobile); await page.waitForSelector('.rt-ov');
      await page.fill('.rt-sheet .rt-in', 'QA Room 2');
      await tapEl(page, '.rt-sheet .rt-th1[data-pick="classroom"]', mobile);
      await tapEl(page, '.rt-sheet [data-sact="add"]', mobile); await sleep(1200);
      const rooms1 = await page.evaluate(() => ({ all: khAvatar.allRooms(), cur: khAvatar.currentRoom(), tabs: Array.prototype.map.call(document.querySelectorAll('#rt-tabs .rt-tab[data-room]'), function (b) { return b.textContent.trim(); }), cap: document.getElementById('rt-cap').textContent }));
      check(rooms1.all.length === 2 && rooms1.cur.name === 'QA Room 2' && rooms1.cur.theme === 'classroom' && rooms1.tabs.length === 2, T('Add room (bought): room 2 added with name + background and opened'), rooms1);
      check(/Room 2 of 2/.test(rooms1.cap) && /0 items/.test(rooms1.cap), T('caption: "QA Room 2 · 0 items · Room 2 of 2"'), rooms1.cap);
      check(await page.evaluate(() => document.querySelectorAll('.room-placed-item').length === 0), T('new room starts empty'));
      await roomShot(page, kind + '-08-room2');
      // all items of room 1 still exist
      check(await page.evaluate((n) => _getRoomLayoutAll().length === n, lay0.length), T('adding a room keeps room 1 items'));

      // Edit mode tray: move an item from room 1 into room 2
      await editOn(page, mobile);
      await tapEl(page, '#room-items-btn', mobile); await sleep(300);   // My items opens the inline panel (2026-10-31)
      const tray = await page.$$eval('#rt-tray .rt-ti', (els) => els.map((e) => ({ id: e.dataset.item, lab: (e.querySelector('.rt-tl') || e).textContent.trim() })));
      check(tray.length > 0 && tray.every((t) => /^In |Place|In room/.test(t.lab)), T('My items panel lists your items with where they are'), tray.slice(0, 4));
      check(!(await page.$('.room-shop-overlay')), T('My items: no pop-up, the panel opens under the room'));
      const mv = tray.find((t) => /^In /.test(t.lab));
      if (mv) {
        await tapEl(page, '#rt-tray .rt-ti[data-item="' + mv.id + '"]', mobile); await sleep(400);
        check(await page.evaluate((i) => isItemPlaced(i) && !!document.querySelector('.room-placed-item[data-item-id="' + i + '"]'), mv.id), T('tray: tapping "In My Room" item moves it here'));
        check(await page.evaluate((i) => _getRoomLayoutAll().filter(function (e) { return e.id === i; }).length === 1, mv.id), T('tray: moved item is in one room only'));
      }
      // room 1 must keep at least one item for the checks below
      check(await page.evaluate(() => _getRoomLayoutAll().some(function (e) { return !e.room; })), T('room 1 still has items after moving one out'));
      // THE drift / data-loss check in room 2: Front / Back / Flip must not touch room 1
      const allBefore = await page.evaluate(() => _getRoomLayoutAll());
      const r1Before = allBefore.filter((e) => !e.room);
      const inRoom2 = await page.evaluate(() => getRoomLayout().map(function (e) { return e.id; }));
      if (inRoom2.length) {
        await selectItem(page, inRoom2[0], mobile, cdp);
        for (const b of ['moveSelectedLayer(1)', 'moveSelectedLayer(-1)', 'flipSelectedItem()', 'flipSelectedItem()']) await tapEl(page, 'button[onclick="' + b + '"]', mobile);
        const allAfter = await page.evaluate(() => _getRoomLayoutAll());
        const r1After = allAfter.filter((e) => !e.room);
        check(r1After.length === r1Before.length && !posDiff(r1Before, r1After).length, T('room 2: Front/Back/Flip keep every room 1 item'), { before: r1Before.map((e) => e.id), after: r1After.map((e) => e.id) });
        check(allAfter.length === allBefore.length, T('room 2: Front/Back/Flip keep the total item count'), { before: allBefore.length, after: allAfter.length });
        await dragItem(page, inRoom2[0], 30, 20, mobile, cdp);
        const allDrag = await page.evaluate(() => _getRoomLayoutAll());
        check(allDrag.length === allBefore.length && !posDiff(r1Before, allDrag.filter((e) => !e.room)).length, T('room 2: dragging keeps room 1 intact'));
      } else fail(T('room 2 has an item to test with'));
      await editOff(page, mobile);
      await waitSynced(page);

      // Switch tabs; items follow their room
      await tapEl(page, '#rt-tabs .rt-tab[data-room="main"]', mobile); await sleep(400);
      const back1 = await page.evaluate(() => ({ cur: khAvatar.currentRoom().id, n: document.querySelectorAll('.room-placed-item').length, view: getRoomLayout().length }));
      check(back1.cur === 'main' && back1.n === back1.view, T('switch back to room 1: its items drawn'), back1);
      // switch while editing with an item selected → selection + controls reset
      await editOn(page, mobile);
      const firstR1 = await page.evaluate(() => getRoomLayout()[0] && getRoomLayout()[0].id);
      if (firstR1) await selectItem(page, firstR1, mobile, cdp);
      const r2id = rooms1.cur.id;
      await tapEl(page, '#rt-tabs .rt-tab[data-room="' + r2id + '"]', mobile); await sleep(300);
      { const st = await page.evaluate(() => ({ sel: _selectedRoomItemId, ctl: document.getElementById('room-sel-controls').offsetParent !== null, rm: document.getElementById('room-remove-btn').offsetParent !== null, hl: document.querySelectorAll('.room-placed-item.room-selected').length }));
        check(!st.sel && !st.ctl && !st.rm && !st.hl, T('switch room mid-edit: no stale selection or Remove button'), st); }
      await editOff(page, mobile);
      // reload: room 2 + its items persist
      await openMyPage(page);
      const rl = await page.evaluate(() => ({ rooms: khAvatar.allRooms().map(function (r) { return r.name; }), all: _getRoomLayoutAll().length }));
      check(rl.rooms.length === 2 && rl.rooms[1] === 'QA Room 2' && rl.all === allBefore.length, T('reload: room 2 and every item persist'), rl);

      // Room settings: tap the open tab
      const curTab = async () => page.$('#rt-tabs .rt-tab.on');
      await tapEl(page, await curTab(), mobile);
      await page.waitForSelector('.rt-ov .rt-sheet');
      check(/Room settings/.test(await page.textContent('.rt-sheet')), T('tap open tab: Room settings'));
      const curRoom0 = await page.evaluate(() => khAvatar.currentRoom());
      await page.fill('.rt-sheet .rt-in', 'Should not stick');
      await tapEl(page, '.rt-sheet .rt-th1[data-pick="default"]', mobile);
      await tapEl(page, '.rt-sheet [data-sact="cancel"]', mobile); await sleep(200);
      check(JSON.stringify(await page.evaluate(() => khAvatar.currentRoom())) === JSON.stringify(curRoom0), T('Room settings → Cancel after changes: nothing changes'));
      for (const how of ['esc', 'backdrop']) {
        await tapEl(page, await curTab(), mobile); await page.waitForSelector('.rt-ov');
        await page.fill('.rt-sheet .rt-in', 'Nope ' + how);
        if (how === 'esc') await page.keyboard.press('Escape'); else await page.mouse.click(5, 5);
        await sleep(200);
        check(!(await page.$('.rt-ov')) && JSON.stringify(await page.evaluate(() => khAvatar.currentRoom())) === JSON.stringify(curRoom0), T('Room settings → ' + how + ': closes, nothing changes'));
      }
      await tapEl(page, await curTab(), mobile); await page.waitForSelector('.rt-ov');
      await page.fill('.rt-sheet .rt-in', 'Renamed QA');
      await tapEl(page, '.rt-sheet .rt-th1[data-pick="default"]', mobile);
      await tapEl(page, '.rt-sheet [data-sact="save"]', mobile); await sleep(300);
      const saved = await page.evaluate(() => ({ cur: khAvatar.currentRoom(), tab: document.querySelector('#rt-tabs .rt-tab.on').textContent.trim(), bg: document.getElementById('miniroom-container').style.background }));
      check(saved.cur.name === 'Renamed QA' && saved.cur.theme === 'default' && saved.tab === 'Renamed QA' && /themes\/default/.test(saved.bg), T('Room settings → Save: name + background applied'), saved);
      // empty name → falls back to a default name, not blank
      await tapEl(page, await curTab(), mobile); await page.waitForSelector('.rt-ov');
      await page.fill('.rt-sheet .rt-in', '   ');
      await tapEl(page, '.rt-sheet [data-sact="save"]', mobile); await sleep(300);
      const blank = await page.evaluate(() => khAvatar.currentRoom().name);
      check(blank && blank.trim().length > 0, T('Room settings: blank name falls back to a default'), blank);
      // locked background → opens Customize on the Room tab
      await tapEl(page, await curTab(), mobile); await page.waitForSelector('.rt-ov');
      const locked = await page.$('.rt-sheet .rt-th1[data-locked]');
      if (locked) {
        await tapEl(page, locked, mobile); await sleep(500);
        check(!!(await page.$('.kav-ov')) && /room/i.test(await page.evaluate(() => (document.querySelector('.kav-tabs .on') || {}).textContent || '')), T('locked background: opens Customize → Room'));
        await page.keyboard.press('Escape'); await sleep(200);
        check(!(await page.$('.kav-ov')), T('Customize: Esc closes'));
      } else { await page.keyboard.press('Escape'); }
      // the paid sheet says "Room 3 of 3 · 1,000 nyang"
      await editOn(page, mobile); await tapEl(page, '#rt-tabs .rt-new', mobile); await page.waitForSelector('.rt-ov');
      check(/1,000 nyang/.test(await page.textContent('.rt-sheet')) && /Room 3 of 3/.test(await page.textContent('.rt-sheet')), T('+ New with 2 rooms: Room 3 of 3, 1,000 nyang'), (await page.textContent('.rt-sheet')).slice(0, 160));
      // locked background in the Add-a-room sheet: stays in the sheet and points at the hint
      const lockedNew = await page.$('.rt-sheet .rt-th1[data-locked]');
      if (lockedNew) {
        await tapEl(page, lockedNew, mobile); await sleep(300);
        check(!!(await page.$('.rt-ov')) && !(await page.$('.kav-ov')) && !!(await page.$('.rt-hint.rt-hint-on')), T('+ New: locked background keeps the sheet open and shows the hint'));
      }
      await page.keyboard.press('Escape');
      fake.slots = null;
      await noEmoji(page, '#mp-miniroom-section', T('room section with tabs'));
      // back to room 1 for the next sections
      await tapEl(page, '#rt-tabs .rt-tab[data-room="main"]', mobile); await sleep(300);
      await editOff(page, mobile);
    }

    // ── Customize ──
    if (want('custom')) {
      await page.evaluate(() => document.getElementById('mp-miniroom-section').scrollIntoView());
      const av0 = await page.evaluate(() => khAvatar.getAvatar());
      const lay0 = await page.evaluate(() => _getRoomLayoutAll());
      await editOn(page, mobile); await tapEl(page, '#room-customize-btn', mobile);
      await page.waitForSelector('.kav-ov .kav', { timeout: 8000 });
      await sleep(800);
      await shot(page, kind + '-09-customize');
      const kv = await page.evaluate(() => { var r = document.querySelector('.kav').getBoundingClientRect(); return { w: r.width, sw: document.documentElement.scrollWidth, vw: innerWidth }; });
      check(kv.sw <= kv.vw + 1, T('Customize: no sideways scroll'), kv);
      // Look: every hair, every outfit
      const hairs = await page.$$eval('.kav-panel [data-act="hair"]', (e) => e.map((x) => x.dataset.id));
      check(hairs.length === 4, T('Look: 4 hair styles'), hairs);
      for (const h of hairs) {
        await tapEl(page, '.kav-panel [data-act="hair"][data-id="' + h + '"]', mobile); await sleep(120);
        const on = await page.$eval('.kav-panel [data-act="hair"][data-id="' + h + '"]', (b) => b.classList.contains('on'));
        check(on, T('hair ' + h + ': selected'));
      }
      await sleep(500);
      const outfits = await page.$$eval('.kav-panel [data-act="outfit"]', (e) => e.map((x) => ({ id: x.dataset.id, locked: x.classList.contains('locked'), badge: (x.querySelector('.kav-b') || {}).textContent || '' })));
      check(outfits.length === 20, T('Look: 20 outfits'), outfits.length);
      let srcPrev = '';
      for (const o of outfits) {
        await tapEl(page, '.kav-panel [data-act="outfit"][data-id="' + o.id + '"]', mobile); await sleep(350);
        const st = await page.evaluate((id) => ({ on: document.querySelector('.kav-panel [data-act="outfit"][data-id="' + id + '"]').classList.contains('on'), save: document.getElementById(innerWidth > 760 ? 'kav-save-d' : 'kav-save-m').textContent, src: (document.getElementById('kav-char') || {}).src || '' }), o.id);
        const exp = o.locked ? /Save/ : /^Save$/;
        check(st.on && exp.test(st.save.trim()), T('outfit ' + o.id + ': selected, Save label "' + st.save.trim() + '"'));
        if (o.locked && /^[\d,]+$/.test(o.badge.trim())) check(st.save.replace(/\D/g, '') === o.badge.replace(/\D/g, ''), T('outfit ' + o.id + ': Save shows its price ' + o.badge.trim()), st.save);
        const ok = await page.evaluate(() => new Promise((res) => { var im = document.getElementById('kav-char'); if (!im) return res(false); if (im.complete) return res(im.naturalWidth > 0); im.onload = () => res(true); im.onerror = () => res(false); setTimeout(() => res(im.naturalWidth > 0), 4000); }));
        check(ok, T('outfit ' + o.id + ': picture loads'), st.src);
        srcPrev = st.src;
      }
      // Accessories
      await tapEl(page, '.kav-tabs [data-tab="acc"]', mobile); await sleep(200);
      await tapEl(page, '.kav-tabs [data-tab="look"]', mobile); await sleep(150);
      await tapEl(page, '.kav-panel [data-act="outfit"][data-id="tee"]', mobile); await sleep(150);
      await tapEl(page, '.kav-tabs [data-tab="acc"]', mobile); await sleep(200);
      const accs = await page.$$eval('.kav-panel [data-act="acc"]', (e) => e.map((x) => x.dataset.id));
      check(accs.length === 10, T('Accessories: 10 items'), accs.length);
      for (const a of accs) {
        await tapEl(page, '.kav-panel [data-act="acc"][data-id="' + a + '"]', mobile); await sleep(120);
        check(await page.$eval('.kav-panel [data-act="acc"][data-id="' + a + '"]', (b) => b.classList.contains('on')), T('accessory ' + a + ': worn'));
      }
      const worn = await page.$$eval('.kav-panel [data-act="acc"].on', (e) => e.map((x) => x.dataset.id));
      check(worn.length === 4, T('Accessories: one per slot (4 slots)'), worn);
      await tapEl(page, '.kav-panel [data-act="acc"][data-id="' + worn[0] + '"]', mobile); await sleep(120);
      check(!(await page.$eval('.kav-panel [data-act="acc"][data-id="' + worn[0] + '"]', (b) => b.classList.contains('on'))), T('accessory: tap again takes it off'));
      for (const slot of ['top', 'pinr', 'pinl', 'face']) { await tapEl(page, '.kav-panel [data-act="acc-none"][data-slot="' + slot + '"]', mobile); await sleep(80); }
      check((await page.$$('.kav-panel [data-act="acc"].on')).length === 0, T('accessory "None" x4: nothing worn'));
      // Room tab
      await tapEl(page, '.kav-tabs [data-tab="room"]', mobile); await sleep(200);
      const rtiles = await page.$$eval('.kav-panel [data-act="room"]', (e) => e.map((x) => x.dataset.id));
      check(rtiles.length === 8, T('Customize Room: 8 backgrounds'), rtiles);
      await tapEl(page, '.kav-panel [data-act="room"][data-id="cafe"]', mobile); await sleep(250);
      check(await page.evaluate(() => /themes\/cafe/.test(document.getElementById('kav-room-v').style.background)), T('Customize Room: preview shows Cafe'));
      // Reset → back to saved look
      await tapEl(page, mobile ? '.kav-foot .kav-reset' : '.kav-h .kav-reset-d', mobile); await sleep(300);
      const afterReset = await page.evaluate(() => ({ save: document.getElementById(innerWidth > 760 ? 'kav-save-d' : 'kav-save-m').textContent.trim() }));
      check(afterReset.save === 'Save', T('Reset: back to your saved look (nothing locked worn)'), afterReset);
      // back button → nothing saved
      await tapEl(page, '.kav-panel [data-act="room"][data-id="cafe"]', mobile);
      await tapEl(page, '.kav-h .kav-back', mobile); await sleep(300);
      check(!(await page.$('.kav-ov')) && JSON.stringify(await page.evaluate(() => khAvatar.getAvatar())) === JSON.stringify(av0) && JSON.stringify(await page.evaluate(() => _getRoomLayoutAll())) === JSON.stringify(lay0), T('back button: closes, nothing saved'));
      check(await page.evaluate(() => !document.documentElement.classList.contains('kav-lock')), T('Customize closed: page scroll unlocked'));

      // Save dialog with a locked outfit + locked background
      await editOn(page, mobile); await tapEl(page, '#room-customize-btn', mobile); await page.waitForSelector('.kav-ov .kav'); await sleep(600);
      const buyable = outfits.find((o) => o.locked && /^[\d,]+$/.test(o.badge.trim()));
      await tapEl(page, '.kav-panel [data-act="outfit"][data-id="' + buyable.id + '"]', mobile); await sleep(200);
      await tapEl(page, '.kav-tabs [data-tab="room"]', mobile); await sleep(150);
      await tapEl(page, '.kav-panel [data-act="room"][data-id="cafe"]', mobile); await sleep(150);
      const saveSel = mobile ? '#kav-save-m' : '#kav-save-d';
      await tapEl(page, saveSel, mobile); await sleep(300);
      const dlg = await page.evaluate(() => { var d = document.getElementById('kav-dlg'); return { open: !d.hidden, txt: d.textContent, btns: Array.prototype.map.call(d.querySelectorAll('button'), function (b) { return b.textContent.trim() + (b.disabled ? ' [disabled]' : ''); }) }; });
      check(dlg.open && dlg.btns.length === 3, T('Save with locked items: dialog with 3 choices'), dlg.btns);
      await shot(page, kind + '-10-save-dialog');
      // Keep trying → dialog closes, editor stays, nothing saved
      await tapEl(page, '#kav-dlg [data-act="dlg-cancel"]', mobile); await sleep(200);
      check(await page.evaluate(() => document.getElementById('kav-dlg').hidden) && !!(await page.$('.kav-ov')) && JSON.stringify(await page.evaluate(() => khAvatar.getAvatar())) === JSON.stringify(av0), T('Keep trying: dialog closes, nothing saved'));
      // Esc on dialog closes only the dialog
      await tapEl(page, saveSel, mobile); await sleep(200);
      await page.keyboard.press('Escape'); await sleep(200);
      check(await page.evaluate(() => document.getElementById('kav-dlg').hidden) && !!(await page.$('.kav-ov')), T('Esc on the save dialog closes only the dialog'));
      // Buy & save → buy refused (fake) → nothing saved
      check(/need [\d,]+ more/.test(dlg.txt) === dlg.btns.some((b) => /disabled/.test(b)), T('save dialog: Buy disabled exactly when short of nyang'), dlg);
      // only the outfit locked (affordable) → Buy & save enabled
      await tapEl(page, '.kav-panel [data-act="room"][data-id="classic"]', mobile); await sleep(150);
      fake.buy = { ok: false, error: 'INSUFFICIENT_NYANG', current: 880 };
      await tapEl(page, saveSel, mobile); await sleep(200);
      const buyBtn = await page.$('#kav-dlg [data-act="dlg-buy"]');
      if (buyBtn && !(await buyBtn.isDisabled())) {
        await tapEl(page, buyBtn, mobile); await sleep(800);
        check(JSON.stringify(await page.evaluate(() => khAvatar.getAvatar())) === JSON.stringify(av0) && /Not enough nyang/.test(await lastToast(page)), T('Buy & save, purchase refused: nothing saved, message'), await lastToast(page));
        check(!(await page.$eval(saveSel, (b) => b.disabled)), T('after a refused purchase Save works again'));
      } else fail(T('Buy & save enabled for an affordable outfit'), await page.evaluate(() => document.getElementById('kav-dlg').textContent));
      if (await page.$('#kav-dlg:not([hidden])')) await tapEl(page, '#kav-dlg [data-act="dlg-cancel"]', mobile);
      // Save without them → saves the free parts, locked ones dropped
      await tapEl(page, '.kav-panel [data-act="room"][data-id="cafe"]', mobile); await sleep(150);
      await tapEl(page, saveSel, mobile); await sleep(200);
      await tapEl(page, '#kav-dlg [data-act="dlg-strip"]', mobile); await sleep(1200);
      const avS = await page.evaluate(() => ({ av: khAvatar.getAvatar(), theme: khAvatar.getRoomTheme(), open: !!document.querySelector('.kav-ov'), placed: isItemPlaced(khAvatar.AV_ID), drawn: !!document.querySelector('.room-placed-item[data-item-id="kh_avatar"]') }));
      check(!avS.open && avS.av && avS.av.outfit !== buyable.id && avS.theme !== 'cafe', T('Save without them: saved without the locked outfit / background'), avS);
      check(avS.placed, T('first save: your character stands in the room'), avS);
      await sleep(1500);
      check(await page.evaluate(() => !!document.querySelector('.room-placed-item[data-item-id="kh_avatar"]')), T('character is drawn in the room'));
      await waitSynced(page);
      // Profile picture toggle
      await editOn(page, mobile); await tapEl(page, '#room-customize-btn', mobile); await page.waitForSelector('.kav-ov .kav'); await sleep(500);
      await page.evaluate(() => document.getElementById('kav-ptog').scrollIntoView());
      await page.click('.kav-prof', { force: true }).catch(async () => { await page.check('#kav-ptog', { force: true }); });
      check(await page.$eval('#kav-ptog', (t) => t.checked), T('profile picture toggle: turns on'));
      await tapEl(page, saveSel, mobile); await sleep(1200);
      check(await page.evaluate(() => khAvatar.getAvatar().profile === true && !!document.querySelector('.mp-avatar-wrap img.kh-av-face')), T('profile picture on: hero shows the character face'));
      // Buy & save success path (faked) → saved + owned
      await editOn(page, mobile); await tapEl(page, '#room-customize-btn', mobile); await page.waitForSelector('.kav-ov .kav'); await sleep(500);
      await tapEl(page, '.kav-panel [data-act="outfit"][data-id="' + buyable.id + '"]', mobile); await sleep(200);
      fake.buy = { ok: true, nyang_balance: 500 };
      await tapEl(page, saveSel, mobile); await sleep(200);
      await tapEl(page, '#kav-dlg [data-act="dlg-buy"]', mobile); await sleep(1500);
      const avB = await page.evaluate(() => ({ av: khAvatar.getAvatar(), open: !!document.querySelector('.kav-ov') }));
      check(!avB.open && avB.av.outfit === buyable.id, T('Buy & save (purchase ok): saved with the bought outfit'), avB);
      check(fake.blocked.some((b) => b.includes('av_outfit_' + buyable.id)), T('Buy & save asks buy_room_item for av_outfit_' + buyable.id));
      // profile toggle off again, without buying anything
      await editOn(page, mobile); await tapEl(page, '#room-customize-btn', mobile); await page.waitForSelector('.kav-ov .kav'); await sleep(400);
      await page.click('.kav-prof', { force: true });
      await tapEl(page, '.kav-tabs [data-tab="look"]', mobile);
      await tapEl(page, saveSel, mobile); await sleep(800);
      if (await page.$('#kav-dlg:not([hidden])')) await tapEl(page, '#kav-dlg [data-act="dlg-strip"]', mobile);
      await sleep(800);
      check(await page.evaluate(() => khAvatar.getAvatar().profile === false && !document.querySelector('.mp-avatar-wrap img.kh-av-face')), T('profile picture off: photo / initials come back'));
      await waitSynced(page);
      await openMyPage(page);
      check(await page.evaluate(() => !!khAvatar.getAvatar() && isItemPlaced(khAvatar.AV_ID)), T('reload: character persists'));
      await noEmoji(page, 'body', T('My Page'));
    }

    check(!errs.length, T('no JS errors on My Page'), errs.slice(0, 5));
    console.log('# ' + kind + ' blocked writes: ' + [...new Set(fake.blocked.map((b) => b.replace(/ \{.*$/, '')))].join(' | '));
    await ctx.close();

    // restore between desktop and mobile so each starts from the same room
    await restore();
  }

  // ── Shop page ──
  if (want('shop')) for (const kind of KINDS) {
    const mobile = kind === 'mobile';
    const fake = makeFake();
    const ctx = await newCtx(kind, fake);
    const page = await ctx.newPage();
    const errs = watch(page, 'shop ' + kind);
    const T = (n) => kind + ' shop ' + n;
    await page.goto(BASE + '/korehan-shop.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('#shop-grid .sh-tile').length > 5, null, { timeout: 30000 });
    await page.waitForFunction(() => document.getElementById('shop-coin').textContent !== '—', null, { timeout: 15000 }).catch(() => {});
    await sleep(1500);
    await hookToasts(page);
    await page.evaluate(() => { var b = document.getElementById('kh-cookie-banner'); if (b) b.remove(); });
    await shot(page, kind + '-11-shop');
    const coin = Number((await page.textContent('#shop-coin')).replace(/\D/g, ''));
    check(coin > 0, T('balance shown'), coin);
    for (const tab of ['profile', 'gifts', 'boosts', 'room']) {
      await tapEl(page, '.shop-tab[data-tab="' + tab + '"]', mobile); await sleep(250);
      const st = await page.evaluate((t) => ({ on: document.querySelector('.shop-tab.active').dataset.tab === t, n: document.getElementById('shop-grid').children.length }), tab);
      check(st.on && st.n > 0, T('tab ' + tab + ': opens with content'), st);
    }
    const sw = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    check(sw, T('no sideways scroll'));
    // tiles: price labels
    const tiles = await page.$$eval('#shop-grid .sh-tile', (els) => els.map((e) => ({ id: (e.getAttribute('onclick') || '').replace(/.*'room','([^']+)'.*/, '$1'), own: !!e.querySelector('.sh-own'), price: (e.querySelector('small') || {}).textContent })));
    const notOwned = tiles.filter((t) => !t.own && /^\d/.test(t.price || ''));
    const cheap = notOwned.find((t) => Number(t.price.replace(/\D/g, '')) <= coin);
    const dear = notOwned.find((t) => Number(t.price.replace(/\D/g, '')) > coin);
    if (cheap) {
      await tapEl(page, '#shop-grid .sh-tile[onclick*="\'' + cheap.id + '\'"]', mobile); await sleep(300);
      const sh = await page.evaluate(() => ({ txt: document.querySelector('.sh-sheet').textContent, buy: document.querySelector('.sh-sheet .sh-buy').textContent }));
      const p = Number(cheap.price.replace(/\D/g, ''));
      check(sh.buy.includes(p.toLocaleString()) && sh.txt.includes((coin - p).toLocaleString()), T('item sheet: price + balance after (' + cheap.id + ')'), sh);
      await shot(page, kind + '-12-shop-sheet');
      await tapEl(page, '.sh-sheet .sh-cancel', mobile); await sleep(200);
      check(!(await page.$('#sh-ov')), T('item sheet: Not now closes'));
      await tapEl(page, '#shop-grid .sh-tile[onclick*="\'' + cheap.id + '\'"]', mobile); await sleep(300);
      await page.mouse.click(5, 5); await sleep(200);
      check(!(await page.$('#sh-ov')), T('item sheet: backdrop closes'));
      await tapEl(page, '#shop-grid .sh-tile[onclick*="\'' + cheap.id + '\'"]', mobile); await sleep(300);
      await page.keyboard.press('Escape'); await sleep(200);
      check(!(await page.$('#sh-ov')), T('item sheet: Esc closes'));
      if (await page.$('#sh-ov')) await page.evaluate(() => shopClose());
      // buy refused (fake)
      fake.buy = { ok: false, error: 'INSUFFICIENT_NYANG', required: p, current: coin };
      await tapEl(page, '#shop-grid .sh-tile[onclick*="\'' + cheap.id + '\'"]', mobile); await sleep(300);
      await tapEl(page, '.sh-sheet .sh-buy', mobile); await sleep(800);
      const t1 = await lastToast(page);
      check(/Not enough nyang/.test(t1) && !/undefined/.test(t1), T('buy refused: clear message'), t1);
      check(Number((await page.textContent('#shop-coin')).replace(/\D/g, '')) === coin, T('buy refused: balance unchanged'));
      // buy ok (fake)
      fake.buy = { ok: true, nyang_balance: coin - p };
      await tapEl(page, '#shop-grid .sh-tile[onclick*="\'' + cheap.id + '\'"]', mobile); await sleep(300);
      await tapEl(page, '.sh-sheet .sh-buy', mobile); await sleep(900);
      const bought = await page.evaluate(() => ({ sheet: (document.querySelector('.sh-sheet') || {}).textContent || '', coin: document.getElementById('shop-coin').textContent }));
      check(/is yours/.test(bought.sheet) && /Place it now/.test(bought.sheet), T('buy ok: "is yours" sheet with Place it now'), bought);
      await tapEl(page, '.sh-sheet .sh-cancel', mobile); await sleep(200);
    } else fail(T('a buyable item to test'));
    if (dear) {
      await tapEl(page, '#shop-grid .sh-tile[onclick*="\'' + dear.id + '\'"]', mobile); await sleep(300);
      const b = await page.$eval('.sh-sheet .sh-buy', (x) => ({ t: x.textContent, d: x.disabled }));
      check(b.d && /Need/.test(b.t), T('too expensive: "Need N more nyang", disabled'), b);
      await page.evaluate(() => shopClose());
    }
    // owned item → Go to My Room (?place=)
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => document.querySelectorAll('#shop-grid .sh-tile').length > 5, null, { timeout: 30000 }); await sleep(2000);
    const owned = await page.$$eval('#shop-grid .sh-tile', (els) => els.filter((e) => e.querySelector('.sh-own')).map((e) => (e.getAttribute('onclick') || '').replace(/.*'room','([^']+)'.*/, '$1')));
    if (owned.length) {
      await tapEl(page, '#shop-grid .sh-tile[onclick*="\'' + owned[0] + '\'"]', mobile); await sleep(300);
      const ob = await page.$eval('.sh-sheet .sh-buy', (x) => ({ t: x.textContent, on: x.getAttribute('onclick') }));
      check(/Go to My Room/.test(ob.t) && ob.on.includes('place=' + owned[0]), T('owned item: "Owned · Go to My Room" with ?place='), ob);
      await page.evaluate(() => shopClose());
    }
    // How to earn
    await tapEl(page, '.sh-earn', mobile); await sleep(200);
    check(/How to earn/.test(await page.textContent('.sh-sheet')), T('How to earn opens'));
    await tapEl(page, '.sh-sheet .sh-cancel', mobile); await sleep(200);
    check(!(await page.$('#sh-ov')), T('How to earn closes'));
    await noEmoji(page, 'main', T('shop'));
    check(!errs.length, T('no JS errors'), errs.slice(0, 5));
    await ctx.close();
  }

  // Shop "Place it now" → My Page ?place= places an owned, unplaced item
  if (want('shop')) {
    const fake = makeFake();
    const ctx = await newCtx('mobile', fake);
    const page = await ctx.newPage();
    watch(page, 'place');
    await openMyPage(page);
    const cand = await page.evaluate(() => getRoomOwned().filter(function (id) { var d = getRoomItemDef(id); return d && !roomImgMissing(d) && !isItemPlaced(id) && d.id !== 'kh_avatar'; })[0]);
    if (cand) {
      await page.goto(BASE + '/korehan-mypage.html?place=' + cand, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction((c) => typeof isItemPlaced === 'function' && window.supaUser && isItemPlaced(c), cand, { timeout: 30000 }).catch(() => {});
      await sleep(800);
      check(await page.evaluate((c) => isItemPlaced(c) && !!document.querySelector('.room-placed-item[data-item-id="' + c + '"]') && !/place=/.test(location.search), cand), 'mobile shop "Place it now" (?place=' + cand + '): item placed, URL cleaned');
      await waitSynced(page);
    }
    await ctx.close();
    await restore();
  }

  // ── Public profile ──
  if (want('profile')) for (const kind of KINDS) {
    const mobile = kind === 'mobile';
    const fake = makeFake();
    const ctx = await newCtx(kind, fake);
    const page = await ctx.newPage();
    const errs = watch(page, 'profile ' + kind);
    const T = (n) => kind + ' profile ' + n;
    await page.goto(BASE + '/korehan-profile.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => { var h = document.getElementById('pf-room'); return h && !/Loading/.test(h.textContent); }, null, { timeout: 30000 }).catch(() => {});
    await sleep(1500);
    const own = await page.evaluate(() => ({ items: document.querySelectorAll('#pf-room .kh-rv-item').length, msg: (document.getElementById('pf-room') || {}).textContent }));
    const expect = SNAP.layout.filter((e) => !e.room).length;
    check(own.items > 0 && own.items <= expect, T('own room: placed items drawn (read-only)'), { own, expect });
    await shot(page, kind + '-13-profile');
    // Two rooms (faked get_public_room) → tabs; fast switching never mixes rooms
    const realRoom = await page.evaluate(async () => (await getSupa().rpc('get_public_room', { p_user: supaUser.id })).data);
    const lay = (realRoom && realRoom.layout) || [];
    const ownd = (realRoom && realRoom.owned) || [];
    fake.publicRoom = Object.assign({}, realRoom || {}, {
      owned: ownd.concat(['plant']),
      layout: lay.filter((e) => !e.room).concat([{ id: 'plant', x: 40, y: 200, scale: 100, room: 'rB' }]),
      prefs: Object.assign({}, (realRoom && realRoom.prefs) || {}, { rooms: [{ id: 'main', name: 'Living', theme: 'classic' }, { id: 'rB', name: 'Second', theme: 'classroom' }] })
    });
    // only plant in room B; main room has every non-room item except plant (it's moved)
    fake.publicRoom.layout = fake.publicRoom.layout.filter((e) => !(e.id === 'plant' && !e.room));
    // slow item catalogue, like a phone on a bad connection: room 1 is still loading when the tab is tapped
    await page.route(/\/rest\/v1\/room_items/, async (r) => { await sleep(1500); return r.continue(); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#pf-room-tabs button', { timeout: 30000 }).catch(() => {});
    await sleep(300);
    const tabsN = (await page.$$('#pf-room-tabs button')).length;
    check(tabsN === 2, T('two rooms: two room tabs'), tabsN);
    if (tabsN === 2) {
      // tap Second right away (while room 1 is still loading), then back and forth fast
      const btns = await page.$$('#pf-room-tabs button');
      for (const i of [1, 0, 1, 0, 1]) { await (mobile ? btns[i].tap() : btns[i].click()); await sleep(30); }
      await sleep(2500);
      const st = await page.evaluate(() => ({ on: Array.prototype.map.call(document.querySelectorAll('#pf-room-tabs button'), function (b) { return b.classList.contains('on'); }), items: Array.prototype.map.call(document.querySelectorAll('#pf-room .kh-rv-item'), function (e) { return e.title; }), bg: document.getElementById('pf-room').style.background }));
      check(st.on[1] && st.items.length === 1 && /themes\/classroom/.test(st.bg), T('fast tab switching ends on Second showing only its 1 item'), st);
      await (mobile ? btns[0].tap() : btns[0].click()); await sleep(1500);
      const st0 = await page.evaluate(() => ({ items: document.querySelectorAll('#pf-room .kh-rv-item').length, titles: Array.prototype.map.call(document.querySelectorAll('#pf-room .kh-rv-item'), function (e) { return e.title; }) }));
      check(!st0.titles.includes('Potted Plant') || st0.items >= 1, T('tab Living: shows its own items'), st0);
    }
    check(!errs.length, T('no JS errors'), errs.slice(0, 5));
    await ctx.close();
  }

  // ── Someone else's room: like / unlike (faked), via Friends search ──
  if (want('profile')) {
    const fake = makeFake();
    const ctx = await newCtx('mobile', fake);
    const page = await ctx.newPage();
    const errs = watch(page, 'visit');
    await page.goto(BASE + '/korehan-friends.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.supaUser && typeof getSupa === 'function', null, { timeout: 30000 });
    const other = await page.evaluate(async () => {
      var r = await getSupa().from('user_room_state').select('user_id').neq('user_id', supaUser.id).limit(1);
      if (r.data && r.data[0]) return r.data[0].user_id;
      var s = await getSupa().from('user_stats').select('user_id').neq('user_id', supaUser.id).not('display_name', 'is', null).limit(1);
      return s.data && s.data[0] && s.data[0].user_id;
    });
    if (other) {
      fake.likes = { count: 3, liked: false };
      await page.route(/\/rpc\/get_room_likes/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 3, liked: false }) }));
      await page.goto(BASE + '/korehan-profile.html?user=' + other, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => { var h = document.getElementById('pf-room'); return h && !/Loading/.test(h.textContent); }, null, { timeout: 30000 }).catch(() => {});
      await sleep(1200);
      await hookToasts(page);
      const like = await page.$('button[onclick*="khPfLike"]');
      if (like) {
        const t0 = (await like.textContent()).trim();
        await like.tap(); await sleep(600);
        const t1 = (await page.textContent('button[onclick*="khPfLike"]')).trim();
        await page.tap('button[onclick*="khPfLike"]'); await sleep(600);
        const t2 = (await page.textContent('button[onclick*="khPfLike"]')).trim();
        check(/Like room · 3/.test(t0) && /Liked · 4/.test(t1) && /Like room · 3/.test(t2), 'mobile visit: Like → Liked · 4 → Like room · 3', [t0, t1, t2]);
      } else console.log('# visit: no like button on ' + other.slice(0, 8) + ' (likes unavailable / blocked)');
      await shot(page, 'mobile-14-visit');
      check(!errs.length, 'mobile visit: no JS errors', errs.slice(0, 5));
    } else console.log('# visit: no other user found to visit');
    await ctx.close();
  }
} catch (e) {
  fail('script crashed', e && e.message && e.message.split('\n')[0]);
  console.log(String(e && e.stack).split('\n').filter((l) => /room\.mjs/.test(l)).slice(0, 3).join('\n'));
} finally {
  await restore().catch((e) => fail('restore crashed', e.message));
  await browser.close();
  console.log('\n' + passes + ' passed, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
}
