-- Batch 4: 각 레벨 10개씩 추가 (항목 31-40)

-- Seed (31-40)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Starter', '내 이름', 'My Name', 'daily', true),
('Starter', '좋아하는 숫자', 'My Favorite Number', 'hobby', true),
('Starter', '내 필통', 'My Pencil Case', 'school', true),
('Starter', '좋아하는 놀이', 'My Favorite Game', 'hobby', true),
('Starter', '우리 동네', 'My Neighborhood', 'daily', true),
('Starter', '내 치아', 'My Teeth', 'health', true),
('Starter', '좋아하는 꽃', 'My Favorite Flower', 'nature', true),
('Starter', '내 모자', 'My Hat', 'daily', true),
('Starter', '토요일에 하는 일', 'What I Do on Saturday', 'daily', true),
('Starter', '우리 반 친구들', 'My Classmates', 'school', true)
ON CONFLICT DO NOTHING;

-- Sprout (31-40)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Beginner', '첫 해외여행', 'My First Trip Abroad', 'travel', true),
('Beginner', '한국의 사계절', 'Four Seasons in Korea', 'nature', true),
('Beginner', '좋아하는 한국 음식 베스트 3', 'My Top 3 Korean Foods', 'food', true),
('Beginner', '집에서 혼자 하는 취미', 'Hobbies I Do at Home Alone', 'hobby', true),
('Beginner', '한국어 실수 경험', 'Korean Language Mistakes I Made', 'school', true),
('Beginner', '지하철 타는 법', 'How to Ride the Subway', 'daily', true),
('Beginner', '한국 드라마 추천', 'Recommending a Korean Drama', 'culture', true),
('Beginner', '새해 목표', 'My New Year Goals', 'daily', true),
('Beginner', '한국의 편의점 음식', 'Korean Convenience Store Food', 'food', true),
('Beginner', '감사한 사람', 'A Person I Am Thankful For', 'friends', true)
ON CONFLICT DO NOTHING;

-- Tree (31-40)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Intermediate', '한국의 음주 문화', 'Korean Drinking Culture', 'culture', true),
('Intermediate', '인플루언서 마케팅의 문제점', 'Problems with Influencer Marketing', 'tech', true),
('Intermediate', '한국의 결혼 문화 변화', 'Changing Marriage Culture in Korea', 'society', true),
('Intermediate', '공공장소에서의 예절', 'Etiquette in Public Places', 'culture', true),
('Intermediate', '한국의 야근 문화', 'Korean Overtime Work Culture', 'work', true),
('Intermediate', '음악이 감정에 미치는 영향', 'How Music Affects Our Emotions', 'kpop', true),
('Intermediate', '한국의 교복 문화', 'Korean School Uniform Culture', 'school', true),
('Intermediate', '채식주의의 장단점', 'Pros and Cons of Vegetarianism', 'food', true),
('Intermediate', '한국의 아파트 문화', 'Korean Apartment Living Culture', 'society', true),
('Intermediate', '취미가 직업이 될 수 있을까', 'Can a Hobby Become a Career', 'work', true)
ON CONFLICT DO NOTHING;

-- Forest (31-40)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Advanced', '사형제도 존폐 논의', 'The Death Penalty Debate', 'society', true),
('Advanced', '우주 개발의 윤리적 쟁점', 'Ethical Issues in Space Exploration', 'tech', true),
('Advanced', '한국 언론의 공정성', 'Fairness of Korean Media', 'society', true),
('Advanced', '디지털 디톡스의 필요성', 'The Need for Digital Detox', 'health', true),
('Advanced', '공유 경제의 미래', 'The Future of the Sharing Economy', 'work', true),
('Advanced', '한국 영화 산업의 세계화', 'Globalization of Korean Cinema', 'culture', true),
('Advanced', '기본소득제 도입 논의', 'The Universal Basic Income Debate', 'society', true),
('Advanced', '의무 투표제의 찬반', 'Pros and Cons of Compulsory Voting', 'society', true),
('Advanced', '한국의 사교육 문제', 'Private Education Problems in Korea', 'school', true),
('Advanced', '탈원전 정책의 타당성', 'Validity of Nuclear Phase-Out Policy', 'society', true)
ON CONFLICT DO NOTHING;
