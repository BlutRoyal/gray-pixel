// Packs for the v2 progression: Baller packs (4 cards), the Sneaker Box (3 Sneakerz), odds, pity and the card pool. DOM-free, so the
// economy can be simulated (tools/econ.ts). Ballerz are tiered by rank (see rules/packs.ts); Play cards keep their stage-1 rarity
// (the Momentum cost): Basic = Common, Common = Rare, then Epic, Legendary, Iconic.
import { TIERS, ballersOfTier, ri, rnd, sneakersOfTier, tierRank, type Tier } from '../rules';
import { allCards, type CCard } from './cards';

export type PullKind = 'baller' | 'sneaker' | 'play';
export interface Pull {
  kind: PullKind;
  key: string;
  id: number | string;
  tier: Tier;
  holo: boolean;
  /** Filled in when the pull is stored: a HOLO that replaced the owned normal Iconic (the normal one became shards). */
  upgrade?: boolean;
  /** Filled in when the pull is stored: shards a duplicate turned into. */
  shards?: number;
  /** True when those shards went to this Play card's own level (not the shared pool). */
  cardShard?: boolean;
}
export type Odds = Partial<Record<Tier, number>>;
export interface PackDef {
  id: string;
  name: string;
  price: number;
  blurb: string;
  slots: { kind: PullKind; odds: Odds }[];
  /** Every Nth pack of this kind is guaranteed to hold a Baller of this tier or better. */
  pity?: { every: number; min: Tier };
}
/** About 1 in 5 Iconic Baller pulls is the HOLO variant (glitching foil, stronger special). Nothing else has a HOLO variant. */
export const HOLO_ICONIC = 0.2;

export const cardTier = (c: CCard): Tier => (c.rarity === 'basic' ? 'common' : c.rarity === 'common' ? 'rare' : c.rarity);

// Odds are weights per slot (they need not add up to 100). Baller packs hold 2 Ballerz + 3 Play cards. The per-slot Baller odds are set so the
// chance PER PACK of Rare+/Epic+/Legendary+/Iconic is the same as when a pack held 3 Ballerz (two slots, so each slot is a bit higher).
const BASIC: Odds = { common: 77.9, uncommon: 19, rare: 3, epic: 0.09, legendary: 0.005, iconic: 0.00025 };
const STREET: Odds = { common: 52, uncommon: 28, rare: 17, epic: 2.84, legendary: 0.15, iconic: 0.01 };
const PRO_ANY: Odds = { common: 36, uncommon: 32, rare: 24, epic: 7.1, legendary: 0.8, iconic: 0.1 };
const PRO_LAST: Odds = { rare: 84.5, epic: 13.7, legendary: 1.5, iconic: 0.3 };
const ICON_A: Odds = { rare: 75.8, epic: 20, legendary: 3.2, iconic: 1.0 };
const ICON_B: Odds = { epic: 95.8, legendary: 3.0, iconic: 1.2 };
const PLAY_BASIC: Odds = { common: 90, rare: 9.4, epic: 0.58, legendary: 0.02, iconic: 0.001 };
const PLAY_STREET: Odds = { common: 66, rare: 28, epic: 5.5, legendary: 0.45, iconic: 0.03 };
const PLAY_PRO: Odds = { common: 48, rare: 38, epic: 11.5, legendary: 2.3, iconic: 0.2 };
const PLAY_PRO_LAST: Odds = { rare: 78, epic: 18.5, legendary: 3.2, iconic: 0.3 };
const PLAY_ICON: Odds = { rare: 62, epic: 30, legendary: 7.4, iconic: 0.6 };
const PLAY_ICON_LAST: Odds = { epic: 82, legendary: 16.8, iconic: 1.2 };
// Sneaker Boxes: Street (mostly Common/Uncommon), Pro (Rare or better likely), Icon (one Legendary+ guaranteed). Epic here means a Custom with a
// weak enhancement; Legendary includes the Bullseye Customs, the only good Customs.
const SNEAKER: Odds = { common: 50, uncommon: 32, rare: 14, epic: 3, legendary: 0.9, iconic: 0.1 };
const SNEAKER_PRO: Odds = { common: 6, uncommon: 24, rare: 48, epic: 16, legendary: 5.5, iconic: 0.5 };
const SNEAKER_ICON_TOP: Odds = { legendary: 92, iconic: 8 };
const SNEAKER_ICON: Odds = { rare: 45, epic: 30, legendary: 23, iconic: 2 };

