import {
  buildLogShareText,
  buildOutputShareText,
  buildSupportSnapshotText,
  buildWorkbenchShareMarkdown,
  buildWorkbenchShareText
} from "../../shared/workbench-share";
import type {
  AppState,
  DiagnosticsExportBundle,
  DiagnosticsLogSnapshot,
  PlaygroundResult,
  RequestLogEntry,
  WorkbenchExportResult
} from "../../shared/types";
import type {
  ActionEntry,
  ConsoleFocus,
  DesktopHealthAction,
  ExportSummary,
  RunAction,
  ViewKey,
  WorkbenchTab
} from "./app-types";
import { describeError, nowIso } from "./app-utils";

type CreateDiagnosticsActionsArgs = {
  runAction: RunAction;
  requireDesktopApi: () => Window["kiroPlusApp"];
  writeClipboardText: (text: string) => Promise<void>;
  pushOutput: (title: string, detail: string, tone: ActionEntry["tone"]) => void;
  outputEntries: ActionEntry[];
  outputSessionStartedAt: string | null;
  viewingHistoricalBundle: boolean;
  lastExportBundle: DiagnosticsExportBundle | null;
  exportSummary: ExportSummary | null;
  exportHistory: DiagnosticsExportBundle[];
  latestFailure: DiagnosticsLogSnapshot | RequestLogEntry | null;
  latestSuccess: DiagnosticsLogSnapshot | RequestLogEntry | null;
  selectedProviderLabel: string;
  proxyEndpoint: string | null;
  proxyStateLabel: string;
  isByokEnabled: boolean;
  diagnosticsSummarySource: AppState["diagnosticsSummarySource"];
  diagnosticsSummary: string;
  recentLogsSource: AppState["recentLogsSource"];
  latestWorkbenchExport: AppState["lastWorkbenchExport"];
  workbenchExportHistory: AppState["workbenchExportHistory"];
  setStatus: (value: string) => void;
  setStatusDetail: (value: string) => void;
  setState: (value: AppState) => void;
  setLastExportBundle: (value: DiagnosticsExportBundle | null) => void;
  setLogRows: (value: AppState["recentLogs"]) => void;
  setLogFilters: (
    value:
      | {
          operation: string;
          status: string;
          errorOnly: boolean;
        }
      | ((
          previous: {
            operation: string;
            status: string;
            errorOnly: boolean;
          }
        ) => {
          operation: string;
          status: string;
          errorOnly: boolean;
        })
  ) => void;
  setFocus: (value: ConsoleFocus) => void;
  setWorkbenchTab: (value: WorkbenchTab) => void;
  setView: (value: ViewKey) => void;
  refreshLogs: (nextFilters?: {
    operation: string;
    status: string;
    errorOnly: boolean;
  }) => Promise<void>;
  handleDesktopHealthAction: (item: DesktopHealthAction) => Promise<unknown>;
};

