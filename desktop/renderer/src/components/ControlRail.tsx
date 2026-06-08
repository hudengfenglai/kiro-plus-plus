import type {
  KiroActionAvailability,
  ProviderActionAvailability,
  ProviderDraftStatus,
  QuickstartSummary
} from "../../../shared/quickstart";
import type { AppState, ProviderModel, ProviderProfile } from "../../../shared/types";

type Props = {
  focus: "status" | "providers" | "kiro" | "logs" | "playground";
  selectedProvider: ProviderProfile | null;
  selectedProviderModels: ProviderModel[];
  providerOptions: Array<{ id: string; label: string }>;
  presetId: string;
  setPresetId: (value: string) => void;
  applyPresetToDraft: () => void;
  requestReplaceProviderDraft: (action: { kind: "switch-provider"; providerId: string }) => void;
  updateProviderDraft: (next: ProviderProfile) => void;
  apiKey: string;
  setApiKey: (value: string) => void;
  modelsText: string;
  setModelsText: (value: string) => void;
  providerDraftStatus: ProviderDraftStatus;
  providerActionAvailability: ProviderActionAvailability;
  providerActionHints: string[];
  handleFetchModels: () => void | Promise<unknown>;
  handleTestProvider: () => void | Promise<unknown>;
  handleSaveProvider: () => void | Promise<unknown>;
  state: AppState;
  proxyStateLabel: string;
  quickstartSummary: QuickstartSummary;
  kiroActionAvailability: KiroActionAvailability;
  kiroActionHints: string[];
  handleToggleAutoApplyOnLaunch: () => void | Promise<unknown>;
  startProxy: () => void | Promise<unknown>;
  restartProxy: () => void | Promise<unknown>;
  applyRouting: () => void | Promise<unknown>;
  toggleByok: () => void | Promise<unknown>;
  runDiagnose: () => void | Promise<unknown>;
  stopProxy: () => void | Promise<unknown>;
  restoreKiro: () => void | Promise<unknown>;
};

export function ControlRail({
  focus,
  selectedProvider,
  selectedProviderModels,
  providerOptions,
  presetId,
  setPresetId,
  applyPresetToDraft,
  requestReplaceProviderDraft,
  updateProviderDraft,
  apiKey,
  setApiKey,
  modelsText,
  setModelsText,
  providerDraftStatus,
  providerActionAvailability,
  providerActionHints,
  handleFetchModels,
  handleTestProvider,
  handleSaveProvider,
  state,
  proxyStateLabel,
  quickstartSummary,
  kiroActionAvailability,
  kiroActionHints,
  handleToggleAutoApplyOnLaunch,
  startProxy,
  restartProxy,
  applyRouting,
  toggleByok,
  runDiagnose,
  stopProxy,
  restoreKiro
}: Props) {
  return (
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
                onClick={() => void handleFetchModels()}
              >
                拉取模型
              </button>
              <button
                className="ghost-button"
                disabled={!providerActionAvailability.testProvider.enabled}
                title={providerActionAvailability.testProvider.reason ?? undefined}
                onClick={() => void handleTestProvider()}
              >
                测试 Provider
              </button>
              <button onClick={() => void handleSaveProvider()}>保存配置</button>
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
          <span className={`state-pill ${state.proxyStatus.state}`}>{proxyStateLabel}</span>
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
            onClick={() => void handleToggleAutoApplyOnLaunch()}
          >
            {state.settings.kiro.autoApplyOnLaunch ? "关闭启动时自动应用" : "启用启动时自动应用"}
          </button>
          <button
            className={quickstartSummary.showSetupWorkspace ? "" : "ghost-button"}
            disabled={!kiroActionAvailability.startProxy.enabled}
            title={kiroActionAvailability.startProxy.reason ?? undefined}
            onClick={() => void startProxy()}
          >
            启动代理
          </button>
          <button
            className="ghost-button"
            disabled={!kiroActionAvailability.restartProxy.enabled}
            title={kiroActionAvailability.restartProxy.reason ?? undefined}
            onClick={() => void restartProxy()}
          >
            重启代理
          </button>
          <button
            className={quickstartSummary.showSetupWorkspace ? "" : "ghost-button"}
            disabled={!kiroActionAvailability.applyRouting.enabled}
            title={kiroActionAvailability.applyRouting.reason ?? undefined}
            onClick={() => void applyRouting()}
          >
            应用到 Kiro
          </button>
          <button
            className={quickstartSummary.showSetupWorkspace ? "" : "ghost-button"}
            disabled={!kiroActionAvailability.toggleByok.enabled}
            title={kiroActionAvailability.toggleByok.reason ?? undefined}
            onClick={() => void toggleByok()}
          >
            {state.settings.isByokEnabled ? "关闭 BYOK" : "启用 BYOK"}
          </button>
          <button
            className={quickstartSummary.showSetupWorkspace ? "" : "ghost-button"}
            disabled={!kiroActionAvailability.diagnose.enabled}
            title={kiroActionAvailability.diagnose.reason ?? undefined}
            onClick={() => void runDiagnose()}
          >
            运行诊断
          </button>
          {!quickstartSummary.showSetupWorkspace ? (
            <>
              <button
                className="ghost-button"
                disabled={!kiroActionAvailability.stopProxy.enabled}
                title={kiroActionAvailability.stopProxy.reason ?? undefined}
                onClick={() => void stopProxy()}
              >
                停止代理
              </button>
              <button
                className="ghost-button"
                disabled={!kiroActionAvailability.restore.enabled}
                title={kiroActionAvailability.restore.reason ?? undefined}
                onClick={() => void restoreKiro()}
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
  );
}
