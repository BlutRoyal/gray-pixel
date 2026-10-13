// Shared view pieces: escaping, images with pixel fallback, and the three card faces (Baller, Sneaker, Play).
import {
  CLASSES, ENH_NAME, ENH_SHOT, SHOTS, TIER_NAME, TRAITS, ballerRow, ballerTier, catalog, makeBaller, sneakerRow, sneakerRowTier,
  type BallerCard, type Tier,
} from '../rules';
import { avatar, teamHue } from './avatar';
import { cardArt, isTrapCard } from './cardart';
import { RARITY_NAME, ccard, classLabel, whenLabel, type CCard } from '../casual/cards';
import { cBaller } from '../casual/engine';
import { specialText } from '../casual/specials';
import { cardTier } from '../casual/packs';

export const esc = (s: unknown): string => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const reduced = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const ballerImgUrl = (id: number): string => `https://ballerz.cloud/images/ballerz/${id}.png`;
export const heroImgUrl = (id: number): string => `https://ballerz.com/images/allstars-nobg/${id}.png`;

export const sneakerImgUrl = (id: number): string => `https://ballerz.cloud/images/sneakerz/${id}.png`;

/** Real Baller image on the team-colour background. If it can't load, only the card number shows. */
/** Image URLs that already loaded once this session: a re-render shows them at once instead of fading in from the placeholder again. */
export const loadedImgs = new Set<string>();
/** Image URLs that failed: a re-render goes straight to the fallback avatar instead of showing the placeholder again. */
export const failedImgs = new Set<string>();
export const ldCls = (url: string): string => (loadedImgs.has(url) ? ' ld' : '');
export function ballerImg(c: BallerCard, cls = ''): string {
  return `<span class="pwrap ${cls}" data-id="#${c.id}"><img class="pimg${ldCls(ballerImgUrl(c.id))}" src="${ballerImgUrl(c.id)}" data-fb="1" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>`;
}
export function heroImg(cls: keyof typeof CLASSES, extra = ''): string {
  const d = CLASSES[cls];
  const w = d.hero.split(/\s+/), initials = (w.length > 1 ? w.map((x) => x[0]).join('') : w[0]).slice(0, 2).toUpperCase();
  if (!d.heroId) return `<span class="hero-emb ${extra}" aria-hidden="true">${esc(initials)}</span>`;
  return `<span class="hero-emb ${extra}" aria-hidden="true"><img class="pimg" src="${heroImgUrl(d.heroId)}" data-fb-text="${esc(initials)}" alt="" referrerpolicy="no-referrer"></span>`;
}

export const CLASS_ACC: Record<string, string> = { splash: '#19f6ff', three: '#7fb4ff', show: '#ff7a1a', pnr: '#b48cff', bully: '#ff3d5a', bucket: '#ffb000' };
/** Coach portrait in an animated chamfered frame, for the coach picker. Initials sit under the image as fallback. */
export function coachPortrait(cls: keyof typeof CLASSES, on = false): string {
  const d = CLASSES[cls];
  const w = d.hero.split(/\s+/), initials = (w.length > 1 ? w.map((x) => x[0]).join('') : w[0]).slice(0, 2).toUpperCase();
  return `<span class="coach-frame${on ? ' on' : ''}" style="--acc:${CLASS_ACC[cls]}" aria-hidden="true">
    <span class="cf-ring"></span><span class="cf-in"><span class="cf-init">${esc(initials)}</span>${d.heroId ? `<img src="${heroImgUrl(d.heroId)}" data-fb="1" alt="" referrerpolicy="no-referrer">` : ''}</span>
    <i class="cf-c tl"></i><i class="cf-c tr"></i><i class="cf-c bl"></i><i class="cf-c br"></i>
    <span class="cf-id">#${d.heroId ?? '----'}</span></span>`;
}

/** Big coach portrait for the title screen: real image on an avatar-and-glow background; the pixel avatar shows when the image can't load. */
export function coachArt(cls: keyof typeof CLASSES): string {
  const d = CLASSES[cls];
  const w = d.hero.split(/\s+/), initials = (w.length > 1 ? w.map((x) => x[0]).join('') : w[0]).slice(0, 2).toUpperCase();
  const u = d.heroId ? heroImgUrl(d.heroId) : '';
  if (d.heroId && failedImgs.has(u)) { let av = ''; try { av = `--av:url(${avatar(ballerFromId(d.heroId))});`; } catch { /* no canvas */ } if (av) return `<span class="coach-art avfb" style="--acc:${CLASS_ACC[cls]};${av}" aria-hidden="true"></span>`; }
  return `<span class="coach-art" style="--acc:${CLASS_ACC[cls]}" aria-hidden="true"><span class="ca-init">${esc(initials)}</span>${d.heroId ? `<img class="${ldCls(u).trim()}" src="${u}" data-fb="1" data-av="${d.heroId}" alt="" referrerpolicy="no-referrer">` : ''}</span>`;
}

