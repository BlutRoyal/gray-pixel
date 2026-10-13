// Pack shop and the pack-opening sequence: rip the wrapper, then charge and flip each card.
import { TIERS, TIER_NAME, rnd, seedRng, tierRank, type Tier } from '../rules';
import { BALLER_PACKS, PACKS, SNEAKER_PACKS, isBox, openPack, oddsPct, packChance, packDef, type Odds, type PackDef, type Pull } from '../casual/packs';
import { SHARD_YIELD } from '../casual/progress';
import { addPull, claimDailyPack, dailyPackReady, msToNextDay, profile, save, setMusic, spend } from './store';
import { sfx } from './sfx';
import { setMusicOverride } from './music';
import { ballerTier } from '../rules';
import { liteOn } from './lite';
import { PACK_LINES } from './lore';
import { strayHTML } from './wordmark';
import { ballerCardHTML, bindTilt, esc, playCardHTML, reduced, sneakerCardHTML } from './views';
import { levelOf } from '../casual/progress';

let onChange: () => void = () => {};
export function initPacks(changed: () => void): void {
  onChange = changed;
  document.addEventListener('keydown', (e) => {
    if (!OP || OP.mode !== 'card' || (e.target as HTMLElement | null)?.closest('button')) return;
    // keyboard: the same two steps as the mouse. Flip the face-down card, then NEXT CARD.
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); if (OP.step === 'wait') flip(); else if (OP.step === 'shown') next(); }
  });
  window.setInterval(() => { const el = document.getElementById('dailyT'); if (el) el.textContent = dailyTimer(); }, 30000);
}
/** Time until the free daily pack unlocks again (local midnight), e.g. "7h 12m". */
export function dailyTimer(): string { const m = Math.ceil(msToNextDay() / 60000); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; }
/** The free daily Basic Pack: claim button when it is ready, otherwise the countdown to the next one. */
export function dailyHTML(compact = false): string {
  const ready = dailyPackReady();
  return `<div class="daily${ready ? ' ready' : ''}${compact ? ' compact' : ''}"><span class="daily-t"><b>Free daily Basic Pack</b><small class="dim">${ready ? 'Ready. Resets at local midnight.' : `Claimed today. Next one in <span id="dailyT">${dailyTimer()}</span>.`}</small></span>
    <button class="btn${ready ? ' go' : ''}" data-a="claimdaily" ${ready ? '' : 'disabled'}>${ready ? 'Claim free pack' : 'Claimed'}</button></div>`;
}

