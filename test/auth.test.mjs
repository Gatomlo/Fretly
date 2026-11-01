import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'fretly-'));
process.env.FRETLY_DATA = dir;
process.env.FRETLY_PUBLIC_URL = 'https://exemple.be/fretly';
const require = createRequire(import.meta.url);
const app = require('../server.js');
const auth = require('../lib/auth.js');

let server;
let base;
before(async () => { server = app.listen(0); await new Promise((r) => server.once('listening', r)); base = `http://127.0.0.1:${server.address().port}`; });
after(() => { server.close(); rmSync(dir, { recursive: true, force: true }); });

// Mini client avec cookie
function client() {
  let cookie = '';
  return async (method, path, body) => {
    const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(cookie && { cookie }) }, body: body && JSON.stringify(body) });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    return { status: res.status, json: await res.json().catch(() => ({})), setCookie: set };
  };
}
const token = (link, key) => new RegExp(`[?&]${key}=([^&]+)`).exec(link)[1];

test('premier compte libre = admin, cookie HttpOnly limité au chemin', async () => {
  const a = client();
  assert.equal((await a('GET', '/api/auth/session')).json.firstRun, true);
  assert.equal((await a('POST', '/api/auth/register', { email: 'a@x.be', password: 'court' })).status, 400);
  const r = await a('POST', '/api/auth/register', { email: 'Admin@X.be', name: 'Admin', password: 'motdepasse1' });
  assert.equal(r.status, 201);
  assert.equal(r.json.user.role, 'admin');
  assert.equal(r.json.user.email, 'admin@x.be');
  assert.match(r.setCookie, /HttpOnly/);
  assert.match(r.setCookie, /SameSite=Lax/);
  const s = await a('GET', '/api/auth/session');
  assert.equal(s.json.user.email, 'admin@x.be');
  assert.equal(s.json.firstRun, false);
});

test('ensuite : inscription impossible sans invitation, possible avec lien (usage unique)', async () => {
  const admin = client();
  await admin('POST', '/api/auth/login', { email: 'admin@x.be', password: 'motdepasse1' });
  const anon = client();
  assert.equal((await anon('POST', '/api/auth/register', { email: 'b@x.be', password: 'motdepasse2' })).status, 400);
  const inv = await admin('POST', '/api/auth/invite');
  assert.match(inv.json.link, /^https:\/\/exemple\.be\/fretly\/#\/login\?invite=/);
  const t = token(inv.json.link, 'invite');
  const b = client();
  assert.equal((await b('POST', '/api/auth/register', { email: 'b@x.be', password: 'motdepasse2', invite: t })).status, 201);
  assert.equal((await client()('POST', '/api/auth/register', { email: 'c@x.be', password: 'motdepasse3', invite: t })).status, 400, 'lien déjà utilisé');
  assert.equal((await b('POST', '/api/auth/invite')).status, 403, 'un simple utilisateur ne peut pas inviter');
  assert.equal((await b('GET', '/api/auth/users')).status, 403);
  assert.equal((await admin('GET', '/api/auth/users')).json.length, 2);
});

test('connexion : mauvais mot de passe refusé, déconnexion ferme la session', async () => {
  const c = client();
  assert.equal((await c('POST', '/api/auth/login', { email: 'admin@x.be', password: 'faux-faux-faux' })).status, 401);
  assert.equal((await c('POST', '/api/auth/login', { email: 'inconnu@x.be', password: 'motdepasse1' })).status, 401);
  assert.equal((await c('POST', '/api/auth/login', { email: 'admin@x.be', password: 'motdepasse1' })).status, 200);
  assert.equal((await c('POST', '/api/sync', { songs: [] })).status, 200);
  await c('POST', '/api/auth/logout');
  assert.equal((await c('GET', '/api/auth/session')).json.user, null);
  assert.equal((await c('POST', '/api/sync', { songs: [] })).status, 401);
});

test('sync : chaque compte a ses propres données', async () => {
  const a = client();
  const b = client();
  await a('POST', '/api/auth/login', { email: 'admin@x.be', password: 'motdepasse1' });
  await b('POST', '/api/auth/login', { email: 'b@x.be', password: 'motdepasse2' });
  await a('POST', '/api/sync', { songs: [{ id: 's1', title: 'A', updated: 5 }] });
  assert.equal((await a('POST', '/api/sync', {})).json.songs.length, 1);
  assert.equal((await b('POST', '/api/sync', {})).json.songs.length, 0);
});

test('import et sync exigent un compte', async () => {
  const anon = client();
  assert.equal((await anon('GET', '/api/import?url=https://www.boiteachansons.net/partitions/x/y')).status, 401);
  assert.equal((await anon('POST', '/api/sync', {})).status, 401);
});

test('réinitialisation par lien (admin) : change le mot de passe et ferme les anciennes sessions', async () => {
  const admin = client();
  const b = client();
  await admin('POST', '/api/auth/login', { email: 'admin@x.be', password: 'motdepasse1' });
  await b('POST', '/api/auth/login', { email: 'b@x.be', password: 'motdepasse2' });
  const users = (await admin('GET', '/api/auth/users')).json;
  const bUser = users.find((u) => u.email === 'b@x.be');
  const link = (await admin('POST', '/api/auth/reset', { userId: bUser.id })).json.link;
  assert.match(link, /#\/reset\?token=/);
  const t = token(link, 'token');
  const fresh = client();
  assert.equal((await fresh('POST', '/api/auth/reset-confirm', { token: t, password: 'nouveaumdp9' })).status, 200);
  assert.equal((await b('GET', '/api/auth/session')).json.user, null, 'ancienne session fermée');
  assert.equal((await fresh('POST', '/api/auth/reset-confirm', { token: t, password: 'encoreautre9' })).status, 400, 'lien à usage unique');
  assert.equal((await client()('POST', '/api/auth/login', { email: 'b@x.be', password: 'nouveaumdp9' })).status, 200);
});

test("changement de mot de passe, suppression d'un utilisateur, mot de passe de secours", async () => {
  const admin = client();
  await admin('POST', '/api/auth/login', { email: 'admin@x.be', password: 'motdepasse1' });
  assert.equal((await admin('POST', '/api/auth/password', { current: 'faux', password: 'autremdp123' })).status, 403);
  assert.equal((await admin('POST', '/api/auth/password', { current: 'motdepasse1', password: 'autremdp123' })).status, 200);
  await auth.setPasswordFor('admin@x.be', 'secours-1234');
  assert.equal((await admin('GET', '/api/auth/session')).json.user, null, 'sessions fermées par le mot de passe de secours');
  const a2 = client();
  assert.equal((await a2('POST', '/api/auth/login', { email: 'admin@x.be', password: 'secours-1234' })).status, 200);
  const users = (await a2('GET', '/api/auth/users')).json;
  const self = users.find((u) => u.email === 'admin@x.be');
  assert.equal((await a2('DELETE', `/api/auth/users/${self.id}`)).status, 400);
  const other = users.find((u) => u.email === 'b@x.be');
  assert.equal((await a2('DELETE', `/api/auth/users/${other.id}`)).status, 200);
  assert.equal(existsSync(join(dir, 'sync', `${other.id}.json`)), false);
  assert.equal((await a2('GET', '/api/auth/users')).json.length, 1);
});
