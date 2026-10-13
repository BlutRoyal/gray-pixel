// Guided first game, UI layer: a text bubble with an arrow, a glowing highlight on the real UI element, and a click guard that lets
// only the highlighted thing through. The lesson order lives in tutorialSteps.ts; play.ts owns the game and feeds this module.
import { EMPTY_CTX, STEPS, Sequencer, type Ctx, type Snap, type Step } from './tutorialSteps';
import { profile, save } from './store';

export interface TutHost {
  /** The live game position, or null when no game is on. */
  snap(): Snap | null;
  ctx(): Ctx;
  /** True while an animation or the Clutch bar is on screen (the bubble hides, the guard stays). */
  busy(): boolean;
  /** Leaves the tutorial game for the menu. */
  skip(): void;
  /** Plays the rare-shot demo. */
  demo(): void;
}
let host: TutHost | null = null;
let seq: Sequencer | null = null;
let shown = '';
let armed = false;
let skipArm = 0;
/** When the current step appeared: a mouse resting on the log must not complete the log lesson by itself. */
let since = 0;
export const setTutHost = (h: TutHost): void => { host = h; };
export const tutActive = (): boolean => !!seq;

function snap(): Snap | null { return host ? host.snap() : null; }
function ctx(): Ctx { try { return host ? host.ctx() : EMPTY_CTX; } catch { return EMPTY_CTX; } }
/** The step on screen right now (null between lessons or while something animates). */
export function tutStep(): Step | null {
  const s = snap();
  return seq && s && host && !host.busy() ? seq.current(s) : null;
}

/** Phones and tablets: the lesson sits in a panel docked at the bottom and the game shrinks above it, so it never covers the highlighted control. */
export const dockMode = (): boolean => innerWidth < 900 || innerHeight < 520;
function syncDock(): void { document.body.classList.toggle('tut-dock', !!seq && dockMode()); }
export function tutBegin(): void {
  seq = new Sequencer();
  shown = '';
  arm();
  syncDock();
}
export function tutEnd(): void {
  seq = null;
  shown = '';
  syncDock();
  document.getElementById('tutor')?.remove();
  document.querySelectorAll('.tut-hl').forEach((e) => e.classList.remove('tut-hl'));
}

/** Marks the tutorial as done (or skipped) in the profile. A replay never downgrades it. */
export function tutMark(state: 'done' | 'skipped'): void {
  const t = profile().tut;
  if (state === 'done') t.state = 'done';
  else if (t.state === 'new') t.state = 'skipped';
  save();
}

/** The player did something in the game (called by play.ts after the action took effect). */
export function tutNote(ev: string, v?: string): void {
  const s = snap();
  if (!seq || !s) return;
  if (ev === 'logrow' && Date.now() - since < 700) return;
  if (seq.event(ev, v, s, ctx())) tutSync();
}

// ---------- the click guard ----------
function arm(): void {
  if (armed) return;
  armed = true;
  const blocks = (t: Element | null): boolean => {
    const step = tutStep();
    const raw = seq && snap() ? seq.current(snap()!) : null;
    const st = step || raw;
    if (!st || st.kind === 'note' || !t) return false;
    if (t.closest('#tutor, .clutch-ov, .boot, .fx-layer')) return false;
    if (!step) return true; // an animation is playing: clicks are ignored by the game anyway, keep them from leaking
    const allow = st.kind === 'click' ? (st.allow ?? st.target)?.(ctx()) : '';
    return !(allow && t.closest(allow));
  };
  const stop = (e: Event): void => { e.stopPropagation(); e.preventDefault(); nudge(); };
  document.addEventListener('click', (e) => { if (seq && blocks(e.target as Element)) stop(e); }, true);
  document.addEventListener('keydown', (e) => {
    if (!seq) return;
    if (e.key === 'Enter' || e.key === ' ') {
      const t = (e.target as Element | null)?.closest('[data-a]');
      if (t && blocks(t)) stop(e);
    }
  }, true);
  window.addEventListener('resize', () => tutSync());
  window.addEventListener('scroll', () => requestAnimationFrame(place), { passive: true });
}
/** A short shake of the bubble: "tap the glowing thing". */
function nudge(): void {
  const b = document.getElementById('tutor');
  if (!b) return;
  b.classList.remove('nudge');
  void b.offsetWidth;
  b.classList.add('nudge');
}

