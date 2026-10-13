// Game state and the possession loop: actions, Traps, shot math, fatigue, bench, Hero Moments.
import { C, COAL } from './cards';
import {
  ACTIONS, CLASSES, CONTEST_MAX, ENH_SHOT, FAT_DEF_PCT, FAT_PCT, HAND_MAX, INSIDE, MAX_FAT, MAX_ST, MOMENT_COST, MOMENT_FROM,
  POSS_CAP, SCHEMES, SHOTS, SHOT_KEYS, SUB_COST, WIN, buildRoster, isFlyer, isSniper,
} from './engine';
import { ri, rnd, shuffle } from './rng';
import type {
  ActionType, ClassKey, Ctx, Game, HandCard, Mod, PlayCard, SchemeKey, SeqAction, ShotChance, ShotQuery, ShotResult, ShotStatOpts,
  ShotType, Side, SideState, Slot, TrapEvent,
} from './types';

const other = (s: Side): Side => (1 - s) as Side;
const cx = (G: Game): Ctx => G.ctx!;
const nameOf = (c: HandCard): string => (c.kind === 'baller' ? c.name : c.n);

export function logp(G: Game, t: string, cls?: string): void {
  (G.ctx ? G.ctx.log : G.log).push({ t, cls: cls || '' });
}
export function draw(G: Game, s: Side, n: number): void {
  const S = G.sides[s];
  for (let i = 0; i < n; i++) {
    if (!S.deck.length) {
      S.court.forEach((b) => tire(G, s, S.court.indexOf(b), 1, false));
      logp(G, (s === 0 ? 'You' : 'CPU') + ': deck empty, everyone gets tired.');
      continue;
    }
    const c = S.deck.pop()!;
    if (S.hand.length < HAND_MAX) S.hand.push(c);
    else S.burn.push(c);
  }
}
export function coal(G: Game, s: Side, n: number): void {
  for (let i = 0; i < n; i++) {
    const S = G.sides[s];
    S.deck.splice(ri(S.deck.length + 1), 0, COAL);
  }
}
export function addMod(G: Game, s: Side, m: Mod): void {
  m.uses = m.uses || 1;
  G.sides[s].mods.push(m);
}
export function stealBonus(G: Game, o: Side): number {
  return G.sides[o].court.some((b) => b.card.trait === 'patch') ? 10 : 0;
}
export function tire(G: Game, s: Side, i: number, n: number, fromOpp: boolean): void {
  const S = G.sides[s], b = S.court[i];
  if (!b) return;
  if (fromOpp && b.card.trait === 'stone') return;
  b.fat = Math.min(MAX_FAT, b.fat + n);
  if (b.fat >= MAX_FAT && (b.card.trait === 'zombie' || b.card.trait === 'bzombie') && !b.once.undead) {
    b.once.undead = true;
    b.fat = 0;
    if (b.card.trait === 'bzombie') S.court.forEach((x) => { if (x !== b) x.fat = Math.max(0, x.fat - 1); });
    logp(G, b.card.name + ' rises again (Undead).');
  }
}
export const clutch = (G: Game): boolean => G.score[0] >= 15 && G.score[1] >= 15;

/** v0.7 deck: the class cards (Basics twice) plus 12 random neutrals, 25 cards. */
export function deckFor(cls: ClassKey): PlayCard[] {
  const d: PlayCard[] = [];
  C.filter((c) => c.cls === cls).forEach((c) => { const n = c.r === 'basic' ? 2 : 1; for (let i = 0; i < n; i++) d.push(c); });
  const neu = shuffle(C.filter((c) => !c.cls).slice());
  neu.slice(0, 12).forEach((c) => d.push(c));
  return shuffle(d);
}
const slot = (card: Slot['card']): Slot => ({ card, fat: 0, used: false, once: {}, tmpF: 0, locked: 0 });

function newSide(cls: ClassKey, strategy?: 'stars' | 'deep'): SideState {
  const R = buildRoster(cls, strategy);
  return {
    cls, strategy: R.strategy, bench: R.bench.map(slot), court: R.starters.map(slot), hand: [], deck: deckFor(cls), burn: [],
    st: 0, maxSt: 0, bonusSt: R.starters.some((c) => c.sneaker.rarI === 2) ? 1 : 0, traps: [], ong: {}, mods: [], debuffs: [], momentUsed: false, seeScheme: 0,
    lastShot: '', lastAssist: false, lastSD: false, pressed: false, sneakFree: R.starters.some((c) => c.sneaker.rarI === 3 || c.sneaker.rarI === 4), revealed: [],
  };
}

export interface NewGameOpts {
  human?: number;
  strat0?: 'stars' | 'deep';
  strat1?: 'stars' | 'deep';
}
export function newGame(c0: ClassKey, c1: ClassKey, opts: NewGameOpts = {}): Game {
  const G: Game = {
    sides: [newSide(c0, opts.strat0), newSide(c1, opts.strat1)], score: [0, 0], n: 0, poss: ri(2) as Side, log: [], over: false, winner: -1, extra: -1, ctx: null, human: opts.human ?? 0,
    rec: { cls: [c0, c1], plays: [{}, {}], shots: [{}, {}], schemes: {}, traps: {}, legend: [0, 0], moments: [0, 0], turnovers: [0, 0], combos: {}, assists: [0, 0], maxDef: [0, 0], subs: [0, 0], perfect: [0, 0], strat: [null, null] },
  };
  G.rec.strat = [G.sides[0].strategy, G.sides[1].strategy];
  ([0, 1] as Side[]).forEach((s) => { draw(G, s, s === G.poss ? 3 : 4); G.sides[s].court.forEach((_b, i) => checkIn(G, s, i)); });
  return G;
}

