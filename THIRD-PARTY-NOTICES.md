# THIRD-PARTY-NOTICES — dsh-startup-jarvis

本仓库分两类内容：**自有代码与设计**（MIT，见 [LICENSE](LICENSE)）与**内嵌影像素材**
（版权归原权利人；按作者决定随仓库以完整素材版公开分享，见 §4）。

## 1. 启动片

| 产物 | 来源 | 说明 |
|---|---|---|
| `lib/assets/jarvis-boot.mp4`（44.7 MB）<br>`lib/assets/poster.jpg` | 作者自剪成片 `11月19日.mp4`（1920×1080 源，105.8 MB） | 1080p H.264 转码 + 字幕烧录 + 叠加层合成；**音轨为原片原声**，仅转码，未改编 |
| `preview/overlay*.js` · `preview/drive.js` · `assets/masks/*.png` · `assets/reactor-track.json` | 作者原创 | 启动片的 canvas 叠加层、装甲边缘蒙版与反应堆轨迹数据（制作源） |

- 原始成片 `11月19日.mp4` 未随仓库分发（单文件 100 MB 以上，超出 GitHub 普通仓库单文件限制；
  也不是插件运行所需内容）。插件运行使用的是仓库内的 `lib/assets/jarvis-boot.mp4`。
- 启动片中的字幕文案（"Welcome home, sir." 等）为角色台词引用，用于同人氛围表达。

## 2. 操作界面动态背景

| 产物 | 来源 | 说明 |
|---|---|---|
| `lib/assets/bg-1080.mp4`<br>`lib/assets/bg-ambient.mp4`<br>`lib/assets/bg-poster.jpg`<br>`lib/assets/bg-poster-blur.jpg` | Wallpaper Engine 创意工坊场景素材（本机源文件 `1607138105878fcd84ed13f48a.mp4_last.mp4`，只读使用） | 转码为 1920×1080/30fps 与 960×540 预模糊两版；无音轨；仅做裁剪/重编码/轻度调色，内容未改编 |

- 该素材版权归原作者/权利人；工坊来源未记录 workshop id，按 Wallpaper Engine 工坊素材处理。
- 原始素材文件未随仓库分发；仓库内是插件实际播放的转码产物。

## 3. 没有第三方字体与音频文件

- 字体：CSS 只使用系统字体栈（`Consolas`、`Cascadia Mono`、`ui-monospace` 等），**不内嵌字体文件**。
- 音频：启动片音轨来自 §1 的原片；皮肤提示音由浏览器 WebAudio 实时合成，**不包含第三方音频文件**。

## 4. 授权口径（作者决定）

- 本仓库为**完整素材、无损公开分享**：`lib/assets/` 6 个文件与本机 0.3.9 运行版逐字节一致，
  没有为「规避版权」而删减素材或功能。
- 素材版权归原权利人，本仓库**不主张任何权利**；用途限定为**非商业、个人同人分享**。
- 如权利人提出异议，将立即移除相应内容。
- 下载、安装、二次分发者应自行确认所在地区的素材使用合规性；作者按本人意愿公开分享并承担相应责任（见仓库 README 与 Release 说明）。
