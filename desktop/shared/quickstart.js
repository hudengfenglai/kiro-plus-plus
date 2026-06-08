function getSelectedProvider(state) {
  return state.settings.providers.find((provider) => provider.id === state.settings.selectedProviderId)
    ?? state.settings.providers[0]
    ?? null;
}

function hasConfiguredProvider(state) {
  const provider = getSelectedProvider(state);
  if (!provider) return false;
  if (!provider.id.trim() || !provider.baseUrl.trim() || !provider.defaultModel.trim()) return false;
  return provider.models.some((model) => model.id === provider.defaultModel);
}

function hasProviderModels(state) {
  const provider = getSelectedProvider(state);
  return Boolean(provider && provider.models.length > 0);
}

function hasProviderTest(state) {
  return Boolean(state.lastSuccessfulProviderTest?.modelId);
}

function hasProxyAndByok(state) {
  return state.proxyStatus.state === "running" && state.settings.isByokEnabled;
}

function hasHealthyKiroRouting(state) {
  if (!state.kiroDetection.installed) return false;
  if (!state.diagnose) return false;
  if (state.diagnose.autoModeBlocksByok || state.diagnose.profileAutoModeBlocksByok) return false;
  if ((state.diagnose.localRegions ?? []).length === 0) return false;
  return true;
}

function hasKiroInstall(state) {
  return Boolean(state.kiroDetection.installed || state.kiroDetection.installPath);
}

function hasRecoverableBackup(state) {
  return Boolean(state.kiroDetection.lastBackup?.backupPath || state.lastAppliedKiroBackup?.backupPath);
}

function hasProviderBaseUrl(state) {
  const provider = getSelectedProvider(state);
  return Boolean(provider?.baseUrl?.trim());
}

function hasValidDefaultModel(state) {
  const provider = getSelectedProvider(state);
  if (!provider) return false;
  if (!provider.defaultModel.trim()) return false;
  return provider.models.some((model) => model.id === provider.defaultModel);
}

function normalizeProfileForDraftCompare(profile, draftModels) {
  if (!profile) return null;
  return JSON.stringify({
    id: profile.id,
    providerPresetId: profile.providerPresetId ?? null,
    type: profile.type,
    label: profile.label,
    baseUrl: profile.baseUrl,
    defaultModel: profile.defaultModel,
    models: (draftModels ?? profile.models ?? []).map((model) => ({
      id: model.id,
      name: model.name,
      description: model.description ?? "",
      note: model.note ?? ""
    }))
  });
}

function hasProviderApiKeyIssue(state) {
  return (state.readinessIssues ?? []).some((issue) => issue.key === "provider-api-key");
}

