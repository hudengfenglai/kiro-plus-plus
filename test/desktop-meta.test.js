import test from "node:test";
import assert from "node:assert/strict";

import { buildAppMeta } from "../desktop/main/app-meta.js";

test("buildAppMeta reports packaged install metadata", () => {
  const meta = buildAppMeta({
    version: "0.1.0",
    isPackaged: true,
    appPath: "C:\\Program Files\\Kiro++ Console\\resources\\app.asar"
  });

  assert.equal(meta.version, "0.1.0");
  assert.equal(meta.isPackaged, true);
  assert.equal(meta.source, "packaged");
  assert.equal(meta.buildLabel, "安装包");
  assert.match(meta.appPath, /app\.asar$/);
});

test("buildAppMeta falls back to unknown version in development", () => {
  const meta = buildAppMeta({
    version: "",
    isPackaged: false,
    appPath: "G:\\kiro++"
  });

  assert.equal(meta.version, "unknown");
  assert.equal(meta.isPackaged, false);
  assert.equal(meta.source, "development");
  assert.equal(meta.buildLabel, "源码环境");
  assert.equal(meta.appPath, "G:\\kiro++");
});
