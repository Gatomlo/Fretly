// Registre des sites d'où l'on peut importer des partitions. Pour en ajouter un :
// 1. créer lib/<site>.js avec `checkUrl(raw)` (valide l'adresse, lève une erreur sinon) et `parse(html)`
//    (renvoie { title, artist, key, capo, tempo, body } où body est en ChordPro) ;
// 2. l'ajouter à SOURCES ci-dessous. L'écran d'import et l'éditeur proposent alors le nouveau site.
const bac = require('./boiteachansons');

const SOURCES = [
  {
    id: 'boiteachansons',
    name: 'La Boîte à chansons',
    example: 'https://www.boiteachansons.net/partitions/artiste/titre',
    check: bac.checkUrl,
    parse: bac.parseBoiteAChansons,
  },
];

const publicList = () => SOURCES.map(({ id, name, example }) => ({ id, name, example }));

// Source choisie explicitement, sinon détectée d'après l'adresse
function pick(raw, id) {
  if (id) {
    const s = SOURCES.find((x) => x.id === id);
    if (!s) throw new Error('Source inconnue.');
    return s;
  }
  for (const s of SOURCES) {
    try { s.check(raw); return s; } catch { /* essai suivant */ }
  }
  throw new Error('Adresse non reconnue : aucun site pris en charge ne correspond.');
}

async function importFromUrl(raw, sourceId) {
  const src = pick(raw, sourceId);
  const url = src.check(raw);
  const res = await fetch(url, { headers: { 'User-Agent': 'Fretly/0.1 (usage personnel)' }, redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Le site a répondu ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > 2_000_000) throw new Error('Page trop volumineuse');
  return { ...src.parse(new TextDecoder('utf-8').decode(buf)), source: src.id };
}

module.exports = { SOURCES, publicList, pick, importFromUrl };
