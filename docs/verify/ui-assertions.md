# P1 皮肤底座 · 验收报告（隔离 verify host）

> 日期：2026-11-20｜插件：`dsh-startup-jarvis@0.3.0`｜宿主：DSH 0.2.2-rc.5（web runtime）
> 验证环境：隔离 `DSH_HOME = out/verify-home`，`--profile verify --port 57124`，headless Chrome 1550×830
> 用户正在使用的 desktop profile **全程未触碰**；未安装到真实 profile。
> 结论：**P1 通过**（4 张截图 + DOM 探针 + 布局零位移 + 对比度 + 配置写入 + 交接）。
> 2026-11-20 第二轮（P1.5/P2 增量）：补 Hero 身份层、底部战情台、工具行/代码块；详见 §2.1。

---

## 1. 本轮改动

| 文件 | 改动 |
|---|---|
| `package/lib/skin.css` | 新增：token 覆盖、背景层、7 面清空、侧栏/顶栏/输入卡/消息/代码/菜单/弹窗、四角枢轴、交接显影、降级 |
| `package/lib/skin.js` | 新增：`dj-skin` 类、`#dsh-jarvis-ambient`（video + scrim + vignette + grain + scan）、`enter/exit/apply`、可见会话状态、视差、诊断 |
| `package/lib/index.js` | 新增 `skin` 配置与归一化、bg 资产路由、skin CSS/JS 注入、**GET `?patch=` 写配置**、per-request 读盘 |
| `package/lib/splash.js` | 交接时调用 `Skin.enter()`；禁用旧 `theme` 覆盖；`dj-booting` 统一；修复 `timeupdate` 空引用 |
| `package/lib/splash.css` | 启动期只隐藏 `#root`，不隐藏背景层 |
| `package/lib/client.js` | 皮肤开启时跳过旧 `applyTheme`（避免双层覆盖） |
| `package/lib/assets/` | 新增 `bg-1080.mp4`（11.1MB）、`bg-ambient.mp4`（345KB）、`bg-poster.jpg`、`bg-poster-blur.jpg` |
| `package/package.json` | 0.3.0 |

背景资产规格：`bg-1080` 1920×1080/30fps/H.264 CRF22/无音轨；`bg-ambient` 960×540/gblur sigma 18/CRF26；源片只读。

---

## 2. 截图（1550×830）

| 文件 | 场景 | 看点 |
|---|---|---|
| `out/p1-hero.png` | 空白会话 hero | HUD 清晰背景、侧栏玻璃、MK VII、新会话金按钮、输入卡金环 |
| `out/p1-chat.png` | 会话完成态 | 用户金气泡、助手正文、header/tab、会话场景压暗、底部输入卡 |
| `out/p1-focus.png` | 输入区聚焦 | 背景再压一档、金环提亮、草稿/caret |
| `out/p1-handoff.png` | splash 交接后 | 启动层已移除、`dj-booting` 已清、背景视频在播、UI 完整 |
| `out/p2-tool.png` | 工具调用会话（完成态） | 代码块、h2 金线、inline code、工具过程组 |
| `out/p2-tool-top.png` | 工具过程组展开态 | 过程组玻璃壳 / 工具行 probe |

> 说明：`p1-handoff.png` 里输入卡有一行草稿（来自聚焦截图），不影响交接结论；真实冷启动不会有这行。

---

## 2.1 P1.5 / P2 增量（第二轮）

针对“实际与概念稿差距”补的四件事：

| 增量 | 做法 | 证据 |
|---|---|---|
| Hero 身份层 | 宿主 hero 标题 “探索未至之境” 的 span 隐藏，titleGroup 用 `::before` 渲染 **Welcome home, Sir.**（30px）+ `::after` 渲染 `DEEPSEEK HARNESS // SYSTEM ONLINE`；隐藏“预览版”徽章 | `out/p1-hero.png` |
| 反应堆环 | `[data-phase="hero"]::before/::after` 两层同心环（560/430px，实线 + 虚线），fixed/absolute，不参与布局 | 同上 |
| 底部战情台 | `#dj-hero-deck` fixed 条：CORE / MODEL / PROFILE / SKILLS / BUNDLES，数据来自 Host facts；仅 hero 显示；`--dj-sidebar-w` 跟随侧栏宽度 | 同上 |
| 工具行 / 代码块 | `[data-chat-call-id]` 玻璃条 + 金左缘 + hover；`[data-turn-process]` 过程组玻璃壳；`.md-code-block` / banner / h2 金线 | `out/p2-tool.png`、`out/p2-tool-top.png` |