/** Check-In triggers of a Baller's trait (like Hearthstone Battlecry). */
export function checkIn(G: Game, s: Side, i: number): void {
  const S = G.sides[s], O = G.sides[other(s)], b = S.court[i], t = b.card.trait;
  if (t === 'pencil') draw(G, s, 1);
  if (t === 'steampunk' && S.deck.length > 1) {
    const top = S.deck.slice(-3);
    const val = (c: HandCard) => (c.kind === 'baller' ? c.salary : c.c) || 0;
    let bi = 0;
    top.forEach((c, j) => { if (val(c) > val(top[bi])) bi = j; });
    const pick = top[bi];
    S.deck.splice(S.deck.lastIndexOf(pick), 1);
    S.deck.push(pick);
  }
  if (t === 'glasses' && O.traps.length) { S.revealed.push(O.traps[0].n); logp(G, b.card.name + ' scouts a Trap: ' + O.traps[0].n + '.'); }
  if (t === 'alien' || t === 'bpalien') {
    const pool = O.hand.filter((c) => c.kind !== 'baller' && c.k !== 'coal');
    if (pool.length && S.hand.length < HAND_MAX) { const c = pool[ri(pool.length)]; S.hand.push(c); logp(G, b.card.name + ' abducts a copy of ' + nameOf(c) + '.'); }
  }
  if (t === 'palien' || t === 'bpalien') { S.peek = O.hand.map(nameOf); logp(G, b.card.name + ' probes the opponent’s hand.'); }
}

export function cardCost(G: Game, s: Side, c: HandCard): number {
  if (c.kind === 'baller') return Math.max(1, Math.round(c.salary / 2));
  let k = c.c;
  const S = G.sides[s];
  if (c.trap && S.cls === 'three') k -= 1;
  if (c.tags.includes('distraction') && S.court.some((b) => b.card.trait === 'emoji')) k -= 1;
  return Math.max(0, k);
}
export function phaseOf(G: Game, s: Side): 'off' | 'def' | null {
  if (!G.ctx) return null;
  return G.ctx.off === s ? 'off' : 'def';
}
const ONG_KEY: Record<string, keyof SideState['ong']> = { monsoon: 'monsoon', sleigh: 'sleigh', three_level: 'tls', wear_down: 'wear', groove: 'groove', two_way: 'twoway' };

export function canPlay(G: Game, s: Side, c: HandCard): boolean {
  const ph = phaseOf(G, s);
  if (!ph || G.ctx!.resolved) return false;
  const ctx = cx(G), S = G.sides[s];
  if (cardCost(G, s, c) > S.st) return false;
  if (c.kind === 'baller') return ph === 'def' ? !ctx.defLocked : ctx.seq.length === 0;
  if (c.ph !== 'any' && c.ph !== ph) return false;
  if (ph === 'def' && ctx.defLocked) return false;
  if (c.trap && S.traps.length >= 2) return false;
  if (c.act && ctx.seq.length >= 3) return false;
  if (c.act && c.act !== 'pass' && gassed(S.court[ctx.handler])) return false;
  if (c.act === 'pump' && ctx.pumps >= 1) return false;
  if (c.act === 'iso' && ctx.seq.some((a) => a.type === 'pass')) return false;
  if (c.ongoing && S.ong[ONG_KEY[c.k]]) return false;
  if (c.cond && !c.cond(G, s)) return false;
  return true;
}

export function playCard(G: Game, s: Side, hi: number, slotIdx?: number): boolean {
  const S = G.sides[s], c = S.hand[hi];
  if (!c || !canPlay(G, s, c)) return false;
  const cost = cardCost(G, s, c);
  S.st -= cost;
  S.hand.splice(hi, 1);
  const who = s === G.human ? 'You' : 'CPU';
  if (c.kind === 'baller') {
    let i = slotIdx;
    if (i == null) { i = 0; S.court.forEach((b, j) => { if (b.fat > S.court[i!].fat) i = j; }); }
    const out = S.court[i];
    S.burn.push(out.card);
    S.court[i] = slot(c);
    logp(G, who + ' sub: ' + c.name + ' checks in for ' + out.card.name + '.');
    checkIn(G, s, i);
    rec(G, s, 'sub');
    return true;
  }
  rec(G, s, c.k);
  if (c.tags.includes('ref') || c.tags.includes('distraction')) {
    const O = G.sides[other(s)];
    const ti = O.traps.findIndex((t) => (t.trap === 'ref' && c.tags.includes('ref')) || t.trap === 'refdis');
    if (ti >= 0) {
      const t = O.traps.splice(ti, 1)[0];
      const msg = t.fire!(G, other(s), { card: c });
      G.rec.traps[t.k] = (G.rec.traps[t.k] || 0) + 1;
      O.burn.push(t);
      S.burn.push(c);
      logp(G, msg, 'trap');
      return true;
    }
  }
  if (c.trap) { S.traps.push(c); logp(G, who + ' sets a Trap.'); return true; }
  logp(G, (who === 'You' ? 'You play ' : 'CPU plays ') + c.n + '.');
  c.play!(G, s);
  if (c.ongoing) G.rec.legend[s]++;
  S.burn.push(c);
  return true;
}
function rec(G: Game, s: Side, k: string): void {
  const p = G.rec.plays[s];
  p[k] = (p[k] || 0) + 1;
}

