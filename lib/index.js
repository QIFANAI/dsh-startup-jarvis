/* ============================================================================
 * dsh-startup-jarvis — Host 半侧（v0.2，按 DSH 0.2.2 的 connection.fetch 路由契约）
 * 1) connection.fetch.register 提供 /dsh-jarvis/* 资源（Fetch 风格，支持 Range）
 * 2) webServer.tapIndex 往 index.html 注入 css + 配置 + splash.js
 * 3) 配置原子写入 ~/.dsh/dsh-startup-jarvis.json
 * 任何异常都只降级为“不播动画”，绝不抛出到宿主启动流程。
 * ========================================================================== */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const CONFIG_FILE = path.join(DSH_HOME, 'dsh-startup-jarvis.json')
const ASSET_ROOT = path.join(PACKAGE_ROOT, 'lib', 'assets')

const NS = 'dsh-startup-jarvis'
const ROUTE_BASE = '/api/dsh-jarvis'

const PLUGIN_VERSION = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'))
    return String(pkg.version || '').trim() || '0.0.0'
  } catch (err) { return '0.0.0' }
})()

const DEFAULTS = {
  enabled: true,
  mode: 'session',
  allowSkip: true,
  reducedMotion: false,
  sound: true,
  volume: 65,
  handoffAt: 30.2,
  videoFile: 'jarvis-boot.mp4',
  theme: { enabled: true, accent: '#e9a13b', scanlines: true, intensity: 55 },
  skin: {
    enabled: true,
    preset: 'mark7',
    level: 'glass',
    background: 'hud',
    bgOpacity: 86,
    brightness: 70,
    motion: 'full',
    accent: '#ffc46b',
    grain: 28,
    scanlines: 35,
    parallax: true,
    focusDim: true,
    hudCorners: true,
    lightMode: 'porcelain'
  }
}
const BOOL_KEYS = ['enabled', 'allowSkip', 'reducedMotion', 'sound']
const ACCENTS = ['#e9a13b', '#39c8d8', '#d8554a', '#8f7bff']
const ENUMS = { mode: ['session', 'daily', 'always'] }
const NUMBERS = { volume: { min: 0, max: 100 }, handoffAt: { min: 5, max: 60 } }

function normalizeTheme(input) {
  const d = DEFAULTS.theme
  const src = input && typeof input === 'object' ? input : {}
  const accent = typeof src.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(src.accent) ? src.accent : d.accent
  const intensity = Number.isFinite(Number(src.intensity)) ? Math.max(0, Math.min(100, Number(src.intensity))) : d.intensity
  return { enabled: src.enabled !== false, accent, scanlines: src.scanlines !== false, intensity }
}
function normalizeSkin(input) {
  const d = DEFAULTS.skin
  const src = input && typeof input === 'object' ? input : {}
  const pick = (v, list, fallback) => list.includes(v) ? v : fallback
  const num = (v, min, max, fallback) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback
  }
  return {
    enabled: src.enabled !== false,
    preset: pick(src.preset, ['mark7', 'hud', 'noir'], d.preset),
    level: pick(src.level, ['accent', 'full', 'glass'], d.level),
    background: pick(src.background, ['hud', 'ambient', 'poster', 'off'], d.background),
    bgOpacity: num(src.bgOpacity, 0, 100, d.bgOpacity),
    brightness: num(src.brightness, 20, 160, d.brightness),
    motion: pick(src.motion, ['full', 'reduced', 'off'], d.motion),
    accent: typeof src.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(src.accent) ? src.accent : d.accent,
    grain: num(src.grain, 0, 100, d.grain),
    scanlines: num(src.scanlines, 0, 100, d.scanlines),
    parallax: src.parallax !== false,
    focusDim: src.focusDim !== false,
    hudCorners: src.hudCorners !== false,
    lightMode: pick(src.lightMode, ['porcelain', 'off'], d.lightMode)
  }
}
function normalize(input) {
  const out = { ...DEFAULTS }
  const src = input && typeof input === 'object' ? input : {}
  out.theme = normalizeTheme(src.theme)
  out.skin = normalizeSkin(src.skin)
  for (const key of Object.keys(DEFAULTS)) {
    if (key === 'theme' || key === 'skin') continue
    if (!Object.prototype.hasOwnProperty.call(src, key) || src[key] === undefined || src[key] === null) continue
    const value = src[key]
    if (BOOL_KEYS.includes(key)) out[key] = value === true || value === 'true' || value === 1 || value === '1'
    else if (ENUMS[key]) out[key] = ENUMS[key].includes(value) ? value : DEFAULTS[key]
    else if (NUMBERS[key]) {
      const r = NUMBERS[key]; const n = Number(value)
      out[key] = Number.isFinite(n) ? Math.max(r.min, Math.min(r.max, n)) : DEFAULTS[key]
    } else if (typeof value === 'string') out[key] = value
  }
  return out
}
function readConfig() {
  try { return normalize(JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))) } catch (err) { return { ...DEFAULTS } }
}
function writeConfig(next) {
  const cfg = normalize(next)
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true })
  const tmp = CONFIG_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n', 'utf8')
  fs.renameSync(tmp, CONFIG_FILE)
  return cfg
}
function readJsonSafe(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch (err) { return null } }

