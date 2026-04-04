-- Batch 6: 각 레벨 10개씩 추가 (항목 51-60)

-- Seed (51-60)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Starter', '내 텔레비전', 'My Television', 'daily', true),
('Starter', '좋아하는 빵', 'My Favorite Bread', 'food', true),
('Starter', '내 침대', 'My Bed', 'daily', true),
('Starter', '비누로 손 씻기', 'Washing Hands with Soap', 'health', true),
('Starter', '좋아하는 그림', 'My Favorite Drawing', 'hobby', true),
('Starter', '내 운동화', 'My Sneakers', 'daily', true),
('Starter', '눈 오는 날', 'A Snowy Day', 'nature', true),
('Starter', '좋아하는 케이크', 'My Favorite Cake', 'food', true),
('Starter', '할머니 할아버지', 'My Grandparents', 'family', true),
('Starter', '학교 가는 길', 'The Way to School', 'school', true)
ON CONFLICT DO NOTHING;

-- Sprout (51-60)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Beginner', '한국의 목욕탕 문화', 'Korean Bathhouse Culture', 'culture', true),
('Beginner', '좋아하는 한국 예능', 'My Favorite Korean Variety Show', 'culture', true),
('Beginner', '택시 타기 경험', 'My Taxi Experience in Korea', 'travel', true),
('Beginner', '한국의 계절 행사', 'Seasonal Events in Korea', 'culture', true),
('Beginner', '온라인 수업 경험', 'My Online Class Experience', 'school', true),
('Beginner', '한국의 분리수거', 'Recycling in Korea', 'daily', true),
('Beginner', '좋아하는 한국 라면', 'My Favorite Korean Ramen', 'food', true),
('Beginner', '한국의 놀이공원', 'Korean Amusement Parks', 'travel', true),
('Beginner', '집들이 경험', 'Housewarming Party Experience', 'friends', true),
('Beginner', '한국의 선물 문화', 'Korean Gift-Giving Culture', 'culture', true)
ON CONFLICT DO NOTHING;

-- Tree (51-60)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Intermediate', '한국의 웹툰 산업', 'Korean Webtoon Industry', 'culture', true),
('Intermediate', '플라스틱 사용 줄이기', 'Reducing Plastic Use', 'nature', true),
('Intermediate', '한국의 군입대 문화', 'Korean Military Enlistment Culture', 'society', true),
('Intermediate', '워라밸의 중요성', 'Importance of Work-Life Balance', 'work', true),
('Intermediate', '한국의 떡 문화', 'Korean Rice Cake Culture', 'food', true),
('Intermediate', '디지털 노마드 생활', 'Digital Nomad Lifestyle', 'work', true),
('Intermediate', '한국의 등산 문화', 'Korean Hiking Culture', 'nature', true),
('Intermediate', '소확행이란 무엇인가', 'What Is Small But Certain Happiness', 'culture', true),
('Intermediate', '한국의 의료 시스템', 'Korean Healthcare System', 'health', true),
('Intermediate', '한국의 택배 산업', 'Korean Delivery Industry', 'society', true)
ON CONFLICT DO NOTHING;

-- Forest (51-60)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Advanced', '한국의 부동산 정책과 세대 갈등', 'Real Estate Policy and Generational Conflict', 'society', true),
('Advanced', '양심적 병역 거부의 법적 쟁점', 'Legal Issues of Conscientious Objection', 'society', true),
('Advanced', '한국 사회의 과로사 문제', 'Death from Overwork in Korean Society', 'work', true),
('Advanced', '유전자 편집 기술의 윤리', 'Ethics of Gene Editing Technology', 'tech', true),
('Advanced', '한국의 정치 양극화', 'Political Polarization in Korea', 'society', true),
('Advanced', '디지털 화폐와 중앙은행의 역할', 'Digital Currency and Central Banks', 'tech', true),
('Advanced', '한국의 이민 정책 방향', 'Direction of Korean Immigration Policy', 'society', true),
('Advanced', '예술 검열과 창작의 자유', 'Art Censorship and Creative Freedom', 'culture', true),
('Advanced', '한국의 수능 제도 개편 논의', 'Reforming the Korean CSAT System', 'school', true),
('Advanced', '기업의 사회적 책임', 'Corporate Social Responsibility', 'work', true)
ON CONFLICT DO NOTHING;
