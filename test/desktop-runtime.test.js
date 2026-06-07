import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

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
        searchedInstallPaths: ["E:\\Kiro\\Kiro.exe"],
        detectionHint: "已检测到 Kiro 安装：E:\\Kiro\\Kiro.exe",
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
  assert.equal(before.readinessIssues[0]?.key, "provider-test");

  await runtime.testProvider({
    profile: before.settings.providers[0],
    modelId: "deepseek-v4-pro",
    prompt: "ping"
  });

  const after = await runtime.getState();
  assert.equal(after.lastSuccessfulProviderTest?.modelId, "deepseek-v4-pro");
  assert.equal(after.bootstrap.steps[1].done, true);
  assert.equal(after.bootstrap.recommendedTab, "status");
});

test("desktop runtime persists autoApplyOnLaunch preference", async () => {
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
      get: async () => null
    },
    providerCatalog: {
      testProviderConnection: async () => ({ ok: true, modelId: "deepseek-v4-pro", latencyMs: 1, text: "ok" }),
      fetchModels: async () => []
    },
    proxyService: {
      getStatus: () => ({ state: "stopped", endpoint: null, error: null })
    },
    kiroService: {
      detectKiro: async () => ({
        installed: false,
        installPath: null,
        searchedInstallPaths: [],
        detectionHint: "未检测到 Kiro 安装。",
        settingsPath: "settings.json",
        profilesDir: "profiles",
        backupDir: "backups",
        lastBackup: null
      }),
      diagnose: async () => null
    },
    logService: {
      tailRequests: async () => [],
      listRequests: async () => []
    }
  });

  const nextState = await runtime.setAutoApplyOnLaunch(true);
  assert.equal(savedSettings.kiro.autoApplyOnLaunch, true);
  assert.equal(nextState.settings.kiro.autoApplyOnLaunch, true);
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
        searchedInstallPaths: ["E:\\Kiro\\Kiro.exe"],
        detectionHint: "已检测到 Kiro 安装：E:\\Kiro\\Kiro.exe",
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
  assert.match(summary, /Readiness issues: 1/);
  assert.match(summary, /Primary issue: 还没有做最小 Provider 验证 -> 测试 Provider/);
  assert.doesNotMatch(summary, /sk-test/);
  assert.match(summary, /Kiro install path: <path:Kiro\.exe>/);
  assert.doesNotMatch(summary, /E:\\Kiro\\Kiro\.exe/);

  await runtime.setByokEnabled(false);
  assert.equal(savedSettings.isByokEnabled, false);
  assert.deepEqual(actions, ["apply", "restore"]);
});

