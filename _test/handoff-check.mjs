// 开发期交接动画自检：用一个仿 AppFrame 的页面（带 [data-shell-overlay]）挂载引擎，
// 到 logo 终帧调用 skip()，按时间点采样计算样式 / 包围盒并截图，验证：
//   - 整屏只做 opacity 渐隐（dshiw-splash-out），先停留 22% 再淡出；
//   - 只有鲸鱼分组做 scale 1→1.25 + blur 0→10px（dshiw-whale-zoom），
//     transform-origin 取自身包围盒中心，推近时中心不动；
//   - 字标 / 副标题的包围盒完全不变，不参与缩放；
//   - 主界面（sidebar / center 等）没有任何动画，也不被写 transform-origin；
//   - 内嵌预览（inline）和 reduce 模式不触发缩放。
// 帧间隔默认在无 GPU 的软件渲染下测（偏悲观）；加 DSHIW_GPU=1 可开 GPU 对照。
// 截图写在 _test/shots（已 gitignore）。不属于发布产物。
//   node _test/handoff-check.mjs
//   DSHIW_GPU=1 node _test/handoff-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, CDP } from '../src/tools/cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const shots = path.join(here, 'shots');
fs.mkdirSync(shots, { recursive: true });

const dataDir = path.join(root, 'src/data');
const fonts = JSON.parse(fs.readFileSync(path.join(dataDir, 'strokefonts.json'), 'utf8'));
const assets = JSON.parse(fs.readFileSync(path.join(dataDir, 'assets.json'), 'utf8'));
const whale = JSON.parse(fs.readFileSync(path.join(dataDir, 'whalepoints.json'), 'utf8'));
const wordmark = assets.wordmarkPaths.filter((d) => parseFloat(d.slice(1)) > 30);

const dataBlock = [
  'var DSHIW_FONTS = ' + JSON.stringify(fonts) + ';',
  'var DSHIW_WHALE_PATH = ' + JSON.stringify(assets.whalePath) + ';',
  'var DSHIW_WORDMARK_PATHS = ' + JSON.stringify(wordmark) + ';',
  'var DSHIW_WHALE_N = ' + String(whale.n) + ';',
  'var DSHIW_WHALE_PTS = ' + JSON.stringify(whale.d) + ';'
].join('\n');
const engine = fs.readFileSync(path.join(root, 'src/engine.js'), 'utf8');

