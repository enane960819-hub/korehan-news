/* ============================================================
   KoreHan News — Shared JS  (버그 수정 버전)
   ============================================================ */

// ── Supabase ──────────────────────────────────────────────────
const SUPA_URL = 'https://samghztrdvtxmrmawneu.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWdoenRyZHZ0eG1ybWF3bmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzQ3NTIsImV4cCI6MjA4ODAxMDc1Mn0.UCt6Z76XTmJGbhHdX744tM8BKDdVhqRiCLuQi6w-rNs';

// Supabase 클라이언트 (CDN 로드 후 초기화)
var _supa = null;
function getSupa() {
  if (_supa) return _supa;
  if (window.supabase) {
    _supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);
    return _supa;
  }
  return null;
}

// 현재 로그인 유저
var supaUser = null;

// Google 로그인
async function signInWithGoogle() {
  var sb = getSupa();
  if (!sb) { toast('Supabase 로드 중입니다. 잠시 후 다시 시도해주세요.', true); return; }
  var { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/index.html' }
  });
  if (error) toast('로그인 오류: ' + error.message, true);
}

// 로그아웃
async function signOut() {
  var sb = getSupa();
  if (sb) await sb.auth.signOut();
  supaUser = null;
  updateAuthUI();
  toast('로그아웃되었습니다');
}

// 세션 확인
async function checkSession() {
  var sb = getSupa();
  if (!sb) return;
  var { data } = await sb.auth.getSession();
  if (data && data.session && data.session.user) {
    supaUser = data.session.user;
    updateAuthUI();
  }
  // 세션 변화 감지
  sb.auth.onAuthStateChange(function(event, session) {
    supaUser = session ? session.user : null;
    updateAuthUI();
    updateCommentForm();
  });
}

// UI 업데이트
function updateAuthUI() {
  var signinBtn  = document.getElementById('topbar-signin-btn');
  var adminBtn   = document.getElementById('topbar-admin-btn');
  var userAvatar = document.getElementById('topbar-user-avatar');

  // 관리자 이메일 목록 (본인 Gmail 추가)
  var ADMIN_EMAILS = ['enane960819@gmail.com'];
  var isAdmin = supaUser && ADMIN_EMAILS.includes(supaUser.email);

  if (supaUser) {
    // 로그인 상태
    if (signinBtn) {
      signinBtn.textContent = '로그아웃';
      signinBtn.onclick = function(e){ e.preventDefault(); signOut(); };
    }
    if (userAvatar) {
      var avatar = supaUser.user_metadata && supaUser.user_metadata.avatar_url;
      userAvatar.style.display = 'inline-flex';
      userAvatar.innerHTML = avatar
        ? '<img src="' + avatar + '" style="width:28px;height:28px;border-radius:50%;vertical-align:middle">'
        : '<span style="font-size:13px">' + (supaUser.email || '').charAt(0).toUpperCase() + '</span>';
    }
    // 마이페이지 버튼
    var mypageBtn = document.getElementById('topbar-mypage-btn');
    if (mypageBtn) mypageBtn.style.display = 'inline-block';

    if (adminBtn) adminBtn.style.display = isAdmin ? 'inline-block' : 'none';
  } else {
    // 비로그인 상태
    if (signinBtn) {
      signinBtn.textContent = 'Sign In';
      signinBtn.onclick = function(e){ e.preventDefault(); signInWithGoogle(); };
    }
    if (userAvatar) userAvatar.style.display = 'none';
    if (adminBtn) adminBtn.style.display = 'none';
    var mypageBtn = document.getElementById('topbar-mypage-btn');
    if (mypageBtn) mypageBtn.style.display = 'none';
  }
}

const DB_KEY          = 'korehan_db';
const K_PHRASES       = 'korehan_phrases';
const K_WORDBANK      = 'korehan_wordbank';
const K_SENTENCES     = 'korehan_sentences';
const K_OPINIONS      = 'korehan_opinions';
const K_ADMIN_SESSION = 'korehan_admin_session';

const DEF_PHRASES = [
  {ko:'경제 회복', rom:'gyeong-je hoe-bok', en:'economic recovery'},
  {ko:'민간투자',  rom:'min-gan tu-ja',     en:'private investment'},
  {ko:'반도체',    rom:'ban-do-che',        en:'semiconductor'},
];
const DEF_WORDBANK = [
  {ko:'뉴스', rom:'nyu-seu',  en:'news'},
  {ko:'사회', rom:'sa-hoe',   en:'society'},
  {ko:'국제', rom:'guk-je',   en:'international'},
  {ko:'문화', rom:'mun-hwa',  en:'culture'},
  {ko:'한국', rom:'han-guk',  en:'Korea'},
  {ko:'학교', rom:'hak-gyo',  en:'school'},
];
const DEF_SENTENCES = [
  {id:'e1', level:'초급', ko:'오늘 날씨가 좋아요.',                              en:'The weather is nice today.'},
  {id:'e2', level:'초급', ko:'저는 학교에 가요.',                                en:'I go to school.'},
  {id:'e3', level:'중급', ko:'대통령이 경제 회복 방안을 발표했어요.',             en:'The president announced a plan for economic recovery.'},
  {id:'e4', level:'고급', ko:'국회에서 민생 안정 법안이 통과됐다.',               en:'A livelihood stability bill passed the National Assembly.'},
];

