// Lite mode: a lighter look for weak phones and in-app webviews (no blend modes, blur, full-screen overlays or endless animations,
// shorter lists, no web fonts). Setting in localStorage ('1' on, '0' off, absent = auto-detect). Every storage access is guarded.
const KEY = 'gp_lite';
const BOOT = 'gp_boot';
let on = false;
let mode: 'auto' | 'on' | 'off' = 'auto';
let why = '';

function rd(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function wr(k: string, v: string | null): void { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* no storage */ } }
const mm = (q: string): boolean => { try { return matchMedia(q).matches; } catch { return false; } };

/** Why auto-detect would turn lite on ('' = it would not). */
export function detectReason(): string {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const small = Math.min(screen.width || 9999, screen.height || 9999, innerWidth) <= 820;
  if (mm('(pointer: coarse)') && small) return 'touch screen';
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4) return 'low memory';
  const ua = navigator.userAgent || '';
  if (/; wv\)|\bwv\b|FBAN|FBAV|Instagram|GSA\/|Line\/|MicroMessenger|Claude/i.test(ua)) return 'in-app browser';
  if (/iPhone|iPod|iPad/.test(ua) && !/Safari\//.test(ua)) return 'in-app browser';
  try { if (window.self !== window.top) return 'embedded page'; } catch { return 'embedded page'; }
  return '';
}
function apply(): void {
  document.documentElement.classList.toggle('lite', on);
  const meta = document.querySelector('meta[name="viewport"]');
  void meta;
}
export const liteOn = (): boolean => on;
export const liteMode = (): 'auto' | 'on' | 'off' => mode;
export const liteWhy = (): string => (on ? (mode === 'on' ? 'set by you' : why || 'auto') : '');
export function liteLabel(): string { return mode === 'auto' ? `Auto (${on ? 'on' : 'off'})` : mode === 'on' ? 'On' : 'Off'; }

function resolve(): void {
  const s = rd(KEY);
  mode = s === '1' ? 'on' : s === '0' ? 'off' : 'auto';
  if (mode === 'on') { on = true; why = 'set by you'; }
  else if (mode === 'off') { on = false; why = ''; }
  else { why = detectReason(); on = !!why; }
  apply();
}
/** Cycles Auto, On, Off. Fonts and heavy layers apply at once; the rest on the next render. */
export function cycleLite(): void {
  const next = mode === 'auto' ? '1' : mode === 'on' ? '0' : null;
  wr(KEY, next);
  resolve();
}
export function forceLite(): void { wr(KEY, '1'); resolve(); }

/** Web fonts load without blocking the first paint, and not at all in lite mode. */
function loadFonts(): void {
  if (on || document.getElementById('gp-fonts')) return;
  const l = document.createElement('link');
  l.id = 'gp-fonts'; l.rel = 'stylesheet'; l.media = 'print';
  l.href = 'https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&family=Press+Start+2P&family=Pixelify+Sans:wght@400..700&family=Space+Mono:wght@400;700&display=swap';
  l.onload = () => { l.media = 'all'; };
  document.head.appendChild(l);
}

/** Crash-loop and slow-frame detectors. */
function watch(): void {
  // a boot that never reached "ok" (the page died or was killed) counts as a crash; two in a row switch lite on for good
  let n = 0;
  try { n = +(sessionStorage.getItem(BOOT) || '0'); } catch { /* none */ }
  if (n >= 1 && mode === 'auto') { forceLite(); why = 'the last start did not finish'; }
  try { sessionStorage.setItem(BOOT, String(n + 1)); } catch { /* none */ }
  setTimeout(() => { try { sessionStorage.removeItem(BOOT); } catch { /* none */ } }, 6000);
  // long frames: under about 12 fps for 2.5 s on the splash or title and lite turns itself on
  if (on || mode !== 'auto' || typeof requestAnimationFrame !== 'function') return;
  let frames = 0, slow = 0, last = 0;
  const t0 = performance.now();
  const step = (t: number): void => {
    if (last) { frames++; if (t - last > 90) slow++; }
    last = t;
    if (t - t0 < 2500) { requestAnimationFrame(step); return; }
    if (frames > 5 && slow / frames > 0.4 && !on) { forceLite(); why = 'slow frames'; mode = 'auto'; wr(KEY, null); on = true; apply(); }
  };
  requestAnimationFrame(step);
}
export function initLite(): void {
  resolve();
  loadFonts();
  watch();
}

/** Last-resort screen for an uncaught error: no loop, one card, a way back to a light version. */
export function installRecovery(): void {
  let shown = false, count = 0, windowStart = 0;
  const show = (msg: string): void => {
    if (shown || !document.body) return;
    shown = true;
    const d = document.createElement('div');
    d.className = 'recover';
    d.setAttribute('role', 'alertdialog');
    d.innerHTML = '<div><b>Something broke</b><p></p><button data-r="lite">Reset to lite mode</button><button data-r="reload">Reload</button><button data-r="close">Keep going</button></div>';
    (d.querySelector('p') as HTMLElement).textContent = msg.slice(0, 140);
    d.addEventListener('click', (e) => {
      const r = (e.target as HTMLElement).dataset?.r;
      if (r === 'lite') { forceLite(); try { sessionStorage.removeItem(BOOT); } catch { /* none */ } location.reload(); }
      else if (r === 'reload') location.reload();
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
