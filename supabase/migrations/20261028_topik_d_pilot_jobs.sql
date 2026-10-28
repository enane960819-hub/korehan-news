-- auto-apply
-- Pilot batch: one generated test per section to validate the topik-gen
-- pipeline before the admin queues more from the TOPIK page. Only inserts
-- when no generation job exists yet (idempotent).
insert into public.topik_gen_jobs (level, section)
select v.level, v.section from (values ('I', 'reading'), ('I', 'listening'), ('II', 'reading'), ('II', 'listening')) as v(level, section)
where not exists (select 1 from public.topik_gen_jobs);
