// Music loops, generated step by step with Web Audio (no audio files). Three tracks share a dark F minor palette:
//   pack  : 92 BPM boom-bap / trap hybrid, the full beat (hard kick, sub 808, gated snare, hats, gritty bass, pad and bitcrushed arp).
//   game  : the same grid as a tension loop; layers come in with `intensity` (0 low drone and pulse ... 1 nearly the full beat).
//   title : 72 BPM dark-synth ambient for the splash and menus.
// Each track is a pure scheduler: step(buses, stepIndex, time, intensity). The live player (music.ts) and the offline renderer both call it.
import { click, crush, env, nz, osc, rng, sat, sub, uni, type Rig } from './synth';

export type TrackName = 'pack' | 'game' | 'title';
export interface Buses {
  ctx: BaseAudioContext;
  /** Drums and sub: straight to the music bus. */
  drums: Rig;
  /** Pads and bass layers: pass through the sidechain duck. */
  mel: Rig;
  /** Arps: bitcrushed and filtered, then ducked. */
  arp: Rig;
  duck: GainNode;
  lite: boolean;
}
export interface Track { name: TrackName; bpm: number; len: number; swing: number; step(b: Buses, i: number, t: number, s16: number, I: number): void }

/** Builds the drum / melody / arp rigs for a music bus. */
export function buildBuses(ctx: BaseAudioContext, bus: AudioNode, sends: { rev?: AudioNode; gate?: AudioNode }, lite: boolean): Buses {
  const duck = ctx.createGain(), melIn = ctx.createGain();
  melIn.connect(duck); duck.connect(bus);
  const drums: Rig = { ctx, out: bus, rev: sends.rev, gate: sends.gate, lite };
  const mel: Rig = { ctx, out: melIn, rev: sends.rev, lite };
  const arpIn = ctx.createGain(), lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 4200;
  if (lite) arpIn.connect(lp); else { const c = crush(ctx, 5); arpIn.connect(c); c.connect(lp); }
  lp.connect(melIn);
  const arp: Rig = { ctx, out: arpIn, rev: sends.rev, lite };
  return { ctx, drums, mel, arp, duck, lite };
}
const pump = (b: Buses, t: number, depth = 0.3, rel = 0.2): void => {
  const g = b.duck.gain;
  g.cancelScheduledValues(t); g.setValueAtTime(depth, t); g.linearRampToValueAtTime(1, t + rel);
};

