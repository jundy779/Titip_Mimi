# Extension “Titip ke Mimi”

Extension Chrome dan Edge (Manifest V3) untuk menitipkan **petunjuk akun** ke Mimi langsung dari halaman daftar atau masuk. Isinya hanya nama layanan, email atau label akun, dan cara masuk. Mimi tidak pernah meminta, membaca, atau menyimpan kata sandi.

## Cara pakai

1. Buka halaman daftar atau masuk, misalnya Canva.
2. Klik ikon Mimi. Popup mengisi nama layanan dari alamat situs, email yang sudah diketik di halaman, dan menebak cara masuk.
3. Cek isiannya, lalu pilih **Titip ke Mimi**. Angka di ikon menunjukkan jumlah akun yang menunggu.
4. Buka Titip Mimi di browser yang sama. Mimi membawa kartunya ke **Koleksi → Akun** dengan riwayat “Dititip dari browser”.

## Pasang untuk uji

1. Buka `chrome://extensions` (atau `edge://extensions`), aktifkan **Developer mode**.
2. Pilih **Load unpacked**, lalu arahkan ke folder `extension/` ini.
3. Untuk mencoba dengan web lokal, jalankan `npm run dev -- --port 4321` atau `npm run preview -- --port 4321` dari root repo.

## Privasi dan batas

- Halaman dibaca **hanya saat popup dibuka** lewat izin `activeTab`. Kolom bertipe sandi tidak pernah dibaca.
- Kalau isian email/label terlihat seperti kata sandi (angka + simbol, tanpa @ atau spasi), Mimi memberi peringatan dulu.
- Antrean tersimpan di `chrome.storage.local` di perangkat ini dan dihapus per kartu setelah halaman Titip Mimi mengonfirmasi simpan. Kartu bisa dibatalkan dari popup.
- Alamat `localhost:4321` dan `127.0.0.1:4321` di `manifest.json` hanya untuk uji. Hapus keduanya sebelum dipasang permanen atau dipublikasikan, supaya antrean tidak dikirim ke server lokal lain.
- Skrip pengantar hanya berjalan di alamat Titip Mimi yang tercantum di `manifest.json` (`content_scripts.matches`). Kalau web pindah domain, ubah daftar itu dan `mimiUrl` di `lib.js`.
- Web Titip Mimi saat ini menyimpan titipan di browser, jadi kartu hanya muncul di browser tempat extension terpasang. Sinkron ke HP menunggu backend tahap 1.
- Belum diuji di Firefox dan Safari. Publikasi ke Chrome Web Store membutuhkan keputusan Jundy.
