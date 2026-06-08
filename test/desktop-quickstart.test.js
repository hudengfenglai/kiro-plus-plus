import test from "node:test";
import assert from "node:assert/strict";

import {
  buildKiroActionAvailability,
  buildProviderActionAvailability,
  buildProviderDraftStatus,
  shouldPromptBeforeReplacingProviderDraft,
  buildSetupWorkspaceSummary,
  buildQuickstartChecklist,
  summarizeQuickstartChecklist
} from "../desktop/shared/quickstart.js";
import { getRequiredBridgeMethods, inspectDesktopBridge } from "../desktop/shared/bridge-status.js";
import { buildDesktopHealthSummary, formatDesktopHealthSummary } from "../desktop/shared/desktop-health.js";

function makeState(overrides = {}) {
  const provider = {
    id: "deepseek",
    providerPresetId: "deepseek",
    type: "openai-compatible",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-v4-pro",
    models: [
      {
        id: "deepseek-v4-pro",
        name: "deepseek-v4-pro",
        description: "BYOK routed model",
        note: ""
      }
    ]
  };

  return {
    settings: {
      selectedProviderId: "deepseek",
      isByokEnabled: false,
      lastSuccessfulProviderTest: null,
      lastAppliedKiroBackup: null,
      providers: [provider],
      kiro: {
        autoApplyOnLaunch: false,
        defaultEndpointPort: 43119
      },
      logging: {
        captureHeaders: true,
        captureBodies: false
      },
      runtime: {
        exportHistory: [],
        lastExportBundle: null,
        lastLaunchAttempt: null,
        lastBootstrapAttempt: null,
        selectedExportBundleName: null
      }
    },
    proxyStatus: {
      state: "stopped",
      endpoint: null,
      error: null
    },
    kiroDetection: {
      installed: false,
      installPath: null,
      searchedInstallPaths: [],
      detectionHint: "尚未检测 Kiro 安装。",
      settingsPath: "",
      profilesDir: "",
      backupDir: "",
      lastBackup: null
    },
    diagnose: null,
    recentLogs: [],
    bootstrap: {
      recommendedTab: "providers",
      steps: []
    },
    readinessIssues: [],
    lastSuccessfulProviderTest: null,
    lastAppliedKiroBackup: null,
    exportHistory: [],
    lastExportBundle: null,
    lastLaunchAttempt: null,
    lastBootstrapAttempt: null,
    ...overrides
  };
}

test("buildQuickstartChecklist marks provider test as the current step before first successful validation", () => {
  const checklist = buildQuickstartChecklist(makeState());

  assert.equal(checklist.length, 4);
  assert.equal(checklist[0].done, true);
  assert.equal(checklist[1].done, true);
  assert.equal(checklist[2].done, false);
  assert.equal(checklist[2].current, true);
  assert.equal(checklist[2].focus, "playground");
  assert.equal(checklist[2].actionKind, "test-provider");
});

test("buildQuickstartChecklist marks every step done after provider test and Kiro routing succeed", () => {
  const checklist = buildQuickstartChecklist(makeState({
    settings: {
      selectedProviderId: "deepseek",
      isByokEnabled: true,
      lastSuccessfulProviderTest: {
        providerId: "deepseek",
        modelId: "deepseek-v4-pro",
        at: "2026-06-08T12:00:00.000Z",
        latencyMs: 420
      },
      lastAppliedKiroBackup: {
        backupPath: "C:\\Users\\HU\\.kiro\\kiro-plus-plus\\backups\\settings.1.json",
        at: "2026-06-08T12:05:00.000Z"
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
              name: "deepseek-v4-pro",
              description: "BYOK routed model",
              note: ""
            }
          ]
        }
      ],
      kiro: {
        autoApplyOnLaunch: true,
        defaultEndpointPort: 43119
      },
      logging: {
        captureHeaders: true,
        captureBodies: false
      },
      runtime: {
        exportHistory: [],
        lastExportBundle: null,
        lastLaunchAttempt: null,
        lastBootstrapAttempt: null,
        selectedExportBundleName: null
      }
    },
    proxyStatus: {
      state: "running",
      endpoint: "http://127.0.0.1:43119",
      error: null
    },
    kiroDetection: {
      installed: true,
      installPath: "E:\\Kiro\\Kiro.exe",
      searchedInstallPaths: ["E:\\Kiro\\Kiro.exe"],
      detectionHint: "已检测到 Kiro 安装。",
      settingsPath: "settings.json",
      profilesDir: "profiles",
      backupDir: "backups",
      lastBackup: null
    },
    diagnose: {
      localRegions: ["local"],
      unsupportedOperationsSeen: [],
      autoModeBlocksByok: false,
      profileAutoModeBlocksByok: false,
      hint: "ok"
    },
    lastSuccessfulProviderTest: {
      providerId: "deepseek",
      modelId: "deepseek-v4-pro",
      at: "2026-06-08T12:00:00.000Z",
      latencyMs: 420
    }
  }));

  assert.ok(checklist.every((item) => item.done));
  assert.equal(checklist.some((item) => item.current), false);
  assert.equal(checklist.at(-1)?.actionLabel, "重新诊断");
  assert.equal(checklist.at(-1)?.actionKind, "diagnose");
});

