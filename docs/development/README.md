# Memulai pengembangan

Jalankan prototipe dari root dengan perintah berikut, lalu buka localhost:8000.

```sh
python -m http.server 8000 --directory dist
```

**Migrasi Astro.** Port satu halaman dan komponen bersama terlebih dahulu. Pertahankan aset Mimi, bahasa, urutan navigasi, serta kunci penyimpanan yang dicatat di [TECH](../TECH.md). Bandingkan hasil pada lebar HP dan desktop. Uji titipan yang sudah ada sebelum dan sesudah pergantian frontend pada origin yang sama. Origin berbeda membutuhkan mekanisme pemindahan tersendiri.

**Irisan kerja pertama.** Setelah tampilan dan data lama terverifikasi, implementasikan login Google, satu endpoint simpan, dan satu endpoint pencarian. Jalankan AUTH-1 dan MIG-1 sebelum memperluas integrasi. Gunakan akun uji dan pisahkan konfigurasi lokal, pilot, serta produksi.

Sebelum mengirim perubahan, cocokkan dengan [standar kode](../CODING_STANDARD.md) dan [checklist review](../CODE_REVIEW_CHECKLIST.md).