- **布局（用户拍板 concept=actual 后）**：Hero 输入卡改为 absolute 底部、标题/工作区 -38px、header HUD 铭牌；这是**唯一 hero 破例**。聊天/任务仍按原布局，`node tools/measure-chat-layout.mjs` 复跑 **pass=true**（`out/layout-chat.json`）。
- **Hero 对比度复测**：标题区 9.25:1（标题上缘）/ 5.23:1（下缘含 subtitle/环），仍 ≥4.5；会话正文 7.26–9.10:1 不变。
- **概念=实际（用户 2026-11-20 拍板）**：Hero 已按概念稿对齐——侧栏 345px、header 标题+对话/轨迹/变更 tabs+模型铭牌、标题/工作区上移 38px、输入卡 absolute 到底部、`01/02/03` 工作区/模式/查看插件 chip、战情台移除。底部输入卡实测可点击聚焦/输入（`out/hero-composer-test.png`，active=`GRgSLq_input`，文本写入成功）。
- **布局例外记录（2026-11-20 扩展）**：hero 底部输入卡 + 侧栏 345px + header 叠层 + chips；聊天侧栏同为 345px、过程组自动展开、工具大卡替换 compact 行。均属 concept=actual 的范围；若回退，删除对应 CSS/slot 注册即可恢复。
- **注意**：聊天布局不再是“零位移”；`layout-chat.json` 的旧结论已被此例外覆盖，后续以概念稿对比图验收。
- **工具大卡（已实现，不再用 CSS 糊）**：注册 `tool.call.toolview` key=`pwsh`，用真实 `phase/block` 渲染 `pwsh` 大卡（头部/命令/输出/DONE）；自动展开过程组；`out/p2-tool-top.png` 显示正文里的多张玻璃大卡。
- **Hero 标题可访问性**：视觉替换用 CSS 伪元素，原 span `display:none`；P4 可改为 `conversation.hero.brand.mark` slot 组件以获得正确可访问名称。

---

## 3. DOM 探针（headless Chrome）

| 项 | 值 |
|---|---|
| `html.class` | `dj-skin dj-skin--glass dj-skin--bg-hud dj-skin--motion-full` |
| `data-dj-preset` / `bg` / `scene` | `mark7` / `hud` / `hero` 或 `chat` |
| `#dsh-jarvis-ambient` | 存在；6 个子层；rect 1550×830 |
| 背景 video | `readyState=4`、`paused=false`、`duration=30`、`src=/api/dsh-jarvis/assets/bg-1080.mp4?v=0.3.0` |
| 侧栏 | `width=280`、`backdrop-filter=blur(22px) saturate(1.2)` |
| 输入卡 | `width=844.8`、`height=114`、`border-radius=28px`、玻璃阴影存在 |
| header/tab | `header[data-window-drag]` 存在；`role=tab` 2 个 |
| 消息 | 用户气泡 2、chat flow 节点 18、running 0（完成态） |
| 异常 | 交接测试 **0 个未捕获异常**（旧 `timeupdate` 空引用已修） |

---

## 4. 布局零位移（PASS）

方法：在空白会话（静态 hero）上测 15 个关键元素的 `getBoundingClientRect()`；先带皮肤测一次，再移除 `#dsh-jarvis-ambient` 与 `html.dj-skin*`，等 700ms 再测一次；差值 > 0.5px 记为失败。

| 元素 | 结果 |
|---|---|
| `#root` / frame / sidebar / header / tabs / chat / scroll | 0 |
| composer seat / composer / brand / new session | 0 |
| body scrollWidth / scrollHeight | 0 / 0 |

原始数据：`out/layout-assert.json`；汇总 **pass=true**。

> 过程中发现并修复：header 曾因残留 `border-bottom:1px` 多 1px、`scrollbar-color` 改变内部滚动条宽度导致 composer 横移 5px；两者都已改成 `box-shadow`/tokens，复测归零。

---

## 5. 对比度（WCAG 公式，截图取第 98 百分位最坏背景）

| 区域 | 背景 p98 相对亮度 | 对 `#eef2f6` 对比度 | 结论 |
|---|---|---|---|
| 会话正文段间 | 0.053–0.073 | **7.26–9.10 : 1** | ≥ AA 4.5，达到 ≥7 目标 |
| Hero 标题区（第二轮） | 0.051 / 0.129 | **9.25 / 5.23 : 1** | ≥4.5，通过 |
| 输入卡区域 | 0.334 | 2.43 : 1 | 该区域含 placeholder/装饰，不作正文口径；正文输入文字为 `#eef2f6`，实际对比度高于此 |

