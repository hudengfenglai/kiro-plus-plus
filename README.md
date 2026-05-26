# kiro++

Windows-first local BYOK proxy and desktop control console for Kiro.

`kiro++` does not modify the installed Kiro application under `E:\Kiro`. It starts a local endpoint, writes reversible user settings, and routes Kiro's CodeWhisperer / Q Developer requests to your own provider keys.

## Current Product State

Implemented in V3.1:

- OpenAI-compatible, Anthropic, and Gemini provider adapters.
- Kiro-compatible health, model listing, usage limits, safe MCP listing, chat streaming, and autocomplete handlers.
- Desktop runtime with:
  - provider presets for common domestic routes
  - BYOK enable / disable semantics
  - Kiro detect / apply / diagnose / restore actions
  - diagnostics export
  - one-click `Launch Kiro with Kiro++`
- React desktop renderer with onboarding home + control console.
- Electron build output for the renderer and NSIS packaging config.
- CLI commands remain available and unchanged.

Known limitations:

- Provider responses are buffered and then encoded into Kiro-compatible event-stream frames. True upstream SSE passthrough is still a later task.
- The packaged `Launch Kiro with Kiro++` batch entry is included, but Windows installer smoke on a clean machine still needs final validation.

## Install First

Use Node.js 18 or newer.

```powershell
npm install
npm test
```

Start the desktop renderer build:

```powershell
npm run desktop:build
```

Start the desktop app in development mode:

```powershell
npm run desktop:dev
```

Create the Windows installer package:

```powershell
npm run desktop:package
```

The NSIS package is written to `release/`.

## First-Run Flow

The intended first-run order in the desktop app is:

1. Detect Kiro installation
2. Select a provider preset
3. Fill API key
4. Fetch or confirm models
5. Test provider
6. Enable BYOK routing
7. Launch Kiro with Kiro++

## Provider Presets

Built-in presets focus on common domestic BYOK routes:

- DeepSeek
- DashScope / Qwen
- Moonshot / Kimi
- Zhipu GLM
- SiliconFlow

Each provider can also be edited manually after applying a preset.

See [docs/domestic-providers.md](docs/domestic-providers.md) for concrete base URLs and model ids.

## Desktop Behaviors

`BYOK ON` means:

- use the selected provider profile
- apply local Kiro routing
- keep the latest backup path in desktop state

`BYOK OFF` means:

- restore the latest Kiro backup
- mark local routing disabled in desktop state

The desktop app also exposes:

- `Kiro++ Console`
- `Launch Kiro with Kiro++`

## CLI Still Works

If you prefer the terminal:

```powershell
node .\src\cli\main.js health-config
node .\src\cli\main.js configure
node .\src\cli\main.js diagnose
node .\src\cli\main.js start
node .\src\cli\main.js restore
```

## Manual Smoke Test

Desktop path:

1. Run `npm run desktop:dev`
2. Select the DeepSeek preset
3. Fill your API key
4. Fetch `deepseek-v4-pro` / `deepseek-v4-flash`
5. Save and test provider
6. Enable BYOK
7. Run diagnose
8. Launch Kiro with Kiro++
9. In Kiro, send one Agent chat request

CLI path:

1. Export `KIRO_PLUS_*` environment variables
2. Run `node .\src\cli\main.js configure`
3. Run `node .\src\cli\main.js diagnose`
4. Run `node .\src\cli\main.js start`

## Safety

- `configure` backs up the existing Kiro user settings before writing.
- `restore` copies the newest backup back to the Kiro user settings path.
- The proxy does not spoof accounts or bypass Kiro authentication.
- API keys are stored through the desktop secret store, not written into repo config files.