const pctTxt = (n: number) => (n >= 10 ? n.toFixed(0) : n >= 1 ? n.toFixed(1) : n >= 0.1 ? n.toFixed(2) : n.toFixed(3)) + '%';
function oddsLine(odds: Odds): string {
  const p = oddsPct(odds);
  return TIERS.filter((t) => p[t]).map((t) => `<span class="odd t-${t}">${TIER_NAME[t]} ${pctTxt(p[t]!)}</span>`).join('');
}
function packArt(def: PackDef, big = false): string {
  return `<div class="pack-art p-${def.id}${big ? ' big' : ''}" aria-hidden="true">
    <span class="pa-crimp top"></span><span class="pa-logo">GRAY<br>PIXEL${strayHTML('pa-stray')}</span><span class="pa-sub">A BALLERZ SIDEGAME</span>
    <span class="pa-name">${esc(def.name.toUpperCase())}</span><span class="pa-sun"></span><span class="pa-grid"></span><span class="pa-crimp bot"></span></div>`;
}
/** Pity counter: how many packs of this kind were opened since the last guarantee, e.g. 7/10 until a guaranteed Epic+. */
function pityHTML(d: PackDef): string {
  if (!d.pity) return '<div class="pity none"><span>No pity counter: every pack is a fresh roll.</span></div>';
  const P = profile(), n = (P.pity[d.id] || 0) % d.pity.every, left = d.pity.every - n;
  const what = `guaranteed ${TIER_NAME[d.pity.min]}+`;
  return `<div class="pity" title="Every ${d.pity.every}th ${esc(d.name)} holds a ${TIER_NAME[d.pity.min]} or better. The counter counts packs bought or won."><span class="pity-bar" style="--p:${Math.round((n / d.pity.every) * 100)}%"><i></i></span><span class="pity-t"><b>${n}/${d.pity.every}</b> until ${what}${left === 1 ? ' (next pack!)' : ''}</span></div>`;
}
function tileHTML(d: PackDef): string {
  const P = profile(), box = isBox(d);
  const kind = box ? 'sneaker' : 'baller';
  const first = d.slots.find((s) => s.kind === kind)!;
  const last = [...d.slots].reverse().find((s) => s.kind === 'baller');
  // chance per pack of at least one card of that tier or better
  const chips = (['rare', 'epic', 'legendary', 'iconic'] as Tier[]).map((t) => `<span class="odd t-${t}">${t === 'iconic' ? 'Iconic' : TIER_NAME[t] + '+'} ${pctTxt(packChance(d, t, kind) * 100)}</span>`).join('');
  return `<div class="pack-tile">
      ${packArt(d)}
      <div class="pt-body"><b>${esc(d.name)}</b><span class="dim small">${esc(d.blurb)}</span>
        <div class="odds" aria-label="Chance of at least one card of this tier or better per pack">${chips}</div>
        ${pityHTML(d)}
        <button class="btn go" data-a="buy" data-v="${d.id}" ${P.bucks < d.price ? 'disabled' : ''}>Open for ${d.price} Bucks</button></div>
      <details class="pt-more"><summary class="dim small">All odds and rules</summary>
        <div class="odds"><span class="dim small">${box ? 'Sneaker odds' : 'Baller slot odds'}</span>${oddsLine(first.odds)}</div>
        ${last && last.odds !== first.odds ? `<div class="odds"><span class="dim small">Last Baller</span>${oddsLine(last.odds)}</div>` : ''}
        <span class="dim small">${box ? '' : `About 1 in 5 Iconic Ballerz comes out HOLO: a glitching foil with a stronger special. Pull the HOLO of an Iconic you own as a normal card and it takes his place; the normal copy turns into ${SHARD_YIELD.iconic} shards. `}A duplicate Baller or Sneaker turns into shards for the shared pool; a duplicate Play card gives shards to that card.</span></details></div>`;
}
export function packsHTML(): string {
  const P = profile();
  return `<section class="panel">
    <h2 class="h">Pack shop</h2>
    <p class="lore-line">${esc(PACK_LINES.shop)}</p>
    <details class="pt-about"><summary class="dim small">About packs and ranks</summary><p class="dim small">Packs are bought with Bucks you earn by playing, and one Basic Pack a day is free. Cards are off-chain copies, so owning a Baller NFT and owning his card are separate things. Ballerz are ranked by their three best stats: the top 50 are <b class="ic-txt">Iconic</b>, the next 200 Legendary, the next 750 Epic. A duplicate Baller or Sneaker turns into shards that level up your Ballerz.</p></details>
    ${dailyHTML()}
    <div class="row"><button class="chipbtn${P.music ? ' on' : ''}" data-a="music">${P.music ? '♪ Music on' : '♪ Music off'}</button><span class="dim small">${P.shards} shards</span></div>
    <div class="pack-grid">${BALLER_PACKS.map(tileHTML).join('')}</div>
    <h3 class="h3">Sneakerz</h3>
    <div class="pack-grid">${SNEAKER_PACKS.map(tileHTML).join('')}</div>
    ${P.bucks < packDef('box').price ? '<p class="dim small">Not enough Bucks. Play a game to earn more.</p>' : ''}
  </section>
  <section class="panel"><h2 class="h">Your record</h2><p class="dim">${P.packs} packs opened · ${P.wins} wins · ${P.losses} losses · ${Object.keys(P.cards).length} unique cards</p></section>`;
}

// ---------- opening ----------
/** One card at a time. It drops from the top face down and waits: nothing flips by itself. A click on the card starts the flip (the drama grows
 *  with the tier); once flipped, clicking the card only tilts it. Only the NEXT CARD button moves on, and the next card is face down again.
 *  The last button shows a summary with every card. `step`: drop (falling), wait (face down, click to flip), flip (turning), shown (face up). */
