/* kh-ui.js — UI (header/sidebar/neon theme/mobile) */
const K_PHRASES       = 'korehan_phrases';
const K_WORDBANK      = 'korehan_wordbank';
const K_SENTENCES     = 'korehan_sentences';
const K_OPINIONS      = 'korehan_opinions';
const K_ADMIN_SESSION = 'korehan_admin_session';

const K_NEON_THEME    = 'korehan_neon_theme';

function isKhNeonEnabled() {
  try {
    var saved = localStorage.getItem(K_NEON_THEME);
    if (saved === '1') return true;
    if (saved === '0') return false;
    return localStorage.getItem('korehan_home_neon') === '1';
  } catch(e) {
    return false;
  }
}

function syncNeonToggleButtons() {
  var on = !!(document.body && document.body.classList.contains('kh-neon-on'));
  [
    ['topbar-neon-toggle', 'zap', 'Neon '],
    ['home-neon-toggle', 'zap', 'Neon '],
    ['kh-sb-neon-toggle', 'zap', 'Neon theme: ']
  ].forEach(function(pair) {
    var btn = document.getElementById(pair[0]);
    if (!btn) return;
    btn.innerHTML = khIcon(pair[1], pair[2] + (on ? 'ON' : 'OFF'), 'kh-ui-icon-sm');
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.classList.toggle('on', on);
  });
  renderKhLucideIcons();
}

function applyKhNeon(on) {
  if (!document.body) return;
  document.body.classList.toggle('kh-neon-on', !!on);
  syncNeonToggleButtons();
}

function toggleKhNeon(evt) {
  if (evt && evt.preventDefault) evt.preventDefault();
  var next = !(document.body && document.body.classList.contains('kh-neon-on'));
  try {
    localStorage.setItem(K_NEON_THEME, next ? '1' : '0');
    localStorage.setItem('korehan_home_neon', next ? '1' : '0');
  } catch(e) {}
  applyKhNeon(next);
  _syncPrefsToDB();
}

function initKhNeonTheme() {
  applyKhNeon(isKhNeonEnabled());
}

window.isKhNeonEnabled = isKhNeonEnabled;
window.applyKhNeon = applyKhNeon;
window.toggleKhNeon = toggleKhNeon;
window.syncNeonToggleButtons = syncNeonToggleButtons;

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
const DEF_WORDBANK = [
  {ko:'뉴스', rom:'nyu-seu',  en:'news'},
  {ko:'사회', rom:'sa-hoe',   en:'society'},
  {ko:'국제', rom:'guk-je',   en:'international'},
  {ko:'문화', rom:'mun-hwa',  en:'culture'},
  {ko:'한국', rom:'han-guk',  en:'Korea'},
  {ko:'학교', rom:'hak-gyo',  en:'school'},
];
const DEF_SENTENCES = [
  {id:'e1',  level:'Beginner',      ko:'오늘 날씨가 좋아요.',                                    en:'The weather is nice today.'},
  {id:'e2',  level:'Beginner',      ko:'저는 학교에 가요.',                                       en:'I go to school.'},
  {id:'e3',  level:'Beginner',      ko:'가족과 함께 집에 있어요.',                                en:'I am at home with my family.'},
  {id:'e4',  level:'Beginner',      ko:'오늘은 봄처럼 따뜻해요.',                                en:'Today is warm like spring.'},
  {id:'e5',  level:'Beginner',      ko:'이 뉴스는 중요해요.',                                     en:'This news is important.'},
  {id:'e6',  level:'Intermediate',  ko:'대통령이 경제 회복 방안을 발표했어요.',                    en:'The president announced a plan for economic recovery.'},
  {id:'e7',  level:'Intermediate',  ko:'정부는 물가 안정을 위한 정책을 검토하고 있어요.',           en:'The government is reviewing policies to stabilize prices.'},
  {id:'e8',  level:'Intermediate',  ko:'반도체 수출이 지난달보다 증가했어요.',                     en:'Semiconductor exports increased compared to last month.'},
  {id:'e9',  level:'Intermediate',  ko:'서울시는 한강 개발 계획을 승인했어요.',                    en:'Seoul approved the Han River development plan.'},
  {id:'e10', level:'Intermediate',  ko:'한국 드라마가 전 세계에서 인기를 얻고 있어요.',            en:'Korean dramas are gaining popularity around the world.'},
  {id:'e11', level:'Advanced',      ko:'국회에서 민생 안정 법안이 통과됐다.',                      en:'A livelihood stability bill passed the National Assembly.'},
  {id:'e12', level:'Advanced',      ko:'유엔 안보리는 긴급 회의를 소집해 결의안을 채택했다.',       en:'The UN Security Council convened an emergency meeting and adopted a resolution.'},
  {id:'e13', level:'Advanced',      ko:'한국은행은 기준금리를 동결하고 하반기 인하를 검토하기로 했다.', en:'The Bank of Korea froze the base rate and decided to review a cut in the second half.'},
  {id:'e14', level:'Advanced',      ko:'저출생 위기 대응을 위한 범정부 대책이 필요하다는 목소리가 높다.', en:'There are growing calls for a whole-of-government response to the low birth rate crisis.'},
  {id:'e15', level:'Advanced',      ko:'탄소중립 목표 달성을 위해 재생에너지 투자를 확대해야 한다.',   en:'Investment in renewable energy must be expanded to achieve carbon neutrality goals.'},
];

