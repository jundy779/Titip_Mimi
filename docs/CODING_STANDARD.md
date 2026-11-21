# Standar kode Titip Mimi

- Pakai tipe eksplisit di batas API dan validasi data saat masuk. Dokumentasikan beda tanggal seharian dan waktu terjadwal.
- Pertahankan satu representasi titipan antarhalaman. Pusatkan akses penyimpanan agar migrasi dari browser ke server bisa diuji.
- Periksa kepemilikan di backend pada setiap baca dan ubah. Rahasia layanan berada di konfigurasi server. Gunakan data fiktif untuk contoh.
- Pakai transaksi untuk perubahan yang saling bergantung. Rancang operasi simpan, migrasi dan webhook agar aman dicoba ulang.
- Tampilkan kegagalan penyimpanan dengan bahasa yang memberi tindakan berikutnya. Konfirmasi Mimi muncul setelah simpan berhasil.
- Untuk komponen visual, rujuk [DESIGN](DESIGN.md). Pastikan label form, fokus keyboard dan tombol pada layar sempit tetap dapat digunakan.
