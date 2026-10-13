// Play cards for the v2 rules: the 74 design cards (same names, art and flavour) rebuilt on Momentum costs, plus the new v2 cards
// (Iso, 4-Point Play, Bad Shot, Heave, Overclock, double team, turnover traps and hard counters).
// Percent values are points of shot chance (+12 means +12%). A card's cost comes from its rarity: Common/Rare 0, Epic 2, Legendary 4, Iconic 6.
import { C, CLASSES, type ClassKey } from '../rules';
import { ZONE_NAME, type Zone } from './skills';
import { TUNING as TN } from './tuning';

export type When = 'off' | 'def' | 'any';
export type CRarity = 'basic' | 'common' | 'epic' | 'legendary' | 'iconic';
export const RARITY_NAME: Record<CRarity, string> = { basic: 'Common', common: 'Rare', epic: 'Epic', legendary: 'Legendary', iconic: 'Iconic' };
export const RARITY_COST: Record<CRarity, number> = { get basic() { return 0; }, get common() { return 0; }, get epic() { return TN.costEpic; }, get legendary() { return TN.costLegendary; }, get iconic() { return TN.costIconic; } };
/** A Heave empties the whole bar. */
export const ALL_IN = 10;

export interface Fx {
  boost?: number;
  lock?: number;
  /** Boost or lock only counts in these zones. */
  only?: Zone[];
  draw?: number;
  /** Momentum gained now. */
  mo?: number;
  fire?: boolean;
  noRead?: boolean;
  halfRead?: boolean;
  /** Their soft Traps can't fire on this shot (hard counters still can). */
  noTraps?: boolean;
  worth?: number;
  /** Chance (percent) the possession ends in a turnover: on a defense card or a Trap. */
  steal?: number;
  /** Chance your own play backfires into a turnover (ref calls). */
  risk?: number;
  scout?: boolean;
  /** Cancels the other side's card this possession. */
  counter?: boolean;
  putback?: number;
  jinx?: number;
  turns?: number;
  next?: number;
  extra?: boolean;
  shadow?: number;
  aura?: number;
  auraLock?: number;
  discount?: boolean;
  /** Face-down: fires on a later possession of the opponent. */
  trap?: boolean;
  revenge?: number;
  /** Trap only fires when the shot came off a pass (not on an Iso). */
  needPass?: boolean;
  /** Shot Clock: turnover chance rises when they spent Momentum on a card. */
  clock?: boolean;
  /** Hard counters: block = the shot goes to 1%, charge = turnover chance, shutdown = at most 5%, sense = cancels one Trap. */
  hard?: 'block' | 'charge' | 'shutdown' | 'sense';
  /** Charge: turnover chance (percent). */
  tov?: number;
  /** Iso: drive to the Rim for ~85%, scheme and double team don't count. */
  iso?: boolean;
  /** Fixed shot chance (Heave). */
  fixed?: number;
  /** Double team a Baller for the card's cost instead of 3 Momentum. */
  dt?: boolean;
  /** If the shot goes in: the other side loses this much Momentum and you gain half of it. */
  swing?: number;
  /** Costs the whole bar. */
  allIn?: boolean;
  /** Pass card: any Baller may take the shot (even one that is cooling), and the best passer's assist bonus counts twice. */
  pass?: boolean;
  cond?: { down?: number; leading?: boolean; hot?: boolean };
}
export interface CCard {
  k: string;
  name: string;
  flavor: string;
  cls?: ClassKey;
  rarity: CRarity;
  /** Momentum cost. */
  cost: number;
  when: When;
  fx: Fx;
  text: string;
  /** True for cards added in v2 (not in the original design set). */
  v2: boolean;
  /** Card level 1..5 (card shards): +2% to the effect per level (Common +1%). Set by `withLevel`. */
  lv?: number;
}