// ---------- possession ----------
export function startPossession(G: Game): void {
  G.n++;
  const off = G.poss, def = other(off);
  G.ctx = { off, def, scheme: null, contest: 0, pumps: 0, handler: 0, prevHandler: -1, seq: [], flags: {}, immune: [false, false], defBoost: [0, 0], turnover: null, ignoreScheme: false, ignoreTraps: false, pumpArmed: 0, log: [], resolved: false, defLocked: false, momentDef: false, result: null };
  G.sides.forEach((S, s) => {
    S.maxSt = Math.min(MAX_ST, S.maxSt + 1);
    S.st = S.maxSt + S.bonusSt;
    S.bonusSt = 0;
    S.peek = null;
    S.court.forEach((b) => { b.tmpF = 0; });
    S.bench.forEach((b) => { b.fat = Math.max(0, b.fat - 2); });
    if (s === off) {
      S.court.forEach((b) => { b.fat = Math.max(0, b.fat - (b.used ? 1 : 2) - (b.card.trait === 'nasal' ? 1 : 0)); b.used = false; });
      draw(G, s as Side, 1);
    }
  });
  const O = G.sides[off];
  if (O.ong.groove && O.ong.groove.free > 0) G.ctx.flags.grooveFree = true;
  G.ctx.press = O.pressed;
  O.pressed = false;
  G.ctx.handler = bestHandler(G, off);
}
export const gassed = (b: Slot): boolean => b.fat >= MAX_FAT;
export function bestHandler(G: Game, s: Side): number {
  const S = G.sides[s];
  let bi = -1, bv = -Infinity;
  S.court.forEach((b, i) => { if (gassed(b)) return; const v = b.card.power - b.fat * 8; if (v > bv) { bv = v; bi = i; } });
  return bi < 0 ? 0 : bi;
}
export function canSub(G: Game, s: Side): boolean {
  const ctx = G.ctx;
  if (!ctx || ctx.resolved) return false;
  const S = G.sides[s];
  if (S.st < SUB_COST || !S.bench.length) return false;
  return ctx.off === s ? ctx.seq.length === 0 : !ctx.defLocked;
}
export function doSub(G: Game, s: Side, ci: number, bi: number): boolean {
  if (!canSub(G, s)) return false;
  const S = G.sides[s], ctx = cx(G);
  S.st -= SUB_COST;
  const out = S.court[ci], inn = S.bench[bi];
  inn.fresh = true;
  inn.used = false;
  inn.locked = 0;
  S.court[ci] = inn;
  S.bench[bi] = out;
  out.fresh = false;
  G.rec.subs[s]++;
  logp(G, (s === G.human ? 'You' : 'CPU') + ' sub: ' + inn.card.name + ' checks in for ' + out.card.name + '.');
  checkIn(G, s, ci);
  if (ctx.off === s && ctx.handler === ci && gassed(inn)) ctx.handler = bestHandler(G, s);
  return true;
}
export function actionCost(G: Game, _s: Side, type: ActionType): number {
  const ctx = cx(G);
  let k = ACTIONS[type].cost;
  if (type === 'drive' && ctx.flags.tempo) k -= 1;
  if ((type === 'screen' || type === 'drive') && ctx.flags.grooveFree) k = 0;
  if (ctx.press && ctx.seq.length === 0) k += 2;
  return Math.max(0, k);
}
export function heroCanAct(G: Game, s: Side, type: ActionType, emp?: boolean): boolean {
  const S = G.sides[s], ctx = G.ctx;
  if (!ctx || ctx.off !== s || ctx.resolved || ctx.seq.length >= 3) return false;
  if (gassed(S.court[ctx.handler]) && type !== 'pass') return false;
  if (type === 'pump' && ctx.pumps >= 1) return false;
  if (!CLASSES[S.cls].acts.includes(type)) return false;
  if (type === 'iso' && ctx.seq.some((a) => a.type === 'pass')) return false;
  let k = actionCost(G, s, type);
  if (S.sneakFree && k >= 2) k = 0;
  if (emp) k += 1;
  return k <= S.st;
}
export function heroAct(G: Game, s: Side, type: ActionType, receiver?: number, emp?: boolean): boolean {
  if (!heroCanAct(G, s, type, emp)) return false;
  const S = G.sides[s], ctx = cx(G);
  let k = actionCost(G, s, type);
  if (S.sneakFree && k >= 2) { k = 0; S.sneakFree = false; logp(G, 'Legendary Sneaker: free action.'); }
  if (emp) k += 1;
  S.st -= k;
  if (ctx.flags.tempo && type === 'drive') ctx.flags.tempo = false;
  act(G, s, type, { receiver, emp });
  return true;
}
export function bestReceiver(G: Game, s: Side, from: number): number {
  const S = G.sides[s];
  let bi = from === 0 ? 1 : 0, bv = -Infinity;
  S.court.forEach((b, i) => { if (i === from) return; const v = b.card.power - b.fat * 8 - (gassed(b) ? 999 : 0) + rnd(); if (v > bv) { bv = v; bi = i; } });
  return bi;
}

