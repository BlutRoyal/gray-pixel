// How it works: the rules in short, coaches, cards, packs and the plan. Numbers come from the rules modules.
import { CLASSES, CLS_KEYS, RANK_CUTS, TIERS, TIER_NAME } from '../rules';
import { PACKS, isBox, packChance } from '../casual/packs';
import { LEVEL_MAX, MILESTONES, QUICK_LOSS, QUICK_WIN, STAR_TEXT, SHARD_YIELD, milestoneText } from '../casual/progress';
import { TUNING, CLUTCH, CLUTCH_NAME, COACH_PERK, FATIGUE, HAND_MAX, HAND_START, MAX_HARD_IN_DECK, MAX_TRAPS, MAX_TRAPS_IN_DECK } from '../casual/engine';
import { allCards } from '../casual/cards';
import { STAGES } from '../casual/story';
import { esc, heroImg } from './views';
import { HOLO_ICONIC } from '../casual/packs';

/** 2.00 -> 2%, 0.0005 -> 0.0005%: enough digits to show the first significant one. */
const fmtPct = (x: number): string => `${x >= 1 ? +x.toFixed(1) : x >= 0.01 ? +x.toFixed(2) : +x.toPrecision(2)}%`;

const nav: [string, string][] = [['basics', 'The basics'], ['turn', 'A possession'], ['shots', 'Shots'], ['cards', 'Cards'], ['coaches', 'Coaches'], ['story', 'Story'], ['packs', 'Packs'], ['plan', 'The plan']];

