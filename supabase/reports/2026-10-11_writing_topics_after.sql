-- After topic refresh: active / inactive per level and runway from the 2026-10-12 epoch (read-only).
select level,
       count(*) filter (where active) as active,
       count(*) filter (where not active) as inactive,
       count(*) filter (where active and created_at > now() - interval '1 hour') as added_now
  from public.writing_topics group by level order by level;