test("buildQuickstartChecklist points the Kiro step at starting proxy before routing is applied", () => {
  const checklist = buildQuickstartChecklist(makeState({
    kiroDetection: {
      installed: true,
      installPath: "E:\\Kiro\\Kiro.exe",
      searchedInstallPaths: ["E:\\Kiro\\Kiro.exe"],
      detectionHint: "已检测到 Kiro 安装。",
      settingsPath: "settings.json",
      profilesDir: "profiles",
      backupDir: "backups",
      lastBackup: null
    }
  }));

  assert.equal(checklist[3].done, false);
  assert.equal(checklist[3].actionKind, "start-proxy");
  assert.equal(checklist[3].actionLabel, "启动代理");
  assert.deepEqual(checklist.map((item) => item.title), [
    "配置 Provider",
    "确认模型列表",
    "测试 Provider",
    "应用到 Kiro"
  ]);
});

test("summarizeQuickstartChecklist reports completed progress and current next step", () => {
  const checklist = buildQuickstartChecklist(makeState());
  const summary = summarizeQuickstartChecklist(checklist);

  assert.equal(summary.completedCount, 2);
  assert.equal(summary.totalCount, 4);
  assert.equal(summary.percent, 50);
  assert.equal(summary.isComplete, false);
  assert.equal(summary.remainingCount, 2);
  assert.equal(summary.showSetupWorkspace, true);
  assert.equal(summary.showSetupRail, true);
  assert.equal(summary.nextItem?.id, "test");
  assert.equal(summary.nextLabel, "下一步：测试 Provider");
  assert.equal(summary.bannerTitle, "继续完成首次接入");
  assert.match(summary.bannerDetail, /还差 2 步/);
  assert.equal(summary.modeLabel, "Setup Mode");
  assert.equal(summary.launchActionLabel, "先完成设置");
});

