-- auto-apply
-- ═════════════════════════════════════════════════════════════════════
-- user_daily_progress — per-LEVEL step tracking (2026-10-15)
-- ═════════════════════════════════════════════════════════════════════
-- Study Room audit #6: switching topic difficulty (Starter / Beginner /
-- Intermediate / Advanced) carried the 5-step completion marks over to the
-- new level, because progress had no level dimension. The 5 steps
-- regenerate DIFFERENT content at each difficulty, so completing them at one
-- level must not count at another.
--
-- syncStudyProgress() now upserts { user_id, study_date, level, *_done }
-- with onConflict 'user_id,study_date,level', and loadStudyDoneFromDB()
-- filters on level. This migration gives the table a `level` column and
-- swaps the unique index from (user_id, study_date) to
-- (user_id, study_date, level) so one day can hold one row per level.
--
-- The only writer of this table is the Study Room syncStudyProgress() upsert
-- (verified repo-wide), so swapping the conflict target is safe.
--
-- Idempotent: add column if missing, backfill existing rows to 'Beginner'
-- (the default level most learners used before this change), drop the old
-- 2-column unique index (which would otherwise forbid two levels sharing a
-- day), create the 3-column one. No-op if the table is absent.
-- ═════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.user_daily_progress') is null then
    raise notice 'user_daily_progress does not exist — skipping';
    return;
  end if;

  -- Per-level dimension. Default 'Beginner' backfills every existing row to
  -- the level those learners were on by default, preserving their progress.
  alter table public.user_daily_progress
    add column if not exists level text not null default 'Beginner';

  -- Drop the old 2-column unique index — it forbids a second row for the same
  -- (user, day) at a different level, which is exactly what we now allow.
  if exists (
    select 1 from pg_class
     where relname = 'user_daily_progress_user_study_date_uidx'
       and relkind = 'i'
  ) then
    execute 'drop index if exists public.user_daily_progress_user_study_date_uidx';
  end if;

  -- Also drop any other 2-column unique index on exactly (user_id, study_date)
  -- regardless of name, so the composite conflict target is unambiguous.
  declare
    idx_name text;
  begin
    for idx_name in
      select c.relname
        from pg_index i
        join pg_class c on c.oid = i.indexrelid
        join pg_class t on t.oid = i.indrelid
       where t.oid = 'public.user_daily_progress'::regclass
         and i.indisunique
         and i.indnatts = 2
         and (select array_agg(a.attname::text order by a.attname)
                from pg_attribute a
               where a.attrelid = t.oid and a.attnum = any(i.indkey))
             = array['study_date','user_id']
    loop
      execute 'drop index if exists public.' || quote_ident(idx_name);
    end loop;
  end;

  -- New 3-column unique index — the onConflict target for the per-level upsert.
  execute 'create unique index if not exists user_daily_progress_user_study_level_uidx
             on public.user_daily_progress (user_id, study_date, level)';
end
$$;

notify pgrst, 'reload schema';
