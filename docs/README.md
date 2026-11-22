# 文档索引

> 这里的文档是开发过程的**设计施工图与验收记录**，按时间顺序保留；不是面向安装用户的说明书（安装看
> [INSTALL.md](../INSTALL.md)，总览看 [README.md](../README.md)）。

## 设计文档

| 文件 | 内容 |
|---|---|
| [design-v0.1.md](design-v0.1.md) | 启动动画最初的设计方案（素材、时间轴、技术选型） |
| [design-v0.3.md](design-v0.3.md) | 启动动画接入 DSH 的规划（资源、叠加、转场、插件结构、里程碑、风险） |
| [design-v0.4.md](design-v0.4.md) | 第一幕装甲 VFX 升级规划 |
| [design-v0.5.md](design-v0.5.md) | 第一幕重做（装甲蒙版贴车身）规划 |
| [design-v0.6.md](design-v0.6.md) | **UI 皮肤总规划 / 施工图**：约 40 个面、选择器、token、时序、验收口径 |

## 验收归档

| 文件 | 内容 |
|---|---|
| [verify/ui-assertions.md](verify/ui-assertions.md) | 0.3.0–0.3.7 的隔离 verify host 验收记录（布局、玻璃、浅色、安装链路、重叠矩阵） |
| [verify/step2-acceptance.md](verify/step2-acceptance.md) | 0.3.7 气泡动效 + 交接动效验收（11/11 + 13/13 + 10/10） |
| [verify/step3-acceptance.md](verify/step3-acceptance.md) | 0.3.9 设置页重做验收（53/53 E2E + 重播逐帧） |
| [verify/DELIVERY-REPORT.md](verify/DELIVERY-REPORT.md) | 0.3.9 交付摘要（能力、验证矩阵、已知边界） |
| [screenshots/](screenshots/) | 暗色 Hero / 聊天 / 昼面 Hero / 设置页 / 启动片关键帧 |

## 口径说明

- 文档里的 `package/lib/...` 就是本仓库根目录的 `lib/...`（打包前的源码目录名）。
- 文档里的 `out/...`、`releases/...`、`tools/...` 指作者本机工作区的历史验收产物与脚本路径；
  `out/`（逐帧截图、Chrome profile、日志）不随仓库分发，`tools/` 只保留了启动片渲染脚本。
- 素材相关说明见 [../THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md)。
