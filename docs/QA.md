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

### 28 November 2026 · Mimi manja dan extension Titip ke Mimi

| ID | Coba | Lulus bila |
|---|---|---|
| MANJA-1 | Buka Hari Ini pada pagi, siang, sore, malam, larut, dan setelah 2 hari tidak membuka. Elus Mimi, titip, selesaikan agenda, matikan sakelar | Sapaan dan pose sesuai jam, sambutan kembali gembira, gelembung muncul setelah aksi berhasil, mati total saat sakelar off, tidak ada kalimat menyalahkan |
| EXT-1 | Pasang extension, titip akun dari halaman daftar, lalu buka Titip Mimi di browser yang sama | Isian terisi dari halaman tanpa membaca sandi, peringatan bila isian mirip sandi, kartu masuk Koleksi tepat sekali, antrean bersih setelah dikonfirmasi |

**Hasil di lingkungan pengembangan (Chrome 153.0.8010.12 headless, Linux, preview Astro lokal).** Build Astro lulus. `node --test tests/*.test.mjs` lulus 19 tes, termasuk 6 tes Mimi manja, 5 tes penerima kartu extension, dan 5 tes logika extension. Uji browser dengan jam palsu 28 November 08.00 WIB pada 390, 1280 (gelap), dan 320 px lulus untuk sapaan pagi, elus, gelembung saved dan done, sakelar mati dan nyala, penerimaan kartu dari extension tanpa ganda, penolakan kartu tidak valid, dan tanpa gulir horizontal. Extension dimuat di Chrome headless: email terbaca dari halaman daftar fiktif, kolom sandi tidak terbaca, peringatan isian mirip sandi, dua kartu antre dengan lencana 2, kartu sampai di Koleksi, antrean bersih, titip ulang tidak ganda saat web terbuka.

**Belum teruji.** Flutter: kode Mimi manja dan tes `mobile/test/mimi_manja_test.dart` belum dikompilasi karena SDK Flutter tidak tersedia di lingkungan ini. Jalankan `flutter analyze` dan `flutter test` sebelum diterima. Extension belum dicoba di Edge, Chrome versi lama, dan situs login asli dengan iframe atau Shadow DOM. Impor CSV di Flutter belum dibuat karena butuh paket pemilih file. Penerimaan oleh Iqlima masih terbuka.

### 28 November 2026 · Kamar Mimi v2 (3D anime)

Chrome 153 headless dengan SwiftShader (render CPU), 390 × 844 dan 1280 × 860. Lulus: scene 3D aktif, main benang sampai tertangkap, elus lewat tombol dan usapan di kanvas, cilukba dua tahap, tos, suapi lewat tombol dan seret ikan ke mulut, mandi lewat tombol dan gosok gelembung di kanvas, pegang dan lempar benang, ngobrol sampai akhir, tanpa error maupun peringatan konsol. Tanpa WebGL, mode ilustrasi tampil dan tombol tetap bekerja. Laju frame 7 fps di render CPU tidak mewakili GPU HP. Belum teruji: laju frame dan panas di HP Android/iPhone nyata, Safari iOS, serta penilaian Iqlima.

### 28 November 2026 · Sifat Mimi

`node --test tests/*.test.mjs` lulus 27 tes, termasuk 8 tes sifat Mimi: mood per jam, sambutan setelah lama pergi, ingatan favorit, pemilihan kebiasaan, larangan kalimat menyalahkan, tidur lalu dibangunkan, dan jalan-jalan. Uji browser (Chrome 153 headless, SwiftShader, 390 px) lulus untuk label mood, sapaan, lima kebiasaan, bangun saat disentuh, kebiasaan muncul sendiri setelah dibiarkan, sakelar suara, dan ingatan favorit tanpa error konsol. Uji mode main dan seret diulang dan tetap lulus. Kualitas suara sintetis hanya diperiksa lewat tidak adanya error; dengarkan langsung di HP sebelum diterima. Parameter `?mimi-debug` hanya untuk uji.

