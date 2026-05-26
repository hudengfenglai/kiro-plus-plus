import { createProvider as defaultCreateProvider } from "../../../src/providers/index.js";

function joinUrl(baseUrl, path) {
  return `${String(baseUrl).replace(/\/+$/, "")}${path}`;
}

function normalizeFetchedModels(payload) {
  const items = payload?.data ?? payload?.models ?? [];
  return items
    .map((item) => {
      if (typeof item === "string") return { id: item, name: item };
      return {
        id: item?.id ?? item?.modelId,
        name: item?.name ?? item?.id ?? item?.modelId
      };
    })
    .filter((item) => item.id);
}

export class ProviderCatalogService {
  constructor({ fetch = globalThis.fetch, createProvider = defaultCreateProvider } = {}) {
    this.fetch = fetch;
    this.createProvider = createProvider;
  }

  async fetchModels({ type, baseUrl, apiKey }) {
    if (type !== "openai-compatible") {
      throw new Error(`Model discovery is unsupported for provider type: ${type}`);
    }
    const response = await this.fetch(joinUrl(baseUrl, "/models"), {
      headers: {
        authorization: `Bearer ${apiKey}`
      }
    });
    if (!response.ok) {
      throw new Error(`Model discovery failed with HTTP ${response.status}`);
    }
    const payload = await response.json();
    return normalizeFetchedModels(payload);
  }

  async testProviderConnection({ type, baseUrl, apiKey, modelId, prompt = "ping" }) {
    const provider = this.createProvider({
      type,
      baseUrl,
      apiKey,
      model: modelId
    });
    const started = Date.now();
    const result = await provider.chat({
      messages: [{ role: "user", content: prompt }],
      maxTokens: 64,
      modelId
    });
    return {
      ok: true,
      modelId,
      latencyMs: Date.now() - started,
      text: result.text ?? ""
    };
  }
}
