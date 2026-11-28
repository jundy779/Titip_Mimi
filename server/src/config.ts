// Semua konfigurasi dari environment. Nilai rahasia tidak pernah ditulis ke log.
const list = (v?: string) => (v || '').split(',').map(s => s.trim()).filter(Boolean);

export interface Config {
  port: number;
  databasePath: string;
  googleClientIds: string[];
  allowedEmails: string[];
  allowedOrigins: string[];
  staticDir: string | null;
  cookieSecure: boolean;
  sessionDays: number;
  telegram: {
    token: string;            // dari @BotFather, rahasia
    username: string;         // nama bot tanpa @, untuk tautan t.me
    webhookSecret: string;    // dicocokkan dengan header X-Telegram-Bot-Api-Secret-Token
    mode: 'webhook' | 'polling' | 'off';
    publicUrl: string;        // alamat HTTPS server, untuk setWebhook
    reminderEveryMs: number;
  };
  push: {
    vapidPublicKey: string;   // kosong = dibuat sekali dan disimpan di database
    vapidPrivateKey: string;  // rahasia
    subject: string;          // kontak untuk layanan push: mailto: atau https:
    everyMs: number;
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === 'production';
  return {
    port: Number(env.PORT) || 3000,
    databasePath: env.DATABASE_PATH || 'data/mimi.sqlite',
    googleClientIds: list(env.GOOGLE_CLIENT_ID),
    allowedEmails: list(env.ALLOWED_EMAILS).map(e => e.toLowerCase()),
    allowedOrigins: list(env.ALLOWED_ORIGINS),
    staticDir: env.STATIC_DIR === '' ? null : env.STATIC_DIR || '../dist',
    cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : production,
    sessionDays: Number(env.SESSION_DAYS) || 30,
    telegram: {
      token: env.TELEGRAM_BOT_TOKEN || '',
      username: (env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, ''),
      webhookSecret: env.TELEGRAM_WEBHOOK_SECRET || '',
      mode: env.TELEGRAM_MODE === 'polling' ? 'polling' : env.TELEGRAM_BOT_TOKEN || /^https:/.test(env.PUBLIC_URL || '') ? 'webhook' : 'polling',
      publicUrl: (env.PUBLIC_URL || '').replace(/\/$/, ''),
      reminderEveryMs: Number(env.REMINDER_EVERY_MS) || 30000,
    },
    push: {
      vapidPublicKey: env.VAPID_PUBLIC_KEY || '',
      vapidPrivateKey: env.VAPID_PRIVATE_KEY || '',
      subject: env.VAPID_SUBJECT || (/^https:/.test(env.PUBLIC_URL || '') ? (env.PUBLIC_URL || '').replace(/\/$/, '') : 'mailto:mimi@example.com'),
      everyMs: Number(env.REMINDER_EVERY_MS) || 30000,
    },
  };
}

export const CONFIG = Symbol('CONFIG');
