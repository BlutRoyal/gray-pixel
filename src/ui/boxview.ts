// Post-game box score view: compact, mobile first, with bars next to the numbers. Numbers come from buildBox (casual/box.ts).
import { buildBox, pct, type BallerBox, type BoxScore, type TeamBox } from '../casual/box';
import type { CGame } from '../casual/engine';
import { ZONES, ZONE_NAME } from '../casual/skills';
import { esc } from './views';

const bar = (v: number, cls = ''): string => `<i class="bx-bar ${cls}"><b style="width:${Math.max(0, Math.min(100, v))}%"></b></i>`;
const zline = (t: TeamBox): string => {
  const tot = t.att || 1;
  return `<div class="bx-zone" role="img" aria-label="Shot split">${ZONES.map((z) => `<span class="z-${z}" style="flex:${Math.max(0.0001, t.zones[z].att / tot)}" title="${ZONE_NAME[z]} ${t.zones[z].made}/${t.zones[z].att}">${t.zones[z].att ? `${ZONE_NAME[z]} ${t.zones[z].made}/${t.zones[z].att}` : ''}</span>`).join('')}</div>`;
};
const flags = (b: BallerBox): string => [
  b.special ? `<em class="bx-sp${b.specialN != null ? ' used' : ''}" title="${esc(b.special)}">${b.specialN != null ? 'SP used' : 'SP kept'}</em>` : '',
  b.subOut || b.subIn ? `<em>sub ${b.subIn ? 'in' : 'out'}</em>` : '',
  b.fatPeak >= 4 ? `<em class="tired" title="Peak tiredness">-${b.fatPeak}%</em>` : '',
  b.doubled ? `<em>DT x${b.doubled}</em>` : '',
].join('');
function rowHTML(b: BallerBox, mvp: boolean): string {
  const zs = ZONES.map((z) => `<span class="zc z-${z}" title="${ZONE_NAME[z]}">${b.zones[z].made}/${b.zones[z].att}</span>`).join('');
  return `<tr class="${mvp ? 'mvp' : ''}"><th scope="row"><span class="bx-n">${esc(b.name)}${b.holo ? ' <small class="holo-t">HOLO</small>' : ''}${mvp ? ' <small class="mvp-t">MVP</small>' : ''}</span><span class="bx-fl">${flags(b)}</span></th>
    <td class="pts"><b>${b.pts}</b></td><td>${b.made}/${b.att}<small>${pct(b.made, b.att)}%</small></td><td class="zs">${zs}</td><td>${b.ast}</td><td>${b.stlCaused}/${b.stlSuffered}</td><td>${b.blkCaused}/${b.blkSuffered}</td></tr>`;
}
function teamHTML(box: BoxScore, s: 0 | 1, title: string): string {
  const t = box.teams[s], o = box.teams[(1 - s) as 0 | 1];
  const rows = box.ballers[s].filter((b) => b.att || b.ast || b.stlCaused || b.blkCaused || b.tov || b.subIn || b.specialN != null || b.pts).map((b) => rowHTML(b, box.mvp === b)).join('');
  const against = t.readsHit + t.readsMissed, theirShots = o.readsHit + o.readsMissed;
  return `<section class="bx-team side${s}"><h3>${esc(title)} <b>${t.pts}</b></h3>
    <div class="bx-wrap"><table class="bx"><thead><tr><th>Baller</th><th>PTS</th><th>FG</th><th>R / M / 3</th><th>AST</th><th title="Steals caused / suffered">STL</th><th title="Blocks caused / suffered">BLK</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="bx-tot"><div><span>FG</span><b>${t.made}/${t.att}</b> ${pct(t.made, t.att)}%${bar(pct(t.made, t.att), 'fg')}</div>${zline(t)}
      <ul class="bx-facts"><li><span>Turnovers</span><b>${t.tov}</b></li><li><span>Momentum</span><b>+${t.moGain} / -${t.moSpent}</b></li><li><span>Cards played</span><b>${t.cardsPlayed}</b></li><li><span>Traps set / fired</span><b>${t.trapsSet} / ${t.trapsFired}</b></li>
      <li><span>Shots read by their scheme</span><b>${t.readsHit}/${against}</b></li><li><span>Scheme guessed right</span><b>${t.guessed}/${theirShots}</b></li><li><span>And-ones</span><b>${t.andOnes}</b></li><li><span>GLITCHED shots</span><b>${t.glitched}</b></li>
      <li><span>Clutch</span><b>${t.clutchTaken ? `${t.clutchMade}/${t.clutchTaken}` : '-'}</b></li><li><span>Longest run</span><b>${t.longestRun} pts</b></li><li><span>Subs / specials</span><b>${t.subs} / ${t.specials}</b></li></ul>
      ${bar(pct(t.guessed, theirShots), 'rd')}
      ${t.schemes.length ? `<p class="bx-sch"><span>Schemes used</span> ${t.schemes.map((x) => `${esc(x.name)} x${x.n}`).join(' · ')}</p>` : ''}
      ${t.cards.length ? `<p class="bx-cards"><span>Cards</span> ${t.cards.map((c) => `<em>${esc(c.name)} ${c.worked}/${c.played}</em>`).join('')}</p>` : ''}
    </div></section>`;
}
/** Full box score (both teams) for the result sheet. */
export function boxHTML(g: CGame): string {
  const box = buildBox(g);
  const mv = box.mvp;
  return `<div class="bx-all"><p class="bx-mvp">${mv ? `MVP <b>${esc(mv.name)}</b> · ${mv.pts} pts, ${mv.made}/${mv.att} FG, ${mv.ast} ast` : 'No MVP'}</p>
    ${teamHTML(box, 0, 'You')}${teamHTML(box, 1, 'CPU')}<p class="dim small bx-note">STL and BLK read caused / suffered. R / M / 3 = Rim, Mid, Three makes/attempts. Cards show how often they worked.</p></div>`;
}
/** Short version for the tutorial wrap-up. */
export function boxShortHTML(g: CGame): string {
  const box = buildBox(g), a = box.teams[0], b = box.teams[1], mv = box.mvp;
  return `<div class="bx-short"><div><span>FG</span><b>${pct(a.made, a.att)}%</b>${bar(pct(a.made, a.att), 'fg')}<small>CPU ${pct(b.made, b.att)}%</small></div>
    <div><span>Shots</span><b>${ZONES.map((z) => `${a.zones[z].made}/${a.zones[z].att}`).join(' · ')}</b><small>Rim · Mid · Three</small></div>
    ${mv ? `<div><span>MVP</span><b>${esc(mv.name)}</b><small>${mv.pts} pts, ${mv.ast} ast</small></div>` : ''}</div>`;
}
