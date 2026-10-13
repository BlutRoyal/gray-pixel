// Play: squad and coach, the story ladder, and the game on a half court (possession v2).
// Offense: tap a shooter, tap a zone (Rim, Mid, Three), play at most one card, Go. Defense: pick a scheme that guesses a zone,
// re-assign matchups, maybe double team, play at most one card. Momentum pays for big cards, double teams and subs.
import { CLASSES, CLS_KEYS, TIER_NAME, ballerRow, ri, seedRng, sneakerRow, type ClassKey, type Tier } from '../rules';
import {
  CLUTCH, CLUTCH_NAME, COACH_PERK, TUNING, FATIGUE, SCHEME_NAME, SQUAD_SIZE, ZONES, ZONE_NAME, ZONE_PTS, aiDefense, aiOffense, aiSubs,
  canClutch, canShoot, shooterSlots, chance, chanceNow, clutchBonusAt, clutchTap, costOf, cycleMatch, doSub, equip, fatigueOf, newGame, newSide, nextPossession, options, playBlock,
  playCard, resolve, setDT, starterIds, subBlock,
  type CBaller, type CGame, type Outcome, type Side, type Zone,
} from '../casual/engine';
import { POS_NAME, shoeOf, shoeText } from '../casual/skills';
import { STAGES, QUICK, cpuSide, type Stage } from '../casual/story';
import { addCard, countGame, profile, save, setFast } from './store';
import { MILESTONES, QUICK_LOSS, QUICK_WIN, STAR_TEXT, applyGame, claimMilestone, claimable, dayKey, milestoneText, starsFor, totalStars } from '../casual/progress';
import { cardLevels, deckIsAuto, myDeck } from './deck';
import { CLASS_ACC, ballerImgUrl, ccardFace, coachArt, esc, heroImg, reduced } from './views';
import { cardArt, isTrapCard } from './cardart';
import { COURT_POS, DRIVE_END, DRIVE_START, HOOP, LOB, collapseSpots, contestSpot, dunks, formationFor, glitchLevel, lerpPt, shotOrigin, type Pt } from './geometry';
import { badges, icon, mainIcon } from './icons';
import { GAME_TAGLINE, GLITCH_LORE, MENU_LINES, TITLE_LINES, pick } from './lore';
import { wordmarkSVG } from './wordmark';
import { getAudio, sfx } from './sfx';
import { speakerIcon } from './sound';
import { setTension, spikeTension } from './music';
import { teamHue } from './avatar';
import { ballArc, ballHop, banner, blockFx, burst, callout, centerOf, flash, freeThrow, fxPlaying, getSpeed, glitchEl, glitchSlam, handFx, play, pulse, setSpeed, skipped, swish, tip, whistleFx, type Step, type Tone, type XY } from './fx';
import { openPending } from './packs';
import { liteOn } from './lite';
import { RARITY_NAME, allCards, ccard, classLabel, effectTag, levelStep, whenLabel, type CCard } from '../casual/cards';
import { cardTier } from '../casual/packs';
import { ballerCardHTML, compareArrows, fatigueBar, miniStats, portrait, posBadge } from './bcard';
import { SCENES, EMPTY_CTX, type Ctx, type Snap } from './tutorialSteps';
import { setTutHost, tutActive, tutBegin, tutEnd, tutMark, tutNote, tutSync } from './tutorial';

type Phase = 'off' | 'def' | 'result';
/** `card` = the Baller card on screen (side, slot, bench or court); `cardView` = the hand card being read; `slot` = the squad slot whose sheet is open. */
interface UIState {
  phase: Phase; last: Outcome | null; squadOpen: boolean; slot: number | null; sqTab: 'b' | 's'; sqMore: number; subOpen: boolean; msg: string; dtPick: number; logSel: number;
  logOpen: boolean; logSeen: number; card: { side: Side; i: number; bench: boolean } | null; cardView: number | null;
}
const freshUI = (): UIState => ({ phase: 'off', last: null, squadOpen: false, slot: null, sqTab: 'b', sqMore: 0, subOpen: false, msg: '', dtPick: 0, logSel: -1, logOpen: false, logSeen: 0, card: null, cardView: null });
let G: CGame | null = null;
let stage: Stage | null = null;
let stageIdx = -1;
let UI: UIState = freshUI();
/** Momentum last drawn per side, so a bar can animate when it changes. */
let moShown: [number, number] = [-1, -1];
let logLen = 0;
let rerender: () => void = () => {};
let bucksChanged: () => void = () => {};
let goPlay: () => void = () => {};
export function initPlay(render: () => void, onBucks: () => void, toPlay: () => void = () => {}): void {
  rerender = render; bucksChanged = onBucks; goPlay = toPlay;
  setSpeed(profile().fast ? 0.45 : 1);
  setTutHost({ snap: tutSnap, ctx: tutCtx, busy: () => fxPlaying() || !!document.querySelector('.clutch-ov'), skip: skipTutorial, demo: () => previewPlay('g1') });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || tutActive()) return;
    if (UI.card) UI.card = null; else if (UI.cardView != null) UI.cardView = null; else if (UI.subOpen) UI.subOpen = false; else if (UI.logOpen && !logDocked()) UI.logOpen = false;
    else if (UI.slot != null) UI.slot = null; else return;
    rerender();
  });
  document.addEventListener('pointerover', (e) => {
    if ((e as PointerEvent).pointerType !== 'mouse') return;
    const li = (e.target as HTMLElement).closest<HTMLElement>('[data-logi]');
    if (li && G) selectLog(+li.dataset.logi!);
  });
}
export const inGame = (): boolean => !!G;

// ---------- squad ----------
const ownedBallerz = (): number[] => Object.keys(profile().cards).filter((k) => k.startsWith('b:')).map((k) => +k.slice(2)).filter((id) => ballerRow(id));
const ownedSneakerz = (): number[] => Object.keys(profile().cards).filter((k) => k.startsWith('s:')).map((k) => +k.slice(2)).filter((id) => sneakerRow(id));
const bestOf = (b: CBaller): number => Math.max(b.rim, b.mid, b.three) + b.def * 0.4;
/** New players get five starter Ballerz; a squad always holds five owned Ballerz (or all they own). */
export function ensureSquad(): void {
  const P = profile();
  if (ownedBallerz().length < SQUAD_SIZE) { seedRng((Date.now() ^ 0x5eed) >>> 0); for (const id of starterIds()) if (!ownedBallerz().includes(id) && ownedBallerz().length < SQUAD_SIZE) addCard('b:' + id, false); }
  const owned = ownedBallerz();
  P.squad = (P.squad || []).filter((id) => owned.includes(id)).slice(0, SQUAD_SIZE);
  if (P.squad.length < Math.min(SQUAD_SIZE, owned.length)) {
    const rest = owned.filter((id) => !P.squad.includes(id)).map((id) => equip([id], [], profile().levels)[0]).sort((a, b) => bestOf(b) - bestOf(a));
    for (const b of rest) { if (P.squad.length >= SQUAD_SIZE) break; P.squad.push(b.id); }
  }
  if (!P.shoes) P.shoes = {};
  const sn = ownedSneakerz();
  for (const [bid, sid] of Object.entries(P.shoes)) if (!P.squad.includes(+bid) || !sn.includes(sid)) delete P.shoes[bid];
  if (!CLS_KEYS.includes(P.coach as ClassKey)) P.coach = 'splash';
  save();
}
function autoShoes(): void {
  const P = profile();
  P.shoes = {};
  for (const b of equip(P.squad, ownedSneakerz(), P.levels)) if (b.sneakerId != null) P.shoes[b.id] = b.sneakerId;
  save();
}
const cardLevelLine = (c: CCard): string => { const lv = c.lv || 1; return `<p class="cp-lv">Card level ${lv} of 5${lv > 1 ? ` · effect +${Math.round((lv - 1) * levelStep(c.rarity) * 10) / 10}%` : ''}</p>`; };
const mySquad = (): CBaller[] => equip(profile().squad, Object.fromEntries(Object.entries(profile().shoes || {}).map(([k, v]) => [+k, v])), profile().levels);

// ---------- shared bits ----------
/** A segmented power bar. `p` is the chance; `read` (optional) marks how far it drops if the defense guesses right. */
function pbar(p: number, read?: number, cls = ''): string {
  return `<span class="pbar ${cls}" style="--p:${p}%"><i></i>${read != null ? `<em style="left:${read}%"></em>` : ''}</span>`;
}
const statLine = (b: CBaller): string => `<span>RIM <b>${b.rim}</b></span><span>MID <b>${b.mid}</b></span><span>3PT <b>${b.three}</b></span><span>PLY <b>${b.ply}</b></span><span>DEF <b>${b.def}</b></span>`;
const fatBadge = (b: CBaller): string => { const f = fatigueOf(b); return f > 0 ? `<i class="fatb${f >= 10 ? ' hi' : ''}" title="Tired: −${f}% on his shots, ${b.run} possessions on court">−${f}%</i>` : ''; };
/** A player on the court: small portrait (real image over a pixel avatar) with his # as a corner badge. Mine have a cyan frame, the opponent's a hot one. */
function token(b: CBaller, side: Side, i: number, opt: { off: boolean; sel?: boolean; fire?: boolean; shadow?: boolean; flag?: string; cool?: boolean; fresh?: boolean }): string {
  const tag = opt.off ? `${posBadge(b)}<span>${Math.max(b.rim, b.mid, b.three)}</span>${fatBadge(b)}` : `${posBadge(b)}<span>DEF ${b.def}</span>${fatBadge(b)}`;
  // cooldown ring (teaches the rotation rule) and stamina bar (teaches fatigue)
  const ring = b.hold > 0 ? `<span class="tok-cd${opt.fresh ? ' fresh' : ''}" style="--cd:${Math.round((b.hold / TUNING.rot) * 360)}deg" title="Cooling: ${b.hold} more attack${b.hold > 1 ? 's' : ''} before he can shoot again"><b>${b.hold}</b></span>` : '';
  const tired = fatigueOf(b), span = FATIGUE.start - 1 + Math.ceil(FATIGUE.cap / FATIGUE.step);
  const stam = `<span class="tok-fat${tired ? ' tired' : ''}" style="--f:${Math.min(100, Math.round((b.run / span) * 100))}%" title="Stamina: ${b.run} attacks on court. Tired after ${FATIGUE.start - 1}."></span>`;
  return `<button class="tok ${side === 0 ? 'me' : 'cpu'}${opt.sel ? ' sel' : ''}${opt.fire ? ' fire' : ''}${opt.flag ? ' flagged' : ''}${opt.cool ? ' cooling' : ''}" data-tok="${side}-${i}" data-a="baller" data-v="${side}:${i}:c" aria-label="${esc(b.name)}, ${POS_NAME[b.pos]}. Tap for his card." title="${esc(b.name)}: ${esc(b.skill.name)}. ${esc(b.skill.text)}">
    ${portrait(b, 'tok-img')}<i class="tok-num">${esc(b.name)}</i>
    ${ring}${opt.sel ? '<span class="tok-ball" aria-hidden="true"></span>' : ''}${opt.fire ? '<span class="tok-flame" aria-hidden="true">' + icon('fire') + '</span>' : ''}${opt.flag ? `<span class="tok-flag">${opt.flag}</span>` : opt.shadow ? '<span class="tok-flag">SHADOWED</span>' : ''}
    <span class="tok-tag">${tag}</span>${stam}</button>`;
}

