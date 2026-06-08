# Kiro++ 真实烟测与截图清单

这份清单用于公开发帖、GitHub Release 或大版本发布前的最后一轮人工确认。

## 目标

确认当前版本不仅能通过自动化测试，而且能在真实 Kiro 环境中完成：

- Provider 测试
- Kiro 路由应用
- Agent chat
- Autocomplete
- 恢复原配置

并顺手采集对外可用截图。

## 烟测前准备

1. 安装或确认 Kiro 可正常启动
2. 安装当前 Kiro++ 打包版
3. 准备一个可用的 Provider Key
4. 确认本机没有残留的异常 Kiro 手工配置

推荐首测 Provider：

- DeepSeek
- DashScope / Qwen

## 真实烟测步骤

### 1. 桌面控制台启动

- 打开 `Kiro++ Console`
- 确认首页和工作台能正常显示
- 确认浅色 / 深色主题切换正常

建议截图：

- 控制台首页

### 2. Provider 配置

- 选择一个 Provider 预设
- 填写 API Key
- 拉取模型或手工确认模型
- 设置默认模型
- 点击 `测试 Provider`

验收点：

- 测试成功
- 返回模型名和耗时
- 不出现未定义方法报错

建议截图：

- Provider 配置页

### 3. Apply to Kiro

- 点击 `Apply to Kiro`
- 点击 `Run Diagnose`

验收点：

- `localRegions` 非空
- `officialDefaultStillUsed = false`
- `autoModeBlocksByok = false`
- `profileAutoModeBlocksByok = false`

建议截图：

- Diagnose 成功摘要

### 4. Launch Kiro

- 使用 `Launch Kiro with Kiro++`
- 或从控制台右上角启动 Kiro

验收点：

- 启动流程状态清晰
- 若失败，控制台能显示具体失败步骤

### 5. Kiro 内 Agent Chat

- 在 Kiro 中发起一次 Agent chat

验收点：

- 能收到一次完整回答
- 本地代理日志出现对应请求
- 模型路由符合预期

建议截图：

- Kiro 成功聊天页

### 6. Kiro 内 Autocomplete

- 在 Kiro 中触发一次补全

验收点：

- 能看到一次有效补全
- 本地代理日志出现对应请求或关联调用证据

### 7. 恢复配置

- 在控制台执行 `恢复备份`
- 或关闭 BYOK 后确认恢复

验收点：

- 原始 Kiro 配置可恢复
- Diagnose 不再显示本地路由覆盖

## 建议对外展示的截图顺序

1. 桌面控制台首页
2. Provider 配置页
3. Diagnose 成功摘要
4. Kiro 成功聊天页
5. 可选：安装包或双入口截图

## 发布前最终核对

- `npm test`
- `npm run typecheck`
- `npm run desktop:build`
- `npm run desktop:package`
- 安装包文件存在
- 关键截图已保存
- LinuxDO 帖子草稿已替换仓库地址和下载地址
