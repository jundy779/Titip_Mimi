import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/db';
import { backup } from '../src/backup';

test('backup bisa dipulihkan dan isinya sama, termasuk kepemilikan', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mimi-'));
  const path = join(dir, 'mimi.sqlite');
  const db = openDatabase(path);
  db.prepare("INSERT INTO users (id, google_sub, email, created_at) VALUES ('u1','g1','a@contoh.id',1), ('u2','g2','b@contoh.id',1)").run();
  db.prepare("INSERT INTO items (owner_id, client_id, kind, data, updated_at, seq) VALUES ('u1','nota-0001','note','{\"title\":\"Ambil jahitan\"}',1,1), ('u2','nota-0002','note','{}',1,2)").run();
  const result = await backup(path, join(dir, 'backup'));
  assert.equal(result.ok, true, JSON.stringify(result));
  const restored = openDatabase(result.target);
  const rows = restored.prepare('SELECT owner_id, client_id FROM items ORDER BY seq').all();
  assert.deepEqual(rows, [{ owner_id: 'u1', client_id: 'nota-0001' }, { owner_id: 'u2', client_id: 'nota-0002' }]);
  restored.close(); db.close();
});
