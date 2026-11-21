// Generate the curved ribbon loop and matching fallback poster.
// Requires Playwright, Sharp, Chromium and FFmpeg. Run from the repository root:
// node tools/ribbon-render.js /path/to/chromium
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { writeFile } = require('node:fs/promises');
const { chromium } = require('playwright');
const sharp = require('sharp');

const width = 1440;
const height = 320;
const fps = 30;
const frames = 360;
const html = `<!doctype html><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@600&display=swap" rel="stylesheet">
<style>
  body { margin: 0; background: #f7f5ec; }
  svg { display: block; }
  path { fill: none; stroke-width: 60; }
  text { font: 600 26px Geist, sans-serif; letter-spacing: .07em; text-transform: uppercase; dominant-baseline: central; }
</style>
<svg width="${width}" height="${height}" viewBox="0 0 1440 320" xmlns="http://www.w3.org/2000/svg">
  <path id="olive" stroke="#2e3520" d="M-1200 146 C-870 235 -540 257 -167 212 S351 70 634 168 S1038 268 1360 184 S1910 58 2560 201"/>
  <text fill="#dce7a9"><textPath href="#olive">не грудка с гречкой ✦ не диета ✦ не марафон ✦ без запретов</textPath></text>
  <path id="lime" stroke="#cfe08a" d="M-1200 245 C-800 145 -472 70 -100 174 S458 271 734 183 S1122 110 1498 188 S1980 257 2560 130"/>
  <text fill="#2e3520"><textPath href="#lime">паста ✦ пицца ✦ хачапури ✦ лазанья ✦ супы ✦ брауни ✦ креветки ✦ роллы с манго ✦ и да, шоколадки</textPath></text>
</svg>`;

async function render() {
  const browser = await chromium.launch({ executablePath: process.argv[2] });
  try {
    const page = await browser.newPage({
      viewport: { width, height },
      ignoreHTTPSErrors: true
    });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(async () => {
      if (!(await document.fonts.load('600 26px Geist', 'паста')).length) {
        throw new Error('Geist is required to render the ribbons');
      }
      window.ribbons = Array.from(document.querySelectorAll('textPath'), (letters) => {
        const path = document.querySelector(letters.getAttribute('href'));
        const phrase = letters.textContent + '\u00a0✦\u00a0';
        letters.textContent = phrase;
        const period = letters.getComputedTextLength();
        letters.textContent = phrase.repeat(Math.ceil(path.getTotalLength() / period) + 2);
        return { letters, period };
      });
    });

    const encoder = spawn('ffmpeg', [
      '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', 'pipe:0',
      '-an', '-vf', 'scale=1260:280', '-c:v', 'libx264', '-threads', '2',
      '-preset', 'slow', '-tune', 'animation', '-crf', '32', '-g', '120', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', 'assets/video/ribbons.mp4'
    ], { stdio: ['pipe', 'ignore', 'inherit'] });
    const encoded = once(encoder, 'exit');
    const capture = await page.context().newCDPSession(page);
    try {
      for (let frame = 0; frame < frames; frame++) {
        await page.evaluate((progress) => {
          const [olive, lime] = window.ribbons;
          olive.letters.setAttribute('startOffset', (progress - 1) * olive.period);
          lime.letters.setAttribute('startOffset', -progress * lime.period);
        }, frame / frames);
        const { data } = await capture.send('Page.captureScreenshot', { format: 'png' });
        const image = Buffer.from(data, 'base64');
        if (frame === 0) await writeFile('assets/img/ribbons-poster.webp', await sharp(image).webp({ quality: 88 }).toBuffer());
        if (!encoder.stdin.write(image)) await once(encoder.stdin, 'drain');
      }
    } finally {
      encoder.stdin.end();
    }
    const [code] = await encoded;
    if (code !== 0) throw new Error('FFmpeg could not encode the ribbon loop');
  } finally {
    await browser.close();
  }
}
render().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
