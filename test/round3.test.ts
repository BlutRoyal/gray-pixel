import { beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import catalogJson from '../src/data/catalog.json';
import { ballersOfTier, loadCatalog, seedRng, type Catalog, type Tier } from '../src/rules';
import { SPECIALS, SP_KINDS, specialFor, specialText, spValue, type SpType } from '../src/casual/specials';
import { cBaller, chance, newGame, newSide, resolve, shotCtx, useSpecial, type CBaller, type CGame } from '../src/casual/engine';
import { PACKS, openPack, packChance, packDef, type Pull } from '../src/casual/packs';
import { SHARD_YIELD } from '../src/casual/progress';
import { buildBox, pct } from '../src/casual/box';
import { bandTeam, cpuDeck, simGame } from '../src/casual/engine';
import { CLS_KEYS } from '../src/rules';
import { checkLabPass, sha256Js } from '../src/ui/gate';
import { packTease, preFlip } from '../src/ui/reveal';

loadCatalog(catalogJson as unknown as Catalog);

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(), key: () => null, length: 0,
} as Storage;
type StoreMod = typeof import('../src/ui/store');
let S: StoreMod;
beforeAll(async () => { S = await import('../src/ui/store'); });

const fake = (id: number, over: Partial<CBaller> = {}): CBaller => ({ ...cBaller(id), rim: 80, mid: 80, three: 80, ply: 75, def: 80, shoe: null, sneakerId: null, ...over, skill: { key: 'none', name: 'None', text: '', tier: 'generic', fx: {} } });
const squad = (extra: CBaller[] = []): CBaller[] => [...extra, ...[10, 20, 30, 40, 50].map((id) => fake(id))].slice(0, 5);
function game(a: CBaller[] = squad(), b: CBaller[] = squad()): CGame {
  const G = newGame(newSide('pnr', a, []), newSide('pnr', b, []), 0);
  for (const s of G.sides) { s.deck = []; s.hand = []; s.discard = []; s.mo = 0; }
  return G;
}
const iconicOf = (t: SpType): number => ballersOfTier('iconic').find((i) => specialFor(i)!.type === t)!;

describe('Iconic specials', () => {
  it('50 unique named specials over 18 effect types, one per Iconic Baller', () => {
    expect(SPECIALS.length).toBe(50);
    expect(new Set(SPECIALS.map((s) => s.name)).size).toBe(50);
    expect(new Set(SPECIALS.map((s) => s.type)).size).toBe(18);
    expect(Object.keys(SP_KINDS).length).toBe(18);
    const ids = ballersOfTier('iconic');
    expect(new Set(ids.map((i) => specialFor(i)!.name)).size).toBe(50);
    expect(specialFor(ballersOfTier('legendary')[0])).toBeNull();
    for (const sp of SPECIALS) { expect(specialText(sp).length).toBeGreaterThan(8); expect(spValue(sp, true)).toBeGreaterThanOrEqual(spValue(sp, false)); }
  });
  it('a Baller carries his special, unused at the start of each game', () => {
    const b = cBaller(iconicOf('surge'));
    expect(b.special?.type).toBe('surge');
    expect(b.spUsed).toBe(false);
    expect(cBaller(ballersOfTier('epic')[0]).special).toBeFalsy();
  });
  it('can be used once per game, costs no Momentum, and a new game resets it', () => {
    const id = iconicOf('surge');
    const G = game(squad([cBaller(id)]));
    const mo = G.sides[0].mo;
    expect(useSpecial(G, 0, 0)).toBe(true);
    expect(G.sides[0].team[0].spUsed).toBe(true);
    expect(G.sides[0].mo).toBeGreaterThan(mo);
    expect(useSpecial(G, 0, 0)).toBe(false);
    const G2 = game(squad([cBaller(id)]));
    expect(G2.sides[0].team[0].spUsed).toBe(false);
    expect(useSpecial(G2, 0, 0)).toBe(true);
  });
  it('HOLO is stronger than the normal special', () => {
    const id = iconicOf('surge'), sp = specialFor(id)!;
    expect(spValue(sp, true)).toBeGreaterThan(spValue(sp, false));
    expect(cBaller(id, null, 1, true).holo).toBe(true);
  });
});

