# Acuan tampilan dan bahasa

| Acuan asli | Detail yang harus terbaca pada implementasi |
|---|---|
| [Web](referensi/web.webp) | Navigasi kiri, sapaan dan Mimi memeluk agenda di tengah, agenda terdekat dan dua pratinjau koleksi di kanan. |
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

## Sistem desain v1 · Material 3 dengan identitas Titip Mimi

[Contoh komponen interaktif](https://ruang-iqlima-mimi.oakrose8.chatgpt.site/panduan-desain/) memperlihatkan palet dan form titipan. Gunakan [token bersama](../design/tokens.json) sebagai sumber nilai warna, ukuran dan bentuk. Astro mengubah file ini menjadi variabel CSS melalui MimiTheme. Untuk warna baru, tentukan perannya dan cek pasangan teksnya sebelum menambah token.

### Hierarki dan tata letak

| Elemen | Aturan Titip Mimi |
|---|---|
| Sapaan dan judul | Serif mengikuti web. Headline acuan 32, judul bagian 24. Sapaan beranda boleh membesar mengikuti ruang. |
| Isi, form dan aksi | Sans sistem, isi 16, label 14. Izinkan teks membesar dan membungkus. |
| Jarak | Satuan 4, 8, 12, 16, 24, 32. Gunakan 8 untuk elemen terkait, 16 untuk tepi HP, 24 untuk kelompok. |
| Bentuk | Kolom masukan radius 12, kartu 24, aksi utama berbentuk pil. Garis jahitan dan tekstur kertas untuk panel dekoratif. |
| Navigasi | Lebar hingga 720 CSS px memakai navigasi bawah. Di atasnya gunakan navigasi kiri. Pada ponsel pertahankan label keempat tujuan dan ruang aman bawah. |
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

Profil dan panduan komponen menyediakan Terang, Gelap, serta Ikuti perangkat (default). Simpan pilihan pada browser. Gunakan warna dari color dan darkColor dengan nama peran yang sama. Aset Mimi mempertahankan warna ilustrasi. Untuk Flutter kelak, padankan pilihan dengan ThemeMode.system, light dan dark.

Gunakan tombol filled untuk komitmen utama, tonal untuk aksi pendamping dan teks untuk navigasi ringan. Tampilkan outline saat fokus keyboard, lapisan warna saat hover/tekan, dan status disabled melalui atribut native. Efek tekan berlangsung 120 ms, masuk panel atau dialog 180 ms. Hormati pengaturan kurangi gerakan dengan tampilan langsung. Animasi maskot dan umpan balik untuk operasi jaringan tetap bergantung pada implementasi fitur masing-masing.

Di Koleksi, tombol Simpan dan Titip sesuatu memakai warna utama. Batal dan Tutup memakai tombol teks. Filter Semua, Catatan, Akun, dan Agenda memakai chip dengan status pilihan. Kartu akun menampilkan nama layanan dan email atau label agar dua akun dari layanan yang sama bisa dibedakan. Form akun hanya menerima petunjuk masuk.
