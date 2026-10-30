-- auto-apply
-- Hand fixes to the three auto-built writing packs (owner report 2026-10-30:
-- a favourite-food lesson ended with "그래서 요즘 한국어를 열심히 공부해요").
-- Each update only fires while the row still holds the exact old text, so
-- re-running is a no-op and later admin edits are never overwritten.

-- 좋아하는 음식이 뭐예요? (Beginner)
--  · off-topic last sentence → on-topic one, placed before the "go to Korea" line
--  · frame 2 English for 건강에 좋아서 was a broken note
--  · model answer: 먹으면서 힘이 나요 → 먹으면 힘이 나요
update public.writing_topic_content
   set content = jsonb_set(jsonb_set(jsonb_set(content,
         '{sentences}', $j$[
           {"ko": "저는 김치찌개를 제일 좋아해요.", "en": "I like kimchi jjigae the most.", "acceptable_orders": []},
           {"ko": "따뜻하고 매콤해서 기분이 좋아요.", "en": "It is warm and spicy, so it puts me in a good mood.", "acceptable_orders": []},
           {"ko": "피곤할 때 먹으면 힘이 나요.", "en": "When I'm tired, eating it gives me energy.", "acceptable_orders": []},
           {"ko": "한국에 가서 맛있는 김치찌개를 먹고 싶어요.", "en": "I want to go to Korea and eat delicious kimchi jjigae.", "acceptable_orders": []}
         ]$j$::jsonb),
         '{frames,1,parts,1,options_en}', '["it is delicious", "it is warm", "it is good for my health"]'::jsonb),
         '{model_answer}', to_jsonb('저는 김치찌개를 제일 좋아해요. 따뜻하고 매콤해서 기분이 좋아요. 피곤할 때 먹으면 힘이 나요. 한국에 가서 맛있는 김치찌개를 먹고 싶어요.'::text)),
       updated_at = now()
 where topic_ko = '좋아하는 음식이 뭐예요?' and level = 'Beginner'
   and content::text like '%그래서 요즘 한국어를 열심히 공부해요%';

-- 제일 좋아하는 한국 음식은 뭐예요? (Beginner)
--  · the story never named the food → add the opening line
--  · pattern model "고기가 맛있어서" didn't fit bibimbap
update public.writing_topic_content
   set content = jsonb_set(jsonb_set(content,
         '{sentences}', jsonb_build_array(jsonb_build_object(
           'ko', '저는 비빔밥이 제일 좋아요.', 'en', 'I like bibimbap the most.', 'acceptable_orders', '[]'::jsonb))
           || (content->'sentences')),
         '{models,0}', '{"ko": "맛있어서 자주 먹어요.", "en": "It''s delicious, so I eat it often.", "hl": ["어서"]}'::jsonb),
       updated_at = now()
 where topic_ko = '제일 좋아하는 한국 음식은 뭐예요?' and level = 'Beginner'
   and content #>> '{sentences,0,ko}' = '채소가 많아서 건강에 좋아요.';

-- 오늘 무슨 옷을 입었나요? (Beginner)
--  · frame 2: 바빠서 ("because I was busy", translated as "wanted to dress
--    comfortably") → 편해서 / "because they are comfortable"
--  · frame 3: 이 옷을 입고 기분이 좋아요 → 이 옷을 입으니까 기분이 좋아요
update public.writing_topic_content
   set content = jsonb_set(jsonb_set(jsonb_set(content,
         '{frames,1,parts,0,options}', '["날씨가 따뜻해서", "날씨가 추워서", "편해서"]'::jsonb),
         '{frames,1,parts,0,options_en}', '["because the weather is warm", "because the weather is cold", "because they are comfortable"]'::jsonb),
         '{frames,2,parts,0}', '"이 옷을 입으니까 "'::jsonb),
       updated_at = now()
 where topic_ko = '오늘 무슨 옷을 입었나요?' and level = 'Beginner'
   and content #>> '{frames,1,parts,0,options,2}' = '바빠서';

-- 내 가족 (Starter)
--  · frame 2 forced "Mum/Dad is a chef" on every learner → "… likes cooking",
--    which is also what the checklist and the model sentence teach
update public.writing_topic_content
   set content = jsonb_set(jsonb_set(content,
         '{frames,1,en}', '"___ likes cooking."'::jsonb),
         '{frames,1,parts}', '["", {"ph": "…", "josa": "은/는", "slot": true, "options": ["엄마", "아버지", "동생"], "options_en": ["Mum", "Dad", "My younger sibling"]}, " 요리를 좋아해요."]'::jsonb),
       updated_at = now()
 where topic_ko = '내 가족' and level = 'Starter'
   and content #>> '{frames,1,parts,2}' = ' 요리사예요.';
