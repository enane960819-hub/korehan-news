// Life in Korea guides — source of truth for supabase/migrations/*_life_guides_seed.sql.
// Run: node --experimental-strip-types scripts/life-guides/build.ts
// Inline Korean terms in steps: {{한국어|English}} — they become tappable
// chips and the guide's word list (romanization added by build.ts).
// Facts were checked on the date in CHECKED against the sources listed per
// guide; rules change, so every guide shows the date and its sources.
export const CHECKED = '2026-10-28'

const HIKOREA = { name: 'HiKorea (Korea Immigration Service)', url: 'https://www.hikorea.go.kr' }
const IMM1345 = { name: 'Immigration Contact Center 1345', url: 'https://www.immigration.go.kr' }
const NHIS = { name: 'National Health Insurance Service', url: 'https://www.nhis.or.kr/english/main.do' }
const MOEL = { name: 'Ministry of Employment and Labor', url: 'https://www.moel.go.kr/english/main.jsp' }
const IROS = { name: 'Internet Registry Office (property records)', url: 'https://www.iros.go.kr' }
const SIK = { name: 'Study in Korea (NIIED)', url: 'https://www.studyinkorea.go.kr' }
const VK = { name: 'VisitKorea 1330 Travel Helpline', url: 'https://english.visitkorea.or.kr' }