// ---------- menu ----------
/** One squad slot: portrait, #, position, Rim / Mid / Three and his Sneaker. `slot` is 0..4 (0-2 on court, 3-4 bench). */
function slotTile(b: CBaller | undefined, slot: number, on: boolean): string {
  if (!b) return `<button class="sl empty${on ? ' on' : ''}" data-a="slot" data-v="${slot}"><span class="sl-plus">+</span><b>Empty</b><small>Tap to pick</small></button>`;
  return `<button class="sl${on ? ' on' : ''}" data-a="slot" data-v="${slot}" aria-label="${slot < 3 ? 'On court' : 'Bench'} slot ${slot + 1}: ${esc(b.name)}">
    ${portrait(b, 'sl-pt')}<span class="sl-t"><b>${esc(b.name)} ${posBadge(b)}</b>${miniStats(b)}<small class="sl-shoe${b.shoe ? '' : ' dim'}">${b.shoe ? `Sneaker +${b.shoe.bonus}%${b.shoe.jumpRim ? ` · Jump +${Math.round(b.shoe.jumpRim)}` : ''}` : 'No Sneaker'}</small></span>${b.level > 1 ? `<i class="lvtag">Lv ${b.level}</i>` : ''}</button>`;
}
function squadHTML(): string {
  const team = mySquad();
  return `<section class="panel">
    <div class="row between"><h2 class="h">Your squad</h2><button class="btn sm" data-a="squad">Edit squad</button></div>
    <div class="sq-mini">${team.map((b, i) => `<span class="sq-m">${portrait(b, 'sm')}<i>${i < 3 ? 'ON' : 'BN'}</i></span>`).join('')}</div>
    <p class="dim small">Three start, two wait on the bench. Subs cost ${TUNING.subCost} Momentum. Starters tire after ${FATIGUE.start - 1} attacks on court.</p>
  </section>`;
}
const starsTxt = (n: number): string => '★'.repeat(n) + '☆'.repeat(3 - n);
function ladderHTML(): string {
  const P = profile(), cl = claimable(P);
  const dailyDone = P.daily.day === dayKey();
  return `<section class="panel"><div class="row between"><h2 class="h">Story</h2><span class="dim small">${P.story} / ${STAGES.length} cleared · ★ ${totalStars(P)} / ${STAGES.length * 3}</span></div>
    <p class="dim small">${dailyDone ? `Daily first-win bonus collected (streak ${P.daily.streak} day${P.daily.streak > 1 ? 's' : ''}).` : `<b>Daily bonus ready:</b> your first win today pays extra Bucks and shards${P.daily.streak ? ` (streak ${P.daily.streak})` : ''}.`}</p>
    ${P.pending.length ? `<div class="row between pend"><span><b>${P.pending.length}</b> unopened pack${P.pending.length > 1 ? 's' : ''} from rewards</span><button class="btn go" data-a="openpending">Open</button></div>` : ''}
    <ol class="ladder">${STAGES.map((s, i) => {
      const locked = i > P.story, cleared = i < P.story, stars = P.stars[i] || 0;
      return `<li class="rung${locked ? ' locked' : ''}${cleared ? ' cleared' : ''}${i === P.story ? ' current' : ''}${s.boss ? ' boss' : ''}">
        <span class="rung-n">${i + 1}</span>${heroImg(s.coach)}
        <span class="rung-body"><b>${esc(s.name)}</b>${s.boss ? ` <i class="bosstag">BOSS · ${esc(s.boss.name)}</i>` : ''}<small>${esc(s.place)} · Coach ${esc(CLASSES[s.coach].hero)}</small><small class="dim">${esc(s.blurb)}</small>
          <small class="stars" title="${STAR_TEXT.map((t, k) => `${k < stars ? '★' : '☆'} ${t}`).join(' · ')}">${starsTxt(stars)}</small></span>
        <span class="rung-end"><small>${cleared ? `Replay ${Math.round(s.reward * 0.4)} B$` : `Win ${s.reward} B$ + ${s.pack === 'pro' ? 'Pro' : 'Street'} Pack${s.boss ? ` + ${s.boss.pack === 'icon' ? 'Icon' : 'Pro'} Pack` : ''}`}</small>
        ${locked ? '<span class="lock">LOCKED</span>' : `<button class="btn ${i === P.story ? 'go' : ''} sm" data-a="story" data-v="${i}">${cleared ? 'Replay' : 'Play'}</button>`}</span></li>`;
    }).join('')}</ol></section>
  <section class="panel"><h2 class="h">Star rewards</h2>
    <p class="dim small">Stars per court: ${STAR_TEXT.map((t, k) => `${'★'.repeat(k + 1)} ${t}`).join(' · ')}. Win a court again to earn the stars you missed.</p>
    <div class="ms-row">${MILESTONES.map((m, i) => { const got = P.claimed.includes(i), ready = cl.includes(i);
      return `<div class="ms${got ? ' got' : ''}${ready ? ' ready' : ''}"><b>★ ${m.stars}</b><small>${esc(milestoneText(m))}</small>${got ? '<em>Claimed</em>' : ready ? `<button class="btn sm go" data-a="claimms" data-v="${i}">Claim</button>` : `<em class="dim">${m.stars - totalStars(P)} to go</em>`}</div>`; }).join('')}</div></section>
  <section class="panel row between"><span><b>Quick Play</b><br><span class="dim small">A random coach at mid-ladder strength. Win ${QUICK_WIN} Bucks, loss ${QUICK_LOSS}.</span></span><button class="btn" data-a="quick">Quick Play</button></section>`;
}
const ENHN = ['', 'Ankle Breaker', 'Drive the Lane', 'Stopping on a Dime', 'Bullseye'];
/** The bottom sheet for one squad slot: owned Ballerz or owned Sneakerz to pick from. */
function slotSheet(slot: number): string {
  const P = profile(), cur = mySquad()[slot], tab = cur ? UI.sqTab : 'b', lim = 40 + UI.sqMore;
  let list = '', more = 0;
  if (tab === 'b') {
    const all = ownedBallerz().map((id) => equip([id], [], profile().levels)[0]).sort((a, b) => (b.id === cur?.id ? 1 : 0) - (a.id === cur?.id ? 1 : 0) || bestOf(b) - bestOf(a));
    more = Math.max(0, all.length - lim);
    list = all.slice(0, lim).map((b) => {
      const at = P.squad.indexOf(b.id);
      return `<button class="sqp-row${b.id === cur?.id ? ' on' : ''}" data-a="slotset" data-v="${b.id}">${portrait(b, 'sm')}<span class="sqp-name"><b>${esc(b.name)} ${posBadge(b)}${b.level > 1 ? ` <i class="lvtag">Lv ${b.level}</i>` : ''}</b><small>${esc(b.skill.name)} · DEF ${b.def}</small>${miniStats(b)}</span><span class="sqp-at">${b.id === cur?.id ? 'HERE' : at >= 0 ? (at < 3 ? 'ON COURT' : 'BENCH') + ' · swap' : ''}</span></button>`;
    }).join('') || '<p class="dim small">You own no Ballerz yet.</p>';
  } else {
    const all = ownedSneakerz().map((id) => ({ id, s: shoeOf(sneakerRow(id))! })).sort((a, b) => (b.s.bonus + b.s.jumpRim * 0.5 + (b.s.enh ? 1 : 0)) - (a.s.bonus + a.s.jumpRim * 0.5 + (a.s.enh ? 1 : 0)));
    more = Math.max(0, all.length - lim);
    list = `<button class="sqp-row${cur && !cur.sneakerId ? ' on' : ''}" data-a="shoeset" data-v="${cur?.id}:0"><span class="sqp-name"><b>No Sneaker</b><small>Bare feet, no bonus</small></span></button>`
      + (all.slice(0, lim).map(({ id, s }) => { const used = Object.entries(P.shoes).find(([, v]) => v === id); return `<button class="sqp-row${cur?.sneakerId === id ? ' on' : ''}" data-a="shoeset" data-v="${cur?.id}:${id}"><span class="sqp-name"><b>Sneaker #${id}</b><small>${esc(shoeText(s))}${s.enh ? ' · ' + esc(ENHN[s.enh]) : ''}</small></span><span class="sqp-at">${cur?.sneakerId === id ? 'WORN' : used ? 'worn by #' + used[0] : ''}</span></button>`; }).join('') || '<p class="dim small">You own no Sneakerz yet. Sneaker Boxes in Packs have them.</p>');
  }
  return `<div class="overlay sheetwrap" id="slotSheet" data-a="slotclose"><div class="sheet" data-a="noop" role="dialog" aria-modal="true" aria-label="Pick for slot ${slot + 1}">
    <div class="sheet-h"><b>${slot < 3 ? 'On court' : 'Bench'} · slot ${slot + 1}${cur ? ` · ${esc(cur.name)}` : ''}</b><button class="btn sm ghost" data-a="slotclose" aria-label="Close">Close</button></div>
    <div class="chips-row"><button class="chipbtn${tab === 'b' ? ' on' : ''}" data-a="sqtab" data-v="b">Ballerz (${ownedBallerz().length})</button><button class="chipbtn${tab === 's' ? ' on' : ''}" data-a="sqtab" data-v="s" ${cur ? '' : 'disabled'}>Sneakerz (${ownedSneakerz().length})</button></div>
    ${tab === 's' ? '<p class="dim small">Rarity adds accuracy to every shot, Jump adds up to +8% at the Rim.</p>' : ''}
    <div class="sheet-body sqp-list">${list}${more ? `<button class="btn sm" data-a="sqmore">Show ${Math.min(40, more)} more</button>` : ''}</div></div></div>`;
}
function squadPickerHTML(): string {
  const P = profile(), team = mySquad();
  const full = P.squad.length >= Math.min(SQUAD_SIZE, ownedBallerz().length);
  const t = (i: number): string => slotTile(team[i], i, UI.slot === i);
  return `<div class="overlay sqscreen" id="squadPick"><div class="sqs" role="dialog" aria-modal="true" aria-labelledby="sqph">
    <div class="sqs-head"><h2 id="sqph" class="h">Choose your squad</h2><span class="dim small">${P.squad.length} / ${SQUAD_SIZE}</span></div>
    <div class="sqs-board">
      <div class="sqs-grp"><div class="sqs-lab">ON COURT <small>they start</small></div><div class="sqs-row c3">${t(0)}${t(1)}${t(2)}</div></div>
      <div class="sqs-grp"><div class="sqs-lab">BENCH <small>${TUNING.subCost} Momentum to sub in</small></div><div class="sqs-row c2">${t(3)}${t(4)}<div class="sqs-aux"><button class="btn sm" data-a="autoshoes">Auto-equip best Sneakerz</button></div></div></div>
    </div>
    <p class="dim small sqs-tip">Tap a slot to pick a Baller or his Sneaker.${full ? '' : ' Fill every slot to continue.'}</p>
    <div class="sqs-foot"><button class="btn go big" data-a="sqdone" ${full ? '' : 'disabled'}>Done</button></div>
    ${UI.slot != null ? slotSheet(UI.slot) : ''}</div></div>`;
}
const overlays = (): string => (UI.squadOpen ? squadPickerHTML() : '');
/** The Story tab: squad, the ladder and star rewards. */
export function storyHTML(): string {
  ensureSquad();
  return `<p class="lore-line">${esc(MENU_LINES.story)}</p>` + autoDeckNote() + squadHTML() + ladderHTML() + overlays();
}
let titleSeed = Date.now();
/** The title screen: logo, the six Coaches as the hero of the screen, and the main menu. */
/** A note before a game starts when no valid hand-built deck exists. */
const autoDeckNote = (): string => (deckIsAuto(profile().coach as ClassKey) ? `<p class="dk-note pre" id="autoDeckNote"><b>Using an auto deck</b> - build one in <button class="lnk" data-a="tab" data-v="deck">Deck</button>.</p>` : '');
function titleHTML(): string {
  ensureSquad();
  const P = profile(), cur = (CLS_KEYS.includes(P.coach as ClassKey) ? P.coach : 'splash') as ClassKey, d = CLASSES[cur];
  const team = mySquad();
  const next = Math.min(P.story, STAGES.length - 1);
  const menu: [string, string, string][] = [['Play', 'quick', 'Quick match'], ['Story', 'tab:story', 'Eight courts'], ['Packs', 'tab:packs', 'Render cards'], ['Collection', 'tab:collection', 'Your cards'], ['Deck', 'tab:deck', 'Build a deck'], ['How', 'tab:how', 'Rules'], ['Lab', 'tab:lab', 'Dev tools']];
  const skyline = Array.from({ length: 26 }, (_x, i) => { const h = 18 + ((i * 37) % 41), w = 14 + ((i * 17) % 20); return `<i style="--h:${h}%;--w:${w}px;--d:${(i * 0.37).toFixed(2)}s"></i>`; }).join('');
  return `<section class="title" style="--acc:${CLASS_ACC[cur]}">
    <div class="tt-sky" aria-hidden="true">${skyline}</div>
    <header class="tt-head">
      <h1 class="tt-wm"><span class="sr-only">Gray Pixel</span>${wordmarkSVG('wm-title')}</h1>
      <p class="tt-tag">${esc(GAME_TAGLINE)}</p>
      <p class="tt-lore">${esc(pick(TITLE_LINES, titleSeed))}</p>
    </header>
    <div class="hero-stage" aria-live="polite">
      <div class="hs-art">${coachArt(cur)}<span class="hs-id">${d.heroId ? '#' + d.heroId : ''}</span><i class="hs-c tl"></i><i class="hs-c tr"></i><i class="hs-c bl"></i><i class="hs-c br"></i></div>
      <div class="hs-info">
        <span class="hs-kick">${esc(MENU_LINES.coachPick)}</span>
        <h2>${esc(d.hero)}</h2><p class="hs-cls">${esc(d.name)}</p>
        <p class="hs-perk">${esc(COACH_PERK[cur])}</p>
        <p class="hs-clutch">Clutch shot <b>${esc(CLUTCH_NAME[cur])}</b></p>
        ${autoDeckNote()}
        <div class="hs-cta"><button class="btn go big" data-a="quick">Quick Play</button><button class="btn big" data-a="story" data-v="${next}">${P.story ? 'Continue story' : 'Start story'}</button></div>
      </div>
    </div>
    <div class="coach-strip" role="radiogroup" aria-label="Choose your coach">${CLS_KEYS.map((k) => `<button class="cs-pick${k === cur ? ' on' : ''}" style="--acc:${CLASS_ACC[k]}" role="radio" aria-checked="${k === cur}" data-a="coach" data-v="${k}">${coachArt(k)}<b>${esc(CLASSES[k].hero)}</b><small>${esc(CLASSES[k].name)}</small></button>`).join('')}</div>
    <div class="tt-squad"><span class="dim small">${esc(MENU_LINES.squad)}</span><span class="tt-faces">${team.map((b) => portrait(b, 'tok-img sm')).join('')}</span><button class="btn sm" data-a="squad">Edit squad</button></div>
    <nav class="tt-menu" aria-label="Menu">${menu.map(([t, a, sub]) => `<button class="tt-btn${a === 'quick' ? ' main' : ''}" ${a.startsWith('tab:') ? `data-a="tab" data-v="${a.slice(4)}"` : `data-a="${a}"`}><b>${t}</b><small>${sub}</small></button>`).join('')}</nav>
    <p class="tt-tut"><button class="btn sm ghost" data-a="tutorial">${P.tut.state === 'new' || P.tut.state === 'skipped' ? 'New here? Play the guided game' : 'Replay tutorial'}</button></p>
  </section>`;
}

