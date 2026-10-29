/* ============================================================
   KoreHani — Character Reporter Profiles
   Extracted from korehan-shared.js (was lines 2707-2838).

   reporter_id on an article maps to an entry here. Reporters are
   loaded once per session from the `reporters_data` Supabase
   table (with localStorage fallback for offline) and then
   re-rendered into any reporter slot DOM nodes after data
   arrives.

   External deps (resolved at runtime via global scope):
   - getSupa()         — from korehan-shared.js
   - lsGet, lsSet      — from js/core/storage.js
   ============================================================ */

// ── Character Reporter Profiles ───────────────────────────────
// reporter_id on article maps to an entry here.
// Random stock photos (picsum) were saved for some reporters — show the
// initials fallback instead of an unrelated face.
function _khReporterImg(url) {
  url = String(url || '');
  return /picsum\.photos/.test(url) ? '' : url;
}

var KH_REPORTERS = {};           // id → { name, img, href, role, color }
var _KH_REPORTERS_PROMISE = null;
var _KH_REPORTERS_LS_KEY  = 'kh_reporters_cache';

// Default reporter data (matches DEF_CHAR_REPORTERS in admin).
// Always available — no Supabase needed for basic display.
// Reporter titles are stored in Korean (admin enters 기자, 특파원 …);
// learners see English.
var KH_REPORTER_ROLE_EN = {
  '기자':'Reporter', '특파원':'Correspondent', '에디터':'Editor', '편집장':'Editor-in-Chief',
  '전문기자':'Senior Reporter', '앵커':'Anchor', '칼럼니스트':'Columnist', '논설위원':'Editorial Writer',
  '뷰티·트래블 에디터':'Beauty & Travel Editor', '사회·환경 전문기자':'Society & Environment Reporter',
  '국제·외교 기자':'World & Diplomacy Reporter', '문화·라이프 기자':'Culture & Lifestyle Reporter'
};
function khReporterRole(role) {
  role = String(role || '').trim();
  if (!role || !/[\uAC00-\uD7A3]/.test(role)) return role;
  if (KH_REPORTER_ROLE_EN[role]) return KH_REPORTER_ROLE_EN[role];
  var m = role.match(/(특파원|에디터|전문기자|기자|앵커|칼럼니스트)$/);
  return m ? KH_REPORTER_ROLE_EN[m[1]] : 'Reporter';
}
window.khReporterRole = khReporterRole;

// Romanized reporter name for learners ("박서진" → "Park Seo-jin"). Display
// only: the customary spelling for the family name, rule-based RR
// (khRomanize, korehan-shared.js) per syllable of the given name, hyphenated
// the way Korean names are usually written. '' for non-Hangul names
// or a first syllable that isn't a Korean family name.
var KH_SURNAME_EN = {
  '김':'Kim','이':'Lee','박':'Park','최':'Choi','정':'Jung','강':'Kang','조':'Cho','윤':'Yoon','장':'Jang','임':'Lim',
  '한':'Han','오':'Oh','서':'Seo','신':'Shin','권':'Kwon','황':'Hwang','안':'Ahn','송':'Song','류':'Ryu','유':'Yoo',
  '전':'Jeon','홍':'Hong','고':'Ko','문':'Moon','양':'Yang','손':'Son','배':'Bae','백':'Baek','허':'Heo','남':'Nam',
  '심':'Shim','노':'Noh','하':'Ha','곽':'Kwak','성':'Sung','차':'Cha','주':'Joo','우':'Woo','구':'Koo','민':'Min',
  '나':'Na','진':'Jin','지':'Ji','엄':'Eom','채':'Chae','원':'Won','천':'Cheon','방':'Bang','공':'Kong','현':'Hyun',
  '함':'Ham','변':'Byun','염':'Yeom','여':'Yeo','추':'Choo','도':'Do','소':'So','석':'Seok','선':'Sun','설':'Seol',
  '마':'Ma','길':'Gil','연':'Yeon','표':'Pyo','명':'Myung','기':'Ki','반':'Ban','왕':'Wang','금':'Keum','옥':'Ok',
  '인':'In','제':'Je','모':'Mo','탁':'Tak','국':'Kook','은':'Eun','용':'Yong','예':'Ye','경':'Kyung','봉':'Bong',
  '남궁':'Namgung','황보':'Hwangbo','제갈':'Jegal','선우':'Sunwoo','독고':'Dokgo'
};
function khNameRoman(name) {
  name = String(name || '').replace(/\s+/g, '');
  if (!/^[\uAC00-\uD7A3]{2,5}$/.test(name) || typeof khRomanize !== 'function') return '';
  var sur = (name.length >= 4 && KH_SURNAME_EN[name.slice(0, 2)]) ? name.slice(0, 2) : name.charAt(0);
  var given = name.slice(sur.length);
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  var surEn = KH_SURNAME_EN[sur];
  if (!surEn) return ''; // not a Korean family name (e.g. 앨리샤) — use data.name_en

  var givenEn = given.split('').map(function(ch) { return khRomanize(ch); }).join('-');
  return surEn + (givenEn ? ' ' + cap(givenEn) : '');
}
window.khNameRoman = khNameRoman;
// Reporter row → English name: hand-set data.name_en wins, else the romanization.
function khReporterNameEn(r) { return (r && (r.name_en || khNameRoman(r.name))) || ''; }
window.khReporterNameEn = khReporterNameEn;

