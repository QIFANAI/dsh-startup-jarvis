# JARVIS · 操作界面全套皮肤（v0.6）总规划

> 状态：**Hero/Chat/侧栏/浅色/表格/安装链路已通；待 Electron 真机 + 桌面安装后回滚**｜2026-11-20｜作者：lead
> 上游：启动动画 v0.5 已交付（`out/jarvis-v0.5-preview.mp4`）
> 背景素材：`<本机素材>/1607138105878fcd84ed13f48a.mp4_last.mp4（未随仓库分发）`
> 目标：把启动动画的视觉语言延伸到整个 DSH 操作界面；视频作为操作页背景，合理无限循环。
> 本文只做规划与验证，不改插件、不改 profile、不动界面。

---

## 0. 先把你这句话拆开（我的理解）

| 你的原话 | 我的理解 | 对应交付 |
|---|---|---|
| “启动动画层面已经解决了” | 启动片本身不再改；交接点之后才是本次战场 | 只改 `handoff` 之后的界面层，不碰成片与音轨 |
| “配套的 UI 界面优化” | 视觉语言要和启动片同源，不是套一个通用暗色主题 | 从成片取色 + 同一套 HUD 语法 + 同一个交接动作 |
| “全方位的优化” | 不是只换会话框；框架、侧栏、顶栏、消息流、工具卡、输入区、弹层、设置页、空态、滚动条、焦点全都要 | 第 6 节逐区规格（约 40 个面） |
| “标准可以参考之前的毛玻璃、动效会话框” | 以 elisa 0.6 的玻璃/流光、vyron 0.2 的星海/对比度/性能方法为基线 | 玻璃配方、会话生命周期动效、对比度与性能验收 |
| “主题同时也是动态背景的素材” | 视频不是壁纸，它是主题的取色源与氛围源 | 从视频抽色 → 赤金 HUD 调色板；背景与主题同源 |
| “它作为操作页面的背景合理的无限循环” | 要的是“看不出接缝、不烦人、不挡字、不烧 GPU”的循环 | 第 5 节：循环策略、合成层、场景明暗、性能降级 |
| “要多细有多细，要多全面有多全面” | 规划要能直接当施工图 | 选择器、token、文件、时序、验收数字全部写死 |
| “先别直接做” | 本轮只出方案与可行性证据 | 已做只读审计与素材试算；未改任何插件文件 |

**一句话结论**：这次不是“给 DSH 换个皮”，而是把操作界面做成 **JARVIS 战情室**——**黑玻璃仪表盘浮在赤金 HUD 的核心影像之上**；背景是“活的核心”，玻璃是“仪器面板”，会话框是“会呼吸的仪表”。

---

## 1. 结论先行（我建议做成什么样）

### 1.1 四档 + 三预设 + 三背景模式

| 维度 | 选项 | 默认 |
|---|---|---|
| 装饰档位 | `off` / `accent`（仅 token）/ `full`（token+装饰）/ `glass`（+视频背景+毛玻璃） | `glass` |
| 主题预设 | `mark7` 赤金 HUD / `hud` 冷青终端 / `noir` 暗夜单色 | `mark7` |
| 背景模式 | `ambient` 氛围（预模糊视频）/ `hud` 清晰 HUD（原片细节）/ `poster` 静态海报 / `off` | **`hud`（已拍板）** |
| 循环模式 | `power-cycle` 整段 30s 电源循环 / `continuous` 24.2s 烘焙交叉淡入 / `static` | `power-cycle` |
| 动效 | `full` / `reduced` / `off` | `full`（并尊重系统 `prefers-reduced-motion`） |

### 1.2 三条主线

1. **背景**：视频是“核心影像”，不是壁纸。默认 `hud` 清晰版 + 暗角 + 中心遮罩 + 场景明暗；`ambient` 预模糊作为低配/省电/不抢字的备选。
2. **玻璃**：只给 2–3 个关键面做真玻璃（侧栏、输入卡、弹窗）；其余面用“半透膜 + 高光边 + 噪点”做视觉玻璃，避免每帧全屏 backdrop blur。
3. **会话动效**：**状态驱动，不装饰**。空闲→聚焦→发送→流式→收尾，每个状态有且只有一个主运动；不做随机抖动、不做每行乱飞。

### 1.3 三条硬约束（沿用 elisa/vyron 的验收口径）

- **不改布局**：宿主元素不写 `width/height/margin/padding/border`；描边一律用 `box-shadow: inset 0 0 0 1px`；装饰只用伪元素或 `pointer-events:none` 的 fixed 层。
- **不改字号/行高/字重/主字体栈**：正文一个字都不碰；HUD 小标签只出现在伪元素/装饰层，且面积 ≤ 5%。
- **一键可退**：`off` 档 html 上没有 `dj-skin` 类，皮肤 CSS 零命中；关闭后移除背景层、token 覆盖、所有装饰，恢复原版。
- **唯一布局例外（2026-11-20 用户拍板 concept=actual）**：Hero 侧栏 345px、header 标题/tabs/模型铭牌、标题/工作区 -38px、输入卡 absolute 到底部、01/02 chips；聊天/任务/设置仍零位移（`tools/measure-chat-layout.mjs` pass）。

---

## 2. 现状审计（只读实测，2026-11-19）

### 2.1 运行环境

| 项 | 值 | 依据 |
|---|---|---|
| DSH Desktop | **0.2.2-rc.5** | `E:\dsh\DeepSeek Harness.exe` VersionInfo；`app.asar` 内 `dsh/package.json` |
| Web 前端 | `dsh-web-frontend` rc.5；`index-CSAdOBx6.css` / `index-Ciz7DZxv.js` | asar 内 dist |
| Profile | `desktop`；已装 `dsh-startup-jarvis@0.2.2` | `~/.dsh/profiles/desktop/package.json` |
| 当前插件 | Host：`/api/dsh-jarvis` + `tapIndex` + `index-inject`；Client：仅设置页 + 5.5% 径向光 + 10% 扫描线 | `package/lib/index.js` / `client.js` / `splash.js` |
| 当前观感 | **没有毛玻璃、没有背景层、没有会话动效**；截图为默认暗色 | `out/bg-ref/live-window.png` |
| 皮肤相关参考 | elisa 0.6（玻璃/FLOW 输入框）、vyron 0.2（星海/对比度/性能）、moss2 host-map（rc.1 DOM 测绘） | 本机项目目录 |

### 2.2 已核实的 rc.5 钩子（本次规划直接可用）

| 用途 | 选择器/属性 | rc.5 证据 |
|---|---|---|
| 皮肤作用域 | `html.dj-skin`（自定义类） | 宿主不占用 html class |
| 明暗 | `body[data-ds-dark-theme]`；浅色 = 无该属性 | ui-layout ThemePresenter |
| 应用框架 | `[class*="mP3x-q_frame"]` / `[class*="sidebarCol" i]` / `[class*="centerCol" i]` / `[class*="rightbarCol" i]` / `[class*="bottomRow" i]` | rc.5 layout CSS 哈希未变 |
| 侧栏 | `[class*="sidebarCol" i]`、`[data-sidebar-collapsed]`、`[data-sidebar-scrollport]`、`[role="treeitem"][aria-selected]` | rc.5 |
| 会话根 | `[data-phase]`（`hero`/`active`/`settling`）、`[data-content-phase]`、`[data-conversation-region="chat"|"composer"]` | rc.5 conversation |
| 会话滚动 | `[data-conversation-scroll]`、`[data-chat-flow]`、`[data-chat-flow-key]`、`[data-chat-turn]`、`[data-chat-flow-kind]` | rc.5 chat |
| 运行态 | `[data-chat-running]`（DEEP DIVING 行）、`[data-process-activity]`（thinking/tools/…） | rc.5 chat |
| 用户气泡 | `[data-message-bubble]` | rc.5 chat |
| 流式/思考 | `[data-streaming]`（推理摘要）、`[data-preview]`、`[data-error]` | rc.5 chat |
| 输入卡 | `[data-composer-card]`（宿主已 `position:relative`、`border-radius:28px`）、`[data-composer-seat]` | rc.5 conversation |
| 输入状态 | `[data-sending]`（发送按钮）、`[data-composer-composing]`、`[data-composer-input]`、`[data-input-fold]` | rc.5 conversation |
| 弹层 | `[role="dialog"]`、`[class*="_dialog" i]`、`[class*="_mask" i]`、`[role="menu"]`、`[data-menu-material]`、`[class*="_material" i]` | rc.5 |
| 代码块 | `.md-code-block`、`[data-code-block-banner]` | rc.5 shell CSS |
| 滚动条 | `--dsh-scrollbar-*` / `--dsw-alias-scrollbar-*` | rc.5 |
| 主题 API | `ctx.theme.overrideTokens(source, { token: {light,dark} })`、`ctx.theme.register` | rc.5 theme client |
| 插槽 | `settings.section`、`shell.overlay`、`sidebar.brand.mark`、`conversation.hero.brand.mark` | rc.5 Slots |

