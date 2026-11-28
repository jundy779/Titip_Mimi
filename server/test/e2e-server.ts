// Server uji untuk tes browser: verifier Google palsu dan database sementara. Jangan dipakai di produksi.
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { openDatabase } from '../src/db';

const people: Record<string, { sub: string; email: string; emailVerified: boolean; name: string }> = {
  'cred-a': { sub: 'g-111', email: 'iqlima.uji@contoh.id', emailVerified: true, name: 'Uji A' },
  'cred-b': { sub: 'g-222', email: 'jundy.uji@contoh.id', emailVerified: true, name: 'Uji B' },
};
(async () => {
  const config = loadConfig({ STATIC_DIR: process.env.STATIC_DIR, ALLOWED_EMAILS: 'iqlima.uji@contoh.id,jundy.uji@contoh.id' } as NodeJS.ProcessEnv);
  const app = await createApp(config, openDatabase(':memory:'), { async verify(c) { if (!people[c]) throw new Error('x'); return people[c]; } }, false);
  await app.listen(Number(process.env.PORT) || 4400, '127.0.0.1');
  console.log('e2e server siap');
})();
