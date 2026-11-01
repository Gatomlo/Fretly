import { NOTES, noteIndex, parseChord } from './music.js';

export const QUALITIES = [
  ['', 'Majeur'], ['m', 'Mineur'], ['7', '7'], ['maj7', 'maj7'], ['m7', 'm7'],
  ['sus2', 'sus2'], ['sus4', 'sus4'], ['dim', 'dim'], ['dim7', 'dim7'], ['aug', 'aug'],
  ['6', '6'], ['m6', 'm6'], ['9', '9'], ['add9', 'add9'],
];

const ALIASES = {
  '': '', maj: '', M: '', m: 'm', min: 'm', '-': 'm', 7: '7', dom7: '7',
  maj7: 'maj7', M7: 'maj7', 'Δ': 'maj7', 'Δ7': 'maj7', m7: 'm7', min7: 'm7', '-7': 'm7',
  sus: 'sus4', sus4: 'sus4', sus2: 'sus2', dim: 'dim', '°': 'dim', dim7: 'dim7', '°7': 'dim7',
  aug: 'aug', '+': 'aug', 6: '6', m6: 'm6', 9: '9', add9: 'add9',
};

// Gabarits mobiles : décalages de frettes par rapport à la fret de la fondamentale
// (6 cordes, de la grave à l'aiguë ; null = corde non jouée)
const E_FORM = {
  '': [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], 7: [0, 2, 0, 1, 0, 0],
  maj7: [0, 2, 1, 1, 0, 0], m7: [0, 2, 0, 0, 0, 0], sus4: [0, 2, 2, 2, 0, 0],
  6: [0, 2, 2, 1, 2, 0], m6: [0, 2, 2, 0, 2, 0], 9: [0, 2, 0, 1, 0, 2],
};
const A_FORM = {
  '': [null, 0, 2, 2, 2, 0], m: [null, 0, 2, 2, 1, 0], 7: [null, 0, 2, 0, 2, 0],
  maj7: [null, 0, 2, 1, 2, 0], m7: [null, 0, 2, 0, 1, 0], sus2: [null, 0, 2, 2, 0, 0],
  sus4: [null, 0, 2, 2, 3, 0], dim: [null, 0, 1, 2, 1, null], dim7: [null, 0, 1, 2, 1, 2],
  aug: [null, 0, 3, 2, 2, 1], 6: [null, 0, 2, 2, 2, 2], m6: [null, 0, 2, 2, 1, 2],
  add9: [null, 0, 2, 4, 2, 0], 9: [null, 0, -1, 0, 0, 0],
};
// Positions ouvertes qui ne découlent pas des gabarits
const OPEN = {
  C: 'x32010', D: 'xx0232', G: '320003', Dm: 'xx0231', C7: 'x32310', D7: 'xx0212',
  G7: '320001', B7: 'x21202', Cmaj7: 'x32000', Dmaj7: 'xx0222', Gmaj7: '320002',
  Dm7: 'xx0211', Dsus2: 'xx0230', Dsus4: 'xx0233', Cadd9: 'x32030', G6: '320000',
  C6: 'x32210', D6: 'xx0202', Bm7: 'x20202', Gsus4: '330013',
  'D/F#': '2x0232', 'G/B': 'x20003', 'C/G': '332010', 'A/C#': 'x42220',
  'Am/G': '302210', 'Em/B': 'x22000', 'D/A': 'x00232',
};

function parseFrets(s) {
  return [...s].map((c) => (c === 'x' ? null : Number(c)));
}

function make(frets, allowBarre) {
  let barre = null;
  const fretted = frets.filter((f) => f > 0);
  if (allowBarre && fretted.length) {
    const min = Math.min(...fretted);
    const idx = frets.map((f, i) => (f === min ? i : -1)).filter((i) => i >= 0);
    const [from, to] = [idx[0], idx[idx.length - 1]];
    if (idx.length >= 2 && !frets.slice(from, to + 1).includes(0)) barre = { fret: min, from, to };
  }
  return { frets, barre };
}

const position = (v) => Math.min(...v.frets.filter((f) => f > 0), 99);

export function normalizeQuality(suffix) {
  return suffix in ALIASES ? ALIASES[suffix] : null;
}

export function voicingsFor(rootName, quality, bassName = null) {
  const root = noteIndex(rootName);
  const out = [];
  const seen = new Set();
  const add = (frets, barre) => {
    const k = frets.join(',');
    if (!seen.has(k)) { seen.add(k); out.push(make(frets, barre)); }
  };
  if (bassName) {
    const slash = OPEN[`${NOTES[root]}${quality}/${NOTES[noteIndex(bassName)]}`];
    if (slash) add(parseFrets(slash), false);
  }
  const open = OPEN[NOTES[root] + quality];
  if (open) add(parseFrets(open), false);
  for (const [form, rootString] of [[E_FORM, 4], [A_FORM, 9]]) {
    const tpl = form[quality];
    if (!tpl) continue;
    const r = (root - rootString + 12) % 12;
    const frets = tpl.map((o) => (o === null ? null : o + r));
    if (frets.some((f) => f !== null && f < 0)) continue;
    add(frets, r > 0);
  }
  return out.sort((a, b) => position(a) - position(b));
}

export function getChord(sym) {
  const c = parseChord(sym);
  if (!c) return null;
  const quality = normalizeQuality(c.suffix);
  if (quality === null) return null;
  const voicings = voicingsFor(c.root, quality, c.bass);
  return voicings.length ? { symbol: sym, root: c.root, quality, bass: c.bass, voicings } : null;
}
