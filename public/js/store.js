import { SEED_SONGS } from './seed.js';

const K = { songs: 'fretly.songs', sets: 'fretly.sets', deleted: 'fretly.deleted', settings: 'fretly.settings', seeded: 'fretly.seeded' };
const DEFAULTS = {
  theme: 'auto', fontSize: 20, ref: 440, mode: 'scroll', strip: true, last: null,
  sort: 'title', importSource: '', stage: false, showOrig: false, voicings: {}, voicingsTs: 0,
};

function read(key, def) {
  try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* stockage indisponible */ }
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

function markDeleted(id) {
  write(K.deleted, { ...read(K.deleted, {}), [id]: Date.now() });
}

export const settings = {
  get: () => ({ ...DEFAULTS, ...read(K.settings, {}) }),
  set(patch) {
    const next = { ...this.get(), ...patch };
    if (patch.voicings) next.voicingsTs = Date.now();
    write(K.settings, next);
    document.documentElement.dataset.theme = next.theme;
    if (patch.voicings) sync.schedule();
  },
};

export const songs = {
  list() {
    if (!read(K.seeded, false)) {
      const have = new Set(read(K.songs, []).map((s) => s.id));
      write(K.songs, [...read(K.songs, []), ...SEED_SONGS.filter((s) => !have.has(s.id)).map((s) => ({ ...s, updated: 1 }))]);
      write(K.seeded, true);
    }
    return read(K.songs, []);
  },
  get: (id) => songs.list().find((s) => s.id === id),
  save(song, { quiet = false } = {}) {
    const all = songs.list();
    const saved = { ...song, id: song.id || uid(), updated: Date.now() };
    const i = all.findIndex((s) => s.id === saved.id);
    if (i >= 0) all[i] = saved; else all.push(saved);
    write(K.songs, all);
    if (!quiet) sync.schedule();
    return saved;
  },
  remove(id) {
    write(K.songs, songs.list().filter((s) => s.id !== id));
    markDeleted(id);
    // une chanson supprimée disparaît aussi des setlists
    for (const set of sets.list()) if (set.songIds.includes(id)) sets.save({ ...set, songIds: set.songIds.filter((x) => x !== id) });
    sync.schedule();
  },
  exportJson: () => JSON.stringify({ app: 'fretly', version: 2, songs: songs.list(), setlists: sets.list() }, null, 2),
  importJson(text) {
    const data = JSON.parse(text);
    if (!Array.isArray(data.songs)) throw new Error('Fichier invalide');
    const known = new Set(songs.list().map((s) => s.id));
    let added = 0;
    for (const s of data.songs) {
      if (!s.body || known.has(s.id)) continue;
      songs.save({ ...s, id: s.id || undefined });
      added++;
    }
    return added;
  },
};

export const sets = {
  list: () => read(K.sets, []),
  get: (id) => sets.list().find((s) => s.id === id),
  save(set) {
    const all = sets.list();
    const saved = { songIds: [], ...set, id: set.id || uid(), updated: Date.now() };
    const i = all.findIndex((s) => s.id === saved.id);
    if (i >= 0) all[i] = saved; else all.push(saved);
    write(K.sets, all);
    sync.schedule();
    return saved;
  },
  remove(id) {
    write(K.sets, sets.list().filter((s) => s.id !== id));
    markDeleted(id);
    sync.schedule();
  },
};

// État du compte (rempli par account.js) : la synchronisation n'a lieu que connecté
export const account = { user: null, firstRun: false, available: true, loaded: false, returnTo: null };

let timer;
export const sync = {
  onChange: null,
  lastOk: 0,
  state: () => ({
    songs: songs.list(),
    setlists: sets.list(),
    deleted: read(K.deleted, {}),
    prefs: { voicings: settings.get().voicings, ts: settings.get().voicingsTs },
  }),
  schedule() {
    if (!account.user) return;
    clearTimeout(timer);
    timer = setTimeout(() => sync.run().catch(() => {}), 1500);
  },
  // Envoie l'état local, reçoit l'état fusionné ; renvoie true si quelque chose a changé ici
  async run() {
    if (!account.user) return false;
    const res = await fetch('api/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sync.state()) });
    if (res.status === 401) { account.user = null; throw new Error('Session expirée : reconnectez-vous.'); }
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Erreur ${res.status}`);
    const merged = await res.json();
    const before = JSON.stringify([songs.list(), sets.list()]);
    write(K.songs, merged.songs);
    write(K.sets, merged.setlists);
    write(K.deleted, merged.deleted);
    if (merged.prefs && merged.prefs.ts > settings.get().voicingsTs) {
      write(K.settings, { ...settings.get(), voicings: merged.prefs.voicings, voicingsTs: merged.prefs.ts });
    }
    sync.lastOk = Date.now();
    const changed = before !== JSON.stringify([songs.list(), sets.list()]);
    if (changed) sync.onChange?.();
    return changed;
  },
};
