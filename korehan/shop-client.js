(function(){
  var K_SHOP_ITEMS_FALLBACK = 'kh_shop_items_fallback';
  var K_SHOP_ITEMS_FALLBACK_DB = 'shop_items_fallback';
  var DEFAULT_SHOP_ITEMS = [
    {
      id: 'badge_founder',
      name: 'Founder Badge',
      slug: 'founder-badge',
      description: 'Display an exclusive Founder profile badge.',
      image_url: 'https://picsum.photos/seed/shop-founder-badge/640/360',
      item_type: 'profile_badge',
      coin_price: 120,
      cash_price: 0,
      is_active: true,
      can_buy_with_coin: true,
      can_buy_with_cash: false,
      is_repeatable: false,
      sort_order: 10
    },
    {
      id: 'cosmetic_neon_frame',
      name: 'Neon Profile Frame',
      slug: 'neon-profile-frame',
      description: 'Cosmetic frame for your profile image.',
      image_url: 'https://picsum.photos/seed/shop-neon-frame/640/360',
      item_type: 'profile_cosmetic',
      coin_price: 180,
      cash_price: 0,
      is_active: true,
      can_buy_with_coin: true,
      can_buy_with_cash: false,
      is_repeatable: false,
      sort_order: 20
    },
    {
      id: 'reporter_coffee',
      name: 'Reporter Coffee Treat',
      slug: 'reporter-coffee-treat',
      description: 'Give your favorite reporter a coffee boost.',
      image_url: 'https://picsum.photos/seed/shop-reporter-coffee/640/360',
      item_type: 'reporter_item',
      coin_price: 60,
      cash_price: 0,
      is_active: true,
      can_buy_with_coin: true,
      can_buy_with_cash: false,
      is_repeatable: true,
      sort_order: 30
    },
    {
      id: 'reporter_bubble_tea',
      name: 'Reporter Bubble Tea',
      slug: 'reporter-bubble-tea',
      description: 'A sweet bubble tea gift for your favorite reporter.',
      image_url: 'https://picsum.photos/seed/shop-reporter-bubble-tea/640/360',
      item_type: 'reporter_item',
      coin_price: 75,
      cash_price: 0,
      is_active: true,
      can_buy_with_coin: true,
      can_buy_with_cash: false,
      is_repeatable: true,
      sort_order: 40
    },
    {
      id: 'reporter_flower',
      name: 'Reporter Flower Bouquet',
      slug: 'reporter-flower-bouquet',
      description: 'A bouquet gift for reporter affinity moments.',
      image_url: 'https://picsum.photos/seed/shop-reporter-flower/640/360',
      item_type: 'reporter_item',
      coin_price: 95,
      cash_price: 0,
      is_active: true,
      can_buy_with_coin: true,
      can_buy_with_cash: false,
      is_repeatable: true,
      sort_order: 50
    }
  ];
  function isShopTableMissingErr(err) {
    var msg = (err && err.message) ? String(err.message) : '';
    return msg.indexOf("Could not find the table 'public.shop_items'") >= 0
      || msg.indexOf("relation \"public.shop_items\" does not exist") >= 0;
  }
  async function getLocalShopItems(sb) {
    if (sb) {
      try {
        var r = await sb.from('app_settings').select('value').eq('key', K_SHOP_ITEMS_FALLBACK_DB).maybeSingle();
        if (r && r.data && r.data.value) return Array.isArray(r.data.value) ? r.data.value : JSON.parse(r.data.value || '[]');
      } catch(e) {}
    }
    try { return JSON.parse(localStorage.getItem(K_SHOP_ITEMS_FALLBACK) || 'null') || []; }
    catch(e) { return []; }
  }
  async function setLocalShopItems(sb, items) {
    var data = items || [];
    if (sb) {
      try { await sb.from('app_settings').upsert({ key: K_SHOP_ITEMS_FALLBACK_DB, value: data }, { onConflict:'key' }); } catch(e) {}
    }
    localStorage.setItem(K_SHOP_ITEMS_FALLBACK, JSON.stringify(data));
  }

  async function ensureDefaultShopItems(sb) {
    try {
      var countRes = await sb.from('shop_items').select('id', { count:'exact', head:true });
      var itemCount = Number((countRes && countRes.count) || 0);
      if (itemCount > 0) return true;
      var seedRes = await sb.from('shop_items').upsert(DEFAULT_SHOP_ITEMS, { onConflict:'id' });
      if (!seedRes.error) return true;
      if (isShopTableMissingErr(seedRes.error)) {
        await setLocalShopItems(sb, DEFAULT_SHOP_ITEMS);
        return false;
      }
      return false;
    } catch(e) {
      return false;
    }
  }

  async function initShop() {
    if (!window.supaUser) return;
    var sb = getSupa(); if (!sb) return;
    await ensureDefaultShopItems(sb);

    var [{ data:stats }, itemsRes, { data:owned }] = await Promise.all([
      sb.from('user_stats').select('xp, coin_balance').eq('user_id', supaUser.id).maybeSingle(),
      sb.from('shop_items').select('*').eq('is_active', true).order('sort_order', { ascending:true }),
      sb.from('owned_items').select('item_id, quantity').eq('user_id', supaUser.id)
    ]);
    var dbItems = (itemsRes && itemsRes.data) || [];
    var usingFallback = !!(itemsRes && itemsRes.error && isShopTableMissingErr(itemsRes.error));
    var liveItems = usingFallback ? await getLocalShopItems(sb) : dbItems;
    if (!liveItems.length && usingFallback) {
      await setLocalShopItems(sb, DEFAULT_SHOP_ITEMS);
      liveItems = await getLocalShopItems(sb);
    }
    usingFallback = usingFallback || liveItems.length === 0;
    var catalog = usingFallback ? DEFAULT_SHOP_ITEMS : liveItems;

    document.getElementById('shop-xp').textContent = 'XP: ' + ((stats && stats.xp) || 0).toLocaleString();
    document.getElementById('shop-coin').textContent = '냥: ' + ((stats && stats.coin_balance) || 0).toLocaleString();

    var ownedMap = {};
    (owned || []).forEach(function(o){ ownedMap[o.item_id] = o.quantity || 0; });

    var grid = document.getElementById('shop-grid');
    grid.innerHTML = (usingFallback ? '<div style="grid-column:1/-1;padding:10px 14px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:10px;font-size:13px">기본 아이템 프리뷰를 표시 중입니다. 관리자 페이지에서 <b>Seed Default Items</b>를 눌러 DB에 실제 아이템을 생성하세요.</div>' : '')
      + catalog.map(function(it){
      var ownedQty = ownedMap[it.id] || 0;
      var notEnough = !!it.can_buy_with_coin && Number((stats && stats.coin_balance) || 0) < Number(it.coin_price || 0);
      var oneTimeOwned = !!ownedQty && !it.is_repeatable;
      var disabledByFallback = usingFallback ? 'disabled title="DB에 저장된 아이템이 없어 구매할 수 없습니다"' : '';
      var tabType = it.item_type === 'reporter_item' ? 'gift' : (it.item_type === 'profile_badge' || it.item_type === 'profile_cosmetic') ? 'profile' : it.can_buy_with_cash ? 'cash' : 'all';
      return '<article class="card" data-tab-type="' + tabType + '">'
        + '<div class="thumb"><img src="' + (it.image_url || 'https://picsum.photos/seed/shop-'+it.id+'/640/360') + '" alt="' + (it.name||'') + '"></div>'
        + '<div class="body">'
        + '<div class="title">' + (it.name || 'Item') + '</div>'
        + '<div class="desc">' + (it.description || '') + '</div>'
        + '<div class="price">'
        + (it.can_buy_with_coin ? '<span class="pill coin">🐾 ' + Number(it.coin_price||0) + ' 냥</span>' : '')
        + (it.can_buy_with_cash ? '<span class="pill cash">💳 $' + Number(it.cash_price||0).toFixed(2) + '</span>' : '')
        + '</div>'
        + (ownedQty ? '<div class="owned">Owned x' + ownedQty + '</div>' : '')
        + '<div class="btns">'
        + (it.can_buy_with_coin ? '<button class="btn coin" ' + ((notEnough || oneTimeOwned)?'disabled':'') + ' ' + disabledByFallback + ' onclick="window.buyWithCoin(\'' + it.id + '\')">냥으로 구매</button>' : '')
        + (it.can_buy_with_cash ? '<button class="btn cash" ' + (oneTimeOwned?'disabled':'') + ' ' + disabledByFallback + ' onclick="window.buyWithCash(\'' + it.id + '\')">Buy with Cash</button>' : '')
        + '</div></div></article>';
    }).join('');

    var itemMap = {};
    (catalog || []).forEach(function(it){ itemMap[it.id] = it; });
    document.getElementById('shop-inventory').innerHTML = (owned||[]).length
      ? (owned||[]).map(function(o){
          var it = itemMap[o.item_id] || {};
          return '<div class="inv-item"><b>' + (it.name || o.item_id) + '</b> · qty ' + (o.quantity||0) + (it.description ? '<div style="color:#64748b;margin-top:3px">' + it.description + '</div>' : '') + '</div>';
        }).join('')
      : '<div style="color:#94a3b8;font-size:13px">보유한 아이템이 아직 없습니다.</div>';
    // Apply current tab filter
    applyTab(_currentTab);
  }

  window.buyWithCoin = async function(itemId) {
    var sb = getSupa(); if (!sb || !supaUser) return;
    var res = await sb.rpc('purchase_coin_shop_item', { p_user_id: supaUser.id, p_item_id: itemId });
    if (res.error || !res.data || !res.data.ok) {
      alert((res.data && res.data.error) || (res.error && res.error.message) || 'Purchase failed.');
      return;
    }
    alert('냥으로 구매 완료!');
    initShop();
  };

  window.buyWithCash = async function(itemId) {
    var sb = getSupa(); if (!sb || !supaUser) return;
    var itemRes = await sb.from('shop_items').select('cash_price').eq('id', itemId).maybeSingle();
    var amount = Number(itemRes.data && itemRes.data.cash_price || 0);
    await sb.from('payment_orders').insert({ user_id: supaUser.id, item_id: itemId, amount: amount, currency: 'USD', status: 'pending', provider: 'manual_pending' });
    await sb.from('shop_purchases').insert({ user_id: supaUser.id, item_id: itemId, purchase_type: 'cash', cash_amount: amount, payment_status: 'pending' });
    alert('Cash checkout is prepared. Payment gateway connection can be plugged in next.');
    initShop();
  };

  // ── Room Items in Shop (loaded from DB, fallback hardcoded) ──
  var ROOM_ITEMS_FALLBACK = [
    {id:'character',  name:'Character',        price:0,   img:'assets/file_000000000570720694038be799df9f21-removebg-preview.png'},
    {id:'cat',        name:'Sleeping Cat',     price:15,  img:'assets/file_000000003a7c7209a3877df863e15fd9-removebg-preview.png'},
    {id:'poop',       name:'Happy Poop',       price:3,   img:'assets/file_000000004b247206b900dba933600c46-removebg-preview.png'},
    {id:'cushion',    name:'Reading Cushion',  price:10,  img:'assets/file_0000000064f872098fc13437d998de5a-removebg-preview.png'},
    {id:'lamp',       name:'Korean Lamp',      price:12,  img:'assets/file_00000000a2287209b632ccc0519de0e7-removebg-preview.png'},
    {id:'bookshelf',  name:'Bookshelf',        price:25,  img:'assets/file_00000000a66472069f5c058b95fd2322-removebg-preview.png'},
    {id:'plant',      name:'Potted Plant',     price:8,   img:'assets/file_00000000f734720691f7289c1f8a5e3c-removebg-preview.png'},
    {id:'fennec',     name:'Fennec Fox',       price:20,  img:'assets/file_0000000097387206868da2533972ee90-removebg-preview.png'},
    {id:'char_silver',name:'Silver Character', price:0,   img:'assets/file_00000000b8bc72069bc7877f36aaf27f-removebg-preview.png'},
    {id:'char_thumbs',name:'Thumbs Up Guy',    price:0,   img:'assets/file_00000000d40c7206bb289cd92deab487-removebg-preview.png'},
  ];
  var ROOM_ITEMS_SHOP = ROOM_ITEMS_FALLBACK.slice();
  var _shopRoomItemsLoaded = false;

  async function _ensureRoomItems() {
    if (_shopRoomItemsLoaded) return;
    var sb = typeof getSupa === 'function' ? getSupa() : null;
    if (!sb) return;
    try {
      var res = await sb.from('room_items').select('*').eq('active', true).order('sort_order');
      if (!res.error && res.data && res.data.length) {
        ROOM_ITEMS_SHOP = res.data.map(function(r) {
          return { id: r.id, name: r.name, price: r.price_nyang, img: r.image_url, size: r.base_size };
        });
        _shopRoomItemsLoaded = true;
      }
    } catch(e) {}
  }

  async function renderRoomShop() {
    var grid = document.getElementById('room-shop-grid');
    if (!grid) return;
    await _ensureRoomItems();
    var owned = [];
    try { owned = JSON.parse(localStorage.getItem('kh_room_owned')||'[]'); } catch(e){}
    grid.innerHTML = ROOM_ITEMS_SHOP.map(function(it){
      var isOwned = owned.indexOf(it.id) >= 0;
      return '<article class="card">'
        + '<div class="thumb"><img src="'+it.img+'" alt="'+it.name+'"></div>'
        + '<div class="body">'
        + '<div class="title">'+it.name+'</div>'
        + '<div class="desc">Room decoration item</div>'
        + (it.price > 0 ? '<div class="price"><span class="pill coin">🐾 '+it.price+' nyang</span></div>' : '<div class="price"><span class="pill coin">Free</span></div>')
        + (isOwned ? '<div class="owned">Owned ✓</div>' : '')
        + '<div class="btns">'
        + (isOwned ? '<button class="btn coin" disabled>Owned</button>' : '<button class="btn coin" onclick="window.buyRoomItem(\''+it.id+'\')">Buy with nyang</button>')
        + '</div></div></article>';
    }).join('');
  }

  window.buyRoomItem = async function(itemId) {
    var item = ROOM_ITEMS_SHOP.find(function(x){return x.id===itemId;});
    if (!item) return;
    var owned = [];
    try { owned = JSON.parse(localStorage.getItem('kh_room_owned')||'[]'); } catch(e){}
    if (owned.indexOf(itemId) >= 0) { alert('Already owned!'); return; }

    if (item.price > 0) {
      var sb = getSupa();
      if (!sb || !supaUser) { alert('Please sign in'); return; }
      var statsRes = await sb.from('user_stats').select('coin_balance').eq('user_id',supaUser.id).maybeSingle();
      var bal = (statsRes.data && statsRes.data.coin_balance) || 0;
      if (bal < item.price) { alert('Not enough nyang! (Need '+item.price+', have '+bal+')'); return; }
      await sb.from('user_stats').update({coin_balance: bal - item.price}).eq('user_id',supaUser.id);
    }

    owned.push(itemId);
    localStorage.setItem('kh_room_owned', JSON.stringify(owned));
    alert('Purchased ' + item.name + '! Place it in My Room.');
    renderRoomShop();
    initShop();
  };

  // ── Tab filtering ──
  var _currentTab = 'all';
  function itemMatchesTab(item, tab) {
    if (tab === 'all') return true;
    if (tab === 'gift') return item.item_type === 'reporter_item';
    if (tab === 'profile') return item.item_type === 'profile_badge' || item.item_type === 'profile_cosmetic';
    if (tab === 'cash') return !!item.can_buy_with_cash;
    return false; // room handled separately
  }
  function applyTab(tab) {
    _currentTab = tab;
    var tabs = document.querySelectorAll('.shop-tab');
    tabs.forEach(function(t){ t.classList.toggle('active', t.getAttribute('data-tab') === tab); });
    var shopGrid = document.getElementById('shop-grid');
    var roomGrid = document.getElementById('room-shop-grid');
    var invSection = document.getElementById('shop-inventory-section');
    if (tab === 'room') {
      shopGrid.style.display = 'none';
      roomGrid.style.display = '';
      if (invSection) invSection.style.display = 'none';
    } else {
      shopGrid.style.display = '';
      roomGrid.style.display = 'none';
      if (invSection) invSection.style.display = '';
      // filter visible cards
      var cards = shopGrid.querySelectorAll('.card');
      cards.forEach(function(card) {
        var cardTab = card.getAttribute('data-tab-type') || 'all';
        var show = tab === 'all' || cardTab === tab;
        card.style.display = show ? '' : 'none';
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    // Tab click handlers
    document.querySelectorAll('.shop-tab').forEach(function(btn){
      btn.addEventListener('click', function(){ applyTab(this.getAttribute('data-tab')); });
    });
    function _startShop() { initShop(); renderRoomShop(); }
    // supaUser가 이미 있으면 즉시 실행, 없으면 이벤트 대기
    if (window.supaUser) {
      _startShop();
    } else {
      window.addEventListener('kh-auth-signed-in', function() { _startShop(); }, { once: true });
      // 세션 체크 완료 후에도 미로그인이면 실행 (게스트 모드)
      var _fallback = setTimeout(function() { if (!window.supaUser) _startShop(); }, 3000);
      window.addEventListener('kh-auth-signed-in', function() { clearTimeout(_fallback); }, { once: true });
    }
  });
})();
