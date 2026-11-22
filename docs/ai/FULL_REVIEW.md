# Pemeriksaan menyeluruh oleh Cursor

Mulai dari diff terhadap commit acuan dan [checklist review](../CODE_REVIEW_CHECKLIST.md). Ikuti tindakan Iqlima hingga data dan hasil akhirnya. Untuk tahap prototipe, cek Astro → browser → penyimpanan lokal. Saat backend tersedia, tambahkan API, SQLite, bot dan pekerjaan pengingat.

| Pemeriksaan | Bukti yang dicari |
|---|---|
| Build dan frontend | Build dari checkout bersih; aset dimuat; empat menu bisa dipakai; hasil simpan tetap terbaca sesudah reload. |
| UI/UX | Perbandingan gambar acuan dengan HP dan desktop; urutan fokus, label, kondisi kosong/gagal dan bahasa Mimi. |
| Data dan integrasi | Kontrak klien-server cocok; kepemilikan, migrasi, penanganan duplikat, kalender seharian, zona waktu dan referensi media teruji. |
| Keamanan dan operasi | Periksa perubahan izin, penyimpanan kredensial, isi log, backup, dan dampak kegagalan. Tindak lanjuti temuan backend dengan Claude. |

Laporkan temuan terurut menurut dampak disertai lokasi, langkah reproduksi dengan data fiktif, hasil aktual dan hasil yang diharapkan. Sebutkan commit, perintah yang dijalankan, hasil dan area yang belum diuji. Kirim perbaikan UI ke Codex/ChatGPT, backend/data/keamanan ke Claude, lalu uji ulang area terdampak.
