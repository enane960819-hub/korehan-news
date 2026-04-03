/* kh-core.js — Supabase client, Claude API, security helpers, localStorage */

// ── Supabase ──────────────────────────────────────────────────
const SUPA_URL = 'https://samghztrdvtxmrmawneu.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWdoenRyZHZ0eG1ybWF3bmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzQ3NTIsImV4cCI6MjA4ODAxMDc1Mn0.UCt6Z76XTmJGbhHdX744tM8BKDdVhqRiCLuQi6w-rNs';

// Supabase 클라이언트 (CDN 로드 후 초기화)
var _supa = null;
function getSupa() {
  if (_supa) return _supa;
  if (window.supabase) {
    _supa = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
      auth: {
        detectSessionInUrl: false,  // 수동 exchangeCodeForSession 사용 — auto와 충돌 방지
        persistSession: true,
        autoRefreshToken: true,
        flowType: 'pkce',
      }
    });
    return _supa;
  }
  return null;
}

// 현재 로그인 유저
var supaUser = null;

// ── Global difficulty filter ───────────────────────────────────
var _activeDiff = (function(){ try { return localStorage.getItem('kh_diff') || 'all'; } catch(e){ return 'all'; } })();
function khSetDiff(val) {
  _activeDiff = val || 'all';
  try { localStorage.setItem('kh_diff', _activeDiff); } catch(e) {}
  _syncPrefsToDB();
  // Update dot color
  var dot = document.getElementById('kh-diff-dot');
  if (dot) {
    dot.className = 'kh-diff-dot'
      + (_activeDiff === 'Starter' ? ' dot-starter'
      : _activeDiff === 'Beginner' ? ' dot-beginner'
      : _activeDiff === 'Intermediate' ? ' dot-intermediate'
      : _activeDiff === 'Advanced' ? ' dot-advanced' : '');
  }
  // Sync select value (in case called programmatically)
  var sel = document.getElementById('kh-diff-select');
  if (sel && sel.value !== _activeDiff) sel.value = _activeDiff;
  applyGlobalDiffFilter();
}
function applyGlobalDiffFilter() {
  // News cards
  document.querySelectorAll('#dyn-news-grid .nc').forEach(function(card) {
    var sectionBtn = document.querySelector('#news-pills .sp.on');
    var sectionFilter = sectionBtn ? sectionBtn.dataset.filter : 'all';
    var sectionMatch = sectionFilter === 'all' || card.dataset.section === sectionFilter;
    var diffMatch = _activeDiff === 'all' || card.dataset.level === _activeDiff;
    card.style.display = (sectionMatch && diffMatch) ? '' : 'none';
  });
  // Conversation cards
  document.querySelectorAll('.hconv-card').forEach(function(card) {
    var diffMatch = _activeDiff === 'all' || card.dataset.lvlLabel === _activeDiff;
    card.style.display = diffMatch ? '' : 'none';
  });
  // Story cards
  document.querySelectorAll('.story-card').forEach(function(card) {
    var diffMatch = _activeDiff === 'all' || card.dataset.level === _activeDiff;
    card.style.display = diffMatch ? '' : 'none';
  });
}
var KH_LUCIDE_SRC = 'https://cdn.jsdelivr.net/npm/lucide@0.468.0/dist/umd/lucide.min.js';
var _khLucideReady = null;

