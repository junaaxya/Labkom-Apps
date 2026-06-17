# Named Sub-Index: `frontend`

Use this file as a concise work log for one task area or topic.

Rules:
- Put the newest entry at the top
- Keep each entry to one line
- Store longer detail in a pointed file when needed
- When the file grows too long, summarize older entries into a context or memory note

## Entries

- 2026-06-16 22:02 WIB — Sisyphus: applied post-review Asset Registry frontend fixes: `/inventory` now requests `/assets?limit=100` to avoid backend default 20-row truncation, PC-linked assets now open `/pc-monitoring?search=...` with `pc-monitoring` seeding search from URL params, and `ASISTEN_LAB` can access Inventory through role guard + sidebar to match backend RBAC -> repo files `frontend/src/app/(dashboard)/inventory/page.tsx`, `frontend/src/app/(dashboard)/pc-monitoring/page.tsx`, `frontend/src/components/auth/role-guard.tsx`, `frontend/src/components/layout/neo-sidebar.tsx`
- 2026-06-16 17:20 WIB — Sisyphus: replaced `/inventory` UI with Asset Registry frontend backed by `/assets`, using backend enum values (`GOOD`, `NEEDS_REPAIR`, `BROKEN`, `LOST`, `RETIRED`; `ACTIVE`, `IN_MAINTENANCE`, `BORROWED`, `STORED`, `DISPOSED`), MAHASISWA no-access guard, maintenance payload with required `title` + `status`, and PC-linked badges that only link to `/pc-monitoring` without touching PC QR/agent endpoints -> repo file `frontend/src/app/(dashboard)/inventory/page.tsx`
- 2026-06-16 16:45 WIB — Sisyphus: fixed attendance settings geofencing form lifecycle by moving `locationForm` default/campus synchronization into a guarded `useEffect` with dirty-form protection, eliminating render-time state updates linked to React production error #301 -> repo file `frontend/src/app/(dashboard)/attendance/settings/page.tsx`
- 2026-06-16 16:32 WIB — Sisyphus: tightened Edit User modal mobile footer spacing so `Batal` and `Simpan Perubahan` use smaller two-column action buttons with safe-area bottom padding, preventing clipping behind the mobile bar -> repo file `frontend/src/app/(dashboard)/users/page.tsx`
- 2026-06-16 16:18 WIB — Sisyphus: patched Manajemen User role/capability UI so selecting `KOORDINATOR_LAB` clears and disables `Ketua Kelas` in create/edit modals with explanatory helper text, while `MAHASISWA` and `ASISTEN_LAB` remain eligible for the additive capability -> repo file `frontend/src/app/(dashboard)/users/page.tsx`
- 2026-06-16 15:58 WIB — Sisyphus: patched one-account multi-capability UI so `isKetuaKelas` works as an additive capability for any role; assistant-ketua users now get non-duplicate ketua sidebar extras, schedule-change request/history access, lab-booking request access, and assistant key-scan take visibility remains aligned with backend role permissions -> repo files `frontend/src/components/layout/neo-sidebar.tsx`, `frontend/src/app/(dashboard)/schedules/page.tsx`, `frontend/src/app/(dashboard)/scan/key/[code]/page.tsx`, `frontend/src/app/(dashboard)/lab-booking/page.tsx`
- 2026-06-16 15:34 WIB — Sisyphus: patched attendance page so check-in/check-out stop when GPS is unavailable, denied, or missing coordinates; centralized required geolocation lookup and aligned checkout error messaging with mandatory GPS workflow -> repo file `frontend/src/app/(dashboard)/attendance/page.tsx`
- 2026-06-08 23:40 WIB — Sisyphus: patched shared frontend API to auto-clear invalid/expired auth sessions and redirect to /login; expanded /pc-monitoring with visible-lab-scoped bulk selection helpers (all/online/offline/WoL-ready/health-status) and polished the selection UI hierarchy for mobile+desktop -> repo files `frontend/src/services/api.ts`, `frontend/src/app/(dashboard)/pc-monitoring/page.tsx`
- 2026-06-06 00:10 WIB — Sisyphus: created starter frontend bucket for Next.js, UI, and component handoff notes -> .multibrain/context/2026-06-06-0010-sisyphus-frontend-bucket-init.md
