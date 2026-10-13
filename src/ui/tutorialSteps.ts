// Guided first game: the lesson script. DOM-free and engine-free so the sequencing can be tested on its own.
// The game is a normal match to 11 against Rookie Run. `SCENES` forces the situation for each early possession (hand, Momentum,
// who is tired, rigged results) so every lesson is guaranteed to come up; `STEPS` is the list of bubbles, in order.
// A step is shown when the game reaches its possession (`n`) and phase. `click` steps block every other click until the player
// taps the highlighted thing; `info` steps wait for "Got it"; `note` steps show a bubble but block nothing.

export type Phase = 'off' | 'def' | 'result';
export type Topic = 'welcome' | 'shooter' | 'zone' | 'card' | 'go' | 'log' | 'scheme' | 'matchups' | 'momentum' | 'cooling' | 'pass' | 'fire'
  | 'trap' | 'double' | 'subs' | 'clutch' | 'rare' | 'free' | 'wrap';

/** What the game looks like right now (from the host). */
/** `logDocked` = the play-by-play is always on screen (wide layout); `logOpen` = its sheet is open (phones). */
export interface Snap { n: number; phase: Phase; over: boolean; logDocked?: boolean; logOpen?: boolean }
/** Facts the texts and selectors need (names, slots, results). */
export interface Ctx {
  first: string; cool: string; coolIdx: number; dtIdx: number; dtName: string; tired: string; tiredIdx: number;
  hero: string; likes: string; won: boolean; made: boolean; fireOn: boolean; trapFired: boolean; blocked: boolean;
  /** A hand card is open in the enlarged view (the next tap is Play). */
  cardOpen: boolean;
}
export const EMPTY_CTX: Ctx = { first: 'Your shooter', cool: 'He', coolIdx: 0, dtIdx: 0, dtName: 'their star', tired: 'Your starter', tiredIdx: 0, hero: 'The coach', likes: 'Mid', won: true, made: true, fireOn: false, trapFired: false, blocked: false, cardOpen: false };

export interface Step {
  id: string;
  topic: Topic;
  n: number;
  phase: Phase | 'any';
  kind: 'click' | 'info' | 'note';
  title: string;
  text: (c: Ctx) => string;
  /** CSS selector of the thing to point at and highlight. No target = centered bubble. */
  target?: (c: Ctx) => string;
  /** CSS selector of what may be clicked while this step is active (click steps; default = the target). */
  allow?: (c: Ctx) => string;
  /** The event that completes a click step (`v` omitted = any value). */
  want?: { ev: string; v?: (c: Ctx) => string };
  ok?: string;
  /** Only when the game is over (the final whistle). */
  overOnly?: boolean;
  /** Dropped when the game ended on this possession. */
  skipIfOver?: boolean;
  /** Dropped when this returns true for the live position (e.g. the log is already on screen). */
  skipWhen?: (s: Snap) => boolean;
}

const sel = (a: string, v?: string): string => `[data-a="${a}"]${v != null ? `[data-v="${v}"]` : ''}`;

const cardAllow = (i: string): string => `${sel('card', i)}, ${sel('cardplay', i)}`;
const cardTarget = (c: Ctx, i: string): string => (c.cardOpen ? sel('cardplay', i) : sel('card', i));

