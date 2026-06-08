import type { AppState } from "../../../shared/types";

type Props = {
  state: AppState;
  proxyStateLabel: string;
  nextRecommendedAction: string;
};

export function StatusOverviewPanel({
  state,
  proxyStateLabel,
  nextRecommendedAction
}: Props) {
  return (
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
          <div><dt>代理</dt><dd>{proxyStateLabel}</dd></div>
          <div><dt>本地 endpoint</dt><dd>{state.proxyStatus.endpoint ?? "未启动"}</dd></div>
          <div><dt>最近测试</dt><dd>{state.lastSuccessfulProviderTest?.modelId ?? "尚未测试"}</dd></div>
          <div><dt>最近恢复</dt><dd>{state.lastAppliedKiroBackup?.backupPath ?? "暂无"}</dd></div>
          <div><dt>推荐下一步</dt><dd>{nextRecommendedAction}</dd></div>
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
  );
}