// 仿 DSH AppFrame：一个 div 直接持有 sidebar / center / 右下 / overlay。
const harness = `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;height:100%;background:#000}
  #app{display:flex;width:100vw;height:100vh;overflow:hidden;background:#0b0d12;color:#dbe4f2;
       font-family:"Segoe UI","Microsoft YaHei",sans-serif}
  #sidebar{width:250px;flex:none;background:#141821;border-right:1px solid #222a38;padding:22px 16px}
  #sidebar h3{margin:0 0 18px;font-size:13px;letter-spacing:.12em;color:#8ea3c4;font-weight:600}
  #sidebar li{list-style:none;padding:7px 10px;margin:2px 0;border-radius:6px;font-size:13px;color:#a8b6cc}
  #center{flex:1;display:flex;flex-direction:column;min-width:0}
  #topbar{height:52px;flex:none;border-bottom:1px solid #1e2532;display:flex;align-items:center;padding:0 20px;
          font-size:13px;color:#93a5c0;letter-spacing:.05em}
  #main{flex:1;padding:34px 40px}
  #main h1{margin:0 0 10px;font-size:26px;font-weight:650;color:#eef3fb}
  #main p{margin:0 0 22px;font-size:13px;line-height:1.9;color:#8d9db6;max-width:640px}
  .card{height:120px;border-radius:12px;background:linear-gradient(160deg,#18202e,#121722);
        border:1px solid #232c3d;margin-bottom:14px;max-width:720px}
  [data-shell-bottom]{flex:none}
  [data-shell-overlay]{position:fixed;inset:0;pointer-events:none;z-index:40}
  [data-shell-overlay] .dshiw-root{pointer-events:auto}
</style>
<div id="app" class="AppFrame">
  <aside id="sidebar">
    <h3>HARNESS</h3>
    <ul><li>会话</li><li>插件</li><li>设置</li></ul>
  </aside>
  <div id="center">
    <div id="topbar">DeepSeek Harness</div>
    <div id="main">
      <h1>主界面已经就位</h1>
      <p>这一段是仿真的主页面内容。开屏交接时它不应该有任何位移或缩放，
         只应该随着开屏淡出露出来。</p>
      <div class="card"></div><div class="card"></div>
    </div>
  </div>
  <div data-shell-bottom></div>
  <div data-shell-overlay></div>
</div>
<script>${dataBlock}</script>
<script>${engine}</script>
<script>
  (function () {
    var s = document.createElement('style');
    s.setAttribute('data-dsh-ink-whale-styles', '');
    s.textContent = DSHIW_CSS;
    document.head.appendChild(s);
  })();
</script>
<script>
  window.__host = document.querySelector('[data-shell-overlay]');
  window.__mount = function (opts) {
    if (window.__engine) { try { window.__engine.destroy() } catch (e) {} }
    window.__done = 0;
    window.__handoffT0 = 0;
    /* 和真实客户端一致：overlay > div.dshiw-mount > .dshiw-root */
    Array.prototype.forEach.call(window.__host.querySelectorAll('.dshiw-mount'), function (el) { el.remove(); });
    var mount = document.createElement('div');
    mount.className = 'dshiw-mount';
    window.__host.appendChild(mount);
    var o = Object.assign({
      text: '墨鲸', font: 'caveat', theme: 'dark', caption: '探索未至之境',
      hold: 0.01,
      onDone: function () { window.__done++; }
    }, opts || {});
    window.__engine = dshiwCreateSplash(mount, o);
    return true;
  };
  function pick(el) {
    var s = getComputedStyle(el);
    return {
      opacity: +(+s.opacity).toFixed(3),
      transform: s.transform,
      filter: s.filter,
      animation: s.animationName + ' ' + s.animationDuration
    };
  }
  function box(el) {
    if (!el) return null;
    var b = el.getBoundingClientRect();
    return { x: +b.left.toFixed(2), y: +b.top.toFixed(2), w: +b.width.toFixed(2), h: +b.height.toFixed(2) };
  }
  window.__styles = function () {
    var r = document.querySelector('.dshiw-root');
    var whale = document.querySelector('.dshiw-whale-zoom');
    var word = document.querySelector('.dshiw-word');
    var caption = document.querySelector('.dshiw-caption');
    var app = document.getElementById('app');
    var kids = Array.prototype.map.call(app.children, function (el) { return el.style.transformOrigin || ''; });
    return {
      t: performance.now(),
      elapsed: window.__handoffT0 ? +((performance.now() - window.__handoffT0) / 1000).toFixed(3) : 0,
      root: r ? pick(r) : null,
      whale: whale ? pick(whale) : null,
      whaleBox: box(whale),
      word: word ? pick(word) : null,
      wordBox: box(word),
      captionBox: box(caption),
      sidebar: pick(document.getElementById('sidebar')),
      appAnim: getComputedStyle(app).animationName,
      appClass: app.className,
      appOrigin: app.style.transformOrigin || '',
      kidOrigins: kids,
      mountOk: !!r && r.parentElement.classList.contains('dshiw-mount') &&
        r.closest('[data-shell-overlay]').parentElement === app,
      done: window.__done
    };
  };
  window.__fpsStart = function () {
    window.__frames = [];
    var last = 0;
    function loop(ts) {
      if (last) window.__frames.push(ts - last);
      last = ts;
      if (window.__frames.length < 110) requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  };
  window.__fps = function () {
    var a = window.__frames.slice(5).sort(function (x, y) { return x - y; });
    return JSON.stringify({
      frames: a.length,
      med: +(a[Math.floor(a.length / 2)] || 0).toFixed(1),
      p95: +(a[Math.floor(a.length * 0.95)] || 0).toFixed(1)
    });
  };
</script>`;

const page = path.join(here, 'handoff.html');
fs.writeFileSync(page, harness);

