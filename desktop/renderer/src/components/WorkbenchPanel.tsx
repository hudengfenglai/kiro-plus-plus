import type {
  DiagnosticsExportBundle,
  DiagnosticsLogSnapshot,
  LaunchAttempt,
  RequestLogEntry,
  WorkbenchExportSnapshot
} from "../../../shared/types";
import { DiagnosticsArtifactsPanel } from "./DiagnosticsArtifactsPanel";

type WorkbenchTab = "logs" | "output" | "diagnostics";

type ActionEntry = {
  id: string;
  title: string;
  detail: string;
  tone: "info" | "success" | "error";
  at: string;
};

type ExportSummary = {
  bundleName: string;
  headline: string;
  recommendedAction: DiagnosticsExportBundle["recommendedAction"] | null;
  zipName: string;
  readmeName: string;
  summaryName: string;
  snapshotName: string;
  manifestName: string;
  requestsName: string;
  exportedAt: string | null;
};

type ToneState = {
  title: string;
  tone: "info" | "success" | "error";
};

type LogFilters = {
  operation: string;
  status: string;
  errorOnly: boolean;
};

type Props = {
  quickstartShowSetupWorkspace: boolean;
  launchStatus: ToneState;
  bootstrapStatus: ToneState;
  lastLaunchAttempt: LaunchAttempt | null;
  lastBootstrapAttempt: LaunchAttempt | null;
  formatTime: (value?: null | string) => string;
  describeLaunchStep: (step?: null | string) => string;
  describeBootstrapStep: (step?: null | string) => string;
  readinessIssues: Array<{
    key: string;
    severity: "error" | "warning";
    title: string;
    detail: string;
    action: string;
  }>;
  handleReadinessAction: (issue: any) => void | Promise<unknown>;
  workbenchTab: WorkbenchTab;
  setWorkbenchTab: (tab: WorkbenchTab) => void;
  viewingHistoricalBundle: boolean;
  selectLatestExportBundle: () => void;
  copySupportSnapshot: () => void;
  recentLogsFromHistoricalBundle: boolean;
  recentLogsSourceBundleName?: string;
  lastExportBundle: DiagnosticsExportBundle | null;
  logFilters: LogFilters;
  setLogFilters: (updater: LogFilters | ((previous: LogFilters) => LogFilters)) => void;
  refreshLogs: () => void | Promise<unknown>;
  openExportArtifact: (target: null | string, label: string) => void;
  logRows: RequestLogEntry[];
  outputEntries: ActionEntry[];
  outputSessionStartedAt: string | null;
  copyOutputTimeline: () => void;
  clearOutputEntries: () => void;
  diagnosticsSummarySource: { kind: "live" | "bundle"; bundleName?: string };
  diagnosticsSummary: string;
  exportSummary: ExportSummary | null;
  exportHistory: DiagnosticsExportBundle[];
  latestWorkbenchExport: WorkbenchExportSnapshot | null;
  workbenchExportHistory: WorkbenchExportSnapshot[];
  statusDetail: string;
  basename: (value?: null | string) => string;
  copyWorkbenchSnapshot: () => void;
  exportWorkbenchSnapshot: () => void;
  openLatestWorkbenchSnapshot: () => void;
  copyDiagnosticsSummary: () => void;
  exportDiagnosticsToFile: () => void;
  exportDiagnosticsZip: () => void;
  openExportBundleDir: () => void;
  openExportZip: () => void;
  clearMissingDiagnosticsHistory: () => void;
  clearExportHistory: () => void;
  refreshDiagnose: () => void;
  copyExportHeadline: () => void;
  runRecommendedAction: () => void;
  copyRecommendedAction: () => void;
  selectExportBundle: (bundle: DiagnosticsExportBundle) => void;
  deleteExportBundle: (bundle: DiagnosticsExportBundle) => void;
  writeSnapshotPath: (filePath: string) => void;
  clearMissingWorkbenchExportHistory: () => void;
  clearWorkbenchExportHistory: () => void;
  openWorkbenchSnapshot: (filePath: string) => void;
  deleteWorkbenchExport: (filePath: string) => void;
};

