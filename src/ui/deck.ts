// Deck builder: put the Play cards you own into a 15 to 20 card deck for your coach. The rules are the same as validateDeck:
// at most 2 copies (1 Iconic), 4 Traps, 2 hard counters, only neutral cards and your coach's class. Basic starter cards are always available.
import { CLASSES, CLS_KEYS, TIER_NAME, type ClassKey } from '../rules';
import { DECK_MAX, DECK_MIN, MAX_COPIES, MAX_HARD_IN_DECK, MAX_TRAPS_IN_DECK, buildDeck, canAdd, validateDeck } from '../casual/engine';
import { allCards, ccard, classLabel, effectTag, isHard, isTrap, whenLabel, type CCard } from '../casual/cards';
import { cardTier } from '../casual/packs';
import { LEVEL_MAX, cardLevelOf, cardNeed, cardShardsOf } from '../casual/progress';
import { profile, save } from './store';
import { esc, playCardHTML } from './views';
import { openInspect } from './inspect';

type Sort = 'cost' | 'rarity' | 'name';
let sortBy: Sort = 'rarity';
let showAll = false;
let onChange: () => void = () => {};
export function initDeck(changed: () => void): void { onChange = changed; }

/** Copies of each Play card the player owns (packs, plus dev unlocks). */
export function ownedPlay(): Record<string, number> {
  const P = profile(), o: Record<string, number> = {};
  for (const [k, c] of Object.entries(P.cards)) if (k.startsWith('p:')) o[k.slice(2)] = c.n;
  for (const [k, n] of Object.entries(P.v2 || {})) o[k] = Math.max(o[k] || 0, n);
  return o;
}
const STARTER_FREE = (c: CCard): boolean => c.rarity === 'basic';
const copiesOwned = (c: CCard): number => (STARTER_FREE(c) ? MAX_COPIES : ownedPlay()[c.k] || 0);
const toCards = (keys: string[]): CCard[] => keys.map((k) => ccard(k)).filter((c): c is CCard => !!c);
/** The deck for a coach: the hand-built one when it is valid and every card is owned, else an automatic one. */
function validSaved(coach: ClassKey): CCard[] | null {
  const P = profile(), saved = toCards(P.decks[coach] || []);
  if (saved.length && !validateDeck(saved).length && saved.every((c) => !c.cls || c.cls === coach)) {
    const need = new Map<string, number>();
    saved.forEach((c) => need.set(c.k, (need.get(c.k) || 0) + 1));
    if ([...need].every(([k, n]) => n <= copiesOwned(ccard(k)!))) return saved;
  }
  return null;
}
export function myDeck(coach: ClassKey): CCard[] { return validSaved(coach) ?? buildDeck(ownedPlay(), coach); }
/** True when games for this coach would use the automatic deck (no valid hand-built deck). */
export const deckIsAuto = (coach: ClassKey): boolean => !validSaved(coach);
/** Spell level of every Play card the player has shards for (card key -> 1..5), handed to newSide. */
export function cardLevels(): Record<string, number> {
  const o: Record<string, number> = {};
  for (const c of allCards()) { const l = cardLevelOf(profile(), c.k, cardTier(c)); if (l > 1) o[c.k] = l; }
  return o;
}
const current = (coach: ClassKey): CCard[] => toCards(profile().decks[coach] || []);
const setDeck = (coach: ClassKey, d: CCard[]): void => { profile().decks[coach] = d.map((c) => c.k); save(); };