export interface ActOpts {
  free?: boolean;
  receiver?: number;
  emp?: boolean;
  adv?: number;
  fat?: number;
  recover?: number;
  noLook?: boolean;
  noTrap?: boolean;
}
export function act(G: Game, s: Side, type: ActionType, opts: ActOpts = {}): void {
  const ctx = cx(G), S = G.sides[s];
  if (ctx.turnover || ctx.seq.length >= 3) return;
  const actor = ctx.handler;
  let base = opts.adv ?? ACTIONS[type].adv;
  if (type === 'pump' && S.cls === 'bucket') base = 3;
  if (opts.emp) base += 1;
  if (S.court[actor].fresh) { base += 1; S.court[actor].fresh = false; }
  const a: SeqAction = { type, actor, adv: base, nullified: false, noLook: !!opts.noLook, emp: !!opts.emp };
  if (type === 'pump') ctx.pumps++;
  if (ctx.press && ctx.seq.length === 0 && rnd() < 0.25) { ctx.turnover = 'Full-Court Press forces a turnover!'; logp(G, ctx.turnover, 'bad'); return; }
  ctx.seq.push(a);
  if (type === 'screen') {
    let si = -1, sv = Infinity;
    S.court.forEach((b, i) => { if (i !== actor && b.fat < sv) { sv = b.fat; si = i; } });
    a.screener = si;
    tire(G, s, si, opts.fat ?? 1, false);
    S.court[si].used = true;
  } else {
    tire(G, s, actor, opts.fat ?? (type === 'iso' ? 2 : 1), false);
    S.court[actor].used = true;
  }
  if (type === 'pass') {
    let r = opts.receiver;
    if (r == null || r === actor || gassed(S.court[r])) r = bestReceiver(G, s, actor);
    ctx.prevHandler = actor;
    ctx.handler = r;
    if (opts.recover) S.court[r].fat = Math.max(0, S.court[r].fat - opts.recover);
  }
  if (type === 'iso' && ctx.flags.postup) { a.adv += 1; ctx.flags.postup = false; }
  const who = s === G.human ? 'You' : 'CPU';
  logp(G, who + ': ' + ACTIONS[type].name + (opts.emp ? '+' : '') + (type === 'pass' ? ' to ' + S.court[ctx.handler].card.name : '') + '.');
  if (!opts.noTrap && !ctx.ignoreTraps && ['pass', 'drive', 'screen'].includes(type)) fireTraps(G, { kind: type, action: a });
  ctx.pumpArmed = type === 'pump' ? (S.cls === 'bucket' ? 2 : 1) : 0;
}
function fireTraps(G: Game, ev: TrapEvent): void {
  const ctx = cx(G), o = ctx.def, O = G.sides[o];
  const ti = O.traps.findIndex((t) => {
    if (ev.kind === 'shot') return t.trap === 'shot' && t.shots!.includes(ev.type!) && (!t.needDrive || ctx.seq.some((a) => a.type === 'drive'));
    return t.trap === ev.kind;
  });
  if (ti < 0) return;
  if (ctx.flags.skipTrap) { ctx.flags.skipTrap = 0; logp(G, 'Step-Back slips past a Trap.'); return; }
  const t = O.traps.splice(ti, 1)[0];
  O.burn.push(t);
  G.rec.traps[t.k] = (G.rec.traps[t.k] || 0) + 1;
  if (ctx.pumpArmed) {
    ctx.pumpArmed--;
    logp(G, 'Pump fake baits ' + t.n + '. Wasted!', 'good');
    if (ctx.pumpArmed > 0) fireTraps(G, ev);
    return;
  }
  const msg = t.fire!(G, o, ev);
  logp(G, msg, 'trap');
}

// ---------- shot math ----------
export function anchorP(type: ShotType, x: number): number {
  const a = SHOTS[type].anchor, xs = [60, 80, 90, 99];
  if (x <= 60) return Math.max(3, a[0] - ((60 - x) * (a[1] - a[0])) / 20);
  for (let i = 0; i < 3; i++) if (x <= xs[i + 1]) return a[i] + ((a[i + 1] - a[i]) * (x - xs[i])) / (xs[i + 1] - xs[i]);
  return a[3];
}
function shotStat(G: Game, s: Side, idx: number, type: ShotType, o: ShotStatOpts): number {
  const S = G.sides[s], b = S.court[idx], st = (k: 'D' | 'P' | 'S' | 'F' | 'J') => (o.all99 ? 99 : b.card.st[k]);
  if (type === 'three') return o.s99 ? 99 : st('S');
  if (type === 'dunk') return o.d99 ? 99 : st('D');
  if (type === 'layup') return (st('D') + st('P')) / 2;
  if (type === 'fade') return (st('S') + st('J')) / 2;
  const pi = o.passer ?? cx(G).prevHandler;
  const pb = pi >= 0 ? S.court[pi] : b;
  const pP = o.p99 ? 99 : o.all99 ? 99 : pb.card.st.P;
  return (pP + st('J')) / 2;
}
export function schemeStops(scheme: SchemeKey | null, type: ShotType, seq: SeqAction[]): boolean {
  if (scheme === 'pack') return INSIDE.includes(type);
  if (scheme === 'close') return type === 'three' || type === 'fade';
  if (scheme === 'deny') {
    if (type === 'oop') return false;
    const last = seq[seq.length - 1];
    return !!last && last.type === 'pass' && !last.noLook;
  }
  return false;
}

