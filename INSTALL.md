# 安装 dsh-startup-jarvis 0.3.9

> 这是一个真正的 **DSH profile 插件**：装完后出现在「插件」列表里，可启用/禁用/卸载；
> 不改 DSH 安装目录、不做系统级修改，卸载即恢复原样。

## 前置检查

| 项 | 要求 |
|---|---|
| 宿主 | DeepSeek Harness 桌面版（Windows），实测 `0.2.2-rc.5` |
| Node | 宿主自带运行时即可；从源码打包需要 Node ≥ 20 |
| 互斥 | 同一 profile 只能启用一个启动动画插件，请先停用 elisa / moss2 / vyron 等 |
| 时机 | **安装全过程 DSH 必须完全退出**（关窗口 + 托盘退出） |

## 方式 A：把安装包交给 DSH 装（最简单）

1. 从 [Releases](https://github.com/QIFANAI/dsh-startup-jarvis/releases) 下载 `dsh-startup-jarvis-0.3.9.tgz`。
2. 打开 DSH，把 tgz 拖进对话框，说「帮我安装这个插件」。
3. agent 会调用 `plugin_manager`（`install_bundle`，target = tgz 绝对路径）；若宿主正在运行，安装会热重载插件并重载页面。
4. **完全退出 DSH 再打开** —— 桌面端的启动层/皮肤注入在 Electron 主进程启动时缓存，只刷新页面不会加载新版启动层。

## 方式 B：命令行安装

```powershell
# 1) 先完全退出 DSH（含托盘）
# 2) 安装（把两个路径替换成你的实际路径）
& "<DSH 安装目录>\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "<tgz 绝对路径>"

# 3) 确认
& "<DSH 安装目录>\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop list
```

装完重开 DSH：首屏播放启动动画 → 播完自动交接进工作区；状态栏显示 `SYS 0.3.9`。

## 方式 C：从源码打包安装

```powershell
git clone https://github.com/QIFANAI/dsh-startup-jarvis.git
cd dsh-startup-jarvis
npm pack --pack-destination releases
# 得到 releases/dsh-startup-jarvis-0.3.9.tgz，再按方式 A / B 安装
```

## 安装后

- 设置入口：**设置 → JARVIS 控制台**（一页四组：启动动画 / JARVIS 皮肤 / 侧栏与布局 / 诊断与关于）
- 配置文件：`~/.dsh/dsh-startup-jarvis.json`（首次启动自动生成默认值）
- 日志：`~/.dsh/dsh-startup-jarvis.log`（host 与浏览器 beacon 都会追加）
- 改完配置：皮肤保存后即时生效；启动动画改动在「重播启动动画」时生效；**启动层本身改动需完全重启 DSH**

## 出问题时

| 现象 | 处理 |
|---|---|
| 启动动画不播 | 看 `~/.dsh/dsh-startup-jarvis.log` 是否有 `mount start`；确认配置文件 `enabled=true`、没有其他启动插件抢占 |
| 启动层卡住/黑屏 | `Esc` 或点击跳过；仍卡 → 完全退出 DSH 重开（启动层有 55s 兜底） |
| 皮肤没变化 | 设置页看「保存」是否成功；刷新页面（皮肤 CSS/JS 每请求读盘）；启动层改动必须完全重启 |
| 装完设置页版本还是旧的 | 宿主进程内缓存，完全重启 DSH |
| 想回滚 | `dsh plugin --profile desktop add <旧版 tgz>` 后完全重启；或移除插件 |

## 卸载

```powershell
# 完全退出 DSH 后：
& "<DSH 安装目录>\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop remove dsh-startup-jarvis
```

配置文件不会自动删除；删除 `~/.dsh/dsh-startup-jarvis.json` 即彻底恢复默认。
