# Runbook: Backup and Restore — LabKom Production

This runbook is for the campus-deployed LabKom server (Docker Compose stack with `postgres`, `redis`, `backend`, `frontend`, `nginx`).

## Inventory of state to back up

| Source | Where it lives | Why it matters |
|---|---|---|
| Postgres database | `postgres` container, volume `postgres_data` | All transactional data: users, schedules, logbooks, tickets, missions, points, notifications, agent metadata. |
| Uploads (avatars, evidence photos, condition photos) | Host bind mount `/mnt/data/apps/labkom-apps/uploads` (mapped to `/app/uploads` in backend) | Files referenced by tickets/logbook/conditions. Lost uploads = broken UI links. |
| Redis cache | volume `redis_data` | Session/cache only. Safe to drop, not safe to corrupt during pg restore. |
| TLS certs and `nginx.conf` | `./ssl/` and `./nginx.conf` | Needed to bring nginx back up. |
| `.env.backend` and `.env.frontend` | `/srv/apps/labkom-apps/deploy/` on the runner host | Secrets and connection strings. |

## Daily database backup

The version-controlled script is:

```text
/srv/apps/labkom-apps/repo/deploy/scripts/backup-labkom.py
```

It creates a PostgreSQL custom-format dump under `/mnt/data/backups/labkom`, verifies it with `pg_restore --list`, sets mode `600`, and only then atomically promotes the `.partial` file. It does not delete old backups.

Run and report a manual backup:

```bash
python3 /srv/apps/labkom-apps/repo/deploy/scripts/backup-labkom.py --report
```

Host user cron runs it every day at 02:10 WIB:

```cron
10 2 * * * /usr/bin/python3 /srv/apps/labkom-apps/repo/deploy/scripts/backup-labkom.py >/dev/null 2>>/mnt/data/backups/labkom/backup-error.log
```

Uploads are not yet part of the automated job. Add a filesystem snapshot and off-host target only after retention and remote-storage policy are explicitly approved; do not silently delete historical evidence.

## Off-host copy

The local backup is not a real backup until it is also somewhere else. Copy daily to off-host storage. Pick one of:

- `rclone copy /srv/apps/labkom-apps/backups remote:labkom-backups --transfers 4` — Cloudflare R2 / Google Drive / Backblaze B2.
- `aws s3 sync /srv/apps/labkom-apps/backups s3://labkom-backups/` — S3 with lifecycle to Glacier.

Document the `rclone.conf` location and credentials owner in your team handover.

## Restore drill (quarterly)

Run a real restore at least once a quarter on a separate test database to make sure backups actually work. Steps:

1. **Spin up a temporary postgres** (use a different volume so production is untouched):
   ```bash
   docker run --rm -d --name labkom-restore-pg -e POSTGRES_PASSWORD=test -p 55432:5432 postgres:15-alpine
   sleep 5
   ```
2. **Restore the dump**:
   ```bash
   docker exec -i labkom-restore-pg createdb -U postgres lab_management_test
   pg_restore -h localhost -p 55432 -U postgres -d lab_management_test \
     /srv/apps/labkom-apps/backups/db/lab_management_<STAMP>.dump
   ```
3. **Sanity check**: connect with `psql`, run `SELECT count(*) FROM users; SELECT count(*) FROM schedules; SELECT count(*) FROM logbooks;`. Counts should match expected production scale.
4. **Tear down**: `docker stop labkom-restore-pg`.
5. Log the drill date in the change log.

## Production restore (real recovery)

Use this only when real production data is lost or corrupted. **Confirm with the lab coordinator before running.** This is destructive.

### Database

```bash
cd /srv/apps/labkom-apps/deploy

# Stop application traffic to prevent writes during restore.
docker compose -f docker-compose.yml -f docker-compose.images.yml --env-file .env.images stop backend frontend

# Drop and recreate the database. CONFIRM the dump file first.
docker compose -f docker-compose.yml -f docker-compose.images.yml --env-file .env.images \
  exec -T postgres psql -U postgres -c 'DROP DATABASE IF EXISTS lab_management;'
docker compose -f docker-compose.yml -f docker-compose.images.yml --env-file .env.images \
  exec -T postgres psql -U postgres -c 'CREATE DATABASE lab_management;'

# Restore. Replace <DUMP> with the chosen file.
docker compose -f docker-compose.yml -f docker-compose.images.yml --env-file .env.images \
  exec -T postgres pg_restore -U postgres -d lab_management \
  < /srv/apps/labkom-apps/backups/db/<DUMP>

# Run pending migrations (no-op if dump already on latest schema).
docker compose -f docker-compose.yml -f docker-compose.images.yml --env-file .env.images \
  run --rm backend sh -lc 'npx prisma migrate deploy'

# Bring app back.
docker compose -f docker-compose.yml -f docker-compose.images.yml --env-file .env.images \
  up -d backend frontend
```

### Uploads

```bash
# Choose the tar to restore.
TAR=/srv/apps/labkom-apps/backups/uploads/uploads_<STAMP>.tar.gz

# Stop backend so we don't fight running writes.
docker compose -f /srv/apps/labkom-apps/deploy/docker-compose.yml \
  -f /srv/apps/labkom-apps/deploy/docker-compose.images.yml stop backend

# Replace uploads directory atomically.
mv /mnt/data/apps/labkom-apps/uploads /mnt/data/apps/labkom-apps/uploads.broken-$(date +%s)
mkdir -p /mnt/data/apps/labkom-apps/uploads
tar -xzf "$TAR" -C /tmp/labkom-uploads-restore
rsync -a /tmp/labkom-uploads-restore/current/ /mnt/data/apps/labkom-apps/uploads/
rm -rf /tmp/labkom-uploads-restore

docker compose -f /srv/apps/labkom-apps/deploy/docker-compose.yml \
  -f /srv/apps/labkom-apps/deploy/docker-compose.images.yml start backend
```

After restore, hit the health check: `curl -fsS http://127.0.0.1:8004/api/v1/health`. Then load the dashboard in a browser and verify a recent ticket, a logbook entry, and an avatar render.

## Rollback for application code

The container images are tagged by SHA in CI. To roll back to the previous image:

```bash
cd /srv/apps/labkom-apps/deploy

# Identify the previous good image tag (sha-xxxxxxx).
cat .env.images

# Edit .env.images and replace IMAGE_TAG with the older sha.
docker compose -f docker-compose.yml -f docker-compose.images.yml --env-file .env.images pull backend frontend
docker compose -f docker-compose.yml -f docker-compose.images.yml --env-file .env.images up -d backend frontend
```

Schema-incompatible rollbacks need a database restore first. Always pair an app rollback with the closest matching DB dump.

## What is NOT in this runbook

- Cloudflare Tunnel restore. Tunnel config lives in Cloudflare dashboard and on the host's `cloudflared` config. Document it separately.
- WhatsApp Bot session restore. The Baileys session lives at `backend/session/`. If the session is lost, just relogin the bot via QR.

## Where to log a recovery

Append every restore (drill or real) to `docs/CHANGELOG-recovery.md` with: date, who ran it, source dump, target environment, observed issues. That trail is the only way to learn from real incidents.
