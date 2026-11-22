/* ============================================================================
 * JARVIS boot v2 — 实拍素材合成器
 * 素材：三段 Wallpaper Engine 视频按章节切用，叠加 DSH 身份层与真实自检数据。
 * 画面仍是 t 的纯函数：seek(t) 返回 Promise，等视频定位到该帧后再绘制。
 * ========================================================================== */
(function () {
  'use strict';
  var W = 1920, H = 1080, FPS = 30;
  var CX = 960, CY = 540;
  // 每章 = 一段 ffmpeg 预切好的全 I 帧片段（源素材的时间码见 clips/README.md）
  var CH = [
    { id: 'brand', dur: 0.80, clip: null },
    { id: 'loading', dur: 1.40, clip: 'loading' },
    { id: 'scan', dur: 1.40, clip: 'scan' },
    { id: 'ident', dur: 1.80, clip: 'ident' },
    { id: 'check', dur: 2.20, clip: 'check' },
    { id: 'armor', dur: 1.40, clip: 'armor' },
    { id: 'jarvis', dur: 1.40, clip: 'jarvis' },
    { id: 'globe', dur: 1.40, clip: 'globe' },
    { id: 'welcome', dur: 1.90, clip: 'welcome' },
    { id: 'handoff', dur: 0.70, clip: null }
  ];
  var start = 0;
  for (var i = 0; i < CH.length; i++) { CH[i].start = start; start += CH[i].dur; }
  var DUR = Math.round(start * 100) / 100;

  var TRANSPARENT = /[?&]transparent=1/.test(location.search);

  var P = {
    cyan: '#2FD3E8', cyanHi: '#8BEEFA', cyanSoft: 'rgba(47,211,232,0.66)',
    cyanFaint: 'rgba(47,211,232,0.24)', amber: '#F0B429', amberSoft: 'rgba(240,180,41,0.7)',
    white: '#F4F7F9', gray: '#9AA7AF', graySoft: 'rgba(154,167,175,0.66)', grayFaint: 'rgba(154,167,175,0.3)'
  };
  var MONO = 'Consolas, "Cascadia Mono", ui-monospace, monospace';
  var HAN = '"Microsoft YaHei", "PingFang SC", sans-serif';

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function span(t, a, b) { return clamp01((t - a) / (b - a)); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function easeOut(k) { return 1 - Math.pow(1 - k, 3); }
  function easeInOut(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
  function rand(s) { var x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); }
  function font(size, weight, han) { return (weight || 400) + ' ' + size + 'px ' + (han ? HAN : MONO); }
  function text(ctx, str, x, y, o) {
    o = o || {};
    ctx.save();
    ctx.font = font(o.size || 16, o.weight || 400, o.han);
    ctx.fillStyle = o.color || P.white;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.baseline || 'alphabetic';
    ctx.letterSpacing = (o.spacing || 0) + 'px';
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    if (o.shadow) { ctx.shadowColor = o.shadow; ctx.shadowBlur = o.blur || 12; }
    ctx.fillText(str, x, y);
    ctx.restore();
  }
  function measure(ctx, str, size, weight, spacing, han) {
    ctx.save(); ctx.font = font(size, weight, han); ctx.letterSpacing = (spacing || 0) + 'px';
    var w = ctx.measureText(str).width; ctx.restore(); return w;
  }
  function rule(ctx, x1, y1, x2, y2, color, w, a) {
    ctx.save(); ctx.globalAlpha = a === undefined ? 1 : a; ctx.strokeStyle = color; ctx.lineWidth = w || 1;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
  }
  function typed(str, k) { return str.slice(0, Math.round(str.length * clamp01(k))); }
  function plate(ctx, x, y, w, h, a) { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,' + (a === undefined ? 0.34 : a) + ')'; ctx.fillRect(x, y, w, h); ctx.restore(); }
  function cornerFrame(ctx, a) {
    var m = 64, L = 30;
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5;
    var pts = [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]];
    for (var i = 0; i < 4; i++) {
      var p = pts[i];
      ctx.beginPath(); ctx.moveTo(p[0] + p[2] * L, p[1]); ctx.lineTo(p[0], p[1]); ctx.lineTo(p[0], p[1] + p[3] * L); ctx.stroke();
    }
    ctx.restore();
  }
  function vignette(ctx, a) {
    var g = ctx.createRadialGradient(CX, CY, 320, CX, CY, 1180);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,' + (a === undefined ? 0.62 : a) + ')');
    ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  function scanlines(ctx) {
    ctx.save(); ctx.globalAlpha = 0.05; ctx.fillStyle = '#000';
    for (var y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    ctx.restore();
  }
  function grain(ctx, frame) {
    ctx.save(); ctx.globalAlpha = 0.05; ctx.fillStyle = '#fff';
    for (var i = 0; i < 220; i++) ctx.fillRect(rand(frame * 977 + i * 3.1) * W, rand(frame * 131 + i * 7.7) * H, 1.2, 1.2);
    ctx.restore();
  }

  // ---------- 视频层 ----------
  var videos = {};
  function makeVideo(clip) {
    var v = document.createElement('video');
    v.src = 'clips/' + clip + '.mp4';
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.crossOrigin = 'anonymous';
    v.style.cssText = 'position:fixed;left:-9999px;top:0;width:16px;height:16px;opacity:0;';
    document.body.appendChild(v);
    return v;
  }
  function seekTo(v, t) {
    return new Promise(function (res) {
      var done = false;
      var fin = function () { if (done) return; done = true; v.removeEventListener('seeked', fin); res(); };
      v.addEventListener('seeked', fin);
      try { v.currentTime = t; } catch (e) { fin(); }
      setTimeout(fin, 500);
    });
  }
  function loaded(v) {
    return new Promise(function (res) {
      if (v.readyState >= 2) return res();
      v.addEventListener('loadeddata', function () { res(); }, { once: true });
      setTimeout(res, 4000);
    });
  }

  // ---------- 章节叠加层 ----------
  function chLocal(ch, t) { return clamp01((t - ch.start) / ch.dur); }

  function drawBrand(ctx, ch, t) {
    var k = easeOut(span(t, ch.start + 0.05, ch.start + 0.7));
    var k2 = span(t, ch.start + 0.15, ch.start + 0.85);
    text(ctx, 'DEEPSEEK HARNESS', CX, CY - 6, { size: 46, weight: 700, color: P.white, spacing: lerp(30, 16, k), align: 'center', alpha: k, shadow: 'rgba(47,211,232,0.35)', blur: 22 });
    text(ctx, 'BOOT SEQUENCE / JARVIS', CX, CY + 46, { size: 13, color: P.cyanSoft, spacing: 9, align: 'center', alpha: k2 });
    var w = 300 * easeOut(k2);
    rule(ctx, CX - w, CY + 70, CX + w, CY + 70, P.cyanFaint, 1, k2);
  }

  function drawLoading(ctx, ch, t) {
    var k = span(t, ch.start + 0.1, ch.start + 0.6);
    plate(ctx, 96, H - 210, 560, 96, 0.42 * k);
    text(ctx, 'BOOT SEQUENCE', 120, H - 168, { size: 15, color: P.white, spacing: 8, alpha: k });
    text(ctx, 'DEEPSEEK HARNESS · v0.2.2-rc.1', 120, H - 140, { size: 11, color: P.graySoft, spacing: 4, alpha: k });
    var p = span(t, ch.start + 0.15, ch.start + ch.dur - 0.1);
    rule(ctx, 120, H - 122, 120 + 500 * p, H - 122, P.cyan, 2, k);
    text(ctx, 'PRELOAD ' + String(Math.round(p * 100)).padStart(3, '0') + '%', W - 120, H - 168, { size: 12, color: P.cyanSoft, spacing: 4, align: 'right', alpha: k });
    text(ctx, 'KERNEL · HANDOFF · SPLASH', W - 120, H - 140, { size: 10, color: P.grayFaint, spacing: 4, align: 'right', alpha: k });
  }

  function drawScan(ctx, ch, t) {
    var p = span(t, ch.start + 0.1, ch.start + ch.dur - 0.05);
    var k = span(t, ch.start, ch.start + 0.35);
    // 扫描线
    var sy = lerp(180, H - 200, easeInOut(p));
    rule(ctx, 0, sy, W, sy, P.cyanHi, 1.5, 0.5 * k);
    var g = ctx.createLinearGradient(0, sy - 90, 0, sy);
    g.addColorStop(0, 'rgba(47,211,232,0)'); g.addColorStop(1, 'rgba(47,211,232,0.13)');
    ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, sy - 90, W, 90); ctx.restore();
    plate(ctx, 96, H - 210, 620, 92, 0.40 * k);
    text(ctx, 'SCANNING · PROFILE desktop', 120, H - 172, { size: 15, color: P.white, spacing: 6, alpha: k });
    text(ctx, 'BUNDLES 06 · SKILLS 17 · SANDBOX full-access', 120, H - 144, { size: 11, color: P.graySoft, spacing: 3, alpha: k });
    rule(ctx, 120, H - 124, 120 + 520 * p, H - 124, P.cyan, 2, k);
    text(ctx, String(Math.round(p * 100)).padStart(3, '0') + '%', W - 120, H - 172, { size: 15, color: P.cyanHi, spacing: 3, align: 'right', alpha: k });
  }

  function drawIdent(ctx, ch, t) {
    var k = span(t, ch.start + 0.1, ch.start + 0.5);
    plate(ctx, 110, 250, 470, 224, 0.42 * k);
    text(ctx, 'IDENTITY SCAN', 136, 292, { size: 14, color: P.cyanSoft, spacing: 7, alpha: k });
    rule(ctx, 136, 306, 136 + 400 * k, 306, P.cyanFaint, 1, k);
    var rows = [['OPERATOR', 'HQF'], ['ACCESS LEVEL', '03'], ['BIOMETRIC', 'PASS'], ['SIGNATURE', 'VERIFIED']];
    for (var i = 0; i < rows.length; i++) {
      var rk = span(t, ch.start + 0.25 + i * 0.18, ch.start + 0.55 + i * 0.18);
      if (rk <= 0) continue;
      text(ctx, '[ ' + String(i + 1).padStart(2, '0') + ' ]', 136, 344 + i * 34, { size: 11, color: P.cyanSoft, spacing: 2, alpha: rk });
      text(ctx, rows[i][0], 196, 344 + i * 34, { size: 14, color: P.gray, spacing: 4, alpha: rk });
      text(ctx, rows[i][1], 556, 344 + i * 34, { size: 14, color: i === 3 ? P.amber : P.cyanHi, spacing: 4, align: 'right', alpha: rk, shadow: P.cyan, blur: 10 });
    }
    var sweep = (t * 1.4) % 1;
    rule(ctx, 110, 250 + 224 * sweep, 580, 250 + 224 * sweep, P.cyanSoft, 1, 0.35 * k);
  }

  var FACTS = [
    ['PROFILE', 'desktop'], ['MODEL', 'deepseek-flash'], ['BUNDLES', '06'],
    ['SKILLS', '17'], ['SANDBOX', 'full-access'], ['SESSION', '001']
  ];
  function drawCheck(ctx, ch, t) {
    plate(ctx, 90, 286, 540, 470, 0.62);
    text(ctx, 'SYSTEM CHECK', 122, 344, { size: 15, color: P.cyanHi, spacing: 8 });
    rule(ctx, 122, 360, 592, 360, P.cyanFaint, 1, 1);
    for (var i = 0; i < FACTS.length; i++) {
      var k = span(t, ch.start + 0.15 + i * 0.22, ch.start + 0.45 + i * 0.22);
      if (k <= 0) continue;
      var y = 406 + i * 56;
      text(ctx, '[ ' + String(i + 1).padStart(2, '0') + ' ]', 120, y, { size: 11, color: P.cyanSoft, spacing: 2, alpha: k });
      text(ctx, FACTS[i][0], 186, y, { size: 15, color: P.white, spacing: 5, alpha: k });
      text(ctx, FACTS[i][1], 470, y, { size: 15, color: P.cyanHi, spacing: 3, align: 'right', alpha: k, shadow: P.cyan, blur: 12 });
      var bx = 496;
      for (var b = 0; b < 8; b++) {
        var hh = 4 + 12 * Math.abs(Math.sin(i * 1.3 + b * 0.9 + t * 3)) * k;
        ctx.save(); ctx.globalAlpha = k * 0.7; ctx.fillStyle = b % 4 === 0 ? P.amberSoft : P.cyanSoft;
        ctx.fillRect(bx + b * 6, y - hh, 2.5, hh); ctx.restore();
      }
    }
    var done = span(t, ch.start + 1.55, ch.start + 1.95);
    if (done > 0) {
      text(ctx, '06/06 PASSED', 592, 752, { size: 13, color: P.amber, spacing: 5, align: 'right', alpha: done });
    }
  }

  function drawArmor(ctx, ch, t) {
    var k = span(t, ch.start + 0.15, ch.start + 0.7);
    var spc = lerp(34, 12, easeOut(k));
    text(ctx, 'SYSTEM ONLINE', CX, H - 250, { size: 62, weight: 700, color: P.white, spacing: spc, align: 'center', alpha: easeOut(k), shadow: 'rgba(47,211,232,0.45)', blur: 26 });
    rule(ctx, CX - 420 * easeOut(k), H - 200, CX + 420 * easeOut(k), H - 200, P.cyanFaint, 1, k);
    text(ctx, 'ACCESS LEVEL 3  ·  JARVIS', CX, H - 160, { size: 14, color: P.amber, spacing: 9, align: 'center', alpha: span(t, ch.start + 0.45, ch.start + 0.9) });
  }

  function drawJarvisCard(ctx, ch, t) {
    var k = span(t, ch.start + 0.1, ch.start + 0.6);
    text(ctx, 'DEEPSEEK HARNESS', CX, H - 190, { size: 17, color: P.white, spacing: 12, align: 'center', alpha: k });
    text(ctx, 'IDENTITY CONFIRMED  ·  WELCOME PROTOCOL ARMED', CX, H - 160, { size: 11, color: P.cyanSoft, spacing: 6, align: 'center', alpha: span(t, ch.start + 0.4, ch.start + 0.9) });
  }

  function drawGlobe(ctx, ch, t) {
    var k = span(t, ch.start + 0.1, ch.start + 0.55);
    var p = span(t, ch.start, ch.start + ch.dur);
    plate(ctx, W - 560, 250, 440, 190, 0.55 * k);
    text(ctx, 'GLOBAL WORKSPACE', W - 536, 292, { size: 14, color: P.cyanHi, spacing: 7, alpha: k });
    rule(ctx, W - 536, 308, W - 536 + 390 * k, 308, P.cyanFaint, 1, k);
    text(ctx, 'WORKSPACE   ' + (t < ch.start + ch.dur - 0.2 ? 'SYNCING' : 'READY'), W - 536, 348, { size: 13, color: P.gray, spacing: 4, alpha: k });
    text(ctx, 'SKILLS 17  ·  BUNDLES 06  ·  MODEL deepseek-flash', W - 536, 378, { size: 11, color: P.graySoft, spacing: 3, alpha: k });
    text(ctx, 'SESSION 001  ·  ACCESS LEVEL 3', W - 536, 402, { size: 11, color: P.graySoft, spacing: 3, alpha: k });
    rule(ctx, W - 536, 424, W - 536 + 390 * p, 424, P.cyan, 1.5, k);
  }

  function envAt(t) {
    var bumps = [[12.20, .55], [12.38, .95], [12.6, .85], [12.8, .8], [13.02, 1.0], [13.22, .85], [13.4, .55]];
    var v = 0;
    for (var i = 0; i < bumps.length; i++) { var d = (t - bumps[i][0]) / 0.14; v = Math.max(v, bumps[i][1] * Math.exp(-d * d)); }
    return clamp01(v);
  }
  function drawWelcome(ctx, ch, t) {
    var env = envAt(t);
    var barY = H - 132;
    var k = span(t, ch.start + 0.05, ch.start + 0.4);
    // 字幕底板（压在亮环上也能读）
    plate(ctx, CX - 470, barY - 86, 940, 150, 0.58 * easeOut(k));
    // 音频反应条
    for (var b = 0; b < 48; b++) {
      var lv = Math.abs(Math.sin(b * 0.62 + 0.4)) * env;
      var hh = 3 + 20 * lv;
      ctx.save(); ctx.globalAlpha = 0.35 + 0.5 * env; ctx.fillStyle = b % 6 === 0 ? P.amberSoft : P.cyanSoft;
      ctx.fillRect(CX - 24 * 8 + b * 8, barY - 52 - hh, 3, hh); ctx.restore();
    }
    rule(ctx, CX - 430 * easeOut(k), barY + 58, CX + 430 * easeOut(k), barY + 58, P.cyanFaint, 1, k);
    text(ctx, 'VOICE LINK  ·  ESTABLISHED', CX, barY - 66, { size: 11, color: P.cyanSoft, spacing: 6, align: 'center', alpha: span(t, ch.start + 0.1, ch.start + 0.5) });
    var say = typed('Welcome home, Sir.', span(t, 12.15, 13.25));
    text(ctx, say, CX, barY + 14, { size: 46, color: P.white, spacing: 4, align: 'center', shadow: 'rgba(47,211,232,0.5)', blur: 24 });
    if (t > 12.15) {
      if (Math.floor(t * 4) % 2 === 0) {
        var w = measure(ctx, say, 46, 400, 4);
        ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = P.cyan; ctx.fillRect(CX + w / 2 + 10, barY - 20, 3, 38); ctx.restore();
      }
    }
    text(ctx, '欢迎回家，先生', CX, barY + 50, { size: 16, color: 'rgba(220,232,238,0.85)', spacing: 8, align: 'center', han: true, alpha: span(t, 12.85, 13.4) });
  }

  function drawHandoff(ctx, ch, t) {
    var k = span(t, ch.start + 0.05, ch.start + 0.5);
    text(ctx, 'DEEPSEEK HARNESS', CX, CY - 10, { size: 34, weight: 700, color: P.white, spacing: 16, align: 'center', alpha: k * (1 - span(t, ch.start + 0.62, ch.start + ch.dur)) , shadow: 'rgba(47,211,232,0.3)', blur: 18 });
    text(ctx, 'HANDOFF → WORKSPACE', CX, CY + 46, { size: 11, color: P.cyanSoft, spacing: 7, align: 'center', alpha: k * 0.9 });
  }

  // ---------- HUD ----------
  function drawHud(ctx, t, ch) {
    var k = span(t, 0.2, 1.0);
    ctx.save(); ctx.globalAlpha = k;
    text(ctx, 'DEEPSEEK HARNESS', 96, 104, { size: 14, color: 'rgba(220,232,238,0.85)', spacing: 5 });
    text(ctx, 'BOOT SEQUENCE / JARVIS', 96, 124, { size: 10, color: P.graySoft, spacing: 4 });
    text(ctx, 'T+' + t.toFixed(2).padStart(5, '0') + 's', W - 96, 104, { size: 13, color: 'rgba(220,232,238,0.8)', spacing: 3, align: 'right' });
    text(ctx, 'FRAME ' + String(Math.round(t * FPS)).padStart(4, '0') + ' · 30FPS', W - 96, 124, { size: 10, color: P.graySoft, spacing: 3, align: 'right' });
    text(ctx, ch.id.toUpperCase(), 96, H - 84, { size: 10, color: P.cyanFaint, spacing: 5 });
    text(ctx, '[ SKIP ]  ESC', W - 96, H - 84, { size: 11, color: P.graySoft, spacing: 4, align: 'right' });
    ctx.restore();
  }

  // ---------- 渲染 ----------
  var canvas, ctx;
  var api;

  function chapterAt(t) {
    for (var i = CH.length - 1; i >= 0; i--) if (t >= CH[i].start) return CH[i];
    return CH[0];
  }

  function drawFootage(ch, t) {
    var v = videos[ch.clip];
    if (!v || v.readyState < 2) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); return; }
    var local = clamp01((t - ch.start) / ch.dur) * ch.dur;
    // 轻微推近，避免边缘露出
    var zoom = 1.02 + 0.02 * (local / ch.dur);
    var dw = W * zoom, dh = H * zoom;
    ctx.save();
    ctx.filter = 'saturate(0.92) contrast(1.04) brightness(0.96)';
    ctx.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.restore();
    // 统一冷色调
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(20,70,110,0.35)'; ctx.fillRect(0, 0, W, H); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(232,242,248,0.92)'; ctx.fillRect(0, 0, W, H); ctx.restore();
  }

  function render(t) {
    t = Math.max(0, Math.min(DUR, t));
    var ch = chapterAt(t);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (!TRANSPARENT && ch.clip) drawFootage(ch, t);
    // 章节叠加
    if (ch.id === 'brand') drawBrand(ctx, ch, t);
    else if (ch.id === 'loading') drawLoading(ctx, ch, t);
    else if (ch.id === 'scan') drawScan(ctx, ch, t);
    else if (ch.id === 'ident') drawIdent(ctx, ch, t);
    else if (ch.id === 'check') drawCheck(ctx, ch, t);
    else if (ch.id === 'armor') drawArmor(ctx, ch, t);
    else if (ch.id === 'jarvis') drawJarvisCard(ctx, ch, t);
    else if (ch.id === 'globe') drawGlobe(ctx, ch, t);
    else if (ch.id === 'welcome') drawWelcome(ctx, ch, t);
    else drawHandoff(ctx, ch, t);
    vignette(ctx, 0.55);
    if (ch.id === 'check' || ch.id === 'ident') vignette(ctx, 0.25);
    cornerFrame(ctx, span(t, 0.1, 0.8) * 0.9);
    drawHud(ctx, t, ch);
    scanlines(ctx);
    grain(ctx, Math.round(t * FPS));
    // 章节边界快速压黑
    var dip = 0;
    var toStart = t - ch.start, toEnd = ch.start + ch.dur - t;
    if (ch.id !== 'brand' && ch.id !== 'handoff') dip = Math.max(0, 1 - Math.min(toStart, toEnd) / 0.09);
    if (ch.id === 'handoff') dip = Math.max(dip, span(t, ch.start + ch.dur - 0.18, ch.start + ch.dur));
    if (dip > 0) { ctx.save(); ctx.globalAlpha = dip; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  }

  function seek(t) {
    t = Math.max(0, Math.min(DUR, t));
    var ch = chapterAt(t);
    if (TRANSPARENT || !ch.clip) { render(t); return Promise.resolve(t); }
    var v = videos[ch.clip];
    var want = Math.max(0, Math.min(ch.dur - 0.034, t - ch.start));
    if (v.readyState < 2) { render(t); return loaded(v).then(function () { return seekTo(v, want).then(function () { render(t); }); }); }
    if (Math.abs(v.currentTime - want) < 0.004) { render(t); return Promise.resolve(t); }
    return seekTo(v, want).then(function () { render(t); return t; });
  }

  function init() {
    canvas = document.getElementById('stage');
    ctx = canvas.getContext('2d');
    if (!TRANSPARENT) { for (var ci = 0; ci < CH.length; ci++) { if (CH[ci].clip) videos[CH[ci].clip] = makeVideo(CH[ci].clip); } }
    api = { duration: DUR, fps: FPS, width: W, height: H, ready: false, seek: seek, chapters: CH };
    window.__jarvis = api;
    var waits = Object.keys(videos).map(function (k) { return loaded(videos[k]); });
    waits.push(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve());
    Promise.all(waits).then(function () {
      return Promise.all(Object.keys(videos).map(function (k) { return seekTo(videos[k], 0); }));
    }).then(function () {
      render(0); api.ready = true;
    }).catch(function (e) {
      window.__jarvisError = String(e && e.message || e);
      render(0); api.ready = true;
    });
  }
  init();
})();
