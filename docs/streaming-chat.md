# Kiro Agent Streaming Chat

kiro++ V2 returns AWS event-stream responses for Kiro Agent chat paths while keeping provider calls BYOK-only.

Handled streaming operations:

- `GenerateAssistantResponse`
- `SendMessage`
- `GenerateTaskAssistPlan`

## Start with DeepSeek

```powershell
cd G:\kiro++
$env:KIRO_PLUS_OPENAI_API_KEY = "sk-your-key"
.\scripts\start-deepseek.ps1
```

For protocol capture in a non-sensitive scratch project:

```powershell
.\scripts\start-deepseek-capture.ps1
```

Capture mode enables `KIRO_PLUS_LOG_HEADERS=1` and `KIRO_PLUS_LOG_BODIES=1`. Do not use it in projects whose prompts, paths, or files may contain secrets.

## Kiro Routing Steps

```powershell
node .\src\cli\main.js configure
node .\src\cli\main.js diagnose
```

Expected `diagnose` signals:

- `localRegions` contains all supported Kiro CodeWhisperer regions.
- `officialDefaultStillUsed` is `false`.
- `autoModeBlocksByok` is `false`.
- `profileAutoModeBlocksByok` is `false`.

Then fully quit Kiro, start the proxy, reopen Kiro, and test one Agent chat request.

## Event Stream Shape

The response body uses `application/vnd.amazon.eventstream` and emits:

1. `initial-response` with `{ "conversationId": "..." }`
2. one or more `assistantResponseEvent` frames with `{ "content": "...", "modelId": "..." }`
3. `completionEvent` with `{ "conversationId": "...", "stopReason": "end_turn" }`
4. `errorEvent` when provider chat fails after streaming setup starts

Provider calls are currently buffered, then split into event-stream chunks for Kiro. True upstream SSE passthrough is a later version.

## Troubleshooting

If `.kiro-plus-plus/requests.jsonl` only shows `GET /`, Kiro Agent did not call the proxy.

Common causes:

- Kiro was not fully restarted after `configure`.
- A profile-level setting still has `kiroAgent.modelSelection` set to `auto`.
- The proxy was not running before Kiro sent the Agent request.
- Kiro selected Auto mode in the model picker.

Run:

```powershell
node .\src\cli\main.js diagnose
```

Review `unsupportedOperationsSeen` and recent proxy requests before adding new compatibility handlers.

## Restore

```powershell
node .\src\cli\main.js restore
```
