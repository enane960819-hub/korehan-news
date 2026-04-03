/* kh-phrases.js — Phrases, onboarding, app settings */

function normalizePhrase(row) {
  row = row || {};
  var examples = Array.isArray(row.examples) ? row.examples : [];
  if (!examples.length && row.example_ko) examples = [{ ko: row.example_ko || '', en: row.example_en || '' }];
  return {
    ko: row.ko || '',
    rom: row.rom || '',
    en: row.en || '',
    intro: row.intro || row.desc || row.description || '',
    nuance: row.nuance || row.note || '',
    examples: examples.slice(0, 6).map(function(ex){ return { ko: ex.ko || '', en: ex.en || '' }; }).filter(function(ex){ return ex.ko; }),
    related: Array.isArray(row.related) ? row.related.filter(Boolean).slice(0, 8) : []
  };
}
function getPhraseSourceRows() {
  var raw = lsGet(K_PHRASES, null);
  if (Array.isArray(raw)) return raw;

  raw = _appSettings && _appSettings.phrases;
  if (raw && typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch(e) { raw = null; }
  }
  if (Array.isArray(raw)) return raw;
  return DEF_PHRASES;
}
function getPhrases()   { return getPhraseSourceRows().map(normalizePhrase); }
function getTodaysPhraseIndex() {
  var phrases = getPhrases();
  if (!phrases.length) return 0;
  return Math.floor((Date.now() + 9*3600000) / 86400000) % phrases.length;
}
function getTodaysPhrase() {
  var phrases = getPhrases();
  return phrases[getTodaysPhraseIndex()] || normalizePhrase({});
}

async function getPhrasesAsync() {
  await loadAppSettings();
  return getPhrases();
}

async function saveSharedPhrases(rows) {
  var normalized = (rows || []).map(normalizePhrase).filter(function(row){ return row.ko; });
  if (!normalized.length) normalized = DEF_PHRASES.map(normalizePhrase);
  lsSet(K_PHRASES, normalized);
  _appSettings.phrases = normalized;

  var sb = getSupa();
  if (!sb || !supaUser) return normalized;
  try {
    await sb.from('app_settings').upsert({
      key: 'phrases',
      value: normalized,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });
  } catch(e) {}
  return normalized;
}

// ── 공유 데이터 ───────────────────────────────────────────────
function getWordBank()  { return lsGet(K_WORDBANK,  DEF_WORDBANK);  }
function getSentences() { return lsGet(K_SENTENCES, DEF_SENTENCES); }
function getOpinions()  { return lsGet(K_OPINIONS,  []);            }



function toast(msg, typeOrBool) {
  var bg = '#1a3a6b';
  if (typeOrBool === true || typeOrBool === 'error') bg = '#cc2200';
  else if (typeOrBool === 'warn')    bg = '#b45309';
  else if (typeOrBool === 'success') bg = '#15803d';
  var d = document.createElement('div');
  d.style.cssText = 'position:fixed;bottom:22px;right:22px;z-index:9999;background:'+bg+';color:#fff;padding:11px 18px;border-radius:8px;font-size:13px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,0.28);max-width:340px;line-height:1.4;transition:opacity .2s;';
  d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(function(){ d.style.opacity='0'; setTimeout(function(){ d.remove(); },200); }, 3500);
}

// ── 앱 설정 (API 키 등 어드민 전역 설정) ──────────────────────────────────
var _appSettings = {};
var _appSettingsPromise = null;
var DEFAULT_SITE_CONFIG = {
  siteName: 'KoreHan News',
  siteTagline: 'Learn Korean, Naturally',
  footerDesc: 'KoreHan News delivers real Korean news — paired with vocabulary tooltips so you learn Korean naturally through stories that matter.',
  learnBannerTitle: 'Simplified Korean news for learners',
  learnBannerDesc: 'KoreHan News is written in easy Korean for foreign learners. Hover any underlined word to instantly see its meaning and pronunciation.'
};

function getSiteConfig() {
  var raw = _appSettings.site_config || null;
  if (raw && typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch(e) { raw = null; }
  }
  if (!raw || typeof raw !== 'object') raw = {};
  return Object.assign({}, DEFAULT_SITE_CONFIG, raw);
}

