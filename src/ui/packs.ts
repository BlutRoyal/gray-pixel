// Pack shop and the pack-opening sequence: rip the wrapper, then charge and flip each card.
import { TIERS, TIER_NAME, rnd, seedRng, tierRank, type Tier } from '../rules';
import { BALLER_PACKS, PACKS, SNEAKER_PACKS, isBox, openPack, pullOne, oddsPct, packChance, packDef, type Odds, type PackDef, type Pull } from '../casual/packs';
import { SHARD_YIELD } from '../casual/progress';
import { addPull, claimDailyPack, dailyPackReady, msToNextDay, profile, save, setMusic, spend } from './store';
import { sfx } from './sfx';
import { setMusicOverride } from './music';
import { ballerTier } from '../rules';
import { liteOn } from './lite';
import { GLITCH_STYLES, REVEAL_STYLES, getGlitchId, getRevealId, glideFrames, packTease, preFlip, styled, turnClass, type GlitchId, type RevealId, type RevealStyle } from './reveal';
import { labOpen } from './gate';
import { PACK_LINES } from './lore';
import { strayHTML } from './wordmark';
import { ballerCardHTML, ballerFromId, bindTilt, esc, fitCards, playCardHTML, reduced, sneakerCardHTML } from './views';
import { sneakerRow } from '../rules';
import { ccard } from '../casual/cards';
import { levelOf } from '../casual/progress';

let onChange: () => void = () => {};
export function initPacks(changed: () => void): void {
  onChange = changed;
  document.addEventListener('keydown', (e) => {
    if (!OP || OP.mode !== 'card' || (e.target as HTMLElement | null)?.closest('button')) return;
    // keyboard: the same as a tap (skip ahead), or SEE SUMMARY once the last card is up.
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); if (OP.final) showSummary(); else tap(); }
  });
  (window as unknown as { __gpOpen?: unknown }).__gpOpen = (specs: ForcedPull[], look?: OpenLook): boolean => { if (!labOpen()) return false; openForced(specs, look); return true; };
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
/** The opening runs by itself: the sealed pack teases, rips, then each card glides in face down, builds suspense (long from Epic up), turns and is
 *  laid on a fanned pile; the LAST card stays up front (tilts on touch) until SEE SUMMARY. A tap skips ahead (during a build-up: to the flip; a second tap
 *  on the same card: to the end), Skip all goes straight to the end. Tapping a pile or summary card opens the close-up view (inspect.ts).
 *  `step`: drop (gliding in), wait (face down), build (suspense), flip (turning), shown (face up). */
