-- Batch 9: 각 레벨 10개씩 추가 (항목 81-90)

-- Seed (81-90)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Starter', '내 칫솔', 'My Toothbrush', 'daily', true),
('Starter', '좋아하는 떡', 'My Favorite Rice Cake', 'food', true),
('Starter', '우리 집 거실', 'Our Living Room', 'daily', true),
('Starter', '좋아하는 블록 놀이', 'My Favorite Block Game', 'hobby', true),
('Starter', '내 지우개', 'My Eraser', 'school', true),
('Starter', '바람 부는 날', 'A Windy Day', 'nature', true),
('Starter', '좋아하는 떡볶이', 'My Favorite Tteokbokki', 'food', true),
('Starter', '내 창문', 'My Window', 'daily', true),
('Starter', '삼촌과 이모', 'My Uncle and Aunt', 'family', true),
('Starter', '크리스마스에 하고 싶은 일', 'What I Want to Do on Christmas', 'daily', true)
ON CONFLICT DO NOTHING;

-- Sprout (81-90)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Beginner', '한국의 전통 놀이', 'Korean Traditional Games', 'culture', true),
('Beginner', '좋아하는 한국 디저트', 'My Favorite Korean Dessert', 'food', true),
('Beginner', '한국에서 우체국 가기', 'Going to the Post Office in Korea', 'daily', true),
('Beginner', '한국의 응원 문화', 'Korean Cheering Culture', 'kpop', true),
('Beginner', '좋아하는 한국 배달 음식', 'My Favorite Korean Delivery Food', 'food', true),
('Beginner', '한국에서 미용실 가기', 'Going to a Hair Salon in Korea', 'daily', true),
('Beginner', '한국의 봄꽃 구경', 'Spring Flower Viewing in Korea', 'nature', true),
('Beginner', '소풍 경험', 'My Picnic Experience', 'friends', true),
('Beginner', '좋아하는 한국 아이스크림', 'My Favorite Korean Ice Cream', 'food', true),
('Beginner', '한국의 동네 산책', 'Walking Around a Korean Neighborhood', 'daily', true)
ON CONFLICT DO NOTHING;

-- Tree (81-90)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Intermediate', '한국의 공정 무역', 'Fair Trade in Korea', 'society', true),
('Intermediate', '틱톡 문화의 영향', 'Impact of TikTok Culture', 'tech', true),
('Intermediate', '한국의 미세먼지 대책', 'Fine Dust Countermeasures in Korea', 'nature', true),
('Intermediate', '크리에이터 경제의 성장', 'Growth of the Creator Economy', 'work', true),
('Intermediate', '한국의 무인 매장', 'Unmanned Stores in Korea', 'tech', true),
('Intermediate', '한국의 반지하 주거 문제', 'Semi-Basement Housing in Korea', 'society', true),
('Intermediate', '한국의 K-뷰티 열풍', 'K-Beauty Craze in Korea', 'culture', true),
('Intermediate', '한국의 독서실 문화', 'Korean Study Room Culture', 'school', true),
('Intermediate', '한국의 전통 한옥', 'Traditional Korean Hanok', 'culture', true),
('Intermediate', '일회용품 규제의 효과', 'Effects of Disposable Product Regulations', 'nature', true)
ON CONFLICT DO NOTHING;

-- Forest (81-90)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Advanced', '한국의 징병제와 모병제 전환 논의', 'Conscription vs Volunteer Military Debate', 'society', true),
('Advanced', '생명 윤리와 안락사 논쟁', 'Bioethics and the Euthanasia Debate', 'health', true),
('Advanced', '한국의 지역 균형 발전 정책', 'Regional Balanced Development Policy', 'society', true),
('Advanced', '감시 자본주의와 데이터 주권', 'Surveillance Capitalism and Data Sovereignty', 'tech', true),
('Advanced', '한국 스타트업 생태계의 과제', 'Challenges of Korean Startup Ecosystem', 'work', true),
('Advanced', '문화 전용 논쟁', 'Cultural Appropriation Debate', 'culture', true),
('Advanced', '한국의 청소년 참정권 논의', 'Youth Voting Rights Debate in Korea', 'society', true),
('Advanced', '순환 경제로의 전환', 'Transition to a Circular Economy', 'society', true),
('Advanced', '한국의 대체 에너지 전략', 'Alternative Energy Strategy in Korea', 'nature', true),
('Advanced', '포스트 코로나 시대의 교육 변화', 'Education Changes in the Post-COVID Era', 'school', true)
ON CONFLICT DO NOTHING;
