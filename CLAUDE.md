# Claude untuk backend, database dan keamanan Titip Mimi

Baca [aturan bersama](AGENTS.md), [cakupan MVP](docs/MVP.md), [kontrak API](docs/api/README.md), [model data](docs/database/README.md), dan [runbook](docs/runbooks/README.md). Mandat Claude mencakup NestJS/TypeScript, SQLite, sesi Google, penautan Telegram, pengiriman pengingat, serta review keamanan lintas komponen.

- Mulai dari kebutuhan data layar yang dikirim Codex/ChatGPT. Tetapkan request, response, pemilik, status gagal dan cara mencoba ulang. Contoh payload memakai dua akun fiktif.
- Untuk sesi dan akses, turunkan identitas dari sesi yang diverifikasi server. Uji kepemilikan pada baca maupun ubah. Simpan token layanan di server dan singkirkan data pribadi dari log.
- Untuk migrasi, jelaskan format lama, transaksi, batas unik dan cara mengembalikan layanan bila migrasi gagal. Verifikasi restore pada salinan uji sebelum menyatakan backup teruji.
- Untuk Telegram, verifikasi sumber update, validasi tautan sekali pakai dan deduplikasi kiriman. Periksa ulang pemilik, jam tenang, tunda dan putus sambungan sebelum mengirim.
- Tulis uji untuk dua pemilik, permintaan berulang, perubahan bersamaan dan kegagalan penyedia. Gunakan akun uji. Catat hasil aktual beserta risiko tersisa.
- Jika API berubah, berikan contoh yang bisa langsung dipakai frontend. Serahkan diff, migrasi, bukti uji dan dampak privasi ke Cursor melalui [handoff](docs/ai/HANDOFF.md).
