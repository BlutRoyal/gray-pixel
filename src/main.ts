// App shell: loads the catalog, renders the active tab and routes every [data-a] click.
import { initLite, installRecovery, cycleLite, liteLabel, liteOn } from './ui/lite';
installRecovery();
initLite();
import './style.css';
import './theme.css';
import catalogData from './data/catalog.json';
import { loadCatalog, type Catalog } from './rules';
import { deckAct, deckHTML, initDeck } from './ui/deck';
import { collectionAct, collectionHTML, initCollection } from './ui/collection';
import { howHTML } from './ui/how';
import { loadTuning } from './casual/tuning';
import { initLab, labAct, labHTML } from './ui/lab';
import { initPacks, packsAct, packsHTML } from './ui/packs';
import { ensureSquad, inGame, initPlay, playAct, playHTML, startTutorialGame, storyHTML } from './ui/play';
import { setSpeed } from './ui/fx';
import { loadPackFile, unlockAudio } from './ui/beat';
import { BOOT_LINES, GAME_TAGLINE, SPLASH_PROMPT, SPLASH_HINT } from './ui/lore';
import { esc } from './ui/views';
import { tutSync, tutorialAct } from './ui/tutorial';
import { profile } from './ui/store';
import { bindTilt } from './ui/views';
import { strayHTML, wordmarkSVG } from './ui/wordmark';
import './gray.css';
import './mobile.css';
import './lite.css';

loadCatalog(catalogData as Catalog);

type Tab = 'play' | 'story' | 'packs' | 'collection' | 'deck' | 'how' | 'lab';
const TABS: [Tab, string][] = [['play', 'Play'], ['story', 'Story'], ['packs', 'Packs'], ['collection', 'Collection'], ['deck', 'Deck'], ['how', 'How'], ['lab', 'Lab']];
let tab: Tab = 'play';
let lastTab: Tab | null = null;
try { const t = sessionStorage.getItem('ballerz_tab') as Tab | null; if (t && TABS.some(([k]) => k === t)) tab = t; } catch { /* no storage */ }
const app = document.getElementById('app')!;

function topBar(): string {
  return `<header class="top">
    <div class="brand"><span class="logo" role="img" aria-label="Gray Pixel">${wordmarkSVG('wm-top')}</span><span class="logo-sub">${esc(GAME_TAGLINE)}</span></div>
    <span class="wallet"><span class="bucks" title="Bucks: earned by playing, spent on packs"><i aria-hidden="true">B$</i><b id="bucks">${profile().bucks}</b></span>
    <span class="bucks shards" title="Shards: level up your Ballerz in Collection"><i aria-hidden="true">SH</i><b id="shardsn">${profile().shards}</b></span></span>
    <nav class="tabs" aria-label="Main">${TABS.map(([k, t]) => `<button data-a="tab" data-v="${k}" class="${tab === k ? 'on' : ''}" ${tab === k ? 'aria-current="page"' : ''}>${t}${k === 'play' && inGame() ? ' ●' : ''}</button>`).join('')}</nav>
  </header>`;
}
function body(): string {
  switch (tab) {
    case 'play': return playHTML();
    case 'story': return storyHTML();
    case 'packs': return packsHTML();
    case 'collection': return collectionHTML();
    case 'deck': return deckHTML();
    case 'how': return howHTML();
    case 'lab': return labHTML();
  }
}
/** A single gray pixel blinks in a random wrong place when the screen changes. */
function strayFlash(): void {
  const d = document.createElement('div');
  d.innerHTML = strayHTML('flash');
  const i = d.firstElementChild as HTMLElement;
  i.style.left = 8 + Math.random() * 84 + 'vw'; i.style.top = 6 + Math.random() * 60 + 'vh';
  document.body.appendChild(i);
  setTimeout(() => i.remove(), 700);
}
function render(): void {
  const y = window.scrollY;
  app.innerHTML = topBar() + `<main class="screen s-${tab}${tab === 'play' && inGame() ? ' in-game' : ''}">${body()}</main>`;
  document.body.classList.toggle('crt-on', profile().crt);
  document.body.dataset.tab = tab;
  document.body.classList.toggle('game-on', tab === 'play' && inGame());
  window.scrollTo(0, y);
  // a short glitch-in when the screen changes
  if (lastTab !== null && lastTab !== tab) { const m = app.querySelector('main'); m?.classList.add('glitch-in'); setTimeout(() => m?.classList.remove('glitch-in'), 450); strayFlash(); }
  lastTab = tab;
  tutSync();
}
const refreshBucks = (): void => { const b = document.getElementById('bucks'); if (b) b.textContent = String(profile().bucks); const sh = document.getElementById('shardsn'); if (sh) sh.textContent = String(profile().shards); };
loadTuning();
initPlay(render, refreshBucks, () => { tab = 'play'; });
void loadPackFile();
ensureSquad();
initPacks(render);
initCollection(render);
initDeck(render);
initLab(render);