> 会话正文在 `hud` 模式下采用“中心遮罩 + 场景压暗”；若你后续觉得 HUD 太淡，P4 的 `bgOpacity/brightness` 可调，但正文对比度必须保持 ≥4.5。

---

## 6. 配置写入 + 交接

### 6.1 配置写入（GET `?patch=`）

| 步骤 | 结果 |
|---|---|
| `GET /api/dsh-jarvis/config?patch={"skin":{"bgOpacity":80}}` | `ok:true`，返回 config |
| 文件 `out/verify-home/dsh-startup-jarvis.json` | `bgOpacity` 变为 80 |
| 回读 GET | 80 |
| 恢复 86 | 文件恢复 86 |

> 现有 client 的 `patch()` 正是 GET `?patch=`，因此设置页保存已从“空转”变成真实落盘。`POST` 分支未验证（Web 宿主对 POST 有鉴权/CSRF；客户端不使用）。

### 6.2 交接（splash → skin）

配置：`enabled=true, handoffAt=5, sound=false, mode=always`，headless 加载。

| 时刻 | 状态 |
|---|---|
| →5.0s | splash 播放中；`dj-booting` 存在，`#root` 隐藏；背景 ambient 已建但未播 |
| 5.0s | splash 触发 handoff → `Skin.enter()`；白闪/扫描；背景 video 从 2.4s 起播 |
| 6.6s | splash 仍在淡出；`skin=true`、`rootVisible=true`、`enter=true`、bg video `paused=false` |
| 7.7s | splash 移除；`enter=false`；bg video 播放中；**0 异常** |

---

## 7. 未验证 / 下一阶段

| # | 项 | 状态 |
|---|---|---|
| 1 | **真实 Electron/desktop profile** | 未装真实 profile；本报告是 web runtime + headless Chrome |
| 2 | Windows 原生 titlebar 40px 的实色/探针联动 | 未在 Electron 真机看；web 无原生 bar |
| 3 | 浅色“昼面” | token/背景已写，未截图/未测对比度 |
| 4 | 工具卡、代码块、菜单、弹窗的细粒度样式 | 已有基础 token/局部规则；P2 细化 |
| 5 | 设置页重做（5 个二级页/诊断/预览） | P4；当前设置页旧“外观”标签仍指向旧 theme，**请勿使用** |
| 6 | `:has()` 长时间性能 | 仅功能验证；P5 做 Performance trace |
| 7 | 30s 循环长跑/内存 | 只验证 `loop` 与首尾帧；P5 做 30 分钟挂机 |
| 8 | Esc 跳过 / 自动播放被拦 / 视频缺失 | 交接正常路径已验证；异常路径 P5 |
| 9 | 侧栏收起/抽屉/窄窗/全屏 | 未截图；P5 矩阵 |
| 10 | 安装/卸载/回滚 | P5 打包后由你实测冷启动 |

---

## 8. 复跑命令

```powershell
# 启停隔离宿主（57124）
powershell -File tools\verify-host.ps1 -Action restart

# 截图 / 断言（需宿主在跑）
node tools\shot-hero.mjs
node tools\shot-chat2.mjs
node tools\shot-handoff.mjs
node tools\measure-layout.mjs
```

---

## 9. 结论

P1 的“底座”目标达成：**皮肤可开关、背景视频可播、玻璃面成立、交接不闪、布局零位移、配置可落盘**。
下一步 P2：会话流细粒度（工具卡/代码/表格/推理/运行行/错误态），在不动布局的前提下补齐“毛玻璃 + 动效会话框”的全套观感。

## P2/P3 — 2026-11-20 01:20 — 聊天大卡 / 动效 / 菜单 / 设置 / 浅色初测

- **聊天工具卡（concept=actual 核心）**：`tool.call.toolview` key=`pwsh` 自定义大卡，真实 `phase/block` 渲染命令、输出、DONE/ERROR；过程组自动展开；`out/p3-chat-clean.png` 是一轮干净会话（1 张卡 + 代码块 + 回答 + 底部输入卡），与概念稿对比见 `out/compare-chat.png`。
- **运行态**：`out/p3-running.png`，`DEEP DIVING`/`深度求索中` 扫描金条 + `RUNNING` 工具卡。
- **菜单**：模型选择 popover 实际样式见 `out/p3-menu.png`（玻璃面、分组、开关）。
- **设置**：`out/p3-settings.png`（账号页）、`out/p3-settings-general.png`（通用设置）；JARVIS 启动动画 section 仍在。
- **动效**：新行 `data-dj-enter` 240ms 入场；`prefers-reduced-motion` 降级；运行行扫描。
- **浅色初测：FAIL（已记录，不冒充通过）**：`out/p3-light.png` 切到浅色后，设置弹窗仍是深色玻璃、host 浅色文字变深，出现“深底深字”不可读；sidebar/弹窗等硬编码深色面未 token 化。下一轮必须修，修完再补浅色对比图。
- **发布**：`releases/dsh-startup-jarvis-0.3.0.tgz`（54MB，15 files，含 skin/client/assets）；`安装-安全版.cmd` 已从 0.1.0 修正为 0.3.0；**未在桌面 profile 安装**，需退出 DSH 后手动安装。
- **布局例外**：侧栏 345px、过程组自动展开、大卡替换 compact 行，均属 concept=actual 授权范围；`layout-chat` 旧零位移结论已失效。
- **结论**：深色 Hero + Chat 核心已接近 concept=actual；浅色未过、Electron 真机/表格未验；goal 保持 active。

