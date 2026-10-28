-- auto-apply
-- Owner: hold the paid backlog review for now. Stop the temporary queue
-- job; the qa_at columns and the re-queue trigger stay, so nothing is lost
-- — content-qa {"only":"queue"} drains the queue whenever it is resumed.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'content-qa-queue-fill') then
    perform cron.unschedule('content-qa-queue-fill');
  end if;
end $$;
