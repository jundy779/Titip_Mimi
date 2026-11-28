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

Validasi per titipan (gagal = `invalid`, titipan lain tetap diproses): judul 1–100 karakter, catatan ≤ 4000, `time` kosong atau `YYYY-MM-DDTHH:MM` (waktu lokal pengguna), kartu akun wajib `identity` ≤ 160. Opsional: `place` ≤ 160 (tempat acara) dan, khusus kartu akun, `vault` salah satu `google`, `apple`, `bitwarden`, `onepassword`, `samsung`, `browser`, `other` (di mana kata sandinya disimpan). Kolom yang tidak dikenal, termasuk apa pun yang mirip kata sandi, dibuang.

## Cari

`GET /v1/items?q=canva` → `{ items: [...] }`, maksimal 100 hasil milik pengguna aktif, tidak termasuk yang dihapus. Mencari judul, catatan, email/label, cara masuk, tempat, dan nama file lampiran.

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

Bot opsional. Bot berasal dari `TELEGRAM_BOT_TOKEN` di server (diutamakan) atau dari token yang ditempel di Profil (`POST /v1/telegram/bot`). Tanpa keduanya, endpoint tautan dan lampiran menjawab `503 telegram_disabled`. Token bot hanya ada di server; browser tidak pernah menerima token atau `file_id`.

| Operasi | Permintaan | Respons |
|---|---|---|
| Status | `GET /v1/telegram` | `200 { enabled, bot: { username, source, mine, receiving, canInstall }, linked, username, linkedAt, timezone, quietStart, quietEnd }`. `bot.source` `env` atau `profil`; `mine` benar bila pengguna ini yang memasang; `receiving` `polling`, `webhook`, atau `null`; `canInstall` benar bila pengguna ini boleh memasang atau mengganti bot. `username` di luar `bot` adalah akun Telegram pengguna yang tersambung. Jam tenang dalam menit sejak 00.00 di zona pengguna; `null` berarti mati. Bawaan 1320 (22.00) sampai 360 (06.00). |
| Pasang bot | `POST /v1/telegram/bot` body `{ "token": "<token dari BotFather>" }` | `200` status terbaru. Server memanggil `getMe`, menyimpan token, username, secret webhook acak, dan pemasangnya, memasang deskripsi pendek, deskripsi, dan menu perintah, lalu mulai menerima pesan: webhook bila `PUBLIC_URL` https, selain itu polling. Mengganti ke bot lain menghapus semua sambungan Telegram (obrolannya berbeda). |
| Lepas bot | `POST /v1/telegram/bot/remove` | `204`. Token dihapus, webhook dilepas, semua sambungan dan pengingat yang menunggu dibatalkan. Titipan tetap ada. |
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
| 400 | `bad_token` | Bentuk token salah (harus `angka:huruf`) |
| 400 | `token_rejected` | Telegram menolak token (sudah diganti atau bukan bot) |
| 403 | `not_bot_owner` | Bot dipasang dari akun lain; hanya pemasangnya yang boleh mengganti atau melepas |
| 409 | `managed_by_server` | Bot berasal dari `TELEGRAM_BOT_TOKEN`; diganti lewat server, bukan Profil |
| 503 | `telegram_disabled` | Belum ada bot |

**Bentuk titipan dari Telegram.** Sama dengan titipan web, ditambah dua kolom opsional yang ikut sinkron dan divalidasi server:

```json
{
  "clientId": "tg-Qm9rU2VuZGlyaQ", "kind": "note", "title": "Nota jahit", "note": "bawa uang 35rb",
  "time": "", "done": false, "source": "telegram",
  "attachments": [{ "kind": "photo", "id": "AQADb2xyZGVtbw", "mime": "image/jpeg", "size": 1737 }]
}
```

Klien boleh mengirim ulang `attachments` lewat `/v1/sync` (misalnya saat mengubah judul), tetapi `/v1/media` hanya melayani `id` yang tercatat dari Telegram milik pemilik itu. Menyalin `id` milik akun lain tidak membuka filenya.

**Alur di Telegram.** Satu kiriman (teks, foto, video, dokumen, atau satu album) menjadi satu titipan tanpa jadwal. Mimi membalas dengan tombol waktu: dari caption atau teks ("jumat jam 4 sore"), atau pilihan cepat "Nanti malam 19.00" dan "Besok pagi 08.00". Membalas pesan Mimi dengan waktu ("besok jam 9 pagi") juga mengonfirmasi. Jadwal baru aktif setelah dikonfirmasi. Perintah: `/hariini`, `/besok`, `/cari kata`, `/tenang 22-6` atau `/tenang mati`, `/id` (menampilkan ID dan username Telegram, juga sebelum tersambung; ID tidak perlu diisi di mana pun karena tercatat otomatis saat menautkan), `/bantuan`, `/stop`.

