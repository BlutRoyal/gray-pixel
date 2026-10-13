import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { CLS_KEYS, WIN, anchorP, chance, loadCatalog, newGame, seedRng, simGame, startPossession, type Catalog } from '../src/rules';

beforeAll(() => loadCatalog(JSON.parse(readFileSync(new URL('../src/data/catalog.json', import.meta.url), 'utf8')) as Catalog));

describe('rules', () => {
  it('replays the same game from the same seed', () => {
    seedRng(42); const a = simGame('splash', 'bully');
    seedRng(42); const b = simGame('splash', 'bully');
    expect(a.score).toEqual(b.score);
    expect(a.n).toBe(b.n);
  });
  it('every matchup finishes with a winner', () => {
    seedRng(7);
    for (const x of CLS_KEYS) for (const y of CLS_KEYS) {
      if (x === y) continue;
      const g = simGame(x, y);
      expect(g.over).toBe(true);
      expect([0, 1]).toContain(g.winner);
      expect(Math.max(...g.score) >= WIN || g.n >= 40).toBe(true);
    }
  });
  it('anchor table matches v0.7 (Three 38% at 80)', () => {
    expect(anchorP('three', 80)).toBe(38);
    expect(anchorP('dunk', 99)).toBe(85);
  });
  it('a read shot is worse than an open one', () => {
    seedRng(1);
    const G = newGame('splash', 'three', { human: 0 });
    startPossession(G);
    const s = G.ctx!.off;
    const open = chance(G, { s, idx: 0, type: 'three', scheme: 'pack' });
    const read = chance(G, { s, idx: 0, type: 'three', scheme: 'close' });
    expect(read.stopped).toBe(true);
    expect(read.p).toBeLessThan(open.p);
  });
});
