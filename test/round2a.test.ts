import { describe, expect, it } from 'vitest';
import catalogJson from '../src/data/catalog.json';
import { loadCatalog, seedRng, type Catalog } from '../src/rules';
import { allCards, ccard, effectTag, withLevel } from '../src/casual/cards';
import { TUNING, andOneChance, cBaller, newGame, newSide, resolve, type CBaller, type CGame } from '../src/casual/engine';
import { CARD_L5, addCardShards, cardLevelAt, cardLevelOf, cardNeed, cardShardsOf, type Prog } from '../src/casual/progress';

loadCatalog(catalogJson as unknown as Catalog);
const fake = (id: number, over: Partial<CBaller> = {}): CBaller => ({ ...cBaller(id), rim: 80, mid: 80, three: 80, ply: 75, def: 80, pos: 'W', shoe: null, sneakerId: null, ...over, skill: { key: 'none', name: 'None', text: '', tier: 'generic', fx: {} } });
const squad = (over: Partial<CBaller> = {}): CBaller[] => [10, 20, 30, 40, 50].map((id) => fake(id, over));
function game(a: CBaller[], b: CBaller[]): CGame {
  const G = newGame(newSide('pnr', a, []), newSide('pnr', b, []), 0);
  for (const S of G.sides) { S.deck = []; S.hand = []; S.discard = []; S.mo = 0; }
  return G;
}
const prog = (): Prog => ({ bucks: 0, shards: 0, levels: {}, stars: [], claimed: [], pity: {}, daily: { day: '', streak: 0 } });

describe('and-one on Rim makes', () => {
  it('starts at the base, grows with a dunker or Big, shrinks against a strong defender, grows when the defense guessed wrong', () => {
    const plain = fake(1, { rim: 60, pos: 'G' }), dunker = fake(2, { rim: 99, pos: 'B' });
    expect(andOneChance(plain, 60, false)).toBe(TUNING.a1Base);
    expect(andOneChance(dunker, 60, false)).toBeGreaterThan(andOneChance(plain, 60, false));
    expect(andOneChance(dunker, 60, false)).toBeLessThanOrEqual(TUNING.a1Base + TUNING.a1Dnk);
    expect(andOneChance(dunker, 99, false)).toBeLessThan(andOneChance(dunker, 60, false));
    expect(andOneChance(dunker, 99, false)).toBeGreaterThanOrEqual(TUNING.a1Base - TUNING.a1Def);
    expect(andOneChance(plain, 60, true) - andOneChance(plain, 60, false)).toBeCloseTo(TUNING.a1Beat, 5);
    expect(andOneChance(dunker, 0, true)).toBeLessThanOrEqual(TUNING.a1Cap);
  });
  it('adds a point and a Momentum, only on Rim, and the log says AND ONE', () => {
    seedRng(11);
    let ones = 0, rimMakes = 0, other = 0;
    for (let n = 0; n < 400; n++) {
      const G = game(squad({ rim: 99, mid: 99, three: 99, pos: 'B' }), squad({ def: 60 }));
      G.poss.shooter = 0; G.poss.zone = n % 4 === 0 ? 'mid' : 'rim';
      const mo0 = G.sides[0].mo, o = resolve(G);
      if (o.andOne) {
        ones++;
        expect(o.made && o.zone === 'rim').toBe(true);
        expect(o.pts).toBe(3);
        expect(G.sides[0].mo - mo0).toBeGreaterThanOrEqual(1 + TUNING.moBasket);
        expect(G.sides[0].score).toBe(3);
        expect(G.feed.some((f) => /AND ONE/.test(typeof f === 'string' ? f : JSON.stringify(f)))).toBe(true);
      }
      if (o.made && o.zone === 'rim') rimMakes++; else if (o.made) { other++; expect(o.andOne).toBe(false); }
    }
    expect(rimMakes).toBeGreaterThan(100); expect(other).toBeGreaterThan(20);
    expect(ones / rimMakes).toBeGreaterThan(0.05); expect(ones / rimMakes).toBeLessThan(0.3);
  });
});