// ---------- power and levels ----------
/** Rare and up are stronger than the original numbers (TUNING powRare...); Basic (shown as Common) keeps them. */
export const powOf = (r: CRarity): number => (r === 'basic' ? 1 : r === 'common' ? TN.powRare : r === 'epic' ? TN.powEpic : r === 'legendary' ? TN.powLegendary : TN.powIconic);
/** Percent of the effect each level above 1 adds. */
export const levelStep = (r: CRarity): number => (r === 'basic' ? TN.lvStepBasic : TN.lvStep);
const r1 = (v: number): number => Math.round(v * 10) / 10;
/** Scales the numbers of an effect. `m` multiplies chances and percent values; `whole` rounds to whole numbers (power) instead of tenths (levels). */
export function scaleFx(fx: Fx, m: number, whole: boolean): Fx {
  if (m === 1) return fx;
  const o: Fx = { ...fx };
  const f = (v: number): number => (whole ? Math.round(v * m) : r1(v * m));
  if (o.boost && o.boost > 0) o.boost = f(o.boost);
  for (const k of ['lock', 'revenge', 'next', 'aura', 'auraLock', 'jinx'] as const) if (o[k]) o[k] = f(o[k]!);
  if (o.steal) o.steal = Math.min(95, f(o.steal));
  if (o.putback) o.putback = Math.min(95, f(o.putback));
  if (whole) { if (o.swing) o.swing = Math.round(o.swing * m); if (o.mo) o.mo = Math.round(o.mo * m); }
  return o;
}
/** A copy of a card at a level (1..5): every number in its effect is `step`% bigger per level above 1. Level 1 returns the card itself. */
export function withLevel(c: CCard, lv: number): CCard {
  const L = Math.max(1, Math.min(5, Math.round(lv)));
  if (L <= 1) return c;
  const fx = scaleFx(c.fx, 1 + (levelStep(c.rarity) / 100) * (L - 1), false);
  return Object.create(c, { fx: { value: fx, enumerable: true }, text: { value: describe(fx, c.when), enumerable: true }, lv: { value: L, enumerable: true } }) as CCard;
}

