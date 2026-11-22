#!/usr/bin/env node
/**
 * render-video.mjs — 把「确定性 canvas 动画页」逐帧截图为 PNG，再用 ffmpeg 编码为 mp4。
 * 无 npm 依赖：只用 Node 内置模块 + 系统 Chrome + 现成 ffmpeg。
 *
 * 页面契约（preview/index.html 提供）：
 *   window.__jarvis = { duration, fps, width, height, ready, seek(t) }
 *   seek(t) 同步绘制，画面是 t 的纯函数；ready 在字体就绪后置 true。
 *
 * 主路径（默认）：Chrome headless + CDP
 *   Remote 调试端口 → /json/list 取 webSocketDebuggerUrl → Node 全局 WebSocket 连 CDP
 *   Page.enable → Emulation 定点尺寸 → Page.navigate → 轮询 ready
 *   → 逐帧 Runtime.evaluate(__jarvis.seek(t)) + 等两次 rAF → Page.captureScreenshot(png)
 * 兜底路径（--fallback）：逐帧新起 Chrome --screenshot（慢 10x+，依赖少，胜在稳）
 *
 * 用法见 tools/README.md 或 node tools/render-video.mjs --help
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const IS_WIN = process.platform === 'win32';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DEFAULT_PAGE = pathToFileURL(path.join(ROOT, 'preview', 'index.html')).href + '?capture=1';
const DEFAULTS = {
  chrome: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ffmpeg: process.env.FFMPEG_PATH || 'E:/douy/_tools/ffmpeg/ffmpeg.exe',
  ffprobe: process.env.FFPROBE_PATH || 'E:/douy/_tools/ffmpeg/ffprobe.exe',
  crf: 16,
  preset: 'slow',
  timeoutSec: 60,
};

/* ---------- 小工具 ---------- */
function log(msg) { process.stderr.write(msg + '\n'); }
function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' +
    p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}
function killTree(child) {
  if (!child || child.killed) return;
  try {
    if (IS_WIN) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else child.kill('SIGKILL');
  } catch { /* ignore */ }
}
function run(cmd, args, options) {
  const opts = options || {};
  const timeoutMs = opts.timeoutMs || 600000;
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; killTree(child); }, timeoutMs);
    child.stdout.on('data', (d) => { if (stdout.length < 2000000) stdout += String(d); });
    child.stderr.on('data', (d) => { if (stderr.length < 2000000) stderr += String(d); });
    child.on('error', (e) => { clearTimeout(timer); resolve({ code: -1, stdout, stderr: stderr + '\n' + e.message, timedOut }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr, timedOut }); });
  });
}
function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(label + ' 超时（' + ms + 'ms）')), ms); }),
  ]);
}
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}
function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/* ---------- 参数 ---------- */
function parseArgs(list) {
  const o = { _: [] };
  const flags = new Set(['fallback', 'clean-frames', 'quiet', 'help']);
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (!a.startsWith('--')) { o._.push(a); continue; }
    const key = a.slice(2);
    if (flags.has(key)) { o[key] = true; continue; }
    const next = list[i + 1];
    if (next === undefined || (next.startsWith('--') && !/^--?\d/.test(next))) throw new Error('参数 ' + a + ' 缺少取值');
    o[key] = next; i++;
  }
  const num = (k) => (o[k] === undefined ? undefined : Number(o[k]));
  o.out = o.out ? path.resolve(o.out) : undefined;
  o.fps = num('fps');
  o.duration = num('duration');
  o.width = num('width');
  o.height = num('height');
  o.limit = num('limit');
  o.crf = num('crf') === undefined ? DEFAULTS.crf : num('crf');
  o.preset = o.preset === undefined ? DEFAULTS.preset : o.preset;
  o.timeout = num('timeout') === undefined ? DEFAULTS.timeoutSec : num('timeout');
  o.url = o.url === undefined ? DEFAULT_PAGE : o.url;
  o.chrome = o.chrome === undefined ? DEFAULTS.chrome : o.chrome;
  o.ffmpeg = o.ffmpeg === undefined ? DEFAULTS.ffmpeg : o.ffmpeg;
  o.ffprobe = o.ffprobe === undefined ? DEFAULTS.ffprobe : o.ffprobe;
  return o;
}
function printUsage() {
  const lines = [
    'render-video.mjs — 确定性 canvas 页 → PNG 帧 → mp4（无 npm 依赖）',
    '',
    '用法：node tools/render-video.mjs [参数]',
    '',
    '  --out <file.mp4>   输出视频路径（默认 out/renders/render-<时间戳>.mp4）',
    '  --fps <n>          帧率（默认取页面 __jarvis.fps，缺省 30）',
    '  --duration <sec>   时长（默认取页面 __jarvis.duration，缺省 10.2）',
    '  --width <px>       宽（默认取页面 __jarvis.width，缺省 1920）',
    '  --height <px>      高（默认取页面 __jarvis.height，缺省 1080）',
    '  --frames-dir <dir> PNG 帧目录（默认 out/frames/<out 文件名>/）',
    '  --url <url>        页面地址（默认 file://.../preview/index.html?capture=1）',
    '  --fallback         走兜底路径：逐帧新起 Chrome --screenshot',
    '  --limit <n>        只渲染前 n 帧（联调自测用）',
    '  --crf <n>          x264 CRF（默认 16）',
    '  --preset <p>       x264 preset（默认 slow）',
    '  --clean-frames     编码成功后删除帧目录',
    '  --quiet            不打印进度',
    '  --timeout <sec>    等页面 ready 的上限（默认 60）',
    '  --chrome/--ffmpeg/--ffprobe <path>  覆盖可执行文件路径',
    '',
    '产出：mp4 + <out>.render.json（帧数/时长/尺寸校验）',
  ];
  console.log(lines.join('\n'));
}

