import { esc } from './chordDialog.js';

const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// Teinte (0-7) propre à chaque chanson, stable d'une session à l'autre
export const tintOf = (s) => hash(s.title + (s.artist || '')) % 8;

export const cover = (s, extra = '') =>
  `<span class="cover c${tintOf(s)}${extra}">${esc(([...s.title.trim()].find((c) => /\p{L}|\d/u.test(c)) || '♪').toUpperCase())}</span>`;
