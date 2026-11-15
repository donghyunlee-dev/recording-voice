"""Exercise real loopback HTTP generation in an isolated data directory."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import time
import urllib.request
import urllib.error
import wave
import io

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--engine', required=True, type=Path)
parser.add_argument('--reference', required=True, type=Path)
parser.add_argument('--output', required=True, type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root))
from local_runtime.app.storage import LocalRecordingStore
from local_runtime.app.expression_worker import MODEL_ID, MODEL_REVISION

before = hashlib.sha256(args.reference.read_bytes()).hexdigest()
reference_metadata = json.loads(args.reference.with_suffix('.json').read_text(encoding='utf-8'))
args.output.mkdir(parents=True, exist_ok=False)
voice = LocalRecordingStore(args.output / 'data').save(args.reference.read_bytes(), reference_metadata['transcript'], 'API verification reference')
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
code = secrets.token_urlsafe(12)
env = os.environ.copy()
env.update(LOCAL_VOICE_DATA_DIR=str(args.output / 'data'), LOCAL_VOICE_PORT=str(port), LOCAL_VOICE_PAIRING_CODE=code,
           LOCAL_VOICE_EXPRESSION_PYTHON=str(args.engine / 'Scripts/python.exe'), LOCAL_VOICE_EXPRESSION_MODEL_DIR=str(args.engine / 'model'))
base = f'http://127.0.0.1:{port}/api/v1'
headers = {'Content-Type': 'application/json', 'X-Local-Request': '1'}
def request(path, payload=None):
    req = urllib.request.Request(base + path, headers=headers, data=json.dumps(payload).encode() if payload is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"HTTP {error.code}: {error.read().decode()}") from None

with (args.output / 'runtime.log').open('w', encoding='utf-8') as log:
    process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'local_runtime.app.main:create_app', '--factory', '--host', '127.0.0.1', '--port', str(port)], cwd=root, env=env, stdout=log, stderr=subprocess.STDOUT)
    try:
        deadline = time.monotonic() + 30
        while True:
            try:
                health = request('/health')
                break
            except OSError:
                if process.poll() is not None or time.monotonic() > deadline:
                    raise RuntimeError('runtime_start_failed')
                time.sleep(.2)
        session = request('/pair', {'code': code})
        headers['Authorization'] = 'Bearer ' + session['access_token']
        job = request('/generations', {'recording_id': voice['id'], 'text': '안녕하세요. 오늘은 제가 좋아하는 책을 읽어보겠습니다.', 'model_id': MODEL_ID, 'expression_intensity': .8})
        deadline = time.monotonic() + 930
        statuses = [job['status']]
        while job['status'] not in {'completed', 'failed', 'cancelled'}:
            if time.monotonic() > deadline:
                raise RuntimeError('verification_timeout')
            time.sleep(1)
            job = request('/jobs/' + job['id'])
            if job['status'] != statuses[-1]:
                statuses.append(job['status'])
                print(job['status'], flush=True)
        (args.output / 'job.json').write_text(json.dumps(job, ensure_ascii=False, indent=2), encoding='utf-8')
        assert job['status'] == 'completed', job
        output = job['output']
        assert output['model_id'] == MODEL_ID and output['model_revision'] == MODEL_REVISION
        assert output['expression_intensity'] == .8
        with urllib.request.urlopen(urllib.request.Request(base + '/outputs/' + output['id'] + '/audio', headers=headers), timeout=10) as response:
            audio = response.read()
        with wave.open(io.BytesIO(audio)) as wav:
            assert wav.getnframes() > 0 and wav.getframerate() == 24000
            duration = wav.getnframes() / wav.getframerate()
        assert hashlib.sha256(args.reference.read_bytes()).hexdigest() == before
        report = {'health': health, 'statuses': statuses, 'output_id': output['id'], 'duration_seconds': duration, 'reference_unchanged': True, 'listening_accepted': False}
        (args.output / 'evidence.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        print(json.dumps(report), flush=True)
    finally:
        process.terminate()
        process.wait(timeout=20)
