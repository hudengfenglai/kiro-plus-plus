# Kiro++

Windows-first local BYOK router and desktop control console for Kiro.

`kiro++` lets Kiro use your own provider keys and models without modifying the installed Kiro application directory. It runs a local endpoint, writes reversible user settings, and exposes a desktop console for provider management, diagnostics, restore, and startup preheat.

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
  - model list sync and default model selection
  - BYOK on/off switching
  - Kiro detect / apply / diagnose / restore
  - startup auto-apply preheat
  - request logs and diagnostics export
  - support bundle export for issue reporting
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

## Windows Desktop Flow

After installation, you get two entry points:

- `Kiro++ Console`
- `Launch Kiro with Kiro++`

Recommended first-run flow:

1. Open `Kiro++ Console`
2. Select a provider preset
3. Fill your API key
4. Fetch or confirm models
5. Test provider
6. Apply to Kiro or enable BYOK
7. Run Diagnose
8. Optionally enable `启动时自动应用`
9. Use `Launch Kiro with Kiro++` or the top-right launch button

## Startup Auto-Apply

The desktop console can enable `启动时自动应用`.

When enabled, opening the desktop app will try to:

1. detect Kiro
2. start the local proxy
3. re-apply BYOK routing when needed

This is intended to reduce repeated manual setup before opening Kiro.

The workbench now shows two different state cards:

- `Launch Kiro with Kiro++`: the last manual Kiro launch attempt
- `启动预热状态`: the last startup auto-apply attempt

If startup auto-apply fails, the app should still open and show the failure state instead of silently doing nothing.

## Support Bundles

The desktop workbench can export a local diagnostics bundle.

Available actions include:

- export plain diagnostics files
- export a zip support bundle
- open the export directory
- open the generated `README.txt`, `summary.txt`, `snapshot.json`, and `recent-requests.json`

Exported data is redacted by default for:

- authorization headers
- cookies
- AWS-style temporary security headers
- local filesystem paths inside the exported summary/snapshot metadata

This is the preferred artifact for GitHub Issues, LinuxDO troubleshooting, and private support chats.

## Fastest DeepSeek Path

Desktop path:

1. Open `Kiro++ Console`
2. Choose `DeepSeek`
3. Fill your key
4. Confirm `deepseek-v4-pro` or `deepseek-v4-flash`
5. Test provider
6. Apply to Kiro
7. Launch Kiro with Kiro++

CLI remains available:

```powershell
node .\src\cli\main.js health-config
node .\src\cli\main.js configure
node .\src\cli\main.js diagnose
node .\src\cli\main.js start
node .\src\cli\main.js restore
```

CLI example:

```powershell
$env:KIRO_PLUS_PROVIDER = "openai-compatible"
$env:KIRO_PLUS_OPENAI_API_KEY = "<DEEPSEEK_API_KEY>"
$env:KIRO_PLUS_OPENAI_BASE_URL = "https://api.deepseek.com"
$env:KIRO_PLUS_MODEL = "deepseek-v4-pro"
node .\src\cli\main.js start
```

More provider examples: [docs/domestic-providers.md](docs/domestic-providers.md)

## Troubleshooting

If Kiro still does not use the local route:

1. Run `Diagnose` in the desktop app
2. Check `localRegions`
3. Check `unsupportedOperationsSeen`
4. Check the recent request log list
5. Export a support bundle and inspect `summary.txt`

Common causes:

- Provider key was never saved
- `defaultModel` is not in `models[]`
- Kiro was not fully restarted after route changes
- Kiro profile-level settings are still forcing `auto`
- The local proxy was not running when Kiro made the request

If the desktop app opens but the docs buttons fail in packaged builds, upgrade to a build that includes packaged `docs` path fallback support.

## Verification Status

Current verified items:

- `npm test`
- `npm run typecheck`
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
