// Every game sound as a layered synth recipe: sub thump + noise transient + bright top layer, with saturation / bitcrush where it fits.
// A recipe draws into a Rig at time t and returns its length in seconds. The same functions run live (sfx.ts) and offline (tools/audio-render.ts).
import { TRIMS } from './trims';
import { click, nz, osc, rng, sub, sweepSaw, swell, uni, type Rig } from './synth';

export interface SfxOpts {
  /** Overall scale 0..1.5 */
  v?: number;
  /** Intensity 0..1 (momentum level, crowd size) */
  level?: number;
  /** Card tier rank 0..5 (pack sounds) or severity 1..3 (glitch stings) */
  rank?: number;
  /** Card number in a pack (pitch climbs) */
  i?: number;
  ms?: number;
  newBest?: boolean;
  power?: number;
}
type Recipe = (r: Rig, t: number, o: SfxOpts) => number;
const F = { f2: 87.31, ab2: 103.83, c3: 130.81, eb3: 155.56, f3: 174.61, ab3: 207.65, c4: 261.63, eb4: 311.13, f4: 349.23, ab4: 415.3, c5: 523.25, f5: 698.46 };
const climb = (i = 0): number => Math.pow(2, Math.min(i, 9) * 2 / 12);

// ---------- UI ----------
const tap: Recipe = (r, t, o) => { const v = o.v ?? 1; click(r, t, 0.6 * v, 4200, 0.012); osc(r, 'square', 1500, 800, t, 0.04, 0.2 * v, { lp: 5200 }); sub(r, t, 190, 90, 0.08, 0.6 * v); return 0.14; };
const confirm: Recipe = (r, t, o) => {
  const v = o.v ?? 1;
  click(r, t, 0.6 * v, 3500); sub(r, t, 130, 62, 0.16, 0.85 * v);
  osc(r, 'square', 520, 780, t, 0.1, 0.22 * v, { lp: 4200, rev: 0.2 });
  osc(r, 'square', 780, 1170, t + 0.07, 0.12, 0.2 * v, { lp: 4200, rev: 0.25 });
  nz(r, t, 0.05, 0.25 * v, { f0: 4500, q: 1.5 }); return 0.3;
};
const back: Recipe = (r, t, o) => { const v = o.v ?? 1; click(r, t, 0.6 * v, 2500); osc(r, 'square', 760, 300, t, 0.1, 0.3 * v, { lp: 3500 }); sub(r, t, 150, 55, 0.14, 0.55 * v); return 0.2; };
const tab: Recipe = (r, t, o) => {
  const v = o.v ?? 1, R = rng(7);
  sub(r, t, 140, 50, 0.16, 0.6 * v); osc(r, 'square', 380, 160, t, 0.08, 0.3 * v, { lp: 2400, crush: 4 });
  [0, 0.03, 0.055, 0.1, 0.12].forEach((dl, k) => {
    nz(r, t + dl, 0.03, 0.4 * v, { f0: 800 + R() * 6000, q: 3, crush: 3, a: 0.001 });
    if (k % 2) osc(r, 'square', 300 + R() * 1800, 200 + R() * 900, t + dl, 0.03, 0.14 * v, { crush: 3 });
  });
  osc(r, 'sawtooth', 2400, 220, t + 0.02, 0.14, 0.2 * v, { crush: 4, lp: 5000 }); return 0.26;
};
const cardSelect: Recipe = (r, t, o) => { const v = o.v ?? 1; click(r, t, 0.55 * v, 6000, 0.01); osc(r, 'triangle', 1900, 1250, t, 0.06, 0.28 * v); osc(r, 'square', 3300, 2900, t, 0.025, 0.1 * v); sub(r, t, 210, 120, 0.07, 0.55 * v); return 0.12; };
const cardPlay: Recipe = (r, t, o) => {
  const v = o.v ?? 1;
  nz(r, t, 0.1, 0.5 * v, { f0: 500, f1: 3500, q: 0.9, a: 0.04 });
  const s = t + 0.075;
  nz(r, s, 0.08, 1.0 * v, { f0: 2400, f1: 800, q: 0.9, a: 0.001, gate: 0.4 });
  click(r, s, 0.7 * v, 3000); osc(r, 'sine', 240, 70, s, 0.16, 0.95 * v, { sat: 3 }); sub(r, s, 95, 42, 0.26, 0.85 * v);
  osc(r, 'triangle', 420, 200, s, 0.06, 0.3 * v); return 0.5;
};
const trapSet: Recipe = (r, t, o) => {
  const v = o.v ?? 1;
  sub(r, t, 95, 40, 0.3, 0.95 * v); nz(r, t, 0.09, 0.7 * v, { f0: 1500, f1: 500, q: 1.2 });
  for (const f of [310, 477, 913]) osc(r, 'square', f, f * 0.98, t, 0.14, 0.13 * v, { lp: 2500 });
  const k = t + 0.13;
  click(r, k, 0.8 * v, 5000, 0.01); osc(r, 'square', 2600, 2400, k, 0.025, 0.18 * v); click(r, k + 0.06, 0.9 * v, 6500, 0.01); osc(r, 'square', 1700, 1500, k + 0.06, 0.04, 0.2 * v);
  sub(r, k + 0.06, 160, 70, 0.1, 0.6 * v); return 0.45;
};
const moTick: Recipe = (r, t, o) => {
  const v = o.v ?? 1, L = o.level ?? 0.5, f = 520 + L * 900;
  click(r, t, 0.5 * v, 7000, 0.01); osc(r, 'square', f, f * 1.5, t, 0.07, 0.28 * v, { lp: 5000 }); sub(r, t, 120 + L * 40, 70, 0.1, 0.65 * v); return 0.15;
};
const moSurge: Recipe = (r, t, o) => {
  const v = o.v ?? 1;
  sweepSaw(r, t, 0.38, 90, 1100, 300, 7000, 0.4 * v);
  nz(r, t, 0.38, 0.5 * v, { f0: 600, f1: 7000, q: 1.2, a: 0.2 });
  const b = t + 0.4;
  sub(r, b, 110, 34, 0.7, 1.0 * v); click(r, b, 0.8 * v, 3000, 0.02); nz(r, b, 0.3, 0.7 * v, { ft: 'lowpass', f0: 5000, f1: 300, a: 0.002, gate: 0.3 });
  uni(r, 'sawtooth', [F.f3, F.ab3, F.c4, F.f4], b, 0.5, 0.5 * v, { lp: 3500, rev: 0.25, a: 0.004 });
  osc(r, 'sine', 3136, 3136, b + 0.02, 0.4, 0.12 * v, { rev: 0.3 }); return 1.1;
};

