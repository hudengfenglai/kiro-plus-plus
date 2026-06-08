import type { DesktopBridgeStatus } from "../../../shared/bridge-status";
import type { DesktopHealthSummary, DesktopHealthItem } from "../../../shared/desktop-health";
import type { QuickstartItem, QuickstartSummary } from "../../../shared/quickstart";
import type { AppMeta, AppState } from "../../../shared/types";
import type { ConsoleFocus, ResourceKey, ThemeKey } from "../app-types";

type ProviderOption = {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
};

type Props = {
  appMeta: AppMeta | null;
  theme: ThemeKey;
  toggleTheme: () => void;
  openConsole: (focus: ConsoleFocus) => void;
  recommendedFocus: ConsoleFocus;
  openResource: (resource: ResourceKey) => void;
  quickstartSummary: QuickstartSummary;
  handleQuickstartAction: (item: QuickstartItem) => void | Promise<unknown>;
  proxyStateLabel: string;
  proxyStateClass: AppState["proxyStatus"]["state"];
  isByokEnabled: boolean;
  selectedProviderLabel: string;
  selectedDefaultModel: string;
  proxyEndpoint: string;
  bridgeStatus: DesktopBridgeStatus;
  desktopHealth: DesktopHealthSummary;
  handleDesktopHealthAction: (item: DesktopHealthItem) => void | Promise<unknown>;
  quickstartChecklist: QuickstartItem[];
  providerOptions: ProviderOption[];
  resourceLinks: Array<{ key: ResourceKey; title: string; body: string }>;
};

export function HomeView({
  appMeta,
  theme,
  toggleTheme,
  openConsole,
  recommendedFocus,
  openResource,
  quickstartSummary,
  handleQuickstartAction,
  proxyStateLabel,
  proxyStateClass,
  isByokEnabled,
  selectedProviderLabel,
  selectedDefaultModel,
  proxyEndpoint,
  bridgeStatus,
  desktopHealth,
  handleDesktopHealthAction,
  quickstartChecklist,
  providerOptions,
  resourceLinks
}: Props) {
  return (
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
          <button className="ghost-button" onClick={() => openConsole(recommendedFocus)}>快速开始</button>
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
              <button onClick={() => openConsole(recommendedFocus)}>快速开始</button>
              <button className="ghost-button" onClick={() => openResource("quickstart")}>打开快速开始</button>
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
                <span className={`state-pill ${proxyStateClass}`}>{proxyStateLabel}</span>
                <h3>当前接入状态</h3>
                <dl className="kv-grid compact">
                  <div><dt>BYOK</dt><dd>{isByokEnabled ? "已启用" : "未启用"}</dd></div>
                  <div><dt>Provider</dt><dd>{selectedProviderLabel}</dd></div>
                  <div><dt>默认模型</dt><dd>{selectedDefaultModel}</dd></div>
                  <div><dt>本地地址</dt><dd>{proxyEndpoint}</dd></div>
                </dl>
              </div>
              <div className={`hero-side-card bridge-card ${bridgeStatus.tone}`}>
                <span className="panel-tag">桥接</span>
                <h3>{bridgeStatus.summary}</h3>
                <p>{bridgeStatus.detail}</p>
                <dl className="kv-grid compact">
                  <div><dt>可用方法</dt><dd>{bridgeStatus.presentMethodCount}/{bridgeStatus.totalMethodCount}</dd></div>
                  <div><dt>状态</dt><dd>{bridgeStatus.complete ? "完整" : bridgeStatus.available ? "需更新安装包" : "桥接缺失"}</dd></div>
                </dl>
              </div>
              <div className="hero-side-card">
                <span className="panel-tag">版本</span>
                <h3>{appMeta ? `v${appMeta.version}` : "版本未知"}</h3>
                <p>{appMeta ? `当前运行于${appMeta.buildLabel}。` : "当前安装包还没有暴露版本元数据，建议重新安装最新版 Kiro++ Console。"}</p>
                <dl className="kv-grid compact">
                  <div><dt>来源</dt><dd>{appMeta?.buildLabel ?? "未知"}</dd></div>
                  <div><dt>环境</dt><dd>{appMeta?.source === "packaged" ? "安装版" : appMeta?.source === "development" ? "开发版" : "未知"}</dd></div>
                </dl>
              </div>
              <div className={`hero-side-card health-card ${desktopHealth.severity}`}>
                <span className="panel-tag">健康度</span>
                <h3>{desktopHealth.summary}</h3>
                <p>{desktopHealth.detail}</p>
                <div className="health-list">
                  {desktopHealth.items.length === 0 ? (
                    <p className="health-item ok">当前桌面环境没有明显阻塞项。</p>
                  ) : (
                    desktopHealth.items.slice(0, 3).map((item) => (
                      <div key={item.key} className={`health-action ${item.severity}`}>
                        <p className={`health-item ${item.severity}`}>{item.title}</p>
                        <button className="ghost-button compact-button" onClick={() => void handleDesktopHealthAction(item)}>
                          {item.actionLabel}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="hero-side-card quickstart-card">
                <span className="panel-tag">快速开始</span>
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
                      <button className="ghost-button compact-button" onClick={() => void handleQuickstartAction(item)}>
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
                <button className="ghost-button" onClick={() => void handleQuickstartAction(item)}>{item.actionLabel}</button>
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
}
