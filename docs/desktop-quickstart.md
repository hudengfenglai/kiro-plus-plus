# 桌面端快速开始

这份文档面向已经安装 Windows 桌面版的用户，目标是用最短路径把 Kiro++ 跑通。

## 首次使用

1. 打开 `Kiro++ Console`
2. 选择一个 Provider 预设
3. 填写你的 API Key
4. 拉取模型或手工确认模型列表
5. 点击 `测试 Provider`
6. 点击 `Apply to Kiro`
7. 点击 `Run Diagnose`
8. 使用 `Launch Kiro with Kiro++` 启动 Kiro

## 推荐的 DeepSeek 配置

- preset: `DeepSeek`
- base URL: `https://api.deepseek.com`
- model: `deepseek-v4-pro` 或 `deepseek-v4-flash`

## 启动时自动应用

如果你开启了 `启动时自动应用`，桌面端启动时会尝试：

1. 检测 Kiro 安装
2. 启动本地代理
3. 在需要时重新应用 BYOK 路由

工作台里会分别显示：

- `启动预热状态`：应用启动阶段的自动处理结果
- `Launch Kiro with Kiro++`：手动拉起 Kiro 的结果

这样可以区分是启动预热失败，还是手动启动 Kiro 失败。

## 支持包

如果还有问题没有解决，建议按这个顺序排查：

1. 打开 `Logs & Diagnostics`
2. 导出一个 zip 支持包
3. 查看 `summary.txt`
4. 再把支持包发到 GitHub Issue、LinuxDO 或私下排错场景里

## 恢复配置

你可以使用 `恢复备份`，或者关闭 `BYOK`，把 Kiro 恢复到最近一次保存的原始配置。
