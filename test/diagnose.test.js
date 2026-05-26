import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { diagnoseKiroRouting } from "../src/cli/diagnose.js";
import { KIRO_CODEWHISPERER_REGIONS } from "../src/cli/kiro-settings.js";

test("diagnose checks profile settings and recent proxy operations", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kiro-plus-diagnose-"));
  const settingsPath = join(dir, "settings.json");
  const profilesDir = join(dir, "profiles");
  const profileDir = join(profilesDir, "profile-a");
  const logPath = join(dir, "requests.jsonl");
  await mkdir(profileDir, { recursive: true });

  const endpoints = KIRO_CODEWHISPERER_REGIONS.map((region) => ({
    region,
    endpoint: "http://127.0.0.1:43119"
  }));
  await writeFile(settingsPath, JSON.stringify({
    "codewhisperer.config": { endpoints },
    "kiroAgent.modelSelection": "deepseek-v4-pro",
    "kiroAgent.agentModelSelection": "deepseek-v4-pro"
  }));
  await writeFile(join(profileDir, "settings.json"), JSON.stringify({
    "kiroAgent.modelSelection": "auto"
  }));
  await writeFile(logPath, [
    JSON.stringify({
      operation: "GenerateAssistantResponse",
      status: 200,
      headers: {
        cookie: "model_agent_session=secret",
        authorization: "Bearer secret",
        "x-amz-target": "CodeWhispererStreaming.GenerateAssistantResponse"
      }
    }),
    JSON.stringify({ operation: "UnknownOperation", status: 501 }),
    JSON.stringify({ operation: "getUsageLimits", status: 501 }),
    JSON.stringify({ operation: "GetUsageLimits", status: 200 })
  ].join("\n"));

  const report = await diagnoseKiroRouting(settingsPath, { profilesDir, logPath });

  assert.equal(report.profileSettingsChecked, 1);
  assert.equal(report.profileAutoModeBlocksByok, true);
  assert.deepEqual(report.unsupportedOperationsSeen, ["UnknownOperation"]);
  assert.equal(report.recentProxyRequests.length, 4);
  assert.equal(report.recentProxyRequests[0].headers.cookie, "[redacted]");
  assert.equal(report.recentProxyRequests[0].headers.authorization, "[redacted]");
  assert.equal(report.recentProxyRequests[0].headers["x-amz-target"], "CodeWhispererStreaming.GenerateAssistantResponse");
  assert.equal(report.redactionEnabled, true);
});
