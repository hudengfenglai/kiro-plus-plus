import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

import { normalizeAppSettings } from "../../src/config.js";
import {
  buildDesktopHealthSummary,
  formatDesktopHealthSummary,
  getDesktopHealthPrimaryAction,
  formatDesktopHealthHeadline
} from "../shared/desktop-health.js";

function withProvider(settings, profile, previousProviderId = null) {
  const providers = settings.providers.filter((item) => item.id !== profile.id && item.id !== previousProviderId);
  providers.push(profile);
  return normalizeAppSettings({
    ...settings,
    selectedProviderId: profile.id,
    providers
  });
}

function summarizeRecentFailure(entries) {
  return [...entries].reverse().find((entry) => entry.status >= 400) ?? null;
}

function summarizeRecentSuccess(entries) {
  return [...entries].reverse().find((entry) => entry.status >= 200 && entry.status < 400) ?? null;
}

function toDiagnosticsLogSnapshot(entry) {
  if (!entry) {
    return null;
  }
  return {
    operation: entry.operation || "unknown",
    status: entry.status,
    requestId: entry.requestId ?? undefined,
    at: entry.at ?? undefined,
    durationMs: typeof entry.durationMs === "number" ? entry.durationMs : undefined,
    bodyBytes: typeof entry.bodyBytes === "number" ? entry.bodyBytes : undefined
  };
}

function formatRecentRequestSnapshot(entries = []) {
  if (!entries.length) {
    return "Recent requests (redacted)\n- none";
  }

  return [
    "Recent requests (redacted)",
    ...entries.map((entry, index) =>
      [
        `- #${index + 1} ${entry.operation || "unknown"} / HTTP ${entry.status}`,
        `  at: ${entry.at ?? "-"}`,
        `  requestId: ${entry.requestId ?? "-"}`,
        `  durationMs: ${entry.durationMs ?? 0}`,
        `  bodyBytes: ${entry.bodyBytes ?? 0}`
      ].join("\n")
    )
  ].join("\n");
}

function formatSupportBundleReadme() {
  return [
    "Kiro++ support bundle",
    "",
    "Files:",
    "- summary.txt: human-readable diagnostics summary plus recent request snapshot",
    "- snapshot.json: structured diagnostics summary, readiness issues, and current state excerpts",
    "- recent-requests.json: recent redacted request entries for log-oriented inspection",
    "- manifest.json: bundle metadata and absolute file paths",
    "",
    "Notes:",
    "- Secrets should already be redacted before export.",
    "- Local filesystem paths inside exported files are redacted by default for safer public sharing.",
    "- Share this bundle only when you are comfortable revealing model ids, endpoint metadata, and request timing.",
    "- This bundle is generated locally by Kiro++."
  ].join("\n");
}

function sanitizePathForShare(value) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (!/^[A-Za-z]:[\\/]/.test(trimmed) && !trimmed.startsWith("/") && !/[\\/]/.test(trimmed)) {
    return trimmed;
  }

  const cleaned = trimmed.replace(/[\\/]+$/, "");
  const parts = cleaned.split(/[\\/]/).filter(Boolean);
  const tail = parts.at(-1) ?? cleaned;
  return `<path:${tail}>`;
}

function sanitizeTextForShare(text, values = []) {
  return values
    .filter((value) => typeof value === "string" && value.trim())
    .sort((left, right) => right.length - left.length)
    .reduce((output, value) => output.split(value).join(sanitizePathForShare(value)), text);
}

function sanitizeKiroDetectionForShare(kiroDetection) {
  if (!kiroDetection) {
    return kiroDetection;
  }

  const pathValues = [
    kiroDetection.installPath,
    ...(kiroDetection.searchedInstallPaths ?? []),
    kiroDetection.settingsPath,
    kiroDetection.profilesDir,
    kiroDetection.backupDir,
    kiroDetection.lastBackup?.backupPath
  ];

  return {
    ...kiroDetection,
    installPath: sanitizePathForShare(kiroDetection.installPath),
    searchedInstallPaths: (kiroDetection.searchedInstallPaths ?? []).map((value) => sanitizePathForShare(value)),
    detectionHint: sanitizeTextForShare(kiroDetection.detectionHint ?? "-", pathValues),
    settingsPath: sanitizePathForShare(kiroDetection.settingsPath),
    profilesDir: sanitizePathForShare(kiroDetection.profilesDir),
    backupDir: sanitizePathForShare(kiroDetection.backupDir),
    lastBackup: kiroDetection.lastBackup
      ? {
        ...kiroDetection.lastBackup,
        backupPath: sanitizePathForShare(kiroDetection.lastBackup.backupPath)
      }
      : kiroDetection.lastBackup
  };
}

