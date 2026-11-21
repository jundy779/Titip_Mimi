# Kontrak API pilot

Rancangan untuk backend NestJS. Prototipe statis saat ini menyimpan data di browser. Endpoint berikut adalah usulan untuk web Astro dan klien Flutter.

| Operasi | Kontrak usulan | Perilaku |
|---|---|---|
| Titip sesuatu | POST /v1/items | Terima clientId, judul, isi, jenis dan jadwal opsional. Simpan clientId unik per pemilik agar retry mengembalikan item yang sama. |
| Cari titipan | GET /v1/items?q= | Cari judul, catatan dan caption milik profil aktif. Hasil memuat ID serta versi. |
| Ubah agenda | PATCH /v1/items/{id} | Terima perubahan dan versi yang dibaca klien. Balas 409 jika sudah berubah agar klien memuat ulang sebelum menyimpan. |
| Hubungkan Telegram | POST /v1/telegram/link | Kembalikan tautan bot sekali pakai dengan waktu kedaluwarsa. |
| Putus Telegram | DELETE /v1/telegram/link | Hentikan pengiriman baru ke chat lama dan tampilkan dampaknya pada pengingat. |

Identitas pemilik berasal dari sesi yang telah diverifikasi di server. Gunakan 401 untuk sesi berakhir dan 404 untuk item yang tidak tersedia bagi pengguna. Validasi jenis titipan, jadwal, zona waktu dan panjang teks sebelum menyimpan. Pisahkan izin Calendar API dari login. Lengkapi kontrak respons, paginasi dan pengujian dua akun saat endpoint pertama diimplementasikan.
