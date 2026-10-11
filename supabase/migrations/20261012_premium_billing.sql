-- auto-apply
-- ═════════════════════════════════════════════════════════════════════
-- Premium plan + Stripe subscriptions + Premium-only tutor review
-- ═════════════════════════════════════════════════════════════════════
-- Plans are now Free / Premium. Legacy 'standard' / 'pro' rows count as
-- Premium (kh_is_premium). The billing Edge Functions keep
-- user_subscriptions in sync with Stripe (plan='premium', expires_at =
-- current period end). Writing feedback: everyone gets AI feedback right
-- away; only Premium submissions (weekly writing package) go to the
-- tutor queue — decided server-side by a trigger so a client can't
-- request a tutor review it hasn't paid for. Idempotent.

alter table public.user_subscriptions
  add column if not exists stripe_customer_id   text,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists trial_used           boolean not null default false;
create index if not exists user_subscriptions_stripe_customer_idx
  on public.user_subscriptions (stripe_customer_id);

create or replace function public.kh_is_premium(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_subscriptions
     where user_id = p_user
       and status = 'active'
       and plan in ('premium', 'standard', 'pro')
       and (expires_at is null or expires_at > now())
  );
$$;
revoke execute on function public.kh_is_premium(uuid) from public;
grant  execute on function public.kh_is_premium(uuid) to authenticated, service_role;

alter table public.user_submissions
  add column if not exists tutor_requested boolean not null default false;
create index if not exists user_submissions_tutor_queue_idx
  on public.user_submissions (tutor_requested, status, submitted_at desc);

-- Client writes can't set tutor_requested; it is derived from the plan
-- for the weekly writing package. Service role (admin / Edge Functions)
-- may change it freely.
create or replace function public.kh_user_submissions_tutor_flag()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.tutor_requested := old.tutor_requested
      or (new.content_type in ('daily_package', 'writing') and public.kh_is_premium(new.user_id));
  else
    new.tutor_requested := new.content_type in ('daily_package', 'writing') and public.kh_is_premium(new.user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists user_submissions_tutor_flag on public.user_submissions;
create trigger user_submissions_tutor_flag
  before insert or update on public.user_submissions
  for each row execute function public.kh_user_submissions_tutor_flag();
