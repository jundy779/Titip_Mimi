# Keputusan dan usulan perubahan

| Jenis | Keputusan awal | Alasan |
|---|---|---|
| Disepakati | Login utama Google; Telegram opsional dari Profil | Satu cara masuk dan sesuai kebiasaan menyimpan media |
| Disepakati | Gaya planner pink, feminin, Mimi dan bahasa sederhana | Prototipe harus terasa personal untuk Iqlima |
| Disepakati | Telegram untuk media; teks, agenda dan petunjuk akun disimpan sistem | Media bisa dibawa kembali saat pengingat tiba |
| Disepakati | Web, Android dan iOS; Google Play setelah pilot | Dahulukan pengalaman Iqlima |
| Disepakati | Web Astro + TypeScript, mobile Flutter, API NestJS + TypeScript, SQLite persisten dan Telegraf | Satu API untuk web dan ponsel. Aset serta data prototipe menjadi acuan migrasi. |
| Terbuka | Sinkron kalender otomatis, berbagi dengan pasangan, serta prioritas OCR | Perlu kasus penggunaan dan keputusan batas akses |

**Cara mengusulkan perubahan.** Tulis masalah yang dialami Iqlima, contoh nyata, fitur terdampak, tahap yang bergeser, dampak pada data lama, dan kriteria uji. Tandai “Diusulkan” sampai Jundy memutuskan. Catat masukan Iqlima untuk perubahan pengalaman pribadi dan berbagi data. Setelah diterima, perbarui PRD, desain, teknis, roadmap atau QA sesuai dampaknya.

**Format entri** • tanggal | diajukan oleh | masalah | pilihan | dampak | keputusan/pemilik | dokumen terkait.


22 November 2026 · Jundy menetapkan Codex/ChatGPT untuk frontend dan UI/UX, Claude untuk backend/database/keamanan, serta Cursor untuk pemeriksaan menyeluruh. Panduan dan format serah terima tersedia di [peta dokumentasi](README.md).

28 November 2026 · Jundy · Iqlima ingin Mimi terasa lebih personal dan akun baru sering lupa dicatat.

| Jenis | Keputusan | Dampak |
|---|---|---|
| Disepakati | **Mimi manja**: sapaan sesuai jam, reaksi saat titip/selesai, elus Mimi, sambutan gembira saat kembali. Tanpa kalimat yang membuat Iqlima merasa bersalah. Bisa dimatikan di Profil. | Tidak mengubah data titipan. Preferensi di `titip-mimi-manja-v1` (web) dan `manja*` (Flutter). |
| Disepakati | **Extension Chrome/Edge “Titip ke Mimi”** untuk menitipkan petunjuk akun dari halaman daftar/masuk. Hanya nama layanan, email/label, dan cara masuk. Tidak pernah membaca kolom sandi. | Kartu menunggu di penyimpanan extension sampai web Titip Mimi dibuka di browser yang sama. Publikasi Chrome Web Store perlu keputusan terpisah. |
| Disepakati | Claude boleh mengerjakan frontend web, Flutter, dan extension selain backend. | AGENTS.md dan CLAUDE.md diperbarui. |
| Ditunda | “Mimi kangen” lewat notifikasi, pesan dari Jundy, dan Mimi yang ikut muncul di halaman lain | Butuh keputusan batas akses dan frekuensi notifikasi. |
