// Diagramme d'accord en SVG. voicing = { frets: [6], barre: {fret, from, to} | null }
export function chordSvg(v, label = '') {
  const fretted = v.frets.filter((f) => f > 0);
  const min = fretted.length ? Math.min(...fretted) : 1;
  const max = fretted.length ? Math.max(...fretted) : 0;
  const base = max <= 4 ? 1 : min;
  const left = 24, top = 34, sx = 17, sy = 21;
  const x = (i) => left + i * sx;
  let s = `<svg class="cd" viewBox="0 0 130 150" role="img" aria-label="${label}" fill="none" stroke="currentColor" stroke-width="1.4">`;
  for (let i = 0; i < 6; i++) s += `<line x1="${x(i)}" y1="${top}" x2="${x(i)}" y2="${top + 5 * sy}"/>`;
  for (let j = 0; j <= 5; j++) s += `<line x1="${left}" y1="${top + j * sy}" x2="${x(5)}" y2="${top + j * sy}"${j === 0 && base === 1 ? ' stroke-width="4.5"' : ''}/>`;
  if (base > 1) s += `<text x="${left - 8}" y="${top + sy / 2 + 4}" text-anchor="end" font-size="12" fill="currentColor" stroke="none">${base}</text>`;
  v.frets.forEach((f, i) => {
    if (f === null) s += `<text x="${x(i)}" y="${top - 10}" text-anchor="middle" font-size="13" fill="currentColor" stroke="none">×</text>`;
    else if (f === 0) s += `<circle cx="${x(i)}" cy="${top - 14}" r="4.2"/>`;
  });
  const cy = (f) => top + (f - base + 0.5) * sy;
  if (v.barre) {
    const y = cy(v.barre.fret);
    s += `<rect x="${x(v.barre.from) - 7}" y="${y - 7}" width="${x(v.barre.to) - x(v.barre.from) + 14}" height="14" rx="7" fill="currentColor" stroke="none"/>`;
  }
  v.frets.forEach((f, i) => {
    if (f > 0 && f - base <= 4) s += `<circle cx="${x(i)}" cy="${cy(f)}" r="7" fill="currentColor" stroke="none"/>`;
  });
  return s + '</svg>';
}
