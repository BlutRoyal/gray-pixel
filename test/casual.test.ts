import { describe, expect, it } from 'vitest';
import catalogJson from '../src/data/catalog.json';
import { C, CLS_KEYS, loadCatalog, seedRng, type Catalog } from '../src/rules';
import { allCards, ccard, isHard, isTrap } from '../src/casual/cards';
import { ENH, positionOf, shoeOf, skillFor, SNEAKER_BONUS } from '../src/casual/skills';
import {
  TUNING, FATIGUE, canShoot, shooterSlots, assistBonus, autoMatch, bandTeam, buildDeck, cBaller, canAdd, chance, chanceNow, cpuDeck, cycleMatch, doSub, equip, fatigueOf, lowLabel,
  newGame, newSide, nextPossession, options, playBlock, playCard, resolve, setDT, shotCtx, simGame, starterIds, subBlock, validateDeck, type CBaller, type CGame,
} from '../src/casual/engine';
import { STAGES, cpuSide } from '../src/casual/story';
import { simPossession } from '../src/casual/engine';
const simPossessionFor = (G: CGame) => simPossession(G, [skill, skill]);

loadCatalog(catalogJson as unknown as Catalog);
const skill = { smart: 0.7, sigma: 0.11 };

/** A Baller with fixed ratings, so rules can be tested without luck. */
function fake(id: number, over: Partial<CBaller> = {}): CBaller {
  return { ...cBaller(id), rim: 80, mid: 80, three: 80, ply: 75, def: 80, shoe: null, sneakerId: null, ...over, skill: { key: 'none', name: 'None', text: '', tier: 'generic', fx: {} } };
}
const squad = (mod: (b: CBaller, i: number) => Partial<CBaller> = () => ({})): CBaller[] => [10, 20, 30, 40, 50].map((id, i) => fake(id, mod(cBaller(id), i)));
function game(a: CBaller[] = squad(), b: CBaller[] = squad(), first: 0 | 1 = 0): CGame {
  const G = newGame(newSide('pnr', a, []), newSide('pnr', b, []), first);
  for (const S of G.sides) { S.deck = []; S.hand = []; S.discard = []; S.mo = 0; }
  return G;
}
const give = (G: CGame, s: 0 | 1, ...keys: string[]) => { G.sides[s].hand.push(...keys.map((k) => ccard(k)!)); };

describe('casual rules v2', () => {
  it('rebuilds every design card and adds the v2 cards', () => {
    const base = allCards().filter((c) => !c.v2);
    expect(base.length).toBe(C.filter((c) => c.r !== ('token' as never)).length);
    for (const k of ['iso', 'four_point', 'bad_shot', 'heave', 'pick_pocket', 'passing_lane', 'shot_clock', 'block_party', 'shutdown', 'trap_sense', 'send_help']) expect(ccard(k), k).toBeTruthy();
    for (const c of allCards()) { expect(c.text.length).toBeGreaterThan(5); expect(c.flavor.length, c.k).toBeGreaterThan(5); }
  });
  it('prices cards by rarity: 0, 0, 2, 4, 6, and a Heave takes the whole bar', () => {
    const cost = (k: string) => ccard(k)!.cost;
    expect(cost('swing_pass')).toBe(0);
    expect(allCards().filter((c) => c.rarity === 'common').every((c) => c.cost === 0)).toBe(true);
    expect(allCards().filter((c) => c.rarity === 'epic').every((c) => c.cost === 2)).toBe(true);
    expect(cost('iso')).toBe(4);
    expect(ccard('iso')!.rarity).toBe('legendary');
    expect(cost('overclock')).toBe(6);
    expect(cost('heave')).toBe(TUNING.moMax);
    expect(ccard('heave')!.fx.fixed).toBe(99);
  });
  it('is deterministic for a seed', () => {
    const run = () => { seedRng(7); const G = simGame(newSide('splash', bandTeam(0.4, 0.7), cpuDeck('splash', 0.5)), newSide('bully', bandTeam(0.4, 0.7), cpuDeck('bully', 0.5)), [skill, skill]); return G.log.join('|'); };
    expect(run()).toBe(run());
  });
  it('finishes every coach matchup with a winner at the win target', () => {
    seedRng(99);
    for (const a of CLS_KEYS) for (const b of CLS_KEYS) {
      const G = simGame(newSide(a, bandTeam(0.3, 0.8), cpuDeck(a, 0.6)), newSide(b, bandTeam(0.3, 0.8), cpuDeck(b, 0.6)), [skill, skill]);
      expect(G.over).toBe(true);
      expect(G.winner === 0 || G.winner === 1).toBe(true);
      if (G.n < TUNING.possCap) expect(Math.max(G.sides[0].score, G.sides[1].score)).toBeGreaterThanOrEqual(TUNING.winTo);
    }
  });
  it('gives a new player a playable squad and a valid deck', () => {
    seedRng(3);
    const ids = starterIds();
    expect(new Set(ids).size).toBe(5);
    const deck = buildDeck({}, 'three');
    expect(deck.length).toBe(20);
    expect(validateDeck(deck)).toEqual([]);
    const G = simGame(newSide('three', equip(ids, []), deck), cpuSide(STAGES[0]), [skill, STAGES[0].skill]);
    expect(G.over).toBe(true);
  });
});

