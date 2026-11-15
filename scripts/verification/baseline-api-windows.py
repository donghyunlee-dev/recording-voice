"""Verify installed Windows voice generation with isolated data and a copied reference."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
import wave

parser = argparse.ArgumentParser()
parser.add_argument('--reference', type=Path, required=True)
args = parser.parse_args()
original = args.reference.read_bytes()
original_hash = hashlib.sha256(original).hexdigest()
metadata = json.loads(args.reference.with_suffix('.json').read_text(encoding='utf-8'))
with tempfile.TemporaryDirectory(prefix='voice-baseline-api-') as directory:
    root = Path(directory)
    data = root / 'data'
    from local_runtime.app.storage import LocalRecordingStore
    voice = LocalRecordingStore(data).save(original, metadata['transcript'])
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        port = listener.getsockname()[1]
    origin = f'http://127.0.0.1:{port}/api/v1'
    code = secrets.token_urlsafe(12)
    headers = {'X-Local-Request': '1', 'Content-Type': 'application/json'}
    def request(path, payload=None):
        req = urllib.request.Request(origin + path, data=json.dumps(payload).encode() if payload is not None else None, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.load(response)
    env = {**os.environ, 'LOCAL_VOICE_DATA_DIR': str(data), 'LOCAL_VOICE_PORT': str(port), 'LOCAL_VOICE_PAIRING_CODE': code,
           'HF_HOME': str(Path(os.environ['LOCALAPPDATA']) / 'VoiceStudio/models/huggingface')}
    with (root / 'runtime.log').open('w', encoding='utf-8') as log:
        process = subprocess.Popen([sys.executable, '-m', 'local_runtime.app'], cwd=root, env=env, stdout=log, stderr=subprocess.STDOUT)
        try:
            deadline = time.monotonic() + 30
            while True:
                try:
                    health = request('/health')
                    break
                except OSError:
                    if process.poll() is not None or time.monotonic() > deadline: raise RuntimeError('runtime_start_failed')
                    time.sleep(.2)
            token = request('/pair', {'code': code})['access_token']
            headers['Authorization'] = 'Bearer ' + token
            models = request('/models')['items']
            baseline = next(model for model in models if model['id'] == 'qwen3-tts-0.6b-base')
            assert baseline['status'] == 'installed', baseline
            job = request('/generations', {'recording_id': voice['id'], 'text': '안녕하세요. 오늘은 새 대본을 읽어보겠습니다.', 'model_id': baseline['id']})
            deadline = time.monotonic() + 900
            statuses = [job['status']]
            while job['status'] not in ('completed','failed','cancelled'):
                if time.monotonic() > deadline: raise RuntimeError('generation_timeout')
                time.sleep(2)
                job = request('/jobs/' + job['id'])
                if job['status'] != statuses[-1]:
                    statuses.append(job['status'])
                    print(job['status'], flush=True)
            assert job['status'] == 'completed', job
            with urllib.request.urlopen(urllib.request.Request(origin + '/outputs/' + job['output_id'] + '/audio', headers=headers)) as response:
                audio = response.read()
            with wave.open(io.BytesIO(audio)) as wav:
                duration = wav.getnframes()/wav.getframerate()
                assert duration > 0
            assert hashlib.sha256(args.reference.read_bytes()).hexdigest() == original_hash
            print(json.dumps({'status':'passed','health':health,'statuses':statuses,'audio_seconds':duration,'reference_unchanged':True,'listening_accepted':False}), flush=True)
        finally:
            process.terminate()
            process.wait(timeout=20)
