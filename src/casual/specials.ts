// Iconic specials: every Iconic Baller (the top-50 tier in the catalog) owns ONE active ability, usable once per game from his Baller
// card or token, with no Momentum cost. 50 named specials map onto 18 effect types; the Baller id picks the special deterministically.
// A HOLO Iconic gets the same special but stronger (x spHolo on its numbers, and +1 Momentum when he uses it). DOM-free.
import { ballersOfTier } from '../rules';
import { TUNING as T } from './tuning';

export type SpType =
  | 'sure' | 'skip' | 'fork' | 'loop' | 'worth' | 'ignite' | 'firewall'     // offense: his shot this possession
  | 'stop' | 'trace' | 'steal' | 'cap'                                       // defense: their shot this possession
  | 'null' | 'cool' | 'drain' | 'surge' | 'flush' | 'draw' | 'rewind';     // utility
export type SpGroup = 'off' | 'def' | 'util';
/** When a special can be used: 'off' = on your own attack, 'def' = while defending, 'any' = either, 'after' = right after they scored (Rewind). */
export type SpWhen = 'off' | 'def' | 'any' | 'after';
export interface SpKind { type: SpType; group: SpGroup; when: SpWhen; /** Is the shot bound to the user (he takes it)? */ bound: boolean; /** Plain count (not a percent): rounded, at least 1. */ count: boolean }
export const SP_KINDS: Record<SpType, SpKind> = {
  sure: { type: 'sure', group: 'off', when: 'off', bound: true, count: false },
  skip: { type: 'skip', group: 'off', when: 'off', bound: true, count: false },
  fork: { type: 'fork', group: 'off', when: 'off', bound: true, count: false },
  loop: { type: 'loop', group: 'off', when: 'off', bound: true, count: false },
  worth: { type: 'worth', group: 'off', when: 'off', bound: true, count: false },
  ignite: { type: 'ignite', group: 'off', when: 'off', bound: true, count: false },
  firewall: { type: 'firewall', group: 'off', when: 'off', bound: false, count: false },
  stop: { type: 'stop', group: 'def', when: 'def', bound: false, count: false },
  trace: { type: 'trace', group: 'def', when: 'def', bound: false, count: false },
  steal: { type: 'steal', group: 'def', when: 'def', bound: false, count: false },
  cap: { type: 'cap', group: 'def', when: 'def', bound: false, count: false },
  null: { type: 'null', group: 'util', when: 'any', bound: false, count: true },
  cool: { type: 'cool', group: 'util', when: 'any', bound: false, count: true },
  drain: { type: 'drain', group: 'util', when: 'any', bound: false, count: true },
  surge: { type: 'surge', group: 'util', when: 'any', bound: false, count: true },
  flush: { type: 'flush', group: 'util', when: 'any', bound: false, count: true },
  draw: { type: 'draw', group: 'util', when: 'any', bound: false, count: true },
  rewind: { type: 'rewind', group: 'util', when: 'after', bound: false, count: true },
};
export interface Special { key: string; name: string; type: SpType; /** Base magnitude (percent points, or a count). */ v: number; flavor: string }

