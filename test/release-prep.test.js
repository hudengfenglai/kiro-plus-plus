import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { buildReleasePrepReport, formatReleasePrepReport } from "../scripts/release-prep.mjs";

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

    const report = await buildReleasePrepReport({ rootDir: workspace });

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

    const report = await buildReleasePrepReport({ rootDir: workspace });

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
