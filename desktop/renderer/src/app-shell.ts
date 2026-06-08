import type { AppState } from "../../shared/types";
import type { ActionEntry, ResourceKey } from "./app-types";
import { nowIso } from "./app-utils";

export const proxyStateLabels: Record<AppState["proxyStatus"]["state"], string> = {
  stopped: "未启动",
  starting: "启动中",
  running: "运行中",
  error: "异常"
};

export const resourceLinks: Array<{ key: ResourceKey; title: string; body: string }> = [
  {
    key: "quickstart",
    title: "快速开始",
    body: "安装版的最短上手路径、启动预热和支持包说明。"
  },
  {
    key: "readme",
    title: "README",
    body: "安装、运行方式、支持边界和最短接入路径。"
  },
  {
    key: "providers",
    title: "Provider 文档",
    body: "国内 Provider 的 Base URL、模型名和示例。"
  },
  {
    key: "streaming",
    title: "Streaming / Kiro 说明",
    body: "Kiro 兼容 event-stream 与协议映射记录。"
  },
  {
    key: "plan",
    title: "项目计划",
    body: "当前 backlog、阶段目标和公开发布准备记录。"
  }
];

export function requireDesktopApi() {
  if (window.kiroPlusApp) {
    return new Proxy(window.kiroPlusApp, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === "function") {
          return value.bind(target);
        }
        if (value !== undefined) {
          return value;
        }
        throw new Error(`当前安装包缺少桌面桥接方法：${String(prop)}。请重新安装最新版 Kiro++ Console。`);
      }
    });
  }
  throw new Error("桌面桥接不可用。请安装最新版 Kiro++ 后重新启动应用。");
}

export async function writeClipboardText(text: string) {
  const api = window.kiroPlusApp;
  if (api?.copyText) {
    await api.copyText(text);
    return;
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  throw new Error("当前环境不支持复制到剪贴板。请升级最新版 Kiro++ Console。");
}

export function makeActionEntry(title: string, detail: string, tone: ActionEntry["tone"]): ActionEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    title,
    detail,
    tone,
    at: nowIso()
  };
}