export const STEPS: Step[] = [
  // ---- possession 1: your ball ----
  { id: 'welcome', topic: 'welcome', n: 1, phase: 'off', kind: 'info', title: 'Welcome to the Grid', ok: "Let's go",
    text: () => 'Ballerz are rendered here. One game to 11 against Rookie Run. I point, you tap.' },
  { id: 'shooter', topic: 'shooter', n: 1, phase: 'off', kind: 'click', title: 'Pick a shooter', want: { ev: 'shooter' },
    target: () => '.picker', allow: () => sel('shooter'),
    text: () => 'Tap a Baller to give him the shot. Each one shoots once per three attacks.' },
  { id: 'zone', topic: 'zone', n: 1, phase: 'off', kind: 'click', title: 'Pick a zone', want: { ev: 'zone', v: () => 'mid' },
    target: () => '.shot-trio', allow: () => sel('zone', 'mid'),
    text: () => 'Rim 2, Mid 2, Three 3. The % is your chance. Mid is the safe one. Tap Mid.' },
  { id: 'card', topic: 'card', n: 1, phase: 'off', kind: 'click', title: 'Play a card', want: { ev: 'card', v: () => '0' },
    target: (c) => cardTarget(c, '0'), allow: () => cardAllow('0'),
    text: (c) => (c.cardOpen ? 'This one is free (0 Momentum). Press Play.' : 'Optional. The corner number is its cost. Tap a card.') },
  { id: 'go1', topic: 'go', n: 1, phase: 'off', kind: 'click', title: 'Go', want: { ev: 'shoot' },
    target: () => sel('shoot'), allow: () => sel('shoot'),
    text: () => 'Press GO. Watch the pass and the shot. A tap skips the show.' },
  { id: 'logopen', topic: 'log', n: 1, phase: 'result', kind: 'click', title: 'Play by play', want: { ev: 'logopen' }, skipWhen: (s) => !!s.logDocked || !!s.logOpen,
    target: () => sel('log') + '.hb', allow: () => sel('log'),
    text: () => 'Every play is written in the LOG. Tap LOG.' },
  { id: 'log', topic: 'log', n: 1, phase: 'result', kind: 'click', title: 'Play by play', want: { ev: 'logrow' },
    target: () => '.plog ol > li:first-child', allow: () => sel('logrow'),
    text: () => 'Tap a line to see every number behind it.' },
  { id: 'logclose', topic: 'log', n: 1, phase: 'result', kind: 'click', title: 'Back to the court', want: { ev: 'logclose' }, skipWhen: (s) => !!s.logDocked,
    target: () => '.xg-log .lg-x', allow: () => sel('logclose'),
    text: () => 'Got it. Tap Close.' },
  { id: 'next1', topic: 'log', n: 1, phase: 'result', kind: 'click', title: 'Next possession', want: { ev: 'next' }, skipIfOver: true,
    target: () => '#nextBtn', allow: () => '#nextBtn',
    text: () => 'The panel says why it went in. Now their ball.' },
  // ---- possession 2: their ball ----
  { id: 'scheme', topic: 'scheme', n: 2, phase: 'def', kind: 'click', title: 'Guess their zone', want: { ev: 'scheme' },
    target: () => '.shot-trio', allow: () => sel('scheme'),
    text: (c) => `Pack the Paint = Rim, Drop = Mid, Close Out = Three. A right guess cuts their shot. ${c.hero} likes ${c.likes}.` },
  { id: 'matchups', topic: 'matchups', n: 2, phase: 'def', kind: 'info', title: 'Man-to-man', ok: 'Got it',
    target: () => '.matches',
    text: () => 'Each of their Ballerz has one of yours on him (the colored lines). His DEF counts. Tap a defender to swap.' },
  { id: 'lock', topic: 'scheme', n: 2, phase: 'def', kind: 'click', title: 'Lock in', want: { ev: 'lock' },
    target: () => sel('lock'), allow: () => sel('lock'),
    text: () => 'Happy with it? Lock in and watch.' },
  { id: 'momentum', topic: 'momentum', n: 2, phase: 'result', kind: 'info', title: 'Momentum', ok: 'Got it',
    target: () => '.jumbo .mo[data-mo="0"]',
    text: () => '+1 for the ball, +1 for a basket, +1 for a stop. It carries over. Spend it on cards, double teams and subs.' },
  { id: 'next2', topic: 'momentum', n: 2, phase: 'result', kind: 'click', title: 'Next possession', want: { ev: 'next' }, skipIfOver: true,
    target: () => '#nextBtn', allow: () => '#nextBtn',
    text: () => 'Stops pay Momentum too. Your ball again.' },
  // ---- possession 3: cooling, pass cards, On Fire ----
  { id: 'cooling', topic: 'cooling', n: 3, phase: 'off', kind: 'info', title: 'Cooling', ok: 'Got it',
    target: () => '.picker',
    text: (c) => `${c.first} just shot, so he cools for three attacks. The ring on his token counts down.` },
  { id: 'pass', topic: 'pass', n: 3, phase: 'off', kind: 'click', title: 'Pass cards', want: { ev: 'card', v: () => '0' },
    target: (c) => cardTarget(c, '0'), allow: () => cardAllow('0'),
    text: (c) => (c.cardOpen ? `Press Play to bring ${c.cool} back.` : `A pass card lets anyone shoot, cooling or not. Tap it to read it.`) },
  { id: 'coolshooter', topic: 'pass', n: 3, phase: 'off', kind: 'click', title: 'Back in', want: { ev: 'shooter', v: (c) => String(c.coolIdx) },
    target: (c) => sel('shooter', String(c.coolIdx)), allow: (c) => sel('shooter', String(c.coolIdx)),
    text: (c) => `${c.cool} can shoot again. Tap him.` },
  { id: 'three', topic: 'pass', n: 3, phase: 'off', kind: 'click', title: 'Kick Out is a Three', want: { ev: 'zone', v: () => 'three' },
    target: () => sel('zone', 'three'), allow: () => sel('zone', 'three'),
    text: () => 'Kick Out only works from Three. Tap Three.' },
  { id: 'go3', topic: 'go', n: 3, phase: 'off', kind: 'click', title: 'Go', want: { ev: 'shoot' },
    target: () => sel('shoot'), allow: () => sel('shoot'),
    text: () => 'Send it.' },
  { id: 'fire', topic: 'fire', n: 3, phase: 'result', kind: 'click', title: 'On Fire', want: { ev: 'next' }, skipIfOver: true,
    target: () => '#nextBtn', allow: () => '#nextBtn',
    text: (c) => (c.fireOn
      ? `${c.cool} hit two in a row: ON FIRE, +6% until he misses.`
      : `Two makes in a row by one Baller set him ON FIRE: +6% until he misses.`) },
  // ---- possession 4: Traps ----
  { id: 'trap', topic: 'trap', n: 4, phase: 'def', kind: 'click', title: 'Set a Trap', want: { ev: 'card', v: () => '0' },
    target: (c) => cardTarget(c, '0'), allow: () => cardAllow('0'),
    text: (c) => (c.cardOpen ? 'Press Play. It goes face down.' : 'A Trap goes in face down and fires on a later shot. Tap Jump Lane.') },
  { id: 'scheme4', topic: 'scheme', n: 4, phase: 'def', kind: 'click', title: 'Guess again', want: { ev: 'scheme' },
    target: () => '.shot-trio', allow: () => sel('scheme'),
    text: () => 'Pick a scheme.' },
  { id: 'lock4', topic: 'scheme', n: 4, phase: 'def', kind: 'click', title: 'Lock in', want: { ev: 'lock' },
    target: () => sel('lock'), allow: () => sel('lock'),
    text: () => 'Lock it in. Your Trap stays hidden.' },
  { id: 'next4', topic: 'trap', n: 4, phase: 'result', kind: 'click', title: 'It is armed', want: { ev: 'next' }, skipIfOver: true,
    target: () => '#nextBtn', allow: () => '#nextBtn',
    text: () => 'Your Trap waits face down. It fires on a later shot.' },
  // ---- possession 5: subs and fatigue ----
  { id: 'subs', topic: 'subs', n: 5, phase: 'off', kind: 'click', title: 'Tired legs', want: { ev: 'subs' },
    target: () => sel('subs'), allow: () => sel('subs'),
    text: (c) => `${c.tired} is tired: −3% per attack after five in a row. A sub costs 2 Momentum. Tap Subs.` },
  { id: 'swap', topic: 'subs', n: 5, phase: 'off', kind: 'click', title: 'Swap him out', want: { ev: 'sub' },
    target: (c) => sel('sub', `${c.tiredIdx}:0`), allow: (c) => sel('sub', `${c.tiredIdx}:0`),
    text: (c) => `Swap ${c.tired} for the fresh Baller. The arrows show who is better.` },
  { id: 'subdone', topic: 'subs', n: 5, phase: 'off', kind: 'click', title: 'Back to the game', want: { ev: 'subsclose' },
    target: () => '.subsheet .sheet-h [data-a="subsclose"]', allow: () => sel('subsclose'),
    text: () => 'Done. Now shoot: Baller, zone, GO.' },
  // ---- possession 6: double team, the Trap fires ----
  { id: 'double', topic: 'double', n: 6, phase: 'def', kind: 'click', title: 'Double team', want: { ev: 'dt', v: (c) => String(c.dtIdx) },
    target: (c) => sel('dt', String(c.dtIdx)), allow: (c) => sel('dt', String(c.dtIdx)),
    text: (c) => `For 4 Momentum two defenders crowd ${c.dtName}. He can't shoot, a teammate is open. Tap 2×.` },
  { id: 'scheme6', topic: 'scheme', n: 6, phase: 'def', kind: 'click', title: 'Guess their zone', want: { ev: 'scheme' },
    target: () => '.shot-trio', allow: () => sel('scheme'),
    text: () => 'The open man shoots instead. Guess where.' },
  { id: 'lock6', topic: 'scheme', n: 6, phase: 'def', kind: 'click', title: 'Lock in', want: { ev: 'lock' },
    target: () => sel('lock'), allow: () => sel('lock'),
    text: () => 'Lock in.' },
  { id: 'next6', topic: 'trap', n: 6, phase: 'result', kind: 'click', title: 'Trap check', want: { ev: 'next' }, skipIfOver: true,
    target: () => '#nextBtn', allow: () => '#nextBtn',
    text: (c) => (c.trapFired ? 'Your Trap fired. The log says exactly what it did. No Trap takes a shot under 1%.' : 'The double team changed who shot. Your Trap fires on a later shot.') },
  // ---- possession 7: Clutch, rare shots ----
  { id: 'clutch', topic: 'clutch', n: 7, phase: 'off', kind: 'click', title: 'Clutch', want: { ev: 'clutch' },
    target: () => sel('clutch'), allow: () => sel('clutch'),
    text: () => 'A full Momentum bar unlocks a Clutch shot: the whole bar for a timing bar. Tap Clutch.' },
  { id: 'zone7', topic: 'clutch', n: 7, phase: 'off', kind: 'click', title: 'Pick a zone', want: { ev: 'zone' },
    target: () => '.shot-trio', allow: () => sel('zone'),
    text: () => 'Any zone, then GO. Tap when the needle is in the green. Center = PERFECT.' },
  { id: 'go7', topic: 'clutch', n: 7, phase: 'off', kind: 'click', title: 'Go', want: { ev: 'shoot' },
    target: () => sel('shoot'), allow: () => sel('shoot'),
    text: () => 'Go.' },
  { id: 'rare', topic: 'rare', n: 7, phase: 'result', kind: 'info', title: 'Rare shots', ok: 'Show me',
    text: () => 'A made shot under 15% is GLITCHED, under 5% OVERCLOCKED, under 2% SYSTEM ERROR. Like this.' },
  { id: 'next7', topic: 'rare', n: 7, phase: 'result', kind: 'click', title: 'Next possession', want: { ev: 'next' }, skipIfOver: true,
    target: () => '#nextBtn', allow: () => '#nextBtn',
    text: () => 'That is the lot. Finish the game: first to 11.' },
  // ---- free play, then the wrap-up ----
  { id: 'free', topic: 'free', n: 8, phase: 'any', kind: 'note', title: 'Free play', ok: 'OK', target: () => '.jumbo',
    text: () => 'Your game now. First to 11. Skip is always in this panel.' },
  { id: 'wrap', topic: 'wrap', n: -1, phase: 'result', overOnly: true, kind: 'click', title: 'Final whistle', want: { ev: 'next' },
    target: () => '#nextBtn', allow: () => '#nextBtn',
    text: (c) => (c.won
      ? 'You win. That is the whole game. Your reward is waiting.'
      : 'You lost, and that is fine. The Grid keeps score, not grudges. Your reward is waiting.') },
];

