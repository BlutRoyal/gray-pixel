// The BACK of a card, shown by flipping the close-up (inspect.ts). The front stays clean (name, tier and the game numbers); here is everything else:
// for a Baller the original NFT stats next to the game values built from them, skill / special, level and shards, Sneaker and lore;
// for a Sneaker its layers and passive; for a Play card the full rules text. Built from the data attributes of the front (data-ck, data-lv).
import { TUNING } from '../casual/tuning';
import { TIER_NAME, ballerTier, catalog, sneakerRow, sneakerRowTier, type Tier } from '../rules';
import { RARITY_NAME, ccard, classLabel, effectTag, whenLabel } from '../casual/cards';
import { cBaller } from '../casual/engine';
import { ENH_TEXT, POS_NAME, shoeOf } from '../casual/skills';
import { SP_HOLO_TEXT, SP_KINDS, SP_WHEN_TEXT, specialText } from '../casual/specials';
import { LEVEL_MAX, cardLevelOf, cardNeed, cardShardsOf, levelCost, levelOf } from '../casual/progress';
import { cardTier } from '../casual/packs';
import { BACK_LORE } from './lore';
import { profile } from './store';
import { ballerFromId, esc, wrap } from './views';

const cell = (l: string, v: string | number, cls = ''): string => `<div class="bk-c ${cls}"><span>${l}</span><b>${v}</b></div>`;
const pips = (lv: number): string => `<span class="pips" aria-hidden="true">${Array.from({ length: LEVEL_MAX }, (_x, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</span>`;
const bar = (pct: number): string => `<span class="shbar"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></span>`;
const sec = (h: string, inner: string, cls = ''): string => `<div class="bk-sec ${cls}"><h4>${h}</h4>${inner}</div>`;
const shoeOn = (id: number): number | null => { const v = profile().shoes?.[id]; return v != null ? +v : null; };

