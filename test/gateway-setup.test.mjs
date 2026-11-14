// Derriere node-gateway, c'est elle qui authentifie : le premier visiteur (anonyme ou simple membre) ne peut plus creer
// le premier compte et s'approprier l'outil ; l'admin de la passerelle le peut. Hors passerelle : comportement inchange.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';

const dir = mkdtempSync(join(tmpdir(), 'fretly-setup-'));
process.env.FRETLY_DATA = dir;
const require = createRequire(import.meta.url);
const express = require('express');
const app = require('../server.js');
const gw = (role, user) => ({ 'x-test-gateway': JSON.stringify({ app: 'fretly', role, user: user === undefined ? { login: 'anim', name: 'Anim', email: 'anim@exemple.be', isSuper: false } : user }) });

test('creation du premier compte derriere la passerelle', async () => {
  const outer = express();
  outer.use((req, res, next) => { const h = req.get('x-test-gateway'); if (h) req.gateway = JSON.parse(h); next(); });
  outer.use('/fretly', app);
  const srv = http.createServer(outer);
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const reg = (h) => fetch(`http://127.0.0.1:${srv.address().port}/fretly/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify({ email: 'thomas@exemple.be', name: 'Thomas', password: 'motdepasse1' }) });
  try {
    assert.equal((await reg(gw(null, null))).status, 403, 'anonyme');
    assert.equal((await reg(gw('member'))).status, 403, 'simple membre');
    const file = join(dir, 'auth.json');
    assert.equal(existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).users.length : 0, 0, 'rien cree');
    assert.ok((await reg(gw('admin'))).status < 300, 'admin de la passerelle');
  } finally { srv.close(); rmSync(dir, { recursive: true, force: true }); }
});
