/* ============================================================================
 * JARVIS boot — deterministic canvas renderer (v0.2)
 * 画面是时间 t 的纯函数：window.__jarvis.seek(t) 同步绘制第 t 秒。
 * ========================================================================== */
(function () {
  'use strict';
  var W = 1920, H = 1080, DUR = 10.2;
  var CX = 960, CY = 505;

  var P = {
    grid: 'rgba(255,255,255,0.07)',
    grid2: 'rgba(255,255,255,0.115)',
    cyan: '#2FD3E8',
    cyanHi: '#8BEEFA',
    cyanSoft: 'rgba(47,211,232,0.62)',
    cyanFaint: 'rgba(47,211,232,0.22)',
    cyanGhost: 'rgba(47,211,232,0.10)',
    amber: '#F0B429',
    amberSoft: 'rgba(240,180,41,0.66)',
    amberFaint: 'rgba(240,180,41,0.22)',
    white: '#F4F7F9',
    gray: '#8B98A1',
    graySoft: 'rgba(139,152,161,0.62)',
    grayFaint: 'rgba(139,152,161,0.28)'
  };
  var MONO = 'Consolas, "Cascadia Mono", ui-monospace, monospace';
  var HAN = '"Microsoft YaHei", "PingFang SC", sans-serif';

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function span(t, a, b) { return clamp01((t - a) / (b - a)); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function easeOut(k) { return 1 - Math.pow(1 - k, 3); }
  function easeInOut(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
  function rand(seed) { var x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }

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
    ctx.save();
    ctx.font = font(size, weight, han);
    ctx.letterSpacing = (spacing || 0) + 'px';
    var w = ctx.measureText(str).width;
    ctx.restore();
    return w;
  }
  function typed(str, k) { return str.slice(0, Math.round(str.length * clamp01(k))); }
  function rule(ctx, x1, y1, x2, y2, color, width, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.strokeStyle = color; ctx.lineWidth = width || 1;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();
  }
  function dot(ctx, x, y, r, color, glow, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.fillStyle = color;
    if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function bracket(ctx, x, y, w, h, color, l, width, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.strokeStyle = color; ctx.lineWidth = width || 1.5;
    l = l || 18;
    var pts = [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]];
    for (var i = 0; i < 4; i++) {
      var p = pts[i];
      ctx.beginPath(); ctx.moveTo(p[0] + p[2] * l, p[1]); ctx.lineTo(p[0], p[1]); ctx.lineTo(p[0], p[1] + p[3] * l); ctx.stroke();
    }
    ctx.restore();
  }

  // ---- 底层 -------------------------------------------------------------
  function drawGrid(ctx) {
    var step = 64;
    ctx.save();
    ctx.strokeStyle = P.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = 0.5; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (var y = 0.5; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    ctx.strokeStyle = P.grid2;
    ctx.beginPath();
    for (var x2 = 0.5; x2 < W; x2 += step * 5) { ctx.moveTo(x2, 0); ctx.lineTo(x2, H); }
    for (var y2 = 0.5; y2 < H; y2 += step * 5) { ctx.moveTo(0, y2); ctx.lineTo(W, y2); }
    ctx.stroke();
    ctx.restore();
  }
  function drawVignette(ctx) {
    var g = ctx.createRadialGradient(CX, CY, 260, CX, CY, 1200);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  function drawScanlines(ctx) {
    ctx.save(); ctx.globalAlpha = 0.035; ctx.fillStyle = '#fff';
    for (var y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    ctx.restore();
  }
  function drawGrain(ctx, frame) {
    ctx.save(); ctx.globalAlpha = 0.055; ctx.fillStyle = '#fff';
    for (var i = 0; i < 260; i++) {
      ctx.fillRect(rand(frame * 977 + i * 3.1) * W, rand(frame * 131 + i * 7.7) * H, 1.2, 1.2);
    }
    ctx.restore();
  }
  function drawSideRulers(ctx, t, alpha) {
    ctx.save(); ctx.globalAlpha = alpha;
    var y0 = 300, y1 = 780;
    rule(ctx, 54, y0, 54, y1, P.grayFaint, 1, 1);
    for (var y = y0; y < y1; y += 12) {
      var major = (y - y0) % 60 === 0;
      rule(ctx, 54, y, 54 + (major ? 12 : 5), y, major ? P.cyanFaint : P.grayFaint, 1, 1);
    }
    rule(ctx, W - 54, y0, W - 54, y1, P.grayFaint, 1, 1);
    for (var y2 = y0; y2 < y1; y2 += 12) {
      var major2 = (y2 - y0) % 60 === 0;
      rule(ctx, W - 54, y2, W - 54 - (major2 ? 12 : 5), y2, major2 ? P.cyanFaint : P.grayFaint, 1, 1);
    }
    // 纵向轨标
    var stepC = Math.floor((t * 30) % 3);
    for (var k = 0; k < 3; k++) {
      var yy = 320 + ((t * 40 + k * 140) % 420);
      dot(ctx, 54, yy, 1.5, P.cyan, 6, 0.7);
      dot(ctx, W - 54, yy, 1.5, P.cyan, 6, 0.7);
    }
    ctx.restore();
  }
  function drawHud(ctx, t, phase, alpha) {
    ctx.save(); ctx.globalAlpha = alpha;
    text(ctx, 'DEEPSEEK HARNESS', 96, 108, { size: 15, color: '#B9C6CE', spacing: 5 });
    text(ctx, 'BOOT SEQUENCE / JARVIS', 96, 130, { size: 11, color: P.graySoft, spacing: 4 });
    rule(ctx, 96, 142, 330, 142, P.cyanFaint, 1, 1);
    text(ctx, 'T+' + t.toFixed(2).padStart(5, '0') + 's', W - 96, 108, { size: 14, color: '#B9C6CE', spacing: 3, align: 'right' });
    text(ctx, 'FRAME ' + String(Math.round(t * 30)).padStart(4, '0') + ' · 30FPS', W - 96, 130, { size: 11, color: P.graySoft, spacing: 3, align: 'right' });
    rule(ctx, W - 300, 142, W - 96, 142, P.cyanFaint, 1, 1);
    text(ctx, 'WIN32 · DESKTOP PROFILE', 96, H - 86, { size: 11, color: P.graySoft, spacing: 4 });
    text(ctx, 'BUILD 0.2.2-rc.1', 96, H - 106, { size: 11, color: P.grayFaint, spacing: 4 });
    text(ctx, '[ SKIP ]  ESC', W - 96, H - 86, { size: 12, color: P.graySoft, spacing: 4, align: 'right' });
    text(ctx, String(phase).toUpperCase(), W - 96, H - 106, { size: 11, color: P.cyanFaint, spacing: 4, align: 'right' });
    ctx.restore();
  }

  // ---- 环系统 -----------------------------------------------------------
  function tickRing(ctx, cx, cy, r, prog, alpha, n, col) {
    n = n || 200;
    ctx.save();
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 - Math.PI / 2;
      var on = clamp01(prog * 1.35 - i / n) * 3;
      if (on <= 0) continue;
      var long = i % 10 === 0;
      var r1 = r + (long ? 16 : 8), r2 = r;
      ctx.globalAlpha = alpha * on;
      ctx.strokeStyle = long ? (col || P.cyanSoft) : P.graySoft;
      ctx.lineWidth = long ? 1.8 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }
    ctx.restore();
  }
  function arcSeg(ctx, cx, cy, r, start, end, color, w, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.strokeStyle = color; ctx.lineWidth = w || 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, start, end); ctx.stroke();
    ctx.restore();
  }
  function ringSystem(ctx, t, k, alpha) {
    var rot = t * 0.5;
    ctx.save(); ctx.globalAlpha = alpha;
    // 外圈装饰
    ctx.save();
    ctx.translate(CX, CY); ctx.rotate(-rot * 0.6);
    arcSeg(ctx, 0, 0, 560, -0.3, 0.9, P.cyanGhost, 2, 1);
    arcSeg(ctx, 0, 0, 560, 1.7, 2.6, P.cyanGhost, 2, 1);
    arcSeg(ctx, 0, 0, 560, 3.5, 4.4, P.cyanGhost, 2, 1);
    ctx.restore();
    // 四象限点
    for (var q = 0; q < 4; q++) {
      var qa = q * Math.PI / 2 + rot;
      dot(ctx, CX + Math.cos(qa) * 560, CY + Math.sin(qa) * 560, 2.5, P.cyan, 10, 0.8);
    }
    tickRing(ctx, CX, CY, 430, k, 1, 200);
    // 旋转辐条
    ctx.save();
    ctx.translate(CX, CY); ctx.rotate(rot * 0.4);
    for (var s = 0; s < 12; s++) {
      var sa = s * Math.PI / 6;
      rule(ctx, Math.cos(sa) * 350, Math.sin(sa) * 350, Math.cos(sa) * 392, Math.sin(sa) * 392, P.cyanFaint, 1, 0.9);
    }
    ctx.restore();
    for (var i = 0; i < 3; i++) {
      var p = clamp01((k - i * 0.16) / 0.5);
      if (p <= 0) continue;
      var a0 = -Math.PI / 2 + i * (Math.PI * 2 / 3);
      var sweep = (Math.PI * 2 / 3 - 0.24) * easeOut(p);
      arcSeg(ctx, CX, CY, 330 - i * 46, a0, a0 + sweep, P.cyan, 2.6, 0.95 * p);
      var ha = a0 + sweep;
      dot(ctx, CX + Math.cos(ha) * (330 - i * 46), CY + Math.sin(ha) * (330 - i * 46), 3.2, P.cyanHi, 18, p);
    }
    ctx.restore();
  }
  function crosshair(ctx, alpha, r, color) {
    ctx.save(); ctx.globalAlpha = alpha;
    var rr = r || 34;
    rule(ctx, CX - rr, CY, CX - 10, CY, color || P.cyanFaint, 1, 1);
    rule(ctx, CX + 10, CY, CX + rr, CY, color || P.cyanFaint, 1, 1);
    rule(ctx, CX, CY - rr, CX, CY - 10, color || P.cyanFaint, 1, 1);
    rule(ctx, CX, CY + 10, CX, CY + rr, color || P.cyanFaint, 1, 1);
    ctx.restore();
  }
  function coreGlow(ctx, r, alpha) {
    var g = ctx.createRadialGradient(CX, CY, 0, CX, CY, r);
    g.addColorStop(0, 'rgba(47,211,232,' + alpha + ')');
    g.addColorStop(0.5, 'rgba(47,211,232,' + alpha * 0.35 + ')');
    g.addColorStop(1, 'rgba(47,211,232,0)');
    ctx.save(); ctx.fillStyle = g; ctx.fillRect(CX - r, CY - r, r * 2, r * 2); ctx.restore();
  }

  // ---- act 0 -------------------------------------------------------------
  function act0(ctx, t) {
    var k = Math.sin(Math.PI * clamp01(t / 0.55));
    coreGlow(ctx, 200, 0.10 * k);
    dot(ctx, CX, CY, 2.8, P.cyan, 30 * k, 1);
    crosshair(ctx, 0.25 * k, 26);
  }

  // ---- act 1 -------------------------------------------------------------
  function act1(ctx, t) {
    var p = span(t, 0.55, 1.9);
    ringSystem(ctx, t, easeOut(p), 1);
    var ep = span(t, 0.95, 1.8);
    if (ep > 0) {
      var size = 116, sp = 28, y = CY + size * 0.34;
      var fullW = measure(ctx, 'DSH', size, 700, sp);
      var clipW = fullW * easeOut(ep);
      ctx.save();
      ctx.beginPath(); ctx.rect(CX - fullW / 2 - 10, CY - 170, clipW + 20, 340); ctx.clip();
      text(ctx, 'DSH', CX, y, { size: size, weight: 700, color: P.white, spacing: sp, align: 'center', shadow: 'rgba(47,211,232,0.55)', blur: 26 });
      ctx.restore();
      if (ep < 1) {
        var hx = CX - fullW / 2 + clipW;
        rule(ctx, hx, CY - 160, hx, CY + 160, P.cyanHi, 2.5, 1);
        dot(ctx, hx, CY, 4, P.cyanHi, 26, 1);
      }
      text(ctx, 'JUST A RATHER VERY INTELLIGENT SYSTEM', CX, CY + 104, { size: 12, color: P.cyanSoft, spacing: 7, align: 'center', alpha: span(t, 1.35, 1.75) });
      text(ctx, 'SYS · 001', CX - 470, CY - 300, { size: 11, color: P.grayFaint, spacing: 3, alpha: span(t, 0.9, 1.4) });
      text(ctx, 'SYS · 002', CX + 470, CY - 300, { size: 11, color: P.grayFaint, spacing: 3, align: 'right', alpha: span(t, 1.0, 1.5) });
    }
  }

  // ---- act 2 -------------------------------------------------------------
  function act2(ctx, t) {
    var q = span(t, 1.9, 3.3);
    ringSystem(ctx, t, 1, lerp(1, 0.42, easeOut(span(t, 1.9, 2.5))));
    var dshA = 1 - span(t, 1.9, 2.08);
    if (dshA > 0) text(ctx, 'DSH', CX, CY + 40, { size: 116, weight: 700, color: P.white, spacing: 28, align: 'center', alpha: dshA * 0.95 });
    crosshair(ctx, 0.35 + 0.2 * q, 26);

    var y = CY + 24;
    var lineW = 700 * easeOut(span(t, 1.95, 2.5));
    rule(ctx, CX - lineW, y - 104, CX + lineW, y - 104, P.grayFaint, 1, 1);
    rule(ctx, CX - lineW, y + 74, CX + lineW, y + 74, P.grayFaint, 1, 1);
    // 中轴光带
    var bandA = 0.07 * easeOut(span(t, 2.0, 2.4));
    var vg = ctx.createLinearGradient(0, y - 76, 0, y + 20);
    vg.addColorStop(0, 'rgba(47,211,232,0)');
    vg.addColorStop(0.5, 'rgba(47,211,232,' + bandA + ')');
    vg.addColorStop(1, 'rgba(47,211,232,0)');
    ctx.save(); ctx.fillStyle = vg; ctx.fillRect(CX - lineW, y - 76, lineW * 2, 96); ctx.restore();

    var parts = [
      { s: '[', c: P.cyanSoft, d: 0.02 },
      { s: '</', c: P.cyan, d: 0.10 },
      { s: 'DEEPSEEK ', c: P.white, d: 0.18 },
      { s: 'HARNESS', c: P.amber, d: 0.34 },
      { s: '//>', c: P.cyan, d: 0.62 },
      { s: ']', c: P.cyanSoft, d: 0.72 }
    ];
    var size = 66, sp = 7;
    var widths = parts.map(function (p) { return measure(ctx, p.s, size, 700, sp); });
    var total = widths.reduce(function (a, b) { return a + b; }, 0);
    var x = CX - total / 2;
    for (var i = 0; i < parts.length; i++) {
      var pp = parts[i];
      var p2 = span(t, 1.95 + pp.d, 1.95 + pp.d + 0.34);
      ctx.save();
      if (p2 < 1) { ctx.beginPath(); ctx.rect(x - 8, y - 64, widths[i] * clamp01(p2) + 8, 128); ctx.clip(); }
      text(ctx, pp.s, x, y, { size: size, weight: 700, color: pp.c, spacing: sp, alpha: 0.30 + 0.70 * clamp01(p2 * 2), shadow: pp.c === P.amber ? 'rgba(240,180,41,0.35)' : 'rgba(47,211,232,0.30)', blur: 16 });
      ctx.restore();
      if (p2 > 0 && p2 < 1) dot(ctx, x + widths[i] * clamp01(p2), y - 24, 2.4, pp.c, 14, 1);
      x += widths[i];
    }
    // 扫光
    var sweep = span(t, 2.62, 2.95);
    if (sweep > 0 && sweep < 1) {
      var sx = CX - total / 2 - 40 + (total + 80) * easeInOut(sweep);
      var sg2 = ctx.createRadialGradient(sx, y - 6, 0, sx, y - 6, 120);
      sg2.addColorStop(0, 'rgba(139,238,250,0.30)');
      sg2.addColorStop(0.4, 'rgba(47,211,232,0.14)');
      sg2.addColorStop(1, 'rgba(47,211,232,0)');
      ctx.save(); ctx.fillStyle = sg2; ctx.fillRect(sx - 120, y - 126, 240, 240); ctx.restore();
      rule(ctx, sx, y - 62, sx, y + 52, 'rgba(139,238,250,0.55)', 1.5, 1);
    }
    var sub = span(t, 2.55, 3.1);
    if (sub > 0) {
      var s = '深度求索  ·  DEEPSEEK  ·  v0.2.2-rc.1';
      text(ctx, typed(s, sub), CX, y + 50, { size: 21, color: P.gray, spacing: 9, align: 'center', han: true, alpha: 0.95 });
    }
    var footA = span(t, 2.75, 3.15);
    if (footA > 0) {
      text(ctx, 'BUILD 0.2.2-rc.1', CX - 640, y + 138, { size: 11, color: P.graySoft, spacing: 3, alpha: footA });
      text(ctx, 'PROFILE desktop', CX - 430, y + 138, { size: 11, color: P.graySoft, spacing: 3, alpha: footA });
      text(ctx, 'PLATFORM win32', CX + 380, y + 138, { size: 11, color: P.graySoft, spacing: 3, alpha: footA });
      text(ctx, 'RUNTIME 0.2.2', CX + 600, y + 138, { size: 11, color: P.graySoft, spacing: 3, alpha: footA });
    }
  }

  // ---- act 3 -------------------------------------------------------------
  var FACTS = [
    { k: 'PROFILE', v: 'desktop', n: null },
    { k: 'MODEL', v: 'deepseek-flash · high', n: null },
    { k: 'BUNDLES', v: '06', n: 6 },
    { k: 'SKILLS', v: '17', n: 17 },
    { k: 'SANDBOX', v: 'full-access', n: null },
    { k: 'SESSION', v: '001', n: 1 }
  ];
  function act3(ctx, t) {
    var up = easeOut(span(t, 3.3, 3.75));
    var y0 = lerp(CY + 24, 300, up);
    var sc = lerp(1, 0.66, up);
    ctx.save();
    ctx.translate(CX, y0); ctx.scale(sc, sc); ctx.translate(-CX, 0);
    var size = 66, sp = 7;
    var parts = [{ s: '[ </', c: P.cyan }, { s: 'DEEPSEEK ', c: P.white }, { s: 'HARNESS', c: P.amber }, { s: '//> ]', c: P.cyan }];
    var widths = parts.map(function (p) { return measure(ctx, p.s, size, 700, sp); });
    var total = widths.reduce(function (a, b) { return a + b; }, 0);
    var x = CX - total / 2;
    for (var i = 0; i < parts.length; i++) {
      text(ctx, parts[i].s, x, 0, { size: size, weight: 700, color: parts[i].c, spacing: sp, shadow: 'rgba(47,211,232,0.22)', blur: 14 });
      x += widths[i];
    }
    rule(ctx, CX - 380, 34, CX + 380, 34, P.cyanGhost, 1, 1);
    ctx.restore();

    var left = 440, right = 1290;
    for (var j = 0; j < FACTS.length; j++) {
      var f = FACTS[j];
      var ap = span(t, 3.5 + j * 0.16, 3.86 + j * 0.16);
      if (ap <= 0) continue;
      var ry = 430 + j * 58;
      // 行高亮扫过
      var hl = span(t, 3.5 + j * 0.16, 3.95 + j * 0.16);
      if (hl > 0 && hl < 1) {
        var hx1 = left - 20, hx2 = right + 180;
        var hg = ctx.createLinearGradient(hx1, 0, hx2, 0);
        hg.addColorStop(0, 'rgba(47,211,232,0)');
        hg.addColorStop(0.5, 'rgba(47,211,232,' + (0.10 * (1 - hl)) + ')');
        hg.addColorStop(1, 'rgba(47,211,232,0)');
        ctx.save(); ctx.fillStyle = hg; ctx.fillRect(hx1, ry - 30, hx2 - hx1, 50); ctx.restore();
      }
      rule(ctx, left, ry + 18, left + (right - left) * easeOut(ap), ry + 18, 'rgba(255,255,255,0.10)', 1, 1);
      text(ctx, '[ ' + String(j + 1).padStart(2, '0') + ' ]', left, ry, { size: 12, color: P.cyanSoft, spacing: 2, alpha: ap });
      text(ctx, f.k, left + 74, ry, { size: 20, color: P.white, spacing: 6, alpha: ap });
      ctx.save();
      ctx.globalAlpha = ap * 0.55; ctx.fillStyle = P.graySoft;
      for (var d = 0; d < 250; d += 7) ctx.fillRect(left + 360 + d, ry - 6, 2, 1.6);
      ctx.restore();
      var numK = easeOut(span(t, 3.6 + j * 0.16, 4.0 + j * 0.16));
      var val = f.n === null ? f.v : (f.n === 1 ? '001' : String(Math.round(f.n * numK)).padStart(2, '0'));
      text(ctx, val, right, ry, { size: 20, color: P.cyanHi, spacing: 4, align: 'right', alpha: ap, shadow: P.cyan, blur: 14 });
      // 示波
      for (var b = 0; b < 10; b++) {
        var hh = 6 + 22 * Math.abs(Math.sin(j * 1.7 + b * 0.9 + t * 2.4)) * ap;
        ctx.save(); ctx.globalAlpha = ap * 0.85; ctx.fillStyle = b % 3 === 0 ? P.amberSoft : P.cyanSoft;
        ctx.fillRect(right + 26 + b * 9, ry - hh, 3, hh); ctx.restore();
      }
      text(ctx, 'OK', right + 132, ry, { size: 11, color: P.amber, spacing: 2, alpha: ap * span(t, 3.7 + j * 0.16, 4.0 + j * 0.16) });
    }
    var doneA = span(t, 4.95, 5.3);
    if (doneA > 0) {
      text(ctx, 'SYSTEM CHECK  06/06  PASSED', CX, 800, { size: 14, color: P.cyanHi, spacing: 8, align: 'center', alpha: doneA, shadow: P.cyan, blur: 12 });
      rule(ctx, CX - 230, 818, CX - 230 + 460 * easeOut(doneA), 818, P.cyanFaint, 1, 1);
    }
  }

  // ---- act 4 -------------------------------------------------------------
  function act4(ctx, t) {
    var s = span(t, 5.4, 6.9);
    var sy = lerp(-90, H + 90, easeInOut(span(t, 5.35, 5.95)));
    if (t < 6.05) {
      var g = ctx.createLinearGradient(0, sy - 170, 0, sy);
      g.addColorStop(0, 'rgba(47,211,232,0)');
      g.addColorStop(1, 'rgba(47,211,232,0.18)');
      ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, sy - 170, W, 170);
      rule(ctx, 0, sy, W, sy, P.cyanHi, 2, 0.95);
      ctx.globalAlpha = 0.5; rule(ctx, 0, sy - 6, W, sy - 6, P.cyan, 1, 0.5);
      ctx.restore();
    }
    var col = easeInOut(span(t, 5.6, 6.25));
    if (col < 1) {
      ringSystem(ctx, t, 1, (1 - col) * 0.85);
      var rr = lerp(330, 0, col);
      if (rr > 1) arcSeg(ctx, CX, CY, rr, 0, Math.PI * 2, P.cyanSoft, 2, 0.7 * (1 - col));
    } else {
      arcSeg(ctx, CX, CY, 330, 0, Math.PI * 2, P.cyanGhost, 1.5, 0.55);
      tickRing(ctx, CX, CY, 352, 1, 0.35, 90);
    }
    crosshair(ctx, 0.55, 40);
    var st = span(t, 6.05, 6.75);
    if (st > 0) {
      var spc = lerp(46, 12, easeOut(st));
      text(ctx, 'SYSTEM ONLINE', CX, CY + 16, { size: 78, weight: 700, color: P.white, spacing: spc, align: 'center', alpha: easeOut(st), shadow: 'rgba(47,211,232,0.45)', blur: 30 });
      if (st < 0.92) {
        var off = (1 - st) * 12;
        text(ctx, 'SYSTEM ONLINE', CX - off, CY + 16, { size: 78, weight: 700, color: 'rgba(47,211,232,0.32)', spacing: spc, align: 'center' });
        text(ctx, 'SYSTEM ONLINE', CX + off, CY + 16, { size: 78, weight: 700, color: 'rgba(240,180,41,0.28)', spacing: spc, align: 'center' });
      }
      var rw = 470 * easeOut(st);
      rule(ctx, CX - rw, CY + 66, CX + rw, CY + 66, P.cyanFaint, 1, 1);
      text(ctx, 'ACCESS LEVEL 3  ·  JARVIS', CX, CY + 108, { size: 14, color: P.amber, spacing: 9, align: 'center', alpha: span(t, 6.35, 6.8) });
      text(ctx, 'AWAITING OPERATOR', CX, CY + 136, { size: 10, color: P.gray, spacing: 6, align: 'center', alpha: span(t, 6.45, 6.75) });
    }
    dot(ctx, CX, CY, 3.5, P.white, 34, clamp01(st));
    var bA = span(t, 6.2, 6.8);
    if (bA > 0) {
      for (var i = 0; i < 22; i++) {
        var hh = 8 + 26 * Math.abs(Math.sin(i * 0.7 + t * 3)) * bA;
        ctx.save(); ctx.globalAlpha = 0.62 * bA; ctx.fillStyle = i % 5 === 0 ? P.amberSoft : P.cyanSoft;
        ctx.fillRect(CX - 806 + i * 13, CY - hh / 2, 7, hh);
        ctx.fillRect(CX + 620 + i * 13, CY - hh / 2, 7, hh);
        ctx.restore();
      }
    }
    var pulse = span(t, 6.35, 6.9);
    if (pulse > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5 * (1 - pulse);
      arcSeg(ctx, CX, CY, 330 + 380 * easeOut(pulse), 0, Math.PI * 2, P.cyanSoft, 1.5, 0.6 * (1 - pulse));
      ctx.restore();
    }
  }

  // ---- act 5 -------------------------------------------------------------
  function envAt(t) {
    var bumps = [[7.02, .5], [7.20, .95], [7.42, .85], [7.63, .75], [7.86, 1.0], [8.06, .9], [8.24, .62]];
    var v = 0;
    for (var i = 0; i < bumps.length; i++) {
      var d = (t - bumps[i][0]) / 0.13;
      v = Math.max(v, bumps[i][1] * Math.exp(-d * d));
    }
    return clamp01(v);
  }
  function act5(ctx, t) {
    var env = envAt(t);
    var dim = 1 - 0.75 * span(t, 6.9, 7.25);
    rule(ctx, CX - 300, CY - 236, CX + 300, CY - 236, P.grayFaint, 1, dim);
    rule(ctx, CX - 300, CY + 236, CX + 300, CY + 236, P.grayFaint, 1, dim);
    coreGlow(ctx, 300 + 120 * env, 0.07 + 0.12 * env);
    dot(ctx, CX, CY, 3.5 + 2.5 * env, P.white, 26 + 46 * env, 0.95);
    // 外环旋转
    ctx.save(); ctx.translate(CX, CY); ctx.rotate(t * 0.7);
    for (var q = 0; q < 4; q++) {
      var qa = q * Math.PI / 2;
      arcSeg(ctx, 0, 0, 236, qa, qa + 0.55, P.cyanFaint, 1.5, 0.9);
    }
    ctx.restore();
    // 语音环（64 根辐条）
    for (var i = 0; i < 64; i++) {
      var a = (i / 64) * Math.PI * 2 - Math.PI / 2;
      var len = 8 + 34 * Math.abs(Math.sin(i * 0.83 + 1.4)) * env;
      ctx.save();
      ctx.globalAlpha = 0.28 + 0.62 * env;
      ctx.strokeStyle = i % 8 === 0 ? P.amberSoft : P.cyanSoft;
      ctx.lineWidth = i % 8 === 0 ? 2.4 : 1.4;
      ctx.beginPath();
      ctx.moveTo(CX + Math.cos(a) * 150, CY + Math.sin(a) * 150);
      ctx.lineTo(CX + Math.cos(a) * (150 + len), CY + Math.sin(a) * (150 + len));
      ctx.stroke();
      ctx.restore();
    }
    arcSeg(ctx, CX, CY, 150, 0, Math.PI * 2, P.cyanGhost, 1, 1);
    // 音频电平条（置于中心下方，避开字幕带）
    for (var b = 0; b < 30; b++) {
      var lv = Math.abs(Math.sin(b * 0.7 + 0.6)) * env;
      var hh = 3 + 16 * lv;
      ctx.save(); ctx.globalAlpha = 0.30 + 0.45 * env; ctx.fillStyle = b % 5 === 0 ? P.amberSoft : P.cyanFaint;
      ctx.fillRect(CX - 15 * 8 + b * 8, CY + 196 - hh, 3, hh);
      ctx.restore();
    }
    // 字幕
    var barY = 800;
    var lineW = 430 * easeOut(span(t, 6.95, 7.3));
    rule(ctx, CX - lineW, barY + 44, CX + lineW, barY + 44, P.cyanFaint, 1, 1);
    text(ctx, 'VOICE LINK  ·  ESTABLISHED', CX, barY - 30, { size: 11, color: P.graySoft, spacing: 6, align: 'center', alpha: span(t, 7.0, 7.3) });
    var say = typed('Welcome home, Sir.', span(t, 7.05, 8.35));
    text(ctx, say, CX, barY + 10, { size: 44, color: P.white, spacing: 4, align: 'center', shadow: 'rgba(47,211,232,0.35)', blur: 22 });
    if (t > 7.0) {
      var cursorOn = Math.floor(t * 4) % 2 === 0;
      if (cursorOn) {
        var w = measure(ctx, say, 44, 400, 4);
        ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = P.cyan; ctx.fillRect(CX + w / 2 + 10, barY - 22, 3, 36); ctx.restore();
      }
    }
    text(ctx, '欢迎回家，先生', CX, barY + 66, { size: 16, color: P.graySoft, spacing: 8, align: 'center', han: true, alpha: span(t, 7.9, 8.4) });
    bracket(ctx, CX - 300, barY - 56, 600, 120, P.cyanGhost, 14, 1, span(t, 7.0, 7.4) * 0.8);
  }

  // ---- act 6 -------------------------------------------------------------
  function act6(ctx, t) {
    var v = span(t, 8.6, 10.2);
    var flash = Math.exp(-Math.pow((t - 8.72) / 0.11, 2));
    coreGlow(ctx, 460 * (0.4 + v), 0.16 * (1 - v));
    dot(ctx, CX, CY, 3 + 46 * flash, P.white, 70 * flash, 1);
    var gp = easeOut(span(t, 8.7, 9.7));
    ctx.save();
    for (var i = 1; i <= 14; i++) {
      var rr = lerp(0, 1400, gp) * (i / 14);
      ctx.globalAlpha = (0.4 * (1 - i / 16)) * (1 - span(t, 9.6, 10.2));
      ctx.strokeStyle = P.cyanFaint; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(CX, CY, rr, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
    // 竖向帘线
    var cA = span(t, 8.75, 9.7);
    if (cA > 0) {
      for (var k = 0; k < 22; k++) {
        var x = 120 + k * 78;
        var hh = 400 * cA * (0.4 + 0.6 * rand(k * 3.7));
        ctx.save(); ctx.globalAlpha = 0.35 * (1 - span(t, 9.7, 10.2)); ctx.strokeStyle = P.cyanFaint; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, CY + 240); ctx.lineTo(x, CY + 240 - hh); ctx.stroke();
        ctx.restore();
      }
    }
    var wy = lerp(0, H, easeInOut(span(t, 8.85, 9.5)));
    if (t > 8.85 && t < 9.6) {
      var gg = ctx.createLinearGradient(0, wy - 260, 0, wy);
      gg.addColorStop(0, 'rgba(47,211,232,0)');
      gg.addColorStop(1, 'rgba(47,211,232,0.13)');
      ctx.save(); ctx.fillStyle = gg; ctx.fillRect(0, wy - 260, W, 260);
      rule(ctx, 0, wy, W, wy, P.cyanHi, 2, 0.85); ctx.restore();
    }
    var endA = span(t, 9.3, 9.9) * (1 - span(t, 9.95, 10.2));
    text(ctx, 'DEEPSEEK HARNESS', CX, CY + 10, { size: 30, weight: 700, color: P.white, spacing: 16, align: 'center', alpha: endA, shadow: 'rgba(47,211,232,0.3)', blur: 16 });
    text(ctx, '欢迎回来', CX, CY + 52, { size: 15, color: P.gray, spacing: 10, align: 'center', han: true, alpha: endA });
    text(ctx, 'HANDOFF → WORKSPACE', CX, H - 210, { size: 11, color: P.grayFaint, spacing: 7, align: 'center', alpha: span(t, 9.5, 9.9) * (1 - span(t, 10.0, 10.2)) });
  }

  var PHASES = ['IGNITION', 'RING LOCK', 'WORDMARK ASSEMBLY', 'SYSTEM CHECK', 'ONLINE', 'VOICE', 'HANDOFF'];
  function phaseAt(t) {
    if (t < 0.55) return 0; if (t < 1.9) return 1; if (t < 3.3) return 2;
    if (t < 5.4) return 3; if (t < 6.9) return 4; if (t < 8.6) return 5; return 6;
  }

  function render(ctx, t) {
    t = Math.max(0, Math.min(DUR, t));
    var frame = Math.round(t * 30);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    var chrome = span(t, 0.12, 1.0);
    ctx.save(); ctx.globalAlpha = chrome; drawGrid(ctx); ctx.restore();
    drawVignette(ctx);
    var ph = phaseAt(t);
    if (ph === 0) act0(ctx, t);
    else if (ph === 1) act1(ctx, t);
    else if (ph === 2) act2(ctx, t);
    else if (ph === 3) act3(ctx, t);
    else if (ph === 4) act4(ctx, t);
    else if (ph === 5) act5(ctx, t);
    else act6(ctx, t);
    ctx.save(); ctx.globalAlpha = chrome; drawSideRulers(ctx, t, 1); ctx.restore();
    drawHud(ctx, t, PHASES[ph], chrome);
    drawScanlines(ctx);
    drawGrain(ctx, frame);
    var edge = Math.min(span(t, 0, 0.12), 1 - span(t, 10.02, DUR));
    if (edge < 1) { ctx.save(); ctx.globalAlpha = 1 - edge; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  }

  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d');
  var api = { duration: DUR, fps: 30, width: W, height: H, ready: false, seek: function (t) { render(ctx, t); } };
  window.__jarvis = api;
  api.seek(0);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { api.seek(0); api.ready = true; });
  else { api.ready = true; }
})();
