# LabFlow — Workflow & Fitur Lengkap Sistem Manajemen Laboratorium

Dokumen ini berisi rancangan workflow, pembagian fitur, kategori sistem, roadmap pengembangan, struktur menu, alur pengguna, stack teknologi, dan rancangan database untuk membangun sistem manajemen laboratorium terpusat.

Sistem ini diprioritaskan untuk dikembangkan sebagai **web management system** terlebih dahulu. Setelah fitur web stabil, sistem dapat dikembangkan ke tahap lanjutan seperti IoT, PC monitoring, smart lock, AI assistant, dan face recognition.

## jadi web ini nanti nya juga akan di buat wpa agar lebih mudah juga di pake dalam bentuk apps

## 1. Konsep Utama Sistem

Nama konsep sistem:

**LabFlow — Sistem Manajemen Laboratorium Terintegrasi Berbasis Web, IoT, dan AI**

Tujuan utama sistem:

- Mengelola jadwal penggunaan laboratorium.
- Mencatat siapa pengguna terakhir laboratorium.
- Mencatat siapa pemegang kunci.
- Mencatat kondisi laboratorium setelah digunakan.
- Mengelola absensi asisten laboratorium.
- Mengelola laporan kerusakan perangkat.
- Membuat alur kerja asisten lab lebih rapi.
- Menyediakan dashboard terpusat untuk Koordinator Lab, Asisten Lab, dan Mahasiswa.
- Menjadi pondasi awal untuk integrasi IoT seperti smart lock dan monitoring PC.

---

## 2. Prinsip Pengembangan

Sistem dibagi menjadi 3 kategori besar:

1. **Web Core / Manajemen Lab**
   - Dikerjakan pertama.
   - Menjadi pondasi utama sistem.
   - Berisi login, role, jadwal, logbook, kunci, absensi, ticketing, dashboard, dan laporan.

2. **Semi-IoT / Integrasi**
   - Dikerjakan setelah web core stabil.
   - Berisi integrasi Telegram/WhatsApp bot, Google Calendar, dan AI assistant.

3. **IoT & Automation Layer**
   - Dikerjakan setelah sistem web benar-benar matang.
   - Berisi smart lock, MQTT, monitoring PC, remote shutdown, Wake-on-LAN, dan face recognition.

Urutan prioritas pengembangan:

```txt
Web Management
→ QR Tracking
→ Ticketing
→ Interactive Lab Map
→ Notification
→ PC Agent
→ Smart Lock
→ AI & Face Recognition
```

---

# 3. Pembagian Fitur Berdasarkan Kategori

---

## 3.1 Web Core

Web Core adalah fitur utama yang harus dikerjakan terlebih dahulu.

### 3.1.1 Authentication & Role-Based Access

Fitur:

- Login.
- Logout.
- Register atau import user.
- Role-based dashboard.
- Manajemen user.
- Hak akses tiap halaman.
- Proteksi route berdasarkan role.

Role utama:

| Role                                 | Akses                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| Koordinator Lab                      | Mengatur lab, jadwal, user, asleb, laporan, misi, verifikasi, audit                         |
| Asisten Lab / Asleb                  | Absensi, logbook, kunci, ticketing, misi, peta lab                                          |
| Mahasiswa                            | Melihat jadwal, melapor kerusakan, validasi kondisi akhir jika menjadi ketua kelas/peminjam |
| Dosen                                | Membuka/menutup sesi praktikum, melihat jadwal, validasi sesi                               |
| Ketua Kelas / Penanggung Jawab Kelas | Mengambil kunci jika diizinkan, validasi kondisi akhir, mengembalikan kunci                 |

Catatan:

- Ketua kelas bisa dianggap sebagai mahasiswa dengan hak tambahan pada jadwal tertentu.
- Tidak semua mahasiswa punya akses untuk mengambil kunci atau mengisi logbook akhir.
- Akses ketua kelas hanya aktif jika ia terhubung dengan jadwal atau sesi tertentu.

---

## 3.1.2 Multi-Lab Dashboard

Sistem harus mendukung lebih dari satu laboratorium.

Contoh lab:

```txt
Lab Dasar
Lab Multimedia
```

Fitur dashboard:

- Menampilkan status Lab Dasar.
- Menampilkan status Lab Multimedia.
- Menampilkan jadwal hari ini.
- Menampilkan asleb yang bertugas.
- Menampilkan pemegang kunci saat ini.
- Menampilkan jumlah laporan kerusakan aktif.
- Menampilkan kondisi lab terakhir.
- Menampilkan aktivitas terbaru.
- Menampilkan ringkasan absensi asleb.

Struktur data dasar:

```txt
labs
- id
- name
- location
- description
- status
```

---

## 3.1.3 Manajemen Jadwal Lab

Fitur:

- Membuat jadwal praktikum.
- Mengatur jadwal berdasarkan semester.
- Mengatur jadwal berdasarkan lab.
- Mengatur jadwal berdasarkan dosen.
- Mengatur jadwal berdasarkan kelas.
- Filter jadwal semester 2, 4, 6, dan 8.
- Filter jadwal Lab Dasar dan Lab Multimedia.
- Mencegah double-booking.
- Menampilkan kalender mingguan.
- Menampilkan kalender bulanan.
- Membuat jadwal kegiatan tambahan.
- Membuat jadwal peminjaman lab.
- Membuat status jadwal.
- Blokir slot yang sudah terpakai.
- Deteksi bentrok jadwal

Status jadwal:

```txt
Scheduled
Ongoing
Finished
Cancelled
```

Prioritas pengembangan:

```txt
Internal Calendar dulu
→ Google Calendar nanti
```

Alur jadwal:

```txt
Koordinator membuat jadwal
→ Sistem mengecek bentrok ruangan
→ Jadwal tersimpan
→ Jadwal tampil di dashboard mahasiswa, asleb, dan dosen
→ Saat waktu jadwal tiba, sesi dapat dibuka
```

---

