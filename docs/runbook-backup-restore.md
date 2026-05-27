# Backup + restore runbook

Closes **DR-F1** from audit 16. Operator-facing reference for
backing up the Supabase project and restoring on disaster.

---

## Current backup posture

**Supabase tier defaults:**

| Tier | Auto-backup | Retention | PITR (point-in-time) |
|---|---|---|---|
| Free | Daily | 7 days | ❌ |
| Pro | Daily | 14 days | ✅ (last 7 days) |

> **TODO (owner):** confirm which tier KoreHani is on. If Free
> and any paying customers exist (or if you'd care about losing
> >24h of comments / submissions), upgrade to Pro before reading
> the rest of this document. The $25/mo Pro tier buys you PITR
> which means "rewind to 5 minutes ago" — invaluable when
> someone runs the wrong DELETE.

---

## Manual `pg_dump` backup

For weekly snapshots stored OUTSIDE Supabase (cross-region disaster
or accidental project delete).

1. Get the connection string from Supabase dashboard →
   Project Settings → Database → Connection string.
   Format:
   ```
   postgresql://postgres.<ref>:<password>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
   ```
   Use the **session** pooler, not transaction — `pg_dump` opens
   a long-lived connection.

2. Run on a local machine with the password in env:

   ```sh
   export SUPABASE_DB_URL='postgresql://postgres...'
   pg_dump "$SUPABASE_DB_URL" \
     --format=custom \
     --no-owner \
     --no-acl \
     --file="korehani-$(date -u +%Y%m%d-%H%M).dump"
   ```

   The `-Fc` (custom format) lets you do selective restores later
   with `pg_restore --table` etc.

3. Copy the dump file to off-site storage. Options:
   - **Cloudflare R2** (cheap, simple): `wrangler r2 object put …`
   - **Backblaze B2**: `b2 file upload …`
   - Owner's encrypted external drive (last resort).

4. Verify the dump is readable:
   ```sh
   pg_restore --list korehani-YYYYMMDD-HHMM.dump | head -20
   ```
   Should print a list of objects (tables, indexes, functions).
   Empty output = corrupt dump, retry.

> **Test once a quarter.** A backup you've never restored isn't
> a backup. See "Restore drill" below.

---

## Restore drill (do this once a quarter)

The goal: prove a fresh Supabase project can be brought from
zero to "looks like prod" in <30 minutes.

1. **Create a scratch Supabase project.** Free tier; name it
   `korehani-restore-drill-YYYYMM`.

2. **Pull the latest dump** from your off-site backup (or use the
   Supabase auto-backup download from the dashboard).

3. **Restore:**

   ```sh
   export RESTORE_DB_URL='postgresql://postgres...<scratch-ref>...'
   pg_restore -d "$RESTORE_DB_URL" \
     --no-owner \
     --no-acl \
     --clean --if-exists \
     korehani-YYYYMMDD-HHMM.dump
   ```

4. **Sanity check:** open the SQL editor on the scratch project and
   run:
   ```sql
   SELECT relname, n_live_tup
   FROM pg_stat_user_tables
   ORDER BY n_live_tup DESC LIMIT 20;
   ```
   Row counts should approximately match prod.

5. **Stretch test:** point a local frontend `getSupa()` call at
   the scratch project (change `SUPA_URL` + `SUPA_KEY` in
   `korehan-shared.js` temporarily). Verify the home rail loads.

6. **Cleanup:** delete the scratch project. Note the start-to-
   finish time in `docs/runbook-backup-restore.md` change log
   below so you can track if it's drifting upward (= you've added
   complexity faster than you've documented it).

---

## Restore-from-PITR (Pro tier only)

If something deleted critical rows in the last 7 days:

1. Supabase dashboard → Database → Backups → Point-in-time.
2. Pick a timestamp BEFORE the bad event.
3. **Restore to a new project** (PITR restores can't overlay the
   live project directly).
4. From the restored scratch project, `pg_dump --data-only --table=<X>`
   the affected table.
5. Apply that dump to the live project.

For row-level recovery (not whole-table), use `pg_dump --data-only
--table=articles_data -W` then a manual `psql` INSERT.

---

## Restore-from-Supabase-auto-backup (Free or Pro)

Dashboard → Database → Backups → click any daily backup →
"Restore". Restores into a new project (not in-place).

---

## What's NOT backed up by pg_dump

- **Storage bucket contents** (avatars, speaking-recordings,
  article-images, reporter-images). See
  `docs/runbook-storage-backup.md`.
- **Edge Function secrets** (`ANTHROPIC_KEY`, etc.). See
  `docs/secrets-inventory.md`.
- **Edge Function code** — that's in git, not the DB. Re-deploy
  via `supabase functions deploy`.
- **Auth user list** — `auth.users` IS in pg_dump (along with
  password hashes). Be careful where the dump file lives.

---

## Change log

| Date | Drill duration | Notes |
|---|---|---|
| (none yet) | | First drill TBD by owner |
