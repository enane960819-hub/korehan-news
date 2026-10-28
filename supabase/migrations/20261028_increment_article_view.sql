-- auto-apply
-- increment_article_view was defined in 20260526_audit_6_db_rls_hardening.sql,
-- which predates auto-apply and never ran — the article page's view count
-- call has been a 404, so "Most Read" never moved. Re-create it (only for
-- real articles, so the open RPC can't fill article_views with junk ids).
create or replace function public.increment_article_view(p_article_id text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  if p_article_id is null or length(p_article_id) = 0 or length(p_article_id) > 64 then
    return 0;
  end if;
  if not exists (select 1 from public.articles a where a.id::text = p_article_id) then
    return 0;
  end if;
  insert into public.article_views (article_id, view_count, updated_at)
  values (p_article_id, 1, now())
  on conflict (article_id) do update
    set view_count = public.article_views.view_count + 1,
        updated_at = now()
  returning view_count into v_count;
  return v_count;
end;
$$;
revoke execute on function public.increment_article_view(text) from public;
grant execute on function public.increment_article_view(text) to authenticated, anon;
