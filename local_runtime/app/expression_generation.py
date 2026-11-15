from __future__ import annotations

import json
import logging
import os
import subprocess
import tempfile
import time
from collections.abc import Callable
from pathlib import Path

from .expression_worker import validate_request

WORKER_PATH = Path(__file__).with_name('expression_worker.py')


class ExpressionGenerationError(RuntimeError):
    pass


class ExpressionGenerator:
    """Invoke the expressive engine without mixing its dependencies into the API."""
    def __init__(self, python: Path, model_directory: Path, *, timeout_seconds: float = 900):
        self.python = python
        self.model_directory = model_directory
        self.timeout_seconds = timeout_seconds

    @property
    def is_loaded(self) -> bool:
        return False

    def is_installed(self) -> bool:
        return self.python.is_file() and (self.model_directory / 'experiment-manifest.json').is_file()

    def generate(self, *, audio_path: Path, text: str, intensity: float, on_phase: Callable[[str], None]) -> tuple[bytes, dict]:
        request = validate_request({'reference': str(audio_path.resolve()), 'text': text, 'intensity': intensity})
        if not self.python.is_file():
            raise ExpressionGenerationError('expression_runtime_missing')
        if not audio_path.is_file():
            raise ExpressionGenerationError('recording_audio_missing')
        with tempfile.TemporaryDirectory(prefix='voice-expression-') as directory:
            root = Path(directory)
            request_path = root / 'request.json'
            request_path.write_text(json.dumps(request, ensure_ascii=False), encoding='utf-8')
            output = root / 'result'
            environment = os.environ.copy()
            # Do not let the API's Python environment override the isolated engine.
            environment.pop('PYTHONPATH', None)
            environment.pop('PYTHONHOME', None)
            on_phase('loading_model')
            with (root / 'worker.log').open('w', encoding='utf-8') as log:
                process = subprocess.Popen([
                    str(self.python), str(WORKER_PATH), '--request', str(request_path),
                    '--model', str(self.model_directory.resolve()), '--output', str(output),
                ], stdout=log, stderr=subprocess.STDOUT, env=environment)
                started = time.monotonic()
                generating = False
                try:
                    while process.poll() is None:
                        if time.monotonic() - started > self.timeout_seconds:
                            raise ExpressionGenerationError('expression_timeout')
                        status_path = output / 'status.json'
                        if status_path.is_file():
                            status = json.loads(status_path.read_text(encoding='utf-8'))
                            if status.get('status') == 'generating' and not generating:
                                on_phase('generating')
                                generating = True
                        time.sleep(0.1)
                    if process.returncode != 0:
                        logging.getLogger(__name__).error('Expressive worker exited with code %s: %s', process.returncode, (root / 'worker.log').read_text(encoding='utf-8', errors='replace')[-4000:])
                        raise ExpressionGenerationError('expression_worker_failed')
                    status_path = output / 'status.json'
                    if not status_path.is_file() or not (output / 'audio.wav').is_file():
                        raise ExpressionGenerationError('expression_result_missing')
                    metrics = json.loads(status_path.read_text(encoding='utf-8'))
                    if metrics.pop('status', None) != 'completed':
                        raise ExpressionGenerationError('expression_result_incomplete')
                    if not generating:
                        on_phase('generating')
                    return (output / 'audio.wav').read_bytes(), metrics
                finally:
                    if process.poll() is None:
                        process.kill()
                    process.wait(timeout=10)
