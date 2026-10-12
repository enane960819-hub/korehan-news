-- auto-apply
-- ═════════════════════════════════════════════════════════════════════
-- user_daily_progress — Study Room weekly-step columns (2026-10-12)
-- ═════════════════════════════════════════════════════════════════════
-- korehan-study-room.js syncStudyProgress() upserts
--   { user_id, study_date, updated_at, topic_done | grammar_done |
--     picture_done | sentence_done | expressions_done }
-- with onConflict 'user_id,study_date', and loadStudyDoneFromDB() filters
-- on study_date. None of these columns (nor the conflict target) were
-- defined in any migration, so every sync failed and progress stayed
-- localStorage-only.
--
-- Idempotent: add column if not exists, unique index only if no unique
-- index on (user_id, study_date) exists yet, policies only if missing by
-- name. Existing policies are never dropped. No-op if the table is absent.
-- ═════════════════════════════════════════════════════════════════════

do $$
declare
  has_unique boolean;
begin
  if to_regclass('public.user_daily_progress') is null then
    raise notice 'user_daily_progress does not exist — skipping';
    return;
  end if;

  alter table public.user_daily_progress
    add column if not exists study_date       date,
    add column if not exists topic_done       boolean not null default false,
    add column if not exists grammar_done     boolean not null default false,
    add column if not exists picture_done     boolean not null default false,
    add column if not exists sentence_done    boolean not null default false,
    add column if not exists expressions_done boolean not null default false,
    add column if not exists updated_at       timestamptz default now();

  -- Legacy shape had a `date` column. If it is NOT NULL with no default,
  -- the Study Room upsert (which only sends study_date) would fail —
  -- give it a KST-today default so those inserts succeed.
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'user_daily_progress'
       and column_name = 'date' and is_nullable = 'NO' and column_default is null
  ) then
    execute 'alter table public.user_daily_progress alter column "date" set default ((now() at time zone ''Asia/Seoul'')::date)';
  end if;

  -- Conflict target for upsert(onConflict: 'user_id,study_date').
  select exists (
    select 1
      from pg_index i
      join pg_class t on t.oid = i.indrelid
     where t.oid = 'public.user_daily_progress'::regclass
       and i.indisunique
       and i.indnatts = 2
       and (select array_agg(a.attname::text order by a.attname)
              from pg_attribute a
             where a.attrelid = t.oid and a.attnum = any(i.indkey))
           = array['study_date','user_id']
  ) into has_unique;

  if not has_unique then
    execute 'create unique index if not exists user_daily_progress_user_study_date_uidx
               on public.user_daily_progress (user_id, study_date)';
  end if;

  -- RLS: owner-only select / insert / update. Added only when missing.
  execute 'alter table public.user_daily_progress enable row level security';

  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'user_daily_progress'
                    and policyname = 'udp_own_select') then
    execute 'create policy udp_own_select on public.user_daily_progress
               for select to authenticated using (auth.uid() = user_id)';
  end if;

  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'user_daily_progress'
                    and policyname = 'udp_own_insert') then
    execute 'create policy udp_own_insert on public.user_daily_progress
               for insert to authenticated with check (auth.uid() = user_id)';
  end if;

  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'user_daily_progress'
                    and policyname = 'udp_own_update') then
    execute 'create policy udp_own_update on public.user_daily_progress
               for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
end
$$;

notify pgrst, 'reload schema';