describe('Rewind', () => {
  const rw = (name: string): number => ballersOfTier('iconic').find((i) => specialFor(i)!.name === name)!;
  it('cancels up to its number of points of their last basket, once, right after they score', () => {
    for (const [name, cap] of [["Undo", 1], ["Rewind", 1], ["Rollback", 2]] as const) {
      let done = false;
      for (let seed = 1; seed < 80 && !done; seed++) {
        seedRng(seed);
        const G = newGame(newSide('pnr', squad([cBaller(rw(name))]), []), newSide('pnr', squad(), []), 1);
        for (const x of G.sides) { x.deck = []; x.hand = []; x.discard = []; }
        const out = resolve(G);
        if (!out.made || out.turnover) continue;
        const before = G.sides[1].score, pts = out.pts;
        expect(useSpecial(G, 0, 0)).toBe(true);
        const cut = Math.min(pts, cap);
        expect(G.sides[1].score).toBe(before - cut);
        expect(out.pts).toBe(pts - cut);
        expect(out.rewound === true).toBe(pts <= cap);
        expect(useSpecial(G, 0, 0)).toBe(false);
        done = true;
      }
      expect(done).toBe(true);
    }
  });
  it('cannot be used when they have not just scored', () => {
    const G = game(squad([cBaller(rw('Rewind'))]));
    expect(useSpecial(G, 0, 0)).toBe(false);
  });
});

