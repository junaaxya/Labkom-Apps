# Labkom Deployment Operations

## Recommended production model
- Source of truth: GitHub (`main`)
- Artifact of truth: GHCR images tagged by immutable commit SHA
- Production deploy: image-only via Docker Compose
- Verification gate: backend + frontend + PWA endpoints must pass
- Rollback: use stored previous release state

## Files
- `docker-compose.images.yml` — image override for production deploys
- `docker-compose.candidate.yml` — temporary candidate services on alternate localhost ports
- `scripts/deploy-labkom.sh` — pull, migrate, update, verify, record release state
- `scripts/deploy-labkom-candidate.sh` — start candidate services, verify candidate, optional promote
- `scripts/rollback-labkom.sh` — restore previously recorded release
- `scripts/verify-labkom.sh` — checks `/`, `/dashboard`, `/sw.js`, `/manifest.json`, `/api/v1/health`
- `scripts/verify-labkom-candidate.sh` — candidate checks on ports `13002` and `18004`
- `state/current-release.env` — current deployed release metadata
- `state/previous-release.env` — last known good release metadata
- `state/deploy-history/*.log` — deployment logs

## Example deploy
```bash
cd /srv/apps/labkom-apps/deploy
IMAGE_NAMESPACE=ghcr.io/junaaxya/labkom-apps IMAGE_TAG=sha-<commit> ./scripts/deploy-labkom.sh
```

## Example rollback
```bash
cd /srv/apps/labkom-apps/deploy
./scripts/rollback-labkom.sh
```

## Example candidate verification (no live promotion)
```bash
cd /srv/apps/labkom-apps/deploy
IMAGE_NAMESPACE=ghcr.io/junaaxya/labkom-apps IMAGE_TAG=sha-<commit> ./scripts/deploy-labkom-candidate.sh
```

## Example candidate verification + promote
```bash
cd /srv/apps/labkom-apps/deploy
IMAGE_NAMESPACE=ghcr.io/junaaxya/labkom-apps IMAGE_TAG=sha-<commit> PROMOTE_ON_SUCCESS=true ./scripts/deploy-labkom-candidate.sh
```

## Notes
- Do not build production directly from mutable server source unless in an emergency.
- Prefer deploys from GHCR image tags produced by GitHub Actions.
- Keep `main` protected and tie production deploys to reviewed commits.
- Use `DEPLOY_CHECKLIST.md` before and after important releases.
- Use `DEPLOY_REPORT_TEMPLATE.md` to record a standard deployment result.
