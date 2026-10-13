// Gray Pixel rules, v2 (possession v2). Offense taps a shooter and a zone (Rim, Mid or Three), plays at most one card and goes.
// Defense picks a scheme that guesses a zone, plays at most one card, can double team and re-assigns man-to-man matchups.
// Momentum (0..10) pays for big cards, double teams and subs. Fatigue, Sneakerz, Baller skills and Traps all feed one shot chance.
// DOM-free and seeded through rules/rng, so the AI vs AI sim and the tests run it headless.
import { CLASSES, CLS_KEYS, ballerRow, ballerTier, catalog, classOf, makeBaller, ri, rnd, sneakerRow, type ClassKey } from '../rules';
import { TUNING as T } from './tuning';
export { TUNING } from './tuning';
import { allCards, ccard, isHard, isTrap, withLevel, type CCard } from './cards';
import { ENH, POS_NAME, SCHEME_NAME, ZONES, ZONE_NAME, ZONE_PTS, positionOf, shoeOf, skillFor, type Pos, type Shoe, type Skill, type Zone } from './skills';

export type { CCard } from './cards';
export type { Zone, Pos, Skill, Shoe } from './skills';
export { ZONES, ZONE_NAME, ZONE_PTS, SCHEME_NAME } from './skills';
export type Side = 0 | 1;

// ---------- constants ----------
export const HAND_START = 3;
export const HAND_MAX = 5;
export const MAX_TRAPS = 2;
export const DECK_MIN = 15;
export const DECK_MAX = 20;
export const DECK_SIZE = 20;
export const MAX_COPIES = 2;
export const MAX_TRAPS_IN_DECK = 4;
export const MAX_HARD_IN_DECK = 2;
export const SQUAD_SIZE = 5;
export const COURT_SIZE = 3;
export const NO_SNEAKER_J = 60;
/** Fatigue: from the `start`th possession in a row on court, −`step`% per possession up to −`cap`%. A possession here is one of your own turns with the ball. Live values from TUNING. */
export const FATIGUE = { get start() { return T.fatStart; }, get step() { return T.fatStep; }, get cap() { return T.fatCap; }, get rest() { return T.fatRest; } };
export const CLUTCH = { zone: 0.22, perfect: 0.07, hit: 12, perf: 20 };
/** Base shot chance at an 80 rating against an 80 defender, per zone. */
export const BASE: Record<Zone, number> = { get rim() { return T.baseRim; }, get mid() { return T.baseMid; }, get three() { return T.baseThree; } };
export const RATE_SLOPE: Record<Zone, number> = { get rim() { return T.slopeRim; }, get mid() { return T.slopeMid; }, get three() { return T.slopeThree; } };
/** Multiplier on the shot when the scheme guessed its zone. Mid is the safe one. */
export const READ: Record<Zone, number> = { get rim() { return T.readRim; }, get mid() { return T.readMid; }, get three() { return T.readThree; } };
export const ISO_BASE = 79;
export const OPEN_BONUS_PASSER = 5;

// ---------- Ballerz ----------
export interface CBaller {
  id: number;
  name: string;
  team: string;
  cls: string;
  st: { D: number; P: number; S: number; F: number; J: number };
  sneakerId: number | null;
  shoe: Shoe | null;
  tier: string;
  /** Level 1..5 (shards): +1 to every stat per level above 1. */
  level: number;
  pos: Pos;
  skill: Skill;
  /** Ratings the rules use: Rim (dunk), Mid (shooting + playmaking), Three (shooting), Playmaking and Defense. */
  rim: number;
  mid: number;
  three: number;
  ply: number;
  def: number;
  /** In-game state. */
  run: number;
  cd: number;
  /** Own attacks left before he may shoot again (rotation). 0 = available. */
  hold: number;
  streak: number;
}
export const rating = (b: CBaller, z: Zone): number => (z === 'rim' ? b.rim : z === 'mid' ? b.mid : b.three);
export function cBaller(id: number, sneakerId: number | null = null, level = 1): CBaller {
  const row = ballerRow(id)!;
  const sr = sneakerId != null ? sneakerRow(sneakerId) || null : null;
  const b = makeBaller(row, sr || [0, NO_SNEAKER_J, 0, 0, 0, 0]);
  const lv = Math.max(1, Math.min(5, Math.round(level))), up = lv - 1;
  const st = { D: b.st.D + up, P: b.st.P + up, S: b.st.S + up, F: b.st.F + up, J: sr ? sr[1] : NO_SNEAKER_J };
  const pos = positionOf(st), tier = ballerTier(id);
  return {
    id, name: b.name, team: b.team, cls: classOf(st), st, sneakerId: sr ? sr[0] : null, shoe: shoeOf(sr), tier, level: lv, pos, skill: skillFor(id, pos, tier),
    rim: st.D, mid: Math.round(st.S * 0.6 + st.P * 0.4), three: st.S, ply: st.P, def: st.F, run: 0, cd: 0, hold: 0, streak: 0,
  };
}
const shoeScore = (id: number): number => { const s = shoeOf(sneakerRow(id)); return s ? s.bonus + s.jumpRim * 0.5 : 0; };
export const ballerScore = (b: CBaller): number => Math.max(b.rim, b.mid, b.three) * 0.6 + b.def * 0.25 + b.ply * 0.15;
/** Gives each Baller a Sneaker. `shoes` is a map Baller id to Sneaker id, or a list of owned Sneakerz that are handed out best-first to the best Ballerz. */
export function equip(ids: number[], shoes: number[] | Record<number, number | null> = {}, levels: Record<string, number> = {}): CBaller[] {
  if (Array.isArray(shoes)) {
    const sn = shoes.filter((id) => sneakerRow(id)).sort((a, b) => shoeScore(b) - shoeScore(a));
    const order = ids.slice().sort((a, b) => ballerScore(cBaller(b, null, levels[b])) - ballerScore(cBaller(a, null, levels[a])));
    const pick = new Map<number, number | null>(order.map((id, i) => [id, sn[i] ?? null]));
    return ids.map((id) => cBaller(id, pick.get(id) ?? null, levels[id]));
  }
  return ids.map((id) => cBaller(id, shoes[id] ?? null, levels[id]));
}

