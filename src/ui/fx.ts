// Arcade effects layer: callouts, a flying ball, sweeping banners and flashes, played as short timed sequences.
// Everything sits in one fixed layer above the board; a tap on it skips to the end.
import { reduced } from './views';
import { liteOn } from './lite';

let layer: HTMLDivElement | null = null;
let skip = false;
/** 1 = normal, below 1 = fast mode. Scales step waits and (through --fxs) the CSS animation lengths. */
let speed = 1;
export function setSpeed(k: number): void { if (liteOn()) k = Math.min(k, 0.9); speed = k; document.documentElement.style.setProperty('--fxs', String(k)); }
export const getSpeed = (): number => speed;
/** True when the player tapped to skip the current sequence. */
export const skipped = (): boolean => skip;

function getLayer(): HTMLDivElement {
  if (!layer || !layer.isConnected) {
    layer = document.createElement('div');
    layer.className = 'fx-layer';
    layer.addEventListener('pointerdown', () => { skip = true; });
    document.body.appendChild(layer);
  }
  return layer;
}
export function centerOf(el: Element | null): { x: number; y: number } {
  if (!el) el = document.querySelector('.court-wrap');
  if (!el) return { x: innerWidth / 2, y: innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
function add(cls: string, html: string, x?: number, y?: number, life = 1100): HTMLElement {
  const el = document.createElement('div');
  el.className = cls;
  el.innerHTML = html;
  if (x != null) el.style.left = x + 'px';
  if (y != null) el.style.top = y + 'px';
  getLayer().appendChild(el);
  setTimeout(() => el.remove(), life);
  return el;
}

export type Tone = 'good' | 'bad' | 'hot' | 'cool' | 'plain';

/** Arcade word popping out of an element (or the middle of the screen). */
export function callout(text: string, at: Element | null, tone: Tone = 'plain', sub = '', big = false, xy?: XY): void {
  const p = xy ? { ...xy } : centerOf(at);
  const len = text.replace(/&\w+;/g, '#').length;
  // the wide arcade font must never run off a phone: a big word shrinks to fit the screen
  const fs = big ? Math.max(22, Math.min(96, innerWidth * 0.13, (innerWidth - 24) / len)) : 0;
  const half = Math.min(innerWidth / 2 - 6, big ? (fs * len) / 2 + 8 : Math.min(150, Math.max(len * 13, sub.length * 7) + 20));
  p.x = Math.max(half + 6, Math.min(innerWidth - half - 6, p.x));
  const el = add(`fx-call t-${tone}${big ? ' big' : ''}`, `<b>${text}</b>${sub ? `<small>${sub}</small>` : ''}`, p.x, p.y, big ? 1500 : 1100);
  if (big) el.style.setProperty('--fs', fs + 'px');
}
/** The ball flying from one element to another, in an arc. */
export function ballFly(from: Element | null, to: Element | null, ms = 480, lob = 70): void {
  const a = centerOf(from), b = centerOf(to);
  const el = add('fx-ball', '', a.x, a.y, ms + 80);
  el.animate([
    { transform: 'translate(-50%,-50%) scale(1)' },
    { transform: `translate(calc(-50% + ${(b.x - a.x) / 2}px), calc(-50% + ${(b.y - a.y) / 2 - lob}px)) scale(1.35)`, offset: 0.5 },
    { transform: `translate(calc(-50% + ${b.x - a.x}px), calc(-50% + ${b.y - a.y}px)) scale(.9)` },
  ], { duration: ms, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' });
}
export interface XY { x: number; y: number }
/** The ball flying between two screen points in an arc, leaving a short neon trail. */
export function ballArc(a: XY, b: XY, ms = 560, lob = 80, cls = ''): HTMLElement {
  ms *= speed;
  const el = add('fx-ball ' + cls, '', a.x, a.y, ms + 120);
  const dx = b.x - a.x, dy = b.y - a.y;
  el.animate([
    { transform: 'translate(-50%,-50%) scale(1)' },
    { transform: `translate(calc(-50% + ${dx / 2}px), calc(-50% + ${dy / 2 - lob}px)) scale(1.3)`, offset: 0.5 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.85)` },
  ], { duration: ms, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' });
  if (!reduced() && !liteOn()) {
    for (let i = 1; i <= 4; i++) {
      const g = add('fx-ball ghost', '', a.x, a.y, ms + 400);
      g.style.opacity = String(0.45 - i * 0.08);
      g.animate([
        { transform: 'translate(-50%,-50%) scale(1)' },
        { transform: `translate(calc(-50% + ${dx / 2}px), calc(-50% + ${dy / 2 - lob}px)) scale(1.2)`, offset: 0.5 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.8)` },
      ], { duration: ms, delay: i * 38, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' });
    }
  }
  return el;
}
/** A short hop of the ball along a straight line (pass, deflection). */
export function ballHop(a: XY, b: XY, ms = 300, lob = 14): void { ballArc(a, b, ms, lob); }
/** Neon shield flash for a block: a ring with an X at the defender. */
export function blockFx(at: XY): void {
  add('fx-block', '<svg viewBox="0 0 40 40" width="64" height="64"><circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M11 11l18 18M29 11L11 29" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>', at.x, at.y, 900);
}
/** A raised hand over a defender: the contest on a jump shot (only the hand goes up). */
export function handFx(at: XY): void {
  add('fx-hand', '<svg viewBox="0 0 32 40" width="30" height="38"><path d="M9 38V22L5 15q-1-3 2-3l4 5V5q0-3 3-3t3 3v9V4q0-3 3-3t3 3v10V7q0-3 3-3t3 3v17q0 8-6 12v2z" fill="currentColor" fill-opacity=".25" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>', at.x, at.y - 26, 900 * speed + 200);
}
/** Referee whistle with sound lines (and-one, foul). */
export function whistleFx(at: XY): void {
  add('fx-whistle', '<svg viewBox="0 0 64 44" width="120" height="82"><circle cx="22" cy="28" r="12" fill="currentColor" fill-opacity=".25" stroke="currentColor" stroke-width="3"/><path d="M30 18h28v8H34M10 16l8 4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="22" cy="28" r="3.5" fill="currentColor"/><path class="wl" d="M46 6l4 5M54 4l-1 6M38 5l6 4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>', at.x, at.y, 1200 * speed + 300);
}
/** Net swish: a few falling neon strands under the rim. */
export function swish(at: XY, tone: Tone): void {
  add(`fx-swish t-${tone}`, '<i></i><i></i><i></i><i></i><i></i>', at.x, at.y, 800);
}
/** Full-court glitch for rare made shots. level 1..3 scales the title, the slicing, the shake and the colour wash. */
export function glitchSlam(level: 1 | 2 | 3, title: string, sub: string, alias = ''): void {
  if (liteOn()) level = 1;
  const L = getLayer();
  const el = document.createElement('div');
  el.className = `fx-glitch lv-${level}`;
  const slices = Array.from({ length: liteOn() ? 0 : 4 + level * 3 }, (_x, i) => `<i style="--y:${Math.round(Math.random() * 92)}%;--h:${3 + Math.round(Math.random() * 9)}%;--d:${(i * 0.07).toFixed(2)}s;--sx:${Math.round((Math.random() - 0.5) * 60)}px"></i>`).join('');
  el.innerHTML = `<div class="gl-wash"></div><div class="gl-slices">${slices}</div>
    <div class="gl-title"><i class="stray gl-stray" aria-hidden="true"></i><b data-text="${title}">${title}</b>${alias ? `<em>aka ${alias}</em>` : ''}<small>${sub}</small><span class="gl-bars">${'<i></i>'.repeat(level + 2)}</span></div>`;
  L.appendChild(el);
  const life = [0, 1400, 1900, 2600][level] * speed;
  el.style.setProperty('--life', life + 'ms');
  setTimeout(() => el.remove(), life + 100);
  const court = document.querySelector('.court-wrap');
  if (court) {
    court.classList.remove('cg-1', 'cg-2', 'cg-3'); void (court as HTMLElement).offsetWidth;
    court.classList.add('cg-' + level);
    setTimeout(() => court.classList.remove('cg-' + level), life);
  }
  document.body.classList.remove('gl-shake'); void document.body.offsetWidth;
  if (level >= 2) { document.body.classList.add('gl-shake'); setTimeout(() => document.body.classList.remove('gl-shake'), 700 * speed); }
}
/** A short hop-and-glitch on one element (the shot taker, a trap). */
export function glitchEl(el: Element | null, ms = 500): void {
  if (!el) return;
  el.classList.remove('glitch-once'); void (el as HTMLElement).offsetWidth;
  el.classList.add('glitch-once');
  setTimeout(() => el.classList.remove('glitch-once'), ms);
}
/** A small explanation card on the court (title + a line of text), used to teach what a trap or a read just did. */
export function tip(at: XY, title: string, text: string, tone: Tone = 'plain', life = 1800): void {
  const x = Math.max(110, Math.min(innerWidth - 110, at.x)), y = Math.max(60, Math.min(innerHeight - 60, at.y));
  const el = add(`fx-tip t-${tone}`, `<b>${title}</b><span>${text}</span>`, x, y, life * speed + 200);
  el.style.setProperty('--life', life * speed + 'ms');
}
/** A slanted band sweeping across the screen. */
export function banner(text: string, sub: string, tone: Tone): void {
  add(`fx-banner t-${tone}`, `<div><b>${text}</b>${sub ? `<small>${sub}</small>` : ''}</div>`, undefined, undefined, 1300);
}
/** The free throw that follows an and-one: a lone ball goes up from the line and a +1 lands on the hoop. */
export function freeThrow(from: XY, to: XY, tone: Tone): void {
  const el = add('fx-ft', '', from.x, from.y, 1000 * speed + 300);
  el.className = 'fx-ball fx-ft';
  el.animate([
    { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 },
    { transform: `translate(calc(-50% + ${(to.x - from.x) * 0.5}px), calc(-50% + ${(to.y - from.y) * 0.5 - 90}px)) scale(1.3)`, opacity: 1, offset: 0.5 },
    { transform: `translate(calc(-50% + ${to.x - from.x}px), calc(-50% + ${to.y - from.y}px)) scale(.85)`, opacity: 1 },
  ], { duration: 650 * speed, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' });
  setTimeout(() => { swish(to, tone); callout('+1', null, tone, 'free throw', true); }, 640 * speed);
}
/** Win effect for the reward screen: neon rings and falling confetti, scaled by the winning margin. Cheaper in lite mode, none with reduced motion. */
export function winFx(margin: number): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const lite = liteOn(), m = Math.max(0, margin);
  const root = document.createElement('div');
  root.className = 'winfx';
  root.setAttribute('aria-hidden', 'true');
  const rings = lite ? 1 : m >= 10 ? 3 : m >= 5 ? 2 : 1;
  let html = Array.from({ length: rings }, (_x, k) => `<i class="wf-ring" style="--d:${k * 0.22}s"></i>`).join('');
  const n = Math.round(Math.min(150, 36 + m * 8) / (lite ? 3 : 1)), cols = ['#19f6ff', '#ff4fd8', '#ffb000', '#ffffff', '#b48cff'];
  for (let i = 0; i < n; i++) html += `<b class="wf-c" style="--x:${Math.round(Math.random() * 100)}vw;--w:${3 + Math.round(Math.random() * 5)}px;--c:${cols[i % cols.length]};--t:${(1.6 + Math.random() * 1.8).toFixed(2)}s;--dl:${(Math.random() * 0.9).toFixed(2)}s;--r:${Math.round(Math.random() * 720 - 360)}deg;--s:${Math.round(Math.random() * 120 - 60)}px"></b>`;
  root.innerHTML = html;
  document.body.appendChild(root);
  setTimeout(() => root.remove(), 4200);
}
export function flash(tone: Tone): void {
  add(`fx-flash t-${tone}`, '', undefined, undefined, 500);
}
/** Ring burst on an element, e.g. the scoreboard when points land. */
export function burst(at: Element | null, tone: Tone): void {
  const p = centerOf(at);
  add(`fx-burst t-${tone}`, '', p.x, p.y, 700);
}
export function pulse(el: Element | null, cls = 'fx-pulse'): void {
  if (!el) return;
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 700);
}

export interface Step { wait: number; run: () => void }
let playing = false;
export const fxPlaying = (): boolean => playing;

/** Runs steps one after another (each waits `wait` ms after it runs). A tap skips the rest. */
export async function play(steps: Step[]): Promise<void> {
  if (reduced() || !steps.length) return;
  playing = true;
  skip = false;
  const L = getLayer();
  L.classList.add('live');
  const hint = add('fx-skip', 'tap to skip', undefined, undefined, 60000);
  for (const s of steps) {
    if (skip) break;
    s.run();
    const end = performance.now() + s.wait * speed;
    while (!skip && performance.now() < end) await new Promise((r) => setTimeout(r, 30));
  }
  if (skip) L.querySelectorAll('.fx-call,.fx-ball,.fx-banner,.fx-burst,.fx-glitch,.fx-block,.fx-swish,.fx-hand,.fx-whistle,.fx-ft').forEach((e) => e.remove());
  document.querySelector('.court-wrap')?.classList.remove('cg-1', 'cg-2', 'cg-3');
  document.body.classList.remove('gl-shake');
  hint.remove();
  L.classList.remove('live');
  playing = false;
}