**Pengingat.** Saat jatuh tempo, Mimi mengirim judul, waktu dalam zona pengguna, catatan, dan lampiran pertama, dengan tombol **Sudah selesai**, **Tunda 10 menit**, **Tunda 1 jam**. Selesai dari Telegram sama dengan di web: rutinitas berulang menjadi riwayat dan jadwal berikutnya dibuat. Tunda mengisi `snoozeUntil`, sama dengan web.

## Pasangan, surat, dan rencana berdua

Semua di bawah `/v1/partner`, butuh sesi dan header `X-Mimi: 1` untuk POST. Identitas dan pasangan selalu diturunkan dari sesi; tidak ada parameter `userId`. Pasangan tidak pernah bisa membaca `items` milik yang lain.

| Aksi | Permintaan | Respons |
|---|---|---|
| Status | `GET /v1/partner` | `{ "paired": true, "partner": { "name": "Uji B" }, "since": 1795870000000, "unread": 1, "me": { "name": "Uji A" } }`. Belum tersambung: `paired: false`, `partner: null`, `since: null`. |
| Buat kode | `POST /v1/partner/invite` `{}` | `{ "code": "K7MPQ2XA", "expiresAt": 1795956400000 }` (milidetik). 8 huruf tanpa 0/O/1/I, berlaku 24 jam, sekali pakai. Kode lama pemilik batal. |
| Pakai kode | `POST /v1/partner/accept` `{ "code": "k7mp-q2xa" }` | Status seperti di atas. Huruf kecil, spasi, dan tanda hubung diabaikan. |
| Putus | `POST /v1/partner/leave` `{}` | `204`. Aman diulang. |
| Surat | `GET /v1/partner/letters` | `{ "received": [{ "id", "body", "sticker", "at", "read" }], "sent": [...], "unread": 1, "from": "Uji B" }` |
| Kirim surat | `POST /v1/partner/letters` `{ "body": "Semangat ya ♡", "sticker": "🌸" }` | `201 { "id", "body", "sticker", "at", "read": false }`. Stiker di luar daftar `♡ 🌸 ☕ 🌙 🧸 ✨` menjadi `♡`. Pasangan dikabari lewat Telegram bila tersambung dan bukan jam tenang. |
| Tandai dibaca | `POST /v1/partner/letters/<id>/read` | `204`. Hanya penerima. |
| Sembunyikan | `POST /v1/partner/letters/<id>/hide` | `204`. Hanya untuk sisi yang meminta. |
| Rencana | `GET /v1/partner/plans` | `{ "plans": [{ "id", "title", "note", "place", "time", "done", "updatedAt", "byMe", "by" }] }` |
| Simpan rencana | `POST /v1/partner/plans` `{ "id"?, "title", "time"?, "place"?, "note"?, "done"?, "updatedAt"? }` | `{ "plan": {...}, "status": "saved" }` atau `"stale"` bila versi server lebih baru (last-write-wins). Tanpa `id` = rencana baru, pasangan dikabari lewat Telegram. |
| Hapus rencana | `POST /v1/partner/plans/<id>/remove` | `204` |

| Status | `code` | Arti dan cara mencoba ulang |
|---|---|---|
| 400 | `bad_code` | Kode salah, kedaluwarsa, atau sudah dipakai. Minta kode baru. |
| 400 | `own_code` | Memasukkan kode sendiri |
| 409 | `already_paired` | Salah satu akun sudah punya pasangan. Putus dulu. |
| 409 | `not_paired` | Fitur surat atau rencana dipakai sebelum tersambung |
| 400 | `empty_letter`, `bad_plan` | Isi surat kosong atau rencana tanpa judul |
| 404 | `not_found` | Surat atau rencana tidak ada atau bukan milik pasangan ini (sengaja tidak dibedakan) |
| 429 | `too_many` | Lebih dari 50 surat sehari. Coba besok. |

**Tanpa server.** Web juga bisa mengirim surat dan ajakan tanpa akun: isinya dikemas di bagian `#` alamat (`/#surat?d=<base64url JSON>` atau `/#rencana?d=...`), dikirim lewat WhatsApp, lalu disimpan di browser penerima. Bagian `#` tidak pernah sampai ke server web. Isi divalidasi ulang saat dibuka (panjang, stiker, format waktu); tautan rusak diabaikan.

