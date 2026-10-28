-- auto-apply
-- Replace weak writing topics IN PLACE (same row, same position) so the
-- weekly rotation doesn't shift: forced / one-word / non-topic Starter
-- prompts (내 전화번호, 택시, 슬퍼요 …), Beginner topics that only work for
-- people living in Korea or are ambiguous, and Intermediate topics too
-- heavy or academic for TOPIK 3-4 (군대 문화, 반지하, 인터넷 실명제 …).
-- Only rows still holding the old text are touched. Idempotent.
update public.writing_topics t
   set topic_ko = v.new_ko, topic_en = v.new_en
  from (values
  ('7202af83-53c1-47fa-b93f-e1f45a8f4650', '내 전화번호', '핸드폰으로 자주 하는 것', 'What I often do on my phone'),
  ('7e35fef2-9d43-4024-9405-a5aab0d1a719', '좋아하는 아이스크림', '여름에 먹는 음식', 'Food I eat in summer'),
  ('710ddbd2-7ff4-4a9a-9cd8-2addabb06474', '좋아하는 주스', '아침에 마시는 것', 'What I drink in the morning'),
  ('7dfa5cb9-e4da-4576-ab9f-4f46573f03e6', '좋아하는 빵', '카페에서 자주 먹는 것', 'What I often have at a café'),
  ('ac40dc5d-07f3-43cd-8dcf-1ef3fb875b6e', '좋아하는 케이크', '생일에 먹는 음식', 'Food I eat on my birthday'),
  ('faadd389-4c77-469b-96c3-61b3c9eabe3d', '좋아하는 김밥', '소풍 갈 때 가져가는 음식', 'Food I take on a picnic'),
  ('18e4454d-fffe-41d6-a3dd-98129710ffe8', '좋아하는 떡볶이', '좋아하는 길거리 음식', 'My favorite street food'),
  ('44ad3fb4-0b33-4a6e-b970-3065625d254f', '좋아하는 피자', '친구와 같이 먹는 음식', 'Food I eat with friends'),
  ('1e80c766-dc3c-4175-bd93-fbe2bc8b459e', '좋아하는 숫자', '내가 아끼는 물건', 'Something I treasure'),
  ('85a25465-b6b4-45cc-995a-68c7ea4bb939', '내 침대', '편한 옷', 'Comfortable clothes'),
  ('c9f48bda-f6f5-4e22-91ed-8310896c2b08', '좋아하는 그림', '그림을 그려요?', 'Do you draw?'),
  ('264561ff-f0bd-4aab-9292-bb2924cd5b9a', '지금 몇 시예요?', '내 하루 시간표', 'My daily schedule'),
  ('f237f9fe-32a7-4a3b-b322-df9b3f9ee63c', '오늘은 무슨 요일이에요?', '요일마다 하는 일', 'What I do on each day of the week'),
  ('6a8c30b2-bc48-48f2-8327-f2f0d0f0b3c2', '좋아하는 나무', '식물을 키워요?', 'Do you grow plants?'),
  ('821e3bb0-c34c-4d9c-8cab-cca40b234120', '하늘 색깔', '좋아하는 날씨', 'My favorite weather'),
  ('076cb06b-814d-4521-929a-b070423b861d', '내 손', '내가 만들 수 있는 것', 'Something I can make'),
  ('5302b63a-3ec6-467b-aa91-c2004ca4bce4', '머리가 아파요', '아플 때 하는 일', 'What I do when I am sick'),
  ('7e5fd15a-f461-4654-9d4f-132902e66626', '기뻐요', '기분이 좋은 날', 'A day I feel good'),
  ('cb976f23-bb76-4817-a168-b97f0781de9e', '슬퍼요', '기분이 안 좋을 때 하는 일', 'What I do when I feel down'),
  ('d79e6343-e679-463f-80fc-3c2b20d5f6d7', '심심해요', '심심할 때 하는 일', 'What I do when I am bored'),
  ('a4a2d46f-55f5-47da-96ff-215c47648eff', '바빠요', '바쁜 날', 'A busy day'),
  ('af5f8ea6-1f3b-4fae-844b-3bb5ecf1e101', '비행기', '비행기를 타 봤어요?', 'Have you been on a plane?'),
  ('7945042f-40b1-4e5e-8907-5bb977dcb1c9', '호텔', '여행 가서 자는 곳', 'Where I stay when I travel'),
  ('e52906cf-5d25-4706-972f-38b7b565412a', '기차', '기차 타는 것을 좋아해요?', 'Do you like taking the train?'),
  ('33e5e0b2-f012-4243-b314-b64b5f1d3762', '버스', '버스를 자주 타요?', 'Do you often take the bus?'),
  ('0eb577dd-a056-48a8-9807-33960b699113', '지하철', '지하철에서 하는 일', 'What I do on the subway'),
  ('d211f742-4643-423f-9574-1f37a96c54cb', '택시', '택시를 자주 타요?', 'Do you often take taxis?'),
  ('a6165654-7bd3-45f7-a0e0-bc22eae313e9', '내 방 창문', '내 방에서 좋아하는 물건', 'My favorite thing in my room'),
  ('ae9da876-a611-43b3-8392-18725da9d55b', '시계', '시계를 차요?', 'Do you wear a watch?'),
  ('5f68f129-34f3-482a-ad69-795db7e1ac0f', '카메라', '좋아하는 사진', 'A photo I like'),
  ('b2205f59-7856-4b4e-aa87-0600a4d86717', '컴퓨터', '컴퓨터로 하는 일', 'What I do on the computer'),
  ('1c007c4e-565b-4b63-95df-c2fb94e5d8ef', '인터넷', '인터넷으로 자주 하는 것', 'What I often do online'),
  ('51077cac-df46-4b53-881a-4f2d705fa9d7', '좋아하는 새', '가 보고 싶은 곳', 'A place I want to go'),
  ('bc7a14cc-c8d2-438f-b0c2-797ce525f63d', '봄', '봄에 하고 싶은 일', 'What I want to do in spring'),
  ('29696191-fd75-49cb-a0a7-8ff0f3bf5ec0', '여름', '여름에 자주 하는 일', 'What I often do in summer'),
  ('ffb2fbf8-fe24-4167-9073-9d29e83097a2', '가을', '가을 날씨', 'Autumn weather'),
  ('f3260fc6-e8f4-4526-bbf7-6bef5acd0d40', '겨울', '겨울에 먹는 음식', 'Food I eat in winter'),
  ('14d61e9b-cf60-4b6f-9af3-e86186ab3c27', '좋아하는 옷 색깔', '자주 입는 색깔', 'A color I often wear'),
  ('14f43e59-6a5d-4e02-9938-fe137bd33d67', '셀프 사진 찍기', '셀카를 자주 찍어요?', 'Do you often take selfies?'),
  ('99b7a248-395a-47b9-8cb0-ccd22dd3f157', '좋아하는 한국 차', '자주 마시는 음료', 'A drink I often have'),
  ('13606a99-b33f-46d9-ba54-074a9085a94d', '한국의 문구점', '자주 쓰는 문구', 'Stationery I often use'),
  ('15bcb883-d1bf-4d06-9620-72d1af123135', '한국에서 사진관 경험', '기억에 남는 사진', 'A photo I remember'),
  ('32d3984b-2abd-497b-ada6-40b393019494', '한국의 떡볶이 맛집', '좋아하는 분식', 'My favorite snack-bar food'),
  ('3e2d8ed6-b629-419b-bd30-50e3628f6767', '한국의 김치 종류', '김치를 먹어 봤어요?', 'Have you tried kimchi?'),
  ('3d2d66f5-b30a-4908-9aed-5bb92461946a', '택배 문화', '택배로 받은 물건', 'Something I got by delivery'),
  ('4df702b6-7c58-458a-aa2f-acd75b1d31fd', '선물 포장', '선물을 고르는 방법', 'How I choose a gift'),
  ('ef9c67e2-1521-414c-b999-690bf8130da5', '한국에서 은행 가기', '은행에 갔던 일', 'A trip to the bank'),
  ('ff89b10f-ee00-46cd-bfd5-8f0d576aa26f', '한국에서 우체국 가기', '편지나 소포를 보낸 일', 'Sending a letter or package'),
  ('eed6dc40-cd9f-4044-bca2-711ac42318f1', '한국에서 병원 가기', '병원에 갔던 일', 'A visit to the doctor'),
  ('ea568feb-2e8a-4f96-a7f5-89e533fc852e', '한국에서 미용실 가기', '미용실에서 머리 자르기', 'Getting a haircut'),
  ('b0036999-b6b8-4507-a83a-bf64f7e913c0', '한국에서 약국 가기', '약국에서 약 사기', 'Buying medicine at a pharmacy'),
  ('09281426-d651-4ddc-99fa-ad0e54ab7378', '한국의 버스 타기', '버스에서 있었던 일', 'Something that happened on a bus'),
  ('c2f87e58-4307-4e90-ac59-d36fe6a173c9', '한국의 동네 산책', '우리 동네 산책', 'A walk in my neighborhood'),
  ('303ec0cf-e053-4f88-b060-7bb38d4174b0', '한국의 군대 문화', '나라마다 다른 의무와 규칙', 'Duties and rules that differ by country'),
  ('ac6488b9-ce5c-42af-8f26-af87f7c2010d', '한국의 노인 빈곤 문제', '나이 든 부모님을 돕는 방법', 'Ways to help aging parents'),
  ('1dee6e38-1218-46be-aa9a-dc578c268dd8', '인터넷 실명제에 대한 의견', '인터넷 댓글 문화에 대한 생각', 'Thoughts on online comment culture'),
  ('dc165930-11e9-4f13-88e3-340706c3c2f3', '한국의 의료 시스템', '아플 때 병원과 약국 중 어디에 가요?', 'Do you go to a clinic or a pharmacy when you are sick?'),
  ('f6d4ad5b-1d21-4a39-a9c5-d11468e65a10', '한국의 제주도 관광 과잉', '관광객이 많은 곳의 장단점', 'Pros and cons of crowded tourist spots'),
  ('94b2eece-a72f-488b-810b-2d3cfb1eaa96', '한국의 전세 제도', '집을 구할 때 힘든 점', 'What is hard about finding a home'),
  ('5e93acd4-ea5b-4481-bc8b-e2001302e50c', '한국의 장애인 인식', '모두가 편한 공공장소 만들기', 'Making public places comfortable for everyone'),
  ('f7d33b45-7dc2-4756-9d4b-86268199246f', '한국의 공정 무역', '물건을 살 때 생각하는 것', 'What I think about when I buy things'),
  ('32dcda3b-7b2c-4288-91db-bd61b0a391fb', '한국의 반지하 주거 문제', '작은 집에서 사는 법', 'How to live in a small home'),
  ('eeb8f500-2596-4079-b9ea-ebb166cbdaed', '한국의 다방과 커피숍 변천사', '카페가 인기 있는 이유', 'Why cafés are so popular'),
  ('4389ee21-7709-49f3-a6b2-69bcccc49e22', '한국의 정수기 문화', '물을 마시는 습관', 'My water-drinking habits'),
  ('fd921614-6030-4172-afa0-93a012b43d0b', '한국 농촌의 인력 부족', '시골에서 살아 보고 싶어요?', 'Would you like to live in the countryside?'),
  ('ee24603c-289a-439f-bdf4-3cae8570db39', '한국의 집단주의 문화', '혼자 하는 것과 같이 하는 것', 'Doing things alone versus together'),
  ('c2a324ae-32bf-4c52-8801-401bf71969e2', '한국의 성형 문화', '외모가 중요한 사회에 대한 생각', 'Thoughts on looks-focused society'),
  ('ec1e6e66-ea64-44ae-8277-c3d4cc3c8026', '한국의 주거 문제', '살고 싶은 동네의 조건', 'What makes a neighborhood worth living in'),
  ('52dca499-9885-4dbb-a041-8d41dfaf898b', '한국의 사교육비 부담', '학원에 다닌 경험', 'My experience with after-school academies'),
  ('cfab38c0-26fa-4ca4-b49a-1c390797c2ee', '한국의 미세먼지 대책', '날씨나 공기 때문에 바뀐 생활', 'How weather or air changed my routine'),
  ('b9190c7d-7880-4c98-948f-31280b150a5f', '전기차 보급의 현실', '앞으로 타고 싶은 차', 'The car I want to drive someday')
  ) as v(id, old_ko, new_ko, new_en)
 where t.id::text = v.id and t.topic_ko = v.old_ko;

-- The auto-built pack for 내 전화번호 is no longer used; content-qa builds
-- packs for the new topics.
delete from public.writing_topic_content where topic_ko = '내 전화번호' and content ? 'auto';
