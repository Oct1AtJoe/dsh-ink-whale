// 开发期视觉自检：用 headless Edge 按时间点定格开屏，和旧版 index.html 对照。
// 不属于发布产物，截图写在 _test/shots（已 gitignore）。
//   node _test/splash-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, CDP } from '../src/tools/cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const shots = path.join(here, 'shots');
fs.mkdirSync(shots, { recursive: true });

const times = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n));
const at = times.length ? times : [1.6, 3.2, 5.0, 7.0, 8.6, 9.6, 11.4, 12.9, 14.6];
const TEXT = process.env.TEXT || 'DeepSeek';
const THEME = process.env.THEME || 'dark';
const FONT = process.env.FONT || 'caveat';
const CAPTION = process.env.CAPTION == null ? '探索未至之境' : process.env.CAPTION;
const LEGACY = THEME === 'light' ? 'index-light.html' : 'index.html';
const TAG = process.env.TAG || 'd';
const INLINE = process.env.INLINE === '1';

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
  var st = document.createElement('style');
  st.textContent = DSHIW_CSS;
  document.head.appendChild(st);
  var q = new URLSearchParams(location.search);
  var text = q.get('text') || 'DeepSeek';
  var theme = q.get('theme') || 'dark';
  var font = q.get('font') || 'caveat';
  var caption = q.get('caption') == null ? '探索未至之境' : q.get('caption');
  var inline = q.get('inline') === '1';
  window.__engine = dshiwCreateSplash(document.getElementById('host'), {
    text: text, theme: theme, font: font, caption: caption, skipLabel: '', inline: inline
  });
  var t = parseFloat(q.get('t'));
  window.__engine.seek(Number.isFinite(t) ? t : 0);
  window.__info = function () { return window.__engine.info(); };
  document.documentElement.setAttribute('data-ready', '1');
</script>`;

const harnessFile = path.join(here, 'harness.html');
fs.writeFileSync(harnessFile, harness);

const { proc, page } = await launch(path.join(here, 'profile'));
const c = new CDP(page.webSocketDebuggerUrl);
await c.open();
await c.send('Page.enable');
await c.send('Runtime.enable');

async function shot(url, file, waitFor) {
  await c.send('Page.navigate', { url });
  for (let i = 0; i < 100; i++) {
    await new Promise((r) => setTimeout(r, 120));
    try {
      const ok = await c.eval(`document.documentElement.getAttribute('data-ready')==='1' || document.documentElement.getAttribute('data-ready')!==null`);
      if (ok) break;
    } catch (e) { /* page still loading */ }
  }
  if (waitFor) await new Promise((r) => setTimeout(r, waitFor));
  await c.shot(file);
  return fs.statSync(file).size;
}

const harnessUrl = pathToFileURL(harnessFile).href;
const legacyUrl = pathToFileURL(path.join(root, LEGACY)).href;

for (const t of at) {
  const hFile = path.join(shots, `new-${TAG}-${t}.png`);
  const lFile = path.join(shots, `old-${TAG}-${t}.png`);
  await shot(`${harnessUrl}?t=${t}&theme=${THEME}&font=${FONT}&text=${encodeURIComponent(TEXT)}&caption=${encodeURIComponent(CAPTION)}${INLINE ? '&inline=1' : ''}`, hFile, 120);
  let info = null;
  try { info = await c.eval('JSON.stringify(window.__info ? window.__info() : null)'); } catch (e) { info = null; }
  if (INLINE) {
    console.log(`t=${t}s  inline=${fs.statSync(hFile).size}B  info=${info}`);
    continue;
  }
  await shot(`${legacyUrl}?t=${t}&name=${encodeURIComponent(TEXT)}&greet=${encodeURIComponent('{name}')}&font=${FONT}&theme=${THEME}`, lFile, 120);
  console.log(`t=${t}s  new=${fs.statSync(hFile).size}B  old=${fs.statSync(lFile).size}B  info=${info}`);
}

c.close();
proc.kill();
console.log('shots ->', shots);
