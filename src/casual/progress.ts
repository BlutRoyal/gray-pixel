// Progression: shards and Baller levels, game rewards, stars, daily bonus and star milestones. DOM-free (works on any object
// shaped like `Prog`), so the economy tool and the tests use the same code as the UI.
import type { Tier } from '../rules';
import type { CGame } from './engine';

export interface Prog {
  bucks: number;
  shards: number;
  /** Baller id to level (1..5). Missing = level 1. */
  levels: Record<string, number>;
  /** Stars (0..3) per story stage. */
  stars: number[];
  /** Star milestones already claimed (their index). */
  claimed: number[];
  /** Packs opened of each kind, for the pity guarantee. */
  pity: Record<string, number>;
  /** Play card key to shards earned by duplicates of THAT card (not the global pool). Level 1..5 follows from the total. */
  cardShards?: Record<string, number>;
  /** Day of the last daily first-win bonus (YYYY-MM-DD, local) and the current streak of days. */
  daily: { day: string; streak: number };
}

// ---------- shards and levels ----------
export const LEVEL_MAX = 5;
/** Shards a duplicate turns into. */
export const SHARD_YIELD: Record<Tier, number> = { common: 4, uncommon: 8, rare: 16, epic: 50, legendary: 150, iconic: 500 };
/** Shards for the first level-up of a Baller of this tier; the next ones cost x2, x3, x5. */
const LEVEL_BASE: Record<Tier, number> = { common: 20, uncommon: 30, rare: 45, epic: 100, legendary: 250, iconic: 600 };
const LEVEL_STEP = [1, 2, 3, 5];
/** Shards needed to go from `level` to `level + 1` (0 at the max). */
export const levelCost = (tier: Tier, level: number): number => (level >= LEVEL_MAX ? 0 : LEVEL_BASE[tier] * LEVEL_STEP[level - 1]);
export const maxCost = (tier: Tier): number => LEVEL_STEP.reduce((a, m) => a + LEVEL_BASE[tier] * m, 0);
/** Copies of a card worth keeping: a Play card up to 2 for decks (an Iconic 1), a Baller or Sneaker 1. More turn into shards. */
export const keepCopies = (key: string, tier: string): number => (key[0] === 'p' ? (tier === 'iconic' ? 1 : 2) : 1);
/** Selling shards: Bucks per shard (Recycle). */
export const SHARD_BUCKS = 0.5;
export const levelOf = (P: Pick<Prog, 'levels'>, id: number): number => Math.max(1, Math.min(LEVEL_MAX, P.levels[id] || 1));
/** Spends shards on the next level of a Baller. Returns false when he is maxed or the shards fall short. */
export function levelUp(P: Prog, id: number, tier: Tier): boolean {
  const lv = levelOf(P, id), cost = levelCost(tier, lv);
  if (!cost || P.shards < cost) return false;
  P.shards -= cost;
  P.levels[id] = lv + 1;
  return true;
}

// ---------- Play card shards and levels ----------
/** Total shards (for that one card) needed to reach level 5. Tier names as the player sees them: Common (Basic), Rare, Epic, Legendary, Iconic. */
export const CARD_L5: Record<Tier, number> = { common: 100, uncommon: 150, rare: 250, epic: 600, legendary: 1500, iconic: 4000 };
/** Share of the level-5 total needed for levels 2, 3, 4, 5 (cumulative steps 1, 3, 6, 11 of 11): the last levels cost the most. */
const CARD_CUM = [1, 3, 6, 11];
/** Total card shards needed to HAVE level `lv` (2..5). */
export const cardNeed = (tier: Tier, lv: number): number => (lv <= 1 ? 0 : Math.ceil((CARD_L5[tier] * CARD_CUM[Math.min(5, lv) - 2]) / 11));
export const cardLevelAt = (shards: number, tier: Tier): number => { let lv = 1; for (let l = 2; l <= LEVEL_MAX; l++) if (shards >= cardNeed(tier, l)) lv = l; return lv; };
export const cardShardsOf = (P: Pick<Prog, 'cardShards'>, key: string): number => (P.cardShards && P.cardShards[key]) || 0;
export const cardLevelOf = (P: Pick<Prog, 'cardShards'>, key: string, tier: Tier): number => cardLevelAt(cardShardsOf(P, key), tier);
/** Adds shards to one card. Returns the new level. */
export function addCardShards(P: Prog, key: string, n: number, tier: Tier): number {
  if (!P.cardShards) P.cardShards = {};
  P.cardShards[key] = (P.cardShards[key] || 0) + n;
  return cardLevelAt(P.cardShards[key], tier);
}

// ---------- game rewards ----------
export const QUICK_WIN = 40;
export const QUICK_LOSS = 12;
export const SHARDS_WIN = 6;
export const SHARDS_LOSS = 2;
/** Replays of a cleared court pay this share of its reward. */
export const REPLAY_SHARE = 0.4;
export const DAILY_BUCKS = 60;
export const DAILY_SHARDS = 20;
export const BOSS_REPLAY_SHARDS = 15;

/** Local day as YYYY-MM-DD. */
export const dayKey = (d = new Date()): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayNum = (k: string): number => { const [y, m, d] = k.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };

