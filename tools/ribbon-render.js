// Перерисовать ленты после смены текста: npm i puppeteer-core sharp && node tools/ribbon-render.js assets/img
// (путь к Chrome ниже — поправьте под свою систему; в index.html data-m у треков должно совпасть с выводом m)
const puppeteer = require('puppeteer-core');
const sharp = require('sharp');
const outDir = process.argv[2];
const html = `<!doctype html><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@600&display=swap" rel="stylesheet">
<style>html,body{margin:0;background:transparent}svg{display:block;width:4320px;height:360px;overflow:visible}
.band{fill:none;stroke-width:62}.lime{stroke:#CFE08A}.olive{stroke:#2E3520}
text{font-family:Geist;font-size:27px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;dominant-baseline:central}
.t-lime{fill:#2E3520}.t-olive{fill:#DCE7A9}</style>
<svg id="olive" viewBox="0 0 4320 360"><path class="band olive" id="p2"/><text class="t-olive"><textPath href="#p2"></textPath></text></svg>
<svg id="lime" viewBox="0 0 4320 360"><path class="band lime" id="p1"/><text class="t-lime"><textPath href="#p1"></textPath></text></svg>
<script>
const RP=720,RTOTAL=12,RAMP=92,RSTART=-720;
const wave=(y0,phase)=>{let d='M'+RSTART+','+y0;for(let i=0;i<RTOTAL*2;i++){const s=(i+phase)%2===0?-1:1;d+=i===0?' c120,'+s*RAMP+' 240,'+s*RAMP+' 360,0':' s240,'+s*RAMP+' 360,0';}return d;};
window.build=()=>{const res={};
for(const [id,y0,ph,phrase] of [['lime',166,0,'паста ✦ пицца ✦ хачапури ✦ лазанья ✦ супы ✦ брауни ✦ креветки ✦ роллы с манго ✦ и да, шоколадки'],['olive',194,1,'не грудка с гречкой ✦ не диета ✦ не марафон ✦ без запретов']]){
 const svg=document.getElementById(id),path=svg.querySelector('path'),tp=svg.querySelector('textPath'),text=svg.querySelector('text');
 path.setAttribute('d',wave(y0,ph));const unit=phrase+' ✦ ';tp.textContent=unit;const U=text.getComputedTextLength();const total=path.getTotalLength();const Lp=total/RTOTAL;
 let best={m:1,q:1,score:9};[1,2,3].forEach(m=>{const q=Math.max(1,Math.round(m*Lp/U));const sc=Math.abs(m*Lp/(q*U)-1);if(sc<best.score-0.02)best={m,q,score:sc};});
 tp.textContent=unit.repeat(best.q*RTOTAL/best.m);text.setAttribute('textLength',total.toFixed(1));text.setAttribute('lengthAdjust','spacing');res[id]=best;}
 return res;};
</script>`;
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
  const p = await b.newPage();
  await p.setViewport({ width: 4320, height: 800, deviceScaleFactor: 1.5 });
  await p.setContent(html, { waitUntil: 'networkidle0' });
  await p.evaluate(async () => { await document.fonts.load('600 27px Geist', 'паста ✦'); await document.fonts.ready; if (!document.fonts.check('600 27px Geist', 'паста')) throw new Error('Geist not loaded'); });
  const res = await p.evaluate(() => window.build());
  for (const id of ['lime', 'olive']) {
    const el = await p.$('#' + id);
    const png = await el.screenshot({ omitBackground: true, type: 'png' });
    const info = await sharp(png).webp({ quality: 88, alphaQuality: 90, effort: 6 }).toFile(`${outDir}/ribbon-${id}.webp`);
    console.log(id, JSON.stringify(res[id]), info.width + 'x' + info.height, Math.round(info.size / 1024) + 'KB');
  }
  await b.close();
})();
