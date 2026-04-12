-- ═══════════════════════════════════════════════════════════
-- Korean Slangs table + Phone Calls table
-- 2026-04-12
-- ═══════════════════════════════════════════════════════════

-- ─── KOREAN SLANGS ───
CREATE TABLE IF NOT EXISTS korean_slangs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ko TEXT NOT NULL,
  en TEXT NOT NULL,
  desc_text TEXT,
  tag TEXT DEFAULT '일상',
  warn BOOLEAN DEFAULT false,
  warn_text TEXT,
  chat JSONB,  -- [{speaker:"수진", me:false, msg:"..."}, ...]
  difficulty TEXT DEFAULT 'Beginner',
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE korean_slangs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "korean_slangs_read" ON korean_slangs FOR SELECT USING (true);
CREATE POLICY "korean_slangs_admin" ON korean_slangs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Index for active slangs sorted
CREATE INDEX idx_korean_slangs_active ON korean_slangs (is_active, sort_order);

-- ─── SEED DATA (from hardcoded array) ───
INSERT INTO korean_slangs (ko, en, desc_text, tag, warn, warn_text, chat, difficulty, sort_order) VALUES
('갓생', 'God-life', '"신(God)" + "인생(life)". 매우 성실하고 생산적인 하루를 보내는 것', 'MZ세대', false, NULL,
 '[{"me":false,"name":"수진","msg":"오늘 새벽 5시에 일어나서 운동하고 공부했어"},{"me":true,"msg":"와 진짜 <hl>갓생</hl> 사네 😱"},{"me":false,"name":"수진","msg":"ㅋㅋ 내일부터 같이 할래?"},{"me":true,"msg":"나는 갓생은 무리... 낮생이라도 할게"}]'::jsonb,
 'Beginner', 1),

('ㅋㅋㅋ', 'hahaha', '한국어 웃음소리. ㅋ이 많을수록 더 웃김. ㅋ 하나면 비꼬는 느낌일 수 있음', '기본', true, 'ㅋ 하나만 쓰면 "재미없다/비꼬는" 느낌',
 '[{"me":false,"name":"민수","msg":"나 오늘 면접에서 자기소개를 일본어로 했어"},{"me":true,"msg":"뭐?? <hl>ㅋㅋㅋㅋㅋㅋ</hl>"},{"me":false,"name":"민수","msg":"긴장해서 ㅠㅠ"},{"me":true,"msg":"ㅋㅋㅋㅋ 아 진짜 웃기다"}]'::jsonb,
 'Beginner', 2),

('혼코노', 'solo karaoke', '혼자(alone) + 코인 노래방(coin karaoke). 혼자 노래방 가는 것', '혼족문화', false, NULL,
 '[{"me":false,"name":"지영","msg":"오늘 뭐 해?"},{"me":true,"msg":"<hl>혼코노</hl> 가려고 ㅎㅎ"},{"me":false,"name":"지영","msg":"오 좋다~ 나도 혼코노 좋아해"},{"me":true,"msg":"스트레스 풀기 최고지"}]'::jsonb,
 'Intermediate', 3),

('꿀잼', 'super fun', '꿀(honey) + 재미(fun). 정말 재밌다는 의미. 반대말: 노잼', '일상', false, NULL,
 '[{"me":false,"name":"하은","msg":"그 드라마 봤어?"},{"me":true,"msg":"응 어제 밤새 봤어 진짜 <hl>꿀잼</hl>이야"},{"me":false,"name":"하은","msg":"맞아 나도 멈출 수가 없었어"},{"me":true,"msg":"시즌2 나와야 하는데..."}]'::jsonb,
 'Beginner', 4),

('노잼', 'no fun', 'No + 재미(fun). 전혀 재미없다', '일상', false, NULL,
 '[{"me":false,"name":"서준","msg":"어제 소개팅 어땠어?"},{"me":true,"msg":"완전 <hl>노잼</hl>이었어..."},{"me":false,"name":"서준","msg":"왜 뭐가 문제였는데"},{"me":true,"msg":"자기 얘기만 2시간 함 ㅠ"}]'::jsonb,
 'Beginner', 5),

('존맛탱', 'crazy delicious', '존나 맛있다의 줄임말. 매우 맛있다', '음식', true, '원래 비속어에서 온 말 — 친구 사이에서만',
 '[{"me":false,"name":"유진","msg":"이 떡볶이 먹어봐"},{"me":true,"msg":"헐... <hl>존맛탱</hl> 🤤🤤🤤"},{"me":false,"name":"유진","msg":"여기 맨날 줄 서는 곳이야"},{"me":true,"msg":"이해된다 진짜"}]'::jsonb,
 'Intermediate', 6),

('별다줄', 'abbreviation of everything', '"별걸 다 줄인다"의 줄임말. 그 자체가 줄임말인 게 포인트', '메타', false, NULL,
 '[{"me":false,"name":"현우","msg":"갑분싸, 별다줄, 설참... 한국어 줄임말 너무 많아"},{"me":true,"msg":"ㅋㅋ <hl>별다줄</hl> 자체도 줄임말이잖아"},{"me":false,"name":"현우","msg":"아... 진짜네 ㅋㅋㅋ"}]'::jsonb,
 'Advanced', 7),

