import { getChord } from './chords.js';
import { transposeChord, prefersFlats } from './music.js';

// Difficulté d'un accord = celle de son doigté le plus simple (barré, doigts posés, cordes étouffées, cordes à vide)
export function chordCost(sym) {
  const c = getChord(sym);
  if (!c) return 4;
  let best = Infinity;
  for (const v of c.voicings) {
    const fretted = v.frets.filter((f) => f > 0).length;
    const muted = v.frets.filter((f) => f === null).length;
    const open = v.frets.filter((f) => f === 0).length;
    const k = fretted * 0.4 + muted * 0.2 - open * 0.1 + (v.barre ? 3 + (v.barre.fret > 5 ? 1 : 0) : 0);
    best = Math.min(best, k);
  }
  return best + (c.approx ? 1.5 : 0);
}

export const easeLabel = (cost) => (cost < 1.4 ? 'très facile' : cost < 2.3 ? 'facile' : 'avec barrés');

// chords : accords tels qu'ils sonnent (répétitions comptées). Renvoie les capos classés du plus simple au plus dur.
export function suggestCapo(chords, { max = 7 } = {}) {
  const counts = new Map();
  for (const s of chords) counts.set(s, (counts.get(s) || 0) + 1);
  if (!counts.size) return [];
  const total = chords.length;
  const first = [...counts.keys()][0];
  const out = [];
  for (let capo = 0; capo <= max; capo++) {
    const flats = prefersFlats(transposeChord(first, -capo));
    let sum = 0;
    const shapes = [];
    for (const [sym, n] of counts) {
      const shape = transposeChord(sym, -capo, flats);
      sum += chordCost(shape) * n;
      if (!shapes.includes(shape)) shapes.push(shape);
    }
    out.push({ capo, cost: sum / total + capo * 0.05, shapes });
  }
  return out.sort((a, b) => a.cost - b.cost || a.capo - b.capo);
}
