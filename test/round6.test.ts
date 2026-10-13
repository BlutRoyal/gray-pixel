// Round 6: reveal styles as data, clean card fronts, card backs.
import { describe, expect, it } from 'vitest';
import { GLITCH_STYLES, REVEAL_STYLES, getGlitchId, getRevealId, preFlip, styled } from '../src/ui/reveal';
import { ballerCardHTML, playCardHTML, sneakerCardHTML } from '../src/ui/views';
import { ballerTier, ballersOfTier, loadCatalog, type Catalog } from '../src/rules';
import catalogJson from '../src/data/catalog.json';
loadCatalog(catalogJson as unknown as Catalog);
import { allCards } from '../src/casual/cards';

describe('reveal styles', () => {
  it('default is clean with the current glitch, and every preset is complete', () => {
    expect(getRevealId()).toBe('clean'); expect(getGlitchId()).toBe('slice');
    expect(Object.keys(REVEAL_STYLES).sort()).toEqual(['cinematic', 'classic', 'clean']);
    expect(Object.keys(GLITCH_STYLES).sort()).toEqual(['fast', 'slice', 'v10']);
  });
  it('clean: no rain or shake except Iconic, particles only for Iconic, calmer build-up; Epic and Legendary stay identical face down', () => {
    const c = REVEAL_STYLES.clean;
    expect(c.rain).toBe('iconic'); expect(c.quake).toBe('iconic'); expect(c.burst).toBe('iconic'); expect(c.hintSparks).toBe(false);
    expect(styled(preFlip({ tier: 'epic' }), c)).toEqual(styled(preFlip({ tier: 'legendary' }), c));
    expect(styled(preFlip({ tier: 'common' }), c).buildMs).toBe(0);
    expect(styled(preFlip({ tier: 'epic' }), c).shake).toBeLessThan(preFlip({ tier: 'epic' }).shake);
    expect(styled(preFlip({ tier: 'iconic', holo: true }), c).sparks).toBeGreaterThan(0);
  });
  it('cinematic keeps the round 4 build-up unchanged, classic has a short one', () => {
    expect(styled(preFlip({ tier: 'epic' }), REVEAL_STYLES.cinematic)).toEqual(preFlip({ tier: 'epic' }));
    expect(styled(preFlip({ tier: 'epic' }), REVEAL_STYLES.classic).buildMs).toBeLessThan(1500);
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