/* ---------- CDP ---------- */
class CDP {
  constructor(ws) {
    this.ws = ws; this.seq = 0; this.pending = new Map(); this.waiters = new Map();
    ws.addEventListener('message', (ev) => this._onMessage(ev.data));
    ws.addEventListener('close', () => {
      for (const p of this.pending.values()) p.reject(new Error('CDP 连接已关闭'));
      this.pending.clear();
    });
  }
  static async connect(url, timeoutMs) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP WebSocket 连接超时')), timeoutMs || 15000);
      ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP WebSocket 连接失败')); }, { once: true });
    });
    return new CDP(ws);
  }
  _onMessage(data) {
    let msg;
    try { msg = JSON.parse(typeof data === 'string' ? data : Buffer.from(data).toString('utf8')); } catch { return; }
    if (typeof msg.id === 'number') {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(p.method + ': ' + msg.error.message));
      else p.resolve(msg.result);
      return;
    }
    if (msg.method) {
      const list = this.waiters.get(msg.method);
      if (list && list.length) list.shift().resolve(msg.params);
    }
  }
  send(method, params) {
    const p = params || {};
    return new Promise((resolve, reject) => {
      const id = ++this.seq;
      this.pending.set(id, { resolve, reject, method });
      try { this.ws.send(JSON.stringify({ id, method, params: p })); }
      catch (e) { this.pending.delete(id); reject(e); }
    });
  }
  once(method, timeoutMs) {
    return new Promise((resolve, reject) => {
      const list = this.waiters.get(method) || [];
      const entry = { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject };
      const timer = setTimeout(() => {
        const arr = this.waiters.get(method) || [];
        const idx = arr.indexOf(entry);
        if (idx >= 0) arr.splice(idx, 1);
        reject(new Error('等待事件 ' + method + ' 超时'));
      }, timeoutMs || 30000);
      list.push(entry);
      this.waiters.set(method, list);
    });
  }
  close() { try { this.ws.close(); } catch { /* ignore */ } }
}

async function evaluate(cdp, expression, options) {
  const opts = options || {};
  const res = await withTimeout(
    cdp.send('Runtime.evaluate', {
      expression, awaitPromise: !!opts.awaitPromise, returnByValue: true, userGesture: true,
    }),
    opts.timeoutMs || 30000, 'Runtime.evaluate');
  if (res.exceptionDetails) {
    const d = res.exceptionDetails.exception && res.exceptionDetails.exception.description;
    throw new Error('页面脚本异常：' + (d || res.exceptionDetails.text));
  }
  return res.result ? res.result.value : undefined;
}