function collectFacts() {
  const facts = { ready: false, profile: process.env.DSH_PROFILE || 'desktop', platform: process.platform, pluginVersion: PLUGIN_VERSION }
  try {
    const profilePkg = readJsonSafe(path.join(DSH_HOME, 'profiles', facts.profile, 'package.json'))
    const bundles = profilePkg && profilePkg.dsh && profilePkg.dsh.profile && profilePkg.dsh.profile.bundles
    facts.bundles = Array.isArray(bundles) ? bundles.length : 6
  } catch (err) { facts.bundles = 6 }
  try {
    facts.skills = fs.readdirSync(path.join(DSH_HOME, 'skills'), { withFileTypes: true }).filter((d) => d.isDirectory()).length
  } catch (err) { facts.skills = 17 }
  try {
    const patch = fs.readFileSync(path.join(DSH_HOME, 'profiles', facts.profile, 'cordis.patch.yml'), 'utf8')
    const m = patch.match(/provider:\s*([\w.-]+)[\s\S]{0,120}?model:\s*([\w.-]+)/)
    facts.model = m ? m[2] : 'deepseek-flash'
  } catch (err) { facts.model = 'deepseek-flash' }
  facts.ready = true
  return facts
}

const MIME = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8'
}

function fileResponse(file, type, request) {
  let stat
  try { stat = fs.statSync(file); if (!stat.isFile()) return new Response(null, { status: 404 }) }
  catch (err) { return new Response(null, { status: 404 }) }
  const size = stat.size
  const rangeHeader = request && request.headers ? request.headers.get('range') : null
  const headers = { 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': 'public, max-age=86400' }
  if (rangeHeader) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader).trim())
    if (!m) return new Response(null, { status: 416, headers: { ...headers, 'content-range': 'bytes */' + size } })
    let start = m[1] === '' ? null : Number(m[1])
    let end = m[2] === '' ? null : Number(m[2])
    if (start === null && end === null) return new Response(null, { status: 416, headers: { ...headers, 'content-range': 'bytes */' + size } })
    if (start === null) { start = Math.max(0, size - end); end = size - 1 }
    else if (end === null || end >= size) end = size - 1
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start < 0) {
      return new Response(null, { status: 416, headers: { ...headers, 'content-range': 'bytes */' + size } })
    }
    const bytes = fs.readFileSync(file).subarray(start, end + 1)
    return new Response(bytes, { status: 206, headers: { ...headers, 'content-range': 'bytes ' + start + '-' + end + '/' + size, 'content-length': String(bytes.length) } })
  }
  const bytes = fs.readFileSync(file)
  return new Response(request && request.method === 'HEAD' ? null : bytes, { status: 200, headers: { ...headers, 'content-length': String(size) } })
}
const LOG_FILE = path.join(DSH_HOME, 'dsh-startup-jarvis.log')
function logLine(msg) {
  try {
    const line = new Date().toISOString() + ' ' + msg + '\n'
    fs.appendFileSync(LOG_FILE, line, 'utf8')
  } catch (err) { /* noop */ }
}
function readText(rel) {
  try { return fs.readFileSync(path.join(PACKAGE_ROOT, rel), 'utf8') } catch (err) { return '' }
}
function textResponse(text, type, code = 200) {
  return new Response(text, { status: code, headers: { 'content-type': type, 'cache-control': 'no-store' } })
}

const name = NS
const inject = ['webServer', 'connection']

function apply(ctx) {
  try { mount(ctx) } catch (err) {
    try { console.warn('[dsh-startup-jarvis] mount failed, splash disabled: ' + ((err && err.message) || err)) } catch (e) { /* noop */ }
  }
}