test("desktop runtime launches kiro after ensuring proxy and routing", async () => {
  let savedSettings = normalizeAppSettings({ isByokEnabled: false });
  const launched = [];
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
      getStatus: () => ({ state: "stopped", endpoint: null, error: null }),
      start: async () => ({ state: "running", endpoint: "http://127.0.0.1:43119", error: null })
    },
    kiroService: {
      detectKiro: async () => ({
        installed: true,
        installPath: "E:\\Kiro\\Kiro.exe",
        searchedInstallPaths: ["E:\\Kiro\\Kiro.exe"],
        detectionHint: "已检测到 Kiro 安装：E:\\Kiro\\Kiro.exe",
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
  assert.equal(savedSettings.runtime.lastLaunchAttempt?.status, "success");
  assert.equal(savedSettings.runtime.lastLaunchAttempt?.step, "launch-kiro");
  assert.equal(savedSettings.runtime.lastLaunchAttempt?.installPath, "E:\\Kiro\\Kiro.exe");
  assert.equal(savedSettings.runtime.lastLaunchAttempt?.endpoint, "http://127.0.0.1:43119");
});

test("desktop runtime bootstrap auto-applies proxy and routing when enabled", async () => {
  let savedSettings = normalizeAppSettings({
    kiro: {
      autoApplyOnLaunch: true
    }
  });
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
      getStatus: () => ({ state: "stopped", endpoint: null, error: null }),
      start: async () => {
        actions.push("start-proxy");
        return { state: "running", endpoint: "http://127.0.0.1:43119", error: null };
      }
    },
    kiroService: {
      detectKiro: async () => ({
        installed: true,
        installPath: "E:\\Kiro\\Kiro.exe",
        searchedInstallPaths: ["E:\\Kiro\\Kiro.exe"],
        detectionHint: "已检测到 Kiro 安装：E:\\Kiro\\Kiro.exe",
        settingsPath: "settings.json",
        profilesDir: "profiles",
        backupDir: "backups",
        lastBackup: null
      }),
      applyRouting: async () => {
        actions.push("apply-routing");
        return { backupPath: "backups\\settings.6.json" };
      },
      diagnose: async () => ({
        localRegions: [],
        unsupportedOperationsSeen: [],
        autoModeBlocksByok: false,
        profileAutoModeBlocksByok: false,
        hint: "ok"
      })
    },
    logService: {
      tailRequests: async () => [],
      listRequests: async () => []
    }
  });

  const state = await runtime.bootstrap();
  assert.deepEqual(actions, ["start-proxy", "apply-routing"]);
  assert.equal(state.settings.isByokEnabled, true);
  assert.equal(savedSettings.runtime.lastBootstrapAttempt?.status, "success");
  assert.equal(savedSettings.runtime.lastBootstrapAttempt?.step, "apply-routing");
  assert.equal(savedSettings.runtime.lastBootstrapAttempt?.installPath, "E:\\Kiro\\Kiro.exe");
});

test("desktop runtime bootstrap stays resilient when auto-apply fails", async () => {
  let savedSettings = normalizeAppSettings({
    kiro: {
      autoApplyOnLaunch: true
    }
  });
  const runtime = new DesktopRuntime({
    settingsStore: {
      load: async () => savedSettings,
      save: async (next) => {
        savedSettings = normalizeAppSettings(next);
        return savedSettings;
      }
    },
    secretStore: {
      get: async () => null
    },
    providerCatalog: {
      testProviderConnection: async () => ({ ok: true, modelId: "deepseek-v4-pro", latencyMs: 1, text: "ok" }),
      fetchModels: async () => []
    },
    proxyService: {
      getStatus: () => ({ state: "stopped", endpoint: null, error: null })
    },
    kiroService: {
      detectKiro: async () => ({
        installed: false,
        installPath: null,
        searchedInstallPaths: [],
        detectionHint: "未检测到 Kiro 安装。",
        settingsPath: "settings.json",
        profilesDir: "profiles",
        backupDir: "backups",
        lastBackup: null
      }),
      diagnose: async () => null
    },
    logService: {
      tailRequests: async () => [],
      listRequests: async () => []
    }
  });

  const state = await runtime.bootstrap();
  assert.equal(state.kiroDetection.installed, false);
  assert.equal(state.settings.kiro.autoApplyOnLaunch, true);
  assert.equal(savedSettings.runtime.lastBootstrapAttempt?.status, "error");
  assert.equal(savedSettings.runtime.lastBootstrapAttempt?.step, "bootstrap-failed");
  assert.match(savedSettings.runtime.lastBootstrapAttempt?.error ?? "", /未检测到 Kiro 安装/);
});

