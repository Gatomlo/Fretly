// Détection de hauteur YIN. buf : Float32Array (≥ 4096 échantillons conseillés).
export function detectPitch(buf, sampleRate) {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  if (Math.sqrt(sum / buf.length) < 0.01) return null;

  const W = buf.length >> 1;
  const tauMax = Math.min(W, Math.floor(sampleRate / 60));
  const tauMin = Math.floor(sampleRate / 1000);
  const d = new Float32Array(tauMax);
  for (let tau = 1; tau < tauMax; tau++) {
    let s = 0;
    for (let j = 0; j < W; j++) {
      const x = buf[j] - buf[j + tau];
      s += x * x;
    }
    d[tau] = s;
  }
  let run = 0;
  d[0] = 1;
  for (let tau = 1; tau < tauMax; tau++) {
    run += d[tau];
    d[tau] = run ? (d[tau] * tau) / run : 1;
  }
  let tau = tauMin;
  while (tau < tauMax - 1) {
    if (d[tau] < 0.12) {
      while (tau + 1 < tauMax - 1 && d[tau + 1] < d[tau]) tau++;
      break;
    }
    tau++;
  }
  if (tau >= tauMax - 1) return null;
  const [s0, s1, s2] = [d[tau - 1], d[tau], d[tau + 1]];
  const denom = 2 * (2 * s1 - s2 - s0);
  const better = denom ? tau + (s2 - s0) / denom : tau;
  return sampleRate / better;
}

export const midiOf = (freq, ref = 440) => 69 + 12 * Math.log2(freq / ref);
export const freqOf = (midi, ref = 440) => ref * 2 ** ((midi - 69) / 12);

export const TUNINGS = [
  { id: 'std', name: 'Standard (EADGBE)', notes: [40, 45, 50, 55, 59, 64] },
  { id: 'chrom', name: 'Chromatique', notes: null },
  { id: 'dropd', name: 'Drop D', notes: [38, 45, 50, 55, 59, 64] },
  { id: 'half', name: 'Demi-ton plus bas', notes: [39, 44, 49, 54, 58, 63] },
  { id: 'dadgad', name: 'DADGAD', notes: [38, 45, 50, 55, 57, 62] },
  { id: 'openg', name: 'Open G', notes: [38, 43, 50, 55, 59, 62] },
  { id: 'opend', name: 'Open D', notes: [38, 45, 50, 54, 57, 62] },
];