// ---------- drum and bass voices ----------
function kick(b: Buses, t: number, v = 1): void {
  const r = b.drums;
  osc(r, 'sine', 165, 44, t, 0.22, 1.0 * v, { sat: 3, a: 0.001 });
  osc(r, 'sine', 50, 42, t, 0.4, 0.4 * v, { sat: 2, a: 0.004 });
  osc(r, 'triangle', 340, 90, t, 0.045, 0.3 * v, { a: 0.001 });
  click(r, t, 0.8 * v, 2600, 0.012);
  osc(r, 'triangle', 260, 120, t, 0.06, 0.4 * v, { a: 0.001, sat: 2 });
}
function snare(b: Buses, t: number, v = 1): void {
  const r = b.drums;
  nz(r, t, 0.2, 0.8 * v, { f0: 1900, f1: 1200, q: 0.7, a: 0.001, gate: 0.55 });
  nz(r, t, 0.07, 0.45 * v, { ft: 'highpass', f0: 4500, a: 0.001 });
  osc(r, 'triangle', 215, 150, t, 0.1, 0.5 * v, { a: 0.001, sat: 2 });
  click(r, t, 0.4 * v, 3500, 0.01);
}
function clap(b: Buses, t: number, v = 1): void {
  const r = b.drums;
  [0, 0.011, 0.024].forEach((d) => nz(r, t + d, 0.018, 0.4 * v, { f0: 1300, q: 1.2, a: 0.0008 }));
  nz(r, t + 0.03, 0.14, 0.32 * v, { f0: 1250, q: 1.1, a: 0.001, gate: 0.4 });
}
function hat(b: Buses, t: number, v = 1, open = false): void {
  nz(b.drums, t, open ? 0.22 : 0.04, 0.32 * v, { ft: 'highpass', f0: open ? 6500 : 8200, q: 0.7, a: 0.0008 });
  if (!b.lite) osc(b.drums, 'square', 9500, 9500, t, open ? 0.12 : 0.025, 0.02 * v, { a: 0.0008, hp: 7000 });
}
function s808(b: Buses, t: number, hz: number, dur: number, v = 1): void {
  const r = b.drums, c = r.ctx;
  const o = c.createOscillator(), g = c.createGain(), sh = sat(c, 3.5), lp = c.createBiquadFilter();
  o.type = 'sine'; o.frequency.setValueAtTime(hz * 2.1, t); o.frequency.exponentialRampToValueAtTime(hz, t + 0.05);
  lp.type = 'lowpass'; lp.frequency.value = 1100;
  env(g.gain, t, 0.9 * v, dur * 0.6, 0.004, dur * 0.4);
  o.connect(g); g.connect(sh); sh.connect(lp); lp.connect(r.out); o.start(t); o.stop(t + dur * 1.05 + 0.1);
  // an octave up, softly, so the note still reads where 40 Hz cannot be heard
  osc(r, 'triangle', hz * 2, hz * 2, t, dur * 0.6, 0.4 * v, { sat: 3, lp: 1200, a: 0.004 });
  osc(r, 'sawtooth', hz * 4, hz * 4, t, dur * 0.35, 0.1 * v, { lp: 1100, a: 0.004 });
}
function grit(b: Buses, t: number, hz: number, dur: number, v = 1): void {
  uni(b.mel, 'sawtooth', [hz], t, dur, 0.95 * v, { lp: 520, spread: 14, sat: 4, a: 0.004 });
  if (!b.lite) osc(b.mel, 'square', hz * 2, hz * 2, t, dur * 0.5, 0.2 * v, { lp: 900, a: 0.004 });
}

// ---------- harmony: Fm | Db | Bbm | Cm ----------
const ROOT = [43.65, 69.3, 58.27, 65.41]; // 808 notes (F1, Db2, Bb1, C2)
const GRIT = [87.31, 69.3 * 1, 58.27 * 2, 65.41 * 2]; // mid bass an octave up where needed
const CHORD = [[174.61, 207.65, 261.63], [138.59, 174.61, 207.65], [233.08, 277.18, 349.23], [196, 261.63, 311.13]];
const ARP = [[0, 1, 2, 1], [2, 1, 0, 1], [0, 2, 1, 2], [1, 0, 2, 1]];