test("summarizeQuickstartChecklist reports finished state when all steps are done", () => {
  const checklist = buildQuickstartChecklist(makeState({
    settings: {
      selectedProviderId: "deepseek",
      isByokEnabled: true,
      lastSuccessfulProviderTest: {
        providerId: "deepseek",
        modelId: "deepseek-v4-pro",
        at: "2026-06-08T12:00:00.000Z",
        latencyMs: 420
      },
      lastAppliedKiroBackup: {
        backupPath: "C:\\Users\\HU\\.kiro\\kiro-plus-plus\\backups\\settings.1.json",
        at: "2026-06-08T12:05:00.000Z"
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
              name: "deepseek-v4-pro",
              description: "BYOK routed model",
              note: ""
            }
          ]
        }
      ],
      kiro: {
        autoApplyOnLaunch: true,
        defaultEndpointPort: 43119
      },
      logging: {
        captureHeaders: true,
        captureBodies: false
      },
      runtime: {
        exportHistory: [],
        lastExportBundle: null,
        lastLaunchAttempt: null,
        lastBootstrapAttempt: null,
        selectedExportBundleName: null
      }
    },
    proxyStatus: {
      state: "running",
      endpoint: "http://127.0.0.1:43119",
      error: null
    },
    kiroDetection: {
      installed: true,
      installPath: "E:\\Kiro\\Kiro.exe",
      searchedInstallPaths: ["E:\\Kiro\\Kiro.exe"],
      detectionHint: "已检测到 Kiro 安装。",
      settingsPath: "settings.json",
      profilesDir: "profiles",
      backupDir: "backups",
      lastBackup: null
    },
    diagnose: {
      localRegions: ["local"],
      unsupportedOperationsSeen: [],
      autoModeBlocksByok: false,
      profileAutoModeBlocksByok: false,
      hint: "ok"
    },
    lastSuccessfulProviderTest: {
      providerId: "deepseek",
      modelId: "deepseek-v4-pro",
      at: "2026-06-08T12:00:00.000Z",
      latencyMs: 420
    }
  }));
  const summary = summarizeQuickstartChecklist(checklist);

  assert.equal(summary.completedCount, 4);
  assert.equal(summary.percent, 100);
  assert.equal(summary.isComplete, true);
  assert.equal(summary.remainingCount, 0);
  assert.equal(summary.showSetupWorkspace, false);
  assert.equal(summary.showSetupRail, false);
  assert.equal(summary.nextItem, null);
  assert.equal(summary.nextLabel, "已完成最小接入，可以开始使用");
  assert.equal(summary.bannerTitle, "最小接入已完成");
  assert.equal(summary.modeLabel, "Ready");
  assert.equal(summary.launchActionLabel, "Launch Kiro with Kiro++");
});

test("buildKiroActionAvailability disables route actions until proxy and Kiro are ready", () => {
  const actions = buildKiroActionAvailability(makeState());

  assert.equal(actions.startProxy.enabled, true);
  assert.equal(actions.restartProxy.enabled, false);
  assert.match(actions.restartProxy.reason ?? "", /先启动代理/);
  assert.equal(actions.applyRouting.enabled, false);
  assert.match(actions.applyRouting.reason ?? "", /检测到 Kiro 安装/);
  assert.equal(actions.toggleByok.enabled, false);
  assert.match(actions.toggleByok.reason ?? "", /检测到 Kiro 安装/);
  assert.equal(actions.restore.enabled, false);
});

test("buildKiroActionAvailability enables route actions when proxy, Kiro, and BYOK are ready", () => {
  const actions = buildKiroActionAvailability(makeState({
    settings: {
      selectedProviderId: "deepseek",
      isByokEnabled: true,
      lastSuccessfulProviderTest: null,
      lastAppliedKiroBackup: {
        backupPath: "C:\\Users\\HU\\.kiro\\kiro-plus-plus\\backups\\settings.1.json",
        at: "2026-06-08T12:05:00.000Z"
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
              name: "deepseek-v4-pro",
              description: "BYOK routed model",
              note: ""
            }
          ]
        }
      ],
      kiro: {
        autoApplyOnLaunch: true,
        defaultEndpointPort: 43119
      },
      logging: {
        captureHeaders: true,
        captureBodies: false
      },
      runtime: {
        exportHistory: [],
        lastExportBundle: null,
        lastLaunchAttempt: null,
        lastBootstrapAttempt: null,
        selectedExportBundleName: null
      }
    },
    proxyStatus: {
      state: "running",
      endpoint: "http://127.0.0.1:43119",
      error: null
    },
    kiroDetection: {
      installed: true,
      installPath: "E:\\Kiro\\Kiro.exe",
      searchedInstallPaths: ["E:\\Kiro\\Kiro.exe"],
      detectionHint: "已检测到 Kiro 安装。",
      settingsPath: "settings.json",
      profilesDir: "profiles",
      backupDir: "backups",
      lastBackup: {
        backupPath: "C:\\Users\\HU\\.kiro\\kiro-plus-plus\\backups\\settings.1.json",
        at: "2026-06-08T12:05:00.000Z"
      }
    }
  }));

  assert.equal(actions.startProxy.enabled, false);
  assert.equal(actions.restartProxy.enabled, true);
  assert.equal(actions.stopProxy.enabled, true);
  assert.equal(actions.applyRouting.enabled, true);
  assert.equal(actions.toggleByok.enabled, true);
  assert.equal(actions.diagnose.enabled, true);
  assert.equal(actions.restore.enabled, true);
});

