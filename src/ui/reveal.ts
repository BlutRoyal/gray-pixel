// What a pack opening shows BEFORE a card is turned over, as pure data (no DOM) so it can be tested.
// The rule: Epic and Legendary share one descriptor ('epic+'): same build-up, same edge colour and sparks, same sounds. They part at the flip.
import type { Tier } from '../rules';

export type HintKey = 'common' | 'uncommon' | 'rare' | 'epic+' | 'iconic' | 'holo';
export interface PreFlip {
  key: HintKey;
  /** class on the card wrapper while it is face down (never names Epic or Legendary) */
  cls: string;
  /** edge glow 0..1 and the number of sparks around the face-down card */
  glow: number; sparks: number;
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
  common: { key: 'common', cls: 't-common', glow: 0, sparks: 0, buildMs: 0, shake: 0, heart: false, leak: false, faceGlitch: 0, sfxRank: 0, turnMs: 520 },
  uncommon: { key: 'uncommon', cls: 't-uncommon', glow: 0.15, sparks: 1, buildMs: 0, shake: 0, heart: false, leak: false, faceGlitch: 0, sfxRank: 1, turnMs: 600 },
  rare: { key: 'rare', cls: 't-rare', glow: 0.35, sparks: 3, buildMs: 900, shake: 0.25, heart: false, leak: false, faceGlitch: 0, sfxRank: 2, turnMs: 850 },
  'epic+': { key: 'epic+', cls: 'h-epicplus', glow: 0.7, sparks: 6, buildMs: 3400, shake: 0.7, heart: true, leak: true, faceGlitch: 0, sfxRank: 4, turnMs: 1200 },
  iconic: { key: 'iconic', cls: 't-iconic g-sub', glow: 1, sparks: 10, buildMs: 3800, shake: 0.85, heart: true, leak: true, faceGlitch: 1, sfxRank: 5, turnMs: 1500 },
  holo: { key: 'holo', cls: 't-iconic g-heavy', glow: 1, sparks: 12, buildMs: 4200, shake: 1, heart: true, leak: true, faceGlitch: 2, sfxRank: 5, turnMs: 2000 },
};
export function preFlip(p: { tier: Tier; holo?: boolean }): PreFlip {
  const k: HintKey = p.tier === 'epic' || p.tier === 'legendary' ? 'epic+' : p.tier === 'iconic' ? (p.holo ? 'holo' : 'iconic') : p.tier;
  return T[k];
}
/** Tier classes added at the moment of the turn (the face-down card had no Epic/Legendary name). */
export const turnClass = (tier: Tier): string => 't-' + tier;

export type Tease = 'none' | 'epic+' | 'iconic' | 'holo';
export interface PackTease { kind: Tease; /** the hint of the best card, for the rip colour */ best: HintKey; /** how long the rip lasts (ms) */ ripMs: number }
const ORDER: HintKey[] = ['common', 'uncommon', 'rare', 'epic+', 'iconic', 'holo'];
/** What the sealed pack does: HOLO Iconic inside = hard glitch; normal Iconic = a mild short flicker; Epic or Legendary = the same light shake. */
export function packTease(pulls: { tier: Tier; holo?: boolean }[]): PackTease {
  let b = 0;
  for (const p of pulls) b = Math.max(b, ORDER.indexOf(preFlip(p).key));
  const best = ORDER[b];
  return { kind: best === 'holo' ? 'holo' : best === 'iconic' ? 'iconic' : best === 'epic+' ? 'epic+' : 'none', best, ripMs: [900, 900, 1000, 1700, 2200, 2800][b] };
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
