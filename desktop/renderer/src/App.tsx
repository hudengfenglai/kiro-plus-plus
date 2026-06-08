import { useEffect, useMemo, useState } from "react";

import {
  PROVIDER_PRESETS,
  buildProviderProfileFromPreset
} from "../../shared/provider-presets";
import {
  buildKiroActionAvailability,
  buildProviderActionAvailability,
  buildProviderDraftStatus,
  buildQuickstartChecklist,
  buildSetupWorkspaceSummary,
  shouldPromptBeforeReplacingProviderDraft,
  summarizeQuickstartChecklist,
  type QuickstartItem
} from "../../shared/quickstart";
import { inspectDesktopBridge } from "../../shared/bridge-status";
import { buildDesktopHealthSummary } from "../../shared/desktop-health";
import type {
  AppMeta,
  AppState,
  DiagnosticsExportBundle,
  DiagnosticsLogSnapshot,
  LaunchAttempt,
  PlaygroundResult,
  ProviderModel,
  ProviderProfile,
  RequestLogEntry
} from "../../shared/types";

type ViewKey = "home" | "console";
type ResourceKey = "quickstart" | "readme" | "providers" | "streaming" | "plan";
type ConsoleFocus = "status" | "providers" | "kiro" | "logs" | "playground";
type WorkbenchTab = "logs" | "output" | "diagnostics";
type ThemeKey = "dark" | "light";

type ActionEntry = {
  id: string;
  title: string;
  detail: string;
  tone: "info" | "success" | "error";
  at: string;
};

type PlaygroundState = PlaygroundResult & { requestedAt: string };
type PendingProviderReplaceAction =
  | null
  | { kind: "apply-preset" }
  | { kind: "switch-provider"; providerId: string };

const emptyState: AppState = {
  settings: {
    selectedProviderId: "deepseek",
    isByokEnabled: false,
    lastSuccessfulProviderTest: null,
    lastAppliedKiroBackup: null,
    providers: [buildProviderProfileFromPreset("deepseek")],
    kiro: {
      autoApplyOnLaunch: false,
      defaultEndpointPort: 43119
    },
    logging: {
      captureHeaders: true,
      captureBodies: false
    },
    runtime: {
      exportHistory: [],
      lastExportBundle: null,
      lastLaunchAttempt: null,
      lastBootstrapAttempt: null,
      selectedExportBundleName: null
    }
  },
  proxyStatus: {
    state: "stopped",
    endpoint: null,
    error: null
  },
  kiroDetection: {
    installed: false,
    installPath: null,
    searchedInstallPaths: [],
    detectionHint: "尚未检测 Kiro 安装。",
    settingsPath: "",
    profilesDir: "",
    backupDir: "",
    lastBackup: null
  },
  diagnose: null,
  recentLogs: [],
  bootstrap: {
    recommendedTab: "providers",
    steps: []
  },
  readinessIssues: [],
  lastSuccessfulProviderTest: null,
  lastAppliedKiroBackup: null,
  exportHistory: [],
  lastExportBundle: null,
  lastLaunchAttempt: null,
  lastBootstrapAttempt: null
};

const proxyStateLabels: Record<AppState["proxyStatus"]["state"], string> = {
  stopped: "未启动",
  starting: "启动中",
  running: "运行中",
  error: "异常"
};

const resourceLinks: Array<{ key: ResourceKey; title: string; body: string }> = [
  {
    key: "quickstart",
    title: "Quickstart",
    body: "安装版的最短上手路径、启动预热和支持包说明。"
  },
  {
    key: "readme",
    title: "README",
    body: "安装、运行方式、支持边界和最短接入路径。"
  },
  {
    key: "providers",
    title: "Provider 文档",
    body: "国内 Provider 的 Base URL、模型名和示例。"
  },
  {
    key: "streaming",
    title: "Streaming / Kiro 说明",
    body: "Kiro 兼容 event-stream 与协议映射记录。"
  },
  {
    key: "plan",
    title: "项目计划",
    body: "当前 backlog、阶段目标和公开发布准备记录。"
  }
];

function describeError(error: unknown) {
  if (error instanceof Error) {
    return {
      summary: error.message,
      detail: error.stack ?? error.message
    };
  }
  return {
    summary: String(error),
    detail: String(error)
  };
}

function requireDesktopApi() {
  if (window.kiroPlusApp) {
    return new Proxy(window.kiroPlusApp, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === "function") {
          return value.bind(target);
        }
        if (value !== undefined) {
          return value;
        }
        throw new Error(`当前安装包缺少桌面桥接方法：${String(prop)}。请重新安装最新版 Kiro++ Console。`);
      }
    });
  }
  throw new Error("桌面桥接不可用。请安装最新版 Kiro++ 后重新启动应用。");
}

function nowIso() {
  return new Date().toISOString();
}

async function writeClipboardText(text: string) {
  const api = window.kiroPlusApp;
  if (api?.copyText) {
    await api.copyText(text);
    return;
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  throw new Error("当前环境不支持复制到剪贴板。请升级最新版 Kiro++ Console。");
}

function makeActionEntry(title: string, detail: string, tone: ActionEntry["tone"]): ActionEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    title,
    detail,
    tone,
    at: nowIso()
  };
}

function formatTime(value?: null | string) {
  if (!value) return "暂无";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function basename(value?: null | string) {
  if (!value) return "暂无";
  const parts = value.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) ?? value;
}

function describeLaunchStep(step?: null | string) {
  switch (step) {
    case "detect-kiro":
      return "检测 Kiro";
    case "start-proxy":
      return "启动代理";
    case "apply-routing":
      return "应用路由";
    case "launch-kiro":
      return "拉起 Kiro";
    default:
      return step ?? "暂无";
  }
}

function describeLaunchStatus(attempt: LaunchAttempt | null) {
  if (!attempt) {
    return {
      title: "尚未通过 Kiro++ 启动 Kiro",
      tone: "info" as const
    };
  }
  if (attempt.status === "success") {
    return {
      title: "最近一次启动成功",
      tone: "success" as const
    };
  }
  if (attempt.status === "error") {
    return {
      title: "最近一次启动失败",
      tone: "error" as const
    };
  }
  return {
    title: "最近一次启动进行中",
    tone: "info" as const
  };
}

function describeBootstrapStep(step?: null | string) {
  switch (step) {
    case "bootstrap-disabled":
      return "未启用预热";
    case "bootstrap-start":
      return "开始预热";
    case "apply-routing":
      return "应用路由";
    case "bootstrap-ready":
      return "已就绪";
    case "bootstrap-failed":
      return "预热失败";
    default:
      return step ?? "暂无";
  }
}

function describeBootstrapStatus(attempt: LaunchAttempt | null) {
  if (!attempt) {
    return {
      title: "暂无启动预热记录",
      tone: "info" as const
    };
  }
  if (attempt.status === "success") {
    return {
      title: "最近一次启动预热成功",
      tone: "success" as const
    };
  }
  if (attempt.status === "error") {
    return {
      title: "最近一次启动预热失败",
      tone: "error" as const
    };
  }
  if (attempt.status === "skipped") {
    return {
      title: "最近一次启动预热已跳过",
      tone: "info" as const
    };
  }
  return {
    title: "最近一次启动预热进行中",
    tone: "info" as const
  };
}

function summarizeLog(entry: DiagnosticsLogSnapshot | RequestLogEntry | null) {
  if (!entry) {
    return {
      title: "暂无记录",
      body: "还没有可展示的请求。"
    };
  }

  return {
    title: `${entry.operation || "未知操作"} / ${entry.status}`,
    body: `requestId ${entry.requestId ?? "-"} · ${formatTime(entry.at)}`
  };
}

function buildLogShareText(entry: DiagnosticsLogSnapshot | RequestLogEntry | null, kind: "failure" | "success") {
  if (!entry) {
    return kind === "failure"
      ? "最近失败：暂无记录"
      : "最近成功：暂无记录";
  }

  return [
    `${kind === "failure" ? "最近失败" : "最近成功"}：${entry.operation || "未知操作"} / HTTP ${entry.status}`,
    `requestId: ${entry.requestId ?? "-"}`,
    `time: ${entry.at}`,
    `durationMs: ${entry.durationMs ?? "-"}`,
    `bodyBytes: ${entry.bodyBytes ?? "-"}`
  ].join("\n");
}

function buildSupportSnapshotText({
  bundleName,
  headline,
  recommendedAction,
  latestFailure,
  latestSuccess,
  viewingHistoricalBundle
}: {
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
}) {
  return [
    `支持快照：${bundleName}`,
    viewingHistoricalBundle ? "模式：历史支持包快照" : "模式：当前支持包",
    headline ? `首屏摘要：${headline}` : null,
    recommendedAction
      ? `推荐下一步：${recommendedAction.title} -> ${recommendedAction.actionLabel}`
      : null,
    recommendedAction?.detail ? `说明：${recommendedAction.detail}` : null,
    buildLogShareText(latestFailure ?? null, "failure"),
    buildLogShareText(latestSuccess ?? null, "success")
  ].filter(Boolean).join("\n");
}

function collectUnavailableReasons(actions: Record<string, { enabled: boolean; reason: string | null }>) {
  return Array.from(
    new Set(
      Object.values(actions)
        .filter((item) => !item.enabled && item.reason)
        .map((item) => item.reason as string)
    )
  );
}

function buildModelsText(models: ProviderModel[]) {
  return models.map((model) => model.id).join("\n");
}

function parseModelsText(text: string, previous: ProviderModel[]) {
  const previousMap = new Map(previous.map((model) => [model.id, model]));
  const modelIds = text
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  return modelIds.map((modelId) => {
    const existing = previousMap.get(modelId);
    if (existing) return existing;
    return {
      id: modelId,
      name: modelId,
      description: "BYOK routed model",
      note: ""
    };
  });
}

function deriveFocusMeta(focus: ConsoleFocus) {
  switch (focus) {
    case "providers":
      return {
        status: "先把 Provider 存好，再测试一次最小请求。",
        workbench: "output" as WorkbenchTab
      };
    case "kiro":
      return {
        status: "先确认代理运行，再应用 BYOK 和诊断。",
        workbench: "diagnostics" as WorkbenchTab
      };
    case "logs":
      return {
        status: "先看失败请求，再复制诊断摘要。",
        workbench: "logs" as WorkbenchTab
      };
    case "playground":
      return {
        status: "右栏会直接给你一条真实模型验证结果。",
        workbench: "output" as WorkbenchTab
      };
    default:
      return {
        status: "从左侧配置开始，按步骤推进到 Kiro 验证。",
        workbench: "output" as WorkbenchTab
      };
  }
}

function pickRecommendedFocus(state: AppState): ConsoleFocus {
  const recommendation = state.bootstrap.recommendedTab;
  if (recommendation === "status") return "status";
  if (recommendation === "providers") return "providers";
  if (recommendation === "kiro") return "kiro";
  if (recommendation === "logs") return "logs";
  if (recommendation === "playground") return "playground";
  return "status";
}

