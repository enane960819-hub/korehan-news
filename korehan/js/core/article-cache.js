/* ============================================================
   KoreHani — article_cache (AI 분석 결과 캐시)
   Extracted from korehan-shared.js (was lines 650-670, 704-939).

   Caches AI-generated translation / vocab / grammar / quiz output
   per article (and conversations / stories) in the article_cache
   Supabase table. Supports both 'kv' (key-value rows) and 'wide'
   (single-row-per-article) schemas — auto-detected on first use.

   External deps (resolved at runtime via global scope):
   - getSupa()           — from korehan-shared.js
   - getCachedArticles() — from korehan-shared.js
   ============================================================ */

// conv/story 발행 시 admin에서 AI 생성 → 여기서 조회
var _remoteCacheDisabled = false;
var _artCacheSchema = null;     // 'kv' | 'wide' | 'none'
var _artCacheSchemaDone = false;

// cache_value / wide-row JSON columns can be either a string (text column)
// or an already-parsed object/array (jsonb column — PostgREST auto-parses).
// JSON.parse on an object throws, so handle both shapes. Without this,
// getFromCache silently returned null and the article Vocab tab always
// fell through to the body-scan fallback.
function safeParseJSON(v, fallback) {
  if (v === null || v === undefined || v === '') return fallback;
  if (typeof v === 'object') return v;
  if (typeof v !== 'string') return fallback;
  try { return JSON.parse(v); }
  catch (_) {
    try { return JSON.parse(decodeURIComponent(v)); }
    catch (_) { return fallback; }
  }
}

async function _detectArtCacheSchema() {
  if (_artCacheSchemaDone) return _artCacheSchema;
  var sb = getSupa();
  if (!sb) { _artCacheSchema = 'none'; return 'none'; }
  // 먼저 실제 행으로 컬럼 감지
  try {
    var r0 = await sb.from('article_cache').select('*').limit(1);
    if (!r0.error && r0.data && r0.data.length > 0) {
      var cols = Object.keys(r0.data[0]);
      if (cols.indexOf('cache_key') >= 0) { _artCacheSchemaDone = true; _artCacheSchema = 'kv'; return 'kv'; }
      if (cols.indexOf('article_id') >= 0 && cols.indexOf('vocab') >= 0) { _artCacheSchemaDone = true; _artCacheSchema = 'wide'; return 'wide'; }
      console.warn('[cache] 알 수 없는 컬럼:', cols);
      _artCacheSchemaDone = true; _artCacheSchema = 'none'; return 'none';
    }
  } catch(e) {}
  // 빈 테이블이면 컬럼 유효성으로 감지
  try {
    var r1 = await sb.from('article_cache').select('content_type,content_id,cache_key,cache_value').limit(0);
    if (!r1.error) { _artCacheSchemaDone = true; _artCacheSchema = 'kv'; return 'kv'; }
  } catch(e) {}
  try {
    var r2 = await sb.from('article_cache').select('article_id,vocab,grammar').limit(0);
    if (!r2.error) { _artCacheSchemaDone = true; _artCacheSchema = 'wide'; return 'wide'; }
  } catch(e) {}
  // Don't set _artCacheSchemaDone — allow retry after auth is restored
  console.warn('[cache] schema detection failed — will retry after auth');
  _artCacheSchema = 'none';
  return 'none';
}