test("buildProviderActionAvailability disables fetch and test until provider base url is ready", () => {
  const actions = buildProviderActionAvailability(makeState({
    settings: {
      selectedProviderId: "deepseek",
      isByokEnabled: false,
      lastSuccessfulProviderTest: null,
      lastAppliedKiroBackup: null,
      providers: [
        {
          id: "deepseek",
          providerPresetId: "deepseek",
          type: "openai-compatible",
          label: "DeepSeek",
          baseUrl: "",
          defaultModel: "deepseek-v4-pro",
          models: []
        }
      ],
      kiro: {
        autoApplyOnLaunch: false,
        defaultEndpointPort: 43119
      },
      logging: {
        captureHeaders: true,
        captureBodies: false
      },
      runtime: {
        exportHistory: [],
        lastExportBundle: null,
        lastLaunchAttempt: null,
        lastBootstrapAttempt: null,
        selectedExportBundleName: null
      }
    }
  }));

  assert.equal(actions.save.enabled, true);
  assert.equal(actions.fetchModels.enabled, false);
  assert.match(actions.fetchModels.reason ?? "", /Base URL/);
  assert.equal(actions.testProvider.enabled, false);
  assert.match(actions.testProvider.reason ?? "", /Base URL/);
});

test("buildProviderActionAvailability reports default model mismatch after provider base url exists", () => {
  const actions = buildProviderActionAvailability(makeState({
    settings: {
      selectedProviderId: "deepseek",
      isByokEnabled: false,
      lastSuccessfulProviderTest: null,
      lastAppliedKiroBackup: null,
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
              name: "deepseek-v4-flash",
              description: "BYOK routed model",
              note: ""
            }
          ]
        }
      ],
      kiro: {
        autoApplyOnLaunch: false,
        defaultEndpointPort: 43119
      },
      logging: {
        captureHeaders: true,
        captureBodies: false
      },
      runtime: {
        exportHistory: [],
        lastExportBundle: null,
        lastLaunchAttempt: null,
        lastBootstrapAttempt: null,
        selectedExportBundleName: null
      }
    }
  }));

  assert.equal(actions.fetchModels.enabled, true);
  assert.equal(actions.testProvider.enabled, false);
  assert.match(actions.testProvider.reason ?? "", /defaultModel/);
});

test("buildProviderActionAvailability blocks provider test when api key readiness issue exists", () => {
  const actions = buildProviderActionAvailability(makeState({
    readinessIssues: [
      {
        key: "provider-api-key",
        severity: "error",
        title: "Provider API Key 尚未保存",
        detail: "DeepSeek 还没有可用的 API Key。",
        focus: "providers",
        action: "重新保存 API Key"
      }
    ]
  }));

  assert.equal(actions.fetchModels.enabled, false);
  assert.match(actions.fetchModels.reason ?? "", /API Key/);
  assert.equal(actions.testProvider.enabled, false);
  assert.match(actions.testProvider.reason ?? "", /API Key/);
});

test("buildProviderActionAvailability allows fetch and test when api key draft is present", () => {
  const actions = buildProviderActionAvailability(makeState({
    readinessIssues: [
      {
        key: "provider-api-key",
        severity: "error",
        title: "Provider API Key 尚未保存",
        detail: "DeepSeek 还没有可用的 API Key。",
        focus: "providers",
        action: "重新保存 API Key"
      }
    ]
  }), {
    hasDraftApiKey: true
  });

  assert.equal(actions.fetchModels.enabled, true);
  assert.equal(actions.fetchModels.reason, null);
  assert.equal(actions.testProvider.enabled, true);
  assert.equal(actions.testProvider.reason, null);
});

test("buildProviderActionAvailability enables fetch and test when provider draft is minimally valid", () => {
  const actions = buildProviderActionAvailability(makeState());

  assert.equal(actions.save.enabled, true);
  assert.equal(actions.fetchModels.enabled, true);
  assert.equal(actions.fetchModels.reason, null);
  assert.equal(actions.testProvider.enabled, true);
  assert.equal(actions.testProvider.reason, null);
});

