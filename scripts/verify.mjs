// 发布前自检：清单、产物、locale、图标、许可文件。
//   node scripts/verify.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const failures = [];
let checks = 0;

function check(label, fn) {
  checks += 1;
  try {
    const value = fn();
    console.log(`PASS  ${label}${value === undefined ? '' : '  ·  ' + value}`);
  } catch (error) {
    failures.push(label + ': ' + (error && error.message ? error.message : String(error)));
    console.log(`FAIL  ${label}  ·  ${error && error.message ? error.message : error}`);
  }
}

function must(condition, message) {
  if (!condition) throw new Error(message);
}

const file = (rel) => path.join(root, rel);
const exists = (rel) => fs.existsSync(file(rel));
const read = (rel) => fs.readFileSync(file(rel), 'utf8');

check('package.json 可解析', () => {
  const pkg = JSON.parse(read('package.json'));
  must(pkg.name === 'dsh-ink-whale', 'name 应为 dsh-ink-whale');
  must(/^\d+\.\d+\.\d+/.test(pkg.version), 'version 不是 semver');
  must(pkg.type === 'module', 'type 应为 module');
  must(pkg.main === 'index.js', 'main 应为 index.js');
  must(pkg.exports && pkg.exports['.'] === './index.js', '缺少 "." 导出');
  must(pkg.exports['./client'] === './client.js', '缺少 "./client" 导出');
  must(pkg.exports['./icon'] === './icon.svg', '缺少 "./icon" 导出');
  must(pkg.dsh && pkg.dsh.bundle && pkg.dsh.bundle.patch === './cordis.patch.yml', '缺少 dsh.bundle.patch');
  must(pkg.dsh.client && pkg.dsh.client.platform === 'web', 'dsh.client.platform 应为 web');
  must(!pkg.private, '发布包不应设 private');
  return `${pkg.name}@${pkg.version}`;
});

check('必需文件存在', () => {
  const required = [
    'index.js',
    'client.js',
    'cordis.patch.yml',
    'locale/en.json',
    'locale/zh.json',
    'icon.svg',
    'LICENSE',
    'NOTICE.md',
    'LICENSES/FONTS-ATTRIBUTION.md',
    'LICENSES/OFL-1.1.txt'
  ];
  const missing = required.filter((rel) => !exists(rel));
  must(missing.length === 0, '缺少 ' + missing.join(', '));
  return required.length + ' 项';
});

check('cordis.patch.yml 条目', () => {
  const patch = read('cordis.patch.yml');
  must(/id:\s*ink-whale/.test(patch), '缺少 id: ink-whale');
  must(/name:\s*dsh-ink-whale/.test(patch), '缺少 name: dsh-ink-whale');
});

check('index.js Host 半', () => {
  const source = read('index.js');
  must(source.includes("@deepseek-ai/schemastery"), '缺少 schemastery 导入');
  must(source.includes('.volatile()'), 'Config 不是 volatile');
  const keys = (source.match(/'caveat'|'tangerine'|'italianno'|'parisienne'|'ems-allure'|'hershey-script'|'nanum-pen-script'|'klee-one'/g) || []).length;
  must(keys >= 8, 'FONT_KEYS 不足 8 套');
  must(source.includes('settings.configure'), '缺少 auto settings 策略');
});

check('client.js 语法', () => {
  execFileSync(process.execPath, ['--check', file('client.js')], { stdio: 'pipe' });
});

check('client.js 产物标记', () => {
  const source = read('client.js');
  must(source.includes("window.__ModuleLoader__.load"), '缺少 ModuleLoader');
  must(source.includes("id: 'dsh-ink-whale'"), '模块 id 不匹配');
  must(source.includes('dshiwCreateSplash'), '缺少开屏引擎');
  must(source.includes('SettingsCard'), '缺少设置页');
  must(source.includes('DSHIW_FONTS'), '缺少字体数据');
  must(source.includes('DSHIW_WHALE_PTS'), '缺少鲸鱼轮廓点');
  must(!source.includes('@@DATA@@') && !source.includes('@@ENGINE@@'), '仍有构建占位符');
  must(source.includes('shell.overlay'), '缺少 shell.overlay 注册');
  must(source.includes('settings.plugins.tab'), '缺少设置页注册');
  return (source.length / 1024).toFixed(1) + 'KB';
});

check('locale 元数据', () => {
  for (const [lang, title] of [['en', 'Ink Whale'], ['zh', '墨鲸']]) {
    const data = JSON.parse(read(`locale/${lang}.json`));
    must(data.meta && data.meta.title && data.meta.title.includes(title), `${lang} meta.title 不正确`);
    must(data.meta.description && data.meta.description.length > 20, `${lang} meta.description 过短`);
  }
});

check('icon.svg', () => {
  const size = fs.statSync(file('icon.svg')).size;
  must(size <= 256 * 1024, 'icon 超过 256KiB');
  must(read('icon.svg').trim().startsWith('<svg'), 'icon 不是 SVG');
  return size + 'B';
});

check('package files 覆盖运行时文件', () => {
  const pkg = JSON.parse(read('package.json'));
  const files = pkg.files || [];
  const wanted = ['index.js', 'client.js', 'cordis.patch.yml', 'locale/*.json', 'icon.svg', 'LICENSES'];
  const missing = wanted.filter((entry) => !files.includes(entry));
  must(missing.length === 0, 'pack 清单缺少 ' + missing.join(', '));
});

console.log('');
if (failures.length > 0) {
  console.log(`FAILED  ${failures.length}/${checks} 项未通过`);
  process.exit(1);
}
console.log(`OK  ${checks} 项全部通过`);
