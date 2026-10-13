// Economy and progression check: pack odds, packs needed for the first Epic / Legendary / Iconic Baller, shards to max a Baller,
// shards from duplicates, and Bucks income per hour of play. npx tsx tools/econ.ts [runs] [gamesPerStage]
import catalogJson from '../src/data/catalog.json';
import { TIERS, TIER_NAME, ballersOfTier, catalog, loadCatalog, seedRng, tierRank, top3Mean, type Catalog, type Tier } from '../src/rules';
import { BALLER_PACKS, PACKS, SNEAKER_PACKS, isBox, openPack, oddsPct, packChance, packDef, playPoolSize, type PackDef } from '../src/casual/packs';
import { DAILY_BUCKS, keepCopies, DAILY_SHARDS, MILESTONES, QUICK_LOSS, QUICK_WIN, REPLAY_SHARE, SHARDS_LOSS, SHARDS_WIN, SHARD_YIELD, applyGame, levelCost, maxCost, starsFor, type Prog } from '../src/casual/progress';
import { bandTeam, buildDeck, cBaller, cpuDeck, equip, newSide, simGame, starterIds, type AiSkill } from '../src/casual/engine';
import { STAGES, QUICK, cpuSide } from '../src/casual/story';
import { allCards } from '../src/casual/cards';

loadCatalog(catalogJson as unknown as Catalog);
seedRng(2026);
const RUNS = +(process.argv[2] || 2000), GAMES = +(process.argv[3] || 40);
// Play-time model: a game of ~30 possessions at ~9 s of tapping and animation each, plus ~90 s of menus, rewards and pack opening.
const SEC_PER_POSS = 9, OVERHEAD_S = 90;
const f1 = (x: number) => x.toFixed(1), f0 = (x: number) => Math.round(x).toLocaleString('en');
const pct = (x: number) => (x * 100 >= 10 ? (x * 100).toFixed(0) : x * 100 >= 1 ? (x * 100).toFixed(1) : (x * 100).toFixed(2)) + '%';
const median = (a: number[]) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
const p90 = (a: number[]) => a.slice().sort((x, y) => x - y)[Math.floor(a.length * 0.9)];

console.log('== Baller tiers (rank by mean of the top 3 stats)');
const uniq = new Map(catalog().B.filter((b) => b[10] !== 2).map((b) => [b[0], b]));
for (const t of TIERS.slice().reverse()) {
  const ids = ballersOfTier(t), m = ids.map((i) => top3Mean(uniq.get(i)!));
  console.log(`${TIER_NAME[t].padEnd(10)} ${String(ids.length).padStart(5)} (${pct(ids.length / uniq.size)})  top-3 mean ${f1(Math.min(...m))} to ${f1(Math.max(...m))}`);
}
console.log(`Play card pool: ${allCards().length} cards; ` + TIERS.map((t) => `${TIER_NAME[t]} ${playPoolSize(t)}`).join(', '));

console.log('\n== Odds per pack (at least one Baller of the tier or better)');
for (const d of PACKS) {
  const kind = isBox(d) ? 'sneaker' : 'baller';
  console.log(`${d.name.padEnd(12)} ${String(d.price).padStart(5)} B$  Rare+ ${pct(packChance(d, 'rare', kind))}  Epic+ ${pct(packChance(d, 'epic', kind))}  Legendary+ ${pct(packChance(d, 'legendary', kind))}  Iconic ${pct(packChance(d, 'iconic', kind))}` + (d.pity ? `   (pity: ${TIER_NAME[d.pity.min]}+ every ${d.pity.every})` : ''));
}

function packsUntil(def: PackDef, min: Tier, kind: 'baller' | 'sneaker', cap = 5000): number {
  let n = 0;
  for (;;) {
    n++;
    const pity = !!def.pity && n % def.pity.every === 0;
    if (openPack(def, { pity }).some((p) => p.kind === kind && tierRank(p.tier) >= tierRank(min))) return n;
    if (n >= cap) return cap;
  }
}
console.log(`\n== Packs until the first Baller of a tier (Monte Carlo, ${RUNS} runs, pity included)`);
const need: Record<string, Record<string, { mean: number; med: number; p90: number }>> = {};
for (const d of BALLER_PACKS) {
  need[d.id] = {};
  const parts: string[] = [];
  for (const t of ['epic', 'legendary', 'iconic'] as Tier[]) {
    const runs = t === 'iconic' && packChance(d, t) < 0.003 ? 0 : RUNS;
    if (!runs) { const m = 1 / packChance(d, t); need[d.id][t] = { mean: m, med: m * Math.LN2, p90: m * Math.log(10) }; }
    else { const xs = Array.from({ length: runs }, () => packsUntil(d, t, 'baller')); need[d.id][t] = { mean: xs.reduce((a, b) => a + b, 0) / xs.length, med: median(xs), p90: p90(xs) }; }
    const r = need[d.id][t];
    parts.push(`${TIER_NAME[t]} ${f0(r.mean)} (med ${f0(r.med)}, p90 ${f0(r.p90)})${runs ? '' : '*'}`);
  }
  console.log(`${d.name.padEnd(12)} ${parts.join(' · ')}   = ${f0(need[d.id].epic.mean * d.price)} / ${f0(need[d.id].legendary.mean * d.price)} / ${f0(need[d.id].iconic.mean * d.price)} Bucks`);
}
console.log('(* geometric estimate, no simulation)');
for (const box of SNEAKER_PACKS) {
  const xs = Array.from({ length: RUNS }, () => packsUntil(box, 'iconic', 'sneaker', 20000)), m = xs.reduce((a, b) => a + b, 0) / xs.length;
  console.log(`${box.name.padEnd(11)} ${String(box.price).padStart(4)} B$: Rare+ ${pct(packChance(box, 'rare', 'sneaker'))}  Epic+ ${pct(packChance(box, 'epic', 'sneaker'))}  Legendary+ ${pct(packChance(box, 'legendary', 'sneaker'))}  Iconic ${pct(packChance(box, 'iconic', 'sneaker'))} per box; first Iconic Sneaker after ${f0(m)} boxes (${f0(m * box.price)} Bucks)`);
}

