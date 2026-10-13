# Gray Pixel (v2)

*Ballerz Card Collecting Game*, a sidegame inside the Ballerz ecosystem.


The game is called **Gray Pixel**. Lore: at the Ballerz mint some crazy-hair Ballerz got a random gray pixel in the wrong place; that glitch is the source of the Grid. All lore strings live in `src/ui/lore.ts`. Every fresh load opens one splash title screen (wordmark, tagline, pulsing "Enter the Grid"); any tap, click or key press enters (this also unlocks Web Audio) and a new profile goes straight into the guided game. The wordmark (pixel-art, with the stray pixel) is `src/ui/wordmark.ts`; gray accents are in `src/gray.css`. The neutral card named Ball Don't Lie keeps its name.
Port of PoC v0.7 to Vite + TypeScript, with a new retro-futurist UI, packs and a How it works page.

- Play: open `dist/index.html` in a browser (one self-contained file).
- Dev: `npm install`, then `npm run dev`. Build: `npm run build`. Balance sim: `npm run sim -- 100`. Tests: `npm test`.
- `src/rules/` is the DOM-free game engine (rules, cards, AI, sim, packs). `src/ui/` is the interface.
- Real Baller images load from ballerz.cloud; where they can't load, a pixel avatar is shown.
- Save data (Bucks, collection) lives in the browser's localStorage only.

## v1.0 rules (casual rebuild)
- `src/casual/` holds the current rules: `engine.ts` (possession, power bar, On Fire, Hype/Clutch, AI), `cards.ts` (74 cards rebuilt as simple effects), `story.ts` (8 story courts).
- `src/rules/` is the v0.7 engine; it still provides the catalog, Baller stats and pack odds. `npm run sim:v07` runs the old sim.
- Balance: `npm run sim -- 60` (coach win rates and story difficulty).

## v2 rules, stage 1 (possession v2)
Spec: `TEST-FEEDBACK.md`, "Otsused punkt haaval" 1-5. Stage 2 progression is below; stage 3 visuals and the stage 4 tutorial are described below.
- `src/casual/engine.ts`: possessions, shot chance, Momentum, double team, subs, fatigue, Traps, deck rules, AI. `cards.ts`: 74 design cards on Momentum costs plus the new v2 cards. `skills.ts`: positions (Guard/Wing/Big), Baller skills, Sneaker effects.
- Offense: tap a shooter, tap a zone (Rim 2 / Mid 2 / Three 3), at most one card, Go. The free teammate with the best PLY passes: +1% per 5 PLY over 70, max +6%.
- Defense: a scheme guesses a zone (Pack the Paint = Rim, Drop = Mid, Close Out = Three), man-to-man matchups (same position by default, re-assignable), optional double team (3 Momentum), one card.
- Hand 3, draw 1 per possession, one card per possession. Momentum 0-10: +1 for the ball, +1 own basket, +1 stop. Cards: Common/Rare 0, Epic 2, Legendary 4, Iconic 6 (Heave takes the whole bar). Clutch shot needs a full bar.
- Roster 5 (3 + 2 bench). Subs cost 2 Momentum, 2 possession cooldown. Fatigue from the 6th own attack in a row on court: -3% per attack, max -15%; the bench recovers 2 per rest. See the tuning pass below for the current numbers.
- Sneakerz: rarity = all-shot bonus (1/2/4/6/8; Custom: Bullseye 8, other enhancement 3, none 2), Jump = up to +8% at the Rim plus putback, enhancement = passive. Equipped by hand in the squad view.
- Traps: turnover traps, hard counters (Block Party, Take the Charge, Shutdown, Trap Sense). No trap takes a shot under 1%. Made shots under 15% / 5% / 2% are GLITCHED / OVERCLOCKED / SYSTEM ERROR; a made 1% shot is flagged `inhuman`.
- Deck: 5 Ballerz, 5 Sneakerz, 15-20 cards, max 2 copies (1 Iconic), 4 Traps, 2 hard counters (`validateDeck`, `buildDeck`).
- Balance: `npm run sim -- 60` (coach win rates, zone shares, usage of subs/double teams/traps, card lift, story stages).

