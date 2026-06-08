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
import { resolveResourcePath } from "./resource-paths.js";
import { buildAppMeta } from "./app-meta.js";

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
  ipcMain.handle(IPC_CHANNELS.appGetMeta, async () => buildAppMeta({
    version: app.getVersion(),
    isPackaged: app.isPackaged,
    appPath: app.getAppPath()
  }));
  ipcMain.handle(IPC_CHANNELS.appBootstrap, async () => runtime.bootstrap());
  ipcMain.handle(IPC_CHANNELS.appLaunchKiro, async () => runtime.launchKiroWithProxy());
  ipcMain.handle(IPC_CHANNELS.appOpenResource, async (_event, resourceId) => {
    const target = await resolveResourcePath(resourceId, {
      appPath: app.getAppPath(),
      cwd: process.cwd()
    });
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
  ipcMain.handle(IPC_CHANNELS.diagnosticsExportZip, async () => runtime.exportDiagnosticsZip());
  ipcMain.handle(IPC_CHANNELS.diagnosticsClearHistory, async () => runtime.clearDiagnosticsHistory());
  ipcMain.handle(IPC_CHANNELS.diagnosticsSelectBundle, async (_event, bundleName) => runtime.selectExportBundle(bundleName));
  ipcMain.handle(IPC_CHANNELS.diagnosticsDeleteBundle, async (_event, bundleName) => runtime.deleteExportBundle(bundleName));

  ipcMain.handle(IPC_CHANNELS.proxyStart, async () => runtime.startProxy());
  ipcMain.handle(IPC_CHANNELS.proxyStop, async () => runtime.stopProxy());
  ipcMain.handle(IPC_CHANNELS.proxyRestart, async () => runtime.restartProxy());
  ipcMain.handle(IPC_CHANNELS.proxySetEnabled, async (_event, enabled) => runtime.setByokEnabled(Boolean(enabled)));
  ipcMain.handle(IPC_CHANNELS.proxySetAutoApplyOnLaunch, async (_event, enabled) => runtime.setAutoApplyOnLaunch(Boolean(enabled)));

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