> 说明：moss2 的 host-map 基于 rc.1；本次用到的钩子已在 rc.5 asar 里逐条复核（类哈希 `mP3x-q` 未变）。完整 token 数量未逐一重数，仅确认 `--dsw-menu-backdrop-filter` / `--dsw-mask-blur` 仍在。实现前仍会跑一遍 DOM 断言（见 §12）。

### 2.3 背景素材实测

| 项 | 值 |
|---|---|
| 容器/编码 | MP4 / H.264 / 2560×1440 / 30fps / 30.000s / 16.6 MB / 4.4 Mbps / **无音轨** |
| 构图 | 左侧 15–70% 是主 HUD 圆盘 + 红色线框人像；右侧 75–93% 是第二个圆形仪表；上下大量纯黑 |
| 亮度 | 0–1.8s 淡入（YAVG 21→27.8），1.8–28.5s 稳定（≈28），28.5–30s 淡出（→21.8） |
| 首尾帧 | 平均绝对差 **0.60/255**，最大差 238（极少数像素）→ **整段 30s 直接 loop 天然无缝** |
| 取色 | 暗红 `#400010`/`#601020`，亮红均值 `#8c2130`，线稿近白 `#b2afb4`，底黑 `#050507` |
| 结论 | 适合做“底黑 + 赤金发光线稿”的氛围背景；不适合做高亮壁纸（会压字） |

### 2.4 现有实现的缺口（本次要补的）

1. **设置页保存是空转**：client 的 `patch()` 发 `GET /config?patch=...`，但 Host `configRoute` 只读不写；界面显示“已保存”，文件未落盘。新皮肤上线前必须先修这条链路。
2. 没有 `skin.css` / `skin.js`，没有背景层；现有 theme 只是 5.5% 径向光 + 10% 扫描线。
3. 没有交接后的分区显影（只有 splash 自己淡出）。
4. 没有会话动效；没有输入卡状态（idle/focus/sending/streaming）。
5. 没有毛玻璃 token 映射；没有浅色/降级路径。
6. 没有性能开关与诊断面板。
7. 没有背景视频的暂停/隐藏页/自动播放失败策略。
8. 没有 UI 断言与截图验收。
9. 没有“安全模式”（皮肤导致黑屏时如何一键回退）。
10. 没有皮肤规格文档与版本兼容报告。

---

## 3. 设计概念

### 3.1 一句话

**“系统早就在线，界面只是它的一层玻璃仪表。”**
背景 HUD 是系统内核，玻璃界面是给主人看的仪表盘；不做“科技感堆料”，做“克制的贵”。

### 3.2 三个空间层

| 层 | 内容 | 亮度 | 运动 |
|---|---|---|---|
| L0 核心影像 | 视频（预模糊或清晰）+ 暗角 + 颗粒 | 15–35% | 视频自身 30s 循环 + 极轻视差 |
| L1 玻璃仪表 | 侧栏、输入卡、弹窗、菜单 | 半透 | 呼吸、流光、状态脉冲 |
| L2 内容 | 正文、代码、表格、工具卡 | 高对比 | 只做入场/收尾，不做持续动画 |

### 3.3 三条动效原则

1. **状态驱动**：每个动效必须对应一个真实状态（focus/sending/streaming/error/dialog），不做“为了动而动”。
2. **呼吸而不抖动**：环境层用 6–12s 的低频呼吸；交互层用 120–520ms 的干脆反馈；禁止随机 jitter。
3. **可降级**：任何动效都有 `reduced` 与 `off` 版本；关掉动效后界面仍然完整、好看。

### 3.4 与启动动画的连续性

- **色彩**：启动片 v0.5 已把第一幕改成赤金（热橙 `#FF5A1F`、金 `#FFC46B`、暗红 `#FF2D1A`，DSH 青只做品牌点缀）→ 皮肤沿用同一套。
- **语法**：方括号 `[ … ]`、`//`、`< … />`、等宽小标签、环形刻度、扫描线、四角枢轴。
- **交接**：splash 的白闪 + 扫描线 → 背景 HUD 亮起 → 侧栏/顶栏/输入卡分时显影。**不切黑、不闪白屏**。
- **身份**：DSH 品牌（deepseek HARNESS）保留；JARVIS 作为“系统代号”出现在小标签与空态，不抢主品牌。

### 3.5 反目标（明确不做）

- 不重排布局、不改字号/行高/字体栈、不替换 DSH 图标体系。
- 不做全屏 RGB 故障、不做随机抖动、不做每帧 `blur()` 动画。
- 不做“每行消息都飞入”的廉价动效；历史消息不回放。
- 不做视频全屏高亮壁纸；不为了炫技牺牲可读性。
- 不引入外部字体/CDN；全部离线可用。

---

## 4. 视觉系统

### 4.1 调色板（`mark7` 默认，深色）

| 角色 | token | 值 | 用量 |
|---|---|---|---|
| 最深底 | `--dj-void` | `#030405` | 背景兜底 |
| 应用底 | `--dj-base` | `#050608` | 60% |
| 面板 1 | `--dj-panel-1` | `#0a0c10` | 侧栏/卡片 |
| 面板 2 | `--dj-panel-2` | `#0e1116` | 输入卡/弹窗 |
| 主文字 | `--dj-ink` | `#eef2f6` | 30% |
| 次文字 | `--dj-ink-2` | `#b9c2cc` | — |
| 三级 | `--dj-ink-3` | `#8a959f` | — |
| 弱化 | `--dj-ink-4` | `#5f6870` | — |
| 主强调（金） | `--dj-gold` | `#ffc46b` | 8% |
| 金亮 | `--dj-gold-hi` | `#ffd89a` | 高光 |
| 金暗 | `--dj-gold-deep` | `#b07a2a` | 描边 |
| 能量（赤） | `--dj-crimson` | `#ff3b30` | 2% |
| 深赤 | `--dj-crimson-deep` | `#8a0e14` | 背景/阴影 |
| 品牌青 | `--dj-cyan` | `#2fd3e8` | ≤1% |
| 成功 | `--dj-green` | `#54d98c` | 语义 |
| 警告 | `--dj-amber` | `#f5b942` | 语义 |
| 错误 | `--dj-red` | `#ff5a5a` | 语义 |
| 线 1 | `--dj-line-1` | `rgba(255,255,255,.055)` | 分隔 |
| 线 2 | `--dj-line-2` | `rgba(255,255,255,.09)` | 卡片边 |
| 线 3 | `--dj-line-3` | `rgba(255,255,255,.13)` | 强边 |
| 线 4 | `--dj-line-4` | `rgba(255,255,255,.18)` | 高光边 |

> 取色依据：视频帧量化后暗红 `#400010`/`#601020`、亮红 `#8c2130`、线稿 `#b2afb4`。金与青来自启动片 v0.1/v0.5 的既有语言，用于把“视频红”收束成 JARVIS 赤金，而不是变成纯红警报界面。

### 4.2 浅色“昼面”（`body:not([data-ds-dark-theme])`）

| 角色 | 值 |
|---|---|
| 底 | `#e9edf1` |
| 面板 | `rgba(255,255,255,.62)` |
| 主文字 | `#0b0f14` |
| 次文字 | `#3a4653` |
| 金（对浅底 AA） | `#a96600` |
| 赤（对浅底 AA） | `#c21d2a` |
| 青 | `#087d8f` |
| 线 | `rgba(10,14,20,.06/.10/.14/.18)` |

浅色下背景视频默认降为 `poster` + 8–12% 灰度叠层；不把暗色 HUD 硬生生铺在白底上。

### 4.3 字体与排版

- 正文/标题：**沿用宿主字体与字号**，一行不改。
- HUD 标签：`ui-monospace, "Cascadia Mono", Consolas, monospace`；10–11px；`letter-spacing:.08em`；全大写英文/数字；只出现在伪元素、装饰层、设置页预览。
- 中文标签：使用宿主中文字体，不用全大写，不加字距。
- 数字：`font-variant-numeric: tabular-nums`（仅装饰层与设置页）。

### 4.4 圆角 / 阴影 / 描边

| 元素 | 圆角 | 阴影/描边 |
|---|---|---|
| 侧栏 | 0（整列） | 右缘 `inset -1px 0 rgba(255,255,255,.06)` |
| 输入卡 | `var(--dsw-radius-panel)` 28px | `0 24px 60px rgba(0,0,0,.55)` + 内顶高光 |
| 弹窗 | 28px | `0 40px 100px rgba(0,0,0,.65)` |
| 菜单 | 16px | `0 18px 50px rgba(0,0,0,.45)` |
| 工具卡/代码块 | 12–16px | 1px 半透边 + 内顶高光 |
| 按钮 | 8–12px | 1px 边 + hover 金色微光 |

