// Pont avec la connexion centralisee de node-gateway : req.gateway (pose par la passerelle) ouvre une
// session locale COURTE pour le compte de meme e-mail, sans jamais creer de compte. Hors passerelle : inchange.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';

const dir = mkdtempSync(join(tmpdir(), 'fretly-gw-'));
process.env.FRETLY_DATA = dir;
const require = createRequire(import.meta.url);
const express = require('express');
const app = require('../server.js');
const auth = require('../lib/auth.js');

let bridge, base;
const gw = (email, role = 'member') => ({ 'x-test-gateway': JSON.stringify({ app: 'fretly', role, user: { login: 'x', name: 'X', email, isSuper: false } }) });
const session = (headers = {}) => fetch(base + '/api/auth/session', { headers });

before(async () => {
  const outer = express();
  outer.use((req, res, next) => { const h = req.get('x-test-gateway'); if (h) req.gateway = JSON.parse(h); next(); });
  outer.use('/fretly', app);
  bridge = http.createServer(outer);
  await new Promise((r) => bridge.listen(0, r));
  base = `http://127.0.0.1:${bridge.address().port}/fretly`;
  try {
    const r = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'thomas@exemple.be', name: 'Thomas', password: 'motdepasse1' }) });
    assert.ok(r.status < 300, 'inscription ' + r.status);
  } catch (e) { bridge.close(); throw e; }
});
after(() => { bridge.close(); rmSync(dir, { recursive: true, force: true }); });

test('e-mail de la passerelle -> compte local de meme e-mail (session courte, limitee au chemin)', async () => {
  const r = await session(gw('THOMAS@exemple.be'));
  const j = await r.json();
  assert.equal(j.user && j.user.email, 'thomas@exemple.be');
  const cookie = r.headers.get('set-cookie');
  assert.match(cookie, /Path=\/fretly\//);
  assert.match(cookie, /Max-Age=7200\b/);
  assert.match(cookie, /HttpOnly/);
});

test('aucun compte cree : e-mail inconnu, sans e-mail, anonyme ou sans droit => pas connecte', async () => {
  for (const h of [gw('inconnu@exemple.be'), gw(''), {}, { 'x-test-gateway': JSON.stringify({ app: 'fretly', role: null, user: { login: 'x', email: 'thomas@exemple.be' } }) }]) {
    assert.equal((await (await session(h)).json()).user, null);
  }
  const { users } = JSON.parse(require('node:fs').readFileSync(join(dir, 'auth.json'), 'utf8'));
  assert.equal(users.length, 1);
});

test('compte local choisi par l\'administrateur de la passerelle (e-mail different) ; un mauvais choix n\'ouvre rien', async () => {
  const withLocal = (email, local) => ({ 'x-test-gateway': JSON.stringify({ app: 'fretly', role: 'member', local, user: { login: 'x', name: 'X', email, isSuper: false } }) });
  assert.equal((await (await session(withLocal('autre@perso.be', 'thomas@exemple.be'))).json()).user.email, 'thomas@exemple.be', 'rattache a un e-mail different');
  assert.equal((await (await session(withLocal(null, 'THOMAS@exemple.be'))).json()).user.email, 'thomas@exemple.be', 'meme sans e-mail cote passerelle');
  assert.equal((await (await session(withLocal('thomas@exemple.be', 'inconnu@exemple.be'))).json()).user, null, 'pas de repli sur l\'e-mail identique');
});

test('crochet gatewayAccounts : liste des comptes pour l\'administration de la passerelle, sans aucun secret', () => {
  const list = app.gatewayAccounts();
  assert.ok(Array.isArray(list) && list.length >= 1, 'au moins un compte');
  for (const a of list) {
    assert.ok(a.key, 'cle a saisir dans « compte local »');
    assert.doesNotMatch(JSON.stringify(a), /hash|passw|token|secret|scrypt|bcrypt/i);
  }
});
