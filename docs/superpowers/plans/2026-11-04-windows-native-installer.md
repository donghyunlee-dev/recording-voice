# Windows Native Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace WSL-only consumer setup with a Windows installer that starts a native local backend, is detected and connected from the website, downloads the licensed model in the UI, then opens recording.

**Architecture:** Keep FastAPI/Qwen in Python and add Windows-specific paths, resource reporting, and installer startup support. An installer-mode backend permits an explicit, exact-Origin browser connection without terminal codes; the website health-checks it and keeps the existing model download as a required onboarding step.

**Tech Stack:** Python 3.12, FastAPI, React/TypeScript/Vite, PowerShell, Inno Setup.

**Spec:** `docs/superpowers/specs/2026-11-04-windows-native-installer-design.md`

## Global Constraints

- Windows 10/11 x64; no WSL, Docker, Java, administrator-wide install, or terminal commands in the consumer flow.
- Backend listeners bind only to loopback; configured web Origins are exact, never wildcard.
- Qwen model weights are not bundled and are downloaded only after explicit license acknowledgement.
- Keep the current one-time pairing path for developer/Linux runs.
- Preserve user recordings and model cache when uninstalling the application.
- The model remains required before entering the recording app; recording is the initial route after setup.

## Review Focus

- An untrusted or absent `Origin` cannot obtain an auto-pair session; test installer-mode pairing with missing, wrong, and allowed Origins.
- Backend health checks do not bypass explicit user connection; test detected-but-not-connected and successful connection states.
- Model download failure, cancellation, and missing license acknowledgement do not enter the recording app; pin these transitions in frontend/API tests.
- Windows memory is not reported as unknown or as Linux `/proc` memory; test Windows API parsing and Linux behavior independently.
- Installer upgrade/uninstall does not remove recordings or model cache; validate installer directives and path contracts.

---

### Task 1: Make runtime paths and resource checks Windows-safe

**Files:**
- Create: `local_runtime/tests/test_windows_platform.py`
- Modify: `local_runtime/app/system_info.py`
- Modify: `local_runtime/app/main.py`
- Modify: `local_runtime/app/generation.py`
- Modify: `local_runtime/app/storage.py` (only if a shared platform data-path helper is needed)

**Interfaces:**
- Produce `memory_available_gib(...)` and `memory_total_gib(...)` behavior for Windows and Linux; retain Linux `/proc` test injection.
- Peak RSS collection must not import the Unix-only `resource` module on Windows.

- [x] Write Windows API parsing tests and a regression test proving importing the runtime does not require `resource` on Windows.
- [x] Run the focused Python tests and confirm they fail for the current Linux-only implementation.
- [x] Implement the minimum platform-specific memory, data-directory, and peak-RSS behavior.
- [x] Run focused and full Python tests; verify Linux reporting is unchanged.

### Task 2: Add secure installer-mode browser pairing and readiness contracts

**Files:**
- Modify: `local_runtime/app/security.py`
- Modify: `local_runtime/app/main.py`
- Modify: `local_runtime/tests/test_pairing.py`
- Modify: `local_runtime/tests/test_api_security.py`

**Interfaces:**
- Installer mode is controlled by `LOCAL_VOICE_AUTO_PAIR=1`.
- `POST /api/v1/pair` without a code may create a session only in installer mode with an allowed, present Origin and the expected loopback Host.
- Developer mode continues requiring the one-time code.

- [x] Add tests for allowed, missing, and hostile Origins in installer mode and for required codes in developer mode.
- [x] Run focused tests and confirm the new installer-mode cases fail.
- [x] Implement one-time session creation and fail-closed request checks.
- [x] Run all Python tests (32 passed).

### Task 3: Detect, connect, and gate onboarding in the website

**Files:**
- Modify: `web/src/api/localRuntime.ts`
- Modify: `web/src/api/localRuntime.test.ts`
- Modify: `web/src/components/ConnectionStatus.tsx`
- Modify: `web/src/components/ConnectionStatus.test.tsx`
- Modify: `web/src/components/Onboarding/SetupScreen.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/App.test.tsx`

**Interfaces:**
- Add a browser health-poll helper used after the user confirms the installer has finished.
- Replace the consumer terminal-code field with detected status and an explicit connect action; retain a developer pairing surface only where needed.
- Keep model setup as a required onboarding stage; successful model installation enters the app at the recording route.

- [x] Add tests for installer detection, explicit connection, and recording entry only after model installation.
- [x] Run affected web tests and confirm the new cases fail.
- [x] Implement the health-detection/connect steps while preserving the existing model licence/progress/cancel UI.
- [x] Run the full web test suite (23 passed) and production build.

### Task 4: Build the user-scoped Windows installer and launch lifecycle

**Files:**
- Create: `installer/windows/VoiceStudio.iss`
- Create: `installer/windows/README.md` (build instructions and exact release output name)
- Create/modify: `scripts/windows/install-local-voice.ps1`
- Create/modify: `scripts/windows/start-local-voice.ps1`
- Modify: `web/src/components/Onboarding/SetupScreen.tsx` (installer asset URL and install-complete action)
- Modify: `web/public/install/windows-wsl.md` (replace obsolete WSL guide with native installer guide)
- Modify: `README.md`

**Behavior:**
- Install Python 3.12 and application dependencies under the current user, configure the exact production Origin, persist data under `%LOCALAPPDATA%\VoiceStudio`, start the runtime, and launch on subsequent sign-ins.
- Bind the backend to `127.0.0.1:8765`; write safe diagnostics to a local rotating log without audio, transcript, or token contents.
- Uninstall removes app/runtime registration but preserves model and user data.

- [x] Implement PowerShell bootstrap/launcher, bounded uninstall behavior, and the Inno Setup wizard.
- [x] Compile `VoiceStudioSetup.exe` on Windows and parse the scripts with Windows PowerShell 5.1.
- [ ] Verify clean-account install, backend health/restart, and uninstall preservation on a Windows test PC.
- [x] Replace consumer-facing WSL/ZIP/PowerShell-command instructions and link the built installer.
- [x] Run `git diff --check`; document Windows hardware acceptance still requiring a physical microphone and model inference.
