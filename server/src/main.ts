import { loadConfig } from './config';
import { openDatabase } from './db';
import { OAuthGoogleVerifier } from './google';
import { createApp } from './app';
import { HttpTelegramApi } from './telegram/api';
import { TelegramBot } from './telegram/bot';
import { Reminders } from './telegram/reminders';
import { TelegramPoller } from './telegram/poller';

async function main() {
  const config = loadConfig();
  const db = openDatabase(config.databasePath);
  if (!config.googleClientIds.length) console.warn('GOOGLE_CLIENT_ID belum diatur: login Google dimatikan.');
  if (!config.allowedEmails.length) console.warn('ALLOWED_EMAILS kosong: semua akun Google terverifikasi bisa mendaftar.');
  const tg = config.telegram;
  const telegram = tg.token ? new HttpTelegramApi(tg.token) : null;
  if (!telegram) console.warn('TELEGRAM_BOT_TOKEN belum diatur: bot Telegram dan pengingat Telegram dimatikan.');
  else if (!tg.username) console.warn('TELEGRAM_BOT_USERNAME belum diatur: tautan Hubungkan Telegram tidak bisa dibuat.');
  if (telegram && tg.mode === 'webhook' && !tg.webhookSecret) console.warn('TELEGRAM_WEBHOOK_SECRET kosong: webhook menolak semua kiriman. Isi, atau pakai TELEGRAM_MODE=polling.');
  const app = await createApp(config, db, new OAuthGoogleVerifier(config.googleClientIds), true, telegram);
  app.enableShutdownHooks();
  await app.listen(config.port);
  if (telegram) {
    app.get(Reminders).start(tg.reminderEveryMs);
    if (tg.mode === 'polling') {
      const poller = new TelegramPoller(telegram, app.get(TelegramBot));
      void poller.start();
      process.once('SIGTERM', () => poller.stop());
    }
  }
  console.log(JSON.stringify({ started: true, port: config.port, telegram: tg.mode }));
}
main().catch(error => { console.error('Gagal menyalakan server', error instanceof Error ? error.message : error); process.exit(1); });