## P3 — 2026-11-20 01:36 — 侧栏顶栏重做 + 浅色修复

- **侧栏内层宽度**：宿主 `wtg9ga_root` 内层只有 280，外层 grid 345 会让品牌行右空 65px；已把 root/logoRow 拉到 100%，新会话回到 309×38 全宽，MK VII 在品牌行右 22，收起按钮隐藏，导航行高 36。对比图 `out/compare-sidebar.png`、`out/p1-hero-v3.png`。
- **新会话**：从宿主金色实心改回概念稿的描边 + 左对齐 `+` 圆 + `新会话`；快捷键 kbd 隐藏（概念稿没有）。
- **浅色**：补 `--dj-*` 浅色 token、侧栏/顶栏/输入卡/工具卡/代码块/菜单/对话框硬编码暗面覆盖；设置弹窗的 selector 由 `#0b0e13` 修复为白色（`out/p3-light-settings3.png`），浅色聊天 `out/p3-light-chat.png` 通过。
- **发布**：`releases/dsh-startup-jarvis-0.3.1.tgz`（54MB，15 files）；`安装-安全版.cmd` 指向 0.3.1；未在桌面 profile 安装（需退出 DSH）。
- **仍差**：Electron 真机（原生 titlebar 40px / 拖拽/右键菜单）、markdown 表格、安装后回滚演练。
- **结论**：侧栏块和浅色从 FAIL 转 PASS；goal 保持 active。

## P4 — 2026-11-20 02:00 — 安装链路 / 回滚 / 浅色 hero / 表格

- **0.3.1 安装实测**：`dsh.cmd plugin --profile verify add releases/...0.3.1.tgz` → pnpm 11.28.5 装到 verify profile → host 重启 → skin/sidebar 345/newSession 309×38 均在；随后 remove 并恢复 `link:` + junction，verify host 回滚成功。
- **回滚缺口（已修）**：原 `安装-安全版.cmd` 回滚只 remove 0.3.1，不重装 0.2.2，会导致旧版插件文件丢失；现回滚流程在 remove 后重新 add `dsh-startup-jarvis-0.2.2.tgz`，空文件也保底。
- **浅色 hero**：0.3.2 首版 HUD 被白 scrim 冲掉（`out/install-hero.png` 旧），已把 scrim 降到 .58/.44/.20、视频透明度 .30、并补副标题/芯片/03 对比度（0.3.3）；当前 `out/install-hero.png` 为 0.3.3 浅色。
- **表格**：`p3-table2.png` 6×3 markdown 表格（浅色）渲染通过，表头/边框/暗色 token 正常。
- **0.3.3 包**：`releases/dsh-startup-jarvis-0.3.3.tgz`（54MB，15 files）；安装脚本指向 0.3.3；未装进桌面 profile。
- **仍差**：Electron 真机（原生 titlebar/拖拽）、桌面 profile 的安装后回滚演练、浅色 hero 的最终对比图。
- **结论**：安装链路/回滚/浅色/表格通过；goal 保持 active。

## 验收结论 — 2026-11-20 02:10 — concept=actual（verify host）+ 安装已备

- **逐屏对比**：`out/compare-hero.png`、`out/compare-chat.png`、`out/compare-sidebar.png`；浅色 `out/install-hero.png`（0.3.3）、`out/p3-light-chat.png`、`out/p3-light-settings3.png`；菜单 `out/p3-menu.png`；表格 `out/p3-table2.png`。
- **已实现**：hero 345 侧栏/header tabs/01-03 chips/底部输入卡；聊天工具大卡（tool.call.toolview pwsh）；过程组展开；玻璃/动效；菜单/设置/浅色/表格。
- **安装**：`releases/dsh-startup-jarvis-0.3.3.tgz`；`安装-安全版.cmd` 指向 0.3.3；verify profile 0.3.1 实际安装→host 重启→回滚 0.2.2 通过；回滚会重装 0.2.2。
- **边界**：桌面 profile 被 Electron 独占（`profile "desktop" is managed exclusively by the Electron application`），真机 titlebar/拖拽/桌面回滚只能在你退出 DSH 安装后验证；verify host 不能冒充。
- **Goal**：完成上述验收范围；安装后 Electron 真机检查为用户侧/后续。