const { proc, page: target } = await launch(undefined, { gpu: process.env.DSHIW_GPU === '1' });
const cdp = new CDP(target.webSocketDebuggerUrl);
await cdp.open();
await cdp.send('Page.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });

const results = [];
function rec(name, ok, detail) { results.push({ name, ok: !!ok, detail }); console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  · ' + detail : '')); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await cdp.send('Page.navigate', { url: 'file:///' + page.replace(/\\/g, '/') });
await sleep(700);

rec('页面装载', await cdp.eval('!!window.dshiwCreateSplash && !!window.__host'), '');
await cdp.eval('__mount()');
await sleep(300);
rec('挂载路径与真实客户端一致（overlay > .dshiw-mount > .dshiw-root）', await cdp.eval('__styles().mountOk'), '');

// 落到 logo 终帧，作为交接前基准
await cdp.eval('__engine.seek(__engine.info().end - 0.25)');
await sleep(120);
const base = await cdp.eval('JSON.stringify(__styles())').then(JSON.parse);
await cdp.shot(path.join(shots, 'handoff-0-before.png'));
rec('交接前 logo 完整', base.root.opacity > 0.98, 'opacity=' + base.root.opacity);

// 触发交接。第一轮只采样不截图（截图会让渲染进程 stall，把时间点带偏）；
// 采样点用页面内 elapsed 记录，断言按真实经过时间判断。
await cdp.eval('__fpsStart()');
await cdp.eval('window.__handoffT0 = performance.now(); __engine.skip()');
const frames = [];
for (const [label, wait] of [['A', 300], ['B', 520], ['C', 800]]) {
  await sleep(wait);
  const st = await cdp.eval('JSON.stringify(__styles())').then(JSON.parse);
  frames.push({ label, st });
  console.log('  @' + label + ' elapsed=' + st.elapsed + 's  root=' + JSON.stringify(st.root) + '  whale=' + JSON.stringify(st.whale) +
    '  whaleBox=' + JSON.stringify(st.whaleBox));
}

const a = frames[0].st;
const b = frames[1].st;
const c = frames[2].st;

// 第二轮只截图，用同一段时间点留档
await cdp.eval('__mount()');
await sleep(200);
await cdp.eval('__engine.seek(__engine.info().end - 0.1)');
await sleep(120);
await cdp.shot(path.join(shots, 'handoff-0-before.png'));
await cdp.eval('__engine.skip()');
await sleep(750);
await cdp.shot(path.join(shots, 'handoff-1-mid.png'));
await sleep(900);
await cdp.shot(path.join(shots, 'handoff-2-after.png'));

const scaleOf = (tf) => {
  const m = /matrix\(([\d.]+)/.exec(tf || '');
  return m ? parseFloat(m[1]) : 1;
};

// 1) 整屏：只淡出，先停留再褪
rec('采样时间点可信', a.elapsed > 0.2 && a.elapsed < 0.45 && b.elapsed > 0.6 && b.elapsed < 1.05 && c.elapsed > 1.45,
  'A=' + a.elapsed + 's B=' + b.elapsed + 's C=' + c.elapsed + 's');
rec('整屏挂上 dshiw-splash-out', a.root.animation.startsWith('dshiw-splash-out'), a.root.animation);
rec('前 0.3s 仍保持不透明（留时间给推近）', a.root.opacity > 0.95, 'opacity=' + a.root.opacity);
rec('中段正在渐隐（0.2~0.9）', b.root.opacity > 0.2 && b.root.opacity < 0.9, 'opacity=' + b.root.opacity);
rec('结束时已基本透明', c.root.opacity < 0.05, 'opacity=' + c.root.opacity);
rec('整屏本身不模糊（模糊只在鲸鱼那一层）', (b.root.filter || 'none') === 'none', 'filter=' + b.root.filter);

// 2) 鲸鱼：单独的缩放 + 失焦层
rec('鲸鱼单独一层挂上 dshiw-whale-zoom', a.whale.animation.startsWith('dshiw-whale-zoom'), a.whale.animation);
rec('0.3s 时刚开始推近（scale 接近 1）', scaleOf(a.whale.transform) >= 1 && scaleOf(a.whale.transform) < 1.06, 'scale=' + scaleOf(a.whale.transform));
rec('中段推近到 1.05~1.20', scaleOf(b.whale.transform) > 1.05 && scaleOf(b.whale.transform) < 1.2, 'scale=' + scaleOf(b.whale.transform));
rec('推近单调递增（0.3s < 0.8s < 结束）', scaleOf(a.whale.transform) < scaleOf(b.whale.transform) && scaleOf(b.whale.transform) < scaleOf(c.whale.transform),
  scaleOf(a.whale.transform) + ' → ' + scaleOf(b.whale.transform) + ' → ' + scaleOf(c.whale.transform));
rec('默认不带 blur（只走 transform/opacity，最稳）', (b.whale.filter || 'none') === 'none', 'filter=' + b.whale.filter);
rec('鲸鱼包围盒确实变大（>5%）', b.whaleBox.w > a.whaleBox.w * 1.05, 'A=' + a.whaleBox.w + ' B=' + b.whaleBox.w);
const ccx = (o) => o.x + o.w / 2, ccy = (o) => o.y + o.h / 2;
rec('推近围绕自身中心（中心位移 < 2px）', Math.abs(ccx(b.whaleBox) - ccx(a.whaleBox)) < 2 && Math.abs(ccy(b.whaleBox) - ccy(a.whaleBox)) < 2,
  'dx=' + (ccx(b.whaleBox) - ccx(a.whaleBox)).toFixed(1) + ' dy=' + (ccy(b.whaleBox) - ccy(a.whaleBox)).toFixed(1));

// 3) 字标 / 副标题：不参与缩放
const wordW0 = base.wordBox.w, wordW1 = b.wordBox.w;
rec('字标宽度不随鲸鱼缩放变化', Math.abs(wordW1 - wordW0) < 0.6, 'before=' + wordW0 + ' mid=' + wordW1);
rec('字标没有动画', !b.word.animation || b.word.animation.startsWith('none'), 'anim=' + b.word.animation);
rec('副标题包围盒不变化', base.captionBox && b.captionBox && Math.abs(b.captionBox.w - base.captionBox.w) < 0.6,
  'before=' + (base.captionBox && base.captionBox.w) + ' mid=' + (b.captionBox && b.captionBox.w));

// 4) 主界面：零动画、零 transform-origin 写入
rec('主界面没有任何动画', a.sidebar.animation.startsWith('none') && b.sidebar.animation.startsWith('none') && c.sidebar.animation.startsWith('none'), a.sidebar.animation);
rec('AppFrame 没有被加类', a.appClass === 'AppFrame' && b.appClass === 'AppFrame', 'className=' + a.appClass);
rec('AppFrame 没有被写 transform-origin', a.appOrigin === '' && a.kidOrigins.every((v) => v === ''), 'origins=' + JSON.stringify(a.kidOrigins));
rec('AppFrame 自身没有动画', a.appAnim.startsWith('none'), 'anim=' + a.appAnim);

// 5) 收尾
rec('交接结束 logo 已淡出', c.root.opacity < 0.05, 'opacity=' + c.root.opacity);
rec('交接结束主界面完全显示', c.sidebar.opacity > 0.99, 'sidebar opacity=' + c.sidebar.opacity);
rec('onDone 只回调一次', c.done === 1, 'done=' + c.done);

// 6) inline 预览不触发交接
await cdp.eval('__mount({ inline: true, hold: 0.6 })');
await sleep(200);
await cdp.eval('__engine.skip()');
await sleep(260);
const inlineSt = await cdp.eval('JSON.stringify(__styles())').then(JSON.parse);
rec('inline 预览不进入交接动画', !inlineSt.root || inlineSt.root.animation.startsWith('none'), inlineSt.root && inlineSt.root.animation);
rec('inline 预览自身淡出', inlineSt.root && inlineSt.root.opacity < 0.5, 'inline root opacity=' + (inlineSt.root && inlineSt.root.opacity));

// 7) reduce 模式只淡出
await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await cdp.eval('__mount()');
await sleep(200);
await cdp.eval('__engine.seek(__engine.info().end)');
await sleep(100);
await cdp.eval('__engine.skip()');
await sleep(260);
const redSt = await cdp.eval('JSON.stringify(__styles())').then(JSON.parse);
rec('reduce 模式不做鲸鱼缩放', !redSt.whale || redSt.whale.animation.startsWith('none'), redSt.whale && redSt.whale.animation);
await cdp.send('Emulation.setEmulatedMedia', { features: [] });

// 8) 再跑一遍完整交接，单独测帧间隔（截图会让渲染进程 stall，污染 p95）
await cdp.eval('__mount()');
await sleep(150);
await cdp.eval('__engine.seek(__engine.info().end - 0.2)');
await sleep(100);
await cdp.eval('__fpsStart()');
await cdp.eval('__engine.skip()');
await sleep(1800);
const fps = await cdp.eval('__fps()');
console.log('  纯交接（无截图）rAF 帧间隔: ' + fps);
rec('交接帧间隔 median < 20ms', JSON.parse(fps).med < 20, fps);

cdp.close();
try { proc.kill() } catch (e) { }

const failed = results.filter((r) => !r.ok);
console.log('\n' + (failed.length ? 'FAILED ' + failed.length + ' / ' : 'OK  ') + results.length + ' 项检查');
if (failed.length) { console.log(JSON.stringify(failed, null, 2)); process.exit(1); }
