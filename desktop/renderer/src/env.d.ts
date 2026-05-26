/// <reference types="vite/client" />

import type { AppState, PlaygroundRequest } from "../../shared/types";

declare global {
  interface Window {
    kiroPlusApp: {
      getState: () => Promise<AppState>;
      bootstrap: () => Promise<AppState>;
      launchKiroWithProxy: () => Promise<unknown>;
      openResource: (resourceId: string) => Promise<unknown>;
      exportDiagnostics: () => Promise<string>;
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
