// 开发期首屏遮罩自检：直接复用 index.js 导出的 bootCoverRows / BOOT_COVER_STYLE /
// BOOT_COVER_SCRIPT / apply，在无头 Edge 里模拟「官方 boot 卡换成 AppFrame」的那一刻，验证：
//   - apply 会监听 webserver/index-inject 并推入 style + head script 两行；
//   - boot 卡还在时不遮；
//   - AppFrame（[data-shell-overlay]）一出现就盖住，底色跟页面一致、层级在开屏之下；
//   - 浏览器半调用 __dshiwBootCover.drop() 后遮罩移除，重复调用不报错；
//   - 缓存里 enabled:false 时完全不起遮罩。
//   node _test/boot-cover-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, CDP } from '../src/tools/cdp.mjs';
import { BOOT_COVER_STYLE, BOOT_COVER_SCRIPT, bootCoverRows, apply } from '../index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const shots = path.join(here, 'shots');
fs.mkdirSync(shots, { recursive: true });

const results = [];
function rec(name, ok, detail) { results.push({ name, ok: !!ok, detail }); console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  · ' + detail : '')); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 结构化注入行：apply 是否真的挂到了 webserver/index-inject 上 ----
const listeners = {};
const fakeCtx = {
  fiber: {},
  effect: () => {},
  inject(names, cb) {
    if (names.indexOf('webServer') < 0) return;
    cb({
      webServer: {},
      effect(fn) { fn(); },
      on(name, fn) { listeners[name] = fn; return () => { delete listeners[name]; }; }
    });
  }
};
apply(fakeCtx);
const rows = bootCoverRows();
const table = [];
if (listeners['webserver/index-inject']) listeners['webserver/index-inject'](table);
rec('apply 监听 webserver/index-inject', typeof listeners['webserver/index-inject'] === 'function', '');
rec('推入 style + head script 两行', table.length === 2 && table[0].kind === 'style' && table[1].kind === 'script',
  JSON.stringify(table.map((r) => r.kind + ':' + (r.placement || ''))));
rec('遮罩 CSS 行带固定 id', BOOT_COVER_STYLE.indexOf('#dshiw-boot-cover') >= 0, '');
rec('遮罩脚本带 drop 句柄', BOOT_COVER_SCRIPT.indexOf('__dshiwBootCover') >= 0, '');
rec('每次 emit 现取新行（不共享数组）', rows !== bootCoverRows(), '');

// ---- 页面行为 ----
function pageHtml(cacheScript) {
  return '<!doctype html><html><head><meta charset="utf-8">' + cacheScript +
    '<style>' + BOOT_COVER_STYLE + '</style><script>' + BOOT_COVER_SCRIPT + '</script></head>' +
    '<body style="margin:0;background:#123">' +
    '<div id="root"><div class="boot" data-dsh-boot=""><b>HARNESS</b> Loading plugins…</div></div>' +
    '</body></html>';
}
const enabledPage = path.join(here, 'boot-cover-enabled.html');
const disabledPage = path.join(here, 'boot-cover-disabled.html');
fs.writeFileSync(enabledPage, pageHtml('<script>try{localStorage.removeItem("dsh-ink-whale:config")}catch(e){}</script>'));
fs.writeFileSync(disabledPage, pageHtml('<script>try{localStorage.setItem("dsh-ink-whale:config",JSON.stringify({enabled:false}))}catch(e){}</script>'));

const { proc, page: target } = await launch();
const cdp = new CDP(target.webSocketDebuggerUrl);
await cdp.open();
await cdp.send('Page.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

// 页面里「官方 boot 卡换成 AppFrame」的模拟；返回一个 Promise，等遮罩逻辑跑完
const mountScript = `(function(){
  var root = document.getElementById('root');
  root.innerHTML = '<div class="AppFrame" style="height:100vh;background:#eee">' +
    '<aside style="float:left;width:220px;height:100%;background:#ddd">sidebar</aside>' +
    '<main>主界面已经可见</main>' +
    '<div data-shell-overlay></div></div>';
  return new Promise(function (r) { setTimeout(function () {
    var cover = document.getElementById('dshiw-boot-cover');
    var cs = cover ? getComputedStyle(cover) : null;
    r(JSON.stringify({
      cover: !!cover,
      position: cs && cs.position,
      z: cs && cs.zIndex,
      bg: cs && cs.backgroundColor,
      api: !!window.__dshiwBootCover,
      bootGone: !document.querySelector('[data-dsh-boot]')
    }));
  }, 30); });
})()`;

// 1) 开启态：boot 卡在时不遮；换成 AppFrame 后遮住
await cdp.send('Page.navigate', { url: 'file:///' + enabledPage.replace(/\\/g, '/') });
await sleep(400);
const before = await cdp.eval(`JSON.stringify({ cover: !!document.getElementById('dshiw-boot-cover'), api: !!window.__dshiwBootCover, boot: !!document.querySelector('[data-dsh-boot]') })`).then(JSON.parse);
rec('boot 卡还在时不遮', before.cover === false && before.boot === true, JSON.stringify(before));
rec('遮罩句柄已就绪', before.api === true, '');

const afterMount = await cdp.eval(mountScript, true).then(JSON.parse);
rec('AppFrame 出现后立刻盖住', afterMount.cover === true && afterMount.bootGone === true, JSON.stringify(afterMount));
rec('遮罩是 fixed 全屏、层级在开屏之下', afterMount.position === 'fixed' && afterMount.z === '2147482900', 'z=' + afterMount.z);
rec('遮罩底色跟随页面底色（与 boot 卡同色）', afterMount.bg === 'rgb(17, 34, 51)', 'bg=' + afterMount.bg);

await cdp.eval('window.__dshiwBootCover.drop(); window.__dshiwBootCover && window.__dshiwBootCover.drop();');
const afterDrop = await cdp.eval(`JSON.stringify({ cover: !!document.getElementById('dshiw-boot-cover') })`).then(JSON.parse);
rec('drop 后遮罩移除，重复调用不报错', afterDrop.cover === false, JSON.stringify(afterDrop));

// 2) 关闭态：缓存 enabled:false 时完全不起遮罩
await cdp.send('Page.navigate', { url: 'file:///' + disabledPage.replace(/\\/g, '/') });
await sleep(400);
const disabledMount = await cdp.eval(mountScript, true).then(JSON.parse);
rec('缓存 enabled:false 时不遮', disabledMount.cover === false && disabledMount.api === false, JSON.stringify(disabledMount));

cdp.close();
try { proc.kill() } catch (e) { }

const failed = results.filter((r) => !r.ok);
console.log('\n' + (failed.length ? 'FAILED ' + failed.length + ' / ' : 'OK  ') + results.length + ' 项检查');
if (failed.length) { console.log(JSON.stringify(failed, null, 2)); process.exit(1); }
