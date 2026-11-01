import { songs, settings } from '../store.js';
import { parseSong } from '../chordpro.js';
import { isChord, transposeChord, prefersFlats } from '../music.js';
import { openChord, chordDialogOpen, esc } from '../chordDialog.js';

const NEXT_KEYS = ['ArrowRight', 'ArrowDown', 'PageDown'];
const PREV_KEYS = ['ArrowLeft', 'ArrowUp', 'PageUp'];
const LINE_EM = 2.7; // hauteur moyenne d'une ligne accords+paroles, en em

export function mount(root, id) {
  const song = songs.get(id);
  if (!song) { location.hash = '#/songs'; return; }
  const parsed = parseSong(song.body);
  let steps = song.transpose || 0;
  let lpm = song.speed || 12; // lignes par minute
  let fontSize = settings.get().fontSize;
  let mode = settings.get().mode;
  let playing = false;
  let counting = 0;
  let raf, countTimer, pos = 0, last = 0, wake;

  const firstChord = parsed.lines.flatMap((l) => l.segs || []).find((s) => s.chord && isChord(s.chord))?.chord;
  const flatsFor = () => (firstChord ? prefersFlats(transposeChord(firstChord, steps)) : false);

  root.innerHTML = `
    <div class="reader">
      <header class="reader-bar">
        <a class="btn icon" href="#/songs" aria-label="Retour">‹</a>
        <div class="titles"><b id="t"></b><span class="muted small" id="sub"></span></div>
        <div class="grp"><button class="btn icon" data-a="tr-" aria-label="Descendre d'un demi-ton">♭</button><span id="tr" class="tr"></span><button class="btn icon" data-a="tr+" aria-label="Monter d'un demi-ton">♯</button></div>
        <div class="grp"><button class="btn icon" data-a="fs-" aria-label="Texte plus petit">A−</button><button class="btn icon" data-a="fs+" aria-label="Texte plus grand">A+</button></div>
        <button class="btn icon" data-a="mode" id="modeBtn"></button>
        <a class="btn icon" href="#/song/${id}/edit" aria-label="Modifier">✎</a>
      </header>
      <div class="stage">
        <div class="song-view" id="sv"><div class="song" id="song"></div></div>
        <button class="edge prev" tabindex="-1" data-a="prev" aria-label="Page précédente">‹</button>
        <button class="edge next" tabindex="-1" data-a="next" aria-label="Page suivante">›</button>
        <div class="overlay" id="ov" hidden></div>
      </div>
      <footer class="reader-dock">
        <button class="btn big" tabindex="-1" data-a="prev">⏮ <span class="lbl">Préc.</span></button>
        <div class="auto">
          <button class="btn big primary" tabindex="-1" data-a="play" id="play">▶</button>
          <button class="btn icon" tabindex="-1" data-a="sp-" aria-label="Plus lent">−</button>
          <span class="speed" id="speed"></span>
          <button class="btn icon" tabindex="-1" data-a="sp+" aria-label="Plus rapide">+</button>
        </div>
        <button class="btn big" tabindex="-1" data-a="next"><span class="lbl">Suiv.</span> ⏭</button>
      </footer>
    </div>`;
  const $ = (q) => root.querySelector(q);
  const sv = $('#sv');
  const songEl = $('#song');
  const scroller = () => (mode === 'pages' ? songEl : sv);

  function renderSong() {
    const flats = flatsFor();
    songEl.innerHTML = parsed.lines.map((l) => {
      if (l.type === 'blank') return '<div class="gap"></div>';
      if (l.type === 'section') return `<h3 class="sec">${esc(l.text)}</h3>`;
      const hasCh = l.segs.some((s) => s.chord !== null);
      return `<div class="line${hasCh ? ' has-ch' : ''}">${l.segs.map((s) => {
        let ch = '';
        if (s.chord !== null) {
          const name = isChord(s.chord) ? transposeChord(s.chord, steps, flats) : s.chord;
          ch = `<span class="ch${isChord(s.chord) ? '' : ' note'}" ${isChord(s.chord) ? `data-chord="${esc(name)}"` : ''}>${esc(name)}</span>`;
        } else if (hasCh) ch = '<span class="ch">&nbsp;</span>';
        return `<span class="seg">${ch}<span class="ly">${esc(s.text)}</span></span>`;
      }).join('')}</div>`;
    }).join('');
  }

  function refresh() {
    const p = parsed.meta;
    $('#t').textContent = song.title || p.title || '';
    $('#sub').textContent = [song.artist || p.artist, (song.key || p.key) && `Ton ${song.key || p.key}`, song.capo ? `Capo ${song.capo}` : ''].filter(Boolean).join(' · ');
    $('#tr').textContent = steps ? (steps > 0 ? '+' : '') + steps : '0';
    $('#speed').textContent = `${lpm} l/min`;
    $('#play').textContent = counting ? String(counting) : playing ? '⏸' : '▶';
    $('#modeBtn').textContent = mode === 'pages' ? '▤' : '⇅';
    $('#modeBtn').setAttribute('aria-label', mode === 'pages' ? 'Passer en défilement' : 'Passer en pages');
    root.firstElementChild.classList.toggle('mode-pages', mode === 'pages');
    root.firstElementChild.style.setProperty('--fs', fontSize + 'px');
  }

  const persist = () => songs.save({ ...song, transpose: steps, speed: lpm });
  const pageStep = () => songEl.clientWidth + parseFloat(getComputedStyle(songEl).columnGap || 0);

  function go(dir) {
    if (mode === 'pages') songEl.scrollBy({ left: dir * pageStep(), behavior: 'smooth' });
    else sv.scrollBy({ top: dir * sv.clientHeight * 0.8, behavior: 'smooth' });
  }

  function tick(t) {
    if (!playing) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min((t - last) / 1000, 0.5);
    last = t;
    if (Math.abs(sv.scrollTop - pos) > 2) pos = sv.scrollTop; // l'utilisateur a bougé le texte
    pos += (lpm / 60) * parseFloat(getComputedStyle(sv).fontSize) * LINE_EM * dt;
    sv.scrollTop = pos;
    if (pos >= sv.scrollHeight - sv.clientHeight - 1) { stop(); flash('Fin du morceau'); }
  }
  function begin() {
    playing = true;
    pos = sv.scrollTop;
    last = performance.now();
    raf = requestAnimationFrame(tick);
    refresh();
  }
  function stop() {
    playing = false;
    counting = 0;
    clearTimeout(countTimer);
    cancelAnimationFrame(raf);
    $('#ov').hidden = true;
    refresh();
  }
  function toggle() {
    if (playing || counting) return stop();
    if (mode === 'pages') { flash('Défilement auto : mode défilement uniquement'); return; }
    counting = 3;
    const step = () => {
      if (!counting) return;
      $('#ov').hidden = false;
      $('#ov').textContent = counting;
      refresh();
      if (--counting > 0) countTimer = setTimeout(step, 1000);
      else countTimer = setTimeout(() => { $('#ov').hidden = true; begin(); }, 1000);
    };
    step();
  }
  let flashTimer;
  function flash(text) {
    const ov = $('#ov');
    ov.hidden = false;
    ov.textContent = text;
    ov.classList.add('small-msg');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { ov.hidden = true; ov.classList.remove('small-msg'); }, 1500);
  }

  function act(a) {
    if (a === 'next') go(1);
    else if (a === 'prev') go(-1);
    else if (a === 'play') toggle();
    else if (a === 'sp+' || a === 'sp-') { lpm = Math.min(60, Math.max(2, lpm + (a === 'sp+' ? 1 : -1))); persist(); }
    else if (a === 'tr+' || a === 'tr-') { steps = (steps + (a === 'tr+' ? 1 : -1) + 12) % 12; if (steps > 6) steps -= 12; persist(); renderSong(); }
    else if (a === 'fs+' || a === 'fs-') { fontSize = Math.min(44, Math.max(12, fontSize + (a === 'fs+' ? 2 : -2))); settings.set({ fontSize }); }
    else if (a === 'mode') {
      stop();
      mode = mode === 'pages' ? 'scroll' : 'pages';
      settings.set({ mode });
      sv.scrollTop = 0; songEl.scrollLeft = 0;
    }
    refresh();
  }

  root.addEventListener('pointerdown', (e) => { if (e.target.closest('.edge, .reader-dock .btn')) e.preventDefault(); }); // garde le focus hors des boutons
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (b) return act(b.dataset.a);
    const ch = e.target.closest('[data-chord]');
    if (ch) return openChord(ch.dataset.chord);
    if (e.target.closest('#sv') && mode === 'scroll' && !getSelection().toString()) toggle();
  });

  function onKey(e) {
    if (chordDialogOpen() || e.target.matches('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
    let a = null;
    if (NEXT_KEYS.includes(e.key)) a = 'next';
    else if (PREV_KEYS.includes(e.key)) a = 'prev';
    else if (e.key === ' ' || e.key === 'Enter') a = 'play';
    else if (e.key === '+' || e.key === '=') a = 'sp+';
    else if (e.key === '-') a = 'sp-';
    if (!a) return;
    e.preventDefault();
    if (e.type === 'keydown' && !e.repeat) act(a);
  }
  addEventListener('keydown', onKey, true);
  addEventListener('keyup', onKey, true);

  async function lock() {
    try { wake = await navigator.wakeLock?.request('screen'); } catch { /* non supporté */ }
  }
  const onVis = () => { if (document.visibilityState === 'visible') lock(); };
  document.addEventListener('visibilitychange', onVis);
  lock();
  document.activeElement?.blur?.();

  renderSong();
  refresh();
  return () => {
    stop();
    removeEventListener('keydown', onKey, true);
    removeEventListener('keyup', onKey, true);
    document.removeEventListener('visibilitychange', onVis);
    wake?.release?.();
  };
}
