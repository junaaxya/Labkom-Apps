# Named Sub-Index: `deploy`

Use this file as a concise work log for one task area or topic.

Rules:
- Put the newest entry at the top
- Keep each entry to one line
- Store longer detail in a pointed file when needed
- When the file grows too long, summarize older entries into a context or memory note

## Entries

- 2026-11-02 12:40 WIB — Sisyphus: merged PR #29 (`2c42213`) into `main` as `978903063f114674ff1f0ec8464654ae256248b6`; main CI `41402457931` and CD `41402457754` succeeded, deploying `sha-9789030af9ce140d458b277eb78ff382cce4e68d` images (29/29 migrations verified) -> https://github.com/junaaxya/Labkom-Apps/actions/runs/41402457754
- 2026-11-02 11:20 WIB — Sisyphus: merged PR #28 (`859e7d6`) into `main` as `12c869d09c043d20aeb77dcc067afa241d2e0a25`; main CI `41386501252` and CD `41386501074` succeeded, applying migration #29 (`20261103000000_add_support_chat`) (29/29 total) and deploying `sha-12c869d09c043d20aeb77dcc067afa241d2e0a25` images -> https://github.com/junaaxya/Labkom-Apps/actions/runs/41386501074
- 2026-11-02 10:00 WIB — Sisyphus: merged PR #27 (`d3ee15d`) into `main` as `db016d14e3bde5993f208891da2814395336f7d4`; main CI `41378464616` and CD `41378464606` succeeded, applying migration #28 (`20261102000000_unique_active_academic_slot_request`) (28/28 total) and deploying `sha-db016d14e3bde5993f208891da2814395336f7d4` images -> https://github.com/junaaxya/Labkom-Apps/actions/runs/41378464606
- 2026-11-01 17:00 WIB — Sisyphus: merged PR #26 (`825eed6`) into `main` as `af4d6a482336c183f3f1c9bc47a113380d32d2e9`; main CI `41294532007` and CD `41294532014` succeeded, applying migrations #26 (`20261031000000_add_ticket_operational_history`) and #27 (`20261101000000_add_ticket_integrity_links`) (27/27 total) and deploying `sha-af4d6a482336c183f3f1c9bc47a113380d32d2e9` images -> https://github.com/junaaxya/Labkom-Apps/actions/runs/41294532014
- 2026-10-21 12:45 WIB — Sisyphus: merged PR #21 into `main` as `e618c73`; main CI 39550157324 and CD 39550157337 passed, including image build and structured production deploy -> https://github.com/junaaxya/Labkom-Apps/actions/runs/39550157337
- 2026-06-17 23:06 WIB — Sisyphus: tightened deploy verification so `deploy/scripts/verify-labkom.sh` now probes `/api/v1/hosting/transactions` on internal/public backend URLs and fails deploy on 404 while accepting non-404 mounted-route responses (200/201/400/401/403/405) -> deploy/scripts/verify-labkom.sh
- 2026-06-06 00:10 WIB — Sisyphus: created starter deploy bucket for docker, nginx, and rollout handoff notes -> .multibrain/context/2026-06-06-0010-sisyphus-deploy-bucket-init.md
