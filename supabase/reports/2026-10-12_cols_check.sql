-- Read-only: column names/types for tables the RLS lockdown touches.
select json_object_agg(table_name, cols) as report from (
  select table_name, json_agg(column_name || ':' || data_type order by ordinal_position) cols
    from information_schema.columns
   where table_schema='public' and table_name in ('user_saved_words','user_topic_history','xp_log','article_study_submissions','newsletter_subs','page_views')
   group by table_name) x;