// ── 헤더 / 푸터 / 사이드바 ────────────────────────────────────
function renderHeader() {
  // 폰트가 없으면 동적 주입
  if (!document.getElementById('kh-font-link')) {
    var fl = document.createElement('link');
    fl.id   = 'kh-font-link';
    fl.rel  = 'stylesheet';
    fl.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Noto+Serif+KR:wght@700;900&family=Noto+Sans+KR:wght@400;600;700;900&display=swap';
    // Pretendard (한국어 + 영문 최적화, OFL 라이선스)
    if (!document.getElementById('kh-pretendard')) {
      var pf = document.createElement('link');
      pf.id   = 'kh-pretendard';
      pf.rel  = 'stylesheet';
      pf.href = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';
      document.head.appendChild(pf);
    }
    document.head.appendChild(fl);
  }
  var page = window.location.pathname.split('/').pop() || 'index.html';
  var isHome = (page === 'index.html' || page === '');
  var currentSection = (new URLSearchParams(window.location.search)).get('s') || '';

  function isOn(base, sec) {
    if (sec && currentSection === sec) return true;
    return page === base || page.replace(/\.html$/,'') === base.replace(/\.html$/,'');
  }

  // ── Logo bar (white) ─────────────────────────────────────────
  var logoBar = '<div class="kh-header-bar">'
    + '<div class="kh-header-inner">'
    + '<button class="kh-ham" onclick="khSbOpen()" aria-label="Menu">&#9776;</button>'
    + '<a class="kh-logo" href="index.html">'
    + '<span class="kh-logo-kore">Kore</span>'
    + '<span class="kh-logo-han">Han</span>'
    + '<span class="kh-logo-news"> News</span>'
    + '</a>'
    + '<div class="kh-hright">'
    + '<span class="kh-hdate" id="date-str"></span>'
    + '<div class="kh-hsearch">' + khIcon('search', '', 'kh-ui-icon-muted kh-ui-icon-sm') + '<input type="text" placeholder="Search articles\u2026" onkeydown="if(event.key===\'Enter\')doSearch(this.value)" style="border:none;background:none;outline:none;font-size:13px;color:inherit;font-family:inherit;width:100%;"></div>'
    + '<button id="topbar-neon-toggle" class="kh-neon-toggle" type="button" aria-pressed="false" onclick="toggleKhNeon(event)">' + khIcon('zap', 'Neon OFF', 'kh-ui-icon-sm') + '</button>'
    + (isHome ? '<div class="kh-diff-ctrl" id="kh-diff-ctrl"><span class="kh-diff-dot" id="kh-diff-dot"></span><select class="kh-diff-sel" id="kh-diff-select" onchange="khSetDiff(this.value)"><option value="all">All Levels</option><option value="Starter">Seed</option><option value="Beginner">Sprout</option><option value="Intermediate">Tree</option><option value="Advanced">Forest</option></select><span class="kh-diff-arr">&#9662;</span></div>' : '')
    + '<div id="topbar-auth-menu" class="kh-auth-menu" style="display:none">'
    + '<button id="topbar-user-avatar" class="kh-avatar-btn" type="button" aria-label="Open profile menu" onclick="toggleTopbarUserMenu(event)" style="display:none"></button>'
    + '<div id="topbar-user-dropdown" class="kh-user-dropdown"></div>'
    + '</div>'
    + '<a href="#" id="topbar-signin-btn" class="kh-hbtn kh-hbtn-out" onclick="event.preventDefault();openAuthModal(\'signin\')">Sign In</a>'
    + '<a href="#" id="topbar-join-btn" class="kh-hbtn kh-hbtn-fill" onclick="event.preventDefault();openAuthModal(\'signup\')">Join Free</a>'
    + '<a href="korehan-x9f4k2m7.html" id="topbar-admin-btn" class="kh-hbtn kh-hbtn-out" style="display:none;background:rgba(231,76,60,0.15);border-color:rgba(231,76,60,0.4);">' + khIcon('settings', 'Admin', 'kh-ui-icon-sm') + '</a>'
    + '</div>'
    + '</div>'
    + '</div>';

  // ── Top nav (navy, dropdowns) ─────────────────────────────────
  var sections = getSections();
  var newsDrop = sections.map(function(s) {
    return '<a href="korehan-section.html?s=' + encodeURIComponent(s.key) + '" class="tn-drop-item">' + s.label + '</a>';
  }).join('');

  var topnav = '<div class="kh-topnav">'
    + '<div class="kh-topnav-inner">'
    + '<a href="index.html" class="tn-item' + (isOn('index.html') ? ' on' : '') + '">' + khIcon('home', 'Home', 'kh-ui-icon-sm') + '</a>'
    + '<div class="tn-item has-drop' + (page.indexOf('korehan-section') >= 0 ? ' on' : '') + '">'
    + khIcon('newspaper', 'News', 'kh-ui-icon-sm') + ' <span class="tn-arr">&#9660;</span>'
    + '<div class="tn-drop">'
    + '<div class="tn-drop-label">Category</div>'
    + '<a href="korehan-all.html" class="tn-drop-item">All News</a>'
    + newsDrop
    + '</div>'
    + '</div>'
    + '<div class="tn-item has-drop' + (isOn('korehan-conversations') ? ' on' : '') + '">'
    + khIcon('messages-square', 'Conversations', 'kh-ui-icon-sm') + ' <span class="tn-arr" style="margin-left:3px">&#9660;</span>'
    + '<div class="tn-drop">'
    + '<div class="tn-drop-label">Category</div>'
    + '<a href="korehan-conversations.html" class="tn-drop-item">All</a>'
    + '<a href="korehan-conversations.html?cat=everyday" class="tn-drop-item">Everyday</a>'
    + '<a href="korehan-conversations.html?cat=work" class="tn-drop-item">Workplace</a>'
    + '<a href="korehan-conversations.html?cat=friends" class="tn-drop-item">Friends</a>'
    + '<a href="korehan-conversations.html?cat=family" class="tn-drop-item">Family</a>'
    + '<a href="korehan-conversations.html?cat=dating" class="tn-drop-item">Dating</a>'
    + '</div>'
    + '</div>'
    + '<div class="tn-item has-drop' + (isOn('korehan-stories') ? ' on' : '') + '">'
    + khIcon('book-open', 'Stories', 'kh-ui-icon-sm') + ' <span class="tn-arr" style="margin-left:3px">&#9660;</span>'
    + '<div class="tn-drop">'
    + '<div class="tn-drop-label">Mood</div>'
    + '<a href="korehan-stories.html" class="tn-drop-item">All Stories</a>'
    + '<a href="korehan-stories.html?mood=fun" class="tn-drop-item">' + khIcon('sparkles', 'Fun', 'kh-ui-icon-sm') + '</a>'
    + '<a href="korehan-stories.html?mood=touching" class="tn-drop-item">' + khIcon('heart', 'Touching', 'kh-ui-icon-sm') + '</a>'
    + '<a href="korehan-stories.html?mood=scary" class="tn-drop-item">' + khIcon('zap', 'Scary', 'kh-ui-icon-sm') + '</a>'
    + '<a href="korehan-stories.html?mood=shocking" class="tn-drop-item">' + khIcon('flame', 'Shocking', 'kh-ui-icon-sm') + '</a>'
    + '</div>'
    + '</div>'
    + '<a href="korehan-study-room.html" class="tn-item' + (isOn('korehan-study-room') ? ' on' : '') + '">' + khIcon('notebook-pen', 'Study Room', 'kh-ui-icon-sm') + '</a>'
    + '<a href="korehan-shop.html" class="tn-item' + (isOn('korehan-shop') ? ' on' : '') + '">' + khIcon('shopping-bag', 'Shop', 'kh-ui-icon-sm') + '</a>'
    + '<a href="korehan-fun.html" class="tn-item' + (isOn('korehan-fun') ? ' on' : '') + '">' + khIcon('sparkles', 'FUN', 'kh-ui-icon-sm') + '</a>'
    + '<a href="korehan-learning-overview.html" class="tn-item' + (isOn('korehan-learning-overview') ? ' on' : '') + '">' + khIcon('chart-column', 'Growth Lab', 'kh-ui-icon-sm') + '</a>'
    + '<a href="korehan-courses.html" class="tn-item' + (isOn('korehan-courses') ? ' on' : '') + '">' + khIcon('graduation-cap', 'Courses', 'kh-ui-icon-sm') + '</a>'
    + '</div>'
    + '</div>';

  // ── Breaking ticker ───────────────────────────────────────────
  var ticker = (function() {
    var arts = getCachedArticles().filter(function(a){ return a.status === 'published'; });
    if (!arts.length) return '';
    var html = arts.slice(0,6).map(function(a){
      return '<span class="brk-item"><span class="brk-sep">&middot;</span><a href="korehan-article.html?id=' + a.id + '" style="color:#fff;text-decoration:none;">' + (a.title_ko || a.title || '') + '</a></span>';
    }).join('');
    return '<div class="kh-breaking brk-bar">'
      + '<div class="brk-label"><span class="brk-badge">&#9889;</span>&nbsp;BREAKING</div>'
      + '<div class="brk-track-wrap"><div class="brk-track">' + html + html + '</div></div>'
      + '</div>';
  })();

  return logoBar + topnav + ticker;
}


