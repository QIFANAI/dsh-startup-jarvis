# JARVIS 启动动画 · 设计方案 v0.1

> 状态：待你拍板。本文只含结论、口径与实现路线。
> 依据：本机实测（DSH 0.2.2-rc.1 / desktop profile / 已装 elisa 0.6.0·moss2 v0.2·vyron 0.2.1）+ 三份 Wallpaper Engine 素材预览图。
> 日期：2026-11-19

## 0. 一句话判断

JARVIS 的启动动画不该是"系统正在加载"，而该是**"系统早就醒了，现在在向主人报到"**。
所以本题的技术难度不在特效，在**一句话的叙事**：全片只有一次"人味"时刻——"Welcome home, Sir."，
前后所有 HUD 都是为这句话铺垫"它确实掌握着真实状态"。

## 1. 三份素材的取用判定

| 素材 | 内容 | 结论 | 取什么 |
|---|---|---|---|
| `2544668646` Jarvis startup (Iron Man) · 130 MB | `[ </SYSTEM+LOADING//> ]` 开机字牌 | **主参考** | 排版语言：黑底白网格、方括号包边、`//` 与 `<>` 混排、琥珀+青双色、微型 HUD 注脚 |
| `2327894039` Jarvis Welcome Home Sir · 298 MB | HUD 仪表盘 + 台词线 | **音画参考** | 环/示波/条形读数、"CORE TEMP." 式标签；台词"Welcome home, Sir."的**语音来源候选** |
| `2802512189` JARVIS spanish · 200 MB | 西语版 | **排除** | 不取（音轨语言不对，只可作构图备用） |

## 2. 叙事骨架（为什么这么排）

1. **不解释**：不出现"Loading…"进度条。JARVIS 不"加载"，它"在线"。
2. **先证明知情**：第三幕用**真实运行数据**做自检（profile / 模型 / 插件 / 技能 / 沙箱 / 会话），
   这是本片与普通科幻开机的分水岭——屏幕上的数字是真的。
3. **后给情绪**：第四幕才压 `SYSTEM ONLINE`，第五幕才开口说话。一句台词，不啰嗦。
4. **交接不是切黑**：光点爆成网格 → 扫描线过宿主界面 → 宿主 UI 显影，与 elisa 的 handoff 同构。

## 3. 六幕分镜（100% 速度，总 10.2s；speed 50–150% 等比换算）

| # | 时间轴 | 画面 | 文案（逐字出现） | 声音 |
|---|---|---|---|---|
| 0 | 0.00–0.55 | 纯黑，中心 1px 冷蓝点呼吸两次 | — | 极低频起振（-30 dB 起） |
| 1 | 0.55–1.90 | 三段环弧 0.45s 依次锁定；中央 `D` `S` `H` 用横线扫出 | — | 三声锁定 cue（每弧一声） |
| 2 | 1.90–3.30 | 字标组装，白/青/琥珀三色分层 | `[ </DEEPSEEK HARNESS//> ]`<br>`深度求索 · DEEPSEEK · v0.2.2` | 一字一声轻响（打字机节奏） |
| 3 | 3.30–5.40 | 六行自检逐行亮，右侧数值从 0 滚到真值，示波微条并行 | 见 §5 真实数据清单 | 每行一句短 tick |
| 4 | 5.40–6.90 | 横向扫描带过屏，四角枢轴脉冲对齐，中央压印 | `SYSTEM ONLINE`<br>右下 `ACCESS LEVEL 3 · JARVIS` | 低频冲击 + 余韵 |
| 5 | 6.90–8.60 | 圆环收束成光点，字幕条打字机 | `Welcome home, Sir.` | **台词（唯一人声）** |
| 6 | 8.60–10.20 | 光点爆成细网格 → 扫描过宿主 → UI 显影 | — | 泛音收尾，交接到 BGM/静音 |

交互：任意键 / 点击 / Esc → 立即交接（480ms 版）；`reducedMotion` → 静态终帧 + 300ms。
右下常驻 `[ SKIP ]` 与 `ESC` 提示，`allowSkip=false` 时隐藏并禁用。

## 4. 视觉规范（从素材反推，可零素材实现）

- 底色 `#000000`；网格 `rgba(255,255,255,.055)`，64px，随扫描轻微位移
- 主色 青 `#2FD3E8`（HUD 弧、示波、扫描）；强调 琥珀 `#F0B429`（关键词、`//`、警示）；文字白 `#F2F5F7`
- 辅助灰 `#7A8790`（注脚、单位）
- 字体：英文等宽 `JetBrains Mono / Share Tech Mono`（无网时用 `ui-monospace, Consolas`）；中文 `思源黑体 Bold`
- 排版语汇：方括号包边 `[ … ]`、`</ … //>` 混排、字号阶差 6 级（28/22/16/12/10/8px 等比）
- 组件库：环形刻度（200 段）、示波条、条形读数、四角枢轴、扫描带、微型注脚（时间/帧号/编号）
- 动效克制：只在交接处用一次轻 glitch，其余全为匀速/缓出，禁止随机抖动

## 5. DSH 元素硬清单（缺一项即算不合格）

