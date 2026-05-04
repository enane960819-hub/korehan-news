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

// Fetch saved words from DB and populate _savedWordsSet (call after auth ready)
async function _syncSavedWordsFromDB() {
  if (!supaUser) { _savedWordsSet = null; return; }
  var sb = getSupa();
  if (!sb) return;
  try {
    var res = await sb.from('user_saved_words').select('*').eq('user_id', supaUser.id);
    if (res.data && res.data.length) {
      _savedWordsSet = new Set();
      res.data.forEach(function(row) {
        var k = row.word_ko || row.ko || '';
        if (k) _savedWordsSet.add(k);
      });
      // Also sync to localStorage for offline/fallback
      var normalized = res.data.map(normalizeSavedWord).filter(function(w){ return w && w.ko; });
      lsSet(K_SAVED, normalized);
    } else {
      _savedWordsSet = new Set();
    }
  } catch(e) {
    // If DB fetch fails, build set from localStorage
    if (!_savedWordsSet) {
      var local = lsGet(K_SAVED, []);
      _savedWordsSet = new Set(local.map(function(w){ return w.ko || w.word_ko || ''; }).filter(Boolean));
    }
  }
}
function normalizeSavedWord(row) {
  if (!row) return null;
  return {
    ko: row.ko || row.word_ko || row.word || '',
    rom: row.rom || row.word_rom || row.reading || '',
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
    if (res.data && res.data.length) {
      var normalized = res.data.map(normalizeSavedWord).filter(function(w){ return w && w.ko; });
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
    // 비로그인: localStorage만, 새 단어일 때만 XP
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
      word_rom: rom || '',
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
    // DB 예외 — localStorage엔 이미 추가됐으므로 카운터만 증가
    if (!alreadyLocal && typeof trackActivityOnWordSave === 'function') trackActivityOnWordSave();
    return { ok: false, source: 'local', error: e };
  }
}
async function dbRemoveWord(ko) {
  // Update in-memory set immediately for cross-device consistency
  if (_savedWordsSet) _savedWordsSet.delete(ko);
  var saved = lsGet(K_SAVED, []).filter(function(w){ return w.ko !== ko; });
  lsSet(K_SAVED, saved);
  if (!supaUser) return { ok: true, source: 'local' };
  var sb = getSupa();
  if (!sb) return { ok: true, source: 'local' };
  try {
    await sb.from('user_saved_words').delete().eq('user_id', supaUser.id).or('word_ko.eq."' + ko.replace(/"/g, '\\"') + '",ko.eq."' + ko.replace(/"/g, '\\"') + '"');
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