console.log('\n== Shards');
console.log('Duplicate yield: ' + TIERS.map((t) => `${TIER_NAME[t]} ${SHARD_YIELD[t]}`).join(', '));
console.log('To max one Baller (level 1 to 5): ' + TIERS.map((t) => `${TIER_NAME[t]} ${f0(maxCost(t))}`).join(', ') + `   (first step: ${TIERS.map((t) => levelCost(t, 1)).join('/')})`);
{
  // 200 Pro packs: how many shards do duplicates give? Only Play cards past 2 copies (1 for Iconic) and repeat Ballerz count.
  for (const id of ['street', 'pro', 'icon']) {
    const d = packDef(id), have = new Map<string, number>(), N = 300;
    let sh = 0, at50 = 0, at100 = 0;
    for (let n = 1; n <= N; n++) {
      for (const p of openPack(d, { pity: !!d.pity && n % d.pity.every === 0 })) {
        const c = have.get(p.key) || 0;
        if (c >= keepCopies(p.key, p.tier)) sh += SHARD_YIELD[p.tier]; else have.set(p.key, c + 1);
      }
      if (n === 50) at50 = sh; if (n === 100) at100 = sh;
    }
    console.log(`${d.name.padEnd(12)} shards from duplicates: ${f0(at50)} after 50 packs, ${f0(at100)} after 100, ${f0(sh)} after ${N} (about ${f1(sh / N)} per pack, ${f1(sh / N / d.price * 100)} per 100 Bucks)`);
  }
}

// ---------- income per hour ----------
console.log(`\n== Income (${GAMES} simulated games per court, a decent player with the squad shown)`);
const player: AiSkill = { smart: 0.75, sigma: 0.1 };
interface Row { win: number; s1: number; s2: number; s3: number; poss: number }
function run(stageIdx: number, strong: boolean): Row {
  const st = stageIdx >= 0 ? STAGES[stageIdx] : ({ ...QUICK, coach: 'splash' as const });
  let w = 0, s2 = 0, s3 = 0, poss = 0;
  for (let i = 0; i < GAMES; i++) {
    const me = strong ? newSide('splash', bandTeam(0.88, 1).map((b) => cBaller(b.id, b.sneakerId, 5)), cpuDeck('splash', 0.95)) : newSide('splash', equip(starterIds(), []), buildDeck({}, 'splash'));
    const G = simGame(me, cpuSide(st as never), [player, st.skill]);
    const s = starsFor(G); poss += G.n;
    if (s >= 1) w++; if (s >= 2) s2++; if (s >= 3) s3++;
  }
  return { win: w / GAMES, s1: w / GAMES, s2: s2 / GAMES, s3: s3 / GAMES, poss: poss / GAMES };
}
const starters = STAGES.map((_s, i) => run(i, false)), strong = STAGES.map((_s, i) => run(i, true));
const quickS = run(-1, false), quickX = run(-1, true);
console.log('Court               starters: win  2*   3*     strong squad: win  2*   3*');
STAGES.forEach((s, i) => console.log(`${s.name.padEnd(19)} ${pct(starters[i].win).padStart(12)} ${pct(starters[i].s2).padStart(5)} ${pct(starters[i].s3).padStart(5)} ${pct(strong[i].win).padStart(19)} ${pct(strong[i].s2).padStart(5)} ${pct(strong[i].s3).padStart(5)}`));
console.log(`Quick Play          ${pct(quickS.win).padStart(12)}                    ${pct(quickX.win).padStart(19)}`);

const hrs = (g: number, poss: number) => (g * (poss * SEC_PER_POSS + OVERHEAD_S)) / 3600;
const gph = (poss: number) => 3600 / (poss * SEC_PER_POSS + OVERHEAD_S);
const perGame = (win: number, b: [number, number], s: [number, number]) => ({ b: win * b[0] + (1 - win) * b[1], s: win * s[0] + (1 - win) * s[1] });