// [name, type, base number, flavour]. Names are English, glitch/Grid voice; flavour lines are dry.
const RAW: [string, SpType, number, string][] = [
  // offense: his shot this possession
  ['Glitch Step', 'sure', 88, 'He was not there. Then he was, closer.'],
  ['Perfect Frame', 'sure', 87, 'One clean render, no dropped pixels.'],
  ['Zero Latency', 'sure', 92, 'The shot lands before the defender is told.'],
  ['Lock-On', 'sure', 85, 'The rim registers him as an authorised user.'],
  ['Hot Pixel', 'sure', 82, 'A bright dot where there should not be one.'],
  ['Frame Skip', 'skip', 5, 'Nobody can block a frame that was never drawn.'],
  ['Clip Through', 'skip', 5, 'Collision detection is optional on his side.'],
  ['Bypass', 'skip', 4, 'The scheme is a suggestion.'],
  ['Ghost Lane', 'skip', 6, 'There is a lane. It only exists for him.'],
  ['Fork', 'fork', 4, 'Two of him, briefly. One was enough.'],
  ['Split Thread', 'fork', 6, 'The play branches. The ball takes both.'],
  ['Echo Shot', 'fork', 3, 'The miss comes back as a shot.'],
  ['Loop', 'loop', 3, 'Same possession, again. Nobody objects.'],
  ['Replay Buffer', 'loop', 5, 'He remembers how that went in.'],
  ['Infinite Loop', 'loop', 2, 'The ball does not come back. It never left.'],
  ['Bonus Round', 'worth', 3, 'The scoreboard rounds up.'],
  ['Jackpot Hit', 'worth', 5, 'Something pays out. Nobody asked what.'],
  ['Hot Patch', 'ignite', 5, 'Patched live. It runs hot.'],
  ['Thermal Spike', 'ignite', 6, 'The sensors read a number the sensors cannot read.'],
  ['Burn-In', 'ignite', 4, 'An old image that never fades.'],
  ['Firewall', 'firewall', 12, 'Nothing gets in. Nothing gets in his way.'],
  ['Sandbox', 'firewall', 11, 'Traps and doubles run in a room he is not in.'],
  // defense: their shot this possession
  ['Access Denied', 'stop', 28, 'Credentials rejected. Politely.'],
  ['Throttle', 'stop', 20, 'Their shot arrives slowly, and wrong.'],
  ['Rate Limit', 'stop', 26, 'Too many requests for one rim.'],
  ['Black Hole', 'stop', 32, 'The ball goes in. The lane does not come out.'],
  ['Trace Route', 'trace', 55, 'He knows where it came from. So does the defense.'],
  ['Packet Sniff', 'trace', 50, 'Every pass was readable. Every one.'],
  ['Deep Scan', 'trace', 55, 'The shot is read before it is taken.'],
  ['Garbage Collect', 'steal', 60, 'Loose ball. Reclaimed.'],
  ['Kill Process', 'steal', 70, 'Their possession ends unexpectedly.'],
  ['Hard Reset', 'cap', 22, 'Turn it off, turn it on. Their shot waits.'],
  ['Segment Wall', 'cap', 22, 'Out-of-range memory. Out-of-range shot.'],
  ['Stack Guard', 'cap', 26, 'The call stack ends at his hands.'],
  // utility
  ['Null Pointer', 'null', 2, 'Points at nothing. Their trap pointed at nothing too.'],
  ['Zero Out', 'null', 3, 'Cleared. Their card, their traps, their plan.'],
  ['Kernel Panic', 'cool', 2, 'Their best shooter stops responding.'],
  ['Hang', 'cool', 2, 'The spinning wheel is a person today.'],
  ['Freeze Frame', 'cool', 3, 'He is still standing there. He will be, a while.'],
  ['Memory Dump', 'drain', 6, 'Their Momentum is, briefly, his.'],
  ['Power Drain', 'drain', 7, 'The arena dims on their side.'],
  ['Core Surge', 'surge', 6, 'The clock speed is not a number he agrees with.'],
  ['Overdrive', 'surge', 8, 'Past the rated limit. Nothing complained.'],
  ['Cache Flush', 'flush', 0, 'Legs, cooldowns, old plays: cleared.'],
  ['Hot Swap', 'flush', 0, 'Replaced while running. Nobody noticed.'],
  ['Cache Hit', 'draw', 3, 'The next play was already in memory.'],
  ['Prefetch', 'draw', 3, 'He asked for the cards before the question.'],
  ['Rewind', 'rewind', 1, 'That basket? It has not happened yet.'],
  ['Rollback', 'rewind', 2, 'Restored from the last good version.'],
  ['Undo', 'rewind', 1, 'Ctrl+Z. The crowd noticed.'],
];
export const SPECIALS: Special[] = RAW.map(([name, type, v, flavor]) => ({ key: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'), name, type, v, flavor }));

let IDX: Map<number, number> | null = null;
/** The Iconic Ballerz (ids ascending) and the special each one owns: a fixed stride shuffle so neighbouring ids differ. */
export function specialIndex(): Map<number, number> {
  if (!IDX) {
    IDX = new Map();
    const ids = ballersOfTier('iconic').slice().sort((a, b) => a - b), n = SPECIALS.length;
    ids.forEach((id, i) => IDX!.set(id, (i * 17 + 3) % n));
  }
  return IDX;
}
/** The special of an Iconic Baller, or null for everyone else. */
export function specialFor(id: number): Special | null {
  const i = specialIndex().get(id);
  return i == null ? null : SPECIALS[i];
}
const GROUP_SCALE = (g: SpGroup): number => (g === 'off' ? T.spOff : g === 'def' ? T.spDef : T.spUtil);
/** The number a special runs with now: base x global scale x group scale, x the HOLO multiplier. Percent effects round to 1 decimal, counts to a whole number (at least 1). */
export function spValue(sp: Special, holo: boolean): number {
  const k = SP_KINDS[sp.type];
  if (sp.v === 0) return 0;
  let v = sp.v * T.spScale * GROUP_SCALE(k.group) * (holo ? T.spHolo : 1);
  if (k.count) return Math.max(1, Math.round(v));
  v = Math.round(v * 10) / 10;
  if (sp.type === 'sure') v = Math.min(95, v);
  if (sp.type === 'trace') v = Math.min(80, v);
  if (sp.type === 'steal') v = Math.min(85, v);
  if (sp.type === 'cap') v = Math.max(3, v);
  return v;
}
const n1 = (x: number): string => String(Math.round(x * 10) / 10);
/** One readable line for the Baller card and the button. */
export function specialText(sp: Special, holo = false): string {
  const v = spValue(sp, holo);
  switch (sp.type) {
    case 'sure': return `His next shot is ${n1(v)}% if the defense does not guess his zone.`;
    case 'skip': return `His next shot cannot be blocked and ignores the scheme. +${n1(v)}%.`;
    case 'fork': return `Two shooters: if his shot misses, the best teammate shoots too (+${n1(v)}%).`;
    case 'loop': return `If his shot goes in, you keep the ball. +${n1(v)}% on the shot.`;
    case 'worth': return `His next basket is worth +1 point. +${n1(v)}% on the shot.`;
    case 'ignite': return `He is On Fire now. +${n1(v)}% on this shot.`;
    case 'firewall': return `Traps and the double team do nothing this possession. +${n1(v)}% on his shot.`;
    case 'stop': return `Their shot this possession loses ${n1(v)}%.`;
    case 'trace': return `Their shot counts as read: it loses ${n1(v)}%, even if you guessed wrong.`;
    case 'steal': return `${n1(v)}% chance they lose the ball before the shot.`;
    case 'cap': return `Their shot this possession cannot be better than ${n1(v)}%.`;
    case 'null': return `Removes all their face-down Traps and cancels the card they play this possession. +${v} Momentum.`;
    case 'cool': return `Their best shooter cools for ${v} attacks.`;
    case 'drain': return `They lose ${v} Momentum, you gain ${Math.floor(v / 2)}.`;
    case 'surge': return `+${v} Momentum now.`;
    case 'flush': return 'Your court Ballerz are fresh: fatigue and cooldowns cleared.';
    case 'draw': return `Draw ${v} cards (up to a full hand), +1 Momentum, and your next card costs 1 less.`;
    case 'rewind': return `Right after they score: cancel up to ${v} point${v === 1 ? '' : 's'} of that basket (all of it takes back its Momentum). You get the ball.`;
  }
}
/** Short label for the kind of moment it is used in. */
export const SP_WHEN_TEXT: Record<SpWhen, string> = { off: 'On offense, before GO', def: 'On defense, before Lock in', any: 'Any time before the shot', after: 'Right after they score' };
export const SP_HOLO_TEXT = (): string => `HOLO: numbers x${T.spHolo}, and +${T.spHoloMo} Momentum when used.`;
