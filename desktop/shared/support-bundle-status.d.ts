import type { DiagnosticsExportBundle } from "./types";

export type SupportBundleAvailability = {
  state: "unknown" | "ready" | "missing" | "zip-missing";
  label: string;
  detail: string;
};

export function formatMissingPathLabels(missingPaths?: string[]): string[];
export function describeSupportBundleAvailability(
  bundle: DiagnosticsExportBundle | null | undefined
): SupportBundleAvailability;