describe('decks', () => {
  it('enforces 15-20 cards, copies, traps and hard counters', () => {
    const c = (k: string) => ccard(k)!;
    expect(validateDeck(Array(14).fill(c('swing_pass'))).length).toBeGreaterThan(0);
    const ok = [...Array(2).fill(c('swing_pass')), ...Array(2).fill(c('hydrate')), ...Array(2).fill(c('up_fake')), ...Array(2).fill(c('outlet')), ...Array(2).fill(c('lock_in')), ...Array(2).fill(c('midrange')), c('iso'), c('heave'), c('elbow_jumper')];
    expect(validateDeck(ok)).toEqual([]);
    expect(validateDeck([...ok, c('heave')]).some((m) => m.includes('Heave'))).toBe(true);
    expect(validateDeck([...ok, c('swing_pass')]).some((m) => m.includes('Swing Pass'))).toBe(true);
    const traps = ['help_defense', 'switch', 'hand_face', 'jump_lane', 'pick_pocket'].map(c);
    expect(validateDeck([...ok.slice(0, 12), ...traps]).some((m) => m.includes('Traps'))).toBe(true);
    const hard = ['take_charge', 'block_party', 'shutdown', 'trap_sense'].map(c);
    expect(validateDeck([...ok.slice(0, 14), ...hard.slice(0, 3)]).some((m) => m.includes('hard'))).toBe(true);
    expect(isHard(c('shutdown')) && isTrap(c('shutdown'))).toBe(true);
    expect(canAdd([], c('heave'))).toBe(true);
  });
  it('builds valid decks for the player and the CPU, even when stacked with owned cards', () => {
    seedRng(11);
    const owned: Record<string, number> = {};
    for (const x of allCards()) owned[x.k] = 3;
    for (const coach of CLS_KEYS) {
      expect(validateDeck(buildDeck(owned, coach)), 'player ' + coach).toEqual([]);
      for (const lv of [0, 0.5, 1]) expect(validateDeck(cpuDeck(coach, lv)), 'cpu ' + coach + lv).toEqual([]);
    }
  });
  it('reshuffles the discard when the deck runs out', () => {
    const G = game();
    const S = G.sides[0];
    S.deck = []; S.discard = [ccard('swing_pass')!, ccard('hydrate')!];
    nextPossession(G); nextPossession(G);
    expect(S.hand.length).toBeGreaterThan(0);
    expect(S.discard.length).toBeLessThan(2);
  });
});

