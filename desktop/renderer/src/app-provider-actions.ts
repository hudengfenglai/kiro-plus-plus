import { buildProviderProfileFromPreset } from "../../shared/provider-presets";
import {
  shouldPromptBeforeReplacingProviderDraft,
  type ProviderDraftStatus
} from "../../shared/quickstart";
import type { PlaygroundResult, ProviderProfile } from "../../shared/types";
import type {
  ConsoleFocus,
  PendingProviderReplaceAction,
  RunAction
} from "./app-types";
import { buildModelsText, nowIso } from "./app-utils";

type CreateProviderActionsArgs = {
  runAction: RunAction;
  requireDesktopApi: () => Window["kiroPlusApp"];
  presetId: string;
  stateProviders: ProviderProfile[];
  selectedProvider: ProviderProfile | null;
  selectedProviderModels: Array<{ id: string; name: string; description?: string; note?: string }>;
  providerDraftStatus: ProviderDraftStatus;
  apiKey: string;
  playgroundPrompt: string;
  playgroundLockedByHistory: boolean;
  providerForPlayground: ProviderProfile | null;
  playgroundModelId: string;
  setProviderDraft: (value: ProviderProfile | null) => void;
  setPresetId: (value: string) => void;
  setModelsText: (value: string) => void;
  setApiKey: (value: string) => void;
  setPlaygroundProviderId: (value: string) => void;
  setPlaygroundModelId: (value: string) => void;
  setPlaygroundResult: (value: (PlaygroundResult & { requestedAt: string }) | null) => void;
  setPendingProviderReplaceAction: (value: PendingProviderReplaceAction) => void;
  setFocus: (value: ConsoleFocus) => void;
  pushOutput: (title: string, detail: string, tone: "info" | "success" | "error") => void;
  openConsole: (targetFocus: ConsoleFocus) => void;
  ensureLiveSupportBundleContext: (reason: string) => Promise<boolean>;
};

export function createProviderActions({
  runAction,
  requireDesktopApi,
  presetId,
  stateProviders,
  selectedProvider,
  selectedProviderModels,
  providerDraftStatus,
  apiKey,
  playgroundPrompt,
  playgroundLockedByHistory,
  providerForPlayground,
  playgroundModelId,
  setProviderDraft,
  setPresetId,
  setModelsText,
  setApiKey,
  setPlaygroundProviderId,
  setPlaygroundModelId,
  setPlaygroundResult,
  setPendingProviderReplaceAction,
  setFocus,
  pushOutput,
  openConsole,
  ensureLiveSupportBundleContext
}: CreateProviderActionsArgs) {
  function updateProviderDraft(next: ProviderProfile) {
    setProviderDraft(next);
    setModelsText(buildModelsText(next.models));
  }

  function replaceProviderDraft(next: ProviderProfile | null) {
    setProviderDraft(next);
    setPresetId(next?.providerPresetId ?? "deepseek");
    setModelsText(buildModelsText(next?.models ?? []));
    setApiKey("");
    setPlaygroundProviderId(next?.id ?? "");
    setPlaygroundModelId(next?.defaultModel ?? "");
    setFocus("providers");
  }

  function executePendingProviderReplaceAction(action: Exclude<PendingProviderReplaceAction, null>) {
    if (action.kind === "apply-preset") {
      replaceProviderDraft(buildProviderProfileFromPreset(presetId));
      return;
    }
    const next = stateProviders.find((provider) => provider.id === action.providerId) ?? null;
    replaceProviderDraft(next);
  }

  function requestReplaceProviderDraft(action: Exclude<PendingProviderReplaceAction, null>) {
    if (!shouldPromptBeforeReplacingProviderDraft(providerDraftStatus)) {
      executePendingProviderReplaceAction(action);
      return;
    }
    setPendingProviderReplaceAction(action);
  }

  function applyPresetToDraft() {
    requestReplaceProviderDraft({ kind: "apply-preset" });
  }

  function confirmPendingProviderReplaceAction(pendingProviderReplaceAction: PendingProviderReplaceAction) {
    if (!pendingProviderReplaceAction) {
      return;
    }
    executePendingProviderReplaceAction(pendingProviderReplaceAction);
    setPendingProviderReplaceAction(null);
  }

  function cancelPendingProviderReplaceAction() {
    setPendingProviderReplaceAction(null);
  }

  async function handleSaveProvider() {
    if (!selectedProvider) return;
    const normalizedModels = selectedProviderModels;
    const normalizedDefaultModel = normalizedModels.find((model) => model.id === selectedProvider.defaultModel)?.id
      ?? normalizedModels[0]?.id
      ?? selectedProvider.defaultModel;

    await runAction(
      () =>
        requireDesktopApi().saveProvider({
          profile: {
            ...selectedProvider,
            models: normalizedModels,
            defaultModel: normalizedDefaultModel
          },
          apiKey: apiKey.trim() || undefined
        }),
      {
        pending: "正在保存 Provider 配置...",
        success: "Provider 配置已保存。",
        afterFocus: "providers"
      }
    );
    setApiKey("");
  }

  async function handleFetchModels() {
    if (!selectedProvider) return;
    const result = await runAction(
      () => requireDesktopApi().fetchModels({ profile: selectedProvider, apiKey: apiKey.trim() || undefined }),
      {
        pending: "正在拉取远程模型列表...",
        success: "模型列表已刷新。",
        afterFocus: "providers"
      }
    );

    const items = (result as Array<{ id: string; name?: string }>)
      .filter((item) => item?.id)
      .map((item) => ({
        id: item.id,
        name: item.name ?? item.id,
        description: "BYOK routed model",
        note: ""
      }));

    if (items.length > 0) {
      updateProviderDraft({
        ...selectedProvider,
        models: items,
        defaultModel: items.find((item) => item.id === selectedProvider.defaultModel)?.id ?? items[0].id
      });
      pushOutput("已同步模型草稿", `当前草稿包含 ${items.length} 个模型。`, "info");
    }
  }

  async function handleTestProvider() {
    if (!selectedProvider) return;
    const result = await runAction(
      () =>
        requireDesktopApi().testProvider({
          profile: selectedProvider,
          apiKey: apiKey.trim() || undefined,
          modelId: selectedProvider.defaultModel,
          prompt: playgroundPrompt
        }),
      {
        pending: "正在测试 Provider 连通性...",
        success: "Provider 测试成功。",
        afterFocus: "playground"
      }
    );
    setPlaygroundResult({
      ...(result as PlaygroundResult),
      requestedAt: nowIso()
    });
  }

  async function handlePlaygroundSend() {
    if (playgroundLockedByHistory) {
      const ready = await ensureLiveSupportBundleContext("返回实时验证区");
      if (!ready) {
        return;
      }
      openConsole("playground");
      return;
    }
    if (!providerForPlayground || !playgroundModelId.trim()) return;
    const result = await runAction(
      () =>
        requireDesktopApi().sendPlayground({
          providerId: providerForPlayground.id,
          modelId: playgroundModelId.trim(),
          prompt: playgroundPrompt
        }),
      {
        pending: "正在发送模型验证请求...",
        success: "模型验证完成。",
        afterFocus: "playground"
      }
    );
    setPlaygroundResult({
      ...(result as PlaygroundResult),
      requestedAt: nowIso()
    });
  }

  return {
    updateProviderDraft,
    requestReplaceProviderDraft,
    applyPresetToDraft,
    confirmPendingProviderReplaceAction,
    cancelPendingProviderReplaceAction,
    handleSaveProvider,
    handleFetchModels,
    handleTestProvider,
    handlePlaygroundSend
  };
}
