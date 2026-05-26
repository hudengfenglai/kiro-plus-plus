# Project: kiro++ BYOK Router

Status: V3.1 In Progress
Priority: High
Created: 2026-05-25
Updated: 2026-05-26

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

## Active Task

Task: V3.1 personal developer productization pass

Status: Completed

Acceptance:
- Desktop dependencies are installed and locked for renderer, shell, and packaging work.
- Desktop runtime owns BYOK enable / disable semantics, diagnostics export, and launch-with-proxy behavior.
- Renderer uses the real desktop runtime and no longer depends on preview pages as the main product path.
- Built-in provider presets cover the domestic high-frequency BYOK routes.
- README is install-first and reflects desktop packaging.
- NSIS Windows installer is generated successfully.

Verification:
- `npm install` completed and the workspace now includes Electron, Vite, React, keytar, and electron-builder.
- `npm test` passes with 40 tests.
- `npm run desktop:build` succeeds and emits the renderer bundle.
- `npm run desktop:package` succeeds and emits `release/kiro-plus-plus-0.1.0-x64.exe`.
- The desktop package build needed `win.signAndEditExecutable=false` to avoid the local symlink privilege issue in the cached `winCodeSign` extraction step.
- The packaged app now uses the copied Kiro icon asset and includes an explicit `author` field to avoid Electron default icon and missing author warnings.
- `website/` is now rewritten into a Chinese LinuxDO-facing landing page and `npm run build` in `website/` succeeds.
- Browser smoke on `http://127.0.0.1:4181/` confirms the landing page title, hero, provider section, CTA anchors, and copy-button state.

## Backlog

- V2.1: true OpenAI-compatible SSE passthrough into Kiro event-stream frames.
- V2.1: optional provider preset catalog import from Cursor++ style model catalogs.
- V3.1: verify the `Launch Kiro with Kiro++` packaged entry on a clean Windows machine.
- V3.1: replace preview-only pages with screenshot assets captured from the real Electron app.
- V3.1: initialize a public GitHub remote and push the first source snapshot once `gh` or equivalent GitHub push credentials are available.
