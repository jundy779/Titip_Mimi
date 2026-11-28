import { loadConfig } from './config';
import { openDatabase } from './db';
import { OAuthGoogleVerifier } from './google';
import { createApp } from './app';

async function main() {
  const config = loadConfig();
  const db = openDatabase(config.databasePath);
  if (!config.googleClientIds.length) console.warn('GOOGLE_CLIENT_ID belum diatur: login Google dimatikan.');
  if (!config.allowedEmails.length) console.warn('ALLOWED_EMAILS kosong: semua akun Google terverifikasi bisa mendaftar.');
  const app = await createApp(config, db, new OAuthGoogleVerifier(config.googleClientIds));
  app.enableShutdownHooks();
  await app.listen(config.port);
  console.log(JSON.stringify({ started: true, port: config.port }));
}
main().catch(error => { console.error('Gagal menyalakan server', error instanceof Error ? error.message : error); process.exit(1); });
