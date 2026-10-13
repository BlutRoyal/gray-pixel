// Balance check for the v2 rules: coach vs coach, zone and usage stats, and a "typical player" against each story stage.
// npx tsx tools/csim.ts [gamesPerPair]
import catalogJson from '../src/data/catalog.json';
import { CLS_KEYS, loadCatalog, rnd, seedRng, type Catalog } from '../src/rules';
import { ballersOfTier } from '../src/rules';
import { ZONES, bandTeam, buildDeck, cpuDeck, newSide, simGame, starterIds, equip, cBaller, validateDeck, canAdd, type AiSkill, type CGame, type CSide, type Zone } from '../src/casual/engine';
import { STAGES, cpuSide } from '../src/casual/story';
import { importTuning, TUNING as T } from '../src/casual/tuning';
import { allCards, ccard } from '../src/casual/cards';

loadCatalog(catalogJson as unknown as Catalog);
if (process.env.BDL_TUNE) console.log('tuning overrides:', importTuning(process.env.BDL_TUNE), 'values');
seedRng(12345);
const N = +(process.argv[2] || 60);
// npx tsx tools/csim.ts 60 story  -> only the story ladder; 'coach' -> only coach vs coach; 'cards' -> only card lift
const MODE = process.argv[3] || 'all';
const want = (m: string) => MODE === 'all' || MODE === m;
const mid: AiSkill = { smart: 0.7, sigma: 0.11 };

const pc = (a: number, b: number) => (b ? (a / b * 100).toFixed(0) + '%' : '-');
const f1 = (x: number) => x.toFixed(1);
interface Agg {
  games: number; poss: number; margin: number; shots: number; made: number; tov: number; clutch: number; subs: number; dts: number; traps: number; hard: number; isos: number; cards: number; mo: number;
  zShots: Record<Zone, number>; zMade: Record<Zone, number>; zWin: Record<Zone, { w: number; g: number }>;
  labels: Record<string, number>; inhuman: number; blocked: number; maxShare: number; topWin: { w: number; g: number }; fireOn: number; fatigued: number;
  andOne: number; perfect: number; capped: number; long: number; assist: number; heave: number; overclock: number; open: number; dtShots: number; dtMade: number; close: number;
}
const z3 = <T>(f: () => T): Record<Zone, T> => ({ rim: f(), mid: f(), three: f() });
const newAgg = (): Agg => ({ games: 0, poss: 0, margin: 0, shots: 0, made: 0, tov: 0, clutch: 0, subs: 0, dts: 0, traps: 0, hard: 0, isos: 0, cards: 0, mo: 0, zShots: z3(() => 0), zMade: z3(() => 0), zWin: z3(() => ({ w: 0, g: 0 })),
  labels: {}, andOne: 0, inhuman: 0, blocked: 0, maxShare: 0, topWin: { w: 0, g: 0 }, fireOn: 0, fatigued: 0, perfect: 0, capped: 0, long: 0, assist: 0, heave: 0, overclock: 0, open: 0, dtShots: 0, dtMade: 0, close: 0 });
