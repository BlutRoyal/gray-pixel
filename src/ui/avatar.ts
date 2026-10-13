// Pixel avatar drawn from the Baller's traits. Used when the real image can't load (offline, blocked host).
import type { BallerCard } from '../rules';

const SKIN: Record<string, string> = {
  'Human I': '#f2cba6', 'Human II': '#dca77b', 'Human III': '#b97e52', 'Human IV': '#8b5836', 'Human V': '#5c3822', 'Human': '#ffd34d',
  'Lizard': '#5fae4b', 'Stone': '#9b9b9b', 'Zombie': '#8fb08a', 'Bright Zombie': '#b6ff7a', 'Alien': '#7fd6c7', 'Pink Alien': '#f29ad6', 'Bright Pink Alien': '#ff5fd0', 'Devil': '#d63a3a', 'Emoji': '#ffd23f',
};
function hairColor(h: string): string {
  const t = h.toLowerCase();
  if (t.includes('crazy blue')) return '#36c3ff';
  if (t.includes('crazy orange')) return '#ff8a1f';
  if (t.includes('purple')) return '#9b59ff';
  if (t.includes('pink')) return '#ff7ac8';
  if (t.includes('blonde')) return '#f3d36b';
  if (t.includes('light brun') || t.includes('light brown')) return '#9a6b3f';
  if (t.includes('brunette')) return '#6b4423';
  if (t.includes('brown')) return '#5a3a22';
  if (t.includes('red')) return '#c4452b';
  if (t.includes('black')) return '#1d1a1a';
  if (t.includes('cheetah')) return '#e0a64a';
  if (t.includes('striped')) return '#f5f5f5';
  return '#2a1d16';
}
export function teamHue(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
type AvatarSrc = Pick<BallerCard, 'id' | 'team' | 'body' | 'hair' | 'flags' | 'acc' | 'role'>;
const cache = new Map<number, string>();
export function avatar(c: AvatarSrc): string {
  const hit = cache.get(c.id);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = 16; cv.height = 16;
  const x = cv.getContext('2d')!;
  const P = (col: string, px: number, py: number, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  const hue = teamHue(c.team);
  const skin = SKIN[c.body] || '#d9a77c', hair = hairColor(c.hair), hn = c.hair.toLowerCase();
  P(`hsl(${hue},75%,52%)`, 3, 12, 10, 4); P(`hsl(${hue},75%,38%)`, 3, 12, 10, 1); P(skin, 7, 11, 2, 1);
  if (c.flags & 1) P('#fff', 3, 13, 1, 2);
  P(skin, 5, 3, 6, 8); P(skin, 4, 4, 8, 6);
  P('#111', 6, 6); P('#111', 9, 6); P('rgba(0,0,0,.45)', 7, 9, 2, 1);
  if (c.body === 'Emoji') { P('#111', 6, 9, 4, 1); P('#111', 5, 8); P('#111', 10, 8); }
  if (c.body === 'Devil') { P('#ffdf3d', 4, 2); P('#ffdf3d', 11, 2); }
  if (c.body.includes('Alien')) { P('#111', 5, 6, 2, 1); P('#111', 9, 6, 2, 1); }
  if (!['shaved', 'very thin'].includes(hn)) {
    if (hn === 'afro') { P(hair, 3, 1, 10, 4); P(hair, 2, 3, 1, 4); P(hair, 13, 3, 1, 4); }
    else if (hn.includes('flat top')) P(hair, 4, 0, 8, 4);
    else if (hn.includes('spiked')) { P(hair, 4, 2, 8, 2); P(hair, 5, 1); P(hair, 7, 0); P(hair, 9, 1); P(hair, 10, 0); }
    else if (hn.includes('thinning') || hn.includes('patchy')) { P(hair, 4, 3, 2, 1); P(hair, 10, 3, 2, 1); P(hair, 7, 3, 1, 1); }
    else { P(hair, 4, 2, 8, 2); P(hair, 5, 1, 6, 1); }
    if (hn.includes('pompadour')) { P(hair, 5, 0, 6, 1); P(hair, 4, 1, 7, 1); }
    if (hn.includes('bun')) P(hair, 7, 0, 2, 1);
    if (hn.includes('ponytail')) { P(hair, 12, 4, 1, 4); P(hair, 13, 6, 1, 3); }
    if (hn.includes('long')) { P(hair, 3, 4, 1, 6); P(hair, 12, 4, 1, 6); }
    if (hn.includes('pigtails')) { P(hair, 2, 5, 2, 2); P(hair, 12, 5, 2, 2); }
    if (hn.includes('bob') || hn.includes('medium') || hn.includes('braids')) { P(hair, 3, 3, 1, 5); P(hair, 12, 3, 1, 5); }
  }
  if (c.flags & 2) P('#ff3b5c', 4, 4, 8, 1);
  const a = c.acc;
  if (/Glasses|Goggles|Visor/.test(a)) { const col = a.includes('3D') ? '#ff3b3b' : a.includes('Space') ? '#4de1ff' : a.includes('Steampunk') ? '#b07a2a' : '#222'; P(col, 5, 6, 6, 1); if (a.includes('3D')) P('#3b8bff', 9, 6, 2, 1); }
  if (a === 'Eye Patch') P('#111', 8, 5, 2, 2);
  if (a === 'Cyborg Eye') P('#ff2a2a', 9, 6);
  if (a.includes('Chain') || a === 'Clock Necklace') P(a.includes('Gold') || a.includes('Clock') ? '#ffd23f' : '#d9d9d9', 6, 12, 4, 1);
  if (a.includes('Headphones')) { const col = a.includes('Gold') ? '#ffd23f' : a.includes('Red') ? '#ff3b3b' : '#8a8a8a'; P(col, 3, 5, 1, 3); P(col, 12, 5, 1, 3); P(col, 4, 2, 8, 1); }
  if (a === 'Nasal Strip') P('#fff', 7, 7, 2, 1);
  if (a === 'Earrings') P('#ffd23f', 3, 8);
  if (a === 'Pencil') P('#ffb703', 12, 3, 1, 2);
  if (a === 'Arm Tattoo') P('#1b4b8a', 12, 13, 1, 2);
  const url = cv.toDataURL();
  cache.set(c.id, url);
  return url;
}
