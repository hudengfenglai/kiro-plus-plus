import { access } from "node:fs/promises";
import { dirname, join } from "node:path";

function uniquePaths(items) {
  return [...new Set(items.filter(Boolean))];
}

function buildDocsDirs(appPath, cwd) {
  const appParent = dirname(appPath);
  const appGrandParent = dirname(appParent);
  return uniquePaths([
    join(appPath, "docs"),
    join(appParent, "docs"),
    join(appGrandParent, "docs"),
    join(cwd, "docs")
  ]);
}

export function buildResourceCandidates({
  resourceId,
  appPath,
  cwd
}) {
  const docsDirs = buildDocsDirs(appPath, cwd);
  const resources = {
    quickstart: [
      ...docsDirs.map((dir) => join(dir, "desktop-quickstart.md"))
    ],
    readme: [
      ...docsDirs.map((dir) => join(dir, "README.md")),
      join(cwd, "README.md")
    ],
    providers: [
      ...docsDirs.map((dir) => join(dir, "domestic-providers.md"))
    ],
    streaming: [
      ...docsDirs.map((dir) => join(dir, "streaming-chat.md"))
    ],
    plan: [
      ...docsDirs.map((dir) => join(dir, "project-kiro-plus-plus.md")),
      join(cwd, "planning", "project-kiro-plus-plus.md")
    ]
  };
  return resources[resourceId] ?? null;
}

export async function resolveResourcePath(resourceId, {
  pathExists = async (target) => {
    try {
      await access(target);
      return true;
    } catch {
      return false;
    }
  },
  appPath,
  cwd
} = {}) {
  const candidates = buildResourceCandidates({ resourceId, appPath, cwd });
  if (!candidates) {
    throw new Error(`Unknown resource: ${resourceId}`);
  }
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Resource is unavailable: ${resourceId}`);
}
