// node tools/shots.mjs <dist/index.html> <profile.json> <outPrefix> : splash, title, game, collection at 390x844 and 1440x900
import { createRequire } from 'node:module';
const require = createRequire('/opt/node-tools/');
const { chromium } = require('playwright');
import { readFileSync } from 'node:fs';
const [, , html, profPath, prefix] = process.argv;
const prof = JSON.parse(readFileSync(profPath, 'utf8'));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
for (const [tag, vp, lite] of [['m390', { width: 390, height: 844 }, false], ['d1440', { width: 1440, height: 900 }, false], ['m390-lite', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  await page.addInitScript(([p, lite]) => { try { sessionStorage.setItem('gp_lab_ok', '1'); localStorage.setItem('ballerz_tut_v1', '1');
    if (lite) localStorage.setItem('gp_lite', 'on');
    if (!localStorage.getItem('ballerz_ccg_v1')) localStorage.setItem('ballerz_ccg_v1', JSON.stringify({ v: 1, bucks: 5000, cards: p.cards, packs: 0, wins: 0, losses: 0, crt: true, music: false, fast: true, squad: [], shoes: {}, v2: p.v2, coach: 'splash', story: 0, shards: 0, levels: {}, stars: [], claimed: [], pity: {}, daily: { day: '', streak: 0 }, cardShards: {}, decks: {}, pending: [], freePack: '', holoV: 2, tut: { state: 'legacy', pack: false } })); } catch (e) {} }, [prof, lite]);
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto('file://' + html);
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${prefix}-splash-${tag}.png` });
  await page.mouse.click(vp.width / 2, vp.height / 2); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${prefix}-title-${tag}.png` });
  if (!lite) {
  await page.evaluate(() => document.querySelector('[data-a="quick"]')?.click()); await page.waitForTimeout(1800);
  await page.screenshot({ path: `${prefix}-game-${tag}.png` });
  await page.reload(); await page.waitForTimeout(500); await page.mouse.click(vp.width / 2, vp.height / 2); await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector('[data-a="tab"][data-v="collection"]')?.click()); await page.waitForTimeout(800);
  await page.screenshot({ path: `${prefix}-collection-${tag}.png` });
  }
  await ctx.close();
}
await browser.close();
