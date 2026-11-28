# Kontrak API Titip Mimi (v1)

Server NestJS di `server/` melayani web statis dan API di domain yang sama. Semua respons API memakai `Cache-Control: no-store`. Kesalahan berbentuk `{ "code": "...", "message": "kalimat untuk Iqlima" }`.

## Sesi

| Operasi | Permintaan | Respons |
|---|---|---|
| Masuk | `POST /v1/auth/google` body `{ "credential": "<ID token dari Google Identity Services>" }` | `200 { user: {id,name,email}, expiresAt }` + cookie `mimi_session` (HttpOnly, SameSite=Lax, Secure di produksi). Dengan header `X-Mimi-Client: token`, respons juga memuat `token` untuk aplikasi HP atau web di domain lain. |
| Siapa saya | `GET /v1/me` | `200 { id, name, email, timezone }` |
| Keluar | `POST /v1/auth/logout` | `204`, sesi dicabut dan cookie dihapus |

Identitas selalu diturunkan dari sesi yang diverifikasi server. Token sesi 256 bit; database hanya menyimpan hash SHA-256. Masa berlaku `SESSION_DAYS` (bawaan 30 hari).

| Status | `code` | Arti |
|---|---|---|
| 400 | `bad_credential` | Body tidak berisi credential |
| 401 | `google_rejected`, `email_unverified` | Token Google tidak valid, kedaluwarsa, Google tak terjangkau, atau email belum terverifikasi |
| 401 | `session_expired` | Sesi tidak ada, dicabut, atau kedaluwarsa. Klien meminta masuk lagi. |
| 403 | `not_invited` | Email tidak ada di `ALLOWED_EMAILS` |
| 403 | `missing_header` | Permintaan berbasis cookie tanpa header `X-Mimi: 1` (perlindungan CSRF) |
| 429 | `too_many` | Lebih dari 10 percobaan masuk per menit per alamat |
| 503 | `login_disabled` | `GOOGLE_CLIENT_ID` belum diatur |

## Sinkron titipan

`POST /v1/sync` body `{ "changes": [...], "since": <cursor> }`, maksimal 500 perubahan per permintaan.

Setiap perubahan adalah satu titipan lengkap seperti di localStorage web, ditambah `clientId` (8–64 karakter `[A-Za-z0-9_-]`) dan `updatedAt` (milidetik). Penghapusan dikirim sebagai `{ clientId, deleted: true, updatedAt }`.

Aturan penggabungan per titipan: **yang `updatedAt`-nya lebih baru menang** (last-write-wins). Seri diputus secara deterministik dari isi data sehingga semua perangkat berakhir sama. `updatedAt` lebih dari 5 menit di masa depan dipangkas. Mengirim ulang perubahan yang sama aman: hasilnya `stale` dan tidak menggandakan apa pun.

Respons:

```json
{
  "results": [{ "clientId": "nota-0001", "status": "saved" }, { "clientId": "x", "status": "invalid", "error": "clientId tidak valid" }],
  "items": [{ "clientId": "nota-0001", "kind": "agenda", "title": "Ambil jahitan", "note": "", "time": "2026-11-28T16:00", "done": false, "updatedAt": 1764316800000, "deleted": false, "seq": 12 }],
  "cursor": 12,
  "more": false
}
```

`items` berisi semua titipan pemilik dengan `seq > since`, termasuk yang baru disimpan. Simpan `cursor` untuk permintaan berikutnya. Bila `more` bernilai true, ulangi dengan cursor baru.

Validasi per titipan (gagal = `invalid`, titipan lain tetap diproses): judul 1–100 karakter, catatan ≤ 4000, `time` kosong atau `YYYY-MM-DDTHH:MM` (waktu lokal pengguna), kartu akun wajib `identity` ≤ 160. Kolom yang tidak dikenal, termasuk apa pun yang mirip kata sandi, dibuang.

## Cari

`GET /v1/items?q=canva` → `{ items: [...] }`, maksimal 100 hasil milik pengguna aktif, tidak termasuk yang dihapus. Mencari judul, catatan, email/label, dan cara masuk.

## Contoh dua akun fiktif

```sh
# Akun A (iqlima.uji@contoh.id) menitip kartu Canva kampus
curl -X POST https://mimi.contoh.id/v1/sync -H "Authorization: Bearer $TOKEN_A" -H 'Content-Type: application/json' \
  -d '{"changes":[{"clientId":"canva-kampus-01","kind":"account","title":"Canva","identity":"akun kampus","method":"Google","note":"","time":"","done":false,"updatedAt":1764316800000}],"since":0}'
# Akun B (jundy.uji@contoh.id) menerima daftar kosong
curl -X POST https://mimi.contoh.id/v1/sync -H "Authorization: Bearer $TOKEN_B" -H 'Content-Type: application/json' -d '{"changes":[],"since":0}'
```

