// Music player: one looping mp3 per context (title, game, pack): audio/title.mp3, audio/game.mp3, audio/pack.mp3 next to index.html
// (docs/audio/ in the repo), or a file chosen in the Lab (kept in IndexedDB). Fades in and out, nothing starts before the first gesture,
// the tab being hidden pauses it, volume and mute come from the audio settings. A missing or broken file means silence.
// The old synthesized loops stay in tracks.ts behind SYNTH_MUSIC (off).
import { effectiveGains } from './audioSettings';
import { getAudio, getChain, getCtx, onAudioChange } from './sfx';
import { TRACKS, buildBuses, type Buses, type TrackName } from './tracks';
import { liteOn } from './lite';
import { MUSIC_TRIMS } from './trims';

export type MusicCtx = TrackName;
export const MUSIC_CTXS: MusicCtx[] = ['title', 'game', 'pack'];
/** Only the title screen has music for now; game and pack are muted until their files are enabled here. */
const PATH: Partial<Record<MusicCtx, string>> = { title: 'audio/title.mp3' };
const DB = 'ballerz_audio';
/** The synthesized loops are not the default any more; set true to use them wherever no mp3 loads. */
export const SYNTH_MUSIC = false;
const FADE_IN = 1.4, FADE_OUT = 0.7; // seconds

let base: MusicCtx | null = null;
let override: MusicCtx | 'none' | null = null;
let test: MusicCtx | null = null;
let tension = 0.2, cur = 0.2, boostBars = 0, fanI = 0.5;

interface Playing { name: MusicCtx; kind: 'synth' | 'file'; stop(): void; setVol?(): void }
let playing: Playing | null = null;
const urls: Partial<Record<MusicCtx, string>> = {};
const names: Partial<Record<MusicCtx, string>> = {};
const probeFailed: Partial<Record<MusicCtx, boolean>> = {};
let onFiles: () => void = () => {};

// ---------- file storage (IndexedDB) ----------
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
/** Lab: use this file as the music of one context (kept in this browser). Pass null to go back to audio/<name>.mp3. */
export async function setMusicFile(c: MusicCtx, file: File | null): Promise<void> {
  try {
    const db = await idb();
    const tx = db.transaction('f', 'readwrite');
    if (file) tx.objectStore('f').put(file, c); else tx.objectStore('f').delete(c);
  } catch { /* storage unavailable */ }
  if (urls[c]) URL.revokeObjectURL(urls[c]!);
  urls[c] = file ? URL.createObjectURL(file) : undefined;
  names[c] = file ? file.name : '';
  probeFailed[c] = false;
  if (playing && playing.name === c) { stopPlaying(true); sync(); }
}
/** Loads the files saved earlier. Called once at start-up. */
export async function loadMusicFiles(): Promise<void> {
  try {
    const db = await idb();
    for (const c of MUSIC_CTXS) {
      const f = await new Promise<File | undefined>((res) => { const r = db.transaction('f').objectStore('f').get(c); r.onsuccess = () => res(r.result as File | undefined); r.onerror = () => res(undefined); });
      if (f) { urls[c] = URL.createObjectURL(f); names[c] = f.name || 'custom file'; }
    }
  } catch { /* none */ }
  onFiles();
}
export const musicFileName = (c: MusicCtx): string => names[c] || '';
export const musicIsFile = (): boolean => playing?.kind === 'file';
export const musicNow = (): string => (playing ? `${playing.name}:${playing.kind}` : '');
export function onMusicFiles(fn: () => void): void { onFiles = fn; }

// ---------- what should play ----------
function want(): MusicCtx | null {
  if (test) return test;
  if (override === 'none') return null;
  return override ?? base;
}
function audible(): boolean {
  const g = effectiveGains(getAudio());
  return g.music > 0 && g.master > 0 && !document.hidden && !!getCtx() && getCtx()!.state !== 'closed';
}
export function setMusicScene(b: MusicCtx | null): void { if (b !== base) { base = b; sync(); } }
/** The pack opening takes over ('pack', or 'none' when its music toggle is off); null hands back to the scene. */
export function setMusicOverride(o: MusicCtx | 'none' | null, level?: number): void {
  if (level != null) fanI = Math.max(0, Math.min(1, level));
  if (o !== override) { override = o; sync(); }
}
/** Fanfare loop for a big moment (an Iconic pull, a win): `level` 0.5 normal, 1 = HOLO Iconic or a big win. null hands back to the scene. It plays only after the first gesture and follows the music volume and mute. */
export function setFanfare(on: boolean, level = 0.5): void { setMusicOverride(on ? 'triumph' : null, level); }
export function setMusicTest(c: MusicCtx | null): void { test = c; sync(); }
export const musicTest = (): MusicCtx | null => test;
/** How tense the game loop is, 0..1 (Momentum). */
export function setTension(x: number): void { tension = Math.max(0, Math.min(1, x)); }
/** A Clutch or On Fire moment: the loop runs at full intensity for a few bars. */
export function spikeTension(bars = 4): void { boostBars = Math.max(boostBars, bars); }
export const currentIntensity = (): number => cur;

