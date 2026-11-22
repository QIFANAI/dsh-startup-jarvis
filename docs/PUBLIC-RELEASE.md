# 公开仓库说明（v0.3.9 · 完整素材版）

> 生成：2026-11-22｜仓库：<https://github.com/QIFANAI/dsh-startup-jarvis>｜基线：作者本机 `dsh-startup-jarvis@0.3.9`（2026-11-22 18:24 装进 desktop profile）

## 1. 结论

- 本仓库是 v0.3.9 的**无损开源版**：插件运行时、全部内嵌素材、设计文档、验收归档、制作源码、测试全部随仓库发布。
- **没有阉割任何素材或功能**：`lib/assets/` 6 个文件（启动片 44.7 MB、动态背景 11.1 MB + 345 KB、海报 3 张）
  与作者本机 0.3.9 运行版**逐字节一致**；`lib/` 6 个代码/样式文件同样逐字节一致。
- 克隆后 `npm pack` 得到的 tgz 与 Release 附件同源；运行时不联网、不下载素材、不依赖外部 CDN。
- 素材版权归原权利人；本仓库按作者决定以**完整素材、非商业个人同人用途**公开分享，不主张权利，异议即移除
  （见 [../THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md)）。

## 2. 与交付时「仅本机自用」口径的差异

v0.3.9 交付时，`package.json` 写的是 `private: true`、`license: UNLICENSED`，README/INSTALL 也按「本机自用」口径写。
公开仓库按下述方式调整——**运行时零改动**：

| 位置 | 原口径 | 公开仓库 |
|---|---|---|
| `package.json` | `private: true`、`license: UNLICENSED` | 去掉 `private`；`license: MIT`；补 `author`/`repository`/`homepage`/`bugs`/`keywords`/`scripts` |
| `README.md` / `INSTALL.md` | 本机构建与安装笔记（含作者本机路径、历史版本信息） | 重写为面向使用者的说明；不涉及运行时代码 |
| `LICENSE` / `THIRD-PARTY-NOTICES.md` | 不存在 | 新增：代码 MIT；素材归属与作者决定 |
| `docs/*` | 本机设计稿（含 `C:\Users\...`、`E:\dshdesign\...` 等路径） | 仅替换本机路径为占位符，正文未删减 |
| `scripts/plugin-selftest.mjs` | 绝对路径 `file:///E:/.../lib/index.js` 的自测脚本 | 移入 `test/smoke-host.mjs`，改为相对导入并加断言；**测试专用改动**，不影响 `lib/` |
| `release.json` | 无 | 新增：版本、仓库、附件哈希基线（供 Release 使用） |

> 以上口径改动全部可逐项核对：`git diff` 对 `lib/**` 为空（与作者本机 0.3.9 哈希一致），改动只落在文档、元数据与测试。

## 3. 未入仓库的内容（非插件内容，按设计排除）

| 路径 | 体量 | 原因 |
|---|---|---|
| `out/` | 3.24 GB | 本机验收工作区（逐帧截图、Chrome profile、日志、探针 JSON、历史报告）；验收结论已精选到 `docs/verify/` |
| `releases/` 历史 tgz | 967 MB | 0.1.0–0.3.8 的构建产物；本仓库只发布 0.3.9，附件由 Release 提供 |
| `WallpaperEngine素材/` | 601 MB | Wallpaper Engine 工坊原始素材目录；插件运行使用转码后的 `lib/assets/**` |
| `11月19日.mp4` | 105.8 MB | 作者自剪 4K 原片；**单文件超出 GitHub 100 MB 限制**，且非运行必需 |
| `assets/jarvis-1080p.mp4` | 35.3 MB | 原片的 1080p 转码底片；可由原片一步转出（命令见 [make-of.md](make-of.md)） |
| `clips/` | 36.3 MB | 早期分镜切片（v0.2 时期），最终成片未使用 |
| `audio/`、`11月19日.mp3` | 20.3 MB | 原片音轨/分析素材；成片内已含原声 |
| `安装-安全版.cmd`、`安装.cmd`、`紧急恢复.cmd`、`启动JARVIS.*` | — | 作者本机路径专用脚本（写死 `E:\dsh\...`），公开版改用 `INSTALL.md` 的通用步骤 |
| `harness/`、`tools/` 其它探针 | — | 本机联调/验收脚本；只保留启动片渲染所需的 `tools/render-video.mjs` |

> `lib/`、`docs/`（设计稿）、`preview/`、`scripts/`、`assets/`（制作源）无任何删减；
> `docs/` 只替换了本机绝对路径，验收记录中的结论/数字/断言全部保留。

## 4. 验证

| 项 | 结果 |
|---|---|
| `lib/**` 与本机 0.3.9 逐字节对照 | **一致**（6 个代码/样式文件 + 6 个素材，SHA256 全等） |
| 本机 `npm test`（3 套零依赖冒烟） | PASS |
| 干净克隆 `npm test` + `npm pack` | PASS |
| GitHub Actions（run 45015039625） | **Node 20 / Node 22 均 success** |
| 远端 git 树 | `45b86809cdd53c47b6b8388dd78b550305cd5138`，与本地 `HEAD^{tree}` 一致（160 个 blob） |
| Release 附件 | GitHub 侧 `digest=sha256:61049915…a0db4`，与本地 `releases/SHA256SUMS` 一致（56,567,344 B） |

## 5. 已知边界（不冒充已验证）

- Electron 真机的设置页点按、30.2s 片尾全长交接未逐项录屏；验证矩阵以隔离 verify host（同一 server runtime）为准。
- 浅色「昼面」与三种预设的逐档观感为 computed 断言 + 截图，未逐一真机目视。
- 宿主实测 0.2.2-rc.5；更低 DSH 版本未验证。
