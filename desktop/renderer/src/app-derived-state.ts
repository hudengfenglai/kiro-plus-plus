import { buildProviderDraftStatus, type QuickstartSummary } from "../../shared/quickstart";
import type {
  AppState,
  DiagnosticsExportBundle,
  DiagnosticsLogSnapshot,
  ProviderModel,
  ProviderProfile,
  RequestLogEntry,
  WorkbenchExportSnapshot
} from "../../shared/types";
import type { ExportSummary, ReadinessIssue } from "./app-types";
import { basename, parseModelsText } from "./app-utils";

type DerivedStateArgs = {
  state: AppState;
  selectedProvider: ProviderProfile | null;
  lastExportBundle: DiagnosticsExportBundle | null;
  logRows: RequestLogEntry[];
  apiKey: string;
  modelsText: string;
  playgroundProviderId: string;
  quickstartSummary: QuickstartSummary;
};

export function buildAppDerivedState({
  state,
  selectedProvider,
  lastExportBundle,
  logRows,
  apiKey,
  modelsText,
  playgroundProviderId,
  quickstartSummary
}: DerivedStateArgs) {
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
  const latestFailure = pickLatestLog({
    preferred: viewingHistoricalBundle ? lastExportBundle?.latestFailure ?? null : null,
    logRows,
    matcher: (entry) => entry.status >= 400
  });
  const latestSuccess = pickLatestLog({
    preferred: viewingHistoricalBundle ? lastExportBundle?.latestSuccess ?? null : null,
    logRows,
    matcher: (entry) => entry.status >= 200 && entry.status < 400
  });
  const exportSummary = buildExportSummary(lastExportBundle);
  const exportHistory = state.exportHistory ?? [];
  const playgroundLockedByHistory = viewingHistoricalBundle;
  const selectedProviderModels = parseModelsText(modelsText, selectedProvider?.models ?? []);
  const providerDraftStatus = buildProviderDraftStatus({
    savedProfile:
      state.settings.providers.find((provider) => provider.id === selectedProvider?.id)
      ?? state.settings.providers[0]
      ?? null,
    draftProfile: selectedProvider,
    draftModels: selectedProviderModels,
    hasDraftApiKey: Boolean(apiKey.trim())
  });
  const providerForPlayground =
    state.settings.providers.find((provider) => provider.id === playgroundProviderId)
    ?? state.settings.providers[0]
    ?? null;

  return {
    selectedProviderLabel,
    primaryIssue,
    latestWorkbenchExport,
    workbenchExportHistory,
    viewingHistoricalBundle,
    recentLogsFromHistoricalBundle,
    latestFailure,
    latestSuccess,
    exportSummary,
    exportHistory,
    playgroundLockedByHistory,
    primaryWorkbenchActionLabel: viewingHistoricalBundle
      ? "回到实时后继续"
      : (quickstartSummary.nextItem?.actionLabel ?? "去做验证"),
    secondaryWorkbenchActionLabel: viewingHistoricalBundle
      ? "回到实时工作区"
      : (quickstartSummary.isComplete ? "打开工作区" : "继续设置"),
    launchWorkbenchActionLabel: viewingHistoricalBundle
      ? "回到实时后启动 Kiro"
      : quickstartSummary.launchActionLabel,
    selectedProviderModels,
    providerDraftStatus,
    providerForPlayground
  };
}

function buildExportSummary(lastExportBundle: DiagnosticsExportBundle | null): ExportSummary | null {
  if (!lastExportBundle) {
    return null;
  }

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
}

function pickLatestLog({
  preferred,
  logRows,
  matcher
}: {
  preferred: DiagnosticsLogSnapshot | RequestLogEntry | null;
  logRows: RequestLogEntry[];
  matcher: (entry: RequestLogEntry) => boolean;
}) {
  if (preferred) {
    return preferred;
  }
  return [...logRows].find(matcher) ?? null;
}

export type AppDerivedState = ReturnType<typeof buildAppDerivedState>;
