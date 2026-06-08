export type ProviderType = "openai-compatible" | "anthropic" | "gemini";

export interface ProviderModel {
  id: string;
  name: string;
  description?: string;
  maxInputTokens?: number;
  note?: string;
}

export interface ProviderProfile {
  id: string;
  providerPresetId?: null | string;
  type: ProviderType;
  label: string;
  baseUrl: string;
  defaultModel: string;
  models: ProviderModel[];
}

export interface ProxyStatus {
  state: "stopped" | "starting" | "running" | "error";
  endpoint: string | null;
  error: string | null;
}

export interface AppMeta {
  version: string;
  isPackaged: boolean;
  source: "packaged" | "development";
  buildLabel: string;
  appPath: string;
}

export interface PlaygroundRequest {
  providerId: string;
  modelId: string;
  prompt: string;
}

export interface PlaygroundResult {
  ok: boolean;
  text: string;
  modelId: string;
  latencyMs: number;
}

export interface RequestLogEntry {
  at: string;
  operation: string;
  status: number;
  durationMs?: number;
  requestId?: string;
  bodyBytes?: number;
  headers?: Record<string, string>;
}

export interface KiroDiagnoseReport {
  localRegions: string[];
  unsupportedOperationsSeen: string[];
  autoModeBlocksByok: boolean;
  profileAutoModeBlocksByok: boolean;
  hint: string;
}

export interface DiagnosticsExportBundle {
  exportedAt: string;
  bundleName: string;
  bundleDir: string;
  readmePath: string;
  summaryPath: string;
  jsonPath: string;
  requestsPath: string;
  manifestPath: string;
  zipPath?: string;
  text: string;
}

export interface LaunchAttempt {
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "success" | "error" | "skipped";
  step: string;
  detail: string;
  endpoint: string | null;
  installPath: string | null;
  error: string | null;
}

export interface BootstrapStep {
  key: string;
  title: string;
  done: boolean;
  detail: string;
}

export interface BootstrapState {
  recommendedTab: "status" | "providers" | "kiro" | "logs" | "playground";
  steps: BootstrapStep[];
}

export interface ReadinessIssue {
  key: string;
  severity: "error" | "warning";
  title: string;
  detail: string;
  focus: BootstrapState["recommendedTab"];
  action: string;
}

export interface AppState {
  settings: {
    selectedProviderId: string;
    isByokEnabled: boolean;
    lastSuccessfulProviderTest: null | {
      providerId: string;
      modelId: string;
      at: null | string;
      latencyMs: number;
    };
    lastAppliedKiroBackup: null | {
      backupPath: string;
      at: null | string;
    };
    providers: ProviderProfile[];
    kiro: {
      autoApplyOnLaunch: boolean;
      defaultEndpointPort: number;
    };
    logging: {
      captureHeaders: boolean;
      captureBodies: boolean;
    };
    runtime: {
      exportHistory: DiagnosticsExportBundle[];
      lastExportBundle: DiagnosticsExportBundle | null;
      lastLaunchAttempt: LaunchAttempt | null;
      lastBootstrapAttempt: LaunchAttempt | null;
      selectedExportBundleName: string | null;
    };
  };
  proxyStatus: ProxyStatus;
  kiroDetection: {
    installed: boolean;
    installPath: string | null;
    searchedInstallPaths: string[];
    detectionHint: string;
    settingsPath: string;
    profilesDir: string;
    backupDir: string;
    lastBackup?: null | {
      backupPath: string;
      at: null | string;
    };
  };
  diagnose: KiroDiagnoseReport | null;
  recentLogs: RequestLogEntry[];
  bootstrap: BootstrapState;
  readinessIssues: ReadinessIssue[];
  lastSuccessfulProviderTest: AppState["settings"]["lastSuccessfulProviderTest"];
  lastAppliedKiroBackup: AppState["settings"]["lastAppliedKiroBackup"];
  exportHistory: DiagnosticsExportBundle[];
  lastExportBundle: DiagnosticsExportBundle | null;
  lastLaunchAttempt: LaunchAttempt | null;
  lastBootstrapAttempt: LaunchAttempt | null;
}