// ── localStorage ──────────────────────────────────────────────
function lsGet(key, def) {
  try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch(e) { return def; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
}

// ── 공유 데이터 ───────────────────────────────────────────────
function getPhrases()   { return lsGet(K_PHRASES,   DEF_PHRASES);   }
function getWordBank()  { return lsGet(K_WORDBANK,  DEF_WORDBANK);  }
function getSentences() { return lsGet(K_SENTENCES, DEF_SENTENCES); }
function getOpinions()  { return lsGet(K_OPINIONS,  []);            }



function toast(msg, isErr) {
  var d = document.createElement('div');
  d.style.cssText = 'position:fixed;bottom:22px;right:22px;z-index:9999;background:'+(isErr?'#cc2200':'#1a3a6b')+';color:#fff;padding:11px 18px;border-radius:4px;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,0.25);';
  d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(function(){ d.remove(); }, 3000);
}

// ── 저장 단어 ─────────────────────────────────────────────────
var K_SAVED = 'korehan_saved_words';
function dbSaveWord(ko, rom, en) {
  var saved = lsGet(K_SAVED, []);
  if (!saved.find(function(w){ return w.ko === ko; })) { saved.push({ko:ko,rom:rom,en:en}); lsSet(K_SAVED, saved); }
}
function dbRemoveWord(ko) {
  var saved = lsGet(K_SAVED, []).filter(function(w){ return w.ko !== ko; });
  lsSet(K_SAVED, saved);
}

function articleUrl(id) {
  return 'korehan-article.html?id=' + encodeURIComponent(id);
}

// ── SEED DATA ─────────────────────────────────────────────────
var SEED_ARTICLES = [
  { id:'s1',  section:'정치',   status:'published', featured:true,  date:'2026-03-02', image:'https://picsum.photos/seed/news1/600/400',   title:'대통령, 경제 회복 위한 대규모 민간투자 패키지 발표',               body:'정부는 오늘 향후 5년간 100조 원 규모의 민간투자를 유치하는 종합 경제 활성화 방안을 공개했다.' },
  { id:'s2',  section:'경제',   status:'published', featured:false, date:'2026-03-02', image:'https://picsum.photos/seed/news2/600/400',   title:'반도체 수출 석 달 연속 증가… 무역수지 흑자 전환',                 body:'반도체를 중심으로 한 수출 호조가 이어지며 무역수지가 3개월 연속 흑자를 기록했다.' },
  { id:'s3',  section:'국제',   status:'published', featured:false, date:'2026-03-02', image:'https://picsum.photos/seed/news3/600/400',   title:'유엔 안보리, 중동 사태 긴급 회의 소집 결의',                      body:'유엔 안전보장이사회가 중동 지역의 긴박한 상황에 대응하기 위해 긴급 회의 소집을 결의했다.' },
  { id:'s4',  section:'사회',   status:'published', featured:false, date:'2026-03-02', image:'https://picsum.photos/seed/news4/600/400',   title:'서울시, 한강 변 대규모 주거단지 개발 계획 승인',                  body:'서울시가 마포구 일대 한강 변에 1만 세대 규모의 신규 주거단지 개발 계획을 최종 승인했다.' },
  { id:'s5',  section:'경제',   status:'published', featured:false, date:'2026-03-02', image:'https://picsum.photos/seed/news10/600/400',  title:'한국은행, 기준금리 동결 결정… "하반기 인하 검토"',                body:'금통위는 만장일치로 현행 3.5% 금리를 유지하기로 결정하면서 하반기 완화 가능성을 시사했다.' },
  { id:'s6',  section:'사회',   status:'published', featured:false, date:'2026-03-02', image:'https://picsum.photos/seed/news11/600/400',  title:'전국 교원 파업 예고… 교육부와 협상 막판 진통',                   body:'전국교원노조는 처우 개선 요구가 받아들여지지 않을 경우 다음 주 전면 파업에 돌입하겠다고 선언했다.' },
  { id:'s7',  section:'국제',   status:'published', featured:false, date:'2026-03-02', image:'https://picsum.photos/seed/news12/600/400',  title:'나토 정상들, 방위비 분담 확대 합의… 한국도 동참 논의',            body:'북대서양조약기구 회원국들이 국방비를 GDP 대비 3%로 높이기로 원칙적 합의했다.' },
  { id:'s8',  section:'Korea',  status:'published', featured:false, date:'2026-03-02', image:'https://picsum.photos/seed/korea1/600/400',  title:'BTS 월드투어 서울 공연 전석 매진… 추가 공연 검토 중',             body:'BTS 월드투어 서울 공연 티켓이 판매 시작 수분 만에 전석 매진되면서 소속사가 추가 공연 개최를 검토하고 있다.' },
  { id:'s9',  section:'Korea',  status:'published', featured:false, date:'2026-03-02', image:'https://picsum.photos/seed/korea2/600/400',  title:'유네스코, 김장 문화 세계 무형문화유산 등재 확정',                  body:'한국의 전통 김치 담그기 문화인 김장이 유네스코 인류 무형문화유산으로 공식 등재됐다.' },
  { id:'s10', section:'Korea',  status:'published', featured:false, date:'2026-03-02', image:'https://picsum.photos/seed/korea3/600/400',  title:'외국인 한국어 능력시험(TOPIK) 지원자 역대 최다 기록',              body:'2026년 TOPIK 시험 지원자 수가 역대 최고치를 기록하며 전 세계적인 한국어 학습 열풍을 실감케 했다.' },
  { id:'s11', section:'IT과학', status:'published', featured:false, date:'2026-03-02', image:'https://picsum.photos/seed/s1/600/400',      title:'삼성전자, 차세대 AI 반도체 양산 돌입… 엔비디아와 공급 계약',      body:'삼성전자가 차세대 AI 반도체 양산에 돌입하면서 엔비디아와 대규모 공급 계약을 체결했다.' },
  { id:'s12', section:'정치',   status:'published', featured:false, date:'2026-03-02', image:'https://picsum.photos/seed/s2/600/400',      title:'여야, 민생 안정 패키지 법안 처리 합의… 이번 주 본회의 통과 예정', body:'여야가 민생 안정 패키지 법안 처리에 합의하면서 이번 주 본회의 통과가 유력해졌다.' },
  { id:'s13', section:'스포츠', status:'published', featured:false, date:'2026-03-02', image:'https://picsum.photos/seed/s3/600/400',      title:'손흥민, 챔피언스리그 결승 진출… 한국 선수 최초 기록 수립',        body:'손흥민이 챔피언스리그 결승에 진출하며 한국 선수 최초라는 역사적 기록을 세웠다.' },
  { id:'s14', section:'국제',   status:'published', featured:false, date:'2026-03-02', image:'https://picsum.photos/seed/s4/600/400',      title:'기후변화 대응 새 국제협약 서명… 한국 탄소중립 2045년 목표 발표',  body:'새로운 국제 기후 협약이 서명되면서 한국은 탄소중립 목표 시점을 2045년으로 앞당겼다.' },
  { id:'s15', section:'사회',   status:'published', featured:false, date:'2026-03-02', image:'https://picsum.photos/seed/s5/600/400',      title:'수도권 광역급행철도 GTX-B 노선 2027년 개통 확정',                 body:'GTX-B 노선이 2027년 개통을 목표로 공사가 마무리 단계에 접어들었다.' },
  { id:'s16', section:'문화',   status:'published', featured:false, date:'2026-03-02', image:'https://picsum.photos/seed/cul1/600/400',    title:'넷플릭스 한국 오리지널 드라마, 전 세계 1위 달성',                 body:'넷플릭스가 제작한 한국 오리지널 드라마가 공개 첫 주 전 세계 92개국에서 1위를 기록했다.' },
  { id:'s17', section:'경제',   status:'published', featured:false, date:'2026-03-02', image:'https://picsum.photos/seed/econ1/600/400',   title:'코스피 2,800선 회복… 외국인 순매수 지속',                        body:'코스피 지수가 외국인 투자자의 순매수에 힘입어 2,800선을 회복하며 강세를 이어갔다.' },
  { id:'s18', section:'문화',   status:'published', featured:false, date:'2026-03-02', image:'https://picsum.photos/seed/sp1/600/400',     title:'황희찬, 프리미어리그 이번 시즌 15호 골… 팀 3연승 견인',           body:'울버햄튼의 황희찬이 번리 전에서 멀티골을 터트리며 팀의 3연승을 이끌었다.' },
];

// ── DB ────────────────────────────────────────────────────────
function dbLoad() {
  var stored = lsGet(DB_KEY, null);
  if (stored && stored.length > 0) {
    var ids = new Set(stored.map(function(a){ return a.id; }));
    var missing = SEED_ARTICLES.filter(function(a){ return !ids.has(a.id); });
    if (missing.length) { var merged = stored.concat(missing); lsSet(DB_KEY, merged); return merged; }
    return stored;
  }
  lsSet(DB_KEY, SEED_ARTICLES);
  return SEED_ARTICLES.slice();
}
function dbGet(filter) {
  var all = dbLoad();
  if (!filter) return all;
  return all.filter(filter);
}
function published(section) {
  return dbGet(function(a){ return a.status === 'published' && (!section || a.section === section); });
}

// ── VOCAB ─────────────────────────────────────────────────────
var VOCAB = {
  "대통령":{"en":"president","rom":"dae-tong-ryeong"},
  "경제":{"en":"economy / economic","rom":"gyeong-je"},
  "회복":{"en":"recovery","rom":"hoe-bok"},
  "투자":{"en":"investment","rom":"tu-ja"},
  "민간":{"en":"private sector","rom":"min-gan"},
  "발표":{"en":"announcement","rom":"bal-pyo"},
  "국회":{"en":"National Assembly","rom":"guk-hoe"},
  "법안":{"en":"bill / legislation","rom":"beob-an"},
  "표결":{"en":"vote","rom":"pyo-gyeol"},
  "기준금리":{"en":"base interest rate","rom":"gi-jun-geum-ri"},
  "동결":{"en":"freeze / hold","rom":"dong-gyeol"},
  "결정":{"en":"decision","rom":"gyeol-jeong"},
  "하반기":{"en":"second half of year","rom":"ha-ban-gi"},
  "인하":{"en":"cut / reduction","rom":"in-ha"},
  "검토":{"en":"review / consideration","rom":"geom-to"},
  "수출":{"en":"export","rom":"su-chul"},
  "반도체":{"en":"semiconductor","rom":"ban-do-che"},
  "무역":{"en":"trade","rom":"mu-yeok"},
  "흑자":{"en":"surplus","rom":"heuk-ja"},
  "코스피":{"en":"KOSPI (Korea stock index)","rom":"ko-seu-pi"},
  "부동산":{"en":"real estate","rom":"bu-dong-san"},
  "아파트":{"en":"apartment","rom":"a-pa-teu"},
  "지지율":{"en":"approval rating","rom":"ji-ji-yul"},
  "정부":{"en":"government","rom":"jeong-bu"},
  "협상":{"en":"negotiation","rom":"hyeob-sang"},
  "합의":{"en":"agreement","rom":"hab-eui"},
  "사회":{"en":"society","rom":"sa-hoe"},
  "교원":{"en":"teacher / educator","rom":"gyo-won"},
  "파업":{"en":"strike","rom":"pa-eob"},
  "예고":{"en":"notice / warning","rom":"ye-go"},
  "서울":{"en":"Seoul","rom":"seo-ul"},
  "한강":{"en":"Han River","rom":"han-gang"},
  "개발":{"en":"development","rom":"gae-bal"},
  "계획":{"en":"plan","rom":"gye-hoek"},
  "승인":{"en":"approval","rom":"seung-in"},
  "개통":{"en":"opening / launch","rom":"gae-tong"},
  "확정":{"en":"confirmed","rom":"hwak-jeong"},
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
  "문화":{"en":"culture","rom":"mun-hwa"},
  "공연":{"en":"performance / show","rom":"gong-yeon"},
  "매진":{"en":"sold out","rom":"mae-jin"},
  "드라마":{"en":"drama / TV series","rom":"deu-ra-ma"},
  "김장":{"en":"kimchi-making tradition","rom":"gim-jang"},
  "등재":{"en":"registration / listing","rom":"deung-jae"},
  "무형문화유산":{"en":"intangible cultural heritage","rom":"mu-hyeong-mun-hwa-yu-san"},
  "양산":{"en":"mass production","rom":"yang-san"},
  "공급":{"en":"supply","rom":"gong-geup"},
  "계약":{"en":"contract","rom":"gye-yak"},
  "손흥민":{"en":"Son Heung-min (footballer)","rom":"son-heung-min"},
  "챔피언스리그":{"en":"Champions League","rom":"chaem-pi-eon-seu-ri-geu"},
  "결승":{"en":"final / decisive match","rom":"gyeol-seung"},
  "진출":{"en":"advancement","rom":"jin-chul"},
  "기록":{"en":"record","rom":"gi-rok"},
  "스포츠":{"en":"sports","rom":"seu-po-cheu"},
  "금리":{"en":"interest rate","rom":"geum-ri"},
  "한반도":{"en":"Korean Peninsula","rom":"han-ban-do"},
  "평화":{"en":"peace","rom":"pyeong-hwa"},
  "저출생":{"en":"low birth rate","rom":"jeo-chul-saeng"},
  "위기":{"en":"crisis","rom":"wi-gi"},
  "뉴스":{"en":"news","rom":"nyu-seu"},
  "한국":{"en":"Korea / Korean","rom":"han-guk"},
  "속보":{"en":"breaking news","rom":"sok-bo"},
  "역대":{"en":"all-time / in history","rom":"yeok-dae"},
  "전국":{"en":"nationwide","rom":"jeon-guk"},
  "안정":{"en":"stability","rom":"an-jeong"},
  "열풍":{"en":"craze / boom","rom":"yeol-pung"},
  "수상":{"en":"award / prize","rom":"su-sang"},
  "개막":{"en":"opening / premiere","rom":"gae-mak"},
  "학교":{"en":"school","rom":"hak-gyo"},
  "가족":{"en":"family","rom":"ga-jok"},
  "봄":{"en":"spring","rom":"bom"},
  "여름":{"en":"summer","rom":"yeo-reum"},
  "가을":{"en":"autumn","rom":"ga-eul"},
  "겨울":{"en":"winter","rom":"gye-ul"},
};

// ── HTML 생성 헬퍼 ────────────────────────────────────────────
function relTime(dateStr) {
  if (!dateStr) return '';
  try {
    var diff = Date.now() - new Date(dateStr + 'T00:00:00').getTime();
    var h = Math.floor(diff / 3600000);
    if (h < 1)  return '방금 전';
    if (h < 24) return h + '시간 전';
    var d = Math.floor(h / 24);
    return d + '일 전';
  } catch(e) { return ''; }
}

function cardHTML(a, extraTagClass) {
  var img = a.image || ('https://picsum.photos/seed/' + a.id + '/600/400');
  var tc  = extraTagClass || '';
  return '<a href="' + articleUrl(a.id) + '" style="color:inherit;text-decoration:none;">'
    + '<div class="card">'
    + '<img src="' + img + '" alt="" loading="lazy" onerror="this.src=\'https://picsum.photos/seed/fallback/600/400\'">'
    + '<div class="tag' + (tc ? ' ' + tc : '') + '">' + a.section + '</div>'
    + '<h3 class="vocab-zone">' + a.title + '</h3>'
    + '<p class="vocab-zone">' + (a.body || '') + '</p>'
    + '<div class="meta">' + relTime(a.date) + '</div>'
    + '</div></a>';
}

function storyItemHTML(a) {
  var img = a.image || ('https://picsum.photos/seed/' + a.id + '/300/200');
  return '<a href="' + articleUrl(a.id) + '" style="color:inherit;text-decoration:none;">'
    + '<div class="story-item">'
    + '<img src="' + img + '" alt="" loading="lazy" onerror="this.src=\'https://picsum.photos/seed/fallback/300/200\'">'
    + '<div>'
    + '<h4 class="vocab-zone">' + a.title + '</h4>'
    + '<div class="meta">' + a.section + ' · ' + relTime(a.date) + '</div>'
    + '</div></div></a>';
}

function heroSideItemHTML(a) {
  var img = a.image || ('https://picsum.photos/seed/' + a.id + '/400/200');
  return '<a href="' + articleUrl(a.id) + '" style="color:inherit;text-decoration:none;display:block;">'
    + '<div class="hero-side-item">'
    + '<img src="' + img + '" alt="" loading="lazy" onerror="this.src=\'https://picsum.photos/seed/fallback/400/200\'">'
    + '<h3 class="vocab-zone">' + a.title + '</h3>'
    + '<p class="meta">' + a.section + ' · ' + relTime(a.date) + '</p>'
    + '</div></a>';
}

// ── 페이지 렌더러 ─────────────────────────────────────────────

function renderHomePage() {
  var all      = published();
  var featured = all.find(function(a){ return a.featured; }) || all[0];
  var rest     = all.filter(function(a){ return !featured || a.id !== featured.id; });

  // HERO
  var heroEl = document.getElementById('dyn-hero');
  if (heroEl && featured) {
    var heroSide = rest.slice(0, 4);
    heroEl.innerHTML =
      '<a href="' + articleUrl(featured.id) + '" style="color:inherit;text-decoration:none;">'
      + '<div class="hero-main">'
      + '<img src="' + (featured.image || 'https://picsum.photos/seed/' + featured.id + '/900/500') + '" alt="" onerror="this.src=\'https://picsum.photos/seed/fallback/900/500\'">'
      + '<div class="overlay">'
      + '<span class="category-tag">' + featured.section + '</span>'
      + '<h1 class="vocab-zone">' + featured.title + '</h1>'
      + '<p class="sub vocab-zone">' + (featured.body || '') + '</p>'
      + '</div></div></a>'
      + '<div class="hero-side">' + heroSide.map(heroSideItemHTML).join('') + '</div>';
  }

  // TOP STORIES
  var topEl = document.getElementById('dyn-top-stories');
  if (topEl) topEl.innerHTML = rest.slice(0, 3).map(function(a){ return cardHTML(a); }).join('');

  // SECTION BLOCKS
  var sectionsEl = document.getElementById('dyn-sections');
  if (sectionsEl) {
    var sections = [
      { key:'사회', label:'Society · 사회', href:'korehan-society.html' },
      { key:'국제', label:'World · 국제',   href:'korehan-world.html'   },
      { key:'문화', label:'Culture · 문화', href:'korehan-culture.html' },
    ];
    sectionsEl.innerHTML = sections.map(function(s) {
      var arts = published(s.key).slice(0, 3);
      if (!arts.length) return '';
      return '<div style="margin:24px 0 8px">'
        + '<div class="section-title" style="display:flex;justify-content:space-between;align-items:center">'
        + s.label
        + '<a href="' + s.href + '" style="font-size:13px;font-weight:600;color:#2255a4;text-decoration:none">모두 보기 →</a>'
        + '</div>'
        + '<div class="card-grid">' + arts.map(function(a){ return cardHTML(a); }).join('') + '</div>'
        + '</div>';
    }).join('');
  }

  // LATEST
  var latestEl = document.getElementById('dyn-latest');
  if (latestEl) latestEl.innerHTML = rest.slice(3, 8).map(storyItemHTML).join('');

  // OPINIONS
  var opinionsEl = document.getElementById('dyn-opinions');
  if (opinionsEl) {
    var ops = getOpinions();
    if (ops.length) {
      opinionsEl.innerHTML = ops.map(function(op){
        return '<div class="opinion-card">'
          + '<div class="author-img"><img src="' + (op.img || 'https://picsum.photos/seed/auth/100/100') + '" alt="' + (op.name||'') + '" onerror="this.src=\'https://picsum.photos/seed/auth/100/100\'"></div>'
          + '<div class="author">' + (op.name||'') + '</div>'
          + '<div class="author-title">' + (op.title||'') + '</div>'
          + '<h4 class="vocab-zone">' + (op.headline||'') + '</h4>'
          + '</div>';
      }).join('');
    }
  }
}

function renderSectionPage(section) {
  var articles = published(section);
  var featured = articles[0];
  var rest     = articles.slice(1);

  // HERO
  var heroEl = document.getElementById('dyn-hero');
  if (heroEl) {
    if (featured) {
      heroEl.innerHTML =
        '<a href="' + articleUrl(featured.id) + '" style="color:inherit;text-decoration:none;">'
        + '<div class="hero-main">'
        + '<img src="' + (featured.image || 'https://picsum.photos/seed/' + featured.id + '/900/500') + '" alt="" onerror="this.src=\'https://picsum.photos/seed/fallback/900/500\'">'
        + '<div class="overlay">'
        + '<span class="category-tag' + (section === 'Korea' ? ' korea' : '') + '">' + featured.section + '</span>'
        + '<h1 class="vocab-zone">' + featured.title + '</h1>'
        + '<p class="sub vocab-zone">' + (featured.body || '') + '</p>'
        + '</div></div></a>'
        + '<div class="hero-side">' + rest.slice(0, 4).map(heroSideItemHTML).join('') + '</div>';
    } else {
      heroEl.innerHTML = '<div style="padding:40px;color:#999;text-align:center;grid-column:1/-1">아직 이 섹션에 기사가 없습니다.<br><a href="korehan-admin.html" style="color:#2255a4;">Admin CMS</a>에서 추가해 주세요.</div>';
    }
  }

  // ARTICLE LIST
  var listEl = document.getElementById('dyn-article-list');
  if (listEl) {
    if (!rest.length) {
      listEl.innerHTML = '<p style="color:#999;padding:20px 0">기사가 없습니다.</p>';
    } else {
      listEl.innerHTML = rest.map(function(a){
        return '<a href="' + articleUrl(a.id) + '" style="color:inherit;text-decoration:none;">'
          + '<div class="article-row">'
          + '<img src="' + (a.image || 'https://picsum.photos/seed/' + a.id + '/300/200') + '" alt="" loading="lazy" onerror="this.src=\'https://picsum.photos/seed/fallback/300/200\'">'
          + '<div>'
          + '<div class="tag' + (section === 'Korea' ? ' korea' : '') + '">' + a.section + '</div>'
          + '<h3 class="vocab-zone">' + a.title + '</h3>'
          + '<p class="vocab-zone">' + (a.body || '') + '</p>'
          + '<div class="meta">' + relTime(a.date) + '</div>'
          + '</div></div></a>';
      }).join('');
    }
  }
}

function renderAllPage() {
  var articles = published();
  var listEl   = document.getElementById('dyn-article-list');
  if (!listEl) return;

  if (!articles.length) {
    listEl.innerHTML = '<div style="padding:40px;color:#999;text-align:center">아직 기사가 없습니다.<br><a href="korehan-admin.html" style="color:#2255a4;">Admin CMS</a>에서 추가해 주세요.</div>';
    return;
  }
  listEl.innerHTML = articles.map(function(a){
    return '<a href="' + articleUrl(a.id) + '" style="color:inherit;text-decoration:none;">'
      + '<div class="article-row">'
      + '<img src="' + (a.image || 'https://picsum.photos/seed/' + a.id + '/300/200') + '" alt="" loading="lazy" onerror="this.src=\'https://picsum.photos/seed/fallback/300/200\'">'
      + '<div>'
      + '<div class="tag">' + a.section + '</div>'
      + '<h3 class="vocab-zone">' + a.title + '</h3>'
      + '<p class="vocab-zone">' + (a.body || '') + '</p>'
      + '<div class="meta">' + relTime(a.date) + '</div>'
      + '</div></div></a>';
  }).join('');
}

function renderArticlePage() {
  var wrap = document.getElementById('dyn-article');
  if (!wrap) return;

  var params = new URLSearchParams(window.location.search);
  var id     = params.get('id');
  var all    = dbLoad();
  var a      = id ? all.find(function(x){ return String(x.id) === String(id); }) : null;

  if (!a) {
    wrap.innerHTML = '<div style="padding:30px">'
      + '<a href="index.html" style="color:#2255a4;text-decoration:none">← Back to Home</a>'
      + '<h1 style="margin-top:16px">Article not found</h1>'
      + '<p style="color:#666;margin-top:8px">링크가 잘못됐거나 기사가 존재하지 않습니다.</p>'
      + '</div>';
    return;
  }

  var img = a.image || ('https://picsum.photos/seed/' + a.id + '/1200/700');
  var dateStr = a.date ? new Date(a.date).toLocaleDateString('ko-KR', {year:'numeric',month:'long',day:'numeric'}) : '';

  wrap.innerHTML =
    '<article class="kh-article-wrap">'

    // 브레드크럼
    + '<nav class="art-breadcrumb">'
    + '<a href="index.html">Home</a>'
    + '<span>›</span>'
    + '<a href="korehan-' + (a.section==='Korea'?'korea':a.section==='사회'?'society':a.section==='국제'?'world':a.section==='문화'?'culture':a.section==='오피니언'?'opinion':'all') + '.html">' + a.section + '</a>'
    + '</nav>'

    // 카테고리 + 제목
    + '<div class="art-header">'
    + '<span class="art-section-badge">' + a.section + '</span>'
    + '<h1 class="art-title vocab-zone">' + a.title + '</h1>'
    + '<div class="art-meta-row">'
    + '<span class="art-date">📅 ' + dateStr + '</span>'
    + '<span class="art-dot">·</span>'
    + '<span class="art-readtime">⏱ 약 ' + Math.max(1, Math.ceil((a.full||a.body||'').length / 500)) + '분 읽기</span>'
    + '<div class="art-actions">'
    + '<button class="kh-bm-btn" id="art-bm-btn" onclick="toggleBookmark(\'' + a.id + '\',this)">🔖 북마크</button>'
    + '<button class="kh-share-btn" onclick="shareArticle()">🔗 공유</button>'
    + '</div>'
    + '</div>'
    + '</div>'

    // 히어로 이미지
    + '<div class="art-hero-img">'
    + '<img src="' + img + '" alt="" onerror="this.src=\'https://picsum.photos/seed/fallback/1200/700\'">'
    + '</div>'

    // 본문 탭
    + '<div class="art-tabs">'
    + '<button class="art-tab on" onclick="switchArtTab(\'article\',this)">📰 기사</button>'
    + '<button class="art-tab" onclick="switchArtTab(\'grammar\',this)">📖 문법 가이드</button>'
    + '</div>'

    // 기사 탭
    + '<div id="art-tab-article">'
    + '<div class="art-lead vocab-zone">' + (a.body || '') + '</div>'
    + (a.full ? '<div class="art-full vocab-zone">' + formatArticleBody(a.full) + '</div>' : '')
    + '</div>'

    // 문법 탭
    + '<div id="art-tab-grammar" style="display:none">'
    + '<div id="grammar-content"><div style="color:#aaa;padding:20px 0;text-align:center">문법 가이드를 불러오는 중...</div></div>'
    + '</div>'

    // 단어 학습 박스
    + '<div class="art-vocab-box">'
    + '<div class="art-vocab-title">📚 이 기사의 핵심 단어</div>'
    + '<div class="art-vocab-list" id="art-vocab-list"></div>'
    + '</div>'

    // 구분선
    + '<hr class="art-divider">'

    // 댓글 섹션
    + '<section class="art-comments" id="art-comments">'
    + '<h3 class="art-comments-title">💬 댓글 <span id="comment-count" style="font-size:16px;color:var(--gray)"></span></h3>'
    + '<div id="comment-form-wrap">'
    + '<div class="comment-login-notice" id="comment-login-notice" style="display:none">'
    + '<p>댓글을 달려면 <a href="#" onclick="event.preventDefault();signInWithGoogle()">로그인</a>이 필요합니다.</p>'
    + '</div>'
    + '<div class="comment-form" id="comment-form" style="display:none">'
    + '<textarea id="comment-input" placeholder="댓글을 입력하세요..." rows="3"></textarea>'
    + '<button class="comment-submit-btn" onclick="submitComment(\'' + a.id + '\')">등록</button>'
    + '</div>'
    + '</div>'
    + '<div id="comments-list"></div>'
    + '</section>'

    + '</article>';

  // 북마크 상태 확인
  checkBookmarkState(a.id);

  // 핵심 단어 추출
  renderArticleVocab(a);

  // 댓글 로드
  loadComments(a.id);

  // 댓글 폼 표시 여부
  updateCommentForm();
}

function formatArticleBody(text) {
  // 빈 줄 기준으로 문단 나누기, 없으면 마침표 기준으로
  if (!text) return '';
  var paras = text.split(/\n\n+/);
  if (paras.length <= 1) {
    // 마침표+공백 기준으로 문단 나누기
    paras = text.replace(/([.!?。])\s+/g, '$1\n').split('\n').filter(function(p){ return p.trim(); });
  }
  return paras.map(function(p){
    return '<p style="margin-bottom:18px">' + p.trim().replace(/\n/g,'<br>') + '</p>';
  }).join('');
}

function switchArtTab(tab, btn) {
  document.querySelectorAll('.art-tab').forEach(function(b){ b.classList.remove('on'); });
  btn.classList.add('on');
  var artEl = document.getElementById('art-tab-article');
  var gramEl = document.getElementById('art-tab-grammar');
  if (tab === 'article') {
    if (artEl) artEl.style.display = 'block';
    if (gramEl) gramEl.style.display = 'none';
  } else {
    if (artEl) artEl.style.display = 'none';
    if (gramEl) gramEl.style.display = 'block';
    loadGrammarGuide();
  }
}

async function loadGrammarGuide() {
  var el = document.getElementById('grammar-content');
  if (!el) return;
  // 이미 로드됐으면 스킵
  if (el.dataset.loaded) return;
  el.dataset.loaded = '1';

  // 현재 기사 제목+본문으로 문법 포인트 추출 (Claude API 없이 정적 가이드)
  var params = new URLSearchParams(window.location.search);
  var id = params.get('id');
  var all = dbLoad();
  var a = id ? all.find(function(x){ return String(x.id) === String(id); }) : null;
  if (!a) return;

  // 기사 텍스트에서 문법 패턴 감지
  var text = (a.title || '') + ' ' + (a.body || '') + ' ' + (a.full || '');
  var guides = [];

  var patterns = [
    { pattern:/었|았/, name:'과거형 ~었/았', level:'초급', exp:'동사에 붙어 "~했다"는 과거를 나타내요.', ex_ko:'경제가 회복됐<strong>어요</strong>.', ex_en:'The economy recovered.' },
    { pattern:/이다|입니다|이에요|예요/, name:'~이다 (이에요/예요)', level:'초급', exp:'"~이다"는 영어의 "is/are"예요. 받침이 있으면 이에요, 없으면 예요.', ex_ko:'서울<strong>이에요</strong>.', ex_en:'It\'s Seoul.' },
    { pattern:/을|를/, name:'목적격 조사 을/를', level:'초급', exp:'동사의 목적어에 붙어요. 받침 있으면 "을", 없으면 "를".', ex_ko:'뉴스<strong>를</strong> 봐요.', ex_en:'I watch the news.' },
    { pattern:/에서/, name:'장소 조사 에서', level:'초급', exp:'"~에서"는 행동이 일어나는 장소를 나타내요.', ex_ko:'서울<strong>에서</strong> 발표했다.', ex_en:'Announced in Seoul.' },
    { pattern:/위한|위해/, name:'~을 위한/위해', level:'중급', exp:'"~을 위한/위해"는 "for the purpose of ~"예요.', ex_ko:'경제 회복<strong>을 위한</strong> 방안', ex_en:'A plan for economic recovery' },
    { pattern:/으로|로 인해|로 인한/, name:'원인 조사 ~로 인해', level:'중급', exp:'"~로 인해"는 "due to ~", "because of ~"예요.', ex_ko:'수출 증가<strong>로 인해</strong> 흑자가 됐다.', ex_en:'Due to export growth, it turned a surplus.' },
    { pattern:/면서|하면서/, name:'동시동작 ~면서', level:'중급', exp:'"~하면서"는 두 행동이 동시에 일어날 때 써요.', ex_ko:'일하<strong>면서</strong> 공부해요.', ex_en:'I study while working.' },
    { pattern:/것으로|것이다|것을/, name:'명사화 ~는 것', level:'중급', exp:'"~는 것"은 동사를 명사처럼 만들어요.', ex_ko:'결정한 <strong>것으로</strong> 알려졌다.', ex_en:'It is known that a decision was made.' },
  ];

  patterns.forEach(function(p) {
    if (p.pattern.test(text)) guides.push(p);
  });

  // 최소 3개는 보여주기
  if (guides.length < 3) {
    guides = patterns.slice(0, 4);
  }

  el.innerHTML = '<p style="font-size:13px;color:var(--gray);margin-bottom:16px">이 기사에서 발견된 문법 패턴을 쉽게 설명해드려요 😊</p>'
    + guides.map(function(g){
      return '<div class="grammar-point">'
        + '<div class="grammar-name">' + g.name
        + ' <span style="font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(34,85,164,0.1);color:var(--bright);font-weight:700;vertical-align:middle">' + g.level + '</span>'
        + '</div>'
        + '<div class="grammar-explanation">' + g.exp + '</div>'
        + '<div class="grammar-example"><strong>예문</strong>' + g.ex_ko + '<br><span style="color:var(--gray);font-size:13px">' + g.ex_en + '</span></div>'
        + '</div>';
    }).join('');
}

function renderArticleVocab(a) {
  var el = document.getElementById('art-vocab-list');
  if (!el) return;
  var text = (a.title || '') + ' ' + (a.body || '') + ' ' + (a.full || '');
  var found = [];
  Object.keys(VOCAB).forEach(function(k) {
    if (text.indexOf(k) !== -1 && found.length < 8) found.push(k);
  });
  if (!found.length) { el.closest('.art-vocab-box').style.display = 'none'; return; }
  el.innerHTML = found.map(function(k) {
    return '<div class="art-vocab-item">'
      + '<span class="art-vocab-ko">' + k + '</span>'
      + '<span class="art-vocab-rom">' + VOCAB[k].rom + '</span>'
      + '<span class="art-vocab-en">' + VOCAB[k].en + '</span>'
      + '</div>';
  }).join('');
}

function shareArticle() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: window.location.href });
  } else {
    navigator.clipboard.writeText(window.location.href).then(function() {
      toast('링크가 복사됐습니다 ✓');
    });
  }
}

