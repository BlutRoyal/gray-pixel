// Post-game box score. DOM-free: the engine keeps a small recorder on the game (`G.box`: card plays, subs, specials, Momentum flow, fatigue peaks)
// and `buildBox` turns that plus the shot history (`G.hist`) into per-Baller and per-team lines.
import type { CGame, CBaller, Outcome, Side } from './engine';
import { ZONES, type Zone } from './skills';

export interface BoxRec {
  plays: { n: number; side: Side; name: string; role: 'off' | 'def' | 'trap' }[];
  subs: { n: number; side: Side; inId: number; outId: number }[];
  sp: { n: number; side: Side; id: number; name: string; holo: boolean }[];
  /** Momentum flow per side: gained and lost (spent, drained or burnt by a Clutch), measured between sync points. */
  mo: [{ gain: number; loss: number; last: number }, { gain: number; loss: number; last: number }];
  /** Highest fatigue penalty (percent points) a Baller had on court, by card id. */
  fat: Record<number, number>;
}
export const blankBox = (): BoxRec => ({ plays: [], subs: [], sp: [], mo: [{ gain: 0, loss: 0, last: -1 }, { gain: 0, loss: 0, last: -1 }], fat: {} });
/** Reads both Momentum bars and books the change since the last call. Called before anything that spends or earns Momentum. */
export function moSync(G: CGame): void {
  const R = G.box;
  if (!R) return;
  for (const s of [0, 1] as const) {
    const m = R.mo[s], now = G.sides[s].mo;
    if (m.last >= 0) { if (now > m.last) m.gain += now - m.last; else if (now < m.last) m.loss += m.last - now; }
    m.last = now;
  }
}
/** A refund (a double team taken back) is not income: move the marker without booking it. */
export function moRefund(G: CGame, s: Side, n: number): void { if (G.box && G.box.mo[s].last >= 0) G.box.mo[s].last += n; }

export interface ZoneLine { att: number; made: number }
export interface BallerBox {
  id: number; name: string; pos: string; side: Side; holo: boolean;
  att: number; made: number; pts: number; zones: Record<Zone, ZoneLine>;
  ast: number; blkCaused: number; blkSuffered: number; stlCaused: number; stlSuffered: number; tov: number;
  doubled: number; fatPeak: number; subIn: number; subOut: number; special: string | null; specialN: number | null; score: number;
}
export interface CardLine { name: string; played: number; worked: number }
export interface TeamBox {
  side: Side; pts: number; att: number; made: number; zones: Record<Zone, ZoneLine>; tov: number; moGain: number; moSpent: number;
  cards: CardLine[]; cardsPlayed: number; trapsSet: number; trapsFired: number;
  /** Their shots against your scheme: guessed right (read) vs not. */
  readsHit: number; readsMissed: number; guessed: number; schemes: { name: string; n: number }[];
  andOnes: number; glitched: number; clutchTaken: number; clutchMade: number; longestRun: number; subs: number; specials: number;
}
export interface BoxScore { n: number; winner: Side | null; teams: [TeamBox, TeamBox]; ballers: [BallerBox[], BallerBox[]]; mvp: BallerBox | null; scoreline: [number, number] }

const z0 = (): Record<Zone, ZoneLine> => ({ rim: { att: 0, made: 0 }, mid: { att: 0, made: 0 }, three: { att: 0, made: 0 } });
export const pct = (m: number, a: number): number => (a ? Math.round((m / a) * 100) : 0);
const SCHEME: Record<Zone, string> = { rim: 'Pack the Paint', mid: 'Drop', three: 'Close Out' };

