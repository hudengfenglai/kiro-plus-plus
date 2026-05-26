import test from "node:test";
import assert from "node:assert/strict";

import { normalizeAppSettings } from "../src/config.js";
import { DesktopRuntime } from "../desktop/main/runtime.js";

test("normalizeAppSettings preserves v3.1 product metadata", () => {
  const settings = normalizeAppSettings({
    selectedProviderId: "deepseek",
    isByokEnabled: true,
    lastSuccessfulProviderTest: {
      providerId: "deepseek",
      modelId: "deepseek-v4-pro",
      at: "2026-05-26T12:00:00.000Z",
      latencyMs: 812
    },
    lastAppliedKiroBackup: {
      backupPath: "C:\\Users\\HU\\.kiro\\kiro-plus-plus\\backups\\settings.1.json",
      at: "2026-05-26T12:01:00.000Z"
    },
    providers: [
      {
        id: "deepseek",
        providerPresetId: "deepseek",
        type: "openai-compatible",
        label: "DeepSeek",
        baseUrl: "https://api.deepseek.com",
        defaultModel: "deepseek-v4-pro",
        models: [
          {
            id: "deepseek-v4-pro",
            name: "DeepSeek V4 Pro",
            description: "flagship",
            note: "推荐"
          }
        ]
      }
    ]
  });

  assert.equal(settings.isByokEnabled, true);
  assert.equal(settings.providers[0].providerPresetId, "deepseek");
  assert.equal(settings.providers[0].models[0].note, "推荐");
  assert.equal(settings.lastSuccessfulProviderTest.modelId, "deepseek-v4-pro");
  assert.match(settings.lastAppliedKiroBackup.backupPath, /settings\.1\.json$/);
});

test("desktop runtime derives bootstrap guidance and records provider test success", async () => {
  let savedSettings = normalizeAppSettings();
  const runtime = new DesktopRuntime({
    settingsStore: {
      load: async () => savedSettings,
      save: async (next) => {
        savedSettings = normalizeAppSettings(next);
        return savedSettings;
      }
    },
    secretStore: {
      get: async () => "sk-test",
      set: async () => undefined
    },
    providerCatalog: {
      testProviderConnection: async () => ({
        ok: true,
        modelId: "deepseek-v4-pro",
        latencyMs: 420,
        text: "pong"
      }),
      fetchModels: async () => []
    },
    proxyService: {
      getStatus: () => ({ state: "stopped", endpoint: null, error: null })
    },
    kiroService: {
      detectKiro: async () => ({
        installed: true,
        installPath: "E:\\Kiro\\Kiro.exe",
        settingsPath: "settings.json",
        profilesDir: "profiles",
        backupDir: "backups",
        lastBackup: null
      }),
      diagnose: async () => ({
        localRegions: [],
        unsupportedOperationsSeen: [],
        autoModeBlocksByok: false,
        profileAutoModeBlocksByok: false,
        hint: "Run configure"
      })
    },
    logService: {
      tailRequests: async () => [],
      listRequests: async () => []
    }
  });

  const before = await runtime.getState();
  assert.equal(before.bootstrap.recommendedTab, "providers");
  assert.equal(before.bootstrap.steps[1].done, false);

  await runtime.testProvider({
    profile: before.settings.providers[0],
    modelId: "deepseek-v4-pro",
    prompt: "ping"
  });

  const after = await runtime.getState();
  assert.equal(after.lastSuccessfulProviderTest?.modelId, "deepseek-v4-pro");
  assert.equal(after.bootstrap.steps[1].done, true);
});

test("desktop runtime toggles byok and exports redacted diagnostics summary", async () => {
  let savedSettings = normalizeAppSettings();
  const actions = [];
  const runtime = new DesktopRuntime({
    settingsStore: {
      load: async () => savedSettings,
      save: async (next) => {
        savedSettings = normalizeAppSettings(next);
        return savedSettings;
      }
    },
    secretStore: {
      get: async () => "sk-test"
    },
    providerCatalog: {
      testProviderConnection: async () => ({ ok: true, modelId: "deepseek-v4-pro", latencyMs: 1, text: "ok" }),
      fetchModels: async () => []
    },
    proxyService: {
      getStatus: () => ({ state: "running", endpoint: "http://127.0.0.1:43119", error: null }),
      start: async () => ({ state: "running", endpoint: "http://127.0.0.1:43119", error: null })
    },
    kiroService: {
      detectKiro: async () => ({
        installed: true,
        installPath: "E:\\Kiro\\Kiro.exe",
        settingsPath: "settings.json",
        profilesDir: "profiles",
        backupDir: "backups",
        lastBackup: null
      }),
      applyRouting: async () => {
        actions.push("apply");
        return { backupPath: "backups\\settings.2.json" };
      },
      restoreLatestBackup: async () => {
        actions.push("restore");
        return { backupPath: "backups\\settings.2.json" };
      },
      diagnose: async () => ({
        localRegions: ["us-east-1"],
        unsupportedOperationsSeen: [],
        autoModeBlocksByok: false,
        profileAutoModeBlocksByok: false,
        hint: "ok"
      })
    },
    logService: {
      tailRequests: async () => [
        {
          at: "2026-05-26T12:00:00.000Z",
          operation: "GenerateAssistantResponse",
          status: 500,
          requestId: "demo-1",
          headers: { authorization: "[redacted]" }
        }
      ],
      listRequests: async () => []
    }
  });

  await runtime.setByokEnabled(true);
  assert.equal(savedSettings.isByokEnabled, true);
  assert.deepEqual(actions, ["apply"]);

  const summary = await runtime.exportDiagnostics();
  assert.match(summary, /BYOK: enabled/);
  assert.match(summary, /GenerateAssistantResponse/);
  assert.doesNotMatch(summary, /sk-test/);

  await runtime.setByokEnabled(false);
  assert.equal(savedSettings.isByokEnabled, false);
  assert.deepEqual(actions, ["apply", "restore"]);
});

test("desktop runtime launches kiro after ensuring proxy and routing", async () => {
  const launched = [];
  const runtime = new DesktopRuntime({
    settingsStore: {
      load: async () => normalizeAppSettings({ isByokEnabled: false }),
      save: async (next) => normalizeAppSettings(next)
    },
    secretStore: {
      get: async () => "sk-test"
    },
    providerCatalog: {
      testProviderConnection: async () => ({ ok: true, modelId: "deepseek-v4-pro", latencyMs: 1, text: "ok" }),
      fetchModels: async () => []
    },
    proxyService: {
      getStatus: () => ({ state: "stopped", endpoint: null, error: null }),
      start: async () => ({ state: "running", endpoint: "http://127.0.0.1:43119", error: null })
    },
    kiroService: {
      detectKiro: async () => ({
        installed: true,
        installPath: "E:\\Kiro\\Kiro.exe",
        settingsPath: "settings.json",
        profilesDir: "profiles",
        backupDir: "backups",
        lastBackup: null
      }),
      applyRouting: async () => ({ backupPath: "backups\\settings.3.json" }),
      diagnose: async () => ({
        localRegions: ["us-east-1"],
        unsupportedOperationsSeen: [],
        autoModeBlocksByok: false,
        profileAutoModeBlocksByok: false,
        hint: "ok"
      }),
      launchKiro: async (path) => {
        launched.push(path);
        return { launched: true, installPath: path };
      }
    },
    logService: {
      tailRequests: async () => [],
      listRequests: async () => []
    }
  });

  const result = await runtime.launchKiroWithProxy();
  assert.equal(result.launched, true);
  assert.equal(launched[0], "E:\\Kiro\\Kiro.exe");
});