export function howHTML(): string {
  const cards = allCards();
  const traps = cards.filter((c) => c.fx.trap).length;
  return `<div class="how">
  <div class="row between how-top"><span class="dim small">New here? The guided game teaches the whole game in one match to 11 against Rookie Run.</span><button class="btn" data-a="tutorial">Replay tutorial</button></div>
  <nav class="how-nav" aria-label="Sections">${nav.map(([id, t]) => `<a href="#h-${id}">${t}</a>`).join('')}</nav>
  <article class="panel prose" id="h-basics"><h2 class="h">The basics</h2>
    <p>Gray Pixel is 3-on-3 street ball with real Ballerz. You and the CPU take turns with the ball. <b>First to ${TUNING.winTo} wins</b> (about ${Math.round(TUNING.winTo * 1.3)} possessions in all). If ${TUNING.possCap} possessions are played without a winner, the higher score wins and a tie goes to the team that was defending.</p>
    <ul><li>Your <b>squad</b> is five Ballerz: three start, two sit on the bench. Each has a position (<b>Guard, Wing or Big</b>) worked out from his stats, five ratings (<b>Rim, Mid, 3PT, Playmaking, Defense</b>) and a passive <b>skill</b>.</li>
    <li>Skills need no clicks. Common, Uncommon and Rare Ballerz get a generic skill for their position (Rare a notch stronger), Epic a named one, Legendary a strong one, and Iconic a glitch skill that bends the rules.</li>
    <li><b>Sneakerz</b> have three layers: their rarity adds accuracy to every shot (Common +1% up to Iconic +8%; Custom Sneakerz are weak, +2% or +3%, except Bullseye Customs at +8%), Jump adds up to +8% at the Rim plus a small putback chance, and the enhancement is a passive. You put them on by hand in the squad view.</li></ul></article>

  <article class="panel prose" id="h-turn"><h2 class="h">A possession</h2>
    <ol><li><b>Your ball:</b> tap a ready Baller, tap a zone (<b>Rim 2, Mid 2, Three 3</b>), play one card if you want, press Go. A teammate passes automatically: the free Baller with the best Playmaking gives the shot +1% for every 5 PLY over 70 (max +6%). <b>Rotation:</b> a Baller who takes a shot is <i>cooling</i> for his team's next ${TUNING.rot - 1} attacks, so every Baller shoots once per ${TUNING.rot} attacks. The shooter list shows who is ready and who is cooling. A fresh bench Baller is always ready, and <b>pass cards</b> (Swing Pass, Kick Out, Hand-Off, Skip Pass) hand the ball to anyone, cooling or not, with your best passer's assist counted twice.</li>
    <li><b>Their ball:</b> pick a scheme that guesses a zone (<b>Pack the Paint</b> = Rim, <b>Drop</b> = Mid, <b>Close Out</b> = Three). Guess right and their shot loses power. Mid is the safe shot: a read costs it the least.</li>
    <li><b>Man-to-man:</b> every defender guards one attacker, same position by default. Tap a defender to swap matchups. A shot uses the DEF of the man guarding the shooter.</li>
    <li><b>Double team</b> (${TUNING.dtCost} Momentum): the marked Baller can't shoot this possession, but his teammate's man left to help and that teammate is wide open (+${TUNING.openBonus}%, +5% more if the passer has 85+ PLY) and shoots even if he was cooling. Only worth it on the Baller who is about to shoot.</li></ol></article>

  <article class="panel prose" id="h-shots"><h2 class="h">Shots, Momentum and tiredness</h2>
    <p>The <b>power bar</b> is your chance to score: the zone's base chance, the shooter's rating against his direct defender, then Sneaker, skill, assist, cards and effects. The darker end shows what you'd lose if the scheme guesses your zone.</p>
    <ul><li><b>Momentum</b> (0 to ${TUNING.moMax}) fills +1 when you get the ball, +1 for your baskets and +1 for your stops. It carries over. It pays for Epic cards (2), Legendary (4), Iconic (6), double teams (${TUNING.dtCost}) and subs (${TUNING.subCost}). Common and Rare cards are free.</li>
    <li><b>Clutch:</b> a full bar lets you take a Clutch shot with a timing bar: green gives +${CLUTCH.hit}%, the center +${CLUTCH.perf}%. It empties the bar.</li>
    <li><b>Tired:</b> after ${FATIGUE.start - 1} of your attacks in a row on court, a Baller loses ${FATIGUE.step}% per attack (up to ${FATIGUE.cap}%). A game is short, so plan on one or two subs. Subs cost ${TUNING.subCost} Momentum, a swapped Baller needs ${TUNING.subCooldown} possessions before he can swap again, and the bench recovers while it rests.</li>
    <li><b>On Fire:</b> two makes in a row by the same Baller, +${TUNING.fireBonus}% until <i>he</i> misses. Other baskets don't put it out.</li>
    <li><b>Keyed on:</b> shots in a row by the same Baller (possible with a pass card) get −4% each (up to −12%).</li>
    <li><b>Long shots:</b> a made shot at under 15% is <b>GLITCHED</b>, under 5% <b>OVERCLOCKED</b>, under 2% <b>SYSTEM ERROR</b>.</li></ul></article>

  <article class="panel prose" id="h-cards"><h2 class="h">Cards</h2>
    <p>${cards.length} cards. You hold ${HAND_START}, draw 1 each possession (hand max ${HAND_MAX}) and may play <b>one card per possession</b>, on offense or defense. When your deck runs out, the discard is shuffled back in. A deck has 15 to 20 cards: at most 2 copies of a card (1 of an Iconic), ${MAX_TRAPS_IN_DECK} Traps and ${MAX_HARD_IN_DECK} hard counters.</p>
    <ul><li><b>Offense</b> cards boost your shot, stop reads, add points or give you the ball again. <b>Iso</b> (Legendary) drives to the Rim for about 85%: the scheme and double teams don't matter, only a Block or a Charge trap can stop it. An Iconic like <b>Heave</b> goes in 99% and takes the whole bar.</li>
    <li><b>Defense</b> cards cut their shot, steal the ball, cancel their card or jinx them for a few possessions.</li>
    <li><b>Traps</b> (${traps} of them) are set face down, max ${MAX_TRAPS} at a time. They fire by themselves on a later possession. <b>Turnover traps</b> (Pick Pocket, Passing Lane, Shot Clock) end the possession. <b>Hard counters</b> (Block Party sends the shot to ${TUNING.blockP}%, Take the Charge, Shutdown caps it at ${TUNING.shutdownCap}%, Trap Sense cancels a trap) are rare. No trap takes a shot below 1%. When a Trap fires you are told exactly what happened.</li>
    <li><b>Legendary</b> cards change the rest of the game: an aura on your shots, cheaper cards or instant fire.</li></ul></article>

  <article class="panel prose" id="h-coaches"><h2 class="h">Coaches</h2>
    <div class="tbl"><table><tbody>${CLS_KEYS.map((k) => `<tr><td class="left"><span class="hc">${heroImg(k)}<span><b>${esc(CLASSES[k].hero)}</b><br><span class="dim">${esc(CLASSES[k].name)}</span></span></span></td><td class="left small">${esc(COACH_PERK[k])}<br><span class="dim">Clutch: ${esc(CLUTCH_NAME[k])}</span></td></tr>`).join('')}</tbody></table></div>
    <p class="dim small">Cards of your coach's class go in your deck; other classes' cards wait in your collection.</p></article>

  <article class="panel prose" id="h-story"><h2 class="h">Story</h2>
    <p>${STAGES.length} courts, from ${esc(STAGES[0].name)} to ${esc(STAGES[STAGES.length - 1].name)}. Each one has stronger Ballerz, rarer cards and a smarter CPU. Every court has <b>3 stars</b>: ${STAR_TEXT.map((t, i) => `${i + 1}. ${t}`).join('; ')}. Star milestones pay out: ${MILESTONES.map((m) => `${m.stars} stars: ${milestoneText(m)}`).join('; ')}.</p>
    <ul><li>The first clear of a court pays Bucks and a free pack. Replays pay 40% of the Bucks.</li>
    <li>Three courts have a <b>boss</b> (${STAGES.filter((s) => s.boss).map((s) => esc(s.boss!.name)).join(', ')}) with an extra pack the first time.</li>
    <li>The first win of every day pays a bonus that grows with your daily streak. Quick Play pays ${QUICK_WIN} Bucks for a win, ${QUICK_LOSS} for a loss.</li></ul></article>

  <article class="panel prose" id="h-packs"><h2 class="h">Packs and levels</h2>
    <ul>${PACKS.map((p) => `<li><b>${esc(p.name)}</b> (${p.price} Bucks): ${esc(p.blurb)} ${isBox(p) ? '' : `Epic or better ${(packChance(p, 'epic') * 100).toFixed(1)}% per pack, Iconic ${fmtPct(packChance(p, 'iconic') * 100)}.`}</li>`).join('')}
    <li>Street, Pro and Icon packs hold 5 cards: 2 Ballerz and 3 Play cards. The Basic Pack costs 25 Bucks and you can also claim one free every day (local day, button on the title and Packs screens). It is mostly Common and Uncommon, with no pity.</li>
    <li>Opening runs by itself: the pack teases and rips, then each card glides in face down, builds suspense (long from Epic up, and Epic and Legendary look the same until the flip) and turns over onto a fanned pile. Tap to skip ahead (a second tap or Skip all jumps to the end). The last card stays up front until SEE SUMMARY. Tap any card in the pile, summary or Collection for a close-up.</li>
    <li><b class="ic-txt">Iconic specials:</b> each of the ${RANK_CUTS.iconic} Iconic Ballerz has one special move, usable once per game from his card or token for no Momentum, once per possession per side. It greys out after use and resets next game. About ${Math.round(HOLO_ICONIC * 100)}% of Iconic pulls are <b>HOLO</b>: the same Baller with a glitching frame and a stronger special. Pulling a HOLO of one you own as normal replaces it, and the normal turns into shards.</li>
    <li>Baller rarity comes from his rank. All Ballerz are ranked by the mean of their three best stats among DNK, SHT, PLY and DEF: the top ${RANK_CUTS.iconic} are <b class="ic-txt">Iconic</b>, the next ${RANK_CUTS.legendary} Legendary, the next ${RANK_CUTS.epic} Epic, and the rest Rare, Uncommon and Common.</li>
    <li>Sneakerz keep their own rarity. A Custom Sneaker counts as Legendary with Bullseye (+8%), Epic with another enhancement (+3%) and Rare without one (+2%): only Bullseye Customs are good.</li>
    <li>A duplicate Baller or Sneaker turns into shards (${TIERS.map((t) => `${TIER_NAME[t]} ${SHARD_YIELD[t]}`).join(', ')}). Shards level a Baller from 1 to ${LEVEL_MAX}: +1 to every stat per level. Recycle sells shards for Bucks.</li>
    <li>Cards are off-chain copies. Owning a Baller NFT is not the same as owning his card.</li></ul></article>

  <article class="panel prose" id="h-plan"><h2 class="h">The plan</h2>
    <ol><li><b>Now:</b> this demo. Story mode against the CPU, packs and collection, saved in this browser.</li>
    <li><b>Next:</b> more story courts, sound and animation polish.</li>
    <li><b>Later:</b> accounts, a server and PvP.</li></ol></article>
  </div>`;
}
