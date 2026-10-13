// All the main balance numbers in one mutable object. The engine reads TUNING at call time, so the Lab tab can change a value and
// the next game (or sim) uses it. DOM-free apart from the optional localStorage persistence (guarded: no storage in node/tests).
export interface TuneDef { key: string; label: string; group: string; min: number; max: number; step: number; hint?: string }
export const DEFAULTS = {
  winTo: 21, possCap: 50, rot: 3,
  baseRim: 57, baseMid: 56, baseThree: 42,
  slopeRim: 2.2, slopeMid: 2.2, slopeThree: 1.9, defSlope: 1.5,
  readRim: 0.55, readMid: 0.78, readThree: 0.5,
  assistPly: 5, assistMax: 6, openBonus: 10, fireBonus: 6, maxP: 96,
  blockP: 1, shutdownCap: 5, trapMult: 120, chargeTov: 10,
  fatStart: 6, fatStep: 3, fatCap: 15, fatRest: 2,
  moStart: 1, moMax: 10, moBall: 1, moBasket: 1, moStop: 1, subCost: 2, subCooldown: 2, dtCost: 4,
  costEpic: 2, costLegendary: 4, costIconic: 6,
  a1Base: 8, a1Dnk: 10, a1Def: 6, a1Beat: 10, a1Cap: 35,
  powRare: 1.5, powEpic: 1.5, powLegendary: 1.5, powIconic: 1.5, lvStep: 2, lvStepBasic: 1,
  snkCommon: 1, snkUncommon: 2, snkRare: 4, snkLegendary: 6, snkIconic: 8, snkBullseye: 8, snkCustom: 3, snkPlain: 2,
  spOn: 1, spScale: 1, spOff: 1, spDef: 1, spUtil: 1, spHolo: 1.3, spHoloMo: 1,
};
export type TuneKey = keyof typeof DEFAULTS;
export const TUNING: Record<TuneKey, number> = { ...DEFAULTS };
export const TUNE_DEFS: TuneDef[] = [
  { key: 'winTo', label: 'Win target', group: 'Game', min: 11, max: 31, step: 1 },
  { key: 'possCap', label: 'Possession cap (total)', group: 'Game', min: 20, max: 90, step: 1 },
  { key: 'rot', label: 'Shot cooldown (attacks per shot)', group: 'Game', min: 1, max: 5, step: 1, hint: '3 = once per three attacks' },
  { key: 'baseRim', label: 'Base % Rim', group: 'Shots', min: 20, max: 80, step: 1 },
  { key: 'baseMid', label: 'Base % Mid', group: 'Shots', min: 20, max: 80, step: 1 },
  { key: 'baseThree', label: 'Base % Three', group: 'Shots', min: 10, max: 70, step: 1 },
  { key: 'slopeRim', label: 'Rating weight Rim', group: 'Shots', min: 0.3, max: 1.8, step: 0.05 },
  { key: 'slopeMid', label: 'Rating weight Mid', group: 'Shots', min: 0.3, max: 1.8, step: 0.05 },
  { key: 'slopeThree', label: 'Rating weight Three', group: 'Shots', min: 0.3, max: 1.8, step: 0.05 },
  { key: 'defSlope', label: 'Defender DEF weight', group: 'Shots', min: 0, max: 1.5, step: 0.05 },
  { key: 'readRim', label: 'Read multiplier Rim', group: 'Shots', min: 0.2, max: 1, step: 0.02, hint: 'Shot chance x this when the scheme guessed right' },
  { key: 'readMid', label: 'Read multiplier Mid', group: 'Shots', min: 0.2, max: 1, step: 0.02 },
  { key: 'readThree', label: 'Read multiplier Three', group: 'Shots', min: 0.2, max: 1, step: 0.02 },
  { key: 'assistPly', label: 'PLY per +1% assist', group: 'Shots', min: 2, max: 10, step: 1 },
  { key: 'assistMax', label: 'Max assist %', group: 'Shots', min: 0, max: 15, step: 1 },
  { key: 'openBonus', label: 'Open man bonus %', group: 'Shots', min: 0, max: 30, step: 1 },
  { key: 'fireBonus', label: 'On Fire bonus %', group: 'Shots', min: 0, max: 25, step: 1 },
  { key: 'maxP', label: 'Max shot chance %', group: 'Shots', min: 80, max: 99, step: 1 },
  { key: 'blockP', label: 'Block Party shot chance %', group: 'Counters', min: 0, max: 30, step: 1 },
  { key: 'shutdownCap', label: 'Shutdown cap %', group: 'Counters', min: 1, max: 40, step: 1 },
  { key: 'trapMult', label: 'Trap strength % (lock and steal)', group: 'Counters', min: 50, max: 250, step: 5 },
  { key: 'chargeTov', label: 'Take the Charge extra turnover %', group: 'Counters', min: -30, max: 40, step: 1 },
  { key: 'fatStart', label: 'Fatigue starts at own attack', group: 'Fatigue', min: 2, max: 20, step: 1 },
  { key: 'fatStep', label: 'Fatigue % per attack', group: 'Fatigue', min: 0, max: 8, step: 0.5 },
  { key: 'fatCap', label: 'Fatigue max %', group: 'Fatigue', min: 0, max: 40, step: 1 },
  { key: 'fatRest', label: 'Bench recovery per attack', group: 'Fatigue', min: 0, max: 6, step: 1 },
  { key: 'moStart', label: 'Starting Momentum', group: 'Momentum', min: 0, max: 10, step: 1 },
  { key: 'moMax', label: 'Momentum max', group: 'Momentum', min: 6, max: 14, step: 1 },
  { key: 'moBall', label: 'Income: get the ball', group: 'Momentum', min: 0, max: 4, step: 1 },
  { key: 'moBasket', label: 'Income: your basket', group: 'Momentum', min: 0, max: 4, step: 1 },
  { key: 'moStop', label: 'Income: your stop', group: 'Momentum', min: 0, max: 4, step: 1 },
  { key: 'subCost', label: 'Sub cost', group: 'Momentum', min: 0, max: 6, step: 1 },
  { key: 'subCooldown', label: 'Sub cooldown (possessions)', group: 'Momentum', min: 0, max: 6, step: 1 },
  { key: 'dtCost', label: 'Double team cost', group: 'Momentum', min: 0, max: 8, step: 1 },
  { key: 'costEpic', label: 'Epic card cost', group: 'Momentum', min: 0, max: 8, step: 1 },
  { key: 'costLegendary', label: 'Legendary card cost', group: 'Momentum', min: 0, max: 10, step: 1 },
  { key: 'costIconic', label: 'Iconic card cost', group: 'Momentum', min: 0, max: 10, step: 1 },
  { key: 'a1Base', label: 'And-one base % (Rim make)', group: 'And-one', min: 0, max: 30, step: 1, hint: 'Chance of a foul and a free point after a made Rim shot' },
  { key: 'a1Dnk', label: 'And-one bonus for DNK / Big (max %)', group: 'And-one', min: 0, max: 30, step: 1, hint: 'Scales with his Rim rating; Bigs get the top of the range' },
  { key: 'a1Def', label: 'And-one cut from defender DEF (max %)', group: 'And-one', min: 0, max: 20, step: 1 },
  { key: 'a1Beat', label: 'And-one bonus when the guess was wrong %', group: 'And-one', min: 0, max: 30, step: 1 },
  { key: 'a1Cap', label: 'And-one max %', group: 'And-one', min: 5, max: 60, step: 1 },
  { key: 'powRare', label: 'Card power x, Rare (Basic stays 1)', group: 'Cards', min: 0.5, max: 3, step: 0.05, hint: 'Multiplies the numbers on the card (boost, lock, steal, ...)' },
  { key: 'powEpic', label: 'Card power x, Epic', group: 'Cards', min: 0.5, max: 3, step: 0.05 },
  { key: 'powLegendary', label: 'Card power x, Legendary', group: 'Cards', min: 0.5, max: 3, step: 0.05 },
  { key: 'powIconic', label: 'Card power x, Iconic', group: 'Cards', min: 0.5, max: 3, step: 0.05 },
  { key: 'lvStep', label: 'Card level: % effect per level', group: 'Cards', min: 0, max: 10, step: 0.5, hint: 'Level 5 = 4 steps' },
  { key: 'lvStepBasic', label: 'Card level: % per level, Common', group: 'Cards', min: 0, max: 10, step: 0.5 },
  { key: 'snkCommon', label: 'Sneaker Common %', group: 'Sneakerz', min: 0, max: 12, step: 1 },
  { key: 'snkUncommon', label: 'Sneaker Uncommon %', group: 'Sneakerz', min: 0, max: 12, step: 1 },
  { key: 'snkRare', label: 'Sneaker Rare %', group: 'Sneakerz', min: 0, max: 12, step: 1 },
  { key: 'snkLegendary', label: 'Sneaker Legendary %', group: 'Sneakerz', min: 0, max: 12, step: 1 },
  { key: 'snkIconic', label: 'Sneaker Iconic %', group: 'Sneakerz', min: 0, max: 12, step: 1 },
  { key: 'snkBullseye', label: 'Custom Bullseye %', group: 'Sneakerz', min: 0, max: 12, step: 1 },
  { key: 'snkCustom', label: 'Custom with enhancement %', group: 'Sneakerz', min: 0, max: 12, step: 1 },
  { key: 'snkPlain', label: 'Custom without enhancement %', group: 'Sneakerz', min: 0, max: 12, step: 1 },
  { key: 'spOn', label: 'Iconic specials on (1) / off (0)', group: 'Specials', min: 0, max: 1, step: 1, hint: 'Off = the specials are disabled for both sides' },
  { key: 'spScale', label: 'Special strength x (all)', group: 'Specials', min: 0.3, max: 2, step: 0.05, hint: 'Scales every special number (percent and counts)' },
  { key: 'spOff', label: 'Special strength x, offense specials', group: 'Specials', min: 0.3, max: 2, step: 0.05 },
  { key: 'spDef', label: 'Special strength x, defense specials', group: 'Specials', min: 0.3, max: 2, step: 0.05 },
  { key: 'spUtil', label: 'Special strength x, utility specials', group: 'Specials', min: 0.3, max: 2, step: 0.05 },
  { key: 'spHolo', label: 'HOLO special strength x', group: 'Specials', min: 1, max: 2, step: 0.05, hint: '1.3 = HOLO is 30% stronger' },
  { key: 'spHoloMo', label: 'HOLO special extra Momentum', group: 'Specials', min: 0, max: 4, step: 1 },
];
const KEY = 'bdl-tuning';
export function setTune(k: TuneKey, v: number): void { if (k in DEFAULTS && Number.isFinite(v)) { TUNING[k] = v; persist(); } }
export function resetTuning(): void { Object.assign(TUNING, DEFAULTS); persist(); }
export const isDefault = (): boolean => (Object.keys(DEFAULTS) as TuneKey[]).every((k) => TUNING[k] === DEFAULTS[k]);
/** Applies a JSON object of overrides; unknown keys and non-numbers are ignored. Returns the number of values taken. */
export function importTuning(json: string): number {
  const o = JSON.parse(json) as Record<string, unknown>;
  let n = 0;
  for (const k of Object.keys(DEFAULTS) as TuneKey[]) if (typeof o[k] === 'number' && Number.isFinite(o[k] as number)) { TUNING[k] = o[k] as number; n++; }
  persist();
  return n;
}
export const exportTuning = (): string => JSON.stringify(TUNING, null, 1);
function persist(): void { try { localStorage.setItem(KEY, JSON.stringify(TUNING)); } catch { /* no storage */ } }
export function loadTuning(): void { try { const s = localStorage.getItem(KEY); if (s) importTuning(s); } catch { /* no storage */ } }