// ---------- coaches ----------
export const COACH_PERK: Record<ClassKey, string> = {
  splash: '+10% on Three shots.',
  three: 'Your scheme hurts more when it guesses right: reads cost them 12% more.',
  show: 'Start with an extra card. +4% at the Rim. Assisted baskets give +1 Momentum.',
  pnr: '+2% on every shot. Pass cards give +4% more.',
  bully: '+4% at the Rim.',
  bucket: '+8% on Mid shots. Start with 3 more Momentum.',
};
export const CLUTCH_NAME: Record<ClassKey, string> = Object.fromEntries(CLS_KEYS.map((k) => [k, CLASSES[k].moment.split(/[:(]/)[0].trim()])) as Record<ClassKey, string>;

// ---------- sides and games ----------
export interface CSide {
  coach: ClassKey;
  /** The three Ballerz on court and the bench behind them. */
  team: CBaller[];
  bench: CBaller[];
  deck: CCard[];
  discard: CCard[];
  hand: CCard[];
  traps: CCard[];
  score: number;
  /** Momentum, 0..10. */
  mo: number;
  /** match[i] = the slot of my Baller who guards the opponent's slot i. */
  match: number[];
  /** Who took the last shots in a row, and how many: the defense keys on a Baller who keeps shooting. */
  run: { idx: number; n: number };
  cold: { v: number; turns: number };
  shadow: { idx: number; turns: number };
  aura: Record<Zone, number> & { lock: number };
  discount: boolean;
  nextBoost: number;
  lastMadeThree: boolean;
  clutches: number;
  /** Flat bonus on every shot (story bosses). */
  edge: number;
  stats: { subs: number; dts: number; trapsFired: number; hard: number; isos: number; cards: number; momentumSpent: number; made: Record<Zone, number>; shots: Record<Zone, number> };
}
export interface DoubleTeam {
  /** Offense slot that cannot shoot. */
  mark: number;
  /** Offense slot left open because his defender came to help. */
  open: number;
}
export interface Poss {
  off: Side;
  shooter: number;
  zone: Zone | null;
  /** The scheme the defense picked: it guesses this zone. */
  guard: Zone | null;
  offCard: CCard | null;
  defCard: CCard | null;
  /** Traps played this possession; they wait for the next one. */
  newTraps: CCard[];
  used: [boolean, boolean];
  clutch: boolean;
  extra: boolean;
  dt: DoubleTeam | null;
  dtPaid: number;
}
export interface TrapNote { name: string; text: string }
export interface Outcome {
  side: Side;
  shooter: number;
  /** Card id of the shooter. */
  shooterId: number;
  passer: number | null;
  zone: Zone;
  guard: Zone | null;
  read: boolean;
  p: number;
  made: boolean;
  pts: number;
  turnover: string | null;
  traps: TrapNote[];
  countered: string | null;
  putback: boolean;
  fireOn: boolean;
  fireOff: boolean;
  clutch: boolean;
  clutchBonus: number;
  extra: boolean;
  revenge: string[];
  iso: boolean;
  blocked: boolean;
  dt: DoubleTeam | null;
  /** The defender that was on the shooter. */
  defender: number;
  offCard: string | null;
  defCard: string | null;
  /** A made Rim shot with the foul: +1 point and +1 Momentum for the shooter. */
  andOne: boolean;
  /** The and-one chance (percent) that was rolled for a made Rim shot, 0 when none applied. */
  a1p: number;
  /** Low-probability label for a made shot: GLITCHED under 15%, OVERCLOCKED under 5%, SYSTEM ERROR under 2%. */
  label: string | null;
  /** A made shot at 1% or less: the special animation is for these. */
  inhuman: boolean;
  /** Plain-English explanation lines (traps, cards, double team, fatigue). */
  notes: string[];
  parts: [string, number][];
}
export interface HistLine { n: number; side: Side; text: string; outcome: Outcome }
/** One line of the play-by-play: what happened, with the detail (cards, Traps, double team) that can be shown on hover. */
export interface FeedLine { n: number; side: Side; text: string; detail: string[]; kind: 'shot' | 'sub' | 'info' }
export interface CGame {
  sides: [CSide, CSide];
  n: number;
  poss: Poss;
  over: boolean;
  winner: Side | null;
  last: Outcome | null;
  log: string[];
  hist: HistLine[];
  feed: FeedLine[];
}
export const lowLabel = (p: number): string | null => (p < 2 ? 'SYSTEM ERROR' : p < 5 ? 'OVERCLOCKED' : p < 15 ? 'GLITCHED' : null);

// ---------- decks ----------
function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** Problems with a deck, empty when it is valid: 15 to 20 cards, at most 2 copies (1 Iconic), 4 Traps, 2 hard counters. */
export function validateDeck(deck: CCard[]): string[] {
  const bad: string[] = [];
  if (deck.length < DECK_MIN || deck.length > DECK_MAX) bad.push(`A deck has ${DECK_MIN} to ${DECK_MAX} cards (this one has ${deck.length}).`);
  const cnt = new Map<string, number>();
  for (const c of deck) cnt.set(c.k, (cnt.get(c.k) || 0) + 1);
  for (const [k, n] of cnt) { const c = ccard(k)!; const max = c.rarity === 'iconic' ? 1 : MAX_COPIES; if (n > max) bad.push(`${c.name}: at most ${max} ${max === 1 ? 'copy' : 'copies'}.`); }
  if (deck.filter(isTrap).length > MAX_TRAPS_IN_DECK) bad.push(`At most ${MAX_TRAPS_IN_DECK} Traps.`);
  if (deck.filter(isHard).length > MAX_HARD_IN_DECK) bad.push(`At most ${MAX_HARD_IN_DECK} hard counters.`);
  return bad;
}
/** Can this card be added to the deck without breaking a rule? */
export function canAdd(deck: CCard[], c: CCard): boolean {
  if (deck.length >= DECK_MAX) return false;
  if (deck.filter((d) => d.k === c.k).length >= (c.rarity === 'iconic' ? 1 : MAX_COPIES)) return false;
  if (isTrap(c) && deck.filter(isTrap).length >= MAX_TRAPS_IN_DECK) return false;
  if (isHard(c) && deck.filter(isHard).length >= MAX_HARD_IN_DECK) return false;
  return true;
}
const STARTER = ['swing_pass', 'kick_out', 'hand_off', 'hydrate', 'up_fake', 'help_defense', 'switch', 'lock_in', 'midrange', 'outlet', 'elbow_jumper', 'spilled_soda', 'hard_screen', 'attack_rim', 'ear_whisper', 'two_man', 'jump_lane', 'fun_guy'];
/** A 20-card deck: owned cards (your class and neutral) first, topped up with starter basics. Follows the deck rules. */
export function buildDeck(owned: Record<string, number>, coach: ClassKey): CCard[] {
  const rank: Record<string, number> = { iconic: 5, legendary: 4, epic: 3, common: 2, basic: 1 };
  const deck: CCard[] = [];
  const mine = Object.entries(owned).map(([k, n]) => [ccard(k), n] as const).filter(([c]) => c && (!c.cls || c.cls === coach)).sort((a, b) => rank[b[0]!.rarity] - rank[a[0]!.rarity]);
  for (const [c, n] of mine) for (let i = 0; i < n; i++) if (canAdd(deck, c!)) deck.push(c!);
  const fill = STARTER.map((k) => ccard(k)!).concat(allCards().filter((c) => c.rarity === 'basic' && c.cls === coach));
  for (let r = 0; r < 3 && deck.length < DECK_SIZE; r++) for (const c of fill) if (deck.length < DECK_SIZE && canAdd(deck, c)) deck.push(c);
  return deck;
}
/** CPU deck for a difficulty from 0 to 1: rarer cards as it climbs. Follows the deck rules. */
export function cpuDeck(coach: ClassKey, level: number): CCard[] {
  const pool = allCards().filter((c) => !c.cls || c.cls === coach);
  const want = (c: CCard) => (c.rarity === 'basic' ? 1 : c.rarity === 'common' ? 0.35 + level * 0.6 : c.rarity === 'epic' ? level * level * 0.9 : c.rarity === 'legendary' ? level * level * level * 0.6 : level ** 4 * 0.35);
  const deck: CCard[] = [];
  for (let i = 0; deck.length < DECK_SIZE && i < 4000; i++) {
    const c = pool[ri(pool.length)];
    if (canAdd(deck, c) && rnd() < want(c)) deck.push(c);
  }
  for (const k of STARTER) { const c = ccard(k)!; if (deck.length < DECK_SIZE && canAdd(deck, c)) deck.push(c); }
  return deck;
}

// ---------- setup ----------
function draw(S: CSide, n: number): void {
  for (let i = 0; i < n && S.hand.length < HAND_MAX; i++) {
    if (!S.deck.length) { if (!S.discard.length) return; S.deck = shuffle(S.discard); S.discard = []; }
    S.hand.push(S.deck.shift()!);
  }
}
/** Default man-to-man: the same position guards the same position, the rest are paired in order. match[offSlot] = defender slot. */
export function autoMatch(def: CBaller[], off: CBaller[]): number[] {
  const used = new Set<number>(), m = off.map(() => -1);
  off.forEach((o, i) => { const j = def.findIndex((d, k) => !used.has(k) && d.pos === o.pos); if (j >= 0) { m[i] = j; used.add(j); } });
  off.forEach((_o, i) => { if (m[i] < 0) { const j = def.findIndex((_d, k) => !used.has(k)); m[i] = j; used.add(j); } });
  return m;
}
const rematch = (G: CGame): void => { G.sides[0].match = autoMatch(G.sides[0].team, G.sides[1].team); G.sides[1].match = autoMatch(G.sides[1].team, G.sides[0].team); };
/** `squad` is up to five Ballerz: the first three start, the rest wait on the bench. The Ballerz are copied, so a squad can be reused. */
export function newSide(coach: ClassKey, squad: CBaller[], deck: CCard[], cardLv: Record<string, number> = {}): CSide {
  const all = squad.map((b) => ({ ...b, run: 0, cd: 0, hold: 0, streak: 0 }));
  const z = { rim: 0, mid: 0, three: 0 };
  const S: CSide = {
    coach, team: all.slice(0, COURT_SIZE), bench: all.slice(COURT_SIZE), deck: shuffle(deck.map((c) => withLevel(c, cardLv[c.k] || 1))), discard: [], hand: [], traps: [], score: 0,
    mo: T.moStart + (coach === 'bucket' ? 3 : 0), match: [0, 1, 2], run: { idx: -1, n: 0 }, cold: { v: 0, turns: 0 }, shadow: { idx: -1, turns: 0 },
    aura: { rim: 0, mid: 0, three: 0, lock: 0 }, discount: false, nextBoost: 0, lastMadeThree: false, clutches: 0, edge: 0,
    stats: { subs: 0, dts: 0, trapsFired: 0, hard: 0, isos: 0, cards: 0, momentumSpent: 0, made: { ...z }, shots: { ...z } },
  };
  draw(S, coach === 'show' ? HAND_START + 1 : HAND_START);
  return S;
}
const blankPoss = (off: Side): Poss => ({ off, shooter: 0, zone: null, guard: null, offCard: null, defCard: null, newTraps: [], used: [false, false], clutch: false, extra: false, dt: null, dtPaid: 0 });
export function newGame(a: CSide, b: CSide, first: Side = rnd() < 0.5 ? 0 : 1): CGame {
  const G: CGame = { sides: [a, b], n: 0, poss: blankPoss(first), over: false, winner: null, last: null, log: [], hist: [], feed: [] };
  rematch(G);
  startPossession(G, first);
  return G;
}
const top = (b: CBaller): number => Math.max(b.rim, b.mid, b.three);
const bestShooter = (S: CSide, slots?: number[]): number => (slots && slots.length ? slots : S.team.map((_b, i) => i)).reduce((bi, i) => (top(S.team[i]) > top(S.team[bi]) ? i : bi));
/** Rotation: may he take a shot now? (He sits out two of his team's attacks after each shot.) */
export const canShoot = (b: CBaller): boolean => b.hold <= 0;
/**
 * Who may shoot for side `s` now. Cooling Ballerz are out, unless a pass card (or Heave) is in play. A double team takes the marked Baller out
 * and forces the ball to the open man, who then shoots even if he was cooling. `card` undefined = the card in play, null = no card.
 */
export function shooterSlots(G: CGame, s: Side, card?: CCard | null): number[] {
  const S = G.sides[s], P = G.poss, c = card === undefined ? P.offCard : card;
  const dt = P.off === s && P.dt && !c?.fx.iso ? P.dt : null;
  let ok = S.team.map((_b, i) => i).filter((i) => canShoot(S.team[i]));
  if (c && (c.fx.pass || c.fx.allIn)) ok = S.team.map((_b, i) => i);
  else if (!ok.length) { const m = Math.min(...S.team.map((b) => b.hold)); ok = S.team.map((_b, i) => i).filter((i) => S.team[i].hold === m); }
  if (dt) {
    const markOk = ok.includes(dt.mark);
    ok = ok.filter((i) => i !== dt.mark);
    if ((markOk || !ok.length) && dt.open >= 0 && !ok.includes(dt.open)) ok.push(dt.open);
    if (!ok.length) ok = S.team.map((_b, i) => i).filter((i) => i !== dt.mark);
  }
  return ok;
}
function startPossession(G: CGame, off: Side): void {
  G.n++;
  G.poss = blankPoss(off);
  for (const T of G.sides) for (const b of T.team.concat(T.bench)) if (b.cd > 0) b.cd--;
  const S = G.sides[off];
  // Momentum: +1 for the team with the ball (and +1 for its baskets, +1 for the other team's stops)
  S.mo = Math.min(T.moMax, S.mo + T.moBall);
  // fatigue ticks on the team's own turns with the ball: the court gets tired, the bench recovers
  S.team.forEach((b) => b.run++);
  for (const b of S.team.concat(S.bench)) if (b.hold > 0) b.hold--;
  S.bench.forEach((b) => { b.run = Math.max(0, b.run - FATIGUE.rest); });
  if (G.n > 1) { draw(G.sides[0], 1); draw(G.sides[1], 1); }
  G.poss.shooter = bestShooter(S, shooterSlots(G, off, null));
}
export function fatigueOf(b: CBaller): number {
  const over = Math.max(0, b.run - (FATIGUE.start - 1));
  const mult = (b.skill.fx.fatigue ?? 1) * (b.shoe?.enh === ENH.dime ? 0.5 : 1);
  return Math.round(Math.min(FATIGUE.cap, over * FATIGUE.step) * mult * 10) / 10;
}

// ---------- subs ----------
/** Why a sub cannot happen right now, or null. `ci` is the court slot, `bi` the bench slot. */
export function subBlock(G: CGame, s: Side, ci: number, bi: number): string | null {
  const S = G.sides[s], a = S.team[ci], b = S.bench[bi];
  if (!a || !b) return 'No Baller there.';
  if (G.over) return 'Not now.';
  if (S.mo < T.subCost) return `A sub costs ${T.subCost} Momentum.`;
  if (a.cd > 0) return `${a.name} just subbed: ${a.cd} more possession${a.cd > 1 ? 's' : ''}.`;
  if (b.cd > 0) return `${b.name} just subbed: ${b.cd} more possession${b.cd > 1 ? 's' : ''}.`;
  return null;
}
export function doSub(G: CGame, s: Side, ci: number, bi: number): boolean {
  if (subBlock(G, s, ci, bi)) return false;
  const S = G.sides[s], P = G.poss;
  const a = S.team[ci], b = S.bench[bi];
  S.mo -= T.subCost;
  S.stats.momentumSpent += T.subCost;
  S.stats.subs++;
  G.feed.push({ n: G.n, side: s, kind: 'sub', text: `${s === 0 ? 'You' : 'CPU'} sub: ${b.name} in for ${a.name}`, detail: [`${b.name} (${POS_NAME[b.pos]}) replaces ${a.name}.`, `${T.subCost} Momentum spent. Neither can be swapped for ${T.subCooldown} possessions.`] });
  S.team[ci] = b;
  S.bench[bi] = a;
  a.cd = b.cd = T.subCooldown;
  if (S.run.idx === ci) S.run = { idx: -1, n: 0 };
  rematch(G);
  // a double team stays on the slot; the man it leaves open is worked out again for the new lineup
  if (P.dt) P.dt = { mark: P.dt.mark, open: openMan(G, P.off, P.dt.mark) };
  return true;
}

// ---------- cards ----------
export const costOf = (G: CGame, s: Side, c: CCard): number => (c.fx.allIn ? T.moMax : Math.max(0, c.cost - (G.sides[s].discount ? 1 : 0)));
export function condOk(G: CGame, s: Side, c: CCard): boolean {
  const S = G.sides[s], O = G.sides[(1 - s) as Side], k = c.fx.cond;
  if (!k) return true;
  if (k.down && O.score - S.score < k.down) return false;
  if (k.leading && S.score <= O.score) return false;
  if (k.hot && !S.lastMadeThree) return false;
  return true;
}
/** Why a card cannot be played right now, or null. */
export function playBlock(G: CGame, s: Side, c: CCard): string | null {
  const P = G.poss, onOff = P.off === s, S = G.sides[s];
  if (P.used[s]) return 'One card per possession.';
  if (!c.fx.trap) {
    if (c.when === 'off' && !onOff) return 'Offense card.';
    if (c.when === 'def' && onOff) return 'Defense card.';
  }
  if (c.fx.trap && S.traps.length >= MAX_TRAPS) return `You can only hold ${MAX_TRAPS} Traps.`;
  if (c.fx.hard === 'sense' && !onOff) return 'Offense card.';
  if (!condOk(G, s, c)) return 'Condition not met.';
  if (costOf(G, s, c) > S.mo) return `Needs ${costOf(G, s, c)} Momentum.`;
  if (c.fx.dt && !(G.sides[(1 - s) as Side].team.length)) return 'No target.';
  return null;
}
export const canPlay = (G: CGame, s: Side, c: CCard): boolean => !playBlock(G, s, c);
/** Plays a card from hand into this possession. `target` is the offense slot to double team for a double team card. */
export function playCard(G: CGame, s: Side, i: number, target = 0): boolean {
  const S = G.sides[s], P = G.poss, c = S.hand[i];
  if (!c || !canPlay(G, s, c)) return false;
  const cost = costOf(G, s, c);
  S.mo -= cost;
  S.stats.momentumSpent += cost;
  S.stats.cards++;
  S.hand.splice(i, 1);
  P.used[s] = true;
  if (c.fx.trap) { P.newTraps.push(c); S.traps.push(c); return true; }
  if (s === P.off) {
    P.offCard = c;
    if (c.fx.iso) { P.zone = 'rim'; S.stats.isos++; }
    else if (c.fx.fixed || c.fx.swing) P.zone = 'three';
  } else P.defCard = c;
  if (c.fx.dt) { setDT(G, s, target, true); }
  if (c.fx.mo) S.mo = Math.min(T.moMax, S.mo + c.fx.mo);
  if (c.fx.draw) draw(S, c.fx.draw);
  if (c.fx.aura) for (const z of c.fx.only || ZONES) S.aura[z] += c.fx.aura;
  if (c.fx.auraLock) S.aura.lock += c.fx.auraLock;
  if (c.fx.discount) S.discount = true;
  return true;
}
export const scouted = (G: CGame, s: Side): boolean => G.poss.off === s && G.poss.offCard?.fx.scout === true;

// ---------- double team ----------
/** The offense slot left open when the defense double teams `mark`: the weakest scorer among the others. */
export function openMan(G: CGame, off: Side, mark: number): number {
  const T = G.sides[off].team;
  let best = -1, bv = 1e9;
  T.forEach((b, i) => { if (i === mark) return; const v = Math.max(b.rim, b.mid, b.three); if (v < bv) { bv = v; best = i; } });
  return best;
}
/** Double teams (or lifts it, with null) for T.dtCost Momentum; a double team card sets it for free. */
export function setDT(G: CGame, s: Side, mark: number | null, free = false): boolean {
  const P = G.poss;
  if (s === P.off) return false;
  const S = G.sides[s];
  if (P.dt) { S.mo += P.dtPaid; P.dtPaid = 0; P.dt = null; }
  if (mark == null) return true;
  if (!free && S.mo < T.dtCost) return false;
  P.dt = { mark, open: openMan(G, P.off, mark) };
  if (!free) { S.mo -= T.dtCost; P.dtPaid = T.dtCost; S.stats.momentumSpent += T.dtCost; }
  if (P.shooter === mark && P.dt.open >= 0) P.shooter = P.dt.open;
  else if (!shooterSlots(G, P.off).includes(P.shooter)) P.shooter = bestShooter(G.sides[P.off], shooterSlots(G, P.off));
  return true;
}
// ---------- shot chance ----------
export interface Chance {
  p: number;
  read: boolean;
  base: number;
  parts: [string, number][];
  factor: number;
  passer: number | null;
  open: boolean;
}
export interface ShotCtx {
  guard: Zone | null;
  card: CCard | null;
  dcard: CCard | null;
  extra: [string, number][];
  dt: DoubleTeam | null;
}
export const shotCtx = (G: CGame): ShotCtx => ({ guard: G.poss.guard, card: G.poss.offCard, dcard: G.poss.defCard, extra: [], dt: G.poss.dt });
/** The teammate who passes: the highest Playmaking among the others. Nobody passes on an Iso or a Heave. */
export function passerOf(S: CSide, shooter: number): number | null {
  let best: number | null = null;
  S.team.forEach((b, i) => { if (i !== shooter && (best == null || b.ply > S.team[best].ply)) best = i; });
  return best;
}
export const assistBonus = (b: CBaller): number => Math.max(0, Math.min(T.assistMax, Math.floor((b.ply - 70) / T.assistPly))) + (b.skill.fx.passer || 0);
export const defenderOf = (G: CGame, off: Side, shooter: number): CBaller => { const D = G.sides[(1 - off) as Side]; return D.team[D.match[shooter]]; };
/**
 * Shot chance in percent points (3..95) with a breakdown. `guard` null = no read. Traps are hidden, so they are not counted here.
 * The defender is the shooter's direct man-to-man match; a double team leaves one man open and nobody guards him.
 */
export function chance(G: CGame, s: Side, shooter: number, zone: Zone, c: ShotCtx): Chance {
  const S = G.sides[s], O = G.sides[(1 - s) as Side], b = S.team[shooter];
  const card = c.card, dcard = c.dcard;
  const iso = !!card?.fx.iso, fixed = card?.fx.fixed;
  const open = !!c.dt && c.dt.open === shooter && !iso;
  const dfn = O.team[O.match[shooter]];
  const defDef = open ? 76 : dfn.def;
  const r = rating(b, zone);
  const base = iso ? ISO_BASE + (r - 80) * 0.5 - (defDef - 80) * 0.4 : BASE[zone] + (r - 80) * RATE_SLOPE[zone] - (defDef - 80) * T.defSlope;
  const parts: [string, number][] = [];
  const add = (name: string, v: number) => { if (v) parts.push([name, Math.round(v * 10) / 10]); };
  const fits = (x: CCard) => !x.fx.only || x.fx.only.includes(zone);
  const fx = b.skill.fx;
  if (b.shoe) { add('Sneaker', b.shoe.bonus); if (zone === 'rim' || iso) add('Jump', b.shoe.jumpRim); }
  add(`Skill: ${b.skill.name}`, (fx.zone?.[zone] || 0) + (fx.all || 0));
  if (!open) { const dfx = dfn.skill.fx; add(`${dfn.name}: ${dfn.skill.name}`, -((dfx.stop?.[zone] || 0) + (dfx.stopAll || 0))); }
  add('Tired', -fatigueOf(b));
  if (!open) add(`${dfn.name} is tired`, fatigueOf(dfn) * 0.5);
  const passer = iso || fixed ? null : passerOf(S, shooter);
  if (passer != null) add(`Assist: ${S.team[passer].name}`, assistBonus(S.team[passer]));
  if (card?.fx.pass && passer != null) add(`${card.name}: pass`, assistBonus(S.team[passer]));
  if (open && passer != null) add('Open man', T.openBonus + (S.team[passer].ply >= 85 ? OPEN_BONUS_PASSER : 0) + (S.team[passer].skill.fx.dtPass || 0));
  if (card && fits(card)) add('Card', card.fx.boost || 0);
  if (dcard && fits(dcard)) add('Their card', -(dcard.fx.lock || 0));
  add('Saved boost', S.nextBoost);
  add('Aura', S.aura[zone] - O.aura.lock);
  add('Jinxed', -S.cold.v * (S.cold.turns > 0 ? 1 : 0));
  if (b.streak >= 2) add('On Fire', T.fireBonus + (fx.fire || 0));
  if (!iso && !fixed && S.run.idx === shooter) add('Defense keyed on him', -4 * Math.min(3, S.run.n));
  if (S.coach === 'splash' && zone === 'three') add('Coach', 10);
  if (S.coach === 'bully' && (zone === 'rim' || iso)) add('Coach', 4);
  if (S.coach === 'show' && zone === 'rim') add('Coach', 4);
  if (S.coach === 'bucket' && zone === 'mid') add('Coach', 8);
  if (S.coach === 'pnr') add('Coach', card?.fx.pass ? 6 : 2);
  if (S.edge) add('Home court', S.edge);
  c.extra.forEach(([n, v]) => add(n, v));
  let p = base + parts.reduce((a, x) => a + x[1], 0);
  const forcedRead = S.shadow.turns > 0;
  const noRead = iso || !!fixed || (!!card?.fx.noRead && fits(card)) || !!fx.ignore?.includes(zone);
  const read = !noRead && (forcedRead || (c.guard != null && c.guard === zone));
  let factor = 1;
  if (read) {
    let pen = 1 - READ[zone];
    if (O.coach === 'three') pen *= 1.12;
    const e = b.shoe?.enh;
    if ((zone === 'rim' && e === ENH.lane) || (zone === 'mid' && e === ENH.ankle) || (zone === 'three' && e === ENH.bullseye)) pen *= 0.5;
    if (card?.fx.halfRead) pen *= 0.5;
    if (fx.halfRead?.includes(zone)) pen *= 0.5;
    factor = 1 - pen;
    p *= factor;
  }
  if (fixed) p = fixed;
  return { p: Math.max(3, Math.min(fixed ? 99 : T.maxP, Math.round(p))), read, base: Math.round(base), parts, factor, passer, open };
}
/** Chance for the shot being set up right now (cards, scheme and double team as they stand). */
export const chanceNow = (G: CGame, shooter: number, zone: Zone, guard: Zone | null | undefined = undefined): Chance => {
  const c = shotCtx(G);
  if (guard !== undefined) c.guard = guard;
  return chance(G, G.poss.off, shooter, zone, c);
};

// ---------- and-one ----------
/**
 * Chance (percent) of a foul on a made Rim shot: a base, plus up to a1Dnk for dunkers and Bigs, minus up to a1Def for a strong defender,
 * plus a1Beat when the defense guessed the wrong zone (the shooter beat him).
 */
export function andOneChance(b: CBaller, defDef: number, beat: boolean): number {
  const dnk = Math.max(0, Math.min(1, (b.rim - 60) / 40)), big = b.pos === 'B' ? 1 : 0;
  const bonus = T.a1Dnk * Math.min(1, dnk * 0.7 + big * 0.3);
  const cut = T.a1Def * Math.max(0, Math.min(1, (defDef - 60) / 40));
  return Math.max(0, Math.min(T.a1Cap, Math.round((T.a1Base + bonus - cut + (beat ? T.a1Beat : 0)) * 10) / 10));
}

// ---------- resolution ----------
const zoneWord = (z: Zone) => ZONE_NAME[z];
/** Resolves the possession: turnovers, Traps, the shot, putbacks, scoring, Fire and Momentum. */
export function resolve(G: CGame, clutchBonus = 0): Outcome {
  const P = G.poss, s = P.off, d = (1 - s) as Side, S = G.sides[s], O = G.sides[d];
  let shooter = P.shooter, zone: Zone = P.zone || 'mid';
  let card = P.offCard;
  const dcard = P.defCard;
  const notes: string[] = [];
  let countered: string | null = null;
  if (dcard?.fx.counter && card) {
    countered = card.name;
    notes.push(`${dcard.name} cancels ${card.name}. The Momentum is gone.`);
    card = null;
  }
  const iso = !!card?.fx.iso;
  if (!iso && P.dt && P.dt.mark === shooter) {
    const alt = P.dt.open >= 0 ? P.dt.open : (shooter + 1) % S.team.length;
    notes.push(`${S.team[shooter].name} is double teamed and can't shoot: ${S.team[alt].name} takes it.`);
    shooter = alt;
  }
  if (!shooterSlots(G, s, card).includes(shooter) && !(iso && S.team[shooter])) shooter = bestShooter(S, shooterSlots(G, s, card));
  if (iso) zone = 'rim';
  if (card?.fx.fixed) zone = 'three';
  const b = S.team[shooter];
  const defIdx = O.match[shooter];
  const out: Outcome = {
    side: s, shooter, shooterId: b.id, passer: null, zone, guard: P.guard, read: false, p: 0, made: false, pts: 0, turnover: null, traps: [], countered, putback: false, fireOn: false, fireOff: false,
    clutch: false, clutchBonus: 0, extra: false, revenge: [], iso, blocked: false, dt: iso ? null : P.dt, defender: defIdx, offCard: card ? card.name : countered, defCard: dcard ? dcard.name : null,
    andOne: false, a1p: 0, label: null, inhuman: false, notes, parts: [],
  };
  if (P.dt && !iso) {
    O.stats.dts++;
    const mk = S.team[P.dt.mark], op = P.dt.open >= 0 ? S.team[P.dt.open] : null;
    notes.push(`Double team on ${mk.name}${op ? `: ${op.name}'s man left him, so ${op.name} is open` : ''}.`);
  } else if (P.dt && iso) notes.push('The double team is ignored: Iso.');
  if (card?.fx.fire) b.streak = Math.max(2, b.streak);
  const clutch = P.clutch && S.mo >= T.moMax && !card?.fx.fixed;
  if (clutch) { out.clutch = true; out.clutchBonus = clutchBonus; S.mo = 0; S.clutches++; notes.push(`Clutch: the full bar goes in. Timing bonus +${clutchBonus}%.`); }

  // turnovers from cards
  if (card?.fx.risk && rnd() * 100 < card.fx.risk) { out.turnover = `${card.name}: the ref called it`; notes.push(`${card.name}: the ref saw it. Turnover.`); }
  if (!out.turnover && dcard?.fx.steal && rnd() * 100 < dcard.fx.steal) { out.turnover = `${dcard.name}: stolen`; notes.push(`${dcard.name}: they took the ball.`); }

  // Traps set on earlier possessions fire now
  const extra: [string, number][] = [];
  const tm = T.trapMult / 100;
  let blocked = false, cap = 100, sense = card?.fx.hard === 'sense';
  const spent = (card ? costOf(G, s, card) : 0) > 0 || iso;
  if (!out.turnover) {
    for (const t of O.traps.slice()) {
      if (P.newTraps.includes(t) || t.fx.revenge) continue;
      const f = t.fx, hard = !!f.hard;
      if (f.only && !f.only.includes(zone)) continue;
      if (f.needPass && (iso || card?.fx.fixed)) continue;
      if (!hard && !f.steal && !f.clock && (iso || card?.fx.fixed)) continue;
      if (!hard && card?.fx.noTraps && (!card.fx.only || card.fx.only.includes(zone))) continue;
      O.traps.splice(O.traps.indexOf(t), 1);
      O.discard.push(t);
      if (sense) {
        sense = false;
        out.traps.push({ name: t.name, text: `Trap Sense: you saw ${t.name} coming and walked around it.` });
        notes.push(`Trap Sense cancels their face-down ${t.name}.`);
        continue;
      }
      O.stats.trapsFired++;
      if (hard) O.stats.hard++;
      if (f.hard === 'block') { blocked = true; const x = `${t.name}: the ${zoneWord(zone)} shot is swatted away. Chance drops to ${T.blockP}%.`; out.traps.push({ name: t.name, text: x }); notes.push(x); }
      else if (f.hard === 'shutdown') { cap = Math.min(cap, T.shutdownCap); const x = `${t.name}: ${b.name} gets nothing clean. Chance capped at ${T.shutdownCap}%.`; out.traps.push({ name: t.name, text: x }); notes.push(x); }
      else if (f.hard === 'charge') {
        const pct = iso ? 80 : Math.min(95, (f.tov || 50) + T.chargeTov);
        if (rnd() * 100 < pct) { out.turnover = `${t.name}: offensive foul`; const x = `${t.name}: ${O.team[defIdx].name} planted his feet. Offensive foul on ${b.name}, turnover.`; out.traps.push({ name: t.name, text: x }); notes.push(x); }
        else { const x = `${t.name}: ${O.team[defIdx].name} tried to take the charge, no call. Play on.`; out.traps.push({ name: t.name, text: x }); notes.push(x); }
      } else if (f.clock) {
        const pct = (f.steal || 25) * tm + (spent ? 20 : 0);
        if (rnd() * 100 < pct) { out.turnover = `${t.name}: shot clock violation`; const x = `${t.name}: the shot clock ran out. Turnover.`; out.traps.push({ name: t.name, text: x }); notes.push(x); }
        else { const x = `${t.name}: the buzzer beat nobody. Shot got off in time.`; out.traps.push({ name: t.name, text: x }); notes.push(x); }
      } else if (f.steal) {
        if (rnd() * 100 < f.steal * tm) {
          out.turnover = `${t.name}: stolen`;
          if (f.next) O.nextBoost += f.next;
          const x = `${t.name}: they picked it off. Turnover.`; out.traps.push({ name: t.name, text: x }); notes.push(x);
        } else { const x = `${t.name}: they went for it and missed.`; out.traps.push({ name: t.name, text: x }); notes.push(x); }
      } else if (f.lock) {
        extra.push([t.name, -f.lock * tm]);
        const x = `${t.name}: ${zoneWord(zone)} shot gets −${Math.round(f.lock * tm)}%.`; out.traps.push({ name: t.name, text: x }); notes.push(x);
      }
      if (f.jinx) { S.cold = { v: f.jinx, turns: (f.turns || 1) + 1 }; notes.push(`${t.name}: your shots get −${f.jinx}% next possession.`); }
      if (out.turnover) break;
    }
  }
  if (clutch) extra.push(['Clutch', clutchBonus]);
  const ctx: ShotCtx = { guard: P.guard, card, dcard, extra, dt: iso ? null : P.dt };
  const ch = chance(G, s, shooter, zone, ctx);
  out.read = ch.read;
  out.passer = ch.passer;
  out.parts = ch.parts;
  let p = ch.p;
  if (blocked) p = T.blockP;
  else if (cap < 100) p = Math.min(p, cap);
  p = Math.max(Math.min(1, T.blockP), p);
  out.p = p;
  out.blocked = blocked;
  if (ch.read) notes.push(`Their ${SCHEME_NAME[P.guard!]} guessed ${zoneWord(zone)}: the shot loses ${Math.round((1 - ch.factor) * 100)}%.`);
  if (ch.open) notes.push(`${b.name} is wide open.`);
  const fat = fatigueOf(b);
  if (fat >= 4) notes.push(`${b.name} is tired (−${fat}%).`);
  const wasFire = b.streak >= 2;
  if (!out.turnover) {
    out.made = rnd() * 100 < p;
    if (!out.made && !blocked && zone === 'rim') {
      const pbCard = card?.fx.putback || 0;
      const pbShoe = (b.shoe?.putback || 0) + (b.skill.fx.putback || 0);
      if ((pbCard && rnd() * 100 < pbCard && rnd() * 100 < p) || (pbShoe && rnd() * 100 < pbShoe)) { out.made = true; out.putback = true; notes.push(`${b.name} follows his own miss: putback.`); }
    }
  }
  const worth = card && (!card.fx.only || card.fx.only.includes(zone)) ? card.fx.worth || 0 : 0;
  out.pts = out.made ? (out.putback ? 2 : ZONE_PTS[zone] + worth) : 0;
  if (out.made && zone === 'rim' && !out.putback) {
    const a1 = andOneChance(b, O.team[defIdx].def, !out.read && !iso && P.guard != null && P.guard !== zone);
    out.a1p = a1;
    const charged = out.traps.some((t) => /charge/i.test(t.name));
    if (charged) notes.push('Take the Charge: the contact is an offensive foul, so no and-one.');
    else if (rnd() * 100 < a1) { out.andOne = true; out.pts += 1; notes.push(`AND ONE! ${b.name} is fouled on the finish (${Math.round(a1)}%): +1 point and +1 Momentum.`); }
  }
  if (out.made && !out.putback) { out.label = lowLabel(p); out.inhuman = p <= 1; }
  // bookkeeping
  S.run = S.run.idx === shooter ? { idx: shooter, n: S.run.n + 1 } : { idx: shooter, n: 1 };
  b.hold = T.rot;
  S.nextBoost = card?.fx.next || 0;
  if (S.cold.turns > 0) S.cold.turns--;
  if (S.shadow.turns > 0) S.shadow.turns--;
  if (dcard) {
    if (dcard.fx.jinx) S.cold = { v: dcard.fx.jinx, turns: dcard.fx.turns || 1 };
    if (dcard.fx.shadow) S.shadow = { idx: -1, turns: dcard.fx.shadow };
  }
  if (card?.fx.jinx) O.cold = { v: card.fx.jinx, turns: card.fx.turns || 1 };
  if (!out.turnover) { S.stats.shots[zone]++; if (out.made) S.stats.made[zone]++; }
  if (out.made) {
    S.score += out.pts;
    // Fire is removed only by the owner's own miss: nobody else's basket touches it
    b.streak += b.skill.fx.fireStart && b.streak === 0 ? 2 : 1;
    S.mo = Math.min(T.moMax, S.mo + T.moBasket + (out.andOne ? 1 : 0));
    if (b.skill.fx.mo && (!b.skill.fx.moZone || b.skill.fx.moZone === zone)) S.mo = Math.min(T.moMax, S.mo + b.skill.fx.mo);
    if (S.coach === 'show' && out.passer != null && !iso) S.mo = Math.min(T.moMax, S.mo + 1);
    if (b.skill.fx.drain) O.mo = Math.max(0, O.mo - b.skill.fx.drain);
    if (card?.fx.swing) { O.mo = Math.max(0, O.mo - card.fx.swing); S.mo = Math.min(T.moMax, S.mo + Math.floor(card.fx.swing / 2)); notes.push(`${card.name}: they lose ${card.fx.swing} Momentum.`); }
    for (const t of O.traps.slice()) if (t.fx.revenge) { O.traps.splice(O.traps.indexOf(t), 1); O.discard.push(t); O.nextBoost += t.fx.revenge; out.revenge.push(t.name); notes.push(`${t.name}: they scored, so their next shot gets +${t.fx.revenge}%.`); }
  } else {
    if (!out.turnover) { if (wasFire) out.fireOff = true; b.streak = 0; }
    O.mo = Math.min(T.moMax, O.mo + T.moStop);
  }
  out.fireOn = !wasFire && b.streak >= 2;
  S.lastMadeThree = out.made && zone === 'three';
  out.extra = !!card?.fx.extra;
  P.extra = out.extra;
  if (card) S.discard.push(card);
  if (countered) S.discard.push(P.offCard!);
  if (dcard) O.discard.push(dcard);
  G.last = out;
  const who = s === 0 ? 'You' : 'CPU';
  const line = out.turnover ? `${who}: turnover (${out.turnover})` : `${who}: ${b.name} ${zoneWord(zone)} ${out.p}%${out.read ? ' (read)' : ''} ${out.made ? '+' + out.pts + (out.andOne ? ' AND ONE' : '') + (out.label ? ' ' + out.label : '') : out.blocked ? 'blocked' : 'miss'}`;
  G.log.push(line);
  G.hist.push({ n: G.n, side: s, text: line, outcome: out });
  G.feed.push({ n: G.n, side: s, kind: 'shot', text: feedText(G, who, out), detail: notes.slice() });
  if (S.score >= T.winTo) { G.over = true; G.winner = s; }
  else if (G.n >= T.possCap) { G.over = true; G.winner = S.score === O.score ? d : S.score > O.score ? s : d; }
  return out;
}
function feedText(G: CGame, who: string, o: Outcome): string {
  const b = G.sides[o.side].team[o.shooter];
  if (o.turnover) return `${who}: ${o.turnover}`;
  const asst = o.passer != null ? ` (pass from ${G.sides[o.side].team[o.passer].name})` : '';
  if (o.made) return `${who}: ${b.name} scores from ${ZONE_NAME[o.zone]}, +${o.pts}${o.putback ? ' on the putback' : asst}${o.andOne ? ' · AND ONE' : ''}${o.label ? ' · ' + o.label : ''}`;
  return `${who}: ${b.name} misses the ${ZONE_NAME[o.zone]} shot${o.blocked ? ' (blocked)' : ''} · ${o.p}%`;
}
/** Re-assigns who guards the opponent's slot `offIdx`: moves to the next defender and swaps with the one who had him. */
export function cycleMatch(G: CGame, s: Side, offIdx: number): void {
  const D = G.sides[s], n = D.team.length;
  const next = (D.match[offIdx] + 1) % n;
  const other = D.match.findIndex((d, i) => i !== offIdx && d === next);
  if (other >= 0) D.match[other] = D.match[offIdx];
  D.match[offIdx] = next;
  if (G.poss.dt && G.poss.off !== s) G.poss.dt = { mark: G.poss.dt.mark, open: openMan(G, G.poss.off, G.poss.dt.mark) };
}
export function nextPossession(G: CGame): void {
  if (G.over) return;
  startPossession(G, G.poss.extra ? G.poss.off : ((1 - G.poss.off) as Side));
}
export const canClutch = (G: CGame, s: Side): boolean => G.poss.off === s && G.sides[s].mo >= T.moMax && !G.poss.offCard?.fx.fixed;

// ---------- AI ----------
export interface AiSkill {
  /** 0..1: how often it takes the best option and plays cards well. */
  smart: number;
  /** Timing error on the Clutch bar. */
  sigma: number;
}
export interface ShotOption { shooter: number; zone: Zone; open: number; read: number; ev: number }
/** Expected points per option if the scheme guesses this zone a third of the time. Skips a double teamed shooter. */
export function options(G: CGame, s: Side, card: CCard | null = null): ShotOption[] {
  const out: ShotOption[] = [];
  const P = G.poss, dt = P.off === s ? P.dt : null;
  const slots = shooterSlots(G, s, card);
  G.sides[s].team.forEach((_b, i) => ZONES.forEach((zone) => {
    if (!slots.includes(i)) return;
    if (dt && dt.mark === i && !card?.fx.iso) return;
    const mk = (guard: Zone | null) => chance(G, s, i, zone, { guard, card, dcard: null, extra: [], dt }).p;
    const open = mk(null), read = mk(zone);
    out.push({ shooter: i, zone, open, read, ev: (ZONE_PTS[zone] * (open * 2 + read)) / 300 });
  }));
  return out.sort((a, b) => b.ev - a.ev);
}
const MO_PT = 0.055;
/** Weighted pick: higher EV is more likely; `smart` sharpens it. */
function pickWeighted<T extends { ev: number }>(list: T[], smart: number): T {
  if (rnd() < (1 - smart) * 0.3) return list[ri(Math.min(list.length, 5))];
  const beta = 1.5 + 9 * smart, top = list[0].ev;
  const w = list.map((o) => Math.exp((o.ev - top) * beta));
  let r = rnd() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
  return list[0];
}
/** Rough value of a card in expected points. */
function cardValue(G: CGame, s: Side, c: CCard, pick: ShotOption | null): number {
  const f = c.fx, onOff = G.poss.off === s, O = G.sides[(1 - s) as Side], S = G.sides[s];
  let v = 0;
  if (onOff && pick) {
    const base = chance(G, s, pick.shooter, pick.zone, { guard: null, card: null, dcard: null, extra: [], dt: G.poss.dt });
    const withC = chance(G, s, pick.shooter, pick.zone, { guard: null, card: c, dcard: null, extra: [], dt: G.poss.dt });
    const readB = chance(G, s, pick.shooter, pick.zone, { guard: pick.zone, card: null, dcard: null, extra: [], dt: G.poss.dt });
    const readC = chance(G, s, pick.shooter, pick.zone, { guard: pick.zone, card: c, dcard: null, extra: [], dt: G.poss.dt });
    const dp = ((withC.p - base.p) * 2 + (readC.p - readB.p)) / 3;
    v += (dp / 100) * (ZONE_PTS[pick.zone] + (f.worth && (!f.only || f.only.includes(pick.zone)) ? f.worth : 0)) + ((f.worth && (!f.only || f.only.includes(pick.zone))) ? withC.p / 100 * f.worth : 0);
    if (f.next) v += f.next * 0.01 * 1.6;
    if (f.extra) v += 0.9;
    if (f.putback) v += f.putback * 0.002;
    if (f.noTraps) v += O.traps.length * 0.1;
    if (f.risk) v -= f.risk * 0.015;
    if (f.scout) v += 0.1;
    if (f.swing) v += 0.12;
    if (f.hard === 'sense') v += O.traps.length * 0.45;
    if (f.fire) v += 0.2;
  } else if (!onOff) {
    if (f.lock) v += f.lock * (f.only ? 0.014 : 0.022) * 1.2;
    if (f.steal && !f.trap) v += f.steal * 0.02;
    if (f.counter) v += O.hand.length ? 0.35 : 0;
    if (f.shadow) v += 0.5;
  }
  if (f.trap) {
    const hard = f.hard === 'block' ? 0.7 : f.hard === 'shutdown' ? 1 : f.hard === 'charge' ? 0.55 : 0;
    v += (f.lock || 0) * 0.016 + (f.steal || 0) * 0.018 + (f.revenge || 0) * 0.008 + hard;
  }
  if (f.jinx) v += f.jinx * (f.turns || 1) * 0.012;
  if (f.draw) v += f.draw * 0.16;
  if (f.mo) v += f.mo * MO_PT;
  if (f.aura) v += f.aura * 0.07 * (f.only ? 0.6 : 1);
  if (f.auraLock) v += f.auraLock * 0.07;
  if (f.discount) v += 0.4;
  if (c.fx.dt) v += 0.3;
  void S;
  return v;
}
/** Plays the best card for this phase, if any is worth its Momentum. `reserve` is Momentum to keep back. */
function chooseCard(G: CGame, s: Side, pick: ShotOption | null, k: AiSkill, reserve = 0): { i: number; target: number } | null {
  const S = G.sides[s];
  const price = MO_PT * (S.mo >= 8 ? 0.6 : S.mo >= 5 ? 1 : 1.5);
  let bi = -1, bv = 0.07, target = 0;
  S.hand.forEach((c, i) => {
    if (c.fx.iso || c.fx.allIn || (c.fx.pass && G.poss.off === s) || !canPlay(G, s, c) || S.mo - costOf(G, s, c) < reserve) return;
    if (c.fx.dt && !pickDT(G, s, k)) return;
    const v = cardValue(G, s, c, pick) - costOf(G, s, c) * price + (rnd() - 0.5) * (1 - k.smart) * 0.3;
    if (v > bv) { bv = v; bi = i; }
  });
  if (bi < 0) return null;
  if (S.hand[bi].fx.dt) target = pickDT(G, s, k) ?? 0;
  return { i: bi, target };
}
/** Which offense slot the defense should double team, or null if it is not worth it. */
function pickDT(G: CGame, s: Side, k: AiSkill, free = false): number | null {
  const off = (1 - s) as Side, P = G.poss;
  const prev = P.dt;
  P.dt = null;
  const base = options(G, off);
  const baseEv = base[0].ev;
  let best: number | null = null, bv = 0;
  for (let m = 0; m < G.sides[off].team.length; m++) {
    P.dt = { mark: m, open: openMan(G, off, m) };
    const ev = options(G, off)[0].ev;
    const gain = baseEv - ev;
    if (gain > bv) { bv = gain; best = m; }
  }
  P.dt = prev;
  const need = (free ? 0.05 : 0.09) - 0.03 * k.smart;
  return bv > need ? best : null;
}
/** Best man-to-man: assigns defenders to minimise the other team's best looks. Falls back to the default when not smart. */
function aiMatchups(G: CGame, s: Side, k: AiSkill): void {
  const D = G.sides[s], off = (1 - s) as Side, O = G.sides[off];
  const def = autoMatch(D.team, O.team);
  if (rnd() > k.smart) { D.match = def; return; }
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  let best = def, bv = 1e9;
  const keep = D.match;
  for (const m of perms) {
    D.match = m;
    const per = O.team.map((_b, i) => Math.max(...ZONES.map((z) => ZONE_PTS[z] * chance(G, off, i, z, { guard: null, card: null, dcard: null, extra: [], dt: null }).p)));
    const v = per.sort((a, b) => b - a).reduce((a, x, i) => a + x * [1, 0.6, 0.3][i], 0);
    if (v < bv - 0.5) { bv = v; best = m; }
  }
  D.match = keep;
  D.match = best.slice();
}
const subQuality = (b: CBaller): number => Math.max(b.rim, b.mid, b.three) * 0.45 + b.ply * 0.1 + b.def * 0.35 + (b.shoe ? b.shoe.bonus * 0.5 : 0) - fatigueOf(b) * 1.1 + (b.hold <= 0 ? 3 : -b.hold * 1.5);
/** Swaps tired starters for fresher bench players when it is worth the Momentum. At most one sub per call. */
export function aiSubs(G: CGame, s: Side, k: AiSkill): void {
  const S = G.sides[s];
  if (!S.bench.length || S.stats.subs >= 2 || S.mo < T.subCost + 1 || rnd() > 0.6 + 0.4 * k.smart) return;
  let best: [number, number, number] | null = null;
  S.team.forEach((a, ci) => S.bench.forEach((b, bi) => {
    if (a.cd > 0 || b.cd > 0) return;
    const gain = subQuality(b) - subQuality(a);
    if (gain > 4 + (fatigueOf(a) < 12 ? 12 : 0) && (!best || gain > best[2])) best = [ci, bi, gain];
  }));
  if (best) doSub(G, s, best[0], best[1]);
}
export function aiOffense(G: CGame, s: Side, k: AiSkill): void {
  const S = G.sides[s], P = G.poss;
  const opts0 = options(G, s);
  let opts = opts0;
  let pick = pickWeighted(opts, k.smart);
  P.shooter = pick.shooter;
  P.zone = pick.zone;
  // Heave or Iso when they beat the normal look by enough
  const hi = S.hand.findIndex((c) => c.fx.allIn && canPlay(G, s, c));
  if (hi >= 0 && S.mo >= T.moMax && (G.sides[(1 - s) as Side].score - S.score >= 0 || rnd() < 0.5)) {
    playCard(G, s, hi);
    P.shooter = S.team.reduce((bi, b, i, t) => (b.three > t[bi].three ? i : bi), 0);
    if (P.dt?.mark === P.shooter) P.shooter = P.dt.open;
    return;
  }
  const ii = S.hand.findIndex((c) => c.fx.iso && canPlay(G, s, c));
  if (ii >= 0) {
    let bi = -1, bp = 0;
    const isoSlots = shooterSlots(G, s, S.hand[ii]);
    S.team.forEach((_b, i) => { if (!isoSlots.includes(i)) return; const p = chance(G, s, i, 'rim', { guard: null, card: S.hand[ii], dcard: null, extra: [], dt: P.dt }).p; if (p > bp) { bp = p; bi = i; } });
    if ((bp * 2) / 100 - pick.ev > 0.45 - 0.1 * k.smart && S.mo - 4 >= 0) { playCard(G, s, ii); P.shooter = bi; return; }
  }
  // a pass card: hand the ball to a cooling teammate, or to a better look, when it pays
  if (!P.offCard && rnd() > (1 - k.smart) * 0.3) {
    let bi = -1, bo: ShotOption[] = [], bg = 0.05;
    S.hand.forEach((c, i) => {
      if (!c.fx.pass || !canPlay(G, s, c) || S.mo - costOf(G, s, c) < 0) return;
      const o = options(G, s, c);
      const gain = o[0].ev - pick.ev - costOf(G, s, c) * MO_PT * 1.5;
      if (gain > bg) { bg = gain; bi = i; bo = o; }
    });
    if (bi >= 0) {
      playCard(G, s, bi);
      pick = pickWeighted(bo, k.smart);
      P.shooter = pick.shooter;
      P.zone = pick.zone;
      if (canClutch(G, s)) P.clutch = true;
      return;
    }
  }
  const choice = rnd() < (1 - k.smart) * 0.4 ? null : chooseCard(G, s, pick, k);
  if (choice) {
    const c = S.hand[choice.i];
    playCard(G, s, choice.i, choice.target);
    // re-pick with the card in play when it only fits a zone
    if (c.fx.only && !c.fx.only.includes(pick.zone) && !c.fx.trap) {
      opts = options(G, s, c);
      pick = pickWeighted(opts, k.smart);
      P.shooter = pick.shooter;
      P.zone = pick.zone;
    }
  }
  if (scouted(G, s) && P.guard === P.zone && !P.offCard?.fx.noRead) {
    const alt = options(G, s, P.offCard).find((o) => o.zone !== P.guard);
    if (alt) { P.shooter = alt.shooter; P.zone = alt.zone; }
  }
  if (canClutch(G, s)) P.clutch = true;
}
export function aiDefense(G: CGame, s: Side, k: AiSkill): void {
  const off = (1 - s) as Side, P = G.poss, S = G.sides[s];
  aiMatchups(G, s, k);
  // the double team is visible, so decide it first
  const mark = S.mo >= T.dtCost + 1 ? pickDT(G, s, k) : null;
  if (mark != null) setDT(G, s, mark);
  const opts = options(G, off);
  // scheme: sample a zone by how good the other team's best look in it is
  const bestBy = ZONES.map((z) => ({ zone: z, ev: opts.find((o) => o.zone === z)!.ev }));
  bestBy.sort((a, b) => b.ev - a.ev);
  P.guard = rnd() < (1 - k.smart) * 0.6 ? ZONES[ri(3)] : pickWeighted(bestBy, k.smart * 0.8).zone;
  const choice = rnd() < (1 - k.smart) * 0.4 ? null : chooseCard(G, s, null, k);
  if (choice) playCard(G, s, choice.i, choice.target);
}
/** Where a tapper with timing error sigma stops the Clutch needle; returns the bonus. */
export function clutchTap(sigma: number): number {
  const u = Math.max(1e-9, rnd()), v = rnd();
  const e = Math.abs(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma);
  return clutchBonusAt(e);
}
/** Bonus for stopping the needle `dist` away from the centre of the green zone. */
export const clutchBonusAt = (dist: number): number => (dist <= CLUTCH.perfect / 2 ? CLUTCH.perf : dist <= CLUTCH.zone / 2 ? CLUTCH.hit : 0);

export function simPossession(G: CGame, skills: [AiSkill, AiSkill]): Outcome {
  const s = G.poss.off, d = (1 - s) as Side;
  aiSubs(G, d, skills[d]);
  aiSubs(G, s, skills[s]);
  aiDefense(G, d, skills[d]);
  aiOffense(G, s, skills[s]);
  const o = resolve(G, G.poss.clutch ? clutchTap(skills[s].sigma) : 0);
  nextPossession(G);
  return o;
}
export function simGame(a: CSide, b: CSide, skills: [AiSkill, AiSkill]): CGame {
  const G = newGame(a, b);
  while (!G.over) simPossession(G, skills);
  return G;
}

// ---------- teams ----------
let SORTED: number[][] | null = null;
const teamVal = (b: number[]) => Math.max(b[1] * 0.75 + b[2] * 0.25, b[3] * 0.75 + b[2] * 0.25) + b[4] * 0.4;
function sorted(): number[][] {
  if (!SORTED) SORTED = catalog().B.filter((b) => b[10] !== 2).slice().sort((a, b) => teamVal(a) - teamVal(b));
  return SORTED;
}
let SHOES: number[][] | null = null;
const shoes = (): number[][] => SHOES || (SHOES = catalog().S.slice().sort((a, b) => shoeScore(a[0]) - shoeScore(b[0]) || a[1] - b[1]));
/** Five Ballerz from a power band (0 weakest .. 1 strongest), with Sneakerz from the same band. */
export function bandTeam(lo: number, hi: number, cls?: ClassKey, size = SQUAD_SIZE): CBaller[] {
  const all = sorted(), S = shoes();
  const a = Math.floor(all.length * lo), z = Math.max(a + 8, Math.floor(all.length * hi));
  let pool = all.slice(a, z);
  if (cls) { const fit = pool.filter((b) => classOf({ D: b[1], P: b[2], S: b[3], F: b[4] }) === cls); if (fit.length >= 5) pool = fit.concat(pool.slice(0, Math.floor(pool.length / 3))); }
  const ids = new Set<number>();
  while (ids.size < size) ids.add(pool[ri(pool.length)][0]);
  const pickS = () => S[Math.min(S.length - 1, Math.floor(S.length * (lo + rnd() * (hi - lo))))][0];
  return [...ids].map((id) => cBaller(id, pickS()));
}
/** Five starter Ballerz for a new player: mid-pack, a slasher, a shooter, a stopper, a playmaker and a wild card. */
export function starterIds(): number[] {
  const all = sorted();
  const band = all.slice(Math.floor(all.length * 0.2), Math.floor(all.length * 0.45));
  const want: ((b: number[]) => boolean)[] = [(b) => b[1] >= b[3] + 4, (b) => b[3] >= b[1] + 4, (b) => b[4] >= Math.max(b[1], b[3]), (b) => b[2] >= Math.max(b[1], b[3]) + 2, () => true];
  const got: number[] = [];
  for (const f of want) { const p = band.filter((b) => f(b) && !got.includes(b[0])); got.push((p.length ? p : band)[ri(p.length || band.length)][0]); }
  return got;
}
/** Percentile of a Baller in the catalog (0..1), used to show how strong a squad is. */
export function percentile(id: number): number {
  const all = sorted();
  const i = all.findIndex((b) => b[0] === id);
  return i < 0 ? 0.5 : i / all.length;
}