// ---------- shots ----------
const shotRelease: Recipe = (r, t, o) => {
  const v = o.v ?? 1, p = o.power ?? 0.6;
  nz(r, t, 0.2, (0.45 + p * 0.2) * v, { f0: 350, f1: 2800, q: 1.1, a: 0.06 });
  nz(r, t + 0.02, 0.15, 0.2 * v, { ft: 'highpass', f0: 3000, f1: 8000, a: 0.06 });
  click(r, t + 0.07, 0.5 * v, 5000, 0.01); sub(r, t + 0.07, 130, 70, 0.1, 0.55 * v); return 0.3;
};
const swish: Recipe = (r, t, o) => {
  const v = o.v ?? 1;
  nz(r, t, 0.34, 0.6 * v, { f0: 6500, f1: 3200, q: 1.3, a: 0.008, rev: 0.25 });
  nz(r, t + 0.045, 0.22, 0.35 * v, { ft: 'highpass', f0: 5000, a: 0.01 });
  nz(r, t, 0.1, 0.4 * v, { f0: 1800, f1: 900, q: 0.8 });
  sub(r, t + 0.01, 150, 80, 0.1, 0.45 * v); return 0.4;
};
const rim: Recipe = (r, t, o) => {
  const v = o.v ?? 1;
  click(r, t, 0.8 * v, 4000, 0.012); sub(r, t, 140, 55, 0.2, 0.85 * v);
  [[412, 0.4], [683, 0.34], [1127, 0.25], [1581, 0.16]].forEach(([f, d], k) => osc(r, k % 2 ? 'triangle' : 'square', f, f * 0.995, t, d, (0.2 - k * 0.03) * v, { lp: 4800, rev: 0.2 }));
  nz(r, t, 0.12, 0.5 * v, { f0: 2800, q: 2 }); return 0.5;
};
const backboard: Recipe = (r, t, o) => {
  const v = o.v ?? 1;
  osc(r, 'sine', 170, 75, t, 0.16, 0.7 * v, { sat: 3 }); sub(r, t, 100, 48, 0.24, 0.5 * v); osc(r, 'triangle', 480, 230, t, 0.09, 0.5 * v, { sat: 2 });
  nz(r, t, 0.07, 0.9 * v, { f0: 1100, q: 1.2 }); click(r, t, 0.5 * v, 3000);
  osc(r, 'square', 520, 505, t, 0.16, 0.14 * v, { lp: 2000, rev: 0.2 }); return 0.3;
};
const dunk: Recipe = (r, t, o) => {
  const v = o.v ?? 1;
  sub(r, t, 120, 30, 0.7, 1.05 * v, { gate: 0.3 }); osc(r, 'sine', 260, 60, t, 0.2, 0.8 * v, { sat: 4 });
  nz(r, t, 0.18, 0.9 * v, { ft: 'lowpass', f0: 5000, f1: 400, a: 0.001, gate: 0.4 }); click(r, t, 0.9 * v, 3000, 0.02);
  [[390, 0.5], [655, 0.42], [1090, 0.3]].forEach(([f, d], k) => osc(r, 'square', f, f * 0.99, t + 0.03, d, (0.16 - k * 0.03) * v, { lp: 3800, rev: 0.25 }));
  nz(r, t + 0.12, 0.3, 0.3 * v, { f0: 6000, f1: 3000, q: 1.2, a: 0.01 }); return 0.9;
};
const layup: Recipe = (r, t, o) => {
  const v = o.v ?? 1;
  backboard(r, t, { v: 0.65 * v }); swish(r, t + 0.12, { v: 0.9 * v }); return 0.55;
};
const block: Recipe = (r, t, o) => {
  const v = o.v ?? 1;
  nz(r, t, 0.05, 1.1 * v, { f0: 3200, f1: 1800, q: 0.9, a: 0.0008, gate: 0.4 }); click(r, t, 0.9 * v, 2500, 0.02);
  osc(r, 'triangle', 520, 190, t, 0.12, 0.8 * v, { sat: 2 }); osc(r, 'square', 330, 150, t, 0.08, 0.2 * v, { lp: 1800 }); sub(r, t, 130, 42, 0.4, 0.8 * v, { gate: 0.3 });
  const sw = t + 0.04;
  osc(r, 'sine', 80, 27, sw, 0.6, 0.6 * v, { sat: 2 }); nz(r, sw, 0.5, 0.45 * v, { ft: 'lowpass', f0: 4500, f1: 150, a: 0.004, rev: 0.3 });
  osc(r, 'square', 1700, 1690, sw, 0.3, 0.09 * v, { rev: 0.4 }); return 0.7;
};
const steal: Recipe = (r, t, o) => {
  const v = o.v ?? 1;
  nz(r, t, 0.13, 0.9 * v, { ft: 'highpass', f0: 1800, f1: 9500, q: 1.5, a: 0.004 }); nz(r, t, 0.1, 0.6 * v, { f0: 2500, f1: 7000, q: 3 });
  osc(r, 'sawtooth', 1800, 260, t, 0.1, 0.35 * v, { lp: 5000, crush: 5 }); click(r, t + 0.09, 0.9 * v, 5000, 0.012);
  sub(r, t + 0.09, 160, 60, 0.14, 0.75 * v); return 0.3;
};
const turnover: Recipe = (r, t, o) => {
  const v = o.v ?? 1;
  osc(r, 'sawtooth', 233, 116, t, 0.3, 0.38 * v, { crush: 4, lp: 1800 }); osc(r, 'sawtooth', 247, 123, t, 0.3, 0.3 * v, { crush: 4, lp: 1800 });
  osc(r, 'square', 349, 175, t + 0.12, 0.2, 0.18 * v, { crush: 3, lp: 2500 });
  sub(r, t, 110, 38, 0.4, 0.9 * v); nz(r, t, 0.08, 0.55 * v, { f0: 1400, q: 1 }); return 0.5;
};
const whistle: Recipe = (r, t, o) => {
  const v = o.v ?? 1;
  for (const [at, len] of [[0, 0.2], [0.25, 0.42]] as [number, number][]) {
    const lfo = r.ctx.createOscillator(), lg = r.ctx.createGain();
    lfo.frequency.value = 36; lg.gain.value = 110; lfo.connect(lg);
    osc(r, 'triangle', 3000, 3000, t + at, len, 0.42 * v, { a: 0.006, hold: len * 0.5, rev: 0.2 });
    // vibrato: modulate a second whistle partial, built by hand so the LFO can reach the frequency
    const o2 = r.ctx.createOscillator(), g2 = r.ctx.createGain();
    o2.type = 'square'; o2.frequency.value = 3010; lg.connect(o2.frequency);
    g2.gain.setValueAtTime(0.0001, t + at); g2.gain.exponentialRampToValueAtTime(0.06 * v, t + at + 0.006); g2.gain.setValueAtTime(0.06 * v, t + at + 0.006 + len * 0.5); g2.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.006 + len * 1.5);
    o2.connect(g2); g2.connect(r.out);
    lfo.start(t + at); o2.start(t + at); lfo.stop(t + at + len * 1.5 + 0.05); o2.stop(t + at + len * 1.5 + 0.05);
    nz(r, t + at, len, 0.12 * v, { ft: 'highpass', f0: 5500, a: 0.01 });
  }
  return 0.75;
};
const andOne: Recipe = (r, t, o) => {
  const v = o.v ?? 1;
  sub(r, t, 115, 36, 0.5, 1.0 * v); nz(r, t, 0.1, 0.8 * v, { f0: 2200, f1: 700, q: 0.9, gate: 0.3 }); click(r, t, 0.8 * v, 3000);
  whistle(r, t + 0.07, { v: 0.9 * v }); return 0.9;
};
const roar: Recipe = (r, t, o) => {
  const v = o.v ?? 1, L = o.level ?? 0.6, d = 1.0 + L * 1.4, pk = (0.34 + L * 0.3) * v;
  const lfo = r.ctx.createOscillator(), lg = r.ctx.createGain();
  lfo.frequency.value = 6.5; lg.gain.value = 0.05 * pk; lfo.connect(lg);
  const main = nz(r, t, d, pk, { f0: 650, f1: 1150, q: 0.7, a: 0.3, hold: 0.1 + L * 0.35, rev: 0.3 });
  lg.connect(main.gain); lfo.start(t); lfo.stop(t + d + 0.5);
  nz(r, t, d * 0.9, pk * 0.65, { f0: 2500, f1: 3400, q: 0.6, a: 0.34, hold: 0.1 + L * 0.2 });
  nz(r, t, d, pk * 0.7, { ft: 'lowpass', f0: 320, q: 0.5, a: 0.22, hold: 0.2 + L * 0.3 });
  const rr = rng(11);
  for (let k = 0; k < 2 + Math.round(L * 5); k++) nz(r, t + 0.3 + k * (0.1 + rr() * 0.05), 0.06, 0.18 * L * v, { f0: 1400 + rr() * 600, q: 1.4 });
  return d + 0.5;
};
const groan: Recipe = (r, t, o) => {
  const v = o.v ?? 1;
  nz(r, t, 0.75, 0.4 * v, { f0: 1000, f1: 280, q: 2.2, a: 0.12, hold: 0.1, rev: 0.2 });
  osc(r, 'sawtooth', 190, 85, t, 0.7, 0.2 * v, { lp: 600, a: 0.1, det: 6 }); osc(r, 'sawtooth', 143, 70, t, 0.7, 0.2 * v, { lp: 500, a: 0.1, det: -6 });
  sub(r, t + 0.02, 80, 45, 0.4, 0.4 * v); return 0.9;
};
const fireOn: Recipe = (r, t, o) => {
  const v = o.v ?? 1, R = rng(21);
  sub(r, t, 90, 34, 0.5, 0.95 * v); nz(r, t, 0.07, 0.6 * v, { f0: 1000, q: 1 });
  nz(r, t + 0.04, 0.6, 0.55 * v, { ft: 'lowpass', f0: 250, f1: 7000, q: 1.2, a: 0.25, rev: 0.25 });
  sweepSaw(r, t + 0.04, 0.55, 150, 900, 300, 5000, 0.3 * v);
  for (let k = 0; k < 14; k++) click(r, t + 0.1 + R() * 0.6, 0.35 * v, 3500 + R() * 4000, 0.008);
  uni(r, 'sawtooth', [F.f3, F.c4, F.f4], t + 0.55, 0.45, 0.35 * v, { lp: 3000, rev: 0.25 }); return 1.1;
};
const heartbeat: Recipe = (r, t, o) => {
  const v = o.v ?? 1;
  sub(r, t, 85, 40, 0.18, 0.8 * v); osc(r, 'triangle', 240, 110, t, 0.1, 0.45 * v, { sat: 3 }); osc(r, 'sine', 75, 38, t + 0.17, 0.2, 0.6 * v, { sat: 3 }); sub(r, t + 0.17, 80, 40, 0.18, 0.4 * v);
  osc(r, 'triangle', 220, 100, t + 0.17, 0.09, 0.35 * v, { sat: 3 }); nz(r, t, 0.05, 0.25 * v, { f0: 700, q: 1 }); return 0.45;
};
const clutchRiser: Recipe = (r, t, o) => {
  const v = o.v ?? 1, d = (o.ms ?? 1600) / 1000;
  sweepSaw(r, t, d, 70, 360, 250, 3200, 0.38 * v);
  nz(r, t, d, 0.4 * v, { f0: 500, f1: 6000, q: 1.2, a: d * 0.5 });
  let gap = 0.62, at = 0;
  while (at < d - 0.2) { heartbeat(r, t + at, { v: 0.85 * v }); at += gap; gap = Math.max(0.28, gap * 0.86); }
  return d + 0.2;
};
const glitchSting: Recipe = (r, t, o) => {
  const lv = Math.max(1, Math.min(3, Math.round(o.rank ?? 1))), v = o.v ?? 1, R = rng(31 + lv);
  const sc = [0, 0.8, 0.95, 1.1][lv];
  // digital tearing: stuttering crushed blips and noise slices
  const n = 6 + lv * 5;
  for (let k = 0; k < n; k++) {
    const at = t + k * (0.035 - lv * 0.004) + R() * 0.012;
    osc(r, 'square', 180 + R() * 2400, 120 + R() * 1400, at, 0.035, 0.2 * sc * v, { crush: 3, a: 0.001 });
    if (k % 2 === 0) nz(r, at, 0.03, 0.4 * sc * v, { f0: 1500 + R() * 6000, q: 4, crush: 3, a: 0.001 });
  }
  sub(r, t, 130, 40, 0.35 + lv * 0.15, 0.75 * sc * v);
  osc(r, 'sawtooth', 2600, 70, t + 0.03, 0.2 + lv * 0.12, 0.28 * sc * v, { crush: 4, lp: 6000 });
  if (lv >= 2) {
    osc(r, 'sawtooth', 3400, 55, t + 0.06, 0.55, 0.3 * v, { crush: 3, lp: 7000, det: 20 });
    sub(r, t + 0.04, 150, 30, 0.7, 0.95 * v, { gate: 0.3 });
    for (let k = 0; k < 8; k++) nz(r, t + 0.15 + k * 0.05, 0.025, 0.5 * v, { ft: 'highpass', f0: 3000 + R() * 3000, crush: 2, a: 0.001 });
    nz(r, t - 0.0, 0.3, 0.35 * v, { f0: 8000, f1: 400, q: 0.8, a: 0.002, rev: 0.2 });
  }
  if (lv >= 3) {
    sub(r, t, 160, 26, 1.1, 1.05 * v, { gate: 0.25 });
    nz(r, t + 0.1, 1.1, 0.5 * v, { ft: 'lowpass', f0: 9000, f1: 200, q: 0.7, a: 0.005, rev: 0.3, crush: 5 });
    for (const [k, f] of [880, 880, 880].entries()) osc(r, 'square', f, f, t + 0.2 + k * 0.17, 0.08, 0.28 * v, { crush: 3, a: 0.002, rev: 0.2 });
    for (let k = 0; k < 10; k++) osc(r, 'square', 150 + R() * 3000, 90 + R() * 600, t + 0.45 + k * 0.045, 0.04, 0.2 * v, { crush: 3, a: 0.001 });
    const b = t + 0.72;
    click(r, b, 0.9 * v, 3000, 0.02); sub(r, b, 140, 34, 0.5, 0.95 * v); nz(r, b, 0.25, 0.9 * v, { f0: 2400, f1: 700, q: 0.9, gate: 0.5 });
    uni(r, 'sawtooth', [F.f3, F.ab3, 246.94, F.f4], b, 0.75, 0.5 * v, { lp: 3500, crush: 5, rev: 0.3 });
  }
  return [0, 0.8, 1.3, 2.1][lv];
};
const subSwap: Recipe = (r, t, o) => {
  const v = o.v ?? 1;
  nz(r, t, 0.14, 0.5 * v, { f0: 500, f1: 4000, q: 1, a: 0.04 }); nz(r, t + 0.13, 0.16, 0.5 * v, { f0: 4000, f1: 400, q: 1, a: 0.02 });
  osc(r, 'square', 330, 660, t, 0.11, 0.2 * v, { lp: 4000 }); osc(r, 'square', 660, 330, t + 0.13, 0.13, 0.2 * v, { lp: 4000 });
  sub(r, t + 0.12, 130, 60, 0.18, 0.8 * v); click(r, t + 0.12, 0.6 * v, 4000); return 0.4;
};

