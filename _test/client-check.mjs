// 开发期浏览器半自检：用真实 React 渲染 client.js 注册的设置页和开屏组件，
// 配一个最小的 Cordis ctx / configForms / slots 桩，验证：
//   - client.js 工厂能加载、apply 能注册两个 slot；
//   - 设置页能渲染、点击字体/深浅/输入框会写回 Host form；
//   - 内嵌预览和启动开屏都能挂载并真实绘制。
// 截图写在 _test/shots（已 gitignore）。不属于发布产物。
//   node _test/client-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, CDP } from '../src/tools/cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const shots = path.join(here, 'shots');
fs.mkdirSync(shots, { recursive: true });

const react = fs.readFileSync(path.join(root, 'node_modules/react/umd/react.development.js'), 'utf8');
const reactDom = fs.readFileSync(path.join(root, 'node_modules/react-dom/umd/react-dom.development.js'), 'utf8');
const client = fs.readFileSync(path.join(root, 'client.js'), 'utf8');

const harness = `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;background:#151517;color:#e8e8ea;font-family:"Segoe UI","Microsoft YaHei",sans-serif}
  #settings{padding:18px;max-width:760px}
  #boot{position:fixed;inset:0}
</style>
<div id="settings"></div>
<div id="boot"></div>
<script>${react}</script>
<script>${reactDom}</script>
<script>
window.__report = { steps: [], writes: [], errors: [], done: false };
window.addEventListener('error', function (e) { __report.errors.push(String(e.message)); });
window.__ModuleLoader__ = { load: function (mod) { window.__clientMod = mod; } };
</script>
<script>${client}</script>
<script>
(function () {
  'use strict';
  var report = window.__report;
  function step(name, ok, detail) { report.steps.push({ name: name, ok: !!ok, detail: detail }); }
  window.onerror = function (message, src, line) { report.errors.push(String(message) + ' @' + line); };

  try {
    var mod = window.__clientMod.factory(function (id) {
      if (id === 'react') return window.React;
      throw new Error('unexpected require: ' + id);
    });
    step('factory loads', typeof mod.apply === 'function');

    var state = {
      enabled: true, font: 'caveat', name: 'Deepseek',
      greeting: 'Welcome to {name}', caption: '探索未至之境', theme: 'auto'
    };
    var registered = [];
    var formSubs = new Set();
    var form = {
      getSnapshot: function () { return { value: Object.assign({}, state), revision: 1, writable: true }; },
      subscribe: function (fn) { formSubs.add(fn); return function () { formSubs.delete(fn); }; },
      set: function (field, value) {
        state[field] = value;
        report.writes.push([field, value]);
        formSubs.forEach(function (fn) { fn(); });
        return Promise.resolve(true);
      }
    };
    var describe = {
      getSnapshot: function () {
        return { status: 'ready', view: { namespaces: [{ ns: 'include:ink-whale', value: Object.assign({}, state) }] } };
      },
      subscribe: function () { return function () {}; },
      ensure: function () { return Promise.resolve(); }
    };
    var configForms = {
      get: function () { return form; },
      describe: function () { return describe; }
    };
    var slots = {
      inject: function (key, cb) { cb(); return function () {}; },
      register: function (options, component) {
        registered.push({ options: options, component: component });
        return function () {};
      }
    };
    var theme = {
      getTheme: function () { return { active: { colorScheme: 'dark' } }; }
    };

    var ctx = {
      effect: function (fn) { fn(); return function () {}; },
      inject: function (deps, cb) {
        var child = { effect: ctx.effect, on: function () { return function () {}; } };
        if (deps.indexOf('configForms') >= 0) child.configForms = configForms;
        if (deps.indexOf('slots') >= 0) child.slots = slots;
        if (deps.indexOf('theme') >= 0) child.theme = theme;
        cb(child);
      }
    };

    mod.apply(ctx);
    step('registers 2 slots', registered.length === 2, registered.map(function (r) { return r.options.name; }));
    step('registers overlay', registered.some(function (r) { return r.options.name === 'shell.overlay'; }));
    step('registers settings tab', registered.some(function (r) { return r.options.name === 'settings.plugins.tab'; }));

    var settingsComp = registered.filter(function (r) { return r.options.name === 'settings.plugins.tab'; })[0].component;
    var bootComp = registered.filter(function (r) { return r.options.name === 'shell.overlay'; })[0].component;

    var settingsRoot = ReactDOM.createRoot(document.getElementById('settings'));
    settingsRoot.render(React.createElement(settingsComp));

    setTimeout(function () {
      var text = document.getElementById('settings').innerText;
      step('settings renders', text.indexOf('文字内容') >= 0 && text.indexOf('字体样式') >= 0, text.slice(0, 40));
      step('host source bound', text.indexOf('DSH 设置') >= 0);
      report.defaultReady = true;

      setTimeout(function () {

      function clickText(label, selector) {
        var nodes = Array.prototype.slice.call(document.querySelectorAll(selector || 'button'));
        var target = nodes.filter(function (n) { return (n.innerText || '').indexOf(label) >= 0; })[0];
        if (target) target.click();
        return !!target;
      }

      step('font chip exists', !!document.querySelector('.dshiw-chip'));
      var tangerine = Array.prototype.slice.call(document.querySelectorAll('.dshiw-chip')).filter(function (b) {
        return b.getAttribute('title') === 'Tangerine';
      })[0];
      if (tangerine) tangerine.click();
      step('font write', report.writes.some(function (w) { return w[0] === 'font' && w[1] === 'tangerine'; }));

      clickText('深色', '.dshiw-set__segBtn');
      step('theme write', report.writes.some(function (w) { return w[0] === 'theme' && w[1] === 'dark'; }));

      var labels = Array.prototype.slice.call(document.querySelectorAll('.dshiw-set__field'));
      var nameLabel = labels.filter(function (l) { return (l.innerText || '').indexOf('称呼') === 0; })[0];
      if (nameLabel) {
        var input = nameLabel.querySelector('input');
        var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, '小鲸');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }

      setTimeout(function () {
        step('text write', report.writes.some(function (w) { return w[0] === 'name' && w[1] === '小鲸'; }));

        var play = Array.prototype.slice.call(document.querySelectorAll('button')).filter(function (b) {
          return (b.innerText || '').indexOf('播放预览') >= 0;
        })[0];
        step('play button exists', !!play);

        /* 底部 Star 入口：外链要指向仓库，且带 target/rel 不接管当前页 */
        var star = document.querySelector('a.dshiw-star');
        step('star link exists', !!star, star ? star.getAttribute('href') : 'missing');
        step('star link points to repo', !!star && star.getAttribute('href') === 'https://github.com/w-j-y-wjy/dsh-ink-whale');
        step('star link opens in new tab', !!star && star.getAttribute('target') === '_blank' &&
          /noopener/.test(star.getAttribute('rel') || ''));
        var starGlyph = star ? star.querySelector('.dshiw-star__glyph') : null;
        step('star glyph is a star', !!starGlyph && (starGlyph.textContent || '').indexOf('★') >= 0,
          starGlyph ? starGlyph.textContent : 'missing');

        if (play) play.click();

        setTimeout(function () {
          var inline = document.querySelector('.dshiw-root--inline');
          step('inline preview mounted', !!inline);
          var canvas = inline ? inline.querySelector('canvas') : null;
          var inkPixels = 0;
          if (canvas) {
            var data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
            for (var i = 0; i < data.length; i += 4 * 7) if (data[i] + data[i + 1] + data[i + 2] > 24) inkPixels++;
          }
          step('inline preview draws ink', inkPixels > 200, inkPixels + ' px');

          window.__mountBoot = function () {
            var bootRoot = ReactDOM.createRoot(document.getElementById('boot'));
            bootRoot.render(React.createElement(bootComp));
            setTimeout(function () {
              var full = document.querySelector('#boot .dshiw-root');
              step('boot splash mounted', !!full);
              var fullCanvas = full ? full.querySelector('canvas') : null;
              var fullInk = 0;
              if (fullCanvas) {
                var d2 = fullCanvas.getContext('2d').getImageData(0, 0, fullCanvas.width, fullCanvas.height).data;
                for (var j = 0; j < d2.length; j += 4 * 11) if (d2[j] + d2[j + 1] + d2[j + 2] > 24) fullInk++;
              }
              step('boot splash draws ink', fullInk > 200, fullInk + ' px');
              report.done = true;
            }, 2600);
          };
          report.settingsReady = true;
        }, 2400);
      }, 900);
      }, 1200);
    }, 400);
  } catch (error) {
    report.errors.push(String(error && error.stack ? error.stack : error));
    report.done = true;
  }
})();
</script>`;

