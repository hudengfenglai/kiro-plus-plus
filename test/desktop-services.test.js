import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createSecretStore } from "../desktop/main/services/secret-store.js";
import { ProviderCatalogService } from "../desktop/main/services/provider-catalog-service.js";
import { LogService } from "../desktop/main/services/log-service.js";
import { ProxyService } from "../desktop/main/services/proxy-service.js";
import { KiroIntegrationService } from "../desktop/main/services/kiro-integration-service.js";

test("secret store saves, reads, deletes, and surfaces adapter errors", async () => {
  const memory = new Map();
  const store = createSecretStore({
    adapter: {
      getPassword: async (_service, account) => memory.get(account) ?? null,
      setPassword: async (_service, account, value) => memory.set(account, value),
      deletePassword: async (_service, account) => memory.delete(account)
    }
  });

  await store.set("deepseek", "sk-test");
  assert.equal(await store.get("deepseek"), "sk-test");
  await store.delete("deepseek");
  assert.equal(await store.get("deepseek"), null);

  const broken = createSecretStore({
    loadAdapter: async () => {
      throw new Error("keytar unavailable");
    }
  });
  await assert.rejects(() => broken.get("deepseek"), /keytar unavailable/);
});

test("provider catalog fetches models and tests provider connections", async () => {
  const service = new ProviderCatalogService({
    fetch: async () =>
      new Response(JSON.stringify({
        data: [
          { id: "deepseek-v4-pro" },
          { id: "deepseek-v4-flash" }
        ]
      }), { status: 200, headers: { "content-type": "application/json" } }),
    createProvider: (options) => ({
      chat: async ({ messages, modelId }) => ({
        text: `${options.type}:${modelId}:${messages.at(-1).content}`
      })
    })
  });

  const models = await service.fetchModels({
    type: "openai-compatible",
    baseUrl: "https://api.deepseek.com",
    apiKey: "sk-test"
  });
  assert.deepEqual(models.map((model) => model.id), [
    "deepseek-v4-pro",
    "deepseek-v4-flash"
  ]);

  const result = await service.testProviderConnection({
    type: "openai-compatible",
    baseUrl: "https://api.deepseek.com",
    apiKey: "sk-test",
    modelId: "deepseek-v4-flash",
    prompt: "ping"
  });
  assert.equal(result.ok, true);
  assert.equal(result.modelId, "deepseek-v4-flash");
  assert.match(result.text, /ping/);
});

test("log service filters request log entries and keeps redacted headers", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kiro-plus-logs-"));
  const logPath = join(dir, "requests.jsonl");
  await writeFile(logPath, [
    JSON.stringify({
      at: "2026-05-26T00:00:00.000Z",
      operation: "GenerateAssistantResponse",
      status: 200,
      durationMs: 120,
      requestId: "a",
      bodyBytes: 10,
      headers: { authorization: "Bearer sk-test" }
    }),
    JSON.stringify({
      at: "2026-05-26T00:00:01.000Z",
      operation: "GetUsageLimits",
      status: 500,
      durationMs: 30,
      requestId: "b",
      bodyBytes: 0
    })
  ].join("\n"));

  const service = new LogService({ logPath });
  const all = await service.listRequests();
  const errors = await service.listRequests({ errorOnly: true });

  assert.equal(all.length, 2);
  assert.equal(all[0].headers.authorization, "[redacted]");
  assert.equal(errors.length, 1);
  assert.equal(errors[0].operation, "GetUsageLimits");

  await rm(dir, { recursive: true, force: true });
});

test("proxy service manages start, restart, stop, and health state", async () => {
  let listenCount = 0;
  let closeCount = 0;
  const service = new ProxyService({
    createServer: async () => ({
      listen: (_port, _host, callback) => {
        listenCount += 1;
        callback();
      },
      close: (callback) => {
        closeCount += 1;
        callback();
      }
    }),
    fetch: async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
  });

  const settings = {
    selectedProviderId: "deepseek",
    providers: [
      {
        id: "deepseek",
        type: "openai-compatible",
        label: "DeepSeek",
        baseUrl: "https://api.deepseek.com",
        defaultModel: "deepseek-v4-pro",
        models: ["deepseek-v4-pro"]
      }
    ],
    kiro: { defaultEndpointPort: 43119 }
  };

  await service.start({ settings, apiKey: "sk-test" });
  assert.equal(service.getStatus().state, "running");
  assert.equal((await service.getHealth()).ok, true);

  await service.restart({ settings, apiKey: "sk-test" });
  assert.equal(service.getStatus().state, "running");

  await service.stop();
  assert.equal(service.getStatus().state, "stopped");
  assert.equal(listenCount, 2);
  assert.equal(closeCount, 2);
});

test("kiro integration service detects install paths and delegates configure/diagnose", async () => {
  const calls = [];
  const service = new KiroIntegrationService({
    pathExists: async (target) => target === "E:\\Kiro\\Kiro.exe",
    defaultSettingsPath: () => "C:\\Users\\HU\\AppData\\Roaming\\Kiro\\User\\settings.json",
    defaultProfilesDir: () => "C:\\Users\\HU\\AppData\\Roaming\\Kiro\\User\\profiles",
    defaultBackupDir: () => "C:\\Users\\HU\\.kiro\\kiro-plus-plus\\backups",
    configureKiroSettings: async (request) => calls.push(["settings", request]),
    configureAllKiroProfiles: async (request) => calls.push(["profiles", request]),
    diagnoseKiroRouting: async () => ({ localRegions: ["us-east-1"] }),
    restoreLatestBackup: async () => ({ backupPath: "backup.json" })
  });

  const detection = await service.detectKiro();
  assert.equal(detection.installed, true);
  assert.equal(detection.installPath, "E:\\Kiro\\Kiro.exe");

  await service.applyRouting({ endpoint: "http://127.0.0.1:43119", agentModelId: "deepseek-v4-pro" });
  assert.equal(calls.length, 2);
  assert.equal((await service.diagnose()).localRegions[0], "us-east-1");
  assert.equal((await service.restoreLatestBackup()).backupPath, "backup.json");
});
