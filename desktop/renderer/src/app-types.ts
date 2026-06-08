import type { DiagnosticsExportBundle } from "../../shared/types";

export type ViewKey = "home" | "console";
export type ResourceKey = "quickstart" | "readme" | "providers" | "streaming" | "plan";
export type ConsoleFocus = "status" | "providers" | "kiro" | "logs" | "playground";
export type WorkbenchTab = "logs" | "output" | "diagnostics";
export type ThemeKey = "dark" | "light";

export type ActionEntry = {
  id: string;
  title: string;
  detail: string;
  tone: "info" | "success" | "error";
  at: string;
};

export type PendingProviderReplaceAction =
  | null
  | { kind: "apply-preset" }
  | { kind: "switch-provider"; providerId: string };

export type RunAction = (
  action: () => Promise<unknown>,
  options: {
    pending: string;
    success: string;
    failure?: string;
    afterFocus?: ConsoleFocus;
  }
) => Promise<unknown>;

export type DesktopHealthAction = {
  actionKind: "open-quickstart" | "open-logs" | "open-kiro" | "start-proxy" | "enable-byok" | "refresh-diagnose";
  focus: ConsoleFocus;
};

export type LogFilters = {
  operation: string;
  status: string;
  errorOnly: boolean;
};

export type ExportSummary = {
  bundleName: string;
  headline: string;
  recommendedAction: DiagnosticsExportBundle["recommendedAction"] | null;
  zipName: string;
  readmeName: string;
  summaryName: string;
  snapshotName: string;
  manifestName: string;
  requestsName: string;
  exportedAt: string | null;
};