### 4.5 玻璃配方（5 种）

| 编号 | 用途 | 背景 | blur | 边/高光 | 备注 |
|---|---|---|---|---|---|
| G1 | 侧栏 | `linear-gradient(180deg, rgba(8,10,14,.78), rgba(6,8,11,.62))` | `blur(22px) saturate(125%)` | 右缘 1px + 内顶 1px | 唯一的大面积真玻璃 |
| G2 | 输入卡 | `linear-gradient(180deg, rgba(14,17,22,.72), rgba(9,11,15,.80))` | `blur(26px) saturate(130%)` | 1px `rgba(255,255,255,.10)` + 金环 | 重点面 |
| G3 | 弹窗/菜单 | `rgba(10,12,16,.86)` | `blur(36px) saturate(140%)` | 1px `rgba(255,255,255,.12)` | 阅读优先 |
| G4 | 工具卡/代码块 | `rgba(255,255,255,.025)` | 无 | 1px `rgba(255,255,255,.06)` | 不做 backdrop，省性能 |
| G5 | 用户气泡 | `rgba(255,196,107,.08)` | 无 | 1px `rgba(255,196,107,.20)` | 用色彩区分，不用大模糊 |

**性能口径**：`backdrop-filter` 同时可见 ≤ 3 个；`ambient` 模式下视频已预模糊，G1/G2 可降为“半透膜 + 边光”（无 backdrop），只有弹窗保留 G3。这样既有玻璃感，又不让合成器每帧重算整屏。

### 4.6 HUD 装饰语法

- **四角枢轴**：`#root` 的 fixed 伪元素，四个 L 形角标，线宽 1px，颜色 `rgba(255,196,107,.22)`；距离视口边 14px；避开 Windows 原生按钮区（右上留 ≥140px）。
- **顶栏状态**：`header[data-window-drag]::after` 显示 `MODEL // deepseek-flash`（`content: attr(data-dj-model)`），10px mono，右对齐，距右 28px。
- **侧栏刻度**：侧栏底部 24 根 1px 刻度线，呼吸透明度 0.18↔0.34，周期 6.8s。
- **扫描线**：全屏 3% 透明度的 1px/3px 横线，`mix-blend-mode: overlay`；可 0–100 调。
- **颗粒**：SVG feTurbulence 静态噪点，3–5% 透明度；fixed 层，不逐帧。
- **空态反应堆**：`[data-phase="hero"]` 的伪元素画一个 520px 的同心环（仅描边，低亮），在标题后方缓慢呼吸；不遮字。

### 4.7 三套预设

| 预设 | 底 | 主强调 | 次强调 | 背景处理 | 气质 |
|---|---|---|---|---|---|
| `mark7` 赤金 | `#050608` | 金 `#ffc46b` | 赤 `#ff3b30` | 视频原色，氛围 0.72 | 默认；最接近启动片 |
| `hud` 冷青 | `#04070a` | 青 `#2fd3e8` | 白 `#eef2f6` | 视频饱和度 ×0.55、蓝青遮罩 | 冷峻终端 |
| `noir` 暗夜 | `#030405` | 白 `#e8edf2` | 金 `#c9a46a` | 视频灰度、亮度 ×0.55 | 极简、最安静 |

预设只改 token、背景滤镜和装饰强度，不改布局。

---

## 5. 背景系统（核心难点）

### 5.1 循环策略对比（已用素材实测）

| 方案 | 做法 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| **A. 电源循环** | 原片 0–30s 直接 `loop` | **首尾帧差 0.60/255，天然无缝**；零预处理；30s 一次“熄屏→重启”，语义上就是 JARVIS 在呼吸 | 每 30s 有约 2.5–3s 变暗 | **默认推荐** |
| **B. 烘焙交叉** | 取 `[2.4,28.2]`，1.6s 交叉淡入烘焙成 24.2s 无缝文件 | 没有变暗段；单文件单解码 | 交叉段数字/人像有 1.6s 重影；需额外资产 | 备选，给“不想变暗”的人 |
| **C. 静态海报** | 只放一张亮帧 + CSS 缓慢推拉/呼吸 | 零解码、零风险、最省电 | 没有视频动态 | 低配/减弱动态/省电兜底 |

> 实测证据：首帧 YAVG 6.27、末帧 6.37；`mean abs diff 0.60`；`max 238` 仅极少数像素。整段 loop 的接缝在视觉上就是“黑到黑”，没有硬切。
> 方案 B 已试做 `out/bg-ref/loop-test.mp4`（24.2s / 14.4MB / 1440p），接缝帧数学上相等；但交叉段确实有重影，因此只作为选项。

### 5.2 资产管线

| 资产 | 规格 | 用途 | 预估大小 |
|---|---|---|---|
| `bg-1080.mp4` | 1920×1080 / 30fps / H.264 High / CRF 22 / no audio / faststart | `hud` 清晰模式 + `continuous` 的源 | 10–12 MB |
| `bg-ambient.mp4` | 960×540 / 30fps / 预模糊 `gblur sigma=18` / CRF 26 | `ambient` 低配/省电模式 | 0.3–0.5 MB（实测 345 KB） |
| `bg-loop.mp4` | 1080p / 24.2s / 1.6s 烘焙交叉 | `continuous` 模式 | 8–10 MB（可选，不默认打包） |
| `bg-poster.jpg` | 1920×1080 / 取 15s 亮帧 / 质量 88 | 首帧、autoplay 失败、`poster` 模式 | 150–250 KB |
| `bg-poster-blur.jpg` | 960×540 / 同帧预模糊 | 低配 | 20–40 KB |

编码命令（实现时写入 `scripts/make-bg-assets.mjs` 或 `.ps1`，不手敲）：

```bash
# 清晰 1080p
ffmpeg -y -i "<source>" -vf "scale=1920:1080:flags=lanczos" \
  -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -profile:v high -level 4.1 \
  -movflags +faststart -an bg-1080.mp4
# 预模糊氛围
ffmpeg -y -i "<source>" -vf "scale=960:540:flags=lanczos,gblur=sigma=18,eq=brightness=0.02" \
  -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -an bg-ambient.mp4
# 海报
ffmpeg -y -ss 15 -i "<source>" -frames:v 1 -vf "scale=1920:1080" -q:v 2 bg-poster.jpg
```

> 版权边界：素材为本地自用；如果要公开发布插件，`bg-*.mp4` 不入公开仓库，按“缺失即降级到 poster/CSS 渐变”处理。

### 5.3 合成层（自底向上）

```
#dsh-jarvis-ambient (fixed, inset:0, z-index:-1, pointer-events:none, contain:strict)
├─ video.dj-bg-video        object-fit:cover / contain（超宽）；transform: scale(1.04) + 视差
├─ .dj-bg-scrim             中心椭圆 + 上下渐变；保证正文区亮度上限
├─ .dj-bg-vignette          四周压暗
├─ .dj-bg-grain             SVG 噪点 3–5%
└─ .dj-bg-scan              可选扫描线 0–5%
#root（背景全部清空，内容在其上）
```

关键 CSS 起点值（需真机调）：

```css
.dj-bg-video {
  position:absolute; inset:-4%; width:108%; height:108%;
  object-fit:cover; object-position:50% 45%;
  opacity:var(--dj-bg-opacity,.72);
  filter:brightness(.62) contrast(1.08) saturate(1.05);
  transform:translate3d(var(--dj-px,0),var(--dj-py,0),0) scale(var(--dj-bg-scale,1.04));
  will-change:transform;
}
.dj-bg-scrim {
  background:
    radial-gradient(ellipse 72% 62% at 50% 44%, rgba(3,4,6,.58) 0%, rgba(3,4,6,.30) 55%, rgba(3,4,6,.68) 100%),
    linear-gradient(180deg, rgba(3,4,6,.88) 0%, rgba(3,4,6,.28) 20%, rgba(3,4,6,.46) 78%, rgba(3,4,6,.86) 100%);
}
```

**超宽/竖屏**：视频本身是黑底，`object-fit:contain` 造成的“黑边”与背景融合，不会露出白框。规则：
- `aspect-ratio >= 21/9` 或 `<= 4/3` → `object-fit:contain; transform:scale(1.02)`（保证 HUD 不被裁掉）。
- 其他 → `cover`。
- 这样 21:9 超宽/窄窗口都能看到完整 HUD。

### 5.4 场景状态机（纯 CSS 优先）

