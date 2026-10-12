-- auto-apply
-- C11: story covers / page illustrations (story-illustrate edge function,
-- service role uploads). Public read so story cards can show them.
insert into storage.buckets (id, name, public)
values ('story-illustrations', 'story-illustrations', true)
on conflict (id) do update set public = true;
