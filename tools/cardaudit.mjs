// Card overflow audit: node tools/cardaudit.mjs <dist/index.html> <profile.json> [outPrefix]
import { createRequire } from 'node:module';
const require = createRequire('/opt/node-tools/');
const { chromium } = require('playwright');
import { readFileSync } from 'node:fs';
const [, , html, profPath, prefix = ''] = process.argv;
const prof = JSON.parse(readFileSync(profPath, 'utf8'));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
// returns [{card, why}] for every text block that leaves its card
const AUDIT = () => {
  const out = []; let n = 0;
  document.querySelectorAll('.card, .hcard').forEach((card) => {
    if (!card.offsetParent && getComputedStyle(card).position !== 'fixed') return;
    const cr = card.getBoundingClientRect(); if (cr.width < 20) return;
    n++;
    const name = (card.querySelector('.cname b, .hc-name')?.textContent || card.className).slice(0, 30);
    const face = card.querySelector('.cface');
    if (face && face.scrollHeight > face.clientHeight + 1) out.push({ name, why: 'face scrollHeight ' + face.scrollHeight + '>' + face.clientHeight });
    if (!card.closest('.pile-card')) card.querySelectorAll('.cface *, .hcard *').forEach((el) => {
      if (el.closest('.sheen,.foilfx,.holob,.newb,.cnt,.glbar,svg,img,.stray,.hc-art,.cart,.back')) return;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
      const t = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
      if (!t) return;
      if (r.left < cr.left - 1.5 || r.right > cr.right + 1.5 || r.top < cr.top - 1.5 || r.bottom > cr.bottom + 1.5) out.push({ name, why: el.className + ' box outside (' + Math.round(r.bottom - cr.bottom) + 'v ' + Math.round(r.right - cr.right) + 'h)' });
      else if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') out.push({ name, why: el.className + ' clipped x' });
    });
  });
  return { n, out };
};
const results = {};
async function run(label, vp, steps) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript(([p]) => {
    try { sessionStorage.setItem('gp_lab_ok', '1'); localStorage.setItem('ballerz_tut_v1', '1');
      const raw = localStorage.getItem('ballerz_ccg_v1');
      if (!raw) localStorage.setItem('ballerz_ccg_v1', JSON.stringify({ v: 1, bucks: 5000, cards: p.cards, packs: 0, wins: 0, losses: 0, crt: true, music: false, fast: true, squad: [], shoes: {}, v2: p.v2, coach: 'splash', story: 0, shards: 0, levels: {}, stars: [], claimed: [], pity: {}, daily: { day: '', streak: 0 }, cardShards: {}, decks: {}, pending: [], freePack: '', holoV: 2, tut: { state: 'legacy', pack: false } }));
    } catch (e) {}
  }, [prof]);
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto('file://' + html);
  await page.waitForTimeout(500);
  await page.mouse.click(vp.width / 2, vp.height / 2); await page.waitForTimeout(900);
  try { await steps(page, label, vp); } catch (e) { console.log('STEP FAILED', label, e.message.split('\n')[0]); }
  await ctx.close();
}
const check = async (page, label, vp) => { const r = await page.evaluate(AUDIT); (results[label] ||= []).push(r); console.log(label, vp.width, 'cards', r.n, 'overflows', r.out.length, JSON.stringify(r.out.slice(0, 4))); return r; };
for (const vp of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  await run('collection', vp, async (page, l) => {
    await page.evaluate(() => document.querySelector('[data-a="tab"][data-v="collection"]')?.click());
    await page.waitForTimeout(400);
    // scroll through so lazy content renders
    for (let y = 0; y < 30; y++) { await page.evaluate((y) => window.scrollTo(0, y * 700), y); await page.waitForTimeout(40); }
    await check(page, l + '-all', vp);
    await page.evaluate(() => document.querySelector('.card-grid .card')?.click());
    await page.waitForTimeout(400);
    await check(page, 'inspect', vp);
    if (prefix) await page.screenshot({ path: prefix + '-inspect-' + vp.width + '.png' });
  });
  await run('deck', vp, async (page, l) => {
    await page.evaluate(() => document.querySelector('[data-a="tab"][data-v="deck"]')?.click());
    await page.waitForTimeout(500);
    await check(page, l, vp);
  });
  await run('pack', vp, async (page, l) => {
    await page.evaluate(() => window.__gpOpen([{ tier: 'iconic', holo: true }, { kind: 'baller', tier: 'legendary' }, { kind: 'baller', tier: 'epic' }, { kind: 'sneaker', tier: 'legendary' }, { kind: 'play', tier: 'epic' }]));
    await page.waitForTimeout(700);
    const tap = await page.evaluate(() => !!document.querySelector('.pk-tap'));
    await page.waitForTimeout(3500);
    const still = await page.evaluate(() => !!document.querySelector('.pack-hit:not(.ripping)'));
    console.log('pack sealed shows TAP TO OPEN:', tap, 'still waiting after 4s:', still);
    await page.evaluate(() => document.querySelector('.pack-hit').click());
    await page.waitForSelector('.op-pile', { timeout: 20000 });
    await page.evaluate(() => document.querySelector('[data-a="opskip"]').click()); await page.waitForTimeout(800);
    const cnt = await page.evaluate(() => document.querySelectorAll('.op-pile .card').length);
    await check(page, 'pack-final', vp); if (prefix) await page.screenshot({ path: prefix + '-final-' + vp.width + '.png' });
    await page.evaluate(() => document.querySelector('#opCard .front .card').click()); await page.waitForTimeout(400);
    const info = await page.evaluate(() => document.querySelector('.insp-count')?.textContent);
    console.log('featured tap opens inspect:', info, 'pile cards', cnt);
    await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(100);
    const info2 = await page.evaluate(() => document.querySelector('.insp-count')?.textContent);
    console.log('prev from last ->', info2);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    await page.evaluate(() => document.querySelector('#opNextBtn').click()); await page.waitForTimeout(900);
    await check(page, 'pack-summary', vp);
    if (prefix) await page.screenshot({ path: prefix + '-summary-' + vp.width + '.png' });
  });
  await run('game', vp, async (page, l) => {
    await page.evaluate(() => document.querySelector('[data-a="quick"]')?.click());
    await page.waitForTimeout(1500);
    await check(page, l, vp);
    if (prefix) await page.screenshot({ path: prefix + '-game-' + vp.width + '.png' });
  });
}
await browser.close();
let total = 0; for (const k in results) for (const r of results[k]) total += r.out.length;
console.log('TOTAL overflows', total);
