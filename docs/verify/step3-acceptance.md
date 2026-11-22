# 步骤 3 验收：设置页重做（一页分组 + 草稿保存 + 即时生效 + 真重播）——0.3.9（0.3.8 + 旧启动层守卫）

> 日期：2026-11-22 18:2x｜插件：`dsh-startup-jarvis@0.3.9`｜宿主：DSH 0.2.2-rc.5（隔离 verify host，web runtime）
> **公开仓库说明**：本文是作者本机 0.3.9 的验收记录，原文包为本机构建（`private: true` / `UNLICENSED` 元数据，
> 56,562,109 B / SHA256 `53F5ED6E…6911D0`）。本仓库按 MIT 重建的安装包为 56,567,344 B /
> SHA256 `61049915C260F003DD383A5EE3871DB60B8966D14DFDC1E3B0AA722A0E0A0DB4`；`lib/**` 12 个文件与本机构建
> **逐字节一致**，差异只在 `package.json` 元数据。
> 规划来源：`out/fix-c/turn14plus.txt` 第 15 轮交底 6 条问题之 **#5 设置页（启动设置不可操作、UI 设置没同步）**，顺序 §「顺序与风险」第 3 步。
> 结论：**#5 完成并通过 53/53 E2E 断言；0.3.9 已打包并装进 desktop profile，需完全退出 DSH 重开生效。**

## 0. 根因（这轮最关键的发现）

| # | 现象 | 根因 |
|---|---|---|
| 1 | 设置页“保存不了 / 启动设置不可操作” | DSH 的 `webServer.register({kind:'prefix', resource})` **resource 只应答 GET/HEAD**；POST 由载体直接回 `405`（`Allow: GET, HEAD`，空 body）。旧 `index.js` 把 `/config` 的写逻辑放在 resource 里，POST 永远到不了处理函数；旧 client 只能退回 `GET ?patch=`（可用但无草稿/无反馈，且是可被跨站 GET 触发的写口子）。 |
| 2 | “UI 设置没同步” | 旧设置页“外观”tab 驱动的是 `theme`（accent/scanlines/intensity 旧换肤），而 0.3.3 起的皮肤读 `skin`（level/background/bgOpacity/brightness/motion/accent/grain/scanlines/parallax/focusDim/hudCorners/lightMode）；`skin` 里 **level / preset / focusDim / hudCorners / lightMode 五个键在 CSS/JS 里没有实现**，改了也没视觉变化。 |
| 3 | “立即重播”不重播 | 旧实现只清 sessionStorage + `location.reload()`；splash.js 的 `handoffStarted/finished/started` 与 `HANDOFF` 都是模块级闭包状态，二次启动会卡住（`handoff()` 直接 return，遮罩永不清理）。 |

## 1. 改了什么（+663 / −228，5 文件；diff 见 `out/step3/diff-*.txt`）

| 文件 | 改动 |
|---|---|
| `index.js`（+64/−38） | `/api/dsh-jarvis/config` 改由 **exact handler** 承接：GET/HEAD 只读、POST `application/json` 写入（`skin` 深合并）、`{"action":"reset"}` 恢复默认；拒非 JSON 请求体（415）与 >64KB body（413），405 带 `Allow`；`GET ?patch=` 写入口关闭。日志改记 `config patched via POST`。 |
| `client.js`（+375/−137） | 设置页重写：`设置 → JARVIS 控制台`；四组（启动动画 / JARVIS 皮肤 / 侧栏与布局 / 诊断与关于）；草稿 + 脏标记 + `保存/恢复默认/放弃修改` + 状态行；保存后 `__DSH_JARVIS_SKIN__.apply(cfg.skin)` 即时生效；`重播启动动画` 调 `__DSH_JARVIS_API__.replay(saved)`；面板内实时读侧栏宽度/收起态。旧 theme UI 全部移除（字段保留兼容）。**0.3.9 补防呆**：重播前检查 `__DSH_JARVIS_API__.state`，旧启动层（未重启的宿主缓存）直接提示“请完全退出 DSH 重开”，不再调用会卡死遮罩的旧 `replay()`。E2E 契约：`[data-dj-settings]` / `[data-dj-group]` / `[data-dj-field]` / `[data-dj-input]` / `[data-dj-action]` / `[data-dj-status]` / `data-dj-dirty`。 |
| `splash.js`（+71/−8） | 新增 `syncCfg()`（音量/声音/交接点/跳过/减弱动态热更新）、`resetRun()`、`replay(config)`（清标记 → 重建启动层 → 按新配置播放 → 兜底定时器防卡死）；`__DSH_JARVIS_API__` 增加 `state()`；`boot(force)`。 |
| `skin.js`（+48/−2） | 新增 `replayReset()`（交接状态倒回，`prime→reveal` 可重放；背景层/观察器不重建）；`setClasses` 写 `data-dj-light` / `data-dj-focus-dim`；HUD 角标改控真实变量 `--dj-corner`；`apply()` 支持“关闭皮肤→再开启”时重建背景层/品牌头/观察器。 |
| `skin.css`（+105/−43） | 新增 §18 设置页接线：档位 full/accent、预设 hud/noir、焦点压暗作用域、浅色昼面开关（41 处浅色选择器 gate 到 `:not([data-dj-light="off"])`）；默认配置不命中任何新规则，0.3.7 观感零变化。 |

