import type { Dispatch, SetStateAction } from "react";

import {
  buildSetupWorkspaceSummary,
  type KiroActionAvailability,
  type ProviderActionAvailability,
  type ProviderDraftStatus,
  type QuickstartItem,
  type QuickstartSummary
} from "../../shared/quickstart";
import type { DesktopBridgeStatus } from "../../shared/bridge-status";
import type { DesktopHealthSummary } from "../../shared/desktop-health";
import type {
  AppMeta,
  AppState,
  DiagnosticsExportBundle,
  DiagnosticsLogSnapshot,
  ProviderModel,
  ProviderProfile,
  RequestLogEntry,
  WorkbenchExportSnapshot
} from "../../shared/types";
import type {
  ActionEntry,
  ConsoleFocus,
  ExportSummary,
  LogFilters,
  PlaygroundState,
  ReadinessIssue,
  ThemeKey,
  ViewKey,
  WorkbenchTab
} from "./app-types";
import {
  describeBootstrapStep,
  describeLaunchStep,
  formatTime,
  summarizeLog
} from "./app-utils";
import { ConsoleWorkbench, type ConsoleWorkbenchProps } from "./components/ConsoleWorkbench";

type BuildConsoleWorkbenchPropsArgs = {
  status: string;
  statusDetail: string;
  appMeta: AppMeta | null;
  state: AppState;
  theme: ThemeKey;
  focus: ConsoleFocus;
  workbenchTab: WorkbenchTab;
  bridgeStatus: DesktopBridgeStatus;
  desktopHealth: DesktopHealthSummary;
  quickstartSummary: QuickstartSummary;
  quickstartChecklist: QuickstartItem[];
  primaryWorkbenchActionLabel: string;
  secondaryWorkbenchActionLabel: string;
  launchWorkbenchActionLabel: string;
  proxyStateLabel: string;
  selectedProvider: ProviderProfile | null;
  selectedProviderLabel: string;
  selectedProviderModels: ProviderModel[];
  providerOptions: Array<{ id: string; label: string }>;
  presetId: string;
  apiKey: string;
  modelsText: string;
  providerDraftStatus: ProviderDraftStatus;
  providerActionAvailability: ProviderActionAvailability;
  providerActionHints: string[];
  kiroActionAvailability: KiroActionAvailability;
  kiroActionHints: string[];
  primaryIssue: ReadinessIssue | null;
  viewingHistoricalBundle: boolean;
  recentLogsFromHistoricalBundle: boolean;
  playgroundLockedByHistory: boolean;
  playgroundProviderId: string;
  playgroundModelId: string;
  playgroundPrompt: string;
  providerForPlayground: ProviderProfile | null;
  playgroundResult: PlaygroundState | null;
  logFilters: LogFilters;
  logRows: RequestLogEntry[];
  outputEntries: ActionEntry[];
  outputSessionStartedAt: string | null;
  exportSummary: ExportSummary | null;
  exportHistory: DiagnosticsExportBundle[];
  lastExportBundle: DiagnosticsExportBundle | null;
  latestWorkbenchExport: WorkbenchExportSnapshot | null;
  workbenchExportHistory: WorkbenchExportSnapshot[];
  latestFailure: DiagnosticsLogSnapshot | RequestLogEntry | null;
  latestSuccess: DiagnosticsLogSnapshot | RequestLogEntry | null;
  launchStatus: { title: string; tone: "info" | "success" | "error" };
  bootstrapStatus: { title: string; tone: "info" | "success" | "error" };
  toggleTheme: () => void;
  setView: Dispatch<SetStateAction<ViewKey>>;
  setPresetId: (value: string) => void;
  setApiKey: (value: string) => void;
  setModelsText: (value: string) => void;
  setWorkbenchTab: (tab: WorkbenchTab) => void;
  setLogFilters: Dispatch<SetStateAction<LogFilters>>;
  setPlaygroundProviderId: (value: string) => void;
  setPlaygroundModelId: (value: string) => void;
  setPlaygroundPrompt: (value: string) => void;
  openConsole: (focus: ConsoleFocus) => void;
  openResource: (resource: "quickstart" | "providers" | "streaming") => void;
  handlePrimaryWorkbenchAction: () => void | Promise<unknown>;
  handleSecondaryWorkbenchAction: () => void | Promise<unknown>;
  handleLaunchEntry: () => void | Promise<unknown>;
  handleReadinessAction: (issue: ReadinessIssue) => void | Promise<unknown>;
  handleQuickstartAction: (item: QuickstartItem) => void | Promise<unknown>;
  handleSetupSummaryAction: (item: ReturnType<typeof buildSetupWorkspaceSummary>["items"][number]) => void | Promise<unknown>;
  applyPresetToDraft: () => void;
  requestReplaceProviderDraft: (action: { kind: "switch-provider"; providerId: string }) => void;
  updateProviderDraft: (next: ProviderProfile) => void;
  handleFetchModels: () => void | Promise<unknown>;
  handleTestProvider: () => void | Promise<unknown>;
  handleSaveProvider: () => void | Promise<unknown>;
  handleToggleAutoApplyOnLaunch: () => void | Promise<unknown>;
  startProxy: () => void | Promise<unknown>;
  restartProxy: () => void | Promise<unknown>;
  applyRouting: () => void | Promise<unknown>;
  toggleByok: () => void | Promise<unknown>;
  diagnoseKiro: () => void | Promise<unknown>;
  stopProxy: () => void | Promise<unknown>;
  restoreKiro: () => void | Promise<unknown>;
  refreshLogs: () => void | Promise<unknown>;
  openExportArtifact: (target: null | string, label: string) => void;
  copyOutputTimeline: () => void;
  clearOutputEntries: () => void;
  copyWorkbenchSnapshot: () => void;
  exportWorkbenchSnapshot: () => void;
  openLatestWorkbenchSnapshot: () => void;
  copyDiagnosticsSummary: () => void;
  exportDiagnosticsToFile: () => void;
  exportDiagnosticsZip: () => void;
  openExportBundleDir: () => void;
  openExportZip: () => void;
  clearMissingDiagnosticsHistory: () => void;
  clearExportHistory: () => void;
  refreshDiagnose: () => void | Promise<unknown>;
  copyExportHeadline: () => void;
  runRecommendedAction: () => void;
  copyRecommendedAction: () => void;
  selectExportBundle: (bundle: DiagnosticsExportBundle) => void;
  deleteExportBundle: (bundle: DiagnosticsExportBundle) => void;
  writeSnapshotPath: (filePath: string) => void;
  clearMissingWorkbenchExportHistory: () => void;
  clearWorkbenchExportHistory: () => void;
  openWorkbenchSnapshot: (filePath: string) => void;
  deleteWorkbenchExport: (filePath: string) => void;
  handleResumeLivePlayground: () => void | Promise<unknown>;
  handlePlaygroundSend: () => void | Promise<unknown>;
  selectLatestExportBundle: () => void;
  copySupportSnapshot: () => void;
  handleDiagnosticLogAction: (entry: DiagnosticsLogSnapshot | RequestLogEntry | null) => void;
  copyLogSummary: (entry: DiagnosticsLogSnapshot | RequestLogEntry | null, kind: "failure" | "success") => void;
  basename: (value?: null | string) => string;
};

