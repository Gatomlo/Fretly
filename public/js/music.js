export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const ALIAS = { Db: 1, Eb: 3, Gb: 6, Ab: 8, Bb: 10, Cb: 11, Fb: 4, 'E#': 5, 'B#': 0 };

export function noteIndex(name) {
  return name in ALIAS ? ALIAS[name] : NOTES.indexOf(name);
}

export function noteName(i, flats = false) {
  return (flats ? FLATS : NOTES)[((i % 12) + 12) % 12];
}

const CHORD_RE = /^([A-G][#b]?)([^/\s]*)(?:\/([A-G][#b]?))?$/;
const SUFFIX_RE = /^(?:maj|min|dim|aug|add|sus|m|M|\+|°|Δ|-|\d|\(|\)|#|b)*$/;

export function parseChord(sym) {
  const m = CHORD_RE.exec(sym || '');
  if (!m || !SUFFIX_RE.test(m[2]) || noteIndex(m[1]) < 0) return null;
  return { root: m[1], suffix: m[2], bass: m[3] || null };
}

export function isChord(sym) {
  return parseChord(sym) !== null;
}

export function transposeChord(sym, steps, flats = false) {
  const c = parseChord(sym);
  if (!c) return sym;
  const root = noteName(noteIndex(c.root) + steps, flats);
  const bass = c.bass ? '/' + noteName(noteIndex(c.bass) + steps, flats) : '';
  return root + c.suffix + bass;
}

// Tonalités où l'usage courant préfère les bémols (F, Bb, Eb, Ab, Db)
export function prefersFlats(rootSym) {
  const c = parseChord(rootSym);
  return !!c && [5, 10, 3, 8, 1].includes(noteIndex(c.root));
}
