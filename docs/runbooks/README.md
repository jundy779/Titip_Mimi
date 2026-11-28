# Operasi dan pemulihan

## Menyiapkan login Google (sekali, oleh Jundy)

1. Buka Google Cloud Console → APIs & Services → Credentials → Create credentials → OAuth client ID → **Web application**.
2. Isi **Authorized JavaScript origins** dengan alamat web Titip Mimi, misalnya `https://mimi.contohdomain.id` (dan `http://localhost:3000` untuk uji).
3. Salin Client ID. Tidak ada client secret yang dibutuhkan karena server hanya memverifikasi ID token.
4. Atur layar persetujuan OAuth ke mode Testing dan tambahkan email Iqlima serta Jundy sebagai test user.

## Menjalankan

Dengan Docker (satu layanan, web + API, data di volume):

```sh
docker build --build-arg PUBLIC_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com -t titip-mimi .
docker run -d -p 3000:3000 -v mimi-data:/data \
  -e GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com \
  -e ALLOWED_EMAILS=iqlima@gmail.com,jundy@gmail.com \
  titip-mimi
```

Tanpa Docker: `PUBLIC_GOOGLE_CLIENT_ID=... npm run build` di root, lalu di `server/`: `npm ci && npm run build && npm start` dengan variabel dari `server/.env.example`. Pasang HTTPS di depan server (reverse proxy atau platform hosting). Cookie memakai `Secure` saat `NODE_ENV=production`.

**Wajib di produksi:** `GOOGLE_CLIENT_ID`, `ALLOWED_EMAILS` (pilot pribadi), HTTPS, volume persisten untuk `/data`. Server mencetak peringatan bila dua variabel pertama kosong. Log hanya berisi metode, jalur, status, dan durasi.

## Menyiapkan bot Telegram

Cara termudah, tanpa menyentuh server: ikuti halaman **/panduan-telegram** di Ruang Iqlima. Ringkasnya: buat bot di **@BotFather** (`/newbot`), salin tokennya, lalu tempel di **Profil > Koneksi Mimi > Token bot dari BotFather > Pasang bot**. Server mengecek token ke Telegram, menyimpannya, memasang deskripsi dan menu perintah, lalu mulai menerima pesan. Hanya akun yang memasang yang bisa mengganti atau melepas bot.

Cara bot menerima pesan dipilih otomatis:
- **Webhook** bila `PUBLIC_URL` berisi alamat `https://` server. Secret webhook dibuat acak oleh server.
- **Polling** bila `PUBLIC_URL` kosong (laptop atau server tanpa domain). Bot hanya bekerja selama server menyala.

Alternatif lewat environment (untuk admin): isi `TELEGRAM_BOT_TOKEN`, opsional `TELEGRAM_BOT_USERNAME` (bila kosong diambil dari Telegram), lalu `TELEGRAM_MODE=polling`, atau webhook dengan `TELEGRAM_WEBHOOK_SECRET` (acak 32+ karakter, misalnya `openssl rand -hex 24`) dan `PUBLIC_URL`. Saat menyala, server memasang webhook, deskripsi, dan menu sendiri. `npm run telegram:setup` tetap tersedia untuk memasang ulang secara manual. Bot dari environment tidak bisa diganti dari Profil.

Setelah bot terpasang, Iqlima menekan **Hubungkan Telegram** di Profil lalu **Mulai** di Telegram. ID Telegram tercatat otomatis; tidak ada yang perlu diketik. `/id` di bot menampilkannya bila dibutuhkan.

Pengingat dicek tiap 30 detik (`REMINDER_EVERY_MS`). Pengingat yang terlambat lebih dari 6 jam (misalnya server mati semalaman) tidak dikirim, supaya tidak menyerbu.

**Mengganti token.** Token bocor: di @BotFather kirim `/token`, pilih bot, salin token baru, lalu pakai token baru itu di mana pun. Bot dari Profil: **Ganti atau lepas bot > Ganti token**, tempel token baru. Bot dari environment: ganti `TELEGRAM_BOT_TOKEN` lalu restart. Bila username bot sama, sambungan Iqlima tetap berlaku. Bila pindah ke bot lain, semua harus menekan Hubungkan Telegram lagi, dan lampiran lama mungkin tidak bisa dibuka dari web karena `file_id` terikat ke bot penerimanya {belum diuji}.

**Memeriksa pengiriman** (di server, tanpa membuka isi titipan):

```sh
sqlite3 /data/mimi.sqlite "SELECT status, COUNT(*) FROM reminder_deliveries GROUP BY status"
sqlite3 /data/mimi.sqlite "SELECT client_id, occurrence, attempts, error FROM reminder_deliveries WHERE status IN ('retry','failed') ORDER BY next_try DESC LIMIT 20"
```

`retry` dicoba lagi setelah 1, 5, 15, lalu 60 menit (atau sesuai `retry_after` dari Telegram), paling banyak 5 kali, lalu `failed`. `error = 'gone'` berarti Iqlima memblokir bot atau menghapus obrolan; sambungan otomatis diputus dan Profil kembali menawarkan **Hubungkan Telegram**.

