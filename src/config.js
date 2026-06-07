import { access, readFile } from "node:fs/promises";

const DEFAULT_PORT = 43119;
const DEFAULT_MODEL = "gpt-4.1-mini";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_PROVIDER_ID = "default";
const DEFAULT_LOGGING = {
  captureHeaders: true,
  captureBodies: false
};
const DEFAULT_KIRO = {
  autoApplyOnLaunch: false,
  defaultEndpointPort: DEFAULT_PORT
};
const DEFAULT_LAST_SUCCESSFUL_PROVIDER_TEST = null;
const DEFAULT_LAST_APPLIED_KIRO_BACKUP = null;
const DEFAULT_LAST_EXPORT_BUNDLE = null;
const DEFAULT_EXPORT_HISTORY = [];
const MAX_EXPORT_HISTORY = 5;

function normalizeTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

export const PROVIDER_PRESETS = {
  deepseek: {
    id: "deepseek",
    type: "openai-compatible",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-v4-pro",
    models: ["deepseek-v4-pro", "deepseek-v4-flash"]
  },
  dashscope: {
    id: "dashscope",
    type: "openai-compatible",
    label: "DashScope / Qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    models: ["qwen-plus"]
  },
  moonshot: {
    id: "moonshot",
    type: "openai-compatible",
    label: "Moonshot / Kimi",
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "kimi-k2.5",
    models: ["kimi-k2.5"]
  },
  zhipu: {
    id: "zhipu",
    type: "openai-compatible",
    label: "Zhipu GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4.7",
    models: ["glm-4.7"]
  },
  siliconflow: {
    id: "siliconflow",
    type: "openai-compatible",
    label: "SiliconFlow",
    baseUrl: "https://api.siliconflow.cn/v1",
    defaultModel: "Qwen/Qwen3.5-35B-A3B",
    models: ["Qwen/Qwen3.5-35B-A3B"]
  }
};

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeBaseUrl(url) {
  return String(url ?? "").replace(/\/+$/, "");
}

function normalizeModelEntry(entry) {
  if (typeof entry === "string") {
    return {
      id: entry,
      name: entry,
      description: "BYOK routed model",
      maxInputTokens: 128000,
      note: ""
    };
  }

  return {
    id: String(entry?.id ?? entry?.modelId ?? ""),
    name: entry?.name ?? entry?.title ?? entry?.id ?? entry?.modelId ?? "",
    description: entry?.description ?? "BYOK routed model",
    maxInputTokens: parseInteger(entry?.maxInputTokens, 128000),
    note: entry?.note ?? ""
  };
}

function parseConfiguredModels(envModels, fileModels, fallbackModel) {
  if (Array.isArray(fileModels) && fileModels.length > 0) {
    return fileModels.map(normalizeModelEntry).filter((model) => model.id);
  }

  if (envModels) {
    return String(envModels)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map(normalizeModelEntry);
  }

  return [normalizeModelEntry(fallbackModel)];
}

function normalizeProviderProfile(profile = {}) {
  const models = Array.isArray(profile.models) && profile.models.length > 0
    ? profile.models.map(normalizeModelEntry).filter((model) => model.id)
    : [normalizeModelEntry(profile.defaultModel ?? profile.model ?? DEFAULT_MODEL)];
  const defaultModel = profile.defaultModel ?? models[0]?.id ?? DEFAULT_MODEL;

  return {
    id: String(profile.id ?? profile.label ?? DEFAULT_PROVIDER_ID),
    providerPresetId: profile.providerPresetId ?? null,
    type: profile.type ?? "openai-compatible",
    label: profile.label ?? profile.id ?? "Provider",
    baseUrl: normalizeBaseUrl(profile.baseUrl ?? DEFAULT_OPENAI_BASE_URL),
    defaultModel,
    models
  };
}

function normalizeProviderTestResult(value = DEFAULT_LAST_SUCCESSFUL_PROVIDER_TEST) {
  if (!value || typeof value !== "object") return null;
  if (!value.providerId || !value.modelId) return null;
  return {
    providerId: String(value.providerId),
    modelId: String(value.modelId),
    at: normalizeTimestamp(value.at),
    latencyMs: parseInteger(value.latencyMs, 0)
  };
}