function mount(ctx) {
  const get = (k) => { try { return typeof ctx.get === 'function' ? ctx.get(k) : undefined } catch (err) { return undefined } }
  const webServer = get('webServer')
  const connection = get('connection')
  const facts = collectFacts()
  const disposers = []

  logLine('mount start version=' + PLUGIN_VERSION + ' dsh_home=' + DSH_HOME + ' profile=' + facts.profile)
  if (!webServer || typeof webServer.tapIndex !== 'function') {
    console.warn('[dsh-startup-jarvis] no webServer.tapIndex; splash disabled')
    return
  }
  const router = webServer

  function handleRequest(request, facts) {
    let pathname
    try { pathname = new URL(request.url).pathname } catch (err) { pathname = '' }
    if (pathname === ROUTE_BASE + '/beacon') {
      let body = ''
      try { const u = new URL(request.url); body = u.searchParams.get('msg') || '' } catch (err) { body = '' }
      logLine('browser beacon ' + String(body).slice(0, 400))
      return new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } })
    }
    // /config 由下面的 exact handler 承接（GET 读 + POST 写；resource 只答 GET/HEAD）
    if (pathname === ROUTE_BASE + '/assets/poster.jpg') return fileResponse(path.join(ASSET_ROOT, 'poster.jpg'), MIME['.jpg'], request)
    if (pathname === ROUTE_BASE + '/assets/jarvis-boot.mp4') return fileResponse(path.join(ASSET_ROOT, readConfig().videoFile || DEFAULTS.videoFile), MIME['.mp4'], request)
    if (pathname === ROUTE_BASE + '/assets/bg-1080.mp4') return fileResponse(path.join(ASSET_ROOT, 'bg-1080.mp4'), MIME['.mp4'], request)
    if (pathname === ROUTE_BASE + '/assets/bg-ambient.mp4') return fileResponse(path.join(ASSET_ROOT, 'bg-ambient.mp4'), MIME['.mp4'], request)
    if (pathname === ROUTE_BASE + '/assets/bg-poster.jpg') return fileResponse(path.join(ASSET_ROOT, 'bg-poster.jpg'), MIME['.jpg'], request)
    if (pathname === ROUTE_BASE + '/assets/bg-poster-blur.jpg') return fileResponse(path.join(ASSET_ROOT, 'bg-poster-blur.jpg'), MIME['.jpg'], request)
    return new Response('not found', { status: 404 })
  }

  /* /api/dsh-jarvis/config —— 必须用 handler route：DSH 的 resource 只答 GET/HEAD，
     POST 会被载体直接 405（这也是旧设置页“保存不了”的根因）。
     · GET/HEAD：读配置（只读，不再支持 ?patch= 写入 —— 那个口子可被跨站 GET 改写配置）
     · POST：application/json，一次写启动项 + skin；action=reset 恢复默认
     安全边界：POST 只接受 application/json（跨站表单无法触发；跨域 JSON 需预检，本路由不答 CORS 预检）。 */
  function sendJson(res, payload, code = 200, extra = {}, head = false) {
    let body = ''
    try { body = JSON.stringify(payload) } catch (err) { body = '{"ok":false,"error":"serialize failed"}'; code = 500 }
    const headers = {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': String(Buffer.byteLength(body)),
      ...extra
    }
    res.writeHead(code, headers)
    res.end(head ? undefined : body)
  }
  async function configHandler(req, res) {
    const method = String(req.method || 'GET').toUpperCase()
    const isHead = method === 'HEAD'
    const current = readConfig()
    const payloadBase = { ok: true, version: PLUGIN_VERSION, defaults: DEFAULTS, facts, file: CONFIG_FILE }
    try {
      if (method === 'GET' || isHead) {
        sendJson(res, { ...payloadBase, config: current }, 200, {}, isHead)
        return
      }
      if (method !== 'POST') {
        sendJson(res, { ok: false, error: 'method not allowed' }, 405, { allow: 'GET, HEAD, POST' })
        return
      }
      const ctype = String(req.headers['content-type'] || '').toLowerCase()
      if (ctype.indexOf('application/json') < 0) {
        sendJson(res, { ok: false, error: 'content-type must be application/json' }, 415)
        return
      }
      let raw = ''
      let size = 0
      for await (const chunk of req) {
        size += chunk.length
        if (size > 64 * 1024) { sendJson(res, { ok: false, error: 'body too large' }, 413); return }
        raw += chunk
      }
      let body = {}
      try { body = raw ? JSON.parse(raw) : {} } catch (err) { sendJson(res, { ok: false, error: 'invalid json' }, 400); return }
      if (body && body.action === 'reset') {
        const cfg = writeConfig(DEFAULTS)
        logLine('config reset via POST')
        sendJson(res, { ...payloadBase, config: cfg })
        return
      }
      const next = Object.assign({}, current, body && typeof body === 'object' ? body : {})
      if (body && body.skin && typeof body.skin === 'object') next.skin = Object.assign({}, current.skin, body.skin)
      const cfg = writeConfig(next)
      logLine('config patched via POST skin=' + JSON.stringify(cfg.skin))
      sendJson(res, { ...payloadBase, config: cfg })
    } catch (err) {
      logLine('config handler failed ' + ((err && err.message) || err))
      try { sendJson(res, { ok: false, error: 'internal error' }, 500) } catch (e2) { /* noop */ }
    }
  }

  // /config 用 exact handler（读+写）；其余资源走 prefix resource（GET/HEAD）
  disposers.push(webServer.register({
    kind: 'exact',
    path: ROUTE_BASE + '/config',
    handler: (req, res) => configHandler(req, res)
  }))
  disposers.push(webServer.register({
    kind: 'prefix',
    path: ROUTE_BASE,
    resource: (request) => handleRequest(request, facts)
  }))

  logLine('registering tapIndex; routeBase=' + ROUTE_BASE)
  disposers.push(webServer.tapIndex((html) => {
    logLine('tapIndex invoked htmlLen=' + (typeof html === 'string' ? html.length : -1) + ' already=' + (typeof html === 'string' && html.includes('dsh-jarvis-inline')))
    if (typeof html !== 'string' || html.includes('dsh-jarvis-inline')) return html
    const cfg = { ...readConfig(), facts, base: ROUTE_BASE, version: PLUGIN_VERSION }
    const head =
      '<style id="dsh-jarvis-critical">' + readText('lib/splash.css') + readText('lib/skin.css') +
      'html{background:#030405}html.dj-booting #root{visibility:hidden}</style>' +
      '<script>document.documentElement.classList.add("dj-booting")</script>'
    const body =
      '<script id="dsh-jarvis-config" type="application/json">' + JSON.stringify(cfg).replace(/</g, '\\u003c') + '</script>' +
      '<script id="dsh-jarvis-skin">' + readText('lib/skin.js').replace(/<\/script/gi, '<\\/script') + '</script>' +
      '<script id="dsh-jarvis-inline">' + readText('lib/splash.js').replace(/<\/script/gi, '<\\/script') + '</script>'
    if (html.includes('</head>')) html = html.replace('</head>', head + '</head>')
    else html = head + html
    if (html.includes('</body>')) html = html.replace('</body>', body + '</body>')
    else html = html + body
    return html
  }))

  // 桌面端 index 由 boot payload 组装：走结构化注入行（tap 不会被执行）
  try {
    ctx.on('webserver/index-inject', (table) => {
      try {
        // 每次请求重新读盘：开发期改 skin.css / skin.js 不需重启宿主
        const cfgRow = { ...readConfig(), facts, base: ROUTE_BASE, version: PLUGIN_VERSION }
        const cssText = readText('lib/splash.css')
        const jsText = readText('lib/splash.js')
        const skinCssText = readText('lib/skin.css')
        const skinJsText = readText('lib/skin.js')
        const scriptText = 'window.__DSH_JARVIS_CSS__=' + JSON.stringify(cssText) + ';' +
          'window.__DSH_JARVIS_SKIN_CSS__=' + JSON.stringify(skinCssText) + ';' +
          'window.__DSH_JARVIS_CFG__=' + JSON.stringify(cfgRow).replace(/</g, '\\u003c') + ';' +
          skinJsText.replace(/<\/script/gi, '<\\/script') + ';' +
          jsText.replace(/<\/script/gi, '<\\/script')
        table.push({ kind: 'script', placement: 'body', text: scriptText })
        logLine('index-inject row pushed (boot payload path)')
      } catch (err) { logLine('index-inject push failed ' + ((err && err.message) || err)) }
    })
    logLine('index-inject listener registered')
  } catch (err) { logLine('index-inject hook failed ' + ((err && err.message) || err)) }

  logLine('mount done: route+tap registered')
  if (typeof ctx.effect === 'function') {
    ctx.effect(() => () => {
      for (const dispose of disposers) { try { if (typeof dispose === 'function') dispose() } catch (err) { /* noop */ } }
    })
  }
  try { ctx.logger?.info?.('[' + NS + '] v' + PLUGIN_VERSION + ' mounted at ' + ROUTE_BASE) } catch (err) { /* noop */ }
}

export { apply, inject, name }
