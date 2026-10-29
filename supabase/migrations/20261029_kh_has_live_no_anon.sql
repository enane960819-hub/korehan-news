-- auto-apply
-- Supabase's default privileges grant EXECUTE on new public functions to anon,
-- so `revoke … from public` in 20261029_premium_live.sql left kh_has_live
-- callable by signed-out visitors. Nothing anonymous needs it.
revoke execute on function public.kh_has_live(uuid) from anon;