function tally(a: Agg, G: CGame, sides: CSide[]): void {
  a.games++; a.poss += G.n; if (G.n >= 70) a.capped++; if (G.n >= 55) a.long++; a.margin += Math.abs(G.sides[0].score - G.sides[1].score);
  if (Math.abs(G.sides[0].score - G.sides[1].score) <= 3) a.close++;
  for (const h of G.hist) {
    const o = h.outcome;
    if (o.turnover) { a.tov++; continue; }
    a.shots++; a.zShots[o.zone]++; if (o.made) { a.made++; a.zMade[o.zone]++; if (o.label) a.labels[o.label] = (a.labels[o.label] || 0) + 1; if (o.inhuman) a.inhuman++; if (o.andOne) a.andOne++; }
    if (o.blocked) a.blocked++;
    if (o.fireOn) a.fireOn++;
    if (o.dt) { a.dtShots++; if (o.made) a.dtMade++; }
    if (o.passer != null) a.assist++;
    if (o.offCard === 'Heave') a.heave++;
    if (o.offCard === 'Overclock') a.overclock++;
  }
  for (const side of [0, 1] as const) {
    const S = G.sides[side];
    a.clutch += S.clutches; a.subs += S.stats.subs; a.dts += S.stats.dts; a.traps += S.stats.trapsFired; a.hard += S.stats.hard; a.isos += S.stats.isos; a.cards += S.stats.cards; a.mo += S.stats.momentumSpent;
    const won = G.winner === side;
    const mine = G.hist.filter((h) => h.side === side && !h.outcome.turnover);
    if (mine.length) {
      const cnt: Record<string, number> = {};
      for (const h of mine) cnt[h.outcome.shooterId] = (cnt[h.outcome.shooterId] || 0) + 1;
      const mx = Math.max(...Object.values(cnt));
      a.maxShare += mx / mine.length;
      const zc = ZONES.map((z) => [z, mine.filter((h) => h.outcome.zone === z).length] as const).sort((x, y) => y[1] - x[1]);
      a.zWin[zc[0][0]].g++; if (won) a.zWin[zc[0][0]].w++;
    }
  }
  void sides;
}
function report(a: Agg, title: string): void {
  console.log(`\n== ${title}`);
  console.log(`${a.games} games · ${f1(a.poss / a.games)} possessions = ${f1(a.poss / a.games / 2)} per team (cap hit ${pc(a.capped, a.games)}, 55+ ${pc(a.long, a.games)}) · margin ${f1(a.margin / a.games)} · close (<=3) ${pc(a.close, a.games)}`);
  console.log(`make ${pc(a.made, a.shots)} · turnovers ${pc(a.tov, a.shots + a.tov)} of possessions · assisted ${pc(a.assist, a.shots)}`);
  console.log('zone share/make: ' + ZONES.map((z) => `${z} ${pc(a.zShots[z], a.shots)}/${pc(a.zMade[z], a.zShots[z])}`).join(' · '));
  console.log('win rate of teams whose main zone is: ' + ZONES.map((z) => `${z} ${pc(a.zWin[z].w, a.zWin[z].g)} (n=${a.zWin[z].g})`).join(' · '));
  const g = a.games * 2;
  console.log(`per team per game: subs ${f1(a.subs / g)} · double teams ${f1(a.dts / g)} · traps fired ${f1(a.traps / g)} (hard ${f1(a.hard / g)}) · Iso ${f1(a.isos / g)} · cards ${f1(a.cards / g)} · Momentum spent ${f1(a.mo / g)} · Clutch ${f1(a.clutch / g)} · Heave ${f1(a.heave / g)} · Overclock ${f1(a.overclock / g)}`);
  console.log(`shots under a double team ${pc(a.dtShots, a.shots)} (make ${pc(a.dtMade, a.dtShots)}) · top shooter takes ${pc(a.maxShare, g)} of a team's shots · blocked ${pc(a.blocked, a.shots)}`);
  console.log(`AND ONE: ${f1(a.andOne / a.games)} per game = ${pc(a.andOne, a.zMade.rim)} of made Rim shots`);
  console.log(`low-chance makes per 100 games: ${Object.entries(a.labels).map(([k, v]) => `${k} ${f1(v / a.games * 100)}`).join(' · ') || 'none'} · INHUMAN (<=1%) ${f1(a.inhuman / a.games * 100)} · On Fire starts per game ${f1(a.fireOn / a.games)}`);
}

