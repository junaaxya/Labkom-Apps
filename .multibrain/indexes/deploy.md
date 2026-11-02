# Named Sub-Index: `deploy`

Use this file as a concise work log for one task area or topic.

Rules:
- Put the newest entry at the top
- Keep each entry to one line
- Store longer detail in a pointed file when needed
- When the file grows too long, summarize older entries into a context or memory note

## Entries

- 2026-11-01 17:00 WIB — Sisyphus: merged PR #26 (`825eed6`) into `main` as `af4d6a482336c183f3f1c9bc47a113380d32d2e9`; main CI `41294532007` and CD `41294532014` succeeded, applying migrations #26 (`20261031000000_add_ticket_operational_history`) and #27 (`20261101000000_add_ticket_integrity_links`) (27/27 total) and deploying `sha-af4d6a482336c183f3f1c9bc47a113380d32d2e9` images -> https://github.com/junaaxya/Labkom-Apps/actions/runs/41294532014
- 2026-10-21 12:45 WIB — Sisyphus: merged PR #21 into `main` as `e618c73`; main CI 39550157324 and CD 39550157337 passed, including image build and structured production deploy -> https://github.com/junaaxya/Labkom-Apps/actions/runs/39550157337
- 2026-06-17 23:06 WIB — Sisyphus: tightened deploy verification so `deploy/scripts/verify-labkom.sh` now probes `/api/v1/hosting/transactions` on internal/public backend URLs and fails deploy on 404 while accepting non-404 mounted-route responses (200/201/400/401/403/405) -> deploy/scripts/verify-labkom.sh
- 2026-06-06 00:10 WIB — Sisyphus: created starter deploy bucket for docker, nginx, and rollout handoff notes -> .multibrain/context/2026-06-06-0010-sisyphus-deploy-bucket-init.md
