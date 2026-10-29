/* ============================================================
   KoreHani — My Room, learning version (mockup 2026-10-29)

   1. Today's word: the room character shows one of the learner's saved
      words each KST day — a word due for review if there is one, else any
      saved word; the pick is stable for the day. Korean, meaning, the
      example sentence from the Word Bank when it has one, a speaker
      button (khSpeak) and "Review (N due)" → the daily review.
   2. Next unlocks: room items earned by studying (room_unlocks). On load
      kh_claim_room_unlocks() computes progress on the server and adds
      any reached item to user_room_state.owned (the browser never writes
      ownership); new ones get a "Place it now" toast.

   Lives on korehan-mypage.html and uses its room helpers
   (getRoomLayout, getRoomItemDef, getRoomOwned, setRoomOwned,
   isItemPlaced, placeRoomItem, _roomActionToast, _roomEditing).
   ============================================================ */
(function () {
  var REVIEW_URL = 'korehan-study-room.html?review=daily';
  var GOAL_ICON = { streak_days: 'flame', saved_words: 'library', articles_read: 'newspaper', topik_tests: 'award', games_played: 'gamepad-2' };
  var ITEM_ICON = { lamp: 'lamp', cushion: 'armchair', espresso_machine: 'coffee', standing_desk: 'award', gaming_desk: 'gamepad-2',
    bookshelf: 'library', neon_hwaiting: 'zap', sofa_2seat: 'sofa', byobu: 'frame' };
  var S = { word: null, due: 0, empty: false, unlocks: null, expanded: false, min: false, uid: null };

  function kstToday() { return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(n) { return '<i data-lucide="' + n + '" aria-hidden="true"></i>'; }
  function drawIcons() { if (typeof renderKhLucideIcons === 'function') { try { renderKhLucideIcons(); } catch (_) {} } }
  function user() { return (typeof supaUser !== 'undefined' && supaUser) ? supaUser : null; }
  function lsGetJ(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }
  function lsSetJ(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function cleanEn(en) {
    var s = String(en || '');
    if (typeof splitWordEnMeaning === 'function') { try { s = splitWordEnMeaning(s).meaning || s; } catch (_) {} }
    return s.replace(/^\s*\[[^\]]*\]\s*/, '').trim();
  }

  // ── 1. Today's word ──────────────────────────────────────────────
  async function loadWord() {
    var u = user(), sb = (typeof getSupa === 'function') ? getSupa() : null;
    if (!u || !sb) return;
    var today = kstToday();
    var key = 'kh_room_word_' + u.id;
    var dueQ = sb.from('user_saved_words').select('word_ko', { count: 'exact', head: true })
      .eq('user_id', u.id).eq('mastered', false).lte('srs_next_review', today);
    var cached = lsGetJ(key);
    var res;
    if (cached && cached.d === today && cached.ko) {
      res = await dueQ;
      S.word = cached;
    } else {
      var r = await Promise.all([
        dueQ,
        sb.from('user_saved_words').select('word_ko, word_en, word_rom')
          .eq('user_id', u.id).eq('mastered', false).lte('srs_next_review', today)
          .order('word_key', { ascending: true }).limit(200),
        sb.from('user_saved_words').select('word_ko, word_en, word_rom')
          .eq('user_id', u.id).order('word_key', { ascending: true }).limit(1000)
      ]);
      res = r[0];
      var due = (r[1] && !r[1].error && r[1].data) || [];
      var all = (r[2] && !r[2].error && r[2].data) || [];
      if (r[2] && r[2].error) return;      // unknown state: show nothing
      var pool = due.length ? due : all;
      if (!pool.length) { S.empty = true; S.word = null; render(); return; }
      var w = pool[hash(u.id + ':' + today) % pool.length];
      S.word = { d: today, ko: w.word_ko, en: cleanEn(w.word_en), rom: w.word_rom || '', due: !!due.length, ex: null };
      // Example sentence from the Word Bank (NIKL, reviewed) when it has one.
      try {
        var ex = await sb.from('word_bank').select('example_ko').eq('word_ko', w.word_ko).not('example_ko', 'is', null).limit(1);
        if (ex && !ex.error && ex.data && ex.data[0]) S.word.ex = ex.data[0].example_ko;
      } catch (_) {}
      lsSetJ(key, S.word);
    }
    S.due = (res && !res.error && typeof res.count === 'number') ? res.count : 0;
    S.empty = false;
    render();
  }

  function bubbleHtml() {
    if (S.empty) {
      return '<div class="rw-tag">Today\'s word</div>'
        + '<div class="rw-e">Save words while you read — they\'ll show up here.</div>'
        + '<a class="rw-btn" href="korehan-all.html">Read the news</a>';
    }
    var w = S.word;
    return '<button type="button" class="rw-x" aria-label="Hide today\'s word" onclick="khRoomLearn.minimize(true)">' + icon('x') + '</button>'
      + '<div class="rw-tag">Today\'s word · ' + (w.due ? 'due for review' : 'from your word book') + '</div>'
      + '<div class="rw-k"><span lang="ko">' + esc(w.ko) + '</span>'
      + '<button type="button" class="rw-say" aria-label="Listen" onclick="khRoomLearn.say(this)">' + icon('volume-2') + '</button></div>'
      + (w.en ? '<div class="rw-e">' + esc(w.en) + '</div>' : '')
      + (w.ex ? '<div class="rw-ex" lang="ko">' + esc(w.ex) + '</div>' : '')
      + (S.due > 0
          ? '<a class="rw-btn" href="' + REVIEW_URL + '">Review (' + S.due + ' due)</a>'
          : '<a class="rw-btn" href="korehan-saved.html">My words</a>');
  }

  function render() {
    var host = document.getElementById('miniroom-container');
    if (!host) return;
    var el = document.getElementById('room-word');
    if (!el) {
      el = document.createElement('div');
      el.id = 'room-word';
      el.className = 'rw';
      el.setAttribute('role', 'note');
      host.appendChild(el);
    }
    if (!user() || (!S.word && !S.empty)) { el.hidden = true; return; }
    S.min = !S.empty && lsGetJ('kh_room_word_min') === kstToday();
    el.classList.toggle('rw-min', S.min);
    el.innerHTML = S.min
      ? '<button type="button" class="rw-pill" onclick="khRoomLearn.minimize(false)" aria-label="Show today\'s word">' + icon('message-circle') + '<span lang="ko">' + esc(S.word.ko) + '</span></button>'
      : bubbleHtml() + '<span class="rw-tail" aria-hidden="true"></span>';
    el.hidden = false;
    drawIcons();
    position();
  }

  // Place the bubble above the character's head or beside it — never over
  // the face or the room's top-right buttons; narrow it, or as a last
  // resort shrink it, when the room is small (phones).
  function obstacles(host) {
    var hr = host.getBoundingClientRect(), out = [];
    ['room-theme-btn', 'room-bgm-btn', 'room-light-switch'].forEach(function (id) {
      var b = document.getElementById(id);
      if (!b || b.offsetParent === null) return;
      var r = b.getBoundingClientRect();
      out.push({ l: r.left - hr.left - 4, t: r.top - hr.top - 4, r: r.right - hr.left + 4, b: r.bottom - hr.top + 4 });
    });
    return out;
  }
  function hits(box, obs) {
    for (var i = 0; i < obs.length; i++) {
      var o = obs[i];
      if (box.l < o.r && box.l + box.w > o.l && box.t < o.b && box.t + box.h > o.t) return true;
    }
    return false;
  }
  function position() {
    var host = document.getElementById('miniroom-container');
    var el = document.getElementById('room-word');
    if (!host || !el || el.hidden) return;
    var editing = (typeof _roomEditing !== 'undefined' && _roomEditing);
    el.style.visibility = editing ? 'hidden' : '';
    if (editing) return;
    var W = host.clientWidth, H = host.clientHeight;
    if (!W || !H) return;
    el.style.transform = ''; el.style.width = ''; el.style.left = '0px'; el.style.top = '0px';
    el.classList.remove('rw-side-l', 'rw-side-r');
    var tail = el.querySelector('.rw-tail');
    if (tail) tail.style.left = '';

    // Character box (first placed character item), same math as renderRoomItems.
    var ch = null, layout = (typeof getRoomLayout === 'function') ? getRoomLayout() : [];
    for (var i = 0; i < layout.length; i++) {
      var d = (typeof getRoomItemDef === 'function') ? getRoomItemDef(layout[i].id) : null;
      if (d && d.category === 'character' && (typeof getRoomOwned !== 'function' || getRoomOwned().indexOf(d.id) !== -1)) { ch = { p: layout[i], d: d }; break; }
    }
    var cx = W / 2, headY = H * 0.42, left = W * 0.4, right = W * 0.6;
    if (ch) {
      var sc = Math.max(70, Math.min(170, Number(ch.p.scale || 100))) / 100;
      var boxW = (ch.d.size || 100) / 400 * W, boxH = (ch.d.size || 100) / 400 * H;
      var lx = (Number(ch.p.x) || 0) / 400 * W, ty = (Number(ch.p.y) || 0) / 360 * H;
      var vw = boxW * sc, vh = boxH * sc;
      var vl = lx + (boxW - vw) / 2, vt = ty + (boxH - vh) / 2;
      // Art is drawn "contain": a square sprite fills the smaller side.
      var art = Math.min(vh, vw), artTop = vt + (vh - art) / 2;
      cx = vl + vw / 2;
      headY = artTop + art * 0.09;
      left = cx - art * 0.22; right = cx + art * 0.22;
    }
    var obs = obstacles(host), gap = 12, pad = 6;
    if (S.min) {
      var pw = el.offsetWidth, ph = el.offsetHeight;
      el.style.left = Math.max(pad, Math.min(W - pw - pad, cx - pw / 2)) + 'px';
      el.style.top = Math.max(pad, headY - ph - 8) + 'px';
      return;
    }
    var bw0 = el.offsetWidth, MINW = 136;

    function above(w) {
      el.style.width = w + 'px';
      var h = el.offsetHeight;
      var lo = Math.max(pad, cx + 26 - w), hi = Math.min(W - w - pad, cx - 26);   // tail stays inside
      var t = headY - gap - h;
      if (t < pad || lo > hi) return null;
      var pref = Math.max(lo, Math.min(hi, cx - w / 2));
      // Slide left/right to clear the buttons.
      var cands = [pref];
      for (var x = pref; x >= lo; x -= 8) cands.push(x);
      for (x = pref; x <= hi; x += 8) cands.push(x);
      for (var k = 0; k < cands.length; k++) {
        var box = { l: cands[k], t: t, w: w, h: h };
        if (!hits(box, obs)) return box;
      }
      return null;
    }
    function side(dir) {
      var avail = dir > 0 ? W - right - gap - pad : left - gap - pad;
      var w = Math.min(bw0, avail);
      if (w < MINW) return null;
      el.style.width = w + 'px';
      var h = el.offsetHeight;
      var t = Math.max(pad, Math.min(H - h - pad, headY - 22));
      if (t + h > H - pad) return null;
      var box = { l: dir > 0 ? right + gap : left - gap - w, t: t, w: w, h: h };
      return hits(box, obs) ? null : box;
    }
    var box = above(bw0), kind = 'above';
    if (!box) { box = side(1); kind = 'r'; }
    if (!box) { box = side(-1); kind = 'l'; }
    if (!box && bw0 > MINW) { box = above(MINW); kind = 'above'; }
    if (box) {
      el.style.width = box.w + 'px';
      el.style.left = box.l + 'px';
      el.style.top = box.t + 'px';
      if (kind === 'r') el.classList.add('rw-side-r');
      else if (kind === 'l') el.classList.add('rw-side-l');
      else if (tail) tail.style.left = Math.max(14, Math.min(box.w - 26, cx - box.l - 9)) + 'px';
      return;
    }
    // Nothing fits: shrink (down to 70 %) above the head, clear of the face.
    el.style.width = MINW + 'px';
    var h = el.offsetHeight, room = headY - gap - pad;
    var k = Math.max(0.7, Math.min(1, room / h));
    var bl = Math.max(pad, Math.min(W - MINW - pad, cx - MINW / 2));
    el.style.left = bl + 'px';
    el.style.top = (headY - gap - h) + 'px';
    el.style.transformOrigin = (cx - bl) + 'px 100%';
    el.style.transform = 'scale(' + k.toFixed(3) + ')';
    if (tail) tail.style.left = Math.max(14, Math.min(MINW - 26, cx - bl - 9)) + 'px';
  }

  // ── 2. Study unlocks ─────────────────────────────────────────────
  async function claim() {
    var u = user(), sb = (typeof getSupa === 'function') ? getSupa() : null;
    var box = document.getElementById('room-unlocks');
    if (!u || !sb) { if (box) box.hidden = true; return; }
    var r;
    try { r = await sb.rpc('kh_claim_room_unlocks'); } catch (_) { r = null; }
    var body = r && !r.error && r.data;
    if (!body || !body.ok || !Array.isArray(body.unlocks)) { if (box) box.hidden = true; return; }
    S.unlocks = body.unlocks;
    window._roomUnlockIds = body.unlocks.map(function (x) { return x.item_id; });
    if (Array.isArray(body.owned) && typeof setRoomOwned === 'function') {
      var before = (typeof getRoomOwned === 'function') ? getRoomOwned().slice().sort().join(',') : '';
      setRoomOwned(body.owned);
      var after = (typeof getRoomOwned === 'function') ? getRoomOwned().slice().sort().join(',') : '';
      // Ownership changed on the server → redraw (placed items may now show).
      if (before !== after && typeof renderRoomItems === 'function') renderRoomItems();
    }
    renderUnlocks();
    var fresh = (body.new_items || []).filter(function (id) { return typeof id === 'string'; });
    if (fresh.length) announce(fresh);
  }

  function itemName(id) {
    var d = (typeof getRoomItemDef === 'function') ? getRoomItemDef(id) : null;
    if (d && d.name) return d.name;
    var u = (S.unlocks || []).filter(function (x) { return x.item_id === id; })[0];
    return (u && u.name) || id;
  }
  function announce(ids) {
    var text = ids.length === 1 ? 'Unlocked by studying: ' + itemName(ids[0])
      : 'Unlocked by studying: ' + ids.map(itemName).join(', ');
    var go = function () {
      ids.forEach(function (id) { if (typeof isItemPlaced === 'function' && !isItemPlaced(id) && typeof placeRoomItem === 'function') placeRoomItem(id); });
      var sec = document.getElementById('mp-miniroom-section');
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    if (typeof _roomActionToast === 'function') _roomActionToast(text, 'Place it now', go);
    else if (typeof toast === 'function') toast(text);
  }

  function rowHtml(u) {
    var art = icon(ITEM_ICON[u.item_id] || GOAL_ICON[u.goal_key] || 'gift');
    var pct = Math.max(u.owned ? 100 : 3, Math.min(100, Math.round((u.current / u.goal_target) * 100)));
    var placed = (typeof isItemPlaced === 'function') && isItemPlaced(u.item_id);
    var act = u.owned
      ? (placed ? '<span class="ru-done">' + icon('check') + 'In your room</span>'
                : '<button type="button" class="ru-place" onclick="khRoomLearn.place(\'' + esc(u.item_id) + '\')">Place</button>')
      : '';
    return '<div class="ru-row' + (u.owned ? ' ru-got' : '') + '">'
      + '<div class="ru-ic">' + art + '</div>'
      + '<div class="ru-t"><div class="ru-top"><b>' + esc(itemName(u.item_id)) + '</b>' + act + '</div>'
      + '<small>' + esc(u.label) + ' · ' + Math.min(u.current, u.goal_target) + ' / ' + u.goal_target + '</small>'
      + '<div class="ru-bar"><i style="width:' + pct + '%"></i></div></div></div>';
  }

  function renderUnlocks() {
    var box = document.getElementById('room-unlocks');
    if (!box || !S.unlocks) return;
    var list = S.unlocks.slice();
    if (!list.length) { box.hidden = true; return; }
    var open = list.filter(function (u) { return !u.owned; })
      .sort(function (a, b) { return (b.current / b.goal_target) - (a.current / a.goal_target) || a.sort - b.sort; });
    var rows = S.expanded ? list : open.slice(0, 3);
    box.innerHTML = '<div class="ru-h"><span><b>Next unlocks</b> · earned by studying, not bought</span>'
      + '<button type="button" class="ru-all" onclick="khRoomLearn.toggle()" aria-expanded="' + S.expanded + '">'
      + (S.expanded ? 'Show less' : 'All ' + list.length + ' →') + '</button></div>'
      + (rows.length ? rows.map(rowHtml).join('') : '<div class="ru-fin">' + icon('party-popper') + 'You\'ve earned every study unlock. Nice work.</div>');
    box.hidden = false;
    drawIcons();
    // Shop → "See my progress" links to #room-unlocks; scroll once it exists.
    if (!S.scrolled && location.hash === '#room-unlocks') {
      S.scrolled = true;
      setTimeout(function () { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 200);
    }
  }

  // ── Public ───────────────────────────────────────────────────────
  window.khRoomLearn = {
    init: function () {
      var u = user();
      if (!u) { render(); var b = document.getElementById('room-unlocks'); if (b) b.hidden = true; return; }
      if (S.uid === u.id) return;
      S.uid = u.id;
      loadWord().catch(function () {});
      claim().catch(function () {});
    },
    onRoomRender: function () { position(); if (S.unlocks) renderUnlocks(); },
    say: function (btn) {
      if (!S.word) return;
      if (typeof khSpeak === 'function') khSpeak(S.word.ko, 'female', btn);
    },
    minimize: function (on) {
      lsSetJ('kh_room_word_min', on ? kstToday() : '');
      render();
    },
    toggle: function () { S.expanded = !S.expanded; renderUnlocks(); },
    place: function (id) { if (typeof placeRoomItem === 'function') placeRoomItem(id); renderUnlocks(); },
    claim: claim
  };
  window.addEventListener('resize', function () { clearTimeout(window._rwT); window._rwT = setTimeout(position, 150); });
})();
