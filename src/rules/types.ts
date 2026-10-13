// Shared types for the rules module. No DOM, no UI.
export type ClassKey = 'splash' | 'three' | 'show' | 'pnr' | 'bully' | 'bucket';
export type BallerClass = ClassKey | 'neutral';
export type SchemeKey = 'pack' | 'close' | 'deny';
export type ActionType = 'pass' | 'screen' | 'drive' | 'pump' | 'iso';
export type ShotType = 'three' | 'dunk' | 'oop' | 'layup' | 'fade';
export type StatKey = 'D' | 'P' | 'S' | 'F' | 'J';
export type Rarity = 'basic' | 'common' | 'epic' | 'legendary' | 'token';
export type Phase = 'off' | 'def' | 'any';
export type Side = 0 | 1;

/** Raw catalog as produced by tools/build_catalog.py. */
export interface Catalog {
  bodies: string[];
  teams: string[];
  hairs: string[];
  accs: string[];
  enh: string[];
  rar: string[];
  des: string[];
  /** [BallerID, D, P, S, F, bodyIdx, teamIdx, hairIdx, accIdx+1, flags, role] */
  B: number[][];
  /** [SneakerID, Jump, enhancementIdx, rarityIdx, designIdx, dripFactor] */
  S: number[][];
}

export interface Sneaker {
  id: number;
  rar: string;
  rarI: number;
  drip: number;
}

export interface BallerCard {
  kind: 'baller';
  key: string;
  id: number;
  name: string;
  st: Record<StatKey, number>;
  body: string;
  acc: string;
  team: string;
  hair: string;
  flags: number;
  role: number;
  cls: BallerClass;
  trait: string;
  enh: number;
  sneaker: Sneaker;
  salary: number;
  power: number;
}

export interface Mod {
  src?: string;
  adv?: number;
  pp?: number;
  ppSniper?: number;
  ppFlyer?: number;
  pts?: number;
  shots?: ShotType[];
  ignore?: SchemeKey[];
  ifScheme?: SchemeKey;
  needPump?: boolean;
  needScreen?: boolean;
  fresh?: boolean;
  uses?: number;
}

export interface Debuff {
  pp: number;
  left: number;
  shots?: ShotType[];
  distraction?: boolean;
  once?: boolean;
  src: string;
}

export interface SeqAction {
  type: ActionType;
  actor: number;
  adv: number;
  nullified: boolean;
  noLook?: boolean;
  emp?: boolean;
  screener?: number;
}

/** Event handed to a Trap when it fires. */
export interface TrapEvent {
  kind?: string;
  action?: SeqAction;
  type?: ShotType;
  pp?: number;
  shooterIdx?: number;
  blocked?: boolean;
  card?: PlayCard;
  cancel?: boolean;
}

export interface PlayCard {
  kind?: undefined;
  k: string;
  n: string;
  c: number;
  ph: Phase;
  r: Rarity;
  tags: string[];
  t: string;
  f: string;
  cls?: ClassKey;
  act?: ActionType;
  acts?: number;
  trap?: string;
  shots?: ShotType[];
  needDrive?: boolean;
  steal?: number;
  ongoing?: boolean;
  cond?: (G: Game, s: Side) => boolean;
  play?: (G: Game, s: Side) => void;
  fire?: (G: Game, o: Side, ev: TrapEvent) => string;
  ai?: (G: Game, s: Side) => boolean;
}

export type HandCard = PlayCard | BallerCard;

export interface Slot {
  card: BallerCard;
  fat: number;
  used: boolean;
  once: Record<string, boolean>;
  tmpF: number;
  locked: number;
  fresh?: boolean;
}

export interface Ongoing {
  monsoon?: { rain: number; on: boolean };
  sleigh?: { p: number };
  tls?: { got: Record<string, number>; armed: boolean };
  wear?: { armed?: boolean };
  groove?: { beats: number; free: number };
  twoway?: { stop: number; splash: number; armed: boolean };
}