export function WorkbenchPanel({
  quickstartShowSetupWorkspace,
  launchStatus,
  bootstrapStatus,
  lastLaunchAttempt,
  lastBootstrapAttempt,
  formatTime,
  describeLaunchStep,
  describeBootstrapStep,
  readinessIssues,
  handleReadinessAction,
  workbenchTab,
  setWorkbenchTab,
  viewingHistoricalBundle,
  selectLatestExportBundle,
  copySupportSnapshot,
  recentLogsFromHistoricalBundle,
  recentLogsSourceBundleName,
  lastExportBundle,
  logFilters,
  setLogFilters,
  refreshLogs,
  openExportArtifact,
  logRows,
  outputEntries,
  outputSessionStartedAt,
  copyOutputTimeline,
  clearOutputEntries,
  diagnosticsSummarySource,
  diagnosticsSummary,
  exportSummary,
  exportHistory,
  latestWorkbenchExport,
  workbenchExportHistory,
  statusDetail,
  basename,
  copyWorkbenchSnapshot,
  exportWorkbenchSnapshot,
  openLatestWorkbenchSnapshot,
  copyDiagnosticsSummary,
  exportDiagnosticsToFile,
  exportDiagnosticsZip,
  openExportBundleDir,
  openExportZip,
  clearMissingDiagnosticsHistory,
  clearExportHistory,
  refreshDiagnose,
  copyExportHeadline,
  runRecommendedAction,
  copyRecommendedAction,
  selectExportBundle,
  deleteExportBundle,
  writeSnapshotPath,
  clearMissingWorkbenchExportHistory,
  clearWorkbenchExportHistory,
  openWorkbenchSnapshot,
  deleteWorkbenchExport
}: Props) {
  return (
    <>
      {!quickstartShowSetupWorkspace ? (
        <section className="workspace-grid">
          <article className={`workspace-card launch-card ${launchStatus.tone}`}>
            <div className="card-head">
              <div>
                <span className="panel-tag">Launch</span>
                <h3>Launch Kiro with Kiro++</h3>
              </div>
              <span className="tiny-meta">{formatTime(lastLaunchAttempt?.finishedAt ?? lastLaunchAttempt?.startedAt ?? null)}</span>
            </div>
            <dl className="kv-grid">
              <div><dt>结果</dt><dd>{launchStatus.title}</dd></div>
              <div><dt>阶段</dt><dd>{describeLaunchStep(lastLaunchAttempt?.step)}</dd></div>
              <div><dt>endpoint</dt><dd>{lastLaunchAttempt?.endpoint ?? "暂无"}</dd></div>
              <div><dt>Kiro 路径</dt><dd>{lastLaunchAttempt?.installPath ?? "暂无"}</dd></div>
            </dl>
            <p className="launch-detail">{lastLaunchAttempt?.detail ?? "点击顶部入口后，这里会记录最近一次启动尝试的阶段和结果。"}</p>
            {lastLaunchAttempt?.error ? (
              <pre className="summary-block compact">{lastLaunchAttempt.error}</pre>
            ) : null}
          </article>

          <article className={`workspace-card launch-card ${bootstrapStatus.tone}`}>
            <div className="card-head">
              <div>
                <span className="panel-tag">Bootstrap</span>
                <h3>启动预热状态</h3>
              </div>
              <span className="tiny-meta">{formatTime(lastBootstrapAttempt?.finishedAt ?? lastBootstrapAttempt?.startedAt ?? null)}</span>
            </div>
            <dl className="kv-grid">
              <div><dt>结果</dt><dd>{bootstrapStatus.title}</dd></div>
              <div><dt>阶段</dt><dd>{describeBootstrapStep(lastBootstrapAttempt?.step)}</dd></div>
              <div><dt>endpoint</dt><dd>{lastBootstrapAttempt?.endpoint ?? "暂无"}</dd></div>
              <div><dt>Kiro 路径</dt><dd>{lastBootstrapAttempt?.installPath ?? "暂无"}</dd></div>
            </dl>
            <p className="launch-detail">{lastBootstrapAttempt?.detail ?? "如果开启了启动时自动应用，这里会显示最近一次预热的执行结果。"}</p>
            {lastBootstrapAttempt?.error ? (
              <pre className="summary-block compact">{lastBootstrapAttempt.error}</pre>
            ) : null}
          </article>
        </section>
      ) : null}

      {readinessIssues.length > 0 ? (
        <section className="workspace-card">
          <div className="card-head">
            <div>
              <span className="panel-tag">Readiness</span>
              <h3>当前阻塞项与建议动作</h3>
            </div>
            <span className="tiny-meta">{readinessIssues.length} 项</span>
          </div>
          <div className="issue-list">
            {readinessIssues.map((issue) => (
              <article key={issue.key} className={`issue-row ${issue.severity}`}>
                <div className="issue-copy">
                  <strong>{issue.title}</strong>
                  <p>{issue.detail}</p>
                </div>
                <button className="ghost-button compact-button" onClick={() => void handleReadinessAction(issue)}>
                  {issue.action}
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!quickstartShowSetupWorkspace ? (
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

          {viewingHistoricalBundle ? (
            <div className="workbench-history-banner">
              <div className="workbench-history-banner-copy">
                <strong>当前工作区正在查看历史支持包快照</strong>
                <p>中栏内容会优先显示这份历史快照相关的摘要与辅助信息；涉及真实环境的动作会先回到最新支持包再执行。</p>
              </div>
              <div className="mini-actions">
                <button className="ghost-button compact-button" onClick={selectLatestExportBundle}>
                  回到最新支持包
                </button>
                <button className="ghost-button compact-button" onClick={copySupportSnapshot}>
                  复制支持快照
                </button>
              </div>
            </div>
          ) : null}

          {workbenchTab === "logs" && (
            <div className="workbench-body">
              {recentLogsFromHistoricalBundle ? (
                <p className="workbench-history-hint">
                  当前日志列表已切换到历史支持包
                  {" "}
                  <code>{recentLogsSourceBundleName ?? lastExportBundle?.bundleName ?? "unknown"}</code>
                  {" "}
                  里的请求快照；这不是实时代理日志。
                </p>
              ) : null}
              {!recentLogsFromHistoricalBundle ? (
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
                  <button className="ghost-button" onClick={() => void refreshLogs()}>刷新日志</button>
                </div>
              ) : (
                <div className="mini-actions">
                  <button className="ghost-button compact-button" onClick={() => openExportArtifact(lastExportBundle?.requestsPath ?? null, "请求文件")}>
                    打开请求文件
                  </button>
                  <button className="ghost-button compact-button" onClick={selectLatestExportBundle}>
                    回到最新支持包
                  </button>
                </div>
              )}
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
              {viewingHistoricalBundle ? (
                <p className="workbench-history-hint">这里显示的是当前桌面会话动作输出，不是历史支持包执行记录；历史支持信息请以支持包摘要和请求文件为准。</p>
              ) : null}
              <div className="summary-actions output-toolbar">
                <span className="snapshot-label">来源：当前桌面会话</span>
                <span className="tiny-meta">
                  {outputEntries.length > 0
                    ? `本次会话 ${formatTime(outputSessionStartedAt)} 起，累计 ${outputEntries.length} 条`
                    : "仅记录本次打开控制台后的动作"}
                </span>
                <button className="ghost-button" onClick={copyOutputTimeline}>复制会话输出</button>
                <button className="ghost-button" onClick={clearOutputEntries}>清空输出</button>
              </div>
              <div className="output-list">
                {outputEntries.length === 0 ? (
                  <p className="empty-row">当前还没有会话输出。你在本次打开 Kiro++ Console 期间执行的测试、配置、诊断和导出动作会显示在这里。</p>
                ) : null}
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
            <DiagnosticsArtifactsPanel
              diagnosticsSummarySource={diagnosticsSummarySource}
              diagnosticsSummary={diagnosticsSummary}
              viewingHistoricalBundle={viewingHistoricalBundle}
              exportSummary={exportSummary}
              lastExportBundle={lastExportBundle}
              exportHistory={exportHistory}
              latestWorkbenchExport={latestWorkbenchExport}
              workbenchExportHistory={workbenchExportHistory}
              statusDetail={statusDetail}
              formatTime={formatTime}
              basename={basename}
              copyWorkbenchSnapshot={copyWorkbenchSnapshot}
              exportWorkbenchSnapshot={exportWorkbenchSnapshot}
              openLatestWorkbenchSnapshot={openLatestWorkbenchSnapshot}
              copyDiagnosticsSummary={copyDiagnosticsSummary}
              exportDiagnosticsToFile={exportDiagnosticsToFile}
              exportDiagnosticsZip={exportDiagnosticsZip}
              openExportBundleDir={openExportBundleDir}
              openExportZip={openExportZip}
              clearMissingDiagnosticsHistory={clearMissingDiagnosticsHistory}
              clearExportHistory={clearExportHistory}
              refreshDiagnose={refreshDiagnose}
              copyExportHeadline={copyExportHeadline}
              runRecommendedAction={runRecommendedAction}
              copyRecommendedAction={copyRecommendedAction}
              copySupportSnapshot={copySupportSnapshot}
              openExportArtifact={openExportArtifact}
              selectLatestExportBundle={selectLatestExportBundle}
              selectExportBundle={selectExportBundle}
              deleteExportBundle={deleteExportBundle}
              writeSnapshotPath={writeSnapshotPath}
              clearMissingWorkbenchExportHistory={clearMissingWorkbenchExportHistory}
              clearWorkbenchExportHistory={clearWorkbenchExportHistory}
              openWorkbenchSnapshot={openWorkbenchSnapshot}
              deleteWorkbenchExport={deleteWorkbenchExport}
            />
          )}
        </section>
      ) : null}
    </>
  );
}
