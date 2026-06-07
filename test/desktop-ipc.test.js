import test from "node:test";
import assert from "node:assert/strict";

import { buildResourceCandidates, resolveResourcePath } from "../desktop/main/resource-paths.js";

test("buildResourceCandidates prefers packaged docs before cwd fallbacks", () => {
  const candidates = buildResourceCandidates({
    resourceId: "readme",
    appPath: "C:\\Program Files\\Kiro++ Console\\resources\\app.asar",
    cwd: "G:\\kiro++"
  });

  assert.deepEqual(candidates, [
    "C:\\Program Files\\Kiro++ Console\\resources\\app.asar\\docs\\README.md",
    "C:\\Program Files\\Kiro++ Console\\resources\\docs\\README.md",
    "C:\\Program Files\\Kiro++ Console\\docs\\README.md",
    "G:\\kiro++\\docs\\README.md",
    "G:\\kiro++\\README.md"
  ]);
});

test("resolveResourcePath returns resources docs path for packaged app.asar installs", async () => {
  const target = await resolveResourcePath("providers", {
    appPath: "C:\\Program Files\\Kiro++ Console\\resources\\app.asar",
    cwd: "G:\\kiro++",
    pathExists: async (candidate) => candidate === "C:\\Program Files\\Kiro++ Console\\resources\\docs\\domestic-providers.md"
  });

  assert.equal(target, "C:\\Program Files\\Kiro++ Console\\resources\\docs\\domestic-providers.md");
});

test("resolveResourcePath supports packaged desktop quickstart docs", async () => {
  const target = await resolveResourcePath("quickstart", {
    appPath: "C:\\Program Files\\Kiro++ Console\\resources\\app.asar",
    cwd: "G:\\kiro++",
    pathExists: async (candidate) => candidate === "C:\\Program Files\\Kiro++ Console\\resources\\docs\\desktop-quickstart.md"
  });

  assert.equal(target, "C:\\Program Files\\Kiro++ Console\\resources\\docs\\desktop-quickstart.md");
});

test("resolveResourcePath falls back to cwd planning doc in development", async () => {
  const target = await resolveResourcePath("plan", {
    appPath: "C:\\Program Files\\Kiro++ Console\\resources\\app.asar",
    cwd: "G:\\kiro++",
    pathExists: async (candidate) => candidate === "G:\\kiro++\\planning\\project-kiro-plus-plus.md"
  });

  assert.equal(target, "G:\\kiro++\\planning\\project-kiro-plus-plus.md");
});
