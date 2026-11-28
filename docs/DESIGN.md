# Acuan tampilan dan bahasa

| Acuan asli | Detail yang harus terbaca pada implementasi |
|---|---|
| [Web](referensi/web.webp) | Referensi awal untuk sapaan, agenda dan koleksi. Beranda terkini menggunakan kartu taman serta tiga pintasan. |
| [Android, iPhone, dan Telegram](referensi/ponsel.webp) | Mimi mengintip di atas agenda, tombol “Titip sesuatu” mudah dijangkau. Koleksi memakai pencarian dan kartu visual. Pengingat membawa lampiran. |
| [Karakter Mimi](referensi/mimi.webp) | Kucing krem, pita stroberi, tanda hati dekat mata. Pose membawa amplop untuk pesan dan tidur saat jam tenang. |

Pada kedua ponsel gunakan urutan **Hari Ini, Koleksi, Agenda, Profil**. Gambar ponsel menampilkan contoh halaman berbeda. Prioritaskan ruang baca, ukuran teks perangkat dan fokus keyboard ketika detail dekoratif perlu disesuaikan.

Gunakan latar blush (#FFF4F7), kertas krem (#FFFBF5), tombol rose (#AA3865), teks plum (#422738). Pertahankan garis jahitan, pita, dan tekstur kertas secukupnya. Tombol tindakan harus tetap terlihat ketika ilustrasi sedang dimuat.

| Situasi | Tulisan |
|---|---|
| Menambahkan sesuatu | Titip sesuatu |
| Mencari di koleksi | Cari titipan |
| Simpan berhasil | Udah Mimi simpan di Koleksi ♡ |
| Simpan gagal | Titipannya belum tersimpan. Coba lagi, ya. |
| Pengingat tiba | Waktunya ambil jahitan, Iqlima ♡ |
| Pilihan pengingat | Selesai · Ingatkan nanti |

Mimi menemani lewat pose dan respons singkat. Hindari sapaan yang membuat Iqlima merasa bersalah karena sibuk. Mintalah Iqlima mencoba satu tugas tanpa petunjuk lalu tanyakan bagian yang membingungkan. Simpan umpan balik dengan format layar, tindakan, apa yang terjadi, dan perubahan yang diinginkan.

Untuk layar dan keadaan baru, gunakan [koleksi Mimi v1](../assets/mimi/v1/README.md) beserta pemetaan pose yang sudah disiapkan.

## Sistem desain v1.2 · Jurnal Mimi

[Contoh komponen interaktif](https://ruang-iqlima-mimi.oakrose8.chatgpt.site/panduan-desain/) memperlihatkan palet dan form titipan. Gunakan [token bersama](../design/tokens.json) sebagai sumber nilai warna, ukuran dan bentuk. Astro mengubah file ini menjadi variabel CSS melalui MimiTheme. Untuk warna baru, tentukan perannya dan cek pasangan teksnya sebelum menambah token.

### Hierarki dan tata letak

| Elemen | Aturan Titip Mimi |
|---|---|
| Sapaan dan judul | Serif mengikuti web. Pada ponsel hingga 600 px, sapaan dan judul halaman memakai 18 px pada ukuran teks bawaan. Judul bagian web memakai 16 px. Hati mengikuti nama Iqlima ketika teks membungkus. Pada layar lebih lebar, judul dapat membesar mengikuti ruang. |
| Isi, form dan aksi | Sans sistem, isi 16, label 14. Izinkan teks membesar dan membungkus. |
| Jarak | Satuan 4, 8, 12, 16, 24, 32. Gunakan 8 untuk elemen terkait, 16 untuk tepi HP, 24 untuk kelompok. |
| Bentuk | Kolom masukan radius 12, kartu 24, aksi utama berbentuk pil. Garis jahitan dan tekstur kertas untuk panel dekoratif. |
| Navigasi | Web menggunakan kapsul bawah hingga 600 px, menu atas pada 601–959 px, dan navigasi kiri mulai 960 px. Pada ponsel pertahankan label keempat tujuan dan ruang aman bawah. |
| Gerakan | Respons sentuh singkat dan lembut. Hormati preferensi kurangi gerakan. Suara dan animasi tambahan mengikuti pilihan pengguna. |

### Pemetaan komponen web dan Flutter

| Maksud pengguna | Web | Flutter dengan ThemeData(useMaterial3: true) |
|---|---|---|
| Menitipkan atau menyimpan | Satu tombol utama rose pada area tugas; tulisan memakai on-primary | FilledButton, primary / onPrimary |
| Membatalkan atau mengulang | Tombol tonal; label berupa kata kerja | FilledButton.tonal dengan warna container yang sama |
| Mencari atau menulis | Label terlihat, kolom dengan garis outline, nilai dipertahankan saat gagal | TextFormField dan InputDecorationTheme |
| Membuka titipan | Kartu berjudul dengan pratinjau; seluruh kartu menjadi satu sasaran | Card dan InkWell dengan semantics yang sesuai |
| Berpindah halaman | Nav aktif memiliki penanda visual dan aria-current | NavigationBar atau NavigationRail dengan selectedIndex |
| Mengonfirmasi hasil | Status singkat yang bisa diumumkan pembaca layar; tindakan lanjutan dekat pesan | SnackBar untuk konfirmasi singkat, errorText untuk koreksi input |
| Mengisi titipan | Dialog dengan judul, batal, simpan; fokus kembali ke pemicu | Dialog atau modal bottom sheet dengan SafeArea |

Lokasi status selalu dekat dengan tindakan terkait. Untuk alur simpan, bedakan kondisi awal, fokus, sedang menyimpan, berhasil, gagal dan nonaktif. Saat operasi asinkron berjalan, cegah kirim ulang dan tampilkan “Menyimpan…”. Setelah konfirmasi tampilkan Mimi saved; jika gagal gunakan retry dan pertahankan isian. Status penting selalu memiliki teks. Sasaran sentuh utama minimal 48 × 48 unit logis. Target kontras teks biasa 4,5:1 atau lebih.

### Pemeriksaan sebelum menerima layar baru

1. Bandingkan pada lebar 390 dan 1440 serta teks diperbesar. Pastikan konten, CTA dan navigasi terbaca.
2. Telusuri dengan keyboard atau pembaca layar. Periksa urutan fokus, nama aksi, status terpilih dan pengumuman hasil.
3. Periksa peran warna, bentuk, pose Mimi v1, kalimat sukses/gagal dan perubahan status. Uji kembali simpan-cari dengan data lokal lama.
4. Catat perbedaan yang disengaja antara Android, iOS dan web di handoff. Perubahan identitas dan navigasi mengikuti catatan keputusan.

Rujukan: [Peran warna Material 3](https://m3.material.io/styles/color/roles), [tema Flutter](https://docs.flutter.dev/cookbook/design/themes), [kontras teks](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

### Tema dan gerakan v1.1

Profil web, aplikasi Flutter, dan panduan komponen menyediakan satu sakelar Mode gelap. Tema awal terang. Simpan pilihan di perangkat. Gunakan warna dari color dan darkColor dengan nama peran yang sama. Aset Mimi mempertahankan warna ilustrasi.

Gunakan tombol filled untuk komitmen utama, tonal untuk aksi pendamping dan teks untuk navigasi ringan. Tampilkan outline saat fokus keyboard, lapisan warna saat hover/tekan, dan status disabled melalui atribut native. Efek tekan berlangsung 120 ms, masuk panel atau dialog 180 ms. Hormati pengaturan kurangi gerakan dengan tampilan langsung. Animasi maskot dan umpan balik untuk operasi jaringan tetap bergantung pada implementasi fitur masing-masing.

Di Koleksi, tombol Simpan dan Titip sesuatu memakai warna utama. Batal dan Tutup memakai tombol teks. Filter Semua, Catatan, Akun, dan Agenda memakai chip dengan status pilihan. Kartu akun menampilkan nama layanan dan email atau label agar dua akun dari layanan yang sama bisa dibedakan. Form akun hanya menerima petunjuk masuk.

Di beranda web, layar hingga 600 px menempatkan menu di bawah dan Mimi di samping sapaan. Pada 601–959 px, menu pindah ke atas dan agenda berdampingan dengan koleksi. Mulai 960 px, gunakan navigasi kiri. Pada Flutter, navigasi bawah berganti menjadi NavigationRail mulai 720 piksel logis. Batasi lebar formulir hingga 600 piksel logis. Gerak singkat menandai perpindahan halaman, interaksi kartu, atau kedatangan pengingat. Hormati preferensi pengurangan gerak perangkat.

Koleksi menggunakan daftar satu kolom pada web ponsel. Tampilkan judul dan hingga dua baris isi agar pengguna bisa membedakan titipan. Pada layar lebar, susun kartu sesuai ruang yang tersedia. Jika hasil kosong, tampilkan pose pencarian Mimi. Atur ulang mengosongkan kata pencarian dan memilih Semua. Detail pada web ponsel terbuka dari bawah dan mengikuti pilihan kurangi gerak.

Beranda web memakai sapaan Mimi dan tiga pintasan bergambar untuk membuka formulir catatan, agenda, atau akun. Progres harian dihitung dari agenda yang dijadwalkan hari ini.

### Penerapan per layar

Gunakan kertas petak sebagai latar halaman. Letakkan teks panjang dan kolom masukan di panel kertas agar garis petak tidak bersaing dengan isi. Kartu taman menjadi penanda beranda. Halaman tugas memakai kepala halaman yang lebih pendek agar konten utamanya segera terlihat.

| Permukaan | Pose dan aksen | Tindakan utama |
|---|---|---|
| Hari Ini | Mimi menyapa, kartu taman di web, tiga pintasan berstiker | Titip sesuatu |
| Koleksi | Mimi membawa surat, panel rose | Cari, filter, buka titipan |
| Agenda | Mimi membawa planner, panel mint | Tambah agenda, tandai selesai |
| Profil | Mimi menyapa, panel lilac | Ubah mode gelap, periksa koneksi |
| Form dan detail | Rose untuk catatan, mint untuk agenda, lilac untuk akun. Web memakai pita warna, Flutter memakai ilustrasi jenis titipan | Baca judul, ubah isian, simpan atau batal |
| Konfirmasi | Dialog ringkas berisi konsekuensi dan nama tindakan. Pada Flutter gunakan pose privasi untuk konfirmasi akun | Pilih batal atau konfirmasi |
| Pengingat dan hasil kosong | Gunakan pose pengingat atau pencarian dengan pesan singkat | Buka, tunda, selesaikan, atau atur ulang |

Pasangan warna terang dan gelap berada di token **journal-rose**, **journal-mint** dan **journal-lilac**. Label dan bentuk komponen tetap menyampaikan makna saat warna sulit dibedakan. Pertahankan kartu isi yang tenang dan tempatkan stiker di dekat judul atau aksi terkait.

Lembar To-Do List di Hari Ini memakai pita Mimi dan daftar per tanggal. Tugasku langsung terbuka dengan satu kolom tambah. Target, Rawat diri, Catatan dan Pengingat dapat dibuka sesuai kebutuhan. Di web, ringkasan menampilkan jumlah centang atau tanda Terisi. Di layar sempit bagian disusun vertikal. Pengingat di lembar ini adalah pesan tertulis, sedangkan agenda menangani jadwal dengan jam.

Di Kamar Mimi, model anak kucing krem memakai pita merah muda di telinga, pipi merah muda dan mata cokelat berkilau sesuai maskot. Kamar memiliki karpet, jendela dan rak pastel. Aktivitas dapat dimainkan dengan sentuhan atau tombol. Hati disimpan di browser perangkat ini.

Saat bermain, Iqlima memegang benang dan Mimi bergerak sendiri. Arah lompatan terkunci saat lepas landas agar pemain dapat mengelak. Posisi gelembung menentukan usapan yang berhasil. Setelah tiga suapan Mimi kenyang selama setengah jam.

Gerak Mimi mengikuti berat tubuh. Mata dan kepala mengikuti benang, telapak depan terangkat ketika meraih, lalu kaki menekuk ketika mendarat. Pita pink tetap menjadi ciri utamanya.

Model bermain memakai tanda hati di mata kiri dan pita stroberi di kanan dari sudut pandang pemain, serta iris plum mengikuti paket maskot v1. Langkah dan ayunan ekor bertransisi bertahap antara diam dan berlari.

Teras mawar memakai latar ilustrasi fantasi orisinal, model Mimi bergerak di atasnya, serta tekstur wajah dari pose welcome v1. Kelopak dekoratif berhenti saat pemain mengaktifkan pengurangan gerakan.

Pada tampilan utama, Mimi menggunakan ilustrasi karakter fantasi transparan dari acuan welcome. Animasi 2.5D membengkokkan tubuh mengikuti arah pandang, langkah, lompatan dan pendaratan. Model prosedural ditampilkan selama ilustrasi dimuat.

Mimi memakai enam pose yang dihubungkan dengan mekanik bermain. Saat santai ia merawat bulu dan mengedip, saat diterkam benang berada di antara kedua kaki depan. Usapan kepala saat santai memicu pose mata tertutup.

Di browser WebGL, karakter utama kembali memakai tubuh 3D dengan gerak mata dan kaki depan terpisah. Perangkat tanpa WebGL memakai pose ilustrasi utuh agar sambungan segitiga tidak tampak. Usapan, cilukba, dan tos tersedia langsung dari teras.

Pintasan Main sama Mimi di Hari Ini berupa satu tautan kartu dengan maskot menyapa, label singkat, dan panah. Seluruh kartu bisa diketuk atau dibuka lewat keyboard.

Di web, Atur pengingat dan Selesai berbagi satu panel Agenda. Gunakan tinggi minimum 48 piksel, tepi kiri yang sama, ikon lonceng atau centang di kiri, serta panah buka-tutup di kanan. Isi tampil ketika baris dibuka. Animasi panah mengikuti preferensi gerakan perangkat.

### Jurnal Mimi v1.3

Gunakan kertas krem hangat, teks plum, tombol utama rose, dan aksen mint untuk Agenda serta lilac untuk akun dan Profil. Palet di `design/tokens.json` dipakai juga oleh Kamar Mimi. Sakelar di Profil menentukan kedua tampilan. Pertahankan ilustrasi dan pita Mimi yang sudah dikenali Iqlima.

Pada desktop, letakkan To-Do List di samping ringkasan Agenda, Kamar Mimi, dan Koleksi. Pada ponsel, susun kartu satu kolom dengan lebar yang sama. Judul halaman utama berukuran 18 piksel di ponsel. Pengingat memuat judul agenda dan tiga tindakan dalam panel ringkas. Formulir ponsel terbuka dari bawah dengan tombol Simpan di akhir. Kamar Mimi menampilkan pilihan kegiatan sebelum instruksi dan tindakan utamanya.

### Mimi manja v1.4

Mimi nempel dan sayang, tapi tidak menuntut. Ia senang ditemani, memuji usaha kecil, dan menyambut gembira kapan pun Iqlima kembali. Hindari kalimat yang menyalahkan, misalnya “kok lama”, “ke mana aja”, “ditinggal”, atau “kecewa”. Tes otomatis memeriksa daftar kata ini.

| Saat | Pose | Contoh suara |
|---|---|---|
| Pagi 04.00–10.59 | welcome | Selamat pagi, Iqlima ♡ · Sarapan dulu, ya. Titipanmu aman sama Mimi. |
| Siang 11.00–14.59 | peek | Siang, Iqlima ♡ · Jangan lupa makan siang, ya. |
| Sore 15.00–17.59 | planner | Sore, Iqlima ♡ · Sini duduk bentar sama Mimi. |
| Malam 18.00–21.59 | letter | Malam, Iqlima ♡ · Hari ini kamu udah hebat. |
| Larut 22.00–03.59 | sleep | Udah larut, Iqlima ♡ · Mimi temenin, tapi istirahat juga, ya. |
| Kembali setelah 2 hari atau lebih | celebrate | Yeay, kamu mampir lagi. Mimi seneng banget ♡ |

Kalimat sapaan tetap sepanjang hari yang sama agar tidak berganti tiap muat ulang. Web dan Flutter memakai urutan kalimat yang sama.

**Reaksi.** Setelah aksi berhasil, gelembung kecil berisi pose dan satu kalimat muncul di bawah selama sekitar 3,6 detik: titip catatan (saved), akun (privacy), agenda (planner), tandai selesai (done), semua agenda hari ini selesai (celebrate), tunda (snooze), catat ganti sandi (privacy), centang To-Do (done), kartu dari extension (linked). Gelembung tidak menangkap ketukan dan tidak menggantikan teks status. Pada ponsel web gelembung berada di atas kapsul menu. Animasi muncul mengikuti preferensi kurangi gerakan.

**Elus Mimi.** Ilustrasi Mimi di kartu Hari Ini adalah tombol “Elus Mimi”. Ketukan memunculkan hati kecil, Mimi bergoyang, dan kalimat sayang. Pembaca layar mendapat kalimat yang sama lewat status tersembunyi.

**Sakelar.** Profil memiliki sakelar Mimi manja, nyala secara bawaan. Saat dimatikan, sapaan kembali “Hai, Iqlima ♡”, gelembung berhenti, dan kabar simpan serta pengingat tetap tampil seperti biasa.

**Extension “Titip ke Mimi”.** Popup selebar 340 px dengan pose privacy, palet token v1.3, mengikuti mode gelap sistem. Urutan isian: Nama layanan, Email atau label akun, Cara masuk, lalu tombol utama Titip ke Mimi. Antrean tampil sebagai kartu rose dengan tombol batal per kartu dan tombol tonal Buka Titip Mimi. Teks selalu mengingatkan bahwa kata sandi tetap di pengelola sandi.

### Kamar Mimi v2 · 3D anime cel-shaded

Atas permintaan Jundy, Kamar Mimi memakai gaya 3D anime cel-shaded seperti game petualangan anime modern. Semua model, tekstur, dan efek dibuat sendiri untuk Mimi; tidak ada karakter, aset, logo, atau antarmuka dari game lain.

| Unsur | Aturan |
|---|---|
| Mimi | Model 3D prosedural: kepala besar, pipi berbulu, telinga dengan bagian dalam merah muda, dada putih, kaki berbantalan, ekor meruncing dengan ujung mengembang. Shading toon tiga tingkat, outline plum tipis, rim light hangat dari kiri. |
| Wajah | Digambar di kanvas: mata anime besar beriris plum dengan dua kilau dan bintang kecil, tanda hati di mata kiri dan pita stroberi di telinga kanan dari sudut pandang pemain, pipi merah muda bergaris, mulut “ω”. Saat dielus, cilukba, tos, atau memeluk benang, mata menjadi lengkung bahagia. |
| Suasana | Lukisan teras sebagai latar yang sedikit diburamkan, bayangan lembut di lantai, kelopak 3D, kilau, berkas cahaya, bloom lembut, gradasi warna, dan vinyet. Kamera bergeser pelan mengikuti pointer. |
| Reaksi | Hati beterbangan saat dielus, menangkap benang, makan, tos, dan cilukba. |
| Aksesibilitas dan performa | Kurangi gerakan mematikan kelopak, kilau, hati, dan gerak kamera. Resolusi turun otomatis dan bloom dimatikan bila frame lambat. Tanpa WebGL2, halaman memakai mode ilustrasi yang sudah ada. |

Sumber ada di `src/game/mimi-scene3d.js` (Three.js). `npm run build:game` menghasilkan `public/mimi-scene.js` (sekitar 614 KB, 155 KB gzip). Jangan menyunting hasil bundel secara langsung.
