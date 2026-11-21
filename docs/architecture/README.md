# Arsitektur target

| Komponen | Tanggung jawab |
|---|---|
| Astro + TypeScript | Merender Hari Ini, Koleksi, Agenda dan Profil. Form dan pencarian berjalan di browser. |
| Flutter | Menghadirkan alur yang sama pada Android/iOS memakai API bersama. |
| NestJS + TypeScript | Memverifikasi sesi, memeriksa kepemilikan titipan dan mengatur agenda. |
| SQLite persisten | Menyimpan data terstruktur dan pekerjaan pengingat. |
| Telegraf + Telegram | Menerima kiriman, mengaitkan referensi media dan mengirim pengingat. |

Saat foto nota diterima, backend mencari profil dari akun Telegram yang tertaut, mencatat ID kiriman dan referensi media dalam satu transaksi, lalu mengonfirmasi penyimpanan. Jadwal yang telah dikonfirmasi menghasilkan pekerjaan pengingat. Worker memeriksa ulang status agenda dan tautan Telegram sebelum mengirim.

Hari ini hanya prototipe di dist/ yang dapat dijalankan. Rincian migrasi, integrasi dan asumsi operasional ada di [TECH](../TECH.md).