function normalizeBackupMetadata(value = DEFAULT_LAST_APPLIED_KIRO_BACKUP) {
  if (!value || typeof value !== "object") return null;
  if (!value.backupPath) return null;
  return {
    backupPath: String(value.backupPath),
    at: normalizeTimestamp(value.at)
  };
}

function normalizeDiagnosticsExportBundle(value = DEFAULT_LAST_EXPORT_BUNDLE) {
  if (!value || typeof value !== "object") return null;
  if (!value.exportedAt || !value.bundleName || !value.bundleDir || !value.readmePath || !value.summaryPath || !value.jsonPath || !value.requestsPath || !value.manifestPath) {
    return null;
  }
  return {
    exportedAt: normalizeTimestamp(value.exportedAt),
    bundleName: String(value.bundleName),
    bundleDir: String(value.bundleDir),
    readmePath: String(value.readmePath),
    summaryPath: String(value.summaryPath),
    jsonPath: String(value.jsonPath),
    requestsPath: String(value.requestsPath),
    manifestPath: String(value.manifestPath),
    zipPath: value.zipPath ? String(value.zipPath) : undefined,
    text: String(value.text ?? "")
  };
}

function normalizeDiagnosticsExportHistory(value = DEFAULT_EXPORT_HISTORY) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(normalizeDiagnosticsExportBundle)
    .filter(Boolean)
    .slice(0, MAX_EXPORT_HISTORY);
}

function normalizeSelectedExportBundleName(value, exportHistory, lastExportBundle) {
  if (typeof value !== "string" || !value.trim()) {
    return lastExportBundle?.bundleName ?? null;
  }
  const bundleName = value.trim();
  const exists = exportHistory.some((item) => item.bundleName === bundleName);
  if (exists) {
    return bundleName;
  }
  return lastExportBundle?.bundleName ?? null;
}

export function buildProviderProfileFromPreset(presetId) {
  const preset = PROVIDER_PRESETS[presetId];
  if (!preset) {
    throw new Error(`Unknown provider preset: ${presetId}`);
  }
  return normalizeProviderProfile({
    ...preset,
    providerPresetId: preset.id,
    models: preset.models.map((modelId) => ({
      id: modelId,
      name: modelId,
      description: "BYOK routed model",
      note: ""
    }))
  });
}

export function normalizeAppSettings(input = {}) {
  const providers = (Array.isArray(input.providers) && input.providers.length > 0
    ? input.providers
    : [buildProviderProfileFromPreset("deepseek")]
  ).map(normalizeProviderProfile);

  const providerIds = new Set(providers.map((provider) => provider.id));
  const selectedProviderId = providerIds.has(input.selectedProviderId)
    ? input.selectedProviderId
    : providers[0]?.id ?? DEFAULT_PROVIDER_ID;
  const exportHistory = normalizeDiagnosticsExportHistory(
    input.runtime?.exportHistory
  );
  const lastExportBundle = normalizeDiagnosticsExportBundle(
    input.runtime?.lastExportBundle ?? input.lastExportBundle
  );

  return {
    selectedProviderId,
    isByokEnabled: input.isByokEnabled === true,
    lastSuccessfulProviderTest: normalizeProviderTestResult(input.lastSuccessfulProviderTest),
    lastAppliedKiroBackup: normalizeBackupMetadata(input.lastAppliedKiroBackup),
    providers,
    kiro: {
      ...DEFAULT_KIRO,
      ...input.kiro,
      defaultEndpointPort: parseInteger(
        input.kiro?.defaultEndpointPort ?? DEFAULT_KIRO.defaultEndpointPort,
        DEFAULT_PORT
      )
    },
    logging: {
      ...DEFAULT_LOGGING,
      ...input.logging
    },
    runtime: {
      exportHistory,
      lastExportBundle,
      selectedExportBundleName: normalizeSelectedExportBundleName(
        input.runtime?.selectedExportBundleName,
        exportHistory,
        lastExportBundle
      )
    }
  };
}

