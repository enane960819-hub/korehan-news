/* ============================================================
   KoreHani — My Room character + room themes: catalogue and drawing
   (owner-approved mockup 2026-10-30)

   Shared by My Page (room + character editor), room-view.js (a friend's
   room on the public profile) and the profile header.

   WHAT IS STORED (user_room_state.prefs — the client may write prefs and
   layout only; `owned` is server-only):
     prefs.avatar = { hair, outfit, acc: [ids], profile: bool }
     prefs.rooms  = [{ id, name, theme }]   the learner's rooms in tab order;
                    rooms[0] (id 'main') is the room everyone already had.
     layout       one array for all rooms; an entry's `room` field names the
                    room it stands in (no field = rooms[0]), so an item stands
                    in one room at a time and old layouts are room 1 as is.
                    My Page reads / writes only the current room's view of
                    it (viewLayout / mergeLayout below).
     layout entry { id: 'kh_avatar', x, y, scale, flipped, room } = the
                    character standing in one room (draggable like any piece).
   How many rooms show = kh_my_room_slots() (server: bought slots + Premium);
   rooms past that count are hidden, never deleted.
   Server side: avatar_items (catalogue), buy_room_item (purchases, unlock-
   only / season checks), kh_claim_room_unlocks (study unlocks) and
   get_public_room (shows only worn items the owner owns or that are free)
   — supabase/migrations/20261030_avatar_catalog.sql.

   SPRITES (korehan/assets/avatar/README.md): base-<hair>.png = basic tee,
   <hair>-<outfit>.png presets, acc-<id>.png accessories. Accessory anchors
   were measured on base-long (176x368); every other sprite is matched to it
   with its own face / hair metrics (SPRITE below: eye centre + face scale
   from template matching, hair top + hair edges 40 px below the top), so an
   accessory sits on the head of every hair x outfit sprite.
   All art URLs go through khRoomImg() (versioned; bump KH_ROOM_ART_V).
   ============================================================ */
