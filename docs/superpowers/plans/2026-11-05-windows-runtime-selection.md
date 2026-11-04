# Windows Runtime Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect the web app to the installed Windows runtime first so RAM readings come from Windows even if WSL is running.

**Architecture:** Windows backend uses port 8766 and reports its OS in health. The web client probes 8766 first and validates Windows identity. Local development may fall back to WSL on 8765; deployed pages reject Linux or unidentified runtimes. Linux defaults remain unchanged.

**Tech Stack:** Python/FastAPI, PowerShell, React/TypeScript/Vite, unittest, Vitest, Inno Setup.

**Spec:** `docs/superpowers/specs/2026-11-05-windows-runtime-selection-design.md`

## Global Constraints

- Preserve local-only recording, model, and generated-audio data.
- Do not terminate a WSL process to make the Windows port available.
- Keep Linux runtime default port 8765 and allow its fallback only in development builds.
- Report Windows RAM using `GlobalMemoryStatusEx` in the Windows process.

## Review Focus

- When Windows and WSL are both healthy, the UI must choose Windows first.
- When only WSL is healthy, local development must retain the legacy 8765 flow.
- A deployed page must refuse a Linux or unidentified runtime rather than display its memory as Windows memory.
- When a service on 8766 is not the Windows runtime, the UI must not select it.
- The Windows launcher must health-check and launch on 8766.
- Paired API calls after discovery must use the selected port.

---

### Task 1: Runtime identity and Windows launcher port

**Files:**
- Modify: `local_runtime/app/main.py`
- Modify: `scripts/windows/start-local-voice.ps1`
- Test: `local_runtime/tests/test_api_security.py`

- [x] Add a health API assertion that returns the current platform OS.
- [x] Run the focused API health test and confirm it fails on the missing `os` field.
- [x] Add `os: platform.system()` to `/api/v1/health`.
- [x] Set the Windows launcher port and health checks to 8766.
- [x] Run the focused API test and parse the PowerShell launcher.

### Task 2: Windows-first browser discovery

**Files:**
- Modify: `web/src/api/localRuntime.ts`
- Test: `web/src/api/localRuntime.test.ts`

- [x] Add tests for Windows-first selection, development-only WSL fallback, production WSL rejection, and paired calls following the selected base URL.
- [x] Run these tests and confirm the current single-port client fails them.
- [x] Implement ordered health probing (8766 Windows, then 8765 fallback) and keep subsequent requests on the selected URL.
- [x] Run focused Vitest tests.

### Task 3: Build and delivery

**Files:**
- Rebuild: `web/public/install/windows/VoiceStudioSetup.exe`

- [x] Run focused runtime tests, `git diff --check`, and web build.
- [x] Compile the Windows installer and verify the launcher source packaged at build includes 8766.
- [ ] Commit scoped files and push `master` to trigger Vercel production deployment.
- [ ] Verify the deployment is Ready and the public installer matches the built EXE.
