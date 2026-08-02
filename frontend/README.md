## LabKom Frontend

Frontend LabKom tetap memakai Next.js SSR + PWA. Android APK internal dibuat dengan **Capacitor remote wrapper**, jadi aplikasi Android akan memuat frontend HTTPS produksi, bukan static export.

Folder `capacitor-web/` hanya shell statis kecil agar `cap sync` stabil. Aplikasi sebenarnya tetap dimuat dari `CAPACITOR_SERVER_URL`.

## Web Development

```bash
npm install
npm run dev
```

Butuh env web lokal:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
```

## Android APK Internal

### Prinsip

- APK **wajib** memakai `CAPACITOR_SERVER_URL` HTTPS produksi.
- `localhost`, IP private, HTTP, query string, hash, dan placeholder akan ditolak oleh guard.
- Wrapper ini butuh internet aktif untuk memuat aplikasi produksi.
- PWA/web tetap dipakai sebagai fallback browser.

### Siapkan env release

```bash
export CAPACITOR_SERVER_URL="https://app.kampus-anda.ac.id"
```

### Validasi config release

```bash
npm run test:capacitor-config
npm run cap:check
```

### Sync Android shell

```bash
npm run cap:sync:android
```

### Generate icon / splash Android

Source file ada di `frontend/resources/`.

```bash
npm run cap:assets:android
```

### Buka project Android

```bash
npm run cap:open:android
```

### Siapkan project Android untuk build release

Project ini **tidak** menyimpan keystore di repo. Simpan di mesin release / CI secret store.

Flow aman:

1. buka Android Studio
2. pastikan `Build Variants` ke release
3. `Build > Generate Signed Bundle / APK`
4. pilih APK
5. isi keystore lokal
6. build signed APK

Atau jalankan helper:

```bash
npm run cap:prepare:android
```

Catatan: helper hanya validasi, sync, lalu buka project Android. Signing dan build APK release tetap dilakukan di Android Studio / Gradle release config rahasia.

### Permission native yang dipakai

- `INTERNET`
- `CAMERA`
- `ACCESS_COARSE_LOCATION`
- `ACCESS_FINE_LOCATION`
- `POST_NOTIFICATIONS`

Tidak ada `ACCESS_BACKGROUND_LOCATION`. Tidak ada cleartext traffic.

## Catatan release

- jangan commit file signing: `*.jks`, `*.keystore`, `key.properties`
- jangan commit `android/local.properties`
- verifikasi APK final dan checksum sebelum dibagikan ke mahasiswa
- distribusi bisa lewat sideload APK internal kampus, tidak perlu Play Store
