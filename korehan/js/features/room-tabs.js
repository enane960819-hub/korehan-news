/* ============================================================
   KoreHani — My Room: more than one room (owner-approved mockup 2026-10-30)

   * A row of room tabs above the room (Living room · Cafe · … · + New).
     Tap a tab to switch; tap the open tab to rename it / pick its theme.
   * "Room X of N" caption under the room.
   * Add a room sheet: name, theme (themes the learner owns), cost line,
     "Add room · N nyang". Extra rooms are server-side slots bought through
     buy_room_item('room_slot_<n>'): 2nd 600 (Premium: included), 3rd 1,000,
     4th / 5th 1,500 Premium only. kh_my_room_slots() says how many rooms
     show; rooms past it (Premium lapsed) are hidden, never deleted.
   * Edit mode: a tray of the learner's items marked Here / In <room> /
     Not placed; tapping one from another room moves it here (items are
     shared and stand in one room at a time).

   Data + layout view per room: js/features/avatar-art.js (khAvatar rooms
   API). Uses My Page's room helpers (renderRoomItems, getRoomOwned,
   getRoomItemDef, roomImgMissing, placeRoomItem, _syncRoomToServer,
   _applyRoomTheme, _userCoin, _setNyangBalance, ROOM_ITEMS).
   ============================================================ */
