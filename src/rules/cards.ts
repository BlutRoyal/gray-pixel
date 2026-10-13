// All Play cards: 20 neutral + 9 per class. Names, effects and flavour text are in-game English.
import { INSIDE, isLockdown } from './engine';
import { act, addMod, coal, draw, logp, stealBonus, tire } from './game';
import { rnd } from './rng';
import type { ClassKey, Game, PlayCard, Side } from './types';

const lead = (G: Game, s: Side): number => G.score[s] - G.score[1 - s];
const ctx = (G: Game) => G.ctx!;

type CardDef = Omit<PlayCard, 'r' | 'tags'> & Partial<Pick<PlayCard, 'r' | 'tags'>>;
export const C: PlayCard[] = [];
const card = (o: CardDef): PlayCard => {
  const c = { ...o, r: o.r || 'basic', tags: o.tags || [] } as PlayCard;
  C.push(c);
  return c;
};
const cl = (cls: ClassKey, o: CardDef): PlayCard => card({ ...o, cls });

// ---------- NEUTRAL BASIC ----------
card({ k: 'swing_pass', n: 'Swing Pass', c: 1, ph: 'off', act: 'pass', t: 'Make a Pass. The receiver recovers 1 fatigue.', f: 'Good shot. Great shot. Swing it.',
  play: (G, s) => act(G, s, 'pass', { free: true, recover: 1 }) });
card({ k: 'moving_screen', n: 'Moving Screen', c: 1, ph: 'off', act: 'screen', tags: ['ref'], t: 'Make a Screen worth +3 Advantage. 10% chance the ref calls it: turnover.', f: 'If the ref didn’t see it, it was legal.',
  play: (G, s) => { act(G, s, 'screen', { free: true, adv: 3 }); if (rnd() < 0.1) ctx(G).turnover = 'Moving screen called. Turnover.'; } });
card({ k: 'attack_rim', n: 'Attack the Rim', c: 2, ph: 'off', act: 'drive', t: 'Make a Drive. If your next shot is a Dunk or Layup, +1 Advantage.', f: 'The paint is a no-fly zone. He has a pilot’s license.',
  play: (G, s) => { act(G, s, 'drive', { free: true }); addMod(G, s, { adv: 1, shots: ['dunk', 'layup'], src: 'Attack the Rim' }); } });
card({ k: 'up_fake', n: 'Up Fake', c: 1, ph: 'off', act: 'pump', t: 'Make a Pump Fake.', f: 'Defenders have been jumping at this since 1891.', play: (G, s) => act(G, s, 'pump', { free: true }) });
card({ k: 'clear_out', n: 'Clear Out', c: 2, ph: 'off', act: 'iso', t: 'Make an Iso. Your Baller gains only 1 fatigue instead of 2.', f: 'Everybody else, go stand in the corner. Yes, all of you.',
  cond: (G) => !ctx(G).seq.some((a) => a.type === 'pass'), play: (G, s) => act(G, s, 'iso', { free: true, fat: 1 }) });
card({ k: 'help_defense', n: 'Help Defense', c: 1, ph: 'def', trap: 'drive', t: 'Trap. When the opponent Drives: the Drive gives 0 Advantage.', f: 'There’s a reason they call it help. He needed it.',
  fire: (_G, _o, ev) => { ev.action!.nullified = true; return 'Help Defense: the Drive goes nowhere.'; } });
card({ k: 'jump_lane', n: 'Jump the Lane', c: 2, ph: 'def', trap: 'pass', steal: 20, t: 'Trap. When the opponent Passes: 20% chance of a steal. Otherwise, the Pass gives 0 Advantage.', f: 'He read the pass before the passer did.',
  fire: (G, o, ev) => { if (rnd() * 100 < 20 + stealBonus(G, o)) { ctx(G).turnover = 'Jump the Lane: stolen!'; ctx(G).stealBy = o; return 'Jump the Lane: STEAL.'; } ev.action!.nullified = true; return 'Jump the Lane: Pass deflected, no Advantage.'; } });
