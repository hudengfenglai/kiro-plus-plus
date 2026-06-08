import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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
  const unique = new Set();
  return matches.map((match) => ({
    file,
    placeholder: `<${match[1]}>`
  })).filter((item) => {
    if (!allowed.has(item.placeholder)) {
      return false;
    }
    const key = `${item.file}::${item.placeholder}`;
    if (unique.has(key)) {
      return false;
    }
    unique.add(key);
    return true;
  });
}

async function defaultGetGitStatus(rootDir) {
  try {
    const { stdout } = await execFileAsync("git", ["status", "--short"], { cwd: rootDir });
    const summary = stdout.trim();
    return {
      clean: summary.length === 0,
      summary
    };
  } catch (error) {
    return {
      clean: false,
      summary: `git status unavailable: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export async function buildReleasePrepReport({
  rootDir = process.cwd(),
  getGitStatus = defaultGetGitStatus
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

  const git = await getGitStatus(rootDir);

  if (!git.clean) {
    nextActions.unshift("先整理未提交改动，确保发布前工作区干净。");
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
    git,
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
    `git: ${report.git.clean ? "clean" : "dirty"}${report.git.summary ? ` (${report.git.summary})` : ""}`,
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

export function formatReleasePrepMarkdown(report) {
  const lines = [
    `# Kiro++ ${report.version} Release Prep`,
    "",
    "## Summary",
    `- Repo: ${report.repoUrl ?? "(missing)"}`,
    `- Git status: ${report.git.clean ? "clean" : `dirty (${report.git.summary})`}`,
    `- Artifact: ${report.artifact.exists ? `\`${report.artifact.path}\`` : `missing (\`${report.artifact.path}\`)`}`,
    `- Docs: README=${report.docs.readme.exists ? "yes" : "no"}, linuxdo=${report.docs.linuxdoPost.exists ? "yes" : "no"}, verification=${report.docs.releaseVerification.exists ? "yes" : "no"}, smoke=${report.docs.smokeChecklist.exists ? "yes" : "no"}`
  ];

  if (report.placeholders.length > 0) {
    lines.push("", "## Pending Replacements");
    for (const item of report.placeholders) {
      lines.push(`- ${item.file}: \`${item.placeholder}\``);
    }
  }

  lines.push("", "## Next Actions");
  for (const item of report.nextActions) {
    lines.push(`- ${item}`);
  }

  return lines.join("\n");
}

const currentFilePath = fileURLToPath(import.meta.url);
const entryPath = process.argv[1];
const cliArgs = process.argv.slice(2);

if (entryPath && currentFilePath === entryPath) {
  try {
    const rootDir = process.env.KIRO_PLUS_RELEASE_PREP_ROOT
      ? resolve(process.env.KIRO_PLUS_RELEASE_PREP_ROOT)
      : process.cwd();
    const report = await buildReleasePrepReport({ rootDir });
    const writeMarkdownIndex = cliArgs.indexOf("--write-markdown");
    const writeMarkdownPath = writeMarkdownIndex >= 0
      ? cliArgs[writeMarkdownIndex + 1]
      : null;

    if (writeMarkdownPath) {
      const absoluteOutputPath = resolve(rootDir, writeMarkdownPath);
      await mkdir(dirname(absoluteOutputPath), { recursive: true });
      await writeFile(absoluteOutputPath, `${formatReleasePrepMarkdown(report)}\n`, "utf8");
      process.stdout.write(`${absoluteOutputPath}\n`);
    } else {
      const output = cliArgs.includes("--json")
        ? JSON.stringify(report, null, 2)
        : cliArgs.includes("--markdown")
          ? formatReleasePrepMarkdown(report)
          : formatReleasePrepReport(report);
      process.stdout.write(`${output}\n`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[kiro++] release:prep failed: ${message}\n`);
    process.exitCode = 1;
  }
}
