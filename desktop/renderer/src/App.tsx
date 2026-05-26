import { useEffect, useMemo, useState } from "react";

import {
  PROVIDER_PRESETS,
  buildProviderProfileFromPreset
} from "../../shared/provider-presets";
import type { AppState, ProviderProfile } from "../../shared/types";

type ViewKey = "home" | "console";
type TabKey = "dashboard" | "providers" | "kiro" | "logs" | "playground";
type ResourceKey = "readme" | "providers" | "streaming" | "plan";

const tabs: Array<{ key: TabKey; label: string; summary: string }> = [
  { key: "dashboard", label: "当前状态", summary: "代理、BYOK 开关、下一步建议" },
  { key: "providers", label: "Provider 与模型", summary: "预设、Key、模型列表、默认模型" },
  { key: "kiro", label: "Kiro 接入", summary: "检测、应用、诊断、恢复" },
  { key: "logs", label: "日志与诊断", summary: "失败优先查看和导出摘要" },
  { key: "playground", label: "模型验证", summary: "单次验证当前模型是否可用" }
];

const quickStartSteps = [
  {
    id: "preset",
    index: "01",
    title: "选择 Provider 预设",
    body: "先从 DeepSeek、DashScope、Moonshot、Zhipu 或 SiliconFlow 预设开始，再微调模型与地址。",
    action: "去配置",
    tab: "providers" as TabKey
  },
  {
    id: "test",
    index: "02",
    title: "保存并测试",
    body: "保存 Key 后先做一次最小连通性测试，避免还没通就去改 Kiro 配置。",
    action: "去测试",
    tab: "providers" as TabKey
  },
  {
    id: "launch",
    index: "03",
    title: "应用并启动 Kiro",
    body: "启用 BYOK 路由、运行诊断，再用一键入口拉起 Kiro。",
    action: "去启动",
    tab: "dashboard" as TabKey
  }
];

const usageModes = [
  {
    title: "桌面控制台方式",
    body: "面向第一次接入、切换模型、查看日志和恢复配置。",
    action: "打开控制台",
    tab: "dashboard" as TabKey
  },
  {
    title: "CLI 方式",
    body: "保留 `configure`、`diagnose`、`restore` 和 `start`，适合脚本化场景。",
    action: "看接入步骤",
    tab: "kiro" as TabKey
  },
  {
    title: "安装包方式",
    body: "V3.1 目标是直接给出桌面安装物，不再要求用户先理解源码结构。",
    action: "看产品状态",
    tab: "dashboard" as TabKey
  }
];

const troubleshootingLinks = [
  {
    title: "Kiro 没有走本地代理",
    body: "先看 BYOK 是否启用，再看 `localRegions` 是否真的覆盖到本地 endpoint。",
    tab: "kiro" as TabKey
  },
  {
    title: "模型列表不显示",
    body: "重新拉取 `/models`，或直接手工补充高频模型名。",
    tab: "providers" as TabKey
  },
  {
    title: "聊天报错",
    body: "先看最近失败请求，再导出脱敏诊断摘要。",
    tab: "logs" as TabKey
  },
  {
    title: "恢复原配置",
    body: "关闭 BYOK 或直接恢复最近备份。",
    tab: "kiro" as TabKey
  }
];

const resourceLinks: Array<{ key: ResourceKey; title: string; body: string }> = [
  {
    key: "readme",
    title: "README",
    body: "安装、启动、CLI 和桌面入口的总说明。"
  },
  {
    key: "providers",
    title: "Provider 文档",
    body: "国内 Provider 的 Base URL、模型名和示例配置。"
  },
  {
    key: "streaming",
    title: "Streaming / Kiro 说明",
    body: "Kiro Agent chat 的 event-stream 与协议兼容记录。"
  },
  {
    key: "plan",
    title: "项目计划",
    body: "当前 V3 backlog 与产品化进度。"
  }
];

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

function openConsole(targetTab: TabKey, setView: (view: ViewKey) => void, setActiveTab: (tab: TabKey) => void) {
  setActiveTab(targetTab);
  setView("console");
}

