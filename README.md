# The Sultan Laundry — Web App (Prototype)

Prototype alur order pelanggan (cart Satuan + Kiloan, bayar setelah verifikasi) dalam bentuk web app statis. Bisa di-deploy gratis ke GitHub Pages dan di-install ke home screen Android seperti aplikasi biasa (PWA).

## Cara Deploy ke GitHub Pages

1. **Buat repository baru** di GitHub, misalnya `sultan-laundry-app`.
2. **Upload semua file di folder ini** (`index.html`, `style.css`, `app.js`, `manifest.json`, `sw.js`, folder `icons/`) ke repo tersebut — bisa lewat web GitHub ("Add file" → "Upload files") atau lewat git:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Sultan Laundry app"
   git branch -M main
   git remote add origin https://github.com/USERNAME/sultan-laundry-app.git
   git push -u origin main
   ```
3. Di repo GitHub, buka **Settings → Pages**.
4. Pada **Source**, pilih branch `main` dan folder `/ (root)`, lalu **Save**.
5. Tunggu 1–2 menit. URL app akan muncul di bagian atas, formatnya:
   `https://USERNAME.github.io/sultan-laundry-app/`

## Cara Install ke HP Android (seperti app)

1. Buka URL di atas pakai **Chrome** di Android.
2. Tap menu titik tiga (⋮) di pojok kanan atas.
3. Pilih **"Add to Home screen" / "Install app"**.
4. Icon "Sultan Laundry" akan muncul di home screen, terbuka tanpa address bar seperti app native.

## Wajib Diisi Sebelum Deploy: Sambungkan ke Backend

Buka `app.js`, baris paling atas:

```js
const CONFIG = {
  API_BASE_URL: "https://YOUR-BACKEND-URL.up.railway.app",
};
```

Ganti dengan URL backend Anda setelah backend (`sultan-laundry-backend`) selesai di-deploy ke Railway. Tanpa ini, app tidak akan bisa login/order.

## Fitur yang Sudah Tersambung ke Backend

- **Login/Register** — pakai nomor WA + password (OTP via WhatsApp sudah ada di backend, tinggal disambungkan kalau mau dipakai)
- **Order dari cart** — submit langsung ke database lewat API, bukan localStorage lagi
- **Tracking real-time** — polling ke backend setiap 6 detik selama di halaman tracking
- **Pembayaran manual** — halaman "Bayar Sekarang" muncul begitu order diverifikasi outlet, menampilkan info rekening/QRIS dari backend, lalu pelanggan foto & unggah bukti transfer

## Push Notification (Opsional, Lanjutan)

Kerangka sudah ada di `app.js` (`setupPushNotification()`), tapi masih perlu 3 hal dari Firebase Console:
1. Buat project di [Firebase Console](https://console.firebase.google.com), tambahkan Web App.
2. Ambil `firebaseConfig` (apiKey, projectId, dst.) dan **VAPID key** (Project Settings → Cloud Messaging → Web Push certificates).
3. Tambahkan Firebase SDK di `index.html` sebelum `app.js`:
   ```html
   <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
   <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js"></script>
   <script>firebase.initializeApp({ /* isi firebaseConfig di sini */ });</script>
   ```
4. Ganti `"YOUR_VAPID_KEY"` di `app.js` dengan VAPID key Anda, lalu panggil `setupPushNotification()` setelah login berhasil.
5. Buat file `firebase-messaging-sw.js` di root (isi & langkahnya ada di dokumentasi Firebase Web Push).

Backend sudah siap menerima & mengirim notifikasi begitu langkah ini selesai (lihat README backend bagian "Push Notification").

## Batasan Prototype Ini

- Cocok untuk: validasi alur UX ke tim/kurir/calon investor, dan acuan visual pasti untuk development app Android native nanti.
- Belum ada endpoint khusus app Kurir (foto bukti pickup/delivery) — menyusul di fase berikutnya.
- Push notification perlu setup Firebase manual (lihat di atas) sebelum aktif.

## Struktur File

```
index.html      - halaman utama
style.css       - tema visual (dark gold/navy, nuansa "Sultan")
app.js          - seluruh logika alur (cart, order type, pickup, tracking)
manifest.json   - konfigurasi PWA (nama, icon, mode standalone)
sw.js           - service worker untuk cache offline dasar
icons/          - icon app (192px & 512px)
```
