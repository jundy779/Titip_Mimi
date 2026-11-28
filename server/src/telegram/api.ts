// Klien Bot API Telegram. Token hanya ada di alamat permintaan ke api.telegram.org dan tidak
// pernah masuk ke pesan error, log, atau respons untuk browser.

export class TelegramError extends Error {
  constructor(public code: number, public description: string, public retryAfter?: number) {
    super(`Telegram ${code}: ${description}`);
  }
  // Pengguna memblokir bot atau obrolan hilang: sambungan dianggap putus.
  get gone() { return this.code === 403 || (this.code === 400 && /chat not found|user is deactivated/i.test(this.description)); }
}

export interface TgUser { id: number; is_bot?: boolean; first_name?: string; username?: string }
export interface TgChat { id: number; type: string }
export interface TgPhoto { file_id: string; file_unique_id: string; width: number; height: number; file_size?: number }
export interface TgFile { file_id: string; file_unique_id: string; file_name?: string; mime_type?: string; file_size?: number }
export interface TgMessage {
  message_id: number; date: number; chat: TgChat; from?: TgUser;
  text?: string; caption?: string; media_group_id?: string;
  photo?: TgPhoto[]; video?: TgFile; document?: TgFile;
  reply_to_message?: { message_id: number; from?: TgUser };
}
export interface TgCallback { id: string; from: TgUser; data?: string; message?: { message_id: number; chat: TgChat } }
export interface TgUpdate { update_id: number; message?: TgMessage; callback_query?: TgCallback }

export interface TelegramApi {
  call<T = any>(method: string, params?: Record<string, unknown>): Promise<T>;
  // Unduh file lewat file_path hasil getFile. Mengembalikan aliran isi dan tipe kontennya.
  download(filePath: string): Promise<{ body: ReadableStream<Uint8Array> | null; type: string; length: number }>;
}
export const TELEGRAM_API = Symbol('TELEGRAM_API');

export class HttpTelegramApi implements TelegramApi {
  constructor(private token: string, private base = 'https://api.telegram.org', private timeoutMs = 40000) {}

  async call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.base}/bot${this.token}/${method}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      // Pesan error fetch bisa memuat alamat lengkap (termasuk token). Jangan diteruskan.
      throw new TelegramError(0, error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network');
    }
    const data = await res.json().catch(() => ({})) as { ok?: boolean; result?: T; description?: string; error_code?: number; parameters?: { retry_after?: number } };
    if (!res.ok || !data.ok) throw new TelegramError(data.error_code || res.status, String(data.description || 'error').slice(0, 200), data.parameters?.retry_after);
    return data.result as T;
  }

  async download(filePath: string) {
    if (!/^[\w./-]{1,300}$/.test(filePath) || filePath.includes('..')) throw new TelegramError(400, 'bad file path');
    let res: Response;
    try { res = await fetch(`${this.base}/file/bot${this.token}/${filePath}`, { signal: AbortSignal.timeout(60000) }); }
    catch { throw new TelegramError(0, 'network'); }
    if (!res.ok) throw new TelegramError(res.status, 'download failed');
    return { body: res.body, type: res.headers.get('content-type') || '', length: Number(res.headers.get('content-length')) || 0 };
  }
}
