# LabKom Management System — Project Architecture & Workflow Reference

> **IMPORTANT FOR AI AGENTS**: This document is the single source of truth for the project. Do NOT make changes that contradict the workflows, roles, or feature designs described here. When in doubt, follow this document.

## Multi Brain (MANDATORY)

- Read `.multibrain/session.md` before starting work.
- Use `.multibrain/session.md` as the master index only.
- Open only the `.multibrain/indexes/*.md` bucket files that match the current task.
- Open `.multibrain/context/*.md` only when the selected bucket points to deeper context that matters.
- After meaningful work, update the relevant named bucket and refresh the master index if needed.

## Overview

**LabKom: Sistem Manajemen Laboratorium Terpusat Berbasis Web dengan QR Tracking, Digital Logbook, dan Ticketing Kerusakan**

Full-stack lab management system for university computer laboratories. Manages scheduling, attendance, ticketing, PC monitoring, gamification, and AI-powered insights.

**Stack:** Next.js 15 (frontend) + Express/Prisma (backend) + PostgreSQL + Python PC Agent

---

## Directory Structure

```
ManagementLab-Web/
├── frontend/          # Next.js 15 App Router (port 3000)
├── backend/           # Express + Prisma + TypeScript (port 5000)
├── labkom-agent/      # Python PC Agent (installed per-PC)
└── docs/specs/        # Blueprint & workflow specs
```

---

## Backend Architecture

**Pattern:** Layered monolith — `routes → controllers → services → prisma`

```
backend/src/
├── routes/*.routes.ts       # Express Router definitions
├── controllers/*.controller.ts  # Request handling, validation
├── services/*.service.ts    # Business logic (static class methods)
├── middlewares/             # Auth, agent auth, error handler
├── config/database.ts       # Prisma client export
├── validators/              # Zod/manual validation
└── server.ts               # Entry point
```

**Key patterns:**
- Routes registered in `routes/index.ts` → mounted at `/api/v1` in `app.ts`
- Auth: JWT middleware (`authenticate` + `authorize(...roles)`)
- Query-string JWT is only allowed through explicit route-scoped middleware, currently `authenticateQueryToken` for notification SSE (`/notifications/stream`)
- Agent auth: SHA-256 token comparison (`agentAuth.middleware.ts`)
- Prisma accessor for PC model: `prisma.pC` (not `prisma.pc`)
- Import prisma: `import prisma from "../config/database"`

**Build & Run:**
```bash
cd backend
npx tsc          # Compile TypeScript
node dist/server.js  # Run (tsx broken under Bun 1.3.12)
```

**Database:** PostgreSQL via Docker (`docker compose up -d postgres`)
- Local dev schema sync: `npx prisma db push` (rapid iteration, no migration history). The repo also keeps a baseline migration at `backend/prisma/migrations/0_init/` so production environments can run `prisma migrate deploy`.
- Production schema sync: `npm run db:migrate:deploy` (alias of `npx prisma migrate deploy`). CI uses this in `.github/workflows/cd.yml`.
- Seed: `npx prisma db seed` or manual Node.js scripts

---

## Frontend Architecture

**Framework:** Next.js 15 with App Router, client-side rendering (`"use client"`)

**PWA Status:** ✅ Production-ready PWA with mobile-first responsive design (May 2026 refactor)