// Specials: every squad swaps one Baller for a random Iconic (20% HOLO), so a special is in play in almost every game.
// npx tsx tools/csim.ts 60 specials  -> coach vs coach with specials, usage per game; BDL_TUNE='{"spOn":0}' runs the same games with specials off.
const iconics = ballersOfTier('iconic');
const withIconic = (team: ReturnType<typeof bandTeam>): ReturnType<typeof bandTeam> => { const t = team.slice(0, 4); t.push(cBaller(iconics[Math.floor(rnd() * iconics.length)], null, 1, rnd() < 0.2)); return t; };
if (want('specials')) {
  const w: Record<string, { w: number; g: number }> = {};
  for (const a of CLS_KEYS) w[a] = { w: 0, g: 0 };
  const all = newAgg();
  let used = 0, sides = 0, usedEarly = 0, games = 0;
  const byType: Record<string, number> = {};
  for (const a of CLS_KEYS) for (const b of CLS_KEYS) {
    if (a === b) continue;
    for (let i = 0; i < N; i++) {
      const A = newSide(a, withIconic(bandTeam(0.4, 0.7)), cpuDeck(a, 0.5)), B = newSide(b, withIconic(bandTeam(0.4, 0.7)), cpuDeck(b, 0.5));
      const G = simGame(A, B, [mid, mid]);
      w[a].g++; w[b].g++; w[G.winner === 0 ? a : b].w++;
      tally(all, G, [A, B]);
      games++;
      for (const S of G.sides) for (const x of [...S.team, ...S.bench]) if (x.special) { sides++; if (x.spUsed) { used++; byType[x.special.type] = (byType[x.special.type] || 0) + 1; } }
    }
  }
  report(all, `Coach vs coach with one Iconic per squad (specials ${T.spOn ? 'ON' : 'OFF'})`);
  console.log('coach win rates: ' + CLS_KEYS.map((k) => `${k} ${pc(w[k].w, w[k].g)}`).join(' · '));
  console.log(`specials used in ${pc(used, sides)} of ${sides} Iconic appearances (${f1(used / games)} per game); by type: ${Object.entries(byType).map(([k, v]) => `${k} ${v}`).join(' ')}`);
}
// Iconic lift: the same squad with the Iconic in the fifth slot against that squad with a random Legendary there (mirror coach and deck, sides alternate).
// npx tsx tools/csim.ts 40 iconic ; compare BDL_TUNE='{"icPassive":1}' (old: passive + special) with the default (special only).
if (want('iconic')) {
  seedRng(777);
  const legs = ballersOfTier('legendary'), byT: Record<string, { w: number; g: number }> = {}, byH = { h: { w: 0, g: 0 }, n: { w: 0, g: 0 } };
  let W = 0, Gm = 0;
  for (const c of CLS_KEYS) for (let i = 0; i < N * 4; i++) {
    const base = bandTeam(0.4, 0.7, c).slice(0, 4), holo = rnd() < 0.2;
    const ic = cBaller(iconics[Math.floor(rnd() * iconics.length)], null, 1, holo), lg = cBaller(legs[Math.floor(rnd() * legs.length)], null, 1, false);
    const mk = (x: ReturnType<typeof cBaller>) => newSide(c, [...base.map((b) => cBaller(b.id, b.sneakerId)), x], cpuDeck(c, 0.5));
    const flip = i % 2 === 1, A = mk(ic), B = mk(lg);
    const G = flip ? simGame(B, A, [mid, mid]) : simGame(A, B, [mid, mid]);
    const won = (G.winner === 0) !== flip;
    Gm++; if (won) W++;
    const t = ic.special!.type; (byT[t] ||= { w: 0, g: 0 }).g++; if (won) byT[t].w++;
    const h = holo ? byH.h : byH.n; h.g++; if (won) h.w++;
  }
  console.log(`\nIconic lift (passive ${T.icPassive ? 'ON' : 'OFF'}, spScale ${T.spScale}, off ${T.spOff} def ${T.spDef} util ${T.spUtil}): ${pc(W, Gm)} win rate of the squad with the Iconic (n=${Gm}); normal ${pc(byH.n.w, byH.n.g)} · HOLO ${pc(byH.h.w, byH.h.g)}`);
  console.log('by special type: ' + Object.entries(byT).sort().map(([k, v]) => `${k} ${pc(v.w, v.g)}`).join(' · '));
}
const win: Record<string, { w: number; g: number }> = {};
if (want('coach')) {
for (const a of CLS_KEYS) win[a] = { w: 0, g: 0 };
const all = newAgg();
for (const a of CLS_KEYS) for (const b of CLS_KEYS) {
  if (a === b) continue;
  for (let i = 0; i < N; i++) {
    const A = newSide(a, bandTeam(0.4, 0.7), cpuDeck(a, 0.5)), B = newSide(b, bandTeam(0.4, 0.7), cpuDeck(b, 0.5));
    if (i === 0 && validateDeck(A.deck).length) throw new Error('bad cpu deck ' + validateDeck(A.deck).join(' '));
    const G = simGame(A, B, [mid, mid]);
    win[a].g++; win[b].g++; win[G.winner === 0 ? a : b].w++;
    tally(all, G, [A, B]);
  }
}
report(all, 'Coach vs coach (mid band, level .5)');
console.log('coach win rates: ' + CLS_KEYS.map((k) => `${k} ${pc(win[k].w, win[k].g)}`).join(' · '));

// seat advantage and skill gap
let first = 0, gg = 0;
for (let i = 0; i < N * 6; i++) { const G = simGame(newSide('splash', bandTeam(0.4, 0.7), cpuDeck('splash', 0.5)), newSide('splash', bandTeam(0.4, 0.7), cpuDeck('splash', 0.5)), [mid, mid]); gg++; if (G.winner === 0) first++; }
console.log(`seat A (not necessarily first ball) wins ${pc(first, gg)} in mirror games`);
let smartW = 0;
for (let i = 0; i < N * 6; i++) { const G = simGame(newSide('splash', bandTeam(0.4, 0.7), cpuDeck('splash', 0.5)), newSide('splash', bandTeam(0.4, 0.7), cpuDeck('splash', 0.5)), [{ smart: 0.95, sigma: 0.08 }, { smart: 0.25, sigma: 0.2 }]); if (G.winner === 0) smartW++; }
console.log(`smart AI (.95) beats dumb AI (.25) in ${pc(smartW, N * 6)} of mirror games`);
// strength gap: strong band vs weak band
let strongW = 0;
for (let i = 0; i < N * 4; i++) { const G = simGame(newSide('splash', bandTeam(0.75, 0.95), cpuDeck('splash', 0.5)), newSide('splash', bandTeam(0.1, 0.4), cpuDeck('splash', 0.5)), [mid, mid]); if (G.winner === 0) strongW++; }
console.log(`top-band squad beats low-band squad in ${pc(strongW, N * 4)}`);
}

