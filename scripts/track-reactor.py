import json, glob, math
import numpy as np
from PIL import Image

files = sorted(glob.glob(r"E:/dshdesign/dsh-startup-Jarvis/out/track/f_*.png"))[:96]
raw = []
for i, f in enumerate(files):
    a = np.asarray(Image.open(f).convert("RGB")).astype(np.float32)
    h, w, _ = a.shape
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    yy, xx = np.mgrid[0:h, 0:w]
    region = (yy > h * 0.52) & (yy < h * 0.96) & (xx > w * 0.22) & (xx < w * 0.78)
    core = region & (r > 170) & (g > 120) & (r - b > 60)
    wt = ((r - b).clip(0) ** 1.5) * core
    s = float(wt.sum())
    if s <= 1e-3:
        raw.append(None)
        continue
    cx = float((wt * xx).sum() / s) / w
    cy = float((wt * yy).sum() / s) / h
    rad = math.sqrt(float(core.sum()) / math.pi) / w
    raw.append((cx, cy, rad))

# 找第一个有效点作为默认锚
anchor = next(p for p in raw if p is not None)
pts = []
for i, p in enumerate(raw):
    pts.append(p if p is not None else (anchor[0], anchor[1], anchor[2] * 0.6))

out = []
for i in range(len(pts)):
    lo, hi = max(0, i - 4), min(len(pts), i + 5)
    xs = [pts[j][0] for j in range(lo, hi)]
    ys = [pts[j][1] for j in range(lo, hi)]
    rs = [pts[j][2] for j in range(lo, hi)]
    out.append({"t": round(i / 30.0, 4),
                "x": round(sum(xs) / len(xs), 4),
                "y": round(sum(ys) / len(ys), 4),
                "r": round(max(0.02, min(0.12, sum(rs) / len(rs))), 4)})

with open(r"E:/dshdesign/dsh-startup-Jarvis/assets/reactor-track.json", "w", encoding="utf-8") as fh:
    json.dump({"fps": 30, "count": len(out), "points": out}, fh, ensure_ascii=False)
print("n=", len(out))
for k in (0, 10, 20, 30, 45, 60, 75, 90):
    print(k, out[k])