async function getFromCache(contentType, contentId, cacheKey) {
  if (_remoteCacheDisabled) return null;
  try {
    var sb = getSupa();
    if (!sb) return null;
    var schema = await _detectArtCacheSchema();
    if (schema === 'none') return null;

    if (schema === 'kv') {
      // key-value 스키마
      if (cacheKey === 'ai_analysis') {
        var res = await sb.from('article_cache')
          .select('cache_key, cache_value')
          .eq('content_type', contentType)
          .eq('content_id', String(contentId))
          .in('cache_key', ['translation', 'vocab', 'grammar', 'quiz']);
        if (res.error) throw res.error;
        if (!res.data || !res.data.length) return null;
        var map = {};
        res.data.forEach(function(r) { map[r.cache_key] = safeParseJSON(r.cache_value, null); });
        return { translation: map.translation || null, vocab: map.vocab || [], grammar: map.grammar || null, quiz: map.quiz || null };
      }
      var actualKey = cacheKey;
      if (cacheKey === 'translation_en') actualKey = 'translation';
      else if (cacheKey === 'grammar_guide') actualKey = 'grammar';
      else if (cacheKey.indexOf('fill_') === 0) actualKey = 'quiz';
      var res = await sb.from('article_cache')
        .select('cache_value')
        .eq('content_type', contentType)
        .eq('content_id', String(contentId))
        .eq('cache_key', actualKey)
        .maybeSingle();
      if (res.error) throw res.error;
      if (!res.data || !res.data.cache_value) return null;
      var val = safeParseJSON(res.data.cache_value, null);
      if (cacheKey === 'translation_en' && val && val.texts) return { translations: val.texts };
      return val;
    }

    if (schema === 'wide') {
      // wide-table 스키마 (article_id 기반)
      var res = await sb.from('article_cache')
        .select('*')
        .eq('article_id', String(contentId))
        .maybeSingle();
      if (res.error) throw res.error;
      if (!res.data) return null;
      var row = res.data;
      if (cacheKey === 'ai_analysis') {
        return {
          translation: safeParseJSON(row.translation, null),
          vocab: safeParseJSON(row.vocab, []),
          grammar: safeParseJSON(row.grammar, null),
          quiz: safeParseJSON(row.quiz, null)
        };
      }
      if (cacheKey === 'translation_en') {
        var t = safeParseJSON(row.translation, null);
        return (t && t.texts) ? { translations: t.texts } : null;
      }
      if (cacheKey === 'grammar_guide') return safeParseJSON(row.grammar, null);
      if (cacheKey.indexOf('fill_') === 0) return safeParseJSON(row.quiz, null);
      if (cacheKey === 'expressions') return safeParseJSON(row.expressions, []);
      return null;
    }
  } catch(e) {
    var msg = String((e && e.message) || e || '');
    if (/40[013]/.test(msg) || /unauthorized|forbidden|permission/i.test(msg)) _remoteCacheDisabled = true;
  }
  return null;
}

async function upsertArticleCacheRow(articleId, patch) {
  if (_remoteCacheDisabled || !patch) return;
  var sb = getSupa();
  if (!sb) return;
  var schema = await _detectArtCacheSchema();
  if (schema === 'none') return;

  if (schema === 'kv') {
    var keys = Object.keys(patch);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = patch[k];
      if (v === undefined || v === null) continue;
      try {
        var upsRes = await sb.from('article_cache').upsert({
          content_type: 'article',
          content_id: String(articleId),
          cache_key: k,
          cache_value: typeof v === 'string' ? v : JSON.stringify(v)
        }, { onConflict: 'content_type,content_id,cache_key' });
        if (upsRes.error) {
          console.warn('[cache] upsert error key=' + k + ':', upsRes.error);
          var msg = String((upsRes.error.message) || upsRes.error.code || '');
          if (/40[013]/.test(msg) || /unauthorized|forbidden|permission/i.test(msg)) { _remoteCacheDisabled = true; break; }
        } else {
          console.log('[cache] saved key=' + k + ' articleId=' + articleId);
        }
      } catch(e) {
        var msg = String((e && e.message) || e || '');
        console.warn('[cache] upsert exception key=' + k + ':', msg);
        if (/40[013]/.test(msg) || /unauthorized|forbidden|permission/i.test(msg)) { _remoteCacheDisabled = true; break; }
      }
    }
  } else if (schema === 'wide') {
    // wide-table: 존재 여부 확인 후 update / insert
    try {
      var existing = await sb.from('article_cache').select('article_id').eq('article_id', String(articleId)).maybeSingle();
      if (existing.error) { console.warn('[cache] wide select error:', existing.error); }
      else if (existing && existing.data) {
        var upRes = await sb.from('article_cache').update(patch).eq('article_id', String(articleId));
        if (upRes.error) console.warn('[cache] wide update error:', upRes.error);
        else console.log('[cache] wide updated articleId=' + articleId, Object.keys(patch));
      } else {
        var wRow = Object.assign({ article_id: String(articleId) }, patch);
        var insRes = await sb.from('article_cache').insert(wRow);
        if (insRes.error) console.warn('[cache] wide insert error:', insRes.error);
        else console.log('[cache] wide inserted articleId=' + articleId, Object.keys(patch));
      }
    } catch(e) {
      var msg = String((e && e.message) || e || '');
      console.warn('[cache] wide upsert exception:', msg);
      if (/40[013]/.test(msg) || /unauthorized|forbidden|permission/i.test(msg)) _remoteCacheDisabled = true;
    }
  }
}

// Conv/Story 데이터에 캐시 병합 (vocab/grammar 없을 때만)
async function enrichFromCache(contentType, item) {
  if (!item || !item.id) return item;
  var hasVocab = item.data && item.data.vocab && item.data.vocab.length;
  if (hasVocab) return item; // 이미 있으면 캐시 불필요
  var cached = await getFromCache(contentType, item.id, 'ai_analysis');
  if (cached) {
    if (!item.data) item.data = {};
    if (cached.vocab && !item.data.vocab) item.data.vocab = cached.vocab;
    if (cached.grammar && !item.data.grammar) item.data.grammar = cached.grammar;
    if (cached.mission && !item.data.mission) item.data.mission = cached.mission;
    if (cached.summary_en && !item.data.summary_en) item.data.summary_en = cached.summary_en;
  }
  return item;
}