test("desktop runtime bootstrap records skipped state when auto-apply is disabled", async () => {
  let savedSettings = normalizeAppSettings({
    kiro: {
      autoApplyOnLaunch: false
    }
  });
  const runtime = new DesktopRuntime({
    settingsStore: {
      load: async () => savedSettings,
      save: async (next) => {
        savedSettings = normalizeAppSettings(next);
        return savedSettings;
      }
    },
    secretStore: {
      get: async () => null
    },
    providerCatalog: {
      testProviderConnection: async () => ({ ok: true, modelId: "deepseek-v4-pro", latencyMs: 1, text: "ok" }),
      fetchModels: async () => []
    },
    proxyService: {
      getStatus: () => ({ state: "stopped", endpoint: null, error: null })
    },
    kiroService: {
      detectKiro: async () => ({
        installed: false,
        installPath: null,
        searchedInstallPaths: [],
        detectionHint: "未检测到 Kiro 安装。",
        settingsPath: "settings.json",
        profilesDir: "profiles",
        backupDir: "backups",
        lastBackup: null
      }),
      diagnose: async () => null
    },
    logService: {
      tailRequests: async () => [],
      listRequests: async () => []
    }
  });

  const state = await runtime.bootstrap();
  assert.equal(state.settings.kiro.autoApplyOnLaunch, false);
  assert.equal(savedSettings.runtime.lastBootstrapAttempt?.status, "skipped");
  assert.equal(savedSettings.runtime.lastBootstrapAttempt?.step, "bootstrap-disabled");
});

test("desktop runtime exports diagnostics to a local file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kiro-plus-export-"));
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
      get: async () => "sk-test"
    },
    providerCatalog: {
      testProviderConnection: async () => ({ ok: true, modelId: "deepseek-v4-pro", latencyMs: 1, text: "ok" }),
      fetchModels: async () => []
    },
    proxyService: {
      getStatus: () => ({ state: "stopped", endpoint: null, error: null })
    },
    kiroService: {
      detectKiro: async () => ({
        installed: true,
        installPath: "E:\\Kiro\\Kiro.exe",
        searchedInstallPaths: ["E:\\Kiro\\Kiro.exe"],
        detectionHint: "已检测到 Kiro 安装：E:\\Kiro\\Kiro.exe",
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
        hint: "ok"
      })
    },
    logService: {
      tailRequests: async () => [
        {
          at: "2026-06-07T12:00:00.000Z",
          operation: "GenerateAssistantResponse",
          status: 500,
          requestId: "demo-export",
          durationMs: 321,
          bodyBytes: 42
        }
      ],
      listRequests: async () => []
    },
    diagnosticsExportDir: dir,
    now: () => new Date("2026-06-07T12:34:56.789Z")
  });

  const result = await runtime.exportDiagnosticsToFile();
  assert.equal(result.exportedAt, "2026-06-07T12:34:56.789Z");
  assert.equal(result.bundleName, "kiro-plus-plus-diagnostics-2026-06-07T12-34-56-789Z");
  assert.match(result.bundleDir, /kiro-plus-plus-diagnostics-2026-06-07T12-34-56-789Z$/);
  assert.match(result.readmePath, /README\.txt$/);
  assert.match(result.summaryPath, /summary\.txt$/);
  assert.match(result.jsonPath, /snapshot\.json$/);
  assert.match(result.requestsPath, /recent-requests\.json$/);
  assert.match(result.manifestPath, /manifest\.json$/);
  const readmeText = await readFile(result.readmePath, "utf8");
  assert.match(readmeText, /Kiro\+\+ support bundle/);
  assert.match(readmeText, /summary\.txt/);
  const text = await readFile(result.summaryPath, "utf8");
  assert.equal(text, `${result.text}\n`);
  assert.match(result.text, /Recent requests \(redacted\)/);
  assert.match(result.text, /GenerateAssistantResponse \/ HTTP 500/);
  assert.match(result.text, /requestId: demo-export/);
  const jsonText = await readFile(result.jsonPath, "utf8");
  const payload = JSON.parse(jsonText);
  assert.equal(payload.exportedAt, "2026-06-07T12:34:56.789Z");
  assert.match(payload.summary, /Kiro\+\+ diagnostics summary/);
  assert.equal(payload.proxyStatus.state, "stopped");
  assert.equal(payload.kiroDetection.installPath, "<path:Kiro.exe>");
  assert.equal(payload.kiroDetection.detectionHint, "已检测到 Kiro 安装：<path:Kiro.exe>");
  assert.equal(payload.recentLogs[0].requestId, "demo-export");
  const requestsText = await readFile(result.requestsPath, "utf8");
  const requests = JSON.parse(requestsText);
  assert.equal(requests[0].requestId, "demo-export");
  const manifestText = await readFile(result.manifestPath, "utf8");
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.exportedAt, "2026-06-07T12:34:56.789Z");
  assert.match(manifest.bundleName, /^kiro-plus-plus-diagnostics-2026-06-07T12-34-56-789Z$/);
  assert.equal(manifest.files.readme, "README.txt");
  assert.equal(manifest.files.summary, "summary.txt");
  assert.equal(manifest.files.snapshot, "snapshot.json");
  assert.equal(manifest.files.requests, "recent-requests.json");
  assert.doesNotMatch(manifestText, /[A-Z]:\\/);
  const state = await runtime.getState();
  assert.equal(state.lastExportBundle?.bundleName, "kiro-plus-plus-diagnostics-2026-06-07T12-34-56-789Z");
  assert.equal(state.lastExportBundle?.exportedAt, "2026-06-07T12:34:56.789Z");
  assert.equal(state.lastExportBundle?.summaryPath, result.summaryPath);
  const reloadedSettings = await runtime.settingsStore.load();
  assert.equal(reloadedSettings.runtime.lastExportBundle?.bundleName, "kiro-plus-plus-diagnostics-2026-06-07T12-34-56-789Z");
  assert.equal(reloadedSettings.runtime.lastExportBundle?.summaryPath, result.summaryPath);

  await rm(dir, { recursive: true, force: true });
});

