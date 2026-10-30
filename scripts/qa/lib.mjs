// Shared helpers for the click-through QA scripts (scripts/qa/*.mjs).
//
// Every script: node scripts/qa/<name>.mjs [BASE_URL]
//   BASE_URL defaults to http://localhost:8783 (python3 -m http.server 8783 --directory korehan)
//
// Production writes are BLOCKED: POST/PATCH/PUT/DELETE to /rest/v1/ are answered
// with a fake 204 (or a plausible JSON body for RPCs the UI reads back), except
// read-only RPCs. Every Edge Function except preview-login is aborted (no AI,
// TTS, billing or cache writes). /auth/v1/logout and user updates are faked so
// the shared QA accounts are never signed out elsewhere.
import pw from '/opt/node-tools/node_modules/playwright/index.js';
import { mkdirSync } from 'node:fs';

export const BASE = ((/^https?:/.test(process.argv[2] || '') && process.argv[2]) || process.env.QA_BASE || 'http://localhost:8783').replace(/\/$/, '');
export const SHOTS = process.env.QA_SHOTS || '/tmp/kh-qa-shots';
try { mkdirSync(SHOTS, { recursive: true }); } catch (_) {}

export const FREE = { email: 'enane960819+khqa@gmail.com', password: 'KhQaScroll!2026x' };
export const PREVIEW_TOKEN = 'hani1029';

const READ_ONLY_RPC = /\/rest\/v1\/rpc\/(kh_user_streak|get_[a-z0-9_]+|kh_my_[a-z0-9_]+|kh_is_premium|kh_has_live|kh_room_allowed)\b/;
// RPCs whose result the UI reads back: return something plausible.
const FAKE_RPC = {
  save_or_update_word: () => ({ id: 'qa-fake', ok: true }),
  log_quiz_result: () => null,
  log_read_event: () => null,
  toggle_bookmark: () => true,
};

export const results = { pass: 0, fail: 0, fails: [] };
export function pass(msg) { results.pass++; console.log('PASS ' + msg); }
export function fail(msg) { results.fail++; results.fails.push(msg); console.log('FAIL ' + msg); }
export function check(cond, msg, extra) { cond ? pass(msg) : fail(msg + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 300) : '')); return !!cond; }
export function info(msg) { console.log('     ' + msg); }

export const blocked = [];

export async function launch() { return pw.chromium.launch(); }

export async function newCtx(browser, { mobile = false, storageState, keepCookieBanner = false } = {}) {
  const opts = mobile
    ? { viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }
    : { viewport: { width: 1366, height: 900 } };
  if (storageState) opts.storageState = storageState;
  const ctx = await browser.newContext(opts);
  if (!keepCookieBanner) await ctx.addInitScript(() => { try { if (!localStorage.getItem('kh_cookie_consent')) localStorage.setItem('kh_cookie_consent', 'essential'); } catch (_) {} });
  await ctx.route('**/*', async (route) => {
    const req = route.request();
    const url = req.url();
    const m = req.method();
    if (/\/functions\/v1\//.test(url)) {
      if (/\/functions\/v1\/preview-login/.test(url)) return route.continue();
      blocked.push(m + ' ' + url.replace(/\?.*/, ''));
      return route.abort();
    }
    // Never create accounts or send reset / magic-link emails.
    if (/\/auth\/v1\/(signup|recover|otp|magiclink|resend)/.test(url)) {
      blocked.push(m + ' ' + url.replace(/\?.*/, ''));
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'qa_blocked', msg: 'QA: blocked', error_description: 'QA: blocked' }) });
    }
    if (/\/auth\/v1\/logout/.test(url) || (/\/auth\/v1\/user/.test(url) && m !== 'GET')) {
      blocked.push(m + ' ' + url.replace(/\?.*/, ''));
      return route.fulfill({ status: 204, body: '' });
    }
    if (/\/(rest|storage)\/v1\//.test(url) && m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') {
      if (READ_ONLY_RPC.test(url)) return route.continue();
      blocked.push(m + ' ' + url.replace(/\?.*/, ''));
      const rpc = (url.match(/\/rpc\/([a-z0-9_]+)/) || [])[1];
      if (rpc && FAKE_RPC[rpc]) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_RPC[rpc]()) });
      if (rpc) return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
      const wantsRep = /return=representation/.test(req.headers()['prefer'] || '');
      if (wantsRep) {
        let body = [];
        try { const j = req.postDataJSON(); body = Array.isArray(j) ? j : [j]; } catch (_) {}
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(body.map((r, i) => Object.assign({ id: 'qa-fake-' + i }, r))) });
      }
      return route.fulfill({ status: 204, body: '' });
    }
    return route.continue();
  });
  return ctx;
}