// ── 북마크 ────────────────────────────────────────────────────
async function toggleBookmark(articleId, btn) {
  if (!supaUser) { signInWithGoogle(); return; }
  var sb = getSupa();
  if (!sb) return;

  var isBookmarked = btn.classList.contains('active');
  if (isBookmarked) {
    await sb.from('bookmarks').delete().eq('user_id', supaUser.id).eq('article_id', articleId);
    btn.classList.remove('active');
    btn.textContent = '🔖 북마크';
    toast('북마크 해제됨');
  } else {
    await sb.from('bookmarks').insert({ user_id: supaUser.id, article_id: articleId });
    btn.classList.add('active');
    btn.textContent = '🔖 저장됨';
    toast('북마크에 저장됐습니다 ✓');
  }
}

async function checkBookmarkState(articleId) {
  var btn = document.getElementById('art-bm-btn');
  if (!btn || !supaUser) return;
  var sb = getSupa();
  if (!sb) return;
  var { data } = await sb.from('bookmarks').select('id').eq('user_id', supaUser.id).eq('article_id', articleId).maybeSingle();
  if (data) { btn.classList.add('active'); btn.textContent = '🔖 저장됨'; }
}

// ── 댓글 ──────────────────────────────────────────────────────
function updateCommentForm() {
  var formEl   = document.getElementById('comment-form');
  var noticeEl = document.getElementById('comment-login-notice');
  if (!formEl || !noticeEl) return;
  if (supaUser) {
    formEl.style.display = 'block';
    noticeEl.style.display = 'none';
  } else {
    formEl.style.display = 'none';
    noticeEl.style.display = 'block';
  }
}

