import { songs, sets, settings } from '../store.js';
import { parseSong } from '../chordpro.js';
import { isChord, transposeChord, prefersFlats } from '../music.js';
import { getChord } from '../chords.js';
import { chordSvg } from '../diagram.js';
import { esc } from '../chordDialog.js';

// Vue d'impression : une chanson ou toute une setlist, une chanson par page. « Imprimer »
// ouvre la boîte du navigateur, qui propose aussi « Enregistrer au format PDF ».
export function mount(root, param) {
  const [kind, id] = param.split('/');
  let list;
  let title;
  let back;
  if (kind === 'set') {
    const set = sets.get(id);
    if (!set) { location.hash = '#/sets'; return; }
    list = set.songIds.map((x) => songs.get(x)).filter(Boolean);
    title = set.name;
    back = `#/set/${id}`;
  } else {
    const song = songs.get(id);
    if (!song) { location.hash = '#/songs'; return; }
    list = [song];
    title = song.title;
    back = `#/song/${id}`;
  }

  root.innerHTML = `
    <div class="printbar noprint">
      <a class="btn" href="${back}">‹ Retour</a>
      <b>${esc(title)}</b>
      <label class="chk"><input type="checkbox" id="dg" checked> Diagrammes</label>
      <button class="btn primary" id="pr">🖨 Imprimer / PDF</button>
    </div>
    <div class="printdoc" id="doc"></div>`;

  const prefs = settings.get().voicings;
  const lineHtml = (l, shift, flats) => {
    if (l.type === 'blank') return '<div class="pgap"></div>';
    if (l.type === 'section') return `<h3 class="psec">${esc(l.text)}</h3>`;
    return `<div class="pl">${l.segs.map((s, i) => {
      const ok = s.chord !== null && isChord(s.chord);
      const chord = s.chord === null ? '' : esc(ok ? transposeChord(s.chord, shift, flats) : s.chord);
      const hasCh = l.segs.some((x) => x.chord !== null);
      return `<span class="ps">${hasCh ? `<span class="pc">${chord || '&nbsp;'}</span>` : ''}<span class="pw">${esc(i === 0 && s.chord === null ? s.text.trimStart() : s.text)}</span></span>`;
    }).join('')}</div>`;
  };

  function render() {
    const diagrams = root.querySelector('#dg').checked;
    root.querySelector('#doc').innerHTML = list.map((song) => {
      const parsed = parseSong(song.body);
      const shift = (song.transpose || 0) - (song.playCapo || 0);
      const first = parsed.lines.flatMap((l) => l.segs || []).find((s) => s.chord && isChord(s.chord))?.chord;
      const flats = first ? prefersFlats(transposeChord(first, shift)) : false;
      const used = [...new Set(parsed.lines.flatMap((l) => (l.segs || []).map((s) => s.chord)).filter((c) => c && isChord(c)).map((c) => transposeChord(c, shift, flats)))];
      const figures = diagrams ? used.map((n) => {
        const c = getChord(n, prefs);
        return c ? `<figure>${chordSvg(c.voicings[0], n)}<figcaption>${esc(n)}</figcaption></figure>` : '';
      }).join('') : '';
      const sub = [song.artist, song.key && `Ton ${song.key}`, song.playCapo ? `Capo ${song.playCapo}` : '', song.transpose ? `Transposé ${song.transpose > 0 ? '+' : ''}${song.transpose}` : ''].filter(Boolean).join(' · ');
      return `<article class="psong"><header><h2>${esc(song.title)}</h2><span>${esc(sub)}</span></header>
        ${figures ? `<div class="pchords">${figures}</div>` : ''}
        <div class="pbody">${parsed.lines.map((l) => lineHtml(l, shift, flats)).join('')}</div></article>`;
    }).join('') || '<p class="muted">Rien à imprimer.</p>';
  }
  root.querySelector('#dg').onchange = render;
  root.querySelector('#pr').onclick = () => window.print();
  render();
}
