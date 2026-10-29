-- auto-apply
-- 2026-10-29 conversation review leftovers: wrong English scene labels (#16
-- is a friend, not a coworker; #59 is a couple photo, not an engagement),
-- "Norebang" → "Noraebang" (#9), one emoji in #2's text, and #52's mother
-- jumping between the left and right side of the chat (from 민수's view:
-- 민수 on the right, parents on the left). Each change checks the old value;
-- the data column's type (json / jsonb / text) is read at run time.
update public.conversations_data set name = 'After Noraebang' where id = 9 and name = 'After Norebang';
update public.conversations_data set ctx_en = 'Checking In On a Sick Friend' where id = 16 and ctx_en = 'Friend Checking In On Sick Coworker';
update public.conversations_data set ctx_en = 'A Friend''s Surprise Couple Photo on Instagram' where id = 59 and ctx_en = 'Surprise Engagement Announcement Online';
do $$
declare
  t text;
begin
  select case data_type when 'jsonb' then 'jsonb' when 'json' then 'json' else 'text' end
    into t from information_schema.columns
   where table_schema = 'public' and table_name = 'conversations_data' and column_name = 'data';
  if t is null then return; end if;

  execute format($q$
    update public.conversations_data
       set data = replace(data::text, ' 👍', '')::%1$s
     where id = 2 and data::text like '%%👍%%'
  $q$, t);

  execute format($q$
    update public.conversations_data c
       set data = (jsonb_set(c.data::text::jsonb, '{msgs}', (
             select jsonb_agg(jsonb_set(m, '{s}', to_jsonb(case when m->>'who' = '민수' then 'r' else 'l' end)) order by ord)
               from jsonb_array_elements(c.data::text::jsonb->'msgs') with ordinality as x(m, ord))))::text::%1$s
     where c.id = 52
       and exists (select 1 from jsonb_array_elements(c.data::text::jsonb->'msgs') m
                    where (m->>'who' = '민수') <> (m->>'s' = 'r'))
  $q$, t);
end $$;
