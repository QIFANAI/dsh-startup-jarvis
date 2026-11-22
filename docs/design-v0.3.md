# JARVIS 启动动画 · 接入规划 v0.3

> 输入：用户自剪成片 `11月19日.mp4`（3840×2160 / 30fps / **HEVC** / PCM 48k / **31.34s** / 106 MB）
> 目标：① 在成片上补 DSH 元素；② 做出"动画结束 → 进入操作界面"的转场效果与逻辑；③ 落成 DSH 启动插件。
> 现状事实（本机实测）：插件体系与 `dsh-startup-elisa` 0.6.0 同构；desktop profile 现役启动插件为 elisa/moss2/vyron 三选一运行；**同一 profile 只能启用一个启动插件**。

## 1. 先解决"能不能播"（硬前置）

| 问题 | 事实 | 处置 |
|---|---|---|
| 编码 | 源片是 **HEVC (H.265)** | Chromium/Electron 无硬解时**不保证能播**（实测风险高）→ **必须转 H.264** |
| 分辨率 | 4K 3840×2160 | 启动层按视口铺满 1080p 足够；4K 软解吃 CPU 且首帧慢 → 转 **1080p**（保留 4K 原件做母版） |
| 体积 | 106 MB | 已转 `assets/jarvis-1080p.mp4`：**H.264 1080p30 + AAC 192k = 35.3 MB / 31.338s**；再压一版 CRF 23 约 18–22 MB 备选 |
| 音轨 | PCM 48k 立体声 | 已随转码转 AAC |
| 播放 | 大文件首帧慢 | 插件路由支持 **Range 分块**；`preload="auto"` + 首帧 `poster.jpg`；黑幕遮到 `canplay` |

## 2. DSH 元素怎么加（叠加层设计）

原则：**片子是用户剪的，不动节奏**；只在"不抢画面"的位置加 DSH 身份层。

| 时间 | 画面内容（用户片） | 叠加 DSH 元素 |
|---|---|---|
| 0.0–3.0 | 装甲 HUD | 左上 `DEEPSEEK HARNESS` / `BOOT SEQUENCE / JARVIS`；右下版本 `v0.2.2-rc.1` |
| 3.0–6.0 | JARVIS 环（实验室） | 环下方 `ACCESS LEVEL 3 · JARVIS`；一条细扫描线 |
| 7.0–11.0 | SYSTEM LOADING / INITIALIZE SCANNING | 底部 DSH 进度条 + `LOADING DSH CORE`；六项自检读数滚动 |
| 13.0–18.0 | 点阵地球 | 右侧 `GLOBAL WORKSPACE` 面板：SKILLS 17 / BUNDLES 06 / MODEL deepseek-flash |
| 19.0–24.0 | reactor 全息仪表 | 左侧 `SYSTEM CHECK` 六项真数据（低透明度底衬，避免压过素材文字） |
| 24.0–29.0 | 环 + 光束 | 中央下方 `Welcome home, Sir.` 字幕（是否与片中语音同步**待音频核验**） |
| 29.0–30.2 | 白爆闪 | 不加字，留给转场 |
| 全程 | — | 四角细括号、顶部时间码/帧号、右下 `[ SKIP ] ESC`、底部细进度条 |

**实现方案（推荐）**：视觉全部"烧进"一条成品视频（生产用 ffmpeg 叠加，可控、零运行时开销）；
只有 **4 行动态数据**（SESSION / MODEL / SKILLS / 版本）由插件用 HTML 小面板实时渲染在视频右下角——既保住"真数据"，又不必在运行时做复杂合成。
备选：全部烧进（最简）；或全部运行时 canvas 叠加（最灵活，但复杂且易卡）。

## 3. 结束转场：效果 + 逻辑（核心）

### 3.1 触发点（关键判断）

源片 **29.0–30.21s 是白爆闪，30.5s 之后逐渐全黑**（实测逐帧）。所以：
- **不要等视频播完**（会看到约 1s 黑尾）；
- 在 **30.2s（爆闪峰值后端）** 触发交接，白闪正好当转场素材，视觉上"闪白 → 界面显影"一气呵成；
- 该点做成配置项 `handoffAt: 30.2`，改片只需改这一个数。

### 3.2 转场效果（850ms，可按速度系数缩放）

1. 0–120ms：白场过曝到 85%（承接片尾爆闪）
2. 80–500ms：**扫描线自上而下**推过整屏（1px 亮线 + 120px 拖尾），同时启动层 `backdrop-filter` 从 blur 24px→0
3. 300–850ms：启动层透明度 1→0，DSH 界面已在底层渲染完成，从"模糊暗"到"清晰亮"显影
4. 结束：移除 `#dsh-jarvis-root`，释放视频元素解码器，停止 RAF

