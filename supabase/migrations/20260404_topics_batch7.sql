-- Batch 7: 각 레벨 10개씩 추가 (항목 61-70)

-- Seed (61-70)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Starter', '내 물병', 'My Water Bottle', 'daily', true),
('Starter', '좋아하는 채소', 'My Favorite Vegetable', 'food', true),
('Starter', '우리 집 화장실', 'Our Bathroom', 'daily', true),
('Starter', '좋아하는 스티커', 'My Favorite Sticker', 'hobby', true),
('Starter', '내 자전거', 'My Bicycle', 'hobby', true),
('Starter', '오늘 본 것', 'Something I Saw Today', 'daily', true),
('Starter', '좋아하는 우유', 'My Favorite Milk', 'food', true),
('Starter', '내 베개', 'My Pillow', 'daily', true),
('Starter', '이웃 사람', 'My Neighbor', 'friends', true),
('Starter', '더운 날', 'A Hot Day', 'nature', true)
ON CONFLICT DO NOTHING;

-- Sprout (61-70)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Beginner', '한국의 찜질방 경험', 'Korean Jjimjilbang Experience', 'culture', true),
('Beginner', '좋아하는 BTS 노래', 'My Favorite BTS Song', 'kpop', true),
('Beginner', '한국의 공휴일', 'Korean Public Holidays', 'culture', true),
('Beginner', '혼자 여행한 경험', 'Traveling Alone', 'travel', true),
('Beginner', '한국의 치맥 문화', 'Korean Chimaek Culture', 'food', true),
('Beginner', '좋아하는 웹툰', 'My Favorite Webtoon', 'culture', true),
('Beginner', '한국에서 은행 가기', 'Going to the Bank in Korea', 'daily', true),
('Beginner', '한국의 고궁 방문', 'Visiting Korean Palaces', 'travel', true),
('Beginner', '좋아하는 한국 배우', 'My Favorite Korean Actor', 'culture', true),
('Beginner', '한국의 문구점', 'Korean Stationery Stores', 'hobby', true)
ON CONFLICT DO NOTHING;

-- Tree (61-70)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Intermediate', '한국의 제주도 관광 과잉', 'Overtourism in Jeju Island', 'travel', true),
('Intermediate', '청년 실업 문제', 'Youth Unemployment Problem', 'work', true),
('Intermediate', '한국의 급식 문화', 'Korean School Lunch Culture', 'food', true),
('Intermediate', '반려식물 키우기', 'Growing Houseplants', 'nature', true),
('Intermediate', '한국의 전세 제도', 'Korean Jeonse Rental System', 'society', true),
('Intermediate', '유행어와 세대 차이', 'Slang and Generational Differences', 'culture', true),
('Intermediate', '한국의 봉사 활동 문화', 'Volunteer Culture in Korea', 'society', true),
('Intermediate', '인공지능 비서의 일상 활용', 'Using AI Assistants in Daily Life', 'tech', true),
('Intermediate', '한국의 커플 문화', 'Korean Couple Culture', 'culture', true),
('Intermediate', '건강검진의 중요성', 'Importance of Health Checkups', 'health', true)
ON CONFLICT DO NOTHING;

-- Forest (61-70)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Advanced', '한국의 사법부 독립성', 'Independence of Korean Judiciary', 'society', true),
('Advanced', '탈성장 담론의 현실성', 'Feasibility of Degrowth Discourse', 'society', true),
('Advanced', '한국의 연예인 인권 문제', 'Celebrity Rights Issues in Korea', 'culture', true),
('Advanced', '가상현실과 인간 정체성', 'Virtual Reality and Human Identity', 'tech', true),
('Advanced', '한국의 청년 주거 정책', 'Youth Housing Policy in Korea', 'society', true),
('Advanced', '의료 민영화 논쟁', 'Healthcare Privatization Debate', 'health', true),
('Advanced', '한국의 통일 담론 변화', 'Changing Unification Discourse in Korea', 'society', true),
('Advanced', '소셜 미디어 알고리즘과 편향', 'Social Media Algorithms and Bias', 'tech', true),
('Advanced', '한국의 노동 조합 역할', 'Role of Labor Unions in Korea', 'work', true),
('Advanced', '문화재 반환 문제', 'Cultural Property Repatriation', 'culture', true)
ON CONFLICT DO NOTHING;