function sanitizeStateForShare(state) {
  const kiroDetection = sanitizeKiroDetectionForShare(state.kiroDetection);
  return {
    ...state,
    kiroDetection,
    settings: {
      ...state.settings,
      lastAppliedKiroBackup: state.settings.lastAppliedKiroBackup
        ? {
          ...state.settings.lastAppliedKiroBackup,
          backupPath: sanitizePathForShare(state.settings.lastAppliedKiroBackup.backupPath)
        }
        : state.settings.lastAppliedKiroBackup
    }
  };
}

function deriveBootstrapState({ settings, kiroDetection, proxyStatus, diagnose }) {
  const selectedProvider = settings.providers.find((provider) => provider.id === settings.selectedProviderId)
    ?? settings.providers[0]
    ?? null;
  const testDone = settings.lastSuccessfulProviderTest?.providerId === selectedProvider?.id;
  const byokDone = settings.isByokEnabled && (diagnose?.localRegions.length ?? 0) > 0;
  const proxyDone = proxyStatus.state === "running";
  const steps = [
    {
      key: "detect-kiro",
      title: "检测 Kiro 安装",
      done: kiroDetection.installed,
      detail: kiroDetection.installed
        ? (kiroDetection.installPath ?? "已检测到")
        : (kiroDetection.detectionHint ?? "未检测到 Kiro 安装")
    },
    {
      key: "provider-test",
      title: "测试 Provider",
      done: Boolean(testDone),
      detail: testDone
        ? `${settings.lastSuccessfulProviderTest.modelId} / ${settings.lastSuccessfulProviderTest.at ?? "recent"}`
        : "先保存 Key 并完成一次 Provider 测试"
    },
    {
      key: "start-proxy",
      title: "启动本地代理",
      done: proxyDone,
      detail: proxyDone ? (proxyStatus.endpoint ?? "本地 endpoint 可用") : "代理尚未启动"
    },
    {
      key: "apply-byok",
      title: "应用 BYOK 路由",
      done: byokDone,
      detail: byokDone ? `已覆盖 ${(diagnose?.localRegions.length ?? 0)} 个 region` : "先应用路由并运行诊断"
    }
  ];

  const recommendedTab = !kiroDetection.installed
    ? "kiro"
    : !testDone
      ? "providers"
      : !proxyDone
        ? "status"
        : !byokDone
          ? "kiro"
          : "playground";

  return { steps, recommendedTab };
}

function formatDiagnosticsSummary({ settings, proxyStatus, kiroDetection, diagnose, recentLogs, readinessIssues = [] }) {
  const failure = summarizeRecentFailure(recentLogs);
  const primaryIssue = readinessIssues[0] ?? null;
  const launchAttempt = settings.runtime?.lastLaunchAttempt ?? null;
  const bootstrapAttempt = settings.runtime?.lastBootstrapAttempt ?? null;
  const desktopHealth = buildDesktopHealthSummary({
    bridgeStatus: {
      available: true,
      complete: true,
      missingMethods: [],
      presentMethodCount: 0,
      totalMethodCount: 0,
      summary: "Runtime export does not inspect renderer bridge",
      detail: "Support bundle focuses on build metadata, proxy state, and Kiro readiness from the desktop runtime.",
      tone: "success"
    },
    appMeta: null,
    proxyStatus,
    isByokEnabled: settings.isByokEnabled,
    kiroDetection,
    diagnose
  });
  const desktopHealthPrimaryAction = getDesktopHealthPrimaryAction(desktopHealth);
  const desktopHealthHeadline = formatDesktopHealthHeadline(desktopHealth);
  return [
    "Kiro++ diagnostics summary",
    `Support snapshot headline: ${desktopHealthHeadline}`,
    `BYOK: ${settings.isByokEnabled ? "enabled" : "disabled"}`,
    `Proxy: ${proxyStatus.state}${proxyStatus.endpoint ? ` (${proxyStatus.endpoint})` : ""}`,
    `Kiro installed: ${kiroDetection.installed ? "yes" : "no"}`,
    `Kiro install path: ${kiroDetection.installPath ?? "-"}`,
    `Kiro detection hint: ${kiroDetection.detectionHint ?? "-"}`,
    `Kiro search paths checked: ${(kiroDetection.searchedInstallPaths ?? []).length}`,
    `Local regions: ${(diagnose?.localRegions ?? []).join(", ") || "-"}`,
    `Unsupported operations: ${(diagnose?.unsupportedOperationsSeen ?? []).join(", ") || "-"}`,
    `Last provider test: ${settings.lastSuccessfulProviderTest?.modelId ?? "-"}`,
    `Last applied backup: ${settings.lastAppliedKiroBackup?.backupPath ?? "-"}`,
    `Last bootstrap attempt: ${bootstrapAttempt ? `${bootstrapAttempt.status} / ${bootstrapAttempt.step}` : "-"}`,
    `Last launch attempt: ${launchAttempt ? `${launchAttempt.status} / ${launchAttempt.step}` : "-"}`,
    `Readiness issues: ${readinessIssues.length}`,
    `Primary issue: ${primaryIssue ? `${primaryIssue.title} -> ${primaryIssue.action}` : "-"}`,
    `Recommended next action: ${desktopHealthPrimaryAction.title} -> ${desktopHealthPrimaryAction.actionLabel}`,
    ...readinessIssues.map((issue, index) => `Issue ${index + 1}: [${issue.severity}] ${issue.title} / ${issue.action}`),
    formatDesktopHealthSummary(desktopHealth),
    failure
      ? `Latest failure: ${failure.operation} / HTTP ${failure.status} / requestId ${failure.requestId ?? "-"}` 
      : "Latest failure: -"
  ].join("\n");
}