('인싸', 'insider/popular person', 'Insider의 한국식 발음. 사교적이고 인기 많은 사람', '사회생활', false, NULL,
 '[{"me":false,"name":"소연","msg":"새 동기가 벌써 모든 팀이랑 친해짐"},{"me":true,"msg":"완전 <hl>인싸</hl>네"},{"me":false,"name":"소연","msg":"부럽다 나는 만년 아싸인데"},{"me":true,"msg":"ㅋㅋ 우리 둘 다 아싸끼리 잘 지내잖아"}]'::jsonb,
 'Beginner', 8),

('아싸', 'outsider/loner', 'Outsider의 한국식 발음. 혼자 있는 걸 좋아하는 사람 (부정적이지 않음)', '사회생활', false, NULL,
 '[{"me":false,"name":"태현","msg":"주말에 뭐 했어?"},{"me":true,"msg":"집에서 넷플릭스 정주행 ㅎㅎ"},{"me":false,"name":"태현","msg":"완전 <hl>아싸</hl> 라이프 ㅋㅋ"},{"me":true,"msg":"행복한 아싸입니다 😌"}]'::jsonb,
 'Beginner', 9),

('떡상', 'skyrocket', '떡(rice cake) + 상승(rise). 가격이나 인기가 급등하는 것', '투자/트렌드', false, NULL,
 '[{"me":false,"name":"준호","msg":"비트코인 또 올랐대"},{"me":true,"msg":"진짜? 완전 <hl>떡상</hl>이네"},{"me":false,"name":"준호","msg":"나 왜 안 샀을까 ㅠㅠ"},{"me":true,"msg":"떡락할 수도 있으니까 ㅋㅋ"}]'::jsonb,
 'Intermediate', 10),

('플렉스', 'flex/show off', '영어 flex에서 온 말. 돈을 쓰며 과시하는 것', '소비문화', false, NULL,
 '[{"me":false,"name":"다은","msg":"새 가방 샀다~"},{"me":true,"msg":"오 <hl>플렉스</hl> 했네 👀"},{"me":false,"name":"다은","msg":"월급 들어온 기념 ㅎㅎ"},{"me":true,"msg":"부럽... 나는 이번달 텅장이야"}]'::jsonb,
 'Beginner', 11),

('갑분싸', 'sudden awkward silence', '"갑자기 분위기 싸해짐"의 줄임말', '일상', false, NULL,
 '[{"me":false,"name":"채원","msg":"다들 재밌게 놀고 있었는데 팀장님이 들어오심"},{"me":true,"msg":"<hl>갑분싸</hl> ㅋㅋㅋㅋ"},{"me":false,"name":"채원","msg":"모두 갑자기 조용해짐 ㅎㅎ"}]'::jsonb,
 'Intermediate', 12),

('혼밥', 'eating alone', '혼자(alone) + 밥(rice/meal). 혼자 밥 먹는 것. 지금은 매우 자연스러운 문화', '혼족문화', false, NULL,
 '[{"me":true,"msg":"오늘 점심 같이 먹을 사람?"},{"me":false,"name":"은지","msg":"미안 나 오늘 <hl>혼밥</hl>할래 ㅎㅎ"},{"me":true,"msg":"ㅋㅋ 혼밥러 갬성 즐기는 거지?"},{"me":false,"name":"은지","msg":"응 이어폰 끼고 유튜브 보면서 먹는 게 최고야"}]'::jsonb,
 'Beginner', 13),

('댕댕이', 'puppy/doggo', '멍멍이(doggy)를 귀엽게 바꾼 말. ㅁ→ㄷ, ㅇ→ㅇ 글자 모양이 비슷해서', '귀여움', false, NULL,
 '[{"me":false,"name":"예린","msg":"[사진] 우리 <hl>댕댕이</hl> 봐 🐶"},{"me":true,"msg":"어머 너무 귀여워!!"},{"me":false,"name":"예린","msg":"오늘 산책하다가 다른 댕댕이랑 친구 됨 ㅎㅎ"},{"me":true,"msg":"댕댕이 인싸네 ㅋㅋ"}]'::jsonb,
 'Beginner', 14),

('실화냐', 'is this real?', '"실화(real story)냐?" 믿기 어려울 때 쓰는 말', '리액션', false, NULL,
 '[{"me":false,"name":"성민","msg":"나 복권 당첨됐어"},{"me":true,"msg":"....<hl>실화냐</hl>???"},{"me":false,"name":"성민","msg":"5000원 ㅋㅋ"},{"me":true,"msg":"ㅋㅋㅋㅋ 그것도 실화라고"}]'::jsonb,
 'Beginner', 15);


