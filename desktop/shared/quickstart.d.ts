import type { AppState } from "./types";

export type QuickstartItem = {
  id: string;
  title: string;
  detail: string;
  done: boolean;
  current: boolean;
  focus: "status" | "providers" | "kiro" | "logs" | "playground";
  actionLabel: string;
  actionKind:
    | "open-provider"
    | "fetch-models"
    | "test-provider"
    | "start-proxy"
    | "enable-byok"
    | "apply-routing"
    | "diagnose";
};

export type QuickstartSummary = {
  totalCount: number;
  completedCount: number;
  remainingCount: number;
  isComplete: boolean;
  percent: number;
  nextItem: QuickstartItem | null;
  nextLabel: string;
  modeLabel: string;
  launchActionLabel: string;
  showSetupWorkspace: boolean;
  showSetupRail: boolean;
  bannerTitle: string;
  bannerDetail: string;
};

export type KiroActionAvailability = {
  startProxy: { enabled: boolean; reason: string | null };
  restartProxy: { enabled: boolean; reason: string | null };
  stopProxy: { enabled: boolean; reason: string | null };
  applyRouting: { enabled: boolean; reason: string | null };
  toggleByok: { enabled: boolean; reason: string | null };
  diagnose: { enabled: boolean; reason: string | null };
  restore: { enabled: boolean; reason: string | null };
};

export type ProviderActionAvailability = {
  save: { enabled: boolean; reason: string | null };
  fetchModels: { enabled: boolean; reason: string | null };
  testProvider: { enabled: boolean; reason: string | null };
};

export type ProviderActionAvailabilityOptions = {
  hasDraftApiKey?: boolean;
};

export type ProviderDraftStatus = {
  hasUnsavedChanges: boolean;
  title: string;
  detail: string;
};

export type SetupWorkspaceSummaryItem = {
  id: string;
  source: "readiness" | "quickstart";
  title: string;
  detail: string;
  focus: "status" | "providers" | "kiro" | "logs" | "playground";
  actionLabel: string;
};

export type SetupWorkspaceSummary = {
  blockerCount: number;
  title: string;
  detail: string;
  items: SetupWorkspaceSummaryItem[];
};

export function buildQuickstartChecklist(state: AppState): QuickstartItem[];
export function summarizeQuickstartChecklist(items: QuickstartItem[]): QuickstartSummary;
export function buildKiroActionAvailability(state: AppState): KiroActionAvailability;
export function buildProviderActionAvailability(
  state: AppState,
  options?: ProviderActionAvailabilityOptions
): ProviderActionAvailability;
export function buildProviderDraftStatus(input: {
  savedProfile: AppState["settings"]["providers"][number] | null;
  draftProfile: AppState["settings"]["providers"][number] | null;
  draftModels: AppState["settings"]["providers"][number]["models"];
  hasDraftApiKey?: boolean;
}): ProviderDraftStatus;
export function shouldPromptBeforeReplacingProviderDraft(status: ProviderDraftStatus): boolean;
export function buildSetupWorkspaceSummary(state: AppState): SetupWorkspaceSummary;