interface Opening {
  def: PackDef; pulls: Pull[]; isNew: boolean[]; i: number; mode: 'pack' | 'card' | 'sum'; step: 'drop' | 'wait' | 'build' | 'flip' | 'shown'; busy: boolean; shards: number; cardShards: number;
  anim: Animation | null; timers: number[]; final: boolean; tapped: boolean; pile: string[];
  /** the opening style and glitch variant of this opening (the saved default, or what the Lab gallery previews) */
  st: RevealStyle; gv: GlitchId;
}
/** Lab / test hook: preview with a style and glitch variant other than the saved default. */
export interface OpenLook { style?: RevealId; glitch?: GlitchId }
let look: OpenLook = {};
const ocls = (): string => `overlay opening rs-${OP!.st.id} gv-${OP!.gv}`;
let OP: Opening | null = null;
export { preFlip, packTease, glideFrames };
const isHoloIconic = (p: Pull): boolean => p.holo && p.tier === 'iconic';
const hintSparks = (p: Pull, st: RevealStyle): string => {
  const n = Math.round(styled(preFlip(p), st).sparks / (liteOn() ? 2 : 1));
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
const FOIL = '<span class="foilfx" aria-hidden="true"></span>';
/** Opens a pack without paying (story rewards). */
export function freePack(id: string, forceIconic = false): void { open(id, true, forceIconic); }
function buy(id: string): void { open(id, false); }
/** Opens the next pack won in the story or from star rewards. */
export function openPending(): void {
  const P = profile(), id = P.pending.shift();
  if (id) { save(); open(id, true); }
}
function begin(def: PackDef, pulls: Pull[], pack = true): void {
  const st = REVEAL_STYLES[look.style || getRevealId()], gv = look.glitch && look.glitch in GLITCH_STYLES ? look.glitch : getGlitchId();
  look = {};
  const P = profile();
  let shards = 0, cardShards = 0;
  const isNew = pulls.map((p) => { const r = addPull(p); p.shards = r.shards; p.cardShard = r.card; if (r.card) cardShards += r.shards; else shards += r.shards; return r.isNew; });
  P.packs++;
  save();
  onChange();
  clearTimers();
  OP = { def, pulls, isNew, i: 0, mode: 'pack', step: 'drop', busy: false, shards, cardShards, anim: null, timers: [], final: false, tapped: false, pile: [], st, gv };
  if (pack) showPack();
}
function open(id: string, free: boolean, forceIconic = false): void {
  const def = packDef(id), P = profile();
  if (!free && !spend(def.price)) return;
  setMusicOverride(P.music ? 'pack' : 'none');
  seedRng((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  // pity counts every pack of this kind, bought or won: every Nth one holds the guarantee
  P.pity[id] = (P.pity[id] || 0) + 1;
  const pity = !!def.pity && P.pity[id] % def.pity.every === 0;
  begin(def, openPack(def, { pity, forceIconic }));
}
/** Lab / test hook: opens a pack with exactly these pulls (window.__gpOpen, only when the Lab is unlocked). */
export interface ForcedPull { kind?: 'baller' | 'sneaker' | 'play'; tier: Tier; holo?: boolean; /** a specific Baller id */ id?: number }
export function openForced(specs: ForcedPull[], lk?: OpenLook): void {
  look = lk || {};
  const pulls = specs.map((s) => { const p = pullOne(s.kind || (tierRank(s.tier) >= 3 ? 'baller' : 'play'), s.tier); if (s.id != null && p.kind === 'baller') { p.id = s.id; p.key = 'b:' + s.id; }
    p.holo = !!s.holo && s.tier === 'iconic' && p.kind === 'baller'; return p; });
  setMusicOverride(profile().music ? 'pack' : 'none');
  begin(packDef('pro'), pulls);
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
    o.className = ocls();
    o.setAttribute('role', 'dialog');
    o.setAttribute('aria-modal', 'true');
    o.setAttribute('aria-label', 'Opening a pack');
    document.body.appendChild(o);
    bindTilt(o);
  }
  return o;
}
/** The sealed pack. A HOLO Iconic inside makes it glitch hard (tear, RGB split, static, shake) from the start; a normal Iconic only flickers
 *  briefly and mildly; Epic or Legendary (the same for both) give a slight shake. */
function showPack(): void {
  const o = overlayEl(), op = OP!;
  delete o.dataset.a;
  o.className = ocls();
  const tease = packTease(op.pulls), holo = tease.kind === 'holo';
  const art = packArt(op.def, true);
  const cls = holo ? ' glitch tease-holo' : tease.kind === 'iconic' ? ' tease-iconic' : tease.kind === 'epic+' ? ' tease-shake' : '';
  if (holo) o.classList.add('holo-pack');
  o.innerHTML = `${holo ? '<span class="pk-static" aria-hidden="true"></span>' : ''}<div class="op-stage"><button class="pack-hit${cls}" data-a="rip" aria-label="Tap to open the pack"><span class="pk-tilt" data-tilt>${holo
    ? `<span class="gl-wrap">${art}<span class="gl-layer gl-a" aria-hidden="true">${art}</span><span class="gl-layer gl-b" aria-hidden="true">${art}</span></span>` : art}</span></button>
    <p class="pk-tap" aria-hidden="true">TAP TO OPEN</p>
    <p class="op-hint${holo ? ' gl-text' : ''}" data-text="${holo ? PACK_LINES.ripIconic : PACK_LINES.ripHint}">${holo ? PACK_LINES.ripIconic : PACK_LINES.ripHint}</p><button class="btn sm op-skip-pack" data-a="opskip">Skip all</button></div>`;
  (o.querySelector('.pack-hit') as HTMLElement).focus();
  // the sealed pack waits for one tap (or Enter); after that the opening runs by itself
  if (!reduced()) {
    if (holo) { sfx('glitch2'); later(() => sfx('glitch3'), 420); later(() => sfx('glitch1'), 1500); }
    else if (tease.kind === 'iconic') sfx('glitch1', { v: 0.55 });
    else if (tease.kind === 'epic+') { sfx('heartbeat', { v: 0.7 }); later(() => sfx('heartbeat', { v: 0.7 }), 900); }
  }
}
function rip(): void {
  const op = OP!;
  if (op.busy) return;
  op.busy = true;
  const o = overlayEl(), tease = packTease(op.pulls), key = tease.best.replace('+', 'plus'), rank = preFlip(bestPull(op)).sfxRank;
  const btn = o.querySelector('.pack-hit') as HTMLElement;
  // the tear flashes in the colour of the best card inside; Epic and Legendary share one colour
  o.querySelector('.pk-tap')?.remove();
  btn.classList.add('ripping', 'best-' + key);
  if (tease.kind === 'holo') o.classList.add('tear');
  const wait = liteOn() ? Math.round(tease.ripMs * 0.6) : tease.ripMs;
  if (!reduced()) {
    sfx('packRip', { rank });
    if (rank >= 2) sfx('packCharge', { ms: wait - 200, rank, i: 0 });
  }
  if (op.st.rays && tease.kind !== 'none' && rank >= 4 && !reduced()) o.classList.add('rays', tease.kind === 'epic+' ? 'rays-epicplus' : 'rays-iconic');
  const hint = o.querySelector('.op-hint');
  if (hint) hint.textContent = PACK_LINES.rendering[rank % PACK_LINES.rendering.length];
  const done = () => { op.busy = false; o.classList.remove('rays', 'rays-epicplus', 'rays-iconic', 'tear', 'holo-pack'); showCards(); };
  if (reduced()) done(); else later(done, wait);
}
const bestPull = (op: Opening): Pull => op.pulls.reduce((m, p) => (preFlip(p).sfxRank + (p.holo ? 0.5 : 0) > preFlip(m).sfxRank + (m.holo ? 0.5 : 0) ? p : m), op.pulls[0]);
function stageHTML(op: Opening): string {
  const i = op.i, p = op.pulls[i], n = op.pulls.length, pre = styled(preFlip(p), op.st);
  return `<div class="op-stage solo auto">
    <div class="op-top"><span class="op-count">Card <b>${i + 1}</b> of ${n}</span><span class="op-dots" aria-hidden="true">${op.pulls.map((_x, k) => `<i class="${k < i ? 'done' : k === i ? 'now' : ''}"></i>`).join('')}</span><button class="btn sm" data-a="opskip">Skip all</button></div>
    <div class="op-slot"><div class="flip solo ${pre.cls}${pre.faceGlitch === 2 ? ' glitching' : ''}" id="opCard" data-a="optap" role="button" tabindex="0" style="--hint:${pre.glow};--flipms:${pre.turnMs}ms;--bms:${pre.buildMs}ms;--sh:${pre.shake}" aria-label="Card ${i + 1} of ${n}, face down. Tap to skip ahead.">
      <span class="hint-sparks" aria-hidden="true">${hintSparks(p, op.st)}</span>
      <span class="flip-in"><span class="back"><span class="back-logo">G${strayHTML('back-stray')}</span><span class="back-ring"></span><span class="back-tear"></span><span class="back-leak"></span></span><span class="front">${faceHTML(p, op.isNew[i])}${dupeHTML(p)}</span></span>${p.holo ? FOIL : ''}</div></div>
    <p class="op-hint" id="opHint">&nbsp;</p><div class="op-pile" id="opPile">${op.pile.join('')}</div>
    <button class="btn op-next" id="opNextBtn" data-a="opnext" disabled>Opening...</button></div>`;
}
/** The big bottom button: a quiet "Opening..." until the last card is up, then a glowing SEE SUMMARY. */
function nextBtn(label: string, ready: boolean): void {
  const b = document.getElementById('opNextBtn') as HTMLButtonElement | null;
  if (!b) return;
  b.textContent = label;
  b.disabled = !ready;
  b.classList.toggle('go', ready); b.classList.toggle('ready', ready);
}
function showCards(): void { OP!.i = 0; OP!.mode = 'card'; dealCard(); }
function dealCard(): void {
  const op = OP!, o = overlayEl();
  op.mode = 'card'; op.step = 'drop'; op.busy = false; op.tapped = false;
  delete o.dataset.a;
  o.className = ocls();
  o.innerHTML = stageHTML(op);
  const el = o.querySelector<HTMLElement>('#opCard')!;
  const hint = o.querySelector('#opHint')!;
  fitCards(o);
  if (reduced()) { land(); return; }
  const r = el.getBoundingClientRect();
  const { keys, dur, hit } = glideFrames(r.top + r.height + 30);
  op.anim = el.animate(keys, { duration: dur + 220, fill: 'forwards' });
  later(() => sfx('bounce', { power: 0.45 }), hit * 1.28);
  hint.textContent = 'Face down...';
  later(land, dur + 220);
}
/** The card has landed face down. Its edge colour, glow and sparks hint at the tier (Common/Uncommon/Rare: nothing; Epic and Legendary: one shared look). It starts by itself. */
function land(): void {
  const op = OP!;
  if (op.step !== 'drop') return;
  op.step = 'wait';
  op.anim?.cancel(); op.anim = null;
  const o = overlayEl(), el = o.querySelector<HTMLElement>('#opCard');
  if (!el) return;
  el.classList.add('waiting');
  const hint = o.querySelector('#opHint');
  if (hint) hint.textContent = 'Face down...';
  later(flip, 650);
}
/** The suspense build-up first (none for Common, Uncommon and Rare), then the turn. */
function flip(): void {
  const op = OP;
  if (!op || op.mode !== 'card' || op.step !== 'wait') return;
  const o = overlayEl(), el = o.querySelector<HTMLElement>('#opCard'), p = op.pulls[op.i];
  if (!el) return;
  el.classList.remove('waiting');
  const pre = styled(preFlip(p), op.st), hint = o.querySelector('#opHint');
  if (pre.buildMs <= 0 || reduced()) { turn(); return; }
  op.step = 'build';
  el.classList.add('building');
  if (hint) hint.textContent = op.st.id === 'clean' ? 'Compiling...' : 'Something huge is compiling...';
  const ms = liteOn() ? Math.round(pre.buildMs * 0.8) : pre.buildMs;
  el.style.setProperty('--bms', ms + 'ms');
  sfx('venitus', { ms, rank: pre.sfxRank, level: pre.faceGlitch === 2 ? 1 : 0 });
  // heartbeat: faster and faster, each beat also pulses the card
  let at = 450, gap = 820;
  if (!pre.leak) el.classList.add('no-leak');
  while (pre.heart && at < ms - 500) { const a = at; later(() => { sfx('heartbeat', { v: 1.15 }); el.classList.add('beat'); window.setTimeout(() => el.classList.remove('beat'), 150); }, a); at += gap; gap = Math.max(300, gap * 0.87); }
  later(() => el.classList.add('flare'), ms - 380);
  later(turn, ms);
}
/** The turn itself: only now does the card show its real tier colour. HOLO glitches hard while it turns and wraps in foil at once. */
function turn(): void {
  const op = OP;
  if (!op || op.mode !== 'card' || (op.step !== 'wait' && op.step !== 'build')) return;
  op.step = 'flip';
  const o = overlayEl(), el = o.querySelector<HTMLElement>('#opCard'), p = op.pulls[op.i];
  if (!el) return;
  const pre = styled(preFlip(p), op.st), ms = reduced() ? 0 : pre.turnMs;
  el.classList.remove('waiting', 'building', 'flare', 'beat', 'h-epicplus', 't-common');
  el.classList.add(turnClass(p.tier), 'flipping', 'flipped');
  el.style.setProperty('--flipms', ms + 'ms');
  if (p.holo) el.classList.add('foiling');
  if (!reduced()) {
    sfx('flipSlap', { rank: pre.sfxRank, v: pre.key === 'plain' ? 0.75 : 1 });
    if (isHoloIconic(p)) { el.classList.add('glitching'); sfx('glitch2'); }
    else if (p.tier === 'iconic') { el.classList.add('lglitch'); sfx('glitch1', { v: 0.7 }); }
  }
  const hint = o.querySelector('#opHint');
  if (hint) hint.textContent = pre.buildMs > 0 ? 'Compiling...' : '...';
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
  if (isHoloIconic(p) && !reduced()) { el.classList.add('hglitch'); later(() => el.classList.remove('hglitch'), 1400); }
  el.setAttribute('aria-label', `${TIER_NAME[p.tier]}${p.holo ? ' HOLO' : ''} card. Tilts when touched.`);
  const rank = tierRank(p.tier), st = op.st;
  if (rank >= st.burstFrom) burst(el, p, isHoloIconic(p), st); // Common, Uncommon and Rare (clean): a plain flip, no burst or flash
  if (!reduced() && !liteOn() && (st.rain === 'epic' ? rank >= 4 : st.rain === 'iconic' && rank >= 5)) rain(p.tier, isHoloIconic(p));
  const prevMax = op.pulls.slice(0, op.i).reduce((m, q) => Math.max(m, tierRank(q.tier)), -1);
  const newBest = op.i > 0 && rank > prevMax && rank >= 3;
  // a hit of its own per tier (Epic and Legendary only part ways here)
  const hit = p.tier === 'epic' ? 'hitEpic' : p.tier === 'legendary' ? 'hitLegendary' : p.holo ? 'hitHolo' : p.tier === 'iconic' ? 'iconicHit' : 'packReveal';
  sfx(hit, { rank: rank >= 3 ? rank : 0, i: op.i, newBest, v: rank >= 3 ? 1 : 0.8 });
  if (isHoloIconic(p)) setTimeout(() => sfx('glitch3'), 450);
  const last = op.i === op.pulls.length - 1;
  const hint = o.querySelector('#opHint');
  if (hint) hint.innerHTML = shownHint(p, newBest, p.upgrade ? ' · UPGRADE' : op.isNew[op.i] ? ' · NEW' : '');
  if (newBest && !reduced()) { el.classList.add('newbest'); later(() => el.classList.remove('newbest'), 1400); }
  if (last) {
    // the last card stays up front (it tilts like any card) above the pile until SEE SUMMARY is tapped
    op.final = true;
    el.classList.add('final');
    nextBtn('SEE SUMMARY', true);
    return;
  }
  nextBtn('Opening...', false);
  later(settle, reduced() ? 400 : st.steady ? 1250 + (rank >= 3 ? 450 : 0) + (rank >= 5 ? 600 : 0) : 1300 + rank * 220 + (p.holo ? 700 : 0));
}
/** The opened card goes onto the fanned pile (slightly tilted and skewed), then the next one glides in. */
function pileHTML(op: Opening, k: number, fresh: boolean): string {
  const p = op.pulls[k], wob = (a: number): number => Math.round(((k * 7919 + a * 104729) % 1000) / 1000 * 100) / 100;
  const r = ((wob(1) - 0.5) * 12 + (k - (op.pulls.length - 1) / 2) * 4).toFixed(1), sk = ((wob(2) - 0.5) * 8).toFixed(1), y = Math.round((wob(3) - 0.3) * 14);
  return `<div class="pile-card t-${p.tier}${p.holo ? ' foil-on' : ''}${fresh ? ' fresh' : ''}" style="--r:${r}deg;--k:${sk}deg;--y:${y}px">${faceHTML(p, op.isNew[k])}${p.holo ? FOIL : ''}</div>`;
}
function settle(): void {
  const op = OP;
  if (!op || op.step !== 'shown' || op.final) return;
  op.pile.push(pileHTML(op, op.i, true));
  sfx('nextTick');
  op.i++;
  dealCard();
  op.pile = op.pile.map((h) => h.replace(' fresh', ''));
  fitCards(overlayEl());
}
/** A tap on the card: during the build-up it jumps to the flip, during the turn to the reveal, while it is shown to the next card; a second tap on the same card (or Skip all) goes to the end. */
function tap(): void {
  const op = OP;
  if (!op || op.mode !== 'card' || op.final) return;
  if (op.tapped) { skipToEnd(); return; }
  op.tapped = true;
  if (op.step === 'drop') { op.timers.forEach((t) => clearTimeout(t)); op.timers = []; land(); op.timers.forEach((t) => clearTimeout(t)); op.timers = []; flip(); }
  else if (op.step === 'wait') { op.timers.forEach((t) => clearTimeout(t)); op.timers = []; flip(); }
  else if (op.step === 'build') { op.timers.forEach((t) => clearTimeout(t)); op.timers = []; turn(); }
  else if (op.step === 'flip') { op.timers.forEach((t) => clearTimeout(t)); op.timers = []; reveal(); }
  else if (op.step === 'shown') { op.timers.forEach((t) => clearTimeout(t)); op.timers = []; settle(); }
}
/** Skip all: every earlier card is on the pile, the last one is up front and face up, SEE SUMMARY waits. */
function skipToEnd(): void {
  const op = OP;
  if (!op || op.mode === 'sum') return;
  clearTimers();
  op.mode = 'card';
  op.i = op.pulls.length - 1;
  op.pile = op.pulls.slice(0, -1).map((_p, k) => pileHTML(op, k, false));
  const o = overlayEl();
  op.step = 'drop'; op.tapped = false; op.final = false;
  o.className = ocls();
  o.innerHTML = stageHTML(op);
  const el = o.querySelector<HTMLElement>('#opCard')!, p = op.pulls[op.i];
  el.classList.remove('t-common', 'h-epicplus');
  el.classList.add(turnClass(p.tier), 'flipped', 'shown');
  if (p.holo) el.classList.add('foiling');
  el.style.setProperty('--flipms', '0ms');
  op.step = 'shown'; op.final = true; el.classList.add('final');
  const hint = o.querySelector('#opHint');
  if (hint) hint.innerHTML = shownHint(p, false, (p.upgrade ? ' · UPGRADE' : op.isNew[op.i] ? ' · NEW' : '') + ' · all opened');
  nextBtn('SEE SUMMARY', true);
  fitCards(o);
}
function showSummary(): void {
  const op = OP!, o = overlayEl();
  clearTimers();
  op.mode = 'sum'; op.final = false;
  o.className = ocls();
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
    <div class="sum-grid">${op.pulls.map((p, i) => `<div class="sum-card t-${p.tier}${p.holo ? ' foil-on' : ''}${i === bestI ? ' best' : ''}" style="--i:${i}">${i === bestI ? '<span class="best-tag">BEST PULL</span>' : ''}${faceHTML(p, op.isNew[i])}${dupeHTML(p)}${p.holo ? FOIL : ''}</div>`).join('')}</div>
    <p class="op-hint sum-note">${esc(PACK_LINES.done)} ${lines.map(esc).join(' ')}</p>
    <div class="row center"><button class="btn ghost" data-a="opclose">Done</button>${P.pending.length ? `<button class="btn go" data-a="openpending">Open next won pack (${P.pending.length})</button>` : ''}${P.bucks >= op.def.price ? `<button class="btn${P.pending.length ? '' : ' go'}" data-a="buy" data-v="${op.def.id}">Open another (${op.def.price})</button>` : ''}</div></div>`;
  o.scrollTop = 0;
  fitCards(o);
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
/** The name on the card, for the hint line and the banner. */
function pullName(p: Pull): string {
  try {
    if (p.kind === 'baller') return 'Baller ' + ballerFromId(p.id as number).name;
    if (p.kind === 'sneaker') return 'Sneaker #' + (sneakerRow(p.id as number)?.[0] ?? p.id);
    return ccard(p.id as string)?.name ?? '';
  } catch { return ''; }
}
/** Under the card after the turn: the tier in its own colour, then the name and tags. */
function shownHint(p: Pull, newBest: boolean, tail: string): string {
  return `${newBest ? '<i class="rv-best">NEW BEST PULL</i>' : ''}<b class="rv-tier rv-${p.tier}">${esc(TIER_NAME[p.tier].toUpperCase())}${p.holo ? ' · HOLO' : ''}</b><span class="rv-name">${esc(pullName(p))}${esc(tail)}</span>`;
}
const gone = (el: Element, ms: number): void => { setTimeout(() => el.remove(), ms); };
/** What the flip shows, by style: Epic a tier-colour glow, Legendary a gold light sweep and a name banner (the clean look), the old sparks, flash and
 *  big word (classic, cinematic), Iconic a dark flash with a gold burst. Screen shake and particles only where the style says so. */
function burst(el: HTMLElement, p: Pull, holo: boolean, st: RevealStyle): void {
  if (reduced()) return;
  const tier = p.tier, rank = tierRank(tier);
  const r = el.getBoundingClientRect();
  if (st.burst === 'full' || rank >= 5) {
    const n = Math.round((tier === 'iconic' ? 60 : tier === 'legendary' ? 44 : tier === 'epic' ? 20 : 12) / (liteOn() ? 3 : 1));
    for (let i = 0; i < n; i++) {
      const d = document.createElement('i');
      d.className = 'spark t-' + tier + (tier === 'iconic' && !holo ? ' gold' : '');
      const a = (Math.PI * 2 * i) / n + rnd() * 0.4, dist = 90 + rnd() * (tier === 'legendary' || tier === 'iconic' ? 160 : 100);
      d.style.left = r.left + r.width / 2 + 'px';
      d.style.top = r.top + r.height / 2 + 'px';
      d.style.setProperty('--dx', Math.cos(a) * dist + 'px');
      d.style.setProperty('--dy', Math.sin(a) * dist + 'px');
      document.body.appendChild(d);
      gone(d, 900);
    }
  }
  const add = (cls: string, html: string, ms: number): void => { const w = document.createElement('div'); w.className = cls; w.innerHTML = html; document.body.appendChild(w); gone(w, ms); };
  if (tier === 'epic') {
    if (st.epicFx === 'glow') { el.classList.add('fx-glow'); setTimeout(() => el.classList.remove('fx-glow'), 1500); }
    else add('flash t-epic small', '', 600);
  }
  if (tier === 'legendary') {
    if (st.legendaryFx === 'sweep') {
      el.classList.add('fx-lsweep'); setTimeout(() => el.classList.remove('fx-lsweep'), 1900);
      add('lsweep', '<i class="ls-flare"></i><i class="ls-beam"></i>', 1700);
      add('rbanner t-legendary', `<b>LEGENDARY</b><small>${esc(pullName(p))}</small>`, 2300);
    } else {
      add('walkout t-legendary', `<b>${TIER_NAME[tier].toUpperCase()}</b>`, 1500);
      add('flash t-legendary', '', 700);
    }
  }
  if (tier === 'iconic') {
    add('walkout t-iconic' + (holo ? ' holo' : ' gold'), holo ? `<b class="gl-title-b" data-text="HOLO">HOLO</b><small>ICONIC</small>` : `<b>${TIER_NAME[tier].toUpperCase()}</b>`, 2200);
    add('flash t-iconic' + (holo ? ' holo' : ' gold') + (st.id === 'clean' ? ' dark' : ''), '', st.id === 'clean' ? 1000 : 700);
  }
  if ((st.quake === 'legendary' && rank >= 4) || (st.quake === 'iconic' && rank >= 5)) { document.body.classList.remove('quake'); void document.body.offsetWidth; document.body.classList.add('quake'); }
}
export function packsAct(a: string, v: string | undefined): boolean {
  switch (a) {
    case 'buy': document.getElementById('opening')?.remove(); clearTimers(); buy(v!); return true;
    case 'openpending': document.getElementById('opening')?.remove(); clearTimers(); openPending(); return true;
    case 'rip': rip(); return true;
    case 'optap': tap(); return true;
    case 'claimdaily': if (claimDailyPack()) { document.getElementById('opening')?.remove(); clearTimers(); freePack('basic'); } return true;
    case 'opnext': if (OP && OP.mode === 'card' && OP.final) showSummary(); return true;
    case 'opskip': if (OP && OP.mode !== 'sum') skipToEnd(); return true;
    case 'opclose': document.getElementById('opening')?.remove(); clearTimers(); OP = null; setMusicOverride(null); onChange(); return true;
    case 'music': setMusic(!profile().music); if (OP) setMusicOverride(profile().music ? 'pack' : 'none'); onChange(); return true;
  }
  return false;
}
