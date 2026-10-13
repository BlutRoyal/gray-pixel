// Card tiers. DOM-free, so tiers can be tested and simulated like the rules.
// Ballerz get their tier by RANK (not percentage): everyone is ranked by the mean of his top three stats among DNK/SHT/PLY/DEF,
// ties by the sum of all four, then by id. The ranking is computed once from the catalog, so it is the same on every machine.
import { ballerRow, catalog, classOf } from './engine';
import type { BallerClass } from './types';

export type Tier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'iconic';
export const TIERS: Tier[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'iconic'];
export const TIER_NAME: Record<Tier, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', iconic: 'Iconic' };
export const tierRank = (t: Tier): number => TIERS.indexOf(t);

/** Ranks: the top 50 Ballerz are Iconic, the next 200 Legendary, the next 750 Epic; the rest split 15% Rare, 30% Uncommon, 55% Common. */
export const RANK_CUTS = { iconic: 50, legendary: 200, epic: 750 };
export const REST_SPLIT = { rare: 0.15, uncommon: 0.3 };

/** Mean of the three best stats among D, P, S, F (the sort key of a Baller). */
export const top3Mean = (b: number[]): number => { const s = [b[1], b[2], b[3], b[4]].sort((x, y) => y - x); return (s[0] + s[1] + s[2]) / 3; };
const sum4 = (b: number[]): number => b[1] + b[2] + b[3] + b[4];

let BALLER_TIER: Map<number, Tier> | null = null;
let BALLER_RANK: Map<number, number> | null = null;
let BY_TIER: Record<Tier, number[]> | null = null;

function indexTiers(): void {
  // All-Stars (role 2) are coaches, never roster cards. A few ids repeat in the catalog: the row the game uses (the last one) counts.
  const rows = catalog().B.filter((b) => b[10] !== 2 && ballerRow(b[0]) === b).slice().sort((a, b) => top3Mean(b) - top3Mean(a) || sum4(b) - sum4(a) || a[0] - b[0]);
  BALLER_TIER = new Map();
  BALLER_RANK = new Map();
  BY_TIER = { common: [], uncommon: [], rare: [], epic: [], legendary: [], iconic: [] };
  const n = rows.length, rest = n - RANK_CUTS.iconic - RANK_CUTS.legendary - RANK_CUTS.epic;
  const c1 = RANK_CUTS.iconic, c2 = c1 + RANK_CUTS.legendary, c3 = c2 + RANK_CUTS.epic;
  const c4 = c3 + Math.round(rest * REST_SPLIT.rare), c5 = c4 + Math.round(rest * REST_SPLIT.uncommon);
  rows.forEach((b, i) => {
    const t: Tier = i < c1 ? 'iconic' : i < c2 ? 'legendary' : i < c3 ? 'epic' : i < c4 ? 'rare' : i < c5 ? 'uncommon' : 'common';
    BALLER_TIER!.set(b[0], t);
    BALLER_RANK!.set(b[0], i + 1);
    BY_TIER![t].push(b[0]);
  });
}
export function ballerTier(id: number): Tier {
  if (!BALLER_TIER) indexTiers();
  return BALLER_TIER!.get(id) || 'common';
}
/** 1 = the best Baller in the catalog. */
export function ballerRankOf(id: number): number {
  if (!BALLER_RANK) indexTiers();
  return BALLER_RANK!.get(id) || 0;
}
export function ballersOfTier(t: Tier): number[] {
  if (!BY_TIER) indexTiers();
  return BY_TIER![t];
}
export function ballerClass(b: number[]): BallerClass {
  return classOf({ D: b[1], P: b[2], S: b[3], F: b[4] });
}

// ---------- Sneakerz ----------
/** Sneaker rarity names (catalog order). Custom is shown as Epic colour, see sneakerRowTier. */
export const SNEAKER_RARITY = ['Common', 'Uncommon', 'Rare', 'Legendary', 'Iconic', 'Custom'];
/** Display tier of a Sneaker row [id, jump, enh, rarity, ...]: Iconic Sneaker = Iconic, Custom Bullseye = Legendary, other Custom with an enhancement = Epic, plain Custom = Rare. */
export function sneakerRowTier(s: number[]): Tier {
  switch (s[3]) {
    case 0: return 'common';
    case 1: return 'uncommon';
    case 2: return 'rare';
    case 3: return 'legendary';
    case 4: return 'iconic';
    default: return s[2] === 4 ? 'legendary' : s[2] ? 'epic' : 'rare';
  }
}
/** Tier of a rarity index when the enhancement is unknown (a plain Custom counts as Epic). */
export const sneakerTier = (rarI: number): Tier => (['common', 'uncommon', 'rare', 'legendary', 'iconic', 'epic'] as Tier[])[rarI];
let SNEAKER_BY_TIER: Record<Tier, number[]> | null = null;
export function sneakersOfTier(t: Tier): number[] {
  if (!SNEAKER_BY_TIER) {
    SNEAKER_BY_TIER = { common: [], uncommon: [], rare: [], epic: [], legendary: [], iconic: [] };
    for (const s of catalog().S) SNEAKER_BY_TIER[sneakerRowTier(s)].push(s[0]);
  }
  return SNEAKER_BY_TIER[t];
}