card({ k: 'switch', n: 'Switch!', c: 1, ph: 'def', trap: 'screen', t: 'Trap. When the opponent Screens: the Screen gives 0 Advantage.', f: 'You set a screen. We yelled "switch." Now what?',
  fire: (_G, _o, ev) => { ev.action!.nullified = true; return 'Switch!: the Screen does nothing.'; } });
card({ k: 'hand_face', n: 'Hand in the Face', c: 2, ph: 'def', trap: 'shot', shots: ['three'], t: 'Trap. When the opponent shoots a Three: −18%.', f: 'Personal space is a privilege, not a right.',
  fire: (_G, _o, ev) => { ev.pp! -= 18; return 'Hand in the Face: −18%.'; } });
card({ k: 'take_charge', n: 'Take the Charge', c: 2, ph: 'def', trap: 'shot', shots: ['dunk', 'layup'], needDrive: true, t: 'Trap. When the opponent shoots a Dunk or Layup after a Drive: 40% chance of an offensive foul.', f: 'Sacrificing his body. And, judging by the face, his dignity.',
  fire: (G) => { if (rnd() < 0.4) { ctx(G).turnover = 'Take the Charge: offensive foul!'; return 'Take the Charge: OFFENSIVE FOUL.'; } return 'Take the Charge: no call. Play on.'; } });
card({ k: 'fun_guy', n: 'Fun Guy', c: 1, ph: 'any', t: 'Your Ballerz ignore Distraction effects this possession. Draw a card.', f: '"Ha. Ha. Ha." The laugh was enough for the scouting report.',
  play: (G, s) => { ctx(G).immune[s] = true; draw(G, s, 1); } });
card({ k: 'timeout', n: 'Timeout', c: 2, ph: 'any', t: 'All your Ballerz recover 2 fatigue. Draw a card.', f: '"Okay, everybody breathe. Who had the plan? Nobody? Great."',
  play: (G, s) => { G.sides[s].court.forEach((b) => (b.fat = Math.max(0, b.fat - 2))); draw(G, s, 1); }, ai: (G, s) => G.sides[s].court.reduce((a, b) => a + b.fat, 0) >= 4 });
card({ k: 'hydrate', n: 'Hydrate', c: 0, ph: 'any', t: 'Gain 1 stamina this possession.', f: 'The trainer has been waiting all game for this moment.', play: (G, s) => { G.sides[s].st += 1; } });
card({ k: 'film_session', n: 'Film Session', c: 3, ph: 'any', t: 'Draw 2 cards. Next possession, you see the opponent’s defensive scheme.', f: 'Four hours of tape. Two useful clips. One nap.',
  play: (G, s) => { draw(G, s, 2); G.sides[s].seeScheme = 2; } });
card({ k: 'spilled_soda', n: 'Spilled Soda', c: 1, ph: 'any', tags: ['ref'], t: 'Draw a Timeout from your deck (or any card). 25% the ref saw it: the opponent gains 1 stamina.', f: 'Oops. Clumsy me. Anyway, we’re out of timeouts.',
  play: (G, s) => { const S = G.sides[s], i = S.deck.findIndex((x) => !x.kind && x.k === 'timeout'); if (i >= 0) S.hand.push(S.deck.splice(i, 1)[0]); else draw(G, s, 1); if (rnd() < 0.25) { G.sides[1 - s].bonusSt += 1; logp(G, 'The ref saw the soda. Opponent +1 stamina.'); } } });
card({ k: 'ball_dont_lie', n: 'Ball Don’t Lie', c: 1, ph: 'def', trap: 'ref', t: 'Trap. When the opponent plays a Ref card: cancel it. They don’t get the stamina back.', f: 'The ref may miss it. The rim never does.',
  fire: (_G, _o, ev) => { ev.cancel = true; return 'Ball Don’t Lie cancels ' + ev.card!.n + '.'; } });
card({ k: 'heckler', n: 'Courtside Heckler', c: 3, ph: 'any', tags: ['distraction'], t: 'For the next 2 possessions, the opponent’s shooter gets −12%.', f: 'Front row. Paid four grand. Brought a megaphone.',
  play: (G, s) => { G.sides[1 - s].debuffs.push({ pp: -12, left: 2, distraction: true, src: 'Heckler' }); } });