/* ---------- Chrome 生命周期 ---------- */
async function launchChrome(opts, settings) {
  const args = [
    '--headless=new',
    '--hide-scrollbars',
    '--mute-audio',
    '--force-device-scale-factor=1',
    '--window-size=' + opts.width + ',' + opts.height,
    '--window-position=0,0',
    '--remote-debugging-port=' + settings.port,
    '--remote-allow-origins=*',
    '--user-data-dir=' + settings.userDataDir,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--force-color-profile=srgb',
    '--disable-features=Translate,MediaRouter,OptimizationHints,BackForwardCache',
    '--allow-file-access-from-files',
    '--autoplay-policy=no-user-gesture-required',
    ...(settings.extraArgs || []),
    'about:blank',
  ];
  const child = spawn(opts.chrome, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const logTail = [];
  const push = (d) => { logTail.push(String(d)); if (logTail.length > 200) logTail.shift(); };
  child.stdout.on('data', push);
  child.stderr.on('data', push);
  child.on('error', (e) => push('spawn-error: ' + e.message));
  return { child, logTail };
}

async function waitForPageTarget(port, timeoutMs) {
  const t0 = Date.now();
  let lastErr = null;
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/json/list', { signal: AbortSignal.timeout(3000) });
      const list = await res.json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch (e) { lastErr = e; }
    await sleep(150);
  }
  throw new Error('Chrome DevTools 未就绪（端口 ' + port + '）：' + (lastErr ? lastErr.message : '超时'));
}

async function readPageContract(cdp, opts) {
  const expr = '(function(){var j=window.__jarvis;if(!j)return {has:false};' +
    'return {has:true,ready:!!j.ready,duration:j.duration,fps:j.fps,width:j.width,height:j.height,' +
    'fonts:(document.fonts&&document.fonts.status)||"unknown",title:document.title||""};})()';
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < opts.timeout * 1000) {
    last = await evaluate(cdp, expr);
    if (last && last.ready) return last;
    await sleep(100);
  }
  const why = !last || !last.has
    ? '页面未定义 window.__jarvis（地址是否正确？）'
    : 'window.__jarvis 存在但 ready 一直为 false（字体未就绪？）fonts=' + last.fonts;
  throw new Error('等页面 ready 超时：' + why);
}

/* ---------- 主路径：CDP 截图 ---------- */
const RAF_EXPR = 'new Promise(function(res){var done=false;var fin=function(v){if(done)return;done=true;res(v)};' +
  'requestAnimationFrame(function(){requestAnimationFrame(function(){fin("raf")})});' +
  'setTimeout(function(){fin("timeout")},250)})';

async function openPage(opts, settings) {
  const target = await waitForPageTarget(settings.port, 30000);
  const cdp = await CDP.connect(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: opts.width, height: opts.height, deviceScaleFactor: 1, mobile: false,
    screenWidth: opts.width, screenHeight: opts.height,
  });
  const loaded = cdp.once('Page.loadEventFired', 30000).catch(() => null);
  await cdp.send('Page.navigate', { url: opts.url });
  await loaded;
  return cdp;
}

