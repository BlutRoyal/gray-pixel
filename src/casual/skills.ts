// Baller positions, passive skills and Sneaker effects for the v2 rules. All of it is derived from stats, id, tier and the Sneaker row:
// no clicks, no randomness, so the same Baller always plays the same way. DOM-free.
import { catalog, type Tier } from '../rules';
import { TUNING as T } from './tuning';

export type Zone = 'rim' | 'mid' | 'three';
export type Pos = 'G' | 'W' | 'B';
export const ZONES: Zone[] = ['rim', 'mid', 'three'];
export const ZONE_NAME: Record<Zone, string> = { rim: 'Rim', mid: 'Mid', three: 'Three' };
export const ZONE_PTS: Record<Zone, number> = { rim: 2, mid: 2, three: 3 };
export const SCHEME_NAME: Record<Zone, string> = { rim: 'Pack the Paint', mid: 'Drop', three: 'Close Out' };
export const POS_NAME: Record<Pos, string> = { G: 'Guard', W: 'Wing', B: 'Big' };

// ---------- positions ----------
interface Stats { D: number; P: number; S: number; F: number }
const rawPos = (st: Stats): Record<Pos, number> => ({ G: st.P * 0.7 + st.S * 0.3, W: st.S * 0.7 + st.D * 0.3 + 3, B: st.D * 0.7 + st.F * 0.3 });
let MEANS: Record<Pos, number> | null = null;
function means(): Record<Pos, number> {
  if (!MEANS) {
    const rows = catalog().B, m = { G: 0, W: 0, B: 0 };
    for (const b of rows) { const r = rawPos({ D: b[1], P: b[2], S: b[3], F: b[4] }); m.G += r.G; m.W += r.W; m.B += r.B; }
    MEANS = { G: m.G / rows.length, W: m.W / rows.length, B: m.B / rows.length };
  }
  return MEANS;
}
/** Guard, Wing or Big from the stats: whichever role he beats the league average at by the most. */
export function positionOf(st: Stats): Pos {
  const r = rawPos(st), m = means();
  const z: [Pos, number][] = [['G', r.G - m.G], ['W', r.W - m.W], ['B', r.B - m.B]];
  z.sort((a, b) => b[1] - a[1]);
  return z[0][0];
}

// ---------- skills ----------
export interface SkillFx {
  /** Bonus on his own shots (percent points). */
  zone?: Partial<Record<Zone, number>>;
  all?: number;
  /** Penalty on shots of the man he guards. */
  stop?: Partial<Record<Zone, number>>;
  stopAll?: number;
  /** His shot in these zones can't be read by the scheme. */
  ignore?: Zone[];
  /** Halves the read penalty on his shots in these zones. */
  halfRead?: Zone[];
  /** Extra assist bonus when he is the passer. */
  passer?: number;
  /** Fatigue multiplier (0.5 = half). */
  fatigue?: number;
  /** Extra bonus while On Fire; and one make is enough to catch fire. */
  fire?: number;
  fireStart?: boolean;
  /** Extra Momentum for his team when he scores (optionally only in a zone). */
  mo?: number;
  moZone?: Zone;
  /** Opponent loses Momentum when he scores. */
  drain?: number;
  /** Extra putback chance (percent). */
  putback?: number;
  /** Extra open-man bonus when a double team leaves a teammate free and he is the passer. */
  dtPass?: number;
}
export interface Skill { key: string; name: string; text: string; tier: 'generic' | 'epic' | 'legendary' | 'iconic'; fx: SkillFx }

