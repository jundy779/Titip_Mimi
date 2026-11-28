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
      mode: !env.TELEGRAM_BOT_TOKEN ? 'off' : env.TELEGRAM_MODE === 'polling' ? 'polling' : 'webhook',
      publicUrl: (env.PUBLIC_URL || '').replace(/\/$/, ''),
      reminderEveryMs: Number(env.REMINDER_EVERY_MS) || 30000,
    },
  };
}

export const CONFIG = Symbol('CONFIG');