export const PACKS: PackDef[] = [
  { id: 'basic', name: 'Basic Pack', price: 25, blurb: '2 Ballerz and 3 Play cards, nearly all Common. One is free every day.',
    slots: [{ kind: 'play', odds: PLAY_BASIC }, { kind: 'baller', odds: BASIC }, { kind: 'play', odds: PLAY_BASIC }, { kind: 'play', odds: PLAY_BASIC }, { kind: 'baller', odds: BASIC }] },
  { id: 'street', name: 'Street Pack', price: 100, blurb: '2 Ballerz and 3 Play cards.',
    slots: [{ kind: 'play', odds: PLAY_STREET }, { kind: 'baller', odds: STREET }, { kind: 'play', odds: PLAY_STREET }, { kind: 'play', odds: PLAY_STREET }, { kind: 'baller', odds: STREET }] },
  { id: 'pro', name: 'Pro Pack', price: 250, blurb: '2 Ballerz and 3 Play cards. One Baller and one Play card are Rare or better. Every 10th Pro Pack holds an Epic or better Baller.',
    slots: [{ kind: 'play', odds: PLAY_PRO }, { kind: 'baller', odds: PRO_ANY }, { kind: 'play', odds: PLAY_PRO }, { kind: 'play', odds: PLAY_PRO_LAST }, { kind: 'baller', odds: PRO_LAST }], pity: { every: 10, min: 'epic' } },
  { id: 'icon', name: 'Icon Pack', price: 1000, blurb: '2 Ballerz and 3 Play cards, all Rare or better. The last Baller and the last Play card are Epic or better. Every 30th Icon Pack holds a Legendary or better Baller.',
    slots: [{ kind: 'play', odds: PLAY_ICON }, { kind: 'baller', odds: ICON_A }, { kind: 'play', odds: PLAY_ICON }, { kind: 'play', odds: PLAY_ICON_LAST }, { kind: 'baller', odds: ICON_B }], pity: { every: 30, min: 'legendary' } },
  { id: 'box', name: 'Street Box', price: 50, blurb: '3 Sneakerz, mostly Common and Uncommon.',
    slots: [{ kind: 'sneaker', odds: SNEAKER }, { kind: 'sneaker', odds: SNEAKER }, { kind: 'sneaker', odds: SNEAKER }] },
  { id: 'probox', name: 'Pro Box', price: 150, blurb: '3 Sneakerz, Rare or better most of the time, with a small Legendary chance.',
    slots: [{ kind: 'sneaker', odds: SNEAKER_PRO }, { kind: 'sneaker', odds: SNEAKER_PRO }, { kind: 'sneaker', odds: SNEAKER_PRO }] },
  { id: 'iconbox', name: 'Icon Box', price: 500, blurb: '3 Sneakerz with one Legendary or better guaranteed. Bullseye Customs and Iconic Sneakerz can drop.',
    slots: [{ kind: 'sneaker', odds: SNEAKER_ICON }, { kind: 'sneaker', odds: SNEAKER_ICON }, { kind: 'sneaker', odds: SNEAKER_ICON_TOP }] },
];
export const packDef = (id: string): PackDef => PACKS.find((p) => p.id === id)!;
/** The Baller packs (the Sneaker Boxes are separate). */
export const BALLER_PACKS = PACKS.filter((p) => p.slots.some((s) => s.kind === 'baller'));
/** The Sneaker Boxes. */
export const SNEAKER_PACKS = PACKS.filter((p) => p.slots.every((s) => s.kind === 'sneaker'));
export const isBox = (d: PackDef): boolean => d.slots.every((s) => s.kind === 'sneaker');

