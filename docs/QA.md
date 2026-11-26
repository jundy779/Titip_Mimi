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

Tampilan kertas petak, kartu pemandangan dan stiker beranda diperiksa pada Chrome desktop dalam mode terang. Build Astro lulus. Pemeriksaan ponsel fisik masih terbuka.

Jurnal Mimi v1.2: build Astro lulus. Di Chrome desktop, Koleksi, Agenda dan Profil bisa dibuka, sakelar Mode gelap bekerja dan kartu Koleksi tampil dalam tema gelap. Pemeriksaan visual ponsel fisik masih terbuka.

Flutter: formatter Dart berhasil membaca source yang berubah. Build perangkat dan widget test revisi ini belum terverifikasi.

Tipografi ringkas ponsel: build Astro lulus. Pemeriksaan pada perangkat fisik belum dilakukan.

## Alur agenda web pada 24 November 2026

Uji Chrome lulus pada lebar 320, 360, 390, 768, dan 1280 piksel. Keempat halaman utama muat tanpa gulir horizontal. Pada tiga lebar ponsel, judul beranda berukuran 18 piksel. Tema kunjungan pertama terang. Agenda jatuh tempo dapat dibuat, ditunda sepuluh menit, ditemukan lewat Koleksi, lalu diselesaikan. Waktu agenda asli, penundaan, dan status selesai bertahan setelah muat ulang sesuai langkah uji.

Untuk mengulang, jalankan `npm run build`, salin `tests/browser/planner.html` ke `dist/qa.html`, lalu jalankan `npm run preview` pada origin pengujian kosong. Buka `/qa.html` dan pilih **Mulai pengujian**. Jangan sertakan salinan halaman uji saat menerbitkan demo. Pengujian ini memakai viewport browser. Pengiriman saat aplikasi ditutup dan perilaku pada perangkat fisik perlu diuji terpisah.

To-Do List harian: build Astro lulus. Pada Chrome di demo yang diterbitkan, tugas fiktif ditambahkan dan dicentang. Setelah muat ulang, centang masih aktif. Kode Flutter untuk lembar harian sudah ditambahkan, tetapi build dan uji perangkat Android/iOS untuk perubahan ini belum dijalankan.

Revisi lembar ringkas diuji di Chrome pada demo publik. Centang lama terbaca, empat bagian tambahan awalnya tertutup. Pada tanggal lain, tugas baru dapat ditambah dan dicentang, Target dapat dibuka lalu diisi dengan Enter dan ringkasannya berubah menjadi 0/1. Build Astro lulus. Flutter belum diuji pada revisi ini.

Kamar Mimi, uji simulasi web 24 November 2026. Pengujian langkah waktu tetap memeriksa diam tanpa hadiah, gerakan menghindar saat Mimi menerkam, tangkapan setelah benang jatuh, satu hati per tangkapan dan lempar ulang. Build Astro berhasil. Pengujian sentuhan di perangkat Android dan iOS fisik masih terbuka.

Kamar Mimi, 24 November 2026. Build Astro berhasil. Uji simulasi memeriksa satu hadiah per tangkapan, transisi turun setelah menangkap benang dan kontak dengan lantai. Pengujian pada HP fisik masih terbuka.

Uji animasi Kamar Mimi di web. Simulasi jadwal frame 30, 60, 90 dan 120 Hz menghasilkan satu tangkapan untuk kibasan yang sama. Latar Canvas digunakan kembali setelah ukuran stabil. Build Astro lulus. Kecepatan frame di Android dan iOS fisik belum diukur.

Uji simulasi 30, 60 dan 120 Hz memastikan urutan mengintai, menerkam, memeluk lalu duduk, dengan satu hati per tangkapan. Build web berhasil. Pengujian laju bingkai pada perangkat fisik masih terbuka.

Uji handler memeriksa reaksi cilukba dua tahap, tos lewat sentuhan, elusan langsung dalam empat mode, tombol Elus Mimi dan akhir reaksi. Build web berhasil. Pengujian sentuh di perangkat fisik masih terbuka.

## Pilot pengingat perangkat, 24 November 2026

Build Astro dan tiga tes Node lulus. Jalankan `node --test tests/reminder-delivery.test.mjs`. Tes menyimulasikan izin ditolak, aktivasi, notifikasi contoh, pencegahan kirim ulang, penundaan, agenda selesai, dan ketukan menuju agenda yang sama. Ekspor kalender diuji dengan WIB, Unicode, judul multibaris, alarm saat acara mulai, serta tautan kembali. Web menjadwalkan selama halaman berjalan. Pengingat setelah web ditutup memakai salinan yang pengguna simpan di aplikasi kalender.

