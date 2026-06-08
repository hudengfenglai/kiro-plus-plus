const MISSING_PATH_LABELS = {
  bundleDir: "支持包目录",
  readmePath: "说明文件",
  summaryPath: "摘要文件",
  jsonPath: "快照文件",
  requestsPath: "请求文件",
  manifestPath: "清单文件",
  zipPath: "压缩包"
};

export function formatMissingPathLabels(missingPaths = []) {
  if (!Array.isArray(missingPaths) || missingPaths.length === 0) {
    return [];
  }
  return missingPaths.map((key) => MISSING_PATH_LABELS[key] ?? key);
}

export function describeSupportBundleAvailability(bundle) {
  if (!bundle) {
    return {
      state: "unknown",
      label: "暂无",
      detail: ""
    };
  }

  if (bundle.exists === false) {
    const labels = formatMissingPathLabels(bundle.missingPaths);
    return {
      state: "missing",
      label: "主体缺失",
      detail: labels.length ? `缺少 ${labels.join("、")}` : "支持包主体文件不完整"
    };
  }

  if (bundle.zipPath && bundle.zipExists === false) {
    return {
      state: "zip-missing",
      label: "zip 缺失",
      detail: "支持包主体仍可用，但压缩包文件已不存在"
    };
  }

  return {
    state: "ready",
    label: "可用",
    detail: bundle.zipPath ? "主体和压缩包都可用" : "支持包主体可用"
  };
}