interface Opening {
  def: PackDef; pulls: Pull[]; isNew: boolean[]; i: number; mode: 'pack' | 'card' | 'sum'; step: 'drop' | 'wait' | 'flip' | 'shown'; busy: boolean; shards: number; cardShards: number;
  anim: Animation | null; timers: number[];
}
let OP: Opening | null = null;
/** How long the flip takes per tier (ms): a slow, building turn for the rare ones. */
export const FLIP_MS: Record<Tier, number> = { common: 520, uncommon: 600, rare: 900, epic: 1300, legendary: 1900, iconic: 2400 };
/** What a face-down card shows about its tier before the flip: edge glow strength 0..1 and the number of sparks around it. The colour is the tier colour. */
export const TIER_HINT: Record<Tier, { glow: number; sparks: number }> = {
  common: { glow: 0, sparks: 0 }, uncommon: { glow: 0.15, sparks: 1 }, rare: { glow: 0.35, sparks: 3 }, epic: { glow: 0.55, sparks: 5 }, legendary: { glow: 0.8, sparks: 8 }, iconic: { glow: 1, sparks: 12 },
};
const isHoloIconic = (p: Pull): boolean => p.holo && p.tier === 'iconic';
const hintSparks = (p: Pull): string => {
  const n = Math.round(TIER_HINT[p.tier].sparks / (liteOn() ? 2 : 1));
  return Array.from({ length: n }, (_x, k) => `<i style="--a:${Math.round((360 / n) * k + 12)}deg;--d:${(k % 5) * 0.37}s"></i>`).join('');
};

