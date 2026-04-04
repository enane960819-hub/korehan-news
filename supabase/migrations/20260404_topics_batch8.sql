-- Batch 8: 각 레벨 10개씩 추가 (항목 71-80)

-- Seed (71-80)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Starter', '내 시계', 'My Watch', 'daily', true),
('Starter', '좋아하는 김밥', 'My Favorite Kimbap', 'food', true),
('Starter', '우리 집 부엌', 'Our Kitchen', 'daily', true),
('Starter', '좋아하는 색연필', 'My Favorite Colored Pencils', 'hobby', true),
('Starter', '내 인형', 'My Stuffed Animal', 'hobby', true),
('Starter', '추운 날', 'A Cold Day', 'nature', true),
('Starter', '좋아하는 우동', 'My Favorite Udon', 'food', true),
('Starter', '내 거울', 'My Mirror', 'daily', true),
('Starter', '사촌 형제', 'My Cousins', 'family', true),
('Starter', '방학에 하고 싶은 일', 'What I Want to Do on Vacation', 'daily', true)
ON CONFLICT DO NOTHING;

-- Sprout (71-80)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Beginner', '한국의 떡볶이 맛집', 'Best Tteokbokki Places', 'food', true),
('Beginner', '한국 친구에게 쓰는 편지', 'A Letter to My Korean Friend', 'friends', true),
('Beginner', '한국의 버스 타기', 'Riding Korean Buses', 'daily', true),
('Beginner', '좋아하는 한국 아이돌', 'My Favorite Korean Idol', 'kpop', true),
('Beginner', '한국의 김치 종류', 'Types of Korean Kimchi', 'food', true),
('Beginner', '한국에서 병원 가기', 'Going to the Hospital in Korea', 'health', true),
('Beginner', '사진 찍기 좋은 장소', 'Best Photo Spots', 'travel', true),
('Beginner', '한국의 빨리빨리 문화', 'Korean Ppalli Ppalli Culture', 'culture', true),
('Beginner', '좋아하는 커피 종류', 'My Favorite Type of Coffee', 'food', true),
('Beginner', '한국의 주말 활동', 'Weekend Activities in Korea', 'daily', true)
ON CONFLICT DO NOTHING;

-- Tree (71-80)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Intermediate', '한국의 사교육비 부담', 'Burden of Private Education Costs', 'school', true),
('Intermediate', '구독 경제의 성장', 'Growth of Subscription Economy', 'tech', true),
('Intermediate', '한국의 장애인 인식', 'Disability Awareness in Korea', 'society', true),
('Intermediate', '먹방 문화의 양면성', 'Two Sides of Mukbang Culture', 'culture', true),
('Intermediate', '한국의 공원 문화', 'Korean Park Culture', 'nature', true),
('Intermediate', '프리랜서의 장단점', 'Pros and Cons of Freelancing', 'work', true),
('Intermediate', '한국의 안전 문화', 'Safety Culture in Korea', 'society', true),
('Intermediate', '한국의 축제 소개', 'Introducing Korean Festivals', 'travel', true),
('Intermediate', '비건 식당의 증가', 'Rise of Vegan Restaurants', 'food', true),
('Intermediate', '한국의 노래방 문화', 'Korean Karaoke Culture', 'kpop', true)
ON CONFLICT DO NOTHING;

-- Forest (71-80)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Advanced', '한국의 검찰 개혁 논의', 'Prosecution Reform Debate in Korea', 'society', true),
('Advanced', '인간 복제의 윤리적 경계', 'Ethical Boundaries of Human Cloning', 'tech', true),
('Advanced', '한국 사회의 음주 관대 문화', 'Alcohol Tolerance in Korean Society', 'culture', true),
('Advanced', '지식 재산권과 오픈소스', 'Intellectual Property vs Open Source', 'tech', true),
('Advanced', '한국의 사회적 기업 생태계', 'Social Enterprise Ecosystem in Korea', 'work', true),
('Advanced', '도시 공동체의 해체와 재건', 'Dissolution and Rebuilding of Urban Communities', 'society', true),
('Advanced', '한국의 식량 자급률 문제', 'Food Self-Sufficiency in Korea', 'society', true),
('Advanced', '에너지 빈곤과 사회적 형평성', 'Energy Poverty and Social Equity', 'society', true),
('Advanced', '한국의 공영 방송 역할', 'Role of Public Broadcasting in Korea', 'culture', true),
('Advanced', '뇌과학과 형사 책임', 'Neuroscience and Criminal Responsibility', 'tech', true)
ON CONFLICT DO NOTHING;
