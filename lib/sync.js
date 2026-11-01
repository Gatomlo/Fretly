// Synchronisation sans compte : chaque « code » secret désigne un espace de stockage (sha256 du code).
// Fusion par élément : le plus récent (`updated`) gagne ; les suppressions sont des tombstones {id: horodatage}.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = path.join(process.env.FRETLY_DATA || path.join(__dirname, '..', 'data'), 'sync');
const KEY_RE = /^[A-Za-z0-9_-]{16,64}$/;

const stamp = (it) => Number(it.updated) || 0;

function merge(a = {}, b = {}) {
  const deleted = {};
  for (const d of [a.deleted, b.deleted]) {
    for (const [id, ts] of Object.entries(d || {})) deleted[id] = Math.max(deleted[id] || 0, Number(ts) || 0);
  }
  const pick = (...lists) => {
    const best = new Map();
    for (const it of lists.flat()) {
      if (!it || typeof it.id !== 'string') continue;
      const old = best.get(it.id);
      if (!old || stamp(it) > stamp(old)) best.set(it.id, it);
    }
    return [...best.values()].filter((it) => !(deleted[it.id] >= stamp(it)));
  };
  const pa = a.prefs || {};
  const pb = b.prefs || {};
  const prefs = (pb.ts || 0) > (pa.ts || 0) ? pb : pa;
  return {
    songs: pick(a.songs || [], b.songs || []),
    setlists: pick(a.setlists || [], b.setlists || []),
    deleted,
    prefs: { voicings: prefs.voicings || {}, ts: prefs.ts || 0 },
  };
}

const fileFor = (key) => path.join(DIR, `${crypto.createHash('sha256').update(key).digest('hex')}.json`);

function load(key) {
  try { return JSON.parse(fs.readFileSync(fileFor(key), 'utf8')); } catch { return {}; }
}

function save(key, state) {
  fs.mkdirSync(DIR, { recursive: true });
  const file = fileFor(key);
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(state));
  fs.renameSync(`${file}.tmp`, file);
}

function sync(key, incoming) {
  if (!KEY_RE.test(key || '')) throw new Error('Code de synchronisation invalide (16 à 64 caractères : lettres, chiffres, - ou _)');
  const merged = merge(load(key), incoming || {});
  save(key, merged);
  return merged;
}

module.exports = { sync, merge, KEY_RE };
