-- auto-apply
-- kh_user_streak (the one streak source) counts daily_missions rows, and that
-- streak now pays: claim_streak_award nyang and the streak unlocks (hanbok,
-- attic, furniture). The browser upserts its own daily_missions row, so it
-- could also write rows for past days and fake a long streak. Browser writes
-- (roles anon / authenticated) may now only touch today's row — "today" in
-- any time zone, i.e. UTC date ±1. Server code (security definer functions,
-- service_role) is unaffected.
create or replace function public.kh_daily_missions_date_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_today date := (now() at time zone 'UTC')::date;
begin
  if current_user in ('anon', 'authenticated') then
    if new.date is null or new.date < v_today - 1 or new.date > v_today + 1 then
      raise exception 'daily_missions: only today''s row can be written' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and old.date < v_today - 1 then
      raise exception 'daily_missions: past days are read-only' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
      raise exception 'daily_missions: user_id is fixed' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists kh_daily_missions_date_guard on public.daily_missions;
create trigger kh_daily_missions_date_guard
  before insert or update on public.daily_missions
  for each row execute function public.kh_daily_missions_date_guard();

-- Deleting old rows can only shorten a streak, but there's no reason for the
-- browser to do it either.
revoke delete on public.daily_missions from anon, authenticated;
