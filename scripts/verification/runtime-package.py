"""Verify a built wheel outside the source tree with an actual loopback server."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
import zipfile


def verify(wheel: Path) -> None:
    with tempfile.TemporaryDirectory(prefix='voice-package-') as directory:
        root = Path(directory)
        with zipfile.ZipFile(wheel) as archive:
            expected = {'local_runtime/app/main.py', 'local_runtime/app/__main__.py', 'local_runtime/app/workspaces.py'}
            if not expected.issubset(archive.namelist()):
                raise RuntimeError('Wheel is missing runtime modules')
            archive.extractall(root)
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            port = listener.getsockname()[1]
        env = {**os.environ, 'PYTHONPATH': str(root), 'LOCAL_VOICE_PORT': str(port),
               'LOCAL_VOICE_DATA_DIR': str(root / 'data'),
               'LOCAL_VOICE_ALLOWED_ORIGINS': 'https://studio.example.test'}
        with (root / 'server.log').open('w+b') as log:
            process = subprocess.Popen([sys.executable, '-m', 'local_runtime.app'], cwd=root, env=env, stdout=log, stderr=log)
            try:
                for _ in range(100):
                    if process.poll() is not None:
                        log.seek(0)
                        raise RuntimeError(log.read().decode(errors='replace'))
                    try:
                        with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/v1/health', timeout=1) as response:
                            health = json.load(response)
                        break
                    except OSError:
                        time.sleep(0.1)
                else:
                    raise RuntimeError('Packaged runtime did not start')
                assert health['version'] == '0.3.1', health
                assert {'workspaces', 'voice_names', 'job_history'}.issubset(health['capabilities']), health
                print(json.dumps({'status': 'passed', 'package': wheel.name, 'health': health}))
            finally:
                if process.poll() is None:
                    process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)


if __name__ == '__main__':
    verify(Path(sys.argv[1]).resolve())
