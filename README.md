# Kiro++

Windows-first local BYOK router and desktop control console for Kiro.

`kiro++` lets Kiro use your own provider keys and models without modifying the installed Kiro application directory. It runs a local endpoint, writes reversible user settings, and exposes a desktop console for provider management, diagnostics, and restore.

## What It Does

- Routes Kiro requests to your own provider keys.
- Supports common domestic BYOK routes through built-in presets:
  - DeepSeek
  - DashScope / Qwen
  - Moonshot / Kimi
  - Zhipu GLM
  - SiliconFlow
- Provides a Windows desktop console for:
  - provider setup and testing
  - BYOK on/off switching
  - Kiro detect / apply / diagnose / restore
  - request logs and diagnostics export
  - single-request model validation
- Generates a Windows NSIS installer package.

## What It Does Not Do

- It does not modify `E:\Kiro` or any installed Kiro binaries.
- It does not spoof accounts.
- It does not bypass authorization, quotas, or official billing.
- It does not write provider API keys into repo config files.

## Install

Use Node.js 18 or newer.

```powershell
npm install
npm test
```

Build the desktop renderer:

```powershell
npm run desktop:build
```

Run the desktop app in development mode:

```powershell
npm run desktop:dev
```

Build the Windows installer:

```powershell
npm run desktop:package
```

The installer is written to `release/`.

## Fastest Path

Recommended desktop flow:

1. Open the desktop console
2. Select a provider preset
3. Fill your API key
4. Fetch or confirm models
5. Test provider
6. Enable BYOK routing
7. Launch Kiro with Kiro++

CLI remains available:

```powershell
node .\src\cli\main.js health-config
node .\src\cli\main.js configure
node .\src\cli\main.js diagnose
node .\src\cli\main.js start
node .\src\cli\main.js restore
```

## DeepSeek Example

```powershell
$env:KIRO_PLUS_PROVIDER = "openai-compatible"
$env:KIRO_PLUS_OPENAI_API_KEY = "<DEEPSEEK_API_KEY>"
$env:KIRO_PLUS_OPENAI_BASE_URL = "https://api.deepseek.com"
$env:KIRO_PLUS_MODEL = "deepseek-v4-pro"
node .\src\cli\main.js start
```

More provider examples: [docs/domestic-providers.md](docs/domestic-providers.md)

## Verification Status

Current verified items:

- `npm test`
- `npm run desktop:build`
- `npm run desktop:package`
- Kiro settings routing diagnosis returns local endpoint coverage for all configured regions
- Real Kiro traffic has been observed hitting:
  - `GetUsageLimits`
  - `ListAvailableModels`
  - `InvokeMCP`
  - `GenerateAssistantResponse`

## Current Limitations

- Windows only.
- Upstream provider responses are currently buffered and then encoded into Kiro-compatible event-stream frames.
- Installer-level smoke on a clean Windows machine still needs broader validation.
- Kiro UI-level smoke for every release should still be done manually before public announcements.

## Safety

- `configure` backs up existing Kiro user settings before writing.
- `restore` restores the newest backup back to the Kiro settings path.
- Desktop BYOK OFF restores the latest Kiro backup.
- Logs redact authorization, cookies, and AWS-style security headers by default.
