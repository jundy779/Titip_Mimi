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
  };
}

export const CONFIG = Symbol('CONFIG');