const harnessFile = path.join(here, 'client-harness.html');
fs.writeFileSync(harnessFile, harness);

const { proc, page } = await launch(path.join(here, 'profile-client'));
const c = new CDP(page.webSocketDebuggerUrl);
await c.open();
await c.send('Page.enable');
await c.send('Runtime.enable');
await c.send('Emulation.setDeviceMetricsOverride', { width: 820, height: 1500, deviceScaleFactor: 1, mobile: false });
await c.send('Page.navigate', { url: pathToFileURL(harnessFile).href });

let report = null;
let defaultReady = false;
for (let i = 0; i < 80; i++) {
  await new Promise((r) => setTimeout(r, 120));
  try {
    defaultReady = await c.eval('!!(window.__report && window.__report.defaultReady)');
    if (defaultReady) break;
  } catch (e) { /* page still loading */ }
}

if (defaultReady) {
  await c.shot(path.join(shots, 'client-settings.png'));
}

let settingsReady = false;
for (let i = 0; i < 80; i++) {
  await new Promise((r) => setTimeout(r, 200));
  try {
    settingsReady = await c.eval('!!(window.__report && window.__report.settingsReady)');
    if (settingsReady) break;
  } catch (e) { /* page still loading */ }
}

if (settingsReady) {
  await c.send('Emulation.clearDeviceMetricsOverride');
  await c.eval('window.__mountBoot && window.__mountBoot()');
}

for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 200));
  try {
    const done = await c.eval('!!(window.__report && window.__report.done)');
    if (done) {
      report = JSON.parse(await c.eval('JSON.stringify(window.__report)'));
      break;
    }
  } catch (e) { /* page still loading */ }
}

if (!report) {
  console.log('TIMEOUT waiting for report');
  try { console.log(await c.eval('JSON.stringify(window.__report)')); } catch (e) { /* ignore */ }
} else {
  for (const item of report.steps) console.log((item.ok ? 'PASS  ' : 'FAIL  ') + item.name + (item.detail === undefined ? '' : '  ·  ' + item.detail));
  if (report.writes.length) console.log('writes:', JSON.stringify(report.writes));
  if (report.errors.length) console.log('errors:', report.errors.join('\n'));
}

await new Promise((r) => setTimeout(r, 1200));
await c.shot(path.join(shots, 'client-splash.png'));

c.close();
proc.kill();