Untuk Flutter: gunakan `google_sign_in` untuk mendapat ID token dengan Client ID web yang sama (serverClientId), kirim ke `/v1/auth/google` dengan `X-Mimi-Client: token`, simpan token di penyimpanan aman perangkat, lalu panggil `/v1/sync` dengan header `Authorization: Bearer`.

## Telegram (TG-1, REM-1)

Bot opsional. Tanpa `TELEGRAM_BOT_TOKEN` semua endpoint di bawah menjawab `503 telegram_disabled` dan pengingat Telegram mati. Token bot hanya ada di server; browser tidak pernah menerima token atau `file_id`.

| Operasi | Permintaan | Respons |
|---|---|---|
| Status | `GET /v1/telegram` | `200 { enabled, linked, username, linkedAt, timezone, quietStart, quietEnd }`. Jam tenang dalam menit sejak 00.00 di zona pengguna; `null` berarti mati. Bawaan 1320 (22.00) sampai 360 (06.00). |
| Buat tautan | `POST /v1/telegram/link` body `{}` | `200 { url: "https://t.me/<bot>?start=<kode>", expiresAt }`. Kode acak 144 bit, sekali pakai, berlaku 10 menit, hanya hash-nya yang disimpan. Membuat tautan baru membatalkan kode lama milik pengguna yang sama. |
| Jam tenang | `POST /v1/telegram/settings` body `{ "quietStart": 1320, "quietEnd": 360 }` atau keduanya `null` | `200` status terbaru. `400 bad_quiet` bila di luar 0–1439 atau hanya satu yang `null`. |
| Putuskan | `POST /v1/telegram/unlink` | `204`. Pengingat yang menunggu dibatalkan (`skipped`). Titipan tetap ada. |
| Lampiran | `GET /v1/media/<id>` (`id` = `attachments[].id`) | Isi file. Gambar, mp4/webm, dan PDF tampil langsung; tipe lain dipaksa unduh (`application/octet-stream`, `attachment`). Selalu `Content-Security-Policy: sandbox` dan `Cache-Control: private, max-age=3600`. |
| Webhook | `POST /v1/telegram/webhook` (hanya untuk Telegram) | `200 {}`. Wajib header `X-Telegram-Bot-Api-Secret-Token` yang sama dengan `TELEGRAM_WEBHOOK_SECRET`; selain itu `404`. Tidak butuh `X-Mimi`. |

| Status | `code` | Arti dan cara mencoba ulang |
|---|---|---|
| 404 | `not_found` | Lampiran tidak ada atau milik orang lain (sengaja tidak dibedakan) |
| 413 | `too_big` | File lebih dari 20 MB, batas unduh Bot API. Buka dari Telegram; pengingat tetap membawa file lewat `file_id`. |
| 502 | `telegram_unavailable` | Telegram tidak terjangkau saat mengambil file. Aman dicoba lagi. |
| 503 | `telegram_disabled` | Bot belum diatur di server |

**Bentuk titipan dari Telegram.** Sama dengan titipan web, ditambah dua kolom opsional yang ikut sinkron dan divalidasi server:

```json
{
  "clientId": "tg-Qm9rU2VuZGlyaQ", "kind": "note", "title": "Nota jahit", "note": "bawa uang 35rb",
  "time": "", "done": false, "source": "telegram",
  "attachments": [{ "kind": "photo", "id": "AQADb2xyZGVtbw", "mime": "image/jpeg", "size": 1737 }]
}
```

Klien boleh mengirim ulang `attachments` lewat `/v1/sync` (misalnya saat mengubah judul), tetapi `/v1/media` hanya melayani `id` yang tercatat dari Telegram milik pemilik itu. Menyalin `id` milik akun lain tidak membuka filenya.

**Alur di Telegram.** Satu kiriman (teks, foto, video, dokumen, atau satu album) menjadi satu titipan tanpa jadwal. Mimi membalas dengan tombol waktu: dari caption atau teks ("jumat jam 4 sore"), atau pilihan cepat "Nanti malam 19.00" dan "Besok pagi 08.00". Membalas pesan Mimi dengan waktu ("besok jam 9 pagi") juga mengonfirmasi. Jadwal baru aktif setelah dikonfirmasi. Perintah: `/cari kata`, `/tenang 22-6` atau `/tenang mati`, `/stop`.

**Pengingat.** Saat jatuh tempo, Mimi mengirim judul, waktu dalam zona pengguna, catatan, dan lampiran pertama, dengan tombol **Sudah selesai**, **Tunda 10 menit**, **Tunda 1 jam**. Selesai dari Telegram sama dengan di web: rutinitas berulang menjadi riwayat dan jadwal berikutnya dibuat. Tunda mengisi `snoozeUntil`, sama dengan web.
