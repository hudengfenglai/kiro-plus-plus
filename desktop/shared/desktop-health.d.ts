import type { AppMeta, ProxyStatus } from "./types";
import type { DesktopBridgeStatus } from "./bridge-status";

export type DesktopHealthItem = {
  key: string;
  severity: "error" | "warning" | "info";
  title: string;
  detail: string;
  actionLabel: string;
  actionKind: "open-quickstart" | "open-logs" | "open-kiro" | "start-proxy";
  focus: "status" | "providers" | "kiro" | "logs" | "playground";
};

export type DesktopHealthSummary = {
  severity: "success" | "warning" | "error";
  summary: string;
  detail: string;
  items: DesktopHealthItem[];
};

export function buildDesktopHealthSummary(input: {
  bridgeStatus: DesktopBridgeStatus;
  appMeta: AppMeta | null;
  proxyStatus: ProxyStatus;
  kiroDetection: {
    installed: boolean;
    detectionHint: string;
  };
}): DesktopHealthSummary;
