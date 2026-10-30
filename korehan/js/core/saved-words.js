/* ============================================================
   KoreHani — Saved-words DB CRUD
   Extracted from korehan-shared.js (was lines 1648-1814).

   Per-user vocabulary save/remove with localStorage fallback. The
   in-memory _savedWordsSet mirrors the DB rows for fast hover-tooltip
   "is saved?" lookups without a round-trip per word.

   External deps (resolved at runtime via global scope):
   - getSupa(), supaUser     — from korehan-shared.js
   - lsGet, lsSet            — from js/core/storage.js
   - KH_ICON_CHECK           — from js/core/icons.js
   - trackActivityOnWordSave — from korehan-shared.js (XP/streak counter)
   ============================================================ */

var K_SAVED = 'korehan_saved_words';
var _savedWordsSet = null; // Set of ko strings, populated from DB on auth

// Words saved while signed OUT are listed (by ko) under K_SAVED_PENDING.
// Only those are pushed to the account on the next sign-in, once — the
// full K_SAVED list is just the local mirror of the DB for a signed-in
// learner. Pushing the whole mirror on every SIGNED_IN (which supabase-js
// re-emits on each load / tab focus) brought deleted words back.
var K_SAVED_PENDING = 'korehan_saved_words_pending';
function _khPendingGet() {
  var v = lsGet(K_SAVED_PENDING, null);
  return Array.isArray(v) ? v : [];
}
function _khPendingSet(list) {
  try { if (list && list.length) lsSet(K_SAVED_PENDING, list); else localStorage.removeItem(K_SAVED_PENDING); } catch (_) {}
}
function khMarkAnonSaved(ko) {
  if (!ko) return;
  var p = _khPendingGet();
  if (p.indexOf(ko) < 0) { p.push(ko); _khPendingSet(p); }
}
function _khUnmarkAnonSaved(ko) {
  var p = _khPendingGet();
  var i = p.indexOf(ko);
  if (i >= 0) { p.splice(i, 1); _khPendingSet(p); }
}
// Remove a word from the local mirror (+ pending list + in-memory set)
// without touching the DB — for delete paths that already removed the row.
function khForgetSavedWordLocal(ko) {
  if (!ko) return;
  try { if (_savedWordsSet) _savedWordsSet.delete(ko); } catch (_) {}
  lsSet(K_SAVED, (lsGet(K_SAVED, []) || []).filter(function (w) { return w && (w.ko || w.word_ko) !== ko; }));
  _khUnmarkAnonSaved(ko);
}
// One-time upgrade for devices that saved words before the pending list
// existed: with no Supabase session on this device, every local word was
// saved as a guest. With a session, the local list is a DB mirror.
(function _khSeedPendingOnce() {
  try {
    if (localStorage.getItem('kh_saved_pending_v1')) return;
    localStorage.setItem('kh_saved_pending_v1', '1');
    var hasSession = Object.keys(localStorage).some(function (k) { return k.indexOf('sb-') === 0 && k.indexOf('-auth-token') > 0; });
    if (hasSession) return;
    var local = lsGet(K_SAVED, []) || [];
    local.forEach(function (w) { var ko = w && (w.ko || w.word_ko || w.word); if (ko) khMarkAnonSaved(ko); });
  } catch (_) {}
})();
// Merge the DB rows with words still waiting to be pushed, so a sync never
// drops a guest save that hasn't reached the account yet.
function _khMirrorWithPending(normalized) {
  var pending = _khPendingGet();
  if (!pending.length) return normalized;
  var have = {};
  normalized.forEach(function (w) { have[w.ko] = 1; });
  (lsGet(K_SAVED, []) || []).forEach(function (w) {
    var ko = w && (w.ko || w.word_ko || '');
    if (ko && !have[ko] && pending.indexOf(ko) >= 0) { have[ko] = 1; normalized.push(normalizeSavedWord(w)); }
  });
  return normalized;
}

