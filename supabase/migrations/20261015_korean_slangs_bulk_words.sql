-- auto-apply
-- ═════════════════════════════════════════════════════════════════════
-- Korean Slangs — large WORD-ONLY bulk (2026-10-15)
-- ═════════════════════════════════════════════════════════════════════
-- Per request: add a LOT of slang WORDS to the DB only (no chat / learning
-- elements). ~130 real, widely-used Korean slang / abbreviations / internet
-- terms — accurate one-line meanings, warn flags on vulgar-origin ones,
-- chat left NULL (the UI hides the conversation box when chat is empty).
--
-- Idempotent: each row inserts only WHEN NOT EXISTS a row with the same `ko`.
-- sort_order starts at 200 to sit after earlier batches. No-op if table absent.
-- ═════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.korean_slangs') is null then
    raise notice 'korean_slangs does not exist — skipping';
    return;
  end if;

  insert into korean_slangs (ko, en, desc_text, tag, warn, warn_text, difficulty, sort_order)
  select v.ko, v.en, v.desc_text, v.tag, v.warn, v.warn_text, v.difficulty, v.sort_order
  from (values
    -- ── 초성체 (consonant abbreviations) ──
    ('ㅇㅇ','yeah','"응응". 긍정/맞다는 뜻의 초성 답변','초성체',false,null,'Beginner',200),
    ('ㄴㄴ','nope','"노노(no no)". 아니라는 뜻의 초성 답변','초성체',false,null,'Beginner',201),
    ('ㅇㅋ','okay','"오케이"의 초성','초성체',false,null,'Beginner',202),
    ('ㄱㄱ','let''s go','"고고(go go)". 하자/가자는 뜻','초성체',false,null,'Beginner',203),
    ('ㄱㅅ','thanks','"감사"의 초성','초성체',false,null,'Beginner',204),
    ('ㅈㅅ','sorry','"죄송"의 초성','초성체',false,null,'Beginner',205),
    ('ㅅㄱ','take care / good job','"수고"의 초성','초성체',false,null,'Beginner',206),
    ('ㅎㅇ','hi','"하이"의 초성','초성체',false,null,'Beginner',207),
    ('ㅂㅇ','bye','"바이"의 초성','초성체',false,null,'Beginner',208),
    ('ㅊㅋ','congrats','"축하"의 초성','초성체',false,null,'Beginner',209),
    ('ㅇㅈ','agreed / facts','"인정". 맞다고 동의하는 말','초성체',false,null,'Beginner',210),
    ('ㄹㅇ','for real','"리얼(real)". 진짜라는 뜻','초성체',false,null,'Beginner',211),
    ('ㅇㄱㄹㅇ','this is real','"이거 레알". 진짜 공감된다는 강조','초성체',false,null,'Intermediate',212),
    ('ㅁㅊ','crazy','"미쳤다". 놀람/감탄. 비속어로도 쓰임','초성체',true,'상황 따라 욕이 될 수 있음','Beginner',213),
    ('ㄷㄷ','whoa / scary','"덜덜". 무섭거나 대단해서 떨린다는 반응','초성체',false,null,'Beginner',214),
    ('ㄱㅊ','it''s fine','"괜찮(아)"의 초성','초성체',false,null,'Beginner',215),
    ('ㅇㄷ','where','"어디"의 초성','초성체',false,null,'Beginner',216),
    ('ㅁㄹ','dunno','"몰라"의 초성','초성체',false,null,'Beginner',217),
    ('ㅊㄷ','cringe/cool','"쩐다". 대단하거나 어이없을 때','초성체',false,null,'Intermediate',218),
    -- ── 감탄 / 반응 (reactions) ──
    ('헐','omg','놀라거나 어이없을 때 내는 감탄사','감탄/반응',false,null,'Beginner',219),
    ('대박','awesome / wow','아주 놀랍거나 멋질 때. 긍정·부정 모두','감탄/반응',false,null,'Beginner',220),
    ('쩔다','sick / awesome','매우 대단하다. "쩐다"로도 씀','감탄/반응',false,null,'Beginner',221),
    ('지리다','mind-blowing','너무 대단해서 압도될 때. 다소 거친 표현','감탄/반응',true,'원래 생리현상 표현 — 친구끼리만','Intermediate',222),
    ('개꿀','super sweet / great deal','아주 좋다/이득이다. "개"는 강조','감탄/반응',false,null,'Beginner',223),
    ('개이득','big win','전혀 손해 없이 큰 이득','감탄/반응',false,null,'Beginner',224),
    ('빵터지다','burst out laughing','갑자기 크게 웃음이 터지는 것','감탄/반응',false,null,'Beginner',225),
    ('웃프다','funny but sad','"웃기다 + 슬프다". 웃기면서도 서글픈 상황','감탄/반응',false,null,'Intermediate',226),
    ('소름','goosebumps','놀랍거나 신기해서 소름이 돋을 때','감탄/반응',false,null,'Beginner',227),
    ('가즈아','let''s goooo','"가자"를 길게. 기대·응원의 외침(주로 투자)','감탄/반응',false,null,'Intermediate',228),
    ('짱','the best','최고다. 이름 뒤에 붙여 "~짱"으로도','감탄/반응',false,null,'Beginner',229),
    ('짱나','annoying','"짜증 나"의 줄임','감탄/반응',false,null,'Beginner',230),
    ('실화냐','is this real?','믿기지 않을 때 "실화입니까?"','감탄/반응',false,null,'Intermediate',231),
    ('레전드','legend','전설급으로 대단하거나 어이없는 것. "레게노"로도','감탄/반응',false,null,'Beginner',232),
    -- ── 인터넷 / 밈 (internet & memes) ──
    ('짤','meme pic','인터넷에서 쓰는 이미지. "짤방"의 줄임','인터넷/밈',false,null,'Beginner',233),
    ('움짤','gif','움직이는 짤(GIF)','인터넷/밈',false,null,'Beginner',234),
    ('어그로','aggro / troll bait','관심 끌려고 일부러 자극하는 행동. 영어 aggravation','인터넷/밈',false,null,'Intermediate',235),
    ('낚시','clickbait','거짓 제목·미끼로 속이는 것','인터넷/밈',false,null,'Intermediate',236),
    ('먹튀','eat and run','돈·이득만 챙기고 사라지는 것. "먹고 튀다"','인터넷/밈',false,null,'Intermediate',237),
    ('핑프','lazy asker','검색 안 하고 질문만 하는 사람. "핑거 프린세스"','인터넷/밈',true,'상대 비하 뉘앙스','Advanced',238),
    ('관종','attention seeker','"관심 종자". 관심받고 싶어 과하게 행동하는 사람','인터넷/밈',true,'비하 표현','Intermediate',239),
    ('팩폭','harsh truth','"팩트 폭력". 사실로 아프게 찌르는 말','인터넷/밈',false,null,'Intermediate',240),
    ('사이다','cathartic','속이 뻥 뚫리게 시원한 전개·발언','인터넷/밈',false,null,'Intermediate',241),
    ('고구마','frustrating','답답하게 꽉 막힌 상황. 사이다의 반대','인터넷/밈',false,null,'Intermediate',242),
    ('국룰','the standard rule','"국민 룰". 다들 당연하게 따르는 기본 규칙','인터넷/밈',false,null,'Intermediate',243),
    ('만렙','max level','"만(滿) 레벨". 그 분야 최고 수준','인터넷/밈',false,null,'Intermediate',244),
    ('현생','real life','"현실 생활". 게임·온라인 밖의 바쁜 일상','인터넷/밈',false,null,'Intermediate',245),
    ('부캐','alter ego','"부(副) 캐릭터". 본래 모습과 다른 또 다른 정체성','인터넷/밈',false,null,'Intermediate',246),
    ('본캐','main self','"본(本) 캐릭터". 원래의 자신','인터넷/밈',false,null,'Intermediate',247),
    ('짤줍','saving a meme','마음에 드는 짤을 저장하는 것','인터넷/밈',false,null,'Intermediate',248),
    ('혐주의','gross warning','"혐오 주의". 역겨운 내용이 있으니 조심하라는 경고','인터넷/밈',false,null,'Intermediate',249),
    ('스불재','self-made disaster','"스스로 불러온 재앙". 자업자득','인터넷/밈',false,null,'Advanced',250),
    ('억까','unfair hate','"억지로 까다". 근거 없이 깎아내리는 것','인터넷/밈',true,'비하 표현','Advanced',251),
    ('쉴드','defending someone','"shield". 누군가를 편들어 변호하는 것','인터넷/밈',false,null,'Intermediate',252),
    ('선넘네','crossing the line','"선 넘다". 도를 지나친 말·행동','인터넷/밈',false,null,'Intermediate',253),
    ('돌직구','blunt talk','돌려 말하지 않고 직설적으로 말하는 것','인터넷/밈',false,null,'Intermediate',254),
    ('발연기','bad acting','"발로 하는 연기". 어색하고 못하는 연기','인터넷/밈',false,null,'Intermediate',255),
    ('월급루팡','salary thief','일 안 하고 월급만 챙기는 직원','직장',true,'비하 뉘앙스','Advanced',256),
    ('복붙','copy-paste','"복사 + 붙여넣기"','직장',false,null,'Beginner',257),
    -- ── 야민정음 (letter-swap memes) ──
    ('띵작','masterpiece','"명작"을 비슷한 모양 글자로. 걸작','야민정음',false,null,'Intermediate',258),
    ('띵곡','great song','"명곡"의 야민정음','야민정음',false,null,'Intermediate',259),
    ('커엽','cute','"귀엽"을 비슷한 모양으로. 귀엽다','야민정음',false,null,'Intermediate',260),
    ('댕댕이','doggo','"멍멍이"를 닮은 글자로. 강아지','야민정음',false,null,'Beginner',261),
    ('뀨','squeak (cute)','귀여움을 표현하는 소리','야민정음',false,null,'Beginner',262),
    ('머박','daebak','"대박"의 변형','야민정음',false,null,'Intermediate',263),
    -- ── 연애 / 관계 ──
    ('품절녀','taken (woman)','매력 있지만 이미 결혼·연애 중인 여자','연애',false,null,'Intermediate',264),
    ('모솔','never-dated','"모태 솔로". 태어나서 연애를 한 번도 안 해본 사람','연애',false,null,'Intermediate',265),
    ('금사빠','falls in love fast','"금방 사랑에 빠지는 사람"','연애',false,null,'Intermediate',266),
    ('어장관리','keeping options','여러 이성에게 애매하게 관심을 주며 관리하는 것','연애',true,'부정적 표현','Advanced',267),
    ('남사친','guy friend','"남자 사람 친구". 연애 아닌 남자 친구','연애',false,null,'Intermediate',268),
    ('여사친','girl friend (platonic)','"여자 사람 친구"','연애',false,null,'Intermediate',269),
    ('ㅅㄹ','flutter','"설레"의 초성','연애',false,null,'Beginner',270),
    ('좋못사','beyond love','"좋다 못해 사랑". 너무 좋다는 강조','연애',false,null,'Advanced',271),
    -- ── 음식 ──
    ('단짠','sweet & salty','"단맛 짠맛". 달고 짠 조합. "단짠단짠"','음식',false,null,'Beginner',272),
    ('겉바속촉','crispy-soft','"겉은 바삭, 속은 촉촉"','음식',false,null,'Intermediate',273),
    ('맛집','good eatery','맛있기로 소문난 가게','음식',false,null,'Beginner',274),
    ('JMT','super tasty','"존맛탱"의 로마자. 아주 맛있음','음식',true,'비속어에서 유래','Beginner',275),
    ('혼밥러','solo diner','혼자 밥 먹는 사람','음식',false,null,'Beginner',276),
    ('먹방러','mukbang watcher','먹방을 즐겨 보거나 찍는 사람','음식',false,null,'Beginner',277),
    ('맵찔이','weak to spicy','매운 걸 잘 못 먹는 사람','음식',false,null,'Intermediate',278),
    ('배달음식','delivery food','집으로 시켜 먹는 음식(배달)','음식',false,null,'Beginner',279),
    -- ── 소비 / 쇼핑 ──
    ('득템','got a great item','좋은 물건을 손에 넣음. "아이템 득"','소비문화',false,null,'Beginner',280),
    ('꿀템','great find','가성비 좋은 훌륭한 물건','소비문화',false,null,'Beginner',281),
    ('인생템','must-have item','인생 최고로 만족한 물건','소비문화',false,null,'Intermediate',282),
    ('지름신','shopping urge','충동구매를 부추기는 "신". "지름신 강림"','소비문화',false,null,'Intermediate',283),
    ('탕진잼','joy of splurging','돈을 펑펑 쓰는 재미','소비문화',false,null,'Intermediate',284),
    ('텅장','empty account','"텅 빈 통장". 돈을 다 써버린 상태','소비문화',false,null,'Intermediate',285),
    ('플렉스하다','to flex','돈·물건을 과시하며 쓰다','소비문화',false,null,'Beginner',286),
    ('가심비','emotional value','가격 대비 "심(心)리적 만족". 비싸도 행복하면 OK','소비문화',false,null,'Advanced',287),
    ('오픈런','open run','매장 열자마자 달려가 사는 것','소비문화',false,null,'Intermediate',288),
    -- ── 외모 / 패션 ──
    ('얼짱','pretty face','얼굴이 잘생기거나 예쁜 사람','패션/외모',false,null,'Beginner',289),
    ('몸짱','fit body','몸매가 좋은 사람','패션/외모',false,null,'Beginner',290),
    ('비담','visual','"비주얼 담당". 그룹에서 제일 잘생긴 사람','패션/외모',false,null,'Intermediate',291),
    ('셀카','selfie','"셀프 카메라". 스스로 찍는 사진','패션/외모',false,null,'Beginner',292),
    ('인생샷','best photo ever','인생에서 가장 잘 나온 사진','패션/외모',false,null,'Intermediate',293),
    ('얼죽아','iced coffee always','"얼어 죽어도 아이스 아메리카노"','패션/외모',false,null,'Advanced',294),
    ('꾸꾸','all dressed up','잔뜩 꾸민 상태(꾸안꾸의 반대 느낌)','패션/외모',false,null,'Intermediate',295),
    -- ── 공부 / 직장 / 사회 ──
    ('취준생','job seeker','"취업 준비생"','사회',false,null,'Intermediate',296),
    ('공시생','civil-exam student','"공무원 시험 준비생"','사회',false,null,'Intermediate',297),
    ('열공','study hard','"열심히 공부"','공부/시험',false,null,'Beginner',298),
    ('열일','work hard','"열심히 일(함)"','직장',false,null,'Beginner',299),
    ('불금','TGIF','"불타는 금요일". 신나는 금요일 밤','직장',false,null,'Beginner',300),
    ('월요병','Monday blues','월요일마다 힘든 증상','직장',false,null,'Beginner',301),
    ('칼퇴','leave on time','"칼같이 퇴근". 정시 퇴근','직장',false,null,'Intermediate',302),
    ('열정페이','passion pay','열정을 핑계로 적게 주는 부당한 보수','사회',true,'부정적 사회 현상','Advanced',303),
    ('갑질','abuse of power','우월한 지위로 부당하게 대하는 것','사회',true,'부정적 표현','Advanced',304),
    ('꼰대','out-of-touch elder','자기 생각을 강요하는 나이 많은 사람','사회',true,'비하 표현','Intermediate',305),
    ('워커홀릭','workaholic','일 중독자','직장',false,null,'Intermediate',306),
    -- ── MZ / 라이프스타일 ──
    ('찐','genuine / real','진짜. "찐친(진짜 친구)"처럼 앞에 붙임','MZ세대',false,null,'Beginner',307),
    ('찐친','best friend','진짜 친한 친구','MZ세대',false,null,'Beginner',308),
    ('억텐','forced energy','"억지 텐션". 억지로 끌어올린 들뜸','MZ세대',false,null,'Intermediate',309),
    ('찐텐','genuine hype','"진짜 텐션". 진심으로 신난 상태','MZ세대',false,null,'Intermediate',310),
    ('갑통알','gotta get a job','"갑자기 통장을 보니 알바를 해야겠다"','MZ세대',false,null,'Advanced',311),
    ('할많하않','so much to say','"할 말은 많지만 하지 않겠다"','MZ세대',false,null,'Advanced',312),
    ('이생망','my life''s over','"이번 생은 망했다". 자조적 농담','MZ세대',false,null,'Advanced',313),
    ('복세편살','live easy','"복잡한 세상 편하게 살자"','MZ세대',false,null,'Advanced',314),
    ('내돈내산','bought with my money','"내 돈 주고 내가 산". 광고 아닌 솔직 후기','MZ세대',false,null,'Advanced',315),
    ('갓물주','building owner god','"God + 건물주". 부러운 건물주','MZ세대',false,null,'Intermediate',316),
    ('존예','super pretty','아주 예쁘다','MZ세대',true,'비속어(존)에서 유래','Intermediate',317),
    ('존잘','super handsome','아주 잘생겼다','MZ세대',true,'비속어(존)에서 유래','Intermediate',318),
    ('핵인싸','super social','아주 인기 많고 사교적인 사람','MZ세대',false,null,'Intermediate',319),
    ('만반잘부','nice to meet you','"만나서 반가워 잘 부탁해"','MZ세대',false,null,'Advanced',320),
    ('방방봐','let''s video call','"방에서 방으로 봐(영상통화)" — 상황별로 의미 달라짐','MZ세대',false,null,'Advanced',321),
    ('돈쭐','reward with sales','착한 가게를 일부러 많이 팔아줘 혼내준다는 뜻. "돈+혼쭐"','MZ세대',false,null,'Advanced',322),
    ('킹받다','infuriating','너무 열받는다는 걸 "킹(king)"으로 강조','MZ세대',false,null,'Intermediate',323),
    ('어쩔','whatever','"어쩌라고"의 줄임. 받아치는 말','MZ세대',true,'비꼬는 장난말','Intermediate',324),
    ('노잼시기','a boring phase','뭘 해도 재미없는 시기','MZ세대',false,null,'Intermediate',325),
    ('현웃','actual LOL','"현실 웃음". 실제로 소리 내 웃음','MZ세대',false,null,'Intermediate',326),
    ('무물','ask me anything','"무엇이든 물어보세요"의 줄임','MZ세대',false,null,'Intermediate',327),
    ('삽소','insert song','"삽입곡". 영상·드라마에 들어간 노래','MZ세대',false,null,'Intermediate',328),
    ('짬타이거','freeloading cat','군부대 등에서 짬밥 먹는 길고양이','MZ세대',false,null,'Advanced',329),
    ('갈비','increasingly unlikable','"갈수록 비호감"','MZ세대',true,'비하 표현','Advanced',330)
  ) as v(ko, en, desc_text, tag, warn, warn_text, difficulty, sort_order)
  where not exists (select 1 from korean_slangs k where k.ko = v.ko);
end
$$;

notify pgrst, 'reload schema';