## 3.1.4 Digital Logbook

Digital Logbook adalah fitur inti untuk mencatat penggunaan laboratorium secara resmi.

Tujuan logbook:

- Mengetahui siapa pengguna terakhir lab.
- Mengetahui siapa penanggung jawab sesi.
- Mengetahui siapa pemegang kunci.
- Mengetahui kondisi ruangan setelah digunakan.
- Mengetahui apakah ada kerusakan baru.
- Mengetahui apakah lab sudah ditutup dengan benar.
- Menjadi arsip resmi aktivitas laboratorium.

---

# 4. Revisi Alur Logbook Final

Bagian ini adalah revisi dari alur sebelumnya.

Pada rancangan awal, check-in dan check-out dilakukan oleh **Asleb/Dosen**. Alasannya karena logbook adalah catatan resmi laboratorium, sehingga harus ada pihak yang memiliki otoritas dan tanggung jawab langsung.

Namun, dalam praktiknya, **ketua kelas atau mahasiswa juga bisa terlibat**, terutama jika mereka adalah pihak yang mengambil kunci, menggunakan lab, atau menjadi penanggung jawab kelas.

Maka alur final yang lebih rapi adalah:

```txt
Jadwal dimulai
→ Asleb/Dosen membuka sesi lab/check-in resmi
→ Jika kunci diambil oleh ketua kelas/mahasiswa, sistem mencatat pemegang kunci
→ Sesi lab berjalan
→ Ketua kelas/mahasiswa mengisi validasi kondisi akhir ruangan
→ Ketua kelas/mahasiswa mengembalikan kunci atau menyerahkan ke asleb
→ Asleb/Dosen melakukan verifikasi kondisi lab
→ Asleb/Dosen melakukan check-out resmi
→ Sistem mencatat user terakhir, pemegang kunci, kondisi lab, dan penanggung jawab sesi
```

---

## 4.1 Pembagian Peran dalam Logbook

### 4.1.1 Asleb / Dosen

Peran:

- Membuka sesi lab secara resmi.
- Menjadi penanggung jawab utama sesi.
- Memverifikasi kondisi akhir lab.
- Melakukan check-out resmi.
- Memberikan catatan jika ada masalah.
- Mengunci status logbook final.

Fungsi:

```txt
Asleb/Dosen = check-in resmi, verifikasi, check-out resmi
```

---

### 4.1.2 Ketua Kelas / Mahasiswa

Peran:

- Mengambil kunci jika diizinkan.
- Menjadi pemegang kunci sementara.
- Menggunakan lab sesuai jadwal.
- Mengisi kondisi akhir ruangan.
- Melaporkan kerusakan.
- Mengembalikan kunci.
- Mengunggah bukti foto jika dibutuhkan.

Fungsi:

```txt
Ketua kelas/Mahasiswa = pemakai, pemegang kunci, input kondisi akhir
```

---

### 4.1.3 Koordinator Lab

Peran:

- Melihat seluruh aktivitas logbook.
- Melakukan audit jika ada masalah.
- Melihat siapa penanggung jawab sesi.
- Melihat siapa pemegang kunci.
- Melihat kondisi akhir lab.
- Melihat riwayat penggunaan lab.
- Melihat laporan bulanan.

Fungsi:

```txt
Koordinator = monitoring, audit, dan evaluasi
```

---

## 4.2 Kenapa Check-in dan Check-out Resmi Tetap oleh Asleb/Dosen?

Alasannya:

1. **Logbook adalah catatan resmi lab**
   - Harus ada pihak yang bertanggung jawab secara struktural.

2. **Menghindari tanggung jawab yang kabur**
   - Jika ada PC rusak, AC lupa dimatikan, atau kunci hilang, sistem tahu siapa penanggung jawab resmi.

3. **Validasi lebih kuat**
   - Mahasiswa atau ketua kelas dapat mengisi kondisi, tetapi asleb/dosen yang memverifikasi.

4. **Keamanan akses**
   - Tidak semua mahasiswa boleh membuka atau menutup sesi lab.

5. **Cocok untuk audit**
   - Koordinator bisa melihat siapa yang membuka sesi, siapa yang memegang kunci, siapa yang mengisi kondisi, dan siapa yang menutup sesi.

Kesimpulan:

```txt
Mahasiswa/Ketua Kelas boleh terlibat,
tetapi check-in dan check-out resmi tetap berada di Asleb/Dosen.
```

---

## 4.3 Tipe Penggunaan Lab

Agar sistem lebih fleksibel, penggunaan lab dibagi menjadi dua tipe.

---

### 4.3.1 Praktikum Resmi

Digunakan untuk jadwal kuliah atau praktikum reguler.

Aktor:

```txt
Dosen
Asleb
Ketua kelas
Mahasiswa
```

Flow:

```txt
Koordinator membuat jadwal praktikum
→ Jadwal tampil di dashboard
→ Dosen/Asleb membuka sesi lab
→ Jika kunci diambil ketua kelas, sistem mencatat pemegang kunci
→ Praktikum berjalan
→ Ketua kelas mengisi validasi kondisi akhir
→ Ketua kelas mengembalikan kunci
→ Asleb/Dosen memverifikasi kondisi lab
→ Asleb/Dosen melakukan check-out resmi
→ Logbook final tersimpan
```

Pembagian peran:

```txt
Dosen/Asleb = check-in/check-out resmi
Ketua kelas = validasi kondisi akhir dan pemegang kunci jika diizinkan
Mahasiswa = peserta dan pelapor kerusakan
```

---

### 4.3.2 Peminjaman Lab Mandiri

Digunakan untuk kegiatan tambahan seperti:

- UKM.
- Lomba.
- Kerja kelompok.
- Riset.
- Pelatihan.
- Kegiatan di luar jadwal praktikum.

Aktor:

```txt
Mahasiswa/Ketua kegiatan
Asleb
Koordinator
```

Flow:

```txt
Mahasiswa/Ketua kegiatan mengajukan peminjaman lab
→ Koordinator/Asleb menyetujui request
→ Sistem membuat jadwal peminjaman
→ Peminjam mengambil kunci dengan scan QR
→ Sistem mencatat pemegang kunci
→ Lab digunakan
→ Peminjam mengisi kondisi akhir ruangan
→ Peminjam mengembalikan kunci
→ Asleb memverifikasi kondisi lab
→ Asleb menutup sesi/check-out resmi
→ Logbook final tersimpan
```

Pembagian peran:

```txt
Mahasiswa/Ketua kegiatan = request, ambil kunci, isi kondisi akhir
Asleb = verifikasi dan close sesi
Koordinator = approval dan audit
```

---

## 4.4 Data yang Dicatat dalam Logbook

Data utama:

```txt
id
schedule_id
lab_id
session_type
official_checkin_by
official_checkin_at
key_holder_id
key_taken_at
key_returned_at
condition_submitted_by
condition_submitted_at
verified_by
verified_at
official_checkout_by
official_checkout_at
status
notes
```

Data kondisi lab:

```txt
jumlah_pc_menyala
jumlah_pc_mati
kebersihan_ruangan
status_ac
status_lampu
status_proyektor
status_pintu
barang_tertinggal
kerusakan_baru
catatan_kondisi
foto_bukti
```

Status logbook:

```txt
Draft
Checked In
Waiting Condition Validation
Waiting Verification
Completed
Problem
Cancelled
```

---

## 4.5 Flow Status Logbook

```txt
Scheduled
→ Checked In
→ In Use
→ Condition Submitted
→ Waiting Verification
→ Completed
```

Jika ada masalah:

```txt
Condition Submitted
→ Problem Found
→ Ticket Created
→ Verified with Notes
→ Completed
```

---

## 4.6 Logbook dengan Ticketing

Jika pada validasi akhir ditemukan kerusakan, sistem dapat otomatis membuat ticket.

Flow:

```txt
Ketua kelas mengisi kondisi akhir
→ Menandai ada kerusakan PC
→ Sistem membuat ticket kerusakan
→ Ticket masuk ke dashboard asleb
→ Asleb memverifikasi
→ Ticket bisa menjadi misi perbaikan
```

Contoh:

```txt
PC 05 mouse rusak
→ Ticket dibuat otomatis
→ Asleb mengambil ticket
→ Status menjadi In Progress
→ Setelah diperbaiki, status Resolved
```

---

# 5. Peminjaman Kunci Berbasis QR Code

Fitur ini digunakan untuk mengetahui siapa pemegang kunci saat ini.

## 5.1 Konsep

Setiap kunci memiliki QR Code unik.

Contoh:

```txt
KEY-LABD-001
KEY-LABM-001
```

Ketika seseorang mengambil kunci, ia harus scan QR.

Aktor yang bisa mengambil kunci:

```txt
Asleb
Dosen
Ketua kelas
Mahasiswa yang sudah disetujui
Ketua kegiatan
```

Syarat ketua kelas/mahasiswa bisa mengambil kunci:

```txt
Ada jadwal aktif
Atau ada request peminjaman yang sudah disetujui
Waktu pengambilan sesuai
User memiliki akses sebagai penanggung jawab sesi
```

---

## 5.2 Flow Ambil Kunci

```txt
User scan QR kunci
→ Sistem cek role dan jadwal
→ Sistem cek apakah user berhak mengambil kunci
→ User klik "Ambil Kunci"
→ Sistem mencatat pemegang kunci
→ Status kunci menjadi Borrowed
→ Dashboard menampilkan pemegang kunci saat ini
```

---

## 5.3 Flow Kembalikan Kunci

```txt
User scan QR kunci
→ Sistem cek apakah user adalah pemegang kunci saat ini
→ User klik "Kembalikan Kunci"
→ Sistem mencatat waktu pengembalian
→ Status kunci menjadi Available
→ Dashboard diperbarui
```

---

## 5.4 Status Kunci

```txt
Available
Borrowed
Missing
Maintenance
```

---

# 6. Absensi Asisten Lab

Fitur absensi digunakan untuk memantau kehadiran dan kinerja asleb.

## 6.1 Fitur Absensi

- Absen masuk.
- Absen pulang.
- Validasi lokasi GPS.
- Daily task log.
- Riwayat shift.
- Rekap jam kerja.
- Laporan bulanan.
- Rekap performa.

---

## 6.2 Flow Absensi

```txt
Asleb login
→ Klik Absen Masuk
→ Sistem cek lokasi GPS
→ Jika lokasi valid, absen diterima
→ Asleb menjalankan tugas
→ Asleb mengisi daily task log
→ Asleb klik Absen Pulang
→ Sistem menyimpan jam kerja
```

---

## 6.3 Daily Task Log

Contoh isi tugas harian:

```txt
Install software di Lab Multimedia
Perbaikan jaringan
Cek PC Lab Dasar
Backup data praktikum
Membersihkan lab
Mendampingi praktikum
Mengelola ticket kerusakan
```

---

# 7. Ticketing Kerusakan / Lab-Care

Ticketing digunakan agar laporan kerusakan lebih rapi dan terdokumentasi.

## 7.1 Konsep

Setiap PC atau meja memiliki QR Code unik.

Contoh kode:

```txt
LABD-PC-01
LABD-PC-02
LABM-PC-01
LABM-PC-02
```

Mahasiswa cukup scan QR untuk melapor kerusakan.

---

## 7.2 Flow Ticketing

```txt
Mahasiswa scan QR di PC/meja
→ Sistem membuka form laporan
→ Mahasiswa memilih jenis kerusakan
→ Mahasiswa menulis deskripsi
→ Mahasiswa upload foto jika perlu
→ Ticket masuk dashboard asleb
→ Asleb mengambil ticket
→ Status berubah menjadi In Progress
→ Asleb menyelesaikan ticket
→ Status berubah menjadi Resolved
```

---

