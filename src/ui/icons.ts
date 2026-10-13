// Tiny inline SVG icons (16x16, stroke-based) for the play-by-play log and chips. No external assets.
const P: Record<string, string> = {
  ball: '<circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2v12M3.5 3.5c3 2.5 3 6.5 0 9M12.5 3.5c-3 2.5-3 6.5 0 9"/>',
  dunk: '<path d="M3 3h10M5 3v3a3 3 0 0 0 6 0V3M8 9v4M6 13h4"/><circle cx="8" cy="6" r="1.2"/>',
  three: '<path d="M2 13c0-7 3-10 6-10s6 3 6 10"/><circle cx="8" cy="8" r="1.6"/>',
  mid: '<path d="M2 13h12M4 13V8h8v5M8 3v5"/>',
  miss: '<path d="M4 4l8 8M12 4l-8 8"/>',
  block: '<path d="M3 13V6a5 5 0 0 1 10 0v7M3 9h10M6 13V9M10 13V9"/>',
  steal: '<path d="M2 9l3-4 3 2 3-3 3 2M4 12l2-2 2 1 3-2 2 1"/>',
  trap: '<path d="M8 2l6 11H2z"/><path d="M8 6.5v3M8 11.2v.4"/>',
  double: '<circle cx="5" cy="8" r="3"/><circle cx="11" cy="8" r="3"/><path d="M8 2v2M8 12v2"/>',
  sub: '<path d="M3 5h9l-2-2M13 11H4l2 2"/>',
  fire: '<path d="M8 1c1 3 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 2 1 2 1-2 0-4 1-6z"/>',
  glitch: '<path d="M2 4h7M5 7h9M2 10h6M7 13h7"/><path d="M11 3l3 2M2 12l2-1" opacity=".6"/>',
  clutch: '<path d="M9 1L3 9h4l-1 6 7-9H9z"/>',
  pass: '<path d="M2 8h10M9 4l4 4-4 4"/><circle cx="3" cy="4" r="1"/>',
  card: '<rect x="3" y="2" width="10" height="12" rx="1.5"/><path d="M6 6h4M6 9h3"/>',
  putback: '<path d="M3 13c0-5 4-8 7-8M7 3l3 2-2 3"/>',
  read: '<circle cx="8" cy="8" r="2"/><path d="M1 8c2-4 5-5 7-5s5 1 7 5c-2 4-5 5-7 5S3 12 1 8z"/>',
  turnover: '<path d="M3 5h8a3 3 0 0 1 0 6H6M3 5l2-2M3 5l2 2M13 13l-2-2"/>',
  shield: '<path d="M8 1.5l5 2v4.5c0 3-2.2 5-5 6.5C5.2 13 3 11 3 8V3.5z"/>',
  mo: '<path d="M2 12h3V8h3V5h3V2h3"/>',
};
/** Inline icon by name. `cls` goes on the svg for colouring. */
export function icon(name: string, cls = ''): string {
  return `<svg class="ic ${cls}" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.ball}</svg>`;
}
export const ICON_NAMES = Object.keys(P);

export interface IconSrc {
  turnover: string | null; made: boolean; blocked: boolean; putback: boolean; zone: 'rim' | 'mid' | 'three';
  label: string | null; inhuman: boolean; clutch: boolean; fireOn: boolean; dt: unknown; traps: unknown[]; read: boolean;
}
/** Main icon and tone for a shot outcome in the log. */
export function mainIcon(o: IconSrc): { name: string; tone: 'good' | 'bad' | 'hot' | 'plain' } {
  if (o.turnover) return { name: o.traps.length ? 'trap' : 'steal', tone: 'bad' };
  if (o.made && (o.label || o.inhuman)) return { name: 'glitch', tone: 'hot' };
  if (o.made && o.putback) return { name: 'putback', tone: 'good' };
  if (o.made) return { name: o.zone === 'rim' ? 'dunk' : o.zone === 'three' ? 'three' : 'mid', tone: 'good' };
  if (o.blocked) return { name: 'block', tone: 'bad' };
  return { name: 'miss', tone: 'bad' };
}
/** Small badges (icon + short word) under a log row, one per thing that changed the shot. */
export function badges(o: IconSrc & { passer: number | null; iso: boolean }): { name: string; text: string }[] {
  const b: { name: string; text: string }[] = [];
  if (o.passer != null) b.push({ name: 'pass', text: 'assist' });
  if (o.read) b.push({ name: 'read', text: 'read' });
  if (o.dt) b.push({ name: 'double', text: 'double team' });
  if (o.traps.length) b.push({ name: 'trap', text: 'trap' });
  if (o.clutch) b.push({ name: 'clutch', text: 'clutch' });
  if (o.fireOn) b.push({ name: 'fire', text: 'on fire' });
  if (o.iso) b.push({ name: 'dunk', text: 'iso' });
  return b;
}
