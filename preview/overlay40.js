/* ============================================================================
 * JARVIS 启动层 v0.4 —— 叠加在用户自剪成片之上
 *  · 无字幕：人声段改为声纹/频谱可视化
 *  · 第一幕钢铁侠：反应堆跟踪 + 能量环/光束/锁定/扫描/flare/粒子/数据标签
 *  · 全片 HUD 体系：Corner frame / Panel / Ticker + decode/count/stamp 动效
 *  · 30.20s 起：分层退场 + 白场过曝 + 扫描线 + 界面显影
 * 绘制定稿为 t 的纯函数（seek(t) 同步），数据来自 window.__DRIVE__
 * ========================================================================== */
(function () {
  'use strict';
  var W = 1920, H = 1080, CX = 960;
  var DUR = 31.0333, HANDOFF = 30.20, SLAM = 25.86;
  var D = window.__DRIVE__ || { rms: [], low: [], track: [], voice: [], jumps: [], impact: 25.857 };

  var C = {
    cyan: '#2FD3E8', cyanHi: '#8BEEFA', cyanSoft: 'rgba(47,211,232,0.62)', cyanFaint: 'rgba(47,211,232,0.22)',
    amber: '#F0B429', amberSoft: 'rgba(240,180,41,0.66)', orange: '#FF6A2A', orangeSoft: 'rgba(255,106,42,0.55)',
    white: '#F4F7F9', gray: '#9AA7AF', graySoft: 'rgba(154,167,175,0.62)', grayFaint: 'rgba(154,167,175,0.26)'
  };
  var MONO = 'Consolas, "Cascadia Mono", ui-monospace, monospace';
  var HAN = '"Microsoft YaHei", "PingFang SC", sans-serif';
  var GLYPHS = '01#%&*+=/\\<>[]{}ABCDEFXZ$@'.split('');

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function span(t, a, b) { return b <= a ? (t >= a ? 1 : 0) : clamp01((t - a) / (b - a)); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function easeOut(k) { return 1 - Math.pow(1 - k, 3); }
  function easeInOut(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
  function rand(s) { var x = Math.sin(s * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
  function gauss(t, c, w) { return Math.exp(-Math.pow((t - c) / w, 2)); }
  function font(size, weight, han) { return (weight || 400) + ' ' + size + 'px ' + (han ? HAN : MONO); }
  function text(ctx, str, x, y, o) {
    o = o || {}; ctx.save();
    ctx.font = font(o.size || 16, o.weight || 400, o.han);
    ctx.fillStyle = o.color || C.white;
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
  function panel(ctx, x, y, w, h, a) {
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,' + a + ')'; ctx.fillRect(x, y, w, h); ctx.restore();
  }
  function decode(str, p, seed) {
    var n = Math.floor(str.length * clamp01(p)), out = '';
    for (var i = 0; i < str.length; i++) {
      if (i < n || str[i] === ' ') out += str[i];
      else out += GLYPHS[Math.floor(rand(seed + i * 1.7) * GLYPHS.length)];
    }
    return out;
  }
  function glow(ctx, x, y, r, color, alpha) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color.replace('ALPHA', alpha.toFixed(3)));
    g.addColorStop(0.45, color.replace('ALPHA', (alpha * 0.35).toFixed(3)));
    g.addColorStop(1, color.replace('ALPHA', '0'));
    ctx.save(); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
  }
  function rgbSplitText(ctx, str, x, y, size, spacing, alpha, off) {
    text(ctx, str, x - off, y, { size: size, weight: 700, color: 'rgba(47,211,232,0.5)', spacing: spacing, align: 'center', alpha: alpha });
    text(ctx, str, x + off, y, { size: size, weight: 700, color: 'rgba(255,106,42,0.42)', spacing: spacing, align: 'center', alpha: alpha });
    text(ctx, str, x, y, { size: size, weight: 700, color: C.white, spacing: spacing, align: 'center', alpha: alpha });
  }

  // ---------- 数据访问 ----------
  function rmsAt(t) {
    var i = Math.max(0, Math.min(D.rms.length - 1, Math.round(t * D.fps)));
    return clamp01((D.rms[i] + 58) / 54);
  }
  function lowAt(t) {
    var i = Math.max(0, Math.min(D.low.length - 1, Math.round(t * D.fps)));
    return clamp01(D.low[i]);
  }
  function trackAt(t) {
    var p = D.track; if (!p.length) return { x: 0.51, y: 0.79, r: 0.03 };
    var i = Math.max(0, Math.min(p.length - 1, Math.floor(t * 30)));
    var q = p[Math.min(p.length - 1, i + 1)];
    var a = p[i], k = clamp01(t * 30 - i);
    return { x: lerp(a[0], q[0], k), y: lerp(a[1], q[1], k), r: lerp(a[2], q[2], k) };
  }
  function jumpFlash(t, w) {
    var v = 0;
    for (var i = 0; i < D.jumps.length; i++) {
      var j = D.jumps[i]; if (Math.abs(j[1]) < 12) continue;
      v = Math.max(v, gauss(t, j[0], w || 0.10) * clamp01(Math.abs(j[1]) / 34));
    }
    return v;
  }

  // ---------- HUD 骨架 ----------
  function hudFrame(ctx, t, a) {
    var m = 64, L = 34, k = span(t, 0.15, 0.9);
    ctx.save(); ctx.globalAlpha = a * k;
    ctx.strokeStyle = 'rgba(255,255,255,0.42)'; ctx.lineWidth = 1.4;
    var corners = [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]];
    for (var i = 0; i < corners.length; i++) {
      var c = corners[i], ex = c[0] + c[2] * L * easeOut(k), ey = c[1] + c[3] * L * easeOut(k);
      ctx.beginPath(); ctx.moveTo(ex, c[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(c[0], ey); ctx.stroke();
      // 分段刻度
      for (var s = 1; s <= 2; s++) {
        var px = c[0] + c[2] * (L + s * 26), py = c[1] + c[3] * (L + s * 26);
        rule(ctx, px, c[1], px + c[2] * 8, c[1], i < 2 ? C.cyanFaint : C.grayFaint, 1, 0.7);
        rule(ctx, c[0], py, c[0], py + c[3] * 8, i % 2 === 0 ? C.cyanFaint : C.grayFaint, 1, 0.7);
      }
    }
    ctx.restore();
  }

  function hudTopLeft(ctx, t, a) {
    var k = span(t, 0.2, 0.8);
    text(ctx, 'DEEPSEEK HARNESS', 96, 104, { size: 14, color: 'rgba(226,236,242,0.9)', spacing: 5, alpha: a * k });
    text(ctx, 'BOOT SEQUENCE / JARVIS', 96, 124, { size: 10, color: C.graySoft, spacing: 4, alpha: a * k });
    var names = ['KERNEL', 'VOICE', 'MODEL'];
    for (var i = 0; i < 3; i++) {
      var on = (i === 0 && t > 0.8) || (i === 1 && t > 2.5) || (i === 2 && t > 11.2);
      var blink = on && Math.floor(t * 2) % 2 === 0 ? 1 : on ? 0.45 : 0.12;
      ctx.save(); ctx.globalAlpha = a * k * blink;
      ctx.fillStyle = on ? C.cyan : C.grayFaint;
      ctx.fillRect(96 + i * 92, 138, 5, 5);
      ctx.restore();
      text(ctx, names[i], 106 + i * 92, 144, { size: 9, color: on ? C.cyanSoft : C.grayFaint, spacing: 2, alpha: a * k });
    }
  }

  function hudTopRight(ctx, t, a) {
    var k = span(t, 0.2, 0.8);
    text(ctx, 'T+' + t.toFixed(2).padStart(5, '0') + 's', W - 96, 104, { size: 13, color: 'rgba(226,236,242,0.85)', spacing: 3, align: 'right', alpha: a * k });
    text(ctx, 'FRAME ' + String(Math.round(t * 30)).padStart(4, '0') + ' · 30FPS', W - 96, 124, { size: 10, color: C.graySoft, spacing: 3, align: 'right', alpha: a * k });
    var cpu = 12 + 6 * Math.abs(Math.sin(t * 1.7)), mem = 38 + 4 * Math.abs(Math.sin(t * 0.9 + 1));
    text(ctx, 'CPU ' + cpu.toFixed(1) + '%  ·  MEM ' + mem.toFixed(1) + '%', W - 96, 144, { size: 9, color: C.grayFaint, spacing: 3, align: 'right', alpha: a * k });
  }

  function hudBottom(ctx, t, a, stage) {
    var k = span(t, 0.3, 1.0);
    text(ctx, 'BUILD 0.2.2-rc.1  ·  PROFILE desktop', 96, H - 84, { size: 10, color: C.graySoft, spacing: 4, alpha: a * k });
    text(ctx, 'ACT ' + stage + ' / 06  ·  ' + Math.round(clamp01(t / DUR) * 100) + '%', 96, H - 104, { size: 9, color: C.cyanFaint, spacing: 4, alpha: a * k });
    if (t > 3.0) text(ctx, '[ SKIP ]  ESC', W - 96, H - 84, { size: 11, color: C.graySoft, spacing: 4, align: 'right', alpha: a * clamp01((t - 3) / 0.6) });
    var p = clamp01(t / HANDOFF);
    ctx.save(); ctx.globalAlpha = a * k * 0.8; ctx.fillStyle = C.cyanFaint;
    ctx.fillRect(0, H - 2, W * p, 2); ctx.restore();
  }

  var TICKS = [
    [0.9, 'KERNEL LINK OK', 'kernel/0x00'],
    [1.8, 'POWER BUS 100%', 'pwr/rail-a'],
    [2.6, 'VOICE LINK ESTABLISHED', 'voice/001'],
    [7.2, 'SESSION HANDSHAKE OK', 'sess/001'],
    [11.3, 'CORE BUNDLES LOADED 06', 'core/bundles'],
    [13.5, 'WORKSPACE SYNC OK', 'ws/sync'],
    [19.5, 'SKILLS INDEXED 17', 'skills/index'],
    [23.8, 'SYSTEM CHECK 06/06 PASSED', 'check/all'],
    [26.1, 'SYSTEM READY · ACCESS 03', 'state/ready'],
    [30.3, 'HANDOFF → WORKSPACE', 'state/handoff']
  ];
  function hudTicker(ctx, t, a) {
    var idx = -1;
    for (var i = 0; i < TICKS.length; i++) if (t >= TICKS[i][0]) idx = i;
    if (idx < 0) return;
    var cur = TICKS[idx], prev = TICKS[idx - 1];
    var p = span(t, cur[0], cur[0] + 0.16);
    var yy = H - 152;
    if (prev) text(ctx, prev[2] + '  ' + prev[1], 96, yy - 18, { size: 9, color: C.grayFaint, spacing: 3, alpha: a * 0.6 * (1 - p) });
    text(ctx, '> ' + decode(cur[1], p, t * 11), 96, yy, { size: 10, color: C.cyanSoft, spacing: 4, alpha: a * 0.9 });
  }

  // ---------- 第一幕：钢铁侠 VFX ----------
  function actSuit(ctx, t) {
    var tr = trackAt(t), rx = tr.x * W, ry = tr.y * H - 26, rr = Math.max(64, tr.r * W * 2.2);
    var pulse = 0.55 + 0.45 * Math.max(
      gauss(t, 0.62, 0.10), gauss(t, 1.22, 0.10), gauss(t, 1.82, 0.10), gauss(t, 2.40, 0.08)
    );
    var master = span(t, 0.05, 0.5) * (1 - span(t, 2.95, 3.2));
    var I = 0.65; // 中等强度

    // 1) 反应堆辉光（暖橙 + 青双色，呼应装甲）
    glow(ctx, rx, ry, rr * 2.6 * pulse, 'rgba(255,106,42,ALPHA)', 0.22 * I * master * pulse);
    glow(ctx, rx, ry, rr * 1.4 * pulse, 'rgba(139,238,250,ALPHA)', 0.30 * I * master * pulse);
    ctx.save(); ctx.globalAlpha = master * 0.8;
    ctx.fillStyle = 'rgba(255,240,220,' + (0.55 * pulse * I) + ')';
    ctx.beginPath(); ctx.arc(rx, ry, rr * 0.24 * (0.8 + 0.3 * pulse), 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 2) 能量环外扩（每 0.7s 一圈）
    for (var i = 0; i < 3; i++) {
      var ph = (t - 0.35 - i * 0.7) / 2.1;
      if (ph < 0 || ph > 1) continue;
      var r = lerp(rr * 0.4, rr * 5.4, easeOut(ph));
      ctx.save(); ctx.globalAlpha = (1 - ph) * 0.5 * master * I;
      ctx.strokeStyle = i % 2 === 0 ? C.cyan : C.orange; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(rx, ry, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }

    // 3) 径向光束
    ctx.save(); ctx.globalAlpha = master * 0.35 * I; ctx.strokeStyle = C.cyanSoft; ctx.lineWidth = 1;
    for (var b = 0; b < 8; b++) {
      var ang = b * Math.PI / 4 + t * 0.12;
      var l0 = rr * (0.5 + 0.15 * pulse), l1 = l0 + 60 + 120 * pulse * (0.6 + 0.4 * rand(b + 3));
      ctx.beginPath();
      ctx.moveTo(rx + Math.cos(ang) * l0, ry + Math.sin(ang) * l0);
      ctx.lineTo(rx + Math.cos(ang) * l1, ry + Math.sin(ang) * l1); ctx.stroke();
    }
    ctx.restore();

    // 4) 锁定框（0.4–1.2s 从四角飞向反应堆）
    var lock = easeOut(span(t, 0.4, 1.2));
    if (lock > 0) {
      ctx.save(); ctx.globalAlpha = master;
      var spread = lerp(680, rr * 1.35, lock);
      var lw = 46, col = lock >= 1 ? C.cyanHi : C.cyan;
      var pts = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      for (var q = 0; q < 4; q++) {
        var ox = pts[q][0] * spread, oy = pts[q][1] * spread * 0.78;
        var jx = lock >= 1 ? (rand(Math.floor(t * 30) + q) - 0.5) * 2 : 0;
        ctx.strokeStyle = col; ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(rx + ox - pts[q][0] * lw + jx, ry + oy);
        ctx.lineTo(rx + ox + jx, ry + oy);
        ctx.lineTo(rx + ox + jx, ry + oy - pts[q][1] * lw);
        ctx.stroke();
      }
      if (lock >= 1) {
        text(ctx, 'TARGET LOCKED', rx, ry + spread * 0.78 + 34, { size: 11, color: C.cyanHi, spacing: 6, align: 'center', alpha: master * 0.9 });
        text(ctx, 'ARC REACTOR  ·  STABLE', rx, ry + spread * 0.78 + 52, { size: 9, color: C.graySoft, spacing: 4, align: 'center', alpha: master * 0.8 });
      }
      ctx.restore();
    }

    // 5) 装甲扫描（1.5–2.6s）
    var sp = span(t, 1.5, 2.6);
    if (sp > 0 && sp < 1) {
      var sy = lerp(H * 0.98, H * 0.10, easeInOut(sp));
      var g = ctx.createLinearGradient(0, sy - 180, 0, sy);
      g.addColorStop(0, 'rgba(47,211,232,0)'); g.addColorStop(1, 'rgba(47,211,232,0.16)');
      ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, sy - 180, W, 180);
      rule(ctx, 0, sy, W, sy, C.cyanHi, 1.6, 0.8 * master);
      // 扫描区 wireframe
      ctx.globalAlpha = 0.10 * master; ctx.strokeStyle = C.cyan;
      for (var gx = 0; gx < W; gx += 96) { ctx.beginPath(); ctx.moveTo(gx, sy); ctx.lineTo(gx, sy - 120); ctx.stroke(); }
      ctx.restore();
    }

    // 6) 目镜 flare（0.8/1.6/2.4）
    var fl = Math.max(gauss(t, 0.82, 0.07), gauss(t, 1.62, 0.07), gauss(t, 2.42, 0.06));
    if (fl > 0.02) {
      glow(ctx, W * 0.545, H * 0.205, 130 * fl, 'rgba(255,214,150,ALPHA)', 0.5 * fl * master);
      var off = 2.2 * fl;
      ctx.save(); ctx.globalAlpha = 0.5 * fl * master; ctx.fillStyle = C.cyanHi;
      ctx.fillRect(W * 0.47, H * 0.20, 150, 2); ctx.restore();
      rule(ctx, W * 0.47 + off, H * 0.215, W * 0.62 + off, H * 0.215, C.amber, 1, 0.4 * fl);
    }

    // 7) 粒子
    for (var p = 0; p < 40; p++) {
      var seed = p * 3.7;
      var px = rand(seed) * W;
      var spd = (10 + 30 * rand(seed + 1)) * (0.6 + 0.8 * pulse);
      var py = ((rand(seed + 2) * H) - (t * spd)) % H; if (py < 0) py += H;
      var toward = 1 - clamp01(Math.hypot(px - rx, py - ry) / 700);
      px = lerp(px, rx, toward * 0.18 * pulse);
      ctx.save(); ctx.globalAlpha = (0.10 + 0.35 * rand(seed + 4)) * master;
      ctx.fillStyle = p % 5 === 0 ? C.orangeSoft : C.cyanSoft;
      ctx.fillRect(px, py, 1.6, 1.6); ctx.restore();
    }

    // 8) 漂浮数据标签
    var LABELS = [
      ['ARC OUT', '3.24 GJ/s', 0.16, 0.36], ['CORE TEMP', '89.07°', 0.80, 0.30],
      ['PWR', '100%', 0.72, 0.52], ['FIELD', '2.15 T', 0.20, 0.58],
      ['NOISE', '63 Hz', 0.14, 0.70], ['SYNC', '0x9F3', 0.84, 0.72]
    ];
    for (var L = 0; L < LABELS.length; L++) {
      var lb = LABELS[L];
      var appear = span(t, 0.9 + L * 0.18, 1.25 + L * 0.18);
      if (appear <= 0) continue;
      var lx = lb[2] * W + Math.sin(t * 0.6 + L) * 8;
      var ly = lb[3] * H + Math.cos(t * 0.5 + L * 1.3) * 6;
      text(ctx, lb[0], lx, ly, { size: 9, color: C.cyanSoft, spacing: 3, alpha: master * appear * 0.9 });
      text(ctx, lb[1], lx, ly + 18, { size: 13, color: C.white, spacing: 2, alpha: master * appear * 0.9, shadow: 'rgba(47,211,232,0.6)', blur: 10 });
      rule(ctx, lx, ly + 26, lx + 54, ly + 26, C.cyanFaint, 1, master * appear);
    }

    // 9) POWER 100% 戳印（2.35s）
    var st = span(t, 2.30, 2.44);
    if (st > 0) {
      var sc = lerp(1.45, 1.0, easeOut(st));
      var a = (1 - span(t, 2.86, 3.06)) * st;
      ctx.save();
      ctx.translate(rx, ry + rr * 3.2); ctx.scale(sc, sc);
      text(ctx, 'POWER 100%', 0, 0, { size: 26, weight: 700, color: C.orange, spacing: 10, align: 'center', alpha: a, shadow: 'rgba(255,106,42,0.7)', blur: 22 });
      ctx.restore();
    }
  }

  // ---------- 人声段：声纹可视化 ----------
  function actVoice(ctx, t) {
    var k = span(t, 2.45, 2.9) * (1 - span(t, 10.9, 11.4));
    if (k <= 0) return;
    var e = rmsAt(t), low = lowAt(t);
    var n = 64, bw = 10, x0 = CX - (n * bw) / 2, base = H - 208;
    for (var i = 0; i < n; i++) {
      var w = 0.5 + 0.5 * Math.sin(i * 0.4 + t * 3.2);
      var h = (6 + 78 * e * (0.35 + 0.65 * w)) * (0.6 + 0.4 * Math.abs(Math.sin(i * 0.9 + 1)));
      ctx.save(); ctx.globalAlpha = k * (0.35 + 0.5 * e);
      ctx.fillStyle = i % 7 === 0 ? C.amberSoft : (low > 0.6 ? C.cyanSoft : C.cyanFaint);
      ctx.fillRect(x0 + i * bw, base - h, 4, h); ctx.restore();
    }
    rule(ctx, x0, base + 6, x0 + n * bw, base + 6, C.cyanFaint, 1, k * 0.7);
    // 中央声波环
    var rr = 92 + 46 * e;
    ctx.save(); ctx.globalAlpha = k * 0.75; ctx.translate(CX, H * 0.30);
    for (var s = 0; s < 48; s++) {
      var a = s * Math.PI * 2 / 48;
      var l = 6 + 26 * e * Math.abs(Math.sin(s * 0.7 + t * 4));
      ctx.strokeStyle = s % 6 === 0 ? C.amberSoft : C.cyanSoft; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      ctx.lineTo(Math.cos(a) * (rr + l), Math.sin(a) * (rr + l)); ctx.stroke();
    }
    ctx.restore();
    // 事件闪光
    var jf = jumpFlash(t, 0.12);
    if (jf > 0.05) { glow(ctx, CX, H * 0.30, 260, 'rgba(47,211,232,ALPHA)', 0.14 * jf * k); }
    text(ctx, 'VOICE LINK  ·  LIVE', CX, H - 236, { size: 10, color: C.cyanSoft, spacing: 6, align: 'center', alpha: k * (0.55 + 0.45 * (Math.floor(t * 2) % 2)) });
  }

  // ---------- 加载段 ----------
  function actLoad(ctx, t) {
    var k = span(t, 11.1, 11.5) * (1 - span(t, 13.2, 13.6));
    if (k <= 0) return;
    var p = span(t, 11.15, 13.05);
    var x0 = CX - 300, y0 = H - 172, n = 12, seg = 44, gap = 8;
    for (var i = 0; i < n; i++) {
      var on = clamp01(p * n - i);
      ctx.save(); ctx.globalAlpha = k * (on > 0 ? 0.85 : 0.28); ctx.fillStyle = on > 0 ? C.cyan : C.grayFaint;
      ctx.fillRect(x0 + i * (seg + gap), y0, seg * Math.max(0.06, on), 4); ctx.restore();
      if (on > 0 && on < 1) { rule(ctx, x0 + i * (seg + gap), y0 - 4, x0 + i * (seg + gap), y0 + 8, C.cyanHi, 1, k); }
    }
    text(ctx, 'DSH CORE  ·  LOADING', x0, y0 - 16, { size: 11, color: C.cyanSoft, spacing: 5, alpha: k });
    text(ctx, String(Math.round(p * 100)).padStart(3, '0') + '%', x0 + n * (seg + gap), y0 - 16, { size: 13, color: C.cyanHi, spacing: 2, align: 'right', alpha: k });
  }

  // ---------- 地球段 ----------
  function actGlobe(ctx, t) {
    var k = span(t, 13.3, 13.8) * (1 - span(t, 18.4, 19.0));
    if (k <= 0) return;
    var x = W - 580, y = 246, w = 452, h = 210;
    ctx.save(); ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(10,42,58,0.40)'; ctx.fillRect(x, y, w, h);
    rule(ctx, x, y, x + w, y, C.cyanSoft, 1.6, 1);
    rule(ctx, x, y + h, x + w, y + h, C.cyanFaint, 1, 1);
    rule(ctx, x, y, x, y + h, C.cyanFaint, 1, 1);
    rule(ctx, x + w, y, x + w, y + h, C.cyanFaint, 1, 1);
    ctx.restore();
    if (k > 0.1) { rule(ctx, x + 20, y + 46, x + w - 20, y + 46, C.cyanFaint, 1, k); }
    text(ctx, decode('GLOBAL WORKSPACE', span(t, 13.35, 13.85), t * 7), x + 20, y + 34, { size: 13, color: C.cyanHi, spacing: 6, alpha: k });
    text(ctx, 'P-02 / WS', x + w - 20, y + h - 16, { size: 9, color: C.grayFaint, spacing: 3, align: 'right', alpha: k });
    var rows = [['NODES', '1,286'], ['LINKS', '3,914'], ['SKILLS', '17'], ['BUNDLES', '06'], ['MODEL', 'deepseek-flash']];
    for (var i = 0; i < rows.length; i++) {
      var a = span(t, 13.55 + i * 0.18, 13.9 + i * 0.18) * k;
      if (a <= 0) continue;
      text(ctx, rows[i][0], x + 20, y + 78 + i * 24, { size: 10, color: C.graySoft, spacing: 4, alpha: a });
      text(ctx, rows[i][1], x + w - 20, y + 78 + i * 24, { size: 12, color: C.cyanHi, spacing: 2, align: 'right', alpha: a });
    }
  }

  // ---------- 自检段 ----------
  var FACTS = [['PROFILE', 'desktop'], ['MODEL', 'deepseek-flash'], ['BUNDLES', '06'], ['SKILLS', '17'], ['SANDBOX', 'full-access'], ['SESSION', '001']];
  function actCheck(ctx, t) {
    var k = span(t, 19.2, 19.6) * (1 - span(t, 24.4, 24.9));
    if (k <= 0) return;
    var x = 96, y = 286, w = 540;
    // 玻璃底衬：screen 混合下黑色不起作用，用"深青玻璃 + 亮边框"制造分离感
    ctx.save(); ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(10,42,58,0.42)'; ctx.fillRect(x, y, w, 466);
    ctx.fillStyle = 'rgba(47,211,232,0.05)'; ctx.fillRect(x, y, w, 466);
    rule(ctx, x, y, x + w, y, C.cyanSoft, 1.6, 1);
    rule(ctx, x, y + 466, x + w, y + 466, C.cyanFaint, 1, 1);
    rule(ctx, x, y, x, y + 466, C.cyanFaint, 1, 1);
    rule(ctx, x + w, y, x + w, y + 466, C.cyanFaint, 1, 1);
    ctx.restore();
    text(ctx, decode('SYSTEM CHECK', span(t, 19.25, 19.65), t * 5), x + 22, y + 40, { size: 14, color: C.cyanHi, spacing: 7, alpha: k });
    rule(ctx, x + 22, y + 54, x + w - 22, y + 54, C.cyanFaint, 1, k * span(t, 19.3, 19.7));
    for (var i = 0; i < FACTS.length; i++) {
      var at = 19.45 + i * 0.55;
      var a = span(t, at, at + 0.2) * k;
      if (a <= 0) continue;
      var yy = y + 92 + i * 58;
      var stamp = span(t, at + 0.16, at + 0.30);
      text(ctx, '[ ' + String(i + 1).padStart(2, '0') + ' ]', x + 22, yy, { size: 10, color: C.cyanSoft, spacing: 2, alpha: a });
      text(ctx, FACTS[i][0], x + 84, yy, { size: 14, color: C.white, spacing: 5, alpha: a });
      text(ctx, FACTS[i][1], x + 286, yy, { size: 14, color: C.cyanHi, spacing: 2, alpha: a });
      for (var b = 0; b < 6; b++) {
        var hh = 4 + 12 * Math.abs(Math.sin(i + b + t * 2.5)) * a;
        ctx.save(); ctx.globalAlpha = a * 0.7; ctx.fillStyle = b % 3 === 0 ? C.amberSoft : C.cyanSoft;
        ctx.fillRect(x + 386 + b * 9, yy - hh, 2.5, hh); ctx.restore();
      }
      if (stamp > 0) {
        var sc = lerp(1.5, 1, easeOut(stamp));
        ctx.save(); ctx.translate(x + 500, yy - 4); ctx.scale(sc, sc);
        text(ctx, 'PASS', 0, 0, { size: 10, color: C.amber, spacing: 2, align: 'center', alpha: stamp * 0.9 });
        ctx.restore();
      }
    }
    var done = span(t, 23.6, 23.9) * k;
    if (done > 0) text(ctx, '06 / 06  PASSED', x + w - 22, y + 442, { size: 12, color: C.cyanHi, spacing: 5, align: 'right', alpha: done });
  }

  // ---------- Logo slam ----------
  function actSlam(ctx, t) {
    if (t < SLAM - 0.35 || t > 29.6) return;
    var dt = t - SLAM;
    var flash = gauss(t, SLAM, 0.09);
    if (flash > 0.02) { ctx.save(); ctx.globalAlpha = 0.5 * flash; ctx.fillStyle = '#DFF7FF'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    // 冲击波环
    for (var i = 0; i < 3; i++) {
      var p = span(t, SLAM + i * 0.08, SLAM + 0.9 + i * 0.08);
      if (p <= 0 || p >= 1) continue;
      ctx.save(); ctx.globalAlpha = (1 - p) * 0.5; ctx.strokeStyle = i === 1 ? C.orange : C.cyan; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(CX, 470, 60 + 620 * easeOut(p), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    // 尘埃粒子
    for (var d = 0; d < 46; d++) {
      var a = rand(d * 2.1) * Math.PI * 2, sp = 120 + 520 * rand(d * 3.3);
      var r = (t - SLAM) * sp; if (r <= 0 || r > 900) continue;
      ctx.save(); ctx.globalAlpha = clamp01(1 - r / 900) * 0.5;
      ctx.fillStyle = d % 4 === 0 ? C.orangeSoft : C.cyanSoft;
      ctx.fillRect(CX + Math.cos(a) * r, 470 + Math.sin(a) * r * 0.6, 2, 2); ctx.restore();
    }
    // 字标
    var k = easeOut(span(t, SLAM - 0.22, SLAM + 0.10));
    var sc = lerp(1.5, 1.0, k);
    var alpha = span(t, SLAM - 0.24, SLAM + 0.04) * (1 - span(t, 28.9, 29.5));
    ctx.save();
    ctx.translate(CX, 470); ctx.scale(sc, sc); ctx.translate(-CX, -470);
    if (t < SLAM + 0.10) rgbSplitText(ctx, 'DEEPSEEK HARNESS', CX, 470, 76, 12, alpha, 4 * (1 - k));
    else text(ctx, 'DEEPSEEK HARNESS', CX, 470, { size: 76, weight: 700, color: C.white, spacing: 12, align: 'center', alpha: alpha, shadow: 'rgba(47,211,232,0.55)', blur: 34 });
    ctx.restore();
    rule(ctx, CX - 500 * k, 526, CX + 500 * k, 526, C.cyanFaint, 1, alpha);
    var sa = span(t, SLAM + 0.16, SLAM + 0.7) * (1 - span(t, 28.9, 29.5));
    if (sa > 0) {
      var sw = 340;
      ctx.save(); ctx.globalAlpha = sa * 0.75; ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(CX - sw, 592, sw * 2, 40); ctx.restore();
      text(ctx, 'SYSTEM READY  ·  ACCESS LEVEL 3', CX, 620, { size: 14, color: C.amber, spacing: 9, align: 'center', alpha: sa, shadow: 'rgba(0,0,0,0.9)', blur: 8 });
    }
  }

  // ---------- 交接 ----------
  function drawMockUI(ctx, alpha, blur) {
    ctx.save(); ctx.globalAlpha = alpha;
    if (blur > 0.1) ctx.filter = 'blur(' + blur + 'px)';
    ctx.fillStyle = '#0A0E12'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#0F171E'; ctx.fillRect(0, 0, 300, H);
    ctx.fillStyle = 'rgba(47,211,232,0.85)'; ctx.fillRect(24, 34, 132, 15);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(24, 58, 76, 8);
    for (var i = 0; i < 7; i++) {
      ctx.fillStyle = i === 0 ? 'rgba(47,211,232,0.16)' : 'rgba(255,255,255,0.05)';
      ctx.fillRect(16, 104 + i * 44, 268, 30);
      ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(30, 115 + i * 44, 150, 9);
    }
    ctx.fillStyle = '#0D141A'; ctx.fillRect(300, 0, W - 300, 62);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(330, 25, 190, 12);
    ctx.fillStyle = 'rgba(47,211,232,0.5)'; ctx.fillRect(W - 320, 25, 90, 12);
    var rows = [{ x: 380, w: 520, h: 74, me: false }, { x: W - 900, w: 520, h: 96, me: true },
      { x: 380, w: 640, h: 112, me: false }, { x: W - 820, w: 440, h: 68, me: true }];
    var y = 128;
    for (var r = 0; r < rows.length; r++) {
      var it = rows[r], rr = 10;
      ctx.fillStyle = it.me ? 'rgba(47,211,232,0.14)' : 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.moveTo(it.x + rr, y); ctx.lineTo(it.x + it.w - rr, y); ctx.quadraticCurveTo(it.x + it.w, y, it.x + it.w, y + rr);
      ctx.lineTo(it.x + it.w, y + it.h - rr); ctx.quadraticCurveTo(it.x + it.w, y + it.h, it.x + it.w - rr, y + it.h);
      ctx.lineTo(it.x + rr, y + it.h); ctx.quadraticCurveTo(it.x, y + it.h, it.x, y + it.h - rr);
      ctx.lineTo(it.x, y + rr); ctx.quadraticCurveTo(it.x, y, it.x + rr, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      for (var l = 0; l < 3; l++) ctx.fillRect(it.x + 22, y + 20 + l * 18, (it.w - 60) * (0.9 - l * 0.18), 8);
      y += it.h + 34;
    }
    ctx.fillStyle = 'rgba(255,255,255,0.045)'; ctx.fillRect(380, H - 172, W - 760, 92);
    ctx.strokeStyle = 'rgba(47,211,232,0.4)'; ctx.lineWidth = 1.5; ctx.strokeRect(380, H - 172, W - 760, 92);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(404, H - 136, 300, 10);
    ctx.filter = 'none'; ctx.restore();
  }
  function actHandoff(ctx, t) {
    if (t < HANDOFF) return;
    var p = span(t, HANDOFF, DUR);
    // 过曝
    var white = 1 - span(t, HANDOFF + 0.04, HANDOFF + 0.20);
    if (white > 0) { ctx.save(); ctx.globalAlpha = 0.94 * white; ctx.fillStyle = '#EAFBFF'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    // 界面显影
    var reveal = easeOut(span(t, HANDOFF + 0.12, DUR - 0.02));
    if (reveal > 0) drawMockUI(ctx, Math.min(1, reveal * 1.2), lerp(20, 0, reveal));
    // 扫描线
    var sy = lerp(-40, H + 40, easeInOut(span(t, HANDOFF + 0.08, DUR - 0.04)));
    if (p > 0.02) {
      var g = ctx.createLinearGradient(0, sy - 240, 0, sy);
      g.addColorStop(0, 'rgba(47,211,232,0)'); g.addColorStop(1, 'rgba(47,211,232,0.18)');
      ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, sy - 240, W, 240);
      rule(ctx, 0, sy, W, sy, C.cyanHi, 2, 0.9); ctx.restore();
    }
    text(ctx, 'WELCOME, SIR.', CX, H - 118, { size: 13, color: 'rgba(47,211,232,0.85)', spacing: 8, align: 'center', alpha: span(t, DUR - 0.4, DUR - 0.06) });
  }

  // ---------- 主绘制 ----------
  var canvas, ctx;
  function stageId(t) {
    if (t < 2.45) return 1;
    if (t < 11.05) return 2;
    if (t < 13.4) return 3;
    if (t < 19.0) return 4;
    if (t < 25.4) return 5;
    return 6;
  }
  function render(t) {
    t = Math.max(0, Math.min(DUR, t));
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);

    if (t < HANDOFF) {
      actSuit(ctx, t);
      actVoice(ctx, t);
      actLoad(ctx, t);
      actGlobe(ctx, t);
      actCheck(ctx, t);
      actSlam(ctx, t);
      // 品牌：只在开头出现一次，放在上三分之一（避开反应堆焦点）
      var bk = easeOut(span(t, 0.25, 1.1)) * (1 - span(t, 2.2, 2.5));
      if (bk > 0) {
        text(ctx, 'DEEPSEEK HARNESS', CX, 250, { size: 30, weight: 700, color: C.white, spacing: lerp(22, 12, bk), align: 'center', alpha: bk * 0.9, shadow: 'rgba(47,211,232,0.55)', blur: 24 });
        text(ctx, 'BOOT SEQUENCE  /  JARVIS', CX, 284, { size: 10, color: C.cyanSoft, spacing: 9, align: 'center', alpha: bk });
        rule(ctx, CX - 240 * bk, 304, CX + 240 * bk, 304, C.cyanFaint, 1, bk);
      }
      var hudA = span(t, 0.2, 1.0) * (1 - span(t, HANDOFF, HANDOFF + 0.2));
      hudFrame(ctx, t, hudA);
      hudTopLeft(ctx, t, hudA);
      hudTopRight(ctx, t, hudA);
      hudBottom(ctx, t, hudA, stageId(t));
      hudTicker(ctx, t, hudA);
    } else {
      actHandoff(ctx, t);
    }
    // 颗粒 + 扫描线质感
    ctx.save(); ctx.globalAlpha = 0.05; ctx.fillStyle = '#fff';
    for (var i = 0; i < 160; i++) ctx.fillRect(rand(Math.round(t * 30) * 977 + i * 3.1) * W, rand(Math.round(t * 30) * 131 + i * 7.7) * H, 1.2, 1.2);
    ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.04; ctx.fillStyle = '#000';
    for (var y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    ctx.restore();
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
