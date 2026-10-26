-- auto-apply
-- English display text for reporter profiles and room items (foreign
-- learners saw Korean-only bios, titles and item names). Korean stays in
-- the row; the page shows English first. Idempotent.
update public.character_reporters r
   set data = r.data || jsonb_build_object('intro_en', v.intro_en, 'role_en', v.role_en)
  from (values
    ('cr6','AI, chips, space science — I write tech news anyone can follow.','Tech & Science Editor'),
    ('cr9','In-depth analysis of diplomacy between the US, China, Japan and other major powers.','World & Diplomacy Reporter'),
    ('cr10','A friendly guide to Korean daily life, food, travel and trends.','Culture & Lifestyle Reporter'),
    ('cr5','Twenty years covering the National Assembly and the presidential office. Trusted for deep political analysis.','Senior Political Reporter'),
    ('cr1','KoreHan News society reporter, explaining complex social issues in easy Korean.','Society Reporter'),
    ('cr2','World news made easy to read in Korean. Specializes in international affairs.','International Correspondent'),
    ('cr7','Football, baseball, the Olympics — bringing you the energy of the stadium.','Sports Reporter'),
    ('cr3','Economic indicators and financial markets, explained simply. Thirty years as an economics editor.','Economics Editor-in-Chief'),
    ('cr8','Climate crisis, environmental policy and welfare — reported with people at the center.','Society & Environment Reporter'),
    ('cr4','K-pop, film and drama — the fastest read on Korean pop-culture trends.','Culture Reporter')
  ) as v(id, intro_en, role_en)
 where r.id = v.id;
update public.room_items set name = v.name from (values
  ('neon_hwaiting','Hwaiting! Neon Sign (화이팅)'), ('theKIng','King Sejong (세종대왕)')
) as v(id, name) where public.room_items.id = v.id;
