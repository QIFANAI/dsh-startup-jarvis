# 步骤 2 验收：消息气泡呼吸/流光 + 交接动效（0.3.7）

> 日期：2026-11-22 18:0x｜插件：`dsh-startup-jarvis@0.3.7`｜宿主：DSH 0.2.2-rc.5（web verify host + 桌面 profile 安装）
> 规划来源：`out/diag/now2.jsonl` 第 15 轮交底（6 条问题 #3 消息气泡、#6 交接动效）
> 结论：**#3、#6 均实现并通过模拟验收；0.3.7 已装进桌面 profile，需完全重启 DSH 后可见。**

## 1. 改了什么

| 文件 | 改动 |
|---|---|
| `skin.css` | 用户气泡 `[data-message-bubble]`：`position:relative; isolation:isolate`；`::before` 1px conic 金/红边环（`--dj-ring-angle` 12s 旋转 + 6.4s 呼吸，mask 只留边框）；`::after` 外侧柔光 + 7s 斜向高光扫过（只动 opacity / background-position，不改布局）；浅色主题单独配深金边环；`motion=reduced/off` 静态降级；视口外气泡 `[data-dj-bubble-off]` 暂停动画。交接分区显影补第 5 项：`#root::before` 四角枢轴 600ms/延迟 380ms + `#root::after` 状态铭牌淡入。 |
| `skin.js` | `enter()` 拆成 `prime()`（启动层下备好背景/视频，UI 仍隐藏）与 `reveal()`（移除 `dj-booting` + `dj-enter` 分区显影）；`enter()` 保留旧语义；暴露 `prime/reveal` API。新增 `markBubbles()` IntersectionObserver（rootMargin 160px）给视口外气泡打 `data-dj-bubble-off`。**修复 6s 看门狗**：启动层还在时不再提前 `enter()`（0.3.5 里它会在闪白前 24s 就把 UI 显影出来）。视差不再被系统 `prefers-reduced-motion` 强制关闭，改由 `skin.motion` 档位决定。 |
| `splash.js` | `handoff()` 重排：**冻结最后一帧 → `prime()` → 金红扫描线 + 暖白闪 → 峰值后 300ms `reveal()` → 启动层在已显影 UI 上 820ms 淡出 → cleanup（总 1.2s）**；`reducedMotion` 走 300ms 直接淡出；`handoffStarted` 防重入；`shouldPlay()=false`（当次会话不再播）时立即 `enter()`，不再等 6s 看门狗（背景视频从此立即起播）。 |
| `splash.css` | 白闪 `#eafbff` → 暖白径向光；扫描线青 `#2FD3E8` → JARVIS 金（`rgba(255,196,107,…)` + 赤色外晕）；flash 时长 340→520ms（延迟 120ms，峰值落在 reveal 前）；删除 `@media(prefers-reduced-motion)` 硬关（减弱由 `CFG.reducedMotion` 决定——本机 Windows 动画被关时系统偏好=reduce，会吃掉用户显式选择的动效）。 |

合计：`+212 / −50` 行（4 文件），diff 见 `out/step2/diff-*.txt`。

## 2. 验收矩阵

| 组 | 脚本 / 证据 | 结果 |
|---|---|---|
| 气泡动画（暗/浅/降级/暂停） | `tools/step2-bubble-check.mjs` → `bubble-assertions.txt`、`bubble-series.json`、`bubble-*.png` | **11/11 PASS**（布局零位移、`--dj-ring-angle` 前进、background-position 扫过、呼吸 opacity 变化、reduced/off 静态） |
| 视口外气泡暂停 | `tools/step2-bubble-offscreen2.mjs` → `bubble-offscreen.json` | **PASS**（滚出视口 `animationPlayState=paused`，滚回恢复） |
| 交接时序（DOM 采样） | `tools/step2-handoff-capture.mjs` → `handoff-dom-assertions.txt`、`handoff-analysis.json`、`handoff-*-dom.json` | **13/13 PASS**（flash/scan 与 handoff 同帧、reveal +305ms、splash 不透明度 1 时显影、fade +90ms、总 1.20s、视频冻结、reduced 无闪扫且总 0.35s） |
| 交接画面（逐帧分析） | `tools/step2-analyze.py` + `tools/step2-visual.mjs` → `handoff-visual-assertions.txt`、`handoff-*-contact.png`、`handoff-visual.json` | **10/10 PASS**（暖白闪白色占比 0.67、亮度 ×3.54、金色全宽扫描带 15 帧/下移 11 次、色相 R>G>B、闪后 0.215s 显影；reduced 无闪无扫） |
| 回归 | `tools/fixb-verify.mjs`（桌面标题栏矩阵）、`tools/phase1c-check.mjs`（hero/背景/拖动/MK VII/浅色） | **18/18 PASS**、**14/14 PASS**，0 页面异常 |

## 3. 录屏（单独录制，未与侧栏混在一起）

| 文件 | 内容 | 时长 |
|---|---|---|
| `handoff-normal-handoff.mp4` | 正常交接特写：片尾 → 金扫描 → 暖白闪 → UI 分区显影 → 淡出 | 5.1s（窗口 ±2.2s） |
| `handoff-normal.mp4` | 正常交接完整过程（含片尾 2s） | 9.3s |
| `handoff-reduced-handoff.mp4` / `handoff-reduced.mp4` | reduced-motion：无闪无扫，300ms 直接淡出 | 3.4s / 7.5s |
| `bubble-animation.mp4` / `bubble-animation-zoom.mp4` | 用户气泡 6s 呼吸/流光（含 3x 特写裁剪） | 5.9s |

关键帧静态图：`handoff-normal-contact.png`、`handoff-reduced-contact.png`、`bubble-moments.png`。

## 4. 安装

| 项 | 值 |
|---|---|
| 包 | `releases/dsh-startup-jarvis-0.3.7.tgz`，56,555,493 bytes，SHA256 `70569E8A57845F06FE477F8C5525846C205FCDE6E9A0EA33F2D5C693C80CBD65` |
| 安装 | plugin manager `install_bundle` → 0.3.6 → 0.3.7，`applied` |
| 资产核对 | installed `node_modules/dsh-startup-jarvis/lib`：skin.css `5155AAB4…`、skin.js `5A7DD3A1…`、splash.css `9B431425…`、splash.js `ED21E741…`，与 `package/lib` 逐字节一致 |
| 生效 | **需完全退出 DSH 重开**（桌面端 boot 注入在 Electron 主进程启动时缓存，刷新页面不生效——同 0.3.6 的结论）。重启后状态栏应为 `SYS 0.3.7` |

## 5. 未验证 / 风险

1. 真机 30.2s 全片交接未跑（verify host 用 `handoffAt=5` 压缩验证；时序代码与 handoffAt 无关）；重启后请实际看一次完整交接。
2. 真机暗色下气泡的旋转边环观感未目视（模拟截图/录屏为暗色 1536×816@1.25，与桌面一致）；边环为 1px，若觉得太细可调 `padding:1px` 与 `--dj-ring-a`。
3. 本机 Windows「显示动画」关闭（`MinAnimate=0`）会让系统 `prefers-reduced-motion=reduce`：0.3.7 起 `motion=full` 显式覆盖系统偏好（这是让交接/气泡动效可见的前提）；若想尊重系统设置，把插件设置里「动效」改为 reduced。
4. 回滚：`install_bundle <本机工作区>\releases\dsh-startup-jarvis-0.3.6.tgz` 后重启。
