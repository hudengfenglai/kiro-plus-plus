import type { AppMeta, ProxyStatus } from "./types";
import type { DesktopBridgeStatus } from "./bridge-status";

export type DesktopHealthItem = {
  key: string;
  severity: "error" | "warning" | "info";
  title: string;
  detail: string;
  actionLabel: string;
  actionKind: "open-quickstart" | "open-logs" | "open-kiro" | "start-proxy" | "enable-byok" | "refresh-diagnose";
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
  isByokEnabled?: boolean;
  kiroDetection: {
    installed: boolean;
    detectionHint: string;
  };
  diagnose?: {
    localRegions?: string[];
    autoModeBlocksByok?: boolean;
    profileAutoModeBlocksByok?: boolean;
  } | null;
}): DesktopHealthSummary;
export function formatDesktopHealthSummary(summary: DesktopHealthSummary): string;
export function getDesktopHealthPrimaryAction(summary: DesktopHealthSummary): {
  actionLabel: string;
  actionKind: "open-quickstart" | "open-logs" | "open-kiro" | "start-proxy" | "enable-byok" | "refresh-diagnose" | "open-playground";
  focus: "status" | "providers" | "kiro" | "logs" | "playground";
  title: string;
  detail: string;
};
export function formatDesktopHealthHeadline(summary: DesktopHealthSummary): string;