export interface SideState {
  cls: ClassKey;
  strategy: 'stars' | 'deep';
  bench: Slot[];
  court: Slot[];
  hand: HandCard[];
  deck: HandCard[];
  burn: HandCard[];
  st: number;
  maxSt: number;
  bonusSt: number;
  traps: PlayCard[];
  ong: Ongoing;
  mods: Mod[];
  debuffs: Debuff[];
  momentUsed: boolean;
  seeScheme: number;
  lastShot: string;
  lastAssist: boolean;
  lastSD: boolean;
  pressed: boolean;
  sneakFree: boolean;
  revealed: string[];
  peek?: string[] | null;
}

export interface CtxFlags {
  tempo?: boolean;
  grooveFree?: boolean;
  backdoor?: boolean;
  relocate?: boolean;
  pullup?: boolean;
  halfPack?: boolean;
  blowby?: boolean;
  seal?: boolean;
  attackco?: boolean;
  slip?: boolean;
  boardman?: boolean;
  postup?: boolean;
  skipTrap?: number;
  gift?: boolean;
}

export interface ShotResult {
  made: boolean;
  pts: number;
  p?: number;
  br?: {
    base: number;
    adv: number;
    fatS: number;
    fatD: number;
    factor: number;
    stopped: boolean;
    contest: number;
    capped: boolean;
    pp: number;
  };
  type?: ShotType;
  stopped?: boolean;
  combo?: string | null;
  converted?: string | null;
  shooter?: string;
  shooterId?: number;
  scheme?: SchemeKey | null;
  blocked?: boolean;
  turnover?: boolean;
  msg?: string;
}

export interface LogLine {
  t: string;
  cls: string;
}

export interface Ctx {
  off: Side;
  def: Side;
  scheme: SchemeKey | null;
  contest: number;
  pumps: number;
  handler: number;
  prevHandler: number;
  seq: SeqAction[];
  flags: CtxFlags;
  immune: [boolean, boolean];
  defBoost: [number, number];
  turnover: string | null;
  stealBy?: Side;
  ignoreScheme: boolean;
  ignoreTraps: boolean;
  pumpArmed: number;
  press?: boolean;
  log: LogLine[];
  resolved: boolean;
  defLocked: boolean;
  momentDef: boolean;
  result: ShotResult | null;
}

export interface GameRecord {
  cls: [ClassKey, ClassKey];
  plays: [Record<string, number>, Record<string, number>];
  shots: [Record<string, { a: number; m: number }>, Record<string, { a: number; m: number }>];
  schemes: Record<string, number>;
  traps: Record<string, number>;
  legend: [number, number];
  moments: [number, number];
  turnovers: [number, number];
  combos: Record<string, number>;
  assists: [number, number];
  maxDef: [number, number];
  subs: [number, number];
  perfect: [number, number];
  strat: [string | null, string | null];
}

export interface Game {
  sides: [SideState, SideState];
  score: [number, number];
  n: number;
  poss: Side;
  log: LogLine[];
  over: boolean;
  winner: number;
  extra: number;
  ctx: Ctx | null;
  /** Which side is the human (-1 for AI vs AI). Only used for log wording. */
  human: number;
  rec: GameRecord;
}

export interface ShotQuery {
  s: Side;
  idx: number;
  type: ShotType;
  scheme: SchemeKey | null;
  seq?: SeqAction[];
  flags?: CtxFlags;
  extraPP?: number;
  o?: ShotStatOpts;
  moment?: 'ignore' | null;
  noConvert?: boolean;
  converted?: string;
  contest?: number;
}

export interface ShotStatOpts {
  all99?: boolean;
  s99?: boolean;
  d99?: boolean;
  p99?: boolean;
  passer?: number;
}

export interface ShotChance {
  p: number;
  stopped: boolean;
  type: ShotType;
  adv: number;
  pp: number;
  combo: string | null;
  mods: Mod[];
  devil: boolean;
  converted: string | null;
  stat: number;
  fatS: number;
  fatD: number;
  base: number;
  factor: number;
  capped: boolean;
  contest: number;
}