/** Stars for one game: 1 for the win, 2 for winning by 7 or more, 3 for winning by 10 or more with at most 2 turnovers. */
export const STAR_TEXT = ['Win the game', 'Win by 7 or more', 'Win by 10 or more with 2 turnovers at most'];
export function starsFor(g: Pick<CGame, 'winner' | 'sides' | 'hist'>): number {
  if (g.winner !== 0) return 0;
  const margin = g.sides[0].score - g.sides[1].score;
  const tov = g.hist.filter((h) => h.side === 0 && h.outcome.turnover).length;
  return 1 + (margin >= 7 ? 1 : 0) + (margin >= 10 && tov <= 2 ? 1 : 0);
}
export const totalStars = (P: Pick<Prog, 'stars'>): number => P.stars.reduce((a, b) => a + (b || 0), 0);

export interface Milestone { stars: number; bucks?: number; shards?: number; pack?: string }
export const MILESTONES: Milestone[] = [
  { stars: 3, bucks: 80 }, { stars: 6, pack: 'street' }, { stars: 9, bucks: 150, shards: 60 }, { stars: 12, pack: 'pro' },
  { stars: 15, shards: 200 }, { stars: 18, pack: 'pro', bucks: 150 }, { stars: 21, pack: 'icon' }, { stars: 24, pack: 'icon', shards: 500 },
];
export const milestoneText = (m: Milestone): string => [m.bucks ? `${m.bucks} Bucks` : '', m.shards ? `${m.shards} shards` : '', m.pack ? `a ${m.pack[0].toUpperCase() + m.pack.slice(1)} Pack` : ''].filter(Boolean).join(' + ');
/** Milestones that are reached but not claimed. */
export const claimable = (P: Prog): number[] => MILESTONES.map((m, i) => (totalStars(P) >= m.stars && !P.claimed.includes(i) ? i : -1)).filter((i) => i >= 0);

export interface StageReward { reward: number; pack: string; boss?: { name: string; bucks: number; pack: string } }
export interface GameResult { won: boolean; stage: number; reward?: StageReward; stars: number; today?: string }
export interface Rewards {
  bucks: number;
  shards: number;
  /** Lines for the reward popup: [label, Bucks, shards]. */
  lines: [string, number, number][];
  stars: number;
  /** Stars gained on top of the best result so far. */
  newStars: number;
  firstClear: boolean;
  dailyDay: number;
  /** Packs to open now: first clear of a court, boss. */
  packs: string[];
  bossName?: string;
  milestones: number[];
}
/** Works out what a finished game pays and applies it to the profile (Bucks, shards, stars, daily streak). `cleared` = the court was already beaten before. */
export function applyGame(P: Prog, r: GameResult): Rewards {
  const out: Rewards = { bucks: 0, shards: 0, lines: [], stars: r.stars, newStars: 0, firstClear: false, dailyDay: 0, packs: [], milestones: [] };
  const add = (label: string, b: number, s: number) => { if (b || s) { out.lines.push([label, b, s]); out.bucks += b; out.shards += s; } };
  if (r.stage < 0) {
    add(r.won ? 'Quick Play win' : 'Quick Play', r.won ? QUICK_WIN : QUICK_LOSS, r.won ? SHARDS_WIN : SHARDS_LOSS);
  } else {
    const st = r.reward!;
    const first = r.won && (P.stars[r.stage] || 0) === 0;
    out.firstClear = first;
    if (r.won && first) {
      add('First clear', st.reward, 10 + r.stage * 4);
      out.packs.push(st.pack);
    } else if (r.won) add('Replay win', Math.round(st.reward * REPLAY_SHARE), SHARDS_WIN);
    else add('Game over', 10, SHARDS_LOSS);
    if (r.won && st.boss) {
      if (first) { add(`Boss: ${st.boss.name}`, st.boss.bucks, 30); out.packs.push(st.boss.pack); out.bossName = st.boss.name; }
      else add('Boss bonus', 0, BOSS_REPLAY_SHARDS);
    }
    const prev = P.stars[r.stage] || 0;
    out.newStars = Math.max(0, r.stars - prev);
    if (out.newStars) { P.stars[r.stage] = r.stars; add(`${out.newStars} new star${out.newStars > 1 ? 's' : ''}`, out.newStars * 15, 0); }
  }
  if (r.won && r.today) {
    const d = P.daily;
    if (d.day !== r.today) {
      const streak = d.day && dayNum(r.today) - dayNum(d.day) === 1 ? d.streak + 1 : 1;
      P.daily = { day: r.today, streak };
      out.dailyDay = streak;
      add(`Daily first win, day ${streak}`, DAILY_BUCKS + 20 * Math.min(streak - 1, 4), DAILY_SHARDS);
    }
  }
  P.bucks += out.bucks;
  P.shards += out.shards;
  out.milestones = claimable(P);
  return out;
}
/** Claims a star milestone: Bucks and shards go to the profile, the pack id (if any) is returned to open. */
export function claimMilestone(P: Prog, i: number): { ok: boolean; pack?: string } {
  const m = MILESTONES[i];
  if (!m || P.claimed.includes(i) || totalStars(P) < m.stars) return { ok: false };
  P.claimed.push(i);
  P.bucks += m.bucks || 0;
  P.shards += m.shards || 0;
  return { ok: true, pack: m.pack };
}
