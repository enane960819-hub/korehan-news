-- auto-apply
-- Admin-only: user emails for the admin user list. Emails are being
-- removed from client-readable user_stats columns (privacy fix), so the
-- admin page reads them through this definer function instead. Idempotent.
create or replace function public.kh_admin_user_emails()
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path = public
as $$
  select s.user_id, s.email from public.user_stats s where public.is_admin_email();
$$;

revoke execute on function public.kh_admin_user_emails() from public, anon;
grant execute on function public.kh_admin_user_emails() to authenticated;
