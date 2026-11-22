# Memulai pengembangan

Jalankan frontend Astro dari root dengan Node 22.12+ dan buka alamat lokal yang dicetak oleh server.

```sh
npm ci
npm run dev
```

**Migrasi Astro.** Halaman Hari Ini dan form titipan sudah menjadi komponen Astro. Koleksi, Agenda dan Profil masih dirender oleh skrip browser. Pertahankan aset Mimi, bahasa, urutan navigasi, serta kunci penyimpanan yang dicatat di [TECH](../TECH.md). Bandingkan hasil pada lebar HP dan desktop. Uji titipan yang sudah ada sebelum dan sesudah pergantian frontend pada origin yang sama. Origin berbeda membutuhkan mekanisme pemindahan tersendiri.

**Irisan kerja pertama.** Setelah tampilan dan data lama terverifikasi, implementasikan login Google, satu endpoint simpan, dan satu endpoint pencarian. Jalankan AUTH-1 dan MIG-1 sebelum memperluas integrasi. Gunakan akun uji dan pisahkan konfigurasi lokal, pilot, serta produksi.

Sebelum mengirim perubahan, cocokkan dengan [standar kode](../CODING_STANDARD.md) dan [checklist review](../CODE_REVIEW_CHECKLIST.md).
