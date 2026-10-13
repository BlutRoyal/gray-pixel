// CPU opponent and AI vs AI simulation. Plans only with the hero's two base actions; cards by simple rules.
import { ACTIONS, CLASSES, CONTEST_MAX, INSIDE, SCHEMES, SHOTS, SHOT_KEYS } from './engine';
import {
  bestReceiver, canMoment, canPlay, canSub, cardCost, chance, doSub, gassed, heroAct, newGame, playCard, setDefense, shoot, startPossession, useMoment,
} from './game';
import { ri, rnd } from './rng';
import type { ActionType, ClassKey, Game, HandCard, PlayCard, SchemeKey, SeqAction, ShotType, Side } from './types';

const other = (s: Side): Side => (1 - s) as Side;
const isPlay = (c: HandCard): c is PlayCard => c.kind !== 'baller';

export function aiDefense(G: Game, s: Side): void {
  const S = G.sides[s], oc = G.sides[other(s)].cls, weak = CLASSES[oc].weak;
  if (canMoment(G, s) && rnd() < 0.5) useMoment(G, s);
  aiSubs(G, s);
  const want = (c: PlayCard): boolean => {
    if (c.ongoing) return true;
    if (c.trap) {
      const acts = CLASSES[oc].acts as ActionType[];
      if (c.trap === 'pass') return acts.includes('pass') || rnd() < 0.3;
      if (c.trap === 'drive') return acts.includes('drive') || rnd() < 0.3;
      if (c.trap === 'screen') return acts.includes('screen') || rnd() < 0.3;
      if (c.trap === 'shot') return true;
      if (c.trap === 'ref' || c.trap === 'refdis') return rnd() < 0.5;
      return true;
    }
    if (c.ai) return c.ai(G, s);
    if (c.k === 'timeout') return S.court.reduce((a, b) => a + b.fat, 0) >= 4;
    return true;
  };
  aiPlayLoop(G, s, want);
  const pick: SchemeKey = rnd() < 0.75 ? weak[ri(2)] : (Object.keys(SCHEMES) as SchemeKey[])[ri(3)];
  setDefense(G, pick, Math.min(CONTEST_MAX, Math.max(0, S.st - 0)));
}
function aiPlayLoop(G: Game, s: Side, want: (c: PlayCard) => boolean): void {
  let guard = 0, changed = true;
  while (changed && guard++ < 12) {
    changed = false;
    const S = G.sides[s];
    const order = S.hand
      .map((c, i) => ({ c, i }))
      .filter((o): o is { c: PlayCard; i: number } => isPlay(o.c) && o.c.k !== 'coal' && !o.c.act && canPlay(G, s, o.c) && want(o.c))
      .sort((a, b) => (b.c.ongoing ? 10 : 0) - (a.c.ongoing ? 10 : 0) + (b.c.c - a.c.c) * 0.1);
    if (order.length) { playCard(G, s, order[0].i); changed = true; }
  }
  const S = G.sides[s];
  let ci: number;
  while ((ci = S.hand.findIndex((c) => isPlay(c) && c.k === 'coal')) >= 0 && canPlay(G, s, S.hand[ci])) playCard(G, s, ci);
}
function aiSubs(G: Game, s: Side): void {
  const S = G.sides[s];
  let guard = 0;
  while (canSub(G, s) && guard++ < 2) {
    let wi = -1, wv = -1;
    S.court.forEach((b, i) => { const v = b.fat * 8 - (b.card.power - 75); if (b.fat >= 4 && v > wv) { wv = v; wi = i; } });
    if (wi < 0) return;
    let bi = -1, bv = -Infinity;
    S.bench.forEach((b, i) => { const v = b.card.power - b.fat * 8; if (b.fat <= 1 && v > bv) { bv = v; bi = i; } });
    if (bi < 0) return;
    const out = S.court[wi];
    if (bv < out.card.power - out.fat * 8) return;
    doSub(G, s, wi, bi);
  }
}
interface Plan { h: number; seq: ActionType[]; type: ShotType; fin: number; prev: number; ev: number }