function ballerBack(id: number, lv: number, holo: boolean): { tier: Tier; inner: string; label: string } {
  const c = ballerFromId(id), tier = ballerTier(id), P = profile();
  const sid = shoeOn(id), r = cBaller(id, sid, lv, holo), sr = sid != null ? sneakerRow(sid) : null;
  const up = lv - 1;
  const shards = P.shards, cost = levelCost(tier, lv), lvl = levelOf(P, id);
  const sp = r.special;
  const skill = r.skill.key === 'none' ? '' : `<div class="bk-t"><b>${esc(r.skill.name)}.</b> ${esc(r.skill.text)}</div>`;
  const special = sp ? `<div class="bk-t bk-sp"><b>Special: ${esc(sp.name)}.</b> ${esc(specialText(sp, holo))} <i class="ic-b">Iconic: +${TUNING.iconicBoost}% all shots.</i> <span class="dim">${esc(SP_WHEN_TEXT[SP_KINDS[sp.type].when])}. Once per game.${holo ? ' ' + esc(SP_HOLO_TEXT()) : ''}</span></div>` : '';
  const lore = sp ? sp.flavor : BACK_LORE.baller[id % BACK_LORE.baller.length];
  const inner = `
    <div class="ctop"><span class="cls-tag">BACK</span><span class="tier-tag">${TIER_NAME[tier]} · ${POS_NAME[r.pos].toUpperCase()}</span></div>
    <div class="cname"><b>Baller ${esc(c.name)}</b><small>${esc(c.team)}</small></div>
    ${sec('Original NFT stats', `<div class="bk-row5">${cell('DNK', c.st.D)}${cell('SHT', c.st.S)}${cell('PLY', c.st.P)}${cell('DEF', c.st.F)}${cell('JMP', sr ? sr[1] : '–', sr ? '' : 'na')}</div>`)}
    ${sec(`Game values${up ? ` (Lv ${lv}: +${up} each)` : ''}`, `<div class="bk-row4">${cell('RIM', r.rim, 'g')}${cell('MID', r.mid, 'g')}${cell('3PT', r.three, 'g')}${cell('DEF', r.def, 'g')}</div><small class="bk-sm">Rim = DNK · Mid = 60% SHT + 40% PLY · 3PT = SHT</small>`)}
    ${skill}${special}
    <div class="bk-row"><em>Level</em>${pips(lvl)}<small class="bk-sm">${lvl >= LEVEL_MAX ? 'Lv 5 MAX' : `Lv ${lvl} · ${Math.min(shards, cost)} / ${cost} shards`}</small>${lvl >= LEVEL_MAX ? '' : bar(Math.round((shards / cost) * 100))}</div>
    <div class="bk-row"><em>Sneaker</em><span class="bk-sm">${r.shoe ? `#${r.sneakerId} · +${r.shoe.bonus}% every shot, Rim +${r.shoe.jumpRim}%` : 'None equipped'}</span></div>
    <div class="bk-t bk-lore"><i>${esc(lore)}</i></div>`;
  return { tier, inner, label: `Back of Baller ${c.name}` };
}

function sneakerBack(id: number): { tier: Tier; inner: string; label: string } {
  const s = sneakerRow(id)!, D = catalog(), tier = sneakerRowTier(s), sh = shoeOf(s)!;
  const owner = Object.keys(profile().shoes || {}).find((k) => +profile().shoes[k] === id);
  const rows = [
    `<b>Rarity layer</b> ${esc(D.rar[s[3]])}: +${sh.bonus}% on every shot.`,
    `<b>Jump ${sh.jump}</b>: Rim shots get +${sh.jumpRim}%.`,
    `<b>Putback</b>: ${sh.putback}% chance on a missed Rim shot.`,
    sh.enh ? `<b>Enhancement</b> ${esc(ENH_TEXT[sh.enh])}` : '<b>Enhancement</b> none.',
  ];
  const inner = `
    <div class="ctop"><span class="cls-tag">BACK</span><span class="tier-tag">${esc(D.rar[s[3]])}</span></div>
    <div class="cname"><b>Sneaker #${s[0]}</b><small>${esc(D.des[s[4]] || 'Sneaker')} · drip ${s[5]}</small></div>
    ${sec('Details', `<div class="bk-row4">${cell('SHOTS', '+' + sh.bonus + '%', 'g')}${cell('JUMP', sh.jump, 'g')}${cell('RIM', '+' + sh.jumpRim + '%', 'g')}${cell('PUT', sh.putback + '%', 'g')}</div>`)}
    ${rows.map((r) => `<div class="bk-t">${r}</div>`).join('')}
    <div class="bk-row"><em>Worn by</em><span class="bk-sm">${owner ? 'Baller #' + owner : 'nobody yet'}</span></div>
    <div class="bk-t bk-lore"><i>${esc(BACK_LORE.sneaker[id % BACK_LORE.sneaker.length])}</i></div>`;
  return { tier, inner, label: `Back of Sneaker ${s[0]}` };
}

const WHEN_LONG: Record<string, string> = { off: 'Play it on your offense, before GO.', def: 'Play it on defense, before Lock in.', any: 'Play it any time before the shot.' };
function playBack(key: string): { tier: Tier; inner: string; label: string } {
  const cc = ccard(key)!, tier = cardTier(cc), P = profile();
  const sh = cardShardsOf(P, cc.k), lv = cardLevelOf(P, cc.k, tier), tag = effectTag(cc);
  const lo = cardNeed(tier, lv), hi = cardNeed(tier, lv + 1);
  const when = cc.fx.trap ? `A trap: set it face down, it springs by itself. (${whenLabel(cc)})` : WHEN_LONG[cc.when] || whenLabel(cc);
  const inner = `
    <div class="ctop"><span class="cls-tag">BACK</span><span class="tier-tag">${esc(RARITY_NAME[cc.rarity])}</span></div>
    <div class="cname"><b>${esc(cc.name)}</b><small>${esc(classLabel(cc))} · cost ${cc.fx.allIn ? 'ALL' : cc.cost}</small></div>
    ${sec('Effect', `<div class="bk-big"><b>${esc(tag.big)}</b> <small>${esc(tag.small)}</small></div><div class="bk-t">${esc(cc.text)}</div>`)}
    <div class="bk-t"><b>When:</b> ${esc(when)}</div>
    <div class="bk-t"><b>Cost:</b> ${cc.fx.allIn ? 'all your Momentum' : cc.cost + ' Momentum'}.</div>
    <div class="bk-row"><em>Level</em>${pips(lv)}<small class="bk-sm">${lv >= LEVEL_MAX ? 'Lv 5 MAX' : `Lv ${lv} · ${sh - lo} / ${hi - lo} shards`}</small>${lv >= LEVEL_MAX ? '' : bar(Math.round(((sh - lo) / Math.max(1, hi - lo)) * 100))}</div>
    <div class="bk-t bk-lore"><i>${esc(cc.flavor)}</i></div>`;
  return { tier, inner, label: `Back of ${cc.name}` };
}

/** The back of the card whose front is `front` (the outerHTML of its card element). */
export function backFromFront(front: string): string {
  const m = /data-ck="([bsp]):([^"]+)"/.exec(front);
  if (!m) return '';
  const lv = +(/data-lv="(\d)"/.exec(front)?.[1] ?? 1), holo = /class="card [^"]*\bholo\b/.test(front);
  try {
    const b = m[1] === 'b' ? ballerBack(+m[2], lv, holo) : m[1] === 's' ? sneakerBack(+m[2]) : playBack(m[2]);
    return wrap('bback', b.tier, { holo }, b.inner, b.label).replace('data-tilt', 'data-tilt data-back="1"');
  } catch { return ''; }
}
