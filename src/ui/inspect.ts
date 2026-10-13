// Close-up card view: one big centred card with hover/touch tilt and holo sheen, the card's own stats and text, and a short info line (tier, level).
// Prev/next by arrows, keys or swipe; closes on X, Escape or a tap outside the card. Used by the pack pile and summary, the Collection and the Deck list.
import { bindTilt, fitCards, reduced } from './views';

export interface InspectItem { html: string; info?: string; foil?: boolean }
let items: InspectItem[] = [], at = 0, root: HTMLElement | null = null;

const FOIL = '<span class="foilfx" aria-hidden="true"></span>';
function render(): void {
  if (!root || !items.length) return;
  const it = items[at], n = items.length;
  root.innerHTML = `<button class="insp-x" data-inspect="close" aria-label="Close close-up">×</button>
    <div class="insp-row"><button class="insp-nav" data-inspect="prev" aria-label="Previous card" ${n < 2 ? 'hidden' : ''}>‹</button>
      <div class="insp-card${it.foil ? ' foil-on' : ''}" data-hit="card"><div class="insp-scale">${it.html}</div>${it.foil ? FOIL : ''}</div>
      <button class="insp-nav" data-inspect="next" aria-label="Next card" ${n < 2 ? 'hidden' : ''}>›</button></div>
    <p class="insp-info">${it.info ? it.info : ''}</p>${n > 1 ? `<p class="insp-count">${at + 1} / ${n} · swipe or use the arrows</p>` : ''}`;
  root.setAttribute('aria-label', 'Card close-up');
  root.querySelector<HTMLElement>('.insp-x')?.focus({ preventScroll: true });
  scale();
}
/** The card is laid out at its design size (300 x 420) and scaled up, so every text keeps its proportions; then the text is fitted. */
function scale(): void {
  const box = root?.querySelector<HTMLElement>('.insp-card');
  if (!box) return;
  box.style.setProperty('--k', String(box.clientWidth / 300));
  if (root) fitCards(root);
}
export function closeInspect(): void { root?.remove(); root = null; items = []; }
export function isInspecting(): boolean { return !!root; }
export function openInspect(list: InspectItem[], idx = 0): void {
  if (!list.length) return;
  items = list; at = Math.max(0, Math.min(idx, list.length - 1));
  if (!root) {
    root = document.createElement('div');
    root.id = 'inspect'; root.className = 'overlay insp'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
    document.body.appendChild(root);
    bindTilt(root);
    let sx = 0, sy = 0, down = false;
    root.addEventListener('pointerdown', (e) => { down = true; sx = e.clientX; sy = e.clientY; });
    root.addEventListener('pointerup', (e) => {
      if (!down) return; down = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dy) < 70) go(dx < 0 ? 1 : -1);
    });
    root.addEventListener('click', (e) => {
      e.stopPropagation();
      const t = e.target as HTMLElement, b = t.closest<HTMLElement>('[data-inspect]');
      if (b) { const a = b.dataset.inspect; if (a === 'close') closeInspect(); else go(a === 'next' ? 1 : -1); return; }
      if (!t.closest('[data-hit="card"]')) closeInspect(); // a tap outside the card
    });
  }
  render();
}
function go(d: number): void { if (items.length < 2) return; at = (at + d + items.length) % items.length; render(); }

/** The card elements around a tapped card become the swipe list (the same pack, collection page or pile). */
function fromDom(card: HTMLElement, box: HTMLElement): { list: InspectItem[]; idx: number } {
  const cards = Array.from(box.querySelectorAll<HTMLElement>('.card')).filter((c) => !c.closest('#inspect'));
  const list = cards.map((c) => {
    const wrap = c.closest<HTMLElement>('.cwrap, .sum-card, .pile-card') ?? c.parentElement!;
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
    if (!card || card.closest('#inspect, .flip.solo, .hcard, button, [data-a]')) return;
    const box = card.closest<HTMLElement>('.sum-grid, .op-pile, .card-grid');
    if (!box) return;
    const { list, idx } = fromDom(card, box);
    openInspect(list, idx);
  });
  document.addEventListener('keydown', (e) => {
    if (!root) return;
    if (e.key === 'Escape') { e.preventDefault(); closeInspect(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  });
  void reduced;
  window.addEventListener('resize', scale);
}