export async function buildRuntimeConfigFromAppSettings({ settings, apiKey }) {
  const normalized = normalizeAppSettings(settings);
  const activeProvider = normalized.providers.find((provider) => provider.id === normalized.selectedProviderId)
    ?? normalized.providers[0];
  const runtimeConfig = {
    server: {
      host: "127.0.0.1",
      port: normalized.kiro.defaultEndpointPort
    },
    defaultProvider: activeProvider.type,
    providers: {
      "openai-compatible": {
        type: "openai-compatible",
        apiKey: activeProvider.type === "openai-compatible" ? apiKey : undefined,
        baseUrl: activeProvider.baseUrl,
        model: activeProvider.defaultModel
      },
      anthropic: {
        type: "anthropic",
        apiKey: activeProvider.type === "anthropic" ? apiKey : undefined,
        baseUrl: activeProvider.baseUrl,
        model: activeProvider.defaultModel
      },
      gemini: {
        type: "gemini",
        apiKey: activeProvider.type === "gemini" ? apiKey : undefined,
        baseUrl: activeProvider.baseUrl,
        model: activeProvider.defaultModel
      }
    },
    models: activeProvider.models,
    logging: {
      requestBodies: normalized.logging.captureBodies,
      logHeaders: normalized.logging.captureHeaders
    }
  };

  return runtimeConfig;
}

export async function loadConfig({ env = process.env, configPath = "kiro-plus-plus.config.json" } = {}) {
  const fileConfig = await fileExists(configPath)
    ? JSON.parse(await readFile(configPath, "utf8"))
    : {};

  const providerType = env.KIRO_PLUS_PROVIDER ?? fileConfig.defaultProvider ?? "openai-compatible";
  const model = env.KIRO_PLUS_MODEL ?? fileConfig.model ?? DEFAULT_MODEL;
  const models = parseConfiguredModels(env.KIRO_PLUS_MODELS, fileConfig.models, model);
  const port = parseInteger(env.KIRO_PLUS_PORT ?? fileConfig.port, DEFAULT_PORT);
  const openAiBaseUrl = normalizeBaseUrl(
    env.KIRO_PLUS_OPENAI_BASE_URL ?? fileConfig.openAiBaseUrl ?? DEFAULT_OPENAI_BASE_URL
  );

  const config = {
    server: {
      host: env.KIRO_PLUS_HOST ?? fileConfig.host ?? "127.0.0.1",
      port
    },
    defaultProvider: providerType,
    providers: {
      "openai-compatible": {
        type: "openai-compatible",
        apiKey: env.KIRO_PLUS_OPENAI_API_KEY ?? fileConfig.openAiApiKey ?? env.OPENAI_API_KEY,
        baseUrl: openAiBaseUrl,
        model: models[0]?.id ?? model
      },
      anthropic: {
        type: "anthropic",
        apiKey: env.KIRO_PLUS_ANTHROPIC_API_KEY ?? fileConfig.anthropicApiKey ?? env.ANTHROPIC_API_KEY,
        baseUrl: normalizeBaseUrl(env.KIRO_PLUS_ANTHROPIC_BASE_URL ?? fileConfig.anthropicBaseUrl ?? "https://api.anthropic.com"),
        model: env.KIRO_PLUS_ANTHROPIC_MODEL ?? fileConfig.anthropicModel ?? models[0]?.id ?? "claude-3-5-sonnet-latest"
      },
      gemini: {
        type: "gemini",
        apiKey: env.KIRO_PLUS_GEMINI_API_KEY ?? fileConfig.geminiApiKey ?? env.GEMINI_API_KEY,
        baseUrl: normalizeBaseUrl(env.KIRO_PLUS_GEMINI_BASE_URL ?? fileConfig.geminiBaseUrl ?? "https://generativelanguage.googleapis.com/v1beta"),
        model: env.KIRO_PLUS_GEMINI_MODEL ?? fileConfig.geminiModel ?? models[0]?.id ?? "gemini-2.0-flash"
      }
    },
    models,
    logging: {
      requestBodies: env.KIRO_PLUS_LOG_BODIES === "1" || fileConfig.logBodies === true,
      logHeaders: env.KIRO_PLUS_LOG_HEADERS === "1" || fileConfig.logHeaders === true
    }
  };

  return config;
}
