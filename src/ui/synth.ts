// Synth primitives and the master chain shared by the live engine (sfx.ts, music.ts) and the offline renderer (tools/audio-render.ts).
// DOM-free: everything takes a BaseAudioContext, so the same code renders to WAV for analysis.

/** Where a sound goes: its dry bus, optional reverb sends, and whether the lighter (weak phone) version is wanted. */
export interface Rig {
  ctx: BaseAudioContext;
  out: AudioNode;
  rev?: AudioNode;
  gate?: AudioNode;
  lite: boolean;
}
interface Cache { noise: AudioBuffer; curves: Map<string, Float32Array<ArrayBuffer>> }
const caches = new WeakMap<BaseAudioContext, Cache>();
function cache(ctx: BaseAudioContext): Cache {
  let c = caches.get(ctx);
  if (!c) {
    // deterministic noise, so offline renders repeat exactly
    const len = Math.floor(ctx.sampleRate * 2), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let s = 22695477;
    for (let i = 0; i < len; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; d[i] = (s / 2147483648) - 1; }
    c = { noise: b, curves: new Map() };
    caches.set(ctx, c);
  }
  return c;
}
/** Tiny seeded random for recipes that scatter things (glitch blips), so a render is repeatable. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const curve = (ctx: BaseAudioContext, key: string, mk: (x: number) => number): Float32Array<ArrayBuffer> => {
  const c = cache(ctx);
  let v = c.curves.get(key);
  if (!v) { v = new Float32Array(2048); for (let i = 0; i < 2048; i++) v[i] = mk(i / 1023.5 - 1); c.curves.set(key, v); }
  return v;
};
/** Soft clip (tanh): adds harmonics so a sub still speaks on a phone speaker. */
export function sat(ctx: BaseAudioContext, drive = 2.5): WaveShaperNode {
  const w = ctx.createWaveShaper(); w.curve = curve(ctx, 'sat' + drive, (x) => Math.tanh(x * drive) / Math.tanh(drive)); w.oversample = '2x'; return w;
}
/** Bitcrush (amplitude quantiser, plus a little fold for grit). */
export function crush(ctx: BaseAudioContext, bits = 4): WaveShaperNode {
  const w = ctx.createWaveShaper(); const q = Math.pow(2, bits - 1);
  w.curve = curve(ctx, 'crush' + bits, (x) => Math.max(-1, Math.min(1, Math.round(x * q) / q))); return w;
}
const clampT = (t: number): number => Math.max(0, t);