function applySiteConfigToPage() {
  var cfg = getSiteConfig();
  var titleEl = document.querySelector('.learn-banner .lb-left h2');
  var descEl = document.querySelector('.learn-banner .lb-left p');
  if (titleEl) titleEl.textContent = cfg.learnBannerTitle || DEFAULT_SITE_CONFIG.learnBannerTitle;
  if (descEl) descEl.textContent = cfg.learnBannerDesc || DEFAULT_SITE_CONFIG.learnBannerDesc;
}

async function loadAppSettings() {
  if (_appSettingsPromise) return _appSettingsPromise;
  _appSettingsPromise = (async function() {
    var sb = getSupa();
    if (!sb) return;
    try {
      // API 키는 로그인한 유저만 읽을 수 있음 (RLS로 보호)
      var res = await sb.from('app_settings').select('key,value');
      if (res.data) {
        res.data.forEach(function(row) {
          _appSettings[row.key] = row.value;
        });
        // API 키는 localStorage에 저장하지 않음 (보안)
      }
    } catch(e) {}
  })();
  return _appSettingsPromise;
}

function getApiKey() {
  // 메모리에서만 — localStorage 캐시 없음
  return _appSettings.anthropic_key || null;
}

// ── 온보딩 체크 ────────────────────────────────────────────
var _onboardingChecked = false;
function getOnboardingStorageKey(name, userId) {
  return 'kh_onboarding_' + name + (userId ? '_' + userId : '');
}
function getWelcomeTipStorageKey(userId) {
  return 'kh_new_user_tip' + (userId ? '_' + userId : '');
}
function hasCompletedOnboardingLocal(userId) {
  try {
    return localStorage.getItem(getOnboardingStorageKey('completed', userId)) === '1';
  } catch(e) {
    return false;
  }
}
function markCompletedOnboardingLocal(userId, onboardedAt) {
  try {
    localStorage.setItem(getOnboardingStorageKey('completed', userId), '1');
    if (onboardedAt) localStorage.setItem(getOnboardingStorageKey('completed_at', userId), onboardedAt);
  } catch(e) {}
}
async function checkOnboardingStatus() {
  if (_onboardingChecked || !supaUser) return;
  if (window.location.pathname.includes('onboarding')) return;
  _onboardingChecked = true;
  try {
    // Check both keyed and un-keyed localStorage (handles edge cases)
    if (hasCompletedOnboardingLocal(supaUser.id)) return;
    if (hasCompletedOnboardingLocal('')) return;
    var sb = getSupa(); if (!sb) return;
    var res = await sb.from('user_stats')
      .select('onboarded, onboarded_at, created_at')
      .eq('user_id', supaUser.id)
      .maybeSingle();

    if (res.data && res.data.onboarded === true) {
      markCompletedOnboardingLocal(supaUser.id, res.data.onboarded_at || '');
      return;
    }

    // Only redirect new accounts (created within 30 min) that haven't onboarded
    var createdAt = supaUser.created_at ? new Date(supaUser.created_at) : null;
    var isNew = createdAt && (Date.now() - createdAt.getTime() < 30 * 60 * 1000);
    if (isNew && res.data && res.data.onboarded === false) {
      setTimeout(function() {
        window.location.href = 'korehan-onboarding.html';
      }, 600);
    } else if (isNew && !res.data) {
      // No user_stats row yet — new signup
      setTimeout(function() {
        window.location.href = 'korehan-onboarding.html';
      }, 600);
    }
  } catch(e) {}
}

async function loadVocabFromDB() {
  try {
    var sb = getSupa(); if (!sb) { initTooltips(); return; }
    var res = await sb.from('vocabulary_bank')
      .select('word_ko,word_rom,word_en')
      .eq('is_active', true)
      .limit(2000);
    if (res.data && res.data.length) {
      res.data.forEach(function(row) {
        if (row.word_ko && row.word_en) {
          VOCAB[row.word_ko] = { rom: row.word_rom || '', en: row.word_en };
        }
      });
    }
  } catch(e) {}
}

