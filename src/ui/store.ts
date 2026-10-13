// Player profile (Bucks, collection, record), kept in this browser only. Every access is guarded:
// storage can be missing or blocked, and the demo must still work without it.
import { SHARD_BUCKS, SHARD_YIELD, addCardShards, keepCopies, type Prog } from '../casual/progress';
import type { Pull } from '../casual/packs';
const KEY = 'ballerz_ccg_v1';

export interface Owned {
  n: number;
  holo: number;
  /** Time of the first pull, for "new" badges. */
  first: number;
}
export interface Profile extends Prog {
  v: 1;
  cards: Record<string, Owned>;
  packs: number;
  wins: number;
  losses: number;
  crt: boolean;
  music: boolean;
  /** Fast possession animations (about 1 s instead of 2-3 s). */
  fast: boolean;
  /** Squad: five Baller ids from the collection. The first three start, the other two are the bench. */
  squad: number[];
  /** Sneakers worn by squad Ballerz: Baller id to Sneaker id. Equipped by hand in the squad view. */
  shoes: Record<string, number>;
  /** v2 cards unlocked from the Lab until packs carry them (card key to copies). */
  v2: Record<string, number>;
  coach: string;
  /** Story stages cleared (0..8). */
  story: number;
  /** Decks built by hand, per coach class: card keys, copies repeated. Empty = the game builds one. */
  decks: Record<string, string[]>;
  /** Packs won but not opened yet (story, bosses, star rewards). */
  pending: string[];
  /** Guided first game: new = not played yet (starts by itself), done, skipped, legacy = a save from before the guided game (never forced). `pack` = the free pack was given. */
  tut: { state: 'new' | 'done' | 'skipped' | 'legacy'; pack: boolean };
}
export const START_BUCKS = 300;

const fresh = (): Profile => ({ v: 1, bucks: START_BUCKS, cards: {}, packs: 0, wins: 0, losses: 0, crt: true, music: true, fast: false, squad: [], shoes: {}, v2: {}, coach: 'splash', story: 0, shards: 0, levels: {}, stars: [], claimed: [], pity: {}, daily: { day: '', streak: 0 }, cardShards: {}, decks: {}, pending: [], tut: { state: 'new', pack: false } });
let P: Profile = load();

/** Older saves: courts cleared before stars existed count as one star each. */
function migrate(p: Profile): Profile {
  if (!Array.isArray(p.stars)) p.stars = [];
  for (let i = 0; i < p.story; i++) if (!p.stars[i]) p.stars[i] = 1;
  if (!p.pity) p.pity = {};
  if (!p.levels) p.levels = {};
  if (!p.cardShards) p.cardShards = {};
  if (!p.claimed) p.claimed = [];
  if (!p.daily) p.daily = { day: '', streak: 0 };
  if (!p.decks) p.decks = {};
  if (!p.pending) p.pending = [];
  if (!p.tut) p.tut = { state: 'legacy', pack: false };
  return p;
}
function load(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Profile;
      if (p && p.v === 1) {
        // a save from before the guided game: the old six-slide intro (or any game played) means the player is not forced through it
        if (!p.tut) {
          let old = false;
          try { old = localStorage.getItem('ballerz_tut_v1') === '1'; } catch { /* no storage */ }
          p.tut = { state: old || p.wins + p.losses > 0 || p.story > 0 ? 'legacy' : 'new', pack: false };
        }
        return migrate({ ...fresh(), ...p });
      }
    }
  } catch { /* storage unavailable */ }
  const f = fresh();
  try { if (localStorage.getItem('ballerz_tut_v1') === '1') f.tut.state = 'legacy'; } catch { /* no storage */ }
  return f;
}
export function save(): void {
  try { localStorage.setItem(KEY, JSON.stringify(P)); } catch { /* storage unavailable */ }
}
export const profile = (): Profile => P;
export function addBucks(n: number): void { P.bucks = Math.max(0, P.bucks + n); save(); }
export function spend(n: number): boolean { if (P.bucks < n) return false; P.bucks -= n; save(); return true; }
export function addCard(key: string, holo: boolean): boolean {
  const o = P.cards[key];
  const isNew = !o;
  if (o) { o.n++; if (holo) o.holo++; } else P.cards[key] = { n: 1, holo: holo ? 1 : 0, first: Date.now() };
  return isNew;
}
export function setCrt(on: boolean): void { P.crt = on; save(); }
export function setFast(on: boolean): void { P.fast = on; save(); }
export function setMusic(on: boolean): void { P.music = on; save(); }
export function countGame(won: boolean): void { if (won) P.wins++; else P.losses++; save(); }
export function resetProfile(): void { P = fresh(); save(); }
/** Stores a pulled card. A duplicate beyond the copies a deck can use turns into shards (more for rarer cards). */
export function addPull(p: Pull): { isNew: boolean; shards: number; card: boolean } {
  const o = P.cards[p.key];
  if (!o) { P.cards[p.key] = { n: 1, holo: p.holo ? 1 : 0, first: Date.now() }; return { isNew: true, shards: 0, card: false }; }
  if (p.holo) o.holo++;
  if (o.n < keepCopies(p.key, p.tier)) { o.n++; return { isNew: false, shards: 0, card: false }; }
  const shards = SHARD_YIELD[p.tier];
  // a duplicate Play card feeds THAT card's own level; Ballerz and Sneakerz feed the shared pool
  if (p.key.startsWith('p:')) { addCardShards(P, p.key.slice(2), shards, p.tier); return { isNew: false, shards, card: true }; }
  P.shards += shards;
  return { isNew: false, shards, card: false };
}
export function sellShards(n: number): number {
  n = Math.min(n, P.shards);
  const b = Math.floor(n * SHARD_BUCKS);
  P.shards -= n;
  P.bucks += b;
  save();
  return b;
}
