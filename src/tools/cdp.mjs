import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9333

export async function launch(userDataDir = path.join(os.tmpdir(), 'dsh-splash-cdp'), opts = {}) {
  const args = [
    '--headless', '--no-first-run', '--no-default-browser-check',
    '--hide-scrollbars', '--disable-extensions', '--window-size=1920,1080',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + userDataDir, 'about:blank'
  ];
  if (!opts.gpu) args.splice(1, 0, '--disable-gpu');
  const proc = spawn(EDGE, args, { stdio: 'ignore' })
  let list = null
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 250))
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/json/list', { signal: AbortSignal.timeout(1500) })
      list = await r.json()
      if (list.length) break
    } catch (e) { }
  }
  if (!list || !list.length) { proc.kill(); throw new Error('no devtools targets') }
  const page = list.find(t => t.type === 'page')
  return { proc, page }
}

export class CDP {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.events = [] }
  async open() {
    this.ws = new WebSocket(this.url)
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej })
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id)
        if (m.error) rej(new Error(JSON.stringify(m.error))); else res(m.result)
      } else if (m.method) this.events.push(m)
    }
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  async eval(expr, awaitPromise = false) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise, returnByValue: true })
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 500))
    return r.result.value
  }
  async shot(file) {
    const r = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'))
    return fs.statSync(file).size
  }
  close() { try { this.ws.close() } catch (e) { } }
}