Android dan iOS mempunyai implementasi penjadwalan lokal. Build dan uji layar terkunci pada perangkat asli masih terbuka. Untuk penerimaan, buat dua agenda dengan nama sama dan jam berbeda, aktifkan izin, tutup aplikasi, kunci HP, dan ketuk pengingat pertama. Periksa detail yang terbuka, tunda sepuluh menit, kunci lagi, lalu selesaikan setelah pengingat kedua datang. Ulangi setelah ubah jadwal, matikan pengingat, tolak izin, dan pada Android setelah restart. Periksa keterlambatan mode hemat daya. REM-1 untuk pengiriman media Telegram menunggu integrasi backend.

25 November 2026, UI-1 Agenda web. Pada demo publik di Chrome desktop, dua baris tertutup masing-masing terukur 48 px, dengan tepi kiri yang sama dan pemisah 1 px. Atur pengingat terbuka lewat klik dan Selesai (1) lewat Enter. Menu menampilkan status izin dan detail agenda yang sesuai. Status agenda contoh dikembalikan setelah pemeriksaan. Build Astro dan tiga tes pengingat lulus. Revisi ini belum diuji pada HP fisik.

### 26 November 2026 · audit tampilan jurnal

Build Astro dan tiga tes pengingat Node lulus. Di Chrome, uji antarmuka dengan data terisolasi lulus pada viewport 320, 360, 390, 768 dan 1280 piksel untuk tema terang dan gelap. Pemeriksaan mencakup navigasi empat halaman, formulir catatan, akun dan agenda, pencarian, detail, penundaan, penyelesaian, tema Kamar Mimi, dan empat pilihan kegiatan. Pada tiga lebar ponsel kartu utama sama lebar dan judul sapaan 18 piksel. Pemeriksaan visual ponsel dan tablet mengungkap lebar kartu yang sempat berbeda, kemudian diperbaiki dan diuji ulang. Pasangan teks utama, teks sekunder dan tombol terhadap warna dasarnya memiliki rasio kontras minimum 5,8:1. Revisi tema Flutter belum dibangun atau diperiksa pada Android dan iPhone fisik.

### Pemeriksaan komponen web, 26 November 2026

Build yang diuji memakai kode aplikasi `b5e7405`. Pengujian tambahan memakai Chrome dengan viewport 390 px, file sintetis dan penyimpanan uji terpisah. Salin `tests/browser/components.html` ke direktori hasil build pada origin uji kosong untuk menjalankannya. Uji responsif lima lebar layar memakai `tests/browser/planner.html`.

| Bagian | Hasil yang diamati | Pemeriksaan yang masih terbuka |
|---|---|---|
| Hari Ini dan To-Do | Centang bertahan setelah urungkan. Batal dan setuju hapus permanen menghasilkan status yang tepat. Fokus kembali ke input. Ringkasan Target dan Rawat diri, memo, pengingat tertulis, prioritas dan pemisahan tanggal berfungsi. | Kemudahan penggunaan sehari-hari oleh Iqlima dan input sentuh dengan keyboard HP. |
| Koleksi, formulir dan kartu akun | Validasi kosong, tambah, edit, riwayat, pencatatan ganti sandi, batal di konfirmasi pertama dan kedua serta hapus final lulus. Pencarian kosong dapat diatur ulang. Impor CSV meminta pilihan, menyimpan metadata dan mengenali duplikat. | Uji ekspor asli lintas versi browser. Integrasi brankas otomatis merupakan pekerjaan terpisah. |
| Agenda dan pengingat | File kalender rusak menghasilkan pesan. Impor valid dan impor ulang menghasilkan tepat satu agenda. Draf Google membawa judul yang benar dan tombol alarm tersedia. Tiga tes Node pengingat lulus. | Simpan pada kalender tujuan dan periksa pengiriman pada layar terkunci di Android dan iOS. |
| Navigasi dan aksesibilitas | Enter membuka formulir catatan, Tab berpindah ke judul, Escape menutup dan mengembalikan fokus ke Tulis catatan. Sakelar tema, ukuran responsif dan pilihan kegiatan game tercakup dalam uji sebelumnya. | Pembaca layar, pembesaran teks sistem, seluruh urutan fokus, Safari dan Firefox. |
| Kamar Mimi dan aplikasi Flutter | Empat mode game web sudah diuji sebagai pilihan. Tema aplikasi Flutter ada di kode. | Kelancaran gerak, input sentuh dan perangkat grafis; build Android dan iOS serta uji HP fisik. |
