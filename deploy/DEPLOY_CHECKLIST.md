# Labkom Deploy Checklist

## Before deploy
- [ ] Commit target is merged to `main`
- [ ] CI passed for backend and frontend
- [ ] GHCR images exist for target commit SHA
- [ ] No emergency issue is currently active on production
- [ ] Database migration impact has been considered
- [ ] Rollback target is known (`state/previous-release.env` or current running SHA)

## Standard deploy (live)
- [ ] Set `IMAGE_NAMESPACE`
- [ ] Set `IMAGE_TAG=sha-<commit>`
- [ ] Run `./scripts/deploy-labkom.sh`
- [ ] Confirm backend health check passed
- [ ] Confirm `/` returns 200
- [ ] Confirm `/dashboard` returns 200
- [ ] Confirm `/sw.js` returns 200
- [ ] Confirm `/manifest.json` returns 200
- [ ] Confirm `state/current-release.env` updated
- [ ] Confirm deploy history log written

## Candidate rollout (safe verification)
- [ ] Set `IMAGE_NAMESPACE`
- [ ] Set `IMAGE_TAG=sha-<commit>`
- [ ] Run `./scripts/deploy-labkom-candidate.sh`
- [ ] Confirm candidate backend on `18004` is healthy
- [ ] Confirm candidate frontend on `13002` serves `/`
- [ ] Confirm candidate `/dashboard` works
- [ ] Confirm candidate `/sw.js` works
- [ ] Confirm candidate `/manifest.json` works
- [ ] If promoting, run with `PROMOTE_ON_SUCCESS=true`
- [ ] Confirm candidate cleanup happened after verification

## Rollback
- [ ] Run `./scripts/rollback-labkom.sh`
- [ ] Confirm backend health check passed again
- [ ] Confirm `/` and `/dashboard` are back to normal
- [ ] Confirm `state/current-release.env` reflects restored release

## After deploy
- [ ] Record commit SHA and deployment result
- [ ] Record whether this was direct live deploy or candidate verify/promote
- [ ] Record any anomalies observed
- [ ] Record rollback readiness
