// Offline audio check: renders every sound and music loop with OfflineAudioContext in headless Chromium (the same recipes and master chain as
// the game), writes WAVs, analyses them and prints a level table. Usage:
//   npx tsx tools/audio-render.ts [--out dir] [--calibrate] [--write]
//   --calibrate  iterate per-sound / per-track gains toward the class targets;  --write  save them to src/ui/trims.ts
// Needs Playwright (PW_PATH, default /opt/node-tools/node_modules/playwright) and Chromium (CHROME, default /opt/pw-browsers/chromium-1194/chrome-linux/chrome).
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SOUNDS, type SfxName, type SfxOpts } from '../src/ui/sounds';
import { MUSIC_TRIMS } from '../src/ui/trims';
import { analyze, wav, type Stats } from './audio-analysis';

const args = process.argv.slice(2);
const flag = (f: string): boolean => args.includes(f);
const outDir = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'audio-out';
const TARGET = { ui: -21, play: -16.5, big: -14 } as const; // momentary (300 ms) loudness, LUFS-ish
const MUSIC_TARGET: Record<string, number> = { pack: -20, game: -22, title: -26 };

// parameters for sounds that take options
const OPTS: Partial<Record<SfxName, SfxOpts[]>> = {
  moTick: [{ level: 0.3 }, { level: 0.9 }], roar: [{ level: 0.2 }, { level: 0.6 }, { level: 1 }],
  packCharge: [{ ms: 1000, rank: 1, i: 0 }, { ms: 1400, rank: 3, i: 2 }, { ms: 2200, rank: 5, i: 4 }],
  packReveal: [0, 1, 2, 3, 4, 5].map((rank) => ({ rank, i: rank })), packRip: [{ rank: 0 }, { rank: 5 }], flipSlap: [{ rank: 0, v: 0.75 }, { rank: 4 }, { rank: 5 }], venitus: [{ ms: 3400, rank: 4 }, { ms: 3800, rank: 5 }, { ms: 4200, rank: 5, level: 1 }], hitEpic: [{ rank: 3 }], hitLegendary: [{ rank: 4 }], hitHolo: [{}], clutchRiser: [{ ms: 2400 }], bounce: [{ power: 0.3 }, { power: 1 }],
};
interface Case { key: string; name: SfxName; o: SfxOpts; lite?: boolean }
const cases: Case[] = [];
for (const name of Object.keys(SOUNDS) as SfxName[]) {
  const list = OPTS[name] ?? [{}];
  list.forEach((o, k) => cases.push({ key: list.length > 1 ? `${name}#${k}` : name, name, o }));
}
cases.push({ key: 'glitch3 (lite)', name: 'glitch3', o: {}, lite: true }, { key: 'packReveal#5 (lite)', name: 'packReveal', o: { rank: 5, i: 5 }, lite: true });
const music: { key: string; track: string; I: number; lite?: boolean }[] = [
  { key: 'music pack', track: 'pack', I: 1 }, { key: 'music pack (lite)', track: 'pack', I: 1, lite: true },
  { key: 'music game I=0.1', track: 'game', I: 0.1 }, { key: 'music game I=0.55', track: 'game', I: 0.55 }, { key: 'music game I=1', track: 'game', I: 1 }, { key: 'music game I=1 (lite)', track: 'game', I: 1, lite: true },
  { key: 'music title', track: 'title', I: 0.5 }, { key: 'music title (lite)', track: 'title', I: 0.5, lite: true },
];

const dec = (s: string): Float32Array => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4).slice(); };
const f = (x: number, d = 1): string => x.toFixed(d);

