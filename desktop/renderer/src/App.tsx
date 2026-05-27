import { useEffect, useMemo, useState } from "react";

import {
  PROVIDER_PRESETS,
  buildProviderProfileFromPreset
} from "../../shared/provider-presets";
import type {
  AppState,
  PlaygroundResult,
  ProviderModel,
  ProviderProfile,
  RequestLogEntry
} from "../../shared/types";

type ViewKey = "home" | "console";
type ResourceKey = "readme" | "providers" | "streaming" | "plan";
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
  lastSuccessfulProviderTest: null,
  lastAppliedKiroBackup: null
};

const proxyStateLabels: Record<AppState["proxyStatus"]["state"], string> = {
  stopped: "未启动",
  starting: "启动中",
  running: "运行中",
  error: "异常"
};

const quickStartSteps = [
  {
    id: "preset",
    index: "01",
    title: "选 Provider 预设",
    body: "先套用高频预设，再微调 Base URL 和默认模型。",
    action: "打开 Provider",
    focus: "providers" as ConsoleFocus
  },
  {
    id: "test",
    index: "02",
    title: "保存并测试",
    body: "先做一次最小连通性验证，再去动 Kiro 配置。",
    action: "去做测试",
    focus: "playground" as ConsoleFocus
  },
  {
    id: "launch",
    index: "03",
    title: "启用并拉起 Kiro",
    body: "启动代理、启用 BYOK、运行诊断，再通过桌面入口启动。",
    action: "去工作台",
    focus: "kiro" as ConsoleFocus
  }
];

const resourceLinks: Array<{ key: ResourceKey; title: string; body: string }> = [
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
    return window.kiroPlusApp;
  }
  throw new Error("Desktop bridge is unavailable. Restart Kiro++ after reinstalling the latest package.");
}

