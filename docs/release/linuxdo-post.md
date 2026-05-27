# Kiro++ LinuxDO 发帖草稿

## 标题建议

`Kiro++：让 Kiro 走你自己的 API，本地 BYOK + 桌面控制台 + Windows 安装包`

## 正文草稿

最近把 `kiro++` 整理成了一个可以公开试用的版本，目标很直接：

**让 Kiro 使用你自己的 API 与模型，不改原安装目录。**

当前版本已经支持：

- Windows 本地 BYOK 路由
- 桌面控制台
- NSIS 安装包
- 国内常用 Provider 预设
- Kiro 配置备份 / 写入 / 恢复
- 故障诊断和请求日志

内置的高频 Provider 预设主要有：

- DeepSeek
- DashScope / Qwen
- Moonshot / Kimi
- Zhipu GLM
- SiliconFlow

### 它做什么

- 在本机启动一个 Kiro 可用的本地 endpoint
- 把 Kiro 请求路由到你自己的 Provider Key
- 提供桌面控制台来完成：
  - Provider 保存与测试
  - 模型拉取与默认模型切换
  - BYOK ON / OFF
  - Kiro detect / apply / diagnose / restore
  - 日志和脱敏诊断摘要导出

### 它不做什么

- 不改 Kiro 安装目录
- 不伪造账号
- 不绕授权和额度
- 不把 API Key 写进 repo 配置

### 最短接入路径

如果直接走桌面方式：

```powershell
npm install
npm test
npm run desktop:build
npm run desktop:package
```

如果你先想走 CLI：

```powershell
node .\src\cli\main.js configure
node .\src\cli\main.js diagnose
node .\src\cli\main.js start
```

DeepSeek 示例：

```powershell
$env:KIRO_PLUS_PROVIDER = "openai-compatible"
$env:KIRO_PLUS_OPENAI_API_KEY = "<DEEPSEEK_API_KEY>"
$env:KIRO_PLUS_OPENAI_BASE_URL = "https://api.deepseek.com"
$env:KIRO_PLUS_MODEL = "deepseek-v4-pro"
```

### 当前验证结果

已经完成的验证：

- `npm test`
- `npm run desktop:build`
- `npm run desktop:package`
- Kiro 路由诊断覆盖全部本地 region
- 已观察到真实 Kiro 请求命中本地代理：
  - `GetUsageLimits`
  - `ListAvailableModels`
  - `InvokeMCP`
  - `GenerateAssistantResponse`

### 当前限制

- 目前只支持 Windows
- 上游 SSE 目前仍是缓冲后再转成 Kiro event-stream
- 安装包在更多干净机器上的入口验证还需要继续补
- 每次正式发版前，最好再做一次人工 Kiro UI 烟测

如果你本身就在折腾 Kiro + BYOK，这个版本已经够直接试了。

## 配图建议

优先顺序：

1. 桌面控制台首页
2. Provider 配置页
3. Kiro 成功聊天页
4. Diagnose 成功摘要
5. 安装包或双入口截图

## 发帖前手动替换项

- 仓库地址：`<GITHUB_REPO_URL>`
- 安装包下载地址：`<RELEASE_DOWNLOAD_URL>`
- 截图文件名或图床链接
