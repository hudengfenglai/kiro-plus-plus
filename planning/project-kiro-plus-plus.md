# Project: kiro++ BYOK Router

Status: UI Refresh In Progress
Priority: High
Created: 2026-05-25
Updated: 2026-06-07

## Goal

Build a local BYOK proxy and Kiro configuration helper without modifying the installed Kiro application.

## Epics

- Epic 1: Local provider routing
- Epic 2: Kiro-compatible proxy surface
- Epic 3: Kiro settings backup, configure, and restore CLI
- Epic 4: Verification and operator documentation
- Epic 5: V2 real Kiro compatibility loop
- Epic 6: V3 desktop control console
- Epic 7: V3.1 personal developer productization
- Epic 8: Public release preparation
- Epic 9: Three-column desktop workbench refresh

## Active Task

Task: Three-column desktop workbench refresh

Status: In Progress

Acceptance:
- Home view remains available as onboarding entry.
- Console becomes a fixed three-column workbench: left control rail, center workspace, right validation rail.
- Existing IPC contracts remain unchanged.
- Chinese UI copy is clean and no garbled text remains in the renderer.
- Renderer build and existing automated tests pass.

Recent Progress:
- Unified the workbench recommendation/tab naming on `status` across runtime, renderer, and preview assets.
- Removed the obsolete `desktop/main/preload.js` after moving packaged Electron bridging to `preload.mjs`.
- Kept the renderer-side desktop bridge guard in place to fail with an actionable message instead of raw `undefined` property errors.
- Expanded Kiro install discovery to cover common user-level Windows installs such as `%LOCALAPPDATA%\\Programs\\Kiro\\Kiro.exe`.
- Exposed Kiro install search hints and checked-path counts in the runtime and desktop workbench to make failed routing easier to diagnose.
- Added runtime preflight guards so invalid provider models, missing API keys, and missing Kiro installs fail early with actionable Chinese messages.
- Added runtime-driven readiness issues so the workbench can show current blockers and jump users to the right panel instead of relying on raw error text.
- Added a primary readiness callout in the workbench hero so the top of the console now offers a direct next action instead of only static instructions.
- Added registry-backed Kiro install discovery so non-standard Windows install paths can still be detected after static path checks miss.
- Extended exported diagnostics summaries with readiness issue counts, the primary blocker, and per-issue action hints for easier sharing and support.
- Added one-click diagnostics file export through the desktop bridge so users can save a timestamped local support snapshot without manual copy/paste.
- Expanded the exported support snapshot to include recent redacted request entries and surfaced the saved file path back into the workbench status detail.
- Added parallel JSON export alongside the text snapshot so support data can be consumed programmatically while still remaining redacted and local-first.
- Reshaped support export into a timestamped bundle directory containing `summary.txt`, `snapshot.json`, and `recent-requests.json` for cleaner handoff and future automation.
- Added `manifest.json` plus a desktop open-path bridge so exported support bundles are self-describing and can be opened directly from the workbench.
- Added `README.txt` and richer snapshot JSON fields (`proxyStatus`, `kiroDetection`, `diagnose`) so support bundles are easier to interpret without reading source code.

Verification:
- `npm test` passes with 46 tests.
- `npm run typecheck` succeeds.
- `npm run desktop:build` succeeds.
- Local static serving of `desktop/renderer/dist` returns HTTP 200 on `http://127.0.0.1:4191/`.

## Backlog

- V2.1: true OpenAI-compatible SSE passthrough into Kiro event-stream frames.
- V2.1: optional provider preset catalog import from Cursor++ style model catalogs.
- V3.1: verify the `Launch Kiro with Kiro++` packaged entry on a clean Windows machine.
- V3.1: replace preview-only pages with screenshot assets captured from the real Electron app.
- Epic 8: prepare the first GitHub Release assets and screenshot bundle after final smoke.
- Epic 9: capture fresh screenshots from the real Electron shell after provider keys are available for end-to-end smoke.
