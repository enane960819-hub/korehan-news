-- auto-apply
-- UI text stored in the DB was still Korean (foreign learners see it as
-- chrome, not as learning content). Idempotent.
update public.shop_items set description = 'Used automatically if you miss a day, so your streak doesn''t break.' where id = 'streak_freeze';
update public.shop_items set name = v.name from (values
  ('title_seed','Title · Seed (새싹)'), ('title_sprout','Title · Sprout (떡잎)'), ('title_tree','Title · Tree (나무)'),
  ('title_forest','Title · Forest (숲)'), ('title_scholar','Title · Scholar (학자)'), ('title_word_master','Title · Word Master (단어 마스터)'),
  ('title_news_addict','Title · News Addict (뉴스 중독자)'), ('title_night_owl','Title · Night Owl (야행성)'),
  ('title_early_bird','Title · Early Bird (아침형 인간)'), ('title_kimchi_lover','Title · Kimchi Lover (김치 러버)'),
  ('title_seoulite','Title · Seoulite (서울러)')
) as v(id, name) where public.shop_items.id = v.id;
update public.curriculum_lines set description = v.d from (values
  ('hangul','Consonants, vowels, final consonants, pronunciation — master Hangul from TOPIK 0.'),
  ('daily','Greetings, introductions, shopping, restaurants, directions, the doctor — survival Korean.'),
  ('kculture','Drama lines, K-pop lyrics, variety-show slang — Korean for fun.'),
  ('news','Society, politics, economy, world — current-affairs Korean from real news.'),
  ('business','Email, meetings, presentations, contracts — Korean for work.'),
  ('travel','Hotels, sights, public transport, emergencies — Korean for your trip.')
) as v(code, d) where public.curriculum_lines.code = v.code;
