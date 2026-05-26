import test from "node:test";
import assert from "node:assert/strict";

import { handleKiroRequest } from "../src/proxy/handler.js";

test("health endpoint reports configured models", async () => {
  const response = await handleKiroRequest({
    method: "GET",
    url: "/health",
    headers: {},
    body: ""
  }, {
    config: { models: [{ id: "gpt-test", name: "GPT Test" }] }
  });

  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), {
    ok: true,
    models: [{ id: "gpt-test", name: "GPT Test" }]
  });
});

test("root path returns the same payload as health", async () => {
  const response = await handleKiroRequest({
    method: "GET",
    url: "/",
    headers: {},
    body: ""
  }, {
    config: { models: [{ id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" }] }
  });

  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), {
    ok: true,
    models: [{ id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" }]
  });
});

test("ListAvailableModels returns CodeWhisperer-shaped model metadata", async () => {
  const response = await handleKiroRequest({
    method: "POST",
    url: "/",
    headers: { "x-amz-target": "CodeWhispererRuntime.ListAvailableModels" },
    body: "{}"
  }, {
    config: { models: [{ id: "gpt-test", name: "GPT Test", description: "test model", maxInputTokens: 128000 }] }
  });

  const payload = JSON.parse(response.body);
  assert.equal(response.status, 200);
  assert.equal(payload.defaultModel.modelId, "gpt-test");
  assert.equal(payload.models[0].tokenLimits.maxInputTokens, 128000);
});

test("ListAvailableModels returns every configured BYOK model", async () => {
  const response = await handleKiroRequest({
    method: "GET",
    url: "/ListAvailableModels",
    headers: {},
    body: ""
  }, {
    config: {
      models: [
        { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
        { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash" }
      ]
    }
  });

  const payload = JSON.parse(response.body);
  assert.equal(response.status, 200);
  assert.deepEqual(payload.models.map((model) => model.modelId), [
    "deepseek-v4-pro",
    "deepseek-v4-flash"
  ]);
  assert.equal(payload.defaultModel.modelId, "deepseek-v4-pro");
});

test("GenerateCompletions maps provider text to completions array", async () => {
  const response = await handleKiroRequest({
    method: "POST",
    url: "/",
    headers: { "x-amz-target": "CodeWhispererRuntime.GenerateCompletions" },
    body: JSON.stringify({
      fileContext: {
        leftFileContent: "const answer =",
        rightFileContent: "",
        filename: "test.js",
        programmingLanguage: { languageName: "javascript" }
      },
      modelId: "deepseek-v4-flash"
    })
  }, {
    provider: {
      complete: async (request) => {
        assert.match(request.prompt, /const answer =/);
        assert.equal(request.modelId, "deepseek-v4-flash");
        return { text: " 42;" };
      }
    },
    config: { models: [{ id: "gpt-test", name: "GPT Test" }] }
  });

  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.body).completions[0].content, " 42;");
});

test("GetUsageLimits returns local BYOK usage status", async () => {
  const response = await handleKiroRequest({
    method: "POST",
    url: "/",
    headers: { "x-amz-target": "CodeWhispererRuntime.GetUsageLimits" },
    body: "{}"
  }, {
    config: { models: [{ id: "gpt-test", name: "GPT Test" }] }
  });

  const payload = JSON.parse(response.body);
  assert.equal(response.status, 200);
  assert.equal(payload.localByok, true);
  assert.equal(payload.limits[0].type, "chat");
});

test("GET /getUsageLimits maps to local BYOK usage status", async () => {
  const response = await handleKiroRequest({
    method: "GET",
    url: "/getUsageLimits?origin=AI_EDITOR&resourceType=AGENTIC_REQUEST",
    headers: {},
    body: ""
  }, {
    config: { models: [{ id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" }] }
  });

  const payload = JSON.parse(response.body);
  assert.equal(response.status, 200);
  assert.equal(payload.localByok, true);
  assert.equal(payload.limits[0].modelId, "deepseek-v4-pro");
});

test("InvokeMCP supports safe tool-list style requests without external access", async () => {
  const response = await handleKiroRequest({
    method: "POST",
    url: "/",
    headers: { "x-amz-target": "CodeWhispererStreaming.InvokeMCP" },
    body: JSON.stringify({ method: "tools/list" })
  }, {
    config: { models: [{ id: "gpt-test", name: "GPT Test" }] }
  });

  const payload = JSON.parse(response.body);
  assert.equal(response.status, 200);
  assert.deepEqual(payload.result.tools, []);
  assert.equal(payload.localByok, true);
});

test("POST /mcp maps to safe InvokeMCP response", async () => {
  const response = await handleKiroRequest({
    method: "POST",
    url: "/mcp",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method: "tools/list" })
  }, {
    config: { models: [{ id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" }] }
  });

  const payload = JSON.parse(response.body);
  assert.equal(response.status, 200);
  assert.deepEqual(payload.result.tools, []);
});

test("POST /generateAssistantResponse maps to streaming chat", async () => {
  const response = await handleKiroRequest({
    method: "POST",
    url: "/generateAssistantResponse",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      conversationState: {
        conversationId: "conv-path-1",
        currentMessage: {
          userInputMessage: { content: "hello", modelId: "deepseek-v4-flash" }
        }
      }
    })
  }, {
    provider: {
      chat: async (request) => {
        assert.equal(request.messages.at(-1).content, "hello");
        assert.equal(request.modelId, "deepseek-v4-flash");
        return { text: "hi" };
      }
    },
    config: { models: [{ id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" }] }
  });

  assert.equal(response.status, 200);
  assert.equal(response.stream, true);
  assert.equal(response.headers["content-type"], "application/vnd.amazon.eventstream");
});

test("unknown operations are logged and return a structured 501", async () => {
  const logs = [];
  const response = await handleKiroRequest({
    method: "POST",
    url: "/",
    headers: { "x-amz-target": "CodeWhispererStreaming.UnknownOperation" },
    body: "{}"
  }, {
    logger: (entry) => logs.push(entry),
    config: { models: [] }
  });

  assert.equal(response.status, 501);
  const payload = JSON.parse(response.body);
  assert.equal(payload.error, "Unsupported Kiro operation");
  assert.equal(payload.operation, "UnknownOperation");
  assert.equal(payload.target, "CodeWhispererStreaming.UnknownOperation");
  assert.match(payload.requestId, /^[0-9a-f-]{36}$/i);
  assert.match(payload.hint, /requests\.jsonl/);
  assert.equal(logs[0].operation, "UnknownOperation");
});