export function buildQuickstartChecklist(state) {
  const provider = getSelectedProvider(state);
  const configuredProvider = hasConfiguredProvider(state);
  const configuredModels = hasProviderModels(state);
  const providerReady = configuredProvider && configuredModels;
  const providerTested = hasProviderTest(state);
  const proxyAndByokReady = hasProxyAndByok(state);
  const kiroRoutingReady = hasHealthyKiroRouting(state);

  const items = [
    {
      id: "provider",
      title: "配置 Provider",
      detail: providerReady
        ? `当前使用 ${provider?.label ?? "Provider"}，默认模型已可用。`
        : "先选择预设、确认 Base URL，并保证 defaultModel 在 models[] 里。",
      done: providerReady,
      current: false,
      focus: "providers",
      actionLabel: providerReady ? "调整 Provider" : "去配置 Provider",
      actionKind: "open-provider"
    },
    {
      id: "models",
      title: "确认模型列表",
      detail: configuredModels
        ? `当前已识别 ${provider?.models.length ?? 0} 个模型。`
        : "拉取模型或手工补充 models[]，避免 defaultModel 指向空值。",
      done: configuredModels,
      current: false,
      focus: "providers",
      actionLabel: configuredModels ? "管理模型" : "拉取模型",
      actionKind: configuredModels ? "open-provider" : "fetch-models"
    },
    {
      id: "test",
      title: "测试 Provider",
      detail: providerTested
        ? `最近一次验证模型：${state.lastSuccessfulProviderTest?.modelId ?? "未知模型"}。`
        : "先做一次最小连通性验证，确认 Key、模型名和 Base URL 都可用。",
      done: providerTested,
      current: false,
      focus: "playground",
      actionLabel: providerTested ? "再次验证" : "去做测试",
      actionKind: "test-provider"
    },
    {
      id: "routing",
      title: "应用到 Kiro",
      detail: kiroRoutingReady
        ? "Kiro 已识别本地路由，当前可以直接启动 Kiro 继续使用。"
        : proxyAndByokReady
          ? "代理和 BYOK 已准备好，再运行一次 Diagnose 确认本地 endpoint 生效。"
          : "启动代理、启用 BYOK，再运行 Diagnose 检查本地 endpoint 是否接管。",
      done: kiroRoutingReady,
      current: false,
      focus: kiroRoutingReady ? "logs" : "kiro",
      actionLabel: kiroRoutingReady
        ? "重新诊断"
        : state.proxyStatus.state !== "running"
          ? "启动代理"
          : state.settings.isByokEnabled
            ? "应用到 Kiro"
            : "启用 BYOK",
      actionKind: kiroRoutingReady
        ? "diagnose"
        : state.proxyStatus.state !== "running"
          ? "start-proxy"
          : state.settings.isByokEnabled
            ? "apply-routing"
            : "enable-byok"
    }
  ];

  const firstPending = items.find((item) => !item.done);
  if (firstPending) {
    firstPending.current = true;
  }

  return items;
}

export function summarizeQuickstartChecklist(items) {
  const totalCount = items.length;
  const completedCount = items.filter((item) => item.done).length;
  const remainingCount = Math.max(totalCount - completedCount, 0);
  const isComplete = remainingCount === 0;
  const nextItem = items.find((item) => item.current) ?? items.find((item) => !item.done) ?? null;
  const percent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  return {
    totalCount,
    completedCount,
    remainingCount,
    isComplete,
    percent,
    nextItem,
    nextLabel: nextItem
      ? `下一步：${nextItem.title}`
      : "已完成最小接入，可以开始使用",
    modeLabel: isComplete ? "Ready" : "Setup Mode",
    launchActionLabel: isComplete ? "Launch Kiro with Kiro++" : "先完成设置",
    showSetupWorkspace: !isComplete,
    showSetupRail: !isComplete,
    bannerTitle: isComplete ? "最小接入已完成" : "继续完成首次接入",
    bannerDetail: isComplete
      ? "当前基础链路已经打通，可以继续验证模型或直接启动 Kiro。"
      : `还差 ${remainingCount} 步即可完成最小接入，建议先处理当前步骤。`
  };
}

export function buildKiroActionAvailability(state) {
  const proxyRunning = state.proxyStatus.state === "running";
  const kiroInstalled = hasKiroInstall(state);
  const hasBackup = hasRecoverableBackup(state);

  return {
    startProxy: {
      enabled: !proxyRunning && state.proxyStatus.state !== "starting",
      reason: proxyRunning ? "代理已在运行。" : null
    },
    restartProxy: {
      enabled: proxyRunning,
      reason: proxyRunning ? null : "请先启动代理。"
    },
    stopProxy: {
      enabled: proxyRunning,
      reason: proxyRunning ? null : "请先启动代理。"
    },
    applyRouting: {
      enabled: proxyRunning && kiroInstalled && state.settings.isByokEnabled,
      reason: !kiroInstalled
        ? "请先检测到 Kiro 安装。"
        : !proxyRunning
          ? "请先启动代理。"
          : !state.settings.isByokEnabled
            ? "请先启用 BYOK。"
            : null
    },
    toggleByok: {
      enabled: state.settings.isByokEnabled
        ? hasBackup
        : proxyRunning && kiroInstalled,
      reason: state.settings.isByokEnabled
        ? (hasBackup ? null : "还没有可恢复的备份。")
        : !kiroInstalled
          ? "请先检测到 Kiro 安装。"
          : !proxyRunning
            ? "请先启动代理。"
            : null
    },
    diagnose: {
      enabled: kiroInstalled,
      reason: kiroInstalled ? null : "请先检测到 Kiro 安装。"
    },
    restore: {
      enabled: hasBackup,
      reason: hasBackup ? null : "还没有可恢复的备份。"
    }
  };
}

