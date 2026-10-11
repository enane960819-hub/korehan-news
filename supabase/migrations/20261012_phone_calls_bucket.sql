-- auto-apply
-- Public storage bucket for AI-generated Phone Call audio (phone-call-gen).
-- Reads are public (lesson audio); writes are service-role only. Idempotent.
insert into storage.buckets (id, name, public)
values ('phone-calls', 'phone-calls', true)
on conflict (id) do update set public = true;
