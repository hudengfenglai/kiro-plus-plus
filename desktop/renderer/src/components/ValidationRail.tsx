import type {
  DiagnosticsExportBundle,
  DiagnosticsLogSnapshot,
  ProviderProfile,
  RequestLogEntry
} from "../../../shared/types";
import type { QuickstartItem } from "../../../shared/quickstart";
import { describeSupportBundleAvailability } from "../../../shared/support-bundle-status";
import type { ExportSummary, PlaygroundState } from "../app-types";

type Props = {
  quickstartSummaryShowSetupRail: boolean;
  quickstartChecklist: QuickstartItem[];
  handleQuickstartAction: (item: QuickstartItem) => void | Promise<unknown>;
  openQuickstart: () => void;
  openProvidersDoc: () => void;
  playgroundLockedByHistory: boolean;
  handleResumeLivePlayground: () => void;
  openHistoricalRequests: () => void;
  playgroundProviderId: string;
  setPlaygroundProviderId: (value: string) => void;
  playgroundModelId: string;
  setPlaygroundModelId: (value: string) => void;
  playgroundPrompt: string;
  setPlaygroundPrompt: (value: string) => void;
  providers: ProviderProfile[];
  providerForPlayground: ProviderProfile | null;
  handlePlaygroundSend: () => void;
  playgroundResult: PlaygroundState | null;
  formatTime: (value?: null | string) => string;
  viewingHistoricalBundle: boolean;
  selectLatestExportBundle: () => void;
  latestFailure: DiagnosticsLogSnapshot | RequestLogEntry | null;
  latestSuccess: DiagnosticsLogSnapshot | RequestLogEntry | null;
  summarizeLog: (entry: DiagnosticsLogSnapshot | RequestLogEntry | null) => { title: string; body: string };
  handleDiagnosticLogAction: (entry: DiagnosticsLogSnapshot | RequestLogEntry | null) => void;
  copyLogSummary: (entry: DiagnosticsLogSnapshot | RequestLogEntry | null, kind: "failure" | "success") => void;
  copyDiagnosticsSummary: () => void;
  exportDiagnosticsToFile: () => void;
  exportDiagnosticsZip: () => void;
  openExportBundleDir: () => void;
  openExportZip: () => void;
  clearExportHistory: () => void;
  openStreamingDoc: () => void;
  exportSummary: ExportSummary | null;
  lastExportBundle: DiagnosticsExportBundle | null;
  exportHistory: DiagnosticsExportBundle[];
  copyExportHeadline: () => void;
  runRecommendedAction: () => void;
  copyRecommendedAction: () => void;
  copySupportSnapshot: () => void;
  openExportArtifact: (target: null | string, label: string) => void;
  selectExportBundle: (bundle: DiagnosticsExportBundle) => void;
  deleteExportBundle: (bundle: DiagnosticsExportBundle) => void;
  statusDetail: string;
};

