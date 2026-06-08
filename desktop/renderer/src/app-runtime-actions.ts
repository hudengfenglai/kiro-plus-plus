import type { RunAction } from "./app-types";

type CreateRuntimeActionsArgs = {
  runAction: RunAction;
  requireDesktopApi: () => Window["kiroPlusApp"];
  isByokEnabled: boolean;
};

export function createRuntimeActions({
  runAction,
  requireDesktopApi,
  isByokEnabled
}: CreateRuntimeActionsArgs) {
  function startProxy() {
    return runAction(() => requireDesktopApi().startProxy(), {
      pending: "正在启动本地代理...",
      success: "代理已启动。",
      afterFocus: "kiro"
    });
  }

  function restartProxy() {
    return runAction(() => requireDesktopApi().restartProxy(), {
      pending: "正在重启代理...",
      success: "代理已重启。",
      afterFocus: "kiro"
    });
  }

  function applyRouting() {
    return runAction(() => requireDesktopApi().applyRouting(), {
      pending: "正在应用 Kiro 配置...",
      success: "Kiro 路由已应用。",
      afterFocus: "kiro"
    });
  }

  function toggleByok() {
    return runAction(() => requireDesktopApi().setByokEnabled(!isByokEnabled), {
      pending: isByokEnabled ? "正在关闭 BYOK..." : "正在启用 BYOK...",
      success: isByokEnabled ? "BYOK 已关闭。" : "BYOK 已启用。",
      afterFocus: "kiro"
    });
  }

  function diagnoseKiro() {
    return runAction(() => requireDesktopApi().diagnoseKiro(), {
      pending: "正在运行诊断...",
      success: "诊断已刷新。",
      afterFocus: "logs"
    });
  }

  function refreshDiagnose() {
    return runAction(() => requireDesktopApi().diagnoseKiro(), {
      pending: "正在刷新诊断...",
      success: "诊断已刷新。",
      afterFocus: "logs"
    });
  }

  function stopProxy() {
    return runAction(() => requireDesktopApi().stopProxy(), {
      pending: "正在停止代理...",
      success: "代理已停止。",
      afterFocus: "kiro"
    });
  }

  function restoreKiro() {
    return runAction(() => requireDesktopApi().restoreKiro(), {
      pending: "正在恢复最近备份...",
      success: "最近备份已恢复。",
      afterFocus: "kiro"
    });
  }

  return {
    startProxy,
    restartProxy,
    applyRouting,
    toggleByok,
    diagnoseKiro,
    refreshDiagnose,
    stopProxy,
    restoreKiro
  };
}
