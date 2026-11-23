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

Beranda adaptif diuji di Chrome dengan viewport 390, 820, dan 1280 px. Keempat menu tersedia pada setiap ukuran dan dokumen tidak meluap secara horizontal. Menunda agenda menampilkan konfirmasi 10 menit. Build Astro dan tiga tes Flutter lulus, termasuk pergantian navigasi pada tiga lebar tersebut. Analisis Dart bersih. Pengujian ini menggunakan viewport dan widget simulasi. Perangkat Android dan iOS fisik belum diperiksa.

Koleksi diperiksa pada demo web publik melalui Chrome. Filter Akun menghasilkan nol hasil pada data contoh, Atur ulang mengembalikan daftar, dan pencarian kata "nota" menemukan detail Ambil jahitan. Build Astro, tiga tes Flutter, dan analisis Dart lulus. Tes pencarian Flutter memeriksa hasil kosong lalu pemulihan daftar. Belum diuji pada perangkat fisik.

Agenda web dan Flutter memakai tanggal lokal untuk grup Terlewat, Hari ini, Besok dan Berikutnya. Selesai dapat dilipat. Build Astro lulus. Uji DOM dengan jam simulasi memeriksa pintasan melewati tahun baru, simpan jadwal, konfirmasi waktu, buka nota, tunda sepuluh menit, pengingat muncul kembali dan selesai. Empat tes Flutter lulus, termasuk membuka grup Selesai dan menampilkan Besok. Analisis Dart bersih. Pengujian perangkat fisik dan pengiriman latar belakang belum tercakup.

Impor metadata akun tersedia di Koleksi > Akun pada web. Build Astro dan uji CSV fiktif lulus untuk BOM, CRLF, kolom berkutip, koma dan baris baru, fallback hostname, duplikat saat impor ulang, serta penolakan CSV rusak. Objek hasil uji hanya berisi petunjuk akun dan tidak memuat kata sandi, catatan bebas, atau query URL. Impor Flutter dan pengiriman ke brankas eksternal belum tersedia.

Navigasi web diperiksa di Chrome desktop. Hari Ini, Koleksi, Agenda dan Profil bisa dibuka bergantian. Keempat tombol memperbarui aria-current. Build Astro lulus. Tampilan perangkat fisik belum diuji pada revisi ini.

Revisi halaman planner diuji dengan Chrome desktop: buka Profil, pilih Gelap, buka Agenda, buka dan batalkan formulir, pindah ke Koleksi, buka detail catatan. Build Astro lulus. Belum ada verifikasi perangkat fisik atau pengukuran frame animasi.

Sakelar Mode gelap di Profil diuji di Chrome dengan klik dan tombol spasi. Pilihan gelap bertahan setelah muat ulang. Opsi Ikuti perangkat dapat diaktifkan kembali. Build Astro lulus.

Tema web dua pilihan diuji pada hasil build Astro. Tema awal dan preferensi lama system membuka tampilan terang, pilihan manual dipulihkan dan sakelar menyimpan perubahan.

Beranda berilustrasi diuji di Chrome desktop: ketiga pintasan membuka jenis formulir yang tepat dan bisa dibatalkan. Build Astro lulus. Perangkat fisik belum diuji untuk revisi ini.
