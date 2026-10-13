import { createRequire } from 'node:module';
const require = createRequire('/opt/node-tools/');
const { chromium } = require('playwright');
const [, , html, prefix] = process.argv;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.addInitScript(() => { sessionStorage.setItem('gp_lab_ok', '1'); localStorage.setItem('ballerz_tut_v1', '1'); });
await page.goto('file://' + html); await page.waitForTimeout(500); await page.mouse.click(200, 400); await page.waitForTimeout(800);
await page.evaluate(() => window.__gpOpen([{ tier: 'iconic', holo: true }, { kind: 'baller', tier: 'epic' }]));
for (let i = 0; i < 6; i++) { await page.waitForTimeout(i === 0 ? 1200 : 300); await page.screenshot({ path: `${prefix}-pack-${i}.png` }); }
await page.evaluate(() => document.querySelector('.pack-hit').click());
await page.waitForSelector('.flip.solo.waiting, .flip.solo.building', { timeout: 20000 });
for (let i = 0; i < 6; i++) { await page.waitForTimeout(700); await page.screenshot({ path: `${prefix}-card-${i}.png` }); }
await browser.close();