// ---------- rewards ----------
const bell = (r: Rig, t: number, f: number, pk: number, dur: number): void => {
  osc(r, 'sine', f, f, t, dur, pk, { rev: 0.3, a: 0.002 }); osc(r, 'sine', f * 2.76, f * 2.76, t, dur * 0.4, pk * 0.35, { a: 0.002 });
  osc(r, 'triangle', f * 2, f * 2, t, dur * 0.6, pk * 0.3, { a: 0.002 });
};
const coin: Recipe = (r, t, o) => {
  const v = o.v ?? 1;
  click(r, t, 0.55 * v, 7000, 0.01); osc(r, 'square', 1319, 1319, t, 0.07, 0.2 * v, { lp: 5000 }); osc(r, 'square', 1976, 1976, t + 0.07, 0.22, 0.2 * v, { lp: 6000, rev: 0.3 });
  bell(r, t + 0.07, 1976, 0.3 * v, 0.4); sub(r, t, 150, 80, 0.1, 0.5 * v); return 0.5;
};
const shard: Recipe = (r, t, o) => {
  const v = o.v ?? 1, R = rng(5);
  click(r, t, 0.5 * v, 8000, 0.01); bell(r, t, 2349, 0.3 * v, 0.35); bell(r, t + 0.06, 3136, 0.22 * v, 0.3);
  for (let k = 0; k < 5; k++) osc(r, 'sine', 4000 + R() * 4000, 4000 + R() * 4000, t + 0.03 + k * 0.04, 0.08, 0.1 * v, { a: 0.001 });
  sub(r, t, 140, 75, 0.1, 0.5 * v); return 0.45;
};
const levelUp: Recipe = (r, t, o) => {
  const v = o.v ?? 1, notes = [F.f3, F.ab3, F.c4, F.f4, F.ab4];
  sub(r, t, 120, 40, 0.5, 0.95 * v); click(r, t, 0.7 * v, 3500);
  notes.forEach((f, k) => uni(r, 'sawtooth', [f, f * 2], t + 0.06 + k * 0.075, 0.28, 0.32 * v, { lp: 4000, rev: 0.25, a: 0.003 }));
  const e = t + 0.45;
  uni(r, 'sawtooth', [F.f3, F.c4, F.f4, F.ab4], e, 0.6, 0.45 * v, { lp: 5000, rev: 0.3 }); bell(r, e, 2093, 0.25 * v, 0.6); nz(r, e, 0.5, 0.25 * v, { ft: 'highpass', f0: 7000, a: 0.01 }); return 1.2;
};
const reward: Recipe = (r, t, o) => {
  const v = o.v ?? 1;
  sub(r, t, 110, 38, 0.55, 1.0 * v); nz(r, t, 0.1, 0.7 * v, { f0: 2200, f1: 800, q: 0.9, gate: 0.3 }); click(r, t, 0.8 * v, 3200);
  uni(r, 'sawtooth', [F.f3, F.c4], t + 0.03, 0.4, 0.42 * v, { lp: 3200, rev: 0.25 });
  uni(r, 'sawtooth', [F.ab3, F.eb4, F.ab4], t + 0.2, 0.55, 0.42 * v, { lp: 3600, rev: 0.3 });
  coin(r, t + 0.36, { v: 0.9 * v }); return 1.0;
};

