# Rencana mobile Titip Mimi

Target pertama adalah Iqlima bisa membuka titipan yang sama dari HP dan web, termasuk foto nota yang dikirim melalui Telegram. Android dan iOS berbagi satu aplikasi Flutter berbasis Dart. Riverpod untuk status sesi/titipan dan GoRouter untuk navigasi dipilih sebagai baseline rencana mobile. Backend NestJS dan SQLite melayani ketiga klien.

| Tahap | Pekerjaan | Bukti untuk lanjut |
|---|---|---|
| 0 · Aset dan acuan | Bekukan [paket Mimi v1](../../assets/mimi/v1/README.md), empat menu, bahasa dan gambar acuan. | Semua pose tersedia sebagai file terpisah dan punya ID tetap. |
| 1 · Flutter lokal | Mulai struktur aplikasi, tema pink, layout adaptif, navigasi Hari Ini, Koleksi, Agenda, Profil. Gunakan data fiktif. | Pada Android dan iPhone: tambah catatan, cari, buka detail, tandai selesai; uji teks besar, keyboard, tombol kembali dan area aman. |
| 2 · Akun dan data | Sambungkan login Google dan API per pemilik. Tawarkan impor data lokal; pertahankan input ketika simpan gagal. | Dua perangkat memakai satu akun melihat item yang sama. Akun kedua terisolasi. Retry tidak menggandakan item. |
| 3 · Telegram dan media | Tautkan Telegram dari Profil. Hubungkan foto, video, dokumen, caption dan pengingat dengan ID titipan yang sama. | Kirim nota, cari dari ponsel, terima pengingat dengan lampiran, lalu coba selesai, tunda, jam tenang, dan putus sambungan. |
| 4 · Pilot perangkat | Coba akses lambat/offline, pergantian akun, WIB/acara seharian, navigasi dari pengingat, dan konsistensi dengan web. | Catat versi OS, perangkat, hasil aktual, masukan Iqlima dan perbaikan sebelum kandidat rilis. |
| 5 · Distribusi | Siapkan build Android untuk uji internal dan build iOS untuk penguji yang ditunjuk. Tinjau data yang dikumpulkan, penghapusan akun, pencadangan, dan aset toko. | Jundy menilai hasil pilot bersama Iqlima sebelum memutuskan Google Play publik atau distribusi iOS lebih luas. |

**Integrasi aset Flutter.** Saat paket aplikasi dibuat, salin folder runtime v1 ke assets/mimi/v1 di paket Flutter, deklarasikan direktori itu pada pubspec.yaml, lalu muat melalui Image.asset dengan ID dari manifest. Gunakan BoxFit.contain. Beri label semantik saat pose menyampaikan informasi dan sembunyikan dari pembaca layar bila teks di sampingnya sudah menjelaskan status. Cache aset lokal agar Mimi tetap tersedia tanpa koneksi.

**Pemilik.** Codex/ChatGPT mengerjakan frontend Flutter, perilaku Mimi dan UI/UX. Claude menyiapkan endpoint, data serta penautan akun. Cursor memeriksa build dan alur gabungan dari HP sampai pengiriman bot. Aplikasi Flutter, pengiriman Telegram dan rilis toko adalah tahap implementasi berikutnya; paket ini menyediakan rencana dan artwork statis.

Tema Flutter memakai Material 3. Petakan ColorScheme, TextTheme, NavigationBarTheme dan InputDecorationTheme mengikuti [aturan komponen](../DESIGN.md) dan [token v1](../../design/tokens.json). Pada tahap Flutter lokal, bandingkan Hari Ini dan form titipan dengan panduan web pada ukuran ponsel.

Implementasi tahap 1 tersedia di [mobile](../../mobile/README.md). Flutter sudah memakai Riverpod, GoRouter, tema perangkat, penyimpanan lokal dan pengingat selama aplikasi terbuka. Bukti uji dan batas verifikasi tercatat di [QA](../QA.md).