// story run: first clear every court in order; a court is replayed until it is won (expected 1/p games).
let storyGames = 0, storyHours = 0, storyBucks = 0, storyShards = 0;
const free: Record<string, number> = { street: 0, pro: 0, icon: 0 };
const fake: Prog = { bucks: 0, shards: 0, levels: {}, stars: [], claimed: [], pity: {}, daily: { day: '', streak: 0 } };
STAGES.forEach((st, i) => {
  const p = Math.max(0.15, starters[i].win), games = 1 / p;
  // losses before the first clear pay 10 Bucks + 2 shards each
  storyGames += games; storyHours += hrs(games, starters[i].poss);
  storyBucks += (games - 1) * 10; storyShards += (games - 1) * SHARDS_LOSS;
  const r = applyGame(fake, { won: true, stage: i, stars: 3, reward: { reward: st.reward, pack: st.pack, boss: st.boss } });
  storyBucks += r.bucks; storyShards += r.shards; r.packs.forEach((k) => free[k]++);
});
let msBucks = 0, msShards = 0;
for (const m of MILESTONES) { msBucks += m.bucks || 0; msShards += m.shards || 0; if (m.pack) free[m.pack]++; }
console.log(`\nStory run with starters (1/win-rate games per court): ~${f0(storyGames)} games, ~${f1(storyHours)} h -> ${f0(storyBucks)} Bucks, ${f0(storyShards)} shards, free packs ${free.street} Street / ${free.pro} Pro (incl. bosses)`);
console.log(`All 24 stars (needs a stronger squad for the late courts): milestones give ${f0(msBucks)} Bucks, ${f0(msShards)} shards and ${MILESTONES.filter((m) => m.pack).map((m) => m.pack).join(', ')} Packs. Totals in free packs: ${free.street} Street, ${free.pro} Pro, ${free.icon} Icon.`);

const opts: { name: string; win: number; b: [number, number]; s: [number, number]; poss: number }[] = [
  { name: 'Quick Play, starters', win: quickS.win, b: [QUICK_WIN, QUICK_LOSS], s: [SHARDS_WIN, SHARDS_LOSS], poss: quickS.poss },
  { name: 'Quick Play, strong squad', win: quickX.win, b: [QUICK_WIN, QUICK_LOSS], s: [SHARDS_WIN, SHARDS_LOSS], poss: quickX.poss },
];
// best replay court for each squad: highest pay among courts with at least 50% win rate
for (const [label, rows] of [['starters', starters], ['strong squad', strong]] as const) {
  let best = 0, bv = -1;
  rows.forEach((r, i) => { if (r.win >= 0.5) { const v = perGame(r.win, [Math.round(STAGES[i].reward * REPLAY_SHARE), 10], [SHARDS_WIN, SHARDS_LOSS]).b * gph(r.poss); if (v > bv) { bv = v; best = i; } } });
  opts.push({ name: `Replay ${STAGES[best].name}, ${label}`, win: rows[best].win, b: [Math.round(STAGES[best].reward * REPLAY_SHARE), 10], s: [SHARDS_WIN, SHARDS_LOSS], poss: rows[best].poss });
}
console.log('\nPer hour of play (a game takes ' + f1(60 / gph(quickS.poss)) + ' min incl. menus):');
const out: { name: string; b: number; s: number }[] = [];
for (const o of opts) {
  const g = perGame(o.win, o.b, o.s), n = gph(o.poss);
  out.push({ name: o.name, b: g.b * n, s: g.s * n });
  console.log(`${o.name.padEnd(36)} ${f1(n)} games/h · win ${pct(o.win)} · ${f0(g.b * n)} Bucks/h · ${f0(g.s * n)} shards/h`);
}
const daily = DAILY_BUCKS + 20 * 2;
console.log(`Daily first-win bonus: ${DAILY_BUCKS} Bucks (up to ${DAILY_BUCKS + 80} on a 5-day streak) + ${DAILY_SHARDS} shards per day.`);

const inc = out.reduce((a, o) => a + o.b, 0) / out.length;
console.log(`\n== Time to goals (steady income ~${f0(inc)} Bucks/h, ${f0(out[0].b)} on the low end; free story/star packs not counted)`);
for (const d of BALLER_PACKS) {
  const r = need[d.id];
  console.log(`${d.name.padEnd(12)} first Epic ${f1(r.epic.mean * d.price / inc)} h · Legendary ${f1(r.legendary.mean * d.price / inc)} h · Iconic ${f0(r.iconic.mean * d.price / inc)} h`);
}
const sh = out.reduce((a, o) => a + o.s, 0) / out.length;
console.log(`Max one Baller: ${TIERS.map((t) => `${TIER_NAME[t]} ${f1(maxCost(t) / (sh || 1))} h`).join(', ')} (shards from games only, ${f0(sh)}/h)`);
void daily;
