import { SEED_SONGS } from './seed.js';

const K = { songs: 'fretly.songs', settings: 'fretly.settings', seeded: 'fretly.seeded' };
const DEFAULTS = { theme: 'auto', fontSize: 20, ref: 440, mode: 'scroll' };

function read(key, def) {
  try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* stockage indisponible */ }
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

export const settings = {
  get: () => ({ ...DEFAULTS, ...read(K.settings, {}) }),
  set(patch) {
    write(K.settings, { ...this.get(), ...patch });
    document.documentElement.dataset.theme = this.get().theme;
  },
};

export const songs = {
  list() {
    if (!read(K.seeded, false)) {
      write(K.songs, [...read(K.songs, []), ...SEED_SONGS.map((s) => ({ ...s, id: uid(), updated: Date.now() }))]);
      write(K.seeded, true);
    }
    return read(K.songs, []);
  },
  get: (id) => songs.list().find((s) => s.id === id),
  save(song) {
    const all = songs.list();
    const saved = { ...song, id: song.id || uid(), updated: Date.now() };
    const i = all.findIndex((s) => s.id === saved.id);
    if (i >= 0) all[i] = saved; else all.push(saved);
    write(K.songs, all);
    return saved;
  },
  remove: (id) => write(K.songs, songs.list().filter((s) => s.id !== id)),
  exportJson: () => JSON.stringify({ app: 'fretly', version: 1, songs: songs.list() }, null, 2),
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
