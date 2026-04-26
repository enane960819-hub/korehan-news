-- Korean Curriculum Network ("호선" = subway-line metaphor)
-- Replaces the single placeholder "K-Express" line with a 6-line
-- network covering Vocabulary, Grammar, Reading, Listening/Speaking,
-- Writing, and K-Culture/News. Each line carries 50 stations
-- (curriculum nodes) ordered Starter → Fluency.
--
-- Content (articles, conversations, stories, vocab, grammar points)
-- gets mapped to stations via content_station_map; weight 0..1 lets
-- one piece of content count toward multiple stations.

-- ── 1. LINES ────────────────────────────────────────────────────
create table if not exists curriculum_lines (
  id          int primary key,                  -- stable line number (1~9)
  code        text not null unique,             -- 'vocab', 'grammar', etc.
  name_ko     text not null,                    -- '어휘선', '문법선'
  name_en     text not null,                    -- 'Vocabulary Line'
  color       text not null,                    -- hex tint for UI
  icon        text,                             -- single-char emoji
  description text,
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz default now()
);

-- ── 2. STATIONS ─────────────────────────────────────────────────
create table if not exists curriculum_stations (
  id              bigserial primary key,
  line_id         int not null references curriculum_lines(id) on delete cascade,
  station_no      int not null,                  -- 1..50 within the line
  name_ko         text not null,
  name_en         text not null,
  level           text not null check (level in ('Starter','Beginner','Intermediate','Advanced','Fluency')),
  can_do          text,                          -- can-do statement (CEFR-style)
  grammar_points  text[],                        -- linked grammar names
  topic_tags      text[],                        -- vocabulary/topic tags
  prerequisites   bigint[],                      -- station ids that should be done first
  created_at      timestamptz default now(),
  unique (line_id, station_no)
);
create index if not exists curriculum_stations_line_idx on curriculum_stations(line_id, station_no);

-- ── 3. CONTENT ↔ STATION MAP ────────────────────────────────────
create table if not exists content_station_map (
  id            bigserial primary key,
  content_type  text not null,    -- 'article'|'conversation'|'story'|'vocab'|'grammar'
  content_id    text not null,    -- string-id; some tables use uuid, others int
  station_id    bigint not null references curriculum_stations(id) on delete cascade,
  weight        numeric(3,2) not null default 1.0 check (weight >= 0 and weight <= 1.0),
  source        text not null default 'ai',  -- 'ai' | 'admin' | 'seed'
  confidence    numeric(3,2),     -- AI confidence 0..1; null for admin/seed
  created_at    timestamptz default now(),
  unique (content_type, content_id, station_id)
);
create index if not exists csm_station_idx on content_station_map(station_id);
create index if not exists csm_content_idx on content_station_map(content_type, content_id);

-- ── 4. PER-USER STATION PROGRESS (lazy-computed cache) ──────────
-- Materialised on demand by RPC get_user_station_progress(); we
-- don't write here on every read event because it'd thrash. Refresh
-- on growth-lab open and after big study sessions.
create table if not exists user_station_progress (
  user_id     uuid not null references auth.users(id) on delete cascade,
  station_id  bigint not null references curriculum_stations(id) on delete cascade,
  progress    numeric(4,3) not null default 0,    -- 0..1 = % of mapped content completed
  status      text not null default 'unvisited' check (status in ('unvisited','transferring','passed')),
  updated_at  timestamptz not null default now(),
  primary key (user_id, station_id)
);
create index if not exists usp_user_idx on user_station_progress(user_id, status);

-- ── RLS ─────────────────────────────────────────────────────────
alter table curriculum_lines     enable row level security;
alter table curriculum_stations  enable row level security;
alter table content_station_map  enable row level security;
alter table user_station_progress enable row level security;

drop policy if exists "anyone reads lines" on curriculum_lines;
create policy "anyone reads lines" on curriculum_lines for select using (true);

drop policy if exists "anyone reads stations" on curriculum_stations;
create policy "anyone reads stations" on curriculum_stations for select using (true);

drop policy if exists "anyone reads content map" on content_station_map;
create policy "anyone reads content map" on content_station_map for select using (true);

drop policy if exists "user reads own station progress" on user_station_progress;
create policy "user reads own station progress" on user_station_progress
  for select using (auth.uid() = user_id);
drop policy if exists "user writes own station progress" on user_station_progress;
create policy "user writes own station progress" on user_station_progress
  for insert with check (auth.uid() = user_id);