## v2 stage 2: progression
Spec: `TEST-FEEDBACK.md` sections 6, 7, 9. Economy numbers: `npm run econ` (`tools/econ.ts`).
- **Tiers** (`src/rules/packs.ts`): Common / Uncommon / Rare / Epic / Legendary / Iconic. Ballerz are tiered by RANK of the mean of their top 3 stats among DNK/SHT/PLY/DEF (tie: sum of the four, then id; All-Stars excluded; repeated catalog ids count once): top 50 Iconic, next 200 Legendary, next 750 Epic, the rest 15% Rare / 30% Uncommon / 55% Common. The engine (`skillFor`, `cBaller.tier`), packs and UI all read `ballerTier`.
- **Sneakerz** keep their own rarity names; display tier: Iconic = Iconic, Custom Bullseye = Legendary, Custom with another enhancement = Epic, plain Custom = Rare (`sneakerRowTier`).
- **Packs** (`src/casual/packs.ts`): Street 100, Pro 250, Icon 1000 hold 4 cards (3 Ballerz + 1 Play card, no Sneaker). Sneaker Box 50 = 3 Sneakerz with real rarities. Iconic per pack ~1% Icon, ~0.2% Pro, ~0.01% Street. Pity (counters persisted): every 10th Pro Pack has an Epic+ Baller, every 30th Icon Pack a Legendary+. The 87 Play cards (incl. the 13 v2 cards) are in the pool at their stage-1 rarity (Basic = Common, Common = Rare, Epic, Legendary, Iconic).
- **Shards and levels** (`src/casual/progress.ts`): a duplicate Baller or Sneaker, or a Play card beyond 2 copies (1 Iconic), turns into shards (4/8/16/50/150/500 by tier). Shards level a Baller 1 to 5 (+1 to every stat per level, used by the engine via `cBaller(id, sneaker, level)`). Shards also sell for Bucks (Recycle, 0.5 each).
- **Rewards**: 3 stars per court (win; win by 7+; win by 10+ with at most 2 turnovers), 8 star milestones (Bucks, shards, packs), daily first-win bonus with a streak, 3 bosses (extra pack on first clear), replays pay 40%, Quick Play 40/12 Bucks. A reward popup lists Bucks, shards and stars after each game. Packs won are kept as "unopened" until you open them.
- **Deck tab** (`src/ui/deck.ts`): build a 15 to 20 card deck for the current coach within the `validateDeck` rules; an empty or invalid deck falls back to the automatic one. The Lab "grant all v2 cards" button is a dev tool only.
- Tests: `test/progress.test.ts`.

## Tuning pass (arcade rules, rotation, pass cards)
- **Length and accuracy**: shots are much more reliable and Baller stats matter more (rating weight 2.2 per point at Rim/Mid, 1.9 at Three, defender DEF 1.5; base 57/56/42 at an 80 rating vs an 80 defender; read multipliers Rim .55, Mid .78, Three .5; max 96%). A game to 21 is about 29 possessions, ~15 per team, make ~57%. `POSS_CAP` 50.
- **Rotation** (`hold`, `canShoot`, `shooterSlots` in `engine.ts`): a Baller who takes a shot cannot shoot for his team's next two attacks (TUNING.rot = 3). Bench Ballerz recover while they sit, so a fresh sub is ready at once. A double team (now 4 Momentum) removes the marked Baller and the open man shoots even if cooling. The shooter picker in the play view shows ready / cooling / pass for each Baller; opponents' cooling shows under their tokens.
- **Pass cards**: `fx.pass`. Swing Pass (Basic, any zone +6), Kick Out (Basic, Three +8), Hand-Off (Basic, Rim +8), Skip Pass (Rare, +9 and a read costs half). Any Baller may shoot, cooling or not, and the best passer's assist bonus counts twice. The AI uses them when a cooling Baller has the best look. Starter deck: Swing Pass, Kick Out and Hand-Off x2 each. Three more cards than before (90 total) are in the pack pool.
- **Coaches**: Splash +10% Three, Three coach reads cost 12% more, Bucket +8% Mid, Pick and Roll +2% on every shot (+6% with a pass card). Lockdown now reads their next 2 shots.
- **Story balance**: the CPU gets Baller levels (`lv`) on later courts and the boss a +4% home-court edge. Starter squad wins ~82/69/58/48/26/19/7/2% (Rookie Run to All-Star); a Lv 5 top-band squad with a good deck wins All-Star ~49%+ (`npm run sim -- 60 story`).
- **Sneakerz**: only Bullseye Customs are good. Display tiers unchanged.
- **Packs**: Iconic Baller per pack Icon ~2.2%, Pro ~0.4%, Street ~0.02%. Sneaker Boxes: Street Box 50, Pro Box 150, Icon Box 500 (one Legendary+ guaranteed, ~12% Iconic).
- **Tuning panel**: Lab tab, "Tuning (dev)". All main numbers live in `src/casual/tuning.ts` (`TUNING`), are saved in localStorage, can be exported/imported as JSON and tested with "Run quick sim". Play mode reads the same values. `BDL_TUNE='{"baseRim":55}' npx tsx tools/csim.ts 60 story` overrides values in the CLI sim (modes: `all`, `coach`, `story`, `cards` as the third argument).

