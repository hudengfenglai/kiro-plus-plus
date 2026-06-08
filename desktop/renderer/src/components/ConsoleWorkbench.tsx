import type { ComponentProps } from "react";
import type { ConsoleFocus } from "../app-types";
import { ConsoleHeader } from "./ConsoleHeader";
import { ControlRail } from "./ControlRail";
import { SetupWorkspace } from "./SetupWorkspace";
import { StatusOverviewPanel } from "./StatusOverviewPanel";
import { ValidationRail } from "./ValidationRail";
import { WorkbenchPanel } from "./WorkbenchPanel";
import { WorkspaceHero } from "./WorkspaceHero";

export type ConsoleWorkbenchProps = {
  header: ComponentProps<typeof ConsoleHeader>;
  leftRail: ComponentProps<typeof ControlRail>;
  center: {
    focus: ConsoleFocus;
    hero: ComponentProps<typeof WorkspaceHero>;
    setup: ComponentProps<typeof SetupWorkspace>;
    statusOverview: ComponentProps<typeof StatusOverviewPanel>;
    workbench: ComponentProps<typeof WorkbenchPanel>;
  };
  rightRail: {
    focus: ConsoleFocus;
    validation: ComponentProps<typeof ValidationRail>;
  };
};

export function ConsoleWorkbench({
  header,
  leftRail,
  center,
  rightRail
}: ConsoleWorkbenchProps) {
  return (
    <div className="workbench-shell">
      <ConsoleHeader {...header} />

      <main className="workbench-grid">
        <ControlRail {...leftRail} />

        <section className={`workspace ${center.focus === "status" || center.focus === "logs" ? "focused" : ""}`}>
          <WorkspaceHero {...center.hero} />
          <SetupWorkspace {...center.setup} />
          <StatusOverviewPanel {...center.statusOverview} />
          <WorkbenchPanel {...center.workbench} />
        </section>

        <aside className={`rail right ${rightRail.focus === "playground" || rightRail.focus === "logs" ? "focused" : ""}`}>
          <ValidationRail {...rightRail.validation} />
        </aside>
      </main>
    </div>
  );
}