export function createDiagnosticsActions({
  runAction,
  requireDesktopApi,
  writeClipboardText,
  pushOutput,
  outputEntries,
  outputSessionStartedAt,
  viewingHistoricalBundle,
  lastExportBundle,
  exportSummary,
  exportHistory,
  latestFailure,
  latestSuccess,
  selectedProviderLabel,
  proxyEndpoint,
  proxyStateLabel,
  isByokEnabled,
  diagnosticsSummarySource,
  diagnosticsSummary,
  recentLogsSource,
  latestWorkbenchExport,
  workbenchExportHistory,
  setStatus,
  setStatusDetail,
  setState,
  setLastExportBundle,
  setLogRows,
  setLogFilters,
  setFocus,
  setWorkbenchTab,
  setView,
  refreshLogs,
  handleDesktopHealthAction
}: CreateDiagnosticsActionsArgs) {
  async function copyOutputTimeline() {
    const text = buildOutputShareText({
      entries: outputEntries,
      viewingHistoricalBundle,
      currentBundleName: lastExportBundle?.bundleName ?? null,
      selectedProviderLabel,
      proxyEndpoint,
      proxyState: proxyStateLabel,
      isByokEnabled
    });
    await runAction(
      async () => {
        await writeClipboardText(text);
        return text;
      },
      {
        pending: "正在复制当前会话输出...",
        success: "当前会话输出已复制。",
        afterFocus: "status"
      }
    );
  }

  async function copyWorkbenchSnapshot() {
    const outputShareText = buildOutputShareText({
      entries: outputEntries,
      viewingHistoricalBundle,
      currentBundleName: lastExportBundle?.bundleName ?? null,
      selectedProviderLabel,
      proxyEndpoint,
      proxyState: proxyStateLabel,
      isByokEnabled
    });
    const text = buildWorkbenchShareText({
      bundleName: lastExportBundle?.bundleName ?? null,
      recentLogsSource,
      diagnosticsSummarySource,
      diagnosticsSummary,
      outputShareText,
      outputCount: outputEntries.length,
      outputSessionStartedAt,
      latestFailure,
      latestSuccess
    });
    await runAction(
      async () => {
        await writeClipboardText(text);
        return text;
      },
      {
        pending: "正在复制当前工作台状态...",
        success: "当前工作台状态已复制。",
        afterFocus: "logs"
      }
    );
  }

  async function exportWorkbenchSnapshot() {
    const outputShareText = buildOutputShareText({
      entries: outputEntries,
      viewingHistoricalBundle,
      currentBundleName: lastExportBundle?.bundleName ?? null,
      selectedProviderLabel,
      proxyEndpoint,
      proxyState: proxyStateLabel,
      isByokEnabled
    });
    const markdown = buildWorkbenchShareMarkdown({
      bundleName: lastExportBundle?.bundleName ?? null,
      recentLogsSource,
      diagnosticsSummarySource,
      diagnosticsSummary,
      outputShareText,
      outputCount: outputEntries.length,
      outputSessionStartedAt,
      latestFailure,
      latestSuccess,
      exportedAt: nowIso()
    });
    const result = await runAction(
      () => requireDesktopApi().exportWorkbenchSnapshot(markdown),
      {
        pending: "正在导出当前工作台状态...",
        success: "当前工作台状态已导出。",
        afterFocus: "logs"
      }
    );
    const typed = result as WorkbenchExportResult;
    setStatusDetail(`Markdown 文件：${typed.filePath}`);
  }

  async function openLatestWorkbenchSnapshot() {
    const filePath = latestWorkbenchExport?.filePath;
    if (!filePath) {
      setStatus("还没有可打开的工作台快照文件。");
      setStatusDetail("");
      return;
    }
    if (latestWorkbenchExport?.exists === false) {
      setStatus("最近工作台快照文件已不存在。");
      setStatusDetail(filePath);
      return;
    }
    await runAction(
      () => requireDesktopApi().openPath(filePath),
      {
        pending: "正在打开工作台快照文件...",
        success: "工作台快照文件已打开。",
        afterFocus: "logs"
      }
    );
  }

  async function openWorkbenchSnapshot(filePath: string) {
    const snapshot = workbenchExportHistory.find((item) => item.filePath === filePath) ?? null;
    if (snapshot?.exists === false) {
      setStatus("所选工作台快照文件已不存在。");
      setStatusDetail(filePath);
      return;
    }
    await runAction(
      () => requireDesktopApi().openPath(filePath),
      {
        pending: "正在打开工作台快照文件...",
        success: "工作台快照文件已打开。",
        afterFocus: "logs"
      }
    );
  }

  async function deleteWorkbenchExport(filePath: string) {
    const result = await runAction(
      () => requireDesktopApi().deleteWorkbenchExport(filePath),
      {
        pending: "正在移除工作台快照记录...",
        success: "工作台快照记录已移除。",
        afterFocus: "logs"
      }
    );
    setState(result as AppState);
  }

  async function clearWorkbenchExportHistory() {
    const result = await runAction(
      () => requireDesktopApi().clearWorkbenchExportHistory(),
      {
        pending: "正在清空工作台快照历史...",
        success: "工作台快照历史已清空。",
        afterFocus: "logs"
      }
    );
    setState(result as AppState);
  }

  async function clearMissingWorkbenchExportHistory() {
    const result = await runAction(
      () => requireDesktopApi().clearMissingWorkbenchExportHistory(),
      {
        pending: "正在清理失效工作台快照记录...",
        success: "失效工作台快照记录已清理。",
        afterFocus: "logs"
      }
    );
    setState(result as AppState);
  }

  function writeSnapshotPath(filePath: string) {
    writeClipboardText(filePath).then(() => {
      setStatus("工作台快照路径已复制。");
      setStatusDetail(filePath);
    }).catch((error) => {
      const parsed = describeError(error);
      setStatus(parsed.summary);
      setStatusDetail(parsed.detail);
    });
  }

  async function clearMissingDiagnosticsHistory() {
    const result = await runAction(
      () => requireDesktopApi().clearMissingDiagnosticsHistory(),
      {
        pending: "正在清理失效支持包记录...",
        success: "失效支持包记录已清理。",
        afterFocus: "logs"
      }
    );
    setState(result as AppState);
  }

  async function copyDiagnosticsSummary() {
    await runAction(
      async () => {
        const text = diagnosticsSummary || await requireDesktopApi().exportDiagnostics();
        await writeClipboardText(text);
        return text;
      },
      {
        pending: "正在复制脱敏诊断摘要...",
        success: "诊断摘要已复制。",
        afterFocus: "logs"
      }
    );
  }

  async function exportDiagnosticsToFile() {
    const result = await runAction(
      () => requireDesktopApi().exportDiagnosticsToFile(),
      {
        pending: "正在导出诊断文件...",
        success: "诊断文件已导出。",
        afterFocus: "logs"
      }
    );
    const typed = result as DiagnosticsExportBundle;
    setLastExportBundle(typed);
    if (typed.bundleDir) {
      setStatusDetail(
        [
          `导出目录：${typed.bundleDir}`,
          typed.readmePath ? `说明：${typed.readmePath}` : null,
          typed.summaryPath ? `摘要：${typed.summaryPath}` : null,
          typed.jsonPath ? `快照：${typed.jsonPath}` : null,
          typed.requestsPath ? `请求：${typed.requestsPath}` : null,
          typed.manifestPath ? `清单：${typed.manifestPath}` : null
        ].filter(Boolean).join("\n")
      );
    }
  }

  async function exportDiagnosticsZip() {
    const result = await runAction(
      () => requireDesktopApi().exportDiagnosticsZip(),
      {
        pending: "正在导出 zip 支持包...",
        success: "zip 支持包已导出。",
        afterFocus: "logs"
      }
    );
    const typed = result as DiagnosticsExportBundle;
    setLastExportBundle(typed);
    setStatusDetail(
      [
        `导出目录：${typed.bundleDir}`,
        typed.zipPath ? `压缩包：${typed.zipPath}` : null,
        `说明：${typed.readmePath}`,
        `摘要：${typed.summaryPath}`,
        `快照：${typed.jsonPath}`,
        `请求：${typed.requestsPath}`,
        `清单：${typed.manifestPath}`
      ].filter(Boolean).join("\n")
    );
  }

  async function openExportBundleDir() {
    const bundleDir = lastExportBundle?.bundleDir;
    if (!bundleDir) {
      setStatus("还没有可打开的导出目录。");
      return;
    }
    await runAction(
      () => requireDesktopApi().openPath(bundleDir),
      {
        pending: "正在打开导出目录...",
        success: "导出目录已打开。",
        afterFocus: "logs"
      }
    );
  }

  async function copyExportHeadline() {
    if (!exportSummary?.headline) {
      setStatus("当前支持包没有可复制的首屏摘要。");
      return;
    }
    await runAction(
      async () => {
        await writeClipboardText(exportSummary.headline);
        return exportSummary.headline;
      },
      {
        pending: "正在复制首屏摘要...",
        success: "首屏摘要已复制。",
        afterFocus: "logs"
      }
    );
  }

  async function copyRecommendedAction() {
    const action = exportSummary?.recommendedAction;
    if (!action?.title || !action?.actionLabel) {
      setStatus("当前支持包没有可复制的推荐下一步。");
      return;
    }
    const text = [`推荐下一步：${action.title} -> ${action.actionLabel}`, action.detail ? `说明：${action.detail}` : null]
      .filter(Boolean)
      .join("\n");
    await runAction(
      async () => {
        await writeClipboardText(text);
        return text;
      },
      {
        pending: "正在复制推荐下一步...",
        success: "推荐下一步已复制。",
        afterFocus: "logs"
      }
    );
  }

  async function copySupportSnapshot() {
    if (!exportSummary) {
      setStatus("当前没有可复制的支持快照。");
      return;
    }
    const text = buildSupportSnapshotText({
      bundleName: exportSummary.bundleName,
      headline: exportSummary.headline,
      recommendedAction: exportSummary.recommendedAction,
      latestFailure,
      latestSuccess,
      viewingHistoricalBundle
    });
    await runAction(
      async () => {
        await writeClipboardText(text);
        return text;
      },
      {
        pending: "正在复制支持快照...",
        success: "支持快照已复制。",
        afterFocus: "logs"
      }
    );
  }

  async function runRecommendedAction() {
    const action = exportSummary?.recommendedAction;
    if (!action?.actionKind) {
      setStatus("当前支持包没有可执行的推荐下一步。");
      return;
    }
    if (viewingHistoricalBundle) {
      const latestBundle = lastExportBundle ?? exportHistory[0] ?? null;
      if (!latestBundle) {
        setStatus("当前没有可切换的最新支持包。");
        return;
      }
      const nextState = await selectExportBundleState(latestBundle);
      const nextAction = nextState.lastExportBundle?.recommendedAction ?? null;
      if (!nextAction?.actionKind) {
        setStatus("已回到最新支持包，但当前没有可执行的推荐下一步。");
        return;
      }
      await handleDesktopHealthAction({
        actionKind: nextAction.actionKind as DesktopHealthAction["actionKind"],
        focus: (nextAction.focus as ConsoleFocus | undefined) ?? "status"
      });
      return;
    }
    await handleDesktopHealthAction({
      actionKind: action.actionKind as DesktopHealthAction["actionKind"],
      focus: (action.focus as ConsoleFocus | undefined) ?? "status"
    });
  }

  async function copyLogSummary(entry: DiagnosticsLogSnapshot | RequestLogEntry | null, kind: "failure" | "success") {
    const text = buildLogShareText(entry, kind);
    await runAction(
      async () => {
        await writeClipboardText(text);
        return text;
      },
      {
        pending: `正在复制最近${kind === "failure" ? "失败" : "成功"}摘要...`,
        success: `最近${kind === "failure" ? "失败" : "成功"}摘要已复制。`,
        afterFocus: "logs"
      }
    );
  }

  function focusLogEntry(entry: DiagnosticsLogSnapshot | RequestLogEntry | null) {
    if (!entry) {
      setStatus("当前没有可定位的请求记录。");
      return;
    }
    const nextFilters = {
      operation: entry.operation || "",
      status: String(entry.status ?? ""),
      errorOnly: entry.status >= 400
    };
    setLogFilters(nextFilters);
    setFocus("logs");
    setWorkbenchTab("logs");
    setView("console");
    setStatus(`已定位到 ${entry.operation || "未知操作"} / ${entry.status}`);
    void refreshLogs(nextFilters);
  }

  async function handleDiagnosticLogAction(entry: DiagnosticsLogSnapshot | RequestLogEntry | null) {
    if (!entry) {
      setStatus("当前没有可定位的请求记录。");
      return;
    }
    if (viewingHistoricalBundle) {
      await openExportArtifact(lastExportBundle?.requestsPath ?? null, "请求文件");
      return;
    }
    focusLogEntry(entry);
  }

  async function openExportZip() {
    const zipPath = lastExportBundle?.zipPath;
    if (!zipPath) {
      setStatus("还没有可打开的 zip 支持包。");
      return;
    }
    if (lastExportBundle?.zipExists === false) {
      setStatus("当前 zip 支持包文件已不存在。");
      setStatusDetail(zipPath);
      return;
    }
    await runAction(
      () => requireDesktopApi().openPath(zipPath),
      {
        pending: "正在打开 zip 支持包...",
        success: "zip 支持包已打开。",
        afterFocus: "logs"
      }
    );
  }

  async function openExportArtifact(target: null | string, label: string) {
    if (!target) {
      setStatus(`还没有可打开的${label}。`);
      return;
    }
    if (lastExportBundle?.exists === false) {
      setStatus(`当前支持包文件不完整，无法打开${label}。`);
      setStatusDetail(target);
      return;
    }
    await runAction(
      () => requireDesktopApi().openPath(target),
      {
        pending: `正在打开${label}...`,
        success: `${label}已打开。`,
        afterFocus: "logs"
      }
    );
  }

  function selectExportBundle(bundle: DiagnosticsExportBundle) {
    selectExportBundleState(bundle).catch(() => {
      // runAction already updates status/output
    });
  }

  function selectLatestExportBundle() {
    const latestBundle = lastExportBundle ?? exportHistory[0] ?? null;
    if (!latestBundle) {
      setStatus("当前没有可切换的最新支持包。");
      return;
    }
    selectExportBundle(latestBundle);
  }

  function selectExportBundleState(bundle: DiagnosticsExportBundle) {
    return runAction(
      () => requireDesktopApi().selectDiagnosticsBundle(bundle.bundleName),
      {
        pending: `正在切换支持包：${bundle.bundleName}...`,
        success: `已切换到支持包：${bundle.bundleName}`,
        afterFocus: "logs"
      }
    ).then((result) => {
      const typed = result as AppState;
      setState(typed);
      setLastExportBundle(typed.lastExportBundle ?? null);
      setLogRows(typed.recentLogs);
      return typed;
    });
  }

  async function clearExportHistory() {
    const result = await runAction(
      () => requireDesktopApi().clearDiagnosticsHistory(),
      {
        pending: "正在清空支持包历史...",
        success: "支持包历史已清空。",
        afterFocus: "logs"
      }
    );
    const typed = result as AppState;
    setLastExportBundle(typed.lastExportBundle ?? null);
    setState(typed);
    setLogRows(typed.recentLogs);
  }

  async function deleteExportBundle(bundle: DiagnosticsExportBundle) {
    const result = await runAction(
      () => requireDesktopApi().deleteDiagnosticsBundle(bundle.bundleName),
      {
        pending: `正在移除支持包记录：${bundle.bundleName}...`,
        success: `已移除支持包记录：${bundle.bundleName}`,
        afterFocus: "logs"
      }
    );
    const typed = result as AppState;
    setState(typed);
    setLastExportBundle(typed.lastExportBundle ?? null);
    setLogRows(typed.recentLogs);
  }

  async function ensureLiveSupportBundleContext(reason: string) {
    if (!viewingHistoricalBundle) {
      return true;
    }
    const latestBundle = lastExportBundle ?? exportHistory[0] ?? null;
    if (!latestBundle) {
      setStatus("当前正在查看历史支持包，但没有可切换的最新支持包。");
      return false;
    }
    const nextState = await selectExportBundleState(latestBundle);
    const liveBundleName = nextState.lastExportBundle?.bundleName ?? latestBundle.bundleName;
    setStatus(`已回到最新支持包：${liveBundleName}，继续${reason}。`);
    setStatusDetail("");
    return true;
  }

  return {
    copyOutputTimeline,
    copyWorkbenchSnapshot,
    exportWorkbenchSnapshot,
    openLatestWorkbenchSnapshot,
    openWorkbenchSnapshot,
    deleteWorkbenchExport,
    clearWorkbenchExportHistory,
    clearMissingWorkbenchExportHistory,
    writeSnapshotPath,
    clearMissingDiagnosticsHistory,
    copyDiagnosticsSummary,
    exportDiagnosticsToFile,
    exportDiagnosticsZip,
    openExportBundleDir,
    copyExportHeadline,
    copyRecommendedAction,
    copySupportSnapshot,
    runRecommendedAction,
    copyLogSummary,
    handleDiagnosticLogAction,
    openExportZip,
    openExportArtifact,
    selectExportBundle,
    selectLatestExportBundle,
    ensureLiveSupportBundleContext,
    clearExportHistory,
    deleteExportBundle
  };
}