| 状态 | 触发（rc.5 属性） | 背景变化 | 目标 |
|---|---|---|---|
| hero | `[data-phase="hero"]` | opacity .85；中心遮罩更透 | 空会话时“核心”最亮 |
| chat | `[data-phase="active"]` | opacity .62；文本区遮罩更强 | 阅读优先 |
| settling | `[data-phase="settling"]` | 保持 chat；不做跳变 | 避免交接闪烁 |
| focus | `[data-composer-card]:focus-within` | opacity .52；额外径向压暗 | 输入时降噪 |
| sending | `[data-sending]` | 金环脉冲一次 | 提交反馈 |
| streaming | `[data-chat-running]` | 赤色环境光轻微上浮 | 系统在工作 |
| dialog | `[role="dialog"]` | opacity .38；遮罩加深 | 弹窗阅读 |
| light | `body:not([data-ds-dark-theme])` | 切 poster/低透 | 昼面 |

实现方式：`html.dj-skin:has([data-composer-card]:focus-within)`、`html.dj-skin:has([role="dialog"])` 这类“全局面”可以直接用 `:has()`；但 **hero/chat/streaming 必须绑定“当前可见会话”**——DSH 可能同时挂载后台会话，后台的 `[data-phase="hero"]` 或 `[data-chat-running]` 会把全局状态带偏。因此：`skin.js` 在会话切换/属性变化时，取可见的 `[data-phase]` 根（`offsetParent !== null`）写入单一属性 `html[data-dj-scene="hero|chat"]` 与 `html[data-dj-streaming]`；CSS 只读这两个属性。focus/dialog 仍可用 `:has()`。若 `:has()` 实测样式重算超预算，focus/dialog 也一并改 JS 状态。

### 5.5 视差与呼吸

- 指针视差：`pointermove` → 目标 `±8px / ±5px`，阻尼 `τ=0.35s`，rAF 写入 `--dj-px/--dj-py`；只在 `pointer:fine` 且 motion=full 时启用。
- 呼吸：金环/侧栏刻度/扫描线用 6–12s 低频透明度/缩放；不用 filter/blur 逐帧。
- 视频本身的速度：默认 1.0；可选 0.85（更安静）。不改视频内容。

### 5.6 视频生命周期

| 时机 | 动作 |
|---|---|
| 页面启动 | 创建 `<video>`，`preload="metadata"`，`muted loop playsinline`，加载 poster；不立即播放 |
| splash 交接开始 | `currentTime = 2.4`（亮帧）→ `play()`；失败显示 poster，首次点击/按键再试 |
| splash 关闭 | 保持播放；把 `dsh-jarvis-booting` 移除，加 `dj-enter` |
| 页面隐藏 | `visibilitychange` → `pause()`；回来 `play()` |
| 弹窗打开 | 不暂停；只降低不透明度/加遮罩（省一次解码状态切换） |
| 减弱动态 | 不播放；只显示 poster + 静态渐变 |
| 低配 | `hardwareConcurrency<=4` 或 `deviceMemory<=4` 或省电模式 → ambient/poster |
| 错误/黑屏 | `error`/`stalled` → poster；连续 2 次 → 切 `poster` 模式并记录诊断 |
| 关闭皮肤 | `pause(); removeAttribute('src'); load();` 移除 DOM |

### 5.7 性能预算（背景）

| 指标 | 目标 | 上限 |
|---|---|---|
| 同时解码视频数 | 1 | 2（仅设置页预览） |
| 同时可见 `backdrop-filter` | 2 | 3 |
| 视频层合成层 | 1 | 1 |
| 主线程每帧样式重算 | < 4ms | < 8ms |
| 60s 掉帧 | < 0.5% | < 1% |
| GPU 内存增量 | < 80MB | < 150MB |
| 隐藏页 CPU | ~0（暂停） | < 1% |

---

## 6. 界面逐区规格（全景）

> 记号：**R** = 保留宿主布局/字号；**C** = 只改颜色/背景/阴影；**D** = 新增装饰层（pointer-events:none）；**M** = 动效。

### 6.1 全局框架（必须清空的 7 个绘制面）

| # | 面 | 现状 | 处理 |
|---|---|---|---|
| 1 | `body` | `--dsw-alias-bg-base` | `background:transparent` |
| 2 | app frame | `bg-base`（Windows 用 sidebar-fill） | 透明；顶栏 40px 由原生 titlebar 覆盖 |
| 3 | sidebar column | `specific-sidebar-fill` | 透明 + G1 玻璃 |
| 4 | sidebar root | 再画一次 sidebar-fill | 透明 |
| 5 | conversation root | `bg-base` | 透明（用 `:has(> [data-conversation-region="chat"])` 定位） |
| 6 | composer card | `specific-input-major` | G2 玻璃（保留卡片自身） |
| 7 | composer seat 渐变 | 36px 不透明渐变 | 换成透明→底色的短渐变，或透明 |

**规则**：
- token 保持**不透明**（`--dsw-specific-sidebar-fill: #06080b`），因为 Windows 原生 titlebar 会读 computed 值；透明化只落在具体元素上。
- 所有清空用 `!important` 仅限这 7 个面；其他一律靠特异性。
- 装饰层 `z-index` ≤ 901（宿主弹窗 1000+）；splash 仍是 2147483000。

### 6.2 Windows 标题栏 / 顶栏

| 项 | 处理 |
|---|---|
| 原生 titlebar 40px | 颜色 `#06080b`（深）/ `#e9edf1`（浅）；**无法透明/放视频**，接受实色 |
| titlebar 下缘 | fixed 1px 金线 `rgba(255,196,107,.14)`，仅在非全屏时显示 |
| `.header`（76px） | 透明；底边 1px `rgba(255,255,255,.07)`；交接时 420ms 落下 |
| 会话标题 | 保持宿主字号；左侧加 2px 金色短竖线（伪元素） |
| tab 条 | 选中项底部 2px 金线 + 轻微上浮 1px；hover 底色 `rgba(255,196,107,.06)` |
| 顶栏右侧 | `MODEL // <model>` 10px mono，`content:attr(data-dj-model)`；距右 28px；不进入原生按钮 140px 安全区 |
| 全屏 | 隐藏 titlebar 下缘金线；顶部安全区归零 |

### 6.3 侧栏

| 区域 | 处理 |
|---|---|
| 整列 | G1 玻璃；右缘 1px；顶部与 frame 同色过渡 |
| 品牌行 | 保留 DSH 字标；右侧加 `MK VII` 10px 金标签（伪元素）；交接 0ms 显影 |
| 新会话按钮 | 半透金底 `rgba(255,196,107,.10)`；1px 金边；hover 亮度 +8%；按下 scale .985（120ms） |
| 导航项（插件/自动化任务/更多） | hover 底色 `rgba(255,255,255,.04)`；当前项左 2px 金线 + 金点 |
| 工作区标题行 | 搜索/新建按钮 hover 金；标题右侧计数 10px mono |
| 会话行 | 默认透明；hover `rgba(255,255,255,.035)`；选中 `rgba(255,196,107,.09)` + 左 2px 金线 + 标题 500 字重（不改字号）；时间 11px |
| 归档/折叠行 | 降低到 55% 不透明度；hover 恢复 80% |
| 侧栏底部 | 设置入口 + 24 根刻度线（D，6.8s 呼吸）；版本号 10px mono |
| 收起态 | 56px 轨道；图标居中；hover 显示 tooltip；金点表示有运行任务 |

### 6.4 空会话 Hero

| 元素 | 处理 |
|---|---|
| 背景 | 场景 `hero`，视频不透明度 .85；中心遮罩更透 |
| 大标题 | 保留宿主字号；下方加 1px 金色分隔线（240px 宽，居中） |
| 品牌 mark | 默认 DSH；可选 `reactor` 预设（`conversation.hero.brand.mark` 插槽）在后方加 520px 同心环 |
| 快捷入口 | 玻璃小卡 G4；hover 金边；不做飞入 |
| 输入卡 | 已在 hero 底部；G2 玻璃 + 金环 |
| 角落 | 四角枢轴 + 左下 `SYSTEM // READY` 10px mono（D） |

### 6.5 会话流（消息）