/** Exponential attack/decay envelope on a gain param. `hold` keeps the peak for a while. */
export function env(p: AudioParam, t: number, peak: number, dur: number, a = 0.003, hold = 0): void {
  p.setValueAtTime(0.0001, t);
  p.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  if (hold > 0) p.setValueAtTime(Math.max(0.0002, peak), t + a + hold);
  p.exponentialRampToValueAtTime(0.0001, t + a + hold + Math.max(0.01, dur));
}
export interface VoiceOpt {
  a?: number; hold?: number; dest?: AudioNode; det?: number;
  sat?: number; crush?: number; rev?: number; gate?: number;
  lp?: number; hp?: number; type2?: OscillatorType;
}
function tail(r: Rig, g: AudioNode, o: VoiceOpt): void {
  let n: AudioNode = g;
  if (o.sat) { const s = sat(r.ctx, o.sat); n.connect(s); n = s; }
  if (o.crush) { const s = crush(r.ctx, o.crush); n.connect(s); n = s; }
  n.connect(o.dest ?? r.out);
  if (o.rev && r.rev) { const s = r.ctx.createGain(); s.gain.value = o.rev; n.connect(s); s.connect(r.rev); }
  if (o.gate && r.gate) { const s = r.ctx.createGain(); s.gain.value = o.gate; n.connect(s); s.connect(r.gate); }
}
/** One oscillator with a pitch glide and an envelope. */
export function osc(r: Rig, type: OscillatorType, f0: number, f1: number, t: number, dur: number, peak: number, o: VoiceOpt = {}): GainNode {
  t = clampT(t);
  const c = r.ctx, os = c.createOscillator(), g = c.createGain();
  os.type = type;
  os.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) os.frequency.exponentialRampToValueAtTime(Math.max(18, f1), t + dur);
  if (o.det) os.detune.value = o.det;
  env(g.gain, t, peak, dur, o.a ?? 0.003, o.hold ?? 0);
  let n: AudioNode = os;
  if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; n.connect(f); n = f; }
  if (o.hp) { const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = o.hp; n.connect(f); n = f; }
  n.connect(g);
  tail(r, g, o);
  const end = t + (o.a ?? 0.003) + (o.hold ?? 0) + dur + 0.03;
  os.start(t); os.stop(end);
  return g;
}
/** Detuned unison of oscillators (a fat saw/square stab or pad voice). */
export function uni(r: Rig, type: OscillatorType, freqs: number[], t: number, dur: number, peak: number, o: VoiceOpt & { spread?: number; glide?: number } = {}): void {
  const c = r.ctx, g = c.createGain(), t0 = clampT(t);
  env(g.gain, t0, peak, dur, o.a ?? 0.004, o.hold ?? 0);
  let n: AudioNode = g;
  if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = 1.2; g.connect(f); n = f; }
  const spread = o.spread ?? 9;
  freqs.forEach((f, k) => {
    for (const d of [-spread, spread]) {
      const os = c.createOscillator(); os.type = type; os.frequency.setValueAtTime(f, t0);
      if (o.glide) os.frequency.exponentialRampToValueAtTime(Math.max(18, f * o.glide), t0 + dur);
      os.detune.value = d * (1 + (k % 2) * 0.3);
      os.connect(g); os.start(t0); os.stop(t0 + (o.a ?? 0.004) + (o.hold ?? 0) + dur + 0.03);
    }
  });
  const holder = c.createGain(); holder.gain.value = 1 / Math.sqrt(freqs.length * 2); n.connect(holder);
  tail(r, holder, o);
}
export interface NoiseOpt extends VoiceOpt { ft?: BiquadFilterType; f0?: number; f1?: number; q?: number; offset?: number }
/** A burst of filtered noise; the filter can sweep from f0 to f1. */
export function nz(r: Rig, t: number, dur: number, peak: number, o: NoiseOpt = {}): GainNode {
  t = clampT(t);
  const c = r.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = cache(c).noise;
  f.type = o.ft ?? 'bandpass'; f.Q.value = o.q ?? 0.8;
  const f0 = o.f0 ?? 2000;
  f.frequency.setValueAtTime(f0, t);
  if (o.f1 && o.f1 !== f0) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
  env(g.gain, t, peak, dur, o.a ?? 0.002, o.hold ?? 0);
  s.connect(f); f.connect(g);
  tail(r, g, o);
  const end = t + (o.a ?? 0.002) + (o.hold ?? 0) + dur + 0.03;
  s.start(t, o.offset ?? ((t * 7.31) % 1.5)); s.stop(end);
  return g;
}
/** Sub thump: a sine that drops fast, saturated so its harmonics carry on small speakers. */
export function sub(r: Rig, t: number, f0: number, f1: number, dur: number, peak: number, o: VoiceOpt = {}): void {
  osc(r, 'sine', f0, f1, t, dur, peak * 0.7, { sat: 3, a: 0.002, ...o });
  // an octave and a buzzy third harmonic: the body that a phone speaker can actually reproduce
  osc(r, 'triangle', f0 * 2, f1 * 2, t, dur * 0.6, peak * 0.5, { a: 0.002, sat: 2, dest: o.dest });
  osc(r, 'sawtooth', f0 * 3, f1 * 3, t, dur * 0.35, peak * 0.16, { a: 0.002, lp: 1500, dest: o.dest });
}
/** Short noise click (the transient on top of a hit). */
export function click(r: Rig, t: number, peak = 0.5, hp = 3500, dur = 0.014, dest?: AudioNode): void {
  nz(r, t, dur, peak, { ft: 'highpass', f0: hp, a: 0.0008, q: 0.7, dest });
}

