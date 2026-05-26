export function getHeader(headers, name) {
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (key.toLowerCase() === lower) return value;
  }
  return undefined;
}

const OPERATION_ALIASES = new Map([
  ["listavailablemodels", "ListAvailableModels"],
  ["getusagelimits", "GetUsageLimits"],
  ["generatecompletions", "GenerateCompletions"],
  ["generateassistantresponse", "GenerateAssistantResponse"],
  ["sendmessage", "SendMessage"],
  ["generatetaskassistplan", "GenerateTaskAssistPlan"],
  ["chat", "Chat"],
  ["mcp", "InvokeMCP"],
  ["invokemcp", "InvokeMCP"]
]);

export function canonicalOperation(operation) {
  const value = String(operation ?? "");
  return OPERATION_ALIASES.get(value.toLowerCase()) ?? value;
}

export function parseRequestMeta(request) {
  const target = getHeader(request.headers, "x-amz-target") ?? getHeader(request.headers, "x-amzn-target");
  const contentType = getHeader(request.headers, "content-type");
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;

  if (target) {
    const parts = String(target).split(".");
    return {
      target: String(target),
      service: parts.slice(0, -1).join("."),
      operation: canonicalOperation(parts.at(-1) ?? ""),
      contentType,
      pathname
    };
  }

  return {
    target: "",
    service: "",
    operation: canonicalOperation(pathname.split("/").filter(Boolean).at(-1) ?? ""),
    contentType,
    pathname
  };
}

export const STREAMING_CHAT_OPERATIONS = new Set([
  "GenerateAssistantResponse",
  "SendMessage",
  "GenerateTaskAssistPlan"
]);
