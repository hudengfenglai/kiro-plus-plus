import test from "node:test";
import assert from "node:assert/strict";

import { createProvider } from "../src/providers/index.js";

test("OpenAI-compatible provider sends normalized chat messages", async () => {
  const calls = [];
  const provider = createProvider({
    type: "openai-compatible",
    baseUrl: "https://example.test/v1",
    apiKey: "sk-test",
    model: "gpt-test",
    fetch: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        choices: [{ message: { content: "hello from openai" } }]
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
  });

  const result = await provider.chat({
    messages: [{ role: "user", content: "ping" }],
    maxTokens: 64
  });

  assert.equal(result.text, "hello from openai");
  assert.equal(calls[0].url, "https://example.test/v1/chat/completions");
  assert.equal(calls[0].init.headers.authorization, "Bearer sk-test");
  assert.equal(JSON.parse(calls[0].init.body).model, "gpt-test");
});

test("provider factory rejects unsupported providers", () => {
  assert.throws(() => createProvider({ type: "unknown" }), /Unsupported provider/);
});
