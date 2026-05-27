import { contextBridge, ipcRenderer } from "electron";

import { IPC_CHANNELS } from "../shared/ipc.js";

contextBridge.exposeInMainWorld("kiroPlusApp", {
  getState: () => ipcRenderer.invoke(IPC_CHANNELS.appGetState),
  bootstrap: () => ipcRenderer.invoke(IPC_CHANNELS.appBootstrap),
  launchKiroWithProxy: () => ipcRenderer.invoke(IPC_CHANNELS.appLaunchKiro),
  openResource: (resourceId) => ipcRenderer.invoke(IPC_CHANNELS.appOpenResource, resourceId),
  exportDiagnostics: () => ipcRenderer.invoke(IPC_CHANNELS.diagnosticsExport),
  startProxy: () => ipcRenderer.invoke(IPC_CHANNELS.proxyStart),
  stopProxy: () => ipcRenderer.invoke(IPC_CHANNELS.proxyStop),
  restartProxy: () => ipcRenderer.invoke(IPC_CHANNELS.proxyRestart),
  setByokEnabled: (enabled) => ipcRenderer.invoke(IPC_CHANNELS.proxySetEnabled, enabled),
  saveProvider: (payload) => ipcRenderer.invoke(IPC_CHANNELS.providerSave, payload),
  testProvider: (payload) => ipcRenderer.invoke(IPC_CHANNELS.providerTest, payload),
  fetchModels: (payload) => ipcRenderer.invoke(IPC_CHANNELS.providerFetchModels, payload),
  detectKiro: () => ipcRenderer.invoke(IPC_CHANNELS.kiroDetect),
  applyRouting: () => ipcRenderer.invoke(IPC_CHANNELS.kiroApplyRouting),
  diagnoseKiro: () => ipcRenderer.invoke(IPC_CHANNELS.kiroDiagnose),
  restoreKiro: () => ipcRenderer.invoke(IPC_CHANNELS.kiroRestore),
  listLogs: (filters) => ipcRenderer.invoke(IPC_CHANNELS.logsList, filters),
  sendPlayground: (payload) => ipcRenderer.invoke(IPC_CHANNELS.playgroundSend, payload)
});
