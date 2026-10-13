// A small retro boom-bap loop made with Web Audio (no audio files): kick, snare, swung hats, a bass line,
// a filtered chord stab and some vinyl crackle. It plays during pack openings and can be muted.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: number | null = null;
let step = 0;
let nextT = 0;
let noiseBuf: AudioBuffer | null = null;
let crackle: AudioBufferSourceNode | null = null;

const BPM = 88;
const S16 = 60 / BPM / 4;
// 16 steps per bar, two bars
const KICK = [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0];
const SNARE = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1];
const HAT = [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0];
// bass notes in Hz (0 = rest): a minor-ish walk
const BASS = [55, 0, 0, 55, 0, 0, 65.4, 0, 0, 0, 49, 0, 0, 0, 0, 0, 55, 0, 0, 55, 0, 0, 73.4, 0, 0, 65.4, 0, 0, 49, 0, 0, 0];
const CHORDS: [number, number[]][] = [[0, [220, 261.6, 329.6]], [16, [196, 246.9, 293.7]]];

let sfxMaster: GainNode | null = null;
function ac(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}
/** Called from the first tap or key press (the splash screen): browsers only start Web Audio after a gesture. */
export function unlockAudio(): void { ac(); }
/** Where one-shots go: the music bus while the beat plays, else a quiet bus of their own. */
function out(): GainNode {
  if (master) return master;
  if (!sfxMaster || sfxMaster.context !== ctx) { sfxMaster = ctx!.createGain(); sfxMaster.gain.value = 0.5; sfxMaster.connect(ctx!.destination); }
  return sfxMaster;
}
function noise(): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = ctx!.createBuffer(1, ctx!.sampleRate, ctx!.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}
function env(g: GainNode, t: number, peak: number, dur: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
function kick(t: number): void {
  const o = ctx!.createOscillator(), g = ctx!.createGain();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  env(g, t, 0.9, 0.32);
  o.connect(g).connect(out());
  o.start(t); o.stop(t + 0.35);
}
function snare(t: number): void {
  const n = ctx!.createBufferSource(), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
  n.buffer = noise(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7;
  env(g, t, 0.45, 0.18);
  n.connect(f).connect(g).connect(out());
  n.start(t); n.stop(t + 0.2);
  const o = ctx!.createOscillator(), g2 = ctx!.createGain();
  o.frequency.value = 190; env(g2, t, 0.25, 0.08);
  o.connect(g2).connect(out()); o.start(t); o.stop(t + 0.1);
}
function hat(t: number, accent: boolean): void {
  const n = ctx!.createBufferSource(), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
  n.buffer = noise(); f.type = 'highpass'; f.frequency.value = 7000;
  env(g, t, accent ? 0.14 : 0.08, 0.05);
  n.connect(f).connect(g).connect(out());
  n.start(t); n.stop(t + 0.06);
}
function bass(t: number, hz: number): void {
  const o = ctx!.createOscillator(), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
  o.type = 'triangle'; o.frequency.value = hz; f.type = 'lowpass'; f.frequency.value = 400;
  env(g, t, 0.5, S16 * 2.6);
  o.connect(f).connect(g).connect(out());
  o.start(t); o.stop(t + S16 * 3);
}
function stab(t: number, notes: number[]): void {
  const f = ctx!.createBiquadFilter(), g = ctx!.createGain();
  f.type = 'lowpass'; f.frequency.value = 1200; f.Q.value = 3;
  env(g, t, 0.09, S16 * 6);
  f.connect(g).connect(out());
  for (const hz of notes) { const o = ctx!.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz; o.detune.value = (Math.random() - 0.5) * 14; o.connect(f); o.start(t); o.stop(t + S16 * 6); }
}
function schedule(): void {
  if (!ctx) return;
  while (nextT < ctx.currentTime + 0.15) {
    const i = step % 32;
    const swing = i % 2 === 1 ? S16 * 0.18 : 0;
    const t = nextT + swing;
    if (KICK[i]) kick(t);
    if (SNARE[i]) snare(t);
    if (HAT[i]) hat(t, i % 4 === 0);
    if (BASS[i]) bass(t, BASS[i]);
    for (const [at, notes] of CHORDS) if (i === at || i === at + 10) stab(t, notes);
    nextT += S16;
    step++;
  }
}
function startCrackle(): void {
  const n = ctx!.createBufferSource(), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
  const b = ctx!.createBuffer(1, ctx!.sampleRate * 2, ctx!.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() < 0.0009 ? (Math.random() * 2 - 1) : (Math.random() * 2 - 1) * 0.02;
  n.buffer = b; n.loop = true; f.type = 'highpass'; f.frequency.value = 1500; g.gain.value = 0.25;
  n.connect(f).connect(g).connect(out());
  n.start();
  crackle = n;
}

/** Starts the loop (must be called from a user gesture the first time). */
export function startBeat(): void {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    if (timer != null) return;
    master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.6);
    master.connect(ctx.destination);
    step = 0;
    nextT = ctx.currentTime + 0.05;
    startCrackle();
    timer = window.setInterval(schedule, 40);
  } catch { /* no audio in this browser */ }
}
export function stopBeat(): void {
  if (!ctx || timer == null) return;
  window.clearInterval(timer);
  timer = null;
  const m = master!, c = crackle;
  m.gain.cancelScheduledValues(ctx.currentTime);
  m.gain.setValueAtTime(m.gain.value, ctx.currentTime);
  m.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
  setTimeout(() => { try { c?.stop(); m.disconnect(); } catch { /* already stopped */ } }, 600);
}
/** One-shot hits for big reveals. */
export function sting(kind: 'rare' | 'big' | 'iconic'): void {
  if (!ac()) return;
  const t = ctx!.currentTime + 0.01;
  if (kind === 'rare') { stab(t, [440, 554, 659]); return; }
  kick(t); snare(t + 0.02);
  stab(t, kind === 'iconic' ? [261.6, 329.6, 392, 523.3] : [220, 277.2, 329.6]);
  if (kind === 'iconic') { stab(t + 0.25, [293.7, 370, 440, 587.3]); stab(t + 0.5, [329.6, 415.3, 493.9, 659.3]); }
}

// ---------- basketball thump and referee whistle (Web Audio, no files) ----------
/** A ball hitting the floor: a short low sine drop plus a soft slap of noise. `power` 0..1 (a big first bounce is louder and lower). */
export function thump(power = 1): void {
  if (!ac()) return;
  const t = ctx!.currentTime + 0.005;
  tone('sine', 150 - power * 40, 52, t, 0.16, 0.5 + power * 0.5);
  const n = ctx!.createBufferSource(), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
  n.buffer = noise(); f.type = 'lowpass'; f.frequency.value = 700;
  env(g, t, 0.22 * (0.4 + power * 0.6), 0.05);
  n.connect(f).connect(g).connect(out()); n.start(t); n.stop(t + 0.07);
}
/** A pea whistle: two trills around 2.9 kHz. */
export function whistle(): void {
  if (!ac()) return;
  const t = ctx!.currentTime + 0.01;
  for (const [at, len] of [[0, 0.22], [0.26, 0.4]] as [number, number][]) {
    const o = ctx!.createOscillator(), lfo = ctx!.createOscillator(), lg = ctx!.createGain(), g = ctx!.createGain();
    o.type = 'triangle'; o.frequency.value = 2900;
    lfo.frequency.value = 38; lg.gain.value = 90; lfo.connect(lg).connect(o.frequency);
    env(g, t + at, 0.22, len);
    o.connect(g).connect(out());
    o.start(t + at); lfo.start(t + at); o.stop(t + at + len + 0.02); lfo.stop(t + at + len + 0.02);
  }
}

// ---------- glitch stings for rare shots ----------
function tone(type: OscillatorType, f0: number, f1: number, t: number, dur: number, peak: number): void {
  const o = ctx!.createOscillator(), g = ctx!.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, peak, dur);
  o.connect(g).connect(out()); o.start(t); o.stop(t + dur + 0.02);
}
function hiss(t: number, dur: number, peak: number, hp: number): void {
  const n = ctx!.createBufferSource(), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
  n.buffer = noise(); f.type = 'highpass'; f.frequency.value = hp;
  env(g, t, peak, dur);
  n.connect(f).connect(g).connect(out()); n.start(t); n.stop(t + dur + 0.02);
}
/** A short synthetic glitch sting. Level 1 GLITCHED (blips), 2 OVERCLOCKED (+ sweep and stutter), 3 SYSTEM ERROR (+ boom, wash, crash). */
export function glitchSting(level: 1 | 2 | 3): void {
  if (!ac()) return;
  const t = ctx!.currentTime + 0.01;
  // stuttering square blips on random steps of a minor scale
  const scale = [220, 261.6, 311.1, 392, 440, 523.3, 622.3, 784];
  const n = 4 + level * 3;
  for (let i = 0; i < n; i++) tone('square', scale[(i * 3 + level) % scale.length] * (i % 2 ? 2 : 1), scale[(i * 5) % scale.length], t + i * 0.045, 0.04, 0.07);
  hiss(t, 0.12, 0.12, 6000);
  if (level >= 2) {
    tone('sawtooth', 1400, 90, t + 0.05, 0.45, 0.16);
    tone('sawtooth', 1420, 95, t + 0.05, 0.45, 0.12);
    for (let i = 0; i < 6; i++) hiss(t + 0.12 + i * 0.06, 0.025, 0.2, 3000);
  }
  if (level >= 3) {
    tone('sine', 120, 38, t, 0.7, 0.8);
    hiss(t + 0.2, 0.7, 0.22, 1200);
    for (let i = 0; i < 8; i++) tone('square', 200 + i * 140, 90 + i * 40, t + 0.3 + i * 0.05, 0.05, 0.09);
    kick(t + 0.02); snare(t + 0.7);
    stab(t + 0.7, [233.1, 311.1, 370, 466.2]);
  }
}

