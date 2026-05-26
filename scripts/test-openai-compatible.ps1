# Test any OpenAI-compatible provider in the current PowerShell session.
param(
  [string]$ApiKey = $env:KIRO_PLUS_OPENAI_API_KEY,
  [string]$BaseUrl = $env:KIRO_PLUS_OPENAI_BASE_URL,
  [string]$Model = $env:KIRO_PLUS_MODEL,
  [string]$Prompt = "reply OK"
)

if (-not $ApiKey) {
  Write-Error 'Set KIRO_PLUS_OPENAI_API_KEY first.'
  exit 1
}

if (-not $BaseUrl) {
  Write-Error 'Set KIRO_PLUS_OPENAI_BASE_URL first, for example https://api.deepseek.com.'
  exit 1
}

if (-not $Model) {
  Write-Error 'Set KIRO_PLUS_MODEL first, for example deepseek-v4-pro or qwen-plus.'
  exit 1
}

$normalizedBaseUrl = $BaseUrl.TrimEnd("/")
$headers = @{
  Authorization  = "Bearer $ApiKey"
  "Content-Type" = "application/json"
}

$body = @{
  model    = $Model
  messages = @(
    @{ role = "user"; content = $Prompt }
  )
  max_tokens = 32
} | ConvertTo-Json -Depth 5

Write-Host "Testing provider endpoint: $normalizedBaseUrl/chat/completions"
Write-Host "Model: $Model"

Invoke-RestMethod -Method Post `
  -Uri "$normalizedBaseUrl/chat/completions" `
  -Headers $headers `
  -Body $body
