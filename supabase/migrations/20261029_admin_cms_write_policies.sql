-- auto-apply
-- Admin CMS edits these content tables with the admin's own session
-- (Conversation Cast / Role NPCs / 필수표현 panels). They only had a public
-- read policy ("admin writes via service role"), so every edit from the CMS
-- was refused by RLS. Admin-write like the other content tables
-- (20261012_rls_lockdown.sql). Learners keep read-only access. Idempotent.

do $$
declare t text;
begin
  foreach t in array array['cast_characters', 'role_characters', 'essential_expressions']
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('drop policy if exists %I on public.%I', t || ' admin write', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin_email()) with check (public.is_admin_email())',
                   t || ' admin write', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