export const GUIDES = [
  {
    slug: 'first-30-days', category: 'start', featured: true, sort: 1,
    title: 'Your first 30 days in Korea: checklist',
    summary: 'Do these in order: book your residence card, get a phone, open a bank account, then sort out insurance, your address and transport.',
    steps: [
      'Week 1: book a visit on HiKorea for your {{외국인등록|alien registration}}. You must register within 90 days of arrival, and slots fill up — book early.',
      'Week 1: get a prepaid SIM with your passport so you have a Korean number. Switch to a monthly plan once you have your card.',
      'Week 2: sign or confirm your housing contract — you need an address on paper for registration.',
      'After registration: open a {{통장|bank account}} with your residence card and passport.',
      'Check your {{건강보험|health insurance}} status: students are covered from arrival, most other visas after 6 months.',
      'Buy a T-money {{교통카드|transit card}} at any convenience store and save the emergency numbers (112, 119, 1345).'
    ],
    phrases: [
      { ko: '외국인 등록하러 왔어요.', en: "I'm here to register as a foreign resident." },
      { ko: '선불 유심 있어요?', en: 'Do you have a prepaid SIM?' },
      { ko: '통장을 만들고 싶어요.', en: "I'd like to open a bank account." }
    ],
    sources: [HIKOREA, IMM1345]
  },
  {
    slug: 'arc-residence-card', category: 'visa', featured: true, sort: 2,
    title: 'How to get your residence card (ARC)',
    summary: 'Apply within 90 days of arrival. Book a visit on HiKorea, bring your passport, one photo, the fee and proof of address. The card takes about 3–4 weeks.',
    steps: [
      'Go to HiKorea → Visit Reservation and choose {{외국인등록|alien registration}} at the immigration office for your area.',
      'Fill in the {{통합신청서|integrated application form}} (available at the office or on HiKorea).',
      'Bring one passport-style {{사진|photo}} (3.5 × 4.5 cm, taken in the last 6 months) and your passport.',
      'Bring proof of address, usually your {{임대차계약서|lease contract}} or a dorm certificate. Students also bring a {{재학증명서|certificate of enrollment}}.',
      'Pay the {{수수료|fee}} — usually 30,000 won — at the office kiosk.',
      'Your card arrives in about 3–4 weeks. Keep the receipt; it shows your registration is in progress.'
    ],
    phrases: [
      { ko: '외국인 등록하러 왔어요.', en: "I'm here for alien registration." },
      { ko: '예약했어요.', en: 'I have a reservation.' },
      { ko: '외국인등록증은 언제 받을 수 있어요?', en: 'When can I get my residence card?' }
    ],
    sources: [HIKOREA, IMM1345]
  },
  {
    slug: 'visa-extension', category: 'visa', featured: false, sort: 3,
    title: 'Extending your stay (visa extension)',
    summary: 'Apply before your permitted stay ends — online on HiKorea or at your immigration office. Late applications mean fines.',
    steps: [
      'Check the {{체류기간|period of stay}} on the back of your residence card or on HiKorea.',
      'Apply for an {{연장|extension}} before it ends. Most people can apply from about 4 months before the expiry date.',
      'Many visas can apply online: HiKorea → e-Application → {{체류기간 연장|extension of stay}}.',
      'Prepare documents for your visa type (students: certificate of enrollment and transcript; workers: employment contract). Unpaid health insurance can delay approval.',
      'Pay the fee online or at the office (often around 60,000 won — check HiKorea for your visa).',
      'After approval, your new date is recorded; your card may get a sticker or a new date online.'
    ],
    phrases: [
      { ko: '체류기간 연장하려고 왔어요.', en: "I'm here to extend my stay." },
      { ko: '어떤 서류가 필요해요?', en: 'Which documents do I need?' },
      { ko: '결과는 언제 나와요?', en: 'When will I get the result?' }
    ],
    sources: [HIKOREA, IMM1345]
  },
  {
    slug: 'renting-wolse-jeonse', category: 'housing', featured: true, sort: 4,
    title: 'Wolse vs jeonse: how renting works',
    summary: 'Most foreigners rent with wolse: a deposit plus monthly rent. Jeonse is one large deposit and no rent — bigger money, bigger risk.',
    steps: [
      '{{월세|monthly rent}}: you pay a {{보증금|deposit}} (often 5–10 million won for a one-room) plus rent every month. The deposit comes back when you leave.',
      '{{전세|jeonse}}: you pay a very large deposit (often over half the home\'s value) and no monthly rent. If the owner can\'t pay it back, you can lose it.',
      'Small studios are called {{원룸|one-room}}; officetels are {{오피스텔|officetel}}. Short stays: {{고시원|goshiwon}} (tiny room, no deposit) or share houses.',
      'Ask what the {{관리비|maintenance fee}} covers — water, internet and cleaning are sometimes included, gas and electricity usually not.',
      'Real estate agents ({{부동산|real estate agency}}) charge a {{중개수수료|agent fee}} set by law as a percentage; ask for the amount before you sign.',
      'Before signing, read the lease checklist guide.'
    ],
    phrases: [
      { ko: '보증금은 얼마예요?', en: 'How much is the deposit?' },
      { ko: '관리비에 뭐가 포함돼요?', en: 'What does the maintenance fee include?' },
      { ko: '월세로 원룸 찾고 있어요.', en: "I'm looking for a one-room with monthly rent." }
    ],
    sources: [IROS]
  },
  {
    slug: 'lease-checklist', category: 'housing', featured: false, sort: 5,
    title: 'Before you sign a lease: 5 checks',
    summary: 'Check who owns the home and whether it has debts, then register your address and get a fixed date so your deposit is protected.',
    steps: [
      'Ask for the {{등기부등본|property registration record}} (or look it up on iros.go.kr). The owner on it must match the person signing.',
      'On the same record, look for a {{근저당|mortgage}}. A big loan plus your deposit can be more than the home is worth — that is the danger sign.',
      'Read every line of the {{계약서|contract}}: deposit, rent, dates, who fixes what. Write special terms in the {{특약|special terms}} section.',
      'After moving in, report your new address (for foreigners: {{체류지 변경신고|change of address report}}) within 15 days.',
      'Get a {{확정일자|fixed date stamp}} on your contract at the community center or online. With the address report, it puts you in line to get your deposit back.'
    ],
    phrases: [
      { ko: '등기부등본 볼 수 있어요?', en: 'Can I see the property registration record?' },
      { ko: '특약에 넣어 주세요.', en: 'Please put it in the special terms.' },
      { ko: '확정일자 받으러 왔어요.', en: "I'm here to get a fixed date stamp." }
    ],
    sources: [IROS, HIKOREA]
  },
  {
    slug: 'part-time-work-students', category: 'work', featured: true, sort: 6,
    title: 'Part-time work on a student visa',
    summary: 'You need permission before your first shift. Weekly hours depend on your program and Korean level, and some jobs are not allowed.',
    steps: [
      'Get {{시간제취업허가|part-time work permission}} before you start. Apply with your school\'s international office, then on HiKorea or at immigration.',
      'Weekly limits depend on your degree program and TOPIK level: for example, undergraduates who meet the Korean requirement can work more weekday hours than those who don\'t. Your international office has the current table.',
      'Language-program (D-4) students can usually apply only after about 6 months in Korea.',
      'Some work is not allowed, such as construction, manufacturing, delivery, entertainment venues and private tutoring.',
      'Sign a written {{근로계약서|employment contract}} — the permission application needs it.',
      'Working without permission can cost you your visa, and your employer can be fined.'
    ],
    phrases: [
      { ko: '아르바이트 하려고 하는데 허가가 필요해요?', en: 'I want a part-time job — do I need permission?' },
      { ko: '근로계약서 써 주실 수 있어요?', en: 'Could you write an employment contract?' },
      { ko: '일주일에 몇 시간 일할 수 있어요?', en: 'How many hours a week can I work?' }
    ],
    sources: [HIKOREA, SIK, IMM1345]
  },
  {
    slug: 'minimum-wage-pay', category: 'work', featured: false, sort: 7,
    title: 'Minimum wage, contracts and getting paid',
    summary: 'The 2026 minimum wage is 10,320 won an hour, for foreign workers too. Get a written contract and a payslip.',
    steps: [
      'The {{최저임금|minimum wage}} in 2026 is 10,320 won per hour. It applies to part-time and foreign workers.',
      'If you work 15 hours or more a week, you also earn {{주휴수당|weekly holiday pay}} — roughly one extra paid day a week.',
      'Your employer must give you a written {{근로계약서|employment contract}} with your pay, hours and duties.',
      'You should get a {{임금명세서|payslip}} every payday showing how your pay was calculated.',
      'Unpaid wages? Call the Ministry of Employment and Labor at 1350 (foreign languages available).'
    ],
    phrases: [
      { ko: '시급이 얼마예요?', en: "What's the hourly wage?" },
      { ko: '월급이 아직 안 들어왔어요.', en: "My pay hasn't come in yet." },
      { ko: '임금명세서 받을 수 있어요?', en: 'Can I get a payslip?' }
    ],
    sources: [MOEL]
  },
  {
    slug: 'health-insurance', category: 'health', featured: false, sort: 8,
    title: 'National health insurance for foreigners',
    summary: 'Registered foreigners are enrolled automatically — students from arrival, most others after 6 months. Pay the monthly bill: unpaid premiums can affect your visa.',
    steps: [
      'With a residence card, you are enrolled in {{국민건강보험|National Health Insurance}} automatically: students from arrival, most other visa types after 6 months in Korea.',
      'If you work for a company, you join through your job ({{직장가입자|workplace member}}) and the premium is taken from your pay.',
      'Otherwise you are a {{지역가입자|regional member}} and get a monthly bill. Students pay a reduced rate.',
      'Pay by bank transfer or automatic debit. Unpaid {{보험료|premiums}} can count against you when you extend your visa.',
      'With insurance you pay only part of the bill at clinics, hospitals and pharmacies.',
      'Questions in English: call 1577-1000 and choose the foreign-language option.'
    ],
    phrases: [
      { ko: '건강보험 있어요.', en: 'I have health insurance.' },
      { ko: '보험료를 자동이체로 내고 싶어요.', en: "I'd like to pay the premium by automatic debit." },
      { ko: '외국인등록증 여기 있어요.', en: "Here's my residence card." }
    ],
    sources: [NHIS]
  },
  {
    slug: 'hospital-pharmacy', category: 'health', featured: false, sort: 9,
    title: 'Seeing a doctor and buying medicine',
    summary: 'For common illness, go to a local clinic, then a pharmacy with the prescription. Big hospitals are for referrals and emergencies.',
    steps: [
      'Small clinics ({{의원|clinic}}) by specialty are the first stop: internal medicine ({{내과|internal medicine}}), ENT, dermatology. No appointment needed at most.',
      'At reception show your residence card — insurance is applied automatically.',
      'The doctor gives you a {{처방전|prescription}}; take it to any {{약국|pharmacy}} nearby.',
      'Big university hospitals usually need a {{진료의뢰서|referral letter}} from a clinic for insurance rates.',
      'At night or in an emergency, go to the {{응급실|emergency room}} or call 119.'
    ],
    phrases: [
      { ko: '열이 나고 목이 아파요.', en: 'I have a fever and a sore throat.' },
      { ko: '영어 하시는 의사 선생님 계세요?', en: 'Is there a doctor who speaks English?' },
      { ko: '이 약은 하루에 몇 번 먹어요?', en: 'How many times a day do I take this medicine?' }
    ],
    sources: [NHIS, VK]
  },
  {
    slug: 'bank-and-phone', category: 'money', featured: false, sort: 10,
    title: 'Opening a bank account and getting a phone plan',
    summary: 'Both are easiest with your residence card. Before it arrives, use a prepaid SIM; new accounts may start with a daily transfer limit.',
    steps: [
      'Bring your residence card, passport and a Korean phone number to the bank. Students often bring a certificate of enrollment; workers a contract.',
      'New accounts for foreigners often start as a {{한도제한계좌|limited account}} with a low daily transfer limit; it can be raised later with proof of work or study.',
      'Ask for a {{체크카드|debit card}} and set up mobile banking at the branch.',
      'Phones: a {{선불|prepaid}} SIM needs only your passport. A {{후불|postpaid}} monthly plan usually needs your residence card.',
      'Budget carriers ({{알뜰폰|budget phone plan}}) use the big networks and cost much less.'
    ],
    phrases: [
      { ko: '통장 개설하러 왔어요.', en: "I'm here to open an account." },
      { ko: '체크카드도 만들 수 있어요?', en: 'Can I get a debit card too?' },
      { ko: '데이터 무제한 요금제 있어요?', en: 'Do you have an unlimited data plan?' }
    ],
    sources: [HIKOREA]
  },
  {
    slug: 'emergency-numbers', category: 'emergency', featured: true, sort: 11,
    title: 'Emergency and help numbers',
    summary: '112 police, 119 fire and ambulance. 1345 for immigration questions, 1330 for 24-hour interpretation.',
    steps: [
      '{{경찰|police}}: 112. Text messages also work.',
      'Fire and {{구급차|ambulance}}: 119. Interpretation is available — say your language.',
      'Immigration questions in many languages: 1345 ({{출입국|immigration}} contact center).',
      'Travel helpline and interpretation, 24 hours: 1330.',
      'Unpaid wages and work problems: 1350. Health insurance: 1577-1000.',
      'Save your address in Korean on your phone — it is the first thing a dispatcher asks for ({{주소|address}}).'
    ],
    phrases: [
      { ko: '도와주세요!', en: 'Help!' },
      { ko: '구급차 불러 주세요.', en: 'Please call an ambulance.' },
      { ko: '여기 주소는 …예요.', en: 'The address here is …' }
    ],
    sources: [IMM1345, VK]
  },
  {
    slug: 'trash-recycling', category: 'daily', featured: false, sort: 12,
    title: 'Trash and recycling',
    summary: 'General trash goes in paid city bags, food waste goes separately, and recycling is sorted by type. Big items need a sticker.',
    steps: [
      'General trash goes in {{종량제 봉투|official trash bags}}, sold at convenience stores and marts. Buy the bags for your district.',
      '{{음식물 쓰레기|food waste}} is separate — special bags, bins or a card-operated machine, depending on your building.',
      '{{분리수거|recycling}}: plastic, cans, glass, paper and vinyl in separate bins. Rinse containers and remove labels.',
      'Furniture and appliances are {{대형폐기물|large waste}}: report online or at the community center and attach the sticker.',
      'Check your building\'s collection days and place — your landlord or neighbors will know.'
    ],
    phrases: [
      { ko: '종량제 봉투 20리터짜리 주세요.', en: 'A 20-liter trash bag, please.' },
      { ko: '음식물 쓰레기는 어디에 버려요?', en: 'Where do I throw away food waste?' },
      { ko: '분리수거는 무슨 요일이에요?', en: 'What day is recycling?' }
    ],
    sources: [VK]
  },
  {
    slug: 'transit-card', category: 'daily', featured: false, sort: 13,
    title: 'Getting around: transit cards',
    summary: 'Buy a T-money card at a convenience store, top it up with cash, and tap on and off for discounted transfers.',
    steps: [
      'Buy a {{교통카드|transit card}} (T-money) at a convenience store or subway station.',
      'Top it up ({{충전|recharge}}) with cash at the store counter or a station machine.',
      'Tap when you get on and when you get off the bus — tapping off gives you the {{환승|transfer}} discount on your next ride.',
      'Many Korean debit cards can work as transit cards too.',
      'Seoul also sells a monthly unlimited pass; check prices at a station.'
    ],
    phrases: [
      { ko: '교통카드 충전해 주세요.', en: 'Please top up my transit card.' },
      { ko: '만 원 충전해 주세요.', en: 'Please put 10,000 won on it.' },
      { ko: '이 버스 강남역 가요?', en: 'Does this bus go to Gangnam Station?' }
    ],
    sources: [VK]
  },
  {
    slug: 'study-in-korea', category: 'school', featured: false, sort: 14,
    title: 'Studying in Korea: language school or degree',
    summary: 'Start at a university language institute (D-4 visa) or apply for a degree (D-2). Degree programs usually ask for a TOPIK level.',
    steps: [
      'University {{어학당|language institute}} programs run in terms of about 10 weeks and start several times a year (D-4 visa).',
      'Degree students ({{학부|undergraduate}} or {{대학원|graduate school}}) need a D-2 visa and an admission letter.',
      'Most degree programs taught in Korean ask for a {{토픽|TOPIK}} level — often level 3 or higher for undergraduates. Check each school.',
      'Scholarships: the Global Korea Scholarship (GKS) and many school {{장학금|scholarships}}.',
      'Your school\'s international office helps with visas, part-time work permission and insurance.'
    ],
    phrases: [
      { ko: '어학당에 등록하고 싶어요.', en: "I'd like to enroll in the language institute." },
      { ko: '장학금 받을 수 있어요?', en: 'Can I get a scholarship?' },
      { ko: '토픽 몇 급이 필요해요?', en: 'Which TOPIK level do I need?' }
    ],
    sources: [SIK]
  }
]
