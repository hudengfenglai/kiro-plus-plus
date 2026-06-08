import type { DiagnosticsLogSnapshot, DiagnosticsSummarySource, RecentLogsSource, RequestLogEntry } from "./types";

export function buildLogShareText(
  entry: DiagnosticsLogSnapshot | RequestLogEntry | null,
  kind: "failure" | "success"
): string;

export function buildSupportSnapshotText(input: {
  bundleName: string;
  headline?: string;
  recommendedAction?: {
    title: string;
    actionLabel: string;
    detail?: string;
  } | null;
  latestFailure?: DiagnosticsLogSnapshot | RequestLogEntry | null;
  latestSuccess?: DiagnosticsLogSnapshot | RequestLogEntry | null;
  viewingHistoricalBundle: boolean;
}): string;

export function buildOutputTimelineText(entries: Array<{
  tone: string;
  title: string;
  at: string;
  detail: string;
}>): string;

export function buildOutputShareText(input: {
  entries: Array<{
    tone: string;
    title: string;
    at: string;
    detail: string;
  }>;
  viewingHistoricalBundle: boolean;
  currentBundleName: string | null;
  selectedProviderLabel: string;
  proxyEndpoint: string | null;
  proxyState: string;
  isByokEnabled: boolean;
}): string;

export function buildWorkbenchShareText(input: {
  bundleName: string | null;
  recentLogsSource: RecentLogsSource;
  diagnosticsSummarySource: DiagnosticsSummarySource;
  diagnosticsSummary: string;
  outputShareText: string;
  outputCount: number;
  outputSessionStartedAt: null | string;
  latestFailure: DiagnosticsLogSnapshot | RequestLogEntry | null;
  latestSuccess: DiagnosticsLogSnapshot | RequestLogEntry | null;
}): string;

export function buildWorkbenchShareMarkdown(input: {
  bundleName: string | null;
  recentLogsSource: RecentLogsSource;
  diagnosticsSummarySource: DiagnosticsSummarySource;
  diagnosticsSummary: string;
  outputShareText: string;
  outputCount: number;
  outputSessionStartedAt: null | string;
  latestFailure: DiagnosticsLogSnapshot | RequestLogEntry | null;
  latestSuccess: DiagnosticsLogSnapshot | RequestLogEntry | null;
  exportedAt: string;
}): string;