test("desktop runtime exports diagnostics to a zip support bundle", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kiro-plus-export-zip-"));
  const zipCalls = [];
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
      get: async () => "sk-test"
    },
    providerCatalog: {
      testProviderConnection: async () => ({ ok: true, modelId: "deepseek-v4-pro", latencyMs: 1, text: "ok" }),
      fetchModels: async () => []
    },
    proxyService: {
      getStatus: () => ({ state: "stopped", endpoint: null, error: null })
    },
    kiroService: {
      detectKiro: async () => ({
        installed: true,
        installPath: "E:\\Kiro\\Kiro.exe",
        searchedInstallPaths: ["E:\\Kiro\\Kiro.exe"],
        detectionHint: "已检测到 Kiro 安装：E:\\Kiro\\Kiro.exe",
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
        hint: "ok"
      })
    },
    logService: {
      tailRequests: async () => [],
      listRequests: async () => []
    },
    diagnosticsExportDir: dir,
    zipBundle: async ({ bundleDir, zipPath }) => {
      zipCalls.push({ bundleDir, zipPath });
      await writeFile(zipPath, "zip", "utf8");
    },
    now: () => new Date("2026-06-08T08:00:00.000Z")
  });

  const result = await runtime.exportDiagnosticsZip();
  assert.equal(zipCalls.length, 1);
  assert.equal(result.exportedAt, "2026-06-08T08:00:00.000Z");
  assert.equal(result.bundleName, "kiro-plus-plus-diagnostics-2026-06-08T08-00-00-000Z");
  assert.equal(zipCalls[0].bundleDir, result.bundleDir);
  assert.equal(zipCalls[0].zipPath, result.zipPath);
  assert.match(result.zipPath, /\.zip$/);
  const zipText = await readFile(result.zipPath, "utf8");
  assert.equal(zipText, "zip");
  const manifestText = await readFile(result.manifestPath, "utf8");
  assert.doesNotMatch(manifestText, /[A-Z]:\\/);

  await rm(dir, { recursive: true, force: true });
});