card({ k: 'anything_possible', n: 'Anything Is Possible', c: 3, ph: 'off', t: 'Only when down 8+. Your next shot gets +25%.', f: 'Screamed into a microphone. Meant every word.',
  cond: (G, s) => lead(G, s) <= -8, play: (G, s) => addMod(G, s, { pp: 25, src: 'Anything Is Possible' }) });
card({ k: 'cancun', n: 'Cancun on 3', c: 4, ph: 'off', t: 'Only when down 10+. Remove all fatigue. Your next shot ignores the scheme and Traps.', f: 'One, two, three... sunscreen!',
  cond: (G, s) => lead(G, s) <= -10, play: (G, s) => { G.sides[s].court.forEach((b) => (b.fat = 0)); ctx(G).ignoreScheme = true; ctx(G).ignoreTraps = true; } });
card({ k: 'press', n: 'Full-Court Press', c: 4, ph: 'any', t: 'Only when down 6+. Their next possession: first action costs 2 more, 25% turnover chance.', f: 'Forty-eight minutes of chaos. Or at least the next one.',
  cond: (G, s) => lead(G, s) <= -6, play: (G, s) => { G.sides[1 - s].pressed = true; } });
export const NEUTRAL_KEYS = C.map((x) => x.k);

// ---------- SPLASH FACTORY ----------
cl('splash', { k: 'extra_pass', n: 'Extra Pass', c: 1, ph: 'off', act: 'pass', t: 'Make a Pass. If the receiver shoots a Three next, +1 Advantage.', f: 'Unselfish to the point of being suspicious.',
  play: (G, s) => { act(G, s, 'pass', { free: true }); addMod(G, s, { adv: 1, shots: ['three'], src: 'Extra Pass' }); } });
cl('splash', { k: 'around_world', n: 'Around the World', c: 2, ph: 'off', act: 'pass', acts: 2, t: 'Make two Passes.', f: 'Everybody touched it. The ball needs a nap.',
  play: (G, s) => { act(G, s, 'pass', { free: true }); if (ctx(G).seq.length < 3 && !ctx(G).turnover) act(G, s, 'pass', { free: true }); } });
cl('splash', { k: 'corner_three', n: 'Corner Three', c: 1, ph: 'off', t: 'Your next Three gets +10%. If the shooter is a Sniper, +15% instead.', f: 'Shortest three on the court. Longest celebration.',
  play: (G, s) => addMod(G, s, { pp: 10, ppSniper: 15, shots: ['three'], src: 'Corner Three' }) });
cl('splash', { k: 'hot_hand', n: 'Hot Hand', c: 2, ph: 'any', t: 'Only if your last shot was a made Three. Draw 2 cards.', f: 'Somebody get him the ball. Everybody else, stop shooting.',
  cond: (G, s) => G.sides[s].lastShot === 'three+', play: (G, s) => draw(G, s, 2) });
cl('splash', { k: 'backdoor', n: 'Backdoor Cut', c: 2, r: 'common', ph: 'off', t: 'If the scheme is Deny the Pass, your next Pass gives +3 Advantage instead of 0.', f: 'Overplay the pass? He’ll just walk behind you.',
  play: (G) => { ctx(G).flags.backdoor = true; } });
cl('splash', { k: 'relocate', n: 'Relocate', c: 1, r: 'common', ph: 'off', t: 'If your Three is stopped by Close Out, it becomes a Fadeaway with +1 Advantage.', f: 'One step to the left. That was the whole plan.',
  play: (G) => { ctx(G).flags.relocate = true; } });
cl('splash', { k: 'shootout', n: 'Shootout', c: 2, r: 'common', ph: 'def', trap: 'oppscore', t: 'Trap. When the opponent scores: your next Three gets +15%.', f: 'Defense? We’ll just score more.',
  fire: (G, o) => { addMod(G, o, { pp: 15, shots: ['three'], src: 'Shootout' }); return 'Shootout: next Three +15%.'; } });