var _KH_DEFAULT_REPORTERS_LIST = [
  { id:'cr1',  name:'박서진', role:'Reporter',         image:'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',  profilePage:'', color:'#2563eb' },
  { id:'cr2',  name:'김지원', role:'Correspondent',       image:'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',  profilePage:'', color:'#7c3aed' },
  { id:'cr4',  name:'최유나', role:'Reporter',         image:'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',  profilePage:'', color:'#db2777' },
  { id:'cr6',  name:'한소희', role:'Beauty & Travel Editor', image:'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',  profilePage:'', color:'#0891b2' },
  { id:'cr8',  name:'신지은', role:'Society & Environment Reporter', image:'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',  profilePage:'', color:'#16a34a' },
  { id:'cr9',  name:'강태양', role:'World & Diplomacy Reporter',      image:'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',  profilePage:'', color:'#4338ca' },
  { id:'cr10', name:'류하늘', role:'Culture & Lifestyle Reporter',    image:'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==', profilePage:'', color:'#c026d3' },
];

// Seed KH_REPORTERS from defaults immediately (synchronous, always works)
_KH_DEFAULT_REPORTERS_LIST.forEach(function(d) {
  KH_REPORTERS[d.id] = { name:d.name, img:d.image, href:d.profilePage||'korehan-reporters.html', role:d.role, color:d.color };
});

// Then override with localStorage cache if present
(function() {
  try {
    var c = JSON.parse(localStorage.getItem(_KH_REPORTERS_LS_KEY) || 'null');
    if (c && typeof c === 'object') {
      Object.keys(c).forEach(function(rid){ KH_REPORTERS[rid] = c[rid]; });
    }
  } catch(e) {}
})();

