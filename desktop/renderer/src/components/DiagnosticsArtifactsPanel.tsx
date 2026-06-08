import type {
  AppState,
  DiagnosticsExportBundle,
  WorkbenchExportSnapshot
} from "../../../shared/types";
import {
  describeSupportBundleAvailability,
  formatMissingPathLabels
} from "../../../shared/support-bundle-status";
import { describeWorkbenchSnapshotAvailability } from "../../../shared/workbench-snapshot-status";

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

type Props = {
  diagnosticsSummarySource: AppState["diagnosticsSummarySource"];
  diagnosticsSummary: string;
  viewingHistoricalBundle: boolean;
  exportSummary: ExportSummary | null;
  lastExportBundle: DiagnosticsExportBundle | null;
  exportHistory: DiagnosticsExportBundle[];
  latestWorkbenchExport: WorkbenchExportSnapshot | null;
  workbenchExportHistory: WorkbenchExportSnapshot[];
  statusDetail: string;
  formatTime: (value?: null | string) => string;
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
  copySupportSnapshot: () => void;
  openExportArtifact: (target: null | string, label: string) => void;
  selectLatestExportBundle: () => void;
  selectExportBundle: (bundle: DiagnosticsExportBundle) => void;
  deleteExportBundle: (bundle: DiagnosticsExportBundle) => void;
  writeSnapshotPath: (filePath: string) => void;
  clearMissingWorkbenchExportHistory: () => void;
  clearWorkbenchExportHistory: () => void;
  openWorkbenchSnapshot: (filePath: string) => void;
  deleteWorkbenchExport: (filePath: string) => void;
};