cl('splash', { k: 'logo_shot', n: 'Logo Shot', c: 3, r: 'epic', ph: 'off', t: 'Your next Three is worth 4, gets −10% and ignores Close Out.', f: 'From the logo. Because the arc is for cowards.',
  play: (G, s) => addMod(G, s, { pp: -10, pts: 4, ignore: ['close'], shots: ['three'], src: 'Logo Shot' }) });
cl('splash', { k: 'monsoon', n: 'Monsoon Season', c: 4, r: 'legendary', ph: 'any', ongoing: true, t: 'Ongoing. Each Three you make adds Rain. At 3 Rain, your Threes are worth 4 for the rest of the game.', f: 'Forecast: 100% chance of buckets.',
  play: (G, s) => { G.sides[s].ong.monsoon = { rain: 0, on: false }; } });
// ---------- SHOWTIME ----------
cl('show', { k: 'outlet', n: 'Outlet Pass', c: 1, ph: 'off', act: 'pass', t: 'Make a Pass. If it’s your first action this possession, +1 Advantage.', f: 'Rebound, turn, throw it to the moon.',
  play: (G, s) => { const first = ctx(G).seq.length === 0; act(G, s, 'pass', { free: true, adv: first ? 2 : 1 }); } });
cl('show', { k: 'lob_it', n: 'Lob It Up', c: 2, ph: 'off', t: 'Your next Alley-oop gets +15%. If the finisher is a High-Flyer, +20%.', f: 'Throw it anywhere near the rim. He’ll find it.',
  play: (G, s) => addMod(G, s, { pp: 15, ppFlyer: 20, shots: ['oop'], src: 'Lob It Up' }) });
cl('show', { k: 'fast_break', n: 'Fast Break', c: 2, ph: 'off', act: 'drive', t: 'Make a Drive. Opponent’s Traps can’t trigger on it.', f: 'Defense is still jogging back. Some of them are walking.',
  play: (G, s) => act(G, s, 'drive', { free: true, noTrap: true }) });
cl('show', { k: 'stocking', n: 'Stocking Stuffer', c: 1, ph: 'any', t: 'Draw a card. If you had an assist last possession, draw another.', f: 'Small, thoughtful, and somehow exactly what you needed.',
  play: (G, s) => draw(G, s, G.sides[s].lastAssist ? 2 : 1) });
cl('show', { k: 'no_look', n: 'No-Look Pass', c: 2, r: 'common', ph: 'off', act: 'pass', t: 'Make a Pass that Deny the Pass can’t stop.', f: 'He’s looking at the crowd. The ball is not.',
  play: (G, s) => act(G, s, 'pass', { free: true, noLook: true }) });
cl('show', { k: 'pull_up', n: 'Pull-Up', c: 2, r: 'common', ph: 'off', t: 'If the scheme is Pack the Paint, your next inside shot becomes a Fadeaway with +2 Advantage.', f: 'The paint was full. So he stopped right before it.',
  play: (G) => { ctx(G).flags.pullup = true; } });
cl('show', { k: 'steal_go', n: 'Steal and Go', c: 2, r: 'common', ph: 'def', trap: 'pass', t: 'Trap. When the opponent Passes: 15% steal. If stolen, your next inside shot gets +2 Advantage.', f: 'One hand on the ball, both feet already running.',
  fire: (G, o) => { if (rnd() * 100 < 15 + stealBonus(G, o)) { ctx(G).turnover = 'Steal and Go: stolen!'; addMod(G, o, { adv: 2, shots: INSIDE, src: 'Steal and Go' }); return 'Steal and Go: STEAL.'; } return 'Steal and Go: missed the steal.'; } });
cl('show', { k: 'naughty', n: 'Naughty List', c: 2, r: 'epic', ph: 'def', trap: 'refdis', t: 'Trap. When the opponent plays a Ref or Distraction card: cancel it, shuffle a Coal into their deck.', f: 'He’s checked it twice. You’re on it.',
  fire: (G, o, ev) => { ev.cancel = true; coal(G, (1 - o) as Side, 1); return 'Naughty List cancels ' + ev.card!.n + '. Coal added.'; } });
