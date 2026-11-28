# Server Titip Mimi

NestJS + SQLite (better-sqlite3). Melayani web statis dari `STATIC_DIR` dan API `/v1`. Kontrak di [docs/api](../docs/api/README.md), skema di [docs/database](../docs/database/README.md), operasi di [runbook](../docs/runbooks/README.md).

```sh
npm ci
npm test          # build + 16 tes: sesi, dua pemilik, migrasi ulang, konflik, paralel, hapus, validasi, CSRF, batas login, backup
GOOGLE_CLIENT_ID=... ALLOWED_EMAILS=... npm start
```

`test/e2e-server.ts` menyalakan server dengan verifier Google palsu untuk uji browser. Jangan dipakai di produksi.
