// The one sound engine: a shared AudioContext (made on the first gesture, never before), a master chain (gain, compressor, limiter,
// short reverbs), settings that persist, a voice cap, and `sfx(name)` for every sound in sounds.ts. Music (music.ts) plays on the same chain.
import { DEFAULT_AUDIO, effectiveGains, loadSettings, saveSettings, type AudioSettings } from './audioSettings';
import { SOUNDS, type SfxName, type SfxOpts } from './sounds';
import { buildChain, voiceRig, type Chain } from './synth';
import { liteOn } from './lite';

export type { SfxName, SfxOpts };

let ctx: AudioContext | null = null;
let chain: Chain | null = null;
let settings: AudioSettings = loadSettings();
const listeners = new Set<() => void>();
const active: { end: number; cost: number }[] = [];
const lastAt: Partial<Record<string, number>> = {};
let unlocked = false;

export const getAudio = (): AudioSettings => ({ ...settings });
export const audioReady = (): boolean => !!ctx && ctx.state === 'running';
export const getCtx = (): AudioContext | null => ctx;
export const getChain = (): Chain | null => chain;
/** Hears about volume / mute changes (the music player uses it). */
export function onAudioChange(fn: () => void): () => void { listeners.add(fn); return () => listeners.delete(fn); }

function applyGains(): void {
  if (!ctx || !chain) return;
  const g = effectiveGains(settings), t = ctx.currentTime;
  chain.master.gain.setTargetAtTime(g.master, t, 0.03);
  chain.sfx.gain.setTargetAtTime(g.sfx, t, 0.03);
  chain.music.gain.setTargetAtTime(g.music, t, 0.05);
}
export function setAudio(patch: Partial<AudioSettings>): void {
  settings = { ...settings, ...patch };
  for (const k of ['master', 'sfx', 'music'] as const) settings[k] = Math.max(0, Math.min(1, Number.isFinite(settings[k]) ? settings[k] : DEFAULT_AUDIO[k]));
  saveSettings(settings);
  applyGains();
  listeners.forEach((f) => f());
}

/** Creates the context (only ever from a user gesture) and builds the master chain. */
export function unlock(): void {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC({ latencyHint: 'interactive' });
      chain = buildChain(ctx, ctx.destination, liteOn());
      applyGains();
      document.addEventListener('visibilitychange', onVis);
    }
    if (ctx.state === 'suspended' && !document.hidden) void ctx.resume();
    if (!unlocked) { unlocked = true; listeners.forEach((f) => f()); }
  } catch { /* no audio in this browser */ }
}
function onVis(): void {
  if (!ctx) return;
  try { if (document.hidden) void ctx.suspend(); else void ctx.resume(); } catch { /* ignore */ }
}
/** Unlocks on the first tap, click or key press anywhere (browsers refuse audio before that). */
export function installUnlock(): void {
  const once = (): void => { unlock(); for (const e of ['pointerdown', 'touchend', 'keydown', 'click']) window.removeEventListener(e, once, true); };
  for (const e of ['pointerdown', 'touchend', 'keydown', 'click']) window.addEventListener(e, once, true);
}

function room(cost: number, pri: number, t: number): boolean {
  for (let i = active.length - 1; i >= 0; i--) if (active[i].end < t) active.splice(i, 1);
  const used = active.reduce((s, v) => s + v.cost, 0), cap = pri === 0 ? 40 : pri === 1 ? 64 : 96;
  return used + cost <= cap;
}
/** Plays one sound. A no-op before the first gesture, while muted, or when the tab is hidden. */
export function sfx(name: SfxName, o: SfxOpts = {}, retry = true): void {
  if (!ctx || !chain || document.hidden) return;
  // the first gesture creates the context 'suspended': start it, then play (a few ms later)
  if (ctx.state === 'suspended' && retry) { void ctx.resume().then(() => sfx(name, o, false)).catch(() => {}); return; }
  if (ctx.state !== 'running') return;
  if (settings.mute || settings.sfx <= 0 || settings.master <= 0) return;
  const def = SOUNDS[name], t = ctx.currentTime + 0.012;
  const gap = def.pri === 0 ? 0.045 : 0.02, last = lastAt[name];
  if (last !== undefined && t - last < gap) return;
  if (!room(def.cost, def.pri, t)) return;
  lastAt[name] = t;
  try {
    const len = def.fn(voiceRig(chain.sfxRig, def.trim), t, o);
    active.push({ end: t + len, cost: def.cost });
  } catch { /* a bad node must never break the game */ }
}
/** Voice count in use (for tests / debugging). */
export const voicesInUse = (): number => active.reduce((s, v) => s + v.cost, 0);
