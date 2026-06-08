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
import { describeWorkbenchSnapshotAvailability } from "../../shared/workbench-snapshot-status";
import { createDiagnosticsActions } from "./app-diagnostics-actions";
import { createFlowActions } from "./app-flow-actions";
import { createProviderActions } from "./app-provider-actions";
import type {
  ActionEntry,
  ConsoleFocus,
  PendingProviderReplaceAction,
  ResourceKey,
  ThemeKey,
  ViewKey,
  WorkbenchTab
} from "./app-types";
import { createWorkbenchActions } from "./app-workbench-actions";
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
  LaunchAttempt,
  PlaygroundResult,
  ProviderModel,
  ProviderProfile,
  RequestLogEntry
} from "../../shared/types";

type PlaygroundState = PlaygroundResult & { requestedAt: string };

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

  const workbenchActions = createWorkbenchActions({
    runAction,
    requireDesktopApi,
    logFilters,
    isAutoApplyOnLaunch: state.settings.kiro.autoApplyOnLaunch,
    setStatus,
    setStatusDetail,
    setState,
    setFocus,
    setWorkbenchTab,
    setView,
    setLogRows
  });

  const {
    openConsole,
    handleReadinessAction,
    handleDesktopHealthAction,
    refreshLogs,
    openResource,
    handleToggleAutoApplyOnLaunch
  } = workbenchActions;

  const diagnosticsActions = createDiagnosticsActions({
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
    proxyEndpoint: state.proxyStatus.endpoint,
    proxyStateLabel: proxyStateLabels[state.proxyStatus.state],
    isByokEnabled: state.settings.isByokEnabled,
    diagnosticsSummarySource: state.diagnosticsSummarySource,
    diagnosticsSummary: state.diagnosticsSummary,
    recentLogsSource: state.recentLogsSource,
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
  });

  const {
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
  } = diagnosticsActions;

  const providerActions = createProviderActions({
    runAction,
    requireDesktopApi,
    presetId,
    stateProviders: state.settings.providers,
    selectedProvider,
    selectedProviderModels,
    providerDraftStatus,
    apiKey,
    playgroundPrompt,
    playgroundLockedByHistory,
    providerForPlayground,
    playgroundModelId,
    setProviderDraft,
    setPresetId,
    setModelsText,
    setApiKey,
    setPlaygroundProviderId,
    setPlaygroundModelId,
    setPlaygroundResult,
    setPendingProviderReplaceAction,
    setFocus,
    pushOutput,
    openConsole,
    ensureLiveSupportBundleContext
  });

  const {
    updateProviderDraft,
    requestReplaceProviderDraft,
    applyPresetToDraft,
    confirmPendingProviderReplaceAction: confirmProviderReplaceAction,
    cancelPendingProviderReplaceAction,
    handleSaveProvider,
    handleFetchModels,
    handleTestProvider,
    handlePlaygroundSend
  } = providerActions;

  const flowActions = createFlowActions({
    runAction,
    requireDesktopApi,
    quickstartSummary,
    quickstartChecklist,
    readinessIssues: state.readinessIssues,
    openConsole,
    ensureLiveSupportBundleContext,
    handleReadinessAction,
    handleFetchModels,
    handleTestProvider
  });

  const {
    handleQuickstartAction,
    handleSetupSummaryAction,
    handleLaunchEntry,
    handlePrimaryWorkbenchAction,
    handleSecondaryWorkbenchAction,
    handleResumeLivePlayground
  } = flowActions;

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
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
              <button onClick={() => confirmProviderReplaceAction(pendingProviderReplaceAction)}>仍然覆盖</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
