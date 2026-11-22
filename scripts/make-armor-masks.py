import numpy as np, os, json, glob
from PIL import Image, ImageFilter
from numpy.lib.stride_tricks import sliding_window_view as sw
SRC = r"E:/dshdesign/dsh-startup-Jarvis"
files = sorted(glob.glob(os.path.join(SRC, "out", "masksrc", "f_*.png")))[:96]
kx = np.array([[-1,0,1],[-2,0,2],[-1,0,1]], np.float32); ky = kx.T
lum_out = []
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB")
    a = np.asarray(im).astype(np.float32) / 255.0
    h, w, _ = a.shape
    gray = 0.2126*a[:,:,0] + 0.7152*a[:,:,1] + 0.0722*a[:,:,2]
    lum_out.append(round(float(gray.mean()), 4))
    p = np.pad(gray, 1, mode="edge"); win = sw(p, (3,3))
    edge = np.hypot((win * kx).sum(axis=(-1,-2)), (win * ky).sum(axis=(-1,-2)))
    edge = np.clip(edge / (np.percentile(edge, 99.6) + 1e-6), 0, 1)
    wl = np.clip((gray - 0.09) / 0.24, 0, 1) ** 0.8
    yy, xx = np.mgrid[0:h, 0:w]
    ex = ((xx / w) - 0.505) / 0.46; ey = ((yy / h) - 0.56) / 0.64
    subj = np.clip((1.12 - np.sqrt(ex*ex + ey*ey)) / 0.22, 0, 1)
    m = edge * (0.15 + 0.85 * wl) * subj
    m = np.clip((m - 0.12) / 0.88, 0, 1) ** 1.5      # 提高对比，只留细线
    out = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.4)).resize((480, 270), Image.LANCZOS)
    out.save(os.path.join(SRC, "assets", "masks", "edge_%03d.png" % i))
json.dump({"fps":30,"count":len(files),"lum":lum_out}, open(os.path.join(SRC,"assets","masks","lum.json"),"w",encoding="utf-8"))
open(os.path.join(SRC,"preview","masklum.js"),"w",encoding="utf-8").write("window.__MASK_LUM__=" + json.dumps(lum_out) + ";")
print("ok")
