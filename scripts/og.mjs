// scripts/og.mjs — render a 1200x630 OG card to public/og.png using Playwright.
// Run once with `node scripts/og.mjs`; the PNG is checked into the repo.
import { chromium } from 'playwright';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', 'og.png');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@500;700&display=swap');
  html, body { margin: 0; padding: 0; width: 1200px; height: 630px; }
  body {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    color: #faf3ec;
    background:
      radial-gradient(circle at 16% 18%, rgba(102,206,247,0.32), transparent 40%),
      radial-gradient(circle at 88% 78%, rgba(240,201,90,0.22), transparent 44%),
      linear-gradient(180deg, #12101a 0%, #1a1624 100%);
    overflow: hidden;
  }
  .card {
    padding: 56px 64px;
    height: 100%;
    box-sizing: border-box;
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) auto;
    grid-template-rows: auto 1fr auto;
    gap: 24px 36px;
    align-items: start;
  }
  .eyebrow {
    grid-column: 1 / -1;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 22px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #66cef7;
    margin: 0;
  }
  .hero {
    grid-column: 1;
    align-self: center;
  }
  h1 {
    font-size: 130px;
    line-height: 0.92;
    letter-spacing: -0.04em;
    margin: 0 0 16px;
    font-weight: 700;
    color: #faf3ec;
    white-space: nowrap;
  }
  .tag {
    margin: 0 0 22px;
    font-size: 28px;
    line-height: 1.3;
    color: rgba(231, 222, 245, 0.88);
    max-width: 22ch;
  }
  .vs {
    display: inline-flex;
    align-items: center;
    gap: 20px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    padding: 12px 24px;
    border-radius: 999px;
    font-family: 'IBM Plex Mono', monospace;
    font-weight: 700;
    font-size: 26px;
    border: 2px solid;
  }
  .chip--snark { color: #66cef7; border-color: #66cef7; background: rgba(102,206,247,0.10); }
  .chip--stark { color: #f0c95a; border-color: #f0c95a; background: rgba(240,201,90,0.10); }
  .vs-word {
    color: rgba(220, 210, 240, 0.6);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 22px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }
  .scale {
    grid-column: 2;
    grid-row: 2;
    align-self: end;
    justify-self: end;
    display: grid;
    grid-template-columns: auto auto;
    gap: 28px;
    align-items: end;
    padding: 28px 28px 22px;
    border-radius: 22px;
    background: rgba(8, 6, 14, 0.42);
    border: 1px solid rgba(220, 210, 240, 0.10);
  }
  .scale-wrap { display: grid; justify-items: center; gap: 14px; }
  .scale-grid { display: grid; gap: 2px; }
  .scale-cell { width: 6px; height: 6px; border-radius: 1px; }
  .scale--snark { grid-template-columns: repeat(8, 6px); }
  .scale--snark .scale-cell { background: #66cef7; }
  .scale--stark { grid-template-columns: repeat(32, 6px); }
  .scale--stark .scale-cell { background: #f0c95a; }
  .scale-cap {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 13px;
    color: rgba(220, 210, 240, 0.78);
    text-align: center;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  footer {
    grid-column: 1 / -1;
    grid-row: 3;
    display: flex;
    justify-content: space-between;
    align-items: end;
    color: rgba(220, 210, 240, 0.7);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 22px;
  }
  footer .url { color: #66cef7; }
  .footnote-note {
    color: rgba(220, 210, 240, 0.46);
    font-size: 18px;
  }
</style>
</head>
<body>
<div class="card">
  <p class="eyebrow">Zero-Knowledge · crypto-lab</p>
  <div class="hero">
    <h1>zk-Arena</h1>
    <p class="tag">Compare succinct ZK proof systems side by side.</p>
    <div class="vs">
      <span class="chip chip--snark">SNARK</span>
      <span class="vs-word">vs</span>
      <span class="chip chip--stark">STARK</span>
    </div>
  </div>
  <div class="scale" aria-hidden="true">
    <div class="scale-wrap">
      <div class="scale-grid scale--snark" id="snark"></div>
      <div class="scale-cap">SNARK · 256 B</div>
    </div>
    <div class="scale-wrap">
      <div class="scale-grid scale--stark" id="stark"></div>
      <div class="scale-cap">STARK · 40 KB</div>
    </div>
  </div>
  <footer>
    <span class="url">systemslibrarian.github.io/crypto-lab-zk-arena</span>
    <span class="footnote-note">interactive · accessible · zero runtime deps</span>
  </footer>
</div>
<script>
  for (let i = 0; i < 16; i++) {
    const d = document.createElement('div'); d.className = 'scale-cell';
    document.getElementById('snark').appendChild(d);
  }
  for (let i = 0; i < 32 * 38; i++) {
    const d = document.createElement('div'); d.className = 'scale-cell';
    document.getElementById('stark').appendChild(d);
  }
</script>
</body>
</html>`;

const browser = await chromium.launch({ executablePath: EDGE, channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.setContent(HTML, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.screenshot({
	path: OUT,
	type: 'png',
	clip: { x: 0, y: 0, width: 1200, height: 630 },
});
await browser.close();
console.log('wrote', OUT);
