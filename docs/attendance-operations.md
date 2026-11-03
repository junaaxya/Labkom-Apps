# Operasional Absensi dan Keamanan Migrasi

## Status histori migrasi

Audit read-only terhadap tabel `_prisma_migrations` menunjukkan dua migrasi historis yang sudah tercatat pada database, tetapi direktori dan SQL aslinya tidak ada di repository:

- `20260714010000_add_magang_access_requests`
- `20260714011000_fix_public_booking_ownership`

Jangan membuat ulang atau menebak isi SQL kedua migrasi tersebut. Pulihkan direktori migrasi beserta `migration.sql` asli dari artefak rilis, backup, atau sumber perubahan yang terverifikasi, lalu cocokkan checksum dan urutannya dengan histori database.

## Larangan sementara

Sampai kedua migrasi asli dipulihkan dan histori telah diverifikasi:

- **Dilarang menjalankan `prisma db push` pada lingkungan mana pun.** Perintah ini melewati histori migrasi dan dapat membuat drift semakin sulit direkonsiliasi.
- **Dilarang menjalankan `prisma migrate reset` pada lingkungan mana pun.** Perintah ini bersifat destruktif.
- Jangan menghapus, mengganti nama, menandai selesai, atau merekayasa ulang entri `_prisma_migrations`.
- Jangan menjalankan migrasi baru pada produksi sebelum `prisma migrate status` menunjukkan histori repository dan database konsisten setelah file asli dipulihkan.

## Prosedur pemulihan yang aman

1. Ambil salinan asli kedua direktori migrasi dari commit, artefak deployment, atau backup yang tepercaya.
2. Tinjau SQL dan checksum tanpa mengeksekusinya pada produksi.
3. Uji `prisma migrate status` dan `prisma migrate deploy` pada salinan database yang terisolasi.
4. Pastikan data absensi, akses MAGANG, dan kepemilikan booking publik tetap utuh.
5. Setelah peer review dan backup terverifikasi, gunakan hanya `prisma migrate deploy` untuk penerapan terkontrol.

Eskalasi setiap ketidaksesuaian checksum atau drift; jangan memperbaikinya dengan `db push`, `migrate reset`, atau SQL hasil rekonstruksi.