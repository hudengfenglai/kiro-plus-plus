# Domestic Provider Setup

kiro++ uses the `openai-compatible` provider for services that expose `POST /chat/completions`. Reuse the same model id and base URL that you use in Cursor++ when that provider is OpenAI-compatible.

Important: `KIRO_PLUS_OPENAI_BASE_URL` must include the provider API prefix, usually ending in `/v1`.

## Common Environment Variables

| Variable | Meaning |
| --- | --- |
| `KIRO_PLUS_PROVIDER` | Use `openai-compatible` for most domestic providers. |
| `KIRO_PLUS_OPENAI_API_KEY` | Provider API key. |
| `KIRO_PLUS_OPENAI_BASE_URL` | Full OpenAI-compatible base URL. |
| `KIRO_PLUS_MODEL` | Provider model id exposed to Kiro. |
| `KIRO_PLUS_PORT` | Local proxy port, default `43119`. |

## DeepSeek

```powershell
$env:KIRO_PLUS_PROVIDER = "openai-compatible"
$env:KIRO_PLUS_OPENAI_API_KEY = "<DEEPSEEK_API_KEY>"
$env:KIRO_PLUS_OPENAI_BASE_URL = "https://api.deepseek.com"
$env:KIRO_PLUS_MODEL = "deepseek-v4-pro"
node .\src\cli\main.js start
```

## DashScope / Qwen

```powershell
$env:KIRO_PLUS_PROVIDER = "openai-compatible"
$env:KIRO_PLUS_OPENAI_API_KEY = "<DASHSCOPE_API_KEY>"
$env:KIRO_PLUS_OPENAI_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
$env:KIRO_PLUS_MODEL = "qwen-plus"
```

## Moonshot / Kimi

```powershell
$env:KIRO_PLUS_PROVIDER = "openai-compatible"
$env:KIRO_PLUS_OPENAI_API_KEY = "<MOONSHOT_API_KEY>"
$env:KIRO_PLUS_OPENAI_BASE_URL = "https://api.moonshot.cn/v1"
$env:KIRO_PLUS_MODEL = "kimi-k2.5"
```

## Zhipu GLM

```powershell
$env:KIRO_PLUS_PROVIDER = "openai-compatible"
$env:KIRO_PLUS_OPENAI_API_KEY = "<ZHIPU_API_KEY>"
$env:KIRO_PLUS_OPENAI_BASE_URL = "https://open.bigmodel.cn/api/paas/v4"
$env:KIRO_PLUS_MODEL = "glm-4.7"
```

## SiliconFlow

```powershell
$env:KIRO_PLUS_PROVIDER = "openai-compatible"
$env:KIRO_PLUS_OPENAI_API_KEY = "<SILICONFLOW_API_KEY>"
$env:KIRO_PLUS_OPENAI_BASE_URL = "https://api.siliconflow.cn/v1"
$env:KIRO_PLUS_MODEL = "Qwen/Qwen3.5-35B-A3B"
```

## MiniMax Anthropic-Compatible Mode

MiniMax uses an Anthropic-compatible path in many catalogs, so switch provider type:

```powershell
$env:KIRO_PLUS_PROVIDER = "anthropic"
$env:KIRO_PLUS_ANTHROPIC_API_KEY = "<MINIMAX_API_KEY>"
$env:KIRO_PLUS_ANTHROPIC_BASE_URL = "https://api.minimax.io/anthropic/v1"
$env:KIRO_PLUS_ANTHROPIC_MODEL = "MiniMax-M2.5"
```

## Optional Config File

Save as `kiro-plus-plus.config.json`:

```json
{
  "defaultProvider": "openai-compatible",
  "openAiApiKey": "your-key",
  "openAiBaseUrl": "https://api.deepseek.com",
  "model": "deepseek-v4-pro",
  "modelName": "DeepSeek V4 Pro",
  "port": 43119
}
```

## Verify Provider Before Kiro

Use the generic smoke script:

```powershell
.\scripts\test-openai-compatible.ps1
```

It reads `KIRO_PLUS_OPENAI_API_KEY`, `KIRO_PLUS_OPENAI_BASE_URL`, and `KIRO_PLUS_MODEL` from the current PowerShell session.

Equivalent manual request:

```powershell
$headers = @{ Authorization = "Bearer $env:KIRO_PLUS_OPENAI_API_KEY"; "Content-Type" = "application/json" }
$body = @{ model = $env:KIRO_PLUS_MODEL; messages = @(@{ role = "user"; content = "ping" }); max_tokens = 16 } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri "$($env:KIRO_PLUS_OPENAI_BASE_URL)/chat/completions" -Headers $headers -Body $body
```

After the provider works, run:

```powershell
node .\src\cli\main.js configure
node .\src\cli\main.js diagnose
```

For your first real test, DeepSeek and DashScope are the safest choices because both expose standard OpenAI-compatible chat endpoints. DeepSeek's current model ids are `deepseek-v4-pro` and `deepseek-v4-flash`; legacy ids `deepseek-chat` and `deepseek-reasoner` are scheduled for retirement on 2026-07-24.
