# User-Centered Screen Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make every existing Voice Studio screen readable, task-centered, and consistent with the WindSoft design system.

**Architecture:** Keep the current React routes and local-runtime boundary. Adopt WindSoft semantic typography/components for shared text, cards, forms, and actions; retain custom styling only for audio-specific and story-scene visuals. Refine each route's copy and hierarchy without changing runtime behavior.

**Tech Stack:** React 19, TypeScript, Vite, `@windsoft/ui` 0.9.0, Vitest, Playwright Chromium.

**Spec:** `docs/superpowers/specs/2026-11-04-user-centered-screen-design.md`

## Global Constraints

- Keep voice recordings, text, model inference, and generated WAV files on the user's PC.
- Do not add dependencies or change deployment/runtime architecture.
- Preserve existing route behavior and audio controls.
- Use a 16px root size and WindSoft semantic typography roles: 24/18/14/13/12px.
- Do not use text below 14px for user-facing content, labels, or controls.

## Review Focus

- Mobile widths: no clipped labels, card overflow, or inaccessible primary actions.
- First-use state: no future installation action or pairing field appears before its step.
- Missing recordings/model/runtime: each empty state provides one clear next action.
- Long Korean story/transcript: text remains readable and wraps without horizontal overflow.
- Pending/failed audio jobs: status, retry/cancel, and result actions remain understandable.

---

### Task 1: Shared typography and page shell

**Files:**
- Modify: `web/src/styles.css`
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/AppShell.tsx`
- Test: `web/src/App.test.tsx`

- [x] Add assertions for the shared page heading and user-facing navigation labels.
- [x] Use WindSoft `Typography` variants for shared page title, description, and kicker; set root size to 16px and remove local font overrides that shrink WindSoft card/form typography.
- [x] Normalize app-shell labels and common metadata to WindSoft semantic roles.
- [x] Run the targeted tests and inspect desktop/mobile shell rendering.

### Task 2: Recording and saved recordings

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/features/recorder/Recorder.tsx`
- Modify: `web/src/styles.css`
- Test: `web/src/App.test.tsx`, `web/src/features/recorder/Recorder.test.tsx`

- [x] Pin the recording order: choose/read a script → check mic → record → preview → save.
- [x] Replace technical labels with user-facing Korean while preserving control behavior and warnings.
- [x] Rename the saved-voice route's content to describe saved recordings accurately and keep playback/deletion clear.
- [x] Run targeted tests and render recording/empty/list states.

### Task 3: Story, generation, and results

**Files:**
- Modify: `web/src/features/storybook/StorybookPage.tsx`
- Modify: `web/src/features/generation/GenerationWorkspace.tsx`
- Modify: `web/src/features/results/AudioOutputCard.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/styles.css`
- Test: related `*.test.tsx` files under `web/src`

- [x] Keep one obvious action on story selection and scene preview; clarify that the story script proceeds to generation.
- [x] Group generation inputs in the order users make decisions and surface model readiness before the primary generate action.
- [x] Put replay and WAV download before technical generation metadata in each result.
- [x] Run targeted tests and render story, generation, pending, and result states.

### Task 4: Setup and settings

**Files:**
- Modify: `web/src/components/Onboarding/SetupScreen.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/styles.css`
- Test: `web/src/App.test.tsx`

- [x] Keep setup actions sequential and show only the current task.
- [x] Group installation/connection, PC resources, and privacy/storage by user purpose.
- [x] Keep the browser installation limitation explicit without exposing multiple competing setup routes at once.
- [x] Run targeted tests and render first-use, connected, and installed-model states.

### Task 5: Full-route visual verification

**Files:**
- No source changes unless verification reveals a defect.

- [x] Run the full web test suite and production build.
- [x] Capture all six routes at 1440×1000 and 390×844 using the same data states.
- [x] Check typography hierarchy, primary action visibility, and horizontal overflow; fix any discovered task-scope defects.
- [x] Leave the Linux Vite server running with the updated screen.

---

### Task 6: WindSoft template adoption and target-PC completion gate

**Files:**
- Modify: `web/src/features/storybook/StorybookPage.tsx`, `web/src/App.tsx`, `web/src/components/Onboarding/SetupScreen.tsx`, `web/src/styles.css`.
- Modify: `web/public/install/windows-wsl.md`, `README.md`, `RUN_LOG.md`.
- Create: `docs/development/DEVELOPMENT_COMPLETE.md`.
- Test: `web/src/App.test.tsx`, `web/src/features/storybook/StorybookPage.test.tsx`.

- [x] Query WindSoft MCP templates/tokens and map the PC install steps to `WizardForm`, the visual story picker to `ProductGrid`, settings sections to `SettingsPage`, and keep microphone/story-player controls purpose-built.
- [x] Replace hardcoded screen colors, font roles, focus colors, radii, and card shadow with WindSoft semantic tokens.
- [x] Make the setup flow target Windows from the deployed HTTPS page, provide the matching repository ZIP and guide, and place the current page origin in the PowerShell launch command.
- [x] Document the order Vercel Preview → Windows PC install → local pairing and permissions → real microphone recording → save/reload/playback → local-only network review.
- [x] Run the complete web test suite/build and inspect the updated template layouts at desktop/mobile sizes.
- [x] Deploy the current site and verify its HTTP response; record the actual Production target and unpinned working-tree source in `RUN_LOG.md`.
- [ ] Complete manual Windows PC installation, pairing, physical microphone recording, and saved-recording playback; record device evidence in `RUN_LOG.md`. The Vercel ZIP/source revision match must also be resolved before final acceptance.
