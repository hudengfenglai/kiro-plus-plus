import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { normalizeAppSettings } from "../../src/config.js";

function withProvider(settings, profile) {
  const providers = settings.providers.filter((item) => item.id !== profile.id);
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
    "- Share this bundle only when you are comfortable revealing model ids, endpoint metadata, and request timing.",
    "- This bundle is generated locally by Kiro++."
  ].join("\n");
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
  return [
    "Kiro++ diagnostics summary",
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
    `Readiness issues: ${readinessIssues.length}`,
    `Primary issue: ${primaryIssue ? `${primaryIssue.title} -> ${primaryIssue.action}` : "-"}`,
    ...readinessIssues.map((issue, index) => `Issue ${index + 1}: [${issue.severity}] ${issue.title} / ${issue.action}`),
    failure
      ? `Latest failure: ${failure.operation} / HTTP ${failure.status} / requestId ${failure.requestId ?? "-"}`
      : "Latest failure: -"
  ].join("\n");
}

function describeProvider(profile) {
  return profile?.label ?? profile?.id ?? "Provider";
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
    now = () => new Date()
  }) {
    this.settingsStore = settingsStore;
    this.secretStore = secretStore;
    this.providerCatalog = providerCatalog;
    this.proxyService = proxyService;
    this.kiroService = kiroService;
    this.logService = logService;
    this.diagnosticsExportDir = diagnosticsExportDir;
    this.now = now;
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

    return {
      settings,
      proxyStatus,
      kiroDetection,
      diagnose,
      recentLogs,
      bootstrap,
      readinessIssues,
      lastSuccessfulProviderTest: settings.lastSuccessfulProviderTest,
      lastAppliedKiroBackup: settings.lastAppliedKiroBackup
    };
  }

  async bootstrap() {
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
    const next = await this.saveSettings(withProvider(current, profile));
    if (apiKey) {
      await this.secretStore.set(`provider:${profile.id}:apiKey`, apiKey);
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

  async listLogs(filters) {
    return this.logService.listRequests(filters);
  }

  async exportDiagnostics() {
    return formatDiagnosticsSummary(await this.getState());
  }

  async exportDiagnosticsToFile() {
    const state = await this.getState();
    const text = formatDiagnosticsSummary(state);
    const fileText = [text, "", formatRecentRequestSnapshot(state.recentLogs)].join("\n");
    const exportedAt = this.now().toISOString();
    const stamp = exportedAt.replace(/[:.]/g, "-");
    const bundleDir = join(this.diagnosticsExportDir, `kiro-plus-plus-diagnostics-${stamp}`);
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
      proxyStatus: state.proxyStatus,
      kiroDetection: state.kiroDetection,
      diagnose: state.diagnose,
      readinessIssues: state.readinessIssues,
      recentLogs: state.recentLogs
    }, null, 2)}\n`, "utf8");
    await writeFile(requestsPath, `${JSON.stringify(state.recentLogs, null, 2)}\n`, "utf8");
    await writeFile(manifestPath, `${JSON.stringify({
      exportedAt,
      bundleDir,
      files: {
        readmePath,
        summaryPath,
        jsonPath,
        requestsPath
      }
    }, null, 2)}\n`, "utf8");
    return { bundleDir, readmePath, summaryPath, jsonPath, requestsPath, manifestPath, text: fileText };
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
    await this.detectKiroOrThrow();
    if (this.proxyService.getStatus().state !== "running") {
      await this.startProxy();
    }
    await this.setByokEnabled(true);
    const detection = await this.detectKiroOrThrow();
    return this.kiroService.launchKiro(detection.installPath);
  }
}