## 7.3 Kategori Kerusakan

```txt
Mouse
Keyboard
Monitor
CPU
Jaringan
Software
Kursi/Meja
AC/Listrik
Proyektor
Lainnya
```

---

## 7.4 Status Ticket

```txt
Open
In Progress
Waiting
Resolved
Rejected
```

---

# 8. Interactive Lab Map

Interactive Lab Map digunakan untuk menampilkan denah lab secara visual.

## 8.1 Fitur

- Denah Lab Dasar.
- Denah Lab Multimedia.
- Kotak tiap PC/meja.
- Warna status PC.
- Klik PC untuk melihat detail.
- Klik PC untuk melihat ticket terkait.
- Klik PC untuk mengubah status manual.
- Nanti bisa terhubung ke PC Agent.

---

## 8.2 Status Warna

| Warna   | Status            |
| ------- | ----------------- |
| Hijau   | Tersedia / normal |
| Biru    | Sedang digunakan  |
| Merah   | Rusak             |
| Kuning  | Maintenance       |
| Abu-abu | Tidak aktif       |

Tahap awal:

```txt
Status PC diubah manual oleh asleb
```

Tahap lanjutan:

```txt
Status PC otomatis dari PC Agent
```

---

# 9. Mission System & Gamification

Fitur ini digunakan agar kerja asleb lebih terukur dan menarik.

## 9.1 Fitur

- Koordinator membuat misi.
- Asleb mengambil misi.
- Asleb menyelesaikan misi.
- Koordinator memverifikasi misi.
- Poin bertambah setelah misi disetujui.
- Leaderboard bulanan.

---

## 9.2 Contoh Misi

```txt
Install software Matlab di 20 PC
Cek kabel LAN Lab Multimedia
Perbaiki mouse PC 07
Backup data praktikum
Bersihkan storage PC Lab Dasar
Update driver komputer lab
```

---

## 9.3 Status Misi

```txt
Open
Taken
Submitted
Approved
Rejected
```

---

## 9.4 Flow Misi

```txt
Koordinator membuat misi
→ Asleb mengambil misi
→ Asleb mengerjakan misi
→ Asleb submit bukti
→ Koordinator memverifikasi
→ Jika approved, poin asleb bertambah
→ Leaderboard diperbarui
```

---

# 10. Auto-Certificate & Portfolio Generator

Fitur ini adalah fitur lanjutan untuk penghargaan asleb.

## 10.1 Fitur

- Rekap jam tugas.
- Rekap misi selesai.
- Rekap ticket selesai.
- Rekap skill.
- Generate sertifikat PDF.
- Tanda tangan digital kepala lab.
- Portfolio asleb.

---

## 10.2 Skill yang Bisa Dicatat

```txt
Hardware Troubleshooting
Software Installation
Network Maintenance
Lab Management
Technical Support
System Administration
```

---

# 11. Semi-IoT / Integrasi Lanjutan

---

## 11.1 Bot Notifikasi Telegram / WhatsApp

Prioritas:

```txt
Telegram Bot dulu
→ WhatsApp Bot nanti ( ini wa aja dulu biar bisa di integrasikan ke grup wa lab )
```

Alasan:

- Telegram lebih mudah.
- Tidak perlu session QR yang sering bermasalah.
- Lebih stabil untuk notifikasi sistem.

Fitur notifikasi:

```txt
Reminder jadwal lab
Reminder sesi hampir selesai
Reminder kunci belum dikembalikan
Reminder asleb belum absen
Notifikasi ticket baru
Notifikasi misi baru
Notifikasi ticket selesai
```

Contoh notifikasi:

```txt
Sesi Lab Multimedia semester 4 akan berakhir dalam 15 menit.
Mohon pastikan PC dimatikan dan kunci dikembalikan.
```

---

## 11.2 Google Calendar Integration

Fitur:

- Sinkronisasi jadwal praktikum.
- Kalender publik mahasiswa.
- Export jadwal.
- Reminder otomatis.
- Integrasi jadwal semester 2, 4, 6, dan 8.

Prioritas:

```txt
Jadwal internal dulu
→ Google Calendar nanti
```

---

## 11.3 AI Lab Assistant Bot

Fitur:

- Mahasiswa bertanya SOP lab.
- Mahasiswa bertanya cara install software.
- Mahasiswa bertanya troubleshooting error ringan.
- Mahasiswa bertanya jadwal lab.
- Mahasiswa bertanya aturan penggunaan lab.

Sumber knowledge base:

```txt
SOP Lab
Panduan Praktikum
FAQ
Data software
Aturan peminjaman lab
Panduan troubleshooting
```

Prioritas:

```txt
FAQ manual dulu
→ AI bot nanti
```

Stack opsional:

```txt
Gemini API
OpenAI API
Vector database
Markdown/PDF knowledge base
```

---

# 12. IoT & Automation Layer

---

## 12.1 IoT Smart Lock

Fitur ini masuk tahap lanjutan karena berkaitan dengan keamanan fisik.

Hardware:

```txt
ESP32 atau NodeMCU
Solenoid Door Lock 12V
Relay Module
Power Supply 12V
MQTT Broker
```

Flow:

```txt
Asleb klik "Buka Pintu"
→ Backend mengecek role dan jadwal
→ Backend mengirim command MQTT
→ ESP32 menerima command OPEN
→ Relay aktif
→ Solenoid membuka kunci
→ Backend menyimpan access log
```

Rekomendasi:

```txt
QR Key Tracking dulu
→ Smart Lock Hybrid nanti
```

Smart Lock Hybrid berarti tetap ada kunci manual sebagai backup.

---

## 12.2 PC Agent Monitoring

PC Agent adalah aplikasi kecil yang dipasang di setiap PC lab.

Fungsi:

- Mengirim status online/offline.
- Mengirim penggunaan CPU.
- Mengirim penggunaan RAM.
- Mengirim penggunaan storage.
- Mengirim suhu CPU jika tersedia.
- Mengirim hostname.
- Mengirim IP address.
- Menerima perintah shutdown/restart.

