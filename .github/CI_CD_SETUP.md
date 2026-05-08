# CI/CD Setup (GHCR + GitHub Actions + Self-Hosted Runner)

## Arsitektur yang dipakai
- **CI / build image** jalan di GitHub-hosted runner
- **CD / deploy** jalan di **self-hosted runner** yang dipasang di server Labkom
- Cocok untuk server **tanpa IP publik** dan domain web yang dipublish via Cloudflare Tunnel

## Workflow files
- `.github/workflows/ci.yml`
- `.github/workflows/cd.yml`

## Secrets / Variables GitHub
### Actions Variables (opsional)
Masuk ke **Settings → Secrets and variables → Actions → Variables**:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_APP_NAME`

Kalau tidak diisi, workflow pakai default yang sekarang sudah hardcoded.

### Actions Secrets
Untuk workflow yang sekarang, **tidak perlu lagi** `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, atau `DEPLOY_PORT`.

Deploy sekarang dilakukan oleh self-hosted runner langsung di server.

## Server prerequisites
Di server target:
- Docker & Docker Compose sudah terinstall
- folder deploy ada di `/srv/apps/labkom-apps/deploy`
- file berikut sudah ada:
  - `docker-compose.yml`
  - `docker-compose.images.yml`
  - `.env.backend`
  - `.env.frontend`
- self-hosted runner GitHub sudah terpasang dan online

## Label runner yang diharapkan
Workflow deploy memakai:
- `self-hosted`
- `linux`
- `x64`
- `labkom`

Saat setup runner, tambahkan label `labkom`.

## Deploy flow
1. Push ke branch `main`
2. GitHub Actions build image backend & frontend
3. Image dipush ke `ghcr.io/<owner>/labkom-apps/backend:latest`
4. Job deploy dikirim ke self-hosted runner di server
5. Runner pull image terbaru
6. Runner jalankan `npx prisma migrate deploy`
7. Runner restart backend/frontend
8. Runner hit healthcheck backend

## Command manual di server (jika perlu)
```bash
cd /srv/apps/labkom-apps/deploy
export IMAGE_NAMESPACE=ghcr.io/<owner>/labkom-apps
export IMAGE_TAG=latest
docker compose -f docker-compose.yml -f docker-compose.images.yml pull backend frontend
docker compose -f docker-compose.yml -f docker-compose.images.yml run --rm backend sh -lc 'npx prisma migrate deploy'
docker compose -f docker-compose.yml -f docker-compose.images.yml up -d backend frontend
```

## Langkah setup self-hosted runner
1. Buka repo GitHub `junaaxya/Labkom-Apps`
2. Masuk ke **Settings → Actions → Runners**
3. Klik **New self-hosted runner**
4. Pilih:
   - OS: Linux
   - Architecture: x64
5. GitHub akan tampilkan command install runner
6. Jalankan command itu di server ini, idealnya di folder seperti:
   - `/srv/actions-runner/labkom`
7. Saat konfigurasi runner:
   - gunakan nama yang jelas, mis. `labkom-server`
   - tambahkan label: `labkom`
8. Jalankan runner sebagai service agar otomatis aktif setelah reboot

## Catatan penting
- Untuk production, gunakan `prisma migrate deploy`, bukan `db push`
- Seed tidak dijalankan otomatis saat deploy
- Workflow saat ini push image `latest` untuk `main`
- Next step yang lebih rapi: deploy pakai tag SHA, bukan `latest`
