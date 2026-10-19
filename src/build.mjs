// 构建：把模板 + 数据渲染成两个自包含页面（深色默认 / 浅色默认）
// 用法：node src/build.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const dataDir = path.join(here, 'data')

const A = JSON.parse(fs.readFileSync(path.join(dataDir, 'assets.json'), 'utf8'))
// web-logo.svg 先放鲸鱼 mark（x≈26）再放字标字形
const wordmark = A.wordmarkPaths
  .filter(d => parseFloat(d.slice(1)) > 30)
  .map(d => `<path d="${d}"/>`)
  .join('\n        ')

const template = fs.readFileSync(path.join(here, 'template.html'), 'utf8')
const strokeFonts = fs.readFileSync(path.join(dataDir, 'strokefonts.json'), 'utf8').trim()
const whalePts = JSON.parse(fs.readFileSync(path.join(dataDir, 'whalepoints.json'), 'utf8'))

function build(themeDefault, out) {
  let html = template
    .replace('%%STROKEFONTS%%', strokeFonts)
    .replace('%%WHALE_N%%', String(whalePts.n))
    .replace('%%WHALE_PTS%%', JSON.stringify(whalePts.d))
    .replaceAll('%%WHALE_D%%', A.whalePath)
    .replace('%%WORDMARK%%', wordmark)
    .replaceAll('%%THEME_DEFAULT%%', themeDefault)
  fs.writeFileSync(path.join(root, out), html)
  const left = (html.match(/%%/g) || []).length
  console.log(`wrote ${out}  theme=${themeDefault}  ${(html.length / 1024).toFixed(1)}KB  tokens=${left}`)
}

build('dark', 'index.html')
build('light', 'index-light.html')