const sgn = (v: number) => (v > 0 ? '+' : '') + v;
function describeSkill(fx: SkillFx): string {
  const p: string[] = [];
  for (const z of Object.keys(fx.zone || {}) as Zone[]) p.push(`${sgn(fx.zone![z]!)}% on his ${ZONE_NAME[z]} shots.`);
  if (fx.all) p.push(`${sgn(fx.all)}% on all his shots.`);
  for (const z of Object.keys(fx.stop || {}) as Zone[]) p.push(`The man he guards gets −${fx.stop![z]}% at the ${ZONE_NAME[z]}.`);
  if (fx.stopAll) p.push(`The man he guards gets −${fx.stopAll}% on every shot.`);
  if (fx.ignore) p.push(`His ${fx.ignore.map((z) => ZONE_NAME[z]).join(' and ')} shot ignores ${fx.ignore.map((z) => SCHEME_NAME[z]).join(' and ')}.`);
  if (fx.halfRead) p.push(`A read costs his ${fx.halfRead.map((z) => ZONE_NAME[z]).join(' and ')} shot only half.`);
  if (fx.passer) p.push(`As the passer he gives ${sgn(fx.passer)}% more assist bonus.`);
  if (fx.dtPass) p.push(`When a double team frees a teammate, his pass adds ${sgn(fx.dtPass)}% more.`);
  if (fx.fatigue != null && fx.fatigue < 1) p.push(`Fatigue hits him ${Math.round((1 - fx.fatigue) * 100)}% less.`);
  if (fx.fireStart) p.push('One make and he is On Fire.');
  if (fx.fire) p.push(`On Fire gives him ${sgn(fx.fire)}% more.`);
  if (fx.mo) p.push(`His ${fx.moZone ? ZONE_NAME[fx.moZone] + ' ' : ''}baskets give +${fx.mo} extra Momentum.`);
  if (fx.drain) p.push(`His baskets drain ${fx.drain} Momentum from the other team.`);
  if (fx.putback) p.push(`${sgn(fx.putback)}% putback chance on a missed Rim shot.`);
  return p.join(' ');
}
const mk = (key: string, name: string, tier: Skill['tier'], fx: SkillFx, text?: string): Skill => ({ key, name, tier, fx, text: text || describeSkill(fx) });

/** Common, Uncommon and Rare Ballerz: a generic skill for their position. Rare is a notch stronger. */
function generic(pos: Pos, n: number, rare: boolean): Skill {
  const v = rare ? 3 : 2;
  const table: Record<Pos, Skill[]> = {
    G: [mk('g_vision', 'Floor Vision', 'generic', { passer: rare ? 2 : 1 }), mk('g_pest', 'Pest', 'generic', { stopAll: v }), mk('g_pullup', 'Pull-Up', 'generic', { zone: { mid: v } })],
    W: [mk('w_spot', 'Spot Up', 'generic', { zone: { three: v } }), mk('w_slash', 'Slasher', 'generic', { zone: { rim: v } }), mk('w_perim', 'Perimeter D', 'generic', { stop: { three: v + 1 } })],
    B: [mk('b_runner', 'Rim Runner', 'generic', { zone: { rim: v } }), mk('b_protect', 'Rim Protector', 'generic', { stop: { rim: v + 1 } }), mk('b_glass', 'Glass Cleaner', 'generic', { putback: rare ? 10 : 6 })],
  };
  return table[pos][n % 3];
}
const EPIC: Record<Pos, Skill[]> = {
  G: [mk('e_dime', 'Dime Dropper', 'epic', { passer: 3 }), mk('e_clamps', 'Clamps', 'epic', { stopAll: 4 }), mk('e_streak', 'Streaky', 'epic', { fire: 5, zone: { mid: 2 } })],
  W: [mk('e_sniper', 'Sniper', 'epic', { zone: { three: 4 } }), mk('e_slice', 'Slice and Dice', 'epic', { zone: { rim: 4 } }), mk('e_twoway', 'Two-Way', 'epic', { zone: { three: 2 }, stopAll: 2 })],
  B: [mk('e_bruiser', 'Bruiser', 'epic', { zone: { rim: 4 } }), mk('e_wall', 'The Wall', 'epic', { stop: { rim: 5 } }), mk('e_iron', 'Iron Man', 'epic', { fatigue: 0.5 })],
};
const LEGENDARY: Record<Pos, Skill[]> = {
  G: [mk('l_maestro', 'Maestro', 'legendary', { passer: 5, dtPass: 5 }), mk('l_heat', 'Heat Check', 'legendary', { fireStart: true, fire: 5, zone: { mid: 3 } })],
  W: [mk('l_deadeye', 'Deadeye', 'legendary', { zone: { three: 5 }, halfRead: ['three'] }), mk('l_lockdown', 'Lockdown', 'legendary', { stopAll: 6 })],
  B: [mk('l_poster', 'Posterizer', 'legendary', { zone: { rim: 6 }, mo: 1, moZone: 'rim' }), mk('l_fortress', 'Fortress', 'legendary', { stop: { rim: 8, mid: 4 } })],
};
const ICONIC: Record<Pos, Skill[]> = {
  G: [mk('i_glitchstep', 'Glitch Step', 'iconic', { ignore: ['mid'], zone: { mid: 3 } }, 'Mid shot ignores Drop. +3% on his Mid shots.'), mk('i_frameskip', 'Frame Skip', 'iconic', { ignore: ['rim'], zone: { rim: 2 } }, 'Rim shot ignores Pack the Paint. +2% on his Rim shots.')],
  W: [mk('i_nullptr', 'Null Pointer', 'iconic', { ignore: ['three'], zone: { three: 3 } }, 'Three ignores Close Out. +3% on his Three shots.'), mk('i_overflow', 'Overflow', 'iconic', { all: 3, mo: 2 }, '+3% on all his shots. His baskets give +2 extra Momentum.')],
  B: [mk('i_memleak', 'Memory Leak', 'iconic', { zone: { rim: 4 }, drain: 2 }, '+4% on his Rim shots. His baskets drain 2 Momentum from the other team.'), mk('i_segfault', 'Segfault', 'iconic', { stopAll: 5, stop: { rim: 5 } }, 'The man he guards gets −5% on every shot and −10% at the Rim.')],
};
/** The passive skill of a Baller. Deterministic from id, position and tier. */
/** Common and Uncommon Ballerz share the basic generic skills; Rare is a notch stronger. */
export function skillFor(id: number, pos: Pos, tier: Tier): Skill {
  const h = Math.imul(id + 1, 2654435761) >>> 0, n = (h >>> 8) % 6;
  switch (tier) {
    case 'iconic': return ICONIC[pos][n % 2];
    case 'legendary': return LEGENDARY[pos][n % 2];
    case 'epic': return EPIC[pos][n % 3];
    case 'rare': return generic(pos, n, true);
    default: return generic(pos, n, false);
  }
}

