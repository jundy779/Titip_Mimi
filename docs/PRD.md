# Produk dan cakupan

**Titip Mimi** adalah nama produk; **Ruang Iqlima** adalah ruang pribadi pertamanya. Syarat pilot terhubung dirinci dalam [MVP](MVP.md). Alur web ditargetkan memakai Astro + TypeScript. Status fitur yang sudah berjalan ada di [roadmap](ROADMAP.md).

**Untuk siapa** • Iqlima sering menitipkan sesuatu di Telegram ketika sedang mengurus banyak hal. Ia membutuhkan satu tempat untuk mencari kembali foto, catatan akun, atau rencana dan memilih kapan ingin diingatkan.

**Skenario pengikat** • Iqlima meneruskan foto nota ke Mimi, mengonfirmasi “Jumat jam empat sore”, lalu menerima foto yang sama ketika waktunya mengambil jahitan. Di HP ataupun web ia bisa membuka titipan dan menandai selesai.

| Kebutuhan | Perilaku yang disepakati |
|---|---|
| Titip cepat | Simpan teks atau media walaupun belum punya jadwal. Pengingat hanya aktif setelah waktunya jelas dan dikonfirmasi. |
| Koleksi | Cari judul, isi catatan, atau caption. Buka lampiran dari hasil pencarian maupun agenda. Dukung foto, video, dan dokumen. |
| Akun digital | Simpan nama layanan, email/label akun dan cara masuk. Izinkan beberapa akun pada layanan yang sama. Kata sandi, PIN dan kode pemulihan disimpan di pengelola kata sandi terpisah. |
| Agenda | Rencana tanpa tanggal tetap dapat disimpan. Agenda terjadwal mendukung selesai dan, pada versi terhubung, tunda pengingat. Jam tenang bisa dipilih Iqlima. |
| Identitas | Masuk dengan Google. Telegram ditautkan secara opsional dari Profil. Agenda dasar tetap bisa dipakai sebelum Telegram ditautkan. |
| Kalender eksternal | Pertahankan impor file dan pengiriman manual. Koneksi langsung dan sinkronisasi otomatis membutuhkan tahap integrasi tersendiri. |
| Perangkat | Web, Android, dan iOS memakai satu profil dalam versi terhubung. Pilot pribadi mendahului keputusan rilis publik di Google Play. |
| Extension browser | Dari halaman daftar/masuk di Chrome atau Edge, titip petunjuk akun ke Mimi tanpa kata sandi. Kartu masuk Koleksi saat web dibuka di browser yang sama. |
| Teman harian | Tumpahkan pikiran, cek sebelum keluar, rutinitas berulang, minta tolong Jundy lewat WhatsApp, ruang lega pribadi, dinding bangga, pengingat jaga diri, musim Leo dan ulang tahun. |
| Surat dan rencana berdua | Jundy dan Iqlima tersambung lewat kode sekali pakai (24 jam) dari Profil. Surat muncul di kartu "Surat untukmu" di Hari Ini, rencana berdua di Agenda dan bisa dimasukkan ke agenda pribadi dengan satu ketukan. Tanpa akun, surat dan ajakan dikirim sebagai tautan WhatsApp. |
| Bantu isi form | Baca undangan dari foto langsung di HP (judul, tanggal, jam, tempat), dikte suara di catatan dan Tumpahkan pikiran, tempat dengan tautan Google Maps, dan catatan di pengelola kata sandi mana sandinya disimpan beserta tombol membukanya. |
| Mimi manja | Mimi menyapa sesuai jam, ikut senang saat titip atau selesai, dan bisa dielus. Tidak pernah membuat Iqlima merasa bersalah. Bisa dimatikan. |

**Pribadi secara bawaan.** Iqlima memilih sendiri apa yang ia bagikan. Yang terbagi dengan pasangan hanya surat dan rencana berdua; keduanya bisa diputus kapan saja dari Profil. Akses pasangan ke seluruh koleksi tidak termasuk kesepakatan, dan server tidak menyediakan jalan ke sana.

**Batas yang disengaja** • Foto undangan dibaca di browser (tesseract.js, data bahasa Indonesia dimuat sekali dari CDN atau dari server sendiri), tidak dikirim ke server Mimi. Dikte memakai pengenal suara bawaan browser, sehingga di Chrome suara diproses layanan Google dan tombolnya tidak muncul di browser yang tidak mendukung. Mimi tidak pernah menyimpan kata sandi; integrasi pengelola kata sandi hanya mencatat tempatnya dan membuka halamannya.

**Backlog setelah pilot** • Stiker dan animasi tambahan, baca undangan berbentuk PDF, serta impor kartu akun dari ekspor pengelola kata sandi (tanpa sandinya). Pilih berdasarkan masalah yang benar-benar dialami Iqlima.
