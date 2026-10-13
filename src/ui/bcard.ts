// Baller card for the game: portrait (real image, pixel avatar underneath), the pieces of a Baller a coach needs to decide
// (#, position, Rim / Mid / Three, DEF, skill, fatigue, level, Sneaker), the sub comparison arrows, and the tiny token badges.
import { TIER_NAME, type Tier } from '../rules';
import { FATIGUE, fatigueOf, type CBaller, type Zone } from '../casual/engine';
import { POS_NAME, ZONE_NAME, shoeText } from '../casual/skills';
import { avatar, teamHue } from './avatar';
import { ballerFromId, ballerImgUrl, esc } from './views';

/** Round portrait: a pixel avatar drawn from his traits sits under the real image, so a blocked image still shows a face. */
export function portrait(b: { id: number; team: string }, cls = ''): string {
  let bg = '';
  try { bg = `--av:url(${avatar(ballerFromId(b.id))});`; } catch { /* no canvas */ }
  return `<span class="pt ${cls}" style="--hue:${teamHue(b.team)};${bg}"><img src="${ballerImgUrl(b.id)}" data-fb="1" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>`;
}
export const posBadge = (b: CBaller): string => `<i class="pos pos-${b.pos}" title="${POS_NAME[b.pos]}">${b.pos}</i>`;
/** "R85 M71 3P73" mini row used on chips and tiles. `zone` highlights one value. */
export function miniStats(b: CBaller, zone?: Zone | null): string {
  const c = (z: Zone, l: string, v: number): string => `<span class="${zone === z ? 'hi' : ''}">${l}<b>${v}</b></span>`;
  return `<span class="ms3">${c('rim', 'R', b.rim)}${c('mid', 'M', b.mid)}${c('three', '3P', b.three)}</span>`;
}
/** Best offensive number after fatigue, and defense: the two things a sub changes. */
export const offOf = (b: CBaller): number => Math.max(b.rim, b.mid, b.three) - fatigueOf(b);
export const defOf = (b: CBaller): number => b.def;
/** Arrows comparing `inn` (the Baller who would come in) with `out` (who he replaces). Threshold 1 point. */
export function compareArrows(inn: CBaller, out: CBaller): string {
  const one = (label: string, d: number, title: string): string => {
    const v = Math.round(d * 10) / 10;
    const dir = v >= 1 ? 'up' : v <= -1 ? 'dn' : 'eq';
    return `<span class="cmp ${dir}" title="${esc(title)}"><em>${label}</em>${dir === 'up' ? '▲' : dir === 'dn' ? '▼' : '='}${dir === 'eq' ? '' : Math.abs(Math.round(v))}</span>`;
  };
  const od = offOf(inn) - offOf(out), dd = defOf(inn) - defOf(out);
  return one('ATK', od, od >= 1 ? 'Better on offense' : od <= -1 ? 'Worse on offense' : 'About the same on offense')
    + one('DEF', dd, dd >= 1 ? 'Better on defense' : dd <= -1 ? 'Worse on defense' : 'About the same on defense');
}
/** Fatigue as a bar plus words. */
export function fatigueBar(b: CBaller): string {
  const f = fatigueOf(b), span = FATIGUE.start - 1 + Math.ceil(FATIGUE.cap / FATIGUE.step);
  const pct = Math.min(100, Math.round((b.run / span) * 100));
  const word = f > 0 ? `Tired −${f}% on his shots` : b.run >= FATIGUE.start - 2 ? 'Getting tired soon' : b.run === 0 ? 'Fresh' : 'Fine';
  return `<span class="fbar${f > 0 ? ' tired' : ''}" title="${b.run} attacks on court"><i style="width:${pct}%"></i></span><small class="${f > 0 ? 'bad' : 'dim'}">${word} · ${b.run} on court</small>`;
}
export interface CardCtx {
  /** Where he stands: 'court' or 'bench', and whose. */
  where: 'court' | 'bench';
  mine: boolean;
  /** Chances for his three zones when he is the player's shooter-to-be: [open, if read] per zone. */
  chances?: Record<Zone, [number, number]>;
  zone?: Zone | null;
  /** Can the player make him the shooter right now? Adds the button. */
  canShoot?: boolean;
  isShooter?: boolean;
  /** Bench Baller: show how he compares with this court Baller. */
  versus?: CBaller;
}
const statCell = (l: string, v: number, hi = false): string => `<div class="bs${hi ? ' hi' : ''}"><span>${l}</span><b>${v}</b></div>`;
/** The full Baller card as a modal. `data-a="noop"` keeps clicks on the card from closing it. */
export function ballerCardHTML(b: CBaller, c: CardCtx): string {
  let look = '';
  try { look = ballerFromId(b.id).body; } catch { /* no catalog */ }
  const f = fatigueOf(b);
  const tier = b.tier as Tier;
  const ch = c.chances
    ? `<div class="bc-ch"><span class="dim small">Shot chance${c.zone ? '' : ' (open look)'}</span>${(['rim', 'mid', 'three'] as Zone[]).map((z) => `<span class="${c.zone === z ? 'on' : ''}"><em>${ZONE_NAME[z]}</em><b>${c.chances![z][0]}%</b><small>${c.chances![z][1]}% if read</small></span>`).join('')}</div>`
    : '';
  const cool = b.hold > 0 ? `<span class="chip">Cooling: ${b.hold} more attack${b.hold > 1 ? 's' : ''} before he shoots</span>` : '<span class="chip good">Can shoot</span>';
  const cd = b.cd > 0 ? `<span class="chip">Just subbed: ${b.cd} possession${b.cd > 1 ? 's' : ''}</span>` : '';
  return `<div class="overlay sheetwrap" id="ballerCard" data-a="bcclose"><div class="bc t-${tier} ${c.mine ? 'mine' : 'theirs'}" data-a="noop" role="dialog" aria-modal="true" aria-label="Baller ${esc(b.name)}">
    <button class="bc-x" data-a="bcclose" aria-label="Close">✕</button>
    <div class="bc-head">${portrait(b, 'xl')}<div class="bc-id"><b class="bc-num">${esc(b.name)}</b>
      <span class="bc-sub">${posBadge(b)} ${POS_NAME[b.pos]} · ${TIER_NAME[tier] || tier}${b.level > 1 ? ` · Lv ${b.level}` : ' · Lv 1'}</span>
      <small class="dim">${esc(b.team)}${look ? ' · ' + esc(look) : ''}${c.mine ? '' : ' · opponent'}</small></div></div>
    <div class="bc-stats">${statCell('RIM', b.rim)}${statCell('MID', b.mid)}${statCell('THREE', b.three)}${statCell('DEF', b.def)}${statCell('PLY', b.ply)}</div>
    ${ch}
    <div class="bc-skill"><b>${esc(b.skill.name)}</b><span>${esc(b.skill.text)}</span></div>
    <div class="bc-rows">
      <div><em>Fatigue</em>${fatigueBar(b)}</div>
      <div><em>Level</em><span class="pips" aria-hidden="true">${Array.from({ length: 5 }, (_x, i) => `<i class="${i < b.level ? 'on' : ''}"></i>`).join('')}</span><small class="dim">Lv ${b.level} of 5${b.level > 1 ? ` · +${b.level - 1} to every stat` : ''}</small></div>
      <div><em>Sneaker</em><span>${b.shoe ? `#${b.sneakerId} · ${esc(shoeText(b.shoe))}` : '<span class="dim">None equipped</span>'}</span></div>
    </div>
    ${c.versus ? `<div class="bc-vs"><em>Instead of ${esc(c.versus.name)}</em>${compareArrows(b, c.versus)}</div>` : ''}
    <div class="tags">${c.where === 'bench' ? '<span class="chip">Bench</span>' : ''}${cool}${cd}${f >= 10 ? '<span class="chip bad">Needs rest</span>' : ''}</div>
    ${c.canShoot ? `<div class="row end"><button class="btn go" data-a="bcshoot" data-v="${c.isShooter ? '' : 'pick'}">${c.isShooter ? 'He has the ball' : 'Give him the shot'}</button></div>` : ''}
  </div></div>`;
}
