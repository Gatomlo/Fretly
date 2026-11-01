import { isChord } from './music.js';

const META_KEYS = ['title', 't', 'artist', 'key', 'capo', 'tempo'];
const SECTION_KEYS = { c: null, comment: null, ci: null, cb: null, section: null, soc: 'Refrain', start_of_chorus: 'Refrain', sov: 'Couplet', start_of_verse: 'Couplet' };

function splitSegments(line) {
  const segs = [];
  const re = /\[([^\]]*)\]/g;
  let idx = 0;
  let chord = null;
  let m;
  while ((m = re.exec(line))) {
    const text = line.slice(idx, m.index);
    if (text || chord !== null) segs.push({ chord, text });
    chord = m[1];
    idx = m.index + m[0].length;
  }
  const tail = line.slice(idx);
  if (tail || chord !== null) segs.push({ chord, text: tail });
  return segs;
}

export function parseSong(text) {
  const meta = {};
  const lines = [];
  for (const raw of (text || '').replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    const d = /^\{\s*(\w+)\s*:?\s*(.*?)\s*\}$/.exec(line);
    if (d) {
      const key = d[1].toLowerCase();
      if (key in SECTION_KEYS) lines.push({ type: 'section', text: d[2] || SECTION_KEYS[key] || '' });
      else if (META_KEYS.includes(key)) meta[key === 't' ? 'title' : key] = d[2];
      continue;
    }
    if (!line.trim()) { lines.push({ type: 'blank' }); continue; }
    const sec = /^\[([^\]]+)\]:?$/.exec(line.trim());
    if (sec && !isChord(sec[1])) { lines.push({ type: 'section', text: sec[1] }); continue; }
    lines.push({ type: 'line', segs: splitSegments(line) });
  }
  return { meta, lines };
}

const isChordLine = (line) => {
  const tokens = line.trim().split(/\s+/);
  return !!line.trim() && tokens.every((t) => isChord(t) || t === '|') && tokens.some(isChord);
};

// Convertit le format « accords au-dessus des paroles » en ChordPro
export function convertChordsOverLyrics(text) {
  const src = text.replace(/\r/g, '').split('\n');
  const out = [];
  for (let i = 0; i < src.length; i++) {
    const line = src[i];
    if (!isChordLine(line)) { out.push(line); continue; }
    const chords = [...line.matchAll(/\S+/g)].filter((m) => m[0] !== '|').map((m) => ({ pos: m.index, sym: m[0] }));
    const next = src[i + 1];
    if (next === undefined || !next.trim() || isChordLine(next) || /^\s*[{[]/.test(next)) {
      out.push(chords.map((c) => `[${c.sym}]`).join(' '));
      continue;
    }
    let lyric = next;
    for (const c of chords.reverse()) {
      if (c.pos > lyric.length) lyric = lyric.padEnd(c.pos);
      lyric = lyric.slice(0, c.pos) + `[${c.sym}]` + lyric.slice(c.pos);
    }
    out.push(lyric.trimEnd());
    i++;
  }
  return out.join('\n');
}
