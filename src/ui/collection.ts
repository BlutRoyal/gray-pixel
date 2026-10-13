// Collection: everything pulled from packs, filtered by type and sorted by tier. Ballerz level up with shards (+1 to every stat per level).
// Shards also sell for Bucks (Recycle).
import { TIERS, TIER_NAME, ballerTier, ballersOfTier, catalog, sneakerRow, sneakerRowTier, tierRank, type Tier } from '../rules';
import { allCards, ccard } from '../casual/cards';
import { cardTier } from '../casual/packs';
import { LEVEL_MAX, SHARD_BUCKS, SHARD_YIELD, levelCost, levelOf, levelUp, maxCost } from '../casual/progress';
import { profile, save, sellShards } from './store';
import { liteOn } from './lite';
import { cardLevelInfo } from './deck';
import { ballerCardHTML, esc, playCardHTML, sneakerCardHTML } from './views';

type Filter = 'baller' | 'sneaker' | 'play';
let filter: Filter = 'baller';
let confirmSell = false;
/** Cards drawn so far: a full collection is thousands of cards, so the grid grows a page at a time. */
let shown = 0;
const pageSize = (): number => (liteOn() ? 24 : 60);
let onChange: () => void = () => {};
export function initCollection(changed: () => void): void { onChange = changed; }

export function tierOf(key: string): Tier {
  const [k, id] = key.split(':');
  if (k === 'b') return ballerTier(+id);
  if (k === 's') return sneakerRowTier(sneakerRow(+id)!);
  return cardTier(ccard(id)!);
}
const label = (f: Filter) => (f === 'baller' ? 'Ballerz' : f === 'sneaker' ? 'Sneakerz' : 'Play cards');
function levelBox(id: number): string {
  const P = profile(), lv = levelOf(P, id), t = ballerTier(id), cost = levelCost(t, lv);
  const pips = Array.from({ length: LEVEL_MAX }, (_x, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
  if (!cost) return `<div class="lvbox"><span class="pips" aria-hidden="true">${pips}</span><b>Level ${lv} · MAX</b></div>`;
  const pct = Math.min(100, Math.round((P.shards / cost) * 100));
  return `<div class="lvbox"><span class="pips" aria-hidden="true">${pips}</span><b>Level ${lv}</b>
    <span class="shbar" title="${P.shards} of ${cost} shards"><i style="width:${pct}%"></i></span><small class="dim">${Math.min(P.shards, cost)} / ${cost} shards</small>
    <button class="btn sm${P.shards >= cost ? ' go' : ''}" data-a="levelup" data-v="${id}" ${P.shards >= cost ? '' : 'disabled'}>Level up (${cost})</button></div>`;
}
export function collectionHTML(): string {
  const P = profile();
  const keys = Object.keys(P.cards).filter((k) => k[0] === filter[0] && (k[0] !== 'p' || ccard(k.slice(2))) && (k[0] !== 's' || sneakerRow(+k.slice(2))));
  keys.sort((a, b) => tierRank(tierOf(b)) - tierRank(tierOf(a)) || (filter === 'baller' ? levelOf(P, +b.slice(2)) - levelOf(P, +a.slice(2)) : 0) || P.cards[b].n - P.cards[a].n);
  const total = filter === 'baller' ? TIERS.reduce((a, t) => a + ballersOfTier(t).length, 0) : filter === 'sneaker' ? catalog().S.length : allCards().length;
  const byTier = TIERS.map((t) => `<span class="odd t-${t}">${TIER_NAME[t]} ${keys.filter((k) => tierOf(k) === t).length}</span>`).join('');
  if (!shown) shown = pageSize();
  const part = keys.slice(0, shown);
  const cards = part.map((k) => {
    const o = P.cards[k], id = k.slice(2), opt = { holo: o.holo > 0, count: o.n };
    if (filter === 'baller') return `<div class="cwrap">${ballerCardHTML(+id, { ...opt, count: 1, level: levelOf(P, +id) })}${levelBox(+id)}</div>`;
    if (filter === 'sneaker') return sneakerCardHTML(+id, { ...opt, count: 1 });
    const cc = ccard(id)!, L = cardLevelInfo(cc);
    return `<div class="cwrap">${playCardHTML(id, opt)}<div class="lvbox clv"><b>${esc(L.text.split(' · ')[0])}</b><span class="shbar" title="${esc(L.text)}"><i style="width:${L.pct}%"></i></span><small class="dim">${L.lv >= 5 ? 'Max level' : esc(L.text.split(' · ')[1] || '')} · +${(L.lv - 1) * (cc.rarity === 'basic' ? 1 : 2)}% effect</small></div></div>`;
  }).join('');
  const sellable = Math.floor(P.shards * SHARD_BUCKS);
  return `<section class="panel">
    <div class="row between"><h2 class="h">Collection</h2><span class="dim small">${keys.length} / ${total.toLocaleString('en')} unique</span></div>
    <div class="chips-row">${(['baller', 'sneaker', 'play'] as Filter[]).map((f) => `<button class="chipbtn${filter === f ? ' on' : ''}" data-a="cfilter" data-v="${f}">${label(f)}</button>`).join('')}</div>
    <div class="odds">${byTier}</div>
  </section>
  <section class="panel shardbox">
    <div class="row between"><span><b class="shard-n">${P.shards}</b> shards</span>
      <button class="btn${confirmSell ? ' warn' : ''}" data-a="sellshards" ${sellable ? '' : 'disabled'}>${confirmSell ? `Confirm: sell ${P.shards} shards for ${sellable} Bucks` : `Recycle shards for Bucks (${sellable})`}</button></div>
    <details class="shard-how"><summary class="dim small">How shards work</summary><p class="dim small">A duplicate Baller or Sneaker turns into shards: ${TIERS.map((t) => `${TIER_NAME[t]} ${SHARD_YIELD[t]}`).join(', ')}. Spend shards to level a Baller from 1 to ${LEVEL_MAX}: +1 to every stat per level (playing, skills and all). Maxing one costs ${TIERS.map((t) => `${maxCost(t)} (${TIER_NAME[t]})`).join(', ')}. Games and the daily bonus pay shards too. Recycled, a shard is worth ${SHARD_BUCKS} Bucks. A duplicate Play card gives shards to THAT card only: 5 levels, +2% card effect per level (+1% for Basic).</p></details>
  </section>
  ${keys.length ? `<div class="card-grid${filter === 'baller' ? ' lv' : ''}">${cards}</div>${keys.length > part.length ? `<div class="row center"><button class="btn go" data-a="cmore">Show ${Math.min(pageSize(), keys.length - part.length)} more (${part.length} of ${keys.length})</button></div>` : ''}` : `<section class="panel empty"><p>No ${label(filter)} yet.</p><button class="btn go" data-a="tab" data-v="packs">Open a pack</button></section>`}
  <p class="dim small">Your squad is picked on the Play tab. Your deck is built on the Deck tab (or automatically, when you leave it empty).</p>`;
}
export function collectionAct(a: string, v: string | undefined): boolean {
  if (a === 'cmore') { shown += pageSize(); onChange(); return true; }
  if (a === 'cfilter') { filter = v as Filter; confirmSell = false; shown = 0; onChange(); return true; }
  if (a === 'levelup') { const id = +v!; if (levelUp(profile(), id, ballerTier(id))) save(); onChange(); return true; }
  if (a === 'sellshards') {
    if (!confirmSell) { confirmSell = true; onChange(); return true; }
    sellShards(profile().shards);
    confirmSell = false;
    onChange();
    return true;
  }
  return false;
}