async function renderPrimary(opts, dims, frameCount, framesDir) {
  const userDataDir = await mkdtemp(path.join(opts.tmpRoot, 'chrome-'));
  const port = await freePort();
  const chrome = await launchChrome(opts, { port, userDataDir });
  let cdp = null;
  try {
    cdp = await openPage(opts, { port });
    const contract = await readPageContract(cdp, opts);
    if (dims.width !== contract.width || dims.height !== contract.height) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: dims.width, height: dims.height, deviceScaleFactor: 1, mobile: false,
        screenWidth: dims.width, screenHeight: dims.height,
      });
      await evaluate(cdp, 'Promise.resolve(window.__jarvis.seek(0)).then(function(){return 0;})', { awaitPromise: true, timeoutMs: 30000 });
    }
    const frames = [];
    for (let i = 0; i < frameCount; i++) {
      const t = Math.round((i / opts.fps) * 1e6) / 1e6;
      await evaluate(cdp, '(function(){var j=window.__jarvis;if(!j||typeof j.seek!=="function")throw new Error("__jarvis.seek 缺失");return Promise.resolve(j.seek(' + t + ')).then(function(){return ' + t + ';});})()', { awaitPromise: true, timeoutMs: 30000 });
      await evaluate(cdp, RAF_EXPR, { awaitPromise: true, timeoutMs: 5000 }).catch(() => null);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
      const file = path.join(framesDir, 'f_' + String(i).padStart(4, '0') + '.png');
      await writeFile(file, Buffer.from(shot.data, 'base64'));
      frames.push(file);
      if (!opts.quiet && (i % 15 === 0 || i === frameCount - 1)) {
        process.stderr.write('\r[render] 帧 ' + (i + 1) + '/' + frameCount + '  t=' + t.toFixed(3) + 's');
      }
    }
    if (!opts.quiet) process.stderr.write('\n');
    return { frames, contract, usedChromeLog: chrome.logTail };
  } finally {
    if (cdp) cdp.close();
    if (chrome.child) killTree(chrome.child);
    await sleep(300);
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function renderPrimaryProbe(opts) {
  const userDataDir = await mkdtemp(path.join(opts.tmpRoot, 'chrome-'));
  const port = await freePort();
  const chrome = await launchChrome(opts, { port, userDataDir });
  let cdp = null;
  try {
    cdp = await openPage(opts, { port });
    const c = await readPageContract(cdp, opts);
    return { width: c.width, height: c.height, fps: c.fps, duration: c.duration };
  } finally {
    if (cdp) cdp.close();
    if (chrome.child) killTree(chrome.child);
    await sleep(250);
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
}

/* ---------- 兜底：逐帧新起 Chrome --screenshot ---------- */
function shimHtml(targetUrl, t, phase) {
  return '<!doctype html>\n<meta charset="utf-8">\n<title>SHIM_INIT</title>\n' +
    '<style>html,body{margin:0;padding:0;overflow:hidden;background:#000}' +
    'iframe{border:0;display:block;width:100vw;height:100vh}</style>\n' +
    '<iframe id="f" src="' + targetUrl + '"></iframe>\n' +
    '<script>\n(function(){\n' +
    '  var T = ' + JSON.stringify(t) + ';\n' +
    '  var phase = ' + JSON.stringify(phase) + ';\n' +
    '  var f = document.getElementById("f");\n' +
    '  function title(s){ document.title = s; }\n' +
    '  f.addEventListener("load", function(){\n' +
    '    var w;\n' +
    '    try { w = f.contentWindow; } catch (e) { title("SHIM_FAIL iframe:" + e.message); return; }\n' +
    '    var t0 = Date.now();\n' +
    '    (function poll(){\n' +
    '      if (Date.now() - t0 > 30000) { title("SHIM_FAIL ready-timeout"); return; }\n' +
    '      var j = w.__jarvis;\n' +
    '      if (!j || !j.ready) { setTimeout(poll, 15); return; }\n' +
    '      if (phase === "probe") { title("CONTRACT " + JSON.stringify({width:j.width||0,height:j.height||0,duration:j.duration||0,fps:j.fps||0})); return; }\n' +
    '      try { j.seek(T); } catch (e) { title("SHIM_FAIL seek:" + e.message); return; }\n' +
    '      var raf = w.requestAnimationFrame ? w.requestAnimationFrame.bind(w) : function(cb){ setTimeout(cb, 16); };\n' +
    '      raf(function(){ raf(function(){ setTimeout(function(){ title("SHIM_OK t=" + T); }, 30); }); });\n' +
    '    })();\n' +
    '  });\n' +
    '})();\n</script>\n';
}

async function runShim(opts, userDataDir, cfg) {
  await writeFile(cfg.shimPath, shimHtml(opts.url, cfg.t, cfg.phase), 'utf8');
  const args = [
    '--headless=new', '--hide-scrollbars', '--mute-audio', '--force-device-scale-factor=1',
    '--window-size=' + opts.width + ',' + opts.height,
    '--window-position=0,0',
    '--allow-file-access-from-files',
    '--user-data-dir=' + userDataDir,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--force-color-profile=srgb',
    '--virtual-time-budget=20000',
    '--timeout=45000',
  ];
  if (cfg.dumpDom) args.push('--dump-dom');
  else args.push('--screenshot=' + cfg.outPng);
  args.push(pathToFileURL(cfg.shimPath).href);
  return run(opts.chrome, args, { timeoutMs: 90000 });
}

async function renderFallback(opts, framesDir, explicit) {
  const userDataDir = await mkdtemp(path.join(opts.tmpRoot, 'chrome-fb-'));
  const shimPath = path.join(opts.tmpRoot, 'shim-' + stamp() + '-' + Math.random().toString(36).slice(2, 7) + '.html');
  try {
    let contract = { width: explicit.width, height: explicit.height, duration: explicit.duration, fps: explicit.fps };
    if (explicit.width === undefined || explicit.height === undefined || explicit.duration === undefined || explicit.fps === undefined) {
      const probe = await runShim(opts, userDataDir, { shimPath, phase: 'probe', t: 0, dumpDom: true });
      const m = /CONTRACT (\{[\s\S]*?\})/.exec(probe.stdout || '');
      if (!m) throw new Error('兜底探针失败：未拿到页面契约。Chrome stderr 尾部：' + (probe.stderr || '').split('\n').slice(-4).join(' | '));
      const c = JSON.parse(m[1]);
      contract = {
        width: explicit.width === undefined ? (c.width || 1920) : explicit.width,
        height: explicit.height === undefined ? (c.height || 1080) : explicit.height,
        duration: explicit.duration === undefined ? (c.duration || 10.2) : explicit.duration,
        fps: explicit.fps === undefined ? (c.fps || 30) : explicit.fps,
      };
    }
    opts.width = contract.width; opts.height = contract.height;
    opts.fps = contract.fps; opts.duration = contract.duration;
    const full = Math.max(1, Math.round(contract.duration * contract.fps));
    const frameCount = opts.limit === undefined ? full : Math.min(opts.limit, full);
    const frames = [];
    for (let i = 0; i < frameCount; i++) {
      const t = Math.round((i / contract.fps) * 1e6) / 1e6;
      const file = path.join(framesDir, 'f_' + String(i).padStart(4, '0') + '.png');
      const r = await runShim(opts, userDataDir, { shimPath, phase: 'frame', t, outPng: file });
      if (r.code !== 0) throw new Error('兜底截图第 ' + i + ' 帧失败（exit ' + r.code + '）：' + (r.stderr || '').split('\n').slice(-3).join(' | '));
      await stat(file).catch(() => { throw new Error('兜底截图第 ' + i + ' 帧没有产出文件：' + file); });
      frames.push(file);
      if (!opts.quiet && (i % 15 === 0 || i === frameCount - 1)) {
        process.stderr.write('\r[fallback] 帧 ' + (i + 1) + '/' + frameCount + '  t=' + t.toFixed(3) + 's');
      }
    }
    if (!opts.quiet) process.stderr.write('\n');
    return { frames, contract, frameCount };
  } finally {
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    await rm(shimPath, { force: true }).catch(() => {});
  }
}

/* ---------- 校验 ---------- */
async function verifyFrames(framesDir, expected, dims) {
  const files = (await readdir(framesDir)).filter((f) => /^f_\d{4}\.png$/.test(f)).sort();
  if (files.length !== expected) {
    throw new Error('帧数不符：期望 ' + expected + '，实际 ' + files.length + '（目录 ' + framesDir + '）');
  }
  const problems = [];
  const check = async (name) => {
    const buf = await readFile(path.join(framesDir, name));
    const s = pngSize(buf);
    if (!s) { problems.push(name + '：不是合法 PNG'); return; }
    if (s.width !== dims.width || s.height !== dims.height) {
      problems.push(name + '：尺寸 ' + s.width + 'x' + s.height + '，期望 ' + dims.width + 'x' + dims.height);
    }
  };
  await check(files[0]);
  await check(files[files.length - 1]);
  if (files.length > 2) await check(files[Math.floor(files.length / 2)]);
  if (problems.length) throw new Error('帧校验失败：' + problems.join('；'));
  return files;
}

async function probeVideo(ffprobe, file) {
  const r = await run(ffprobe, ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file], { timeoutMs: 60000 });
  if (r.code !== 0) return null;
  try {
    const j = JSON.parse(r.stdout);
    const v = (j.streams || []).find((s) => s.codec_type === 'video') || {};
    return {
      codec: v.codec_name || null,
      width: v.width === undefined ? null : v.width,
      height: v.height === undefined ? null : v.height,
      fps: v.r_frame_rate || null,
      nb_frames: v.nb_frames ? Number(v.nb_frames) : null,
      duration: j.format ? Number(j.format.duration) : null,
      bytes: j.format ? Number(j.format.size) : null,
    };
  } catch { return null; }
}

/* ---------- 主流程 ---------- */
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { printUsage(); return 0; }
  const startedAt = Date.now();
  opts.tmpRoot = path.join(ROOT, 'out', 'tmp');
  await mkdir(opts.tmpRoot, { recursive: true });

  if (!opts.out) opts.out = path.join(ROOT, 'out', 'renders', 'render-' + stamp() + '.mp4');
  await mkdir(path.dirname(opts.out), { recursive: true });
  const outName = path.basename(opts.out, path.extname(opts.out));
  const framesDir = opts['frames-dir'] ? path.resolve(opts['frames-dir']) : path.join(ROOT, 'out', 'frames', outName);
  await mkdir(framesDir, { recursive: true });
  for (const f of await readdir(framesDir)) {
    if (/^f_\d{4}\.png$/.test(f)) await rm(path.join(framesDir, f), { force: true });
  }
  if (!opts.quiet) {
    log('[render] 页面: ' + opts.url);
    log('[render] 帧目录: ' + framesDir);
    log('[render] 输出: ' + opts.out);
    log('[render] 模式: ' + (opts.fallback ? 'fallback（逐帧新起 Chrome）' : 'primary（CDP）'));
  }

  // 显式 CLI 参数优先；缺省时用页面契约 __jarvis.width/height/fps/duration 回填
  const explicit = { width: opts.width, height: opts.height, fps: opts.fps, duration: opts.duration };
  opts.width = explicit.width === undefined ? 1920 : explicit.width;
  opts.height = explicit.height === undefined ? 1080 : explicit.height;

  let result;
  if (opts.fallback) {
    result = await renderFallback(opts, framesDir, explicit);
  } else {
    const probe = await renderPrimaryProbe(opts);
    opts.width = explicit.width === undefined ? (probe.width || 1920) : explicit.width;
    opts.height = explicit.height === undefined ? (probe.height || 1080) : explicit.height;
    opts.fps = explicit.fps === undefined ? (probe.fps || 30) : explicit.fps;
    opts.duration = explicit.duration === undefined ? (probe.duration || 10.2) : explicit.duration;
    const full = Math.max(1, Math.round(opts.duration * opts.fps));
    const frameCount = opts.limit === undefined ? full : Math.min(opts.limit, full);
    result = await renderPrimary(opts, { width: opts.width, height: opts.height }, frameCount, framesDir);
    result.frameCount = frameCount;
  }

  const fps = opts.fps === undefined ? 30 : opts.fps;
  const dims = { width: opts.width, height: opts.height };
  const frameCount = result.frameCount;
  const frames = await verifyFrames(framesDir, frameCount, dims);
  if (!opts.quiet) log('[render] 截帧完成：' + frames.length + ' 帧 ' + dims.width + 'x' + dims.height + ' @' + fps + 'fps');

  const encArgs = [
    '-hide_banner', '-nostdin', '-loglevel', 'warning', '-y',
    '-framerate', String(fps),
    '-start_number', '0',
    '-i', path.join(framesDir, 'f_%04d.png'),
    '-an',
    '-c:v', 'libx264', '-preset', String(opts.preset), '-crf', String(opts.crf),
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    opts.out,
  ];
  if (!opts.quiet) log('[render] ffmpeg 编码中…');
  const enc = await run(opts.ffmpeg, encArgs, { timeoutMs: 900000 });
  if (enc.code !== 0) {
    throw new Error('ffmpeg 失败（exit ' + enc.code + '）：' + (enc.stderr || '').split('\n').slice(-6).join(' | '));
  }
  const probe = await probeVideo(opts.ffprobe, opts.out);
  const summary = {
    ok: true,
    out: opts.out,
    framesDir,
    frames: {
      count: frames.length, width: dims.width, height: dims.height,
      first: path.join(framesDir, frames[0]), last: path.join(framesDir, frames[frames.length - 1]),
    },
    video: probe,
    expected: { frames: frameCount, durationSec: frameCount / fps, fps },
    elapsedSec: Math.round((Date.now() - startedAt) / 100) / 10,
  };
  await writeFile(opts.out.replace(/\.[^.]+$/, '') + '.render.json', JSON.stringify(summary, null, 2) + '\n', 'utf8');
  if (!opts.quiet && probe) {
    log('[render] ffprobe: ' + probe.width + 'x' + probe.height + ' ' + probe.fps + 'fps ' +
      (probe.nb_frames === null ? '?' : probe.nb_frames) + ' 帧 ' +
      (probe.duration === null ? '?' : probe.duration) + 's ' +
      ((probe.bytes || 0) / 1048576).toFixed(2) + ' MB');
  }
  if (opts['clean-frames']) {
    await rm(framesDir, { recursive: true, force: true }).catch(() => {});
    if (!opts.quiet) log('[render] 已删除帧目录');
  }
  console.log(JSON.stringify(summary, null, 2));
  return 0;
}

main().then((code) => process.exit(code || 0)).catch((err) => {
  log('[render] 失败：' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