function sync(): void {
  const w = want();
  if (!w || !audible() || !getChain()) { if (playing) stopPlaying(false); return; }
  if (playing && playing.name === w) { playing.setVol?.(); return; }
  stopPlaying(false);
  startPlaying(w);
}
function stopPlaying(fast: boolean): void { const p = playing; playing = null; p?.stop(); void fast; }

function startPlaying(name: MusicCtx): void {
  const url = urls[name] || (probeFailed[name] ? '' : PATH[name] || '');
  if (url) { startFile(name, url); return; }
  if (SYNTH_MUSIC) startSynth(name);
}
function startFile(name: MusicCtx, url: string): void {
  let dead = false, fade = 0, dir = 1, timer = 0;
  const a = new Audio(url);
  a.loop = true;
  const target = (): number => { const g = effectiveGains(getAudio()); return Math.max(0, Math.min(1, g.master * Math.sqrt(g.music) * 0.9)); };
  const apply = (): void => { try { a.volume = Math.max(0, Math.min(1, target() * fade)); } catch { /* ignore */ } };
  const run = (): void => {
    if (timer) return;
    timer = window.setInterval(() => {
      fade = Math.max(0, Math.min(1, fade + dir * 0.05 / (dir > 0 ? FADE_IN : FADE_OUT)));
      apply();
      if ((dir > 0 && fade >= 1) || (dir < 0 && fade <= 0)) { window.clearInterval(timer); timer = 0; if (dir < 0) { try { a.pause(); a.removeAttribute('src'); a.load(); } catch { /* ignore */ } } }
    }, 50);
  };
  apply();
  const me: Playing = {
    name, kind: 'file',
    stop() { dead = true; document.removeEventListener('visibilitychange', onVis); dir = -1; run(); },
    setVol: apply,
  };
  const fallback = (): void => {
    if (dead) return;
    if (!urls[name]) probeFailed[name] = true;
    dead = true; document.removeEventListener('visibilitychange', onVis); window.clearInterval(timer); timer = 0; try { a.pause(); } catch { /* ignore */ }
    if (playing === me) { playing = null; sync(); }
  };
  const onVis = (): void => { if (dead) return; if (document.hidden) a.pause(); else void a.play().catch(() => {}); };
  document.addEventListener('visibilitychange', onVis);
  a.addEventListener('error', fallback);
  playing = me;
  dir = 1; run();
  a.play().catch(fallback);
}
function startSynth(name: MusicCtx): void {
  const ctx = getCtx(), chain = getChain();
  if (!ctx || !chain) return;
  const lite = liteOn(), tr = TRACKS[name], s16 = 60 / tr.bpm / 4;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, ctx.currentTime);
  out.gain.exponentialRampToValueAtTime(MUSIC_TRIMS[name] ?? 0.6, ctx.currentTime + 0.5);
  out.connect(chain.music);
  const buses: Buses = buildBuses(ctx, out, chain.musicSends, lite);
  let step = 0, nextT = ctx.currentTime + 0.06;
  cur = name === 'game' ? Math.max(cur, tension) : cur;
  const tick = (): void => {
    if (ctx.state !== 'running') return;
    const target = Math.min(1, tension + (boostBars > 0 ? 0.5 : 0));
    cur += (target - cur) * 0.12;
    if (nextT < ctx.currentTime - 0.1) nextT = ctx.currentTime + 0.05;
    while (nextT < ctx.currentTime + 0.14) {
      const i = step % tr.len, odd = i & 1;
      if (i === 0 && step > 0 && boostBars > 0) boostBars--;
      tr.step(buses, i, nextT + (odd ? tr.swing * s16 : 0), s16, name === 'pack' ? 1 : name === 'triumph' ? fanI : cur);
      nextT += s16; step++;
    }
  };
  const id = window.setInterval(tick, 25);
  tick();
  playing = {
    name, kind: 'synth',
    stop() {
      window.clearInterval(id);
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), t); out.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      setTimeout(() => { try { out.disconnect(); } catch { /* gone */ } }, 700);
    },
  };
}

/** Wires volume / mute / unlock changes to the player. Call once at start-up. */
export function initMusic(): void {
  onAudioChange(sync);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); else if (playing?.kind === 'synth') { /* the context is suspended by sfx.ts */ } });
}