/** Chance that a shot goes in, with the full breakdown for the UI. */
export function chance(G: Game, q: ShotQuery): ShotChance {
  const S = G.sides[q.s], O = G.sides[other(q.s)], ctx = cx(G), seq = q.seq || ctx.seq, flags = q.flags || ctx.flags, b = S.court[q.idx];
  const type = q.type;
  let adv = 0, pp = q.extraPP || 0;
  const scheme = q.scheme;
  let backdoorUsed = false;
  seq.forEach((a) => {
    if (a.nullified) return;
    let v = a.adv;
    if (a.type === 'pass' && scheme === 'deny' && !a.noLook) { if (flags.backdoor && !backdoorUsed) { v = 3; backdoorUsed = true; } else v = 0; }
    if (a.type === 'screen' && scheme === 'deny') { if (flags.slip) { if (INSIDE.includes(type)) v += 2; } else v = 0; }
    if (a.type === 'drive') { if (scheme === 'close' && flags.blowby) v += 3; }
    if (a.type === 'pump' && v > 0 && scheme === 'close' && flags.attackco) v += 3;
    adv += v;
  });
  // combos
  const t2 = seq.slice(-2).map((a) => a.type).join(',');
  let combo: string | null = null;
  if (t2 === 'drive,pass' && type === 'three') combo = 'Drive & Kick';
  else if (t2 === 'screen,pass' && (type === 'dunk' || type === 'oop')) combo = 'Pick and Roll';
  else if (t2 === 'pump,drive' && type === 'layup') combo = 'Up and Under';
  else if (t2 === 'pass,pass' && type === 'layup') combo = 'Give and Go';
  else if (t2 === 'pass,pass' && type === 'oop') combo = 'Lob City';
  if (combo) adv += 2;
  // hero signatures
  if (S.cls === 'splash') { const n = seq.filter((a) => a.type === 'pass').length; pp += Math.min(9, 3 * n); }
  if (S.cls === 'show' && type === 'oop') pp += 8;
  if (S.cls === 'pnr') {
    const sd = seq.filter((a) => a.type === 'screen' || a.type === 'drive');
    let alt = 0;
    for (let j = 1; j < sd.length; j++) if (sd[j].type !== sd[j - 1].type) alt++;
    pp += Math.min(20, 10 * alt);
  }
  // mods
  const mods: Mod[] = [];
  S.mods.forEach((m) => {
    if (m.shots && !m.shots.includes(type)) return;
    if (m.needPump && !seq.some((a) => a.type === 'pump')) return;
    if (m.needScreen && !seq.some((a) => a.type === 'screen')) return;
    if (m.ifScheme && m.ifScheme !== scheme) return;
    if (m.fresh && seq.some((a) => a.actor === q.idx)) return;
    mods.push(m);
    adv += m.adv || 0;
    let v = m.pp || 0;
    if (m.ppSniper && isSniper(b.card)) v = m.ppSniper;
    if (m.ppFlyer && isFlyer(b.card)) v = m.ppFlyer;
    pp += v;
  });
  // traits
  S.court.forEach((x, i) => { if (i !== q.idx && x.card.trait === 'captain') pp += 4; });
  const t = b.card.trait;
  if (clutch(G)) { if (t === 'tattoo' || t === 'lizard') pp += 5; if (t === 'clock') pp += 10; }
  if (t === 'visor' && type === 'oop') pp += 10;
  if (ENH_SHOT[b.card.enh] === type) pp += 6;
  let devil = false;
  if (t === 'devil' && b.fat <= 2) { pp += 15; devil = true; }
  // fatigue: tired shooter loses, tired defender gives
  const dB = O.court[q.idx];
  const fatS = q.o && q.o.all99 ? 0 : b.fat, fatD = dB ? dB.fat : 0;
  pp += -FAT_PCT * fatS + FAT_DEF_PCT * fatD;
  if (b.fresh && !seq.some((a) => a.actor === q.idx)) adv += 1;
  // debuffs
  const immune = ctx.immune[q.s] || t === 'greyhp' || (t === 'lizard' && clutch(G));
  S.debuffs.forEach((d) => { if (d.shots && !d.shots.includes(type)) return; if (d.distraction && immune) return; pp += d.pp; });
  // scheme
  const ign = q.moment === 'ignore' || ctx.ignoreScheme || mods.some((m) => !!m.ignore && !!scheme && m.ignore.includes(scheme)) ||
    (!!flags.seal && seq.length > 0 && seq[seq.length - 1].type === 'iso' && (scheme === 'pack' || scheme === 'close'));
  let stopped = !ign && schemeStops(scheme, type, seq);
  if (!ign && (b.locked > 0 || ctx.momentDef)) stopped = true;
  if (stopped && type === 'three' && flags.relocate && scheme === 'close' && !q.noConvert) return chance(G, { ...q, type: 'fade', extraPP: (q.extraPP || 0) + 6, noConvert: true, converted: 'Relocate' });
  if (stopped && INSIDE.includes(type) && flags.pullup && scheme === 'pack' && !q.noConvert) return chance(G, { ...q, type: 'fade', extraPP: (q.extraPP || 0) + 12, noConvert: true, converted: 'Pull-Up' });
  const stat = shotStat(G, q.s, q.idx, type, q.o || {});
  const base = anchorP(type, stat);
  let p = base * (1 + 0.07 * Math.max(0, adv)) + pp;
  let factor = 1;
  const contest = q.contest ?? ctx.contest ?? 0;
  if (stopped) {
    let f = SHOTS[type].stopF;
    if (scheme === 'pack' && flags.halfPack) f = 1 - (1 - f) / 2;
    const d = O.court[q.idx];
    const F = ctx.momentDef ? 99 : d.card.st.F + (d.tmpF || 0);
    const df = F < 80 ? 1 + (0.15 * (80 - F)) / 20 : 1 - (0.2 * (Math.min(99, F) - 80)) / 19;
    factor = f * df;
    p *= factor;
    p -= 5 * contest;
  }
  const cap = SHOTS[type].cap;
  const capped = p >= cap;
  p = Math.max(3, Math.min(cap, p)) / 100;
  return { p, stopped, type, adv, pp, combo, mods, devil, converted: q.converted || null, stat, fatS, fatD, base, factor, capped, contest: stopped ? contest : 0 };
}