export function buildBox(G: CGame): BoxScore {
  moSync(G);
  const R = G.box ?? blankBox();
  const by = new Map<number, BallerBox>();
  const roster = (s: Side): CBaller[] => G.sides[s].team.concat(G.sides[s].bench);
  const ballers: [BallerBox[], BallerBox[]] = [[], []];
  for (const s of [0, 1] as const) for (const b of roster(s)) {
    const spn = R.sp.find((x) => x.side === s && x.id === b.id);
    const row: BallerBox = {
      id: b.id, name: b.name, pos: b.pos, side: s, holo: !!b.holo, att: 0, made: 0, pts: 0, zones: z0(), ast: 0, blkCaused: 0, blkSuffered: 0, stlCaused: 0, stlSuffered: 0, tov: 0,
      doubled: 0, fatPeak: R.fat[b.id] || 0, subIn: 0, subOut: 0, special: b.special ? b.special.name : null, specialN: spn ? spn.n : null, score: 0,
    };
    ballers[s].push(row); by.set(s * 1e6 + b.id, row);
  }
  const row = (s: Side, id: number | undefined): BallerBox | undefined => (id == null ? undefined : by.get(s * 1e6 + id));
  const teams: [TeamBox, TeamBox] = [0, 1].map((s) => ({
    side: s as Side, pts: G.sides[s].score, att: 0, made: 0, zones: z0(), tov: 0, moGain: R.mo[s as Side].gain, moSpent: R.mo[s as Side].loss, cards: [], cardsPlayed: 0, trapsSet: 0, trapsFired: 0,
    readsHit: 0, readsMissed: 0, guessed: 0, schemes: [], andOnes: 0, glitched: 0, clutchTaken: 0, clutchMade: 0, longestRun: 0, subs: 0, specials: R.sp.filter((x) => x.side === s).length,
  })) as unknown as [TeamBox, TeamBox];
  const schemeN: [Record<string, number>, Record<string, number>] = [{}, {}];
  const runs = [0, 0];
  for (const h of G.hist) {
    const o: Outcome = h.outcome, s = o.side, d = (1 - s) as Side, T = teams[s], D = teams[d];
    const made = o.made && !o.rewound;  // a Rewind takes the basket off the board
    const sh = row(s, o.shooterId), df = row(d, o.defenderId);
    if (o.guard) { const nm = SCHEME[o.guard]; schemeN[d][nm] = (schemeN[d][nm] || 0) + 1; }
    if (o.dtMarkId != null) { const m = row(s, o.dtMarkId); if (m) m.doubled++; }
    if (o.turnover) {
      T.tov++;
      if (sh) sh.tov++;
      if (/stolen/.test(o.turnover) && df) { df.stlCaused++; if (sh) sh.stlSuffered++; }
    } else {
      const forked = !!(o.fork && made && o.putback), fk = forked ? row(s, o.fork!.id) : undefined;
      // the first shot is a miss when a Fork basket followed; the second shooter gets his own attempt and the points
      T.att++; T.zones[o.zone].att++;
      if (sh) { sh.att++; sh.zones[o.zone].att++; }
      if (forked) {
        T.att++; T.zones[o.fork!.zone].att++; T.made++; T.zones[o.fork!.zone].made++;
        if (fk) { fk.att++; fk.made++; fk.pts += o.pts; fk.zones[o.fork!.zone].att++; fk.zones[o.fork!.zone].made++; }
      } else if (made) {
        T.made++; T.zones[o.zone].made++;
        if (sh) { sh.made++; sh.pts += o.pts; sh.zones[o.zone].made++; }
        if (o.passerId != null) { const a = row(s, o.passerId); if (a) a.ast++; }
      }
      if (made) { if (o.andOne) T.andOnes++; if (o.label) T.glitched++; }
      else if (o.blocked && df) { df.blkCaused++; if (sh) sh.blkSuffered++; }
      if (o.guard) { if (o.read) { D.guessed++; T.readsHit++; } else T.readsMissed++; }
    }
    if (o.clutch) { T.clutchTaken++; if (made) T.clutchMade++; }
    D.trapsFired += o.traps.length;
    if (made) { runs[s] += o.pts; runs[d] = 0; if (runs[s] > T.longestRun) T.longestRun = runs[s]; }
  }
  for (const s of [0, 1] as const) {
    teams[s].trapsSet = R.plays.filter((p) => p.side === s && p.role === 'trap').length;
    teams[s].subs = R.subs.filter((x) => x.side === s).length;
    teams[s].schemes = Object.entries(schemeN[s]).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n);
    const byName = new Map<string, CardLine>();
    for (const p of R.plays.filter((x) => x.side === s)) {
      const o = G.hist.find((h) => h.n === p.n)?.outcome;
      let worked = false;
      if (p.role === 'trap') worked = G.hist.some((h) => h.outcome.side !== s && h.outcome.traps.some((t) => t.name === p.name));
      else if (o) worked = p.role === 'off' ? o.made && !o.rewound : !(o.made && !o.rewound);
      const c = byName.get(p.name) || { name: p.name, played: 0, worked: 0 };
      c.played++; if (worked) c.worked++;
      byName.set(p.name, c);
    }
    teams[s].cards = [...byName.values()].sort((a, b) => b.played - a.played || a.name.localeCompare(b.name));
    teams[s].cardsPlayed = R.plays.filter((x) => x.side === s).length;
  }
  for (const x of R.subs) { const i = row(x.side, x.inId), o = row(x.side, x.outId); if (i) i.subIn++; if (o) o.subOut++; }
  for (const s of [0, 1] as const) for (const b of ballers[s]) b.score = b.pts + b.ast * 1.2 + b.stlCaused * 1.5 + b.blkCaused * 1.5 + (b.att ? b.made * 0.3 - (b.att - b.made) * 0.35 : 0) - b.tov;
  const pool = G.winner != null ? ballers[G.winner] : ballers[0].concat(ballers[1]);
  const mvp = pool.filter((b) => b.att || b.ast || b.stlCaused || b.blkCaused).sort((a, b) => b.score - a.score)[0] || null;
  return { n: G.n, winner: G.winner, teams, ballers, mvp, scoreline: [G.sides[0].score, G.sides[1].score] };
}
export { ZONES };
