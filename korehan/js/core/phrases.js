/* ============================================================
   KoreHani — "Today's phrase" (관용 표현) data + accessors
   Extracted from korehan-shared.js (was lines 1286-1335, 1362-1421).

   DEF_PHRASES is the seed list used when neither the DB
   (app_settings.phrases) nor localStorage has a stored copy. The
   accessors return the daily-rotated entry for the current date
   (Asia/Seoul timezone via the +9h offset in getTodaysPhraseIndex).

   External deps (resolved at runtime via global scope):
   - lsGet, lsSet              — from js/core/storage.js
   - K_PHRASES                 — from korehan-shared.js (key constant)
   - _appSettings              — from korehan-shared.js
   - loadAppSettings()         — from korehan-shared.js
   - getSupa(), supaUser       — from korehan-shared.js
   ============================================================ */

const DEF_PHRASES = [
  {
    ko:'고생 끝에 낙이 온다',
    rom:'go-saeng kkeut-e nak-i on-da',
    en:'After hardship comes happiness.',
    intro:'A classic Korean proverb used to encourage someone who is going through a difficult stretch.',
    nuance:'Used when reminding learners that steady effort pays off, especially after a tiring or frustrating period.',
    examples:[
      {ko:'시험 준비가 힘들어도 고생 끝에 낙이 온다고 생각해 봐요.', en:'Even if test prep is hard, try thinking that happiness comes after hardship.'},
      {ko:'매일 한국어를 조금씩 공부하면 고생 끝에 낙이 올 거예요.', en:'If you study Korean little by little every day, the reward will come after the struggle.'}
    ],
    related:['인내','꾸준함','노력']
  },
  {
    ko:'시작이 반이다',
    rom:'si-jak-i ban-i-da',
    en:'Starting is half the battle.',
    intro:'A proverb that says beginning a task is already a huge part of finishing it.',
    nuance:'Great for daily study motivation when someone is procrastinating or hesitating to begin.',
    examples:[
      {ko:'오늘 한 문제라도 풀면 시작이 반이에요.', en:'If you solve even one question today, that is already half the battle.'},
      {ko:'한국어 일기 첫 줄만 써도 시작이 반이다라는 말이 딱 맞아요.', en:'If you write just the first line of your Korean diary, “starting is half the battle” fits perfectly.'}
    ],
    related:['첫걸음','동기부여','습관']
  },
  {
    ko:'백문이 불여일견',
    rom:'baeng-mun-i bul-yeo-il-gyeon',
    en:'Seeing once is better than hearing a hundred times.',
    intro:'A proverb used when direct experience teaches better than repeated explanations.',
    nuance:'Useful for language learning, travel, culture, and real-life practice contexts.',
    examples:[
      {ko:'문법 설명을 백 번 듣는 것보다 예문을 직접 보는 게 백문이 불여일견이에요.', en:'Rather than hearing grammar explained a hundred times, seeing examples yourself is better.'},
      {ko:'한국에 가서 직접 말해 보니 백문이 불여일견이라는 걸 느꼈어요.', en:'After going to Korea and speaking directly, I felt that seeing once is better than hearing a hundred times.'}
    ],
    related:['직접 경험','실전','예문']
  },
  {
    ko:'티끌 모아 태산',
    rom:'ti-kkeul mo-a tae-san',
    en:'Dust gathered together becomes a mountain.',
    intro:'A proverb meaning small efforts add up to something big over time.',
    nuance:'Very natural for study streaks, vocabulary building, savings, and habit-building.',
    examples:[
      {ko:'단어 다섯 개씩 외워도 티끌 모아 태산이에요.', en:'Even memorizing five words at a time adds up like dust becoming a mountain.'},
      {ko:'짧게 공부해도 매일 하면 티끌 모아 태산이죠.', en:'Even short study sessions add up if you do them every day.'}
    ],
    related:['누적','습관','복습']
  },
];