test("desktop runtime keeps latest support bundles in descending history order", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kiro-plus-export-history-"));
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
      get: async () => "sk-test"
    },
    providerCatalog: {
      testProviderConnection: async () => ({ ok: true, modelId: "deepseek-v4-pro", latencyMs: 1, text: "ok" }),
      fetchModels: async () => []
    },
    proxyService: {
      getStatus: () => ({ state: "stopped", endpoint: null, error: null })
    },
    kiroService: {
      detectKiro: async () => ({
        installed: true,
        installPath: "E:\\Kiro\\Kiro.exe",
        searchedInstallPaths: ["E:\\Kiro\\Kiro.exe"],
        detectionHint: "已检测到 Kiro 安装：E:\\Kiro\\Kiro.exe",
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
        hint: "ok"
      })
    },
    logService: {
      tailRequests: async () => [],
      listRequests: async () => []
    },
    diagnosticsExportDir: dir,
    now: (() => {
      const stamps = [
        "2026-06-08T09:00:00.000Z",
        "2026-06-08T09:05:00.000Z"
      ];
      let index = 0;
      return () => new Date(stamps[index++]);
    })()
  });

  await runtime.exportDiagnosticsToFile();
  await runtime.exportDiagnosticsToFile();

  const state = await runtime.getState();
  assert.equal(state.exportHistory.length, 2);
  assert.equal(state.exportHistory[0].bundleName, "kiro-plus-plus-diagnostics-2026-06-08T09-05-00-000Z");
  assert.equal(state.exportHistory[1].bundleName, "kiro-plus-plus-diagnostics-2026-06-08T09-00-00-000Z");
  assert.equal(state.lastExportBundle?.bundleName, state.exportHistory[0].bundleName);

  const selected = await runtime.selectExportBundle("kiro-plus-plus-diagnostics-2026-06-08T09-00-00-000Z");
  assert.equal(selected.lastExportBundle?.bundleName, "kiro-plus-plus-diagnostics-2026-06-08T09-00-00-000Z");
  const reloaded = await runtime.getState();
  assert.equal(reloaded.lastExportBundle?.bundleName, "kiro-plus-plus-diagnostics-2026-06-08T09-00-00-000Z");
  assert.equal(savedSettings.runtime.selectedExportBundleName, "kiro-plus-plus-diagnostics-2026-06-08T09-00-00-000Z");

  await rm(dir, { recursive: true, force: true });
});

test("desktop runtime clears persisted support bundle history without deleting files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kiro-plus-export-clear-"));
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
      get: async () => "sk-test"
    },
    providerCatalog: {
      testProviderConnection: async () => ({ ok: true, modelId: "deepseek-v4-pro", latencyMs: 1, text: "ok" }),
      fetchModels: async () => []
    },
    proxyService: {
      getStatus: () => ({ state: "stopped", endpoint: null, error: null })
    },
    kiroService: {
      detectKiro: async () => ({
        installed: true,
        installPath: "E:\\Kiro\\Kiro.exe",
        searchedInstallPaths: ["E:\\Kiro\\Kiro.exe"],
        detectionHint: "已检测到 Kiro 安装：E:\\Kiro\\Kiro.exe",
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
        hint: "ok"
      })
    },
    logService: {
      tailRequests: async () => [],
      listRequests: async () => []
    },
    diagnosticsExportDir: dir,
    now: (() => {
      const stamps = [
        "2026-06-08T10:00:00.000Z",
        "2026-06-08T10:01:00.000Z"
      ];
      let index = 0;
      return () => new Date(stamps[index++]);
    })()
  });

  await runtime.exportDiagnosticsToFile();
  await runtime.exportDiagnosticsToFile();

  const cleared = await runtime.clearDiagnosticsHistory();
  assert.equal(cleared.exportHistory.length, 0);
  assert.equal(cleared.lastExportBundle, null);
  assert.equal(savedSettings.runtime.exportHistory.length, 0);
  assert.equal(savedSettings.runtime.lastExportBundle, null);

  await rm(dir, { recursive: true, force: true });
});

