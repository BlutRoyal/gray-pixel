import { describe, expect, it } from 'vitest';
import { AUDIO_KEY, DEFAULT_AUDIO, effectiveGains, loadSettings, parseSettings, saveSettings } from '../src/ui/audioSettings';
import { SOUNDS } from '../src/ui/sounds';
import { TRACKS } from '../src/ui/tracks';

const fake = (init: Record<string, string> = {}) => {
  const m = { ...init };
  return { getItem: (k: string) => (k in m ? m[k] : null), setItem: (k: string, v: string) => { m[k] = v; }, dump: () => m };
};

describe('audio settings persistence', () => {
  it('starts at the defaults when nothing is stored', () => {
    expect(loadSettings(fake())).toEqual(DEFAULT_AUDIO);
  });
  it('saves and loads master, sfx, music and mute', () => {
    const s = fake();
    expect(saveSettings({ master: 0.4, sfx: 0.7, music: 0.2, mute: true }, s)).toBe(true);
    expect(loadSettings(s)).toEqual({ master: 0.4, sfx: 0.7, music: 0.2, mute: true });
    expect(JSON.parse(s.dump()[AUDIO_KEY]).mute).toBe(true);
  });
  it('clamps out-of-range numbers and ignores junk', () => {
    expect(parseSettings('{"master":7,"sfx":-2,"music":"loud","mute":"yes"}')).toEqual({ master: 1, sfx: 0, music: DEFAULT_AUDIO.music, mute: false });
    expect(parseSettings('not json')).toEqual(DEFAULT_AUDIO);
    expect(parseSettings('null')).toEqual(DEFAULT_AUDIO);
    expect(parseSettings(null)).toEqual(DEFAULT_AUDIO);
  });
  it('survives blocked storage (every access throws)', () => {
    const bad = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadSettings(bad)).toEqual(DEFAULT_AUDIO);
    expect(saveSettings(DEFAULT_AUDIO, bad)).toBe(false);
    expect(saveSettings(DEFAULT_AUDIO, null)).toBe(false);
  });
  it('mute silences every bus; volumes follow a squared curve', () => {
    expect(effectiveGains({ master: 1, sfx: 1, music: 1, mute: true })).toEqual({ master: 0, sfx: 0, music: 0 });
    const g = effectiveGains({ master: 0.5, sfx: 1, music: 0, mute: false });
    expect(g.master).toBeCloseTo(0.25); expect(g.sfx).toBe(1); expect(g.music).toBe(0);
  });
});

describe('default volumes', () => {
  it('new players start clearly quieter than full', () => {
    expect(DEFAULT_AUDIO.master).toBeLessThanOrEqual(0.5); expect(DEFAULT_AUDIO.sfx).toBeLessThanOrEqual(0.6); expect(DEFAULT_AUDIO.music).toBeLessThanOrEqual(0.4);
  });
  it('saved settings are kept as they are', () => {
    expect(parseSettings('{"master":0.85,"sfx":1,"music":0.6,"mute":false}')).toEqual({ master: 0.85, sfx: 1, music: 0.6, mute: false });
  });
});

describe('sound and music tables', () => {
  it('every sound has a recipe, a class and a positive trim', () => {
    const names = Object.keys(SOUNDS);
    expect(names.length).toBeGreaterThan(40);
    for (const n of names) { const d = SOUNDS[n as keyof typeof SOUNDS]; expect(typeof d.fn).toBe('function'); expect(d.trim).toBeGreaterThan(0); expect(['ui', 'play', 'big']).toContain(d.cat); }
  });
  it('the key game events all have a sound', () => {
    for (const n of ['tap', 'confirm', 'back', 'tab', 'cardSelect', 'cardPlay', 'trapSet', 'moTick', 'moSurge', 'shotRelease', 'swish', 'rim', 'backboard', 'dunk', 'layup', 'block', 'steal', 'turnover', 'andOne', 'roar', 'groan', 'fireOn', 'heartbeat', 'clutchRiser', 'glitch1', 'glitch2', 'glitch3', 'subSwap', 'coin', 'shard', 'levelUp', 'reward', 'packRip', 'packCharge', 'packReveal', 'iconicHit', 'flipSlap', 'venitus', 'hitEpic', 'hitLegendary', 'hitHolo', 'nextTick', 'summary', 'boot']) expect(SOUNDS).toHaveProperty(n);
  });
  it('tracks loop on whole bars at a sensible tempo', () => {
    for (const t of Object.values(TRACKS)) { expect(t.len % 16).toBe(0); expect(t.bpm).toBeGreaterThanOrEqual(60); expect(t.bpm).toBeLessThanOrEqual(100); }
  });
});
