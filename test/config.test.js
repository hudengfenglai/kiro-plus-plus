import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { loadConfig } from "../src/config.js";
import {
  configureAllKiroProfiles,
  configureKiroSettings,
  restoreLatestBackup
} from "../src/cli/kiro-settings.js";

test("loadConfig builds an OpenAI-compatible provider from environment", async () => {
  const config = await loadConfig({
    env: {
      KIRO_PLUS_PROVIDER: "openai-compatible",
      KIRO_PLUS_OPENAI_API_KEY: "sk-test",
      KIRO_PLUS_OPENAI_BASE_URL: "https://example.test/v1",
      KIRO_PLUS_MODEL: "gpt-test",
      KIRO_PLUS_PORT: "48123"
    },
    configPath: "missing-config.json"
  });

  assert.equal(config.server.port, 48123);
  assert.equal(config.defaultProvider, "openai-compatible");
  assert.equal(config.providers["openai-compatible"].apiKey, "sk-test");
  assert.equal(config.providers["openai-compatible"].baseUrl, "https://example.test/v1");
  assert.equal(config.models[0].id, "gpt-test");
});

test("loadConfig supports a comma-separated KIRO_PLUS_MODELS list", async () => {
  const config = await loadConfig({
    env: {
      KIRO_PLUS_PROVIDER: "openai-compatible",
      KIRO_PLUS_OPENAI_API_KEY: "sk-test",
      KIRO_PLUS_OPENAI_BASE_URL: "https://example.test/v1",
      KIRO_PLUS_MODELS: "deepseek-v4-pro, deepseek-v4-flash"
    },
    configPath: "missing-config.json"
  });

  assert.deepEqual(config.models.map((model) => model.id), [
    "deepseek-v4-pro",
    "deepseek-v4-flash"
  ]);
  assert.equal(config.providers["openai-compatible"].model, "deepseek-v4-pro");
});

test("configureKiroSettings backs up and writes custom endpoint without losing existing settings", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kiro-plus-settings-"));
  const settingsPath = join(dir, "settings.json");
  const backupDir = join(dir, "backups");
  await writeFile(settingsPath, JSON.stringify({ "editor.fontSize": 15 }, null, 2));

  const result = await configureKiroSettings({
    settingsPath,
    backupDir,
    endpoint: "http://127.0.0.1:43119",
    regions: ["us-east-1", "eu-central-1"]
  });

  const settings = JSON.parse(await readFile(settingsPath, "utf8"));
  assert.equal(settings["editor.fontSize"], 15);
  assert.deepEqual(settings["codewhisperer.config"].endpoints, [
    { region: "us-east-1", endpoint: "http://127.0.0.1:43119" },
    { region: "eu-central-1", endpoint: "http://127.0.0.1:43119" }
  ]);
  assert.match(result.backupPath, /settings\.\d+\.json$/);

  await rm(dir, { recursive: true, force: true });
});

test("configureKiroSettings writes agent model selection when agentModelId is set", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kiro-plus-agent-model-"));
  const settingsPath = join(dir, "settings.json");
  const backupDir = join(dir, "backups");

  await configureKiroSettings({
    settingsPath,
    backupDir,
    endpoint: "http://127.0.0.1:43119",
    agentModelId: "deepseek-v4-pro"
  });

  const settings = JSON.parse(await readFile(settingsPath, "utf8"));
  assert.equal(settings["kiroAgent.modelSelection"], "deepseek-v4-pro");
  assert.equal(settings["kiroAgent.agentModelSelection"], "deepseek-v4-pro");

  await rm(dir, { recursive: true, force: true });
});

test("configureAllKiroProfiles updates profile settings that override Auto", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kiro-plus-profiles-"));
  const profilesDir = join(dir, "profiles");
  const backupDir = join(dir, "backups");
  const profileDir = join(profilesDir, "test-profile");
  const settingsPath = join(profileDir, "settings.json");
  await mkdir(profileDir, { recursive: true });
  await writeFile(
    settingsPath,
    JSON.stringify({ "kiroAgent.modelSelection": "auto" }, null, 2)
  );

  const result = await configureAllKiroProfiles({
    profilesDir,
    backupDir,
    endpoint: "http://127.0.0.1:43119",
    agentModelId: "deepseek-v4-pro"
  });

  assert.equal(result.updated.length, 1);
  const settings = JSON.parse(await readFile(settingsPath, "utf8"));
  assert.equal(settings["kiroAgent.modelSelection"], "deepseek-v4-pro");
  assert.deepEqual(settings["codewhisperer.config"].endpoints[0], {
    region: "us-east-1",
    endpoint: "http://127.0.0.1:43119"
  });

  await rm(dir, { recursive: true, force: true });
});

test("configureAllKiroProfiles parses JSONC profile settings with comments", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kiro-plus-profiles-jsonc-"));
  const profilesDir = join(dir, "profiles");
  const backupDir = join(dir, "backups");
  const profileDir = join(profilesDir, "jsonc-profile");
  const settingsPath = join(profileDir, "settings.json");
  await mkdir(profileDir, { recursive: true });
  await writeFile(
    settingsPath,
    [
      "{",
      '  "terminal.integrated.profiles.windows": {',
      '    "PowerShell": {',
      '      "source": "PowerShell",',
      "    },",
      "  },",
      '  //"editor.bracketPairColorization.enabled": true,',
      '  "kiroAgent.modelSelection": "auto",',
      "}"
    ].join("\n")
  );

  const result = await configureAllKiroProfiles({
    profilesDir,
    backupDir,
    endpoint: "http://127.0.0.1:43119",
    agentModelId: "deepseek-v4-pro"
  });

  assert.equal(result.updated[0].profileId, "jsonc-profile");
  assert.match(result.updated[0].backupPath, /settings\.\d+\.json$/);
  const settings = JSON.parse(await readFile(settingsPath, "utf8"));
  assert.equal(settings["kiroAgent.modelSelection"], "deepseek-v4-pro");
  assert.equal(settings["codewhisperer.config"].endpoints.length, 8);

  await rm(dir, { recursive: true, force: true });
});

test("restoreLatestBackup restores the newest settings backup", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kiro-plus-restore-"));
  const settingsPath = join(dir, "settings.json");
  const backupDir = join(dir, "backups");
  await configureKiroSettings({
    settingsPath,
    backupDir,
    endpoint: "http://127.0.0.1:43119",
    now: () => 1000
  });
  await writeFile(settingsPath, JSON.stringify({ changed: true }));

  await restoreLatestBackup({ settingsPath, backupDir });

  const restored = JSON.parse(await readFile(settingsPath, "utf8"));
  assert.deepEqual(restored, {});

  await rm(dir, { recursive: true, force: true });
});
