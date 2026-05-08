# CI/CD Setup (GHCR + GitHub Actions)

## Workflow files
- `.github/workflows/ci.yml`
- `.github/workflows/cd.yml`

## Secrets yang wajib di GitHub repo
Masuk ke **Settings → Secrets and variables → Actions → Secrets**:

- `DEPLOY_HOST` = IP / domain server
- `DEPLOY_USER` = user SSH server
- `DEPLOY_SSH_KEY` = private key SSH untuk deploy
- `DEPLOY_PORT` = port SSH (opsional, default 22)

## Variables yang opsional di GitHub repo
Masuk ke **Settings → Secrets and variables → Actions → Variables**:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_APP_NAME`

Kalau tidak diisi, workflow pakai default yang sekarang sudah hardcoded.

## Server prerequisites
Di server target:
- Docker & Docker Compose sudah terinstall
- folder deploy ada di `/srv/apps/labkom-apps/deploy`
- file berikut sudah ada:
  - `docker-compose.yml`
  - `docker-compose.images.yml`
  - `.env.backend`
  - `.env.frontend`

## Deploy flow
1. Push ke branch `main`
2. GitHub Actions build image backend & frontend
3. Image dipush ke `ghcr.io/<owner>/labkom-apps/backend:latest`
4. Workflow SSH ke server
5. Server pull image terbaru
6. Jalankan `npx prisma migrate deploy`
7. Restart backend/frontend
8. Hit healthcheck backend

## Command manual di server (jika perlu)
```bash
cd /srv/apps/labkom-apps/deploy
export IMAGE_NAMESPACE=ghcr.io/<owner>/labkom-apps
export IMAGE_TAG=latest
docker compose -f docker-compose.yml -f docker-compose.images.yml pull backend frontend
docker compose -f docker-compose.yml -f docker-compose.images.yml run --rm backend sh -lc 'npx prisma migrate deploy'
docker compose -f docker-compose.yml -f docker-compose.images.yml up -d backend frontend
```

## Catatan penting
- Untuk production, gunakan `prisma migrate deploy`, bukan `db push`
- Seed tidak dijalankan otomatis saat deploy
- Workflow saat ini push image `latest` untuk `main`
- Kalau mau lebih rapi, next step bisa pakai tag SHA saat deploy, bukan `latest`
