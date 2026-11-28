# Titip Mimi untuk Android dan iOS

Aplikasi Flutter ini menyimpan catatan, petunjuk akun, agenda, dan pilihan tema di perangkat. Setelah disambungkan ke akun (Profil > Akun Titip Mimi, dengan kode dari Profil web), titipan tersinkron dengan web dan foto dari Telegram ikut tampil. Di Agenda, buka **Atur pengingat** untuk memberi izin dan menjadwalkan hingga 60 agenda terdekat pada perangkat. **Coba notifikasi** menjadwalkan tes sekitar satu menit kemudian. Android memakai alarm yang waktunya dapat bergeser ketika perangkat menghemat daya. Membuka aplikasi memperbarui daftar agenda yang dijadwalkan. Build dan pengujian layar terkunci pada Android serta iOS masih menunggu verifikasi. Tanpa akun, web dan mobile memiliki penyimpanan lokal masing-masing.

Fitur yang sama dengan web: Tumpahkan pikiran, Minta tolong Jundy (WhatsApp atau Instagram), Jaga diri (ikut dijadwalkan ke pengingat HP), ulang tahun dan musim Leo, Kamar Mimi (dibuka di browser dari server yang sama). Logika murninya di `lib/iqlima.dart`; `test/iqlima_test.dart` membandingkannya dengan `test/fixtures/iqlima_cases.json` yang dibuat dari web (`TZ=Asia/Jakarta node tool/make_fixtures.mjs`). Sinkron di `lib/server.dart` memakai aturan yang sama dengan web.

Mimi manja (sapaan sesuai jam, gelembung reaksi, elus Mimi) bisa dimatikan di Profil. Logikanya ada di `lib/mimi_manja.dart` dan memakai kalimat yang sama dengan web.

Gunakan Flutter 3.35.7 atau versi kompatibel. Jalankan dari direktori ini.

```sh
flutter pub get
flutter test
flutter run
```

Build Android memerlukan Android SDK. Build iOS memerlukan macOS dan Xcode. Untuk distribusi diperlukan identitas dan konfigurasi signing pemilik.
