import { NOTES, parseChord, noteIndex } from '../music.js';
import { QUALITIES, getChord, normalizeQuality } from '../chords.js';
import { chordSvg } from '../diagram.js';
import { openChord } from '../chordDialog.js';

export function mount(root, initial) {
  let root_ = 'C';
  let quality = '';
  const p = initial && parseChord(initial);
  if (p && normalizeQuality(p.suffix) !== null) { root_ = NOTES[noteIndex(p.root)]; quality = normalizeQuality(p.suffix); }

  root.innerHTML = `
    <section class="page">
      <div class="page-head"><h1>Bible des accords</h1></div>
      <input type="search" id="q" placeholder="Chercher : Am7, F#m, D/F#…" aria-label="Chercher un accord">
      <div class="chips" id="roots"></div>
      <div class="chips" id="quals"></div>
      <h2 id="title"></h2>
      <div class="grid" id="grid"></div>
    </section>`;
  const $ = (id) => root.querySelector('#' + id);

  function draw() {
    $('roots').innerHTML = NOTES.map((n) => `<button class="chip${n === root_ ? ' on' : ''}" data-r="${n}">${n}</button>`).join('');
    $('quals').innerHTML = QUALITIES.map(([k, l]) => `<button class="chip${k === quality ? ' on' : ''}" data-q="${k}">${l}</button>`).join('');
    const sym = root_ + quality;
    const chord = getChord(sym);
    $('title').textContent = sym;
    $('grid').innerHTML = chord
      ? chord.voicings.map((v, i) => `<button class="card" data-i="${i}">${chordSvg(v, sym)}<span class="muted small">Position ${i + 1}</span></button>`).join('')
      : '<p class="muted">Pas de position disponible pour cet accord.</p>';
  }
  root.onclick = (e) => {
    const r = e.target.closest('[data-r]');
    const q = e.target.closest('[data-q]');
    const c = e.target.closest('.card');
    if (r) { root_ = r.dataset.r; draw(); }
    if (q) { quality = q.dataset.q; draw(); }
    if (c) openChord(root_ + quality, Number(c.dataset.i));
  };
  $('q').oninput = (e) => {
    const a = parseChord(e.target.value.trim());
    if (a && normalizeQuality(a.suffix) !== null) { root_ = NOTES[noteIndex(a.root)]; quality = normalizeQuality(a.suffix); draw(); }
  };
  draw();
}
