// Pasang webhook dan daftar perintah bot. Jalankan sekali setelah server online:
//   node dist/src/telegram/setup.js
// Butuh TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, dan PUBLIC_URL (https) di environment.
import { loadConfig } from '../config';
import { HttpTelegramApi } from './api';

export const COMMANDS = [
  { command: 'cari', description: 'Cari titipan' },
  { command: 'tenang', description: 'Atur jam tenang, misalnya /tenang 22-6' },
  { command: 'stop', description: 'Putuskan Telegram dari Ruang Iqlima' },
];

async function main() {
  const { telegram } = loadConfig();
  if (!telegram.token) throw new Error('TELEGRAM_BOT_TOKEN belum diatur');
  const api = new HttpTelegramApi(telegram.token);
  await api.call('setMyCommands', { commands: COMMANDS });
  if (telegram.mode === 'polling') { console.log('Mode polling: webhook tidak dipasang. Perintah bot sudah didaftarkan.'); return; }
  if (!/^https:\/\//.test(telegram.publicUrl)) throw new Error('PUBLIC_URL harus alamat https');
  if (!/^[\w-]{16,256}$/.test(telegram.webhookSecret)) throw new Error('TELEGRAM_WEBHOOK_SECRET wajib 16–256 karakter A-Z, a-z, 0-9, _ atau -');
  await api.call('setWebhook', { url: telegram.publicUrl + '/v1/telegram/webhook', secret_token: telegram.webhookSecret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: false });
  const info = await api.call<{ url: string; pending_update_count: number; last_error_message?: string }>('getWebhookInfo');
  console.log(JSON.stringify({ webhook: info.url, pending: info.pending_update_count, lastError: info.last_error_message || null }));
}

if (require.main === module) main().catch(e => { console.error('Gagal memasang bot:', e instanceof Error ? e.message : e); process.exit(1); });
