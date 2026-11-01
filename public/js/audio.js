import { freqOf } from './pitch.js';

let ctx;
const OPEN_STRINGS = [40, 45, 50, 55, 59, 64];

function context() {
  ctx ||= new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Corde pincée (Karplus-Strong)
function pluck(freq, when) {
  const c = context();
  const sr = c.sampleRate;
  const n = Math.floor(sr * 1.8);
  const buf = c.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  const N = Math.round(sr / freq);
  for (let i = 0; i < N; i++) d[i] = Math.random() * 2 - 1;
  for (let i = N; i < n; i++) d[i] = 0.4985 * (d[i - N] + d[i - N + 1]);
  const src = c.createBufferSource();
  const gain = c.createGain();
  gain.gain.value = 0.35;
  src.buffer = buf;
  src.connect(gain).connect(c.destination);
  src.start(when);
}

export function playMidi(midi, ref = 440) {
  pluck(freqOf(midi, ref), context().currentTime);
}

export function strum(frets) {
  const t = context().currentTime;
  let k = 0;
  frets.forEach((f, i) => {
    if (f === null) return;
    pluck(freqOf(OPEN_STRINGS[i] + f), t + 0.045 * k++);
  });
}

// Petit « ding » de validation (accordeur)
export function ding() {
  const c = context();
  const t = c.currentTime;
  [880, 1318.5].forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.18 / (i + 1), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.75);
  });
}

// Métronome : planification en avance sur l'horloge audio, sans dérive
export function createMetronome(onBeat) {
  let timer = null;
  let next = 0;
  let beat = 0;
  let bpm = 100;
  const click = (t, accent) => {
    const c = context();
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = accent ? 1500 : 1000;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.06);
  };
  const schedule = () => {
    const c = context();
    while (next < c.currentTime + 0.12) {
      const accent = beat % 4 === 0;
      click(next, accent);
      setTimeout(() => onBeat?.(accent), Math.max(0, (next - c.currentTime) * 1000));
      next += 60 / bpm;
      beat++;
    }
  };
  return {
    get running() { return timer !== null; },
    setBpm(v) { bpm = v; },
    start(v) { bpm = v; beat = 0; next = context().currentTime + 0.05; schedule(); timer = setInterval(schedule, 25); },
    stop() { clearInterval(timer); timer = null; },
  };
}
