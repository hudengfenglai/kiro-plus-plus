# Start kiro++ with DeepSeek and verbose protocol capture for Kiro Agent chat.
param(
  [string]$ApiKey = $env:KIRO_PLUS_OPENAI_API_KEY,
  [string]$Model = "deepseek-v4-pro"
)

if (-not $ApiKey -or $ApiKey -notmatch '^sk-') {
  Write-Host "Set DeepSeek API key first:" -ForegroundColor Yellow
  Write-Host '  $env:KIRO_PLUS_OPENAI_API_KEY = "sk-..."' -ForegroundColor Cyan
  exit 1
}

$env:KIRO_PLUS_PROVIDER = "openai-compatible"
$env:KIRO_PLUS_OPENAI_API_KEY = $ApiKey
$env:KIRO_PLUS_OPENAI_BASE_URL = "https://api.deepseek.com"
$env:KIRO_PLUS_MODEL = $Model
$env:KIRO_PLUS_LOG_HEADERS = "1"
$env:KIRO_PLUS_LOG_BODIES = "1"

Set-Location (Join-Path $PSScriptRoot "..")
Write-Host "Capture mode ON -> .kiro-plus-plus/requests.jsonl" -ForegroundColor Yellow
Write-Host "Use a non-sensitive scratch project in Kiro." -ForegroundColor Yellow
node .\src\cli\main.js start