// Push words saved as a guest into Supabase after a real sign-in. Runs on
// every SIGNED_IN but only does work while the pending list has entries;
// it is emptied once the upsert succeeds. Returns the number of rows pushed.
async function migrateAnonSavedWords() {
  if (!supaUser) return 0;
  var sb = getSupa();
  if (!sb) return 0;
  var pending = _khPendingGet();
  if (!pending.length) return 0;
  var local = lsGet(K_SAVED, []) || [];
  var rows = local
    .map(function(w){
      var ko = w && (w.ko || w.word_ko || w.word) || '';
      if (!ko || pending.indexOf(ko) < 0) return null;
      return {
        user_id: supaUser.id,
        word_key: ko,
        word_ko: ko,
        word_rom: _khSavedRom(ko, w.rom || w.word_rom || w.reading || ''),
        word_en:  w.en  || w.word_en  || w.meaning || ''
      };
    })
    .filter(Boolean);
  if (!rows.length) { _khPendingSet([]); return 0; }
  try {
    var res = await sb.from('user_saved_words').upsert(rows, { onConflict: 'user_id,word_key' });
    if (res.error) {
      console.warn('[migrateAnonSavedWords]', res.error.message);
      return 0;
    }
    _khPendingSet([]);
    // Refresh in-memory mirror so hover tooltips & Save buttons reflect the
    // merged set without waiting for the next DB sync tick.
    await _syncSavedWordsFromDB();
    return rows.length;
  } catch(e) {
    console.warn('[migrateAnonSavedWords] exception', e);
    return 0;
  }
}

// Fetch saved words from DB and populate _savedWordsSet (call after auth ready)
async function _syncSavedWordsFromDB() {
  if (!supaUser) { _savedWordsSet = null; return; }
  var sb = getSupa();
  if (!sb) return;
  try {
    var res = await sb.from('user_saved_words').select('*').eq('user_id', supaUser.id);
    if (res.error) throw res.error;
    var normalized = _khMirrorWithPending((res.data || []).map(normalizeSavedWord).filter(function(w){ return w && w.ko; }));
    _savedWordsSet = new Set(normalized.map(function (w) { return w.ko; }));
    // The local list mirrors the account (plus unsynced guest saves), so a
    // word deleted on another device disappears here too.
    lsSet(K_SAVED, normalized);
  } catch(e) {
    // If DB fetch fails, build set from localStorage
    if (!_savedWordsSet) {
      var local = lsGet(K_SAVED, []);
      _savedWordsSet = new Set(local.map(function(w){ return w.ko || w.word_ko || ''; }).filter(Boolean));
    }
  }
}
// One romanizer for saved words: the rule-based khRomanize (korehan-shared.js),
// so rows saved from different screens don't end up as "Jeolmeun" / "jeomsoo" /
// "eun-ha". Falls back to the value we were given when it isn't loaded.
function _khSavedRom(ko, given) {
  try { if (ko && typeof khRomanize === 'function') { var r = khRomanize(ko); if (r) return r; } } catch (_) {}
  return given || '';
}
function normalizeSavedWord(row) {
  if (!row) return null;
  return {
    ko: row.ko || row.word_ko || row.word || '',
    rom: _khSavedRom(row.ko || row.word_ko || row.word || '', row.rom || row.word_rom || row.reading || ''),
    en: row.en || row.word_en || row.meaning || ''
  };
}
async function dbGetSavedWords() {
  var localSaved = lsGet(K_SAVED, []);
  if (!supaUser) return localSaved;
  var sb = getSupa();
  if (!sb) return localSaved;
  try {
    var res = await sb.from('user_saved_words').select('*').eq('user_id', supaUser.id).order('created_at', { ascending: false });
    if (!res.error && res.data) {
      var normalized = _khMirrorWithPending(res.data.map(normalizeSavedWord).filter(function(w){ return w && w.ko; }));
      lsSet(K_SAVED, normalized);
      return normalized;
    }
  } catch(e) {}
  return localSaved;
}
async function dbSaveWord(ko, rom, en) {
  // Update in-memory set immediately for cross-device consistency
  if (_savedWordsSet) _savedWordsSet.add(ko);
  // localStorage에도 추가 (중복 제거)
  var saved = lsGet(K_SAVED, []);
  var alreadyLocal = !!saved.find(function(w){ return w.ko === ko; });
  if (!alreadyLocal) {
    saved.push({ko:ko,rom:rom,en:en});
    lsSet(K_SAVED, saved);
  }
  // O7: a guest who has saved 3 words is the best moment to ask for a free
  // account (the words are kept and moved over on sign-up).
  if (!alreadyLocal && !supaUser && saved.length >= 3 && typeof showSignupNudge === 'function') {
    try { showSignupNudge({ title: 'Keep your ' + saved.length + ' saved words', body: 'Free account — they come back for review tomorrow.' }); } catch(_) {}
  }
  // Operational analytics — only logs new saves, not re-saves of the
  // same word, so the dashboard's "words saved per session" reflects
  // genuine learning intent.
  if (!alreadyLocal && typeof khTrackUser === 'function') {
    try {
      khTrackUser('word_save', {
        ko: ko,
        article_id: (window._currentArticle && window._currentArticle.id) || null,
      });
    } catch(_) {}
  }

  if (!supaUser) {
    // Signed out: keep it locally and remember it for the next sign-in.
    khMarkAnonSaved(ko);
    if (!alreadyLocal) {
      if (typeof trackActivityOnWordSave === 'function') trackActivityOnWordSave();
    }
    return { ok: true, source: 'local' };
  }

  var sb = getSupa();
  if (!sb) {
    // Supabase 없음: localStorage에 추가됐으면 카운터 증가
    if (!alreadyLocal && typeof trackActivityOnWordSave === 'function') trackActivityOnWordSave();
    return { ok: true, source: 'local' };
  }

  try {
    // INSERT (upsert 대신): conflict 여부로 새 단어인지 판단
    var res = await sb.from('user_saved_words').upsert({
      user_id: supaUser.id,
      word_key: ko,
      word_ko: ko,
      word_rom: _khSavedRom(ko, rom || ''),
      word_en: en || ''
    }, { onConflict: 'user_id,word_key' });

    if (!res.error) {
      if (!alreadyLocal && typeof trackActivityOnWordSave === 'function') trackActivityOnWordSave();
      return { ok: true, source: 'supabase' };
    } else {
      console.warn('[dbSaveWord]', res.error.message);
      return { ok: false, source: 'local', error: res.error };
    }
  } catch(e) {
    // DB 예외 — localStorage엔 이미 추가됐으므로 카운터만 증가. Offline:
    // push it on the next sign-in instead of losing it at the next sync.
    khMarkAnonSaved(ko);
    if (!alreadyLocal && typeof trackActivityOnWordSave === 'function') trackActivityOnWordSave();
    return { ok: false, source: 'local', error: e };
  }
}
async function dbRemoveWord(ko) {
  // Update in-memory set immediately for cross-device consistency
  if (_savedWordsSet) _savedWordsSet.delete(ko);
  var saved = lsGet(K_SAVED, []).filter(function(w){ return w.ko !== ko; });
  lsSet(K_SAVED, saved);
  _khUnmarkAnonSaved(ko);
  if (!supaUser) return { ok: true, source: 'local' };
  var sb = getSupa();
  if (!sb) return { ok: true, source: 'local' };
  // PostgREST's .or() parser doesn't handle embedded quotes — and saved
  // words can legitimately contain them (`"안녕"` dialogue snippets, etc.).
  // Issue two separate eq() deletes instead; PostgREST treats a 0-row
  // delete as success so this is safe even when only one column exists.
  try {
    await Promise.all([
      sb.from('user_saved_words').delete().eq('user_id', supaUser.id).eq('word_ko', ko),
      sb.from('user_saved_words').delete().eq('user_id', supaUser.id).eq('ko', ko)
    ]);
    return { ok: true, source: 'supabase' };
  } catch(e) {
    return { ok: false, source: 'local', error: e };
  }
}

