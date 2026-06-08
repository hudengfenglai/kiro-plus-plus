import type {
  AppState,
  DiagnosticsLogSnapshot,
  LaunchAttempt,
  ProviderModel,
  RequestLogEntry
} from "../../shared/types";
import type { ConsoleFocus, WorkbenchTab } from "./app-types";

export function describeError(error: unknown) {
  if (error instanceof Error) {
    return {
      summary: error.message,
      detail: error.stack ?? error.message
    };
  }
  return {
    summary: String(error),
    detail: String(error)
  };
}

export function nowIso() {
  return new Date().toISOString();
}

export function formatTime(value?: null | string) {
  if (!value) return "暂无";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function basename(value?: null | string) {
  if (!value) return "暂无";
  const parts = value.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) ?? value;
}

export function describeLaunchStep(step?: null | string) {
  switch (step) {
    case "detect-kiro":
      return "检测 Kiro";
    case "start-proxy":
      return "启动代理";
    case "apply-routing":
      return "应用路由";
    case "launch-kiro":
      return "拉起 Kiro";
    default:
      return step ?? "暂无";
  }
}

export function describeLaunchStatus(attempt: LaunchAttempt | null) {
  if (!attempt) {
    return {
      title: "尚未通过 Kiro++ 启动 Kiro",
      tone: "info" as const
    };
  }
  if (attempt.status === "success") {
    return {
      title: "最近一次启动成功",
      tone: "success" as const
    };
  }
  if (attempt.status === "error") {
    return {
      title: "最近一次启动失败",
      tone: "error" as const
    };
  }
  return {
    title: "最近一次启动进行中",
    tone: "info" as const
  };
}

export function describeBootstrapStep(step?: null | string) {
  switch (step) {
    case "bootstrap-disabled":
      return "未启用预热";
    case "bootstrap-start":
      return "开始预热";
    case "apply-routing":
      return "应用路由";
    case "bootstrap-ready":
      return "已就绪";
    case "bootstrap-failed":
      return "预热失败";
    default:
      return step ?? "暂无";
  }
}

export function describeBootstrapStatus(attempt: LaunchAttempt | null) {
  if (!attempt) {
    return {
      title: "暂无启动预热记录",
      tone: "info" as const
    };
  }
  if (attempt.status === "success") {
    return {
      title: "最近一次启动预热成功",
      tone: "success" as const
    };
  }
  if (attempt.status === "error") {
    return {
      title: "最近一次启动预热失败",
      tone: "error" as const
    };
  }
  if (attempt.status === "skipped") {
    return {
      title: "最近一次启动预热已跳过",
      tone: "info" as const
    };
  }
  return {
    title: "最近一次启动预热进行中",
    tone: "info" as const
  };
}

export function summarizeLog(entry: DiagnosticsLogSnapshot | RequestLogEntry | null) {
  if (!entry) {
    return {
      title: "暂无记录",
      body: "还没有可展示的请求。"
    };
  }

  return {
    title: `${entry.operation || "未知操作"} / ${entry.status}`,
    body: `requestId ${entry.requestId ?? "-"} · ${formatTime(entry.at)}`
  };
}

export function collectUnavailableReasons(actions: Record<string, { enabled: boolean; reason: string | null }>) {
  return Array.from(
    new Set(
      Object.values(actions)
        .filter((item) => !item.enabled && item.reason)
        .map((item) => item.reason as string)
    )
  );
}

export function buildModelsText(models: ProviderModel[]) {
  return models.map((model) => model.id).join("\n");
}

export function parseModelsText(text: string, previous: ProviderModel[]) {
  const previousMap = new Map(previous.map((model) => [model.id, model]));
  const modelIds = text
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  return modelIds.map((modelId) => {
    const existing = previousMap.get(modelId);
    if (existing) return existing;
    return {
      id: modelId,
      name: modelId,
      description: "BYOK routed model",
      note: ""
    };
  });
}

export function deriveFocusMeta(focus: ConsoleFocus): { status: string; workbench: WorkbenchTab } {
  switch (focus) {
    case "providers":
      return {
        status: "先把 Provider 存好，再测试一次最小请求。",
        workbench: "output"
      };
    case "kiro":
      return {
        status: "先确认代理运行，再应用 BYOK 和诊断。",
        workbench: "diagnostics"
      };
    case "logs":
      return {
        status: "先看失败请求，再复制诊断摘要。",
        workbench: "logs"
      };
    case "playground":
      return {
        status: "右栏会直接给你一条真实模型验证结果。",
        workbench: "output"
      };
    default:
      return {
        status: "从左侧配置开始，按步骤推进到 Kiro 验证。",
        workbench: "output"
      };
  }
}

export function pickRecommendedFocus(state: AppState): ConsoleFocus {
  const recommendation = state.bootstrap.recommendedTab;
  if (recommendation === "status") return "status";
  if (recommendation === "providers") return "providers";
  if (recommendation === "kiro") return "kiro";
  if (recommendation === "logs") return "logs";
  if (recommendation === "playground") return "playground";
  return "status";
}