```
frontend/src/
├── app/(auth)/          # Login, register pages
├── app/(dashboard)/     # All dashboard pages (route group) — 43 pages total
│   ├── dashboard/       # Main dashboard (role-based views)
│   ├── pc-monitoring/   # PC Agent real-time monitoring
│   ├── lab-map/         # Interactive lab PC grid map
│   ├── inventory/       # Hardware specs + live agent data
│   ├── labs/            # Lab management
│   ├── schedules/       # Schedule management
│   ├── tickets/         # Ticketing system
│   ├── logbook/         # Logbook monitoring
│   ├── attendance/      # Asisten attendance
│   ├── missions/        # Mission system & gamification
│   ├── leaderboard/     # Ranking & points
│   ├── keys/            # Key management (QR-based)
│   ├── ai-assistant/    # AI chat assistant
│   ├── predictive/      # Predictive maintenance
│   ├── smart-scheduling/# AI scheduling
│   ├── notifications/   # Notification center
│   ├── reports/         # Monthly reports
│   └── ...              # 30+ other pages
├── app/offline/         # PWA offline fallback page
├── components/layout/   # DashboardLayout, NeoSidebar, NeoTopbar, MobileBottomNav
├── components/pwa/      # OfflineIndicator, InstallPrompt, SWRegistration
├── components/ui/       # MobileCard, ResponsiveList, TouchTarget, etc.
├── services/api.ts      # Fetch wrapper with JWT auth
├── types/index.ts       # Shared TypeScript interfaces
└── public/
    ├── manifest.json    # PWA manifest
    └── sw.js            # Service worker
```

**Design System:** Neo-brutalist style (mobile-first responsive)
- Classes: `neo-card`, `neo-btn`, `neo-input`, `neo-border`, `neo-badge`
- Colors: `#1a1a1a` (black), `#5a5a5a` (gray), `#4b607f` (steel blue), `#f3701e` (orange accent), `#f5ede6` (cream), `#e8d8c9` (warm gray)
- Font: Clash Display (headings), Inter (body)
- Animations: framer-motion
- Touch targets: Minimum 44px (WCAG 2.1 Level AAA)
- Safe area insets: PWA fullscreen support (notch/home indicator)

**Responsive Breakpoints:**
- Mobile: 320px–640px (sm:)
- Tablet: 768px (md:)
- Desktop: 1024px (lg:)
- Large desktop: 1280px (xl:)

**PWA Features:**
- ✅ Offline indicator (fixed top banner)
- ✅ Install prompt (bottom sheet, 7-day cooldown)
- ✅ Service worker (offline fallback, precache)
- ✅ Manifest (standalone mode, theme colors)
- ✅ Safe area insets (notch/home indicator clearance)
- ✅ Hybrid mobile navigation (role-aware bottom nav + full sidebar drawer via Menu)
- ✅ Mobile bottom-nav scroll clearance (`DashboardLayout` keeps extra bottom padding so final cards scroll above the fixed nav)
- ✅ Topbar avatar uses uploaded profile photo (`User.avatar`) via upload URL helper, with initial-letter fallback

**Build:**
```bash
cd frontend
npx next build
```

---

## Roles & Access Control

| Role | Akses |
|---|---|
| KOORDINATOR_LAB | Full access — semua management, analytics, AI, verifikasi, audit |
| ASISTEN_LAB | Operasional — absensi, shift, logbook, kunci, ticketing, misi, monitoring |
| MAHASISWA | Terbatas — jadwal, lapor kerusakan, FAQ, booking lab |
| MAHASISWA (`isKetuaKelas = true`) | Ketua kelas — mahasiswa + ambil kunci, validasi kondisi akhir, kembalikan kunci |

**Current production role model:** Prisma `Role` enum only contains `KOORDINATOR_LAB`, `ASISTEN_LAB`, and `MAHASISWA`. There is no active `DOSEN` role. Lecturer data is stored as schedule text fields (for example `lecturerName`), not as login-capable users.

Sidebar menu defined in `components/layout/neo-sidebar.tsx` (`menuByRole` object).

### Menu per Role

**Koordinator Lab:**
Dashboard, Manajemen Lab, Manajemen Jadwal, Manajemen User, Asleb & Shift, Logbook Lab, Peminjaman Kunci, Ticketing, Misi & Verifikasi, Leaderboard, Laporan, Sertifikat, PC Monitoring, Inventory, Energi, AI Assistant, Predictive, Smart Scheduling, Pengaturan

**Asisten Lab:**
Dashboard, Absensi Saya, Jadwal Tugas, Logbook Lab, Kunci Lab, Ticketing, Misi Saya, Peta Lab, PC Monitoring, Riwayat Tugas, Leaderboard

