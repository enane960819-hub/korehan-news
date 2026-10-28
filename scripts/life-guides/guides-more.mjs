// Life in Korea v2 (mockup L, 2026-10-29). Adds to guides.mjs:
//   EXTRA[slug] — v2 fields for the first 14 guides
//   MORE        — new guides (life, food, travel)
//   OFFICES     — immigration office finder (only addresses we could confirm;
//                 everyone else is pointed to HiKorea / 1345)
// v2 fields: facts [[value, label]], checklist [..], tips [..] ("What people
// say" — summarised from forums, university guides, news and map reviews;
// never naming staff), tipsNote, warn, items [[thing, where it goes]],
// places [[name, map search]], offices: true (show the office finder).
// Facts checked on CHECKED2; anything that varies says "check before you go".
export const CHECKED2 = '2026-10-29'

const HIKOREA = { name: 'HiKorea (Korea Immigration Service)', url: 'https://www.hikorea.go.kr' }
const IMM1345 = { name: 'Immigration Contact Center 1345', url: 'https://www.immigration.go.kr' }
const NHIS = { name: 'National Health Insurance Service', url: 'https://www.nhis.or.kr/english/main.do' }
const SEOULENV = { name: 'Seoul Metropolitan Government — recycling', url: 'https://news.seoul.go.kr/env/' }
const VK = { name: 'VisitKorea', url: 'https://english.visitkorea.or.kr' }
const SUWON = { name: 'Suwon City tourism (Visit Suwon)', url: 'https://www.suwon.go.kr' }
const KEPCO = { name: 'KEPCO (electricity, call 123)', url: 'https://home.kepco.co.kr' }

export const OFFICES = [
  { region: 'Seoul', name: 'Seoul Immigration Office', ko: '서울출입국·외국인청', addr: '151 Mokdong-dong-ro, Yangcheon-gu, Seoul', near: 'Omokgyo Station (Line 5)', note: 'Main office for most of Seoul. The busiest office — book early.' },
  { region: 'Seoul', name: 'Sejongno Branch', ko: '서울출입국·외국인청 세종로출장소', addr: '38 Jong-ro, Jongno-gu, Seoul', near: 'Jonggak Station (Line 1)', note: 'Covers parts of northern and central Seoul (e.g. Jongno, Jung, Seongbuk, Nowon). HiKorea shows which office is yours.' },
  { region: 'Gyeonggi', name: 'Suwon Immigration Office', ko: '수원출입국·외국인청', addr: '39 Bandal-ro, Yeongtong-gu, Suwon', near: 'Use the map link for the best route', note: 'Covers much of southern Gyeonggi. Some cities (e.g. Pyeongtaek) have their own branch.' },
  { region: 'Incheon', name: 'Incheon Immigration Office', ko: '인천출입국·외국인청', addr: '393 Seohae-daero, Incheon', near: 'Use the map link for the best route', note: 'Covers Incheon (not the airport), Bucheon and Gimpo.' },
]

const T = (s) => s   // keeps long tip strings readable below

