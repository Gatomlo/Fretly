// Synchronisation des données d'un compte (lib/auth.js) : un fichier JSON par utilisateur.
// Fusion par élément : le plus récent (`updated`) gagne ; les suppressions sont des tombstones {id: horodatage}.
const fs = require('fs');
const path = require('path');

const DIR = path.join(process.env.FRETLY_DATA || path.join(__dirname, '..', 'data'), 'sync');
const ID_RE = /^[a-f0-9]{32}$/; // identifiant de compte généré par auth.js

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

const fileFor = (userId) => path.join(DIR, `${userId}.json`);

function load(userId) {
  try { return JSON.parse(fs.readFileSync(fileFor(userId), 'utf8')); } catch { return {}; }
}

function save(userId, state) {
  fs.mkdirSync(DIR, { recursive: true });
  const file = fileFor(userId);
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(state));
  fs.renameSync(`${file}.tmp`, file);
}

function check(userId) {
  if (!ID_RE.test(userId || '')) throw new Error('Identifiant de compte invalide.');
}

function sync(userId, incoming) {
  check(userId);
  const merged = merge(load(userId), incoming || {});
  save(userId, merged);
  return merged;
}

function remove(userId) {
  check(userId);
  try { fs.unlinkSync(fileFor(userId)); } catch { /* rien à supprimer */ }
}

module.exports = { sync, remove, merge, ID_RE };
