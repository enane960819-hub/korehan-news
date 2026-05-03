/* ============================================================
   KoreHani — Mobile sidebar (navigation drawer)
   Extracted from korehan-shared.js (was lines 8304-8464).

   The slide-in drawer hidden behind the hamburger button on
   mobile. Injects its own CSS, builds the nav DOM, and exposes
   open / close / toggle helpers used by inline-onclick handlers.

   External deps (resolved at runtime via global scope):
   - khIcon, renderKhLucideIcons   — from korehan-shared.js
   - supaUser                      — from korehan-shared.js
   - openAuthModal                 — from korehan-shared.js
   ============================================================ */

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
    '.kh-sb-ico{font-size:15px;width:20px;text-align:center;flex-shrink:0;display:flex;align-items:center;justify-content:center;}',
    '.kh-sb-ico .kh-ui-icon{width:16px;height:16px;stroke:currentColor;stroke-width:2;}',
    '.kh-sb-sub-a .kh-ui-icon{width:14px;height:14px;stroke:currentColor;stroke-width:2;vertical-align:-2px;margin-right:2px;}',
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
      + '<div class="kh-sb-brand"><span class="kh-logo-text" style="font-size:28px">KoreHan<span class="kh-logo-i">ı</span></span></div>'
      + '<button class="kh-sb-x" onclick="khSbClose()">&#x2715;</button>'
    + '</div>'
    + '<div class="kh-sb-sec">'
      + '<div class="kh-sb-lbl">Navigation</div>'
      + '<a href="index.html" class="kh-sb-a' + (page==='index.html'?' on':'') + '"><span class="kh-sb-ico">' + khIcon('home') + '</span>Home</a>'
    + '</div>'
    + '<div class="kh-sb-sec">'
      + '<div class="kh-sb-lbl">Read</div>'
      + '<button class="kh-sb-a" onclick=\"khSbToggle(\'sb-news\',\'sb-arr-news\')\"><span class="kh-sb-ico">' + khIcon('newspaper') + '</span>News<span class="kh-sb-arrow" id="sb-arr-news">&#x203A;</span></button>'
      + '<div class="kh-sb-sub" id="sb-news">'
        + '<a href="korehan-all.html" class="kh-sb-sub-a">All News</a>'
        + '<a href="korehan-society.html" class="kh-sb-sub-a">' + khIcon('landmark') + ' Society</a>'
        + '<a href="korehan-world.html" class="kh-sb-sub-a">' + khIcon('globe') + ' World</a>'
        + '<a href="korehan-culture.html" class="kh-sb-sub-a">' + khIcon('palette') + ' Culture</a>'
        + '<a href="korehan-section.html?s=kpop" class="kh-sb-sub-a">' + khIcon('music') + ' K-pop</a>'
        + '<a href="korehan-section.html?s=beauty" class="kh-sb-sub-a">' + khIcon('sparkles') + ' Beauty</a>'
        + '<a href="korehan-section.html?s=travel" class="kh-sb-sub-a">' + khIcon('plane') + ' Travel</a>'
        + '<a href="korehan-korea.html" class="kh-sb-sub-a">' + khIcon('flag') + ' Korea</a>'
      + '</div>'
      + '<button class="kh-sb-a" onclick=\"khSbToggle(\'sb-conv\',\'sb-arr-conv\')\"><span class="kh-sb-ico">' + khIcon('messages-square') + '</span>Conversations<span class="kh-sb-new">New</span><span class="kh-sb-arrow" id="sb-arr-conv" style="margin-left:4px">&#x203A;</span></button>'
      + '<div class="kh-sb-sub" id="sb-conv">'
        + '<a href="korehan-conversations.html" class="kh-sb-sub-a">All</a>'
        + '<a href="korehan-conversations.html?cat=everyday" class="kh-sb-sub-a">Everyday</a>'
        + '<a href="korehan-conversations.html?cat=work" class="kh-sb-sub-a">Workplace</a>'
        + '<a href="korehan-conversations.html?cat=friends" class="kh-sb-sub-a">Friends</a>'
        + '<a href="korehan-conversations.html?cat=dating" class="kh-sb-sub-a">Dating</a>'
      + '</div>'
      + '<button class="kh-sb-a" onclick=\"khSbToggle(\'sb-stor\',\'sb-arr-stor\')\"><span class="kh-sb-ico">' + khIcon('book-open') + '</span>Stories<span class="kh-sb-new">New</span><span class="kh-sb-arrow" id="sb-arr-stor" style="margin-left:4px">&#x203A;</span></button>'
      + '<div class="kh-sb-sub" id="sb-stor">'
        + '<a href="korehan-stories.html" class="kh-sb-sub-a">All</a>'
        + '<a href="korehan-stories.html?mood=fun" class="kh-sb-sub-a">' + khIcon('smile') + ' Fun</a>'
        + '<a href="korehan-stories.html?mood=touching" class="kh-sb-sub-a">' + khIcon('heart') + ' Touching</a>'
        + '<a href="korehan-stories.html?mood=scary" class="kh-sb-sub-a">' + khIcon('ghost') + ' Scary</a>'
        + '<a href="korehan-stories.html?mood=shocking" class="kh-sb-sub-a">' + khIcon('zap') + ' Shocking</a>'
      + '</div>'
    + '</div>'
    + '<div class="kh-sb-sec">'
      + '<div class="kh-sb-lbl">Learn</div>'
      + '<a href="korehan-study-room.html" class="kh-sb-a' + (page==='korehan-study-room.html'?' on':'') + '"><span class="kh-sb-ico">' + khIcon('notebook-pen') + '</span>Study Room</a>'
      + '<a href="korehan-courses.html" class="kh-sb-a' + (page==='korehan-courses.html'?' on':'') + '"><span class="kh-sb-ico">' + khIcon('graduation-cap') + '</span>Courses</a>'
      + '<a href="korehan-shop.html" class="kh-sb-a' + (page==='korehan-shop.html'?' on':'') + '"><span class="kh-sb-ico">' + khIcon('shopping-cart') + '</span>Shop</a>'
      + '<a href="korehan-fun.html" class="kh-sb-a' + (page==='korehan-fun.html'?' on':'') + '"><span class="kh-sb-ico">' + khIcon('gamepad-2') + '</span>Playground</a>'
      + '<a href="korehan-learning-overview.html" class="kh-sb-a' + (page==='korehan-learning-overview.html'?' on':'') + '"><span class="kh-sb-ico">' + khIcon('bar-chart-3') + '</span>Growth Lab</a>'
    + '</div>'
    + '<div class="kh-sb-sec" id="kh-sb-auth-sec" style="margin-top:auto;padding-top:12px;border-top:1px solid rgba(255,255,255,.08);position:sticky;bottom:0;background:#0b1626;box-shadow:0 -10px 24px rgba(0,0,0,.18)">'
      + '<div id="kh-sb-auth-row"></div>'
    + '</div>';
  document.body.appendChild(sb);
  updateSidebarAuth();
  renderKhLucideIcons();
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
      + '<a href="korehan-notes.html" class="kh-sb-a" onclick="khSbClose()">'
      + '<span class="kh-sb-ico">&#x1F4D1;</span>My Notes</a>'
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