export function DiagnosticsArtifactsPanel({
  diagnosticsSummarySource,
  diagnosticsSummary,
  viewingHistoricalBundle,
  exportSummary,
  lastExportBundle,
  exportHistory,
  latestWorkbenchExport,
  workbenchExportHistory,
  statusDetail,
  formatTime,
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
  copySupportSnapshot,
  openExportArtifact,
  selectLatestExportBundle,
  selectExportBundle,
  deleteExportBundle,
  writeSnapshotPath,
  clearMissingWorkbenchExportHistory,
  clearWorkbenchExportHistory,
  openWorkbenchSnapshot,
  deleteWorkbenchExport
}: Props) {
  const exportAvailability = describeSupportBundleAvailability(lastExportBundle);
  const latestWorkbenchExportAvailability = describeWorkbenchSnapshotAvailability(latestWorkbenchExport);

  return (
    <div className="workbench-body">
      {viewingHistoricalBundle ? (
        <p className="workbench-history-hint">当前诊断摘要来自已选中的历史支持包；复制、查看和推荐动作都会沿用这份历史快照上下文。</p>
      ) : null}
      <div className="mini-actions diagnostics-source-row">
        <span className="snapshot-label">
          {diagnosticsSummarySource.kind === "bundle"
            ? `摘要来源：${diagnosticsSummarySource.bundleName}`
            : "摘要来源：当前实时诊断"}
        </span>
      </div>
      <div className="summary-actions">
        <button className="ghost-button" onClick={copyWorkbenchSnapshot}>复制当前工作台状态</button>
        <button className="ghost-button" onClick={exportWorkbenchSnapshot}>导出当前工作台状态</button>
        <button className="ghost-button" onClick={openLatestWorkbenchSnapshot}>打开最近工作台快照</button>
        <button className="ghost-button" onClick={copyDiagnosticsSummary}>复制脱敏摘要</button>
        <button className="ghost-button" onClick={exportDiagnosticsToFile}>导出诊断文件</button>
        <button className="ghost-button" onClick={exportDiagnosticsZip}>导出 zip 支持包</button>
        <button className="ghost-button" onClick={openExportBundleDir}>打开导出目录</button>
        <button className="ghost-button" onClick={openExportZip}>打开 zip 支持包</button>
        <button className="ghost-button" onClick={clearMissingDiagnosticsHistory}>清理失效支持包</button>
        <button className="ghost-button" onClick={clearExportHistory}>清空支持包历史</button>
        <button className="ghost-button" onClick={refreshDiagnose}>刷新诊断</button>
      </div>

      {exportSummary ? (
        <section className="export-card">
          <div className="export-card-head">
            <div>
              <span className="snapshot-label">支持包</span>
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
            <div><dt>状态</dt><dd>{exportAvailability.label}</dd></div>
            <div><dt>zip</dt><dd>{
              !lastExportBundle?.zipPath
                ? "未导出"
                : lastExportBundle.zipExists === false
                  ? `${exportSummary.zipName}（文件缺失）`
                  : exportSummary.zipName
            }</dd></div>
            <div><dt>说明</dt><dd>{exportSummary.readmeName}</dd></div>
            <div><dt>摘要</dt><dd>{exportSummary.summaryName}</dd></div>
            <div><dt>快照</dt><dd>{exportSummary.snapshotName}</dd></div>
            <div><dt>请求</dt><dd>{exportSummary.requestsName}</dd></div>
            <div><dt>清单</dt><dd>{exportSummary.manifestName}</dd></div>
          </dl>
          {lastExportBundle?.exists === false ? (
            <p className="export-subtle">
              这条支持包记录对应的文件已经不完整或被删除
              {lastExportBundle.missingPaths?.length
                ? `：缺少 ${formatMissingPathLabels(lastExportBundle.missingPaths).join("、")}`
                : ""}
              ，建议移除这条历史后重新导出。
            </p>
          ) : null}
          {lastExportBundle?.exists !== false && lastExportBundle?.zipPath && lastExportBundle?.zipExists === false ? (
            <p className="export-subtle">当前支持包主体仍可用，但 `.zip` 文件已经不存在；如需分享压缩包，请重新导出 zip。</p>
          ) : null}
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
                {exportHistory.map((bundle) => {
                  const availability = describeSupportBundleAvailability(bundle);
                  return (
                    <div
                      key={bundle.bundleName}
                      className={bundle.bundleName === lastExportBundle?.bundleName ? "history-row active" : "history-row"}
                    >
                      <button
                        className={`${bundle.bundleName === lastExportBundle?.bundleName ? "history-chip active" : "history-chip"}${bundle.exists === false ? " missing" : ""}`}
                        onClick={() => selectExportBundle(bundle)}
                      >
                        <span>{bundle.bundleName}</span>
                        <small>
                          {formatTime(bundle.exportedAt)}
                          {availability.state === "ready" ? "" : ` · ${availability.label}`}
                        </small>
                      </button>
                      <button className="ghost-button history-delete" onClick={() => deleteExportBundle(bundle)}>移除</button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          <p className="export-hint">导出内容已默认脱敏，适合发到 GitHub Issue、LinuxDO 或群内排错。</p>
          <p className="export-hint">“清理失效支持包”只会移除磁盘上已不存在的历史记录，不会删除仍可用的导出文件。</p>
        </section>
      ) : null}

      {latestWorkbenchExport ? (
        <section className="export-card compact-export-card">
          <div className="export-card-head">
            <div>
              <span className="snapshot-label">工作台快照</span>
              <strong>最近工作台快照</strong>
            </div>
            <small>{formatTime(latestWorkbenchExport.exportedAt)}</small>
          </div>
          <dl className="kv-grid compact">
            <div><dt>文件</dt><dd>{basename(latestWorkbenchExport.filePath)}</dd></div>
            <div><dt>状态</dt><dd>{latestWorkbenchExportAvailability.label}</dd></div>
            <div><dt>位置</dt><dd>{latestWorkbenchExport.filePath}</dd></div>
          </dl>
          {latestWorkbenchExportAvailability.detail ? (
            <p className="export-subtle">
              {latestWorkbenchExportAvailability.detail}
              {latestWorkbenchExportAvailability.state === "missing"
                ? "，可以直接移除这条历史记录。"
                : "。"}
            </p>
          ) : null}
          <div className="export-actions compact-export-actions">
            <button className="ghost-button" onClick={openLatestWorkbenchSnapshot}>打开快照</button>
            <button
              className="ghost-button"
              onClick={() => writeSnapshotPath(latestWorkbenchExport.filePath)}
            >
              复制路径
            </button>
            <button className="ghost-button" onClick={clearMissingWorkbenchExportHistory}>清理失效快照</button>
            <button className="ghost-button" onClick={clearWorkbenchExportHistory}>清空快照历史</button>
          </div>
          {workbenchExportHistory.length > 1 ? (
            <div className="export-history compact-export-history">
              <div className="export-history-head">
                <strong>最近快照历史</strong>
                <small>保留最近 {workbenchExportHistory.length} 次</small>
              </div>
              <div className="export-history-list">
                {workbenchExportHistory.map((snapshot) => {
                  const availability = describeWorkbenchSnapshotAvailability(snapshot);
                  return (
                    <div
                      key={snapshot.filePath}
                      className={snapshot.filePath === latestWorkbenchExport.filePath ? "history-row active" : "history-row"}
                    >
                      <button
                        className={`${snapshot.filePath === latestWorkbenchExport.filePath ? "history-chip active" : "history-chip"}${snapshot.exists === false ? " missing" : ""}`}
                        onClick={() => openWorkbenchSnapshot(snapshot.filePath)}
                      >
                        <span>{basename(snapshot.filePath)}</span>
                        <small>
                          {formatTime(snapshot.exportedAt)}
                          {availability.state === "ready" ? "" : ` · ${availability.label}`}
                        </small>
                      </button>
                      <button className="ghost-button history-delete" onClick={() => deleteWorkbenchExport(snapshot.filePath)}>移除</button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          <p className="export-hint">“清理失效快照”只会移除磁盘上已不存在的记录，不会删除仍可打开的 Markdown 文件。</p>
          <p className="export-hint">这个 Markdown 文件保存的是当前工作台视图，适合直接附到 GitHub Issue 或 LinuxDO 帖子。</p>
        </section>
      ) : null}

      <pre className="summary-block">{diagnosticsSummary || "诊断摘要将在这里显示。"}</pre>
      {statusDetail ? <pre className="status-detail">{statusDetail}</pre> : null}
    </div>
  );
}
