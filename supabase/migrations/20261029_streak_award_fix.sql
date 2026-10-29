-- auto-apply
-- claim_streak_award never worked: the live function wrote notification kind
-- 'streak_award', which notifications_kind_check rejects, so the whole call
-- rolled back (0 freezes ever awarded; every signed-in page logged a 400).
-- Same logic as the live function (profiles.last_award_streak, inventory
-- capped at 3), but it writes 'streak_freeze_awarded' with the payload the
-- bell renders ({granted, streak, remaining}). Also: once a streak breaks,
-- the next 3-day run earns again instead of waiting to beat the old record.
create or replace function public.claim_streak_award(p_streak integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid       uuid := auth.uid();
  v_prev_high int  := 0;
  v_count     int  := 0;
  v_awarded   int  := 0;
  v_left      int  := 0;
begin
  if v_uid is null then
    return jsonb_build_object('awarded', 0, 'error', 'not_signed_in');
  end if;
  if p_streak is null or p_streak < 3 then
    return jsonb_build_object('awarded', 0);
  end if;

  select coalesce(last_award_streak, 0), coalesce(freeze_count, 0)
    into v_prev_high, v_count
    from public.profiles where id = v_uid for update;
  if not found then
    return jsonb_build_object('awarded', 0);
  end if;

  -- A new, shorter run than the one we last paid for = the streak broke.
  if p_streak < v_prev_high then v_prev_high := 0; end if;

  v_awarded := greatest(0, (p_streak / 3) - (v_prev_high / 3));
  if v_awarded = 0 then
    return jsonb_build_object('awarded', 0, 'streak', p_streak);
  end if;

  v_left := least(v_count + v_awarded, 3);
  update public.profiles
     set freeze_count      = v_left,
         last_award_streak = p_streak
   where id = v_uid;

  -- Only tell the learner when the inventory actually grew.
  if v_left > v_count then
    insert into public.notifications (user_id, kind, payload)
    values (v_uid, 'streak_freeze_awarded',
            jsonb_build_object('granted', v_left - v_count, 'streak', p_streak, 'remaining', v_left));
  end if;

  return jsonb_build_object('awarded', v_left - v_count, 'streak', p_streak, 'remaining', v_left);
end;
$function$;
grant execute on function public.claim_streak_award(integer) to authenticated;
