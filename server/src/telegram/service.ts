import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { CONFIG, Config } from '../config';
import { TelegramBot } from './bot';
import { TelegramPoller } from './poller';
import { Reminders } from './reminders';
import { TelegramRuntime } from './runtime';

// Menyalakan, mengganti, dan mematikan cara bot menerima pesan (polling atau webhook)
// tanpa perlu restart server. boot() hanya dipanggil oleh main.ts, jadi tes tidak ikut polling.
@Injectable()
export class TelegramService implements OnModuleDestroy {
  private poller: TelegramPoller | null = null;
  private booted = false;
  lastError = '';

  constructor(private rt: TelegramRuntime, private bot: TelegramBot, private reminders: Reminders, @Inject(CONFIG) private config: Config) {}

  async boot() {
    this.booted = true;
    this.reminders.start(this.config.telegram.reminderEveryMs);
    await this.rt.ensureUsername();
    if (this.rt.source === 'env') await this.rt.describe();
    await this.receive();
  }

  async receive() {
    this.poller?.stop();
    this.poller = null;
    this.rt.receiving = null;
    const api = this.rt.api;
    if (!this.booted || !api) return;
    if (this.rt.mode === 'polling') {
      this.poller = new TelegramPoller(api, this.bot);
      void this.poller.start();
      this.rt.receiving = 'polling';
      return;
    }
    if (!this.rt.secret) { this.lastError = 'webhook secret kosong'; return; }
    try {
      await api.call('setWebhook', { url: this.rt.webhookUrl, secret_token: this.rt.secret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: false });
      this.rt.receiving = 'webhook';
      this.lastError = '';
    } catch (error) {
      this.lastError = error instanceof Error ? error.message.slice(0, 120) : 'setWebhook gagal';
      console.warn(JSON.stringify({ telegram: 'setWebhook', error: this.lastError }));
    }
  }

  async install(ownerId: string, token: unknown) {
    const result = await this.rt.install(ownerId, token);
    await this.receive();
    return result;
  }
  async remove(ownerId: string) {
    await this.rt.remove(ownerId);
    await this.receive();
  }
  onModuleDestroy() { this.poller?.stop(); }
}
