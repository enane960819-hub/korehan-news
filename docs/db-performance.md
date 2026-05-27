# DB performance — monthly review playbook

Closes **PERF-F12** from the 13th audit. Without a documented
review process, slow queries accumulate silently — RLS regressions,
missing indexes from new features, or unbounded reads from new
admin pages don't surface until the first scale event.

This is the **monthly admin checklist**. Open the Supabase
dashboard → Database → Query Performance (Supabase's UI wraps
`pg_stat_statements`).

---

## Monthly slow-query review (≤10 minutes)

### 1. Open the dashboard

`Supabase → Project → Database → Query Performance`

Or run from the SQL editor:

```sql
-- Top 10 by total time spent (cumulative — counts every call)
SELECT
  calls,
  ROUND(total_exec_time::numeric / 1000.0, 2) AS total_sec,
  ROUND(mean_exec_time::numeric, 2) AS mean_ms,
  ROUND(max_exec_time::numeric, 2)  AS max_ms,
  rows / GREATEST(calls, 1)           AS avg_rows_per_call,
  LEFT(query, 200)                    AS query_snippet
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY total_exec_time DESC
LIMIT 10;
```

### 2. For each row in the top 10

Ask:

- **Is mean_ms > 100 and the query is on a hot path (article reads,
  comment reads, profile loads)?** If yes, that's a P1 — find the
  EXPLAIN plan and likely add an index.
- **Is avg_rows_per_call ridiculous (>10k)?** If yes, the caller
  is fetching unbounded — add `.limit()` to the frontend.
- **Is the query a SELECT * on a wide table?** Narrow the column
  list (subject to the PR #526 schema-drift caveat — pair with an
  on-empty fallback to `*`).

### 3. Run `EXPLAIN ANALYZE` on the suspect

```sql
EXPLAIN (ANALYZE, BUFFERS)
  SELECT … the slow query …;
```

What to look for:

- `Seq Scan` on a large table where the WHERE clause obviously
  selects a small subset → **missing index**.
- `Sort` step with `Sort Method: external merge Disk`: query
  exceeded `work_mem`; add an index that matches the ORDER BY
  or narrow the result set.
- `Nested Loop` with high `loops` count on a sub-plan: classic
  N+1; restructure to a single bulk fetch.

### 4. Reset stats after a major change

```sql
SELECT pg_stat_statements_reset();
```

Resets the rolling stats so the impact of a new index becomes
visible on the next month's review.

---

## What's already covered

These have been addressed in past audits — re-confirm but don't
re-fix:

| Audit | What was fixed |
|---|---|
| **PERF-F1/F2** | `user_saved_words`, `xp_log` user_id indexes |
| **PERF-F3** | Shop tables FK indexes (cascade-delete perf) |
| **PERF-F5** | Admin vocab bulk-upsert (was 500 round-trips) |
| **PERF-F6** | Article-cache N+1 (was 80 sequential calls per Learn page) |
| **PERF-F8/F11/F14** | Admin `.limit()` on listing pages |
| **PERF-F11** | `user_stats(xp DESC)` index for leaderboard |

If `pg_stat_statements` shows any of these queries STILL slow
after their fix migration landed, the migration probably wasn't
applied — re-run.

---

## Cost-side review (10 min)

Open the admin **💵 Anthropic Cost Monitor** tab (PERF-F7 / F9 from
audit 13). Steps:

1. Click "Run aggregation now" — populates the last 7 days into
   `claude_cost_daily`.
2. Click "Check budget alert" — sanity-check MTD vs your
   `app_settings.anthropic_monthly_budget_usd` setting (default
   $200 if unset).
3. Skim the "Top features this month" table. If a single feature
   accounts for >50% of spend, decide:
   - Is the feature critical user-facing? (article body, conv_gen
     → keep on Sonnet.)
   - Or admin-only / bulk-generation? (phrase-bulk-pregen,
     slang-bulk-generate → consider Haiku swap — see
     `docs/sonnet-haiku-swap-plan.md`.)
4. If "Last 14 days" shows a sudden spike: the rolling `>3× of
   7-day avg` alert should have already fired into `client_errors`
   with severity `critical`. Investigate the feature key and the
   user-id that caused it (per-user $/mo is in the proxy's existing
   admin tab).

---

## When to ramp this up

The current monthly cadence is appropriate at low-thousand
users. Triggers to switch to **weekly** review:

- DAU >1000
- Anthropic spend >$50/mo
- Any P0 from a future audit related to scale-induced perf

Triggers to install **automated alerting** (post-CRON-F1):

- pg_cron schedules `aggregate_claude_costs_daily()` +
  `check_anthropic_budget_alert()` per the migration header
- Add a similar slow-query alert that runs the top-10 statements
  query nightly and emails the operator if any new entry mean_ms
  > some-threshold

---

## Quick reference

| Concern | First check | Doc |
|---|---|---|
| Slow page load | Browser devtools Network → Supabase URL → time | this file |
| RLS regression | `SELECT * FROM pg_policies WHERE tablename = '...'` | `supabase/migrations/20260526_audit_6_db_rls_hardening.sql` |
| Missing index | `EXPLAIN ANALYZE` shows Seq Scan | this file §3 |
| Anthropic cost spike | Admin 💵 tab → Check budget alert | this file §Cost-side |
| Schema drift | Manual console query returns rows but page shows none | CLAUDE.md "Past Incidents" |
