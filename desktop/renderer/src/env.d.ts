/// <reference types="vite/client" />

import type { AppMeta, AppState, DiagnosticsExportBundle, PlaygroundRequest } from "../../shared/types";

declare global {
  interface Window {
    kiroPlusApp: {
      getState: () => Promise<AppState>;
      getAppMeta?: () => Promise<AppMeta>;
      bootstrap: () => Promise<AppState>;
      launchKiroWithProxy: () => Promise<unknown>;
      openResource: (resourceId: string) => Promise<unknown>;
      openPath: (target: string) => Promise<unknown>;
      copyText?: (text: string) => Promise<boolean> | boolean;
      exportDiagnostics: () => Promise<string>;
      exportDiagnosticsToFile: () => Promise<DiagnosticsExportBundle>;
      exportDiagnosticsZip: () => Promise<DiagnosticsExportBundle>;
      clearDiagnosticsHistory: () => Promise<AppState>;
      selectDiagnosticsBundle: (bundleName: string) => Promise<AppState>;
      deleteDiagnosticsBundle: (bundleName: string) => Promise<AppState>;
      startProxy: () => Promise<unknown>;
      stopProxy: () => Promise<unknown>;
      restartProxy: () => Promise<unknown>;
      setByokEnabled: (enabled: boolean) => Promise<unknown>;
      setAutoApplyOnLaunch: (enabled: boolean) => Promise<AppState>;
      saveProvider: (payload: unknown) => Promise<unknown>;
      testProvider: (payload: unknown) => Promise<unknown>;
      fetchModels: (payload: unknown) => Promise<unknown>;
      detectKiro: () => Promise<unknown>;
      applyRouting: () => Promise<unknown>;
      diagnoseKiro: () => Promise<unknown>;
      restoreKiro: () => Promise<unknown>;
      listLogs: (filters?: unknown) => Promise<unknown>;
      sendPlayground: (payload: PlaygroundRequest) => Promise<unknown>;
    };
  }
}

export {};
