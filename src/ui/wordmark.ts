// Pixel-art GRAY PIXEL wordmark (5x7 glyphs drawn as SVG rects) with one stray gray pixel that sits where it should not.
const G: Record<string, string[]> = {
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  '&': ['.##..', '#..#.', '#..#.', '.##..', '#.#.#', '#..#.', '.##.#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
};
const TOP = 4; // rows of head room above the letters, where the stray pixel lives
/** Path data for the wordmark: `rest` is every letter but the A of GRAY, `a` is that A, `amp` is the & it sometimes glitches into. */
function letters(): { rest: string; a: string; amp: string; w: number } {
  let x = 0, rest = '', a = '', amp = '';
  const draw = (ch: string, x0: number): string => { let d = ''; G[ch].forEach((row, y) => [...row].forEach((c, i) => { if (c === '#') d += `M${x0 + i} ${y + TOP}h1v1h-1z`; })); return d; };
  let n = 0;
  for (const ch of 'GRAY PIXEL') {
    if (ch === ' ') { x += 3; continue; }
    if (n++ === 2) { a = draw('A', x); amp = draw('&', x); } else rest += draw(ch, x);
    x += 6;
  }
  return { rest, a, amp, w: x - 1 };
}
const L = letters();
/** The wordmark as inline SVG. `cls` sizes it from CSS. The stray pixel is the gray cell above the I of PIXEL, one cell off the stem.
 *  The A of GRAY now and then flickers into an & (CSS keyframes on .wm-ay / .wm-amp; off for reduced motion and lite mode). */
export function wordmarkSVG(cls = ''): string {
  const sx = 36, sy = 1; // above the I of PIXEL (stem at column 35), one cell to the right
  const h = TOP + 7;
  const layer = (c: string, tr = ''): string => `<g class="${c}"${tr ? ` transform="${tr}"` : ''}><path d="${L.rest}"/><path class="wm-ay" d="${L.a}"/><path class="wm-amp" d="${L.amp}"/></g>`;
  return `<svg class="wm ${cls}" viewBox="-1 0 ${L.w + 2} ${h}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
    ${layer('wm-b')}${layer('wm-a')}${layer('wm-s', 'translate(.45 .45)')}${layer('wm-t')}
    <rect class="wm-stray" x="${sx}" y="${sy}" width="1" height="1"/></svg>`;
}
/** A lone gray pixel for glitch effects, boot, packs and Iconic cards. */
export const strayHTML = (cls = ''): string => `<i class="stray ${cls}" aria-hidden="true"></i>`;
