-- Batch 5: 각 레벨 10개씩 추가 (항목 41-50)

-- Seed (41-50)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Starter', '내 양말', 'My Socks', 'daily', true),
('Starter', '좋아하는 주스', 'My Favorite Juice', 'food', true),
('Starter', '우리 집 고양이', 'Our Cat', 'hobby', true),
('Starter', '우리 집 강아지', 'Our Dog', 'hobby', true),
('Starter', '좋아하는 요일', 'My Favorite Day of the Week', 'daily', true),
('Starter', '내 책상', 'My Desk', 'school', true),
('Starter', '오늘 기분', 'How I Feel Today', 'daily', true),
('Starter', '좋아하는 나라', 'My Favorite Country', 'travel', true),
('Starter', '내 우산', 'My Umbrella', 'daily', true),
('Starter', '점심시간에 하는 일', 'What I Do at Lunchtime', 'school', true)
ON CONFLICT DO NOTHING;

-- Sprout (41-50)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Beginner', '한국 시장 구경하기', 'Visiting a Korean Market', 'travel', true),
('Beginner', '좋아하는 계절 음식', 'My Favorite Seasonal Food', 'food', true),
('Beginner', '한국에서 놀라운 규칙', 'Surprising Rules in Korea', 'culture', true),
('Beginner', '나의 아침 루틴', 'My Morning Routine', 'daily', true),
('Beginner', '한국 지하철 에티켓', 'Korean Subway Etiquette', 'culture', true),
('Beginner', '좋아하는 한국 과자', 'My Favorite Korean Snack', 'food', true),
('Beginner', '한국어 발음이 어려운 단어', 'Korean Words Hard to Pronounce', 'school', true),
('Beginner', '혼밥 경험', 'Eating Alone Experience', 'food', true),
('Beginner', '한국 노래 가사 배우기', 'Learning Korean Song Lyrics', 'kpop', true),
('Beginner', '셀프 사진 찍기', 'Taking Selfies', 'hobby', true)
ON CONFLICT DO NOTHING;

-- Tree (41-50)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Intermediate', '한국의 성형 문화', 'Plastic Surgery Culture in Korea', 'culture', true),
('Intermediate', '동물원의 존재 의의', 'The Purpose of Zoos', 'society', true),
('Intermediate', '한국의 노인 빈곤 문제', 'Elderly Poverty in Korea', 'society', true),
('Intermediate', '유학의 장단점', 'Pros and Cons of Studying Abroad', 'school', true),
('Intermediate', '한국의 치킨 문화', 'Korean Chicken Culture', 'food', true),
('Intermediate', '인터넷 실명제에 대한 의견', 'Opinions on Internet Real-Name Policy', 'tech', true),
('Intermediate', '한국의 팬 문화', 'Korean Fan Culture', 'kpop', true),
('Intermediate', '도시에서 자연을 즐기는 방법', 'Enjoying Nature in the City', 'nature', true),
('Intermediate', '한국의 나이 계산법', 'Korean Age System', 'culture', true),
('Intermediate', '중고 거래의 장단점', 'Pros and Cons of Secondhand Trading', 'daily', true)
ON CONFLICT DO NOTHING;

-- Forest (41-50)
INSERT INTO writing_topics (level, topic_ko, topic_en, category, active) VALUES
('Advanced', '인공지능 창작물의 저작권', 'Copyright of AI-Generated Content', 'tech', true),
('Advanced', '한국의 지방 소멸 위기', 'The Crisis of Rural Depopulation', 'society', true),
('Advanced', '동물권과 산업의 충돌', 'Animal Rights vs Industry', 'society', true),
('Advanced', '한국의 병역 특례 제도', 'Koreas Alternative Military Service', 'society', true),
('Advanced', '메타버스와 교육의 미래', 'Metaverse and the Future of Education', 'tech', true),
('Advanced', '한국 사회의 외모 지상주의', 'Lookism in Korean Society', 'culture', true),
('Advanced', '기후 난민 문제와 국제 책임', 'Climate Refugees and Global Responsibility', 'society', true),
('Advanced', '한국의 노동 시간 단축 논의', 'Debate on Reducing Work Hours in Korea', 'work', true),
('Advanced', '디지털 시대의 저널리즘', 'Journalism in the Digital Age', 'tech', true),
('Advanced', '한국의 장례 문화 변화', 'Changing Funeral Culture in Korea', 'culture', true)
ON CONFLICT DO NOTHING;