### 28 November 2026 · AUTH-1 dan MIG-1 (lingkungan uji)

Server: `cd server && npm test` lulus 16 tes dengan verifier Google palsu dan akun fiktif iqlima.uji@contoh.id / jundy.uji@contoh.id. Tercakup: cookie HttpOnly dan token hanya atas permintaan, hash token, akun tidak diundang, email belum terverifikasi, Google tidak terjangkau, login dimatikan tanpa Client ID, CSRF, isolasi dua pemilik (baca, cari, tulis), migrasi diulang tanpa ganda, konflik terbaru-menang dan urutan seri yang konsisten, delapan sinkron paralel, tombstone, validasi dan pembuangan kolom kata sandi, logout dan sesi kedaluwarsa, pencarian dengan karakter khusus, batas 10 login per menit, backup yang dipulihkan.

Web (Chrome 153 headless, dua profil browser sebagai dua perangkat, server uji dengan web hasil build): 16 pemeriksaan lulus. Titipan lama diberi ID, tawaran pindah muncul dan tidak ada yang dikirim sebelum disetujui, dua titipan pindah, sesi lewat cookie tanpa token di localStorage, perangkat kedua menerima titipan tanpa ditanya, catatan baru dari perangkat dua muncul di perangkat satu, kartu akun tersinkron, hapus dengan dua konfirmasi menyebar, akun kedua terisolasi, keluar tetap menyimpan titipan lokal. Uji web lama (Mimi manja, extension) tetap lulus 22 cek.

**Belum teruji:** login Google sungguhan (butuh Client ID dari Jundy dan akses ke accounts.google.com), Dockerfile (daemon Docker tidak tersedia di lingkungan ini), deploy HTTPS, Safari, pemindahan dari demo lama lewat `PUBLIC_MIMI_API`, Flutter. Status AUTH-1 dan MIG-1: lulus dengan data uji, belum diterima Iqlima.

### 28 November 2026 · Teman harian Iqlima

Node: 35 tes web lulus, termasuk 8 tes baru untuk pengenalan tanggal dan jam bahasa sehari-hari, rutinitas (termasuk selesai lebih awal dan tanggal 31), hitungan mingguan, pesan dan tautan WhatsApp, deteksi kalimat mengkhawatirkan, jadwal jaga diri, musim Leo, dan ulang tahun. Server: 17 tes lulus, termasuk kolom rutinitas dan minta tolong.

Chrome 153 headless, jam palsu Sabtu 28 November 09.05 WIB, 390/1280/320 px: 24 pemeriksaan lulus. Pengingat minum muncul, tumpahkan pikiran menyimpan dua dari tiga baris dengan jadwal benar, cek sebelum keluar, kemenangan kecil, agenda bulanan membuat jadwal 30 Desember setelah selesai, pengaturan Profil tersimpan, pesan minta tolong dan tautan wa.me ke nomor Jundy, catatan sudah minta tolong, lencana ulang tahun, tanggapan ruang lega, ruang lega tidak masuk titipan, bantuan resmi untuk kalimat mengkhawatirkan, tanpa gulir horizontal, tanpa error konsol.

Belum: Flutter belum punya fitur ini, notifikasi jaga diri saat web ditutup, dan penilaian Iqlima.

28 November 2026 · Kontak Jundy. 36 tes Node lulus (termasuk pembersihan nomor dan username serta tautan atur sekali, dengan data fiktif). Uji Chrome: tautan atur sekali menyimpan kontak, membersihkan alamat, Profil menampilkan IG dan WA, dialog Minta tolong Jundy menawarkan Instagram dan WhatsApp, tanpa error. Uji fitur Iqlima diulang dan tetap lulus 24 cek. Repo diperiksa tidak memuat nomor atau username asli.

## Ukuran layar (28 Nov 2026)