-- ─── PHONE CALLS ───
CREATE TABLE IF NOT EXISTS phone_calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  title_en TEXT,
  description TEXT,
  category TEXT DEFAULT 'Daily',  -- Daily, Business, Emergency
  difficulty TEXT DEFAULT 'Beginner',
  audio_url TEXT,  -- path to audio file in Supabase Storage or external URL
  duration_seconds INT DEFAULT 0,
  script JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- script: [{speaker:"A", start:0.0, end:2.5, ko:"여보세요?", en:"Hello?", bold_words:["여보세요"]}, ...]
  speakers JSONB DEFAULT '{"A":{"name":"화자 A","color":"#34d399"},"B":{"name":"화자 B","color":"#60a5fa"}}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE phone_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phone_calls_read" ON phone_calls FOR SELECT USING (true);
CREATE POLICY "phone_calls_admin" ON phone_calls FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_phone_calls_active ON phone_calls (is_active, sort_order);

-- Sample phone call data
INSERT INTO phone_calls (title, title_en, description, category, difficulty, duration_seconds, script, speakers, sort_order) VALUES
('점심 약속', 'Lunch Date', '친구와 점심 약속을 잡는 전화', 'Daily', 'Beginner', 88,
 '[{"speaker":"A","start":0.0,"end":2.5,"ko":"여보세요, 혹시 시간 되세요?","en":"Hello, do you have a moment?"},{"speaker":"B","start":3.0,"end":4.5,"ko":"네, 말씀하세요.","en":"Yes, go ahead."},{"speaker":"A","start":5.0,"end":7.5,"ko":"내일 점심 같이 할래요?","en":"Do you want to have lunch together tomorrow?"},{"speaker":"B","start":8.0,"end":10.5,"ko":"좋아요! 몇 시에 만날까요?","en":"Sure! What time shall we meet?"},{"speaker":"A","start":11.0,"end":13.0,"ko":"12시 정도 어때요?","en":"How about around 12?"},{"speaker":"B","start":13.5,"end":15.5,"ko":"좋아요, 12시에 만나요!","en":"Great, see you at 12!"}]'::jsonb,
 '{"A":{"name":"지민","color":"#34d399"},"B":{"name":"수진","color":"#60a5fa"}}'::jsonb, 1),

('배달 주문', 'Delivery Order', '음식 배달 주문하는 전화', 'Daily', 'Beginner', 95,
 '[{"speaker":"A","start":0.0,"end":2.0,"ko":"여보세요, 주문하려고 전화했는데요.","en":"Hello, I''m calling to place an order."},{"speaker":"B","start":2.5,"end":4.5,"ko":"네, 어떤 메뉴로 드릴까요?","en":"Yes, what would you like to order?"},{"speaker":"A","start":5.0,"end":7.0,"ko":"짜장면 하나랑 탕수육 소자 하나요.","en":"One jajangmyeon and one small tangsuyuk."},{"speaker":"B","start":7.5,"end":9.5,"ko":"주소 알려주시겠어요?","en":"Could you tell me your address?"},{"speaker":"A","start":10.0,"end":13.0,"ko":"서울시 강남구 역삼동 123번지요.","en":"123, Yeoksam-dong, Gangnam-gu, Seoul."},{"speaker":"B","start":13.5,"end":16.0,"ko":"네, 30분 정도 걸릴 거예요.","en":"OK, it will take about 30 minutes."},{"speaker":"A","start":16.5,"end":17.5,"ko":"감사합니다!","en":"Thank you!"}]'::jsonb,
 '{"A":{"name":"손님","color":"#34d399"},"B":{"name":"직원","color":"#f59e0b"}}'::jsonb, 2),

('병원 예약', 'Hospital Appointment', '병원에 진료 예약하는 전화', 'Daily', 'Intermediate', 110,
 '[{"speaker":"A","start":0.0,"end":2.5,"ko":"안녕하세요, 진료 예약하고 싶은데요.","en":"Hello, I''d like to make an appointment."},{"speaker":"B","start":3.0,"end":5.0,"ko":"네, 어떤 증상이세요?","en":"Sure, what are your symptoms?"},{"speaker":"A","start":5.5,"end":8.0,"ko":"며칠 전부터 목이 아프고 기침이 나요.","en":"I''ve had a sore throat and cough for a few days."},{"speaker":"B","start":8.5,"end":11.0,"ko":"내과로 예약해 드릴게요. 내일 오전 10시 가능하세요?","en":"I''ll book you with internal medicine. Is tomorrow at 10 AM okay?"},{"speaker":"A","start":11.5,"end":13.0,"ko":"네, 괜찮아요. 감사합니다.","en":"Yes, that works. Thank you."},{"speaker":"B","start":13.5,"end":16.0,"ko":"성함이 어떻게 되세요?","en":"May I have your name?"},{"speaker":"A","start":16.5,"end":18.0,"ko":"김민수입니다.","en":"Kim Minsu."},{"speaker":"B","start":18.5,"end":21.0,"ko":"네, 김민수님 내일 오전 10시 예약되었습니다.","en":"OK, Mr. Kim, you''re booked for tomorrow at 10 AM."}]'::jsonb,
 '{"A":{"name":"환자","color":"#34d399"},"B":{"name":"접수원","color":"#f472b6"}}'::jsonb, 3);
