# Kiro++ LinuxDO 发帖草稿

## 标题建议

`Kiro++：让 Kiro 走你自己的 API，本地 BYOK + 桌面控制台 + Windows 安装包`

## 正文草稿

最近把 `kiro++` 整理成了一个可以公开试用的版本，目标很直接：

**让 Kiro 使用你自己的 API 与模型，不改原安装目录。**

先说明一下思路来源：这个项目在产品思路上**明确借鉴了 Cursor++**，尤其是：

- 本地透明 BYOK
- 多 Provider 路由
- 不改原产品安装目录
- 用桌面控制台承接配置、诊断和恢复

但 `kiro++` 针对的是 **Kiro**，不是 Cursor，也没有去做账号伪造、授权绕过或官方额度绕过。

当前版本已经支持：

- Windows 本地 BYOK 路由
- 桌面控制台
- NSIS 安装包
- 国内常用 Provider 预设
- Kiro 配置备份 / 写入 / 恢复
- 故障诊断和请求日志
- 发布前摘要命令（文本 / Markdown / JSON）

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
- 提供发布辅助命令，用来快速检查：
  - 当前版本号
  - 安装包是否存在
  - 仓库是否还有未提交改动
  - 发布文档是否齐全
  - Release 下载地址是否还没替换

### 它不做什么

- 不改 Kiro 安装目录
- 不伪造账号
- 不绕授权和额度
- 不把 API Key 写进 repo 配置

### 和 Cursor++ 的关系

- **借鉴的是产品思路，不是直接照搬代码**
- Cursor++ 给我的启发主要是：把“本地 BYOK + 多 Provider + 可恢复配置 + 可视化控制”做成一个用户可直接上手的工具
- `kiro++` 的实现目标则是把这套思路落到 Kiro 这条链路上
- 当前仓库和发布材料里会明确标注这层借鉴关系，避免误解为同项目分支或直接搬运

### 最短接入路径

如果直接走桌面方式：

```powershell
npm install
npm test
npm run typecheck
npm run desktop:build
npm run desktop:package
npm run release:prep
```

如果你想直接生成可复制的发布摘要：

```powershell
npm run release:prep:markdown
npm run release:prep:json
npm run release:prep:write
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
- `npm run typecheck`
- `npm run desktop:build`
- `npm run desktop:package`
- `npm run release:prep`
- `npm run release:prep:markdown`
- `npm run release:prep:json`
- `npm run release:prep:write`
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
- 发布辅助命令只能帮助整理状态，不能替代真实 Kiro 烟测

### 仓库与下载

- GitHub 仓库：`https://github.com/hudengfenglai/kiro-plus-plus`
- Release 下载：`<RELEASE_DOWNLOAD_URL>`
- 安装包文件名：`kiro-plus-plus-0.1.0-x64.exe`

如果你本身就在折腾 Kiro + BYOK，这个版本已经够直接试了。

## 配图建议

优先顺序：

1. 桌面控制台首页
2. Provider 配置页
3. Kiro 成功聊天页
4. Diagnose 成功摘要
5. 安装包或双入口截图

## 发帖前手动替换项

- 安装包下载地址：`<RELEASE_DOWNLOAD_URL>`
- 截图文件名或图床链接
