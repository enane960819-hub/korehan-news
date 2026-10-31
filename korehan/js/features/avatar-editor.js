/* ============================================================
   KoreHani — My Room → Customize: character editor + room themes
   (owner-approved mockup 2026-10-30; no placed-on hats — owner rule)

   Left: live room preview with the character, "Use as profile picture"
   toggle and Save. Right: tabs Look (hair + outfits), Accessories, Room
   (theme pictures). Everything can be tried on; locked items show a price,
   a study goal or their sale season, and only Save asks to buy them.
   Purchases go through buy_room_item (server checks price, unlock-only and
   season); study unlocks come from kh_claim_room_unlocks. The browser only
   writes prefs + layout (khAvatar.save → My Page's _syncRoomToServer).

   Lives on korehan-mypage.html and uses its room helpers (getRoomLayout,
   setRoomLayout, getRoomOwned, setRoomOwned, _syncRoomToServer,
   renderRoomItems, _applyRoomTheme, _getRoomTheme, _userCoin,
   _setNyangBalance, ROOM_ITEMS). Catalogue + drawing: avatar-art.js.

   khAvatarEditor.open()
   ============================================================ */
(function () {
  var A = function () { return window.khAvatar; };
  var E = null;   // open editor state

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ic(n, cls) { return '<i data-lucide="' + n + '" class="kav-i' + (cls ? ' ' + cls : '') + '" aria-hidden="true"></i>'; }
  function icons() { if (typeof renderKhLucideIcons === 'function') { try { renderKhLucideIcons(); } catch (_) {} } }
  function user() { return (typeof supaUser !== 'undefined' && supaUser) ? supaUser : null; }
  function coin() { return (typeof khNyangUnlimited === 'function' && khNyangUnlimited()) ? Infinity : (typeof _userCoin !== 'undefined') ? Number(_userCoin) || 0 : 0; }
  function nf(n) { return Number(n || 0).toLocaleString(); }
  function say(msg) { if (typeof toast === 'function') toast(msg); }
  var GOAL_IC = { streak_days: 'flame', saved_words: 'library', topik_tests: 'award', articles_read: 'newspaper', games_played: 'gamepad-2' };

  // ── Ownership / lock state ─────────────────────────────────────────
  function owns(kind, it) {
    if (!it) return false;
    if (A().isFree(it)) return true;
    return E.owned.indexOf(A().serverId(kind, it.id)) !== -1;
  }
  // Why an item is locked: null (wearable), {type:'buy', price}, {type:'goal'}, {type:'season'}, {type:'cash'} (Special shop).
  // Admin = unlimited nyang (owner, 2026-10-31): anything not owned is a free buy;
  // buy_room_item gives it to the admin at 0. Badges still show the real price / goal.
  function unlimited() { return typeof khNyangUnlimited === 'function' && khNyangUnlimited(); }
  function lockOf(kind, it) {
    var l = realLock(kind, it);
    return l && unlimited() ? { type: 'buy', price: 0 } : l;
  }
  function realLock(kind, it) {
    if (!it || owns(kind, it)) return null;
    if (it.goal) return { type: 'goal' };
    if (it.cash) return { type: 'cash' };
    if (!A().inSeason(it)) return { type: 'season' };
    return { type: 'buy', price: Number(it.price) || 0 };
  }
  function goalText(it) {
    var g = it.goal || {}, cur = Math.min(Number((E.progress || {})[g.key]) || 0, g.target || 1);
    return (g.label || 'Study goal') + ' (' + cur + ' / ' + (g.target || 1) + ')';
  }
  function seasonText(it) { return 'On sale in ' + (it.season || 'season') + ' only'; }
  // Worn pieces that aren't owned yet. Hidden accessories (outfit has its own
  // headwear) don't count; they're simply not saved unless owned.
  function lockedWorn() {
    var out = [], av = E.av;
    var o = A().find('outfit', av.outfit);
    if (lockOf('outfit', o)) out.push({ kind: 'outfit', it: o, lock: lockOf('outfit', o) });
    A().visibleAcc(av).forEach(function (id) {
      var a = A().find('acc', id);
      if (lockOf('acc', a)) out.push({ kind: 'acc', it: a, lock: lockOf('acc', a) });
    });
    var r = A().find('room', E.theme);
    if (lockOf('room', r)) out.push({ kind: 'room', it: r, lock: lockOf('room', r) });
    return out;
  }
  function buyTotal(list) { return list.reduce(function (s, x) { return s + (x.lock.type === 'buy' ? x.lock.price : 0); }, 0); }

  // ── Badges on tiles ────────────────────────────────────────────────
  function badge(kind, it, selected) {
    var lock = realLock(kind, it);
    if (!lock) {
      if (A().isFree(it)) return '';
      return '<span class="kav-b kav-b-own">' + ic('check') + 'Owned</span>';
    }
    if (selected) return '<span class="kav-b kav-b-try">Trying on</span>';
    if (lock.type === 'goal') return '<span class="kav-b kav-b-goal">' + ic(GOAL_IC[it.goal.key] || 'gift') + esc(it.goal.short || 'Unlock') + '</span>';
    if (lock.type === 'season') return '<span class="kav-b kav-b-season">' + ic('calendar') + esc(it.season || 'Seasonal') + '</span>';
    if (lock.type === 'cash') return '<span class="kav-b kav-b-season">' + ic('sparkles') + 'Special</span>';
    return '<span class="kav-b kav-b-buy">' + ic('coins') + nf(lock.price) + '</span>';
  }
  function tileTitle(kind, it) {
    var lock = lockOf(kind, it);
    if (!lock) return it.name;
    if (lock.type === 'goal') return it.name + ' — earned by studying: ' + goalText(it);
    if (lock.type === 'season') return it.name + ' — ' + seasonText(it);
    if (lock.type === 'cash') return it.name + ' — in the Special shop';
    return it.name + ' — ' + nf(lock.price) + ' nyang';
  }

  // ── Panels ─────────────────────────────────────────────────────────
  var _hairFaces = {};
  // Skin tone picker (owner approved the cleaned masks, 2026-10-31).
  var SKIN_ON = true;
  function hairFace(h) {
    var skin = (SKIN_ON && E && E.av && E.av.skin) || 'light', key = h + '|' + skin;
    if (!_hairFaces[key]) _hairFaces[key] = A().faceUrl({ hair: h, outfit: 'tee', acc: [], skin: skin }, 120);
    return _hairFaces[key];
  }
  function lookHtml() {
    var av = E.av;
    var hair = A().HAIRS.map(function (h) {
      var on = av.hair === h.id;
      return '<button type="button" class="kav-t kav-hair' + (on ? ' on' : '') + '" data-act="hair" data-id="' + h.id + '" aria-pressed="' + on + '" aria-label="' + esc(h.name) + ' hair">'
        + '<img alt="" data-face="' + h.id + '"></button>';
    }).join('');
    // Every outfit at the same scale, feet on the tile floor (owner, 2026-10-31: sizes looked
    // different because each picture was shrunk to fit its tile).
    function figH(hair, id) {
      var m = A().SPRITE[A().spriteName(hair, id)];
      return m ? Math.min(100, m[1] / 4.1).toFixed(1) : 90;
    }
    var outfits = A().OUTFITS.map(function (o) {
      var on = av.outfit === o.id;
      return '<button type="button" class="kav-t kav-outfit' + (on ? ' on' : '') + (lockOf('outfit', o) ? ' locked' : '') + '" data-act="outfit" data-id="' + o.id + '" aria-pressed="' + on + '" title="' + esc(tileTitle('outfit', o)) + '">'
        + badge('outfit', o, on)
        + '<span class="kav-ofig"><img alt="" loading="lazy" src="' + esc(A().spriteUrl(av.hair, o.id)) + '" style="height:' + figH(av.hair, o.id) + '%"></span>'
        + '<span class="kav-n">' + esc(o.name) + '</span></button>';
    }).join('');
    var skins = Object.keys(A().SKINS).map(function (k, i) {
      var on = (av.skin || 'light') === k;
      return '<button type="button" class="kav-skin' + (on ? ' on' : '') + '" data-act="skin" data-id="' + k + '" aria-pressed="' + on + '" aria-label="Skin tone ' + (i + 1) + '" style="background:' + A().SKIN_SWATCH[k] + '"></button>';
    }).join('');
    return '<div class="kav-sec"><b>Hair</b><span>4 styles, all free</span></div><div class="kav-g kav-g4">' + hair + '</div>'
      + (SKIN_ON ? '<div class="kav-sec"><b>Skin</b><span>free</span></div><div class="kav-skins">' + skins + '</div>' : '')
      + '<div class="kav-sec"><b>Outfit</b><span>' + A().OUTFITS.length + ' looks · try any on</span></div><div class="kav-g kav-g5">' + outfits + '</div>';
  }
  var ACC_SECTIONS = [
    { slot: 'top', title: 'Head', sub: 'bands and bows' },
    { slot: 'pinr', title: 'Hair pin', sub: 'right side' },
    { slot: 'pinl', title: 'Hair clip', sub: 'left side' },
    { slot: 'face', title: 'Glasses', sub: '' }
  ];
  function accHtml() {
    var av = E.av, head = A().hidesHead(av), face = A().hidesFace(av);
    var note = '';
    if (head || face) {
      note = '<div class="kav-note">' + ic('info') + '<span>'
        + (head && face ? 'This outfit has its own headwear and glasses, so accessories are hidden with it.'
          : head ? 'This outfit has its own headwear, so head accessories and hair pins are hidden with it.'
            : 'This outfit has its own glasses, so glasses are hidden with it.')
        + '</span></div>';
    }
    return note + ACC_SECTIONS.map(function (sec) {
      var cur = null;
      av.acc.forEach(function (id) { var a = A().find('acc', id); if (a && a.slot === sec.slot) cur = id; });
      var dim = sec.slot === 'face' ? face : head;
      var tiles = '<button type="button" class="kav-t kav-acc' + (!cur ? ' on' : '') + '" data-act="acc-none" data-slot="' + sec.slot + '" aria-pressed="' + !cur + '">'
        + '<span class="kav-none">' + ic('ban') + '</span><span class="kav-n">None</span></button>'
        + A().ACCS.filter(function (a) { return a.slot === sec.slot; }).map(function (a) {
          var on = cur === a.id;
          return '<button type="button" class="kav-t kav-acc' + (on ? ' on' : '') + (lockOf('acc', a) ? ' locked' : '') + '" data-act="acc" data-id="' + a.id + '" aria-pressed="' + on + '" title="' + esc(tileTitle('acc', a)) + '">'
            + badge('acc', a, on)
            + '<img alt="" loading="lazy" src="' + esc(A().accUrl(a.id)) + '">'
            + '<span class="kav-n">' + esc(a.name) + '</span></button>';
        }).join('');
      return '<div class="kav-sec' + (dim ? ' dim' : '') + '"><b>' + esc(sec.title) + '</b>' + (sec.sub ? '<span>' + esc(sec.sub) + '</span>' : '') + '</div>'
        + '<div class="kav-g kav-g5' + (dim ? ' dim' : '') + '">' + tiles + '</div>';
    }).join('');
  }
  function classicBg() {
    var t = (typeof _getRoomTheme === 'function') ? (_getRoomTheme() || {}) : {};
    var rv = window.khRoomView;
    if (!rv) return '#e8dcc6';
    var wp = rv.WALLPAPERS.filter(function (w) { return w.id === (t.wallpaper || 'default'); })[0] || rv.WALLPAPERS[0];
    var fl = rv.FLOORS.filter(function (f) { return f.id === (t.floor || 'none'); })[0] || rv.FLOORS[0];
    return { wall: wp.bg, floor: fl.id === 'none' ? '' : fl.bg };
  }
  function roomHtml() {
    var tiles = A().ROOMS.map(function (r) {
      var on = E.theme === r.id;
      var bg;
      if (r.classic) {
        var c = classicBg();
        bg = '<span class="kav-rbg" style="background:' + esc(c.wall) + '"></span>' + (c.floor ? '<span class="kav-rfl" style="background:' + esc(c.floor) + '"></span>' : '');
      } else {
        bg = '<span class="kav-rbg" style="background-image:url(&quot;' + esc(A().themeUrl(r.id)) + '&quot;)"></span>';
      }
      return '<button type="button" class="kav-t kav-room' + (on ? ' on' : '') + (lockOf('room', r) ? ' locked' : '') + '" data-act="room" data-id="' + r.id + '" aria-pressed="' + on + '" title="' + esc(r.classic ? 'Classic — your wallpaper and floor' : tileTitle('room', r)) + '">'
        + bg + badge('room', r, on)
        + '<span class="kav-rn">' + esc(r.name) + (r.classic ? '<small>your wallpaper</small>' : '') + '</span></button>';
    }).join('');
    var rooms = A().visibleRooms ? A().visibleRooms() : [];
    var here = '<div class="kav-sec"><b>This room</b><span>name and background</span></div>'
      + '<input type="text" class="kav-rname" id="kav-rname" maxlength="40" aria-label="Room name" value="' + esc(E.roomName) + '">';
    var stand = rooms.length > 1
      ? '<div class="kav-sec"><b>Your character stands in</b></div><div class="kav-chips">' + rooms.map(function (r) {
          var on = r.id === E.avRoom;
          return '<button type="button" class="kav-chip' + (on ? ' on' : '') + '" data-act="avroom" data-id="' + esc(r.id) + '" aria-pressed="' + on + '">' + esc(r.name) + '</button>';
        }).join('') + '</div>'
      : '';
    return here + '<div class="kav-g kav-g3" style="margin-top:10px">' + tiles + '</div>' + stand;
  }
  function panelHtml() {
    return E.tab === 'acc' ? accHtml() : E.tab === 'room' ? roomHtml() : lookHtml();
  }

  // ── Rendering ──────────────────────────────────────────────────────
  function saveLabel() {
    var list = lockedWorn(), total = buyTotal(list);
    if (!list.length) return '<b>Save</b>';
    if (total > 0) return '<b>Save</b><small>' + nf(total) + ' nyang</small>';
    if (unlimited()) return '<b>Save</b><small>free (admin)</small>';
    return '<b>Save</b><small>locked items</small>';
  }
  function shell() {
    return '<div class="kav" role="dialog" aria-modal="true" aria-label="Customize your character and room">'
      + '<header class="kav-h">'
      +   '<button type="button" class="kav-back" data-act="close">' + ic('arrow-left') + '<span>My Room</span></button>'
      +   '<h2>Customize</h2>'
      +   '<button type="button" class="kav-reset-d" data-act="reset">' + ic('rotate-ccw') + 'Reset</button>'
      +   '<span class="kav-coin" id="kav-coin">' + ic('coins') + '<span>' + nf(coin()) + '</span></span>'
      + '</header>'
      + '<div class="kav-body">'
      +   '<div class="kav-left">'
      +     '<div class="kav-stick"><div class="kav-prev" id="kav-prev"><div class="kav-room-v" id="kav-room-v"></div><img class="kav-char" id="kav-char" alt="Your character"></div></div>'
      +     '<div class="kav-row">'
      +       '<label class="kav-prof"><img class="kav-pface" id="kav-pface" alt="">'
      +         '<span class="kav-pt"><b>Use as profile picture</b><small>Shown on your profile instead of your photo</small></span>'
      +         '<input type="checkbox" id="kav-ptog" class="kav-sw"' + (E.av.profile ? ' checked' : '') + '></label>'
      +       '<button type="button" class="kav-save kav-save-d" data-act="save" id="kav-save-d"></button>'
      +     '</div>'
      +   '</div>'
      +   '<div class="kav-right">'
      +     '<div class="kav-tabs" role="tablist">'
      +       '<button type="button" role="tab" data-tab="look">' + ic('shirt') + 'Look</button>'
      +       '<button type="button" role="tab" data-tab="acc">' + ic('sparkles') + 'Accessories</button>'
      +       '<button type="button" role="tab" data-tab="room">' + ic('house') + 'Room</button>'
      +     '</div>'
      +     '<div class="kav-panel" id="kav-panel"></div>'
      +   '</div>'
      + '</div>'
      + '<div class="kav-foot"><button type="button" class="kav-reset" data-act="reset">Reset</button>'
      +   '<button type="button" class="kav-save kav-save-m" data-act="save" id="kav-save-m"></button></div>'
      + '<div class="kav-dlg" id="kav-dlg" hidden></div>'
      + '</div>';
  }
  function renderPanel() {
    var p = document.getElementById('kav-panel');
    if (!p) return;
    p.innerHTML = panelHtml();
    E.root.querySelectorAll('.kav-tabs [data-tab]').forEach(function (b) {
      var on = b.dataset.tab === E.tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    p.querySelectorAll('img[data-face]').forEach(function (im) {
      hairFace(im.dataset.face).then(function (u) { if (u) im.src = u; });
    });
    icons();
  }
  function renderSave() {
    ['kav-save-d', 'kav-save-m'].forEach(function (id) {
      var b = document.getElementById(id);
      if (b) { b.innerHTML = saveLabel(); b.disabled = !!E.busy; }
    });
  }
  var _charSeq = 0;
  function renderChar() {
    var seq = ++_charSeq;
    var av = A().cleanAvatar(E.av);
    A().frameUrls(av).then(function (us) {
      if (seq !== _charSeq || !us || !us[0] || !E) return;
      var im = document.getElementById('kav-char');
      if (!im) return;
      im.src = us[0];
      if (us.length > 1 && typeof khRoomAnim === 'function') khRoomAnim(im, us, 1100);   // idol dance poses
      else if (typeof khRoomAnim === 'function') khRoomAnim(im, null);
    });
    A().faceUrl(av, 96).then(function (u) { var f = document.getElementById('kav-pface'); if (u && f && seq === _charSeq) f.src = u; });
  }
  function renderRoom() {
    var host = document.getElementById('kav-room-v');
    if (!host) return;
    var layout = ((typeof getRoomLayout === 'function') ? getRoomLayout() : []).filter(function (p) { return p && p.id !== A().AV_ID; });
    var owned = (typeof getRoomOwned === 'function') ? getRoomOwned() : [];
    var legacy = (typeof _getRoomTheme === 'function') ? _getRoomTheme() : {};
    host.className = 'kav-room-v';
    if (window.khRoomView) {
      khRoomView.render(host, { layout: layout, owned: owned, theme: legacy, roomTheme: E.theme, emptyText: false });
    }
  }
  function renderAll() { renderPanel(); renderSave(); renderChar(); renderRoom(); }

  // ── Actions ────────────────────────────────────────────────────────
  function setAcc(slot, id) {
    var next = E.av.acc.filter(function (x) { var a = A().find('acc', x); return a && a.slot !== slot; });
    if (id) next.push(id);
    E.av.acc = next;
  }
  function onClick(ev) {
    var t = ev.target.closest('[data-act],[data-tab]');
    if (!t || !E || !E.root.contains(t)) return;
    if (t.dataset.tab) { E.tab = t.dataset.tab; renderPanel(); return; }
    var act = t.dataset.act, id = t.dataset.id;
    if (act === 'close') return close();
    if (act === 'reset') { E.av = A().cleanAvatar(E.saved.av); E.theme = E.saved.theme; E.roomName = E.saved.roomName; E.avRoom = E.saved.avRoom; syncToggle(); renderAll(); return; }
    if (act === 'save') return save();
    if (act === 'hair') { E.av.hair = id; renderChar(); renderPanel(); renderSave(); return; }
    if (act === 'skin') { E.av.skin = id; renderChar(); renderPanel(); renderSave(); return; }
    if (act === 'outfit') { E.av.outfit = id; renderChar(); renderPanel(); renderSave(); return; }
    if (act === 'acc') {
      var a = A().find('acc', id);
      if (!a) return;
      setAcc(a.slot, E.av.acc.indexOf(id) !== -1 ? null : id);   // tap again = take off
      renderChar(); renderPanel(); renderSave(); return;
    }
    if (act === 'acc-none') { setAcc(t.dataset.slot, null); renderChar(); renderPanel(); renderSave(); return; }
    if (act === 'room') { E.theme = id; renderRoom(); renderPanel(); renderSave(); return; }
    if (act === 'avroom') { E.avRoom = id; renderPanel(); return; }
    if (act === 'dlg-cancel') return closeDlg();
    if (act === 'dlg-strip') return commit(true);
    if (act === 'dlg-buy') return commit(false);
  }
  function syncToggle() { var tg = document.getElementById('kav-ptog'); if (tg) tg.checked = !!E.av.profile; }

  // ── Save ───────────────────────────────────────────────────────────
  function closeDlg() { var d = document.getElementById('kav-dlg'); if (d) { d.hidden = true; d.innerHTML = ''; } }
  function save() {
    if (!E || E.busy) return;
    if (!user()) { say('Please sign in first'); return; }
    var list = lockedWorn();
    if (!list.length || unlimited()) return commit(false);
    var buy = list.filter(function (x) { return x.lock.type === 'buy'; });
    var cant = list.filter(function (x) { return x.lock.type !== 'buy'; });
    var total = buyTotal(list), short = Math.max(0, total - coin());
    var rows = list.map(function (x) {
      var right = x.lock.type === 'buy' ? ic('coins') + nf(x.lock.price)
        : x.lock.type === 'goal' ? '<em>' + esc(goalText(x.it)) + '</em>'
        : x.lock.type === 'cash' ? '<em><a href="korehan-shop.html?tab=special">In the Special shop</a></em>' : '<em>' + esc(seasonText(x.it)) + '</em>';
      return '<li><span>' + esc(x.it.name) + '</span><span class="kav-dr">' + right + '</span></li>';
    }).join('');
    var msg = cant.length
      ? (buy.length ? 'Some of these can\'t be bought right now and will be taken off.' : 'These can\'t be bought right now. Take them off to save the rest.')
      : 'You\'re trying on items you don\'t own yet.';
    var d = document.getElementById('kav-dlg');
    d.innerHTML = '<div class="kav-dbox" role="alertdialog" aria-label="Save your look">'
      + '<h3>' + (buy.length ? 'Buy and save?' : 'Locked items') + '</h3><p>' + esc(msg) + '</p><ul class="kav-dl">' + rows + '</ul>'
      + (buy.length ? '<div class="kav-dtot"><span>Total</span><b>' + ic('coins') + nf(total) + ' nyang</b></div>'
        + '<div class="kav-dbal">You have ' + nf(coin()) + ' nyang' + (short ? ' · need ' + nf(short) + ' more' : '') + '</div>' : '')
      + '<div class="kav-dacts">'
      +   '<button type="button" class="kav-dbtn" data-act="dlg-cancel">Keep trying</button>'
      +   '<button type="button" class="kav-dbtn" data-act="dlg-strip">Save without them</button>'
      +   (buy.length ? '<button type="button" class="kav-dbtn kav-dgo" data-act="dlg-buy"' + (short ? ' disabled' : '') + '>Buy &amp; save · ' + nf(total) + '</button>' : '')
      + '</div></div>';
    d.hidden = false;
    icons();
  }
  // Take every not-owned piece off (fall back to what was saved, else free defaults).
  function stripLocked() {
    var av = E.av;
    if (lockOf('outfit', A().find('outfit', av.outfit))) {
      av.outfit = (!lockOf('outfit', A().find('outfit', E.saved.av.outfit))) ? E.saved.av.outfit : 'tee';
    }
    av.acc = av.acc.filter(function (id) { return !lockOf('acc', A().find('acc', id)); });
    if (lockOf('room', A().find('room', E.theme))) {
      E.theme = (!lockOf('room', A().find('room', E.saved.theme))) ? E.saved.theme : 'classic';
    }
  }
  async function commit(strip) {
    if (!E || E.busy) return;
    var list = lockedWorn();
    E.busy = true; renderSave();
    try {
      if (strip) {
        stripLocked();
      } else if (list.length) {
        var cant = list.filter(function (x) { return x.lock.type !== 'buy'; });
        var buy = list.filter(function (x) { return x.lock.type === 'buy'; });
        var sb = (typeof getSupa === 'function') ? getSupa() : null;
        if (!sb) throw new Error('offline');
        for (var i = 0; i < buy.length; i++) {
          var x = buy[i], sid = A().serverId(x.kind, x.it.id);
          var r = await sb.rpc('buy_room_item', { p_item_id: sid });
          var body = (r && r.data) || {};
          if (r.error || !body.ok) {
            var why = body.error === 'INSUFFICIENT_NYANG' ? 'Not enough nyang for ' + x.it.name
              : body.error === 'UNLOCK_ONLY' ? x.it.name + ' is earned by studying'
                : body.error === 'OUT_OF_SEASON' ? x.it.name + ' isn\'t on sale right now'
                  : 'Couldn\'t buy ' + x.it.name + ' — try again later';
            if (typeof body.current === 'number' && typeof _setNyangBalance === 'function') _setNyangBalance(body.current);
            say(why);
            E.busy = false; closeDlg(); renderPanel(); renderSave(); refreshCoin();
            return;
          }
          if (E.owned.indexOf(sid) === -1) E.owned.push(sid);
          if (typeof getRoomOwned === 'function' && typeof setRoomOwned === 'function') {
            var o = getRoomOwned(); if (o.indexOf(sid) === -1) { o.push(sid); setRoomOwned(o); }
          }
          if (typeof body.nyang_balance === 'number' && typeof _setNyangBalance === 'function') _setNyangBalance(body.nyang_balance);
          refreshCoin();
        }
        if (cant.length) stripLocked();
      }
      // Hidden, not-owned accessories are dropped; everything left is owned or free.
      E.av.acc = E.av.acc.filter(function (id) { return !lockOf('acc', A().find('acc', id)); });
      await A().save(E.av, E.theme);
      var cur = A().currentRoom ? A().currentRoom() : null;
      if (cur && A().updateRoom) A().updateRoom(cur.id, E.roomName, null);
      // First save: the character steps into the room; then into the chosen room.
      if (typeof getRoomLayout === 'function' && typeof setRoomLayout === 'function') {
        var placedIn = A().avatarRoom ? A().avatarRoom() : null;
        if (!placedIn) {
          var lay = getRoomLayout();
          var pl = {}; Object.keys(A().AV_DEFAULT_PLACE).forEach(function (k) { pl[k] = A().AV_DEFAULT_PLACE[k]; });
          lay.push(pl);
          setRoomLayout(lay);
          placedIn = cur && cur.id;
        }
        if (E.avRoom && placedIn && E.avRoom !== placedIn && A().moveTo) A().moveTo(A().AV_ID, E.avRoom);
      }
      if (typeof ROOM_ITEMS !== 'undefined') A().ensureRoomItem(ROOM_ITEMS);
      if (typeof _syncRoomToServer === 'function') _syncRoomToServer();
      if (typeof _applyRoomTheme === 'function') _applyRoomTheme();
      if (typeof renderRoomItems === 'function') renderRoomItems();
      if (window.khRoomTabs) khRoomTabs.refresh();
      E.busy = false;
      close(true);
      say('Saved');
    } catch (e) {
      E.busy = false; renderSave();
      say('Not saved — check your connection.');
    }
  }
  function refreshCoin() { var c = document.getElementById('kav-coin'); if (c) { var s = c.querySelector('span'); if (s) s.textContent = nf(coin()); } }

  // ── Server state on open ───────────────────────────────────────────
  async function loadServer() {
    var sb = (typeof getSupa === 'function') ? getSupa() : null;
    var jobs = [A().loadCatalog()];
    if (sb && user()) {
      jobs.push(sb.rpc('kh_claim_room_unlocks').then(function (r) {
        var b = r && !r.error && r.data;
        if (!b || !b.ok) return;
        if (b.progress && typeof b.progress === 'object') E.progress = b.progress;
        if (Array.isArray(b.owned)) {
          E.owned = b.owned.slice();
          if (typeof setRoomOwned === 'function') setRoomOwned(b.owned);
        }
      }, function () {}));
    }
    await Promise.all(jobs);
    if (E) { renderPanel(); renderSave(); }
  }

  // ── Open / close ───────────────────────────────────────────────────
  function onKey(e) { if (e.key === 'Escape' && E) { var d = document.getElementById('kav-dlg'); if (d && !d.hidden) closeDlg(); else close(); } }
  function close() {
    if (!E) return;
    document.removeEventListener('keydown', onKey);
    E.root.remove();
    document.documentElement.classList.remove('kav-lock');
    E = null;
  }
  function open(tab) {
    if (!A()) return;
    if (!user()) { if (typeof openAuthModal === 'function') openAuthModal('login'); else say('Please sign in first'); return; }
    if (E) close();
    ensureStyle();
    var curRoom = A().currentRoom ? A().currentRoom() : { id: 'main', name: 'My Room' };
    var saved = { av: A().getAvatar() || A().cleanAvatar(A().DEFAULT_AVATAR), theme: A().getRoomTheme(),
      roomName: curRoom.name, avRoom: (A().avatarRoom && A().avatarRoom()) || curRoom.id };
    E = {
      saved: saved, av: A().cleanAvatar(saved.av), theme: saved.theme, roomName: saved.roomName, avRoom: saved.avRoom, tab: (tab === 'acc' || tab === 'room') ? tab : 'look',
      owned: (typeof getRoomOwned === 'function') ? getRoomOwned().slice() : [], progress: {}, busy: false, root: null
    };
    var root = document.createElement('div');
    root.className = 'kav-ov';
    root.innerHTML = shell();
    document.body.appendChild(root);
    E.root = root;
    document.documentElement.classList.add('kav-lock');
    root.addEventListener('click', onClick);
    root.querySelector('#kav-ptog').addEventListener('change', function (e) { E.av.profile = !!e.target.checked; });
    root.addEventListener('input', function (e) { if (e.target && e.target.id === 'kav-rname') E.roomName = e.target.value; });
    document.addEventListener('keydown', onKey);
    renderAll();
    loadServer();
    var back = root.querySelector('.kav-back');
    if (back) try { back.focus({ preventScroll: true }); } catch (_) {}
  }

  function ensureStyle() {
    if (document.getElementById('kav-style')) return;
    var st = document.createElement('style');
    st.id = 'kav-style';
    st.textContent = [
      'html.kav-lock,html.kav-lock body{overflow:hidden}',
      '.kav-ov{position:fixed;inset:0;z-index:9500;background:rgba(2,6,23,.72);display:flex;align-items:stretch;justify-content:center;font-family:inherit}',
      '.kav{position:relative;width:100%;max-width:1180px;margin:auto;background:#0b1426;color:#e2e8f0;border-radius:18px;display:flex;flex-direction:column;max-height:calc(100vh - 32px);overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.5)}',
      '.kav-i{width:16px;height:16px;flex:none}',
      '.kav-h{display:flex;align-items:center;gap:14px;padding:14px 20px;border-bottom:1px solid #1c2944}',
      '.kav-h h2{margin:0;font-size:17px;font-weight:800;color:#fff;flex:1}',
      '.kav-back{display:inline-flex;align-items:center;gap:6px;background:none;border:0;color:#94a3b8;font:inherit;font-size:13px;cursor:pointer;padding:6px 4px}',
      '.kav-back:hover{color:#fff}',
      '.kav-coin{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:#2a2410;border:1px solid #5b4a12;color:#fcd34d;font-weight:800;font-size:13px}',
      '.kav-reset-d{display:inline-flex;align-items:center;gap:6px;background:none;border:1px solid #24304d;color:#cbd5e1;border-radius:10px;padding:6px 12px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}',
      '.kav-reset-d:hover{border-color:#3b4a6b;color:#fff}',
      '.kav-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;padding:18px 20px 20px;overflow:auto;min-height:0}',
      '.kav-left{display:flex;flex-direction:column;gap:12px;min-width:0}',
      '.kav-prev{position:relative;width:100%;aspect-ratio:10/9;border-radius:14px;overflow:hidden;background:#1c2944}',
      '.kav-room-v{position:absolute!important;inset:0;width:100%!important;height:100%;border-radius:0!important;aspect-ratio:auto!important}',
      '.kav-char{position:absolute;left:50%;bottom:9%;height:44%;transform:translateX(-50%);pointer-events:none;filter:drop-shadow(0 6px 6px rgba(0,0,0,.25));z-index:4}',
      '.kav-row{display:flex;gap:10px;align-items:stretch}',
      '.kav-prof{flex:1;min-width:0;display:flex;align-items:center;gap:10px;background:#111c33;border:1px solid #1f2b47;border-radius:14px;padding:10px 12px;cursor:pointer}',
      '.kav-pface{width:40px;height:40px;border-radius:50%;background:#f8fafc;flex:none;object-fit:cover}',
      '.kav-pt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}',
      '.kav-pt b{font-size:13px;color:#fff}.kav-pt small{font-size:11px;color:#94a3b8}',
      '.kav-sw{appearance:none;-webkit-appearance:none;width:40px;height:24px;border-radius:999px;background:#334155;position:relative;cursor:pointer;flex:none;transition:background .15s;margin:0}',
      '.kav-sw::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .15s}',
      '.kav-sw:checked{background:#22c55e}.kav-sw:checked::after{transform:translateX(16px)}',
      '.kav-sw:focus-visible{outline:2px solid #fbbf24;outline-offset:2px}',
      '.kav-save{border:0;border-radius:14px;background:#fbbf24;color:#1a1300;font:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:8px 22px;min-width:110px}',
      '.kav-save b{font-size:15px;font-weight:800}.kav-save small{font-size:11px;font-weight:700}',
      '.kav-save:hover{background:#fcd34d}.kav-save:disabled{opacity:.6;cursor:wait}',
      '.kav-right{background:#0f1a30;border:1px solid #1c2944;border-radius:16px;padding:12px;min-width:0;display:flex;flex-direction:column;min-height:0}',
      '.kav-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:6px}',
      '.kav-tabs button{display:flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:10px;background:#16223b;color:#94a3b8;font:inherit;font-size:13px;font-weight:700;padding:10px 6px;cursor:pointer}',
      '.kav-tabs button.on{background:#2343c6;color:#fff}',
      '.kav-tabs button:hover:not(.on){color:#e2e8f0}',
      '.kav-panel{overflow:auto;padding:2px 2px 6px}',
      '.kav-sec{display:flex;align-items:baseline;gap:8px;margin:12px 2px 8px}',
      '.kav-sec b{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7dd3fc}.kav-sec span{font-size:11px;color:#64748b}',
      '.kav-sec.dim b{color:#64748b}',
      '.kav-g{display:grid;gap:8px}.kav-g4{grid-template-columns:repeat(4,1fr)}.kav-g5{grid-template-columns:repeat(5,1fr)}.kav-g3{grid-template-columns:repeat(3,1fr)}',
      '.kav-g.dim .kav-t{opacity:.45}',
      '.kav-t{position:relative;border:2px solid transparent;background:#16223b;border-radius:12px;cursor:pointer;font:inherit;color:#cbd5e1;padding:0;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;transition:border-color .15s,background .15s}',
      '.kav-t:hover{background:#1b2946}',
      '.kav-t.on{border-color:#fbbf24}',
      '.kav-t:focus-visible{outline:2px solid #7dd3fc;outline-offset:2px}',
      '.kav-skins{display:flex;gap:12px;padding:2px 2px 4px}',
      '.kav-skin{width:38px;height:38px;border-radius:50%;border:3px solid transparent;box-shadow:0 0 0 1px #2a3858 inset;cursor:pointer;padding:0}',
      '.kav-skin.on{border-color:#fbbf24}',
      '.kav-hair{aspect-ratio:1/1}.kav-hair img{width:100%;height:100%;object-fit:cover;display:block}',
      '.kav-outfit{aspect-ratio:3/4;padding:20px 4px 4px}.kav-ofig{position:relative;flex:1;width:100%;min-height:0;overflow:hidden}.kav-outfit img{position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:auto;max-width:none;display:block}',
      '.kav-acc{aspect-ratio:1/1.05;padding:20px 6px 4px}.kav-acc img{width:80%;height:calc(100% - 16px);object-fit:contain;display:block}',
      '.kav-t.locked img{opacity:.78}',
      '.kav-none{flex:1;display:flex;align-items:center;justify-content:center;color:#475569}.kav-none .kav-i{width:26px;height:26px}',
      '.kav-n{font-size:10.5px;font-weight:700;line-height:1.2;padding:2px 0 2px;color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}',
      '.kav-b{position:absolute;top:4px;left:4px;right:4px;display:flex;align-items:center;justify-content:center;gap:3px;border-radius:999px;font-size:9.5px;font-weight:800;padding:2px 4px;line-height:1.3;z-index:2;white-space:nowrap;overflow:hidden}',
      '.kav-b .kav-i{width:10px;height:10px}',
      '.kav-b-buy{background:#2a2410;color:#fcd34d}.kav-b-goal{background:#0f2e22;color:#4ade80}.kav-b-season{background:#3a1424;color:#f9a8d4}',
      '.kav-b-own{background:rgba(15,23,42,.75);color:#94a3b8}.kav-b-try{background:#334155;color:#fff}',
      '.kav-room{aspect-ratio:10/9;justify-content:flex-end;align-items:stretch}',
      '.kav-rbg{position:absolute;inset:0;background-size:cover;background-position:center}',
      '.kav-rfl{position:absolute;left:0;right:0;bottom:0;height:32%}',
      '.kav-room .kav-b{left:auto;right:6px;top:6px}',
      '.kav-rn{position:relative;z-index:1;display:block;text-align:left;padding:18px 8px 6px;font-size:12px;font-weight:800;color:#fff;background:linear-gradient(transparent,rgba(2,6,23,.75));text-shadow:0 1px 2px rgba(0,0,0,.5)}',
      '.kav-rn small{display:block;font-size:10px;font-weight:600;color:#cbd5e1}',
      '.kav-rname{width:100%;box-sizing:border-box;font:inherit;font-size:14px;color:#fff;background:#16223b;border:1px solid #2a3858;border-radius:10px;padding:9px 12px;outline:none}',
      '.kav-rname:focus{border-color:#7dd3fc}',
      '.kav-chips{display:flex;flex-wrap:wrap;gap:8px}',
      '.kav-chip{border:1px solid #2a3858;background:#16223b;color:#cbd5e1;border-radius:999px;padding:7px 12px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}',
      '.kav-chip.on{background:#fbbf24;border-color:#fbbf24;color:#1a1300}',
      '.kav-note{display:flex;gap:8px;align-items:flex-start;margin:10px 2px 0;padding:9px 11px;border-radius:10px;background:#2a2410;border:1px solid #5b4a12;color:#fcd34d;font-size:12px;line-height:1.45}',
      '.kav-foot{display:none}',
      '.kav-reset{border:0;border-radius:12px;background:#16223b;color:#e2e8f0;font:inherit;font-weight:800;font-size:14px;cursor:pointer;padding:12px}',
      '.kav-dlg{position:absolute;inset:0;background:rgba(2,6,23,.6);display:flex;align-items:center;justify-content:center;padding:16px;z-index:20}',
      '.kav-dlg[hidden]{display:none}',
      '.kav-dbox{width:100%;max-width:420px;background:#111c33;border:1px solid #24304d;border-radius:16px;padding:18px;color:#e2e8f0}',
      '.kav-dbox h3{margin:0 0 6px;font-size:16px;color:#fff}.kav-dbox p{margin:0 0 10px;font-size:13px;color:#94a3b8;line-height:1.5}',
      '.kav-dl{list-style:none;margin:0 0 10px;padding:0;display:flex;flex-direction:column;gap:6px}',
      '.kav-dl li{display:flex;justify-content:space-between;gap:10px;font-size:13px;padding:8px 10px;background:#16223b;border-radius:10px}',
      '.kav-dr{display:inline-flex;align-items:center;gap:4px;color:#fcd34d;font-weight:800;text-align:right}.kav-dr em{font-style:normal;color:#94a3b8;font-weight:600;font-size:12px}',
      '.kav-dtot{display:flex;justify-content:space-between;align-items:center;font-size:14px;padding:4px 2px}.kav-dtot b{display:inline-flex;align-items:center;gap:5px;color:#fcd34d}',
      '.kav-dbal{font-size:12px;color:#94a3b8;margin:0 2px 12px}',
      '.kav-dacts{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}',
      '.kav-dbtn{border:1px solid #24304d;background:#16223b;color:#e2e8f0;border-radius:10px;padding:9px 12px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}',
      '.kav-dbtn.kav-dgo{background:#fbbf24;border-color:#fbbf24;color:#1a1300}.kav-dbtn:disabled{opacity:.5;cursor:not-allowed}',
      '@media(max-width:760px){',
      '.kav-ov{background:#0b1426}',
      '.kav{border-radius:0;max-height:none;height:100%;margin:0}',
      '.kav-h{padding:10px 16px}.kav-back span{display:none}.kav-reset-d{display:none}',
      '.kav-body{display:flex;flex-direction:column;padding:12px 16px 90px;gap:12px;flex:1}',
      '.kav-left,.kav-right{flex:none}.kav-right{min-height:auto}.kav-panel{overflow:visible}',
      '.kav-left{display:contents}',
      '.kav-stick{position:sticky;top:-12px;z-index:6;margin:-12px -16px 0;width:calc(100% + 32px);max-width:none;box-sizing:border-box;padding:12px 16px 8px;background:#0b1426;display:flex;justify-content:center}',

      // Phone: the preview stays pinned at a fixed size while the list scrolls, so every change shows
      // at once without scrolling back up (owner, 2026-10-31). Fixed, not shrinking: nothing jumps under a tap.
      '.kav-prev{width:72%}.kav-body{scroll-padding-top:calc((100vw - 32px) * .72 * .9 + 24px)}',
      '.kav-save-d{display:none}',
      '.kav-g5{grid-template-columns:repeat(4,1fr)}',
      '.kav-right{padding:10px}',
      '.kav-tabs button{font-size:12px;padding:9px 4px}',
      '.kav-foot{display:grid;grid-template-columns:1fr 1fr;gap:10px;position:absolute;left:0;right:0;bottom:0;padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px));background:#0b1426;border-top:1px solid #1c2944;z-index:10}',
      '.kav-save-m{flex-direction:row;gap:6px;padding:12px}.kav-save-m small::before{content:"· "}',
      '}'
    ].join('\n');
    document.head.appendChild(st);
  }

  window.khAvatarEditor = { open: open, close: close };
})();
