-- Batch 3: 각 레벨 10개씩 추가 (항목 21-30)

-- Seed (21-30)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Starter', '좋아하는 계절', 'My Favorite Season', 'nature', true),
('Starter', '내 신발', 'My Shoes', 'daily', true),
('Starter', '아빠가 하는 일', 'What My Dad Does', 'family', true),
('Starter', '엄마가 만든 음식', 'Food My Mom Makes', 'food', true),
('Starter', '내 교실', 'My Classroom', 'school', true),
('Starter', '공원에서 노는 것', 'Playing at the Park', 'hobby', true),
('Starter', '좋아하는 아이스크림', 'My Favorite Ice Cream', 'food', true),
('Starter', '형제자매 소개', 'Introducing My Siblings', 'family', true),
('Starter', '잠자기 전에 하는 일', 'What I Do Before Bed', 'daily', true),
('Starter', '내가 잘하는 것', 'Something I Am Good At', 'hobby', true)
ON CONFLICT DO NOTHING;

-- Sprout (21-30)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Beginner', '한국 영화 추천', 'Recommending a Korean Movie', 'culture', true),
('Beginner', '길을 잃었던 경험', 'A Time I Got Lost', 'travel', true),
('Beginner', '좋아하는 운동', 'My Favorite Sport', 'health', true),
('Beginner', '한국에서 놀라운 점', 'Surprising Things About Korea', 'culture', true),
('Beginner', '요리 실패 경험', 'A Cooking Failure', 'food', true),
('Beginner', '노래방 경험', 'My Noraebang Experience', 'kpop', true),
('Beginner', '한국 친구 사귀기', 'Making Korean Friends', 'friends', true),
('Beginner', '택배 문화', 'Delivery Culture in Korea', 'daily', true),
('Beginner', '좋아하는 앱', 'My Favorite App', 'tech', true),
('Beginner', '다이어트 경험', 'My Diet Experience', 'health', true)
ON CONFLICT DO NOTHING;

-- Tree (21-30)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Intermediate', '한국의 직장 문화', 'Korean Workplace Culture', 'work', true),
('Intermediate', '동물 실험에 대한 찬반', 'Pros and Cons of Animal Testing', 'society', true),
('Intermediate', '한국의 주거 문제', 'Housing Problems in Korea', 'society', true),
('Intermediate', '게임이 청소년에게 미치는 영향', 'Impact of Gaming on Youth', 'tech', true),
('Intermediate', '한국의 미용 산업', 'Korean Beauty Industry', 'culture', true),
('Intermediate', '자원봉사의 가치', 'The Value of Volunteering', 'society', true),
('Intermediate', '전통 시장 vs 대형 마트', 'Traditional Markets vs Supermarkets', 'daily', true),
('Intermediate', '한국의 군대 문화', 'Korean Military Culture', 'culture', true),
('Intermediate', '스트레스 관리 방법', 'How to Manage Stress', 'health', true),
('Intermediate', '한국의 교통 문제', 'Transportation Issues in Korea', 'society', true)
ON CONFLICT DO NOTHING;

-- Forest (21-30)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Advanced', '국민연금 제도의 지속 가능성', 'Sustainability of the National Pension', 'society', true),
('Advanced', '표현의 자유와 혐오 발언의 경계', 'Freedom of Speech vs Hate Speech', 'society', true),
('Advanced', '한국 사회의 학벌주의', 'Academic Elitism in Korean Society', 'school', true),
('Advanced', '원격 의료의 도입과 과제', 'Telemedicine Adoption and Challenges', 'health', true),
('Advanced', '핵에너지의 미래', 'The Future of Nuclear Energy', 'society', true),
('Advanced', '소비 자본주의와 미니멀리즘', 'Consumer Capitalism and Minimalism', 'culture', true),
('Advanced', '난민 수용에 대한 한국 사회의 인식', 'Korean Attitudes Toward Refugees', 'society', true),
('Advanced', '블록체인 기술의 사회적 활용', 'Social Applications of Blockchain', 'tech', true),
('Advanced', '젠트리피케이션과 도시 재생', 'Gentrification and Urban Renewal', 'society', true),
('Advanced', '스포츠 외교의 역할', 'The Role of Sports Diplomacy', 'culture', true)
ON CONFLICT DO NOTHING;