export function ValidationRail({
  quickstartSummaryShowSetupRail,
  quickstartChecklist,
  handleQuickstartAction,
  openQuickstart,
  openProvidersDoc,
  playgroundLockedByHistory,
  handleResumeLivePlayground,
  openHistoricalRequests,
  playgroundProviderId,
  setPlaygroundProviderId,
  playgroundModelId,
  setPlaygroundModelId,
  playgroundPrompt,
  setPlaygroundPrompt,
  providers,
  providerForPlayground,
  handlePlaygroundSend,
  playgroundResult,
  formatTime,
  viewingHistoricalBundle,
  selectLatestExportBundle,
  latestFailure,
  latestSuccess,
  summarizeLog,
  handleDiagnosticLogAction,
  copyLogSummary,
  copyDiagnosticsSummary,
  exportDiagnosticsToFile,
  exportDiagnosticsZip,
  openExportBundleDir,
  openExportZip,
  clearExportHistory,
  openStreamingDoc,
  exportSummary,
  lastExportBundle,
  exportHistory,
  copyExportHeadline,
  runRecommendedAction,
  copyRecommendedAction,
  copySupportSnapshot,
  openExportArtifact,
  selectExportBundle,
  deleteExportBundle,
  statusDetail
}: Props) {
  const exportAvailability = describeSupportBundleAvailability(lastExportBundle);

  if (quickstartSummaryShowSetupRail) {
    return (
      <section className="rail-panel setup-rail-panel">
        <div className="rail-panel-head">
          <div>
            <span className="panel-tag">接入引导</span>
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
          <button className="ghost-button" onClick={openQuickstart}>打开快速开始</button>
          <button className="ghost-button" onClick={openProvidersDoc}>打开 Provider 文档</button>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="rail-panel">
        <div className="rail-panel-head">
          <div>
            <span className="panel-tag">验证区</span>
            <h2>单次模型验证</h2>
          </div>
        </div>

        {playgroundLockedByHistory ? (
          <div className="playground-history-lock">
            <div className="playground-history-lock-copy">
              <strong>当前正在查看历史支持包，已暂停实时模型验证</strong>
              <p>右侧的 Provider、模型和提示词仅保留为历史参考。要发送真实请求，请先回到最新支持包。</p>
            </div>
            <div className="mini-actions">
              <button className="ghost-button compact-button" onClick={handleResumeLivePlayground}>
                回到实时验证区
              </button>
              <button
                className="ghost-button compact-button"
                onClick={openHistoricalRequests}
              >
                打开历史请求
              </button>
            </div>
          </div>
        ) : null}

        <label className="field">
          <span>Provider</span>
          <select
            value={playgroundProviderId}
            disabled={playgroundLockedByHistory}
            onChange={(event) => setPlaygroundProviderId(event.target.value)}
          >
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>{provider.label}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>模型</span>
          <select
            value={playgroundModelId}
            disabled={playgroundLockedByHistory}
            onChange={(event) => setPlaygroundModelId(event.target.value)}
          >
            {(providerForPlayground?.models ?? []).map((model) => (
              <option key={model.id} value={model.id}>{model.id}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>提示词</span>
          <textarea
            value={playgroundPrompt}
            readOnly={playgroundLockedByHistory}
            onChange={(event) => setPlaygroundPrompt(event.target.value)}
          />
        </label>

        <div className="button-stack">
          <button onClick={handlePlaygroundSend}>
            {playgroundLockedByHistory ? "回到实时后验证" : "发送验证"}
          </button>
        </div>

        <div className="playground-result">
          <div className="result-head">
            <strong>
              {playgroundResult?.ok
                ? "请求成功"
                : (playgroundLockedByHistory ? "历史模式" : "等待验证")}
            </strong>
            <small>{formatTime(playgroundResult?.requestedAt)}</small>
          </div>
          <dl className="kv-grid compact">
            <div><dt>modelId</dt><dd>{playgroundResult?.modelId ?? (playgroundModelId || "未选择")}</dd></div>
            <div><dt>耗时</dt><dd>{playgroundResult ? `${playgroundResult.latencyMs} ms` : "-"}</dd></div>
          </dl>
          <pre>
            {playgroundResult?.text
              ?? (playgroundLockedByHistory
                ? "当前展示的是历史支持包上下文。回到最新支持包后，再在这里发起真实模型验证。"
                : "发送后在这里显示模型返回文本。")}
          </pre>
        </div>
      </section>

      <section className="rail-panel">
        <div className="rail-panel-head">
          <div>
            <span className="panel-tag">诊断</span>
            <h2>伴随排错</h2>
          </div>
        </div>

        {viewingHistoricalBundle ? (
          <div className="diagnostics-history-lock">
            <div className="diagnostics-history-lock-copy">
              <strong>当前 Diagnostics 来自历史支持包快照</strong>
              <p>失败/成功摘要和“查看详情”都基于这份历史支持包，不会直接跳到当前实时日志。</p>
            </div>
            <div className="mini-actions">
              <button className="ghost-button compact-button" onClick={selectLatestExportBundle}>
                回到最新支持包
              </button>
              <button
                className="ghost-button compact-button"
                onClick={openHistoricalRequests}
              >
                打开历史请求
              </button>
            </div>
          </div>
        ) : null}

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
          <p className="export-hint">当前右侧摘要来自历史支持包快照；复制摘要会复制历史上下文，查看详情会打开该支持包的请求文件。</p>
        ) : null}

        <div className="button-stack">
          <button className="ghost-button" onClick={openQuickstart}>打开快速开始</button>
          <button className="ghost-button" onClick={copyDiagnosticsSummary}>复制诊断摘要</button>
          <button className="ghost-button" onClick={exportDiagnosticsToFile}>导出诊断文件</button>
          <button className="ghost-button" onClick={exportDiagnosticsZip}>导出 zip 支持包</button>
          <button className="ghost-button" onClick={openExportBundleDir}>打开导出目录</button>
          <button className="ghost-button" onClick={openExportZip}>打开 zip 支持包</button>
          <button className="ghost-button" onClick={clearExportHistory}>清空支持包历史</button>
          <button className="ghost-button" onClick={openProvidersDoc}>打开 Provider 文档</button>
          <button className="ghost-button" onClick={openStreamingDoc}>打开 Streaming 文档</button>
        </div>

        {exportSummary ? (
          <section className="export-card compact-export-card">
            <div className="export-card-head">
              <div>
                <span className="snapshot-label">最近支持包</span>
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
              <div><dt>支持包</dt><dd>{exportAvailability.label}</dd></div>
              <div><dt>zip</dt><dd>{lastExportBundle?.zipPath ? exportSummary.zipName : "未导出"}</dd></div>
              <div><dt>说明</dt><dd>{exportSummary.readmeName}</dd></div>
              <div><dt>摘要</dt><dd>{exportSummary.summaryName}</dd></div>
              <div><dt>清单</dt><dd>{exportSummary.manifestName}</dd></div>
            </dl>
            {exportAvailability.state !== "ready" && exportAvailability.detail ? (
              <p className="export-subtle">{exportAvailability.detail}</p>
            ) : null}
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
                  <strong>最近支持包历史</strong>
                </div>
                <div className="export-history-list">
                  {exportHistory.slice(0, 3).map((bundle) => {
                    const availability = describeSupportBundleAvailability(bundle);
                    return (
                      <div
                        key={bundle.bundleName}
                        className={bundle.bundleName === lastExportBundle?.bundleName ? "history-row active" : "history-row"}
                      >
                        <button
                          className={`${bundle.bundleName === lastExportBundle?.bundleName ? "history-chip active" : "history-chip"}${availability.state === "missing" ? " missing" : ""}`}
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
            <p className="export-hint">这里显示最近一次可分享支持包，优先发 zip 即可。</p>
            <p className="export-hint">“清空支持包历史”只会清空界面记录，不会删除已经导出的文件。</p>
          </section>
        ) : null}

        {statusDetail ? <pre className="status-detail">{statusDetail}</pre> : null}
      </section>
    </>
  );
}
