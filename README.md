# IE Mode Extension

> Open any page in Internet Explorer 11 (Trident) rendering engine with one click — for Chrome and Edge on Windows.

一键用 IE 11（Trident）引擎在独立窗口中打开当前页面，专为需要访问企业遗留内网系统的用户设计。

**系统要求：** Windows 10 / 11 · Chrome 88+ 或 Edge 88+

---

## 功能特点

- 点击工具栏图标即可在独立窗口中以 IE 11 引擎打开当前页面
- 支持 ActiveX 控件、IE 兼容模式渲染的遗留 Web 应用
- 独立 IE 查看器窗口，含后退 / 前进 / 地址栏导航
- 安装无需管理员权限（注册表写入 HKCU）
- 弹窗内直接显示扩展 ID，一键复制，简化安装流程
- 非 Windows 系统自动提示，不会出现无意义的错误
- 预编译 `IEModeHost.exe` 随包附带，无需安装 Visual Studio 或 .NET SDK

## 截图

| 正在打开 | 打开成功 | 未安装原生组件 |
|---------|---------|--------------|
| ![loading](docs/loading.png) | ![success](docs/success.png) | ![no-host](docs/no-host.png) |

> 截图待补充

## 快速安装

### 1. 加载扩展

1. 下载本仓库（Code → Download ZIP）并解压
2. 打开 `chrome://extensions`（或 `edge://extensions`）
3. 开启右上角 **开发者模式**
4. 点击 **加载已解压的扩展程序**，选择 `extension/` 文件夹

### 2. 安装原生组件

1. 点击工具栏中的 IE Mode 图标 → 弹窗显示你的扩展 ID，点击 **Copy**
2. 在项目根目录右键 `install.ps1` → **用 PowerShell 运行**，粘贴扩展 ID 后回车
3. 回到 `chrome://extensions`，点击 IE Mode 的重新加载按钮

> 详细说明见 [用户手册.md](用户手册.md)

### 无交互安装（CI / 批量部署）

```powershell
.\install.ps1 -ExtensionId abcdefghijklmnopabcdefghijklmnop
```

## 工作原理

```
popup.js  ──sendMessage──>  background.js  ──sendNativeMessage──>  IEModeHost.exe (Mode A)
                                                                          │
                                                                    spawn --viewer <url>
                                                                          │
                                                                    IEModeHost.exe (Mode B)
                                                                    WinForms + WebBrowser (Trident)
```

- **Mode A**：作为 Chrome/Edge 原生消息主机，读取 URL，启动 Mode B 子进程后立即退出
- **Mode B**：以 `--viewer <url>` 参数运行，创建 WinForms 窗口并以 IE 11 引擎渲染页面

## 从源码构建

如果你需要自行编译 `IEModeHost.exe`（可选，Release 包已含预编译版本）：

```
需要：Visual Studio 2019+ 或 .NET Framework 4.x SDK

cd native/IEModeHost
dotnet build -c Release
# 或在 Visual Studio 中选择 Release 配置构建
```

输出文件：`native/IEModeHost/bin/Release/IEModeHost.exe`

## 安全说明

- 扩展仅申请 `activeTab` 和 `nativeMessaging` 两项最小权限
- 原生组件注册在 `HKCU`，无需管理员权限，且只允许本扩展 ID 访问
- Trident 引擎自 2022 年起停止安全更新，**请仅在 IE 模式下打开已知可信的遗留页面**，不要用于访问未知外部网站

## 卸载

1. `chrome://extensions` → IE Mode → 移除
2. 可选清理原生组件（见[用户手册.md § 卸载](用户手册.md#8-卸载)）

## 许可证

[MIT](LICENSE)
