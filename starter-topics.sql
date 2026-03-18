-- ============================================================
-- KoreHan News — Starter Level Writing Topics (60개)
-- Supabase SQL Editor에서 전체 선택 후 실행
-- ============================================================

-- 1. Check constraint에 'Starter' 추가
ALTER TABLE writing_topics DROP CONSTRAINT IF EXISTS writing_topics_level_check;
ALTER TABLE writing_topics ADD CONSTRAINT writing_topics_level_check
  CHECK (level IN ('Starter', 'Beginner', 'Intermediate', 'Advanced'));

-- 2. Starter 토픽 60개 삽입
INSERT INTO writing_topics (category, topic_ko, topic_en, level, active) VALUES

-- 자기소개 (12개)
('introduction', '내 이름',               'My Name',                          'Starter', true),
('introduction', '내 나이',               'My Age',                           'Starter', true),
('introduction', '내가 사는 곳',          'Where I Live',                     'Starter', true),
('introduction', '내 가족',               'My Family',                        'Starter', true),
('introduction', '내 직업',               'My Job',                           'Starter', true),
('introduction', '내 취미 하나',          'One Hobby of Mine',                'Starter', true),
('introduction', '내가 좋아하는 색깔',    'My Favorite Color',                'Starter', true),
('introduction', '내 친구',               'My Friend',                        'Starter', true),
('introduction', '나는 학생이에요?',      'Am I a Student?',                  'Starter', true),
('introduction', '내 전화번호',           'My Phone Number',                  'Starter', true),
('introduction', '내 생일',               'My Birthday',                      'Starter', true),
('introduction', '내가 한국어를 배우는 이유', 'Why I Learn Korean',           'Starter', true),

-- 일상 (14개)
('daily', '오늘 아침',                    'This Morning',                     'Starter', true),
('daily', '아침에 일어나는 시간',         'The Time I Wake Up',               'Starter', true),
('daily', '매일 하는 일',                 'What I Do Every Day',              'Starter', true),
('daily', '지금 몇 시예요?',              'What Time Is It Now?',             'Starter', true),
('daily', '오늘 날씨',                    "Today's Weather",                  'Starter', true),
('daily', '지금 어디에 있어요?',          'Where Are You Right Now?',         'Starter', true),
('daily', '잠자리에 드는 시간',           'My Bedtime',                       'Starter', true),
('daily', '주말에 뭐 해요?',              'What Do You Do on Weekends?',      'Starter', true),
('daily', '내 방 묘사',                   'Describing My Room',               'Starter', true),
('daily', '오늘 입은 옷',                 'What I Am Wearing Today',          'Starter', true),
('daily', '학교나 회사까지 가는 방법',    'How I Get to School or Work',      'Starter', true),
('daily', '집에서 좋아하는 공간',         'My Favorite Spot at Home',         'Starter', true),
('daily', '오늘 기분',                    "Today's Mood",                     'Starter', true),
('daily', '어제 한 일 한 가지',           'One Thing I Did Yesterday',        'Starter', true),

-- 음식 (12개)
('food', '내가 좋아하는 음식',            'My Favorite Food',                 'Starter', true),
('food', '오늘 점심',                     "Today's Lunch",                    'Starter', true),
('food', '아침밥 먹어요?',                'Do You Eat Breakfast?',            'Starter', true),
('food', '싫어하는 음식',                 'Food I Dislike',                   'Starter', true),
('food', '자주 가는 식당',               'A Restaurant I Often Go To',       'Starter', true),
('food', '좋아하는 음료',                 'My Favorite Drink',                'Starter', true),
('food', '한국 음식 중 먹어 본 것',       'Korean Food I Have Tried',         'Starter', true),
('food', '과일 이름 세 가지',             'Three Fruit Names',                'Starter', true),
('food', '달아요? 매워요?',               'Is It Sweet? Is It Spicy?',        'Starter', true),
('food', '냉장고에 있는 것',              "What's in My Fridge",              'Starter', true),
('food', '디저트를 좋아해요?',            'Do You Like Dessert?',             'Starter', true),
('food', '배고파요? 배불러요?',           'Are You Hungry or Full?',          'Starter', true),

-- 가족 (8개)
('family', '우리 가족 인원수',            'How Many People Are in My Family', 'Starter', true),
('family', '엄마에 대해',                 'About My Mom',                     'Starter', true),
('family', '아빠에 대해',                 'About My Dad',                     'Starter', true),
('family', '형제자매가 있어요?',          'Do You Have Siblings?',            'Starter', true),
('family', '반려동물이 있어요?',          'Do You Have a Pet?',               'Starter', true),
('family', '가족과 사는 곳',              'Where I Live with My Family',      'Starter', true),
('family', '가족과 함께 하는 것',         'What I Do with My Family',         'Starter', true),
('family', '할머니나 할아버지',           'My Grandma or Grandpa',            'Starter', true),

-- 취미 (8개)
('hobby', '내가 좋아하는 것 한 가지',     'One Thing I Like',                 'Starter', true),
('hobby', '음악을 좋아해요?',             'Do You Like Music?',               'Starter', true),
('hobby', '운동해요?',                    'Do You Exercise?',                 'Starter', true),
('hobby', '자주 보는 TV 프로그램',        'A TV Show I Often Watch',          'Starter', true),
('hobby', '좋아하는 계절',               'My Favorite Season',               'Starter', true),
('hobby', '책 읽는 것을 좋아해요?',       'Do You Like Reading Books?',       'Starter', true),
('hobby', '게임을 해요?',                 'Do You Play Games?',               'Starter', true),
('hobby', '사진 찍는 것을 좋아해요?',     'Do You Like Taking Photos?',       'Starter', true),

-- 한국어 학습 (6개)
('study', '오늘 배운 한국어 단어',        'Korean Words I Learned Today',     'Starter', true),
('study', '어려운 한국어 발음',           'A Difficult Korean Sound',         'Starter', true),
('study', '좋아하는 한국어 단어',         'My Favorite Korean Word',          'Starter', true),
('study', '한국어로 숫자 세기',           'Counting Numbers in Korean',       'Starter', true),
('study', '한국어 공부 방법',             'How I Study Korean',               'Starter', true),
('study', '한국에 대해 아는 것',          'Things I Know About Korea',        'Starter', true);

-- 확인
SELECT category, count(*) FROM writing_topics WHERE level = 'Starter' GROUP BY category ORDER BY category;
