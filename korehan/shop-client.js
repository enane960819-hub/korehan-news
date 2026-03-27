(function(){
  var K_SHOP_ITEMS_FALLBACK = 'kh_shop_items_fallback';
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
  function getLocalShopItems() {
    try { return JSON.parse(localStorage.getItem(K_SHOP_ITEMS_FALLBACK) || 'null') || []; }
    catch(e) { return []; }
  }
  function setLocalShopItems(items) {
    localStorage.setItem(K_SHOP_ITEMS_FALLBACK, JSON.stringify(items || []));
  }

  async function ensureDefaultShopItems(sb) {
    try {
      var countRes = await sb.from('shop_items').select('id', { count:'exact', head:true });
      var itemCount = Number((countRes && countRes.count) || 0);
      if (itemCount > 0) return true;
      var seedRes = await sb.from('shop_items').upsert(DEFAULT_SHOP_ITEMS, { onConflict:'id' });
      if (!seedRes.error) return true;
      if (isShopTableMissingErr(seedRes.error)) {
        setLocalShopItems(DEFAULT_SHOP_ITEMS);
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
    var liveItems = usingFallback ? getLocalShopItems() : dbItems;
    if (!liveItems.length && usingFallback) {
      setLocalShopItems(DEFAULT_SHOP_ITEMS);
      liveItems = getLocalShopItems();
    }
    usingFallback = usingFallback || liveItems.length === 0;
    var catalog = usingFallback ? DEFAULT_SHOP_ITEMS : liveItems;

    document.getElementById('shop-xp').textContent = 'XP: ' + ((stats && stats.xp) || 0).toLocaleString();
    document.getElementById('shop-coin').textContent = 'Coin: ' + ((stats && stats.coin_balance) || 0).toLocaleString();

    var ownedMap = {};
    (owned || []).forEach(function(o){ ownedMap[o.item_id] = o.quantity || 0; });

    var grid = document.getElementById('shop-grid');
    grid.innerHTML = (usingFallback ? '<div style="grid-column:1/-1;padding:10px 14px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:10px;font-size:13px">기본 아이템 프리뷰를 표시 중입니다. 관리자 페이지에서 <b>Seed Default Items</b>를 눌러 DB에 실제 아이템을 생성하세요.</div>' : '')
      + catalog.map(function(it){
      var ownedQty = ownedMap[it.id] || 0;
      var notEnough = !!it.can_buy_with_coin && Number((stats && stats.coin_balance) || 0) < Number(it.coin_price || 0);
      var oneTimeOwned = !!ownedQty && !it.is_repeatable;
      var disabledByFallback = usingFallback ? 'disabled title="DB에 저장된 아이템이 없어 구매할 수 없습니다"' : '';
      return '<article class="card">'
        + '<div class="thumb" style="background-image:url(\'' + (it.image_url || 'https://picsum.photos/seed/shop-'+it.id+'/640/360') + '\')"></div>'
        + '<div class="body">'
        + '<div class="title">' + (it.name || 'Item') + '</div>'
        + '<div class="desc">' + (it.description || '') + '</div>'
        + '<div class="price">'
        + (it.can_buy_with_coin ? '<span class="pill coin">🪙 ' + Number(it.coin_price||0) + ' Coin</span>' : '')
        + (it.can_buy_with_cash ? '<span class="pill cash">💳 $' + Number(it.cash_price||0).toFixed(2) + '</span>' : '')
        + '</div>'
        + (ownedQty ? '<div class="owned">Owned x' + ownedQty + '</div>' : '')
        + '<div class="btns">'
        + (it.can_buy_with_coin ? '<button class="btn coin" ' + ((notEnough || oneTimeOwned)?'disabled':'') + ' ' + disabledByFallback + ' onclick="window.buyWithCoin(\'' + it.id + '\')">Buy with Coin</button>' : '')
        + (it.can_buy_with_cash ? '<button class="btn cash" ' + (oneTimeOwned?'disabled':'') + ' ' + disabledByFallback + ' onclick="window.buyWithCash(\'' + it.id + '\')">Buy with Cash</button>' : '')
        + '</div></div></article>';
    }).join('');

    document.getElementById('shop-inventory').innerHTML = (owned||[]).length
      ? (owned||[]).map(function(o){ return '<div class="inv-item">' + o.item_id + ' · qty ' + (o.quantity||0) + '</div>'; }).join('')
      : '<div style="color:#94a3b8;font-size:13px">No purchased items yet.</div>';
  }

  window.buyWithCoin = async function(itemId) {
    var sb = getSupa(); if (!sb || !supaUser) return;
    var res = await sb.rpc('purchase_coin_shop_item', { p_user_id: supaUser.id, p_item_id: itemId });
    if (res.error || !res.data || !res.data.ok) {
      alert((res.data && res.data.error) || (res.error && res.error.message) || 'Purchase failed');
      return;
    }
    alert('Purchased successfully with Coin!');
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

  document.addEventListener('DOMContentLoaded', function(){
    var attempts = 0;
    (function waitSession(){ attempts++; if (window.supaUser || attempts > 25) initShop(); else setTimeout(waitSession, 200); })();
  });
})();
