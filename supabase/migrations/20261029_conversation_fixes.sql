-- auto-apply
-- 2026-10-29 sweep: three conversations with broken data.
--  49: speakers were literally "A" / "B" (title is 수진 & 민호; A says 민호야).
--   8: the price came after the receipt question; English role names gave
--      both avatars the same "C" initial.
--  72: 계란후라이 → standard spelling 계란프라이.
-- Each update checks the old value, so re-running changes nothing. The
-- data column's type (json / jsonb / text) is read at run time and every
-- new value is cast to it explicitly.
do $$
declare
  t text;
begin
  select case data_type when 'jsonb' then 'jsonb' when 'json' then 'json' else 'text' end
    into t
    from information_schema.columns
   where table_schema = 'public' and table_name = 'conversations_data' and column_name = 'data';
  if t is null then return; end if;

  execute format($q$
    update public.conversations_data c
       set data = (jsonb_set(c.data::text::jsonb, '{msgs}', (
             select jsonb_agg(case m->>'who'
                                when 'A' then jsonb_set(m, '{who}', '"수진"')
                                when 'B' then jsonb_set(m, '{who}', '"민호"')
                                else m end order by ord)
               from jsonb_array_elements(c.data::text::jsonb->'msgs') with ordinality as x(m, ord))))::text::%1$s
     where c.id = 49
       and exists (select 1 from jsonb_array_elements(c.data::text::jsonb->'msgs') m where m->>'who' in ('A', 'B'))
  $q$, t);

  execute format($q$
    update public.conversations_data c
       set data = (jsonb_set(c.data::text::jsonb, '{msgs}', %2$L::jsonb))::text::%1$s
     where c.id = 8
       and c.data::text::jsonb->'msgs'->0->>'who' = 'Cashier'
  $q$, t, '[
     {"s":"l","who":"점원","txt":"3,500원입니다. 봉투 필요하세요?","en":"That will be 3,500 won. Do you need a bag?"},
     {"s":"r","who":"손님","txt":"아니요, 괜찮아요. 카드로 계산할게요.","en":"No, I''m fine. I''ll pay by card."},
     {"s":"l","who":"점원","txt":"영수증 드릴까요?","en":"Would you like the receipt?"},
     {"s":"r","who":"손님","txt":"아니요, 됐어요.","en":"No, that''s okay."},
     {"s":"l","who":"점원","txt":"감사합니다. 안녕히 가세요.","en":"Thank you. Have a good day."}
   ]');

  execute format($q$
    update public.conversations_data
       set data = replace(data::text, '계란후라이', '계란프라이')::%1$s
     where id = 72 and data::text like '%%계란후라이%%'
  $q$, t);
end $$;
