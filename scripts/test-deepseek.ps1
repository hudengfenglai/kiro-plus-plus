# Test DeepSeek API in the current PowerShell session.
param(
  [string]$ApiKey,
  [string]$Model = "deepseek-v4-pro"
)

if (-not $ApiKey) {
  $ApiKey = $env:KIRO_PLUS_OPENAI_API_KEY
}

if ($env:KIRO_PLUS_MODEL) {
  $Model = $env:KIRO_PLUS_MODEL
}

if (-not $ApiKey -or $ApiKey -notmatch '^sk-') {
  Write-Error 'Set KIRO_PLUS_OPENAI_API_KEY first, e.g. $env:KIRO_PLUS_OPENAI_API_KEY = "sk-..."'
  exit 1
}

$script = Join-Path $PSScriptRoot "test-openai-compatible.ps1"
& $script `
  -ApiKey $ApiKey `
  -BaseUrl "https://api.deepseek.com" `
  -Model $Model `
  -Prompt "reply OK"
