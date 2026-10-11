-- Verify Premium/billing + live class + phone-call bucket migrations (read-only).
select json_build_object(
  'sub_columns', (select json_agg(column_name) from information_schema.columns
                   where table_schema='public' and table_name='user_subscriptions'
                     and column_name in ('stripe_customer_id','cancel_at_period_end','trial_used')),
  'tutor_requested_col', (select count(*) from information_schema.columns
                   where table_schema='public' and table_name='user_submissions' and column_name='tutor_requested'),
  'tutor_trigger', (select count(*) from pg_trigger where tgname='user_submissions_tutor_flag'),
  'subscriptions', (select json_agg(json_build_object('plan',plan,'status',status,'provider',payment_provider)) from public.user_subscriptions),
  'live_sessions_upcoming', (select json_agg(json_build_object('title',title,'at',scheduled_at,'has_zoom',zoom_link is not null))
                   from public.weekly_live_sessions where scheduled_at > now() - interval '2 hours'),
  'live_cron', (select json_agg(json_build_object('job',jobname,'schedule',schedule)) from cron.job where jobname='weekly-live-session'),
  'anon_can_read_zoom', has_column_privilege('anon','public.weekly_live_sessions','zoom_link','select'),
  'phone_bucket', (select json_agg(json_build_object('id',id,'public',public)) from storage.buckets where id='phone-calls')
) as report;
