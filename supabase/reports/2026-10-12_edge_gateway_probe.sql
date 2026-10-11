-- Live gateway JWT setting of claude-proxy / admin-api (read-only), from the
-- credential-less probe in migrations/20261012_edge_gateway_probe.sql.
-- "Missing authorization header" = gateway check ON; function's own error = OFF.
select json_object_agg(j.k, json_build_object('status', r.status_code, 'body', left(r.content, 200))) as report
from public.app_settings a
cross join lateral json_each_text(a.value::json) j(k, v)
left join net._http_response r on r.id = j.v::bigint
where a.key = 'edge_gateway_probe';
