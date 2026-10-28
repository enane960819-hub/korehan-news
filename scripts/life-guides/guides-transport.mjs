// Life in Korea — "Getting around" guides (2026-10-29). Same v2 fields as
// guides-more.mjs. Fares are Seoul, transit-card prices, checked on
// CHECKED2 against Seoul City notices and news (subway ₩1,550 from
// 2025-06-28; bus fares from 2023-08-12; taxi base ₩4,800 from 2023-02-01;
// Climate Card 30-day pass ended 2026-10-01, short passes still sold).
const SEOULTR = { name: 'Seoul Metropolitan Government — Transportation', url: 'https://news.seoul.go.kr/traffic/' }
const VK = { name: 'VisitKorea', url: 'https://english.visitkorea.or.kr' }
const AREX = { name: 'AREX (Airport Railroad)', url: 'https://www.arex.or.kr' }
const KORAIL = { name: 'Korail (KTX booking in English)', url: 'https://www.letskorail.com' }
const KPASS = { name: 'K-Pass (모두의카드) — call 031-427-4415', url: 'https://korea-pass.kr' }
const T = (s) => s

export const TRANSPORT = [
  {
    slug: 'seoul-subway', category: 'transport', featured: true, sort: 50,
    title: 'Riding the subway in Seoul',
    summary: 'Tap a T-money card at the gate (₩1,550 for the first 10 km), follow the line colours and exit numbers, and use Naver Map or KakaoMap for routes and last trains.',
    steps: [
      'Plan the trip in Naver Map or KakaoMap: they show the line, the car to board for a fast {{환승|transfer}} and the {{출구|exit}} number.',
      'Tap your {{교통카드|transit card}} at the gate. The fare is ₩1,550 for up to 10 km, plus a little more for longer trips.',
      'No card? Buy a {{1회용 교통카드|single-journey card}} at the machine (₩1,650 + ₩500 deposit) and get the deposit back at the refund machine when you leave.',
      'Check the direction: signs show the next station and the final stop ({{방면|bound for}}).',
      'Tap out at the exit gate. Transfer to a bus within about 30 minutes and you pay little or nothing extra.',
      'Most lines stop running around midnight. Check the {{막차|last train}} in your map app before a late night out.',
    ],
    facts: [['₩1,550', 'basic fare'], ['Exit no.', 'meet friends here'], ['Midnight', 'last trains']],
    checklist: ['T-money card with balance', 'Naver Map or KakaoMap installed', 'Exit number of your destination', 'Last train time for the way home'],
    tips: [
      T('Google Maps works for subway routes, but Naver Map and KakaoMap are more accurate for exits, walking routes and last trains.'),
      T('Locals meet at a station exit: "강남역 11번 출구" (Gangnam Station, exit 11).'),
      T('Seats at both ends of each car are priority seats (노약자석) for older people, pregnant women and people with disabilities. Pink seats are for pregnant women. Leave them empty even when the train is crowded.'),
      T('Line 9 has {{급행|express}} trains that skip stations — check the sign on the train.'),
      T('Rush hour (about 7:30–9:00 and 18:00–19:30) is very crowded on Lines 2 and 9. Take off your backpack and hold it in front.'),
    ],
    tipsNote: 'Summarised from expat forums, university guides and Seoul transport notices.',
    phrases: [
      { ko: '몇 번 출구로 나가야 돼요?', en: 'Which exit should I take?' },
      { ko: '이 열차 잠실 가요?', en: 'Does this train go to Jamsil?' },
      { ko: '어디서 갈아타요?', en: 'Where do I transfer?' },
    ],
    sources: [SEOULTR, VK],
  },
  {
    slug: 'seoul-bus', category: 'transport', featured: false, sort: 51,
    title: 'Taking the bus: colours, fares and tapping off',
    summary: 'Board at the front and tap, press the stop button, leave by the back door and tap again. The bus colour tells you the type and the fare.',
    steps: [
      'Find the stop and bus number in Naver Map or KakaoMap — they show live arrival times.',
      'Wave or step forward when your bus comes; buses may not stop if nobody looks ready.',
      'Board at the front door and tap your card. Many buses no longer take cash, so always carry a card.',
      'Press the {{하차벨|stop button}} before your stop.',
      'Get off by the back door and {{하차 태그|tap off}} — without it you lose the {{환승|transfer}} discount and may pay a new fare next time.',
    ],
    facts: [['₩1,500', 'blue / green bus'], ['Tap off', 'every time'], ['Up to 4', 'transfers']],
    itemsTitle: 'Bus types',
    items: [
      ['Blue (간선)', 'Long routes across Seoul — ₩1,500'],
      ['Green (지선)', 'Short routes to the subway — ₩1,500'],
      ['Yellow (순환)', 'Loops around downtown — ₩1,400'],
      ['Red (광역)', 'Express to Gyeonggi cities — ₩3,000'],
      ['Small green (마을버스)', 'Neighbourhood shuttle — ₩1,200'],
      ['N + number (심야)', 'Night buses, about midnight–5 a.m. — ₩2,500'],
    ],
    tips: [
      T('Drivers start quickly. Hold a strap as soon as you board, and stay seated until the bus stops.'),
      T('On red express buses you usually cannot stand once they go on the highway — if seats are full, wait for the next one. Apps show the number of empty seats on many routes.'),
      T('Stop names are announced in Korean and English, and shown on the screen. Listen for "이번 정류장은…" (This stop is…).'),
    ],
    tipsNote: 'Summarised from Seoul bus notices, forums and university orientation guides.',
    phrases: [
      { ko: '이 버스 홍대 가요?', en: 'Does this bus go to Hongdae?' },
      { ko: '여기서 내려요.', en: "I'm getting off here." },
      { ko: '이번 정류장은 어디예요?', en: 'What is this stop?' },
    ],
    sources: [SEOULTR],
  },
  {
    slug: 'taxis-in-korea', category: 'transport', featured: true, sort: 52,
    title: 'Taxis: fares, apps and late-night surcharges',
    summary: 'Seoul taxis start at ₩4,800, cost 20–40% more late at night, and take cards. Use an app at night — Kakao T if you have a Korean phone, k.ride or Uber with a foreign card.',
    steps: [
      'Hail a taxi with a red {{빈차|vacant}} light, or book one with an app.',
      'Show the address in Korean or a map pin — drivers rarely use English addresses.',
      'Fasten your seat belt (back seats too) and check the {{미터기|meter}} is on.',
      'Pay by card or T-money; almost every taxi accepts them. Ask for a {{영수증|receipt}} if you might leave something behind.',
    ],
    facts: [['₩4,800', 'Seoul base fare'], ['22:00–04:00', 'night surcharge'], ['Cards', 'accepted']],
    itemsTitle: 'Late-night and extra charges',
    items: [
      ['22:00–23:00', '+20%'],
      ['23:00–02:00', '+40%'],
      ['02:00–04:00', '+20%'],
      ['Black deluxe (모범) taxi', 'Higher fare, more space'],
      ['Leaving the city', 'An extra out-of-town charge can apply'],
    ],
    tips: [
      T('Kakao T is the main app, but sign-up needs a Korean phone number. Tourists with foreign cards usually use k.ride (Kakao\'s app for foreigners) or Uber.'),
      T('Friday and Saturday nights in Hongdae, Gangnam and Itaewon are hard — street taxis often pass by. Book in an app and walk to a quieter corner.'),
      T('Some drivers refuse short trips at night. Refusing a passenger is illegal in Seoul; note the car number and report it to 120 if it happens.'),
      T('Left your phone in a taxi? Your card receipt or the app shows the car, and lost112.go.kr collects lost items.'),
    ],
    tipsNote: 'Summarised from Seoul City notices, news and traveller forums.',
    warn: 'Fake "taxis" without a meter at airports and tourist areas can overcharge. Use the official taxi rank or an app.',
    phrases: [
      { ko: '여기로 가 주세요.', en: 'Please take me here. (show the map)' },
      { ko: '카드로 계산할게요.', en: "I'll pay by card." },
      { ko: '여기서 세워 주세요.', en: 'Please stop here.' },
    ],
    sources: [SEOULTR, VK],
  },
  {
    slug: 'ktx-and-intercity-bus', category: 'transport', featured: false, sort: 53,
    title: 'Travelling between cities: KTX, SRT and express buses',
    summary: 'KTX (Seoul Station) and SRT (Suseo) reach Busan in about 2.5 hours. Express buses are cheaper. Book early for weekends and holidays.',
    steps: [
      'Fast trains: KTX leaves from Seoul and Yongsan stations; SRT leaves from Suseo in southern Seoul. Pick the station closer to you.',
      'Book KTX on letskorail.com (English) or the Korail Talk app; SRT has its own app.',
      'Buses: {{고속버스|express buses}} leave from Seoul Express Bus Terminal and Dong Seoul; {{시외버스|intercity buses}} go to smaller towns. Book in the T-money GO app.',
      'Keep your e-ticket on your phone. On trains, sit in your seat — staff check tickets on board.',
      'Sold out? Look for {{입석|standing}} or {{자유석|unreserved}} tickets, or check again — people cancel close to departure.',
    ],
    facts: [['~2.5 h', 'Seoul–Busan KTX'], ['Book early', 'Fri, Sun, holidays'], ['T-money GO', 'bus app']],
    checklist: ['Station checked (Seoul / Yongsan / Suseo)', 'Ticket in the app', 'ID (passport or residence card)', 'Arrive 10–15 min early'],
    tips: [
      T('Seollal and Chuseok tickets sell out within minutes of opening. Locals book the moment sales start or take the bus.'),
      T('Foreign tourists can buy the KORAIL PASS for unlimited rides; check the rules on letskorail.com — residents may not qualify.'),
      T('Express buses have premium (우등) seats with more legroom for a little more money — popular for long trips.'),
    ],
    tipsNote: 'Summarised from Korail notices, travel forums and news.',
    phrases: [
      { ko: '부산 가는 표 두 장 주세요.', en: 'Two tickets to Busan, please.' },
      { ko: '몇 번 타는 곳이에요?', en: 'Which platform is it?' },
      { ko: '입석도 괜찮아요.', en: 'A standing ticket is fine.' },
    ],
    places: [['Seoul Station', '서울역'], ['Suseo Station (SRT)', '수서역'], ['Seoul Express Bus Terminal', '서울고속버스터미널']],
    sources: [KORAIL, VK],
  },
  {
    slug: 'airport-to-city', category: 'transport', featured: false, sort: 54,
    title: 'From Incheon Airport to Seoul',
    summary: 'The cheapest way is the AREX all-stop train (₩4,750 to Seoul Station from Terminal 1 by card). The express train is ₩13,000 and non-stop. Airport buses go near many hotels.',
    steps: [
      'Buy a T-money card at a convenience store in the arrival hall and top it up.',
      '{{일반열차|All-stop train}}: tap your card at the AREX gates. About 1 hour to Seoul Station; connects to Lines 1, 2, 4, 5, 6, 9 and others.',
      '{{직통열차|Express train}}: ₩13,000, about 43 minutes from Terminal 1 to Seoul Station, every seat reserved. Buy at the AREX counter or machine.',
      '{{공항버스|Airport buses}} (limousine buses) stop near hotels in Myeongdong, Gangnam and other areas — easier with big luggage. Check the route at the bus ticket desk.',
      'Taxis wait at the official rank outside arrivals. They are much more expensive and charge highway tolls.',
    ],
    facts: [['₩4,750', 'all-stop to Seoul Stn'], ['₩13,000', 'express train'], ['~1 h', 'to downtown']],
    itemsTitle: 'Your options',
    items: [
      ['AREX all-stop', 'Cheapest; uses T-money; ~59 min (T1) / ~66 min (T2)'],
      ['AREX express', '₩13,000; ~43 min (T1) / ~51 min (T2); Seoul Station only'],
      ['Airport bus', 'Door-to-hotel areas; good with luggage'],
      ['Taxi', 'Most expensive; tolls extra; use the official rank'],
    ],
    tips: [
      T('Check which terminal your airline uses — from Terminal 2 the train ride is about 7 minutes longer.'),
      T('Arriving late at night? Trains stop around midnight; a few late airport buses and taxis are the options.'),
    ],
    tipsNote: 'Fares from AREX notices and travel guides, checked 2026-10.',
    phrases: [
      { ko: '서울역 가는 직통열차 표 한 장 주세요.', en: 'One express train ticket to Seoul Station, please.' },
      { ko: '명동 가는 공항버스 어디서 타요?', en: 'Where do I get the airport bus to Myeongdong?' },
    ],
    places: [['Incheon Airport Terminal 1', '인천국제공항 제1여객터미널'], ['Incheon Airport Terminal 2', '인천국제공항 제2여객터미널']],
    sources: [AREX, VK],
  },
  {
    slug: 'transit-passes-refunds', category: 'transport', featured: false, sort: 55,
    title: 'Saving on transport: K-Pass and tourist passes',
    summary: 'Seoul\'s 30-day Climate Card ended on 1 October 2026. Residents now use 모두의카드 (K-Pass) for refunds; visitors can still buy Climate Card short passes.',
    steps: [
      'Living here with a {{외국인등록증|residence card}}? Apply for a {{모두의카드|K-Pass card}} from a participating card company and register it on the K-Pass site or app.',
      'Ride at least 15 times a month and part of your fare comes back as a {{환급|refund}} (about 20–53%, depending on age and area).',
      'Sign-up needs your registration number and identity check (simple ID, phone check or certificate). Call 031-427-4415 if it fails.',
      'Short visit? Buy a Climate Card {{단기권|short pass}} for 1, 2, 3, 5 or 7 days — unlimited subway and buses in Seoul.',
      'A plain T-money card is fine if you ride only a few times a week.',
    ],
    facts: [['15+ rides', 'for K-Pass refund'], ['Ended', '30-day Climate Card'], ['1–7 days', 'tourist passes']],
    itemsTitle: 'Climate Card short passes',
    items: [
      ['1-day pass', '₩5,000'],
      ['2-day pass', '₩8,000'],
      ['3-day pass', '₩10,000'],
      ['5-day pass', '₩15,000'],
      ['7-day pass', '₩20,000'],
      ['Physical card', '₩3,000 (buy once, then top up a pass)'],
    ],
    tips: [
      T('Short passes start on the day you charge them, and do not cover the Shinbundang Line, GTX, airport buses or trains outside Seoul.'),
      T('An ordinary T-money card from a convenience store does not count for K-Pass refunds — you need a K-Pass card.'),
      T('Prices and rules change often. Check the K-Pass site or ask at a station before you buy.'),
    ],
    tipsNote: 'From Seoul City notices and news, September–October 2026.',
    phrases: [
      { ko: '기후동행카드 3일권 충전해 주세요.', en: 'Please load a 3-day Climate Card pass.' },
      { ko: '외국인도 K-패스 신청할 수 있어요?', en: 'Can foreigners apply for K-Pass?' },
    ],
    sources: [SEOULTR, KPASS],
  },
]
