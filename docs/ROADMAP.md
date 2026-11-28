# Rencana pengembangan

Baseline 21 November 2026 • Prototipe web [Ruang Iqlima](https://ruang-iqlima-mimi.oakrose8.chatgpt.site) • Revisi sumber aplikasi c130eb1.

| Tahap | Hasil yang dituju | Syarat lanjut | Status |
|---|---|---|---|
| 0. Prototipe | Web pink dengan Mimi, koleksi, agenda lokal, cari, selesai, impor .ics terbatas dan draf Google Kalender | Periksa visual dan satu alur simpan-cari di HP Iqlima | Sudah tayang, penerimaan di HP masih terbuka |
| 1. Profil dan titipan tersimpan | Login Google, API per pengguna, simpan lokal ke akun atas pilihan pengguna, kartu akun digital | Titipan muncul di HP dan laptop dengan akun yang sama; akun uji kedua terisolasi; migrasi ulang tanpa ganda | Berikutnya |
| 2. Telegram dan pengingat | Tautkan dari Profil, terima teks/foto/video/dokumen, cari caption, jadwalkan pengingat beserta lampiran | Skenario nota selesai dari kirim sampai selesai/tunda, termasuk setelah restart | Direncanakan |
| 3. Aplikasi dan pilot | Klien Android/iOS dengan navigasi dan bahasa yang sama; koreksi dari pemakaian sehari-hari | Catat hasil uji perangkat nyata dan keputusan Iqlima soal versi pilot | Direncanakan |
| 4. Integrasi dan distribusi | Integrasi kalender langsung sesuai kebutuhan pilot; persiapan distribusi Google Play setelah keputusan Jundy dan Iqlima | Akun uji kalender berhasil; privasi dan pemulihan data ditinjau sebelum rilis publik | Bersyarat |

**Pekerjaan terdekat secara berurutan**

1. Jundy dan Iqlima mencoba “Titip sesuatu”, “Cari titipan”, lalu “Tandai selesai” di ponsel. Catat layar, perangkat, dan revisi visual.
2. Pengembang memindahkan web ke Astro + TypeScript, menguji tampilan serta data lokal lama, lalu menyiapkan konfigurasi Google untuk lingkungan uji, skema pemilik/titipan, migrasi database, serta sesi API.
3. Hubungkan satu alur simpan dan cari lintas perangkat. Uji dua akun, koneksi putus, dan data prototipe lama sebelum memperluas fitur.
4. Setelah tahap 1 lulus, bangun satu alur Telegram lengkap untuk foto nota, baru lanjut ke variasi media dan pengingat.

Urutan ini usulan pelaksanaan, bukan komitmen tanggal. Jika kalender otomatis menjadi kebutuhan utama setelah pilot, catat alasannya dan ubah prioritas di catatan keputusan.


**Pembaruan 22 November.** Halaman Hari Ini dan dialog titipan memakai Astro. Build serta uji fungsi lokal tercatat di [QA](QA.md). Berikutnya Codex/ChatGPT memeriksa visual, Claude mengerjakan kontrak login dan penyimpanan tahap 1, lalu Cursor melakukan review lintas komponen.

**Pembaruan 28 November.** Mimi manja hadir di web dan Flutter, dengan sakelar di Profil. Extension Chrome/Edge “Titip ke Mimi” tersedia untuk uji lokal. Berikutnya: jalankan `flutter test` di mesin dengan SDK Flutter, coba extension di laptop Iqlima, lalu lanjut ke tahap 1 (login Google dan sinkron) agar kartu dari extension ikut muncul di HP.

**Pembaruan 28 November (malam).** Tahap 1 terimplementasi di branch `claude/mimi-manja-extension`: server NestJS + SQLite, login Google, pindahkan titipan atas persetujuan, sinkron otomatis, backup teruji. Menunggu: Client ID Google dan pilihan hosting dari Jundy, lalu uji di HP dan laptop Iqlima. Setelah itu: Flutter memakai API yang sama, lalu Telegram (tahap 2).

**Pembaruan 28 November (malam, 2).** Tahap 2 terimplementasi dengan data uji: bot Telegram (tautkan dari Profil, terima teks/foto/video/dokumen, konfirmasi waktu, `/cari`, `/tenang`, `/stop`) dan pengingat lewat Telegram yang membawa lampiran, menghormati jam tenang, bisa ditunda dan diselesaikan. Bisa jalan dengan webhook (server HTTPS) atau polling (laptop). Menunggu: token bot dari @BotFather, server online, dan uji di HP Iqlima. Rincian di [QA](QA.md) dan [serah terima](ai/handoff/2026-11-28-telegram.md).

**Pembaruan 28 November (malam, 3).** Lima usulan dari PRD selesai dengan data uji: surat dari Jundy dan rencana berdua (lewat akun bila tersambung pasangan, atau tautan WhatsApp tanpa akun), baca undangan dari foto langsung di HP, dikte suara, dan pengelola kata sandi di kartu akun (plus tempat acara dengan tautan peta). Server naik ke migrasi 4. Rincian di [QA](QA.md) dan [serah terima](ai/handoff/2026-11-28-pasangan.md). Menunggu: uji di HP Iqlima, terutama kualitas baca foto undangan asli dan dikte di Chrome Android.
