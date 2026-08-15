# Helldivers2Dock

[English](README.md) | [简体中文](README.zh-CN.md)

Helldivers2Dock 是一个专为 Mirabox 设备设计的 Windows Stream Dock 插件，为《绝地潜兵 2》的全部已收录战略配备提供一键宏按钮，包括支援武器、背包、哨戒炮、载具、增援、重新补给和任务专用战略配备。

插件以 Mirabox Stream Dock 硬件和 Mirabox Stream Dock 的 Node.js 插件环境为目标。

## 功能

- 108 个可独立拖放的战略配备按钮。
- 可在插件根目录的 `config.ini` 中分别设置预输入延迟（默认 `45 ms`）和按键间隔（默认 `8 ms`）。预输入延迟也用于方向键释放后的下一次输入等待。
- 可将“按键间隔”操作拖到 Mirabox 旋钮上，以 `1 ms` 为步长在 `1–250 ms` 范围内临时调整；旋钮屏幕会用动态图片显示提示文字和当前数值。
- 英文版与简体中文版使用不同的插件 ID 和安装包，在同一个 Release 中统一发布，并可同时安装。
- 使用轻量 Win32 `SendInput` 辅助程序发送默认的左 `Ctrl` + `W/A/S/D` 战略配备输入。

## 适用设备

本插件专为配合官方 Stream Dock 软件使用的 Mirabox Stream Dock 设备设计。战略配备按钮需要带可编程按键的 Mirabox 设备；临时调整按键间隔的功能需要设备带有旋钮和旋钮屏幕。其他品牌的设备或软件即使实现了兼容协议，也不是本项目的主要适配目标，不保证能够正常工作。

## 语言版本

| 版本 | 插件目录 | 发布标签 |
|---|---|---|
| 英文 | `com.n4pro.helldivers2dock.sdPlugin` | `vX.Y.Z` |
| 简体中文 | `com.n4pro.helldivers2dock.zh-cn.sdPlugin` | `vX.Y.Z` |

两个语言包会附加到同一个版本的 Release 中。它们的插件和操作 UUID 相互独立，可同时安装，但共享图标、输入序列和运行时代码。

## 运行要求

- Windows 10 或更高版本。
- Mirabox Stream Dock 设备，并使用 Stream Dock 3.10.188.226 或更高版本及 Node 20 插件运行时。
- 游戏保持默认战略配备按键：按住左 `Ctrl`，使用 `W/A/S/D` 输入方向。
- Stream Dock 与游戏应以相同的 Windows 权限级别运行。

## 安装

1. 打开所需版本的 Release，下载其中的英文版或简体中文版压缩包。
2. 将其中的 `.sdPlugin` 文件夹解压到 `%APPDATA%\HotSpot\StreamDock\plugins\`。
3. 重启 Stream Dock。
4. 从 **Helldivers 2 Dock (English)** 或 **绝地潜兵 2 Dock（简体中文）** 分类中拖放按钮。

Release 压缩包只包含可安装运行文件，不包含源码、构建脚本、私人配置文件、Wiki 原始下载图片或另一语言的插件。

### 调整按键间隔

永久调整：编辑已安装插件根目录中的 `config.ini`，在 `[Input]` 下设置 `PreInputDelayMs`（`15–250`，默认 `45`）和 `KeyIntervalMs`（`1–250`，默认 `8`），然后重启 Stream Dock。超出范围的值会自动限制到有效范围。

临时调整：把分类中的“按键间隔”操作拖到 Mirabox 旋钮，旋转时每格增减 `1 ms`。旋钮屏幕会通过动态图片显示“按键间隔”和当前毫秒数。该数值初始取自 `config.ini`，只在当前插件进程内生效，不会写回配置文件；重启 Stream Dock 后恢复配置文件值。

## 从源码构建

安装 Node.js 20+、npm、MinGW-w64 `g++` 和 PowerShell，然后运行：

```powershell
npm ci
npm run build
npm run package
```

也可以单独构建和打包某个语言：

```powershell
npm run build:en
npm run package:en

npm run build:zh-CN
npm run package:zh-CN
```

安装包输出到 `dist/`。打包脚本使用明确的运行文件白名单，并拒绝源码、`.SDProfile`、Wiki 原图和其他非运行文件。

如需从 Wiki 更新战略配备清单与图标，请先安装 ImageMagick，然后运行 `npm run refresh-data` 并重新构建。

## 国际化

所有语言元数据与本地化名称集中存放在 [`i18n/`](i18n)：

- `i18n/en.json` 显式列出英文插件元数据、分类和全部 108 个源语言名称，贡献者可以直接复制它来创建新语言。
- `i18n/zh-CN.json` 提供简体中文插件元数据、分类和 108 个名称解析结果。

`scripts/create-variants.mjs` 会检查翻译覆盖率，并生成 manifest、操作 UUID、数据目录和 Stream Dock 本地化文件。增加新语言时只需增加 i18n 文件并注册输出目录，无需复制运行时宏代码。

## 统一发布

GitHub Actions 会在一次版本更新中统一发布全部语言：

- 推送 `v1.3.0`，创建一个名为 `Helldivers2Dock 1.3.0` 的 Release。
- 同一个 Release 会同时包含 `Helldivers2Dock-en-1.3.0.zip` 和 `Helldivers2Dock-zh-CN-1.3.0.zip`。

统一发布工作流会从同一个标签设置所有语言 manifest 和压缩包的版本，执行一次全语言干净构建、插件注册测试及压缩包内容检查，然后把全部语言安装包上传到同一个 GitHub Release。

## 仓库结构

- `src/`：共享 Node.js Stream Dock 运行时源码。
- `native/`：Win32 输入辅助程序源码。
- `scripts/`：数据同步、i18n 生成、校验和打包脚本。
- `i18n/`：语言元数据与翻译。
- `assets/`：纳入版本控制的运行图标、Wiki 来源原图和插件图标。
- `data/stratagems.json`：纳入版本控制的规范化战略配备目录。
- `build/*.sdPlugin/`：构建生成的可安装插件目录，由 Git 忽略。
- `.github/workflows/`：持续集成和全语言统一发布工作流。

## 版权与来源

MIT 许可证只适用于本项目原创源码。《绝地潜兵 2》的名称、商标和来自游戏的战略配备图标不适用 MIT，版权归各自权利人所有。本项目仅在非商业粉丝插件中将其用于识别用途，与权利人不存在隶属或背书关系。

重新分发本项目或派生版本前，请阅读 [ASSET_LICENSE.md](ASSET_LICENSE.md)，其中也记录了本项目使用的 Wiki、SDK、本地化和仓库结构参考来源。
