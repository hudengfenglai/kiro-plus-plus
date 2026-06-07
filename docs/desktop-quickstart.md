# Desktop Quickstart

Use this guide when you install the Windows desktop build and want the shortest path to a working Kiro++ setup.

## First Run

1. Open `Kiro++ Console`
2. Select a provider preset
3. Fill your API key
4. Confirm or fetch models
5. Test the provider
6. Apply to Kiro
7. Run Diagnose
8. Launch Kiro with Kiro++

## Recommended DeepSeek Setup

- preset: `DeepSeek`
- base URL: `https://api.deepseek.com`
- model: `deepseek-v4-pro` or `deepseek-v4-flash`

## Startup Auto-Apply

If you enable `启动时自动应用`, opening the desktop app will try to:

1. detect Kiro
2. start the local proxy
3. re-apply BYOK routing if coverage is missing

The workbench exposes:

- `启动预热状态`: startup auto-apply result
- `Launch Kiro with Kiro++`: manual launch result

## Support Bundle

If something still fails:

1. open `Logs & Diagnostics`
2. export a zip support bundle
3. inspect `summary.txt`
4. share the bundle for troubleshooting

## Restore

Use `恢复备份` or `BYOK OFF` to restore the latest saved Kiro settings backup.
