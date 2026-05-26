import type { ProviderProfile } from "./types";

type ProviderPresetShape = {
  id: string;
  type: ProviderProfile["type"];
  label: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
};

export const PROVIDER_PRESETS: Record<string, ProviderPresetShape> = {
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

export function buildProviderProfileFromPreset(presetId: string): ProviderProfile {
  const preset = PROVIDER_PRESETS[presetId];
  if (!preset) {
    throw new Error(`Unknown provider preset: ${presetId}`);
  }
  return {
    id: preset.id,
    providerPresetId: preset.id,
    type: preset.type,
    label: preset.label,
    baseUrl: preset.baseUrl,
    defaultModel: preset.defaultModel,
    models: preset.models.map((modelId) => ({
      id: modelId,
      name: modelId,
      description: "BYOK routed model",
      note: ""
    }))
  };
}
