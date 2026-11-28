# Model data (migrasi 2)

SQLite dengan WAL, foreign key aktif, dan `busy_timeout` 5 detik. Migrasi berurutan di `server/src/db.ts`, masing-masing dalam transaksi, versinya di `schema_version`.

| Tabel | Isi dan aturan |
|---|---|
| users | `id` UUID, `google_sub` unik, email, nama, zona waktu (bawaan Asia/Jakarta), waktu dibuat. Migrasi 2: `quiet_start`, `quiet_end` (menit, bawaan 1320 dan 360, `NULL` berarti jam tenang mati) |
| sessions | `token_hash` (SHA-256, kunci utama), `user_id` → users, dibuat, kedaluwarsa. Sesi lama dibersihkan saat sesi baru dibuat. |
| items | Kunci `(owner_id, client_id)`. `kind` note/account/agenda, `search` (teks kecil untuk pencarian, termasuk nama file lampiran), `data` (JSON titipan yang sudah divalidasi), `deleted` (tombstone), `updated_at`, `seq` |
| counters | `seq` global yang naik setiap penulisan; dipakai sebagai cursor sinkron |
| telegram_links | Satu pemilik ↔ satu akun Telegram. Kunci `owner_id`, `tg_user_id` unik, `chat_id`, username, waktu tersambung |
| telegram_link_codes | `code_hash` (SHA-256 kode `/start`), pemilik, kedaluwarsa, `used_at`. Kode mentah tidak pernah disimpan. |
| telegram_updates | `update_id` yang sudah diproses (deduplikasi). Dibersihkan setelah 7 hari. |
| telegram_files | Kunci `(owner_id, unique_id)`, `file_id` Telegram, jenis, mime, nama, ukuran. Satu-satunya sumber untuk proksi `/v1/media`. |
| telegram_threads | Kunci `(owner_id, key)`: `msg:<id pesan Mimi>` → titipan (untuk balasan waktu) dan `group:<media_group_id>` → titipan (album) |
| reminder_deliveries | Kunci `(owner_id, client_id, occurrence)`; `occurrence` = `"<time>\|<snoozeUntil atau 0>"`. Status `pending`, `sending`, `sent`, `retry`, `failed`, `skipped`, jumlah percobaan, `next_try`, `lease_until`, id pesan terkirim, kode error terakhir |

Satu perubahan sinkron diproses dalam satu transaksi. Tombstone dipertahankan agar perangkat lain tahu titipan sudah dihapus.

**Dari localStorage.** Web memberi setiap titipan `clientId` dan `updatedAt` (titipan lama diberi `updatedAt: 1` sehingga salinan server yang lebih baru menang). Contoh bawaan prototipe ditandai `demo: true` dan tidak dipindahkan. Pemindahan hanya berjalan setelah Iqlima menekan **Pindahkan titipan**, dan aman diulang karena `clientId` unik per pemilik.

**Migrasi 1 → 2.** Format lama: lima tabel di atas tanpa kolom jam tenang. Migrasi 2 hanya menambah dua kolom (`ALTER TABLE ... ADD COLUMN` dengan nilai bawaan) dan enam tabel baru dalam satu transaksi; tidak ada data lama yang diubah. Bila gagal di tengah, transaksi batal dan `schema_version` tetap 1. Server versi lama tetap bisa membuka database versi 2 (kolom dan tabel tambahan diabaikan), jadi rollback cukup menjalankan image lama dengan volume yang sama. Uji `database versi 1 berisi data naik ke versi 2 tanpa kehilangan apa pun` membuat database versi 1 berisi pengguna dan titipan, menaikkannya, lalu memeriksa isi, nilai bawaan, dan pembukaan ulang.

**Satu kali tepat.** Update Telegram dicatat di `telegram_updates` dalam transaksi yang sama dengan titipan yang dibuatnya, jadi pengiriman ulang dari Telegram tidak membuat dobel dan kegagalan di tengah membatalkan semuanya. Pengingat diklaim dengan `UPDATE ... RETURNING` atomik dengan sewa 2 menit, dan kunci `occurrence` mencegah satu kejadian terkirim dua kali.

**Backup.** `npm run backup -- <database> <folder>` membuat salinan konsisten lewat API backup SQLite, lalu membuka salinannya, menjalankan `integrity_check`, dan membandingkan jumlah pengguna serta titipan. Tes `backup.test.ts` memulihkan salinan dan memeriksa kepemilikan tetap sama. Backup menyalin seluruh database, termasuk tabel Telegram.
