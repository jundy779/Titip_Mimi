# Frontend dan pengalaman pengguna

**Pemilik:** Codex untuk implementasi dan ChatGPT untuk desain interaksi, bahasa, serta review visual. Keduanya menggunakan [acuan desain](../DESIGN.md).

| Area | Keputusan kerja |
|---|---|
| Web | Edit halaman dan komponen Astro di src/, CSS dan ilustrasi di public/. Pertahankan fungsi lama saat memindahkan interaksi ke TypeScript. |
| Mobile | Pertahankan istilah dan urutan Hari Ini, Koleksi, Agenda, Profil. Uji layar sempit dan keyboard perangkat. |
| Bahasa | “Titip sesuatu” untuk mulai. Tampilkan sukses sesudah penyimpanan berhasil. Jika gagal, pertahankan input dan beri tindakan berikutnya. |
| Integrasi | Cocokkan format waktu, status simpan, kondisi kosong dan kesalahan dengan kontrak Claude. Tandai data contoh atau aksi yang belum terhubung. |

Gunakan tabel per layar di DESIGN.md untuk beranda, halaman tugas, form, detail, dan konfirmasi. Bandingkan halaman yang berubah dalam tema terang dan gelap pada desktop dan HP. Coba simpan, cari, buka detail, dan selesaikan satu agenda. Ulangi dengan data browser lama pada origin yang sama. Sertakan ukuran layar, langkah yang diuji dan perbedaan visual aktual dalam serah terima.