export interface ShootOpts {
  o?: ShotStatOpts;
  pts?: number;
  ignoreAll?: boolean;
  moment?: boolean;
}
export function shotPoints(G: Game, s: Side, type: ShotType, mods: Mod[], q?: ShootOpts | null): number {
  const S = G.sides[s];
  let pts = SHOTS[type].pts;
  mods.forEach((m) => { if (m.pts) pts = m.pts; });
  if (q && q.pts) pts = q.pts;
  if (type === 'three' && S.ong.monsoon && S.ong.monsoon.on) pts = Math.max(pts, 4);
  if (type === 'three' && S.ong.twoway && S.ong.twoway.armed) pts = Math.max(pts, 5);
  if (type === 'dunk' && S.ong.wear && S.ong.wear.armed) pts = Math.max(pts, 3);
  return pts;
}

// ---------- shot ----------
export function shoot(G: Game, type: ShotType, opt: ShootOpts = {}): void {
  const ctx = cx(G), s = ctx.off, S = G.sides[s], O = G.sides[ctx.def];
  if (ctx.resolved) return;
  if (type === 'oop' && !(ctx.seq.length && ctx.seq[ctx.seq.length - 1].type === 'pass') && !opt.moment) return;
  if (ctx.turnover) return endPossession(G, { turnover: true, made: false, pts: 0 });
  const idx2 = ctx.handler;
  const shooter = S.court[idx2];
  const who = s === G.human ? 'You' : 'CPU';
  if (S.ong.wear && !S.ong.wear.armed && O.court.every((b) => b.fat >= 3)) { S.ong.wear.armed = true; logp(G, 'Wear Them Down is armed: their legs are gone.', 'good'); }
  const ev: TrapEvent = { kind: 'shot', type, pp: 0, shooterIdx: idx2, blocked: false };
  const wearArmed = type === 'dunk' && !!S.ong.wear && !!S.ong.wear.armed;
  const ignoreTraps = ctx.ignoreTraps || opt.ignoreAll || wearArmed;
  if (!ignoreTraps) fireTraps(G, ev);
  ctx.pumpArmed = 0;
  if (ctx.turnover) return endPossession(G, { turnover: true, made: false, pts: 0 });
  const q: ShotQuery = { s, idx: idx2, type, scheme: ctx.scheme, extraPP: ev.pp, o: opt.o || {}, moment: opt.ignoreAll || wearArmed ? 'ignore' : null };
  let r = chance(G, q);
  if (r.stopped && shooter.card.trait === 'cyborg' && !shooter.once.cyborg) { shooter.once.cyborg = true; q.moment = 'ignore'; r = chance(G, q); logp(G, 'Cyborg Eye locks on: scheme ignored.'); }
  const finalType = r.type;
  const pts = shotPoints(G, s, finalType, r.mods, opt);
  if (r.devil) tire(G, s, idx2, 2, false);
  if (r.capped) { G.rec.perfect[s]++; logp(G, 'PERFECT LOOK! ' + SHOTS[r.type].name + ' maxed at ' + SHOTS[r.type].cap + '%.', 'good'); }
  const made = !ev.blocked && rnd() < r.p;
  r.mods.forEach((m) => { m.uses!--; });
  S.mods = S.mods.filter((m) => m.uses! > 0);
  S.debuffs.forEach((d) => { if (d.once && (!d.shots || d.shots.includes(finalType))) d.left = 0; });
  tire(G, s, idx2, 1, false);
  shooter.used = true;
  shooter.fresh = false;
  const last = ctx.seq[ctx.seq.length - 1];
  const assisted = made && !!last && last.type === 'pass';
  const rs = G.rec.shots[s];
  rs[finalType] = rs[finalType] || { a: 0, m: 0 };
  rs[finalType].a++;
  if (made) rs[finalType].m++;
  if (r.combo) G.rec.combos[r.combo] = (G.rec.combos[r.combo] || 0) + 1;
  const res: ShotResult = {
    made, pts: made ? pts : 0, p: r.p,
    br: { base: r.base, adv: r.adv, fatS: r.fatS, fatD: r.fatD, factor: r.factor, stopped: r.stopped, contest: r.contest, capped: r.capped, pp: r.pp },
    type: finalType, stopped: r.stopped, combo: r.combo, converted: r.converted, shooter: shooter.card.name, shooterId: shooter.card.id, scheme: ctx.scheme, blocked: ev.blocked,
  };
  const bd = ['base ' + Math.round(r.base) + '%'];
  if (r.adv > 0) bd.push('Advantage +' + r.adv);
  if (r.fatS) bd.push('tired −' + FAT_PCT * r.fatS + '%');
  if (r.fatD) bd.push('tired defender +' + FAT_DEF_PCT * r.fatD + '%');
  if (r.stopped) bd.push('read ×' + r.factor.toFixed(2));
  if (r.contest) bd.push('contest −' + 5 * r.contest + '%');
  if (r.capped) bd.push('capped');
  logp(G, who + ': ' + shooter.card.name + ' ' + SHOTS[finalType].name + (r.converted ? ' (' + r.converted + ')' : '') + ' — ' + Math.round(r.p * 100) + '% ' + (r.stopped ? '(read by ' + SCHEMES[ctx.scheme!] + ')' : '(open)') + (r.combo ? ' [' + r.combo + ']' : '') + ' → ' + (made ? 'BUCKET +' + pts : ev.blocked ? 'BLOCKED' : 'miss'), made ? 'good' : 'bad');
  logp(G, '   ' + bd.join(', '));
  if (made) {
    G.score[s] += pts;
    if (assisted) {
      G.rec.assists[s]++;
      if (S.cls === 'show' && !ctx.flags.gift) { ctx.flags.gift = true; draw(G, s, 1); S.bonusSt += 1; logp(G, 'Gifts: assist draws a card and +1 stamina next possession.'); }
      if (S.ong.sleigh) { S.ong.sleigh.p++; if (S.ong.sleigh.p >= 4) { S.ong.sleigh.p = 0; G.extra = s; logp(G, 'Sleigh Ride! Extra possession.', 'good'); } }
    }
    const t = shooter.card.trait;
    if (t === 'silver') S.bonusSt += 1;
    if (t === 'gold') { S.bonusSt += 1; draw(G, s, 1); }
    if (t === 'earrings' && finalType === 'dunk') draw(G, s, 1);
    if (t === 'redhp') addMod(G, s, { pp: 5, src: 'Hype' });
    if (S.ong.monsoon && finalType === 'three' && !S.ong.monsoon.on) { S.ong.monsoon.rain++; if (S.ong.monsoon.rain >= 3) { S.ong.monsoon.on = true; logp(G, 'Monsoon Season: Threes now worth 4!', 'good'); } }
    if (S.ong.twoway) { if (finalType === 'three') { if (S.ong.twoway.armed) { S.ong.twoway.armed = false; S.ong.twoway.stop = 0; S.ong.twoway.splash = 0; } else S.ong.twoway.splash++; } }
    if (S.ong.tls) {
      if (S.ong.tls.armed) { G.score[s] += 2; res.pts += 2; S.ong.tls.armed = false; S.ong.tls.got = {}; logp(G, 'Three-Level Scorer: +2 bonus!', 'good'); }
      else if (['layup', 'fade', 'three'].includes(finalType)) { S.ong.tls.got[finalType] = 1; if (Object.keys(S.ong.tls.got).length === 3) { S.ong.tls.armed = true; logp(G, 'Three-Level Scorer armed.', 'good'); } }
    }
    if (S.ong.wear && S.ong.wear.armed && finalType === 'dunk') S.ong.wear.armed = false;
    const ti = O.traps.findIndex((t2) => t2.trap === 'oppscore');
    if (ti >= 0) { const tr = O.traps.splice(ti, 1)[0]; O.burn.push(tr); G.rec.traps[tr.k] = (G.rec.traps[tr.k] || 0) + 1; logp(G, tr.fire!(G, ctx.def, {}), 'trap'); }
  } else {
    if (O.ong.twoway) O.ong.twoway.stop++;
    const t = shooter.card.trait;
    if ((t === 'goggles' && rnd() < 0.25) || (ctx.flags.boardman && rnd() < 0.5)) { G.extra = s; logp(G, 'Offensive rebound! Ball back.', 'good'); }
  }
  if (O.ong.twoway && !O.ong.twoway.armed && O.ong.twoway.stop >= 2 && O.ong.twoway.splash >= 2) { O.ong.twoway.armed = true; logp(G, 'Two-Way Player armed for the ' + (ctx.def === G.human ? 'you' : 'CPU') + ': next Three worth 5.', 'good'); }
  if (S.ong.twoway && !S.ong.twoway.armed && S.ong.twoway.stop >= 2 && S.ong.twoway.splash >= 2) { S.ong.twoway.armed = true; logp(G, 'Two-Way Player armed: next Three worth 5.', 'good'); }
  if (made) tire(G, ctx.def, idx2, 1, false);
  if (S.cls === 'bully' && ctx.seq.some((a) => a.type === 'iso')) tire(G, ctx.def, idx2, 1, true);
  S.lastShot = finalType + (made ? '+' : '-');
  S.lastAssist = assisted;
  endPossession(G, res);
}
export function endPossession(G: Game, res: ShotResult): void {
  const ctx = cx(G), s = ctx.off, S = G.sides[s], O = G.sides[ctx.def];
  if (res.turnover) {
    G.rec.turnovers[s]++;
    if (O.ong.twoway) { O.ong.twoway.stop++; if (!O.ong.twoway.armed && O.ong.twoway.stop >= 2 && O.ong.twoway.splash >= 2) { O.ong.twoway.armed = true; logp(G, 'Two-Way Player armed: next Three worth 5.', 'good'); } }
    logp(G, ctx.turnover || 'Turnover.', 'bad');
    S.lastShot = 'to';
    S.lastAssist = false;
    res = { turnover: true, made: false, pts: 0, msg: ctx.turnover || 'Turnover.' };
  }
  const sd = ctx.seq.some((a) => a.type === 'screen') && ctx.seq.some((a) => a.type === 'drive');
  S.lastSD = sd;
  if (S.ong.groove) {
    if (ctx.flags.grooveFree) S.ong.groove.free--;
    else if (sd) { S.ong.groove.beats++; if (S.ong.groove.beats >= 4) { S.ong.groove.beats = 0; S.ong.groove.free = 3; logp(G, 'Groove! Screens and Drives free for 3 possessions.', 'good'); } }
  }
  S.debuffs.forEach((d) => d.left--);
  S.debuffs = S.debuffs.filter((d) => d.left > 0);
  S.court.forEach((b) => { if (b.locked > 0) b.locked--; });
  if (S.seeScheme > 0) S.seeScheme--;
  G.rec.schemes[ctx.scheme as string] = (G.rec.schemes[ctx.scheme as string] || 0) + 1;
  ([0, 1] as Side[]).forEach((x) => { const d = G.score[other(x)] - G.score[x]; if (d > G.rec.maxDef[x]) G.rec.maxDef[x] = d; });
  ctx.resolved = true;
  ctx.result = res;
  const prev = G.extra === s;
  G.extra = -1;
  if (!prev) G.poss = other(G.poss);
  if (G.score[0] >= WIN || G.score[1] >= WIN) {
    G.over = true;
    G.winner = G.score[0] >= WIN && G.score[0] > G.score[1] ? 0 : G.score[1] >= WIN && G.score[1] > G.score[0] ? 1 : G.score[0] > G.score[1] ? 0 : 1;
  } else if (G.n >= POSS_CAP && G.score[0] !== G.score[1]) {
    G.over = true;
    G.winner = G.score[0] > G.score[1] ? 0 : 1;
  } else if (G.n >= 70) {
    G.over = true;
    G.winner = G.score[0] >= G.score[1] ? 0 : 1;
  }
}

