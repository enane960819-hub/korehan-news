-- Disk IO budget ran out on Nano (2026-10-29 ~07:40 KST): find what reads
-- the disk most. One JSON result (db-report shows only the last statement).
select json_build_object(
  'top_by_disk_reads', (
    select json_agg(t) from (
      select left(regexp_replace(query, '\s+', ' ', 'g'), 220) as q, calls,
             shared_blks_read as blks_read, shared_blks_hit as blks_hit,
             round(total_exec_time::numeric) as total_ms, round(mean_exec_time::numeric, 1) as mean_ms, rows
      from extensions.pg_stat_statements
      order by shared_blks_read desc limit 15) t),
  'top_by_time', (
    select json_agg(t) from (
      select left(regexp_replace(query, '\s+', ' ', 'g'), 220) as q, calls,
             round(total_exec_time::numeric) as total_ms, round(mean_exec_time::numeric, 1) as mean_ms, shared_blks_read as blks_read
      from extensions.pg_stat_statements
      order by total_exec_time desc limit 15) t),
  'cron_last_24h', (
    select json_agg(t) from (
      select j.jobid, j.jobname, j.schedule, j.active, count(d.*) as runs,
             count(*) filter (where d.status <> 'succeeded') as failed,
             round(avg(extract(epoch from (d.end_time - d.start_time)))::numeric, 2) as avg_s,
             round(max(extract(epoch from (d.end_time - d.start_time)))::numeric, 2) as max_s
      from cron.job j
      left join cron.job_run_details d on d.jobid = j.jobid and d.start_time > now() - interval '24 hours'
      group by j.jobid, j.jobname, j.schedule, j.active
      order by runs desc) t),
  'seq_scan_tables', (
    select json_agg(t) from (
      select relname, seq_scan, seq_tup_read, idx_scan, n_live_tup,
             pg_size_pretty(pg_total_relation_size(relid)) as size
      from pg_stat_user_tables
      order by seq_tup_read desc limit 15) t),
  'biggest_tables', (
    select json_agg(t) from (
      select schemaname || '.' || relname as rel, pg_size_pretty(pg_total_relation_size(relid)) as size, n_live_tup
      from pg_stat_all_tables where schemaname not in ('pg_catalog', 'information_schema', 'pg_toast')
      order by pg_total_relation_size(relid) desc limit 12) t),
  'stats_since', (select stats_reset from pg_stat_database where datname = current_database())
);
