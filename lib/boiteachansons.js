// Import d'une partition boiteachansons.net -> chanson Fretly (ChordPro). Sans dépendance.
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

const decode = (s) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') {
    const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : m;
  }
  return ENTITIES[e.toLowerCase()] ?? m;
});

const chordOf = (tag) => {
  const m = /data-aff="([^"]*)"/.exec(tag) || /data-a="([^"]*)"/.exec(tag);
  return m ? decode(m[1]) : '';
};

// Remplace chaque <span class="a" data-a="X"> par [X], puis retire les autres balises
function lineToChordPro(html) {
  const withChords = html.replace(/<span[^>]*class="a"[^>]*>\s*<\/span>/g, (tag) => `[${chordOf(tag)}]`);
  return decode(withChords.replace(/<[^>]+>/g, '')).replace(/\s+$/, '');
}

const hidden = (html, id) => {
  const m = new RegExp(`id="${id}"[^>]*value="([^"]*)"`).exec(html);
  return m ? decode(m[1]).trim() : '';
};

function parseBoiteAChansons(html) {
  const title = decode(((/id="dTitreChanson"[^>]*>([^<]*)</.exec(html) || [])[1] || '')).trim();
  const artist = decode(((/class="dTitreNomArtiste"[^>]*>\s*<a[^>]*>([^<]*)</.exec(html) || [])[1] || '')).trim();
  const start = html.indexOf('id="divPartition"');
  if (!title || start < 0) throw new Error('Partition introuvable sur cette page');
  const end = html.indexOf('imgDefilFin', start);
  const zone = html.slice(start, end > start ? end : undefined);

  const out = [];
  const re = /<div class="(pLI|pL|pLVV)"[^>]*>([\s\S]*?)<\/div>/g;
  let m;
  while ((m = re.exec(zone))) {
    if (m[1] === 'pLVV') { if (out.length && out[out.length - 1] !== '') out.push(''); continue; }
    const line = lineToChordPro(m[2]);
    if (m[1] === 'pLI') out.push(line.replace(/\]\[/g, '] ['));
    else out.push(line);
  }
  const body = out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  const capo = parseInt(hidden(html, 'capo'), 10) || 0;
  return { title, artist, key: hidden(html, 'tonalite'), capo, body };
}

const ALLOWED_HOSTS = new Set(['www.boiteachansons.net', 'boiteachansons.net']);

function checkUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error('Adresse invalide'); }
  if (u.protocol !== 'https:' || !ALLOWED_HOSTS.has(u.hostname) || !u.pathname.startsWith('/partitions/')) {
    throw new Error('Seules les adresses https://www.boiteachansons.net/partitions/… sont acceptées');
  }
  return u;
}

async function importFromUrl(raw) {
  const u = checkUrl(raw);
  const res = await fetch(u, { headers: { 'User-Agent': 'Fretly/0.1 (usage personnel)' }, redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Le site a répondu ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > 2_000_000) throw new Error('Page trop volumineuse');
  return parseBoiteAChansons(new TextDecoder('utf-8').decode(buf));
}

module.exports = { parseBoiteAChansons, importFromUrl, checkUrl };
