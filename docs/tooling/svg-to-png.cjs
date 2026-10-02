// Chromium preserves Mermaid SVG typography when preparing figures for PDF.
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');
(async () => {
  const [source, destination] = process.argv.slice(2);
  const options = process.env.CI ? {args: ['--no-sandbox']} : {};
  const browser = await puppeteer.launch(options);
  try {
    const page = await browser.newPage();
    await page.setViewport({width: 1600, height: 1200, deviceScaleFactor: 3});
    await page.setContent('<style>body{margin:0;background:white}svg{display:block}</style>' + fs.readFileSync(source, 'utf8'));
    await page.evaluate(() => document.fonts.ready);
    const svg = await page.$('svg');
    await svg.screenshot({path: path.resolve(destination)});
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
