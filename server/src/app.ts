import 'reflect-metadata';
import { Module, DynamicModule, INestApplication, NestMiddleware, Injectable, MiddlewareConsumer, ForbiddenException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { CONFIG, Config } from './config';
import { DB, Db } from './db';
import { GOOGLE_VERIFIER, GoogleVerifier } from './google';
import { Sessions } from './sessions';
import { AuthController, AuthGuard } from './auth';
import { Items, ItemsController } from './items';

// Perubahan lewat cookie wajib membawa header X-Mimi agar form dari situs lain tidak bisa memalsukannya.
@Injectable()
class CsrfMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (unsafe && !req.headers.authorization && req.headers['x-mimi'] !== '1') {
      throw new ForbiddenException({ code: 'missing_header', message: 'Permintaan ditolak.' });
    }
    next();
  }
}

export function appModule(config: Config, db: Db, google: GoogleVerifier): DynamicModule {
  @Module({})
  class Root {
    configure(consumer: MiddlewareConsumer) { consumer.apply(CsrfMiddleware).forRoutes('*'); }
  }
  return {
    module: Root,
    controllers: [AuthController, ItemsController],
    providers: [
      { provide: CONFIG, useValue: config },
      { provide: DB, useValue: db },
      { provide: GOOGLE_VERIFIER, useValue: google },
      Sessions, Items, AuthGuard,
    ],
  };
}

export async function createApp(config: Config, db: Db, google: GoogleVerifier, log = true): Promise<INestApplication> {
  const app = await NestFactory.create(appModule(config, db, google), { logger: log ? ['error', 'warn'] : false, bodyParser: false });
  const server = app.getHttpAdapter().getInstance() as express.Express;
  server.set('trust proxy', 1);
  server.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    if (req.path.startsWith('/v1/')) res.setHeader('Cache-Control', 'no-store');
    if (log) {
      const start = Date.now();
      // Hanya metode, jalur, status, dan durasi. Tanpa isi permintaan, email, atau token.
      res.on('finish', () => { if (req.path.startsWith('/v1/')) console.log(JSON.stringify({ m: req.method, p: req.path, s: res.statusCode, ms: Date.now() - start })); });
    }
    next();
  });
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => cb(null, !origin || config.allowedOrigins.includes(origin)),
    credentials: false,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Mimi', 'X-Mimi-Client'],
    methods: ['GET', 'POST', 'OPTIONS'],
  });
  if (config.staticDir) {
    const dir = resolve(config.staticDir);
    if (existsSync(dir)) app.use(express.static(dir, { extensions: ['html'], maxAge: '1h' }));
  }
  return app;
}
