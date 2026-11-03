#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

DEMO="$PROJECT_ROOT/.venv/bin/qwen-tts-demo"
if [[ ! -x "$DEMO" ]]; then
    echo "The demo is not installed. Run ./scripts/install-linux.sh first." >&2
    exit 1
fi

mkdir -p logs
LOG_FILE="$PROJECT_ROOT/logs/demo-$(date '+%Y%m%d-%H%M%S').log"
echo "Starting Qwen3-TTS Base at http://127.0.0.1:8000"
echo "Console log: $LOG_FILE"
echo "Keep this terminal open. The first start downloads the public model checkpoint."

"$DEMO" 'Qwen/Qwen3-TTS-12Hz-0.6B-Base' \
    --device cpu \
    --dtype float32 \
    --no-flash-attn \
    --concurrency 1 \
    --ip 127.0.0.1 \
    --port 8000 \
    --no-share 2>&1 | tee "$LOG_FILE"
