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

test("normalizeAppSettings preserves last exported support bundle metadata", () => {
  const settings = normalizeAppSettings({
    runtime: {
      exportHistory: [
        {
          exportedAt: "2026-06-08T10:25:30.000Z",
          bundleName: "kiro-plus-plus-diagnostics-2026-06-08T10-25-30-000Z",
          bundleDir: "C:\\Users\\HU\\AppData\\Roaming\\Kiro++\\exports\\kiro-plus-plus-diagnostics-2026-06-08T10-25-30-000Z",
          readmePath: "C:\\Users\\HU\\AppData\\Roaming\\Kiro++\\exports\\kiro-plus-plus-diagnostics-2026-06-08T10-25-30-000Z\\README.txt",
          summaryPath: "C:\\Users\\HU\\AppData\\Roaming\\Kiro++\\exports\\kiro-plus-plus-diagnostics-2026-06-08T10-25-30-000Z\\summary.txt",
          jsonPath: "C:\\Users\\HU\\AppData\\Roaming\\Kiro++\\exports\\kiro-plus-plus-diagnostics-2026-06-08T10-25-30-000Z\\snapshot.json",
          requestsPath: "C:\\Users\\HU\\AppData\\Roaming\\Kiro++\\exports\\kiro-plus-plus-diagnostics-2026-06-08T10-25-30-000Z\\recent-requests.json",
          manifestPath: "C:\\Users\\HU\\AppData\\Roaming\\Kiro++\\exports\\kiro-plus-plus-diagnostics-2026-06-08T10-25-30-000Z\\manifest.json",
          headline: "本地代理尚未运行，建议先启动代理。",
          text: "summary-2"
        }
      ],
      lastExportBundle: {
        exportedAt: "2026-06-08T10:20:30.000Z",
        bundleName: "kiro-plus-plus-diagnostics-2026-06-08T10-20-30-000Z",
        bundleDir: "C:\\Users\\HU\\AppData\\Roaming\\Kiro++\\exports\\kiro-plus-plus-diagnostics-2026-06-08T10-20-30-000Z",
        readmePath: "C:\\Users\\HU\\AppData\\Roaming\\Kiro++\\exports\\kiro-plus-plus-diagnostics-2026-06-08T10-20-30-000Z\\README.txt",
        summaryPath: "C:\\Users\\HU\\AppData\\Roaming\\Kiro++\\exports\\kiro-plus-plus-diagnostics-2026-06-08T10-20-30-000Z\\summary.txt",
        jsonPath: "C:\\Users\\HU\\AppData\\Roaming\\Kiro++\\exports\\kiro-plus-plus-diagnostics-2026-06-08T10-20-30-000Z\\snapshot.json",
        requestsPath: "C:\\Users\\HU\\AppData\\Roaming\\Kiro++\\exports\\kiro-plus-plus-diagnostics-2026-06-08T10-20-30-000Z\\recent-requests.json",
        manifestPath: "C:\\Users\\HU\\AppData\\Roaming\\Kiro++\\exports\\kiro-plus-plus-diagnostics-2026-06-08T10-20-30-000Z\\manifest.json",
        zipPath: "C:\\Users\\HU\\AppData\\Roaming\\Kiro++\\exports\\kiro-plus-plus-diagnostics-2026-06-08T10-20-30-000Z.zip",
        headline: "当前安装包桥接不完整，建议先查看 Quickstart。",
        text: "summary"
      }
    }
  });

  assert.equal(settings.runtime.exportHistory.length, 1);
  assert.equal(settings.runtime.exportHistory[0].bundleName, "kiro-plus-plus-diagnostics-2026-06-08T10-25-30-000Z");
  assert.equal(settings.runtime.lastExportBundle?.bundleName, "kiro-plus-plus-diagnostics-2026-06-08T10-20-30-000Z");
  assert.equal(settings.runtime.lastExportBundle?.exportedAt, "2026-06-08T10:20:30.000Z");
  assert.match(settings.runtime.lastExportBundle?.headline ?? "", /Quickstart/);
  assert.match(settings.runtime.lastExportBundle?.zipPath ?? "", /\.zip$/);
  assert.equal(settings.runtime.selectedExportBundleName, "kiro-plus-plus-diagnostics-2026-06-08T10-20-30-000Z");
});

test("normalizeAppSettings preserves last launch attempt metadata", () => {
  const settings = normalizeAppSettings({
    runtime: {
      lastLaunchAttempt: {
        startedAt: "2026-06-08T12:00:00.000Z",
        finishedAt: "2026-06-08T12:00:05.000Z",
        status: "error",
        step: "apply-routing",
        detail: "Launch Kiro with Kiro++ 失败。",
        endpoint: "http://127.0.0.1:43119",
        installPath: "E:\\Kiro\\Kiro.exe",
        error: "DeepSeek 尚未保存 API Key，请先在左侧填写并保存。"
      }
    }
  });

  assert.equal(settings.runtime.lastLaunchAttempt?.status, "error");
  assert.equal(settings.runtime.lastLaunchAttempt?.step, "apply-routing");
  assert.equal(settings.runtime.lastLaunchAttempt?.endpoint, "http://127.0.0.1:43119");
  assert.equal(settings.runtime.lastLaunchAttempt?.installPath, "E:\\Kiro\\Kiro.exe");
});

test("normalizeAppSettings preserves last bootstrap attempt metadata", () => {
  const settings = normalizeAppSettings({
    runtime: {
      lastBootstrapAttempt: {
        startedAt: "2026-06-08T12:10:00.000Z",
        finishedAt: "2026-06-08T12:10:02.000Z",
        status: "success",
        step: "apply-routing",
        detail: "已自动启动代理并应用 BYOK 路由。",
        endpoint: "http://127.0.0.1:43119",
        installPath: "E:\\Kiro\\Kiro.exe",
        error: null
      }
    }
  });

  assert.equal(settings.runtime.lastBootstrapAttempt?.status, "success");
  assert.equal(settings.runtime.lastBootstrapAttempt?.step, "apply-routing");
  assert.equal(settings.runtime.lastBootstrapAttempt?.endpoint, "http://127.0.0.1:43119");
  assert.equal(settings.runtime.lastBootstrapAttempt?.installPath, "E:\\Kiro\\Kiro.exe");
});