// ---------- game ----------
const ZONE_LAB: Record<Zone, { x: number; y: number; t: string }> = { rim: { x: 50, y: 25, t: 'RIM' }, mid: { x: 24, y: 28, t: 'MID' }, three: { x: 50, y: 68, t: 'THREE' } };
function courtHTML(): string {
  const g = G!, P = g.poss, off = P.off, def = (1 - off) as Side;
  const O = g.sides[off], D = g.sides[def];
  const myOff = off === 0 && UI.phase === 'off';
  const shotZone = P.zone && UI.phase !== 'def' ? ` z-${P.zone}` : '';
  const guess = UI.phase === 'def' && P.guard ? ` g-${P.guard}` : '';
  const slots = shooterSlots(g, off);
  const fresh = UI.phase === 'result';
  const toks = O.team.map((b, i) => {
    const [x, y] = COURT_POS.off[i];
    const flag = P.dt && !P.offCard?.fx.iso ? (P.dt.mark === i ? 'DOUBLE TEAMED' : P.dt.open === i ? 'OPEN' : '') : '';
    return `<div class="spot" data-spot="${off}-${i}" style="left:${x}%;top:${y}%">${token(b, off, i, { off: true, sel: P.shooter === i && UI.phase !== 'def', cool: !canShoot(b) && !(myOff && slots.includes(i)), fire: b.streak >= 2, shadow: false, flag, fresh: fresh && b.hold === TUNING.rot })}</div>`;
  }).join('') + D.team.map((b, i) => {
    const [x, y] = COURT_POS.def[i];
    return `<div class="spot" data-spot="${def}-${i}" style="left:${x}%;top:${y}%">${token(b, def, i, { off: false, fire: b.streak >= 2, cool: !canShoot(b) })}</div>`;
  }).join('');
  // man-to-man: one thin line from each defender to the attacker he guards; a double team draws two lines onto the marked man and none to the open one
  const dtm = P.dt && !P.offCard?.fx.iso ? P.dt : null;
  const lines = O.team.map((_b, i) => {
    const a = COURT_POS.off[i];
    let ds = [D.match[i]];
    if (dtm) {
      if (i === dtm.mark && dtm.open >= 0 && D.match[dtm.open] !== D.match[i]) ds = [D.match[i], D.match[dtm.open]];
      else if (i === dtm.open) ds = [];
    }
    return ds.map((d, k) => { const z = COURT_POS.def[d]; return `<line class="c-match s${def}${k ? ' dbl' : ''}" data-ds="${def}" data-di="${d}" data-os="${off}" data-oi="${i}" x1="${z[0]}" y1="${z[1] + 5}" x2="${a[0]}" y2="${a[1] - 6}"/>`; }).join('')
      + (dtm && i === dtm.open ? `<circle class="c-open" data-os="${off}" data-oi="${i}" cx="${a[0]}" cy="${a[1] - 6}" r="1.6"/>` : '');
  }).join('');
  const cpuTraps = g.sides[1].traps.map(() => `<span class="trap-back" title="A face-down Trap. It fires on one of your shots later.">${icon('trap')}TRAP</span>`).join('');
  const myTraps = g.sides[0].traps.map((t) => `<span class="trap-mine" title="${esc(t.text)}">${icon('trap')}${esc(t.name)}</span>`).join('');
  const grid = Array.from({ length: 9 }, (_x, i) => `<line x1="${(i + 1) * 10}" y1="0" x2="${(i + 1) * 10}" y2="100"/><line x1="0" y1="${(i + 1) * 10}" x2="100" y2="${(i + 1) * 10}"/>`).join('');
  const zlab = (z: Zone, extra = ''): string => { const l = ZONE_LAB[z]; return `<span class="zlab zl-${z}${extra}" style="left:${l.x}%;top:${l.y}%">${l.t}<b>${ZONE_PTS[z]}</b></span>`; };
  return `<div class="court-box"><div class="court-wrap${shotZone}${guess}">
    <svg class="court-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path class="zf zf-three" d="M0 0H7V24C7 78 93 78 93 24V0H100V100H0Z"/><path class="zf zf-mid" d="M7 0V24C7 78 93 78 93 24V0Z"/><path class="zf zf-rim" d="M35 0H65V34Q50 41 35 34Z"/>
      <g class="c-grid">${grid}</g>
      <path class="c-paint" d="M35 0V36H65V0"/><path class="c-arc" d="M7 0V24C7 78 93 78 93 24V0"/><path class="c-ft" d="M35 36Q50 52 65 36"/>
      <path class="c-ra" d="M42 7Q50 21 58 7"/><line class="c-base" x1="0" y1="0.4" x2="100" y2="0.4"/><path class="c-mid" d="M30 100Q50 86 70 100"/>${lines}
    </svg>
    ${zlab('rim')}${zlab('mid')}<span class="zlab zl-mid zr" style="left:76%;top:28%">MID<b>${ZONE_PTS.mid}</b></span>${zlab('three')}
    <div class="hoop" id="hoop" aria-hidden="true"><span class="board"></span><span class="rim"></span><span class="net"></span></div>
    <div class="court-traps"><span>${cpuTraps}</span><span>${myTraps}</span></div>
    <div class="court-scan" aria-hidden="true"></div>
    <span class="court-key" aria-hidden="true"><i class="k-me"></i>You<i class="k-cpu"></i>CPU</span>
    ${toks}</div></div>`;
}
/** Momentum bar. Segments that appeared since the last draw pop in, segments that were spent flash out (teaches where the bar goes). */
const moBar = (n: number, side: Side = 0): string => {
  const prev = moShown[side];
  return `<span class="mo${n >= TUNING.moMax ? ' full' : ''}" data-mo="${side}" title="Momentum ${n} / ${TUNING.moMax}">${Array.from({ length: TUNING.moMax }, (_x, i) => `<i class="${i < n ? 'on' : ''}${prev >= 0 && i < n && i >= prev ? ' gain' : ''}${prev >= 0 && i >= n && i < prev ? ' lose' : ''}"></i>`).join('')}</span>`;
};
function jumboHTML(): string {
  const g = G!, Y = g.sides[0], C = g.sides[1];
  const unseen = g.feed.length > UI.logSeen;
  return `<div class="jumbo">
    <div class="jb-side">${heroImg(Y.coach)}<div><span class="jb-lab">YOU</span><span class="jb-num" id="s0">${Y.score}</span>${moBar(Y.mo, 0)}</div></div>
    <div class="jb-mid"><span class="jb-poss">${g.poss.off === 0 ? 'YOUR BALL' : 'CPU BALL'}</span><span class="dim small">to ${TUNING.winTo} · #${g.n}</span><span class="jb-btns">
      <button class="hb${unseen ? ' dot' : ''}" data-a="log" aria-label="Play by play" title="Play by play">${icon('card')}<small>LOG</small></button>
      <button class="hb${profile().fast ? ' on' : ''}" data-a="fast" aria-pressed="${profile().fast}" title="Fast possessions: the shot animation takes about a second">${icon('clutch')}<small>FAST</small></button>
      <button class="hb${getAudio().mute ? ' muted' : ''}" data-a="sound" aria-label="Sound settings" title="Sound settings">${speakerIcon(getAudio().mute)}<small>SOUND</small></button>
      <button class="hb" data-a="quit" aria-label="Quit game" title="Quit">${icon('miss')}<small>QUIT</small></button></span></div>
    <div class="jb-side cpu"><div><span class="jb-lab">${esc(stage ? stage.name.toUpperCase() : 'CPU')}</span><span class="jb-num" id="s1">${C.score}</span>${moBar(C.mo, 1)}</div>${heroImg(C.coach)}</div></div>`;
}
const steps4 = (cur: 1 | 2 | 3 | 4, done: boolean[]): string => ['Shooter', 'Zone', 'Card', 'GO'].map((t, i) => `<span class="${done[i] ? 'done' : ''}${cur === i + 1 ? ' next' : ''}"><b>${i + 1}</b>${t}</span>`).join('');
function zoneBtn(z: Zone): string {
  const g = G!, P = g.poss;
  const open = chanceNow(g, P.shooter, z, null), read = chanceNow(g, P.shooter, z, z);
  const iso = !!P.offCard?.fx.iso, locked = iso && z !== 'rim';
  const tip = open.parts.map(([n, v]) => `${n} ${v > 0 ? '+' : ''}${v}`).join(', ');
  return `<button class="shotbtn${P.zone === z ? ' on' : ''}" data-a="zone" data-v="${z}" ${locked ? 'disabled' : ''} title="${esc('Base ' + open.base + '%: ' + tip)}"><span class="sb-top"><b>${ZONE_NAME[z]}</b><em>${ZONE_PTS[z] + (P.offCard?.fx.worth && (!P.offCard.fx.only || P.offCard.fx.only.includes(z)) ? P.offCard.fx.worth : 0)} PTS</em></span>
    <span class="sb-p">${open.p}<i>%</i></span>${pbar(open.p, read.p)}
    <small>${read.p < open.p ? `${read.p}% if read` : 'can\'t be read'}</small></button>`;
}
const cardChip = (c: { name: string; lv?: number } | null): string => (c ? `<span class="chip card-chip">${icon('card')}${esc(c.name)}${c.lv ? ` <i>Lv ${c.lv}</i>` : ''}</span>` : '');
function offPanel(): string {
  const g = G!, P = g.poss, S = g.sides[0];
  const shooter = S.team[P.shooter];
  const slots = shooterSlots(g, 0);
  const dtLine = P.dt ? `<div class="dt-note"><b>Double team!</b> ${esc(S.team[P.dt.mark].name)} can't shoot${P.offCard?.fx.iso ? ' (Iso ignores it)' : ''}. ${P.dt.open >= 0 ? `${esc(S.team[P.dt.open].name)} is open.` : ''}</div>` : '';
  const ch = P.zone ? chanceNow(g, P.shooter, P.zone, null) : null;
  const passer = ch?.passer != null ? S.team[ch.passer] : null;
  const scouted = P.offCard?.fx.scout ? `<span class="chip good">They run ${P.guard ? SCHEME_NAME[P.guard] : '?'}</span>` : '';
  const chips = S.team.map((b, i) => {
    const ok = slots.includes(i), st = P.dt && P.dt.mark === i && !P.offCard?.fx.iso ? 'double teamed' : ok ? (canShoot(b) ? 'ready' : 'pass') : `cooling ${b.hold}`;
    const pc = P.zone ? chanceNow(g, i, P.zone, null).p : null;
    return `<div class="pk${P.shooter === i ? ' on' : ''}${ok ? '' : ' off'}"><button class="pk-pt" data-a="baller" data-v="0:${i}:s" aria-label="Card of ${esc(b.name)}">${portrait(b)}</button>
      <button class="pk-main" data-a="shooter" data-v="${i}" ${ok ? '' : 'disabled'} title="${ok ? '' : 'Each Baller shoots once per ' + TUNING.rot + ' attacks. A pass card (Kick Out, Hand-Off, Swing Pass, Skip Pass) or a sub gets around it.'}">
        <b>${esc(b.name)} ${posBadge(b)}</b>${miniStats(b, P.zone)}<i class="st">${st}</i>${pc != null ? `<em class="pk-ch">${pc}%</em>` : ''}</button></div>`;
  }).join('');
  return `<div class="panel-g ab">
    <div class="ab-steps">${steps4(!P.zone ? 2 : !P.offCard ? 3 : 4, [true, !!P.zone, !!P.offCard, false])}</div>
    ${UI.msg ? `<div class="msg">${esc(UI.msg)}</div>` : ''}${dtLine}
    <div class="picker" role="group" aria-label="Shooter">${chips}</div>
    <div class="shot-trio">${ZONES.map(zoneBtn).join('')}</div>
    <div class="pg-info dim small">${scouted}${P.zone ? `${esc(shooter.name)}: ` : ''}${passer ? `pass from ${esc(passer.name)} (PLY ${passer.ply}). ` : P.offCard?.fx.iso || P.offCard?.fx.fixed ? 'no pass on this one. ' : ''}<span title="${esc(shooter.skill.text)}">${esc(shooter.skill.name)}.</span>${fatigueOf(shooter) ? ` Tired −${fatigueOf(shooter)}%.` : ''}</div>
    <div class="pg-foot">${P.offCard ? `<span class="played">${cardChip(P.offCard)}</span>` : '<span class="dim small played">Card: tap one below (optional)</span>'}
      <button class="btn sm" data-a="subs">Subs</button>
      ${canClutch(g, 0) ? `<button class="btn hero${P.clutch ? ' on' : ''}" data-a="clutch">${P.clutch ? 'CLUTCH ON' : 'Clutch'}</button>` : ''}
      <button class="btn go" data-a="shoot" ${P.zone ? '' : 'disabled'}>GO</button></div></div>`;
}
function defPanel(): string {
  const g = G!, P = g.poss, Y = g.sides[0], C = g.sides[1];
  const threat = (z: Zone) => Math.max(...C.team.map((_b, i) => chance(g, 1, i, z, { guard: null, card: P.defCard, dcard: null, extra: [], dt: P.dt }).p));
  const scheme = (z: Zone) => `<button class="shotbtn${P.guard === z ? ' on' : ''}" data-a="scheme" data-v="${z}"><span class="sb-top"><b>${SCHEME_NAME[z]}</b><em>${ZONE_NAME[z].toUpperCase()}</em></span><span class="sb-p">${threat(z)}<i>%</i></span>${pbar(threat(z), undefined, 'threat')}<small>their best look at ${ZONE_NAME[z]}</small></button>`;
  const mx = C.team.map((o, i) => {
    const me = Y.team[Y.match[i]], dt = P.dt?.mark === i;
    return `<div class="mx${dt ? ' dt' : ''}"><div class="mx-top"><button class="mx-o" data-a="baller" data-v="1:${i}:m" aria-label="Card of ${esc(o.name)}">${portrait(o, 'sm')}<b>${esc(o.name)}</b>${posBadge(o)}</button>
        <button class="mx-dt${dt ? ' on' : ''}" data-a="dt" data-v="${i}" title="Double team ${esc(o.name)}: he can't shoot, but his teammate is open. Costs ${TUNING.dtCost} Momentum." aria-label="Double team ${esc(o.name)}, ${TUNING.dtCost} Momentum">2×<small>${dt ? 'ON' : TUNING.dtCost}</small></button></div>
      <button class="mx-d" data-a="match" data-v="${i}" title="Tap to change who guards him">${portrait(me, 'sm')}<span><b>${esc(me.name)}</b><small>DEF ${me.def}</small></span></button></div>`;
  }).join('');
  return `<div class="panel-g ab">
    <div class="ab-steps">${steps4(!P.guard ? 1 : !P.defCard ? 3 : 4, [!!P.guard, true, !!P.defCard, false]).replace('>Shooter<', '>Guess<').replace('>Zone<', '>Matchups<')}</div>
    ${UI.msg ? `<div class="msg">${esc(UI.msg)}</div>` : ''}
    <div class="shot-trio">${ZONES.map(scheme).join('')}</div>
    <div class="matches"><div class="mx-cap dim small">Man-to-man: top = their Baller (2× double team), below = who guards him. Tap a defender to swap.${P.dt ? ` ${esc(C.team[P.dt.open]?.name || '')} is left open.` : ''}</div><div class="mx-row">${mx}</div></div>
    <div class="pg-foot">${P.defCard ? `<span class="played">${cardChip(P.defCard)}</span>` : `<span class="dim small played">${esc(CLASSES[C.coach].hero)} likes ${ZONE_NAME[options(g, 1)[0].zone]}. Card optional.</span>`}
      <button class="btn sm" data-a="subs">Subs</button>
      <button class="btn go" data-a="lock" ${P.guard ? '' : 'disabled'}>Lock in</button></div></div>`;
}
function resultPanel(): string {
  const g = G!, o = UI.last!, mine = o.side === 0;
  const S = g.sides[o.side];
  const head = o.turnover ? 'Turnover' : o.made ? `${o.putback ? 'Putback' : 'Bucket'} +${o.pts}` : o.blocked ? 'Blocked' : 'Miss';
  const tone = o.turnover ? (mine ? 'bad' : 'good') : o.made === mine ? 'good' : 'bad';
  const tags = [
    o.andOne ? '<span class="chip good a1">AND ONE +1</span>' : '',
    o.guard && !o.iso ? `<span class="chip ${o.read ? (mine ? 'bad' : 'good') : ''}">${SCHEME_NAME[o.guard]}${o.read ? ': READ' : ': wrong guess'}</span>` : '',
    o.iso ? '<span class="chip trait">ISO</span>' : '',
    o.dt ? '<span class="chip trap">Double team</span>' : '',
    ...o.traps.map((t) => `<span class="chip trap">Trap: ${esc(t.name)}</span>`),
    o.countered ? `<span class="chip bad">Cancelled: ${esc(o.countered)}</span>` : '',
    o.clutch ? `<span class="chip trait">Clutch +${o.clutchBonus}%</span>` : '',
    o.fireOn ? '<span class="chip good">ON FIRE</span>' : '', o.fireOff ? '<span class="chip">Fire out</span>' : '',
    o.extra ? '<span class="chip good">Extra possession</span>' : '',
    o.label ? `<span class="chip glitch l-${o.label.replace(' ', '-')}">${o.label}</span>` : '',
    o.inhuman ? '<span class="chip glitch l-INHUMAN">INHUMAN</span>' : '',
  ].join('');
  return `<div class="panel-g ab result ${o.turnover || !o.made ? 'miss' : 'make'}">
    <div class="pg-head"><b class="res-${tone}">${mine ? 'You' : 'CPU'}: ${head}</b> <span class="dim">${o.turnover ? esc(o.turnover) : `${esc(S.team[o.shooter].name)}, ${ZONE_NAME[o.zone]}`}</span></div>
    ${o.turnover ? '' : `<div class="res-bar">${pbar(o.p, undefined, 'final')}<span class="dim small">${o.p}% shot</span></div>`}
    <div class="tags">${tags}</div>
    <ul class="why">${o.notes.slice(0, 3).map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
    <div class="pg-foot"><button class="btn sm" data-a="log">All the numbers</button><button class="btn go" data-a="next" id="nextBtn">${g.over ? 'Final whistle' : 'Next'}</button></div></div>`;
}
// ---------- play-by-play ----------
function feedIcon(l: { kind: string; side: Side; n: number }): { svg: string; tone: string } {
  const g = G!;
  if (l.kind === 'sub') return { svg: icon('sub'), tone: 'plain' };
  const h = g.hist.find((x) => x.n === l.n && x.side === l.side);
  if (!h) return { svg: icon('ball'), tone: 'plain' };
  const m = mainIcon(h.outcome);
  return { svg: icon(m.name), tone: m.tone };
}
const cardByName = (name: string | null) => (name ? allCards().find((c) => c.name === name) : undefined);
/** Everything that went into one play: odds breakdown, cards, traps (with the explanation text) and extras. */
function inspectHTML(idx: number): string {
  const g = G!, l = g.feed[idx];
  if (!l) return '<p class="dim small">Tap a line to see what went into it.</p>';
  const h = l.kind === 'shot' ? g.hist.find((x) => x.n === l.n && x.side === l.side) : undefined;
  const o = h?.outcome;
  const who = l.side === 0 ? 'You' : 'CPU';
  if (!o) return `<div class="ins-h"><span class="ins-ic">${icon('sub')}</span><b>${esc(l.text)}</b></div><ul class="why">${l.detail.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>`;
  const m = mainIcon(o);
  const parts = o.parts.length ? o.parts.map(([n, v]) => `<li class="${v >= 0 ? 'up' : 'dn'}"><span>${esc(n)}</span><i style="--w:${Math.min(100, Math.abs(v) * 5)}%"></i><b>${v > 0 ? '+' : ''}${v}%</b></li>`).join('') : '<li class="dim"><span>No extra modifiers</span></li>';
  const oc = cardByName(o.offCard), dc = cardByName(o.defCard);
  const cardRow = (label: string, name: string | null, c?: { text: string }, cancelled = false) => name ? `<div class="ins-card${cancelled ? ' x' : ''}"><em>${label}</em><b>${esc(name)}</b>${c ? `<span>${esc(c.text)}</span>` : ''}${cancelled ? '<span>Cancelled before it counted.</span>' : ''}</div>` : '';
  const cards = cardRow(`${who} card`, o.countered ? null : o.offCard, oc) + (o.countered ? cardRow(`${who} card`, o.countered, cardByName(o.countered), true) : '') + cardRow(`${l.side === 0 ? 'CPU' : 'You'} card`, o.defCard, dc);
  const trapHdr = l.side === 0 ? 'Opponent trap fired' : 'Your trap fired';
  const traps = o.traps.length ? `<h4>${trapHdr}</h4>${o.traps.map((t) => `<div class="ins-trap"><span class="ins-ic">${icon('trap')}</span><div><b>${esc(t.name)}</b><span>${esc(t.text)}</span></div></div>`).join('')}` : '';
  const tags = [
    o.andOne ? '<span class="chip good a1">AND ONE</span>' : '',
    o.label ? `<span class="chip glitch l-${o.label.replace(' ', '-')}">${o.label}${o.inhuman ? ' · ' + (GLITCH_LORE.INHUMAN.alias || 'INHUMAN') : ''}</span>` : '',
    o.guard && !o.iso ? `<span class="chip ${o.read ? (l.side === 0 ? 'bad' : 'good') : ''}">${SCHEME_NAME[o.guard]}: ${o.read ? 'READ' : 'wrong guess'}</span>` : '', o.iso ? '<span class="chip trait">ISO</span>' : '',
    o.dt ? '<span class="chip trap">Double team</span>' : '', o.clutch ? `<span class="chip trait">Clutch +${o.clutchBonus}%</span>` : '', o.fireOn ? '<span class="chip good">ON FIRE</span>' : '',
  ].join('');
  const a1 = o.a1p ? `<p class="dim small">And-one chance on this Rim make: ${Math.round(o.a1p)}% (base ${TUNING.a1Base}%, dunkers and Bigs more, strong defenders less, +${TUNING.a1Beat}% when the guess was wrong).</p>` : '';
  return `<div class="ins-h"><span class="ins-ic t-${m.tone}">${icon(m.name)}</span><b>${esc(l.text)}</b></div>
    ${o.turnover ? '' : `<h4>Shot chance</h4><div class="ins-p">${pbar(o.p, undefined, 'final')}<b>${o.p}%</b></div><ul class="ins-parts">${parts}</ul>
    <p class="dim small">Base chance comes from his rating vs the defender. The lines above are what moved it${o.read ? '; a right guess by the defense then multiplied it down' : ''}.</p>${a1}`}
    ${tags ? `<div class="tags">${tags}</div>` : ''}${cards ? `<h4>Cards</h4>${cards}` : ''}${traps}
    ${o.notes.length ? `<h4>What happened</h4><ul class="why">${o.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}`;
}
function selectLog(idx: number): void {
  if (!G) return;
  UI.logSel = idx;
  tutNote('logrow');
  const box = document.getElementById('logIns');
  if (box) box.innerHTML = inspectHTML(idx);
  document.querySelectorAll('.plog li.sel').forEach((e) => e.classList.remove('sel'));
  document.querySelector(`.plog li[data-logi="${idx}"]`)?.classList.add('sel');
}
function logHTML(): string {
  const g = G!;
  if (g.feed.length !== logLen) { UI.logSel = -1; logLen = g.feed.length; }
  const sel = UI.logSel >= 0 ? UI.logSel : g.feed.length - 1;
  const rows = g.feed.map((l, i) => ({ l, i })).slice(-20).reverse();
  const li = rows.map(({ l, i }, k) => {
    const ic = feedIcon(l), h = l.kind === 'shot' ? g.hist.find((x) => x.n === l.n && x.side === l.side) : undefined;
    const bd = h ? badges({ ...h.outcome }).map((b) => `<span class="lb" title="${b.text}">${icon(b.name)}</span>`).join('') + (h.outcome.andOne ? `<span class="lb a1" title="and one">+1</span>` : '') : '';
    return `<li class="l${l.side} k-${l.kind}${k === 0 ? ' new' : ''}${i === sel ? ' sel' : ''}" data-logi="${i}" data-a="logrow" data-v="${i}" tabindex="0" role="button" aria-label="Show details: ${esc(l.text)}"><span class="ln">#${l.n}</span><span class="li-ic t-${ic.tone}">${ic.svg}</span><span class="li-t">${esc(l.text)}</span>${bd ? `<span class="lbs">${bd}</span>` : ''}</li>`;
  }).join('') || '<li class="dim">The game is about to start.</li>';
  return `<div class="log-back${UI.logOpen ? ' open' : ''}" data-a="logclose"></div><aside class="xg-log${UI.logOpen ? ' open' : ''}" id="logSheet" aria-label="Play by play"><div class="plog"><div class="sheet-h"><h3 class="h3">Play by play <span class="dim">tap a line for the numbers</span></h3><button class="btn sm ghost lg-x" data-a="logclose" aria-label="Close play by play">Close</button></div><ol>${li}</ol><div class="log-ins" id="logIns" aria-live="polite">${inspectHTML(sel)}</div></div></aside>`;
}
function handHTML(): string {
  const g = G!, S = g.sides[0];
  const blocked = (i: number) => (UI.phase === 'result' ? 'Wait for the next possession.' : playBlock(g, 0, S.hand[i]));
  return `<div class="hand-bar"><span class="hb-lab">HAND <small>tap a card to play</small></span><span class="dim small">Deck ${S.deck.length} · discard ${S.discard.length}</span></div>
    <div class="hand" aria-label="Your hand">${S.hand.map((c, i) => { const b = blocked(i), t = effectTag(c); return `<button class="hcard${c.cls ? ' pc-' + c.cls : ''} r-${c.rarity}${c.fx.trap ? ' is-trap sp-trap' : ' sp-spell'}${c.rarity === 'iconic' ? ' ic-gl' : ''}${b ? ' off' : ''}" data-a="card" data-v="${i}" aria-label="${esc(c.name)}: ${esc(c.text)}${b ? ' (' + esc(b) + ')' : ''}" title="${esc(b || c.text)}"><span class="hc-art" aria-hidden="true">${cardArt(c)}</span>
      <span class="hc-cost" title="Momentum cost">${c.fx.allIn ? 'ALL' : costOf(g, 0, c)}</span><span class="hc-big">${esc(t.big)}</span><span class="hc-sm">${esc(t.small)}</span><b class="hc-name">${esc(c.name)}</b>${c.lv ? `<i class="hc-lv">Lv ${c.lv}</i>` : ''}${b && UI.phase !== 'result' ? `<i class="hc-why">${esc(b.replace('Needs ', 'Needs ').replace(' Momentum.', ' MO').replace('.', ''))}</i>` : ''}</button>`; }).join('') || '<span class="dim small">No cards in hand.</span>'}</div>`;
}
/** The enlarged card with its full text and the Play button. */
function cardPreview(): string {
  const g = G!, S = g.sides[0], i = UI.cardView!, c = S.hand[i];
  if (!c) return '';
  const why = UI.phase === 'result' ? 'Wait for the next possession.' : playBlock(g, 0, c), t = effectTag(c), tier = cardTier(c);
  const lvp = cardLevelLine(c);
  return `<div class="overlay sheetwrap" id="cardPrev" data-a="cardclose"><div class="cp r-${c.rarity} t-${tier}${c.fx.trap ? ' sp-trap' : ' sp-spell'}${c.cls ? ' pc-' + c.cls : ''}" data-a="noop" role="dialog" aria-modal="true" aria-label="${esc(c.name)}">
    <div class="cp-art" aria-hidden="true">${cardArt(c)}</div><span class="cp-cost" title="Momentum cost">${c.fx.allIn ? 'ALL' : costOf(g, 0, c)}<small>MO</small></span>
    <b class="cp-name">${esc(c.name)}</b><span class="cp-kind">${esc(RARITY_NAME[c.rarity])} · ${esc(classLabel(c))} · ${esc(whenLabel(c))}</span>
    <div class="cp-big"><b>${esc(t.big)}</b><span>${esc(t.small)}</span></div>
    <p class="cp-text">${esc(c.text)}</p><p class="cp-flav">${esc(c.flavor)}</p>${lvp}
    ${why ? `<p class="cp-why">${esc(why)}</p>` : ''}
    <div class="cp-btns"><button class="btn ghost" data-a="cardclose">Close</button><button class="btn go" data-a="cardplay" data-v="${i}" ${why ? 'disabled' : ''}>Play (${c.fx.allIn ? 'ALL' : costOf(g, 0, c)} MO)</button></div></div></div>`;
}
/** A Baller card as a modal: from a token, a shooter chip, a matchup or the subs sheet. */
function ballerModal(): string {
  const g = G!, k = UI.card!, S = g.sides[k.side];
  const b = k.bench ? S.bench[k.i] : S.team[k.i];
  if (!b) return '';
  let chances: Record<Zone, [number, number]> | undefined;
  const mineOff = k.side === 0 && !k.bench && g.poss.off === 0 && UI.phase === 'off';
  if (mineOff) chances = Object.fromEntries(ZONES.map((z) => [z, [chanceNow(g, k.i, z, null).p, chanceNow(g, k.i, z, z).p]])) as Record<Zone, [number, number]>;
  const canShoot2 = mineOff && shooterSlots(g, 0).includes(k.i);
  // a bench Baller is compared with the court Baller in the same position, or the first one
  const versus = k.bench ? S.team.find((t) => t.pos === b.pos) || S.team[0] : undefined;
  return ballerCardHTML(b, { where: k.bench ? 'bench' : 'court', mine: k.side === 0, chances, zone: g.poss.zone, canShoot: canShoot2, isShooter: g.poss.shooter === k.i, versus });
}
function subsModal(): string {
  const g = G!, S = g.sides[0];
  const swap = (a: CBaller, ci: number, b: CBaller, bi: number): string => {
    const why = subBlock(g, 0, ci, bi);
    return `<button class="sb-swap" data-a="sub" data-v="${ci}:${bi}" ${why ? 'disabled' : ''} title="${esc(why || 'Swap')}">${portrait(b, 'sm')}<span class="sb-sw-t"><b>${esc(b.name)} ${posBadge(b)}</b><span class="sb-arrows">${compareArrows(b, a)}</span></span><em>${why ? esc(why.replace('A sub costs', 'Needs').replace(' Momentum.', ' MO')) : 'Swap in'}</em></button>`;
  };
  const benchCard = (b: CBaller, bi: number): string => `<div class="sb-bench"><button class="sb-pt" data-a="baller" data-v="0:${bi}:b" aria-label="Card of ${esc(b.name)}">${portrait(b, 'md')}</button><div class="sb-bi"><b>${esc(b.name)} ${posBadge(b)}${b.level > 1 ? ` <i class="lvtag">Lv ${b.level}</i>` : ''}</b>${miniStats(b)}<span class="sb-def">DEF ${b.def}</span><small class="sb-sk" title="${esc(b.skill.text)}">${esc(b.skill.name)}</small>${fatigueBar(b)}${b.cd ? `<i class="fatb">swapped ${b.cd}</i>` : ''}</div></div>`;
  return `<div class="overlay sheetwrap" id="subs" data-a="subsclose"><div class="sheet subsheet" data-a="noop" role="dialog" aria-modal="true" aria-labelledby="subh">
    <div class="sheet-h"><b id="subh">Substitutions</b><span class="dim small">MO ${S.mo} · sub costs ${TUNING.subCost}</span><button class="btn sm go" data-a="subsclose">Done</button></div>
    <div class="sheet-body">
    <p class="dim small sb-note">Tired after ${FATIGUE.start - 1} attacks (−${FATIGUE.step}% each, max −${FATIGUE.cap}%). Bench rests. No re-swap for ${TUNING.subCooldown} possessions. Tap a face for his card.</p>
    <h4 class="sb-h">Bench</h4><div class="sb-benchrow">${S.bench.map(benchCard).join('') || '<span class="dim small">No bench.</span>'}</div>
    <h4 class="sb-h">On court: who comes off? <small>▲ better, ▼ worse than the one coming off</small></h4>
    ${S.team.map((a, ci) => `<div class="subrow"><button class="sb-out" data-a="baller" data-v="0:${ci}:c" aria-label="Card of ${esc(a.name)}">${portrait(a, 'sm')}<span><b>${esc(a.name)} ${posBadge(a)}</b>${miniStats(a)}${fatBadge(a) || '<i class="fatb ok">fresh</i>'}</span></button>${S.bench.map((b, bi) => swap(a, ci, b, bi)).join('')}</div>`).join('')}
    </div></div></div>`;
}
/** Momentum feedback: a rising tick for each point your bar gains, a surge when it fills; the music tension follows the bars. */
function momentumSound(g: CGame): void {
  const mx = TUNING.moMax, a = g.sides[0].mo, b = g.sides[1].mo, was = moShown[0];
  const late = Math.max(g.sides[0].score, g.sides[1].score) >= TUNING.winTo - 4 ? 0.15 : 0;
  setTension(Math.min(1, 0.15 + 0.6 * Math.max(a, b) / mx + late));
  if (was >= 0 && a > was) { if (a >= mx) setTimeout(() => sfx('moSurge'), 30); else setTimeout(() => sfx('moTick', { level: a / mx }), 30); }
}
function gameHTML(): string {
  const g = G!;
  const panel = UI.phase === 'result' ? resultPanel() : UI.phase === 'def' ? defPanel() : offPanel();
  const modals = (UI.subOpen ? subsModal() : '') + (UI.cardView != null ? cardPreview() : '') + (UI.card ? ballerModal() : '');
  const html = `<div class="xg"><div class="xg-hud">${jumboHTML()}</div>${courtHTML()}<div class="xg-act g-panel">${panel}</div><div class="xg-hand g-hand">${handHTML()}</div>${logHTML()}</div>${modals}`;
  momentumSound(g);
  moShown = [g.sides[0].mo, g.sides[1].mo];
  return html;
}
export function playHTML(): string {
  if (G) return gameHTML();
  return titleHTML() + overlays();
}

