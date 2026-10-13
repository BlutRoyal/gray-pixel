// Half-court geometry for the possession animation. DOM-free so it can be tested. Coordinates are percent of the court box (0..100),
// hoop at the top. Both teams share the same half court: the team on offense stands low, the defense higher up.
import type { Zone } from '../casual/engine';

export type Pt = [number, number];
export const HOOP: Pt = [50, 7];
/** Resting spots: offense (outside the arc) and defense (inside it). */
export const COURT_POS = { off: [[16, 70], [50, 82], [84, 70]] as Pt[], def: [[24, 38], [50, 50], [76, 38]] as Pt[] };

/** Where a shooter stands for each zone, by his slot (0 left, 1 middle, 2 right). The shot starts from this exact spot. */
const ORIGINS: Record<Zone, Pt[]> = {
  rim: [[41, 21], [50, 19], [59, 21]],
  mid: [[30, 41], [50, 49], [70, 41]],
  three: [[12, 52], [50, 71], [88, 52]],
};
export function shotOrigin(zone: Zone, slot: number): Pt {
  const o = ORIGINS[zone];
  return o[((slot % 3) + 3) % 3];
}
/** Which zone a spot on the court belongs to (used for the zone highlight and tests). Mirrors the drawn court. */
export function zoneAt(x: number, y: number): Zone {
  if (x >= 35 && x <= 65 && y <= 36) return 'rim';
  return insideArc(x, y) ? 'mid' : 'three';
}
function arcX(y: number): number {
  // x of the left arc branch at depth y (0..64.5), by sampling the bezier
  if (y <= 24) return 7;
  let best = 7, bd = 1e9;
  for (let i = 0; i <= 80; i++) {
    const t = i / 160, u = 1 - t;
    const px = u * u * u * 7 + 3 * u * u * t * 7 + 3 * u * t * t * 93 + t * t * t * 93;
    const py = u * u * u * 24 + 3 * u * u * t * 78 + 3 * u * t * t * 78 + t * t * t * 24;
    const d = Math.abs(py - y);
    if (d < bd) { bd = d; best = px; }
  }
  return best;
}
function insideArc(x: number, y: number): boolean {
  if (y > 64.5) return false;
  const ax = arcX(y);
  return x >= ax && x <= 100 - ax;
}
/** A defender stands between his man and the hoop, a little to the side so the two do not overlap. */
export function contestSpot(shooter: Pt, side = 1, mode: 'normal' | 'tight' | 'late' = 'normal'): Pt {
  const dx = HOOP[0] - shooter[0], dy = HOOP[1] - shooter[1];
  const len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
  const px = -uy * side, py = ux * side;
  // tight = a right guess: right in his face; late = a wrong guess: a step behind and off to the side
  const back = mode === 'tight' ? Math.min(7, len * 0.4) : mode === 'late' ? Math.min(16, len * 0.6) : Math.min(11, len * 0.5);
  const lat = mode === 'tight' ? 3 : mode === 'late' ? 10 : 7;
  return [clamp(shooter[0] + ux * back + px * lat, 4, 96), clamp(shooter[1] + uy * back + py * lat, 6, 94)];
}
/** Where the three defenders stand for each scheme, left to right (percent of the court box). Pack the Paint sags into the lane (the Three is
 *  open), Drop gathers around the free-throw line (Rim and Three are less covered), Close Out runs out to the arc (the Rim is open). */
export const SCHEME_SPOTS: Record<Zone, Pt[]> = {
  rim: [[33, 24], [50, 30], [67, 24]],
  mid: [[35, 36], [50, 43], [65, 36]],
  three: [[18, 53], [50, 65], [82, 53]],
};
/** Where a shooter starts his Rim attack from (a drive from the elbow or the top of the key), by slot. */
export const DRIVE_START: Pt[] = [[26, 47], [50, 55], [74, 47]];
/** Where a Rim drive ends when the defender was beaten (at the basket, a step off the middle). */
export const DRIVE_END: Pt[] = [[44, 12], [50, 11], [56, 12]];
/** Assigns the formation spots to the defenders: the man on the ball gets the spot nearest the shooter, the rest keep their left-to-right order. */
export function formationFor(scheme: Zone, onBall: number, shooterX: number, current: Pt[] = COURT_POS.def): Pt[] {
  const spots = [...SCHEME_SPOTS[scheme]].sort((a, b) => a[0] - b[0]);
  const out: Pt[] = current.map((c) => c);
  let near = 0;
  spots.forEach((s, k) => { if (Math.abs(s[0] - shooterX) < Math.abs(spots[near][0] - shooterX)) near = k; });
  out[onBall] = spots[near];
  const rest = spots.filter((_s, k) => k !== near);
  current.map((c, i) => [i, c[0]] as [number, number]).filter(([i]) => i !== onBall).sort((a, b) => a[1] - b[1]).forEach(([i], k) => { out[i] = rest[k] ?? current[i]; });
  return out;
}
/** A Baller who finishes a Rim drive with a dunk rather than a layup: a Big or a high Rim rating. */
export const dunks = (b: { pos: string; rim: number }): boolean => b.pos === 'B' || b.rim >= 82;
/** A point `f` (0..1) of the way from a to b. */
export const lerpPt = (a: Pt, b: Pt, f: number): Pt => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
/** Two defenders collapsing on a double-teamed man. */
export function collapseSpots(mark: Pt): [Pt, Pt] {
  return [[clamp(mark[0] - 8, 4, 96), clamp(mark[1] - 9, 6, 94)], [clamp(mark[0] + 8, 4, 96), clamp(mark[1] - 9, 6, 94)]];
}
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
/** Flight height of the ball arc in px per zone (taller for longer shots). */
export const LOB: Record<Zone, number> = { rim: 60, mid: 100, three: 150 };

/** Rarity of a made shot, as an animation level: 0 none, 1 GLITCHED, 2 OVERCLOCKED, 3 SYSTEM ERROR (and INHUMAN). */
export function glitchLevel(label: string | null, inhuman: boolean): 0 | 1 | 2 | 3 {
  if (inhuman) return 3;
  if (label === 'SYSTEM ERROR') return 3;
  if (label === 'OVERCLOCKED') return 2;
  if (label === 'GLITCHED') return 1;
  return 0;
}
