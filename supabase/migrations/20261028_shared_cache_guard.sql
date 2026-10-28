-- auto-apply
-- Shared AI caches: learners' devices still fill them (that is how one AI
-- call is reused by everyone), but
--   1. article_study_content: learners can no longer DELETE rows or touch an
--      admin-edited row (asc_auth_write was FOR ALL to any signed-in user);
--   2. every learner write is stamped with who wrote it, so a vandalised or
--      broken row can be traced and reverted (service-role writes such as
--      content-qa keep the previous stamp, so the review queue isn't re-fired);
--   3. one learner write can't exceed 1 MB.
-- Moving generation itself server-side stays on the fix list (P1).
-- Idempotent.

-- ── 1. article_study_content policies ────────────────────────────────
drop policy if exists asc_auth_write  on public.article_study_content;
drop policy if exists asc_auth_insert on public.article_study_content;
drop policy if exists asc_auth_update on public.article_study_content;
drop policy if exists asc_admin_delete on public.article_study_content;
create policy asc_auth_insert on public.article_study_content
  for insert to authenticated
  with check (coalesce(admin_edited, false) = false or public.is_admin_email());
create policy asc_auth_update on public.article_study_content
  for update to authenticated
  using (coalesce(admin_edited, false) = false or public.is_admin_email())
  with check (coalesce(admin_edited, false) = false or public.is_admin_email());
create policy asc_admin_delete on public.article_study_content
  for delete to authenticated
  using (public.is_admin_email());

-- ── 2 + 3. writer stamp and size cap ─────────────────────────────────
alter table public.article_cache          add column if not exists written_by uuid;
alter table public.article_study_content  add column if not exists written_by uuid;
alter table public.grammar_examples_cache add column if not exists written_by uuid;

create or replace function public.kh_cache_stamp_writer()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    -- service role / cron: keep whoever wrote the content
    if tg_op = 'UPDATE' then new.written_by := old.written_by; end if;
    return new;
  end if;
  if not public.is_admin_email() and octet_length(to_jsonb(new)::text) > 1048576 then
    raise exception 'cache row too large' using errcode = '22001';
  end if;
  new.written_by := auth.uid();
  return new;
end;
$$;

-- Named kh_cache_* so it runs before kh_requeue_* (triggers fire by name).
drop trigger if exists kh_cache_stamp_article_cache on public.article_cache;
create trigger kh_cache_stamp_article_cache before insert or update on public.article_cache
  for each row execute function public.kh_cache_stamp_writer();
drop trigger if exists kh_cache_stamp_asc on public.article_study_content;
create trigger kh_cache_stamp_asc before insert or update on public.article_study_content
  for each row execute function public.kh_cache_stamp_writer();
drop trigger if exists kh_cache_stamp_gec on public.grammar_examples_cache;
create trigger kh_cache_stamp_gec before insert or update on public.grammar_examples_cache
  for each row execute function public.kh_cache_stamp_writer();