| 项 | 内容 | 来源 |
|---|---|---|
| 图标 | DSH 应用图标 | `<DSH 安装目录>/resources/icon.png`（或 brand-official 插件内资产） |
| 字标 | `DEEPSEEK HARNESS` / `深度求索` | 产品官方命名 |
| 版本 | `v0.2.2-rc.1` | 安装包 package.json |
| PROFILE | `desktop` | 实际运行 profile |
| MODEL | `deepseek-flash · reasoning high` | 实际配置 |
| BUNDLES | 6 个（dsh-base / web-app / agent-team / inspector / auto-review / ops） | `~/.dsh/profiles/desktop/package.json` |
| SKILLS | 实际索引数（运行时读，不写死） | `~/.dsh/skills` |
| SANDBOX | `danger-full-access`（按实际策略） | 运行时 facts |
| 会话 | `SESSION 001` 等真实会话号 | 运行时 facts |
| 语义 | `ACCESS LEVEL 3`、identity 可配 | 沿用你现有 `dsh-startup.json` 的 identity/accessLevel 机制 |

原则：**第三幕的全部数字必须由宿主侧真实读取后传给前端**，不准写死。写死等于下次改配置就穿帮。

## 6. 音频与语音（"Welcome home, Sir."）

- **主声床**：程序化合成（低频 hum + 3 组 cue + 收尾泛音），沿用 elisa 的 `scripts/make-audio.py` 路线，零第三方版权。
- **台词三选一**（按优先级）：
  1. **抽原声**：从 `2327894039/Wallpaper engine.mp4` 里截 "Welcome home, Sir." 一句（音色最正）。需 ffmpeg；**本机当前未找到 ffmpeg**（<本机路径>、~/.local 均无），需先解决工具链（自带一份 ffmpeg.exe 或改用 B）。
  2. **TTS**：Web Speech / Edge TTS，英式男声，rate 0.88、pitch 0.85——与你现有 `dsh-startup.json` 的 voice 参数同源。
  3. 另录/另配。
- **降级链**：无音频文件 → 只播主声床；自动播放被拦 → 静音降级，首次手势补播（与 elisa 同规则）。
- **版权边界**：Wallpaper Engine 工坊素材**不随公开仓库分发**（elisa 的做法是"缺失即降级"）；本机自用可以。要发 GitHub 就按 elisa 的 `THIRD-PARTY-NOTICES` 处理。

## 7. 技术路线

**基座**：`dsh-startup-elisa（本机另一个插件项目）` 0.6.0（契约最完整：iframe 协议 + 看门狗 + 速度换算 + reduced + 497 项冒烟 + 打包脚本）。

- 包名 `dsh-startup-jarvis`，路由 `/dsh-jarvis`，配置 `~/.dsh/dsh-startup-jarvis.json`
- 结构：`lib/index.js`（宿主：注入首屏、serve 资产、读真实 facts、原子写配置）、`lib/splash.js` + `lib/splash.css`（启动层与交接）、`preview/index.html`（离线预览，可单开浏览器核对）、`lib/assets/`（可选视频/语音/声床）、`test/*.mjs`（冒烟）
- 契约常量：`TOTAL=10.2s`、`SPEED` 换算、`HANDOFF` 850ms 基准、`WATCHDOG`、`mode: session|daily|always`
- 互斥：**同一 profile 只能启用一个启动插件**。装 Jarvis 前需禁用/卸载现役（elisa/moss2/vyron 三选一在跑）
- 首版**不做 UI 皮肤**，仅留 skin 档位接口；皮肤列入第二阶段（黑底 + 青/琥珀 HUD、玻璃、侧栏刻度）

## 8. 里程碑与验收证据

| 阶段 | 交付 | 验收证据 |
|---|---|---|
| M1 | 离线预览页跑通 6 幕（无宿主依赖） | 6 张关键帧截图存 `_shots/v1/`，暗/浅两套 |
| M2 | 接宿主真实 facts + 声床 + 台词 | facts 注入断言；音频降级断言；reverse-test 已喂缺陷确认会红 |
| M3 | 打包 tgz + 装 desktop profile 实测 | `require(profile/node_modules/dsh-startup-jarvis/lib/index.js)` 加载通过；重启观察 |
| M4（第二期） | Jarvis UI 皮肤 | 皮肤截图 + 设置页内嵌预览 |

## 9. 风险与待核实

- **ffmpeg 缺失**：抽台词路线当前不通，需先定工具链（待核实）。
- **素材语言**：西语那份已排除；"Welcome home sir" 是否含背景乐需抽帧试听（待核实）。
- **窗口边框**：窗口右上角 □ ✕ 由宿主 titleBarOverlay 绘制，插件侧无法隐藏（screen 项目实测结论），故不做原生无边框启动窗，启动层只能是页内全屏层。
- **实测播放**：装好后需你实际重启一次观察（与 elisa 相同的未验证项）。
- **术语一致性**：文案里的产品名一律 `DEEPSEEK HARNESS / 深度求索`，不得出现 "DSH OS" 等自造名（沿用 `dsh-startup.json` 已定口径）。

## 10. 需要你拍板

1. 总时长 10.2s 是否合适，还是压到 8s？
2. 台词来源：抽原声 / TTS / 另录？
3. 文案语言比例：英文 HUD 为主 + 中文副行（推荐）／纯英文／纯中文？
4. 本轮范围：只做启动动画（推荐先做），还是启动 + 皮肤一起规划？
5. 允许临时停用现役启动插件（elisa / moss2 / vyron）来装 Jarvis 吗？