// ---------- pack opening music: a swappable audio file, with the Web Audio beat as the default ----------
const PACK_PATH = 'audio/pack.mp3';
const DB = 'ballerz_audio';
let customUrl: string | null = null;
let customName = '';
let packEl: HTMLAudioElement | null = null;
let usingFile = false;
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('f');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
}
/** Lab: use this file as the pack music (kept in this browser's IndexedDB). Pass null to go back to the default. */
export async function setPackFile(file: File | null): Promise<void> {
  try {
    const db = await idb();
    const tx = db.transaction('f', 'readwrite');
    if (file) tx.objectStore('f').put(file, 'pack'); else tx.objectStore('f').delete('pack');
  } catch { /* storage unavailable */ }
  if (customUrl) URL.revokeObjectURL(customUrl);
  customUrl = file ? URL.createObjectURL(file) : null;
  customName = file ? file.name : '';
}
/** Loads a file saved earlier. Called once at start-up. */
export async function loadPackFile(): Promise<void> {
  try {
    const db = await idb();
    const f = await new Promise<File | undefined>((res) => { const r = db.transaction('f').objectStore('f').get('pack'); r.onsuccess = () => res(r.result as File | undefined); r.onerror = () => res(undefined); });
    if (f) { customUrl = URL.createObjectURL(f); customName = f.name || 'custom file'; }
  } catch { /* none */ }
}
export const packFileName = (): string => customName;
/** Starts pack music: your file (Lab) or audio/pack.mp3 next to the page if it exists, otherwise the built-in beat. */
export function startPackMusic(): void {
  if (packEl || timer != null) return;
  let fell = false;
  const fallback = () => { if (fell) return; fell = true; usingFile = false; packEl = null; startBeat(); };
  try {
    const a = new Audio(customUrl || PACK_PATH);
    a.loop = true; a.volume = 0.7;
    a.addEventListener('error', fallback);
    packEl = a; usingFile = true;
    a.play().catch(fallback);
  } catch { fallback(); }
}
export function stopPackMusic(): void {
  if (packEl) { const a = packEl; packEl = null; usingFile = false; a.pause(); a.src = ''; }
  stopBeat();
}
export const packMusicIsFile = (): boolean => usingFile;

