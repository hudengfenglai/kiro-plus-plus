# Kiro++ 发布前验收记录

Date: 2026-06-08  
Scope: public-ready source tree, Windows package, desktop renderer, routing diagnosis, existing real Kiro traffic evidence

## 自动化验证

- `npm test`
  - Result: passed
  - Notes: 94 tests passed, 0 failed
- `npm run typecheck`
  - Result: passed
- `npm run desktop:build`
  - Result: passed
- `npm run desktop:package`
  - Result: passed
  - Artifact: `release/kiro-plus-plus-0.1.0-x64.exe`

## 当前打包产物

已确认存在：

- `release/kiro-plus-plus-0.1.0-x64.exe`
- `release/win-unpacked/Kiro++ Console.exe`
- `release/win-unpacked/Launch Kiro with Kiro++.cmd`

打包产物中已包含：

- `docs/README.md`
- `docs/desktop-quickstart.md`
- `docs/domestic-providers.md`
- `docs/release/linuxdo-post.md`
- `docs/release/release-verification.md`

## Kiro 路由与配置验证

已有 Kiro 路由诊断结果表明：

- 本地 endpoint 覆盖已生效
- `officialDefaultStillUsed = false`
- `autoModeBlocksByok = false`
- `profileAutoModeBlocksByok = false`
- `redactionEnabled = true`

这说明当前配置链路已经能把 Kiro 指向本地 BYOK 路由，而不是继续落回官方默认 endpoint。

## 真实 Kiro 请求证据

来自 `.\.kiro-plus-plus\requests.jsonl` 的既有真实请求记录已确认：

- `GetUsageLimits` -> `200`
- `ListAvailableModels` -> `200`
- `InvokeMCP` -> `200`
- `GenerateAssistantResponse` -> `200`

这些记录包含 Kiro SDK 请求打到本地代理的证据，说明此前已经发生过真实 Kiro -> kiro++ 的链路命中。

## 当前仍建议补做的人工烟测

以下项目建议在公开发帖或正式 Release 前，基于当前版本再手动做一次“新鲜验证”：

1. 通过桌面控制台重新保存 Provider Key 并测试一次上游连通性
2. 启动当前代理后重新拉起 Kiro，完成一次新的 Agent chat
3. 在当前会话里重新触发一次 Autocomplete
4. 执行一次当前会话下的 restore 回滚
5. 截取桌面控制台首页、Provider 配置页、Kiro 成功聊天页和 Diagnose 成功摘要

## 当前无法在仓库内自动完成的原因

- 当前工作区不直接保存 Provider API Key
- 当前 shell 环境里也没有可复用的 `KIRO_PLUS_*` 密钥变量
- 因此无法在不重新输入密钥的前提下，自动完成新的真实上游 Provider 烟测

## 发布判断

当前版本已经满足以下公开发布前提：

- 自动化测试、类型检查、桌面构建、Windows 打包全部通过
- 仓库中已经有公开可读的安装、排错和发帖材料
- 仓库中已经有 `release:prep` / `release:prep:markdown` / `release:prep:json` / `release:prep:write` 四种发布摘要入口
- Kiro 路由配置和诊断链路已有有效证据
- 已存在真实 Kiro 流量命中本地代理的记录

但如果要对外声称“本次版本重新完成了完整人工烟测”，仍应补完上面的 5 项人工验证。
