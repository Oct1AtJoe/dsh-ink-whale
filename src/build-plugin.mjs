// 构建浏览器半：把数据块 + src/engine.js + src/client.template.js
// 拼成单文件 client.js（window.__ModuleLoader__.load 格式）。
//
// 用法：node src/build-plugin.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const dataDir = path.join(here, 'data');

const fonts = JSON.parse(fs.readFileSync(path.join(dataDir, 'strokefonts.json'), 'utf8'));
const assets = JSON.parse(fs.readFileSync(path.join(dataDir, 'assets.json'), 'utf8'));
const whale = JSON.parse(fs.readFileSync(path.join(dataDir, 'whalepoints.json'), 'utf8'));

// 字标 SVG 里先画鲸鱼 mark（x≈26）再画字形路径；这里只保留字形。
const wordmark = assets.wordmarkPaths.filter((d) => parseFloat(d.slice(1)) > 30);

const dataBlock = [
  '/* 构建期内嵌数据：8 套手写笔画、鲸鱼轮廓点、官方 whale / 字标路径（见 NOTICE.md）。 */',
  'var DSHIW_FONTS = ' + JSON.stringify(fonts) + ';',
  'var DSHIW_WHALE_PATH = ' + JSON.stringify(assets.whalePath) + ';',
  'var DSHIW_WORDMARK_PATHS = ' + JSON.stringify(wordmark) + ';',
  'var DSHIW_WHALE_N = ' + String(whale.n) + ';',
  'var DSHIW_WHALE_PTS = ' + JSON.stringify(whale.d) + ';'
].join('\n');

const engine = fs.readFileSync(path.join(here, 'engine.js'), 'utf8');
const template = fs.readFileSync(path.join(here, 'client.template.js'), 'utf8');

let out = template
  .replace('/* @@DATA@@ */', () => dataBlock)
  .replace('/* @@ENGINE@@ */', () => engine);

if (out.includes('@@DATA@@') || out.includes('@@ENGINE@@')) {
  throw new Error('构建失败：模板占位符没有被替换');
}

const outFile = path.join(root, 'client.js');
fs.writeFileSync(outFile, out);
console.log(
  'wrote client.js  ' +
    (out.length / 1024).toFixed(1) +
    'KB  fonts=' +
    Object.keys(fonts).length +
    '  wordmark=' +
    wordmark.length +
    '  whalePts=' +
    whale.n
);
