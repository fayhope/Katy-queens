// Renders icons/icon.svg to the PNG sizes iOS and Android want.
// Usage: node tools/make-icons.mjs   (needs Playwright + Chromium)
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../icons/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, rounded] of [['icon-192.png', 192, true], ['icon-512.png', 512, true], ['apple-touch-icon.png', 180, false]]) {
  // iOS rounds the corners itself, so its icon is a full square.
  const body = rounded ? svg : svg.replace('rx="112"', 'rx="0"');
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>*{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${body}`);
  await page.screenshot({ path: new URL(`../icons/${name}`, import.meta.url).pathname, omitBackground: true });
}
await browser.close();
