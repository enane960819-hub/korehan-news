-- auto-apply
-- kh_my_roles(): tells the signed-in browser whether it is an admin and/or
-- a tutor, so the admin / tutor email allow-lists no longer ship in public
-- JavaScript (korehan-shared.js, admin gates, tutor page). The lists stay
-- server-side in is_admin_email() / is_tutor_user(). Client flags only
-- show/hide UI — RLS remains the real enforcement. Idempotent.
create or replace function public.kh_my_roles()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is null
              then jsonb_build_object('admin', false, 'tutor', false)
              else jsonb_build_object('admin', coalesce(public.is_admin_email(), false),
                                      'tutor', coalesce(public.is_tutor_user(), false))
         end;
$$;

revoke execute on function public.kh_my_roles() from public, anon;
grant execute on function public.kh_my_roles() to authenticated;