cl('show', { k: 'sleigh', n: 'Sleigh Ride', c: 4, r: 'legendary', ph: 'any', ongoing: true, t: 'Ongoing. Each assist adds a Present. At 4 Presents, take an extra possession and reset.', f: 'On Dasher, on Dunker, on Lob-it-to-Blitzen!',
  play: (G, s) => { G.sides[s].ong.sleigh = { p: 0 }; } });
// ---------- BUCKET GETTERS ----------
cl('bucket', { k: 'up_under', n: 'Up and Under', c: 1, ph: 'off', t: 'Your next Layup after a Pump Fake gets +2 Advantage.', f: 'He’s been doing this since before you were born. You still jumped.',
  play: (G, s) => addMod(G, s, { adv: 2, shots: ['layup'], needPump: true, src: 'Up and Under' }) });
cl('bucket', { k: 'step_back', n: 'Step-Back', c: 2, ph: 'off', t: 'Your next Fadeaway or Three gets +2 Advantage and ignores one Trap.', f: 'Created space. Also created several angry defenders.',
  play: (G, s) => { addMod(G, s, { adv: 2, shots: ['fade', 'three'], src: 'Step-Back' }); ctx(G).flags.skipTrap = 1; } });
cl('bucket', { k: 'midrange', n: 'Mid-Range Maestro', c: 1, ph: 'off', t: 'Your next Fadeaway gets +15%.', f: 'Analytics hate him. The scoreboard doesn’t.',
  play: (G, s) => addMod(G, s, { pp: 15, shots: ['fade'], src: 'Mid-Range Maestro' }) });
cl('bucket', { k: 'get_buckets', n: 'Get Buckets', c: 2, ph: 'off', t: 'Draw a card. Your next shot gets +12%.', f: 'The play call was "give it to him." That’s the whole playbook.',
  play: (G, s) => { draw(G, s, 1); addMod(G, s, { pp: 12, src: 'Get Buckets' }); } });
cl('bucket', { k: 'through_contact', n: 'Through Contact', c: 2, r: 'common', ph: 'off', t: 'If your next shot is stopped by Pack the Paint, it takes only half the penalty.', f: 'And one! (He’s already looking at the ref.)',
  play: (G) => { ctx(G).flags.halfPack = true; } });
cl('bucket', { k: 'blow_by', n: 'Blow By', c: 2, r: 'common', ph: 'off', t: 'If the scheme is Close Out, your next Drive gives +3 more Advantage.', f: 'You closed out hard. He said thank you.',
  play: (G) => { ctx(G).flags.blowby = true; } });
cl('bucket', { k: 'sell_contact', n: 'Sell the Contact', c: 1, r: 'common', ph: 'def', trap: 'drive', tags: ['ref'], t: 'Trap. When the opponent Drives: 25% chance of an offensive foul.', f: 'Forty years old. One gray hair per Oscar.',
  fire: (G) => { if (rnd() < 0.25) { ctx(G).turnover = 'Sell the Contact: offensive foul!'; return 'Sell the Contact: FOUL called.'; } return 'Sell the Contact: the ref isn’t buying it.'; } });
cl('bucket', { k: 'jobs', n: 'Job’s Not Finished', c: 3, r: 'epic', ph: 'off', t: 'Play while leading. Your next 2 shots get +2 Advantage.', f: 'Up two games. Not smiling.',
  cond: (G, s) => lead(G, s) > 0, play: (G, s) => addMod(G, s, { adv: 2, uses: 2, src: 'Job’s Not Finished' }) });
cl('bucket', { k: 'three_level', n: 'Three-Level Scorer', c: 4, r: 'legendary', ph: 'any', ongoing: true, t: 'Ongoing. After you make a Layup, a Fadeaway and a Three, your next make is worth +2. Then reset.', f: 'Inside, middle, outside. He’s selling all three.',
  play: (G, s) => { G.sides[s].ong.tls = { got: {}, armed: false }; } });