// ---------- master chain ----------
export interface Chain {
  /** SFX bus (volume node). */
  sfx: GainNode;
  /** Music bus (volume node). */
  music: GainNode;
  master: GainNode;
  sfxRig: Rig;
  /** Reverb sends for the music bus. */
  musicSends: { rev?: GainNode; gate?: GainNode };
}
/** An impulse response: decaying noise. `cut` > 0 gates it hard after that many seconds (gated reverb). */
export function makeIR(ctx: BaseAudioContext, dur: number, decay: number, cut = 0): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch); let s = 99991 + ch * 7919;
    for (let i = 0; i < n; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      const t = i / ctx.sampleRate;
      let a = Math.pow(1 - i / n, decay);
      if (cut > 0 && t > cut) a = 0;
      d[i] = ((s / 2147483648) - 1) * a;
    }
  }
  return b;
}
function wetSend(ctx: BaseAudioContext, ir: AudioBuffer, ret: AudioNode, level: number): GainNode {
  const inp = ctx.createGain(), cv = ctx.createConvolver(), out = ctx.createGain();
  cv.buffer = ir; out.gain.value = level;
  inp.connect(cv); cv.connect(out); out.connect(ret);
  return inp;
}
/** master gain -> compressor -> limiter -> destination, with SFX and music buses and short reverbs. */
export function buildChain(ctx: BaseAudioContext, dest: AudioNode, lite: boolean): Chain {
  const master = ctx.createGain(), comp = ctx.createDynamicsCompressor(), lim = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.16;
  lim.threshold.value = -2.5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.06;
  // a last soft ceiling: linear to 0.8, then a tanh knee that can never reach full scale (no hard clipping, ever)
  const ceil = ctx.createWaveShaper();
  ceil.curve = curve(ctx, 'ceil', (x) => { const a = Math.abs(x); return a <= 0.8 ? x : Math.sign(x) * (0.8 + 0.19 * Math.tanh((a - 0.8) / 0.19)); });
  master.connect(comp); comp.connect(lim); lim.connect(ceil); ceil.connect(dest);
  const sfx = ctx.createGain(), music = ctx.createGain();
  sfx.connect(master); music.connect(master);
  const sfxRig: Rig = { ctx, out: sfx, lite };
  const musicSends: Chain['musicSends'] = {};
  if (!lite) {
    sfxRig.rev = wetSend(ctx, makeIR(ctx, 0.5, 2.6), sfx, 0.5);
    sfxRig.gate = wetSend(ctx, makeIR(ctx, 0.3, 1.2, 0.18), sfx, 0.7);
    musicSends.rev = wetSend(ctx, makeIR(ctx, 0.7, 2.8), music, 0.5);
    musicSends.gate = wetSend(ctx, makeIR(ctx, 0.3, 1.2, 0.2), music, 0.8);
  }
  return { sfx, music, master, sfxRig, musicSends };
}

/** A per-sound mini rig: everything the recipe makes (dry and reverb sends) is scaled by `trim`, the loudness calibration of that sound. */
export function voiceRig(base: Rig, trim: number): Rig {
  const c = base.ctx, vg = c.createGain();
  vg.gain.value = trim; vg.connect(base.out);
  const r: Rig = { ctx: c, out: vg, lite: base.lite };
  if (base.rev) { const g = c.createGain(); g.gain.value = trim; g.connect(base.rev); r.rev = g; }
  if (base.gate) { const g = c.createGain(); g.gain.value = trim; g.connect(base.gate); r.gate = g; }
  return r;
}
/** Gain that swells up to `peak` over `d` seconds and cuts off (for risers and charges). */
export function swell(r: Rig, t: number, d: number, peak: number, tailS = 0.05): GainNode {
  const g = r.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + d * 0.94);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d + tailS);
  return g;
}
/** A saw pair swept up (or down) under a filter that opens: risers, charges, power-ups. */
export function sweepSaw(r: Rig, t: number, d: number, f0: number, f1: number, l0: number, l1: number, peak: number, o: VoiceOpt = {}): void {
  const c = r.ctx, g = swell(r, t, d, peak), f = c.createBiquadFilter();
  f.type = 'lowpass'; f.Q.value = 2;
  f.frequency.setValueAtTime(l0, t); f.frequency.exponentialRampToValueAtTime(l1, t + d);
  f.connect(g);
  for (const det of [-11, 11]) {
    const os = c.createOscillator(); os.type = 'sawtooth';
    os.frequency.setValueAtTime(f0, t); os.frequency.exponentialRampToValueAtTime(f1, t + d);
    os.detune.value = det; os.connect(f); os.start(t); os.stop(t + d + 0.1);
  }
  tail(r, g, o);
}