(function () {
  var NS = 'kh_avatar_v1';

  // ── Catalogue (prices mirror avatar_items; the server re-checks) ──
  var HAIRS = [
    { id: 'long', name: 'Long' }, { id: 'short', name: 'Short' },
    { id: 'bob', name: 'Bob' }, { id: 'curly', name: 'Curly' }
  ];
  // goal: earned by studying (never sold). months: on sale only then (KST).
  var OUTFITS = [
    { id: 'tee', name: 'Basic tee', price: 0 },
    { id: 'uniform', name: 'Uniform', price: 0 },
    { id: 'knit', name: 'Knit', price: 300 },
    { id: 'street', name: 'Street', price: 300 },
    { id: 'summer', name: 'Summer', price: 300 },
    { id: 'cute', name: 'Cute', price: 400 },
    { id: 'pajamas', name: 'Pajamas', price: 400 },
    { id: 'hanbok', name: 'Hanbok', price: 0, goal: { key: 'streak_days', target: 7, label: 'Study 7 days in a row', short: 'Streak 7' } },
    { id: 'barista', name: 'Barista', price: 0, goal: { key: 'saved_words', target: 100, label: 'Save 100 words', short: '100 words' } },
    { id: 'halloween', name: 'Halloween', price: 350, months: [10], season: 'October' },
    { id: 'hijab', name: 'Hijab', price: 0 },
    { id: 'hijab-sport', name: 'Sport hijab', price: 0 },
    { id: 'cowboy', name: 'Cowboy', price: 400 },
    { id: 'aodai', name: 'Ao dai', price: 400 },
    { id: 'chef', name: 'Chef', price: 350 },
    { id: 'taekwondo', name: 'Taekwondo', price: 0, goal: { key: 'games_played', target: 20, label: 'Finish 20 games', short: '20 games' } },
    { id: 'graduation', name: 'Graduation', price: 0, goal: { key: 'articles_read', target: 30, label: 'Read 30 articles', short: '30 articles' } },
    { id: 'padding', name: 'Winter padding', price: 350, months: [11, 12, 1, 2], season: 'Nov–Feb' },
    { id: 'christmas', name: 'Christmas', price: 350, months: [12], season: 'December' }
  ];
  // slot: one item per slot. top = band / crown on top of the head,
  // pinr / pinl = clip on the right / left side, face = glasses.
  var ACCS = [
    { id: 'headband', name: 'Bow headband', price: 0, slot: 'top' },
    { id: 'black-bow', name: 'Black bow', price: 0, slot: 'top' },
    { id: 'catears', name: 'Cat ears', price: 200, slot: 'top' },
    { id: 'flower-crown', name: 'Flower crown', price: 220, slot: 'top' },
    { id: 'bow', name: 'Red bow', price: 150, slot: 'pinr' },
    { id: 'sakura-pin', name: 'Sakura pin', price: 150, slot: 'pinr' },
    { id: 'bunny-clip', name: 'Bunny clip', price: 120, slot: 'pinr' },
    { id: 'bear-clip', name: 'Bear clip', price: 0, slot: 'pinl' },
    { id: 'sunglasses', name: 'Sunglasses', price: 150, slot: 'face' },
    { id: 'heart-glasses', name: 'Heart glasses', price: 0, slot: 'face', goal: { key: 'topik_tests', target: 1, label: 'Finish one TOPIK practice test', short: 'TOPIK' } }
  ];
  // Room theme pictures (assets/room/themes/<id>.webp, 1000x900). 'classic'
  // is the room as it was before themes: the wallpaper + floor you picked.
  var ROOMS = [
    { id: 'classic', name: 'Classic', price: 0, classic: true },
    { id: 'default', name: 'Default', price: 0 },
    { id: 'classroom', name: 'Classroom', price: 0 },
    { id: 'cafe', name: 'Cafe', price: 800 },
    { id: 'seoul-night', name: 'Seoul night', price: 800 },
    { id: 'winter', name: 'Winter', price: 900, months: [12, 1, 2], season: 'Dec–Feb' },
    { id: 'kpop-studio', name: 'K-pop studio', price: 1200 },
    { id: 'attic', name: 'Starry attic', price: 0, goal: { key: 'streak_days', target: 30, label: 'Study 30 days in a row', short: 'Streak 30' } }
  ];
  var KIND_PREFIX = { outfit: 'av_outfit_', acc: 'av_acc_', room: 'av_room_' };
  function serverId(kind, id) { return KIND_PREFIX[kind] + id; }
  function list(kind) { return kind === 'outfit' ? OUTFITS : kind === 'acc' ? ACCS : kind === 'room' ? ROOMS : HAIRS; }
  function find(kind, id) { var l = list(kind); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
  function isFree(it) { return !!it && !it.goal && !(Number(it.price) > 0); }
  function kstMonth() { return new Date(Date.now() + 9 * 3600000).getUTCMonth() + 1; }
  function inSeason(it) { return !it || !it.months || it.months.indexOf(kstMonth()) !== -1; }

  // Prices / seasons / goals from avatar_items when the table exists, so an
  // admin price change shows up without a deploy. Missing table = constants.
  var _catP = null;
  function loadCatalog() {
    if (_catP) return _catP;
    var sb = (typeof getSupa === 'function') ? getSupa() : null;
    if (!sb) return Promise.resolve(false);
    _catP = sb.from('avatar_items').select('id, kind, price_nyang, sale_months, unlock_goal_key, unlock_goal_target, unlock_label, active')
      .then(function (r) {
        if (!r || r.error || !Array.isArray(r.data)) return false;
        r.data.forEach(function (row) {
          var m = /^av_(outfit|acc|room)_(.+)$/.exec(row.id || '');
          if (!m) return;
          var it = find(m[1], m[2]);
          if (!it) return;
          it.price = Number(row.price_nyang) || 0;
          it.months = (Array.isArray(row.sale_months) && row.sale_months.length) ? row.sale_months.map(Number) : null;
          if (!it.months) it.season = null;
          if (row.unlock_goal_key) {
            it.goal = it.goal || {};
            it.goal.key = row.unlock_goal_key;
            it.goal.target = Number(row.unlock_goal_target) || 1;
            if (row.unlock_label) it.goal.label = row.unlock_label;
          } else {
            it.goal = null;
          }
          it.inactive = row.active === false;
        });
        return true;
      }, function () { _catP = null; return false; });
    return _catP;
  }

  // ── Sprite metrics: w, h, eye cx, eye cy, face scale, hair top, hair left, hair right
  var SPRITE = {
    'base-bob': [172, 368, 85.0, 107.0, 1.00, 0, 22, 149],
    'base-curly': [172, 378, 85.0, 116.0, 1.00, 0, 20, 168],
    'base-long': [176, 368, 88.0, 107.0, 1.00, 0, 26, 154],
    'base-short': [162, 378, 78.0, 116.0, 1.00, 0, 9, 153],
    'bob-barista': [165, 370, 81.5, 101.8, 0.97, 0, 20, 144],
    'bob-cute': [161, 374, 78.0, 111.9, 0.94, 0, 16, 144],
    'bob-halloween': [178, 366, 93.1, 104.8, 0.97, 0, 33, 156],
    'bob-hanbok': [165, 374, 80.5, 111.5, 0.97, 0, 24, 145],
    'bob-knit': [165, 367, 80.5, 99.9, 0.97, 0, 20, 144],
    'bob-pajamas': [165, 363, 79.5, 102.8, 0.97, 0, 20, 144],
    'bob-street': [158, 370, 76.1, 110.0, 0.94, 0, 12, 141],
    'bob-summer': [164, 362, 79.5, 101.8, 0.97, 0, 20, 143],
    'bob-uniform': [164, 368, 80.5, 99.9, 0.97, 0, 20, 143],
    'curly-barista': [163, 378, 79.9, 112.8, 0.94, 0, 17, 155],
    'curly-cute': [160, 372, 77.1, 112.8, 0.94, 0, 14, 146],
    'curly-halloween': [176, 372, 83.7, 110.9, 0.94, 0, 22, 160],
    'curly-hanbok': [163, 373, 79.9, 112.8, 0.94, 0, 18, 150],
    'curly-knit': [162, 378, 78.0, 112.8, 0.94, 0, 17, 153],
    'curly-pajamas': [163, 372, 79.9, 111.9, 0.94, 0, 18, 155],
    'curly-street': [159, 373, 76.1, 113.7, 0.94, 0, 13, 145],
    'curly-summer': [163, 372, 79.0, 111.9, 0.94, 0, 18, 154],
    'curly-uniform': [160, 378, 78.0, 111.9, 0.94, 0, 15, 153],
    'long-barista': [176, 368, 88.0, 107.0, 1.00, 0, 25, 154],
    'long-cute': [178, 374, 92.1, 113.7, 0.94, 3, 37, 148],
    'long-halloween': [198, 396, 101.5, 137.2, 0.94, 0, 17, 131],
    'long-hanbok': [175, 368, 88.0, 107.0, 1.00, 0, 25, 154],
    'long-knit': [176, 368, 88.0, 107.0, 1.00, 0, 26, 155],
    'long-pajamas': [182, 374, 95.1, 115.4, 0.97, 0, 39, 150],
    'long-street': [174, 366, 88.4, 106.2, 0.94, 0, 30, 148],
    'long-summer': [182, 370, 94.1, 111.5, 0.97, 0, 34, 172],
    'long-uniform': [177, 368, 87.0, 107.0, 1.00, 0, 25, 154],
    'short-barista': [161, 378, 76.0, 112.0, 1.00, 0, 12, 155],
    'short-cute': [156, 376, 77.1, 115.6, 0.94, 0, 7, 144],
    'short-halloween': [178, 372, 94.9, 110.9, 0.94, 0, 29, 164],
    'short-hanbok': [168, 378, 83.0, 112.0, 1.00, 0, 18, 161],
    'short-knit': [159, 378, 76.0, 112.0, 1.00, 0, 10, 153],
    'short-pajamas': [156, 372, 77.1, 111.9, 0.94, 0, 11, 146],
    'short-street': [156, 376, 77.1, 114.7, 0.94, 0, 9, 144],
    'short-summer': [156, 372, 76.1, 111.9, 0.94, 0, 11, 145],
    'short-uniform': [157, 378, 75.0, 112.0, 1.00, 0, 10, 151],
    // 2026-10-31 sheets A / B / D (cut by template matching, face scale 1.0)
    'bob-aodai': [182, 362, 90.0, 110.0, 1.00, 0, 26, 160],
    'bob-chef': [183, 367, 90.0, 158.0, 1.00, 0, 7, 178],
    'bob-christmas': [231, 378, 106.0, 136.0, 1.00, 0, 43, 184],
    'bob-cowboy': [202, 372, 98.0, 128.0, 1.00, 0, 4, 197],
    'bob-graduation': [196, 365, 88.0, 144.0, 1.00, 0, 12, 187],
    'bob-hijab': [181, 359, 88.0, 102.0, 1.00, 0, 22, 156],
    'bob-hijab-sport': [184, 366, 92.0, 98.0, 1.00, 0, 26, 158],
    'bob-padding': [187, 359, 90.0, 110.0, 1.00, 0, 25, 162],
    'bob-taekwondo': [183, 357, 90.0, 110.0, 1.00, 0, 25, 160],
    'curly-aodai': [193, 374, 94.0, 120.0, 1.00, 0, 16, 180],
    'curly-chef': [190, 363, 92.0, 156.0, 1.00, 0, 12, 182],
    'curly-christmas': [226, 382, 100.0, 140.0, 1.00, 0, 37, 182],
    'curly-cowboy': [204, 369, 98.0, 126.0, 1.00, 0, 4, 199],
    'curly-graduation': [200, 369, 92.0, 148.0, 1.00, 0, 14, 192],
    'curly-hijab': [182, 366, 90.0, 106.0, 1.00, 0, 25, 157],
    'curly-hijab-sport': [182, 366, 90.0, 98.0, 1.00, 0, 25, 156],
    'curly-padding': [195, 369, 94.0, 118.0, 1.00, 0, 17, 183],
    'curly-taekwondo': [191, 361, 94.0, 118.0, 1.00, 0, 17, 178],
    'long-aodai': [188, 365, 94.0, 110.0, 1.00, 0, 28, 162],
    'long-chef': [185, 363, 92.0, 154.0, 1.00, 0, 10, 178],
    'long-christmas': [217, 375, 100.0, 130.0, 1.00, 0, 34, 172],
    'long-cowboy': [194, 369, 94.0, 124.0, 1.00, 0, 3, 191],
    'long-graduation': [196, 365, 94.0, 142.0, 1.00, 0, 12, 189],
    'long-hijab': [182, 362, 90.0, 104.0, 1.00, 0, 24, 157],
    'long-hijab-sport': [182, 365, 90.0, 98.0, 1.00, 0, 25, 157],
    'long-padding': [193, 362, 94.0, 112.0, 1.00, 0, 30, 162],
    'long-taekwondo': [187, 358, 94.0, 110.0, 1.00, 0, 27, 163],
    'short-aodai': [173, 371, 82.0, 118.0, 1.00, 0, 12, 161],
    'short-chef': [173, 363, 82.0, 156.0, 1.00, 0, 2, 171],
    'short-christmas': [225, 382, 100.0, 140.0, 1.00, 0, 36, 177],
    'short-cowboy': [197, 369, 96.0, 126.0, 1.00, 0, 2, 194],
    'short-graduation': [196, 365, 90.0, 146.0, 1.00, 0, 12, 187],
    'short-hijab': [182, 360, 90.0, 102.0, 1.00, 0, 24, 157],
    'short-hijab-sport': [182, 366, 92.0, 98.0, 1.00, 0, 26, 159],
    'short-padding': [189, 366, 94.0, 118.0, 1.00, 0, 24, 174],
    'short-taekwondo': [175, 360, 82.0, 116.0, 1.00, 0, 12, 161]
  };
  // Sprites with headwear drawn in (cap, beret, cat ears, flower pin, straw
  // hat, heart glasses on the head, pajama headband, witch hat, red hood):
  // head accessories are hidden on them. Sprites with glasses drawn in hide
  // face accessories. (Checked by eye on every sprite, 2026-10-30.)
  var HEADWEAR = { 'long-street': 1, 'bob-street': 1, 'long-cute': 1, 'bob-cute': 1, 'bob-hanbok': 1, 'long-summer': 1,
    'bob-summer': 1, 'long-pajamas': 1, 'bob-pajamas': 1, 'long-halloween': 1, 'bob-halloween': 1 };
  // Hats / hijabs / hood drawn on every hair of these outfits.
  ['cowboy', 'hijab', 'hijab-sport', 'chef', 'christmas', 'graduation'].forEach(function (o) {
    HAIRS.forEach(function (h) { HEADWEAR[h.id + '-' + o] = 1; });
  });
  var GLASSES = { 'bob-summer': 1, 'curly-uniform': 1 };
  // Accessory anchors on base-long: centre x, y, drawn width, y mode
  // (bottom = sprite bottom at y, centre = sprite centre at y), reference
  // (face = eyes, hair = hair top / edges). Cat ears and sakura pin moved
  // from the README values (2026-10-30): the band floated above the hair,
  // the pin stuck out past the hair edge.
  var ANCHOR = {
    'catears': [90, 66, 132, 'bottom', 'hair'],
    'headband': [90, 92, 146, 'bottom', 'hair'],
    'flower-crown': [90, 32, 140, 'centre', 'hair'],
    'black-bow': [90, 20, 75, 'centre', 'hair'],
    'bow': [135, 35, 55, 'centre', 'hair'],
    'sakura-pin': [132, 50, 60, 'centre', 'hair'],
    'bunny-clip': [131, 51, 44, 'centre', 'hair'],
    'bear-clip': [49, 51, 44, 'centre', 'hair'],
    'sunglasses': [89, 105, 108, 'centre', 'face'],
    'heart-glasses': [89, 106, 110, 'centre', 'face']
  };
  var CW = 220, CH = 430;   // composite canvas: feet on the bottom edge, room above the head for ears / bows

  function artUrl(path) { return (typeof khRoomImg === 'function') ? khRoomImg(path) : path; }
  function spriteName(hair, outfit) { return (!outfit || outfit === 'tee') ? 'base-' + hair : hair + '-' + outfit; }
  function spriteUrl(hair, outfit) { return artUrl('assets/avatar/' + spriteName(hair, outfit) + '.png'); }
  function accUrl(id) { return artUrl('assets/avatar/acc-' + id + '.png'); }
  function themeUrl(id) { return artUrl('assets/room/themes/' + id + '.webp'); }

  // ── State ──────────────────────────────────────────────────────────
  var DEFAULT_AVATAR = { hair: 'long', outfit: 'tee', acc: [], profile: false };
  function cleanAvatar(a) {
    a = (a && typeof a === 'object') ? a : {};
    var hair = find('hair', a.hair) ? a.hair : 'long';
    var outfit = find('outfit', a.outfit) ? a.outfit : 'tee';
    var seen = {}, acc = [];
    (Array.isArray(a.acc) ? a.acc : []).forEach(function (id) {
      var it = find('acc', id);
      if (!it || seen[it.slot]) return;
      seen[it.slot] = 1;
      acc.push(it.id);
    });
    return { hair: hair, outfit: outfit, acc: acc, profile: a.profile === true };
  }
  var MAX_ROOMS = 5;
  function cleanName(n, i) {
    var t = String(n == null ? '' : n).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40);
    return t || (i === 0 ? 'My Room' : 'Room ' + (i + 1));
  }
  function cleanRooms(rooms) {
    var out = [], seen = {};
    (Array.isArray(rooms) ? rooms : []).slice(0, 12).forEach(function (r) {
      if (!r || typeof r !== 'object') return;
      var i = out.length;
      var id = i === 0 ? 'main' : String(r.id || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
      if (!id || seen[id]) return;
      seen[id] = 1;
      out.push({ id: id, name: cleanName(r.name, i), theme: find('room', r.theme) ? r.theme : 'classic' });
    });
    if (!out.length) out.push({ id: 'main', name: 'My Room', theme: 'classic' });
    return out;
  }
  function lsGet() { try { var v = JSON.parse(localStorage.getItem(NS) || 'null'); return (v && typeof v === 'object') ? v : null; } catch (_) { return null; } }
  function lsSet(v) { try { localStorage.setItem(NS, JSON.stringify(v)); } catch (_) {} }
  // avatar: null until the learner saves a character once (nothing shown before).
  var S = (function () {
    var v = lsGet() || {};
    return { avatar: v.avatar ? cleanAvatar(v.avatar) : null, rooms: cleanRooms(v.rooms),
             current: typeof v.current === 'string' ? v.current : 'main',
             allowed: Math.max(1, Math.min(MAX_ROOMS, Number(v.allowed) || 1)) };
  })();
  function persist() { lsSet({ avatar: S.avatar, rooms: S.rooms, current: S.current, allowed: S.allowed }); }

  // ── Rooms (several per learner) ────────────────────────────────────
  function visibleRooms() { return S.rooms.slice(0, Math.max(1, S.allowed)); }
  function currentRoom() {
    var v = visibleRooms();
    for (var i = 0; i < v.length; i++) if (v[i].id === S.current) return v[i];
    return v[0];
  }
  function roomById(id) { for (var i = 0; i < S.rooms.length; i++) if (S.rooms[i].id === id) return S.rooms[i]; return null; }
  // Which room a layout entry stands in (no / unknown room = rooms[0]).
  function roomIdOf(e) { return (e && e.room && roomById(e.room)) ? e.room : S.rooms[0].id; }
  function viewLayout(all) {
    var cur = currentRoom().id;
    return (Array.isArray(all) ? all : []).filter(function (e) { return e && roomIdOf(e) === cur; });
  }
  // The current room's new entries replace its old ones; an item placed here
  // leaves whatever room it stood in before (one room at a time).
  function mergeLayout(all, arr) {
    var cur = currentRoom().id, main = S.rooms[0].id, ids = {};
    arr = Array.isArray(arr) ? arr : [];
    arr.forEach(function (e) { if (e && e.id) ids[e.id] = 1; });
    var others = (Array.isArray(all) ? all : []).filter(function (e) { return e && roomIdOf(e) !== cur && !ids[e.id]; });
    var mine = arr.filter(function (e) { return e && e.id; }).map(function (e) {
      var o = {}; Object.keys(e).forEach(function (k) { o[k] = e[k]; });
      if (cur === main) delete o.room; else o.room = cur;
      return o;
    });
    return others.concat(mine);
  }
  function whereIs(itemId, all) {
    var list = Array.isArray(all) ? all : [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === itemId) return roomById(roomIdOf(list[i]));
    return null;
  }
  function layoutAll() { return (typeof _getRoomLayoutAll === 'function') ? _getRoomLayoutAll() : []; }
  function setLayoutAll(a) { if (typeof _setRoomLayoutAll === 'function') _setRoomLayoutAll(a); }
  // Move a placed item (or the character) into a room, keeping its spot.
  function moveTo(itemId, roomId) {
    var all = layoutAll(), main = S.rooms[0].id, hit = false;
    all.forEach(function (e) {
      if (e && e.id === itemId && !hit) { hit = true; if (roomId === main) delete e.room; else e.room = roomId; }
    });
    if (hit) setLayoutAll(all);
    return hit;
  }
  function newRoomId() {
    var id;
    do { id = 'r' + Date.now().toString(36).slice(-5) + Math.floor(Math.random() * 1296).toString(36); } while (roomById(id));
    return id;
  }

  // ── Images + compositing ───────────────────────────────────────────
  var _img = {};
  function loadImg(url) {
    if (_img[url]) return _img[url];
    _img[url] = new Promise(function (resolve) {
      var im = new Image();
      im.decoding = 'async';
      im.onload = function () { resolve(im.naturalWidth ? im : null); };
      im.onerror = function () { delete _img[url]; resolve(null); };
      im.src = url;
    });
    return _img[url];
  }
  // Which accessories are drawn on this sprite (headwear / drawn glasses hide them).
  function visibleAcc(av) {
    var sp = spriteName(av.hair, av.outfit);
    return (av.acc || []).filter(function (id) {
      var it = find('acc', id);
      if (!it) return false;
      if (it.slot === 'face') return !GLASSES[sp];
      return !HEADWEAR[sp];
    });
  }
  function hidesHead(av) { return !!HEADWEAR[spriteName(av.hair, av.outfit)]; }
  function hidesFace(av) { return !!GLASSES[spriteName(av.hair, av.outfit)]; }

  function accBox(sp, id, natW, natH) {
    var m = SPRITE[sp] || SPRITE['base-long'], B = SPRITE['base-long'];
    var a = ANCHOR[id];
    var k, cx, cy;
    if (a[4] === 'face') {
      k = m[4];
      cx = m[2] + (a[0] - B[2]) * k;
      cy = m[3] + (a[1] - B[3]) * k;
    } else {
      k = (m[7] - m[6]) / (B[7] - B[6]);
      cx = (m[6] + m[7]) / 2 + (a[0] - (B[6] + B[7]) / 2) * k;
      cy = m[5] + (a[1] - B[5]) * k;
    }
    var w = a[2] * k, h = natH * w / natW;
    return { x: cx - w / 2, y: a[3] === 'bottom' ? cy - h : cy - h / 2, w: w, h: h };
  }

  // compose(av) → Promise<canvas CW x CH | null>
  function compose(av) {
    av = cleanAvatar(av);
    var sp = spriteName(av.hair, av.outfit);
    var accs = visibleAcc(av);
    return Promise.all([loadImg(spriteUrl(av.hair, av.outfit))].concat(accs.map(function (id) { return loadImg(accUrl(id)); })))
      .then(function (imgs) {
        var body = imgs[0];
        if (!body) return null;
        var c = document.createElement('canvas');
        c.width = CW; c.height = CH;
        var g = c.getContext('2d');
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        var ox = Math.round((CW - body.naturalWidth) / 2), oy = CH - body.naturalHeight;
        g.drawImage(body, ox, oy);
        accs.forEach(function (id, i) {
          var im = imgs[i + 1];
          if (!im) return;
          var b = accBox(sp, id, im.naturalWidth, im.naturalHeight);
          g.drawImage(im, ox + b.x, oy + b.y, b.w, b.h);
        });
        c._kh = { ox: ox, oy: oy, sp: sp };
        return c;
      });
  }
  function canvasUrl(c) {
    return new Promise(function (resolve) {
      if (!c) return resolve(null);
      try {
        if (c.toBlob) c.toBlob(function (b) { resolve(b ? URL.createObjectURL(b) : c.toDataURL('image/png')); }, 'image/png');
        else resolve(c.toDataURL('image/png'));
      } catch (_) { resolve(null); }
    });
  }
  // Square head-and-shoulders crop around the eyes (profile circle / hair tiles).
  function faceCanvas(av, size) {
    size = size || 160;
    return compose(av).then(function (c) {
      if (!c) return null;
      var m = SPRITE[c._kh.sp] || SPRITE['base-long'];
      var side = 150 * m[4];
      var sx = c._kh.ox + m[2] - side / 2, sy = c._kh.oy + m[3] - 30 * m[4] - side / 2;
      var f = document.createElement('canvas');
      f.width = size; f.height = size;
      var g = f.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(c, sx, sy, side, side, 0, 0, size, size);
      return f;
    });
  }
  var _faceCache = {};
  function faceUrl(av, size) {
    var key = JSON.stringify(cleanAvatar(av)) + ':' + (size || 160);
    if (!_faceCache[key]) {
      _faceCache[key] = faceCanvas(av, size).then(function (f) {
        try { return f ? f.toDataURL('image/png') : null; } catch (_) { return null; }
      });
    }
    return _faceCache[key];
  }

  // ── The character as a room piece ──────────────────────────────────
  var AV_ID = 'kh_avatar', AV_SIZE = 150;
  // Default spot: centre of the room, feet on the floor (floor starts at 62 %).
  var AV_DEFAULT_PLACE = { id: AV_ID, x: 115, y: 140, scale: 100 };
  var AV_DEF = { id: AV_ID, name: 'My character', price: 0, img: '', size: AV_SIZE, effect: 'none', thumbnail: '', category: 'avatar' };
  var _defKey = '', _defUrl = '';
  function refreshDef() {
    if (!S.avatar) return Promise.resolve(false);
    var key = JSON.stringify(S.avatar);
    if (key === _defKey && AV_DEF.img) return Promise.resolve(false);
    _defKey = key;
    return compose(S.avatar).then(canvasUrl).then(function (u) {
      if (!u || key !== _defKey) return false;
      var old = _defUrl;
      _defUrl = u; AV_DEF.img = u;
      if (old && old.indexOf('blob:') === 0) setTimeout(function () { try { URL.revokeObjectURL(old); } catch (_) {} }, 3000);
      return true;
    });
  }
  // My Page hook (loadRoomItemsFromDB): add the character to the room catalogue.
  function ensureRoomItem(items) {
    if (!Array.isArray(items)) return;
    if (items.indexOf(AV_DEF) === -1) {
      for (var i = items.length - 1; i >= 0; i--) if (items[i] && items[i].id === AV_ID) items.splice(i, 1);
      if (S.avatar) items.push(AV_DEF);
      try { if (typeof window._roomItemsIndexSource !== 'undefined') window._roomItemsIndexSource = null; } catch (_) {}
    }
    refreshDef().then(function (changed) { if (changed) redrawRoom(); });
  }
  // Re-check the character in My Page's catalogue (after a server load / save).
  function syncRoomItem() {
    if (typeof ROOM_ITEMS !== 'undefined' && Array.isArray(ROOM_ITEMS)) ensureRoomItem(ROOM_ITEMS);
    else refreshDef();
  }
  function redrawRoom() {
    if (typeof renderRoomItems === 'function' && document.getElementById('miniroom-items')) {
      try { renderRoomItems(); } catch (_) {}
    }
  }
  // For room-view.js (someone's room, read-only): a copy of the catalogue
  // with their character in it.
  var _viewDefs = {};
  function withRoomItem(items, avatar) {
    var av = cleanAvatar(avatar), key = JSON.stringify(av);
    if (!_viewDefs[key]) _viewDefs[key] = compose(av).then(canvasUrl);
    return _viewDefs[key].then(function (u) {
      var out = {};
      Object.keys(items || {}).forEach(function (k) { out[k] = items[k]; });
      if (u) out[AV_ID] = { id: AV_ID, name: 'Character', img: u, size: AV_SIZE, price: 0, effect: 'none', category: 'avatar' };
      return out;
    });
  }

  // ── Room background ────────────────────────────────────────────────
  // Picture theme → it replaces the wallpaper + floor; 'classic' → leave the
  // wallpaper / floor the page already drew.
  function applyThemeBg(host, theme, floorEl) {
    if (!host) return false;
    var it = find('room', theme);
    if (!it || it.classic) return false;
    host.style.background = 'url("' + themeUrl(it.id) + '") center / cover no-repeat';
    if (floorEl) floorEl.style.opacity = '0';
    return true;
  }
  // My Page hook (end of _applyRoomTheme).
  function applyRoomTheme() {
    var room = document.getElementById('miniroom-container');
    var pic = applyThemeBg(room, currentRoom().theme, document.getElementById('room-floor-layer'));
    // The wallpaper / floor drawer only matters for the Classic room.
    var btn = document.getElementById('room-theme-btn');
    if (btn) btn.style.display = pic ? 'none' : '';
    var drawer = document.getElementById('room-theme-drawer');
    if (drawer && pic) drawer.classList.remove('open');
  }

  // ── Prefs sync (My Page hooks) ─────────────────────────────────────
  function extendPrefs(out) {
    if (!out || typeof out !== 'object') return out;
    out.rooms = S.rooms.map(function (r) { return { id: r.id, name: r.name, theme: r.theme }; });   // hidden rooms too: never deleted
    if (S.avatar) out.avatar = { hair: S.avatar.hair, outfit: S.avatar.outfit, acc: S.avatar.acc.slice(0, 6), profile: !!S.avatar.profile };
    return out;
  }
  function applyServerPrefs(p) {
    if (!p || typeof p !== 'object') return;
    var changed = false;
    if (p.avatar && typeof p.avatar === 'object') { S.avatar = cleanAvatar(p.avatar); changed = true; }
    if (Array.isArray(p.rooms) && p.rooms.length) { S.rooms = cleanRooms(p.rooms); changed = true; }
    if (changed) {
      persist();
      if (window.khAvatar) { applyProfile(); syncRoomItem(); }
    }
  }

  // ── Profile picture (My Page hero) ─────────────────────────────────
  var _heroObs = null;
  function applyProfile() {
    var wrap = document.querySelector('.mp-avatar-wrap');
    if (!wrap) return;
    var on = !!(S.avatar && S.avatar.profile);
    var mine = wrap.querySelector('img.kh-av-face');
    var others = wrap.querySelectorAll('.mp-initials, .mp-avatar-img');
    if (!on) {
      if (mine) mine.remove();
      Array.prototype.forEach.call(others, function (el) { if (el.dataset.khAvHidden) { el.style.display = ''; delete el.dataset.khAvHidden; } });
      return;
    }
    Array.prototype.forEach.call(others, function (el) { if (el.style.display !== 'none') { el.style.display = 'none'; el.dataset.khAvHidden = '1'; } });
    if (!mine) {
      mine = document.createElement('img');
      mine.className = 'kh-av-face';
      mine.alt = '';
      var frame = wrap.querySelector('.mp-avatar-frame');
      if (frame && frame.nextSibling) wrap.insertBefore(mine, frame.nextSibling); else wrap.insertBefore(mine, wrap.firstChild);
    }
    faceUrl(S.avatar, 160).then(function (u) { if (u && mine.getAttribute('src') !== u) mine.src = u; });
    if (!_heroObs && window.MutationObserver) {
      // My Page swaps the photo / initials element after loading; keep it hidden.
      _heroObs = new MutationObserver(function () { if (S.avatar && S.avatar.profile) applyProfile(); });
      _heroObs.observe(wrap, { childList: true });
    }
  }
  // Someone else's header (profile page): put their face into el.
  function setFace(el, avatar) {
    if (!el || !avatar) return;
    faceUrl(avatar, 160).then(function (u) {
      if (!u) return;
      el.textContent = '';
      el.classList.add('kh-av-face-host');
      var im = document.createElement('img');
      im.src = u; im.alt = '';
      im.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;background:#fff';
      el.appendChild(im);
    });
  }

  function ensureStyle() {
    if (document.getElementById('kh-av-art-style')) return;
    var st = document.createElement('style');
    st.id = 'kh-av-art-style';
    st.textContent = '.kh-av-face{width:76px;height:76px;border-radius:50%;border:2px solid rgba(255,255,255,.3);object-fit:cover;display:block;background:#f8fafc;position:relative;z-index:1}'
      + '@media(max-width:600px){.kh-av-face{width:60px;height:60px}}'
      + '.kh-av-face-host{overflow:hidden;padding:0}'
      + '#mp-miniroom-section #room-customize-btn{background:rgba(255,255,255,.08)!important;border-color:rgba(255,255,255,.14)!important;color:#e2e8f0!important}';
    (document.head || document.documentElement).appendChild(st);
  }
  ensureStyle();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { applyProfile(); });
  else setTimeout(applyProfile, 0);

  window.khAvatar = {
    HAIRS: HAIRS, OUTFITS: OUTFITS, ACCS: ACCS, ROOMS: ROOMS, SPRITE: SPRITE, ANCHOR: ANCHOR,
    AV_ID: AV_ID, AV_DEFAULT_PLACE: AV_DEFAULT_PLACE, CW: CW, CH: CH,
    find: find, list: list, serverId: serverId, isFree: isFree, inSeason: inSeason, kstMonth: kstMonth,
    loadCatalog: loadCatalog, cleanAvatar: cleanAvatar, DEFAULT_AVATAR: DEFAULT_AVATAR,
    spriteName: spriteName, spriteUrl: spriteUrl, accUrl: accUrl, themeUrl: themeUrl,
    visibleAcc: visibleAcc, hidesHead: hidesHead, hidesFace: hidesFace,
    compose: compose, canvasUrl: canvasUrl, faceCanvas: faceCanvas, faceUrl: faceUrl,
    // state
    getAvatar: function () { return S.avatar ? cleanAvatar(S.avatar) : null; },
    getRooms: function () { return cleanRooms(S.rooms); },
    getRoomTheme: function () { return currentRoom().theme; },
    save: function (avatar, theme) {
      S.avatar = cleanAvatar(avatar);
      if (theme && find('room', theme)) currentRoom().theme = theme;
      persist();
      applyProfile();
      if (typeof ROOM_ITEMS !== 'undefined' && Array.isArray(ROOM_ITEMS) && ROOM_ITEMS.indexOf(AV_DEF) === -1) ROOM_ITEMS.push(AV_DEF);
      try { if (typeof window._roomItemsIndexSource !== 'undefined') window._roomItemsIndexSource = null; } catch (_) {}
      return refreshDef();
    },
    // rooms
    MAX_ROOMS: MAX_ROOMS, visibleRooms: function () { return visibleRooms().map(function (r) { return { id: r.id, name: r.name, theme: r.theme }; }); },
    allRooms: function () { return S.rooms.map(function (r) { return { id: r.id, name: r.name, theme: r.theme }; }); },
    currentRoom: function () { var r = currentRoom(); return { id: r.id, name: r.name, theme: r.theme }; },
    setCurrent: function (id) { if (roomById(id)) { S.current = id; persist(); } },
    setAllowed: function (n) { n = Math.max(1, Math.min(MAX_ROOMS, Number(n) || 1)); if (n !== S.allowed) { S.allowed = n; persist(); } },
    getAllowed: function () { return S.allowed; },
    addRoom: function (name, theme) {
      var r = { id: newRoomId(), name: cleanName(name, S.rooms.length), theme: find('room', theme) ? theme : 'classic' };
      S.rooms.push(r); persist(); return r.id;
    },
    updateRoom: function (id, name, theme) {
      var r = roomById(id); if (!r) return false;
      var i = S.rooms.indexOf(r);
      if (name != null) r.name = cleanName(name, i);
      if (theme && find('room', theme)) r.theme = theme;
      persist(); return true;
    },
    viewLayout: viewLayout, mergeLayout: mergeLayout, whereIs: whereIs, roomIdOf: roomIdOf, moveTo: moveTo,
    avatarRoom: function () { var r = whereIs(AV_ID, layoutAll()); return r ? r.id : null; },
    // hooks
    ensureRoomItem: ensureRoomItem, extendPrefs: extendPrefs, applyServerPrefs: applyServerPrefs,
    applyRoomTheme: applyRoomTheme, applyThemeBg: applyThemeBg, applyProfile: applyProfile,
    withRoomItem: withRoomItem, setFace: setFace
  };
})();