**Mahasiswa:**
Dashboard, Jadwal Lab, Scan QR Kerusakan, Riwayat Laporan, Panduan Lab, AI Assistant

---

## Core Workflows (AUTHORITATIVE — Do Not Modify)

### Workflow 1: Jadwal Lab

```
Koordinator membuat jadwal → Sistem cek bentrok lab → Jadwal tersimpan
→ Jadwal tampil di dashboard mahasiswa dan asleb
→ Saat sesi dimulai, asleb membuka sesi
→ Sesi berlangsung
→ Ketua kelas mengisi validasi kondisi akhir
→ Asleb memverifikasi dan menutup sesi
→ Logbook tersimpan
```

### Workflow 2: Digital Logbook (FINAL — Revisi)

```
Jadwal dimulai
→ Asleb membuka sesi lab (check-in resmi)
→ Jika kunci diambil oleh ketua kelas/mahasiswa, sistem mencatat pemegang kunci
→ Sesi lab berjalan
→ Ketua kelas/mahasiswa mengisi validasi kondisi akhir ruangan
→ Ketua kelas/mahasiswa mengembalikan kunci atau menyerahkan ke asleb
→ Asleb melakukan verifikasi kondisi lab
→ Asleb menutup sesi (check-out resmi)
→ Logbook final tersimpan
```

**Logbook Status Flow:**
```
Scheduled → Checked In → In Use → Condition Submitted → Waiting Verification → Completed
```

**Jika ada masalah:**
```
Condition Submitted → Problem Found → Ticket Created → Verified with Notes → Completed
```

**Siapa yang boleh apa:**
- Check-in resmi: Asleb; Koordinator sebagai fallback operasional/admin jika diperlukan
- Ambil kunci: Asleb, Ketua Kelas (jika ada jadwal aktif + diizinkan), atau Koordinator sebagai admin
- Validasi kondisi akhir: Ketua kelas, pemegang kunci, atau role privileged
- Verifikasi & check-out: Asleb; Koordinator sebagai fallback operasional/admin jika diperlukan

### Workflow 3: Peminjaman Kunci (QR-Based)

```
User scan QR kunci → Sistem cek role dan jadwal
→ Sistem cek apakah user boleh mengambil kunci
→ User klik "Ambil Kunci" → Sistem mencatat pemegang kunci
→ Dashboard menampilkan pemegang kunci
→ Setelah selesai, user scan QR lagi
→ User klik "Kembalikan Kunci" → Status kunci = Available
```

**Status Kunci:** Available, Borrowed, Missing, Maintenance

**Syarat ambil kunci (mahasiswa/ketua kelas):**
- Ada jadwal aktif di lab tersebut
- Atau ada request peminjaman yang sudah disetujui
- Waktu pengambilan sesuai
- User memiliki akses sebagai penanggung jawab sesi

### Workflow 4: Ticketing Kerusakan

```
Mahasiswa scan QR di PC/meja → Pilih jenis kerusakan → Tambah deskripsi/foto
→ Submit laporan → Ticket masuk dashboard asleb
→ Asleb ambil ticket → Status = In Progress
→ Asleb memperbaiki → Status = Resolved
→ Poin asleb bertambah jika terhubung mission system
```

**Kategori Kerusakan:** Mouse, Keyboard, Monitor, CPU, Jaringan, Software, Kursi/Meja, AC/Listrik, Proyektor, Lainnya

**Status Ticket:** Open, In Progress, Waiting, Resolved, Rejected

### Workflow 5: Absensi Asisten Lab

```
Asleb login → Klik Absen Masuk → Sistem cek lokasi GPS
→ Jika valid, absen diterima → Asleb menjalankan tugas
→ Asleb mengisi daily task log → Asleb klik Absen Pulang
→ Jam kerja tersimpan
```

**Daily Task Categories:** PIKET_BERSIH, MAINTENANCE_PC, INVENTARIS, INSTALASI, PENDAMPINGAN, ADMINISTRASI, LAINNYA

### Workflow 6: Mission System & Gamification