function faceHTML(p: Pull, isNew: boolean): string {
  const o = { holo: p.holo, isNew };
  if (p.kind === 'baller') return ballerCardHTML(p.id as number, { ...o, level: levelOf(profile(), p.id as number) });
  if (p.kind === 'sneaker') return sneakerCardHTML(p.id as number, o);
  return playCardHTML(p.id as string, o);
}
/** The shard badge on a duplicate: Baller and Sneaker shards go to the shared pool, Play card shards to that card only. */
export const dupeHTML = (p: Pull): string => (p.upgrade ? `<span class="dupe up"><b>HOLO UPGRADE · +${p.shards} shards</b><small>your normal copy became shards</small></span>` : p.shards ? `<span class="dupe"><b>DUPLICATE · +${p.shards} shards</b><small>${p.cardShard ? 'for this card only' : 'to your shard pool'}</small></span>` : '');
/** Opens a pack without paying (story rewards). */
export function freePack(id: string, forceIconic = false): void { open(id, true, forceIconic); }
function buy(id: string): void { open(id, false); }
/** Opens the next pack won in the story or from star rewards. */
export function openPending(): void {
  const P = profile(), id = P.pending.shift();
  if (id) { save(); open(id, true); }
}
function open(id: string, free: boolean, forceIconic = false): void {
  const def = packDef(id), P = profile();
  if (!free && !spend(def.price)) return;
  setMusicOverride(P.music ? 'pack' : 'none');
  seedRng((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  // pity counts every pack of this kind, bought or won: every Nth one holds the guarantee
  P.pity[id] = (P.pity[id] || 0) + 1;
  const pity = !!def.pity && P.pity[id] % def.pity.every === 0;
  const pulls = openPack(def, { pity, forceIconic });
  let shards = 0, cardShards = 0;
  const isNew = pulls.map((p) => { const r = addPull(p); p.shards = r.shards; p.cardShard = r.card; if (r.card) cardShards += r.shards; else shards += r.shards; return r.isNew; });
  P.packs++;
  save();
  onChange();
  clearTimers();
  OP = { def, pulls, isNew, i: 0, mode: 'pack', step: 'drop', busy: false, shards, cardShards, anim: null, timers: [] };
  showPack();
}
function clearTimers(): void { if (OP) { OP.timers.forEach((t) => clearTimeout(t)); OP.timers = []; OP.anim?.cancel(); OP.anim = null; } }
/** setTimeout that dies with the opening (a skip, a new pack, closing the overlay). */
function later(fn: () => void, ms: number): void {
  const op = OP;
  if (!op) return;
  op.timers.push(window.setTimeout(() => { if (OP === op) fn(); }, ms));
}
function overlayEl(): HTMLElement {
  let o = document.getElementById('opening');
  if (!o) {
    o = document.createElement('div');
    o.id = 'opening';
    o.className = 'overlay opening';
    o.setAttribute('role', 'dialog');
    o.setAttribute('aria-modal', 'true');
    o.setAttribute('aria-label', 'Opening a pack');
    document.body.appendChild(o);
    bindTilt(o);
  }
  return o;
}
function showPack(): void {
  const o = overlayEl(), op = OP!;
  delete o.dataset.a;
  // an Iconic inside makes the pack glitch before it's even opened
  const iconic = op.pulls.some(isHoloIconic);
  const art = packArt(op.def, true);
  o.innerHTML = `<div class="op-stage"><button class="pack-hit${iconic ? ' glitch' : ''}" data-a="rip" aria-label="Rip the pack open">${iconic
    ? `<span class="gl-wrap">${art}<span class="gl-layer gl-a" aria-hidden="true">${art}</span><span class="gl-layer gl-b" aria-hidden="true">${art}</span></span>` : art}</button>
    <p class="op-hint${iconic ? ' gl-text' : ''}" data-text="${iconic ? PACK_LINES.ripIconic : PACK_LINES.ripHint}">${iconic ? PACK_LINES.ripIconic : PACK_LINES.ripHint}</p></div>`;
  (o.querySelector('.pack-hit') as HTMLElement).focus();
}
function rip(): void {
  const op = OP!;
  if (op.busy) return;
  op.busy = true;
  const o = overlayEl();
  const best = op.pulls.reduce((m, p) => Math.max(m, tierRank(p.tier)), 0);
  const btn = o.querySelector('.pack-hit') as HTMLElement;
  // a walkout-style hint: the tear flashes in the colour of the best card inside
  btn.classList.add('ripping', 'best-' + TIERS[best]);
  const wait = liteOn() ? Math.min(900, best >= 5 ? 1400 : 700) : best >= 5 ? 2200 : best >= 4 ? 1500 : 900;
  if (!reduced()) {
    sfx('packRip', { rank: best });
    // the walkout builds while the pack tears: a rising charge scaled to the best card inside
    if (best >= 2) sfx('packCharge', { ms: wait - 200, rank: best, i: 0 });
  }
  if (best >= 4 && !reduced()) o.classList.add('rays', 'rays-' + TIERS[best]);
  const hint = o.querySelector('.op-hint');
  if (hint) hint.textContent = PACK_LINES.rendering[best % PACK_LINES.rendering.length];
  const done = () => { op.busy = false; o.classList.remove('rays', 'rays-legendary', 'rays-iconic'); showCards(); };
  if (reduced()) done(); else later(done, wait);
}
/** Keyframes of a basketball drop: from above the screen, bounces (each lower than the last), a squash at every floor hit. Heights in px. */
export function dropFrames(y0: number, bounces: number[]): { keys: Keyframe[]; dur: number; hits: { t: number; power: number }[] } {
  const K = 21; // ms per sqrt(px): a fall takes sqrt(h) units, like gravity
  const fall = 'cubic-bezier(.5,0,1,.55)', rise = 'cubic-bezier(0,.45,.5,1)';
  const pts: { t: number; y: number; r: number; sx: number; sy: number; e: string; hit?: number }[] = [{ t: 0, y: -Math.abs(y0), r: -9, sx: 1, sy: 1, e: fall }];
  let t = Math.sqrt(Math.abs(y0)) * K;
  const n = bounces.length;
  pts.push({ t, y: 0, r: 4, sx: 1.08, sy: 0.92, e: rise, hit: 1 });
  bounces.forEach((h, k) => {
    t += Math.sqrt(h) * K; pts.push({ t, y: -h, r: k % 2 ? 2 : -3, sx: 0.98, sy: 1.03, e: fall });
    t += Math.sqrt(h) * K; pts.push({ t, y: 0, r: 0, sx: 1.05 - k * 0.01, sy: 0.95 + k * 0.01, e: rise, hit: 1 - (k + 1) * (0.7 / (n + 1)) });
  });
  const end = t + 70;
  pts.push({ t: end, y: 0, r: 0, sx: 1, sy: 1, e: 'ease-out' });
  const keys: Keyframe[] = pts.map((p) => ({ offset: p.t / end, transform: `translateY(${p.y}px) rotate(${p.r}deg) scale(${p.sx}, ${p.sy})`, easing: p.e }));
  return { keys, dur: end, hits: pts.filter((p) => p.hit != null).map((p) => ({ t: p.t, power: p.hit! })) };
}
const bouncesFor = (tier: Tier): number[] => {
  const b1 = Math.max(70, Math.min(150, innerHeight * 0.17));
  if (liteOn()) return [b1 * 0.8];
  return tier === 'iconic' ? [b1, b1 * 0.5, b1 * 0.22] : [b1, b1 * 0.45];
};
function stageHTML(op: Opening): string {
  const i = op.i, p = op.pulls[i], n = op.pulls.length, h = TIER_HINT[p.tier];
  return `<div class="op-stage solo">
    <div class="op-top"><span class="op-count">Card <b>${i + 1}</b> of ${n}</span><span class="op-dots" aria-hidden="true">${op.pulls.map((_x, k) => `<i class="${k < i ? 'done' : k === i ? 'now' : ''}"></i>`).join('')}</span><button class="btn sm" data-a="opskip">Skip all</button></div>
    <div class="op-slot"><div class="flip solo t-${p.tier}" id="opCard" data-a="opflip" role="button" tabindex="0" style="--hint:${h.glow};--flipms:${FLIP_MS[p.tier]}ms" aria-label="Card ${i + 1} of ${n}, face down. Tap to flip.">
      <span class="hint-sparks" aria-hidden="true">${hintSparks(p)}</span>
      <span class="flip-in"><span class="back"><span class="back-logo">G${strayHTML('back-stray')}</span><span class="back-ring"></span></span><span class="front">${faceHTML(p, op.isNew[i])}${dupeHTML(p)}</span></span></div></div>
    <p class="op-hint" id="opHint">&nbsp;</p>
    <button class="btn op-next" id="opNextBtn" data-a="opnext" disabled>Tap the card to flip</button></div>`;
}
/** The big bottom button: disabled (a quiet prompt) until the card is face up, then a glowing NEXT CARD. */
function nextBtn(label: string, ready: boolean): void {
  const b = document.getElementById('opNextBtn') as HTMLButtonElement | null;
  if (!b) return;
  b.textContent = label;
  b.disabled = !ready;
  b.classList.toggle('go', ready); b.classList.toggle('ready', ready);
}
function showCards(): void { OP!.i = 0; OP!.mode = 'card'; dealCard(); }
function dealCard(): void {
  const op = OP!, o = overlayEl(), p = op.pulls[op.i];
  op.mode = 'card'; op.step = 'drop'; op.busy = false;
  delete o.dataset.a;
  o.innerHTML = stageHTML(op);
  const el = o.querySelector<HTMLElement>('#opCard')!;
  const hint = o.querySelector('#opHint')!;
  if (reduced()) { land(); return; }
  const r = el.getBoundingClientRect();
  const { keys, dur, hits } = dropFrames(r.top + r.height + 30, bouncesFor(p.tier));
  op.anim = el.animate(keys, { duration: dur, fill: 'forwards' });
  hits.forEach((h, k) => later(() => { sfx('bounce', { power: h.power }); if (k === 0 && tierRank(p.tier) >= 4 && !liteOn()) { document.body.classList.remove('quake'); void document.body.offsetWidth; document.body.classList.add('quake'); } }, h.t));
  hint.textContent = 'Face down...';
  later(land, dur);
}
/** The card has landed face down and WAITS. Its edge colour, glow and sparks hint at the tier; nothing happens until it is clicked. */
function land(): void {
  const op = OP!;
  if (op.step !== 'drop') return;
  op.step = 'wait';
  op.anim?.cancel(); op.anim = null;
  const o = overlayEl(), el = o.querySelector<HTMLElement>('#opCard');
  if (!el) return;
  el.classList.add('waiting');
  const hint = o.querySelector('#opHint');
  if (hint) hint.textContent = 'Tap the card to flip it';
  el.focus({ preventScroll: true });
}
/** Click on the face-down card: the flip starts now. The turn is slower and louder for rarer tiers; a HOLO Iconic glitches while it turns. */
function flip(): void {
  const op = OP;
  if (!op || op.mode !== 'card') return;
  if (op.step === 'drop') { op.timers.forEach((t) => clearTimeout(t)); op.timers = []; land(); return; }
  if (op.step !== 'wait') return;
  op.step = 'flip';
  const o = overlayEl(), el = o.querySelector<HTMLElement>('#opCard'), p = op.pulls[op.i];
  if (!el) return;
  el.removeAttribute('data-a');
  el.classList.remove('waiting');
  const rank = tierRank(p.tier), ms = reduced() ? 0 : FLIP_MS[p.tier];
  el.classList.add('flipping', 'flipped');
  if (!reduced()) {
    sfx('packCharge', { ms, rank, i: op.i });
    if (isHoloIconic(p) && !liteOn()) { el.classList.add('glitching'); sfx('glitch2'); }
  }
  const hint = o.querySelector('#opHint');
  if (hint) hint.textContent = rank >= 4 ? 'Something huge is compiling...' : rank >= 2 ? 'Something is compiling...' : '...';
  nextBtn('Flipping...', false);
  later(reveal, ms);
}
function reveal(): void {
  const op = OP!;
  if (op.step === 'shown') return;
  op.step = 'shown';
  const o = overlayEl(), el = o.querySelector<HTMLElement>('#opCard'), p = op.pulls[op.i];
  if (!el) return;
  el.classList.remove('flipping', 'glitching');
  el.classList.add('shown');
  el.setAttribute('aria-label', `${TIER_NAME[p.tier]}${p.holo ? ' HOLO' : ''} card. Tilts when touched. Use Next card to continue.`);
  const rank = tierRank(p.tier);
  if (rank >= 1 || p.holo) burst(el, p.tier, isHoloIconic(p));
  if (rank >= 4) rain(p.tier, isHoloIconic(p));
  const prevMax = op.pulls.slice(0, op.i).reduce((m, q) => Math.max(m, tierRank(q.tier)), -1);
  const newBest = op.i > 0 && rank > prevMax && rank >= 2;
  sfx(rank >= 5 ? 'iconicHit' : 'packReveal', { rank, i: op.i, newBest });
  if (isHoloIconic(p)) setTimeout(() => sfx('glitch3'), 450);
  const last = op.i === op.pulls.length - 1;
  const hint = o.querySelector('#opHint');
  if (hint) hint.textContent = `${newBest ? 'NEW BEST PULL · ' : ''}${TIER_NAME[p.tier]}${p.holo ? ' · HOLO' : ''}${p.upgrade ? ' · UPGRADE' : op.isNew[op.i] ? ' · NEW' : ''}`;
  if (newBest && !reduced()) { el.classList.add('newbest'); later(() => el.classList.remove('newbest'), 1400); }
  nextBtn(last ? 'SEE SUMMARY' : 'NEXT CARD', true);
}
/** The NEXT CARD button (only when the card is face up): the next card, or after the last one the summary. */
function next(): void {
  const op = OP;
  if (!op || op.mode !== 'card' || op.step !== 'shown') return;
  sfx('nextTick');
  if (op.i >= op.pulls.length - 1) { showSummary(); return; }
  clearTimers();
  op.i++;
  dealCard();
}
function showSummary(): void {
  const op = OP!, o = overlayEl();
  clearTimers();
  op.mode = 'sum';
  const ic = op.pulls.find((p) => p.tier === 'iconic'), holoIc = op.pulls.some(isHoloIconic);
  if (ic) { sfx('triumphHit', { rank: holoIc ? 1 : 0 }); setMusicOverride(profile().music ? 'triumph' : 'none', holoIc ? 1 : 0.55); }
  else sfx('summary');
  if (op.shards || op.cardShards) setTimeout(() => sfx('shard'), 700);
  delete o.dataset.a;
  const news = op.isNew.filter(Boolean).length;
  const bestI = op.pulls.reduce((m, p, k) => (tierRank(p.tier) > tierRank(op.pulls[m].tier) ? k : m), 0);
  const lines = [news ? `${news} new card${news > 1 ? 's' : ''} added to your collection.` : 'Nothing new this time.'];
  if (op.shards) lines.push(`Duplicates gave ${op.shards} shards (shared pool, spend them on Baller levels in Collection).`);
  if (op.cardShards) lines.push(`Duplicate Play cards gave ${op.cardShards} shards to those cards only.`);
  const P = profile();
  o.innerHTML = `<div class="op-stage sum"><h2 class="h">${esc(op.def.name)} opened</h2>
    <div class="sum-grid">${op.pulls.map((p, i) => `<div class="sum-card t-${p.tier}${i === bestI ? ' best' : ''}" style="--i:${i}">${i === bestI ? '<span class="best-tag">BEST PULL</span>' : ''}${faceHTML(p, op.isNew[i])}${dupeHTML(p)}</div>`).join('')}</div>
    <p class="op-hint sum-note">${esc(PACK_LINES.done)} ${lines.map(esc).join(' ')}</p>
    <div class="row center"><button class="btn ghost" data-a="opclose">Done</button>${P.pending.length ? `<button class="btn go" data-a="openpending">Open next won pack (${P.pending.length})</button>` : ''}${P.bucks >= op.def.price ? `<button class="btn${P.pending.length ? '' : ' go'}" data-a="buy" data-v="${op.def.id}">Open another (${op.def.price})</button>` : ''}</div></div>`;
  o.scrollTop = 0;
}
/** Golden (or glitch-pink) particles falling from the top; skipped in lite mode and with reduced motion. */
function rain(tier: Tier, holo = false): void {
  if (reduced() || liteOn()) return;
  const n = tier === 'iconic' ? 46 : 30;
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i');
    d.className = 'rain t-' + tier + (tier === 'iconic' && !holo ? ' gold' : '');
    d.style.left = rnd() * 100 + 'vw';
    d.style.setProperty('--rd', 1.3 + rnd() * 1.4 + 's');
    d.style.setProperty('--rw', rnd() * 0.9 + 's');
    d.style.setProperty('--rs', 4 + rnd() * 6 + 'px');
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 3000);
  }
}
function burst(el: HTMLElement, tier: Tier, holo = false): void {
  if (reduced()) return;
  const n = Math.round((tier === 'iconic' ? 60 : tier === 'legendary' ? 34 : 14) / (liteOn() ? 3 : 1));
  const r = el.getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i');
    d.className = 'spark t-' + tier + (tier === 'iconic' && !holo ? ' gold' : '');
    const a = (Math.PI * 2 * i) / n + rnd() * 0.4, dist = 90 + rnd() * 120;
    d.style.left = r.left + r.width / 2 + 'px';
    d.style.top = r.top + r.height / 2 + 'px';
    d.style.setProperty('--dx', Math.cos(a) * dist + 'px');
    d.style.setProperty('--dy', Math.sin(a) * dist + 'px');
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }
  if (tier === 'legendary' || tier === 'iconic') {
    const w = document.createElement('div');
    w.className = 'walkout t-' + tier + (tier === 'iconic' ? (holo ? ' holo' : ' gold') : '');
    w.innerHTML = holo ? `<b class="gl-title-b" data-text="HOLO">HOLO</b><small>ICONIC</small>` : `<b>${TIER_NAME[tier].toUpperCase()}</b>`;
    document.body.appendChild(w);
    setTimeout(() => w.remove(), tier === 'iconic' ? 2200 : 1500);
    const f = document.createElement('div');
    f.className = 'flash t-' + tier + (tier === 'iconic' ? (holo ? ' holo' : ' gold') : '');
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 700);
    document.body.classList.remove('quake'); void document.body.offsetWidth; document.body.classList.add('quake');
  }
}
export function packsAct(a: string, v: string | undefined): boolean {
  switch (a) {
    case 'buy': document.getElementById('opening')?.remove(); clearTimers(); buy(v!); return true;
    case 'openpending': document.getElementById('opening')?.remove(); clearTimers(); openPending(); return true;
    case 'rip': rip(); return true;
    case 'opflip': flip(); return true;
    case 'claimdaily': if (claimDailyPack()) { document.getElementById('opening')?.remove(); clearTimers(); freePack('basic'); } return true;
    case 'opnext': next(); return true;
    case 'opskip': if (OP && OP.mode === 'card') showSummary(); return true;
    case 'opclose': document.getElementById('opening')?.remove(); clearTimers(); OP = null; setMusicOverride(null); onChange(); return true;
    case 'music': setMusic(!profile().music); if (OP) setMusicOverride(profile().music ? 'pack' : 'none'); onChange(); return true;
  }
  return false;
}
