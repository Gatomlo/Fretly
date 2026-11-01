import { songs, sets, settings } from '../store.js';
import { parseSong } from '../chordpro.js';
import { isChord, transposeChord, prefersFlats } from '../music.js';
import { openChord, chordDialogOpen, esc } from '../chordDialog.js';
import { getChord } from '../chords.js';
import { cover, tintOf } from '../cover.js';
import { chordSvg } from '../diagram.js';
import { createMetronome } from '../audio.js';
import { suggestCapo, easeLabel } from '../capo.js';

const NEXT_KEYS = ['ArrowRight', 'ArrowDown', 'PageDown'];
const PREV_KEYS = ['ArrowLeft', 'ArrowUp', 'PageUp'];
const READ_AT = 0.3; // position du repère de lecture dans la hauteur visible
const LINE_EM = 2.7; // hauteur moyenne d'une ligne accords+paroles, en em
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function mount(root, id, setId) {
  let song = songs.get(id);
  if (!song) { location.hash = '#/songs'; return; }
  settings.set({ last: id });
  song = songs.save({ ...song, lastPlayed: Date.now() }, { quiet: true });
  const parsed = parseSong(song.body);

  // Setlist en cours : morceau précédent / suivant
  const setObj = setId ? sets.get(setId) : null;
  const setIds = setObj ? setObj.songIds.filter((x) => songs.get(x)) : [];
  const setPos = setIds.indexOf(id);
  const prevId = setPos > 0 ? setIds[setPos - 1] : null;
  const nextId = setPos >= 0 && setPos < setIds.length - 1 ? setIds[setPos + 1] : null;
  const goSong = (sid) => { location.hash = `#/song/${sid}?set=${setId}`; };

  let steps = song.transpose || 0;
  let capo = song.playCapo || 0; // capo réellement posé : les accords affichés sont les formes à jouer
  let lpm = song.speed || 12; // lignes par minute
  let secSpeed = song.secSpeed || {}; // vitesse propre à une section (couplet, refrain…)
  let tempo = song.tempo || 100;
  let fontSize = settings.get().fontSize;
  let mode = settings.get().mode;
  let showStrip = settings.get().strip;
  let showOrig = settings.get().showOrig;
  let stage = settings.get().stage;
  let playing = false;
  let counting = 0;
  let raf, countTimer, pos = 0, last = 0, wake, curSec = 0;
  const hasSections = parsed.lines.some((l) => l.type === 'section');
  const sectionNames = ['Intro', ...parsed.lines.filter((l) => l.type === 'section').map((l) => l.text)];

  const metro = createMetronome(() => {
    const b = $('#beat');
    b.classList.add('on');
    setTimeout(() => b.classList.remove('on'), 110);
  });

  const firstChord = parsed.lines.flatMap((l) => l.segs || []).find((s) => s.chord && isChord(s.chord))?.chord;
  const flatsFor = () => (firstChord ? prefersFlats(transposeChord(firstChord, steps - capo)) : false);

  root.innerHTML = `
    <div class="reader t${tintOf(song)}">
      <header class="reader-bar">
        <a class="btn icon" href="#/songs" aria-label="Retour">‹</a>
        ${cover(song, ' sm')}
        <div class="titles"><b id="t"></b><span class="muted small" id="sub"></span></div>
        <span class="beat" id="beat" aria-hidden="true"></span>
        <div class="grp"><button class="btn icon" data-a="tr-" aria-label="Descendre d'un demi-ton">♭</button><span id="tr" class="tr"></span><button class="btn icon" data-a="tr+" aria-label="Monter d'un demi-ton">♯</button></div>
        <button class="btn icon" data-a="strip" id="stripBtn" aria-label="Afficher les diagrammes d'accords">🎸</button>
        <button class="btn icon" data-a="mode" id="modeBtn"></button>
        <button class="btn icon" data-a="opts" aria-label="Options">⋯</button>
      </header>
      <div class="setbar" id="setbar" ${setObj && setPos >= 0 ? '' : 'hidden'}>
        <button class="btn icon" data-a="setprev" ${prevId ? '' : 'disabled'} aria-label="Morceau précédent">‹</button>
        <span>${esc(setObj?.name || '')} · ${setPos + 1}/${setIds.length}</span>
        <button class="btn icon" data-a="setnext" ${nextId ? '' : 'disabled'} aria-label="Morceau suivant">›</button>
      </div>
      <div class="progress" aria-hidden="true"><i id="prog"></i></div>
      <div class="stage">
        <div class="song-view" id="sv"><div class="song" id="song"></div></div>
        <button class="edge prev" tabindex="-1" data-a="prev" aria-label="Page précédente">‹</button>
        <button class="edge next" tabindex="-1" data-a="next" aria-label="Page suivante">›</button>
        <div class="guide" aria-hidden="true"></div>
        <aside class="chordstrip" id="strip" aria-live="off"></aside>
        <div class="nextcard" id="nextcard" hidden>${nextId ? `<button class="btn primary big" tabindex="-1" data-a="setnext">Suivant : ${esc(songs.get(nextId).title)} ▶</button>` : ''}</div>
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
      <dialog class="sheet" id="opts"></dialog>
    </div>`;
  const $ = (q) => root.querySelector(q);
  const sv = $('#sv');
  const songEl = $('#song');
  const optsDlg = $('#opts');

  function renderSong() {
    const flats = flatsFor();
    curLine = null;
    let sec = 0;
    songEl.innerHTML = parsed.lines.map((l) => {
      if (l.type === 'blank') return '<div class="gap"></div>';
      if (l.type === 'section') { sec++; return `<h3 class="sec" data-sec="${sec}">${esc(l.text)}</h3>`; }
      const hasCh = l.segs.some((s) => s.chord !== null);
      return `<div class="line${hasCh ? ' has-ch' : ''}" data-sec="${sec}">${l.segs.map((s, i) => {
        let ch = '';
        if (s.chord !== null) {
          const ok = isChord(s.chord);
          const shape = ok ? transposeChord(s.chord, steps - capo, flats) : s.chord;
          const sounding = ok ? transposeChord(s.chord, steps, flats) : s.chord;
          const orig = showOrig && capo && ok ? `<small class="orig">${esc(sounding)}</small>` : '';
          ch = `<span class="ch${ok ? '' : ' note'}" ${ok ? `data-chord="${esc(shape)}"` : ''}>${esc(shape)}${orig}</span>`;
        } else if (hasCh) ch = '<span class="ch">&nbsp;</span>';
        return `<span class="seg">${ch}<span class="ly">${esc(i === 0 && s.chord === null ? s.text.trimStart() : s.text)}</span></span>`;
      }).join('')}</div>`;
    }).join('');
  }

  // Marge haute : au départ, la première ligne se trouve sur le repère de lecture
  function fitTop() {
    sv.style.paddingTop = mode === 'scroll' ? `${Math.round(sv.clientHeight * READ_AT) - 2}px` : '';
  }

  const speedNow = () => secSpeed[curSec] ?? lpm;

  function refresh() {
    fitTop();
    const p = parsed.meta;
    $('#t').textContent = song.title || p.title || '';
    $('#sub').textContent = [song.artist || p.artist, (song.key || p.key) && `Ton ${song.key || p.key}`, capo ? `Capo ${capo}` : song.capo ? `Capo conseillé ${song.capo}` : ''].filter(Boolean).join(' · ');
    $('#tr').textContent = steps ? (steps > 0 ? '+' : '') + steps : '0';
    $('#speed').innerHTML = `${speedNow()} l/min${secSpeed[curSec] !== undefined ? `<small>${esc(sectionNames[curSec] || '')}</small>` : ''}`;
    $('#play').textContent = counting ? String(counting) : playing ? '⏸' : '▶';
    $('#modeBtn').textContent = mode === 'pages' ? '▤' : '⇅';
    $('#modeBtn').setAttribute('aria-label', mode === 'pages' ? 'Passer en défilement' : 'Passer en pages');
    const r = root.firstElementChild;
    r.classList.toggle('mode-pages', mode === 'pages');
    r.classList.toggle('has-strip', showStrip);
    r.classList.toggle('stage-mode', stage);
    $('#stripBtn').classList.toggle('active', showStrip);
    r.style.setProperty('--fs', fontSize * (stage ? 1.2 : 1) + 'px');
  }

  // Bandeau de diagrammes : accords de la ligne en cours de lecture et des suivantes
  const strip = $('#strip');
  let stripKey = '';
  let curLine = null;
  let stripFrame = 0;
  function updateStrip() {
    stripFrame = 0;
    const sc = mode === 'pages' ? songEl : sv;
    const [pos_, max] = mode === 'pages' ? [sc.scrollLeft, sc.scrollWidth - sc.clientWidth] : [sc.scrollTop, sc.scrollHeight - sc.clientHeight];
    const frac = max > 0 ? Math.min(1, pos_ / max) : 1;
    $('#prog').style.width = `${frac * 100}%`;
    $('#nextcard').hidden = !(nextId && frac >= 0.97);
    const box = sc.getBoundingClientRect();
    const marker = box.top + box.height * READ_AT;
    // Ligne de lecture : celle que traverse le repère (mode défilement)
    const all = [...songEl.querySelectorAll('.line')];
    const cur = mode === 'pages' ? null : all.find((l) => l.getBoundingClientRect().bottom > marker);
    if (cur !== curLine) {
      curLine?.classList.remove('cur');
      cur?.classList.add('cur');
      curLine = cur;
      const sec = Number(cur?.dataset.sec || 0);
      if (sec !== curSec) { curSec = sec; refresh(); }
    }
    if (!showStrip) { strip.innerHTML = ''; stripKey = ''; return; }
    const lines = all.filter((l) => l.classList.contains('has-ch'));
    const from = lines.findIndex((l) => {
      const r = l.getBoundingClientRect();
      return mode === 'pages' ? r.left >= box.left - 2 : r.bottom > marker;
    });
    if (from < 0) return;
    const names = [];
    let current = null;
    for (const l of lines.slice(from, from + 4)) {
      for (const el of l.querySelectorAll('[data-chord]')) {
        const n = el.dataset.chord;
        if (current === null) current = n;
        if (!names.includes(n)) names.push(n);
      }
      if (names.length >= 4) break;
    }
    const list = names.slice(0, 4);
    const key = list.join('|') + '#' + current;
    if (key === stripKey) return;
    stripKey = key;
    const prefs = settings.get().voicings;
    strip.innerHTML = list.map((n) => {
      const c = getChord(n, prefs);
      return `<button class="mini${n === current ? ' now' : ''}" tabindex="-1" data-chord="${esc(n)}">${c ? chordSvg(c.voicings[0], n) : ''}<b>${esc(n)}</b></button>`;
    }).join('');
  }
  const scheduleStrip = () => { if (!stripFrame) stripFrame = requestAnimationFrame(updateStrip); };
  sv.addEventListener('scroll', scheduleStrip, { passive: true });
  songEl.addEventListener('scroll', scheduleStrip, { passive: true });
  const onResize = () => { fitTop(); scheduleStrip(); };
  addEventListener('resize', onResize);

  const persist = (patch = {}) => { song = songs.save({ ...song, transpose: steps, speed: lpm, secSpeed, playCapo: capo, tempo, ...patch }); };
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
    pos += (speedNow() / 60) * parseFloat(getComputedStyle(sv).fontSize) * LINE_EM * dt;
    sv.scrollTop = pos;
    if (pos >= sv.scrollHeight - sv.clientHeight - 1) { stop(); flash('Fin du morceau'); }
  }
  // Place la ligne touchée sur le repère de lecture ; le défilement auto repart de là
  function seek(line) {
    const marker = sv.getBoundingClientRect().top + sv.clientHeight * READ_AT;
    sv.scrollTop += line.getBoundingClientRect().top - (marker - 2);
    pos = sv.scrollTop;
    stripKey = '';
    scheduleStrip();
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

  // Vitesse : en lecture dans un morceau à sections, le réglage s'applique à la section en cours
  function adjustSpeed(d) {
    if (playing && hasSections) secSpeed = { ...secSpeed, [curSec]: clamp(speedNow() + d, 2, 60) };
    else lpm = clamp(lpm + d, 2, 60);
    persist();
  }

  let taps = [];
  function tapTempo() {
    const now = performance.now();
    taps = [...taps.filter((t) => now - t < 2500), now].slice(-5);
    if (taps.length >= 2) {
      const avg = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
      tempo = clamp(Math.round(60000 / avg), 30, 260);
      metro.setBpm(tempo);
      persist();
    }
  }

  // Capo malin : les trois capos qui donnent les accords les plus simples, ton conservé
  function suggestRow() {
    const sounding = parsed.lines.flatMap((l) => (l.segs || []).map((s) => s.chord)).filter((c) => c && isChord(c)).map((c) => transposeChord(c, steps));
    const best = suggestCapo(sounding).slice(0, 3);
    if (!best.length) return '';
    return `<div class="opt col"><span>Capo malin <small class="muted">(le ton ne change pas)</small></span><div class="sugg">${best.map((s) => `
      <button class="sg${s.capo === capo ? ' on' : ''}" data-a="caposet:${s.capo}"><b>${s.capo ? `Capo ${s.capo}` : 'Sans capo'}</b><span>${s.shapes.slice(0, 6).map(esc).join(' ')}</span><em>${easeLabel(s.cost)}</em></button>`).join('')}</div></div>`;
  }

  function renderSheet() {
    const row = (label, inner) => `<div class="opt"><span>${label}</span><div class="ctl">${inner}</div></div>`;
    const sw = (a, on) => `<button class="switch${on ? ' on' : ''}" data-a="${a}" role="switch" aria-checked="${on}"><i></i></button>`;
    optsDlg.innerHTML = `
      <h2>Options</h2>
      ${row('Taille du texte', `<button class="btn icon" data-a="fs-">A−</button><span class="val">${fontSize}</span><button class="btn icon" data-a="fs+">A+</button>`)}
      ${row(`Capo posé${song.capo ? ` <small class="muted">(le site indique ${song.capo})</small>` : ''}`, `<button class="btn icon" data-a="capo-">−</button><span class="val">${capo}</span><button class="btn icon" data-a="capo+">+</button>`)}
      ${capo ? row('Afficher aussi les accords d\'origine', sw('orig', showOrig)) : ''}
      ${suggestRow()}
      ${row('Métronome', `<button class="btn icon" data-a="bpm-">−</button><span class="val">${tempo}</span><button class="btn icon" data-a="bpm+">+</button><button class="btn" data-a="tap">Tap</button><button class="btn ${metro.running ? 'primary' : ''}" data-a="metro">${metro.running ? '⏸' : '▶'}</button>`)}
      ${row('Mode scène (noir, texte agrandi)', sw('stage', stage))}
      ${row('Favori', sw('fav', !!song.fav))}
      ${/^https?:\/\//.test(song.sourceUrl || '') ? row('Source', `<a class="btn" href="${esc(song.sourceUrl)}" target="_blank" rel="noopener noreferrer">Ouvrir la page ↗</a>`) : ''}
      ${hasSections ? row('Vitesses par section', `<span class="muted small">${Object.keys(secSpeed).length} réglée(s)</span><button class="btn" data-a="resetsec" ${Object.keys(secSpeed).length ? '' : 'disabled'}>Réinitialiser</button>`) : ''}
      <div class="row end"><a class="btn" href="#/print/song/${id}">🖨 Imprimer</a><a class="btn" href="#/song/${id}/edit">✎ Modifier</a><button class="btn primary" data-a="close">Terminé</button></div>`;
  }

  function act(a) {
    if (a === 'next') go(1);
    else if (a === 'prev') go(-1);
    else if (a === 'play') toggle();
    else if (a === 'sp+' || a === 'sp-') adjustSpeed(a === 'sp+' ? 1 : -1);
    else if (a === 'tr+' || a === 'tr-') { steps = (steps + (a === 'tr+' ? 1 : -1) + 12) % 12; if (steps > 6) steps -= 12; persist(); renderSong(); stripKey = ''; scheduleStrip(); }
    else if (a === 'fs+' || a === 'fs-') { fontSize = clamp(fontSize + (a === 'fs+' ? 2 : -2), 12, 44); settings.set({ fontSize }); }
    else if (a === 'strip') { showStrip = !showStrip; settings.set({ strip: showStrip }); stripKey = ''; scheduleStrip(); }
    else if (a === 'mode') {
      stop();
      mode = mode === 'pages' ? 'scroll' : 'pages';
      settings.set({ mode });
      sv.scrollTop = 0; songEl.scrollLeft = 0; stripKey = '';
    } else if (a === 'opts') { renderSheet(); optsDlg.showModal(); }
    else if (a === 'close') optsDlg.close();
    else if (a === 'capo+' || a === 'capo-') { capo = clamp(capo + (a === 'capo+' ? 1 : -1), 0, 11); persist(); renderSong(); stripKey = ''; scheduleStrip(); }
    else if (a === 'orig') { showOrig = !showOrig; settings.set({ showOrig }); renderSong(); }
    else if (a === 'bpm+' || a === 'bpm-') { tempo = clamp(tempo + (a === 'bpm+' ? 1 : -1), 30, 260); metro.setBpm(tempo); persist(); }
    else if (a === 'tap') tapTempo();
    else if (a === 'metro') { if (metro.running) metro.stop(); else metro.start(tempo); }
    else if (a === 'stage') { stage = !stage; settings.set({ stage }); }
    else if (a === 'fav') persist({ fav: !song.fav });
    else if (a.startsWith('caposet:')) { capo = clamp(Number(a.slice(8)), 0, 11); persist(); renderSong(); stripKey = ''; scheduleStrip(); }
    else if (a === 'resetsec') { secSpeed = {}; persist(); }
    else if (a === 'setprev' && prevId) goSong(prevId);
    else if (a === 'setnext' && nextId) goSong(nextId);
    refresh();
    if (optsDlg.open) renderSheet();
  }

  root.addEventListener('pointerdown', (e) => { if (e.target.closest('.edge, .reader-dock .btn, .nextcard .btn')) e.preventDefault(); }); // garde le focus hors des boutons
  root.addEventListener('click', (e) => {
    if (e.target === optsDlg) return optsDlg.close();
    const b = e.target.closest('[data-a]');
    if (b) return act(b.dataset.a);
    const ch = e.target.closest('[data-chord]');
    if (ch) return openChord(ch.dataset.chord);
    if (!e.target.closest('#sv') || mode !== 'scroll' || getSelection().toString()) return;
    const line = e.target.closest('.line');
    if (!line) return toggle(); // zone vide : pause / reprise
    seek(line);
    if (!playing && !counting) toggle();
  });

  function onKey(e) {
    if (chordDialogOpen() || optsDlg.open || e.target.matches('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
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
  requestAnimationFrame(updateStrip);
  return () => {
    stop();
    metro.stop();
    removeEventListener('resize', onResize);
    removeEventListener('keydown', onKey, true);
    removeEventListener('keyup', onKey, true);
    document.removeEventListener('visibilitychange', onVis);
    wake?.release?.();
  };
}
