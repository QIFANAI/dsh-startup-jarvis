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
  var GOLD = '#FFC46B', GOLD_HI = '#FFE6B8', ORANGE = '#FF5A1F', RED_HOT = '#FF2D1A', WHITE_HOT = '#FFF6E8';
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


  // ---------- 装甲蒙版（从素材帧离线提取） ----------
  var MASKS = [], MASK_LUM = window.__MASK_LUM__ || null, maskCanvas = null, maskCtx = null;
  function loadMasks() {
    var list = [];
    for (var i = 0; i < 96; i++) {
      (function (idx) {
        var img = new Image();
        var pr = new Promise(function (res) {
          img.onload = function () { MASKS[idx] = img; res(); };
          img.onerror = function () { res(); };
          setTimeout(res, 6000);
        });
        img.src = '../assets/masks/edge_' + String(idx).padStart(3, '0') + '.png';
        list.push(pr);
      })(i);
    }
    return Promise.all(list);
  }
  function maskAt(t) { return MASKS[Math.max(0, Math.min(MASKS.length - 1, Math.floor(t * 30)))] || null; }
  function lumAt(t) {
    if (!MASK_LUM || !MASK_LUM.length) return 0.5;
    var i = Math.max(0, Math.min(MASK_LUM.length - 1, Math.floor(t * 30)));
    return clamp01(MASK_LUM[i] / 0.16);
  }
  function armorGlow(ctx, t, tint, alpha, bandY) {
    var m = maskAt(t);
    if (!m || alpha <= 0.002) return;
    if (!maskCanvas) {
      maskCanvas = document.createElement('canvas'); maskCanvas.width = 480; maskCanvas.height = 270;
      maskCtx = maskCanvas.getContext('2d');
    }
    maskCtx.clearRect(0, 0, 480, 270);
    maskCtx.drawImage(m, 0, 0, 480, 270);
    maskCtx.globalCompositeOperation = 'source-in';
    maskCtx.fillStyle = tint; maskCtx.fillRect(0, 0, 480, 270);
    maskCtx.globalCompositeOperation = 'source-over';
    if (bandY !== undefined && bandY !== null) {
      // 软边能量带：把整张 mask 用垂直渐变做 destination-in
      maskCtx.globalCompositeOperation = 'destination-in';
      var bg = maskCtx.createLinearGradient(0, bandY * 270 / H - 60, 0, bandY * 270 / H + 60);
      bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(0.35, 'rgba(0,0,0,1)');
      bg.addColorStop(0.65, 'rgba(0,0,0,1)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
      maskCtx.fillStyle = bg; maskCtx.fillRect(0, 0, 480, 270);
      maskCtx.globalCompositeOperation = 'source-over';
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.drawImage(maskCanvas, 0, 0, W, H);
    ctx.restore();
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

  // ---------- 第一幕：钢铁侠（蒙版贴车身 VFX） ----------
  function actSuit(ctx, t) {
    var tr = trackAt(t), rx = tr.x * W, ry = tr.y * H - 26;
    var pulse = 0.35 + 0.65 * Math.max(
      gauss(t, 0.62, 0.10), gauss(t, 1.22, 0.10), gauss(t, 1.82, 0.10), gauss(t, 2.40, 0.075)
    );
    var master = span(t, 0.05, 0.5) * (1 - span(t, 2.98, 3.2));
    var lum = lumAt(t);
    var baseI = master * (0.42 + 0.44 * pulse) * (0.85 + 0.3 * lum);

    // 1) 装甲边缘通电 / 2) 镜面高光
    armorGlow(ctx, t, GOLD, 0.165 * baseI);
    armorGlow(ctx, t, WHITE_HOT, 0.05 * master * pulse * (0.6 + 0.4 * lum));

    // 3) 能量波（0.9 / 2.0 各一趟，自下而上）
    var waves = [0.9, 2.0];
    for (var wi = 0; wi < waves.length; wi++) {
      var p = span(t, waves[wi], waves[wi] + 1.1);
      if (p <= 0 || p >= 1) continue;
      var bandY = lerp(H * 1.06, -H * 0.06, easeInOut(p));
      armorGlow(ctx, t, GOLD_HI, 0.26 * master * (1 - 0.35 * p), bandY);
      rule(ctx, 0, bandY, W, bandY, 'rgba(255,198,107,0.22)', 1, master * (1 - p));
    }

    // 4) 反应堆过载
    var overload = 1 + 0.7 * pulse;
    glow(ctx, rx, ry, 160 * overload * 1.5, 'rgba(255,90,31,ALPHA)', 0.09 * master * pulse);
    glow(ctx, rx, ry, 120 * overload, 'rgba(255,198,107,ALPHA)', 0.15 * master * (0.5 + 0.5 * pulse));
    ctx.save(); ctx.globalAlpha = master * (0.25 + 0.30 * pulse); ctx.fillStyle = WHITE_HOT;
    ctx.beginPath(); ctx.arc(rx, ry, 20 + 10 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.restore();

    // 5) 能量丝（沿胸甲向外爬）
    ctx.save(); ctx.globalAlpha = master * 0.28 * pulse; ctx.strokeStyle = GOLD; ctx.lineWidth = 1.1;
    for (var f = 0; f < 6; f++) {
      var ang = -Math.PI / 2 + f * (Math.PI / 5) + Math.sin(t * 1.2 + f) * 0.1;
      var r0 = 34 + 6 * pulse, r1 = 120 + 60 * Math.abs(Math.sin(f * 1.7 + t * 2)) + 60 * pulse;
      ctx.beginPath();
      ctx.moveTo(rx + Math.cos(ang) * r0, ry + Math.sin(ang) * r0);
      ctx.quadraticCurveTo(
        rx + Math.cos(ang + 0.25) * (r1 * 0.6), ry + Math.sin(ang + 0.25) * (r1 * 0.6),
        rx + Math.cos(ang) * r1, ry + Math.sin(ang) * r1
      );
      ctx.stroke();
    }
    ctx.restore();

    // 6) 掌心炮充能（左手机械装置）
    var hx = W * 0.232, hy = H * 0.442;
    var ch = span(t, 1.35, 2.15);
    if (ch > 0 && ch < 1.001) {
      var charge = easeOut(ch);
      ctx.save(); ctx.globalAlpha = master * (0.22 + 0.33 * charge);
      for (var s = 0; s < 10; s++) {
        var a0 = s * Math.PI / 5 - Math.PI / 2 + t * 0.6;
        var rA = 26 + 6 * charge, rB = rA + 8 + 10 * charge;
        ctx.strokeStyle = s % 2 ? C.cyanHi : GOLD; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(hx, hy, rA, a0, a0 + 0.22); ctx.stroke();
        rule(ctx, hx + Math.cos(a0) * rA, hy + Math.sin(a0) * rA, hx + Math.cos(a0) * rB, hy + Math.sin(a0) * rB, GOLD_HI, 1, 0.8);
      }
      for (var e = 0; e < 3; e++) {
        var seed = Math.floor(t * 30) * 7 + e * 13;
        var aA = rand(seed) * Math.PI * 2, len = 34 + 30 * charge;
        ctx.strokeStyle = 'rgba(255,230,184,0.85)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(hx, hy);
        ctx.lineTo(hx + Math.cos(aA) * len * 0.4, hy + Math.sin(aA) * len * 0.4);
        ctx.lineTo(hx + Math.cos(aA + (rand(seed + 1) - 0.5) * 0.9) * len * 0.8, hy + Math.sin(aA + (rand(seed + 2) - 0.5) * 0.9) * len * 0.8);
        ctx.lineTo(hx + Math.cos(aA) * len, hy + Math.sin(aA) * len);
        ctx.stroke();
      }
      glow(ctx, hx, hy, 40 + 30 * charge, 'rgba(255,235,200,ALPHA)', 0.14 + 0.22 * charge);
      ctx.restore();
      var ig = gauss(t, 2.12, 0.05);
      if (ig > 0.02) glow(ctx, hx, hy, 80, 'rgba(255,255,255,ALPHA)', 0.42 * ig);
    }

    // 7) 目镜点火（赤金）
    var fl = Math.max(gauss(t, 0.82, 0.07), gauss(t, 1.62, 0.07), gauss(t, 2.42, 0.06));
    if (fl > 0.02) {
      var ex = W * 0.545, ey = H * 0.205;
      glow(ctx, ex, ey, 110 * fl, 'rgba(255,200,120,ALPHA)', 0.30 * fl * master);
      rule(ctx, ex - 90 * fl, ey, ex + 90 * fl, ey, 'rgba(255,235,200,0.45)', 1.2, fl * master);
      rule(ctx, ex, ey - 46 * fl, ex, ey + 46 * fl, 'rgba(255,235,200,0.35)', 1, fl * master);
    }

    // 8) 火星与余烬
    for (var p2 = 0; p2 < 60; p2++) {
      var sd = p2 * 4.3;
      var spd = (70 + 140 * rand(sd + 1)) * (0.55 + 0.9 * pulse);
      var px = rand(sd) * W * 0.9 + W * 0.05;
      var py = H + 40 - ((t * spd + rand(sd + 2) * H) % (H + 80));
      var pull = clamp01(1 - Math.hypot(px - rx, py - ry) / 620);
      px = lerp(px, rx, pull * 0.30 * pulse);
      py = lerp(py, ry, pull * 0.16 * pulse);
      ctx.save(); ctx.globalAlpha = (0.10 + 0.40 * rand(sd + 3)) * master;
      ctx.fillStyle = p2 % 4 === 0 ? 'rgba(255,45,26,0.8)' : (p2 % 3 === 0 ? GOLD_HI : GOLD);
      var sz = p2 % 9 === 0 ? 2.2 : 1.5;
      ctx.fillRect(px, py, sz, sz); ctx.restore();
    }
    var burst = span(t, 2.33, 2.9);
    if (burst > 0 && burst < 1) {
      for (var q2 = 0; q2 < 40; q2++) {
        var aa = rand(q2 * 5.1) * Math.PI * 2;
        var rr2 = 60 + 700 * easeOut(burst) * (0.4 + 0.6 * rand(q2 * 2.7));
        ctx.save(); ctx.globalAlpha = (1 - burst) * 0.55 * master;
        ctx.fillStyle = q2 % 3 ? GOLD : ORANGE;
        ctx.fillRect(rx + Math.cos(aa) * rr2, ry + Math.sin(aa) * rr2 * 0.7, 2, 2); ctx.restore();
      }
    }

    // 9) 数据标签（三组·赤金）
    var LABELS = [['ARC OUT', '3.24 GJ/s', 0.145, 0.36], ['CORE TEMP', '89.07°', 0.795, 0.285], ['PWR', '100%', 0.815, 0.40]];
    for (var L2 = 0; L2 < LABELS.length; L2++) {
      var lb = LABELS[L2];
      var ap = span(t, 0.95 + L2 * 0.22, 1.3 + L2 * 0.22);
      if (ap <= 0) continue;
      var lx = lb[2] * W + Math.sin(t * 0.5 + L2) * 6;
      var ly = lb[3] * H + Math.cos(t * 0.45 + L2 * 1.4) * 5;
      text(ctx, lb[0], lx, ly, { size: 8, color: 'rgba(255,198,107,0.85)', spacing: 3, alpha: master * ap * 0.85 });
      text(ctx, lb[1], lx, ly + 15, { size: 11, color: WHITE_HOT, spacing: 2, alpha: master * ap * 0.9, shadow: 'rgba(255,150,60,0.7)', blur: 10 });
      rule(ctx, lx, ly + 22, lx + 46, ly + 22, 'rgba(255,198,107,0.45)', 1, master * ap);
    }

    // 10) POWER 100% 戳印 + 冲击环
    var st = span(t, 2.30, 2.44);
    if (st > 0) {
      var sc = lerp(1.45, 1.0, easeOut(st));
      var a2 = (1 - span(t, 2.88, 3.08)) * st;
      ctx.save(); ctx.translate(rx, ry + 210); ctx.scale(sc, sc);
      text(ctx, 'POWER 100%', 0, 0, { size: 24, weight: 700, color: GOLD, spacing: 10, align: 'center', alpha: a2, shadow: 'rgba(255,106,42,0.8)', blur: 24 });
      ctx.restore();
      for (var w2 = 0; w2 < 2; w2++) {
        var pp = span(t, 2.35 + w2 * 0.1, 2.95 + w2 * 0.1);
        if (pp <= 0 || pp >= 1) continue;
        ctx.save(); ctx.globalAlpha = (1 - pp) * 0.35 * master; ctx.strokeStyle = w2 ? ORANGE : GOLD; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(rx, ry, 40 + 560 * easeOut(pp), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
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
        text(ctx, 'DEEPSEEK HARNESS', CX, 126, { size: 28, weight: 700, color: C.white, spacing: lerp(20, 11, bk), align: 'center', alpha: bk * 0.9, shadow: 'rgba(47,211,232,0.6)', blur: 22 });
        rule(ctx, CX - 210 * bk, 146, CX + 210 * bk, 146, C.cyanFaint, 1, bk);
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
    var fontsP = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    Promise.all([fontsP, loadMasks()]).then(function () { render(0); api.ready = true; });
  }
  init();
})();
