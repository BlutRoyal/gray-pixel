import { describe, expect, it } from 'vitest';
import catalogJson from '../src/data/catalog.json';
import { RANK_CUTS, TIERS, ballerRankOf, ballerTier, ballersOfTier, catalog, loadCatalog, seedRng, sneakerRowTier, tierRank, top3Mean, type Catalog } from '../src/rules';
import { allCards, ccard } from '../src/casual/cards';
import { cBaller, validateDeck } from '../src/casual/engine';
import { skillFor } from '../src/casual/skills';
import { PACKS, cardTier, openPack, packChance, packDef } from '../src/casual/packs';
import { LEVEL_MAX, MILESTONES, applyGame, claimMilestone, claimable, levelCost, levelUp, starsFor, type Prog } from '../src/casual/progress';
import { STAGES } from '../src/casual/story';

loadCatalog(catalogJson as unknown as Catalog);
const prog = (): Prog => ({ bucks: 0, shards: 0, levels: {}, stars: [], claimed: [], pity: {}, daily: { day: '', streak: 0 } });

describe('tiers by rank', () => {
  it('top 50 Iconic, next 200 Legendary, next 750 Epic, the rest split', () => {
    expect(ballersOfTier('iconic').length).toBe(RANK_CUTS.iconic);
    expect(ballersOfTier('legendary').length).toBe(RANK_CUTS.legendary);
    expect(ballersOfTier('epic').length).toBe(RANK_CUTS.epic);
    const rest = TIERS.slice(0, 3).reduce((a, t) => a + ballersOfTier(t).length, 0);
    const r = ballersOfTier('rare').length / rest;
    expect(r).toBeGreaterThan(0.14); expect(r).toBeLessThan(0.16);
    expect(ballersOfTier('uncommon').length / rest).toBeGreaterThan(0.29);
  });
  it('rank follows the mean of the top three stats, ties by the sum, then id', () => {
    const by = (id: number) => catalog().B.filter((b) => b[0] === id).pop()!;
    const ids = TIERS.flatMap((t) => ballersOfTier(t)).sort((a, b) => ballerRankOf(a) - ballerRankOf(b));
    for (let i = 1; i < 3000; i++) {
      const a = by(ids[i - 1]), b = by(ids[i]);
      expect(top3Mean(a)).toBeGreaterThanOrEqual(top3Mean(b));
    }
    for (const id of ballersOfTier('iconic')) expect(ballerRankOf(id)).toBeLessThanOrEqual(50);
  });
  it('skills and Ballerz use the same tier', () => {
    const id = ballersOfTier('legendary')[0];
    expect(cBaller(id).tier).toBe('legendary');
    expect(cBaller(id).skill.tier).toBe('legendary');
    expect(skillFor(5, 'G', 'uncommon').tier).toBe('generic');
    expect(cBaller(ballersOfTier('iconic')[0]).skill.key).toBe('none'); // an Iconic has only his special
  });
  it('Sneaker display tiers', () => {
    expect(sneakerRowTier([1, 80, 0, 4, 0, 0])).toBe('iconic');
    expect(sneakerRowTier([1, 80, 4, 5, 0, 0])).toBe('legendary');
    expect(sneakerRowTier([1, 80, 2, 5, 0, 0])).toBe('epic');
    expect(sneakerRowTier([1, 80, 0, 5, 0, 0])).toBe('rare');
    expect(sneakerRowTier([1, 80, 0, 1, 0, 0])).toBe('uncommon');
  });
});