## Notifikasi walau web ditutup

Tidak perlu langkah tambahan: server membuat kunci VAPID sekali dan menyimpannya di tabel `settings`. Iqlima menekan **Aktifkan walau web ditutup** di Profil atau Agenda > Atur pengingat di setiap browser yang dipakai. Server harus bisa menghubungi layanan push browser (`fcm.googleapis.com`, `*.push.services.mozilla.com`, `web.push.apple.com`, `*.notify.windows.com`); endpoint lain ditolak. Di iPhone, Web Push hanya jalan setelah Ruang Iqlima ditambahkan ke Layar Utama dan dibuka dari sana.

Kunci VAPID ikut ke backup. Kalau kuncinya hilang atau diganti, semua langganan lama berhenti menerima; Iqlima cukup menekan Aktifkan lagi.

## Menyambungkan aplikasi HP

Di web yang sudah masuk: Profil > **Sambungkan aplikasi HP** menampilkan alamat server dan kode 8 huruf (10 menit, sekali pakai). Di aplikasi: Profil > Akun Titip Mimi, isi keduanya, tekan Sambungkan. HP tidak butuh login Google. Alamat server harus `https://` (kecuali alamat jaringan lokal untuk uji).

## Uji otomatis di GitHub

`.github/workflows/ci.yml` menjalankan tes web dan server, lalu `flutter analyze`, `flutter test`, dan `flutter build apk --debug` setiap push ke `main` atau `claude/**`. Lihat hasilnya di tab Actions. Kalau langkah Flutter gagal, perbaiki dulu sebelum membangun APK untuk HP Iqlima. `pubspec.lock` diperbarui oleh `flutter pub get`; commit hasilnya dari mesin yang punya Flutter.

## Memindahkan data dari demo lama

Data prototipe tersimpan di browser pada alamat demo lama (`*.chatgpt.site`). Browser tidak bisa membaca data itu dari alamat baru. Pilihannya:

1. Terbitkan ulang demo lama dengan `PUBLIC_MIMI_API=https://alamat-server-baru` dan `PUBLIC_GOOGLE_CLIENT_ID`, tambahkan origin demo ke `ALLOWED_ORIGINS` server dan ke Authorized JavaScript origins Google.
2. Iqlima membuka demo lama, masuk dari Profil, lalu memilih **Pindahkan titipan**. Setelah itu titipan muncul di alamat baru.

## Backup dan pemulihan

- Harian: `cd server && npm run backup -- /data/mimi.sqlite /data/backup`. Perintah gagal (kode keluar 1) bila salinan tidak lolos `integrity_check` atau jumlah baris berbeda.
- Simpan salinan di luar server (misalnya Google Drive pribadi Jundy). Hapus salinan lebih dari 30 hari.
- Uji pulih tiap bulan: jalankan server uji dengan `DATABASE_PATH=<salinan>` di port lain, masuk dengan akun uji, cek jumlah titipan.

## Jika ada masalah

| Gejala | Periksa |
|---|---|
| Tombol Google tidak muncul | `PUBLIC_GOOGLE_CLIENT_ID` saat build, origin terdaftar di Google, pemblokir iklan |
| “Login Google belum diaktifkan di server” | `GOOGLE_CLIENT_ID` server |
| “Akun ini belum diundang” | Email ada di `ALLOWED_EMAILS` (huruf kecil) |
| Titipan tidak muncul di perangkat lain | Status di Profil, sudah memilih Pindahkan, koneksi; sinkron berjalan tiap 60 detik dan saat aplikasi dibuka |
| Server tidak bisa menulis | Izin volume `/data`, ruang disk |
| Bot tidak membalas sama sekali | Log server: `telegram` di baris `started`. Webhook: `npm run telegram:setup` menampilkan `lastError`. Polling: hanya satu proses yang boleh menarik pesan. |
| Profil meminta token bot | Belum ada bot. Pasang dari Profil atau isi `TELEGRAM_BOT_TOKEN` |
| "Bot ini dipasang dari akun lain" | Hanya akun pemasang yang bisa mengganti atau melepas bot |
| Bot menjawab "Tautan ini sudah kedaluwarsa" | Kode berlaku 10 menit dan sekali pakai. Tekan Hubungkan Telegram lagi. |
| Pengingat tidak datang | Sudah dikonfirmasi waktunya (titipan berjenis Agenda), bukan jam tenang, status di `reminder_deliveries` |
| Foto tidak terbuka di web | Lebih dari 20 MB (buka dari Telegram), atau Telegram sedang tidak terjangkau (coba lagi) |

**Rollback.** Simpan image sebelumnya. Bila versi baru bermasalah, jalankan ulang image lama dengan volume yang sama. Migrasi database hanya menambah, dan server lama tetap bisa membuka database versi 2 (bot dan pengingat Telegram berhenti sampai versi baru dipasang lagi). Sebelum menjalankan versi dengan migrasi baru, buat backup dulu dan pastikan perintah backup selesai dengan kode 0.
