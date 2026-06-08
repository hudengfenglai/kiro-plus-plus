import type { AppState } from "../../shared/types";
import type {
  ConsoleFocus,
  DesktopHealthAction,
  LogFilters,
  ResourceKey,
  RunAction,
  ViewKey,
  WorkbenchTab
} from "./app-types";
import { deriveFocusMeta, describeError } from "./app-utils";

type CreateWorkbenchActionsArgs = {
  runAction: RunAction;
  requireDesktopApi: () => Window["kiroPlusApp"];
  logFilters: LogFilters;
  isAutoApplyOnLaunch: boolean;
  setStatus: (value: string) => void;
  setStatusDetail: (value: string) => void;
  setState: (value: AppState) => void;
  setFocus: (value: ConsoleFocus) => void;
  setWorkbenchTab: (value: WorkbenchTab) => void;
  setView: (value: ViewKey) => void;
  setLogRows: (value: AppState["recentLogs"]) => void;
};

export function createWorkbenchActions({
  runAction,
  requireDesktopApi,
  logFilters,
  isAutoApplyOnLaunch,
  setStatus,
  setStatusDetail,
  setState,
  setFocus,
  setWorkbenchTab,
  setView,
  setLogRows
}: CreateWorkbenchActionsArgs) {
  function openConsole(targetFocus: ConsoleFocus) {
    const meta = deriveFocusMeta(targetFocus);
    setFocus(targetFocus);
    setWorkbenchTab(meta.workbench);
    setStatus(meta.status);
    setView("console");
  }

  async function handleReadinessAction(issue: AppState["readinessIssues"][number]) {
    switch (issue.key) {
      case "proxy-not-running":
        return runAction(() => requireDesktopApi().startProxy(), {
          pending: "正在启动本地代理...",
          success: "代理已启动。",
          afterFocus: "kiro"
        });
      case "kiro-byok-disabled":
        return runAction(() => requireDesktopApi().setByokEnabled(true), {
          pending: "正在启用 BYOK...",
          success: "BYOK 已启用。",
          afterFocus: "kiro"
        });
      case "kiro-no-local-region":
      case "unsupported-operations":
        return runAction(() => requireDesktopApi().diagnoseKiro(), {
          pending: "正在刷新诊断...",
          success: "诊断已刷新。",
          afterFocus: "logs"
        });
      default:
        openConsole(issue.focus);
        return Promise.resolve();
    }
  }

  async function handleDesktopHealthAction(item: DesktopHealthAction) {
    switch (item.actionKind) {
      case "open-quickstart":
        return runAction(
          () => requireDesktopApi().openResource("quickstart"),
          {
            pending: "正在打开快速开始文档...",
            success: "快速开始文档已打开。",
            afterFocus: "status"
          }
        );
      case "open-logs":
        openConsole("logs");
        return Promise.resolve();
      case "open-kiro":
        openConsole("kiro");
        return Promise.resolve();
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
      case "refresh-diagnose":
        return runAction(() => requireDesktopApi().diagnoseKiro(), {
          pending: "正在刷新诊断...",
          success: "诊断已刷新。",
          afterFocus: "logs"
        });
      default:
        openConsole(item.focus);
        return Promise.resolve();
    }
  }

  async function refreshLogs(nextFilters = logFilters) {
    try {
      const rows = await requireDesktopApi().listLogs({
        operation: nextFilters.operation || undefined,
        status: nextFilters.status ? Number(nextFilters.status) : undefined,
        errorOnly: nextFilters.errorOnly
      });
      setLogRows(rows as AppState["recentLogs"]);
    } catch (error) {
      const parsed = describeError(error);
      setStatus(parsed.summary);
      setStatusDetail(parsed.detail);
    }
  }

  async function openResource(resourceId: ResourceKey) {
    await runAction(
      () => requireDesktopApi().openResource(resourceId),
      {
        pending: "正在打开文档资源...",
        success: "文档已打开。"
      }
    );
  }

  async function handleToggleAutoApplyOnLaunch() {
    const nextEnabled = !isAutoApplyOnLaunch;
    const result = await runAction(
      () => requireDesktopApi().setAutoApplyOnLaunch(nextEnabled),
      {
        pending: nextEnabled ? "正在启用启动时自动应用..." : "正在关闭启动时自动应用...",
        success: nextEnabled ? "启动时自动应用已启用。" : "启动时自动应用已关闭。",
        afterFocus: "kiro"
      }
    );
    setState(result as AppState);
  }

  return {
    openConsole,
    handleReadinessAction,
    handleDesktopHealthAction,
    refreshLogs,
    openResource,
    handleToggleAutoApplyOnLaunch
  };
}
