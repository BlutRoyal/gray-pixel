// What a pack opening shows BEFORE a card is turned over, as pure data (no DOM) so it can be tested.
// The rule: Epic and Legendary share one descriptor ('epic+'): same build-up, same edge colour and sparks, same sounds. They part at the flip.
import type { Tier } from '../rules';

export type HintKey = 'plain' | 'epic+' | 'iconic' | 'holo';
export interface PreFlip {
  key: HintKey;
  /** class on the card wrapper while it is face down (never names a tier below Iconic) */
  cls: string;
  /** edge glow 0..1 and the number of sparks around the face-down card */
  glow: number; sparks: number;
  /** the face-down back/edge cycles between the Epic and the Legendary colour (shared by both, so neither gives itself away) */
  alt: boolean;
  /** the stretched suspense after the click and before the turn (ms); 0 = turns at once */
  buildMs: number;
  /** shake strength 0..1 during the build-up, heartbeat on, light leaking from the edges */
  shake: number; heart: boolean; leak: boolean;
  /** 0 clean, 1 a light flicker/tear in the back (normal Iconic), 2 continuous heavy glitch (HOLO) */
  faceGlitch: 0 | 1 | 2;
  /** build-up sound intensity and the turn time (ms) */
  sfxRank: number; turnMs: number;
}
const T: Record<HintKey, PreFlip> = {
  // Common, Uncommon and Rare look exactly the same face down: a plain card, no hint colour, no glow, no build-up
  plain: { key: 'plain', cls: 't-common', glow: 0, sparks: 0, alt: false, buildMs: 0, shake: 0, heart: false, leak: false, faceGlitch: 0, sfxRank: 0, turnMs: 600 },
  'epic+': { key: 'epic+', cls: 'h-epicplus', glow: 0.7, sparks: 6, alt: true, buildMs: 3400, shake: 0.7, heart: true, leak: true, faceGlitch: 0, sfxRank: 4, turnMs: 1200 },
  iconic: { key: 'iconic', cls: 't-iconic g-sub', glow: 1, sparks: 10, alt: false, buildMs: 3800, shake: 0.85, heart: true, leak: true, faceGlitch: 1, sfxRank: 5, turnMs: 1500 },
  holo: { key: 'holo', cls: 't-iconic g-heavy', glow: 1, sparks: 12, alt: false, buildMs: 4200, shake: 1, heart: true, leak: true, faceGlitch: 2, sfxRank: 5, turnMs: 2000 },
};
export function preFlip(p: { tier: Tier; holo?: boolean }): PreFlip {
  const k: HintKey = p.tier === 'epic' || p.tier === 'legendary' ? 'epic+' : p.tier === 'iconic' ? (p.holo ? 'holo' : 'iconic') : 'plain';
  return T[k];
}
/** Tier classes added at the moment of the turn (the face-down card had no Epic/Legendary name). */
export const turnClass = (tier: Tier): string => 't-' + tier;

export type Tease = 'none' | 'epic+' | 'iconic' | 'holo';
export interface PackTease { kind: Tease; /** the hint of the best card, for the rip colour */ best: HintKey; /** how long the rip lasts (ms) */ ripMs: number }
const ORDER: HintKey[] = ['plain', 'epic+', 'iconic', 'holo'];
/** What the sealed pack does: HOLO Iconic inside = hard glitch; normal Iconic = a mild short flicker; Epic or Legendary = the same light shake. */
export function packTease(pulls: { tier: Tier; holo?: boolean }[]): PackTease {
  let b = 0;
  for (const p of pulls) b = Math.max(b, ORDER.indexOf(preFlip(p).key));
  const best = ORDER[b];
  return { kind: best === 'holo' ? 'holo' : best === 'iconic' ? 'iconic' : best === 'epic+' ? 'epic+' : 'none', best, ripMs: [900, 1700, 2200, 2800][b] };
}
/** A smooth glide in from above with one very light settle (no repeated bounce). Heights in px. */
export function glideFrames(y0: number, settle = 7): { keys: Keyframe[]; dur: number; hit: number } {
  const dur = 780;
  return {
    keys: [
      { offset: 0, transform: `translateY(${-Math.abs(y0)}px) rotate(-3deg)`, easing: 'cubic-bezier(.18,.7,.3,1)' },
      { offset: 0.78, transform: `translateY(${settle}px) rotate(0.5deg) scale(1.01, 0.99)`, easing: 'ease-out' },
      { offset: 1, transform: 'none' },
    ], dur, hit: dur * 0.78,
  };
}

