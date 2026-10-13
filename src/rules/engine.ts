// Constants, classes, traits, the Baller catalog and roster building.
import { ri, rnd } from './rng';
import type { ActionType, BallerCard, BallerClass, Catalog, ClassKey, SchemeKey, ShotType, StatKey } from './types';

export const WIN = 21, POSS_CAP = 40, MAX_ST = 10, HAND_MAX = 7, SALARY_CAP = 24, SUB_COST = 2, MAX_FAT = 5,
  FAT_PCT = 10, FAT_DEF_PCT = 5, CONTEST_MAX = 3, MOMENT_COST = 6, MOMENT_FROM = 10;

/** Convex stat curve: 90+ is noticeably better than the step below. */
export const eff = (x: number): number => x + Math.exp((x - 90) / 4);

export interface ClassDef {
  name: string;
  hero: string;
  /** BallerID of the All-Star hero, when known (for the real image). */
  heroId?: number;
  acts: [ActionType, ActionType];
  weak: [SchemeKey, SchemeKey];
  pair: string;
  sig: string;
  moment: string;
}

export const CLASSES: Record<ClassKey, ClassDef> = {
  splash: { name: 'Splash Factory', hero: 'Flowham', heroId: 5316, acts: ['pass', 'screen'], weak: ['close', 'deny'], pair: 'PS', sig: 'Flow State: each Pass gives your shot +3% (max +9%).', moment: 'In the Flow: a 99-Shooting Three worth 4.' },
  three: { name: '3-and-D', hero: '3D', heroId: 9859, acts: ['screen', 'pump'], weak: ['close', 'deny'], pair: 'FS', sig: '3D Vision: your Traps cost 1 less.', moment: 'Third Dimension (defense): their next shot is always read and faces 99 Defense.' },
  show: { name: 'Showtime', hero: 'Kris Kringle', heroId: 9830, acts: ['pass', 'drive'], weak: ['pack', 'deny'], pair: 'DP', sig: 'Gifts: every assist draws a card and gives +1 stamina next possession. Your Alley-oops get +8%.', moment: 'Special Delivery: a 99-Playmaking Alley-oop + 2 Coal into their deck.' },
  pnr: { name: 'Pick and Roll', hero: 'Beatz', heroId: 9832, acts: ['screen', 'drive'], weak: ['pack', 'deny'], pair: 'FP', sig: 'On Beat: alternating Screen/Drive gives +10% each (max +20%).', moment: 'Bass Drop: a 99 Screen (+5 Advantage), their Ballerz +1 fatigue.' },
  bully: { name: 'Bully Ball', hero: 'Cock Diesel', heroId: 9828, acts: ['screen', 'iso'], weak: ['pack', 'close'], pair: 'DF', sig: 'Full Tank: after an Iso, your shooter’s defender gains 1 fatigue.', moment: 'Diesel Engine: a 99 Dunk that ignores the scheme and Traps.' },
  bucket: { name: 'Bucket Getters', hero: 'Silver Fox', heroId: 7353, acts: ['drive', 'pump'], weak: ['pack', 'close'], pair: 'DS', sig: 'Old Man Game: your Pump Fake gives +3 Advantage and baits up to two Traps.', moment: 'Veteran Savvy: a 99-stat shot that ignores the scheme and Traps.' },
};
export const CLS_KEYS = Object.keys(CLASSES) as ClassKey[];
export const SCHEMES: Record<SchemeKey, string> = { pack: 'Pack the Paint', close: 'Close Out', deny: 'Deny the Pass' };
export const ACTIONS: Record<ActionType, { name: string; cost: number; adv: number }> = {
  pass: { name: 'Pass', cost: 1, adv: 2 }, screen: { name: 'Screen', cost: 1, adv: 2 }, drive: { name: 'Drive', cost: 1, adv: 2 },
  pump: { name: 'Pump Fake', cost: 1, adv: 2 }, iso: { name: 'Iso', cost: 2, adv: 2 },
};
export const SHOTS: Record<ShotType, { name: string; pts: number; anchor: [number, number, number, number]; stopF: number; cap: number }> = {
  three: { name: 'Three', pts: 3, anchor: [22, 38, 46, 56], stopF: 0.5, cap: 75 },
  dunk: { name: 'Dunk', pts: 2, anchor: [55, 68, 75, 85], stopF: 0.45, cap: 95 },
  oop: { name: 'Alley-oop', pts: 2, anchor: [52, 64, 72, 82], stopF: 0.5, cap: 95 },
  layup: { name: 'Layup', pts: 2, anchor: [48, 60, 66, 74], stopF: 0.55, cap: 90 },
  fade: { name: 'Fadeaway', pts: 2, anchor: [38, 50, 56, 64], stopF: 0.75, cap: 80 },
};
export const SHOT_KEYS = Object.keys(SHOTS) as ShotType[];
export const INSIDE: ShotType[] = ['dunk', 'layup', 'oop'];
export const ENH_SHOT: Record<number, ShotType> = { 1: 'layup', 2: 'dunk', 3: 'fade', 4: 'three' };
export const ENH_NAME = ['', 'Ankle Breaker', 'Drive the Lane', 'Stopping on a Dime', 'Bullseye'];