Stack:

```txt
Python
psutil
Windows Service / background task
API Client
```

Contoh data:

```json
{
  "pc_code": "LABD-PC-05",
  "status": "online",
  "cpu_usage": 35,
  "ram_usage": 62,
  "storage_usage": 80,
  "cpu_temp": 72
}
```

---

## 12.3 Remote Shutdown & Wake-on-LAN

Fitur:

- Shutdown satu PC.
- Shutdown semua PC.
- Restart PC.
- Wake-on-LAN.
- Auto shutdown setelah jadwal selesai.

Prioritas:

```txt
Monitoring dulu
→ Remote shutdown
→ Wake-on-LAN
```

Syarat keamanan:

```txt
Access log
Confirmation modal
Permission check
Emergency cancel
```

---

## 12.4 Smart Energy Management

Fungsi:

```txt
Jika jadwal terakhir selesai jam 16:00
→ jam 16:15 sistem cek PC yang masih ON
→ jika tidak ada jadwal lagi
→ sistem kirim perintah shutdown
```

Rule:

```txt
IF no_active_schedule AND time > last_schedule_end + 15 minutes
THEN shutdown_all_lab_pcs
```

---

## 12.5 Hardware Inventory & Warning

Fitur:

- Auto-detect spesifikasi PC.
- RAM.
- CPU.
- Storage.
- IP address.
- OS.
- Suhu CPU.
- Status disk hampir penuh.
- Warning overheat.

Contoh logic:

```txt
Jika suhu CPU > 80°C
→ kirim peringatan ke dashboard asleb
```

---

## 12.6 Face Recognition Attendance

Fitur ini masuk tahap akhir.

Alasan:

- Butuh dataset wajah asleb.
- Harus memperhatikan privasi.
- Butuh kamera.
- Butuh pencahayaan stabil.
- Butuh fallback manual.
- Bisa error karena sudut wajah, masker, atau kondisi ruangan.

Prioritas awal:

```txt
Absensi GPS + foto selfie opsional
```

Tahap lanjut:

```txt
Face Recognition Attendance
```

Stack:

```txt
InsightFace
ArcFace
OpenCV
Python FastAPI
Local server
```

---

# 13. Roadmap Pengembangan

---

## Phase 1 — MVP Web Core

Target:

Sistem sudah bisa dipakai walaupun belum ada IoT.

Fitur:

```txt
Login multi-role
Dashboard Koordinator, Asleb, Mahasiswa
Multi-lab: Lab Dasar & Lab Multimedia
Jadwal lab semester 2, 4, 6, 8
Logbook digital check-in/check-out
QR peminjaman kunci
Absensi asleb dengan GPS
Ticketing kerusakan berbasis QR PC
Interactive lab map manual
Mission system sederhana
Laporan bulanan
```

Output:

- Koordinator bisa atur jadwal.
- Asleb bisa absensi.
- Asleb bisa check-in/check-out lab.
- Ketua kelas/mahasiswa bisa mengisi kondisi akhir.
- Mahasiswa bisa lihat jadwal.
- Mahasiswa bisa lapor kerusakan lewat QR.
- Dashboard bisa melihat pemegang kunci.
- Dashboard bisa melihat kondisi lab terakhir.

---

## Phase 2 — Workflow & UX Enhancement

Fitur:

```txt
Interactive lab map lebih detail
Mission system
Leaderboard
Daily task log lebih detail
Laporan bulanan
Export PDF/Excel
Auto-certificate
```

Output:

- Sistem lebih rapi.
- Bisa dipakai untuk evaluasi performa asleb.
- Bisa menghasilkan laporan resmi ke kampus.

---

## Phase 3 — Notification & External Integration

Fitur:

```txt
Telegram bot
Reminder jadwal
Reminder kunci belum kembali
Reminder asleb belum absen
Google Calendar sync
AI FAQ bot sederhana
```

Output:

- Sistem mulai otomatis.
- Mahasiswa dan asleb dapat reminder.
- Beban komunikasi manual berkurang.

---

## Phase 4 — IoT Smart Lab

Fitur:

```txt
PC Agent
Monitoring PC
Remote shutdown
Wake-on-LAN
Smart energy management
Hardware inventory
```

Output:

- Dashboard bisa melihat status PC real-time.
- Asleb bisa shutdown PC dari dashboard.
- Sistem bisa hemat listrik.
- Data hardware tercatat otomatis.

---

## Phase 5 — Advanced IoT & AI

Fitur:

```txt
Smart lock ESP32
MQTT
Access via web
Face recognition attendance
Advanced AI assistant
Predictive maintenance
```

Output:

- Lab menjadi smart lab.
- Akses pintu tercatat otomatis.
- Absensi lebih aman.
- Sistem bisa membantu diagnosis kerusakan.

---

# 14. Struktur Menu Dashboard

---

## 14.1 Menu Koordinator Lab

```txt
Dashboard
Manajemen Lab
Manajemen Jadwal
Manajemen User
Asleb & Shift
Logbook Lab
Peminjaman Kunci
Ticketing Kerusakan
Misi & Verifikasi
Leaderboard
Laporan
Sertifikat
Pengaturan
```

---

## 14.2 Menu Asleb

```txt
Dashboard
Absensi Saya
Jadwal Tugas
Logbook Lab
Kunci Lab
Ticketing
Misi Saya
Peta Lab
Riwayat Tugas
Leaderboard
```

---

## 14.3 Menu Mahasiswa

```txt
Dashboard
Jadwal Lab
Scan QR Kerusakan
Riwayat Laporan Saya
Panduan Lab
AI Assistant
```

Untuk MVP, menu mahasiswa bisa dibuat sederhana:

```txt
Jadwal Lab
Lapor Kerusakan
Panduan Lab
```

---

## 14.4 Menu Ketua Kelas / Penanggung Jawab Kelas