test("buildProviderDraftStatus reports clean state when draft matches saved provider and no api key draft exists", () => {
  const state = makeState();
  const savedProvider = state.settings.providers[0];
  const status = buildProviderDraftStatus({
    savedProfile: savedProvider,
    draftProfile: savedProvider,
    draftModels: savedProvider.models,
    hasDraftApiKey: false
  });

  assert.equal(status.hasUnsavedChanges, false);
  assert.match(status.title, /已同步/);
});

test("buildProviderDraftStatus reports unsaved state when api key draft exists", () => {
  const state = makeState();
  const savedProvider = state.settings.providers[0];
  const status = buildProviderDraftStatus({
    savedProfile: savedProvider,
    draftProfile: savedProvider,
    draftModels: savedProvider.models,
    hasDraftApiKey: true
  });

  assert.equal(status.hasUnsavedChanges, true);
  assert.match(status.detail, /API Key/);
});

test("buildProviderDraftStatus reports unsaved state when model draft differs from saved provider", () => {
  const state = makeState();
  const savedProvider = state.settings.providers[0];
  const status = buildProviderDraftStatus({
    savedProfile: savedProvider,
    draftProfile: savedProvider,
    draftModels: [
      ...savedProvider.models,
      {
        id: "deepseek-v4-flash",
        name: "deepseek-v4-flash",
        description: "BYOK routed model",
        note: ""
      }
    ],
    hasDraftApiKey: false
  });

  assert.equal(status.hasUnsavedChanges, true);
  assert.match(status.detail, /保存配置/);
});

test("shouldPromptBeforeReplacingProviderDraft returns false when draft is already synced", () => {
  const state = makeState();
  const savedProvider = state.settings.providers[0];
  const status = buildProviderDraftStatus({
    savedProfile: savedProvider,
    draftProfile: savedProvider,
    draftModels: savedProvider.models,
    hasDraftApiKey: false
  });

  assert.equal(shouldPromptBeforeReplacingProviderDraft(status), false);
});

test("shouldPromptBeforeReplacingProviderDraft returns true when there are unsaved provider edits", () => {
  const state = makeState();
  const savedProvider = state.settings.providers[0];
  const status = buildProviderDraftStatus({
    savedProfile: savedProvider,
    draftProfile: {
      ...savedProvider,
      label: "DeepSeek Draft"
    },
    draftModels: savedProvider.models,
    hasDraftApiKey: false
  });

  assert.equal(shouldPromptBeforeReplacingProviderDraft(status), true);
});

test("buildSetupWorkspaceSummary prioritizes runtime readiness issues during setup mode", () => {
  const summary = buildSetupWorkspaceSummary(makeState({
    readinessIssues: [
      {
        key: "provider-api-key-missing",
        severity: "error",
        title: "Provider Key 缺失",
        detail: "当前还没有可用的 API Key。",
        focus: "providers",
        action: "去填写 Key"
      },
      {
        key: "kiro-not-found",
        severity: "error",
        title: "还没有检测到 Kiro",
        detail: "请先确认 Kiro 安装路径。",
        focus: "kiro",
        action: "去检测 Kiro"
      }
    ]
  }));

  assert.equal(summary.blockerCount, 2);
  assert.match(summary.title, /2 个阻塞项/);
  assert.equal(summary.items.length, 2);
  assert.equal(summary.items[0]?.source, "readiness");
  assert.equal(summary.items[0]?.actionLabel, "去填写 Key");
  assert.equal(summary.items[0]?.focus, "providers");
});

test("buildSetupWorkspaceSummary falls back to pending quickstart items when readiness issues are absent", () => {
  const summary = buildSetupWorkspaceSummary(makeState());

  assert.equal(summary.blockerCount, 2);
  assert.equal(summary.items.length, 2);
  assert.equal(summary.items[0]?.source, "quickstart");
  assert.equal(summary.items[0]?.id, "test");
  assert.equal(summary.items[0]?.actionLabel, "去做测试");
  assert.match(summary.title, /还差 2 步/);
});

