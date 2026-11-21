# Rancangan teknis

**Saat ini** • Situs statis menyimpan titipan di localStorage dengan kunci ruang-iqlima-demo-v1. Agenda lama memuat title, note, time dan done. Impor kalender dapat menambahkan UID, informasi acara seharian dan waktu UTC. Situs memakai aset ilustrasi demo. Foto contoh pada kartu belum membuktikan alur unggah media.

**Usulan untuk implementasi** • Pertahankan web prototipe selama pilot. Gunakan klien Flutter untuk Android/iOS, satu backend Node.js, Telegraf untuk bot, serta SQLite pada volume persisten dengan backup dan uji pemulihan. Tim boleh meninjau kembali pilihan teknis bila kebutuhan operasional berubah. Semua klien memakai API dan pemeriksaan kepemilikan yang sama.

| Data | Tempat dan identitas |
|---|---|
| Profil dan sesi | Backend memetakan identitas Google terverifikasi ke ID pengguna internal. |
| Titipan dan akun | Database menyimpan ID titipan, pemilik, jenis, judul, isi/caption, waktu perubahan, dan versi. Kartu akun menyimpan petunjuk login. |
| Media | Telegram memegang file. Database menyimpan referensi bot, file, jenis, dan pemilik. Sediakan aksi membuka kembali lewat bot untuk media yang belum bisa dipratinjau. |
| Agenda dan pengingat | Agenda menunjuk titipan. Simpan waktu, zona waktu, status, dan waktu kirim berikutnya. Acara seharian memakai tanggal kalender. |
| Google Kalender terhubung | Saat fitur aktif, petakan ID agenda lokal ke kalender dan ID acara eksternal per akun. Izin kalender diminta terpisah dari login aplikasi. |

**Migrasi lokal.** Sesudah login pertama, tawarkan “Pindahkan titipan dari browser ini?”. Impor hanya setelah pemilik menyetujui, gunakan penanda impor per item agar percobaan ulang tidak menggandakan isi, dan verifikasi hasil sebelum menghapus salinan. Uji browser bersama dengan dua akun.

**Telegram.** Hubungkan memakai token sekali pakai yang kedaluwarsa. Cocokkan pengirim dengan profil yang ditautkan, tampilkan nama akun, dan sediakan putus sambungan. Deduplicasi pesan yang dikirim ulang Telegram. Isi Saved Messages lama masuk saat diteruskan pengguna.

**Pengingat.** Simpan pekerjaan di database. Saat proses hidup kembali, periksa pekerjaan tertunda dan status selesai/tunda terbaru. Catat hasil kirim, retry terbatas, serta kemungkinan kiriman ganda jika respons penyedia hilang. Uji batas jam tenang dan pergantian tanggal WIB.

**Kalender.** Impor .ics sekarang bersifat salinan dan deduplikasi memakai UID. Tombol kirim membuka draf yang disimpan pengguna di Google. Sebelum sinkron otomatis, sepakati kalender tujuan, konflik perubahan, pembatalan, kejadian berulang, dan dampak mencabut izin.