test("desktop runtime deletes a single support bundle record and preserves remaining history", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kiro-plus-export-delete-"));
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
      get: async () => "sk-test"
    },
    providerCatalog: {
      testProviderConnection: async () => ({ ok: true, modelId: "deepseek-v4-pro", latencyMs: 1, text: "ok" }),
      fetchModels: async () => []
    },
    proxyService: {
      getStatus: () => ({ state: "stopped", endpoint: null, error: null })
    },
    kiroService: {
      detectKiro: async () => ({
        installed: true,
        installPath: "E:\\Kiro\\Kiro.exe",
        searchedInstallPaths: ["E:\\Kiro\\Kiro.exe"],
        detectionHint: "已检测到 Kiro 安装：E:\\Kiro\\Kiro.exe",
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
        hint: "ok"
      })
    },
    logService: {
      tailRequests: async () => [],
      listRequests: async () => []
    },
    diagnosticsExportDir: dir,
    now: (() => {
      const stamps = [
        "2026-06-08T11:00:00.000Z",
        "2026-06-08T11:01:00.000Z"
      ];
      let index = 0;
      return () => new Date(stamps[index++]);
    })()
  });

  await runtime.exportDiagnosticsToFile();
  await runtime.exportDiagnosticsToFile();
  await runtime.selectExportBundle("kiro-plus-plus-diagnostics-2026-06-08T11-00-00-000Z");

  const nextState = await runtime.deleteExportBundle("kiro-plus-plus-diagnostics-2026-06-08T11-00-00-000Z");
  assert.equal(nextState.exportHistory.length, 1);
  assert.equal(nextState.exportHistory[0].bundleName, "kiro-plus-plus-diagnostics-2026-06-08T11-01-00-000Z");
  assert.equal(nextState.lastExportBundle?.bundleName, "kiro-plus-plus-diagnostics-2026-06-08T11-01-00-000Z");
  assert.equal(savedSettings.runtime.selectedExportBundleName, "kiro-plus-plus-diagnostics-2026-06-08T11-01-00-000Z");

  await rm(dir, { recursive: true, force: true });
});

test("desktop runtime applyRouting stops early when Kiro is not detected", async () => {
  let applyCalled = false;
  const runtime = new DesktopRuntime({
    settingsStore: {
      load: async () => normalizeAppSettings(),
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
      getStatus: () => ({ state: "running", endpoint: "http://127.0.0.1:43119", error: null })
    },
    kiroService: {
      detectKiro: async () => ({
        installed: false,
        installPath: null,
        searchedInstallPaths: [
          "C:\\Users\\HU\\AppData\\Local\\Programs\\Kiro\\Kiro.exe"
        ],
        detectionHint: "未检测到 Kiro 安装。已检查 1 个常见路径，请确认 Kiro 已安装或不在非标准目录。",
        settingsPath: "settings.json",
        profilesDir: "profiles",
        backupDir: "backups",
        lastBackup: null
      }),
      applyRouting: async () => {
        applyCalled = true;
        return { backupPath: "backups\\settings.4.json" };
      },
      diagnose: async () => ({
        localRegions: [],
        unsupportedOperationsSeen: [],
        autoModeBlocksByok: false,
        profileAutoModeBlocksByok: false,
        hint: "missing install"
      })
    },
    logService: {
      tailRequests: async () => [],
      listRequests: async () => []
    }
  });

  await assert.rejects(
    () => runtime.applyRouting(),
    /未检测到 Kiro 安装/
  );
  assert.equal(applyCalled, false);
});

