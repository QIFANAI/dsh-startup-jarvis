/* ============================================================================
 * JARVIS 启动层 v0.3 —— 叠加在用户自剪成片 11月19日.mp4 上
 * 纯叠加渲染器（不读视频）：seek(t) 同步绘制，黑底 + 后续 screen 混合。
 * 时间轴来自 audio/clip-analysis.md（人声 2.45–11.0，冲击 25.86，淡出 30.4）
 * ========================================================================== */
(function () {
  'use strict';
  var W = 1920, H = 1080, CX = 960;
  var DUR = 31.0333;        // 30.20 视频 + 0.8333 交接 = 931 帧
  var HANDOFF_AT = 30.20;
  var SLAM_AT = 25.86;

  var P = { cyan: '#2FD3E8', cyanHi: '#8BEEFA', cyanSoft: 'rgba(47,211,232,0.66)',
    cyanFaint: 'rgba(47,211,232,0.24)', amber: '#F0B429', amberSoft: 'rgba(240,180,41,0.7)',
    white: '#F4F7F9', gray: '#9AA7AF', graySoft: 'rgba(154,167,175,0.66)', grayFaint: 'rgba(154,167,175,0.3)' };
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
    o = o || {}; ctx.save();
    ctx.font = font(o.size || 16, o.weight || 400, o.han);
    ctx.fillStyle = o.color || P.white;
    ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.baseline || 'alphabetic';
    ctx.letterSpacing = (o.spacing || 0) + 'px';
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    if (o.shadow) { ctx.shadowColor = o.shadow; ctx.shadowBlur = o.blur || 12; }
    ctx.fillText(str, x, y); ctx.restore();
  }
  function measure(ctx, str, size, weight, spacing, han) {
    ctx.save(); ctx.font = font(size, weight, han); ctx.letterSpacing = (spacing || 0) + 'px';
    var w = ctx.measureText(str).width; ctx.restore(); return w;
  }
  function rule(ctx, x1, y1, x2, y2, c, w, a) {
    ctx.save(); ctx.globalAlpha = a === undefined ? 1 : a; ctx.strokeStyle = c; ctx.lineWidth = w || 1;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
  }
  function plate(ctx, x, y, w, h, a) { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,' + (a === undefined ? 0.4 : a) + ')'; ctx.fillRect(x, y, w, h); ctx.restore(); }
  function cornerFrame(ctx, a) {
    var m = 64, L = 30; ctx.save(); ctx.globalAlpha = a;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5;
    var pts = [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]];
    for (var i = 0; i < 4; i++) { var p = pts[i];
      ctx.beginPath(); ctx.moveTo(p[0] + p[2] * L, p[1]); ctx.lineTo(p[0], p[1]); ctx.lineTo(p[0], p[1] + p[3] * L); ctx.stroke(); }
    ctx.restore();
  }
  function vignette(ctx, a) {
    var g = ctx.createRadialGradient(CX, 540, 380, CX, 540, 1180);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + a + ')');
    ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  function scanlines(ctx) {
    ctx.save(); ctx.globalAlpha = 0.045; ctx.fillStyle = '#000';
    for (var y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1); ctx.restore();
  }
  function grain(ctx, f) {
    ctx.save(); ctx.globalAlpha = 0.045; ctx.fillStyle = '#fff';
    for (var i = 0; i < 180; i++) ctx.fillRect(rand(f * 977 + i * 3.1) * W, rand(f * 131 + i * 7.7) * H, 1.2, 1.2);
    ctx.restore();
  }

  // ---------- 字幕 ----------
  var SUBS = [
    { from: 2.45, to: 3.50, en: 'Welcome home, sir.', zh: '欢迎回家，先生' },
    { from: 3.94, to: 6.35, en: 'You need to pay attention to control the time today.', zh: '您需要注意把控今天的时间' },
    { from: 6.83, to: 9.50, en: 'With every passing hour, I remind you once,', zh: '每过一小时，我提醒您一次' },
    { from: 9.90, to: 11.05, en: 'enjoy your time, sir.', zh: '享受您的时间，先生' }
  ];
  function drawSubtitles(ctx, t) {
    for (var i = 0; i < SUBS.length; i++) {
      var s = SUBS[i];
      if (t < s.from - 0.08 || t > s.to + 0.12) continue;
      var a = Math.min(span(t, s.from - 0.08, s.from + 0.12), 1 - span(t, s.to - 0.02, s.to + 0.12));
      if (a <= 0) continue;
      var w = Math.max(measure(ctx, s.en, 38, 400, 3), 620);
      var bx = CX - w / 2 - 46, by = H - 226, bw = w + 92, bh = 122;
      ctx.save(); ctx.globalAlpha = a;
      var g = ctx.createLinearGradient(0, by, 0, by + bh);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.25, 'rgba(0,0,0,0.72)'); g.addColorStop(1, 'rgba(0,0,0,0.78)');
      ctx.fillStyle = g; ctx.fillRect(bx, by, bw, bh); ctx.restore();
      text(ctx, s.en, CX, H - 156, { size: 38, color: P.white, spacing: 3, align: 'center', alpha: a, shadow: 'rgba(0,0,0,0.95)', blur: 14 });
      text(ctx, s.zh, CX, H - 120, { size: 17, color: 'rgba(220,232,238,0.9)', spacing: 6, align: 'center', han: true, alpha: a });
      var p = span(t, s.from, s.to);
      rule(ctx, bx, by, bx + bw * p, by, P.cyanFaint, 1, a);
    }
  }

  // ---------- 品牌 / HUD ----------
  function drawBrand(ctx, t) {
    var out = 1 - span(t, 2.15, 2.45);          // 人声进来前让位
    if (out <= 0) return;
    var k = easeOut(span(t, 0.15, 1.2)) * out;
    var k2 = span(t, 0.6, 1.7) * out;
    text(ctx, 'DEEPSEEK HARNESS', CX, H - 168, { size: 34, weight: 700, color: P.white, spacing: lerp(24, 13, k), align: 'center', alpha: k, shadow: 'rgba(47,211,232,0.45)', blur: 26 });
    text(ctx, 'BOOT SEQUENCE  /  JARVIS', CX, H - 132, { size: 12, color: P.cyanSoft, spacing: 9, align: 'center', alpha: k2 });
    var w = 280 * easeOut(k2);
    rule(ctx, CX - w, H - 112, CX + w, H - 112, P.cyanFaint, 1, k2);
    text(ctx, 'BUILD 0.2.2-rc.1  ·  DESKTOP PROFILE', 96, H - 86, { size: 11, color: P.graySoft, spacing: 4, alpha: span(t, 1.0, 1.6) * out });
  }

  function drawLoadBar(ctx, t) {
    var k = span(t, 11.2, 11.8);
    if (k <= 0) return;
    var fade = 1 - span(t, 12.9, 13.4);
    var a = k * fade;
    text(ctx, 'DSH CORE  ·  LOADING', CX, H - 118, { size: 12, color: P.cyanSoft, spacing: 6, align: 'center', alpha: a });
    var w = 520, p = span(t, 11.2, 12.9);
    rule(ctx, CX - w / 2, H - 96, CX - w / 2 + w * p, H - 96, P.cyan, 2, a);
    rule(ctx, CX - w / 2, H - 96, CX + w / 2, H - 96, 'rgba(255,255,255,0.12)', 1, a);
    text(ctx, String(Math.round(p * 100)).padStart(3, '0') + '%', CX + w / 2 + 12, H - 92, { size: 12, color: P.cyanHi, spacing: 2, alpha: a });
  }

  function drawWorkspace(ctx, t) {
    var k = span(t, 13.2, 13.9) * (1 - span(t, 18.4, 19.0));
    if (k <= 0) return;
    var x = W - 560, y = 250;
    plate(ctx, x, y, 430, 176, 0.5 * k);
    text(ctx, 'GLOBAL WORKSPACE', x + 24, y + 44, { size: 13, color: P.cyanHi, spacing: 6, alpha: k });
    rule(ctx, x + 24, y + 58, x + 400, y + 58, P.cyanFaint, 1, k);
    text(ctx, 'WORKSPACE   READY', x + 24, y + 92, { size: 12, color: P.gray, spacing: 3, alpha: k });
    text(ctx, 'SKILLS 17  ·  BUNDLES 06', x + 24, y + 118, { size: 11, color: P.graySoft, spacing: 3, alpha: k });
    text(ctx, 'MODEL deepseek-flash · SESSION 001', x + 24, y + 142, { size: 11, color: P.graySoft, spacing: 3, alpha: k });
  }

  var FACTS = [['PROFILE', 'desktop'], ['MODEL', 'deepseek-flash'], ['BUNDLES', '06'], ['SKILLS', '17'], ['SANDBOX', 'full-access'], ['SESSION', '001']];
  function drawCheck(ctx, t) {
    var k = span(t, 19.2, 19.8) * (1 - span(t, 24.4, 24.9));
    if (k <= 0) return;
    var x = 96, y = 300;
    plate(ctx, x, y, 520, 440, 0.52 * k);
    text(ctx, 'SYSTEM CHECK', x + 24, y + 44, { size: 14, color: P.cyanHi, spacing: 7, alpha: k });
    rule(ctx, x + 24, y + 60, x + 496, y + 60, P.cyanFaint, 1, k);
    for (var i = 0; i < FACTS.length; i++) {
      var kk = span(t, 19.4 + i * 0.16, 19.7 + i * 0.16) * (1 - span(t, 24.4, 24.9));
      if (kk <= 0) continue;
      var yy = y + 100 + i * 54;
      text(ctx, '[ ' + String(i + 1).padStart(2, '0') + ' ]', x + 24, yy, { size: 11, color: P.cyanSoft, spacing: 2, alpha: kk });
      text(ctx, FACTS[i][0], x + 84, yy, { size: 14, color: P.white, spacing: 5, alpha: kk });
      text(ctx, FACTS[i][1], x + 300, yy, { size: 14, color: P.cyanHi, spacing: 3, alpha: kk, shadow: P.cyan, blur: 10 });
    }
  }

  // ---------- Logo slam（25.86 冲击点）----------
  function drawSlam(ctx, t) {
    if (t < SLAM_AT - 0.30 || t > 29.6) return;
    var dt = t - SLAM_AT;
    // 冲击白光
    var flash = Math.exp(-Math.pow(dt / 0.10, 2));
    if (flash > 0.01) { ctx.save(); ctx.globalAlpha = 0.55 * flash; ctx.fillStyle = '#BFEFFF'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    // 字标砸入
    var k = easeOut(span(t, SLAM_AT - 0.20, SLAM_AT + 0.12));
    var sc = lerp(1.55, 1.0, k);
    var a = span(t, SLAM_AT - 0.22, SLAM_AT + 0.05) * (1 - span(t, 28.9, 29.6));
    ctx.save();
    ctx.translate(CX, 470); ctx.scale(sc, sc); ctx.translate(-CX, -470);
    text(ctx, 'DEEPSEEK HARNESS', CX, 470, { size: 76, weight: 700, color: P.white, spacing: 12, align: 'center', alpha: a, shadow: 'rgba(47,211,232,0.6)', blur: 40 });
    ctx.restore();
    rule(ctx, CX - 480 * k, 526, CX + 480 * k, 526, P.cyanFaint, 1, a);
    text(ctx, 'SYSTEM READY  ·  ACCESS LEVEL 3', CX, 570, { size: 14, color: P.amber, spacing: 8, align: 'center', alpha: span(t, SLAM_AT + 0.15, SLAM_AT + 0.7) * (1 - span(t, 28.9, 29.6)) });
  }

  // ---------- 交接转场（30.20 起 850ms）----------
  function drawMockUI(ctx, alpha, blur) {
    ctx.save();
    ctx.globalAlpha = alpha;
    if (blur > 0.1) ctx.filter = 'blur(' + blur + 'px)';
    ctx.fillStyle = '#0A0E12'; ctx.fillRect(0, 0, W, H);
    // 侧栏
    ctx.fillStyle = '#0F171E'; ctx.fillRect(0, 0, 300, H);
    ctx.fillStyle = 'rgba(47,211,232,0.85)'; ctx.fillRect(24, 34, 132, 15);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(24, 58, 76, 8);
    for (var i = 0; i < 7; i++) {
      ctx.fillStyle = i === 0 ? 'rgba(47,211,232,0.16)' : 'rgba(255,255,255,0.05)';
      ctx.fillRect(16, 104 + i * 44, 268, 30);
      ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(30, 115 + i * 44, 150, 9);
    }
    // 顶部条
    ctx.fillStyle = '#0D141A'; ctx.fillRect(300, 0, W - 300, 62);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(330, 25, 190, 12);
    ctx.fillStyle = 'rgba(47,211,232,0.5)'; ctx.fillRect(W - 320, 25, 90, 12);
    // 消息气泡
    var rows = [{ x: 380, w: 520, h: 74, me: false }, { x: W - 900, w: 520, h: 96, me: true },
                { x: 380, w: 640, h: 112, me: false }, { x: W - 820, w: 440, h: 68, me: true }];
    var y = 128;
    for (var r = 0; r < rows.length; r++) {
      var it = rows[r];
      ctx.fillStyle = it.me ? 'rgba(47,211,232,0.14)' : 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      var rr = 10;
      ctx.moveTo(it.x + rr, y); ctx.lineTo(it.x + it.w - rr, y); ctx.quadraticCurveTo(it.x + it.w, y, it.x + it.w, y + rr);
      ctx.lineTo(it.x + it.w, y + it.h - rr); ctx.quadraticCurveTo(it.x + it.w, y + it.h, it.x + it.w - rr, y + it.h);
      ctx.lineTo(it.x + rr, y + it.h); ctx.quadraticCurveTo(it.x, y + it.h, it.x, y + it.h - rr);
      ctx.lineTo(it.x, y + rr); ctx.quadraticCurveTo(it.x, y, it.x + rr, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      for (var l = 0; l < 3; l++) ctx.fillRect(it.x + 22, y + 20 + l * 18, (it.w - 60) * (0.9 - l * 0.18), 8);
      y += it.h + 34;
    }
    // 输入框
    ctx.fillStyle = 'rgba(255,255,255,0.045)'; ctx.fillRect(380, H - 172, W - 760, 92);
    ctx.strokeStyle = 'rgba(47,211,232,0.4)'; ctx.lineWidth = 1.5; ctx.strokeRect(380, H - 172, W - 760, 92);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(404, H - 136, 300, 10);
    ctx.filter = 'none';
    ctx.restore();
  }
  function drawHandoff(ctx, t) {
    if (t < HANDOFF_AT) return;
    var p = span(t, HANDOFF_AT, DUR);
    // 1) 白场过曝承接爆闪
    var white = 1 - span(t, HANDOFF_AT + 0.02, HANDOFF_AT + 0.16);
    if (white > 0) { ctx.save(); ctx.globalAlpha = 0.92 * white; ctx.fillStyle = '#E8FBFF'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    // 2) 宿主界面显影（模糊→清晰 + 透明→实）
    var reveal = easeOut(span(t, HANDOFF_AT + 0.10, DUR - 0.02));
    if (reveal > 0) {
      var blur = lerp(18, 0, reveal);
      drawMockUI(ctx, Math.min(1, reveal * 1.15), blur);
    }
    // 3) 扫描线自上而下
    var sy = lerp(-40, H + 40, easeInOut(span(t, HANDOFF_AT + 0.06, DUR - 0.04)));
    if (p > 0.02) {
      var g = ctx.createLinearGradient(0, sy - 220, 0, sy);
      g.addColorStop(0, 'rgba(47,211,232,0)'); g.addColorStop(1, 'rgba(47,211,232,0.16)');
      ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, sy - 220, W, 220);
      rule(ctx, 0, sy, W, sy, P.cyanHi, 2, 0.85); ctx.restore();
    }
    // 4) 收尾
    text(ctx, 'WELCOME, SIR.', CX, H - 120, { size: 13, color: 'rgba(47,211,232,0.8)', spacing: 8, align: 'center', alpha: span(t, DUR - 0.35, DUR - 0.05) });
  }

  // ---------- 常驻 HUD ----------
  function drawHud(ctx, t) {
    var k = span(t, 0.2, 1.0) * (1 - span(t, HANDOFF_AT, HANDOFF_AT + 0.15));
    if (k <= 0) return;
    ctx.save(); ctx.globalAlpha = k;
    text(ctx, 'DEEPSEEK HARNESS', 96, 104, { size: 14, color: 'rgba(220,232,238,0.85)', spacing: 5 });
    text(ctx, 'BOOT SEQUENCE / JARVIS', 96, 124, { size: 10, color: P.graySoft, spacing: 4 });
    text(ctx, 'T+' + t.toFixed(2).padStart(5, '0') + 's', W - 96, 104, { size: 13, color: 'rgba(220,232,238,0.8)', spacing: 3, align: 'right' });
    text(ctx, 'FRAME ' + String(Math.round(t * 30)).padStart(4, '0') + ' · 30FPS', W - 96, 124, { size: 10, color: P.graySoft, spacing: 3, align: 'right' });
    text(ctx, '[ SKIP ]  ESC', W - 96, H - 84, { size: 11, color: P.graySoft, spacing: 4, align: 'right' });
    ctx.restore();
  }

  var canvas, ctx;
  function render(t) {
    t = Math.max(0, Math.min(DUR, t));
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (t < HANDOFF_AT) {
      drawBrand(ctx, t);
      drawLoadBar(ctx, t);
      drawWorkspace(ctx, t);
      drawCheck(ctx, t);
      drawSlam(ctx, t);
      vignette(ctx, 0.35);
      cornerFrame(ctx, 0.85);
      drawHud(ctx, t);
    } else {
      drawHandoff(ctx, t);
    }
    scanlines(ctx);
    grain(ctx, Math.round(t * 30));
  }
  function init() {
    canvas = document.getElementById('stage');
    ctx = canvas.getContext('2d');
    var api = { duration: DUR, fps: 30, width: W, height: H, ready: false, seek: function (t) { render(t); return Promise.resolve(t); } };
    window.__jarvis = api;
    render(0);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { render(0); api.ready = true; });
    else api.ready = true;
  }
  init();
})();