async function getArticleCacheVocab() {
  var out = [];
  var seen = new Set();
  function pushWord(word) {
    if (!word) return;
    var ko = word.word || word.ko || '';
    if (!ko || seen.has(ko)) return;
    seen.add(ko);
    out.push({
      word: ko,
      reading: word.reading || word.rom || '',
      meaning: word.meaning || word.en || '',
      source: word.source || word.src || 'article'
    });
  }
  try {
    var arts = getCachedArticles ? getCachedArticles() : [];
    // PERF-F6: was N+1 — one getFromCache call per article = 80
    // sequential PostgREST round-trips on every Learn-page render.
    // Replaced with one .in() call that pulls every (article, cache_key)
    // pair in a single query, grouped client-side. Falls back to the
    // per-article loop only if the bulk query schema-detect fails.
    var artIds = arts.map(function(a){ return String(a.id); }).filter(Boolean);
    var sb = (typeof getSupa === 'function') ? getSupa() : null;
    var schema = sb ? await _detectArtCacheSchema() : 'none';
    if (sb && artIds.length && schema === 'kv') {
      try {
        var bulk = await sb.from('article_cache')
          .select('content_id, cache_key, cache_value')
          .eq('content_type', 'article')
          .in('content_id', artIds)
          .in('cache_key', ['translation', 'vocab', 'grammar', 'quiz']);
        if (bulk.error) throw bulk.error;
        var perArt = {};
        (bulk.data || []).forEach(function(r){
          if (r.cache_key !== 'vocab') return;
          var parsed = safeParseJSON(r.cache_value, null);
          if (Array.isArray(parsed)) {
            (perArt[r.content_id] = perArt[r.content_id] || []).push.apply(perArt[r.content_id], parsed);
          }
        });
        for (var i = 0; i < arts.length; i++) {
          var art = arts[i];
          (perArt[String(art.id)] || []).forEach(function(v){ pushWord(v); });
          ((art.data && art.data.vocab) || []).forEach(function(v){ pushWord(v); });
        }
      } catch (e) {
        // Bulk path failed (schema mismatch / RLS / etc.) — fall back
        // to the per-article loop so the page still renders.
        for (var j = 0; j < arts.length; j++) {
          var art2 = arts[j];
          var cached = await getFromCache('article', art2.id, 'ai_analysis');
          (cached && cached.vocab || []).forEach(function(v){ pushWord(v); });
          ((art2.data && art2.data.vocab) || []).forEach(function(v){ pushWord(v); });
        }
      }
    } else {
      // 'wide' schema or no Supabase — keep the per-article loop.
      for (var k = 0; k < arts.length; k++) {
        var art3 = arts[k];
        var cached2 = await getFromCache('article', art3.id, 'ai_analysis');
        (cached2 && cached2.vocab || []).forEach(function(v){ pushWord(v); });
        ((art3.data && art3.data.vocab) || []).forEach(function(v){ pushWord(v); });
      }
    }
    var sb = getSupa();
    if (sb) {
      var pair = await Promise.all([
        sb.from('conversations_data').select('data').limit(100),
        sb.from('stories_data').select('data').limit(100)
      ]);
      (pair[0].data || []).forEach(function(row) {
        ((row.data || {}).vocab || []).forEach(function(v){ pushWord(Object.assign({ source: 'conv' }, v)); });
      });
      (pair[1].data || []).forEach(function(row) {
        ((row.data || {}).vocab || []).forEach(function(v){ pushWord(Object.assign({ source: 'story' }, v)); });
      });
    }
  } catch(e) {}
  return out;
}

async function getArticleCacheSentences() {
  var out = [];
  try {
    var arts = (getCachedArticles ? getCachedArticles() : []).filter(function(a){ return a && a.status === 'published'; }).slice(0, 30);
    for (var i = 0; i < arts.length; i++) {
      var art = arts[i];
      var body = String(art.body || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!body) continue;
      var parts = body.split(/[\n]+|(?<=[.!?])\s+/).filter(function(s){ return s && s.trim().length > 12; }).slice(0, 2);
      parts.forEach(function(sentence, idx) {
        out.push({
          id: 'art-' + art.id + '-' + idx,
          level: art.level || 'Intermediate',
          ko: sentence.trim(),
          en: art.title || art.section || 'From KoreHani'
        });
      });
    }
  } catch(e) {}
  return out;
}
