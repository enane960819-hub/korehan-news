-- auto-apply
-- Read-only probe: POST with NO credentials to claude-proxy and admin-api.
-- Gateway JWT check on → gateway answers {"message":"Missing authorization header"};
-- off → the function itself answers {"error":"No auth..."}. Tells us the live
-- setting before an auto-redeploy. Report: reports/2026-10-12_edge_gateway_probe.sql
insert into public.app_settings (key, value)
select 'edge_gateway_probe', json_build_object(
  'claude-proxy', net.http_post(url := 'https://samghztrdvtxmrmawneu.supabase.co/functions/v1/claude-proxy',
                    headers := '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb),
  'admin-api',    net.http_post(url := 'https://samghztrdvtxmrmawneu.supabase.co/functions/v1/admin-api',
                    headers := '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb))::text
on conflict (key) do update set value = excluded.value;
