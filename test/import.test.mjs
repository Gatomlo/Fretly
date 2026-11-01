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
