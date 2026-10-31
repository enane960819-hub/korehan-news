/* ============================================================
   KoreHani — Reporter page, Instagram style (owner-approved mockup 2026-10-31)

   korehan-reporter.html?id=cr5
   - Profile: story ring (lit when there is a post from the last 48 h), posts /
     followers / articles, fan profile (birthday, MBTI, symbol, likes),
     affinity (gifts), Follow / Gift / Bubble.
   - Highlights: post_type groups (daily, field, season, birthday, qa).
   - Tabs: Posts grid · Articles · Cards (photocards) · Goods (Special shop
     sets + real goods "Coming soon").
   - Post viewer = a small lesson: tap a word in the Korean caption to see it
     and save it, translation, vocab chips, a 1-minute quiz, comments in Korean.
   Data: reporter_posts (+ caption_en, vocab, quiz) / reporter_post_images
   (admin-write), reporter_follows, reporter_post_likes, comments
   (article_id 'rpost:<id>' through submit_comment), kh_reporter_feed_stats(),
   reporter_user_affinity + send_reporter_gift, goods_interest, cash_products.
   ============================================================ */
(function () {
  var AFF_MAX = 3000;
  var TYPES = { daily: ['Daily', 'coffee'], field: ['On the job', 'mic'], season: ['Season', 'snowflake'],
    birthday: ['Birthday', 'cake'], qa: ['Q&A', 'message-circle-question'], general: ['Posts', 'grid-3x3'] };
  var GIFT_ICON = { reporter_coffee: 'coffee', reporter_bubble_tea: 'cup-soda', reporter_flower: 'flower',
    reporter_tteokbokki: 'soup', reporter_hotteok: 'cookie', reporter_mandu: 'utensils-crossed', reporter_chimaek: 'drumstick',
    reporter_kimchi_jeon: 'egg-fried', reporter_korean_tea: 'leaf', reporter_postcard: 'mail', reporter_polaroid: 'camera' };
  var R = { id: '', r: null, posts: [], stats: { followers: 0, following: false, likes: {}, liked: [], comments: {} },
    aff: 0, arts: 0, tab: 'posts', filter: '', open: null, gifts: [], giftOwned: {}, nyang: 0, interest: false };

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ic(n) { return '<i data-lucide="' + n + '" aria-hidden="true"></i>'; }
  function icons() { if (typeof renderKhLucideIcons === 'function') { try { renderKhLucideIcons(); } catch (_) {} } }
  function sb() { return (typeof getSupa === 'function') ? getSupa() : null; }
  function me() { return (typeof supaUser !== 'undefined' && supaUser) ? supaUser : null; }
  function isAdmin() { return !!window._isAdmin || (typeof khNyangUnlimited === 'function' && khNyangUnlimited()); }
  function say(m, t) { if (typeof toast === 'function') toast(m, t); }
  function signIn() { if (typeof openAuthModal === 'function') openAuthModal('signin'); }
  function nf(n) { return Number(n || 0).toLocaleString(); }
  function ago(ts) {
    var d = new Date(ts); if (isNaN(d)) return '';
    var s = (Date.now() - d.getTime()) / 1000;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + 'm';
    if (s < 86400) return Math.round(s / 3600) + 'h';
    if (s < 86400 * 7) return Math.round(s / 86400) + 'd';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function handle() {
    var r = R.r, en = String(r.name_en || (typeof khReporterNameEn === 'function' ? khReporterNameEn(r) : '') || r.id);
    var parts = en.toLowerCase().replace(/[^a-z\s-]/g, '').trim().split(/\s+/);
    return 'kh.' + (parts.length > 1 ? parts.slice(1).join('') : parts[0]).replace(/-/g, '');
  }
  function bday(md) {
    var m = /^(\d\d)-(\d\d)$/.exec(md || ''); if (!m) return '';
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m[1]) - 1] + ' ' + Number(m[2]);
  }
  function affLevel(x) { return x >= AFF_MAX ? 'Manager' : x >= 200 ? 'Friend' : x >= 80 ? 'Acquaintance' : 'Stranger'; }

  // ── Load ─────────────────────────────────────────────────────────
  async function load() {
    var rid = new URLSearchParams(location.search).get('id');
    var root = document.getElementById('rp-root');
    if (!rid) { location.replace('korehan-reporters.html'); return; }
    R.id = rid;
    var c = sb();
    var row = c ? await c.from('character_reporters').select('data').eq('id', rid).maybeSingle().then(function (x) { return x && !x.error && x.data ? x.data.data : null; }, function () { return null; }) : null;
    if (!row || !row.name) {
      var b = (typeof KH_REPORTERS !== 'undefined') && KH_REPORTERS[rid];
      if (b) row = { name: b.name, role: b.role, image: b.img, color: b.color };
    }
    if (!row || !row.name) {
      root.innerHTML = '<div class="rp-nf"><h2>Reporter not found</h2><p><a href="korehan-reporters.html">See all reporters</a></p></div>';
      return;
    }
    row.id = rid;
    if (row.image && (/picsum\.photos/i.test(row.image) || /^data:image\/gif/.test(row.image))) row.image = '';
    if (!/^#[0-9a-f]{6}$/i.test(row.color || '')) row.color = '#2563eb';
    R.r = row;
    document.title = row.name + ' · Reporter — KoreHani';
    render();
    await Promise.all([loadPosts(), loadStats(), loadArticleCount(), loadAffinity()]);
    render();
    var pid = new URLSearchParams(location.search).get('post');
    if (pid) openPost(pid);
  }
  async function loadPosts() {
    var c = sb(); if (!c) return;
    var q = c.from('reporter_posts').select('*').eq('reporter_id', R.id)
      .order('pinned', { ascending: false }).order('created_at', { ascending: false });
    if (!isAdmin()) q = q.eq('status', 'published');
    var res = await q.then(function (x) { return x; }, function () { return { data: [] }; });
    var posts = (res && Array.isArray(res.data)) ? res.data : [];
    if (posts.length) {
      var ir = await c.from('reporter_post_images').select('post_id,image_url,sort_order').in('post_id', posts.map(function (p) { return p.id; }))
        .order('sort_order', { ascending: true }).then(function (x) { return x; }, function () { return { data: [] }; });
      var map = {};
      ((ir && ir.data) || []).forEach(function (im) { (map[im.post_id] = map[im.post_id] || []).push(im.image_url); });
      posts.forEach(function (p) { p.images = map[p.id] || []; p.vocab = Array.isArray(p.vocab) ? p.vocab : []; });
    }
    R.posts = posts;
  }
  async function loadStats() {
    var c = sb(); if (!c) return;
    var r = await c.rpc('kh_reporter_feed_stats', { p_reporter: R.id }).then(function (x) { return x; }, function () { return null; });
    if (r && !r.error && r.data) R.stats = Object.assign(R.stats, r.data);
  }
  async function loadArticleCount() {
    var c = sb(); if (!c) return;
    var r = await c.from('articles').select('id', { count: 'exact', head: true }).eq('reporter_id', R.id)
      .or('status.is.null,status.eq.published').then(function (x) { return x; }, function () { return null; });
    R.arts = (r && typeof r.count === 'number') ? r.count : 0;
  }
  async function loadAffinity() {
    var c = sb(), u = me(); if (!c || !u) return;
    var r = await c.from('reporter_user_affinity').select('affinity_points').eq('user_id', u.id).eq('reporter_id', R.id).maybeSingle()
      .then(function (x) { return x; }, function () { return null; });
    R.aff = Number(r && r.data && r.data.affinity_points || 0);
  }

  // ── Profile ──────────────────────────────────────────────────────
  function render() {
    var r = R.r, root = document.getElementById('rp-root');
    if (!r || !root) return;
    var fresh = R.posts.some(function (p) { return p.status === 'published' && Date.now() - new Date(p.created_at).getTime() < 48 * 3600000; });
    var rom = r.name_en || (typeof khReporterNameEn === 'function' ? khReporterNameEn(r) : '');
    var role = r.role_en || r.role || '';
    var pub = R.posts.filter(function (p) { return p.status === 'published'; });
    var facts = [];
    if (r.birthday) facts.push(ic('cake') + 'Birthday ' + esc(bday(r.birthday)));
    if (r.mbti) facts.push(ic('sparkles') + esc(r.mbti));
    if (r.symbol_en || r.symbol) facts.push(ic('star') + esc(r.symbol_en || r.symbol));
    if (r.likes_en || r.likes) facts.push(ic('heart') + 'Likes ' + esc(r.likes_en || r.likes));
    var pct = Math.min(100, Math.round(R.aff / AFF_MAX * 100));
    var hl = highlights();
    root.innerHTML = '<div class="rp">'
      + '<div class="rp-top"><a href="korehan-reporters.html">' + ic('chevron-left') + 'All reporters</a><b>' + esc(handle()) + '</b></div>'
      + '<div class="rp-head">'
      +   '<button type="button" class="rp-ring' + (fresh ? ' on' : '') + '" style="--c:' + r.color + '" onclick="khRp.openLatest()" aria-label="' + (fresh ? 'Open the newest post' : 'Profile picture') + '">'
      +     (r.image ? '<img src="' + esc(r.image) + '" alt="">' : '<span class="rp-ph" style="background:' + r.color + '">' + esc(r.name.charAt(0)) + '</span>') + '</button>'
      +   '<div class="rp-stats"><div><b>' + nf(pub.length) + '</b><small>posts</small></div><div><b id="rp-followers">' + nf(R.stats.followers) + '</b><small>followers</small></div>'
      +   '<button type="button" onclick="khRp.tab(\'articles\')"><b>' + nf(R.arts) + '</b><small>articles</small></button></div>'
      + '</div>'
      + '<div class="rp-bio">'
      +   '<h2 class="rp-name"><span lang="ko">' + esc(r.name) + '</span>' + (rom ? '<small>' + esc(rom) + '</small>' : '') + '</h2>'
      +   '<div class="rp-role">' + esc(role) + ' · KoreHani Newsroom</div>'
      +   (r.catchphrase ? '<div class="rp-cp"><span lang="ko">' + esc(r.catchphrase) + '</span>' + (r.catchphrase_en ? '<small>' + esc(r.catchphrase_en) + '</small>' : '') + '</div>' : '')
      +   (r.intro_en || r.intro ? '<p class="rp-intro">' + esc(r.intro_en || r.intro) + '</p>' : '')
      +   (facts.length ? '<div class="rp-facts">' + facts.map(function (f) { return '<span>' + f + '</span>'; }).join('') + '</div>' : '')
      +   '<div class="rp-aff"><span>' + ic('heart-handshake') + 'Your affinity · <b>' + affLevel(R.aff) + '</b></span><span>' + nf(R.aff) + ' / ' + nf(AFF_MAX) + '</span></div>'
      +   '<div class="rp-affbar"><i style="width:' + (R.aff ? Math.max(2, pct) : 0) + '%;background:' + r.color + '"></i></div>'
      + '</div>'
      + '<div class="rp-btns">'
      +   '<button type="button" class="rp-b ' + (R.stats.following ? 'rp-b-on' : 'rp-b-main') + '" id="rp-follow" onclick="khRp.follow()">' + (R.stats.following ? ic('check') + 'Following' : ic('user-plus') + 'Follow') + '</button>'
      +   '<button type="button" class="rp-b" onclick="khRp.gifts()">' + ic('gift') + 'Gift</button>'
      +   '<button type="button" class="rp-b" onclick="khRp.bubble()">' + ic('message-circle-heart') + 'Bubble</button>'
      + '</div>'
      + (hl ? '<div class="rp-hl" role="list">' + hl + '</div>' : '')
      + (isAdmin() ? '<button type="button" class="rp-new" onclick="khRp.compose()">' + ic('plus') + 'New post (admin)</button>' : '')
      + '<div class="rp-tabs" role="tablist">'
      +   tabBtn('posts', 'grid-3x3', 'Posts') + tabBtn('articles', 'newspaper', 'Articles') + tabBtn('cards', 'id-card', 'Cards') + tabBtn('goods', 'shopping-bag', 'Goods')
      + '</div>'
      + '<div id="rp-panel"></div>'
      + '</div>';
    panel();
    icons();
  }
  function tabBtn(k, icon, label) {
    var on = R.tab === k;
    return '<button type="button" role="tab" aria-selected="' + on + '" class="' + (on ? 'on' : '') + '" onclick="khRp.tab(\'' + k + '\')">' + ic(icon) + '<span>' + label + '</span></button>';
  }
  function highlights() {
    var groups = {};
    R.posts.forEach(function (p) {
      var t = TYPES[p.post_type] && p.post_type !== 'general' ? p.post_type : null;
      if (t && p.status === 'published' && !groups[t]) groups[t] = p;
    });
    var ks = Object.keys(TYPES).filter(function (k) { return groups[k]; });
    if (!ks.length) return '';
    return ks.map(function (k) {
      var p = groups[k], img = p.images && p.images[0];
      return '<button type="button" role="listitem" class="rp-hl-i' + (R.filter === k ? ' on' : '') + '" onclick="khRp.highlight(\'' + k + '\')">'
        + '<span>' + (img ? '<img src="' + esc(img) + '" alt="">' : ic(TYPES[k][1])) + '</span>' + esc(TYPES[k][0]) + '</button>';
    }).join('');
  }

  // ── Panels ───────────────────────────────────────────────────────
  function panel() {
    var el = document.getElementById('rp-panel'); if (!el) return;
    if (R.tab === 'posts') el.innerHTML = gridHtml();
    else if (R.tab === 'articles') { el.innerHTML = '<div id="rp-arts" class="rp-arts"><div class="rp-empty">Loading articles…</div></div>'; articles(false); }
    else if (R.tab === 'cards') { el.innerHTML = cardsHtml(); if (!R.setsLoaded) loadSets(); }
    else { el.innerHTML = '<div class="rp-empty">Loading…</div>'; goods(); }
    icons();
  }
  function gridHtml() {
    var list = R.posts.filter(function (p) { return !R.filter || p.post_type === R.filter; });
    if (!list.length) return empty('camera', 'No posts yet', firstName() + ' hasn\'t posted anything yet. Follow to see new posts first.');
    return (R.filter ? '<button type="button" class="rp-chip-x" onclick="khRp.highlight(\'\')">' + esc(TYPES[R.filter][0]) + ic('x') + '</button>' : '')
      + '<div class="rp-grid">' + list.map(function (p) {
        var img = p.images && p.images[0];
        var likes = Number((R.stats.likes || {})[p.id] || 0);
        return '<button type="button" class="rp-g" onclick="khRp.open(\'' + p.id + '\')" aria-label="Open post">'
          + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : '<span class="rp-g-t" lang="ko">' + esc((p.content || '').slice(0, 40)) + '</span>')
          + (p.images && p.images.length > 1 ? '<i class="rp-g-multi">' + ic('copy') + '</i>' : '')
          + (p.status === 'draft' ? '<em class="rp-g-draft">Draft</em>' : '')
          + (likes ? '<em class="rp-g-likes">' + ic('heart') + likes + '</em>' : '')
          + '</button>';
      }).join('') + '</div>';
  }
  // Photocard sets (cash_products kind photocard_set): preview[i] is the BLURRED picture of items[i].
  // Owned cards (user_photocards, written only by the server on purchase) show in full;
  // the rest are locked with a link to the Special shop. The admin also sees drafts.
  async function loadSets() {
    var c = sb(); if (!c) return;
    var res = await c.from('cash_products').select('id, name, description, price_cents, items, preview, active, sort')
      .eq('reporter_id', R.id).eq('kind', 'photocard_set').order('sort', { ascending: true }).then(function (x) { return x; }, function () { return null; });
    R.sets = (res && Array.isArray(res.data)) ? res.data : [];
    R.owned = {}; R.art = {};
    var u = me();
    if (u && R.sets.length) {
      var oc = await c.from('user_photocards').select('card_id').eq('user_id', u.id).then(function (x) { return x; }, function () { return null; });
      ((oc && Array.isArray(oc.data)) ? oc.data : []).forEach(function (x) { R.owned[x.card_id] = 1; });
      // Full pictures: photocard_art is readable only for cards you own (RLS); everyone
      // else only ever gets the blurred preview from cash_products.preview.
      var ids = Object.keys(R.owned);
      if (ids.length) {
        var ar = await c.from('photocard_art').select('card_id, img').in('card_id', ids).then(function (x) { return x; }, function () { return null; });
        ((ar && Array.isArray(ar.data)) ? ar.data : []).forEach(function (x) { if (x.img) R.art[x.card_id] = x.img; });
      }
    }
    R.setsLoaded = true;
    if (R.tab === 'cards') { var el = document.getElementById('rp-panel'); if (el) { el.innerHTML = cardsHtml(); icons(); } }
  }
  function pcImg(u) { return (typeof khRoomImg === 'function' && /^assets\//.test(u)) ? khRoomImg(u) : u; }
  function setCards(p) {
    var ids = p.items || [], pv = p.preview || [];
    return ids.map(function (id, i) { var x = pv[i] || {}; return { id: id, img: (R.owned[id] && R.art && R.art[id]) || x.img || '', label: x.label || '' }; });
  }
  function setsHtml() {
    if (!R.setsLoaded) return '<div class="rp-empty">Loading cards…</div>';
    var r = R.r;
    return (R.sets || []).map(function (p) {
      var cards = setCards(p), got = cards.filter(function (c) { return R.owned[c.id]; }).length, n = cards.length;
      var pad = String(n).padStart(2, '0');
      return '<div class="rp-pcset" style="--c:' + r.color + '"><div class="rp-pcset-h"><span><b>' + esc(p.name) + '</b>' + (p.active ? '' : '<em class="rp-g-draft">Draft</em>') + '</span>'
        + '<small>' + got + ' / ' + n + ' collected</small></div>'
        + '<div class="rp-cards">' + cards.map(function (c, i) {
          var own = !!R.owned[c.id], no = String(i + 1).padStart(2, '0') + ' / ' + pad;
          return '<button type="button" class="rp-card' + (own ? '' : ' rp-card-lock') + '" style="--c:' + r.color + '"'
            + (own ? ' onclick="khRp.card(\'' + esc(p.id) + '\',' + i + ')"' : ' onclick="location.href=\'korehan-shop.html?tab=special\'"')
            + ' aria-label="' + esc(c.label + (own ? '' : ' (locked)')) + '"><img src="' + esc(pcImg(c.img)) + '" alt="" loading="lazy"><span class="rp-card-n">' + no + '</span>'
            + (own ? '' : '<span class="rp-card-lk">' + ic('lock') + '</span>')
            + '<span class="rp-card-b"><em>' + esc(c.label.toUpperCase()) + '</em><b lang="ko">' + esc(r.name) + '</b></span></button>';
        }).join('') + '</div>'
        + (got < n ? '<a class="rp-pcset-buy" href="korehan-shop.html?tab=special">' + ic('sparkles') + 'Get all ' + n + ' cards · $' + (p.price_cents / 100).toFixed(2) + ic('chevron-right') + '</a>' : '')
        + '</div>';
    }).join('');
  }
  function cardsHtml() {
    var r = R.r, cards = [];
    if (r.image) cards.push({ src: r.image, tag: 'OFFICIAL' });
    R.posts.forEach(function (p) { if (p.status === 'published') (p.images || []).forEach(function (u) { if (u && u !== r.image) cards.push({ src: u, tag: 'BEHIND' }); }); });
    var sets = setsHtml();
    if (!cards.length && !sets) return empty('id-card', 'No cards yet', 'Cards appear when ' + firstName() + ' shares photos.');
    var total = String(cards.length).padStart(3, '0');
    return sets + (cards.length ? (sets ? '<div class="rp-pcset-h rp-pcset-h2"><span><b>Official &amp; behind</b></span><small>Free</small></div>' : '') + '<div class="rp-cards">' + cards.map(function (c, i) {
      return '<div class="rp-card" style="--c:' + r.color + '"><img src="' + esc(c.src) + '" alt="" loading="lazy"><span class="rp-card-n">' + String(i + 1).padStart(3, '0') + ' / ' + total + '</span>'
        + '<span class="rp-card-b"><em>' + c.tag + '</em><b lang="ko">' + esc(r.name) + '</b></span></div>';
    }).join('') + '</div>' : '');
  }
  // Big view of an owned photocard.
  function card(pid, i) {
    var p = (R.sets || []).filter(function (x) { return x.id === pid; })[0]; if (!p) return;
    var c = setCards(p)[i]; if (!c || !R.owned[c.id]) return;
    var ov = sheet('<button type="button" class="rp-x rp-pcv-x" onclick="khRp.close()" aria-label="Close">' + ic('x') + '</button>'
      + '<div class="rp-pcv" style="--c:' + R.r.color + '"><img src="' + esc(pcImg(c.img)) + '" alt="' + esc(c.label) + '"></div>'
      + '<div class="rp-pcv-b"><b>' + esc(c.label) + '</b><small>' + esc(p.name) + ' · ' + String(i + 1).padStart(2, '0') + ' / ' + String(setCards(p).length).padStart(2, '0') + '</small></div>', 'rp-ov-pc');
    return ov;
  }
  var _artOff = 0, _artTotal = 0;
  async function articles(more) {
    var el = document.getElementById('rp-arts'), c = sb(); if (!el || !c) return;
    if (!more) { _artOff = 0; }
    var res = await c.from('articles').select('id,title,title_en,image,section,level,date,created_at,status', { count: 'exact' })
      .eq('reporter_id', R.id).or('status.is.null,status.eq.published').or('section.is.null,section.neq.fake')
      .order('created_at', { ascending: false }).range(_artOff, _artOff + 19)
      .then(function (x) { return x; }, function () { return { data: [] }; });
    var rows = (res && res.data) || [];
    if (!more) _artTotal = Number(res && res.count || rows.length);
    if (!more && !rows.length) { el.innerHTML = empty('newspaper', 'No articles yet', firstName() + '\'s articles will be listed here.'); icons(); return; }
    var html = rows.map(function (a) {
      var img = String(a.image || ''), th = /^https?:\/\//i.test(img) && !/picsum\.photos/i.test(img) ? ' style="background-image:url(\'' + esc(img).replace(/'/g, '%27') + '\')"' : '';
      var d = new Date(a.date || a.created_at), sec = typeof khSecLabel === 'function' ? khSecLabel(a.section) : (a.section || '');
      return '<a class="rp-art" href="korehan-article.html?id=' + encodeURIComponent(a.id) + '"><span class="rp-art-th"' + th + '></span><span class="rp-art-b"><b lang="ko">' + esc(a.title || '') + '</b><small>'
        + esc([sec, isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), a.level || ''].filter(Boolean).join(' · ')) + '</small></span></a>';
    }).join('');
    var old = document.getElementById('rp-art-more'); if (old) old.remove();
    if (!more) el.innerHTML = html; else el.insertAdjacentHTML('beforeend', html);
    _artOff += rows.length;
    if (_artOff < _artTotal) el.insertAdjacentHTML('beforeend', '<button type="button" class="rp-more" id="rp-art-more" onclick="this.disabled=true;khRp.moreArticles()">Show more (' + (_artTotal - _artOff) + ' left)</button>');
  }
  async function goods() {
    var el = document.getElementById('rp-panel'), c = sb(); if (!el) return;
    var sets = [];
    if (c) {
      var res = await c.from('cash_products').select('*').eq('reporter_id', R.id).eq('active', true).then(function (x) { return x; }, function () { return null; });
      sets = (res && Array.isArray(res.data)) ? res.data : [];
      var u = me();
      if (u) {
        var gi = await c.from('goods_interest').select('reporter_id').eq('user_id', u.id).eq('reporter_id', R.id).then(function (x) { return x; }, function () { return null; });
        R.interest = !!(gi && gi.data && gi.data.length);
      }
    }
    if (R.tab !== 'goods') return;
    var h = '<div class="rp-goods">';
    h += sets.length ? sets.map(function (p) {
      return '<a class="rp-set" href="korehan-shop.html?tab=special"><span class="rp-set-ims">' + (p.preview || []).slice(0, 5).map(function (x) { return '<img src="' + esc(typeof khRoomImg === 'function' ? khRoomImg(x.img) : x.img) + '" alt="">'; }).join('') + '</span>'
        + '<span class="rp-set-b"><b>' + esc(p.name) + '</b><small>Digital photocards · $' + (p.price_cents / 100).toFixed(2) + '</small></span>' + ic('chevron-right') + '</a>';
    }).join('') : '<div class="rp-soon-s">' + ic('id-card') + '<span>Digital photocard sets for ' + esc(firstName()) + ' are coming to the Special shop.</span></div>';
    h += '<div class="rp-soon"><div><b>Real photocards &amp; goods</b><span>COMING SOON</span></div><p>Printed photocards, acrylic stands and stickers of ' + esc(firstName()) + ', shipped to you.</p>'
      + '<button type="button" class="rp-b' + (R.interest ? ' rp-b-on' : '') + '" onclick="khRp.notify()">' + (R.interest ? ic('bell-ring') + 'You\'ll hear first' : ic('bell') + 'Notify me') + '</button></div></div>';
    el.innerHTML = h; icons();
  }

  // ── Actions ──────────────────────────────────────────────────────
  async function follow() {
    var c = sb(), u = me(); if (!u) return signIn(); if (!c) return;
    var on = !!R.stats.following;
    var res = on ? await c.from('reporter_follows').delete().eq('user_id', u.id).eq('reporter_id', R.id)
                 : await c.from('reporter_follows').insert({ user_id: u.id, reporter_id: R.id });
    if (res && res.error && !/duplicate/i.test(res.error.message || '')) { say('Could not save that. Try again.', 'error'); return; }
    R.stats.following = !on; R.stats.followers = Math.max(0, Number(R.stats.followers || 0) + (on ? -1 : 1));
    var b = document.getElementById('rp-follow');
    if (b) { b.className = 'rp-b ' + (R.stats.following ? 'rp-b-on' : 'rp-b-main'); b.innerHTML = R.stats.following ? ic('check') + 'Following' : ic('user-plus') + 'Follow'; }
    var f = document.getElementById('rp-followers'); if (f) f.textContent = nf(R.stats.followers);
    icons();
  }
  async function notify() {
    var c = sb(), u = me(); if (!u) return signIn(); if (!c) return;
    var res = R.interest ? await c.from('goods_interest').delete().eq('user_id', u.id).eq('reporter_id', R.id)
                         : await c.from('goods_interest').insert({ user_id: u.id, reporter_id: R.id });
    if (res && res.error) { say('Could not save that. Try again.', 'error'); return; }
    R.interest = !R.interest;
    if (R.interest) say('Got it. You\'ll hear first when real goods open.', 'success');
    goods();
  }
  function sheet(html, cls) {
    closeSheet();
    var ov = document.createElement('div'); ov.className = 'rp-ov' + (cls ? ' ' + cls : ''); ov.id = 'rp-ov';
    ov.innerHTML = '<div class="rp-sheet" role="dialog" aria-modal="true">' + html + '</div>';
    ov.addEventListener('click', function (e) { if (e.target === ov) closeSheet(); });
    document.body.appendChild(ov); document.body.classList.add('rp-lock');
    icons();
    return ov;
  }
  function closeSheet() {
    var o = document.getElementById('rp-ov'); if (o) o.remove();
    document.body.classList.remove('rp-lock');
    R.open = null;
  }
  function bubble() {
    sheet('<div class="rp-sh-h"><b>Bubble</b><button type="button" class="rp-x" onclick="khRp.close()" aria-label="Close">' + ic('x') + '</button></div>'
      + '<p class="rp-sh-p">Daily messages from <b lang="ko">' + esc(R.r.name) + '</b> in easy Korean, with word hints. Coming soon.</p>'
      + '<div class="rp-bub"><span lang="ko">' + esc(R.r.catchphrase || '안녕하세요!') + '</span><small>' + esc(R.r.catchphrase_en || 'Hello!') + '</small></div>'
      + '<button type="button" class="rp-b rp-b-main rp-wide" onclick="khRp.close()">OK</button>');
  }
  async function gifts() {
    var u = me(), c = sb();
    if (!u) return signIn();
    sheet('<div class="rp-sh-h"><b>Send a gift</b><button type="button" class="rp-x" onclick="khRp.close()" aria-label="Close">' + ic('x') + '</button></div>'
      + '<p class="rp-sh-p">Each gift raises your affinity with <span lang="ko">' + esc(R.r.name) + '</span>. A gift you own is used first; otherwise it is bought with nyang.</p>'
      + '<div class="rp-gifts" id="rp-gifts"><div class="rp-empty">Loading gifts…</div></div>');
    if (!c) return;
    var res = await Promise.all([
      c.from('shop_items').select('id,name,description,coin_price').eq('is_active', true).eq('item_type', 'reporter_item').order('sort_order', { ascending: true }),
      c.from('owned_items').select('item_id,quantity').eq('user_id', u.id),
      c.from('user_stats').select('coin_balance').eq('user_id', u.id).maybeSingle()
    ].map(function (q) { return q.then(function (x) { return x; }, function () { return { data: null }; }); }));
    R.gifts = (res[0] && res[0].data) || []; R.giftOwned = {};
    ((res[1] && res[1].data) || []).forEach(function (o) { R.giftOwned[o.item_id] = Number(o.quantity || 0); });
    R.nyang = Number(res[2] && res[2].data && res[2].data.coin_balance || 0);
    drawGifts();
  }
  function drawGifts() {
    var g = document.getElementById('rp-gifts'); if (!g) return;
    var unl = typeof khNyangUnlimited === 'function' && khNyangUnlimited();
    g.innerHTML = '<div class="rp-gift-bal">' + ic('paw-print') + (unl ? 'Unlimited' : nf(R.nyang)) + ' nyang</div>' + (R.gifts.length ? R.gifts.map(function (it) {
      var own = R.giftOwned[it.id] || 0, price = Number(it.coin_price || 0), off = !own && !unl && R.nyang < price;
      return '<button type="button" class="rp-gift"' + (off ? ' disabled' : '') + ' onclick="khRp.give(\'' + esc(it.id) + '\')">'
        + '<span>' + ic(GIFT_ICON[it.id] || 'gift') + '</span><b>' + esc(String(it.name || '').replace(/^Reporter\s+/i, '')) + '</b>'
        + '<small>' + (own ? 'You have ' + own : nf(price) + ' nyang') + '</small></button>';
    }).join('') : '<div class="rp-empty">No gifts right now.</div>');
    icons();
  }
  async function give(itemId) {
    var c = sb(), u = me(); if (!c || !u) return;
    var it = R.gifts.filter(function (x) { return x.id === itemId; })[0]; if (!it) return;
    var res = await c.rpc('send_reporter_gift', { p_item_id: itemId, p_reporter_id: R.id, p_user_id: u.id });
    if (res.error || !res.data || !res.data.ok) {
      var code = (res.data && res.data.error) || '';
      say(code === 'INSUFFICIENT_NYANG' ? 'Not enough nyang.' : 'The gift could not be sent. Try again later.', 'error');
      return;
    }
    say('Gift sent to ' + R.r.name + '!', 'success');
    await loadAffinity();
    if (R.giftOwned[itemId] > 0) R.giftOwned[itemId]--; else R.nyang = Math.max(0, R.nyang - Number(it.coin_price || 0));
    drawGifts();
    var keep = R.tab; render(); R.tab = keep;
  }

  // ── Post viewer (a small lesson) ─────────────────────────────────
  function find(id) { return R.posts.filter(function (p) { return p.id === id; })[0]; }
  function captionHtml(p) {
    var text = String(p.content || ''), vocab = (p.vocab || []).filter(function (v) { return v && v.ko; });
    if (!vocab.length) return esc(text);
    // Longest words first so 사실 확인 wins over 사실.
    var order = vocab.map(function (v, i) { return { v: v, i: i }; }).sort(function (a, b) { return b.v.ko.length - a.v.ko.length; });
    var out = '', pos = 0;
    while (pos < text.length) {
      var hit = null;
      for (var k = 0; k < order.length; k++) if (text.substr(pos, order[k].v.ko.length) === order[k].v.ko) { hit = order[k]; break; }
      if (hit) { out += '<button type="button" class="rp-w" onclick="khRp.word(' + hit.i + ',this)">' + esc(hit.v.ko) + '</button>'; pos += hit.v.ko.length; }
      else { out += esc(text.charAt(pos)); pos++; }
    }
    return out;
  }
  function quizHtml(p) {
    var q = p.quiz;
    if (!q || !q.q || !q.a || !Array.isArray(q.w) || !q.w.length) return '';
    var opts = [q.a].concat(q.w.slice(0, 3));
    var seed = 0; for (var i = 0; i < p.id.length; i++) seed = (seed * 31 + p.id.charCodeAt(i)) >>> 0;
    opts = opts.map(function (o, i) { return { o: o, k: (seed >>> (i * 3)) & 7 }; }).sort(function (a, b) { return a.k - b.k; }).map(function (x) { return x.o; });
    return '<div class="rp-quiz"><b>' + ic('graduation-cap') + '1-minute quiz</b><span lang="ko">' + esc(q.q) + '</span><div class="rp-qo">'
      + opts.map(function (o) { return '<button type="button" onclick="khRp.answer(this,' + (o === q.a ? 1 : 0) + ')">' + esc(o) + '</button>'; }).join('') + '</div></div>';
  }
  function openPost(id) {
    var p = find(id); if (!p) return;
    var r = R.r, likes = Number((R.stats.likes || {})[p.id] || 0), liked = (R.stats.liked || []).indexOf(p.id) >= 0;
    var imgs = p.images || [];
    var ov = sheet('<div class="rp-pv-h"><span class="rp-pv-av">' + (r.image ? '<img src="' + esc(r.image) + '" alt="">' : '') + '</span><b>' + esc(handle()) + '</b><small>' + esc(ago(p.created_at)) + (p.status === 'draft' ? ' · Draft' : '') + '</small>'
      + (isAdmin() ? '<button type="button" class="rp-x" onclick="khRp.compose(\'' + p.id + '\')" aria-label="Edit post">' + ic('pencil') + '</button>' : '')
      + '<button type="button" class="rp-x" onclick="khRp.close()" aria-label="Close">' + ic('x') + '</button></div>'
      + (imgs.length ? '<div class="rp-pv-imgs">' + imgs.map(function (u) { return '<img src="' + esc(u) + '" alt="">'; }).join('') + '</div>'
          + (imgs.length > 1 ? '<div class="rp-dots">' + imgs.map(function (_, i) { return '<i class="' + (i ? '' : 'on') + '"></i>'; }).join('') + '</div>' : '') : '')
      + '<div class="rp-pv-bar"><button type="button" id="rp-like" class="' + (liked ? 'on' : '') + '" onclick="khRp.like(\'' + p.id + '\')" aria-pressed="' + liked + '">' + ic('heart') + '<span>' + likes + '</span></button>'
      + '<button type="button" onclick="document.getElementById(\'rp-cin\').focus()">' + ic('message-circle') + '<span id="rp-ccount">' + Number((R.stats.comments || {})[p.id] || 0) + '</span></button></div>'
      + '<div class="rp-cap"><div class="rp-cap-ko" lang="ko">' + captionHtml(p) + '</div><div id="rp-wpop" class="rp-wpop" hidden></div>'
      + (p.caption_en ? '<button type="button" class="rp-tr" onclick="this.nextElementSibling.hidden=!this.nextElementSibling.hidden">' + ic('languages') + 'Translation</button><div class="rp-cap-en" hidden>' + esc(p.caption_en) + '</div>' : '')
      + ((p.vocab || []).length ? '<div class="rp-vocab">' + p.vocab.map(function (v, i) { return '<button type="button" onclick="khRp.save(' + i + ',this)"><span lang="ko">' + esc(v.ko) + '</span> ' + esc(v.en || '') + ic('bookmark-plus') + '</button>'; }).join('') + '</div>' : '')
      + '</div>'
      + quizHtml(p)
      + '<div class="rp-cm"><b>Comments</b><div id="rp-clist"><div class="rp-empty">Loading…</div></div>'
      + '<form class="rp-cform" onsubmit="event.preventDefault();khRp.comment(\'' + p.id + '\')"><input id="rp-cin" maxlength="300" autocomplete="off" placeholder="Write a comment in Korean" lang="ko"><button type="submit">' + ic('send') + '</button></form></div>', 'rp-ov-post');
    R.open = p;
    var strip = ov.querySelector('.rp-pv-imgs');
    if (strip) strip.addEventListener('scroll', function () {
      var i = Math.round(strip.scrollLeft / Math.max(1, strip.clientWidth));
      ov.querySelectorAll('.rp-dots i').forEach(function (d, k) { d.classList.toggle('on', k === i); });
    }, { passive: true });
    comments(p.id);
  }
  function word(i, btn) {
    var p = R.open; if (!p) return;
    var v = p.vocab[i], pop = document.getElementById('rp-wpop'); if (!v || !pop) return;
    pop.hidden = false;
    pop.innerHTML = '<b lang="ko">' + esc(v.ko) + '</b><span>' + esc(v.en || '') + '</span><button type="button" onclick="khRp.save(' + i + ',this)">' + ic('bookmark-plus') + 'Save</button>';
    icons();
  }
  async function save(i, btn) {
    var p = R.open; if (!p) return;
    var v = p.vocab[i]; if (!v) return;
    var rom = typeof khRomanize === 'function' ? khRomanize(v.ko) : '';
    if (typeof dbSaveWord === 'function') { try { await dbSaveWord(v.ko, rom, v.en || ''); } catch (_) {} }
    if (btn) { btn.classList.add('saved'); btn.innerHTML = ic('check') + 'Saved'; icons(); }
    say('Saved to My Words: ' + v.ko, 'success');
  }
  function answer(btn, ok) {
    var box = btn.parentNode;
    box.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    btn.classList.add(ok ? 'ok' : 'no');
    if (!ok) { var right = Array.prototype.filter.call(box.querySelectorAll('button'), function (b) { return /,1\)$/.test(b.getAttribute('onclick')); })[0]; if (right) right.classList.add('ok'); }
    say(ok ? 'Correct!' : 'Not quite — the right answer is marked.', ok ? 'success' : 'warn');
  }
  async function like(id) {
    var c = sb(), u = me(); if (!u) return signIn(); if (!c) return;
    var liked = (R.stats.liked || []).indexOf(id) >= 0;
    var res = liked ? await c.from('reporter_post_likes').delete().eq('user_id', u.id).eq('post_id', id)
                    : await c.from('reporter_post_likes').insert({ user_id: u.id, post_id: id });
    if (res && res.error && !/duplicate/i.test(res.error.message || '')) { say('Could not save that.', 'error'); return; }
    R.stats.likes = R.stats.likes || {}; R.stats.liked = R.stats.liked || [];
    R.stats.likes[id] = Math.max(0, Number(R.stats.likes[id] || 0) + (liked ? -1 : 1));
    if (liked) R.stats.liked = R.stats.liked.filter(function (x) { return x !== id; }); else R.stats.liked.push(id);
    var b = document.getElementById('rp-like');
    if (b) { b.classList.toggle('on', !liked); b.setAttribute('aria-pressed', String(!liked)); b.querySelector('span').textContent = R.stats.likes[id]; }
    if (R.tab === 'posts') { var el = document.getElementById('rp-panel'); if (el) { el.innerHTML = gridHtml(); icons(); } }
  }
  async function comments(id) {
    var c = sb(), box = document.getElementById('rp-clist'); if (!c || !box) return;
    var res = await c.from('comments').select('*').eq('article_id', 'rpost:' + id).order('created_at', { ascending: true }).then(function (x) { return x; }, function () { return { data: [] }; });
    var rows = ((res && res.data) || []).filter(function (r) { return !r.deleted_at && !r.is_deleted; });
    var cc = document.getElementById('rp-ccount'); if (cc) cc.textContent = rows.length;
    var u = me();
    box.innerHTML = rows.length ? rows.map(function (r) {
      var mine = u && r.user_id === u.id;
      return '<div class="rp-c"><b>' + esc(r.user_name || 'Learner') + '</b> <span lang="ko">' + esc(r.content || '') + '</span><small>' + esc(ago(r.created_at))
        + ((mine || isAdmin()) ? ' · <button type="button" onclick="khRp.uncomment(\'' + r.id + '\',\'' + id + '\')">Delete</button>' : '') + '</small></div>';
    }).join('') : '<div class="rp-empty rp-empty-s">Be the first to comment — in Korean!</div>';
  }
  async function comment(id) {
    var c = sb(), u = me(); if (!u) return signIn(); if (!c) return;
    var inp = document.getElementById('rp-cin'), text = (inp && inp.value || '').trim();
    if (text.length < 2) return;
    if (!/[가-힣]/.test(text)) { say('Try writing it in Korean — even a few words!', 'warn'); return; }
    var res = await c.rpc('submit_comment', { p_article_id: 'rpost:' + id, p_content: text, p_parent_id: null });
    var d = res && res.data;
    if (res.error || (d && d.ok === false)) {
      var why = (d && d.error) || '';
      say(why === 'rate_limited' ? 'Wait ' + ((d && d.wait_seconds) || 15) + 's before the next comment.' : 'The comment could not be posted.', 'error');
      return;
    }
    inp.value = '';
    R.stats.comments = R.stats.comments || {}; R.stats.comments[id] = Number(R.stats.comments[id] || 0) + 1;
    comments(id);
  }
  async function uncomment(cid, pid) {
    var c = sb(); if (!c) return;
    var res = await c.rpc('soft_delete_comment', { p_id: cid });
    if (res.error) { say('Could not delete it.', 'error'); return; }
    comments(pid);
  }

  // ── Admin: write / edit a post ───────────────────────────────────
  var _files = [];
  function compose(id) {
    if (!isAdmin()) return;
    var p = id ? find(id) : null;
    _files = [];
    var vocab = p ? (p.vocab || []).map(function (v) { return v.ko + ' = ' + (v.en || ''); }).join('\n') : '';
    var q = (p && p.quiz) || {};
    sheet('<div class="rp-sh-h"><b>' + (p ? 'Edit post' : 'New post') + '</b><button type="button" class="rp-x" onclick="khRp.close()" aria-label="Close">' + ic('x') + '</button></div>'
      + '<form class="rp-form" onsubmit="event.preventDefault();khRp.savePost(' + (p ? '\'' + p.id + '\'' : 'null') + ')">'
      + '<label>Photos' + (p && p.images && p.images.length ? ' (choose new ones to replace ' + p.images.length + ')' : '') + '<input type="file" accept="image/*" multiple onchange="khRp.files(this)"></label>'
      + '<label>Caption (Korean)<textarea id="rpf-ko" rows="3" lang="ko" required>' + esc(p ? p.content : '') + '</textarea></label>'
      + '<label>Translation (English)<textarea id="rpf-en" rows="2">' + esc(p ? p.caption_en || '' : '') + '</textarea></label>'
      + '<label>Words to tap — one per line: 단어 = meaning<textarea id="rpf-vocab" rows="3" lang="ko" placeholder="마감 = deadline">' + esc(vocab) + '</textarea></label>'
      + '<label>Quiz question<input id="rpf-q" lang="ko" value="' + esc(q.q || '') + '" placeholder="&quot;야근&quot;의 뜻은?"></label>'
      + '<div class="rp-form-2"><label>Right answer<input id="rpf-a" value="' + esc(q.a || '') + '"></label><label>Wrong answers (comma)<input id="rpf-w" value="' + esc((q.w || []).join(', ')) + '"></label></div>'
      + '<div class="rp-form-2"><label>Highlight<select id="rpf-type">' + Object.keys(TYPES).map(function (k) { return '<option value="' + k + '"' + ((p ? p.post_type : 'general') === k ? ' selected' : '') + '>' + TYPES[k][0] + '</option>'; }).join('') + '</select></label>'
      + '<label>Status<select id="rpf-status"><option value="published"' + (!p || p.status === 'published' ? ' selected' : '') + '>Published</option><option value="draft"' + (p && p.status === 'draft' ? ' selected' : '') + '>Draft</option></select></label></div>'
      + '<label class="rp-chk"><input type="checkbox" id="rpf-pin"' + (p && p.pinned ? ' checked' : '') + '> Pin to top</label>'
      + '<div class="rp-form-btns">' + (p ? '<button type="button" class="rp-b" onclick="khRp.delPost(\'' + p.id + '\')">' + ic('trash-2') + 'Delete</button>' : '')
      + '<button type="submit" class="rp-b rp-b-main" id="rpf-save">' + (p ? 'Save' : 'Post') + '</button></div></form>');
  }
  async function savePost(id) {
    var c = sb(), u = me(); if (!c || !u || !isAdmin()) return;
    var btn = document.getElementById('rpf-save'); if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    var val = function (k) { var e = document.getElementById(k); return e ? String(e.value || '').trim() : ''; };
    var vocab = val('rpf-vocab').split('\n').map(function (l) { var m = l.split('='); return { ko: (m[0] || '').trim(), en: m.slice(1).join('=').trim() }; }).filter(function (v) { return v.ko; });
    var w = val('rpf-w').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var quiz = val('rpf-q') && val('rpf-a') && w.length ? { q: val('rpf-q'), a: val('rpf-a'), w: w.slice(0, 3) } : null;
    var row = { reporter_id: R.id, author_user_id: u.id, content: val('rpf-ko'), caption_en: val('rpf-en') || null, vocab: vocab, quiz: quiz,
      post_type: val('rpf-type') || 'general', status: val('rpf-status') || 'published', pinned: !!(document.getElementById('rpf-pin') || {}).checked, updated_at: new Date().toISOString() };
    var res = id ? await c.from('reporter_posts').update(row).eq('id', id).select('id').single()
                 : await c.from('reporter_posts').insert(row).select('id').single();
    if (res.error || !res.data) { say('Save failed: ' + ((res.error && res.error.message) || ''), 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Save'; } return; }
    var pid = res.data.id;
    if (_files.length) {
      var urls = [];
      for (var i = 0; i < _files.length; i++) {
        var f = _files[i], ext = (f.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '');
        var path = 'posts/' + R.id + '/' + pid + '/' + Date.now() + '_' + i + '.' + ext;
        var up = await c.storage.from('reporter-images').upload(path, f, { upsert: true, contentType: f.type || 'image/jpeg' });
        if (up.error) continue;
        var pub = c.storage.from('reporter-images').getPublicUrl(path);
        if (pub && pub.data && pub.data.publicUrl) urls.push(pub.data.publicUrl);
      }
      if (urls.length) {
        if (id) await c.from('reporter_post_images').delete().eq('post_id', pid);
        await c.from('reporter_post_images').insert(urls.map(function (u2, k) { return { post_id: pid, image_url: u2, sort_order: k }; }));
      }
    }
    closeSheet();
    say(id ? 'Post updated' : 'Posted', 'success');
    await Promise.all([loadPosts(), loadStats()]);
    render();
  }
  async function delPost(id) {
    var c = sb(); if (!c || !isAdmin()) return;
    var ok = typeof khConfirm === 'function' ? await khConfirm('Delete this post?', 'Its photos, likes and comments go with it.', { okLabel: 'Delete', cancelLabel: 'Keep' }) : true;
    if (!ok) return;
    await c.from('reporter_post_images').delete().eq('post_id', id);
    var res = await c.from('reporter_posts').delete().eq('id', id);
    if (res.error) { say('Delete failed', 'error'); return; }
    closeSheet();
    await Promise.all([loadPosts(), loadStats()]);
    render();
  }

  function empty(icon, t, s) { return '<div class="rp-empty">' + ic(icon) + '<b>' + esc(t) + '</b><span>' + esc(s) + '</span></div>'; }
  function firstName() { var n = R.r && R.r.name || ''; return n.length > 2 ? n.slice(1) : n; }

  window.khRp = {
    tab: function (k) { R.tab = k; if (k !== 'posts') R.filter = ''; render(); },
    highlight: function (k) { R.filter = R.filter === k ? '' : k; R.tab = 'posts'; render(); },
    open: openPost, openLatest: function () { var p = R.posts.filter(function (x) { return x.status === 'published'; })[0]; if (p) openPost(p.id); },
    close: closeSheet, follow: follow, gifts: gifts, give: give, bubble: bubble, notify: notify,
    word: word, save: save, answer: answer, like: like, comment: comment, uncomment: uncomment,
    compose: compose, savePost: savePost, delPost: delPost, files: function (inp) { _files = Array.prototype.slice.call(inp.files || []); },
    moreArticles: function () { articles(true); }, card: card
  };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.getElementById('rp-ov')) closeSheet(); });
  // Admin role arrives after the first paint: show drafts + the New post button.
  window.addEventListener('kh:roles', function () { if (R.r && isAdmin()) loadPosts().then(render); });
  window.addEventListener('kh-auth-signed-in', function () { if (R.r) { R.setsLoaded = false; Promise.all([loadStats(), loadAffinity()]).then(render); } });
  window.addEventListener('kh:roles', function () { if (R.r && isAdmin() && R.tab === 'cards') loadSets(); });
  document.addEventListener('DOMContentLoaded', function () { load().catch(function () {}); });
})();