// ---------- pack: the full beat ----------
const P_KICK: number[][] = [[0, 7, 10], [0, 7, 10, 13], [0, 3, 10], [0, 7, 10, 12, 15]];
const P_808: number[][][] = [[[0, 1, 6], [7, 1, 3], [10, 1.189, 4]], [[0, 1, 6], [7, 1, 3], [10, 1.335, 4]], [[0, 1, 6], [6, 1, 3], [10, 1.189, 5]], [[0, 1, 5], [6, 1, 2], [10, 1.498, 6]]];
const P_GRIT = [[2, 5, 8, 11, 14], [2, 5, 8, 11, 13], [2, 6, 8, 11, 14], [2, 5, 8, 10, 14]];
const P_ARP = [[1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1], [1, 0, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0]];
function drumBar(b: Buses, bar: number, s: number, t: number, s16: number, I: number, full: boolean): void {
  const kk = P_KICK[bar];
  if (kk.includes(s)) { kick(b, t, s === 0 ? 1 : 0.9); pump(b, t); }
  if (s === 4 || s === 12) { snare(b, t, 1); if (!b.lite) clap(b, t + 0.002, 0.7); }
  if ((bar === 1 && s === 15) || (bar === 3 && s === 14) || (bar === 0 && s === 11 && full)) snare(b, t, 0.28);
  if (s % 2 === 0) hat(b, t, s % 4 === 0 ? 0.9 : 0.6, (bar % 2 === 0) && s === 14);
  else if (full && (s === 7 || s === 13)) hat(b, t, 0.4);
  if (bar === 1 && s === 15) hat(b, t + s16 / 2, 0.5);
  if (bar === 3 && s >= 12) { hat(b, t + s16 / 3, 0.45); hat(b, t + (2 * s16) / 3, 0.4); }
  void I;
}
function bassBar(b: Buses, bar: number, s: number, t: number, s16: number, gain: number): void {
  for (const [st, m, len] of P_808[bar]) if (st === s) s808(b, t, ROOT[bar] * m, len * s16, gain);
  if (P_GRIT[bar].includes(s)) grit(b, t, GRIT[bar] * (s % 3 === 0 ? 1 : 2), s16 * 1.5, gain * 0.55);
}
function padArp(b: Buses, bar: number, s: number, t: number, s16: number, padV: number, arpV: number): void {
  if (s === 0 && padV > 0) uni(b.mel, 'sawtooth', CHORD[bar], t, s16 * 15, padV, { lp: 750, a: 0.25, spread: 12, rev: 0.3, hold: s16 * 6 });
  if (arpV > 0 && P_ARP[bar % 2][s]) {
    const tone = ARP[(bar + (s >> 2)) % 4][s & 3], base = CHORD[bar][tone] * 2 * (s % 8 === 0 ? 1 : 2);
    osc(b.arp, 'square', base, base, t, s16 * 0.8, arpV, { lp: 2800, a: 0.002 });
  }
}
const packTrack: Track = {
  name: 'pack', bpm: 92, len: 64, swing: 0.13,
  step(b, i, t, s16) {
    const bar = (i >> 4) & 3, s = i & 15;
    drumBar(b, bar, s, t, s16, 1, true);
    bassBar(b, bar, s, t, s16, 1);
    if (!b.lite) padArp(b, bar, s, t, s16, 0.4, 0.2);
  },
};

// ---------- game: tension loop with intensity layers ----------
const gameTrack: Track = {
  name: 'game', bpm: 92, len: 64, swing: 0.1,
  step(b, i, t, s16, I) {
    const bar = (i >> 4) & 3, s = i & 15;
    // always: a low drone per bar and a slow pulse
    if (s === 0) {
      osc(b.mel, 'sine', ROOT[bar] * 2, ROOT[bar] * 2, t, s16 * 15, 0.3, { sat: 3.5, a: 0.06, hold: s16 * 8 });
      uni(b.mel, 'sawtooth', [CHORD[bar][0] / 2, CHORD[bar][0] / 2 * 1.5], t, s16 * 15, 0.3, { lp: 420, a: 0.35, spread: 10, hold: s16 * 8 });
      uni(b.mel, 'sawtooth', [CHORD[bar][0], CHORD[bar][1]], t, s16 * 15, 0.34, { lp: 1000, a: 0.5, spread: 12, hold: s16 * 7, rev: 0.3 });
    }
    if (s === 0) { kick(b, t, 0.7 + I * 0.3); pump(b, t, 0.5, 0.25); }
    if (s % 4 === 2) hat(b, t, 0.35 + I * 0.25);
    if (I >= 0.25) { if (s === 10) { kick(b, t, 0.7); pump(b, t, 0.5); } if (s % 2 === 0 && s % 4 !== 0) hat(b, t, 0.35 + I * 0.25); }
    if (I >= 0.45) {
      if (s === 12) snare(b, t, 0.7);
      for (const [st, m, len] of P_808[bar]) if (st === s && (I >= 0.6 || st === 0)) s808(b, t, ROOT[bar] * m, len * s16, 0.75);
      if (P_808[bar].some(([st]) => st === s) && (I >= 0.6 || s === 0)) grit(b, t, GRIT[bar] * 2, s16 * 2, 0.5);
    }
    if (I >= 0.65) {
      if (s === 4) snare(b, t, 0.85);
      if (P_KICK[bar].includes(s) && s !== 0 && s !== 10) { kick(b, t, 0.85); pump(b, t); }
      if (P_GRIT[bar].includes(s)) grit(b, t, GRIT[bar] * (s % 3 === 0 ? 1 : 2), s16 * 1.5, 0.45);
      if (s % 2 === 0) hat(b, t, 0.5);
    }
    if (I >= 0.8 && !b.lite) padArp(b, bar, s, t, s16, 0.4, 0.17 + (I - 0.8) * 0.4);
    if (I >= 0.9 && s === 15) hat(b, t + s16 / 2, 0.6);
  },
};