const RANK: Record<string, number> = { iconic: 5, legendary: 4, epic: 3, common: 2, basic: 1 };
function pool(coach: ClassKey): CCard[] {
  const ok = allCards().filter((c) => (!c.cls || c.cls === coach) && (showAll || copiesOwned(c) > 0 || STARTER_FREE(c)));
  return ok.sort((a, b) => (sortBy === 'cost' ? a.cost - b.cost : sortBy === 'name' ? 0 : RANK[b.rarity] - RANK[a.rarity]) || a.cost - b.cost || a.name.localeCompare(b.name));
}
/** "Lv 2 · 14 / 18 shards to Lv 3" for one Play card (Basic cards level too, from their duplicates). */
export function cardLevelInfo(c: CCard): { lv: number; text: string; pct: number } {
  const P = profile(), t = cardTier(c), sh = cardShardsOf(P, c.k), lv = cardLevelOf(P, c.k, t);
  if (lv >= LEVEL_MAX) return { lv, text: `Lv ${lv} MAX`, pct: 100 };
  const lo = cardNeed(t, lv), hi = cardNeed(t, lv + 1);
  return { lv, text: `Lv ${lv} · ${sh - lo} / ${hi - lo} shards`, pct: Math.min(100, Math.round(((sh - lo) / (hi - lo)) * 100)) };
}
function line(c: CCard, right: string, cls = ''): string {
  const t = cardTier(c), L = cardLevelInfo(c), tag = effectTag(c);
  return `<div class="dk-row t-${t} ${cls}"><span class="dk-cost" title="Momentum cost">${c.fx.allIn ? 'ALL' : c.cost}</span>
    <span class="dk-name"><b>${esc(c.name)} <i class="dk-fx">${esc(tag.big)} ${esc(tag.small)}</i></b><small class="dim">${esc(TIER_NAME[t])} · ${esc(classLabel(c))} · ${esc(whenLabel(c))}${isHard(c) ? ' · hard counter' : ''}</small><small class="dk-text">${esc(c.text)}</small><button class="chipbtn dk-look" data-a="dklook" data-v="${c.k}" aria-label="Look at ${esc(c.name)} up close">Look</button>
    <span class="dk-lv"><span class="shbar" title="${esc(L.text)}"><i style="width:${L.pct}%"></i></span><small class="dim">${esc(L.text)}</small></span></span>${right}</div>`;
}
/** One flat tile of the deck strip. Tap removes it. */
function tile(c: CCard, auto: boolean): string {
  const t = cardTier(c), tag = effectTag(c), L = cardLevelInfo(c);
  return `<button class="dk-tile t-${t}" data-a="dkrm" data-v="${c.k}" aria-label="Remove ${esc(c.name)} from the deck" title="${esc(c.name)}: ${esc(c.text)} (tap to remove)"><span class="dk-cost">${c.fx.allIn ? 'ALL' : c.cost}</span><b class="dk-big">${esc(tag.big)}</b><small>${esc(tag.small)}</small><span class="dk-nm">${esc(c.name)}</span>${L.lv > 1 ? `<i class="dk-l">L${L.lv}</i>` : ''}${auto ? '<i class="dk-auto">auto</i>' : ''}</button>`;
}
export function deckHTML(): string {
  const P = profile(), coach = P.coach as ClassKey, mine = current(coach);
  const bad = mine.length ? validateDeck(mine) : [];
  const auto = !mine.length || bad.length;
  const using = myDeck(coach);
  const base = mine.length ? mine : using;
  const inDeck = new Map<string, number>();
  base.forEach((c) => inDeck.set(c.k, (inDeck.get(c.k) || 0) + 1));
  const sortedMine = mine.slice().sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  const shown = mine.length ? sortedMine : using.slice().sort((x, y) => x.cost - y.cost || x.name.localeCompare(y.name));
  const ownedUnique = allCards().filter((c) => (!c.cls || c.cls === coach) && !STARTER_FREE(c) && copiesOwned(c) > 0).length;
  const ownedCopies = allCards().filter((c) => (!c.cls || c.cls === coach) && !STARTER_FREE(c)).reduce((a, c) => a + copiesOwned(c), 0);
  const cnt = shown.length;
  return `<section class="panel dk-top">
    <div class="row between"><h2 class="h">Deck</h2><span class="dim small">Coach ${esc(CLASSES[coach].hero)} · ${esc(CLASSES[coach].name)}</span></div>
    <div class="chips-row">${CLS_KEYS.map((k) => `<button class="chipbtn${coach === k ? ' on' : ''}" data-a="coach" data-v="${k}">${esc(CLASSES[k].hero)}</button>`).join('')}</div>
    <div class="row between dk-bar"><b class="dk-count ${!auto && mine.length >= DECK_MIN ? 'dk-ok' : 'dk-bad'}">Deck ${cnt}/${DECK_MAX}</b><span class="dim small">${shown.filter(isTrap).length} Traps · ${shown.filter(isHard).length} hard</span>
      <span class="dk-btns"><button class="btn sm go" data-a="dkauto">Auto-build</button> <button class="btn sm ghost" data-a="dkclear" ${mine.length ? '' : 'disabled'}>Clear</button></span></div>
    ${auto ? `<div class="dk-note"><b>AUTO DECK</b> ${mine.length ? `Your deck is not valid yet, so games use an automatic one (${using.length} cards) instead of the ${mine.length} below.` : `You have not built a deck, so games use this automatic one: your best cards plus starters.`} Tap Auto-build to keep it and edit it, or tap a card to start editing.</div>` : '<p class="dim small dk-use">Games use this deck. Tap a card to take it out.</p>'}
    ${bad.map((b) => `<p class="dk-bad small">${esc(b)}</p>`).join('')}
    <div class="dk-grid">${shown.map((c) => tile(c, !mine.length)).join('') || '<p class="dim small">Empty. Add cards below.</p>'}</div>
    <p class="dim small">${DECK_MIN} to ${DECK_MAX} cards, at most ${MAX_COPIES} copies of a card (1 of an Iconic), ${MAX_TRAPS_IN_DECK} Traps, ${MAX_HARD_IN_DECK} hard counters. Neutral cards and ${esc(CLASSES[coach].name)} cards only.</p>
  </section>
  <section class="panel">
    <div class="row between"><h3 class="h3">Your cards: ${ownedUnique} <span class="dim small">(${ownedCopies} copies, plus the Basic starters)</span></h3></div>
    <div class="row between"><span class="dim small">Sort: ${(['rarity', 'cost', 'name'] as Sort[]).map((s) => `<button class="chipbtn${sortBy === s ? ' on' : ''}" data-a="dksort" data-v="${s}">${s}</button>`).join('')}</span> <button class="chipbtn${showAll ? ' on' : ''}" data-a="dkall">${showAll ? 'Showing all cards' : 'Owned only'}</button></div>
    <p class="dim small">Duplicates of a card become shards for that card: ${LEVEL_MAX} levels, each +2% card effect (+1% for Basic).</p>
    <div class="dk-list">${pool(coach).map((c) => {
      const n = inDeck.get(c.k) || 0, own = copiesOwned(c), can = canAdd(base, c) && n < own;
      return line(c, `<span class="dk-add"><small class="dim">${own ? `in deck ${n} · own ${c.rarity === 'basic' ? 'any' : own}` : 'not owned'}</small><button class="btn sm${can ? '' : ' ghost'}" data-a="dkadd" data-v="${c.k}" ${can ? '' : 'disabled'}>Add</button></span>`, own ? '' : 'dim');
    }).join('')}</div>
  </section>`;
}
export function deckAct(a: string, v: string | undefined): boolean {
  const P = profile(), coach = P.coach as ClassKey;
  switch (a) {
    case 'dkadd': { const c = ccard(v!); let mine = current(coach); if (!mine.length) mine = myDeck(coach).slice(); if (c && canAdd(mine, c) && mine.filter((d) => d.k === c.k).length < copiesOwned(c)) { setDeck(coach, [...mine, c]); onChange(); } return true; }
    case 'dkrm': { let mine = current(coach); if (!mine.length) mine = myDeck(coach).slice(); const i = mine.findIndex((c) => c.k === v); if (i >= 0) { mine.splice(i, 1); setDeck(coach, mine); onChange(); } return true; }
    case 'dklook': { const list = pool(coach); openInspect(list.map((c) => ({ html: playCardHTML(c.k, {}), info: `${TIER_NAME[cardTier(c)]} · ${cardLevelInfo(c).text}` })), Math.max(0, list.findIndex((c) => c.k === v))); return true; }
    case 'dkclear': setDeck(coach, []); onChange(); return true;
    case 'dkauto': setDeck(coach, buildDeck(ownedPlay(), coach)); onChange(); return true;
    case 'dksort': sortBy = v as Sort; onChange(); return true;
    case 'dkall': showAll = !showAll; onChange(); return true;
  }
  return false;
}
