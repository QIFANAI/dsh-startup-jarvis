// 零依赖冒烟：用假宿主编排 apply()，验证路由、首屏注入、配置读写与 Range。
// 运行：node test/smoke-host.mjs
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Writable } from 'node:stream'

const home = await mkdtemp(path.join(tmpdir(), 'dsh-jarvis-smoke-'))
process.env.DSH_HOME = home
process.env.DSH_PROFILE = 'desktop'

try {
  const { apply, name, inject } = await import('../lib/index.js')
  assert.equal(name, 'dsh-startup-jarvis', 'plugin name')
  assert.deepEqual(inject, ['webServer', 'connection'], 'inject list')

  const routes = []
  let tap = null
  const listeners = new Map()
  const fakeServer = {
    register(route) { routes.push(route); return () => {} },
    tapIndex(fn) { tap = fn; return () => {} }
  }
  const ctx = {
    get: (k) => (k === 'webServer' ? fakeServer : k === 'connection' ? {} : undefined),
    on: (ev, fn) => { const arr = listeners.get(ev) || []; arr.push(fn); listeners.set(ev, arr) },
    effect: (fn) => fn(),
    logger: { info: () => {}, warn: () => {} }
  }
  apply(ctx)

  // 1) 路由
  assert.equal(routes.length, 2, 'two routes registered')
  const exact = routes.find((r) => r.kind === 'exact')
  const prefix = routes.find((r) => r.kind === 'prefix')
  assert.equal(exact.path, '/api/dsh-jarvis/config')
  assert.equal(prefix.path, '/api/dsh-jarvis')

  // 2) 首屏注入
  const injected = tap('<html><head><title>t</title></head><body><div id="app"></div></body></html>')
  assert.ok(injected.includes('id="dsh-jarvis-inline"'), 'splash script injected')
  assert.ok(injected.includes('id="dsh-jarvis-skin"'), 'skin script injected')
  assert.ok(injected.includes('id="dsh-jarvis-config"'), 'config injected')
  const cfgJson = JSON.parse(injected.match(/<script id="dsh-jarvis-config" type="application\/json">([\s\S]*?)<\/script>/)[1])
  assert.equal(cfgJson.version, '0.3.9', 'injected version')
  assert.equal(cfgJson.base, '/api/dsh-jarvis')
  assert.equal(cfgJson.skin.level, 'glass', 'default skin level')
  assert.equal(cfgJson.handoffAt, 30.2, 'default handoff')
  assert.equal(cfgJson.facts.ready, true)
  assert.ok(injected.includes('html.dj-booting #root'), 'critical css injected')

  // 3) 桌面 boot payload 注入行
  const rows = []
  for (const fn of listeners.get('webserver/index-inject') || []) fn(rows)
  assert.equal(rows.length, 1, 'one boot row')
  assert.equal(rows[0].kind, 'script')
  assert.ok(rows[0].text.includes('__DSH_JARVIS_CFG__'), 'boot config variable')
  assert.ok(rows[0].text.includes('__DSH_JARVIS_SKIN_CSS__'), 'boot skin css variable')

  // 4) 配置读写（exact handler）
  function makeRes() {
    const chunks = []
    const res = new Writable({ write(chunk, enc, cb) { chunks.push(Buffer.from(chunk)); cb() } })
    res.code = 0
    res.headers = {}
    res.writeHead = (code, headers) => { res.code = code; res.headers = headers || {}; return res }
    res.body = () => Buffer.concat(chunks).toString('utf8')
    res.json = () => JSON.parse(res.body())
    return res
  }
  async function callConfig(method, body, headers = {}) {
    const req = {
      method,
      url: '/api/dsh-jarvis/config',
      headers,
      async *[Symbol.asyncIterator]() { if (body) yield Buffer.from(body) }
    }
    const res = makeRes()
    const done = new Promise((resolve) => res.on('finish', resolve))
    await exact.handler(req, res)
    if (!res.writableEnded) res.end()
    await done
    return res
  }

  const got = await callConfig('GET')
  assert.equal(got.code, 200)
  assert.equal(got.json().config.skin.preset, 'mark7')

  const post = await callConfig('POST', JSON.stringify({ volume: 40, skin: { preset: 'noir' } }), { 'content-type': 'application/json' })
  assert.equal(post.code, 200, 'POST accepted')
  assert.equal(post.json().config.volume, 40)
  assert.equal(post.json().config.skin.preset, 'noir')
  assert.equal(post.json().config.skin.level, 'glass', 'skin deep-merge keeps other keys')
  const onDisk = JSON.parse(await readFile(path.join(home, 'dsh-startup-jarvis.json'), 'utf8'))
  assert.equal(onDisk.skin.preset, 'noir', 'config persisted')

  const reset = await callConfig('POST', JSON.stringify({ action: 'reset' }), { 'content-type': 'application/json' })
  assert.equal(reset.json().config.volume, 65, 'reset restores defaults')

  const wrongType = await callConfig('POST', 'x', { 'content-type': 'text/plain' })
  assert.equal(wrongType.code, 415, 'non-json rejected')
  const badJson = await callConfig('POST', '{oops', { 'content-type': 'application/json' })
  assert.equal(badJson.code, 400, 'invalid json rejected')
  const wrongMethod = await callConfig('DELETE')
  assert.equal(wrongMethod.code, 405, 'unsupported method rejected')

  // 5) 资源路由（prefix resource）：GET / HEAD / Range / 路径穿越
  const base = 'http://localhost/api/dsh-jarvis'
  const poster = await prefix.resource(new Request(base + '/assets/poster.jpg'))
  assert.equal(poster.status, 200)
  assert.equal(poster.headers.get('content-type'), 'image/jpeg')
  assert.equal(poster.headers.get('accept-ranges'), 'bytes')

  const head = await prefix.resource(new Request(base + '/assets/jarvis-boot.mp4', { method: 'HEAD' }))
  assert.equal(head.status, 200)
  assert.equal(head.body, null, 'HEAD has no body')

  const range = await prefix.resource(new Request(base + '/assets/jarvis-boot.mp4', { headers: { range: 'bytes=0-1023' } }))
  assert.equal(range.status, 206)
  assert.equal((await range.arrayBuffer()).byteLength, 1024)
  assert.match(range.headers.get('content-range'), /^bytes 0-1023\/\d+$/)

  const badRange = await prefix.resource(new Request(base + '/assets/jarvis-boot.mp4', { headers: { range: 'bytes=abc' } }))
  assert.equal(badRange.status, 416)

  const traversal = await prefix.resource(new Request(base + '/assets/..%2Fpackage.json'))
  assert.equal(traversal.status, 404, 'path traversal blocked')

  const beacon = await prefix.resource(new Request(base + '/beacon?msg=test'))
  assert.equal(beacon.status, 200)

  console.log('smoke-host: PASS (routes, inject, config, range, traversal)')
} finally {
  await rm(home, { recursive: true, force: true })
}
