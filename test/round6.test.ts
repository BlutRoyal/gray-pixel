// Round 6: reveal styles as data, clean card fronts, card backs.
import { describe, expect, it } from 'vitest';
import { preFlip, styled } from '../src/ui/reveal';
import { ballerCardHTML, playCardHTML, sneakerCardHTML } from '../src/ui/views';
import { ballerTier, ballersOfTier, loadCatalog, type Catalog } from '../src/rules';
import catalogJson from '../src/data/catalog.json';
loadCatalog(catalogJson as unknown as Catalog);
import { allCards } from '../src/casual/cards';

describe('opening look', () => {
  it('Epic and Legendary stay identical face down; Common has no build-up; the shake is calmed; Iconic keeps its sparks', () => {
    expect(styled(preFlip({ tier: 'epic' }))).toEqual(styled(preFlip({ tier: 'legendary' })));
    expect(styled(preFlip({ tier: 'common' })).buildMs).toBe(0);
    expect(styled(preFlip({ tier: 'epic' })).shake).toBeLessThan(preFlip({ tier: 'epic' }).shake);
    expect(styled(preFlip({ tier: 'iconic', holo: true })).sparks).toBeGreaterThan(0);
  });
});
describe('card fronts are clean', () => {
  const id = ballersOfTier('iconic')[0] as unknown as number;
  const bid = typeof id === 'number' ? id : (id as { id: number }).id;
  it('Baller front: four game numbers, no long text', () => {
    const h = ballerCardHTML(bid, {});
    expect(h).toContain('cgame'); expect(h).toContain(`data-ck="b:${bid}"`);
    expect(h).not.toContain('ctrait'); expect(h).not.toContain('csp'); expect(h).not.toContain('cstats');
    expect(ballerTier(bid)).toBe('iconic');
  });
  it('Sneaker and Play fronts carry their key and stay short', () => {
    expect(sneakerCardHTML(1, {})).toContain('data-ck="s:1"');
    const c = allCards()[0];
    const h = playCardHTML(c.k, {});
    expect(h).toContain(`data-ck="p:${c.k}"`); expect(h).not.toContain('pflav');
  });
});