test("desktop runtime rejects invalid provider default model before launch", async () => {
  let invalidSettings = normalizeAppSettings({
    selectedProviderId: "deepseek",
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
            id: "deepseek-v4-flash",
            name: "DeepSeek V4 Flash",
            description: "fast",
            note: ""
          }
        ]
      }
    ]
  });

  const runtime = new DesktopRuntime({
    settingsStore: {
      load: async () => invalidSettings,
      save: async (next) => {
        invalidSettings = normalizeAppSettings(next);
        return invalidSettings;
      }
    },
    secretStore: {
      get: async () => "sk-test"
    },
    providerCatalog: {
      testProviderConnection: async () => ({ ok: true, modelId: "deepseek-v4-flash", latencyMs: 1, text: "ok" }),
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
        searchedInstallPaths: ["E:\\Kiro\\Kiro.exe"],
        detectionHint: "已检测到 Kiro 安装：E:\\Kiro\\Kiro.exe",
        settingsPath: "settings.json",
        profilesDir: "profiles",
        backupDir: "backups",
        lastBackup: null
      }),
      applyRouting: async () => ({ backupPath: "backups\\settings.5.json" }),
      diagnose: async () => ({
        localRegions: ["us-east-1"],
        unsupportedOperationsSeen: [],
        autoModeBlocksByok: false,
        profileAutoModeBlocksByok: false,
        hint: "ok"
      }),
      launchKiro: async () => ({ launched: true })
    },
    logService: {
      tailRequests: async () => [],
      listRequests: async () => []
    }
  });

  await assert.rejects(
    () => runtime.launchKiroWithProxy(),
    /不在 models\[\] 列表中/
  );
  assert.equal(invalidSettings.runtime.lastLaunchAttempt?.status, "error");
  assert.equal(invalidSettings.runtime.lastLaunchAttempt?.step, "start-proxy");
  assert.match(invalidSettings.runtime.lastLaunchAttempt?.error ?? "", /不在 models\[\] 列表中/);
});

test("desktop runtime reports readiness issues for missing key and missing Kiro", async () => {
  const runtime = new DesktopRuntime({
    settingsStore: {
      load: async () => normalizeAppSettings(),
      save: async (next) => normalizeAppSettings(next)
    },
    secretStore: {
      get: async () => null
    },
    providerCatalog: {
      testProviderConnection: async () => ({ ok: true, modelId: "deepseek-v4-pro", latencyMs: 1, text: "ok" }),
      fetchModels: async () => []
    },
    proxyService: {
      getStatus: () => ({ state: "stopped", endpoint: null, error: null })
    },
    kiroService: {
      detectKiro: async () => ({
        installed: false,
        installPath: null,
        searchedInstallPaths: ["C:\\Users\\HU\\AppData\\Local\\Programs\\Kiro\\Kiro.exe"],
        detectionHint: "未检测到 Kiro 安装。已检查 1 个常见路径，请确认 Kiro 已安装或不在非标准目录。",
        settingsPath: "settings.json",
        profilesDir: "profiles",
        backupDir: "backups",
        lastBackup: null
      }),
      diagnose: async () => ({
        localRegions: [],
        unsupportedOperationsSeen: ["SendMessage"],
        autoModeBlocksByok: false,
        profileAutoModeBlocksByok: false,
        hint: "missing install"
      })
    },
    logService: {
      tailRequests: async () => [],
      listRequests: async () => []
    }
  });

  const state = await runtime.getState();
  assert.ok(state.readinessIssues.some((issue) => issue.key === "provider-api-key"));
  assert.ok(state.readinessIssues.some((issue) => issue.key === "kiro-install"));
  assert.ok(state.readinessIssues.some((issue) => issue.key === "unsupported-operations"));

  const summary = await runtime.exportDiagnostics();
  assert.match(summary, /Readiness issues: 6/);
  assert.match(summary, /Primary issue: Provider API Key 尚未保存 -> 填写并保存 Key/);
  assert.match(summary, /Issue 1: \[error\] Provider API Key 尚未保存 \/ 填写并保存 Key/);
  assert.match(summary, /Issue 6: \[warning\] 最近出现未兼容操作 \/ 查看日志/);
});