Contoh dua akun fiktif: `iqlima.uji@contoh.id` membuat kode, `jundy.uji@contoh.id` memasukkannya, lalu keduanya melihat `GET /v1/partner` → `paired: true`.

## Notifikasi walau web ditutup (Web Push)

Butuh sesi. Endpoint langganan datang dari browser dan hanya diterima untuk layanan push resmi (`https://` tanpa port lain ke `fcm.googleapis.com`, `android.googleapis.com`, `*.push.services.mozilla.com`, `web.push.apple.com`, `*.push.apple.com`, `*.notify.windows.com`), supaya server tidak bisa disuruh menghubungi alamat sembarang.

| Aksi | Permintaan | Respons |
|---|---|---|
| Status | `GET /v1/push` | `{ "publicKey": "<VAPID base64url>", "devices": 1, "care": { "water": true, "meal": true, "rest": true, "sleep": true } }` (`care` `null` bila belum pernah dikirim) |
| Daftar | `POST /v1/push/subscribe` `{ "subscription": <PushSubscription.toJSON()>, "label": "Chrome di Android" }` | Status seperti di atas. Ulang aman. |
| Cabut | `POST /v1/push/unsubscribe` `{ "endpoint": "https://fcm.googleapis.com/…" }` | `204`. Hanya milik sendiri. |
| Jaga diri | `POST /v1/push/care` `{ "water": true, "meal": false, "rest": true, "sleep": true }` | Pilihan tersimpan (kolom lain dibuang, selain `true` = mati) |
| Tes | `POST /v1/push/test` | `{ "ok": true, "devices": 1 }`, atau `404 no_device` |
| Tombol notifikasi | `POST /v1/push/action` `{ "t": "<token dari notifikasi>", "action": "done" \| "snooze" }` | `{ "ok": true, "message": "Selesai ♡ Mimi bangga" }`. Tanpa sesi: token HMAC berlaku 48 jam untuk satu titipan dan satu kejadian. Tetap butuh `X-Mimi: 1`. |

**Isi pesan push** (terenkripsi aes128gcm untuk browser tujuan):

```json
{ "type": "agenda", "title": "Mimi mau ingetin ♡", "body": "Ambil jahitan\n🗓 Selasa, 1 Des, 16.00", "tag": "mimi-<reminderId>", "id": "<reminderId>",
  "actions": [{ "action": "done", "title": "✓ Sudah selesai" }, { "action": "snooze", "title": "Tunda 10 menit" }], "t": "<token>" }
```

`type` juga `care` (tag `water-09:00`, sama dengan notifikasi dari halaman sehingga tidak dobel) dan `test`. Service worker tidak menampilkan agenda atau jaga diri kalau Ruang Iqlima sedang dibuka dan dilihat.

**Aturan kirim.** Sama dengan Telegram: periksa ulang pemilik, selesai, dan jadwal tepat sebelum kirim; satu kejadian sekali; jam tenang menunda agenda sampai jam tenang selesai, sedangkan jaga diri yang jatuh di jam tenang dilewati. Gagal sementara (5xx, 429, jaringan) dicoba lagi 1/5/15/60 menit, maksimal 5 kali. Pengguna yang juga menautkan Telegram menerima keduanya.

| Status | `code` | Arti |
|---|---|---|
| 400 | `bad_subscription` | Endpoint bukan layanan push resmi atau kunci tidak valid. Aktifkan ulang dari browser. |
| 404 | `no_device` | Tes tanpa perangkat terdaftar |
| 404 | `not_found`, `expired` | Token tombol palsu, kedaluwarsa, atau titipannya sudah tidak ada |

## Sambungkan aplikasi HP

| Aksi | Permintaan | Respons |
|---|---|---|
| Buat kode (web, butuh sesi) | `POST /v1/auth/device-code` `{}` | `{ "code": "K7MPQ2XA", "expiresAt": 1795880000000 }`. 10 menit, sekali pakai, kode lama pemilik batal. |
| Tukar kode (HP, tanpa sesi) | `POST /v1/auth/device-code/redeem` `{ "code": "k7mp-q2xa" }` | `{ "user": { "id", "name", "email" }, "token": "<Bearer>", "expiresAt": … }`. Huruf kecil dan tanda hubung diabaikan. |

`400 bad_code` untuk kode salah, dipakai, atau kedaluwarsa. `429 too_many` setelah 10 percobaan per menit dari alamat yang sama. Setelah itu HP memakai `Authorization: Bearer <token>` untuk `/v1/sync` dan `/v1/media/<id>`, sama seperti web di domain lain.