const R = ['rim'] as Zone[], M = ['mid'] as Zone[], T3 = ['three'] as Zone[];
type Row = [CRarity | null, When, Fx];
// rarity null = keep the design set's rarity
const T: Record<string, Row> = {
  // neutral
  swing_pass: [null, 'off', { boost: 6, pass: true }],
  moving_screen: [null, 'off', { boost: 10, risk: 10 }],
  attack_rim: [null, 'off', { boost: 9, only: R }],
  up_fake: [null, 'off', { boost: 8, only: T3 }],
  clear_out: ['common', 'off', { boost: 6, halfRead: true }],
  help_defense: [null, 'def', { trap: true, lock: 10, only: R }],
  jump_lane: [null, 'def', { trap: true, steal: 18 }],
  switch: [null, 'def', { trap: true, lock: 8, only: T3 }],
  hand_face: [null, 'def', { trap: true, lock: 12, only: T3 }],
  take_charge: ['common', 'def', { trap: true, hard: 'charge', tov: 60, only: R }],
  fun_guy: [null, 'any', { draw: 1, mo: 1 }],
  timeout: ['common', 'any', { draw: 1, mo: 2 }],
  hydrate: [null, 'any', { mo: 1 }],
  film_session: ['epic', 'off', { draw: 2, scout: true }],
  spilled_soda: [null, 'any', { draw: 1 }],
  ball_dont_lie: ['common', 'def', { counter: true }],
  heckler: ['epic', 'def', { jinx: 10, turns: 2 }],
  anything_possible: ['epic', 'off', { boost: 22, cond: { down: 8 } }],
  cancun: ['legendary', 'off', { boost: 18, noRead: true, noTraps: true, cond: { down: 10 } }],
  press: ['epic', 'def', { steal: 25, cond: { down: 6 } }],
  // Splash Factory
  extra_pass: [null, 'off', { boost: 8, only: T3 }],
  around_world: [null, 'off', { boost: 12, only: T3 }],
  corner_three: [null, 'off', { boost: 9, only: T3 }],
  hot_hand: [null, 'any', { draw: 2, cond: { hot: true } }],
  backdoor: [null, 'off', { boost: 11, only: R }],
  relocate: [null, 'off', { noRead: true, only: T3 }],
  shootout: [null, 'def', { trap: true, revenge: 12 }],
  logo_shot: [null, 'off', { worth: 1, only: T3, boost: -8, noRead: true }],
  monsoon: [null, 'any', { aura: 5, only: T3, fire: true }],
  // Showtime
  outlet: [null, 'off', { boost: 6 }],
  lob_it: [null, 'off', { boost: 11, only: R }],
  fast_break: [null, 'off', { boost: 9, only: R, noTraps: true }],
  stocking: [null, 'any', { draw: 1, mo: 1 }],
  no_look: [null, 'off', { boost: 7, noTraps: true }],
  pull_up: [null, 'off', { noRead: true, only: M, boost: 3 }],
  steal_go: [null, 'def', { trap: true, steal: 15, next: 8 }],
  naughty: [null, 'def', { counter: true, draw: 1 }],
  sleigh: [null, 'off', { extra: true, draw: 1 }],
  // Bucket Getters
  up_under: [null, 'off', { boost: 9, only: R }],
  step_back: [null, 'off', { boost: 10, only: T3, noTraps: true }],
  midrange: [null, 'off', { boost: 11, only: M }],
  get_buckets: [null, 'off', { boost: 7, draw: 1 }],
  through_contact: [null, 'off', { halfRead: true, boost: 5 }],
  blow_by: [null, 'off', { boost: 13, only: R }],
  sell_contact: [null, 'def', { trap: true, steal: 20, only: R }],
  jobs: [null, 'off', { boost: 12, next: 12, cond: { leading: true } }],
  three_level: [null, 'off', { fire: true, worth: 1, boost: 8 }],
  // Bully Ball
  post_up: [null, 'off', { boost: 9, only: R }],
  hard_screen: [null, 'off', { boost: 7 }],
  board_man: [null, 'off', { putback: 50 }],
  bang_bodies: [null, 'any', { jinx: 6, turns: 2 }],
  seal: [null, 'off', { noRead: true, only: R }],
  nothing_easy: [null, 'def', { trap: true, lock: 14, only: R }],
  enforcer: [null, 'def', { lock: 8, only: R }],
  finger_wag: [null, 'def', { trap: true, steal: 35, only: R }],
  wear_down: [null, 'any', { aura: 5, only: R, jinx: 8, turns: 3 }],
  // Pick and Roll
  set_tempo: [null, 'off', { boost: 6, mo: 1 }],
  roll_man: [null, 'off', { boost: 11, only: R }],
  two_man: [null, 'off', { boost: 8 }],
  remix: [null, 'any', { draw: 1, mo: 1 }],
  slip: [null, 'off', { noRead: true, only: R, boost: 3 }],
  short_roll: [null, 'off', { boost: 11, only: M }],
  ice_it: [null, 'def', { trap: true, lock: 9 }],
  drop: [null, 'def', { trap: true, lock: 18, only: ['rim', 'mid'], jinx: 8, turns: 1 }],
  groove: [null, 'any', { discount: true, mo: 2 }],
  // 3-and-D
  corner_spec: [null, 'off', { boost: 10, only: T3 }],
  lock_in: [null, 'def', { lock: 6 }],
  glue: [null, 'off', { boost: 6, draw: 1 }],
  ball_hawk: [null, 'def', { trap: true, steal: 18 }],
  attack_co: [null, 'off', { boost: 12, only: T3 }],
  spot_up: [null, 'off', { noRead: true, only: T3, boost: 4 }],
  ear_whisper: [null, 'def', { lock: 9 }],
  lockdown: [null, 'def', { shadow: 2 }],
  two_way: [null, 'any', { aura: 5, only: T3, auraLock: 5 }],
};

