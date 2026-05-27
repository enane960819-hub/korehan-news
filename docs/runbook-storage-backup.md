# Storage bucket backup runbook

Closes **DR-F4** from audit 16. `pg_dump` backs up the DB but
NOT the Supabase Storage buckets. If the Supabase project is
deleted or region-outage'd, user-uploaded files are gone.

---

## Buckets in scope

| Bucket | Contents | User-generated? | Reproducible? |
|---|---|---|---|
| `avatars` | User profile pictures | Yes | Re-uploadable but loses history |
| `speaking-recordings` | Korean speech submissions (.webm) | Yes | **NOT reproducible** — biometric PII |
| `article-images` | Admin-uploaded article thumbnails | No | Re-fetchable from source URLs |
| `reporter-images` | Reporter post photos | Yes (admin authored on behalf of reporters) | Hard to reproduce |
| `character-avatars` | Cast / reporter character images | No (admin) | Re-uploadable from source |

`speaking-recordings` is the priority. The others are nice-to-have.

---

## Weekly export (manual, until cron exists)

The `supabase` CLI doesn't have a bulk-download command, so use
`rclone` (open-source, supports S3-compatible APIs which Supabase
Storage speaks).

### One-time setup

```sh
# Install rclone
brew install rclone   # macOS
# or: curl https://rclone.org/install.sh | sudo bash

# Configure a remote pointing at Supabase Storage S3
rclone config
# > New remote → name: korehani-storage
# > Type: s3
# > Provider: Other
# > Access key:   <Supabase S3 access key — Dashboard → Settings → Storage → S3>
# > Secret key:   <Supabase S3 secret key>
# > Region:       <your-region>
# > Endpoint:     https://<ref>.supabase.co/storage/v1/s3
```

### Weekly export

```sh
mkdir -p ./backups/storage-$(date -u +%Y%m%d)
for bucket in avatars speaking-recordings article-images reporter-images character-avatars; do
  rclone copy korehani-storage:$bucket ./backups/storage-$(date -u +%Y%m%d)/$bucket --progress
done
```

Then ship the directory to off-site storage (R2, B2, encrypted
drive — same destinations as the DB dump). Tar + encrypt before
upload if any bucket is private (speaking-recordings is per-user
audio).

### Restore

```sh
# Reverse direction:
rclone copy ./backups/storage-YYYYMMDD/avatars korehani-storage:avatars --progress
```

---

## Future automation (post-CRON-F1)

Once a scheduled-task system exists (currently blocked on CRON-F1
no scheduler), schedule:

```yaml
# .github/workflows/storage-backup.yml — weekly Sunday 02:00 UTC
on:
  schedule:
    - cron: '0 2 * * 0'
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - run: |
          # rclone install + copy + ship to R2
          ...
```

Don't run this from a Supabase Edge Function — Edge Functions
have a 25-minute wall budget that's not designed for bulk
binary copies.

---

## Off-site destinations — pick one

| Service | Cost | Notes |
|---|---|---|
| **Cloudflare R2** | $0.015/GB/mo, no egress | Simplest; same provider as Pages |
| **Backblaze B2** | $0.006/GB/mo | Cheapest; egress to Cloudflare free |
| **AWS S3 Glacier** | $0.004/GB/mo | Cheap but slow restore — last resort |
| **External SSD** | One-time hw cost | Owner-only; useless if owner's house burns |

For KoreHani's scale (likely <10 GB total across all buckets in
year 1), R2 is the safest bet — pay literal pennies/month.

---

## Sanity-check the backup once a quarter

Pick a random file from each bucket, restore it to a different
path, open it. If the avatar JPEG decodes and the .webm audio
plays, the backup is good. Add a line to the restore-drill log.
