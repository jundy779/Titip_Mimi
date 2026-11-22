# Skenario penerimaan

Gunakan contoh fiktif “Ambil jahitan” dan “Canva Kampus”. Tulis tanggal, perangkat/browser, hasil aktual, serta bukti atau kendala untuk setiap pengujian. Tabel berikut adalah kriteria penerimaan.

| ID | Coba | Lulus bila |
|---|---|---|
| UI-1 | Buka Hari Ini pada ponsel sempit dan desktop, bandingkan dengan gambar acuan | Menu, Mimi, agenda, dan tombol utama terlihat; layar bisa dipakai tanpa gulir horizontal |
| WEB-1 | Titip catatan, tambah jadwal, muat ulang, cari judul lalu tandai selesai | Catatan tetap ada di browser yang sama dan status agenda berubah |
| CAL-1 | Impor file .ics yang sama dua kali, termasuk acara WIB, seharian dan berulang | Jam dan tanggal benar, UID yang sama tidak ganda, acara yang dilewati dilaporkan |
| CAL-2 | Buka draf kirim dan simpan di akun uji Google | Judul, catatan dan waktu benar; periksa hasil pada kalender tujuan |
| AUTH-1 | Masuk di HP dan laptop dengan akun A, lalu gunakan akun B | Titipan A sinkron di kedua perangkat; akun B tidak bisa melihat atau mengubahnya |
| MIG-1 | Pindahkan data lama, ganggu jaringan lalu coba lagi | Ada pilihan pengguna dan tidak ada titipan hilang atau ganda |
| AKUN-1 | Tambah Canva kampus dan pribadi | Kedua label dan metode masuk dapat dibedakan dalam pencarian |
| TG-1 | Tautkan bot, kirim media beserta caption, coba putus dan tautkan ulang | Koleksi berisi satu item per kiriman; akun yang dilepas tidak menerima pengingat |
| REM-1 | Jadwalkan nota, restart, tunda lalu selesaikan | Media yang benar terkirim, waktu tunda dipatuhi, agenda selesai tidak dijadwalkan ulang |
| MOB-1 | Coba alur inti di Android dan iPhone | Navigasi konsisten, bahasa mudah dipahami, jam tenang sesuai pilihan |
| OPS-1 | Pulihkan backup ke lingkungan uji | Titipan, kepemilikan, dan referensi lampiran dapat dibaca kembali |

**Bukti baseline.** Publikasi web berhasil. Uji kode kalender mencakup konversi WIB dan tanggal akhir acara seharian lintas tahun. Uji kalender menggunakan akun Google Iqlima, verifikasi visual di HP miliknya, dan penerimaan pengguna masih terbuka. Uji fitur tahap mendatang berstatus menunggu implementasi.

**Format temuan** • ID uji | tanggal dan perangkat | langkah | hasil aktual | hasil yang diinginkan | status setelah perbaikan.


### 22 November 2026 · migrasi pertama ke Astro

Node 24, Astro 6.4.8. Build statis berhasil. Pada hasil build, simulasi DOM dengan penyimpanan lama lulus untuk baca titipan, tambah, cari, tandai selesai, keempat menu, dan tautan draf kalender. Uji ini tidak mengukur tampilan atau interaksi layanan Google. Pemeriksaan visual pada HP/desktop dan review independen oleh Cursor masih terbuka.

Prototipe web, Koleksi bertipe. Build Astro lulus. Uji fungsi simpan dengan DOM simulasi membedakan dua kartu Canva, menyunting catatan tanpa duplikat, membaca hasil simpan, serta mengenali titipan lama. Uji visual perangkat asli, sinkronisasi lintas akun, dan pemeriksaan Cursor masih terbuka.

Pada frontend lokal, build Astro lulus. Di Chrome, pengingat Ambil jahitan tampil dan menghilang setelah ditunda. Uji logika waktu memeriksa batas 10 menit dan status selesai. Di Flutter 3.35.7, analisis Dart serta dua tes lulus untuk alur membuat, menyimpan dan membuka catatan serta penundaan tanpa mengubah waktu acara. Build APK menunggu platform dan build-tools Android SDK berlisensi. Build iOS menunggu macOS dengan Xcode. Uji perangkat nyata, notifikasi latar belakang dan sinkronisasi API tetap terbuka.