export function buildProviderActionAvailability(state, options = {}) {
  const hasBaseUrl = hasProviderBaseUrl(state);
  const hasModels = hasProviderModels(state);
  const hasDefaultModel = hasValidDefaultModel(state);
  const hasDraftApiKey = Boolean(options.hasDraftApiKey);
  const missingApiKey = hasProviderApiKeyIssue(state) && !hasDraftApiKey;

  return {
    save: {
      enabled: true,
      reason: null
    },
    fetchModels: {
      enabled: hasBaseUrl && !missingApiKey,
      reason: !hasBaseUrl
        ? "请先填写可用的 Base URL。"
        : missingApiKey
          ? "请先保存可用的 API Key。"
          : null
    },
    testProvider: {
      enabled: hasBaseUrl && hasModels && hasDefaultModel && !missingApiKey,
      reason: !hasBaseUrl
        ? "请先填写可用的 Base URL。"
        : missingApiKey
          ? "请先保存可用的 API Key。"
        : !hasModels
          ? "请先拉取模型或补充 models[]。"
          : !hasDefaultModel
            ? "请先让 defaultModel 命中 models[]。"
            : null
    }
  };
}

export function buildProviderDraftStatus({
  savedProfile,
  draftProfile,
  draftModels,
  hasDraftApiKey = false
}) {
  const savedSnapshot = normalizeProfileForDraftCompare(savedProfile, savedProfile?.models ?? []);
  const draftSnapshot = normalizeProfileForDraftCompare(draftProfile, draftModels);
  const hasStructureChanges = savedSnapshot !== draftSnapshot;
  const hasUnsavedChanges = hasStructureChanges || Boolean(hasDraftApiKey);

  if (!hasUnsavedChanges) {
    return {
      hasUnsavedChanges: false,
      title: "当前草稿已同步",
      detail: "表单里的 Provider 配置和已保存状态一致。"
    };
  }

  if (hasDraftApiKey) {
    return {
      hasUnsavedChanges: true,
      title: "当前有未保存的草稿",
      detail: "你已经输入了新的 API Key，保存配置后会写入系统安全存储。"
    };
  }

  return {
    hasUnsavedChanges: true,
    title: "当前有未保存的草稿",
    detail: "Provider 字段或模型列表已修改，记得先点击“保存配置”。"
  };
}

export function shouldPromptBeforeReplacingProviderDraft(status) {
  return Boolean(status?.hasUnsavedChanges);
}

export function buildSetupWorkspaceSummary(state) {
  const readinessItems = (state.readinessIssues ?? []).map((issue) => ({
    id: issue.key,
    source: "readiness",
    title: issue.title,
    detail: issue.detail,
    focus: issue.focus,
    actionLabel: issue.action
  }));

  if (readinessItems.length > 0) {
    return {
      blockerCount: readinessItems.length,
      title: `当前还有 ${readinessItems.length} 个阻塞项`,
      detail: "建议先处理这些运行时阻塞，再继续下面的接入步骤。",
      items: readinessItems.slice(0, 3)
    };
  }

  const pendingQuickstartItems = buildQuickstartChecklist(state)
    .filter((item) => !item.done)
    .map((item) => ({
      id: item.id,
      source: "quickstart",
      title: item.title,
      detail: item.detail,
      focus: item.focus,
      actionLabel: item.actionLabel
    }));

  return {
    blockerCount: pendingQuickstartItems.length,
    title: pendingQuickstartItems.length > 0
      ? `还差 ${pendingQuickstartItems.length} 步完成最小接入`
      : "当前没有明显阻塞项",
    detail: pendingQuickstartItems.length > 0
      ? "建议优先处理下面这些还未完成的接入步骤。"
      : "基础接入已经完成，可以直接进入常规工作台继续验证。",
    items: pendingQuickstartItems.slice(0, 3)
  };
}