export function App() {
  const [theme, setTheme] = useState<ThemeKey>("dark");
  const [view, setView] = useState<ViewKey>("home");
  const [state, setState] = useState<AppState>(emptyState);
  const [status, setStatus] = useState("正在读取应用状态...");
  const [statusDetail, setStatusDetail] = useState("");
  const [providerDraft, setProviderDraft] = useState<ProviderProfile | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [presetId, setPresetId] = useState("deepseek");
  const [modelsText, setModelsText] = useState(buildModelsText(emptyState.settings.providers[0].models));
  const [focus, setFocus] = useState<ConsoleFocus>("status");
  const [workbenchTab, setWorkbenchTab] = useState<WorkbenchTab>("output");
  const [logFilters, setLogFilters] = useState({
    operation: "",
    status: "",
    errorOnly: false
  });
  const [logRows, setLogRows] = useState<AppState["recentLogs"]>([]);
  const [diagnosticsSummary, setDiagnosticsSummary] = useState("");
  const [actionEntries, setActionEntries] = useState<ActionEntry[]>([]);
  const [playgroundPrompt, setPlaygroundPrompt] = useState("请简要说明当前模型是否可用，并返回一句中文结论。");
  const [playgroundProviderId, setPlaygroundProviderId] = useState("");
  const [playgroundModelId, setPlaygroundModelId] = useState("");
  const [playgroundResult, setPlaygroundResult] = useState<null | PlaygroundState>(null);
  const [lastExportBundle, setLastExportBundle] = useState<DiagnosticsExportBundle | null>(null);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const [pendingProviderReplaceAction, setPendingProviderReplaceAction] = useState<PendingProviderReplaceAction>(null);
  const [appMeta, setAppMeta] = useState<AppMeta | null>(null);

  const providerOptions = useMemo(() => Object.values(PROVIDER_PRESETS), []);
  const bridgeStatus = useMemo(() => inspectDesktopBridge(window.kiroPlusApp), []);
  const desktopHealth = useMemo(
    () => buildDesktopHealthSummary({
      bridgeStatus,
      appMeta,
      proxyStatus: state.proxyStatus,
      isByokEnabled: state.settings.isByokEnabled,
      kiroDetection: {
        installed: state.kiroDetection.installed,
        detectionHint: state.kiroDetection.detectionHint
      },
      diagnose: state.diagnose
    }),
    [appMeta, bridgeStatus, state.diagnose, state.kiroDetection.detectionHint, state.kiroDetection.installed, state.proxyStatus, state.settings.isByokEnabled]
  );

  const selectedProvider = useMemo(
    () =>
      providerDraft
      ?? state.settings.providers.find((provider) => provider.id === state.settings.selectedProviderId)
      ?? state.settings.providers[0]
      ?? null,
    [providerDraft, state.settings.providers, state.settings.selectedProviderId]
  );

  const selectedProviderLabel = selectedProvider?.label ?? "未配置";
  const primaryIssue = state.readinessIssues[0] ?? null;

  const viewingHistoricalBundle = Boolean(
    lastExportBundle
    && state.lastExportBundle
    && lastExportBundle.bundleName !== state.lastExportBundle.bundleName
  );

  const latestFailure = useMemo(
    () => {
      if (viewingHistoricalBundle && lastExportBundle?.latestFailure) {
        return lastExportBundle.latestFailure;
      }
      return [...logRows].find((entry) => entry.status >= 400) ?? null;
    },
    [lastExportBundle, logRows, viewingHistoricalBundle]
  );

  const latestSuccess = useMemo(
    () => {
      if (viewingHistoricalBundle && lastExportBundle?.latestSuccess) {
        return lastExportBundle.latestSuccess;
      }
      return [...logRows].find((entry) => entry.status >= 200 && entry.status < 400) ?? null;
    },
    [lastExportBundle, logRows, viewingHistoricalBundle]
  );
  const launchStatus = useMemo(
    () => describeLaunchStatus(state.lastLaunchAttempt),
    [state.lastLaunchAttempt]
  );
  const bootstrapStatus = useMemo(
    () => describeBootstrapStatus(state.lastBootstrapAttempt),
    [state.lastBootstrapAttempt]
  );
  const quickstartChecklist = useMemo(
    () => buildQuickstartChecklist(state),
    [state]
  );
  const quickstartSummary = useMemo(
    () => summarizeQuickstartChecklist(quickstartChecklist),
    [quickstartChecklist]
  );
  const kiroActionAvailability = useMemo(
    () => buildKiroActionAvailability(state),
    [state]
  );
  const providerActionAvailability = useMemo(
    () => buildProviderActionAvailability(state, { hasDraftApiKey: Boolean(apiKey.trim()) }),
    [apiKey, state]
  );
  const providerActionHints = useMemo(
    () => collectUnavailableReasons(providerActionAvailability),
    [providerActionAvailability]
  );
  const kiroActionHints = useMemo(
    () => collectUnavailableReasons(kiroActionAvailability),
    [kiroActionAvailability]
  );
  const setupWorkspaceSummary = useMemo(
    () => buildSetupWorkspaceSummary(state),
    [state]
  );

  const outputEntries = useMemo(
    () => [...actionEntries].sort((a, b) => (a.at < b.at ? 1 : -1)),
    [actionEntries]
  );

  const exportSummary = useMemo(() => {
    if (!lastExportBundle) return null;
    return {
      bundleName: lastExportBundle.bundleName || basename(lastExportBundle.bundleDir),
      headline: lastExportBundle.headline ?? "",
      recommendedAction: lastExportBundle.recommendedAction ?? null,
      zipName: basename(lastExportBundle.zipPath ?? null),
      readmeName: basename(lastExportBundle.readmePath),
      summaryName: basename(lastExportBundle.summaryPath),
      snapshotName: basename(lastExportBundle.jsonPath),
      manifestName: basename(lastExportBundle.manifestPath),
      requestsName: basename(lastExportBundle.requestsPath),
      exportedAt: lastExportBundle.exportedAt ?? null
    };
  }, [lastExportBundle]);

  const exportHistory = useMemo(
    () => state.exportHistory ?? [],
    [state.exportHistory]
  );

  const selectedProviderModels = useMemo(
    () => parseModelsText(modelsText, selectedProvider?.models ?? []),
    [modelsText, selectedProvider]
  );
  const providerDraftStatus = useMemo(() => {
    const savedProfile = state.settings.providers.find((provider) => provider.id === selectedProvider?.id)
      ?? state.settings.providers[0]
      ?? null;
    return buildProviderDraftStatus({
      savedProfile,
      draftProfile: selectedProvider,
      draftModels: selectedProviderModels,
      hasDraftApiKey: Boolean(apiKey.trim())
    });
  }, [apiKey, selectedProvider, selectedProviderModels, state.settings.providers]);

  const providerForPlayground = useMemo(
    () => state.settings.providers.find((provider) => provider.id === playgroundProviderId)
      ?? state.settings.providers[0]
      ?? null,
    [playgroundProviderId, state.settings.providers]
  );

  async function refresh(nextFocus?: ConsoleFocus) {
    const api = requireDesktopApi();
    const [nextState, summary] = await Promise.all([
      hasBootstrapped ? api.getState() : api.bootstrap(),
      api.exportDiagnostics()
    ]);

    const preservedBundle = lastExportBundle
      ? nextState.exportHistory.find((bundle) => bundle.bundleName === lastExportBundle.bundleName)
      : null;
    const nextSelectedBundle = preservedBundle ?? nextState.lastExportBundle ?? null;

    setState(nextState);
    setLogRows(nextState.recentLogs);
    setDiagnosticsSummary(nextSelectedBundle?.text || summary);
    setLastExportBundle(nextSelectedBundle);

    const current = nextState.settings.providers.find((provider) => provider.id === nextState.settings.selectedProviderId)
      ?? nextState.settings.providers[0]
      ?? null;

    setProviderDraft(current);
    setPresetId(current?.providerPresetId ?? "deepseek");
    setModelsText(buildModelsText(current?.models ?? []));

    const providerId = current?.id ?? "";
    setPlaygroundProviderId((previous) => previous || providerId);
    setPlaygroundModelId((previous) => previous || current?.defaultModel || "");

    if (nextFocus) {
      const meta = deriveFocusMeta(nextFocus);
      setFocus(nextFocus);
      setWorkbenchTab(meta.workbench);
    }
    if (!hasBootstrapped) {
      setHasBootstrapped(true);
    }
  }

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("kiro-plus-plus-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
      document.documentElement.dataset.theme = savedTheme;
    } else {
      document.documentElement.dataset.theme = "dark";
    }
  }, []);

  useEffect(() => {
    if (typeof window.kiroPlusApp?.getAppMeta !== "function") {
      return;
    }
    window.kiroPlusApp.getAppMeta()
      .then((meta) => setAppMeta(meta))
      .catch(() => {
        // Older packaged builds may not expose app metadata yet.
      });
  }, []);

  useEffect(() => {
    refresh()
      .then(() => setStatus("桌面控制台已就绪。"))
      .catch((error) => {
        const parsed = describeError(error);
        setStatus(parsed.summary);
        setStatusDetail(parsed.detail);
      });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("kiro-plus-plus-theme", theme);
  }, [theme]);

  function pushOutput(title: string, detail: string, tone: ActionEntry["tone"]) {
    setActionEntries((previous) => [makeActionEntry(title, detail, tone), ...previous].slice(0, 12));
  }

  async function runAction(
    action: () => Promise<unknown>,
    {
      pending,
      success,
      failure,
      afterFocus
    }: {
      pending: string;
      success: string;
      failure?: string;
      afterFocus?: ConsoleFocus;
    }
  ) {
    try {
      setStatus(pending);
      setStatusDetail("");
      const result = await action();
      await refresh(afterFocus);
      setStatus(success);
      pushOutput(success, typeof result === "string" ? result : JSON.stringify(result, null, 2), "success");
      return result;
    } catch (error) {
      const parsed = describeError(error);
      const summary = failure ?? parsed.summary;
      setStatus(summary);
      setStatusDetail(parsed.detail);
      pushOutput(summary, parsed.detail, "error");
      throw error;
    }
  }

  function openConsole(targetFocus: ConsoleFocus) {
    const meta = deriveFocusMeta(targetFocus);
    setFocus(targetFocus);
    setWorkbenchTab(meta.workbench);
    setStatus(meta.status);
    setView("console");
  }

  async function handleReadinessAction(issue: AppState["readinessIssues"][number]) {
    switch (issue.key) {
      case "proxy-not-running":
        return runAction(() => requireDesktopApi().startProxy(), {
          pending: "正在启动本地代理...",
          success: "代理已启动。",
          afterFocus: "kiro"
        });
      case "kiro-byok-disabled":
        return runAction(() => requireDesktopApi().setByokEnabled(true), {
          pending: "正在启用 BYOK...",
          success: "BYOK 已启用。",
          afterFocus: "kiro"
        });
      case "kiro-no-local-region":
      case "unsupported-operations":
        return runAction(() => requireDesktopApi().diagnoseKiro(), {
          pending: "正在刷新诊断...",
          success: "诊断已刷新。",
          afterFocus: "logs"
        });
      default:
        openConsole(issue.focus);
        return Promise.resolve();
    }
  }

  async function handleDesktopHealthAction(item: {
    actionKind: "open-quickstart" | "open-logs" | "open-kiro" | "start-proxy" | "enable-byok" | "refresh-diagnose";
    focus: ConsoleFocus;
  }) {
    switch (item.actionKind) {
      case "open-quickstart":
        return runAction(
          () => requireDesktopApi().openResource("quickstart"),
          {
            pending: "正在打开 Quickstart...",
            success: "Quickstart 已打开。",
            afterFocus: "status"
          }
        );
      case "open-logs":
        openConsole("logs");
        return Promise.resolve();
      case "open-kiro":
        openConsole("kiro");
        return Promise.resolve();
      case "start-proxy":
        return runAction(() => requireDesktopApi().startProxy(), {
          pending: "正在启动本地代理...",
          success: "代理已启动。",
          afterFocus: "kiro"
        });
      case "enable-byok":
        return runAction(() => requireDesktopApi().setByokEnabled(true), {
          pending: "正在启用 BYOK...",
          success: "BYOK 已启用。",
          afterFocus: "kiro"
        });
      case "refresh-diagnose":
        return runAction(() => requireDesktopApi().diagnoseKiro(), {
          pending: "正在刷新诊断...",
          success: "诊断已刷新。",
          afterFocus: "logs"
        });
      default:
        openConsole(item.focus);
        return Promise.resolve();
    }
  }

  async function refreshLogs(nextFilters = logFilters) {
    try {
      const rows = await requireDesktopApi().listLogs({
        operation: nextFilters.operation || undefined,
        status: nextFilters.status ? Number(nextFilters.status) : undefined,
        errorOnly: nextFilters.errorOnly
      });
      setLogRows(rows as AppState["recentLogs"]);
    } catch (error) {
      const parsed = describeError(error);
      setStatus(parsed.summary);
      setStatusDetail(parsed.detail);
    }
  }

  function updateProviderDraft(next: ProviderProfile) {
    setProviderDraft(next);
    setModelsText(buildModelsText(next.models));
  }

  function replaceProviderDraft(next: ProviderProfile | null) {
    setProviderDraft(next);
    setPresetId(next?.providerPresetId ?? "deepseek");
    setModelsText(buildModelsText(next?.models ?? []));
    setApiKey("");
    setPlaygroundProviderId(next?.id ?? "");
    setPlaygroundModelId(next?.defaultModel ?? "");
    setFocus("providers");
  }

  function executePendingProviderReplaceAction(action: Exclude<PendingProviderReplaceAction, null>) {
    if (action.kind === "apply-preset") {
      const next = buildProviderProfileFromPreset(presetId);
      replaceProviderDraft(next);
      return;
    }

    const next = state.settings.providers.find((provider) => provider.id === action.providerId) ?? null;
    replaceProviderDraft(next);
  }

  function requestReplaceProviderDraft(action: Exclude<PendingProviderReplaceAction, null>) {
    if (!shouldPromptBeforeReplacingProviderDraft(providerDraftStatus)) {
      executePendingProviderReplaceAction(action);
      return;
    }
    setPendingProviderReplaceAction(action);
  }

  function applyPresetToDraft() {
    requestReplaceProviderDraft({ kind: "apply-preset" });
  }

  function confirmPendingProviderReplaceAction() {
    if (!pendingProviderReplaceAction) {
      return;
    }
    executePendingProviderReplaceAction(pendingProviderReplaceAction);
    setPendingProviderReplaceAction(null);
  }

  function cancelPendingProviderReplaceAction() {
    setPendingProviderReplaceAction(null);
  }

  async function handleSaveProvider() {
    if (!selectedProvider) return;
    const normalizedModels = selectedProviderModels;
    const normalizedDefaultModel = normalizedModels.find((model) => model.id === selectedProvider.defaultModel)?.id
      ?? normalizedModels[0]?.id
      ?? selectedProvider.defaultModel;

    await runAction(
      () =>
        requireDesktopApi().saveProvider({
          profile: {
            ...selectedProvider,
            models: normalizedModels,
            defaultModel: normalizedDefaultModel
          },
          apiKey: apiKey.trim() || undefined
        }),
      {
        pending: "正在保存 Provider 配置...",
        success: "Provider 配置已保存。",
        afterFocus: "providers"
      }
    );
    setApiKey("");
  }

  async function handleFetchModels() {
    if (!selectedProvider) return;
    const result = await runAction(
      () => requireDesktopApi().fetchModels({ profile: selectedProvider, apiKey: apiKey.trim() || undefined }),
      {
        pending: "正在拉取远程模型列表...",
        success: "模型列表已刷新。",
        afterFocus: "providers"
      }
    );

    const items = (result as Array<{ id: string; name?: string }>)
      .filter((item) => item?.id)
      .map((item) => ({
        id: item.id,
        name: item.name ?? item.id,
        description: "BYOK routed model",
        note: ""
      }));

    if (items.length > 0 && selectedProvider) {
      const nextProvider = {
        ...selectedProvider,
        models: items,
        defaultModel: items.find((item) => item.id === selectedProvider.defaultModel)?.id ?? items[0].id
      };
      updateProviderDraft(nextProvider);
      pushOutput("已同步模型草稿", `当前草稿包含 ${items.length} 个模型。`, "info");
    }
  }

  async function handleTestProvider() {
    if (!selectedProvider) return;
    const result = await runAction(
      () =>
        requireDesktopApi().testProvider({
          profile: selectedProvider,
          apiKey: apiKey.trim() || undefined,
          modelId: selectedProvider.defaultModel,
          prompt: playgroundPrompt
        }),
      {
        pending: "正在测试 Provider 连通性...",
        success: "Provider 测试成功。",
        afterFocus: "playground"
      }
    );
    const typed = result as PlaygroundResult;
    setPlaygroundResult({
      ...typed,
      requestedAt: nowIso()
    });
  }

  async function handlePlaygroundSend() {
    if (!providerForPlayground || !playgroundModelId.trim()) return;
    const result = await runAction(
      () =>
        requireDesktopApi().sendPlayground({
          providerId: providerForPlayground.id,
          modelId: playgroundModelId.trim(),
          prompt: playgroundPrompt
        }),
      {
        pending: "正在发送模型验证请求...",
        success: "模型验证完成。",
        afterFocus: "playground"
      }
    );
    setPlaygroundResult({
      ...(result as PlaygroundResult),
      requestedAt: nowIso()
    });
  }

  async function copyDiagnosticsSummary() {
    await runAction(
      async () => {
        const text = diagnosticsSummary || await requireDesktopApi().exportDiagnostics();
        await writeClipboardText(text);
        setDiagnosticsSummary(text);
        return text;
      },
      {
        pending: "正在复制脱敏诊断摘要...",
        success: "诊断摘要已复制。",
        afterFocus: "logs"
      }
    );
  }

  async function exportDiagnosticsToFile() {
    const result = await runAction(
      () => requireDesktopApi().exportDiagnosticsToFile(),
      {
        pending: "正在导出诊断文件...",
        success: "诊断文件已导出。",
        afterFocus: "logs"
      }
    );
    const typed = result as DiagnosticsExportBundle;
    setLastExportBundle(typed);
    if (typed.text) {
      setDiagnosticsSummary(typed.text);
    }
    if (typed.bundleDir) {
      setStatusDetail(
        [
          `导出目录：${typed.bundleDir}`,
          typed.readmePath ? `说明：${typed.readmePath}` : null,
          typed.summaryPath ? `摘要：${typed.summaryPath}` : null,
          typed.jsonPath ? `快照：${typed.jsonPath}` : null,
          typed.requestsPath ? `请求：${typed.requestsPath}` : null,
          typed.manifestPath ? `清单：${typed.manifestPath}` : null
        ].filter(Boolean).join("\n")
      );
    }
  }

  async function exportDiagnosticsZip() {
    const result = await runAction(
      () => requireDesktopApi().exportDiagnosticsZip(),
      {
        pending: "正在导出 zip 支持包...",
        success: "zip 支持包已导出。",
        afterFocus: "logs"
      }
    );
    const typed = result as DiagnosticsExportBundle;
    setLastExportBundle(typed);
    if (typed.text) {
      setDiagnosticsSummary(typed.text);
    }
    setStatusDetail(
      [
        `导出目录：${typed.bundleDir}`,
        typed.zipPath ? `压缩包：${typed.zipPath}` : null,
        `说明：${typed.readmePath}`,
        `摘要：${typed.summaryPath}`,
        `快照：${typed.jsonPath}`,
        `请求：${typed.requestsPath}`,
        `清单：${typed.manifestPath}`
      ].filter(Boolean).join("\n")
    );
  }

  async function openExportBundleDir() {
    const bundleDir = lastExportBundle?.bundleDir;
    if (!bundleDir) {
      setStatus("还没有可打开的导出目录。");
      return;
    }
    await runAction(
      () => requireDesktopApi().openPath(bundleDir),
      {
        pending: "正在打开导出目录...",
        success: "导出目录已打开。",
        afterFocus: "logs"
      }
    );
  }

  async function copyExportHeadline() {
    if (!exportSummary?.headline) {
      setStatus("当前支持包没有可复制的首屏摘要。");
      return;
    }
    await runAction(
      async () => {
        await writeClipboardText(exportSummary.headline);
        return exportSummary.headline;
      },
      {
        pending: "正在复制首屏摘要...",
        success: "首屏摘要已复制。",
        afterFocus: "logs"
      }
    );
  }

  async function copyRecommendedAction() {
    const action = exportSummary?.recommendedAction;
    if (!action?.title || !action?.actionLabel) {
      setStatus("当前支持包没有可复制的推荐下一步。");
      return;
    }
    const text = [`推荐下一步：${action.title} -> ${action.actionLabel}`, action.detail ? `说明：${action.detail}` : null]
      .filter(Boolean)
      .join("\n");
    await runAction(
      async () => {
        await writeClipboardText(text);
        return text;
      },
      {
        pending: "正在复制推荐下一步...",
        success: "推荐下一步已复制。",
        afterFocus: "logs"
      }
    );
  }

  async function copySupportSnapshot() {
    if (!exportSummary) {
      setStatus("当前没有可复制的支持快照。");
      return;
    }
    const text = buildSupportSnapshotText({
      bundleName: exportSummary.bundleName,
      headline: exportSummary.headline,
      recommendedAction: exportSummary.recommendedAction,
      latestFailure,
      latestSuccess,
      viewingHistoricalBundle
    });
    await runAction(
      async () => {
        await writeClipboardText(text);
        return text;
      },
      {
        pending: "正在复制支持快照...",
        success: "支持快照已复制。",
        afterFocus: "logs"
      }
    );
  }

  async function runRecommendedAction() {
    const action = exportSummary?.recommendedAction;
    if (!action?.actionKind) {
      setStatus("当前支持包没有可执行的推荐下一步。");
      return;
    }
    if (viewingHistoricalBundle) {
      const latestBundle = state.lastExportBundle ?? exportHistory[0] ?? null;
      if (!latestBundle) {
        setStatus("当前没有可切换的最新支持包。");
        return;
      }
      const nextState = await selectExportBundleState(latestBundle);
      const nextAction = nextState.lastExportBundle?.recommendedAction ?? null;
      if (!nextAction?.actionKind) {
        setStatus("已回到最新支持包，但当前没有可执行的推荐下一步。");
        return;
      }
      await handleDesktopHealthAction({
        actionKind: nextAction.actionKind as "open-quickstart" | "open-logs" | "open-kiro" | "start-proxy" | "enable-byok" | "refresh-diagnose",
        focus: (nextAction.focus as ConsoleFocus | undefined) ?? "status"
      });
      return;
    }
    await handleDesktopHealthAction({
      actionKind: action.actionKind as "open-quickstart" | "open-logs" | "open-kiro" | "start-proxy" | "enable-byok" | "refresh-diagnose",
      focus: (action.focus as ConsoleFocus | undefined) ?? "status"
    });
  }

  async function copyLogSummary(entry: DiagnosticsLogSnapshot | RequestLogEntry | null, kind: "failure" | "success") {
    const text = buildLogShareText(entry, kind);
    await runAction(
      async () => {
        await writeClipboardText(text);
        return text;
      },
      {
        pending: `正在复制最近${kind === "failure" ? "失败" : "成功"}摘要...`,
        success: `最近${kind === "failure" ? "失败" : "成功"}摘要已复制。`,
        afterFocus: "logs"
      }
    );
  }

  function focusLogEntry(entry: DiagnosticsLogSnapshot | RequestLogEntry | null) {
    if (!entry) {
      setStatus("当前没有可定位的请求记录。");
      return;
    }
    const nextFilters = {
      operation: entry.operation || "",
      status: String(entry.status ?? ""),
      errorOnly: entry.status >= 400
    };
    setLogFilters(nextFilters);
    setFocus("logs");
    setWorkbenchTab("logs");
    setView("console");
    setStatus(`已定位到 ${entry.operation || "未知操作"} / ${entry.status}`);
    void refreshLogs(nextFilters);
  }

  async function handleDiagnosticLogAction(entry: DiagnosticsLogSnapshot | RequestLogEntry | null) {
    if (!entry) {
      setStatus("当前没有可定位的请求记录。");
      return;
    }
    if (viewingHistoricalBundle) {
      await openExportArtifact(lastExportBundle?.requestsPath ?? null, "请求文件");
      return;
    }
    focusLogEntry(entry);
  }

  async function openExportZip() {
    const zipPath = lastExportBundle?.zipPath;
    if (!zipPath) {
      setStatus("还没有可打开的 zip 支持包。");
      return;
    }
    await runAction(
      () => requireDesktopApi().openPath(zipPath),
      {
        pending: "正在打开 zip 支持包...",
        success: "zip 支持包已打开。",
        afterFocus: "logs"
      }
    );
  }

  async function openExportArtifact(target: null | string, label: string) {
    if (!target) {
      setStatus(`还没有可打开的${label}。`);
      return;
    }
    await runAction(
      () => requireDesktopApi().openPath(target),
      {
        pending: `正在打开${label}...`,
        success: `${label}已打开。`,
        afterFocus: "logs"
      }
    );
  }

  function selectExportBundle(bundle: DiagnosticsExportBundle) {
    selectExportBundleState(bundle).catch(() => {
      // runAction already updates status/output
    });
  }

  function selectLatestExportBundle() {
    const latestBundle = state.lastExportBundle ?? exportHistory[0] ?? null;
    if (!latestBundle) {
      setStatus("当前没有可切换的最新支持包。");
      return;
    }
    selectExportBundle(latestBundle);
  }

  function selectExportBundleState(bundle: DiagnosticsExportBundle) {
    return runAction(
      () => requireDesktopApi().selectDiagnosticsBundle(bundle.bundleName),
      {
        pending: `正在切换支持包：${bundle.bundleName}...`,
        success: `已切换到支持包：${bundle.bundleName}`,
        afterFocus: "logs"
      }
    ).then((result) => {
      const typed = result as AppState;
      setState(typed);
      setLastExportBundle(typed.lastExportBundle ?? null);
      setDiagnosticsSummary(typed.lastExportBundle?.text || diagnosticsSummary);
      return typed;
    });
  }

  async function handleQuickstartAction(item: QuickstartItem) {
    switch (item.actionKind) {
      case "fetch-models":
        return handleFetchModels();
      case "test-provider":
        return handleTestProvider();
      case "start-proxy":
        return runAction(() => requireDesktopApi().startProxy(), {
          pending: "正在启动本地代理...",
          success: "代理已启动。",
          afterFocus: "kiro"
        });
      case "enable-byok":
        return runAction(() => requireDesktopApi().setByokEnabled(true), {
          pending: "正在启用 BYOK...",
          success: "BYOK 已启用。",
          afterFocus: "kiro"
        });
      case "apply-routing":
        return runAction(() => requireDesktopApi().applyRouting(), {
          pending: "正在应用 Kiro 配置...",
          success: "Kiro 路由已应用。",
          afterFocus: "kiro"
        });
      case "diagnose":
        return runAction(() => requireDesktopApi().diagnoseKiro(), {
          pending: "正在运行诊断...",
          success: "诊断已刷新。",
          afterFocus: "logs"
        });
      default:
        openConsole(item.focus);
        return Promise.resolve();
    }
  }

  async function handleSetupSummaryAction(item: {
    id: string;
    source: "readiness" | "quickstart";
    focus: ConsoleFocus;
  }) {
    if (item.source === "readiness") {
      const issue = state.readinessIssues.find((entry) => entry.key === item.id);
      if (issue) {
        return handleReadinessAction(issue);
      }
      openConsole(item.focus);
      return Promise.resolve();
    }

    const quickstartItem = quickstartChecklist.find((entry) => entry.id === item.id);
    if (quickstartItem) {
      return handleQuickstartAction(quickstartItem);
    }

    openConsole(item.focus);
    return Promise.resolve();
  }

  async function handleLaunchEntry() {
    if (!quickstartSummary.isComplete && quickstartSummary.nextItem) {
      return handleQuickstartAction(quickstartSummary.nextItem);
    }
    return runAction(() => requireDesktopApi().launchKiroWithProxy(), {
      pending: "正在启动 Kiro++ 入口...",
      success: "Kiro 启动指令已发出。",
      afterFocus: "kiro"
    });
  }

  async function clearExportHistory() {
    const result = await runAction(
      () => requireDesktopApi().clearDiagnosticsHistory(),
      {
        pending: "正在清空支持包历史...",
        success: "支持包历史已清空。",
        afterFocus: "logs"
      }
    );
    const typed = result as AppState;
    setLastExportBundle(typed.lastExportBundle ?? null);
    setState(typed);
  }

  async function deleteExportBundle(bundle: DiagnosticsExportBundle) {
    const result = await runAction(
      () => requireDesktopApi().deleteDiagnosticsBundle(bundle.bundleName),
      {
        pending: `正在移除支持包记录：${bundle.bundleName}...`,
        success: `已移除支持包记录：${bundle.bundleName}`,
        afterFocus: "logs"
      }
    );
    const typed = result as AppState;
    setState(typed);
    setLastExportBundle(typed.lastExportBundle ?? null);
    setDiagnosticsSummary(typed.lastExportBundle?.text || await requireDesktopApi().exportDiagnostics());
  }

  async function openResource(resourceId: ResourceKey) {
    await runAction(
      () => requireDesktopApi().openResource(resourceId),
      {
        pending: "正在打开文档资源...",
        success: "文档已打开。"
      }
    );
  }

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  async function handleToggleAutoApplyOnLaunch() {
    const nextEnabled = !state.settings.kiro.autoApplyOnLaunch;
    const result = await runAction(
      () => requireDesktopApi().setAutoApplyOnLaunch(nextEnabled),
      {
        pending: nextEnabled ? "正在启用启动时自动应用..." : "正在关闭启动时自动应用...",
        success: nextEnabled ? "启动时自动应用已启用。" : "启动时自动应用已关闭。",
        afterFocus: "kiro"
      }
    );
    setState(result as AppState);
  }

  const home = (
    <div className="landing-shell">
      <header className="landing-header">
        <div className="brand-line">
          <div className="brand-mark">K+</div>
          <div>
            <strong>Kiro++</strong>
            <span>
              本地 BYOK 路由与桌面工作台
              {appMeta ? ` · v${appMeta.version} · ${appMeta.buildLabel}` : " · 版本未知"}
            </span>
          </div>
        </div>
        <div className="hero-top-actions">
          <button className="ghost-button" onClick={toggleTheme}>
            {theme === "dark" ? "切换浅色" : "切换深色"}
          </button>
          <button className="ghost-button" onClick={() => openConsole(pickRecommendedFocus(state))}>快速开始</button>
          <button onClick={() => openConsole("status")}>打开工作台</button>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="hero-copy">
            <span className="eyebrow">Windows 优先 / 本地透明 / 多 Provider 路由</span>
            <h1>让 Kiro 使用你自己的 API 与模型</h1>
            <p>
              不改 Kiro 安装目录，只在本地启动代理、写入可恢复配置，并把 DeepSeek、DashScope、
              Moonshot、Zhipu、SiliconFlow 等 Provider 接到 Kiro。
            </p>
            <div className="hero-actions">
              <button onClick={() => openConsole(pickRecommendedFocus(state))}>快速开始</button>
              <button className="ghost-button" onClick={() => openResource("quickstart")}>打开 Quickstart</button>
              <button className="ghost-button" onClick={() => openConsole("providers")}>查看 Provider 配置</button>
              <button className="ghost-button" onClick={() => openConsole("logs")}>查看排错入口</button>
            </div>
            <div className="setup-progress-card">
              <div className="setup-progress-head">
                <strong>接入进度</strong>
                <span>{quickstartSummary.completedCount}/{quickstartSummary.totalCount}</span>
              </div>
              <div className="setup-progress-bar" aria-hidden="true">
                <div className="setup-progress-fill" style={{ width: `${quickstartSummary.percent}%` }} />
              </div>
              <p>{quickstartSummary.nextLabel}</p>
              <div className="button-stack">
                <button onClick={() => quickstartSummary.nextItem ? handleQuickstartAction(quickstartSummary.nextItem) : openConsole("playground")}>
                  {quickstartSummary.nextItem?.actionLabel ?? "去做验证"}
                </button>
                <button className="ghost-button" onClick={() => openConsole(quickstartSummary.nextItem?.focus ?? "status")}>
                  继续设置
                </button>
              </div>
            </div>
          </div>

          <div className="hero-side">
            <div className="hero-side-stack">
            <div className="hero-side-card">
              <span className={`state-pill ${state.proxyStatus.state}`}>{proxyStateLabels[state.proxyStatus.state]}</span>
              <h3>当前接入状态</h3>
              <dl className="kv-grid compact">
                <div><dt>BYOK</dt><dd>{state.settings.isByokEnabled ? "已启用" : "未启用"}</dd></div>
                <div><dt>Provider</dt><dd>{selectedProviderLabel}</dd></div>
                <div><dt>默认模型</dt><dd>{selectedProvider?.defaultModel ?? "未配置"}</dd></div>
                <div><dt>Endpoint</dt><dd>{state.proxyStatus.endpoint ?? `http://127.0.0.1:${state.settings.kiro.defaultEndpointPort}`}</dd></div>
              </dl>
            </div>
            <div className={`hero-side-card bridge-card ${bridgeStatus.tone}`}>
              <span className="panel-tag">Bridge</span>
              <h3>{bridgeStatus.summary}</h3>
              <p>{bridgeStatus.detail}</p>
              <dl className="kv-grid compact">
                <div><dt>可用方法</dt><dd>{bridgeStatus.presentMethodCount}/{bridgeStatus.totalMethodCount}</dd></div>
                <div><dt>状态</dt><dd>{bridgeStatus.complete ? "完整" : bridgeStatus.available ? "需更新安装包" : "桥接缺失"}</dd></div>
              </dl>
            </div>
            <div className="hero-side-card">
              <span className="panel-tag">Build</span>
              <h3>{appMeta ? `v${appMeta.version}` : "版本未知"}</h3>
              <p>{appMeta ? `当前运行于${appMeta.buildLabel}。` : "当前安装包还没有暴露版本元数据，建议重新安装最新版 Kiro++ Console。"}</p>
              <dl className="kv-grid compact">
                <div><dt>来源</dt><dd>{appMeta?.buildLabel ?? "未知"}</dd></div>
                <div><dt>环境</dt><dd>{appMeta?.source === "packaged" ? "packaged" : appMeta?.source === "development" ? "development" : "unknown"}</dd></div>
              </dl>
            </div>
            <div className={`hero-side-card health-card ${desktopHealth.severity}`}>
              <span className="panel-tag">Health</span>
              <h3>{desktopHealth.summary}</h3>
              <p>{desktopHealth.detail}</p>
              <div className="health-list">
                {desktopHealth.items.length === 0 ? (
                  <p className="health-item ok">当前桌面环境没有明显阻塞项。</p>
                ) : (
                  desktopHealth.items.slice(0, 3).map((item) => (
                    <div key={item.key} className={`health-action ${item.severity}`}>
                      <p className={`health-item ${item.severity}`}>{item.title}</p>
                      <button className="ghost-button compact-button" onClick={() => handleDesktopHealthAction(item)}>
                        {item.actionLabel}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="hero-side-card quickstart-card">
              <span className="panel-tag">Quickstart</span>
              <h3>最短上手</h3>
              <ol className="quickstart-list dynamic">
                {quickstartChecklist.map((item, index) => (
                  <li key={item.id} className={`quickstart-item ${item.done ? "done" : ""} ${item.current ? "current" : ""}`}>
                    <div className="quickstart-item-head">
                      <span className="quickstart-item-index">{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                      </div>
                    </div>
                    <button className="ghost-button compact-button" onClick={() => handleQuickstartAction(item)}>
                      {item.actionLabel}
                    </button>
                  </li>
                ))}
              </ol>
              <div className="button-stack">
                <button className="ghost-button" onClick={() => openResource("quickstart")}>打开完整指南</button>
                <button className="ghost-button" onClick={() => openConsole("providers")}>去配置 Provider</button>
              </div>
            </div>
            </div>
          </div>
        </section>

        <section className="section-block">
          <div className="section-head">
            <div>
              <h2>接入步骤</h2>
              <p>这里和工作台使用同一套真实状态，不再保留单独的静态说明。</p>
            </div>
          </div>
          <div className="home-card-grid steps">
            {quickstartChecklist.map((item, index) => (
              <article key={item.id} className={`home-card ${item.done ? "done-card" : ""} ${item.current ? "current-card" : ""}`}>
                <span className="step-index">{String(index + 1).padStart(2, "0")}</span>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
                <button className="ghost-button" onClick={() => handleQuickstartAction(item)}>{item.actionLabel}</button>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block">
          <div className="section-head">
            <div>
              <h2>常用预设</h2>
              <p>只保留高频 Provider，避免在首版工作台里堆满低频字段。</p>
            </div>
          </div>
          <div className="home-card-grid presets">
            {providerOptions.map((provider) => (
              <article key={provider.id} className="home-card provider-card">
                <h3>{provider.label}</h3>
                <p>{provider.baseUrl}</p>
                <strong>{provider.defaultModel}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block">
          <div className="section-head">
            <div>
              <h2>文档入口</h2>
              <p>这里都指向项目里的真实资源，不再放占位链接。</p>
            </div>
          </div>
          <div className="home-card-grid docs">
            {resourceLinks.map((item) => (
              <button key={item.key} className="home-card home-link-card" onClick={() => openResource(item.key)}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );

  const consoleView = (
    <div className="workbench-shell">
      <header className="workbench-topbar">
        <div className="brand-line">
          <div className="brand-mark">K+</div>
          <div>
            <strong>Kiro++ 工作台</strong>
            <span>{status}{appMeta ? ` · v${appMeta.version} · ${appMeta.buildLabel}` : ""}</span>
          </div>
        </div>
        <div className="topbar-actions">
          <div className={`topbar-mode-pill ${quickstartSummary.isComplete ? "ready" : "setup"}`}>
            <span>{quickstartSummary.modeLabel}</span>
            <strong>{quickstartSummary.completedCount}/{quickstartSummary.totalCount}</strong>
          </div>
          <div className={`topbar-mode-pill bridge ${bridgeStatus.tone}`}>
            <span>Bridge</span>
            <strong>{bridgeStatus.complete ? "完整" : "需更新"}</strong>
          </div>
          <button
            className="ghost-button"
            onClick={() => quickstartSummary.nextItem ? handleQuickstartAction(quickstartSummary.nextItem) : openConsole("playground")}
          >
            {quickstartSummary.nextItem?.actionLabel ?? "去做验证"}
          </button>
          <button className="ghost-button" onClick={toggleTheme}>
            {theme === "dark" ? "浅色主题" : "深色主题"}
          </button>
          <button className="ghost-button" onClick={() => setView("home")}>返回首页</button>
          <button onClick={() => handleLaunchEntry()}>
            {quickstartSummary.launchActionLabel}
          </button>
        </div>
      </header>

      <main className="workbench-grid">
        <aside className={`rail left ${focus === "providers" || focus === "kiro" ? "focused" : ""}`}>
          <section className="rail-panel">
            <div className="rail-panel-head">
              <div>
                <span className="panel-tag">Provider</span>
                <h2>配置与保存</h2>
              </div>
              <span className="tiny-meta">{selectedProviderModels.length} 个模型</span>
            </div>

            <label className="field">
              <span>Provider 预设</span>
              <div className="field-row">
                <select value={presetId} onChange={(event) => setPresetId(event.target.value)}>
                  {providerOptions.map((provider) => (
                    <option key={provider.id} value={provider.id}>{provider.label}</option>
                  ))}
                </select>
                <button className="ghost-button compact-button" onClick={applyPresetToDraft}>套用</button>
              </div>
            </label>

            {selectedProvider ? (
              <>
                <label className="field">
                  <span>当前 Provider</span>
                  <select
                    value={selectedProvider.id}
                    onChange={(event) => {
                      requestReplaceProviderDraft({
                        kind: "switch-provider",
                        providerId: event.target.value
                      });
                    }}
                  >
                    {state.settings.providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>{provider.label}</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>provider id</span>
                  <input
                    value={selectedProvider.id}
                    onChange={(event) => updateProviderDraft({ ...selectedProvider, id: event.target.value })}
                  />
                </label>

                <label className="field">
                  <span>label</span>
                  <input
                    value={selectedProvider.label}
                    onChange={(event) => updateProviderDraft({ ...selectedProvider, label: event.target.value })}
                  />
                </label>

                <div className="field-grid">
                  <label className="field">
                    <span>type</span>
                    <select
                      value={selectedProvider.type}
                      onChange={(event) =>
                        updateProviderDraft({ ...selectedProvider, type: event.target.value as ProviderProfile["type"] })
                      }
                    >
                      <option value="openai-compatible">openai-compatible</option>
                      <option value="anthropic">anthropic</option>
                      <option value="gemini">gemini</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>defaultModel</span>
                    <select
                      value={selectedProvider.defaultModel}
                      onChange={(event) => updateProviderDraft({ ...selectedProvider, defaultModel: event.target.value })}
                    >
                      {selectedProviderModels.map((model) => (
                        <option key={model.id} value={model.id}>{model.id}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="field">
                  <span>baseUrl</span>
                  <input
                    value={selectedProvider.baseUrl}
                    onChange={(event) => updateProviderDraft({ ...selectedProvider, baseUrl: event.target.value })}
                  />
                </label>

                <label className="field">
                  <span>apiKey</span>
                  <input
                    type="password"
                    value={apiKey}
                    placeholder="留空则继续使用系统安全存储中的 Key"
                    onChange={(event) => setApiKey(event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>models[]</span>
                  <textarea
                    value={modelsText}
                    onChange={(event) => setModelsText(event.target.value)}
                    placeholder="每行一个 model id"
                  />
                </label>

                <div className="model-chip-list">
                  {selectedProviderModels.map((model) => (
                    <span key={model.id} className={model.id === selectedProvider.defaultModel ? "model-chip active" : "model-chip"}>
                      {model.id}
                    </span>
                  ))}
                </div>

                <div className={providerDraftStatus.hasUnsavedChanges ? "draft-status-banner warning" : "draft-status-banner success"}>
                  <strong>{providerDraftStatus.title}</strong>
                  <p>{providerDraftStatus.detail}</p>
                </div>

                <div className="button-stack">
                  <button
                    className="ghost-button"
                    disabled={!providerActionAvailability.fetchModels.enabled}
                    title={providerActionAvailability.fetchModels.reason ?? undefined}
                    onClick={handleFetchModels}
                  >
                    拉取模型
                  </button>
                  <button
                    className="ghost-button"
                    disabled={!providerActionAvailability.testProvider.enabled}
                    title={providerActionAvailability.testProvider.reason ?? undefined}
                    onClick={handleTestProvider}
                  >
                    测试 Provider
                  </button>
                  <button onClick={handleSaveProvider}>保存配置</button>
                </div>
                {providerActionHints.length > 0 ? (
                  <div className="action-hints">
                    {providerActionHints.map((hint) => (
                      <p key={hint}>{hint}</p>
                    ))}
                  </div>
                ) : (
                  <div className="action-hints success">
                    <p>当前 Provider 已满足最小连通性前置条件，可以直接拉取模型或做测试。</p>
                  </div>
                )}
              </>
            ) : null}
          </section>

          <section className="rail-panel">
            <div className="rail-panel-head">
              <div>
                <span className="panel-tag">Kiro</span>
                <h2>路由与恢复</h2>
              </div>
              <span className={`state-pill ${state.proxyStatus.state}`}>{proxyStateLabels[state.proxyStatus.state]}</span>
            </div>

            <dl className="kv-grid dense">
              <div><dt>本地 endpoint</dt><dd>{state.proxyStatus.endpoint ?? `127.0.0.1:${state.settings.kiro.defaultEndpointPort}`}</dd></div>
              <div><dt>Kiro 安装</dt><dd>{state.kiroDetection.installPath ?? "未检测到"}</dd></div>
              <div><dt>探测提示</dt><dd>{state.kiroDetection.detectionHint}</dd></div>
              <div><dt>最近备份</dt><dd>{state.kiroDetection.lastBackup?.backupPath ?? "暂无"}</dd></div>
              <div><dt>开机预热</dt><dd>{state.settings.kiro.autoApplyOnLaunch ? "已启用" : "未启用"}</dd></div>
            </dl>

            <div className="button-stack">
              <button
                className="ghost-button"
                onClick={handleToggleAutoApplyOnLaunch}
              >
                {state.settings.kiro.autoApplyOnLaunch ? "关闭启动时自动应用" : "启用启动时自动应用"}
              </button>
              <button
                className={quickstartSummary.showSetupWorkspace ? "" : "ghost-button"}
                disabled={!kiroActionAvailability.startProxy.enabled}
                title={kiroActionAvailability.startProxy.reason ?? undefined}
                onClick={() =>
                  runAction(() => requireDesktopApi().startProxy(), {
                    pending: "正在启动本地代理...",
                    success: "代理已启动。",
                    afterFocus: "kiro"
                  })
                }
              >
                启动代理
              </button>
              <button
                className="ghost-button"
                disabled={!kiroActionAvailability.restartProxy.enabled}
                title={kiroActionAvailability.restartProxy.reason ?? undefined}
                onClick={() =>
                  runAction(() => requireDesktopApi().restartProxy(), {
                    pending: "正在重启代理...",
                    success: "代理已重启。",
                    afterFocus: "kiro"
                  })
                }
              >
                重启代理
              </button>
              <button
                className={quickstartSummary.showSetupWorkspace ? "" : "ghost-button"}
                disabled={!kiroActionAvailability.applyRouting.enabled}
                title={kiroActionAvailability.applyRouting.reason ?? undefined}
                onClick={() =>
                  runAction(() => requireDesktopApi().applyRouting(), {
                    pending: "正在应用 Kiro 配置...",
                    success: "Kiro 路由已应用。",
                    afterFocus: "kiro"
                  })
                }
              >
                应用到 Kiro
              </button>
              <button
                className={quickstartSummary.showSetupWorkspace ? "" : "ghost-button"}
                disabled={!kiroActionAvailability.toggleByok.enabled}
                title={kiroActionAvailability.toggleByok.reason ?? undefined}
                onClick={() =>
                  runAction(() => requireDesktopApi().setByokEnabled(!state.settings.isByokEnabled), {
                    pending: state.settings.isByokEnabled ? "正在关闭 BYOK..." : "正在启用 BYOK...",
                    success: state.settings.isByokEnabled ? "BYOK 已关闭。" : "BYOK 已启用。",
                    afterFocus: "kiro"
                  })
                }
              >
                {state.settings.isByokEnabled ? "关闭 BYOK" : "启用 BYOK"}
              </button>
              <button
                className={quickstartSummary.showSetupWorkspace ? "" : "ghost-button"}
                disabled={!kiroActionAvailability.diagnose.enabled}
                title={kiroActionAvailability.diagnose.reason ?? undefined}
                onClick={() =>
                  runAction(() => requireDesktopApi().diagnoseKiro(), {
                    pending: "正在运行诊断...",
                    success: "诊断已刷新。",
                    afterFocus: "logs"
                  })
                }
              >
                运行诊断
              </button>
              {!quickstartSummary.showSetupWorkspace ? (
                <>
                  <button
                    className="ghost-button"
                    disabled={!kiroActionAvailability.stopProxy.enabled}
                    title={kiroActionAvailability.stopProxy.reason ?? undefined}
                    onClick={() =>
                      runAction(() => requireDesktopApi().stopProxy(), {
                        pending: "正在停止代理...",
                        success: "代理已停止。",
                        afterFocus: "kiro"
                      })
                    }
                  >
                    停止代理
                  </button>
                  <button
                    className="ghost-button"
                    disabled={!kiroActionAvailability.restore.enabled}
                    title={kiroActionAvailability.restore.reason ?? undefined}
                    onClick={() =>
                      runAction(() => requireDesktopApi().restoreKiro(), {
                        pending: "正在恢复最近备份...",
                        success: "最近备份已恢复。",
                        afterFocus: "kiro"
                      })
                    }
                  >
                    恢复备份
                  </button>
                </>
              ) : null}
            </div>
            {kiroActionHints.length > 0 ? (
              <div className="action-hints">
                {kiroActionHints.map((hint) => (
                  <p key={hint}>{hint}</p>
                ))}
              </div>
            ) : (
              <div className="action-hints success">
                <p>当前 Kiro 路由动作前置条件已满足，可以继续应用配置、诊断或恢复。</p>
              </div>
            )}
          </section>
        </aside>

        <section className={`workspace ${focus === "status" || focus === "logs" ? "focused" : ""}`}>
          <section className="workspace-hero">
            <div>
              <span className="eyebrow">当前步骤提示</span>
              <h2>先把路由跑通，再考虑更复杂的多模型协同。</h2>
              <p>
                推荐顺序：保存 Provider，测试 Provider，启动代理，启用 BYOK，运行诊断，再到右侧做一次最小模型验证。
              </p>
              <div className="hero-progress-row">
                <div className="hero-progress-copy">
                  <strong>接入进度 {quickstartSummary.completedCount}/{quickstartSummary.totalCount}</strong>
                  <span>{quickstartSummary.nextLabel}</span>
                </div>
                <div className="hero-progress-actions">
                  <button
                    className="ghost-button compact-button"
                    onClick={() => quickstartSummary.nextItem ? handleQuickstartAction(quickstartSummary.nextItem) : openConsole("playground")}
                  >
                    {quickstartSummary.nextItem?.actionLabel ?? "去做验证"}
                  </button>
                  <button
                    className="ghost-button compact-button"
                    onClick={() => openConsole(quickstartSummary.nextItem?.focus ?? "status")}
                  >
                    继续设置
                  </button>
                </div>
              </div>
              <div className="setup-progress-bar hero" aria-hidden="true">
                <div className="setup-progress-fill" style={{ width: `${quickstartSummary.percent}%` }} />
              </div>
              <div className={`setup-banner ${quickstartSummary.isComplete ? "done" : "active"}`}>
                <div className="setup-banner-copy">
                  <strong>{quickstartSummary.bannerTitle}</strong>
                  <p>{quickstartSummary.bannerDetail}</p>
                </div>
                <div className="setup-banner-actions">
                  <button
                    className="ghost-button compact-button"
                    onClick={() => quickstartSummary.nextItem ? handleQuickstartAction(quickstartSummary.nextItem) : openConsole("playground")}
                  >
                    {quickstartSummary.nextItem?.actionLabel ?? "去做验证"}
                  </button>
                  <button
                    className="ghost-button compact-button"
                    onClick={() => openConsole(quickstartSummary.nextItem?.focus ?? "status")}
                  >
                    {quickstartSummary.isComplete ? "打开工作区" : "继续设置"}
                  </button>
                </div>
              </div>
              {primaryIssue ? (
                <div className={`hero-callout ${primaryIssue.severity}`}>
                  <div className="hero-callout-copy">
                    <strong>{primaryIssue.title}</strong>
                    <p>{primaryIssue.detail}</p>
                  </div>
                  <button className="ghost-button compact-button" onClick={() => handleReadinessAction(primaryIssue)}>
                    {primaryIssue.action}
                  </button>
                </div>
              ) : (
                <div className="hero-callout success">
                  <div className="hero-callout-copy">
                    <strong>当前已具备最小使用条件</strong>
                    <p>可以继续在右侧发送一次真实模型验证，或者直接通过顶部入口启动 Kiro。</p>
                  </div>
                  <button className="ghost-button compact-button" onClick={() => openConsole("playground")}>
                    去做验证
                  </button>
                </div>
              )}
            </div>
            <div className="workspace-kpis">
              <div className="kpi-card">
                <span>当前 Provider</span>
                <strong>{selectedProviderLabel}</strong>
              </div>
              <div className="kpi-card">
                <span>默认模型</span>
                <strong>{selectedProvider?.defaultModel ?? "未配置"}</strong>
              </div>
              <div className="kpi-card">
                <span>代理状态</span>
                <strong>{proxyStateLabels[state.proxyStatus.state]}</strong>
              </div>
              <div className={`kpi-card bridge ${bridgeStatus.tone}`}>
                <span>桌面桥接</span>
                <strong>{bridgeStatus.complete ? "完整" : "需更新安装包"}</strong>
              </div>
              <div className="kpi-card">
                <span>当前版本</span>
                <strong>{appMeta ? `v${appMeta.version}` : "未知"}</strong>
              </div>
              <div className={`kpi-card health ${desktopHealth.severity}`}>
                <span>环境自检</span>
                <strong>{desktopHealth.items.length === 0 ? "已就绪" : `${desktopHealth.items.length} 项待处理`}</strong>
              </div>
            </div>
          </section>

          {quickstartSummary.showSetupWorkspace ? (
            <section className="workspace-card setup-workspace-card">
              <div className="card-head">
                <div>
                  <span className="panel-tag">Setup</span>
                  <h3>先完成这几步，再进入常规工作台</h3>
                </div>
                <button className="ghost-button compact-button" onClick={() => openResource("quickstart")}>打开完整指南</button>
              </div>
              <section className="setup-summary-card">
                <div className="setup-summary-head">
                  <div>
                    <span className="panel-tag">Blockers</span>
                    <strong>{setupWorkspaceSummary.title}</strong>
                  </div>
                  <span className="tiny-meta">{setupWorkspaceSummary.blockerCount} 项</span>
                </div>
                <p className="setup-summary-detail">{setupWorkspaceSummary.detail}</p>
                <div className="setup-summary-list">
                  {setupWorkspaceSummary.items.map((item) => (
                    <article key={`${item.source}-${item.id}`} className="setup-summary-item">
                      <div className="setup-summary-copy">
                        <span>{item.source === "readiness" ? "运行时阻塞" : "接入步骤"}</span>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                      </div>
                      <button className="ghost-button compact-button" onClick={() => handleSetupSummaryAction(item)}>
                        {item.actionLabel}
                      </button>
                    </article>
                  ))}
                </div>
              </section>
              <div className="setup-workspace-grid">
                {quickstartChecklist.map((item, index) => (
                  <div key={item.id} className={`quickstart-inline-item ${item.done ? "done" : ""} ${item.current ? "current" : ""}`}>
                    <span className="quickstart-item-index">{String(index + 1).padStart(2, "0")}</span>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                    <button className="ghost-button compact-button" onClick={() => handleQuickstartAction(item)}>
                      {item.actionLabel}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <>
              <section className="step-strip">
                {state.bootstrap.steps.map((step, index) => (
                  <article key={step.key} className={`step-tile ${step.done ? "done" : ""}`}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{step.title}</strong>
                    <p>{step.detail}</p>
                  </article>
                ))}
              </section>

              <section className="workspace-card quickstart-inline-card">
                <div className="card-head">
                  <div>
                    <span className="panel-tag">Quickstart</span>
                    <h3>首次接入建议顺序</h3>
                  </div>
                  <button className="ghost-button compact-button" onClick={() => openResource("quickstart")}>打开完整指南</button>
                </div>
                <div className="quickstart-inline-grid">
                  {quickstartChecklist.map((item, index) => (
                    <div key={item.id} className={`quickstart-inline-item ${item.done ? "done" : ""} ${item.current ? "current" : ""}`}>
                      <span className="quickstart-item-index">{String(index + 1).padStart(2, "0")}</span>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                      <button className="ghost-button compact-button" onClick={() => handleQuickstartAction(item)}>
                        {item.actionLabel}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          <section className="workspace-grid">
            <article className="workspace-card">
              <div className="card-head">
                <div>
                  <span className="panel-tag">状态</span>
                  <h3>当前状态总览</h3>
                </div>
              </div>
              <dl className="kv-grid">
                <div><dt>BYOK</dt><dd>{state.settings.isByokEnabled ? "已启用" : "未启用"}</dd></div>
                <div><dt>代理</dt><dd>{proxyStateLabels[state.proxyStatus.state]}</dd></div>
                <div><dt>本地 endpoint</dt><dd>{state.proxyStatus.endpoint ?? "未启动"}</dd></div>
                <div><dt>最近测试</dt><dd>{state.lastSuccessfulProviderTest?.modelId ?? "尚未测试"}</dd></div>
                <div><dt>最近恢复</dt><dd>{state.lastAppliedKiroBackup?.backupPath ?? "暂无"}</dd></div>
                <div><dt>推荐下一步</dt><dd>{primaryIssue?.action ?? state.bootstrap.steps.find((step) => !step.done)?.title ?? "可以开始实际使用"}</dd></div>
              </dl>
            </article>

            <article className="workspace-card">
              <div className="card-head">
                <div>
                  <span className="panel-tag">路由</span>
                  <h3>Kiro 配置状态</h3>
                </div>
              </div>
              <dl className="kv-grid">
                <div><dt>settings.json</dt><dd>{state.kiroDetection.settingsPath || "未检测"}</dd></div>
                <div><dt>profiles</dt><dd>{state.kiroDetection.profilesDir || "未检测"}</dd></div>
                <div><dt>已检查路径</dt><dd>{state.kiroDetection.searchedInstallPaths.length || 0}</dd></div>
                <div><dt>localRegions</dt><dd>{state.diagnose?.localRegions.join(", ") || "暂无"}</dd></div>
                <div><dt>unsupported</dt><dd>{state.diagnose?.unsupportedOperationsSeen.join(", ") || "无"}</dd></div>
                <div><dt>提示</dt><dd>{state.diagnose?.hint ?? "先运行诊断"}</dd></div>
              </dl>
              {!state.kiroDetection.installPath && state.kiroDetection.searchedInstallPaths.length > 0 ? (
                <pre className="summary-block compact">
                  {state.kiroDetection.searchedInstallPaths.join("\n")}
                </pre>
              ) : null}
            </article>
          </section>

          {!quickstartSummary.showSetupWorkspace ? (
            <section className="workspace-grid">
              <article className={`workspace-card launch-card ${launchStatus.tone}`}>
                <div className="card-head">
                  <div>
                    <span className="panel-tag">Launch</span>
                    <h3>Launch Kiro with Kiro++</h3>
                  </div>
                  <span className="tiny-meta">{formatTime(state.lastLaunchAttempt?.finishedAt ?? state.lastLaunchAttempt?.startedAt ?? null)}</span>
                </div>
                <dl className="kv-grid">
                  <div><dt>结果</dt><dd>{launchStatus.title}</dd></div>
                  <div><dt>阶段</dt><dd>{describeLaunchStep(state.lastLaunchAttempt?.step)}</dd></div>
                  <div><dt>endpoint</dt><dd>{state.lastLaunchAttempt?.endpoint ?? "暂无"}</dd></div>
                  <div><dt>Kiro 路径</dt><dd>{state.lastLaunchAttempt?.installPath ?? "暂无"}</dd></div>
                </dl>
                <p className="launch-detail">{state.lastLaunchAttempt?.detail ?? "点击顶部入口后，这里会记录最近一次启动尝试的阶段和结果。"}</p>
                {state.lastLaunchAttempt?.error ? (
                  <pre className="summary-block compact">{state.lastLaunchAttempt.error}</pre>
                ) : null}
              </article>

              <article className={`workspace-card launch-card ${bootstrapStatus.tone}`}>
                <div className="card-head">
                  <div>
                    <span className="panel-tag">Bootstrap</span>
                    <h3>启动预热状态</h3>
                  </div>
                  <span className="tiny-meta">{formatTime(state.lastBootstrapAttempt?.finishedAt ?? state.lastBootstrapAttempt?.startedAt ?? null)}</span>
                </div>
                <dl className="kv-grid">
                  <div><dt>结果</dt><dd>{bootstrapStatus.title}</dd></div>
                  <div><dt>阶段</dt><dd>{describeBootstrapStep(state.lastBootstrapAttempt?.step)}</dd></div>
                  <div><dt>endpoint</dt><dd>{state.lastBootstrapAttempt?.endpoint ?? "暂无"}</dd></div>
                  <div><dt>Kiro 路径</dt><dd>{state.lastBootstrapAttempt?.installPath ?? "暂无"}</dd></div>
                </dl>
                <p className="launch-detail">{state.lastBootstrapAttempt?.detail ?? "如果开启了启动时自动应用，这里会显示最近一次预热的执行结果。"}</p>
                {state.lastBootstrapAttempt?.error ? (
                  <pre className="summary-block compact">{state.lastBootstrapAttempt.error}</pre>
                ) : null}
              </article>
            </section>
          ) : null}

          {state.readinessIssues.length > 0 ? (
            <section className="workspace-card">
              <div className="card-head">
                <div>
                  <span className="panel-tag">Readiness</span>
                  <h3>当前阻塞项与建议动作</h3>
                </div>
                <span className="tiny-meta">{state.readinessIssues.length} 项</span>
              </div>
              <div className="issue-list">
                {state.readinessIssues.map((issue) => (
                  <article key={issue.key} className={`issue-row ${issue.severity}`}>
                    <div className="issue-copy">
                      <strong>{issue.title}</strong>
                      <p>{issue.detail}</p>
                    </div>
                    <button className="ghost-button compact-button" onClick={() => handleReadinessAction(issue)}>
                      {issue.action}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {!quickstartSummary.showSetupWorkspace ? (
            <section className="workbench-card">
              <div className="card-head">
                <div>
                  <span className="panel-tag">Workbench</span>
                  <h3>真实工作区</h3>
                </div>
                <div className="tab-row">
                  <button className={workbenchTab === "logs" ? "tab-button active" : "tab-button"} onClick={() => setWorkbenchTab("logs")}>日志</button>
                  <button className={workbenchTab === "output" ? "tab-button active" : "tab-button"} onClick={() => setWorkbenchTab("output")}>输出</button>
                  <button className={workbenchTab === "diagnostics" ? "tab-button active" : "tab-button"} onClick={() => setWorkbenchTab("diagnostics")}>诊断摘要</button>
                </div>
              </div>

              {workbenchTab === "logs" && (
                <div className="workbench-body">
                  <div className="filter-row">
                    <input
                      placeholder="按 operation 过滤"
                      value={logFilters.operation}
                      onChange={(event) => setLogFilters((previous) => ({ ...previous, operation: event.target.value }))}
                    />
                    <input
                      placeholder="HTTP 状态码"
                      value={logFilters.status}
                      onChange={(event) => setLogFilters((previous) => ({ ...previous, status: event.target.value }))}
                    />
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={logFilters.errorOnly}
                        onChange={(event) => setLogFilters((previous) => ({ ...previous, errorOnly: event.target.checked }))}
                      />
                      <span>仅失败</span>
                    </label>
                    <button className="ghost-button" onClick={() => refreshLogs()}>刷新日志</button>
                  </div>
                  <div className="log-list">
                    {logRows.map((entry) => (
                      <article key={`${entry.at}-${entry.requestId ?? entry.operation}`} className={`log-row ${entry.status >= 400 ? "error" : ""}`}>
                        <strong>{entry.operation || "unknown"}</strong>
                        <span>{entry.status}</span>
                        <span>{entry.durationMs ?? 0} ms</span>
                        <span>{entry.requestId ?? "-"}</span>
                        <small>{formatTime(entry.at)}</small>
                      </article>
                    ))}
                    {logRows.length === 0 ? <p className="empty-row">暂无日志记录。</p> : null}
                  </div>
                </div>
              )}

              {workbenchTab === "output" && (
                <div className="workbench-body">
                  <div className="output-list">
                    {outputEntries.length === 0 ? <p className="empty-row">动作输出会显示在这里。</p> : null}
                    {outputEntries.map((entry) => (
                      <article key={entry.id} className={`output-row ${entry.tone}`}>
                        <div className="output-meta">
                          <strong>{entry.title}</strong>
                          <small>{formatTime(entry.at)}</small>
                        </div>
                        <pre>{entry.detail}</pre>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {workbenchTab === "diagnostics" && (
                <div className="workbench-body">
                  <div className="summary-actions">
                    <button className="ghost-button" onClick={copyDiagnosticsSummary}>复制脱敏摘要</button>
                    <button className="ghost-button" onClick={exportDiagnosticsToFile}>导出诊断文件</button>
                    <button className="ghost-button" onClick={exportDiagnosticsZip}>导出 zip 支持包</button>
                    <button className="ghost-button" onClick={openExportBundleDir}>打开导出目录</button>
                    <button className="ghost-button" onClick={openExportZip}>打开 zip 支持包</button>
                    <button className="ghost-button" onClick={clearExportHistory}>清空支持包历史</button>
                    <button
                      className="ghost-button"
                      onClick={() =>
                        runAction(() => requireDesktopApi().diagnoseKiro(), {
                          pending: "正在刷新诊断...",
                          success: "诊断已刷新。",
                          afterFocus: "logs"
                        })
                      }
                    >
                      刷新诊断
                    </button>
                  </div>
                  {exportSummary ? (
                    <section className="export-card">
                      <div className="export-card-head">
                        <div>
                          <span className="snapshot-label">Support Bundle</span>
                          <strong>最近一次支持包</strong>
                        </div>
                        <small>{formatTime(exportSummary.exportedAt)}</small>
                      </div>
                      {exportSummary.headline ? (
                        <div className="export-headline">
                          <strong>首屏摘要</strong>
                          <p>{exportSummary.headline}</p>
                          <div className="mini-actions">
                            <button className="ghost-button compact-button" onClick={copyExportHeadline}>复制首屏摘要</button>
                          </div>
                        </div>
                      ) : null}
                      {exportSummary.recommendedAction ? (
                        <div className="export-headline export-recommendation">
                          <strong>推荐下一步</strong>
                          <p>{`${exportSummary.recommendedAction.title} -> ${exportSummary.recommendedAction.actionLabel}`}</p>
                          {exportSummary.recommendedAction.detail ? (
                            <p className="export-subtle">{exportSummary.recommendedAction.detail}</p>
                          ) : null}
                          <div className="mini-actions">
                            <button className="ghost-button compact-button" onClick={runRecommendedAction}>
                              {viewingHistoricalBundle ? "回到最新后执行" : "立即执行"}
                            </button>
                            <button className="ghost-button compact-button" onClick={copyRecommendedAction}>复制推荐下一步</button>
                          </div>
                        </div>
                      ) : null}
                      <dl className="kv-grid compact">
                        <div><dt>目录</dt><dd>{exportSummary.bundleName}</dd></div>
                        <div><dt>zip</dt><dd>{lastExportBundle?.zipPath ? exportSummary.zipName : "未导出"}</dd></div>
                        <div><dt>说明</dt><dd>{exportSummary.readmeName}</dd></div>
                        <div><dt>摘要</dt><dd>{exportSummary.summaryName}</dd></div>
                        <div><dt>快照</dt><dd>{exportSummary.snapshotName}</dd></div>
                        <div><dt>请求</dt><dd>{exportSummary.requestsName}</dd></div>
                        <div><dt>清单</dt><dd>{exportSummary.manifestName}</dd></div>
                      </dl>
                      <div className="export-actions">
                        <button className="ghost-button" onClick={copySupportSnapshot}>复制支持快照</button>
                        <button className="ghost-button" onClick={() => openExportArtifact(lastExportBundle?.readmePath ?? null, "说明文件")}>打开说明</button>
                        <button className="ghost-button" onClick={() => openExportArtifact(lastExportBundle?.summaryPath ?? null, "摘要文件")}>打开摘要</button>
                        <button className="ghost-button" onClick={() => openExportArtifact(lastExportBundle?.jsonPath ?? null, "快照文件")}>打开快照</button>
                        <button className="ghost-button" onClick={() => openExportArtifact(lastExportBundle?.manifestPath ?? null, "清单文件")}>打开清单</button>
                        <button className="ghost-button" onClick={() => openExportArtifact(lastExportBundle?.requestsPath ?? null, "请求文件")}>打开请求</button>
                        {viewingHistoricalBundle ? (
                          <button className="ghost-button" onClick={selectLatestExportBundle}>回到最新支持包</button>
                        ) : null}
                      </div>
                      {viewingHistoricalBundle ? (
                        <p className="export-hint">当前正在查看历史支持包快照；复制摘要会复制这条历史摘要，推荐动作会先自动回到最新支持包，再作用于当前环境。</p>
                      ) : null}
                      {exportHistory.length > 1 ? (
                        <div className="export-history">
                          <div className="export-history-head">
                            <strong>最近支持包历史</strong>
                            <small>保留最近 {exportHistory.length} 次</small>
                          </div>
                          <div className="export-history-list">
                            {exportHistory.map((bundle) => (
                              <div
                                key={bundle.bundleName}
                                className={bundle.bundleName === lastExportBundle?.bundleName ? "history-row active" : "history-row"}
                              >
                                <button
                                  className={bundle.bundleName === lastExportBundle?.bundleName ? "history-chip active" : "history-chip"}
                                  onClick={() => selectExportBundle(bundle)}
                                >
                                  <span>{bundle.bundleName}</span>
                                  <small>{formatTime(bundle.exportedAt)}</small>
                                </button>
                                <button className="ghost-button history-delete" onClick={() => deleteExportBundle(bundle)}>移除</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <p className="export-hint">导出内容已默认脱敏，适合发到 GitHub Issue、LinuxDO 或群内排错。</p>
                    </section>
                  ) : null}
                  <pre className="summary-block">{diagnosticsSummary || "诊断摘要将在这里显示。"}</pre>
                </div>
              )}
            </section>
          ) : null}
        </section>

        <aside className={`rail right ${focus === "playground" || focus === "logs" ? "focused" : ""}`}>
          {quickstartSummary.showSetupRail ? (
            <section className="rail-panel setup-rail-panel">
              <div className="rail-panel-head">
                <div>
                  <span className="panel-tag">Setup Rail</span>
                  <h2>先完成接入，再做验证</h2>
                </div>
              </div>
              <div className="signal-stack">
                {quickstartChecklist.map((item) => (
                  <article key={item.id} className={`signal-card ${item.current ? "error" : ""}`}>
                    <span>{item.current ? "当前步骤" : item.done ? "已完成" : "待处理"}</span>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                    <button className="ghost-button compact-button" onClick={() => handleQuickstartAction(item)}>
                      {item.actionLabel}
                    </button>
                  </article>
                ))}
              </div>
              <div className="button-stack">
                <button className="ghost-button" onClick={() => openResource("quickstart")}>打开 Quickstart</button>
                <button className="ghost-button" onClick={() => openResource("providers")}>打开 Provider 文档</button>
              </div>
            </section>
          ) : (
            <>
              <section className="rail-panel">
                <div className="rail-panel-head">
                  <div>
                    <span className="panel-tag">Playground</span>
                    <h2>单次模型验证</h2>
                  </div>
                </div>

                <label className="field">
                  <span>provider</span>
                  <select value={playgroundProviderId} onChange={(event) => setPlaygroundProviderId(event.target.value)}>
                    {state.settings.providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>{provider.label}</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>model</span>
                  <select value={playgroundModelId} onChange={(event) => setPlaygroundModelId(event.target.value)}>
                    {(providerForPlayground?.models ?? []).map((model) => (
                      <option key={model.id} value={model.id}>{model.id}</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>prompt</span>
                  <textarea value={playgroundPrompt} onChange={(event) => setPlaygroundPrompt(event.target.value)} />
                </label>

                <div className="button-stack">
                  <button onClick={handlePlaygroundSend}>发送验证</button>
                </div>

                <div className="playground-result">
                  <div className="result-head">
                    <strong>{playgroundResult?.ok ? "请求成功" : "等待请求"}</strong>
                    <small>{formatTime(playgroundResult?.requestedAt)}</small>
                  </div>
                  <dl className="kv-grid compact">
                    <div><dt>modelId</dt><dd>{playgroundResult?.modelId ?? (playgroundModelId || "未选择")}</dd></div>
                    <div><dt>latency</dt><dd>{playgroundResult ? `${playgroundResult.latencyMs} ms` : "-"}</dd></div>
                  </dl>
                  <pre>{playgroundResult?.text ?? "发送后在这里显示模型返回文本。"}</pre>
                </div>
              </section>

              <section className="rail-panel">
                <div className="rail-panel-head">
                  <div>
                    <span className="panel-tag">Diagnostics</span>
                    <h2>伴随排错</h2>
                  </div>
                </div>

                <div className="signal-stack">
                  <article className="signal-card error">
                    <span>最近失败</span>
                    <strong>{summarizeLog(latestFailure).title}</strong>
                    <p>{summarizeLog(latestFailure).body}</p>
                    <div className="mini-actions">
                      <button className="ghost-button compact-button" onClick={() => handleDiagnosticLogAction(latestFailure)}>查看详情</button>
                      <button className="ghost-button compact-button" onClick={() => copyLogSummary(latestFailure, "failure")}>复制摘要</button>
                    </div>
                  </article>
                  <article className="signal-card">
                    <span>最近成功</span>
                    <strong>{summarizeLog(latestSuccess).title}</strong>
                    <p>{summarizeLog(latestSuccess).body}</p>
                    <div className="mini-actions">
                      <button className="ghost-button compact-button" onClick={() => handleDiagnosticLogAction(latestSuccess)}>查看详情</button>
                      <button className="ghost-button compact-button" onClick={() => copyLogSummary(latestSuccess, "success")}>复制摘要</button>
                    </div>
                  </article>
                </div>
                {viewingHistoricalBundle ? (
                  <p className="export-hint">当前右侧摘要来自历史支持包快照；“查看详情”会打开该支持包的请求文件，不会跳到当前实时日志。</p>
                ) : null}

                <div className="button-stack">
                  <button className="ghost-button" onClick={() => openResource("quickstart")}>打开 Quickstart</button>
                  <button className="ghost-button" onClick={copyDiagnosticsSummary}>复制诊断摘要</button>
                  <button className="ghost-button" onClick={exportDiagnosticsToFile}>导出诊断文件</button>
                  <button className="ghost-button" onClick={exportDiagnosticsZip}>导出 zip 支持包</button>
                  <button className="ghost-button" onClick={openExportBundleDir}>打开导出目录</button>
                  <button className="ghost-button" onClick={openExportZip}>打开 zip 支持包</button>
                  <button className="ghost-button" onClick={clearExportHistory}>清空支持包历史</button>
                  <button className="ghost-button" onClick={() => openResource("providers")}>打开 Provider 文档</button>
                  <button className="ghost-button" onClick={() => openResource("streaming")}>打开 Streaming 文档</button>
                </div>

                {exportSummary ? (
                  <section className="export-card compact-export-card">
                    <div className="export-card-head">
                      <div>
                        <span className="snapshot-label">Latest Bundle</span>
                        <strong>{exportSummary.bundleName}</strong>
                      </div>
                      <small>{formatTime(exportSummary.exportedAt)}</small>
                    </div>
                    {exportSummary.headline ? (
                      <div className="export-headline compact">
                        <strong>首屏摘要</strong>
                        <p>{exportSummary.headline}</p>
                        <div className="mini-actions">
                          <button className="ghost-button compact-button" onClick={copyExportHeadline}>复制首屏摘要</button>
                        </div>
                      </div>
                    ) : null}
                    {exportSummary.recommendedAction ? (
                      <div className="export-headline compact export-recommendation">
                        <strong>推荐下一步</strong>
                        <p>{`${exportSummary.recommendedAction.title} -> ${exportSummary.recommendedAction.actionLabel}`}</p>
                        {exportSummary.recommendedAction.detail ? (
                          <p className="export-subtle">{exportSummary.recommendedAction.detail}</p>
                        ) : null}
                        <div className="mini-actions">
                          <button className="ghost-button compact-button" onClick={runRecommendedAction}>
                            {viewingHistoricalBundle ? "回到最新后执行" : "立即执行"}
                          </button>
                          <button className="ghost-button compact-button" onClick={copyRecommendedAction}>复制推荐下一步</button>
                        </div>
                      </div>
                    ) : null}
                    <dl className="kv-grid compact">
                      <div><dt>zip</dt><dd>{lastExportBundle?.zipPath ? exportSummary.zipName : "未导出"}</dd></div>
                      <div><dt>说明</dt><dd>{exportSummary.readmeName}</dd></div>
                      <div><dt>摘要</dt><dd>{exportSummary.summaryName}</dd></div>
                      <div><dt>清单</dt><dd>{exportSummary.manifestName}</dd></div>
                    </dl>
                    <div className="export-actions compact-export-actions">
                      <button className="ghost-button" onClick={copySupportSnapshot}>复制支持快照</button>
                      <button className="ghost-button" onClick={() => openExportArtifact(lastExportBundle?.readmePath ?? null, "说明文件")}>打开说明</button>
                      <button className="ghost-button" onClick={() => openExportArtifact(lastExportBundle?.summaryPath ?? null, "摘要文件")}>打开摘要</button>
                      <button className="ghost-button" onClick={() => openExportArtifact(lastExportBundle?.manifestPath ?? null, "清单文件")}>打开清单</button>
                      {viewingHistoricalBundle ? (
                        <button className="ghost-button" onClick={selectLatestExportBundle}>回到最新</button>
                      ) : null}
                    </div>
                    {exportHistory.length > 1 ? (
                      <div className="export-history compact-export-history">
                        <div className="export-history-head">
                          <strong>最近历史</strong>
                        </div>
                        <div className="export-history-list">
                          {exportHistory.slice(0, 3).map((bundle) => (
                            <div
                              key={bundle.bundleName}
                              className={bundle.bundleName === lastExportBundle?.bundleName ? "history-row active" : "history-row"}
                            >
                              <button
                                className={bundle.bundleName === lastExportBundle?.bundleName ? "history-chip active" : "history-chip"}
                                onClick={() => selectExportBundle(bundle)}
                              >
                                <span>{bundle.bundleName}</span>
                                <small>{formatTime(bundle.exportedAt)}</small>
                              </button>
                              <button className="ghost-button history-delete" onClick={() => deleteExportBundle(bundle)}>移除</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <p className="export-hint">这里显示最近一次可分享支持包，优先发 zip 即可。</p>
                  </section>
                ) : null}

                {statusDetail ? <pre className="status-detail">{statusDetail}</pre> : null}
              </section>
            </>
          )}
        </aside>
      </main>
    </div>
  );

  return (
    <>
      {view === "home" ? home : consoleView}
      {pendingProviderReplaceAction ? (
        <div className="modal-backdrop" role="presentation">
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="provider-draft-confirm-title">
            <div className="confirm-dialog-copy">
              <span className="panel-tag">草稿确认</span>
              <h3 id="provider-draft-confirm-title">当前 Provider 有未保存的草稿</h3>
              <p>{providerDraftStatus.detail}</p>
              <p>继续后会覆盖当前表单中的修改。</p>
            </div>
            <div className="confirm-dialog-actions">
              <button className="ghost-button" onClick={cancelPendingProviderReplaceAction}>继续编辑</button>
              <button onClick={confirmPendingProviderReplaceAction}>仍然覆盖</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