function renderFooter() {
  var cfg = getSiteConfig();
  var siteName = cfg.siteName || DEFAULT_SITE_CONFIG.siteName;
  return '<footer class="kh-foot">'
    + '<div class="kh-foot-inner">'

    + '<div>'
    + '<div style="font-family:\'Playfair Display\',serif;font-size:22px;font-weight:900;color:#fff;margin-bottom:10px">'
    + '<span style="color:rgba(255,255,255,.85)">Kore</span><span style="color:#7dd3fc">Han</span><span style="color:rgba(255,255,255,.7)"> News</span>'
    + '</div>'
    + '<p style="font-size:13px;line-height:1.7;color:rgba(255,255,255,.55);margin:0 0 16px;max-width:28ch">Learn Korean naturally through real news, stories, and conversations.</p>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    + '<a href="korehan-all.html" style="font-size:11px;font-weight:800;padding:5px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.6);text-decoration:none">News</a>'
    + '<a href="korehan-conversations.html" style="font-size:11px;font-weight:800;padding:5px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.6);text-decoration:none">Conversations</a>'
    + '<a href="korehan-stories.html" style="font-size:11px;font-weight:800;padding:5px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.6);text-decoration:none">Stories</a>'
    + '<a href="korehan-shop.html" style="font-size:11px;font-weight:800;padding:5px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.6);text-decoration:none">Shop</a>'
    + '<a href="korehan-fun.html" style="font-size:11px;font-weight:800;padding:5px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.6);text-decoration:none">FUN</a>'
    + '</div>'
    + '</div>'

    + '<div>'
    + '<div style="font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.38);margin-bottom:14px">Learn</div>'
    + '<div style="display:flex;flex-direction:column;gap:9px">'
    + '<a href="korehan-study-room.html" style="font-size:13px;color:rgba(255,255,255,.68);text-decoration:none;font-weight:600">Study Room</a>'
    + '<a href="korehan-learning-overview.html" style="font-size:13px;color:rgba(255,255,255,.68);text-decoration:none;font-weight:600">Growth Lab</a>'
    + '<a href="korehan-learn.html" style="font-size:13px;color:rgba(255,255,255,.68);text-decoration:none;font-weight:600">Vocab Drill</a>'
    + '<a href="korehan-courses.html" style="font-size:13px;color:rgba(255,255,255,.68);text-decoration:none;font-weight:600">Courses</a>'
    + '<a href="beginner-guide.html" style="font-size:13px;color:rgba(255,255,255,.68);text-decoration:none;font-weight:600">Beginner Guide</a>'
    + '</div>'
    + '</div>'

    + '<div>'
    + '<div style="font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.38);margin-bottom:14px">Company</div>'
    + '<div style="display:flex;flex-direction:column;gap:9px">'
    + '<a href="about.html" style="font-size:13px;color:rgba(255,255,255,.68);text-decoration:none;font-weight:600">About</a>'
    + '<a href="mailto:hello@korehannews.com" style="font-size:13px;color:rgba(255,255,255,.68);text-decoration:none;font-weight:600">Contact</a>'
    + '</div>'
    + '</div>'

    + '<div>'
    + '<div style="font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.38);margin-bottom:14px">Legal</div>'
    + '<div style="display:flex;flex-direction:column;gap:9px">'
    + '<a href="privacy-policy" style="font-size:13px;color:rgba(255,255,255,.68);text-decoration:none;font-weight:600">Privacy Policy</a>'
    + '<a href="terms-of-service" style="font-size:13px;color:rgba(255,255,255,.68);text-decoration:none;font-weight:600">Terms of Service</a>'
    + '</div>'
    + '</div>'

    + '</div>'

    + '<div>'
    + '<div style="font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.38);margin-bottom:14px">Newsletter</div>'
    + '<p style="font-size:13px;line-height:1.6;color:rgba(255,255,255,.5);margin:0 0 12px;max-width:26ch">Get weekly Korean learning tips and new content updates.</p>'
    + '<form id="kh-nl-form" onsubmit="return khSubscribeNewsletter(event)" style="display:flex;gap:6px;flex-wrap:wrap">'
    + '<input id="kh-nl-email" type="email" required placeholder="your@email.com" style="flex:1;min-width:160px;padding:9px 12px;border:1px solid rgba(255,255,255,.15);border-radius:8px;background:rgba(255,255,255,.07);color:#fff;font-size:13px;font-family:inherit;outline:none">'
    + '<button type="submit" style="padding:9px 16px;border:none;border-radius:8px;background:#7dd3fc;color:#0c1a3a;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap">Subscribe</button>'
    + '</form>'
    + '<div id="kh-nl-msg" style="font-size:12px;margin-top:8px;color:rgba(255,255,255,.5);display:none"></div>'
    + '</div>'

    + '</div>'
    + '<div style="border-top:1px solid rgba(255,255,255,.07);padding:16px 22px;text-align:center;font-size:12px;color:rgba(255,255,255,.28);">'
    + '© 2026 KoreHan News · All rights reserved'
    + '</div>'
    + '</footer>';
}

async function khSubscribeNewsletter(e) {
  e.preventDefault();
  var emailEl = document.getElementById('kh-nl-email');
  var msgEl = document.getElementById('kh-nl-msg');
  var email = (emailEl.value || '').trim().toLowerCase();
  if (!email) return false;

  msgEl.style.display = 'block';
  msgEl.style.color = 'rgba(255,255,255,.5)';
  msgEl.textContent = 'Subscribing...';

  try {
    var sb = getSupa();
    var { error } = await sb.from('newsletter_subs').insert({ email: email });
    if (error) {
      if (error.code === '23505') {
        msgEl.style.color = '#fbbf24';
        msgEl.textContent = 'You are already subscribed!';
      } else {
        throw error;
      }
    } else {
      msgEl.style.color = '#34d399';
      msgEl.textContent = 'Subscribed! Welcome aboard.';
      emailEl.value = '';
    }
  } catch (err) {
    msgEl.style.color = '#f87171';
    msgEl.textContent = 'Something went wrong. Please try again.';
  }
  return false;
}