Diuji di Chrome headless pada 12 ukuran: 280×653 (layar penutup HP lipat paling sempit), 320×568, 360×780, 375×667, 393×852, 440×956, 474×696 (perkiraan layar luar iPhone Fold), 852×393 (HP miring), 884×1104 (Galaxy Z Fold terbuka), 904×640 (perkiraan layar dalam iPhone Fold), 768×1024, dan 1114×720 dengan engsel 34px di x=540 (layar ganda gaya Surface Duo, lewat `Emulation.setDeviceMetricsOverride` + `displayFeature`).

Yang dicek per ukuran di Hari Ini, Koleksi, Agenda, Profil, Tumpahkan pikiran, Titip, dan Kamar Mimi: tidak ada gulir ke samping, tidak ada elemen keluar layar, target sentuh minimal 40px, teks minimal 12px, tombol utama dialog terlihat tanpa menggulir, dan di layar ganda tidak ada tombol, teks, atau gambar yang menyeberangi engsel.

Ukuran iPhone Fold masih perkiraan dari bocoran resolusi (dibagi skala 3), belum dicoba di perangkat asli. Tata letak dua panel di Flutter (`verticalHinge` di `mobile/lib/main.dart`) belum dikompilasi karena Flutter SDK tidak tersedia di lingkungan ini.

## TG-1 dan REM-1: bot Telegram dan pengingat (28 Nov 2026, malam)

**Lulus dengan data uji, belum diterima Iqlima.** Telegram dan Google diganti tiruan; akun fiktif iqlima.uji@contoh.id dan jundy.uji@contoh.id, pengguna Telegram fiktif 7001 dan 7002. Belum ada bot sungguhan yang dibuat.

- `cd server && npm test`: 37 lulus, 0 gagal. Termasuk 19 tes Telegram:
  - Webhook tanpa secret yang benar dijawab 404.
  - Tautan sekali pakai: ditolak kalau kedaluwarsa, sudah dipakai, atau Telegram-nya milik akun lain. Kode hanya tersimpan sebagai hash.
  - Grup dan pengguna yang belum tersambung tidak bisa menitip.
  - Teks jadi satu titipan. Jadwal baru aktif setelah dikonfirmasi, dan tombol milik akun lain tidak berpengaruh.
  - Update berulang tidak membuat titipan dobel (lewat handler maupun webhook).
  - Balasan berisi waktu mengonfirmasi jadwal; balasan tanpa waktu dijawab dengan contoh.
  - Album jadi satu titipan dan `file_id` tidak dikirim ke browser.
  - Foto pemilik lain dijawab 404, termasuk saat id lampirannya disalin lewat sinkron.
  - Dokumen HTML dipaksa unduh. File lebih dari 20 MB dijawab 413, dan Telegram mati dijawab 502.
  - Pengingat terkirim sekali dengan foto, dan bisa ditandai selesai serta ditunda dari Telegram. Titipan yang selesai atau dijadwal ulang sebelum terkirim dilewati, begitu juga yang terlambat lebih dari 6 jam.
  - Jam tenang menahan pengingat sampai 06.00 tanpa dihitung gagal.
  - Coba ulang dengan jeda 1 menit, menghormati `retry_after`, dan berhenti setelah 5 kali.
  - Bot diblokir: sambungan diputus otomatis.
  - Dua proses pengingat bersamaan hanya mengirim sekali.
  - Rutinitas harian maju ke jadwal berikutnya.
  - `/stop` dan Putuskan menghentikan pengingat yang menunggu.
  - `/cari` hanya mencari titipan sendiri.
  - Polling tidak dobel dengan webhook.
  - Pengurai waktu server sama dengan `iqlima.mjs`.
  - Upgrade database 1→2 berisi data.