test("inspectDesktopBridge reports complete bridge when all methods are present", () => {
  const bridge = Object.fromEntries(
    getRequiredBridgeMethods().map((method) => [method, () => undefined])
  );

  const status = inspectDesktopBridge(bridge);

  assert.equal(status.available, true);
  assert.equal(status.complete, true);
  assert.equal(status.presentMethodCount, status.totalMethodCount);
  assert.deepEqual(status.missingMethods, []);
  assert.equal(status.tone, "success");
});

test("inspectDesktopBridge reports missing methods for outdated packaged bridge", () => {
  const bridge = {
    getState: () => undefined,
    bootstrap: () => undefined,
    launchKiroWithProxy: () => undefined
  };

  const status = inspectDesktopBridge(bridge);

  assert.equal(status.available, true);
  assert.equal(status.complete, false);
  assert.equal(status.tone, "warning");
  assert.ok(status.missingMethods.includes("fetchModels"));
  assert.ok(status.missingMethods.includes("diagnoseKiro"));
  assert.match(status.detail, /请重新安装最新版 Kiro\+\+ Console/);
});

test("inspectDesktopBridge reports unavailable bridge when preload did not inject", () => {
  const status = inspectDesktopBridge(undefined);

  assert.equal(status.available, false);
  assert.equal(status.complete, false);
  assert.equal(status.presentMethodCount, 0);
  assert.equal(status.totalMethodCount, getRequiredBridgeMethods().length);
  assert.equal(status.tone, "error");
  assert.match(status.detail, /没有注入 Kiro\+\+ 桌面桥接/);
});

test("buildDesktopHealthSummary reports ready state when bridge, build, proxy, and kiro detection are healthy", () => {
  const summary = buildDesktopHealthSummary({
    bridgeStatus: inspectDesktopBridge(
      Object.fromEntries(getRequiredBridgeMethods().map((method) => [method, () => undefined]))
    ),
    appMeta: {
      version: "0.1.0",
      isPackaged: true,
      source: "packaged",
      buildLabel: "安装包",
      appPath: "C:\\Program Files\\Kiro++ Console\\resources\\app.asar"
    },
    proxyStatus: {
      state: "running",
      endpoint: "http://127.0.0.1:43119",
      error: null
    },
    kiroDetection: {
      installed: true,
      detectionHint: "已检测到 Kiro。"
    }
  });

  assert.equal(summary.severity, "success");
  assert.equal(summary.items.length, 0);
  assert.match(summary.summary, /已就绪/);
});

test("buildDesktopHealthSummary prioritizes bridge and build problems for outdated installs", () => {
  const summary = buildDesktopHealthSummary({
    bridgeStatus: inspectDesktopBridge({
      getState: () => undefined,
      bootstrap: () => undefined,
      launchKiroWithProxy: () => undefined
    }),
    appMeta: null,
    proxyStatus: {
      state: "stopped",
      endpoint: null,
      error: null
    },
    kiroDetection: {
      installed: false,
      detectionHint: "尚未检测到 Kiro 安装。"
    }
  });

  assert.equal(summary.severity, "warning");
  assert.ok(summary.items.some((item) => item.key === "bridge-outdated" && item.actionKind === "open-quickstart"));
  assert.ok(summary.items.some((item) => item.key === "build-meta-missing" && item.actionKind === "open-quickstart"));
  assert.ok(summary.items.some((item) => item.key === "proxy-not-running" && item.actionKind === "start-proxy"));
  assert.ok(summary.items.some((item) => item.key === "kiro-not-detected" && item.actionKind === "open-kiro"));
});

test("formatDesktopHealthSummary renders item actions into shareable text", () => {
  const summary = buildDesktopHealthSummary({
    bridgeStatus: inspectDesktopBridge({
      getState: () => undefined,
      bootstrap: () => undefined,
      launchKiroWithProxy: () => undefined
    }),
    appMeta: null,
    proxyStatus: {
      state: "stopped",
      endpoint: null,
      error: null
    },
    kiroDetection: {
      installed: false,
      detectionHint: "尚未检测到 Kiro 安装。"
    }
  });

  const text = formatDesktopHealthSummary(summary);

  assert.match(text, /Desktop health:/);
  assert.match(text, /Desktop health severity: warning/);
  assert.match(text, /当前安装包桥接不完整 -> 查看 Quickstart/);
  assert.match(text, /本地代理尚未运行 -> 启动代理/);
});