| 元素 | 处理 | 动效 |
|---|---|---|
| 用户气泡 | G5；1px 金边；圆角 20px；文字保持宿主 | 入场 180ms 淡入 + 6px 上浮 + 0.995→1；仅新节点 |
| 用户头像/时间 | 10px mono；时间在气泡下方右对齐 | 淡入 200ms |
| 助手正文 | 透明；行高/字号不动；链接金色下划线 dot；`strong` 宿主 | 无持续动画 |
| 标题 h1–h6 | 左侧 2px 金线（h1/h2）；上下间距不动 | 无 |
| 列表 | marker 金色 60% | 无 |
| 引用 blockquote | 左 2px 金线 + `rgba(255,196,107,.04)` 底 | 无 |
| 行内代码 | `rgba(255,255,255,.06)` 底 + 1px 边；不换字体 | 无 |
| 代码块 | G4；顶部 banner `rgba(255,255,255,.03)`；语言标签金 mono；复制按钮 hover 金；左侧 2px 金线 | banner 淡入 160ms |
| 表格 | 表头 `rgba(255,255,255,.03)`；行 hover `rgba(255,255,255,.025)`；分隔线 line-1 | 无 |
| 图片 | 1px 边 + 轻阴影；圆角 12px；不裁切 | 加载完淡入 200ms |
| 附件 | 玻璃 chip；图标金；hover 边亮 | 180ms |
| 链接 | 金色；hover 下划线 | 120ms |
| 错误卡 | 赤色 1px 边 + 10% 底；图标赤 | 无抖动；可选 600ms 赤光呼吸一次 |
| 系统/压缩/上下文卡 | G4；左侧 1px 灰线；标题 11px mono | 无 |

### 6.6 工具卡 / 推理 / 运行行

| 元素 | 处理 |
|---|---|
| 工具卡外壳 | G4；1px 边；hover 边金 .18；展开时边金 .26 |
| 工具卡标题 | 图标金；名称 13px；右侧状态点（running 金 / done 绿 / error 赤） |
| 工具卡正文 | 代码/输出用 `rgba(0,0,0,.18)` 底；最大高度不变 |
| 推理行 | 左侧 2px 青色细线（仅推理，表示“系统内部”）；摘要 12px 灰；展开正文保持宿主 |
| 过程组（step-process） | 行间 1px 虚线；运行中标题 shimmer 金色；完成后 600ms 金色→灰 |
| 运行行 `[data-chat-running]` | 保留宿主文案/动画；外层加 1px 金边 + 扫描光带 2.8s；右侧计时器 mono |
| Todo 面板 | G4；状态点语义色；进行中行左侧金线 |
| 队列/提交回显 | 虚线金边；滑入 180ms |
| 回合尾部操作 | 默认 0.55 透明度；hover 1；金 hover；不改变布局 |

### 6.7 输入区（Composer，重点）

| 部分 | 处理 |
|---|---|
| 卡片 | G2；28px 圆角；1px 金环 + 呼吸；`position:relative` 宿主已给 |
| 金环（核心） | `::before` 1.6px conic 环：两段窄高亮弧（金 34° / 赤 166°）+ 低亮底环；`@property --dj-ring-angle` 旋转 12s；呼吸 6.4s（opacity .55↔1） |
| 泛光 | `::after` 同弧 `blur(7px)`，反向 15s，呼吸同步；聚焦整体 ×1.25 |
| 状态 | `focus-within` → 环亮、旋转 6s、背景压暗；`[data-sending]` → 发送按钮金旋转 + 一次 240ms 脉冲；`[data-chat-running]` → 环变赤、呼吸加快到 4.8s |
| 输入文字 | 宿主；caret 金色；placeholder `rgba(255,255,255,.32)` |
| 工具行 | 模型/权限/计划控件：hover 金底；不改变尺寸 |
| 发送按钮 | 金底黑字；hover 亮 8%；按下 scale .96；sending 时 spinner + 金环 |
| 附件区 | 玻璃 chip；拖拽时金色虚线边 |
| 队列 dock | 虚线金边；滑入 180ms |
| IME | `[data-composer-composing]` 时环暂停呼吸，避免干扰输入 |

### 6.8 右侧栏 / 面板

| 元素 | 处理 |
|---|---|
| 右栏容器 | 透明；打开时 G1 变体（低透） |
| tab | 金底线；hover 金 |
| 文件树 | 行 hover；选中金线；图标金/灰 |
| 预览/差异 | 玻璃边框；代码 token 保持宿主 |
| 拖拽手柄 | hover 金色 1px |

### 6.9 菜单 / 弹层 / 对话框 / Toast

| 元素 | 处理 |
|---|---|
| 菜单材质 | 覆盖 `--dsw-menu-surface-fill: rgba(12,15,20,.84)`；`--dsw-menu-backdrop-filter: blur(40px) saturate(140%)`；1px 高光边 |
| 菜单项 | hover 金底 8%；选中金点；危险项保持宿主红 |
| 上下文菜单 | 同上；分组标题 10px mono |
| 弹窗 | G3；28px；1px 边；标题左侧 2px 金线；遮罩 `rgba(0,0,0,.55)` + blur 8px（宿主已有） |
| 确认框 | 同上；危险按钮赤；主按钮金 |
| Toast | G3 小号；1px 金边；左侧状态色条；滑入 180ms |
| Tooltip | `rgba(10,12,16,.92)` + 1px 边；保持宿主动画 |
| 快捷键弹窗 | 玻璃；键帽金色边 |

### 6.10 设置页（宿主 + 本插件）

- 宿主设置页：卡片 G4；分组标题 11px mono；开关/步进器/选择器跟皮肤 token；不改变控件尺寸。
- 本插件设置页（重做）：左侧二级导航（播放 / 外观 / 交接 / 诊断 / 关于）；右侧内容。
  - **外观**：3 个预设卡（带小预览）、金/赤/青强调色、玻璃强度滑杆、背景模式（ambient/hud/poster/off）、强度/模糊/颗粒/扫描线/视差开关、动效档位。
  - **播放**：启动动画现有控制（启用/时机/音量/交接点/跳过）+ 小预览。
  - **交接**：白闪/扫描线开关、减少动态、交接时长。
  - **诊断**：DSH 版本、插件版本、视频 readyState/dropped frames、backdrop-filter/`:has` 支持、reduced-motion、当前场景、当前 CSS 变量、复制诊断 JSON。
  - **关于**：文件路径、日志、恢复默认、导出配置、安全模式说明。
- 所有控件**即时生效**并落盘（先修 Host 的写配置链路）；不要求重启。

### 6.11 滚动条 / 选区 / 焦点

| 项 | 值 |
|---|---|
| 滚动条 | 10px；thumb `rgba(255,255,255,.14)`；hover 金 35%；track 透明 |
| 选区 | `rgba(255,196,107,.30)`；文字 `#0b0e12` |
| 焦点环 | 1.5px 金；offset 2px；不改变尺寸 |
| caret | 金色 |

### 6.12 特殊状态

| 状态 | 处理 |
|---|---|
| 长文本/大表格 | 不改宽度；滚动条金色；表格边缘渐隐 |
| 大图 | 1px 边；不放大；点击预览走宿主 |
| 加载/骨架 | 金灰 shimmer；2.4s；reduced 时静态 |
| 空结果 | 玻璃卡 + 10px mono 提示；不写死英文长句 |
| 归档/只读 | 降低装饰强度；金线变灰 |
| 多窗口/窄窗 | <1024 自动收起侧栏；玻璃强度降一档；背景 contain |
| 全屏 | 顶部安全区 0；四角枢轴向内 24px |

---

## 7. 会话动效规格（“动效会话框”）

### 7.1 生命周期（一次发送）

| # | 时刻 | 视觉 | 时长/缓动 | 实现 |
|---|---|---|---|---|
| 1 | 点击发送 | 按钮 scale .96 → 1；金环一次 240ms 脉冲 | 180ms / out | `[data-sending]` + `::before` |
| 2 | 用户气泡出现 | 淡入 + 6px 上浮 + 0.995→1；金边从 0→1 | 180ms / expo-out | `data-dj-enter`（JS 标记新节点） |
| 3 | 运行行出现 | 扫描光带 2.8s + 金点呼吸；环转赤 | 持续 | `[data-chat-running]` |
| 4 | 推理/工具行 | 2px 上浮 + 淡入；运行中标题 shimmer | 160ms / out | `[data-process-activity]` |
| 5 | 工具完成 | 金→灰 600ms；状态点 done 绿 | 600ms | `[data-process-activity]` 变化 |
| 6 | 流式正文 | 不做逐字动画；仅保留宿主光标/骨架 | — | 宿主 |
| 7 | 回合结束 | 运行行淡出 240ms；环金化 600ms；tail 操作 0.55→1 | 240/600ms | `[data-chat-running]` 消失 |
| 8 | 错误 | 赤边 + 一次 600ms 赤光；不抖动 | 600ms | `[data-error]` |

### 7.2 入场规则（防止“历史消息乱飞”）

- 只对**新增**节点加 `data-dj-enter`；用 `WeakSet` 记录已处理节点，滚动回看不重放。
- 只在 `[data-chat-following-tail]` 存在时给新节点动画；不在视口内的节点不加。
- 每 120ms 最多动画 1 个节点；批量工具行合并为一个 180ms 组动画。
- 动画只改 `opacity/transform`，不改 `height/margin`；避免滚动锚定跳动。
- `prefers-reduced-motion` 或 `motion=reduced` → 只保留 120ms 透明度。