function renderSharedSidebar() {
  var trendingHTML = getFallbackMostReadItems().map(function(item, i){
    return '<a href="' + item.href + '" style="color:inherit;text-decoration:none;">'
      + '<div class="trending-item">'
      + '<div class="trending-num">' + (i+1) + '</div>'
      + '<p class="vocab-zone">' + item.title + '</p>'
      + '</div></a>';
  }).join('');

  // Word Bank - VOCAB에서 랜덤 6개
  var vocabKeys = Object.keys(VOCAB);
  var seed = Math.floor(Date.now() / 60000);
  var shuffled = vocabKeys.slice().sort(function(a,b){
    return Math.sin(seed * a.charCodeAt(0)) - Math.sin(seed * b.charCodeAt(0));
  });
  var wbWords = shuffled.slice(0, 6).map(function(k){
    return { ko: k, rom: VOCAB[k].rom, en: VOCAB[k].en };
  });

  return '<div class="sidebar">'
    + '<div class="sidebar-box">'
    + '<div class="box-title">' + khIcon('flame', 'Most Read', 'kh-ui-icon-sm') + '</div>'
    + '<div id="kh-most-read-list">' + trendingHTML + '</div>'
    + '</div>'

    // ── Live Korea Weather ────────────────────────────────────
    + '<div class="sidebar-box kh-weather-box" id="kh-weather-box">'
    + '<div class="box-title">' + khIcon('cloud-sun', 'Korea Weather', 'kh-ui-icon-sm') + '<span id="kh-kst-time" class="kh-kst-time"></span></div>'
    + '<div id="kh-weather-content" class="kh-weather-loading">'
    + '<div class="kh-weather-spinner"></div>'
    + '</div>'
    + '</div>'

    // ── Word Bank ────────────────────────────────────────────
    + '<div class="sidebar-box">'
    + '<div class="box-title">' + khIcon('book-marked', 'Word Bank', 'kh-ui-icon-sm') + '<span style="margin-left:auto;font-size:10px;font-weight:500;color:var(--gray);text-transform:none;letter-spacing:0">Click to save</span></div>'
    + wbWords.map(function(w){
        return '<div class="kh-wb-row" id="kh-wb-' + encodeURIComponent(w.ko) + '" onclick="khSaveWbWord(this,\'' + w.ko.replace(/'/g,"\\'") + '\',\'' + (w.rom||'').replace(/'/g,"\\'") + '\',\'' + (w.en||'').replace(/'/g,"\\'") + '\')">'
          + '<div class="kh-wb-left">'
          + '<span class="kh-wb-ko">' + w.ko + '</span>'
          + '<span class="kh-wb-rom">' + (w.rom || '') + '</span>'
          + '</div>'
          + '<div class="kh-wb-right">'
          + '<span class="kh-wb-en">' + (w.en || '') + '</span>'
          + '<span class="kh-wb-save-icon">'
          + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>'
          + '</span>'
          + '</div>'
          + '</div>';
      }).join('')
    + '</div>'

    + '<div class="sidebar-box">'
    + '<a href="korehan-learn.html" style="text-decoration:none;display:block;background:linear-gradient(135deg,#0b1626,#1a3a6b);border-radius:8px;padding:16px;color:#fff;text-align:center">'
    + '<div style="display:flex;justify-content:center;margin-bottom:8px">' + khIcon('languages', '', 'kh-ui-icon-lg') + '</div>'
    + '<div style="font-weight:700;font-size:14px;margin-bottom:4px">Learn Korean</div>'
    + '<div style="font-size:12px;color:rgba(255,255,255,0.6)">Flashcards · Quiz · Sentences</div>'
    + '</a></div>'
    + '</div>';
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

// ── Korea Live Weather ───────────────────────────────────────
var _khWeatherCache = null;
var _khWeatherFetchTime = 0;

var KH_WEATHER_CITIES = [
  { id: 'Seoul',   label: 'Seoul',   ko: '서울' },
  { id: 'Busan',   label: 'Busan',   ko: '부산' },
  { id: 'Incheon', label: 'Incheon', ko: '인천' },
  { id: 'Jeju',    label: 'Jeju',    ko: '제주' }
];

var KH_WMO_ICONS = {
  0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',
  51:'🌦️',53:'🌦️',55:'🌧️',56:'🌧️',57:'🌧️',
  61:'🌧️',63:'🌧️',65:'🌧️',66:'🌨️',67:'🌨️',
  71:'🌨️',73:'❄️',75:'❄️',77:'🌨️',
  80:'🌦️',81:'🌧️',82:'⛈️',85:'🌨️',86:'❄️',
  95:'⛈️',96:'⛈️',99:'⛈️'
};

function khKstTime() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}

function khStartKstClock() {
  var el = document.getElementById('kh-kst-time');
  if (!el) return;
  function tick() {
    var t = khKstTime();
    var h = t.getHours(), m = t.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    el.textContent = h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm + ' KST';
  }
  tick();
  setInterval(tick, 30000);
}

async function khFetchWeather() {
  var now = Date.now();
  if (_khWeatherCache && now - _khWeatherFetchTime < 600000) return _khWeatherCache;

  // Open-Meteo: free, no API key, CORS-friendly
  var coords = {
    Seoul:   { lat: 37.5665, lon: 126.9780 },
    Busan:   { lat: 35.1796, lon: 129.0756 },
    Incheon: { lat: 37.4563, lon: 126.7052 },
    Jeju:    { lat: 33.4996, lon: 126.5312 }
  };
  var results = {};
  try {
    var entries = Object.keys(coords);
    var fetches = entries.map(function(city) {
      var c = coords[city];
      return fetch('https://api.open-meteo.com/v1/forecast?latitude=' + c.lat + '&longitude=' + c.lon
        + '&current=temperature_2m,weathercode,windspeed_10m&temperature_unit=celsius&windspeed_unit=kmh&forecast_days=1')
        .then(function(r){ return r.json(); })
        .then(function(d){
          results[city] = {
            temp: Math.round(d.current.temperature_2m),
            code: d.current.weathercode,
            wind: Math.round(d.current.windspeed_10m)
          };
        })
        .catch(function(){ results[city] = null; });
    });
    await Promise.all(fetches);
    _khWeatherCache = results;
    _khWeatherFetchTime = now;
    return results;
  } catch(e) {
    return null;
  }
}

function khWeatherConditionLabel(code) {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 48) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  return 'Thunderstorm';
}

async function khHydrateWeather() {
  khStartKstClock();
  var box = document.getElementById('kh-weather-content');
  if (!box) return;
  try {
    var data = await khFetchWeather();
    if (!data) throw new Error('no data');
    box.className = '';
    box.innerHTML = KH_WEATHER_CITIES.map(function(city, i) {
      var w = data[city.id];
      var icon = w ? (KH_WMO_ICONS[w.code] || '🌡️') : '–';
      var temp = w ? w.temp + '°C' : '–';
      var cond = w ? khWeatherConditionLabel(w.code) : '';
      var isLast = i === KH_WEATHER_CITIES.length - 1;
      return '<div class="kh-weather-row' + (isLast ? ' last' : '') + '">'
        + '<span class="kh-weather-city"><span class="kh-weather-city-en">' + city.label + '</span><span class="kh-weather-city-ko">' + city.ko + '</span></span>'
        + '<span class="kh-weather-right"><span class="kh-weather-icon">' + icon + '</span><span class="kh-weather-temp">' + temp + '</span><span class="kh-weather-cond">' + cond + '</span></span>'
        + '</div>';
    }).join('');
  } catch(e) {
    box.className = '';
    box.innerHTML = '<div style="font-size:12px;color:var(--gray);padding:8px 0">Weather data unavailable</div>';
  }
}

var _mostReadSidebarCache = null;

function getFallbackMostReadItems() {
  return published().slice(0, 5).map(function(a) {
    return {
      type: 'article',
      id: a.id,
      title: a.title || a.title_ko || 'Untitled article',
      href: articleUrl(a.id),
      score: 0
    };
  });
}

function mostReadHref(type, id) {
  if (type === 'conversation') return 'korehan-conversations.html?id=' + encodeURIComponent(id);
  if (type === 'story') return 'korehan-stories.html?id=' + encodeURIComponent(id);
  return articleUrl(id);
}

function renderMostReadList(items) {
  return (items || []).slice(0, 5).map(function(item, i){
    return '<a href="' + item.href + '" style="color:inherit;text-decoration:none;">'
      + '<div class="trending-item">'
      + '<div class="trending-num">' + (i + 1) + '</div>'
      + '<p class="vocab-zone">' + escapeHtml(item.title || 'Untitled') + '</p>'
      + '</div></a>';
  }).join('');
}

async function fetchMostReadItems() {
  if (_mostReadSidebarCache && _mostReadSidebarCache.length) return _mostReadSidebarCache;
  var fallback = getFallbackMostReadItems();
  var sb = getSupa();
  if (!sb) return fallback;

  try {
    var viewsRes = await sb.from('article_views')
      .select('article_id,title,view_count')
      .order('view_count', { ascending: false })
      .limit(30);
    var ranked = (viewsRes.data || []).slice(0, 5).map(function(row) {
      return {
        title: row.title || 'Untitled',
        href: articleUrl(row.article_id)
      };
    });
    _mostReadSidebarCache = ranked.length ? ranked : fallback;
    return _mostReadSidebarCache;
  } catch(e) {
    return fallback;
  }
}

async function hydrateMostReadSidebar() {
  var el = document.getElementById('kh-most-read-list');
  if (!el) return;
  var items = await fetchMostReadItems();
  el.innerHTML = renderMostReadList(items);
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



// ══ MOBILE SIDEBAR ══════════════════════════════════════════════════════════

function khInjectSidebar() {
  if (document.getElementById('kh-mobile-sidebar')) return;

  // CSS
  var style = document.createElement('style');
  style.textContent = [
    '.kh-ham{display:none;background:none;border:none;font-size:22px;cursor:pointer;color:var(--text,#0d1b2e);padding:4px 8px;flex-shrink:0;line-height:1;position:relative;z-index:50;-webkit-tap-highlight-color:transparent;}',
    '.kh-sb-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1500;}',
    '.kh-sb-overlay.on{display:block;}',
    '.kh-sidebar{position:fixed;top:0;left:0;bottom:0;width:268px;background:#0b1626;z-index:1600;transform:translateX(-100%);transition:transform .25s cubic-bezier(.4,0,.2,1);overflow-y:auto;display:flex;flex-direction:column;}',
    '.kh-sidebar.on{transform:translateX(0);}',
    '.kh-sb-top{padding:16px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}',
    '.kh-sb-brand{display:flex;align-items:baseline;gap:4px;}',
    ".kh-sb-brand .sb-kore{font-family:\'Playfair Display\',serif;font-size:20px;font-weight:900;color:#7ab8f5;}",
    ".kh-sb-brand .sb-han{font-family:\'Playfair Display\',serif;font-size:20px;font-weight:900;color:#fff;}",
    ".kh-sb-brand .sb-news{font-size:13px;font-weight:600;color:rgba(255,255,255,.5);margin-left:3px;}",
    '.kh-sb-x{background:none;border:none;color:rgba(255,255,255,.5);font-size:22px;cursor:pointer;line-height:1;padding:0;}',
    '.kh-sb-sec{padding:14px 12px 6px;}',
    '.kh-sb-lbl{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.4px;color:rgba(255,255,255,.25);padding:0 6px;margin-bottom:4px;}',
    '.kh-sb-a{display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:6px;font-size:13px;font-weight:500;color:rgba(255,255,255,.65);cursor:pointer;border:none;background:none;width:100%;text-align:left;font-family:inherit;transition:all .13s;text-decoration:none;}',
    '.kh-sb-a:hover,.kh-sb-a.on{background:rgba(255,255,255,.08);color:#fff;}',
    '.kh-sb-ico{font-size:15px;width:20px;text-align:center;flex-shrink:0;}',
    '.kh-sb-new{margin-left:auto;background:#e53e3e;color:#fff;font-size:9px;font-weight:800;padding:1px 6px;border-radius:2px;flex-shrink:0;}',
    '.kh-sb-arrow{margin-left:auto;font-size:11px;color:rgba(255,255,255,.25);transition:transform .18s;flex-shrink:0;}',
    '.kh-sb-arrow.on{transform:rotate(90deg);}',
    '.kh-sb-sub{display:none;padding-left:10px;}',
    '.kh-sb-sub.on{display:block;}',
    '.kh-sb-sub-a{display:block;width:100%;padding:7px 10px;font-size:12px;color:rgba(255,255,255,.5);border:none;background:none;text-align:left;font-family:inherit;cursor:pointer;border-radius:5px;transition:all .12s;text-decoration:none;}',
    '.kh-sb-sub-a:hover{color:#fff;background:rgba(255,255,255,.05);}',
    '@media(max-width:900px){.kh-ham{display:flex !important;align-items:center;position:relative;z-index:50;}.kh-topnav{display:none !important;}.kh-nav{display:none !important;}}'
  ].join('');
  document.head.appendChild(style);

  // Overlay
  var ov = document.createElement('div');
  ov.id = 'kh-sb-overlay';
  ov.className = 'kh-sb-overlay';
  ov.onclick = khSbClose;
  document.body.appendChild(ov);

  // Sidebar
  var page = window.location.pathname.split('/').pop() || 'index.html';
  var sb = document.createElement('nav');
  sb.id = 'kh-mobile-sidebar';
  sb.className = 'kh-sidebar';
  sb.innerHTML =
    '<div class="kh-sb-top">'
      + '<div class="kh-sb-brand"><span class="sb-kore">Kore</span><span class="sb-han">Han</span><span class="sb-news">News</span></div>'
      + '<button class="kh-sb-x" onclick="khSbClose()">&#x2715;</button>'
    + '</div>'
    + '<div class="kh-sb-sec">'
      + '<div class="kh-sb-lbl">Navigation</div>'
      + '<a href="index.html" class="kh-sb-a' + (page==='index.html'?' on':'') + '"><span class="kh-sb-ico">&#x1F3E0;</span>Home</a>'
    + '</div>'
    + '<div class="kh-sb-sec">'
      + '<div class="kh-sb-lbl">Read</div>'
      + '<button class="kh-sb-a" onclick=\"khSbToggle(\'sb-news\',\'sb-arr-news\')\"><span class="kh-sb-ico">&#x1F4F0;</span>News<span class="kh-sb-arrow" id="sb-arr-news">&#x203A;</span></button>'
      + '<div class="kh-sb-sub" id="sb-news">'
        + '<a href="korehan-all.html" class="kh-sb-sub-a">All News</a>'
        + '<a href="korehan-society.html" class="kh-sb-sub-a">&#x1F3DB;&#xFE0F; Society</a>'
        + '<a href="korehan-world.html" class="kh-sb-sub-a">&#x1F310; World</a>'
        + '<a href="korehan-culture.html" class="kh-sb-sub-a">&#x1F3AD; Culture</a>'
        + '<a href="korehan-section.html?s=kpop" class="kh-sb-sub-a">&#x1F3B5; K-pop</a>'
        + '<a href="korehan-section.html?s=beauty" class="kh-sb-sub-a">&#x1F484; Beauty</a>'
        + '<a href="korehan-section.html?s=travel" class="kh-sb-sub-a">&#x2708;&#xFE0F; Travel</a>'
        + '<a href="korehan-korea.html" class="kh-sb-sub-a">&#x1F1F0;&#x1F1F7; Korea</a>'
      + '</div>'
      + '<button class="kh-sb-a" onclick=\"khSbToggle(\'sb-conv\',\'sb-arr-conv\')\"><span class="kh-sb-ico">&#x1F4AC;</span>Conversations<span class="kh-sb-new">New</span><span class="kh-sb-arrow" id="sb-arr-conv" style="margin-left:4px">&#x203A;</span></button>'
      + '<div class="kh-sb-sub" id="sb-conv">'
        + '<a href="korehan-conversations.html" class="kh-sb-sub-a">All</a>'
        + '<a href="korehan-conversations.html?cat=everyday" class="kh-sb-sub-a">Everyday</a>'
        + '<a href="korehan-conversations.html?cat=work" class="kh-sb-sub-a">Workplace</a>'
        + '<a href="korehan-conversations.html?cat=friends" class="kh-sb-sub-a">Friends</a>'
        + '<a href="korehan-conversations.html?cat=dating" class="kh-sb-sub-a">Dating</a>'
      + '</div>'
      + '<button class="kh-sb-a" onclick=\"khSbToggle(\'sb-stor\',\'sb-arr-stor\')\"><span class="kh-sb-ico">&#x1F4D6;</span>Stories<span class="kh-sb-new">New</span><span class="kh-sb-arrow" id="sb-arr-stor" style="margin-left:4px">&#x203A;</span></button>'
      + '<div class="kh-sb-sub" id="sb-stor">'
        + '<a href="korehan-stories.html" class="kh-sb-sub-a">All</a>'
        + '<a href="korehan-stories.html?mood=fun" class="kh-sb-sub-a">&#x1F602; Fun</a>'
        + '<a href="korehan-stories.html?mood=touching" class="kh-sb-sub-a">&#x1F979; Touching</a>'
        + '<a href="korehan-stories.html?mood=scary" class="kh-sb-sub-a">&#x1F631; Scary</a>'
        + '<a href="korehan-stories.html?mood=shocking" class="kh-sb-sub-a">&#x1F62E; Shocking</a>'
      + '</div>'
    + '</div>'
    + '<div class="kh-sb-sec">'
      + '<div class="kh-sb-lbl">Learn</div>'
      + '<a href="korehan-study-room.html" class="kh-sb-a' + (page==='korehan-study-room.html'?' on':'') + '"><span class="kh-sb-ico">&#x1F4D6;</span>Study Room</a>'
      + '<a href="korehan-shop.html" class="kh-sb-a' + (page==='korehan-shop.html'?' on':'') + '"><span class="kh-sb-ico">&#x1F6D2;</span>Shop</a>'
      + '<a href="korehan-fun.html" class="kh-sb-a' + (page==='korehan-fun.html'?' on':'') + '"><span class="kh-sb-ico">&#x2728;</span>FUN</a>'
      + '<a href="korehan-learning-overview.html" class="kh-sb-a' + (page==='korehan-learning-overview.html'?' on':'') + '"><span class="kh-sb-ico">&#x1F4CA;</span>Growth Lab</a>'
      + '<a href="korehan-courses.html" class="kh-sb-a' + (page==='korehan-courses.html'?' on':'') + '"><span class="kh-sb-ico">&#x1F393;</span>Courses</a>'
    + '</div>'
    + '<div class="kh-sb-sec" id="kh-sb-auth-sec" style="margin-top:auto;padding-top:12px;border-top:1px solid rgba(255,255,255,.08);position:sticky;bottom:0;background:#0b1626;box-shadow:0 -10px 24px rgba(0,0,0,.18)">'
      + '<div id="kh-sb-auth-row"></div>'
    + '</div>';
  document.body.appendChild(sb);
  updateSidebarAuth();
}

function updateSidebarAuth() {
  var row = document.getElementById('kh-sb-auth-row');
  if (!row) return;
  if (supaUser) {
    var name = (supaUser.user_metadata && supaUser.user_metadata.full_name) || supaUser.email.split('@')[0];
    row.innerHTML =
      '<button id="kh-sb-neon-toggle" class="kh-sb-a" onclick="toggleKhNeon(event)" style="width:100%;text-align:left;background:none;border:none;cursor:pointer;font-family:inherit">'
      + '<span class="kh-sb-ico">&#9889;</span>Neon theme: OFF</button>'
      + '<div style="padding:10px 16px;font-size:13px;color:var(--gray,#445566)">'
      + '<div style="font-weight:800;color:var(--dark,#0d1b2e);margin-bottom:2px">' + name + '</div>'
      + '<div style="font-size:11px;opacity:.6">' + supaUser.email + '</div>'
      + '</div>'
      + '<a href="korehan-mypage.html" class="kh-sb-a" onclick="khSbClose()">'
      + '<span class="kh-sb-ico">&#x1F464;</span>My Page</a>'
      + '<button class="kh-sb-a" onclick="signOut();khSbClose()" style="width:100%;text-align:left;background:none;border:none;cursor:pointer;font-family:inherit">'
      + '<span class="kh-sb-ico">&#x1F6AA;</span>Sign Out</button>';
  } else {
    row.innerHTML =
      '<button id="kh-sb-neon-toggle" class="kh-sb-a" onclick="toggleKhNeon(event)" style="width:100%;text-align:left;background:none;border:none;cursor:pointer;font-family:inherit">'
      + '<span class="kh-sb-ico">&#9889;</span>Neon theme: OFF</button>'
      + '<button class="kh-sb-a" onclick="openAuthModal(\'signin\');khSbClose()" style="width:100%;text-align:left;background:none;border:none;cursor:pointer;font-family:inherit">'
      + '<span class="kh-sb-ico">&#x1F511;</span>Sign In</button>'
      + '<button class="kh-sb-a" onclick="openAuthModal(\'signup\');khSbClose()" style="width:100%;text-align:left;background:none;border:none;cursor:pointer;font-family:inherit;color:var(--bright,#2255a4);font-weight:800">'
      + '<span class="kh-sb-ico">&#x2728;</span>Join Free</button>';
  }
  syncNeonToggleButtons();
}

function khSbOpen() {
  khInjectSidebar();
  document.getElementById('kh-mobile-sidebar').classList.add('on');
  document.getElementById('kh-sb-overlay').classList.add('on');
  document.body.style.overflow = 'hidden';
}
function khSbClose() {
  var sb = document.getElementById('kh-mobile-sidebar');
  var ov = document.getElementById('kh-sb-overlay');
  if (sb) sb.classList.remove('on');
  if (ov) ov.classList.remove('on');
  document.body.style.overflow = '';
}
function khSbToggle(subId, arrId) {
  var s = document.getElementById(subId);
  var a = document.getElementById(arrId);
  if (!s) return;
  var open = s.classList.contains('on');
  document.querySelectorAll('.kh-sb-sub').forEach(function(x){ x.classList.remove('on'); });
  document.querySelectorAll('.kh-sb-arrow').forEach(function(x){ x.classList.remove('on'); });
  if (!open) { s.classList.add('on'); if(a) a.classList.add('on'); }
}

// 사이드바 초기화 — renderHeader 이후 자동 실행
(function() {
  })();

// ══ END MOBILE SIDEBAR ══════════════════════════════════════════════════════

/* ===== Mobile redesign patch v3 ===== */


function getHomeLearningSnapshot() {
  var stats = {
    streak: 0,
    words: 0,
    articles: 0,
    quizzes: 0,
    xp: 0,
    weakGrammar: '-아/어서 vs -고',
    weakCount: 8
  };
  try {
    stats.streak = getCurrentStreak ? getCurrentStreak() : 0;
  } catch(e) {}
  try {
    var dm = dmGet ? dmGet() : { words:0, articles:0, quizzes:0 };
    stats.words = dm.words || 0;
    stats.articles = dm.articles || 0;
    stats.quizzes = dm.quizzes || 0;
  } catch(e) {}
  try { stats.xp = getXP ? getXP() : 0; } catch(e) {}
  try {
    var weak = lsGet('kh_weak_grammar', null);
    if (weak && weak.name) {
      stats.weakGrammar = weak.name;
      stats.weakCount = weak.missed || stats.weakCount;
    }
  } catch(e) {}
  return stats;
}

async function fetchUserStatsRow() {
  if (!supaUser) return null;
  try {
    var sb = getSupa();
    if (!sb) return null;
    var res = await sb.from('user_stats').select('*').eq('user_id', supaUser.id).maybeSingle();
    return res.data || null;
  } catch(e) {
    return null;
  }
}

function getLocalWeakGrammarItems(limit) {
  var items = [];
  try {
    var raw = localStorage.getItem('kh_quiz_grammar_stats');
    if (raw) {
      var obj = JSON.parse(raw);
      Object.keys(obj).forEach(function(k) {
        var v = obj[k] || {};
        if ((v.wrong || 0) > 0) {
          items.push({
            grammar_point: k,
            wrong_count: v.wrong || 0,
            correct_count: v.correct || 0
          });
        }
      });
      items.sort(function(a, b) { return (b.wrong_count || 0) - (a.wrong_count || 0); });
    }
  } catch(e) {}
  return typeof limit === 'number' ? items.slice(0, limit) : items;
}

async function getUnifiedWeakGrammarItems(limit) {
  var localItems = getLocalWeakGrammarItems(limit);
  var sb = getSupa();
  if (!(sb && supaUser)) return localItems;

  try {
    var res = await sb.from('user_grammar_stats')
      .select('grammar_point,wrong_count,correct_count')
      .eq('user_id', supaUser.id)
      .gt('wrong_count', 0)
      .order('wrong_count', { ascending: false })
      .limit(limit || 5);
    if (res.data && res.data.length) return res.data;
  } catch(e) {}
  return localItems;
}

async function renderHomeLearningPreview() {
  var box = document.getElementById('home-learning-preview');
  if (!box) return;
  var showWelcomeTip = false;
  try {
    var welcomeTipKey = getWelcomeTipStorageKey(supaUser && supaUser.id);
    showWelcomeTip = window.location.search.indexOf('welcome=1') > -1 || localStorage.getItem(welcomeTipKey) === '1';
  } catch(e) {}

  // Not signed in
  if (!supaUser) {
    box.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">'
      + '<div style="font-size:15px;font-weight:900;color:#fff;line-height:1.25">New to Korean? <span style="color:#7dd3fc">Start here.</span></div>'
      + '<div style="font-size:10px;font-weight:800;padding:4px 10px;border-radius:999px;background:rgba(125,211,252,.14);border:1px solid rgba(125,211,252,.22);color:#bfdbfe;white-space:nowrap">Free to start</div>'
      + '</div>'
      + '<div style="font-size:14px;color:rgba(255,255,255,.72);line-height:1.65;margin-bottom:14px;">Pick an article, hover words to save them, then open Study Room for a focused review. Your progress tracks automatically once you sign up.</div>'
      + '<a href="beginner-guide.html" style="display:inline-flex;align-items:center;gap:6px;padding:10px 16px;background:linear-gradient(135deg,#38bdf8,#2563eb);color:#fff;border-radius:10px;font-size:13px;font-weight:900;text-decoration:none;box-shadow:0 10px 22px rgba(37,99,235,.28);">Open Beginner Guide →</a>';
    return;
  }

  if (showWelcomeTip) {
    box.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap">'
      + '<div style="font-size:13px;font-weight:900;color:#fff">New here? Start with the Beginner Guide.</div>'
      + '<div style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:rgba(125,211,252,.18);color:#dbeafe">Tip for first session</div>'
      + '</div>'
      + '<div style="font-size:12px;color:rgba(255,255,255,.74);line-height:1.6;margin-bottom:12px">Read one article, open Study Room, then check Growth Lab. The Beginner Guide maps the full flow for your first session.</div>'
      + '<a href="beginner-guide.html" style="display:inline-flex;align-items:center;justify-content:center;padding:11px 16px;border-radius:12px;background:linear-gradient(135deg,#38bdf8,#2563eb);color:#fff;font-size:12px;font-weight:900;text-decoration:none;box-shadow:0 12px 22px rgba(37,99,235,.26);animation:khGuidePulse 1.8s ease-in-out infinite">Open Beginner Guide →</a>'
      + '<style>@keyframes khGuidePulse{0%,100%{transform:translateY(0);box-shadow:0 12px 22px rgba(37,99,235,.26)}50%{transform:translateY(-1px);box-shadow:0 16px 28px rgba(56,189,248,.34)}}</style>';
    try { localStorage.removeItem(getWelcomeTipStorageKey(supaUser && supaUser.id)); } catch(e) {}
    return;
  }

  // localStorage 기반 즉시 표시 (빠른 렌더)
  var dm = dmGet ? dmGet() : {};
  var xp = dmXPFromData(dm);
  var streak = getCurrentStreak ? getCurrentStreak() : 0;

  // weak grammar — DB 우선, localStorage fallback
  var weakGrammar = '-아/어서 vs -고';
  var weakCount = 0;
  var weakItems = await getUnifiedWeakGrammarItems(1);
  if (weakItems.length) {
    weakGrammar = weakItems[0].grammar_point;
    weakCount   = weakItems[0].wrong_count || 0;
  }

  // DB에서 최신 데이터 비동기로 보강
  var sb = getSupa();
  if (sb && supaUser) {
    try {
      var dmRes = await sb.from('daily_missions')
        .select('articles,words,quizzes,fill')
        .eq('user_id', supaUser.id)
        .eq('date', dmToday())
        .maybeSingle();
      if (dmRes.data) {
        dm.articles = Math.max(dm.articles || 0, dmRes.data.articles || 0);
        dm.words    = Math.max(dm.words    || 0, dmRes.data.words    || 0);
        dm.quizzes  = Math.max(dm.quizzes  || 0, dmRes.data.quizzes  || 0);
        dm.fill     = Math.max(dm.fill     || 0, dmRes.data.fill     || 0);
        xp = dmXPFromData(dm);
        dmSet(dm);
      }
      // user_stats
      var statsRes = await sb.from('user_stats').select('xp,mission_streak,streak,articles_read,words_saved,quizzes_done').eq('user_id', supaUser.id).maybeSingle();
      if (statsRes.data) {
        lsSet('kh_synced_mission_streak', Math.max(statsRes.data.mission_streak || 0, statsRes.data.streak || 0));
      }
      streak = Math.max(streak, await fetchActivityStreakFromDB(sb, supaUser.id));
    } catch(e) {}
  }

  var wordsDone   = (dm.words    || 0) >= 20;
  var artsDone    = (dm.articles || 0) >= 3;
  var hasWeak = weakCount > 0;
  var weakQ = encodeURIComponent(weakGrammar);

  // Update review button state based on today's articles read
  if (window._updateReviewBtn) window._updateReviewBtn((dm.articles || 0) > 0);

  function _progCard(val, goal, label, done) {
    var bg   = done ? 'rgba(74,222,128,.14)'    : 'rgba(255,255,255,.06)';
    var bord = done ? 'rgba(74,222,128,.35)'    : 'rgba(255,255,255,.08)';
    var valC = done ? '#4ade80'                 : '#fff';
    var lblC = done ? 'rgba(74,222,128,.75)'    : 'rgba(255,255,255,.58)';
    var tick = done ? ' ✓' : '';
    return '<div style="flex:1;background:' + bg + ';border:1px solid ' + bord + ';border-radius:12px;padding:9px 10px;text-align:center;transition:background .2s,border-color .2s;">'
      + '<div style="font-size:16px;font-weight:900;color:' + valC + ';">' + val
      + (done ? tick : '<span style="font-size:10px;color:rgba(255,255,255,.5)">/' + goal + '</span>')
      + '</div>'
      + '<div style="font-size:10px;color:' + lblC + ';font-weight:700;">' + label + '</div>'
      + '</div>';
  }

  box.innerHTML =
    // streak badge + stats row
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">'
    + '<div style="font-size:12px;font-weight:800;color:#fff">Today\'s Progress</div>'
    + '<div style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:rgba(255,179,71,.14);border:1px solid rgba(255,179,71,.24);color:#ffd089;">🔥 ' + streak + ' day streak</div>'
    + '</div>'
    + '<div style="display:flex;gap:6px;margin-bottom:12px;">'
    + _progCard(dm.words||0, 20, 'Words', wordsDone)
    + _progCard(dm.articles||0, 3, 'Articles', artsDone)
    + _progCard(xp, null, 'XP', false)
    + '</div>'
    // weak grammar
    + '<div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;">'
    + '<div style="min-width:0;">'
    +   '<div style="font-size:10px;font-weight:800;color:' + (hasWeak?'#ffd089':'#8ff0b3') + ';margin-bottom:2px;">' + (hasWeak?'⚠️ Weak Grammar':'✅ Grammar') + '</div>'
    +   '<div style="font-size:13px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + weakGrammar + '</div>'
    + '</div>'
    + '<a href="korehan-study-room.html?focus=' + weakQ + '&source=home-weak-grammar" style="flex-shrink:0;font-size:11px;font-weight:800;padding:7px 11px;background:#2563eb;color:#fff;border-radius:999px;text-decoration:none;white-space:nowrap;">Practice →</a>'
    + '</div>';
}

window.renderHomeLearningPreview = renderHomeLearningPreview;

function isMobileRedesign() {
  return window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
}

function pageName() {
  return (window.location.pathname.split('/').pop() || 'index.html').replace(/\.html$/,'');
}

function markMobileBody() {
  if (!isMobileRedesign()) return;
  document.body.classList.add('mobile-redesign');
}

function injectMobileBottomNav() {
  if (!isMobileRedesign()) return;
  var page = pageName();
  var nav = document.querySelector('.mobile-bottom-nav');
  if (!nav) {
    nav = document.createElement('nav');
    nav.className = 'mobile-bottom-nav';
    document.body.appendChild(nav);
  }
  var items = [
    ['index.html','home','Home','index'],
    ['korehan-all.html','newspaper','News','korehan-all'],
    ['korehan-study-room.html','notebook-pen','Learn','korehan-study-room'],
    ['korehan-conversations.html','messages-square','CONVO','korehan-conversations'],
  ];
  if (supaUser) items.push(['#','circle-user-round','Account','account']);
  else items.push(['#','log-in','Sign In','signin']);
  nav.innerHTML = items.map(function(it){
    var isOn = page===it[3];
    var extra = '';
    if (it[3] === 'signin') extra = ' onclick="event.preventDefault();openAuthModal(\'signin\')"';
    else if (it[3] === 'account') extra = ' onclick="event.preventDefault();openMobileAccountMenu()"';
    return '<a href="'+it[0]+'" class="'+(isOn?'on':'')+'"' + extra + '><span class="ico">' + khIcon(it[1], '', 'kh-ui-icon-mobile') + '</span><span>'+it[2]+'</span></a>';
  }).join('');
  renderKhLucideIcons();
}

function openMobileAccountMenu() {
  if (!supaUser) { openAuthModal('signin'); return; }
  // Open the sidebar — it has My Page + Sign Out for logged-in users
  khSbOpen();
}

function mobileCreateCardHTML(label, value, href) {
  return '<a class="mobile-mini-card" href="'+href+'"><div class="label">'+label+'</div><div class="value">'+value+'</div></a>';
}

function enhanceHomeMobile() {
  if (!isMobileRedesign() || pageName() !== 'index') return;
  var container = document.querySelector('.container');
  if (!container || document.querySelector('.mobile-quick-start')) return;

  // 바로가기 섹션 제거됨 — daily-strip 내 버튼으로 충분
}

function enhanceArticleMobile() {
  if (!isMobileRedesign() || pageName() !== 'korehan-article') return;
  var article = document.querySelector('.kh-article-wrap');
  if (!article) return;
  // Remove duplicate mobile-study-tabs if they exist (art-tabs already has 4 tabs)
  var dupTabs = article.querySelector('.mobile-study-tabs');
  if (dupTabs) dupTabs.remove();
}

function enhanceConversationsMobile() {
  if (!isMobileRedesign() || pageName() !== 'korehan-conversations') return;
  // Conversation Study banner removed — unnecessary

  var observer = new MutationObserver(function(){
    var panel = document.querySelector('.detail-panel');
    if (!panel) return;
    var cta = panel.querySelector('.dp-cta-row');
    if (cta && !cta.dataset.mobileEnhanced) {
      cta.dataset.mobileEnhanced = '1';
      cta.style.gridTemplateColumns = '1fr 1fr';
    }
  });
  observer.observe(document.body, { childList:true, subtree:true });
}

function enhanceStoriesMobile() {
  if (!isMobileRedesign() || pageName() !== 'korehan-stories') return;
  var root = document.querySelector('.st-container') || document.body;
  if (root && !document.querySelector('.mobile-section-shell[data-mobile="story"]')) {
    var shell = document.createElement('section');
    shell.className = 'mobile-section-shell';
    shell.setAttribute('data-mobile','story');
    shell.innerHTML = ''
      + '<div class="mobile-eyebrow">Story reading</div>'
      + '<h2 class="mobile-quick-title" style="font-size:28px">Short stories should feel easy to finish on mobile.</h2>'
      + '<p class="mobile-quick-sub">Pick a mood, read one story, then review the key words and discuss what happened.</p>'
      + '<div class="mobile-action-row">'
      + '<a class="mobile-primary-btn" href="korehan-stories.html?mood=fun">' + khIcon('sparkles', 'Fun stories', 'kh-ui-icon-sm') + '</a>'
      + '<a class="mobile-secondary-btn" href="korehan-stories.html?mood=touching">' + khIcon('heart', 'Touching', 'kh-ui-icon-sm') + '</a>'
      + '</div>';
    root.insertAdjacentElement('afterbegin', shell);
  }

  var observer = new MutationObserver(function(){
    var panel = document.querySelector('.st-panel');
    if (!panel || panel.querySelector('.mobile-tier-card')) return;
    var head = panel.querySelector('.st-head-info');
    if (head) {
      var box = document.createElement('div');
      box.className = 'mobile-tier-card';
      box.style.margin = '0 24px 14px';
      box.innerHTML = ''
        + '<div class="mobile-eyebrow">Story study</div>'
        + '<h3 style="font-size:22px;line-height:1.08;font-weight:900;color:#fff;margin:0 0 8px">Read → Vocabulary → Quiz → Discussion</h3>'
        + '<p class="mobile-quick-sub">Stories work best when the reading screen is calm and the study actions are obvious.</p>'
        + '<div class="mobile-action-row">'
        + '<a class="mobile-primary-btn" href="javascript:void(0)">' + khIcon('book-marked', 'Vocabulary', 'kh-ui-icon-sm') + '</a>'
        + '<a class="mobile-secondary-btn" href="korehan-study-room.html">' + khIcon('message-circle', 'Discussion', 'kh-ui-icon-sm') + '</a>'
        + '</div>';
      head.insertAdjacentElement('afterend', box);
    }
    var cta = panel.querySelector('.st-cta-row');
    if (cta && !cta.dataset.mobileEnhanced) {
      cta.dataset.mobileEnhanced = '1';
      cta.innerHTML = ''
        + '<button class="st-cta-btn st-cta-pri">Vocabulary</button>'
        + '<button class="st-cta-btn st-cta-sec">Quiz</button>'
        + '<button class="st-cta-btn st-cta-sec">Discussion</button>'
        + '<button class="st-cta-btn st-cta-sec">Practice</button>';
      cta.style.gridTemplateColumns = '1fr 1fr';
    }
  });
  observer.observe(document.body, { childList:true, subtree:true });
}

function enhanceCollectionPagesMobile() {
  if (!isMobileRedesign()) return;
  var p = pageName();
  if (['korehan-all','korehan-world','korehan-society','korehan-culture','korehan-korea','korehan-section'].indexOf(p) >= 0) {
    var list = document.getElementById('dyn-article-list');
    if (list && !document.querySelector('.mobile-section-shell[data-mobile="news"]')) {
      var shell = document.createElement('section');
      shell.className = 'mobile-section-shell';
      shell.setAttribute('data-mobile','news');
      shell.innerHTML = ''
        + '<div class="mobile-eyebrow">News study</div>'
        + '<h2 class="mobile-quick-title" style="font-size:28px">Read one article at your level, not ten at once.</h2>'
        + '<p class="mobile-quick-sub">The goal on mobile is quick entry: pick a category, open one article, then move into vocab or quiz.</p>'
        + '<div class="mobile-action-row">'
        + '<a class="mobile-primary-btn" href="korehan-study-room.html">' + khIcon('notebook-pen', 'Start Learning', 'kh-ui-icon-sm') + '</a>'
        + '<a class="mobile-secondary-btn" href="korehan-learn.html">' + khIcon('book-marked', 'Review vocab', 'kh-ui-icon-sm') + '</a>'
        + '</div>';
      list.insertAdjacentElement('beforebegin', shell);
    }
  }
}

// ── Study continuity helpers ───────────────────────────────────────────────
var K_STUDY_PLAN     = 'kh_study_plan_v1';
var K_PERSONAL_QUEUE = 'kh_personal_queue_v1';
var K_SPEAKING_LOG   = 'kh_speaking_log_v1';
var K_QUICK_OUTPUT   = 'kh_quick_output_v1';

function khSafeReadJSON(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch(e) {
    return fallback;
  }
}

function khSafeWriteJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) {}
}