// ---------- BULLY BALL ----------
cl('bully', { k: 'post_up', n: 'Post Up', c: 1, ph: 'off', t: 'Your next Iso gives +1 more Advantage. The defender gains 1 fatigue.', f: 'Backing down since the jump ball.',
  play: (G, s) => { ctx(G).flags.postup = true; tire(G, (1 - s) as Side, ctx(G).handler, 1, true); } });
cl('bully', { k: 'hard_screen', n: 'Hard Screen', c: 1, ph: 'off', act: 'screen', t: 'Make a Screen. The defender gains 1 fatigue.', f: 'Legal screen. Illegal amount of shoulder.',
  play: (G, s) => { act(G, s, 'screen', { free: true }); tire(G, (1 - s) as Side, ctx(G).handler, 1, true); } });
cl('bully', { k: 'board_man', n: 'Board Man', c: 2, ph: 'off', t: 'If your next shot misses, 50% chance you get the ball back.', f: 'Board man gets paid. Board man gets the ball back.',
  play: (G) => { ctx(G).flags.boardman = true; } });
cl('bully', { k: 'bang_bodies', n: 'Bang Bodies', c: 2, ph: 'any', t: 'All opponent’s Ballerz on the court gain 1 fatigue.', f: 'Nobody scored. Everybody’s sore.',
  play: (G, s) => { [0, 1, 2].forEach((i) => tire(G, (1 - s) as Side, i, 1, true)); } });
cl('bully', { k: 'seal', n: 'Seal', c: 2, r: 'common', ph: 'off', t: 'If the scheme is Pack the Paint or Close Out, your next Iso shot ignores it.', f: 'He found a spot. Then he refused to leave it.',
  play: (G) => { ctx(G).flags.seal = true; } });
cl('bully', { k: 'nothing_easy', n: 'Nothing Easy', c: 2, r: 'common', ph: 'def', trap: 'shot', shots: INSIDE, t: 'Trap. When the opponent shoots a Dunk, Layup or Alley-oop: −15%, shooter gains 1 fatigue.', f: 'Nothing easyyy. Everything bruised.',
  fire: (G, o, ev) => { ev.pp! -= 15; tire(G, (1 - o) as Side, ev.shooterIdx!, 1, true); return 'Nothing Easy: −15% and bruises.'; } });
cl('bully', { k: 'enforcer', n: 'Enforcer', c: 1, r: 'common', ph: 'def', t: 'Your Lockdown Ballerz get +8 Defense this possession.', f: 'Not here to make friends. Here to make you uncomfortable.',
  play: (G, s) => { G.sides[s].court.forEach((b) => { if (isLockdown(b.card)) b.tmpF = (b.tmpF || 0) + 8; }); } });
cl('bully', { k: 'finger_wag', n: 'Finger Wag', c: 3, r: 'epic', ph: 'def', trap: 'shot', shots: INSIDE, t: 'Trap. When the opponent shoots inside: 35% blocked. If blocked, their next inside shot gets −15%.', f: 'Not in this house. Not in any house.',
  fire: (G, o, ev) => { if (rnd() < 0.35) { ev.blocked = true; G.sides[1 - o].debuffs.push({ pp: -15, left: 3, shots: INSIDE, once: true, src: 'Finger Wag' }); return 'Finger Wag: BLOCKED. Not in this house.'; } return 'Finger Wag: the block attempt misses.'; } });
cl('bully', { k: 'wear_down', n: 'Wear Them Down', c: 4, r: 'legendary', ph: 'any', ongoing: true, t: 'Ongoing. When all 3 of their Ballerz have 3+ fatigue, your next Dunk ignores the scheme and Traps and is worth 3.', f: 'By the fourth quarter, they were guarding him with prayers.',
  play: (G, s) => { G.sides[s].ong.wear = {}; } });