/** Enumerates hero-action sequences, handlers and finishers; picks the best expected points vs an unknown scheme. */
function aiPlan(G: Game, s: Side): Plan | null {
  const S = G.sides[s], ctx = G.ctx!, acts = CLASSES[S.cls].acts.slice() as ActionType[];
  const seqs: ActionType[][] = [[]];
  acts.forEach((a) => seqs.push([a]));
  acts.forEach((a) => acts.forEach((b) => seqs.push([a, b])));
  acts.forEach((a) => acts.forEach((b) => acts.forEach((c) => seqs.push([a, b, c]))));
  const dist: Partial<Record<SchemeKey, number>> = S.seeScheme > 0 && ctx.scheme ? { [ctx.scheme]: 1 } : { pack: 1 / 3, close: 1 / 3, deny: 1 / 3 };
  let best: Plan | null = null, bv = -1;
  for (let h = 0; h < 3; h++) for (const sq of seqs) {
    if (sq.includes('iso') && sq.indexOf('pass') >= 0 && sq.indexOf('pass') < sq.lastIndexOf('iso')) continue;
    if (sq.filter((x) => x === 'pump').length > 1) continue;
    if (gassed(S.court[h])) continue;
    let cost = 0;
    sq.forEach((a, j) => { let k = ACTIONS[a].cost; if ((a === 'screen' || a === 'drive') && ctx.flags.grooveFree) k = 0; if (j === 0 && ctx.press) k += 2; cost += k; });
    if (cost > S.st) continue;
    let hd = h, prev = -1;
    const fake: SeqAction[] = [];
    sq.forEach((a) => { fake.push({ type: a, actor: hd, adv: ACTIONS[a].adv + (a === 'pump' && S.cls === 'bucket' ? 1 : 0), nullified: false }); if (a === 'pass') { prev = hd; hd = -2; } });
    for (const type of SHOT_KEYS) {
      if (type === 'oop' && sq[sq.length - 1] !== 'pass') continue;
      const cands = hd === -2 ? [0, 1, 2].filter((i) => i !== prev && !gassed(S.court[i])) : [hd];
      for (const fin of cands) {
        let add = 0;
        fake.forEach((x) => { if (x.actor === fin && x.type !== 'screen') add += x.type === 'iso' ? 2 : 1; });
        const fb = S.court[fin], f0 = fb.fat;
        fb.fat = Math.min(5, f0 + add);
        let ev = 0;
        for (const sc in dist) {
          const r = chance(G, { s, idx: fin, type, scheme: sc as SchemeKey, seq: fake, o: { passer: prev } });
          ev += dist[sc as SchemeKey]! * r.p * SHOTS[type].pts;
        }
        fb.fat = f0;
        ev -= cost * 0.02 + fake.filter((a) => ['pass', 'drive', 'screen'].includes(a.type)).length * G.sides[other(s)].traps.length * 0.04;
        if (ev > bv) { bv = ev; best = { h, seq: sq, type, fin, prev, ev }; }
      }
    }
  }
  return best;
}

const BOOST: Record<string, ShotType[] | 'any' | null> = {
  corner_three: ['three'], lob_it: ['oop'], up_under: ['layup'], step_back: ['fade', 'three'], midrange: ['fade'], roll_man: ['dunk', 'oop'], corner_spec: ['three'], logo_shot: ['three'],
  jobs: null, anything_possible: null, cancun: null, backdoor: 'any', relocate: ['three'], pull_up: INSIDE, through_contact: INSIDE, blow_by: ['dunk', 'layup'], seal: 'any',
  attack_co: 'any', spot_up: ['three'], short_roll: ['three'], slip: 'any', board_man: 'any', post_up: 'any',
};
const UTILITY = ['fun_guy', 'timeout', 'film_session', 'spilled_soda', 'hydrate', 'stocking', 'remix', 'hot_hand', 'bang_bodies', 'heckler', 'press', 'get_buckets'];

export function aiOffense(G: Game, s: Side): void {
  const S = G.sides[s], ctx = G.ctx!;
  if (canMoment(G, s) && (rnd() < 0.35 || (Math.abs(G.score[0] - G.score[1]) < 4 && G.score[s] >= 14))) { useMoment(G, s); if (ctx.resolved) return; }
  aiSubs(G, s);
  aiPlayLoop(G, s, (c) => { if (c.ongoing) return true; if (c.ph === 'def') return false; if (UTILITY.includes(c.k)) return c.ai ? c.ai(G, s) : S.st >= cardCost(G, s, c) + 1; return false; });
  const plan = aiPlan(G, s);
  if (!plan) { shoot(G, 'three'); return; }
  ctx.handler = plan.h;
  const planCost = plan.seq.reduce((a, x) => a + ACTIONS[x].cost, 0);
  aiPlayLoop(G, s, (c) => {
    if (!(c.k in BOOST)) return false;
    const b = BOOST[c.k];
    if (S.st - cardCost(G, s, c) < planCost) return false;
    return b === null || b === 'any' ? true : b.includes(plan.type);
  });
  plan.seq.forEach((a, j) => {
    if (ctx.turnover || ctx.resolved) return;
    const remaining = plan.seq.slice(j + 1).reduce((x, y) => x + ACTIONS[y].cost, 0);
    const emp = G.sides[s].st - ACTIONS[a].cost - 1 >= remaining;
    if (a === 'pass') heroAct(G, s, 'pass', ctx.handler === plan.fin ? bestReceiver(G, s, ctx.handler) : plan.fin, emp);
    else heroAct(G, s, a, undefined, emp);
  });
  if (!ctx.turnover) {
    const S2 = G.sides[s];
    for (let i = 0; i < S2.hand.length; i++) {
      const c = S2.hand[i];
      if (!isPlay(c) || !c.act || !canPlay(G, s, c)) continue;
      const good = c.act === 'screen' || c.act === 'pump' || (c.act === 'drive' && ['dunk', 'layup'].includes(plan.type));
      if (good && ctx.seq.length < 3) { playCard(G, s, i); i = -1; if (ctx.turnover) break; }
    }
  }
  if (!ctx.turnover) aiPlayLoop(G, s, (c) => c.k === 'anything_possible' || c.k === 'cancun' || c.k === 'jobs');
  let type = plan.type;
  if (type === 'oop' && !(ctx.seq.length && ctx.seq[ctx.seq.length - 1].type === 'pass')) type = 'layup';
  shoot(G, type);
}
export function aiPossession(G: Game): void {
  startPossession(G);
  const off = G.ctx!.off;
  aiDefense(G, other(off));
  if (!G.ctx!.resolved) aiOffense(G, off);
}
export function simGame(c0: ClassKey, c1: ClassKey, s0?: 'stars' | 'deep', s1?: 'stars' | 'deep'): Game {
  const g = newGame(c0, c1, { human: -1, strat0: s0, strat1: s1 });
  while (!g.over) aiPossession(g);
  return g;
}
