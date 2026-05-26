function assertOkResponse(response, providerName) {
  if (!response.ok) {
    throw new Error(`${providerName} request failed with HTTP ${response.status}`);
  }
}

function joinUrl(baseUrl, path) {
  return `${String(baseUrl).replace(/\/+$/, "")}${path}`;
}

class OpenAICompatibleProvider {
  constructor(options) {
    this.options = options;
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async chat({ messages, maxTokens, modelId }) {
    const response = await this.fetch(joinUrl(this.options.baseUrl, "/chat/completions"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: modelId ?? this.options.model,
        messages,
        max_tokens: maxTokens,
        stream: false
      })
    });
    assertOkResponse(response, "OpenAI-compatible");
    const payload = await response.json();
    return { text: payload.choices?.[0]?.message?.content ?? "" };
  }

  async complete({ prompt, maxTokens, modelId }) {
    return this.chat({
      modelId,
      maxTokens,
      messages: [
        {
          role: "system",
          content: "Complete the user's code. Return only the completion text."
        },
        { role: "user", content: prompt }
      ]
    });
  }
}

class AnthropicProvider {
  constructor(options) {
    this.options = options;
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async chat({ messages, maxTokens, modelId }) {
    const response = await this.fetch(joinUrl(this.options.baseUrl, "/v1/messages"), {
      method: "POST",
      headers: {
        "x-api-key": this.options.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: modelId ?? this.options.model,
        max_tokens: maxTokens ?? 8192,
        messages: messages.map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content
        }))
      })
    });
    assertOkResponse(response, "Anthropic");
    const payload = await response.json();
    return { text: payload.content?.map((part) => part.text ?? "").join("") ?? "" };
  }

  async complete({ prompt, maxTokens, modelId }) {
    return this.chat({ messages: [{ role: "user", content: prompt }], maxTokens, modelId });
  }
}

class GeminiProvider {
  constructor(options) {
    this.options = options;
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async chat({ messages, modelId }) {
    const url = joinUrl(
      this.options.baseUrl,
      `/models/${encodeURIComponent(modelId ?? this.options.model)}:generateContent?key=${encodeURIComponent(this.options.apiKey)}`
    );
    const response = await this.fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: messages.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }]
        }))
      })
    });
    assertOkResponse(response, "Gemini");
    const payload = await response.json();
    return { text: payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "" };
  }

  async complete({ prompt, maxTokens, modelId }) {
    return this.chat({ messages: [{ role: "user", content: prompt }], maxTokens, modelId });
  }
}

export function createProvider(options) {
  if (options.type === "openai-compatible") {
    return new OpenAICompatibleProvider(options);
  }
  if (options.type === "anthropic") {
    return new AnthropicProvider(options);
  }
  if (options.type === "gemini") {
    return new GeminiProvider(options);
  }
  throw new Error(`Unsupported provider: ${options.type}`);
}
