# Windows Runtime Selection Design

## Intent

Ensure the Vercel UI connects to the installed Windows backend and reports host Windows memory even when a WSL runtime is also listening locally.

## Approaches

- Keep both runtimes on port 8765 and ask users to stop WSL manually: rejected because Windows setup can mistake any healthy service for its backend.
- Give Windows its own port (`8766`) and have the UI discover it before the WSL developer port (`8765`): selected because it avoids port ownership ambiguity and preserves the existing WSL workflow.

## Behavior

- Windows installer launches the backend on `127.0.0.1:8766`; WSL continues using `127.0.0.1:8765` by default.
- Health responses include the runtime OS. The browser probes Windows first and selects it only when health reports Windows. Only local development builds may fall back to WSL; deployed pages reject Linux or unidentified runtimes.
- All paired API requests use the selected runtime base URL. The settings page already displays the OS and memory reported by that runtime.

## Constraints

- Keep runtime data, model cache, and API authentication local as before.
- Do not stop or alter a separate WSL process.
- Preserve the Linux default port and local developer flow.
- Windows memory is taken from `GlobalMemoryStatusEx` inside the Windows backend process.