- Uji browser (Chrome 153 headless, 390 dan 320 px, server asli + Telegram tiruan): 17 pemeriksaan lulus di tiap ukuran.
  - Profil meminta masuk Google dulu, lalu menampilkan Hubungkan Telegram dan membuat tautan t.me.
  - Setelah `/start`, status berubah sendiri menjadi tersambung.
  - Foto nota dengan caption "nota jahit jam 4 sore" ditawari jadwal 16.00, lalu dikonfirmasi lewat tombol.
  - Koleksi menampilkan "📎 1 lampiran · dari Telegram", dan foto terbuka di detail lewat `/v1/media`.
  - `file_id` tidak ada di halaman maupun localStorage.
  - Jam tenang dari Profil tersimpan, dan pengingat 16.00 terkirim sebagai foto dengan tombol selesai dan tunda.
  - Putuskan berhasil, tanpa error JavaScript.
- Regresi web: 36 tes Node, audit 12 ukuran layar, uji fitur Iqlima 25, dan uji web 22. Semua lulus.

**Risiko tersisa:**
- Belum dicoba dengan Bot API sungguhan: format balasan Telegram, batas laju, dan unduhan file di jaringan nyata.
- Video dan dokumen besar belum diuji di HP.
- Pengurai waktu memakai jam lokal proses Node. Jalankan server dengan `TZ=UTC` (bawaan image Docker) agar tidak ada lompatan musim panas.
- Satu lampiran pertama ikut di pengingat; lampiran lain lewat tombol "Semua lampiran".

## Pasang bot dari Profil, perintah baru, dan panduan Telegram (28 Nov 2026, malam)

**Lulus dengan data uji, belum diterima Iqlima.** Bot Telegram masih tiruan.

- `cd server && npm test`: 42 lulus, 0 gagal. Yang baru:
  - Token dengan bentuk salah ditolak (`bad_token`), dan token yang ditolak Telegram dijelaskan (`token_rejected`).
  - Lewat cookie tanpa `X-Mimi` dijawab 403.
  - Token tidak ada di respons.
  - Deskripsi pendek, deskripsi, dan menu dipasang otomatis.
  - Akun lain tidak bisa mengganti atau melepas bot (`not_bot_owner`).
  - Ganti ke bot lain menghapus sambungan.
  - Bot dari Profil tetap aktif setelah server dinyalakan ulang, dan lepas bot memanggil `deleteWebhook` serta mengosongkan `settings`.
  - Dengan `PUBLIC_URL` https, webhook terpasang dengan secret acak 32 karakter, dan tebakan secret dijawab 404.
  - Bot dari environment tidak bisa diganti dari Profil (`managed_by_server`).
  - `/id` jalan sebelum dan sesudah tersambung.
  - `/hariini` hanya merangkum agenda pemilik, dan `/besok` kosong dijawab ramah.
  - Upgrade database 1→3.
- Uji browser pasang bot (Chrome 153 headless, 390 dan 320 px, `FAKE_TELEGRAM=profil`): 17 pemeriksaan lulus di tiap ukuran.
  - Form token tampil sebagai kata sandi, dan tombol Lihat bisa menampilkannya.
  - Pesan untuk token kurang lengkap dan token ditolak tampil dengan jelas.
  - Setelah pasang, muncul "Bot Mimi: @…" dan tombol Hubungkan Telegram.
  - Token tidak ada di halaman maupun respons.
  - Ganti token dan Lepas bot berjalan.
  - Akun kedua langsung bisa Hubungkan, tetapi tidak bisa mengganti bot.
  - Tanpa error JavaScript.
- Uji ujung ke ujung Telegram sebelumnya diulang: 17 lulus.
- Halaman `/panduan-telegram` (390 dan 320 px):
  - Tanpa gulir samping, 11 langkah, dan semua gambar termuat.
  - Centang langkah tersimpan setelah muat ulang, dan kartu selamat muncul saat 11 dari 11 selesai.
  - `/#profil` membuka Profil, dan Profil menautkan ke panduan.
  - Satu catatan: tautan "langkah 8" di tengah kalimat tingginya 20 px (tautan sebaris).

