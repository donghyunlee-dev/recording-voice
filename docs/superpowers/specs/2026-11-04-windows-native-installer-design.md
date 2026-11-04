# Windows Native Voice Studio Installer

## Intent

Let a Windows 10/11 user install and run the local Voice Studio backend without WSL, Docker, a source ZIP, or terminal commands. The website must detect the running backend, let the user connect it, show the existing licensed Qwen model download progress, and enter the recording experience after the model is ready.

## Goals

- Provide a downloadable Windows installer with a normal setup wizard.
- Install a private, user-scoped Python 3.12 runtime and the local API dependencies.
- Start the backend after installation and at the user's next sign-in; bind only to loopback.
- Detect backend readiness in the website and connect after an explicit user click, without a terminal pairing code.
- Keep Qwen model installation in the website with license acknowledgement, progress, cancellation, and retry. Do not bundle model weights in the installer.
- Keep model, recordings, transcripts, outputs, and logs in persistent per-user Windows directories.
- Make the recording experience available after backend connection and model installation.

## Non-goals

- Docker Desktop, WSL, Java inference, administrator-wide installation, automatic model download before license acknowledgement, model bundling, or public network listeners.
- Claiming Windows microphone, installation, or CPU inference acceptance from Linux-only checks.

## Approaches

1. **Windows-native Python backend with a setup wizard (chosen):** preserves the existing FastAPI/Qwen implementation and avoids the WSL VM memory cap. The installer prepares Python and dependencies; the model remains a separate, visible download.
2. **Linux container through Docker Desktop:** rejected because Docker Desktop on Windows still uses WSL2 for Linux containers and adds a separate runtime prerequisite without solving the memory limit.
3. **Java backend:** rejected because Qwen inference still needs its Python/PyTorch runtime, adding a process boundary without removing the memory requirement.

## Behavior and security

- The website offers the installer download. The user opens the downloaded installer; browsers do not launch downloaded executables automatically.
- The installer sets up the backend, launches it, and registers user-level startup. It does not install model weights.
- The website checks loopback health after the user asks it to find the installed app. Once found, an explicit **이 PC에 연결** action requests browser local-network permission and creates a session. Auto-pairing is enabled only in installer mode, requires an exact configured Origin, a loopback Host, and a browser-origin request. The existing one-time-code path remains available for developer runs.
- After connection, the existing model setup screen remains a required step. The user acknowledges the model license and sees download progress before entering the app, which opens on recording.
- The service listens on `127.0.0.1` only. No LAN binding, wildcard CORS, silent installer elevation, or destructive upgrades.

## Resource and data behavior

- Windows system RAM and currently available memory must be reported through Windows APIs. Linux continues to use `/proc/meminfo`.
- The model preflight remains based on at least 5.7 GiB available before first load. The check must use the runtime's actual OS resource view.
- Application data/logs use `%LOCALAPPDATA%\VoiceStudio`; the Hugging Face cache uses a persistent per-user cache. Uninstalling the application preserves recordings and model files unless the user deletes them separately.

## Acceptance

- Python unit tests cover Windows memory/path behavior and code-free pairing restrictions; existing one-time pairing and wrong-origin protections stay intact.
- Frontend tests cover backend detection, explicit connection, model-download gating, and entry to recording after model installation.
- The installer can be built as a Windows executable and its script/configuration is reproducible from the repository.
- A real Windows 10/11 acceptance run must install, start, detect, connect, download the model, record from a physical microphone, save/reload/play the recording, and exercise Qwen generation before claiming full Windows support.