// ---------- packs ----------
const packRip: Recipe = (r, t, o) => {
  const v = o.v ?? 1, R = rng(13), rank = o.rank ?? 0, d = 0.38 + rank * 0.03;
  nz(r, t, d, 0.55 * v, { f0: 700, f1: 6500, q: 0.9, a: 0.02 });
  for (let k = 0; k < 26; k++) nz(r, t + k * (d / 26), 0.012, (0.25 + R() * 0.3) * v, { ft: 'highpass', f0: 2500 + R() * 4000, a: 0.0008 });
  const s = t + d;
  click(r, s, 0.9 * v, 3000, 0.02); nz(r, s, 0.12, 0.8 * v, { f0: 2400, f1: 900, q: 0.8, gate: 0.4 }); sub(r, s, 130, 45, 0.3, 0.95 * v);
  osc(r, 'sawtooth', 1200, 90, s, 0.15, 0.2 * v, { lp: 4000, crush: 5 }); return d + 0.4;
};
const packCharge: Recipe = (r, t, o) => {
  const v = o.v ?? 1, rank = o.rank ?? 0, m = climb(o.i ?? 0), d = (o.ms ?? 1200) / 1000;
  if (rank < 1) return 0;
  const pk = (0.3 + rank * 0.07) * v;
  sweepSaw(r, t, d, 48 * m, (95 + rank * 28) * m, 180, 300 + rank * 600, pk);
  osc(r, 'sine', 38 * m, 70 * m, t, d, 0.01, { a: d * 0.9 }); // slow sub swell
  const sw = swell(r, t, d, 0.55 * v), so = r.ctx.createOscillator();
  so.type = 'sine'; so.frequency.setValueAtTime(34 * m, t); so.frequency.exponentialRampToValueAtTime(62 * m, t + d); so.connect(sw); sw.connect(r.out); so.start(t); so.stop(t + d + 0.1);
  if (rank >= 2) { const g = swell(r, t, d, 0.1 * v), w = r.ctx.createOscillator(); w.type = 'sine'; w.frequency.setValueAtTime(500 * m, t); w.frequency.exponentialRampToValueAtTime((1400 + rank * 300) * m, t + d); w.connect(g); g.connect(r.out); w.start(t); w.stop(t + d + 0.1); }
  if (rank >= 3) nz(r, t + d * 0.3, d * 0.7, 0.28 * v, { f0: 1500, f1: 8000, q: 1, a: d * 0.55 });
  if (rank >= 3) for (let k = 0; k < rank * 2; k++) { const at = t + d * (0.4 + 0.6 * (k / (rank * 2))); sub(r, at, 80, 50, 0.1, 0.3 * v * (0.6 + k / (rank * 3))); }
  return d + 0.1;
};
const packReveal: Recipe = (r, t, o) => {
  const v = o.v ?? 1, rank = Math.max(0, Math.min(5, Math.round(o.rank ?? 0))), m = climb(o.i ?? 0), R = rng(41 + rank);
  const bf = [96, 104, 112, 120, 128, 140][rank], bd = 0.22 + rank * 0.13;
  sub(r, t, bf, 34, bd, (0.65 + rank * 0.07) * v, { gate: rank >= 2 ? 0.3 : 0 }); click(r, t, 0.7 * v, 3500, 0.016);
  nz(r, t, 0.08 + rank * 0.02, (0.5 + rank * 0.06) * v, { f0: 2500, f1: 800, q: 0.9 });
  const base = F.c5 * m, set = rank >= 4 ? [1, 1.2, 1.5, 2] : rank >= 2 ? [1, 1.2, 1.5] : rank >= 1 ? [1, 1.5] : [1];
  set.forEach((q, k) => bell(r, t + 0.02 + k * 0.07, base * q, 0.26 * v, 0.35 + rank * 0.1));
  if (rank >= 3) uni(r, 'sawtooth', [F.f3, F.ab3, F.c4].map((f) => f * m), t, 0.5 + rank * 0.06, 0.3 * v, { lp: 3000, rev: 0.3 });
  if (rank >= 3) for (let k = 0; k < 6 + rank * 2; k++) osc(r, 'sine', 3000 + R() * 5000, 3000 + R() * 5000, t + 0.1 + k * 0.045, 0.1, 0.1 * v, { a: 0.001, rev: 0.2 });
  if (rank >= 4) nz(r, t, 0.9, 0.5 * v, { ft: 'highpass', f0: 3500, f1: 1500, a: 0.004, rev: 0.3 });
  if (o.newBest) {
    const t2 = t + 0.34;
    [1.5, 2, 2.5, 3].forEach((q, k) => osc(r, 'square', base * q * 0.5, base * q * 0.5, t2 + k * 0.06, 0.16, 0.14 * v, { lp: 5000, crush: 5, rev: 0.2 }));
    nz(r, t2, 0.3, 0.3 * v, { ft: 'highpass', f0: 6000, a: 0.01 });
  }
  return 0.8 + rank * 0.15;
};
const iconicHit: Recipe = (r, t, o) => {
  const v = o.v ?? 1, R = rng(77);
  // glitch tear
  for (let k = 0; k < 16; k++) {
    const at = t + k * 0.03 + R() * 0.01;
    osc(r, 'square', 150 + R() * 3200, 100 + R() * 800, at, 0.03, 0.22 * v, { crush: 3, a: 0.001 }); if (k % 2) nz(r, at, 0.025, 0.5 * v, { f0: 1000 + R() * 7000, q: 4, crush: 3, a: 0.001 });
  }
  osc(r, 'sawtooth', 3600, 60, t + 0.02, 0.5, 0.3 * v, { crush: 3, lp: 7000, det: 14 });
  // heavy drop
  const b = t + 0.5;
  sub(r, b, 150, 27, 1.3, 1.05 * v, { gate: 0.3 }); osc(r, 'sine', 300, 55, b, 0.25, 0.85 * v, { sat: 4 }); click(r, b, 1.0 * v, 3000, 0.02);
  nz(r, b, 0.35, 1.0 * v, { ft: 'lowpass', f0: 7000, f1: 250, a: 0.001, gate: 0.5, rev: 0.3 });
  uni(r, 'sawtooth', [F.f3, F.ab3, F.c4, F.f4], b, 1.0, 0.55 * v, { lp: 3800, crush: 6, rev: 0.35 });
  uni(r, 'square', [F.f4, F.c5], b + 0.12, 0.8, 0.22 * v, { lp: 4500, rev: 0.4 });
  nz(r, b + 0.1, 1.0, 0.35 * v, { ft: 'highpass', f0: 7000, a: 0.02, rev: 0.3 });
  for (let k = 0; k < 8; k++) osc(r, 'sine', 3500 + R() * 5000, 3500 + R() * 5000, b + 0.2 + k * 0.07, 0.15, 0.1 * v, { a: 0.001, rev: 0.3 });
  return 2.1;
};
/** Every card flip: a hard slap (noise crack + snapping body tone) over a short sub thump. rank 0 = plain tiers (quieter, still crisp), 4+ harder with a metallic edge. */
const flipSlap: Recipe = (r, t, o) => {
  const v = o.v ?? 1, rank = o.rank ?? 0, R = rng(5 + rank), hard = rank >= 4 ? 1 : rank >= 1 ? 0.5 : 0;
  // the THUMP: a deep impact (pitch-dropping sub + sine body, saturated), the weight of the sound
  sub(r, t, 170, 34, 0.34 + hard * 0.16, (1.3 + hard * 0.2) * v, { gate: 0.35 });
  osc(r, 'sine', 95, 30, t, 0.42 + hard * 0.2, 1.0 * v, { sat: 3, a: 0.002 });
  osc(r, 'sine', 210, 55, t, 0.12, 0.8 * v, { sat: 4, a: 0.001 });
  // the slap on top, kept short and crisp
  click(r, t, (0.8 + hard * 0.2) * v, 2800, 0.02);
  nz(r, t, 0.045 + hard * 0.03, (0.7 + hard * 0.2) * v, { ft: 'bandpass', f0: 3200, f1: 1100, q: 0.8, a: 0.0006, gate: 0.4 });
  osc(r, 'triangle', 1000, 170, t, 0.06, 0.4 * v, { sat: 3, a: 0.0008 });
  if (hard) for (let k = 0; k < 3; k++) osc(r, 'sine', 2600 + R() * 2400, 1800 + R() * 800, t + 0.01 + k * 0.012, 0.05, 0.1 * v, { a: 0.001, rev: 0.2 });
  return 0.6 + hard * 0.2;
};
/** HOLO reveal: the Iconic hit with a crushed glitch stutter, a second detuned drop and a longer tear on top. */
const hitHolo: Recipe = (r, t, o) => {
  const v = o.v ?? 1, R = rng(88);
  const len = iconicHit(r, t, { ...o, v: 1.0 * v });
  for (let k = 0; k < 14; k++) { const at = t + 0.5 + k * 0.035 + R() * 0.01; osc(r, 'square', 90 + R() * 1800, 60 + R() * 500, at, 0.04, 0.2 * v, { crush: 3, a: 0.001 }); nz(r, at, 0.03, 0.4 * v, { f0: 800 + R() * 6000, q: 5, crush: 3, a: 0.001 }); }
  sub(r, t + 0.5, 98, 22, 1.5, 0.9 * v, { gate: 0.3 }); osc(r, 'sawtooth', 5200, 80, t + 0.5, 0.7, 0.22 * v, { crush: 3, lp: 8000, det: 22 });
  return len + 0.3;
};
/** The long build-up before an Epic-or-better card turns: a rising rumble, a tearing riser, crackle and a held breath. Rank 4 = Epic or Legendary (identical), 5 = Iconic; level 1 = HOLO adds glitch stutter. */
const venitus: Recipe = (r, t, o) => {
  const v = o.v ?? 1, rank = o.rank ?? 4, d = (o.ms ?? 3400) / 1000, R = rng(91 + rank), holo = (o.level ?? 0) > 0;
  sweepSaw(r, t, d, 38, 100 + rank * 24, 110, 700 + rank * 800, (0.46 + rank * 0.06) * v, { crush: rank >= 5 ? 6 : 4 });
  sweepSaw(r, t, d, 39.6, 103 + rank * 24, 110, 600 + rank * 700, 0.3 * v);
  // pulses: sub thumps that come faster and harder toward the flip
  { let at = 0.35, gp = 0.7; while (at < d - 0.25) { sub(r, t + at, 90, 38, 0.14, (0.35 + 0.65 * at / d) * v); nz(r, t + at, 0.04, (0.2 + 0.4 * at / d) * v, { f0: 900, q: 1 }); at += gp; gp = Math.max(0.22, gp * 0.88); } }
  // the final snap just before the turn
  click(r, t + d - 0.04, 1.0 * v, 3000, 0.02); nz(r, t + d - 0.05, 0.08, 0.8 * v, { ft: 'highpass', f0: 4000, a: 0.002 });
  const sw = swell(r, t, d, 0.75 * v), so = r.ctx.createOscillator();
  so.type = 'sine'; so.frequency.setValueAtTime(30, t); so.frequency.exponentialRampToValueAtTime(64, t + d); so.connect(sw); sw.connect(r.out); so.start(t); so.stop(t + d + 0.1);
  nz(r, t, d, 0.7 * v, { ft: 'lowpass', f0: 180, f1: 3000, q: 1.3, a: d * 0.75 });
  nz(r, t + d * 0.3, d * 0.7, 0.3 * v, { ft: 'highpass', f0: 2500, f1: 9000, q: 1, a: d * 0.55 });
  osc(r, 'sine', 260, 1900, t + d * 0.55, d * 0.45, 0.22 * v, { a: d * 0.4, rev: 0.2 });
  const n = 10 + rank * 5 + (holo ? 14 : 0);
  for (let k = 0; k < n; k++) { const at = t + d * (0.25 + 0.7 * R()); click(r, at, (0.25 + 0.3 * (at - t) / d) * v, 3000 + R() * 4500, 0.01); if (holo && k % 2) osc(r, 'square', 200 + R() * 2600, 100 + R() * 800, at, 0.03, 0.16 * v, { crush: 3, a: 0.001 }); }
  return d + 0.1;
};
/** Epic reveal: the shared reveal plus a dark, heavy purple stab. */
const hitEpic: Recipe = (r, t, o) => {
  const v = o.v ?? 1;
  const len = packReveal(r, t, { ...o, rank: 3 });
  sub(r, t, 72, 28, 1.0, 1.1 * v, { gate: 0.35 }); osc(r, 'sine', 260, 45, t, 0.24, 0.95 * v, { sat: 5 }); click(r, t, 1.0 * v, 2600, 0.02);
  uni(r, 'sawtooth', [F.c3, F.eb3, F.ab3].map((f) => f * 2), t, 0.85, 0.4 * v, { lp: 2800, crush: 6, rev: 0.35 });
  nz(r, t, 0.5, 0.55 * v, { ft: 'lowpass', f0: 6500, f1: 200, a: 0.001, gate: 0.4, rev: 0.25 });
  return Math.max(len, 1.3);
};
/** Legendary reveal: bigger and brighter than Epic: a deep drop, a brass fanfare chord and a gold bell cascade. */
const hitLegendary: Recipe = (r, t, o) => {
  const v = o.v ?? 1, R = rng(63);
  const len = packReveal(r, t, { ...o, rank: 4 });
  sub(r, t, 52, 21, 1.6, 1.25 * v, { gate: 0.4 }); osc(r, 'sine', 320, 40, t, 0.3, 1.0 * v, { sat: 5 }); nz(r, t, 0.3, 0.9 * v, { ft: 'lowpass', f0: 8000, f1: 250, a: 0.001, gate: 0.5, rev: 0.3 }); click(r, t, 1.0 * v, 3000, 0.02);
  uni(r, 'sawtooth', [F.f3, F.c4, F.f4, F.c5], t, 1.3, 0.55 * v, { lp: 4200, rev: 0.4, hold: 0.1 });
  uni(r, 'square', [F.f4, F.ab4], t + 0.1, 0.9, 0.2 * v, { lp: 4800, rev: 0.4 });
  nz(r, t, 1.1, 0.5 * v, { ft: 'highpass', f0: 5500, f1: 2000, a: 0.01, rev: 0.35 });
  [1, 1.25, 1.5, 2, 2.5, 3].forEach((q, k) => bell(r, t + 0.12 + k * 0.07, F.c5 * q, 0.24 * v, 0.8));
  for (let k = 0; k < 10; k++) osc(r, 'sine', 3500 + R() * 5000, 3500 + R() * 5000, t + 0.2 + k * 0.06, 0.12, 0.1 * v, { a: 0.001, rev: 0.3 });
  return Math.max(len, 2.0);
};
const nextTick: Recipe = (r, t, o) => { const v = o.v ?? 1; click(r, t, 0.55 * v, 6500, 0.01); osc(r, 'square', 1600, 1400, t, 0.03, 0.2 * v, { lp: 5500 }); sub(r, t, 150, 80, 0.08, 0.6 * v); return 0.1; };
const summary: Recipe = (r, t, o) => {
  const v = o.v ?? 1;
  sub(r, t, 110, 36, 0.5, 0.9 * v); nz(r, t, 0.1, 0.7 * v, { f0: 2200, f1: 800, gate: 0.3 }); click(r, t, 0.7 * v, 3200);
  uni(r, 'sawtooth', [F.f3, F.c4, F.f4], t, 0.35, 0.42 * v, { lp: 3200, rev: 0.25 });
  uni(r, 'sawtooth', [F.ab3, F.eb4, F.ab4], t + 0.2, 0.35, 0.42 * v, { lp: 3400, rev: 0.25 });
  const e = t + 0.4;
  uni(r, 'sawtooth', [F.f3, F.c4, F.f4, F.c5], e, 0.9, 0.5 * v, { lp: 4000, rev: 0.35 }); sub(r, e, 100, 33, 0.8, 1.0 * v);
  nz(r, e, 0.6, 0.35 * v, { ft: 'highpass', f0: 6500, a: 0.01, rev: 0.2 }); bell(r, e + 0.05, 2093, 0.25 * v, 0.8); bell(r, e + 0.17, 3136, 0.2 * v, 0.7); return 1.5;
};
const boot: Recipe = (r, t, o) => {
  const v = o.v ?? 1, R = rng(3);
  // ENTER THE GRID: a power-up swell, relay clicks, then the hit
  const sw = swell(r, t, 1.0, 0.8 * v), so = r.ctx.createOscillator();
  so.type = 'sine'; so.frequency.setValueAtTime(30, t); so.frequency.exponentialRampToValueAtTime(70, t + 1.0); so.connect(sw); sw.connect(r.out); so.start(t); so.stop(t + 1.15);
  sweepSaw(r, t, 1.0, 55, 440, 120, 6000, 0.4 * v); nz(r, t + 0.2, 0.8, 0.4 * v, { ft: 'highpass', f0: 800, f1: 9000, q: 1, a: 0.6 });
  for (let k = 0; k < 6; k++) { click(r, t + 0.1 + k * 0.13 + R() * 0.03, 0.5 * v, 4000, 0.01); osc(r, 'square', 700 + k * 260, 700 + k * 260, t + 0.1 + k * 0.13, 0.03, 0.12 * v, { crush: 4 }); }
  const b = t + 1.05;
  sub(r, b, 120, 30, 1.0, 1.05 * v, { gate: 0.3 }); osc(r, 'sine', 260, 55, b, 0.2, 0.8 * v, { sat: 4 }); click(r, b, 0.9 * v, 3000, 0.02); nz(r, b, 0.3, 0.9 * v, { ft: 'lowpass', f0: 6000, f1: 300, a: 0.001, gate: 0.4 });
  uni(r, 'sawtooth', [F.f3, F.c4, F.f4], b, 0.9, 0.5 * v, { lp: 3500, crush: 6, rev: 0.35 }); uni(r, 'sawtooth', [F.ab3, F.eb4], b + 0.15, 0.7, 0.3 * v, { lp: 3500, rev: 0.35 });
  for (let k = 0; k < 7; k++) osc(r, 'sine', 3000 + R() * 5000, 3000 + R() * 5000, b + 0.1 + k * 0.06, 0.12, 0.09 * v, { a: 0.001, rev: 0.3 });
  return 2.3;
};
const bounce: Recipe = (r, t, o) => {
  const v = o.v ?? 1, p = o.power ?? 1;
  osc(r, 'sine', 170 - p * 50, 50, t, 0.18, (0.55 + p * 0.25) * v, { sat: 3 }); sub(r, t, 100, 42, 0.2, 0.4 * p * v);
  osc(r, 'triangle', 460, 210, t, 0.08, 0.8 * v, { sat: 2 }); osc(r, 'square', 300, 180, t, 0.05, 0.12 * v, { lp: 1600 }); nz(r, t, 0.06, (0.6 + p * 0.4) * v, { f0: 900, f1: 380, q: 0.8 }); click(r, t, 0.5 * p * v, 2500, 0.012); return 0.3;
};

