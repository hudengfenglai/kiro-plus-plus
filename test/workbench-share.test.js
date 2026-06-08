import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLogShareText,
  buildOutputShareText,
  buildWorkbenchShareMarkdown
} from "../desktop/shared/workbench-share.js";

test("buildLogShareText uses Chinese labels and safe fallbacks", () => {
  const text = buildLogShareText(
    {
      operation: "",
      status: 500,
      requestId: undefined,
      at: "2026-06-08T15:00:00.000Z",
      durationMs: 42,
      bodyBytes: 7
    },
    "failure"
  );

  assert.match(text, /最近失败：未知操作 \/ HTTP 500/);
  assert.match(text, /请求 ID：-/);
  assert.match(text, /耗时：42 ms/);
  assert.match(text, /请求体大小：7 bytes/);
});

test("buildOutputShareText renders localized session share text", () => {
  const text = buildOutputShareText({
    entries: [],
    viewingHistoricalBundle: false,
    currentBundleName: "bundle-a",
    selectedProviderLabel: "DeepSeek",
    proxyEndpoint: "http://127.0.0.1:43119",
    proxyState: "运行中",
    isByokEnabled: true
  });

  assert.match(text, /Kiro\+\+ 会话分享/);
  assert.match(text, /模式：当前实时会话/);
  assert.match(text, /支持包：bundle-a/);
  assert.match(text, /当前桌面会话还没有记录任何动作/);
});

test("buildWorkbenchShareMarkdown uses localized bundle labels and fallback names", () => {
  const text = buildWorkbenchShareMarkdown({
    bundleName: null,
    recentLogsSource: { kind: "bundle" },
    diagnosticsSummarySource: { kind: "bundle" },
    diagnosticsSummary: "",
    outputShareText: "demo",
    outputCount: 0,
    outputSessionStartedAt: null,
    latestFailure: null,
    latestSuccess: null,
    exportedAt: "2026-06-08T16:00:00.000Z"
  });

  assert.match(text, /- 当前支持包：无/);
  assert.match(text, /历史支持包（未知支持包）/);
  assert.match(text, /- 输出会话：当前桌面会话还没有动作记录/);
});
