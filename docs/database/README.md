# Model data awal

Skema konseptual untuk pilot. Nama tabel dapat diselaraskan dengan migrasi pertama.

| Tabel | Isi dan aturan |
|---|---|
| users | ID internal, identitas Google unik, nama panggilan, zona waktu dan jam tenang |
| items | Pemilik, ID klien, jenis, judul, isi/caption, versi, waktu perubahan. Pasangan pemilik dan ID klien unik. |
| account_hints | ID titipan, nama layanan, label email, cara masuk. Beberapa entri boleh merujuk layanan yang sama. |
| telegram_links | Relasi profil dengan pengguna dan chat Telegram yang sudah dikonfirmasi. |
| attachments | ID titipan, jenis media, file_id dan identitas kiriman untuk deduplikasi. |
| reminders | ID titipan, waktu target, status, percobaan kirim, dan waktu tunda berikutnya. |

Gunakan foreign key, transaksi untuk perubahan item dan pengingat terkait, serta indeks pada pemilik dan waktu kirim. Pertahankan tanggal lokal untuk acara seharian. Simpan waktu absolut dan zona asal untuk agenda yang memiliki jam.

Saat migrasi dari localStorage, pertahankan judul, catatan, waktu, status selesai, UID kalender dan tanggal akhir acara seharian. Uji salinan data lama di lingkungan terpisah dan simpan penanda impor yang tahan retry.
