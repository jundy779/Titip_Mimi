# Panduan kerja Ruang Iqlima

Tujuan setiap perubahan adalah membantu Iqlima menitipkan sesuatu saat sibuk, menemukannya kembali, atau mengingatnya tepat waktu. Mulai dari [rencana rilis](docs/ROADMAP.md) dan [batas produk](docs/PRD.md).

1. Tentukan satu hasil yang bisa dicoba pengguna. Sebut tahap dan kriteria lulusnya dari [QA](docs/QA.md).
2. Untuk perubahan antarmuka, buka [panduan desain dan gambar acuan](docs/DESIGN.md). Pertahankan bahasa Indonesia sehari-hari, empat menu utama, serta cara masuk yang disepakati.
3. Periksa penyimpanan lama sebelum mengubah model data. Pertahankan titipan pengguna dan uji alur pindah perangkat dengan akun uji. Pakai [rancangan teknis](docs/TECH.md).
4. Kerjakan keputusan rutin dalam cakupan tahap. Jika usulan mengubah login, penyimpanan media, akses pasangan, arah visual, atau prioritas rilis, tulis dampaknya di [catatan keputusan](docs/DECISIONS.md) dan minta keputusan Jundy sebelum mengimplementasikannya.
5. Setelah pengujian, catat bukti, perangkat, hasil, dan yang belum teruji di QA. Perbarui status tahap hanya setelah kriteria lulusnya terpenuhi. Bedakan demo, integrasi akun uji, dan fitur yang sudah dipakai Iqlima.
6. Simpan data uji fiktif dalam contoh, tangkapan layar, dan laporan masalah. Kredensial layanan hanya melalui konfigurasi privat.

Di repositori prototipe, situs statis berada di `dist/`. Dokumen dan gambar referensi berada di luar folder publik tersebut.
