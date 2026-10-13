// Procedural art for Play cards: spells (energy runes, cyan/class colour) and traps (hazard nets, red/amber). Pure SVG, seeded by the card key.
import type { CCard } from '../casual/cards';

const ACC: Record<string, string> = { splash: '#19f6ff', three: '#7fb4ff', show: '#ff7a1a', pnr: '#b48cff', bully: '#ff3d5a', bucket: '#ffb000' };
function seed(s: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const isTrapCard = (c: CCard): boolean => !!c.fx.trap;
export const cardAccent = (c: CCard): string => (c.fx.trap ? '#ff3d5a' : ACC[c.cls || ''] || '#19f6ff');

function poly(cx: number, cy: number, r: number, n: number, rot: number): string {
  return Array.from({ length: n }, (_x, i) => { const a = rot + (Math.PI * 2 * i) / n; return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`; }).join(' ');
}
function glyph(c: CCard, col: string): string {
  const f = c.fx, s = `stroke="${col}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  if (f.hard === 'block' || f.lock) return `<path ${s} d="M60 20 L74 25 V36 C74 44 68 49 60 52 C52 49 46 44 46 36 V25 Z"/><path ${s} d="M54 35 l5 5 l9 -10"/>`;
  if (f.steal || f.clock) return `<circle cx="60" cy="36" r="13" ${s}/><path ${s} d="M60 28 V36 L66 40"/><path ${s} d="M44 20 L52 26 M76 20 L68 26"/>`;
  if (f.pass) return `<path ${s} d="M44 38 H74 M66 28 L76 38 L66 48"/><circle cx="46" cy="26" r="3" fill="${col}"/>`;
  if (f.iso || f.fixed || f.counter) return `<circle cx="60" cy="36" r="14" ${s}/><circle cx="60" cy="36" r="5" ${s}/><path ${s} d="M60 16 V24 M60 48 V56 M40 36 H48 M72 36 H80"/>`;
  if (f.draw) return `<rect x="46" y="22" width="22" height="30" rx="3" ${s}/><rect x="52" y="18" width="22" height="30" rx="3" ${s} opacity=".6"/>`;
  if (f.boost) return `<path ${s} d="M46 46 L60 30 L74 46 M46 36 L60 20 L74 36"/>`;
  return `<path ${s} d="M62 16 L48 38 H58 L56 56 L74 32 H63 Z"/>`;
}
/** SVG (viewBox 120 x 64) for a Play card's art window. */
export function cardArt(c: CCard): string {
  const R = seed(c.k), col = cardAccent(c), trap = isTrapCard(c);
  const id = 'ca' + c.k.replace(/[^a-z0-9]/gi, '');
  let body = '';
  if (trap) {
    // hexagonal net with a few lit cells and a warning stripe
    let cells = '';
    for (let row = 0; row < 5; row++) for (let colI = 0; colI < 9; colI++) {
      const cx = 8 + colI * 13.5 + (row % 2) * 6.7, cy = 6 + row * 12;
      const lit = R() < 0.16;
      cells += `<polygon points="${poly(cx, cy, 7.4, 6, Math.PI / 6)}" fill="${lit ? col : 'none'}" fill-opacity="${lit ? 0.35 : 0}" stroke="${col}" stroke-opacity="${lit ? 0.95 : 0.3}" stroke-width="1"/>`;
    }
    body = `<g>${cells}</g><path d="M0 58 H120" stroke="${col}" stroke-width="5" stroke-dasharray="8 6" opacity=".6"/>${glyph(c, '#fff')}`;
  } else {
    // concentric rune rings with orbiting nodes
    const n = 3 + Math.floor(R() * 5), rot = R() * 3;
    let rings = '';
    for (let i = 0; i < 3; i++) rings += `<polygon points="${poly(60, 36, 30 - i * 7, n + (i % 2), rot + i * 0.4)}" fill="none" stroke="${col}" stroke-opacity="${0.85 - i * 0.2}" stroke-width="1.2"/>`;
    let nodes = '';
    for (let i = 0; i < 7; i++) { const a = R() * 6.28, rr = 18 + R() * 20; nodes += `<circle cx="${(60 + Math.cos(a) * rr * 1.5).toFixed(1)}" cy="${(36 + Math.sin(a) * rr * 0.75).toFixed(1)}" r="${(0.8 + R() * 1.6).toFixed(1)}" fill="${col}" opacity=".8"/>`; }
    body = `<circle cx="60" cy="36" r="34" fill="url(#${id}g)"/>${rings}${nodes}<path d="M0 36 H30 M90 36 H120" stroke="${col}" stroke-opacity=".5" stroke-width="1"/>${glyph(c, '#fff')}`;
  }
  return `<svg class="cart-svg ${trap ? 'trap' : 'spell'}" viewBox="0 0 120 64" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><radialGradient id="${id}g"><stop offset="0" stop-color="${col}" stop-opacity=".55"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient></defs>
    <rect width="120" height="64" fill="${trap ? '#1a0610' : '#060a1c'}"/><path d="M0 52 H120 M0 40 H120 M0 28 H120 M0 16 H120" stroke="${col}" stroke-opacity=".08"/>${body}</svg>`;
}