// ---------- defense ----------
export function setDefense(G: Game, scheme: SchemeKey, contest: number): void {
  const ctx = cx(G), S = G.sides[ctx.def];
  contest = Math.max(0, Math.min(CONTEST_MAX, contest || 0, S.st));
  S.st -= contest;
  ctx.contest = contest;
  ctx.scheme = scheme;
  ctx.defLocked = true;
}
export function momentCost(G: Game, s: Side): number {
  return MOMENT_COST - (G.sides[s].court.some((b) => b.card.trait === 'goldhp') ? 2 : 0);
}
export function canMoment(G: Game, s: Side): boolean {
  const S = G.sides[s], ctx = G.ctx;
  if (!ctx || S.momentUsed || G.n < MOMENT_FROM || S.st < momentCost(G, s) || ctx.resolved) return false;
  if (S.cls === 'three') return ctx.def === s && !ctx.defLocked;
  return ctx.off === s && (S.cls === 'pnr' ? ctx.seq.length < 3 : true);
}
export function useMoment(G: Game, s: Side): boolean {
  if (!canMoment(G, s)) return false;
  const S = G.sides[s], ctx = cx(G);
  S.st -= momentCost(G, s);
  S.momentUsed = true;
  G.rec.moments[s]++;
  logp(G, 'HERO MOMENT: ' + CLASSES[S.cls].hero + ' checks in!', 'good');
  if (S.cls === 'three') { ctx.momentDef = true; return true; }
  if (S.cls === 'pnr') { act(G, s, 'screen', { free: true, adv: 5 }); [0, 1, 2].forEach((i) => tire(G, other(s), i, 1, true)); return true; }
  if (S.cls === 'splash') { shoot(G, 'three', { o: { s99: true }, pts: 4 }); return true; }
  if (S.cls === 'bully') { shoot(G, 'dunk', { o: { d99: true }, ignoreAll: true }); return true; }
  if (S.cls === 'show') { coal(G, other(s), 2); ctx.seq.push({ type: 'pass', actor: ctx.handler, adv: 1, nullified: false }); shoot(G, 'oop', { o: { p99: true }, moment: true }); return true; }
  if (S.cls === 'bucket') {
    let best: ShotType = 'three', bv = -1;
    SHOT_KEYS.forEach((t) => { if (t === 'oop') return; const v = (anchorP(t, 99) / 100) * SHOTS[t].pts; if (v > bv) { bv = v; best = t; } });
    shoot(G, best, { o: { all99: true }, ignoreAll: true });
    return true;
  }
  return false;
}