// ---------- specials, fanfares ----------
/** An Iconic special going off: a glitch tear, a rising zap, two bells. */
const special: Recipe = (r, t, o) => {
  const v = o.v ?? 1, holo = (o.rank ?? 0) >= 3;
  const len = glitchSting(r, t, { ...o, rank: holo ? 3 : 2, v: 0.8 * v });
  sweepSaw(r, t + 0.05, 0.45, 180, 1500, 300, 6500, 0.35 * v);
  sub(r, t + 0.06, 140, 42, 0.5, 0.75 * v);
  bell(r, t + 0.32, F.c5 * 2, 0.24 * v, 0.55); bell(r, t + 0.4, F.f5 * 2, 0.2 * v, 0.55);
  if (holo) { bell(r, t + 0.48, F.c5 * 3, 0.2 * v, 0.7); nz(r, t + 0.3, 0.5, 0.3 * v, { ft: 'highpass', f0: 6500, a: 0.01, rev: 0.3 }); }
  return Math.max(len, holo ? 1.4 : 1.1);
};
/** Heavy brass-and-sub fanfare stinger. rank 0 = Iconic pull / win, 1 = HOLO (adds a glitch tear and bells), level scales a win. */
const triumphHit: Recipe = (r, t, o) => {
  const v = o.v ?? 1, holo = (o.rank ?? 0) >= 1, big = 0.8 + (o.level ?? 0.5) * 0.4, R = rng(55);
  if (holo) for (let k = 0; k < 10; k++) { const at = t + k * 0.028 + R() * 0.01; osc(r, 'square', 200 + R() * 3000, 120 + R() * 600, at, 0.03, 0.2 * v, { crush: 3, a: 0.001 }); }
  const b = t + (holo ? 0.3 : 0);
  sub(r, b, 130, 30, 1.2, 1.0 * v * big, { gate: 0.3 }); osc(r, 'sine', 280, 52, b, 0.22, 0.8 * v, { sat: 4 }); click(r, b, 0.9 * v, 3000, 0.02);
  nz(r, b, 0.4, 0.9 * v, { ft: 'lowpass', f0: 7000, f1: 300, a: 0.001, gate: 0.5, rev: 0.3 });
  uni(r, 'sawtooth', [F.f3, F.c4, F.f4], b, 0.5, 0.55 * v, { lp: 3600, crush: 6, rev: 0.3, hold: 0.05 });
  uni(r, 'sawtooth', [F.ab3, F.eb4, F.ab4], b + 0.26, 0.5, 0.55 * v, { lp: 3800, rev: 0.3, hold: 0.05 });
  uni(r, 'sawtooth', [F.c4, F.eb4 * 2 / 2, F.c5, F.f5 / 2], b + 0.52, 1.1, 0.6 * v, { lp: 4200, rev: 0.35, hold: 0.2 });
  nz(r, b + 0.5, 1.0, 0.35 * v, { ft: 'highpass', f0: 6500, a: 0.01, rev: 0.3 });
  [1, 1.5, 2, 3].forEach((q, k) => bell(r, b + 0.55 + k * 0.08, F.c5 * q, 0.24 * v, 0.7 + (holo ? 0.3 : 0)));
  return 2.2 + (holo ? 0.3 : 0);
};
/** A lighter loss sound: two low falling notes and a soft thud. */
const defeat: Recipe = (r, t, o) => {
  const v = o.v ?? 1;
  sub(r, t, 90, 40, 0.45, 0.7 * v); click(r, t, 0.4 * v, 2200, 0.012);
  uni(r, 'sawtooth', [F.c3, F.eb3], t + 0.02, 0.5, 0.3 * v, { lp: 1400, rev: 0.3 });
  uni(r, 'sawtooth', [F.ab2, F.c3], t + 0.4, 0.8, 0.3 * v, { lp: 1100, rev: 0.4, glide: 0.94 });
  sub(r, t + 0.4, 70, 34, 0.7, 0.6 * v);
  return 1.4;
};

