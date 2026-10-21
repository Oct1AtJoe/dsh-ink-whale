// 复现：另一台电脑上「手写字周围出现线条」。
// 假设：paintRect 用 CSS 像素算矩形，再乘 DPR 取源区域；DPR 为小数
// （Windows 125% / 150% 缩放）时源矩形落在非整数像素，drawImage 与
// destination-in 合成会在每次增量重绘的边界留下接缝线。
//   node _test/dpr-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, CDP } from '../src/tools/cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const shots = path.join(here, 'shots');
fs.mkdirSync(shots, { recursive: true });

const fonts = fs.readFileSync(path.join(root, 'src/data/strokefonts.json'), 'utf8').trim();
const assets = JSON.parse(fs.readFileSync(path.join(root, 'src/data/assets.json'), 'utf8'));
const whale = JSON.parse(fs.readFileSync(path.join(root, 'src/data/whalepoints.json'), 'utf8'));
const engine = fs.readFileSync(path.join(root, 'src/engine.js'), 'utf8');
const wordmark = assets.wordmarkPaths.filter((d) => parseFloat(d.slice(1)) > 30);

const data = [
  'var DSHIW_FONTS=' + fonts + ';',
  'var DSHIW_WHALE_PATH=' + JSON.stringify(assets.whalePath) + ';',
  'var DSHIW_WORDMARK_PATHS=' + JSON.stringify(wordmark) + ';',
  'var DSHIW_WHALE_N=' + whale.n + ';',
  'var DSHIW_WHALE_PTS=' + JSON.stringify(whale.d) + ';'
].join('\n');

const harness = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;width:100%;height:100%;background:#000;overflow:hidden}
#frame{position:relative;width:960px;height:540px;overflow:hidden;background:#000}</style>
<div id="frame"><div id="host" style="position:absolute;inset:0"></div></div>
<script>${data}</script>
<script>${engine}</script>
<script>
  var st = document.createElement('style'); st.textContent = DSHIW_CSS; document.head.appendChild(st);
  var q = new URLSearchParams(location.search);
  window.__engine = dshiwCreateSplash(document.getElementById('host'), {
    text: q.get('text') || 'DeepSeek', theme: 'dark', font: 'caveat',
    caption: '探索未至之境', skipLabel: '', inline: true
  });
  window.__engine.seek(parseFloat(q.get('t')) || 0);
  window.__dpr = window.devicePixelRatio;
  document.documentElement.setAttribute('data-ready', '1');
</script>`;

const harnessFile = path.join(here, 'dpr-harness.html');
fs.writeFileSync(harnessFile, harness);

const { proc, page } = await launch(path.join(here, 'profile-dpr'));
const c = new CDP(page.webSocketDebuggerUrl);
await c.open();
await c.send('Page.enable');
await c.send('Runtime.enable');

const url = pathToFileURL(harnessFile).href;
const TEXT = process.env.TEXT || 'DeepSeek';

for (const dpr of [1, 1.25, 1.5, 2]) {
  await c.send('Emulation.setDeviceMetricsOverride', {
    width: 960, height: 540, deviceScaleFactor: dpr, mobile: false
  });
  for (const t of [2.2, 3.4, 4.6, 5.6]) {
    await c.send('Page.navigate', {
      url: `${url}?t=${t}&text=${encodeURIComponent(TEXT)}`
    });
    for (let i = 0; i < 100; i++) {
      await new Promise((r) => setTimeout(r, 100));
      try {
        const ok = await c.eval(`document.documentElement.getAttribute('data-ready')==='1'`);
        if (ok) break;
      } catch (e) { /* loading */ }
    }
    await new Promise((r) => setTimeout(r, 200));
    const seen = await c.eval('String(window.__dpr)');
    const file = path.join(shots, `dpr-${String(dpr).replace('.', '_')}-t${t}.png`);
    await c.shot(file);
    console.log(`dpr=${dpr} (page reports ${seen})  t=${t}s  ${fs.statSync(file).size}B  -> ${path.basename(file)}`);
  }
}

c.close();
proc.kill();
console.log('shots ->', shots);
