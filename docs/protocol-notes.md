# Kiro Protocol Notes

## Observed Kiro Entry Points

Read-only inspection of the local Kiro install showed:

- Kiro executable: `E:\Kiro\Kiro.exe`
- Kiro package version: `0.12.200`
- Agent extension: `E:\Kiro\resources\app\extensions\kiro.kiro-agent`
- Agent extension version: `0.3.401`

Important implementation details:

- `codewhisperer.config.endpoints` is read from VS Code/Kiro settings.
- `getCodeWhispererConfig()` returns `{ region, endpoint, modelId }`.
- Chat/agent traffic constructs a `CodeWhispererStreaming` client with that endpoint.
- Autocomplete constructs a `CodeWhispererRuntime` client with that endpoint.
- Model selection uses Kiro model IDs and model metadata shaped as `modelId`, `modelName`, `description`, and `tokenLimits`.

## V2 Compatibility Surface

The proxy currently handles:

- `GET /health`
- `ListAvailableModels`
- `GetUsageLimits`
- `InvokeMCP` for safe list/initialize style requests
- `GenerateCompletions`
- `GenerateAssistantResponse`
- `SendMessage`
- `GenerateTaskAssistPlan`

Unsupported operations return:

```json
{
  "error": "Unsupported Kiro operation",
  "operation": "<operation>",
  "target": "<x-amz-target>",
  "requestId": "<uuid>",
  "hint": "Check .kiro-plus-plus/requests.jsonl and Kiro logs, then add a minimal compatibility handler."
}
```

Requests are logged to `.kiro-plus-plus/requests.jsonl` with one entry per request. Sensitive headers such as `authorization`, `cookie`, `set-cookie`, `x-api-key`, and `x-amz-security-token` are redacted when header capture is enabled.

## Streaming Response Shape

Streaming chat responses use `application/vnd.amazon.eventstream` and emit:

- `initial-response`
- one or more `assistantResponseEvent`
- `completionEvent`
- `errorEvent` when provider chat fails after stream setup

## Next Protocol Work

- Run Kiro against the local endpoint with `KIRO_PLUS_LOG_BODIES=1` in a non-sensitive scratch project.
- Capture exact request headers, paths, body shapes, and streaming expectations.
- Add tests for each observed operation before implementing compatibility.
- Keep request-body logging disabled by default.
- Implement true upstream SSE passthrough for OpenAI-compatible providers after the Kiro event shape is stable.
