# Named Sub-Index: `backend`

Use this file as a concise work log for one task area or topic.

Rules:
- Put the newest entry at the top
- Keep each entry to one line
- Store longer detail in a pointed file when needed
- When the file grows too long, summarize older entries into a context or memory note

## Entries

- 2026-07-02 16:34 WIB — Codex: pre-push Duitku hosting verification passed for backend: `npm run build` succeeds, local `/hosting/plans` returns 200, live Duitku status for sandbox order `labkom-vps-kvm-2-1782983058245` returns `SUCCESS`/`00`, and invalid-signature callback smoke test returns HTTP 200; `DUITKU_CALLBACK_URL` remains missing so public server-to-server callback still requires deployment/tunnel configuration
- 2026-07-02 15:16 WIB — Codex: migrated stateless hosting checkout backend from Midtrans Snap to Duitku sandbox flow with HMAC-SHA256 request signatures, public `/hosting/callback`, live `/hosting/transactions/:orderId` status proxy, optional `/hosting/payment-methods`, Duitku env config, and no Prisma schema/migration changes -> repo files `backend/src/services/hosting.service.ts`, `backend/src/controllers/hosting.controller.ts`, `backend/src/routes/hosting.routes.ts`, `backend/src/validators/hosting.validator.ts`, `backend/src/config/index.ts`, `backend/.env.example`
- 2026-06-16 22:02 WIB — Sisyphus: fixed local runtime error `public.assets does not exist` by running `npx prisma db push` in `backend`, generating Prisma client and creating local Asset Registry tables; verified `prisma.asset.count()` plus maintenance/audit counts return zero and unauthenticated live `/api/v1/assets` now returns 401 instead of missing-table/404 -> local DB sync only; production still uses tracked migration `backend/prisma/migrations/20260616000000_add_asset_inventory/migration.sql`
- 2026-06-16 17:05 WIB — Sisyphus: added additive Asset Registry backend domain with Prisma `Asset`/maintenance/audit models, dedicated `/api/v1/assets` routes/controllers/services/validators, coordinator-only PC backfill, and preserved existing PC monitoring/agent/QR routes untouched -> repo files `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260616000000_add_asset_inventory/migration.sql`, `backend/src/routes/asset.routes.ts`, `backend/src/controllers/asset.controller.ts`, `backend/src/services/asset.service.ts`, `backend/src/validators/asset.validator.ts`, `backend/src/routes/index.ts`
- 2026-06-16 16:18 WIB — Sisyphus: added service-level normalization for User create/update so `KOORDINATOR_LAB` cannot persist `isKetuaKelas=true` even if a stale UI or manual request sends it; preserves `MAHASISWA`/`ASISTEN_LAB` ketua-kelas capability -> repo file `backend/src/services/user.service.ts`
- 2026-06-16 15:58 WIB — Sisyphus: widened lab-booking creation for one-account multi-capability by moving POST `/bookings` from route-only `MAHASISWA` authorization to service-level requester validation that allows `MAHASISWA` or any persisted `isKetuaKelas=true`, while approval routes remain `KOORDINATOR_LAB`/`ASISTEN_LAB` only -> repo files `backend/src/routes/booking.routes.ts`, `backend/src/services/booking.service.ts`
- 2026-06-16 15:34 WIB — Sisyphus: patched attendance service so check-in/check-out now require GPS coordinates, geofence checks run whenever geofencing is enabled, and checkout no longer blocks on missing daily tasks; preserved no-shift attendance fallback and existing settings compatibility -> repo file `backend/src/services/attendance.service.ts`
- 2026-06-06 00:10 WIB — Sisyphus: created starter backend bucket for API, Prisma, auth, and service-layer handoff notes -> .multibrain/context/2026-06-06-0010-sisyphus-backend-bucket-init.md
