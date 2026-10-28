-- Write policies on tables the browser still writes that aren't per-user (read-only).
select tablename, policyname, cmd, roles::text, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('app_settings','shop_items','weekly_live_sessions','weekly_live_registrations','reporter_posts','reporter_post_images','daily_missions','payment_orders','shop_purchases')
  and cmd <> 'SELECT'
order by tablename, cmd, policyname;
