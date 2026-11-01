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
