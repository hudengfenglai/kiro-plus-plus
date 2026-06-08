import type { QuickstartItem, QuickstartSummary } from "../../shared/quickstart";
import type { AppState } from "../../shared/types";
import type { ConsoleFocus, RunAction } from "./app-types";

type CreateFlowActionsArgs = {
  runAction: RunAction;
  requireDesktopApi: () => Window["kiroPlusApp"];
  quickstartSummary: QuickstartSummary;
  quickstartChecklist: QuickstartItem[];
  readinessIssues: AppState["readinessIssues"];
  openConsole: (targetFocus: ConsoleFocus) => void;
  ensureLiveSupportBundleContext: (reason: string) => Promise<boolean>;
  handleReadinessAction: (issue: AppState["readinessIssues"][number]) => Promise<unknown>;
  handleFetchModels: () => Promise<void>;
  handleTestProvider: () => Promise<void>;
};

export function createFlowActions({
  runAction,
  requireDesktopApi,
  quickstartSummary,
  quickstartChecklist,
  readinessIssues,
  openConsole,
  ensureLiveSupportBundleContext,
  handleReadinessAction,
  handleFetchModels,
  handleTestProvider
}: CreateFlowActionsArgs) {
  async function performQuickstartAction(item: QuickstartItem) {
    switch (item.actionKind) {
      case "fetch-models":
        return handleFetchModels();
      case "test-provider":
        return handleTestProvider();
      case "start-proxy":
        return runAction(() => requireDesktopApi().startProxy(), {
          pending: "正在启动本地代理...",
          success: "代理已启动。",
          afterFocus: "kiro"
        });
      case "enable-byok":
        return runAction(() => requireDesktopApi().setByokEnabled(true), {
          pending: "正在启用 BYOK...",
          success: "BYOK 已启用。",
          afterFocus: "kiro"
        });
      case "apply-routing":
        return runAction(() => requireDesktopApi().applyRouting(), {
          pending: "正在应用 Kiro 配置...",
          success: "Kiro 路由已应用。",
          afterFocus: "kiro"
        });
      case "diagnose":
        return runAction(() => requireDesktopApi().diagnoseKiro(), {
          pending: "正在运行诊断...",
          success: "诊断已刷新。",
          afterFocus: "logs"
        });
      default:
        openConsole(item.focus);
        return Promise.resolve();
    }
  }

  async function handleQuickstartAction(item: QuickstartItem) {
    const ready = await ensureLiveSupportBundleContext(item.actionLabel);
    if (!ready) {
      return;
    }
    return performQuickstartAction(item);
  }

  async function handleSetupSummaryAction(item: {
    id: string;
    source: "readiness" | "quickstart";
    focus: ConsoleFocus;
  }) {
    const ready = await ensureLiveSupportBundleContext("继续设置");
    if (!ready) {
      return;
    }
    if (item.source === "readiness") {
      const issue = readinessIssues.find((entry) => entry.key === item.id);
      if (issue) {
        return handleReadinessAction(issue);
      }
      openConsole(item.focus);
      return Promise.resolve();
    }

    const quickstartItem = quickstartChecklist.find((entry) => entry.id === item.id);
    if (quickstartItem) {
      return handleQuickstartAction(quickstartItem);
    }

    openConsole(item.focus);
    return Promise.resolve();
  }

  async function handleLaunchEntry() {
    const ready = await ensureLiveSupportBundleContext("启动 Kiro");
    if (!ready) {
      return;
    }
    if (!quickstartSummary.isComplete && quickstartSummary.nextItem) {
      return performQuickstartAction(quickstartSummary.nextItem);
    }
    return runAction(() => requireDesktopApi().launchKiroWithProxy(), {
      pending: "正在启动 Kiro++ 入口...",
      success: "Kiro 启动指令已发出。",
      afterFocus: "kiro"
    });
  }

  async function handlePrimaryWorkbenchAction() {
    if (quickstartSummary.nextItem) {
      return handleQuickstartAction(quickstartSummary.nextItem);
    }
    const ready = await ensureLiveSupportBundleContext("打开实时验证面板");
    if (!ready) {
      return;
    }
    openConsole("playground");
  }

  async function handleSecondaryWorkbenchAction() {
    const ready = await ensureLiveSupportBundleContext("返回当前工作区");
    if (!ready) {
      return;
    }
    openConsole(quickstartSummary.nextItem?.focus ?? "status");
  }

  async function handleResumeLivePlayground() {
    const ready = await ensureLiveSupportBundleContext("返回实时验证区");
    if (!ready) {
      return;
    }
    openConsole("playground");
  }

  return {
    performQuickstartAction,
    handleQuickstartAction,
    handleSetupSummaryAction,
    handleLaunchEntry,
    handlePrimaryWorkbenchAction,
    handleSecondaryWorkbenchAction,
    handleResumeLivePlayground
  };
}
