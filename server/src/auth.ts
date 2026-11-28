import { Body, CanActivate, Controller, ExecutionContext, ForbiddenException, Get, HttpCode, Inject, Injectable, Post, Req, Res, ServiceUnavailableException, HttpException, HttpStatus, UnauthorizedException, UseGuards, BadRequestException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CONFIG, Config } from './config';
import { GOOGLE_VERIFIER, GoogleVerifier } from './google';
import { Sessions, User } from './sessions';

export const COOKIE = 'mimi_session';
export type AuthedRequest = Request & { user: User; sessionToken: string };

export function tokenOf(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  return (req as Request & { cookies?: Record<string, string> }).cookies?.[COOKIE];
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private sessions: Sessions) {}
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = tokenOf(req);
    const user = this.sessions.find(token);
    if (!user || !token) throw new UnauthorizedException({ code: 'session_expired', message: 'Sesi berakhir. Masuk lagi, ya.' });
    req.user = user;
    req.sessionToken = token;
    return true;
  }
}

@Controller('v1')
export class AuthController {
  constructor(private sessions: Sessions, @Inject(GOOGLE_VERIFIER) private google: GoogleVerifier, @Inject(CONFIG) private config: Config) {}

  // Batas sederhana untuk login: 10 percobaan per menit per alamat.
  private attempts = new Map<string, number[]>();
  private limited(key: string, now = Date.now()) {
    const recent = (this.attempts.get(key) || []).filter(t => now - t < 60000);
    recent.push(now);
    this.attempts.set(key, recent);
    if (this.attempts.size > 5000) this.attempts.clear();
    return recent.length > 10;
  }

  @Post('auth/google')
  @HttpCode(200)
  async login(@Body() body: { credential?: unknown }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (this.limited(req.ip || 'unknown')) throw new HttpException({ code: 'too_many', message: 'Terlalu sering. Tunggu sebentar, ya.' }, HttpStatus.TOO_MANY_REQUESTS);
    if (typeof body?.credential !== 'string' || body.credential.length > 4096) throw new BadRequestException({ code: 'bad_credential', message: 'Data masuk Google tidak valid.' });
    let identity;
    try { identity = await this.google.verify(body.credential); }
    catch (error) {
      if (error instanceof Error && /GOOGLE_CLIENT_ID/.test(error.message)) throw new ServiceUnavailableException({ code: 'login_disabled', message: 'Login Google belum diaktifkan di server.' });
      throw new UnauthorizedException({ code: 'google_rejected', message: 'Google belum bisa memastikan akunmu. Coba lagi, ya.' });
    }
    if (!identity.emailVerified) throw new UnauthorizedException({ code: 'email_unverified', message: 'Email Google ini belum terverifikasi.' });
    const email = identity.email.toLowerCase();
    if (this.config.allowedEmails.length && !this.config.allowedEmails.includes(email)) {
      throw new ForbiddenException({ code: 'not_invited', message: 'Akun ini belum diundang ke Titip Mimi.' });
    }
    const user = this.sessions.upsertUser({ ...identity, email });
    const { token, expiresAt } = this.sessions.create(user.id);
    res.cookie(COOKIE, token, { httpOnly: true, secure: this.config.cookieSecure, sameSite: 'lax', path: '/', expires: new Date(expiresAt) });
    // Aplikasi HP dan web di domain lain meminta token agar bisa memakai header Authorization.
    const wantsToken = req.headers['x-mimi-client'] === 'token';
    return { user: { id: user.id, name: user.name, email: user.email }, expiresAt, ...(wantsToken ? { token } : {}) };
  }

  @Post('auth/logout')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  logout(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    this.sessions.revoke(req.sessionToken);
    res.clearCookie(COOKIE, { path: '/' });
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: AuthedRequest) {
    const { id, name, email, timezone } = req.user;
    return { id, name, email, timezone };
  }
}
