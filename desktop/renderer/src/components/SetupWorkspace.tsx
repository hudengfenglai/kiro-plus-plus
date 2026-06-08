import type { QuickstartItem, QuickstartSummary, SetupWorkspaceSummary } from "../../../shared/quickstart";
import type { BootstrapStep } from "../../../shared/types";

type Props = {
  quickstartSummary: QuickstartSummary;
  setupWorkspaceSummary: SetupWorkspaceSummary;
  quickstartChecklist: QuickstartItem[];
  bootstrapSteps: BootstrapStep[];
  openQuickstart: () => void;
  handleQuickstartAction: (item: QuickstartItem) => void | Promise<unknown>;
  handleSetupSummaryAction: (item: SetupWorkspaceSummary["items"][number]) => void | Promise<unknown>;
};

export function SetupWorkspace({
  quickstartSummary,
  setupWorkspaceSummary,
  quickstartChecklist,
  bootstrapSteps,
  openQuickstart,
  handleQuickstartAction,
  handleSetupSummaryAction
}: Props) {
  if (quickstartSummary.showSetupWorkspace) {
    return (
      <section className="workspace-card setup-workspace-card">
        <div className="card-head">
          <div>
            <span className="panel-tag">Setup</span>
            <h3>先完成这几步，再进入常规工作台</h3>
          </div>
          <button className="ghost-button compact-button" onClick={openQuickstart}>打开完整指南</button>
        </div>
        <section className="setup-summary-card">
          <div className="setup-summary-head">
            <div>
              <span className="panel-tag">Blockers</span>
              <strong>{setupWorkspaceSummary.title}</strong>
            </div>
            <span className="tiny-meta">{setupWorkspaceSummary.blockerCount} 项</span>
          </div>
          <p className="setup-summary-detail">{setupWorkspaceSummary.detail}</p>
          <div className="setup-summary-list">
            {setupWorkspaceSummary.items.map((item) => (
              <article key={`${item.source}-${item.id}`} className="setup-summary-item">
                <div className="setup-summary-copy">
                  <span>{item.source === "readiness" ? "运行时阻塞" : "接入步骤"}</span>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
                <button className="ghost-button compact-button" onClick={() => void handleSetupSummaryAction(item)}>
                  {item.actionLabel}
                </button>
              </article>
            ))}
          </div>
        </section>
        <div className="setup-workspace-grid">
          {quickstartChecklist.map((item, index) => (
            <div key={item.id} className={`quickstart-inline-item ${item.done ? "done" : ""} ${item.current ? "current" : ""}`}>
              <span className="quickstart-item-index">{String(index + 1).padStart(2, "0")}</span>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
              <button className="ghost-button compact-button" onClick={() => void handleQuickstartAction(item)}>
                {item.actionLabel}
              </button>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="step-strip">
        {bootstrapSteps.map((step, index) => (
          <article key={step.key} className={`step-tile ${step.done ? "done" : ""}`}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{step.title}</strong>
            <p>{step.detail}</p>
          </article>
        ))}
      </section>

      <section className="workspace-card quickstart-inline-card">
        <div className="card-head">
          <div>
            <span className="panel-tag">Quickstart</span>
            <h3>首次接入建议顺序</h3>
          </div>
          <button className="ghost-button compact-button" onClick={openQuickstart}>打开完整指南</button>
        </div>
        <div className="quickstart-inline-grid">
          {quickstartChecklist.map((item, index) => (
            <div key={item.id} className={`quickstart-inline-item ${item.done ? "done" : ""} ${item.current ? "current" : ""}`}>
              <span className="quickstart-item-index">{String(index + 1).padStart(2, "0")}</span>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
              <button className="ghost-button compact-button" onClick={() => void handleQuickstartAction(item)}>
                {item.actionLabel}
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