interface NewCard { k: string; n: string; f: string; r: CRarity; when: When; fx: Fx }
/** Cards that are new in v2. Names and flavour are original: memes and moments, never real player names. */
const NEW: NewCard[] = [
  { k: 'iso', n: 'Iso', f: 'Clear the floor. Everyone else, enjoy the view.', r: 'legendary', when: 'off', fx: { iso: true, only: R } },
  { k: 'four_point', n: '4-Point Play', f: 'Deep, contested, fouled. The arithmetic is not the point.', r: 'legendary', when: 'off', fx: { worth: 1, only: T3, boost: 5 } },
  { k: 'bad_shot', n: 'Bad Shot', f: 'Thirty-seven feet, two hands in his face, zero doubt. Series over.', r: 'legendary', when: 'off', fx: { noRead: true, noTraps: true, only: T3, boost: -14, swing: 4 } },
  { k: 'heave', n: 'Heave', f: 'The clock says impossible. The ball says hold my drink.', r: 'iconic', when: 'off', fx: { fixed: 99, noRead: true, only: T3, allIn: true } },
  { k: 'overclock', n: 'Overclock', f: 'Run it past the safe limit. Watch the frame rate drop.', r: 'iconic', when: 'off', fx: { boost: 28, noRead: true, noTraps: true, fire: true } },
  { k: 'elbow_jumper', n: 'Elbow Jumper', f: 'The most honest spot on the floor.', r: 'basic', when: 'off', fx: { boost: 9, only: M } },
  { k: 'pick_pocket', n: 'Pick Pocket', f: 'Hands like a magician. Pockets like a bank.', r: 'common', when: 'def', fx: { trap: true, steal: 25 } },
  { k: 'passing_lane', n: 'Passing Lane', f: 'He telegraphed it from the opening tip.', r: 'common', when: 'def', fx: { trap: true, steal: 35, needPass: true } },
  { k: 'shot_clock', n: 'Shot Clock', f: 'Tick. Tick. Tick. Nobody on the floor can hear anything else.', r: 'epic', when: 'def', fx: { trap: true, steal: 25, clock: true } },
  { k: 'block_party', n: 'Block Party', f: 'Everyone is invited. Nobody leaves with the ball.', r: 'epic', when: 'def', fx: { trap: true, hard: 'block', only: ['rim', 'mid'] } },
  { k: 'shutdown', n: 'Shutdown', f: 'Not a good night to be the scoring option.', r: 'legendary', when: 'def', fx: { trap: true, hard: 'shutdown' } },
  { k: 'trap_sense', n: 'Trap Sense', f: 'Something feels off about that screen. Something feels off about every screen.', r: 'common', when: 'off', fx: { hard: 'sense' } },
  { k: 'kick_out', n: 'Kick Out', f: 'Drive, collapse, kick. The corner never saw it coming.', r: 'basic', when: 'off', fx: { pass: true, boost: 8, only: ['three'] } },
  { k: 'hand_off', n: 'Hand-Off', f: 'Two players, one ball, zero words.', r: 'basic', when: 'off', fx: { pass: true, boost: 8, only: ['rim'] } },
  { k: 'skip_pass', n: 'Skip Pass', f: 'Over the top, across the floor, before the defense blinks.', r: 'common', when: 'off', fx: { pass: true, boost: 9, halfRead: true } },
  { k: 'send_help', n: 'Send Help', f: 'Two defenders, one ball handler, zero exits.', r: 'epic', when: 'def', fx: { dt: true } },
];