```txt
Dashboard
Jadwal Kelas
Ambil/Kembalikan Kunci
Validasi Kondisi Akhir
Lapor Kerusakan
Riwayat Penggunaan Lab
```

---

## 14.5 Menu Dosen

```txt
Dashboard
Jadwal Praktikum
Buka Sesi Lab
Tutup Sesi Lab
Validasi Sesi
Riwayat Praktikum
```

---

# 15. Workflow Utama Sistem

---

## 15.1 Workflow Jadwal Lab

```txt
Koordinator membuat jadwal
→ Sistem cek bentrok lab
→ Jadwal tersimpan
→ Jadwal tampil di dashboard mahasiswa, asleb, dan dosen
→ Saat sesi dimulai, asleb/dosen membuka sesi
→ Sesi berlangsung
→ Ketua kelas mengisi validasi kondisi akhir
→ Asleb/dosen memverifikasi dan menutup sesi
→ Logbook tersimpan
```

---

## 15.2 Workflow Peminjaman Kunci

```txt
User scan QR kunci
→ Sistem cek role dan jadwal
→ Sistem cek apakah user boleh mengambil kunci
→ User klik Ambil Kunci
→ Sistem mencatat pemegang kunci
→ Dashboard menampilkan pemegang kunci
→ Setelah selesai, user scan QR lagi
→ User klik Kembalikan Kunci
→ Status kunci menjadi Available
```

---

## 15.3 Workflow Ticketing Kerusakan

```txt
Mahasiswa scan QR di PC/meja
→ Pilih jenis kerusakan
→ Tambah deskripsi/foto
→ Submit laporan
→ Ticket masuk dashboard asleb
→ Asleb ambil ticket
→ Ticket menjadi misi jika diperlukan
→ Asleb memperbaiki
→ Status menjadi Resolved
→ Poin asleb bertambah jika terhubung dengan mission system
```

---

## 15.4 Workflow Absensi Asleb

```txt
Asleb login
→ Klik Absen Masuk
→ Sistem cek lokasi GPS
→ Jika valid, absen diterima
→ Asleb isi daily task
→ Saat pulang, klik Absen Pulang
→ Jam kerja tersimpan
```

---

## 15.5 Workflow Praktikum Resmi

```txt
Koordinator membuat jadwal praktikum
→ Dosen/Asleb membuka sesi
→ Ketua kelas mengambil kunci jika diizinkan
→ Sistem mencatat pemegang kunci
→ Praktikum berjalan
→ Ketua kelas mengisi kondisi akhir
→ Ketua kelas mengembalikan kunci
→ Asleb/Dosen memverifikasi
→ Asleb/Dosen menutup sesi
→ Logbook final tersimpan
```

---

## 15.6 Workflow Peminjaman Lab Mandiri

```txt
Mahasiswa/Ketua kegiatan mengajukan peminjaman
→ Koordinator/Asleb menyetujui
→ Jadwal peminjaman dibuat
→ Peminjam mengambil kunci
→ Sistem mencatat pemegang kunci
→ Lab digunakan
→ Peminjam mengisi kondisi akhir
→ Peminjam mengembalikan kunci
→ Asleb memverifikasi
→ Asleb menutup sesi
→ Logbook final tersimpan
```

---

# 16. Rekomendasi Stack Teknologi

Karena project ini cocok dengan kemampuan pengembangan web modern, stack yang disarankan:

## 16.1 Stack Web

```txt
Frontend: Next.js 16 (App Router, TypeScript)
Backend: Express.js 5 (TypeScript, dedicated API server)
Database: PostgreSQL
ORM: Prisma 6
Cache/Real-Time: Redis (ioredis)
Auth: JWT (bcrypt + jsonwebtoken) — custom, bukan NextAuth
Styling: Tailwind CSS v4
UI: Shadcn UI
State Management: TanStack Query (React Query)
Validation: Zod
Animation: Framer Motion, GSAP
3D: Three.js + React Three Fiber + @react-three/drei
File Upload: Cloudinary atau local storage
QR Code: qrcode / react-qr-code
PDF Generator: React PDF / Puppeteer
Deployment: Docker + VPS
Reverse Proxy: Nginx atau Cloudflare Tunnel
```

---

## 16.2 Real-Time

Untuk awal:

```txt
TanStack Query polling + Redis caching (sudah di-setup)
```

Nanti:

```txt
WebSocket / Socket.IO
Redis Pub/Sub
```

---

## 16.3 IoT Stack

```txt
ESP32
MQTT
Mosquitto Broker
Python PC Agent
psutil
FastAPI opsional untuk agent server
```

---

# 17. Rancangan Database Utama

## 17.1 Tabel MVP

```txt
users
roles
labs
schedules
attendance
daily_task_logs
keys
key_logs
logbooks
pcs
tickets
missions
mission_claims
points
```

---

## 17.2 Tabel Lanjutan

```txt
notifications
certificates
access_logs
pc_status
pc_agents
iot_devices
smart_lock_logs
ai_knowledge_base
face_attendance_logs
```

---

## 17.3 Rancangan Entitas Penting

### users

```txt
id
name
email
password
role
semester
class_name
is_active
created_at
updated_at
```

### labs

```txt
id
name
location
description
status
created_at
updated_at
```

### schedules

```txt
id
lab_id
title
semester
class_name
lecturer_id
assistant_id
start_time
end_time
status
type
created_at
updated_at
```

### logbooks

```txt
id
schedule_id
lab_id
session_type
official_checkin_by
official_checkin_at
key_holder_id
key_taken_at
key_returned_at
condition_submitted_by
condition_submitted_at
verified_by
verified_at
official_checkout_by
official_checkout_at
status
notes
created_at
updated_at
```

### logbook_conditions

```txt
id
logbook_id
jumlah_pc_menyala
jumlah_pc_mati
kebersihan_ruangan
status_ac
status_lampu
status_proyektor
status_pintu
barang_tertinggal
kerusakan_baru
catatan_kondisi
foto_bukti
created_at
updated_at
```

