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
var KH_REPORTERS = {};           // id → { name, img, href, role, color }
var _KH_REPORTERS_PROMISE = null;
var _KH_REPORTERS_LS_KEY  = 'kh_reporters_cache';

// Default reporter data (matches DEF_CHAR_REPORTERS in admin).
// Always available — no Supabase needed for basic display.
var _KH_DEFAULT_REPORTERS_LIST = [
  { id:'cr1',  name:'박서진', role:'기자',         image:'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',  profilePage:'', color:'#2563eb' },
  { id:'cr2',  name:'김지원', role:'특파원',       image:'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',  profilePage:'', color:'#7c3aed' },
  { id:'cr4',  name:'최유나', role:'기자',         image:'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',  profilePage:'', color:'#db2777' },
  { id:'cr6',  name:'한소희', role:'뷰티·트래블 에디터', image:'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',  profilePage:'', color:'#0891b2' },
  { id:'cr8',  name:'신지은', role:'사회·환경 전문기자', image:'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',  profilePage:'', color:'#16a34a' },
  { id:'cr9',  name:'강태양', role:'국제·외교 기자',      image:'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',  profilePage:'', color:'#4338ca' },
  { id:'cr10', name:'류하늘', role:'문화·라이프 기자',    image:'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==', profilePage:'', color:'#c026d3' },
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
            img  : d.image || '',
            href : d.profilePage || 'korehan-reporters.html',
            role : d.role  || '',
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
              snap2[d.id] = KH_REPORTERS[d.id] = { name:d.name||'', img:d.image||'', href:d.profilePage||'korehan-reporters.html', role:d.role||'', color:d.color||'#2563eb' };
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

