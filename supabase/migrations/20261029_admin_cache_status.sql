-- auto-apply
-- Admin CMS "AI Cache Management" used to download every article_cache row
-- (select=*) and every article_study_content blob just to draw ✓/✗ badges.
-- This returns only presence flags and counts, computed server-side. The
-- page falls back to a paged slim read when this function is missing.
-- Read-only, admin only. Idempotent.

create or replace function public.kh_try_jsonb(p text)
returns jsonb
language plpgsql
immutable
as $$
begin
  return p::jsonb;
exception when others then
  return null;
end;
$$;

create or replace function public.kh_admin_cache_status()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cache json := '[]'::json;
  v_study json := '[]'::json;
begin
  if not public.is_admin_email() then
    raise exception 'admin only';
  end if;

  -- article_cache (wide layout: article_id + one column per slot). to_jsonb
  -- keeps this working whether a slot column is text or jsonb, or missing.
  if to_regclass('public.article_cache') is not null then
    select coalesce(json_agg(json_build_object(
             'id', x.id,
             't',  x.t is not null and x.t <> '',
             'v',  coalesce(x.j ->> 'vocab', '') <> '',
             'g',  coalesce(x.j ->> 'grammar', '') <> '',
             'q',  coalesce(x.j ->> 'quiz', '') <> '',
             'e',  coalesce(x.j ->> 'expressions', '') <> '',
             'sn', case when jsonb_typeof(x.tj -> 'sentences') = 'array' then jsonb_array_length(x.tj -> 'sentences') else 0 end,
             'sv', case when jsonb_typeof(x.tj -> 'sentences') = 'array' and jsonb_array_length(x.tj -> 'sentences') > 0
                        then coalesce(x.tj ->> 'version', 'older') end,
             'en', case when jsonb_typeof(x.ej) = 'array' then jsonb_array_length(x.ej) else 0 end
           )), '[]'::json)
      into v_cache
      from (
        select j ->> 'article_id' as id,
               j ->> 'translation' as t,
               j,
               public.kh_try_jsonb(j ->> 'translation') as tj,
               public.kh_try_jsonb(j ->> 'expressions') as ej
          from (select to_jsonb(c) as j from public.article_cache c) a
         where j ? 'article_id'
      ) x
     where x.id is not null;
  end if;

  if to_regclass('public.article_study_content') is not null then
    select coalesce(json_agg(json_build_object(
             'id', j ->> 'article_id',
             'vn', case when jsonb_typeof(j -> 'vocab') = 'array' then jsonb_array_length(j -> 'vocab') else 0 end,
             'pn', case when jsonb_typeof(j -> 'phrases') = 'array' then jsonb_array_length(j -> 'phrases') else 0 end,
             'wn', case when jsonb_typeof(j -> 'wrong_phrases') = 'array' then jsonb_array_length(j -> 'wrong_phrases') else 0 end,
             'qn', case when jsonb_typeof(j -> 'questions') = 'array' then jsonb_array_length(j -> 'questions') else 0 end,
             'pv', j ->> 'prompt_version',
             'ae', coalesce((j ->> 'admin_edited')::boolean, false)
           )), '[]'::json)
      into v_study
      from (select to_jsonb(s) as j from public.article_study_content s) a;
  end if;

  return json_build_object('cache', v_cache, 'study', v_study);
end;
$$;

revoke all on function public.kh_admin_cache_status() from public, anon;
grant execute on function public.kh_admin_cache_status() to authenticated;