// ---------- title: dark-synth ambient ----------
const TCH = [[174.61, 207.65, 261.63], [138.59, 174.61, 207.65], [207.65, 261.63, 311.13], [155.56, 196, 233.08]];
const TROOT = [43.65, 34.65 * 2, 51.91, 38.89];
const BELL = [698.46, 830.61, 1046.5, 622.25, 783.99];
const titleTrack: Track = {
  name: 'title', bpm: 72, len: 64, swing: 0,
  step(b, i, t, s16) {
    const bar = (i >> 4) & 3, s = i & 15, R = rng(1000 + i * 17);
    if (s === 0) {
      if (!b.lite) uni(b.mel, 'sawtooth', TCH[bar], t, s16 * 16, 0.5, { lp: 560, a: 1.2, hold: s16 * 6, spread: 14, rev: 0.45 });
      else uni(b.mel, 'sawtooth', [TCH[bar][0], TCH[bar][2]], t, s16 * 16, 0.5, { lp: 560, a: 1.0, hold: s16 * 6 });
      osc(b.drums, 'sine', TROOT[bar], TROOT[bar], t, s16 * 14, 0.45, { sat: 3.5, a: 0.05, hold: s16 * 6 });
      osc(b.drums, 'triangle', TROOT[bar] * 2, TROOT[bar] * 2, t, s16 * 12, 0.2, { sat: 3, a: 0.08, hold: s16 * 5 });
      if (!b.lite) nz(b.mel, t, s16 * 14, 0.08, { ft: 'lowpass', f0: 200, f1: 1100, q: 1.2, a: s16 * 7, rev: 0.4 });
    }
    // a muffled pulse like a ball bouncing in the next room
    if (s === 0 || s === 8) { const g = s === 0 ? 0.55 : 0.38; osc(b.drums, 'sine', 120, 42, t, 0.26, g, { sat: 2, lp: 500, a: 0.002 }); pump(b, t, 0.7, 0.3); }
    if (s === 12 && bar % 2 === 1) nz(b.drums, t, 0.14, 0.12, { f0: 1500, q: 1.2, a: 0.002, rev: 0.4 });
    if (!b.lite && (s === 5 || s === 11 || (s === 14 && bar === 3)) && R() < 0.8) {
      const f = BELL[Math.floor(R() * BELL.length)];
      osc(b.arp, 'square', f, f, t, s16 * 2.4, 0.15, { lp: 2400, a: 0.003, rev: 0.7 });
      osc(b.arp, 'sine', f * 2.76, f * 2.76, t, s16 * 1.2, 0.015, { a: 0.002, rev: 0.7 });
    }
    if (!b.lite && s === 13 && R() < 0.5) { for (let k = 0; k < 3; k++) nz(b.drums, t + k * 0.024, 0.014, 0.1, { ft: 'highpass', f0: 3000 + R() * 5000, a: 0.0008, crush: 3 }); }
    if (s % 4 === 2) hat(b, t, 0.18);
  },
};

export const TRACKS: Record<TrackName, Track> = { pack: packTrack, game: gameTrack, title: titleTrack };