describe('Momentum, hand and cards', () => {
  it('lets a side play one card per possession and charges Momentum', () => {
    const G = game();
    const S = G.sides[0];
    S.mo = 7;
    give(G, 0, 'anything_possible', 'monsoon', 'swing_pass', 'attack_rim');
    S.hand = S.hand.filter((c) => c.k !== 'anything_possible');
    expect(playBlock(G, 0, ccard('monsoon')!)).toBeNull();
    expect(playCard(G, 0, S.hand.findIndex((c) => c.k === 'monsoon'))).toBe(true);
    expect(S.mo).toBe(3);
    expect(playBlock(G, 0, ccard('swing_pass')!)).toMatch(/One card/);
    expect(playCard(G, 0, 0)).toBe(false);
  });
  it('refuses a card that costs more Momentum than you have', () => {
    const G = game();
    G.sides[0].mo = 3;
    give(G, 0, 'iso');
    expect(playBlock(G, 0, ccard('iso')!)).toMatch(/4 Momentum/);
  });
  it('gives +1 Momentum per possession, +1 per own basket and +1 per stop, carried over', () => {
    seedRng(5);
    const G = game(squad((_b, i) => ({ rim: 99, mid: 99, three: 99 })), squad((_b, i) => ({ def: 60 })));
    const before = G.sides[0].mo;
    G.poss.shooter = 0; G.poss.zone = 'rim';
    const o = resolve(G);
    const gained = G.sides[0].mo - before;
    expect(gained).toBe(o.made ? 1 : 0);
    expect(G.sides[1].mo).toBe(o.made ? 0 : 1);
    const m0 = G.sides[0].mo;
    nextPossession(G);
    expect(G.sides[1].mo).toBeGreaterThanOrEqual(1);
    expect(G.sides[0].mo).toBe(m0);
  });
  it('lets a counter card cancel the other side\'s card, and Momentum stays spent', () => {
    const G = game();
    G.sides[0].mo = 6; G.sides[1].mo = 6;
    give(G, 0, 'attack_rim'); give(G, 1, 'ball_dont_lie');
    G.poss.zone = 'rim';
    playCard(G, 0, 0); playCard(G, 1, 0);
    const o = resolve(G);
    expect(o.countered).toBe('Attack the Rim');
    expect(o.notes.join(' ')).toMatch(/cancels/);
  });
});

describe('shot chance', () => {
  it('uses the direct defender, not the best one on the other team', () => {
    const G = game(squad(), squad((_b, i) => ({ def: i === 0 ? 99 : 60 })));
    G.sides[1].match = [0, 1, 2];
    const vs99 = chanceNow(G, 0, 'mid', null).p;
    G.sides[1].match = [1, 0, 2];
    const vs60 = chanceNow(G, 0, 'mid', null).p;
    expect(vs60).toBeGreaterThan(vs99);
  });
  it('matches the same position by default and lets matchups be re-assigned', () => {
    const off = squad((_b, i) => ({ pos: (['G', 'W', 'B'] as const)[i] }));
    const def = squad((_b, i) => ({ pos: (['B', 'G', 'W'] as const)[i] }));
    expect(autoMatch(def.slice(0, 3), off.slice(0, 3))).toEqual([1, 2, 0]);
    const G = game(off, def);
    expect(G.sides[1].match).toEqual([1, 2, 0]);
    cycleMatch(G, 1, 0);
    expect(new Set(G.sides[1].match).size).toBe(3);
    expect(G.sides[1].match[0]).toBe(2);
  });
  it('makes Mid the safe zone: a read costs it the least', () => {
    const G = game();
    const drop = (z: 'rim' | 'mid' | 'three') => { const a = chanceNow(G, 0, z, null).p, b = chanceNow(G, 0, z, z).p; return (a - b) / a; };
    expect(drop('mid')).toBeLessThan(drop('rim'));
    expect(drop('mid')).toBeLessThan(drop('three'));
    expect(chanceNow(G, 0, 'mid', null).p).toBeGreaterThan(chanceNow(G, 0, 'three', null).p);
  });
  it('gives the shooter +1% per 5 PLY over 70 from the best free passer, max +6%', () => {
    const lo = squad((_b, i) => ({ ply: 70 }));
    const G = game(lo);
    const none = chanceNow(G, 0, 'mid', null);
    expect(none.parts.find((x) => x[0].startsWith('Assist'))).toBeUndefined();
    G.sides[0].team[1].ply = 85;
    const mid = chanceNow(G, 0, 'mid', null);
    expect(mid.parts.find((x) => x[0].startsWith('Assist'))![1]).toBe(3);
    expect(mid.passer).toBe(1);
    G.sides[0].team[2].ply = 99;
    expect(chanceNow(G, 0, 'mid', null).parts.find((x) => x[0].startsWith('Assist'))![1]).toBe(5);
    expect(assistBonus(fake(1, { ply: 120 }))).toBe(6);
  });
  it('applies fatigue after the start attack on court, step by step, up to the cap', () => {
    const b = fake(1);
    b.run = FATIGUE.start - 1; expect(fatigueOf(b)).toBe(0);
    b.run = FATIGUE.start; expect(fatigueOf(b)).toBe(FATIGUE.step);
    b.run = FATIGUE.start + 2; expect(fatigueOf(b)).toBe(FATIGUE.step * 3);
    b.run = 40; expect(fatigueOf(b)).toBe(FATIGUE.cap);
  });
});