describe('packs', () => {
  it('Baller packs have 2 Ballerz + 3 Play cards and no Sneaker, the Sneaker Box 3 Sneakerz', () => {
    seedRng(3);
    for (const id of ['basic', 'street', 'pro', 'icon']) { const p = openPack(packDef(id)); expect(p.length).toBe(5); expect(p.filter((x) => x.kind === 'baller').length).toBe(2); expect(p.filter((x) => x.kind === 'play').length).toBe(3); expect(p.some((x) => x.kind === 'sneaker')).toBe(false); }
    expect(openPack(packDef('box')).every((x) => x.kind === 'sneaker')).toBe(true);
    expect(packDef('box').price * 2).toBe(packDef('street').price);
    for (const id of ['probox', 'iconbox']) expect(openPack(packDef(id)).length).toBe(3);
    expect([packDef('box').price, packDef('probox').price, packDef('iconbox').price]).toEqual([50, 150, 500]);
  });
  it('pity guarantees Epic+ in Pro and Legendary+ in Icon', () => {
    seedRng(9);
    for (let i = 0; i < 300; i++) {
      expect(openPack(packDef('pro'), { pity: true }).some((p) => p.kind === 'baller' && tierRank(p.tier) >= tierRank('epic'))).toBe(true);
      expect(openPack(packDef('icon'), { pity: true }).some((p) => p.kind === 'baller' && tierRank(p.tier) >= tierRank('legendary'))).toBe(true);
    }
  });
  it('Iconic odds per pack: Icon ~2%, Pro ~0.4%, Street ~0.02%', () => {
    expect(packChance(packDef('icon'), 'iconic')).toBeGreaterThan(0.018);
    expect(packChance(packDef('icon'), 'iconic')).toBeLessThan(0.026);
    expect(packChance(packDef('pro'), 'iconic')).toBeLessThan(0.005);
    expect(packChance(packDef('pro'), 'iconic')).toBeGreaterThan(0.003);
    expect(packChance(packDef('street'), 'iconic')).toBeLessThan(0.0003);
  });
  it('the v2 cards are in the pool at their stage-1 rarity', () => {
    const v2 = allCards().filter((c) => c.v2);
    expect(v2.length).toBe(16);
    seedRng(5);
    const seen = new Set<string>();
    for (let i = 0; i < 4000; i++) for (const p of [...openPack(packDef('icon')), ...openPack(packDef('street'))]) if (p.kind === 'play') { const c = ccard(p.id as string)!; expect(cardTier(c)).toBe(p.tier); seen.add(c.k); }
    for (const c of v2.filter((x) => x.rarity !== 'iconic')) expect(seen.has(c.k)).toBe(true);
    expect(cardTier(ccard('heave')!)).toBe('iconic');
    expect(cardTier(ccard('iso')!)).toBe('legendary');
    expect(PACKS.length).toBe(7);
  });
});

describe('shards and levels', () => {
  it('a level adds +1 to every stat, up to level 5', () => {
    const id = ballersOfTier('rare')[0], a = cBaller(id), b = cBaller(id, null, 5);
    expect(b.rim - a.rim).toBe(4); expect(b.def - a.def).toBe(4); expect(b.ply - a.ply).toBe(4); expect(b.three - a.three).toBe(4);
    expect(b.level).toBe(5);
    expect(cBaller(id, null, 9).level).toBe(5);
  });
  it('level up spends shards', () => {
    const P = prog();
    expect(levelUp(P, 7, 'rare')).toBe(false);
    P.shards = levelCost('rare', 1);
    expect(levelUp(P, 7, 'rare')).toBe(true);
    expect(P.levels[7]).toBe(2); expect(P.shards).toBe(0);
    P.shards = 99999;
    for (let i = 0; i < 10; i++) levelUp(P, 7, 'rare');
    expect(P.levels[7]).toBe(LEVEL_MAX);
    expect(levelCost('rare', LEVEL_MAX)).toBe(0);
  });
});

describe('rewards', () => {
  const g = (mine: number, theirs: number, tov = 0) => ({ winner: (mine > theirs ? 0 : 1) as 0 | 1, sides: [{ score: mine }, { score: theirs }], hist: Array.from({ length: tov }, () => ({ side: 0, outcome: { turnover: 'x' } })) }) as never;
  it('stars: win, margin, clean', () => {
    expect(starsFor(g(21, 25))).toBe(0);
    expect(starsFor(g(21, 17))).toBe(1);
    expect(starsFor(g(21, 12, 5))).toBe(2);
    expect(starsFor(g(21, 8, 1))).toBe(3);
  });
  it('first clear, boss, stars, daily bonus and milestones', () => {
    const P = prog(), st = STAGES[2];
    const r = applyGame(P, { won: true, stage: 2, stars: 3, reward: { reward: st.reward, pack: st.pack, boss: st.boss }, today: '2026-10-12' });
    expect(r.firstClear).toBe(true);
    expect(r.packs).toEqual([st.pack, st.boss!.pack]);
    expect(r.newStars).toBe(3); expect(P.stars[2]).toBe(3);
    expect(r.dailyDay).toBe(1);
    expect(P.bucks).toBe(r.bucks); expect(P.shards).toBe(r.shards);
    expect(claimable(P)).toEqual([0]);
    const again = applyGame(P, { won: true, stage: 2, stars: 3, reward: { reward: st.reward, pack: st.pack, boss: st.boss }, today: '2026-10-12' });
    expect(again.firstClear).toBe(false); expect(again.packs).toEqual([]); expect(again.dailyDay).toBe(0);
    expect(again.bucks).toBeLessThan(st.reward);
    const next = applyGame(P, { won: true, stage: -1, stars: 0, today: '2026-10-13' });
    expect(next.dailyDay).toBe(2);
    expect(claimMilestone(P, 0).ok).toBe(true);
    expect(claimMilestone(P, 0).ok).toBe(false);
    expect(claimMilestone(P, MILESTONES.length - 1).ok).toBe(false);
  });
  it('a hand-built deck follows validateDeck', () => {
    expect(validateDeck([])).not.toEqual([]);
  });
});
