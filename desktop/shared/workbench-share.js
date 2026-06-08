function fallbackOperation(operation) {
  return operation || "未知操作";
}

function fallbackBundleName(bundleName) {
  return bundleName || "未知支持包";
}

function formatBundleSourceLabel(kind, bundleName) {
  if (kind === "bundle") {
    return `历史支持包（${fallbackBundleName(bundleName)}）`;
  }
  return "当前实时日志";
}

function formatDiagnosticsSourceLabel(kind, bundleName) {
  if (kind === "bundle") {
    return `历史支持包（${fallbackBundleName(bundleName)}）`;
  }
  return "当前实时诊断";
}

export function buildLogShareText(entry, kind) {
  if (!entry) {
    return kind === "failure"
      ? "最近失败：暂无记录"
      : "最近成功：暂无记录";
  }

  return [
    `${kind === "failure" ? "最近失败" : "最近成功"}：${fallbackOperation(entry.operation)} / HTTP ${entry.status}`,
    `请求 ID：${entry.requestId ?? "-"}`,
    `时间：${entry.at ?? "-"}`,
    `耗时：${entry.durationMs ?? "-"} ms`,
    `请求体大小：${entry.bodyBytes ?? "-"} bytes`
  ].join("\n");
}

export function buildSupportSnapshotText({
  bundleName,
  headline,
  recommendedAction,
  latestFailure,
  latestSuccess,
  viewingHistoricalBundle
}) {
  return [
    `支持快照：${bundleName}`,
    viewingHistoricalBundle ? "模式：历史支持包快照" : "模式：当前支持包",
    headline ? `首屏摘要：${headline}` : null,
    recommendedAction
      ? `推荐下一步：${recommendedAction.title} -> ${recommendedAction.actionLabel}`
      : null,
    recommendedAction?.detail ? `说明：${recommendedAction.detail}` : null,
    buildLogShareText(latestFailure ?? null, "failure"),
    buildLogShareText(latestSuccess ?? null, "success")
  ].filter(Boolean).join("\n");
}

export function buildOutputTimelineText(entries = []) {
  if (!entries.length) {
    return [
      "Kiro++ 当前会话输出",
      "记录数：0",
      "当前桌面会话还没有记录任何动作。"
    ].join("\n");
  }

  return [
    "Kiro++ 当前会话输出",
    `记录数：${entries.length}`,
    ...entries.map((entry, index) =>
      [
        `#${index + 1} [${entry.tone}] ${entry.title}`,
        `时间：${entry.at}`,
        entry.detail
      ].join("\n")
    )
  ].join("\n\n");
}

export function buildOutputShareText({
  entries,
  viewingHistoricalBundle,
  currentBundleName,
  selectedProviderLabel,
  proxyEndpoint,
  proxyState,
  isByokEnabled
}) {
  return [
    "Kiro++ 会话分享",
    `模式：${viewingHistoricalBundle ? "历史支持包快照" : "当前实时会话"}`,
    `Provider：${selectedProviderLabel}`,
    `BYOK：${isByokEnabled ? "已启用" : "未启用"}`,
    `代理：${proxyState}${proxyEndpoint ? `（${proxyEndpoint}）` : ""}`,
    currentBundleName ? `支持包：${currentBundleName}` : null,
    "",
    buildOutputTimelineText(entries)
  ].filter(Boolean).join("\n");
}

export function buildWorkbenchShareText({
  bundleName,
  recentLogsSource,
  diagnosticsSummarySource,
  diagnosticsSummary,
  outputShareText,
  outputCount,
  outputSessionStartedAt,
  latestFailure,
  latestSuccess
}) {
  return [
    "Kiro++ 工作台分享",
    bundleName ? `当前支持包：${bundleName}` : "当前支持包：无",
    `日志来源：${formatBundleSourceLabel(recentLogsSource.kind, recentLogsSource.bundleName)}`,
    `诊断来源：${formatDiagnosticsSourceLabel(diagnosticsSummarySource.kind, diagnosticsSummarySource.bundleName)}`,
    outputCount > 0
      ? `输出会话：共 ${outputCount} 条，自 ${outputSessionStartedAt ?? "-"} 开始`
      : "输出会话：当前桌面会话还没有动作记录",
    "",
    buildLogShareText(latestFailure, "failure"),
    "",
    buildLogShareText(latestSuccess, "success"),
    "",
    "诊断摘要：",
    diagnosticsSummary || "暂无诊断摘要",
    "",
    outputShareText
  ].join("\n");
}

export function buildWorkbenchShareMarkdown({
  bundleName,
  recentLogsSource,
  diagnosticsSummarySource,
  diagnosticsSummary,
  outputShareText,
  outputCount,
  outputSessionStartedAt,
  latestFailure,
  latestSuccess,
  exportedAt
}) {
  const text = buildWorkbenchShareText({
    bundleName,
    recentLogsSource,
    diagnosticsSummarySource,
    diagnosticsSummary,
    outputShareText,
    outputCount,
    outputSessionStartedAt,
    latestFailure,
    latestSuccess
  });

  return [
    "# Kiro++ Workbench Snapshot",
    "",
    `- 导出时间：${exportedAt}`,
    `- 当前支持包：${bundleName ?? "无"}`,
    `- 日志来源：${formatBundleSourceLabel(recentLogsSource.kind, recentLogsSource.bundleName)}`,
    `- 诊断来源：${formatDiagnosticsSourceLabel(diagnosticsSummarySource.kind, diagnosticsSummarySource.bundleName)}`,
    outputCount > 0
      ? `- 输出会话：共 ${outputCount} 条，自 ${outputSessionStartedAt ?? "-"} 开始`
      : "- 输出会话：当前桌面会话还没有动作记录",
    "",
    "```text",
    text,
    "```"
  ].join("\n");
}