const zoneList = (z?: Zone[]) => (z ? z.map((x) => ZONE_NAME[x]).join(' or ') : '');
function describe(fx: Fx, when: When): string {
  const on = fx.only ? ` ${zoneList(fx.only)}` : '';
  const p: string[] = [];
  if (fx.cond?.down) p.push(`Only when down ${fx.cond.down}+.`);
  if (fx.cond?.leading) p.push('Only while leading.');
  if (fx.cond?.hot) p.push('Only if your last shot was a made Three.');
  if (fx.trap) {
    const what = fx.revenge ? 'When they score' : `When they shoot${fx.only ? ' at the' + on : ' anything'}${fx.needPass ? ' off a pass' : ''}`;
    let does = '';
    if (fx.hard === 'block') does = 'the shot is swatted: it drops to 1%';
    else if (fx.hard === 'shutdown') does = 'their chance drops to 5%';
    else if (fx.hard === 'charge') does = `${fx.tov}% offensive foul: turnover`;
    else if (fx.clock) does = `${fx.steal}% shot clock violation (${(fx.steal || 0) + 20}% if they paid Momentum for a card)`;
    else if (fx.revenge) does = `your next shot gets +${fx.revenge}%`;
    else if (fx.steal) does = `${fx.steal}% turnover`;
    else does = `−${fx.lock}%`;
    p.push(`Trap. ${what}: ${does}.`);
    if (fx.next) p.push(`If it steals, your next shot gets +${fx.next}%.`);
    if (fx.jinx) p.push(`Their shots get −${fx.jinx}% next possession too.`);
    if (fx.hard) p.push('Hard counter.');
    return p.join(' ');
  }
  if (fx.iso) p.push('Your shooter drives to the Rim for about 85%. The scheme and a double team do not matter. A Block or a Charge trap still stops him.');
  if (fx.fixed) p.push(`Your Three goes in ${fx.fixed}%. It can't be read. Costs the whole bar. Only a hard counter can stop it.`);
  if (fx.boost && fx.boost > 0) p.push(`+${fx.boost}% on your${on} shot.`);
  if (fx.worth) p.push(`Your${on} shot is worth +${fx.worth}.`);
  if (fx.boost && fx.boost < 0) p.push(`It gets ${fx.boost}%.`);
  if (fx.pass) p.push('Hand the ball to any Baller, even one that is cooling. Your best passer assists twice.');
  if (fx.noRead) p.push(`Your${on} shot can't be read.`);
  if (fx.halfRead) p.push('A read only costs you half.');
  if (fx.noTraps) p.push("Their soft Traps can't fire on it.");
  if (fx.swing) p.push(`If it goes in, they lose ${fx.swing} Momentum and you gain ${Math.floor(fx.swing / 2)}.`);
  if (fx.risk) p.push(`${fx.risk}% the ref calls it: turnover.`);
  if (fx.next) p.push(`Your next shot gets +${fx.next}% too.`);
  if (fx.lock) p.push(`−${fx.lock}% on their${on} shot.`);
  if (fx.steal) p.push(`${fx.steal}% chance they turn it over.`);
  if (fx.counter) p.push('Cancel their card this possession.');
  if (fx.dt) p.push('Double team a Baller of your choice for this card alone (no extra Momentum).');
  if (fx.hard === 'sense') p.push('The first Trap that would fire on your shot is cancelled. Hard counter.');
  if (fx.jinx) p.push(`Their shots get −${fx.jinx}% for ${fx.turns} possession${(fx.turns || 1) > 1 ? 's' : ''}.`);
  if (fx.shadow) p.push(`Their next ${fx.shadow} shots are always read.`);
  if (fx.putback) p.push(`If you miss, ${fx.putback}% chance of a putback.`);
  if (fx.extra) p.push('After this possession, you get the ball again.');
  if (fx.aura) p.push(`Rest of the game: +${fx.aura}% on your${on} shots.`);
  if (fx.auraLock) p.push(`Their shots get −${fx.auraLock}% for the rest of the game.`);
  if (fx.discount) p.push('Rest of the game: your cards cost 1 less (min 0).');
  if (fx.fire) p.push('Your shooter catches fire.');
  if (fx.scout) p.push('See their defense before you shoot.');
  if (fx.mo) p.push(`+${fx.mo} Momentum now.`);
  if (fx.draw) p.push(`Draw ${fx.draw === 1 ? 'a card' : fx.draw + ' cards'}.`);
  if (!p.length) p.push(when === 'def' ? 'Defense card.' : 'Offense card.');
  return p.join(' ');
}