export interface SoundDef { fn: Recipe; /** 0 may be dropped when busy, 2 always plays */ pri: 0 | 1 | 2; /** rough voice cost */ cost: number; cat: 'ui' | 'play' | 'big'; trim: number }
const d = (fn: Recipe, pri: 0 | 1 | 2, cost: number, cat: SoundDef['cat']): SoundDef => ({ fn, pri, cost, cat, trim: 1 });
export const SOUNDS = {
  tap: d(tap, 0, 3, 'ui'), confirm: d(confirm, 1, 6, 'ui'), back: d(back, 0, 3, 'ui'), tab: d(tab, 1, 8, 'ui'), cardSelect: d(cardSelect, 0, 4, 'ui'),
  cardPlay: d(cardPlay, 1, 8, 'play'), trapSet: d(trapSet, 1, 9, 'play'), moTick: d(moTick, 0, 4, 'ui'), moSurge: d(moSurge, 2, 16, 'big'),
  shotRelease: d(shotRelease, 1, 6, 'play'), swish: d(swish, 1, 7, 'play'), rim: d(rim, 1, 9, 'play'), backboard: d(backboard, 1, 7, 'play'), dunk: d(dunk, 2, 14, 'big'), layup: d(layup, 1, 12, 'play'),
  block: d(block, 2, 12, 'big'), steal: d(steal, 1, 8, 'play'), turnover: d(turnover, 1, 8, 'play'), whistle: d(whistle, 1, 8, 'play'), andOne: d(andOne, 2, 14, 'big'),
  roar: d(roar, 1, 10, 'play'), groan: d(groan, 1, 6, 'play'), fireOn: d(fireOn, 2, 24, 'big'), heartbeat: d(heartbeat, 1, 6, 'play'), clutchRiser: d(clutchRiser, 2, 26, 'big'),
  glitch1: d((r, t, o) => glitchSting(r, t, { ...o, rank: 1 }), 2, 22, 'big'), glitch2: d((r, t, o) => glitchSting(r, t, { ...o, rank: 2 }), 2, 36, 'big'), glitch3: d((r, t, o) => glitchSting(r, t, { ...o, rank: 3 }), 2, 56, 'big'),
  subSwap: d(subSwap, 1, 8, 'play'), coin: d(coin, 1, 8, 'ui'), shard: d(shard, 1, 12, 'ui'), levelUp: d(levelUp, 2, 24, 'big'), reward: d(reward, 2, 26, 'big'),
  packRip: d(packRip, 2, 36, 'big'), packCharge: d(packCharge, 2, 16, 'play'), packReveal: d(packReveal, 2, 22, 'big'), iconicHit: d(iconicHit, 2, 52, 'big'),
  venitus: d(venitus, 2, 30, 'play'), flipSlap: d(flipSlap, 2, 14, 'big'), hitHolo: d(hitHolo, 2, 80, 'big'), hitEpic: d(hitEpic, 2, 44, 'big'), hitLegendary: d(hitLegendary, 2, 60, 'big'),
  special: d((r, t, o) => special(r, t, { ...o, rank: 2 }), 2, 44, 'big'), specialHolo: d((r, t, o) => special(r, t, { ...o, rank: 3 }), 2, 62, 'big'),
  triumphHit: d(triumphHit, 2, 56, 'big'), victory: d((r, t, o) => triumphHit(r, t, { ...o, rank: 0, level: o.level ?? 0.5 }), 2, 56, 'big'), defeat: d(defeat, 1, 16, 'play'),
  nextTick: d(nextTick, 0, 3, 'ui'), summary: d(summary, 2, 30, 'big'), boot: d(boot, 2, 40, 'big'), bounce: d(bounce, 1, 6, 'play'),
} satisfies Record<string, SoundDef>;
export type SfxName = keyof typeof SOUNDS;
for (const k of Object.keys(SOUNDS) as SfxName[]) SOUNDS[k].trim = TRIMS[k] ?? 1;
