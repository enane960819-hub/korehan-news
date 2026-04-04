-- ============================================================
-- 1. 중복 제거 (level + topic_ko 기준, 가장 오래된 것만 유지)
-- ============================================================
DELETE FROM writing_topics a USING writing_topics b
WHERE a.id > b.id AND a.level = b.level AND a.topic_ko = b.topic_ko;

-- ============================================================
-- 2. study_daily_content에 status 컬럼 추가
-- ============================================================
ALTER TABLE study_daily_content ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
-- 기존 데이터는 approved로 (이미 유저에게 보여진 것)
UPDATE study_daily_content SET status = 'approved' WHERE status = 'draft';

-- ============================================================
-- 3. 레벨별 토픽 10개씩 (총 40개)
-- ============================================================

-- Seed (10개)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Starter', '내가 좋아하는 음식', 'My Favorite Food', 'food', true),
('Starter', '우리 가족 소개', 'Introducing My Family', 'family', true),
('Starter', '좋아하는 색깔', 'My Favorite Color', 'hobby', true),
('Starter', '내 친구 소개', 'Introducing My Friend', 'friends', true),
('Starter', '좋아하는 동물', 'My Favorite Animal', 'hobby', true),
('Starter', '학교에서 하는 일', 'What I Do at School', 'school', true),
('Starter', '오늘 입은 옷', 'What I Am Wearing Today', 'daily', true),
('Starter', '집에서 좋아하는 장소', 'My Favorite Spot at Home', 'daily', true),
('Starter', '좋아하는 과일', 'My Favorite Fruit', 'food', true),
('Starter', '나의 하루', 'My Day', 'daily', true)
ON CONFLICT DO NOTHING;

-- Sprout (10개)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Beginner', '자주 가는 카페', 'My Favorite Cafe', 'food', true),
('Beginner', '최근에 본 영화', 'A Movie I Watched Recently', 'culture', true),
('Beginner', '한국 음식 만들기', 'Cooking Korean Food', 'food', true),
('Beginner', '운동하는 습관', 'My Exercise Routine', 'health', true),
('Beginner', '여행 가고 싶은 곳', 'A Place I Want to Visit', 'travel', true),
('Beginner', '스마트폰 사용 습관', 'How I Use My Phone', 'tech', true),
('Beginner', '좋아하는 계절', 'My Favorite Season', 'daily', true),
('Beginner', '생일 파티 경험', 'A Birthday Party Experience', 'friends', true),
('Beginner', '대중교통 이용하기', 'Using Public Transportation', 'daily', true),
('Beginner', '반려동물 키우기', 'Having a Pet', 'hobby', true)
ON CONFLICT DO NOTHING;

-- Tree (10개)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Intermediate', 'SNS가 인간관계에 미치는 영향', 'How Social Media Affects Relationships', 'tech', true),
('Intermediate', '한국 드라마가 인기 있는 이유', 'Why Korean Dramas Are Popular', 'culture', true),
('Intermediate', '환경 보호를 위해 할 수 있는 일', 'What We Can Do for the Environment', 'society', true),
('Intermediate', '온라인 쇼핑 vs 오프라인 쇼핑', 'Online vs Offline Shopping', 'daily', true),
('Intermediate', '외국어를 배우는 가장 좋은 방법', 'The Best Way to Learn a Language', 'school', true),
('Intermediate', '재택근무의 장단점', 'Pros and Cons of Working from Home', 'work', true),
('Intermediate', '한국의 명절 문화', 'Korean Holiday Traditions', 'culture', true),
('Intermediate', '건강한 식습관의 중요성', 'The Importance of Healthy Eating', 'health', true),
('Intermediate', '여행이 주는 교훈', 'Lessons from Traveling', 'travel', true),
('Intermediate', '세대 차이와 소통', 'Generation Gap and Communication', 'society', true)
ON CONFLICT DO NOTHING;

-- Forest (10개)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Advanced', 'AI 기술의 윤리적 한계', 'Ethical Limits of AI Technology', 'tech', true),
('Advanced', '저출생 문제에 대한 정책 제안', 'Policy Proposals for Low Birth Rates', 'society', true),
('Advanced', '전통문화 보존과 현대화의 균형', 'Balancing Tradition and Modernization', 'culture', true),
('Advanced', '기후변화에 대한 국제 협력의 필요성', 'The Need for Global Climate Cooperation', 'society', true),
('Advanced', '디지털 감시 사회와 개인정보', 'Digital Surveillance and Privacy', 'tech', true),
('Advanced', '한국 교육 제도의 개선 방향', 'Improving Koreas Education System', 'school', true),
('Advanced', '경제 불평등 해소를 위한 방안', 'Solutions for Economic Inequality', 'society', true),
('Advanced', '문화 다양성이 사회에 미치는 영향', 'Impact of Cultural Diversity on Society', 'culture', true),
('Advanced', '미디어 리터러시의 중요성', 'The Importance of Media Literacy', 'tech', true),
('Advanced', '도시와 농촌의 격차 해소', 'Bridging the Urban-Rural Divide', 'society', true)
ON CONFLICT DO NOTHING;