/** Chance that a slot rolls each tier, in percent. */
export function oddsPct(odds: Odds): Partial<Record<Tier, number>> {
  const tot = TIERS.reduce((a, t) => a + (odds[t] || 0), 0), out: Partial<Record<Tier, number>> = {};
  for (const t of TIERS) if (odds[t]) out[t] = ((odds[t] as number) / tot) * 100;
  return out;
}
/** Chance per pack of at least one card of tier `min` or better among the Baller slots (or any slots with `kind`). */
export function packChance(def: PackDef, min: Tier, kind: PullKind = 'baller'): number {
  let miss = 1;
  for (const sl of def.slots) {
    if (sl.kind !== kind) continue;
    const p = oddsPct(sl.odds);
    miss *= 1 - TIERS.filter((t) => tierRank(t) >= tierRank(min)).reduce((a, t) => a + (p[t] || 0), 0) / 100;
  }
  return 1 - miss;
}

function rollTier(odds: Odds, min?: Tier): Tier {
  const ts = TIERS.filter((t) => (odds[t] || 0) > 0 && (!min || tierRank(t) >= tierRank(min)));
  const total = ts.reduce((a, t) => a + (odds[t] as number), 0);
  let x = rnd() * total;
  for (const t of ts) { x -= odds[t] as number; if (x < 0) return t; }
  return ts[ts.length - 1] || 'common';
}
let PLAY_POOL: Record<Tier, CCard[]> | null = null;
function playPool(t: Tier): CCard[] {
  if (!PLAY_POOL) {
    PLAY_POOL = { common: [], uncommon: [], rare: [], epic: [], legendary: [], iconic: [] };
    for (const c of allCards()) PLAY_POOL[cardTier(c)].push(c);
  }
  return PLAY_POOL[t];
}
export const playPoolSize = (t: Tier): number => playPool(t).length;
export function pullOne(kind: PullKind, tier: Tier): Pull {
  if (kind === 'baller') {
    const pool = ballersOfTier(tier), id = pool[ri(pool.length)];
    return { kind, key: 'b:' + id, id, tier, holo: tier === 'iconic' && rnd() < HOLO_ICONIC };
  }
  if (kind === 'sneaker') {
    const pool = sneakersOfTier(tier), id = pool[ri(pool.length)];
    return { kind, key: 's:' + id, id, tier, holo: false };
  }
  let t = tier;
  while (!playPool(t).length && tierRank(t) > 0) t = TIERS[tierRank(t) - 1]; // no cards of this tier: the next one down
  const pool = playPool(t), c = pool[ri(pool.length)];
  return { kind, key: 'p:' + c.k, id: c.k, tier: t, holo: false };
}
export interface OpenOpts {
  /** Force the pity guarantee on this pack. */
  pity?: boolean;
  /** Dev: the last Baller is Iconic. */
  forceIconic?: boolean;
}
/** Rolls a pack. Order is kept: the last slot is revealed last, which is where the guarantees sit. */
export function openPack(def: PackDef, o: OpenOpts = {}): Pull[] {
  const pulls = def.slots.map((sl) => pullOne(sl.kind, rollTier(sl.odds)));
  let last = -1;
  def.slots.forEach((sl, i) => { if (sl.kind === 'baller') last = i; });
  if (last >= 0 && o.forceIconic) pulls[last] = pullOne('baller', 'iconic');
  else if (last >= 0 && o.pity && def.pity && !pulls.some((p) => p.kind === 'baller' && tierRank(p.tier) >= tierRank(def.pity!.min))) {
    pulls[last] = pullOne('baller', rollTier(def.slots[last].odds, def.pity.min));
  }
  return pulls;
}
