-- auto-apply
-- Owner's temporary signed-in + Premium preview (preview-login Edge Function).
-- Only the SHA-256 of the link token is stored. The owner asked for a short
-- token they can type from memory (korehani.com/?p=…) and accepts the
-- guessing risk. Server-only key: never add it to the client app_settings
-- allow-list. Disable early: delete this row.
insert into public.app_settings (key, value)
values ('preview_login', '{"enabled":true,"email":"enane960819+khpreview@gmail.com","token_sha256":"3dbbf4e0eab82af901c49df956bc486ea4abab8668a4baf920189a6b655b5c0b","expires_at":"2026-11-12T05:00:00Z"}')
on conflict (key) do update set value = excluded.value;
