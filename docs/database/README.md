# Model data (migrasi 1)

SQLite dengan WAL, foreign key aktif, dan `busy_timeout` 5 detik. Migrasi berurutan di `server/src/db.ts`, masing-masing dalam transaksi, versinya di `schema_version`.

| Tabel | Isi dan aturan |
|---|---|
| users | `id` UUID, `google_sub` unik, email, nama, zona waktu (bawaan Asia/Jakarta), waktu dibuat |
| sessions | `token_hash` (SHA-256, kunci utama), `user_id` → users, dibuat, kedaluwarsa. Sesi lama dibersihkan saat sesi baru dibuat. |
| items | Kunci `(owner_id, client_id)`. `kind` note/account/agenda, `search` (teks kecil untuk pencarian), `data` (JSON titipan yang sudah divalidasi), `deleted` (tombstone), `updated_at`, `seq` |
| counters | `seq` global yang naik setiap penulisan; dipakai sebagai cursor sinkron |

Satu perubahan sinkron diproses dalam satu transaksi. Tombstone dipertahankan agar perangkat lain tahu titipan sudah dihapus.

**Dari localStorage.** Web memberi setiap titipan `clientId` dan `updatedAt` (titipan lama diberi `updatedAt: 1` sehingga salinan server yang lebih baru menang). Contoh bawaan prototipe ditandai `demo: true` dan tidak dipindahkan. Pemindahan hanya berjalan setelah Iqlima menekan **Pindahkan titipan**, dan aman diulang karena `clientId` unik per pemilik.

**Backup.** `npm run backup -- <database> <folder>` membuat salinan konsisten lewat API backup SQLite, lalu membuka salinannya, menjalankan `integrity_check`, dan membandingkan jumlah pengguna serta titipan. Tes `backup.test.ts` memulihkan salinan dan memeriksa kepemilikan tetap sama.