## v2 stage 3: look and feel (the Grid)
Presentation only: no rules or TUNING numbers changed.
- **Theme**: neon Tron + Tokyo + Ghost in the Shell with a glitch motif. `src/theme.css` (loaded after `style.css`) re-tokens the palette (cyan/magenta/amber on near-black), scanlines, holographic panel frames, glitch titles and screen-change glitch. A one-time boot screen per session shows the Grid "loading".
- **Lore**: all in-game lore strings live in `src/ui/lore.ts` (title, boot, pack and menu lines, glitch label sub-lines, the INHUMAN alias "ROGUE RENDER"). Add more there.
- **Menu**: Play (title screen, six Coaches as the hero of the screen, Quick Play / Story) / Story / Packs / Collection / Deck / How / Lab. Coach art is the real image with a pixel-avatar (then initials) fallback.
- **Court and possession animation** (`play.ts` `steps`, `geometry.ts`, `fx.ts`): neon wireframe half-court with Rim / Mid / Three zones. On Go: the passer hands off, the shooter runs to a zone-specific spot and shoots from it, the ball arcs to the rim, his defender follows, a double team collapses on the marked man, blocks / steals / traps show an effect and a short explanation tip, the defense's zone guess shows as a red hatch (READ or wrong guess). About 2-3 s, a tap skips, **FAST** toggle (jumbotron or Lab) makes it about 1 s. Respects `prefers-reduced-motion` (animation skipped).
- **Rare shots**: GLITCHED / OVERCLOCKED / SYSTEM ERROR (and a made 1% shot, alias ROGUE RENDER) get a full-court glitch scaled by rarity plus a Web Audio sting (`glitchSting` in `beat.ts`). On Fire has a neon flame. Lab has previews for every animation ("Possession animation preview").
- **Play by play**: icon per event type, badges (assist, read, double team, trap, clutch, fire). Hover (mouse) or tap a row: the inspector shows the shot-chance breakdown, cards from both sides and any trap that fired with its explanation. Teaching visuals: Momentum bar segments pop in / flash out with a "+N MOMENTUM" tag, cooldown rings on cooling Ballerz, stamina bar under each token.
- **Cards**: Spell and Trap cards have their own frames and procedural SVG art (`cardart.ts`); tier frames get stronger up to Legendary / Iconic; Iconic Ballerz and Play cards glitch continuously.
- **Responsive**: desktop = court + hand left, actions and log right; phones and portrait tablets = jumbotron and court pinned on top, actions / hand / log scroll underneath; landscape phones = court left, everything else right. Touch targets are at least 44 px. Checked at 1440x900, 820x1180, 390x844, 844x390 with Playwright.
- **Pack music hook**: the default is still the Web Audio beat. Put an mp3 at `audio/pack.mp3` next to `index.html` (or `public/audio/pack.mp3` before building), or pick a file in Lab ("Pack-opening music", kept in IndexedDB). Any failure falls back to the beat.
- Tests: `test/ui.test.ts` (geometry, icons, lore).

