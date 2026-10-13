// All in-game lore text lives here, so it can be extended in one place. Keep lines short: they show on title, loading and pack screens.
// Origin: at the Ballerz mint, some crazy-hair Ballerz got one random gray pixel in the wrong place. That glitch is the source of the Grid.
// Gray Pixel is a sidegame inside the Ballerz ecosystem. The Grid is a glitching arena: Ballerz are not born there, they are rendered.

export const GAME_TAGLINE = 'Ballerz Card Collecting Game';
export const SPLASH_PROMPT = 'Enter the Grid';
export const SPLASH_HINT = 'tap, click or press any key';

/** Short lines rotated on the title screen. */
export const TITLE_LINES: string[] = [
  'It started at the mint: one gray pixel, in the wrong place.',
  'Some Ballerz came out with a pixel nobody drew. The Grid grew from it.',
  'Look above the hair. The glitch is still there.',
  'Nobody is born in the Grid. Ballerz are rendered, one frame at a time.',
  'One pixel slipped. The Grid let it through.',
];

/** Boot screen lines (shown once per session while the Grid “loads”). */
export const BOOT_LINES: string[] = [
  'READING THE MINT...',
  'RENDERING 9,775 BALLERZ...',
  'FOUND: 1 GRAY PIXEL, OUT OF PLACE',
  'OPENING THE GRID...',
  'THE ARENA IS LIVE.',
];

/** Pack screens: what opening a pack means in the Grid. */
export const PACK_LINES = {
  shop: 'Packs are render queues. Pay in Bucks, and the Grid prints new Ballerz. Now and then it prints one with a stray pixel.',
  ripHint: 'The render starts by itself. Tap to hurry it.',
  ripIconic: 'Something rare is compiling inside. A gray pixel is out of place.',
  rendering: ['Rendering cards...', 'Compiling Ballerz...', 'Placing one pixel too many...'],
  done: 'Render complete. The cards are yours.',
  dupe: 'A duplicate render. It decays into shards.',
};

/** Other places where the world shows. */
export const MENU_LINES = {
  coachPick: 'Choose who calls the plays in the Grid.',
  story: 'Eight courts, one signal. Climb the ladder and find where the gray pixel came from.',
  squad: 'Your squad is whoever the Grid has rendered for you so far.',
  collection: 'Everything the Grid has printed for you lives here.',
  deck: 'A deck is the playbook you load before the match starts.',
  lab: 'Back-room terminal. Poke the simulation at your own risk.',
};

/** Names for the rare-shot labels. SYSTEM ERROR is the top step; INHUMAN (a made 1% shot) gets a Grid-flavored alias. */
export const GLITCH_LORE: Record<string, { sub: string; alias?: string }> = {
  GLITCHED: { sub: 'A gray pixel slipped through.' },
  OVERCLOCKED: { sub: 'The shot ran past its own limit.' },
  'SYSTEM ERROR': { sub: 'The pixel won the argument.' },
  INHUMAN: { sub: 'A shot that should not exist.', alias: 'ROGUE RENDER' },
};

export const pick = <T,>(arr: T[], seed = Date.now()): T => arr[Math.abs(Math.floor(seed)) % arr.length];
