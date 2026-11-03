#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

if [[ -x .venv/bin/python ]]; then
    PYTHON_BIN="$PROJECT_ROOT/.venv/bin/python"
elif command -v python3.12 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3.12)"
elif command -v uv >/dev/null 2>&1; then
    uv python install 3.12
    PYTHON_BIN="$(uv python find 3.12)"
else
    echo "Python 3.12 is required. Install it or install uv (https://docs.astral.sh/uv/) and retry." >&2
    exit 1
fi

"$PYTHON_BIN" - <<'PY'
import platform
import struct
import sys

if sys.version_info[:2] != (3, 12):
    raise SystemExit(f"Python 3.12 required, found {platform.python_version()}")
if struct.calcsize("P") * 8 != 64:
    raise SystemExit("A 64-bit Python is required")
print(f"Python: {platform.python_version()} ({platform.architecture()[0]})")
PY

if [[ ! -x .venv/bin/python ]]; then
    "$PYTHON_BIN" -m venv .venv
fi

PYTHON="$PROJECT_ROOT/.venv/bin/python"
"$PYTHON" -m pip install --upgrade pip
"$PYTHON" -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
"$PYTHON" -m pip install -r requirements.txt
"$PYTHON" -m pip install -e "$PROJECT_ROOT/local_runtime"
"$PYTHON" -m pip check
"$PYTHON" - <<'PY'
import platform
import torch

print(f"Python: {platform.python_version()}")
print(f"PyTorch: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    raise SystemExit("Expected a CPU-only PyTorch build")
PY
.venv/bin/qwen-tts-demo --help

echo "Setup checks passed. Start the local API with: ./scripts/start-local-runtime-linux.sh"
echo "Start the web app with: cd web && npm ci && npm run dev -- --host 127.0.0.1"
