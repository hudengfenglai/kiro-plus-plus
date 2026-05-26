import test from "node:test";
import assert from "node:assert/strict";

import { isMainModule, runCli } from "../src/cli/main.js";

test("runCli start creates a server and listens on configured host and port", async () => {
  const calls = [];
  const exitCode = await runCli(["start"], {
    loadConfig: async () => ({ server: { host: "127.0.0.1", port: 43119 } }),
    createServer: async () => ({
      listen: (port, host, callback) => {
        calls.push({ port, host });
        callback();
      }
    }),
    log: () => {}
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(calls, [{ port: 43119, host: "127.0.0.1" }]);
});

test("runCli configure falls back to deepseek-v4-pro when config has no model", async () => {
  const calls = [];
  const exitCode = await runCli(["configure"], {
    loadConfig: async () => ({
      server: { host: "127.0.0.1", port: 43119 },
      models: []
    }),
    configureKiroSettings: async (request) => {
      calls.push(["settings", request]);
      return {
        settingsPath: "settings.json",
        backupPath: "backup.json"
      };
    },
    configureAllKiroProfiles: async (request) => {
      calls.push(["profiles", request]);
      return { updated: [] };
    },
    log: () => {}
  });

  assert.equal(exitCode, 0);
  assert.equal(calls[0][1].agentModelId, "deepseek-v4-pro");
  assert.equal(calls[1][1].agentModelId, "deepseek-v4-pro");
});

test("isMainModule handles Windows paths", () => {
  assert.equal(
    isMainModule("file:///G:/kiro++/src/cli/main.js", "G:\\kiro++\\src\\cli\\main.js"),
    true
  );
});
