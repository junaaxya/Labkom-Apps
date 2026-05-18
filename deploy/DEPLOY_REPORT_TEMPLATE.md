# Labkom Deploy Report Template

## Release Identity
- Repo: `junaaxya/Labkom-Apps`
- Branch: `main`
- Commit: `sha-...`
- Image namespace: `ghcr.io/junaaxya/labkom-apps`
- Deploy mode: `live` | `candidate-verify` | `candidate-promote` | `rollback`
- Timestamp: `YYYY-MM-DDTHH:MM:SSZ`

## Build / Artifact Status
- Backend image available: YES/NO
- Frontend image available: YES/NO
- GHCR readiness wait triggered: YES/NO

## Verification Results
- Backend `/api/v1/health`: PASS/FAIL
- Frontend `/`: PASS/FAIL
- Frontend `/dashboard`: PASS/FAIL
- Frontend `/sw.js`: PASS/FAIL
- Frontend `/manifest.json`: PASS/FAIL

## Deployment Outcome
- Deployment status: SUCCESS/FAILED
- Candidate verification status: SUCCESS/FAILED/N/A
- Live promotion executed: YES/NO
- Rollback executed: YES/NO
- Current release state updated: YES/NO
- Deploy history log written: YES/NO

## Notes
- Observations:
- Errors encountered:
- Manual intervention needed:
- Rollback target:
