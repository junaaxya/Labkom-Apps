# LabKom — Blueprint Lengkap PC Agent untuk Integrasi Dashboard Web

Dokumen ini berisi konsep, workflow, arsitektur, database, API, keamanan, dan roadmap implementasi **PC Agent** untuk sistem **LabKom**.

Tujuan dokumen ini adalah agar AI/developer dapat memahami fitur PC Agent secara lengkap dan bisa mengeksekusi implementasinya secara bertahap.

---

# 1. Konsep Utama PC Agent

**PC Agent** adalah aplikasi kecil yang di-install di setiap komputer laboratorium.

Aplikasi ini berjalan di background dan bertugas menjadi penghubung antara komputer fisik di lab dengan dashboard web LabKom.

Tugas utama PC Agent:

```txt
1. Membaca kondisi komputer lab
2. Mengirim status komputer ke server LabKom
3. Mengirim spesifikasi hardware komputer
4. Menerima command dari dashboard
5. Menjalankan command tertentu seperti shutdown/restart
6. Mengirim hasil command kembali ke server
```

Tanpa PC Agent, dashboard hanya bisa menampilkan data manual. Dengan PC Agent, dashboard bisa mengetahui kondisi PC secara otomatis.

---

# 2. Tujuan PC Agent

PC Agent dibuat untuk mendukung fitur berikut:

```txt
Monitoring PC online/offline
Monitoring CPU usage
Monitoring RAM usage
Monitoring storage usage
Monitoring IP address
Monitoring hostname
Monitoring OS
Monitoring uptime
Auto inventory hardware
Remote shutdown
Remote restart
Integrasi dengan peta lab
Integrasi dengan ticketing
Integrasi dengan smart energy management
Integrasi dengan lab health score
```

---

# 3. Posisi PC Agent dalam Sistem LabKom

Arsitektur sederhana:

```txt
PC Lab
→ PC Agent berjalan di background
→ PC Agent membaca data PC
→ PC Agent mengirim heartbeat ke API LabKom
→ Backend LabKom menyimpan data ke database
→ Dashboard LabKom membaca data dari database
→ Aslab/Koordinator melihat status PC di dashboard
```

Arsitektur command:

```txt
Aslab/Koordinator klik Shutdown PC di dashboard
→ Backend LabKom membuat command untuk PC target
→ Command disimpan ke database
→ PC Agent mengambil command dari server
→ PC Agent menjalankan command di PC
→ PC Agent mengirim hasil eksekusi ke server
→ Dashboard menampilkan status command
```

---

# 4. Prinsip Desain PC Agent

PC Agent harus dibuat dengan prinsip:

```txt
Aman
Ringan
Stabil
Mudah dipasang
Tidak mengganggu pengguna PC
Tidak mengambil data pribadi mahasiswa
Hanya membaca data teknis perangkat
Semua command harus tercatat
Semua command harus punya validasi role
```

PC Agent tidak boleh digunakan untuk:

```txt
Keylogger
Screen capture otomatis
Membaca file pribadi user
Menghapus file user
Remote control penuh tanpa izin
Monitoring aplikasi yang dibuka mahasiswa
Mengambil data sensitif pengguna
```

---

# 5. Fitur PC Agent Berdasarkan Prioritas

## 5.1 Phase 1 — Monitoring Dasar

Fitur pertama yang harus dibuat:

```txt
Heartbeat online/offline
Hostname
IP address
Operating system
CPU usage
RAM usage
Storage usage
Uptime
Last seen
Agent version
```

Output:

```txt
Dashboard bisa menampilkan PC mana yang online/offline.
Dashboard bisa menampilkan CPU, RAM, dan storage setiap PC.
Peta lab bisa berubah warna berdasarkan status PC.
```

---

## 5.2 Phase 2 — Auto Inventory

Fitur:

```txt
CPU model
RAM total
Storage total
MAC address
OS version
Architecture
Disk info
Agent installed status
```

Output:

```txt
Data spesifikasi PC otomatis masuk ke database.
Koordinator tidak perlu input spesifikasi PC secara manual.
```

---

## 5.3 Phase 3 — Remote Command

Fitur:

```txt
Remote shutdown
Remote restart
Command queue
Command result
Command history
Command audit log
```

Output:

```txt
Aslab/Koordinator bisa shutdown/restart PC dari dashboard.
Semua command tercatat di database.
```

---

## 5.4 Phase 4 — Smart Warning

Fitur:

```txt
Warning storage hampir penuh
Warning RAM terlalu tinggi
Warning CPU terlalu tinggi
Warning PC tidak aktif
Warning agent tidak mengirim heartbeat
Warning PC sering offline
```

Output:

```txt
Dashboard bisa memberi peringatan otomatis.
Aslab bisa lebih cepat menangani PC bermasalah.
```

---

## 5.5 Phase 5 — Smart Energy Management

Fitur:

```txt
Auto shutdown setelah jadwal terakhir selesai
Shutdown massal satu lab
Restart massal satu lab
Shutdown hanya PC yang online
Blokir shutdown jika ada jadwal aktif
Override khusus Koordinator
```

Output:

```txt
Lab lebih hemat energi.
PC yang lupa dimatikan bisa dimatikan otomatis.
```

---

# 6. Workflow Utama PC Agent

## 6.1 Workflow Register Agent

Register Agent adalah proses awal saat PC Agent pertama kali dijalankan di PC lab.

Flow:

```txt
Koordinator/Aslab membuat data PC di dashboard LabKom
→ Sistem membuat pc_code dan agent_token
→ PC Agent di-install di PC lab
→ PC Agent membaca file config lokal
→ PC Agent mengirim request register ke server
→ Server memvalidasi pc_code dan agent_token
→ Server menyimpan data hardware awal
→ Server menandai agent sebagai installed
→ PC muncul aktif di dashboard
```

Contoh `pc_code`:

```txt
LABD-PC-001
LABD-PC-002
LABD-PC-003
LABM-PC-001
LABM-PC-002
LABM-PC-003
```