function describeProvider(profile) {
  return profile?.label ?? profile?.id ?? "Provider";
}

async function deleteSecretIfSupported(secretStore, account) {
  if (!account || typeof secretStore?.delete !== "function") {
    return;
  }
  await secretStore.delete(account);
}

function getProviderModelIssue(profile, modelId = profile?.defaultModel) {
  if (!profile) {
    return "未找到可用 Provider，请先在左侧保存一个 Provider 配置。";
  }
  if (!modelId) {
    return `${describeProvider(profile)} 尚未设置默认模型，请先保存 models[] 和 defaultModel。`;
  }
  const modelIds = new Set((profile.models ?? []).map((model) => model.id).filter(Boolean));
  if (modelIds.size === 0) {
    return `${describeProvider(profile)} 尚未配置 models[]，请先拉取或填写模型列表。`;
  }
  if (!modelIds.has(modelId)) {
    return `${describeProvider(profile)} 的模型 ${modelId} 不在 models[] 列表中，请先同步模型配置。`;
  }
  return null;
}

function deriveReadinessIssues({
  settings,
  selectedProvider,
  selectedProviderHasApiKey,
  providerSecretError,
  kiroDetection,
  proxyStatus,
  diagnose
}) {
  const issues = [];
  const modelIssue = getProviderModelIssue(selectedProvider);
  const providerTestDone = settings.lastSuccessfulProviderTest?.providerId === selectedProvider?.id;
  const byokCovered = (diagnose?.localRegions.length ?? 0) > 0;

  if (modelIssue) {
    issues.push({
      key: "provider-models",
      severity: "error",
      title: "Provider 模型配置不完整",
      detail: modelIssue,
      focus: "providers",
      action: "修正模型配置"
    });
  }

  if (providerSecretError) {
    issues.push({
      key: "provider-secret-store",
      severity: "error",
      title: "无法读取 Provider 密钥",
      detail: providerSecretError.message ?? String(providerSecretError),
      focus: "providers",
      action: "重新保存 API Key"
    });
  } else if (!selectedProviderHasApiKey) {
    issues.push({
      key: "provider-api-key",
      severity: "error",
      title: "Provider API Key 尚未保存",
      detail: `${describeProvider(selectedProvider)} 还没有可用的 API Key。`,
      focus: "providers",
      action: "填写并保存 Key"
    });
  }

  if (!providerTestDone) {
    issues.push({
      key: "provider-test",
      severity: "warning",
      title: "还没有做最小 Provider 验证",
      detail: "先做一次最小测试，确认这个 Key、Base URL 和模型组合能正常返回。",
      focus: "providers",
      action: "测试 Provider"
    });
  }

  if (!kiroDetection.installed || !kiroDetection.installPath) {
    issues.push({
      key: "kiro-install",
      severity: "error",
      title: "未检测到 Kiro 安装",
      detail: kiroDetection.detectionHint ?? "请先确认 Kiro 是否已安装。",
      focus: "kiro",
      action: "检查 Kiro 安装"
    });
  }

  if (proxyStatus.state !== "running") {
    issues.push({
      key: "proxy-not-running",
      severity: "warning",
      title: "本地代理尚未启动",
      detail: "Kiro 还不能走本地 BYOK 路由，请先启动或重启代理。",
      focus: "kiro",
      action: "启动本地代理"
    });
  }

  if (diagnose?.autoModeBlocksByok || diagnose?.profileAutoModeBlocksByok) {
    issues.push({
      key: "kiro-auto-mode",
      severity: "error",
      title: "Kiro 仍在使用 Auto 模式",
      detail: "某些设置或 profile 仍会覆盖 BYOK 路由，请先应用配置后重新诊断。",
      focus: "kiro",
      action: "重新应用并诊断"
    });
  }

  if (settings.isByokEnabled && !byokCovered) {
    issues.push({
      key: "kiro-no-local-region",
      severity: "warning",
      title: "BYOK 已启用但诊断尚未闭环",
      detail: "当前诊断没有看到本地 endpoint region，请重新运行诊断并检查日志。",
      focus: "logs",
      action: "刷新诊断"
    });
  } else if (!settings.isByokEnabled) {
    issues.push({
      key: "kiro-byok-disabled",
      severity: "warning",
      title: "BYOK 还没有启用",
      detail: "要让 Kiro 真正走本地路由，还需要应用配置或打开 BYOK 开关。",
      focus: "kiro",
      action: "启用 BYOK"
    });
  }

  if ((diagnose?.unsupportedOperationsSeen.length ?? 0) > 0) {
    issues.push({
      key: "unsupported-operations",
      severity: "warning",
      title: "最近出现未兼容操作",
      detail: `最近捕获到 ${(diagnose?.unsupportedOperationsSeen ?? []).join(", ")}，建议先看日志和诊断摘要。`,
      focus: "logs",
      action: "查看日志"
    });
  }

  return issues;
}

