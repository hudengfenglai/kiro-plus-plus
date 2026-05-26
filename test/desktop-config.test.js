import test from "node:test";
import assert from "node:assert/strict";

import {
  PROVIDER_PRESETS,
  buildRuntimeConfigFromAppSettings,
  normalizeAppSettings
} from "../src/config.js";

test("normalizeAppSettings keeps multiple provider models and defaults", () => {
  const settings = normalizeAppSettings({
    providers: [
      {
        id: "deepseek",
        type: "openai-compatible",
        label: "DeepSeek",
        baseUrl: "https://api.deepseek.com/",
        defaultModel: "deepseek-v4-pro",
        models: ["deepseek-v4-pro", "deepseek-v4-flash"]
      }
    ],
    kiro: {
      autoApplyOnLaunch: true,
      defaultEndpointPort: 43119
    }
  });

  assert.equal(settings.providers[0].baseUrl, "https://api.deepseek.com");
  assert.deepEqual(settings.providers[0].models.map((model) => model.id), [
    "deepseek-v4-pro",
    "deepseek-v4-flash"
  ]);
  assert.equal(settings.kiro.defaultEndpointPort, 43119);
});

test("buildRuntimeConfigFromAppSettings maps selected provider to runtime config", async () => {
  const runtimeConfig = await buildRuntimeConfigFromAppSettings({
    settings: normalizeAppSettings({
      selectedProviderId: "deepseek",
      providers: [
        {
          id: "deepseek",
          type: "openai-compatible",
          label: "DeepSeek",
          baseUrl: "https://api.deepseek.com",
          defaultModel: "deepseek-v4-pro",
          models: ["deepseek-v4-pro", "deepseek-v4-flash"]
        }
      ],
      logging: {
        captureHeaders: true,
        captureBodies: false
      },
      kiro: {
        defaultEndpointPort: 43119
      }
    }),
    apiKey: "sk-test"
  });

  assert.equal(runtimeConfig.defaultProvider, "openai-compatible");
  assert.equal(runtimeConfig.providers["openai-compatible"].apiKey, "sk-test");
  assert.equal(runtimeConfig.providers["openai-compatible"].baseUrl, "https://api.deepseek.com");
  assert.deepEqual(runtimeConfig.models.map((model) => model.id), [
    "deepseek-v4-pro",
    "deepseek-v4-flash"
  ]);
});

test("PROVIDER_PRESETS expose common domestic openai-compatible providers", () => {
  assert.equal(PROVIDER_PRESETS.deepseek.baseUrl, "https://api.deepseek.com");
  assert.equal(PROVIDER_PRESETS.dashscope.type, "openai-compatible");
  assert.match(PROVIDER_PRESETS.siliconflow.models[0], /Qwen/);
});
