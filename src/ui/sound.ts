// The sound settings sheet: master, effects and music volume, mute. Reachable from the top bar, the splash screen and the Lab.
// It lives on document.body (not in the re-rendered app), so a re-render never closes it while a slider is being dragged.
import { getAudio, setAudio, sfx, unlock } from './sfx';

const ID = 'sndSheet';
const ROWS: [keyof ReturnType<typeof getAudio> & ('master' | 'sfx' | 'music'), string][] = [['master', 'Master'], ['sfx', 'Effects'], ['music', 'Music']];

export const soundOpen = (): boolean => !!document.getElementById(ID);
export function speakerIcon(muted: boolean): string {
  return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor"/>${muted ? '<path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' : '<path d="M15.5 8.5a5 5 0 010 7M18 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'}</svg>`;
}
function paint(o: HTMLElement): void {
  const a = getAudio();
  for (const [k] of ROWS) {
    const inp = o.querySelector<HTMLInputElement>(`input[data-snd="${k}"]`), out = o.querySelector<HTMLOutputElement>(`output[data-for="${k}"]`);
    if (inp && document.activeElement !== inp) inp.value = String(Math.round(a[k] * 100));
    if (out) out.textContent = String(Math.round(a[k] * 100));
  }
  const m = o.querySelector<HTMLButtonElement>('.snd-mute');
  if (m) { m.setAttribute('aria-pressed', String(a.mute)); m.innerHTML = `${speakerIcon(a.mute)}<span>${a.mute ? 'Muted' : 'Sound on'}</span>`; m.classList.toggle('on', a.mute); }
  document.querySelectorAll<HTMLElement>('.snd-btn').forEach((b) => { b.innerHTML = speakerIcon(a.mute); b.classList.toggle('muted', a.mute); });
}
export function closeSound(): void { document.getElementById(ID)?.remove(); document.removeEventListener('keydown', onKey, true); }
function onKey(e: KeyboardEvent): void { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSound(); } }
export function openSound(): void {
  unlock();
  if (soundOpen()) return;
  const o = document.createElement('div');
  o.id = ID; o.className = 'snd-ov';
  o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'Sound settings');
  o.innerHTML = `<div class="snd-box"><div class="snd-h"><b>SOUND</b><button class="btn sm go snd-done" type="button">Done</button></div>
    ${ROWS.map(([k, t]) => `<label class="snd-row"><span>${t}</span><input type="range" min="0" max="100" step="1" data-snd="${k}" aria-label="${t} volume"><output data-for="${k}"></output></label>`).join('')}
    <div class="snd-act"><button class="btn snd-mute" type="button" aria-pressed="false"></button><button class="btn snd-test" type="button">Test</button></div>
    <p class="dim small snd-note">Saved in this browser. Music pauses when the tab is hidden.</p></div>`;
  document.body.appendChild(o);
  paint(o);
  o.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset?.snd) { setAudio({ [t.dataset.snd]: +t.value / 100 }); const out = o.querySelector<HTMLOutputElement>(`output[data-for="${t.dataset.snd}"]`); if (out) out.textContent = t.value; }
  });
  o.addEventListener('change', (e) => { if ((e.target as HTMLElement).dataset?.snd) { sfx('confirm'); paint(o); } });
  o.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === o || t.closest('.snd-done')) { closeSound(); return; }
    if (t.closest('.snd-mute')) { setAudio({ mute: !getAudio().mute }); paint(o); return; }
    if (t.closest('.snd-test')) { sfx('cardPlay'); window.setTimeout(() => sfx('swish'), 380); window.setTimeout(() => sfx('roar', { level: 0.5 }), 520); }
  });
  document.addEventListener('keydown', onKey, true);
  o.querySelector<HTMLElement>('input')?.focus();
}
/** Keeps the top-bar speaker icon in step with mute. */
export function syncSoundButtons(): void { paint(document.getElementById(ID) ?? document.body); }
export function soundAct(a: string): boolean {
  if (a === 'sound') { soundOpen() ? closeSound() : openSound(); return true; }
  return false;
}
