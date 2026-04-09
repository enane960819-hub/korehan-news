/* kh-vocab.js — Vocabulary dictionary, saved words, tooltips */
// ── 저장 단어 ─────────────────────────────────────────────────
var K_SAVED = 'korehan_saved_words';
var _savedWordsSet = null; // Set of ko strings, populated from DB on auth

// Fetch saved words from DB and populate _savedWordsSet (call after auth ready)
async function _syncSavedWordsFromDB() {
  if (!supaUser) { _savedWordsSet = null; return; }
  var sb = getSupa();
  if (!sb) return;
  try {
    var res = await sb.from('user_saved_words').select('word_ko').eq('user_id', supaUser.id);
    if (res.data && res.data.length) {
      _savedWordsSet = new Set();
      res.data.forEach(function(row) {
        if (row.word_ko) _savedWordsSet.add(row.word_ko);
      });
      var normalized = res.data.map(function(r){ return { ko:r.word_ko||'' }; }).filter(function(w){ return w.ko; });
      lsSet(K_SAVED, normalized);
    } else {
      _savedWordsSet = new Set();
    }
  } catch(e) {
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
    var res = await sb.from('user_saved_words').select('word_ko, word_en, word_rom, created_at').eq('user_id', supaUser.id).order('created_at', { ascending: false });
    if (res.data && res.data.length) {
      var normalized = res.data.map(function(r){ return { ko:r.word_ko||'', rom:r.word_rom||'', en:r.word_en||'' }; }).filter(function(w){ return w.ko; });
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
      console.warn('[dbSaveWord] upsert error:', res.error.message);
      return { ok: false, source: 'local', error: res.error };
    }
  } catch(e) {
    console.warn('[dbSaveWord] exception:', e);
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
    await sb.from('user_saved_words').delete().eq('user_id', supaUser.id).eq('word_ko', ko);
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
        btn.textContent = '✓ Saved';
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
        btn.textContent = '✓ Saved';
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

// ── VOCAB ─────────────────────────────────────────────────────
var VOCAB = {
  /* ── 정치 / 행정 ── */
  "대통령":{"en":"president","rom":"dae-tong-ryeong"},
  "국회":{"en":"National Assembly","rom":"guk-hoe"},
  "정부":{"en":"government","rom":"jeong-bu"},
  "법안":{"en":"bill / legislation","rom":"beob-an"},
  "표결":{"en":"vote","rom":"pyo-gyeol"},
  "발표":{"en":"announcement","rom":"bal-pyo"},
  "승인":{"en":"approval","rom":"seung-in"},
  "확정":{"en":"confirmed","rom":"hwak-jeong"},
  "검토":{"en":"review / consideration","rom":"geom-to"},
  "결정":{"en":"decision","rom":"gyeol-jeong"},
  "지지율":{"en":"approval rating","rom":"ji-ji-yul"},
  "정책":{"en":"policy","rom":"jeong-chaek"},
  "선거":{"en":"election","rom":"seon-geo"},
  "후보":{"en":"candidate","rom":"hu-bo"},
  "여당":{"en":"ruling party","rom":"yeo-dang"},
  "야당":{"en":"opposition party","rom":"ya-dang"},
  "국무총리":{"en":"prime minister","rom":"guk-mu-chong-ri"},
  "장관":{"en":"minister","rom":"jang-gwan"},
  "국민":{"en":"citizen / people","rom":"gung-min"},
  "행정":{"en":"administration","rom":"haeng-jeong"},
  "개혁":{"en":"reform","rom":"gae-hyeok"},
  "청와대":{"en":"Blue House (presidential office)","rom":"cheong-wa-dae"},
  "민주주의":{"en":"democracy","rom":"min-ju-ju-eui"},
  "헌법":{"en":"constitution","rom":"heon-beob"},
  "탄핵":{"en":"impeachment","rom":"tan-haek"},
  /* ── 경제 / 금융 ── */
  "경제":{"en":"economy / economic","rom":"gyeong-je"},
  "회복":{"en":"recovery","rom":"hoe-bok"},
  "투자":{"en":"investment","rom":"tu-ja"},
  "민간":{"en":"private sector","rom":"min-gan"},
  "기준금리":{"en":"base interest rate","rom":"gi-jun-geum-ri"},
  "금리":{"en":"interest rate","rom":"geum-ri"},
  "동결":{"en":"freeze / hold","rom":"dong-gyeol"},
  "인하":{"en":"cut / reduction","rom":"in-ha"},
  "인상":{"en":"raise / increase","rom":"in-sang"},
  "수출":{"en":"export","rom":"su-chul"},
  "수입":{"en":"import","rom":"su-ip"},
  "무역":{"en":"trade","rom":"mu-yeok"},
  "흑자":{"en":"surplus","rom":"heuk-ja"},
  "적자":{"en":"deficit","rom":"jeok-ja"},
  "코스피":{"en":"KOSPI (Korea stock index)","rom":"ko-seu-pi"},
  "부동산":{"en":"real estate","rom":"bu-dong-san"},
  "아파트":{"en":"apartment","rom":"a-pa-teu"},
  "반도체":{"en":"semiconductor","rom":"ban-do-che"},
  "공급":{"en":"supply","rom":"gong-geup"},
  "수요":{"en":"demand","rom":"su-yo"},
  "계약":{"en":"contract","rom":"gye-yak"},
  "양산":{"en":"mass production","rom":"yang-san"},
  "하반기":{"en":"second half of year","rom":"ha-ban-gi"},
  "상반기":{"en":"first half of year","rom":"sang-ban-gi"},
  "성장":{"en":"growth","rom":"seong-jang"},
  "물가":{"en":"prices / cost of living","rom":"mul-ga"},
  "인플레이션":{"en":"inflation","rom":"in-peul-le-i-syeon"},
  "예산":{"en":"budget","rom":"ye-san"},
  "세금":{"en":"tax","rom":"se-geum"},
  "주가":{"en":"stock price","rom":"ju-ga"},
  "기업":{"en":"company / enterprise","rom":"gi-eob"},
  "매출":{"en":"revenue / sales","rom":"mae-chul"},
  "이익":{"en":"profit","rom":"i-ik"},
  "손실":{"en":"loss","rom":"son-sil"},
  /* ── 사회 ── */
  "사회":{"en":"society","rom":"sa-hoe"},
  "교원":{"en":"teacher / educator","rom":"gyo-won"},
  "파업":{"en":"strike","rom":"pa-eob"},
  "예고":{"en":"notice / warning","rom":"ye-go"},
  "저출생":{"en":"low birth rate","rom":"jeo-chul-saeng"},
  "위기":{"en":"crisis","rom":"wi-gi"},
  "인구":{"en":"population","rom":"in-gu"},
  "고령화":{"en":"aging (society)","rom":"go-ryeong-hwa"},
  "복지":{"en":"welfare","rom":"bok-ji"},
  "의료":{"en":"medical / healthcare","rom":"eui-ryo"},
  "병원":{"en":"hospital","rom":"byeong-won"},
  "교육":{"en":"education","rom":"gyo-yuk"},
  "대학":{"en":"university","rom":"dae-hak"},
  "취업":{"en":"employment / getting a job","rom":"chwi-eob"},
  "실업":{"en":"unemployment","rom":"sil-eob"},
  "노동":{"en":"labor / work","rom":"no-dong"},
  "근로자":{"en":"worker / employee","rom":"geun-ro-ja"},
  "최저임금":{"en":"minimum wage","rom":"choe-jeo-im-geum"},
  "주거":{"en":"housing / residence","rom":"ju-geo"},
  "범죄":{"en":"crime","rom":"beom-joe"},
  "사건":{"en":"incident / case","rom":"sa-geon"},
  "사고":{"en":"accident","rom":"sa-go"},
  "피해":{"en":"damage / harm","rom":"pi-hae"},
  "지원":{"en":"support / aid","rom":"ji-won"},
  "봉사":{"en":"volunteer service","rom":"bong-sa"},
  /* ── 국제 / 외교 ── */
  "국제":{"en":"international","rom":"guk-je"},
  "유엔":{"en":"United Nations","rom":"yu-en"},
  "안보리":{"en":"Security Council","rom":"an-bo-ri"},
  "긴급":{"en":"emergency / urgent","rom":"gin-geup"},
  "회의":{"en":"meeting / conference","rom":"hoe-eui"},
  "결의":{"en":"resolution","rom":"gyeol-eui"},
  "나토":{"en":"NATO","rom":"na-to"},
  "방위비":{"en":"defense spending","rom":"bang-wi-bi"},
  "정상":{"en":"summit / leader","rom":"jeong-sang"},
  "중동":{"en":"Middle East","rom":"jung-dong"},
  "협약":{"en":"treaty / agreement","rom":"hyeob-yak"},
  "탄소중립":{"en":"carbon neutrality","rom":"tan-so-jung-nip"},
  "협상":{"en":"negotiation","rom":"hyeob-sang"},
  "합의":{"en":"agreement","rom":"hab-eui"},
  "외교":{"en":"diplomacy","rom":"oe-gyo"},
  "대사관":{"en":"embassy","rom":"dae-sa-gwan"},
  "제재":{"en":"sanctions","rom":"je-jae"},
  "동맹":{"en":"alliance","rom":"dong-maeng"},
  "군사":{"en":"military","rom":"gun-sa"},
  "전쟁":{"en":"war","rom":"jeon-jaeng"},
  "휴전":{"en":"ceasefire","rom":"hyu-jeon"},
  "핵":{"en":"nuclear","rom":"haek"},
  "미사일":{"en":"missile","rom":"mi-sa-il"},
  "북한":{"en":"North Korea","rom":"buk-han"},
  "남한":{"en":"South Korea","rom":"nam-han"},
  "한반도":{"en":"Korean Peninsula","rom":"han-ban-do"},
  "평화":{"en":"peace","rom":"pyeong-hwa"},
  /* ── 문화 / 연예 ── */
  "문화":{"en":"culture","rom":"mun-hwa"},
  "공연":{"en":"performance / show","rom":"gong-yeon"},
  "매진":{"en":"sold out","rom":"mae-jin"},
  "드라마":{"en":"drama / TV series","rom":"deu-ra-ma"},
  "김장":{"en":"kimchi-making tradition","rom":"gim-jang"},
  "등재":{"en":"registration / listing","rom":"deung-jae"},
  "무형문화유산":{"en":"intangible cultural heritage","rom":"mu-hyeong-mun-hwa-yu-san"},
  "수상":{"en":"award / prize","rom":"su-sang"},
  "개막":{"en":"opening / premiere","rom":"gae-mak"},
  "영화":{"en":"movie / film","rom":"yeong-hwa"},
  "음악":{"en":"music","rom":"eum-ak"},
  "전시":{"en":"exhibition","rom":"jeon-si"},
  "축제":{"en":"festival","rom":"chuk-je"},
  "한류":{"en":"Korean Wave (Hallyu)","rom":"han-ryu"},
  "케이팝":{"en":"K-pop","rom":"ke-i-pap"},
  "웹툰":{"en":"webtoon","rom":"web-tun"},
  "배우":{"en":"actor / actress","rom":"bae-u"},
  "가수":{"en":"singer","rom":"ga-su"},
  /* ── 스포츠 ── */
  "스포츠":{"en":"sports","rom":"seu-po-cheu"},
  "손흥민":{"en":"Son Heung-min (footballer)","rom":"son-heung-min"},
  "챔피언스리그":{"en":"Champions League","rom":"chaem-pi-eon-seu-ri-geu"},
  "결승":{"en":"final / decisive match","rom":"gyeol-seung"},
  "진출":{"en":"advancement","rom":"jin-chul"},
  "기록":{"en":"record","rom":"gi-rok"},
  "우승":{"en":"championship / winning","rom":"u-seung"},
  "패배":{"en":"defeat / loss","rom":"pae-bae"},
  "경기":{"en":"game / match","rom":"gyeong-gi"},
  "선수":{"en":"athlete / player","rom":"seon-su"},
  "올림픽":{"en":"Olympics","rom":"ol-lim-pik"},
  "월드컵":{"en":"World Cup","rom":"wol-deu-keob"},
  "야구":{"en":"baseball","rom":"ya-gu"},
  "축구":{"en":"football / soccer","rom":"chuk-gu"},
  "농구":{"en":"basketball","rom":"nong-gu"},
  /* ── 과학 / 기술 ── */
  "기술":{"en":"technology","rom":"gi-sul"},
  "인공지능":{"en":"artificial intelligence","rom":"in-gong-ji-neung"},
  "로봇":{"en":"robot","rom":"ro-bot"},
  "우주":{"en":"space / universe","rom":"u-ju"},
  "발사":{"en":"launch","rom":"bal-sa"},
  "위성":{"en":"satellite","rom":"wi-seong"},
  "연구":{"en":"research","rom":"yeon-gu"},
  "개발":{"en":"development","rom":"gae-bal"},
  "특허":{"en":"patent","rom":"teuk-heo"},
  "전기차":{"en":"electric vehicle","rom":"jeon-gi-cha"},
  "배터리":{"en":"battery","rom":"bae-teo-ri"},
  "태양광":{"en":"solar power","rom":"tae-yang-gwang"},
  "재생에너지":{"en":"renewable energy","rom":"jae-saeng-e-neo-ji"},
  /* ── 환경 ── */
  "환경":{"en":"environment","rom":"hwan-gyeong"},
  "기후":{"en":"climate","rom":"gi-hu"},
  "온난화":{"en":"global warming","rom":"on-nan-hwa"},
  "미세먼지":{"en":"fine dust / PM2.5","rom":"mi-se-meon-ji"},
  "홍수":{"en":"flood","rom":"hong-su"},
  "태풍":{"en":"typhoon","rom":"tae-pung"},
  "지진":{"en":"earthquake","rom":"ji-jin"},
  /* ── 도시 / 지역 ── */
  "서울":{"en":"Seoul","rom":"seo-ul"},
  "한강":{"en":"Han River","rom":"han-gang"},
  "부산":{"en":"Busan","rom":"bu-san"},
  "인천":{"en":"Incheon","rom":"in-cheon"},
  "제주":{"en":"Jeju Island","rom":"je-ju"},
  "경기도":{"en":"Gyeonggi Province","rom":"gyeong-gi-do"},
  "전국":{"en":"nationwide","rom":"jeon-guk"},
  "지역":{"en":"region / area","rom":"ji-yeok"},
  "계획":{"en":"plan","rom":"gye-hoek"},
  "개통":{"en":"opening / launch","rom":"gae-tong"},
  "건설":{"en":"construction","rom":"geon-seol"},
  /* ── 뉴스 일반 ── */
  "속보":{"en":"breaking news","rom":"sok-bo"},
  "뉴스":{"en":"news","rom":"nyu-seu"},
  "한국":{"en":"Korea / Korean","rom":"han-guk"},
  "역대":{"en":"all-time / in history","rom":"yeok-dae"},
  "안정":{"en":"stability","rom":"an-jeong"},
  "열풍":{"en":"craze / boom","rom":"yeol-pung"},
  "논란":{"en":"controversy","rom":"non-ran"},
  "비판":{"en":"criticism","rom":"bi-pan"},
  "지적":{"en":"pointing out / indication","rom":"ji-jeok"},
  "강조":{"en":"emphasis","rom":"gang-jo"},
  "주장":{"en":"claim / argument","rom":"ju-jang"},
  "분석":{"en":"analysis","rom":"bun-seok"},
  "전망":{"en":"outlook / forecast","rom":"jeon-mang"},
  "우려":{"en":"concern / worry","rom":"u-ryeo"},
  "기대":{"en":"expectation / anticipation","rom":"gi-dae"},
  "목표":{"en":"goal / target","rom":"mok-pyo"},
  "성과":{"en":"achievement / result","rom":"seong-gwa"},
  "영향":{"en":"influence / impact","rom":"yeong-hyang"},
  "변화":{"en":"change","rom":"byeon-hwa"},
  "증가":{"en":"increase","rom":"jeung-ga"},
  "감소":{"en":"decrease","rom":"gam-so"},
  "확대":{"en":"expansion","rom":"hwak-dae"},
  "축소":{"en":"reduction / downsizing","rom":"chuk-so"},
  "강화":{"en":"strengthening","rom":"gang-hwa"},
  /* ── 기초 어휘 ── */
  "학교":{"en":"school","rom":"hak-gyo"},
  "가족":{"en":"family","rom":"ga-jok"},
  "봄":{"en":"spring","rom":"bom"},
  "여름":{"en":"summer","rom":"yeo-reum"},
  "가을":{"en":"autumn","rom":"ga-eul"},
  "겨울":{"en":"winter","rom":"gye-ul"},
  "오늘":{"en":"today","rom":"o-neul"},
  "내일":{"en":"tomorrow","rom":"nae-il"},
  "어제":{"en":"yesterday","rom":"eo-je"},
  "시간":{"en":"time / hour","rom":"si-gan"},
  "사람":{"en":"person / people","rom":"sa-ram"},
  "나라":{"en":"country","rom":"na-ra"},
  "도시":{"en":"city","rom":"do-si"},
  "집":{"en":"house / home","rom":"jip"},
  "돈":{"en":"money","rom":"don"},
  "일":{"en":"work / day","rom":"il"},
  "문제":{"en":"problem / issue","rom":"mun-je"},
  "방법":{"en":"method / way","rom":"bang-beob"},
  "필요":{"en":"necessary / need","rom":"pil-ryo"},
  "중요":{"en":"important","rom":"jung-yo"},
  "가능":{"en":"possible","rom":"ga-neung"},
};

// ── TOOLTIP ───────────────────────────────────────────────────
function initTooltips() {
  var tip = document.createElement('div');
  tip.id = 'kh-tip';
  Object.assign(tip.style, {
    position:'fixed', zIndex:'9999', pointerEvents:'none',
    background:'#0d1b2e', color:'#fff',
    padding:'8px 12px', borderRadius:'4px',
    fontFamily:"'Source Sans 3', sans-serif", fontSize:'13px',
    borderLeft:'3px solid #2255a4',
    boxShadow:'0 4px 16px rgba(0,0,0,0.35)',
    maxWidth:'220px', lineHeight:'1.4',
    opacity:'0', transition:'opacity 0.15s',
    whiteSpace:'nowrap',
  });
  document.body.appendChild(tip);

  document.querySelectorAll('.vocab-zone').forEach(function(el){ wrapVocab(el); });

  // 어드민 전용 편집 버튼 표시 (로그인 체크 후)
  if (window._isAdmin) {
    var adminBar = document.createElement('div');
    adminBar.id = 'vocab-admin-bar';
    adminBar.style.cssText = 'position:fixed;bottom:70px;right:16px;z-index:8000;background:#0b1626;color:#fff;border-radius:10px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.1);';
    adminBar.textContent = '✏️ Vocab Edit Mode';
    adminBar.onclick = function() { toggleVocabEditMode(); };
    document.body.appendChild(adminBar);
  }

  document.addEventListener('mouseover', function(e) {
    var w = e.target.closest ? e.target.closest('.kh-word') : null;
    if (!w) return;
    var word = w.dataset.word;
    var d = VOCAB[word];
    if (window._vocabEditMode && window._isAdmin) {
      tip.innerHTML = '<span style="font-size:13px;color:#fbbf24;font-weight:700">✏️ Click to edit</span><br>'
        + '<span style="color:#7ab8f5;font-weight:700">' + word + '</span>'
        + (d ? '<br><span style="color:#94a3b8;font-size:11px">' + d.en + '</span>' : '<br><span style="color:#f87171;font-size:11px">No definition</span>');
      tip.style.opacity = '1';
      return;
    }
    if (!d) return;
    tip.innerHTML = '<span style="font-size:16px;font-weight:700;color:#7ab8f5">' + word + '</span><br>'
      + '<span style="color:#aabbd0;font-size:11px;font-style:italic">' + d.rom + '</span><br>'
      + '<strong>' + d.en + '</strong>';
    tip.style.opacity = '1';
  });
  document.addEventListener('mousemove', function(e) {
    tip.style.left = (e.clientX + 14) + 'px';
    tip.style.top  = (e.clientY - 10) + 'px';
  });
  document.addEventListener('mouseout', function(e) {
    if (e.target.closest && e.target.closest('.kh-word')) tip.style.opacity = '0';
  });

  // 어드민 편집 모드 클릭/터치 처리
  function _editModeWordHandler(e) {
    if (!window._vocabEditMode || !window._isAdmin) return;
    var w = e.target.closest ? e.target.closest('.kh-word') : null;
    if (!w) return;
    // touchend: selection이 있으면 _handleVocabSelectionTouch가 처리
    if (e.type === 'touchend') {
      var sel = window.getSelection();
      if (sel && sel.toString().trim().length > 0) return;
    }
    e.preventDefault(); e.stopPropagation();
    tip.style.opacity = '0';
    openVocabEditModal(w.dataset.word);
  }
  document.addEventListener('click',    _editModeWordHandler);
  document.addEventListener('touchend', _editModeWordHandler, { passive: false });
}

var _vocabEditModeActive = false;
function toggleVocabEditMode() {
  window._vocabEditMode = !window._vocabEditMode;
  _vocabEditModeActive = window._vocabEditMode;
  var bar = document.getElementById('vocab-admin-bar');
  if (bar) {
    if (window._vocabEditMode) {
      bar.innerHTML = '<span>✅ Edit ON</span>'
        + '<button id="vocab-add-new-btn" onclick="event.stopPropagation();openVocabEditModal(\'\')" '
        + 'style="margin-left:8px;background:#2255a4;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">+ New Word</button>';
      bar.style.background = '#16a34a';
      bar.style.padding = '8px 12px';
    } else {
      bar.textContent = '✏️ Vocab Edit Mode';
      bar.style.background = '#0b1626';
      bar.style.padding = '8px 14px';
    }
  }
  document.querySelectorAll('.kh-word').forEach(function(w) {
    w.style.outline = window._vocabEditMode ? '2px dashed #fbbf24' : '';
    w.style.cursor  = window._vocabEditMode ? 'pointer' : '';
    w.style.borderRadius = window._vocabEditMode ? '2px' : '';
  });

  // 드래그/터치 선택 팝업 — 편집 모드 ON 시 등록
  if (window._vocabEditMode) {
    document.addEventListener('mouseup',  _handleVocabSelection);
    document.addEventListener('touchend', _handleVocabSelectionTouch);
  } else {
    document.removeEventListener('mouseup',  _handleVocabSelection);
    document.removeEventListener('touchend', _handleVocabSelectionTouch);
    var pop = document.getElementById('vocab-select-popup');
    if (pop) pop.remove();
  }
}

function _handleVocabSelectionTouch(e) {
  // On touch, selection needs a tick to settle after touchend
  setTimeout(function() { _handleVocabSelection(e); }, 80);
}

function _handleVocabSelection(e) {
  if (!window._vocabEditMode || !window._isAdmin) return;
  if (e.target && e.target.closest && (e.target.closest('#vocab-edit-modal') || e.target.closest('#vocab-select-popup') || e.target.closest('#vocab-admin-bar'))) return;

  var sel = window.getSelection();
  var text = sel ? sel.toString().trim() : '';

  var old = document.getElementById('vocab-select-popup');
  if (old) old.remove();

  if (!text || text.length < 1 || text.length > 15) return;
  if (!/[가-힣]/.test(text)) return;

  // 팝업 위치 — fixed 기준이므로 scrollY 더하면 안 됨
  var rect = null;
  try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch(err) { return; }
  if (!rect || rect.width === 0) return;

  var pop = document.createElement('div');
  pop.id = 'vocab-select-popup';
  pop.style.cssText = [
    'position:fixed',
    'z-index:99998',
    'background:#0b1626',
    'color:#fff',
    'border-radius:8px',
    'padding:9px 14px',
    'font-size:13px',
    'font-weight:700',
    'cursor:pointer',
    'box-shadow:0 4px 20px rgba(0,0,0,.5)',
    'border:1px solid rgba(255,255,255,.15)',
    'white-space:nowrap',
    'user-select:none'
  ].join(';');

  var leftPos = Math.max(8, Math.min(rect.left + rect.width / 2 - 70, window.innerWidth - 200));
  var topPos  = Math.max(8, rect.top - 48);
  pop.style.left = leftPos + 'px';
  pop.style.top  = topPos  + 'px';
  pop.innerHTML = '+ Add <span style="color:#7ab8f5;font-weight:900">' + text + '</span>';

  var selCopy = text; // 클로저용 복사
  pop.onclick = function(ev) {
    ev.stopPropagation();
    pop.remove();
    if (sel) sel.removeAllRanges();
    openVocabEditModal(selCopy);
  };
  document.body.appendChild(pop);

  // 다른 곳 클릭 시 팝업 닫기
  setTimeout(function() {
    function closePop(e2) {
      if (!e2.target.closest || !e2.target.closest('#vocab-select-popup')) {
        var p = document.getElementById('vocab-select-popup');
        if (p) p.remove();
        document.removeEventListener('mousedown', closePop);
      }
    }
    document.addEventListener('mousedown', closePop);
  }, 50);
}

function openVocabEditModal(word) {
  var existing = VOCAB[word] || { rom: '', en: '' };
  var isNew = !word; // 새 단어 Type Answer 모드
  var modal = document.createElement('div');
  modal.id = 'vocab-edit-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML =
    '<div style="background:#fff;border-radius:16px;padding:24px;max-width:400px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,.3);">'
    + '<div style="font-size:16px;font-weight:900;color:#0f172a;margin-bottom:16px;">✏️ ' + (isNew ? 'Add New Word' : 'Edit Word: <span style="color:#2255a4">' + word + '</span>') + '</div>'
    + (isNew
      ? '<label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Korean Word <span style="color:#e53e3e">*</span></label>'
        + '<input id="ve-word" placeholder="e.g. 환경" style="width:100%;padding:8px 12px;border:2px solid #2255a4;border-radius:8px;font-size:16px;font-family:\'Noto Serif KR\',serif;margin-bottom:12px;box-sizing:border-box;" autofocus>'
      : '')
    + '<label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Pronunciation (romanization)</label>'
    + '<input id="ve-rom" value="' + existing.rom + '" placeholder="e.g. hwan-gyeong" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;margin-bottom:12px;box-sizing:border-box;">'
    + '<label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">English Meaning <span style="color:#e53e3e">*</span></label>'
    + '<input id="ve-en" value="' + existing.en + '" placeholder="e.g. environment" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;margin-bottom:6px;box-sizing:border-box;">'
    + '<div id="ve-err" style="font-size:12px;color:#e53e3e;margin-bottom:12px;display:none;"></div>'
    + '<div style="display:flex;gap:8px;margin-top:16px;">'
    + '<button id="ve-save" style="flex:1;padding:10px;background:#2255a4;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:800;cursor:pointer;">Save</button>'
    + (!isNew && existing.en ? '<button id="ve-del" style="padding:10px 16px;background:#fee2e2;color:#b91c1c;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">Delete</button>' : '')
    + '<button id="ve-cancel" style="padding:10px 16px;background:#f1f5f9;color:#475569;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">Cancel</button>'
    + '</div></div>';

  document.body.appendChild(modal);

  modal.querySelector('#ve-cancel').onclick = function() { modal.remove(); };
  modal.onclick = function(e) { if (e.target === modal) modal.remove(); };

  var delBtn = modal.querySelector('#ve-del');
  if (delBtn) {
    delBtn.onclick = async function() {
      if (!confirm(word + '  — delete this word?')) return;
      await saveVocabToDB(word, null, null, true);
      delete VOCAB[word];
      // 해당 단어 span 제거
      document.querySelectorAll('.kh-word[data-word="' + word + '"]').forEach(function(s) {
        s.replaceWith(document.createTextNode(s.textContent));
      });
      modal.remove();
      showToast('🗑 ' + word + ' deleted');
    };
  }

  modal.querySelector('#ve-save').onclick = async function() {
    var wordEl = modal.querySelector('#ve-word');
    var finalWord = isNew ? (wordEl ? wordEl.value.trim() : '') : word;
    var rom = modal.querySelector('#ve-rom').value.trim();
    var en  = modal.querySelector('#ve-en').value.trim();
    var err = modal.querySelector('#ve-err');
    if (isNew && (!finalWord || !/[가-힣]/.test(finalWord))) {
      err.textContent = 'Please enter a Korean word.'; err.style.display='block'; return;
    }
    if (!en) { err.textContent = 'Please enter an English meaning.'; err.style.display='block'; return; }
    var btn = modal.querySelector('#ve-save');
    btn.textContent = 'Saving...'; btn.disabled = true;
    try {
      await saveVocabToDB(finalWord, rom, en, false);
      VOCAB[finalWord] = { rom: rom, en: en };
      // 로컬 변수 word를 finalWord로 덮어씌워 이하 코드가 올바른 단어를 참조
      word = finalWord;

      // 기존 .kh-word tooltip 즉시 업데이트
      document.querySelectorAll('.kh-word[data-word="' + word + '"]').forEach(function(s) {
        s.title = en;
      });

      // 새 단어면 본문에 즉시 하이라이트 추가
      var alreadyWrapped = document.querySelectorAll('.kh-word[data-word="' + word + '"]').length > 0;
      if (!alreadyWrapped) {
        document.querySelectorAll('.vocab-zone').forEach(function(zone) {
          wrapSingleWord(zone, word);
        });
      }

      // KEY VOCABULARY 섹션에 즉시 추가
      _addWordToKeyVocabList(word, rom, en);

      modal.remove();
      showToast('✅ ' + word + ' saved');
    } catch(e) {
      err.textContent = 'Save failed:' + e.message;
      err.style.display = 'block';
      btn.textContent = 'Save'; btn.disabled = false;
    }
  };
}

function wrapSingleWord(el, word) {
  var esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var regex = new RegExp('(' + esc + ')', 'g');
  var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: function(n) {
      if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      var p = n.parentNode;
      while (p) {
        if (p.classList && p.classList.contains('kh-word')) return NodeFilter.FILTER_REJECT;
        p = p.parentNode;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  var nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(function(node) {
    if (!regex.test(node.nodeValue)) return;
    regex.lastIndex = 0;
    var frag = document.createDocumentFragment();
    var last = 0, m;
    while ((m = regex.exec(node.nodeValue)) !== null) {
      if (m.index > last) frag.appendChild(document.createTextNode(node.nodeValue.slice(last, m.index)));
      var span = document.createElement('span');
      span.className = 'kh-word';
      span.dataset.word = word;
      if (window._vocabEditMode) {
        span.style.outline = '1px dashed #fbbf24';
        span.style.cursor  = 'pointer';
      }
      span.textContent = m[1];
      frag.appendChild(span);
      last = m.index + m[1].length;
    }
    if (last < node.nodeValue.length) frag.appendChild(document.createTextNode(node.nodeValue.slice(last)));
    node.parentNode.replaceChild(frag, node);
  });
}

// ── Word Bank: click to save ─────────────────────────────────
async function khSaveWbWord(rowEl, ko, rom, en) {
  if (!rowEl || rowEl.classList.contains('saved')) return;
  // Optimistic UI
  rowEl.classList.add('saving');
  var icon = rowEl.querySelector('.kh-wb-save-icon');
  if (icon) icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  try {
    var sb = getSupa();
    var user = supaUser;
    if (!sb || !user) {
      // Not logged in — show brief prompt
      rowEl.classList.remove('saving');
      rowEl.classList.add('save-fail');
      if (icon) icon.title = 'Sign in to save words';
      setTimeout(function(){ rowEl.classList.remove('save-fail'); }, 1800);
      return;
    }
    if (typeof saveWord === 'function') {
      await saveWord(sb, { wordKey: ko, wordKo: ko, wordRom: rom, wordEn: en, sourceKind: 'manual' });
    } else {
      await sb.rpc('save_or_update_word', {
        p_word_key: ko, p_word_ko: ko, p_word_rom: rom || null, p_word_en: en || null,
        p_source_kind: 'manual', p_source_content_type: null, p_source_content_id: null,
        p_interest_tag: null, p_review_delta: 0, p_correct_delta: 0, p_wrong_delta: 0
      });
    }
    // Update in-memory set + localStorage + 카운터/XP 증가
    if (_savedWordsSet) _savedWordsSet.add(ko);
    var wbSaved = lsGet(K_SAVED, []);
    var wbAlready = !!wbSaved.find(function(w){ return w.ko === ko; });
    if (!wbAlready) {
      wbSaved.push({ ko: ko, rom: rom, en: en });
      lsSet(K_SAVED, wbSaved);
      if (typeof trackActivityOnWordSave === 'function') trackActivityOnWordSave();
    }
    rowEl.classList.remove('saving');
    rowEl.classList.add('saved');
  } catch(e) {
    rowEl.classList.remove('saving');
    rowEl.classList.add('save-fail');
    if (icon) {
      icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';
    }
    setTimeout(function(){ rowEl.classList.remove('save-fail'); }, 1800);
  }
}