```
Koordinator membuat misi → Asleb mengambil misi → Asleb mengerjakan
→ Asleb submit bukti → Koordinator memverifikasi
→ Jika approved, poin asleb bertambah → Leaderboard diperbarui
```

**Status Misi:** Open, Taken, Submitted, Approved, Rejected

### Workflow 7: Peminjaman Lab Mandiri

```
Mahasiswa/Ketua kegiatan mengajukan peminjaman
→ Koordinator/Asleb menyetujui → Jadwal peminjaman dibuat
→ Peminjam mengambil kunci → Lab digunakan
→ Peminjam mengisi kondisi akhir → Peminjam mengembalikan kunci
→ Asleb memverifikasi → Logbook final tersimpan
```

---

## PC Agent System

### Flow
```
Admin → Generate Token (POST /pcs/:id/generate-token)
  → Install agent on PC → config.json (pc_code + token + base_url)
  → python agent.py
  → Register (POST /agent/register)
  → Heartbeat loop 60s (POST /agent/heartbeat) — sends CPU/RAM/Storage/IP/hostname
  → Command poll 30s (GET /agent/commands)
  → Execute commands (SHUTDOWN/RESTART/SLEEP/LOCK/MESSAGE)
  → Report result (POST /agent/commands/:id/result)
```