// ---------- Sneakerz ----------
export const ENH = { none: 0, ankle: 1, lane: 2, dime: 3, bullseye: 4 } as const;
/** Rarity index (Common, Uncommon, Rare, Legendary, Iconic, Custom) to the bonus on every shot. */
export const SNEAKER_BONUS = [1, 2, 4, 6, 8, 8];
export interface Shoe {
  id: number;
  rarI: number;
  /** Bonus on every shot (percent points). */
  bonus: number;
  /** Rim bonus from Jump, 0..8. */
  jumpRim: number;
  /** Putback chance on a missed Rim shot (percent), 0..8. */
  putback: number;
  jump: number;
  enh: number;
}
/** Custom Sneakerz: only Bullseye is good (+8). Other Customs: +3 with an enhancement, +2 without. */
export function customBonus(enh: number): number { return enh === ENH.bullseye ? T.snkBullseye : enh ? T.snkCustom : T.snkPlain; }
const snkBonus = (i: number): number => [T.snkCommon, T.snkUncommon, T.snkRare, T.snkLegendary, T.snkIconic][i] ?? 0;
export function shoeOf(row: number[] | null | undefined): Shoe | null {
  if (!row) return null;
  const jump = row[1], rarI = row[3], enh = row[2];
  const jumpRim = Math.round(Math.max(0, Math.min(8, ((jump - 60) / 39) * 8)) * 10) / 10;
  return { id: row[0], rarI, bonus: rarI === 5 ? customBonus(enh) : snkBonus(rarI), jumpRim, putback: Math.round(Math.max(0, Math.min(8, ((jump - 70) / 29) * 8)) * 10) / 10, jump, enh };
}
export const ENH_TEXT: Record<number, string> = {
  1: 'Ankle Breaker: Drop costs your Mid shot only half.',
  2: 'Drive the Lane: Pack the Paint costs your Rim shot only half.',
  3: 'Stopping on a Dime: you get tired half as fast.',
  4: 'Bullseye: Close Out costs your Three only half.',
};
/** One-line description of what a Sneaker does for the wearer. */
export function shoeText(s: Shoe): string {
  return `+${s.bonus}% on every shot · Rim +${s.jumpRim}% · putback ${s.putback}%${s.enh ? ' · ' + ENH_TEXT[s.enh].split(':')[0] : ''}`;
}
