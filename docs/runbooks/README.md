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

**Rollback.** Simpan image sebelumnya. Bila versi baru bermasalah, jalankan ulang image lama dengan volume yang sama. Migrasi database hanya menambah; sebelum migrasi berikutnya, buat backup dulu.
