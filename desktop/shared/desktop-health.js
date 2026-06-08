export function buildDesktopHealthSummary({ bridgeStatus, appMeta, proxyStatus, isByokEnabled, kiroDetection, diagnose }) {
  const items = [];

  if (!bridgeStatus?.available) {
    items.push({
      key: "bridge-missing",
      severity: "error",
      title: "桌面桥接未注入",
      detail: "当前窗口没有拿到 Kiro++ 的 Electron bridge，桌面按钮将无法正常工作。",
      actionLabel: "查看 Quickstart",
      actionKind: "open-quickstart",
      focus: "status"
    });
  } else if (!bridgeStatus.complete) {
    items.push({
      key: "bridge-outdated",
      severity: "warning",
      title: "当前安装包桥接不完整",
      detail: `缺少 ${bridgeStatus.missingMethods.length} 个桥接方法，建议重新安装最新版 Kiro++ Console。`,
      actionLabel: "查看 Quickstart",
      actionKind: "open-quickstart",
      focus: "status"
    });
  }

  if (!appMeta) {
    items.push({
      key: "build-meta-missing",
      severity: "warning",
      title: "当前安装包没有暴露版本信息",
      detail: "这通常意味着你正在运行旧安装包，建议重新打包或重装最新版本。",
      actionLabel: "查看 Quickstart",
      actionKind: "open-quickstart",
      focus: "status"
    });
  }

  if (proxyStatus?.state === "error") {
    items.push({
      key: "proxy-error",
      severity: "error",
      title: "本地代理当前异常",
      detail: proxyStatus.error || "代理状态为 error，请先检查启动日志。",
      actionLabel: "查看日志",
      actionKind: "open-logs",
      focus: "logs"
    });
  } else if (proxyStatus?.state !== "running") {
    items.push({
      key: "proxy-not-running",
      severity: "info",
      title: "本地代理尚未运行",
      detail: "如果要验证路由，请先启动代理。",
      actionLabel: "启动代理",
      actionKind: "start-proxy",
      focus: "kiro"
    });
  }

  if (!kiroDetection?.installed) {
    items.push({
      key: "kiro-not-detected",
      severity: "info",
      title: "尚未检测到 Kiro 安装",
      detail: kiroDetection?.detectionHint || "请先确认 Kiro 安装路径。",
      actionLabel: "打开 Kiro 区",
      actionKind: "open-kiro",
      focus: "kiro"
    });
  }

  if (kiroDetection?.installed && proxyStatus?.state === "running" && !isByokEnabled) {
    items.push({
      key: "byok-disabled",
      severity: "warning",
      title: "BYOK 尚未启用",
      detail: "本地代理已经可用，但当前还没有启用 BYOK 路由。",
      actionLabel: "启用 BYOK",
      actionKind: "enable-byok",
      focus: "kiro"
    });
  }

  if (kiroDetection?.installed && proxyStatus?.state === "running" && isByokEnabled) {
    if (diagnose?.autoModeBlocksByok || diagnose?.profileAutoModeBlocksByok) {
      items.push({
        key: "diagnose-auto-mode",
        severity: "warning",
        title: "Kiro Auto 模式仍在阻止本地路由",
        detail: "当前诊断显示 Auto 模式仍可能覆盖本地 endpoint，建议先刷新诊断并检查 Kiro 配置。",
        actionLabel: "刷新诊断",
        actionKind: "refresh-diagnose",
        focus: "logs"
      });
    } else if ((diagnose?.localRegions?.length ?? 0) === 0) {
      items.push({
        key: "diagnose-no-local-region",
        severity: "warning",
        title: "诊断尚未确认本地 endpoint 生效",
        detail: "BYOK 已启用，但当前诊断没有发现指向本地代理的 region，建议先刷新诊断。",
        actionLabel: "刷新诊断",
        actionKind: "refresh-diagnose",
        focus: "logs"
      });
    }
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

export function formatDesktopHealthSummary(summary) {
  return [
    `Desktop health: ${summary.summary}`,
    `Desktop health severity: ${summary.severity}`,
    `Desktop health detail: ${summary.detail}`,
    ...summary.items.map((item, index) =>
      `Desktop health item ${index + 1}: [${item.severity}] ${item.title} -> ${item.actionLabel}`
    )
  ].join("\n");
}

export function getDesktopHealthPrimaryAction(summary) {
  const item = summary.items[0] ?? null;
  if (!item) {
    return {
      actionLabel: "进入 Playground",
      actionKind: "open-playground",
      focus: "playground",
      title: "当前环境已就绪",
      detail: "可以直接做一次最小模型验证。"
    };
  }

  return {
    actionLabel: item.actionLabel,
    actionKind: item.actionKind,
    focus: item.focus,
    title: item.title,
    detail: item.detail
  };
}

export function formatDesktopHealthHeadline(summary) {
  const primary = getDesktopHealthPrimaryAction(summary);
  if (summary.items.length === 0) {
    return "环境已就绪，建议直接进入 Playground 做一次最小模型验证。";
  }
  return `${primary.title}，建议先${primary.actionLabel}。`;
}
