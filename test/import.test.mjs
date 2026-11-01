import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { parseBoiteAChansons, checkUrl } = createRequire(import.meta.url)('../lib/boiteachansons.js');

const a = (c) => `<span class="sI"><span class="a" data-a="${c}" data-aff="${c}" data-i="0"></span></span>`;
const FIXTURE = `<div id="dTitreChanson">DEMO</div><div class="dTitreNomArtiste">
<a href="x">Artiste &amp; Co</a></div>
<input type="hidden" id="tonalite" name="tonalite" value="G"><input type="hidden" id="capo" name="capo" value="2">
<div id="divPartition" class="divPartition"><div class="pLI"><span class="CALI"><span class="ALI"><span class="a" data-a="G" data-aff="G" data-i="0"></span></span></span><span class="CALI"><span class="ALI"><span class="a" data-a="Cm" data-aff="Cm" data-i="1"></span></span></span></div><div class="CALI2"></div><div class="pLVV"></div>
<div class="pL">[Refrain]</div><div class="pL"> ${a('G')}la la ${a('Cm')}l&#39;eau</div><div class="pLVV"></div><div class="pL">${a('D')}fin</div><div class="imgDefilFin"></div>`;

test('import boiteachansons : structure -> ChordPro', () => {
  const s = parseBoiteAChansons(FIXTURE);
  assert.equal(s.title, 'DEMO');
  assert.equal(s.artist, 'Artiste & Co');
  assert.equal(s.key, 'G');
  assert.equal(s.capo, 2);
  assert.equal(s.body, '[G] [Cm]\n\n[Refrain]\n [G]la la [Cm]l\'eau\n\n[D]fin\n');
});

test('import : seules les partitions du site sont autorisées', () => {
  assert.ok(checkUrl('https://www.boiteachansons.net/partitions/radiohead/creep'));
  for (const u of ['http://www.boiteachansons.net/partitions/x', 'https://evil.com/partitions/x', 'https://www.boiteachansons.net/admin', 'https://boiteachansons.net.evil.com/partitions/x', 'nope']) {
    assert.throws(() => checkUrl(u), u);
  }
});

const { pick, publicList, importFromUrl } = createRequire(import.meta.url)('../lib/sources.js');

test('sources : détection automatique et refus des autres sites', async () => {
  assert.equal(pick('https://www.boiteachansons.net/partitions/radiohead/creep').id, 'boiteachansons');
  assert.equal(pick('https://exemple.org/x', 'boiteachansons').id, 'boiteachansons', 'source imposée');
  assert.throws(() => pick('https://exemple.org/x'), /non reconnue/);
  assert.throws(() => pick('https://www.boiteachansons.net/partitions/x/y', 'inconnue'), /inconnue/);
  assert.deepEqual(publicList().map((s) => s.id), ['boiteachansons']);
  await assert.rejects(importFromUrl('https://evil.example/partitions/x', 'boiteachansons'), /acceptées/);
});

test('manifeste : convention node-gateway (public/manifest.json, première icône existante)', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8'));
  assert.ok(manifest.icons[0].src);
  assert.ok(existsSync(new URL(`../public/${manifest.icons[0].src}`, import.meta.url)));
  assert.match(readFileSync(new URL('../public/index.html', import.meta.url), 'utf8'), /rel="manifest" href="manifest\.json"/);
});

test('hors ligne : le service worker précharge exactement les fichiers de public/', async () => {
  const { readFileSync, readdirSync, statSync } = await import('node:fs');
  const root = new URL('../public/', import.meta.url);
  const walk = (dir, base = '') => readdirSync(new URL(dir, root)).flatMap((f) => {
    const rel = base + f;
    return statSync(new URL(rel, root)).isDirectory() ? walk(`${rel}/`, `${rel}/`) : [rel];
  });
  const files = walk('').filter((f) => f !== 'sw.js').sort();
  const sw = readFileSync(new URL('sw.js', root), 'utf8');
  const shell = [...sw.split('const SHELL = [')[1].split('];')[0].matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((f) => f !== './').sort();
  assert.deepEqual(shell, files, 'liste SHELL de sw.js différente des fichiers de public/');
  assert.ok(sw.includes("url.pathname.includes('/api/')"), "l'API ne doit jamais être mise en cache");
});