// 저장 버튼 상태 복원 — 컨테이너 내 모든 Save 버튼에 적용
async function restoreSaveButtons(containerId) {
  var container = containerId ? document.getElementById(containerId) : document;
  if (!container) return;

  // Use DB-backed set if available, otherwise fall back to localStorage
  var saved = lsGet(K_SAVED, []);
  var savedSet = _savedWordsSet || new Set(saved.map(function(w){ return w.ko || w.word_ko || ''; }).filter(Boolean));

  function applyState(set) {
    // dp-vocab-item (conversations)
    container.querySelectorAll('.dp-vocab-item, .dp-vocab-item2').forEach(function(item) {
      var ko = item.dataset.ko || '';
      if (!ko) return;
      var btn = item.querySelector('.dp-vi-save, button');
      if (!btn) return;
      if (set.has(ko)) {
        btn.classList.add('saved');
        btn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:5px"><span style="display:inline-flex;width:14px;height:14px">'+KH_ICON_CHECK+'</span><span>Saved</span></span>';
      } else {
        btn.classList.remove('saved');
        btn.textContent = '+ Save';
      }
    });
    // st-vocab-item (stories)
    container.querySelectorAll('.st-vocab-item, [data-ko]').forEach(function(item) {
      var ko = item.dataset.ko || '';
      if (!ko) return;
      var btn = item.querySelector('button');
      if (!btn) return;
      if (set.has(ko)) {
        btn.classList.add('saved');
        btn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:5px"><span style="display:inline-flex;width:14px;height:14px">'+KH_ICON_CHECK+'</span><span>Saved</span></span>';
      }
    });
  }

  applyState(savedSet);

  // DB에서 최신 목록으로 한 번 더 업데이트
  if (supaUser) {
    try {
      var fresh = await dbGetSavedWords();
      var freshSet = new Set(fresh.map(function(w){ return w.ko || w.word_ko || ''; }).filter(Boolean));
      applyState(freshSet);
    } catch(e) {}
  }
}