// ---------- PICK AND ROLL ----------
cl('pnr', { k: 'set_tempo', n: 'Set the Tempo', c: 1, ph: 'off', act: 'screen', t: 'Make a Screen. If your next action is a Drive, it costs 1 less.', f: 'One, two, one, two... drop.',
  play: (G, s) => { act(G, s, 'screen', { free: true }); ctx(G).flags.tempo = true; } });
cl('pnr', { k: 'roll_man', n: 'Roll Man', c: 2, ph: 'off', t: 'Your next Dunk or Alley-oop after a Screen gets +3 Advantage.', f: 'Set the screen. Turn. Sprint. Collect.',
  play: (G, s) => addMod(G, s, { adv: 3, shots: ['dunk', 'oop'], needScreen: true, src: 'Roll Man' }) });
cl('pnr', { k: 'two_man', n: 'Two-Man Game', c: 2, ph: 'off', act: 'screen', acts: 2, t: 'Make a Screen and a Pass.', f: 'Three on the court. Two in the play. One very confused defense.',
  play: (G, s) => { act(G, s, 'screen', { free: true }); if (ctx(G).seq.length < 3 && !ctx(G).turnover) act(G, s, 'pass', { free: true }); } });
cl('pnr', { k: 'remix', n: 'Remix', c: 1, ph: 'any', t: 'Draw a card. If you used both Screen and Drive last possession, draw another.', f: 'Same play. New beat. Defense still can’t dance.',
  play: (G, s) => draw(G, s, G.sides[s].lastSD ? 2 : 1) });
cl('pnr', { k: 'slip', n: 'Slip the Screen', c: 2, r: 'common', ph: 'off', t: 'If the scheme is Deny the Pass, your Screens this possession keep their Advantage and add +2 for inside shots.', f: 'Fake the screen, steal the lane.',
  play: (G) => { ctx(G).flags.slip = true; } });
cl('pnr', { k: 'short_roll', n: 'Short Roll', c: 2, r: 'common', ph: 'off', t: 'If the scheme is Pack the Paint, your next Three gets +2 Advantage.', f: 'Caught it at the free-throw line. Saw the corner. Fed it.',
  play: (G, s) => addMod(G, s, { adv: 2, shots: ['three'], ifScheme: 'pack', src: 'Short Roll' }) });
cl('pnr', { k: 'ice_it', n: 'Ice It', c: 1, r: 'common', ph: 'def', trap: 'screen', t: 'Trap. When the opponent Screens: 0 Advantage, and the ball-handler gains 1 fatigue.', f: 'Force him baseline. Then sing to him.',
  fire: (G, o, ev) => { ev.action!.nullified = true; tire(G, (1 - o) as Side, ctx(G).handler, 1, true); return 'Ice It: Screen iced.'; } });
cl('pnr', { k: 'drop', n: 'Drop Coverage', c: 3, r: 'epic', ph: 'def', trap: 'drive', t: 'Trap. When the opponent Drives: 0 Advantage, and their next inside shot gets −10%.', f: 'Drop back. Wait. Ruin his whole day.',
  fire: (G, o, ev) => { ev.action!.nullified = true; G.sides[1 - o].debuffs.push({ pp: -10, left: 1, shots: INSIDE, once: true, src: 'Drop Coverage' }); return 'Drop Coverage: Drive contained.'; } });
cl('pnr', { k: 'groove', n: 'Groove', c: 4, r: 'legendary', ph: 'any', ongoing: true, t: 'Ongoing. Each possession with both a Screen and a Drive adds a Beat. At 4 Beats, Screens and Drives cost 0 for your next 3 possessions.', f: 'Once he finds the groove, the defense is just background vocals.',
  play: (G, s) => { G.sides[s].ong.groove = { beats: 0, free: 0 }; } });
// ---------- 3-AND-D ----------
cl('three', { k: 'corner_spec', n: 'Corner Specialist', c: 1, ph: 'off', t: 'Your next Three gets +15% if the shooter hasn’t taken an action this possession.', f: 'Stands in the corner. Waits. Ruins your night.',
  play: (G, s) => addMod(G, s, { pp: 15, shots: ['three'], fresh: true, src: 'Corner Specialist' }) });
