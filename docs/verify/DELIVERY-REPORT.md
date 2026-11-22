# 交付报告 — dsh-startup-jarvis 0.3.9

> 日期：2026-11-22｜宿主：DSH 0.2.2-rc.5（Windows）｜状态：0.3.9 已装进 desktop profile
> 本报告是 0.3.9 的公开摘要；详细设计与逐项验收见同目录 `ui-assertions.md`、`step2-acceptance.md`、`step3-acceptance.md`。

## 1. 交付物

| 内容 | 位置 |
|---|---|
| 插件运行时（Host + 客户端 + 全部素材） | `lib/`（12 文件，56.7 MB） |
| 启动片叠加层/制作源码 | `preview/`、`scripts/`、`tools/render-video.mjs`、`assets/` |
| 设计施工图 | `docs/design-v0.6.md`（+ v0.1/v0.3/v0.4/v0.5） |
| 验收归档 | `docs/verify/` |
| 安装包 | GitHub Release `dsh-startup-jarvis-0.3.9.tgz` |

## 2. 能力清单

**启动动画**

- 30.2s 成片（1920×1080/30fps/H.264+AAC，原片原声），品牌开幕 → 台词字幕 → 加载条 → 工作区/系统检查 → Logo slam → 交接。
- 交接：冻结最后一帧 → 金红扫描线 + 暖白闪（峰值 300ms）→ 分区显影 → 启动层在已显影 UI 上淡出，约 1.2s。
- 模式 `session`（默认）/`daily`/`always`；`Esc`/点击跳过；静音兜底、8s 看门狗、解码失败退海报、`reducedMotion` 300ms 直淡。

**皮肤**

- 动态背景 4 模式（hud/ambient/poster/off）+ 不透明度/亮度/视差；345px 玻璃侧栏；HUD 铭牌；Hero 反应堆环与 chips；
- 用户气泡呼吸边环 + 高光扫过（视口外暂停）；pwsh 工具大卡/过程组/代码块/表格；浅色「昼面」；
- 档位 accent/full/glass、预设 mark7/hud/noir、动效 full/reduced/off、focusDim/hudCorners/lightMode 全部真实接线。

**设置页**

- `设置 → JARVIS 控制台` 一页四组；草稿 + 脏标记 + 保存/恢复默认/放弃；保存即时换肤；真重播（含旧启动层守卫）。

## 3. 验证矩阵（作者本机 + 隔离 verify host）

| 组 | 断言 | 结果 |
|---|---|---|
| 设置页 E2E（0.3.9） | 53/53 | PASS |
| 重播交接逐帧（156 帧） | 亮度 80.5→165.9→显影白像素 5→600 | PASS |
| 0.3.6 重叠矩阵（280/345/420/收起，hero+chat） | 18/18 | PASS |
| Web 模式（展开/收起/重开） | 10/10 | PASS |
| hero/背景/拖动/浅色回归 | 14/14 | PASS |
| 气泡动效（dark/light/reduced/off/布局/api） | 11/11 + offscreen | PASS |
| 交接 DOM 时序 | 13/13 | PASS |
| 交接逐帧画面 | 10/10 | PASS |
| 安装与资产一致性 | installed `lib` 6 文件 + README 与 `package` 逐字节一致 | PASS |
| 仓库冒烟测试（本仓库） | `npm test` 3 套 | PASS |

## 4. 已知边界 / 未验证

1. **Electron 真机**：设置页打开/保存/即时换肤/重播在隔离 verify host（同一 server runtime）验证；
   桌面主窗口加载本地 HTTP origin，POST 走同一路由栈，但真机点按未逐项录屏。
2. **30.2s 片尾全长重播**未跑（用 `handoffAt=5` 压缩时序验证，逻辑同一路径）。
3. 浅色「昼面」、三种预设、极简/标准档的观感为 computed 断言 + 截图，未逐一目视。
4. 装包后、完全重启前会短暂出现「新 host/client + 旧启动层」的半混状态；0.3.9 已对「旧启动层点重播」做前置拒绝，
   皮肤保存/即时生效不受影响，**完全重启 DSH 即消除**。
5. 宿主低于 0.2.2-rc.5 未验证。

## 5. 生效与回滚

- 安装后必须**完全退出 DSH（含托盘）再重开**；重启后状态栏 `SYS 0.3.9`、设置页 `v0.3.9`。
- 回滚：`dsh plugin --profile desktop add <0.3.8 的 tgz>` 后完全重启；或移除插件。
