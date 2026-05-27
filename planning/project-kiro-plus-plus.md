# Project: kiro++ BYOK Router

Status: UI Refresh In Progress
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

Verification:
- `npm test` passes with 40 tests.
- `npm run desktop:build` succeeds.
- `npx tsc -p tsconfig.json --noEmit` succeeds.
- Local static serving of `desktop/renderer/dist` returns HTTP 200 on `http://127.0.0.1:4191/`.

## Backlog

- V2.1: true OpenAI-compatible SSE passthrough into Kiro event-stream frames.
- V2.1: optional provider preset catalog import from Cursor++ style model catalogs.
- V3.1: verify the `Launch Kiro with Kiro++` packaged entry on a clean Windows machine.
- V3.1: replace preview-only pages with screenshot assets captured from the real Electron app.
- Epic 8: push the first public source snapshot once the GitHub remote exists and local credentials are available.
- Epic 9: capture fresh screenshots from the real Electron shell after provider keys are available for end-to-end smoke.