export const EXTRA = {
  'first-30-days': {
    facts: [['90 days', 'to register'], ['1345', 'help line'], ['6 months', 'insurance for most']],
    checklist: ['Book your ARC visit on HiKorea', 'Prepaid SIM with your passport', 'Lease or dorm letter (proof of address)', 'Bank account after the ARC', 'T-money card', 'Save 112 / 119 / 1345'],
    tips: [T('Book the ARC first — every other step (phone plan, bank, delivery apps) gets easier once you have the card.'), T('Many newcomers say the hardest part is phone identity checks; get a phone line in your own name as soon as you can.')],
  },
  'arc-residence-card': {
    facts: [['90 days', 'deadline'], ['₩30,000', 'usual fee'], ['3–4 wks', 'to receive']],
    checklist: ['Passport', '1 photo, 3.5 × 4.5 cm, taken in the last 6 months', 'Integrated application form, filled in', 'Proof of address — lease or dorm letter', 'Students: certificate of enrollment', 'Fee — card or cash'],
    tips: [
      T('Slots fill up fast — some people wait weeks. Check HiKorea several times a day; cancellations open up.'),
      T('New arrivals can book as a non-member with their passport number.'),
      T('Many reviews describe the staff as brusque and strict. Bring every document plus copies — one missing paper usually means booking again.'),
      T('Walk-ins are usually turned away or wait for hours. Arrive 10 minutes early; numbers are sometimes called ahead of time.'),
      T('Some offices sell a revenue stamp at a separate booth that may not take cards — carry some cash.'),
    ],
    tipsNote: 'Summarised from university guides, forums and map reviews. Experiences vary by office and day.',
    warn: 'Registering after 90 days can bring a fine and cause trouble with later visa applications.',
    offices: true,
  },
  'visa-extension': {
    facts: [['4 months', 'earliest to apply'], ['~₩60,000', 'usual fee'], ['Online', 'for many visas']],
    checklist: ['Residence card and passport', 'Documents for your visa type (enrollment + transcript, or employment contract)', 'Proof of address', 'Health insurance paid up', 'Fee'],
    tips: [T('Apply early — the HiKorea e-application often takes a few weeks to process.'), T('Unpaid health insurance (₩500,000 or more) is reported to immigration and can limit your extension.'), T('If HiKorea rejects an online upload, call 1345 before booking a visit.')],
    warn: 'Staying past the end of your permitted stay — even by a day — is illegal stay: fines and possible trouble re-entering Korea.',
    offices: true,
  },
  'renting-wolse-jeonse': {
    facts: [['5–10M ₩', 'typical one-room deposit'], ['Monthly', 'rent + maintenance fee'], ['By law', 'agent fee cap']],
    tips: [T('Apps such as Zigbang and Dabang list rooms, but many listings are bait — ask the agent to confirm the exact room before you visit.'), T('Ask what the maintenance fee includes; "internet included" is common, gas and electricity usually are not.'), T('Jeonse fraud has been in the news — be extra careful with large deposits and always check the property record.')],
  },
  'lease-checklist': {
    facts: [['15 days', 'address report'], ['Free', 'fixed date stamp at the centre'], ['5', 'checks']],
    checklist: ['Owner on the property record = person signing', 'Mortgage amount on the record', 'Deposit, rent, dates and repairs written in the contract', 'Address report within 15 days', 'Fixed date stamp on the contract'],
    warn: 'Without the address report and fixed date stamp, you may not get your deposit back first if the owner has debts.',
  },
  'part-time-work-students': {
    facts: [['Before', 'your first shift'], ['TOPIK', 'sets your hours'], ['Banned', 'some jobs']],
    checklist: ['Employment contract (written)', 'Permission form from your school\'s international office', 'Transcript / attendance', 'TOPIK certificate if you have one'],
    tips: [T('Employers who say "permission isn\'t needed" are wrong — both you and the employer can be penalised.'), T('Delivery and factory jobs pay well but are not allowed on a student visa.')],
    warn: 'Working without permission can cancel your visa.',
  },
  'minimum-wage-pay': { facts: [['₩10,320', 'per hour (2026)'], ['15 h/week', 'holiday pay from'], ['1350', 'labour help line']] },
  'health-insurance': {
    facts: [['From arrival', 'students'], ['6 months', 'most other visas'], ['1577-1000', 'foreign-language line']],
    tips: [T('Students pay a reduced premium — in 2026 universities quote about ₩79,000 a month; check your own bill.'), T('Set up automatic debit so you never miss the 25th.')],
    warn: 'Unpaid premiums of ₩500,000 or more are reported to immigration and can limit a visa extension.',
  },
  'hospital-pharmacy': { facts: [['Clinic first', 'for common illness'], ['Referral', 'for big hospitals'], ['119', 'emergency']] },
  'bank-and-phone': {
    facts: [['ARC', 'needed for most'], ['Low limit', 'new accounts'], ['Prepaid', 'with a passport']],
    tips: [T('Banks near universities and in areas with many foreign residents are usually more used to foreign customers.'), T('Ask for the daily transfer limit to be raised once you have a payslip or certificate of enrollment.')],
  },
  'emergency-numbers': { facts: [['112', 'police'], ['119', 'fire & ambulance'], ['1345', 'immigration help']] },
  'trash-recycling': {
    facts: [['City bags', 'general trash'], ['Separate', 'food waste'], ['Sticker', 'for big items']],
    items: [
      ['Eggshells', 'General trash (not food waste)'],
      ['Chicken bones, big fish bones', 'General trash'],
      ['Shellfish and crab shells', 'General trash'],
      ['Dry onion and garlic skins', 'General trash'],
      ['Tea bags, coffee grounds', 'General trash'],
      ['Hard fruit pits (peach, mango)', 'General trash'],
      ['Leftover food, fruit peel', 'Food waste'],
      ['Clear PET bottles', 'Rinse, remove the label, squash, close the cap — clear-PET bin'],
      ['Delivery containers', 'Rinse → plastic. Badly stained → general trash'],
      ['Instant-noodle cups (styrofoam)', 'Rinse → styrofoam. Stained → general trash'],
      ['Snack bags, plastic wrap', 'Vinyl / plastic film'],
      ['Gel ice packs', 'General trash or the ice-pack box at the community centre'],
      ['Water ice packs', 'Empty the water, the bag goes to vinyl'],
      ['Receipts (thermal paper)', 'General trash'],
      ['Milk cartons', 'Paper cartons — separate from paper'],
      ['Batteries', 'Battery collection box'],
      ['Broken glass, ceramics', 'Special non-burnable sack (sold at the community centre)'],
    ],
    tips: [T('In Seoul houses and villas, clear PET bottles and vinyl go out only on set days — wrong-day trash is left behind.'), T('Neighbours do notice: a bag with the wrong items may be returned or reported.')],
  },
  'transit-card': { facts: [['T-money', 'any store'], ['Tap off', 'for transfers'], ['Cash', 'to top up']] },
  'study-in-korea': { facts: [['D-4', 'language school'], ['D-2', 'degree'], ['TOPIK 3+', 'often needed']] },
}

