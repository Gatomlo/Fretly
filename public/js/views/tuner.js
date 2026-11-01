import { detectPitch, midiOf, TUNINGS } from '../pitch.js';
import { NOTES } from '../music.js';
import { playMidi, ding } from '../audio.js';
import { settings } from '../store.js';
import { createGuide } from '../guided.js';

const label = (m) => `${NOTES[m % 12]}${Math.floor(m / 12) - 1}`;

export function mount(root) {
  const ref = settings.get().ref;
  let tuning = TUNINGS[0];
  let locked = null;
  let stream, ctx, analyser, raf;
  const hist = [];
  let silent = 0;
  let okSince = 0;
  let dinged = false;
  let muteUntil = 0;
  let guide = null; // accordage guidé en cours
  let done = new Set();
  let advTimer;

  root.innerHTML = `
    <section class="tuner">
      <select id="tn" aria-label="Accordage">${TUNINGS.map((t) => `<option value="${t.id}">${t.name}</option>`).join('')}</select>
      <div class="tn-note" id="note">–</div>
      <div class="tn-hint" id="hint">Appuyez sur Démarrer</div>
      <div class="meter"><div class="zone"></div><div class="needle" id="needle"></div></div>
      <div class="tn-freq" id="freq">&nbsp;</div>
      <div class="strings" id="strings"></div>
      <button class="btn" id="guide">▶ Accordage guidé</button>
      <button class="btn primary big" id="toggle">🎤 Démarrer</button>
      <p class="muted small">La = ${ref} Hz (réglable dans Réglages). Touchez une corde pour la verrouiller (ré-appui = auto) ; maintenez pour l'entendre.</p>
    </section>`;
  const $ = (id) => root.querySelector('#' + id);

  function drawStrings(active) {
    const s = $('strings');
    s.className = 'strings';
    $('guide').hidden = !tuning.notes;
    if (!tuning.notes) { s.innerHTML = ''; return; }
    const btn = (i) => `<button class="str${i === locked ? ' locked' : ''}${i === active ? ' on' : ''}${done.has(i) ? ' done' : ''}" data-i="${i}">${label(tuning.notes[i])}</button>`;
    if (tuning.notes.length === 6) {
      // Tête de guitare : 3 mécaniques de chaque côté
      s.className = 'strings head';
      s.innerHTML = `<div class="col">${[2, 1, 0].map(btn).join('')}</div>
        <div class="neck" aria-hidden="true">${[0, 1, 2, 3, 4, 5].map((i) => `<i class="${i === active ? 'on' : ''}"></i>`).join('')}</div>
        <div class="col">${[3, 4, 5].map(btn).join('')}</div>`;
    } else s.innerHTML = tuning.notes.map((_, i) => btn(i)).join('');
  }
  drawStrings(null);

  $('tn').onchange = (e) => { tuning = TUNINGS.find((t) => t.id === e.target.value); guideEnd(false); done = new Set(); locked = null; drawStrings(null); };
  let holdTimer;
  $('strings').onpointerdown = (e) => {
    const b = e.target.closest('.str');
    if (!b) return;
    const i = Number(b.dataset.i);
    holdTimer = setTimeout(() => { holdTimer = null; playMidi(tuning.notes[i], ref); }, 450);
  };
  $('strings').onpointerup = (e) => {
    const b = e.target.closest('.str');
    if (!b || holdTimer === null) { holdTimer = undefined; return; }
    clearTimeout(holdTimer);
    if (guide) return; // pendant le guidage, la corde visée est imposée
    const i = Number(b.dataset.i);
    locked = locked === i ? null : i;
    drawStrings(locked);
  };
  $('strings').onpointerleave = () => clearTimeout(holdTimer);

  const prompt = () => `Corde ${tuning.notes.length - locked} (${label(tuning.notes[locked])}) : jouez-la à vide`;
  function guideStart() {
    if (!tuning.notes) return;
    guide = createGuide(tuning.notes.length);
    done = guide.done;
    locked = guide.current;
    $('guide').textContent = '⏹ Quitter le guidage';
    $('hint').textContent = prompt();
    drawStrings(null);
    if (!stream) start();
  }
  function guideEnd(success) {
    clearTimeout(advTimer);
    if (!guide) return;
    guide = null;
    locked = null;
    $('guide').textContent = '▶ Accordage guidé';
    if (success) $('hint').textContent = 'Accordage terminé ✓ Rejouez les cordes pour vérifier';
    drawStrings(null);
  }
  $('guide').onclick = () => (guide ? guideEnd(false) : guideStart());

  function show(freq) {
    if (!freq) {
      if (++silent > 12) {
        okSince = 0; dinged = false; $('note').textContent = '–'; $('hint').textContent = guide ? prompt() : 'Jouez une corde'; $('freq').innerHTML = '&nbsp;'; $('needle').style.left = '50%'; root.firstElementChild.classList.remove('ok'); drawStrings(null); }
      return;
    }
    silent = 0;
    hist.push(freq);
    if (hist.length > 5) hist.shift();
    const f = [...hist].sort((a, b) => a - b)[hist.length >> 1];
    const m = midiOf(f, ref);
    let target;
    let active = null;
    if (tuning.notes) {
      active = locked ?? tuning.notes.reduce((best, n, i) => (Math.abs(m - n) < Math.abs(m - tuning.notes[best]) ? i : best), 0);
      target = tuning.notes[active];
    } else target = Math.round(m);
    const cents = (m - target) * 100;
    const ok = Math.abs(cents) < 5;
    // Son de validation : accord juste et stable ~0,4 s, une seule fois jusqu'à ce qu'on s'en écarte
    const now = performance.now();
    if (!ok) { okSince = 0; if (Math.abs(cents) > 12) dinged = false; }
    else if (!okSince) okSince = now;
    else if (!dinged && now - okSince > 400) {
      dinged = true; muteUntil = now + 1100; ding();
      if (guide) {
        const next = guide.advance();
        drawStrings(active);
        clearTimeout(advTimer);
        advTimer = setTimeout(() => {
          if (next === null) guideEnd(true);
          else { locked = next; $('hint').textContent = prompt(); drawStrings(null); }
        }, 1100);
      }
    }
    $('note').textContent = label(target);
    $('freq').textContent = `${f.toFixed(1)} Hz · ${cents > 0 ? '+' : ''}${cents.toFixed(0)} cents`;
    $('hint').textContent = ok ? 'Juste ✓' : cents < 0 ? 'Trop bas ↑ serrer' : 'Trop haut ↓ desserrer';
    $('needle').style.left = `${50 + Math.max(-50, Math.min(50, cents))}%`;
    root.firstElementChild.classList.toggle('ok', ok);
    drawStrings(active);
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) { $('hint').textContent = 'Micro indisponible (HTTPS requis)'; return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch { $('hint').textContent = 'Accès au micro refusé'; return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    let last = 0;
    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      if (t - last < 40 || performance.now() < muteUntil) return; // pas d'écoute pendant le ding
      last = t;
      analyser.getFloatTimeDomainData(buf);
      show(detectPitch(buf, ctx.sampleRate));
    };
    raf = requestAnimationFrame(loop);
    $('toggle').textContent = '⏹ Arrêter';
    $('hint').textContent = guide ? prompt() : 'Jouez une corde';
  }
  function stop() {
    clearTimeout(advTimer);
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach((t) => t.stop());
    ctx?.close();
    stream = ctx = null;
  }
  $('toggle').onclick = () => {
    if (stream) { stop(); $('toggle').textContent = '🎤 Démarrer'; $('hint').textContent = 'Appuyez sur Démarrer'; } else start();
  };
  return stop;
}