function nowIso() {
  return new Date().toISOString();
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

function summarizeLog(entry: RequestLogEntry | null) {
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

  const providerOptions = useMemo(() => Object.values(PROVIDER_PRESETS), []);

  const selectedProvider = useMemo(
    () =>
      providerDraft
      ?? state.settings.providers.find((provider) => provider.id === state.settings.selectedProviderId)
      ?? state.settings.providers[0]
      ?? null,
    [providerDraft, state.settings.providers, state.settings.selectedProviderId]
  );

  const selectedProviderLabel = selectedProvider?.label ?? "未配置";

  const latestFailure = useMemo(
    () => [...logRows].find((entry) => entry.status >= 400) ?? null,
    [logRows]
  );

  const latestSuccess = useMemo(
    () => [...logRows].find((entry) => entry.status >= 200 && entry.status < 400) ?? null,
    [logRows]
  );

  const outputEntries = useMemo(
    () => [...actionEntries].sort((a, b) => (a.at < b.at ? 1 : -1)),
    [actionEntries]
  );

  const selectedProviderModels = useMemo(
    () => parseModelsText(modelsText, selectedProvider?.models ?? []),
    [modelsText, selectedProvider]
  );

  const providerForPlayground = useMemo(
    () => state.settings.providers.find((provider) => provider.id === playgroundProviderId)
      ?? state.settings.providers[0]
      ?? null,
    [playgroundProviderId, state.settings.providers]
  );

  async function refresh(nextFocus?: ConsoleFocus) {
    const api = requireDesktopApi();
    const [nextState, summary] = await Promise.all([
      api.getState(),
      api.exportDiagnostics()
    ]);

    setState(nextState);
    setLogRows(nextState.recentLogs);
    setDiagnosticsSummary(summary);

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

  async function refreshLogs(nextFilters = logFilters) {
    try {
      const api = requireDesktopApi();
      const rows = await api.listLogs({
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

  function applyPresetToDraft() {
    const next = buildProviderProfileFromPreset(presetId);
    setProviderDraft(next);
    setModelsText(buildModelsText(next.models));
    setPlaygroundProviderId(next.id);
    setPlaygroundModelId(next.defaultModel);
    setFocus("providers");
  }

  async function handleSaveProvider() {
    if (!selectedProvider) return;
    const api = requireDesktopApi();
    const normalizedModels = selectedProviderModels;
    const normalizedDefaultModel = normalizedModels.find((model) => model.id === selectedProvider.defaultModel)?.id
      ?? normalizedModels[0]?.id
      ?? selectedProvider.defaultModel;

    await runAction(
      () =>
        api.saveProvider({
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
    const api = requireDesktopApi();
    const result = await runAction(
      () => api.fetchModels({ profile: selectedProvider, apiKey: apiKey.trim() || undefined }),
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
    const api = requireDesktopApi();
    const result = await runAction(
      () =>
        api.testProvider({
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
    const api = requireDesktopApi();
    const result = await runAction(
      () =>
        api.sendPlayground({
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
        const text = await requireDesktopApi().exportDiagnostics();
        await navigator.clipboard.writeText(text);
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

  const home = (
    <div className="landing-shell">
      <header className="landing-header">
        <div className="brand-line">
          <div className="brand-mark">K+</div>
          <div>
            <strong>Kiro++</strong>
            <span>本地 BYOK 路由与桌面工作台</span>
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
              <button className="ghost-button" onClick={() => openConsole("providers")}>查看 Provider 配置</button>
              <button className="ghost-button" onClick={() => openConsole("logs")}>查看排错入口</button>
            </div>
          </div>

          <div className="hero-side">
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
          </div>
        </section>

        <section className="section-block">
          <div className="section-head">
            <div>
              <h2>三步接入</h2>
              <p>先保存 Provider，再测试，再进入工作台完成 Kiro 路由。</p>
            </div>
          </div>
          <div className="home-card-grid steps">
            {quickStartSteps.map((item) => (
              <article key={item.id} className="home-card">
                <span className="step-index">{item.index}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <button className="ghost-button" onClick={() => openConsole(item.focus)}>{item.action}</button>
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
            <span>{status}</span>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="ghost-button" onClick={toggleTheme}>
            {theme === "dark" ? "浅色主题" : "深色主题"}
          </button>
          <button className="ghost-button" onClick={() => setView("home")}>返回首页</button>
          <button
            onClick={() =>
              runAction(() => requireDesktopApi().launchKiroWithProxy(), {
                pending: "正在启动 Kiro++ 入口...",
                success: "Kiro 启动指令已发出。",
                afterFocus: "kiro"
              })
            }
          >
            Launch Kiro with Kiro++
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
                      const next = state.settings.providers.find((provider) => provider.id === event.target.value) ?? null;
                      setProviderDraft(next);
                      setPresetId(next?.providerPresetId ?? "deepseek");
                      setModelsText(buildModelsText(next?.models ?? []));
                      setPlaygroundProviderId(next?.id ?? "");
                      setPlaygroundModelId(next?.defaultModel ?? "");
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

                <div className="button-stack">
                  <button className="ghost-button" onClick={handleFetchModels}>拉取模型</button>
                  <button className="ghost-button" onClick={handleTestProvider}>测试 Provider</button>
                  <button onClick={handleSaveProvider}>保存配置</button>
                </div>
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
              <div><dt>最近备份</dt><dd>{state.kiroDetection.lastBackup?.backupPath ?? "暂无"}</dd></div>
            </dl>

            <div className="button-stack">
              <button
                className="ghost-button"
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
                className="ghost-button"
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
                className="ghost-button"
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
                className="ghost-button"
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
              <button
                className="ghost-button"
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
            </div>
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
            </div>
          </section>

          <section className="step-strip">
            {state.bootstrap.steps.map((step, index) => (
              <article key={step.key} className={`step-tile ${step.done ? "done" : ""}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{step.title}</strong>
                <p>{step.detail}</p>
              </article>
            ))}
          </section>

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
                <div><dt>推荐下一步</dt><dd>{state.bootstrap.steps.find((step) => !step.done)?.title ?? "可以开始实际使用"}</dd></div>
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
                <div><dt>localRegions</dt><dd>{state.diagnose?.localRegions.join(", ") || "暂无"}</dd></div>
                <div><dt>unsupported</dt><dd>{state.diagnose?.unsupportedOperationsSeen.join(", ") || "无"}</dd></div>
                <div><dt>提示</dt><dd>{state.diagnose?.hint ?? "先运行诊断"}</dd></div>
              </dl>
            </article>
          </section>

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
                <pre className="summary-block">{diagnosticsSummary || "诊断摘要将在这里显示。"}</pre>
              </div>
            )}
          </section>
        </section>

        <aside className={`rail right ${focus === "playground" || focus === "logs" ? "focused" : ""}`}>
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
              </article>
              <article className="signal-card">
                <span>最近成功</span>
                <strong>{summarizeLog(latestSuccess).title}</strong>
                <p>{summarizeLog(latestSuccess).body}</p>
              </article>
            </div>

            <div className="button-stack">
              <button className="ghost-button" onClick={copyDiagnosticsSummary}>复制诊断摘要</button>
              <button className="ghost-button" onClick={() => openResource("providers")}>打开 Provider 文档</button>
              <button className="ghost-button" onClick={() => openResource("streaming")}>打开 Streaming 文档</button>
            </div>

            {statusDetail ? <pre className="status-detail">{statusDetail}</pre> : null}
          </section>
        </aside>
      </main>
    </div>
  );

  return view === "home" ? home : consoleView;
}
