import { describe, expect, it } from 'vitest';
import { EMPTY_CTX, SCENES, STEPS, Sequencer, type Phase, type Snap } from '../src/ui/tutorialSteps';

const snapOf = (s: (typeof STEPS)[number]): Snap => ({ n: s.n < 0 ? 12 : s.n, phase: (s.phase === 'any' ? 'def' : s.phase) as Phase, over: !!s.overOnly });

describe('guided game script', () => {
  it('covers every topic in a sensible order', () => {
    const order = [...new Set(STEPS.map((s) => s.topic))];
    const at = (t: string) => order.indexOf(t as never);
    for (const t of ['shooter', 'zone', 'card', 'go', 'log', 'scheme', 'matchups', 'momentum', 'cooling', 'pass', 'fire', 'trap', 'double', 'subs', 'clutch', 'rare', 'wrap']) expect(at(t), t).toBeGreaterThanOrEqual(0);
    expect(at('shooter')).toBeLessThan(at('zone'));
    expect(at('zone')).toBeLessThan(at('card'));
    expect(at('card')).toBeLessThan(at('go'));
    expect(at('scheme')).toBeLessThan(at('cooling'));
    expect(at('trap')).toBeLessThan(at('double'));
    expect(at('subs')).toBeLessThan(at('clutch'));
    expect(at('clutch')).toBeLessThan(at('rare'));
    expect(at('wrap')).toBe(order.length - 1);
  });
  it('walks start to finish when the player does what each step asks', () => {
    const q = new Sequencer();
    for (const s of STEPS) {
      const snap = snapOf(s);
      expect(q.current(snap)?.id).toBe(s.id);
      if (s.kind === 'click') {
        expect(q.event('nope', undefined, snap, EMPTY_CTX)).toBe(false);
        expect(q.event(s.want!.ev, s.want!.v ? s.want!.v(EMPTY_CTX) + 'x' : undefined, snap, EMPTY_CTX)).toBe(s.want!.v ? false : true);
        if (s.want!.v) expect(q.event(s.want!.ev, s.want!.v(EMPTY_CTX), snap, EMPTY_CTX)).toBe(true);
      } else expect(q.ack(snap)).toBe(true);
    }
    expect(q.finished).toBe(true);
  });
  it('shows nothing between lessons and waits for the right possession', () => {
    const q = new Sequencer();
    expect(q.current({ n: 1, phase: 'off', over: false })?.id).toBe('welcome');
    expect(q.current({ n: 1, phase: 'def', over: false })).toBeNull();
  });
  it('drops stale steps when the game moves on, and jumps to the final whistle at game over', () => {
    const q = new Sequencer();
    expect(q.current({ n: 2, phase: 'def', over: false })?.id).toBe('scheme');
    const q2 = new Sequencer();
    expect(q2.current({ n: 4, phase: 'result', over: true })?.id).toBe('wrap');
  });
  it('scripts the early possessions so lessons are guaranteed', () => {
    expect(SCENES[3].hand[0]).toBe('kick_out');
    expect(SCENES[4].hand[0]).toBe('jump_lane');
    expect(SCENES[6].moMin).toBeGreaterThanOrEqual(4);
    expect(SCENES[7].moMin).toBe(10);
    expect(SCENES[5].tire).toBe(true);
    expect(SCENES[1].rig).toBe('make');
    expect(SCENES[3].rig).toBe('make');
  });
  it('skips the log open and close steps when the log is docked beside the court', () => {
    const q = new Sequencer();
    const at = (n: number, phase: Phase, extra: Partial<Snap> = {}): Snap => ({ n, phase, over: false, ...extra });
    for (const id of ['welcome', 'shooter', 'zone', 'card', 'go1']) {
      const s = STEPS.find((x) => x.id === id)!;
      const snap = at(s.n, s.phase as Phase, { logDocked: true });
      expect(q.current(snap)?.id).toBe(id);
      if (s.kind === 'click') { if (s.want!.v) q.event(s.want!.ev, s.want!.v(EMPTY_CTX), snap, EMPTY_CTX); else q.event(s.want!.ev, undefined, snap, EMPTY_CTX); } else q.ack(snap);
    }
    expect(q.current(at(1, 'result', { logDocked: true }))?.id).toBe('log');
  });
  it('every step has short text for a phone panel', () => {
    for (const s of STEPS) { expect(s.text(EMPTY_CTX).length, s.id).toBeLessThanOrEqual(190); }
  });
});