export function App() {
  const [view, setView] = useState<ViewKey>("home");
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [state, setState] = useState<AppState>(emptyState);
  const [status, setStatus] = useState("正在读取应用状态...");
  const [statusDetail, setStatusDetail] = useState("");
  const [providerDraft, setProviderDraft] = useState<ProviderProfile | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [presetId, setPresetId] = useState("deepseek");
  const [prompt, setPrompt] = useState("你好，请简要说明当前模型是否可用。");
  const [playgroundResponse, setPlaygroundResponse] = useState("");
  const [playgroundProviderId, setPlaygroundProviderId] = useState("");
  const [playgroundModelId, setPlaygroundModelId] = useState("");
  const [logFilters, setLogFilters] = useState({
    operation: "",
    status: "",
    errorOnly: false
  });
  const [logRows, setLogRows] = useState<AppState["recentLogs"]>([]);

  const providerOptions = useMemo(
    () => Object.values(PROVIDER_PRESETS),
    []
  );

  const selectedProvider = useMemo(
    () =>
      providerDraft
      ?? state.settings.providers.find((provider) => provider.id === state.settings.selectedProviderId)
      ?? state.settings.providers[0]
      ?? null,
    [providerDraft, state.settings.providers, state.settings.selectedProviderId]
  );

  const playgroundProvider = useMemo(
    () => state.settings.providers.find((provider) => provider.id === playgroundProviderId) ?? selectedProvider,
    [playgroundProviderId, selectedProvider, state.settings.providers]
  );

  const latestFailure = useMemo(
    () => [...logRows].find((entry) => entry.status >= 400) ?? null,
    [logRows]
  );

  const latestSuccess = useMemo(
    () => [...logRows].find((entry) => entry.status >= 200 && entry.status < 400) ?? null,
    [logRows]
  );

  async function refresh() {
    const next = await window.kiroPlusApp.getState();
    setState(next);
    setLogRows(next.recentLogs);

    const current = next.settings.providers.find((provider) => provider.id === next.settings.selectedProviderId)
      ?? next.settings.providers[0]
      ?? null;

    setProviderDraft(current);
    setPresetId(current?.providerPresetId ?? "deepseek");

    const nextProviderId = next.settings.selectedProviderId ?? next.settings.providers[0]?.id ?? "";
    const nextProvider = next.settings.providers.find((provider) => provider.id === nextProviderId)
      ?? next.settings.providers[0]
      ?? null;
    setPlaygroundProviderId(nextProviderId);
    setPlaygroundModelId(nextProvider?.defaultModel ?? "");
  }

  useEffect(() => {
    refresh()
      .then(() => setStatus("桌面控制台已就绪。"))
      .catch((error) => {
        const parsed = describeError(error);
        setStatus(parsed.summary);
        setStatusDetail(parsed.detail);
      });
  }, []);

  async function runAction(action: () => Promise<unknown>, message: string) {
    try {
      setStatus(message);
      setStatusDetail("");
      await action();
      await refresh();
      setStatus("操作已完成。");
    } catch (error) {
      const parsed = describeError(error);
      setStatus(parsed.summary);
      setStatusDetail(parsed.detail);
    }
  }

  async function refreshLogs(nextFilters = logFilters) {
    try {
      const rows = await window.kiroPlusApp.listLogs({
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

  async function copyDiagnosticsSummary() {
    await runAction(async () => {
      const text = await window.kiroPlusApp.exportDiagnostics();
      await navigator.clipboard.writeText(text);
    }, "正在导出并复制诊断摘要...");
  }

  async function openResource(resourceId: ResourceKey) {
    await runAction(
      () => window.kiroPlusApp.openResource(resourceId),
      "正在打开文档资源..."
    );
  }

  function applyPresetToDraft() {
    const next = buildProviderProfileFromPreset(presetId);
    setProviderDraft(next);
    setPlaygroundProviderId(next.id);
    setPlaygroundModelId(next.defaultModel);
  }

  const renderHome = () => (
    <div className="landing-shell">
      <header className="landing-topbar">
        <div className="brand brand-home">
          <div className="brand-mark">K+</div>
          <div>
            <h1>Kiro++</h1>
            <p>本地 BYOK 路由与 Kiro 可视化接入台</p>
          </div>
        </div>
        <div className="button-row">
          <button className="ghost-button" onClick={() => runAction(() => window.kiroPlusApp.launchKiroWithProxy(), "正在启动 Kiro++ 入口...")}>
            Launch Kiro with Kiro++
          </button>
          <button className="ghost-button" onClick={() => openConsole("dashboard", setView, setActiveTab)}>
            打开控制台
          </button>
        </div>
      </header>

      <main className="landing-content">
        <section className="landing-hero">
          <div className="hero-copy">
            <span className="eyebrow">Windows 优先 / 本地代理 / 多模型协同</span>
            <h2>让 Kiro 使用你自己的 API 与模型</h2>
            <p>
              Kiro++ 不改原安装目录，只在本地启动代理、写入可恢复配置，并把 DeepSeek、
              DashScope、Moonshot、Zhipu、SiliconFlow 等 Provider 接到 Kiro。
            </p>
            <div className="hero-actions">
              <button onClick={() => openConsole(state.bootstrap.recommendedTab, setView, setActiveTab)}>快速开始</button>
              <button className="ghost-button" onClick={() => openConsole("dashboard", setView, setActiveTab)}>
                进入控制台
              </button>
              <button className="ghost-button" onClick={() => openConsole("providers", setView, setActiveTab)}>
                查看配置示例
              </button>
              <button className="ghost-button" onClick={() => openConsole("logs", setView, setActiveTab)}>
                常见问题
              </button>
            </div>
          </div>

          <section className="hero-runtime">
            <div className="hero-runtime-head">
              <span className={`proxy-pill ${state.proxyStatus.state}`}>{proxyStateLabels[state.proxyStatus.state]}</span>
              <small>{status}</small>
            </div>
            <dl className="hero-runtime-list">
              <div>
                <dt>BYOK 状态</dt>
                <dd>{state.settings.isByokEnabled ? "已启用" : "未启用"}</dd>
              </div>
              <div>
                <dt>当前 Provider</dt>
                <dd>{selectedProvider?.label ?? "未配置"}</dd>
              </div>
              <div>
                <dt>默认模型</dt>
                <dd>{selectedProvider?.defaultModel ?? "未配置"}</dd>
              </div>
              <div>
                <dt>本地 Endpoint</dt>
                <dd>{state.proxyStatus.endpoint ?? `http://127.0.0.1:${state.settings.kiro.defaultEndpointPort}`}</dd>
              </div>
            </dl>
          </section>
        </section>

        <section className="section-block">
          <div className="section-head">
            <div>
              <h3>首次启动引导</h3>
              <p>按固定顺序完成检测、测试、代理和路由，不要跳步排错。</p>
            </div>
            <button className="ghost-button" onClick={() => openConsole(state.bootstrap.recommendedTab, setView, setActiveTab)}>
              打开推荐页面
            </button>
          </div>
          <section className="readiness-strip">
            {state.bootstrap.steps.map((step, index) => (
              <article key={step.key} className="readiness-card">
                <span className="readiness-index">{String(index + 1).padStart(2, "0")}</span>
                <h4>{step.title}</h4>
                <p>{step.detail}</p>
              </article>
            ))}
          </section>
        </section>

        <section className="section-block">
          <div className="section-head">
            <div>
              <h3>三步上手</h3>
              <p>先选预设，再保存测试，最后应用并启动 Kiro。</p>
            </div>
            <button className="ghost-button" onClick={() => openConsole("providers", setView, setActiveTab)}>
              从第一步开始
            </button>
          </div>
          <div className="card-grid steps-grid">
            {quickStartSteps.map((step) => (
              <article key={step.id} className="info-card step-card">
                <span className="step-index">{step.index}</span>
                <h4>{step.title}</h4>
                <p>{step.body}</p>
                <button className="ghost-button" onClick={() => openConsole(step.tab, setView, setActiveTab)}>
                  {step.action}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block">
          <div className="section-head">
            <div>
              <h3>常用 Provider 预设</h3>
              <p>聚焦高频国内路线，不追求全量模型目录。</p>
            </div>
          </div>
          <div className="card-grid provider-grid">
            {providerOptions.map((provider) => (
              <article key={provider.id} className="info-card provider-card">
                <h4>{provider.label}</h4>
                <dl className="compact-facts">
                  <div>
                    <dt>Base URL</dt>
                    <dd>{provider.baseUrl}</dd>
                  </div>
                  <div>
                    <dt>推荐模型</dt>
                    <dd>{provider.models.join(" / ")}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block two-column-section">
          <div className="section-column">
            <div className="section-head">
              <div>
                <h3>使用方式</h3>
                <p>控制台优先，CLI 保留，安装包交付作为目标入口。</p>
              </div>
            </div>
            <div className="card-grid single-column-grid">
              {usageModes.map((item) => (
                <article key={item.title} className="info-card slim-card">
                  <h4>{item.title}</h4>
                  <p>{item.body}</p>
                  <button className="ghost-button" onClick={() => openConsole(item.tab, setView, setActiveTab)}>
                    {item.action}
                  </button>
                </article>
              ))}
            </div>
          </div>

          <div className="section-column">
            <div className="section-head">
              <div>
                <h3>常见排错入口</h3>
                <p>先看失败请求和诊断摘要，再决定是否需要更深的协议排查。</p>
              </div>
            </div>
            <div className="card-grid single-column-grid">
              {troubleshootingLinks.map((item) => (
                <article key={item.title} className="info-card slim-card">
                  <h4>{item.title}</h4>
                  <p>{item.body}</p>
                  <button className="ghost-button" onClick={() => openConsole(item.tab, setView, setActiveTab)}>
                    打开相关页面
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <footer className="landing-footer">
          <div className="section-head">
            <div>
              <h3>文档入口</h3>
              <p>全部指向项目内真实资源，不再保留占位链接。</p>
            </div>
          </div>
          <div className="card-grid footer-grid">
            {resourceLinks.map((item) => (
              <button key={item.key} className="info-card footer-card" onClick={() => openResource(item.key)}>
                <h4>{item.title}</h4>
                <p>{item.body}</p>
              </button>
            ))}
          </div>
        </footer>
      </main>
    </div>
  );

  const renderConsole = () => (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">K+</div>
          <div>
            <h1>Kiro++</h1>
            <p>桌面控制台</p>
          </div>
        </div>
        <nav className="nav">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={tab.key === activeTab ? "nav-button active" : "nav-button"}
              onClick={() => setActiveTab(tab.key)}
            >
              <span>{tab.label}</span>
              <small>{tab.summary}</small>
            </button>
          ))}
        </nav>
        <div className="status-panel">
          <span className={`proxy-pill ${state.proxyStatus.state}`}>{proxyStateLabels[state.proxyStatus.state]}</span>
          <p>{state.proxyStatus.endpoint ?? "代理未启动"}</p>
          <small>{status}</small>
          {statusDetail ? <small>{statusDetail}</small> : null}
        </div>
      </aside>

      <main className="content">
        <section className="console-topbar">
          <div className="button-row">
            <button className="ghost-button" onClick={() => setView("home")}>返回首页</button>
            <button className="ghost-button" onClick={() => runAction(() => window.kiroPlusApp.launchKiroWithProxy(), "正在启动 Kiro++ 入口...")}>
              Launch Kiro with Kiro++
            </button>
          </div>
          <div>
            <h2>控制台工作台</h2>
            <p>真实入口、真实状态、真实诊断，不再依赖静态演示页承担产品职责。</p>
          </div>
        </section>

        <section className="hero console-hero">
          <div>
            <span className="eyebrow">当前步骤提示</span>
            <h3>先把路由跑通，再考虑更复杂的多模型协同。</h3>
            <p>
              推荐顺序：保存 Provider，测试 Provider，启动代理，启用 BYOK，运行诊断，再到模型验证页做一次最小请求。
            </p>
          </div>
          <div className="hero-actions">
            <button onClick={() => runAction(() => window.kiroPlusApp.startProxy(), "正在启动本地代理...")}>
              启动代理
            </button>
            <button
              className="ghost-button"
              onClick={() =>
                runAction(
                  () => window.kiroPlusApp.setByokEnabled(!state.settings.isByokEnabled),
                  state.settings.isByokEnabled ? "正在恢复官方配置..." : "正在启用 BYOK 路由..."
                )
              }
            >
              {state.settings.isByokEnabled ? "关闭 BYOK" : "启用 BYOK"}
            </button>
            <button className="ghost-button" onClick={() => runAction(() => window.kiroPlusApp.diagnoseKiro(), "正在运行诊断...")}>
              运行诊断
            </button>
          </div>
        </section>

        <section className="readiness-strip">
          {state.bootstrap.steps.map((item, index) => (
            <article key={item.key} className="readiness-card">
              <span className="readiness-index">{String(index + 1).padStart(2, "0")}</span>
              <h4>{item.title}</h4>
              <p>{item.detail}</p>
            </article>
          ))}
        </section>

        {activeTab === "dashboard" && (
          <div className="grid two">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>当前状态总览</h3>
                  <p>确认代理、BYOK 开关、Provider 和默认模型是否已经进入可测试状态。</p>
                </div>
              </div>
              <dl className="facts">
                <div><dt>BYOK</dt><dd>{state.settings.isByokEnabled ? "已启用" : "未启用"}</dd></div>
                <div><dt>代理状态</dt><dd>{proxyStateLabels[state.proxyStatus.state]}</dd></div>
                <div><dt>本地 Endpoint</dt><dd>{state.proxyStatus.endpoint ?? "未启动"}</dd></div>
                <div><dt>当前 Provider</dt><dd>{selectedProvider?.label ?? "未配置"}</dd></div>
                <div><dt>默认模型</dt><dd>{selectedProvider?.defaultModel ?? "未配置"}</dd></div>
                <div><dt>上次 Provider 测试</dt><dd>{state.lastSuccessfulProviderTest?.modelId ?? "尚未测试"}</dd></div>
              </dl>
              <div className="button-row">
                <button className="ghost-button" onClick={() => runAction(() => window.kiroPlusApp.stopProxy(), "正在停止代理...")}>
                  停止代理
                </button>
                <button className="ghost-button" onClick={() => runAction(() => window.kiroPlusApp.restartProxy(), "正在重启代理...")}>
                  重启代理
                </button>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>下一步建议</h3>
                  <p>按推荐顺序推进，不要在缺少前置条件时强行跳到后面步骤。</p>
                </div>
              </div>
              <dl className="facts">
                <div><dt>推荐页面</dt><dd>{tabs.find((item) => item.key === state.bootstrap.recommendedTab)?.label ?? "当前状态"}</dd></div>
                <div><dt>最近备份</dt><dd>{state.kiroDetection.lastBackup?.backupPath ?? "暂无备份"}</dd></div>
                <div><dt>最近应用备份</dt><dd>{state.lastAppliedKiroBackup?.backupPath ?? "尚未应用"}</dd></div>
                <div><dt>最近成功请求</dt><dd>{latestSuccess?.operation ?? "暂无"}</dd></div>
              </dl>
              <div className="button-row">
                <button className="ghost-button" onClick={() => setActiveTab(state.bootstrap.recommendedTab)}>
                  打开推荐页面
                </button>
                <button className="ghost-button" onClick={() => runAction(() => window.kiroPlusApp.detectKiro(), "正在刷新 Kiro 检测...")}>
                  刷新检测
                </button>
              </div>
            </section>

            <section className="panel span-two">
              <div className="panel-head">
                <div>
                  <h3>最近请求摘要</h3>
                  <p>先看最新失败和成功，再决定是否要深入日志页。</p>
                </div>
              </div>
              <div className="snapshot-grid">
                <article className="snapshot-card">
                  <span className="snapshot-label">最近一次失败</span>
                  <strong>{latestFailure?.operation ?? "暂无"}</strong>
                  <p>{latestFailure ? `status ${latestFailure.status} / requestId ${latestFailure.requestId ?? "-"}` : "没有记录到失败请求。"}</p>
                </article>
                <article className="snapshot-card">
                  <span className="snapshot-label">最近一次成功</span>
                  <strong>{latestSuccess?.operation ?? "暂无"}</strong>
                  <p>{latestSuccess ? `status ${latestSuccess.status} / requestId ${latestSuccess.requestId ?? "-"}` : "还没有成功请求记录。"}</p>
                </article>
              </div>
            </section>
          </div>
        )}

        {activeTab === "providers" && selectedProvider && (
          <div className="grid two">
            <section className="panel span-two">
              <div className="panel-head">
                <div>
                  <h3>Provider 与模型</h3>
                  <p>内置预设、远程拉取和手工补充三条路并存，但默认模型只留一项。</p>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  <span>Provider 预设</span>
                  <select value={presetId} onChange={(event) => setPresetId(event.target.value)}>
                    {providerOptions.map((provider) => (
                      <option key={provider.id} value={provider.id}>{provider.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>预设操作</span>
                  <button type="button" className="ghost-button" onClick={applyPresetToDraft}>
                    应用预设到当前草稿
                  </button>
                </label>
              </div>
              <label className="inline-label">
                <span>当前 Provider</span>
                <select
                  value={selectedProvider.id}
                  onChange={(event) => {
                    const next = state.settings.providers.find((provider) => provider.id === event.target.value) ?? null;
                    setProviderDraft(next);
                    setPresetId(next?.providerPresetId ?? "deepseek");
                    setApiKey("");
                  }}
                >
                  {state.settings.providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>{provider.label}</option>
                  ))}
                </select>
              </label>
              <div className="form-grid">
                <label>
                  <span>Provider ID</span>
                  <input
                    value={selectedProvider.id}
                    onChange={(event) => setProviderDraft({ ...selectedProvider, id: event.target.value })}
                  />
                </label>
                <label>
                  <span>展示名称</span>
                  <input
                    value={selectedProvider.label}
                    onChange={(event) => setProviderDraft({ ...selectedProvider, label: event.target.value })}
                  />
                </label>
                <label>
                  <span>Provider 类型</span>
                  <select
                    value={selectedProvider.type}
                    onChange={(event) => setProviderDraft({ ...selectedProvider, type: event.target.value as ProviderProfile["type"] })}
                  >
                    <option value="openai-compatible">openai-compatible</option>
                    <option value="anthropic">anthropic</option>
                    <option value="gemini">gemini</option>
                  </select>
                </label>
                <label>
                  <span>Base URL</span>
                  <input
                    value={selectedProvider.baseUrl}
                    onChange={(event) => setProviderDraft({ ...selectedProvider, baseUrl: event.target.value })}
                  />
                </label>
                <label>
                  <span>默认模型</span>
                  <select
                    value={selectedProvider.defaultModel}
                    onChange={(event) => setProviderDraft({ ...selectedProvider, defaultModel: event.target.value })}
                  >
                    {selectedProvider.models.map((model) => (
                      <option key={model.id} value={model.id}>{model.id}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>API Key</span>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="保存到系统凭据管理器"
                  />
                </label>
              </div>
              <label className="textarea-label">
                <span>模型列表（每行一个）</span>
                <textarea
                  value={selectedProvider.models.map((model) => model.id).join("\n")}
                  onChange={(event) =>
                    setProviderDraft({
                      ...selectedProvider,
                      models: event.target.value
                        .split(/\r?\n/)
                        .map((value) => value.trim())
                        .filter(Boolean)
                        .map((id) => ({ id, name: id, note: "" }))
                    })
                  }
                />
              </label>
              <div className="button-row">
                <button
                  onClick={() =>
                    runAction(
                      () =>
                        window.kiroPlusApp.saveProvider({
                          profile: {
                            ...selectedProvider,
                            providerPresetId: presetId
                          },
                          apiKey
                        }),
                      "正在保存 Provider..."
                    )
                  }
                >
                  保存 Provider
                </button>
                <button
                  className="ghost-button"
                  onClick={() =>
                    runAction(
                      async () => {
                        const models = await window.kiroPlusApp.fetchModels({ profile: selectedProvider, apiKey });
                        setProviderDraft({
                          ...selectedProvider,
                          models: (models as Array<{ id: string; name: string }>).map((item) => ({
                            id: item.id,
                            name: item.name,
                            note: ""
                          })),
                          defaultModel: (models as Array<{ id: string; name: string }>)[0]?.id ?? selectedProvider.defaultModel
                        });
                      },
                      "正在拉取远程模型列表..."
                    )
                  }
                >
                  拉取模型列表
                </button>
                <button
                  className="ghost-button"
                  onClick={() =>
                    runAction(
                      () => window.kiroPlusApp.testProvider({ profile: selectedProvider, apiKey }),
                      "正在测试 Provider..."
                    )
                  }
                >
                  保存并测试
                </button>
              </div>
            </section>
          </div>
        )}

        {activeTab === "kiro" && (
          <div className="grid two">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>应用配置</h3>
                  <p>检测、应用、诊断、恢复都走真实 IPC，不再只是静态占位。</p>
                </div>
              </div>
              <dl className="facts">
                <div><dt>安装路径</dt><dd>{state.kiroDetection.installPath ?? "未找到"}</dd></div>
                <div><dt>设置路径</dt><dd>{state.kiroDetection.settingsPath || "未检测"}</dd></div>
                <div><dt>备份目录</dt><dd>{state.kiroDetection.backupDir || "未检测"}</dd></div>
                <div><dt>最近备份</dt><dd>{state.kiroDetection.lastBackup?.backupPath ?? "暂无"}</dd></div>
                <div><dt>最近应用</dt><dd>{state.lastAppliedKiroBackup?.backupPath ?? "尚未应用"}</dd></div>
              </dl>
              <div className="button-row">
                <button onClick={() => runAction(() => window.kiroPlusApp.applyRouting(), "正在应用 Kiro 配置...")}>
                  应用配置
                </button>
                <button
                  className="ghost-button"
                  onClick={() =>
                    runAction(
                      () => window.kiroPlusApp.setByokEnabled(!state.settings.isByokEnabled),
                      state.settings.isByokEnabled ? "正在关闭 BYOK..." : "正在启用 BYOK..."
                    )
                  }
                >
                  {state.settings.isByokEnabled ? "关闭 BYOK" : "启用 BYOK"}
                </button>
                <button className="ghost-button" onClick={() => runAction(() => window.kiroPlusApp.restoreKiro(), "正在恢复最近备份...")}>
                  恢复备份
                </button>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>诊断结果</h3>
                  <p>重点看 endpoint 是否覆盖、Auto 是否阻塞、是否仍出现未支持操作。</p>
                </div>
              </div>
              <dl className="facts">
                <div><dt>localRegions</dt><dd>{state.diagnose?.localRegions.join(", ") ?? "-"}</dd></div>
                <div><dt>autoModeBlocksByok</dt><dd>{String(state.diagnose?.autoModeBlocksByok ?? false)}</dd></div>
                <div><dt>profileAutoModeBlocksByok</dt><dd>{String(state.diagnose?.profileAutoModeBlocksByok ?? false)}</dd></div>
                <div><dt>unsupportedOperationsSeen</dt><dd>{state.diagnose?.unsupportedOperationsSeen.join(", ") ?? "-"}</dd></div>
              </dl>
              <p className="hint">{state.diagnose?.hint ?? "应用配置后再运行诊断。"}</p>
              <div className="button-row">
                <button className="ghost-button" onClick={() => runAction(() => window.kiroPlusApp.diagnoseKiro(), "正在刷新诊断结果...")}>
                  运行诊断
                </button>
                <button className="ghost-button" onClick={copyDiagnosticsSummary}>
                  复制脱敏诊断摘要
                </button>
              </div>
            </section>
          </div>
        )}

        {activeTab === "logs" && (
          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>日志与诊断</h3>
                <p>失败优先展示；一键复制诊断摘要用来反馈问题。</p>
              </div>
            </div>
            <div className="snapshot-grid">
              <article className="snapshot-card">
                <span className="snapshot-label">最近一次失败</span>
                <strong>{latestFailure?.operation ?? "暂无"}</strong>
                <p>{latestFailure ? `status ${latestFailure.status} / requestId ${latestFailure.requestId ?? "-"}` : "没有失败请求。"}</p>
              </article>
              <article className="snapshot-card">
                <span className="snapshot-label">最近一次成功</span>
                <strong>{latestSuccess?.operation ?? "暂无"}</strong>
                <p>{latestSuccess ? `status ${latestSuccess.status} / requestId ${latestSuccess.requestId ?? "-"}` : "没有成功请求。"}</p>
              </article>
            </div>
            <div className="filter-bar">
              <input
                placeholder="operation"
                value={logFilters.operation}
                onChange={(event) => setLogFilters((current) => ({ ...current, operation: event.target.value }))}
              />
              <input
                placeholder="status"
                value={logFilters.status}
                onChange={(event) => setLogFilters((current) => ({ ...current, status: event.target.value }))}
              />
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={logFilters.errorOnly}
                  onChange={(event) => setLogFilters((current) => ({ ...current, errorOnly: event.target.checked }))}
                />
                <span>只看失败</span>
              </label>
              <button className="ghost-button" onClick={() => refreshLogs()}>应用筛选</button>
              <button className="ghost-button" onClick={copyDiagnosticsSummary}>复制诊断摘要</button>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>time</th>
                  <th>operation</th>
                  <th>status</th>
                  <th>duration</th>
                  <th>requestId</th>
                  <th>bodyBytes</th>
                </tr>
              </thead>
              <tbody>
                {logRows.map((entry) => (
                  <tr key={`${entry.requestId ?? "none"}-${entry.at}`}>
                    <td>{entry.at}</td>
                    <td>{entry.operation}</td>
                    <td>{entry.status}</td>
                    <td>{entry.durationMs ?? "-"}</td>
                    <td>{entry.requestId ?? "-"}</td>
                    <td>{entry.bodyBytes ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {activeTab === "playground" && selectedProvider && (
          <div className="grid two">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>模型验证</h3>
                  <p>这里只做单次可用性验证，不发展成聊天产品。</p>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  <span>Provider</span>
                  <select
                    value={playgroundProvider?.id ?? ""}
                    onChange={(event) => {
                      const nextProviderId = event.target.value;
                      const nextProvider = state.settings.providers.find((provider) => provider.id === nextProviderId);
                      setPlaygroundProviderId(nextProviderId);
                      setPlaygroundModelId(nextProvider?.defaultModel ?? "");
                    }}
                  >
                    {state.settings.providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>{provider.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>模型</span>
                  <select
                    value={playgroundModelId}
                    onChange={(event) => setPlaygroundModelId(event.target.value)}
                  >
                    {(playgroundProvider?.models ?? []).map((model) => (
                      <option key={model.id} value={model.id}>{model.id}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="textarea-label">
                <span>提示词</span>
                <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
              </label>
              <div className="button-row">
                <button
                  onClick={() =>
                    runAction(
                      async () => {
                        const result = await window.kiroPlusApp.sendPlayground({
                          providerId: playgroundProvider?.id ?? selectedProvider.id,
                          modelId: playgroundModelId || playgroundProvider?.defaultModel || selectedProvider.defaultModel,
                          prompt
                        });
                        const typed = result as { text: string; modelId: string; latencyMs: number };
                        setPlaygroundResponse(`modelId: ${typed.modelId}\nlatencyMs: ${typed.latencyMs}\n\n${typed.text}`);
                      },
                      "正在发送模型验证请求..."
                    )
                  }
                >
                  发送验证
                </button>
              </div>
            </section>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>返回结果</h3>
                  <p>确认最终命中的 `modelId`、耗时和文本响应。</p>
                </div>
              </div>
              <pre className="response-box">{playgroundResponse || "还没有返回结果。"}</pre>
            </section>
          </div>
        )}
      </main>
    </div>
  );

  return view === "home" ? renderHome() : renderConsole();
}
