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
export const HOLO_CHANCE = 0.08;

export const cardTier = (c: CCard): Tier => (c.rarity === 'basic' ? 'common' : c.rarity === 'common' ? 'rare' : c.rarity);

// Odds are weights per slot (they need not add up to 100).
const STREET: Odds = { common: 58, uncommon: 28, rare: 12, epic: 1.9, legendary: 0.1, iconic: 0.0066 };
const PRO_ANY: Odds = { common: 42, uncommon: 34, rare: 20, epic: 3.5, legendary: 0.45, iconic: 0.1 };
const PRO_LAST: Odds = { rare: 85, epic: 13.5, legendary: 1.4, iconic: 0.2 };
const ICON_ANY: Odds = { uncommon: 8, rare: 70, epic: 20.4, legendary: 1.3, iconic: 0.6 };
const ICON_TOP: Odds = { epic: 95.5, legendary: 3.5, iconic: 1.0 };
const PLAY_STREET: Odds = { common: 60, rare: 31, epic: 7.5, legendary: 1.4, iconic: 0.1 };
const PLAY_PRO: Odds = { common: 40, rare: 40, epic: 16, legendary: 3.7, iconic: 0.3 };
const PLAY_ICON: Odds = { rare: 55, epic: 33, legendary: 10.5, iconic: 1.5 };
// Sneaker Boxes: Street (mostly Common/Uncommon), Pro (Rare or better likely), Icon (one Legendary+ guaranteed). Epic here means a Custom with a
// weak enhancement; Legendary includes the Bullseye Customs, the only good Customs.
const SNEAKER: Odds = { common: 50, uncommon: 32, rare: 14, epic: 3, legendary: 0.9, iconic: 0.1 };
const SNEAKER_PRO: Odds = { common: 6, uncommon: 24, rare: 48, epic: 16, legendary: 5.5, iconic: 0.5 };
const SNEAKER_ICON_TOP: Odds = { legendary: 92, iconic: 8 };
const SNEAKER_ICON: Odds = { rare: 45, epic: 30, legendary: 23, iconic: 2 };

export const PACKS: PackDef[] = [
  { id: 'street', name: 'Street Pack', price: 100, blurb: '3 Ballerz and 1 Play card.',
    slots: [{ kind: 'baller', odds: STREET }, { kind: 'baller', odds: STREET }, { kind: 'baller', odds: STREET }, { kind: 'play', odds: PLAY_STREET }] },
  { id: 'pro', name: 'Pro Pack', price: 250, blurb: '3 Ballerz and 1 Play card. The last Baller is Rare or better. Every 10th Pro Pack holds an Epic or better.',
    slots: [{ kind: 'baller', odds: PRO_ANY }, { kind: 'baller', odds: PRO_ANY }, { kind: 'play', odds: PLAY_PRO }, { kind: 'baller', odds: PRO_LAST }], pity: { every: 10, min: 'epic' } },
  { id: 'icon', name: 'Icon Pack', price: 1000, blurb: '3 Ballerz and 1 Play card, all Rare or better. The last Baller is Epic or better. Every 30th Icon Pack holds a Legendary or better.',
    slots: [{ kind: 'baller', odds: ICON_ANY }, { kind: 'play', odds: PLAY_ICON }, { kind: 'baller', odds: ICON_ANY }, { kind: 'baller', odds: ICON_TOP }], pity: { every: 30, min: 'legendary' } },
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
function pullOne(kind: PullKind, tier: Tier): Pull {
  const holo = rnd() < HOLO_CHANCE;
  if (kind === 'baller') {
    const pool = ballersOfTier(tier), id = pool[ri(pool.length)];
    return { kind, key: 'b:' + id, id, tier, holo };
  }
  if (kind === 'sneaker') {
    const pool = sneakersOfTier(tier), id = pool[ri(pool.length)];
    return { kind, key: 's:' + id, id, tier, holo };
  }
  let t = tier;
  while (!playPool(t).length && tierRank(t) > 0) t = TIERS[tierRank(t) - 1]; // no cards of this tier: the next one down
  const pool = playPool(t), c = pool[ri(pool.length)];
  return { kind, key: 'p:' + c.k, id: c.k, tier: t, holo };
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