// ---------- guided first game ----------
/** Bucks for the first guided game, on top of the free Street Pack. */
const TUT_BUCKS = 40;
let tutRig: 'make' | 'miss' | null = null;
let prevWinTo = 0;
/** Wide layout (desktop): the play-by-play is docked and always on screen. Must match the media query in mobile.css. */
export const logDocked = (): boolean => matchMedia('(min-width: 1000px) and (min-height: 600px)').matches;
const tutSnap = (): Snap | null => (G && tutActive() && document.body.dataset.tab === 'play' ? { n: G.n, phase: UI.phase, over: G.over, logDocked: logDocked(), logOpen: UI.logOpen } : null);
function tutCtx(): Ctx {
  const g = G;
  if (!g) return EMPTY_CTX;
  const me = g.sides[0].team, cpu = g.sides[1];
  const hot = me.findIndex((b) => b.hold > 0), ci = hot >= 0 ? hot : g.poss.shooter;
  const tiredIdx = me.reduce((bi, b, i) => (b.run > me[bi].run ? i : bi), 0);
  let dtIdx = 0, likes = ZONE_NAME.mid;
  if (g.poss.off === 1 && !g.over) { const o = options(g, 1)[0]; dtIdx = g.poss.dt ? g.poss.dt.mark : o.shooter; likes = ZONE_NAME[o.zone]; }
  const last = UI.last;
  return {
    first: me[ci]?.name ?? 'Your shooter', cool: me[ci]?.name ?? 'He', coolIdx: ci, dtIdx, dtName: cpu.team[dtIdx]?.name ?? 'their star',
    tired: me[tiredIdx]?.name ?? 'Your starter', tiredIdx, hero: CLASSES[cpu.coach].hero, likes, won: g.winner === 0,
    made: !!last?.made, fireOn: !!last?.fireOn, trapFired: !!last && last.traps.length > 0, blocked: !!last?.blocked, cardOpen: UI.cardView != null,
  };
}
/** The guided game: Rookie Run to 11, seeded, with the early possessions scripted so every lesson is guaranteed to come up. */
export function startTutorialGame(): void {
  if (tutActive()) endTutorial();
  ensureSquad();
  prevWinTo = TUNING.winTo;
  TUNING.winTo = 11;
  seedRng(0x7c0de5);
  stageIdx = -2;
  stage = { ...STAGES[0] };
  const P = profile(), coach = P.coach as ClassKey;
  G = newGame(newSide(coach, mySquad(), myDeck(coach), cardLevels()), cpuSide(stage), 0);
  UI = freshUI();
  moShown = [-1, -1]; logLen = 0;
  setSpeed(P.fast ? 0.45 : 1);
  tutBegin();
  goPlay();
  beginPoss();
}
function endTutorial(): void {
  tutEnd();
  if (prevWinTo) { TUNING.winTo = prevWinTo; prevWinTo = 0; }
  tutRig = null;
  stageIdx = -1;
  seedRng((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
}
function skipTutorial(): void {
  tutMark('skipped');
  endTutorial();
  G = null;
  rerender();
}
/** Forces the situation for a scripted possession: the hand, a Momentum gift, a tired starter, and a rigged shot. */
function applyScene(g: CGame): void {
  const sc = SCENES[g.n];
  tutRig = sc?.rig ?? null;
  if (!sc) return;
  const me = g.sides[0];
  me.hand = sc.hand.map((k) => ccard(k)).filter((c): c is NonNullable<typeof c> => !!c);
  if (sc.moMin) me.mo = Math.max(me.mo, sc.moMin);
  if (g.poss.off === 0) {
    setDT(g, 1, null);
    g.sides[1].traps = [];
    g.poss.defCard = null;
    g.poss.used[1] = false;
    if (sc.tire) { fixShooter(g); me.team[g.poss.shooter].run = 8; }
  }
}
/** Resolves a possession with a result chosen in advance: tries seeds on a copy of the game until one gives it. */
function rigResolve(g: CGame, bonus: number, want: 'make' | 'miss'): Outcome {
  for (let i = 1; i <= 4000; i++) {
    const seed = (Math.imul(i, 2654435761) ^ 0x51ed27) >>> 0;
    let o: Outcome;
    try { const c = structuredClone(g); seedRng(seed); o = resolve(c, bonus); } catch { break; }
    if (want === 'make' ? o.made && !o.turnover : !o.made && !o.turnover && !o.blocked) { seedRng(seed); return resolve(g, bonus); }
  }
  return resolve(g, bonus);
}
function finishTutorial(): void {
  const g = G!, won = g.winner === 0, P = profile();
  const first = !P.tut.pack;
  tutMark('done');
  if (first) { P.tut.pack = true; P.pending.push('street'); P.bucks += TUT_BUCKS; save(); bucksChanged(); }
  const score = `${g.sides[0].score} – ${g.sides[1].score}`;
  endTutorial();
  const o = document.createElement('div');
  o.className = 'overlay';
  o.id = 'endModal';
  const ptr: [string, string, string][] = [['packs', 'Packs', 'Open your free pack, then render more.'], ['deck', 'Deck', 'Build a 15 to 20 card playbook.'], ['story', 'Story', 'Eight courts. First clears pay packs.']];
  o.innerHTML = `<div class="modal end tutend ${won ? 'win' : 'loss'}" role="dialog" aria-modal="true" aria-labelledby="endh">
    <h2 id="endh">${won ? 'Tutorial complete' : 'Tutorial done'}</h2>
    <p class="final">${score}</p>
    <p class="dim">Rookie Run · guided game</p>
    <p class="lore-line">${esc(won ? 'The Grid saw that. It does not forget.' : 'The Grid keeps score, not grudges.')}</p>
    ${first ? `<ul class="rw-list"><li><span>Tutorial reward</span><b>+${TUT_BUCKS} B$</b></li><li><span>Street Pack</span><b>free</b></li></ul><p class="earn pack">A free pack is waiting for you!</p>` : '<p class="dim small">Practice game: no rewards this time.</p>'}
    <div class="tut-ptr">${ptr.map(([v, t, d]) => `<button class="tut-p" data-a="tutgo" data-v="${v}"><b>${t}</b><small>${d}</small></button>`).join('')}</div>
    <div class="row end">${first ? '<button class="btn go" data-a="rewardpack">Open your free pack</button>' : ''}<button class="btn ghost" data-a="menu">Menu</button>${first ? '' : '<button class="btn go" data-a="tutorial">Play it again</button>'}</div></div>`;
  document.body.appendChild(o);
  sfx(won ? 'reward' : 'groan');
}

// ---------- flow ----------
function startGame(idx: number): void {
  if (tutActive()) endTutorial();
  ensureSquad();
  seedRng((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  stageIdx = idx;
  const base = idx >= 0 ? STAGES[idx] : { ...QUICK, coach: CLS_KEYS[ri(CLS_KEYS.length)] };
  stage = base as Stage;
  const P = profile(), coach = P.coach as ClassKey;
  const me = newSide(coach, mySquad(), myDeck(coach), cardLevels());
  G = newGame(me, cpuSide(stage));
  UI = freshUI();
  moShown = [-1, -1]; logLen = 0;
  setSpeed(P.fast ? 0.45 : 1);
  goPlay();
  beginPoss();
  setTimeout(() => sfx('whistle', { v: 0.7 }), 250);
}
/** Keeps the selected shooter legal after a sub, a double team or a card changed who may shoot. */
function fixShooter(g: CGame): void {
  if (g.poss.off !== 0) return;
  const ok = shooterSlots(g, 0);
  if (!ok.includes(g.poss.shooter) && ok.length) g.poss.shooter = ok.reduce((a, i) => (Math.max(g.sides[0].team[i].rim, g.sides[0].team[i].mid, g.sides[0].team[i].three) > Math.max(g.sides[0].team[a].rim, g.sides[0].team[a].mid, g.sides[0].team[a].three) ? i : a));
}
function beginPoss(): void {
  const g = G!;
  UI.msg = '';
  UI.card = null; UI.cardView = null;
  aiSubs(g, 1, stage!.skill);
  if (g.poss.off === 1) { UI.phase = 'def'; g.poss.guard = null; }
  else { aiDefense(g, 1, stage!.skill); UI.phase = 'off'; g.poss.zone = null; }
  fixShooter(g);
  if (tutActive()) applyScene(g);
  rerender();
  if (!reduced()) {
    if (g.poss.dt && g.poss.off === 0) banner('DOUBLE TEAM', `${g.sides[0].team[g.poss.dt.mark].name} is marked. Find the open man.`, 'bad');
    else banner(g.poss.off === 0 ? 'YOUR BALL' : 'DEFENSE', g.poss.off === 0 ? 'Pick a shooter and a zone' : 'Guess their zone', g.poss.off === 0 ? 'cool' : 'hot');
  }
}
const tokEl = (s: Side, i: number): Element | null => document.querySelector(`[data-tok="${s}-${i}"]`);
const spotEl = (s: Side, i: number): HTMLElement | null => document.querySelector(`[data-spot="${s}-${i}"]`);
const imgPt = (s: Side, i: number): XY => centerOf(tokEl(s, i)?.querySelector('.tok-img') ?? tokEl(s, i));
const hoopEl = (): Element | null => document.querySelector('#hoop .rim') || document.getElementById('hoop');
const hoopPt = (): XY => centerOf(hoopEl());
const zoneLabEl = (z: Zone): Element | null => document.querySelector(`.zl-${z}`);
const courtEl = (): HTMLElement | null => document.querySelector('.court-wrap');
/** Slides a player token to a spot on the court (percent of the court box). The CSS transition does the running. */
function runTo(el: HTMLElement | null, pt: Pt): void {
  if (!el) return;
  el.style.left = pt[0] + '%';
  el.style.top = pt[1] + '%';
  el.classList.add('running');
  setTimeout(() => el.classList.remove('running'), 900 * getSpeed());
}
const MAKE_WORD: Record<Zone, string[]> = { rim: ['AND IN!', 'BUCKET!', 'LOB CITY!'], mid: ['PULL-UP!', 'MONEY!', 'SMOOTH!', 'ELBOW JUMPER!'], three: ['SPLASH!', 'CASH!', 'FROM DOWNTOWN!', 'NOTHING BUT NET!'] };
const DUNK_WORD = ['SLAM!', 'POSTER!', 'JAM!', 'THROWDOWN!'], LAYUP_WORD = ['FINGER ROLL!', 'SCOOP!', 'LAYUP!'], TOUGH_WORD = ['TOUGH FINISH!', 'THROUGH CONTACT!'];
const TOV_WORD = (t: string, mine: boolean): string => (/foul/i.test(t) ? 'CHARGE!' : /clock/i.test(t) ? 'SHOT CLOCK!' : /ref/i.test(t) ? 'WHISTLE!' : mine ? 'STOLEN!' : 'PICKED!');
/** A court point (percent of the court box) as a screen point. */
function courtPt(p: Pt): XY {
  const r = courtEl()?.getBoundingClientRect();
  return r ? { x: r.left + (p[0] / 100) * r.width, y: r.top + (p[1] / 100) * r.height } : { x: innerWidth / 2, y: innerHeight / 2 };
}
/** While a possession plays, the thin defender lines (and the OPEN ring) follow the portrait tokens as they run, frame by frame. */
function trackLines(): void {
  const tick = (): void => {
    const w = courtEl();
    if (!w || !fxPlaying()) return;
    const r = w.getBoundingClientRect();
    const at = (s: string, i: string): [number, number] | null => {
      const im = document.querySelector(`[data-tok="${s}-${i}"] .tok-img`);
      if (!im || !r.width) return null;
      const b = im.getBoundingClientRect();
      return [((b.left + b.width / 2 - r.left) / r.width) * 100, ((b.top + b.height / 2 - r.top) / r.height) * 100];
    };
    w.querySelectorAll<SVGElement>('.c-match').forEach((l) => {
      const d = at(l.dataset.ds!, l.dataset.di!), a = at(l.dataset.os!, l.dataset.oi!);
      if (!d || !a) return;
      l.setAttribute('x1', String(d[0])); l.setAttribute('y1', String(d[1] + 4)); l.setAttribute('x2', String(a[0])); l.setAttribute('y2', String(a[1] - 5));
    });
    w.querySelectorAll<SVGElement>('.c-open').forEach((c) => {
      const a = at(c.dataset.os!, c.dataset.oi!);
      if (a) { c.setAttribute('cx', String(a[0])); c.setAttribute('cy', String(a[1] - 5)); }
    });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
/**
 * One possession as a short Auto Chess style scene in five beats (about 4 s, about 1.8 s in fast mode, a tap skips it):
 * 1. PASS: the ball goes to the shooter;
 * 2. MOVE: the shooter takes his spot and the defenders move into the chosen scheme (Pack the Paint sags into the lane, Drop gathers around
 *    the elbow, Close Out runs to the arc); a double team sends two of them onto the marked man;
 * 3. REACTION: a right guess puts the defender in front of the shooter, a wrong guess leaves him a step late;
 * 4. SHOT: a Rim shot against a wrong guess is a drive past the defender (layup, or a dunk for a Big or a high Rim), against a right guess a
 *    contested, awkward finish; Mid and Three are jump shots from the spot, a right guess raises the defender's hand;
 * 5. RESULT: the net, the miss or the block; an and-one adds the whistle and a free throw; rare shots get the full-court glitch.
 */
function steps(o: Outcome): Step[] {
  const g = G!, mine = o.side === 0, off = o.side, def = (1 - off) as Side, S: Step[] = [], good: Tone = mine ? 'good' : 'bad', bad: Tone = mine ? 'bad' : 'good';
  const D = g.sides[def], sb = g.sides[off].team[o.shooter];
  const rim = o.zone === 'rim';
  const origin = shotOrigin(o.zone, o.shooter);
  const start: Pt = rim ? DRIVE_START[o.shooter % 3] : origin;
  const side = start[0] < 50 ? 1 : -1;
  const beaten = o.iso || (!!o.guard && !o.read);
  const wrap = courtEl();
  wrap?.classList.add('animating');
  const trapTips = (): void => {
    o.traps.forEach((t, k) => setTimeout(() => tip(centerOf(wrap), 'TRAP: ' + esc(t.name), esc(t.text), bad), k * 450 * getSpeed()));
  };
  if (o.turnover) {
    // the ball handler is stopped before a shot: a defender sprints at him, the ball changes hands
    S.push({ wait: 900, run: () => {
      trackLines();
      if (o.passer != null) { ballHop(imgPt(off, o.passer), imgPt(off, o.shooter), 300); pulse(tokEl(off, o.passer)); }
      const hp = COURT_POS.off[o.shooter];
      runTo(spotEl(def, o.defender), contestSpot(hp as Pt, side));
      if (o.countered) tip(centerOf(wrap), 'COUNTERED', esc(o.countered), bad);
      trapTips();
    } });
    S.push({ wait: 1000, run: () => {
      const h = imgPt(off, o.shooter), d = imgPt(def, o.defender);
      ballHop(h, d, 320, 8);
      glitchEl(tokEl(off, o.shooter));
      callout(TOV_WORD(o.turnover!, mine), null, bad, 'Turnover', true);
      sfx(/foul|clock|ref/i.test(o.turnover!) ? 'turnover' : 'steal');
      blockFx(d); flash(bad);
    } });
    return S;
  }
  // defender positions: the scheme formation, or the collapse of a double team
  const markPos: Pt = o.dt && o.dt.mark === o.shooter ? start : COURT_POS.off[o.dt ? o.dt.mark : 0] as Pt;
  const dtMark = o.dt ? D.match[o.dt.mark] : -1, dtOpen = o.dt && o.dt.open >= 0 ? D.match[o.dt.open] : -1;
  const formation = o.guard && !o.iso ? formationFor(o.guard, o.defender, start[0]) : COURT_POS.def;
  // 1. PASS
  S.push({ wait: 650, run: () => {
    trackLines();
    if (o.passer != null && !o.iso) { sfx('bounce', { power: 0.45, v: 0.8 }); ballHop(imgPt(off, o.passer), imgPt(off, o.shooter), 420); pulse(tokEl(off, o.passer)); callout('PASS', tokEl(off, o.passer), 'cool'); }
    if (o.iso) tip(centerOf(wrap), 'ISO', 'Everyone else clears out. He drives to the rim.', good);
    wrap?.classList.add('z-' + o.zone);
    trapTips();
  } });
  // 2. MOVE
  S.push({ wait: 900, run: () => {
    runTo(spotEl(off, o.shooter), start);
    if (o.guard && !o.iso) {
      wrap?.classList.add('g-' + o.guard);
      callout(esc(SCHEME_NAME[o.guard]).toUpperCase(), zoneLabEl(o.guard), 'plain', o.guard === 'rim' ? 'helpers sag into the lane' : o.guard === 'mid' ? 'defenders drop to the elbow' : 'defenders run out to the arc');
    }
    D.team.forEach((_b, i) => { if (i !== dtMark && i !== dtOpen) runTo(spotEl(def, i), formation[i] as Pt); });
    if (o.dt) {
      const [a, b] = collapseSpots(markPos);
      runTo(spotEl(def, dtMark), a);
      if (dtOpen >= 0 && dtOpen !== dtMark) runTo(spotEl(def, dtOpen), b);
      spotEl(off, o.dt.mark)?.classList.add('dt-mark');
    }
  } });
  // 3. REACTION
  S.push({ wait: 800, run: () => {
    const df = spotEl(def, o.defender), sh = spotEl(off, o.shooter);
    if (o.dt) {
      // the marked man is trapped; the abandoned man is open
      const open = o.dt.open >= 0 ? o.dt.open : o.shooter;
      if (o.dt.mark !== o.shooter) sh?.classList.add('open-man');
      else spotEl(off, open)?.classList.add('open-man');
      tip(courtPt([50, 62]), 'DOUBLE TEAM', 'Two defenders collapse on him. His man left the open shooter.', 'cool', 1300);
      callout(o.dt.mark === o.shooter ? 'FORCED UP' : 'OPEN LOOK', sh?.querySelector('.tok-img') ?? sh, o.dt.mark === o.shooter ? bad : good);
    } else if (o.guard && !o.iso) {
      wrap?.classList.add(o.read ? 'guess-hit' : 'guess-miss');
      callout(`${o.read ? 'READ' : 'WRONG GUESS'}`, df, o.read ? bad : good, o.read ? 'right in his face' : rim ? 'beaten off the dribble' : 'a step late');
      if (rim) {
        if (o.read) {
          runTo(df, lerpPt(start, HOOP as Pt, 0.5));
          runTo(sh, lerpPt(start, HOOP as Pt, 0.22));
          setTimeout(() => { df?.classList.add('collide'); sh?.classList.add('collide'); }, 420 * getSpeed());
        } else runTo(df, contestSpot(start, side));
      } else runTo(df, contestSpot(origin, side, o.read ? 'tight' : 'late'));
    }
  } });
  // 4. SHOT
  const drive = rim && beaten && !o.dt && !o.blocked;
  S.push({ wait: drive ? 1000 : 850, run: () => {
    const shooter = tokEl(off, o.shooter), sp = spotEl(off, o.shooter), df = spotEl(def, o.defender);
    pulse(shooter);
    const shoot = (): void => {
      const a = imgPt(off, o.shooter), h = hoopPt();
      shooter?.classList.add('shooting');
      if (!(drive && dunks(sb))) sfx('shotRelease', { power: Math.min(1, o.p / 70) });
      callout(`${ZONE_NAME[o.zone].toUpperCase()} ${o.p}%`, shooter, 'plain', drive ? (dunks(sb) ? 'dunk' : 'layup') : o.read && rim ? 'contested' : '');
      if (o.blocked) {
        const mid: XY = { x: a.x + (h.x - a.x) * 0.3, y: a.y + (h.y - a.y) * 0.3 - 30 };
        ballArc(a, mid, 340, 24);
        setTimeout(() => { sfx('block'); df?.classList.add('jump'); blockFx(mid); ballArc(mid, { x: mid.x + (side > 0 ? 150 : -150), y: mid.y + 110 }, 460, 40); }, 320 * getSpeed());
      } else if (drive) {
        if (dunks(sb)) { sp?.classList.add('dunking'); ballArc(a, h, 300, 6); } else { sp?.classList.add('layup'); ballArc(a, h, 460, 34); }
      } else if (rim) {
        // contested at the rim: an off-balance, high-arcing floater
        shooter?.classList.add('awkward');
        ballArc(a, h, 760, LOB.rim + 36);
      } else {
        if (o.read && !o.dt) { handFx(imgPt(def, o.defender)); df?.classList.add('hand'); }
        ballArc(a, h, 700, LOB[o.zone]);
      }
    };
    if (drive) {
      // the defender is beaten: the shooter runs past him to the basket, the defender turns and trails
      runTo(sp, DRIVE_END[o.shooter % 3]);
      df?.classList.add('beaten');
      runTo(df, lerpPt(contestSpot(start, side), DRIVE_END[o.shooter % 3], 0.3));
      setTimeout(shoot, 560 * getSpeed());
    } else shoot();
  } });
  // 5. RESULT
  S.push({ wait: o.andOne ? 1250 : 950, run: () => {
    const h = hoopPt();
    if (o.made) {
      const w = rim ? (drive ? (dunks(sb) ? DUNK_WORD : LAYUP_WORD) : o.read ? TOUGH_WORD : MAKE_WORD.rim) : MAKE_WORD[o.zone];
      swish(h, good);
      if (drive && dunks(sb)) sfx('dunk'); else if (drive) sfx('layup'); else { sfx('swish'); if (rim) setTimeout(() => sfx('backboard', { v: 0.6 }), 30); }
      setTimeout(() => sfx('roar', { level: Math.min(1, 0.4 + (o.pts - 2) * 0.12 + (o.clutch ? 0.25 : 0) + (o.label ? 0.2 : 0)), v: mine ? 1 : 0.6 }), 140);
      callout(o.putback ? 'PUTBACK!' : o.clutch ? 'CLUTCH!' : w[ri(w.length)], null, good, `+${o.pts}`, true);
      burst(hoopEl(), good); flash(good);
      document.getElementById('hoop')?.classList.add('swish');
      if (drive && dunks(sb)) document.getElementById('hoop')?.classList.add('rattle');
    } else if (o.blocked) callout('DENIED!', null, bad, 'Block', true);
    else {
      ballArc(h, { x: h.x + (ri(2) ? 70 : -70), y: h.y + 120 }, 500, 50);
      sfx('rim'); if (ri(2)) setTimeout(() => sfx('backboard', { v: 0.5 }), 90);
      if (mine) setTimeout(() => sfx('groan'), 260);
      document.getElementById('hoop')?.classList.add('rattle');
      callout(o.p >= 60 ? 'RIMMED OUT!' : 'BRICK!', null, bad, '', true);
    }
  } });
  if (o.andOne) {
    // the whistle: foul on the finish, then a free throw for the extra point
    S.push({ wait: 1400, run: () => {
      const sh = tokEl(off, o.shooter), d = imgPt(def, o.defender);
      flash('hot');
      callout('AND ONE!', null, 'hot', 'foul on the finish', true, courtPt([50, 66]));
      whistleFx({ x: d.x, y: Math.max(d.y, courtPt([50, 14]).y) + 6 });
      sfx('andOne');
      pulse(sh);
      spotEl(def, o.defender)?.classList.add('foul');
      setTimeout(() => { if (skipped()) return; freeThrow(courtPt([50, 38]), hoopPt(), good); tip(courtPt([50, 52]), 'FREE THROW', `${esc(sb.name)} gets the extra point: +1 and +1 Momentum.`, good, 1300); }, 650 * getSpeed());
    } });
  }
  const lvl = o.made ? glitchLevel(o.label, o.inhuman) : 0;
  if (lvl) {
    S.push({ wait: [0, 1200, 1700, 2300][lvl], run: () => {
      const name = o.inhuman ? 'SYSTEM ERROR' : o.label!;
      const lore = GLITCH_LORE[o.inhuman ? 'INHUMAN' : name] || GLITCH_LORE['GLITCHED'];
      glitchSlam(lvl as 1 | 2 | 3, name, `${o.p}% shot went in`, o.inhuman ? lore.alias : '');
      sfx(('glitch' + lvl) as 'glitch1' | 'glitch2' | 'glitch3');
      spikeTension(3);
    } });
  }
  if (o.fireOn) S.push({ wait: 700, run: () => { sfx('fireOn'); spikeTension(6); callout('ON FIRE', tokEl(off, o.shooter), 'hot', 'Hot hand', false); document.getElementById('app')?.classList.add('fire-flash'); setTimeout(() => document.getElementById('app')?.classList.remove('fire-flash'), 900); } });
  return S;
}
async function doResolve(bonus: number): Promise<void> {
  const g = G!;
  const before: [number, number] = [g.sides[0].mo, g.sides[1].mo];
  const o = tutRig ? rigResolve(g, bonus, tutRig) : resolve(g, bonus);
  tutRig = null;
  UI.last = o;
  await play(steps(o));
  UI.phase = 'result';
  rerender();
  if (!reduced()) {
    // teach the Momentum bar: say how much each bar moved
    ([0, 1] as Side[]).forEach((sd) => {
      const dlt = g.sides[sd].mo - before[sd];
      if (dlt) { const bar = document.querySelector(`.jumbo .mo[data-mo="${sd}"]`); if (bar) callout(`${dlt > 0 ? '+' : ''}${dlt} MOMENTUM`, bar, dlt > 0 ? 'cool' : 'plain', dlt > 0 ? (o.side === sd ? (o.made ? 'basket' : 'ball') : 'stop') : o.clutch ? 'clutch spent' : 'spent'); }
    });
  }
  const n = document.getElementById(o.side === 0 ? 's0' : 's1');
  if (o.made && n && !reduced()) { n.classList.remove('bump'); void (n as HTMLElement).offsetWidth; n.classList.add('bump'); }
}
function finish(): void {
  if (stageIdx === -2) { finishTutorial(); return; }
  const g = G!, won = g.winner === 0, P = profile();
  const st = stageIdx >= 0 ? STAGES[stageIdx] : null;
  const stars = st ? starsFor(g) : 0;
  const wasFirst = !!st && won && (P.stars[stageIdx] || 0) === 0;
  const R = applyGame(P, { won, stage: stageIdx, stars, today: dayKey(), reward: st ? { reward: st.reward, pack: st.pack, boss: st.boss } : undefined });
  if (wasFirst && stageIdx === P.story) P.story++;
  P.pending.push(...R.packs);
  countGame(won);
  bucksChanged();
  const prevStars = Math.max(0, stars - R.newStars);
  const o = document.createElement('div');
  o.className = 'overlay';
  o.id = 'endModal';
  const next = stageIdx >= 0 && won && stageIdx + 1 < STAGES.length;
  const lines = R.lines.map(([l, b, sh]) => `<li><span>${esc(l)}</span><b>${b ? `+${b} B$` : ''}${b && sh ? ' · ' : ''}${sh ? `+${sh} shards` : ''}</b></li>`).join('');
  const starRow = st ? `<div class="rw-stars" aria-label="${stars} of 3 stars">${[0, 1, 2].map((k) => `<span class="rw-star${k < stars ? ' on' : ''}${k >= prevStars && k < stars ? ' fresh' : ''}" style="--i:${k}" title="${esc(STAR_TEXT[k])}">★</span>`).join('')}</div>
      <p class="dim small">${STAR_TEXT.map((t, k) => `${k < stars ? '★' : '☆'} ${esc(t)}`).join(' · ')}</p>` : '';
  const packs = R.packs.length;
  o.innerHTML = `<div class="modal end ${won ? 'win' : 'loss'}" role="dialog" aria-modal="true" aria-labelledby="endh">
    <h2 id="endh">${won ? (stageIdx === STAGES.length - 1 ? 'Champion!' : 'You win!') : 'Game over'}</h2>
    <p class="final">${g.sides[0].score} – ${g.sides[1].score}</p>
    <p class="dim">${esc(stage!.name)} · ${g.n} possessions</p>
    ${starRow}
    <ul class="rw-list">${lines}</ul>
    <p class="earn">+${R.bucks} Bucks · +${R.shards} shards</p>
    ${R.bossName ? `<p class="earn pack">Boss beaten: ${esc(R.bossName)}!</p>` : ''}${packs ? `<p class="earn pack">${packs === 1 ? 'A pack' : packs + ' packs'} won!</p>` : ''}
    ${R.milestones.length ? '<p class="earn pack">A star reward is ready to claim in Story.</p>' : ''}
    <div class="row end">${packs ? `<button class="btn go" data-a="rewardpack">Open ${packs === 1 ? 'your pack' : 'your packs'}</button>` : ''}
      <button class="btn ghost" data-a="menu">Menu</button>${next && !packs ? `<button class="btn go" data-a="story" data-v="${stageIdx + 1}">Next court</button>` : ''}
      <button class="btn${packs ? '' : ' go'}" data-a="rematch">${won ? 'Play again' : 'Try again'}</button></div></div>`;
  document.body.appendChild(o);
  sfx(won ? 'reward' : 'groan');
  if (R.shards) setTimeout(() => sfx('shard'), 900);
}
const closeEnd = (): void => document.getElementById('endModal')?.remove();

// ---------- clutch timing bar ----------
function clutchBar(): Promise<number> {
  return new Promise((res) => {
    const g = G!, coach = g.sides[0].coach;
    const c = 0.3 + Math.random() * 0.4;
    const o = document.createElement('div');
    o.className = 'clutch-ov';
    o.innerHTML = `<div class="clutch-box"><span class="cl-kick">CLUTCH SHOT · ${esc(CLUTCH_NAME[coach])}</span>
      <div class="cl-bar"><span class="cl-zone" style="left:${(c - CLUTCH.zone / 2) * 100}%;width:${CLUTCH.zone * 100}%"></span><span class="cl-perf" style="left:${(c - CLUTCH.perfect / 2) * 100}%;width:${CLUTCH.perfect * 100}%"></span><span class="cl-needle"></span></div>
      <span class="cl-hint">Tap when the needle is in the green. Center = PERFECT.</span><b class="cl-res"></b></div>`;
    document.body.appendChild(o);
    sfx('clutchRiser', { ms: 2400 }); spikeTension(5);
    const needle = o.querySelector<HTMLElement>('.cl-needle')!;
    const t0 = performance.now(), period = 1100;
    let x = 0, done = false, raf = 0;
    const tick = (t: number) => { const k = ((t - t0) % (period * 2)) / period; x = k <= 1 ? k : 2 - k; needle.style.left = x * 100 + '%'; if (!done) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    const stop = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      const bonus = clutchBonusAt(Math.abs(x - c));
      const r = o.querySelector<HTMLElement>('.cl-res')!;
      r.textContent = bonus >= CLUTCH.perf ? `PERFECT +${bonus}%` : bonus ? `CLUTCH +${bonus}%` : 'NO BONUS';
      o.classList.add(bonus >= CLUTCH.perf ? 'perfect' : bonus ? 'hit' : 'miss');
      sfx(bonus >= CLUTCH.perf ? 'moSurge' : bonus ? 'confirm' : 'back');
      window.removeEventListener('keydown', key, true);
      setTimeout(() => { o.remove(); res(bonus); }, 700);
    };
    const key = (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); stop(); } };
    o.addEventListener('pointerdown', stop);
    window.addEventListener('keydown', key, true);
    setTimeout(stop, 4500);
  });
}

async function shoot(): Promise<void> {
  const g = G!;
  if (!g.poss.zone) return;
  const bonus = g.poss.clutch && canClutch(g, 0) ? (reduced() ? CLUTCH.hit : await clutchBar()) : 0;
  if (!canClutch(g, 0)) g.poss.clutch = false;
  await doResolve(bonus);
}
async function cpuShoots(): Promise<void> {
  const g = G!;
  aiOffense(g, 1, stage!.skill);
  let bonus = 0;
  if (g.poss.clutch) { bonus = clutchTap(stage!.skill.sigma); if (!reduced()) { banner('CPU CLUTCH', CLUTCH_NAME[g.sides[1].coach], 'bad'); sfx('clutchRiser', { ms: 900 }); spikeTension(4); await new Promise((r) => setTimeout(r, 900)); } }
  rerender();
  await doResolve(bonus);
}

/** The card you just played shrinks and flies into the LOG button, where the play will be written down. */
function flyCard(from: DOMRect, c: CCard): void {
  if (reduced() || liteOn()) return;
  const to = document.querySelector<HTMLElement>('[data-a="log"]');
  if (!to) return;
  const t = to.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = `fly-card r-${c.rarity}`;
  el.innerHTML = `<b>${esc(effectTag(c).big)}</b><span>${esc(c.name)}</span>`;
  el.style.cssText = `left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px`;
  document.body.appendChild(el);
  const dx = t.left + t.width / 2 - (from.left + from.width / 2), dy = t.top + t.height / 2 - (from.top + from.height / 2);
  const a = el.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 40}px) scale(.6)`, opacity: 1, offset: 0.45 }, { transform: `translate(${dx}px, ${dy}px) scale(.08)`, opacity: 0.1 }], { duration: 700 * getSpeed() + 150, easing: 'cubic-bezier(.4,.1,.6,1)', fill: 'forwards' });
  a.onfinish = () => { el.remove(); to.classList.add('log-hit'); setTimeout(() => to.classList.remove('log-hit'), 700); };
  setTimeout(() => el.remove(), 1600);
}
/** Returns true when the action belonged to this screen. */
export function playAct(a: string, v: string | undefined): boolean {
  const P = profile();
  switch (a) {
    case 'coach': P.coach = v!; save(); rerender(); return true;
    case 'squad': ensureSquad(); UI.squadOpen = true; rerender(); return true;
    case 'slot': UI.slot = UI.slot === +v! ? null : +v!; UI.sqTab = 'b'; UI.sqMore = 0; rerender(); return true;
    case 'slotclose': UI.slot = null; rerender(); return true;
    case 'sqtab': UI.sqTab = v === 's' ? 's' : 'b'; UI.sqMore = 0; rerender(); return true;
    case 'sqmore': UI.sqMore += 40; rerender(); return true;
    case 'slotset': {
      const id = +v!, sq = P.squad, i = Math.min(UI.slot ?? 0, sq.length), j = sq.indexOf(id);
      if (i >= sq.length) { if (j >= 0) sq.splice(j, 1); sq.push(id); }
      else if (j >= 0) { [sq[i], sq[j]] = [sq[j], sq[i]]; }
      else { delete P.shoes[String(sq[i])]; sq[i] = id; }
      UI.slot = null; save(); rerender(); return true;
    }
    case 'sqdone': if (P.squad.length >= Math.min(SQUAD_SIZE, ownedBallerz().length)) { UI.squadOpen = false; UI.slot = null; rerender(); } return true;
    case 'shoeset': {
      const [b, s2] = v!.split(':').map(Number);
      for (const k of Object.keys(P.shoes)) if (P.shoes[k] === s2) delete P.shoes[k];
      if (s2) P.shoes[String(b)] = s2; else delete P.shoes[String(b)];
      UI.slot = null; save(); rerender(); return true;
    }
    case 'autoshoes': autoShoes(); rerender(); return true;
    case 'story': closeEnd(); startGame(+v!); return true;
    case 'quick': startGame(-1); return true;
    case 'rematch': closeEnd(); startGame(stageIdx); return true;
    case 'menu': closeEnd(); G = null; rerender(); return true;
    case 'rewardpack': closeEnd(); G = null; rerender(); openPending(); return true;
    case 'openpending': openPending(); return true;
    case 'claimms': { const r = claimMilestone(P, +v!); if (r.ok) { if (r.pack) P.pending.push(r.pack); save(); bucksChanged(); rerender(); if (r.pack) openPending(); } return true; }
    case 'quit': if (tutActive()) skipTutorial(); else { G = null; rerender(); } return true;
    case 'tutorial': startTutorialGame(); return true;
    case 'fast': setFast(!P.fast); setSpeed(P.fast ? 0.45 : 1); rerender(); return true;
    case 'logrow': selectLog(+v!); return true;
    case 'noop': return true;
    case 'baller': { if (!G) return true; const [sd, i, src] = v!.split(':'); UI.card = { side: +sd as Side, i: +i, bench: src === 'b' }; rerender(); return true; }
    case 'bcclose': UI.card = null; rerender(); return true;
    case 'log': if (!G) return true; UI.logOpen = true; UI.logSeen = G.feed.length; rerender(); tutNote('logopen'); return true;
    case 'logclose': if (!G) return true; UI.logOpen = false; UI.logSeen = G.feed.length; rerender(); tutNote('logclose'); return true;
    case 'cardclose': UI.cardView = null; rerender(); return true;
  }
  const g = G;
  const mine = ['shooter', 'zone', 'card', 'cardplay', 'bcshoot', 'clutch', 'shoot', 'scheme', 'match', 'dt', 'lock', 'next', 'subs', 'sub', 'subsclose'];
  if (!g || fxPlaying()) return !!g && mine.includes(a);
  switch (a) {
    case 'shooter': if (UI.phase === 'off' && shooterSlots(g, 0).includes(+v!)) { g.poss.shooter = +v!; UI.msg = ''; rerender(); tutNote('shooter', v); } return true;
    case 'zone': if (UI.phase === 'off' && !(g.poss.offCard?.fx.iso && v !== 'rim')) { g.poss.zone = v as Zone; UI.msg = ''; rerender(); tutNote('zone', v); } return true;
    case 'scheme': if (UI.phase === 'def') { g.poss.guard = v as Zone; UI.msg = ''; rerender(); tutNote('scheme', v); } return true;
    case 'match': if (UI.phase === 'def') { cycleMatch(g, 0, +v!); rerender(); } return true;
    case 'dt':
      if (UI.phase === 'def') {
        const i = +v!;
        if (g.poss.dt?.mark === i) setDT(g, 0, null);
        else if (!setDT(g, 0, i)) UI.msg = `A double team costs ${TUNING.dtCost} Momentum.`;
        else UI.msg = '';
        rerender();
        if (g.poss.dt?.mark === i) tutNote('dt', v);
      }
      return true;
    case 'clutch': if (UI.phase === 'off' && canClutch(g, 0)) { g.poss.clutch = !g.poss.clutch; rerender(); if (g.poss.clutch) tutNote('clutch'); } return true;
    case 'subs': UI.subOpen = true; rerender(); tutNote('subs'); return true;
    case 'subsclose': UI.subOpen = false; rerender(); tutNote('subsclose'); return true;
    case 'sub': {
      const [ci, bi] = v!.split(':').map(Number);
      const did = UI.phase !== 'result' && doSub(g, 0, ci, bi);
      if (did) { fixShooter(g); UI.msg = ''; }
      UI.subOpen = true; rerender();
      if (did) { sfx('subSwap'); tutNote('sub'); }
      return true;
    }
    case 'bcshoot': {
      const k = UI.card;
      if (k && v && UI.phase === 'off' && k.side === 0 && !k.bench && shooterSlots(g, 0).includes(k.i)) { g.poss.shooter = k.i; UI.msg = ''; tutNote('shooter', String(k.i)); }
      UI.card = null; rerender(); return true;
    }
    case 'card': { const i = +v!; if (g.sides[0].hand[i]) { UI.cardView = i; rerender(); } return true; }
    case 'cardplay': {
      const i = +v!, c = g.sides[0].hand[i];
      const from = document.querySelector('.cp')?.getBoundingClientRect() ?? null;
      UI.cardView = null;
      if (!c || UI.phase === 'result') { rerender(); return true; }
      const target = g.poss.dt?.mark ?? options(g, 1)[0].shooter;
      const off = g.poss.off === 0;
      const why = playBlock(g, 0, c);
      if (why) { UI.msg = why; rerender(); return true; }
      if (!playCard(g, 0, i, c.fx.dt ? target : 0)) { rerender(); return true; }
      UI.msg = '';
      if (off) fixShooter(g);
      rerender();
      sfx(c.fx.trap ? 'trapSet' : 'cardPlay', { v: c.rarity === 'iconic' || c.rarity === 'legendary' ? 1.2 : 1 });
      if (from) flyCard(from, c);
      if (!reduced()) callout(c.name.toUpperCase(), c.fx.trap ? null : tokEl(off ? 0 : 1, off ? g.poss.shooter : 1), 'cool', c.fx.trap ? 'Trap set' : c.text.split('.')[0]);
      tutNote('card', String(i));
      return true;
    }
    case 'shoot': if (UI.phase === 'off' && g.poss.zone) { UI.card = null; UI.cardView = null; tutNote('shoot'); void shoot(); } return true;
    case 'lock': if (UI.phase === 'def' && g.poss.guard) { UI.card = null; UI.cardView = null; tutNote('lock'); void cpuShoots(); } return true;
    case 'next':
      if (UI.phase !== 'result') return true;
      tutNote('next');
      if (g.over) { sfx('whistle'); finish(); return true; }
      nextPossession(g);
      beginPoss();
      return true;
  }
  return false;
}

/** Lab tool: plays a made-up possession on the court so the animations can be previewed (no game rules involved). */
export function previewPlay(kind: string): void {
  if (!G) startGame(-1);
  goPlay();
  const g = G!;
  if (fxPlaying()) return;
  const off = g.poss.off, def = (1 - off) as Side, T = g.sides[off].team;
  const o: Outcome = {
    side: off, shooter: 0, shooterId: T[0].id, passer: 1, zone: 'three', guard: 'rim', read: false, p: 41, made: true, pts: 3, turnover: null, traps: [], countered: null, putback: false,
    fireOn: false, fireOff: false, clutch: false, clutchBonus: 0, extra: false, revenge: [], iso: false, blocked: false, dt: null, defender: 0, offCard: null, defCard: null,
    andOne: false, a1p: 0, label: null, inhuman: false, notes: [], parts: [],
  };
  void def;
  if (kind === 'miss') { o.made = false; o.pts = 0; o.zone = 'mid'; o.guard = 'mid'; o.read = true; }
  if (kind === 'block') { o.made = false; o.pts = 0; o.zone = 'rim'; o.blocked = true; o.p = 1; o.traps = [{ name: 'Block Party', text: 'Block Party: the Rim shot is swatted away. Chance drops to 1%.' }]; }
  if (kind === 'steal') { o.turnover = 'Pick Pocket: stolen'; o.traps = [{ name: 'Pick Pocket', text: 'Pick Pocket: they picked it off. Turnover.' }]; }
  if (kind === 'dt') { o.dt = { mark: 1, open: 0 }; o.zone = 'mid'; }
  if (kind === 'rim') { o.zone = 'rim'; o.guard = 'three'; }
  if (kind === 'fire') { o.fireOn = true; T[0].streak = 2; }
  if (kind.startsWith('pv:')) {
    // pv:<zone>:<scheme>:<make|miss>[:flags]  flags (comma): dt, a1, block, big, small, s1, s2 (shooter slot)
    const [, zone, guard, res, fl = ''] = kind.split(':'), flags = fl.split(',');
    o.zone = zone as Zone; o.guard = guard as Zone; o.read = zone === guard; o.made = res === 'make'; o.pts = o.made ? ZONE_PTS[o.zone] : 0; o.p = o.read ? 34 : 52;
    const slot = flags.includes('s1') ? 1 : flags.includes('s2') ? 2 : 0;
    o.shooter = slot; o.shooterId = T[slot].id; o.passer = slot === 0 ? 1 : 0; o.defender = g.sides[def].match[slot];
    if (flags.includes('big')) { T[slot].pos = 'B'; T[slot].rim = 90; }
    if (flags.includes('small')) { T[slot].pos = 'G'; T[slot].rim = 60; }
    if (flags.includes('dt')) { o.dt = { mark: (slot + 1) % 3, open: slot }; o.read = false; }
    if (flags.includes('a1') && o.made) { o.andOne = true; o.pts += 1; }
    if (flags.includes('block')) { o.blocked = true; o.made = false; o.pts = 0; }
  }
  if (kind === 'g1') { o.label = 'GLITCHED'; o.p = 12; }
  if (kind === 'g2') { o.label = 'OVERCLOCKED'; o.p = 4; }
  if (kind === 'g3') { o.label = 'SYSTEM ERROR'; o.p = 1; o.inhuman = true; }
  rerender();
  setTimeout(() => { void play(steps(o)).then(() => rerender()); }, 60);
}
