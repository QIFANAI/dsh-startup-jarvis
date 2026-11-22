/* ============================================================================
 * dsh-startup-jarvis — 启动层（浏览器侧，无依赖）
 * 全屏播放 30.2s 成片 → 到 handoffAt 执行"白闪 → 扫描线 → 界面显影"交接
 * 兜底：自动播放被拦 → 静音；播放失败/超时 → poster 静帧 300ms 退出
 * ========================================================================== */
(function () {
  'use strict';
  if (window.__DSH_JARVIS_BOOTED__) return;
  window.__DSH_JARVIS_BOOTED__ = true;

  var RAW = document.getElementById('dsh-jarvis-config');
  var CFG = {};
  try { CFG = JSON.parse(RAW ? RAW.textContent : '{}'); } catch (e) { CFG = {}; }
  // 桌面端走 webserver/index-inject 的 boot payload：配置从全局取
  if (window.__DSH_JARVIS_CFG__ && (!CFG || !CFG.base)) {
    try { CFG = Object.assign({}, window.__DSH_JARVIS_CFG__, CFG && CFG.base ? CFG : {}); } catch (e) { CFG = window.__DSH_JARVIS_CFG__; }
  }
  // 样式由注入脚本自带（桌面端不保证 <link> 注入）
  if (window.__DSH_JARVIS_CSS__ && !document.getElementById('dsh-jarvis-style')) {
    try {
      var st = document.createElement('style');
      st.id = 'dsh-jarvis-style';
      st.textContent = window.__DSH_JARVIS_CSS__;
      (document.head || document.documentElement).appendChild(st);
    } catch (e) { /* noop */ }
  }
  var BASE = CFG.base || '/dsh-jarvis';
  var FACTS = CFG.facts || {};
  var HANDOFF = Number(CFG.handoffAt) || 30.2;
  // 设置页保存后把新配置灌进来（重播时必须用新值：音量/声音/交接点/跳过/减弱动态）
  function syncCfg(next) {
    if (!next || typeof next !== 'object') return;
    var keys = ['enabled', 'mode', 'allowSkip', 'reducedMotion', 'sound', 'volume', 'handoffAt', 'videoFile', 'theme', 'skin'];
    for (var i = 0; i < keys.length; i += 1) {
      if (Object.prototype.hasOwnProperty.call(next, keys[i]) && next[keys[i]] !== undefined) CFG[keys[i]] = next[keys[i]];
    }
    HANDOFF = Number(CFG.handoffAt) || 30.2;
  }

  var KEY_SESSION = 'dsh-jarvis-played-session';
  var KEY_DAILY = 'dsh-jarvis-played-day';
  var started = false, finished = false, handoffStarted = false, root = null, video = null, watchdog = null, progressTimer = null, replayGuard = null;

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function shouldPlay() {
    if (CFG.enabled === false) return false;   // 缺省按启用处理
    if (CFG.enabled === undefined) CFG.enabled = true;
    try {
      if (CFG.mode === 'daily' && !CFG.mode) return true;
      if (CFG.mode === 'always') return true;
      if (CFG.mode === 'daily') return localStorage.getItem(KEY_DAILY) !== today();
      return sessionStorage.getItem(KEY_SESSION) !== '1';
    } catch (e) { return true; }
  }
  function markPlayed() {
    try {
      sessionStorage.setItem(KEY_SESSION, '1');
      if (CFG.mode === 'daily') localStorage.setItem(KEY_DAILY, today());
    } catch (e) { /* noop */ }
  }

  function build() {
    root = document.createElement('div');
    root.id = 'dsh-jarvis-root';
    root.className = 'dsh-jarvis-root';
    // 成片里已经烘好了品牌、事实铭牌与 [SKIP] ESC 角标；
    // 这里只保留视频本体 + 交接特效 + 一个不可见的跳过热区，避免出现两层 HUD。
    root.innerHTML =
      '<div class="dj-stage">' +
        '<video class="dj-video" playsinline preload="auto"></video>' +
        '<div class="dj-poster"></div>' +
        '<div class="dj-flash"></div>' +
        '<div class="dj-scan"></div>' +
        '<button class="dj-hit" type="button" aria-label="Skip"></button>' +
        '<div class="dj-hint">点击任意处开启声音</div>' +
      '</div>';
    document.body.appendChild(root);
    document.documentElement.classList.add('dj-booting');
    document.documentElement.style.overflow = 'hidden';

    var posterUrl = BASE + '/assets/poster.jpg';
    var posterEl = root.querySelector('.dj-poster');
    posterEl.style.backgroundImage = 'url("' + posterUrl + '")';

    video = root.querySelector('.dj-video');
    video.src = BASE + '/assets/' + (CFG.videoFile || 'jarvis-boot.mp4');
    video.muted = CFG.sound === false;
    video.volume = Math.max(0, Math.min(1, (Number(CFG.volume) || 0) / 100));

    var hit = root.querySelector('.dj-hit');
    if (!CFG.allowSkip || !hit) { if (hit) hit.style.display = 'none'; }
    else hit.addEventListener('click', function (e) { e.stopPropagation(); skip(); });
    root.addEventListener('click', unmuteHint);
    document.addEventListener('keydown', onKey, true);
  }

  function unmuteHint() {
    if (!video) return;
    if (CFG.sound && video.muted) {
      video.muted = false;
      video.volume = Math.max(0, Math.min(1, (Number(CFG.volume) || 0) / 100));
    }
    var hint = root && root.querySelector('.dj-hint');
    if (hint) hint.style.display = 'none';
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); skip(); }
  }

  function tickProgress() {
    if (!video) return;
    var d = video.duration || HANDOFF;
    var p = Math.min(1, (video.currentTime || 0) / Math.max(0.1, Math.min(d, HANDOFF)));
    var bar = null;
    if (bar) bar.style.width = (p * 100).toFixed(2) + '%';
  }

  function cleanup() {
    finished = true;
    if (watchdog) { clearTimeout(watchdog); watchdog = null; }
    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
    if (replayGuard) { clearTimeout(replayGuard); replayGuard = null; }
    document.removeEventListener('keydown', onKey, true);
    if (video) {
      try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) { /* noop */ }
    }
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null; video = null;
    document.documentElement.classList.remove('dj-booting');
    document.documentElement.style.overflow = '';
  }

  function handoff(fast) {
    if (finished || !root || handoffStarted) return;
    handoffStarted = true;
    markPlayed();
    var Skin = window.__DSH_JARVIS_SKIN__;
    var reduced = !!CFG.reducedMotion;
    // ① 冻结启动片最后一帧：交接期间画面不再前进
    if (video) { try { video.pause(); } catch (e) { /* noop */ } }
    // ② 启动层仍盖着时先把皮肤备好（背景/视频就绪，UI 仍隐藏）
    try { if (Skin && Skin.prime) Skin.prime(); } catch (e) { /* noop */ }
    var flashEl = root.querySelector('.dj-flash');
    var scanEl = root.querySelector('.dj-scan');

    if (reduced) {
      // 减弱动态：不闪不扫，直接 300ms 淡出
      try { if (Skin && Skin.reveal) Skin.reveal(); } catch (e) { /* noop */ }
      root.style.transition = 'opacity 300ms ease-out';
      root.style.opacity = '0';
      setTimeout(cleanup, 340);
      return;
    }

    // ③ 金红扫描线 + 暖白闪（splash.css 负责配色与节奏）
    if (flashEl) flashEl.classList.add('on');
    if (scanEl) scanEl.classList.add('on');

    // ④ 闪光峰值后分区显影（总时长约 1.2s）；启动层在已显影的 UI 上淡出
    var peak = fast ? 210 : 300;
    var fade = fast ? 620 : 820;
    setTimeout(function () {
      try { if (Skin && Skin.reveal) Skin.reveal(); } catch (e) { /* noop */ }
    }, peak);
    setTimeout(function () {
      if (!root) return;
      root.style.transition = 'opacity ' + fade + 'ms cubic-bezier(.16, 1, .3, 1)';
      root.style.opacity = '0';
    }, peak + 40);
    setTimeout(cleanup, peak + fade + 80);
  }

  function skip() {
    if (!CFG.allowSkip || finished) return;
    handoff(true);
  }

  function fallback(reason) {
    if (finished || !root || handoffStarted) return;
    handoffStarted = true;
    try { console.warn('[dsh-jarvis] fallback:', reason); } catch (e) { /* noop */ }
    markPlayed();
    try { if (window.__DSH_JARVIS_SKIN__) window.__DSH_JARVIS_SKIN__.enter(); } catch (e) { /* noop */ }
    if (video) { try { video.style.display = 'none'; } catch (e) { /* noop */ } }
    root.style.transition = 'opacity 300ms ease-out';
    root.style.opacity = '0';
    setTimeout(cleanup, 340);
  }

  function play() {
    if (!video || started) return;
    started = true;
    watchdog = setTimeout(function () { if (!finished && video && video.currentTime < 0.2) fallback('watchdog-8s'); }, 8000);
    var p = video.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function () {
        // 自动播放被策略拦截：静音重试，保留画面，点击后开声
        video.muted = true;
        video.play().catch(function () { fallback('autoplay-blocked'); });
        var hint = root && root.querySelector('.dj-hint');
        if (hint && CFG.sound) hint.style.display = 'block';
      });
    }
    progressTimer = setInterval(tickProgress, 120);
    video.addEventListener('timeupdate', function () {
      if (!video) return;
      tickProgress();
      if (video.currentTime >= HANDOFF - 0.03) handoff(false);
    });
    video.addEventListener('ended', function () { handoff(false); });
    video.addEventListener('error', function () { fallback('video-error'); });
    video.addEventListener('stalled', function () {
      setTimeout(function () { if (!finished && video && video.currentTime < 0.2) fallback('video-stalled'); }, 6000);
    });
  }

  function beacon(stage, extra) {
    try {
      fetch(BASE + '/beacon?msg=' + encodeURIComponent(stage + ' ' + (extra || '')), { cache: 'no-store' })
    } catch (e) { /* noop */ }
  }
  window.addEventListener('error', function (e) { beacon('window-error', String(e.message || e)) })
  function applyTheme(theme) {
    try {
      if (CFG.skin && CFG.skin.enabled !== false) return; // JARVIS 皮肤接管外观
      theme = theme || { enabled: false };
      var html = document.documentElement;
      var layer = document.getElementById('dj-theme-layer');
      if (!theme.enabled) {
        html.classList.remove('dj-theme');
        if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
        return;
      }
      var accent = /^#[0-9a-fA-F]{6}$/.test(String(theme.accent || '')) ? theme.accent : '#e9a13b';
      var k = Math.max(0, Math.min(1, (Number(theme.intensity) || 55) / 100));
      html.classList.add('dj-theme');
      var st = document.getElementById('dj-theme-style');
      if (!st) { st = document.createElement('style'); st.id = 'dj-theme-style'; (document.head || html).appendChild(st); }
      st.textContent = 'html.dj-theme{--dsw-alias-state-business-primary:' + accent + ';--dsw-focus-ring-color:' + accent + ';--dj-accent:' + accent + '}' +
        'html.dj-theme ::selection{background:' + accent + ';color:#111}' +
        '#dj-theme-layer{position:fixed;inset:0;pointer-events:none;z-index:2147481500;mix-blend-mode:screen;opacity:' + (0.10 * k).toFixed(3) + ';' +
        'background:radial-gradient(120% 80% at 50% -10%,' + accent + ' 0%,transparent 55%)}';
      if (!layer) { layer = document.createElement('div'); layer.id = 'dj-theme-layer'; document.body.appendChild(layer); }
      if (theme.scanlines) {
        var scan = document.getElementById('dj-theme-scan');
        if (!scan) { scan = document.createElement('div'); scan.id = 'dj-theme-scan'; scan.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147481501;mix-blend-mode:overlay;opacity:' + (0.18 * k).toFixed(3) + ';background:repeating-linear-gradient(to bottom,rgba(255,255,255,.06) 0 1px,transparent 1px 3px)'; document.body.appendChild(scan); }
      } else { var old = document.getElementById('dj-theme-scan'); if (old && old.parentNode) old.parentNode.removeChild(old); }
    } catch (e) { /* noop */ }
  }
  function boot(force) {
    applyTheme(CFG.theme);
    beacon('boot-check', 'enabled=' + CFG.enabled + ' mode=' + CFG.mode + ' session=' + (function(){try{return sessionStorage.getItem(KEY_SESSION)}catch(e){return '?'}})())
    if (!force && !shouldPlay()) {
      document.documentElement.classList.remove('dj-booting');
      try { if (window.__DSH_JARVIS_SKIN__) window.__DSH_JARVIS_SKIN__.enter(); } catch (e) { /* noop */ }
      return;
    }
    if (!document.body) { document.addEventListener('DOMContentLoaded', function () { boot(force) }); return; }
    build();
    beacon('overlay-built');
    // 等首帧可播再显示，避免黑屏闪烁；最多等 4s
    var shown = false;
    function show() {
      if (shown || !root) return;
      shown = true;
      root.classList.add('dj-ready');
      play();
    }
    video.addEventListener('canplay', show);
    setTimeout(show, 4000);
  }

  /* 设置页「重播启动动画」：倒回未播放状态 → 用新配置重新建层并播放。
     返回 true 表示已开始重播；false 表示配置禁用或正在播放中（不打断）。 */
  function resetRun() {
    if (watchdog) { clearTimeout(watchdog); watchdog = null; }
    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
    document.removeEventListener('keydown', onKey, true);
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null;
    video = null;
    started = false;
    finished = false;
    handoffStarted = false;
    document.documentElement.classList.remove('dj-booting');
    document.documentElement.style.overflow = '';
  }

  function replay(next) {
    try {
      syncCfg(next);
      if (CFG.enabled === false) return false;
      if (!finished && root) return false;
      try {
        var Skin = window.__DSH_JARVIS_SKIN__;
        if (Skin && Skin.replayReset) Skin.replayReset();
      } catch (e) { /* noop */ }
      resetRun();
      try {
        sessionStorage.removeItem(KEY_SESSION);
        localStorage.removeItem(KEY_DAILY);
      } catch (e) { /* noop */ }
      boot(true);
      if (replayGuard) clearTimeout(replayGuard);
      // 兜底：交接没触发（资源异常等）时强制收尾，绝不把界面永久盖住
      replayGuard = window.setTimeout(function () {
        replayGuard = null;
        if (!finished) fallback('replay-timeout');
      }, (HANDOFF + 15) * 1000);
      return true;
    } catch (e) {
      return false;
    }
  }

  window.__DSH_JARVIS_API__ = {
    skip: skip,
    replay: replay,
    applyConfig: syncCfg,
    state: function () {
      return {
        started: started,
        finished: finished,
        handoffStarted: handoffStarted,
        handoffAt: HANDOFF,
        hasRoot: !!root,
        playing: !!(video && !video.paused),
        muted: !!(video && video.muted),
        volume: video ? Number(Number(video.volume).toFixed(2)) : null
      };
    }
  };

  boot(false);
})();
