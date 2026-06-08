# Kiro++

Kiro++ 是一个 **Windows 优先的本地 BYOK 路由与桌面控制台**，目标是：

**让 Kiro 使用你自己的 API 与模型，不改原安装目录。**

这个项目在产品思路上明确借鉴了 Cursor++ 的几个方向：

- 本地透明 BYOK
- 多 Provider 路由
- 不改原产品安装目录
- 用可视化控制台承接配置、诊断、恢复和排错

但 Kiro++ 面向的是 **Kiro**，不是 Cursor，也不做账号伪造、授权绕过或官方额度绕过。

## 它能做什么

- 在本机启动一个 Kiro 可用的本地 endpoint
- 把 Kiro 请求路由到你自己的 Provider Key
- 提供 Windows 桌面控制台，用来完成：
  - Provider 预设选择、保存和测试
  - 模型列表拉取与默认模型选择
  - BYOK 开关
  - Kiro detect / apply / diagnose / restore
  - 启动时自动应用
  - 日志查看与脱敏诊断导出
  - 单次 Playground 验证
- 生成 Windows NSIS 安装包

## 它不做什么

- 不修改 `E:\Kiro` 或其他 Kiro 安装目录
- 不伪造账号
- 不绕过授权、额度或官方计费
- 不把 Provider API Key 写进仓库配置文件

## 当前支持的常用 Provider 预设

- DeepSeek
- DashScope / Qwen
- Moonshot / Kimi
- Zhipu GLM
- SiliconFlow

更多环境变量和 CLI 示例见：[docs/domestic-providers.md](docs/domestic-providers.md)

## 最短上手路径

### 桌面端方式

1. 安装依赖
2. 构建桌面端
3. 打包 Windows 安装包
4. 打开 `Kiro++ Console`
5. 选择 Provider 预设并填写 Key
6. 拉取或确认模型
7. 测试 Provider
8. Apply to Kiro
9. Run Diagnose
10. 使用 `Launch Kiro with Kiro++` 启动 Kiro

常用命令：

```powershell
npm install
npm test
npm run typecheck
npm run desktop:build
npm run desktop:package
npm run release:prep
```

安装包输出位置：

```text
release/kiro-plus-plus-0.1.0-x64.exe
```

### DeepSeek 最短示例

桌面端推荐配置：

- preset: `DeepSeek`
- base URL: `https://api.deepseek.com`
- model: `deepseek-v4-pro` 或 `deepseek-v4-flash`

如果先走 CLI：

```powershell
node .\src\cli\main.js health-config
node .\src\cli\main.js configure
node .\src\cli\main.js diagnose
node .\src\cli\main.js start
node .\src\cli\main.js restore
```

CLI 环境变量示例：

```powershell
$env:KIRO_PLUS_PROVIDER = "openai-compatible"
$env:KIRO_PLUS_OPENAI_API_KEY = "<DEEPSEEK_API_KEY>"
$env:KIRO_PLUS_OPENAI_BASE_URL = "https://api.deepseek.com"
$env:KIRO_PLUS_MODEL = "deepseek-v4-pro"
node .\src\cli\main.js start
```

## 桌面端入口

安装后默认会有两个入口：

- `Kiro++ Console`
- `Launch Kiro with Kiro++`

推荐第一次使用时先打开 `Kiro++ Console` 完成配置，再启动 Kiro。

## 启动时自动应用

桌面控制台支持 `启动时自动应用`。

开启后，应用启动时会尝试：

1. 检测 Kiro 安装
2. 启动本地代理
3. 在需要时重新应用 BYOK 路由

工作台中会分别显示：

- `启动预热状态`
- `Launch Kiro with Kiro++`

这样可以区分“应用启动时自动处理失败”还是“手动拉起 Kiro 失败”。

## 支持包与排错

桌面端支持导出本地诊断包，适合：

- GitHub Issue
- LinuxDO 求助
- 私下排错

可导出的内容包括：

- `summary.txt`
- `snapshot.json`
- `recent-requests.json`
- `manifest.json`
- `README.txt`

默认会做脱敏处理：

- `authorization`
- `cookie`
- AWS 临时安全头
- 导出摘要中的本机文件路径

推荐排错顺序：

1. 运行 `Diagnose`
2. 检查 `localRegions`
3. 检查 `unsupportedOperationsSeen`
4. 查看最近请求日志
5. 导出支持包并查看 `summary.txt`

## 当前验证状态

当前仓库内已完成并确认通过：

- `npm test`
- `npm run typecheck`
- `npm run desktop:build`
- `npm run desktop:package`

当前测试规模：

- `93` 个自动化测试通过

已经确认的协议与路由证据包括：

- Kiro 路由诊断可返回本地 endpoint 覆盖
- 已观察到真实 Kiro 请求命中本地代理：
  - `GetUsageLimits`
  - `ListAvailableModels`
  - `InvokeMCP`
  - `GenerateAssistantResponse`

更细的发布前记录见：

- [docs/release/release-verification.md](docs/release/release-verification.md)
- [docs/release/smoke-checklist.md](docs/release/smoke-checklist.md)

## 发布辅助命令

当前仓库已经内置发布准备摘要命令：

```powershell
npm run release:prep
npm run release:prep:markdown
npm run release:prep:json
```

用途分别是：

- `release:prep`
  - 查看纯文本发布摘要
- `release:prep:markdown`
  - 生成可复制到 GitHub Release / 发帖草稿的 Markdown 摘要
- `release:prep:json`
  - 生成机器可读 JSON，方便后续脚本串联

## 当前限制

- 当前仅支持 Windows
- 上游 Provider 的 SSE 目前仍是缓冲后再编码成 Kiro event-stream
- 安装包在更多干净 Windows 机器上的入口验证还需要继续补
- 每次正式公开发布前，仍建议做一次人工 Kiro UI 烟测

## 文档入口

- 桌面端最短路径：[docs/desktop-quickstart.md](docs/desktop-quickstart.md)
- 国内 Provider 示例：[docs/domestic-providers.md](docs/domestic-providers.md)
- Kiro 流式兼容说明：[docs/streaming-chat.md](docs/streaming-chat.md)
- LinuxDO 发帖草稿：[docs/release/linuxdo-post.md](docs/release/linuxdo-post.md)
- 发布前验收记录：[docs/release/release-verification.md](docs/release/release-verification.md)

## 安全边界

- `configure` 会先备份 Kiro 用户 settings 再写入
- `restore` 会恢复最近一次备份
- 桌面端关闭 BYOK 时会恢复最近的 Kiro 配置备份
- 默认日志会对授权头、Cookie 和 AWS 风格安全头做脱敏