describe('double team', () => {
  it('costs 3 Momentum, benches the marked Baller and frees a teammate', () => {
    const G = game(squad((_b, i) => ({ rim: 70 + i, mid: 70 + i, three: 70 + i, ply: 70 })), squad(), 0);
    const D = G.sides[1];
    D.mo = 2;
    expect(setDT(G, 1, 2)).toBe(false);
    D.mo = 5;
    expect(setDT(G, 1, 2)).toBe(true);
    expect(D.mo).toBe(5 - TUNING.dtCost);
    expect(G.poss.dt!.mark).toBe(2);
    expect(G.poss.dt!.open).toBe(0);
    expect(options(G, 0).some((o) => o.shooter === 2)).toBe(false);
    expect(chanceNow(G, 1, 'mid', null).open).toBe(false);
    const openMan = chanceNow(G, 0, 'mid', null);
    expect(openMan.open).toBe(true);
    expect(openMan.parts.find((x) => x[0] === 'Open man')![1]).toBe(10);
    G.sides[0].team[1].ply = 90;
    expect(chanceNow(G, 0, 'mid', null).parts.find((x) => x[0] === 'Open man')![1]).toBe(15);
    setDT(G, 1, null);
    expect(D.mo).toBe(5);
  });
  it('forces another shooter if the marked Baller tries to shoot', () => {
    const G = game();
    G.sides[1].mo = 5;
    setDT(G, 1, 1);
    G.poss.shooter = 1; G.poss.zone = 'mid';
    const o = resolve(G);
    expect(o.shooter).not.toBe(1);
    expect(o.notes.join(' ')).toMatch(/double teamed/);
  });
});