### Backend Endpoints (all require agent token auth)
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v1/pcs/:id/generate-token` | POST | Admin generates agent token |
| `/api/v1/pcs/agent/register` | POST | Agent registers with system info |
| `/api/v1/pcs/agent/heartbeat` | POST | Agent sends metrics every 60s |
| `/api/v1/pcs/agent/commands` | GET | Agent polls for pending commands |
| `/api/v1/pcs/agent/commands/:id/result` | POST | Agent reports command result |
| `/api/v1/pcs/agent/logs` | POST | Agent sends activity logs |

### Auto-Warnings
Heartbeat auto-creates `PcWarning` records when:
- CPU usage > 90% → severity HIGH
- RAM usage > 90% → severity HIGH
- Storage usage > 90% → severity HIGH

### Smart Energy Management
```
IF no_active_schedule AND time > last_schedule_end + 15 minutes
THEN shutdown_all_lab_pcs
```

### Database Models (PC Agent related)
- `PC` — 15 agent columns (agentTokenHash, agentStatus, healthStatus, hostname, os, architecture, cpuModel, cpuUsage, ramUsage, ramTotalGb, storageUsage, storageTotalGb, uptimeSeconds, agentVersion, isAgentInstalled)
- `PcAgentLog` — Event tracking (AGENT_STARTED, HEARTBEAT_SENT, COMMAND_RECEIVED, etc.)
- `PcWarning` — Threshold alerts (CPU_HIGH, RAM_HIGH, STORAGE_HIGH, AGENT_INACTIVE)
- `PCCommand` — Command queue (SHUTDOWN, RESTART, WAKE_ON_LAN, SLEEP, LOCK, MESSAGE)

### Enums
- `AgentStatus`: ONLINE, OFFLINE, UNKNOWN
- `HealthStatus`: NORMAL, BROKEN, MAINTENANCE, NEEDS_CHECK
- `PCCommandType`: SHUTDOWN, RESTART, WAKE_ON_LAN, SLEEP, LOCK, MESSAGE
- `CommandStatus`: PENDING, SENT, EXECUTED, FAILED, CANCELLED

---

## Dashboard Pages & Data Flow

### `/dashboard` (Main Dashboard)
- Role-based: KoordinatorDashboard / AsistenDashboard / MahasiswaDashboard
- Koordinator fetches: labs, schedules, tickets, attendance, AI insights, health score, logbooks, **PC analytics**
- Shows PC Agent Monitor widget (online/offline/unknown/warnings/needs-check counts)
- Links to `/pc-monitoring` for details

### `/pc-monitoring` (PC Agent Monitoring)
- 8 stat cards from `GET /pcs/analytics`
- Table: PC Code, Name, Lab, Agent Status, Health Status, CPU/RAM/Storage bars, IP, Last Seen
- Detail drawer: hardware, resource usage, token generation, warnings, commands, logs
- Auto-refresh 30s with countdown
- Command modal (6 types) + bulk actions
- Filters: search, agentStatus, healthStatus, lab

### `/lab-map` (Lab Map)
- Interactive PC grid per lab
- Node colors based on `agentStatus`: blue=ONLINE, gray=OFFLINE, yellow=MAINTENANCE, red=BROKEN
- Click node → shows PC details + ticket history

### `/inventory` (Hardware Inventory)
- Static specs (CPU/RAM/Storage/OS) from `GET /pcs/inventory`
- Live agent data merged from `GET /pcs` (agent status badge, CPU/RAM/Storage usage bars with %)
- Fallback: shows agent-reported RAM/Storage total if manual specs not filled
- Aggregation cards: RAM/CPU/OS distribution
- Edit specs modal, bulk QR generation

### `/logbook` (Digital Logbook)
- List semua logbook per lab
- Status tracking (Scheduled → Completed)
- Check-in/check-out by authorized roles
- Condition validation form
- Verification by asleb, with Koordinator fallback where implemented

### `/schedules` (Jadwal Lab)
- Calendar view (mingguan/bulanan)
- CRUD jadwal by Koordinator
- Conflict detection (lab/asisten)
- Filter by semester, lab, status

### `/tickets` (Ticketing)
- List tickets with status badges
- Create via QR scan or manual
- Assign to asleb
- Status flow: Open → In Progress → Resolved

### `/missions` (Misi & Gamification)
- Koordinator creates missions
- Asleb claims and submits proof
- Verification flow
- Points awarded on approval

### `/ai-assistant` (AI Chat)
- Context-aware chat with lab data
- 20+ intent detection
- Conversation memory
- OpenAI GPT-4o-mini

### `/predictive` (Predictive Maintenance)
- PC risk scoring (5 factors)
- Maintenance schedule generator
- Trend analysis
- Lab health score

---

## Backend Route Modules (18 total)

| Module | Prefix | Purpose |
|---|---|---|
| auth | /auth | Login, register, profile |
| labs | /labs | Lab CRUD |
| schedules | /schedules | Schedule CRUD + conflict check |
| logbooks | /logbooks | Logbook lifecycle |
| keys | /keys | Key management + QR |
| attendance | /attendance | Asleb attendance + GPS |
| tickets | /tickets | Ticketing CRUD |
| missions | /missions | Mission system |
| reports | /reports | Monthly reports |
| users | /users | User management |
| leaderboard | /leaderboard | Ranking + points |
| export | /export | PDF/Excel generation |
| certificates | /certificates | Auto-certificate |
| notifications | /notifications | In-app + SSE |
| pcs | /pcs | PC monitoring + agent + inventory + energy |
| whatsapp | /whatsapp | WhatsApp bot admin |
| calendar | /calendar | Google Calendar sync |
| faq | /faq | AI FAQ bot |
| ai | /ai | AI assistant + predictive + scheduling |

---

## Database Schema (Key Models)

### Core Models
- `User` — id, name, email, password, role, semester, className, isActive, phone, waNotify, googleCalendarToken
- `Lab` — id, name, location, description, status
- `Schedule` — id, labId, title, semester, className, lecturerId, assistantId, startTime, endTime, status, type
- `Logbook` — id, scheduleId, labId, sessionType, officialCheckinBy/At, keyHolderId, keyTakenAt/ReturnedAt, conditionSubmittedBy/At, verifiedBy/At, officialCheckoutBy/At, status, notes
- `LogbookCondition` — id, logbookId, jumlahPcMenyala/Mati, kebersihanRuangan, statusAc/Lampu/Proyektor/Pintu, barangTertinggal, kerusakanBaru, catatanKondisi, fotoBukti
- `Key` — id, labId, keyCode, status, currentHolderId
- `KeyLog` — id, keyId, userId, action, timestamp
- `Attendance` — id, userId, checkinAt, checkoutAt, latitude, longitude, status, notes
- `DailyTaskLog` — id, userId, category, description, duration, photoUrl, labId, verified, verifiedBy
- `Ticket` — id, pcId, reporterId, assigneeId, category, description, photoUrl, status, priority
- `Mission` — id, title, description, points, deadline, status, createdBy
- `MissionClaim` — id, missionId, aslebId, status, proof, verifiedBy, verifiedAt
- `PC` — id, labId, pcCode, name, positionX/Y, status, specs(JSON), ipAddress, macAddress, qrCode, + 15 agent columns
- `PCCommand` — id, pcId, command, status, payload, result, issuedBy, executedAt
- `PCStatusLog` — id, pcId, fromStatus, toStatus, reason, changedBy
- `PcAgentLog` — id, pcId, eventType, level, message
- `PcWarning` — id, pcId, warningType, severity, message, isResolved
- `Notification` — id, userId, type, title, message, isRead, metadata(Json)
- `Certificate` — id, userId, type, period, data(Json)
- `Point` — id, userId, amount, reason, sourceType, sourceId

### Key Enums
- `Role`: KOORDINATOR_LAB, ASISTEN_LAB, MAHASISWA
- `PCStatus`: AVAILABLE, IN_USE, BROKEN, MAINTENANCE, INACTIVE
- `AgentStatus`: ONLINE, OFFLINE, UNKNOWN
- `HealthStatus`: NORMAL, BROKEN, MAINTENANCE, NEEDS_CHECK
- `ScheduleStatus`: SCHEDULED, ONGOING, FINISHED, CANCELLED
- `LogbookStatus`: DRAFT, CHECKED_IN, WAITING_CONDITION, WAITING_VERIFICATION, COMPLETED, PROBLEM, CANCELLED
- `KeyStatus`: AVAILABLE, BORROWED, MISSING, MAINTENANCE
- `TicketStatus`: OPEN, IN_PROGRESS, WAITING, RESOLVED, REJECTED
- `MissionStatus`: OPEN, TAKEN, SUBMITTED, APPROVED, REJECTED
- `NotificationType`: SCHEDULE_REMINDER, KEY_NOT_RETURNED, ATTENDANCE_REMINDER, TICKET_ASSIGNED, TICKET_RESOLVED, MISSION_AVAILABLE, MISSION_VERIFIED, LOGBOOK_VERIFIED, CERTIFICATE_ISSUED, SYSTEM
- `TaskCategory`: PIKET_BERSIH, MAINTENANCE_PC, INVENTARIS, INSTALASI, PENDAMPINGAN, ADMINISTRASI, LAINNYA
- `CertificateType`: MONTHLY_BEST, ATTENDANCE_PERFECT, MISSION_MASTER

---

## Implementation Phases (Completed)

### Phase 1 — MVP Web Core ✅
Login multi-role, Dashboard (3 roles), Multi-lab, Jadwal, Logbook digital, QR kunci, Absensi GPS, Ticketing QR, Lab map manual, Mission system, Laporan bulanan

### Phase 1 Polish — RBAC & User Management ✅
User CRUD, Route Guard, Key validation (ketua kelas + jadwal aktif), Logbook condition validation, API auth headers

### Phase 2 — Enhanced Features ✅
Leaderboard, Export PDF/Excel (ExcelJS + PDFKit), Auto-Certificate, Enhanced Lab Map, Enhanced Daily Task Log (7 kategori), Enhanced Laporan (Recharts)

### Phase 3 — Notifications ✅
Notification model (10 types), Event-based triggers, Cron scheduler (node-cron), SSE real-time push, REST API, Frontend notification panel

### Phase 3 External — Integration ✅
WhatsApp Bot (Baileys), WhatsApp commands (/jadwal, /status, /absen, /kunci, /tiket, /misi, /poin), Google Calendar Sync (OAuth2), AI FAQ Bot (keyword + GPT-4o-mini fallback)

### Phase 4 — PC Management & Monitoring ✅
PC Monitoring Dashboard, Remote Action API (command queue), Hardware Inventory, PC Status History, Energy Dashboard, QR Code Generator, Bulk Operations, **PC Agent (Python)** with register/heartbeat/commands

### Phase 5 — Advanced AI ✅
AI Assistant (context-aware, 20+ intents, conversation memory), Predictive Maintenance (risk scoring, maintenance schedule, trends), Smart Scheduling AI (optimal slots, heatmap, load balancing, conflict detection)

### Phase 6 — PWA Mobile-First Refactor ✅ (May 2026)
**Complete responsive transformation for production PWA deployment:**
- Core Layout: Safe area insets, mobile sidebar (GPU-accelerated, 60fps), mobile topbar (full-screen search)
- Tables → Mobile Cards: 6 pages converted (users, attendance, inventory, predictive) with MobileCard component
- Forms: 12 pages refactored (min-h-[44px] inputs, w-full sm:w-auto buttons)
- Modals: 39 modals refactored (responsive padding, touch-friendly close)
- Typography: Consistent scale across 43 pages (text-2xl sm:text-3xl lg:text-4xl)
- Dashboard: Stat cards (min-h-[120px]), responsive grids
- PWA: Manifest, service worker, offline indicator, install prompt
- **Total:** 59 files changed, 2,629 insertions, 892 deletions

### Deferred to v2.0+
Smart Lock (ESP32, MQTT), Face Recognition Attendance, WebSocket real-time, Advanced IoT

---

## API Service

`frontend/src/services/api.ts` — Simple fetch wrapper:
- Base URL: `NEXT_PUBLIC_API_URL` (default: `http://localhost:5000/api/v1`)
- Auth: reads JWT from `localStorage`, attaches as `Authorization: Bearer <token>`
- Methods: `get<T>()`, `post<T>()`, `patch<T>()`, `delete<T>()`

