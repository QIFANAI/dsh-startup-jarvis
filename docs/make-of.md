# 启动片制作管线（make-of）

> 插件运行只需要 `lib/assets/jarvis-boot.mp4`；本文说明这支 30.2s 成片是怎么从作者自剪素材合成的，
> 便于复现或二次创作。所有路径以仓库根为基准。

## 素材

| 文件 | 说明 | 是否随仓库 |
|---|---|---|
| `11月19日.mp4` | 作者自剪 4K 原片（105.8 MB，HEVC） | ✗ 超出 GitHub 单文件限制，且非运行必需 |
| `assets/jarvis-1080p.mp4` | 原片 1080p H.264 底片（35 MB） | ✗ 可由原片一步转出，见下 |
| `lib/assets/jarvis-boot.mp4` | **最终成片**（30.2s / 1920×1080 / 30fps / H.264 + AAC） | ✓ |
| `preview/overlay50.js` · `preview/drive.js` | canvas 叠加层与事件/音频包络数据 | ✓ |
| `assets/masks/edge_*.png` | 第一幕装甲边缘蒙版（96 帧，480×270） | ✓ |
| `assets/reactor-track.json` | 反应堆亮斑质心轨迹（0–3.2s） | ✓ |
| `scripts/make-armor-masks.py` | 从原片离线提取装甲蒙版 | ✓ |
| `scripts/track-reactor.py` | 反应堆质心追踪 | ✓ |
| `tools/render-video.mjs` | 无头 Chrome + CDP 逐帧渲染 canvas 叠加层 | ✓ |

## 步骤

```powershell
# 1) 1080p H.264 底片（HEVC 4K 在 Electron 上播不了；原片只读）
ffmpeg -y -i "11月19日.mp4" -vf "scale=1920:1080:flags=lanczos,fps=30" `
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k assets/jarvis-1080p.mp4

# 2) 烧字幕（libass：CJK 用 ASS，drawtext 中文会变豆腐块）
ffmpeg -y -ss 0 -t 30.20 -i assets/jarvis-1080p.mp4 -an `
  -vf "fps=30,scale=1920:1080,subtitles='out/plate2/subs.ass'" `
  -c:v libx264 -preset fast -crf 19 -g 1 out/plate2/main-sub.mp4

# 3) 拼黑尾（30.20 + 0.8333 = 931 帧），得到 plate-sub.mp4
ffmpeg -y -f concat -safe 0 -i out/plate2/list2.txt -c copy out/plate2/plate-sub.mp4

# 4) 叠加层（canvas 黑底）→ 逐帧截图
node tools/render-video.mjs --url "file:///<仓库根>/preview/overlay50.html?capture=1" `
  --out out/renders/overlay50.mp4 --frames-dir out/frames/overlay50

# 5) screen 混合 + 合流原声
ffmpeg -y -i out/plate2/plate-sub.mp4 -framerate 30 -i out/frames/overlay50/f_%04d.png `
  -filter_complex "[1:v]format=gbrp[ov];[0:v]format=gbrp[pl];[pl][ov]blend=all_mode=screen,format=yuv420p" `
  -c:v libx264 -preset slow -crf 18 -r 30 out/renders/composite30.mp4

ffmpeg -y -i out/renders/composite30.mp4 -i out/plate2/audio.m4a -map 0:v:0 -map 1:a:0 `
  -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart lib/assets/jarvis-boot.mp4
```

> `out/plate2/*`（字幕 ASS、concat 列表、抽出的音轨）是中间产物，不随仓库分发；
> 字幕时间码见 [design-v0.1.md](design-v0.1.md) 与根目录历史 README 的时间轴表。

## 叠加层内容（`preview/overlay50.js`）

- 品牌开幕：`DEEPSEEK HARNESS` / `BOOT SEQUENCE / JARVIS`
- 四条台词字幕（英/中）
- `DSH CORE · LOADING` 加载条、`GLOBAL WORKSPACE` 面板、`SYSTEM CHECK` 六项
- 25.86s Logo slam + `SYSTEM READY · ACCESS LEVEL 3`
- 第一幕（0.7–2.4s）装甲蒙版贴车身的赤金 VFX：反应堆跟踪、边缘通电、能量波、掌心炮、目镜 flare、火星

## 验证

成片属性以 `lib/assets/jarvis-boot.mp4` 为准：1920×1080、30fps、30.2s、H.264 High + AAC-LC 立体声。
`test/smoke-assets.mjs` 会校验其 SHA256 与发布基线一致（任何重渲染都应重建哈希基线）。
