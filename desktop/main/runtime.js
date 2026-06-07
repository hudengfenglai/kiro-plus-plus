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
      detail: kiroDetection.installed ? (kiroDetection.installPath ?? "已检测到") : "未检测到 Kiro 安装"
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

function formatDiagnosticsSummary({ settings, proxyStatus, kiroDetection, diagnose, recentLogs }) {
  const failure = summarizeRecentFailure(recentLogs);
  return [
    "Kiro++ diagnostics summary",
    `BYOK: ${settings.isByokEnabled ? "enabled" : "disabled"}`,
    `Proxy: ${proxyStatus.state}${proxyStatus.endpoint ? ` (${proxyStatus.endpoint})` : ""}`,
    `Kiro installed: ${kiroDetection.installed ? "yes" : "no"}`,
    `Local regions: ${(diagnose?.localRegions ?? []).join(", ") || "-"}`,
    `Unsupported operations: ${(diagnose?.unsupportedOperationsSeen ?? []).join(", ") || "-"}`,
    `Last provider test: ${settings.lastSuccessfulProviderTest?.modelId ?? "-"}`,
    `Last applied backup: ${settings.lastAppliedKiroBackup?.backupPath ?? "-"}`,
    failure
      ? `Latest failure: ${failure.operation} / HTTP ${failure.status} / requestId ${failure.requestId ?? "-"}`
      : "Latest failure: -"
  ].join("\n");
}

export class DesktopRuntime {
  constructor({
    settingsStore,
    secretStore,
    providerCatalog,
    proxyService,
    kiroService,
    logService
  }) {
    this.settingsStore = settingsStore;
    this.secretStore = secretStore;
    this.providerCatalog = providerCatalog;
    this.proxyService = proxyService;
    this.kiroService = kiroService;
    this.logService = logService;
  }

  async getSelectedProvider(settings) {
    return settings.providers.find((provider) => provider.id === settings.selectedProviderId) ?? settings.providers[0];
  }

  async getProviderApiKey(providerId) {
    return this.secretStore.get(`provider:${providerId}:apiKey`);
  }

  async saveSettings(nextSettings) {
    return this.settingsStore.save(normalizeAppSettings(nextSettings));
  }

  async getState() {
    const settings = await this.settingsStore.load();
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

    return {
      settings,
      proxyStatus,
      kiroDetection,
      diagnose,
      recentLogs,
      bootstrap,
      lastSuccessfulProviderTest: settings.lastSuccessfulProviderTest,
      lastAppliedKiroBackup: settings.lastAppliedKiroBackup
    };
  }

  async bootstrap() {
    return this.getState();
  }

  async startProxy() {
    const settings = await this.settingsStore.load();
    const provider = await this.getSelectedProvider(settings);
    const apiKey = await this.getProviderApiKey(provider.id);
    if (!apiKey) throw new Error(`Missing API key for provider: ${provider.label}`);
    return this.proxyService.start({ settings, apiKey });
  }

  async stopProxy() {
    return this.proxyService.stop();
  }

  async restartProxy() {
    const settings = await this.settingsStore.load();
    const provider = await this.getSelectedProvider(settings);
    const apiKey = await this.getProviderApiKey(provider.id);
    if (!apiKey) throw new Error(`Missing API key for provider: ${provider.label}`);
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
    const apiKey = payload.apiKey ?? await this.getProviderApiKey(payload.profile.id);
    if (!apiKey) throw new Error(`Missing API key for provider: ${payload.profile.label}`);
    const result = await this.providerCatalog.testProviderConnection({
      type: payload.profile.type,
      baseUrl: payload.profile.baseUrl,
      apiKey,
      modelId: payload.modelId ?? payload.profile.defaultModel,
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
    const apiKey = payload.apiKey ?? await this.getProviderApiKey(payload.profile.id);
    if (!apiKey) throw new Error(`Missing API key for provider: ${payload.profile.label}`);
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
    const provider = await this.getSelectedProvider(settings);
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

  async sendPlayground(payload) {
    const settings = await this.settingsStore.load();
    const provider = settings.providers.find((item) => item.id === payload.providerId);
    if (!provider) throw new Error(`Unknown provider: ${payload.providerId}`);
    const apiKey = await this.getProviderApiKey(provider.id);
    if (!apiKey) throw new Error(`Missing API key for provider: ${provider.label}`);
    return this.providerCatalog.testProviderConnection({
      type: provider.type,
      baseUrl: provider.baseUrl,
      apiKey,
      modelId: payload.modelId,
      prompt: payload.prompt
    });
  }

  async launchKiroWithProxy() {
    if (this.proxyService.getStatus().state !== "running") {
      await this.startProxy();
    }
    await this.setByokEnabled(true);
    const detection = await this.kiroService.detectKiro();
    if (!detection.installed || !detection.installPath) {
      throw new Error("Kiro is not installed or install path is unavailable");
    }
    return this.kiroService.launchKiro(detection.installPath);
  }
}
