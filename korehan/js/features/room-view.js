/* ============================================================
   KoreHani — read-only room view (2026-10-29)

   Draws a learner's My Room (layout + owned + theme) into a box, with
   the same placement math as My Room (korehan-mypage.html
   renderRoomItems): positions are in a 400×360 base, an item's box is
   base_size/400 of the width, `scale` is 70–170 %, `flipped` mirrors it.
   No editing, no shop, no taps. Used by the public profile
   (get_public_room). My Room uses WALLPAPERS / FLOORS from here too.

   khRoomView.render(host, { layout, owned, theme, roomTheme, avatar, emptyText }) → Promise
     host: an empty element; it gets class kh-rv (10:9 box).
     roomTheme / avatar (optional): theme picture and character from
     get_public_room prefs (drawn by avatar-art.js when it's loaded);
     emptyText false = no "nothing placed" overlay.
   ============================================================ */
(function () {
  var DEFAULT_WALL = 'url(assets/file_00000000969472069e4cadf53dffb54b.png) center/cover no-repeat';
  var WALLPAPERS = [
    { id: 'default', name: 'Default', bg: DEFAULT_WALL },
    { id: 'hanji',   name: 'Hanji',   bg: 'linear-gradient(180deg,#f5e8d0 0%,#e6d2a4 70%,#d8be8a 100%)' },
    { id: 'modern',  name: 'Modern',  bg: 'linear-gradient(180deg,#f8fafc 0%,#dbe2eb 100%)' },
    { id: 'brick',   name: 'Brick',   bg: 'repeating-linear-gradient(0deg,#9b6a4a 0 30px,#7a5236 30px 33px),repeating-linear-gradient(90deg,transparent 0 60px,#7a5236 60px 63px)' },
    { id: 'starry',  name: 'Starry',  bg: 'radial-gradient(circle at 18% 24%,#fff 0 1.4px,transparent 1.8px),radial-gradient(circle at 72% 18%,#fff 0 1.2px,transparent 1.6px),radial-gradient(circle at 38% 78%,#fff 0 1.1px,transparent 1.4px),radial-gradient(circle at 88% 62%,#fff 0 1.4px,transparent 1.8px),linear-gradient(180deg,#0c1633,#1a2654)' },
    { id: 'sunset',  name: 'Sunset',  bg: 'linear-gradient(180deg,#fb923c 0%,#ec4899 55%,#7c3aed 100%)' },
    { id: 'forest',  name: 'Forest',  bg: 'linear-gradient(180deg,#16a34a 0%,#065f46 100%)' },
    { id: 'pastel',  name: 'Pastel',  bg: 'linear-gradient(135deg,#fbcfe8 0%,#e0e7ff 50%,#bae6fd 100%)' },
    { id: 'neon',    name: 'Neon',    bg: 'radial-gradient(ellipse at 28% 20%,rgba(125,211,252,.45) 0%,transparent 55%),radial-gradient(ellipse at 70% 80%,rgba(244,114,182,.45) 0%,transparent 55%),#0c1633' }
  ];
  var FLOORS = [
    { id: 'none',   name: 'None',   bg: 'transparent' },
    { id: 'wood',   name: 'Wood',   bg: 'repeating-linear-gradient(90deg,#a16842 0 60px,#8b5a36 60px 62px,#a16842 62px 122px,#8b5a36 122px 124px),linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.18) 100%)' },
    { id: 'carpet', name: 'Carpet', bg: 'radial-gradient(circle at 50% 70%,#dc2626 0%,#991b1b 55%,#7f1d1d 100%)' },
    { id: 'hanji',  name: 'Hanji',  bg: 'linear-gradient(180deg,#e6cfa3,#c9a874)' },
    { id: 'marble', name: 'Marble', bg: 'linear-gradient(135deg,#f1f5f9 0%,#cbd5e1 60%,#94a3b8 100%)' },
    { id: 'tile',   name: 'Tile',   bg: 'repeating-linear-gradient(0deg,#e2e8f0 0 30px,#cbd5e1 30px 32px),repeating-linear-gradient(90deg,#e2e8f0 0 30px,#cbd5e1 30px 32px)' }
  ];

  function pick(list, id) { return list.filter(function (x) { return x.id === id; })[0] || list[0]; }

  // Catalog: room_items (public read). Same size rule as My Room.
  var _itemsP = null;
  function loadItems() {
    if (_itemsP) return _itemsP;
    var sb = (typeof getSupa === 'function') ? getSupa() : null;
    if (!sb) return Promise.resolve({});
    _itemsP = sb.from('room_items').select('id, name, image_url, base_size, price_nyang, effect, category').eq('active', true)
      .then(function (r) {
        var map = {};
        ((r && r.data) || []).forEach(function (it) {
          var sz = it.base_size || 60;
          if (sz < 100) sz = sz * 2;
          map[it.id] = { id: it.id, name: it.name, img: (typeof khRoomImg === 'function' ? khRoomImg(it.image_url) : it.image_url), size: sz, price: Number(it.price_nyang) || 0, effect: it.effect || 'none', category: it.category || 'deco' };
        });
        return map;
      }, function () { _itemsP = null; return {}; });
    return _itemsP;
  }

  // Art not uploaded yet → the item isn't drawn (same as My Room).
  var _probe = {};
  function imgOk(url) {
    if (!url) return Promise.resolve(false);
    if (_probe[url]) return _probe[url];
    _probe[url] = new Promise(function (resolve) {
      var im = new Image(), done = false;
      var fin = function (ok) { if (!done) { done = true; resolve(ok); } };
      im.onload = function () { fin(im.naturalWidth > 0); };
      im.onerror = function () { fin(false); };
      setTimeout(function () { fin(true); }, 5000);
      im.src = url;
    });
    return _probe[url];
  }

  function ensureStyle() {
    if (document.getElementById('kh-rv-style')) return;
    var st = document.createElement('style');
    st.id = 'kh-rv-style';
    st.textContent =
      '.kh-rv{position:relative;width:100%;aspect-ratio:10/9;border-radius:12px;overflow:hidden;background:' + DEFAULT_WALL + ';user-select:none;-webkit-user-select:none}'
      + '.kh-rv-floor{position:absolute;left:0;right:0;bottom:0;height:32%;pointer-events:none;z-index:0}'
      + '.kh-rv-item{position:absolute;z-index:1;pointer-events:none}'
      + '.kh-rv-sprite{position:absolute;inset:0;background-repeat:no-repeat;background-position:center;background-size:contain;transform-origin:center center}'
      + '.kh-rv-item[data-effect="glow_warm"] .kh-rv-sprite{filter:drop-shadow(0 0 8px rgba(255,180,50,.35))}'
      + '.kh-rv-item[data-effect="glow_neon"] .kh-rv-sprite{filter:drop-shadow(0 0 6px rgba(0,200,255,.4))}'
      + '.kh-rv-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px;color:#fff;font-size:13px;font-weight:700;background:rgba(2,6,23,.35);z-index:3}';
    document.head.appendChild(st);
  }

  async function render(host, room) {
    if (!host) return;
    ensureStyle();
    room = room || {};
    var theme = (room.theme && typeof room.theme === 'object') ? room.theme : {};
    var wp = pick(WALLPAPERS, theme.wallpaper || 'default');
    var fl = pick(FLOORS, theme.floor || 'none');
    host.classList.add('kh-rv');
    host.style.background = wp.bg;
    host.innerHTML = '<div class="kh-rv-floor"></div>';
    host.firstChild.style.background = fl.bg;
    host.firstChild.style.opacity = fl.id === 'none' ? '0' : '1';
    // Room theme picture + the learner's character (js/features/avatar-art.js).
    if (window.khAvatar && room.roomTheme) khAvatar.applyThemeBg(host, room.roomTheme, host.firstChild);

    var items = await loadItems();
    if (window.khAvatar && room.avatar) items = await khAvatar.withRoomItem(items, room.avatar);
    var owned = Array.isArray(room.owned) ? room.owned : [];
    var layout = (Array.isArray(room.layout) ? room.layout : []).filter(function (p) {
      var d = p && items[p.id];
      return d && (owned.indexOf(p.id) !== -1 || d.price === 0);
    }).slice(0, 60);
    var ok = await Promise.all(layout.map(function (p) { return imgOk(items[p.id].img); }));
    layout = layout.filter(function (p, i) { return ok[i]; });

    if (!layout.length) {
      if (room.emptyText === false) return;
      var em = document.createElement('div');
      em.className = 'kh-rv-empty';
      em.textContent = room.emptyText || 'Nothing placed in this room yet.';
      host.appendChild(em);
      return;
    }
    layout.forEach(function (p) {
      var d = items[p.id];
      var x = Number(p.x) || 0, y = Number(p.y) || 0;
      var scale = Math.max(70, Math.min(170, Number(p.scale || 100))) / 100;
      var sizePct = (d.size || 100) / 400 * 100;
      var div = document.createElement('div');
      div.className = 'kh-rv-item';
      if (d.effect && d.effect !== 'none') div.dataset.effect = d.effect;
      div.style.left = (x / 400 * 100) + '%';
      div.style.top = (y / 360 * 100) + '%';
      div.style.width = sizePct + '%';
      div.style.height = sizePct + '%';
      div.title = d.name || '';
      var sp = document.createElement('div');
      sp.className = 'kh-rv-sprite';
      sp.style.backgroundImage = 'url("' + String(d.img).replace(/"/g, '%22') + '")';
      sp.style.transform = 'scale(' + ((p.flipped ? -1 : 1) * scale) + ',' + scale + ')';
      div.appendChild(sp);
      host.appendChild(div);
    });
  }

  window.khRoomView = { WALLPAPERS: WALLPAPERS, FLOORS: FLOORS, loadItems: loadItems, render: render };
})();
