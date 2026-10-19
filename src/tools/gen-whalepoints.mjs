// 开发期：把官方鲸鱼路径按弧长采样成 1500 个点 → src/data/whalepoints.json
// （页面运行时不再调用 getPointAtLength，省掉约 1.5s 的构建卡顿）
//   node src/tools/gen-whalepoints.mjs
// 依赖本机 Chrome/Edge（走 ./cdp.mjs），临时文件写在系统临时目录
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { launch, CDP } from './cdp.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..', '..')
const dataDir = path.join(here, '..', 'data')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'whalepoints-'))

const A = JSON.parse(fs.readFileSync(path.join(dataDir, 'assets.json'), 'utf8'))
const refHtml = path.join(tmp, 'whaleref.html')
fs.writeFileSync(refHtml,
  `<!doctype html><meta charset="utf-8"><body><svg width="0" height="0"><path id="p" d="${A.whalePath}"/></svg></body>`)

const { proc, page } = await launch(path.join(tmp, 'profile'))
const c = new CDP(page.webSocketDebuggerUrl)
await c.open(); await c.send('Page.enable'); await c.send('Runtime.enable')
await c.send('Page.navigate', { url: pathToFileURL(refHtml).href })
await new Promise(r => setTimeout(r, 400))

const N = 1500
const out = await c.eval(`(function(){var p=document.getElementById('p');var L=p.getTotalLength();var a=new Array(${N}*2);
for(var i=0;i<${N};i++){var q=p.getPointAtLength(i/${N}*L);a[i*2]=Math.round(q.x*1000)/1000;a[i*2+1]=Math.round(q.y*1000)/1000;}return JSON.stringify(a);})()`)
const arr = JSON.parse(out)
const json = JSON.stringify({ n: N, d: arr })
const dst = path.join(dataDir, 'whalepoints.json')
fs.writeFileSync(dst, json)
console.log('wrote', path.relative(root, dst), (json.length / 1024).toFixed(1) + 'KB points=', arr.length / 2)
c.close(); proc.kill()
fs.rmSync(tmp, { recursive: true, force: true })