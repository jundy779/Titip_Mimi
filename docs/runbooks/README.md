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

## Menyiapkan bot Telegram (sekali, oleh Jundy)

1. Di Telegram, buka **@BotFather**, kirim `/newbot`, beri nama (misalnya *Mimi*) dan username yang berakhiran `bot`. Simpan token yang diberikan. Token ini rahasia: jangan ditulis di repo, chat, atau screenshot.
2. Pilih cara bot menerima pesan:
   - **Webhook** (server online dengan HTTPS): isi `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` (acak 32+ karakter huruf, angka, `_` atau `-`, misalnya hasil `openssl rand -hex 24`), dan `PUBLIC_URL=https://alamat-server`. Setelah server jalan: `cd server && npm run telegram:setup`. Perintah ini memasang webhook dengan secret, mendaftarkan perintah bot, lalu mencetak status webhook.
   - **Polling** (laptop atau server tanpa domain): isi `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, dan `TELEGRAM_MODE=polling`. Server menarik pesan sendiri tiap beberapa detik. Webhook lama otomatis dilepas; pesan yang menunggu tidak hilang. Bot hanya bekerja selama laptop menyala.
3. Iqlima masuk di web, buka **Profil > Koneksi Mimi > Hubungkan Telegram**, lalu ketuk **Mulai** di Telegram. Profil berubah menjadi "Tersambung ke @…".

Pengingat dicek tiap 30 detik (`REMINDER_EVERY_MS`). Pengingat yang terlambat lebih dari 6 jam (misalnya server mati semalaman) tidak dikirim, supaya tidak menyerbu.

**Mengganti token atau secret.** Token bocor: `/revoke` di @BotFather, ganti `TELEGRAM_BOT_TOKEN`, restart, jalankan `npm run telegram:setup` lagi. Secret webhook: ganti `TELEGRAM_WEBHOOK_SECRET`, restart, `npm run telegram:setup`. Tautan Iqlima tetap berlaku karena terikat ke akun Telegram, bukan ke token.

**Memeriksa pengiriman** (di server, tanpa membuka isi titipan):

```sh
sqlite3 /data/mimi.sqlite "SELECT status, COUNT(*) FROM reminder_deliveries GROUP BY status"
sqlite3 /data/mimi.sqlite "SELECT client_id, occurrence, attempts, error FROM reminder_deliveries WHERE status IN ('retry','failed') ORDER BY next_try DESC LIMIT 20"
```

`retry` dicoba lagi setelah 1, 5, 15, lalu 60 menit (atau sesuai `retry_after` dari Telegram), paling banyak 5 kali, lalu `failed`. `error = 'gone'` berarti Iqlima memblokir bot atau menghapus obrolan; sambungan otomatis diputus dan Profil kembali menawarkan **Hubungkan Telegram**.

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
| "Bot Telegram belum diaktifkan di server" | `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_BOT_USERNAME` |
| Bot menjawab "Tautan ini sudah kedaluwarsa" | Kode berlaku 10 menit dan sekali pakai. Tekan Hubungkan Telegram lagi. |
| Pengingat tidak datang | Sudah dikonfirmasi waktunya (titipan berjenis Agenda), bukan jam tenang, status di `reminder_deliveries` |
| Foto tidak terbuka di web | Lebih dari 20 MB (buka dari Telegram), atau Telegram sedang tidak terjangkau (coba lagi) |

**Rollback.** Simpan image sebelumnya. Bila versi baru bermasalah, jalankan ulang image lama dengan volume yang sama. Migrasi database hanya menambah, dan server lama tetap bisa membuka database versi 2 (bot dan pengingat Telegram berhenti sampai versi baru dipasang lagi). Sebelum menjalankan versi dengan migrasi baru, buat backup dulu dan pastikan perintah backup selesai dengan kode 0.
