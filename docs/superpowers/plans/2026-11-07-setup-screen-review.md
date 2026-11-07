# Setup Screen Review Implementation Plan

> **For agentic workers:** Inline execution is authorized by the user. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the startup/connect screen’s title and controls with the detected Windows runtime state, removing redundant explanatory copy.

**Architecture:** Keep runtime detection, pairing, and install behavior intact. Make one state-specific page title, represent each state with a visible icon/progress indicator, and retain only actionable labels plus accessible error/status text.

**Tech Stack:** React 19, TypeScript, Vite, `@windsoft/ui`, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-05-visual-first-screen-improvement-map.md` (RV-01 and RV-02)

## Global Constraints

- Keep runtime detection, pairing, and installation links functional.
- Show installation guidance only when the local app is not detected or the user selects it.
- Keep the page title synchronized with the current setup state and avoid duplicate state headings.
- Retain accessible names for status, progress, errors, and controls.
- Do not alter recording, generation, or local data behavior.

## Review Focus

- Runtime health resolves successfully on first load: show detected state and connect action.
- Runtime health is unavailable: show retry and install actions without a misleading connected title.
- Install is selected: keep installer and guide links usable while removing redundant instruction paragraphs.
- Runtime health request is pending: expose progress accessibly and prevent duplicate state headings.
- Narrow viewport: keep the title, state indicator, and primary action visible without horizontal overflow.

---

### Task 1: State-driven setup screen

**Files:**
- Modify: `web/src/components/Onboarding/SetupScreen.tsx`
- Modify: `web/src/styles.css`
- Create: `web/src/components/Onboarding/SetupScreen.test.tsx`

**Interfaces:**
- Consumes: `getRuntimeHealth()` and the existing `onPair(code?)` setup callback.
- Produces: one `<h1>` whose text matches the setup stage, a stage icon/progress element, and the existing stage-appropriate actions.

- [x] Add behavior assertions for runtime-detected and runtime-unavailable screen states.
- [x] Run the focused setup screen test and confirm it fails on the current static title/duplicate heading.
- [x] Make the title state-driven, remove the duplicate card heading and non-actionable helper paragraphs, and add shape-based state indicators with accessible labels.
- [x] Run the focused setup screen test, the web test suite, and `npm run build`.
- [x] Inspect the setup screen at desktop and narrow browser widths using Windows Agent Desktop MCP. The local Windows runtime was unavailable in this browser session, so visual inspection covered the unavailable state; the deployed runtime-ready transition had already been verified separately.

**Validation:** `npm test` passed (31 tests); `npm run build` passed. Windows Chrome MCP captures at 1920 px and 650 px outer width showed a centered status card and both actions within the narrow viewport, with no horizontal clipping. Focused coverage includes the in-progress pairing title and recoverable pairing error.