const MAP = (q) => q
export const MORE = [
  // ── Visa & stay ──
  {
    slug: 'immigration-office-tips', category: 'visa', featured: true, sort: 15,
    title: 'Visiting the immigration office: what to expect',
    summary: 'Book on HiKorea, go to the office for your address, bring every document plus copies, and expect queues. Call 1345 first if you are unsure.',
    steps: [
      'Find your office: it depends on your {{체류지|registered address}}. HiKorea shows the right office when you make a {{방문 예약|visit reservation}}.',
      'Book the exact task (registration, extension, change of status). A booking for one task cannot be used for another.',
      'Prepare the {{통합신청서|integrated application form}} at home and print copies of every document.',
      'Arrive 10–15 minutes early, take a number at the kiosk and wait for your counter.',
      'Pay the {{수수료|fee}} at the kiosk or machine; keep the receipt until your new card arrives.',
    ],
    facts: [['1345', 'call first'], ['Booking', 'required'], ['Copies', 'of everything']],
    checklist: ['Booking confirmation', 'Passport and residence card', 'Application form', 'Photo 3.5 × 4.5 cm', 'All documents + copies', 'Some cash for stamps'],
    tips: [
      T('Many reviews describe the counters as rushed and strict. Polite, short answers and a complete folder work best.'),
      T('If you do not understand, ask them to write it down — or call 1345, which has interpreters.'),
      T('Mornings at the start of the semester (March, September) are the busiest.'),
    ],
    tipsNote: 'Summarised from forums, university guides and map reviews.',
    offices: true,
    phrases: [
      { ko: '예약하고 왔어요.', en: 'I have a reservation.' },
      { ko: '천천히 말씀해 주세요.', en: 'Please speak slowly.' },
      { ko: '어떤 서류가 더 필요해요?', en: 'Which other documents do I need?' },
      { ko: '써 주실 수 있어요?', en: 'Could you write it down?' },
    ],
    sources: [HIKOREA, IMM1345],
  },
  {
    slug: 'address-change-report', category: 'visa', featured: false, sort: 16,
    title: 'Moving house: report your new address in 15 days',
    summary: 'Registered foreigners must report a new address within 15 days — online on HiKorea or at the community centre of the new address. It is free.',
    steps: [
      'After moving, report the {{체류지 변경신고|change of address}} within 15 days.',
      'Online: HiKorea → e-Application → change of address, upload your new lease.',
      'In person: go to the {{주민센터|community service centre}} of your new address with your residence card and lease.',
      'Your card gets the new address on the back (or a sticker).',
      'Also update your address with your bank, phone carrier and school or employer.',
    ],
    facts: [['15 days', 'deadline'], ['Free', 'no fee'], ['Online', 'or community centre']],
    checklist: ['Residence card', 'New lease or accommodation letter', 'Passport (in person)'],
    warn: 'Reporting late can bring a fine. The address report is also part of protecting your deposit.',
    phrases: [
      { ko: '체류지 변경 신고하러 왔어요.', en: "I'm here to report my new address." },
      { ko: '새 계약서 여기 있어요.', en: "Here's my new lease." },
    ],
    sources: [HIKOREA, IMM1345],
  },
  {
    slug: 'lost-residence-card', category: 'visa', featured: false, sort: 17,
    title: 'Lost your residence card? Reissue it in 14 days',
    summary: 'Apply for a new card within 14 days of losing it. Book a visit on HiKorea and bring your passport, a photo and the fee.',
    steps: [
      'Book an immigration visit for {{재발급|reissue}} on HiKorea.',
      'Bring your passport, the application form, one photo and proof of address.',
      'Pay the {{수수료|fee}} — offices and university guides quote ₩30,000–35,000; check when you book.',
      'Until the new card arrives, carry your passport as ID.',
      'If the card was stolen, report it to the police (112) as well.',
    ],
    facts: [['14 days', 'to apply'], ['~₩30–35k', 'fee'], ['Passport', 'as ID meanwhile']],
    warn: 'Applying late is a breach of the immigration rules and can bring a fine.',
    phrases: [{ ko: '외국인등록증을 잃어버렸어요.', en: 'I lost my residence card.' }, { ko: '재발급 받으러 왔어요.', en: "I'm here for a reissue." }],
    sources: [HIKOREA, IMM1345],
  },

  // ── Housing ──
  {
    slug: 'utility-bills', category: 'housing', featured: false, sort: 18,
    title: 'Utility bills: electricity, gas, water and maintenance',
    summary: 'In flats most bills come in one maintenance-fee bill; in houses and studios you may pay electricity and gas yourself. Set up automatic debit.',
    steps: [
      'Ask the landlord which bills are inside the {{관리비|maintenance fee}} and which are in your name.',
      '{{전기 요금|electricity bill}}: KEPCO (call 123). Change the account holder when you move in.',
      '{{가스|gas}}: call the city gas company for your area to connect and for the safety check; someone must be home.',
      '{{수도 요금|water bill}}: often included in the maintenance fee, or billed every two months.',
      'Pay by {{자동이체|automatic debit}}, bank transfer to the bill\'s account, or bill-pay in banking apps.',
      'Take photos of the meters on move-in and move-out day.',
    ],
    facts: [['123', 'KEPCO'], ['Auto-debit', 'easiest'], ['Photos', 'of meters']],
    tips: [T('Winter gas bills surprise many newcomers — floor heating (ondol) left on all day is expensive.'), T('Bills often arrive as KakaoTalk or text messages rather than paper.')],
    phrases: [{ ko: '관리비에 뭐가 포함돼요?', en: 'What does the maintenance fee include?' }, { ko: '가스 연결하려고 전화했어요.', en: "I'm calling to connect the gas." }],
    sources: [KEPCO],
  },

  // ── Health ──
  {
    slug: 'paying-health-insurance', category: 'health', featured: false, sort: 19,
    title: 'Paying your health insurance premium',
    summary: 'Foreign members on a regional plan pay in advance: each month\'s premium is due by the 25th of the month before. Automatic debit is the easiest way and gives a small discount.',
    steps: [
      'The {{고지서|bill}} comes by post, email or app. Regional members who are foreigners pay each month by the 25th of the month before; after that a {{연체금|late fee}} is added daily.',
      'Ways to pay: {{자동이체|automatic debit}}, the {{가상계좌|virtual account}} on the bill, bank or ATM, or a card (a 0.5–0.8% card fee is added).',
      'Set up automatic debit through NHIS (1577-1000, website or a branch) — it gives a small monthly discount.',
      'Students: universities publish the yearly student premium (about ₩79,000 a month in 2026); check your own amount.',
      'Leaving Korea for good? Report it so you are not billed afterwards.',
    ],
    facts: [['25th', 'of the month before'], ['Max 5%', 'late fee'], ['1577-1000', 'help (foreign languages)']],
    tips: [T('Several students report bills arriving late at a new address — set up email bills to avoid surprises.')],
    warn: 'Unpaid premiums of ₩500,000 or more are reported to immigration; extensions can then be limited (often to 6 months or less).',
    phrases: [{ ko: '보험료를 자동이체로 내고 싶어요.', en: 'I want to pay by automatic debit.' }, { ko: '고지서를 이메일로 받고 싶어요.', en: "I'd like to get the bill by email." }],
    sources: [NHIS, IMM1345],
  },

  // ── Money & phone ──
  {
    slug: 'phone-identity-check', category: 'money', featured: true, sort: 20,
    title: 'When phone identity checks (PASS) fail',
    summary: 'Korean apps verify you with a phone line in your own name. Most failures come from a prepaid or foreign number, or a name typed differently from your card.',
    steps: [
      'Most sites use {{본인인증|identity verification}} through your phone carrier or the PASS app.',
      'It only works with a {{휴대폰|mobile phone}} line registered in your own name with your residence card number.',
      'Type your name exactly as on your residence card — spaces and order matter.',
      'If it loops forever, switch between Wi-Fi and mobile data, update or reinstall PASS, then retry.',
      'Some services simply do not accept foreigners online — call their customer centre and ask for another way.',
    ],
    facts: [['Own name', 'phone line needed'], ['ARC no.', 'not passport'], ['Name', 'exactly as on card']],
    tips: [T('Budget carriers (알뜰폰) are cheaper and usually work for verification, but some shops limit which nationalities they sign up — ask first.'), T('A line in a friend\'s name will not pass checks in your name.')],
    phrases: [{ ko: '본인인증이 안 돼요.', en: "The identity check doesn't work." }, { ko: '외국인도 가입할 수 있어요?', en: 'Can foreigners sign up?' }],
    sources: [{ name: 'PASS app (carriers\' identity service)', url: 'https://www.passauth.co.kr' }],
  },

  // ── Daily life ──
  {
    slug: 'delivery-apps', category: 'daily', featured: false, sort: 21,
    title: 'Ordering food delivery',
    summary: 'Baemin and Coupang Eats are the main apps. You need a Korean phone number for sign-up; type your address in Korean and add the building door code.',
    steps: [
      'Install {{배달의민족|Baemin}} or {{쿠팡이츠|Coupang Eats}} and verify your phone number.',
      'Enter your address in Korean, then the {{동|building}} and {{호|unit}} number.',
      'Add the {{공동현관 비밀번호|building door code}} in the request note so the rider can get in.',
      'Check the {{최소주문금액|minimum order}} and the {{배달팁|delivery fee}}.',
      'Write a note such as "문 앞에 두고 벨 눌러 주세요" (leave it at the door and ring).',
    ],
    facts: [['Korean no.', 'needed'], ['Door code', 'in the note'], ['Min. order', 'often ₩12–15k']],
    tips: [T('Ordering together with a friend is common to reach the minimum order.')],
    phrases: [{ ko: '문 앞에 두고 벨 눌러 주세요.', en: 'Leave it at the door and ring the bell.' }, { ko: '공동현관 비밀번호는 1234예요.', en: 'The door code is 1234.' }],
    sources: [VK],
  },

  // ── Food ──
  {
    slug: 'korean-restaurant-basics', category: 'food', featured: true, sort: 30,
    title: 'Eating out in Korea: how restaurants work',
    summary: 'Water and side dishes are free, you call staff with a bell, pay at the counter after eating, and never tip.',
    steps: [
      'Water is free — often {{셀프|self-service}} from a corner or fridge.',
      'Press the {{호출벨|call bell}} on the table to order or ask for something.',
      'Basic {{반찬|side dishes}} (kimchi, lettuce) are refilled free; costly ones (egg stew, meat) may cost extra.',
      'Many BBQ places need at least two portions ({{인분|servings}}).',
      'Pay at the {{계산대|counter}} on your way out. No tipping — leaving cash may make staff chase you.',
    ],
    facts: [['No tips', 'ever'], ['Free', 'water & refills'], ['Bell', 'to call staff']],
    phrases: [{ ko: '여기요!', en: 'Excuse me! (to call staff)' }, { ko: '반찬 좀 더 주세요.', en: 'More side dishes, please.' }, { ko: '계산해 주세요.', en: 'The bill, please.' }],
    sources: [VK],
  },
  {
    slug: 'korean-bbq', category: 'food', featured: false, sort: 31,
    title: 'Korean BBQ: how to order and eat',
    summary: 'Order meat by the portion, grill it at the table, wrap it in lettuce, and finish with a stew, cold noodles or fried rice.',
    steps: [
      'Popular cuts: {{삼겹살|pork belly}}, {{목살|pork neck}}, {{갈비|marinated ribs}}. Order at least two portions.',
      'Staff may grill for you; otherwise use the tongs and cut with {{가위|scissors}}.',
      'Make a {{쌈|lettuce wrap}}: lettuce, meat, a little ssamjang, garlic — one bite.',
      'Finish the meal with {{된장찌개|soybean stew}}, {{냉면|cold noodles}} or fried rice.',
    ],
    facts: [['2 portions', 'usual minimum'], ['Scissors', 'to cut'], ['Stew', 'to finish']],
    phrases: [{ ko: '삼겹살 2인분 주세요.', en: 'Two portions of pork belly, please.' }, { ko: '불판 좀 갈아 주세요.', en: 'Could you change the grill plate?' }, { ko: '된장찌개 하나 주세요.', en: 'One soybean stew, please.' }],
    sources: [VK],
  },
  {
    slug: 'convenience-store-food', category: 'food', featured: false, sort: 32,
    title: 'Convenience-store food like a local',
    summary: 'Triangle kimbap, lunch boxes and cup noodles with free hot water — watch for 1+1 and 2+1 deals.',
    steps: [
      'Open {{삼각김밥|triangle kimbap}} by pulling tab 1, then the two sides.',
      '{{도시락|lunch boxes}} can be heated in the store microwave.',
      'Cup noodles: hot water and chopsticks are free at the counter area.',
      'Look for {{1+1|buy one get one}} and {{2+1|buy two get one}} stickers.',
      'Some stores near the Han River have instant-ramen cookers.',
    ],
    facts: [['24 h', 'most stores'], ['Free', 'hot water'], ['1+1', 'deals']],
    phrases: [{ ko: '데워 주세요.', en: 'Please heat it up.' }, { ko: '봉투 필요 없어요.', en: "I don't need a bag." }],
    sources: [VK],
  },
  {
    slug: 'gwangjang-market', category: 'food', featured: true, sort: 33,
    title: 'Gwangjang Market: what to eat (and how not to overpay)',
    summary: 'Seoul\'s best-known food market: mung-bean pancakes, mini kimbap and beef tartare. It has had price controversies — check prices before you order.',
    steps: [
      'Get off at {{종로5가역|Jongno 5-ga Station}} (Line 1) or Euljiro 4-ga.',
      'Classics: {{빈대떡|mung-bean pancake}}, {{마약김밥|mini kimbap}}, {{육회|beef tartare}} alley, {{칼국수|knife-cut noodles}}.',
      'Look at the menu board for the price and, for platters, the weight (Seoul asked stalls to show it).',
      'Order one dish per stall and move on — sharing small plates is the fun.',
      'Bring cash; some stalls still don\'t take cards.',
    ],
    facts: [['Line 1', 'Jongno 5-ga'], ['Cash', 'often needed'], ['Check', 'price & weight']],
    tips: [
      T('Since 2023 the market has repeatedly been in the news for small portions and pushy selling (e.g. a ₩15,000 mixed-pancake platter). Seoul introduced weight labels, mystery shoppers and stall-name boards.'),
      T('Locals often suggest Mangwon or Gyeongdong market for a calmer, cheaper market meal.'),
      T('Ask the price before you sit down, and don\'t feel obliged to order extra.'),
    ],
    tipsNote: 'From news reports (2023–2025) and online reviews.',
    places: [['Gwangjang Market', '광장시장']],
    phrases: [{ ko: '이거 얼마예요?', en: 'How much is this?' }, { ko: '빈대떡 하나 주세요.', en: 'One mung-bean pancake, please.' }, { ko: '카드 돼요?', en: 'Can I pay by card?' }],
    sources: [VK],
  },
  {
    slug: 'euljiro-old-eateries', category: 'food', featured: false, sort: 34,
    title: 'Euljiro: old-school eateries and Pyongyang cold noodles',
    summary: 'Printing-shop alleys with decades-old restaurants: grilled pollack and beer outdoors, and one of Seoul\'s oldest Pyongyang naengmyeon places.',
    steps: [
      'Get off at {{을지로3가역|Euljiro 3-ga Station}} (Lines 2 and 3).',
      '{{노가리 골목|dried-pollack alley}}: plastic tables on the street, grilled pollack with beer — best on summer evenings.',
      'Try {{평양냉면|Pyongyang cold noodles}}: a mild beef broth. Woo Lae Oak (since 1946) is a famous one nearby.',
      'Many small bars hide upstairs in old printing buildings — look for signs on the stairs.',
    ],
    facts: [['Lines 2·3', 'Euljiro 3-ga'], ['Evenings', 'busiest'], ['Since 1946', 'Woo Lae Oak']],
    tips: [T('Pyongyang naengmyeon tastes plain at first — many people say it grows on you by the second bowl.')],
    places: [['Euljiro nogari alley', '을지로 노가리골목'], ['Woo Lae Oak', '우래옥']],
    phrases: [{ ko: '물냉면 하나 주세요.', en: 'One cold noodle soup, please.' }, { ko: '노가리하고 맥주 주세요.', en: 'Grilled pollack and beer, please.' }],
    sources: [VK],
  },
  {
    slug: 'mangwon-market', category: 'food', featured: false, sort: 35,
    title: 'Mangwon Market and the Han River',
    summary: 'A neighbourhood market with cheap snacks, close to Mangwon Han River Park — a relaxed local alternative to the tourist markets.',
    steps: [
      'Get off at {{망원역|Mangwon Station}} (Line 6), exit 2.',
      'Snack on {{호떡|sweet pancakes}}, fried chicken pieces, croquettes and tteokbokki.',
      'Buy fruit or side dishes for a picnic, then walk 15 minutes to {{한강공원|Han River Park}}.',
      'Explore the cafés on the street locals call Mangridan-gil.',
    ],
    facts: [['Line 6', 'Mangwon'], ['15 min', 'to the river'], ['Cheap', 'snacks']],
    tips: [T('Reviews say it is less crowded with tourists, so you can browse at your own pace.')],
    places: [['Mangwon Market', '망원시장'], ['Mangwon Han River Park', '망원한강공원']],
    phrases: [{ ko: '이거 하나만 주세요.', en: 'Just one of these, please.' }, { ko: '포장해 주세요.', en: 'To go, please.' }],
    sources: [VK],
  },
  {
    slug: 'busan-food', category: 'food', featured: false, sort: 36,
    title: 'Busan food: pork soup, wheat noodles and the fish market',
    summary: 'Busan\'s classics are dwaeji gukbap (pork rice soup), milmyeon (cold wheat noodles), fish cakes and raw fish at Jagalchi.',
    steps: [
      '{{돼지국밥|pork rice soup}}: add the chives (locals call them 정구지), salted shrimp and a little chilli paste.',
      '{{밀면|wheat cold noodles}}: Busan\'s version of naengmyeon, born after the Korean War.',
      '{{어묵|fish cakes}}: try them hot from street stalls or bakeries that specialise in them.',
      '{{자갈치시장|Jagalchi Market}}: pick fish downstairs, eat it upstairs (a table fee applies).',
      '{{씨앗호떡|seed-filled pancake}}: a Nampo-dong street snack.',
    ],
    facts: [['Gukbap', 'local staple'], ['Milmyeon', 'summer'], ['Jagalchi', 'fish market']],
    tips: [T('At fish markets, agree the price and weight before they cut the fish.')],
    places: [['Jagalchi Market', '자갈치시장'], ['BIFF Square (Nampo)', 'BIFF광장']],
    phrases: [{ ko: '돼지국밥 하나 주세요.', en: 'One pork rice soup, please.' }, { ko: '밀면 비빔으로 주세요.', en: 'Spicy mixed milmyeon, please.' }, { ko: '몇 인분이에요?', en: 'How many servings is it?' }],
    sources: [VK],
  },

  // ── Travel ──
  {
    slug: 'suwon-hwaseong', category: 'travel', featured: true, sort: 40,
    title: 'Day trip: Suwon Hwaseong Fortress',
    summary: 'A UNESCO World Heritage fortress about an hour from Seoul. Walk the 5.7 km wall, visit the palace and end on Suwon\'s fried-chicken street.',
    steps: [
      'Take Line 1 to {{수원역|Suwon Station}}, then a bus or taxi to the palace area (or Line 1 to Hwaseo Station for the west gate).',
      'Start at {{화성행궁|Hwaseong Haenggung Palace}} (09:00–18:00, open every day).',
      'Walk part of the wall: the city suggests 60-minute and 120-minute routes; the full loop is about 5.7 km.',
      'On weekends the palace often opens at night in season — check the city site.',
      'Eat at {{통닭거리|chicken street}} near the palace.',
    ],
    facts: [['~1 h', 'from Seoul'], ['5.7 km', 'full wall'], ['09–18', 'palace hours']],
    tips: [T('Comfortable shoes — the wall has steep parts.'), T('Visit in autumn for the Suwon Hwaseong Cultural Festival, but expect crowds.')],
    places: [['Hwaseong Haenggung', '화성행궁'], ['Suwon Chicken Street', '수원 통닭거리']],
    phrases: [{ ko: '화성행궁 어떻게 가요?', en: 'How do I get to Hwaseong Haenggung?' }, { ko: '입장료가 얼마예요?', en: 'How much is admission?' }],
    sources: [SUWON, VK],
  },
  {
    slug: 'gapyeong-chuncheon', category: 'travel', featured: false, sort: 41,
    title: 'Day trip: Gapyeong and Chuncheon by train',
    summary: 'The ITX-Cheongchun train takes you to Gapyeong (Nami Island) and Chuncheon (dakgalbi). Book weekend seats early.',
    steps: [
      'Take the {{ITX-청춘|ITX-Cheongchun}} from Yongsan or Cheongnyangni, or the slower Gyeongchun Line subway.',
      'Gapyeong Station → bus or taxi to the ferry for {{남이섬|Nami Island}}.',
      'The Garden of Morning Calm: from Cheongpyeong Station by bus or taxi (about 25 min).',
      'In Chuncheon, eat {{닭갈비|spicy stir-fried chicken}} and {{막국수|buckwheat noodles}}.',
    ],
    facts: [['ITX', 'fastest'], ['Weekend', 'book early'], ['Dakgalbi', 'in Chuncheon']],
    places: [['Nami Island', '남이섬'], ['Garden of Morning Calm', '아침고요수목원'], ['Chuncheon Dakgalbi Street', '명동 닭갈비골목']],
    phrases: [{ ko: '청춘 열차 표 두 장 주세요.', en: 'Two ITX-Cheongchun tickets, please.' }, { ko: '닭갈비 2인분 주세요.', en: 'Two portions of dakgalbi, please.' }],
    sources: [VK],
  },
  {
    slug: 'yangpyeong-dumulmeori', category: 'travel', featured: false, sort: 42,
    title: 'Day trip: Dumulmeori, where two rivers meet',
    summary: 'Morning mist on the river, an old zelkova tree and lotus gardens — 15 minutes\' walk from Yangsu Station.',
    steps: [
      'Take the Gyeongui–Jungang Line to {{양수역|Yangsu Station}} and walk about 15 minutes.',
      'Go early for {{물안개|river mist}} at sunrise.',
      'Visit {{세미원|Semiwon}} lotus gardens next door (summer is best).',
      'Rent a bike — the riverside path runs along the old railway.',
    ],
    facts: [['15 min', 'walk from station'], ['Sunrise', 'best'], ['Summer', 'lotus']],
    places: [['Dumulmeori', '두물머리'], ['Semiwon', '세미원']],
    phrases: [{ ko: '자전거 빌릴 수 있어요?', en: 'Can I rent a bike?' }],
    sources: [VK],
  },
  {
    slug: 'ganghwa-island', category: 'travel', featured: false, sort: 43,
    title: 'Day trip: Ganghwa Island',
    summary: 'Dolmens (UNESCO), an old temple and a local market — about 1.5 hours by bus from Sinchon.',
    steps: [
      'Take an intercity bus from the {{신촌|Sinchon}} area to Ganghwa (about 1.5 hours).',
      'See the {{고인돌|dolmens}}, part of a UNESCO World Heritage site.',
      'Visit {{전등사|Jeondeungsa Temple}}, one of Korea\'s oldest temples.',
      'Try purple-radish kimchi at {{풍물시장|the traditional market}}.',
    ],
    facts: [['~1.5 h', 'bus'], ['UNESCO', 'dolmens'], ['Market', 'radish kimchi']],
    places: [['Ganghwa Dolmen site', '강화 고인돌'], ['Jeondeungsa', '전등사'], ['Ganghwa Pungmul Market', '강화풍물시장']],
    phrases: [{ ko: '강화도 가는 버스 어디에서 타요?', en: 'Where do I catch the bus to Ganghwa?' }],
    sources: [VK],
  },
  {
    slug: 'busan-yeongdo', category: 'travel', featured: false, sort: 44,
    title: 'Busan: Yeongdo and Huinnyeoul Culture Village',
    summary: 'A free cliffside village above the sea, a coastal walk and Taejongdae cliffs — a short bus ride from Nampo.',
    steps: [
      'Take a bus from {{남포동|Nampo-dong}} across the bridge to Yeongdo.',
      'Walk through {{흰여울문화마을|Huinnyeoul Culture Village}} — free to enter, people live here.',
      'Follow the coastal walking path below the village.',
      'Continue to {{태종대|Taejongdae}} for cliffs and a lighthouse.',
    ],
    facts: [['Free', 'village'], ['Bus', 'from Nampo'], ['Quiet', 'people live here']],
    tips: [T('Residents ask visitors to keep voices down and not photograph inside homes.')],
    places: [['Huinnyeoul Culture Village', '흰여울문화마을'], ['Taejongdae', '태종대']],
    phrases: [{ ko: '사진 찍어도 돼요?', en: 'May I take a photo?' }],
    sources: [VK],
  },
  {
    slug: 'han-river-picnic', category: 'travel', featured: false, sort: 45,
    title: 'Han River picnic like a local',
    summary: 'Spread a mat, order fried chicken to the park\'s delivery zone, cook ramen at the riverside convenience store and take your trash home.',
    steps: [
      'Pick a park: Yeouido, Banpo (rainbow fountain in season) or Ttukseom.',
      'Order {{치킨|fried chicken}} to the park\'s {{배달존|delivery zone}} and meet the rider there.',
      'Use the ramen cooker at a riverside {{편의점|convenience store}}.',
      'Rent a {{따릉이|Seoul public bike}} with the app.',
      'Separate your trash at the park bins or take it home.',
    ],
    facts: [['Delivery zone', 'for orders'], ['Ttareungyi', 'bikes'], ['Trash', 'separate']],
    places: [['Yeouido Hangang Park', '여의도한강공원'], ['Banpo Hangang Park', '반포한강공원']],
    phrases: [{ ko: '배달존으로 가져다주세요.', en: 'Please bring it to the delivery zone.' }],
    sources: [VK],
  },
]
