-- Speaking coach retirement check (read-only): exposed recordings in the
-- public avatars bucket, bucket visibility, submissions, coin purchases.
select json_build_object(
  'buckets', (select json_agg(json_build_object('id', id, 'public', public)) from storage.buckets
               where id in ('avatars', 'speaking-recordings')),
  'avatars_speaking_objects', (select count(*) from storage.objects where bucket_id = 'avatars' and name like 'speaking/%'),
  'avatars_speaking_sample', (select json_agg(name) from (select name from storage.objects
               where bucket_id = 'avatars' and name like 'speaking/%' order by created_at desc limit 5) x),
  'speaking_recordings_objects', (select count(*) from storage.objects where bucket_id = 'speaking-recordings'),
  'submissions_by_type', (select json_object_agg(content_type, n) from (
      select content_type, count(*) n from public.user_submissions group by 1) x),
  'coach_review_rows', (select count(*) from public.user_submissions where coalesce((to_jsonb(user_submissions)->>'speaking_coach_review')::boolean, false)),
  'coin_purchases', (select count(*) from public.speaking_coin_purchases),
  'coin_wallets_with_balance', (select count(*) from public.user_speaking_coins where coins_remaining > 0)
) as report;