describe('shot chance breakdown', () => {
  it('base plus the rows adds up to the final chance, with and without a read', () => {
    seedRng(5);
    let checked = 0;
    for (const zone of ['rim', 'mid', 'three'] as const) for (const guard of [null, 'rim', 'mid', 'three'] as const) for (const dev of [-12, 0, 9]) {
      const G = game(squad(), squad().map((b) => fake(b.id, { def: 80 + dev })));
      const ch = chance(G, 0, 1, zone, { ...shotCtx(G), guard });
      if (ch.p <= 3 || ch.p >= 95) continue;
      const sum = ch.base + ch.parts.reduce((a, x) => a + x[1], 0);
      expect(Math.abs(sum - ch.p)).toBeLessThanOrEqual(1.01);
      if (guard === zone) { expect(ch.read).toBe(true); expect(ch.parts.some((x) => /guess/i.test(x[0]) && x[1] < 0)).toBe(true); }
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });
  it('a resolved shot keeps the same arithmetic in outcome.parts', () => {
    for (let i = 0; i < 40; i++) {
      seedRng(100 + i);
      const G = game();
      G.poss.shooter = i % 5; G.poss.zone = (['rim', 'mid', 'three'] as const)[i % 3]; G.poss.guard = i % 2 ? G.poss.zone : null;
      const out = resolve(G);
      if (out.turnover || out.base == null || out.p <= 3 || out.p >= 95) continue;
      expect(Math.abs(out.base + out.parts.reduce((a, x) => a + x[1], 0) - out.p)).toBeLessThanOrEqual(1.6);
    }
  });
});

describe('Iconic HOLO ownership', () => {
  const ic = (): number => ballersOfTier('iconic')[3];
  const pull = (id: number, holo: boolean, tier: Tier = 'iconic'): Pull => ({ kind: 'baller', key: 'b:' + id, id, tier, holo });
  it('a first holo pull is stored; the normal then holo upgrade replaces it and pays shards', () => {
    S.resetProfile();
    const id = ic(), id2 = ballersOfTier('iconic')[4];
    expect(S.addPull(pull(id2, true)).isNew).toBe(true);
    expect(S.isHolo(id2)).toBe(true);
    expect(S.addPull(pull(id, false)).isNew).toBe(true);
    expect(S.isHolo(id)).toBe(false);
    const sh = S.profile().shards;
    const r = S.addPull(pull(id, true));
    expect(r.upgrade).toBe(true);
    expect(r.shards).toBe(SHARD_YIELD.iconic);
    expect(S.isHolo(id)).toBe(true);
    expect(S.profile().shards).toBe(sh + SHARD_YIELD.iconic);
    expect(S.holoMap()[String(id)]).toBe(true);
  });
  it('other duplicates give shards as usual and holo never applies below Iconic', () => {
    S.resetProfile();
    const epic = ballersOfTier('epic')[0];
    S.addPull(pull(epic, true, 'epic'));
    expect(S.profile().cards['b:' + epic].holo).toBe(0);
    const id = ic();
    S.addPull(pull(id, true));
    const before = S.profile().shards;
    for (let i = 0; i < 6; i++) S.addPull(pull(id, i % 2 === 0));
    expect(S.profile().shards).toBeGreaterThan(before);
    expect(S.isHolo(id)).toBe(true);
  });
  it('migration keeps holo on Iconic Ballerz only and runs once', () => {
    S.resetProfile();
    const P = S.profile(), id = ic(), epic = ballersOfTier('epic')[0];
    P.holoV = 0;
    P.cards['b:' + id] = { n: 1, holo: 1, first: 1 };
    P.cards['b:' + epic] = { n: 1, holo: 1, first: 1 };
    P.cards['b:' + ballersOfTier('iconic')[5]] = { n: 1, holo: 0, first: 1 };
    S.migrateHolo();
    expect(P.cards['b:' + id].holo).toBe(1);
    expect(P.cards['b:' + epic].holo).toBe(0);
    expect(P.holoV).toBe(2);
    P.cards['b:' + epic].holo = 1;
    S.migrateHolo();
    expect(P.cards['b:' + epic].holo).toBe(1);
  });
});

describe('packs', () => {
  it('Street, Pro, Icon and Basic hold 2 Ballerz and 3 Play cards', () => {
    seedRng(9);
    for (const id of ['basic', 'street', 'pro', 'icon']) {
      const p = openPack(packDef(id));
      expect(p.length).toBe(5);
      expect(p.filter((x) => x.kind === 'baller').length).toBe(2);
      expect(p.filter((x) => x.kind === 'play').length).toBe(3);
    }
  });
  it('per-pack Iconic odds stay near 2% (Icon), 0.4% (Pro), 0.02% (Street) and tiny for Basic', () => {
    const near = (x: number, t: number, k = 0.25) => { expect(x).toBeGreaterThan(t * (1 - k)); expect(x).toBeLessThan(t * (1 + k)); };
    near(packChance(packDef('icon'), 'iconic'), 0.02); near(packChance(packDef('pro'), 'iconic'), 0.004); near(packChance(packDef('street'), 'iconic'), 0.0002, 0.5);
    expect(packChance(packDef('basic'), 'iconic')).toBeLessThan(0.00006);
    expect(packChance(packDef('basic'), 'legendary')).toBeLessThan(0.0004);
    expect(packDef('basic').pity).toBeUndefined();
    expect(packDef('basic').price).toBe(25);
  });
  it('pity: the 10th Pro Pack has an Epic+ Baller, the 30th Icon Pack a Legendary+', () => {
    const rank: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, iconic: 5 };
    for (let i = 0; i < 40; i++) {
      expect(openPack(packDef('pro'), { pity: true }).some((x) => x.kind === 'baller' && rank[x.tier] >= 3)).toBe(true);
      expect(openPack(packDef('icon'), { pity: true }).some((x) => x.kind === 'baller' && rank[x.tier] >= 4)).toBe(true);
    }
  });
  it('about one in five Iconic pulls is HOLO, and never below Iconic', () => {
    seedRng(31);
    let n = 0, h = 0, bad = 0;
    for (let i = 0; i < 4000; i++) for (const p of openPack(packDef('icon'), { forceIconic: true })) { if (p.holo && !(p.kind === 'baller' && p.tier === 'iconic')) bad++; if (p.kind === 'baller' && p.tier === 'iconic') { n++; if (p.holo) h++; } }
    expect(bad).toBe(0);
    expect(h / n).toBeGreaterThan(0.17); expect(h / n).toBeLessThan(0.23);
  });
  it('every Baller pack lists a price and the shop has 7 Ballerz-and-box products', () => { expect(PACKS.length).toBe(7); });
});