### keys

```txt
id
lab_id
key_code
qr_code
status
current_holder_id
created_at
updated_at
```

### key_logs

```txt
id
key_id
user_id
action
taken_at
returned_at
notes
created_at
updated_at
```

### pcs

```txt
id
lab_id
pc_code
name
position_x
position_y
status
qr_code
created_at
updated_at
```

### tickets

```txt
id
pc_id
lab_id
reported_by
assigned_to
category
title
description
photo
status
priority
created_at
updated_at
resolved_at
```

### missions

```txt
id
title
description
points
deadline
status
created_by
created_at
updated_at
```

### mission_claims

```txt
id
mission_id
asleb_id
status
proof
verified_by
verified_at
created_at
updated_at
```

### attendance

```txt
id
user_id
checkin_at
checkout_at
latitude
longitude
status
notes
created_at
updated_at
```

---

# 18. Prioritas MVP Final

Versi pertama yang paling realistis:

```txt
1. Login multi-role
2. Dashboard Koordinator, Asleb, Mahasiswa, Ketua Kelas, Dosen
3. Multi-lab: Lab Dasar & Lab Multimedia
4. Jadwal lab semester 2, 4, 6, 8
5. Digital logbook dengan pembagian peran jelas
6. QR peminjaman kunci
7. Validasi kondisi akhir oleh ketua kelas/mahasiswa
8. Verifikasi dan check-out resmi oleh asleb/dosen
9. Absensi asleb dengan GPS
10. Ticketing kerusakan berbasis QR PC
11. Interactive lab map manual
12. Mission system sederhana
13. Laporan bulanan
```

---

# 18.1 Phase 1 Polish — RBAC & User Management (COMPLETED)

```txt
1. ✅ User Management Backend — CRUD users (list, create, update, deactivate, reset password, toggle active, stats) + KOORDINATOR_LAB only
2. ✅ User Management Frontend — Table + search/filter + create/edit/reset modals (neubrutalism style)
3. ✅ Frontend Route Guard — RoleGuard component di dashboard layout, ROUTE_PERMISSIONS map per halaman
4. ✅ Key Validation — Mahasiswa hanya bisa ambil kunci jika: ada jadwal aktif di lab tsb DAN user adalah ketua kelas
5. ✅ Logbook Condition Validation — Submit kondisi akhir hanya oleh: ketua kelas, pemegang kunci, atau role privileged
6. ✅ API Auth Headers — api.ts otomatis inject Bearer token dari localStorage
```

---

## 18.2 Phase 2 — Enhanced Features (COMPLETED)

```txt
1. ✅ Leaderboard Page — Dedicated ranking page (period filter, podium, detail modal, streak)
2. ✅ Export PDF/Excel — Monthly report download (ExcelJS 4 sheets, PDFKit A4)
3. ✅ Auto-Certificate — Generate sertifikat (MONTHLY_BEST, ATTENDANCE_PERFECT, MISSION_MASTER) + PDF download
4. ✅ Enhanced Lab Map — API data fetching, hover tooltip, ticket history per PC, refresh button
5. ✅ Enhanced Daily Task Log — 7 kategori (PIKET_BERSIH, MAINTENANCE_PC, INVENTARIS, INSTALASI, PENDAMPINGAN, ADMINISTRASI, LAINNYA), durasi, foto bukti, lab terkait, verifikasi oleh koordinator
6. ✅ Enhanced Laporan — Recharts (BarChart, PieChart, RadarChart), toggle cards/charts view
7. ✅ Backend routes total: 14 modules (auth, labs, schedules, logbooks, keys, attendance, tickets, missions, reports, users, leaderboard, export, certificates)
```

Libraries ditambahkan Phase 2:
- `recharts` — Chart visualization (bar, pie, radar)
- `exceljs` — Excel generation (multi-sheet workbook)
- `pdfkit` — PDF generation (certificates, reports)

Schema ditambahkan Phase 2:
- Model `Certificate` + enum `CertificateType`
- Enum `TaskCategory` (7 kategori daily task)
- DailyTaskLog enhanced: category, photoUrl, duration, labId, verified, verifiedBy

---

## 18.3 Phase 3 — In-App Notifications (COMPLETED)

Fitur yang diimplementasi:

- [x] Notification model (Prisma) — type, title, message, isRead, metadata (Json), indexed
- [x] NotificationType enum (10 types): SCHEDULE_REMINDER, KEY_NOT_RETURNED, ATTENDANCE_REMINDER, TICKET_ASSIGNED, TICKET_RESOLVED, MISSION_AVAILABLE, MISSION_VERIFIED, LOGBOOK_VERIFIED, CERTIFICATE_ISSUED, SYSTEM
- [x] Notification service — create, createBulk, getUserNotifications (paginated), getUnreadCount, markAsRead, markAllAsRead, delete, cleanup
- [x] Event-based triggers — ticket assigned/resolved, mission created/verified, logbook verified, certificate issued
- [x] Cron scheduler (node-cron) — schedule reminder (5min interval), key not returned (30min), attendance reminder (08:30 weekdays), cleanup (02:00 daily)
- [x] SSE (Server-Sent Events) — real-time push to connected clients via sseManager
- [x] REST API — GET /notifications, GET /notifications/unread-count, GET /notifications/stream (SSE), PATCH /notifications/read-all, PATCH /notifications/:id/read, DELETE /notifications/:id
- [x] Frontend notification panel — bell icon with badge count, dropdown with type icons/colors, mark read, delete, link to full page
- [x] Frontend notifications page — paginated list, filter (all/unread), mark all read, type badges, time ago formatting

Libraries ditambahkan Phase 3:

- node-cron + @types/node-cron (backend)

Schema ditambahkan Phase 3:

- Model `Notification` + enum `NotificationType` (10 values)
- SSE service (in-memory client management)

---

## 18.4 Phase 3 — External Integration (COMPLETED)

Fitur yang diimplementasi:

