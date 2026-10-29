-- auto-apply
-- Owner's temporary signed-in + Premium preview (preview-login Edge Function).
-- Only the SHA-256 of the link token is stored; the token itself was given
-- to the owner directly. Server-only key: never add it to the client
-- app_settings allow-list. Disable early: delete this row.
insert into public.app_settings (key, value)
values ('preview_login', '{"enabled":true,"email":"enane960819+khpreview@gmail.com","token_sha256":"40df11506026001efab0b8387279ba92e854730be88f1396c1ee3ba2a78ffccf","expires_at":"2026-11-12T05:00:00Z"}')
on conflict (key) do update set value = excluded.value;
