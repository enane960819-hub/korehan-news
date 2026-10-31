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
    { id: 'christmas', name: 'Christmas', price: 350, months: [12], season: 'December' },
    { id: 'doctor', name: 'Doctor', price: 400 },
    { id: 'kpop', name: 'K-pop stage', price: 450 },
    { id: 'astronaut', name: 'Astronaut', price: 0, goal: { key: 'streak_days', target: 14, label: 'Study 14 days in a row', short: 'Streak 14' } }
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
    'bob-barista': [165, 371, 82.5, 102.2, 0.98, 0, 20, 144],
    'bob-cute': [165, 385, 80.5, 114.9, 0.96, 0, 16, 148],
    'bob-halloween': [181, 372, 93.9, 107.1, 0.94, 0, 34, 159],
    'bob-hanbok': [167, 379, 81.0, 113.7, 0.96, 0, 25, 146],
    'bob-knit': [166, 368, 81.1, 100.4, 0.96, 0, 20, 144],
    'bob-pajamas': [168, 369, 81.3, 104.5, 0.97, 0, 21, 146],
    'bob-street': [163, 383, 78.5, 113.8, 0.98, 0, 13, 146],
    'bob-summer': [167, 368, 82.1, 103.6, 0.98, 0, 21, 145],
    'bob-uniform': [165, 369, 80.3, 101.2, 0.96, 0, 20, 143],
    'curly-barista': [167, 388, 82.7, 116.2, 0.98, 0, 17, 159],
    'curly-cute': [166, 386, 79.9, 117.0, 0.97, 0, 15, 151],
    'curly-halloween': [182, 385, 87.3, 115.1, 0.99, 0, 22, 165],
    'curly-hanbok': [169, 387, 82.7, 118.2, 0.99, 0, 19, 156],
    'curly-knit': [166, 388, 80.8, 116.2, 0.98, 0, 17, 157],
    'curly-pajamas': [168, 385, 82.5, 116.0, 0.98, 0, 18, 161],
    'curly-street': [165, 387, 78.5, 118.7, 0.96, 0, 14, 150],
    'curly-summer': [169, 386, 82.1, 116.5, 0.96, 0, 19, 160],
    'curly-uniform': [164, 387, 79.7, 114.8, 0.97, 0, 15, 157],
    'long-barista': [176, 368, 87.4, 106.8, 0.97, 0, 25, 154],
    'long-cute': [183, 386, 94.2, 117.3, 0.96, 3, 38, 152],
    'long-halloween': [206, 410, 105.3, 142.3, 0.97, 0, 18, 135],
    'long-hanbok': [175, 368, 87.1, 106.9, 0.99, 0, 25, 154],
    'long-knit': [176, 368, 87.4, 106.8, 0.97, 0, 26, 155],
    'long-pajamas': [186, 382, 95.9, 117.5, 0.98, 0, 40, 153],
    'long-street': [180, 379, 91.7, 110.8, 0.95, 0, 31, 153],
    'long-summer': [186, 377, 96.1, 113.8, 0.98, 0, 35, 175],
    'long-uniform': [177, 368, 87.1, 106.9, 0.99, 0, 25, 154],
    'short-barista': [160, 375, 75.4, 111.2, 0.99, 0, 12, 154],
    'short-cute': [162, 390, 79.9, 120.8, 0.97, 0, 7, 149],
    'short-halloween': [184, 385, 98.2, 115.5, 0.96, 0, 30, 169],
    'short-hanbok': [167, 375, 83.1, 111.4, 1.01, 0, 18, 160],
    'short-knit': [158, 375, 75.0, 111.4, 1.01, 0, 10, 152],
    'short-pajamas': [162, 386, 80.3, 116.4, 1.00, 0, 12, 151],
    'short-street': [161, 389, 79.3, 118.9, 0.99, 0, 10, 149],
    'short-summer': [162, 385, 78.6, 116.0, 0.98, 0, 12, 150],
    'short-uniform': [156, 376, 74.8, 112.2, 0.98, 0, 10, 150],
    // 2026-10-31 sheets A / B / D (cut by template matching, face scale 1.0; re-cut with a full scale search)
    'bob-aodai': [183, 365, 90.3, 111.3, 1.05, 0, 25, 161],
    'bob-chef': [202, 405, 100.0, 175.1, 1.14, 0, 8, 197],
    'bob-christmas': [240, 393, 110.1, 141.3, 1.04, 0, 45, 191],
    'bob-cowboy': [209, 385, 101.5, 133.2, 1.06, 0, 4, 204],
    'bob-graduation': [209, 389, 95.2, 152.8, 1.11, 0, 8, 205],
    'bob-hijab': [180, 358, 87.2, 101.8, 1.04, 0, 21, 157],
    'bob-hijab-sport': [178, 354, 88.5, 94.6, 1.01, 0, 24, 154],
    'bob-padding': [189, 364, 90.9, 112.0, 1.06, 0, 25, 165],
    'bob-taekwondo': [186, 363, 92.0, 112.9, 1.05, 0, 25, 164],
    'curly-aodai': [191, 371, 93.5, 118.4, 1.04, 0, 18, 178],
    'curly-chef': [211, 403, 102.8, 173.6, 1.14, 0, 14, 202],
    'curly-christmas': [232, 392, 102.6, 144.5, 1.05, 0, 38, 187],
    'curly-cowboy': [212, 383, 101.8, 130.9, 1.04, 0, 4, 207],
    'curly-graduation': [213, 391, 98.1, 156.1, 1.11, 0, 11, 210],
    'curly-hijab': [179, 358, 88.4, 102.8, 1.03, 0, 23, 155],
    'curly-hijab-sport': [178, 359, 88.0, 96.0, 1.00, 0, 23, 153],
    'curly-padding': [195, 368, 94.3, 117.3, 1.05, 0, 18, 180],
    'curly-taekwondo': [194, 366, 95.7, 119.1, 1.06, 0, 18, 178],
    'long-aodai': [188, 366, 94.0, 110.4, 1.02, 0, 29, 163],
    'long-chef': [205, 403, 103.1, 170.3, 1.12, 0, 11, 197],
    'long-christmas': [222, 384, 102.2, 133.5, 1.04, 0, 35, 177],
    'long-cowboy': [198, 378, 96.0, 127.3, 1.04, 0, 2, 195],
    'long-graduation': [210, 390, 102.3, 152.3, 1.09, 0, 9, 205],
    'long-hijab': [180, 357, 88.3, 102.6, 1.03, 0, 23, 156],
    'long-hijab-sport': [178, 359, 89.2, 95.1, 0.99, 0, 24, 154],
    'long-padding': [194, 363, 96.0, 112.7, 1.04, 0, 29, 164],
    'long-taekwondo': [189, 360, 94.5, 110.9, 1.03, 0, 26, 164],
    'short-aodai': [173, 372, 82.6, 117.6, 1.03, 0, 10, 163],
    'short-chef': [192, 401, 92.5, 173.7, 1.13, 0, 2, 190],
    'short-christmas': [234, 397, 105.0, 144.9, 1.05, 0, 37, 184],
    'short-cowboy': [205, 384, 99.7, 131.5, 1.06, 0, 2, 202],
    'short-graduation': [211, 393, 97.6, 156.3, 1.09, 0, 10, 207],
    'short-hijab': [180, 356, 88.4, 100.7, 1.03, 0, 23, 157],
    'short-hijab-sport': [178, 359, 90.0, 96.0, 1.00, 0, 25, 156],
    'short-padding': [189, 367, 94.6, 117.8, 1.05, 0, 22, 177],
    'short-taekwondo': [178, 367, 83.9, 117.5, 1.05, 0, 10, 165],
    // 2026-10-31 sheet C
    'bob-astronaut': [206, 362, 111.9, 109.9, 1.04, 0, 47, 185],
    'bob-doctor': [180, 362, 89.0, 109.7, 1.03, 0, 25, 158],
    'bob-kpop': [180, 358, 88.8, 105.3, 1.03, 0, 25, 159],
    'curly-astronaut': [208, 368, 108.5, 116.8, 1.04, 0, 32, 192],
    'curly-doctor': [189, 368, 92.0, 117.1, 1.05, 0, 18, 172],
    'curly-kpop': [195, 361, 96.4, 111.0, 1.05, 0, 21, 180],
    'long-astronaut': [213, 362, 107.4, 111.5, 1.03, 0, 39, 180],
    'long-doctor': [191, 364, 96.0, 108.5, 1.04, 0, 31, 166],
    'long-kpop': [198, 358, 97.5, 105.8, 1.04, 0, 30, 170],
    'short-astronaut': [206, 371, 109.6, 117.9, 1.03, 0, 35, 190],
    'short-doctor': [173, 372, 82.6, 117.6, 1.03, 0, 10, 163],
    'short-kpop': [178, 365, 84.6, 111.5, 1.03, 0, 9, 168]
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


  // ── Room theme effects (owner, 2026-10-31) ─────────────────────────
  // Small, slow touches drawn on a canvas between the theme picture and the
  // items, in the picture's own 1000x900 pixels: a few city windows switch off
  // and on now and then, the N Seoul Tower beacon blinks, and snow falls only
  // inside the winter window panes. Nothing moves in the room itself. Off with
  // prefers-reduced-motion; paused while the room is off screen or the tab hidden.
  // Window boxes were measured from the pictures: [x0, y0, x1, y1, r, g, b of the dark wall around].
  var FX = {
    'seoul-night': { lights: [[548,275,553,281,83,74,90],[554,275,560,281,76,76,90],[554,291,560,294,92,76,97],[553,292,556,298,162,113,95],[555,293,560,299,106,77,96],[742,311,746,315,61,64,86],[548,312,554,316,133,104,103],[555,312,560,320,91,85,101],[576,315,582,319,75,65,71],[598,315,603,319,79,70,71],[609,315,617,319,88,70,76],[622,315,627,319,86,71,73],[632,315,637,319,88,73,79],[854,325,860,329,78,72,90],[548,333,554,342,90,81,98],[554,333,560,342,80,75,95],[854,343,859,348,92,88,106],[864,343,868,349,82,75,93],[938,349,945,354,147,94,72],[948,350,953,354,138,94,85],[548,352,553,360,86,78,90],[553,352,560,360,85,79,93],[946,355,953,360,129,84,80],[864,360,868,365,96,93,106],[735,362,743,368,77,64,71],[801,363,808,372,96,72,75],[808,363,815,373,77,65,74],[645,364,649,368,120,110,107],[745,364,751,372,106,78,72],[736,368,742,373,78,67,76],[937,368,945,375,98,68,73],[946,369,953,374,144,97,81],[576,373,585,378,90,72,81],[548,375,554,380,100,76,93],[553,375,560,382,85,75,91],[640,379,645,383,91,88,103],[645,380,652,386,80,74,86],[735,382,742,388,70,62,71],[809,382,816,392,73,63,74],[801,383,806,387,122,93,80],[745,384,750,391,79,63,69],[808,385,811,392,166,97,80],[736,387,742,392,74,63,71],[639,397,643,402,98,90,103],[576,398,580,406,75,72,76],[646,398,652,403,92,86,96],[548,401,553,409,92,79,92],[553,402,560,409,92,80,98],[855,402,862,408,173,101,100],[736,403,742,411,73,62,68],[862,403,865,412,183,123,104],[937,403,944,408,94,65,73],[801,404,807,413,72,63,71],[745,405,750,410,72,61,61],[946,405,953,412,117,86,71],[671,406,677,412,98,92,102],[679,407,683,412,102,92,97]], beacons: [[893, 114], [920, 182]] },
    'winter': { lights: [[719,283,722,301,159,92,59],[633,297,643,317,107,92,100],[617,298,623,305,82,77,90],[655,299,660,304,90,82,93],[655,307,660,315,91,83,89],[618,308,622,313,94,88,97],[649,309,653,314,107,97,103],[884,339,889,346,128,97,99],[891,339,897,346,114,91,99],[890,349,897,358,123,96,98],[884,350,889,356,149,110,96],[807,352,814,361,105,84,92],[815,352,823,361,104,87,94],[710,362,716,369,136,109,110],[577,363,582,367,100,86,97],[807,363,814,374,111,92,91],[815,363,823,374,112,96,97],[766,364,770,369,131,115,120],[568,370,574,378,111,99,104],[577,371,581,379,110,106,110]], panes: [[519, 28, 715, 198], [761, 28, 941, 198], [519, 220, 715, 413], [761, 220, 941, 413]] },
    'attic': { lights: [[505,249,508,261,86,53,57],[645,276,650,282,90,51,43],[639,280,648,293,90,52,44],[387,281,391,285,33,46,82],[505,303,508,312,97,55,52],[581,306,585,310,35,47,81],[598,306,602,310,35,49,85],[612,312,626,330,92,54,45],[425,313,430,319,35,48,85],[436,314,440,318,36,48,83],[425,322,430,327,39,54,94],[435,322,440,327,37,50,85],[472,329,477,335,41,50,79],[482,329,487,335,43,50,84],[605,329,610,333,91,53,45],[600,333,607,338,93,53,46],[521,335,526,341,37,50,86],[533,335,537,341,40,52,89],[559,335,563,339,39,53,91],[472,339,477,344,40,53,86],[481,339,487,345,39,52,87],[456,356,465,360,87,55,48],[463,358,474,362,85,55,49],[532,359,538,362,89,56,52],[526,360,533,363,90,57,54],[478,361,486,364,87,54,50],[486,362,493,365,86,52,49],[509,362,519,365,90,57,49]], beacons: [[605, 207]] }
  };
  var _fxRun = [];
  function fxStop(host) {
    if (!host || !host._khFx) return;
    host._khFx.dead = true;
    if (host._khFx.cv && host._khFx.cv.parentNode) host._khFx.cv.parentNode.removeChild(host._khFx.cv);
    if (host._khFx.io) host._khFx.io.disconnect();
    host._khFx = null;
  }
  function fxStart(host, theme) {
    fxStop(host);
    var cfg = FX[theme];
    if (!cfg || !host) return;
    try { if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (_) {}
    var cv = document.createElement('canvas');
    cv.className = 'kh-room-fx';
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0';
    host.insertBefore(cv, host.firstChild);
    var st = { cv: cv, dead: false, vis: true, t0: 0, last: 0, cfg: cfg, off: {}, flakes: [] };
    host._khFx = st;
    // Each light: 0 = lit, fading to 1 = off. Roughly one window changes every few seconds.
    (cfg.lights || []).forEach(function (l, i) { st.off[i] = { v: 0, to: 0 }; });
    (cfg.panes || []).forEach(function (p, pi) {
      var n = Math.round((p[2] - p[0]) * (p[3] - p[1]) / 2600);
      for (var k = 0; k < n; k++) st.flakes.push({ p: pi, x: p[0] + Math.random() * (p[2] - p[0]), y: p[1] + Math.random() * (p[3] - p[1]),
        s: Math.random() < 0.3 ? 4 : 3, v: 14 + Math.random() * 16, ph: Math.random() * 6.28, a: 0.55 + Math.random() * 0.4 });
    });
    if ('IntersectionObserver' in window) {
      st.io = new IntersectionObserver(function (es) { st.vis = es[0] && es[0].isIntersecting; if (st.vis) loop(); });
      st.io.observe(host);
    }
    var nextSwitch = 0;
    function loop(ts) {
      if (st.dead || !st.vis || document.hidden) { st.raf = 0; return; }
      if (st.raf && ts === undefined) return;
      st.raf = requestAnimationFrame(loop);
      if (ts === undefined) return;
      if (ts - st.last < 50) return;            // ~20 fps is plenty for slow effects
      var dt = st.last ? Math.min(0.2, (ts - st.last) / 1000) : 0.05;
      st.last = ts;
      if (!cv.isConnected) { st.dead = true; if (st.io) st.io.disconnect(); return; }   // room redrawn: a new effect owns the host
      var w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      var g = cv.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cv.width, cv.height);
      // background-size: cover of a 1000x900 picture
      var sc = Math.max(cv.width / 1000, cv.height / 900), ox = (cv.width - 1000 * sc) / 2, oy = (cv.height - 900 * sc) / 2;
      g.setTransform(sc, 0, 0, sc, ox, oy);
      var lights = cfg.lights || [];
      if (lights.length && ts > nextSwitch) {
        nextSwitch = ts + 2500 + Math.random() * 3500;
        var i = Math.floor(Math.random() * lights.length), o = st.off[i];
        var offNow = 0; Object.keys(st.off).forEach(function (k) { if (st.off[k].to) offNow++; });
        o.to = o.to ? 0 : (offNow < Math.ceil(lights.length * 0.15) ? 1 : 0);
      }
      lights.forEach(function (l, i) {
        var o = st.off[i];
        o.v += (o.to - o.v) * Math.min(1, dt * 1.6);
        if (o.v < 0.02) return;
        g.fillStyle = 'rgba(' + l[4] + ',' + l[5] + ',' + l[6] + ',' + (o.v * 0.92).toFixed(3) + ')';
        g.fillRect(l[0], l[1], l[2] - l[0], l[3] - l[1]);
      });
      (cfg.beacons || []).forEach(function (b, bi) {
        var ph = ((ts / 1000) + bi * 0.7) % 2.4;                    // on for 0.9 s every 2.4 s
        var a = ph < 0.9 ? Math.sin(ph / 0.9 * Math.PI) : 0;
        if (a < 0.02) return;
        var gr = g.createRadialGradient(b[0], b[1], 0, b[0], b[1], 9);
        gr.addColorStop(0, 'rgba(255,90,90,' + (0.95 * a).toFixed(3) + ')');
        gr.addColorStop(0.35, 'rgba(255,70,70,' + (0.45 * a).toFixed(3) + ')');
        gr.addColorStop(1, 'rgba(255,60,60,0)');
        g.fillStyle = gr; g.fillRect(b[0] - 9, b[1] - 9, 18, 18);
      });
      var panes = cfg.panes || [];
      if (panes.length) {
        var tsec = ts / 1000;
        st.flakes.forEach(function (f) {
          var p = panes[f.p];
          f.y += f.v * dt;
          if (f.y > p[3]) { f.y = p[1] - f.s; f.x = p[0] + Math.random() * (p[2] - p[0]); }
          var x = f.x + Math.sin(tsec * 0.8 + f.ph) * 4;
          if (x < p[0] || x + f.s > p[2] || f.y < p[1]) return;
          g.fillStyle = 'rgba(255,255,255,' + f.a.toFixed(2) + ')';
          g.fillRect(Math.round(x), Math.round(f.y), f.s, f.s);
        });
      }
    }
    if (!st.io) loop();
    if (!_fxRun.length) document.addEventListener('visibilitychange', function () {
      _fxRun.forEach(function (s) { if (!s.dead && !document.hidden && !s.raf) s.kick(); });
    });
    st.kick = function () { loop(); };
    _fxRun = _fxRun.filter(function (x) { return !x.dead; });
    _fxRun.push(st);
  }

  // ── Room background ────────────────────────────────────────────────
  // Picture theme → it replaces the wallpaper + floor; 'classic' → leave the
  // wallpaper / floor the page already drew.
  function applyThemeBg(host, theme, floorEl) {
    if (!host) return false;
    var it = find('room', theme);
    if (!it || it.classic) { fxStop(host); return false; }
    host.style.background = 'url("' + themeUrl(it.id) + '") center / cover no-repeat';
    if (floorEl) floorEl.style.opacity = '0';
    if (!host._khFx || host._khFx.theme !== it.id || !host._khFx.cv.isConnected) { fxStart(host, it.id); if (host._khFx) host._khFx.theme = it.id; }
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
