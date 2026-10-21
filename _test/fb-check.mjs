// 验证：非拉丁字符走 fillText 兜底路径时，字形取决于系统里能命中的字体；
// 而描边（strokeText）用的是给细笔画调的发光参数，落在实心字形上会变成
// 一圈又厚又硬的轮廓线。换字体即换观感，所以「在另一台电脑上才看到怪线条」。
//   node _test/fb-check.mjs
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

// 兜底字体栈在引擎里是 var FALLBACK_STACK = DSHIW_FALLBACK_STACK，
// 所以在加载引擎前用查询参数改写全局即可模拟另一台机器。
const harness = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;width:100%;height:100%;background:#000;overflow:hidden}
#frame{position:relative;width:960px;height:540px;overflow:hidden;background:#000}</style>
<div id="frame"><div id="host" style="position:absolute;inset:0"></div></div>
<script>${data}</script>
<script>${engine}</script>
<script>
  var q2 = new URLSearchParams(location.search);
  /* 引擎脚本会用自己的默认值覆盖同名全局，所以改写必须放在它之后、
     创建实例之前。 */
  if (q2.get('fb')) DSHIW_FALLBACK_STACK = q2.get('fb');
  var st = document.createElement('style'); st.textContent = DSHIW_CSS; document.head.appendChild(st);
  window.__engine = dshiwCreateSplash(document.getElementById('host'), {
    text: q2.get('text') || '魏晋裕', theme: 'dark', font: 'caveat',
    caption: '', skipLabel: '', inline: true
  });
  window.__engine.seek(parseFloat(q2.get('t')) || 5);
  window.__fb = FALLBACK_STACK;
  document.documentElement.setAttribute('data-ready', '1');
</script>`;

const harnessFile = path.join(here, 'fb-harness.html');
fs.writeFileSync(harnessFile, harness);

const { proc, page } = await launch(path.join(here, 'profile-fb'));
const c = new CDP(page.webSocketDebuggerUrl);
await c.open();
await c.send('Page.enable');
await c.send('Runtime.enable');
await c.send('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 1, mobile: false });

const url = pathToFileURL(harnessFile).href;
const TEXT = process.env.TEXT || '魏晋裕';
const stacks = [
  ['kaiti', '"KaiTi","STKaiti","Kaiti SC",serif'],
  ['yahei', '"Microsoft YaHei",sans-serif'],
  ['simsun', '"SimSun",serif'],
  ['georgia', '"Georgia",serif']
];

for (const [tag, fb] of stacks) {
  await c.send('Page.navigate', { url: `${url}?t=5&text=${encodeURIComponent(TEXT)}&fb=${encodeURIComponent(fb)}` });
  for (let i = 0; i < 100; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try {
      if (await c.eval(`document.documentElement.getAttribute('data-ready')==='1'`)) break;
    } catch (e) { /* loading */ }
  }
  await new Promise((r) => setTimeout(r, 200));
  const used = await c.eval('String(window.__fb)');
  const file = path.join(shots, `fb-${tag}-t5.png`);
  await c.shot(file);
  console.log(`${tag.padEnd(8)} resolved stack=${used}  ${fs.statSync(file).size}B`);
}

c.close();
proc.kill();
console.log('shots ->', shots);