function onLite(): void { setSpeed(profile().fast ? 0.45 : 1); render(); }
function act(a: string, v: string | undefined): void {
  if (a === 'tab') {
    tab = v as Tab;
    try { sessionStorage.setItem('ballerz_tab', tab); } catch { /* no storage */ }
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (a === 'lite') { cycleLite(); const b = document.querySelector<HTMLElement>('.boot-lite'); if (b) b.textContent = `Lite mode: ${liteLabel()}`; onLite(); return; }
  if (a === 'tutgo') { document.getElementById('endModal')?.remove(); playAct('menu', undefined); act('tab', v); return; }
  if (a === 'topacks') { document.querySelector('.overlay')?.remove(); act('tab', 'packs'); return; }
  tutorialAct(a) || playAct(a, v) || packsAct(a, v) || collectionAct(a, v) || deckAct(a, v) || labAct(a, v);
}
document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  act(el.dataset.a!, el.dataset.v);
});
document.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement;
  if ((e.key === 'Enter' || e.key === ' ') && t.dataset && t.dataset.a && t.tagName !== 'BUTTON') { e.preventDefault(); act(t.dataset.a, t.dataset.v); }
});
// Real Ballerz and Sneakerz images come from ballerz.cloud. When a host blocks them (or you're offline), the image is dropped
// and its frame gets .noimg, which shows the card number (Ballerz) or a drawn shoe (Sneakerz) on the team-colour background.
document.addEventListener('error', (e) => {
  const t = e.target;
  if (!(t instanceof HTMLImageElement)) return;
  if (t.dataset.fb) { t.parentElement?.classList.add('noimg'); t.remove(); }
  else if (t.dataset.fbText) { const span = document.createElement('span'); span.textContent = t.dataset.fbText; t.replaceWith(span); }
}, true);
bindTilt(app);
render();
/** Splash on every fresh load: the Grid "loads", then waits for a tap or key press (which also unlocks Web Audio). */
function splash(): void {
  const o = document.createElement('div');
  o.className = 'boot splash';
  o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', 'Gray Pixel');
  o.innerHTML = `<div class="boot-in"><span class="boot-t" role="img" aria-label="Gray Pixel">${wordmarkSVG('wm-boot')}</span><p class="boot-sub">${esc(GAME_TAGLINE)}</p><ol>${BOOT_LINES.map((l, i) => `<li style="--i:${i}">${esc(l)}</li>`).join('')}</ol><i class="boot-bar"></i><p class="boot-go"><b>${esc(SPLASH_PROMPT)}</b><i class="stray" aria-hidden="true"></i><small>${esc(SPLASH_HINT)}</small></p><button class="boot-lite" data-a="lite" type="button">Lite mode: ${esc(liteLabel())}</button></div>`;
  document.body.appendChild(o);
  const go = (e: Event): void => {
    if ((e.target as HTMLElement | null)?.closest?.('.boot-lite')) return;
    if (e instanceof KeyboardEvent && (e.key === 'Tab' || e.metaKey || e.ctrlKey || e.altKey)) return;
    e.preventDefault();
    document.removeEventListener('keydown', go, true); o.removeEventListener('pointerdown', go);
    unlockAudio();
    o.classList.add('out');
    strayFlash();
    setTimeout(() => o.remove(), 420);
    // a brand-new profile goes straight into the guided game; everyone else lands on the title / Play hero
    if (profile().tut.state === 'new') startTutorialGame();
  };
  document.addEventListener('keydown', go, true);
  o.addEventListener('pointerdown', go);
}
splash();