describe('Iso, hard counters and the 1% floor', () => {
  const trapGame = (...trapKeys: string[]) => {
    const G = game(squad((_b, i) => ({ rim: 90, mid: 90, three: 90 })), squad());
    G.sides[0].mo = 10;
    G.sides[1].traps.push(...trapKeys.map((k) => ccard(k)!));
    return G;
  };
  it('Iso ignores the scheme and a double team, at about 85%', () => {
    const G = trapGame();
    give(G, 0, 'iso');
    G.sides[1].mo = 5;
    setDT(G, 1, 0);
    G.poss.guard = 'rim';
    G.poss.shooter = 0;
    playCard(G, 0, 0);
    const ch = chance(G, 0, 0, 'rim', shotCtx(G));
    expect(ch.read).toBe(false);
    expect(ch.open).toBe(false);
    expect(ch.p).toBeGreaterThanOrEqual(78);
    expect(ch.p).toBeLessThanOrEqual(95);
    const o = resolve(G);
    expect(o.iso).toBe(true);
    expect(o.shooter).toBe(0);
    expect(o.zone).toBe('rim');
  });
  it('Block Party sends a shot to 1% and explains itself; Shutdown caps at 5%', () => {
    let G = trapGame('block_party');
    G.poss.shooter = 0; G.poss.zone = 'rim';
    let o = resolve(G);
    expect(o.p).toBe(1);
    expect(o.blocked).toBe(true);
    expect(o.traps[0].text).toMatch(/Block Party/);
    expect(G.sides[1].traps.length).toBe(0);
    G = trapGame('shutdown');
    G.poss.shooter = 0; G.poss.zone = 'three';
    o = resolve(G);
    expect(o.p).toBeLessThanOrEqual(5);
    expect(o.p).toBeGreaterThanOrEqual(1);
  });
  it('Block Party and Take the Charge can stop an Iso; soft traps cannot', () => {
    let G = trapGame('help_defense');
    give(G, 0, 'iso'); G.poss.shooter = 0; playCard(G, 0, 0);
    let o = resolve(G);
    expect(o.traps.length).toBe(0);
    expect(o.p).toBeGreaterThan(70);
    G = trapGame('block_party');
    give(G, 0, 'iso'); G.poss.shooter = 0; playCard(G, 0, 0);
    o = resolve(G);
    expect(o.p).toBe(1);
    seedRng(1);
    let fouls = 0;
    for (let i = 0; i < 40; i++) { G = trapGame('take_charge'); give(G, 0, 'iso'); G.poss.shooter = 0; playCard(G, 0, 0); if (resolve(G).turnover) fouls++; }
    expect(fouls).toBeGreaterThan(20);
  });
  it('never takes a shot below 1% with stacked traps, and flags a made 1% shot as INHUMAN', () => {
    seedRng(2024);
    let made = 0, tries = 0;
    for (let i = 0; i < 4000 && made === 0; i++) {
      const G = trapGame('block_party', 'shutdown');
      G.sides[0].team.forEach((b) => { b.rim = 60; });
      G.poss.shooter = 0; G.poss.zone = 'rim';
      const o = resolve(G);
      tries++;
      expect(o.p).toBeGreaterThanOrEqual(1);
      if (!o.turnover && o.made) { made++; expect(o.inhuman).toBe(true); expect(o.label).toBe('SYSTEM ERROR'); }
    }
    expect(made).toBe(1);
    expect(tries).toBeGreaterThan(1);
  });
  it('Trap Sense cancels the first trap and says so; turnover traps explain the steal', () => {
    seedRng(8);
    let G = trapGame('block_party');
    give(G, 0, 'trap_sense'); G.poss.shooter = 0; G.poss.zone = 'rim'; playCard(G, 0, 0);
    let o = resolve(G);
    expect(o.p).toBeGreaterThan(20);
    expect(o.traps[0].text).toMatch(/Trap Sense/);
    let stolen = 0;
    for (let i = 0; i < 60; i++) { G = trapGame('pick_pocket'); G.poss.shooter = 0; G.poss.zone = 'mid'; o = resolve(G); if (o.turnover) { stolen++; expect(o.notes.join(' ')).toMatch(/Pick Pocket/); } }
    expect(stolen).toBeGreaterThan(5);
    expect(stolen).toBeLessThan(40);
  });
  it('labels low-chance makes: GLITCHED < 15, OVERCLOCKED < 5, SYSTEM ERROR < 2', () => {
    expect(lowLabel(40)).toBeNull();
    expect(lowLabel(14)).toBe('GLITCHED');
    expect(lowLabel(4)).toBe('OVERCLOCKED');
    expect(lowLabel(1)).toBe('SYSTEM ERROR');
    expect(lowLabel(15)).toBeNull();
  });
  it('Heave goes in at 99% and takes the whole bar', () => {
    const G = game();
    G.sides[0].mo = 10;
    give(G, 0, 'heave');
    G.poss.shooter = 0;
    playCard(G, 0, 0);
    expect(G.sides[0].mo).toBe(0);
    expect(chanceNow(G, 0, 'three', null).p).toBe(99);
  });
});

