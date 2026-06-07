/// <reference types="vite/client" />

import type { AppState, DiagnosticsExportBundle, PlaygroundRequest } from "../../shared/types";

declare global {
  interface Window {
    kiroPlusApp: {
      getState: () => Promise<AppState>;
      bootstrap: () => Promise<AppState>;
      launchKiroWithProxy: () => Promise<unknown>;
      openResource: (resourceId: string) => Promise<unknown>;
      openPath: (target: string) => Promise<unknown>;
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