**Risiko tersisa:**
- Teks balasan BotFather di panduan berupa terjemahan bebas; tampilan asli Telegram belum dicocokkan di HP.
- Token dari Profil disimpan apa adanya di database dan ikut ke backup.
- Pindah ke bot lain bisa membuat lampiran lama tidak terbuka dari web, karena `file_id` terikat ke bot penerimanya (belum diuji).

## Surat, rencana berdua, foto undangan, dikte, pengelola sandi (28 November, malam)

- Server: 50 tes lulus. Termasuk 8 tes baru di `partner.test.ts`:
  - Kode sekali pakai, kode sendiri, dan sudah berpasangan.
  - Surat hanya untuk pasangan, dibaca hanya oleh penerima, dan sembunyi per sisi.
  - Batas 50 surat sehari.
  - Rencana last-write-wins antar dua HP.
  - Orang ketiga tidak bisa membaca atau mengubah.
  - Putus lalu sambung lagi mengembalikan data.
  - Upgrade database 1→4.
- Web unit: 41 lulus, termasuk `iqlima-plus.test.mjs`:
  - Baca undangan dari teks OCR berantakan.
  - Tautan surat dan rencana bolak-balik, dengan tautan rusak ditolak.
  - Deteksi kata sandi.
- Uji browser `partner-e2e` (Chrome headless, 390 dan 320 px): 49 pemeriksaan lulus di tiap ukuran.
  - Dua akun fiktif tersambung lewat kode XXXX-XXXX. Kode sendiri ditolak, dan huruf kecil serta spasi diterima.
  - Surat dari Jundy muncul di Hari Ini Iqlima dengan stiker, lalu berhenti berstatus baru setelah dibaca.
  - Rencana dari Iqlima muncul di Agenda Jundy. Centang selesai dari Jundy terlihat di HP Iqlima, dan Ke agendaku membawa jam serta tempat.
  - Agenda pribadi Iqlima tidak sampai ke akun Jundy, baik di browser maupun lewat `/v1/items?q=`.
  - Putuskan butuh dua ketukan.
  - Tanpa akun: surat dan ajakan menjadi tautan WhatsApp. Penerima langsung melihat surat atau ajakan, hash dibersihkan, ajakan masuk agenda, dan tautan rusak diabaikan.
  - Foto undangan buatan sendiri dibaca tesseract lokal (bahasa Indonesia) dalam beberapa detik. Hasilnya: jenis agenda, judul "Pernikahan Rina & Bagas", 12 Desember 2026 10.00, dan tempat Gedung Serbaguna Melati.
  - Dikte (SpeechRecognition palsu) menambah di akhir catatan. Di Tumpahkan pikiran, tiap jeda menjadi satu baris, sehingga terbaca 2 titipan. Tanpa dukungan, tombol mikrofon tersembunyi.
  - Detail agenda punya tautan Google Maps. Kartu akun menampilkan "Buka Google Password Manager". Peringatan kata sandi muncul lalu hilang.
  - Tanpa error JavaScript.
- Regresi diulang:
  - `telegram-e2e` 17/17.
  - `botsetup-e2e` 17/17.
  - `sync-e2e` 16/16.
  - Audit ukuran 12 viewport plus layar lipat tanpa temuan. Input file tersembunyi dikecualikan karena area ketuknya adalah label 44 px.

**Risiko tersisa:**
- OCR baru diuji pada gambar rapi; undangan asli bisa salah baca, jadi form selalu meminta Iqlima mengecek sebelum simpan.
- Dikte belum diuji di HP nyata, dan Safari iOS belum dicoba sama sekali.
- Isi surat lewat tautan WhatsApp terbaca oleh siapa pun yang memegang tautannya.

## Notifikasi walau web ditutup dan aplikasi Flutter menyusul web (28 November, malam)

