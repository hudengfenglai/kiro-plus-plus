import { useEffect, useMemo, useState } from "react";

import {
  PROVIDER_PRESETS,
  buildProviderProfileFromPreset
} from "../../shared/provider-presets";
import {
  buildKiroActionAvailability,
  buildProviderActionAvailability,
  buildProviderDraftStatus,
  buildQuickstartChecklist,
  buildSetupWorkspaceSummary,
  shouldPromptBeforeReplacingProviderDraft,
  summarizeQuickstartChecklist,
  type QuickstartItem
} from "../../shared/quickstart";
import { inspectDesktopBridge } from "../../shared/bridge-status";
import { buildDesktopHealthSummary } from "../../shared/desktop-health";
import {
  describeSupportBundleAvailability
} from "../../shared/support-bundle-status";
import {
  buildLogShareText,
  buildOutputShareText,
  buildOutputTimelineText,
  buildSupportSnapshotText,
  buildWorkbenchShareMarkdown,
  buildWorkbenchShareText
} from "../../shared/workbench-share";
import { describeWorkbenchSnapshotAvailability } from "../../shared/workbench-snapshot-status";
import {
  basename,
  buildModelsText,
  collectUnavailableReasons,
  deriveFocusMeta,
  describeBootstrapStatus,
  describeBootstrapStep,
  describeError,
  describeLaunchStatus,
  describeLaunchStep,
  formatTime,
  nowIso,
  parseModelsText,
  pickRecommendedFocus,
  summarizeLog
} from "./app-utils";
import { ControlRail } from "./components/ControlRail";
import { ConsoleHeader } from "./components/ConsoleHeader";
import { DiagnosticsArtifactsPanel } from "./components/DiagnosticsArtifactsPanel";
import { HomeView } from "./components/HomeView";
import { SetupWorkspace } from "./components/SetupWorkspace";
import { StatusOverviewPanel } from "./components/StatusOverviewPanel";
import { ValidationRail } from "./components/ValidationRail";
import { WorkbenchPanel } from "./components/WorkbenchPanel";
import { WorkspaceHero } from "./components/WorkspaceHero";
import type {
  AppMeta,
  AppState,
  DiagnosticsExportBundle,
  DiagnosticsLogSnapshot,
  LaunchAttempt,
  PlaygroundResult,
  ProviderModel,
  ProviderProfile,
  RequestLogEntry,
  WorkbenchExportResult
} from "../../shared/types";

type ViewKey = "home" | "console";
type ResourceKey = "quickstart" | "readme" | "providers" | "streaming" | "plan";
type ConsoleFocus = "status" | "providers" | "kiro" | "logs" | "playground";
type WorkbenchTab = "logs" | "output" | "diagnostics";
type ThemeKey = "dark" | "light";

type ActionEntry = {
  id: string;
  title: string;
  detail: string;
  tone: "info" | "success" | "error";
  at: string;
};

type PlaygroundState = PlaygroundResult & { requestedAt: string };
type PendingProviderReplaceAction =
  | null
  | { kind: "apply-preset" }
  | { kind: "switch-provider"; providerId: string };

const emptyState: AppState = {
  settings: {
    selectedProviderId: "deepseek",
    isByokEnabled: false,
    lastSuccessfulProviderTest: null,
    lastAppliedKiroBackup: null,
    providers: [buildProviderProfileFromPreset("deepseek")],
    kiro: {
      autoApplyOnLaunch: false,
      defaultEndpointPort: 43119
    },
    logging: {
      captureHeaders: true,
      captureBodies: false
    },
    runtime: {
      exportHistory: [],
      lastExportBundle: null,
      lastWorkbenchExport: null,
      workbenchExportHistory: [],
      lastLaunchAttempt: null,
      lastBootstrapAttempt: null,
      selectedExportBundleName: null
    }
  },
  proxyStatus: {
    state: "stopped",
    endpoint: null,
    error: null
  },
  kiroDetection: {
    installed: false,
    installPath: null,
    searchedInstallPaths: [],
    detectionHint: "尚未检测 Kiro 安装。",
    settingsPath: "",
    profilesDir: "",
    backupDir: "",
    lastBackup: null
  },
  diagnose: null,
  recentLogs: [],
  recentLogsSource: {
    kind: "live"
  },
  diagnosticsSummarySource: {
    kind: "live"
  },
  diagnosticsSummary: "",
  bootstrap: {
    recommendedTab: "providers",
    steps: []
  },
  readinessIssues: [],
  lastSuccessfulProviderTest: null,
  lastAppliedKiroBackup: null,
  exportHistory: [],
  lastExportBundle: null,
  lastWorkbenchExport: null,
  workbenchExportHistory: [],
  lastLaunchAttempt: null,
  lastBootstrapAttempt: null
};

const proxyStateLabels: Record<AppState["proxyStatus"]["state"], string> = {
  stopped: "未启动",
  starting: "启动中",
  running: "运行中",
  error: "异常"
};

