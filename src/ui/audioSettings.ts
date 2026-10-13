// Sound settings (master, SFX and music volume, mute), kept in localStorage. DOM-free so it can be tested.
// Every storage access is guarded: storage can be missing or blocked and the game must still work.
export interface AudioSettings { master: number; sfx: number; music: number; mute: boolean }
export const AUDIO_KEY = 'gp_audio';
/** Defaults for NEW players only (saved settings are never touched). Raise or lower them here. */
export const DEFAULT_AUDIO: AudioSettings = { master: 0.5, sfx: 0.6, music: 0.4, mute: false };

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const store = (): Store | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };

export const clamp01 = (n: unknown, d: number): number => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : d);

/** Reads settings from a JSON string; anything missing or broken falls back to the defaults. */
export function parseSettings(raw: string | null | undefined): AudioSettings {
  const d = DEFAULT_AUDIO;
  if (!raw) return { ...d };
  try {
    const o = JSON.parse(raw) as Partial<AudioSettings> | null;
    if (!o || typeof o !== 'object') return { ...d };
    return { master: clamp01(o.master, d.master), sfx: clamp01(o.sfx, d.sfx), music: clamp01(o.music, d.music), mute: o.mute === true };
  } catch { return { ...d }; }
}
export function loadSettings(s: Store | null = store()): AudioSettings {
  try { return parseSettings(s ? s.getItem(AUDIO_KEY) : null); } catch { return { ...DEFAULT_AUDIO }; }
}
export function saveSettings(a: AudioSettings, s: Store | null = store()): boolean {
  try { if (!s) return false; s.setItem(AUDIO_KEY, JSON.stringify(a)); return true; } catch { return false; }
}
/** Slider position to gain: a squared curve feels even to the ear. Mute zeroes everything. */
export function effectiveGains(a: AudioSettings): { master: number; sfx: number; music: number } {
  if (a.mute) return { master: 0, sfx: 0, music: 0 };
  return { master: a.master * a.master, sfx: a.sfx * a.sfx, music: a.music * a.music };
}