async function loadComments(articleId) {
  var sb = getSupa();
  var listEl = document.getElementById('comments-list');
  var countEl = document.getElementById('comment-count');
  if (!listEl) return;

  if (!sb) {
    listEl.innerHTML = '<p style="color:#aaa;font-size:13px;padding:12px 0">댓글을 불러오는 중...</p>';
    return;
  }

  var { data, error } = await sb
    .from('comments')
    .select('*')
    .eq('article_id', articleId)
    .order('created_at', { ascending: true });

  if (error || !data || !data.length) {
    listEl.innerHTML = '<p style="color:#aaa;font-size:13px;padding:12px 0">첫 번째 댓글을 남겨보세요!</p>';
    if (countEl) countEl.textContent = '';
    return;
  }

  if (countEl) countEl.textContent = '(' + data.length + ')';

  listEl.innerHTML = data.map(function(c) {
    var isOwn = supaUser && supaUser.id === c.user_id;
    var avatar = c.avatar_url
      ? '<img src="' + c.avatar_url + '" class="comment-avatar" onerror="this.style.display=\'none\'">'
      : '<div class="comment-avatar" style="background:#2255a4;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700">' + (c.user_name||'?').charAt(0) + '</div>';
    var timeStr = c.created_at ? new Date(c.created_at).toLocaleDateString('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
    return '<div class="comment-row" id="comment-' + c.id + '">'
      + '<div class="comment-top">'
      + avatar
      + '<div class="comment-meta">'
      + '<span class="comment-name">' + (c.user_name || '익명') + '</span>'
      + '<span class="comment-date">' + timeStr + '</span>'
      + '</div>'
      + (isOwn ? '<button class="comment-del" onclick="deleteComment(\'' + c.id + '\')" title="삭제">✕</button>' : '')
      + '</div>'
      + '<div class="comment-body">' + escapeHtml(c.content) + '</div>'
      + '</div>';
  }).join('');
}

async function submitComment(articleId) {
  if (!supaUser) { signInWithGoogle(); return; }
  var input = document.getElementById('comment-input');
  var content = input ? input.value.trim() : '';
  if (!content) return;

  var sb = getSupa();
  if (!sb) return;

  var { error } = await sb.from('comments').insert({
    article_id:  articleId,
    user_id:     supaUser.id,
    user_name:   supaUser.user_metadata && supaUser.user_metadata.full_name || supaUser.email,
    avatar_url:  supaUser.user_metadata && supaUser.user_metadata.avatar_url || null,
    content:     content,
  });

  if (error) { toast('댓글 등록 오류: ' + error.message, true); return; }
  input.value = '';
  toast('댓글이 등록됐습니다 ✓');
  loadComments(articleId);
}

async function deleteComment(commentId) {
  if (!supaUser) return;
  if (!confirm('댓글을 삭제할까요?')) return;
  var sb = getSupa();
  if (!sb) return;
  var { error } = await sb.from('comments').delete().eq('id', commentId).eq('user_id', supaUser.id);
  if (error) { toast('삭제 오류', true); return; }
  var el = document.getElementById('comment-' + commentId);
  if (el) el.remove();
  toast('댓글이 삭제됐습니다');
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

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

  document.addEventListener('mouseover', function(e) {
    var w = e.target.closest ? e.target.closest('.kh-word') : null;
    if (!w) return;
    var d = VOCAB[w.dataset.word];
    if (!d) return;
    tip.innerHTML = '<span style="font-size:16px;font-weight:700;color:#7ab8f5">' + w.dataset.word + '</span><br>'
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
}

function wrapVocab(el) {
  var keys  = Object.keys(VOCAB).sort(function(a, b){ return b.length - a.length; });
  var regex = new RegExp('(' + keys.map(function(k){ return k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }).join('|') + ')', 'g');
  var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: function(n) {
      if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      var p = n.parentNode;
      while (p) { if (p.classList && p.classList.contains('kh-word')) return NodeFilter.FILTER_REJECT; p = p.parentNode; }
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
      span.dataset.word = m[0];
      span.textContent = m[0];
      frag.appendChild(span);
      last = regex.lastIndex;
    }
    if (last < node.nodeValue.length) frag.appendChild(document.createTextNode(node.nodeValue.slice(last)));
    node.parentNode.replaceChild(frag, node);
  });
}

// ── 헤더 / 푸터 / 사이드바 ────────────────────────────────────
function renderHeader() {
  var page     = window.location.pathname.split('/').pop() || 'index.html';
  var pageBase = page.replace(/\.html$/, '');
  var links = [
    { href:'index.html',          label:'Home',         cls:'',          base:'index'           },
    { href:'korehan-korea.html',   label:'🇰🇷 Korea',   cls:'korea-nav', base:'korehan-korea'   },
    { href:'korehan-society.html', label:'Society',      cls:'',          base:'korehan-society' },
    { href:'korehan-world.html',   label:'World',        cls:'',          base:'korehan-world'   },
    { href:'korehan-culture.html', label:'Culture',      cls:'',          base:'korehan-culture' },
    { href:'korehan-opinion.html', label:'Opinion',      cls:'',          base:'korehan-opinion' },
    { href:'korehan-learn.html',   label:'✏️ Learn',    cls:'learn-nav', base:'korehan-learn'   },
    { href:'korehan-all.html',     label:'All News',     cls:'',          base:'korehan-all'     },
  ];
  return '<div class="kh-top"><div class="kh-top-inner">'
    + '<div class="kh-top-row">'
    + '<a class="kh-brand" href="index.html">'
    + '<span class="kh-logo-text"><span class="kh-logo-kore">Kore</span><span class="kh-logo-han">Han</span></span>'
    + '<span class="kh-logo-news">News</span>'
    + '</a>'
    + '<div class="kh-top-right">'
    + '<div class="kh-clock"><span id="date-str"></span><span id="clock"></span></div>'
    + '<span id="topbar-user-avatar" style="display:none;width:28px;height:28px;border-radius:50%;background:#2255a4;color:#fff;align-items:center;justify-content:center;font-weight:700;font-size:13px;overflow:hidden;vertical-align:middle;margin-right:2px"></span>'
    + '<a href="korehan-mypage.html" id="topbar-mypage-btn" class="auth-btn-ui" style="display:none">👤 마이페이지</a>'
    + '<a href="#" id="topbar-signin-btn" class="auth-btn-ui" onclick="event.preventDefault();signInWithGoogle()">Sign In</a>'
    + '<a href="korehan-admin.html" id="topbar-admin-btn" class="auth-btn-ui" style="display:none;background:rgba(231,76,60,0.25);border-color:rgba(231,76,60,0.5)">⚙ Admin</a>'
    + '</div></div>'
    + '<nav class="kh-nav">'
    + links.map(function(l){
        var active = (pageBase === l.base || page === l.href) ? 'on' : '';
        var cls = [l.cls, active].filter(Boolean).join(' ');
        return '<a href="' + l.href + '"' + (cls ? ' class="' + cls + '"' : '') + '>' + l.label + '</a>';
      }).join('')
    + '</nav></div></div>'
    // Breaking news ticker
    + '<div class="kh-breaking">'
    + '<div class="brk-label"><span class="brk-badge">⚡</span>&nbsp;속보</div>'
    + '<div class="brk-track-wrap"><div class="brk-track">'
    + '<span class="brk-item">대통령, 100조 원 민간투자 패키지 발표</span><span class="brk-sep">•</span>'
    + '<span class="brk-item">코스피 2,800선 회복… 외국인 순매수 지속</span><span class="brk-sep">•</span>'
    + '<span class="brk-item">BTS 월드투어 서울 공연 전석 매진</span><span class="brk-sep">•</span>'
    + '<span class="brk-item">한국은행 기준금리 동결, 하반기 인하 검토</span><span class="brk-sep">•</span>'
    + '<span class="brk-item">손흥민, 챔피언스리그 결승 진출 — 한국 최초</span><span class="brk-sep">•</span>'
    + '<span class="brk-item">대통령, 100조 원 민간투자 패키지 발표</span><span class="brk-sep">•</span>'
    + '<span class="brk-item">코스피 2,800선 회복… 외국인 순매수 지속</span><span class="brk-sep">•</span>'
    + '<span class="brk-item">BTS 월드투어 서울 공연 전석 매진</span><span class="brk-sep">•</span>'
    + '<span class="brk-item">한국은행 기준금리 동결, 하반기 인하 검토</span><span class="brk-sep">•</span>'
    + '<span class="brk-item">손흥민, 챔피언스리그 결승 진출 — 한국 최초</span>'
    + '</div></div></div>';
}

function renderFooter() {
  return '<footer class="kh-foot"><div class="kh-foot-inner">'
    + '<h3><span style="color:#3d7fd4">Kore</span><span style="color:#cc2200">Han</span> News</h3>'
    + '<p>KoreHan News delivers real Korean news — paired with vocabulary tooltips so you learn Korean naturally through stories that matter.</p>'
    + '<div class="footer-links">'
    + '<a href="index.html">Home</a>'
    + '<a href="korehan-korea.html">🇰🇷 Korea</a>'
    + '<a href="korehan-society.html">Society</a>'
    + '<a href="korehan-world.html">World</a>'
    + '<a href="korehan-culture.html">Culture</a>'
    + '<a href="korehan-opinion.html">Opinion</a>'
    + '<a href="korehan-learn.html">✏️ Learn Korean</a>'
    + '<a href="korehan-all.html">All News</a>'
    + '<a href="korehan-admin.html">⚙ Admin</a>'
    + '</div>'
    + '</div>'
    + '<div class="footer-copy">© 2026 KoreHan News · Learn Korean, Naturally</div>'
    + '</footer>';
}

function renderSharedSidebar() {
  var all = published();
  var trendingHTML = all.slice(0, 6).map(function(a, i){
    return '<a href="' + articleUrl(a.id) + '" style="color:inherit;text-decoration:none;">'
      + '<div class="trending-item">'
      + '<div class="trending-num">' + (i+1) + '</div>'
      + '<p class="vocab-zone">' + a.title + '</p>'
      + '</div></a>';
  }).join('');

  var wbWords = [
    {ko:'뉴스',  rom:'nyu-seu',  en:'news'},
    {ko:'사회',  rom:'sa-hoe',   en:'society'},
    {ko:'국제',  rom:'guk-je',   en:'international'},
    {ko:'문화',  rom:'mun-hwa',  en:'culture'},
    {ko:'한국',  rom:'han-guk',  en:'Korea'},
    {ko:'경제',  rom:'gyeong-je',en:'economy'},
  ];

  return '<div class="sidebar">'
    + '<div class="sidebar-box">'
    + '<div class="box-title">🔥 Most Read</div>'
    + trendingHTML
    + '</div>'

    + '<div class="sidebar-box">'
    + '<div class="box-title">🌤 Korea Weather</div>'
    + '<div style="font-size:13px;color:var(--gray);line-height:1.9">'
    + '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border)"><span>Seoul 서울</span><span>⛅ -3° / 6°C</span></div>'
    + '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border)"><span>Busan 부산</span><span>🌤 4° / 12°C</span></div>'
    + '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border)"><span>Incheon 인천</span><span>🌬 -4° / 5°C</span></div>'
    + '<div style="display:flex;justify-content:space-between;padding:4px 0"><span>Jeju 제주</span><span>🌧 8° / 13°C</span></div>'
    + '</div></div>'

    + '<div class="sidebar-box">'
    + '<div class="box-title">📚 Word Bank</div>'
    + wbWords.map(function(w){
        return '<div style="padding:7px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:baseline">'
          + '<span><span class="kh-word" data-word="' + w.ko + '" style="font-size:17px;font-weight:700;color:var(--accent)">' + w.ko + '</span>'
          + ' <span style="color:#889;font-style:italic;font-size:12px">' + w.rom + '</span></span>'
          + '<span style="font-size:13px;color:var(--gray)">' + w.en + '</span>'
          + '</div>';
      }).join('')
    + '</div>'

    + '<div class="sidebar-box">'
    + '<a href="korehan-learn.html" style="text-decoration:none;display:block;background:linear-gradient(135deg,#0b1626,#1a3a6b);border-radius:8px;padding:16px;color:#fff;text-align:center">'
    + '<div style="font-size:20px;margin-bottom:6px">✏️</div>'
    + '<div style="font-weight:700;font-size:14px;margin-bottom:4px">Learn Korean</div>'
    + '<div style="font-size:12px;color:rgba(255,255,255,0.6)">단어 카드 · 퀴즈 · 예문</div>'
    + '</a></div>'
    + '</div>';
}

// ── 시계 ──────────────────────────────────────────────────────
function startClock() {
  var days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  function tick() {
    var now    = new Date();
    var dateEl = document.getElementById('date-str');
    var clockEl= document.getElementById('clock');
    if (dateEl) dateEl.textContent = days[now.getDay()] + ', ' + months[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear() + ' ';
    if (clockEl) clockEl.textContent = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0') + ':' + String(now.getSeconds()).padStart(2,'0');
  }
  tick(); setInterval(tick, 1000);
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function() {
  var headerEl  = document.getElementById('kh-header');
  var footerEl  = document.getElementById('kh-footer');
  var sidebarEl = document.getElementById('kh-sidebar');

  if (headerEl)  headerEl.innerHTML  = renderHeader();
  if (footerEl)  footerEl.innerHTML  = renderFooter();
  if (sidebarEl) sidebarEl.innerHTML = renderSharedSidebar();

  checkSession();

  var page     = window.location.pathname.split('/').pop() || 'index.html';
  var pageBase = page.replace(/\.html$/, '');

  if (!pageBase || pageBase === 'index') {
    renderHomePage();
  } else if (pageBase === 'korehan-all')     { renderAllPage(); }
  else if (pageBase === 'korehan-korea')     { renderSectionPage('Korea'); }
  else if (pageBase === 'korehan-society')   { renderSectionPage('사회'); }
  else if (pageBase === 'korehan-world')     { renderSectionPage('국제'); }
  else if (pageBase === 'korehan-culture')   { renderSectionPage('문화'); }
  else if (pageBase === 'korehan-opinion')   { renderSectionPage('오피니언'); }
  else if (pageBase === 'korehan-article')   { renderArticlePage(); }

  startClock();
  initTooltips();
});