function getStudyPlan() {
  var base = {
    goalLevel: 'Intermediate',
    minutesPerDay: 20,
    daysPerWeek: 5,
    reminderTime: '20:00',
    focus: 'Balanced',
    targetExam: 'TOPIK I',
    startDate: new Date().toISOString().slice(0, 10)
  };
  var saved = khSafeReadJSON(K_STUDY_PLAN, {});
  return Object.assign({}, base, saved || {});
}

function saveStudyPlan(plan) {
  var next = Object.assign({}, getStudyPlan(), plan || {});
  khSafeWriteJSON(K_STUDY_PLAN, next);
  return next;
}

function getPersonalQueue() {
  var items = khSafeReadJSON(K_PERSONAL_QUEUE, []);
  return Array.isArray(items) ? items : [];
}

function savePersonalQueue(items) {
  khSafeWriteJSON(K_PERSONAL_QUEUE, Array.isArray(items) ? items : []);
}

function addPersonalQueueItem(item) {
  var list = getPersonalQueue();
  list.unshift({
    id: 'pq_' + Date.now(),
    title: item && item.title ? item.title : 'Untitled',
    source: item && item.source ? item.source : '',
    category: item && item.category ? item.category : 'Custom',
    note: item && item.note ? item.note : '',
    createdAt: new Date().toISOString(),
    done: false
  });
  savePersonalQueue(list.slice(0, 20));
  return getPersonalQueue();
}

