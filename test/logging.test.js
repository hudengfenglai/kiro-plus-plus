import test from "node:test";
import assert from "node:assert/strict";

import { sanitizeHeaders } from "../src/proxy/server.js";

test("sanitizeHeaders redacts auth, cookies, and AWS security token headers", () => {
  const sanitized = sanitizeHeaders({
    authorization: "Bearer secret",
    cookie: "model_agent_session=secret",
    "set-cookie": "session=secret",
    "x-api-key": "secret",
    "x-amz-security-token": "secret",
    "x-amz-target": "CodeWhispererRuntime.GetUsageLimits"
  });

  assert.equal(sanitized.authorization, "[redacted]");
  assert.equal(sanitized.cookie, "[redacted]");
  assert.equal(sanitized["set-cookie"], "[redacted]");
  assert.equal(sanitized["x-api-key"], "[redacted]");
  assert.equal(sanitized["x-amz-security-token"], "[redacted]");
  assert.equal(sanitized["x-amz-target"], "CodeWhispererRuntime.GetUsageLimits");
});
