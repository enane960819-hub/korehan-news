(function(){
  var K_SHOP_ITEMS_FALLBACK = 'kh_shop_items_fallback';
  var K_SHOP_ITEMS_FALLBACK_DB = 'shop_items_fallback';
  // Image convention: assets/shop/<slug>.png — drop files with those names in
  // /korehan/assets/shop/ and they'll show up automatically. Missing images
  // fall back to a category-coloured emoji card (NOT a random picsum photo,
  // which previously made every unlaunched item look like a stock-photo
  // placeholder masquerading as a real item).
  function shopImg(slug) { return 'assets/shop/' + slug + '.png'; }
  // Room-decoration art is dropped into assets/room/ over time; until a
  // file lands, degrade the missing image to a soft emoji placeholder
  // instead of a broken-image icon.
  window._shopRoomImgFallback = function (img) {
    if (!img || img.dataset.fbk) return;
    img.dataset.fbk = '1';
    var t = img.parentNode;
    if (!t) { img.style.display = 'none'; return; }
    t.innerHTML = '<div style="aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;'
      + 'background:linear-gradient(135deg,#eef2ff,#e0e7ff);color:#6366f1;width:100%;height:100%;border-radius:8px"><i data-lucide="sofa" style="width:44px;height:44px" aria-hidden="true"></i></div>';
    if (typeof renderKhLucideIcons === 'function') renderKhLucideIcons();
  };

  // Category → icon + gradient. Picked to feel intentional: badges look
  // like a medal, titles look like a star, room items look like a plant, etc.
  var SHOP_TYPE_VISUAL = {
    profile_badge:    { icon: 'medal', bg: 'linear-gradient(135deg,#fbbf24,#f59e0b)' },
    profile_title:    { icon: 'star', bg: 'linear-gradient(135deg,#a78bfa,#7c3aed)' },
    profile_cosmetic: { icon: 'sparkles', bg: 'linear-gradient(135deg,#f0abfc,#c026d3)' },
    reporter_item:    { icon: 'camera', bg: 'linear-gradient(135deg,#fbcfe8,#ec4899)' },
    room_item:        { icon: 'sprout', bg: 'linear-gradient(135deg,#86efac,#22c55e)' },
    sticker_pack:     { icon: 'palette', bg: 'linear-gradient(135deg,#fda4af,#ef4444)' },
    consumable:       { icon: 'pill', bg: 'linear-gradient(135deg,#93c5fd,#3b82f6)' },
  };
  function renderShopThumb(it) {
    if (it && it.image_url) {
      return '<img src="' + it.image_url + '" alt="' + ((it.name||'').replace(/"/g,'&quot;')) + '">';
    }
    var v = SHOP_TYPE_VISUAL[it && it.item_type] || { icon: 'gift', bg: 'linear-gradient(135deg,#cbd5e1,#94a3b8)' };
    return '<div style="width:100%;height:100%;border-radius:8px;display:flex;align-items:center;justify-content:center;background:' + v.bg + ';color:#fff" aria-label="' + ((it && it.name) || 'Item') + '"><i data-lucide="' + v.icon + '" style="width:44px;height:44px" aria-hidden="true"></i></div>';
  }
  function _mk(o) {
    return Object.assign({
      slug: o.id.replace(/_/g, '-'),
      // Leave image_url null when the seed didn't supply one — renderShopThumb
      // will paint a category-emoji card instead of a 404 broken image.
      image_url: o.image_url || null,
      cash_price: 0,
      is_active: true,
      can_buy_with_coin: true,
      can_buy_with_cash: false,
      is_repeatable: false
    }, o);
  }
  var DEFAULT_SHOP_ITEMS = [
    // ── Profile badges ────────────────────────────────────────
    _mk({ id:'badge_founder',        name:'Founder Badge',         description:'Display an exclusive Founder profile badge.',             item_type:'profile_badge', coin_price:120, sort_order:10 }),
    _mk({ id:'badge_early_bird',     name:'Early Bird Badge',      description:'For learners who study before 8 AM.',                     item_type:'profile_badge', coin_price:90,  sort_order:11 }),
    _mk({ id:'badge_night_owl',      name:'Night Owl Badge',       description:'For learners who study after midnight.',                  item_type:'profile_badge', coin_price:90,  sort_order:12 }),
    _mk({ id:'badge_verified',       name:'Verified Learner Badge',description:'A blue verified check for your profile.',                 item_type:'profile_badge', coin_price:200, sort_order:13 }),
    _mk({ id:'badge_polyglot',       name:'Polyglot Badge',        description:'Show off that Korean isn\'t your first non-native language.', item_type:'profile_badge', coin_price:160, sort_order:14 }),
    _mk({ id:'badge_vip',            name:'VIP Star Badge',        description:'A shining gold star for VIP supporters.',                 item_type:'profile_badge', coin_price:0,   cash_price:4.99, can_buy_with_coin:false, can_buy_with_cash:true, sort_order:15 }),

    // ── Profile cosmetics (frames, themes) ────────────────────
    _mk({ id:'cosmetic_neon_frame',  name:'Neon Profile Frame',    description:'Cosmetic frame for your profile image.',                  item_type:'profile_cosmetic', coin_price:180, sort_order:20 }),
    _mk({ id:'cosmetic_sakura_frame',name:'Sakura Profile Frame',  description:'Pink cherry blossom frame for spring vibes.',             item_type:'profile_cosmetic', coin_price:160, sort_order:21 }),
    _mk({ id:'cosmetic_hanbok_frame',name:'Hanbok Profile Frame',  description:'Traditional Korean hanbok-inspired frame.',               item_type:'profile_cosmetic', coin_price:220, sort_order:22 }),
    _mk({ id:'cosmetic_gold_frame',  name:'Gold Profile Frame',    description:'Luxe gold border for the showoffs.',                      item_type:'profile_cosmetic', coin_price:260, sort_order:23 }),
    _mk({ id:'cosmetic_pastel_theme',name:'Pastel Theme',          description:'Soft pastel UI theme for the whole site.',                item_type:'profile_cosmetic', coin_price:300, sort_order:24 }),
    _mk({ id:'cosmetic_retro_theme', name:'Retro Pixel Theme',     description:'8-bit pixel aesthetic for the whole UI.',                 item_type:'profile_cosmetic', coin_price:320, sort_order:25 }),

    // ── Reporter gifts ────────────────────────────────────────
    _mk({ id:'reporter_coffee',      name:'Reporter Coffee Treat', description:'Give your favorite reporter a coffee boost.',            item_type:'reporter_item', coin_price:60,  is_repeatable:true, sort_order:30 }),
    _mk({ id:'reporter_bubble_tea',  name:'Reporter Bubble Tea',   description:'A sweet bubble tea gift for your favorite reporter.',    item_type:'reporter_item', coin_price:75,  is_repeatable:true, sort_order:31 }),
    _mk({ id:'reporter_flower',      name:'Reporter Flower Bouquet', description:'A bouquet gift for reporter affinity moments.',       item_type:'reporter_item', coin_price:95,  is_repeatable:true, sort_order:32 }),
    _mk({ id:'reporter_macaron',     name:'Macaron Set',           description:'A colorful box of French macarons.',                     item_type:'reporter_item', coin_price:80,  is_repeatable:true, sort_order:33 }),
    _mk({ id:'reporter_kimbap',      name:'Kimbap Lunch',          description:'Hand-rolled kimbap to fuel the newsroom.',               item_type:'reporter_item', coin_price:55,  is_repeatable:true, sort_order:34 }),
    _mk({ id:'reporter_ramen',       name:'Spicy Ramen',           description:'A steaming bowl of spicy ramen for late nights.',        item_type:'reporter_item', coin_price:50,  is_repeatable:true, sort_order:35 }),
    _mk({ id:'reporter_samgyetang',  name:'Samgyetang',            description:'Warming ginseng chicken soup — perfect for rainy days.', item_type:'reporter_item', coin_price:140, is_repeatable:true, sort_order:36 }),
    _mk({ id:'reporter_bingsu',      name:'Mango Bingsu',          description:'Icy mango bingsu to beat the summer heat.',              item_type:'reporter_item', coin_price:110, is_repeatable:true, sort_order:37 }),
    _mk({ id:'reporter_cake',        name:'Birthday Cake',         description:'A slice of strawberry shortcake — birthdays only.',      item_type:'reporter_item', coin_price:200, is_repeatable:true, sort_order:38 }),
    _mk({ id:'reporter_concert',     name:'Concert Tickets',       description:'Premium concert tickets for a special thanks.',          item_type:'reporter_item', coin_price:450, is_repeatable:true, sort_order:39 }),
    _mk({ id:'reporter_gift_box',    name:'Holiday Gift Box',      description:'Seasonal gift box with assorted Korean treats.',         item_type:'reporter_item', coin_price:180, is_repeatable:true, sort_order:40 }),

    // ── Cash-only premium items ───────────────────────────────
    // Design rule: nothing on this list may give an advantage for learning
    // progress (XP, streaks, AI access, gated lesson content). Everything is
    // cosmetic, currency (spendable on cosmetics), ad-free, or gift tokens.
    //
    // Nyang currency packs
    _mk({ id:'cash_nyang_pack_sm',   name:'Nyang Pack · Small',    description:'Adds 500 Nyang to your balance — spend on room items & cosmetics.',   item_type:'currency_pack', coin_price:0, cash_price:2.99,  can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:true, sort_order:90 }),
    _mk({ id:'cash_nyang_pack_md',   name:'Nyang Pack · Medium',   description:'Adds 1,200 Nyang + 10% bonus — for cosmetic & room purchases.',       item_type:'currency_pack', coin_price:0, cash_price:5.99,  can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:true, sort_order:91 }),
    _mk({ id:'cash_nyang_pack_lg',   name:'Nyang Pack · Large',    description:'Adds 3,000 Nyang + 20% bonus — stock up on room items.',              item_type:'currency_pack', coin_price:0, cash_price:12.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:true, sort_order:92 }),
    _mk({ id:'cash_nyang_pack_xl',   name:'Nyang Pack · Mega',     description:'Adds 7,000 Nyang + 30% bonus — best value for decorators.',           item_type:'currency_pack', coin_price:0, cash_price:24.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:true, sort_order:93 }),
    _mk({ id:'cash_nyang_pack_ultra',name:'Nyang Pack · Ultra',    description:'Adds 20,000 Nyang + 40% bonus — deck out the whole room.',            item_type:'currency_pack', coin_price:0, cash_price:59.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:true, sort_order:94 }),

    // Supporter tiers — cosmetic + ad-free only (no learning perks)
    _mk({ id:'cash_supporter_month', name:'Supporter · 1 Month',   description:'Supporter badge + 1,000 Nyang + ad-free reading. No learning perks.',  item_type:'subscription',  coin_price:0, cash_price:4.99,  can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:true, sort_order:100 }),
    _mk({ id:'cash_supporter_3mo',   name:'Supporter · 3 Months',  description:'Supporter badge + 3,500 Nyang + ad-free + monthly sticker drop.',     item_type:'subscription',  coin_price:0, cash_price:11.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:true, sort_order:101 }),
    _mk({ id:'cash_supporter_6mo',   name:'Supporter · 6 Months',  description:'Supporter badge + 7,500 Nyang + ad-free + exclusive room effect.',    item_type:'subscription',  coin_price:0, cash_price:22.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:true, sort_order:102 }),
    _mk({ id:'cash_supporter_year',  name:'Supporter · 1 Year',    description:'Supporter Gold badge + 18,000 Nyang + ad-free + seasonal cosmetics.',  item_type:'subscription',  coin_price:0, cash_price:39.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:true, sort_order:103 }),
    _mk({ id:'cash_supporter_lifetime', name:'Supporter · Lifetime', description:'Forever Supporter badge + lifetime ad-free + every future cosmetic drop.', item_type:'subscription', coin_price:0, cash_price:149.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:104 }),
    _mk({ id:'cash_ad_free_month',   name:'Ad-Free · 1 Month',     description:'Removes all ad placements for 30 days. No learning perks.',        item_type:'subscription',  coin_price:0, cash_price:2.99,  can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:true, sort_order:105 }),

    // Room effects — ambient visual-only overlays for My Room
    _mk({ id:'cash_fx_sakura',       name:'Room FX · Sakura Petals', description:'Cherry blossom petals drift across your room year-round.',      item_type:'room_fx', coin_price:0, cash_price:2.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:110 }),
    _mk({ id:'cash_fx_snow',         name:'Room FX · Soft Snowfall', description:'Gentle snow falls inside your room. Pure vibes.',              item_type:'room_fx', coin_price:0, cash_price:2.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:111 }),
    _mk({ id:'cash_fx_fireflies',    name:'Room FX · Fireflies',     description:'Glowing fireflies float around your room at night.',           item_type:'room_fx', coin_price:0, cash_price:2.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:112 }),
    _mk({ id:'cash_fx_rain',         name:'Room FX · Window Rain',   description:'Soft rain streaks on the window for lo-fi study vibes.',       item_type:'room_fx', coin_price:0, cash_price:2.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:113 }),
    _mk({ id:'cash_fx_moonlight',    name:'Room FX · Moonlight',     description:'Cool moonbeam wash with drifting stars.',                      item_type:'room_fx', coin_price:0, cash_price:2.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:114 }),
    _mk({ id:'cash_fx_fireworks',    name:'Room FX · Fireworks',     description:'Celebratory fireworks burst through the window every so often.', item_type:'room_fx', coin_price:0, cash_price:3.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:115 }),
    _mk({ id:'cash_fx_bundle',       name:'Room FX · Weather Pack',  description:'All 5 ambient effects: sakura, snow, fireflies, rain, moonlight.', item_type:'bundle', coin_price:0, cash_price:9.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:116 }),

    // Room wallpapers & floors
    _mk({ id:'cash_wall_hanok',      name:'Wallpaper · Hanok',       description:'Traditional hanok wood panel walls for your room.',              item_type:'room_surface', coin_price:0, cash_price:3.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:120 }),
    _mk({ id:'cash_wall_cyberpunk',  name:'Wallpaper · Neon Seoul',  description:'Cyberpunk neon-skyline walls — night in Gangnam.',              item_type:'room_surface', coin_price:0, cash_price:3.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:121 }),
    _mk({ id:'cash_wall_minimal',    name:'Wallpaper · Minimalist',  description:'Clean white studio walls with a single accent line.',           item_type:'room_surface', coin_price:0, cash_price:3.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:122 }),
    _mk({ id:'cash_wall_night',      name:'Wallpaper · Night Sky',   description:'Starry night wall with subtle twinkle animation.',              item_type:'room_surface', coin_price:0, cash_price:4.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:123 }),
    _mk({ id:'cash_floor_hardwood',  name:'Floor · Hardwood',        description:'Warm hardwood floor for your room base.',                       item_type:'room_surface', coin_price:0, cash_price:3.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:124 }),
    _mk({ id:'cash_floor_tatami',    name:'Floor · Tatami',          description:'Tatami mat flooring — Japanese + Joseon inspiration.',          item_type:'room_surface', coin_price:0, cash_price:3.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:125 }),
    _mk({ id:'cash_floor_marble',    name:'Floor · Marble',          description:'Polished marble floor for a luxe aesthetic.',                   item_type:'room_surface', coin_price:0, cash_price:4.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:126 }),

    // Profile name / chat cosmetics
    _mk({ id:'cash_name_color',      name:'Username Color',          description:'Pick any color for your display name. One-time purchase.',      item_type:'profile_cosmetic', coin_price:0, cash_price:3.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:130 }),
    _mk({ id:'cash_name_glow',       name:'Username Glow',           description:'Soft pulsing glow around your display name.',                   item_type:'profile_cosmetic', coin_price:0, cash_price:4.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:131 }),
    _mk({ id:'cash_name_rainbow',    name:'Rainbow Username',        description:'Animated rainbow gradient on your display name.',               item_type:'profile_cosmetic', coin_price:0, cash_price:6.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:132 }),
    _mk({ id:'cash_banner_sakura',   name:'Profile Banner · Sakura', description:'Pink cherry blossom banner across the top of your profile.',  item_type:'profile_cosmetic', coin_price:0, cash_price:3.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:133 }),
    _mk({ id:'cash_banner_seoul',    name:'Profile Banner · Seoul',  description:'Seoul skyline at sunset banner for your profile header.',       item_type:'profile_cosmetic', coin_price:0, cash_price:3.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:134 }),
    _mk({ id:'cash_banner_hanok',    name:'Profile Banner · Hanok',  description:'Traditional hanok village banner for your profile header.',     item_type:'profile_cosmetic', coin_price:0, cash_price:3.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:135 }),

    // Sticker / emoji packs (chat + conversations)
    _mk({ id:'cash_stickers_emoji',   name:'Premium Emoji Pack',     description:'20 extra Korean-themed emojis for chat & reactions.',           item_type:'sticker_pack', coin_price:0, cash_price:1.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:140 }),
    _mk({ id:'cash_stickers_animated', name:'Animated Sticker Pack', description:'10 animated Korean character stickers.',                        item_type:'sticker_pack', coin_price:0, cash_price:4.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:141 }),
    _mk({ id:'cash_stickers_kpop',    name:'K-Pop Sticker Pack',     description:'Light-stick, heart, and cheer sticker set.',                    item_type:'sticker_pack', coin_price:0, cash_price:3.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:142 }),
    _mk({ id:'cash_stickers_food',    name:'Food Sticker Pack',      description:'Kimchi, bibimbap, bingsu — a food-lover sticker set.',          item_type:'sticker_pack', coin_price:0, cash_price:3.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:143 }),
    _mk({ id:'cash_stickers_seasonal',name:'Seasonal Sticker Pack',  description:'Seollal, Chuseok, and holiday themed stickers.',                item_type:'sticker_pack', coin_price:0, cash_price:3.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:144 }),

    // Exclusive cosmetic frames / themes (unchanged, one-time)
    _mk({ id:'cash_frame_holographic', name:'Holographic Frame',     description:'Animated holo shimmer profile frame. Cash-exclusive.',          item_type:'profile_cosmetic', coin_price:0, cash_price:3.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:150 }),
    _mk({ id:'cash_frame_rainbow',     name:'Rainbow Aura Frame',    description:'Flowing rainbow aura around your profile picture.',             item_type:'profile_cosmetic', coin_price:0, cash_price:3.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:151 }),
    _mk({ id:'cash_frame_galaxy',      name:'Galaxy Frame',          description:'Swirling galaxy animation frame for your profile.',             item_type:'profile_cosmetic', coin_price:0, cash_price:4.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:152 }),
    _mk({ id:'cash_frame_ink',         name:'Sumi Ink Frame',        description:'Hand-painted traditional ink brush frame.',                     item_type:'profile_cosmetic', coin_price:0, cash_price:2.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:153 }),
    _mk({ id:'cash_theme_midnight',    name:'Midnight Theme',        description:'Deep navy + neon accents — cash-exclusive UI theme.',           item_type:'profile_cosmetic', coin_price:0, cash_price:3.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:154 }),
    _mk({ id:'cash_theme_hanok',       name:'Hanok Theme',           description:'Warm woods + traditional palette inspired by 한옥.',             item_type:'profile_cosmetic', coin_price:0, cash_price:3.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:155 }),
    _mk({ id:'cash_theme_sunset',      name:'Sunset Theme',          description:'Warm orange/pink gradient UI theme.',                           item_type:'profile_cosmetic', coin_price:0, cash_price:3.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:156 }),

    // Limited-edition badges (cash-only, cosmetic)
    _mk({ id:'cash_badge_founder_plus', name:'Founder+ Badge',       description:'Exclusive platinum Founder+ badge. Limited edition.',           item_type:'profile_badge',    coin_price:0, cash_price:9.99,  can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:160 }),
    _mk({ id:'cash_badge_og_member',    name:'OG Member Badge',      description:'Show you were here from the start. One-time unlock.',            item_type:'profile_badge',    coin_price:0, cash_price:7.99,  can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:161 }),
    _mk({ id:'cash_badge_patron',       name:'Patron of Hangul',     description:'For patrons of the Korean learning community.',                  item_type:'profile_badge',    coin_price:0, cash_price:14.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:162 }),

    // Bundles (cosmetic only)
    _mk({ id:'cash_bundle_starter',     name:'Cosmetic Starter Pack', description:'2,000 Nyang + Sakura frame + Sakura room effect. No learning perks.', item_type:'bundle', coin_price:0, cash_price:9.99,  can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:170 }),
    _mk({ id:'cash_bundle_kpop',        name:'K-Pop Fan Bundle',      description:'K-Pop poster + light stick + neon sign + K-Pop sticker pack.',    item_type:'bundle', coin_price:0, cash_price:7.99,  can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:171 }),
    _mk({ id:'cash_bundle_traditional', name:'Traditional Korea Bundle', description:'Hanbok doll + Joseon scholar + mini temple + calligraphy.',   item_type:'bundle', coin_price:0, cash_price:12.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:172 }),
    _mk({ id:'cash_bundle_cozy',        name:'Cozy Room Bundle',      description:'Desk + chair + piano + bonsai + tea set. Pure aesthetic.',        item_type:'bundle', coin_price:0, cash_price:14.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:173 }),
    _mk({ id:'cash_bundle_hanok_room',  name:'Hanok Room Bundle',     description:'Hanok wallpaper + tatami floor + paper lantern + tea table.',     item_type:'bundle', coin_price:0, cash_price:12.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:174 }),
    _mk({ id:'cash_bundle_neon_room',   name:'Neon Seoul Bundle',     description:'Neon Seoul wallpaper + marble floor + neon sign + light stick.',  item_type:'bundle', coin_price:0, cash_price:12.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:175 }),
    _mk({ id:'cash_bundle_premium',     name:'Premium Everything',    description:'1-month Supporter + Galaxy frame + Night Sky wallpaper + 5,000 Nyang.', item_type:'bundle', coin_price:0, cash_price:19.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:176 }),

    // Exclusive pets / characters / furniture (cosmetic only)
    _mk({ id:'cash_pet_dragon',       name:'Mini Korean Dragon',    description:'Legendary room pet. Cash-exclusive, one per account.',            item_type:'room_item',  coin_price:0, cash_price:6.99,  can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:180 }),
    _mk({ id:'cash_pet_phoenix',      name:'Fire Phoenix',          description:'Glowing phoenix pet that hovers in your room.',                   item_type:'room_item',  coin_price:0, cash_price:8.99,  can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:181 }),
    _mk({ id:'cash_pet_jindo',        name:'Jindo Dog',             description:'Loyal Jindo companion for your room. Cash-exclusive.',            item_type:'room_item',  coin_price:0, cash_price:5.99,  can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:182 }),
    _mk({ id:'cash_room_throne',      name:'Royal Throne',          description:'Gilded Joseon-style throne. Cash-exclusive furniture.',           item_type:'room_item',  coin_price:0, cash_price:6.99,  can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:183 }),

    // Gifting (nyang / supporter only — can't gift learning perks)
    _mk({ id:'cash_gift_nyang_500',   name:'Gift · 500 Nyang to Friend', description:'Send 500 Nyang directly to a friend\'s account.',                  item_type:'gift_token', coin_price:0, cash_price:2.99,  can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:true, sort_order:190 }),
    _mk({ id:'cash_gift_supporter',   name:'Gift · Supporter 1mo',  description:'Gift a friend one month of Supporter cosmetic perks.',            item_type:'gift_token', coin_price:0, cash_price:4.99,  can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:true, sort_order:191 }),

    // ── Coin badges (learning achievement themed) ─────────────
    _mk({ id:'badge_streak_warrior', name:'Streak Warrior',       description:'For learners with a long-running daily streak.',           item_type:'profile_badge', coin_price:140, sort_order:200 }),
    _mk({ id:'badge_word_hunter',    name:'Word Hunter',          description:'Show off your growing vocabulary collection.',             item_type:'profile_badge', coin_price:120, sort_order:201 }),
    _mk({ id:'badge_quiz_champion',  name:'Quiz Champion',        description:'For perfect scorers and quiz devotees.',                   item_type:'profile_badge', coin_price:160, sort_order:202 }),
    _mk({ id:'badge_news_junkie',    name:'News Junkie',          description:'Read 100+ articles? Wear it loud.',                        item_type:'profile_badge', coin_price:140, sort_order:203 }),
    _mk({ id:'badge_kdrama_fan',     name:'K-Drama Fan',          description:'For fans of Korean shows & cinema.',                       item_type:'profile_badge', coin_price:100, sort_order:204 }),
    _mk({ id:'badge_kpop_stan',      name:'K-Pop Stan',           description:'Show your K-pop fan loyalty.',                             item_type:'profile_badge', coin_price:100, sort_order:205 }),
    _mk({ id:'badge_topik_chaser',   name:'TOPIK Chaser',         description:'For learners aiming at TOPIK certification.',              item_type:'profile_badge', coin_price:200, sort_order:206 }),
    _mk({ id:'badge_explorer',       name:'Section Explorer',     description:'For readers who roam every news section.',                 item_type:'profile_badge', coin_price:130, sort_order:207 }),

    // ── Coin titles (display next to your name) ───────────────
    // New item_type 'profile_title'. The display hook lives in shared.js
    // formatDisplayName() — a missing/inactive title just renders the
    // username as before.
    _mk({ id:'title_seed',           name:'Title · Seed (새싹)',          description:'A friendly title showing you\'re just starting out.',       item_type:'profile_title', coin_price:60,  sort_order:220 }),
    _mk({ id:'title_sprout',         name:'Title · Sprout (떡잎)',          description:'Tiny sprout title for early learners.',                    item_type:'profile_title', coin_price:80,  sort_order:221 }),
    _mk({ id:'title_tree',           name:'Title · Tree (나무)',          description:'For solid intermediate learners.',                         item_type:'profile_title', coin_price:120, sort_order:222 }),
    _mk({ id:'title_forest',         name:'Title · Forest (숲)',            description:'Advanced learner — you ARE the forest.',                  item_type:'profile_title', coin_price:180, sort_order:223 }),
    _mk({ id:'title_scholar',        name:'Title · Scholar (학자)',          description:'For serious students of Korean.',                          item_type:'profile_title', coin_price:160, sort_order:224 }),
    _mk({ id:'title_word_master',    name:'Title · Word Master (단어 마스터)',   description:'Vocabulary champion title.',                              item_type:'profile_title', coin_price:140, sort_order:225 }),
    _mk({ id:'title_news_addict',    name:'Title · News Addict (뉴스 중독자)',   description:'Title for the daily news binger.',                        item_type:'profile_title', coin_price:120, sort_order:226 }),
    _mk({ id:'title_night_owl',      name:'Title · Night Owl (야행성)',        description:'For learners who study after midnight.',                  item_type:'profile_title', coin_price:100, sort_order:227 }),
    _mk({ id:'title_early_bird',     name:'Title · Early Bird (아침형 인간)',   description:'For learners who study at dawn.',                          item_type:'profile_title', coin_price:100, sort_order:228 }),
    _mk({ id:'title_polyglot',       name:'Title · Polyglot',      description:'You speak more than one non-native language.',            item_type:'profile_title', coin_price:140, sort_order:229 }),
    _mk({ id:'title_kimchi_lover',   name:'Title · Kimchi Lover (김치 러버)',     description:'A fun title for Korean food fans.',                       item_type:'profile_title', coin_price:90,  sort_order:230 }),
    _mk({ id:'title_seoulite',       name:'Title · Seoulite (서울러)',        description:'For lovers of Seoul.',                                    item_type:'profile_title', coin_price:90,  sort_order:231 }),

    // ── Coin frames (more variety so coin spend has somewhere to go) ──
    _mk({ id:'cosmetic_aurora_frame',  name:'Aurora Frame',        description:'Northern-lights gradient profile frame.',                  item_type:'profile_cosmetic', coin_price:200, sort_order:240 }),
    _mk({ id:'cosmetic_mint_frame',    name:'Mint Frame',          description:'Cool mint gradient frame.',                                item_type:'profile_cosmetic', coin_price:140, sort_order:241 }),
    _mk({ id:'cosmetic_coral_frame',   name:'Coral Frame',         description:'Warm coral pink frame.',                                   item_type:'profile_cosmetic', coin_price:140, sort_order:242 }),
    _mk({ id:'cosmetic_royal_frame',   name:'Royal Purple Frame',  description:'Regal purple frame for serious learners.',                 item_type:'profile_cosmetic', coin_price:220, sort_order:243 }),
    _mk({ id:'cosmetic_chuseok_frame', name:'Chuseok Frame',       description:'Harvest moon frame for fall — limited season.',            item_type:'profile_cosmetic', coin_price:180, sort_order:244 }),
    _mk({ id:'cosmetic_seollal_frame', name:'Seollal Frame',       description:'Lunar New Year frame with traditional motifs.',            item_type:'profile_cosmetic', coin_price:180, sort_order:245 }),

    // ── Coin themes (lighter weight than cash themes) ─────────
    _mk({ id:'cosmetic_forest_theme',  name:'Forest Theme',        description:'Calm green forest UI theme.',                              item_type:'profile_cosmetic', coin_price:240, sort_order:250 }),
    _mk({ id:'cosmetic_ocean_theme',   name:'Ocean Theme',         description:'Deep blue ocean UI theme.',                                item_type:'profile_cosmetic', coin_price:240, sort_order:251 }),
    _mk({ id:'cosmetic_paper_theme',   name:'Vintage Paper Theme', description:'Hand-bound book aesthetic for the UI.',                    item_type:'profile_cosmetic', coin_price:260, sort_order:252 }),

    // ── Reporter gifts — Korean food themed (coin, repeatable) ──
    _mk({ id:'reporter_tteokbokki',  name:'Tteokbokki',           description:'Spicy rice cake — newsroom favorite.',                     item_type:'reporter_item', coin_price:65,  is_repeatable:true, sort_order:260 }),
    _mk({ id:'reporter_hotteok',     name:'Hotteok',              description:'Sweet pancake snack for chilly news days.',                item_type:'reporter_item', coin_price:55,  is_repeatable:true, sort_order:261 }),
    _mk({ id:'reporter_mandu',       name:'Mandu Plate',          description:'Hand-folded dumplings for the editor.',                    item_type:'reporter_item', coin_price:70,  is_repeatable:true, sort_order:262 }),
    _mk({ id:'reporter_chimaek',     name:'Chimaek Combo',        description:'Chicken + beer — the after-work classic.',                 item_type:'reporter_item', coin_price:130, is_repeatable:true, sort_order:263 }),
    _mk({ id:'reporter_kimchi_jeon', name:'Kimchi Pancake',       description:'Crispy kimchi pancake for rainy days.',                    item_type:'reporter_item', coin_price:75,  is_repeatable:true, sort_order:264 }),
    _mk({ id:'reporter_korean_tea',  name:'Korean Tea Set',       description:'Yuja, omija, barley — pick a tea, send warmth.',           item_type:'reporter_item', coin_price:90,  is_repeatable:true, sort_order:265 }),
    _mk({ id:'reporter_postcard',    name:'Thank-You Postcard', description:'A digital thank-you postcard for the reporter — an in-app gift, nothing is mailed.',                     item_type:'reporter_item', coin_price:120, is_repeatable:true, sort_order:266 }),
    _mk({ id:'reporter_polaroid',    name:'Polaroid Photo Pack',  description:'Send a polaroid photo collage to your favorite reporter.', item_type:'reporter_item', coin_price:160, is_repeatable:true, sort_order:267 }),

    // ── Coin pets / room items (low-tier, accessible) ─────────
    _mk({ id:'coin_pet_kitten',      name:'Stripe Kitten',         description:'A small stripe kitten that wanders your room.',           item_type:'room_item',  coin_price:90,  sort_order:280 }),
    _mk({ id:'coin_pet_goldfish',    name:'Goldfish Bowl',         description:'A simple goldfish bowl with one swimming fish.',          item_type:'room_item',  coin_price:70,  sort_order:281 }),
    _mk({ id:'coin_pet_owl',         name:'Bookshop Owl',          description:'A studious owl perched on your bookshelf.',               item_type:'room_item',  coin_price:120, sort_order:282 }),
    _mk({ id:'coin_room_telescope',  name:'Stargazer Telescope',   description:'Lean it against the window for late-night vibes.',        item_type:'room_item',  coin_price:160, sort_order:283 }),
    _mk({ id:'coin_room_oldradio',   name:'Vintage Radio',         description:'Tunes a fictional 90s K-pop station. Decorative.',        item_type:'room_item',  coin_price:100, sort_order:284 }),
    _mk({ id:'coin_room_easel',      name:'Painting Easel',        description:'A blank canvas easel — for your inner artist.',           item_type:'room_item',  coin_price:130, sort_order:285 }),

    // ── Coin sticker / emoji packs ────────────────────────────
    _mk({ id:'stickers_koreanfood',  name:'Korean Food Stickers',  description:'Bibimbap, kimchi, ramen — coin sticker set.',             item_type:'sticker_pack', coin_price:120, is_repeatable:false, sort_order:300 }),
    _mk({ id:'stickers_studyvibes',  name:'Study Vibes Stickers',  description:'Cute study-mood stickers (hwaiting / focus / coffee).',   item_type:'sticker_pack', coin_price:120, is_repeatable:false, sort_order:301 }),
    _mk({ id:'stickers_seoulscape',  name:'Seoul Stickers',        description:'Namsan tower, Han river, Gyeongbokgung sticker set.',     item_type:'sticker_pack', coin_price:140, is_repeatable:false, sort_order:302 })
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
      // Incremental seed: only insert DEFAULT_SHOP_ITEMS rows whose `id`
      // doesn't already exist in `shop_items`. The previous logic bailed
      // out on `count > 0`, which meant adding new items to
      // DEFAULT_SHOP_ITEMS never reached the DB after the very first seed.
      var existingRes = await sb.from('shop_items').select('id');
      if (existingRes && existingRes.error) {
        if (isShopTableMissingErr(existingRes.error)) {
          await setLocalShopItems(sb, DEFAULT_SHOP_ITEMS);
          return false;
        }
        return false;
      }
      var existingIds = {};
      (existingRes && existingRes.data ? existingRes.data : []).forEach(function(r) { existingIds[r.id] = true; });
      var missing = DEFAULT_SHOP_ITEMS.filter(function(it) { return !existingIds[it.id]; });
      if (!missing.length) return true;
      var seedRes = await sb.from('shop_items').upsert(missing, { onConflict:'id' });
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

  var SHOP_CASH_ENABLED = false;

  async function initShop() {
    if (!window.supaUser) return;
    var sb = getSupa(); if (!sb) return;
    // Seeding writes shop_items (admin-write under RLS) — only admins try it.
    if (window._isAdmin) await ensureDefaultShopItems(sb);

    var [{ data:stats }, itemsRes, { data:owned }, roomRes] = await Promise.all([
      sb.from('user_stats').select('xp, coin_balance').eq('user_id', supaUser.id).maybeSingle(),
      sb.from('shop_items').select('*').eq('is_active', true).order('sort_order', { ascending:true }),
      sb.from('owned_items').select('item_id, quantity').eq('user_id', supaUser.id),
      // Room ownership lives on the server (only buy_room_item writes it), so a
      // new device shows "Owned" correctly; localStorage is just a cache.
      sb.from('user_room_state').select('owned').eq('user_id', supaUser.id).maybeSingle()
    ]);
    if (roomRes && !roomRes.error) {
      _shop.roomOwned = (roomRes.data && Array.isArray(roomRes.data.owned)) ? roomRes.data.owned.slice() : [];
      try { localStorage.setItem('kh_room_owned', JSON.stringify(_shop.roomOwned)); } catch(e) {}
    }
    var dbItems = (itemsRes && itemsRes.data) || [];
    var usingFallback = !!(itemsRes && itemsRes.error && isShopTableMissingErr(itemsRes.error));
    var liveItems = usingFallback ? await getLocalShopItems(sb) : dbItems;
    if (!liveItems.length && usingFallback) {
      await setLocalShopItems(sb, DEFAULT_SHOP_ITEMS);
      liveItems = await getLocalShopItems(sb);
    }
    usingFallback = usingFallback || liveItems.length === 0;
    var catalog = usingFallback ? DEFAULT_SHOP_ITEMS : liveItems;
    // No card gateway yet: "Buy with Cash" only recorded a pending order and
    // never charged or delivered. Hide cash-only items and cash buttons until
    // real checkout exists (flip SHOP_CASH_ENABLED then).
    if (!SHOP_CASH_ENABLED) catalog = catalog.filter(function(it) { return !!it.can_buy_with_coin; });

    var ownedMap = {};
    (owned || []).forEach(function(o){ ownedMap[o.item_id] = o.quantity || 0; });
    _shop.catalog = catalog;
    _shop.owned = ownedMap;
    _shop.coin = Number((stats && stats.coin_balance) || 0);
    _shop.xp = Number((stats && stats.xp) || 0);
    _shop.preview = usingFallback;
    renderBalance();
    renderTab();
  }

  // ── New shop UI (mockup E, 2026-10-28) ──────────────────────────
  // Only items that do something once bought are listed: room items with
  // art (room_items), frames, titles, reporter gifts and Streak Freeze.
  // Badges / themes / sticker packs / art-less room items had no effect
  // anywhere in the app, so they're not sold.
  var _shop = { catalog: [], owned: {}, roomOwned: null, coin: 0, xp: 0, preview: false, tab: 'room', cat: 'all' };
  // Room tab categories (room_items.shop_category, 20261031_room_items_shop_category.sql).
  // An item without one shows under All only.
  var SHOP_CATS = [['furniture', 'Furniture'], ['wall', 'Wall'], ['light', 'Lights'], ['study', 'Study'], ['korean', 'Korean'],
    ['food', 'Snacks'], ['hobby', 'Hobbies'], ['plush', 'Plushies'], ['pets', 'Pets & plants'], ['season', 'Seasons']];
  function _catLabel(k) { for (var i = 0; i < SHOP_CATS.length; i++) if (SHOP_CATS[i][0] === k) return SHOP_CATS[i][1]; return ''; }

  // Sprites sit on a padded square canvas; the preview crops that padding away so the
  // item stands on its shadow instead of floating above it. Cached per picture.
  // Items whose picture isn't uploaded yet drop out of the grid and the chip counts.
  var _shMissing = {}, _shRecount = 0;
  window._shMiss = function (img, id) {
    _shMissing[id] = 1;
    var t = img.closest('.sh-tile'); if (t) t.remove();
    clearTimeout(_shRecount);
    _shRecount = setTimeout(function () {
      var sale = ROOM_ITEMS_SHOP.filter(function(it){ return it.img && it.price > 0 && !it.cash && !_shMissing[it.id]; });
      document.querySelectorAll('.sh-cat[data-cat]').forEach(function (b) {
        var k = b.getAttribute('data-cat'), n = sale.filter(function(it){ return k === 'all' || it.cat === k; }).length;
        var em = b.querySelector('em'); if (em) em.textContent = n;   // All has no count
        if (!n && k !== 'all') b.remove();
      });
    }, 250);
  };
  var _trimCache = {};
  window._shTrim = function (img) {
    var src = img.getAttribute('data-src') || img.src;
    if (img.dataset.trimmed) return;
    img.dataset.trimmed = '1';
    if (_trimCache[src]) { img.src = _trimCache[src]; return; }
    try {
      var w = img.naturalWidth, h = img.naturalHeight; if (!w || !h) return;
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var g = c.getContext('2d'); g.drawImage(img, 0, 0);
      var d = g.getImageData(0, 0, w, h).data, x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < 0) return;
      var o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
      o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
      _trimCache[src] = o.toDataURL('image/png');
      img.src = _trimCache[src];
    } catch (_) {}
  };
  // Owned room item ids: the server list once loaded, else the local cache.
  function _roomOwnedIds() {
    if (Array.isArray(_shop.roomOwned)) return _shop.roomOwned;
    try { var c = JSON.parse(localStorage.getItem('kh_room_owned') || '[]'); return Array.isArray(c) ? c : []; } catch(e) { return []; }
  }
  var SHOP_FRAME_CLASS = {
    cosmetic_neon_frame: 'kh-frame-neon', cosmetic_sakura_frame: 'kh-frame-sakura', cosmetic_hanbok_frame: 'kh-frame-hanbok',
    cosmetic_gold_frame: 'kh-frame-gold', cosmetic_aurora_frame: 'kh-frame-aurora', cosmetic_mint_frame: 'kh-frame-mint',
    cosmetic_coral_frame: 'kh-frame-coral', cosmetic_royal_frame: 'kh-frame-royal', cosmetic_chuseok_frame: 'kh-frame-chuseok',
    cosmetic_seollal_frame: 'kh-frame-seollal'
  };
  var SHOP_TITLE_TONE = {
    title_seed: 'mint', title_sprout: 'mint', title_tree: 'forest', title_forest: 'forest', title_scholar: 'navy',
    title_word_master: 'navy', title_news_addict: 'warm', title_night_owl: 'navy', title_early_bird: 'warm',
    title_polyglot: 'regal', title_kimchi_lover: 'warm', title_seoulite: 'navy'
  };
  function _esc(t) { return String(t == null ? '' : t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function _initial() {
    var n = (window.supaUser && (supaUser.user_metadata && (supaUser.user_metadata.name || supaUser.user_metadata.full_name) || supaUser.email)) || 'K';
    return _esc(String(n).trim().charAt(0).toUpperCase() || 'K');
  }
  function _titleLabel(it) {
    var m = String(it.name || '').match(/Title\s*·\s*([^(]+)/);
    return (m ? m[1] : (it.name || '')).trim();
  }
  // Admin = unlimited nyang (owner, 2026-10-31); the server charges the admin 0.
  function _unl() { return typeof khNyangUnlimited === 'function' && khNyangUnlimited(); }
  function renderBalance() {
    var c = document.getElementById('shop-coin'); if (c) c.textContent = _unl() ? '\u221e' : _shop.coin.toLocaleString();
    var x = document.getElementById('shop-xp'); if (x) x.textContent = _shop.xp.toLocaleString() + ' XP';
  }
  function _items(type) {
    return (_shop.catalog || []).filter(function(it) {
      if (type === 'frame') return it.item_type === 'profile_cosmetic' && SHOP_FRAME_CLASS[it.id];
      if (type === 'title') return it.item_type === 'profile_title' && SHOP_TITLE_TONE[it.id];
      if (type === 'gift') return it.item_type === 'reporter_item';
      if (type === 'boost') return it.item_type === 'consumable';
      return false;
    });
  }
  function _row(it, preview) {
    var own = _shop.owned[it.id];
    var tag = own && !it.is_repeatable ? '<span class="sh-own">Owned</span>'
      : '<span class="sh-pr">' + Number(it.coin_price || 0) + '</span>';
    return '<button type="button" class="sh-li" onclick="shopOpen(\'item\',\'' + it.id + '\')">'
      + '<span class="sh-pv' + (it.kind === 'title' ? ' sh-pv-title' : '') + '">' + preview + '</span>'
      // A title's pill already shows its name, so the row only adds the description.
      + '<span class="sh-tx">' + (it.kind === 'title' ? '' : '<b>' + _esc(it.name) + '</b>') + '<small>' + _esc(it.description || '') + '</small></span>'
      + tag + (own && it.is_repeatable ? '<span class="sh-qty">x' + own + '</span>' : '') + '</button>';
  }
  function _framePv(it) { return '<span class="sh-av-wrap"><span class="sh-av-frame is-on ' + SHOP_FRAME_CLASS[it.id] + '"></span><span class="sh-av">' + _initial() + '</span></span>'; }
  function _titlePv(it) { return '<span class="mp-title-pill kh-title-' + SHOP_TITLE_TONE[it.id] + '">' + _esc(_titleLabel(it)) + '</span>'; }
  function renderTab() {
    var tab = _shop.tab;
    document.querySelectorAll('.shop-tab').forEach(function(t){ t.classList.toggle('active', t.getAttribute('data-tab') === tab); });
    var el = document.getElementById('shop-grid'); if (!el) return;
    if (tab === 'special') { el.innerHTML = _spRender(); _spAnimate(el); if (typeof renderKhLucideIcons === 'function') renderKhLucideIcons(); return; }
    var html = _shop.preview ? '<div class="sh-note">The shop is being restocked — items are a preview and can\'t be bought yet.</div>' : '';
    if (tab === 'room') {
      var owned = _roomOwnedIds();
      // Free (price 0) starters are owned by everyone and not sold; items whose
      // art isn't uploaded yet remove their own tile (onerror) until it lands.
      var sale = ROOM_ITEMS_SHOP.filter(function(it){ return it.img && it.price > 0 && !it.cash && !_shMissing[it.id]; });
      var counts = {};
      sale.forEach(function(it){ if (it.cat) counts[it.cat] = (counts[it.cat] || 0) + 1; });
      if (_shop.cat !== 'all' && !counts[_shop.cat]) _shop.cat = 'all';
      html += '<div class="sh-cats" role="tablist">' + [['all', 'All', sale.length]].concat(SHOP_CATS.filter(function(c){ return counts[c[0]]; }).map(function(c){ return [c[0], c[1], counts[c[0]]]; })).map(function(c) {
        return '<button type="button" role="tab" class="sh-cat' + (_shop.cat === c[0] ? ' on' : '') + '" aria-selected="' + (_shop.cat === c[0]) + '" data-cat="' + c[0] + '" onclick="shopSetCat(\'' + c[0] + '\')">' + _esc(c[1]) + (c[0] === 'all' ? '' : '<em>' + c[2] + '</em>') + '</button>';
      }).join('') + '</div>';
      html += '<div class="sh-grid">' + sale.filter(function(it){ return _shop.cat === 'all' || it.cat === _shop.cat; }).map(function(it) {
        var isOwned = owned.indexOf(it.id) >= 0;
        var study = !!ROOM_UNLOCKS[it.id];
        return '<button type="button" class="sh-tile" onclick="shopOpen(\'room\',\'' + it.id + '\')">'
          + (isOwned ? '<span class="sh-own sh-own-abs">Owned</span>' : '')
          + '<span class="sh-art"><img src="' + _esc(it.img) + '" alt="" loading="lazy" onerror="_shMiss(this,\'' + it.id + '\')"></span>'
          + '<b>' + _esc(it.name) + '</b>'
          + (study ? '<small class="sh-study">' + khIcon('graduation-cap') + 'Study unlock</small>' : '<small>' + Number(it.price).toLocaleString() + '</small>')
          + '</button>';
      }).join('') + '</div>';
    } else if (tab === 'profile') {
      var fr = _items('frame').map(function(it){ return _row(it, _framePv(it)); }).join('');
      var ti = _items('title').map(function(it){ it.kind = 'title'; return _row(it, _titlePv(it)); }).join('');
      html += (fr ? '<div class="sh-k">Frames</div>' + fr : '') + (ti ? '<div class="sh-k">Titles</div>' + ti : '')
        + '<div class="sh-hint">Equip what you own in My Page → Frames &amp; titles.</div>';
    } else if (tab === 'gifts') {
      html += '<div class="sh-hint" style="margin:0 0 10px">Give these to reporters on their page to raise your affinity and unlock their cards.</div>'
        + _items('gift').map(function(it){ return _row(it, '<span class="sh-ic">' + khIcon('gift') + '</span>'); }).join('');
    } else {
      html += _items('boost').map(function(it){ return _row(it, '<span class="sh-ic sh-ic-b">' + khIcon('snowflake') + '</span>'); }).join('');
    }
    el.innerHTML = html;
    if (typeof renderKhLucideIcons === 'function') renderKhLucideIcons();
  }
  window.shopSetTab = function(tab) { _shop.tab = tab; renderTab(); };
  // Roles arrive after the first paint: redraw so the admin sees unlimited nyang.
  window.addEventListener('kh:roles', function () { try { renderBalance(); renderTab(); } catch (_) {} });
  window.shopSetCat = function(cat) {
    _shop.cat = cat; renderTab();
    var on = document.querySelector('.sh-cat.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
  };

  // Bottom sheet: preview + balance after + one Buy button.
  window.shopOpen = function(kind, id) {
    var item, title, preview, price, owned, buy;
    if (kind === 'room') {
      item = ROOM_ITEMS_SHOP.find(function(x){ return x.id === id; }); if (!item) return;
      title = item.name; price = Number(item.price) || 0; owned = _roomOwnedIds().indexOf(id) >= 0;
      // Display stand (owner pick A, 2026-10-31): wall items hang centred, the rest stand on a shadow.
      preview = '<div class="sh-stand' + (item.cat === 'wall' ? ' wall' : '') + '"><span class="sh-disc"></span><img src="' + _esc(item.img) + '" alt="" onload="_shTrim(this)"></div>';
      buy = 'window.buyRoomItem(\'' + id + '\')';
      if (ROOM_UNLOCKS[id] && !owned && !_unl()) {
        // Earned by studying, not bought: show the goal instead of a price.
        var ov0 = document.createElement('div');
        ov0.className = 'sh-ov'; ov0.id = 'sh-ov';
        ov0.innerHTML = '<div class="sh-sheet" role="dialog" aria-modal="true">'
          + '<div class="sh-k">Study unlock</div><div class="sh-st">' + _esc(title) + '</div>'
          + '<div class="sh-sd">Not sold for nyang. ' + _esc(ROOM_UNLOCKS[id]) + ' and it appears in My Room.</div>'
          + preview
          + '<button type="button" class="sh-buy" onclick="location.href=\'korehan-mypage.html#room-unlocks\'">See my progress</button>'
          + '<button type="button" class="sh-cancel" onclick="shopClose()">Close</button></div>';
        ov0.addEventListener('click', function(e){ if (e.target === ov0) shopClose(); });
        document.body.appendChild(ov0);
        requestAnimationFrame(function(){ ov0.classList.add('open'); });
        return;
      }
    } else {
      item = (_shop.catalog || []).find(function(x){ return x.id === id; }); if (!item) return;
      title = item.item_type === 'profile_title' ? _titleLabel(item) : item.name; price = Number(item.coin_price || 0);
      owned = !!_shop.owned[id] && !item.is_repeatable;
      preview = SHOP_FRAME_CLASS[id] ? '<div class="sh-big">' + _framePv(item) + '</div>'
        : SHOP_TITLE_TONE[id] ? '<div class="sh-big"><span class="sh-av">' + _initial() + '</span>' + _titlePv(item) + '</div>'
        : '<div class="sh-big"><span class="sh-ic">' + khIcon(item.item_type === 'consumable' ? 'snowflake' : 'gift') + '</span></div>';
      buy = 'window.buyWithCoin(\'' + id + '\')';
    }
    if (_unl()) price = 0;
    var after = _shop.coin - price, short = after < 0;
    var ov = document.createElement('div');
    ov.className = 'sh-ov'; ov.id = 'sh-ov';
    ov.innerHTML = '<div class="sh-sheet" role="dialog" aria-modal="true">'
      + '<div class="sh-k">' + (kind === 'room' ? 'Room item' + (_catLabel(item.cat) ? ' · ' + _esc(_catLabel(item.cat)) : '') : item.item_type === 'profile_title' ? 'Title' : item.item_type === 'profile_cosmetic' ? 'Frame' : item.item_type === 'reporter_item' ? 'Reporter gift' : 'Boost') + '</div>'
      + '<div class="sh-st">' + _esc(title) + '</div>'
      + (item.description ? '<div class="sh-sd">' + _esc(item.description) + '</div>' : '')
      + preview
      + (owned ? '' : _unl() ? '<div class="sh-bal-row"><span>Admin · unlimited nyang</span><b>Free</b></div>'
        : '<div class="sh-bal-row"><span>' + _shop.coin.toLocaleString() + ' → ' + (short ? '—' : after.toLocaleString()) + ' nyang</span><b>' + price.toLocaleString() + '</b></div>')
      + (owned ? (kind === 'room'
          ? '<button type="button" class="sh-buy" onclick="location.href=\'korehan-mypage.html?place=' + encodeURIComponent(id) + '\'">Owned · Go to My Room</button>'
          : '<button type="button" class="sh-buy" disabled>Owned</button>')
        : short ? '<button type="button" class="sh-buy" disabled>Need ' + (price - _shop.coin).toLocaleString() + ' more nyang</button>'
        : '<button type="button" class="sh-buy"' + (_shop.preview ? ' disabled' : '') + ' onclick="' + buy + ';shopClose()">' + (_unl() ? 'Get it free (admin)' : 'Buy for ' + price.toLocaleString() + ' nyang') + '</button>')
      + '<button type="button" class="sh-cancel" onclick="shopClose()">Not now</button></div>';
    ov.addEventListener('click', function(e){ if (e.target === ov) shopClose(); });
    document.body.appendChild(ov);
    requestAnimationFrame(function(){ ov.classList.add('open'); });
    if (typeof renderKhLucideIcons === 'function') renderKhLucideIcons();
  };
  window.shopClose = function() { var o = document.getElementById('sh-ov'); if (o) o.remove(); };

  window.buyWithCoin = async function(itemId) {
    var sb = getSupa(); if (!sb || !supaUser) return;
    var res = await sb.rpc('purchase_coin_shop_item', { p_user_id: supaUser.id, p_item_id: itemId });
    if (res.error || !res.data || !res.data.ok) {
      toast((res.data && res.data.error) || (res.error && res.error.message) || 'Purchase failed', 'error');
      return;
    }
    if (typeof _fjMarkDone === 'function') _fjMarkDone('shop');
    toast('Purchase complete', 'success');
    initShop();
  };

  window.buyWithCash = async function(itemId) {
    if (!SHOP_CASH_ENABLED) { toast('Card payments aren\'t available yet.', 'warn'); return; }
    var sb = getSupa(); if (!sb || !supaUser) return;
    var itemRes = await sb.from('shop_items').select('cash_price').eq('id', itemId).maybeSingle();
    var amount = Number(itemRes.data && itemRes.data.cash_price || 0);
    await sb.from('payment_orders').insert({ user_id: supaUser.id, item_id: itemId, amount: amount, currency: 'USD', status: 'pending', provider: 'manual_pending' });
    await sb.from('shop_purchases').insert({ user_id: supaUser.id, item_id: itemId, purchase_type: 'cash', cash_amount: amount, payment_status: 'pending' });
    khAlert('Checkout pending', 'Your order was recorded. Card payment will be available once the gateway is connected — we\'ll contact you for early access.', { okLabel: 'OK' });
    initShop();
  };

  // ── Room Items in Shop (loaded from DB, fallback hardcoded) ──
  // New items use the assets/room/<id>.png convention — drop files with those
  // names into /korehan/assets/room/ and they'll render automatically.
  var ROOM_ITEMS_FALLBACK = [
    // Existing items (keep their original asset paths so nobody's saved room breaks)
    {id:'character',  name:'Character',        price:0,   img:'assets/file_000000000570720694038be799df9f21-removebg-preview.png', category:'character'},
    {id:'cat',        name:'Sleeping Cat',     price:180,  img:'assets/file_000000003a7c7209a3877df863e15fd9-removebg-preview.png', category:'pet'},
    {id:'poop',       name:'Happy Poop',       price:60,   img:'assets/file_000000004b247206b900dba933600c46-removebg-preview.png', category:'deco'},
    {id:'cushion',    name:'Reading Cushion',  price:120,  img:'assets/file_0000000064f872098fc13437d998de5a-removebg-preview.png', category:'furniture'},
    {id:'lamp',       name:'Korean Lamp',      price:140,  img:'assets/file_00000000a2287209b632ccc0519de0e7-removebg-preview.png', category:'furniture'},
    {id:'bookshelf',  name:'Bookshelf',        price:300,  img:'assets/file_00000000a66472069f5c058b95fd2322-removebg-preview.png', category:'furniture'},
    {id:'plant',      name:'Potted Plant',     price:100,   img:'assets/file_00000000f734720691f7289c1f8a5e3c-removebg-preview.png', category:'deco'},
    {id:'fennec',     name:'Fennec Fox',       price:240,  img:'assets/file_0000000097387206868da2533972ee90-removebg-preview.png', category:'pet'},
    {id:'char_silver',name:'Silver Character', price:0,   img:'assets/file_00000000b8bc72069bc7877f36aaf27f-removebg-preview.png', category:'character'},
    {id:'char_thumbs',name:'Thumbs Up Guy',    price:0,   img:'assets/file_00000000d40c7206bb289cd92deab487-removebg-preview.png', category:'character'},
    // ── NEW · Furniture ──
    {id:'desk',             name:'Study Desk',          price:360,  img:'assets/room/desk.png',             category:'furniture'},
    {id:'chair',            name:'Ergo Chair',          price:260,  img:'assets/room/chair.png',            category:'furniture'},
    {id:'rug',              name:'Hanji Rug',           price:220,  img:'assets/room/rug.png',              category:'furniture'},
    {id:'bed',              name:'Cozy Bed',            price:540,  img:'assets/room/bed.png',              category:'furniture'},
    {id:'wardrobe',         name:'Wardrobe',            price:420,  img:'assets/room/wardrobe.png',         category:'furniture'},
    {id:'coffee_table',     name:'Coffee Table',        price:240,  img:'assets/room/coffee-table.png',     category:'furniture'},
    {id:'tv_unit',          name:'TV Unit',             price:480,  img:'assets/room/tv-unit.png',          category:'furniture'},
    {id:'mini_fridge',      name:'Mini Fridge',         price:460,  img:'assets/room/mini-fridge.png',      category:'furniture'},
    {id:'piano',            name:'Upright Piano',       price:1440, img:'assets/room/piano.png',            category:'furniture'},
    {id:'gaming_chair',     name:'Gaming Chair',        price:660,  img:'assets/room/gaming-chair.png',     category:'furniture'},
    {id:'floor_pillow',     name:'Floor Pillow',        price:110,   img:'assets/room/floor-pillow.png',     category:'furniture'},
    {id:'tea_table',        name:'Korean Tea Table',    price:340,  img:'assets/room/tea-table.png',        category:'furniture'},
    // ── NEW · Deco ──
    {id:'window_city',      name:'City Window',         price:600,  img:'assets/room/window-city.png',      category:'deco'},
    {id:'window_sunrise',   name:'Sunrise Window',      price:660,  img:'assets/room/window-sunrise.png',   category:'deco'},
    {id:'window_rain',      name:'Rainy Window',        price:660,  img:'assets/room/window-rain.png',      category:'deco'},
    {id:'wall_clock',       name:'Wall Clock',          price:170,  img:'assets/room/wall-clock.png',       category:'deco'},
    {id:'poster_kpop',      name:'K-Pop Poster',        price:140,  img:'assets/room/poster-kpop.png',      category:'deco'},
    {id:'poster_hangul',    name:'Hangul Poster',       price:140,  img:'assets/room/poster-hangul.png',    category:'deco'},
    {id:'calligraphy',      name:'Korean Calligraphy',  price:360,  img:'assets/room/calligraphy.png',      category:'deco'},
    {id:'lantern',          name:'Paper Lantern',       price:190,  img:'assets/room/lantern.png',          category:'deco'},
    {id:'fairy_lights',     name:'Fairy Lights',        price:260,  img:'assets/room/fairy-lights.png',     category:'deco'},
    {id:'neon_sign',        name:'Hangul Neon Sign',    price:580,  img:'assets/room/neon-sign.png',        category:'deco'},
    {id:'rain_cloud',       name:'Rain Cloud',          price:300,  img:'assets/room/rain-cloud.png',       category:'deco'},
    {id:'star_lamp',        name:'Star Projector',      price:380,  img:'assets/room/star-lamp.png',        category:'deco'},
    {id:'light_stick',      name:'K-Pop Light Stick',   price:290,  img:'assets/room/light-stick.png',      category:'deco'},
    {id:'tea_set',          name:'Tea Set',             price:220,  img:'assets/room/tea-set.png',          category:'deco'},
    {id:'cup_noodles',      name:'Cup Noodles',         price:70,   img:'assets/room/cup-noodles.png',      category:'deco'},
    {id:'rice_cooker',      name:'Rice Cooker',         price:340,  img:'assets/room/rice-cooker.png',      category:'deco'},
    {id:'globe',            name:'Desk Globe',          price:180,  img:'assets/room/globe.png',            category:'deco'},
    {id:'books_stack',      name:'Stack of Books',      price:120,  img:'assets/room/books-stack.png',      category:'deco'},
    {id:'pencil_holder',    name:'Pencil Holder',       price:60,   img:'assets/room/pencil-holder.png',    category:'deco'},
    {id:'backpack',         name:'Student Backpack',    price:140,  img:'assets/room/backpack.png',         category:'deco'},
    {id:'bicycle',          name:'City Bicycle',        price:480,  img:'assets/room/bicycle.png',          category:'deco'},
    {id:'skateboard',       name:'Skateboard',          price:340,  img:'assets/room/skateboard.png',       category:'deco'},
    {id:'guitar',           name:'Acoustic Guitar',     price:540,  img:'assets/room/guitar.png',           category:'deco'},
    {id:'camera',           name:'Vintage Camera',      price:310,  img:'assets/room/camera.png',           category:'deco'},
    {id:'radio',            name:'Vintage Radio',       price:260,  img:'assets/room/radio.png',            category:'deco'},
    {id:'temple_mini',      name:'Mini Temple',         price:780,  img:'assets/room/temple-mini.png',      category:'deco'},
    {id:'bonsai',           name:'Bonsai Tree',         price:340,  img:'assets/room/bonsai.png',           category:'deco'},
    {id:'cherry_blossom',   name:'Cherry Blossom Branch', price:290, img:'assets/room/cherry-blossom.png', category:'deco'},
    {id:'study_buddy_bear', name:'Study Buddy Bear',    price:220,  img:'assets/room/study-buddy-bear.png', category:'deco'},
    // ── NEW · Pets ──
    {id:'hamster',          name:'Hamster in Wheel',    price:340,  img:'assets/room/hamster.png',          category:'pet'},
    {id:'aquarium',         name:'Aquarium',            price:600,  img:'assets/room/aquarium.png',         category:'pet'},
    {id:'dog_shiba',        name:'Shiba Inu',           price:420,  img:'assets/room/dog-shiba.png',        category:'pet'},
    {id:'parrot',           name:'Green Parrot',        price:360,  img:'assets/room/parrot.png',           category:'pet'},
    {id:'turtle',           name:'Pet Turtle',          price:260,  img:'assets/room/turtle.png',           category:'pet'},
    {id:'bunny',            name:'Lop Bunny',           price:340,  img:'assets/room/bunny.png',            category:'pet'},
    // ── NEW · Characters ──
    {id:'char_hanbok',      name:'Hanbok Doll',         price:480,  img:'assets/room/char-hanbok.png',      category:'character'},
    {id:'char_scholar',     name:'Joseon Scholar',      price:660,  img:'assets/room/char-scholar.png',     category:'character'},
    {id:'char_tiger',       name:'Korean Tiger',        price:780,  img:'assets/room/char-tiger.png',       category:'character'},
    {id:'char_dokkaebi',    name:'Dokkaebi (도깨비)',   price:840,  img:'assets/room/char-dokkaebi.png',    category:'character'}
  ];
  var ROOM_ITEMS_SHOP = ROOM_ITEMS_FALLBACK.slice();
  var _shopRoomItemsLoaded = false;
  // Study unlocks (room_unlocks): earned in My Room by studying, never sold.
  var ROOM_UNLOCKS = {};

  async function _ensureRoomItems() {
    if (_shopRoomItemsLoaded) return;
    var sb = typeof getSupa === 'function' ? getSupa() : null;
    if (!sb) return;
    try {
      var res = await sb.from('room_items').select('*').eq('active', true).order('sort_order');
      if (!res.error && res.data && res.data.length) {
        ROOM_ITEMS_SHOP = res.data.map(function(r) {
          return { id: r.id, name: r.name, price: r.price_nyang, img: (typeof khRoomImg === 'function' ? khRoomImg(r.image_url) : r.image_url), size: r.base_size, cat: r.shop_category || '', cash: !!r.cash_only };
        });
        _shopRoomItemsLoaded = true;
      }
    } catch(e) {}
    try {
      var ul = await sb.from('room_unlocks').select('item_id, label').eq('active', true);
      if (ul && !ul.error) (ul.data || []).forEach(function(u){ ROOM_UNLOCKS[u.item_id] = u.label; });
    } catch(e) {}
  }

  async function renderRoomShop() {
    await _ensureRoomItems();
    if (_shop.tab === 'room') renderTab();
  }

  window.buyRoomItem = async function(itemId) {
    var item = ROOM_ITEMS_SHOP.find(function(x){return x.id===itemId;});
    if (!item) return;
    if (_roomOwnedIds().indexOf(itemId) >= 0) { toast('Already owned', 'warn'); return; }
    var sb = getSupa();
    if (!sb || !supaUser) { toast('Please sign in first', 'warn'); return; }
    // Server-side purchase: price from room_items, balance locked there, and
    // the item appended to user_room_state.owned (the only writer of it).
    var rpc = await sb.rpc('buy_room_item', { p_item_id: itemId });
    var body = (rpc && rpc.data) || {};
    if (rpc.error || !body.ok) {
      if (body.error === 'INSUFFICIENT_NYANG') toast('Not enough nyang — need ' + body.required + ', you have ' + body.current, 'warn');
      else if (body.error === 'UNLOCK_ONLY') toast('This one is earned by studying — see My Room', 'warn');
      else if (body.error === 'CASH_ONLY') toast('This one is in the Special shop', 'warn');
      else toast('Purchase failed', 'error');
      return;
    }
    var owned = _roomOwnedIds().slice();
    if (owned.indexOf(itemId) < 0) owned.push(itemId);
    _shop.roomOwned = owned;
    try { localStorage.setItem('kh_room_owned', JSON.stringify(owned)); } catch(e) {}
    if (typeof body.nyang_balance === 'number') { _shop.coin = body.nyang_balance; renderBalance(); }
    if (typeof _fjMarkDone === 'function') _fjMarkDone('shop');
    renderTab();
    _shopBoughtSheet(item);
    initShop();
  };

  // After a room purchase: offer to place it right away.
  function _shopBoughtSheet(item) {
    shopClose();
    var ov = document.createElement('div');
    ov.className = 'sh-ov'; ov.id = 'sh-ov';
    ov.innerHTML = '<div class="sh-sheet" role="dialog" aria-modal="true">'
      + '<div class="sh-k">Purchased</div>'
      + '<div class="sh-st">' + _esc(item.name) + ' is yours</div>'
      + '<div class="sh-room"><img src="' + _esc(item.img) + '" alt=""></div>'
      + '<button type="button" class="sh-buy" onclick="location.href=\'korehan-mypage.html?place=' + encodeURIComponent(item.id) + '\'">Place it now</button>'
      + '<button type="button" class="sh-cancel" onclick="shopClose()">Keep shopping</button></div>';
    ov.addEventListener('click', function(e){ if (e.target === ov) shopClose(); });
    document.body.appendChild(ov);
    requestAnimationFrame(function(){ ov.classList.add('open'); });
  }


  // ── Special shop (owner-approved mockup 2026-10-31) ────────────────
  // Digital items bought with a card: season packs, the one-time starter pack,
  // premium outfits, reporter photocard sets (cash_products). billing
  // 'item_checkout' opens Stripe; billing-webhook grants the items when paid
  // (kh_grant_cash_order) — the browser never writes ownership. Real goods are
  // "Coming soon": goods_interest counts who wants which reporter first.
  var _sp = { loaded: false, products: [], paid: {}, cards: {}, interest: {}, reporters: [], pick: null, card: null };
  function _spMoney(c) { return '$' + (Math.round(Number(c) || 0) / 100).toFixed(2); }
  function _spPrem() { return typeof khIsPremiumPlan === 'function' && khIsPremiumPlan(); }
  function _spPrice(p) { var pct = _spPrem() ? Math.max(0, Math.min(90, Number(p.premium_discount_pct) || 0)) : 0; return Math.max(50, Math.round(p.price_cents * (100 - pct) / 100)); }
  function _spImg(u) { if (!u) return ''; return (typeof khRoomImg === 'function' && /^assets\//.test(u)) ? khRoomImg(u) : u; }
  function _spOwned(p) {
    if (_sp.paid[p.id]) return true;
    var owned = _roomOwnedIds();
    var items = p.items || [];
    return items.length > 0 && items.every(function (i) { return /^pc_/.test(i) ? !!_sp.cards[i] : owned.indexOf(i) >= 0; });
  }
  function _spAdmin() { return typeof khNyangUnlimited === 'function' && khNyangUnlimited(); }
  function _spLive(p) {
    var now = Date.now();
    return (p.active || p._draft) && (!p.starts_at || new Date(p.starts_at).getTime() <= now) && (!p.ends_at || new Date(p.ends_at).getTime() > now);
  }
  async function _spLoad() {
    var sb = getSupa(); if (!sb) return;
    var uid = window.supaUser && supaUser.id;
    var reqs = [
      // The admin also sees inactive products (drafts) to check them before they go on sale.
      _spAdmin() ? sb.from('cash_products').select('*').order('sort', { ascending: true })
                 : sb.from('cash_products').select('*').eq('active', true).order('sort', { ascending: true }),
      sb.from('character_reporters').select('id, data')
    ];
    if (uid) reqs.push(
      sb.from('cash_orders').select('product_id').eq('user_id', uid).eq('status', 'paid'),
      sb.from('user_photocards').select('card_id').eq('user_id', uid),
      sb.from('goods_interest').select('reporter_id').eq('user_id', uid)
    );
    var r = await Promise.all(reqs.map(function (q) { return q.then(function (x) { return x; }, function () { return { data: null }; }); }));
    var rows = function (i) { return (r[i] && Array.isArray(r[i].data)) ? r[i].data : []; };
    _sp.products = rows(0).map(function (p) { p._draft = !p.active; return p; }).filter(_spLive);
    _sp.reporters = rows(1).map(function (x) { var d = x.data || {}; return { id: x.id, name: d.name || x.id, img: d.image || '', color: d.color || '#64748b' }; })
      .filter(function (x) { return /^cr\d+$/.test(x.id) && x.img && !/picsum\.photos/.test(x.img); })
      .sort(function (a, b) { return Number(a.id.slice(2)) - Number(b.id.slice(2)); });
    _sp.paid = {}; _sp.cards = {}; _sp.interest = {};
    rows(2).forEach(function (o) { _sp.paid[o.product_id] = 1; });
    rows(3).forEach(function (c) { _sp.cards[c.card_id] = 1; });
    rows(4).forEach(function (g) { _sp.interest[g.reporter_id] = 1; });
    if (!_sp.pick && _sp.reporters.length) _sp.pick = _sp.reporters[0].id;
    _sp.loaded = true;
    if (_shop.tab === 'special') renderTab();
  }
  function _spPriceHtml(p) {
    var full = p.price_cents, now = _spPrice(p), pct = Number(p.premium_discount_pct) || 0;
    if (now < full) return '<div class="sp-price">' + _spMoney(now) + '<s>' + _spMoney(full) + '</s></div><div class="sp-pm">Premium price</div>';
    return '<div class="sp-price">' + _spMoney(full) + '</div>' + (pct ? '<div class="sp-pm">Premium ' + _spMoney(Math.round(full * (100 - pct) / 100)) + ' (' + pct + '% off)</div>' : '');
  }
  function _spBtn(p) {
    return _spOwned(p) ? '<span class="sp-owned">' + khIcon('check') + 'Owned</span>'
      : '<button type="button" class="sp-btn" onclick="shopSpecialOpen(\'' + _esc(p.id) + '\')">Buy</button>';
  }
  // Preview pictures with frames (the fireplace fire, idol dance poses) move like in the room.
  function _spFr(x) { return (x && Array.isArray(x.frames) && x.frames.length > 1) ? ' data-frames="' + _esc(JSON.stringify(x.frames)) + '"' : ''; }
  function _spAnimate(root) {
    if (typeof khRoomAnim !== 'function' || !root) return;
    root.querySelectorAll('img[data-frames]').forEach(function (im) {
      try { var fr = JSON.parse(im.getAttribute('data-frames')); khRoomAnim(im, fr.map(_spImg), fr.length > 6 ? 1100 : 150); } catch (_) {}
    });
  }
  function _spThumbs(p, n) {
    return (p.preview || []).slice(0, n || 5).map(function (x) { return '<span class="sp-th"><img src="' + _esc(_spImg(x.img)) + '" alt="" loading="lazy"' + _spFr(x) + '></span>'; }).join('');
  }
  function _spDays(p) {
    if (!p.ends_at) return '';
    var d = Math.ceil((new Date(p.ends_at).getTime() - Date.now()) / 86400000);
    var end = new Date(p.ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return 'Ends ' + end + (d > 0 ? ' · ' + d + (d === 1 ? ' day' : ' days') : '');
  }
  function _spRender() {
    if (!_sp.loaded) return '<div class="sh-hint">Loading…</div>';
    var by = function (k) { return _sp.products.filter(function (p) { return p.kind === k; }); };
    var packs = by('pack'), starter = by('starter'), outfits = by('outfit'), sets = by('photocard_set');
    var h = '';
    if (packs.length) {
      h += '<div class="sp-sec"><h3>Limited</h3><span>Season packs</span></div>';
      h += packs.map(function (p) {
        var own = _spOwned(p);
        return '<div class="sp-hero">'
          + '<div class="sp-hero-bg"' + (p.image_url ? ' style="background-image:url(\'' + _esc(_spImg(p.image_url)) + '\')"' : '') + '>'
          + (own ? '<span class="sp-badge sp-badge-own">OWNED</span>' : (p._draft ? '<span class="sp-badge sp-badge-draft">DRAFT · not on sale</span>' : (p.badge ? '<span class="sp-badge">' + _esc(p.badge) + '</span>' : '')))
          + (p.ends_at && !own ? '<span class="sp-cd">' + _esc(_spDays(p)) + '</span>' : '') + '</div>'
          + '<div class="sp-hero-bd"><h4>' + _esc(p.name) + '</h4><div class="sp-ths">' + _spThumbs(p, 5) + '</div>'
          + (p.description ? '<p>' + _esc(p.description) + '</p>' : '')
          + '<div class="sp-row"><div>' + (own ? '' : _spPriceHtml(p)) + '</div>' + (own ? '<a class="sp-btn" href="korehan-mypage.html">Go to My Room</a>' : _spBtn(p)) + '</div></div></div>';
      }).join('');
    }
    starter.forEach(function (p) {
      if (_sp.paid[p.id]) return;   // one time only: gone once bought
      var art = (p.preview && p.preview[0]) ? '<img src="' + _esc(_spImg(p.image_url || p.preview[0].img)) + '" alt="">' : khIcon('gift');
      h += '<div class="sp-card"><div class="sp-art">' + art + '</div><div class="sp-card-bd">'
        + (p._draft ? '<span class="sp-once sp-draft">DRAFT · not on sale</span>' : '') + (p.one_per_account ? '<span class="sp-once">ONE TIME ONLY</span>' : '')
        + '<h5>' + _esc(p.name) + '</h5>' + (p.description ? '<p>' + _esc(p.description) + '</p>' : '')
        + '<div class="sp-row"><div>' + _spPriceHtml(p) + '</div>' + _spBtn(p) + '</div></div></div>';
    });
    if (outfits.length) {
      h += '<div class="sp-sec"><h3>Outfits</h3><span>Wear them in My Room</span></div><div class="sp-grid">'
        + outfits.map(function (p) {
          var pv0 = (p.preview && p.preview[0]) || {};
          var img = p.image_url || pv0.img || '';
          return '<button type="button" class="sp-it" onclick="shopSpecialOpen(\'' + _esc(p.id) + '\')">'
            + (p._draft ? '<span class="sp-lim sp-draft">DRAFT</span>' : (p.badge ? '<span class="sp-lim">' + _esc(p.badge) + '</span>' : ''))
            + (_spOwned(p) ? '<span class="sh-own sh-own-abs">Owned</span>' : '')
            + '<img src="' + _esc(_spImg(img)) + '" alt="" loading="lazy"' + (pv0.img === img ? _spFr(pv0) : '') + '><b>' + _esc(p.name) + '</b>'
            + '<span>' + (_spOwned(p) ? 'Owned' : _spMoney(_spPrice(p))) + '</span></button>';
        }).join('') + '</div>';
    }
    if (sets.length) {
      var withSets = _sp.reporters.filter(function (r) { return sets.some(function (p) { return p.reporter_id === r.id; }); });
      if (!_sp.card || !withSets.some(function (r) { return r.id === _sp.card; })) _sp.card = withSets.length ? withSets[0].id : null;
      h += '<div class="sp-sec"><h3>Reporter photocards</h3><span>Digital · all cards shown</span></div>';
      h += '<div class="sp-chips">' + withSets.map(function (r) {
        return '<button type="button" class="sp-chip' + (_sp.card === r.id ? ' on' : '') + '" onclick="shopSpecialCard(\'' + r.id + '\')"><img src="' + _esc(r.img) + '" alt="">' + _esc(r.name) + '</button>';
      }).join('') + '</div>';
      h += sets.filter(function (p) { return p.reporter_id === _sp.card; }).map(function (p) {
        return '<div class="sp-pcs">' + (p.preview || []).map(function (x) { return '<span><img src="' + _esc(_spImg(x.img)) + '" alt="' + _esc(x.label || '') + '" loading="lazy"></span>'; }).join('') + '</div>'
          + '<div class="sp-row sp-pad"><div><b class="sp-set">' + _esc(p.name) + '</b><small class="sp-sub">' + _esc(p.description || 'Goes to your card book') + '</small></div>'
          + (_spOwned(p) ? '<span class="sp-owned">' + khIcon('check') + 'Owned</span>' : '<button type="button" class="sp-btn" onclick="shopSpecialOpen(\'' + _esc(p.id) + '\')">' + _spMoney(_spPrice(p)) + '</button>') + '</div>';
      }).join('');
    }
    if (!h) h += '<div class="sp-empty">' + khIcon('sparkles') + '<b>New items are on the way</b><span>Season packs, outfits and reporter photocards will appear here.</span></div>';
    // Real goods: Coming soon + who wants which reporter first.
    var pick = _sp.reporters.filter(function (r) { return r.id === _sp.pick; })[0];
    h += '<div class="sp-soon"><div class="sp-row"><b>Real photocards &amp; goods</b><span class="sp-soon-tag">COMING SOON</span></div>'
      + '<p>Printed photocards, acrylic stands and stickers shipped to you. Tell us who you want first.</p>'
      + (_sp.reporters.length ? '<div class="sp-chips sp-chips-sm">' + _sp.reporters.map(function (r) {
          return '<button type="button" class="sp-chip' + (_sp.pick === r.id ? ' on' : '') + '" onclick="shopSpecialPick(\'' + r.id + '\')"><img src="' + _esc(r.img) + '" alt="">' + _esc(r.name) + (_sp.interest[r.id] ? '<i class="sp-chip-ok">' + khIcon('check') + '</i>' : '') + '</button>';
        }).join('') + '</div>' : '')
      + (pick ? '<button type="button" class="sp-ghost' + (_sp.interest[pick.id] ? ' on' : '') + '" onclick="shopSpecialNotify()">'
          + (_sp.interest[pick.id] ? khIcon('bell-ring') + 'You\'ll hear first · ' + _esc(pick.name) : khIcon('bell') + 'Notify me · ' + _esc(pick.name)) + '</button>' : '')
      + '</div>';
    h += '<div class="sp-foot">Secure card payment by Stripe · Digital items are added to your account right away · <a href="refund-policy.html">Refund policy</a></div>';
    return h;
  }
  window.shopSpecialCard = function (id) { _sp.card = id; renderTab(); };
  window.shopSpecialPick = function (id) { _sp.pick = id; renderTab(); };
  window.shopSpecialNotify = async function () {
    if (!window.supaUser) { if (typeof openAuthModal === 'function') openAuthModal('signup'); return; }
    var id = _sp.pick, sb = getSupa(); if (!id || !sb) return;
    var on = !!_sp.interest[id];
    var res = on ? await sb.from('goods_interest').delete().eq('user_id', supaUser.id).eq('reporter_id', id)
                 : await sb.from('goods_interest').insert({ user_id: supaUser.id, reporter_id: id });
    if (res && res.error) { toast('Could not save that. Try again in a moment.', 'error'); return; }
    if (on) delete _sp.interest[id]; else _sp.interest[id] = 1;
    if (!on) toast('Got it. You\'ll hear first when real goods open.', 'success');
    renderTab();
  };
  window.shopSpecialOpen = function (id) {
    var p = _sp.products.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    shopClose();
    var own = _spOwned(p), price = _spPrice(p);
    var ov = document.createElement('div'); ov.className = 'sh-ov'; ov.id = 'sh-ov';
    ov.innerHTML = '<div class="sh-sheet" role="dialog" aria-modal="true" aria-label="' + _esc(p.name) + '">'
      + '<div class="sh-st">' + _esc(p.name) + '</div>'
      + (p.description ? '<p class="sp-sheet-d">' + _esc(p.description) + '</p>' : '')
      + '<div class="sp-li">' + (p.preview || []).map(function (x) {
          return '<div><span><img src="' + _esc(_spImg(x.img)) + '" alt=""' + _spFr(x) + '></span>' + _esc(x.label || '') + '</div>';
        }).join('') + '</div>'
      + (own ? '<div class="sp-total"><span>Already in your account</span></div><button type="button" class="sh-buy" onclick="location.href=\'korehan-mypage.html\'">Go to My Room</button>'
             : '<div class="sp-total"><span>Total</span><span>' + _spMoney(price) + (price < p.price_cents ? ' <s>' + _spMoney(p.price_cents) + '</s>' : '') + '</span></div>'
               + '<button type="button" class="sh-buy" id="sp-pay" onclick="shopSpecialPay(\'' + _esc(p.id) + '\')">Pay ' + _spMoney(price) + '</button>'
               + '<div class="sp-note">You\'ll finish payment on Stripe\'s secure page. Items you already own are skipped.</div>')
      + '<button type="button" class="sh-cancel" onclick="shopClose()">Close</button></div>';
    ov.addEventListener('click', function (e) { if (e.target === ov) shopClose(); });
    document.body.appendChild(ov);
    _spAnimate(ov);
    requestAnimationFrame(function () { ov.classList.add('open'); });
  };
  window.shopSpecialPay = async function (id) {
    if (!window.supaUser) { shopClose(); if (typeof openAuthModal === 'function') openAuthModal('signup'); return; }
    var btn = document.getElementById('sp-pay'), label = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Opening secure checkout…'; }
    var msg = 'Checkout could not be started. Please try again in a moment.';
    try {
      var sb = getSupa();
      var sess = sb ? await sb.auth.getSession() : null;
      var token = sess && sess.data && sess.data.session && sess.data.session.access_token;
      var r = await fetch(SUPA_URL + '/functions/v1/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'apikey': SUPA_KEY },
        body: JSON.stringify({ action: 'item_checkout', product_id: id })
      });
      var res = await r.json().catch(function () { return {}; });
      if (res && res.ok && res.url) { location.href = res.url; return; }
      if (res && res.error === 'already_bought') msg = 'You already bought this one.';
      else if (res && res.error === 'already_owned') msg = 'Everything in this pack is already yours.';
      else if (res && res.error === 'not_for_sale') msg = 'This item isn\'t on sale right now.';
      else if (res && res.error === 'billing_not_configured') msg = 'Card payments are being set up. Please check back soon.';
    } catch (_) {}
    if (btn) { btn.disabled = false; btn.textContent = label; }
    if (typeof khAlert === 'function') khAlert('Special shop', msg, { okLabel: 'OK' }); else alert(msg);
  };
  // Back from Stripe: ?order=<id> → wait for the webhook to grant the items.
  async function _spReturn() {
    var q = new URLSearchParams(location.search);
    var orderId = q.get('order'), canceled = q.get('canceled');
    if (!orderId && !canceled) return;
    try { history.replaceState(null, '', location.pathname + '?tab=special'); } catch (_) {}
    if (canceled) { toast('Payment canceled. Nothing was charged.', 'warn'); return; }
    if (!/^[0-9a-f-]{36}$/i.test(orderId) || !window.supaUser) return;
    var sb = getSupa(); if (!sb) return;
    toast('Finishing your purchase…', 'info');
    for (var i = 0; i < 16; i++) {
      var r = await sb.from('cash_orders').select('status, product_id').eq('id', orderId).maybeSingle();
      var o = r && r.data;
      if (o && o.status === 'paid') {
        await Promise.all([initShop(), _spLoad()]);
        var p = _sp.products.filter(function (x) { return x.id === o.product_id; })[0];
        _spPaidSheet(p);
        return;
      }
      if (o && o.status !== 'pending') break;
      await new Promise(function (res) { setTimeout(res, 1500); });
    }
    toast('Payment received. Your items will appear in a minute. Reload if they don\'t.', 'info');
  }
  function _spPaidSheet(p) {
    shopClose();
    var ov = document.createElement('div'); ov.className = 'sh-ov'; ov.id = 'sh-ov';
    ov.innerHTML = '<div class="sh-sheet" role="dialog" aria-modal="true"><div class="sh-k">Purchased</div>'
      + '<div class="sh-st">' + _esc(p ? p.name : 'Your items') + ' added</div>'
      + (p ? '<div class="sp-ths sp-ths-c">' + _spThumbs(p, 6) + '</div>' : '')
      + '<button type="button" class="sh-buy" onclick="location.href=\'korehan-mypage.html\'">Go to My Room</button>'
      + '<button type="button" class="sh-cancel" onclick="shopClose()">Keep shopping</button></div>';
    ov.addEventListener('click', function (e) { if (e.target === ov) shopClose(); });
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('open'); });
  }
  window.addEventListener('kh-plan-loaded', function () { if (_shop.tab === 'special') renderTab(); });
  // Roles arrive after the first load: the admin then also gets the draft products.
  window.addEventListener('kh:roles', function () { if (_spAdmin() && _sp.loaded) _spLoad(); });

  // Esc closes the open sheet (item, bought, how to earn) like the backdrop tap.
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && document.getElementById('sh-ov')) window.shopClose();
  });

  document.addEventListener('DOMContentLoaded', function(){
    // Tab click handlers
    document.querySelectorAll('.shop-tab').forEach(function(btn){
      btn.addEventListener('click', function(){ shopSetTab(this.getAttribute('data-tab')); });
    });
    // ?tab=special (and Stripe's return) opens the Special tab; otherwise it
    // leads when something is on sale.
    var _qTab = new URLSearchParams(location.search).get('tab');
    if (['special', 'room', 'profile', 'gifts', 'boosts'].indexOf(_qTab) >= 0) _shop.tab = _qTab;
    function _startShop() {
      initShop(); renderRoomShop();
      _spLoad().then(function () {
        if (!_qTab && _sp.products.length) shopSetTab('special');
        return _spReturn();
      });
    }
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