function togglePersonalQueueItem(id) {
  var list = getPersonalQueue().map(function(item) {
    if (item.id === id) item.done = !item.done;
    return item;
  });
  savePersonalQueue(list);
  return list;
}

function removePersonalQueueItem(id) {
  var list = getPersonalQueue().filter(function(item){ return item.id !== id; });
  savePersonalQueue(list);
  return list;
}

function recordSpeakingSession(entry) {
  var log = khSafeReadJSON(K_SPEAKING_LOG, []);
  log.unshift({
    id: 'sp_' + Date.now(),
    prompt: entry && entry.prompt ? entry.prompt : '',
    transcript: entry && entry.transcript ? entry.transcript : '',
    score: Number(entry && entry.score ? entry.score : 0),
    durationSec: Number(entry && entry.durationSec ? entry.durationSec : 0),
    createdAt: new Date().toISOString()
  });
  khSafeWriteJSON(K_SPEAKING_LOG, log.slice(0, 60));
}

function getSpeakingStats(days) {
  var limitDays = Number(days || 7);
  var since = Date.now() - (limitDays * 86400000);
  var list = khSafeReadJSON(K_SPEAKING_LOG, []).filter(function(item){
    return item && item.createdAt && new Date(item.createdAt).getTime() >= since;
  });
  var totalSec = list.reduce(function(sum, item){ return sum + Number(item.durationSec || 0); }, 0);
  var totalScore = list.reduce(function(sum, item){ return sum + Number(item.score || 0); }, 0);
  return {
    sessions: list.length,
    minutes: Math.round(totalSec / 60),
    avgScore: list.length ? Math.round(totalScore / list.length) : 0,
    lastPrompt: list[0] ? list[0].prompt : '',
    lastAt: list[0] ? list[0].createdAt : null
  };
}

