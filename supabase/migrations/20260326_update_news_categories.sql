-- Replace tech category with beauty/travel and migrate legacy data.

-- 1) Existing articles using tech -> beauty (safe default)
update public.articles
set section = 'beauty'
where lower(coalesce(section, '')) in ('tech', 'it과학', 'technology', 'tech/science');

-- 2) Ensure sections table has new categories
insert into public.sections (key, label, icon, sort_order, active)
values
  ('beauty', 'Beauty', '💄', 8, true),
  ('travel', 'Travel', '✈️', 9, true)
on conflict (key) do update
set
  label = excluded.label,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  active = true;

-- 3) Remove legacy tech section if it exists
update public.sections
set active = false
where lower(coalesce(key, '')) in ('tech', 'it과학', 'technology', 'tech/science');
