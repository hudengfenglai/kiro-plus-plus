export function buildDesktopHealthSummary({ bridgeStatus, appMeta, proxyStatus, kiroDetection }) {
  const items = [];

  if (!bridgeStatus?.available) {
    items.push({
      key: "bridge-missing",
      severity: "error",
      title: "桌面桥接未注入",
      detail: "当前窗口没有拿到 Kiro++ 的 Electron bridge，桌面按钮将无法正常工作。"
    });
  } else if (!bridgeStatus.complete) {
    items.push({
      key: "bridge-outdated",
      severity: "warning",
      title: "当前安装包桥接不完整",
      detail: `缺少 ${bridgeStatus.missingMethods.length} 个桥接方法，建议重新安装最新版 Kiro++ Console。`
    });
  }

  if (!appMeta) {
    items.push({
      key: "build-meta-missing",
      severity: "warning",
      title: "当前安装包没有暴露版本信息",
      detail: "这通常意味着你正在运行旧安装包，建议重新打包或重装最新版本。"
    });
  }

  if (proxyStatus?.state === "error") {
    items.push({
      key: "proxy-error",
      severity: "error",
      title: "本地代理当前异常",
      detail: proxyStatus.error || "代理状态为 error，请先检查启动日志。"
    });
  } else if (proxyStatus?.state !== "running") {
    items.push({
      key: "proxy-not-running",
      severity: "info",
      title: "本地代理尚未运行",
      detail: "如果要验证路由，请先启动代理。"
    });
  }

  if (!kiroDetection?.installed) {
    items.push({
      key: "kiro-not-detected",
      severity: "info",
      title: "尚未检测到 Kiro 安装",
      detail: kiroDetection?.detectionHint || "请先确认 Kiro 安装路径。"
    });
  }

  const highestSeverity = items.some((item) => item.severity === "error")
    ? "error"
    : items.some((item) => item.severity === "warning")
      ? "warning"
      : "success";

  return {
    severity: highestSeverity,
    summary: items.length === 0 ? "桌面环境已就绪" : `发现 ${items.length} 项需要关注的问题`,
    detail: items.length === 0
      ? "当前安装包、桥接、代理和 Kiro 探测都处于可继续验证的状态。"
      : items[0].detail,
    items
  };
}