const resourceLinks: Array<{ key: ResourceKey; title: string; body: string }> = [
  {
    key: "quickstart",
    title: "快速开始",
    body: "安装版的最短上手路径、启动预热和支持包说明。"
  },
  {
    key: "readme",
    title: "README",
    body: "安装、运行方式、支持边界和最短接入路径。"
  },
  {
    key: "providers",
    title: "Provider 文档",
    body: "国内 Provider 的 Base URL、模型名和示例。"
  },
  {
    key: "streaming",
    title: "Streaming / Kiro 说明",
    body: "Kiro 兼容 event-stream 与协议映射记录。"
  },
  {
    key: "plan",
    title: "项目计划",
    body: "当前 backlog、阶段目标和公开发布准备记录。"
  }
];

function requireDesktopApi() {
  if (window.kiroPlusApp) {
    return new Proxy(window.kiroPlusApp, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === "function") {
          return value.bind(target);
        }
        if (value !== undefined) {
          return value;
        }
        throw new Error(`当前安装包缺少桌面桥接方法：${String(prop)}。请重新安装最新版 Kiro++ Console。`);
      }
    });
  }
  throw new Error("桌面桥接不可用。请安装最新版 Kiro++ 后重新启动应用。");
}

async function writeClipboardText(text: string) {
  const api = window.kiroPlusApp;
  if (api?.copyText) {
    await api.copyText(text);
    return;
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  throw new Error("当前环境不支持复制到剪贴板。请升级最新版 Kiro++ Console。");
}

function makeActionEntry(title: string, detail: string, tone: ActionEntry["tone"]): ActionEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    title,
    detail,
    tone,
    at: nowIso()
  };
}

