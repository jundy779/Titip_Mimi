# Operasi dan pemulihan pilot

**Prototipe web.** Verifikasi build statis memuat index, CSS, JavaScript dan aset Mimi. Buka tautan demo, simpan satu titipan fiktif, muat ulang, lalu cari kembali. Jika revisi menyebabkan masalah, terbitkan ulang versi baik terakhir pada origin yang sama dan cek bahwa data browser sebelumnya masih terbaca.

**Ketika backend aktif.** Catat versi aplikasi, migrasi database, lokasi volume, penanggung jawab dan cara mengakses backup melalui kanal privat. Sebelum migrasi, buat backup konsisten menggunakan mekanisme backup SQLite. Pulihkan ke database uji, cek integritas, jumlah titipan, kepemilikan, dan referensi media. Jalankan pemulihan uji dengan pengiriman Telegram dinonaktifkan agar pengingat asli tidak terkirim.

**Jika pengingat terlambat.** Periksa jadwal serta zona waktu, jam tenang, status selesai/tunda, antrean dan status sambungan bot. Jika hasil pengiriman sebelumnya tidak pasti, periksa catatan sebelum mencoba kembali. Catat jumlah item terdampak dan hasil pemulihan.

**Menjelang distribusi.** Catat hasil perangkat nyata, persetujuan pilot, cara meminta penghapusan data dan prosedur kembali ke versi sebelumnya. Isi perintah deploy/rollback aktual setelah hosting backend dipilih.