function ensureKhLucide() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    return Promise.resolve(window.lucide);
  }
  if (_khLucideReady) return _khLucideReady;
  _khLucideReady = new Promise(function(resolve, reject) {
    var existing = document.querySelector('script[data-kh-lucide="1"]');
    if (existing) {
      existing.addEventListener('load', function() { resolve(window.lucide); }, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    var script = document.createElement('script');
    script.src = KH_LUCIDE_SRC;
    script.defer = true;
    script.setAttribute('data-kh-lucide', '1');
    script.onload = function() { resolve(window.lucide); };
    script.onerror = reject;
    document.head.appendChild(script);
  }).catch(function(err) {
    console.warn('Lucide failed to load.', err);
    return null;
  });
  return _khLucideReady;
}

function renderKhLucideIcons() {
  ensureKhLucide().then(function(lucideLib) {
    if (!lucideLib || typeof lucideLib.createIcons !== 'function') return;
    lucideLib.createIcons({
      attrs: {
        'stroke-width': 1.9
      }
    });
  });
}

function khIcon(name, label, extraClass) {
  var cls = 'kh-ui-icon' + (extraClass ? ' ' + extraClass : '');
  var html = '<i data-lucide="' + name + '" class="' + cls + '" aria-hidden="true"></i>';
  if (!label) return html;
  return html + '<span>' + label + '</span>';
}

// ── Claude API 프록시 (키를 서버에서만 관리) ─────────────────
// Anthropic API를 직접 호출하지 않고 Supabase Edge Function을 통해 호출
// → API 키가 브라우저에 절대 노출되지 않음
const CLAUDE_PROXY_URL = SUPA_URL + '/functions/v1/claude-proxy';

async function callClaudeRequest(accessToken, payload) {
  return fetch(CLAUDE_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + accessToken,
      'apikey': SUPA_KEY,
    },
    body: JSON.stringify(payload),
  });
}

async function getFreshClaudeSession(sb, forceRefresh) {
  var sessionRes = await sb.auth.getSession();
  var session = sessionRes && sessionRes.data && sessionRes.data.session;
  var now = Math.floor(Date.now() / 1000);
  var expiresSoon = session && session.expires_at && session.expires_at <= now + 90;
  if (forceRefresh || !session || expiresSoon) {
    var refreshed = await sb.auth.refreshSession();
    session = refreshed && refreshed.data && refreshed.data.session;
  }
  return session || null;
}

async function callClaude({ feature, model, max_tokens, messages }) {
  var sb = getSupa();
  if (!sb) throw new Error('Supabase not initialized');

  var session = await getFreshClaudeSession(sb);
  if (!session) throw new Error('Please sign in to continue.');

  var payload = { feature, model, max_tokens, messages };
  var resp;
  try {
    resp = await callClaudeRequest(session.access_token, payload);
  } catch(netErr) {
    throw new Error('Network error — please check your internet connection.');
  }

  if (resp.status === 401) {
    var freshSession = await getFreshClaudeSession(sb, true);
    if (freshSession && freshSession.access_token) {
      try {
        resp = await callClaudeRequest(freshSession.access_token, payload);
      } catch(netErr2) {
        throw new Error('Network error — please check your internet connection.');
      }
    }
  }

  if (resp.status === 429) throw new Error('Too many requests. Please try again shortly.');
  if (resp.status === 401) {
    throw new Error('Authentication error — please sign in again.');
  }
  if (!resp.ok) {
    var err = await resp.json().catch(function(){ return {}; });
    throw new Error(err.error || 'AI server error (' + resp.status + ')');
  }
  return resp.json();
// ── Security helpers ─────────────────────────────────────────
function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function escapeAttr(str) {
  return escapeHTML(str).replace(/\\/g,'\\\\');
}
// Strip dangerous HTML (scripts, event handlers, iframes) but keep safe tags
function sanitizeHTML(html) {
  if (!html) return '';
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>/gi, '')
    .replace(/<link[\s\S]*?>/gi, '')
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\bon\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript\s*:/gi, 'blocked:')
    .replace(/data\s*:\s*text\/html/gi, 'blocked:');
}
function isValidImageURL(url) {
  if (!url || typeof url !== 'string') return false;
  try { var u = new URL(url); return u.protocol === 'https:' || u.protocol === 'http:'; }
  catch(e) { return false; }
}

// ── localStorage ──────────────────────────────────────────────
function lsGet(key, def) {
  try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch(e) { return def; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
}
