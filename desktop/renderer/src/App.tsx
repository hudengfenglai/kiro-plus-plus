import { useEffect, useMemo, useState } from "react";

import {
  PROVIDER_PRESETS,
  buildProviderProfileFromPreset
} from "../../shared/provider-presets";
import {
  buildKiroActionAvailability,
  buildProviderActionAvailability,
  buildQuickstartChecklist,
  summarizeQuickstartChecklist
} from "../../shared/quickstart";
import { inspectDesktopBridge } from "../../shared/bridge-status";
import { buildDesktopHealthSummary } from "../../shared/desktop-health";
import { createDiagnosticsActions } from "./app-diagnostics-actions";
import { buildAppDerivedState } from "./app-derived-state";
import { createFlowActions } from "./app-flow-actions";
import { createProviderActions } from "./app-provider-actions";
import { createRuntimeActions } from "./app-runtime-actions";
import type {
  ActionEntry,
  ConsoleFocus,
  PendingProviderReplaceAction,
  PlaygroundState,
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
  describeError,
  describeLaunchStatus,
  pickRecommendedFocus
} from "./app-utils";
import {
  makeActionEntry,
  proxyStateLabels,
  requireDesktopApi,
  resourceLinks,
  writeClipboardText
} from "./app-shell";
import { buildConsoleWorkbenchProps, ConsoleWorkbench } from "./app-console-props";
import { HomeView } from "./components/HomeView";
import type {
  AppMeta,
  AppState,
  DiagnosticsExportBundle,
  ProviderProfile
} from "../../shared/types";
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
  const outputEntries = useMemo(
    () => [...actionEntries].sort((a, b) => (a.at < b.at ? 1 : -1)),
    [actionEntries]
  );
  const outputSessionStartedAt = outputEntries.at(-1)?.at ?? null;
  const derived = useMemo(
    () => buildAppDerivedState({
      state,
      selectedProvider,
      lastExportBundle,
      logRows,
      apiKey,
      modelsText,
      playgroundProviderId,
      quickstartSummary
    }),
    [
      apiKey,
      lastExportBundle,
      logRows,
      modelsText,
      playgroundProviderId,
      quickstartSummary,
      selectedProvider,
      state
    ]
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
    viewingHistoricalBundle: derived.viewingHistoricalBundle,
    lastExportBundle,
    exportSummary: derived.exportSummary,
    exportHistory: derived.exportHistory,
    latestFailure: derived.latestFailure,
    latestSuccess: derived.latestSuccess,
    selectedProviderLabel: derived.selectedProviderLabel,
    proxyEndpoint: state.proxyStatus.endpoint,
    proxyStateLabel: proxyStateLabels[state.proxyStatus.state],
    isByokEnabled: state.settings.isByokEnabled,
    diagnosticsSummarySource: state.diagnosticsSummarySource,
    diagnosticsSummary: state.diagnosticsSummary,
    recentLogsSource: state.recentLogsSource,
    latestWorkbenchExport: derived.latestWorkbenchExport,
    workbenchExportHistory: derived.workbenchExportHistory,
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
    selectedProviderModels: derived.selectedProviderModels,
    providerDraftStatus: derived.providerDraftStatus,
    apiKey,
    playgroundPrompt,
    playgroundLockedByHistory: derived.playgroundLockedByHistory,
    providerForPlayground: derived.providerForPlayground,
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

  const runtimeActions = createRuntimeActions({
    runAction,
    requireDesktopApi,
    isByokEnabled: state.settings.isByokEnabled
  });

  const {
    startProxy,
    restartProxy,
    applyRouting,
    toggleByok,
    diagnoseKiro,
    refreshDiagnose,
    stopProxy,
    restoreKiro
  } = runtimeActions;

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
      selectedProviderLabel={derived.selectedProviderLabel}
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

  const consoleWorkbenchProps = buildConsoleWorkbenchProps({
    status,
    statusDetail,
    appMeta,
    state,
    theme,
    focus,
    workbenchTab,
    bridgeStatus,
    desktopHealth,
    quickstartSummary,
    quickstartChecklist,
    primaryWorkbenchActionLabel: derived.primaryWorkbenchActionLabel,
    secondaryWorkbenchActionLabel: derived.secondaryWorkbenchActionLabel,
    launchWorkbenchActionLabel: derived.launchWorkbenchActionLabel,
    proxyStateLabel: proxyStateLabels[state.proxyStatus.state],
    selectedProvider,
    selectedProviderLabel: derived.selectedProviderLabel,
    selectedProviderModels: derived.selectedProviderModels,
    providerOptions,
    presetId,
    apiKey,
    modelsText,
    providerDraftStatus: derived.providerDraftStatus,
    providerActionAvailability,
    providerActionHints,
    kiroActionAvailability,
    kiroActionHints,
    primaryIssue: derived.primaryIssue,
    viewingHistoricalBundle: derived.viewingHistoricalBundle,
    recentLogsFromHistoricalBundle: derived.recentLogsFromHistoricalBundle,
    playgroundLockedByHistory: derived.playgroundLockedByHistory,
    playgroundProviderId,
    playgroundModelId,
    playgroundPrompt,
    providerForPlayground: derived.providerForPlayground,
    playgroundResult,
    logFilters,
    logRows,
    outputEntries,
    outputSessionStartedAt,
    exportSummary: derived.exportSummary,
    exportHistory: derived.exportHistory,
    lastExportBundle,
    latestWorkbenchExport: derived.latestWorkbenchExport,
    workbenchExportHistory: derived.workbenchExportHistory,
    latestFailure: derived.latestFailure,
    latestSuccess: derived.latestSuccess,
    launchStatus,
    bootstrapStatus,
    toggleTheme,
    setView,
    setPresetId,
    setApiKey,
    setModelsText,
    setWorkbenchTab,
    setLogFilters,
    setPlaygroundProviderId,
    setPlaygroundModelId,
    setPlaygroundPrompt,
    openConsole,
    openResource,
    handlePrimaryWorkbenchAction,
    handleSecondaryWorkbenchAction,
    handleLaunchEntry,
    handleReadinessAction,
    handleQuickstartAction,
    handleSetupSummaryAction,
    applyPresetToDraft,
    requestReplaceProviderDraft,
    updateProviderDraft,
    handleFetchModels,
    handleTestProvider,
    handleSaveProvider,
    handleToggleAutoApplyOnLaunch,
    startProxy,
    restartProxy,
    applyRouting,
    toggleByok,
    diagnoseKiro,
    stopProxy,
    restoreKiro,
    refreshLogs,
    openExportArtifact,
    copyOutputTimeline,
    clearOutputEntries,
    copyWorkbenchSnapshot,
    exportWorkbenchSnapshot,
    openLatestWorkbenchSnapshot,
    copyDiagnosticsSummary,
    exportDiagnosticsToFile,
    exportDiagnosticsZip,
    openExportBundleDir,
    openExportZip,
    clearMissingDiagnosticsHistory,
    clearExportHistory,
    refreshDiagnose,
    copyExportHeadline,
    runRecommendedAction,
    copyRecommendedAction,
    selectExportBundle,
    deleteExportBundle,
    writeSnapshotPath,
    clearMissingWorkbenchExportHistory,
    clearWorkbenchExportHistory,
    openWorkbenchSnapshot,
    deleteWorkbenchExport,
    handleResumeLivePlayground,
    handlePlaygroundSend,
    selectLatestExportBundle,
    copySupportSnapshot,
    handleDiagnosticLogAction,
    copyLogSummary,
    basename
  });

  const consoleView = <ConsoleWorkbench {...consoleWorkbenchProps} />;

  return (
    <>
      {view === "home" ? home : consoleView}
      {pendingProviderReplaceAction ? (
        <div className="modal-backdrop" role="presentation">
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="provider-draft-confirm-title">
            <div className="confirm-dialog-copy">
              <span className="panel-tag">草稿确认</span>
              <h3 id="provider-draft-confirm-title">当前 Provider 有未保存的草稿</h3>
              <p>{derived.providerDraftStatus.detail}</p>
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
