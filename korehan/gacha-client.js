// Gacha (random draw) client.
// Mirrors shop-client.js: a static DEFAULT_GACHA_ITEMS catalog gets seeded
// into the gacha_items table on first run, then the live catalog is read
// back from Supabase so admins can edit without a code deploy.
//
// Image convention: assets/gacha/<slug>.png — drop files with those names
// into /korehan/assets/gacha/ and they'll show up automatically. Until
// the file exists the card falls back to a placeholder.

(function(){
  function gachaImg(slug) { return 'assets/gacha/' + slug + '.png'; }

  function _g(o) {
    return Object.assign({
      slug:        o.id.replace(/_/g, '-'),
      image_url:   o.image_url || gachaImg(o.id.replace(/_/g, '-')),
      dupe_refund: ({ C: 20, R: 50, SR: 120, SSR: 400 })[o.rarity] || 30,
      weight:      ({ C: 60, R: 25, SR: 12, SSR: 3 })[o.rarity] || 10,
      is_active:   true
    }, o);
  }

  // ── Default catalog ──
  // Rarities: C (common, 60%), R (rare, 25%), SR (super rare, 12%), SSR (3%).
  // Weights are *per item* but the C/R/SR/SSR helpers above set the
  // default — which means the actual rarity drop rate scales with the
  // number of items at each rarity. That's the pattern most gacha games
  // use, so users perceive SSR as truly rare even as the catalog grows.
  // Replace images by dropping PNGs at the slug paths above.
  var DEFAULT_GACHA_ITEMS = [
    // ── COMMON (everyday cosmetic flavor) ──
    _g({ id:'gacha_sticker_smile',      name:'스마일 스티커',         description:'A simple yellow smile sticker for your profile.', rarity:'C',  sort_order:10 }),
    _g({ id:'gacha_sticker_heart',      name:'하트 스티커',           description:'Bright pink heart sticker.',                       rarity:'C',  sort_order:11 }),
    _g({ id:'gacha_sticker_star',       name:'별 스티커',             description:'Twinkly gold star sticker.',                       rarity:'C',  sort_order:12 }),
    _g({ id:'gacha_emote_thumbs',       name:'엄지척 이모트',         description:'Thumbs-up emote for chat reactions.',              rarity:'C',  sort_order:13 }),
    _g({ id:'gacha_emote_clap',         name:'박수 이모트',           description:'Clapping hands emote.',                            rarity:'C',  sort_order:14 }),
    _g({ id:'gacha_emote_cry',          name:'엉엉 이모트',           description:'Crying-laughing emote — the daily mood.',          rarity:'C',  sort_order:15 }),
    _g({ id:'gacha_deco_pencil',        name:'연필 데코',             description:'Tiny pencil decoration for your profile corner.', rarity:'C',  sort_order:16 }),
    _g({ id:'gacha_deco_book',          name:'책 데코',               description:'Pile-of-books decoration — for serious students.', rarity:'C',  sort_order:17 }),
    _g({ id:'gacha_deco_coffee',        name:'커피잔 데코',           description:'Steaming coffee cup. Powers all-nighters.',        rarity:'C',  sort_order:18 }),
    _g({ id:'gacha_deco_kimchi',        name:'김치 데코',             description:'A jar of fresh kimchi.',                           rarity:'C',  sort_order:19 }),
    _g({ id:'gacha_deco_ramen',         name:'라면 데코',             description:'Spicy ramen bowl decoration.',                     rarity:'C',  sort_order:20 }),
    _g({ id:'gacha_deco_taegeuk',       name:'태극 데코',             description:'Traditional taegeuk symbol.',                      rarity:'C',  sort_order:21 }),
    _g({ id:'gacha_title_newbie',       name:'칭호 · 새내기',         description:'"Newbie" display title.',                          rarity:'C',  sort_order:22 }),
    _g({ id:'gacha_title_explorer',     name:'칭호 · 탐험가',         description:'"Explorer" display title.',                        rarity:'C',  sort_order:23 }),

    // ── RARE (themed cosmetics) ──
    _g({ id:'gacha_frame_pastel',       name:'파스텔 프레임',         description:'Soft pastel-gradient profile frame.',              rarity:'R',  sort_order:50 }),
    _g({ id:'gacha_frame_rainbow_lite', name:'레인보우 라이트 프레임', description:'A subtle rainbow profile frame (non-animated).',  rarity:'R',  sort_order:51 }),
    _g({ id:'gacha_frame_inkwash',      name:'수묵 프레임',           description:'Hand-painted Korean ink-wash frame.',              rarity:'R',  sort_order:52 }),
    _g({ id:'gacha_pet_chick',          name:'병아리',                description:'A fluffy yellow chick that wanders your room.',   rarity:'R',  sort_order:53 }),
    _g({ id:'gacha_pet_pup',            name:'포메',                  description:'Pomeranian pup pet — pure floof.',                 rarity:'R',  sort_order:54 }),
    _g({ id:'gacha_room_easel_rare',    name:'화가의 이젤',           description:'Painter\'s easel with a half-finished canvas.',    rarity:'R',  sort_order:55 }),
    _g({ id:'gacha_room_lantern',       name:'전통 등불',             description:'Traditional Korean paper lantern that softly glows.', rarity:'R',  sort_order:56 }),
    _g({ id:'gacha_emote_galaxy',       name:'은하수 이모트',         description:'Galaxy-swirl reaction emote.',                     rarity:'R',  sort_order:57 }),
    _g({ id:'gacha_title_polyglot_g',   name:'칭호 · 다국어 마스터',  description:'"Polyglot Master" title.',                          rarity:'R',  sort_order:58 }),

    // ── SUPER RARE (statement pieces) ──
    _g({ id:'gacha_frame_aurora',       name:'오로라 프레임',         description:'Animated aurora-borealis profile frame.',          rarity:'SR', sort_order:80 }),
    _g({ id:'gacha_frame_sakura_petal', name:'벚꽃 프레임',           description:'Falling cherry-blossom petals around your avatar.', rarity:'SR', sort_order:81 }),
    _g({ id:'gacha_pet_redpanda',       name:'레서판다',              description:'A curious red panda. Lounges on your bookshelf.',  rarity:'SR', sort_order:82 }),
    _g({ id:'gacha_pet_kpop_pup',       name:'아이돌 강아지',         description:'A tiny dog wearing K-pop concert merch.',          rarity:'SR', sort_order:83 }),
    _g({ id:'gacha_room_neon_namsan',   name:'네온 남산타워',         description:'Mini neon-lit Namsan tower for your desk.',         rarity:'SR', sort_order:84 }),
    _g({ id:'gacha_title_seoulite_g',   name:'칭호 · 서울 토박이',    description:'"Seoul Native" title.',                             rarity:'SR', sort_order:85 }),
    _g({ id:'gacha_outfit_hanbok',      name:'한복 의상',             description:'Traditional hanbok outfit for your character.',     rarity:'SR', sort_order:86 }),

    // ── SECRET RARE (collector chase) ──
    _g({ id:'gacha_frame_holo_secret',  name:'홀로그램 프레임 · 비밀', description:'Iridescent shifting holo frame. Gacha exclusive.', rarity:'SSR', sort_order:120 }),
    _g({ id:'gacha_pet_gold_dragon',    name:'황금 미니 용',          description:'Tiny golden Korean dragon. Coils around your room.', rarity:'SSR', sort_order:121 }),
    _g({ id:'gacha_pet_jade_phoenix',   name:'옥빛 봉황',             description:'Jade phoenix pet — the brag piece.',                rarity:'SSR', sort_order:122 }),
    _g({ id:'gacha_outfit_dokkaebi',    name:'도깨비 의상',           description:'Mythical dokkaebi outfit for your character.',     rarity:'SSR', sort_order:123 }),
    _g({ id:'gacha_title_dokkaebi_g',   name:'칭호 · 전설의 도깨비',  description:'"Legendary Dokkaebi" title — pure flex.',          rarity:'SSR', sort_order:124 })
  ];

  function isGachaTableMissing(err) {
    var msg = (err && err.message) ? String(err.message) : '';
    return msg.indexOf("Could not find the table 'public.gacha_items'") >= 0
      || msg.indexOf("relation \"public.gacha_items\" does not exist") >= 0;
  }

  // Incremental seed — only inserts items whose `id` is missing in DB.
  async function ensureDefaultGachaItems(sb) {
    try {
      var existingRes = await sb.from('gacha_items').select('id');
      if (existingRes.error) {
        if (isGachaTableMissing(existingRes.error)) {
          console.warn('[gacha] table missing — run the 20260502_gacha_system migration in Supabase.');
        }
        return false;
      }
      var existing = {};
      (existingRes.data || []).forEach(function(r){ existing[r.id] = true; });
      var missing = DEFAULT_GACHA_ITEMS.filter(function(it){ return !existing[it.id]; });
      if (!missing.length) return true;
      var seedRes = await sb.from('gacha_items').upsert(missing, { onConflict: 'id' });
      if (seedRes.error) {
        console.warn('[gacha] seed failed:', seedRes.error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('[gacha] ensureDefaults exception:', e);
      return false;
    }
  }

  function rarityLabel(r) {
    return ({ C: 'Common', R: 'Rare', SR: 'Super Rare', SSR: 'Secret Rare' })[r] || r;
  }
  function rarityClass(r) {
    return 'gc-rar-' + (r || 'C').toLowerCase();
  }

  async function loadCatalogAndRender() {
    var sb = (typeof getSupa === 'function') ? getSupa() : null;
    if (!sb) return;
    await ensureDefaultGachaItems(sb);

    var [{ data: items, error: itemsErr }, { data: stats }, { data: owned }] = await Promise.all([
      sb.from('gacha_items').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      window.supaUser ? sb.from('user_stats').select('coin_balance').eq('user_id', window.supaUser.id).maybeSingle() : Promise.resolve({ data: null }),
      window.supaUser ? sb.from('gacha_owned_items').select('item_id, quantity').eq('user_id', window.supaUser.id) : Promise.resolve({ data: [] })
    ]);

    var catalog = items || [];
    if (itemsErr) {
      // Fallback: render the static defaults so the UI still works while
      // the migration is pending. Drawing won't work without the RPC.
      catalog = DEFAULT_GACHA_ITEMS.slice();
    }

    var bal = (stats && stats.coin_balance) || 0;
    var balEl = document.getElementById('gacha-coin');
    if (balEl) balEl.textContent = bal.toLocaleString();

    var ownedMap = {};
    (owned || []).forEach(function(o){ ownedMap[o.item_id] = o.quantity || 0; });

    // Drop rate panel — sums weights per rarity.
    var rateEl = document.getElementById('gacha-rates');
    if (rateEl) {
      var sums = { C: 0, R: 0, SR: 0, SSR: 0 };
      catalog.forEach(function(it){ sums[it.rarity] = (sums[it.rarity] || 0) + (it.weight || 0); });
      var total = sums.C + sums.R + sums.SR + sums.SSR;
      function pct(n) { return total > 0 ? ((n / total) * 100).toFixed(1) + '%' : '—'; }
      rateEl.innerHTML =
          '<span class="gc-rate gc-rar-ssr">SSR ' + pct(sums.SSR) + '</span>'
        + '<span class="gc-rate gc-rar-sr">SR '  + pct(sums.SR)  + '</span>'
        + '<span class="gc-rate gc-rar-r">R '    + pct(sums.R)   + '</span>'
        + '<span class="gc-rate gc-rar-c">C '    + pct(sums.C)   + '</span>';
    }

    // Item preview grid (locked silhouettes for not-owned items).
    var grid = document.getElementById('gacha-grid');
    if (grid) {
      grid.innerHTML = catalog.map(function(it){
        var owned = ownedMap[it.id] || 0;
        var img = it.image_url || gachaImg((it.id || '').replace(/_/g, '-'));
        return '<div class="gc-card ' + rarityClass(it.rarity) + (owned ? '' : ' is-locked') + '">'
          + '<div class="gc-thumb"><img src="' + img + '" alt="' + (it.name || '') + '" onerror="this.style.opacity=\'.15\'"></div>'
          + '<div class="gc-rar">' + (it.rarity || 'C') + '</div>'
          + '<div class="gc-name">' + (owned ? (it.name || '') : '???') + '</div>'
          + (owned > 1 ? '<div class="gc-qty">×' + owned + '</div>' : '')
          + '</div>';
      }).join('');
    }
  }

  // Show a centered modal with the items pulled from the last draw. The
  // user can tap Continue to dismiss; Drawing again rolls another set.
  function showDrawResults(payload) {
    var modal = document.createElement('div');
    modal.className = 'gc-modal';
    var refundLine = (payload.refund_total > 0)
      ? '<div class="gc-modal-sub">+' + payload.refund_total + ' 냥 refunded for duplicates</div>'
      : '';
    var cards = (payload.items || []).map(function(r){
      var img = r.image_url || gachaImg((r.item_id || '').replace(/_/g, '-'));
      return '<div class="gc-result-card ' + rarityClass(r.rarity) + (r.is_dupe ? ' is-dupe' : '') + '">'
        + '<div class="gc-result-thumb"><img src="' + img + '" alt="" onerror="this.style.opacity=\'.15\'"></div>'
        + '<div class="gc-result-rar">' + (r.rarity || 'C') + '</div>'
        + '<div class="gc-result-name">' + (r.name || '') + '</div>'
        + (r.is_dupe ? '<div class="gc-result-dupe">Duplicate +' + (r.refund || 0) + ' 냥</div>' : '<div class="gc-result-new">NEW!</div>')
        + '</div>';
    }).join('');
    modal.innerHTML =
        '<div class="gc-modal-card">'
      +   '<div class="gc-modal-title">Draw Results</div>'
      +   refundLine
      +   '<div class="gc-result-grid">' + cards + '</div>'
      +   '<button class="gc-modal-btn" onclick="this.closest(\'.gc-modal\').remove()">Continue</button>'
      + '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e){ if (e.target === modal) modal.remove(); });
  }

  window.gachaDraw = async function(count) {
    if (!window.supaUser) {
      if (typeof openAuthModal === 'function') openAuthModal('signup');
      return;
    }
    var sb = (typeof getSupa === 'function') ? getSupa() : null;
    if (!sb) return;
    var btnSingle = document.getElementById('gc-btn-1');
    var btnFive   = document.getElementById('gc-btn-5');
    if (btnSingle) btnSingle.disabled = true;
    if (btnFive)   btnFive.disabled = true;
    try {
      var res = await sb.rpc('draw_gacha', { p_user_id: window.supaUser.id, p_count: count });
      if (res.error || !res.data || !res.data.ok) {
        var err = (res.data && res.data.error) || (res.error && res.error.message) || 'DRAW_FAILED';
        if (err === 'INSUFFICIENT_COIN') {
          if (typeof toast === 'function') toast('Not enough 냥. Need ' + (res.data.need || 0) + ', have ' + (res.data.have || 0) + '.', 'warn');
        } else if (err === 'EMPTY_POOL') {
          if (typeof toast === 'function') toast('The gacha pool is empty. Try again later.', 'warn');
        } else {
          if (typeof toast === 'function') toast('Draw failed: ' + err, 'error');
        }
        return;
      }
      showDrawResults(res.data);
      // Refresh balance + grid (newly owned items unlock).
      loadCatalogAndRender();
    } finally {
      if (btnSingle) btnSingle.disabled = false;
      if (btnFive)   btnFive.disabled = false;
    }
  };

  // ── Tab activation: kick off load only when the Gacha tab is selected.
  function _onShopTabClick() {
    var tab = this.getAttribute('data-tab');
    if (tab === 'gacha') {
      var pane = document.getElementById('gacha-pane');
      if (pane) pane.style.display = '';
      loadCatalogAndRender();
    } else {
      var pane = document.getElementById('gacha-pane');
      if (pane) pane.style.display = 'none';
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('.shop-tab').forEach(function(btn){
      btn.addEventListener('click', _onShopTabClick);
    });
  });

  // Expose for manual reload (e.g. after admin edits).
  window.gachaReload = loadCatalogAndRender;
})();
