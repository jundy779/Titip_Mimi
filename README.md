# Titip Mimi 🎀

Titip Mimi bermula dari satu ruang kecil yang Jundy buat untuk Iqlima. Saat sedang sibuk, titipkan catatan ke Mimi. Nanti, cukup ketik kata yang masih diingat untuk menemukannya lagi.

**[Coba Ruang Iqlima, ruang pertama Titip Mimi](https://ruang-iqlima-mimi.oakrose8.chatgpt.site)**

## Coba satu titipan

1. Buka **Hari Ini** dan pilih **Titip sesuatu**.
2. Isi judul, misalnya “Ambil jahitan”. Tambahkan tanggal dan jam jika ingin menampilkannya di Agenda.
3. Cari “jahitan” di **Koleksi**, atau buka **Agenda** untuk menandainya selesai.

Prototipe web menyimpan titipan di browser yang dipakai. Di menu Agenda, kamu bisa mengimpor acara satu kali dari file kalender .ics dan membuka draf acara di Google Kalender. Login Google, penyimpanan lintas perangkat, pengingat lewat Telegram, dan aplikasi Android/iOS masuk dalam rencana pengembangan.

## Mimi manja dan extension

Mimi menyapa sesuai jam, ikut senang tiap titipan tersimpan atau agenda selesai, dan bisa dielus dari Hari Ini. Sakelarnya ada di Profil. Untuk menitipkan akun langsung dari halaman daftar atau masuk, pasang extension Chrome/Edge di folder [extension](extension/README.md).

## Jalankan di komputer

Frontend memakai Astro + TypeScript. Dari root repo gunakan Node 22.12+ dan npm.

```sh
npm ci
npm run dev
```

Buka alamat lokal yang dicetak Astro. Untuk memeriksa versi statis, jalankan `npm run build` lalu `npm run preview`. Sumber halaman ada di src/pages, komponen di src/components dan aset di public. Folder dist berisi hasil build yang juga bisa disajikan langsung.

## Panduan proyek

Mulai dari [AGENTS.md](AGENTS.md) untuk aturan kerja dan [roadmap](docs/ROADMAP.md) untuk urutan pengembangan. Keputusan produk, acuan visual Mimi, rancangan teknis, dan skenario pengujian tersedia di [peta dokumentasi](docs/README.md).