export const TRAITS: Record<string, { name: string; text: string; v: number }> = {
  captain: { name: 'Captain', text: 'Teammates get +4% on shots.', v: 2.5 },
  lizard: { name: 'Cold-Blooded', text: 'Clutch: +5% and ignores Distraction.', v: 1.5 },
  stone: { name: 'Rock', text: 'Ignores fatigue from opponent effects.', v: 1.5 },
  zombie: { name: 'Undead', text: 'Once per game: when gassed, fatigue resets to 0.', v: 1.5 },
  bzombie: { name: 'Undead+', text: 'Once per game: when gassed, fatigue resets to 0 and teammates recover 1.', v: 2 },
  alien: { name: 'Abduction', text: 'Check-In: copy a random card from their hand.', v: 2 },
  palien: { name: 'Probe', text: 'Check-In: look at their hand.', v: 1 },
  bpalien: { name: 'Close Encounter', text: 'Check-In: look at their hand and copy a card.', v: 2 },
  devil: { name: 'Deal', text: 'Takes 2 fatigue for +15% on a shot (auto when fresh).', v: 2 },
  emoji: { name: 'Meme Lord', text: 'Your Distraction cards cost 1 less.', v: 1.5 },
  pencil: { name: 'Pencil', text: 'Check-In: draw a card.', v: 1.5 },
  silver: { name: 'Silver Chain', text: 'On Bucket: +1 stamina next possession.', v: 1 },
  steampunk: { name: 'Tinkerer', text: 'Check-In: best of top 3 cards goes on top.', v: 1 },
  glasses: { name: 'Scout', text: 'Check-In: reveal one of their Traps.', v: 1 },
  nasal: { name: 'Nasal Strip', text: 'Recovers 1 extra fatigue per possession.', v: 1 },
  greyhp: { name: 'Locked In', text: 'Ignores Distraction.', v: 1 },
  tattoo: { name: 'Ink', text: 'Clutch: +5% on shots.', v: 1 },
  earrings: { name: 'Flashy', text: 'After a made Dunk, draw a card.', v: 1.5 },
  visor: { name: 'Space Visor', text: 'Alley-oops to this Baller get +10%.', v: 1.5 },
  goggles: { name: 'Glass Cleaner', text: 'On a miss, 25% offensive rebound.', v: 1.5 },
  redhp: { name: 'Hype', text: 'On Bucket: your next shot +5%.', v: 1.5 },
  patch: { name: 'Pirate', text: 'Your steal Traps get +10%.', v: 1.5 },
  clock: { name: 'Clutch Time', text: 'Clutch: +10% on shots.', v: 1.5 },
  gold: { name: 'Gold Chain', text: 'On Bucket: +1 stamina and draw a card.', v: 2.5 },
  cyborg: { name: 'Targeting', text: 'Once per game: a shot ignores the scheme.', v: 2.5 },
  goldhp: { name: 'Main Character', text: 'Your Hero Moment costs 2 less.', v: 2 },
  glasses3d: { name: '3D Glasses', text: 'Counts as Sniper and Lockdown.', v: 2 },
};
const ACC_TRAIT: Record<string, string> = { 'Pencil': 'pencil', 'Silver Chain': 'silver', 'Steampunk Goggles': 'steampunk', 'Glasses': 'glasses', 'Nasal Strip': 'nasal', 'Grey Headphones': 'greyhp', 'Arm Tattoo': 'tattoo', 'Earrings': 'earrings', 'Space Visor': 'visor', 'Goggles': 'goggles', 'Red Headphones': 'redhp', 'Eye Patch': 'patch', 'Clock Necklace': 'clock', 'Gold Chain': 'gold', 'Cyborg Eye': 'cyborg', 'Gold Headphones': 'goldhp', '3D Glasses': 'glasses3d' };
const BODY_TRAIT: Record<string, string> = { 'Lizard': 'lizard', 'Stone': 'stone', 'Zombie': 'zombie', 'Bright Zombie': 'bzombie', 'Alien': 'alien', 'Pink Alien': 'palien', 'Bright Pink Alien': 'bpalien', 'Devil': 'devil', 'Emoji': 'emoji' };

// ---------- catalog ----------
let DATA: Catalog | null = null;
let BY_CLASS: Record<BallerClass, number[][]> | null = null;
const B_BY_ID = new Map<number, number[]>();
const S_BY_ID = new Map<number, number[]>();

