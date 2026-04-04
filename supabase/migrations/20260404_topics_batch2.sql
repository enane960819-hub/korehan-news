-- Batch 2: 각 레벨 10개씩 추가 (총 40개)

-- Seed (11-20)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Starter', '좋아하는 노래', 'My Favorite Song', 'kpop', true),
('Starter', '우리 집 소개', 'Introducing My Home', 'daily', true),
('Starter', '좋아하는 장난감', 'My Favorite Toy', 'hobby', true),
('Starter', '오늘 먹은 점심', 'What I Had for Lunch', 'food', true),
('Starter', '좋아하는 만화', 'My Favorite Cartoon', 'culture', true),
('Starter', '내 가방 안에 있는 것', 'What Is in My Bag', 'daily', true),
('Starter', '좋아하는 선생님', 'My Favorite Teacher', 'school', true),
('Starter', '비 오는 날', 'A Rainy Day', 'nature', true),
('Starter', '내 생일', 'My Birthday', 'friends', true),
('Starter', '좋아하는 간식', 'My Favorite Snack', 'food', true)
ON CONFLICT DO NOTHING;

-- Sprout (11-20)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Beginner', '주말에 한 일', 'What I Did Last Weekend', 'daily', true),
('Beginner', '좋아하는 한국 노래', 'My Favorite Korean Song', 'kpop', true),
('Beginner', '편의점에서 자주 사는 것', 'What I Buy at the Convenience Store', 'food', true),
('Beginner', '한국어 공부 방법', 'How I Study Korean', 'school', true),
('Beginner', '카카오톡 사용하기', 'Using KakaoTalk', 'tech', true),
('Beginner', '좋아하는 유튜브 채널', 'My Favorite YouTube Channel', 'culture', true),
('Beginner', '아르바이트 경험', 'My Part-Time Job Experience', 'work', true),
('Beginner', '한국 카페 문화', 'Korean Cafe Culture', 'culture', true),
('Beginner', '감기에 걸렸을 때', 'When I Caught a Cold', 'health', true),
('Beginner', '이사한 경험', 'Moving to a New Place', 'daily', true)
ON CONFLICT DO NOTHING;

-- Tree (11-20)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Intermediate', 'K-pop이 세계에 미친 영향', 'The Global Impact of K-pop', 'kpop', true),
('Intermediate', '1인 가구 증가와 사회 변화', 'Rise of Single-Person Households', 'society', true),
('Intermediate', '한국의 배달 문화', 'Korean Delivery Culture', 'culture', true),
('Intermediate', '운동 선수의 정신 건강', 'Mental Health of Athletes', 'health', true),
('Intermediate', '독서의 중요성과 독서 습관', 'The Importance of Reading Habits', 'school', true),
('Intermediate', '한국의 길거리 음식', 'Korean Street Food', 'food', true),
('Intermediate', '직장 내 세대 갈등', 'Generational Conflict at Work', 'work', true),
('Intermediate', '반려동물 문화의 변화', 'Changing Pet Culture in Korea', 'society', true),
('Intermediate', '한국의 대학 입시 제도', 'Korean University Entrance Exams', 'school', true),
('Intermediate', '소셜 미디어와 정신 건강', 'Social Media and Mental Health', 'health', true)
ON CONFLICT DO NOTHING;

-- Forest (11-20)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Advanced', '플랫폼 경제와 노동자 권리', 'Platform Economy and Workers Rights', 'work', true),
('Advanced', '가짜 뉴스와 민주주의의 위기', 'Fake News and the Crisis of Democracy', 'society', true),
('Advanced', '한국의 군복무 제도 개혁 논의', 'Reforming Koreas Military Service System', 'society', true),
('Advanced', '재생 에너지 전환의 경제적 과제', 'Economic Challenges of Renewable Energy', 'society', true),
('Advanced', '한류의 지속 가능성', 'The Sustainability of Hallyu', 'culture', true),
('Advanced', '빅데이터 시대의 프라이버시', 'Privacy in the Big Data Era', 'tech', true),
('Advanced', '고령화 사회의 복지 정책', 'Welfare Policies in an Aging Society', 'society', true),
('Advanced', '예술과 기술의 융합', 'The Convergence of Art and Technology', 'culture', true),
('Advanced', '다문화 가정의 사회 통합', 'Social Integration of Multicultural Families', 'society', true),
('Advanced', '자율주행차의 법적 책임 문제', 'Legal Liability of Autonomous Vehicles', 'tech', true)
ON CONFLICT DO NOTHING;