function recordQuickOutput(entry) {
  var log = khSafeReadJSON(K_QUICK_OUTPUT, []);
  log.unshift({
    id: 'qo_' + Date.now(),
    text: entry && entry.text ? entry.text : '',
    topic: entry && entry.topic ? entry.topic : '',
    createdAt: new Date().toISOString()
  });
  khSafeWriteJSON(K_QUICK_OUTPUT, log.slice(0, 60));
}

function getQuickOutputStats(days) {
  var limitDays = Number(days || 7);
  var since = Date.now() - (limitDays * 86400000);
  var list = khSafeReadJSON(K_QUICK_OUTPUT, []).filter(function(item){
    return item && item.createdAt && new Date(item.createdAt).getTime() >= since;
  });
  return {
    count: list.length,
    lastText: list[0] ? list[0].text : '',
    lastTopic: list[0] ? list[0].topic : '',
    lastAt: list[0] ? list[0].createdAt : null
  };
}

window.getStudyPlan = getStudyPlan;
window.saveStudyPlan = saveStudyPlan;
window.getPersonalQueue = getPersonalQueue;
window.addPersonalQueueItem = addPersonalQueueItem;
window.togglePersonalQueueItem = togglePersonalQueueItem;
window.removePersonalQueueItem = removePersonalQueueItem;
window.recordSpeakingSession = recordSpeakingSession;
window.getSpeakingStats = getSpeakingStats;
window.recordQuickOutput = recordQuickOutput;
window.getQuickOutputStats = getQuickOutputStats;

function runMobileRedesign() {
  markMobileBody();
  if (!isMobileRedesign()) return;
  injectMobileBottomNav();
  enhanceHomeMobile();
  enhanceCollectionPagesMobile();
