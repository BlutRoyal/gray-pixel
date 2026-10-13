// Close-up card view: one big centred card with hover/touch tilt and holo sheen, the card's own stats and text, and a short info line (tier, level).
// Prev/next by arrows, keys or swipe; closes on X, Escape or a tap outside the card. Used by the pack pile and summary, the Collection and the Deck list.
import { bindTilt, fitCards, reduced } from './views';
import { backFromFront } from './cardback';

export interface InspectItem { html: string; info?: string; foil?: boolean; /** the back of the card (default: built from the front's data-ck) */ back?: string }
let items: InspectItem[] = [], at = 0, root: HTMLElement | null = null, flipped = false, swiped = false, flipTimer = 0;

const FOIL = '<span class="foilfx" aria-hidden="true"></span>';
function render(): void {
  if (!root || !items.length) return;
  const it = items[at], n = items.length, back = it.back ?? backFromFront(it.html);
  root.innerHTML = `<button class="insp-x" data-inspect="close" aria-label="Close close-up">×</button>
    <div class="insp-row"><button class="insp-nav" data-inspect="prev" aria-label="Previous card" ${n < 2 ? 'hidden' : ''}>‹</button>
      <div class="insp-card${it.foil ? ' foil-on' : ''}" data-hit="card"><div class="insp-scale"><div class="insp-flip${flipped && back ? ' flipped' : ''}"><div class="if-face if-front">${it.html}</div>${back ? `<div class="if-face if-back">${back}</div>` : ''}</div></div>${it.foil ? FOIL : ''}</div>
      <button class="insp-nav" data-inspect="next" aria-label="Next card" ${n < 2 ? 'hidden' : ''}>›</button></div>
    <p class="insp-info">${it.info ? it.info : ''}</p>
    ${back ? `<button class="btn sm insp-flipbtn" data-inspect="flip" aria-label="Flip the card over">${flipped ? 'SEE FRONT' : 'FLIP'}</button>` : ''}
    ${n > 1 ? `<p class="insp-count">${at + 1} / ${n} · swipe or use the arrows${back ? ' · tap the card to flip' : ''}</p>` : back ? '<p class="insp-count">tap the card to flip</p>' : ''}`;
  root.setAttribute('aria-label', 'Card close-up');
  root.querySelector<HTMLElement>('.insp-x')?.focus({ preventScroll: true });
  scale();
}
/** Turns the close-up over (front <-> back) with a 3D flip. */
function flip(): void {
  const f = root?.querySelector<HTMLElement>('.insp-flip');
  if (!f || !f.querySelector('.if-back')) return;
  flipped = !flipped;
  f.classList.toggle('flipped', flipped);
  const card = root!.querySelector<HTMLElement>('.insp-card');
  card?.classList.add('turning'); clearTimeout(flipTimer); flipTimer = window.setTimeout(() => card?.classList.remove('turning'), 900);
  const b = root!.querySelector<HTMLElement>('.insp-flipbtn'); if (b) b.textContent = flipped ? 'SEE FRONT' : 'FLIP';
}
/** The card is laid out at its design size (300 x 420) and scaled up, so every text keeps its proportions; then the text is fitted. */
function scale(): void {
  const box = root?.querySelector<HTMLElement>('.insp-card');
  if (!box) return;
  box.style.setProperty('--k', String(box.clientWidth / 300));
  if (root) fitCards(root);
}
export function closeInspect(): void { root?.remove(); root = null; items = []; flipped = false; }
export function isInspecting(): boolean { return !!root; }
export function openInspect(list: InspectItem[], idx = 0): void {
  if (!list.length) return;
  items = list; at = Math.max(0, Math.min(idx, list.length - 1)); if (!root) flipped = false;
  if (!root) {
    root = document.createElement('div');
    root.id = 'inspect'; root.className = 'overlay insp'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
    document.body.appendChild(root);
    bindTilt(root);
    let sx = 0, sy = 0, down = false;
    root.addEventListener('pointerdown', (e) => { down = true; swiped = false; sx = e.clientX; sy = e.clientY; });
    root.addEventListener('pointerup', (e) => {
      if (!down) return; down = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dy) < 70) { swiped = true; go(dx < 0 ? 1 : -1); } else if (Math.abs(dx) > 8 || Math.abs(dy) > 8) swiped = true;
    });
    root.addEventListener('click', (e) => {
      e.stopPropagation();
      const t = e.target as HTMLElement, b = t.closest<HTMLElement>('[data-inspect]');
      if (b) { const a = b.dataset.inspect; if (a === 'close') closeInspect(); else if (a === 'flip') flip(); else go(a === 'next' ? 1 : -1); return; }
      if (!t.closest('[data-hit="card"]')) closeInspect(); // a tap outside the card
      else if (!swiped) flip(); // a tap on the card turns it over
    });
  }
  render();
}
function go(d: number): void { if (items.length < 2) return; at = (at + d + items.length) % items.length; flipped = false; render(); }

/** The card elements around a tapped card become the swipe list (the same pack, collection page or pile). */
function fromDom(card: HTMLElement, box: HTMLElement): { list: InspectItem[]; idx: number } {
  // during an opening: the pile in order, then the featured (last, face up) card in front of it
  const solo = box.querySelector<HTMLElement>('.flip.solo.shown');
  const cards = Array.from(box.querySelectorAll<HTMLElement>('.card')).filter((c) => !c.closest('#inspect') && !c.closest('.flip.solo'));
  if (solo) { const f = solo.querySelector<HTMLElement>('.front .card'); if (f) cards.push(f); }
  const list = cards.map((c) => {
    const wrap = c.closest<HTMLElement>('.cwrap, .sum-card, .pile-card, .flip.solo') ?? c.parentElement!;
    const parts = [wrap.querySelector('.lvbox b')?.textContent, wrap.querySelector('.dupe b')?.textContent].filter(Boolean).map((x) => (x as string).replace(/[<&]/g, ''));
    const tier = c.querySelector('.tier-tag')?.textContent;
    return { html: c.outerHTML.replace(/\sdata-a="[^"]*"/g, ''), info: [tier, ...parts].filter(Boolean).join(' · '), foil: !!wrap.querySelector('.foilfx') || c.classList.contains('holo') };
  });
  return { list, idx: Math.max(0, cards.indexOf(card)) };
}
export function initInspect(): void {
  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const card = t.closest<HTMLElement>('.card');
    const featured = !!card?.closest('.flip.solo.shown.final');
    if (!card || card.closest('#inspect, .hcard, button') || (!featured && card.closest('.flip.solo, [data-a]'))) return;
    const box = featured ? card.closest<HTMLElement>('.op-stage') : card.closest<HTMLElement>('.sum-grid, .op-pile, .card-grid');
    if (!box) return;
    const { list, idx } = fromDom(card, box);
    openInspect(list, idx);
  });
  document.addEventListener('keydown', (e) => {
    if (!root) return;
    if (e.key === 'Escape') { e.preventDefault(); closeInspect(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); flip(); }
  });
  void reduced;
  window.addEventListener('resize', scale);
}