- [x] WhatsApp Bot (Baileys) — auto-connect on startup, QR auth, send/receive messages
- [x] WhatsApp command handler — /help, /jadwal, /status, /absen, /kunci, /tiket, /misi, /poin
- [x] WhatsApp notification delivery — semua notifikasi in-app juga dikirim via WhatsApp (jika user punya nomor & opt-in)
- [x] WhatsApp admin panel — connect/disconnect, QR display, reset auth, send test message
- [x] Google Calendar Sync — OAuth2 flow, sync jadwal ke Google Calendar (recurring weekly, 16 minggu)
- [x] Google Calendar admin — connect/disconnect, sync all schedules, status check
- [x] AI FAQ Bot — keyword-based matching (12 FAQ entries) + OpenAI GPT-4o-mini fallback (optional)
- [x] FAQ chat interface — real-time chat UI, FAQ list by category, confidence indicator
- [x] FAQ via WhatsApp — pertanyaan yang tidak match command otomatis dijawab oleh FAQ bot
- [x] User model enhanced — phone (WhatsApp number), waNotify (opt-in), googleCalendarToken

Libraries ditambahkan Phase 3 External:

- @whiskeysockets/baileys (WhatsApp Web API)
- qrcode + @types/qrcode (QR code generation)
- googleapis (Google Calendar API)

Schema ditambahkan Phase 3 External:

- User: +phone, +waNotify, +googleCalendarToken fields

Routes ditambahkan:

- /whatsapp — status, connect, disconnect, reset, send-test (KOORDINATOR only)
- /calendar — auth-url, callback, status, disconnect, sync (authenticated)
- /faq — ask, list, categories, stats (authenticated)

---

## 18.5 Phase 4 — PC Management & Monitoring (COMPLETED — Web Only)

Catatan: Integrasi IoT hardware (PC Agent, ESP32, MQTT) ditunda ke v2.0/v4.0. Phase ini fokus pada web interface & API yang siap connect ke agent nanti.

Fitur yang diimplementasi:

- [x] PC Monitoring Dashboard — Grid view semua PC, filter (status/lab/online), bulk select, detail modal (specs, network, status history, commands, tickets)
- [x] Remote Action API — Queue-based command system (SHUTDOWN, RESTART, WAKE_ON_LAN, SLEEP, LOCK, MESSAGE). Agent endpoints: heartbeat, pickup commands, report result
- [x] Hardware Inventory — CRUD specs per PC (CPU, RAM, Storage, OS, GPU, Monitor), aggregation summary, edit modal
- [x] PC Status History — PCStatusLog model, log setiap perubahan status (from/to/reason/changedBy), analytics endpoint
- [x] Energy Dashboard — Estimasi konsumsi listrik per lab (watt aktif, kWh bulanan, biaya Rp), utilisasi %, rekomendasi hemat energi
- [x] QR Code Generator — Generate QR per PC (JSON: type, id, code, lab), bulk generate per lab
- [x] Bulk Operations — Bulk status update, bulk command, bulk specs update, bulk QR generate

Schema ditambahkan Phase 4:

- Model `PCStatusLog` (pcId, fromStatus, toStatus, reason, changedBy, indexed)
- Model `PCCommand` (pcId, command, status, payload, result, issuedBy, executedAt, indexed)
- Enum `PCCommandType` (SHUTDOWN, RESTART, WAKE_ON_LAN, SLEEP, LOCK, MESSAGE)
- Enum `CommandStatus` (PENDING, SENT, EXECUTED, FAILED, CANCELLED)
- PC model enhanced: +lastSeen, +isOnline, +uptimeMinutes, +powerWatt

Routes ditambahkan:

- /pcs — full CRUD, analytics, uptime, inventory, energy, commands, bulk ops, agent endpoints (18 route modules total)

Frontend pages ditambahkan:

- /pc-monitoring — PC grid + detail + remote control + bulk actions
- /inventory — Hardware specs table + edit + QR generate + aggregation
- /energy — Energy consumption dashboard + per-lab breakdown + recommendations

Sidebar updated: KOORDINATOR_LAB gets PC Monitoring, Inventory, Energi. ASISTEN_LAB gets PC Monitoring.

---

## 18.6 Phase 5 — Advanced AI (Web-Only) ✅

Completed:

- [x] Advanced AI Assistant — Context-aware chat, real-time lab data, intent detection (20+ intents), conversation memory, proactive insights, OpenAI GPT-4o-mini fallback
- [x] Predictive Maintenance — PC risk scoring (5 factors: frequency, severity, instability, diversity, uptime), maintenance schedule generator, trend analysis, overall lab health score
- [x] Smart Scheduling AI — Optimal slot suggestion, usage heatmap, load balancing per lab, conflict detection (lab/lecturer/assistant), assistant workload analysis
- [x] AI Dashboard Widget — Proactive insights + lab health score on main dashboard
- [x] Backend: `/ai` routes (12 endpoints) — chat, insights, risk-scores, maintenance-schedule, trends, health, suggest, usage-patterns, load-balance, conflicts, workload
- [x] Frontend: 3 new pages (/ai-assistant, /predictive, /smart-scheduling) + dashboard widget
- [x] RoleGuard: AI Assistant for KOORDINATOR+ASISTEN, Predictive for KOORDINATOR+ASISTEN, Smart Scheduling for KOORDINATOR only
- [x] Sidebar: Added TbRobot, TbBrain, TbCalendarStats menu items

IoT features (Smart Lock ESP32, MQTT, Face Recognition) deferred to v2.0+.

---

# 19. Judul Project

Untuk versi web:

**Labkom: Sistem Manajemen Laboratorium Terpusat Berbasis Web dengan QR Tracking, Digital Logbook, dan Ticketing Kerusakan**

Untuk versi IoT dan AI:

**Labkom: Smart Laboratory Management System Berbasis Web, IoT, dan AI untuk Monitoring, Keamanan, dan Efisiensi Energi Laboratorium Komputer**

---
