// 从 tegaki 的字体包抽出手写笔画数据 → src/data/strokefonts.json
// 只在开发期跑：npm i tegaki 之后
//   node src/tools/mkfontdata.mjs [tegaki 的 fonts 目录]
// 默认找 <项目>/node_modules/tegaki/fonts
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..', '..')
const src = process.argv[2] || path.join(root, 'node_modules', 'tegaki', 'fonts')
if (!fs.existsSync(src)) {
  console.error('找不到 tegaki 字体目录：' + src)
  console.error('用法：node src/tools/mkfontdata.mjs <tegaki/fonts 路径>')
  process.exit(1)
}

const pick = [
  ['caveat', 'Caveat'],
  ['tangerine', 'Tangerine'],
  ['italianno', 'Italianno'],
  ['parisienne', 'Parisienne'],
  ['ems-allure', 'Allure'],
  ['hershey-script', 'Hershey'],
  ['nanum-pen-script', 'Nanum Pen'],
  ['klee-one', 'Klee One']
]
const chars = []
for (let c = 33; c <= 126; c++) chars.push(String.fromCharCode(c))
chars.push('·')

const out = {}
for (const [dir, label] of pick) {
  const gd = JSON.parse(fs.readFileSync(path.join(src, dir, 'glyphData.json'), 'utf8'))
  const upm = +fs.readFileSync(path.join(src, dir, 'bundle.ts'), 'utf8').match(/unitsPerEm:\s*(\d+)/)[1]
  const g = {}
  let n = 0
  for (const c of chars) {
    const glyph = gd[c]
    if (!glyph) continue
    const s = glyph.s.map(st => { const a = []; for (const p of st.p) a.push(Math.round(p[0]), Math.round(p[1]), Math.round(p[2])); return a })
    g[c] = { w: Math.round(glyph.w), s }
    n++
  }
  out[dir] = { n: label, u: upm, g }
  console.log(`${dir} (${label}): upm=${upm} glyphs=${n} ${(JSON.stringify(out[dir]).length / 1024).toFixed(1)}KB`)
}

const json = JSON.stringify(out)
const dst = path.join(here, '..', 'data', 'strokefonts.json')
fs.writeFileSync(dst, json)
console.log('TOTAL', (json.length / 1024).toFixed(1) + 'KB ->', path.relative(root, dst), 'keys', Object.keys(out).join(','))