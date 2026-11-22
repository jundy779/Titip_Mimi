# Mimi · acuan karakter v1.0

Gunakan berkas dari paket ini saat membuat layar, demo atau pesan bot. Referensi induk adalah [ilustrasi asli](../../../docs/referensi/mimi.webp). Lihat [semua pose](atlas.webp) dan [daftar ID untuk aplikasi](manifest.json).

**Identitas visual.** Kucing krem berbulu halus, proporsi anak kucing dengan kepala besar, mata plum, tanda hati merah muda di area mata kiri dari sudut pandang penonton, pita stroberi di telinga kanan penonton. Gunakan orientasi asli, garis pensil hangat dan warna pipi lembut. Pertahankan rasio 1:1, ruang di sekeliling telinga dan seluruh properti. Pakai gambar yang sama untuk Android, iOS, web, dan bot. Ukuran visual kecil dapat memakai pose welcome sebagai avatar.

| Saat pengguna… | ID pose |
|---|---|
| Baru masuk atau membuka profil | welcome |
| Membuka beranda desktop / agenda HP | planner / peek |
| Menulis atau melampirkan foto | write / photo |
| Mencari titipan atau melihat koleksi kosong | search / empty |
| Membuka pesan personal atau menerima pengingat | letter / remind |
| Memilih tunda atau memasuki jam tenang | snooze / sleep |
| Menyelesaikan agenda atau berhasil menyimpan | done / saved |
| Berhasil menghubungkan layanan atau kehilangan koneksi | linked / offline |
| Melakukan percobaan ulang atau mengatur privasi | retry / privacy |
| Menyelesaikan rangkaian agenda dan mengizinkan sapaan | celebrate |

**Pemakaian.** Satu pose utama per momen. Sampaikan status dengan teks juga. Tampilkan saved setelah penyimpanan berhasil, linked setelah sambungan terverifikasi, dan sleep ketika sapaan tambahan dijeda. Aksi tunda memakai jadwal baru yang telah tersimpan. Ekspor menggunakan latar transparan dan kanvas 512 × 512. Untuk Telegram, nama-stiker dan publikasi pack dipilih saat bot diaktifkan.

**Perubahan.** Nama ID merupakan kontrak antarklien. Gunakan kembali pose paling dekat untuk momen baru. Untuk perubahan karakter, simpan versi berikut di folder baru dan catat alasan serta keputusan Jundy. Iqlima dapat memberi masukan tanpa kehilangan paket v1.
