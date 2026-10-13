// Story mode: eight courts, each harder than the last. The CPU gets stronger Ballerz, rarer cards and better decisions.
import { CLS_KEYS, type ClassKey } from '../rules';
import { bandTeam, cBaller, cpuDeck, newSide, type AiSkill, type CSide } from './engine';

export interface Stage {
  name: string;
  place: string;
  coach: ClassKey;
  band: [number, number];
  level: number;
  /** Level of the CPU Ballerz (1 to 5, +1 to every stat per level above 1). */
  lv?: number;
  /** Flat bonus (percent points) on every CPU shot: the boss's home-court edge. */
  edge?: number;
  skill: AiSkill;
  /** Bucks for the first clear (replays pay 40% of it). */
  reward: number;
  /** Pack for the first clear. */
  pack: 'street' | 'pro';
  /** Stage bosses give an extra pack and Bucks the first time. */
  boss?: { name: string; bucks: number; pack: 'pro' | 'icon' };
  blurb: string;
}
export const STAGES: Stage[] = [
  { name: 'Rookie Run', place: 'Park courts', coach: 'bucket', band: [0.05, 0.33], level: 0, skill: { smart: 0.25, sigma: 0.2 }, reward: 40, pack: 'street', blurb: 'Pickup game. They shoot whatever, whenever.' },
  { name: 'Blacktop', place: 'Schoolyard', coach: 'bully', band: [0.12, 0.42], level: 0.15, skill: { smart: 0.4, sigma: 0.17 }, reward: 50, pack: 'street', blurb: 'Big bodies who live in the paint.' },
  { name: 'The Cage', place: 'Fenced court', coach: 'show', band: [0.3, 0.6], level: 0.3, skill: { smart: 0.5, sigma: 0.15 }, reward: 60, pack: 'street', boss: { name: 'Showtime Sam', bucks: 80, pack: 'pro' }, blurb: 'Lobs, flash and a crowd that loves it.' },
  { name: 'Rooftop', place: 'Downtown', coach: 'splash', band: [0.4, 0.7], level: 0.45, skill: { smart: 0.6, sigma: 0.13 }, reward: 70, pack: 'street', blurb: 'Windy up here. They shoot from deep anyway.' },
  { name: 'Boardwalk', place: 'Beach league', coach: 'pnr', band: [0.45, 0.78], level: 0.55, skill: { smart: 0.7, sigma: 0.11 }, reward: 85, pack: 'street', blurb: 'Screen, roll, repeat. On beat.' },
  { name: 'Neon League', place: 'Night court', coach: 'three', band: [0.55, 0.85], level: 0.7, skill: { smart: 0.8, sigma: 0.1 }, reward: 100, pack: 'street', boss: { name: 'The Lockdown', bucks: 150, pack: 'pro' }, blurb: 'Lockdown defenders. Every read hurts.' },
  { name: 'The Underground', lv: 2, place: 'Warehouse', coach: 'bully', band: [0.72, 0.95], level: 0.85, skill: { smart: 0.9, sigma: 0.085 }, reward: 120, pack: 'street', blurb: 'No refs. No mercy.' },
  { name: 'All-Star Showdown', lv: 5, edge: 4, place: 'Main stage', coach: 'splash', band: [0.8, 0.95], level: 1, skill: { smart: 0.97, sigma: 0.07 }, reward: 160, pack: 'pro', boss: { name: 'The Champ', bucks: 300, pack: 'icon' }, blurb: 'The best Ballerz in the game, and they know it.' },
];
/** Quick Play: a random coach at mid-ladder strength. */
export const QUICK: Omit<Stage, 'coach'> = { name: 'Quick Play', place: 'Any court', band: [0.35, 0.75], level: 0.45, skill: { smart: 0.6, sigma: 0.12 }, reward: 0, pack: 'street', blurb: '' };
export function cpuSide(st: Omit<Stage, 'coach'> & { coach?: ClassKey }): CSide {
  const coach = st.coach || CLS_KEYS[Math.floor(Math.random() * CLS_KEYS.length)];
  const lv = st.lv || 1;
  const side = newSide(coach, bandTeam(st.band[0], st.band[1], coach).map((b) => (lv > 1 ? cBaller(b.id, b.sneakerId, lv) : b)), cpuDeck(coach, st.level));
  side.edge = st.edge || 0;
  return side;
}