// ---------- the bubble ----------
function bubbleHTML(s: Step, c: Ctx): string {
  const total = STEPS.length;
  const i = Math.min(total, (seq?.idx ?? 0) + 1);
  const ok = s.kind === 'click' ? '' : `<button class="btn go sm" data-a="tut-ok">${s.ok || 'Got it'}</button>`;
  return `<i class="tb-bar" style="--p:${Math.round((seq?.progress ?? 0) * 100)}%"></i>
    <div class="tb-kick"><span>// GUIDE</span><em>${i} / ${total}</em></div>
    <h3 class="tb-t">${s.title}</h3><p class="tb-x">${s.text(c)}</p>
    <div class="tb-row"><button class="tb-skip" data-a="tut-skip">Skip tutorial</button>${ok}</div><i class="tb-arrow" aria-hidden="true"></i>`;
}
const visible = (el: Element): boolean => { const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
function targets(): HTMLElement[] {
  const s = tutStep();
  if (!s?.target) return [];
  const q = s.target(ctx());
  return Array.from(document.querySelectorAll<HTMLElement>(q)).filter(visible);
}

/** Redraws the bubble and highlight for the current game position. Cheap enough to call after every render. */
export function tutSync(): void {
  syncDock();
  document.querySelectorAll('.tut-hl').forEach((e) => e.classList.remove('tut-hl'));
  let b = document.getElementById('tutor');
  const s = tutStep();
  if (!s) { b?.classList.add('gone'); shown = ''; return; }
  const c = ctx();
  if (!b) { b = document.createElement('div'); b.id = 'tutor'; b.className = 'tutor'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Tutorial'); document.body.appendChild(b); shown = ''; }
  const html = bubbleHTML(s, c);
  const key = s.id + '|' + html;
  b.classList.remove('gone');
  if (shown !== key) {
    const fresh = !shown.startsWith(s.id + '|');
    b.innerHTML = html;
    shown = key;
    skipArm = 0;
    if (fresh) since = Date.now();
    if (fresh) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
    b.dataset.kind = s.kind;
    b.dataset.step = s.id;
    if (fresh) bringIntoView();
  }
  targets().forEach((e) => e.classList.add('tut-hl'));
  place();
}

/** Scrolls so the target is on screen (the bubble then goes above or below it). */
function bringIntoView(): void {
  const t = targets()[0];
  if (!t) return;
  if (t.closest('.sheetwrap, .xg-log, .overlay')) { t.scrollIntoView({ block: 'nearest', behavior: 'auto' }); return; }
  const r = t.getBoundingClientRect(), vh = window.innerHeight - (document.body.classList.contains('tut-dock') ? (document.getElementById('tutor')?.offsetHeight || 0) : 0);
  if (r.top < 60 || r.bottom > vh - 40) t.scrollIntoView({ block: r.height > vh * 0.5 ? 'start' : 'center', behavior: 'auto' });
}

/** Puts the bubble where it does not cover its target: below, above, then beside it (wide screens). */
function place(): void {
  const b = document.getElementById('tutor');
  if (!b || b.classList.contains('gone')) return;
  if (dockMode()) {
    // docked: fixed at the bottom by CSS, no arrow; the highlighted control keeps its glow
    b.dataset.pos = 'dock';
    for (const k of ['width', 'left', 'top', 'maxHeight'] as const) b.style[k] = '';
    return;
  }
  const vw = window.innerWidth, vh = window.innerHeight, M = 10, gap = 16;
  const bw = Math.min(vw < 600 ? vw - 2 * M : 380, vw - 2 * M);
  b.style.width = bw + 'px';
  b.style.maxHeight = '';
  b.style.left = '0px';
  b.style.top = '0px';
  const bh = b.offsetHeight;
  const t = targets()[0];
  const clampX = (x: number): number => Math.max(M, Math.min(vw - M - bw, x));
  const clampY = (y: number): number => Math.max(M, Math.min(vh - M - bh, y));
  let pos = 'center', left = clampX((vw - bw) / 2), top = clampY(vh * (vw < 600 ? 0.28 : 0.3));
  let ax = bw / 2, ay = 0;
  if (t) {
    const r = t.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const fits = (l: number, tp: number): boolean => l >= M - 1 && tp >= M - 1 && l + bw <= vw - M + 1 && tp + bh <= vh - M + 1;
    const cands: [string, number, number][] = [
      ['below', clampX(cx - bw / 2), r.bottom + gap],
      ['above', clampX(cx - bw / 2), r.top - gap - bh],
    ];
    if (vw >= 700) cands.push(['right', r.right + gap, clampY(cy - bh / 2)], ['left', r.left - gap - bw, clampY(cy - bh / 2)]);
    // among the placements that fit, take the one that covers the fewest other controls (buttons, tokens)
    const others = Array.from(document.querySelectorAll<HTMLElement>('button[data-a], .tok')).filter((e) => !e.classList.contains('tut-hl') && !e.closest('#tutor') && visible(e)).map((e) => e.getBoundingClientRect());
    const cover = (l: number, tp: number): number => others.reduce((a, o) => a + Math.max(0, Math.min(l + bw, o.right) - Math.max(l, o.left)) * Math.max(0, Math.min(tp + bh, o.bottom) - Math.max(tp, o.top)), 0);
    const fit = cands.filter(([, l, tp]) => fits(l, tp)).sort((a, b) => cover(a[1], a[2]) - cover(b[1], b[2]));
    const ok = fit[0];
    if (ok) { [pos, left, top] = ok; }
    else {
      // no room without covering the target: take the bigger side and let the text scroll
      const below = vh - M - (r.bottom + gap), above = r.top - gap - M;
      if (below >= above) { pos = 'below'; top = r.bottom + gap; b.style.maxHeight = Math.max(110, below) + 'px'; }
      else { pos = 'above'; top = Math.max(M, r.top - gap - Math.max(110, above)); b.style.maxHeight = Math.max(110, above) + 'px'; }
      left = clampX(cx - bw / 2);
    }
    if (pos === 'below' || pos === 'above') ax = Math.max(18, Math.min(bw - 18, cx - left));
    else ay = Math.max(18, Math.min(b.offsetHeight - 18, cy - top));
  }
  b.dataset.pos = pos;
  b.style.left = Math.round(left) + 'px';
  b.style.top = Math.round(top) + 'px';
  b.style.setProperty('--ax', Math.round(ax) + 'px');
  b.style.setProperty('--ay', Math.round(ay) + 'px');
}

/** Returns true when the action belonged to the tutorial. */
export function tutorialAct(a: string): boolean {
  switch (a) {
    case 'tut-ok': {
      const s = snap();
      if (!seq || !s) return true;
      const cur = seq.current(s);
      if (cur?.id === 'rare') host?.demo();
      if (seq.ack(s)) tutSync();
      return true;
    }
    case 'tut-skip': {
      const btn = document.querySelector<HTMLElement>('.tb-skip');
      if (!skipArm) {
        skipArm = 1;
        if (btn) btn.textContent = 'Tap again to leave';
        setTimeout(() => { skipArm = 0; const b2 = document.querySelector<HTMLElement>('.tb-skip'); if (b2) b2.textContent = 'Skip tutorial'; }, 3000);
        return true;
      }
      skipArm = 0;
      host?.skip();
      return true;
    }
  }
  return false;
}
