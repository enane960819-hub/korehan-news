-- ============================================================
-- KoreHan News — vocabulary_bank 단어 데이터 (220개)
-- Supabase SQL Editor에서 전체 선택 후 실행
-- ============================================================

-- 테이블 없으면 생성
CREATE TABLE IF NOT EXISTS public.vocabulary_bank (
  id            bigserial PRIMARY KEY,
  word_ko       text NOT NULL,
  word_rom      text,
  word_en       text NOT NULL,
  level         text DEFAULT 'Intermediate',
  interest_tag  text DEFAULT 'daily',
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- 기존 데이터 중복 방지 (word_ko + interest_tag 기준)
ALTER TABLE public.vocabulary_bank
  DROP CONSTRAINT IF EXISTS vocabulary_bank_word_tag_unique;
ALTER TABLE public.vocabulary_bank
  ADD CONSTRAINT vocabulary_bank_word_tag_unique UNIQUE (word_ko, interest_tag);

-- ============================================================
-- daily (필수 뉴스/생활 어휘) — 30개
-- ============================================================
INSERT INTO public.vocabulary_bank (word_ko, word_rom, word_en, level, interest_tag) VALUES
('대통령',   'daetongnyeong',  'president',                  'Intermediate', 'daily'),
('정부',     'jeongbu',        'government',                 'Beginner',     'daily'),
('국민',     'gungmin',        'citizens / the people',      'Beginner',     'daily'),
('선거',     'seongeo',        'election',                   'Intermediate', 'daily'),
('경제',     'gyeongje',       'economy',                    'Beginner',     'daily'),
('사회',     'sahoe',          'society',                    'Beginner',     'daily'),
('교육',     'gyoyuk',         'education',                  'Beginner',     'daily'),
('의료',     'uiryo',          'healthcare / medical',       'Intermediate', 'daily'),
('환경',     'hwangyeong',     'environment',                'Intermediate', 'daily'),
('문화',     'munhwa',         'culture',                    'Beginner',     'daily'),
('사건',     'sageon',         'incident / case',            'Intermediate', 'daily'),
('발표',     'balpyo',         'announcement',               'Beginner',     'daily'),
('확인',     'hwagin',         'confirmation / check',       'Beginner',     'daily'),
('결정',     'gyeoljeong',     'decision',                   'Intermediate', 'daily'),
('계획',     'gyehoek',        'plan',                       'Beginner',     'daily'),
('문제',     'munje',          'problem / issue',            'Beginner',     'daily'),
('변화',     'byeonhwa',       'change',                     'Beginner',     'daily'),
('지원',     'jiwon',          'support / application',      'Intermediate', 'daily'),
('피해',     'pihae',          'damage / harm',              'Intermediate', 'daily'),
('사망',     'samang',         'death',                      'Intermediate', 'daily'),
('부상',     'busang',         'injury',                     'Intermediate', 'daily'),
('조사',     'josa',           'investigation',              'Intermediate', 'daily'),
('협력',     'hyeomnyeok',     'cooperation',                'Advanced',     'daily'),
('협의',     'hyeobuui',       'consultation / negotiation', 'Advanced',     'daily'),
('공식',     'gongsik',        'official / formal',          'Intermediate', 'daily'),
('전문가',   'jeonmunga',      'expert',                     'Intermediate', 'daily'),
('시민',     'simin',          'citizen',                    'Beginner',     'daily'),
('지역',     'jiyeok',         'region / area',              'Beginner',     'daily'),
('현재',     'hyeonjae',       'currently / at present',     'Beginner',     'daily'),
('향후',     'hyanghu',        'going forward / future',     'Intermediate', 'daily')
ON CONFLICT (word_ko, interest_tag) DO NOTHING;

-- ============================================================
-- kpop — 22개
-- ============================================================
INSERT INTO public.vocabulary_bank (word_ko, word_rom, word_en, level, interest_tag) VALUES
('아이돌',   'aidol',          'idol',                       'Beginner',     'kpop'),
('데뷔',     'debwi',          'debut',                      'Beginner',     'kpop'),
('컴백',     'keombaek',       'comeback (new release)',      'Beginner',     'kpop'),
('팬덤',     'paendeom',       'fandom',                     'Beginner',     'kpop'),
('앨범',     'aelbeum',        'album',                      'Beginner',     'kpop'),
('타이틀곡', 'taiteulgok',     'title track',                'Intermediate', 'kpop'),
('뮤직비디오','myujikbideo',   'music video',                'Beginner',     'kpop'),
('콘서트',   'konseuteu',      'concert',                    'Beginner',     'kpop'),
('팬미팅',   'paenmiting',     'fan meeting',                'Beginner',     'kpop'),
('안무',     'anmu',           'choreography',               'Intermediate', 'kpop'),
('보컬',     'bokeol',         'vocal',                      'Beginner',     'kpop'),
('래퍼',     'raepeo',         'rapper',                     'Beginner',     'kpop'),
('작사',     'jaksa',          'lyric writing',              'Intermediate', 'kpop'),
('작곡',     'jakgok',         'composing music',            'Intermediate', 'kpop'),
('음원',     'eumwon',         'digital track / streaming',  'Intermediate', 'kpop'),
('음악 방송','eumak bangsong', 'music show / broadcast',     'Intermediate', 'kpop'),
('1위',      'il-wi',          'No. 1 / first place',        'Beginner',     'kpop'),
('수상',     'susang',         'award win',                  'Intermediate', 'kpop'),
('월드투어', 'woldeu-tuyeo',   'world tour',                 'Intermediate', 'kpop'),
('솔로',     'sollo',          'solo (activity)',            'Beginner',     'kpop'),
('그룹',     'geurup',         'group',                      'Beginner',     'kpop'),
('연습생',   'yeonseupssaeng', 'trainee',                    'Intermediate', 'kpop')
ON CONFLICT (word_ko, interest_tag) DO NOTHING;

-- ============================================================
-- travel — 22개
-- ============================================================
INSERT INTO public.vocabulary_bank (word_ko, word_rom, word_en, level, interest_tag) VALUES
('여행',     'yeohaeng',       'travel',                     'Beginner',     'travel'),
('공항',     'gonghang',       'airport',                    'Beginner',     'travel'),
('비행기',   'bihaenggi',      'airplane',                   'Beginner',     'travel'),
('숙소',     'sukso',          'accommodation',              'Beginner',     'travel'),
('호텔',     'hotel',          'hotel',                      'Beginner',     'travel'),
('관광지',   'gwangwangji',    'tourist attraction',         'Beginner',     'travel'),
('지하철',   'jihacheol',      'subway',                     'Beginner',     'travel'),
('버스',     'beoseu',         'bus',                        'Beginner',     'travel'),
('택시',     'taeksi',         'taxi',                       'Beginner',     'travel'),
('예약',     'yeyak',          'reservation / booking',      'Beginner',     'travel'),
('입국',     'ipguk',          'entry / arrival (country)',  'Intermediate', 'travel'),
('출국',     'chulguk',        'departure (country)',        'Intermediate', 'travel'),
('여권',     'yeogwon',        'passport',                   'Beginner',     'travel'),
('비자',     'bija',           'visa',                       'Intermediate', 'travel'),
('환전',     'hwanjeon',       'currency exchange',          'Intermediate', 'travel'),
('관광',     'gwangwang',      'sightseeing / tourism',      'Beginner',     'travel'),
('기념품',   'ginyeompum',     'souvenir',                   'Beginner',     'travel'),
('길',       'gil',            'street / road / way',        'Beginner',     'travel'),
('지도',     'jido',           'map',                        'Beginner',     'travel'),
('명소',     'myeongso',       'famous spot / highlight',    'Intermediate', 'travel'),
('당일치기', 'dangil-chigi',   'day trip',                   'Intermediate', 'travel'),
('현지',     'hyeonji',        'local / on-site',            'Intermediate', 'travel')
ON CONFLICT (word_ko, interest_tag) DO NOTHING;

-- ============================================================
-- food — 22개
-- ============================================================
INSERT INTO public.vocabulary_bank (word_ko, word_rom, word_en, level, interest_tag) VALUES
('음식',     'eumsik',         'food',                       'Beginner',     'food'),
('식당',     'sikdang',        'restaurant',                 'Beginner',     'food'),
('맛집',     'matjip',         'popular / great restaurant', 'Beginner',     'food'),
('메뉴',     'menyu',          'menu',                       'Beginner',     'food'),
('주문',     'jumun',          'order',                      'Beginner',     'food'),
('배달',     'baedal',         'delivery',                   'Beginner',     'food'),
('요리',     'yori',           'cooking / dish',             'Beginner',     'food'),
('재료',     'jaeryo',         'ingredient',                 'Intermediate', 'food'),
('레시피',   'resipi',         'recipe',                     'Beginner',     'food'),
('맛',       'mat',            'taste / flavor',             'Beginner',     'food'),
('달다',     'dalda',          'sweet',                      'Beginner',     'food'),
('맵다',     'maepda',         'spicy',                      'Beginner',     'food'),
('짜다',     'jjada',          'salty',                      'Beginner',     'food'),
('고소하다', 'gosoha-da',      'nutty / savory',             'Intermediate', 'food'),
('한식',     'hansik',         'Korean food',                'Beginner',     'food'),
('분식',     'bunsik',         'Korean snack food',          'Intermediate', 'food'),
('편의점',   'pyeonuijeom',    'convenience store',          'Beginner',     'food'),
('카페',     'kape',           'café',                       'Beginner',     'food'),
('디저트',   'dijeoteu',       'dessert',                    'Beginner',     'food'),
('야식',     'yasik',          'late-night snack',           'Intermediate', 'food'),
('포장',     'pojang',         'takeout / packaging',        'Intermediate', 'food'),
('후기',     'hugi',           'review / feedback',          'Intermediate', 'food')
ON CONFLICT (word_ko, interest_tag) DO NOTHING;

-- ============================================================
-- business — 22개
-- ============================================================
INSERT INTO public.vocabulary_bank (word_ko, word_rom, word_en, level, interest_tag) VALUES
('회사',     'hoesa',          'company',                    'Beginner',     'business'),
('직원',     'jigwon',         'employee',                   'Beginner',     'business'),
('사장',     'sajang',         'CEO / boss',                 'Beginner',     'business'),
('회의',     'hoeui',          'meeting',                    'Beginner',     'business'),
('보고서',   'bogoseo',        'report',                     'Intermediate', 'business'),
('계약',     'gyeyak',         'contract',                   'Intermediate', 'business'),
('거래',     'georae',         'transaction / deal',         'Intermediate', 'business'),
('매출',     'maechul',        'sales / revenue',            'Intermediate', 'business'),
('이익',     'iik',            'profit',                     'Intermediate', 'business'),
('손실',     'sonsil',         'loss',                       'Intermediate', 'business'),
('투자',     'tuja',           'investment',                 'Intermediate', 'business'),
('창업',     'changop',        'startup / founding',         'Advanced',     'business'),
('스타트업', 'seutateop',      'startup',                    'Intermediate', 'business'),
('마케팅',   'maketing',       'marketing',                  'Intermediate', 'business'),
('브랜드',   'beuraendeu',     'brand',                      'Beginner',     'business'),
('전략',     'jeollyak',       'strategy',                   'Advanced',     'business'),
('목표',     'mokpyo',         'goal / target',              'Beginner',     'business'),
('성과',     'seonggwa',       'results / performance',      'Intermediate', 'business'),
('취업',     'chwieop',        'getting a job',              'Intermediate', 'business'),
('이력서',   'iryeokseo',      'resume / CV',                'Intermediate', 'business'),
('면접',     'myeonjjeop',     'job interview',              'Intermediate', 'business'),
('급여',     'geupyeo',        'salary / pay',               'Intermediate', 'business')
ON CONFLICT (word_ko, interest_tag) DO NOTHING;

-- ============================================================
-- news — 22개
-- ============================================================
INSERT INTO public.vocabulary_bank (word_ko, word_rom, word_en, level, interest_tag) VALUES
('뉴스',     'nyuseu',         'news',                       'Beginner',     'news'),
('기사',     'gisa',           'article / news story',       'Beginner',     'news'),
('기자',     'gija',           'journalist / reporter',      'Beginner',     'news'),
('취재',     'chwi-jae',       'news coverage / reporting',  'Intermediate', 'news'),
('보도',     'bodo',           'news report',                'Intermediate', 'news'),
('언론',     'eonlon',         'media / press',              'Advanced',     'news'),
('방송',     'bangsong',       'broadcast',                  'Intermediate', 'news'),
('인터뷰',   'inteobyeu',      'interview',                  'Beginner',     'news'),
('논란',     'nollan',         'controversy',                'Advanced',     'news'),
('의혹',     'uihok',          'suspicion / allegation',     'Advanced',     'news'),
('사실',     'sasil',          'fact',                       'Beginner',     'news'),
('가짜뉴스', 'gajja nyuseu',   'fake news',                  'Intermediate', 'news'),
('속보',     'sokbo',          'breaking news',              'Intermediate', 'news'),
('단독',     'dandok',         'exclusive (news)',           'Advanced',     'news'),
('외교',     'oegiyo',         'diplomacy',                  'Advanced',     'news'),
('정치',     'jeongchi',       'politics',                   'Intermediate', 'news'),
('법원',     'beobwon',        'court',                      'Intermediate', 'news'),
('재판',     'jaeban',         'trial',                      'Advanced',     'news'),
('판결',     'pangyeol',       'ruling / verdict',           'Advanced',     'news'),
('여론',     'yeoron',         'public opinion',             'Advanced',     'news'),
('시위',     'siwi',           'protest / demonstration',    'Intermediate', 'news'),
('규제',     'gyuje',          'regulation',                 'Advanced',     'news')
ON CONFLICT (word_ko, interest_tag) DO NOTHING;

-- ============================================================
-- sports — 22개
-- ============================================================
INSERT INTO public.vocabulary_bank (word_ko, word_rom, word_en, level, interest_tag) VALUES
('운동',     'undong',         'exercise / sport',           'Beginner',     'sports'),
('경기',     'gyeonggi',       'game / match',               'Beginner',     'sports'),
('선수',     'seonsu',         'athlete / player',           'Beginner',     'sports'),
('감독',     'gamdok',         'coach / director',           'Intermediate', 'sports'),
('팀',       'tim',            'team',                       'Beginner',     'sports'),
('우승',     'useung',         'championship / winning',     'Intermediate', 'sports'),
('준우승',   'junuseung',      'runner-up',                  'Intermediate', 'sports'),
('득점',     'deukjeom',       'scoring a point',            'Intermediate', 'sports'),
('골',       'gol',            'goal',                       'Beginner',     'sports'),
('승리',     'seungni',        'victory',                    'Intermediate', 'sports'),
('패배',     'paeae',          'defeat',                     'Intermediate', 'sports'),
('훈련',     'hullyeon',       'training',                   'Intermediate', 'sports'),
('부상',     'busang',         'injury',                     'Intermediate', 'sports'),
('올림픽',   'ollimpik',       'Olympics',                   'Beginner',     'sports'),
('월드컵',   'woldeukkeop',    'World Cup',                  'Beginner',     'sports'),
('결승',     'gyeolseung',     'final (match)',              'Intermediate', 'sports'),
('준결승',   'jungyeolseung',  'semi-final',                 'Intermediate', 'sports'),
('응원',     'eung-won',       'cheering / support',         'Beginner',     'sports'),
('시즌',     'sijeun',         'season',                     'Beginner',     'sports'),
('이적',     'ijeok',          'transfer (player)',          'Advanced',     'sports'),
('야구',     'yagu',           'baseball',                   'Beginner',     'sports'),
('축구',     'chukgu',         'soccer / football',          'Beginner',     'sports')
ON CONFLICT (word_ko, interest_tag) DO NOTHING;

-- ============================================================
-- tech — 22개
-- ============================================================
INSERT INTO public.vocabulary_bank (word_ko, word_rom, word_en, level, interest_tag) VALUES
('기술',     'gisul',          'technology',                 'Beginner',     'tech'),
('인공지능', 'ingong jinung',  'artificial intelligence',    'Advanced',     'tech'),
('스마트폰', 'seumateupon',    'smartphone',                 'Beginner',     'tech'),
('앱',       'aep',            'app',                        'Beginner',     'tech'),
('소프트웨어','sopeuteuweeo',  'software',                   'Intermediate', 'tech'),
('하드웨어', 'hadeuweeo',      'hardware',                   'Intermediate', 'tech'),
('데이터',   'deiteo',         'data',                       'Beginner',     'tech'),
('플랫폼',   'peullaetpom',    'platform',                   'Intermediate', 'tech'),
('클라우드', 'keullaudu',      'cloud',                      'Intermediate', 'tech'),
('보안',     'boan',           'security',                   'Intermediate', 'tech'),
('해킹',     'haeking',        'hacking',                    'Intermediate', 'tech'),
('개발',     'gaebal',         'development',                'Intermediate', 'tech'),
('서비스',   'seobiseu',       'service',                    'Beginner',     'tech'),
('업데이트', 'eopteiteu',      'update',                     'Beginner',     'tech'),
('반도체',   'bandoche',       'semiconductor',              'Advanced',     'tech'),
('전기차',   'jeonggicha',     'electric vehicle',           'Intermediate', 'tech'),
('배터리',   'baetteori',      'battery',                    'Beginner',     'tech'),
('충전',     'chungjeon',      'charging',                   'Beginner',     'tech'),
('디지털',   'dijiteol',       'digital',                    'Beginner',     'tech'),
('온라인',   'onlain',         'online',                     'Beginner',     'tech'),
('스타트업', 'seutateop',      'startup',                    'Intermediate', 'tech'),
('로봇',     'robot',          'robot',                      'Beginner',     'tech')
ON CONFLICT (word_ko, interest_tag) DO NOTHING;

-- ============================================================
-- drama — 22개
-- ============================================================
INSERT INTO public.vocabulary_bank (word_ko, word_rom, word_en, level, interest_tag) VALUES
('드라마',   'deurama',        'drama / TV series',          'Beginner',     'drama'),
('배우',     'baeu',           'actor / actress',            'Beginner',     'drama'),
('주인공',   'juingong',       'main character',             'Beginner',     'drama'),
('역할',     'yeokal',         'role',                       'Intermediate', 'drama'),
('대본',     'daebon',         'script',                     'Intermediate', 'drama'),
('촬영',     'chwallyeong',    'filming / shooting',         'Intermediate', 'drama'),
('연기',     'yeongi',         'acting',                     'Intermediate', 'drama'),
('감동',     'gamdong',        'touching / moving',          'Beginner',     'drama'),
('로맨스',   'romanseeu',      'romance',                    'Beginner',     'drama'),
('결말',     'gyeolmal',       'ending',                     'Intermediate', 'drama'),
('시청률',   'sijeongnyul',    'viewership rating',          'Advanced',     'drama'),
('인기',     'ingi',           'popularity',                 'Beginner',     'drama'),
('화제',     'hwaje',          'buzz / hot topic',           'Intermediate', 'drama'),
('넷플릭스', 'netpeullingseu', 'Netflix',                    'Beginner',     'drama'),
('스트리밍', 'seuteuriminng',  'streaming',                  'Beginner',     'drama'),
('에피소드', 'episodeu',       'episode',                    'Beginner',     'drama'),
('복수',     'boksu',          'revenge',                    'Intermediate', 'drama'),
('재벌',     'jaebeol',        'chaebol / conglomerate heir','Advanced',     'drama'),
('비밀',     'bimil',          'secret',                     'Beginner',     'drama'),
('오해',     'ohae',           'misunderstanding',           'Intermediate', 'drama'),
('고백',     'gobaek',         'confession (feelings)',      'Intermediate', 'drama'),
('헤어지다', 'haeojida',       'to break up',                'Intermediate', 'drama')
ON CONFLICT (word_ko, interest_tag) DO NOTHING;

-- ============================================================
-- beauty — 22개
-- ============================================================
INSERT INTO public.vocabulary_bank (word_ko, word_rom, word_en, level, interest_tag) VALUES
('화장품',   'hwajangpum',     'cosmetics',                  'Beginner',     'beauty'),
('피부',     'pibu',           'skin',                       'Beginner',     'beauty'),
('스킨케어', 'seukinkeeo',     'skincare',                   'Beginner',     'beauty'),
('에센스',   'esenseu',        'essence (skincare)',         'Intermediate', 'beauty'),
('세럼',     'sereom',         'serum',                      'Intermediate', 'beauty'),
('선크림',   'seonkeurim',     'sunscreen',                  'Beginner',     'beauty'),
('보습',     'boseup',         'moisturizing',               'Intermediate', 'beauty'),
('트러블',   'teureebeol',     'skin trouble / breakout',    'Intermediate', 'beauty'),
('클렌징',   'keullenjing',    'cleansing',                  'Beginner',     'beauty'),
('메이크업', 'meikeukeop',     'makeup',                     'Beginner',     'beauty'),
('파운데이션','paundeiisyeon', 'foundation',                 'Intermediate', 'beauty'),
('립스틱',   'ripseutik',      'lipstick',                   'Beginner',     'beauty'),
('마스크팩', 'maseukupaek',    'sheet mask',                 'Beginner',     'beauty'),
('글로우',   'geullou',        'glow',                       'Beginner',     'beauty'),
('톤',       'ton',            'skin tone',                  'Beginner',     'beauty'),
('성분',     'seongbun',       'ingredient',                 'Intermediate', 'beauty'),
('자외선',   'jawaeison',      'UV rays',                    'Advanced',     'beauty'),
('촉촉하다', 'chokchokada',    'dewy / hydrated',            'Intermediate', 'beauty'),
('탄력',     'tallyeok',       'elasticity / firmness',      'Advanced',     'beauty'),
('미용',     'miyong',         'beauty treatment',           'Intermediate', 'beauty'),
('헤어',     'heeo',           'hair',                       'Beginner',     'beauty'),
('염색',     'yeomsaek',       'hair dyeing',                'Intermediate', 'beauty')
ON CONFLICT (word_ko, interest_tag) DO NOTHING;

-- 인덱스 (검색 속도 향상)
CREATE INDEX IF NOT EXISTS idx_vocab_tag ON public.vocabulary_bank (interest_tag);
CREATE INDEX IF NOT EXISTS idx_vocab_active ON public.vocabulary_bank (is_active);