export function buildConsoleWorkbenchProps({
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
  primaryWorkbenchActionLabel,
  secondaryWorkbenchActionLabel,
  launchWorkbenchActionLabel,
  proxyStateLabel,
  selectedProvider,
  selectedProviderLabel,
  selectedProviderModels,
  providerOptions,
  presetId,
  apiKey,
  modelsText,
  providerDraftStatus,
  providerActionAvailability,
  providerActionHints,
  kiroActionAvailability,
  kiroActionHints,
  primaryIssue,
  viewingHistoricalBundle,
  recentLogsFromHistoricalBundle,
  playgroundLockedByHistory,
  playgroundProviderId,
  playgroundModelId,
  playgroundPrompt,
  providerForPlayground,
  playgroundResult,
  logFilters,
  logRows,
  outputEntries,
  outputSessionStartedAt,
  exportSummary,
  exportHistory,
  lastExportBundle,
  latestWorkbenchExport,
  workbenchExportHistory,
  latestFailure,
  latestSuccess,
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
}: BuildConsoleWorkbenchPropsArgs): ConsoleWorkbenchProps {
  const selectedDefaultModel = selectedProvider?.defaultModel ?? "未配置";
  const setupWorkspaceSummary = buildSetupWorkspaceSummary(state);
  const nextRecommendedAction =
    primaryIssue?.action
    ?? state.bootstrap.steps.find((step) => !step.done)?.title
    ?? "可以开始实际使用";

  return {
    header: {
      status,
      appMeta,
      quickstartSummary,
      bridgeStatus,
      primaryWorkbenchActionLabel,
      launchWorkbenchActionLabel,
      handlePrimaryWorkbenchAction,
      toggleTheme,
      theme,
      setView,
      handleLaunchEntry,
      viewingHistoricalBundle,
      lastExportBundle,
      exportSummary,
      basename,
      formatTime,
      selectLatestExportBundle,
      openExportArtifact,
      copySupportSnapshot
    },
    leftRail: {
      focus,
      selectedProvider,
      selectedProviderModels,
      providerOptions,
      presetId,
      setPresetId,
      applyPresetToDraft,
      requestReplaceProviderDraft,
      updateProviderDraft,
      apiKey,
      setApiKey,
      modelsText,
      setModelsText,
      providerDraftStatus,
      providerActionAvailability,
      providerActionHints,
      handleFetchModels,
      handleTestProvider,
      handleSaveProvider,
      state,
      proxyStateLabel,
      quickstartSummary,
      kiroActionAvailability,
      kiroActionHints,
      handleToggleAutoApplyOnLaunch,
      startProxy,
      restartProxy,
      applyRouting,
      toggleByok,
      runDiagnose: diagnoseKiro,
      stopProxy,
      restoreKiro
    },
    center: {
      focus,
      hero: {
        quickstartSummary,
        primaryWorkbenchActionLabel,
        secondaryWorkbenchActionLabel,
        handlePrimaryWorkbenchAction,
        handleSecondaryWorkbenchAction,
        primaryIssue,
        handleReadinessAction,
        openConsole,
        selectedProviderLabel,
        selectedDefaultModel,
        proxyStateLabel,
        bridgeStatus,
        appMeta,
        desktopHealth
      },
      setup: {
        quickstartSummary,
        setupWorkspaceSummary,
        quickstartChecklist,
        bootstrapSteps: state.bootstrap.steps,
        openQuickstart: () => openResource("quickstart"),
        handleQuickstartAction,
        handleSetupSummaryAction
      },
      statusOverview: {
        state,
        proxyStateLabel,
        nextRecommendedAction
      },
      workbench: {
        quickstartShowSetupWorkspace: quickstartSummary.showSetupWorkspace,
        launchStatus,
        bootstrapStatus,
        lastLaunchAttempt: state.lastLaunchAttempt,
        lastBootstrapAttempt: state.lastBootstrapAttempt,
        formatTime,
        describeLaunchStep,
        describeBootstrapStep,
        readinessIssues: state.readinessIssues,
        handleReadinessAction,
        workbenchTab,
        setWorkbenchTab,
        viewingHistoricalBundle,
        selectLatestExportBundle,
        copySupportSnapshot,
        recentLogsFromHistoricalBundle,
        recentLogsSourceBundleName: state.recentLogsSource.bundleName,
        lastExportBundle,
        logFilters,
        setLogFilters,
        refreshLogs,
        openExportArtifact,
        logRows,
        outputEntries,
        outputSessionStartedAt,
        copyOutputTimeline,
        clearOutputEntries,
        diagnosticsSummarySource: state.diagnosticsSummarySource,
        diagnosticsSummary: state.diagnosticsSummary,
        exportSummary,
        exportHistory,
        latestWorkbenchExport,
        workbenchExportHistory,
        statusDetail,
        basename,
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
        deleteWorkbenchExport
      }
    },
    rightRail: {
      focus,
      validation: {
        quickstartSummaryShowSetupRail: quickstartSummary.showSetupRail,
        quickstartChecklist,
        handleQuickstartAction,
        openQuickstart: () => openResource("quickstart"),
        openProvidersDoc: () => openResource("providers"),
        playgroundLockedByHistory,
        handleResumeLivePlayground,
        openHistoricalRequests: () => openExportArtifact(lastExportBundle?.requestsPath ?? null, "请求文件"),
        playgroundProviderId,
        setPlaygroundProviderId,
        playgroundModelId,
        setPlaygroundModelId,
        playgroundPrompt,
        setPlaygroundPrompt,
        providers: state.settings.providers,
        providerForPlayground,
        handlePlaygroundSend,
        playgroundResult,
        formatTime,
        viewingHistoricalBundle,
        selectLatestExportBundle,
        latestFailure,
        latestSuccess,
        summarizeLog,
        handleDiagnosticLogAction,
        copyLogSummary,
        copyDiagnosticsSummary,
        exportDiagnosticsToFile,
        exportDiagnosticsZip,
        openExportBundleDir,
        openExportZip,
        clearExportHistory,
        openStreamingDoc: () => openResource("streaming"),
        exportSummary,
        lastExportBundle,
        exportHistory,
        copyExportHeadline,
        runRecommendedAction,
        copyRecommendedAction,
        copySupportSnapshot,
        openExportArtifact,
        selectExportBundle,
        deleteExportBundle,
        statusDetail
      }
    }
  };
}

export { ConsoleWorkbench };