备选效果：光圈收束（画面收缩成一个点）/ 交叉淡化（简单但平淡）——你选。

### 3.3 逻辑状态机（必须有，否则会白屏卡死）

```
boot ──ready──> playing ──(t>=handoffAt 或 ended 或 skip)──> handoff ──> done(移除层)
  │                 │
  │                 └──error / stall ──> fallback(poster + 300ms 淡出) ──> done
  └──watchdog(8s 未 ready)──> fallback
```

- **Skip**：Esc / 点击 / 右下按钮 → 立即走 handoff（480ms 短版）
- **减弱动态**（系统或配置）：不做扫描线，300ms 直接淡出
- **看门狗**：视频 `canplay` 8s 未到 → 直接用 poster 静帧 + 淡出，绝不卡住启动
- **错误兜底**：加载失败/解码失败 → 40ms 释放，保证能进主界面
- **音频**：默认 `muted` 自动播放（浏览器策略），桌面端尝试带声；被拦时静音播完并在首次点击补播；音量可配（默认 65）
- **模式**：`session`（每会话一次，推荐）/ `daily` / `always`
- **重播**：设置页提供"重播启动动画"按钮（调 `window.__API__.replay()`）

## 4. 插件工程结构（与 elisa 同构，直接复用成熟契约）

```
dsh-startup-jarvis/
├─ package.json            # dsh.bundle.patch = ./cordis.patch.yml; dsh.client.inject; platform=web
├─ cordis.patch.yml        # 注册 splash + 设置页
├─ lib/index.js            # 宿主半侧：/dsh-jarvis 路由、首屏注入、真实 facts、配置原子写
├─ lib/splash.js/.css      # 全屏启动层、postMessage 协议、看门狗、交接转场
├─ lib/client.js           # 设置页（开关/模式/音量/速度/跳过/重播）
├─ lib/assets/             # jarvis-1080p.mp4 + poster.jpg（+ 可选 1440p）
├─ test/                   # 冒烟：配置归一化 / 协议 / 转场时序 / 降级链
└─ releases/               # tgz
```

- 配置文件：`~/.dsh/dsh-startup-jarvis.json`
- 协议：iframe/子层 → 宿主 `{type:'ready'|'progress'|'done', ...}`；宿主 → 子层 `{type:'config'|'skip'}`
- 安装：**完全退出 DSH（含托盘）** → `dsh plugin --profile desktop add ./releases/dsh-startup-jarvis-0.1.0.tgz`
- 互斥：安装前需禁用现役启动插件（elisa / moss2 / vyron）；保留旧 tgz 可回滚
- 隔离验证：`DSH_HOME=<临时目录>` + `--profile web`，不拿正在用的实例做试验

## 5. 里程碑与验收证据

| 阶段 | 交付 | 验收 |
|---|---|---|
| M0 素材 | 1080p H.264 成片（已完成 35.3MB；再出 CRF23 版 ≈20MB）、poster | 本地浏览器能播、首帧 <1.5s、体积记录 |
| M1 预演片 | **把 DSH 叠加层 + 转场做进一条预览 mp4** 给你审 | 关键帧截图 + mp4 目视 |
| M2 插件骨架 | 插件包 + 隔离 profile 跑通 | 冒烟断言（转场时序/降级/配置）+ 截图 |
| M3 真机安装 | desktop profile 安装成功 | `require(profile/node_modules/dsh-startup-jarvis/lib/index.js)` 通过 + 你重启实测 |
| M4 收尾 | 设置页 + 测试全绿 + tgz 发版 | 断言清单 + 版本号 + SHA256 |

## 6. 风险与待核实

- **HEVC 不可播**（已通过转码规避）；4K 解码性能（已降 1080p）
- **31s 启动耗时长**：默认 `session` 模式 + Skip + 进度条；可再剪 12s 短版
- 自动播放音频受限（有兜底，但桌面端体验需实测）
- 与现役启动插件互斥（要停用，属可逆操作）
- 片中人声与字幕是否同步——**待音频核验报告**（`audio/clip-analysis.md`）
- 窗口右上 □✕ 由宿主 titleBarOverlay 绘制，插件无法隐藏（既有结论，不做无边框启动窗）

## 7. 需要你拍板

1. **叠加方案**：A 全部烧进视频（最稳，改字要重出片）/ **B 烧进视觉 + 4 行动态数据用 HTML 叠加（推荐）**
2. **转场触发**：30.2s 爆闪处交接（推荐，省掉黑尾）/ 等视频播完（会看 1s 黑场）
3. **转场效果**：白闪 + 扫描线显影（推荐）/ 光圈收束 / 交叉淡化
4. **音频**：默认有声（65 音量）/ 默认静音
5. **播放时机**：每会话一次（推荐）/ 每天一次 / 每次打开
