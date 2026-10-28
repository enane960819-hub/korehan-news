// Life in Korea — batch 3 (2026-10-29): housing, money, work, health and
// safety guides. Same v2 fields as guides-more.mjs. Facts checked on
// CHECKED2 against official pages (FSC, MOIS, MOGEF, NPS, HUG) and news;
// anything that varies by case says so and points to the official contact.
const HUG = { name: 'HUG — Korea Housing & Urban Guarantee Corp.', url: 'https://www.khug.or.kr' }
const KLAC = { name: 'Korea Legal Aid Corporation (132)', url: 'https://www.klac.or.kr' }
const COURT = { name: 'Supreme Court e-filing (임차권등기명령)', url: 'https://ecfs.scourt.go.kr' }
const MOLIT = { name: 'Ministry of Land, Infrastructure and Transport', url: 'https://www.molit.go.kr' }
const FSC = { name: 'Financial Services Commission', url: 'https://www.fsc.go.kr' }
const MOEL = { name: 'Ministry of Employment and Labor (1350)', url: 'https://www.moel.go.kr/english/' }
const NPS = { name: 'National Pension Service (1355)', url: 'https://www.nps.or.kr' }
const EGEN = { name: 'E-Gen — open ERs and pharmacies', url: 'https://www.e-gen.or.kr' }
const SGC = { name: 'Seoul Global Center', url: 'https://global.seoul.go.kr' }
const MOIS = { name: 'Ministry of the Interior and Safety — Emergency Ready App', url: 'https://www.safekorea.go.kr' }
const DANURI = { name: 'Danuri Helpline 1577-1366', url: 'https://www.liveinkorea.kr' }
const LOST112 = { name: 'LOST112 (police lost and found)', url: 'https://www.lost112.go.kr' }
const T = (s) => s

