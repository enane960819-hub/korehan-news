(function(){
  var K_SHOP_ITEMS_FALLBACK = 'kh_shop_items_fallback';
  var K_SHOP_ITEMS_FALLBACK_DB = 'shop_items_fallback';
  // Image convention: assets/shop/<slug>.png — drop files with those names in
  // /korehan/assets/shop/ and they'll show up automatically. Missing images
  // fall back to picsum placeholders.
  function shopImg(slug) { return 'assets/shop/' + slug + '.png'; }
  function _mk(o) {
    return Object.assign({
      slug: o.id.replace(/_/g, '-'),
      image_url: o.image_url || shopImg(o.id.replace(/_/g, '-')),
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
    _mk({ id:'cash_nyang_pack_sm',   name:'Nyang Pack · Small',    description:'Adds 500 냥 to your balance — spend on room items & cosmetics.',   item_type:'currency_pack', coin_price:0, cash_price:2.99,  can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:true, sort_order:90 }),
    _mk({ id:'cash_nyang_pack_md',   name:'Nyang Pack · Medium',   description:'Adds 1,200 냥 + 10% bonus — for cosmetic & room purchases.',       item_type:'currency_pack', coin_price:0, cash_price:5.99,  can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:true, sort_order:91 }),
    _mk({ id:'cash_nyang_pack_lg',   name:'Nyang Pack · Large',    description:'Adds 3,000 냥 + 20% bonus — stock up on room items.',              item_type:'currency_pack', coin_price:0, cash_price:12.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:true, sort_order:92 }),
    _mk({ id:'cash_nyang_pack_xl',   name:'Nyang Pack · Mega',     description:'Adds 7,000 냥 + 30% bonus — best value for decorators.',           item_type:'currency_pack', coin_price:0, cash_price:24.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:true, sort_order:93 }),
    _mk({ id:'cash_nyang_pack_ultra',name:'Nyang Pack · Ultra',    description:'Adds 20,000 냥 + 40% bonus — deck out the whole room.',            item_type:'currency_pack', coin_price:0, cash_price:59.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:true, sort_order:94 }),

    // Supporter tiers — cosmetic + ad-free only (no learning perks)
    _mk({ id:'cash_supporter_month', name:'Supporter · 1 Month',   description:'Supporter badge + 1,000 냥 + ad-free reading. No learning perks.',  item_type:'subscription',  coin_price:0, cash_price:4.99,  can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:true, sort_order:100 }),
    _mk({ id:'cash_supporter_3mo',   name:'Supporter · 3 Months',  description:'Supporter badge + 3,500 냥 + ad-free + monthly sticker drop.',     item_type:'subscription',  coin_price:0, cash_price:11.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:true, sort_order:101 }),
    _mk({ id:'cash_supporter_6mo',   name:'Supporter · 6 Months',  description:'Supporter badge + 7,500 냥 + ad-free + exclusive room effect.',    item_type:'subscription',  coin_price:0, cash_price:22.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:true, sort_order:102 }),
    _mk({ id:'cash_supporter_year',  name:'Supporter · 1 Year',    description:'Supporter Gold badge + 18,000 냥 + ad-free + seasonal cosmetics.',  item_type:'subscription',  coin_price:0, cash_price:39.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:true, sort_order:103 }),
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
    _mk({ id:'cash_bundle_starter',     name:'Cosmetic Starter Pack', description:'2,000 냥 + Sakura frame + Sakura room effect. No learning perks.', item_type:'bundle', coin_price:0, cash_price:9.99,  can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:170 }),
    _mk({ id:'cash_bundle_kpop',        name:'K-Pop Fan Bundle',      description:'K-Pop poster + light stick + neon sign + K-Pop sticker pack.',    item_type:'bundle', coin_price:0, cash_price:7.99,  can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:171 }),
    _mk({ id:'cash_bundle_traditional', name:'Traditional Korea Bundle', description:'Hanbok doll + Joseon scholar + mini temple + calligraphy.',   item_type:'bundle', coin_price:0, cash_price:12.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:172 }),
    _mk({ id:'cash_bundle_cozy',        name:'Cozy Room Bundle',      description:'Desk + chair + piano + bonsai + tea set. Pure aesthetic.',        item_type:'bundle', coin_price:0, cash_price:14.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:173 }),
    _mk({ id:'cash_bundle_hanok_room',  name:'Hanok Room Bundle',     description:'Hanok wallpaper + tatami floor + paper lantern + tea table.',     item_type:'bundle', coin_price:0, cash_price:12.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:174 }),
    _mk({ id:'cash_bundle_neon_room',   name:'Neon Seoul Bundle',     description:'Neon Seoul wallpaper + marble floor + neon sign + light stick.',  item_type:'bundle', coin_price:0, cash_price:12.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:175 }),
    _mk({ id:'cash_bundle_premium',     name:'Premium Everything',    description:'1-month Supporter + Galaxy frame + Night Sky wallpaper + 5,000 냥.', item_type:'bundle', coin_price:0, cash_price:19.99, can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:176 }),

    // Exclusive pets / characters / furniture (cosmetic only)
    _mk({ id:'cash_pet_dragon',       name:'Mini Korean Dragon',    description:'Legendary room pet. Cash-exclusive, one per account.',            item_type:'room_item',  coin_price:0, cash_price:6.99,  can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:180 }),
    _mk({ id:'cash_pet_phoenix',      name:'Fire Phoenix',          description:'Glowing phoenix pet that hovers in your room.',                   item_type:'room_item',  coin_price:0, cash_price:8.99,  can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:181 }),
    _mk({ id:'cash_pet_jindo',        name:'Jindo Dog',             description:'Loyal Jindo companion for your room. Cash-exclusive.',            item_type:'room_item',  coin_price:0, cash_price:5.99,  can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:182 }),
    _mk({ id:'cash_room_throne',      name:'Royal Throne',          description:'Gilded Joseon-style throne. Cash-exclusive furniture.',           item_type:'room_item',  coin_price:0, cash_price:6.99,  can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:false, sort_order:183 }),

    // Gifting (nyang / supporter only — can't gift learning perks)
    _mk({ id:'cash_gift_nyang_500',   name:'Gift · 500 냥 to Friend', description:'Send 500 냥 directly to a friend\'s account.',                  item_type:'gift_token', coin_price:0, cash_price:2.99,  can_buy_with_coin:false, can_buy_with_cash:true, is_repeatable:true, sort_order:190 }),
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
    _mk({ id:'title_seed',           name:'Title · 새싹',          description:'A friendly title showing you\'re just starting out.',       item_type:'profile_title', coin_price:60,  sort_order:220 }),
    _mk({ id:'title_sprout',         name:'Title · 떡잎',          description:'Tiny sprout title for early learners.',                    item_type:'profile_title', coin_price:80,  sort_order:221 }),
    _mk({ id:'title_tree',           name:'Title · 나무',          description:'For solid intermediate learners.',                         item_type:'profile_title', coin_price:120, sort_order:222 }),
    _mk({ id:'title_forest',         name:'Title · 숲',            description:'Advanced learner — you ARE the forest.',                  item_type:'profile_title', coin_price:180, sort_order:223 }),
    _mk({ id:'title_scholar',        name:'Title · 학자',          description:'For serious students of Korean.',                          item_type:'profile_title', coin_price:160, sort_order:224 }),
    _mk({ id:'title_word_master',    name:'Title · 단어 마스터',   description:'Vocabulary champion title.',                              item_type:'profile_title', coin_price:140, sort_order:225 }),
    _mk({ id:'title_news_addict',    name:'Title · 뉴스 중독자',   description:'Title for the daily news binger.',                        item_type:'profile_title', coin_price:120, sort_order:226 }),
    _mk({ id:'title_night_owl',      name:'Title · 야행성',        description:'For learners who study after midnight.',                  item_type:'profile_title', coin_price:100, sort_order:227 }),
    _mk({ id:'title_early_bird',     name:'Title · 아침형 인간',   description:'For learners who study at dawn.',                          item_type:'profile_title', coin_price:100, sort_order:228 }),
    _mk({ id:'title_polyglot',       name:'Title · Polyglot',      description:'You speak more than one non-native language.',            item_type:'profile_title', coin_price:140, sort_order:229 }),
    _mk({ id:'title_kimchi_lover',   name:'Title · 김치 러버',     description:'A fun title for Korean food fans.',                       item_type:'profile_title', coin_price:90,  sort_order:230 }),
    _mk({ id:'title_seoulite',       name:'Title · 서울러',        description:'For lovers of Seoul.',                                    item_type:'profile_title', coin_price:90,  sort_order:231 }),

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
    _mk({ id:'reporter_korean_tea',  name:'Korean Tea Set',       description:'Yuja, omija, citron — pick a tea, send warmth.',           item_type:'reporter_item', coin_price:90,  is_repeatable:true, sort_order:265 }),
    _mk({ id:'reporter_postcard',    name:'Handwritten Postcard', description:'Send a real handwritten thanks note.',                     item_type:'reporter_item', coin_price:120, is_repeatable:true, sort_order:266 }),
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

    document.getElementById('shop-xp').textContent = ((stats && stats.xp) || 0).toLocaleString();
    document.getElementById('shop-coin').textContent = ((stats && stats.coin_balance) || 0).toLocaleString();

    var ownedMap = {};
    (owned || []).forEach(function(o){ ownedMap[o.item_id] = o.quantity || 0; });

    var grid = document.getElementById('shop-grid');
    grid.innerHTML = (usingFallback ? '<div style="grid-column:1/-1;padding:10px 14px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:10px;font-size:13px">기본 아이템 프리뷰를 표시 중입니다. 관리자 페이지에서 <b>Seed Default Items</b>를 눌러 DB에 실제 아이템을 생성하세요.</div>' : '')
      + catalog.map(function(it){
      var ownedQty = ownedMap[it.id] || 0;
      var notEnough = !!it.can_buy_with_coin && Number((stats && stats.coin_balance) || 0) < Number(it.coin_price || 0);
      var oneTimeOwned = !!ownedQty && !it.is_repeatable;
      var disabledByFallback = usingFallback ? 'disabled title="DB에 저장된 아이템이 없어 구매할 수 없습니다"' : '';
      var tabType = (it.item_type === 'reporter_item' || it.item_type === 'gift_token') ? 'gift'
        : (it.item_type === 'profile_badge' || it.item_type === 'profile_cosmetic') ? 'profile'
        : it.can_buy_with_cash ? 'cash' : 'all';
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
      toast((res.data && res.data.error) || (res.error && res.error.message) || 'Purchase failed', 'error');
      return;
    }
    if (typeof _fjMarkDone === 'function') _fjMarkDone('shop');
    toast('Purchase complete', 'success');
    initShop();
  };

  window.buyWithCash = async function(itemId) {
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
    {id:'cat',        name:'Sleeping Cat',     price:15,  img:'assets/file_000000003a7c7209a3877df863e15fd9-removebg-preview.png', category:'pet'},
    {id:'poop',       name:'Happy Poop',       price:3,   img:'assets/file_000000004b247206b900dba933600c46-removebg-preview.png', category:'deco'},
    {id:'cushion',    name:'Reading Cushion',  price:10,  img:'assets/file_0000000064f872098fc13437d998de5a-removebg-preview.png', category:'furniture'},
    {id:'lamp',       name:'Korean Lamp',      price:12,  img:'assets/file_00000000a2287209b632ccc0519de0e7-removebg-preview.png', category:'furniture'},
    {id:'bookshelf',  name:'Bookshelf',        price:25,  img:'assets/file_00000000a66472069f5c058b95fd2322-removebg-preview.png', category:'furniture'},
    {id:'plant',      name:'Potted Plant',     price:8,   img:'assets/file_00000000f734720691f7289c1f8a5e3c-removebg-preview.png', category:'deco'},
    {id:'fennec',     name:'Fennec Fox',       price:20,  img:'assets/file_0000000097387206868da2533972ee90-removebg-preview.png', category:'pet'},
    {id:'char_silver',name:'Silver Character', price:0,   img:'assets/file_00000000b8bc72069bc7877f36aaf27f-removebg-preview.png', category:'character'},
    {id:'char_thumbs',name:'Thumbs Up Guy',    price:0,   img:'assets/file_00000000d40c7206bb289cd92deab487-removebg-preview.png', category:'character'},
    // ── NEW · Furniture ──
    {id:'desk',             name:'Study Desk',          price:30,  img:'assets/room/desk.png',             category:'furniture'},
    {id:'chair',            name:'Ergo Chair',          price:22,  img:'assets/room/chair.png',            category:'furniture'},
    {id:'rug',              name:'Hanji Rug',           price:18,  img:'assets/room/rug.png',              category:'furniture'},
    {id:'bed',              name:'Cozy Bed',            price:45,  img:'assets/room/bed.png',              category:'furniture'},
    {id:'wardrobe',         name:'Wardrobe',            price:35,  img:'assets/room/wardrobe.png',         category:'furniture'},
    {id:'coffee_table',     name:'Coffee Table',        price:20,  img:'assets/room/coffee-table.png',     category:'furniture'},
    {id:'tv_unit',          name:'TV Unit',             price:40,  img:'assets/room/tv-unit.png',          category:'furniture'},
    {id:'mini_fridge',      name:'Mini Fridge',         price:38,  img:'assets/room/mini-fridge.png',      category:'furniture'},
    {id:'piano',            name:'Upright Piano',       price:120, img:'assets/room/piano.png',            category:'furniture'},
    {id:'gaming_chair',     name:'Gaming Chair',        price:55,  img:'assets/room/gaming-chair.png',     category:'furniture'},
    {id:'floor_pillow',     name:'Floor Pillow',        price:9,   img:'assets/room/floor-pillow.png',     category:'furniture'},
    {id:'tea_table',        name:'Korean Tea Table',    price:28,  img:'assets/room/tea-table.png',        category:'furniture'},
    // ── NEW · Deco ──
    {id:'window_city',      name:'City Window',         price:50,  img:'assets/room/window-city.png',      category:'deco'},
    {id:'window_sunrise',   name:'Sunrise Window',      price:55,  img:'assets/room/window-sunrise.png',   category:'deco'},
    {id:'window_rain',      name:'Rainy Window',        price:55,  img:'assets/room/window-rain.png',      category:'deco'},
    {id:'wall_clock',       name:'Wall Clock',          price:14,  img:'assets/room/wall-clock.png',       category:'deco'},
    {id:'poster_kpop',      name:'K-Pop Poster',        price:12,  img:'assets/room/poster-kpop.png',      category:'deco'},
    {id:'poster_hangul',    name:'Hangul Poster',       price:12,  img:'assets/room/poster-hangul.png',    category:'deco'},
    {id:'calligraphy',      name:'Korean Calligraphy',  price:30,  img:'assets/room/calligraphy.png',      category:'deco'},
    {id:'lantern',          name:'Paper Lantern',       price:16,  img:'assets/room/lantern.png',          category:'deco'},
    {id:'fairy_lights',     name:'Fairy Lights',        price:22,  img:'assets/room/fairy-lights.png',     category:'deco'},
    {id:'neon_sign',        name:'Hangul Neon Sign',    price:48,  img:'assets/room/neon-sign.png',        category:'deco'},
    {id:'rain_cloud',       name:'Rain Cloud',          price:25,  img:'assets/room/rain-cloud.png',       category:'deco'},
    {id:'star_lamp',        name:'Star Projector',      price:32,  img:'assets/room/star-lamp.png',        category:'deco'},
    {id:'light_stick',      name:'K-Pop Light Stick',   price:24,  img:'assets/room/light-stick.png',      category:'deco'},
    {id:'tea_set',          name:'Tea Set',             price:18,  img:'assets/room/tea-set.png',          category:'deco'},
    {id:'cup_noodles',      name:'Cup Noodles',         price:6,   img:'assets/room/cup-noodles.png',      category:'deco'},
    {id:'rice_cooker',      name:'Rice Cooker',         price:28,  img:'assets/room/rice-cooker.png',      category:'deco'},
    {id:'globe',            name:'Desk Globe',          price:15,  img:'assets/room/globe.png',            category:'deco'},
    {id:'books_stack',      name:'Stack of Books',      price:10,  img:'assets/room/books-stack.png',      category:'deco'},
    {id:'pencil_holder',    name:'Pencil Holder',       price:5,   img:'assets/room/pencil-holder.png',    category:'deco'},
    {id:'backpack',         name:'Student Backpack',    price:12,  img:'assets/room/backpack.png',         category:'deco'},
    {id:'bicycle',          name:'City Bicycle',        price:40,  img:'assets/room/bicycle.png',          category:'deco'},
    {id:'skateboard',       name:'Skateboard',          price:28,  img:'assets/room/skateboard.png',       category:'deco'},
    {id:'guitar',           name:'Acoustic Guitar',     price:45,  img:'assets/room/guitar.png',           category:'deco'},
    {id:'camera',           name:'Vintage Camera',      price:26,  img:'assets/room/camera.png',           category:'deco'},
    {id:'radio',            name:'Vintage Radio',       price:22,  img:'assets/room/radio.png',            category:'deco'},
    {id:'temple_mini',      name:'Mini Temple',         price:65,  img:'assets/room/temple-mini.png',      category:'deco'},
    {id:'bonsai',           name:'Bonsai Tree',         price:28,  img:'assets/room/bonsai.png',           category:'deco'},
    {id:'cherry_blossom',   name:'Cherry Blossom Branch', price:24, img:'assets/room/cherry-blossom.png', category:'deco'},
    {id:'study_buddy_bear', name:'Study Buddy Bear',    price:18,  img:'assets/room/study-buddy-bear.png', category:'deco'},
    // ── NEW · Pets ──
    {id:'hamster',          name:'Hamster in Wheel',    price:28,  img:'assets/room/hamster.png',          category:'pet'},
    {id:'aquarium',         name:'Aquarium',            price:50,  img:'assets/room/aquarium.png',         category:'pet'},
    {id:'dog_shiba',        name:'Shiba Inu',           price:35,  img:'assets/room/dog-shiba.png',        category:'pet'},
    {id:'parrot',           name:'Green Parrot',        price:30,  img:'assets/room/parrot.png',           category:'pet'},
    {id:'turtle',           name:'Pet Turtle',          price:22,  img:'assets/room/turtle.png',           category:'pet'},
    {id:'bunny',            name:'Lop Bunny',           price:28,  img:'assets/room/bunny.png',            category:'pet'},
    // ── NEW · Characters ──
    {id:'char_hanbok',      name:'Hanbok Doll',         price:40,  img:'assets/room/char-hanbok.png',      category:'character'},
    {id:'char_scholar',     name:'Joseon Scholar',      price:55,  img:'assets/room/char-scholar.png',     category:'character'},
    {id:'char_tiger',       name:'Korean Tiger',        price:65,  img:'assets/room/char-tiger.png',       category:'character'},
    {id:'char_dokkaebi',    name:'Dokkaebi (도깨비)',   price:70,  img:'assets/room/char-dokkaebi.png',    category:'character'}
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
    if (owned.indexOf(itemId) >= 0) { toast('Already owned', 'warn'); return; }

    if (item.price > 0) {
      var sb = getSupa();
      if (!sb || !supaUser) { toast('Please sign in first', 'warn'); return; }
      var statsRes = await sb.from('user_stats').select('coin_balance').eq('user_id',supaUser.id).maybeSingle();
      var bal = (statsRes.data && statsRes.data.coin_balance) || 0;
      if (bal < item.price) {
        toast('Not enough nyang — need ' + item.price + ', you have ' + bal, 'warn');
        return;
      }
      await sb.from('user_stats').update({coin_balance: bal - item.price}).eq('user_id',supaUser.id);
    }

    owned.push(itemId);
    localStorage.setItem('kh_room_owned', JSON.stringify(owned));
    // Sync to server so My Room page doesn't overwrite
    try {
      var sb2 = getSupa();
      if (sb2 && supaUser) {
        var layout = []; try { layout = JSON.parse(localStorage.getItem('kh_room_layout')||'[]'); } catch(e){}
        var syncData = JSON.stringify({ room_layout: layout, room_owned: owned });
        sb2.from('app_settings').upsert({ key: 'room_data_' + supaUser.id, value: syncData, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      }
    } catch(e){}
    if (typeof _fjMarkDone === 'function') _fjMarkDone('shop');
    toast('Purchased ' + item.name + ' — place it in My Room', 'success');
    renderRoomShop();
    initShop();
  };

  // ── Tab filtering ──
  var _currentTab = 'all';
  function itemMatchesTab(item, tab) {
    if (tab === 'all') return true;
    if (tab === 'gift') return item.item_type === 'reporter_item' || item.item_type === 'gift_token';
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
    var gachaPane = document.getElementById('gacha-pane');
    if (tab === 'gacha') {
      // Gacha owns the pane; hide everything else so the page doesn't
      // double-scroll past the regular grids.
      if (shopGrid)   shopGrid.style.display = 'none';
      if (roomGrid)   roomGrid.style.display = 'none';
      if (invSection) invSection.style.display = 'none';
      if (gachaPane)  gachaPane.style.display = '';
      return;
    }
    if (gachaPane) gachaPane.style.display = 'none';
    if (tab === 'room') {
      shopGrid.style.display = 'none';
      roomGrid.style.display = '';
      if (invSection) invSection.style.display = 'none';
    } else if (tab === 'all') {
      // ALL: show both shop items AND room items
      shopGrid.style.display = '';
      roomGrid.style.display = '';
      if (invSection) invSection.style.display = '';
      var cards = shopGrid.querySelectorAll('.card');
      cards.forEach(function(card) { card.style.display = ''; });
    } else {
      shopGrid.style.display = '';
      roomGrid.style.display = 'none';
      if (invSection) invSection.style.display = '';
      var cards = shopGrid.querySelectorAll('.card');
      cards.forEach(function(card) {
        var cardTab = card.getAttribute('data-tab-type') || 'all';
        var show = cardTab === tab;
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