export class DesktopRuntime {
  constructor({
    settingsStore,
    secretStore,
    providerCatalog,
    proxyService,
    kiroService,
    logService,
    diagnosticsExportDir = join(process.cwd(), ".kiro-plus-plus", "exports"),
    zipBundle = null,
    now = () => new Date()
  }) {
    this.settingsStore = settingsStore;
    this.secretStore = secretStore;
    this.providerCatalog = providerCatalog;
    this.proxyService = proxyService;
    this.kiroService = kiroService;
    this.logService = logService;
    this.diagnosticsExportDir = diagnosticsExportDir;
    this.zipBundle = zipBundle ?? defaultZipBundle;
    this.now = now;
    this.bootstrapPromise = null;
  }

  async getSelectedProvider(settings) {
    return settings.providers.find((provider) => provider.id === settings.selectedProviderId) ?? settings.providers[0];
  }

  ensureProviderModel(profile, modelId = profile?.defaultModel) {
    const issue = getProviderModelIssue(profile, modelId);
    if (issue) {
      throw new Error(issue);
    }
    return modelId;
  }

  async getProviderApiKey(providerId) {
    return this.secretStore.get(`provider:${providerId}:apiKey`);
  }

  async getReadyProvider(settings) {
    const provider = await this.getSelectedProvider(settings);
    this.ensureProviderModel(provider);
    return provider;
  }

  async getProviderApiKeyOrThrow(profile, providedApiKey) {
    const apiKey = providedApiKey ?? await this.getProviderApiKey(profile.id);
    if (!apiKey) {
      throw new Error(`${describeProvider(profile)} 尚未保存 API Key，请先在左侧填写并保存。`);
    }
    return apiKey;
  }

  async detectKiroOrThrow() {
    const detection = await this.kiroService.detectKiro();
    if (!detection.installed || !detection.installPath) {
      throw new Error(detection.detectionHint ?? "未检测到 Kiro 安装，请先确认安装路径。");
    }
    return detection;
  }

  async saveSettings(nextSettings) {
    return this.settingsStore.save(normalizeAppSettings(nextSettings));
  }

  async saveLastExportBundle(bundle) {
    const settings = await this.settingsStore.load();
    const previousHistory = settings.runtime?.exportHistory ?? [];
    const nextHistory = [
      bundle,
      ...previousHistory.filter((item) => item.bundleName !== bundle.bundleName)
    ].slice(0, 5);
    await this.saveSettings({
      ...settings,
      runtime: {
      ...settings.runtime,
        exportHistory: nextHistory,
        lastExportBundle: bundle,
        selectedExportBundleName: bundle.bundleName
      }
    });
  }

  async saveLaunchAttempt(attempt) {
    const settings = await this.settingsStore.load();
    await this.saveSettings({
      ...settings,
      runtime: {
        ...settings.runtime,
        lastLaunchAttempt: attempt
      }
    });
  }

  async saveBootstrapAttempt(attempt) {
    const settings = await this.settingsStore.load();
    await this.saveSettings({
      ...settings,
      runtime: {
        ...settings.runtime,
        lastBootstrapAttempt: attempt
      }
    });
  }