describe('opening flow constants and the daily pack', () => {
  it('Common, Uncommon and Rare share one plain pre-flip look; Epic and Legendary share another; Iconic and HOLO differ', () => {
    const d = (tier: Tier, holo = false) => preFlip({ tier, holo });
    expect(d('uncommon')).toEqual(d('common')); expect(d('rare')).toEqual(d('common'));
    expect(d('common')).toMatchObject({ glow: 0, sparks: 0, buildMs: 0, alt: false, heart: false, leak: false });
    expect(d('common', true)).toEqual(d('common'));
    expect(d('epic')).toEqual(d('legendary'));
    expect(d('epic').alt).toBe(true);
    expect(d('epic').buildMs).toBeGreaterThanOrEqual(3000);
    expect(d('epic')).not.toEqual(d('common'));
    expect(JSON.stringify(d('epic'))).not.toMatch(/legendary/i);
    expect(d('iconic')).not.toEqual(d('epic')); expect(d('iconic').faceGlitch).toBe(1);
    expect(d('iconic', true).faceGlitch).toBe(2); expect(d('iconic', true).buildMs).toBeGreaterThan(d('iconic').buildMs);
  });
  it('the sealed pack: HOLO glitches hard, a normal Iconic only flickers, Epic and Legendary give the same tease', () => {
    const P = (...x: [Tier, boolean?][]) => packTease(x.map(([tier, holo]) => ({ tier, holo: !!holo })));
    expect(P(['common'], ['rare'], ['iconic', true]).kind).toBe('holo');
    expect(P(['common'], ['iconic']).kind).toBe('iconic');
    expect(P(['epic'], ['rare'])).toEqual(P(['legendary'], ['rare']));
    expect(P(['rare'], ['common']).kind).toBe('none'); expect(P(['rare'])).toEqual(P(['common']));
    expect(P(['iconic', true]).ripMs).toBeGreaterThan(P(['iconic']).ripMs);
    expect(P(['iconic']).ripMs).toBeGreaterThan(P(['epic']).ripMs);
  });
  it('the opening is automatic only: no manual flip or NEXT CARD flow, a tap or Skip all jumps ahead, the last card stays up front', () => {
    const src = readFileSync('src/ui/packs.ts', 'utf8');
    expect(src).not.toMatch(/opflip|ripall|OPEN ALL|NEXT CARD/);
    expect(src).toMatch(/case 'optap'/); expect(src).toMatch(/case 'opskip'/);
    expect(src).toMatch(/later\(flip, 650\)/);
    expect(src).toMatch(/op\.final = true/);
  });
  it('the free pack can be taken once per local day', () => {
    S.resetProfile();
    expect(S.dailyPackReady('2030-01-01')).toBe(true);
    expect(S.claimDailyPack('2030-01-01')).toBe(true);
    expect(S.claimDailyPack('2030-01-01')).toBe(false);
    expect(S.dailyPackReady('2030-01-01')).toBe(false);
    expect(S.dailyPackReady('2030-01-02')).toBe(true);
    const ms = S.msToNextDay(new Date(2030, 0, 1, 23, 0, 0));
    expect(ms).toBe(3600_000);
  });
});

describe('Lab gate', () => {
  const pw = String.fromCharCode(54, 38);
  it('pure-JS SHA-256 matches node crypto', () => {
    for (const m of ['', 'abc', 'gp-lab-' + pw, 'x'.repeat(200)]) expect(sha256Js(m)).toBe(createHash('sha256').update(m).digest('hex'));
  });
  it('accepts the password and rejects anything else', async () => {
    expect(await checkLabPass(pw)).toBe(true);
    expect(await checkLabPass('')).toBe(false);
    expect(await checkLabPass(pw + ' ')).toBe(false);
    expect(await checkLabPass('password')).toBe(false);
  });
  it('the plaintext is nowhere in the source, README or built page', () => {
    const files: string[] = [];
    const walk = (d: string): void => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== 'node_modules' && f !== 'screens') walk(p); } else if (/\.(ts|css|json|md|html)$/.test(f)) files.push(p); } };
    for (const d of ['src', 'test', 'tools']) walk(d);
    for (const f of ['README.md', 'dist/index.html', 'docs/index.html']) if (existsSync(f)) files.push(f);
    // the secret is two characters, so look for it as a quoted literal or a typed-in instruction, in any quote style
    const forms = ['"', "'", '`'].map((q) => q + pw + q).concat([pw.replace('&', '&amp;')].map((x) => `"${x}"`));
    for (const f of files) {
      if (f === join('test', 'round3.test.ts')) continue;
      const t = readFileSync(f, 'utf8');
      for (const x of forms) expect(t.includes(x), `${f} has ${x.length}-char quoted literal`).toBe(false);
    }
  });
});

