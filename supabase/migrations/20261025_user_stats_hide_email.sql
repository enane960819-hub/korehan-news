-- auto-apply
-- user_stats is readable by every signed-in user (leaderboards, friend /
-- profile cards) — and it carries a copy of each user's EMAIL. The
-- 2026-10-25 privacy report confirmed 8/8 rows had it, readable by anyone
-- signed in. Column-level privilege fix: authenticated may SELECT every
-- column EXCEPT email; anon gets no SELECT at all (it had no policy
-- anyway). Admins read emails through kh_admin_user_emails().
-- NOTE: a column added to user_stats later needs its own
--   grant select (new_col) on public.user_stats to authenticated;
-- Idempotent.

revoke select on public.user_stats from anon, authenticated;

do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'user_stats'
     and column_name <> 'email';
  execute format('grant select (%s) on public.user_stats to authenticated', cols);
end $$;
