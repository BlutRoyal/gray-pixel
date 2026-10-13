import { describe, expect, it } from 'vitest';
import { COURT_POS, HOOP, collapseSpots, contestSpot, glitchLevel, shotOrigin, zoneAt } from '../src/ui/geometry';
import { badges, icon, mainIcon } from '../src/ui/icons';
import { BOOT_LINES, GLITCH_LORE, TITLE_LINES } from '../src/ui/lore';

describe('court geometry', () => {
  it('shot origins sit in the zone they belong to, for every slot', () => {
    for (const z of ['rim', 'mid', 'three'] as const) for (let s = 0; s < 3; s++) { const [x, y] = shotOrigin(z, s); expect(zoneAt(x, y)).toBe(z); }
  });
  it('offense rests outside the arc, defense inside it', () => {
    for (const [x, y] of COURT_POS.off) expect(zoneAt(x, y)).toBe('three');
    for (const [x, y] of COURT_POS.def) expect(zoneAt(x, y)).toBe('mid');
  });
  it('a defender stands nearer the hoop than his man; a double team flanks the marked man', () => {
    const o = shotOrigin('three', 0), d = contestSpot(o);
    expect(Math.hypot(d[0] - HOOP[0], d[1] - HOOP[1])).toBeLessThan(Math.hypot(o[0] - HOOP[0], o[1] - HOOP[1]));
    const [a, b] = collapseSpots([50, 82]);
    expect(a[0]).toBeLessThan(50); expect(b[0]).toBeGreaterThan(50);
  });
  it('glitch level scales with the rarity label', () => {
    expect(glitchLevel(null, false)).toBe(0);
    expect(glitchLevel('GLITCHED', false)).toBe(1);
    expect(glitchLevel('OVERCLOCKED', false)).toBe(2);
    expect(glitchLevel('SYSTEM ERROR', false)).toBe(3);
    expect(glitchLevel(null, true)).toBe(3);
  });
});
describe('log icons and lore', () => {
  const base = { turnover: null, made: true, blocked: false, putback: false, zone: 'three' as const, label: null, inhuman: false, clutch: false, fireOn: false, dt: null, traps: [], read: false };
  it('picks an icon per event type', () => {
    expect(mainIcon(base).name).toBe('three');
    expect(mainIcon({ ...base, made: false, blocked: true }).name).toBe('block');
    expect(mainIcon({ ...base, made: false, turnover: 'x', traps: [{}] }).name).toBe('trap');
    expect(mainIcon({ ...base, label: 'GLITCHED' }).name).toBe('glitch');
    expect(badges({ ...base, passer: 1, iso: false, read: true }).map((b) => b.name)).toEqual(['pass', 'read']);
    expect(icon('fire')).toContain('<svg');
  });
  it('keeps lore strings in one place', () => {
    expect(TITLE_LINES.length).toBeGreaterThan(2); expect(BOOT_LINES.length).toBeGreaterThan(2);
    expect(GLITCH_LORE.INHUMAN.alias).toBeTruthy();
  });
});

describe('Gray Pixel branding', () => {
  it('wordmark carries the stray pixel and lore is the gray pixel origin', async () => {
    const { wordmarkSVG } = await import('../src/ui/wordmark');
    expect(wordmarkSVG()).toContain('wm-stray');
    expect(TITLE_LINES.some((l) => /gray pixel/i.test(l))).toBe(true);
    expect(BOOT_LINES.join(' ')).not.toMatch(/ballerz ccg/i);
  });
});

import { DRIVE_END, DRIVE_START, SCHEME_SPOTS, dunks, formationFor } from '../src/ui/geometry';
import { dropFrames } from '../src/ui/packs';
describe('round 2B geometry and pack drop', () => {
  it('puts the man on the ball on the spot nearest the shooter, every defender on a different spot', () => {
    for (const z of ['rim', 'mid', 'three'] as const) {
      const f = formationFor(z, 1, 12);
      expect(new Set(f.map((p) => p.join())).size).toBe(3);
      expect(f[1][0]).toBe(Math.min(...SCHEME_SPOTS[z].map((p) => p[0])));
    }
    expect(DRIVE_START).toHaveLength(3); expect(DRIVE_END[1][1]).toBeLessThan(HOOP[1] + 8);
  });
  it('Pack the Paint sags into the lane, Close Out stands outside it', () => {
    expect(Math.max(...SCHEME_SPOTS.rim.map((p) => p[1]))).toBeLessThan(36);
    expect(Math.min(...SCHEME_SPOTS.three.map((p) => p[1]))).toBeGreaterThan(48);
  });
  it('Bigs and high Rim ratings dunk', () => { expect(dunks({ pos: 'B', rim: 50 })).toBe(true); expect(dunks({ pos: 'G', rim: 90 })).toBe(true); expect(dunks({ pos: 'G', rim: 70 })).toBe(false); });
  it('a drop has one hit per bounce plus the landing, each softer than the last', () => {
    const d2 = dropFrames(600, [120, 50]), d3 = dropFrames(600, [120, 60, 25]);
    expect(d2.hits).toHaveLength(3); expect(d3.hits).toHaveLength(4);
    expect(d2.hits[1].power).toBeLessThan(d2.hits[0].power); expect(d3.dur).toBeGreaterThan(d2.dur);
    expect(d2.keys[d2.keys.length - 1].offset).toBe(1);
  });
});

describe('inspector layout', () => {
  it('log-row grid rules never hit list items inside the inspector (.why / .ins-parts)', async () => {
    const { readFileSync } = await import('node:fs');
    for (const f of ['style', 'theme', 'gray', 'mobile', 'lite']) {
      const css = readFileSync(`src/${f}.css`, 'utf8');
      expect(css, f).not.toMatch(/\.plog li\b/);
    }
  });
});