### 7.3 状态检测（优先纯 CSS）

```css
/* 安全：输入区内/弹窗的局部队列 */
html.dj-skin:has([data-composer-card]:focus-within) [data-composer-card]::before { ... }
html.dj-skin:has([role="dialog"]) .dj-bg-video { ... }

/* 场景/流式：由 skin.js 只写“当前可见会话”的结果，CSS 不直接 :has 后台会话 */
html.dj-skin[data-dj-scene="hero"] .dj-bg-video { ... }
html.dj-skin[data-dj-streaming] [data-composer-card]::before { ... }
```

`:has()` 适合 focus/dialog 这种全局唯一状态；`hero/chat/streaming` 必须由 `skin.js` 解析可见的 `[data-phase]` 根后再写 `data-dj-scene` / `data-dj-streaming`（后台会话可能同时存在）。若 `:has()` 重算超预算，focus/dialog 也改 JS 状态。

### 7.4 明确不做

- 不做每条消息的 3D 翻转/弹跳/随机延迟。
- 不做输入框“光点绕圈”（elisa v0.5 被用户否掉的廉价感）；用“整圈光场流动”。
- 不做 `filter: blur()` 逐帧动画；不做 `height` 动画；不做全屏 RGB 分离（仅 splash 交接一次）。
- 不在 `data-chat-motion`（宿主折叠动画）作用域内抢动画；避免与宿主滚动锚定冲突。

---

## 8. 动效总表

| # | 元素 | 触发 | 动画 | 时长 | 缓动 | reduced |
|---|---|---|---|---|---|---|
| 1 | 背景 | 交接 | opacity 0→1, scale 1.04→1 | 900ms | expo-out | 200ms 淡入/静态 |
| 2 | 侧栏 | 交接 | translateX(-8px)+fade | 420ms | expo-out | fade 200ms |
| 3 | 顶栏 | 交接 | translateY(-4px)+fade | 360ms/延迟60 | expo-out | fade |
| 4 | 输入区 | 交接 | translateY(10px)+scale(.996)+fade | 520ms/延迟220 | expo-out | fade |
| 5 | 四角枢轴 | 交接 | opacity 0→.22 | 600ms/延迟380 | out | 静态 |
| 6 | 用户气泡 | 新节点 | fade+6px rise+scale | 180ms | out | 120ms fade |
| 7 | 工具/推理行 | 新节点 | fade+2px rise | 160ms | out | 100ms fade |
| 8 | 运行行扫描 | running | 2.8s loop | ∞ | linear | 静态 |
| 9 | 输入金环 | idle | 旋转 12s + 呼吸 6.4s | ∞ | linear/in-out | 静态环 |
| 10 | 输入金环 | focus | 亮度×1.25，旋转 6s | 320ms 过渡 | out | 静态 |
| 11 | 输入金环 | sending | 一次脉冲 + 按钮旋转 | 240ms | out | 无脉冲 |
| 12 | 输入金环 | streaming | 变赤，呼吸 4.8s | 600ms | in-out | 静态赤边 |
| 13 | 侧栏刻度 | idle | 呼吸 .18↔.34 | 6.8s | in-out | 静态 |
| 14 | 会话行 hover | hover | 底色 160ms | 160ms | out | 瞬间 |
| 15 | 菜单/弹窗 | 打开 | 宿主动画；仅加边光 | — | — | 宿主 |
| 16 | Toast | 出现 | 滑入 180ms | 180ms | out | fade |
| 17 | 复制代码 | 点击 | 金闪 240ms + 勾 | 240ms | out | 同 |
| 18 | 发送按钮 | 按下 | scale .96→1 | 120ms | out | 无 scale |
| 19 | 工具完成 | 状态变化 | 金→灰 600ms | 600ms | in-out | 瞬间 |
| 20 | 空态环 | hero | 呼吸 .12↔.22 | 8s | in-out | 静态 |

---

## 9. 技术架构

### 9.1 包结构（v0.3.0）

```
package/
  package.json                 # version 0.3.0; dsh.client 保留
  cordis.patch.yml
  lib/
    index.js                   # Host: 路由 / index 注入 / config 读写 / facts
    splash.js                  # 启动层（现有，只加 handoff 信号）
    splash.css
    skin.js                    # 皮肤运行时：类、token、背景、状态、视差、诊断
    skin.css                   # 皮肤样式（作用域 html.dj-skin）
    client.js                  # 设置页 + 调用 window.__DSH_JARVIS_SKIN__
    assets/
      jarvis-boot.mp4          # 现有启动片
      poster.jpg
      bg-1080.mp4              # 新增（可选）
      bg-ambient.mp4           # 新增（低配/省电）
      bg-loop.mp4              # 新增（continuous 可选）
      bg-poster.jpg
  docs/
    skin-spec.md               # 实现规格（token/选择器/性能/降级）
    v0.6-UI皮肤总规划.md        # 本文
    verify/ui-assertions.md    # 验证报告
```

### 9.2 注入顺序

```
index.html <head>
  <style id="dsh-jarvis-critical">   # splash.css + skin base + 生成的 token 变量
  <script>document.documentElement.classList.add('dj-booting')</script>  # 防 FOUC
<body>
  #root（宿主 UI）
  <script id="dsh-jarvis-skin">      # skin.js：加 dj-skin、建 ambient、读 config
  <script id="dsh-jarvis-splash">    # splash.js：决定是否播、交接时调 Skin.enter()
```

- Web：`webServer.tapIndex` 注入 head/body。
- Desktop：`webserver/index-inject` 行；head 类脚本行需验证是否支持 `placement:'head'`，否则用 body 脚本 + `html.dj-booting` 由 CSS 先隐藏 #root（body 脚本执行前的极短窗口可接受）。
- `skin.js` 先于 `splash.js`；两者失败互不阻断。
- 现有 `tapIndex` 的“already”去重标记保留。

### 9.3 类 / 属性契约

| 名称 | 值 | 用途 |
|---|---|---|
| `html.dj-skin` | 存在=皮肤开 | 所有皮肤规则作用域 |
| `html.dj-skin--glass` / `--full` / `--accent` | 档位 | 装饰/背景/毛玻璃 |
| `html.dj-booting` | 启动期 | 隐藏 `#root`，保留 ambient |
| `html.dj-enter` | 交接后 1.4s | 分区显影动画 |
| `html[data-dj-preset]` | `mark7` / `hud` / `noir` | 预设 |
| `html[data-dj-bg]` | `ambient` / `hud` / `poster` / `off` | 背景模式 |
| `html[data-dj-motion]` | `full` / `reduced` / `off` | 动效 |
| `html[data-dj-scene]` | `hero` / `chat` | 当前可见会话的场景（`skin.js` 解析可见 `[data-phase]`） |
| `html[data-dj-streaming]` | 存在=当前会话在跑 | 当前可见会话的 running 状态 |
| `html[data-dj-state]` | `idle`/`focus`/`dialog` | 可选：`:has()` 不可用时的兜底 |
| `html[data-dj-light]` | 可选 | 浅色强制 |
| `--dj-accent` / `--dj-accent-2` | 颜色 | 主/次强调 |
| `--dj-bg-opacity` / `--dj-bg-scale` | 数值 | 背景 |
| `--dj-glass-alpha` | 0.55–1.45 | 通透度 |
| `--dj-grain` / `--dj-scan` | 0–1 | 颗粒/扫描线 |
| `--dj-px` / `--dj-py` | px | 视差 |

### 9.4 Token 覆盖策略

- **主路径**：`skin.js` 生成 `<style id="dsh-jarvis-tokens">`，写 `html.dj-skin, html.dj-skin body { --dsw-...: value !important; }`。这样不依赖 client 加载，首屏即生效；设置变更时重写该 style。
- **辅路径**：client 可用 `ctx.theme.overrideTokens('dsh-jarvis-skin', { token: {light,dark} })` 做一次官方层覆盖（可选）；由于它写 body inline，优先级高，但卸载时需 dispose。**二选一，默认用 style 方案**（可控、可一次性清除）。
- 覆盖约 40 个语义 token（bg/border/label/business/focus/menu/bubble/input/sidebar/scrollbar/markdown-code）。
- 不改 82 个 `--dsw-static-*` 调色板基色（避免重定义整套配色）。
- 保留 error/warn/success 语义色，不挪用赤色。

### 9.5 设置页与配置

- 修复 Host `configRoute`：`GET` 读；`POST` 写（JSON body）；`reset` 动作；原子写 + `.bak`；写后返回完整 config。
- 配置新增 `skin` 对象（默认见下）；旧 `theme` 字段保留映射，避免旧配置失效。
- 设置页每个控件：本地即时预览 → POST 落盘 → 失败回滚 + 错误提示。
- 关键 schema：

