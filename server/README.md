# Server Titip Mimi

NestJS + SQLite (better-sqlite3). Melayani web statis dari `STATIC_DIR` dan API `/v1`. Kontrak di [docs/api](../docs/api/README.md), skema di [docs/database](../docs/database/README.md), operasi di [runbook](../docs/runbooks/README.md).

```sh
npm ci
npm test          # build + 42 tes: sesi, dua pemilik, migrasi ulang dan upgrade 1→3, konflik, paralel, hapus,
                  # validasi, CSRF, batas login, backup, serta 24 tes bot Telegram, pengingat, dan pasang bot dari Profil
GOOGLE_CLIENT_ID=... ALLOWED_EMAILS=... npm start
npm run telegram:setup   # opsional: pasang ulang webhook dan menu bot dari environment
```

Bot Telegram ada di `src/telegram/`: `bot.ts` (tautan, kiriman, tombol, perintah), `reminders.ts` (pengiriman pengingat), `controller.ts` (webhook, endpoint Profil, proksi lampiran), `poller.ts` (mode tanpa domain), `time.ts` (zona waktu dan pengurai waktu bahasa Indonesia yang sama dengan web), `runtime.ts` (bot aktif dari environment atau Profil), `service.ts` (menyalakan dan mengganti polling/webhook tanpa restart).

`test/e2e-server.ts` menyalakan server dengan verifier Google palsu (dan Telegram palsu bila `FAKE_TELEGRAM=1`) untuk uji browser. Jangan dipakai di produksi.
