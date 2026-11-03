#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="$PROJECT_ROOT/.venv/bin/python"

if [[ ! -x "$PYTHON" ]]; then
    echo "Python environment not found. Run ./scripts/install-linux.sh first." >&2
    exit 1
fi

if ! "$PYTHON" -c 'import fastapi, uvicorn' >/dev/null 2>&1; then
    echo "Local runtime dependencies are missing. Install the runtime package first." >&2
    exit 1
fi

cd "$PROJECT_ROOT"
echo "Starting Voice Studio local runtime on 127.0.0.1:${LOCAL_VOICE_PORT:-8765}"
"$PYTHON" -m local_runtime.app