function normalizePhrase(row) {
  row = row || {};
  var examples = Array.isArray(row.examples) ? row.examples : [];
  if (!examples.length && row.example_ko) examples = [{ ko: row.example_ko || '', en: row.example_en || '' }];
  // intro_ko + level are surfaced by the redesigned phrase reader;
  // older saved rows without them just render the English intro and
  // default to Sprout, so empty strings are safe defaults.
  var lvl = (row.level || '').toString();
  if (['Seed','Sprout','Tree','Forest'].indexOf(lvl) < 0) lvl = '';
  return {
    ko: row.ko || '',
    rom: row.rom || '',
    en: row.en || '',
    intro_ko: row.intro_ko || '',
    intro: row.intro || row.desc || row.description || '',
    nuance: row.nuance || row.note || '',
    level: lvl,
    examples: examples.slice(0, 6).map(function(ex){ return { ko: ex.ko || '', en: ex.en || '' }; }).filter(function(ex){ return ex.ko; }),
    related: Array.isArray(row.related) ? row.related.filter(Boolean).slice(0, 8) : []
  };
}
function getPhraseSourceRows() {
  // DB(app_settings) 우선 — 기기별 차이 방지
  var raw = _appSettings && _appSettings.phrases;
  if (raw && typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch(e) { raw = null; }
  }
  if (Array.isArray(raw) && raw.length) return raw;

  var local = lsGet(K_PHRASES, null);
  if (Array.isArray(local) && local.length) return local;

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

async function getPhrasesAsync(opts) {
  // opts.force=true triggers a fresh DB read (bypasses the memoized
  // app_settings promise) AND writes the resolved phrases list back
  // to localStorage so the NEXT synchronous getPhrases() call doesn't
  // paint a stale snapshot. Without this, the home page kept rendering
  // an old phrase (e.g. 하늘의 별 따기) even after the admin queue had
  // been replaced — the deferred async render saw fresh data but the
  // browser's localStorage K_PHRASES was still the old list.
  await loadAppSettings(opts && opts.force ? { force: true } : undefined);
  var rows = getPhrases();
  try {
    var raw = _appSettings && _appSettings.phrases;
    if (raw && typeof raw === 'string') { try { raw = JSON.parse(raw); } catch(e) { raw = null; } }
    if (Array.isArray(raw) && raw.length) {
      lsSet(K_PHRASES, raw);
      // Drop the home block's stashed "today" cache so the picker
      // re-resolves against the fresh queue.
      try { localStorage.removeItem('kh_phrase_today'); } catch(_) {}
    }
  } catch(_) {}
  return rows;
}

async function saveSharedPhrases(rows) {
  var normalized = (rows || []).map(normalizePhrase).filter(function(row){ return row.ko; });
  if (!normalized.length) normalized = DEF_PHRASES.map(normalizePhrase);
  lsSet(K_PHRASES, normalized);
  _appSettings.phrases = normalized;
  // Invalidate the home page's "today's phrase" cache so a freshly-
  // saved queue (delete / edit / bulk add) is reflected immediately
  // on next home render. Without this, the cached idx kept pointing
  // at a deleted phrase even after the admin changes settled.
  try { localStorage.removeItem('kh_phrase_today'); } catch(_) {}

  var sb = getSupa();
  if (!sb || !supaUser) {
    try { console.warn('[saveSharedPhrases] no auth — DB not updated. Admin must be signed in for the queue to propagate to the home page.'); } catch(_) {}
    return normalized;
  }
  try {
    var res = await sb.from('app_settings').upsert({
      key: 'phrases',
      value: normalized,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });
    if (res && res.error) {
      try { console.error('[saveSharedPhrases] DB upsert FAILED:', res.error); } catch(_) {}
      try { if (typeof toast === 'function') toast('⚠ DB 저장 실패: ' + (res.error.message || 'unknown') + ' — 홈에 반영되지 않습니다', true); } catch(_) {}
    } else {
      try { console.log('[saveSharedPhrases] DB updated, ' + normalized.length + ' phrases'); } catch(_) {}
    }
  } catch(e) {
    try { console.error('[saveSharedPhrases] DB upsert THREW:', e); } catch(_) {}
    try { if (typeof toast === 'function') toast('⚠ DB 저장 예외: ' + (e && e.message || e), true); } catch(_) {}
  }
  return normalized;
}