/** The rules module gets its data injected, so it runs the same in the browser, in Node and in tests. */
export function loadCatalog(data: Catalog): void {
  DATA = data;
  BY_CLASS = { neutral: [], splash: [], three: [], show: [], pnr: [], bully: [], bucket: [] };
  B_BY_ID.clear();
  S_BY_ID.clear();
  data.B.forEach((b) => {
    B_BY_ID.set(b[0], b);
    if (b[10] === 2) return; // All-Stars are heroes, never roster cards
    BY_CLASS![classOf({ D: b[1], P: b[2], S: b[3], F: b[4] })].push(b);
  });
  data.S.forEach((s) => S_BY_ID.set(s[0], s));
}
export function catalog(): Catalog {
  if (!DATA) throw new Error('Catalog not loaded. Call loadCatalog() first.');
  return DATA;
}
export const ballerRow = (id: number): number[] | undefined => B_BY_ID.get(id);
export const sneakerRow = (id: number): number[] | undefined => S_BY_ID.get(id);
export const classPool = (cls: BallerClass): number[][] => {
  if (!BY_CLASS) throw new Error('Catalog not loaded.');
  return BY_CLASS[cls];
};

export function classOf(st: Pick<Record<StatKey, number>, 'D' | 'P' | 'S' | 'F'>): BallerClass {
  const v = ([['D', st.D], ['P', st.P], ['S', st.S], ['F', st.F]] as [string, number][]).sort((a, b) => b[1] - a[1]);
  if (v[1][1] - v[2][1] < 3) return 'neutral';
  const pair = [v[0][0], v[1][0]].sort().join('');
  return CLS_KEYS.find((k) => CLASSES[k].pair === pair)!;
}

/** Builds a playable Baller card from a Baller row and the Sneaker on his feet. */
export function makeBaller(b: number[], s: number[]): BallerCard {
  const D = catalog();
  const st = { D: b[1], P: b[2], S: b[3], F: b[4], J: s[1] };
  const body = D.bodies[b[5]], acc = b[8] ? D.accs[b[8] - 1] : '';
  const trait = b[10] === 1 ? 'captain' : BODY_TRAIT[body] || ACC_TRAIT[acc] || '';
  const power = (eff(st.D) + eff(st.P) + eff(st.S) + eff(st.F) + eff(st.J)) / 5;
  let salary = Math.max(1, Math.round((power - 70) / 2.5));
  if (trait) salary += Math.round(TRAITS[trait].v / 2);
  if (s[2]) salary += 1;
  if (s[3] === 3 || s[3] === 4) salary += 1;
  return {
    kind: 'baller', key: 'b' + b[0], id: b[0], name: '#' + b[0], st, body, acc, team: D.teams[b[6]], hair: D.hairs[b[7]], flags: b[9], role: b[10],
    cls: classOf(st), trait, enh: s[2], sneaker: { id: s[0], rar: D.rar[s[3]], rarI: s[3], drip: s[5] }, salary, power,
  };
}

export function randBaller(cls: BallerClass): BallerCard {
  const pool = cls === 'neutral' || rnd() < 0.3 ? classPool('neutral') : classPool(cls);
  const S = catalog().S;
  return makeBaller(pool[ri(pool.length)], S[ri(S.length)]);
}

export interface Roster {
  starters: BallerCard[];
  bench: BallerCard[];
  strategy: 'stars' | 'deep';
}

/** Picks 3 starters + 2 bench under the salary cap from 12 random candidates. */
export function buildRoster(cls: ClassKey, strategy?: 'stars' | 'deep'): Roster {
  const strat: 'stars' | 'deep' = strategy || (rnd() < 0.5 ? 'stars' : 'deep');
  for (let t = 0; t < 60; t++) {
    const cand = Array.from({ length: 12 }, () => randBaller(cls));
    let best: { starters: BallerCard[]; bench: BallerCard[] } | null = null, bv = -1;
    const n = cand.length;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) {
      const st = [cand[a], cand[b], cand[c]], s3 = st.reduce((s, x) => s + x.salary, 0);
      if (s3 > SALARY_CAP - 2) continue;
      const rest = cand.map((_x, i) => i).filter((i) => i !== a && i !== b && i !== c);
      for (let d = 0; d < rest.length; d++) for (let e2 = d + 1; e2 < rest.length; e2++) {
        const bn = [cand[rest[d]], cand[rest[e2]]], sal = s3 + bn[0].salary + bn[1].salary;
        if (sal > SALARY_CAP) continue;
        const ps = st.reduce((s, x) => s + x.power, 0), pb = bn[0].power + bn[1].power;
        const v = strat === 'stars' ? ps * 1 + pb * 0.2 : ps * 1 + pb * 0.8;
        if (v > bv) { bv = v; best = { starters: st, bench: bn }; }
      }
    }
    if (best) return { ...best, strategy: strat };
  }
  throw new Error('roster');
}

export const isSniper = (b: BallerCard): boolean => b.st.S >= 90 || b.trait === 'glasses3d';
export const isLockdown = (b: BallerCard): boolean => b.st.F >= 90 || b.trait === 'glasses3d';
export const isFlyer = (b: BallerCard): boolean => b.st.J >= 90;
