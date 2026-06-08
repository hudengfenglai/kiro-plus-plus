const REQUIRED_BRIDGE_METHODS = [
  "getState",
  "bootstrap",
  "launchKiroWithProxy",
  "openResource",
  "openPath",
  "copyText",
  "exportDiagnostics",
  "exportDiagnosticsToFile",
  "exportDiagnosticsZip",
  "clearDiagnosticsHistory",
  "selectDiagnosticsBundle",
  "deleteDiagnosticsBundle",
  "startProxy",
  "stopProxy",
  "restartProxy",
  "setByokEnabled",
  "setAutoApplyOnLaunch",
  "saveProvider",
  "testProvider",
  "fetchModels",
  "detectKiro",
  "applyRouting",
  "diagnoseKiro",
  "restoreKiro",
  "listLogs",
  "sendPlayground"
];

export function getRequiredBridgeMethods() {
  return [...REQUIRED_BRIDGE_METHODS];
}

export function inspectDesktopBridge(bridge) {
  if (!bridge || typeof bridge !== "object") {
    return {
      available: false,
      complete: false,
      missingMethods: getRequiredBridgeMethods(),
      presentMethodCount: 0,
      totalMethodCount: REQUIRED_BRIDGE_METHODS.length,
      summary: "桌面桥接不可用",
      detail: "当前窗口没有注入 Kiro++ 桌面桥接。请重新启动应用，或重新安装最新版 Kiro++ Console。",
      tone: "error"
    };
  }

  const missingMethods = REQUIRED_BRIDGE_METHODS.filter((method) => typeof bridge[method] !== "function");
  const presentMethodCount = REQUIRED_BRIDGE_METHODS.length - missingMethods.length;

  if (missingMethods.length === 0) {
    return {
      available: true,
      complete: true,
      missingMethods,
      presentMethodCount,
      totalMethodCount: REQUIRED_BRIDGE_METHODS.length,
      summary: "桌面桥接完整",
      detail: "当前安装包已提供工作台所需的全部桥接方法。",
      tone: "success"
    };
  }

  return {
    available: true,
    complete: false,
    missingMethods,
    presentMethodCount,
    totalMethodCount: REQUIRED_BRIDGE_METHODS.length,
    summary: "桌面桥接不完整",
    detail: `当前安装包缺少 ${missingMethods.length} 个桥接方法：${missingMethods.join(", ")}。请重新安装最新版 Kiro++ Console。`,
    tone: "warning"
  };
}