/** How the early possessions are forced. `rig` makes that possession's shot go in or miss (whoever shoots). */
export interface Scene {
  hand: string[];
  /** Momentum floor for the player (a gift when the lesson needs it). */
  moMin?: number;
  rig?: 'make' | 'miss';
  /** Make the player's default shooter tired. */
  tire?: boolean;
}
export const SCENES: Record<number, Scene> = {
  1: { hand: ['elbow_jumper', 'swing_pass', 'hydrate'], rig: 'make' },
  2: { hand: ['lock_in', 'hydrate', 'swing_pass'], rig: 'miss' },
  3: { hand: ['kick_out', 'swing_pass', 'hydrate'], rig: 'make' },
  4: { hand: ['jump_lane', 'lock_in', 'hydrate'] },
  5: { hand: ['swing_pass', 'hydrate', 'outlet'], moMin: 3, tire: true },
  6: { hand: ['lock_in', 'hydrate', 'jump_lane'], moMin: 4 },
  7: { hand: ['swing_pass', 'hydrate', 'outlet'], moMin: 10 },
};

const RANK: Record<Phase, number> = { off: 0, def: 0, result: 1 };

/** Walks the steps in order against the live game; the host feeds it snapshots and the player's actions. */
export class Sequencer {
  idx = 0;
  constructor(public steps: Step[] = STEPS) {}
  private stale(s: Step, snap: Snap): boolean {
    if (s.skipWhen?.(snap)) return true;
    if (s.overOnly) return false;
    if (snap.over && (s.skipIfOver || (s.n < snap.n) || s.n !== snap.n)) return !(s.id === 'rare' && s.n === snap.n);
    if (s.n < snap.n) return true;
    if (s.n === snap.n && s.phase !== 'any' && RANK[s.phase] < RANK[snap.phase]) return true;
    return false;
  }
  private matches(s: Step, snap: Snap): boolean {
    if (s.overOnly) return snap.over && snap.phase === 'result';
    return s.n === snap.n && (s.phase === 'any' || s.phase === snap.phase);
  }
  /** The step to show now, or null when the game is between lessons. */
  current(snap: Snap): Step | null {
    while (this.idx < this.steps.length && this.stale(this.steps[this.idx], snap)) this.idx++;
    const s = this.steps[this.idx];
    return s && this.matches(s, snap) ? s : null;
  }
  /** The player did something. Returns true when it completed the active click step. */
  event(ev: string, v: string | undefined, snap: Snap, ctx: Ctx): boolean {
    const s = this.current(snap);
    if (!s || s.kind !== 'click' || !s.want || s.want.ev !== ev) return false;
    if (s.want.v && v !== s.want.v(ctx)) return false;
    this.idx++;
    return true;
  }
  /** "Got it" on an info or note step. */
  ack(snap: Snap): boolean {
    const s = this.current(snap);
    if (!s || s.kind === 'click') return false;
    this.idx++;
    return true;
  }
  get finished(): boolean { return this.idx >= this.steps.length; }
  /** Progress 0..1 for the bubble's bar. */
  get progress(): number { return Math.min(1, this.idx / (this.steps.length - 1)); }
}
