// Aggregates AI vs AI games into the balance report (class win rates, matchups, shots, card lift).
import { CARD_BY_KEY } from './cards';
import { CLS_KEYS, SHOTS } from './engine';
import { simGame } from './ai';
import type { ClassKey, Game, ShotType } from './types';

type WG = { w: number; g: number };
export interface SimReport {
  version: string;
  ts: number;
  perMatchup: number;
  games: number;
  poss: number;
  cls: Record<ClassKey, WG>;
  mat: Record<ClassKey, Record<ClassKey, WG>>;
  shots: Record<string, { a: number; m: number }>;
  turnovers: number;
  assists: number;
  subs: number;
  perfect: number;
  emptyDeck: number;
  strat: Record<string, WG>;
  lift: Record<string, { p: number; wp: number; wn: number; lift: number; cond: number }>;
}
type SideRow = [ClassKey, number, number, string[]];

export function emptyReport(perMatchup: number): SimReport & { side: SideRow[] } {
  const cls = {} as SimReport['cls'], mat = {} as SimReport['mat'];
  CLS_KEYS.forEach((k) => { cls[k] = { w: 0, g: 0 }; mat[k] = {} as Record<ClassKey, WG>; CLS_KEYS.forEach((j) => (mat[k][j] = { w: 0, g: 0 })); });
  return { version: '0.8', ts: Date.now(), perMatchup, games: 0, poss: 0, cls, mat, shots: {}, turnovers: 0, assists: 0, subs: 0, perfect: 0, emptyDeck: 0, strat: {}, lift: {}, side: [] };
}
export function addGame(a: ReturnType<typeof emptyReport>, g: Game): void {
  a.games++;
  a.poss += g.n;
  if (g.sides[0].deck.length === 0 || g.sides[1].deck.length === 0) a.emptyDeck++;
  const c = g.rec.cls;
  ([0, 1] as const).forEach((s) => {
    const won = g.winner === s, me = c[s], them = c[1 - s];
    a.cls[me].g++; if (won) a.cls[me].w++;
    a.mat[me][them].g++; if (won) a.mat[me][them].w++;
    Object.entries(g.rec.shots[s]).forEach(([t, v]) => { a.shots[t] = a.shots[t] || { a: 0, m: 0 }; a.shots[t].a += v.a; a.shots[t].m += v.m; });
    a.turnovers += g.rec.turnovers[s]; a.assists += g.rec.assists[s]; a.subs += g.rec.subs[s]; a.perfect += g.rec.perfect[s];
    const sg = g.rec.strat[s];
    if (sg) { a.strat[sg] = a.strat[sg] || { w: 0, g: 0 }; a.strat[sg].g++; if (won) a.strat[sg].w++; }
    a.side.push([me, won ? 1 : 0, g.rec.maxDef[s], Object.keys(g.rec.plays[s])]);
  });
}
const COMEBACK_T: Record<string, number> = { anything_possible: 8, cancun: 10, press: 6 };
/** Card lift = class win rate when played minus when not played, within the same class. */
export function computeLift(rows: SideRow[]): SimReport['lift'] {
  const out: SimReport['lift'] = {};
  const keys = new Set<string>();
  rows.forEach((r) => r[3].forEach((k) => keys.add(k)));
  keys.forEach((k) => {
    if (k === 'sub' || k === 'coal') return;
    const d = CARD_BY_KEY[k];
    if (!d) return;
    const t = COMEBACK_T[k] || 0;
    const pool = rows.filter((r) => (!d.cls || r[0] === d.cls) && r[2] >= t);
    const P = pool.filter((r) => r[3].includes(k)), N = pool.filter((r) => !r[3].includes(k));
    if (P.length < 10 || N.length < 10) return;
    const wp = P.reduce((x, r) => x + r[1], 0) / P.length, wn = N.reduce((x, r) => x + r[1], 0) / N.length;
    out[k] = { p: P.length, wp: Math.round(wp * 100), wn: Math.round(wn * 100), lift: Math.round((wp - wn) * 100), cond: t };
  });
  return out;
}
export function finishReport(a: ReturnType<typeof emptyReport>): SimReport {
  const { side, ...rest } = a;
  return { ...rest, lift: computeLift(side) };
}
/** Full round robin: every class plays every other class n times from each seat. Calls onPair between matchups. */
export async function roundRobin(n: number, onPair?: (done: number, total: number) => void | Promise<void>): Promise<SimReport> {
  const agg = emptyReport(n);
  const pairs: [ClassKey, ClassKey][] = [];
  CLS_KEYS.forEach((a) => CLS_KEYS.forEach((b) => { if (a !== b) pairs.push([a, b]); }));
  let done = 0;
  for (const [x, y] of pairs) {
    for (let i = 0; i < n; i++) { addGame(agg, simGame(x, y)); done++; }
    if (onPair) await onPair(done, pairs.length * n);
  }
  return finishReport(agg);
}
export const pct = (w: number, g: number): number => (g ? Math.round((w / g) * 100) : 0);
export const ppa = (t: string, v: { a: number; m: number }): number => (v.a ? (v.m / v.a) * SHOTS[t as ShotType].pts : 0);