```json
{
  "enabled": true,
  "mode": "session",
  "allowSkip": true,
  "reducedMotion": false,
  "sound": true,
  "volume": 65,
  "handoffAt": 30.2,
  "videoFile": "jarvis-boot.mp4",
  "skin": {
    "enabled": true,
    "preset": "mark7",
    "level": "glass",
    "background": "ambient",
    "loop": "power-cycle",
    "bgOpacity": 72,
    "glass": 55,
    "motion": "full",
    "accent": "#ffc46b",
    "scanlines": 35,
    "grain": 28,
    "parallax": true,
    "focusDim": true,
    "hudCorners": true,
    "lightMode": "porcelain"
  }
}
```

### 9.6 客户端运行时

- `skin.js` 暴露 `window.__DSH_JARVIS_SKIN__ = { apply(config), enter(), exit(), diagnostics(), getState() }`。
- `client.js` 设置页调用 `apply(next)` 即时生效；若 API 不存在则提示“刷新后生效”。
- 视差：`pointermove` → rAF 更新 `--dj-px/--dj-py`；`pointerleave` 回中。
- 诊断：见 §6.10。
- 清理：`ctx.effect` 返回 disposer；关闭时移除 ambient、classes、token style、事件、observer、视频 src。
- 安全模式：URL `?dj-safe=1` 或 config `skin.enabled=false` → 不加载皮肤；splash 仍可用。

### 9.7 版本兼容

- 启动时跑 `compat()`：检查 12 个关键选择器是否命中；缺 3 个以上 → 自动降级到 `accent`（仅 token），并在诊断里列出缺失项。
- 每次 DSH 升级后跑 `docs/verify/ui-assertions.md` 的断言脚本，重新确认。
- 不修改 DSH 安装目录；全部通过 bundle patch 与 webServer 注入。

---

## 10. 性能预算与测量

| 指标 | 目标 | 测量方法 | 不达标动作 |
|---|---|---|---|
| 主线程长任务（>50ms） | < 5 / 60s | PerformanceObserver | 降级 ambient/关视差 |
| 掉帧 | < 0.5% | rAF 采样 + `getVideoPlaybackQuality` | 关 backdrop/切 poster |
| 样式重算 | < 4ms | Performance trace | 去掉 `:has()` 改 JS 状态 |
| 可见 backdrop-filter | ≤ 3 | computed 检查 | 降为半透膜 |
| 背景合成层 | 1 | Compositor 检查 | 去掉额外滤镜层 |
| 隐藏页 CPU | < 1% | 任务管理器 60s | 暂停逻辑修复 |
| 内存增长（5min） | < 50MB | 任务管理器 | 检查 video/observer 泄漏 |
| 包体 | < 60MB | tgz | 降低视频码率/不打包 bg-loop |

**降级阶梯**：`glass+hud` → `glass+ambient` → `full+poster` → `accent`（仅 token）→ `off`。系统 `prefers-reduced-motion` 直接到 `poster`。

---

## 11. 可访问性与降级

| 场景 | 行为 |
|---|---|
| 正文对比度 | 目标 ≥ 7:1；最低 ≥ 4.5:1（WCAG AA）；测量方法见 §12 |
| 二级文字 | ≥ 4.5:1 |
| 焦点环 | 1.5px 金，offset 2px；不依赖颜色单独传达 |
| `prefers-reduced-motion` | 视频暂停/poster；动画 none 或 ≤120ms 透明度；无视差 |
| `prefers-reduced-transparency` | 玻璃面改 94–98% 实心；去掉 backdrop |
| 不支持 `backdrop-filter` | 所有 G1/G2/G3 改实心/半透膜；保留边光 |
| 不支持 `:has()` | 用 `data-dj-state` 兜底 |
| 浅色宿主 | 昼面 token + poster/低透视频；不强行暗色 |
| 视频缺失/损坏 | poster + CSS 呼吸渐变；不报错、不白屏 |
| 自动播放被拦 | poster；首次点击/按键重试；不阻塞 UI |
| 低配/省电 | 自动切 ambient 或 poster；关视差/扫描线 |
| 安全模式 | `?dj-safe=1` / 配置关闭；恢复原版 |

---

## 12. 测试与验收

### 12.1 静态断言（CSS 层）

1. 所有规则以 `html.dj-skin` 开头（`@keyframes/@property` 除外）。
2. 宿主元素无 `width/height/margin/padding/border` 写入；只允许颜色/背景/阴影/滤镜/伪元素。
3. `backdrop-filter` 在 `ambient` 模式 ≤ 1（弹窗），`hud` 模式 ≤ 3。
4. 所有动画都有 `prefers-reduced-motion` 分支。
5. 所有装饰层 `pointer-events:none`；z-index ≤ 901。
6. 无 `!important` 落在 7 个绘制面之外。

### 12.2 DOM 断言（rc.5）

- 逐条检查 §2.2 的 12 个钩子；输出 PASS/FAIL 与命中数。
- 检查 `[data-phase]` 的 3 个值、`[data-chat-running]`、`[data-sending]`、`[data-message-bubble]` 在真实会话中出现。
- 检查设置页能读写 config（POST 后文件变化 + GET 回读一致）。

### 12.3 视觉验收

- 尺寸：1280×820 / 1550×830 / 1920×1080 / 1024×768（抽屉）/ 800×600。
- 场景：hero / chat / tool running / composer focus / dialog / menu / settings / error / light。
- 每张截图记录：分辨率、主题、模式、时间；与基线对比。
- **布局零位移**：12 个关键元素（侧栏、输入卡、气泡、工具卡、tab、菜单等）的 boundingRect 前后差 ≤ 0.5px（装饰除外）。

### 12.4 对比度

- 截图取“正文可能落位区”的第 98 百分位亮度作为最坏背景；按 WCAG 公式计算。
- 目标：正文 ≥ 7:1；二级 ≥ 4.5:1；禁用/装饰 ≥ 3:1。
- 在 `mark7`/`hud`/`noir` × ambient/hud × 深/浅 共 12 组中抽 6 组实测。

### 12.5 性能

- 60s 会话（含流式输出、工具卡、滚动）录 Performance trace。
- 指标：长任务、掉帧、样式重算、合成层、GPU 内存、隐藏页 CPU。
- 对比基线：裸 DSH、ambient、hud、poster 四组。

### 12.6 循环

- 录制 2 个完整周期；检查接缝前后 3 帧：无硬切、无黑闪（power-cycle 的渐暗除外）、无解码卡顿。
- `continuous` 模式：首尾帧 SSIM ≥ 0.999；交叉段无明显双影（人工看 3 遍）。
- 30 分钟挂机：无内存增长、无 video 报错。

### 12.7 负向测试

- 视频文件删除/改名/损坏 → poster/降级，不白屏。
- 自动播放被拦 → poster + 点击重试。
- `backdrop-filter` 不支持 → 实心玻璃。
- `:has()` 不支持 → JS 状态。
- `prefers-reduced-motion` / `prefers-reduced-transparency` → 对应降级。
- 浅色宿主 / 窄窗 / 全屏 / 抽屉模式。
- 皮肤关闭 / 插件禁用 / 卸载 → 原版恢复，无残留 DOM/style。

### 12.8 交接

- 正常播完 handoffAt：白闪→扫描→界面显影→背景 HUD 亮起；无黑帧、无 UI 闪烁。
- Esc 跳过：480ms 版；背景仍亮起。
- splash 关闭但皮肤开：直接进入，背景从 2.4s 亮起。
- splash 开但皮肤关：现有行为不变。
- 两者都关：原版 DSH。

---

## 12.9 P0 概念示意（已产出，待确认）

| 文件 | 内容 |
|---|---|
| `preview/ui-mock.html` | 可复跑的静态示意页（`?scene=hero|chat|focus`） |
| `out/mock-hero.png` | 空会话 Hero：Welcome home, Sir. + 金环 + 输入卡 |
| `out/mock-chat.png` | 会话流：用户气泡、助手正文、工具卡、代码块、运行行、输入卡 |
| `out/mock-focus.png` | 输入区聚焦：背景压暗、金环提亮、发送按钮 |

> 说明：三张图是**概念示意**，用静态 HTML 复刻 DSH 布局与皮肤语言，不是最终实现；像素、字号、间距以真实宿主为准。P0 验收点：方向、明暗平衡、玻璃质感、输入环状态；不验收 DOM 选择器。

---

## 12.10 P1 皮肤底座证据（已跑通）