---

## 验收记录 — 2026-11-22 17:2x — 0.3.6 交互元素/视图元素重叠修复

> 修复对象：截图 2/3（新会话页）、4/5（进行中会话页）红框：侧栏开关叠品牌、自绘重开按钮压标题、右上 MODEL 压「更多操作」、HUD 顶角标穿品牌/面板开关。
> 详细根因、改动与证据见 `out/修复报告-2026-11-22.md` §七。

| 项 | 结果 |
|---|---|
| 桌面条件模拟（1536×816 CSS @DPR1.25 → 1920×1020；`data-windows-titlebar`+40px；暗；280/345/420/收起；hero+chat） | **18/18 PASS**，`out/fix-b/v-assertions.txt` + `v-*.png` |
| Web 模式回归（无标题栏；展开/收起/重开/chat；模糊保留） | **10/10 PASS**，`out/fix-b/w-assertions.json` + `w-*.png` |
| 0.3.6 回归（1550×830；hero/背景视频/拖动/MK VII/收起重开/铭牌/浅色） | **14/14 PASS**，`out/phase1c-assertions.txt` + `phase1c-*.png` |
| 真机（Electron 桌面 App，1920×1080 屏） | 以 DevTools 临时注入 0.3.6 皮肤验收：左上幽灵图标/角标消失、标题栏开关回 (12,6)、右上 MODEL 与「···」分离；证据 `out/fix-b/live-fixed-expanded.png`、`livefix-tl5x.png`、`livefix-tr6x.png` |
| 安装 | profile `desktop` 0.3.6（`file:releases/dsh-startup-jarvis-0.3.6.tgz`），node_modules 资产 SHA256 与包内一致 |
| 生效条件（新发现） | **桌面端仅刷新页面不生效**：boot 注入行在 Electron 主进程启动时缓存；需完全退出 DSH 重开（重启后日志应出现 `mount start version=0.3.6`） |

遗留：真机收起态与 345/420 宽未逐档截图（模拟矩阵已覆盖）；浅色为 web 模式验证。

---

## 验收记录 — 2026-11-22 18:0x — 0.3.7 步骤 2（气泡呼吸/流光 + 交接动效）

> 对应 6 条交底里的 #3（消息气泡）与 #6（启动动画→操作页交接）。详细见 `out/step2/README-验收.md`。

| 项 | 结果 |
|---|---|
| 气泡动画（dark/light/reduced/off、布局零位移、ring 旋转/呼吸/扫光/IntersectionObserver 暂停） | **11/11 PASS** + offscreen PASS；`out/step2/bubble-assertions.txt` |
| 交接 DOM 时序（sampler 采样 flash/scan/reveal/opacity/video freeze；正常 1.20s、reduced 0.35s） | **13/13 PASS**；`out/step2/handoff-dom-assertions.txt` |
| 交接逐帧画面（白闪/金扫描/闪后显影；reduced 无闪无扫） | **10/10 PASS**；`out/step2/handoff-visual-assertions.txt` + contact sheet |
| 回归（0.3.6 重叠矩阵 / phase1c） | **18/18 + 14/14 PASS** |
| 录屏 | `out/step2/handoff-normal-handoff.mp4`、`handoff-reduced-handoff.mp4`、`bubble-animation.mp4` 等 |
| 安装 | profile `desktop` 0.3.7（`file:releases/dsh-startup-jarvis-0.3.7.tgz`），资产哈希与包内一致 |
| 生效 | 需完全退出 DSH 重启（boot 注入缓存）；重启后 `SYS 0.3.7` |

两个额外根因（本次发现）：① 皮肤 6s 看门狗在 30.2s 启动片播放期间就 `enter()`，UI 在闪白前被提前显影；② 本机 Windows 动画被关（`MinAnimate=0`）→ 系统 `prefers-reduced-motion=reduce`，0.3.5 的 CSS 媒体查询把气泡/输入卡/交接动效全部关掉。0.3.7 已分别修复（启动层存在时不抢 enter；`motion=full` 覆盖系统偏好）。