cl('three', { k: 'lock_in', n: 'Lock In', c: 1, ph: 'def', t: 'Your Ballerz get +5 Defense this possession.', f: 'Headphones off. Glasses on. Nobody scores.',
  play: (G, s) => { G.sides[s].court.forEach((b) => (b.tmpF = (b.tmpF || 0) + 5)); } });
cl('three', { k: 'glue', n: 'Glue Guy', c: 2, ph: 'off', act: 'screen', t: 'Make a Screen. Draw a card.', f: 'Doesn’t show up in the box score. Shows up everywhere else.',
  play: (G, s) => { act(G, s, 'screen', { free: true }); draw(G, s, 1); } });
cl('three', { k: 'ball_hawk', n: 'Ball Hawk', c: 2, ph: 'def', trap: 'pass', t: 'Trap. When the opponent Passes: 25% steal. If stolen, your next Three gets +10%.', f: 'He saw it in 3D. You saw it in 2D.',
  fire: (G, o) => { if (rnd() * 100 < 25 + stealBonus(G, o)) { ctx(G).turnover = 'Ball Hawk: stolen!'; addMod(G, o, { pp: 10, shots: ['three'], src: 'Ball Hawk' }); return 'Ball Hawk: STEAL.'; } return 'Ball Hawk: close, but no steal.'; } });
cl('three', { k: 'attack_co', n: 'Attack the Closeout', c: 2, r: 'common', ph: 'off', t: 'If the scheme is Close Out, your next Pump Fake gives +3 more Advantage.', f: 'You ran at him. He ran past you. Physics.',
  play: (G) => { ctx(G).flags.attackco = true; } });
cl('three', { k: 'spot_up', n: 'Spot-Up', c: 2, r: 'common', ph: 'off', t: 'If the scheme is Deny the Pass, your next Three gets +2 Advantage and isn’t read.', f: 'Can’t deny a pass that never happened.',
  play: (G, s) => addMod(G, s, { adv: 2, shots: ['three'], ifScheme: 'deny', ignore: ['deny'], src: 'Spot-Up' }) });
cl('three', { k: 'ear_whisper', n: 'Ear Whisper', c: 1, r: 'common', ph: 'def', tags: ['distraction'], t: 'Opponent’s shooter gets −15% this possession. 20% chance of a technical: they gain 1 stamina.', f: 'He leaned in close and whispered something about personal space.',
  play: (G, s) => { G.sides[1 - s].debuffs.push({ pp: -15, left: 1, distraction: true, src: 'Ear Whisper' }); if (rnd() < 0.2) { G.sides[1 - s].bonusSt += 1; logp(G, 'Technical! Ear Whisper went too far.'); } } });
cl('three', { k: 'lockdown', n: 'Lockdown', c: 3, r: 'epic', ph: 'def', t: 'Their best scorer: for the next 3 possessions, their shots are always read.', f: 'Island. Population: one. Visitors: denied.',
  play: (G, s) => { const O = G.sides[1 - s]; let bi = 0; O.court.forEach((b, i) => { if (b.card.power > O.court[bi].card.power) bi = i; }); O.court[bi].locked = 3; logp(G, 'Lockdown on ' + O.court[bi].card.name + '.'); } });
cl('three', { k: 'two_way', n: 'Two-Way Player', c: 4, r: 'legendary', ph: 'any', ongoing: true, t: 'Ongoing. Stops add Stop tokens, made Threes add Splash tokens. At 2 of each, your next Three is worth 5. Then reset.', f: 'Locks you up at one end. Locks it in at the other.',
  play: (G, s) => { G.sides[s].ong.twoway = { stop: 0, splash: 0, armed: false }; } });

export const COAL: PlayCard = { k: 'coal', n: 'Coal', c: 0, ph: 'any', r: 'token', tags: [], t: 'Does nothing. Burn it.', f: 'You know what you did.', play: () => {} };
export const CARD_BY_KEY: Record<string, PlayCard> = {};
C.forEach((x) => (CARD_BY_KEY[x.k] = x));
CARD_BY_KEY.coal = COAL;
