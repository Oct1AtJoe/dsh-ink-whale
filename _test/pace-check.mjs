// 验证两个新设置项：关闭后续鲸鱼动画 / 播放倍速。
//   node _test/pace-check.mjs
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
  window.__mk = function (extra) {
    var o = {
      text: 'DeepSeek', theme: 'dark', font: 'caveat', caption: '探索未至之境',
      skipLabel: '', inline: true
    };
    for (var k in extra) o[k] = extra[k];
    return dshiwCreateSplash(document.getElementById('host'), o);
  };
  document.documentElement.setAttribute('data-ready', '1');
</script>`;

const harnessFile = path.join(here, 'pace-harness.html');
fs.writeFileSync(harnessFile, harness);

const { proc, page } = await launch(path.join(here, 'profile-pace'));
const c = new CDP(page.webSocketDebuggerUrl);
await c.open();
await c.send('Page.enable');
await c.send('Runtime.enable');
await c.send('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 1, mobile: false });

const url = pathToFileURL(harnessFile).href;
const results = [];
const step = (name, ok, detail) => {
  results.push(ok);
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  ·  ' + detail : ''));
};

async function load() {
  await c.send('Page.navigate', { url });
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 80));
    try { if (await c.eval(`document.documentElement.getAttribute('data-ready')==='1'`)) return; } catch (e) { /* loading */ }
  }
  throw new Error('harness did not load');
}

/* 淡入淡出用 smoothstep，收尾值是 4.7e-08 这种「数学上非零、视觉上为 0」的数，
   所以按阈值判，不跟 0 做严格相等。 */
const hidden = (v) => v !== 'n/a' && Number.isFinite(parseFloat(v)) && Math.abs(parseFloat(v)) < 1e-3;

/* ---- 1. info 暴露新字段 ---- */
await load();
const plain = JSON.parse(await c.eval(`JSON.stringify(window.__mk({}).info())`));
step('默认 info 含 skipWhale=false', plain.skipWhale === false);
step('默认 info 含 speed=1', plain.speed === 1);
const normalStop = plain.stop;

const skipped = JSON.parse(await c.eval(`JSON.stringify(window.__mk({skipWhale:true}).info())`));
step('skipWhale 后时间轴提前收尾', skipped.stop < normalStop, skipped.stop + 's vs ' + normalStop + 's');
step('skipWhale 收尾点早于鲸鱼描边', skipped.stop < 8.6, skipped.stop + 's');

const fast = JSON.parse(await c.eval(`JSON.stringify(window.__mk({speed:3}).info())`));
step('speed 透传到引擎', fast.speed === 3);
const clamped = JSON.parse(await c.eval(`JSON.stringify(window.__mk({speed:99}).info())`));
step('speed 超范围被夹住', clamped.speed === 4, 'speed 99 -> ' + clamped.speed);

/* ---- 2. skipWhale 在鲸鱼阶段不可见 ----
   不能直接读 canvas 像素：字迹还在画布里，只是整块 opacity 0。
   要看的是可见性：画布不透明度、鲸鱼填充、副标题都得是 0。 */
await load();
await c.eval(`window.__e = window.__mk({skipWhale:true}); window.__e.seek(10.5);`);
await new Promise((r) => setTimeout(r, 250));
const cat = path.join(shots, 'pace-skipwhale-t10.png');
await c.shot(cat);
const skipState = JSON.parse(await c.eval(`(() => {
  const cv = document.querySelector('#host canvas');
  const fill = document.querySelector('#host .dshiw-whale-fill');
  const cap = document.querySelector('#host .dshiw-caption');
  return JSON.stringify({
    canvasOpacity: cv ? cv.style.opacity : 'n/a',
    whaleFill: fill ? fill.getAttribute('fill-opacity') : 'n/a',
    caption: cap ? cap.style.opacity : 'n/a'
  });
})()`));
step('skipWhale 鲸鱼时段画布不可见', hidden(skipState.canvasOpacity), 'canvas opacity=' + skipState.canvasOpacity);
step('skipWhale 鲸鱼时段鲸鱼未上色', hidden(skipState.whaleFill), 'fill-opacity=' + skipState.whaleFill);
step('skipWhale 鲸鱼时段副标题未出现', hidden(skipState.caption), 'caption=' + skipState.caption);

/* 对照：不跳过时同一时刻、同一画布是有内容的 */
await load();
await c.eval(`window.__e = window.__mk({}); window.__e.seek(10.5);`);
await new Promise((r) => setTimeout(r, 250));
const ctrl = JSON.parse(await c.eval(`(() => {
  const cv = document.querySelector('#host canvas');
  const fill = document.querySelector('#host .dshiw-whale-fill');
  return JSON.stringify({
    canvasOpacity: cv ? cv.style.opacity : 'n/a',
    whaleFill: fill ? fill.getAttribute('fill-opacity') : 'n/a'
  });
})()`));
step('对照组同一时刻画布可见', !hidden(ctrl.canvasOpacity), 'canvas opacity=' + ctrl.canvasOpacity);
step('对照组同一时刻鲸鱼已上色', !hidden(ctrl.whaleFill), 'fill-opacity=' + ctrl.whaleFill);

/* ---- 3. 倍速真的改变墙钟时长 ---- */
async function wallTime(speed) {
  await load();
  return await c.eval(`new Promise((resolve) => {
    const t0 = performance.now();
    const e = window.__mk({ skipWhale: true, speed: ${speed}, onDone: function () {
      resolve(Math.round(performance.now() - t0));
    } });
    e.start();
  })`, true);
}

const t1 = await wallTime(1);
const t3 = await wallTime(3);
step('speed=3 明显快于 speed=1', t3 < t1 * 0.55, `1x=${t1}ms  3x=${t3}ms`);
step('speed=3 落在预期区间', t3 > 2000 && t3 < 5200, t3 + 'ms');
step('正常模式总时长约 15 秒', normalStop > 14 && normalStop < 16, normalStop + 's');

c.close();
proc.kill();
const okAll = results.every(Boolean);
console.log(okAll ? `\nOK  ${results.length} 项检查` : `\nFAILED ${results.filter((x) => !x).length}/${results.length}`);
process.exit(okAll ? 0 : 1);
