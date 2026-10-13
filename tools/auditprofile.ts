// Writes a profile JSON that owns the cards with the longest texts (for the card overflow audit).
import { writeFileSync } from 'node:fs';
import catalogJson from '../src/data/catalog.json';
import { ballersOfTier, loadCatalog, type Catalog, type Tier } from '../src/rules';
import { cBaller } from '../src/casual/engine';
import { allCards } from '../src/casual/cards';
import { specialText } from '../src/casual/specials';
loadCatalog(catalogJson as unknown as Catalog);
const cards: Record<string, { n: number; holo: number; first: number }> = {};
const own = (k: string, holo = 0) => { cards[k] = { n: 2, holo, first: 1 }; };
const tiers: Tier[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'iconic'];
for (const id of ballersOfTier('iconic')) own('b:' + id, 1);
for (const t of tiers.slice(0, 5)) {
  const ids = ballersOfTier(t).map((id) => { const b = cBaller(id); return { id, len: b.name.length + b.skill.text.length + b.skill.name.length + (b.special ? specialText(b.special, false).length : 0) }; }).sort((a, b) => b.len - a.len).slice(0, 14);
  ids.forEach((x) => own('b:' + x.id));
}
const D = catalogJson as unknown as { sneakers?: unknown[] };
void D;
for (let i = 1; i <= 400; i += 4) own('s:' + i);
for (const c of allCards()) own('p:' + c.k);
writeFileSync(process.argv[2], JSON.stringify({ cards, v2: Object.fromEntries(allCards().map((c) => [c.k, 3])) }));
console.log(Object.keys(cards).length, 'cards');