// ---------- pack opening: charge rumble and a reveal chime that climbs with every card ----------
const climbMul = (i: number): number => Math.pow(2, Math.min(i, 9) * 2 / 12); // a whole step up per card
/** A rising rumble while the card charges: low saw swept upward under a lowpass, louder for rarer cards. Lite: one plain sine, no noise. */
export function chargeRumble(ms: number, rank: number, i: number, lite = false): void {
  if (!ac() || rank < 1) return;
  const t = ctx!.currentTime + 0.01, d = ms / 1000, m = climbMul(i), g = ctx!.createGain();
  const peak = 0.05 + rank * 0.03;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + d * 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.05);
  const f = ctx!.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(260, t); f.frequency.exponentialRampToValueAtTime(260 + rank * 500, t + d);
  const o = ctx!.createOscillator(); o.type = lite ? 'sine' : 'sawtooth';
  o.frequency.setValueAtTime(55 * m, t); o.frequency.exponentialRampToValueAtTime((110 + rank * 30) * m, t + d);
  o.connect(f).connect(g).connect(out()); o.start(t); o.stop(t + d + 0.1);
  if (!lite && rank >= 3) hiss(t + d * 0.5, d * 0.5, 0.05 * rank, 2500);
}
/** The reveal: a chime whose pitch climbs with the card number; richer for rarer pulls, plus an extra rising beat for a new best pull. */
export function pullChime(i: number, _n: number, rank: number, newBest: boolean, lite = false): void {
  if (!ac()) return;
  const t = ctx!.currentTime + 0.02, m = climbMul(i), base = 523.3 * m;
  const notes = rank >= 4 ? [1, 1.25, 1.5, 2] : rank >= 2 ? [1, 1.25, 1.5] : rank >= 1 ? [1, 1.5] : [1];
  notes.forEach((r, k) => tone('triangle', base * r, base * r * 1.004, t + k * 0.07, 0.35, 0.16));
  if (!lite && rank >= 3) tone('sine', base * 0.5, base * 0.5, t, 0.6, 0.18);
  if (newBest) {
    const t2 = t + 0.32;
    [1.5, 2, 2.5, 3].forEach((r, k) => tone('square', base * r, base * r, t2 + k * 0.06, 0.18, 0.06));
    if (!lite) hiss(t2, 0.3, 0.1, 6000);
  }
}