**默认值 = 原行为**：`level=glass / preset=mark7 / focusDim=true / hudCorners=true / lightMode=porcelain` 时新增 CSS 全部不生效（回归证据见 §3）。

## 2. 设置页布局（一页四组）

| 组 | 控件 |
|---|---|
| 启动动画 | 启用启动动画 / 播放时机（每会话·每天·每次）/ 播放启动音 / 音量 / 交接时点（5–30.2s）/ 允许跳过 / 减弱动态 |
| JARVIS 皮肤 | 启用皮肤 / 档位三宫格（极简·标准·全效）/ 主题预设（赤金·冷青·单色）/ 背景模式（清晰·氛围·海报·关闭）/ 背景不透明度 / 背景亮度 / 动效档位（全效·减弱·关闭）/ 主色（5 色）/ 颗粒 / 扫描线 / 背景视差 / 焦点压暗 / HUD 角标 / 浅色宿主（昼面·暗面） |
| 侧栏与布局 | 当前宽度 + 收起/展开态读数、收起/展开按钮、宿主拖拽（264–420）与 MK VII ≥330 提示 |
| 诊断与关于 | 版本 / 配置文件 / 日志 / 启动片规格 / 背景层组合 / 宿主画像（profile·model·bundles·skills）/ 皮肤与启动层 API、重新读取、放弃修改 |

控件 ↔ 配置 ↔ 效果对照：每个控件都有 `data-dj-*` 契约，保存后磁盘 JSON、渐变/类/属性三处可断言（见 §3 S15–S20）。

## 3. 验收矩阵（全部 PASS）

| 组 | 脚本 / 证据 | 结果 |
|---|---|---|
| 设置页 E2E（控件值=配置 / 草稿不写盘 / 放弃回退 / 保存写盘 / 即时生效 / 关闭再开启皮肤 / 重播时序 / 重播守卫 / 恢复默认 / GET-patch 只读 / 刷新持久化） | `tools/step3-settings-check.mjs` → `out/step3/step3-assertions.txt`、`step3-results.json` | **53/53 PASS**（0.3.9 复跑），0 页面异常 |
| 重播录屏逐帧 | `Page.startScreencast` 156 帧 → `out/step3/analyze-replay.py` → `replay-visual.json`、`replay-contact.png` | 启动视频亮度 80.5 → 闪扫帧 165.9（×2.06）→ 显影后侧栏白色像素 5 → 600；`assertFlash/assertReveal/assertUiBack` 全 true |
| 重播交接时序（DOM 采样 70ms） | `replay-timeline.json` | 遮罩 0.59s 出现、视频 0.75s 起播、5.70s 闪+扫、6.24s 显影（`dj-enter`）、6.92s 收尾；`handoffAt=5` 生效 |
| 重播按新配置（静音/音量/声音/减弱动态） | 同 E2E S32/S33a/S33b | `sound=false → muted=true, volume=0.4`；`sound=true → muted=false, volume=0.8`；`reducedMotion → 无闪无扫、约 5.3s 收尾` |
| 0.3.6 重叠矩阵回归 | `tools/fixb-verify.mjs` | **18/18 PASS** |
| Web 模式回归 | `tools/fixb-verify-web.mjs` | **10/10 PASS** |
| hero/背景/拖动/浅色回归 | `tools/phase1c-check.mjs` | **14/14 PASS** |
| 气泡动效回归 | `tools/step2-bubble-check.mjs` | **11/11 PASS** |
| 交接 DOM 时序回归 | `tools/step2-handoff-capture.mjs` | **13/13 PASS** |
| 交接逐帧画面回归 | `tools/step2-visual.mjs` | **10/10 PASS**（V1–V10） |
| 视口外气泡暂停回归 | `tools/step2-bubble-offscreen2.mjs` | PASS（滚出 paused / 滚回恢复） |

