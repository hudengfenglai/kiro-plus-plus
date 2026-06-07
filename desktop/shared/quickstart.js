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
