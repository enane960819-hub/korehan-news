-- auto-apply
-- Second pass on writing topics: "좋아하는 ○○" prompts that repeat each
-- other (6 Beginner Korean-food favorites, 좋아하는 노래 next to 좋아하는
-- 한국 노래 …) or leave little to write (좋아하는 꽃, 좋아하는 채소, 좋아하는
-- 신발) become distinct, writable prompts. Replaced in place so the weekly
-- rotation doesn't shift. Only rows still holding the old text change.
update public.writing_topics t
   set topic_ko = v.new_ko, topic_en = v.new_en
  from (values
  ('b210824c-2098-4a71-b0cd-5a34adcd1713', '우유를 좋아해요?', '주말에 만나는 사람', 'Someone I meet on weekends'),
  ('78c3cae8-1d86-4461-b621-f4be4b73a023', '좋아하는 라면', '요즘 배우고 있는 것', 'Something I am learning these days'),
  ('6e19eb46-51a2-40c5-a1e5-2bffd70f5273', '디저트를 좋아해요?', '어릴 때 좋아한 것', 'Something I liked as a child'),
  ('5875345e-74f7-429c-a20b-f7e143c170ec', '좋아하는 채소', '자주 연락하는 사람', 'Someone I often contact'),
  ('23149611-8467-4a85-8f1f-7cf688106680', '좋아하는 꽃', '집에서 하는 운동', 'Exercise I do at home'),
  ('ce973069-5f90-4288-a071-6c309b0a063f', '좋아하는 노래', '여행에서 산 물건', 'Something I bought on a trip'),
  ('2e626795-1c99-469f-a691-043b1204a38a', '좋아하는 날', '한국어로 하고 싶은 말', 'Something I want to say in Korean'),
  ('5f68f129-34f3-482a-ad69-795db7e1ac0f', '좋아하는 사진', '처음 해 본 일', 'Something I did for the first time'),
  ('45ca84a5-222a-42d0-bec3-140d7e34b4ae', '좋아하는 신발', '내 친구의 좋은 점', 'What is great about my friend'),
  ('14d61e9b-cf60-4b6f-9af3-e86186ab3c27', '자주 입는 색깔', '쉬는 날 하는 일', 'What I do on my day off'),
  ('3bf357f7-8f42-43dc-8f2f-94c8a53b5545', '좋아하는 한국 과자', '친구에게 추천하고 싶은 것', 'Something I want to recommend to a friend'),
  ('aadc059b-cf35-41df-a5ef-74e2c7282686', '좋아하는 한국 빵집', '돈을 쓰고 기분이 좋았던 일', 'Money I was happy to spend'),
  ('952ca164-cb56-400e-8c6f-140d0ea523ef', '좋아하는 한국 반찬', '기억에 남는 여행 음식', 'Food I remember from a trip'),
  ('33be3a77-e938-4297-ba0b-ea35c5411980', '좋아하는 한국 라면', '내 방을 소개해요', 'Let me introduce my room'),
  ('25b06ddb-2900-426d-968d-ed4f101ea9ba', '아이스크림 좋아해요?', '요즘 자주 만나는 사람', 'Someone I meet often these days'),
  ('1947fb5b-566e-473f-af94-f8fb704bd8cb', '좋아하는 한국 배달 음식', '내가 사는 곳의 좋은 점', 'What is good about where I live'),
  ('b55b4b2c-bd8c-4740-b168-3ee7bbc16d8a', '좋아하는 색이 뭐예요?', '어릴 때 자주 가던 곳', 'A place I often went as a child'),
  ('5d57cb34-d578-47b7-8bed-7009252b8a95', '동물을 좋아하는 이유', '좋은 하루를 보내는 방법', 'How to have a good day'),
  ('6c84980a-0da2-497f-b40c-c6f66810e8c2', '좋아하는 꽃과 이유', '외국어를 배우면 좋은 점', 'Why learning a foreign language is good')
  ) as v(id, old_ko, new_ko, new_en)
 where t.id::text = v.id and t.topic_ko = v.old_ko;
