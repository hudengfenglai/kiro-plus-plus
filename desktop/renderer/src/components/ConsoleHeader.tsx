import type { DesktopBridgeStatus } from "../../../shared/bridge-status";
import type { QuickstartSummary } from "../../../shared/quickstart";
import type { AppMeta, DiagnosticsExportBundle } from "../../../shared/types";
import type { ViewKey } from "../app-types";

type ExportSummary = {
  bundleName: string;
};

type Props = {
  status: string;
  appMeta: AppMeta | null;
  quickstartSummary: QuickstartSummary;
  bridgeStatus: DesktopBridgeStatus;
  primaryWorkbenchActionLabel: string;
  launchWorkbenchActionLabel: string;
  handlePrimaryWorkbenchAction: () => void | Promise<unknown>;
  toggleTheme: () => void;
  theme: "dark" | "light";
  setView: (view: ViewKey) => void;
  handleLaunchEntry: () => void | Promise<unknown>;
  viewingHistoricalBundle: boolean;
  lastExportBundle: DiagnosticsExportBundle | null;
  exportSummary: ExportSummary | null;
  basename: (value?: null | string) => string;
  formatTime: (value?: null | string) => string;
  selectLatestExportBundle: () => void;
  openExportArtifact: (target: null | string, label: string) => void;
  copySupportSnapshot: () => void;
};

export function ConsoleHeader({
  status,
  appMeta,
  quickstartSummary,
  bridgeStatus,
  primaryWorkbenchActionLabel,
  launchWorkbenchActionLabel,
  handlePrimaryWorkbenchAction,
  toggleTheme,
  theme,
  setView,
  handleLaunchEntry,
  viewingHistoricalBundle,
  lastExportBundle,
  exportSummary,
  basename,
  formatTime,
  selectLatestExportBundle,
  openExportArtifact,
  copySupportSnapshot
}: Props) {
  return (
    <>
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
            <span>桥接</span>
            <strong>{bridgeStatus.complete ? "完整" : "需更新"}</strong>
          </div>
          <button
            className="ghost-button"
            onClick={() => void handlePrimaryWorkbenchAction()}
          >
            {primaryWorkbenchActionLabel}
          </button>
          <button className="ghost-button" onClick={toggleTheme}>
            {theme === "dark" ? "浅色主题" : "深色主题"}
          </button>
          <button className="ghost-button" onClick={() => setView("home")}>返回首页</button>
          <button onClick={() => void handleLaunchEntry()}>
            {launchWorkbenchActionLabel}
          </button>
        </div>
      </header>

      {viewingHistoricalBundle && lastExportBundle ? (
        <section className="historical-banner">
          <div className="historical-banner-copy">
            <span className="snapshot-label">历史支持包</span>
            <strong>当前正在查看历史支持快照</strong>
            <p>
              当前的诊断摘要、最近失败/成功记录和推荐动作来自
              {" "}
              <code>{exportSummary?.bundleName ?? basename(lastExportBundle.bundleDir)}</code>
              {" "}
              ，不是实时运行状态。
            </p>
            <small>导出时间：{formatTime(lastExportBundle.exportedAt ?? null)}</small>
          </div>
          <div className="historical-banner-actions">
            <button className="ghost-button compact-button" onClick={selectLatestExportBundle}>
              回到最新支持包
            </button>
            <button
              className="ghost-button compact-button"
              onClick={() => openExportArtifact(lastExportBundle.requestsPath ?? null, "请求文件")}
            >
              打开请求文件
            </button>
            <button className="ghost-button compact-button" onClick={copySupportSnapshot}>
              复制支持快照
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
