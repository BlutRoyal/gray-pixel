// Browser-side half of the offline audio renderer (bundled by tools/audio-render.ts). Renders sounds and music loops with the
// same recipes the game uses, through the same master chain, into stereo Float32 buffers.
import { DEFAULT_AUDIO, effectiveGains } from '../src/ui/audioSettings';
import { SOUNDS, type SfxName, type SfxOpts } from '../src/ui/sounds';
import { buildChain, voiceRig } from '../src/ui/synth';
import { TRACKS, buildBuses, type TrackName } from '../src/ui/tracks';
import { MUSIC_TRIMS } from '../src/ui/trims';

const SR = 48000;
function pack(buf: AudioBuffer): { sr: number; l: string; r: string } {
  const enc = (a: Float32Array): string => { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
  return { sr: buf.sampleRate, l: enc(buf.getChannelData(0)), r: enc(buf.getChannelData(1)) };
}
const gains = effectiveGains(DEFAULT_AUDIO);
export async function renderSfx(name: SfxName, o: SfxOpts, lite = false, trim?: number): Promise<ReturnType<typeof pack>> {
  const probe = new OfflineAudioContext(2, SR, SR);
  const def = SOUNDS[name], tr = trim ?? def.trim;
  // the recipe returns its length; render long enough for it plus the reverb tail
  const dry = buildChain(probe, probe.destination, lite);
  const len = def.fn(voiceRig(dry.sfxRig, tr), 0.02, o);
  const ctx = new OfflineAudioContext(2, Math.ceil((len + 1.2) * SR), SR);
  const chain = buildChain(ctx, ctx.destination, lite);
  chain.master.gain.value = gains.master; chain.sfx.gain.value = gains.sfx; chain.music.gain.value = gains.music;
  def.fn(voiceRig(chain.sfxRig, tr), 0.02, o);
  return pack(await ctx.startRendering());
}
export async function renderMusic(name: TrackName, intensity: number, lite = false, loops = 1, trim?: number): Promise<ReturnType<typeof pack>> {
  const tr = TRACKS[name], s16 = 60 / tr.bpm / 4, secs = tr.len * s16 * loops;
  const ctx = new OfflineAudioContext(2, Math.ceil((secs + 1.5) * SR), SR);
  const chain = buildChain(ctx, ctx.destination, lite);
  chain.master.gain.value = gains.master; chain.sfx.gain.value = gains.sfx; chain.music.gain.value = gains.music;
  const out = ctx.createGain(); out.gain.value = trim ?? MUSIC_TRIMS[name] ?? 0.6; out.connect(chain.music);
  const b = buildBuses(ctx, out, chain.musicSends, lite);
  for (let n = 0; n < tr.len * loops; n++) { const i = n % tr.len; tr.step(b, i, 0.05 + n * s16 + ((i & 1) ? tr.swing * s16 : 0), s16, name === 'pack' ? 1 : intensity); }
  return pack(await ctx.startRendering());
}
