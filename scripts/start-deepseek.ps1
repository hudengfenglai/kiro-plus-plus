# Configure DeepSeek and start the kiro++ local proxy in this shell.
param(
  [string]$ApiKey = $env:KIRO_PLUS_OPENAI_API_KEY,
  [string]$Model = "deepseek-v4-pro"
)

if (-not $ApiKey -or $ApiKey -notmatch '^sk-') {
  Write-Host "Set DeepSeek API key first:" -ForegroundColor Yellow
  Write-Host '  $env:KIRO_PLUS_OPENAI_API_KEY = "sk-..."' -ForegroundColor Cyan
  Write-Host "Or pass it explicitly:" -ForegroundColor Yellow
  Write-Host '  .\scripts\start-deepseek.ps1 -ApiKey "sk-..."' -ForegroundColor Cyan
  exit 1
}

$env:KIRO_PLUS_PROVIDER = "openai-compatible"
$env:KIRO_PLUS_OPENAI_API_KEY = $ApiKey
$env:KIRO_PLUS_OPENAI_BASE_URL = "https://api.deepseek.com"
$env:KIRO_PLUS_MODEL = $Model

Set-Location (Join-Path $PSScriptRoot "..")
Write-Host "Model: $Model"
Write-Host "Base:  $($env:KIRO_PLUS_OPENAI_BASE_URL)"
node .\src\cli\main.js start
