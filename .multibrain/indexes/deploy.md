# Named Sub-Index: `deploy`

Use this file as a concise work log for one task area or topic.

Rules:
- Put the newest entry at the top
- Keep each entry to one line
- Store longer detail in a pointed file when needed
- When the file grows too long, summarize older entries into a context or memory note

## Entries

- 2026-06-17 23:06 WIB — Sisyphus: tightened deploy verification so `deploy/scripts/verify-labkom.sh` now probes `/api/v1/hosting/transactions` on internal/public backend URLs and fails deploy on 404 while accepting non-404 mounted-route responses (200/201/400/401/403/405) -> deploy/scripts/verify-labkom.sh
- 2026-06-06 00:10 WIB — Sisyphus: created starter deploy bucket for docker, nginx, and rollout handoff notes -> .multibrain/context/2026-06-06-0010-sisyphus-deploy-bucket-init.md