describe('On Fire', () => {
  it('is removed only by the owner\'s own miss, never by an opponent basket or a teammate', () => {
    seedRng(77);
    const G = game(squad((_b, i) => ({ rim: 60, mid: 60, three: 60, def: 99 })), squad((_b, i) => ({ rim: 99, mid: 99, three: 99, def: 60 })), 1);
    const hot = G.sides[0].team[0];
    hot.streak = 2;
    let theirMakes = 0;
    for (let i = 0; i < 12; i++) {
      for (const S of G.sides) S.team.forEach((x) => { x.hold = 0; }); G.poss.off = 1; G.poss.shooter = i % 3; G.poss.zone = 'rim'; G.poss.guard = null; G.poss.offCard = null; G.poss.defCard = null; G.poss.newTraps = []; G.poss.dt = null;
      const o = resolve(G);
      if (o.made) theirMakes++;
      expect(hot.streak).toBe(2);
      G.over = false;
      G.sides[1].score = 0;
    }
    expect(theirMakes).toBeGreaterThan(3);
    // a teammate making or missing doesn't touch it either
    for (let i = 0; i < 10; i++) {
      for (const S of G.sides) S.team.forEach((x) => { x.hold = 0; }); G.poss.off = 0; G.poss.shooter = 1; G.poss.zone = 'mid'; G.poss.guard = null; G.poss.offCard = null; G.poss.defCard = null; G.poss.newTraps = []; G.poss.dt = null;
      resolve(G); G.over = false; G.sides[0].score = 0;
      expect(hot.streak).toBe(2);
    }
    // his own miss puts it out
    let out = false;
    for (let i = 0; i < 60 && !out; i++) {
      hot.streak = 2;
      for (const S of G.sides) S.team.forEach((x) => { x.hold = 0; }); G.poss.off = 0; G.poss.shooter = 0; G.poss.zone = 'three'; G.poss.guard = null; G.poss.offCard = null; G.poss.defCard = null; G.poss.newTraps = []; G.poss.dt = null;
      const o = resolve(G); G.over = false; G.sides[0].score = 0;
      if (!o.turnover && !o.made) { expect(hot.streak).toBe(0); expect(o.fireOff).toBe(true); out = true; }
      else if (o.made) expect(hot.streak).toBe(3);
    }
    expect(out).toBe(true);
  });
});

describe('subs', () => {
  it('costs Momentum, swaps the Ballerz and starts a 2 possession cooldown for both', () => {
    const G = game();
    const S = G.sides[0];
    expect(subBlock(G, 0, 0, 0)).toMatch(/Momentum/);
    S.mo = 5;
    const out = S.team[0], inn = S.bench[0];
    expect(doSub(G, 0, 0, 0)).toBe(true);
    expect(S.mo).toBe(5 - TUNING.subCost);
    expect(S.team[0]).toBe(inn);
    expect(S.bench[0]).toBe(out);
    expect(subBlock(G, 0, 0, 0)).toMatch(/just subbed/);
    nextPossession(G); nextPossession(G);
    expect(S.team[0].cd).toBe(0);
    S.mo = 5;
    expect(subBlock(G, 0, 0, 0)).toBeNull();
  });
  it('tires the court and rests the bench: 2 possessions recovered per rest', () => {
    const G = game();
    const S = G.sides[0];
    for (let i = 0; i < 20; i++) { G.poss.off = 0; nextPossession(G); G.poss.off = 1; nextPossession(G); }
    // each own turn adds a possession on court
    expect(S.team[0].run).toBeGreaterThan(FATIGUE.start);
    S.bench[0].run = 9;
    G.poss.off = 1; nextPossession(G);
    expect(S.bench[0].run).toBe(7);
    const tired = Math.max(...S.team.map((b) => fatigueOf(b)));
    expect(tired).toBeGreaterThan(0);
  });
  it('needs a couple of subs per game from the AI, not a dozen', () => {
    seedRng(31);
    let subs = 0, n = 0;
    for (let i = 0; i < 20; i++) { const G = simGame(newSide('splash', bandTeam(0.4, 0.7), cpuDeck('splash', 0.5)), newSide('bully', bandTeam(0.4, 0.7), cpuDeck('bully', 0.5)), [skill, skill]); subs += G.sides[0].stats.subs + G.sides[1].stats.subs; n += 2; }
    expect(subs / n).toBeGreaterThan(1);
    expect(subs / n).toBeLessThan(7);
  });
});

