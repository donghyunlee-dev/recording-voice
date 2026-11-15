# Windows installer

`VoiceStudio.iss` builds the user-scoped Windows setup wizard with Inno Setup 6.7 or newer. From the repository root, compile it with:

```powershell
& "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe" installer/windows/VoiceStudio.iss
```

The installer output is `web/public/install/windows/VoiceStudioSetup.exe`, matching the onboarding download URL. The installer contains the backend source and private-runtime bootstrap. Setup uses the official Python Install Manager to extract the latest Python 3.12 runtime into the app directory, then downloads CPU-only PyTorch dependencies. A manager installed by this setup is removed after extraction; a manager already present on the PC is left in place. Qwen model weights are not included. The optional expressive-engine task installs a separate Python environment and downloads the pinned multilingual model and segmenter assets (about 3.3 GB of model files). Setup shows dependency installation output while the backend is prepared.

The backend and Python environment are installed under the selected per-user application directory. Recordings, transcripts, generated audio, logs, and Hugging Face cache live under `%LOCALAPPDATA%\VoiceStudio` and are preserved on uninstall. The installer creates a per-user startup entry and only removes the backend process it launched.

This source installer can be compiled on Windows. Before publishing it, run it on a clean Windows 10/11 x64 account, verify backend health and website pairing, and capture installer plus uninstaller behavior. Real microphone recording and Qwen inference require a Windows PC with adequate available memory and are not proven by an installer build.

Before compiling a release, build the runtime wheel and verify it outside the source directory:

```powershell
python -m pip wheel --no-deps ./local_runtime --wheel-dir ./release-wheels
python scripts/verification/runtime-package.py ./release-wheels/local_voice_runtime-0.3.1-py3-none-any.whl
```

Run this with the prepared runtime Python environment. The verification starts only a temporary loopback server with isolated storage. It checks packaged code startup and required studio capabilities; it does not install dependencies or replace the installed app. Build and egg-info artifacts are excluded from the setup package.