| 证据 | 路径 |
|---|---|
| 空白会话 | `out/p1-hero.png` |
| 会话完成态 | `out/p1-chat.png` |
| 输入区聚焦 | `out/p1-focus.png` |
| splash 交接后 | `out/p1-handoff.png` |
| 布局断言原始数据 | `out/layout-assert.json`（pass=true） |
| 验收报告 | `docs/verify/ui-assertions.md` |

> 环境：隔离 `DSH_HOME=out/verify-home`、`--profile verify --port 57124`、headless Chrome 1550×830；真实 desktop profile 未触碰。
> 结论：皮肤可开关、背景 video 在播、玻璃面成立、交接无异常、布局零位移、GET `?patch=` 配置真实落盘。未验证项（Electron 真机/浅色/长跑/窄窗）见报告 §7。

---

## 13. 里程碑与交付物

| 阶段 | 内容 | 产出 | 验收门 |
|---|---|---|---|
| P0 设计锁定 | 调色板/玻璃配方/背景循环/3 张关键帧示意 | 规划文档 + `preview/ui-mock.html` + `out/mock-hero/chat/focus.png`（**已产出**） | 方向确认（待你点头进 P1） |
| P1 皮肤底座 | token、7 面清空、背景层、侧栏/输入卡/顶栏玻璃、交接显影 | `skin.css`/`skin.js` 可跑；4 张截图 + 报告（**已完成**） | 对比度 PASS、布局零位移 PASS |
| P2 会话面 | 消息流、代码/表格、工具卡、运行行、弹层、菜单 | 工具行/过程组/代码块已落地；弹层/表格/错误态继续 | 选择器全 PASS |
| P3 动效 | 金环状态机、消息入场、微交互、reduced | 录屏 15s + 动效表 | 无滚动跳动、无 >900ms |
| P4 设置页 | 配置读写修复、5 个二级页、诊断、预览 | 设置页截图 + POST 断言 | 保存/回读一致 |
| P5 验证 | 性能/对比度/负向/循环/安装 | `docs/verify/ui-assertions.md` | 全部 PASS 或列明未验 |
| P6 交付 | 打包 0.3.0、INSTALL/README、回滚 | `releases/dsh-startup-jarvis-0.3.0.tgz` | 你实测冷启动 |

**预估**：P0 0.5 天；P1 1.5 天；P2 2 天；P3 1.5 天；P4 1 天；P5 1 天；P6 0.5 天。合计约 **8 个工作日**（不含你验收往返）。

---

## 14. 风险登记

| # | 风险 | 概率/影响 | 缓解 |
|---|---|---|---|
| 1 | 视频 + 毛玻璃导致低端 GPU 掉帧 | 中/高 | `hud` 默认；低配降 ambient/poster；blur ≤3；关视差 |
| 2 | 文字压不住亮 HUD 线 | 中/高 | 中心遮罩 + 背景强度滑杆 + 对比度实测；不行就降背景亮度/切 ambient |
| 3 | DSH 升级选择器漂移 | 中/中 | 语义属性优先；compat() 自动降级；断言脚本 |
| 4 | `:has()` 样式重算贵 | 中/中 | JS 状态兜底；P1 实测裁决 |
| 5 | 宿主滚动/折叠动画冲突 | 中/中 | 只做 opacity/transform；不进 `[data-chat-motion]` 作用域 |
| 6 | 输入卡 backdrop 影响 fixed 弹层 | 低/中 | 弹层由宿主 portal 到 body；实测菜单/权限弹层 |
| 7 | 浅色宿主变“灰脏” | 中/中 | 昼面用 poster/低透；不做暗色硬铺 |
| 8 | Windows 原生 titlebar 无法透明 | 确定/低 | 接受实色；颜色与底一致；金线画在下方 |
| 9 | 自动播放被拦 | 低/低 | poster + 首次手势重试 |
| 10 | 配置写坏 | 低/高 | 原子写 + `.bak` + 校验 + 恢复默认 |
| 11 | 包体过大 | 中/低 | 1080p CRF 22；bg-loop 不默认打包 |
| 12 | 素材版权 | 确定/低 | 本地自用；公开版不打包视频 |
| 13 | 设置页样式与宿主冲突 | 中/低 | 皮肤作用域 + 只改颜色；截图验收 |
| 14 | 视频循环接缝 | 低/低 | power-cycle 天然无缝（已实测 0.6/255） |

---

## 15. 待你拍板（6 个决策）

| # | 决策 | 选项 | 结论（2026-11-20） | 影响 |
|---|---|---|---|---|
| 1 | 背景默认模式 | `ambient` 预模糊 / `hud` 清晰 / `poster` | **`hud`**（用户拍板；其余按推荐） | 可读性、性能、观感差异最大 |
| 2 | 循环默认 | `power-cycle` 30s / `continuous` 24.2s / 两者都做 | **power-cycle**，`continuous` 作为选项 | 是否接受每 30s 约 3s 变暗 |
| 3 | 主色 | 赤金 `mark7` / 冷青 `hud` / 暗夜 `noir` | **mark7** | 整套 token 与截图 |
| 4 | 浅色宿主 | 做“昼面” / 皮肤在浅色下自动关 / 强制暗色 | **做昼面**（best-effort） | 额外 0.5 天与测试面 |
| 5 | 品牌处理 | 保留 DSH 字标 + MK VII 小标 / 换 JARVIS 反应堆 mark | **保留 + 小标**；hero 可选反应堆 | 身份感 vs 品牌一致性 |
| 6 | 输入区聚焦时压暗背景 | 开 / 关 | **开** | 输入时的专注度；可设置关闭 |

> 已拍板汇总：**背景 `hud`；循环 `power-cycle`；主色 `mark7`；浅色做昼面；品牌保留 + MK VII；聚焦压暗开**。玻璃强度“中”；动效“full + 尊重系统 reduced”。

---

## 附录 A：rc.5 钩子证据（实现前复跑）

| 钩子 | rc.5 位置/计数 | 备注 |
|---|---|---|
| `[data-composer-card]` | conversation client，1 处 | 输入卡根 |
| `[data-composer-seat]` | conversation client，1 处 | 输入区座位 |
| `[data-sending]` | conversation client，2 处（CSS+JSX） | 发送按钮 |
| `[data-chat-running]` | chat client，1 处 | 运行行 |
| `[data-message-bubble]` | chat client，1 处 | 用户气泡 |
| `[data-chat-flow-key]` | chat client，3 处 | 消息行 key |
| `[data-chat-following-tail]` | chat client，3 处 | 跟随尾部 |
| `[data-chat-motion]` | chat client，21 处 | 宿主折叠动画作用域，**不要抢** |
| `[data-phase]` | conversation，9 处；值 `hero/active/settling` | 场景状态 |
| `.md-code-block` | shell CSS，4 处 | 代码块 |
| `[role="dialog"]` / `[class*="_mask" i]` | shell CSS | 弹窗/遮罩 |
| `[data-menu-material]` | theme/shell | 菜单材质 |

> 实现时用 `docs/verify/ui-assertions.md` 的脚本在 rc.5 上复跑；缺 3 个以上自动降级 accent。

## 附录 B：资产与命令

- 源：`<本机素材>/1607138105878fcd84ed13f48a.mp4_last.mp4（未随仓库分发）`（只读，不修改）。
- 生成：`scripts/make-bg-assets.mjs`（ffmpeg 路径 `E:\douy\_tools\ffmpeg\ffmpeg.exe`）。
- 校验：输出每个资产的 `sha256`、`ffprobe` 时长/分辨率/码率，写入 `assets/manifest.json`。
- 缓存：URL 带 `?v=<hash8>`，避免升级后旧视频缓存。

## 附录 C：文件变更清单（实现时）

| 文件 | 动作 |
|---|---|
| `package/package.json` | 版本 0.3.0；files 不变 |
| `package/lib/index.js` | 新增 skin 资源路由、config POST 写入、token CSS 生成、head 注入 |
| `package/lib/skin.js` | 新增 |
| `package/lib/skin.css` | 新增 |
| `package/lib/splash.js` | 交接时调用 `Skin.enter()`；保留现有逻辑 |
| `package/lib/splash.css` | 启动期只隐藏 `#root`，保留 ambient |
| `package/lib/client.js` | 设置页重做；修 patch；调用 Skin API |
| `package/lib/assets/bg-*.mp4/jpg` | 新增（按决策） |
| `docs/skin-spec.md` | 新增 |
| `docs/verify/ui-assertions.md` | 新增 |
| `README.md` / `INSTALL.md` | 更新配置与皮肤说明 |
| `scripts/make-bg-assets.mjs` | 新增 |
| `releases/dsh-startup-jarvis-0.3.0.tgz` | 新增 |

---

**下一步**：你确认 §15 的 1–3 个关键决策后，我先做 P0 的 3 张关键帧示意（不改插件、不安装），你看过再进 P1。
