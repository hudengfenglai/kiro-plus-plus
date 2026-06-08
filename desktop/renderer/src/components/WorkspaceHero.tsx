import type { DesktopBridgeStatus } from "../../../shared/bridge-status";
import type { DesktopHealthSummary } from "../../../shared/desktop-health";
import type { QuickstartSummary } from "../../../shared/quickstart";
import type { AppMeta, AppState } from "../../../shared/types";

type ConsoleFocus = "status" | "providers" | "kiro" | "logs" | "playground";

type Props = {
  quickstartSummary: QuickstartSummary;
  primaryWorkbenchActionLabel: string;
  secondaryWorkbenchActionLabel: string;
  handlePrimaryWorkbenchAction: () => void | Promise<unknown>;
  handleSecondaryWorkbenchAction: () => void | Promise<unknown>;
  primaryIssue: AppState["readinessIssues"][number] | null;
  handleReadinessAction: (issue: AppState["readinessIssues"][number]) => void | Promise<unknown>;
  openConsole: (focus: ConsoleFocus) => void;
  selectedProviderLabel: string;
  selectedDefaultModel: string;
  proxyStateLabel: string;
  bridgeStatus: DesktopBridgeStatus;
  appMeta: AppMeta | null;
  desktopHealth: DesktopHealthSummary;
};

export function WorkspaceHero({
  quickstartSummary,
  primaryWorkbenchActionLabel,
  secondaryWorkbenchActionLabel,
  handlePrimaryWorkbenchAction,
  handleSecondaryWorkbenchAction,
  primaryIssue,
  handleReadinessAction,
  openConsole,
  selectedProviderLabel,
  selectedDefaultModel,
  proxyStateLabel,
  bridgeStatus,
  appMeta,
  desktopHealth
}: Props) {
  return (
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
              onClick={() => void handlePrimaryWorkbenchAction()}
            >
              {primaryWorkbenchActionLabel}
            </button>
            <button
              className="ghost-button compact-button"
              onClick={() => void handleSecondaryWorkbenchAction()}
            >
              {secondaryWorkbenchActionLabel}
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
              onClick={() => void handlePrimaryWorkbenchAction()}
            >
              {primaryWorkbenchActionLabel}
            </button>
            <button
              className="ghost-button compact-button"
              onClick={() => void handleSecondaryWorkbenchAction()}
            >
              {secondaryWorkbenchActionLabel}
            </button>
          </div>
        </div>
        {primaryIssue ? (
          <div className={`hero-callout ${primaryIssue.severity}`}>
            <div className="hero-callout-copy">
              <strong>{primaryIssue.title}</strong>
              <p>{primaryIssue.detail}</p>
            </div>
            <button className="ghost-button compact-button" onClick={() => void handleReadinessAction(primaryIssue)}>
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
          <strong>{selectedDefaultModel}</strong>
        </div>
        <div className="kpi-card">
          <span>代理状态</span>
          <strong>{proxyStateLabel}</strong>
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
  );
}
