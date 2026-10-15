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
-- swaps the unique on (user_id, study_date) for one on
-- (user_id, study_date, level) so one day can hold one row per level.
--
-- The only writer of this table is the Study Room syncStudyProgress() upsert
-- (verified repo-wide), so swapping the conflict target is safe.
--
-- v2 (2026-10-15): the first version used DROP INDEX, but the 2-column unique
-- is a CONSTRAINT (user_daily_progress_user_id_study_date_key), not a bare
-- index — Postgres refuses "drop index" on a constraint-backed index
-- (SQLSTATE 2BP01). This version drops the UNIQUE CONSTRAINT via ALTER TABLE
-- and also any bare unique index, covering both shapes.
--
-- Idempotent: add column if missing (backfill existing rows to 'Beginner'),
-- drop the 2-column unique (constraint or index), create the 3-column one.
-- No-op if the table is absent or already migrated.
-- ═════════════════════════════════════════════════════════════════════

do $$
declare
  rec record;
begin
  if to_regclass('public.user_daily_progress') is null then
    raise notice 'user_daily_progress does not exist — skipping';
    return;
  end if;

  -- Per-level dimension. Default 'Beginner' backfills every existing row to
  -- the level those learners were on by default, preserving their progress.
  alter table public.user_daily_progress
    add column if not exists level text not null default 'Beginner';

  -- Drop any 2-column UNIQUE CONSTRAINT on exactly (user_id, study_date) —
  -- this is what blocked v1. A constraint owns its index, so ALTER TABLE
  -- DROP CONSTRAINT removes both.
  for rec in
    select con.conname
      from pg_constraint con
     where con.conrelid = 'public.user_daily_progress'::regclass
       and con.contype = 'u'
       and array_length(con.conkey, 1) = 2
       and (select array_agg(a.attname::text order by a.attname)
              from pg_attribute a
             where a.attrelid = con.conrelid and a.attnum = any(con.conkey))
           = array['study_date','user_id']
  loop
    execute 'alter table public.user_daily_progress drop constraint ' || quote_ident(rec.conname);
  end loop;

  -- Drop any remaining 2-column UNIQUE INDEX (not backed by a constraint) on
  -- the same two columns — the shape v1 assumed.
  for rec in
    select c.relname
      from pg_index i
      join pg_class c on c.oid = i.indexrelid
      join pg_class t on t.oid = i.indrelid
     where t.oid = 'public.user_daily_progress'::regclass
       and i.indisunique
       and i.indnatts = 2
       and not exists (select 1 from pg_constraint con where con.conindid = i.indexrelid)
       and (select array_agg(a.attname::text order by a.attname)
              from pg_attribute a
             where a.attrelid = t.oid and a.attnum = any(i.indkey))
           = array['study_date','user_id']
  loop
    execute 'drop index if exists public.' || quote_ident(rec.relname);
  end loop;

  -- New 3-column unique index — the onConflict target for the per-level upsert.
  execute 'create unique index if not exists user_daily_progress_user_study_level_uidx
             on public.user_daily_progress (user_id, study_date, level)';
end
$$;

notify pgrst, 'reload schema';
