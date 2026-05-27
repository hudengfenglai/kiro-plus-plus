# Project: kiro++ BYOK Router

Status: Release Prep In Progress
Priority: High
Created: 2026-05-25
Updated: 2026-05-27

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

## Active Task

Task: Public release readiness pass

Status: In Progress

Acceptance:
- Public repo excludes `website/` and temporary favicon conversion files.
- README and release docs are aligned to public release wording.
- Release verification records package output, routing diagnosis, and Kiro request evidence.
- A release-prep commit is ready for pushing to a public GitHub repo.

Verification:
- `npm test` passes with 40 tests.
- `npm run desktop:build` succeeds.
- `npm run desktop:package` succeeds and emits `release/kiro-plus-plus-0.1.0-x64.exe`.
- `node .\src\cli\main.js diagnose` reports 8 local regions, no missing regions, no Auto-mode block, and no unsupported operations.
- `.\.kiro-plus-plus\requests.jsonl` contains real Kiro traffic hitting `GetUsageLimits`, `ListAvailableModels`, `InvokeMCP`, and `GenerateAssistantResponse`.
- A fresh real-provider smoke is still pending because no reusable Provider API key is currently present in the desktop secret store or shell environment.

## Backlog

- V2.1: true OpenAI-compatible SSE passthrough into Kiro event-stream frames.
- V2.1: optional provider preset catalog import from Cursor++ style model catalogs.
- V3.1: verify the `Launch Kiro with Kiro++` packaged entry on a clean Windows machine.
- V3.1: replace preview-only pages with screenshot assets captured from the real Electron app.
- Epic 8: push the first public source snapshot once the GitHub remote exists and local credentials are available.
