import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { merge, ID_RE } = createRequire(import.meta.url)('../lib/sync.js');

const song = (id, updated, title = id) => ({ id, updated, title });

test('sync : le plus récent gagne, union des éléments', () => {
  const server = { songs: [song('a', 10, 'vieux'), song('b', 5)], setlists: [], deleted: {}, prefs: { voicings: { C: '1' }, ts: 1 } };
  const client = { songs: [song('a', 20, 'neuf'), song('c', 1)], setlists: [{ id: 's', updated: 3 }], deleted: {}, prefs: { voicings: { C: '2' }, ts: 9 } };
  const m = merge(server, client);
  assert.equal(m.songs.find((s) => s.id === 'a').title, 'neuf');
  assert.deepEqual(m.songs.map((s) => s.id).sort(), ['a', 'b', 'c']);
  assert.equal(m.setlists.length, 1);
  assert.equal(m.prefs.voicings.C, '2');
});

test('sync : une suppression plus récente efface, une modification plus récente ressuscite', () => {
  const server = { songs: [song('a', 10), song('b', 10)], deleted: {} };
  const client = { songs: [], deleted: { a: 50, b: 5 } };
  const m = merge(server, client);
  assert.deepEqual(m.songs.map((s) => s.id), ['b']);
  assert.equal(m.deleted.a, 50);
});

test("sync : format de l'identifiant de compte", () => {
  assert.ok(ID_RE.test('0123456789abcdef0123456789abcdef'));
  for (const k of ['court', 'ABCDEF0123456789ABCDEF0123456789', '../../etc/passwd1234567890123456', '0123456789abcdef0123456789abcdeg']) assert.ok(!ID_RE.test(k), k);
});