describe('Ballerz, skills and Sneakerz', () => {
  it('derives positions and skills deterministically', () => {
    seedRng(1);
    const a = cBaller(100), b = cBaller(100);
    expect(a.pos).toBe(b.pos);
    expect(a.skill.key).toBe(b.skill.key);
    const pos = new Set<string>();
    for (let id = 1; id < 400; id++) pos.add(positionOf({ D: 0 + (id % 40) + 60, P: 60 + ((id * 7) % 40), S: 60 + ((id * 13) % 40), F: 60 + ((id * 3) % 40) }));
    expect(pos.size).toBe(3);
  });
  it('gives generic skills to Common/Rare, named to Epic, strong to Legendary and glitch skills to Iconic', () => {
    expect(skillFor(5, 'B', 'common').tier).toBe('generic');
    expect(skillFor(5, 'G', 'rare').tier).toBe('generic');
    expect(skillFor(5, 'W', 'epic').tier).toBe('epic');
    expect(skillFor(5, 'W', 'legendary').tier).toBe('legendary');
    for (const pos of ['G', 'W', 'B'] as const) for (let id = 0; id < 12; id++) expect(skillFor(id, pos, 'iconic').tier).toBe('iconic');
    const glitch = skillFor(1, 'G', 'iconic');
    expect(glitch.text.length).toBeGreaterThan(10);
    // Glitch Step: the Mid shot ignores Drop
    const mid = ['G', 'W', 'B'].flatMap((p) => [0, 1, 2, 3, 4, 5].map((id) => skillFor(id, p as 'G', 'iconic'))).find((s) => s.key === 'i_glitchstep')!;
    const G = game();
    const b = G.sides[0].team[0];
    b.skill = mid;
    expect(chanceNow(G, 0, 'mid', 'mid').read).toBe(false);
    expect(chanceNow(G, 0, 'mid', 'mid').p).toBeGreaterThan(chanceNow(G, 0, 'mid', null).p - 1);
  });
  it('uses the Sneaker rarity bonus, Jump for the Rim and the enhancement passives', () => {
    expect(SNEAKER_BONUS).toEqual([1, 2, 4, 6, 8, 8]);
    const row = (rar: number, enh = 0, jump = 99) => [1, jump, enh, rar, 0, 3];
    expect(shoeOf(row(0))!.bonus).toBe(1);
    expect(shoeOf(row(4))!.bonus).toBe(8);
    expect(shoeOf(row(5, ENH.bullseye))!.bonus).toBe(8);
    expect(shoeOf(row(5, 0))!.bonus).toBe(2);
    expect(shoeOf(row(5, ENH.ankle))!.bonus).toBe(3);
    expect(shoeOf(row(1, 0, 99))!.jumpRim).toBe(8);
    expect(shoeOf(row(1, 0, 60))!.jumpRim).toBe(0);
    const G = game();
    const b = G.sides[0].team[0];
    const base = chanceNow(G, 0, 'three', null).p;
    b.shoe = shoeOf(row(4))!;
    expect(chanceNow(G, 0, 'three', null).p - base).toBe(8);
    expect(chanceNow(G, 0, 'rim', null).p - chanceNow({ ...G } as CGame, 0, 'rim', null).p).toBe(0);
    // enhancements halve the matching read penalty
    const lose = (enh: number, zone: 'rim' | 'mid' | 'three') => { b.shoe = shoeOf(row(1, enh, 60)); return chanceNow(G, 0, zone, null).p - chanceNow(G, 0, zone, zone).p; };
    expect(lose(ENH.lane, 'rim')).toBeLessThan(lose(0, 'rim'));
    expect(lose(ENH.ankle, 'mid')).toBeLessThan(lose(0, 'mid'));
    expect(lose(ENH.bullseye, 'three')).toBeLessThan(lose(0, 'three'));
    expect(lose(ENH.bullseye, 'rim')).toBe(lose(0, 'rim'));
    b.run = 14;
    b.shoe = shoeOf(row(1, 0, 60));
    const tired = fatigueOf(b);
    b.shoe = shoeOf(row(1, ENH.dime, 60));
    expect(fatigueOf(b)).toBe(tired / 2);
  });
  it('equips Sneakerz by hand or best-first', () => {
    const squadIds = starterIds();
    const sn = [20693, 20663];
    const manual = equip(squadIds, { [squadIds[2]]: sn[0] });
    expect(manual[2].sneakerId).toBe(sn[0]);
    expect(manual[0].sneakerId).toBeNull();
    const auto = equip(squadIds, sn);
    expect(auto.filter((b) => b.sneakerId != null).length).toBe(2);
  });
});

