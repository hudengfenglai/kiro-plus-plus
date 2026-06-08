import test from "node:test";
import assert from "node:assert/strict";

import { describeWorkbenchSnapshotAvailability } from "../desktop/shared/workbench-snapshot-status.js";

test("describeWorkbenchSnapshotAvailability reports missing snapshot files", () => {
  const result = describeWorkbenchSnapshotAvailability({
    exportedAt: "2026-06-08T14:00:00.000Z",
    filePath: "snapshot.md",
    exists: false
  });

  assert.equal(result.state, "missing");
  assert.equal(result.label, "文件缺失");
  assert.match(result.detail, /不在磁盘上/);
});

test("describeWorkbenchSnapshotAvailability reports ready snapshots", () => {
  const result = describeWorkbenchSnapshotAvailability({
    exportedAt: "2026-06-08T14:00:00.000Z",
    filePath: "snapshot.md",
    exists: true
  });

  assert.equal(result.state, "ready");
  assert.equal(result.label, "可打开");
  assert.match(result.detail, /仍可直接打开/);
});