  async selectExportBundle(bundleName) {
    const settings = await this.settingsStore.load();
    const exportHistory = settings.runtime?.exportHistory ?? [];
    const selectedBundle = exportHistory.find((item) => item.bundleName === bundleName);
    if (!selectedBundle) {
      throw new Error(`未找到支持包：${bundleName}`);
    }
    await this.saveSettings({
      ...settings,
      runtime: {
        ...settings.runtime,
        selectedExportBundleName: bundleName
      }
    });
    return this.getState();
  }

  async deleteExportBundle(bundleName) {
    const settings = await this.settingsStore.load();
    const exportHistory = settings.runtime?.exportHistory ?? [];
    const nextHistory = exportHistory.filter((item) => item.bundleName !== bundleName);
    if (nextHistory.length === exportHistory.length) {
      throw new Error(`未找到支持包：${bundleName}`);
    }
    const currentSelected = settings.runtime?.selectedExportBundleName ?? null;
    const nextSelected = currentSelected === bundleName
      ? (nextHistory[0]?.bundleName ?? null)
      : currentSelected;
    const nextLastExportBundle = nextHistory.find((item) => item.bundleName === nextSelected)
      ?? nextHistory[0]
      ?? null;

    await this.saveSettings({
      ...settings,
      runtime: {
        ...settings.runtime,
        exportHistory: nextHistory,
        lastExportBundle: nextLastExportBundle,
        selectedExportBundleName: nextSelected ?? nextLastExportBundle?.bundleName ?? null
      }
    });
    return this.getState();
  }

  async getState() {
    const settings = await this.settingsStore.load();
    const selectedProvider = await this.getSelectedProvider(settings);
    let selectedProviderHasApiKey = false;
    let providerSecretError = null;
    if (selectedProvider) {
      try {
        selectedProviderHasApiKey = Boolean(await this.getProviderApiKey(selectedProvider.id));
      } catch (error) {
        providerSecretError = error;
      }
    }
    const [kiroDetection, recentLogs, diagnose] = await Promise.all([
      this.kiroService.detectKiro(),
      this.logService.tailRequests(10),
      this.kiroService.diagnose().catch(() => null)
    ]);
    const proxyStatus = this.proxyService.getStatus();
    const bootstrap = deriveBootstrapState({
      settings,
      kiroDetection,
      proxyStatus,
      diagnose
    });
    const readinessIssues = deriveReadinessIssues({
      settings,
      selectedProvider,
      selectedProviderHasApiKey,
      providerSecretError,
      kiroDetection,
      proxyStatus,
      diagnose
    });

    const exportHistory = settings.runtime?.exportHistory ?? [];
    const selectedExportBundleName = settings.runtime?.selectedExportBundleName ?? null;
    const selectedBundle = exportHistory.find((item) => item.bundleName === selectedExportBundleName)
      ?? settings.runtime?.lastExportBundle
      ?? null;

    return {
      settings,
      proxyStatus,
      kiroDetection,
      diagnose,
      recentLogs,
      bootstrap,
      readinessIssues,
      lastSuccessfulProviderTest: settings.lastSuccessfulProviderTest,
      lastAppliedKiroBackup: settings.lastAppliedKiroBackup,
      exportHistory,
      lastExportBundle: selectedBundle,
      lastLaunchAttempt: settings.runtime?.lastLaunchAttempt ?? null,
      lastBootstrapAttempt: settings.runtime?.lastBootstrapAttempt ?? null
    };
  }

  async bootstrap() {
    if (!this.bootstrapPromise) {
      this.bootstrapPromise = this.runBootstrap()
        .finally(() => {
          this.bootstrapPromise = null;
        });
    }
    return this.bootstrapPromise;
  }