describe('Rare+ card power and card levels', () => {
  it('scales Rare and up by the TUNING power, leaves Basic alone', () => {
    const boosted = (r: string) => allCards().filter((c) => c.rarity === r && (c.fx.boost || 0) > 0 && !c.fx.trap);
    const basic = boosted('basic')[0], epic = boosted('epic')[0];
    expect(basic).toBeTruthy(); expect(epic).toBeTruthy();
    const keep = TUNING.powEpic;
    TUNING.powEpic = 1; const base = ccard(epic.k)!.fx.boost!;
    TUNING.powEpic = 1.5; const up = ccard(epic.k)!.fx.boost!;
    TUNING.powEpic = keep;
    expect(up / base).toBeGreaterThan(1.4); expect(up / base).toBeLessThan(1.6);
    expect(effectTag(basic).big).toMatch(/\d/);
  });
  it('a card level adds +2% effect per level (Basic +1%), on a copy, not on the shared card', () => {
    const c = allCards().find((x) => x.rarity === 'epic' && (x.fx.boost || 0) > 0 && !x.fx.trap)!;
    const b = allCards().find((x) => x.rarity === 'basic' && (x.fx.boost || 0) > 0 && !x.fx.trap)!;
    const l5 = withLevel(c, 5);
    expect(l5.fx.boost! / c.fx.boost!).toBeGreaterThan(1.06); expect(l5.fx.boost! / c.fx.boost!).toBeLessThan(1.1);
    expect(ccard(c.k)!.fx.boost).toBe(c.fx.boost);
    const b5 = withLevel(b, 5);
    expect(b5.fx.boost! / b.fx.boost!).toBeGreaterThan(1.02); expect(b5.fx.boost! / b.fx.boost!).toBeLessThan(1.06);
    expect(withLevel(c, 1)).toBe(c);
  });
  it('newSide applies the level of each card in the deck', () => {
    const c = allCards().find((x) => x.rarity === 'epic' && (x.fx.boost || 0) > 0 && !x.fx.trap)!;
    const S = newSide('pnr', squad(), [c, c], { [c.k]: 5 });
    expect(S.deck.every((d) => d.fx.boost! > c.fx.boost!)).toBe(true);
  });
});

describe('per-card shards', () => {
  it('needs 100 / 250 / 600 / 1500 / 4000 shards to reach level 5, and the later levels cost the most', () => {
    expect(cardNeed('common', 5)).toBe(CARD_L5.common); expect(CARD_L5.common).toBe(100);
    expect(CARD_L5.rare).toBe(250); expect(CARD_L5.epic).toBe(600); expect(CARD_L5.legendary).toBe(1500); expect(CARD_L5.iconic).toBe(4000);
    for (const t of ['common', 'rare', 'epic', 'legendary', 'iconic'] as const) {
      expect(cardNeed(t, 2)).toBeGreaterThan(0);
      expect(cardNeed(t, 5) - cardNeed(t, 4)).toBeGreaterThan(cardNeed(t, 3) - cardNeed(t, 2));
    }
  });
  it('shards go to that card only and raise only its level', () => {
    const P = prog();
    expect(cardLevelAt(0, 'epic')).toBe(1);
    addCardShards(P, 'iso', 600, 'epic');
    expect(cardShardsOf(P, 'iso')).toBe(600);
    expect(cardLevelOf(P, 'iso', 'epic')).toBe(5);
    expect(cardLevelOf(P, 'block_party', 'epic')).toBe(1);
    expect(cardShardsOf(P, 'block_party')).toBe(0);
    expect(P.shards).toBe(0);
    addCardShards(P, 'heckler', cardNeed('epic', 3) - 1, 'epic');
    expect(cardLevelOf(P, 'heckler', 'epic')).toBe(2);
  });
});
