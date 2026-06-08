export function buildAppMeta({ version, isPackaged, appPath }) {
  const normalizedVersion = typeof version === "string" && version.trim()
    ? version.trim()
    : "unknown";
  const packaged = Boolean(isPackaged);

  return {
    version: normalizedVersion,
    isPackaged: packaged,
    source: packaged ? "packaged" : "development",
    buildLabel: packaged ? "安装包" : "源码环境",
    appPath: typeof appPath === "string" ? appPath : ""
  };
}