  async runBootstrap() {
    const settings = await this.settingsStore.load();
    if (!settings.kiro.autoApplyOnLaunch) {
      await this.saveBootstrapAttempt({
        startedAt: this.now().toISOString(),
        finishedAt: this.now().toISOString(),
        status: "skipped",
        step: "bootstrap-disabled",
        detail: "启动时自动应用未启用，已跳过预热。",
        endpoint: this.proxyService.getStatus().endpoint ?? null,
        installPath: null,
        error: null
      });
      return this.getState();
    }

    const startedAt = this.now().toISOString();
    try {
      await this.saveBootstrapAttempt({
        startedAt,
        finishedAt: null,
        status: "running",
        step: "bootstrap-start",
        detail: "正在执行启动预热。",
        endpoint: this.proxyService.getStatus().endpoint ?? null,
        installPath: null,
        error: null
      });
      const result = await this.ensureProxyAndRouting();
      await this.saveBootstrapAttempt({
        startedAt,
        finishedAt: this.now().toISOString(),
        status: "success",
        step: result.step,
        detail: result.detail,
        endpoint: result.endpoint ?? this.proxyService.getStatus().endpoint ?? null,
        installPath: result.installPath ?? null,
        error: null
      });
    } catch (error) {
      await this.saveBootstrapAttempt({
        startedAt,
        finishedAt: this.now().toISOString(),
        status: "error",
        step: "bootstrap-failed",
        detail: "启动预热失败。",
        endpoint: this.proxyService.getStatus().endpoint ?? null,
        installPath: null,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    return this.getState();
  }

  async startProxy() {
    const settings = await this.settingsStore.load();
    const provider = await this.getReadyProvider(settings);
    const apiKey = await this.getProviderApiKeyOrThrow(provider);
    return this.proxyService.start({ settings, apiKey });
  }

  async stopProxy() {
    return this.proxyService.stop();
  }

  async restartProxy() {
    const settings = await this.settingsStore.load();
    const provider = await this.getReadyProvider(settings);
    const apiKey = await this.getProviderApiKeyOrThrow(provider);
    return this.proxyService.restart({ settings, apiKey });
  }

  async saveProvider({ profile, apiKey }) {
    const current = await this.settingsStore.load();
    const previousProviderId = current.selectedProviderId;
    const next = await this.saveSettings(withProvider(current, profile, previousProviderId));
    const previousSecretAccount = previousProviderId ? `provider:${previousProviderId}:apiKey` : null;
    const nextSecretAccount = `provider:${profile.id}:apiKey`;

    if (apiKey) {
      await this.secretStore.set(`provider:${profile.id}:apiKey`, apiKey);
      if (previousSecretAccount && previousSecretAccount !== nextSecretAccount) {
        await deleteSecretIfSupported(this.secretStore, previousSecretAccount);
      }
      return next;
    }

    if (previousProviderId && previousProviderId !== profile.id) {
      const previousApiKey = await this.getProviderApiKey(previousProviderId);
      if (previousApiKey) {
        await this.secretStore.set(nextSecretAccount, previousApiKey);
        await deleteSecretIfSupported(this.secretStore, previousSecretAccount);
      }
    }
    return next;
  }

  async testProvider(payload) {
    const modelId = this.ensureProviderModel(payload.profile, payload.modelId ?? payload.profile.defaultModel);
    const apiKey = await this.getProviderApiKeyOrThrow(payload.profile, payload.apiKey);
    const result = await this.providerCatalog.testProviderConnection({
      type: payload.profile.type,
      baseUrl: payload.profile.baseUrl,
      apiKey,
      modelId,
      prompt: payload.prompt ?? "ping"
    });
    const current = await this.settingsStore.load();
    await this.saveSettings({
      ...current,
      lastSuccessfulProviderTest: {
        providerId: payload.profile.id,
        modelId: result.modelId,
        at: new Date().toISOString(),
        latencyMs: result.latencyMs
      }
    });
    return result;
  }

  async fetchModels(payload) {
    const apiKey = await this.getProviderApiKeyOrThrow(payload.profile, payload.apiKey);
    return this.providerCatalog.fetchModels({
      type: payload.profile.type,
      baseUrl: payload.profile.baseUrl,
      apiKey
    });
  }

  async detectKiro() {
    return this.kiroService.detectKiro();
  }

  async applyRouting() {
    const settings = await this.settingsStore.load();
    const provider = await this.getReadyProvider(settings);
    await this.detectKiroOrThrow();
    const endpoint = this.proxyService.getStatus().endpoint
      ?? `http://127.0.0.1:${settings.kiro.defaultEndpointPort}`;
    const result = await this.kiroService.applyRouting({
      endpoint,
      agentModelId: provider.defaultModel
    });
    await this.saveSettings({
      ...settings,
      isByokEnabled: true,
      lastAppliedKiroBackup: {
        backupPath: result.backupPath ?? null,
        at: new Date().toISOString()
      }
    });
    return this.kiroService.diagnose();
  }

  async diagnoseKiro() {
    return this.kiroService.diagnose();
  }

  async restoreKiro() {
    const result = await this.kiroService.restoreLatestBackup();
    const settings = await this.settingsStore.load();
    await this.saveSettings({
      ...settings,
      isByokEnabled: false,
      lastAppliedKiroBackup: {
        backupPath: result.backupPath ?? null,
        at: new Date().toISOString()
      }
    });
    return result;
  }

  async setByokEnabled(enabled) {
    return enabled ? this.applyRouting() : this.restoreKiro();
  }

  async setAutoApplyOnLaunch(enabled) {
    const settings = await this.settingsStore.load();
    await this.saveSettings({
      ...settings,
      kiro: {
        ...settings.kiro,
        autoApplyOnLaunch: Boolean(enabled)
      }
    });
    return this.getState();
  }

  async listLogs(filters) {
    return this.logService.listRequests(filters);
  }

  async exportDiagnostics() {
    return formatDiagnosticsSummary(sanitizeStateForShare(await this.getState()));
  }

  async exportDiagnosticsToFile() {
    const state = await this.getState();
    const sharedState = sanitizeStateForShare(state);
    const text = formatDiagnosticsSummary(sharedState);
    const fileText = [text, "", formatRecentRequestSnapshot(state.recentLogs)].join("\n");
    const latestFailure = toDiagnosticsLogSnapshot(summarizeRecentFailure(state.recentLogs));
    const latestSuccess = toDiagnosticsLogSnapshot(summarizeRecentSuccess(state.recentLogs));
    const desktopHealth = buildDesktopHealthSummary({
      bridgeStatus: {
        available: true,
        complete: true,
        missingMethods: [],
        presentMethodCount: 0,
        totalMethodCount: 0,
        summary: "Runtime export does not inspect renderer bridge",
        detail: "Support bundle focuses on build metadata, proxy state, and Kiro readiness from the desktop runtime.",
        tone: "success"
      },
      appMeta: null,
      proxyStatus: sharedState.proxyStatus,
      isByokEnabled: sharedState.settings.isByokEnabled,
      kiroDetection: {
        installed: sharedState.kiroDetection.installed,
        detectionHint: sharedState.kiroDetection.detectionHint
      },
      diagnose: sharedState.diagnose
    });
    const desktopHealthPrimaryAction = getDesktopHealthPrimaryAction(desktopHealth);
    const desktopHealthHeadline = formatDesktopHealthHeadline(desktopHealth);
    const exportedAt = this.now().toISOString();
    const stamp = exportedAt.replace(/[:.]/g, "-");
    const bundleName = `kiro-plus-plus-diagnostics-${stamp}`;
    const bundleDir = join(this.diagnosticsExportDir, bundleName);
    const readmePath = join(bundleDir, "README.txt");
    const summaryPath = join(bundleDir, "summary.txt");
    const jsonPath = join(bundleDir, "snapshot.json");
    const requestsPath = join(bundleDir, "recent-requests.json");
    const manifestPath = join(bundleDir, "manifest.json");
    await mkdir(bundleDir, { recursive: true });
    await writeFile(readmePath, `${formatSupportBundleReadme()}\n`, "utf8");
    await writeFile(summaryPath, `${fileText}\n`, "utf8");
    await writeFile(jsonPath, `${JSON.stringify({
      exportedAt,
      summary: text,
      desktopHealthHeadline,
      desktopHealth,
      desktopHealthPrimaryAction,
      proxyStatus: sharedState.proxyStatus,
      kiroDetection: sharedState.kiroDetection,
      diagnose: sharedState.diagnose,
      readinessIssues: sharedState.readinessIssues,
      recentLogs: state.recentLogs
    }, null, 2)}\n`, "utf8");
    await writeFile(requestsPath, `${JSON.stringify(state.recentLogs, null, 2)}\n`, "utf8");
    await writeFile(manifestPath, `${JSON.stringify({
      exportedAt,
      bundleName,
      desktopHealthHeadline,
      desktopHealth: {
        severity: desktopHealth.severity,
        summary: desktopHealth.summary,
        itemCount: desktopHealth.items.length
      },
      desktopHealthPrimaryAction,
      files: {
        readme: "README.txt",
        summary: "summary.txt",
        snapshot: "snapshot.json",
        requests: "recent-requests.json"
      }
    }, null, 2)}\n`, "utf8");
    const bundle = {
      exportedAt,
      bundleName,
      bundleDir,
      readmePath,
      summaryPath,
      jsonPath,
      requestsPath,
      manifestPath,
      headline: desktopHealthHeadline,
      recommendedAction: desktopHealthPrimaryAction,
      latestFailure,
      latestSuccess,
      text: fileText
    };
    await this.saveLastExportBundle(bundle);
    return bundle;
  }

  async exportDiagnosticsZip() {
    const bundle = await this.exportDiagnosticsToFile();
    const zipPath = `${bundle.bundleDir}.zip`;
    await this.zipBundle({
      bundleDir: bundle.bundleDir,
      zipPath
    });
    const result = {
      ...bundle,
      zipPath
    };
    await this.saveLastExportBundle(result);
    return result;
  }

  async clearDiagnosticsHistory() {
    const settings = await this.settingsStore.load();
    await this.saveSettings({
      ...settings,
      runtime: {
        ...settings.runtime,
        exportHistory: [],
        lastExportBundle: null,
        selectedExportBundleName: null
      }
    });
    return this.getState();
  }

  async sendPlayground(payload) {
    const settings = await this.settingsStore.load();
    const provider = settings.providers.find((item) => item.id === payload.providerId);
    if (!provider) throw new Error(`未找到 Provider：${payload.providerId}`);
    this.ensureProviderModel(provider, payload.modelId);
    const apiKey = await this.getProviderApiKeyOrThrow(provider);
    return this.providerCatalog.testProviderConnection({
      type: provider.type,
      baseUrl: provider.baseUrl,
      apiKey,
      modelId: payload.modelId,
      prompt: payload.prompt
    });
  }

  async launchKiroWithProxy() {
    const startedAt = this.now().toISOString();
    let detection = null;
    let endpoint = null;
    let currentStep = "detect-kiro";

    try {
      detection = await this.detectKiroOrThrow();
      await this.saveLaunchAttempt({
        startedAt,
        finishedAt: null,
        status: "running",
        step: currentStep,
        detail: "已检测到 Kiro，准备检查代理与路由。",
        endpoint: null,
        installPath: detection.installPath,
        error: null
      });

      if (this.proxyService.getStatus().state !== "running") {
        currentStep = "start-proxy";
        await this.saveLaunchAttempt({
          startedAt,
          finishedAt: null,
          status: "running",
          step: currentStep,
          detail: "正在启动本地代理。",
          endpoint: null,
          installPath: detection.installPath,
          error: null
        });
        const proxy = await this.startProxy();
        endpoint = proxy?.endpoint ?? null;
      } else {
        endpoint = this.proxyService.getStatus().endpoint ?? null;
      }

      currentStep = "apply-routing";
      await this.saveLaunchAttempt({
        startedAt,
        finishedAt: null,
        status: "running",
        step: currentStep,
        detail: "正在应用 BYOK 路由。",
        endpoint,
        installPath: detection.installPath,
        error: null
      });
      await this.setByokEnabled(true);

      detection = await this.detectKiroOrThrow();
      currentStep = "launch-kiro";
      await this.saveLaunchAttempt({
        startedAt,
        finishedAt: null,
        status: "running",
        step: currentStep,
        detail: "正在拉起 Kiro 应用。",
        endpoint: this.proxyService.getStatus().endpoint ?? endpoint,
        installPath: detection.installPath,
        error: null
      });
      const result = await this.kiroService.launchKiro(detection.installPath);
      await this.saveLaunchAttempt({
        startedAt,
        finishedAt: this.now().toISOString(),
        status: "success",
        step: currentStep,
        detail: "Kiro 启动指令已发出。",
        endpoint: this.proxyService.getStatus().endpoint ?? endpoint,
        installPath: detection.installPath,
        error: null
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.saveLaunchAttempt({
        startedAt,
        finishedAt: this.now().toISOString(),
        status: "error",
        step: currentStep,
        detail: "Launch Kiro with Kiro++ 失败。",
        endpoint: this.proxyService.getStatus().endpoint ?? endpoint,
        installPath: detection?.installPath ?? null,
        error: message
      });
      throw error;
    }
  }

  async ensureProxyAndRouting() {
    const detection = await this.detectKiroOrThrow();
    if (this.proxyService.getStatus().state !== "running") {
      await this.startProxy();
    }
    const settings = await this.settingsStore.load();
    if (!settings.isByokEnabled) {
      await this.applyRouting();
      return {
        step: "apply-routing",
        detail: "已自动启动代理并应用 BYOK 路由。",
        endpoint: this.proxyService.getStatus().endpoint ?? null,
        installPath: detection.installPath
      };
    }
    const diagnose = await this.kiroService.diagnose().catch(() => null);
    if ((diagnose?.localRegions.length ?? 0) === 0) {
      await this.applyRouting();
      return {
        step: "apply-routing",
        detail: "已重新应用 BYOK 路由以恢复本地 endpoint 覆盖。",
        endpoint: this.proxyService.getStatus().endpoint ?? null,
        installPath: detection.installPath
      };
    }
    return {
      step: "bootstrap-ready",
      detail: "代理与 BYOK 路由已处于可用状态，无需重复应用。",
      endpoint: this.proxyService.getStatus().endpoint ?? null,
      installPath: detection.installPath
    };
  }
}

function defaultZipBundle({ bundleDir, zipPath }) {
  return new Promise((resolve, reject) => {
    const command = [
      "-NoProfile",
      "-Command",
      `Compress-Archive -LiteralPath '${bundleDir.replace(/'/g, "''")}' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`
    ];

    const child = spawn("powershell.exe", command, {
      stdio: "ignore",
      windowsHide: true
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Compress-Archive failed with exit code ${code}`));
    });
  });
}