- Server: 60 tes lulus. Termasuk 10 tes baru di `push.test.ts`:
  - Langganan push hanya untuk layanan push resmi. http, IP, domain tiruan, port lain, dan kunci salah ditolak. Browser yang sama berpindah pemilik tanpa ganda.
  - Pengingat agenda hanya ke perangkat pemiliknya, sekali per kejadian, juga saat dua putaran berjalan bersamaan.
  - Jadwal berubah atau sudah selesai sebelum kirim: dilewati.
  - Jam tenang: agenda ditunda sampai 06.00, jaga diri dilewati.
  - Jaga diri mengikuti pilihan, jendela 45 menit, sekali sehari. Jadwalnya sama persis dengan web.
  - Layanan push gagal: 503 dicoba lagi bertahap, 410/404 menghapus perangkat, berhenti setelah 5 kali.
  - Tombol notifikasi: selesai (rutinitas membuat jadwal berikutnya) dan tunda lewat token. Token palsu, kedaluwarsa, atau kejadian lama ditolak. Tanpa `X-Mimi` ditolak.
  - Kunci VAPID tetap sama setelah server dinyalakan ulang. Pesan benar-benar terenkripsi (aes128gcm).
  - Kode sambung HP: sekali pakai walau ditukar bersamaan, kedaluwarsa 10 menit, kode baru membatalkan yang lama, tebakan beruntun dibatasi, token baru hanya melihat data pemiliknya.
  - Upgrade database 1→5.
- Web unit: 44 lulus. Termasuk service worker (push tampil dengan tombol, tidak dobel saat web dilihat, tombol mengirim token) dan berkas acuan Flutter yang harus selalu sama dengan logika web.
- Uji browser `push-e2e` (Chrome headless, layanan push palsu, 390 dan 320 px): 25 pemeriksaan lulus di tiap ukuran.
  - Aktifkan dari Profil, server mencatat perangkat dan pilihan jaga diri, ubah jaga diri ikut terkirim, dan tes sampai.
  - Agenda yang dibuat di web terkirim lewat push dengan tag yang sama dengan notifikasi halaman, tidak terkirim ulang.
  - Service worker menampilkan push tes. Saat web sedang dilihat (fokus), push agenda tidak menggandakan. Saat pindah tab, notifikasi agenda tampil dengan tombol Selesai dan Tunda.
  - Tombol Selesai dari konteks service worker menandai agenda selesai, dan web ikut berubah setelah sinkron.
  - Akun kedua tidak menerima pengingat akun pertama.
  - Sambungkan aplikasi HP: Profil menampilkan alamat server dan kode, kode ditukar jadi sesi, dan tidak bisa dipakai dua kali.
  - Keluar mencabut langganan di browser dan di server.
  - Tanpa error JavaScript.
- Regresi diulang:
  - `partner-e2e` 49.
  - `telegram-e2e` 17.
  - `botsetup-e2e` 17.
  - `sync-e2e` 16.
  - `iqlima` 25.
  - `web` 22.
  - Audit ukuran layar tanpa temuan.
- Flutter: **belum dikompilasi di sini.** SDK Flutter tidak bisa diunduh di lingkungan ini (storage.googleapis.com dan unduhan GitHub diblokir).
  - Tes baru sudah ditulis: `iqlima_test.dart` (paritas dengan web lewat berkas acuan), `server_test.dart` (pemetaan titipan, sinkron dua arah, offline, sesi habis, dua HP bersamaan dengan server palsu), dan `teman_test.dart` (tumpahkan pikiran, detail dengan peta, lampiran, minta tolong, Profil, ulang tahun, kartu jaga diri).
  - Semuanya pertama kali dijalankan oleh GitHub Actions (`.github/workflows/ci.yml`).

**Risiko tersisa:**
- Push sungguhan ke Google/Mozilla/Apple belum dicoba dari server online; uji memakai layanan palsu dan enkripsi lokal.
- iPhone butuh Ruang Iqlima di Layar Utama untuk Web Push.
- Kode Dart, Kotlin, dan Swift yang baru bisa gagal kompilasi sampai Actions hijau.
- Flutter belum punya surat dan rencana berdua, baca undangan dari foto, dikte, dan pengelola sandi.