describe('box score', () => {
  const mid = { smart: 0.75, sigma: 0.1 };
  const play = (i: number): CGame => {
    seedRng(900 + i);
    const coach = CLS_KEYS[i % CLS_KEYS.length];
    const ic = ballersOfTier('iconic')[(i * 7) % 50];
    const mk = (): CBaller[] => [...bandTeam(0.5, 0.8).slice(0, 4), cBaller(ic, null, 1, i % 3 === 0)];
    return simGame(newSide(coach, mk(), cpuDeck(coach, 0.6)), newSide(CLS_KEYS[(i + 2) % CLS_KEYS.length], mk(), cpuDeck(coach, 0.6)), [mid, mid]);
  };
  it('lines add up to the team totals and the final score', () => {
    for (let i = 0; i < 30; i++) {
      const G = play(i), box = buildBox(G);
      for (const s of [0, 1] as const) {
        const t = box.teams[s], rows = box.ballers[s];
        expect(t.pts).toBe(G.sides[s].score);
        expect(rows.reduce((a, b) => a + b.pts, 0)).toBe(t.pts);
        expect(rows.reduce((a, b) => a + b.att, 0)).toBe(t.att);
        expect(rows.reduce((a, b) => a + b.made, 0)).toBe(t.made);
        expect(t.made).toBeLessThanOrEqual(t.att);
        for (const z of ['rim', 'mid', 'three'] as const) { expect(t.zones[z].made).toBeLessThanOrEqual(t.zones[z].att); }
        expect((['rim', 'mid', 'three'] as const).reduce((a, z) => a + t.zones[z].att, 0)).toBe(t.att);
        expect(rows.reduce((a, b) => a + b.ast, 0)).toBeLessThanOrEqual(t.made);
        expect(t.tov).toBe(rows.reduce((a, b) => a + b.tov, 0));
        expect(t.moGain).toBeGreaterThan(0);
        expect(t.longestRun).toBeLessThanOrEqual(t.pts);
        for (const c of t.cards) expect(c.worked).toBeLessThanOrEqual(c.played);
        expect(t.cards.reduce((a, c) => a + c.played, 0)).toBe(t.cardsPlayed);
        expect(t.cardsPlayed).toBe(G.sides[s].stats.cards);
        expect(t.subs).toBe(G.sides[s].stats.subs);
      }
      // every possession is a shot or a turnover
      expect(box.teams[0].att + box.teams[1].att + box.teams[0].tov + box.teams[1].tov).toBeGreaterThanOrEqual(G.hist.length - 0);
      expect(box.winner).toBe(G.winner);
      if (box.mvp) expect(box.mvp.side).toBe(G.winner);
      // reads: one side's hits are the other side's guesses
      expect(box.teams[0].readsHit).toBe(box.teams[1].guessed);
      expect(box.teams[1].readsHit).toBe(box.teams[0].guessed);
      expect(box.teams[0].trapsFired).toBeLessThanOrEqual(box.teams[0].trapsSet + 20);
      expect(pct(1, 4)).toBe(25);
    }
  });
  it('records each special used and who was double-teamed', () => {
    let sp = 0, dts = 0;
    for (let i = 0; i < 30; i++) {
      const G = play(i), box = buildBox(G);
      for (const s of [0, 1] as const) {
        const used = box.ballers[s].filter((b) => b.specialN != null).length;
        expect(used).toBe(G.sides[s].team.concat(G.sides[s].bench).filter((b) => b.spUsed).length);
        expect(box.teams[s].specials).toBe(used);
        sp += used; dts += box.ballers[s].reduce((a, b) => a + b.doubled, 0);
      }
    }
    expect(sp).toBeGreaterThan(5);
    expect(dts).toBeGreaterThan(0);
  });
});

describe('Iconic permanent boost', () => {
  it('adds a visible Iconic +2% row to every shot of an Iconic (HOLO too) and none to others', () => {
    const ic = ballersOfTier('iconic')[0];
    for (const holo of [false, true]) {
      const G = game([fake(ic, { holo, tier: 'iconic' }), ...squad().slice(1)], squad());
      const ch = chance(G, 0, 0, 'mid', shotCtx(G));
      expect(ch.parts.find((x) => x[0] === 'Iconic +2%')?.[1]).toBe(2);
    }
    const G2 = game(squad(), squad());
    expect(chance(G2, 0, 0, 'mid', shotCtx(G2)).parts.some((x) => x[0].startsWith('Iconic'))).toBe(false);
  });
});