export const CLASS_SHORT: Record<string, string> = { splash: 'SPLASH', three: '3&D', show: 'SHOWTIME', pnr: 'P&R', bully: 'BULLY', bucket: 'BUCKETS', neutral: 'NEUTRAL' };
const STAT_ABBR: Record<string, string> = { D: 'DNK', P: 'PLY', S: 'SHT', F: 'DEF', J: 'JMP' };
const STAT_NAME: Record<string, string> = { D: 'Dunk', P: 'Playmaking', S: 'Shooting', F: 'Defense', J: 'Jump' };

/** A Baller as a collectible card with no Sneaker on (J shows as a dash). */
export function ballerFromId(id: number): BallerCard {
  return makeBaller(ballerRow(id)!, [0, 0, 0, 0, 0, 0]);
}
function statCells(c: BallerCard, withJ: boolean): string {
  return (['D', 'S', 'P', 'F', 'J'] as const).map((k) => {
    const v = k === 'J' && !withJ ? null : c.st[k];
    const cls = v == null ? 'na' : v >= 95 ? 'elite' : v >= 90 ? 'hi' : v < 70 ? 'lo' : '';
    return `<div class="sc ${cls}" title="${STAT_NAME[k]}"><span>${STAT_ABBR[k]}</span><b>${v == null ? '–' : v}</b></div>`;
  }).join('');
}

export interface CardOpts {
  holo?: boolean;
  count?: number;
  isNew?: boolean;
  small?: boolean;
  /** Baller level 1..5: shown on the card and added to his stats. */
  level?: number;
}
// An Iconic card keeps its top frame, but only the HOLO Iconic Baller glitches (continuously).
const wrap = (kind: string, tier: Tier, o: CardOpts, inner: string, label: string): string => {
  const gl = !!o.holo && tier === 'iconic' && kind.startsWith('bcard');
  return `<div class="card ${kind} t-${tier}${o.holo ? ' holo' : ''}${o.small ? ' sm' : ''}${gl ? ' ic-gl' : ''}" data-tilt role="img" aria-label="${esc(label)}${o.holo ? ', HOLO' : ''}">
    <div class="cface">${inner}</div><div class="sheen"></div>${tier === 'iconic' && !kind.startsWith('scard') ? '<i class="stray ic-stray" aria-hidden="true"></i>' : ''}${o.holo ? '<span class="holob">HOLO</span>' : ''}${gl ? '<i class="glbar" aria-hidden="true"></i>' : ''}
    ${o.count && o.count > 1 ? `<span class="cnt">×${o.count}</span>` : ''}${o.isNew ? '<span class="newb">NEW</span>' : ''}
  </div>`;
};

export function ballerCardHTML(id: number, o: CardOpts = {}): string {
  const c = ballerFromId(id), tier = ballerTier(id), r = cBaller(id, null, o.level || 1, !!o.holo), lv = o.level || 1;
  return wrap('bcard', tier, o, `
    <div class="ctop"><span class="cls-tag">${CLASS_SHORT[c.cls]}</span><span class="tier-tag">${TIER_NAME[tier]}${lv > 1 ? ` · Lv ${lv}` : ''}</span></div>
    <div class="cart" style="--hue:${teamHue(c.team)}">${ballerImg(c)}</div>
    <div class="cname"><b>Baller ${esc(c.name)}</b><small>${esc(c.team)}</small></div>
    <div class="cstats">${statCells(c, false)}</div>
    <div class="ctrait cgame-line"><span>${r.pos}</span><span>RIM <b>${r.rim}</b></span><span>MID <b>${r.mid}</b></span><span>3PT <b>${r.three}</b></span><span>DEF <b>${r.def}</b></span></div>
    <div class="ctrait"><b>${esc(r.skill.name)}</b>: ${esc(r.skill.text)}</div>${r.special ? `<div class="ctrait csp"><b>Special: ${esc(r.special.name)}</b> ${esc(specialText(r.special, r.holo))}</div>` : ''}`,
  `Baller ${c.name}, ${TIER_NAME[tier]}`);
}