// a strong (unlocked) squad: top-band Ballerz with Sneakerz, levelled to 5, and a good deck
const strongSquad = () => { const t = bandTeam(0.88, 1).map((b) => cBaller(b.id, b.sneakerId, 5)); return process.env.BDL_ICONIC ? [...t.slice(0, 4), cBaller(iconics[Math.floor(rnd() * iconics.length)], t[4].sneakerId, 5, rnd() < 0.2)] : t; };
// a fresh player (starter Ballerz + starter deck, decent decisions) against each stage
if (want('story')) {
const player: AiSkill = { smart: 0.75, sigma: 0.1 };
console.log('\nStarter squad vs story stages (and a strong squad):');
const st1 = newAgg();
for (const st of STAGES) {
  let w = 0, w2 = 0;
  for (let i = 0; i < N * 2; i++) {
    const me = newSide('splash', equip(starterIds(), []), buildDeck({}, 'splash'));
    const G = simGame(me, cpuSide(st), [player, st.skill]);
    if (G.winner === 0) w++;
    tally(st1, G, []);
    const pro = newSide('splash', strongSquad(), cpuDeck('splash', 0.95));
    if (simGame(pro, cpuSide(st), [player, st.skill]).winner === 0) w2++;
  }
  console.log(st.name.padEnd(18), pc(w, N * 2), ' strong:', pc(w2, N * 2));
}
report(st1, 'Starter squad story games');
}

// Card lift: a deck with the card (2 copies, 1 for Iconic) against the same kind of deck without it, 50% means no edge.
if (want('cards')) {
console.log('\nCard lift (mirror games, mid band): win rate of the side that has the card in its deck');
const spot = ['iso', 'four_point', 'bad_shot', 'heave', 'overclock', 'pick_pocket', 'passing_lane', 'shot_clock', 'block_party', 'shutdown', 'trap_sense', 'send_help', 'swing_pass', 'kick_out', 'hand_off', 'skip_pass', 'lockdown', 'take_charge', 'elbow_jumper', 'anything_possible', 'monsoon'];
for (const k of spot) {
  const c = ccard(k)!;
  let w = 0, used = 0, g = 0;
  const M = N * 4;
  for (let i = 0; i < M; i++) {
    const coach = CLS_KEYS[i % CLS_KEYS.length];
    const deckA = cpuDeck(coach, 0.5).filter((x) => x.k !== k);
    for (let n = 0; n < (c.rarity === 'iconic' ? 1 : 2); n++) { if (deckA.length >= 20) deckA.pop(); if (canAdd(deckA, c)) deckA.push(c); }
    const A = newSide(coach, bandTeam(0.4, 0.7), deckA), B = newSide(coach, bandTeam(0.4, 0.7), cpuDeck(coach, 0.5).filter((x) => x.k !== k));
    const G = simGame(A, B, [mid, mid]);
    g++; if (G.winner === 0) w++;
    used += G.hist.filter((h) => h.side === 0 && (h.outcome.offCard === c.name || h.outcome.defCard === c.name)).length + A.traps.length * 0 + (A.stats.cards ? 0 : 0);
  }
  console.log(k.padEnd(18), c.rarity.padEnd(9), pc(w, g), ` seen ${f1(used / g)}/game`);
}
}

// Deck power: a Rare+ deck (best cards allowed by the deck rules) against the all-Basic starter deck, same squads. 50% = cards do not matter.
if (want('decks')) {
  console.log('\nDeck power (mid band, same coach, 3 shots at it): win rate of the Rare+ deck vs the starter Basic deck, and vs a CPU level-.5 deck');
  const rich = (coach: (typeof CLS_KEYS)[number]) => buildDeck(Object.fromEntries(allCards().filter((c) => c.rarity !== 'basic' && (!c.cls || c.cls === coach)).map((c) => [c.k, 2])), coach);
  let w = 0, g = 0, w2 = 0, g2 = 0;
  for (let i = 0; i < N * 12; i++) {
    const coach = CLS_KEYS[i % CLS_KEYS.length];
    const G = simGame(newSide(coach, bandTeam(0.4, 0.7), rich(coach)), newSide(coach, bandTeam(0.4, 0.7), buildDeck({}, coach)), [mid, mid]);
    g++; if (G.winner === 0) w++;
    const H = simGame(newSide(coach, bandTeam(0.4, 0.7), rich(coach)), newSide(coach, bandTeam(0.4, 0.7), cpuDeck(coach, 0.5)), [mid, mid]);
    g2++; if (H.winner === 0) w2++;
  }
  console.log(`Rare+ deck vs starter deck: ${pc(w, g)} (${g} games) · vs CPU .5 deck: ${pc(w2, g2)}`);
}