export function App() {
  const [theme, setTheme] = useState<ThemeKey>("dark");
  const [view, setView] = useState<ViewKey>("home");
  const [state, setState] = useState<AppState>(emptyState);
  const [status, setStatus] = useState("正在读取应用状态...");
  const [statusDetail, setStatusDetail] = useState("");
  const [providerDraft, setProviderDraft] = useState<ProviderProfile | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [presetId, setPresetId] = useState("deepseek");
  const [modelsText, setModelsText] = useState(buildModelsText(emptyState.settings.providers[0].models));
  const [focus, setFocus] = useState<ConsoleFocus>("status");
  const [workbenchTab, setWorkbenchTab] = useState<WorkbenchTab>("output");
  const [logFilters, setLogFilters] = useState({
    operation: "",
    status: "",
    errorOnly: false
  });
  const [logRows, setLogRows] = useState<AppState["recentLogs"]>([]);
  const [actionEntries, setActionEntries] = useState<ActionEntry[]>([]);
  const [playgroundPrompt, setPlaygroundPrompt] = useState("请简要说明当前模型是否可用，并返回一句中文结论。");
  const [playgroundProviderId, setPlaygroundProviderId] = useState("");
  const [playgroundModelId, setPlaygroundModelId] = useState("");
  const [playgroundResult, setPlaygroundResult] = useState<null | PlaygroundState>(null);
  const [lastExportBundle, setLastExportBundle] = useState<DiagnosticsExportBundle | null>(null);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const [pendingProviderReplaceAction, setPendingProviderReplaceAction] = useState<PendingProviderReplaceAction>(null);
  const [appMeta, setAppMeta] = useState<AppMeta | null>(null);

  const providerOptions = useMemo(() => Object.values(PROVIDER_PRESETS), []);
  const bridgeStatus = useMemo(() => inspectDesktopBridge(window.kiroPlusApp), []);
  const desktopHealth = useMemo(
    () => buildDesktopHealthSummary({
      bridgeStatus,
      appMeta,
      proxyStatus: state.proxyStatus,
      isByokEnabled: state.settings.isByokEnabled,
      kiroDetection: {
        installed: state.kiroDetection.installed,
        detectionHint: state.kiroDetection.detectionHint
      },
      diagnose: state.diagnose
    }),
    [appMeta, bridgeStatus, state.diagnose, state.kiroDetection.detectionHint, state.kiroDetection.installed, state.proxyStatus, state.settings.isByokEnabled]
  );

  const selectedProvider = useMemo(
    () =>
      providerDraft
      ?? state.settings.providers.find((provider) => provider.id === state.settings.selectedProviderId)
      ?? state.settings.providers[0]
      ?? null,
    [providerDraft, state.settings.providers, state.settings.selectedProviderId]
  );

  const selectedProviderLabel = selectedProvider?.label ?? "未配置";
  const primaryIssue = state.readinessIssues[0] ?? null;
  const latestLiveExportBundle = state.settings.runtime.lastExportBundle ?? null;
  const latestWorkbenchExport = state.settings.runtime.lastWorkbenchExport ?? null;
  const workbenchExportHistory = state.settings.runtime.workbenchExportHistory ?? [];

  const viewingHistoricalBundle = Boolean(
    lastExportBundle
    && latestLiveExportBundle
    && lastExportBundle.bundleName !== latestLiveExportBundle.bundleName
  );
  const recentLogsFromHistoricalBundle = state.recentLogsSource.kind === "bundle";

  const latestFailure = useMemo(
    () => {
      if (viewingHistoricalBundle && lastExportBundle?.latestFailure) {
        return lastExportBundle.latestFailure;
      }
      return [...logRows].find((entry) => entry.status >= 400) ?? null;
    },
    [lastExportBundle, logRows, viewingHistoricalBundle]
  );

  const latestSuccess = useMemo(
    () => {
      if (viewingHistoricalBundle && lastExportBundle?.latestSuccess) {
        return lastExportBundle.latestSuccess;
      }
      return [...logRows].find((entry) => entry.status >= 200 && entry.status < 400) ?? null;
    },
    [lastExportBundle, logRows, viewingHistoricalBundle]
  );
  const launchStatus = useMemo(
    () => describeLaunchStatus(state.lastLaunchAttempt),
    [state.lastLaunchAttempt]
  );
  const bootstrapStatus = useMemo(
    () => describeBootstrapStatus(state.lastBootstrapAttempt),
    [state.lastBootstrapAttempt]
  );
  const quickstartChecklist = useMemo(
    () => buildQuickstartChecklist(state),
    [state]
  );
  const quickstartSummary = useMemo(
    () => summarizeQuickstartChecklist(quickstartChecklist),
    [quickstartChecklist]
  );
  const kiroActionAvailability = useMemo(
    () => buildKiroActionAvailability(state),
    [state]
  );
  const providerActionAvailability = useMemo(
    () => buildProviderActionAvailability(state, { hasDraftApiKey: Boolean(apiKey.trim()) }),
    [apiKey, state]
  );
  const providerActionHints = useMemo(
    () => collectUnavailableReasons(providerActionAvailability),
    [providerActionAvailability]
  );
  const kiroActionHints = useMemo(
    () => collectUnavailableReasons(kiroActionAvailability),
    [kiroActionAvailability]
  );
  const setupWorkspaceSummary = useMemo(
    () => buildSetupWorkspaceSummary(state),
    [state]
  );

  const outputEntries = useMemo(
    () => [...actionEntries].sort((a, b) => (a.at < b.at ? 1 : -1)),
    [actionEntries]
  );
  const outputSessionStartedAt = outputEntries.at(-1)?.at ?? null;

  const exportSummary = useMemo(() => {
    if (!lastExportBundle) return null;
    return {
      bundleName: lastExportBundle.bundleName || basename(lastExportBundle.bundleDir),
      headline: lastExportBundle.headline ?? "",
      recommendedAction: lastExportBundle.recommendedAction ?? null,
      zipName: basename(lastExportBundle.zipPath ?? null),
      readmeName: basename(lastExportBundle.readmePath),
      summaryName: basename(lastExportBundle.summaryPath),
      snapshotName: basename(lastExportBundle.jsonPath),
      manifestName: basename(lastExportBundle.manifestPath),
      requestsName: basename(lastExportBundle.requestsPath),
      exportedAt: lastExportBundle.exportedAt ?? null
    };
  }, [lastExportBundle]);
  const exportAvailability = useMemo(
    () => describeSupportBundleAvailability(lastExportBundle),
    [lastExportBundle]
  );

  const exportHistory = useMemo(
    () => state.exportHistory ?? [],
    [state.exportHistory]
  );
  const latestWorkbenchExportAvailability = useMemo(
    () => describeWorkbenchSnapshotAvailability(latestWorkbenchExport),
    [latestWorkbenchExport]
  );
  const playgroundLockedByHistory = viewingHistoricalBundle;

  const primaryWorkbenchActionLabel = viewingHistoricalBundle
    ? "回到实时后继续"
    : (quickstartSummary.nextItem?.actionLabel ?? "去做验证");
  const secondaryWorkbenchActionLabel = viewingHistoricalBundle
    ? "回到实时工作区"
    : (quickstartSummary.isComplete ? "打开工作区" : "继续设置");
  const launchWorkbenchActionLabel = viewingHistoricalBundle
    ? "回到实时后启动 Kiro"
    : quickstartSummary.launchActionLabel;

  const selectedProviderModels = useMemo(
    () => parseModelsText(modelsText, selectedProvider?.models ?? []),
    [modelsText, selectedProvider]
  );
  const providerDraftStatus = useMemo(() => {
    const savedProfile = state.settings.providers.find((provider) => provider.id === selectedProvider?.id)
      ?? state.settings.providers[0]
      ?? null;
    return buildProviderDraftStatus({
      savedProfile,
      draftProfile: selectedProvider,
      draftModels: selectedProviderModels,
      hasDraftApiKey: Boolean(apiKey.trim())
    });
  }, [apiKey, selectedProvider, selectedProviderModels, state.settings.providers]);

  const providerForPlayground = useMemo(
    () => state.settings.providers.find((provider) => provider.id === playgroundProviderId)
      ?? state.settings.providers[0]
      ?? null,
    [playgroundProviderId, state.settings.providers]
  );

  async function refresh(nextFocus?: ConsoleFocus) {
    const api = requireDesktopApi();
    const [nextState, summary] = await Promise.all([
      hasBootstrapped ? api.getState() : api.bootstrap(),
      api.exportDiagnostics()
    ]);

    const preservedBundle = lastExportBundle
      ? nextState.exportHistory.find((bundle) => bundle.bundleName === lastExportBundle.bundleName)
      : null;
    const nextSelectedBundle = preservedBundle ?? nextState.lastExportBundle ?? null;

    setState(nextState);
    setLogRows(nextState.recentLogs);
    setLastExportBundle(nextSelectedBundle);

    const current = nextState.settings.providers.find((provider) => provider.id === nextState.settings.selectedProviderId)
      ?? nextState.settings.providers[0]
      ?? null;

    setProviderDraft(current);
    setPresetId(current?.providerPresetId ?? "deepseek");
    setModelsText(buildModelsText(current?.models ?? []));

    const providerId = current?.id ?? "";
    setPlaygroundProviderId((previous) => previous || providerId);
    setPlaygroundModelId((previous) => previous || current?.defaultModel || "");

    if (nextFocus) {
      const meta = deriveFocusMeta(nextFocus);
      setFocus(nextFocus);
      setWorkbenchTab(meta.workbench);
    }
    if (!hasBootstrapped) {
      setHasBootstrapped(true);
    }
  }

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("kiro-plus-plus-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
      document.documentElement.dataset.theme = savedTheme;
    } else {
      document.documentElement.dataset.theme = "dark";
    }
  }, []);

  useEffect(() => {
    if (typeof window.kiroPlusApp?.getAppMeta !== "function") {
      return;
    }
    window.kiroPlusApp.getAppMeta()
      .then((meta) => setAppMeta(meta))
      .catch(() => {
        // Older packaged builds may not expose app metadata yet.
      });
  }, []);

  useEffect(() => {
    refresh()
      .then(() => setStatus("桌面控制台已就绪。"))
      .catch((error) => {
        const parsed = describeError(error);
        setStatus(parsed.summary);
        setStatusDetail(parsed.detail);
      });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("kiro-plus-plus-theme", theme);
  }, [theme]);

  function pushOutput(title: string, detail: string, tone: ActionEntry["tone"]) {
    setActionEntries((previous) => [makeActionEntry(title, detail, tone), ...previous].slice(0, 12));
  }

  function clearOutputEntries() {
    setActionEntries([]);
    setStatus("当前会话输出已清空。");
    setStatusDetail("");
  }

  async function copyOutputTimeline() {
    const text = buildOutputShareText({
      entries: outputEntries,
      viewingHistoricalBundle,
      currentBundleName: lastExportBundle?.bundleName ?? null,
      selectedProviderLabel,
      proxyEndpoint: state.proxyStatus.endpoint,
      proxyState: proxyStateLabels[state.proxyStatus.state],
      isByokEnabled: state.settings.isByokEnabled
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
      proxyEndpoint: state.proxyStatus.endpoint,
      proxyState: proxyStateLabels[state.proxyStatus.state],
      isByokEnabled: state.settings.isByokEnabled
    });
    const text = buildWorkbenchShareText({
      bundleName: lastExportBundle?.bundleName ?? null,
      recentLogsSource: state.recentLogsSource,
      diagnosticsSummarySource: state.diagnosticsSummarySource,
      diagnosticsSummary: state.diagnosticsSummary,
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
      proxyEndpoint: state.proxyStatus.endpoint,
      proxyState: proxyStateLabels[state.proxyStatus.state],
      isByokEnabled: state.settings.isByokEnabled
    });
    const markdown = buildWorkbenchShareMarkdown({
      bundleName: lastExportBundle?.bundleName ?? null,
      recentLogsSource: state.recentLogsSource,
      diagnosticsSummarySource: state.diagnosticsSummarySource,
      diagnosticsSummary: state.diagnosticsSummary,
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
    const typed = result as AppState;
    setState(typed);
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
    const typed = result as AppState;
    setState(typed);
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
    const typed = result as AppState;
    setState(typed);
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
    const typed = result as AppState;
    setState(typed);
  }

  async function runAction(
    action: () => Promise<unknown>,
    {
      pending,
      success,
      failure,
      afterFocus
    }: {
      pending: string;
      success: string;
      failure?: string;
      afterFocus?: ConsoleFocus;
    }
  ) {
    try {
      setStatus(pending);
      setStatusDetail("");
      const result = await action();
      await refresh(afterFocus);
      setStatus(success);
      pushOutput(success, typeof result === "string" ? result : JSON.stringify(result, null, 2), "success");
      return result;
    } catch (error) {
      const parsed = describeError(error);
      const summary = failure ?? parsed.summary;
      setStatus(summary);
      setStatusDetail(parsed.detail);
      pushOutput(summary, parsed.detail, "error");
      throw error;
    }
  }

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

  async function handleDesktopHealthAction(item: {
    actionKind: "open-quickstart" | "open-logs" | "open-kiro" | "start-proxy" | "enable-byok" | "refresh-diagnose";
    focus: ConsoleFocus;
  }) {
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

  function updateProviderDraft(next: ProviderProfile) {
    setProviderDraft(next);
    setModelsText(buildModelsText(next.models));
  }

  function replaceProviderDraft(next: ProviderProfile | null) {
    setProviderDraft(next);
    setPresetId(next?.providerPresetId ?? "deepseek");
    setModelsText(buildModelsText(next?.models ?? []));
    setApiKey("");
    setPlaygroundProviderId(next?.id ?? "");
    setPlaygroundModelId(next?.defaultModel ?? "");
    setFocus("providers");
  }

  function executePendingProviderReplaceAction(action: Exclude<PendingProviderReplaceAction, null>) {
    if (action.kind === "apply-preset") {
      const next = buildProviderProfileFromPreset(presetId);
      replaceProviderDraft(next);
      return;
    }

    const next = state.settings.providers.find((provider) => provider.id === action.providerId) ?? null;
    replaceProviderDraft(next);
  }

  function requestReplaceProviderDraft(action: Exclude<PendingProviderReplaceAction, null>) {
    if (!shouldPromptBeforeReplacingProviderDraft(providerDraftStatus)) {
      executePendingProviderReplaceAction(action);
      return;
    }
    setPendingProviderReplaceAction(action);
  }

  function applyPresetToDraft() {
    requestReplaceProviderDraft({ kind: "apply-preset" });
  }

  function confirmPendingProviderReplaceAction() {
    if (!pendingProviderReplaceAction) {
      return;
    }
    executePendingProviderReplaceAction(pendingProviderReplaceAction);
    setPendingProviderReplaceAction(null);
  }

  function cancelPendingProviderReplaceAction() {
    setPendingProviderReplaceAction(null);
  }

  async function handleSaveProvider() {
    if (!selectedProvider) return;
    const normalizedModels = selectedProviderModels;
    const normalizedDefaultModel = normalizedModels.find((model) => model.id === selectedProvider.defaultModel)?.id
      ?? normalizedModels[0]?.id
      ?? selectedProvider.defaultModel;

    await runAction(
      () =>
        requireDesktopApi().saveProvider({
          profile: {
            ...selectedProvider,
            models: normalizedModels,
            defaultModel: normalizedDefaultModel
          },
          apiKey: apiKey.trim() || undefined
        }),
      {
        pending: "正在保存 Provider 配置...",
        success: "Provider 配置已保存。",
        afterFocus: "providers"
      }
    );
    setApiKey("");
  }

  async function handleFetchModels() {
    if (!selectedProvider) return;
    const result = await runAction(
      () => requireDesktopApi().fetchModels({ profile: selectedProvider, apiKey: apiKey.trim() || undefined }),
      {
        pending: "正在拉取远程模型列表...",
        success: "模型列表已刷新。",
        afterFocus: "providers"
      }
    );

    const items = (result as Array<{ id: string; name?: string }>)
      .filter((item) => item?.id)
      .map((item) => ({
        id: item.id,
        name: item.name ?? item.id,
        description: "BYOK routed model",
        note: ""
      }));

    if (items.length > 0 && selectedProvider) {
      const nextProvider = {
        ...selectedProvider,
        models: items,
        defaultModel: items.find((item) => item.id === selectedProvider.defaultModel)?.id ?? items[0].id
      };
      updateProviderDraft(nextProvider);
      pushOutput("已同步模型草稿", `当前草稿包含 ${items.length} 个模型。`, "info");
    }
  }

  async function handleTestProvider() {
    if (!selectedProvider) return;
    const result = await runAction(
      () =>
        requireDesktopApi().testProvider({
          profile: selectedProvider,
          apiKey: apiKey.trim() || undefined,
          modelId: selectedProvider.defaultModel,
          prompt: playgroundPrompt
        }),
      {
        pending: "正在测试 Provider 连通性...",
        success: "Provider 测试成功。",
        afterFocus: "playground"
      }
    );
    const typed = result as PlaygroundResult;
    setPlaygroundResult({
      ...typed,
      requestedAt: nowIso()
    });
  }

  async function handlePlaygroundSend() {
    if (playgroundLockedByHistory) {
      await handleResumeLivePlayground();
      return;
    }
    if (!providerForPlayground || !playgroundModelId.trim()) return;
    const result = await runAction(
      () =>
        requireDesktopApi().sendPlayground({
          providerId: providerForPlayground.id,
          modelId: playgroundModelId.trim(),
          prompt: playgroundPrompt
        }),
      {
        pending: "正在发送模型验证请求...",
        success: "模型验证完成。",
        afterFocus: "playground"
      }
    );
    setPlaygroundResult({
      ...(result as PlaygroundResult),
      requestedAt: nowIso()
    });
  }

  async function copyDiagnosticsSummary() {
    await runAction(
      async () => {
        const text = state.diagnosticsSummary || await requireDesktopApi().exportDiagnostics();
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
      const latestBundle = state.lastExportBundle ?? exportHistory[0] ?? null;
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
        actionKind: nextAction.actionKind as "open-quickstart" | "open-logs" | "open-kiro" | "start-proxy" | "enable-byok" | "refresh-diagnose",
        focus: (nextAction.focus as ConsoleFocus | undefined) ?? "status"
      });
      return;
    }
    await handleDesktopHealthAction({
      actionKind: action.actionKind as "open-quickstart" | "open-logs" | "open-kiro" | "start-proxy" | "enable-byok" | "refresh-diagnose",
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
    const latestBundle = state.lastExportBundle ?? exportHistory[0] ?? null;
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
      return typed;
    });
  }

  async function ensureLiveSupportBundleContext(reason: string) {
    if (!viewingHistoricalBundle) {
      return true;
    }
    const latestBundle = state.lastExportBundle ?? exportHistory[0] ?? null;
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
      const issue = state.readinessIssues.find((entry) => entry.key === item.id);
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

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  async function handleToggleAutoApplyOnLaunch() {
    const nextEnabled = !state.settings.kiro.autoApplyOnLaunch;
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

  const home = (
    <HomeView
      appMeta={appMeta}
      theme={theme}
      toggleTheme={toggleTheme}
      openConsole={openConsole}
      recommendedFocus={pickRecommendedFocus(state)}
      openResource={openResource}
      quickstartSummary={quickstartSummary}
      handleQuickstartAction={handleQuickstartAction}
      proxyStateLabel={proxyStateLabels[state.proxyStatus.state]}
      proxyStateClass={state.proxyStatus.state}
      isByokEnabled={state.settings.isByokEnabled}
      selectedProviderLabel={selectedProviderLabel}
      selectedDefaultModel={selectedProvider?.defaultModel ?? "未配置"}
      proxyEndpoint={state.proxyStatus.endpoint ?? `http://127.0.0.1:${state.settings.kiro.defaultEndpointPort}`}
      bridgeStatus={bridgeStatus}
      desktopHealth={desktopHealth}
      handleDesktopHealthAction={handleDesktopHealthAction}
      quickstartChecklist={quickstartChecklist}
      providerOptions={providerOptions}
      resourceLinks={resourceLinks}
    />
  );

  const consoleView = (
    <div className="workbench-shell">
      <ConsoleHeader
        status={status}
        appMeta={appMeta}
        quickstartSummary={quickstartSummary}
        bridgeStatus={bridgeStatus}
        primaryWorkbenchActionLabel={primaryWorkbenchActionLabel}
        launchWorkbenchActionLabel={launchWorkbenchActionLabel}
        handlePrimaryWorkbenchAction={handlePrimaryWorkbenchAction}
        toggleTheme={toggleTheme}
        theme={theme}
        setView={setView}
        handleLaunchEntry={handleLaunchEntry}
        viewingHistoricalBundle={viewingHistoricalBundle}
        lastExportBundle={lastExportBundle}
        exportSummary={exportSummary ? { bundleName: exportSummary.bundleName } : null}
        basename={basename}
        formatTime={formatTime}
        selectLatestExportBundle={selectLatestExportBundle}
        openExportArtifact={openExportArtifact}
        copySupportSnapshot={copySupportSnapshot}
      />

      <main className="workbench-grid">
        <ControlRail
          focus={focus}
          selectedProvider={selectedProvider}
          selectedProviderModels={selectedProviderModels}
          providerOptions={providerOptions}
          presetId={presetId}
          setPresetId={setPresetId}
          applyPresetToDraft={applyPresetToDraft}
          requestReplaceProviderDraft={requestReplaceProviderDraft}
          updateProviderDraft={updateProviderDraft}
          apiKey={apiKey}
          setApiKey={setApiKey}
          modelsText={modelsText}
          setModelsText={setModelsText}
          providerDraftStatus={providerDraftStatus}
          providerActionAvailability={providerActionAvailability}
          providerActionHints={providerActionHints}
          handleFetchModels={handleFetchModels}
          handleTestProvider={handleTestProvider}
          handleSaveProvider={handleSaveProvider}
          state={state}
          proxyStateLabel={proxyStateLabels[state.proxyStatus.state]}
          quickstartSummary={quickstartSummary}
          kiroActionAvailability={kiroActionAvailability}
          kiroActionHints={kiroActionHints}
          handleToggleAutoApplyOnLaunch={handleToggleAutoApplyOnLaunch}
          startProxy={() =>
            runAction(() => requireDesktopApi().startProxy(), {
              pending: "正在启动本地代理...",
              success: "代理已启动。",
              afterFocus: "kiro"
            })
          }
          restartProxy={() =>
            runAction(() => requireDesktopApi().restartProxy(), {
              pending: "正在重启代理...",
              success: "代理已重启。",
              afterFocus: "kiro"
            })
          }
          applyRouting={() =>
            runAction(() => requireDesktopApi().applyRouting(), {
              pending: "正在应用 Kiro 配置...",
              success: "Kiro 路由已应用。",
              afterFocus: "kiro"
            })
          }
          toggleByok={() =>
            runAction(() => requireDesktopApi().setByokEnabled(!state.settings.isByokEnabled), {
              pending: state.settings.isByokEnabled ? "正在关闭 BYOK..." : "正在启用 BYOK...",
              success: state.settings.isByokEnabled ? "BYOK 已关闭。" : "BYOK 已启用。",
              afterFocus: "kiro"
            })
          }
          runDiagnose={() =>
            runAction(() => requireDesktopApi().diagnoseKiro(), {
              pending: "正在运行诊断...",
              success: "诊断已刷新。",
              afterFocus: "logs"
            })
          }
          stopProxy={() =>
            runAction(() => requireDesktopApi().stopProxy(), {
              pending: "正在停止代理...",
              success: "代理已停止。",
              afterFocus: "kiro"
            })
          }
          restoreKiro={() =>
            runAction(() => requireDesktopApi().restoreKiro(), {
              pending: "正在恢复最近备份...",
              success: "最近备份已恢复。",
              afterFocus: "kiro"
            })
          }
        />

        <section className={`workspace ${focus === "status" || focus === "logs" ? "focused" : ""}`}>
          <WorkspaceHero
            quickstartSummary={quickstartSummary}
            primaryWorkbenchActionLabel={primaryWorkbenchActionLabel}
            secondaryWorkbenchActionLabel={secondaryWorkbenchActionLabel}
            handlePrimaryWorkbenchAction={handlePrimaryWorkbenchAction}
            handleSecondaryWorkbenchAction={handleSecondaryWorkbenchAction}
            primaryIssue={primaryIssue}
            handleReadinessAction={handleReadinessAction}
            openConsole={openConsole}
            selectedProviderLabel={selectedProviderLabel}
            selectedDefaultModel={selectedProvider?.defaultModel ?? "未配置"}
            proxyStateLabel={proxyStateLabels[state.proxyStatus.state]}
            bridgeStatus={bridgeStatus}
            appMeta={appMeta}
            desktopHealth={desktopHealth}
          />

          <SetupWorkspace
            quickstartSummary={quickstartSummary}
            setupWorkspaceSummary={setupWorkspaceSummary}
            quickstartChecklist={quickstartChecklist}
            bootstrapSteps={state.bootstrap.steps}
            openQuickstart={() => openResource("quickstart")}
            handleQuickstartAction={handleQuickstartAction}
            handleSetupSummaryAction={handleSetupSummaryAction}
          />

          <StatusOverviewPanel
            state={state}
            proxyStateLabel={proxyStateLabels[state.proxyStatus.state]}
            nextRecommendedAction={primaryIssue?.action ?? state.bootstrap.steps.find((step) => !step.done)?.title ?? "可以开始实际使用"}
          />

          <WorkbenchPanel
            quickstartShowSetupWorkspace={quickstartSummary.showSetupWorkspace}
            launchStatus={launchStatus}
            bootstrapStatus={bootstrapStatus}
            lastLaunchAttempt={state.lastLaunchAttempt}
            lastBootstrapAttempt={state.lastBootstrapAttempt}
            formatTime={formatTime}
            describeLaunchStep={describeLaunchStep}
            describeBootstrapStep={describeBootstrapStep}
            readinessIssues={state.readinessIssues}
            handleReadinessAction={handleReadinessAction}
            workbenchTab={workbenchTab}
            setWorkbenchTab={setWorkbenchTab}
            viewingHistoricalBundle={viewingHistoricalBundle}
            selectLatestExportBundle={selectLatestExportBundle}
            copySupportSnapshot={copySupportSnapshot}
            recentLogsFromHistoricalBundle={recentLogsFromHistoricalBundle}
            recentLogsSourceBundleName={state.recentLogsSource.bundleName}
            lastExportBundle={lastExportBundle}
            logFilters={logFilters}
            setLogFilters={setLogFilters}
            refreshLogs={refreshLogs}
            openExportArtifact={openExportArtifact}
            logRows={logRows}
            outputEntries={outputEntries}
            outputSessionStartedAt={outputSessionStartedAt}
            copyOutputTimeline={copyOutputTimeline}
            clearOutputEntries={clearOutputEntries}
            diagnosticsSummarySource={state.diagnosticsSummarySource}
            diagnosticsSummary={state.diagnosticsSummary}
            exportSummary={exportSummary}
            exportHistory={exportHistory}
            latestWorkbenchExport={latestWorkbenchExport}
            workbenchExportHistory={workbenchExportHistory}
            statusDetail={statusDetail}
            basename={basename}
            copyWorkbenchSnapshot={copyWorkbenchSnapshot}
            exportWorkbenchSnapshot={exportWorkbenchSnapshot}
            openLatestWorkbenchSnapshot={openLatestWorkbenchSnapshot}
            copyDiagnosticsSummary={copyDiagnosticsSummary}
            exportDiagnosticsToFile={exportDiagnosticsToFile}
            exportDiagnosticsZip={exportDiagnosticsZip}
            openExportBundleDir={openExportBundleDir}
            openExportZip={openExportZip}
            clearMissingDiagnosticsHistory={clearMissingDiagnosticsHistory}
            clearExportHistory={clearExportHistory}
            refreshDiagnose={() =>
              runAction(() => requireDesktopApi().diagnoseKiro(), {
                pending: "正在刷新诊断...",
                success: "诊断已刷新。",
                afterFocus: "logs"
              })
            }
            copyExportHeadline={copyExportHeadline}
            runRecommendedAction={runRecommendedAction}
            copyRecommendedAction={copyRecommendedAction}
            selectExportBundle={selectExportBundle}
            deleteExportBundle={deleteExportBundle}
            writeSnapshotPath={writeSnapshotPath}
            clearMissingWorkbenchExportHistory={clearMissingWorkbenchExportHistory}
            clearWorkbenchExportHistory={clearWorkbenchExportHistory}
            openWorkbenchSnapshot={openWorkbenchSnapshot}
            deleteWorkbenchExport={deleteWorkbenchExport}
          />
        </section>

        <aside className={`rail right ${focus === "playground" || focus === "logs" ? "focused" : ""}`}>
          <ValidationRail
            quickstartSummaryShowSetupRail={quickstartSummary.showSetupRail}
            quickstartChecklist={quickstartChecklist}
            handleQuickstartAction={handleQuickstartAction}
            openQuickstart={() => openResource("quickstart")}
            openProvidersDoc={() => openResource("providers")}
            playgroundLockedByHistory={playgroundLockedByHistory}
            handleResumeLivePlayground={handleResumeLivePlayground}
            openHistoricalRequests={() => openExportArtifact(lastExportBundle?.requestsPath ?? null, "请求文件")}
            playgroundProviderId={playgroundProviderId}
            setPlaygroundProviderId={setPlaygroundProviderId}
            playgroundModelId={playgroundModelId}
            setPlaygroundModelId={setPlaygroundModelId}
            playgroundPrompt={playgroundPrompt}
            setPlaygroundPrompt={setPlaygroundPrompt}
            providers={state.settings.providers}
            providerForPlayground={providerForPlayground}
            handlePlaygroundSend={handlePlaygroundSend}
            playgroundResult={playgroundResult}
            formatTime={formatTime}
            viewingHistoricalBundle={viewingHistoricalBundle}
            selectLatestExportBundle={selectLatestExportBundle}
            latestFailure={latestFailure}
            latestSuccess={latestSuccess}
            summarizeLog={summarizeLog}
            handleDiagnosticLogAction={handleDiagnosticLogAction}
            copyLogSummary={copyLogSummary}
            copyDiagnosticsSummary={copyDiagnosticsSummary}
            exportDiagnosticsToFile={exportDiagnosticsToFile}
            exportDiagnosticsZip={exportDiagnosticsZip}
            openExportBundleDir={openExportBundleDir}
            openExportZip={openExportZip}
            clearExportHistory={clearExportHistory}
            openStreamingDoc={() => openResource("streaming")}
            exportSummary={exportSummary}
            lastExportBundle={lastExportBundle}
            exportHistory={exportHistory}
            copyExportHeadline={copyExportHeadline}
            runRecommendedAction={runRecommendedAction}
            copyRecommendedAction={copyRecommendedAction}
            copySupportSnapshot={copySupportSnapshot}
            openExportArtifact={openExportArtifact}
            selectExportBundle={selectExportBundle}
            deleteExportBundle={deleteExportBundle}
            statusDetail={statusDetail}
          />
        </aside>
      </main>
    </div>
  );

  return (
    <>
      {view === "home" ? home : consoleView}
      {pendingProviderReplaceAction ? (
        <div className="modal-backdrop" role="presentation">
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="provider-draft-confirm-title">
            <div className="confirm-dialog-copy">
              <span className="panel-tag">草稿确认</span>
              <h3 id="provider-draft-confirm-title">当前 Provider 有未保存的草稿</h3>
              <p>{providerDraftStatus.detail}</p>
              <p>继续后会覆盖当前表单中的修改。</p>
            </div>
            <div className="confirm-dialog-actions">
              <button className="ghost-button" onClick={cancelPendingProviderReplaceAction}>继续编辑</button>
              <button onClick={confirmPendingProviderReplaceAction}>仍然覆盖</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