export function sneakerCardHTML(id: number, o: CardOpts = {}): string {
  const s = sneakerRow(id)!, D = catalog();
  const tier = sneakerRowTier(s);
  const enh = s[2] ? ENH_NAME[s[2]] : '';
  return wrap('scard', tier, o, `
    <div class="ctop"><span class="cls-tag">SNEAKER</span><span class="tier-tag">${esc(D.rar[s[3]])}</span></div>
    <div class="cart sneaker-art"><span class="pwrap swrap"><img class="pimg" src="${sneakerImgUrl(s[0])}" data-fb="1" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">${sneakerSVG(s[3])}</span><div class="jump"><small>JUMP</small><b>${s[1]}</b></div></div>
    <div class="cname"><b>Sneaker #${s[0]}</b><small>${esc(D.des[s[4]] || 'Sneaker')}, drip ${s[5]}</small></div>
    <div class="ctrait">Rarity adds accuracy to every shot, Jump adds up to +8% at the Rim.${enh ? ` <span class="dim">${esc(enh)}</span>` : ''}</div>`,
  `Sneaker ${s[0]}, ${D.rar[s[3]]}`);
}

/** Face of a casual Play card: cost, name, type line, effect and flavour. */
export function ccardFace(c: CCard, cost = c.cost): string {
  return `<span class="pcost" title="Momentum cost">${c.fx.allIn ? 'ALL' : cost}</span><b class="pname">${esc(c.name)}</b><span class="ptype">${esc(RARITY_NAME[c.rarity])} · ${esc(classLabel(c))} · ${esc(whenLabel(c))}</span><span class="ptext">${esc(c.text)}</span><span class="pflav">${esc(c.flavor)}</span>`;
}
export function playCardHTML(key: string, o: CardOpts = {}): string {
  const cc = ccard(key)!, tier = cardTier(cc);
  const trap = isTrapCard(cc);
  return wrap(`pcard ${trap ? 'sp-trap' : 'sp-spell'}${cc.cls ? ' pc-' + cc.cls : ''}`, tier, o,
    `<div class="ctop"><span class="cls-tag">${cc.cls ? CLASS_SHORT[cc.cls] : 'NEUTRAL'}</span><span class="tier-tag">${RARITY_NAME[cc.rarity]}</span></div>
    <div class="pc-art">${cardArt(cc)}<span class="pc-kind">${trap ? 'TRAP' : 'SPELL'}</span></div><div class="pbody">${ccardFace(cc)}</div>`, `${cc.name}, ${trap ? 'trap' : 'spell'}, ${RARITY_NAME[cc.rarity]}`);
}

export function sneakerSVG(rarI: number): string {
  const col = ['#9fb3ae', '#7fe0c0', '#3dffc5', '#b48cff', '#ffb000', '#ff6b1a'][rarI] || '#9fb3ae';
  return `<svg viewBox="0 0 64 36" class="shoe" aria-hidden="true"><path d="M4 26c0-6 4-9 9-10l9-9c2-2 5-2 7 0l4 5c3 3 7 4 12 5 8 1 15 4 15 9v3H4z" fill="${col}"/><path d="M4 29h56v4H4z" fill="#f4ead5"/><path d="M20 12l4 4M24 9l4 4M28 7l3 3" stroke="#0b1416" stroke-width="2" stroke-linecap="round"/></svg>`;
}

/** Pointer tilt + moving sheen on any [data-tilt] card. */
export function bindTilt(root: HTMLElement): void {
  if (reduced()) return;
  const tilt = (e: PointerEvent): void => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tilt]');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', ((0.5 - y) * 14).toFixed(1) + 'deg');
    el.style.setProperty('--ry', ((x - 0.5) * 16).toFixed(1) + 'deg');
    el.style.setProperty('--mx', (x * 100).toFixed(0) + '%');
    el.style.setProperty('--my', (y * 100).toFixed(0) + '%');
  };
  root.addEventListener('pointermove', tilt);
  // a touch or click tilts the card toward the finger (it does not do anything else); touch lets go a moment later
  root.addEventListener('pointerdown', tilt);
  const settle = (e: Event): void => {
    const pe = e as PointerEvent;
    if (pe.pointerType === 'mouse') return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tilt]');
    if (el) setTimeout(() => { el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); }, 450);
  };
  root.addEventListener('pointerup', settle); root.addEventListener('pointercancel', settle);
  root.addEventListener('pointerout', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tilt]');
    if (el && !el.contains(e.relatedTarget as Node)) { el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); }
  });
}
