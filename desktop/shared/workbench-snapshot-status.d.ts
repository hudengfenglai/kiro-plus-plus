import type { WorkbenchExportSnapshot } from "./types";

export type WorkbenchSnapshotAvailability = {
  state: "unknown" | "ready" | "missing";
  label: string;
  detail: string;
};

export function describeWorkbenchSnapshotAvailability(
  snapshot: WorkbenchExportSnapshot | null | undefined
): WorkbenchSnapshotAvailability;