## v2 stage 4: guided first game
Replaces the old six slides. No balance numbers changed.
- **Flow**: a brand-new profile starts straight in a guided game to 11 against Rookie Run (`startTutorialGame` in `play.ts`; `TUNING.winTo` is set to 11 for that game only and restored). Each lesson is a text bubble with an arrow and a glowing highlight on the real UI element; a capture-phase click guard lets only the highlighted control through (a wrong tap shakes the bubble). Bubbles pick the placement (below / above / beside) that covers the fewest other controls and never the target. **Skip tutorial** (two taps) is always in the bubble; QUIT also skips.
- **Steps, in order**: pick shooter, zone (Mid is safe), free card and Momentum cost, Go and the animation, play-by-play (hover/tap a row), scheme guess and man-to-man, Momentum bar, cooling rule + pass card (Kick Out), On Fire, face-down Trap, double team, subs and fatigue, Clutch timing bar, rare-shot labels (demo animation), final whistle, reward popup with Packs / Deck / Story pointers. On Fire comes right after the pass card because that is where the first two makes in a row happen.
- **Guaranteed lessons**: `SCENES` in `src/ui/tutorialSteps.ts` forces the first seven possessions (scripted hand, Momentum gift, a tired starter, no CPU double team/traps/defense card on the player's offense) and rigs some shots (`rigResolve` tries seeds on a `structuredClone` of the game until the wanted make or miss comes). The RNG is seeded; after the lessons it is plain Rookie Run. The player's points before the Clutch possession cannot reach 11.
- **Code**: `tutorialSteps.ts` (DOM-free: `STEPS`, `SCENES`, `Sequencer`), `tutorial.ts` (bubble, highlight, click guard), hooks in `play.ts` (`tutNote` events, `tutSnap`/`tutCtx`, `finishTutorial`). Test: `test/tutorial.test.ts`.
- **Profile** (`store.ts`): `tut.state` = new / done / skipped / legacy. Saves from before this stage (old `ballerz_tut_v1` flag, or any game played) become `legacy` and are never forced; they, and skipped players, get "Replay tutorial" on the title screen, in How and in Lab. Finishing the first time gives a free Street Pack and 40 Bucks (once; replays give nothing).
- Checked with Playwright at 1440x900 and 390x844 (full playthroughs, win and loss, no page errors). Screens: `screens/tutorial-*.png`.

## Lite mode (weak phones and in-app webviews)

Lite mode removes the costly layers: blend modes, blur and backdrop filters, drop-shadow filters, full-screen scanline/static/sweep overlays, endless animations (they play once), per-card holo layers and the web fonts. Possession effects are shorter and lighter, and the Collection grid draws 24 cards at a time ("Show more"). It is automatic on touch screens up to 820 px, devices reporting 4 GB or less, known in-app browsers, embedded pages, after a start that never finished, or after about 2.5 s of slow frames. Toggle it (Auto / On / Off) on the splash screen or in the Lab; the choice is saved in localStorage key `gp_lite` ('1', '0', or absent for auto). An uncaught error shows a small recovery card with "Reset to lite mode". Code: `src/ui/lite.ts`, `src/lite.css`.

## Round 2A: mobile first, readability, And-One, card levels
- **Mobile first.** Every screen is designed for a 390x844 phone first, then 844x390 landscape, tablet and desktop (`src/mobile.css`, loaded before `lite.css`). Touch targets are 44px or more. The game screen is one frame: scoreboard and Momentum pinned on top, the court at full width, one action bar (Shooter, Zone, Card, GO) and a docked hand strip with 3 cards (tap to enlarge, big effect number, Momentum cost in the corner; a played card flies into the log). The log, subs, Baller card and card view are bottom sheets (the log docks beside the court on desktop). Squad: 5 slots at the top (3 court, 2 bench), tap a slot for a bottom sheet of Ballerz and Sneakerz.
- **Tutorial on a phone.** The bubble becomes a fixed bottom panel (`body.tut-dock`, `--tut-h` reserves its height) so it never covers the highlighted control. Cards are a two-tap flow (open, then Play). The log steps skip themselves when the log is docked.
- **Baller card.** Tap any Baller token or chip: number, portrait, position, Rim/Mid/Three, DEF, skill, fatigue, level, Sneaker, shot chances for the shooter and a bench comparison with better/worse arrows for subs (`src/ui/bcard.ts`).
- **Defense readability.** Small portrait tokens with the number as a corner badge, a thin colored line from each defender to the attacker he guards (two lines for a double team), opponent frames in another color.
- **And-One.** A made Rim shot can draw the foul: base `a1Base` 8%, up to `a1Dnk` +10% for dunkers/Bigs, minus up to `a1Def` 6% from the defender's DEF, `a1Beat` +10% when the defense guessed the wrong zone, capped at `a1Cap`. +1 point and +1 Momentum; a fired Charge trap negates it. All numbers are in TUNING (editable in the Lab).
- **Deck tab.** The deck is shown flat at the top ("Deck 15/20"), with an AUTO DECK notice when no valid hand-built deck exists, an Auto-build button, and "Your cards: N" for the owned list. Tapping a tile removes it (from the automatic deck too, which starts editing it).
- **Rare+ card power.** Rare, Epic, Legendary and Iconic card effects are scaled by `powRare/powEpic/powLegendary/powIconic` (1.5). Basic is unchanged.
- **Card levels (per-card shards).** A duplicate Play card gives shards to that card only. Levels 1 to 5, +2% card effect per level (+1% for Basic). Shards to reach Lv 5: Common 100, Rare 250, Epic 600, Legendary 1500, Iconic 4000 (steps 1, 3, 6, 11 of 11). Level and progress show in Collection, Deck and pack openings; the engine applies it through `withLevel` in `newSide`.
- **Title.** The A in GRAY glitches into an & now and then (CSS only, off for reduced motion and lite mode).
- Sims: `tools/csim.ts N decks` compares the Rare+ deck with the starter deck; the coach sim prints the And-One rate.

## Round 2B: possession animation, pack opening, shop
- **Possession animation (about 4 s, FAST about 1.8 s, tap skips, lite caps the speed factor at 0.9)** in five beats (`steps()` in `play.ts`): pass, move, defender reaction, shot, result. Defenders move by scheme (`SCHEME_SPOTS`, `formationFor` in `geometry.ts`): Pack the Paint sags into the lane (Three open), Drop gathers at the elbow, Close Out runs to the arc (Rim open). A right guess puts the defender in the shooter's face (Rim: a collision and an awkward floater; Mid/Three: only his hand goes up). A wrong guess on a Rim shot is a drive past him (`DRIVE_START` to `DRIVE_END`): layup, or a dunk for a Big or Rim 82+ (`dunks`). Double team: two defenders converge on the marked man, the open man pulses. And-One: whistle icon and Web Audio whistle, then a free-throw ball and "+1". The defender lines and OPEN ring follow the tokens frame by frame (`trackLines`). Big callouts shrink to fit the screen. Lab previews any case with `lab-prev` value `pv:<zone>:<scheme>:<make|miss>[:big,small,dt,a1,block,s1,s2]`.
- **Pack opening:** one card at a time, drops from the top and bounces like a basketball (2 bounces, Iconic 3, lite 1; `dropFrames`, Web Audio `thump`), charges (longer for rarer tiers; Iconic glitches before the reveal), tap for the next card, Skip all, summary screen with every card; duplicates show "+N shards" on the card (Baller shards: shared pool, Play card shards: that card only).
- **Pack shop:** each pack shows Rare+/Epic+/Legendary+/Iconic chances per pack and the pity counter ("7/10 until guaranteed Epic+").
- **Auto deck note** on the title screen and the Story tab. Squad landscape is a proper two-group grid; hand cards and shooter chips scale their text with container units.
- Tests: `test/ui.test.ts` (geometry and drop). Screens: `screens/round2b-*.png`. Engine untouched, `npm run sim` unchanged.
