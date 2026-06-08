# Project: kiro++ BYOK Router

Status: UI Refresh In Progress
Priority: High
Created: 2026-05-25
Updated: 2026-06-08

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
- Replaced renderer-side export directory lookup via status text parsing with explicit export bundle state to make the diagnostics actions reliable in packaged builds.
- Added one-click zip support bundle export so Windows users can share a single diagnostics archive instead of a raw folder tree.
- Redacted local filesystem paths inside exported diagnostics summaries, snapshots, and manifests so support bundles are safer to post publicly.
- Added a structured "latest support bundle" panel in the workbench so exported diagnostics are surfaced as product feedback instead of raw status text.
- Added direct open actions for exported `summary.txt`, `snapshot.json`, `manifest.json`, and `recent-requests.json` so support bundles can be inspected without manual file hunting.
- Promoted support bundle `exportedAt` and `bundleName` into first-class runtime return fields so the renderer no longer has to infer export timing from action history.
- Promoted the latest exported support bundle into `AppState` so the workbench can recover the last export result on refresh instead of keeping it only in renderer-local state.
- Persisted the latest exported support bundle metadata into desktop app settings so support bundle cards can survive a full app restart instead of only a runtime refresh.
- Extended support bundle persistence to keep a short most-recent-first history so users can switch between the latest few exports after refresh or restart.
- Added a non-destructive "clear support bundle history" action so repeated smoke tests can reset exported-bundle state without removing local export files.
- Persisted the currently selected support bundle history item so reopening the desktop app can return to the same historical snapshot instead of always falling back to the latest export.
- Added single-item support-bundle history removal so operators can prune stale records without wiping the whole history or touching exported files on disk.
- Persisted the latest `Launch Kiro with Kiro++` attempt state so packaged-start failures now leave a visible record instead of disappearing into a silent startup path.
- Added a dedicated launch status card to the workbench so users can see which step failed across detect/proxy/routing/launch without re-running the flow blindly.
- Wired `autoApplyOnLaunch` into real desktop bootstrap behavior so opening the app can now auto-start the proxy and re-apply BYOK when the user enables that preference.
- Added a workbench toggle for startup auto-apply so the behavior is user-visible and configurable instead of remaining a dormant settings field.
- Fixed the actual startup wiring so Electron now triggers `runtime.bootstrap()` on app ready and the renderer's first state fetch also goes through bootstrap instead of bypassing the auto-apply path.
- Split startup preheat visibility from manual Kiro launch visibility by recording a separate bootstrap attempt state, so users can tell whether startup auto-apply failed before they ever touched the launch button.
- Limited renderer bootstrap calls to first load only; later refreshes now use plain `getState()` so routine UI refreshes do not re-trigger startup auto-apply behavior.
- Reworked desktop documentation resource lookup to stop depending on `process.cwd()` alone and to cover packaged `resources\\docs` installs alongside development-path fallbacks.
- Rewrote README toward the real Windows desktop product flow and added a focused desktop quickstart so the packaged app now has user-facing setup, preheat, support-bundle, and troubleshooting guidance that matches the current implementation.
- Wired the new desktop quickstart guide into the in-app documentation entry list so packaged builds can open a first-run guide directly instead of sending new users to the broader README first.
- Promoted the quickstart guide higher in the UI by adding direct entry buttons on the home hero and diagnostics rail, reducing the chance that first-run users miss the shortest supported setup path.
- Embedded a compact quickstart summary directly into the home hero stack and the main workspace so first-run users can see the shortest supported sequence without leaving the app surface at all.
- Replaced the static quickstart copy with a renderer-side dynamic checklist derived from real app state, so home and workspace now point users at the current blocking step instead of repeating fixed setup text.
- Extracted the quickstart state derivation into a shared module with direct tests, keeping the UI guidance reusable and reducing pressure on the already-large renderer entry file.
- Upgraded quickstart actions from pure navigation into executable next-step buttons, reusing the existing provider fetch, provider test, proxy start, BYOK enable, route apply, and diagnose flows instead of sending users through extra manual clicks.
- Added quickstart progress summarization so the home hero and workbench hero now expose completed-step counts, a visible progress bar, and a direct “continue setup” action instead of burying onboarding status inside the checklist cards alone.
- Added a dedicated setup banner in the workbench hero so incomplete installs now read as an explicit first-run mode with a tighter call to continue setup, while completed installs flip that same surface into a “ready to use” state.
- Promoted setup mode awareness into the global workbench top bar so the app now exposes a compact `Setup Mode` / `Ready` state and next-step action even before users read the hero content.
- Removed the last static onboarding step block from the home view and replaced it with the same live quickstart checklist data used elsewhere, so the landing page no longer drifts away from real runtime state.
- Taught the top-level launch entry to respect setup mode, so users who have not finished the minimum onboarding path are now routed to the next required setup action instead of hitting the Kiro launch flow prematurely.
- Collapsed the scattered step strip and inline quickstart cards into a dedicated setup workspace surface when onboarding is still incomplete, reducing visual competition and making the workbench read more like a focused first-run path.
- Made the right-hand validation rail setup-aware as well, so incomplete onboarding now swaps the usual Playground/diagnostics stack for a smaller setup guidance rail instead of encouraging premature validation attempts.
- Reduced lower-workspace noise during setup mode by hiding launch/bootstrap history cards and the full workbench tab surface until the minimum onboarding path is complete, keeping the center column focused on state, routing, and blockers first.
- Tightened the left Kiro control panel during setup mode as well, promoting proxy/BYOK/diagnose actions while delaying stop/restore-style maintenance actions until the minimum onboarding path is complete.
- Added renderer-side availability rules for key Kiro actions so setup-mode buttons can now disable themselves with concrete reasons when proxy state, Kiro detection, BYOK state, or backup availability are not ready yet.
- Extended the same availability approach into Provider actions so fetch/test now disable themselves when Base URL, models, or default model state is invalid instead of failing only after click.
- Added visible inline blocker hints below the Provider and Kiro action clusters so first-run users can see why the next action is unavailable without relying on hover-only tooltips.
- Added a setup-workspace blocker summary that prioritizes runtime readiness issues first and otherwise falls back to pending quickstart steps, so first-run users now see a single “what is blocking me now” surface before scanning the rest of the workbench.
- Fixed desktop provider rename persistence so changing `provider id` now replaces the old profile entry instead of leaving both old and new ids in settings.
- Fixed desktop secret migration during provider rename so an existing saved API key now follows the new `provider id` even when the user only renames the profile without re-entering the key.
- Rewrote the top-level README into a public-release Chinese-first product entry, aligning the repo with the current desktop-console positioning and explicitly documenting the Cursor++-inspired BYOK/product direction.
- Updated release-facing docs so LinuxDO post copy, release verification notes, and a dedicated manual smoke/screenshot checklist now reflect the current packaged artifact, current automated test count, and the remaining manual Kiro validation gap.

Verification:
- `npm test` passes with 93 tests.
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