## 4. 截图 / 录屏

| 文件 | 内容 |
|---|---|
| `out/step3/step3-settings-dark.png` | 暗色设置页（顶部：启动动画组 + 皮肤组开头，含草稿/状态/版本/重播） |
| `out/step3/step3-settings-dark-skin.png` | 暗色设置页（JARVIS 皮肤组：档位三宫格/预设/背景/主色/颗粒/扫描线等） |
| `out/step3/step3-settings-light.png` / `step3-settings-light-skin.png` | 浅色“昼面”同名两屏 |
| `out/step3/step3-replay.mp4` | 重播全过程录屏（132 帧 / 12fps，含启动视频→闪扫→显影→回到设置页） |
| `out/step3/replay-contact.png` | 四格关键帧（BOOT VIDEO / HANDOFF FLASH+SCAN / UI REVEAL / BACK TO SETTINGS） |
| `out/step3/step3-replay-flash.png`、`step3-replay-after.png` | 交接瞬间 / 收尾后 |
| `out/step3/replay-key-*.jpg` | 单帧原图（video/flash/reveal/ui） |

## 5. 安装与生效

| 项 | 值 |
|---|---|
| 包 | `releases/dsh-startup-jarvis-0.3.9.tgz`，56,562,109 bytes，SHA256 `53F5ED6EE0959BF4BD810A45BD68339C8C3367454D6614A9A81F7F5F936911D0` |
| 安装 | plugin manager `install_bundle`：0.3.8 → 0.3.9，`applied`（pnpm exit 0） |
| 资产核对 | installed `node_modules/dsh-startup-jarvis/lib` 6 文件与 `package/lib` 逐字节一致（client `28D05123…`、index `2CCA4789…`、skin.js `18689CA4…`、skin.css `B035CCE5…`、splash.js `24A71CA8…`、splash.css `9B431425…`，README 也一致） |
| 生效 | **必须完全退出 DSH 再重开**（桌面端 boot 注入在 Electron 主进程启动时缓存，同 0.3.6/0.3.7 结论）；重启后状态栏 `SYS 0.3.9`，设置页版本徽标 `v0.3.9`。 |
| 安装脚本 | `安装-安全版.cmd` 已指向 0.3.9（回滚包 0.3.8），旧版备份 `安装-安全版.cmd.bak-039` |
| 回滚 | `dsh plugin --profile desktop add releases/dsh-startup-jarvis-0.3.8.tgz` 后重启 |

## 6. 未验证 / 风险

1. **真机 Electron 未实测**（重启会中断当前会话进程）：设置页打开、保存、即时换肤、重播都在隔离 verify host（同一 `dsh-server`/`dsh-host-webserver` runtime，1550×830 headless Chrome）验证；已确认桌面主窗口加载的是本地 HTTP origin（`lib/main.js` L17793 `window.loadURL(origin + '/')`），POST 走同一路由栈，但**真机一轮点按仍待你验收**。
2. **安装后、重启前会短暂出现新旧半混状态（已实测发生）**：plugin manager 安装会热重载插件（`~/.dsh/dsh-startup-jarvis.log` 出现 `mount start version=0.3.9` 且页面重载），此时 host 路由与 client.js 已是 0.3.9，但 boot 注入（皮肤/启动层）仍是宿主进程启动时缓存的旧版。0.3.9 的守卫已覆盖“旧启动层点重播会卡遮罩”这一最危险路径；皮肤保存/即时生效不受影响。**直接完全重启 DSH 即可**。
3. 重播在 `handoffAt=5` 下测得总时长 6.9s（含 0.75s 视频起播等待）；真机 30.2s 片尾全长的重播未跑（时长线性，逻辑同一路径）。
4. “档位/预设”的真实观感只做了 computed 断言 + 截图（极简/标准/单色/冷青未逐一真机目视）；默认全效不受影响。
5. 旧 `theme` 字段仍在配置文件里（内部兼容，splash 在 `skin.enabled=false` 时才会用），设置页不再暴露；若你要彻底删字段，需要再拍板。
