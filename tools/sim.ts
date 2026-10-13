// AI vs AI round robin from the command line.
// Usage: npm run sim -- [games_per_matchup=30] [seed=12345]   (100 = 3000 games)
import { readFileSync } from 'node:fs';
import { CLASSES, CLS_KEYS, SHOTS, loadCatalog, pct, ppa, roundRobin, seedRng, type Catalog, type ShotType } from '../src/rules';

const n = Number(process.argv[2]) || 30;
const seed = Number(process.argv[3]) || 12345;
loadCatalog(JSON.parse(readFileSync(new URL('../src/data/catalog.json', import.meta.url), 'utf8')) as Catalog);
seedRng(seed);
const t0 = Date.now();
const r = await roundRobin(n);
console.log(`${r.games} games, ${(r.poss / r.games).toFixed(1)} poss/game, empty deck ${pct(r.emptyDeck, r.games)}%, seed ${seed}, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(CLS_KEYS.map((k) => `${CLASSES[k].hero} ${pct(r.cls[k].w, r.cls[k].g)}%`).join(' | '));
const tot = Object.values(r.shots).reduce((a, v) => a + v.a, 0);
for (const [t, v] of Object.entries(r.shots)) console.log(`${SHOTS[t as ShotType].name}: ${pct(v.a, tot)}% of shots, ${pct(v.m, v.a)}% made, ${ppa(t, v).toFixed(2)} pts/att`);
console.log('Rosters: ' + Object.entries(r.strat).map(([k, v]) => `${k} ${pct(v.w, v.g)}%`).join(', '));