// ---------- opening styles and glitch variants (presets as data; the Lab gallery previews and picks the default) ----------
export type RevealId = 'clean' | 'classic' | 'cinematic';
export type GlitchId = 'slice' | 'v10' | 'fast';
/** Effect flags of one opening style. The flow is the same for all; the flags switch layers on or off. */
export interface RevealStyle {
  id: RevealId; name: string; blurb: string;
  /** multiplier of the Epic+/Iconic build-up time (0 = none) and of the card shake during it */
  buildMul: number; shakeMul: number;
  /** heartbeat pulses, light leaking from the edges, sparks around the face-down card, light rays on the rip */
  heart: boolean; leak: boolean; hintSparks: boolean; rays: boolean;
  /** lowest card rank (0 Common .. 5 Iconic) that bursts particles, and whether it is the full burst */
  burstFrom: number; burst: 'full' | 'iconic';
  /** screen shake at the flip (Legendary and up / Iconic only), particle rain (Epic+ / Iconic only / none) */
  quake: 'legendary' | 'iconic' | 'none'; rain: 'epic' | 'iconic' | 'none';
  /** Epic: clean tier glow or the old flash; Legendary: gold sweep + banner or the old full-screen word + flash */
  epicFx: 'glow' | 'flash'; legendaryFx: 'sweep' | 'walkout';
  /** the wait between cards is steady (clean) or grows with the tier */
  steady: boolean;
}
export const REVEAL_STYLES: Record<RevealId, RevealStyle> = {
  clean: { id: 'clean', name: 'Clean', blurb: 'Dim, calm and steady. Common to Rare: a plain flip. Epic: build-up, then a tier-colour glow. Legendary: gold light sweep and a name banner. Iconic: dark flash, gold burst, stinger.',
    buildMul: 1, shakeMul: 0.35, heart: true, leak: true, hintSparks: false, rays: false, burstFrom: 3, burst: 'iconic', quake: 'iconic', rain: 'iconic', epicFx: 'glow', legendaryFx: 'sweep', steady: true },
  classic: { id: 'classic', name: 'v1.0 classic', blurb: 'The first version, approximated: no long suspense, a short charge, sparks and a flash from Rare up, a big word and screen shake for Legendary and Iconic.',
    buildMul: 0.3, shakeMul: 0.5, heart: false, leak: false, hintSparks: false, rays: false, burstFrom: 2, burst: 'full', quake: 'legendary', rain: 'none', epicFx: 'flash', legendaryFx: 'walkout', steady: false },
  cinematic: { id: 'cinematic', name: 'v2.2 cinematic', blurb: 'The round 4 opening: long suspense with heartbeat, shaking card and sparks, light rays on the rip, bursts from Epic up, golden rain and screen shake.',
    buildMul: 1, shakeMul: 1, heart: true, leak: true, hintSparks: true, rays: true, burstFrom: 3, burst: 'full', quake: 'legendary', rain: 'epic', epicFx: 'flash', legendaryFx: 'walkout', steady: false },
};
/** Glitch variants for the sealed pack and the face-down / face-up HOLO and Iconic card (CSS class gv-* on the opening overlay). */
export const GLITCH_STYLES: Record<GlitchId, { id: GlitchId; name: string; blurb: string }> = {
  slice: { id: 'slice', name: 'Current: slice and colour', blurb: 'The v1.0 cadence of colour slices and brightness jolts every 2.6 s, with a light static layer on the pack.' },
  v10: { id: 'v10', name: 'v1.0 original', blurb: 'Only the pack wobble and the RGB layers on a 2.6 s cadence. No static, no card-back flicker, no jolt on the face.' },
  fast: { id: 'fast', name: 'v2.x fast RGB split', blurb: 'Round 4: fast RGB split every 0.45 s, static, a shaking stage and a tearing card back.' },
};
const KEY_STYLE = 'gp_reveal_style', KEY_GLITCH = 'gp_glitch_style';
const rd = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const wr = (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
export const getRevealId = (): RevealId => { const v = rd(KEY_STYLE) as RevealId | null; return v && v in REVEAL_STYLES ? v : 'clean'; };
export const getGlitchId = (): GlitchId => { const v = rd(KEY_GLITCH) as GlitchId | null; return v && v in GLITCH_STYLES ? v : 'slice'; };
export const setRevealId = (id: RevealId): void => wr(KEY_STYLE, id);
export const setGlitchId = (id: GlitchId): void => wr(KEY_GLITCH, id);
/** The face-down descriptor adjusted by a style: build time, shake, sparks, heartbeat and leaking light. Iconic keeps its own build in every style. */
export function styled(pre: PreFlip, s: RevealStyle): PreFlip {
  if (pre.buildMs <= 0) return pre;
  const iconic = pre.key === 'iconic' || pre.key === 'holo';
  const mul = iconic ? Math.max(s.buildMul, 0.3) : s.buildMul;
  return { ...pre, buildMs: Math.round(pre.buildMs * mul), shake: pre.shake * s.shakeMul, heart: pre.heart && (s.heart || iconic), leak: pre.leak && (s.leak || iconic), sparks: s.hintSparks || iconic ? pre.sparks : 0, glow: pre.glow };
}
