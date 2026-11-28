import { TelegramApi, TelegramError, TgUpdate } from './api';
import { TelegramBot } from './bot';

// Mode polling: bot menarik pesan sendiri dari Telegram. Cocok untuk jalan di laptop atau
// server tanpa domain HTTPS. Telegram tidak mengizinkan getUpdates selama webhook aktif,
// jadi webhook dihapus dulu (antrean pesan tetap disimpan).
export class TelegramPoller {
  private running = false;
  private offset = 0;
  constructor(private api: TelegramApi, private bot: TelegramBot, private wait = (ms: number) => new Promise(r => setTimeout(r, ms))) {}

  async start() {
    if (this.running) return;
    this.running = true;
    await this.api.call('deleteWebhook', { drop_pending_updates: false }).catch(() => {});
    while (this.running) await this.once();
  }
  stop() { this.running = false; }

  async once(timeout = 25) {
    let updates: TgUpdate[];
    try { updates = await this.api.call<TgUpdate[]>('getUpdates', { offset: this.offset, timeout, allowed_updates: ['message', 'callback_query'] }); }
    catch (error) {
      const e = error instanceof TelegramError ? error : new TelegramError(0, 'unknown');
      console.warn(JSON.stringify({ telegram: 'getUpdates', code: e.code }));
      await this.wait(e.retryAfter ? e.retryAfter * 1000 : 5000);
      return 0;
    }
    for (const u of updates) {
      try { await this.bot.handle(u); }
      catch (error) { console.error(JSON.stringify({ telegram: 'handle', update: u.update_id, error: error instanceof Error ? error.message.slice(0, 120) : 'unknown' })); }
      this.offset = Math.max(this.offset, u.update_id + 1);
    }
    return updates.length;
  }
}
