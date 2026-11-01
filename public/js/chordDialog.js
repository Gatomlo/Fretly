import { getChord } from './chords.js';
import { chordSvg } from './diagram.js';
import { strum } from './audio.js';

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function openChord(symbol, index = 0) {
  const dlg = document.getElementById('chord-dialog');
  const chord = getChord(symbol);
  let i = index;

  const draw = () => {
    if (!chord) {
      dlg.innerHTML = `<h2>${esc(symbol)}</h2><p class="muted">Accord non répertorié.</p><button class="btn" data-close>Fermer</button>`;
    } else {
      const v = chord.voicings[i];
      const n = chord.voicings.length;
      dlg.innerHTML = `
        <h2>${esc(symbol)}</h2>
        <div class="dlg-diagram">
          <button class="btn icon" data-d="-1" aria-label="Position précédente" ${n < 2 ? 'disabled' : ''}>‹</button>
          ${chordSvg(v, symbol)}
          <button class="btn icon" data-d="1" aria-label="Position suivante" ${n < 2 ? 'disabled' : ''}>›</button>
        </div>
        <p class="muted">Position ${i + 1} / ${n}${chord.bass ? ` · basse ${esc(chord.bass)}` : ''}</p>
        ${chord.approx ? `<p class="muted small">Version simplifiée de ${esc(symbol)}</p>` : ''}
        <div class="row">
          <button class="btn primary" data-play>▶ Écouter</button>
          <button class="btn" data-close>Fermer</button>
        </div>`;
    }
  };
  dlg.onclick = (e) => {
    if (e.target === dlg || e.target.closest('[data-close]')) return dlg.close();
    const d = e.target.closest('[data-d]');
    if (d) { i = (i + Number(d.dataset.d) + chord.voicings.length) % chord.voicings.length; draw(); }
    if (e.target.closest('[data-play]')) strum(chord.voicings[i].frets);
  };
  draw();
  if (!dlg.open) dlg.showModal();
}

export const chordDialogOpen = () => document.getElementById('chord-dialog').open;
