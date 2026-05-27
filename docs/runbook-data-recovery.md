# Data-recovery runbook

Closes **DR-F10** from audit 16. Playbook for the "someone ran the
wrong DELETE" / "user lost their data" class of incident. Three
named scenarios — pick the one that matches, follow the steps.

> **First rule of data recovery:** stop writing. Every additional
> write to the affected table reduces what PITR can rewind. If you
> know which feature triggered the loss, disable it (toggle the
> Edge Function off via `supabase functions delete` if drastic) or
> roll back the bad deploy before continuing.

---

## Scenario A — Single user lost their own data

**Examples:** user accidentally clicked "Delete account" and now
wants their saved words back; user's avatar / speaking recording
went missing.

### A.1 — Account deletion regret

`delete-account` Edge Function hard-deletes the auth user, which
cascades through `user_saved_words`, `user_read_history`, etc. via
FK + RLS owner-only deletes. The rows are GONE from the live DB
the moment the request returned 200.

**Recovery path:** PITR (Pro tier only).

1. Confirm the deletion timestamp from the user (rough is fine —
   PITR is per-minute granularity).
2. Supabase Dashboard → Database → Backups → Point-in-time →
   pick a timestamp 1–2 minutes BEFORE the deletion.
3. Restore to a **new** scratch project (PITR can't overlay live).
4. From the scratch project, dump just that user's data:
   ```sh
   pg_dump "$SCRATCH_DB_URL" \
     --data-only \
     --table=user_saved_words \
     --table=user_read_history \
     --table=user_daily_progress \
     --table=user_quiz_results \
     -W > recover-<email>.sql
   ```
   You'll have to manually filter to only that user's rows (grep
   on user_id once you find it in the scratch project's
   `auth.users`).
5. The user's `auth.users.id` (UUID) will be DIFFERENT after
   re-signup. Don't blindly INSERT — rewrite the user_id column
   in the dump first:
   ```sh
   sed -i "s/<old-uuid>/<new-uuid>/g" recover-<email>.sql
   ```
6. Apply to live: `psql "$LIVE_DB_URL" < recover-<email>.sql`.
7. Tell the user to re-upload their avatar — storage isn't in
   PITR.

**If on Free tier (no PITR):** the daily auto-backup is the
furthest you can rewind. If the deletion was today and the daily
backup hasn't run yet, the data is unrecoverable. This is the
strongest argument for upgrading to Pro.

### A.2 — Storage object missing

Bucket files (avatar JPEG, speaking-recordings .webm) are NOT in
`pg_dump` or PITR. They live in Supabase Storage.

1. Check `docs/runbook-storage-backup.md` weekly backup —
   `./backups/storage-YYYYMMDD/<bucket>/<filename>`.
2. If the weekly backup has it: `rclone copy` it back into the
   bucket (see storage-backup runbook).
3. If the weekly backup doesn't have it (object was created and
   deleted within the same week): unrecoverable. Apologize.

---

## Scenario B — Bulk data loss (admin ran a bad UPDATE / DELETE)

**Examples:** admin SQL editor session ran
`DELETE FROM articles_data WHERE status='draft'` without the
intended `AND created_at < '2024-01-01'`, wiping 200 live drafts.

### Stop the bleeding first

1. **Disable any cron / Edge Function that writes to the table.**
   `daily-content-gen` writes to `articles_data` daily at ~03:00 KST
   — if you delay recovery past that hour, the cron will partially
   re-fill the table with NEW articles, complicating the rewind.
   Either: pause the cron (Supabase dashboard → Functions →
   Schedule → toggle off), or delete the function temporarily, or
   accept that you'll need to manually deconflict.

### Recovery (Pro tier — PITR)

1. PITR-restore to a scratch project at the timestamp BEFORE the
   bad statement.
2. Dump JUST the affected rows:
   ```sh
   pg_dump "$SCRATCH_DB_URL" \
     --data-only \
     --table=articles_data \
     > recover-articles.sql
   ```
3. **Don't blindly apply** — the file is a full table dump with
   COPY statements. You want to MERGE, not replace. Two options:
   - **Easy:** create a `recovery_articles` table on live with the
     same schema, load the dump there, then `INSERT … SELECT … ON
     CONFLICT DO NOTHING` from `recovery_articles` to `articles_data`.
   - **Surgical:** edit the dump file in a text editor and keep
     only the COPY rows you actually want.

### Recovery (Free tier — daily auto-backup only)

1. Dashboard → Database → Backups → click the most recent
   pre-incident daily → "Restore to new project".
2. Follow the dump-and-merge pattern above from the restored
   scratch project.
3. You will lose any LEGITIMATE writes that happened between the
   daily-backup time and the bad DELETE. Document those for
   manual re-entry (e.g. from `client_errors` activity, or by
   asking users).

---

## Scenario C — Logical corruption (data is "there" but wrong)

**Examples:** a migration that was supposed to update
`articles_data.section` from `'news'` → `'breaking'` actually
nulled half the column; a buggy `update_user_streak()` RPC
incremented streaks by 100 for everyone overnight.

### Diagnosis first — don't rewind blindly

1. Identify the affected column / scope:
   ```sql
   -- How many rows look wrong vs total
   SELECT count(*) FILTER (WHERE section IS NULL) AS bad,
          count(*) AS total
   FROM articles_data;
   ```
2. Identify when corruption started. Check `client_errors`
   timestamps, function logs, or `pg_stat_user_tables.last_*`
   columns.

### Recovery

1. PITR-restore to scratch project at the pre-corruption timestamp.
2. Pull the GOOD values for the affected column only:
   ```sh
   psql "$SCRATCH_DB_URL" -c "\copy (SELECT id, section FROM articles_data) TO 'good-sections.csv' WITH CSV HEADER"
   ```
3. Apply to live with a JOIN-update:
   ```sql
   CREATE TEMP TABLE recovery_sections (id uuid, section text);
   \copy recovery_sections FROM 'good-sections.csv' WITH CSV HEADER

   UPDATE articles_data a
   SET section = r.section
   FROM recovery_sections r
   WHERE a.id = r.id
     AND a.section IS DISTINCT FROM r.section;
   ```
4. Spot-check a few rows manually before considering it done.

---

## Always do after any recovery

1. **Log the incident** in `docs/incidents/YYYY-MM-DD-<title>.md`
   per the incident-response runbook template.
2. **Add a guardrail:**
   - Bulk admin DELETE → add a `BEFORE DELETE` trigger that
     refuses if `count > N` rows (N=50 or so) without a `SET
     LOCAL allow_bulk_delete = on` first.
   - Bad migration → add a `BEGIN; … ROLLBACK;` dry-run convention
     to migration-review process.
   - Bad function logic → add a unit-test-style smoke check that
     runs the function against synthetic data in a transaction
     before deploy.
3. **Verify the backup pipeline is still healthy** — if you had
   to use PITR, check that the daily off-site `pg_dump` is still
   running and recent.

---

## Things you CAN'T recover

- **Soft-deleted rows past their retention sweep.** Once
  `kh_purge_soft_deleted_comments()` (or similar) runs, the row
  is gone for good unless captured in a backup. Default retention
  is 30 days from soft-delete.
- **Storage objects deleted between weekly storage backups.**
- **Anything in `auth.users` deleted on Free tier > 7 days ago.**

If a user asks for data that falls in these categories, the
honest answer is "we can't get that back, and here's what we're
changing so it doesn't happen to the next person."