(function () {
  var A = function () { return window.khAvatar; };
  var S = { info: null, inited: false, sheet: null, busy: false };
  var THEME_IC = { classic: 'sofa', 'default': 'sofa', classroom: 'school', cafe: 'coffee', 'seoul-night': 'moon',
    winter: 'snowflake', 'kpop-studio': 'mic', attic: 'star' };

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ic(n) { return '<i data-lucide="' + n + '" class="rt-i" aria-hidden="true"></i>'; }
  function icons() { if (typeof renderKhLucideIcons === 'function') { try { renderKhLucideIcons(); } catch (_) {} } }
  function nf(n) { return Number(n || 0).toLocaleString(); }
  function say(m) { if (typeof toast === 'function') toast(m); }
  function user() { return (typeof supaUser !== 'undefined' && supaUser) ? supaUser : null; }
  function coin() { return (typeof _userCoin !== 'undefined') ? Number(_userCoin) || 0 : 0; }
  function owned() { return (typeof getRoomOwned === 'function') ? getRoomOwned() : []; }
  function isPremium() {
    if (S.info && typeof S.info.premium === 'boolean') return S.info.premium;
    return typeof khIsPremiumPlan === 'function' ? !!khIsPremiumPlan() : false;
  }

  // ── Slots (server: kh_my_room_slots; fallback = the same rule here) ──
  var SLOTS = [{ slot: 2, price: 600, premium_only: false, premium_included: true },
    { slot: 3, price: 1000, premium_only: false, premium_included: false },
    { slot: 4, price: 1500, premium_only: true, premium_included: false },
    { slot: 5, price: 1500, premium_only: true, premium_included: false }];
  function localInfo() {
    var prem = isPremium(), own = owned(), n = 1, max = 1, next = null;
    SLOTS.forEach(function (s) {
      var counts = (s.premium_included && prem) || (own.indexOf('room_slot_' + s.slot) !== -1 && (prem || !s.premium_only));
      if (prem || !s.premium_only) max++;
      if (counts) n++;
      if (!next && !counts) next = { slot: s.slot, price: (s.premium_included && prem) ? 0 : s.price, premium_only: s.premium_only, locked: s.premium_only && !prem };
    });
    return { ok: true, premium: prem, allowed: n, max: max, next: next, local: true };
  }
  function loadInfo() {
    var sb = (typeof getSupa === 'function') ? getSupa() : null;
    if (!sb || !user()) { S.info = localInfo(); return Promise.resolve(S.info); }
    return sb.rpc('kh_my_room_slots').then(function (r) {
      var b = r && !r.error && r.data;
      S.info = (b && b.ok) ? b : localInfo();
      return S.info;
    }, function () { S.info = localInfo(); return S.info; });
  }

  // ── DOM ────────────────────────────────────────────────────────────
  function ensureDom() {
    var room = document.getElementById('miniroom-container');
    if (!room) return false;
    if (!document.getElementById('rt-tabs')) {
      var tabs = document.createElement('div');
      tabs.id = 'rt-tabs'; tabs.className = 'rt-tabs'; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Your rooms');
      room.parentNode.insertBefore(tabs, room);
      tabs.addEventListener('click', onTabsClick);
    }
    if (!document.getElementById('rt-cap')) {
      var cap = document.createElement('div');
      cap.id = 'rt-cap'; cap.className = 'rt-cap';
      room.parentNode.insertBefore(cap, room.nextSibling);
    }
    if (!document.getElementById('rt-tray')) {
      var tray = document.createElement('div');
      tray.id = 'rt-tray'; tray.className = 'rt-tray'; tray.hidden = true;
      var after = document.getElementById('room-size-controls');
      if (after && after.parentNode) after.parentNode.insertBefore(tray, after.nextSibling);
      else room.parentNode.appendChild(tray);
      tray.addEventListener('click', onTrayClick);
    }
    return true;
  }
  function renderTabs() {
    var el = document.getElementById('rt-tabs');
    if (!el || !A()) return;
    var vis = A().visibleRooms(), cur = A().currentRoom().id;
    var canAdd = A().allRooms().length > vis.length || vis.length < A().MAX_ROOMS;
    el.innerHTML = vis.map(function (r) {
      var on = r.id === cur;
      return '<button type="button" role="tab" class="rt-tab' + (on ? ' on' : '') + '" data-room="' + esc(r.id) + '" aria-selected="' + on + '"'
        + (on ? ' title="Rename or change this room"' : '') + '>' + ic(THEME_IC[r.theme] || 'sofa') + '<span>' + esc(r.name) + '</span>'
        + (on ? '<span class="rt-pen">' + ic('pencil') + '</span>' : '') + '</button>';
    }).join('') + (canAdd ? '<button type="button" class="rt-tab rt-new" data-act="new">' + ic('plus') + '<span>New</span></button>' : '');
    el.hidden = false;
    el.classList.toggle('rt-single', vis.length < 2);   // looking at one room: no tab row (My Room mockup 2026-10-31)
    icons();
    var on = el.querySelector('.rt-tab.on');
    if (on && on.scrollIntoView && el.scrollWidth > el.clientWidth) { try { on.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) {} }
  }
  function placedCount() {
    var box = document.getElementById('miniroom-items');
    return box ? box.querySelectorAll('.room-placed-item').length : 0;
  }
  function renderCap() {
    var el = document.getElementById('rt-cap');
    if (!el || !A()) return;
    var vis = A().visibleRooms(), cur = A().currentRoom();
    var idx = 0; vis.forEach(function (r, i) { if (r.id === cur.id) idx = i; });
    var n = placedCount();
    el.innerHTML = '<span><b>' + esc(cur.name) + '</b> · ' + n + (n === 1 ? ' item' : ' items') + '</span><span class="rt-of">Room ' + (idx + 1) + ' of ' + vis.length + '</span>'
      + '<a class="rt-shop" href="korehan-shop.html">Shop' + ic('arrow-right') + '</a>';
    icons();
  }
  function renderAll() { renderTabs(); renderCap(); renderTray(); }

  function switchTo(id) {
    if (!A()) return;
    A().setCurrent(id);
    if (typeof _selectedRoomItemId !== 'undefined') { try { window._selectedRoomItemId = null; } catch (_) {} }
    if (typeof renderRoomItems === 'function') renderRoomItems();
    if (typeof updateRoomSizeUI === 'function') { try { updateRoomSizeUI(); } catch (_) {} }
    renderAll();
  }
  function onTabsClick(ev) {
    var t = ev.target.closest('[data-room],[data-act]');
    if (!t) return;
    if (t.dataset.act === 'new') return openAdd();
    var id = t.dataset.room;
    if (id === A().currentRoom().id) return openEdit(id);
    switchTo(id);
  }

  // ── Edit-mode tray ─────────────────────────────────────────────────
  function trayItems() {
    var own = owned(), list = (typeof ROOM_ITEMS !== 'undefined' && Array.isArray(ROOM_ITEMS)) ? ROOM_ITEMS : [];
    return list.filter(function (it) {
      if (!it || own.indexOf(it.id) === -1) return false;
      if (typeof roomImgMissing === 'function' && roomImgMissing(it)) return false;
      return true;
    });
  }
  function renderTray() {
    var el = document.getElementById('rt-tray');
    var sec = document.getElementById('mp-miniroom-section');
    if (!el || !A()) return;
    var editing = !!(sec && sec.classList.contains('is-editing'));
    el.hidden = !editing;
    if (!editing) { el.innerHTML = ''; return; }
    var all = (typeof _getRoomLayoutAll === 'function') ? _getRoomLayoutAll() : [];
    var cur = A().currentRoom().id;
    var items = trayItems();
    var rank = function (it) { var r = A().whereIs(it.id, all); return !r ? 1 : (r.id === cur ? 0 : 2); };
    items.sort(function (a, b) { return rank(a) - rank(b); });
    el.innerHTML = '<div class="rt-th"><b>Your items</b><span>Tap an item from another room to move it here.</span></div>'
      + '<div class="rt-tg">' + items.map(function (it) {
        var r = A().whereIs(it.id, all);
        var st = !r ? 'none' : r.id === cur ? 'here' : 'other';
        var lab = st === 'here' ? 'Here' : st === 'none' ? 'Not placed' : 'In ' + r.name;
        var hiddenRoom = r && !A().visibleRooms().some(function (v) { return v.id === r.id; });
        return '<button type="button" class="rt-ti rt-' + st + '" data-item="' + esc(it.id) + '" title="' + esc(it.name + ' — ' + lab + (hiddenRoom ? ' (hidden room)' : '')) + '">'
          + '<span class="rt-tim" style="background-image:url(&quot;' + esc(it.img) + '&quot;)"></span>'
          + '<span class="rt-tl">' + esc(lab) + '</span></button>';
      }).join('') + '</div>';
  }
  function onTrayClick(ev) {
    var t = ev.target.closest('[data-item]');
    if (!t || !A()) return;
    var id = t.dataset.item;
    var all = (typeof _getRoomLayoutAll === 'function') ? _getRoomLayoutAll() : [];
    var r = A().whereIs(id, all), cur = A().currentRoom();
    if (r && r.id === cur.id) return;
    if (r) {
      A().moveTo(id, cur.id);
      if (typeof _syncRoomToServer === 'function') _syncRoomToServer();
      if (typeof renderRoomItems === 'function') renderRoomItems();
      var d = (typeof getRoomItemDef === 'function') ? getRoomItemDef(id) : null;
      say((d ? d.name : 'Item') + ' moved to ' + cur.name);
    } else if (typeof placeRoomItem === 'function') {
      placeRoomItem(id);
    }
    renderAll();
  }

  // ── Sheets (add a room / edit a room) ──────────────────────────────
  function themeOwned(r) {
    return r.classic || A().isFree(r) || owned().indexOf(A().serverId('room', r.id)) !== -1;
  }
  // Every background is listed; ones you don't have yet show their price / study goal and
  // open Customize → Room, where they can be tried on and bought.
  function themeGrid(sel, forNew) {
    var c = (typeof _getRoomTheme === 'function') ? (_getRoomTheme() || {}) : {};
    var rv = window.khRoomView, wall = '#e8dcc6';
    if (rv) { var wp = rv.WALLPAPERS.filter(function (w) { return w.id === (c.wallpaper || 'default'); })[0] || rv.WALLPAPERS[0]; wall = wp.bg; }
    return '<div class="rt-thg">' + A().ROOMS.map(function (r) {
      var have = themeOwned(r);
      var bg = r.classic ? 'background:' + esc(wall) : 'background-image:url(&quot;' + esc(A().themeUrl(r.id)) + '&quot;)';
      var tag = have ? '' : '<span class="rt-thl">' + ic(r.goal ? 'graduation-cap' : 'lock') + esc(r.goal ? r.goal.short : (nf(r.price) + (r.season ? ' · ' + r.season : ''))) + '</span>';
      return '<button type="button" class="rt-th1' + (r.id === sel ? ' on' : '') + (have ? '' : ' rt-lock') + '" data-pick="' + r.id + '"' + (have ? '' : ' data-locked="1"') + ' aria-pressed="' + (r.id === sel) + '">'
        + '<span class="rt-thb" style="' + bg + '"></span>' + tag + '<span class="rt-thn">' + esc(r.name) + '</span></button>';
    }).join('') + '</div><p class="rt-hint">' + (forNew
      ? 'Locked backgrounds are bought in Customize → Room. Add the room now and change its background later.'
      : 'Locked backgrounds open in Customize, where you can try them on.') + '</p>';
  }
  function openSheet(html, onAct) {
    closeSheet();
    var ov = document.createElement('div');
    ov.className = 'rt-ov';
    ov.innerHTML = '<div class="rt-sheet" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) {
      if (e.target === ov) return closeSheet();
      // (The pick is kept in ov.dataset.sel — an attribute matching this selector on the
      // overlay itself used to swallow every later tap, Save included.)
      var th = e.target.closest('.rt-th1');
      if (th) {
        if (th.dataset.locked) {
          // Add-a-room sheet: Customize would dress the CURRENT room, not the new one —
          // point at the hint instead of leaving the sheet.
          if (ov.dataset.newroom) {
            var h = ov.querySelector('.rt-hint');
            if (h) { h.classList.remove('rt-hint-on'); void h.offsetWidth; h.classList.add('rt-hint-on'); }
            return;
          }
          closeSheet();
          if (window.khAvatarEditor) khAvatarEditor.open('room');
          return;
        }
        ov.querySelectorAll('.rt-th1').forEach(function (b) { b.classList.toggle('on', b === th); b.setAttribute('aria-pressed', b === th ? 'true' : 'false'); });
        ov.dataset.sel = th.dataset.pick;
        return;
      }
      var a = e.target.closest('[data-sact]');
      if (a) onAct(a.dataset.sact, ov);
    });
    S.sheet = ov;
    S.esc = function (e) { if (e.key === 'Escape') closeSheet(); };
    document.addEventListener('keydown', S.esc);
    icons();
    var inp = ov.querySelector('input');
    if (inp) setTimeout(function () { try { inp.focus(); inp.select(); } catch (_) {} }, 30);
    return ov;
  }
  function closeSheet() {
    if (S.sheet) { S.sheet.remove(); S.sheet = null; }
    if (S.esc) { document.removeEventListener('keydown', S.esc); S.esc = null; }
  }

  function openEdit(id) {
    var r = A().allRooms().filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    var ov = openSheet('<h3>Room settings</h3><p>Rename this room or change its background.</p>'
      + '<label class="rt-lab">Name<input class="rt-in" maxlength="40" value="' + esc(r.name) + '" aria-label="Room name"></label>'
      + themeGrid(r.theme)
      + '<div class="rt-acts"><button type="button" class="rt-b" data-sact="cancel">Cancel</button><button type="button" class="rt-b rt-go" data-sact="save">Save</button></div>',
    function (act, ov) {
      if (act === 'cancel') return closeSheet();
      if (act === 'save') {
        var name = ov.querySelector('.rt-in').value;
        A().updateRoom(id, name, ov.dataset.sel || r.theme);
        closeSheet();
        if (typeof _syncRoomToServer === 'function') _syncRoomToServer();
        if (typeof _applyRoomTheme === 'function') _applyRoomTheme();
        renderAll();
        say('Room saved');
      }
    });
    ov.dataset.sel = r.theme;
  }

  async function openAdd() {
    if (!user()) { say('Please sign in first'); return; }
    if (!S.info) await loadInfo();
    var info = S.info || localInfo();
    var all = A().allRooms(), vis = A().visibleRooms();
    var allowed = Math.max(vis.length, Number(info.allowed) || 1);
    var hidden = all.length > vis.length ? all[vis.length] : null;   // a room hidden after Premium lapsed
    var freeSlot = allowed > vis.length;                              // slot already paid / included
    var next = info.next;
    var roomNo = vis.length + 1, maxN = Math.max(Number(info.max) || 3, roomNo);
    var price = freeSlot ? 0 : (next ? Number(next.price) || 0 : 0);
    var locked = !freeSlot && (!next || next.locked);
    var html;
    if (locked) {
      var atMax = !next;
      html = '<h3>' + (atMax ? 'All rooms added' : 'More rooms with Premium') + '</h3>'
        + '<p>' + (atMax ? 'You have every room your plan includes (' + vis.length + ').'
          : 'Free accounts can have up to 3 rooms. Premium members can add a 4th and 5th room (1,500 nyang each), and the 2nd room is included.') + '</p>'
        + '<div class="rt-acts"><button type="button" class="rt-b" data-sact="cancel">Close</button>'
        + (atMax ? '' : '<a class="rt-b rt-go" href="korehan-courses.html">See Premium</a>') + '</div>';
      openSheet(html, function (act) { if (act === 'cancel') closeSheet(); });
      return;
    }
    var short = Math.max(0, price - coin());
    var costRight = price > 0 ? nf(price) + ' nyang' : (freeSlot ? 'unlocked' : 'included');
    var btn = price > 0 ? 'Add room · ' + nf(price) + ' nyang' : 'Add room';
    if (hidden) {
      html = '<h3>Bring back a room</h3><p>Your room <b>' + esc(hidden.name) + '</b> is hidden because it\'s past your plan\'s rooms. '
        + 'Unlock room ' + roomNo + ' to show it again, with everything in it.</p>'
        + '<div class="rt-cost"><span>Room ' + roomNo + ' of ' + maxN + '</span><b>' + costRight + '</b></div>'
        + (short ? '<p class="rt-short">You need ' + nf(short) + ' more nyang.</p>' : '')
        + '<div class="rt-acts"><button type="button" class="rt-b" data-sact="cancel">Cancel</button>'
        + '<button type="button" class="rt-b rt-go" data-sact="add"' + (short ? ' disabled' : '') + '>' + (price > 0 ? 'Unlock · ' + nf(price) + ' nyang' : 'Unlock room') + '</button></div>';
    } else {
      html = '<h3>Add a room</h3><p>Pick a name and a background. You can change both later. Move items in from your other rooms or buy new ones.</p>'
        + '<label class="rt-lab">Name<input class="rt-in" maxlength="40" placeholder="Study corner" aria-label="Room name"></label>'
        + themeGrid('default', true)
        + '<div class="rt-cost"><span>Room ' + roomNo + ' of ' + maxN + '</span><b>' + costRight + '</b></div>'
        + (short ? '<p class="rt-short">You have ' + nf(coin()) + ' nyang — ' + nf(short) + ' more to go.</p>' : '')
        + '<div class="rt-acts"><button type="button" class="rt-b" data-sact="cancel">Cancel</button>'
        + '<button type="button" class="rt-b rt-go" data-sact="add"' + (short ? ' disabled' : '') + '>' + btn + '</button></div>';
    }
    var ov = openSheet(html, function (act, ov) {
      if (act === 'cancel') return closeSheet();
      if (act === 'add') addRoom(ov, { price: price, slot: next && next.slot, freeSlot: freeSlot, hidden: hidden });
    });
    ov.dataset.sel = 'default';
    ov.dataset.newroom = '1';
  }

  async function addRoom(ov, o) {
    if (S.busy) return;
    S.busy = true;
    var btn = ov.querySelector('[data-sact="add"]');
    if (btn) btn.disabled = true;
    try {
      if (!o.freeSlot && o.price > 0 && o.slot) {
        var sb = (typeof getSupa === 'function') ? getSupa() : null;
        if (!sb) throw new Error('offline');
        var r = await sb.rpc('buy_room_item', { p_item_id: 'room_slot_' + o.slot });
        var b = (r && r.data) || {};
        if (r.error || !b.ok) {
          var why = b.error === 'INSUFFICIENT_NYANG' ? 'Not enough nyang'
            : b.error === 'PREMIUM_ONLY' ? 'This room is part of Premium'
              : b.error === 'INCLUDED' ? 'This room is included in Premium'
                : 'Couldn\'t add the room — try again later';
          if (typeof b.current === 'number' && typeof _setNyangBalance === 'function') _setNyangBalance(b.current);
          if (b.error !== 'INCLUDED') { say(why); return; }
        } else {
          if (typeof b.nyang_balance === 'number' && typeof _setNyangBalance === 'function') _setNyangBalance(b.nyang_balance);
          if (typeof getRoomOwned === 'function' && typeof setRoomOwned === 'function') {
            var own = getRoomOwned(); if (own.indexOf('room_slot_' + o.slot) === -1) { own.push('room_slot_' + o.slot); setRoomOwned(own); }
          }
        }
      }
      var info = await loadInfo();
      var allowed = Math.max(1, Number(info.allowed) || 1);
      var vis = A().visibleRooms().length;
      if (allowed <= vis && !info.local) { say('Couldn\'t add the room — try again later'); return; }
      A().setAllowed(Math.max(allowed, vis + 1));
      var id;
      if (o.hidden) id = o.hidden.id;
      else {
        var name = (ov.querySelector('.rt-in') || {}).value || '';
        id = A().addRoom(name || ('Room ' + (vis + 1)), ov.dataset.sel || 'default');
      }
      closeSheet();
      if (typeof _syncRoomToServer === 'function') _syncRoomToServer();
      switchTo(id);
      say(o.hidden ? 'Room is back' : 'Room added');
    } catch (e) {
      say('Couldn\'t add the room — check your connection.');
    } finally {
      S.busy = false;
      if (btn && document.body.contains(btn)) btn.disabled = false;
    }
  }

  // ── Style ──────────────────────────────────────────────────────────
  function ensureStyle() {
    if (document.getElementById('rt-style')) return;
    var st = document.createElement('style');
    st.id = 'rt-style';
    st.textContent = [
      '.rt-i{width:15px;height:15px;flex:none}',
      '.rt-tabs{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 10px;margin:0 auto;max-width:920px;scrollbar-width:none;-webkit-overflow-scrolling:touch}',
      '.rt-tabs::-webkit-scrollbar{display:none}',
      '#mp-miniroom-section:not(.is-editing) .rt-of{display:none}#mp-miniroom-section.is-editing .rt-shop{display:none}',
      '.rt-shop{display:inline-flex;align-items:center;gap:3px;color:#2563eb;font-weight:700;text-decoration:none}.rt-shop svg{width:14px;height:14px}',
      'body.kh-neon-on .rt-shop{color:#93c5fd}',
      '.rt-tab{flex:none;display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#e2e8f0;font:inherit;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;max-width:220px}',
      '.rt-tab span{overflow:hidden;text-overflow:ellipsis}',
      '.rt-tab:hover{background:rgba(255,255,255,.1)}',
      '.rt-tab.on{background:#fbbf24;border-color:#fbbf24;color:#1a1300}',
      '.rt-pen{display:inline-flex;opacity:.7}.rt-pen .rt-i{width:12px;height:12px}',
      '.rt-new{border-style:dashed;color:#cbd5e1}',
      '.rt-cap{display:flex;justify-content:space-between;gap:10px;max-width:920px;margin:8px auto 0;padding:0 4px;font-size:12px;color:rgba(255,255,255,.6)}',
      '.rt-cap b{color:#fff;font-weight:800}',
      '.rt-tray{max-width:920px;margin:12px auto 0;padding:12px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}',
      '.rt-tray[hidden]{display:none}',
      '.rt-th{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline;margin-bottom:10px;font-size:12px;color:rgba(255,255,255,.55)}.rt-th b{color:#7dd3fc;font-size:11px;letter-spacing:.08em;text-transform:uppercase}',
      '.rt-tg{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:8px;max-height:300px;overflow:auto}',
      '.rt-ti{position:relative;aspect-ratio:1/1.05;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:#121d35;cursor:pointer;padding:6px 4px 4px;display:flex;flex-direction:column;align-items:center;gap:4px;font:inherit}',
      '.rt-ti:hover{background:#18264a}',
      '.rt-tim{flex:1;width:100%;background-size:contain;background-position:center;background-repeat:no-repeat}',
      '.rt-tl{font-size:10.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}',
      '.rt-here .rt-tl{color:#7dd3fc}.rt-other .rt-tl{color:#fbbf24}.rt-none .rt-tl{color:#94a3b8}',
      '.rt-here{cursor:default}.rt-other .rt-tim,.rt-none .rt-tim{opacity:.75}',
      '.rt-ov{position:fixed;inset:0;z-index:9600;background:rgba(2,6,23,.62);display:flex;align-items:center;justify-content:center;padding:16px}',
      '.rt-sheet{width:100%;max-width:460px;max-height:calc(100vh - 32px);overflow:auto;background:#0f1a30;border:1px solid #24304d;border-radius:18px;padding:20px;color:#e2e8f0;font-family:inherit}',
      '.rt-sheet h3{margin:0 0 6px;font-size:18px;color:#fff}.rt-sheet p{margin:0 0 12px;font-size:13px;line-height:1.55;color:#94a3b8}',
      '.rt-lab{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:700;color:#94a3b8;margin-bottom:12px}',
      '.rt-in{font:inherit;font-size:15px;color:#fff;background:#16223b;border:1px solid #2a3858;border-radius:12px;padding:11px 14px;outline:none}',
      '.rt-in:focus{border-color:#7dd3fc}',
      '.rt-thg{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}',
      '.rt-th1{position:relative;aspect-ratio:10/9;border-radius:12px;border:2px solid transparent;overflow:hidden;cursor:pointer;padding:0;background:#16223b;font:inherit}',
      '.rt-th1.on{border-color:#fbbf24}',
      '.rt-th1.rt-lock .rt-thb{filter:saturate(.55) brightness(.75)}',
      '.rt-thl{position:absolute;top:6px;right:6px;display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:999px;background:rgba(2,6,23,.72);color:#fcd34d;font-size:10px;font-weight:800}',
      '.rt-thl .rt-i{width:11px;height:11px}',
      '.rt-thb{position:absolute;inset:0;background-size:cover;background-position:center}',
      '.rt-thn{position:absolute;left:0;right:0;bottom:0;padding:14px 7px 5px;text-align:left;font-size:11px;font-weight:800;color:#fff;background:linear-gradient(transparent,rgba(2,6,23,.75))}',
      '.rt-hint{font-size:11.5px!important;margin:8px 0 12px!important}',
      '.rt-hint-on{color:#fbbf24!important;animation:rtHint .6s ease}',
      '@keyframes rtHint{0%,100%{transform:none}30%{transform:translateX(-3px)}60%{transform:translateX(3px)}}',
      '.rt-cost{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-radius:12px;background:#16223b;color:#fbbf24;font-weight:800;font-size:14px;margin-bottom:12px}',
      '.rt-short{color:#fca5a5!important;font-size:12.5px!important}',
      '.rt-acts{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}',
      '.rt-b{border:1px solid #2a3858;background:#16223b;color:#e2e8f0;border-radius:12px;padding:11px 16px;font:inherit;font-size:14px;font-weight:800;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}',
      '.rt-b.rt-go{background:#fbbf24;border-color:#fbbf24;color:#1a1300;flex:1;justify-content:center}',
      '.rt-b:disabled{opacity:.5;cursor:not-allowed}',
      '@media(max-width:600px){.rt-ov{align-items:flex-end;padding:0}.rt-sheet{max-width:none;border-radius:18px 18px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom,0px))}.rt-tab{padding:7px 12px;font-size:12.5px}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  // ── Init ───────────────────────────────────────────────────────────
  function init() {
    if (!A() || !ensureDom()) return;
    ensureStyle();
    renderAll();
    if (!S.inited) {
      S.inited = true;
      // Item count + tray follow the room as it's re-drawn / edited.
      var box = document.getElementById('miniroom-items');
      var sec = document.getElementById('mp-miniroom-section');
      if (window.MutationObserver) {
        if (box) new MutationObserver(function () { renderCap(); if (sec && sec.classList.contains('is-editing')) renderTray(); }).observe(box, { childList: true });
        if (sec) new MutationObserver(function () { renderTray(); }).observe(sec, { attributes: true, attributeFilter: ['class'] });
      }
    }
    loadInfo().then(function (info) {
      var before = A().visibleRooms().length, cur = A().currentRoom().id;
      A().setAllowed(info.allowed);
      var after = A().visibleRooms();
      if (after.length !== before || !after.some(function (r) { return r.id === cur; })) {
        if (typeof renderRoomItems === 'function') renderRoomItems();
      }
      renderAll();
    });
  }

  window.khRoomTabs = { init: init, refresh: renderAll, openAdd: openAdd, openEdit: openEdit, switchTo: switchTo };
})();
