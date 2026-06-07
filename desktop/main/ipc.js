import { access } from "node:fs/promises";
import { app, ipcMain, shell } from "electron";
import { join } from "node:path";

import { IPC_CHANNELS } from "../shared/ipc.js";
import { createSecretStore } from "./services/secret-store.js";
import { ProviderCatalogService } from "./services/provider-catalog-service.js";
import { ProxyService } from "./services/proxy-service.js";
import { KiroIntegrationService } from "./services/kiro-integration-service.js";
import { LogService } from "./services/log-service.js";
import { SettingsStore } from "./services/settings-store.js";
import { DesktopRuntime } from "./runtime.js";

export function createDesktopRuntime() {
  const settingsStore = new SettingsStore({
    configPath: join(app.getPath("userData"), "settings.json")
  });
  const secretStore = createSecretStore();
  const providerCatalog = new ProviderCatalogService();
  const proxyService = new ProxyService();
  const kiroService = new KiroIntegrationService();
  const logService = new LogService();

  return new DesktopRuntime({
    settingsStore,
    secretStore,
    providerCatalog,
    proxyService,
    kiroService,
    logService,
    diagnosticsExportDir: join(app.getPath("userData"), "exports")
  });
}

export function registerIpcHandlers(runtime = createDesktopRuntime()) {
  ipcMain.handle(IPC_CHANNELS.appGetState, async () => runtime.getState());
  ipcMain.handle(IPC_CHANNELS.appBootstrap, async () => runtime.bootstrap());
  ipcMain.handle(IPC_CHANNELS.appLaunchKiro, async () => runtime.launchKiroWithProxy());
  ipcMain.handle(IPC_CHANNELS.appOpenResource, async (_event, resourceId) => {
    const resources = {
      readme: [
        join(process.cwd(), "docs", "README.md"),
        join(process.cwd(), "README.md")
      ],
      providers: [join(process.cwd(), "docs", "domestic-providers.md")],
      streaming: [join(process.cwd(), "docs", "streaming-chat.md")],
      plan: [
        join(process.cwd(), "docs", "project-kiro-plus-plus.md"),
        join(process.cwd(), "planning", "project-kiro-plus-plus.md")
      ]
    };
    const candidates = resources[resourceId];
    if (!candidates) {
      throw new Error(`Unknown resource: ${resourceId}`);
    }
    let target = null;
    for (const candidate of candidates) {
      try {
        await access(candidate);
        target = candidate;
        break;
      } catch {
        // try next
      }
    }
    if (!target) {
      throw new Error(`Resource is unavailable: ${resourceId}`);
    }
    const result = await shell.openPath(target);
    if (result) {
      throw new Error(result);
    }
    return { ok: true, target };
  });
  ipcMain.handle(IPC_CHANNELS.appOpenPath, async (_event, target) => {
    if (!target || typeof target !== "string") {
      throw new Error("Path is required");
    }
    const result = await shell.openPath(target);
    if (result) {
      throw new Error(result);
    }
    return { ok: true, target };
  });
  ipcMain.handle(IPC_CHANNELS.diagnosticsExport, async () => runtime.exportDiagnostics());
  ipcMain.handle(IPC_CHANNELS.diagnosticsExportFile, async () => runtime.exportDiagnosticsToFile());

  ipcMain.handle(IPC_CHANNELS.proxyStart, async () => runtime.startProxy());
  ipcMain.handle(IPC_CHANNELS.proxyStop, async () => runtime.stopProxy());
  ipcMain.handle(IPC_CHANNELS.proxyRestart, async () => runtime.restartProxy());
  ipcMain.handle(IPC_CHANNELS.proxySetEnabled, async (_event, enabled) => runtime.setByokEnabled(Boolean(enabled)));

  ipcMain.handle(IPC_CHANNELS.providerSave, async (_event, payload) => runtime.saveProvider(payload));
  ipcMain.handle(IPC_CHANNELS.providerTest, async (_event, payload) => runtime.testProvider(payload));
  ipcMain.handle(IPC_CHANNELS.providerFetchModels, async (_event, payload) => runtime.fetchModels(payload));

  ipcMain.handle(IPC_CHANNELS.kiroDetect, async () => runtime.detectKiro());
  ipcMain.handle(IPC_CHANNELS.kiroApplyRouting, async () => runtime.applyRouting());
  ipcMain.handle(IPC_CHANNELS.kiroDiagnose, async () => runtime.diagnoseKiro());
  ipcMain.handle(IPC_CHANNELS.kiroRestore, async () => runtime.restoreKiro());
  ipcMain.handle(IPC_CHANNELS.logsList, async (_event, filters) => runtime.listLogs(filters));
  ipcMain.handle(IPC_CHANNELS.playgroundSend, async (_event, payload) => runtime.sendPlayground(payload));

  return runtime;
}
