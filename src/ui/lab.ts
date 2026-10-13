// Lab: AI vs AI balance checks for the casual rules, and dev tools.
import { CLASSES, CLS_KEYS, seedRng, type ClassKey } from '../rules';
import { TUNE_DEFS, TUNING, DEFAULTS, exportTuning, importTuning, isDefault, resetTuning, setTune, type TuneKey } from '../casual/tuning';
import { bandTeam, buildDeck, cBaller, cpuDeck, equip, newSide, simGame, starterIds, type AiSkill } from '../casual/engine';
import { STAGES, cpuSide } from '../casual/story';
import { allCards } from '../casual/cards';
import { addBucks, profile, resetProfile, save, setCrt, setFast } from './store';
import { SOUNDS, type SfxName } from './sounds';
import { sfx } from './sfx';
import { MUSIC_CTXS, musicFileName, musicNow, musicTest, setMusicFile, setMusicTest, type MusicCtx } from './music';
import { glitchSlam, setSpeed } from './fx';
import { esc } from './views';
import { liteLabel, liteOn, liteWhy } from './lite';
import { MENU_LINES } from './lore';
import { freePack } from './packs';
import { previewPlay } from './play';
import { checkLabPass, gateHTML, labOpen, unlockLab } from './gate';

interface Report { games: number; poss: number; clutch: number; make: number; shots: number; out: number; zs: Record<string, number>; subs: number; dts: number; traps: number; cls: Record<string, { w: number; g: number }>; stages: { name: string; starter: number; strong: number }[] }
let res: Report | null = null;
let busy = false;
let perPair = 20;
let confirmReset = false;
let onChange: () => void = () => {};
let quickN = 200;
let quick: string[] | null = null;
let tuneMsg = '';
let jsonText = '';
export function initLab(changed: () => void): void {
  onChange = changed;
  document.addEventListener('submit', (e) => {
    const f = e.target as HTMLElement;
    if (f.id !== 'labGate') return;
    e.preventDefault();
    const inp = document.getElementById('labPw') as HTMLInputElement | null;
    void checkLabPass(inp ? inp.value : '').then((ok) => {
      if (ok) { unlockLab(); gateErr = ''; onChange(); }
      else { gateErr = 'Wrong password.'; const el = document.getElementById('labErr'); if (el) el.textContent = gateErr; if (inp) { inp.value = ''; inp.focus(); inp.classList.remove('shake'); void inp.offsetWidth; inp.classList.add('shake'); } sfx('back'); }
    });
  });
  document.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset?.tune) { setTune(el.dataset.tune as TuneKey, +el.value); tuneMsg = ''; }
    else if (el.id === 'tune-json') jsonText = el.value;
    else if (el.id?.startsWith('music-file-')) { const f = el.files && el.files[0]; if (f) void setMusicFile(el.id.slice(11) as MusicCtx, f).then(onChange); }
    else if (el.id === 'quick-n') quickN = Math.max(20, Math.min(2000, +el.value || 200));
  });
}
function tuningHTML(): string {
  const groups = [...new Set(TUNE_DEFS.map((d) => d.group))];
  return `<section class="panel"><h2 class="h">Tuning (dev)</h2>
    <p class="dim small">Live balance numbers. They are saved in this browser and used by Play and by every sim. ${isDefault() ? 'All values are the defaults.' : '<b>Some values differ from the defaults.</b>'}</p>
    ${groups.map((g) => `<h3 class="small">${esc(g)}</h3><div class="tune-grid">${TUNE_DEFS.filter((d) => d.group === g).map((d) => `<label title="${esc(d.hint || '')}"><span>${esc(d.label)}${TUNING[d.key as TuneKey] !== DEFAULTS[d.key as TuneKey] ? ' *' : ''}</span><input type="number" data-tune="${d.key}" min="${d.min}" max="${d.max}" step="${d.step}" value="${TUNING[d.key as TuneKey]}"></label>`).join('')}</div>`).join('')}
    <div class="row"><button class="btn" data-a="tune-reset">Reset to defaults</button>
      <span class="dim small">Quick sim games</span><input type="number" id="quick-n" min="20" max="2000" step="20" value="${quickN}" style="width:80px">
      <button class="btn go" data-a="tune-sim" ${busy ? 'disabled' : ''}>${busy ? 'Running…' : 'Run quick sim'}</button></div>
    ${quick ? `<div class="msg" role="status">${quick.map(esc).join('<br>')}</div>` : ''}
    <h3 class="small">Export / import</h3>
    <textarea id="tune-json" class="tune-json" spellcheck="false" aria-label="Tuning JSON">${esc(jsonText)}</textarea>
    <div class="row"><button class="btn" data-a="tune-export">Export</button><button class="btn" data-a="tune-import">Import</button><span class="dim small">${esc(tuneMsg)}</span></div></section>`;
}
async function quickSim(): Promise<void> {
  if (busy) return;
  busy = true; quick = null; onChange();
  const n = quickN, mid: AiSkill = { smart: 0.7, sigma: 0.11 }, player: AiSkill = { smart: 0.75, sigma: 0.1 };
  const boss = STAGES[STAGES.length - 1];
  let poss = 0, made = 0, shots = 0;
  const cw: Record<string, { w: number; g: number }> = Object.fromEntries(CLS_KEYS.map((k) => [k, { w: 0, g: 0 }]));
  for (let i = 0; i < n; i++) {
    const a = CLS_KEYS[i % CLS_KEYS.length], b = CLS_KEYS[(i + 1 + Math.floor(i / CLS_KEYS.length) % (CLS_KEYS.length - 1)) % CLS_KEYS.length];
    const G = simGame(newSide(a, bandTeam(0.4, 0.7), cpuDeck(a, 0.5)), newSide(b, bandTeam(0.4, 0.7), cpuDeck(b, 0.5)), [mid, mid]);
    poss += G.n; cw[a].g++; cw[b].g++; cw[G.winner === 0 ? a : b].w++;
    for (const h of G.hist) if (!h.outcome.turnover) { shots++; if (h.outcome.made) made++; }
    if (i % 25 === 0) await tick();
  }
  const m = Math.max(20, Math.floor(n / 2));
  let ws = 0, wg = 0;
  for (let i = 0; i < m; i++) {
    if (simGame(newSide('splash', equip(starterIds(), []), buildDeck({}, 'splash')), cpuSide(boss), [player, boss.skill]).winner === 0) ws++;
    if (simGame(newSide('splash', bandTeam(0.88, 1).map((x) => cBaller(x.id, x.sneakerId, 5)), cpuDeck('splash', 0.95)), cpuSide(boss), [player, boss.skill]).winner === 0) wg++;
    if (i % 25 === 0) await tick();
  }
  quick = [`${n} coach games: make ${pc(made, shots)}%, ${(poss / n / 2).toFixed(1)} possessions per team.`,
    'Coach win rates: ' + CLS_KEYS.map((k) => `${k} ${pc(cw[k].w, cw[k].g)}%`).join(', '),
    `${boss.name} (${m} games each): starter squad wins ${pc(ws, m)}%, strong squad (Lv 5 top band) wins ${pc(wg, m)}%.`];
  busy = false; onChange();
}