export function watch(page, label) {
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + String(e.message || e).slice(0, 240)));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const t = msg.text();
    // Aborted functions / blocked writes / fonts are expected noise.
    if (/net::ERR_FAILED|ERR_ABORTED|Failed to fetch|functions\/v1|fonts\.g|Failed to load resource|FunctionsFetchError|preview/i.test(t)) return;
    errs.push(t.slice(0, 240));
  });
  page.on('response', (r) => { if (r.status() >= 400 && !/functions\/v1|fonts\.g|tts-cache/.test(r.url())) errs.push('HTTP ' + r.status() + ' ' + r.request().method() + ' ' + r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 200)); });
  page.on('dialog', (d) => { errs.push('dialog: ' + d.message().slice(0, 120)); d.dismiss().catch(() => {}); });
  page._qaErrs = errs;
  page._qaLabel = label;
  return errs;
}

export async function go(page, path, { wait = 2500 } = {}) {
  await page.goto(BASE + '/' + path.replace(/^\//, ''), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  if (wait) await page.waitForTimeout(wait);
}

export async function shot(page, name) {
  const p = SHOTS + '/' + name + '.png';
  await page.screenshot({ path: p }).catch(() => {});
  return p;
}

// Emoji in the visible UI (owner rule: none). Returns offending snippets.
export async function findEmojis(page) {
  return page.evaluate(() => {
    const re = /(?![©®™↔-↙↩↪⌨⏏⏭-⏯▪▫▶◀◻-◾♠-♨♫☰])\p{Extended_Pictographic}/u;
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (!re.test(n.nodeValue)) continue;
      const el = n.parentElement;
      if (!el || el.closest('script,style,noscript')) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (!r.width || cs.display === 'none' || cs.visibility === 'hidden') continue;
      out.push(n.nodeValue.trim().slice(0, 60));
    }
    return out.slice(0, 10);
  });
}

// Anything wider than the viewport (horizontal page scroll at 390px).
export async function overflowX(page) {
  return page.evaluate(() => {
    const W = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    if (sw <= W + 1) return null;
    const bad = [];
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.right > W + 2 && r.width > 0 && getComputedStyle(el).position !== 'fixed') bad.push((el.id ? '#' + el.id : el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName) + ':' + Math.round(r.right));
    });
    return { sw, W, bad: bad.slice(0, 8) };
  });
}

export async function brokenImages(page) {
  return page.evaluate(() => Array.from(document.images)
    .filter((i) => i.complete && i.naturalWidth === 0 && i.getBoundingClientRect().width > 0 && i.src && !/^data:/.test(i.src))
    .map((i) => i.src.slice(0, 120)).slice(0, 8));
}

// Sign the Free QA account in once and return a storageState for reuse.
export async function freeState(browser) {
  const ctx = await newCtx(browser);
  const page = await ctx.newPage();
  await go(page, 'korehan-saved.html', { wait: 1500 });
  const r = await page.evaluate(async (c) => {
    const sb = getSupa();
    const { data, error } = await sb.auth.signInWithPassword(c);
    return error ? 'ERR ' + error.message : (data.user && data.user.email);
  }, FREE);
  if (!/@/.test(r || '')) throw new Error('free login failed: ' + r);
  const st = await ctx.storageState();
  await ctx.close();
  return st;
}

// Premium preview account via the preview-login Edge Function.
export async function premiumState(browser) {
  const ctx = await newCtx(browser);
  const page = await ctx.newPage();
  await go(page, 'korehan-saved.html', { wait: 1500 });
  // preview-login only allows the production origin (CORS), so call it from
  // Playwright's request context instead of the page.
  const keys = await page.evaluate(() => ({ url: SUPA_URL, key: SUPA_KEY }));
  const res = await page.request.post(keys.url + '/functions/v1/preview-login', {
    headers: { 'Content-Type': 'application/json', apikey: keys.key, Authorization: 'Bearer ' + keys.key },
    data: { token: PREVIEW_TOKEN } });
  const j = await res.json().catch(() => ({}));
  if (!j.access_token) throw new Error('preview login failed: ' + res.status() + ' ' + JSON.stringify(j).slice(0, 200));
  const r = await page.evaluate(async (j) => {
    const { data, error } = await getSupa().auth.setSession({ access_token: j.access_token, refresh_token: j.refresh_token });
    try { localStorage.setItem('kh_preview', '1'); } catch (_) {}
    return error ? 'ERR ' + error.message : data.user.email;
  }, j);
  if (!/@/.test(r || '')) throw new Error('preview login failed: ' + r);
  const st = await ctx.storageState();
  await ctx.close();
  return st;
}

export function reportErrs(page, label) {
  const e = page._qaErrs || [];
  check(e.length === 0, (label || page._qaLabel) + ': no console errors / dialogs', e.slice(0, 5));
  e.length = 0;
}

export function summary() {
  console.log('\n' + results.pass + ' passed, ' + results.fail + ' failed');
  if (results.fail) { console.log('Failures:'); results.fails.forEach((f) => console.log(' - ' + f)); }
  const uniq = Array.from(new Set(blocked));
  console.log('Blocked writes/functions (' + blocked.length + '): ' + uniq.slice(0, 30).join(', '));
  process.exitCode = results.fail ? 1 : 0;
}
