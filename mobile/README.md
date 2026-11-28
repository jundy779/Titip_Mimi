# Titip Mimi untuk Android dan iOS

Aplikasi Flutter ini menyimpan catatan, petunjuk akun, agenda, dan pilihan tema di perangkat. Di Agenda, buka **Atur pengingat** untuk memberi izin dan menjadwalkan hingga 60 agenda terdekat pada perangkat. **Coba notifikasi** menjadwalkan tes sekitar satu menit kemudian. Android memakai alarm yang waktunya dapat bergeser ketika perangkat menghemat daya. Membuka aplikasi memperbarui daftar agenda yang dijadwalkan. Build dan pengujian layar terkunci pada Android serta iOS masih menunggu verifikasi. Web dan mobile memiliki penyimpanan lokal masing-masing.

Mimi manja (sapaan sesuai jam, gelembung reaksi, elus Mimi) bisa dimatikan di Profil. Logikanya ada di `lib/mimi_manja.dart` dan memakai kalimat yang sama dengan web.

Gunakan Flutter 3.35.7 atau versi kompatibel. Jalankan dari direktori ini.

```sh
flutter pub get
flutter test
flutter run
```

Build Android memerlukan Android SDK. Build iOS memerlukan macOS dan Xcode. Untuk distribusi diperlukan identitas dan konfigurasi signing pemilik.
