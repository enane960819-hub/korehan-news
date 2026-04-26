-- Phase 2a: replace skill-based curriculum lines with topic journey lines
--
-- Drops the previous 6 lines (vocab/grammar/reading/listening/writing/
-- culture) and reseeds with 6 topic-based learning journeys. Stations
-- and content_station_map cascade-delete via FK so any AI tags from
-- the old lines are wiped — fresh topic-line tagging happens in Phase 4.
--
-- Run AFTER 2026-04-26-curriculum-network.sql.

-- 1. Wipe old line/station data (cascade clears stations + map + progress)
delete from curriculum_lines;

-- 2. Seed the 6 topic journey lines
insert into curriculum_lines (id, code, name_ko, name_en, color, icon, description, sort_order) values
  (1, 'hangul',     '한글 호선',       'Hangul Line',         '#38bdf8', '🔤', '자음/모음/받침/발음 — TOPIK 0급 진입자용 한글 마스터.',                  10),
  (2, 'daily',      '일상대화 호선',   'Daily Conversation',  '#34d399', '💬', '인사/자기소개/쇼핑/식당/길찾기/병원 — 생존 한국어.',                    20),
  (3, 'kculture',   'K-Culture 호선',  'K-Culture Line',      '#fb7185', '🎤', '드라마 명대사/K-pop 가사/예능 유행어 — 재미로 배우는 한국어.',          30),
  (4, 'news',       '시사뉴스 호선',   'News & Society',      '#f59e0b', '📰', '사회/정치/경제/국제 — 신문 기사로 배우는 시사 한국어.',                 40),
  (5, 'business',   '비즈니스 호선',   'Business Line',       '#a78bfa', '💼', '이메일/회의/프레젠테이션/계약 — 직장에서 쓰는 한국어.',                 50),
  (6, 'travel',     '여행 호선',       'Travel Line',         '#f472b6', '✈️', '호텔/관광지/대중교통/긴급상황 — 한국 여행 한국어.',                     60);

-- 3. Seed 50 stations per line, level-staircased Starter→Fluency
do $$
declare
  ln record;
  i int;
  lvl text;
begin
  for ln in select id, code, name_ko from curriculum_lines order by id loop
    for i in 1..50 loop
      lvl := case
        when i <= 8  then 'Starter'
        when i <= 22 then 'Beginner'
        when i <= 36 then 'Intermediate'
        when i <= 46 then 'Advanced'
        else 'Fluency'
      end;
      insert into curriculum_stations (line_id, station_no, name_ko, name_en, level)
        values (
          ln.id,
          i,
          ln.name_ko || ' ' || i || '역',
          initcap(ln.code) || ' Stop ' || i,
          lvl
        )
        on conflict (line_id, station_no) do nothing;
    end loop;
  end loop;
end $$;