describe('rotation and pass cards', () => {
  it('a Baller who shot sits out his team\'s next two attacks, then is ready again', () => {
    const G = game();
    const S = G.sides[0];
    expect(shooterSlots(G, 0)).toEqual([0, 1, 2]);
    G.poss.off = 0; G.poss.shooter = 1; G.poss.zone = 'mid';
    resolve(G); G.over = false;
    expect(S.team[1].hold).toBe(TUNING.rot);
    nextPossession(G); nextPossession(G); // their attack, then ours
    expect(G.poss.off).toBe(0);
    expect(S.team[1].hold).toBe(TUNING.rot - 1);
    expect(shooterSlots(G, 0)).not.toContain(1);
    expect(canShoot(S.team[1])).toBe(false);
    G.poss.shooter = 0; resolve(G); G.over = false; nextPossession(G); nextPossession(G);
    expect(S.team[1].hold).toBe(TUNING.rot - 2);
    G.poss.shooter = 2; resolve(G); G.over = false; nextPossession(G); nextPossession(G);
    expect(S.team[1].hold).toBe(0);
    expect(shooterSlots(G, 0)).toContain(1);
  });
  it('a cooling shooter is replaced by a ready one, but a pass card lets him shoot anyway', () => {
    const G = game();
    const S = G.sides[0];
    S.team[1].hold = 2;
    G.poss.off = 0; G.poss.shooter = 1; G.poss.zone = 'three';
    expect(shooterSlots(G, 0)).toEqual([0, 2]);
    const o = resolve(G); G.over = false;
    expect(o.shooter).not.toBe(1);
    // with Kick Out in play, the cooling Baller is allowed
    const H = game();
    H.sides[0].team[1].hold = 2; H.sides[0].mo = 5;
    give(H, 0, 'kick_out');
    H.poss.off = 0;
    expect(playCard(H, 0, 0)).toBe(true);
    expect(shooterSlots(H, 0)).toEqual([0, 1, 2]);
    H.poss.shooter = 1; H.poss.zone = 'three';
    expect(resolve(H).shooter).toBe(1);
    expect(H.sides[0].team[1].hold).toBe(TUNING.rot);
  });
  it('pass cards add their boost and the passer\'s assist a second time', () => {
    const G = game();
    G.sides[0].team[2].ply = 95;
    const base = chanceNow(G, 0, 'three', null).p;
    give(G, 0, 'kick_out');
    G.poss.off = 0; playCard(G, 0, 0);
    const c = chanceNow(G, 0, 'three', null);
    expect(c.parts.some(([n]) => n.includes('Kick Out'))).toBe(true);
    expect(c.p - base).toBe(8 + assistBonus(G.sides[0].team[2]) + 4 /* pnr coach: pass cards give +4 more */);
    for (const k of ['swing_pass', 'kick_out', 'hand_off', 'skip_pass']) expect(ccard(k)!.fx.pass, k).toBe(true);
  });
  it('a double team forces the ball to the open man even when he is cooling', () => {
    const G = game();
    G.sides[0].team[0].hold = 0; G.sides[0].team[1].hold = 1; G.sides[0].team[2].hold = 2;
    G.sides[1].mo = 5;
    G.poss.off = 0;
    expect(setDT(G, 1, 0)).toBe(true);
    const open = G.poss.dt!.open;
    expect(shooterSlots(G, 0)).toContain(open);
    expect(shooterSlots(G, 0)).not.toContain(0);
  });
  it('the AI takes only ready shooters (or uses a pass card)', () => {
    seedRng(11);
    for (let g = 0; g < 6; g++) {
      const G = newGame(newSide('splash', bandTeam(0.4, 0.7), cpuDeck('splash', 0.5)), newSide('bully', bandTeam(0.4, 0.7), cpuDeck('bully', 0.5)));
      while (!G.over) {
        const T = G.sides[G.poss.off];
        const holds = new Map(T.team.concat(T.bench).map((b) => [b.id, b.hold]));
        const min = Math.min(...T.team.map((b) => b.hold));
        const o = simPossessionFor(G);
        const card = o.offCard ? allCards().find((c) => c.name === o.offCard) : null;
        if (!card?.fx.pass && !card?.fx.allIn && !o.dt && !o.turnover) expect(holds.get(o.shooterId)! <= min || holds.get(o.shooterId) === 0, 'shooter was ready').toBe(true);
      }
    }
  });
});
