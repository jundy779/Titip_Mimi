// Server uji untuk tes browser: verifier Google palsu, Telegram palsu, dan database sementara.
// Jangan dipakai di produksi.
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import type { Express } from 'express';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { openDatabase } from '../src/db';
import { TelegramApi } from '../src/telegram/api';
import { Reminders } from '../src/telegram/reminders';

const people: Record<string, { sub: string; email: string; emailVerified: boolean; name: string }> = {
  'cred-a': { sub: 'g-111', email: 'iqlima.uji@contoh.id', emailVerified: true, name: 'Uji A' },
  'cred-b': { sub: 'g-222', email: 'jundy.uji@contoh.id', emailVerified: true, name: 'Uji B' },
};
const calls: { method: string; params: unknown }[] = [];
let id = 900;
const photo = process.env.FAKE_PHOTO ? readFileSync(process.env.FAKE_PHOTO) : Buffer.from('JPG');
const telegram: TelegramApi = {
  async call(method, params = {}) {
    calls.push({ method, params });
    if (method === 'getFile') return { file_path: 'photos/uji.jpg', file_size: photo.length } as any;
    return { message_id: id++ } as any;
  },
  async download() { return { body: Readable.toWeb(Readable.from([photo])) as any, type: 'image/jpeg', length: photo.length }; },
};
(async () => {
  const withTelegram = process.env.FAKE_TELEGRAM === '1';
  const config = loadConfig({
    STATIC_DIR: process.env.STATIC_DIR, ALLOWED_EMAILS: 'iqlima.uji@contoh.id,jundy.uji@contoh.id',
    ...(withTelegram ? { TELEGRAM_BOT_TOKEN: '1:uji', TELEGRAM_BOT_USERNAME: 'TitipMimiUjiBot', TELEGRAM_WEBHOOK_SECRET: 'rahasia-e2e-0123456789' } : {}),
  } as NodeJS.ProcessEnv);
  const app = await createApp(config, openDatabase(':memory:'), { async verify(c) { if (!people[c]) throw new Error('x'); return people[c]; } }, false, withTelegram ? telegram : null);
  if (withTelegram) {
    const server = app.getHttpAdapter().getInstance() as Express;
    server.get('/__uji/telegram', (_req, res) => { res.json(calls); });
    server.post('/__uji/tick', async (req, res) => { res.json(await app.get(Reminders).tick(Number(req.query.now) || Date.now())); });
  }
  await app.listen(Number(process.env.PORT) || 4400, '127.0.0.1');
  console.log('e2e server siap');
})();