async function main(): Promise<void> {
  const bundle = await build({ entryPoints: [join(import.meta.dirname, 'audio-entry.ts')], bundle: true, format: 'iife', globalName: 'GPAudio', write: false, target: 'es2022' });
  const code = bundle.outputFiles[0].text;
  const req = createRequire(import.meta.url);
  const { chromium } = req(process.env.PW_PATH || '/opt/node-tools/node_modules/playwright');
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  await page.addScriptTag({ content: code });
  mkdirSync(outDir, { recursive: true });

  const trims: Record<string, number> = {}, mtrims: Record<string, number> = { ...MUSIC_TRIMS };
  for (const k of Object.keys(SOUNDS) as SfxName[]) trims[k] = SOUNDS[k].trim;
  const run = async (c: Case, trim: number) => {
    const raw = await page.evaluate(([n, o, lite, t]: [string, unknown, boolean, number]) => (window as unknown as { GPAudio: { renderSfx: (...a: unknown[]) => Promise<{ sr: number; l: string; r: string }> } }).GPAudio.renderSfx(n, o, lite, t), [c.name, c.o, !!c.lite, trim] as [string, unknown, boolean, number]);
    const l = dec(raw.l), r = dec(raw.r);
    return { l, r, sr: raw.sr, s: analyze(l, r, raw.sr) };
  };
  if (flag('--calibrate')) {
    // per sound: the loudest case of that sound (options included) is brought to the class target; 3 passes because the limiter is not linear
    for (let pass = 0; pass < 3; pass++) {
      for (const name of Object.keys(SOUNDS) as SfxName[]) {
        let worst = -120;
        for (const c of cases.filter((x) => x.name === name && !x.lite)) worst = Math.max(worst, (await run(c, trims[name])).s.mMax);
        const target = TARGET[SOUNDS[name].cat];
        trims[name] = Math.max(0.05, Math.min(3, trims[name] * Math.pow(10, (target - worst) / 20)));
      }
      console.error(`calibration pass ${pass + 1} done`);
    }
  }
  const rows: string[] = [];
  const head = `${'sound'.padEnd(24)} ${'cat'.padEnd(4)} ${'dur'.padStart(5)} ${'peak'.padStart(6)} ${'rms'.padStart(6)} ${'M300'.padStart(6)} ${'cent'.padStart(6)} ${'<150'.padStart(5)} ${'150-4k'.padStart(6)} ${'>4k'.padStart(5)} ${'phone'.padStart(5)} clip`;
  rows.push(head, '-'.repeat(head.length));
  const all: { key: string; s: Stats; cat: string }[] = [];
  for (const c of cases) {
    const { l, r, sr, s } = await run(c, trims[c.name]);
    writeFileSync(join(outDir, c.key.replace(/[^a-z0-9#()]+/gi, '_') + '.wav'), wav(l, r, sr));
    all.push({ key: c.key, s, cat: SOUNDS[c.name].cat });
    rows.push(`${c.key.padEnd(24)} ${SOUNDS[c.name].cat.padEnd(4)} ${f(s.dur, 2).padStart(5)} ${f(s.peakDb).padStart(6)} ${f(s.rmsDb).padStart(6)} ${f(s.mMax).padStart(6)} ${String(Math.round(s.centroid)).padStart(6)} ${f(s.low * 100, 0).padStart(5)} ${f(s.phone * 100, 0).padStart(6)} ${f(s.high * 100, 0).padStart(5)} ${('-' + f(s.phoneDrop)).padStart(5)} ${s.clipped}`);
  }
  rows.push('');
  const runM = async (m: (typeof music)[number], trim: number) => {
    const raw = await page.evaluate(([n, I, lite, t]: [string, number, boolean, number]) => (window as unknown as { GPAudio: { renderMusic: (...a: unknown[]) => Promise<{ sr: number; l: string; r: string }> } }).GPAudio.renderMusic(n, I, lite, 1, t), [m.track, m.I, !!m.lite, trim] as [string, number, boolean, number]);
    const l = dec(raw.l), r = dec(raw.r);
    return { l, r, sr: raw.sr, s: analyze(l, r, raw.sr) };
  };
  if (flag('--calibrate')) {
    for (let pass = 0; pass < 3; pass++) for (const tr of ['pack', 'game', 'title']) {
      const m = music.find((x) => x.track === tr && !x.lite && (tr !== 'game' || x.I === 0.55))!;
      const { s } = await runM(m, mtrims[tr]);
      mtrims[tr] = Math.max(0.05, Math.min(3, mtrims[tr] * Math.pow(10, (MUSIC_TARGET[tr] - s.lufs) / 20)));
    }
  }
  const mh = `${'music loop'.padEnd(24)} ${'    '.padEnd(4)} ${'dur'.padStart(5)} ${'peak'.padStart(6)} ${'rms'.padStart(6)} ${'M300'.padStart(6)} ${'cent'.padStart(6)} ${'<150'.padStart(5)} ${'150-4k'.padStart(6)} ${'>4k'.padStart(5)} ${'phone'.padStart(5)} clip   LUFS-int`;
  rows.push(mh, '-'.repeat(mh.length));
  for (const m of music) {
    const { l, r, sr, s } = await runM(m, mtrims[m.track]);
    writeFileSync(join(outDir, m.key.replace(/[^a-z0-9=.()]+/gi, '_') + '.wav'), wav(l, r, sr));
    all.push({ key: m.key, s, cat: 'music' });
    rows.push(`${m.key.padEnd(24)} ${'    '} ${f(s.dur, 1).padStart(5)} ${f(s.peakDb).padStart(6)} ${f(s.rmsDb).padStart(6)} ${f(s.mMax).padStart(6)} ${String(Math.round(s.centroid)).padStart(6)} ${f(s.low * 100, 0).padStart(5)} ${f(s.phone * 100, 0).padStart(6)} ${f(s.high * 100, 0).padStart(5)} ${('-' + f(s.phoneDrop)).padStart(5)} ${s.clipped}   ${f(s.lufs)}`);
  }
  console.log(rows.join('\n'));
  for (const cat of ['ui', 'play', 'big']) {
    // the loudest variant of each sound (quiet variants such as a Common reveal or a small crowd are scaled down on purpose)
    const byName = new Map<string, number>();
    for (const a of all.filter((x) => x.cat === cat)) byName.set(a.key.replace(/#.*| \(lite\)/, ''), Math.max(byName.get(a.key.replace(/#.*| \(lite\)/, '')) ?? -120, a.s.mMax));
    const v = [...byName.values()];
    console.log(`class ${cat}: ${v.length} sounds, loudest variants M300 ${f(Math.min(...v))} .. ${f(Math.max(...v))} LUFS (spread ${f(Math.max(...v) - Math.min(...v))} LU, target ${TARGET[cat as keyof typeof TARGET]}), peak max ${f(Math.max(...all.filter((a) => a.cat === cat).map((a) => a.s.peakDb)))} dBFS`);
  }
  const clip = all.filter((a) => a.s.clipped > 0 || a.s.peakDb > -0.3);
  console.log(`loudness lost on a small speaker (phone column, dB; lower = translates better): worst ${f(Math.max(...all.map((a) => a.s.phoneDrop)))} dB, median ${f(all.map((a) => a.s.phoneDrop).sort((x, y) => x - y)[Math.floor(all.length / 2)])} dB`);
  console.log(clip.length ? `CLIPPING / over -0.3 dBFS: ${clip.map((c) => c.key).join(', ')}` : 'no clipping: every render peaks below -0.3 dBFS');
  if (flag('--write')) {
    const fmt = (o: Record<string, number>): string => '{ ' + Object.entries(o).map(([k, v]) => `${k}: ${v.toFixed(3)}`).join(', ') + ' }';
    writeFileSync(join(import.meta.dirname, '../src/ui/trims.ts'), `// Loudness calibration written by \`npx tsx tools/audio-render.ts --calibrate --write\`: a gain per sound and per music track so that\n// every effect of a class lands at the same momentary loudness. Do not edit by hand.\nexport const TRIMS: Record<string, number> = ${fmt(trims)};\nexport const MUSIC_TRIMS: Record<string, number> = ${fmt(mtrims)};\n`);
    console.log('wrote src/ui/trims.ts');
  }
  await browser.close();
}
void main();
