import { loadConfig } from './config';
import { openDatabase } from './db';
import { OAuthGoogleVerifier } from './google';
import { createApp } from './app';
import { HttpTelegramApi } from './telegram/api';
import { TelegramRuntime } from './telegram/runtime';
import { TelegramService } from './telegram/service';

async function main() {
  const config = loadConfig();
  const db = openDatabase(config.databasePath);
  if (!config.googleClientIds.length) console.warn('GOOGLE_CLIENT_ID belum diatur: login Google dimatikan.');
  if (!config.allowedEmails.length) console.warn('ALLOWED_EMAILS kosong: semua akun Google terverifikasi bisa mendaftar.');
  const tg = config.telegram;
  const telegram = tg.token ? new HttpTelegramApi(tg.token) : null;
  if (telegram && tg.mode === 'webhook' && !tg.webhookSecret) console.warn('TELEGRAM_WEBHOOK_SECRET kosong: webhook menolak semua kiriman. Isi, atau pakai TELEGRAM_MODE=polling.');
  const app = await createApp(config, db, new OAuthGoogleVerifier(config.googleClientIds), true, telegram);
  app.enableShutdownHooks();
  await app.listen(config.port);
  // Bot dari environment atau dari Profil (tersimpan di database). Tanpa keduanya, bot menunggu dipasang dari Profil.
  await app.get(TelegramService).boot();
  const rt = app.get(TelegramRuntime);
  console.log(JSON.stringify({ started: true, port: config.port, telegram: rt.source ? { source: rt.source, bot: rt.username, receiving: rt.receiving } : 'menunggu dipasang dari Profil' }));
}
main().catch(error => { console.error('Gagal menyalakan server', error instanceof Error ? error.message : error); process.exit(1); });
