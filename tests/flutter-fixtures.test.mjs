// Berkas acuan Flutter dibuat dari logika web. Kalau web berubah, berkas acuan harus dibuat ulang
// (node mobile/tool/make_fixtures.mjs) supaya tes Flutter menangkap perbedaan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

test('acuan Flutter sama dengan logika web saat ini', () => {
  const fresh = execFileSync(process.execPath, [new URL('../mobile/tool/make_fixtures.mjs', import.meta.url).pathname, '--check'], { env: { ...process.env, TZ: 'Asia/Jakarta' } }).toString();
  const saved = readFileSync(new URL('../mobile/test/fixtures/iqlima_cases.json', import.meta.url), 'utf8');
  assert.equal(saved, fresh, 'Jalankan: TZ=Asia/Jakarta node mobile/tool/make_fixtures.mjs');
});
