import test from "node:test";
import assert from "node:assert/strict";

import {
  describeSupportBundleAvailability,
  formatMissingPathLabels
} from "../desktop/shared/support-bundle-status.js";

test("formatMissingPathLabels maps bundle keys to readable Chinese labels", () => {
  assert.deepEqual(
    formatMissingPathLabels(["summaryPath", "requestsPath", "zipPath"]),
    ["摘要文件", "请求文件", "压缩包"]
  );
});

test("describeSupportBundleAvailability reports missing bundle body in readable text", () => {
  const result = describeSupportBundleAvailability({
    exists: false,
    missingPaths: ["summaryPath", "manifestPath"]
  });

  assert.equal(result.state, "missing");
  assert.equal(result.label, "主体缺失");
  assert.match(result.detail, /摘要文件/);
  assert.match(result.detail, /清单文件/);
});

test("describeSupportBundleAvailability distinguishes zip-only loss from bundle loss", () => {
  const result = describeSupportBundleAvailability({
    exists: true,
    zipPath: "bundle.zip",
    zipExists: false,
    missingPaths: []
  });

  assert.equal(result.state, "zip-missing");
  assert.equal(result.label, "zip 缺失");
  assert.match(result.detail, /主体仍可用/);
});