let CARDS: Map<string, CCard> | null = null;
function index(): Map<string, CCard> {
  if (!CARDS) {
    CARDS = new Map();
    const put = (k: string, name: string, flavor: string, cls: ClassKey | undefined, rarity: CRarity, when: When, fx: Fx, v2: boolean) => {
      const card = { k, name, flavor, cls, rarity, when, v2 } as CCard;
      // fx and text follow TUNING (card power), so the Lab can change them live
      let sig = NaN, cur: Fx = fx, txt = '';
      const sync = (): void => { const m = powOf(rarity); if (m !== sig) { sig = m; cur = scaleFx(fx, m, true); txt = describe(cur, when); } };
      Object.defineProperty(card, 'fx', { enumerable: true, get: () => { sync(); return cur; } });
      Object.defineProperty(card, 'text', { enumerable: true, get: () => { sync(); return txt; } });
      Object.defineProperty(card, 'cost', { enumerable: true, get: () => (fx.allIn ? TN.moMax : RARITY_COST[rarity]) });
      CARDS!.set(k, card);
    };
    for (const c of C) {
      const t = T[c.k];
      if (!t) continue;
      put(c.k, c.n, c.f, c.cls, t[0] || (c.r === 'token' ? 'basic' : (c.r as CRarity)), t[1], t[2], false);
    }
    for (const n of NEW) put(n.k, n.n, n.f, undefined, n.r, n.when, n.fx, true);
  }
  return CARDS;
}
export const ccard = (k: string): CCard | undefined => index().get(k);
export const allCards = (): CCard[] => [...index().values()];
export const whenLabel = (c: CCard): string => (c.fx.trap ? 'Trap' : c.when === 'off' ? 'Offense' : c.when === 'def' ? 'Defense' : 'Any');
export const classLabel = (c: CCard): string => (c.cls ? CLASSES[c.cls].name : 'Neutral');
export const isTrap = (c: CCard): boolean => !!c.fx.trap;
/** Hard counters: Block Party, Take the Charge, Shutdown and Trap Sense. */
export const isHard = (c: CCard): boolean => !!c.fx.hard;

/** The headline of a card for the compact hand strip: a big number ('+9%') and a short label ('Mid'). */
export function effectTag(c: CCard): { big: string; small: string } {
  const f = c.fx, z = f.only ? zoneList(f.only) : 'Any';
  const n = (v: number): string => String(Math.round(v * 10) / 10);
  if (f.iso) return { big: 'ISO', small: 'Rim drive' };
  if (f.fixed) return { big: `${f.fixed}%`, small: 'Three' };
  if (f.trap) {
    if (f.hard === 'block') return { big: 'BLOCK', small: `Trap ${z}` };
    if (f.hard === 'shutdown') return { big: 'SHUT', small: 'Trap all' };
    if (f.hard === 'charge') return { big: 'CHARGE', small: 'Trap Rim' };
    if (f.revenge) return { big: `+${n(f.revenge)}%`, small: 'Trap, next shot' };
    if (f.steal) return { big: `${n(f.steal)}%`, small: `Trap steal${f.only ? ' ' + z : ''}` };
    return { big: `−${n(f.lock || 0)}%`, small: `Trap ${z}` };
  }
  if (f.dt) return { big: 'DOUBLE', small: 'Team' };
  if (f.boost && f.boost > 0) return { big: `+${n(f.boost)}%`, small: f.pass ? `Pass, ${z}` : z };
  if (f.worth) return { big: `+${f.worth} PT`, small: z };
  if (f.lock) return { big: `−${n(f.lock)}%`, small: `Their ${z === 'Any' ? 'shot' : z}` };
  if (f.steal) return { big: `${n(f.steal)}%`, small: 'Steal' };
  if (f.counter) return { big: 'CANCEL', small: 'Their card' };
  if (f.shadow) return { big: 'READ', small: `Next ${f.shadow} shots` };
  if (f.jinx) return { big: `−${n(f.jinx)}%`, small: 'Their shots' };
  if (f.aura) return { big: `+${n(f.aura)}%`, small: `All game ${z}` };
  if (f.hard === 'sense') return { big: 'SENSE', small: 'Beats a Trap' };
  if (f.extra) return { big: '+1', small: 'Possession' };
  if (f.putback) return { big: `${n(f.putback)}%`, small: 'Putback' };
  if (f.noRead) return { big: 'NO READ', small: z };
  if (f.discount) return { big: '−1', small: 'Card costs' };
  if (f.mo) return { big: `+${f.mo}`, small: 'Momentum' };
  if (f.draw) return { big: `+${f.draw}`, small: f.draw > 1 ? 'Cards' : 'Card' };
  if (f.scout) return { big: 'SCOUT', small: 'See their D' };
  return { big: 'CARD', small: c.when === 'def' ? 'Defense' : 'Offense' };
}
