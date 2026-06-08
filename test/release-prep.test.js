import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  buildReleasePrepReport,
  formatReleasePrepMarkdown,
  formatReleasePrepReport
} from "../scripts/release-prep.mjs";

test("buildReleasePrepReport summarizes release readiness and placeholders", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "kiro-release-prep-"));

  try {
    await mkdir(join(workspace, "docs", "release"), { recursive: true });
    await mkdir(join(workspace, "release"), { recursive: true });

    await writeFile(join(workspace, "package.json"), JSON.stringify({
      name: "kiro-plus-plus",
      version: "0.1.0"
    }, null, 2));

    await writeFile(join(workspace, "README.md"), "# Kiro++\n");
    await writeFile(
      join(workspace, "docs", "release", "linuxdo-post.md"),
      [
        "# post",
        "GitHub 仓库：`https://github.com/hudengfenglai/kiro-plus-plus`",
        "Release 下载：`<RELEASE_DOWNLOAD_URL>`"
      ].join("\n")
    );
    await writeFile(join(workspace, "docs", "release", "release-verification.md"), "# verification\n");
    await writeFile(join(workspace, "docs", "release", "smoke-checklist.md"), "# smoke\n");
    await writeFile(join(workspace, "release", "kiro-plus-plus-0.1.0-x64.exe"), "binary");

    const report = await buildReleasePrepReport({
      rootDir: workspace,
      getGitStatus: async () => ({
        clean: true,
        summary: ""
      })
    });

    assert.equal(report.version, "0.1.0");
    assert.equal(report.repoUrl, "https://github.com/hudengfenglai/kiro-plus-plus");
    assert.equal(report.artifact.exists, true);
    assert.match(report.artifact.path, /kiro-plus-plus-0\.1\.0-x64\.exe$/);
    assert.equal(report.docs.readme.exists, true);
    assert.equal(report.docs.linuxdoPost.exists, true);
    assert.equal(report.docs.releaseVerification.exists, true);
    assert.equal(report.docs.smokeChecklist.exists, true);
    assert.deepEqual(report.placeholders, [
      {
        file: "docs/release/linuxdo-post.md",
        placeholder: "<RELEASE_DOWNLOAD_URL>"
      }
    ]);
    assert.deepEqual(report.nextActions, [
      "替换 LinuxDO 草稿里的 Release 下载地址。",
      "按 docs/release/smoke-checklist.md 完成真实烟测与截图采集。"
    ]);

    const text = formatReleasePrepReport(report);
    assert.match(text, /Kiro\+\+ release prep/);
    assert.match(text, /version: 0\.1\.0/);
    assert.match(text, /artifact: present/);
    assert.match(text, /linuxdo post placeholders: 1/);
    assert.match(text, /<RELEASE_DOWNLOAD_URL>/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("buildReleasePrepReport de-duplicates repeated publish placeholders", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "kiro-release-prep-dedup-"));

  try {
    await mkdir(join(workspace, "docs", "release"), { recursive: true });
    await mkdir(join(workspace, "release"), { recursive: true });

    await writeFile(join(workspace, "package.json"), JSON.stringify({
      name: "kiro-plus-plus",
      version: "0.1.0"
    }, null, 2));

    await writeFile(join(workspace, "README.md"), "# Kiro++\n");
    await writeFile(
      join(workspace, "docs", "release", "linuxdo-post.md"),
      [
        "# post",
        "下载一：`<RELEASE_DOWNLOAD_URL>`",
        "下载二：`<RELEASE_DOWNLOAD_URL>`"
      ].join("\n")
    );
    await writeFile(join(workspace, "docs", "release", "release-verification.md"), "# verification\n");
    await writeFile(join(workspace, "docs", "release", "smoke-checklist.md"), "# smoke\n");
    await writeFile(join(workspace, "release", "kiro-plus-plus-0.1.0-x64.exe"), "binary");

    const report = await buildReleasePrepReport({
      rootDir: workspace,
      getGitStatus: async () => ({
        clean: true,
        summary: ""
      })
    });

    assert.deepEqual(report.placeholders, [
      {
        file: "docs/release/linuxdo-post.md",
        placeholder: "<RELEASE_DOWNLOAD_URL>"
      }
    ]);

    const text = formatReleasePrepReport(report);
    assert.match(text, /linuxdo post placeholders: 1/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("buildReleasePrepReport reports missing artifacts and docs", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "kiro-release-prep-missing-"));

  try {
    await mkdir(join(workspace, "docs", "release"), { recursive: true });
    await writeFile(join(workspace, "package.json"), JSON.stringify({
      name: "kiro-plus-plus",
      version: "0.2.0"
    }, null, 2));
    await writeFile(
      join(workspace, "docs", "release", "linuxdo-post.md"),
      "# post\nGitHub 仓库：`https://github.com/hudengfenglai/kiro-plus-plus`\n"
    );

    const report = await buildReleasePrepReport({
      rootDir: workspace,
      getGitStatus: async () => ({
        clean: true,
        summary: ""
      })
    });

    assert.equal(report.artifact.exists, false);
    assert.equal(report.docs.readme.exists, false);
    assert.equal(report.docs.releaseVerification.exists, false);
    assert.equal(report.docs.smokeChecklist.exists, false);
    assert.equal(report.placeholders.length, 0);
    assert.deepEqual(report.nextActions, [
      "先运行 npm run desktop:package 生成安装包。",
      "补齐 README、release-verification 和 smoke-checklist 文档。",
      "按 docs/release/smoke-checklist.md 完成真实烟测与截图采集。"
    ]);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("buildReleasePrepReport includes clean git status", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "kiro-release-prep-git-clean-"));

  try {
    await mkdir(join(workspace, "docs", "release"), { recursive: true });
    await mkdir(join(workspace, "release"), { recursive: true });

    await writeFile(join(workspace, "package.json"), JSON.stringify({
      name: "kiro-plus-plus",
      version: "0.1.0"
    }, null, 2));
    await writeFile(join(workspace, "README.md"), "# Kiro++\n");
    await writeFile(join(workspace, "docs", "release", "linuxdo-post.md"), "# post\n");
    await writeFile(join(workspace, "docs", "release", "release-verification.md"), "# verification\n");
    await writeFile(join(workspace, "docs", "release", "smoke-checklist.md"), "# smoke\n");
    await writeFile(join(workspace, "release", "kiro-plus-plus-0.1.0-x64.exe"), "binary");

    const report = await buildReleasePrepReport({
      rootDir: workspace,
      getGitStatus: async () => ({
        clean: true,
        summary: ""
      })
    });

    assert.equal(report.git.clean, true);
    assert.equal(report.git.summary, "");

    const text = formatReleasePrepReport(report);
    assert.match(text, /git: clean/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("buildReleasePrepReport flags dirty git status as a next action", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "kiro-release-prep-git-dirty-"));

  try {
    await mkdir(join(workspace, "docs", "release"), { recursive: true });
    await mkdir(join(workspace, "release"), { recursive: true });

    await writeFile(join(workspace, "package.json"), JSON.stringify({
      name: "kiro-plus-plus",
      version: "0.1.0"
    }, null, 2));
    await writeFile(join(workspace, "README.md"), "# Kiro++\n");
    await writeFile(join(workspace, "docs", "release", "linuxdo-post.md"), "# post\n");
    await writeFile(join(workspace, "docs", "release", "release-verification.md"), "# verification\n");
    await writeFile(join(workspace, "docs", "release", "smoke-checklist.md"), "# smoke\n");
    await writeFile(join(workspace, "release", "kiro-plus-plus-0.1.0-x64.exe"), "binary");

    const report = await buildReleasePrepReport({
      rootDir: workspace,
      getGitStatus: async () => ({
        clean: false,
        summary: "M README.md"
      })
    });

    assert.equal(report.git.clean, false);
    assert.equal(report.git.summary, "M README.md");
    assert.match(report.nextActions[0], /先整理未提交改动/);

    const text = formatReleasePrepReport(report);
    assert.match(text, /git: dirty/);
    assert.match(text, /M README\.md/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("formatReleasePrepMarkdown outputs a copyable release summary", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "kiro-release-prep-markdown-"));

  try {
    await mkdir(join(workspace, "docs", "release"), { recursive: true });
    await mkdir(join(workspace, "release"), { recursive: true });

    await writeFile(join(workspace, "package.json"), JSON.stringify({
      name: "kiro-plus-plus",
      version: "0.1.0"
    }, null, 2));
    await writeFile(join(workspace, "README.md"), "# Kiro++\n");
    await writeFile(
      join(workspace, "docs", "release", "linuxdo-post.md"),
      [
        "# post",
        "GitHub 仓库：`https://github.com/hudengfenglai/kiro-plus-plus`",
        "Release 下载：`<RELEASE_DOWNLOAD_URL>`"
      ].join("\n")
    );
    await writeFile(join(workspace, "docs", "release", "release-verification.md"), "# verification\n");
    await writeFile(join(workspace, "docs", "release", "smoke-checklist.md"), "# smoke\n");
    await writeFile(join(workspace, "release", "kiro-plus-plus-0.1.0-x64.exe"), "binary");

    const report = await buildReleasePrepReport({
      rootDir: workspace,
      getGitStatus: async () => ({
        clean: true,
        summary: ""
      })
    });

    const markdown = formatReleasePrepMarkdown(report);

    assert.match(markdown, /^# Kiro\+\+ 0\.1\.0 Release Prep/m);
    assert.match(markdown, /- Repo: https:\/\/github\.com\/hudengfenglai\/kiro-plus-plus/);
    assert.match(markdown, /- Git status: clean/);
    assert.match(markdown, /- Artifact: `release\/kiro-plus-plus-0\.1\.0-x64\.exe`/);
    assert.match(markdown, /## Pending Replacements/);
    assert.match(markdown, /<RELEASE_DOWNLOAD_URL>/);
    assert.match(markdown, /## Next Actions/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
