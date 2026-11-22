/* ============================================================================
 * dsh-startup-jarvis · JARVIS MK VII · 皮肤运行时（skin.js）
 * ----------------------------------------------------------------------------
 * 职责：
 *   1) 启动时给 <html> 加 dj-skin / 档位 / 背景 / 动效 class
 *   2) 创建 #dsh-jarvis-ambient（video + scrim + vignette + grain + scan）
 *   3) 交接：enter() 起播背景、移除 dj-booting、加 dj-enter 分区显影
 *   4) 状态：只按“当前可见会话”写 data-dj-scene / data-dj-streaming
 *   5) 轻量视差（rAF 写 --dj-px/--dj-py）
 *   6) 暴露 window.__DSH_JARVIS_SKIN__ { apply, enter, exit, diagnostics, getState }
 *
 * 原则：任何异常只降级为“没有背景/没有皮肤”，绝不阻断 DSH UI。
 * ========================================================================== */
(function () {
  'use strict';
  if (window.__DSH_JARVIS_SKIN_BOOTED__) return;
  window.__DSH_JARVIS_SKIN_BOOTED__ = true;

  var DEFAULTS = {
    enabled: true,
    preset: 'mark7',
    level: 'glass',
    background: 'hud',
    bgOpacity: 92,
    brightness: 76,
    motion: 'full',
    accent: '#ffc46b',
    grain: 28,
    scanlines: 35,
    parallax: true,
    focusDim: true,
    hudCorners: true,
    lightMode: 'porcelain'
  };

  function readCfg() {
    var raw = null;
    try { raw = window.__DSH_JARVIS_CFG__ || null } catch (e) { raw = null }
    if (!raw) {
      try {
        var el = document.getElementById('dsh-jarvis-config');
        raw = el ? JSON.parse(el.textContent || '{}') : {};
      } catch (e) { raw = {} }
    }
    var cfg = raw && typeof raw === 'object' ? raw : {};
    var skin = Object.assign({}, DEFAULTS, cfg.skin && typeof cfg.skin === 'object' ? cfg.skin : {});
    return {
      base: cfg.base || '/api/dsh-jarvis',
      version: cfg.version || '',
      facts: cfg.facts || {},
      skin: skin
    };
  }

  // 桌面包走 webserver/index-inject：skin.css 以字符串注入，这里先落 <style>
  try {
    var injectedCss = window.__DSH_JARVIS_SKIN_CSS__;
    if (injectedCss && !document.getElementById('dsh-jarvis-skin-style')) {
      var styleEl = document.createElement('style');
      styleEl.id = 'dsh-jarvis-skin-style';
      styleEl.textContent = injectedCss;
      (document.head || document.documentElement).appendChild(styleEl);
    }
  } catch (e) { /* noop */ }

  var CFG = readCfg();
  var S = CFG.skin;
  var API_BASE = CFG.base;
  var AMBIENT_ID = 'dsh-jarvis-ambient';
  var root = document.documentElement;
  var ambient = null;
  var heroDeck = null;
  var heroHead = null;
  var sidebarObserver = null;
  var video = null;
  var enterTimer = null;
  var enterTail = null;
  var primed = false;
  var entered = false;
  var observer = null;
  var bubbleObserver = null;
  var rafPending = false;
  var parallax = { x: 0, y: 0, tx: 0, ty: 0, raf: 0, active: false };
  var videoFailed = false;
  var lastScene = '';
  var lastStreaming = false;

  function beacon(msg) {
    try { fetch(API_BASE + '/beacon?msg=' + encodeURIComponent('skin ' + msg), { cache: 'no-store' }) } catch (e) { /* noop */ }
  }
  function clamp(n, min, max) { n = Number(n); if (!isFinite(n)) return min; return Math.max(min, Math.min(max, n)) }
  function hex(v, fallback) { return /^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? String(v) : fallback }
  function pct(n) { return clamp(n, 0, 100) }

  function modeClass() {
    var bg = String(S.background || 'hud');
    if (bg !== 'hud' && bg !== 'ambient' && bg !== 'poster' && bg !== 'off') bg = 'hud';
    var motion = String(S.motion || 'full');
    if (motion !== 'full' && motion !== 'reduced' && motion !== 'off') motion = 'full';
    return { bg: bg, motion: motion };
  }

  function applyCssVars() {
    var accent = hex(S.accent, '#ffc46b');
    var r = parseInt(accent.slice(1, 3), 16), g = parseInt(accent.slice(3, 5), 16), b = parseInt(accent.slice(5, 7), 16);
    var op = pct(S.bgOpacity) / 100;
    var bright = pct(S.brightness) / 100;
    root.style.setProperty('--dj-accent', accent);
    root.style.setProperty('--dj-accent-rgb', r + ',' + g + ',' + b);
    root.style.setProperty('--dj-gold', accent);
    root.style.setProperty('--dj-gold-hi', accent);
    root.style.setProperty('--dj-bg-opacity', String(op));
    root.style.setProperty('--dj-bg-brightness', String(bright));
    root.style.setProperty('--dj-grain', String(pct(S.grain) / 1000));
    root.style.setProperty('--dj-scan', String(pct(S.scanlines) / 1000));
    /* HUD 角标：默认不写内联变量（暗色 .22 / 浅色 .35 由 CSS 决定），关闭时置 0 */
    if (S.hudCorners === false) root.style.setProperty('--dj-corner', '0');
    else root.style.removeProperty('--dj-corner');
    root.style.setProperty('--dj-parallax-enabled', (S.parallax && S.motion === 'full') ? '1' : '0');
  }

  function setClasses() {
    var m = modeClass();
    root.classList.add('dj-skin');
    root.classList.toggle('dj-skin--glass', S.level !== 'accent' && S.level !== 'full');
    root.classList.toggle('dj-skin--accent', S.level === 'accent');
    root.classList.toggle('dj-skin--full', S.level === 'full');
    root.classList.toggle('dj-skin--bg-hud', m.bg === 'hud');
    root.classList.toggle('dj-skin--bg-ambient', m.bg === 'ambient');
    root.classList.toggle('dj-skin--bg-poster', m.bg === 'poster');
    root.classList.toggle('dj-skin--motion-full', m.motion === 'full');
    root.classList.toggle('dj-skin--motion-reduced', m.motion === 'reduced');
    root.classList.toggle('dj-skin--motion-off', m.motion === 'off');
    root.setAttribute('data-dj-preset', String(S.preset || 'mark7'));
    root.setAttribute('data-dj-bg', m.bg);
    root.setAttribute('data-dj-motion', m.motion);
    /* 0.3.8 设置页接线：浅色昼面开关 / 焦点压暗开关（默认值不改变原观感） */
    root.setAttribute('data-dj-light', S.lightMode === 'off' ? 'off' : 'porcelain');
    if (S.focusDim === false) root.removeAttribute('data-dj-focus-dim');
    else root.setAttribute('data-dj-focus-dim', '');
    applyCssVars();
  }

  function asset(name) {
    return API_BASE + '/assets/' + name + (CFG.version ? '?v=' + encodeURIComponent(CFG.version) : '');
  }

  function createAmbient() {
    if (!document.body || ambient) return;
    var m = modeClass();
    if (m.bg === 'off') return;
    ambient = document.createElement('div');
    ambient.id = AMBIENT_ID;
    ambient.setAttribute('aria-hidden', 'true');

    // poster is always the bottom layer; video fades over it
    var poster = document.createElement('div');
    poster.className = 'dj-bg-poster';
    poster.style.backgroundImage = 'url("' + asset(m.bg === 'ambient' ? 'bg-poster-blur.jpg' : 'bg-poster.jpg') + '")';
    ambient.appendChild(poster);

    if (m.bg === 'hud' || m.bg === 'ambient') {
      video = document.createElement('video');
      video.className = 'dj-bg-video';
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('loop', '');
      video.poster = asset(m.bg === 'ambient' ? 'bg-poster-blur.jpg' : 'bg-poster.jpg');
      video.src = asset(m.bg === 'ambient' ? 'bg-ambient.mp4' : 'bg-1080.mp4');
      video.addEventListener('error', function () {
        videoFailed = true;
        beacon('video-error ' + (video && video.error && video.error.code));
        if (video) { video.style.display = 'none'; }
      });
      video.addEventListener('stalled', function () { beacon('video-stalled') });
      ambient.appendChild(video);
    }

    var scrim = document.createElement('div'); scrim.className = 'dj-bg-scrim';
    var vig = document.createElement('div'); vig.className = 'dj-bg-vignette';
    var grain = document.createElement('div'); grain.className = 'dj-bg-grain';
    var scan = document.createElement('div'); scan.className = 'dj-bg-scan';
    ambient.appendChild(scrim); ambient.appendChild(vig); ambient.appendChild(grain); ambient.appendChild(scan);

    document.body.insertBefore(ambient, document.body.firstChild);
    applyCssVars();
  }

  function createHeroHead() {
    if (!document.body || heroHead) return;
    var facts = CFG.facts || {};
    heroHead = document.createElement('div');
    heroHead.id = 'dj-hero-head';
    heroHead.setAttribute('aria-hidden', 'true');
    var main = document.createElement('div'); main.className = 'dj-head-main';
    var kicker = document.createElement('span'); kicker.className = 'dj-head-kicker'; kicker.textContent = 'J.A.R.V.I.S. // OPERATIONS';
    var title = document.createElement('span'); title.className = 'dj-head-title'; title.textContent = 'DeepSeek Harness';
    main.appendChild(kicker); main.appendChild(title);
    var tabs = document.createElement('div'); tabs.className = 'dj-head-tabs';
    ['对话', '轨迹', '变更'].forEach(function (t, i) {
      var span = document.createElement('span'); span.textContent = t; if (i === 0) span.className = 'on'; tabs.appendChild(span);
    });
    var model = document.createElement('div'); model.className = 'dj-head-model';
    model.textContent = 'MODEL // ' + String(facts.model || 'deepseek-flash').toUpperCase();
    main.appendChild(tabs);
    heroHead.appendChild(main); heroHead.appendChild(model);
    document.body.appendChild(heroHead);
  }

  function createHeroDeck() {
    if (!document.body || heroDeck) return;
    var facts = CFG.facts || {};
    var cells = [
      ['CORE', 'ONLINE'],
      ['MODEL', facts.model || 'DEEPSEEK-FLASH'],
      ['PROFILE', facts.profile || 'DESKTOP'],
      ['SKILLS', facts.skills == null ? '—' : String(facts.skills).padStart(2, '0')],
      ['BUNDLES', facts.bundles == null ? '—' : String(facts.bundles).padStart(2, '0')]
    ];
    heroDeck = document.createElement('div');
    heroDeck.id = 'dj-hero-deck';
    heroDeck.setAttribute('aria-hidden', 'true');
    cells.forEach(function (row, index) {
      var cell = document.createElement('div');
      cell.className = 'dj-deck-cell' + (index === 0 ? ' is-live' : '');
      var k = document.createElement('span'); k.className = 'dj-deck-k'; k.textContent = row[0];
      var v = document.createElement('span'); v.className = 'dj-deck-v'; v.textContent = String(row[1]).toUpperCase();
      cell.appendChild(k); cell.appendChild(v);
      heroDeck.appendChild(cell);
    });
    document.body.appendChild(heroDeck);
  }

  var videoRetryBound = false;
  function retryVideoOnGesture() {
    if (!video || videoFailed) return;
    try { video.muted = true; video.play().catch(function () {}) } catch (e) { /* noop */ }
  }
  function bindVideoRetry() {
    if (videoRetryBound) return;
    videoRetryBound = true;
    var retry = function () {
      document.removeEventListener('pointerdown', retry, true);
      document.removeEventListener('keydown', retry, true);
      retryVideoOnGesture();
    };
    document.addEventListener('pointerdown', retry, true);
    document.addEventListener('keydown', retry, true);
  }
  function startVideo() {
    if (!video || videoFailed) return;
    var attempt = function () {
      try {
        if (!video) return;
        video.muted = true;
        // 从亮帧起播：避免交接后看到 30s 的淡入黑场
        try { if (video.readyState >= 1 && (!video.currentTime || video.currentTime < 0.2)) video.currentTime = 2.4 } catch (e) { /* seek may fail before metadata */ }
        var p = video.play();
        if (p && typeof p.catch === 'function') {
          p.catch(function () {
            beacon('video-autoplay-blocked');
            // 不隐藏视频：保留 poster；等首次手势补播（Electron 里通常不会走到）
            bindVideoRetry();
          });
        }
      } catch (e) {
        beacon('video-start-failed ' + (e && e.message));
        bindVideoRetry();
      }
    };
    if (video.readyState >= 2) { attempt(); return; }
    attempt();
    var onCan = function () {
      video.removeEventListener('canplay', onCan);
      attempt();
    };
    video.addEventListener('canplay', onCan, { once: true });
  }

  /* 交接两段式：prime() 在启动层还盖着时先把背景/视频/皮肤备好（UI 仍隐藏）；
     reveal() 在闪白峰值后移除 dj-booting 并触发分区显影（splash 随后在已显影的 UI 上淡出）。
     enter() 保留旧语义（= prime+reveal），供 watchdog / fallback / API 使用。 */
  function prime() {
    if (!S.enabled) return false;
    if (primed) return true;
    primed = true;
    if (enterTimer) { clearTimeout(enterTimer); enterTimer = null; }
    startVideo();
    return true;
  }
  function reveal() {
    if (!S.enabled) return;
    if (!primed) { if (!prime()) return; }
    if (entered) return;
    entered = true;
    try { root.classList.remove('dj-booting') } catch (e) { /* noop */ }
    try {
      root.classList.add('dj-enter');
      if (enterTail) clearTimeout(enterTail);
      enterTail = setTimeout(function () {
        try { root.classList.remove('dj-enter') } catch (e) { /* noop */ }
        enterTail = null;
      }, 1600);
    } catch (e) { /* noop */ }
    startParallaxIfNeeded();
    markBubbles();
  }
  function enter() {
    if (entered || !S.enabled) return;
    prime();
    reveal();
  }

  /* 设置页「重播启动动画」用：把交接状态倒回启动前，让 splash 的 prime→reveal 能重新跑一遍
     （只重置交接标志与 UI 可见性；背景层/观察器/视差全部保留，不重建、不闪烁）。 */
  function replayReset() {
    if (!S.enabled) return false;
    if (enterTimer) { clearTimeout(enterTimer); enterTimer = null; }
    if (enterTail) { clearTimeout(enterTail); enterTail = null; }
    primed = false;
    entered = false;
    try {
      root.classList.add('dj-booting');
      root.classList.remove('dj-enter');
    } catch (e) { /* noop */ }
    if (video) {
      try {
        if (video.readyState >= 1) video.currentTime = 2.4;
        video.muted = true;
        var p = video.play();
        if (p && typeof p.catch === 'function') p.catch(function () { /* noop */ });
      } catch (e) { /* noop */ }
    }
    return true;
  }

  function exit() {
    primed = false;
    entered = false;
    if (enterTail) { clearTimeout(enterTail); enterTail = null; }
    if (bubbleObserver) { try { bubbleObserver.disconnect() } catch (e) { /* noop */ } bubbleObserver = null; }
    try { root.classList.remove('dj-skin', 'dj-skin--glass', 'dj-skin--full', 'dj-skin--accent', 'dj-skin--bg-hud', 'dj-skin--bg-ambient', 'dj-skin--bg-poster', 'dj-skin--motion-full', 'dj-skin--motion-reduced', 'dj-skin--motion-off', 'dj-enter', 'dj-booting') } catch (e) { /* noop */ }
    if (video) {
      try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) { /* noop */ }
    }
    if (ambient && ambient.parentNode) ambient.parentNode.removeChild(ambient);
    if (heroDeck && heroDeck.parentNode) heroDeck.parentNode.removeChild(heroDeck);
    if (heroHead && heroHead.parentNode) heroHead.parentNode.removeChild(heroHead);
    ambient = null; heroDeck = null; heroHead = null; video = null;
    stopParallax();
    if (observer) { try { observer.disconnect() } catch (e) { /* noop */ } observer = null; }
    if (sidebarObserver) { try { sidebarObserver.disconnect() } catch (e) { /* noop */ } sidebarObserver = null; }
    try {
      root.removeAttribute('data-dj-scene');
      root.removeAttribute('data-dj-streaming');
      root.removeAttribute('data-dj-preset');
      root.removeAttribute('data-dj-bg');
      root.removeAttribute('data-dj-motion');
      root.removeAttribute('data-dj-light');
      root.removeAttribute('data-dj-focus-dim');
    } catch (e) { /* noop */ }
  }

  function apply(next) {
    if (!next || typeof next !== 'object') return;
    var restartVideo = false;
    if (next.background && next.background !== S.background) restartVideo = true;
    var wasAlive = root.classList.contains('dj-skin');
    S = Object.assign({}, S, next);
    if (S.enabled === false) { exit(); return; }
    setClasses();
    if (!wasAlive) {
      /* 之前是「皮肤关闭」状态：重新点亮时要把背景层/品牌头/观察器一起重建 */
      primed = true;
      entered = true;
      try { root.classList.remove('dj-booting'); root.classList.remove('dj-enter'); } catch (e) { /* noop */ }
      if (!ambient) createAmbient();
      if (!heroHead) createHeroHead();
      observe();
      startVideo();
      scheduleUpdate();
      CFG.skin = S;
      window.__DSH_JARVIS_SKIN_STATE__ = S;
      return;
    }
    if (restartVideo) {
      if (ambient && ambient.parentNode) ambient.parentNode.removeChild(ambient);
      ambient = null; video = null;
      createAmbient();
      if (entered) startVideo();
    } else {
      applyCssVars();
      if (video) {
        try { video.style.display = '' } catch (e) { /* noop */ }
      }
    }
    CFG.skin = S;
    window.__DSH_JARVIS_SKIN_STATE__ = S;
  }

  /* ── 当前可见会话：只按可见 root 写状态，避免后台会话带偏 ───────────── */
  function visibleRoot() {
    var roots = document.querySelectorAll('[data-phase]');
    for (var i = 0; i < roots.length; i++) {
      var el = roots[i];
      if (el.offsetParent !== null && el.getClientRects().length > 0) return el;
    }
    return null;
  }
  function syncSidebarWidth() {
    try {
      var side = document.querySelector('[class*="sidebarCol" i]');
      if (side) {
        var w = side.getBoundingClientRect().width;
        root.style.setProperty('--dj-sidebar-w', w.toFixed(1) + 'px');
        if (w >= 330) root.setAttribute('data-dj-sidebar-wide', '');
        else root.removeAttribute('data-dj-sidebar-wide');
        if (!sidebarObserver && typeof ResizeObserver !== 'undefined') {
          sidebarObserver = new ResizeObserver(function () { syncSidebarWidth(); });
          sidebarObserver.observe(side);
        }
      }
    } catch (e) { /* noop */ }
  }
  function autoOpenProcess() {
    try {
      var outers = document.querySelectorAll('[data-turn-process][aria-expanded="false"]');
      for (var i = 0; i < outers.length; i++) {
        var b = outers[i];
        if (b && !b.disabled && typeof b.click === 'function') b.click();
      }
      var heads = document.querySelectorAll('[data-process-activity][aria-expanded="false"]');
      for (var j = 0; j < heads.length; j++) {
        var h = heads[j];
        if (h && typeof h.click === 'function') h.click();
      }
    } catch (e) { /* noop */ }
  }
  function updateScene() {
    syncSidebarWidth();
    autoOpenProcess();
    var vr = visibleRoot();
    var scene = 'chat';
    var streaming = false;
    if (vr) {
      var phase = vr.getAttribute('data-phase') || 'active';
      scene = phase === 'hero' ? 'hero' : 'chat';
      streaming = vr.querySelector('[data-chat-running]') !== null;
    }
    if (scene !== lastScene) {
      lastScene = scene;
      root.setAttribute('data-dj-scene', scene);
    }
    if (streaming !== lastStreaming) {
      lastStreaming = streaming;
      if (streaming) root.setAttribute('data-dj-streaming', '');
      else root.removeAttribute('data-dj-streaming');
    }
    // header / status labels
    var header = document.querySelector('header[data-window-drag]');
    if (header && !header.getAttribute('data-dj-model')) {
      var model = (CFG.facts && CFG.facts.model) || 'deepseek-flash';
      header.setAttribute('data-dj-model', 'MODEL // ' + String(model).toUpperCase());
    }
    var r = document.getElementById('root');
    if (r && !r.getAttribute('data-dj-status')) {
      var ver = CFG.version || '';
      var profile = (CFG.facts && CFG.facts.profile) || 'desktop';
      r.setAttribute('data-dj-status', 'SYS ' + ver + ' · PROFILE ' + String(profile).toUpperCase() + ' · J.A.R.V.I.S. ONLINE');
    }
  }
  function scheduleUpdate() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () { rafPending = false; try { updateScene() } catch (e) { /* noop */ } });
  }
  var enteredRows = new WeakSet();
  function animateNewRows(mutations) {
    try {
      for (var m = 0; m < mutations.length; m++) {
        var added = mutations[m].addedNodes;
        for (var i = 0; i < added.length; i++) {
          var node = added[i];
          if (!node || node.nodeType !== 1) continue;
          var list = [];
          if (node.matches && node.matches('[data-chat-flow-key]')) list.push(node);
          if (node.querySelectorAll) list = list.concat(Array.prototype.slice.call(node.querySelectorAll('[data-chat-flow-key]')));
          for (var j = 0; j < list.length; j++) {
            var row = list[j];
            if (enteredRows.has(row)) continue;
            enteredRows.add(row);
            row.setAttribute('data-dj-enter', '');
            (function (el) { setTimeout(function () { try { el.removeAttribute('data-dj-enter') } catch (e) { /* noop */ } }, 360) })(row);
          }
        }
      }
    } catch (e) { /* noop */ }
  }
  function observeSidebar() {
    try {
      if (sidebarObserver || typeof ResizeObserver === 'undefined') return;
      var side = document.querySelector('[class*="sidebarCol" i]');
      if (!side) return;
      sidebarObserver = new ResizeObserver(function () { syncSidebarWidth(); });
      sidebarObserver.observe(side);
      syncSidebarWidth();
    } catch (e) { /* noop */ }
  }

  /* 视口外的用户气泡暂停呼吸/流光（IntersectionObserver，避免长会话几十个气泡同时跑动画） */
  function markBubbles() {
    try {
      if (typeof IntersectionObserver === 'undefined') return;
      if (!bubbleObserver) {
        bubbleObserver = new IntersectionObserver(function (entries) {
          for (var i = 0; i < entries.length; i++) {
            var el = entries[i].target;
            if (entries[i].isIntersecting) el.removeAttribute('data-dj-bubble-off');
            else el.setAttribute('data-dj-bubble-off', '');
          }
        }, { rootMargin: '160px 0px' });
      }
      var list = document.querySelectorAll('[data-message-bubble]');
      for (var j = 0; j < list.length; j++) {
        if (list[j].__djBubbleSeen) continue;
        list[j].__djBubbleSeen = true;
        bubbleObserver.observe(list[j]);
      }
    } catch (e) { /* noop */ }
  }
  function observe() {
    if (observer) return;
    observer = new MutationObserver(function (mutations) { animateNewRows(mutations); markBubbles(); scheduleUpdate(); });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-phase', 'data-chat-running', 'data-sending', 'aria-selected'] });
    observeSidebar();
    scheduleUpdate();
  }

  /* ── 轻量视差 ────────────────────────────────────────────────────────── */
  function onPointer(e) {
    if (!S.parallax || S.motion !== 'full') return;
    var nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    var ny = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
    parallax.tx = Math.max(-1, Math.min(1, nx)) * 8;
    parallax.ty = Math.max(-1, Math.min(1, ny)) * 5;
    if (!parallax.raf) parallax.raf = requestAnimationFrame(tickParallax);
  }
  function tickParallax() {
    parallax.raf = 0;
    parallax.x += (parallax.tx - parallax.x) * .08;
    parallax.y += (parallax.ty - parallax.y) * .08;
    root.style.setProperty('--dj-px', parallax.x.toFixed(2) + 'px');
    root.style.setProperty('--dj-py', parallax.y.toFixed(2) + 'px');
    if (Math.abs(parallax.tx - parallax.x) > .1 || Math.abs(parallax.ty - parallax.y) > .1) {
      parallax.raf = requestAnimationFrame(tickParallax);
    }
  }
  function startParallaxIfNeeded() {
    if (!S.parallax || S.motion !== 'full' || parallax.active) return;
    /* motion=full 是用户显式选择，优先于系统“减少动画”偏好；仅避开触摸屏 */
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;
    parallax.active = true;
    window.addEventListener('pointermove', onPointer, { passive: true });
  }
  function stopParallax() {
    if (!parallax.active) return;
    parallax.active = false;
    window.removeEventListener('pointermove', onPointer);
    if (parallax.raf) { cancelAnimationFrame(parallax.raf); parallax.raf = 0; }
  }

  function onVisibility() {
    if (!video) return;
    if (document.hidden) { try { video.pause() } catch (e) { /* noop */ } }
    else if (entered) { try { video.play().catch(function () {}) } catch (e) { /* noop */ } }
  }

  function diagnostics() {
    var q = null;
    try { q = video && video.getVideoPlaybackQuality ? video.getVideoPlaybackQuality() : null } catch (e) { q = null }
    return {
      enabled: S.enabled !== false,
      preset: S.preset,
      level: S.level,
      background: S.background,
      motion: S.motion,
      accent: S.accent,
      scene: root.getAttribute('data-dj-scene'),
      streaming: root.hasAttribute('data-dj-streaming'),
      video: video ? {
        readyState: video.readyState,
        paused: video.paused,
        currentTime: Number(video.currentTime.toFixed(2)),
        dur: Number((video.duration || 0).toFixed(2)),
        dropped: q ? q.droppedVideoFrames : null,
        total: q ? q.totalVideoFrames : null
      } : null,
      supports: {
        backdropFilter: (typeof CSS !== 'undefined' && CSS.supports) ? CSS.supports('backdrop-filter', 'blur(1px)') : false,
        has: (typeof CSS !== 'undefined' && CSS.supports) ? CSS.supports('selector(:has(*))') : false,
        reducedMotion: !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      }
    };
  }

  function boot() {
    try {
      if (!document.body) {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
        return;
      }
      if (!S.enabled) { try { root.classList.remove('dj-booting') } catch (e2) { /* noop */ } return; }
      // 先隐藏 #root，等 splash 或 watchdog 交接；背景层可见
      if (!entered) root.classList.add('dj-booting');
      setClasses();
      createAmbient();
      createHeroHead();
      observe();
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('resize', scheduleUpdate, { passive: true });
      // splash.js 正常会调用 enter；若它不存在/失败，6s 后自救
      enterTimer = setTimeout(function () {
        if (entered) return;
        // 启动层还在时（正在播片/兜底中），交接由 splash 的 prime→reveal 负责；
        // 否则 6s watchdog 会在闪白之前就把 UI 显影出来（0.3.5 交接动效被吃掉的第二个原因）。
        if (document.getElementById('dsh-jarvis-root')) {
          enterTimer = setTimeout(function () {
            if (!entered) { beacon('enter-watchdog-late'); enter(); }
          }, 55000);
          return;
        }
        beacon('enter-watchdog');
        enter();
      }, 6000);
      window.__DSH_JARVIS_SKIN__ = { apply: apply, prime: prime, reveal: reveal, enter: enter, replayReset: replayReset, exit: exit, diagnostics: diagnostics, getState: function () { return S } };
      window.__DSH_JARVIS_SKIN_STATE__ = S;
      // 若当前没有启动层在跑（配置 disabled），splash.js 会立即 enter；这里不再抢
    } catch (e) {
      beacon('boot-failed ' + (e && e.message));
      try { root.classList.remove('dj-booting') } catch (e2) { /* noop */ }
    }
  }

  boot();
})();
