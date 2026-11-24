# Titip Mimi untuk Android dan iOS

Aplikasi Flutter ini menyimpan catatan, petunjuk akun, agenda, dan pilihan tema di perangkat. Pengingat di aplikasi selalu tersedia. Di Profil, aktifkan **Ingatkan di HP** dan izinkan notifikasi untuk menjadwalkan pengingat lokal di Android dan iOS. Web dan mobile memiliki penyimpanan lokal masing-masing.

Gunakan Flutter 3.35.7 atau versi kompatibel. Jalankan dari direktori ini.

```sh
flutter pub get
flutter test
flutter run
```

Build Android memerlukan Android SDK. Build iOS memerlukan macOS dan Xcode. Untuk distribusi diperlukan identitas dan konfigurasi signing pemilik.

## Pengingat lokal

Mimi menjadwalkan hingga 60 pengingat terdekat. Membuka aplikasi, menyimpan perubahan waktu, menunda agenda, atau menandainya selesai memperbarui antrean. Menonaktifkan sakelar mengosongkan jadwal. Isi notifikasi hanya mengajak pengguna membuka Mimi. Android memakai alarm hemat daya yang waktunya dapat bergeser dan memulihkan jadwal mendatang setelah perangkat dimulai ulang.

### Uji penerimaan pada perangkat

1. Pasang build Android atau iOS, buat agenda beberapa menit ke depan, lalu izinkan notifikasi melalui Profil.
2. Kunci HP dan periksa apakah notifikasi muncul dengan isi umum. Ketuk untuk membuka Mimi.
3. Dari pengingat di aplikasi, pilih tunda sepuluh menit. Periksa waktu agenda asli dan tunggu pengingat kedua.
4. Buat agenda lain, ubah jamnya, lalu kunci HP. Periksa bahwa hanya jadwal baru yang muncul. Ulangi dengan menandai agenda selesai dan dengan menonaktifkan sakelar.
5. Tolak atau cabut izin di pengaturan HP, kembali ke aplikasi, lalu periksa pesan di Profil. Di Android, periksa juga agenda mendatang setelah memulai ulang perangkat dan membuka kunci.

Status pengiriman di layar kunci perlu diverifikasi di perangkat nyata. Demo web memiliki alur pengingat tersendiri.
