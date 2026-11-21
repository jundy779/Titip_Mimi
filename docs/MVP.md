# MVP Titip Mimi

**Hasil pilot pertama.** Iqlima bisa menitipkan foto nota lewat Telegram, memilih kapan ingin diingatkan, menemukan titipannya lewat web di perangkat lain, lalu menerima foto yang sama ketika pengingat tiba. Nama produk Titip Mimi. Ruang Iqlima adalah ruang pribadi pertamanya.

| Prioritas | Cakupan | Bukti penerimaan |
|---|---|---|
| Inti | Masuk dengan Google dan pindahkan titipan lama atas persetujuan pengguna | Satu catatan dari browser lama muncul tepat sekali di akun yang dipilih, termasuk sesudah percobaan ulang. |
| Inti | Simpan dan cari teks, petunjuk akun, agenda dan referensi media | Dua akun Canva dapat dibedakan. Pengguna kedua tidak dapat membuka data pengguna pertama. |
| Inti | Hubungkan Telegram dari Profil dan terima kiriman | Satu kiriman menghasilkan satu titipan. Foto nota dapat dibuka kembali. Uji video dan dokumen secara terpisah. |
| Inti | Jadwalkan, tunda dan selesaikan pengingat | Waktu ditampilkan dalam zona pengguna. Mimi membawa lampiran dan menghormati jam tenang. |
| Pertahankan | Desain Mimi, empat menu serta kalender manual | Bandingkan layar HP dan desktop dengan gambar acuan. Ulangi uji impor .ics dan buka draf kalender. |

**Urutan distribusi yang diusulkan.** Validasi alur inti di web responsif dan Telegram dulu. Android dan iOS tetap target produk; uji Flutter di perangkat nyata pada tahap pilot mobile. Sinkronisasi kalender otomatis, OCR, transkripsi suara, berbagi dengan pasangan, dan publikasi toko aplikasi mendapat keputusan terpisah setelah umpan balik pilot.

**Kriteria selesai.** Catat hasil UI-1, WEB-1, CAL-1/2, AUTH-1, MIG-1, AKUN-1, TG-1, REM-1 dan OPS-1 di [QA](QA.md). Bedakan “lulus dengan data uji” dan “sudah diterima Iqlima”. Pekerjaan pertama adalah mempertahankan alur simpan-cari saat migrasi Astro.
