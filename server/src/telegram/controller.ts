import { BadRequestException, Body, Controller, Get, HttpCode, HttpException, Inject, NotFoundException, Param, Post, Req, Res, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';
import { AuthGuard, AuthedRequest } from '../auth';
import { DB, Db } from '../db';
import { TgUpdate } from './api';
import { TelegramBot } from './bot';
import { TelegramRuntime } from './runtime';
import { TelegramService } from './service';

const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const minute = (v: unknown) => v === null ? null : Number.isInteger(v) && (v as number) >= 0 && (v as number) < 1440 ? v as number : undefined;

@Controller('v1/telegram')
export class TelegramController {
  constructor(private bot: TelegramBot, private rt: TelegramRuntime, private service: TelegramService) {}

  // Hanya Telegram yang tahu secret_token dari setWebhook. Selain itu dijawab 404 seolah tidak ada.
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req: Request, @Body() body: TgUpdate) {
    const secret = this.rt.secret;
    const given = req.headers['x-telegram-bot-api-secret-token'];
    if (this.rt.mode !== 'webhook' || !secret || typeof given !== 'string' || !same(given, secret)) throw new NotFoundException();
    // Error di sini menjadi 500 sehingga Telegram mengirim ulang; update_id mencegah dobel.
    await this.bot.handle(body);
    return {};
  }

  @Get()
  @UseGuards(AuthGuard)
  status(@Req() req: AuthedRequest) { return this.bot.status(req.user.id); }

  @Post('link')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  link(@Req() req: AuthedRequest) {
    if (!this.bot.enabled) throw new ServiceUnavailableException({ code: 'telegram_disabled', message: 'Bot Telegram belum diaktifkan di server.' });
    return this.bot.createLink(req.user.id);
  }

  @Post('settings')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  settings(@Req() req: AuthedRequest, @Body() body: { quietStart?: unknown; quietEnd?: unknown }) {
    const start = minute(body?.quietStart), end = minute(body?.quietEnd);
    if (start === undefined || end === undefined || (start === null) !== (end === null)) {
      throw new BadRequestException({ code: 'bad_quiet', message: 'Jam tenang harus berupa menit 0–1439, atau keduanya null untuk mematikan.' });
    }
    this.bot.setQuiet(req.user.id, start, end);
    return this.bot.status(req.user.id);
  }

  // Pasang bot dari Profil: tempel token dari BotFather. Server memeriksa ke Telegram (getMe),
  // menyimpan token di server saja, memasang deskripsi dan menu, lalu mulai menerima pesan.
  @Post('bot')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async install(@Req() req: AuthedRequest, @Body() body: { token?: unknown }) {
    await this.service.install(req.user.id, body?.token);
    return this.bot.status(req.user.id);
  }

  @Post('bot/remove')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async remove(@Req() req: AuthedRequest) { await this.service.remove(req.user.id); }

  @Post('unlink')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  unlink(@Req() req: AuthedRequest) { this.bot.unlink(req.user.id); }
}

// Tipe yang aman ditampilkan langsung di browser. Selain ini diunduh sebagai file.
const INLINE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'application/pdf']);
const MAX_DOWNLOAD = 20 * 1024 * 1024;

@Controller('v1/media')
export class MediaController {
  constructor(@Inject(DB) private db: Db, private rt: TelegramRuntime) {}
  private get api() { return this.rt.api; }

  @Get(':id')
  @UseGuards(AuthGuard)
  async media(@Req() req: AuthedRequest, @Res() res: Response, @Param('id') id: string) {
    if (!/^[\w-]{1,100}$/.test(id)) throw new NotFoundException({ code: 'not_found', message: 'Lampiran tidak ditemukan.' });
    // Dicari dalam file milik pengguna yang masuk saja; milik orang lain sama dengan tidak ada.
    const file = this.db.prepare('SELECT file_id, kind, mime, name, size FROM telegram_files WHERE owner_id = ? AND unique_id = ?').get(req.user.id, id) as { file_id: string; kind: string; mime: string; name: string; size: number } | undefined;
    if (!file) throw new NotFoundException({ code: 'not_found', message: 'Lampiran tidak ditemukan.' });
    if (file.size > MAX_DOWNLOAD) throw new HttpException({ code: 'too_big', message: 'File ini lebih dari 20 MB. Buka dari Telegram, ya.' }, 413);
    if (!this.api) throw new ServiceUnavailableException({ code: 'telegram_disabled', message: 'Bot Telegram belum diaktifkan di server.' });
    let stream;
    try {
      const info = await this.api.call<{ file_path?: string; file_size?: number }>('getFile', { file_id: file.file_id });
      if (!info.file_path || (info.file_size || 0) > MAX_DOWNLOAD) throw new Error('no path');
      stream = await this.api.download(info.file_path);
    } catch {
      throw new HttpException({ code: 'telegram_unavailable', message: 'Telegram sedang tidak bisa dihubungi. Coba lagi sebentar, ya.' }, 502);
    }
    const wanted = (file.mime || stream.type || '').split(';')[0].trim().toLowerCase();
    const inline = INLINE.has(wanted);
    const name = (file.name || (file.kind === 'photo' ? 'foto.jpg' : file.kind === 'video' ? 'video.mp4' : 'dokumen')).replace(/[\r\n"]/g, '');
    res.setHeader('Content-Type', inline ? wanted : 'application/octet-stream');
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self'; media-src 'self'");
    res.setHeader('Cache-Control', 'private, max-age=3600');
    if (stream.length) res.setHeader('Content-Length', String(stream.length));
    if (!stream.body) { res.end(); return; }
    Readable.fromWeb(stream.body as any).on('error', () => res.destroy()).pipe(res);
  }
}