Contoh `config.json`:

```json
{
  "pc_code": "LABD-PC-001",
  "agent_token": "TOKEN_RAHASIA_PC_001",
  "base_url": "https://labkom.ac.id/api/agent",
  "heartbeat_interval": 60,
  "command_poll_interval": 30,
  "agent_version": "1.0.0"
}
```

---

## 6.2 Workflow Heartbeat

Heartbeat adalah sinyal rutin dari PC Agent untuk memberi tahu server bahwa PC masih aktif.

Flow:

```txt
PC Agent berjalan di background
→ Setiap 60 detik Agent membaca kondisi PC
→ Agent mengirim data ke endpoint heartbeat
→ Server memvalidasi token
→ Server update last_seen_at
→ Server update agent_status
→ Server update data CPU/RAM/storage terbaru
→ Dashboard menampilkan PC online
```

Payload heartbeat:

```json
{
  "pc_code": "LABD-PC-001",
  "hostname": "LABD-PC-001",
  "ip_address": "192.168.1.21",
  "os": "Windows 11 Pro",
  "cpu_usage": 24.5,
  "ram_usage": 61.2,
  "storage_usage": 72.8,
  "uptime_seconds": 18400,
  "agent_version": "1.0.0"
}
```

Rule online/offline:

```txt
Jika last_seen_at <= 120 detik dari waktu sekarang
→ PC dianggap ONLINE

Jika last_seen_at > 120 detik dari waktu sekarang
→ PC dianggap OFFLINE

Jika belum pernah mengirim heartbeat
→ PC dianggap UNKNOWN
```

Catatan:

```txt
Status OFFLINE tidak dikirim oleh agent.
Server yang menyimpulkan status OFFLINE berdasarkan last_seen_at.
```

---

## 6.3 Workflow Auto Inventory

Auto Inventory digunakan untuk mengisi spesifikasi PC secara otomatis.

Flow:

```txt
PC Agent pertama kali berjalan
→ Agent membaca spesifikasi hardware
→ Agent mengirim data inventory ke server
→ Server update data PC
→ Dashboard menampilkan detail hardware
```

Payload inventory:

```json
{
  "pc_code": "LABD-PC-001",
  "hostname": "LABD-PC-001",
  "os": "Windows 11 Pro",
  "cpu_model": "Intel Core i5-12400",
  "ram_total_gb": 16,
  "storage_total_gb": 512,
  "mac_address": "AA:BB:CC:DD:EE:FF",
  "architecture": "64bit",
  "agent_version": "1.0.0"
}
```

Inventory dikirim pada kondisi:

```txt
Saat agent pertama kali dijalankan
Saat agent restart
Sekali sehari
Saat ada perubahan hardware
```

---

## 6.4 Workflow Fetch Command

PC Agent tidak menerima command secara langsung dari dashboard. Agent mengambil command dari server melalui polling.

Flow:

```txt
Agent berjalan di background
→ Setiap 30 detik Agent request ke endpoint commands
→ Server validasi token
→ Server mencari command PENDING untuk PC tersebut
→ Jika ada, server mengirim command
→ Agent mengeksekusi command
→ Agent melaporkan hasil command
```

Response jika ada command:

```json
{
  "success": true,
  "commands": [
    {
      "id": "cmd_001",
      "type": "SHUTDOWN",
      "reason": "Praktikum selesai",
      "created_at": "2026-05-02T10:15:00Z"
    }
  ]
}
```

Response jika tidak ada command:

```json
{
  "success": true,
  "commands": []
}
```

---

## 6.5 Workflow Remote Shutdown

Flow lengkap:

```txt
Aslab/Koordinator membuka dashboard PC Monitoring
→ User memilih PC target
→ User klik tombol Shutdown
→ Dashboard menampilkan modal konfirmasi
→ User mengisi alasan shutdown
→ Backend memvalidasi role user
→ Backend mengecek status PC
→ Backend mengecek jadwal aktif pada lab tersebut
→ Jika valid, backend membuat command SHUTDOWN dengan status PENDING
→ Agent mengambil command saat polling
→ Server mengubah status command menjadi SENT
→ Agent menjalankan command shutdown di PC
→ Agent mengirim status RUNNING
→ Agent mengirim status SUCCESS/FAILED
→ Dashboard menampilkan hasil command
→ Audit log tersimpan
```

Command Windows:

```txt
shutdown /s /t 10
```

Command Linux:

```txt
shutdown now
```

Rule keamanan:

```txt
Remote shutdown hanya boleh dilakukan oleh Koordinator atau Aslab yang memiliki akses.
Tidak boleh shutdown jika ada jadwal aktif.
Tidak boleh shutdown 15 menit sebelum jadwal berikutnya.
Koordinator boleh override jika darurat.
Semua command harus punya alasan.
Semua command harus masuk audit log.
```

---

## 6.6 Workflow Remote Restart

Flow:

```txt
Aslab/Koordinator memilih PC
→ Klik Restart
→ Isi alasan
→ Backend cek role, jadwal, dan status PC
→ Backend membuat command RESTART
→ Agent mengambil command
→ Agent menjalankan restart
→ Agent mengirim hasil command
→ Dashboard update command status
```

Command Windows:

```txt
shutdown /r /t 10
```

Command Linux:

```txt
reboot
```

---

## 6.7 Workflow Shutdown Massal

Shutdown massal digunakan untuk mematikan semua PC online dalam satu lab.

Flow:

```txt
Aslab/Koordinator memilih Lab
→ Klik Shutdown Semua PC Online
→ Backend cek apakah lab sedang digunakan
→ Backend cek jadwal aktif
→ Backend menampilkan daftar PC yang akan dimatikan
→ User konfirmasi dan mengisi alasan
→ Backend membuat command untuk setiap PC online
→ Setiap PC Agent mengambil command masing-masing
→ Setiap Agent menjalankan shutdown
→ Setiap Agent mengirim hasil command
→ Dashboard menampilkan progress
```

Progress command:

```txt
LABD-PC-001 → PENDING
LABD-PC-002 → SENT
LABD-PC-003 → SUCCESS
LABD-PC-004 → FAILED
LABD-PC-005 → OFFLINE
```

Rule:

```txt
Tidak boleh shutdown massal saat ada jadwal aktif.
Tidak boleh shutdown massal jika ada jadwal berikutnya dalam 30 menit.
Override hanya boleh oleh Koordinator.
Semua command massal wajib masuk audit log.
```

---

# 7. Konsep Command Queue

PC Agent menggunakan konsep command queue.

Artinya command tidak langsung dikirim ke PC. Command disimpan di database terlebih dahulu.

Flow command queue:

```txt
Dashboard membuat command
→ Command disimpan di database
→ Agent melakukan polling command
→ Server mengirim command ke Agent
→ Agent menjalankan command
→ Agent mengirim hasil command
→ Server update status command
```

Status command:

```txt
PENDING
SENT
RUNNING
SUCCESS
FAILED
CANCELLED
EXPIRED
```

Flow sukses:

```txt
PENDING
→ SENT
→ RUNNING
→ SUCCESS
```

Flow gagal:

```txt
PENDING
→ SENT
→ RUNNING
→ FAILED
```

Flow expired:

```txt
PENDING
→ EXPIRED
```

Contoh command:

```json
{
  "id": "cmd_001",
  "pc_code": "LABD-PC-001",
  "command_type": "SHUTDOWN",
  "status": "PENDING",
  "requested_by": "aslab_001",
  "reason": "Praktikum selesai, PC masih menyala"
}
```

---

# 8. Status PC

Status PC sebaiknya dipisahkan menjadi dua jenis.

## 8.1 Agent Status

Agent status berasal dari heartbeat.

```txt
ONLINE
OFFLINE
UNKNOWN
```

| Status | Arti |
|---|---|
| ONLINE | Agent masih mengirim heartbeat |
| OFFLINE | Agent tidak mengirim heartbeat melewati batas waktu |
| UNKNOWN | Agent belum pernah mengirim heartbeat |

---

## 8.2 Health Status

Health status berasal dari sistem, ticketing, atau status manual.

```txt
NORMAL
BROKEN
MAINTENANCE
NEEDS_CHECK
```

| Status | Arti |
|---|---|
| NORMAL | PC dalam kondisi normal |
| BROKEN | PC rusak atau memiliki ticket critical |
| MAINTENANCE | PC sedang maintenance |
| NEEDS_CHECK | PC perlu dicek karena warning |

---

## 8.3 Kenapa Agent Status dan Health Status Dipisah?

Karena satu PC bisa punya kondisi gabungan.

Contoh:

```txt
PC online tapi mouse rusak.
PC offline tapi status hardware normal.
PC online tapi sedang maintenance.
PC online tapi storage hampir penuh.
```

Maka database harus menyimpan:

```txt
agent_status
health_status
```

---

# 9. Integrasi PC Agent dengan Dashboard

## 9.1 Dashboard Ringkasan PC

Dashboard menampilkan card:

```txt
Total PC
PC Online
PC Offline
PC Unknown
PC Maintenance
PC Broken
PC Needs Check
Storage Warning
Agent Inactive
```

Contoh:

```txt
Lab Dasar
Total PC: 25
Online: 18
Offline: 7
Warning: 3
```

---

## 9.2 Tabel PC Monitoring

Kolom tabel:

```txt
PC Code
Nama PC
Lab
Agent Status
Health Status
CPU
RAM
Storage
IP Address
Last Seen
Action
```

Contoh row:

```txt
LABD-PC-001 | PC 01 | Lab Dasar | ONLINE | NORMAL | CPU 24% | RAM 61% | Storage 73% | 192.168.1.21 | 1 menit lalu | Detail
```

Action:

```txt
Detail
Shutdown
Restart
Buat Ticket
Set Maintenance
Lihat Logs
```

---

## 9.3 Detail PC

Saat user klik PC, tampilkan detail:

```txt
Nama PC
Kode PC
Lab
Hostname
IP Address
MAC Address
Operating System
Architecture
CPU Model
RAM Total
Storage Total
CPU Usage
RAM Usage
Storage Usage
Uptime
Last Seen
Agent Version
Agent Status
Health Status
Ticket Aktif
Command History
Status Logs
Agent Logs
```

Action di detail PC:

```txt
Shutdown
Restart
Buat Ticket
Set Maintenance
Set Normal
Lihat Riwayat Command
Lihat Riwayat Status
```

---

## 9.4 Integrasi dengan Peta Lab

PC Agent mengubah warna PC di peta lab.

Flow:

```txt
Agent mengirim heartbeat
→ Server update status PC
→ Peta lab membaca status PC
→ Warna PC berubah otomatis
```

Warna:

```txt
Biru = ONLINE
Hijau = NORMAL / Available
Abu-abu = OFFLINE
Kuning = MAINTENANCE / NEEDS_CHECK
Merah = BROKEN / Critical Ticket
```

Prioritas warna:

```txt
BROKEN
→ MAINTENANCE
→ NEEDS_CHECK
→ ONLINE
→ OFFLINE
→ NORMAL
```

Contoh:

```txt
Jika PC online tapi punya ticket critical
→ Warna merah

Jika PC online tapi maintenance
→ Warna kuning

Jika PC online dan normal
→ Warna biru

Jika PC offline
→ Warna abu-abu
```

---

## 9.5 Integrasi dengan Ticketing

PC Agent bisa memicu warning atau ticket.

Flow warning storage:

```txt
Agent mengirim storage_usage 92%
→ Server mendeteksi storage tinggi
→ Sistem membuat warning
→ Dashboard menampilkan PC Needs Check
→ Aslab bisa membuat ticket dari warning
```

Flow auto ticket:

```txt
Storage PC > 95% selama 3 heartbeat berturut-turut
→ Sistem membuat ticket otomatis
→ Status PC menjadi NEEDS_CHECK
→ Peta lab menampilkan warna kuning
```

Contoh ticket otomatis:

```txt
Title: Storage hampir penuh pada LABD-PC-001
Category: Software/Storage
Priority: Medium
Description: Storage usage mencapai 96% selama 3 kali heartbeat.
```

---

## 9.6 Integrasi dengan Jadwal

Command shutdown/restart harus memeriksa jadwal lab.

Flow:

```txt
Aslab klik shutdown
→ Backend cek lab dari PC target
→ Backend cek jadwal lab saat ini
→ Jika ada jadwal Ongoing, command ditolak
→ Jika tidak ada jadwal aktif, command dibuat
```

Rule:

```txt
Tidak boleh shutdown saat jadwal Ongoing.
Tidak boleh shutdown 15 menit sebelum jadwal berikutnya.
Tidak boleh shutdown jika ada sesi lab yang belum checkout.
Koordinator bisa override dengan alasan.
```

---

## 9.7 Integrasi dengan Smart Energy

Smart energy menggunakan data PC Agent dan jadwal.

Flow:

```txt
Cron job berjalan setiap 5 menit
→ Sistem cek jadwal lab
→ Sistem cek apakah ada jadwal aktif
→ Sistem cek apakah ada jadwal berikutnya dalam 30 menit
→ Sistem cek PC online di lab
→ Jika aman, sistem membuat command shutdown untuk PC online
→ Agent mengambil command
→ Agent shutdown PC
→ Dashboard menampilkan hasil
```

Rule:

```txt
Jangan shutdown jika ada jadwal aktif.
Jangan shutdown jika ada jadwal berikutnya dalam 30 menit.
Shutdown otomatis hanya berjalan setelah jadwal terakhir selesai + 15 menit.
Semua auto shutdown masuk audit log.
```

---

## 9.8 Integrasi dengan Lab Health Score

PC Agent memengaruhi skor kesehatan lab.

Contoh faktor:

```txt
Jumlah PC offline
Jumlah PC storage warning
Jumlah PC needs check
Jumlah PC broken
Jumlah ticket critical
Jumlah maintenance selesai
```

Contoh tampilan:

```txt
Lab Dasar Health Score: 82/100

Penyebab:
- 3 PC offline
- 2 PC storage hampir penuh
- 1 ticket critical
```

---

# 10. Database yang Dibutuhkan

## 10.1 Tabel `pcs`

Menyimpan data utama PC.

```txt
id
lab_id
pc_code
name
hostname
ip_address
mac_address
os
architecture
cpu_model
ram_total_gb
storage_total_gb
agent_status
health_status
cpu_usage
ram_usage
storage_usage
uptime_seconds
last_seen_at
agent_version
agent_token_hash
is_agent_installed
created_at
updated_at
```

Contoh:

```txt
pc_code: LABD-PC-001
name: PC 01
lab_id: LABD
agent_status: ONLINE
health_status: NORMAL
last_seen_at: 2026-05-02 10:15:00
```

---

## 10.2 Tabel `pc_status_logs`

Menyimpan riwayat status PC.

```txt
id
pc_id
cpu_usage
ram_usage
storage_usage
cpu_temp
uptime_seconds
agent_status
health_status
recorded_at
```

Catatan:

```txt
Jangan menyimpan log heartbeat setiap 60 detik selamanya.
Simpan status terbaru di tabel pcs.
Simpan log detail setiap 5 menit.
Hapus/arsipkan log lama setelah 30-90 hari.
```

---

## 10.3 Tabel `pc_commands`

Menyimpan command yang dikirim ke PC.

```txt
id
pc_id
command_type
status
requested_by
reason
is_override
requested_at
sent_at
executed_at
finished_at
result_message
error_message
created_at
updated_at
```

Command type:

```txt
SHUTDOWN
RESTART
LOCK_SCREEN
SHOW_MESSAGE
```

Untuk MVP:

```txt
SHUTDOWN
RESTART
```

---

## 10.4 Tabel `pc_agent_logs`

Menyimpan log aktivitas agent.

```txt
id
pc_id
event_type
message
level
created_at
```

Event type:

```txt
AGENT_STARTED
AGENT_STOPPED
HEARTBEAT_SENT
COMMAND_RECEIVED
COMMAND_RUNNING
COMMAND_SUCCESS
COMMAND_FAILED
REGISTERED
ERROR
```

Level:

```txt
INFO
WARNING
ERROR
```

---

## 10.5 Tabel `pc_warnings`

Menyimpan warning dari sistem.

```txt
id
pc_id
warning_type
severity
message
is_resolved
resolved_by
resolved_at
created_at
updated_at
```

Warning type:

```txt
CPU_HIGH
RAM_HIGH
STORAGE_HIGH
AGENT_INACTIVE
PC_OFFLINE_TOO_LONG
```

Severity:

```txt
LOW
MEDIUM
HIGH
CRITICAL
```

---

## 10.6 Tabel `audit_logs`

Mencatat aktivitas user dari dashboard.

```txt
id
user_id
action
target_type
target_id
description
ip_address
created_at
```

Contoh:

```txt
User Aslab Budi membuat command SHUTDOWN untuk LABD-PC-001.
```

---

# 11. API yang Dibutuhkan

## 11.1 Endpoint Khusus Agent

```txt
POST /api/agent/register
POST /api/agent/heartbeat
GET  /api/agent/commands
POST /api/agent/commands/:commandId/result
POST /api/agent/logs
```

---

### 11.1.1 `POST /api/agent/register`

Fungsi:

```txt
Mendaftarkan agent dan mengirim inventory awal.
```

Request:

```json
{
  "pc_code": "LABD-PC-001",
  "hostname": "LABD-PC-001",
  "ip_address": "192.168.1.21",
  "mac_address": "AA:BB:CC:DD:EE:FF",
  "os": "Windows 11 Pro",
  "architecture": "64bit",
  "cpu_model": "Intel Core i5-12400",
  "ram_total_gb": 16,
  "storage_total_gb": 512,
  "agent_version": "1.0.0"
}
```

Response:

```json
{
  "success": true,
  "message": "Agent registered successfully",
  "server_time": "2026-05-02T10:15:00Z"
}
```

Backend process:

```txt
Validasi token
Cari PC berdasarkan pc_code
Jika PC ditemukan, update inventory
Set is_agent_installed = true
Set agent_status = ONLINE
Set last_seen_at = now
Simpan agent log REGISTERED
Return success
```

---

### 11.1.2 `POST /api/agent/heartbeat`

Fungsi:

```txt
Menerima status berkala dari PC Agent.
```

Request:

```json
{
  "pc_code": "LABD-PC-001",
  "hostname": "LABD-PC-001",
  "ip_address": "192.168.1.21",
  "cpu_usage": 24.5,
  "ram_usage": 61.2,
  "storage_usage": 72.8,
  "uptime_seconds": 18400,
  "agent_version": "1.0.0"
}
```

Response:

```json
{
  "success": true,
  "status": "ONLINE",
  "next_heartbeat_interval": 60
}
```

Backend process:

```txt
Validasi token
Cari PC berdasarkan pc_code
Update hostname/IP jika berubah
Update CPU/RAM/storage
Update uptime
Update last_seen_at = now
Update agent_status = ONLINE
Simpan status log jika sudah waktunya
Cek threshold warning
Return success
```

---

### 11.1.3 `GET /api/agent/commands?pc_code=LABD-PC-001`

Fungsi:

```txt
Agent mengambil command yang belum dieksekusi.
```

Response jika ada command:

```json
{
  "success": true,
  "commands": [
    {
      "id": "cmd_001",
      "type": "SHUTDOWN",
      "reason": "Praktikum selesai",
      "created_at": "2026-05-02T10:15:00Z"
    }
  ]
}
```

Response jika tidak ada command:

```json
{
  "success": true,
  "commands": []
}
```

Backend process:

```txt
Validasi token
Cari PC berdasarkan pc_code
Cari command PENDING untuk PC tersebut
Update command status menjadi SENT
Set sent_at = now
Return command
```

---

### 11.1.4 `POST /api/agent/commands/:commandId/result`

Fungsi:

```txt
Agent melaporkan hasil command.
```

Request sukses:

```json
{
  "status": "SUCCESS",
  "message": "Shutdown command executed"
}
```

Request gagal:

```json
{
  "status": "FAILED",
  "message": "Command failed",
  "error": "Permission denied"
}
```

Backend process:

```txt
Validasi token
Cari command berdasarkan commandId
Pastikan command milik PC tersebut
Update status command
Update result_message/error_message
Update executed_at/finished_at
Simpan pc_agent_logs
Return success
```

---

### 11.1.5 `POST /api/agent/logs`

Fungsi:

```txt
Agent mengirim log aktivitas.
```

Request:

```json
{
  "pc_code": "LABD-PC-001",
  "event_type": "AGENT_STARTED",
  "level": "INFO",
  "message": "Agent started successfully"
}
```

---

## 11.2 Endpoint Dashboard

```txt
GET    /api/admin/pcs
GET    /api/admin/pcs/:id
POST   /api/admin/pcs
PATCH  /api/admin/pcs/:id
POST   /api/admin/pcs/:id/commands
POST   /api/admin/labs/:labId/commands/shutdown
GET    /api/admin/pcs/:id/status-logs
GET    /api/admin/pcs/:id/commands
GET    /api/admin/pcs/:id/warnings
PATCH  /api/admin/pcs/:id/health-status
```

---

### 11.2.1 `GET /api/admin/pcs`

Fungsi:

```txt
Menampilkan daftar PC untuk dashboard.
```

Query:

```txt
lab_id
agent_status
health_status
search
```

Response:

```json
{
  "pcs": [
    {
      "id": 1,
      "pc_code": "LABD-PC-001",
      "name": "PC 01",
      "lab": "Lab Dasar",
      "agent_status": "ONLINE",
      "health_status": "NORMAL",
      "cpu_usage": 24.5,
      "ram_usage": 61.2,
      "storage_usage": 72.8,
      "last_seen_at": "2026-05-02T10:15:00Z"
    }
  ]
}
```

---

### 11.2.2 `POST /api/admin/pcs/:id/commands`

Fungsi:

```txt
Membuat command untuk satu PC.
```

Request:

```json
{
  "command_type": "SHUTDOWN",
  "reason": "Praktikum selesai",
  "override": false
}
```

Backend validation:

```txt
User harus login
Role harus Koordinator/Aslab
PC harus ada
Command type harus valid
Reason wajib
Cek jadwal aktif
Cek command duplicate
Simpan command PENDING
Simpan audit log
```

---

### 11.2.3 `POST /api/admin/labs/:labId/commands/shutdown`

Fungsi:

```txt
Membuat command shutdown massal untuk satu lab.
```

Request:

```json
{
  "reason": "Semua sesi hari ini sudah selesai",
  "override": false
}
```

Backend validation:

```txt
User harus login
Role Koordinator/Aslab
Lab harus ada
Cek jadwal aktif
Cek jadwal berikutnya
Ambil semua PC ONLINE
Buat command untuk setiap PC
Simpan audit log massal
```

---

# 12. Security Design

## 12.1 Token Per PC

Setiap PC memiliki token unik.

```txt
LABD-PC-001 → TOKEN_A
LABD-PC-002 → TOKEN_B
LABM-PC-001 → TOKEN_C
```

Token dikirim lewat header:

```txt
Authorization: Bearer TOKEN_RAHASIA
```

Backend tidak menyimpan token asli, tetapi hash token:

```txt
agent_token_hash
```

---

## 12.2 Config Lokal Agent

Token disimpan di file lokal PC.

```txt
config.json
```

Jangan upload token ke GitHub.

Contoh:

```json
{
  "pc_code": "LABD-PC-001",
  "agent_token": "TOKEN_RAHASIA_PC_001",
  "base_url": "https://labkom.ac.id/api/agent",
  "heartbeat_interval": 60,
  "command_poll_interval": 30,
  "agent_version": "1.0.0"
}
```

---

## 12.3 Validasi Request Agent

Setiap request agent harus dicek:

```txt
Apakah pc_code terdaftar?
Apakah token valid?
Apakah token sesuai dengan PC?
Apakah agent_version valid?
Apakah request terlalu sering?
Apakah payload valid?
```

---

## 12.4 Role untuk Remote Command

Role yang boleh mengirim command:

```txt
Koordinator
Aslab
```

Role yang tidak boleh:

```txt
Mahasiswa
Ketua Kelas
```

---

## 12.5 Audit Log

Semua command wajib tercatat.

Contoh audit:

```txt
Aslab Budi menjalankan SHUTDOWN pada LABD-PC-001.
Alasan: Praktikum selesai.
Waktu: 2026-05-02 16:10.
```

---

## 12.6 Command yang Diizinkan MVP

Untuk MVP hanya izinkan:

```txt
SHUTDOWN
RESTART
```

Command yang tidak boleh dibuat dulu:

```txt
REMOTE_DELETE_FILE
SCREEN_CAPTURE
REMOTE_CONTROL
KEYLOGGER
READ_USER_FILES
INSTALL_SOFTWARE
```

---

# 13. Logic Warning

Threshold awal:

```txt
CPU usage > 90% selama 5 menit → CPU_HIGH
RAM usage > 90% selama 5 menit → RAM_HIGH
Storage usage > 85% → STORAGE_HIGH
Storage usage > 95% → STORAGE_CRITICAL
Tidak heartbeat > 10 menit → AGENT_INACTIVE
PC offline > 1 hari → PC_OFFLINE_TOO_LONG
```

Rule agar tidak false alarm:

```txt
Warning muncul jika kondisi terjadi minimal 3 heartbeat berturut-turut.
```

Flow warning:

```txt
Agent heartbeat
→ Server cek threshold
→ Jika threshold terpenuhi 3 kali berturut-turut
→ Server membuat warning
→ PC health_status menjadi NEEDS_CHECK
→ Dashboard menampilkan warning
```

---

# 14. Desain Local PC Agent

Struktur folder:

```txt
labkom-agent/
├── agent.py
├── config.json
├── requirements.txt
├── logs/
│   └── agent.log
└── README.md
```

`requirements.txt`:

```txt
psutil
requests
```

---

## 14.1 Pseudocode Agent

```txt
START
→ Load config.json
→ Validasi config
→ Register agent ke server
→ LOOP:
      Collect system info
      Send heartbeat
      Fetch pending commands
      Execute allowed commands
      Report command result
      Sleep beberapa detik
```

---

## 14.2 Pseudocode Detail

```txt
Load config
Jika config tidak valid:
    tulis error
    stop agent

Register agent ke server

Set last_heartbeat = 0
Set last_command_poll = 0

Loop forever:
    now = current time

    Jika now - last_heartbeat >= heartbeat_interval:
        collect system info
        send heartbeat
        update last_heartbeat

    Jika now - last_command_poll >= command_poll_interval:
        fetch commands from server
        for each command:
            validate command type
            execute command
            report result
        update last_command_poll

    sleep 5 seconds
```

---

# 15. Contoh Kode PC Agent Python MVP

```python
import psutil
import socket
import platform
import requests
import time
import json
import os
from pathlib import Path

CONFIG_PATH = Path("config.json")

def load_config():
    with open(CONFIG_PATH, "r") as file:
        return json.load(file)

config = load_config()

PC_CODE = config["pc_code"]
AGENT_TOKEN = config["agent_token"]
BASE_URL = config["base_url"]
HEARTBEAT_INTERVAL = config.get("heartbeat_interval", 60)
COMMAND_POLL_INTERVAL = config.get("command_poll_interval", 30)
AGENT_VERSION = config.get("agent_version", "1.0.0")

def headers():
    return {
        "Authorization": f"Bearer {AGENT_TOKEN}",
        "Content-Type": "application/json"
    }

def get_ip_address():
    try:
        hostname = socket.gethostname()
        return socket.gethostbyname(hostname)
    except Exception:
        return None

def get_storage_usage():
    try:
        disk = psutil.disk_usage("/")
        return {
            "storage_usage": disk.percent,
            "storage_total_gb": round(disk.total / (1024 ** 3), 2)
        }
    except Exception:
        return {
            "storage_usage": None,
            "storage_total_gb": None
        }

def collect_system_info():
    storage = get_storage_usage()

    return {
        "pc_code": PC_CODE,
        "hostname": socket.gethostname(),
        "ip_address": get_ip_address(),
        "os": platform.platform(),
        "architecture": platform.architecture()[0],
        "cpu_usage": psutil.cpu_percent(interval=1),
        "ram_usage": psutil.virtual_memory().percent,
        "ram_total_gb": round(psutil.virtual_memory().total / (1024 ** 3), 2),
        "storage_usage": storage["storage_usage"],
        "storage_total_gb": storage["storage_total_gb"],
        "uptime_seconds": int(time.time() - psutil.boot_time()),
        "agent_version": AGENT_VERSION
    }

def register_agent():
    try:
        data = collect_system_info()
        response = requests.post(
            f"{BASE_URL}/register",
            json=data,
            headers=headers(),
            timeout=10
        )
        print("Register:", response.status_code, response.text)
    except Exception as error:
        print("Register error:", error)

def send_heartbeat():
    try:
        data = collect_system_info()
        response = requests.post(
            f"{BASE_URL}/heartbeat",
            json=data,
            headers=headers(),
            timeout=10
        )
        print("Heartbeat:", response.status_code)
    except Exception as error:
        print("Heartbeat error:", error)

def fetch_commands():
    try:
        response = requests.get(
            f"{BASE_URL}/commands",
            params={"pc_code": PC_CODE},
            headers=headers(),
            timeout=10
        )

        if response.status_code == 200:
            return response.json().get("commands", [])

    except Exception as error:
        print("Fetch command error:", error)

    return []

def report_command_result(command_id, status, message):
    try:
        response = requests.post(
            f"{BASE_URL}/commands/{command_id}/result",
            json={
                "status": status,
                "message": message
            },
            headers=headers(),
            timeout=10
        )
        print("Report command:", response.status_code)
    except Exception as error:
        print("Report command error:", error)

def execute_command(command):
    command_id = command["id"]
    command_type = command["type"]

    try:
        if command_type == "SHUTDOWN":
            report_command_result(command_id, "RUNNING", "Shutdown command started")

            if platform.system().lower() == "windows":
                os.system("shutdown /s /t 10")
            else:
                os.system("shutdown now")

            report_command_result(command_id, "SUCCESS", "Shutdown command executed")

        elif command_type == "RESTART":
            report_command_result(command_id, "RUNNING", "Restart command started")

            if platform.system().lower() == "windows":
                os.system("shutdown /r /t 10")
            else:
                os.system("reboot")

            report_command_result(command_id, "SUCCESS", "Restart command executed")

        else:
            report_command_result(command_id, "FAILED", "Unknown command type")

    except Exception as error:
        report_command_result(command_id, "FAILED", str(error))

def main():
    register_agent()

    last_heartbeat = 0
    last_command_poll = 0

    while True:
        now = time.time()

        if now - last_heartbeat >= HEARTBEAT_INTERVAL:
            send_heartbeat()
            last_heartbeat = now

        if now - last_command_poll >= COMMAND_POLL_INTERVAL:
            commands = fetch_commands()
            for command in commands:
                execute_command(command)
            last_command_poll = now

        time.sleep(5)

if __name__ == "__main__":
    main()
```

---

# 16. Backend Logic yang Harus Dibuat

## 16.1 Register Handler

```txt
Terima request register
→ Validasi token
→ Cari PC berdasarkan pc_code
→ Jika PC tidak ada, return error
→ Update hostname, IP, MAC, OS, CPU, RAM, storage
→ Set is_agent_installed = true
→ Set agent_status = ONLINE
→ Set last_seen_at = now
→ Simpan agent log REGISTERED
→ Return success
```

---

## 16.2 Heartbeat Handler

```txt
Terima request heartbeat
→ Validasi token
→ Cari PC berdasarkan pc_code
→ Update hostname/IP jika berubah
→ Update CPU/RAM/storage
→ Update uptime
→ Update last_seen_at = now
→ Update agent_status = ONLINE
→ Simpan status log jika perlu
→ Cek warning threshold
→ Return success
```

---

## 16.3 Fetch Command Handler

```txt
Terima request GET commands
→ Validasi token
→ Cari PC berdasarkan pc_code
→ Cari command PENDING milik PC tersebut
→ Update command status menjadi SENT
→ Set sent_at = now
→ Return command ke agent
```

---

## 16.4 Command Result Handler

```txt
Terima result command
→ Validasi token
→ Cari command berdasarkan commandId
→ Pastikan command milik PC tersebut
→ Update status command
→ Jika status RUNNING, set executed_at
→ Jika status SUCCESS/FAILED, set finished_at
→ Simpan result_message/error_message
→ Simpan pc_agent_logs
→ Return success
```

---

## 16.5 Dashboard Command Handler

```txt
User klik shutdown/restart
→ Cek login
→ Cek role
→ Cek PC target
→ Cek jadwal aktif
→ Cek reason
→ Cek apakah command duplicate
→ Buat command PENDING
→ Simpan audit log
→ Return success
```

---

# 17. UI Dashboard yang Harus Dibuat

## 17.1 Halaman PC Monitoring

Fungsi:

```txt
Menampilkan seluruh PC lab beserta status agent dan kondisi resource.
```

Komponen:

```txt
Summary cards
Filter lab
Filter status
Search PC
Table PC
Action button
```

Summary cards:

```txt
Total PC
Online
Offline
Unknown
Broken
Maintenance
Needs Check
Storage Warning
```

---

## 17.2 Tabel PC

Kolom:

```txt
PC Code
Nama PC
Lab
Agent Status
Health Status
CPU
RAM
Storage
IP Address
Last Seen
Action
```

Action:

```txt
Detail
Shutdown
Restart
Create Ticket
Set Maintenance
```

---

## 17.3 Detail PC Drawer

Isi:

```txt
Basic Info
Hardware Info
Resource Usage
Agent Info
Ticket Aktif
Command History
Warning
Status Logs
```

Action:

```txt
Shutdown
Restart
Create Ticket
Set Health Status
View Logs
```

---

## 17.4 Command Confirmation Modal

Sebelum shutdown/restart:

```txt
Tampilkan nama PC
Tampilkan status PC
Tampilkan jadwal lab saat ini
Tampilkan warning jika ada jadwal aktif
Field alasan wajib
Checkbox konfirmasi
Tombol submit
```

Contoh field alasan:

```txt
Alasan: Praktikum sudah selesai dan PC masih menyala.
```

---

## 17.5 Integrasi Peta Lab

Pada peta lab:

```txt
PC online → biru
PC offline → abu-abu
PC broken → merah
PC maintenance → kuning
PC normal → hijau
```

Klik PC di peta:

```txt
Tampilkan detail singkat
CPU/RAM/Storage
Last seen
Ticket aktif
Button Detail
Button Shutdown/Restart jika role valid
```

---

# 18. Instalasi Agent di PC Lab

## 18.1 Development Mode

Langkah:

```txt
Install Python
Install dependency
Isi config.json
Jalankan agent.py
```

Command:

```bash
pip install -r requirements.txt
python agent.py
```

---

## 18.2 Production di Windows

Opsi:

```txt
Task Scheduler
NSSM Windows Service
PyInstaller menjadi .exe
```

Rekomendasi awal:

```txt
Task Scheduler
```

Flow Task Scheduler:

```txt
PC menyala
→ Windows startup
→ Task Scheduler menjalankan agent.py
→ Agent berjalan di background
```

Rekomendasi lanjutan:

```txt
Build agent menjadi .exe
→ Install sebagai Windows Service dengan NSSM
```

---

## 18.3 Production di Linux

Gunakan systemd.

Contoh service:

```txt
/etc/systemd/system/labkom-agent.service
```

Flow:

```txt
PC booting
→ systemd menjalankan labkom-agent
→ agent berjalan di background
```

---

# 19. Error Handling

## 19.1 Jika Internet Mati

```txt
Agent tetap berjalan
Heartbeat gagal
Agent menulis log lokal
Agent retry pada interval berikutnya
Agent tidak crash
```

---

## 19.2 Jika Server Down

```txt
Agent tetap berjalan
Request gagal
Agent retry
Command tidak dieksekusi sampai server kembali
```

---

## 19.3 Jika Config Salah

```txt
Agent menampilkan pesan error
Agent menulis log lokal
Agent berhenti dengan aman
```

---

## 19.4 Jika Command Gagal

```txt
Agent report FAILED
Agent mengirim error message
Dashboard menampilkan status gagal
Command history tersimpan
```

---

# 20. Roadmap Implementasi Siap Eksekusi

## Step 1 — Buat Database

Buat tabel:

```txt
pcs
pc_status_logs
pc_commands
pc_agent_logs
pc_warnings
audit_logs
```

---

## Step 2 — Buat API Agent

Endpoint:

```txt
POST /api/agent/register
POST /api/agent/heartbeat
GET  /api/agent/commands
POST /api/agent/commands/:commandId/result
POST /api/agent/logs
```

---

## Step 3 — Buat API Dashboard

Endpoint:

```txt
GET    /api/admin/pcs
GET    /api/admin/pcs/:id
POST   /api/admin/pcs
PATCH  /api/admin/pcs/:id
POST   /api/admin/pcs/:id/commands
POST   /api/admin/labs/:labId/commands/shutdown
GET    /api/admin/pcs/:id/status-logs
GET    /api/admin/pcs/:id/commands
GET    /api/admin/pcs/:id/warnings
PATCH  /api/admin/pcs/:id/health-status
```

---

## Step 4 — Buat PC Agent Python MVP

Fitur:

```txt
Load config
Register agent
Collect system info
Send heartbeat
Fetch command
Execute shutdown/restart
Report command result
Handle error
```

---

## Step 5 — Buat Dashboard PC Monitoring

Fitur:

```txt
Summary cards
Table PC
Filter lab/status
Search PC
Detail PC drawer
Command confirmation modal
```

---

## Step 6 — Integrasi ke Peta Lab

Fitur:

```txt
Peta membaca agent_status dan health_status
Warna PC berubah otomatis
Klik PC membuka detail
Tombol shutdown/restart muncul sesuai role
```

---

## Step 7 — Tambahkan Warning Logic

Fitur:

```txt
Storage warning
RAM warning
CPU warning
Agent inactive warning
PC offline warning
```

---

## Step 8 — Tambahkan Smart Energy

Fitur:

```txt
Auto shutdown setelah jadwal terakhir selesai
Shutdown massal lab
Cek jadwal aktif
Cek jadwal berikutnya
Override Koordinator
Audit log
```

---

# 21. MVP Final PC Agent

MVP final PC Agent harus memiliki:

```txt
1. Agent Python berjalan di background
2. Agent membaca config pc_code dan token
3. Agent register ke server
4. Agent mengirim heartbeat setiap 60 detik
5. Agent mengirim CPU, RAM, storage, hostname, IP, OS
6. Server menentukan online/offline dari last_seen_at
7. Dashboard menampilkan daftar PC dan status
8. Peta lab menampilkan warna PC berdasarkan status
9. Aslab/Koordinator bisa membuat command shutdown/restart
10. Agent polling command setiap 30 detik
11. Agent menjalankan command
12. Agent mengirim hasil command
13. Semua command masuk audit log
```

---

# 22. Flow Final PC Agent

```txt
PC Agent di-install di PC lab
→ Agent membaca config
→ Agent register ke server LabKom
→ Agent mengirim heartbeat berkala
→ Server update status PC
→ Dashboard menampilkan status PC
→ Peta lab update warna PC
→ Aslab/Koordinator membuat command
→ Agent mengambil command
→ Agent menjalankan command
→ Agent mengirim hasil command
→ Dashboard update hasil
→ Audit log tersimpan
```

---

# 23. Konsep Final Sederhana

```txt
PC Agent = aplikasi kecil di PC lab
Dashboard = tempat Aslab/Koordinator melihat dan mengontrol PC
API = jembatan antara Agent dan Dashboard
Database = tempat menyimpan status, log, warning, dan command
```

Dengan PC Agent, LabKom dapat memiliki fitur:

```txt
Monitoring PC otomatis
Dashboard real-time sederhana
Remote shutdown/restart
Integrasi peta lab
Warning kondisi PC
Smart energy management
Dasar untuk smart laboratory system
```

---

# 24. Catatan Implementasi untuk AI/Developer

Saat mengimplementasikan fitur ini, kerjakan secara bertahap.

Prioritas implementasi:

```txt
1. Database pcs
2. API heartbeat
3. Agent Python kirim heartbeat
4. Dashboard tampilkan status PC
5. Logic online/offline
6. Command queue
7. Remote shutdown/restart
8. Audit log
9. Integrasi peta lab
10. Smart warning
11. Smart energy
```

Jangan langsung membuat semua fitur advanced. Mulai dari heartbeat dan dashboard monitoring terlebih dahulu.