const pc = (w: number, g: number) => (g ? Math.round((w / g) * 100) : 0);
function report(r: Report): string {
  const rows = CLS_KEYS.map((k) => ({ k, v: pc(r.cls[k].w, r.cls[k].g) })).sort((a, b) => b.v - a.v);
  return `<section class="panel"><h2 class="h">Coach win rate</h2><p class="dim small">${r.games} games, ${(r.poss / r.games).toFixed(1)} possessions, ${(r.clutch / r.games / 2).toFixed(2)} Clutch shots per team, ${pc(r.make, r.shots)}% of shots made. Zones: Rim ${pc(r.zs.rim, r.shots)}%, Mid ${pc(r.zs.mid, r.shots)}%, Three ${pc(r.zs.three, r.shots)}%. Per team per game: ${(r.subs / r.games / 2).toFixed(1)} subs, ${(r.dts / r.games / 2).toFixed(1)} double teams, ${(r.traps / r.games / 2).toFixed(1)} Traps fired. Target 45–55%.</p>
    <table><tbody>${rows.map((x) => `<tr><td>${esc(CLASSES[x.k].hero)} (${esc(CLASSES[x.k].name)})</td><td class="${x.v >= 56 ? 'hi' : x.v <= 44 ? 'lo' : ''}">${x.v}%</td><td><span class="bar"><i style="width:${x.v}%"></i></span></td></tr>`).join('')}</tbody></table></section>
  <section class="panel"><h2 class="h">Story difficulty</h2><p class="dim small">Win rate of a decent player with the three starters and starter deck, and with a strong squad and good cards.</p>
    <table><thead><tr><th class="left">Court</th><th>Starters</th><th>Strong squad</th></tr></thead><tbody>${r.stages.map((s) => `<tr><td class="left">${esc(s.name)}</td><td>${s.starter}%</td><td>${s.strong}%</td></tr>`).join('')}</tbody></table></section>`;
}
let gateErr = '';
export function labHTML(): string {
  if (!labOpen()) return gateHTML(gateErr);
  const P = profile();
  return `<section class="panel"><h2 class="h">AI vs AI simulation</h2>
    <p class="dim small">Every coach plays every other coach, then a typical player runs the story ladder. The same check runs from the command line: <code>npx tsx tools/csim.ts 60</code>.</p>
    <div class="row"><span class="dim small">Games per pair</span>${[10, 20, 40].map((n) => `<button class="chipbtn${perPair === n ? ' on' : ''}" data-a="simn" data-v="${n}" ${busy ? 'disabled' : ''}>${n}</button>`).join('')}
    <button class="btn go" data-a="runsim" ${busy ? 'disabled' : ''}>${busy ? 'Running…' : 'Run'}</button></div><div id="simprog" class="dim small" aria-live="polite"></div></section>
  ${res ? report(res) : ''}
  ${tuningHTML()}
  <section class="panel"><h2 class="h">Look and sound</h2>
    <p class="lore-line">${esc(MENU_LINES.lab)}</p>
    <div class="row"><button class="btn${P.fast ? ' on' : ''}" data-a="lab-fast" aria-pressed="${P.fast}">Fast possessions: ${P.fast ? 'ON' : 'OFF'}</button>
    <button class="btn${liteOn() ? ' on' : ''}" data-a="lite" title="Lighter look for weak phones: no blend modes, blur or endless animations; shorter lists; no web fonts">Lite mode: ${esc(liteLabel())}${liteWhy() ? ' · ' + esc(liteWhy()) : ''}</button>
    <button class="btn" data-a="crt">${P.crt ? 'Scanlines on' : 'Scanlines off'}</button>
    <button class="btn" data-a="lab-sting" data-v="1">Preview GLITCHED</button><button class="btn" data-a="lab-sting" data-v="2">OVERCLOCKED</button><button class="btn" data-a="lab-sting" data-v="3">SYSTEM ERROR</button></div>
    <h3 class="small">Possession animation preview (opens a Quick Play game)</h3>
    <div class="row">${[['make', 'Three'], ['rim', 'Rim'], ['miss', 'Miss'], ['block', 'Block'], ['steal', 'Steal'], ['dt', 'Double team'], ['fire', 'On Fire'], ['g1', 'GLITCHED'], ['g2', 'OVERCLOCKED'], ['g3', 'SYSTEM ERROR']].map(([k, t]) => `<button class="btn sm" data-a="lab-prev" data-v="${k}">${t}</button>`).join('')}</div>
    <h3 class="small">Sound</h3>
    <div class="row"><button class="btn go" data-a="sound">Sound settings (volume, mute)</button></div>
    <div class="row lab-sfx">${(Object.keys(SOUNDS) as SfxName[]).map((k) => `<button class="btn sm" data-a="lab-sfx" data-v="${k}">${k}</button>`).join('')}</div>
    <h3 class="small">Music per context</h3>
    <p class="dim small">Each context has a built-in loop (title and menus, in-game tension that rises with Momentum, pack opening). To use your own track instead, choose an audio file (kept in this browser), or put <code>audio/title.mp3</code>, <code>audio/game.mp3</code> or <code>audio/pack.mp3</code> next to <code>index.html</code>. Any failure falls back to the built-in loop. Playing now: <b>${esc(musicNow() || 'nothing')}</b>.</p>
    ${MUSIC_CTXS.map((c) => `<div class="row lab-music"><b>${c}</b><span class="dim small">${musicFileName(c) ? 'Using: ' + esc(musicFileName(c)) : 'Built-in loop'}</span>
      <label class="btn sm file-btn">Choose file<input type="file" id="music-file-${c}" accept="audio/*"></label>
      <button class="btn sm" data-a="mus-clear" data-v="${c}" ${musicFileName(c) ? '' : 'disabled'}>Built-in</button>
      <button class="btn sm" data-a="mus-test" data-v="${c}">${musicTest() === c ? 'Stop test' : 'Play test'}</button></div>`).join('')}</section>
  <section class="panel"><h2 class="h">Dev tools</h2>
    <div class="row"><button class="btn" data-a="tutorial">Replay tutorial</button>
    <button class="btn" data-a="dev-bucks">+500 Bucks</button>
    <button class="btn" data-a="dev-shards">+500 shards</button>
    <button class="btn" data-a="dev-v2">Dev: grant all v2 cards</button>
    <button class="btn" data-a="dev-iconic">Open an Icon Pack with an Iconic</button>
    <button class="btn${confirmReset ? ' warn' : ''}" data-a="reset">${confirmReset ? 'Confirm: wipe Bucks, collection and story' : 'Reset profile'}</button></div>
    <p class="dim small">Gray Pixel, a Ballerz sidegame. Everything is saved in this browser only. Build ${esc(__BUILD__)}.</p></section>`;
}
const tick = () => new Promise((r) => setTimeout(r, 0));
async function runSim(): Promise<void> {
  if (busy) return;
  busy = true;
  onChange();
  seedRng((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const mid: AiSkill = { smart: 0.7, sigma: 0.11 }, player: AiSkill = { smart: 0.75, sigma: 0.1 };
  const r: Report = { games: 0, poss: 0, clutch: 0, make: 0, shots: 0, out: 0, zs: { rim: 0, mid: 0, three: 0 }, subs: 0, dts: 0, traps: 0, cls: Object.fromEntries(CLS_KEYS.map((k) => [k, { w: 0, g: 0 }])), stages: [] };
  const prog = (t: string) => { const el = document.getElementById('simprog'); if (el) el.textContent = t; };
  for (const a of CLS_KEYS) {
    for (const b of CLS_KEYS) {
      if (a === b) continue;
      for (let i = 0; i < perPair; i++) {
        const A = newSide(a, bandTeam(0.4, 0.7), cpuDeck(a, 0.5)), B = newSide(b, bandTeam(0.4, 0.7), cpuDeck(b as ClassKey, 0.5));
        const G = simGame(A, B, [mid, mid]);
        r.games++; r.poss += G.n; r.clutch += A.clutches + B.clutches;
        r.cls[a].g++; r.cls[b].g++; r.cls[G.winner === 0 ? a : b].w++;
        for (const h of G.hist) if (!h.outcome.turnover) { r.shots++; r.zs[h.outcome.zone]++; if (h.outcome.made) r.make++; }
        for (const S of G.sides) { r.subs += S.stats.subs; r.dts += S.stats.dts; r.traps += S.stats.trapsFired; }
      }
      prog(`${r.games} games`);
      await tick();
    }
  }
  for (const st of STAGES) {
    let w = 0, w2 = 0;
    const n = perPair * 2;
    for (let i = 0; i < n; i++) {
      if (simGame(newSide('splash', equip(starterIds(), []), buildDeck({}, 'splash')), cpuSide(st), [player, st.skill]).winner === 0) w++;
      if (simGame(newSide('splash', bandTeam(0.75, 0.95), cpuDeck('splash', 0.7)), cpuSide(st), [player, st.skill]).winner === 0) w2++;
    }
    r.stages.push({ name: st.name, starter: pc(w, n), strong: pc(w2, n) });
    prog(`Story: ${st.name}`);
    await tick();
  }
  res = r;
  busy = false;
  onChange();
}
export function labAct(a: string, v: string | undefined): boolean {
  switch (a) {
    case 'simn': perPair = +v!; onChange(); return true;
    case 'runsim': void runSim(); return true;
    case 'tune-sim': void quickSim(); return true;
    case 'tune-reset': resetTuning(); tuneMsg = 'Defaults restored.'; onChange(); return true;
    case 'tune-export': jsonText = exportTuning(); tuneMsg = 'Copy the JSON above.'; onChange(); return true;
    case 'tune-import': try { tuneMsg = `Imported ${importTuning(jsonText)} values.`; } catch { tuneMsg = 'That is not valid JSON.'; } onChange(); return true;
    case 'dev-bucks': addBucks(500); onChange(); return true;
    case 'dev-shards': profile().shards += 500; save(); onChange(); return true;
    case 'dev-v2': { const P = profile(); P.v2 = P.v2 || {}; for (const c of allCards()) if (c.v2) P.v2[c.k] = c.rarity === 'iconic' ? 1 : 2; save(); onChange(); return true; }
    case 'dev-iconic': freePack('icon', true); return true;
    case 'lab-prev': previewPlay(v!); return true;
    case 'lab-fast': setFast(!profile().fast); setSpeed(profile().fast ? 0.45 : 1); onChange(); return true;
    case 'lab-sting': { const l = +v! as 1 | 2 | 3; sfx(('glitch' + l) as SfxName); glitchSlam(l, ['', 'GLITCHED', 'OVERCLOCKED', 'SYSTEM ERROR'][l], 'preview', l === 3 ? 'ROGUE RENDER' : ''); return true; }
    case 'lab-sfx': sfx(v as SfxName, { rank: 3, level: 0.8, ms: 1400, i: 2, power: 1 }); return true;
    case 'mus-clear': void setMusicFile(v as MusicCtx, null).then(onChange); return true;
    case 'mus-test': setMusicTest(musicTest() === v ? null : (v as MusicCtx)); onChange(); return true;
    case 'crt': setCrt(!profile().crt); onChange(); return true;
    case 'reset': if (!confirmReset) { confirmReset = true; onChange(); return true; } resetProfile(); confirmReset = false; onChange(); return true;
  }
  return false;
}