drop policy if exists "user updates own station progress" on user_station_progress;
create policy "user updates own station progress" on user_station_progress
  for update using (auth.uid() = user_id);

-- ── 5. SEED LINES ───────────────────────────────────────────────
insert into curriculum_lines (id, code, name_ko, name_en, color, icon, description, sort_order) values
  (1, 'vocab',     '어휘선',         'Vocabulary Line',  '#38bdf8', '📚', 'TOPIK basic words → topic-specific journalism vocabulary.',           10),
  (2, 'grammar',   '문법선',         'Grammar Line',     '#a78bfa', '📝', '~이에요/예요 from beginner basics → advanced conditional & honorifics.', 20),
  (3, 'reading',   '읽기선',         'Reading Line',     '#34d399', '📰', 'Signs and notices → editorials and op-eds.',                          30),
  (4, 'listening', '듣기/말하기선',  'Listen & Speak',   '#f59e0b', '🎧', 'Greetings → debate-level conversation.',                              40),
  (5, 'writing',   '쓰기선',         'Writing Line',     '#f472b6', '✍️', 'Self-introduction sentences → critical essays.',                      50),
  (6, 'culture',   '문화선',         'K-Culture Line',   '#fb7185', '🎭', 'Foods and holidays → contemporary social issues.',                    60)
on conflict (id) do update
  set code = excluded.code, name_ko = excluded.name_ko, name_en = excluded.name_en,
      color = excluded.color, icon = excluded.icon, description = excluded.description,
      sort_order = excluded.sort_order;

-- ── 6. SEED STATIONS (50 per line, level-staircased) ────────────
-- Level distribution per line: Starter 1-8, Beginner 9-22, Intermediate 23-36, Advanced 37-46, Fluency 47-50
-- Names follow a "Major / Minor" format so the line reads as a logical
-- progression even when a station is later renamed by content team.
do $$
declare
  ln record;
  i int;
  lvl text;
  station_name_ko text;
  station_name_en text;
begin
  for ln in select id, code, name_ko from curriculum_lines order by id loop
    for i in 1..50 loop
      lvl := case
        when i <= 8 then 'Starter'
        when i <= 22 then 'Beginner'
        when i <= 36 then 'Intermediate'
        when i <= 46 then 'Advanced'
        else 'Fluency'
      end;
      station_name_ko := ln.name_ko || ' ' || i || '역';
      station_name_en := initcap(ln.code) || ' Stop ' || i;
      insert into curriculum_stations (line_id, station_no, name_ko, name_en, level)
        values (ln.id, i, station_name_ko, station_name_en, lvl)
        on conflict (line_id, station_no) do nothing;
    end loop;
  end loop;
end $$;

-- ── 7. PROGRESS RPC ─────────────────────────────────────────────
-- Aggregates content the user has actually consumed (read/quizzed)
-- against the content_station_map weights, producing a 0..1 progress
-- per station and writes it back to user_station_progress.
create or replace function refresh_user_station_progress(p_user_id uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then return; end if;

  with consumed as (
    -- All content this user has touched. Reading + quiz + writing all
    -- count as "encountered" for now; weighting can grow later.
    select 'article' as ct, content_id::text as cid from user_read_history
       where user_id = p_user_id and content_type = 'article'
    union
    select 'conversation', content_id::text from user_read_history
       where user_id = p_user_id and content_type = 'conversation'
    union
    select 'story', content_id::text from user_read_history
       where user_id = p_user_id and content_type = 'story'
    union
    select 'vocab', word_ko::text from user_saved_words where user_id = p_user_id
  ),
  per_station as (
    select m.station_id,
           sum(m.weight) filter (where c.cid is not null) as got,
           sum(m.weight)                                  as total
      from content_station_map m
      left join consumed c
        on c.ct = m.content_type and c.cid = m.content_id
      group by m.station_id
  )
  insert into user_station_progress (user_id, station_id, progress, status, updated_at)
    select p_user_id, station_id,
           case when total > 0 then least(1.0, got/total) else 0 end,
           case
             when total > 0 and got/total >= 0.8 then 'passed'
             when total > 0 and got/total >  0.0 then 'transferring'
             else 'unvisited'
           end,
           now()
      from per_station
  on conflict (user_id, station_id) do update
     set progress = excluded.progress,
         status   = excluded.status,
         updated_at = excluded.updated_at;
end $$;

grant execute on function refresh_user_station_progress(uuid) to authenticated;
