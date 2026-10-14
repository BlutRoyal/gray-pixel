// Lite mode: a lighter look (no blend modes, blur, full-screen overlays or endless animations, shorter lists, no web fonts).
// It is OFF everywhere by default and never turns itself on: the only switch is the dev Lab (behind the password), stored in localStorage.
// The key is new on purpose: the old 'gp_lite' value could have been written by the removed auto-detection, so it is ignored.
const KEY = 'gp_lite_dev';
let on = false;

function rd(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function wr(k: string, v: string | null): void { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* no storage */ } }
function apply(): void { document.documentElement.classList.toggle('lite', on); }
export const liteOn = (): boolean => on;
export const liteLabel = (): string => (on ? 'On' : 'Off');
/** Lab switch. Fonts and heavy layers apply at once; the rest on the next render. */
export function setLite(v: boolean): void { on = v; wr(KEY, v ? '1' : null); apply(); }
export function toggleLite(): void { setLite(!on); }

/** Web fonts load without blocking the first paint, and not at all in lite mode. */
function loadFonts(): void {
  if (on || document.getElementById('gp-fonts')) return;
  const l = document.createElement('link');
  l.id = 'gp-fonts'; l.rel = 'stylesheet'; l.media = 'print';
  l.href = 'https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&family=Press+Start+2P&family=Pixelify+Sans:wght@400..700&family=Space+Mono:wght@400;700&display=swap';
  l.onload = () => { l.media = 'all'; };
  document.head.appendChild(l);
}

export function initLite(): void {
  on = rd(KEY) === '1';
  apply();
  loadFonts();
}

/** Last-resort screen for an uncaught error: no loop, one card, a way to reload. */
export function installRecovery(): void {
  let shown = false, count = 0, windowStart = 0;
  const show = (msg: string): void => {
    if (shown || !document.body) return;
    shown = true;
    const d = document.createElement('div');
    d.className = 'recover';
    d.setAttribute('role', 'alertdialog');
    d.innerHTML = '<div><b>Something broke</b><p></p><button data-r="reload">Reload</button><button data-r="close">Keep going</button></div>';
    (d.querySelector('p') as HTMLElement).textContent = msg.slice(0, 140);
    d.addEventListener('click', (e) => {
      const r = (e.target as HTMLElement).dataset?.r;
      if (r === 'reload') location.reload();
      else if (r === 'close') { d.remove(); }
    });
    document.body.appendChild(d);
  };
  const hit = (msg: string): void => {
    const now = Date.now();
    if (now - windowStart > 3000) { windowStart = now; count = 0; }
    if (++count > 20) return; // an error storm: stop handling, never loop
    show(msg);
  };
  window.addEventListener('error', (e) => {
    if (e.target && e.target !== window) return; // a failed image or script tag, handled elsewhere
    if (/ResizeObserver/.test(e.message || '')) return;
    hit(e.message || 'Unexpected error');
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as { message?: string } | string | undefined;
    hit(typeof r === 'string' ? r : r?.message || 'Unexpected error');
  });
}
