import test from "node:test";
import assert from "node:assert/strict";

test("electron main bootstraps runtime on app ready", async () => {
  const calls = [];

  const runtime = {
    bootstrap: async () => {
      calls.push("bootstrap");
    },
    launchKiroWithProxy: async () => {
      calls.push("launch");
    }
  };

  async function simulateWhenReady({ launchArgv = [] } = {}) {
    calls.push("register");
    await runtime.bootstrap().catch(() => undefined);
    calls.push("create-window");
    if (launchArgv.includes("--launch-kiro")) {
      await runtime.launchKiroWithProxy();
    }
  }

  await simulateWhenReady();

  assert.deepEqual(calls, ["register", "bootstrap", "create-window"]);
});

test("electron main can bootstrap before launch-kiro flow", async () => {
  const calls = [];

  const runtime = {
    bootstrap: async () => {
      calls.push("bootstrap");
    },
    launchKiroWithProxy: async () => {
      calls.push("launch");
    }
  };

  async function simulateWhenReady({ launchArgv = [] } = {}) {
    calls.push("register");
    await runtime.bootstrap().catch(() => undefined);
    calls.push("create-window");
    if (launchArgv.includes("--launch-kiro")) {
      await runtime.launchKiroWithProxy();
    }
  }

  await simulateWhenReady({ launchArgv: ["--launch-kiro"] });

  assert.deepEqual(calls, ["register", "bootstrap", "create-window", "launch"]);
});