---

## Key Credentials (Development)

- Admin: `admin@labkom.ac.id` / `admin123`
- Backend port: 5000
- Frontend port: 3000
- Database: PostgreSQL via Docker (labkom-postgres)

---

## Common Gotchas

1. **Bun 1.3.12 + tsx**: Module resolution broken. Always use `tsc` then `node dist/server.js`
2. **Prisma PC model**: Accessor is `prisma.pC` not `prisma.pc`
3. **Next.js 15**: Breaking changes from training data — check `node_modules/next/dist/docs/`
4. **Agent auth**: Token is SHA-256 hashed (not bcrypt). Plain token shown only once at generation.
5. **Migrations workflow**: `prisma db push` is for local dev. Production CI runs `prisma migrate deploy` against the tracked baseline at `backend/prisma/migrations/0_init/` — keep new schema changes in dedicated migration folders rather than relying on db push for prod.
6. **Logbook roles**: Only Asleb can check-in/check-out; Koordinator may act as operational/admin fallback where implemented. Ketua kelas can only validate condition.
7. **Key access**: Mahasiswa/Ketua kelas can only take key if there's an active schedule AND they're authorized.
8. **GPS attendance**: Asleb attendance requires valid GPS location.
9. **Ticket → Mission**: Tickets can become missions for gamification points.
10. **PWA Mobile-First**: All pages responsive (320px–1280px+), touch targets ≥44px, safe area insets for fullscreen mode.

---

## Development Priorities (Roadmap)

```
Web Management (DONE)
→ QR Tracking (DONE)
→ Ticketing (DONE)
→ Interactive Lab Map (DONE)
→ Notification (DONE)
→ PC Agent (DONE)
→ PWA Mobile-First (DONE)
→ Smart Lock (v2.0)
→ AI & Face Recognition (v2.0)
```

---

## Libraries Used

**Backend:**
- express, prisma, bcrypt, jsonwebtoken, node-cron, @whiskeysockets/baileys, googleapis, exceljs, pdfkit, qrcode

**Frontend:**
- next 15, react, framer-motion, recharts, react-icons (tabler), tailwindcss

**PC Agent:**
- python, psutil, requests