// Returns a Promise — resolves after KH_REPORTERS is fresh from Supabase.
// Safe to call multiple times; only one fetch ever happens per page load.
function _loadReportersIntoKHMap() {
  if (_KH_REPORTERS_PROMISE) return _KH_REPORTERS_PROMISE;
  _KH_REPORTERS_PROMISE = new Promise(function(resolve) {
    var sb = getSupa();
    if (!sb) { resolve(); return; }
    sb.from('character_reporters').select('id, data').then(function(res) {
      if (!res.error && res.data && res.data.length > 0) {
        var snap = {};
        res.data.forEach(function(row) {
          var d = row.data || {};
          var rid = d.id || row.id;
          if (!rid) return;
          snap[rid] = KH_REPORTERS[rid] = {
            name : d.name  || '',
            name_en: d.name_en || '',
            img  : _khReporterImg(d.image),
            href : d.profilePage || 'korehan-reporters.html',
            role : khReporterRole(d.role || ''),
            color: d.color || '#2563eb'
          };
        });
        try { localStorage.setItem(_KH_REPORTERS_LS_KEY, JSON.stringify(snap)); } catch(e) {}
        _reRenderReporterSlots();
      } else {
        // Supabase empty/missing — fall back to admin's localStorage key
        try {
          var adminList = JSON.parse(localStorage.getItem('korehan_char_reporters') || 'null');
          if (adminList && adminList.length) {
            var snap2 = {};
            adminList.forEach(function(d) {
              if (!d.id) return;
              snap2[d.id] = KH_REPORTERS[d.id] = { name:d.name||'', img:_khReporterImg(d.image), href:d.profilePage||'korehan-reporters.html', role:d.role||'', color:d.color||'#2563eb' };
            });
            try { localStorage.setItem(_KH_REPORTERS_LS_KEY, JSON.stringify(snap2)); } catch(e) {}
            _reRenderReporterSlots();
          }
        } catch(e2) {}
      }
      resolve();
    }).catch(function(){ resolve(); });
  });
  return _KH_REPORTERS_PROMISE;
}

// After KH_REPORTERS loads, patch any .art-reporter-link[data-rid] already in the DOM
function _reRenderReporterSlots() {
  document.querySelectorAll('.art-reporter-link[data-rid]').forEach(function(el) {
    var rid = el.getAttribute('data-rid');
    if (!rid) return;
    var rep = KH_REPORTERS[rid];
    if (!rep || !rep.name) return;
    var color = rep.color || '#2563eb';
    var avatarEl = el.querySelector('.art-reporter-avatar');
    var nameEl   = el.querySelector('.art-reporter-name');
    var roleEl   = el.querySelector('.art-reporter-role');
    el.href = rep.href || 'korehan-reporters.html';
    if (nameEl) nameEl.textContent = rep.name;
    if (avatarEl) {
      avatarEl.innerHTML = rep.img
        ? '<img src="' + rep.img + '" alt="' + rep.name + '" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\'">'
          + '<div class="art-reporter-avatar-placeholder" style="display:none;background:' + color + '">' + rep.name.charAt(0) + '</div>'
        : '<div class="art-reporter-avatar-placeholder" style="background:' + color + '">' + rep.name.charAt(0) + '</div>';
    }
    if (rep.role && !roleEl) {
      var rs = document.createElement('span');
      rs.className = 'art-reporter-role';
      rs.textContent = rep.role;
      el.appendChild(rs);
    } else if (rep.role && roleEl) {
      roleEl.textContent = rep.role;
    }
  });
}

// Kick off fetch early (non-blocking background prefetch)
document.addEventListener('DOMContentLoaded', function() { _loadReportersIntoKHMap(); });

function getReporterProfileHTML(article) {
  var rid = article.reporter_id || article.reporter || null;
  var rep = rid ? KH_REPORTERS[rid] : null;
  var name  = (rep && rep.name)  ? rep.name  : 'KoreHani Reporter';
  var img   = (rep && rep.img)   ? rep.img   : null;
  var href  = (rep && rep.href && rep.href !== 'korehan-reporters.html') ? rep.href : (rid ? 'korehan-reporter.html?id=' + rid : 'korehan-reporters.html');
  var color = (rep && rep.color) ? rep.color : '#2563eb';
  var avatar = img
    ? '<img src="' + img + '" alt="' + name + '" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\'">'
      + '<div class="art-reporter-avatar-placeholder" style="display:none;background:' + color + '">' + name.charAt(0) + '</div>'
    : '<div class="art-reporter-avatar-placeholder" style="background:' + color + '">' + name.charAt(0) + '</div>';
  // data-rid lets _reRenderReporterSlots() update this element once KH_REPORTERS loads
  return '<a href="' + href + '" class="art-reporter-link"' + (rid ? ' data-rid="' + rid + '"' : '') + '>'
    + '<div class="art-reporter-avatar">' + avatar + '</div>'
    + '<span class="art-reporter-name">' + name + '</span>'
    + '</a>';
}