export const MORE2 = [
  // ── Housing ──
  {
    slug: 'finding-a-room', category: 'housing', featured: true, sort: 60,
    title: 'Finding a room: apps, viewings and the broker fee',
    summary: 'Browse on Zigbang, Dabang or Naver Real Estate, view at least three places with a licensed broker, and agree the broker fee before you sign.',
    steps: [
      'Search on {{직방|Zigbang}}, {{다방|Dabang}} or Naver Real Estate ({{네이버 부동산|Naver Real Estate}}). Filter by deposit, monthly rent and station.',
      'Call or message the {{공인중개사|licensed broker}} on the listing and book viewings. Seeing three or more places in one afternoon is normal.',
      'At each viewing check water pressure, mould in corners and window frames, sunlight, phone signal and noise.',
      'Ask what the {{관리비|maintenance fee}} covers (water, internet, cleaning) — it can add ₩50,000–150,000 a month.',
      'Before you sign, ask the broker for the {{중개보수|broker fee}} in writing. It is capped by law and paid when the contract is signed.',
    ],
    facts: [['3+', 'viewings'], ['Broker fee', 'capped by law'], ['관리비', 'ask what it covers']],
    itemsTitle: 'Broker fee caps for rentals (most cities)',
    items: [
      ['How the amount is counted', 'Deposit + monthly rent × 100 (× 70 if that comes to under ₩50M)'],
      ['Under ₩50M', '0.5%, at most ₩200,000'],
      ['₩50M – ₩100M', '0.4%, at most ₩300,000'],
      ['₩100M – ₩600M', '0.3%'],
      ['Example', '₩10M deposit + ₩500k rent → ₩60M → about ₩240,000'],
    ],
    checklist: ['Budget: deposit + monthly rent + 관리비', 'Station and commute time checked', 'Water, mould, sunlight checked', 'Broker fee agreed in writing', 'Lease checks done (see "Before you sign a lease")'],
    tips: [
      T('Listing photos are often wide-angle — rooms look smaller in real life. Some listings are bait ("허위매물") to get you to call; if the "perfect" room is suddenly gone, move on.'),
      T('Semi-basement rooms (반지하) are cheaper but can be damp and have flooded in heavy rain. Many people avoid them.'),
      T('Areas near universities have many brokers used to foreign tenants. Bringing a Korean-speaking friend helps with the contract.'),
      T('Direct deals with owners (no broker) are cheaper but give you less protection. If you do one, do every lease check yourself.'),
    ],
    tipsNote: 'Summarised from expat forums, university housing guides and news.',
    phrases: [
      { ko: '보증금 천만 원에 월세 오십만 원 이하로 찾고 있어요.', en: "I'm looking for ₩10M deposit and ₩500k rent or less." },
      { ko: '관리비에 뭐가 포함돼요?', en: 'What does the maintenance fee include?' },
      { ko: '중개보수는 얼마예요?', en: 'How much is the broker fee?' },
    ],
    sources: [MOLIT, SGC],
  },
  {
    slug: 'goshiwon-share-house', category: 'housing', featured: false, sort: 61,
    title: 'Goshiwon, one-room or share house?',
    summary: 'A goshiwon is a tiny furnished room with little or no deposit — good for the first months. One-rooms need a deposit but give you a kitchen and bathroom of your own.',
    steps: [
      '{{고시원|Goshiwon}}: a very small room, often with rice, kimchi and internet included. Little or no deposit, monthly contract.',
      '{{원룸|One-room}}: studio with your own bathroom and small kitchen. Usually a deposit of several million won and a 1-year lease.',
      '{{오피스텔|Officetel}}: a studio in an office-style building. Higher 관리비, often better security.',
      '{{셰어하우스|Share house}}: your own or a shared bedroom, shared kitchen. Many target foreigners and students.',
      'Whatever you choose, visit in person before paying — never send money for a room you have not seen.',
    ],
    facts: [['Goshiwon', 'low deposit'], ['One-room', '1-year lease'], ['Visit', 'before paying']],
    itemsTitle: 'Which one fits you',
    items: [
      ['First 1–3 months', 'Goshiwon or share house — no big deposit'],
      ['Staying a year or more', 'One-room or officetel'],
      ['Want to meet people', 'Share house'],
      ['Cooking often', 'One-room (goshiwon kitchens are shared and small)'],
    ],
    checklist: ['Window in the room (costs more, worth it)', 'Fire exit and sprinklers', 'Own or shared bathroom', 'What is included in the price', 'Notice period to move out'],
    tips: [
      T('Rooms with a window (창문 있는 방) cost a little more; people who chose a windowless room often say it hurt their mood and sleep.'),
      T('Old goshiwons have had deadly fires. Check the exit route, fire extinguisher and sprinklers on your floor.'),
      T('Walls are thin. Ask current residents about noise if you can.'),
    ],
    tipsNote: 'Summarised from expat forums, student guides and news reports.',
    phrases: [
      { ko: '창문 있는 방 있어요?', en: 'Do you have a room with a window?' },
      { ko: '보증금 없이 한 달만 살 수 있어요?', en: 'Can I stay just one month without a deposit?' },
    ],
    sources: [SGC],
  },
  {
    slug: 'getting-deposit-back', category: 'housing', featured: false, sort: 62,
    title: 'Getting your deposit back when you move out',
    summary: 'Tell the owner at least 2 months before the lease ends, photograph the room, and do not move out your address until you have the deposit — or a court lease registration.',
    steps: [
      'Tell the owner you are leaving at least 2 months before the lease ends — by text or message, so you have a record. Without notice, the lease can renew itself.',
      'On moving day, check the room together. {{통상 손모|Normal wear}} (faded wallpaper, small marks) is the owner\'s cost, not yours.',
      'Pay the last utility and 관리비 bills ({{정산|settle up}}) and get the full deposit the same day.',
      'Not paid? Do not report a new address yet. Apply to the district court for an {{임차권등기명령|lease registration order}} — you can do it online.',
      'Once it is registered, you can move and report your new address and still keep your right to the deposit.',
      'Free help: Korea Legal Aid Corporation (132) and the housing lease dispute committee.',
    ],
    facts: [['2 months', 'notice before end'], ['Photos', 'at move-in & out'], ['132', 'free legal aid']],
    checklist: ['Notice sent 2+ months before (screenshot)', 'Move-in photos found', 'Last bills settled', 'Deposit received before moving the address', 'If not: court lease registration'],
    tips: [
      T('Many owners pay the deposit from the next tenant\'s money. If they say "wait until a new tenant comes", that is their problem — the deposit is due when the lease ends.'),
      T('A jeonse deposit is large. Many tenants buy HUG deposit-return insurance at the start; foreigners can join under the same rules as Koreans.'),
      T('Keep every message with the owner. Courts and dispute committees decide on records, not memories.'),
    ],
    tipsNote: 'From the Housing Lease Protection Act, court guides and tenant forums. Not legal advice.',
    warn: 'If you report a new address before the deposit is paid or the court registration is done, you can lose your priority to get the deposit back.',
    phrases: [
      { ko: '계약 만료일에 나가려고 합니다.', en: 'I plan to move out when the lease ends.' },
      { ko: '보증금은 언제 돌려주세요?', en: 'When will you return my deposit?' },
    ],
    sources: [COURT, HUG, KLAC],
  },

  // ── Money ──
  {
    slug: 'bank-account-limits', category: 'money', featured: false, sort: 63,
    title: 'Why can\'t I send more money? Account limits',
    summary: 'New accounts are often "limited accounts": about ₩1M a day online or at ATMs and ₩3M at the counter. Show proof of salary or study to lift the limit.',
    steps: [
      'Most new accounts start as a {{한도제한계좌|limited account}} to stop fraud. Internet-only banks may keep lower limits.',
      'To lift it, the bank checks the {{금융거래 목적|purpose of the account}} — salary, school fees, rent and so on.',
      'For salary: a health insurance {{자격득실확인서|eligibility certificate}} or a {{원천징수영수증|tax withholding receipt}} works at most banks.',
      'Students: a certificate of enrollment and a school fee or rent payment record may be accepted — ask your branch.',
      'Go back to the branch with the documents, or ask if your bank can lift it in the app.',
    ],
    facts: [['₩1M', 'per day online'], ['₩3M', 'at the counter'], ['Salary proof', 'lifts the limit']],
    tips: [
      T('Tell the bank on day one that the account is for salary — and get your employer to pay into it. After a few payslips the limit is easier to lift.'),
      T('Branches near universities and industrial areas are more used to foreign customers and their documents.'),
    ],
    tipsNote: 'From Financial Services Commission notices and bank guides.',
    warn: 'Never lend, sell or "rent out" your bank account or card — even to a friend. It is used for phone scams; you can be prosecuted and your visa can be cancelled.',
    phrases: [
      { ko: '이체 한도를 올리고 싶어요.', en: "I'd like to raise my transfer limit." },
      { ko: '급여 통장으로 쓸 거예요.', en: "I'll use it for my salary." },
    ],
    sources: [FSC],
  },
  {
    slug: 'sending-money-home', category: 'money', featured: false, sort: 64,
    title: 'Sending money home',
    summary: 'Use a bank or a licensed remittance app. Licensed app transfers are cheaper; there are yearly limits, and above them you need documents.',
    steps: [
      'Licensed {{소액해외송금업|small-sum remittance}} apps are usually cheaper and faster than a bank wire. Use only apps registered with Korean financial authorities.',
      'Sign up with your residence card and a Korean bank account in your own name.',
      'Yearly limits: about US$50,000 through small-sum remittance companies; up to about US$100,000 in total a year without {{증빙서류|supporting documents}}.',
      'Sending more — for example a salary saved over years? Go to your bank with your income documents.',
      'Compare the total cost: fee plus the exchange rate the app gives you.',
    ],
    facts: [['Licensed', 'apps only'], ['~$50k', 'per year via apps'], ['Rate + fee', 'compare both']],
    tips: [
      T('Many workers compare two or three apps each month; the cheapest changes with the exchange rate.'),
      T('Keep your payslips — banks ask for proof of income for larger amounts.'),
    ],
    tipsNote: 'From bank and FSC guidance (2026 rules). Limits can change — the app shows your remaining limit.',
    warn: 'Informal "hand-carry" or underground exchange (환치기) is illegal. Accounts used for it get frozen and you can be punished.',
    phrases: [
      { ko: '해외 송금 수수료가 얼마예요?', en: 'How much is the overseas transfer fee?' },
      { ko: '올해 송금 한도가 얼마 남았어요?', en: 'How much of my yearly limit is left?' },
    ],
    sources: [FSC],
  },

  // ── Work ──
  {
    slug: 'severance-and-pension', category: 'work', featured: false, sort: 65,
    title: 'Severance pay and pension when you leave a job',
    summary: 'After 1 year at the same workplace (15+ hours a week), you are owed about 30 days\' pay per year worked, within 14 days of leaving. Some workers can also claim back their pension.',
    steps: [
      '{{퇴직금|Severance pay}}: 1 year or more at one workplace, working 15 hours or more a week on average.',
      'Amount: about 30 days of {{평균임금|average pay}} for each year worked. It is due within 14 days of your last day.',
      'E-9 workers: the {{출국만기보험|departure guarantee insurance}} your employer pays counts toward it; if it is less than your severance, the employer pays the rest.',
      '{{국민연금|National pension}}: you can get a {{반환일시금|lump-sum refund}} when you leave Korea if your country has an agreement with Korea, or if you joined on an E-8, E-9 or H-2 visa.',
      'Check your case with the National Pension Service (1355) before you fly — you can claim at the airport or after leaving.',
    ],
    facts: [['1 year', '15+ h a week'], ['30 days', 'pay per year'], ['14 days', 'to pay you']],
    checklist: ['Last payslips saved', 'Start and end dates confirmed', 'Severance amount checked', 'Pension refund eligibility asked (1355)', 'Overseas bank details for refunds'],
    tips: [
      T('Some employers end a contract at 11 months to avoid severance. If you keep working after that, the time usually still counts — ask the labor office (1350).'),
      T('Pension refunds can be claimed for several years after you leave, but it is far easier before you go.'),
    ],
    tipsNote: 'From the Employee Retirement Benefit Security Act, NPS and labor guides. Not legal advice.',
    phrases: [
      { ko: '퇴직금은 언제 받을 수 있어요?', en: 'When can I get my severance pay?' },
      { ko: '국민연금 반환일시금 받을 수 있어요?', en: 'Can I get my pension refunded?' },
    ],
    sources: [MOEL, NPS],
  },
  {
    slug: 'unpaid-wages', category: 'work', featured: false, sort: 66,
    title: 'Unpaid wages: how to get your money',
    summary: 'Keep records, ask in writing, then file a free complaint with the labor office. Interpreters are available, and a state fund can pay part of what you are owed.',
    steps: [
      'Collect proof: contract, payslips, bank records, work schedules, messages with your boss.',
      'Ask for the money in writing (a text is fine) and keep the reply.',
      'File a {{진정|complaint}} for {{임금체불|unpaid wages}} on the Labor Portal or at the local labor office. It is free; ask for an interpreter.',
      'A {{근로감독관|labor inspector}} calls both sides. If the employer still does not pay, ask for a certificate of unpaid wages.',
      'With that certificate you can claim a {{대지급금|substitute payment}} from the state fund — up to ₩10M in total (up to ₩7M wages + ₩7M severance).',
    ],
    facts: [['1350', 'labor hotline'], ['Free', 'to file'], ['₩10M', 'max fund payment']],
    checklist: ['Contract', 'Payslips or bank records', 'Hours worked (photos of schedules, app logs)', 'Messages with the employer', 'Complaint filed'],
    tips: [
      T('Wage rights apply to every worker in Korea. Labor offices and migrant worker centers help people in all situations.'),
      T('Workers earning under about ₩4M a month can get free legal help from Korea Legal Aid (132).'),
      T('Do not wait: claims have time limits (generally 3 years for wages).'),
    ],
    tipsNote: 'From the Labor Standards Act, MOEL and Korea Workers\' Compensation & Welfare Service guides. Not legal advice.',
    phrases: [
      { ko: '월급을 아직 못 받았어요.', en: "I still haven't been paid." },
      { ko: '임금체불 진정을 하고 싶어요.', en: "I want to file an unpaid-wage complaint." },
      { ko: '통역해 주실 수 있어요?', en: 'Can you provide an interpreter?' },
    ],
    sources: [MOEL, KLAC],
  },

  // ── Health ──
  {
    slug: 'english-speaking-hospitals', category: 'health', featured: false, sort: 67,
    title: 'Hospitals in English, night clinics and the ER',
    summary: 'Big university hospitals have international clinics; for a cold, go to a local clinic. Use the ER only for real emergencies — non-urgent ER visits cost much more.',
    steps: [
      'Common illness: a local {{의원|clinic}} is fastest and cheapest. Many young doctors speak some English.',
      'Need English? University hospitals have an {{국제진료센터|international clinic}} with coordinators. Book ahead.',
      'Interpreting by phone: 120 (Seoul, Dasan call center) or 1330 (Korea Travel Hotline, 24 hours).',
      'At night or on holidays: E-Gen (e-gen.or.kr) shows open ERs, clinics and pharmacies near you.',
      'Real emergency: call 119. The ambulance is free; the hospital bill is separate.',
    ],
    facts: [['119', 'ambulance, free'], ['1330', '24 h interpreting'], ['E-Gen', 'open at night']],
    tips: [
      T('Non-urgent visits to big hospital ERs are charged much more and you may wait for hours. A night clinic or pharmacy is usually better for a fever or a cold.'),
      T('Children at night: look for a 달빛어린이병원 (late-night children\'s clinic) on E-Gen.'),
      T('Bring your residence card — your health insurance is checked with it.'),
    ],
    tipsNote: 'Summarised from Seoul City, E-Gen and expat forums.',
    phrases: [
      { ko: '영어 되는 의사 선생님 있어요?', en: 'Is there a doctor who speaks English?' },
      { ko: '지금 문 연 약국 있어요?', en: 'Is there a pharmacy open now?' },
      { ko: '통역 서비스 있어요?', en: 'Do you have an interpreting service?' },
    ],
    sources: [EGEN, SGC],
  },

  // ── Safety ──
  {
    slug: 'disaster-alerts', category: 'emergency', featured: false, sort: 68,
    title: 'Disaster alerts, sirens and the Emergency Ready App',
    summary: 'Korean phones get emergency texts in Korean. Install the government\'s Emergency Ready App to get alerts and safety guides in English and other languages.',
    steps: [
      'Install the Emergency Ready App from your app store — it is the foreign-language version of the government safety app.',
      'In settings, choose your language and the region you live in.',
      'Alerts come in English, Chinese, Vietnamese, Thai and Japanese; guides cover earthquakes, typhoons, heat waves, fires and more.',
      'The app also shows {{대피소|shelters}} near you and what to do in each situation.',
      'Regular civil defense drills ({{민방위 훈련|civil defense drill}}) can include sirens. An alert will say if it is a drill.',
    ],
    facts: [['5 languages', 'for alerts'], ['Shelters', 'on the map'], ['Drills', 'are announced']],
    itemsTitle: 'Words you will see in alerts',
    items: [
      ['긴급재난문자', 'Emergency disaster text'],
      ['지진', 'Earthquake'],
      ['호우 / 태풍', 'Heavy rain / typhoon'],
      ['폭염', 'Heat wave'],
      ['대피', 'Evacuate'],
      ['미세먼지', 'Fine dust (air pollution)'],
    ],
    tips: [
      T('Emergency texts make a very loud sound, even in silent mode. Most are about weather, missing people or local fires.'),
      T('On high fine-dust days, many people wear a KF94 mask outdoors.'),
    ],
    tipsNote: 'From the Ministry of the Interior and Safety and Korea Immigration Service notices.',
    phrases: [
      { ko: '대피소가 어디예요?', en: 'Where is the shelter?' },
      { ko: '이거 훈련이에요?', en: 'Is this a drill?' },
    ],
    sources: [MOIS],
  },
  {
    slug: 'help-hotlines', category: 'emergency', featured: false, sort: 69,
    title: 'Help lines for violence, abuse and family problems',
    summary: 'Danuri (1577-1366) answers 24 hours in 13 languages for migrants and families. In danger right now, call 112.',
    steps: [
      'In danger now: call 112 (police). Text 112 works too if you cannot speak.',
      'Danuri Helpline 1577-1366: 24 hours, 13 languages including English, Chinese, Vietnamese, Tagalog, Russian, Nepali.',
      'It helps with domestic violence, sexual violence, family and stay problems, and can connect you to shelters, police, hospitals and legal help.',
      'Women\'s emergency line 1366: 24 hours, mainly Korean.',
      'What you say is kept confidential.',
    ],
    facts: [['1577-1366', '13 languages'], ['24 h', 'every day'], ['112', 'immediate danger']],
    tips: [
      T('You do not need to be married to a Korean or have a particular visa to call Danuri.'),
      T('Shelters accept people with their children.'),
    ],
    tipsNote: 'From the Ministry of Gender Equality and Family.',
    phrases: [
      { ko: '도와주세요.', en: 'Please help me.' },
      { ko: '영어로 상담할 수 있어요?', en: 'Can I talk in English?' },
    ],
    sources: [DANURI],
  },
  {
    slug: 'lost-items', category: 'emergency', featured: false, sort: 70,
    title: 'Lost something? Phone, wallet or bag',
    summary: 'Korea returns a lot of lost items. Check LOST112, the subway lost and found, or your taxi receipt — and block your cards right away.',
    steps: [
      'Search LOST112 (lost112.go.kr): police and many transport companies upload found items.',
      'Left it on the subway? Note the time, line and car number, then ask station staff or the line\'s lost and found center.',
      'In a taxi: your card receipt or app history shows the taxi; call the taxi company or the app.',
      'Lost a card: block it in your bank app straight away.',
      'Lost a phone: call your carrier to suspend the line; use Find My Device / Find My.',
    ],
    facts: [['LOST112', 'police list'], ['Car no.', 'helps on subway'], ['Block', 'cards first']],
    tips: [
      T('Cafés and shops usually keep lost items behind the counter — go back and ask before anything else.'),
      T('Lost your residence card or passport? See "Lost residence card" — report it within 14 days.'),
    ],
    tipsNote: 'From the Korean National Police Agency and transit operators.',
    phrases: [
      { ko: '지갑을 잃어버렸어요.', en: 'I lost my wallet.' },
      { ko: '분실물 센터가 어디예요?', en: 'Where is the lost and found?' },
    ],
    sources: [LOST112],
  },
]
