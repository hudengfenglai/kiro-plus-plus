import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readText(path) {
  return readFile(path, "utf8");
}

function normalizeRelativePath(path) {
  return path.split("\\").join("/");
}

function findRepoUrl(text) {
  const match = text.match(/https:\/\/github\.com\/[^\s`]+\/[^\s`]+/);
  return match?.[0] ?? null;
}

function findPlaceholders(file, text) {
  const matches = [...text.matchAll(/<([A-Z0-9_]+)>/g)];
  const allowed = new Set(["<RELEASE_DOWNLOAD_URL>", "<GITHUB_REPO_URL>"]);
  return matches.map((match) => ({
    file,
    placeholder: `<${match[1]}>`
  })).filter((item) => allowed.has(item.placeholder));
}

export async function buildReleasePrepReport({
  rootDir = process.cwd()
} = {}) {
  const packagePath = join(rootDir, "package.json");
  const readmePath = join(rootDir, "README.md");
  const linuxdoPostPath = join(rootDir, "docs", "release", "linuxdo-post.md");
  const releaseVerificationPath = join(rootDir, "docs", "release", "release-verification.md");
  const smokeChecklistPath = join(rootDir, "docs", "release", "smoke-checklist.md");

  const packageJson = await readJson(packagePath);
  const version = packageJson.version;
  const artifactPath = join(rootDir, "release", `kiro-plus-plus-${version}-x64.exe`);

  const docs = {
    readme: {
      path: normalizeRelativePath(relative(rootDir, readmePath)),
      exists: await exists(readmePath)
    },
    linuxdoPost: {
      path: normalizeRelativePath(relative(rootDir, linuxdoPostPath)),
      exists: await exists(linuxdoPostPath)
    },
    releaseVerification: {
      path: normalizeRelativePath(relative(rootDir, releaseVerificationPath)),
      exists: await exists(releaseVerificationPath)
    },
    smokeChecklist: {
      path: normalizeRelativePath(relative(rootDir, smokeChecklistPath)),
      exists: await exists(smokeChecklistPath)
    }
  };

  const artifact = {
    path: normalizeRelativePath(relative(rootDir, artifactPath)),
    exists: await exists(artifactPath)
  };

  let repoUrl = null;
  let placeholders = [];

  if (docs.linuxdoPost.exists) {
    const linuxdoText = await readText(linuxdoPostPath);
    repoUrl = findRepoUrl(linuxdoText);
    placeholders = findPlaceholders(docs.linuxdoPost.path, linuxdoText);
  }

  const nextActions = [];

  if (!artifact.exists) {
    nextActions.push("先运行 npm run desktop:package 生成安装包。");
  }

  if (!docs.readme.exists || !docs.releaseVerification.exists || !docs.smokeChecklist.exists) {
    nextActions.push("补齐 README、release-verification 和 smoke-checklist 文档。");
  }

  if (placeholders.some((item) => item.placeholder === "<RELEASE_DOWNLOAD_URL>")) {
    nextActions.push("替换 LinuxDO 草稿里的 Release 下载地址。");
  }

  nextActions.push("按 docs/release/smoke-checklist.md 完成真实烟测与截图采集。");

  return {
    rootDir,
    version,
    repoUrl,
    artifact,
    docs,
    placeholders,
    nextActions
  };
}

export function formatReleasePrepReport(report) {
  const lines = [
    "Kiro++ release prep",
    `version: ${report.version}`,
    `repo: ${report.repoUrl ?? "(missing)"}`,
    `artifact: ${report.artifact.exists ? "present" : "missing"} (${report.artifact.path})`,
    `docs: README=${report.docs.readme.exists ? "yes" : "no"}, linuxdo=${report.docs.linuxdoPost.exists ? "yes" : "no"}, verification=${report.docs.releaseVerification.exists ? "yes" : "no"}, smoke=${report.docs.smokeChecklist.exists ? "yes" : "no"}`,
    `linuxdo post placeholders: ${report.placeholders.length}`
  ];

  if (report.placeholders.length > 0) {
    lines.push("placeholders:");
    for (const item of report.placeholders) {
      lines.push(`- ${item.file}: ${item.placeholder}`);
    }
  }

  lines.push("next actions:");
  for (const item of report.nextActions) {
    lines.push(`- ${item}`);
  }

  return lines.join("\n");
}

const currentFilePath = fileURLToPath(import.meta.url);
const entryPath = process.argv[1];

if (entryPath && currentFilePath === entryPath) {
  try {
    const report = await buildReleasePrepReport();
    process.stdout.write(`${formatReleasePrepReport(report)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[kiro++] release:prep failed: ${message}\n`);
    process.exitCode = 1;
  }
}
