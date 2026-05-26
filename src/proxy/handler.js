import { randomUUID } from "node:crypto";

import {
  encodeAssistantResponseChunks,
  encodeInternalServerException,
  encodeMessageMetadataEvent
} from "../protocol/event-stream.js";
import {
  parseRequestMeta,
  STREAMING_CHAT_OPERATIONS
} from "../protocol/request-meta.js";

function jsonResponse(status, body, headers = {}) {
  return {
    status,
    headers: {
      "content-type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  };
}

function streamResponse(body, requestId = randomUUID()) {
  return {
    status: 200,
    stream: true,
    headers: {
      "content-type": "application/vnd.amazon.eventstream",
      "x-amzn-requestid": requestId,
      "x-amz-request-id": requestId
    },
    body
  };
}

function parseJson(body) {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

function modelToCodeWhisperer(model) {
  return {
    modelId: model.id,
    modelName: model.name ?? model.id,
    description: model.description,
    rateMultiplier: model.rateMultiplier,
    rateUnit: model.rateUnit,
    tokenLimits: {
      maxInputTokens: model.maxInputTokens ?? 128000
    }
  };
}

function buildCompletionPrompt(payload) {
  const context = payload.fileContext ?? {};
  const language = context.programmingLanguage?.languageName ?? "unknown";
  return [
    `Filename: ${context.filename ?? "unknown"}`,
    `Language: ${language}`,
    "Left context:",
    context.leftFileContent ?? "",
    "Right context:",
    context.rightFileContent ?? ""
  ].join("\n");
}

function buildChatMessages(payload) {
  if (Array.isArray(payload.messages)) {
    return payload.messages.map((message) => ({
      role: message.role ?? "user",
      content: typeof message.content === "string" ? message.content : JSON.stringify(message.content ?? "")
    }));
  }

  const history = payload.conversationState?.history;
  if (Array.isArray(history) && history.length > 0) {
    const messages = [];
    for (const item of history) {
      const userMessage = item.userInputMessage ?? item.userMessage;
      const assistantMessage = item.assistantResponseMessage ?? item.assistantResponse;
      if (userMessage?.content) {
        messages.push({ role: "user", content: String(userMessage.content) });
      }
      if (assistantMessage?.content) {
        messages.push({ role: "assistant", content: String(assistantMessage.content) });
      }
    }
    const current = payload.conversationState?.currentMessage?.userInputMessage;
    if (current?.content) {
      messages.push({ role: "user", content: String(current.content) });
    }
    if (messages.length > 0) return messages;
  }

  if (payload.conversationState?.currentMessage?.userInputMessage?.content) {
    return [{ role: "user", content: payload.conversationState.currentMessage.userInputMessage.content }];
  }
  if (payload.prompt) {
    return [{ role: "user", content: payload.prompt }];
  }
  return [{ role: "user", content: JSON.stringify(payload) }];
}

function resolveModelId(config) {
  return config.models?.[0]?.id ?? "deepseek-v4-pro";
}

function resolveRequestModelId(payload, config) {
  const explicitModelId = payload.modelId
    ?? payload.fileContext?.modelId
    ?? payload.conversationState?.currentMessage?.userInputMessage?.modelId
    ?? payload.messages?.findLast?.((message) => message?.modelId)?.modelId;

  if (explicitModelId) return String(explicitModelId);
  return resolveModelId(config);
}

function usageLimitsResponse(config) {
  const modelId = resolveModelId(config);
  return {
    $metadata: { requestId: randomUUID() },
    localByok: true,
    message: "Local BYOK proxy usage is governed by your configured provider key.",
    limits: [
      {
        type: "chat",
        modelId,
        remaining: null,
        resetAt: null
      },
      {
        type: "autocomplete",
        modelId,
        remaining: null,
        resetAt: null
      }
    ]
  };
}

function extractMcpMethod(payload) {
  return payload.method ??
    payload.mcpRequest?.method ??
    payload.request?.method ??
    payload.params?.method ??
    "";
}

function invokeMcpResponse(payload) {
  const method = extractMcpMethod(payload);
  if (!method || ["initialize", "tools/list", "resources/list", "prompts/list"].includes(method)) {
    return jsonResponse(200, {
      $metadata: { requestId: randomUUID() },
      localByok: true,
      result: {
        protocolVersion: payload.protocolVersion ?? "2024-11-05",
        capabilities: {},
        serverInfo: {
          name: "kiro-plus-plus-local",
          version: "0.2.0"
        },
        tools: [],
        resources: [],
        prompts: []
      }
    });
  }

  return jsonResponse(501, {
    error: "Unsupported local MCP method",
    method,
    localByok: true,
    hint: "Kiro++ V2 does not proxy MCP tool calls to external services."
  });
}

export async function handleKiroRequest(request, context = {}) {
  const config = context.config ?? { models: [] };
  const logger = context.logger ?? (() => {});
  const meta = parseRequestMeta(request);
  const { operation } = meta;
  const payload = parseJson(request.body);

  if (request.method === "GET" && (meta.pathname === "/health" || meta.pathname === "/")) {
    return jsonResponse(200, { ok: true, models: config.models });
  }

  logger({
    at: new Date().toISOString(),
    ...meta,
    method: request.method,
    url: request.url,
    bodyBytes: request.body?.length ?? 0
  });

  if (operation === "ListAvailableModels") {
    const models = config.models.map(modelToCodeWhisperer);
    return jsonResponse(200, {
      models,
      defaultModel: models[0]
    });
  }

  if (operation === "GetUsageLimits") {
    return jsonResponse(200, usageLimitsResponse(config));
  }

  if (operation === "GenerateCompletions") {
    const modelId = resolveRequestModelId(payload, config);
    const result = await context.provider.complete({
      prompt: buildCompletionPrompt(payload),
      maxTokens: payload.maxResults,
      modelId
    });
    return jsonResponse(200, {
      $metadata: { requestId: randomUUID() },
      completions: [
        {
          content: result.text,
          references: []
        }
      ]
    });
  }

  if (STREAMING_CHAT_OPERATIONS.has(operation)) {
    const modelId = resolveRequestModelId(payload, config);
    const conversationId = payload.conversationState?.conversationId ?? randomUUID();
    let body;
    try {
      const result = await context.provider.chat({
        messages: buildChatMessages(payload),
        maxTokens: payload.maxTokens ?? 8192,
        modelId
      });
      body = encodeAssistantResponseChunks(result.text ?? "", modelId, conversationId);
    } catch (error) {
      body = Buffer.concat([
        Buffer.from(encodeMessageMetadataEvent(conversationId)),
        Buffer.from(encodeInternalServerException(error instanceof Error ? error.message : String(error)))
      ]);
    }
    return streamResponse(body);
  }

  if (operation === "InvokeMCP") {
    return invokeMcpResponse(payload);
  }

  const requestId = randomUUID();
  return jsonResponse(501, {
    error: "Unsupported Kiro operation",
    operation,
    target: meta.target,
    requestId,
    hint: "Check .kiro-plus-plus/requests.jsonl and Kiro logs, then add a minimal compatibility handler."
  }, {
    "x-amzn-requestid": requestId,
    "x-amz-request-id": requestId
  });
}
