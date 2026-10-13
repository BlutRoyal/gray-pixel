// Per-special win-rate lift: the same squad and Iconic Baller on both sides, but only side A may use his special.
// npx tsx tools/splift.ts [gamesPerSpecial] [holo]   (50% = no lift; HOLO runs side A with the HOLO variant)
import catalogJson from '../src/data/catalog.json';
import { CLS_KEYS, ballersOfTier, loadCatalog, seedRng, type Catalog } from '../src/rules';
import { bandTeam, cBaller, cpuDeck, newSide, simGame, type AiSkill, type CBaller } from '../src/casual/engine';
import { SPECIALS, specialFor } from '../src/casual/specials';
import { importTuning } from '../src/casual/tuning';

loadCatalog(catalogJson as unknown as Catalog);
if (process.env.BDL_TUNE) importTuning(process.env.BDL_TUNE);
seedRng(777);
const N = +(process.argv[2] || 300), HOLO = process.argv[3] === 'holo';
const mid: AiSkill = { smart: 0.75, sigma: 0.1 };
const ids = ballersOfTier('iconic');
const rows: { name: string; type: string; id: number; lift: number; use: number; dpts: number }[] = [];
for (const sp of SPECIALS) {
  const id = ids.find((i) => specialFor(i)!.name === sp.name)!;
  let w = 0, used = 0, dp = 0;
  for (let g = 0; g < N; g++) {
    const coach = CLS_KEYS[g % CLS_KEYS.length];
    const base = bandTeam(0.4, 0.7).slice(0, 4);
    const mk = (holo: boolean, off: boolean): CBaller[] => {
      const x = cBaller(id, null, 1, holo); x.spUsed = off;
      return [...base.map((b) => ({ ...b })), x].sort(() => 0);
    };
    const A = newSide(coach, mk(HOLO, false), cpuDeck(coach, 0.5)), B = newSide(coach, mk(false, true), cpuDeck(coach, 0.5));
    // newSide resets spUsed, so the opposing copy is switched off here (side B may not use his special)
    for (const b of B.team.concat(B.bench)) if (b.id === id) b.spUsed = true;
    // rotate so the Iconic starts on court for both
    const swap = g % 2 === 1;
    const G = swap ? simGame(B, A, [mid, mid]) : simGame(A, B, [mid, mid]);
    const mineIdx = swap ? 1 : 0;
    if (G.winner === mineIdx) w++;
    dp += G.sides[mineIdx].score - G.sides[1 - mineIdx].score;
    const me = G.sides[mineIdx];
    if ([...me.team, ...me.bench].some((b) => b.id === id && b.spUsed)) used++;
  }
  rows.push({ name: sp.name, type: sp.type, id, lift: (w / N) * 100, use: (used / N) * 100, dpts: dp / N });
}
rows.sort((a, b) => b.dpts - a.dpts);
for (const r of rows) console.log(r.name.padEnd(16), r.type.padEnd(9), `pts ${r.dpts >= 0 ? '+' : ''}${r.dpts.toFixed(2)}  win ${r.lift.toFixed(1)}%  used in ${r.use.toFixed(0)}% of games`);
const byType: Record<string, number[]> = {};
for (const r of rows) (byType[r.type] ||= []).push(r.lift);
console.log('\nby type: ' + Object.entries(byType).map(([t, a]) => `${t} ${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)}`).join(' · '));
console.log(`mean pts ${(rows.reduce((a, r) => a + r.dpts, 0) / rows.length).toFixed(2)}`);
console.log(`mean lift ${(rows.reduce((a, r) => a + r.lift, 0) / rows.length).toFixed(1)}%`);
