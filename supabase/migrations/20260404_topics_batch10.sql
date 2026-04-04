-- Batch 10 (마지막): 각 레벨 10개씩 추가 (항목 91-100)

-- Seed (91-100)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Starter', '내 컵', 'My Cup', 'daily', true),
('Starter', '좋아하는 만두', 'My Favorite Dumplings', 'food', true),
('Starter', '우리 집 현관', 'Our Front Door', 'daily', true),
('Starter', '좋아하는 풍선', 'My Favorite Balloon', 'hobby', true),
('Starter', '내 가위', 'My Scissors', 'school', true),
('Starter', '맑은 날', 'A Clear Day', 'nature', true),
('Starter', '좋아하는 피자', 'My Favorite Pizza', 'food', true),
('Starter', '내 달력', 'My Calendar', 'daily', true),
('Starter', '우리 아기', 'Our Baby', 'family', true),
('Starter', '설날에 하는 일', 'What I Do on Lunar New Year', 'culture', true)
ON CONFLICT DO NOTHING;

-- Sprout (91-100)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Beginner', '한국의 서점 방문', 'Visiting Korean Bookstores', 'culture', true),
('Beginner', '좋아하는 한국 반찬', 'My Favorite Korean Side Dish', 'food', true),
('Beginner', '한국에서 사진관 경험', 'Photo Studio Experience in Korea', 'daily', true),
('Beginner', '한국의 생일 문화', 'Korean Birthday Culture', 'culture', true),
('Beginner', '좋아하는 한국 차', 'My Favorite Korean Tea', 'food', true),
('Beginner', '한국에서 약국 가기', 'Going to a Pharmacy in Korea', 'health', true),
('Beginner', '한국의 가을 단풍', 'Autumn Leaves in Korea', 'nature', true),
('Beginner', '동아리 활동', 'Club Activities', 'school', true),
('Beginner', '좋아하는 한국 빵집', 'My Favorite Korean Bakery', 'food', true),
('Beginner', '한국의 야경 명소', 'Best Night View Spots in Korea', 'travel', true)
ON CONFLICT DO NOTHING;

-- Tree (91-100)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Intermediate', '한국의 문화유산 보존', 'Preserving Korean Cultural Heritage', 'culture', true),
('Intermediate', '전기차 보급의 현실', 'Reality of Electric Vehicle Adoption', 'tech', true),
('Intermediate', '한국의 노키즈존 논쟁', 'No Kids Zone Controversy in Korea', 'society', true),
('Intermediate', '한국의 집단주의 문화', 'Korean Collectivist Culture', 'culture', true),
('Intermediate', '탄소 발자국 줄이기', 'Reducing Carbon Footprint', 'nature', true),
('Intermediate', '한국의 야간 자율 학습', 'Korean Night Self-Study Culture', 'school', true),
('Intermediate', '한국의 무신사 같은 패션 플랫폼', 'Fashion Platforms Like Musinsa', 'culture', true),
('Intermediate', '한국 농촌의 인력 부족', 'Labor Shortage in Rural Korea', 'society', true),
('Intermediate', '한국의 정수기 문화', 'Korean Water Purifier Culture', 'daily', true),
('Intermediate', '한국의 다방과 커피숍 변천사', 'Evolution of Korean Coffee Shops', 'food', true)
ON CONFLICT DO NOTHING;

-- Forest (91-100)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Advanced', '한국의 국가 채무와 재정 건전성', 'National Debt and Fiscal Health', 'society', true),
('Advanced', '딥페이크 기술과 정보 조작', 'Deepfake Technology and Disinformation', 'tech', true),
('Advanced', '한국의 다문화 교육 정책', 'Multicultural Education Policy in Korea', 'school', true),
('Advanced', '플라스틱 오염과 해양 생태계', 'Plastic Pollution and Marine Ecosystems', 'nature', true),
('Advanced', '한국의 공무원 시험 문화', 'Korean Civil Service Exam Culture', 'work', true),
('Advanced', '인구 감소와 경제 성장의 딜레마', 'Population Decline and Economic Growth', 'society', true),
('Advanced', '한국의 지방 자치 강화 논의', 'Strengthening Local Autonomy in Korea', 'society', true),
('Advanced', '위기의 민주주의와 시민 참여', 'Democracy in Crisis and Civic Participation', 'society', true),
('Advanced', '한국의 반도체 산업과 국가 전략', 'Korean Semiconductor Industry Strategy', 'tech', true),
('Advanced', '세계화 시대의 문화 정체성', 'Cultural Identity in the Age of Globalization', 'culture', true)
ON CONFLICT DO NOTHING;
